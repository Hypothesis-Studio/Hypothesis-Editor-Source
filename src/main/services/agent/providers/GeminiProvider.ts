/**
 * Google Gemini Provider Adapter
 * Full Gemini API with SSE streaming, function calling, and retry logic.
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

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com';

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  inlineData?: { mimeType: string; data: string };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiTool {
  functionDeclarations: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
}

interface GeminiRequest {
  contents: GeminiContent[];
  systemInstruction?: { parts: Array<{ text: string }> };
  tools?: GeminiTool[];
  generationConfig?: {
    temperature?: number;
    topP?: number;
    maxOutputTokens?: number;
    stopSequences?: string[];
  };
}

interface GeminiCandidate {
  content: GeminiContent;
  finishReason: string;
  index: number;
}

interface GeminiResponse {
  candidates: GeminiCandidate[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  modelVersion?: string;
}

interface GeminiStreamChunk {
  candidates?: GeminiCandidate[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export class GeminiProvider extends ProviderAdapter {
  get name(): string { return this.config.name; }
  get type(): string { return 'gemini'; }

  private getApiKey(): string {
    return this.config.apiKey;
  }

  private buildUrl(model: string, stream: boolean): string {
    const base = this.config.baseUrl || GEMINI_API_BASE;
    const action = stream ? 'streamGenerateContent' : 'generateContent';
    const streamParam = stream ? '?alt=sse' : '';
    return `${base}/v1beta/models/${model}:${action}${streamParam}&key=${this.getApiKey()}`;
  }

  private buildContents(request: ChatCompletionRequest): { system?: string; contents: GeminiContent[] } {
    let system: string | undefined;
    const contents: GeminiContent[] = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        system = (system ? system + '\n' : '') + (msg.content ?? '');
        continue;
      }

      if (msg.role === 'tool') {
        // Function responses
        const last = contents[contents.length - 1];
        const part: GeminiPart = {
          functionResponse: {
            name: (msg as any).name ?? 'unknown',
            response: { content: msg.content ?? '' },
          },
        };
        if (last?.role === 'user') {
          last.parts.push(part);
        } else {
          contents.push({ role: 'user', parts: [part] });
        }
        continue;
      }

      if (msg.role === 'assistant') {
        const toolCalls = (msg as any).tool_calls as Array<{ id: string; function: { name: string; arguments: string } }> | undefined;
        const parts: GeminiPart[] = [];
        if (msg.content) parts.push({ text: msg.content });
        if (toolCalls) {
          for (const tc of toolCalls) {
            let args: Record<string, unknown> = {};
            try { args = JSON.parse(tc.function.arguments); } catch { /* ignore */ }
            parts.push({ functionCall: { name: tc.function.name, args } });
          }
        }
        contents.push({ role: 'model', parts: parts.length > 0 ? parts : [{ text: '' }] });
        continue;
      }

      // user
      contents.push({ role: 'user', parts: [{ text: msg.content ?? '' }] });
    }

    // Gemini requires alternating user/model; merge consecutive same-role
    const merged: GeminiContent[] = [];
    for (const c of contents) {
      const prev = merged[merged.length - 1];
      if (prev && prev.role === c.role) {
        prev.parts.push(...c.parts);
      } else {
        merged.push(c);
      }
    }

    return { system, contents: merged };
  }

  private buildTools(request: ChatCompletionRequest): GeminiTool[] | undefined {
    if (!request.tools || request.tools.length === 0) return undefined;
    return [{
      functionDeclarations: request.tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters as Record<string, unknown>,
      })),
    }];
  }

  private async doRequest(url: string, body: string, headers: Record<string, string>): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request({
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(body).toString() },
        timeout: this.config.timeout ?? 120000,
      }, (res: IncomingMessage) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') }));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new AgentError('Request timed out', 'TIMEOUT', 'provider', this.config.id, true)); });
      req.write(body);
      req.end();
    });
  }

  private async doStreamRequest(url: string, body: string, headers: Record<string, string>): Promise<IncomingMessage> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request({
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(body).toString() },
        timeout: this.config.timeout ?? 120000,
      }, resolve);
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new AgentError('Stream timed out', 'TIMEOUT', 'provider', this.config.id, true)); });
      req.write(body);
      req.end();
    });
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const modelConfig = this.findModel(request.model);
    const { system, contents } = this.buildContents(request);
    const geminiBody: GeminiRequest = {
      contents,
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      ...(request.tools ? { tools: this.buildTools(request) } : {}),
      generationConfig: {
        temperature: request.temperature ?? modelConfig?.defaultTemperature ?? 0.7,
        topP: request.topP ?? modelConfig?.defaultTopP ?? 1.0,
        maxOutputTokens: request.maxTokens ?? modelConfig?.maxOutputTokens ?? 4096,
        ...(request.stop ? { stopSequences: request.stop } : {}),
      },
    };

    const url = this.buildUrl(request.model, false);
    const bodyStr = JSON.stringify(geminiBody);
    const headers = { 'Content-Type': 'application/json' };

    const { statusCode, body: responseBody } = await this.doRequest(url, bodyStr, headers);

    if (statusCode >= 400) {
      let msg = `HTTP ${statusCode}`;
      try { const e = JSON.parse(responseBody); msg = e?.error?.message ?? msg; } catch { /* ignore */ }
      throw new AgentError(msg, 'API_ERROR', 'provider', this.config.id, statusCode >= 500, statusCode);
    }

    const data = JSON.parse(responseBody) as GeminiResponse;
    const candidate = data.candidates?.[0];
    if (!candidate) throw new AgentError('No candidates in response', 'API_ERROR', 'provider', this.config.id);

    const textParts = candidate.content.parts.filter(p => p.text !== undefined);
    const fnParts = candidate.content.parts.filter(p => p.functionCall);

    const usage: TokenUsage = {
      promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: data.usageMetadata?.totalTokenCount ?? 0,
      estimatedCost: modelConfig
        ? this.calculateCost(
            { promptTokens: data.usageMetadata?.promptTokenCount ?? 0, completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0, totalTokens: data.usageMetadata?.totalTokenCount ?? 0, estimatedCost: 0 },
            modelConfig,
          )
        : 0,
    };

    return {
      id: `gemini-${Date.now()}`,
      content: textParts.map(p => p.text ?? '').join(''),
      finishReason: candidate.finishReason,
      toolCalls: fnParts.length > 0
        ? fnParts.map((p, i) => ({
            id: `fn-${i}-${Date.now()}`,
            name: p.functionCall!.name,
            arguments: p.functionCall!.args,
          }))
        : undefined,
      usage,
      model: request.model,
    };
  }

  async *chatStream(request: ChatCompletionRequest): AsyncGenerator<StreamEvent> {
    const modelConfig = this.findModel(request.model);
    const { system, contents } = this.buildContents(request);
    const geminiBody: GeminiRequest = {
      contents,
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      ...(request.tools ? { tools: this.buildTools(request) } : {}),
      generationConfig: {
        temperature: request.temperature ?? modelConfig?.defaultTemperature ?? 0.7,
        topP: request.topP ?? modelConfig?.defaultTopP ?? 1.0,
        maxOutputTokens: request.maxTokens ?? modelConfig?.maxOutputTokens ?? 4096,
        ...(request.stop ? { stopSequences: request.stop } : {}),
      },
    };

    const url = this.buildUrl(request.model, true);
    const bodyStr = JSON.stringify(geminiBody);
    const headers = { 'Content-Type': 'application/json' };

    const res = await this.doStreamRequest(url, bodyStr, headers);

    if ((res.statusCode ?? 0) >= 400) {
      const errBody = await new Promise<string>(resolve => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString()));
      });
      let msg = `HTTP ${res.statusCode}`;
      try { const e = JSON.parse(errBody); msg = e?.error?.message ?? msg; } catch { /* ignore */ }
      throw new AgentError(msg, 'STREAM_ERROR', 'provider', this.config.id, (res.statusCode ?? 0) >= 500, res.statusCode);
    }

    yield { type: 'message_start', data: { model: request.model }, timestamp: Date.now() };

    let buffer = '';
    // Use a monotonic counter to guarantee unique IDs even when multiple fn calls
    // arrive in the same millisecond (Date.now() alone would collide).
    let fnCallSeq = 0;
    let contentDoneYielded = false;

    try {
      for await (const chunk of res) {
        buffer += (chunk as Buffer).toString('utf-8');
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const raw = trimmed.slice(5).trim();
          if (!raw || raw === '[DONE]') continue;

          let parsed: GeminiStreamChunk;
          try { parsed = JSON.parse(raw); } catch { continue; }

          const candidate = parsed.candidates?.[0];
          if (!candidate) continue;

          for (const part of candidate.content.parts) {
            if (part.text) {
              yield { type: 'content_delta', data: { content: part.text }, timestamp: Date.now() };
            }
            if (part.functionCall) {
              // Use seq + random suffix — collision-proof regardless of timing
              const callId = `fn-${++fnCallSeq}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
              yield { type: 'tool_call_start', data: { toolCallId: callId, name: part.functionCall.name }, timestamp: Date.now() };
              yield { type: 'tool_call_done', data: { toolCallId: callId, name: part.functionCall.name, arguments: part.functionCall.args }, timestamp: Date.now() };
            }
          }

          if (candidate.finishReason && candidate.finishReason !== 'NULL') {
            if (parsed.usageMetadata) {
              yield {
                type: 'usage_update',
                data: {
                  promptTokens: parsed.usageMetadata.promptTokenCount,
                  completionTokens: parsed.usageMetadata.candidatesTokenCount,
                  totalTokens: parsed.usageMetadata.totalTokenCount,
                },
                timestamp: Date.now(),
              };
            }
            contentDoneYielded = true;
            yield { type: 'content_done', data: { finishReason: candidate.finishReason }, timestamp: Date.now() };
            yield { type: 'done', data: null, timestamp: Date.now() };
            return;
          }
        }
      }
    } finally {
      // Connection dropped or generator returned without a finishReason chunk —
      // always guarantee content_done + done are yielded so the UI unblocks.
      if (!contentDoneYielded) {
        yield { type: 'content_done', data: { finishReason: 'STOP' }, timestamp: Date.now() };
      }
      yield { type: 'done', data: null, timestamp: Date.now() };
    }
  }

  async listModels(): Promise<AIModelConfig[]> {
    const knownModels = [
      { id: 'gemini-2.5-pro', context: 1048576, output: 65536, inputCost: 0.00125, outputCost: 0.005 },
      { id: 'gemini-2.5-flash', context: 1048576, output: 65536, inputCost: 0.000075, outputCost: 0.0003 },
      { id: 'gemini-2.5-flash-lite', context: 1048576, output: 65536, inputCost: 0.0000375, outputCost: 0.00015 },
      { id: 'gemini-1.5-pro', context: 2097152, output: 8192, inputCost: 0.00125, outputCost: 0.005 },
      { id: 'gemini-1.5-flash', context: 1048576, output: 8192, inputCost: 0.000075, outputCost: 0.0003 },
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
      await this.chat({
        model: this.config.models?.[0]?.id ?? 'gemini-1.5-flash',
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