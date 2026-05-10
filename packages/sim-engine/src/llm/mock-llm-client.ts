import { LLMClient, LLMResponse } from './llm-client';

export class MockLLMClient implements LLMClient {
  private calls: Array<{ systemPrompt: string; userPrompt: string }> = [];
  private fixtureContent: string = '[Mock LLM output — no API call made]';

  setFixtureContent(content: string): void {
    this.fixtureContent = content;
  }

  getCallCount(): number {
    return this.calls.length;
  }

  getLastCall(): { systemPrompt: string; userPrompt: string } | undefined {
    return this.calls[this.calls.length - 1];
  }

  reset(): void {
    this.calls = [];
    this.fixtureContent = '[Mock LLM output — no API call made]';
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<LLMResponse> {
    this.calls.push({ systemPrompt, userPrompt });
    return {
      content: this.fixtureContent,
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
