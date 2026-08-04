/**
 * Hypothesis Editor - Autonomous AI Agent Type Definitions
 * Complete type system for the AI agent, providers, tools, memory, and tasks.
 */

// ============================================================================
// Provider & Model Types
// ============================================================================

export type AIProviderType = 'openrouter' | 'ninerouter' | 'openai-compatible' | 'custom' | 'anthropic' | 'gemini';

export interface AIProviderConfig {
  id: string;
  name: string;
  type: AIProviderType;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  headers?: Record<string, string>;
  timeout?: number;
  maxRetries?: number;
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  models?: AIModelConfig[];
}

export interface AIModelConfig {
  id: string;
  name: string;
  providerId: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  inputCostPer1k: number;
  outputCostPer1k: number;
  defaultTemperature: number;
  defaultTopP: number;
  description?: string;
}

export interface AIProviderStatus {
  providerId: string;
  connected: boolean;
  lastError?: string;
  lastChecked: number;
  latencyMs?: number;
  modelsAvailable: number;
}

// ============================================================================
// Agent Configuration Types
// ============================================================================

export type AgentPermission = 
  | 'file:read' | 'file:write' | 'file:delete'
  | 'terminal:execute' | 'terminal:read'
  | 'git:read' | 'git:write'
  | 'web:fetch' | 'web:search'
  | 'settings:read' | 'settings:write';

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  providerId: string;
  modelId: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopSequences: string[];
  streaming: boolean;
  maxTurns: number;
  maxToolCalls: number;
  toolCallTimeout: number;
  permissions: AgentPermission[];
  enabledTools: string[];
  memoryEnabled: boolean;
  memoryMaxTokens: number;
  planningEnabled: boolean;
  planningMaxSteps: number;
  retryOnFailure: boolean;
  maxRetries: number;
  retryDelayMs: number;
  // Autonomous mode
  autonomousMode: boolean;
  autoVerify: boolean;
  autoFix: boolean;
  requireConfirmation: boolean;
  // Avatar customization
  userAvatar: string;
  agentAvatar: string;
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_AGENT_CONFIG: Omit<AgentConfig, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'Hypothesis Agent',
  description: 'AI coding assistant integrated into Hypothesis Editor',
  systemPrompt: `You are Hypothesis Agent, an autonomous AI coding assistant integrated into the Hypothesis Editor.

CRITICAL RULES:
- You MUST use tools to complete tasks. Do NOT just describe what you would do — actually DO it by calling tools.
- When a user asks you to create, write, edit, or modify files — call the writeFile or editFile tool immediately.
- When a user asks you to run something — call the terminalRun tool.
- Always complete the task fully before responding. Do not stop halfway.
- After each tool call, evaluate the result and continue with the next step if needed.
- Only provide a final text response when the task is completely done.

You have access to tools for:
- File operations: readFile, writeFile, editFile, listFiles, searchFiles
- Terminal: terminalRun (execute shell commands)
- Git: gitStatus, gitLog, gitDiff

All file operations use the workspace directory as the base path. Use relative paths or absolute paths.
Be concise in your explanations but thorough in your work.`,
  providerId: '',
  modelId: '',
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1.0,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stopSequences: [],
  streaming: true,
  maxTurns: 20,
  maxToolCalls: 10,
  toolCallTimeout: 30000,
  permissions: ['file:read', 'file:write', 'file:delete', 'terminal:read', 'terminal:execute', 'git:read', 'git:write'],
  enabledTools: ['readFile', 'writeFile', 'editFile', 'listFiles', 'searchFiles', 'terminalRun', 'gitStatus', 'gitLog', 'gitDiff', 'getOpenEditors', 'fetchWebPage', 'createDirectory', 'deleteFile', 'moveFile', 'copyFile', 'getFileInfo', 'insertAtLine', 'replaceLines', 'appendToFile', 'gitAdd', 'gitCommit', 'gitCheckout', 'gitBranch', 'gitPush', 'gitPull', 'openInEditor', 'runTests', 'getProjectInfo'],
  memoryEnabled: true,
  memoryMaxTokens: 4000,
  planningEnabled: true,
  planningMaxSteps: 10,
  retryOnFailure: true,
  maxRetries: 3,
  retryDelayMs: 1000,
  autonomousMode: true,
  autoVerify: true,
  autoFix: true,
  requireConfirmation: true,
  userAvatar: 'U',
  agentAvatar: 'A',
};

// ============================================================================
// Chat & Message Types
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export type MessageStatus = 'pending' | 'streaming' | 'completed' | 'error' | 'cancelled';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
  error?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  startTime: number;
  endTime?: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  toolCalls?: ToolCall[];
  tokenUsage?: TokenUsage;
  model?: string;
  provider?: string;
  timestamp: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatSession {
  id: string;
  title: string;
  agentId: string;
  messages: ChatMessage[];
  totalTokenUsage: TokenUsage;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Tool System Types
// ============================================================================

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  enum?: string[];
  default?: unknown;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: 'file' | 'terminal' | 'git' | 'search' | 'web' | 'editor' | 'utility';
  parameters: ToolParameter[];
  requiredPermissions: AgentPermission[];
  dangerous: boolean;
  enabled: boolean;
}

export interface ToolExecutionContext {
  sessionId: string;
  agentId: string;
  workspacePath?: string;
  workspaceFolders?: string[];
  currentFilePath?: string;
  selectedText?: string;
  cursorPosition?: { line: number; column: number };
  permissions: AgentPermission[];
  abortSignal?: AbortSignal;
}

export interface ToolExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, unknown>;
  executionTimeMs: number;
}

// ============================================================================
// Memory System Types
// ============================================================================

export interface MemoryEntry {
  id: string;
  sessionId: string;
  type: 'conversation' | 'fact' | 'preference' | 'code_context' | 'task_result';
  content: string;
  tokens: number;
  importance: number;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryQuery {
  query: string;
  type?: MemoryEntry['type'];
  maxResults?: number;
  minImportance?: number;
  sessionId?: string;
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  relevance: number;
}

// ============================================================================
// Task & Planning Types
// ============================================================================

export type TaskStatus = 'pending' | 'planning' | 'executing' | 'verifying' | 'fixing' | 'waiting' | 'completed' | 'failed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface TaskStep {
  id: string;
  description: string;
  toolId?: string;
  toolArgs?: Record<string, unknown>;
  status: 'pending' | 'executing' | 'verifying' | 'fixing' | 'completed' | 'failed' | 'skipped';
  result?: string;
  error?: string;
  verification?: string;
  retryCount?: number;
  startTime?: number;
  endTime?: number;
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  steps: TaskStep[];
  currentStepIndex: number;
  agentId: string;
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  error?: string;
  result?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Streaming Types
// ============================================================================

export type StreamEventType =
  | 'message_start'
  | 'content_delta'
  | 'content_done'
  | 'tool_call_start'
  | 'tool_call_delta'
  | 'tool_call_done'
  | 'tool_result'
  | 'task_update'
  | 'task_step_update'
  | 'task_log'
  | 'usage_update'
  | 'error'
  | 'done';

export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
  timestamp: number;
}

export interface StreamContentDelta {
  content: string;
}

export interface StreamToolCallDelta {
  toolCallId: string;
  name?: string;
  argumentsDelta?: string;
}

export interface StreamUsageUpdate {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ============================================================================
// Telemetry & Logging Types
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AgentLogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  category: 'agent' | 'provider' | 'tool' | 'memory' | 'task' | 'stream' | 'config' | 'autonomous';
  message: string;
  data?: unknown;
  sessionId?: string;
  agentId?: string;
}

export interface TelemetryEvent {
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
}

// ============================================================================
// Error Types
// ============================================================================

export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public category: 'provider' | 'tool' | 'config' | 'auth' | 'rate_limit' | 'timeout' | 'validation' | 'unknown',
    public providerId?: string,
    public retryable: boolean = false,
    public statusCode?: number,
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

// ============================================================================
// IPC Channel Names
// ============================================================================

export const AGENT_IPC_CHANNELS = {
  // Chat
  AGENT_CHAT_SEND: 'agent:chat:send',
  AGENT_CHAT_STREAM: 'agent:chat:stream',
  AGENT_CHAT_CANCEL: 'agent:chat:cancel',
  AGENT_CHAT_CLEAR: 'agent:chat:clear',
  AGENT_CHAT_HISTORY: 'agent:chat:history',

  // Sessions
  AGENT_SESSION_CREATE: 'agent:session:create',
  AGENT_SESSION_LIST: 'agent:session:list',
  AGENT_SESSION_DELETE: 'agent:session:delete',
  AGENT_SESSION_GET: 'agent:session:get',

  // Providers
  AGENT_PROVIDER_LIST: 'agent:provider:list',
  AGENT_PROVIDER_ADD: 'agent:provider:add',
  AGENT_PROVIDER_UPDATE: 'agent:provider:update',
  AGENT_PROVIDER_REMOVE: 'agent:provider:remove',
  AGENT_PROVIDER_TEST: 'agent:provider:test',
  AGENT_PROVIDER_MODELS: 'agent:provider:models',

  // Config
  AGENT_CONFIG_GET: 'agent:config:get',
  AGENT_CONFIG_SET: 'agent:config:set',
  AGENT_CONFIG_LIST: 'agent:config:list',
  AGENT_CONFIG_CREATE: 'agent:config:create',
  AGENT_CONFIG_UPDATE: 'agent:config:update',
  AGENT_CONFIG_DELETE: 'agent:config:delete',

  // Tasks
  AGENT_TASK_CREATE: 'agent:task:create',
  AGENT_TASK_LIST: 'agent:task:list',
  AGENT_TASK_GET: 'agent:task:get',
  AGENT_TASK_CANCEL: 'agent:task:cancel',
  AGENT_TASK_DELETE: 'agent:task:delete',

  // Tools
  AGENT_TOOL_LIST: 'agent:tool:list',
  AGENT_TOOL_ENABLE: 'agent:tool:enable',
  AGENT_TOOL_DISABLE: 'agent:tool:disable',
  AGENT_TOOL_EXECUTE: 'agent:tool:execute',

  // Memory
  AGENT_MEMORY_SEARCH: 'agent:memory:search',
  AGENT_MEMORY_ADD: 'agent:memory:add',
  AGENT_MEMORY_CLEAR: 'agent:memory:clear',
  AGENT_MEMORY_LIST: 'agent:memory:list',

  // Logs
  AGENT_LOG_LIST: 'agent:log:list',
  AGENT_LOG_CLEAR: 'agent:log:clear',
  AGENT_LOG_ENTRY: 'agent:log:entry',

  // Streaming
  AGENT_STREAM_EVENT: 'agent:stream:event',
  AGENT_STREAM_START: 'agent:stream:start',
  AGENT_STREAM_END: 'agent:stream:end',

  // Status
  AGENT_STATUS: 'agent:status',
  AGENT_HEALTH: 'agent:health',
} as const;
