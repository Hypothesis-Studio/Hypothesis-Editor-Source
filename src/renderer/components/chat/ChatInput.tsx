/**
 * ChatInput - Compose bar with typing indicators, code/file attach, reply context.
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useChatStore } from '../../stores/chatStore';
import type { ChatMessage } from '../../../shared/types/chat';
import { MAX_FILE_SIZE_BYTES } from '../../../shared/types/chat';

interface Props {
  roomId: string;
  currentUserId?: string;
}

const COMMON_LANGUAGES = ['typescript', 'javascript', 'python', 'rust', 'go', 'java', 'cpp', 'csharp', 'html', 'css', 'json', 'bash', 'sql', 'markdown', 'plain text'];

export const ChatInput: React.FC<Props> = ({ roomId, currentUserId }) => {
  const { draftMessages, setDraft, sendMessage, sendCode, sendFile, sendTyping, replyingTo, setReplyingTo } = useChatStore();
  const draft = draftMessages[roomId] ?? '';
  const replyTo = replyingTo[roomId] ?? null;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const [mode, setMode] = useState<'text' | 'code'>('text');
  const [codeLang, setCodeLang] = useState('typescript');
  const [fileError, setFileError] = useState<string | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [draft]);

  const stopTyping = useCallback(() => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendTyping(roomId, false);
    }
    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
  }, [roomId, sendTyping]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(roomId, e.target.value);
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTyping(roomId, true);
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(stopTyping, 2500);
  }, [roomId, setDraft, sendTyping, stopTyping]);

  // Cleanup on unmount
  useEffect(() => () => stopTyping(), [stopTyping]);

  const handleSend = useCallback(async () => {
    if (!draft.trim()) return;
    stopTyping();
    if (mode === 'code') {
      await sendCode(roomId, draft, codeLang);
    } else {
      await sendMessage(roomId, draft);
    }
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    textareaRef.current?.focus();
  }, [draft, mode, codeLang, roomId, sendMessage, sendCode, stopTyping]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape' && replyTo) { setReplyingTo(roomId, null); }
  }, [handleSend, replyTo, roomId, setReplyingTo]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError(`File too large. Max size is ${(MAX_FILE_SIZE_BYTES / 1024 / 1024).toFixed(0)} MB.`);
      e.target.value = '';
      return;
    }
    const result = await sendFile(roomId, file);
    if (result.error) setFileError(result.error);
    e.target.value = '';
  }, [roomId, sendFile]);

  const canSend = draft.trim().length > 0;

  return (
    <div style={{ padding: '8px 12px 10px', borderTop: '1px solid var(--theme-border)', background: 'var(--theme-bg)', flexShrink: 0 }}>

      {/* Reply context */}
      {replyTo && (
        <ReplyBanner msg={replyTo} onDismiss={() => setReplyingTo(roomId, null)} />
      )}

      {/* Code mode header */}
      {mode === 'code' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--theme-fg-muted)', fontWeight: 600 }}>CODE</span>
          <select
            value={codeLang}
            onChange={(e) => setCodeLang(e.target.value)}
            style={{
              fontSize: 11, background: 'var(--theme-bg-secondary)',
              border: '1px solid var(--theme-border)', borderRadius: 4,
              color: 'var(--theme-fg)', padding: '2px 6px', cursor: 'pointer', outline: 'none',
            }}
          >
            {COMMON_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <button
            onClick={() => { setMode('text'); }}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-fg-muted)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
            Exit code mode
          </button>
        </div>
      )}

      {/* Compose box */}
      <div
        style={{
          display: 'flex', alignItems: 'flex-end', gap: 6,
          background: mode === 'code' ? 'var(--theme-bg-tertiary)' : 'var(--theme-bg-secondary)',
          border: `1px solid ${mode === 'code' ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
          borderRadius: 8, padding: '6px 8px 6px 12px', transition: 'border-color 0.15s',
        }}
        onFocusCapture={(e) => { if (mode !== 'code') (e.currentTarget.style.borderColor = 'var(--theme-accent)'); }}
        onBlurCapture={(e) => { if (mode !== 'code') (e.currentTarget.style.borderColor = 'var(--theme-border)'); }}
      >
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={mode === 'code' ? `Paste code here… (${codeLang})` : 'Message…  (Enter to send · Shift+Enter for newline · @ai to ask AI)'}
          rows={1}
          style={{
            flex: 1, resize: 'none', background: 'transparent',
            border: 'none', outline: 'none', fontSize: 13,
            color: 'var(--theme-fg)', lineHeight: 1.55, maxHeight: 160,
            overflowY: 'auto', fontFamily: mode === 'code' ? 'var(--font-mono, monospace)' : 'inherit',
            padding: 0,
          }}
        />

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
          {/* Code snippet toggle */}
          <ComposeBtn
            title={mode === 'code' ? 'Switch to text mode' : 'Send code snippet'}
            onClick={() => setMode(mode === 'code' ? 'text' : 'code')}
            active={mode === 'code'}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 4L1 8l4 4M11 4l4 4-4 4" />
            </svg>
          </ComposeBtn>

          {/* File attach */}
          <ComposeBtn title="Attach file (max 2 MB)" onClick={() => fileInputRef.current?.click()}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13.5 8.5l-6 6a4 4 0 01-5.66-5.66l7-7a2.5 2.5 0 013.54 3.54l-7 7a1 1 0 01-1.42-1.42l6-6" />
            </svg>
          </ComposeBtn>

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            title="Send (Enter)"
            style={{
              width: 34, height: 34, borderRadius: 6, border: 'none',
              background: canSend ? 'var(--theme-accent)' : 'var(--theme-bg-tertiary)',
              color: canSend ? '#fff' : 'var(--theme-fg-muted)',
              cursor: canSend ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background 0.15s, color 0.15s',
            }}
          >
            <svg width={15} height={15} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-4-4l4 4-4 4" />
            </svg>
          </button>
        </div>
      </div>

      {/* File error */}
      {fileError && (
        <div style={{ marginTop: 4, fontSize: 11, color: '#f48771', paddingLeft: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M8 2L1 14h14L8 2z" /><path d="M8 7v3M8 12v.5" />
          </svg>
          {fileError}
          <button onClick={() => setFileError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, marginLeft: 2, display: 'flex', alignItems: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </div>
      )}

      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileSelect} />
    </div>
  );
};

// ── Reply banner ──────────────────────────────────────────────────────────────

const ReplyBanner: React.FC<{ msg: ChatMessage; onDismiss: () => void }> = ({ msg, onDismiss }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--theme-bg-secondary)', borderRadius: '6px 6px 0 0',
    borderLeft: '3px solid var(--theme-accent)',
    padding: '5px 10px', marginBottom: 0,
    borderBottom: '1px solid var(--theme-border)',
  }}>
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--theme-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3L3 8l5 5M13 8H3" />
    </svg>
    <div style={{ flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--theme-accent)' }}>{msg.senderName}</span>
      <span style={{ fontSize: 11, color: 'var(--theme-fg-muted)', marginLeft: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: 300, verticalAlign: 'bottom' }}>
        {msg.content.substring(0, 80)}
      </span>
    </div>
    <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-fg-muted)', padding: '2px 4px', borderRadius: 4, display: 'flex', alignItems: 'center' }}>
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
    </button>
  </div>
);

// ── Compose button ────────────────────────────────────────────────────────────

const ComposeBtn: React.FC<{ title: string; onClick: () => void; active?: boolean; children: React.ReactNode }> = ({ title, onClick, active, children }) => (
  <button
    title={title}
    onClick={onClick}
    style={{
      width: 30, height: 30, borderRadius: 5, border: 'none',
      background: active ? 'var(--theme-accent)22' : 'none',
      color: active ? 'var(--theme-accent)' : 'var(--theme-fg-muted)',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'background 0.12s, color 0.12s',
    }}
    onMouseEnter={(e) => { (e.currentTarget.style.background = 'var(--theme-bg-tertiary)'); (e.currentTarget.style.color = 'var(--theme-fg)'); }}
    onMouseLeave={(e) => { (e.currentTarget.style.background = active ? 'var(--theme-accent)22' : 'none'); (e.currentTarget.style.color = active ? 'var(--theme-accent)' : 'var(--theme-fg-muted)'); }}
  >
    {children}
  </button>
);
