/**
 * AgentChat - Full-featured chat interface for the AI agent.
 * Supports streaming, markdown, tool display, slash commands with autocomplete, session management, clear.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAgentStore, type ActiveToolCall, type PendingApproval } from '../../stores/agentStore';
import { useEditorStore } from '../../stores/editorStore';
import type { ChatMessage, StreamEvent, AgentTask } from '../../../shared/types/agent';
import { executeSlashCommand, filterSlashCommands, type SlashCommand } from './SlashCommands';

// Default profile avatars
const profileSvgs = import.meta.glob('/src/renderer/assets/icons/profile/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const PROFILE_AVATARS: string[] = Object.values(profileSvgs);
const DEFAULT_USER_AVATAR = PROFILE_AVATARS[0] || '';
const DEFAULT_AGENT_AVATAR = PROFILE_AVATARS[5] || '';

const ctxMenuItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  width: '100%', textAlign: 'left',
  padding: '6px 12px', border: 'none', background: 'transparent',
  cursor: 'pointer', fontSize: 12, color: 'var(--theme-fg)',
  userSelect: 'none',
};

interface AgentChatProps {
  onOpenSettings?: () => void;
}

export const AgentChat: React.FC<AgentChatProps> = ({ onOpenSettings }) => {
  const {
    messages, sessions, activeSessionId, isStreaming, streamingContent,
    activeToolCalls, pendingApprovals,
    agentConfigs, activeAgentId, providers, tools, healthStatus, tasks,
    sendMessage, sendWithContext, cancelStream, createSession, setActiveSession, deleteSession,
    loadSessions, handleStreamEvent, setActiveAgent,
    loadAgentConfigs, loadProviders, clearMessages, clearMemory, searchMemory, loadHealthStatus,
    approveToolCall, denyToolCall,
  } = useAgentStore();

  const { tabs, activeTabId } = useEditorStore();
  const activeTab = tabs.find(t => t.id === activeTabId);
  const activeFilePath = activeTab?.filePath || activeTab?.fileName || undefined;

  const [input, setInput] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; selection: string } | null>(null);
  const [prefillCode, setPrefillCode] = useState<string | null>(null);
  const [prefillMode, setPrefillMode] = useState<'ask' | 'fix' | null>(null);
  const [showSessionList, setShowSessionList] = useState(false);
  const [suggestions, setSuggestions] = useState<SlashCommand[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [messageFeedback, setMessageFeedback] = useState<Map<string, 'up' | 'down'>>(new Map());
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
        activeFilePath,
        selectedCode: prefillCode || undefined,
      });

      if (result.handled) {
        if (result.aiPrompt) {
          // AI command — send the smart prompt to the agent
          await sendMessage(result.aiPrompt);
        } else {
          if (result.message) addSystemMessage(result.message);
          result.action?.();
        }
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

  // Context menu for chat messages
  const closeChatContextMenu = useCallback(() => setContextMenu(null), []);

  const showChatContextMenu = useCallback((e: React.MouseEvent, selection: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, selection });
  }, []);

  // Dismiss context menu on outside click or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => closeChatContextMenu();
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeChatContextMenu(); };
    window.addEventListener('mousedown', handler);
    window.addEventListener('keydown', keyHandler);
    return () => {
      window.removeEventListener('mousedown', handler);
      window.removeEventListener('keydown', keyHandler);
    };
  }, [contextMenu, closeChatContextMenu]);

  const copySelection = useCallback(async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { document.execCommand('copy'); }
    closeChatContextMenu();
  }, [closeChatContextMenu]);

  const copyAllMessages = useCallback(async () => {
    const text = messages
      .filter(m => m.role !== 'system')
      .map(m => `[${m.role === 'user' ? 'You' : 'Agent'}] ${m.content}`)
      .join('\n\n');
    try { await navigator.clipboard.writeText(text); } catch { document.execCommand('copy'); }
    closeChatContextMenu();
  }, [messages, closeChatContextMenu]);

  // Stop clipboard/text-editing shortcuts from bubbling up to Monaco/App handlers
  const handlePanelKeyDown = useCallback((e: React.KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && ['c','C','x','X','v','V','a','A','z','Z','y','Y'].includes(e.key)) {
      e.stopPropagation();
      // Ctrl+A: only override when focus is NOT on the textarea input
      if (e.key === 'a' || e.key === 'A') {
        const focused = document.activeElement;
        const isInInput = focused instanceof HTMLTextAreaElement || focused instanceof HTMLInputElement;
        if (!isInInput) {
          const sel = window.getSelection();
          const chatArea = document.querySelector('[data-chat-messages]') as HTMLElement;
          if (sel && chatArea) {
            const range = document.createRange();
            range.selectNodeContents(chatArea);
            sel.removeAllRanges();
            sel.addRange(range);
            e.preventDefault();
          }
        }
        // If focus is in textarea, let browser handle Ctrl+A natively
      }
    }
  }, []);

  return (
    <div
      data-agent-panel
      style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}
      onKeyDown={handlePanelKeyDown}
      onClick={(e) => { if (contextMenu) { e.stopPropagation(); closeChatContextMenu(); } }}
    >
      {/* Context menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed', zIndex: 9999,
            top: contextMenu.y, left: contextMenu.x,
            background: 'var(--theme-bg-secondary)',
            border: '1px solid var(--theme-border)',
            borderRadius: 6, minWidth: 160,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            padding: '4px 0',
            fontSize: 12,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {contextMenu.selection && (
            <>
              <button
                style={ctxMenuItemStyle}
                onClick={() => copySelection(contextMenu.selection)}
              >
                <svg width={13} height={13} fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
                <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: 10 }}>Ctrl+C</span>
              </button>
              <div style={{ height: 1, background: 'var(--theme-border)', margin: '4px 0' }} />
            </>
          )}
          <button
            style={ctxMenuItemStyle}
            onClick={() => {
              const sel = window.getSelection();
              const container = document.querySelector('[data-chat-messages]') as HTMLElement;
              if (sel && container) {
                const range = document.createRange();
                range.selectNodeContents(container);
                sel.removeAllRanges();
                sel.addRange(range);
              }
              closeChatContextMenu();
            }}
          >
            <svg width={13} height={13} fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Select All
            <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: 10 }}>Ctrl+A</span>
          </button>
          <button
            style={ctxMenuItemStyle}
            onClick={copyAllMessages}
          >
            <svg width={13} height={13} fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Copy All Messages
          </button>
        </div>
      )}

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

        {/* Active file context badge + Provider/model info */}
        {activeAgentId && (() => {
          const agent = agentConfigs.find(a => a.id === activeAgentId);
          if (!agent) return null;
          const provider = providers.find(p => p.id === agent.providerId);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {activeFilePath && (
                <button
                  onClick={() => {
                    const tab = tabs.find((t: any) => t.filePath === activeFilePath || t.title === activeFilePath);
                    if (tab) useEditorStore.getState().setActiveTab(tab.id);
                  }}
                  title={`Context: ${activeFilePath}`}
                  style={{
                    background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
                    borderRadius: 4, padding: '2px 7px', fontSize: 9, color: 'var(--theme-accent)',
                    cursor: 'pointer', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <svg width={9} height={9} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {(activeFilePath.split('/').pop() || '').split('\\').pop() || activeFilePath}
                </button>
              )}
              <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)' }}>
                {provider?.name || 'No provider'} · {agent.modelId || 'No model'}
              </div>
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
      <div
        data-chat-messages
        style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', userSelect: 'text' }}
        onContextMenu={(e) => {
          const selection = window.getSelection()?.toString() || '';
          showChatContextMenu(e, selection);
        }}
      >
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

        {messages.map((msg, idx) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            agentAvatar={agentConfigs.find(a => a.id === activeAgentId)?.agentAvatar}
            userAvatar={agentConfigs.find(a => a.id === activeAgentId)?.userAvatar}
            feedback={messageFeedback.get(msg.id)}
            onFeedback={(v) => setMessageFeedback(prev => new Map(prev).set(msg.id, v))}
            onRetry={msg.role === 'assistant' ? () => {
              const prevUser = [...messages].slice(0, idx).reverse().find(m => m.role === 'user');
              if (prevUser) {
                useAgentStore.setState(s => ({ messages: s.messages.filter((_, i) => i < idx) }));
                sendMessage(prevUser.content);
              }
            } : undefined}
          />
        ))}


        {/* Active tool calls - shown during streaming */}
        {activeToolCalls.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            {activeToolCalls.map((tc) => (
              <ToolCallCard key={tc.id} call={tc} />
            ))}
          </div>
        )}

        {/* Approval gates for dangerous operations */}
        {pendingApprovals.map((approval) => (
          <ApprovalGate
            key={approval.id}
            approval={approval}
            onApprove={() => approveToolCall(approval.sessionId, approval.id)}
            onDeny={() => denyToolCall(approval.sessionId, approval.id)}
          />
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
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

// ── Message Bubble ─────────────────────────────────────────────

// ── Tool Call Card ────────────────────────────────────────────────────────────

const DANGEROUS_TOOLS = new Set(['deleteFile', 'terminalRun', 'writeFile', 'editFile', 'gitPush', 'gitCommit']);

const TOOL_ICONS: Record<string, string> = {
  file: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  terminal: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  git: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  web: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
  editor: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
};

function getToolIcon(toolName: string): string {
  if (/file|read|write|edit|append|insert|replace|copy|move|delete|create|list|getFile|getProject/.test(toolName)) return TOOL_ICONS.file;
  if (/terminal|run|exec|test/.test(toolName)) return TOOL_ICONS.terminal;
  if (/git/.test(toolName)) return TOOL_ICONS.git;
  if (/search|find/.test(toolName)) return TOOL_ICONS.search;
  if (/fetch|web|url|http/.test(toolName)) return TOOL_ICONS.web;
  return TOOL_ICONS.editor;
}

const ToolCallCard: React.FC<{ call: ActiveToolCall }> = React.memo(({ call }) => {
  const [expanded, setExpanded] = useState(false);
  const isDangerous = DANGEROUS_TOOLS.has(call.name);
  const isRunning = call.status === 'running';
  const isError = call.status === 'error';
  const durationMs = call.completedAt ? call.completedAt - call.startedAt : Date.now() - call.startedAt;

  const accentColor = isError ? 'var(--theme-error)' : isDangerous ? '#f59e0b' : 'var(--theme-accent)';
  const iconPath = getToolIcon(call.name);

  const argSummary = call.args
    ? Object.entries(call.args)
        .slice(0, 2)
        .map(([k, v]) => `${k}: ${String(v).substring(0, 40)}`)
        .join(', ')
    : '';

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '5px 10px', marginBottom: 3,
      background: 'var(--theme-bg-tertiary)', borderRadius: 5,
      border: `1px solid ${isError ? 'var(--theme-error)' : isDangerous ? 'rgba(245,158,11,0.3)' : 'var(--theme-border)'}`,
      borderLeft: `3px solid ${accentColor}`,
      fontSize: 11,
    }}>
      {/* Icon */}
      <div style={{ paddingTop: 1, flexShrink: 0 }}>
        {isRunning ? (
          <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${accentColor}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        ) : (
          <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke={accentColor} strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
          </svg>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600, color: accentColor, fontFamily: 'monospace', fontSize: 11 }}>{call.name}</span>
          {argSummary && <span style={{ color: 'var(--theme-fg-muted)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{argSummary}</span>}
          <span style={{ fontSize: 9, color: 'var(--theme-fg-muted)', flexShrink: 0 }}>
            {isRunning ? 'running...' : `${durationMs}ms`}
          </span>
          {(call.output || call.error) && (
            <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-fg-muted)', padding: 0, fontSize: 10 }}>
              {expanded ? '▲' : '▼'}
            </button>
          )}
        </div>
        {isError && call.error && (
          <div style={{ fontSize: 10, color: 'var(--theme-error)', marginTop: 2 }}>{call.error.substring(0, 120)}</div>
        )}
        {expanded && call.output && (
          <pre style={{ margin: '4px 0 0', padding: '4px 6px', background: 'var(--theme-bg-secondary)', borderRadius: 3, fontSize: 10, fontFamily: 'monospace', maxHeight: 120, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {call.output.substring(0, 1000)}
          </pre>
        )}
      </div>
    </div>
  );
});

// ── Approval Gate ─────────────────────────────────────────────────────────────

const ApprovalGate: React.FC<{ approval: PendingApproval; onApprove: () => void; onDeny: () => void }> = React.memo(({ approval, onApprove, onDeny }) => {
  const [secondsLeft, setSecondsLeft] = useState(60);

  useEffect(() => {
    const iv = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(iv); onDeny(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [onDeny]);

  return (
    <div style={{
      background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.4)',
      borderRadius: 8, padding: '12px 14px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b' }}>Confirm: {approval.toolName}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--theme-fg-muted)' }}>Auto-deny in {secondsLeft}s</span>
      </div>
      <pre style={{
        background: 'var(--theme-bg-secondary)', borderRadius: 4,
        padding: '6px 8px', fontSize: 10, fontFamily: 'monospace',
        maxHeight: 120, overflow: 'auto', margin: '0 0 10px',
        whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        color: 'var(--theme-fg)',
      }}>
        {JSON.stringify(approval.args, null, 2)}
      </pre>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onApprove}
          style={{ flex: 1, padding: '6px 12px', borderRadius: 5, border: 'none', background: '#22c55e', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
        >
          ✓ Approve
        </button>
        <button
          onClick={onDeny}
          style={{ flex: 1, padding: '6px 12px', borderRadius: 5, border: 'none', background: 'var(--theme-error)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
        >
          ✗ Deny
        </button>
      </div>
    </div>
  );
});

// ── Diff Preview Card ─────────────────────────────────────────────────────────

function computeUnifiedDiff(oldText: string, newText: string): Array<{ type: 'equal' | 'add' | 'remove'; line: string; lineNo: number }> {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: Array<{ type: 'equal' | 'add' | 'remove'; line: string; lineNo: number }> = [];

  // Simple LCS-based diff
  const m = oldLines.length, n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = oldLines[i] === newLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

  let i = 0, j = 0, lineNo = 1;
  while (i < m || j < n) {
    if (i < m && j < n && oldLines[i] === newLines[j]) {
      result.push({ type: 'equal', line: oldLines[i], lineNo: lineNo++ });
      i++; j++;
    } else if (j < n && (i >= m || dp[i + 1][j] <= dp[i][j + 1])) {
      result.push({ type: 'add', line: newLines[j], lineNo: lineNo++ });
      j++;
    } else {
      result.push({ type: 'remove', line: oldLines[i], lineNo });
      i++;
    }
  }
  return result;
}

const DiffPreviewCard: React.FC<{ filePath: string; oldContent: string; newContent: string; onAccept: () => void; onReject: () => void }> = React.memo(({ filePath, oldContent, newContent, onAccept, onReject }) => {
  const diff = React.useMemo(() => computeUnifiedDiff(oldContent, newContent), [oldContent, newContent]);
  const changes = diff.filter(d => d.type !== 'equal').length;

  return (
    <div style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)', borderRadius: 8, margin: '8px 0', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--theme-bg-tertiary)', borderBottom: '1px solid var(--theme-border)' }}>
        <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-fg)', flex: 1 }}>{filePath}</span>
        <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)' }}>{changes} change{changes !== 1 ? 's' : ''}</span>
      </div>
      <div style={{ maxHeight: 280, overflow: 'auto', fontFamily: 'monospace', fontSize: 10 }}>
        {diff.map((d, i) => (
          <div key={i} style={{
            display: 'flex', gap: 8, padding: '0 10px',
            background: d.type === 'add' ? 'rgba(34,197,94,0.1)' : d.type === 'remove' ? 'rgba(239,68,68,0.1)' : 'transparent',
            borderLeft: d.type === 'add' ? '3px solid #22c55e' : d.type === 'remove' ? '3px solid #ef4444' : '3px solid transparent',
          }}>
            <span style={{ color: 'var(--theme-fg-muted)', minWidth: 28, userSelect: 'none' }}>{d.type !== 'remove' ? d.lineNo : ''}</span>
            <span style={{ color: d.type === 'add' ? '#22c55e' : d.type === 'remove' ? '#ef4444' : 'var(--theme-fg-muted)', minWidth: 12 }}>
              {d.type === 'add' ? '+' : d.type === 'remove' ? '-' : ' '}
            </span>
            <span style={{ color: d.type === 'equal' ? 'var(--theme-fg-muted)' : 'var(--theme-fg)', flex: 1, whiteSpace: 'pre' }}>{d.line}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderTop: '1px solid var(--theme-border)' }}>
        <button onClick={onAccept} style={{ flex: 1, padding: '5px 10px', borderRadius: 4, border: 'none', background: '#22c55e', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Accept</button>
        <button onClick={onReject} style={{ flex: 1, padding: '5px 10px', borderRadius: 4, border: 'none', background: 'var(--theme-error)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Reject</button>
      </div>
    </div>
  );
});
const MessageBubble: React.FC<{ message: ChatMessage; agentAvatar?: string; userAvatar?: string; onRetry?: () => void; feedback?: 'up' | 'down'; onFeedback?: (v: 'up' | 'down') => void }> = React.memo(({ message, agentAvatar, userAvatar, onRetry, feedback, onFeedback }) => {
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

        {/* Timestamp + Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <div style={{ fontSize: 9, color: 'var(--theme-fg-muted)', opacity: 0.6, flex: 1 }}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </div>
          {!isUser && !isSystem && onRetry && (
            <button
              onClick={onRetry}
              title="Retry"
              aria-label="Retry this response"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-fg-muted)', padding: '1px 4px', borderRadius: 3, opacity: 0.5, transition: 'opacity 0.15s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.5'; }}
            >
              <svg width={11} height={11} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          {!isUser && !isSystem && onFeedback && (
            <>
              <button
                onClick={() => onFeedback('up')}
                title="Good response"
                aria-label="Good response"
                style={{ background: feedback === 'up' ? 'rgba(34,197,94,0.15)' : 'none', border: 'none', cursor: 'pointer', color: feedback === 'up' ? '#22c55e' : 'var(--theme-fg-muted)', padding: '1px 4px', borderRadius: 3, fontSize: 11, opacity: feedback === 'up' ? 1 : 0.5, transition: 'opacity 0.15s' }}
              >👍</button>
              <button
                onClick={() => onFeedback('down')}
                title="Poor response"
                aria-label="Poor response"
                style={{ background: feedback === 'down' ? 'rgba(239,68,68,0.15)' : 'none', border: 'none', cursor: 'pointer', color: feedback === 'down' ? '#ef4444' : 'var(--theme-fg-muted)', padding: '1px 4px', borderRadius: 3, fontSize: 11, opacity: feedback === 'down' ? 1 : 0.5, transition: 'opacity 0.15s' }}
              >👎</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

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


