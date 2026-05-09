import Anthropic from '@anthropic-ai/sdk';
import type { PromptCachingBetaTextBlockParam } from '@anthropic-ai/sdk/resources/beta/prompt-caching/messages';
import { LLMClient, LLMResponse } from './llm-client';

// Pricing for claude-sonnet-4-20250514 (per token)
const INPUT_COST_PER_TOKEN = 3.0 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 15.0 / 1_000_000;
const CACHE_READ_COST_PER_TOKEN = 0.3 / 1_000_000;
const CACHE_WRITE_COST_PER_TOKEN = 3.75 / 1_000_000;

const MODEL = 'claude-sonnet-4-6';

export class AnthropicClient implements LLMClient {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<LLMResponse> {
    const system: PromptCachingBetaTextBlockParam[] = [
      { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
    ];

    const response = await this.client.beta.promptCaching.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    const usage = response.usage;
    const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
    const cacheWriteTokens = usage.cache_creation_input_tokens ?? 0;
    const inputTokens = usage.input_tokens;
    const outputTokens = usage.output_tokens;

    const estimatedCostUsd =
      inputTokens * INPUT_COST_PER_TOKEN +
      outputTokens * OUTPUT_COST_PER_TOKEN +
      cacheReadTokens * CACHE_READ_COST_PER_TOKEN +
      cacheWriteTokens * CACHE_WRITE_COST_PER_TOKEN;

    return {
      content,
      usage: { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, estimatedCostUsd },
    };
  }
}
