import { PrismaClient } from '@wixbury/db';
import { LLMClient } from '../llm/llm-client';
import { logError, logStructured } from '../logger';
import { BIO_UPDATE_SIGNIFICANCE_THRESHOLD } from '../constants';

const BIOGRAPHY_SYSTEM_PROMPT = `You write short biographies for citizens of Wixbury, a small post-industrial town in northern England circa 1990.

Write 2–3 sentences in third person. Focus on the person's occupation, character, and any notable things that have happened to them. Use a factual, understated tone — like a local Who's Who entry. Do not speculate beyond the facts provided. Do not use flowery language.`;

export class BiographyUpdater {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly llm: LLMClient,
  ) {}

  async maybeUpdate(citizenId: string, triggeringSignificance: number): Promise<void> {
    const citizen = await this.prisma.citizen.findUniqueOrThrow({ where: { id: citizenId } });

    if (citizen.biography !== null && triggeringSignificance < BIO_UPDATE_SIGNIFICANCE_THRESHOLD) {
      return;
    }

    const recentEvents = await this.prisma.event.findMany({
      where: {
        citizenIds: { has: citizenId },
        significance: { gte: 0.5 },
      },
      orderBy: { occurredAt: 'desc' },
      take: 10,
    });

    const eventSummaries = recentEvents.map(e => ({
      type: e.type,
      significance: e.significance,
      data: e.data,
    }));

    const userPrompt = `Write a short biography for this citizen.

Name: ${citizen.name}
Age: ${citizen.age}
Job: ${citizen.jobType}
Traits: ambition=${citizen.traitAmbition.toFixed(2)}, honesty=${citizen.traitHonesty.toFixed(2)}, sociability=${citizen.traitSociability.toFixed(2)}, empathy=${citizen.traitEmpathy.toFixed(2)}

Notable events involving this citizen (most recent first):
${JSON.stringify(eventSummaries, null, 2)}

Write 2–3 sentences in third person. Factual and understated.`;

    let response;
    try {
      response = await this.llm.generate(BIOGRAPHY_SYSTEM_PROMPT, userPrompt);
    } catch (err) {
      logError({
        event: 'biography_llm_error',
        citizenId,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    await this.prisma.citizen.update({
      where: { id: citizenId },
      data: { biography: response.content },
    });

    logStructured({
      event: 'biography_updated',
      citizenId,
      citizenName: citizen.name,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      estimatedCostUsd: response.usage.estimatedCostUsd,
    });
  }
}
