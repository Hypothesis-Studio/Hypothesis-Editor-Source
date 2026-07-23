/**
 * AI Provider Adapter - Abstract base for all AI gateway integrations.
 * Follows the Adapter pattern for extensible provider support.
 */
import type {
  AIProviderConfig,
  AIModelConfig,
  AIProviderStatus,
  StreamEvent,
  TokenUsage,
} from '../../../shared/types/agent';
import { AgentError } from '../../../shared/types/agent';
import { logger } from '../../utils/logger';

// Re-export shared types for convenience
export type { AIProviderConfig, AIModelConfig, StreamEvent, TokenUsage };

export interface ChatCompletionRequest {
  messages: Array<{
    role: string;
    content?: string | null;
    tool_call_id?: string;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }>;
  }>;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  stream?: boolean;
  tools?: Array<{
    type: 'function';
    function: { name: string; description: string; parameters: Record<string, unknown> };
  }>;
}

export interface ChatCompletionResponse {
  id: string;
  content: string;
  finishReason: string;
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  usage: TokenUsage;
  model: string;
}

export abstract class ProviderAdapter {
  protected config: AIProviderConfig;
  protected log: ReturnType<typeof logger.scope>;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.log = logger.scope(`Provider:${config.name}`);
  }

  abstract get name(): string;
  abstract get type(): string;

  abstract chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  abstract chatStream(request: ChatCompletionRequest): AsyncGenerator<StreamEvent>;
  abstract listModels(): Promise<AIModelConfig[]>;
  abstract testConnection(): Promise<{ success: boolean; latencyMs: number; error?: string }>;

  protected async fetchWithRetry(
    url: string,
    init: RequestInit,
    maxRetries: number = this.config.maxRetries ?? 3,
  ): Promise<Response> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeout ?? 60000);

        const response = await fetch(url, { ...init, signal: controller.signal });
        clearTimeout(timeout);

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.min(1000 * Math.pow(2, attempt), 30000);
          this.log.warn(`Rate limited, retrying after ${waitMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, waitMs));
          continue;
        }

        return response;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (lastError.name === 'AbortError') {
          throw new AgentError('Request timed out', 'TIMEOUT', 'timeout', this.config.id, true);
        }
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          this.log.warn(`Request failed, retrying after ${delay}ms: ${lastError.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw new AgentError(
      `Request failed after ${maxRetries + 1} attempts: ${lastError?.message}`,
      'PROVIDER_ERROR',
      'provider',
      this.config.id,
      true,
    );
  }

  protected buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      ...this.config.headers,
    };
  }

  protected calculateCost(usage: TokenUsage, model: AIModelConfig): number {
    const inputCost = (usage.promptTokens / 1000) * model.inputCostPer1k;
    const outputCost = (usage.completionTokens / 1000) * model.outputCostPer1k;
    return Math.round((inputCost + outputCost) * 1000000) / 1000000;
  }
}
