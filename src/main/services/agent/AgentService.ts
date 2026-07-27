/**
 * Agent Service - Core orchestrator for the AI agent.
 * Multi-turn tool execution loop: AI decides what tools to call based on results.
 * Like OpenClaw: Think → Act → Observe → Repeat until done.
 */
import type {
  AgentConfig,
  ChatMessage,
  ChatSession,
  ToolExecutionContext,
  StreamEvent,
  TokenUsage,
} from '../../../shared/types/agent';
import { AgentError, DEFAULT_AGENT_CONFIG } from '../../../shared/types/agent';
import type { ChatCompletionRequest } from './ProviderAdapter';
import { ProviderRegistry } from './ProviderRegistry';
import { ToolRegistry } from './ToolRegistry';
import { MemoryService } from './MemoryService';
import { TaskService } from './TaskService';
import { SessionPersistence } from './SessionPersistence';
import { AgentLogService } from './AgentLogService';
import { RateLimiter } from './RateLimiter';
import { logger } from '../../utils/logger';
import type { AppStore } from '../AppStore';
import { nanoid } from '../../utils/nanoid';

const log = logger.scope('AgentService');

/** Maximum tool-calling turns before forcing a final text response */
const MAX_TOOL_TURNS = 15;

export class AgentService {
  readonly providers: ProviderRegistry;
  readonly tools: ToolRegistry;
  readonly memory: MemoryService;
  readonly tasks: TaskService;
  readonly sessions: SessionPersistence;
  readonly agentLogs: AgentLogService;
  readonly rateLimiter: RateLimiter;

  private appStore: AppStore;
  private configs: Map<string, AgentConfig> = new Map();
  private activeAbortControllers = new Map<string, AbortController>();

  constructor(
    appStore: AppStore,
    providers: ProviderRegistry,
    tools: ToolRegistry,
    memory: MemoryService,
    tasks: TaskService,
    sessions: SessionPersistence,
    agentLogs: AgentLogService,
    rateLimiter: RateLimiter,
  ) {
    this.appStore = appStore;
    this.providers = providers;
    this.tools = tools;
    this.memory = memory;
    this.tasks = tasks;
    this.sessions = sessions;
    this.agentLogs = agentLogs;
    this.rateLimiter = rateLimiter;
  }

  async initialize(): Promise<void> {
    const stored = this.appStore.get('agent.configs') as AgentConfig[] | undefined;
    if (stored) {
      for (const config of stored) {
        // Auto-migrate: merge new defaults into existing configs
        const migrated: AgentConfig = {
          ...DEFAULT_AGENT_CONFIG,
          ...config,
          // Always use latest system prompt, permissions, and tools unless user customized
          systemPrompt: config.systemPrompt === DEFAULT_AGENT_CONFIG.systemPrompt
            ? DEFAULT_AGENT_CONFIG.systemPrompt
            : config.systemPrompt,
          permissions: [...new Set([...config.permissions, ...DEFAULT_AGENT_CONFIG.permissions])],
          enabledTools: [...new Set([...config.enabledTools, ...DEFAULT_AGENT_CONFIG.enabledTools])],
        };
        this.configs.set(config.id, migrated);
      }
      this.saveConfigs();
    }
    if (this.configs.size === 0) {
      const defaultConfig: AgentConfig = {
        ...DEFAULT_AGENT_CONFIG,
        id: nanoid(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.configs.set(defaultConfig.id, defaultConfig);
      this.saveConfigs();
    }
    this.agentLogs.info('agent', `Agent service initialized with ${this.configs.size} agent(s)`);
  }

  private saveConfigs(): void {
    this.appStore.set('agent.configs', Array.from(this.configs.values()));
  }

  // ── Config Management ──────────────────────────────────────────

  listAgentConfigs(): AgentConfig[] { return Array.from(this.configs.values()); }
  getAgentConfig(id: string): AgentConfig | undefined { return this.configs.get(id); }

  createAgentConfig(config: Partial<AgentConfig>): AgentConfig {
    const fullConfig: AgentConfig = {
      ...DEFAULT_AGENT_CONFIG, ...config,
      id: config.id ?? nanoid(), createdAt: Date.now(), updatedAt: Date.now(),
    };
    this.configs.set(fullConfig.id, fullConfig);
    this.saveConfigs();
    this.agentLogs.info('config', `Created agent: ${fullConfig.name}`);
    return fullConfig;
  }

  updateAgentConfig(id: string, updates: Partial<AgentConfig>): AgentConfig {
    const existing = this.configs.get(id);
    if (!existing) throw new AgentError(`Agent ${id} not found`, 'NOT_FOUND', 'config');
    const updated = { ...existing, ...updates, id, updatedAt: Date.now() };
    this.configs.set(id, updated);
    this.saveConfigs();
    return updated;
  }

  deleteAgentConfig(id: string): void {
    this.configs.delete(id);
    this.saveConfigs();
    this.agentLogs.info('config', `Deleted agent: ${id}`);
  }

  // ── Chat (Non-streaming) ───────────────────────────────────────

  async sendMessage(
    sessionId: string, content: string, agentId?: string, workspacePath?: string,
  ): Promise<ChatMessage> {
    const agent = this.getAgentForSession(agentId);
    const session = this.sessions.getSession(sessionId) ?? this.sessions.createSession(agent.id);
    if (workspacePath) session.metadata = { ...session.metadata, workspacePath };

    const userMessage: ChatMessage = {
      id: nanoid(), role: 'user', content, status: 'completed', timestamp: Date.now(),
    };
    this.sessions.addMessage(session.id, userMessage);
    this.agentLogs.info('agent', `User message in session ${session.id}`, { content: content.substring(0, 200) });

    const memoryContext = agent.memoryEnabled
      ? this.memory.getRelevantContext(content, agent.memoryMaxTokens) : '';

    // Multi-turn loop: AI → tool calls → results → AI → ... until no more tool calls
    const conversationMessages = this.buildMessages(agent, session, memoryContext);
    let totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 };
    let finalContent = '';
    let turn = 0;
    const recentToolCalls: Array<{ name: string; args: string }> = [];

    while (turn < MAX_TOOL_TURNS) {
      turn++;
      await this.rateLimiter.waitForToken(agent.providerId);

      const toolDefs = this.tools.toOpenAITools(agent.enabledTools);
      const request: ChatCompletionRequest = {
        model: agent.modelId, messages: conversationMessages,
        temperature: agent.temperature, maxTokens: agent.maxTokens, topP: agent.topP,
        stream: false,
        tools: toolDefs.length > 0 ? toolDefs : undefined,
      };

      const response = await this.providers.chat(agent.providerId, request);

      // Accumulate usage
      totalUsage = {
        promptTokens: totalUsage.promptTokens + response.usage.promptTokens,
        completionTokens: totalUsage.completionTokens + response.usage.completionTokens,
        totalTokens: totalUsage.totalTokens + response.usage.totalTokens,
        estimatedCost: totalUsage.estimatedCost + response.usage.estimatedCost,
      };

      // If no tool calls, we're done
      if (!response.toolCalls || response.toolCalls.length === 0) {
        finalContent = this.sanitizeResponse(response.content, agent.enabledTools);
        // Add assistant response to conversation
        conversationMessages.push({ role: 'assistant', content: finalContent });
        break;
      }

      // Execute tool calls and build the conversation continuation
      this.agentLogs.info('agent', `Turn ${turn}: ${response.toolCalls.length} tool call(s)`);

      const assistantToolCallMsg = {
        role: 'assistant' as const,
        content: response.content || null,
        tool_calls: response.toolCalls.map(tc => ({
          id: tc.id, type: 'function' as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      };
      conversationMessages.push(assistantToolCallMsg as any);

      // Execute each tool
      const wsPath = (session.metadata?.workspacePath as string) || '';
      const toolContext: ToolExecutionContext = {
        sessionId: session.id, agentId: agent.id,
        permissions: agent.permissions, workspacePath: wsPath || undefined,
      };

      for (const tc of response.toolCalls) {
        const resolvedId = this.tools.resolveToolId(tc.name) ?? tc.name;
        this.agentLogs.info('tool', `Executing: ${resolvedId}`, tc.arguments);

        let toolOutput: string;
        try {
          const result = await this.tools.execute(resolvedId, tc.arguments, toolContext);
          toolOutput = result.success ? result.output : `Error: ${result.error}`;
          this.agentLogs.info('tool', `${resolvedId} → ${result.success ? 'OK' : 'FAIL'}`, { output: result.output?.substring(0, 200) });
        } catch (err) {
          const errMsg = (err as Error).message;
          // Provide professional error messages for disabled tools
          if (errMsg.includes('is disabled') || errMsg.includes('DISABLED')) {
            toolOutput = `Error: Tool "${resolvedId}" is currently disabled. Ask the user to enable it in Settings → AI Agent → Tools.`;
          } else if (errMsg.includes('not found') || errMsg.includes('NOT_FOUND')) {
            toolOutput = `Error: Tool "${resolvedId}" is not available. Available tools: ${this.tools.listTools().filter(t => t.enabled).map(t => t.id).join(', ')}`;
          } else {
            toolOutput = `Error: ${errMsg}`;
          }
          this.agentLogs.error('tool', `${resolvedId} failed`, { error: toolOutput });
        }

        // Add tool result to conversation
        conversationMessages.push({
          role: 'tool', tool_call_id: tc.id, content: toolOutput,
        } as any);
      }
    }

    // Build final assistant message
    const assistantMsg: ChatMessage = {
      id: nanoid(), role: 'assistant', content: finalContent,
      status: 'completed', tokenUsage: totalUsage, timestamp: Date.now(),
    };
    this.sessions.addMessage(session.id, assistantMsg);

    if (agent.memoryEnabled) {
      this.memory.addEntry(session.id, 'conversation', `User: ${content}\nAssistant: ${finalContent.substring(0, 500)}`, 5);
    }

    return assistantMsg;
  }

  // ── Chat (Streaming) ───────────────────────────────────────────

  async *streamMessage(
    sessionId: string, content: string, agentId?: string, workspacePath?: string,
  ): AsyncGenerator<StreamEvent> {
    const agent = this.getAgentForSession(agentId);
    const session = this.sessions.getSession(sessionId) ?? this.sessions.createSession(agent.id);
    if (workspacePath) session.metadata = { ...session.metadata, workspacePath };
    const abortController = new AbortController();
    this.activeAbortControllers.set(session.id, abortController);

    const userMessage: ChatMessage = {
      id: nanoid(), role: 'user', content, status: 'completed', timestamp: Date.now(),
    };
    this.sessions.addMessage(session.id, userMessage);
    this.agentLogs.info('agent', `User message (stream) in session ${session.id}`, { content: content.substring(0, 200) });

    try {
      const memoryContext = agent.memoryEnabled
        ? this.memory.getRelevantContext(content, agent.memoryMaxTokens) : '';

      // Build initial conversation
      const conversationMessages = this.buildMessages(agent, session, memoryContext);
      let turn = 0;
      let totalContent = '';
      // Loop detection: track recent tool calls to prevent infinite loops
      const recentToolCalls: Array<{ name: string; args: string }> = [];

      yield { type: 'message_start', data: { messageId: nanoid() }, timestamp: Date.now() };

      // Multi-turn loop
      while (turn < MAX_TOOL_TURNS) {
        turn++;
        if (abortController.signal.aborted) break;

        await this.rateLimiter.waitForToken(agent.providerId);

        const toolDefs = this.tools.toOpenAITools(agent.enabledTools);
        const request: ChatCompletionRequest = {
          model: agent.modelId, messages: conversationMessages,
          temperature: agent.temperature, maxTokens: agent.maxTokens, topP: agent.topP,
          frequencyPenalty: agent.frequencyPenalty, presencePenalty: agent.presencePenalty,
          stream: true,
          tools: toolDefs.length > 0 ? toolDefs : undefined,
        };

        // Stream this turn
        let turnContent = '';
        const turnToolCalls: Array<{ id: string; name: string; arguments: string }> = [];

        for await (const event of this.providers.chatStream(agent.providerId, request)) {
          if (abortController.signal.aborted) break;

          switch (event.type) {
            case 'content_delta': {
              const delta = event.data as { content: string };
              turnContent += delta.content;
              totalContent += delta.content;
              yield event;
              break;
            }
            case 'tool_call_start': {
              const tc = event.data as { toolCallId: string; name: string };
              turnToolCalls.push({ id: tc.toolCallId, name: tc.name, arguments: '' });
              yield event;
              break;
            }
            case 'tool_call_delta': {
              const delta = event.data as { toolCallId: string; argumentsDelta?: string };
              const existing = turnToolCalls.find(t => t.id === delta.toolCallId);
              if (existing && delta.argumentsDelta) existing.arguments += delta.argumentsDelta;
              yield event;
              break;
            }
            case 'tool_call_done': {
              yield event;
              break;
            }
            case 'usage_update': {
              yield event;
              break;
            }
            case 'content_done': {
              // Don't yield yet — we might have more turns
              break;
            }
            case 'done': break;
            default: yield event;
          }
        }

        // If no tool calls this turn, we're done
        if (turnToolCalls.length === 0) {
          conversationMessages.push({ role: 'assistant', content: turnContent });
          yield { type: 'content_done', data: { finishReason: 'stop' }, timestamp: Date.now() };
          break;
        }

        // Loop detection: check if AI is repeating the same tool calls
        const callSignatures = turnToolCalls.map(tc => `${tc.name}:${tc.arguments}`);
        const recentSignatures = recentToolCalls.map(tc => `${tc.name}:${tc.args}`);
        const isLoop = callSignatures.every(sig => recentSignatures.includes(sig));
        if (isLoop && turn > 2) {
          this.agentLogs.warn('agent', `Loop detected: same tool calls repeated. Breaking.`);
          conversationMessages.push({
            role: 'system', content: 'You have already called these tools with the same arguments and received the same results. Do NOT call them again. Either use the results you already have, or provide a final response to the user.',
          } as any);
          // Force one more turn without tools to get a final response
          const forceRequest: ChatCompletionRequest = {
            model: agent.modelId, messages: conversationMessages,
            temperature: agent.temperature, maxTokens: agent.maxTokens,
            stream: true,
          };
          for await (const event of this.providers.chatStream(agent.providerId, forceRequest)) {
            if (event.type === 'content_delta') {
              totalContent += (event.data as { content: string }).content;
            }
            yield event;
          }
          yield { type: 'content_done', data: { finishReason: 'stop' }, timestamp: Date.now() };
          break;
        }
        // Track this turn's calls
        for (const tc of turnToolCalls) {
          recentToolCalls.push({ name: tc.name, args: tc.arguments });
        }
        // Keep only last 10 calls for detection
        while (recentToolCalls.length > 10) recentToolCalls.shift();

        // We have tool calls — execute them
        this.agentLogs.info('agent', `Stream turn ${turn}: ${turnToolCalls.length} tool call(s)`);

        // Add assistant message with tool_calls to conversation
        conversationMessages.push({
          role: 'assistant', content: turnContent || null,
          tool_calls: turnToolCalls.map(tc => ({
            id: tc.id, type: 'function',
            function: { name: tc.name, arguments: tc.arguments },
          })),
        } as any);

        // Execute each tool
        const wsPath = (session.metadata?.workspacePath as string) || '';
        const toolContext: ToolExecutionContext = {
          sessionId: session.id, agentId: agent.id,
          permissions: agent.permissions, workspacePath: wsPath || undefined,
          abortSignal: abortController.signal,
        };

        for (const tc of turnToolCalls) {
          if (abortController.signal.aborted) break;

          const resolvedId = this.tools.resolveToolId(tc.name) ?? tc.name;
          if (!this.tools.getTool(resolvedId)) {
            const unknownMsg = `Error: Unknown tool '${tc.name}'. Available tools: ${this.tools.listTools().map(t => t.id).join(', ')}`;
            yield {
              type: 'tool_result',
              data: { toolCallId: tc.id, status: 'error', error: unknownMsg, name: tc.name },
              timestamp: Date.now(),
            };
            conversationMessages.push({ role: 'tool', tool_call_id: tc.id, content: unknownMsg } as any);
            continue;
          }

          // Check if tool is disabled
          const toolDef = this.tools.getTool(resolvedId);
          if (toolDef && (!toolDef.definition.enabled || !agent.enabledTools.includes(resolvedId))) {
            const disabledMsg = `Tool "${resolvedId}" is currently disabled. Enable it in Settings → AI Agent → Tools to use this capability.`;
            yield {
              type: 'tool_result',
              data: { toolCallId: tc.id, status: 'error', error: disabledMsg, name: resolvedId },
              timestamp: Date.now(),
            };
            conversationMessages.push({ role: 'tool', tool_call_id: tc.id, content: disabledMsg } as any);
            continue;
          }

          this.agentLogs.info('tool', `Executing: ${resolvedId}`);

          yield { type: 'tool_result', data: { toolCallId: tc.id, status: 'running' }, timestamp: Date.now() };

          let toolOutput: string;
          try {
            const toolTimeout = agent.toolCallTimeout || 30000;
            const result = await Promise.race([
              this.tools.execute(resolvedId, this.parseToolArgs(tc.arguments), toolContext),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Tool ${resolvedId} timed out`)), toolTimeout)
              ),
            ]);
            toolOutput = result.success ? result.output : `Error: ${result.error}`;
            yield {
              type: 'tool_result',
              data: { toolCallId: tc.id, status: result.success ? 'completed' : 'error', output: result.output, error: result.error, name: resolvedId, args: this.parseToolArgs(tc.arguments) },
              timestamp: Date.now(),
            };
            this.agentLogs.info('tool', `${resolvedId} → ${result.success ? 'OK' : 'FAIL'}`);
          } catch (err) {
            toolOutput = `Error: ${(err as Error).message}`;
            yield {
              type: 'tool_result',
              data: { toolCallId: tc.id, status: 'error', error: toolOutput },
              timestamp: Date.now(),
            };
            this.agentLogs.error('tool', `${resolvedId} failed: ${toolOutput}`);
          }

          // Add tool result to conversation
          conversationMessages.push({
            role: 'tool', tool_call_id: tc.id, content: toolOutput,
          } as any);
        }

        if (abortController.signal.aborted) break;

        // Continue loop — next iteration will stream the AI's response to tool results
      }

      // Save final assistant message
      const finalSanitized = this.sanitizeResponse(totalContent, agent.enabledTools);
      const assistantMsg: ChatMessage = {
        id: nanoid(), role: 'assistant', content: finalSanitized,
        status: abortController.signal.aborted ? 'cancelled' : 'completed',
        timestamp: Date.now(),
      };
      this.sessions.addMessage(session.id, assistantMsg);

      if (agent.memoryEnabled && totalContent) {
        this.memory.addEntry(session.id, 'conversation', `User: ${content}\nAssistant: ${totalContent.substring(0, 500)}`, 5);
      }

      yield { type: 'done', data: null, timestamp: Date.now() };

    } catch (err) {
      this.agentLogs.error('agent', `Stream error: ${(err as Error).message}`);
      yield { type: 'error', data: { message: (err as Error).message }, timestamp: Date.now() };
      yield { type: 'done', data: null, timestamp: Date.now() };
    } finally {
      this.activeAbortControllers.delete(session.id);
    }
  }

  cancelStream(sessionId: string): void {
    const controller = this.activeAbortControllers.get(sessionId);
    if (controller) {
      controller.abort();
      this.activeAbortControllers.delete(sessionId);
      this.agentLogs.info('agent', `Cancelled stream for session ${sessionId}`);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────

  private getAgentForSession(agentId?: string): AgentConfig {
    if (agentId) {
      const config = this.configs.get(agentId);
      if (config) return config;
    }
    const first = this.configs.values().next().value;
    if (!first) throw new AgentError('No agent configured', 'NO_AGENT', 'config');
    return first;
  }

  private buildMessages(
    agent: AgentConfig, session: ChatSession, memoryContext: string,
  ): Array<{ role: string; content: string; tool_call_id?: string }> {
    const messages: Array<{ role: string; content: string; tool_call_id?: string }> = [];

    let systemPrompt = agent.systemPrompt;
    if (memoryContext) {
      systemPrompt += `\n\nRelevant context from memory:\n${memoryContext}`;
    }
    const wsPath = (session.metadata?.workspacePath as string) || '';
    if (wsPath) {
      systemPrompt += `\n\nWorkspace: ${wsPath}\nAll file operations and terminal commands should use this workspace directory as the working directory.`;
    }

    // Inform AI about disabled tools so it doesn't output raw JSON
    const allTools = this.tools.listTools();
    const disabledTools = allTools.filter(t => !agent.enabledTools.includes(t.id) || !t.enabled);
    if (disabledTools.length > 0) {
      const disabledNames = disabledTools.map(t => t.id).join(', ');
      systemPrompt += `\n\nIMPORTANT: The following tools are currently DISABLED and cannot be used: ${disabledNames}. Do NOT attempt to call them. If a task requires a disabled tool, explain to the user that the tool is unavailable and suggest they enable it in Settings → AI Agent → Tools. Never output raw tool-call JSON as text — always respond in natural language.`;
    }

    // Add tool usage guidance
    systemPrompt += `\n\nTOOL USAGE RULES:\n- Always use proper tool calls — never output tool invocations as raw JSON text.\n- If you need to call a tool, use the function calling mechanism. If that's not available, describe what you would do in natural language.\n- Never output JSON like {\"tool\": \"readFile\", \"path\": \".\"} as your response. That's not a valid response format.`;
    messages.push({ role: 'system', content: systemPrompt });

    const history = this.sessions.getFormattedHistory(session.id, 50);
    messages.push(...history);

    return messages;
  }

  private parseToolArgs(args: string): Record<string, unknown> {
    try { return JSON.parse(args); } catch { return {}; }
  }

  /**
   * Sanitize AI responses that contain raw tool-call JSON instead of proper text.
   * This catches cases where the model outputs things like {"tool": "readFile", "path": "."}
   * instead of using the function-calling mechanism or responding in natural language.
   */
  private sanitizeResponse(content: string, enabledTools?: string[]): string {
    if (!content) return content;

    // Pattern: entire response is a JSON object with tool-like keys
    const rawToolPatterns = [
      // {"tool": "readFile", "path": "."}
      /^\s*\{\s*"tool"\s*:\s*"[a-zA-Z]+"\s*,\s*"[a-z]+"\s*:\s*.*\}\s*$/s,
      // {"tool": "readFile", "args": {...}}
      /^\s*\{\s*"tool"\s*:\s*"[a-zA-Z]+"\s*,\s*"args"\s*:\s*.*\}\s*$/s,
      // {"function": "readFile", ...}
      /^\s*\{\s*"function"\s*:\s*"[a-zA-Z]+"\s*,.*\}\s*$/s,
      // {"name": "readFile", "arguments": {...}}
      /^\s*\{\s*"name"\s*:\s*"[a-zA-Z]+"\s*,\s*"arguments"\s*:\s*.*\}\s*$/s,
    ];

    for (const pattern of rawToolPatterns) {
      if (pattern.test(content)) {
        try {
          const parsed = JSON.parse(content);
          const toolName = parsed.tool || parsed.function || parsed.name;
          if (toolName && this.tools.getTool(toolName)) {
            const tool = this.tools.getTool(toolName);
            const isEnabled = tool?.definition.enabled && (enabledTools ?? []).includes(toolName);
            if (!isEnabled) {
              return `I'm sorry, but the **${toolName}** tool is currently disabled. You can enable it in **Settings → AI Agent → Tools** and try again.`;
            }
            // If tool is enabled but model output raw JSON — shouldn't happen, but handle gracefully
            return `I attempted to use the **${toolName}** tool, but the request couldn't be processed properly. Please try rephrasing your request.`;
          }
        } catch { /* Not valid JSON, leave as-is */ }
      }
    }

    // Pattern: inline JSON tool calls mixed with text
    // e.g. "Sure! Let me help.\n{\"tool\": \"readFile\", \"path\": \"index.ts\"}"
    const inlinePattern = /\{\s*"tool"\s*:\s*"([a-zA-Z]+)"\s*,\s*"[a-z]+"\s*:\s*[^}]*\}/g;
    let match;
    let sanitized = content;
    const foundTools: string[] = [];
    while ((match = inlinePattern.exec(content)) !== null) {
      foundTools.push(match[1]);
    }
    if (foundTools.length > 0) {
      // Remove the raw JSON blocks
      sanitized = sanitized.replace(inlinePattern, '').trim();
      // Add a note about disabled tools
      const disabledNames = [...new Set(foundTools)].filter(name => {
        const t = this.tools.getTool(name);
        return !t || !t.definition.enabled;
      });
      if (disabledNames.length > 0) {
        sanitized += `\n\n> **Note:** The following tools are currently disabled: ${disabledNames.join(', ')}. Enable them in **Settings → AI Agent → Tools** to use them.`;
      }
    }

    return sanitized;
  }

  getHealthStatus(): {
    agents: number;
    providers: { total: number; connected: number };
    activeStreams: number;
    memoryEntries: number;
    activeTasks: number;
  } {
    const statuses = this.providers.getAllStatuses();
    return {
      agents: this.configs.size,
      providers: { total: statuses.length, connected: statuses.filter(s => s.connected).length },
      activeStreams: this.activeAbortControllers.size,
      memoryEntries: this.memory.listEntries(10000).length,
      activeTasks: this.tasks.listTasks({ status: 'executing' }).length,
    };
  }
}
