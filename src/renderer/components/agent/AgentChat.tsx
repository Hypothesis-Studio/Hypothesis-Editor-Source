/**
 * AgentChat - Full-featured chat interface for the AI agent.
 * Supports streaming, markdown, tool display, slash commands with autocomplete, session management, clear.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import { useEditorStore } from '../../stores/editorStore';
import type { ChatMessage, StreamEvent, AgentTask } from '../../../shared/types/agent';
import { executeSlashCommand, filterSlashCommands, type SlashCommand } from './SlashCommands';

// Default profile avatars
const profileSvgs = import.meta.glob('/src/renderer/assets/icons/profile/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const PROFILE_AVATARS: string[] = Object.values(profileSvgs);
const DEFAULT_USER_AVATAR = PROFILE_AVATARS[0] || '';
const DEFAULT_AGENT_AVATAR = PROFILE_AVATARS[5] || '';

interface AgentChatProps {
  onOpenSettings?: () => void;
}

export const AgentChat: React.FC<AgentChatProps> = ({ onOpenSettings }) => {
  const {
    messages, sessions, activeSessionId, isStreaming, streamingContent,
    agentConfigs, activeAgentId, providers, tools, healthStatus, tasks,
    sendMessage, sendWithContext, cancelStream, createSession, setActiveSession, deleteSession,
    loadSessions, handleStreamEvent, setActiveAgent,
    loadAgentConfigs, loadProviders, clearMessages, clearMemory, searchMemory, loadHealthStatus,
  } = useAgentStore();

  const [input, setInput] = useState('');
  const [prefillCode, setPrefillCode] = useState<string | null>(null);
  const [prefillMode, setPrefillMode] = useState<'ask' | 'fix' | null>(null);
  const [showSessionList, setShowSessionList] = useState(false);
  const [suggestions, setSuggestions] = useState<SlashCommand[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize
  useEffect(() => {
    loadAgentConfigs();
    loadProviders();
    loadSessions();
  }, []);

  // Auto-select first agent
  useEffect(() => {
    if (!activeAgentId && agentConfigs.length > 0) {
      setActiveAgent(agentConfigs[0].id);
    }
  }, [agentConfigs, activeAgentId]);

  // Listen for stream events
  useEffect(() => {
    const cleanup = window.api.agent.stream.onEvent((event: unknown) => {
      handleStreamEvent(event as StreamEvent);
    });
    return () => cleanup?.();
  }, [handleStreamEvent]);

  // Listen for code-to-agent events from editor context menu
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { code: string; mode: 'ask' | 'fix' };
      if (detail?.code) {
        setPrefillCode(detail.code);
        setPrefillMode(detail.mode);
        inputRef.current?.focus();
      }
    };
    window.addEventListener('hypothesis:agent-with-code', handler);
    return () => window.removeEventListener('hypothesis:agent-with-code', handler);
  }, []);

  // Listen for open-agent-tab events
  useEffect(() => {
    const handler = () => {
      const agentTabId = 'agent-tab';
      const existing = useEditorStore.getState().tabs.find(t => t.id === agentTabId);
      if (existing) {
        useEditorStore.getState().setActiveTab(agentTabId);
      }
    };
    window.addEventListener('hypothesis:open-agent-tab', handler);
    return () => window.removeEventListener('hypothesis:open-agent-tab', handler);
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Auto-focus input
  useEffect(() => {
    if (!isStreaming) inputRef.current?.focus();
  }, [isStreaming]);

  // Update suggestions when input changes
  useEffect(() => {
    if (input.startsWith('/')) {
      const filtered = filterSlashCommands(input);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
      setSelectedSuggestion(0);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }, [input]);

  const addSystemMessage = useCallback((content: string) => {
    const sysMsg: ChatMessage = {
      id: `sys-${Date.now()}`,
      role: 'system',
      content,
      status: 'completed',
      timestamp: Date.now(),
    };
    useAgentStore.setState((s) => ({ messages: [...s.messages, sysMsg] }));
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed && !prefillCode) return;
    if (isStreaming) return;
    setShowSuggestions(false);

    // If we have prefill code from context menu, send with context
    if (prefillCode) {
      const code = prefillCode;
      const mode = prefillMode;
      setPrefillCode(null);
      setPrefillMode(null);
      const userMsg = trimmed || (mode === 'fix' ? 'Fix this code' : 'Explain this code');
      setInput('');
      await sendWithContext(code, userMsg);
      return;
    }

    if (!trimmed) return;
    setInput('');

    // Check for slash command
    if (trimmed.startsWith('/')) {
      const result = executeSlashCommand(trimmed, {
        sessionId: activeSessionId,
        clearMessages,
        createSession: async (agentId: string) => {
          const s = await useAgentStore.getState().createSession(agentId);
          return s;
        },
        activeAgentId,
        clearMemory,
        searchMemory,
        loadHealthStatus,
        healthStatus,
        agentConfigs,
        providers,
        tools,
        messages,
        onOpenSettings,
      });

      if (result.handled) {
        if (result.message) addSystemMessage(result.message);
        result.action?.();
        return;
      }
    }

    await sendMessage(trimmed);
  }, [input, isStreaming, sendMessage, activeSessionId, clearMessages, createSession, activeAgentId, clearMemory, searchMemory, loadHealthStatus, healthStatus, agentConfigs, providers, tools, messages, onOpenSettings, addSystemMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Navigate suggestions
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestion((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestion((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        setInput(suggestions[selectedSuggestion].command + ' ');
        setShowSuggestions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }

    if (e.key === 'Escape') {
      if (isStreaming) {
        cancelStream();
      } else {
        setShowSuggestions(false);
      }
    }
  }, [handleSend, showSuggestions, suggestions, selectedSuggestion, isStreaming, cancelStream]);

  const handleNewSession = useCallback(async () => {
    if (activeAgentId) {
      await createSession(activeAgentId);
      setShowSessionList(false);
    }
  }, [activeAgentId, createSession]);

  const handleClearChat = useCallback(() => {
    if (activeSessionId) {
      clearMessages(activeSessionId);
    }
  }, [activeSessionId, clearMessages]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px',
        borderBottom: '1px solid var(--theme-border)',
        background: 'var(--theme-bg-secondary)',
      }}>
        {/* Agent selector */}
        <select
          value={activeAgentId || ''}
          onChange={(e) => setActiveAgent(e.target.value)}
          style={selectStyle}
        >
          {agentConfigs.length === 0 && <option value="">No agents</option>}
          {agentConfigs.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        {/* Session selector */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowSessionList(!showSessionList)}
            style={btnStyle}
          >
            {activeSessionId
              ? sessions.find(s => s.id === activeSessionId)?.title?.substring(0, 30) || 'Session'
              : 'New Session'}
            <svg width={10} height={10} fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ marginLeft: 4 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showSessionList && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 100,
              background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)',
              borderRadius: 4, minWidth: 250, maxHeight: 300, overflowY: 'auto',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>
              <button
                onClick={handleNewSession}
                style={{ ...menuItemStyle, color: 'var(--theme-accent)', borderBottom: '1px solid var(--theme-border)' }}
              >
                + New Session
              </button>
              {sessions.map((s) => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center',
                  background: s.id === activeSessionId ? 'var(--theme-bg-active)' : 'transparent',
                }}>
                  <button
                    onClick={() => { setActiveSession(s.id); setShowSessionList(false); }}
                    style={{ ...menuItemStyle, flex: 1, textAlign: 'left' }}
                  >
                    <div style={{ fontSize: 11, color: 'var(--theme-fg)' }}>{s.title}</div>
                    <div style={{ fontSize: 9, color: 'var(--theme-fg-muted)' }}>
                      {s.messages.length} messages · {new Date(s.updatedAt).toLocaleDateString()}
                    </div>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-fg-muted)', padding: '4px 8px' }}
                    title="Delete session"
                  >
                    <svg width={12} height={12} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              {sessions.length === 0 && (
                <div style={{ padding: '12px', fontSize: 11, color: 'var(--theme-fg-muted)', textAlign: 'center' }}>No sessions yet</div>
              )}
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Provider/model info */}
        {activeAgentId && (() => {
          const agent = agentConfigs.find(a => a.id === activeAgentId);
          if (!agent) return null;
          const provider = providers.find(p => p.id === agent.providerId);
          return (
            <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)' }}>
              {provider?.name || 'No provider'} · {agent.modelId || 'No model'}
            </div>
          );
        })()}

        {/* Clear chat button */}
        {messages.length > 0 && (
          <button
            onClick={handleClearChat}
            style={{ ...btnStyle, fontSize: 10, color: 'var(--theme-fg-muted)', display: 'flex', alignItems: 'center', gap: 4 }}
            title="Clear chat messages"
          >
            <svg width={12} height={12} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {messages.length === 0 && !isStreaming && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: 'var(--theme-fg-muted)',
          }}>
            <svg width={48} height={48} fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ opacity: 0.3, marginBottom: 12 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Hypothesis Agent</div>
            <div style={{ fontSize: 11 }}>Ask me anything about your code</div>
            <div style={{ fontSize: 10, marginTop: 12, opacity: 0.6, textAlign: 'center', lineHeight: 1.8 }}>
              Type <code style={{ background: 'var(--theme-bg-tertiary)', padding: '1px 4px', borderRadius: 3 }}>/help</code> for available commands<br />
              <code style={{ background: 'var(--theme-bg-tertiary)', padding: '1px 4px', borderRadius: 3 }}>/clear</code> to clear chat · <code style={{ background: 'var(--theme-bg-tertiary)', padding: '1px 4px', borderRadius: 3 }}>/reset</code> to reset memory
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} agentAvatar={agentConfigs.find(a => a.id === activeAgentId)?.agentAvatar} userAvatar={agentConfigs.find(a => a.id === activeAgentId)?.userAvatar} />
        ))}

        {/* Streaming content */}
        {isStreaming && streamingContent && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--theme-accent)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, overflow: 'hidden',
            }}><span style={{ width: 28, height: 28, display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: (agentConfigs.find(a => a.id === activeAgentId)?.agentAvatar || DEFAULT_AGENT_AVATAR).replace(/<svg/, '<svg width="28" height="28"') }} /></div>
            <div style={{
              background: 'var(--theme-bg-secondary)',
              borderRadius: '0 8px 8px 8px', padding: '8px 12px',
              maxWidth: '85%', fontSize: 12, lineHeight: 1.6,
              color: 'var(--theme-fg)',
              borderLeft: '2px solid var(--theme-accent)',
            }}>
              <MarkdownContent content={streamingContent} />
              <span style={{ animation: 'blink 1s infinite', color: 'var(--theme-accent)' }}>▊</span>
            </div>
          </div>
        )}

        {isStreaming && !streamingContent && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', color: 'var(--theme-fg-muted)' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--theme-fg-muted)',
                  animation: `bounce 1.4s infinite ${i * 0.16}s`,
                }} />
              ))}
            </div>
            <span style={{ fontSize: 11 }}>Thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{ borderTop: '1px solid var(--theme-border)', padding: '8px 12px', background: 'var(--theme-bg-secondary)', position: 'relative' }}>
        {/* Slash command autocomplete */}
        {showSuggestions && suggestions.length > 0 && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 12, right: 12,
            background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)',
            borderRadius: 6, maxHeight: 200, overflowY: 'auto',
            boxShadow: '0 -4px 12px rgba(0,0,0,0.2)', marginBottom: 4,
          }}>
            {suggestions.map((cmd, i) => (
              <div
                key={cmd.command}
                onClick={() => { setInput(cmd.command + ' '); setShowSuggestions(false); inputRef.current?.focus(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 12px', cursor: 'pointer',
                  background: i === selectedSuggestion ? 'var(--theme-bg-active)' : 'transparent',
                  borderLeft: i === selectedSuggestion ? '2px solid var(--theme-accent)' : '2px solid transparent',
                }}
                onMouseEnter={() => setSelectedSuggestion(i)}
              >
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--theme-accent)', fontFamily: 'monospace', minWidth: 80 }}>
                  {cmd.command}
                </span>
                <span style={{ fontSize: 11, color: 'var(--theme-fg-muted)', flex: 1 }}>{cmd.description}</span>
                <span style={{ fontSize: 9, color: 'var(--theme-fg-muted)', opacity: 0.5 }}>{cmd.category}</span>
              </div>
            ))}
            <div style={{ padding: '4px 12px', fontSize: 9, color: 'var(--theme-fg-muted)', borderTop: '1px solid var(--theme-border)', display: 'flex', gap: 12 }}>
              <span>↑↓ Navigate</span>
              <span>Tab Complete</span>
              <span>Enter Send</span>
            </div>
          </div>
        )}

        {/* Code prefill indicator */}
        {prefillCode && (
          <div style={{
            background: 'var(--theme-bg-tertiary)', borderRadius: 6,
            border: '1px solid var(--theme-accent)', padding: '8px 12px',
            marginBottom: 8, fontSize: 11,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ color: 'var(--theme-accent)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>
                {prefillMode === 'fix' ? 'Fix With AI' : 'Selected Code'}
              </span>
              <div style={{ flex: 1 }} />
              <button onClick={() => { setPrefillCode(null); setPrefillMode(null); }} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-fg-muted)', fontSize: 10,
              }}>x</button>
            </div>
            <pre style={{
              background: 'var(--theme-bg-secondary)', borderRadius: 4,
              padding: '6px 8px', margin: 0, fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              maxHeight: 100, overflow: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>{prefillCode.substring(0, 500)}{prefillCode.length > 500 ? '...' : ''}</pre>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Agent is responding... (Esc to cancel)' : 'Ask anything or type / for commands...'}
            disabled={isStreaming}
            style={{
              flex: 1, background: 'var(--theme-bg-tertiary)',
              border: '1px solid var(--theme-border-light)', borderRadius: 6,
              padding: '8px 10px', fontSize: 12, color: 'var(--theme-fg)',
              resize: 'none', outline: 'none', minHeight: 36, maxHeight: 120,
              fontFamily: 'inherit', lineHeight: 1.5,
            }}
            rows={1}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }}
          />
          {isStreaming ? (
            <button
              onClick={cancelStream}
              style={{ ...sendBtnStyle, background: 'var(--theme-error)' }}
              title="Cancel (Esc)"
            >
              <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              style={{ ...sendBtnStyle, opacity: input.trim() ? 1 : 0.4 }}
              title="Send (Enter)"
            >
              <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-4-4l4 4-4 4" />
              </svg>
            </button>
          )}
        </div>
        <div style={{ fontSize: 9, color: 'var(--theme-fg-muted)', marginTop: 4, paddingLeft: 2 }}>
          Enter to send · Shift+Enter for new line · / for commands · Esc to cancel
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
      `}</style>
    </div>
  );
};

// ── Message Bubble ─────────────────────────────────────────────

const MessageBubble: React.FC<{ message: ChatMessage; agentAvatar?: string; userAvatar?: string }> = ({ message, agentAvatar, userAvatar }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isError = message.status === 'error';
  const isEmpty = !message.content && !isError && !isSystem && !message.toolCalls?.length;

  if (isEmpty) return null;

  // System messages (slash command results)
  if (isSystem) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', marginBottom: 8,
      }}>
        <div style={{
          background: 'var(--theme-bg-tertiary)', borderRadius: 6,
          padding: '6px 14px', fontSize: 11, color: 'var(--theme-fg-muted)',
          maxWidth: '90%', lineHeight: 1.6, textAlign: 'left',
          border: '1px solid var(--theme-border)',
        }}>
          <MarkdownContent content={message.content} />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', gap: 8, marginBottom: 12,
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
    }}>
      {/* Avatar */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: isUser ? 'var(--theme-bg-active)' : isError ? 'var(--theme-error)' : 'var(--theme-accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, overflow: 'hidden',
      }}>
        <span style={{ width: 28, height: 28, display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: ((() => { const av = isUser ? userAvatar : agentAvatar; return (av && av.startsWith('<svg')) ? av : (isUser ? DEFAULT_USER_AVATAR : DEFAULT_AGENT_AVATAR); })()).replace(/<svg/, '<svg width="28" height="28"') }} />
      </div>

      {/* Content */}
      <div style={{
        background: isUser ? 'var(--theme-bg-active)' : 'var(--theme-bg-secondary)',
        borderRadius: isUser ? '8px 0 8px 8px' : '0 8px 8px 8px',
        padding: '8px 12px', maxWidth: '85%',
        borderLeft: isError ? '2px solid var(--theme-error)' : isUser ? 'none' : '2px solid var(--theme-accent)',
        userSelect: 'text', cursor: 'text',
        position: 'relative',
      }}>
        {/* Copy button */}
        <CopyButton text={message.content} />
        {isError ? (
          <div style={{ fontSize: 12, color: 'var(--theme-error)' }}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Error</div>
            <div>{message.error || 'An error occurred'}</div>
          </div>
        ) : (
          <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--theme-fg)' }}>
            <MarkdownContent content={message.content} />
          </div>
        )}

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div style={{ marginTop: 8, borderTop: '1px solid var(--theme-border)', paddingTop: 8 }}>
            {message.toolCalls.map((tc) => (
              <div key={tc.id} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 10, color: 'var(--theme-fg-muted)', marginBottom: 4,
              }}>
                <span style={{
                  padding: '1px 6px', borderRadius: 3,
                  background: tc.status === 'error' ? 'var(--theme-error)' : tc.status === 'completed' ? 'var(--theme-accent)' : 'var(--theme-bg-active)',
                  color: '#fff', fontSize: 9,
                }}>{tc.status}</span>
                <span style={{ fontFamily: 'monospace' }}>{tc.name}</span>
                {tc.error && <span style={{ color: 'var(--theme-error)' }}>— {tc.error}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Token usage */}
        {message.tokenUsage && message.tokenUsage.totalTokens > 0 && (
          <div style={{
            marginTop: 6, paddingTop: 4, borderTop: '1px solid var(--theme-border)',
            fontSize: 9, color: 'var(--theme-fg-muted)', display: 'flex', gap: 8,
          }}>
            <span>{message.tokenUsage.totalTokens} tokens</span>
            {message.tokenUsage.estimatedCost > 0 && <span>${message.tokenUsage.estimatedCost.toFixed(4)}</span>}
          </div>
        )}

        {/* Timestamp */}
        <div style={{ fontSize: 9, color: 'var(--theme-fg-muted)', marginTop: 4, opacity: 0.6 }}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

// ── Markdown Renderer ──────────────────────────────────────────

const MarkdownContent: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;

  // First handle code blocks, then inline elements
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trimStart().startsWith('```')) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const codeContent = codeLines.join('\n');
      if (!codeContent.trim()) continue;
      const lineCount = codeLines.length;
      elements.push(
        <CollapsibleCodeBlock key={elements.length} lang={lang} code={codeContent} lineCount={lineCount} />
      );
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      elements.push(<h4 key={elements.length} style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-fg)', margin: '8px 0 4px' }}>{renderInline(line.slice(4))}</h4>);
      i++; continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h3 key={elements.length} style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', margin: '8px 0 4px' }}>{renderInline(line.slice(3))}</h3>);
      i++; continue;
    }
    if (line.startsWith('# ')) {
      elements.push(<h2 key={elements.length} style={{ fontSize: 14, fontWeight: 600, color: 'var(--theme-fg)', margin: '8px 0 4px' }}>{renderInline(line.slice(2))}</h2>);
      i++; continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/)) {
      elements.push(<hr key={elements.length} style={{ border: 'none', borderTop: '1px solid var(--theme-border)', margin: '8px 0' }} />);
      i++; continue;
    }

    // Bullet list items
    if (line.match(/^[-*] /)) {
      elements.push(
        <div key={elements.length} style={{ display: 'flex', gap: 8, margin: '3px 0', paddingLeft: 12, lineHeight: 1.7, fontSize: 13 }}>
          <span style={{ color: 'var(--theme-accent)', flexShrink: 0 }}>•</span>
          <span>{renderInline(line.replace(/^[-*] /, ''))}</span>
        </div>
      );
      i++; continue;
    }

    // Numbered list items
    const numMatch = line.match(/^\d+\. /);
    if (numMatch) {
      elements.push(
        <div key={elements.length} style={{ display: 'flex', gap: 8, margin: '3px 0', paddingLeft: 12, lineHeight: 1.7, fontSize: 13 }}>
          <span style={{ color: 'var(--theme-accent)', flexShrink: 0, minWidth: 16 }}>{numMatch[0]}</span>
          <span>{renderInline(line.slice(numMatch[0].length))}</span>
        </div>
      );
      i++; continue;
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={elements.length} style={{ height: 6 }} />);
      i++; continue;
    }

    // Regular paragraph
    elements.push(<div key={elements.length} style={{ margin: '4px 0', lineHeight: 1.7, fontSize: 13 }}>{renderInline(line)}</div>);
    i++;
  }

  return <>{elements}</>;
};

/** Render inline markdown: bold, italic, inline code, links */
function renderInline(text: string): React.ReactNode {
  // Split by inline patterns
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    if (!part) return null;
    // Inline code
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={i} style={{
          background: 'var(--theme-bg-tertiary)', borderRadius: 3,
          padding: '1px 4px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
        }}>{part.slice(1, -1)}</code>
      );
    }
    // Bold
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    // Italic
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2 && !part.startsWith('**')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    // Link
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return <a key={i} href={linkMatch[2]} style={{ color: 'var(--theme-accent)' }} target="_blank" rel="noreferrer">{linkMatch[1]}</a>;
    }
    return part;
  });
}

// ── Collapsible Code Block ─────────────────────────────────────

const CollapsibleCodeBlock: React.FC<{ lang: string; code: string; lineCount: number }> = ({ lang, code, lineCount }) => {
  const [collapsed, setCollapsed] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      background: 'var(--theme-bg-tertiary)', borderRadius: 6,
      border: '1px solid var(--theme-border)', margin: '8px 0',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', cursor: 'pointer',
          background: 'var(--theme-bg-secondary)',
          borderBottom: collapsed ? 'none' : '1px solid var(--theme-border)',
        }}
      >
        <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)', transition: 'transform 0.15s', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
          ▼
        </span>
        <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--theme-fg-muted)', flex: 1 }}>
          {lang || 'code'} · {lineCount} line{lineCount !== 1 ? 's' : ''}
        </span>
        <button
          onClick={handleCopy}
          style={{
            background: copied ? 'rgba(99,102,241,0.15)' : 'transparent',
            border: '1px solid var(--theme-border-light)', borderRadius: 3,
            padding: '2px 8px', fontSize: 9, cursor: 'pointer',
            color: copied ? 'var(--theme-accent)' : 'var(--theme-fg-muted)',
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Code content */}
      {!collapsed && (
        <pre style={{
          margin: 0, padding: '10px 12px', overflow: 'auto',
          fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
          lineHeight: 1.5, maxHeight: 400,
        }}>
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
};

// ── Copy Button ───────────────────────────────────────────────

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        position: 'absolute', top: 4, right: 4,
        background: copied ? 'rgba(99,102,241,0.2)' : 'var(--theme-bg-tertiary)',
        border: '1px solid var(--theme-border-light)', borderRadius: 4,
        padding: '2px 6px', fontSize: 9, cursor: 'pointer',
        color: copied ? 'var(--theme-accent)' : 'var(--theme-fg-muted)',
        opacity: 0, transition: 'opacity 0.15s, background 0.15s',
        zIndex: 1,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0'; }}
      title="Copy message"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
};

// ── Autonomous Progress Panel ──────────────────────────────────

const AutonomousProgressPanel: React.FC<{ tasks: AgentTask[] }> = ({ tasks }) => {
  const activeTasks = tasks.filter(t => t.status === 'executing' || t.status === 'verifying' || t.status === 'fixing' || t.status === 'completed' || t.status === 'failed');
  if (activeTasks.length === 0) return null;

  const completedCount = activeTasks.filter(t => t.status === 'completed').length;
  const totalCount = activeTasks.length;
  const overallProgress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div style={{
      background: 'var(--theme-bg-secondary)', borderRadius: 8,
      border: '1px solid var(--theme-border)', padding: '12px 16px',
      marginBottom: 12,
    }}>
      {/* Overall progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-fg)' }}>Autonomous Progress</span>
        <div style={{ flex: 1, height: 6, background: 'var(--theme-bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${overallProgress}%`, height: '100%', background: 'var(--theme-accent)', borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)' }}>{completedCount}/{totalCount}</span>
      </div>

      {/* Task list */}
      {activeTasks.map((task) => (
        <div key={task.id} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 14, lineHeight: 1 }}>
              {task.status === 'completed' ? '✓' : task.status === 'failed' ? '✗' : task.status === 'executing' ? '⟳' : task.status === 'verifying' ? '⊘' : task.status === 'fixing' ? '⚡' : '○'}
            </span>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--theme-fg)' }}>{task.title}</span>
            <span style={{ fontSize: 9, color: 'var(--theme-fg-muted)', marginLeft: 'auto' }}>
              {task.currentStepIndex}/{task.steps.length} steps
            </span>
          </div>

          {/* Step progress */}
          {task.steps.length > 0 && (
            <div style={{ marginLeft: 22 }}>
              {task.steps.map((step, i) => (
                <div key={step.id || i} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '2px 0', fontSize: 10,
                }}>
                  <span style={{
                    color: step.status === 'completed' ? 'var(--theme-accent)'
                      : step.status === 'failed' ? 'var(--theme-error)'
                      : step.status === 'executing' ? 'var(--theme-accent)'
                      : step.status === 'fixing' ? '#ff9800'
                      : 'var(--theme-fg-muted)',
                    fontWeight: 600, minWidth: 14,
                  }}>
                    {step.status === 'completed' ? '✓' : step.status === 'failed' ? '✗' : step.status === 'executing' ? '⟳' : step.status === 'fixing' ? '⚡' : '○'}
                  </span>
                  <span style={{
                    color: step.status === 'executing' ? 'var(--theme-fg)' : 'var(--theme-fg-muted)',
                    flex: 1,
                  }}>
                    {step.description}
                  </span>
                  {step.retryCount && step.retryCount > 0 && (
                    <span style={{ fontSize: 9, color: '#ff9800' }}>(retry {step.retryCount})</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ── Styles ─────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  background: 'var(--theme-bg-tertiary)', border: '1px solid var(--theme-border-light)',
  borderRadius: 4, padding: '3px 6px', fontSize: 11, color: 'var(--theme-fg)', outline: 'none', cursor: 'pointer',
};

const btnStyle: React.CSSProperties = {
  background: 'var(--theme-bg-tertiary)', border: '1px solid var(--theme-border-light)',
  borderRadius: 4, padding: '3px 8px', fontSize: 11, color: 'var(--theme-fg)',
  cursor: 'pointer', display: 'flex', alignItems: 'center',
};

const sendBtnStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 6, border: 'none',
  background: 'var(--theme-accent)', color: '#fff',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};

const menuItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '8px 12px', border: 'none', background: 'transparent',
  cursor: 'pointer', fontSize: 11, color: 'var(--theme-fg)',
};
