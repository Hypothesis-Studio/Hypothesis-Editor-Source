/**
 * Anthropic Provider Adapter
 * Full Anthropic Messages API with SSE streaming, tool use, and retry logic.
 * Uses Node built-in https module — no fetch/axios.
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
import https from 'https';
import http from 'http';
import { IncomingMessage } from 'http';

const ANTHROPIC_API_BASE = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_BETA = 'tools-2024-04-04';

interface AnthropicContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string;
  tool_use_id?: string;
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  system?: string;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
  stream?: boolean;
  tools?: Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }>;
}

interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  usage: { input_tokens: number; output_tokens: number };
}

interface AnthropicSSEEvent {
  type: string;
  index?: number;
  delta?: {
    type: string;
    text?: string;
    partial_json?: string;
    stop_reason?: string;
  };
  content_block?: AnthropicContentBlock;
  message?: Partial<AnthropicResponse>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export class AnthropicProvider extends ProviderAdapter {
  get name(): string { return this.config.name; }
  get type(): string { return 'anthropic'; }

  protected buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.config.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-beta': ANTHROPIC_BETA,
      ...this.config.headers,
    };
  }

  private buildMessages(request: ChatCompletionRequest): { system?: string; messages: AnthropicMessage[] } {
    let system: string | undefined;
    const messages: AnthropicMessage[] = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        system = (system ? system + '\n' : '') + (msg.content ?? '');
        continue;
      }
      if (msg.role === 'tool') {
        // Tool results go as user messages with tool_result blocks
        const last = messages[messages.length - 1];
        const block: AnthropicContentBlock = {
          type: 'tool_result',
          tool_use_id: (msg as any).tool_call_id ?? '',
          content: msg.content ?? '',
        };
        if (last?.role === 'user' && Array.isArray(last.content)) {
          (last.content as AnthropicContentBlock[]).push(block);
        } else {
          messages.push({ role: 'user', content: [block] });
        }
        continue;
      }
      if (msg.role === 'assistant') {
        const toolCalls = (msg as any).tool_calls as Array<{ id: string; function: { name: string; arguments: string } }> | undefined;
        if (toolCalls && toolCalls.length > 0) {
          const blocks: AnthropicContentBlock[] = [];
          if (msg.content) blocks.push({ type: 'text', text: msg.content });
          for (const tc of toolCalls) {
            let input: Record<string, unknown> = {};
            try { input = JSON.parse(tc.function.arguments); } catch { /* ignore */ }
            blocks.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
          }
          messages.push({ role: 'assistant', content: blocks });
        } else {
          messages.push({ role: 'assistant', content: msg.content ?? '' });
        }
        continue;
      }
      // user
      messages.push({ role: 'user', content: msg.content ?? '' });
    }

    // Anthropic requires messages to alternate user/assistant; merge consecutive same-role
    const merged: AnthropicMessage[] = [];
    for (const msg of messages) {
      const prev = merged[merged.length - 1];
      if (prev && prev.role === msg.role) {
        if (typeof prev.content === 'string' && typeof msg.content === 'string') {
          prev.content += '\n' + msg.content;
        } else {
          const prevArr = Array.isArray(prev.content) ? prev.content : [{ type: 'text' as const, text: prev.content }];
          const currArr = Array.isArray(msg.content) ? msg.content : [{ type: 'text' as const, text: msg.content as string }];
          prev.content = [...prevArr, ...currArr];
        }
      } else {
        merged.push(msg);
      }
    }
    return { system, messages: merged };
  }

  private buildTools(request: ChatCompletionRequest): AnthropicRequest['tools'] {
    if (!request.tools) return undefined;
    return request.tools.map(t => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: {
        type: 'object',
        ...(t.function.parameters as Record<string, unknown>),
      },
    }));
  }

  private httpsRequest(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: string,
  ): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request({
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method,
        headers: { ...headers, 'Content-Length': Buffer.byteLength(body).toString() },
        timeout: this.config.timeout ?? 120000,
      }, (res: IncomingMessage) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve({
          statusCode: res.statusCode ?? 0,
          headers: res.headers as Record<string, string>,
          body: Buffer.concat(chunks).toString('utf-8'),
        }));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new AgentError('Request timed out', 'TIMEOUT', 'provider', this.config.id, true)); });
      req.write(body);
      req.end();
    });
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const modelConfig = this.findModel(request.model);
    const { system, messages } = this.buildMessages(request);
    const body: AnthropicRequest = {
      model: request.model,
      max_tokens: request.maxTokens ?? modelConfig?.maxOutputTokens ?? 4096,
      messages,
      ...(system ? { system } : {}),
      temperature: request.temperature ?? modelConfig?.defaultTemperature ?? 0.7,
      top_p: request.topP ?? modelConfig?.defaultTopP ?? 1.0,
      ...(request.stop ? { stop_sequences: request.stop } : {}),
      ...(request.tools ? { tools: this.buildTools(request) } : {}),
      stream: false,
    };

    const baseUrl = this.config.baseUrl || ANTHROPIC_API_BASE;
    const { statusCode, body: responseBody } = await this.httpsRequest(
      `${baseUrl}/v1/messages`,
      'POST',
      this.buildHeaders(),
      JSON.stringify(body),
    );

    if (statusCode >= 400) {
      let errorMsg = `HTTP ${statusCode}`;
      try { const e = JSON.parse(responseBody); errorMsg = e?.error?.message ?? errorMsg; } catch { /* ignore */ }
      throw new AgentError(errorMsg, 'API_ERROR', 'provider', this.config.id, statusCode >= 500, statusCode);
    }

    const data = JSON.parse(responseBody) as AnthropicResponse;
    const textBlocks = data.content.filter(b => b.type === 'text');
    const toolBlocks = data.content.filter(b => b.type === 'tool_use');

    const usage: TokenUsage = {
      promptTokens: data.usage.input_tokens,
      completionTokens: data.usage.output_tokens,
      totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      estimatedCost: modelConfig
        ? this.calculateCost(
            { promptTokens: data.usage.input_tokens, completionTokens: data.usage.output_tokens, totalTokens: data.usage.input_tokens + data.usage.output_tokens, estimatedCost: 0 },
            modelConfig,
          )
        : 0,
    };

    return {
      id: data.id,
      content: textBlocks.map(b => b.text ?? '').join(''),
      finishReason: data.stop_reason,
      toolCalls: toolBlocks.length > 0
        ? toolBlocks.map(b => ({ id: b.id!, name: b.name!, arguments: b.input ?? {} }))
        : undefined,
      usage,
      model: data.model,
    };
  }

  async *chatStream(request: ChatCompletionRequest): AsyncGenerator<StreamEvent> {
    const modelConfig = this.findModel(request.model);
    const { system, messages } = this.buildMessages(request);
    const body: AnthropicRequest = {
      model: request.model,
      max_tokens: request.maxTokens ?? modelConfig?.maxOutputTokens ?? 4096,
      messages,
      ...(system ? { system } : {}),
      temperature: request.temperature ?? modelConfig?.defaultTemperature ?? 0.7,
      top_p: request.topP ?? modelConfig?.defaultTopP ?? 1.0,
      ...(request.stop ? { stop_sequences: request.stop } : {}),
      ...(request.tools ? { tools: this.buildTools(request) } : {}),
      stream: true,
    };

    const baseUrl = this.config.baseUrl || ANTHROPIC_API_BASE;
    const bodyStr = JSON.stringify(body);
    const parsed = new URL(`${baseUrl}/v1/messages`);

    const responseStream = await new Promise<IncomingMessage>((resolve, reject) => {
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request({
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname,
        method: 'POST',
        headers: { ...this.buildHeaders(), 'Content-Length': Buffer.byteLength(bodyStr).toString() },
        timeout: this.config.timeout ?? 120000,
      }, resolve);
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new AgentError('Stream timed out', 'TIMEOUT', 'provider', this.config.id, true)); });
      req.write(bodyStr);
      req.end();
    });

    if ((responseStream.statusCode ?? 0) >= 400) {
      const errBody = await new Promise<string>(res => {
        const chunks: Buffer[] = [];
        responseStream.on('data', (c: Buffer) => chunks.push(c));
        responseStream.on('end', () => res(Buffer.concat(chunks).toString()));
      });
      let msg = `HTTP ${responseStream.statusCode}`;
      try { const e = JSON.parse(errBody); msg = e?.error?.message ?? msg; } catch { /* ignore */ }
      throw new AgentError(msg, 'STREAM_ERROR', 'provider', this.config.id, (responseStream.statusCode ?? 0) >= 500, responseStream.statusCode);
    }

    yield { type: 'message_start', data: { model: request.model }, timestamp: Date.now() };

    const activeToolCalls = new Map<number, { id: string; name: string; json: string }>();
    let buffer = '';

    let contentDoneYielded = false;

    try {
      for await (const chunk of responseStream) {
        buffer += (chunk as Buffer).toString('utf-8');
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const raw = trimmed.slice(5).trim();
          if (!raw || raw === '[DONE]') continue;

          let event: AnthropicSSEEvent;
          try { event = JSON.parse(raw); } catch { continue; }

          switch (event.type) {
            case 'content_block_start': {
              const block = event.content_block;
              if (!block) break;
              if (block.type === 'tool_use' && block.id && block.name) {
                activeToolCalls.set(event.index ?? 0, { id: block.id, name: block.name, json: '' });
                yield { type: 'tool_call_start', data: { toolCallId: block.id, name: block.name }, timestamp: Date.now() };
              }
              break;
            }
            case 'content_block_delta': {
              const delta = event.delta;
              if (!delta) break;
              if (delta.type === 'text_delta' && delta.text) {
                yield { type: 'content_delta', data: { content: delta.text }, timestamp: Date.now() };
              }
              if (delta.type === 'input_json_delta' && delta.partial_json) {
                const tc = activeToolCalls.get(event.index ?? 0);
                if (tc) {
                  tc.json += delta.partial_json;
                  yield { type: 'tool_call_delta', data: { toolCallId: tc.id, argumentsDelta: delta.partial_json }, timestamp: Date.now() };
                }
              }
              break;
            }
            case 'content_block_stop': {
              const tc = activeToolCalls.get(event.index ?? 0);
              if (tc) {
                let args: Record<string, unknown> = {};
                try { args = JSON.parse(tc.json); } catch { /* ignore */ }
                yield { type: 'tool_call_done', data: { toolCallId: tc.id, name: tc.name, arguments: args }, timestamp: Date.now() };
                activeToolCalls.delete(event.index ?? 0);
              }
              break;
            }
            case 'message_delta': {
              const delta = event.delta;
              if (delta?.stop_reason) {
                contentDoneYielded = true;
                yield { type: 'content_done', data: { finishReason: delta.stop_reason }, timestamp: Date.now() };
              }
              if (event.usage) {
                const inputT = event.usage.input_tokens ?? 0;
                const outputT = event.usage.output_tokens ?? 0;
                yield { type: 'usage_update', data: { promptTokens: inputT, completionTokens: outputT, totalTokens: inputT + outputT }, timestamp: Date.now() };
              }
              break;
            }
            case 'message_stop':
              if (!contentDoneYielded) {
                yield { type: 'content_done', data: { finishReason: 'end_turn' }, timestamp: Date.now() };
              }
              yield { type: 'done', data: null, timestamp: Date.now() };
              return;
          }
        }

        // Flush any remaining complete lines from buffer after stream ends
        if (buffer.trim()) {
          const trimmed = buffer.trim();
          if (trimmed.startsWith('data:')) {
            const raw = trimmed.slice(5).trim();
            if (raw && raw !== '[DONE]') {
              try {
                const event = JSON.parse(raw) as AnthropicSSEEvent;
                if (event.type === 'message_delta' && event.delta?.stop_reason && !contentDoneYielded) {
                  contentDoneYielded = true;
                  yield { type: 'content_done', data: { finishReason: event.delta.stop_reason }, timestamp: Date.now() };
                }
              } catch { /* ignore incomplete buffer */ }
            }
          }
          buffer = '';
        }
      }
    } finally {
      // Connection dropped or generator returned early — guarantee done is always yielded
      if (!contentDoneYielded) {
        yield { type: 'content_done', data: { finishReason: 'end_turn' }, timestamp: Date.now() };
      }
      yield { type: 'done', data: null, timestamp: Date.now() };
    }
  }

  async listModels(): Promise<AIModelConfig[]> {
    // Anthropic doesn't have a public list-models endpoint; return known models
    const knownModels: Array<{ id: string; context: number; output: number; inputCost: number; outputCost: number }> = [
      { id: 'claude-opus-4-5', context: 200000, output: 32000, inputCost: 0.015, outputCost: 0.075 },
      { id: 'claude-sonnet-4-5', context: 200000, output: 16000, inputCost: 0.003, outputCost: 0.015 },
      { id: 'claude-haiku-3-5', context: 200000, output: 8192, inputCost: 0.00025, outputCost: 0.00125 },
      { id: 'claude-3-opus-20240229', context: 200000, output: 4096, inputCost: 0.015, outputCost: 0.075 },
      { id: 'claude-3-5-sonnet-20241022', context: 200000, output: 8192, inputCost: 0.003, outputCost: 0.015 },
      { id: 'claude-3-haiku-20240307', context: 200000, output: 4096, inputCost: 0.00025, outputCost: 0.00125 },
    ];
    return knownModels.map(m => ({
      id: m.id,
      name: m.id,
      providerId: this.config.id,
      contextWindow: m.context,
      maxOutputTokens: m.output,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
      inputCostPer1k: m.inputCost,
      outputCostPer1k: m.outputCost,
      defaultTemperature: 0.7,
      defaultTopP: 1.0,
    }));
  }

  async testConnection(): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const result = await this.chat({
        model: this.config.models?.[0]?.id ?? 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'Hi', tool_call_id: undefined }],
        maxTokens: 5,
      });
      return { success: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { success: false, latencyMs: Date.now() - start, error: (err as Error).message };
    }
  }

  private findModel(modelId: string): AIModelConfig | undefined {
    return this.config.models?.find(m => m.id === modelId);
  }
}