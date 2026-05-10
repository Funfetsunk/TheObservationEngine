import { PrismaClient } from '@wixbury/db';
import { EventType } from '@wixbury/shared';
import { LLMClient } from '../llm/llm-client';
import { logError, logStructured } from '../logger';
import { HISTORICAL_SUMMARY_SIGNIFICANCE_THRESHOLD } from '../constants';

const HISTORIAN_SYSTEM_PROMPT = `You are a local historian writing the annual retrospective for Wixbury, a small post-industrial town in northern England.

Setting: Wixbury, circa 1991 onward. A working-class town with a fading industrial past, tight-knit community bonds, and the slow rhythms of a place that has seen better decades. Four districts: Town Centre (civic and commercial heart), Millside (working-class residential), Harrowgate (slightly more affluent residential), The Works (light industry and football ground). Key institutions: Wixbury Town Council, St. Aldred's Church, The Miner's Rest pub, Wixbury Park Rangers football club.

You are writing a year-end retrospective — a single page of considered prose that looks back at what happened in Wixbury over the past year. Your voice is measured, local, and unsentimental. You write for posterity, not for news. You note what changed, who was lost, who arrived, and what the town is becoming.

You will receive a JSON object with:
- simYear: the year number (1 = the first year of the simulation)
- events: significant events from the year (type, significance, data, citizenNames, districtName)
- births: citizens born this year (name, age, jobType)
- deaths: citizens who died this year (name, age, jobType)
- elections: elections held this year (heldAt, districtId, candidateIds, winnerId, voteData)

Write a single cohesive retrospective (350–500 words). Structure it as flowing prose paragraphs — no headings, no bullet points. Begin with a brief scene-setting sentence about the year. Cover the major events, deaths, births, and any political or economic shifts. End with a quiet observation about where the town stands as the year closes.

Rules:
- Only write about what is in the provided JSON. Do not invent events, names, or facts.
- Use citizen names exactly as given.
- Plain text only. No markdown, no asterisks, no hash symbols.
- Tone is reflective, local, and grounded. A death is noted with dignity. An election is noted without drama.
- End with exactly this line on its own: "End of Year [N] Record." where [N] is the simYear number.`;

interface ArchiveEventItem {
  type: string;
  significance: number;
  data: unknown;
  citizenNames: string[];
  districtName: string | null;
}

interface ArchiveCitizenItem {
  name: string;
  age: number;
  jobType: string;
}

interface ArchiveElectionItem {
  heldAt: number;
  districtId: string | null;
  candidateIds: string[];
  winnerId: string;
  voteData: unknown;
}

interface ArchivePayload {
  simYear: number;
  events: ArchiveEventItem[];
  births: ArchiveCitizenItem[];
  deaths: ArchiveCitizenItem[];
  elections: ArchiveElectionItem[];
}

export class HistoricalArchiveJob {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly llm: LLMClient,
  ) {}

  async run(yearStart: number, yearEnd: number, simYear: number): Promise<void> {
    const [events, allCitizens, elections] = await Promise.all([
      this.prisma.event.findMany({
        where: {
          occurredAt: { gte: yearStart, lte: yearEnd },
          significance: { gte: HISTORICAL_SUMMARY_SIGNIFICANCE_THRESHOLD },
        },
        orderBy: { significance: 'desc' },
      }),
      this.prisma.citizen.findMany({
        where: {
          OR: [
            { bornAt: { gte: yearStart, lte: yearEnd } },
            { diedAt: { gte: yearStart, lte: yearEnd } },
          ],
        },
      }),
      this.prisma.election.findMany({
        where: { heldAt: { gte: yearStart, lte: yearEnd } },
      }),
    ]);

    const citizenIdSet = new Set(events.flatMap(e => e.citizenIds as string[]));
    const [namedCitizens, districts] = await Promise.all([
      citizenIdSet.size > 0
        ? this.prisma.citizen.findMany({
            where: { id: { in: [...citizenIdSet] } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      this.prisma.district.findMany({ select: { id: true, name: true } }),
    ]);

    const citizenNameMap = new Map(namedCitizens.map(c => [c.id, c.name]));
    const districtMap = new Map(districts.map(d => [d.id, d.name]));

    const births: ArchiveCitizenItem[] = allCitizens
      .filter(c => c.bornAt >= yearStart && c.bornAt <= yearEnd)
      .map(c => ({ name: c.name, age: c.age, jobType: c.jobType }));

    const deaths: ArchiveCitizenItem[] = allCitizens
      .filter(c => c.diedAt !== null && c.diedAt >= yearStart && c.diedAt <= yearEnd)
      .map(c => ({ name: c.name, age: c.age, jobType: c.jobType }));

    const eventItems: ArchiveEventItem[] = events.map(e => ({
      type: e.type,
      significance: e.significance,
      data: e.data,
      citizenNames: (e.citizenIds as string[]).map(id => citizenNameMap.get(id) ?? 'Unknown'),
      districtName: e.districtId !== null ? (districtMap.get(e.districtId) ?? null) : null,
    }));

    const electionItems: ArchiveElectionItem[] = elections.map(el => ({
      heldAt: el.heldAt,
      districtId: el.districtId,
      candidateIds: el.candidateIds,
      winnerId: el.winnerId,
      voteData: el.voteData,
    }));

    const payload: ArchivePayload = {
      simYear,
      events: eventItems,
      births,
      deaths,
      elections: electionItems,
    };

    const userPrompt = `Write the Year ${simYear} retrospective for Wixbury.\n\n${JSON.stringify(payload, null, 2)}`;

    let response;
    try {
      response = await this.llm.generate(HISTORIAN_SYSTEM_PROMPT, userPrompt);
    } catch (err) {
      logError({
        event: 'historical_archive_llm_error',
        simYear,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    const summary = await this.prisma.historicalSummary.create({
      data: {
        simYear,
        yearStart,
        yearEnd,
        content: response.content,
      },
    });

    await this.prisma.event.create({
      data: {
        type: EventType.YearClosed,
        occurredAt: yearEnd,
        districtId: null,
        citizenIds: [],
        data: { simYear, summaryId: summary.id },
        significance: 0.50,
        writtenUp: false,
      },
    });

    logStructured({
      event: 'historical_archive_generated',
      simYear,
      yearStart,
      yearEnd,
      eventCount: events.length,
      birthCount: births.length,
      deathCount: deaths.length,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      estimatedCostUsd: response.usage.estimatedCostUsd,
    });
  }
}
