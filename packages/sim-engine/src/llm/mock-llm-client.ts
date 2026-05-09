import { LLMClient, LLMResponse } from './llm-client';

export class MockLLMClient implements LLMClient {
  async generate(_systemPrompt: string, _userPrompt: string): Promise<LLMResponse> {
    return {
      content: '[Mock LLM output — no API call made]',
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        estimatedCostUsd: 0,
      },
    };
  }
}
