/**
 * Agent Store - Zustand store for the AI agent system.
 * Optimized for smooth streaming with batched updates.
 */
import { create } from 'zustand';
import type {
  AgentConfig,
  ChatSession,
  ChatMessage,
  AIProviderConfig,
  AIProviderStatus,
  AIModelConfig,
  ToolDefinition,
  AgentTask,
  AgentLogEntry,
  MemoryEntry,
  StreamEvent,
} from '../../shared/types/agent';

interface IPCResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

interface AgentState {
  agentConfigs: AgentConfig[];
  activeAgentId: string | null;
  sessions: ChatSession[];
  activeSessionId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  providers: AIProviderConfig[];
  providerStatuses: AIProviderStatus[];
  models: AIModelConfig[];
  tools: ToolDefinition[];
  tasks: AgentTask[];
  logs: AgentLogEntry[];
  memoryEntries: MemoryEntry[];
  healthStatus: {
    agents: number;
    providers: { total: number; connected: number };
    activeStreams: number;
    memoryEntries: number;
    activeTasks: number;
  } | null;

  // Actions
  loadAgentConfigs: () => Promise<void>;
  setActiveAgent: (id: string | null) => void;
  createAgentConfig: (config: Partial<AgentConfig>) => Promise<AgentConfig | null>;
  updateAgentConfig: (id: string, updates: Partial<AgentConfig>) => Promise<void>;
  deleteAgentConfig: (id: string) => Promise<void>;
  loadSessions: (agentId?: string) => Promise<void>;
  createSession: (agentId: string, title?: string) => Promise<ChatSession | null>;
  setActiveSession: (id: string | null) => void;
  deleteSession: (id: string) => Promise<void>;
  loadMessages: (sessionId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  sendWithContext: (selectedCode: string, userMessage: string) => Promise<void>;
  cancelStream: () => void;
  clearMessages: (sessionId: string) => void;
  loadProviders: () => Promise<void>;
  addProvider: (config: AIProviderConfig) => Promise<void>;
  updateProvider: (id: string, updates: Partial<AIProviderConfig>) => Promise<void>;
  removeProvider: (id: string) => Promise<void>;
  testProvider: (id: string) => Promise<{ success: boolean; latencyMs: number; error?: string } | null>;
  fetchModels: (providerId: string) => Promise<void>;
  loadTools: () => Promise<void>;
  enableTool: (id: string) => Promise<void>;
  disableTool: (id: string) => Promise<void>;
  loadTasks: () => Promise<void>;
  cancelTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  loadLogs: (filters?: Record<string, unknown>) => Promise<void>;
  clearLogs: () => Promise<void>;
  loadMemory: () => Promise<void>;
  searchMemory: (query: string) => Promise<void>;
  clearMemory: (sessionId?: string) => Promise<void>;
  loadHealthStatus: () => Promise<void>;
  handleStreamEvent: (event: StreamEvent) => void;
}

// Streaming content buffer - accumulates deltas and flushes to store on RAF
let _streamBuffer = '';
let _rafId: number | null = null;
let _storeRef: (() => AgentState) | null = null;
let _setRef: ((partial: Partial<AgentState> | ((s: AgentState) => Partial<AgentState>)) => void) | null = null;
let _pendingToolName: string | null = null;

function flushStreamBuffer() {
  if (_rafId) {
    cancelAnimationFrame(_rafId);
    _rafId = null;
  }
  if (_setRef && _streamBuffer) {
    _setRef((s: AgentState) => ({ streamingContent: s.streamingContent + _streamBuffer }));
    _streamBuffer = '';
  }
}

function appendToBuffer(content: string) {
  _streamBuffer += content;
  if (!_rafId) {
    _rafId = requestAnimationFrame(() => {
      _rafId = null;
      flushStreamBuffer();
    });
  }
}

export const useAgentStore = create<AgentState>((set, get) => {
  _storeRef = get;
  _setRef = set as any;

  return {
    agentConfigs: [],
    activeAgentId: null,
    sessions: [],
    activeSessionId: null,
    messages: [],
    isStreaming: false,
    streamingContent: '',
    providers: [],
    providerStatuses: [],
    models: [],
    tools: [],
    tasks: [],
    logs: [],
    memoryEntries: [],
    healthStatus: null,

    loadAgentConfigs: async () => {
      const result = (await window.api.agent.config.list()) as IPCResult<AgentConfig[]>;
      if (result.success && result.data) set({ agentConfigs: result.data });
    },

    setActiveAgent: (id) => set({ activeAgentId: id }),

    createAgentConfig: async (config) => {
      const result = (await window.api.agent.config.create(config)) as IPCResult<AgentConfig>;
      if (result.success && result.data) {
        set((s) => ({ agentConfigs: [...s.agentConfigs, result.data!] }));
        return result.data;
      }
      return null;
    },

    updateAgentConfig: async (id, updates) => {
      const result = (await window.api.agent.config.update(id, updates)) as IPCResult<AgentConfig>;
      if (result.success && result.data) {
        set((s) => ({ agentConfigs: s.agentConfigs.map((c) => (c.id === id ? result.data! : c)) }));
      }
    },

    deleteAgentConfig: async (id) => {
      const result = (await window.api.agent.config.delete(id)) as IPCResult;
      if (result.success) {
        set((s) => ({ agentConfigs: s.agentConfigs.filter((c) => c.id !== id) }));
      }
    },

    loadSessions: async (agentId) => {
      const result = (await window.api.agent.session.list(agentId)) as IPCResult<ChatSession[]>;
      if (result.success && result.data) set({ sessions: result.data });
    },

    createSession: async (agentId, title) => {
      const result = (await window.api.agent.session.create(agentId, title)) as IPCResult<ChatSession>;
      if (result.success && result.data) {
        set((s) => ({ sessions: [result.data!, ...s.sessions], activeSessionId: result.data!.id, messages: [] }));
        return result.data;
      }
      return null;
    },

    setActiveSession: (id) => {
      set({ activeSessionId: id, messages: [], streamingContent: '' });
      if (id) get().loadMessages(id);
    },

    deleteSession: async (id) => {
      const result = (await window.api.agent.session.delete(id)) as IPCResult;
      if (result.success) {
        set((s) => ({
          sessions: s.sessions.filter((ses) => ses.id !== id),
          activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
        }));
      }
    },

    loadMessages: async (sessionId) => {
      const result = (await window.api.agent.chat.history(sessionId)) as IPCResult<ChatMessage[]>;
      if (result.success && result.data) set({ messages: result.data });
    },

    sendMessage: async (content) => {
      const { activeSessionId, activeAgentId, isStreaming } = get();
      if (isStreaming) return;

      const rootPath = (window as any).__hypothesis_rootPath || null;
      const workspacePath = rootPath || undefined;

      let sessionId = activeSessionId;
      if (!sessionId) {
        const session = await get().createSession(activeAgentId || '');
        if (!session) return;
        sessionId = session.id;
      }

      const userMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content,
        status: 'completed',
        timestamp: Date.now(),
      };
      set((s) => ({ messages: [...s.messages, userMsg], isStreaming: true, streamingContent: '' }));
      _streamBuffer = '';

      await window.api.agent.chat.stream(sessionId, content, activeAgentId || undefined, workspacePath);
    },

    sendWithContext: async (selectedCode: string, userMessage: string) => {
      const { activeSessionId, activeAgentId, isStreaming } = get();
      if (isStreaming) return;

      const rootPath = (window as any).__hypothesis_rootPath || null;
      const workspacePath = rootPath || undefined;

      let sessionId = activeSessionId;
      if (!sessionId) {
        const session = await get().createSession(activeAgentId || '');
        if (!session) return;
        sessionId = session.id;
      }

      const fullMessage = userMessage
        ? `\`\`\`\n${selectedCode}\n\`\`\`\n${userMessage}`
        : `\`\`\`\n${selectedCode}\n\`\`\``;

      const userMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: fullMessage,
        status: 'completed',
        timestamp: Date.now(),
      };
      set((s) => ({ messages: [...s.messages, userMsg], isStreaming: true, streamingContent: '' }));
      _streamBuffer = '';

      await window.api.agent.chat.stream(sessionId, fullMessage, activeAgentId || undefined, workspacePath);
    },

    cancelStream: () => {
      const { activeSessionId } = get();
      if (activeSessionId) {
        window.api.agent.chat.cancel(activeSessionId);
        flushStreamBuffer();
        set({ isStreaming: false });
      }
    },

    clearMessages: (sessionId) => {
      set({ messages: [], streamingContent: '' });
      window.api.agent.session.delete(sessionId);
    },

    handleStreamEvent: (event: StreamEvent) => {
      switch (event.type) {
        case 'content_delta': {
          const delta = event.data as { content: string };
          appendToBuffer(delta.content);
          break;
        }
        case 'content_done': {
          flushStreamBuffer();
          const { streamingContent, messages } = get();
          if (streamingContent) {
            const assistantMsg: ChatMessage = {
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content: streamingContent,
              status: 'completed',
              timestamp: Date.now(),
            };
            set({ messages: [...messages, assistantMsg], isStreaming: false, streamingContent: '' });
          } else {
            set({ isStreaming: false, streamingContent: '' });
          }
          break;
        }
        case 'tool_call_start': {
          const tc = event.data as { toolCallId: string; name: string };
          flushStreamBuffer();
          _pendingToolName = tc.name;
          break;
        }
        case 'tool_result': {
          const result = event.data as { toolCallId: string; status: string; output?: string; error?: string; name?: string; args?: Record<string, unknown> };
          flushStreamBuffer();
          const toolName = _pendingToolName || result.name || 'tool';
          _pendingToolName = null;
          // Extract file path from args for display
          const filePath = (result.args?.path ?? result.args?.filePath ?? result.args?.file_path ?? result.args?.filename ?? result.args?.file ?? result.args?.repoPath ?? result.args?.command) as string | undefined;
          const toolLabel = filePath ? `${toolName} ${filePath}` : toolName;
          if (result.status === 'error' && result.error) {
            set((s) => ({
              streamingContent: s.streamingContent + `\n**${toolLabel}** — Error: ${result.error}\n`,
            }));
          } else if (result.output) {
            const isCode = result.output.includes('\n') && (result.output.includes('{') || result.output.includes('<') || result.output.includes('function') || result.output.includes('import ') || result.output.includes('const ') || result.output.includes('def ') || result.output.includes('class '));
            if (isCode && result.output.length > 100) {
              set((s) => ({
                streamingContent: s.streamingContent + `\n**${toolLabel}**\n\n\`\`\`\n${result.output}\n\`\`\`\n`,
              }));
            } else {
              set((s) => ({
                streamingContent: s.streamingContent + `\n**${toolLabel}**\n${result.output}\n`,
              }));
            }
          }
          break;
        }
        case 'error': {
          flushStreamBuffer();
          const err = event.data as { message: string };
          const { streamingContent, messages } = get();
          // If there's streaming content, save it first
          const allMsgs = [...messages];
          if (streamingContent) {
            allMsgs.push({
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content: streamingContent,
              status: 'completed',
              timestamp: Date.now(),
            });
          }
          allMsgs.push({
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: '',
            status: 'error',
            error: err.message,
            timestamp: Date.now(),
          });
          set({ messages: allMsgs, isStreaming: false, streamingContent: '' });
          break;
        }
        case 'done': {
          flushStreamBuffer();
          const { streamingContent, messages } = get();
          if (streamingContent) {
            const assistantMsg: ChatMessage = {
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content: streamingContent,
              status: 'completed',
              timestamp: Date.now(),
            };
            set({ messages: [...messages, assistantMsg], isStreaming: false, streamingContent: '' });
          } else {
            set({ isStreaming: false });
          }
          break;
        }
        case 'usage_update': break;
        case 'task_update': break;
        case 'task_step_update': break;
        case 'task_log': break;
      }
    },

    loadProviders: async () => {
      const result = (await window.api.agent.provider.list()) as IPCResult<AIProviderConfig[]>;
      if (result.success && result.data) set({ providers: result.data });
    },

    addProvider: async (config) => {
      const result = (await window.api.agent.provider.add(config)) as IPCResult<AIProviderConfig>;
      if (result.success && result.data) {
        set((s) => ({ providers: [...s.providers, result.data!] }));
      }
    },

    updateProvider: async (id, updates) => {
      const result = (await window.api.agent.provider.update(id, updates)) as IPCResult<AIProviderConfig>;
      if (result.success && result.data) {
        set((s) => ({ providers: s.providers.map((p) => (p.id === id ? result.data! : p)) }));
      }
    },

    removeProvider: async (id) => {
      const result = (await window.api.agent.provider.remove(id)) as IPCResult;
      if (result.success) {
        set((s) => ({ providers: s.providers.filter((p) => p.id !== id) }));
      }
    },

    testProvider: async (id) => {
      const result = (await window.api.agent.provider.test(id)) as IPCResult<{ success: boolean; latencyMs: number; error?: string }>;
      return result.success && result.data ? result.data : null;
    },

    fetchModels: async (providerId) => {
      const result = (await window.api.agent.provider.models(providerId)) as IPCResult<AIModelConfig[]>;
      if (result.success && result.data) {
        set({ models: result.data });
        const provResult = (await window.api.agent.provider.list()) as IPCResult<AIProviderConfig[]>;
        if (provResult.success && provResult.data) set({ providers: provResult.data });
      }
    },

    loadTools: async () => {
      const result = (await window.api.agent.tool.list()) as IPCResult<ToolDefinition[]>;
      if (result.success && result.data) set({ tools: result.data });
    },

    enableTool: async (id) => {
      await window.api.agent.tool.enable(id);
      set((s) => ({ tools: s.tools.map((t) => (t.id === id ? { ...t, enabled: true } : t)) }));
    },

    disableTool: async (id) => {
      await window.api.agent.tool.disable(id);
      set((s) => ({ tools: s.tools.map((t) => (t.id === id ? { ...t, enabled: false } : t)) }));
    },

    loadTasks: async () => {
      const result = (await window.api.agent.task.list()) as IPCResult<AgentTask[]>;
      if (result.success && result.data) set({ tasks: result.data });
    },

    cancelTask: async (id) => {
      await window.api.agent.task.cancel(id);
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: 'cancelled' as const } : t)) }));
    },

    deleteTask: async (id) => {
      await window.api.agent.task.delete(id);
      set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    },

    loadLogs: async (filters?) => {
      const result = (await window.api.agent.log.list(filters)) as IPCResult<AgentLogEntry[]>;
      if (result.success && result.data) set({ logs: result.data });
    },

    clearLogs: async () => {
      await window.api.agent.log.clear();
      set({ logs: [] });
    },

    loadMemory: async () => {
      const result = (await window.api.agent.memory.list()) as IPCResult<MemoryEntry[]>;
      if (result.success && result.data) set({ memoryEntries: result.data });
    },

    searchMemory: async (query) => {
      const result = (await window.api.agent.memory.search({ query })) as IPCResult<Array<{ entry: MemoryEntry }>>;
      if (result.success && result.data) set({ memoryEntries: result.data.map((r) => r.entry) });
    },

    clearMemory: async (sessionId?) => {
      await window.api.agent.memory.clear(sessionId);
      // Also clear tasks and reload
      set((s) => {
        if (sessionId) {
          return { memoryEntries: s.memoryEntries.filter((e) => e.sessionId !== sessionId) };
        }
        return { memoryEntries: [], tasks: [] };
      });
    },

    loadHealthStatus: async () => {
      const result = (await window.api.agent.status()) as IPCResult<AgentState['healthStatus']>;
      if (result.success && result.data) set({ healthStatus: result.data });
    },
  };
});
