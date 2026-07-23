/**
 * OpenAI-Compatible Provider Adapter
 * Works with OpenRouter, 9Router, and any OpenAI-compatible API gateway.
 */
import type {
  AIProviderConfig,
  AIModelConfig,
  StreamEvent,
  TokenUsage,
} from '../../../../shared/types/agent';
import { AgentError } from '../../../../shared/types/agent';
import { ProviderAdapter } from '../ProviderAdapter';
import type { ChatCompletionRequest, ChatCompletionResponse } from '../ProviderAdapter';

interface OpenAIMessage {
  role: string;
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  stream?: boolean;
  tools?: Array<{
    type: 'function';
    function: { name: string; description: string; parameters: Record<string, unknown> };
  }>;
}

interface OpenAIResponse {
  id: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string | null; tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }> };
    finish_reason: string;
  }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  model: string;
}

interface OpenAIStreamChunk {
  id: string;
  choices: Array<{
    index: number;
    delta: { role?: string; content?: string; tool_calls?: Array<{ index: number; id?: string; type?: string; function?: { name?: string; arguments?: string } }> };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export class OpenAICompatibleProvider extends ProviderAdapter {
  get name(): string { return this.config.name; }
  get type(): string { return this.config.type; }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const modelConfig = this.findModel(request.model);
    const body: OpenAIRequest = {
      model: request.model,
      messages: request.messages.map((m) => {
        const msg: any = { role: m.role };
        if (m.content !== undefined && m.content !== null) msg.content = m.content;
        if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
        if ((m as any).tool_calls) msg.tool_calls = (m as any).tool_calls;
        return msg;
      }),
      temperature: request.temperature ?? modelConfig?.defaultTemperature ?? 0.7,
      max_tokens: request.maxTokens ?? modelConfig?.maxOutputTokens ?? 4096,
      top_p: request.topP ?? modelConfig?.defaultTopP ?? 1.0,
      ...(request.frequencyPenalty !== undefined ? { frequency_penalty: request.frequencyPenalty } : {}),
      ...(request.presencePenalty !== undefined ? { presence_penalty: request.presencePenalty } : {}),
      ...(request.stop ? { stop: request.stop } : {}),
      stream: false,
      ...(request.tools ? { tools: request.tools } : {}),
    };

    const response = await this.fetchWithRetry(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new AgentError(
        `API error ${response.status}: ${errorText}`,
        'API_ERROR',
        'provider',
        this.config.id,
        response.status >= 500,
        response.status,
      );
    }

    const data = (await response.json()) as OpenAIResponse;
    const choice = data.choices[0];

    const toolCalls = choice.message.tool_calls?.map(tc => ({
      id: tc.id,
      name: tc.function.name,
      arguments: this.parseToolArguments(tc.function.arguments),
    }));

    const usage: TokenUsage = {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
      estimatedCost: modelConfig
        ? this.calculateCost(
            { promptTokens: data.usage?.prompt_tokens ?? 0, completionTokens: data.usage?.completion_tokens ?? 0, totalTokens: data.usage?.total_tokens ?? 0, estimatedCost: 0 },
            modelConfig,
          )
        : 0,
    };

    return {
      id: data.id,
      content: choice.message.content ?? '',
      finishReason: choice.finish_reason,
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
      usage,
      model: data.model,
    };
  }

  async *chatStream(request: ChatCompletionRequest): AsyncGenerator<StreamEvent> {
    const modelConfig = this.findModel(request.model);
    const body: OpenAIRequest = {
      model: request.model,
      messages: request.messages.map((m) => {
        const msg: any = { role: m.role };
        if (m.content !== undefined && m.content !== null) msg.content = m.content;
        if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
        if ((m as any).tool_calls) msg.tool_calls = (m as any).tool_calls;
        return msg;
      }),
      temperature: request.temperature ?? modelConfig?.defaultTemperature ?? 0.7,
      max_tokens: request.maxTokens ?? modelConfig?.maxOutputTokens ?? 4096,
      top_p: request.topP ?? modelConfig?.defaultTopP ?? 1.0,
      ...(request.frequencyPenalty !== undefined ? { frequency_penalty: request.frequencyPenalty } : {}),
      ...(request.presencePenalty !== undefined ? { presence_penalty: request.presencePenalty } : {}),
      ...(request.stop ? { stop: request.stop } : {}),
      stream: true,
      ...(request.tools ? { tools: request.tools } : {}),
    };

    const response = await this.fetchWithRetry(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new AgentError(
        `Stream error ${response.status}: ${errorText}`,
        'STREAM_ERROR',
        'provider',
        this.config.id,
        response.status >= 500,
        response.status,
      );
    }

    const reader = response.body?.getReader();
    if (!reader) throw new AgentError('No response body', 'STREAM_ERROR', 'provider', this.config.id);

    const decoder = new TextDecoder();
    let buffer = '';
    const activeToolCalls = new Map<number, { id: string; name: string; arguments: string }>();

    yield { type: 'message_start', data: { model: request.model }, timestamp: Date.now() };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            yield { type: 'done', data: null, timestamp: Date.now() };
            return;
          }

          try {
            const chunk = JSON.parse(data) as OpenAIStreamChunk;
            const choice = chunk.choices?.[0];
            if (!choice) continue;

            if (choice.delta.content) {
              yield { type: 'content_delta', data: { content: choice.delta.content }, timestamp: Date.now() };
            }

            if (choice.delta.tool_calls) {
              for (const tc of choice.delta.tool_calls) {
                if (tc.id && tc.function?.name) {
                  activeToolCalls.set(tc.index, { id: tc.id, name: tc.function.name, arguments: '' });
                  yield {
                    type: 'tool_call_start',
                    data: { toolCallId: tc.id, name: tc.function.name },
                    timestamp: Date.now(),
                  };
                }
                if (tc.function?.arguments) {
                  const existing = activeToolCalls.get(tc.index);
                  if (existing) {
                    existing.arguments += tc.function.arguments;
                    yield {
                      type: 'tool_call_delta',
                      data: { toolCallId: existing.id, argumentsDelta: tc.function.arguments },
                      timestamp: Date.now(),
                    };
                  }
                }
              }
            }

            if (choice.finish_reason) {
              for (const [, tc] of activeToolCalls) {
                yield {
                  type: 'tool_call_done',
                  data: { toolCallId: tc.id, name: tc.name, arguments: this.parseToolArguments(tc.arguments) },
                  timestamp: Date.now(),
                };
              }
              if (chunk.usage) {
                yield {
                  type: 'usage_update',
                  data: {
                    promptTokens: chunk.usage.prompt_tokens,
                    completionTokens: chunk.usage.completion_tokens,
                    totalTokens: chunk.usage.total_tokens,
                  },
                  timestamp: Date.now(),
                };
              }
              yield { type: 'content_done', data: { finishReason: choice.finish_reason }, timestamp: Date.now() };
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async listModels(): Promise<AIModelConfig[]> {
    try {
      const response = await this.fetchWithRetry(`${this.config.baseUrl}/models`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) return this.config.models ?? [];

      const data = (await response.json()) as { data?: Array<{ id: string; description?: string }> };
      const models = data.data ?? [];

      return models.map((m) => ({
        id: m.id,
        name: m.id,
        providerId: this.config.id,
        contextWindow: 128000,
        maxOutputTokens: 4096,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: false,
        inputCostPer1k: 0,
        outputCostPer1k: 0,
        defaultTemperature: 0.7,
        defaultTopP: 1.0,
        description: m.description,
      }));
    } catch {
      return this.config.models ?? [];
    }
  }

  async testConnection(): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        method: 'GET',
        headers: this.buildHeaders(),
        signal: AbortSignal.timeout(10000),
      });
      const latencyMs = Date.now() - start;
      if (!response.ok) {
        return { success: false, latencyMs, error: `HTTP ${response.status}` };
      }
      return { success: true, latencyMs };
    } catch (err) {
      return { success: false, latencyMs: Date.now() - start, error: (err as Error).message };
    }
  }

  private findModel(modelId: string): AIModelConfig | undefined {
    return this.config.models?.find((m) => m.id === modelId);
  }

  private parseToolArguments(args: string): Record<string, unknown> {
    try {
      return JSON.parse(args);
    } catch {
      return {};
    }
  }
}
