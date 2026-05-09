import { PrismaClient } from '@wixbury/db';
import { LLMClient } from '../llm/llm-client';
import { BiographyUpdater } from './biography-updater';
import { logError, logStructured } from '../logger';
import { SIGNIFICANCE_THRESHOLD, MAX_BIO_UPDATES_PER_EDITION, BIO_UPDATE_SIGNIFICANCE_THRESHOLD } from '../constants';

const GAZETTE_SYSTEM_PROMPT = `You are the editor of The Wixbury Gazette, a weekly local newspaper serving the small post-industrial town of Wixbury in northern England.

Setting: Wixbury, circa 1990. A working-class town with a fading industrial past and tight-knit community bonds. Four districts: Town Centre (civic and commercial heart), Millside (working-class residential), Harrowgate (slightly more affluent residential), The Works (light industry and football ground). Key institutions: Wixbury Town Council, St. Aldred's Church, The Miner's Rest pub, Wixbury Park Rangers football club.

Your voice is neutral, local, and understated. You write like a real small-town English newspaper: factual, community-focused, never sensationalist. You trust your readers to understand the significance of quiet local events. You do not editorialize. You use plain, clear prose.

You will receive a JSON array of events from the past week. Each event contains:
- type: the kind of event (e.g. relationship_changed, needs_crisis)
- significance: 0.0–1.0
- data: event-specific details
- citizenNames: names of citizens involved
- districtName: where it occurred, or null

Write a complete newspaper edition with this structure:
1. Masthead line: "THE WIXBURY GAZETTE" followed by the edition note
2. Lead story: the highest-significance event (150–250 words)
3. Secondary stories: 1–3 shorter pieces on other events (80–150 words each), in descending significance order
4. Community notices: brief lines for any remaining events (20–50 words each)

Rules you must follow:
- Only write about events in the provided JSON. Do not invent events, names, or facts not present in the data.
- Use citizen names exactly as given.
- Plain text only. No markdown, no asterisks, no hash symbols.
- Tone is neutral and grounded. A new friendship is a community story. Hard times are reported with dignity, not drama.
- End with the line: "The Wixbury Gazette is published weekly. All rights reserved."`;

interface EventPayload {
  type: string;
  significance: number;
  data: unknown;
  citizenNames: string[];
  districtName: string | null;
}

export class NewspaperJob {
  private readonly bioUpdater: BiographyUpdater;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly llm: LLMClient,
  ) {
    this.bioUpdater = new BiographyUpdater(prisma, llm);
  }

  async run(weekStart: number, weekEnd: number, editionTick: number): Promise<void> {
    const events = await this.prisma.event.findMany({
      where: {
        writtenUp: false,
        significance: { gte: SIGNIFICANCE_THRESHOLD },
        occurredAt: { gte: weekStart, lte: weekEnd },
      },
      orderBy: { significance: 'desc' },
    });

    if (events.length === 0) {
      logStructured({ event: 'newspaper_skip', reason: 'no_significant_events', editionTick });
      return;
    }

    const citizenIdSet = new Set(events.flatMap(e => e.citizenIds as string[]));
    const citizenIds = [...citizenIdSet];
    const citizens = await this.prisma.citizen.findMany({ where: { id: { in: citizenIds } } });
    const citizenMap = new Map(citizens.map(c => [c.id, c]));

    const districts = await this.prisma.district.findMany();
    const districtMap = new Map(districts.map(d => [d.id, d.name]));

    const payload: EventPayload[] = events.map(e => ({
      type: e.type,
      significance: e.significance,
      data: e.data,
      citizenNames: (e.citizenIds as string[]).map(id => citizenMap.get(id)?.name ?? 'Unknown'),
      districtName: e.districtId !== null ? (districtMap.get(e.districtId) ?? null) : null,
    }));

    const userPrompt = `Generate a newspaper edition for the week ending at tick ${weekEnd}.\n\nEvents this week:\n${JSON.stringify(payload, null, 2)}`;

    let response;
    try {
      response = await this.llm.generate(GAZETTE_SYSTEM_PROMPT, userPrompt);
    } catch (err) {
      logError({
        event: 'newspaper_llm_error',
        editionTick,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    await this.prisma.newspaperEdition.create({
      data: {
        editionAt: editionTick,
        weekStart,
        weekEnd,
        content: response.content,
      },
    });

    await this.prisma.event.updateMany({
      where: { id: { in: events.map(e => e.id) } },
      data: { writtenUp: true },
    });

    logStructured({
      event: 'newspaper_edition_generated',
      editionTick,
      eventsUsed: events.length,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      cacheReadTokens: response.usage.cacheReadTokens,
      cacheWriteTokens: response.usage.cacheWriteTokens,
      estimatedCostUsd: response.usage.estimatedCostUsd,
    });

    await this.updateBiographies(events, BIO_UPDATE_SIGNIFICANCE_THRESHOLD);
  }

  private async updateBiographies(
    events: Array<{ citizenIds: unknown; significance: number }>,
    threshold: number,
  ): Promise<void> {
    const highSigEvents = events.filter(e => e.significance >= threshold);
    if (highSigEvents.length === 0) return;

    const seen = new Set<string>();
    let updatesRemaining = MAX_BIO_UPDATES_PER_EDITION;

    for (const event of highSigEvents) {
      if (updatesRemaining === 0) break;
      for (const id of event.citizenIds as string[]) {
        if (updatesRemaining === 0) break;
        if (seen.has(id)) continue;
        seen.add(id);
        await this.bioUpdater.maybeUpdate(id, event.significance);
        updatesRemaining--;
      }
    }
  }
}
