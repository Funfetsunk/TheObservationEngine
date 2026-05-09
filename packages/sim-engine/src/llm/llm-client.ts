export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  estimatedCostUsd: number;
}

export interface LLMResponse {
  content: string;
  usage: LLMUsage;
}

export interface LLMClient {
  generate(systemPrompt: string, userPrompt: string): Promise<LLMResponse>;
}
