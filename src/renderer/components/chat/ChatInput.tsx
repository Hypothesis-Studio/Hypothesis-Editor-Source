/**
 * ChatInput - Compose bar with typing indicators, code/file attach, reply context.
 * Supports @ai mention badge rendering via contenteditable div.
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useChatStore } from '../../stores/chatStore';
import type { ChatMessage } from '../../../shared/types/chat';
import { MAX_FILE_SIZE_BYTES } from '../../../shared/types/chat';

interface Props {
  roomId: string;
  currentUserId?: string;
  isHost?: boolean;
}

const COMMON_LANGUAGES = ['typescript', 'javascript', 'python', 'rust', 'go', 'java', 'cpp', 'csharp', 'html', 'css', 'json', 'bash', 'sql', 'markdown', 'plain text'];

// ── Slash commands (host only) ────────────────────────────────────────────────

interface SlashCommand {
  command: string;
  description: string;
  args?: string;
}

const HOST_SLASH_COMMANDS: SlashCommand[] = [
  { command: '/clear',  description: 'Clear local chat history' },
  { command: '/ai',     description: 'Toggle AI on or off',        args: 'on | off' },
  { command: '/kick',   description: 'Kick a participant by name',  args: '<name>' },
  { command: '/close',  description: 'Close and disconnect room' },
];

const AI_BADGE_HTML = `<span class="chat-ai-badge" contenteditable="false" data-mention="ai">@ai</span>`;
const AI_BADGE_REGEX = /@ai\b/gi;

/** Extract plain text from contenteditable, preserving @ai badges as "@ai" */
function getPlainText(el: HTMLElement): string {
  let text = '';
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.dataset.mention === 'ai') {
        text += '@ai';
      } else if (el.tagName === 'BR') {
        text += '\n';
      } else {
        text += el.textContent ?? '';
      }
    }
  });
  return text;
}

/** Replace @ai occurrences in a text node with badge + remaining text node */
function insertBadgesIntoNode(textNode: Text): void {
  const text = textNode.textContent ?? '';
  const match = AI_BADGE_REGEX.exec(text);
  AI_BADGE_REGEX.lastIndex = 0; // reset after exec
  if (!match) return;

  const parent = textNode.parentNode;
  if (!parent) return;

  // Don't insert badge if already inside a badge span
  if ((parent as HTMLElement).dataset?.mention === 'ai') return;

  const idx = text.search(/@ai\b/i);
  if (idx === -1) return;

  const before = text.slice(0, idx);
  const after = text.slice(idx + 3); // length of "@ai"

  const frag = document.createDocumentFragment();
  if (before) frag.appendChild(document.createTextNode(before));

  const badge = document.createElement('span');
  badge.className = 'chat-ai-badge';
  badge.contentEditable = 'false';
  badge.dataset.mention = 'ai';
  badge.textContent = '@ai';
  frag.appendChild(badge);

  // Place cursor after badge via a zero-width space text node
  const afterNode = document.createTextNode(after || '\u200B');
  frag.appendChild(afterNode);

  parent.replaceChild(frag, textNode);

  // Move cursor to after the badge
  const sel = window.getSelection();
  if (sel) {
    const range = document.createRange();
    range.setStart(afterNode, after ? 0 : 1);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

/** Scan all text nodes in contenteditable and replace @ai with badge */
function processAiBadges(el: HTMLElement): void {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Text | null;
  while ((node = walker.nextNode() as Text)) {
    if (/@ai\b/i.test(node.textContent ?? '')) {
      // skip if already inside badge
      if ((node.parentElement as HTMLElement)?.dataset?.mention !== 'ai') {
        textNodes.push(node);
      }
    }
  }
  // Process in reverse to avoid invalidating tree walker
  for (let i = textNodes.length - 1; i >= 0; i--) {
    insertBadgesIntoNode(textNodes[i]);
  }
}

/** Set innerHTML of contenteditable from plain text, converting @ai to badges */
function setContentFromDraft(el: HTMLElement, text: string): void {
  if (!text) { el.innerHTML = ''; return; }
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  const withBadges = escaped.replace(/@ai\b/gi, AI_BADGE_HTML);
  el.innerHTML = withBadges;
}

export const ChatInput: React.FC<Props> = ({ roomId, currentUserId, isHost }) => {
  const { draftMessages, setDraft, sendMessage, sendCode, sendFile, sendTyping, replyingTo, setReplyingTo, clearMessages, toggleAi, closeRoom, kickUser, rooms } = useChatStore();
  const draft = draftMessages[roomId] ?? '';
  const replyTo = replyingTo[roomId] ?? null;
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const isComposingRef = useRef(false); // IME composition guard
  const isSyncingRef = useRef(false); // prevent feedback loop

  const [mode, setMode] = useState<'text' | 'code'>('text');
  const [codeLang, setCodeLang] = useState('typescript');
  const [fileError, setFileError] = useState<string | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [slashSuggestions, setSlashSuggestions] = useState<SlashCommand[]>([]);
  const [slashIndex, setSlashIndex] = useState(0);

  // Sync draft → contenteditable only on external changes (e.g. room switch)
  useEffect(() => {
    const el = editorRef.current;
    if (!el || isSyncingRef.current) return;
    const current = getPlainText(el);
    if (current !== draft) {
      setContentFromDraft(el, draft);
      setIsEmpty(!draft);
    }
  }, [roomId]); // only on room switch

  const stopTyping = useCallback(() => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendTyping(roomId, false);
    }
    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
  }, [roomId, sendTyping]);

  const handleInput = useCallback(() => {
    if (isComposingRef.current) return;
    const el = editorRef.current;
    if (!el) return;

    // Process @ai badges on input
    processAiBadges(el);

    // Sync plain text to store
    isSyncingRef.current = true;
    const text = getPlainText(el).replace(/\u200B/g, ''); // strip zero-width spaces
    setDraft(roomId, text);
    setIsEmpty(!text.trim());
    isSyncingRef.current = false;

    // Slash command suggestions (host only)
    if (isHost && text.startsWith('/')) {
      const query = text.toLowerCase();
      const matches = HOST_SLASH_COMMANDS.filter(c => c.command.startsWith(query));
      setSlashSuggestions(matches);
      setSlashIndex(0);
    } else {
      setSlashSuggestions([]);
    }

    // Typing indicator
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTyping(roomId, true);
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(stopTyping, 2500);
  }, [roomId, setDraft, sendTyping, stopTyping, isHost]);

  useEffect(() => () => stopTyping(), [stopTyping]);

  const clearEditor = useCallback(() => {
    const el = editorRef.current;
    if (el) { el.innerHTML = ''; el.focus(); }
    setIsEmpty(true);
    isSyncingRef.current = true;
    setDraft(roomId, '');
    isSyncingRef.current = false;
  }, [roomId, setDraft]);

  const executeSlashCommand = useCallback(async (cmd: string) => {
    const parts = cmd.trim().split(/\s+/);
    const base = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ').trim();
    clearEditor();
    setSlashSuggestions([]);
    if (base === '/clear') {
      clearMessages(roomId);
    } else if (base === '/ai') {
      if (arg === 'on') await toggleAi(roomId, true);
      else if (arg === 'off') await toggleAi(roomId, false);
    } else if (base === '/kick') {
      if (arg) {
        const room = rooms.find(r => r.id === roomId);
        const target = room?.participants.find(u => u.name.toLowerCase() === arg.toLowerCase() && u.role !== 'host');
        if (target) await kickUser(roomId, target.id);
      }
    } else if (base === '/close') {
      await closeRoom(roomId);
    }
  }, [roomId, clearEditor, clearMessages, toggleAi, kickUser, closeRoom, rooms]);

  const applySuggestion = useCallback((cmd: SlashCommand) => {
    const el = editorRef.current;
    if (!el) return;
    const fill = cmd.args ? `${cmd.command} ` : cmd.command;
    el.textContent = fill;
    setIsEmpty(false);
    isSyncingRef.current = true;
    setDraft(roomId, fill);
    isSyncingRef.current = false;
    setSlashSuggestions([]);
    // Move cursor to end
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
    el.focus();
    // If no args needed, execute immediately
    if (!cmd.args) executeSlashCommand(cmd.command);
  }, [roomId, setDraft, executeSlashCommand]);

  const handleSend = useCallback(async () => {
    const el = editorRef.current;
    if (!el) return;
    const text = getPlainText(el).replace(/\u200B/g, '').trim();
    if (!text) return;
    stopTyping();
    // Slash command execution
    if (isHost && text.startsWith('/')) {
      await executeSlashCommand(text);
      return;
    }
    if (mode === 'code') {
      await sendCode(roomId, text, codeLang);
    } else {
      isSyncingRef.current = true;
      setDraft(roomId, text);
      isSyncingRef.current = false;
      await sendMessage(roomId, text);
    }
    clearEditor();
  }, [mode, codeLang, roomId, sendMessage, sendCode, stopTyping, clearEditor, setDraft, isHost, executeSlashCommand]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Navigate slash suggestions
    if (slashSuggestions.length > 0) {
      if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex(i => Math.max(0, i - 1)); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex(i => Math.min(slashSuggestions.length - 1, i + 1)); return; }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        applySuggestion(slashSuggestions[slashIndex]);
        return;
      }
      if (e.key === 'Escape') { setSlashSuggestions([]); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && !isComposingRef.current) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape' && replyTo) {
      setReplyingTo(roomId, null);
    }
  }, [handleSend, replyTo, roomId, setReplyingTo, slashSuggestions, slashIndex, applySuggestion]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

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

  const canSend = !isEmpty;
  const placeholder = mode === 'code'
    ? `Paste code here… (${codeLang})`
    : 'Message…  (Enter to send · Shift+Enter for newline · @ai to ask AI)';

  return (
    <div style={{ padding: '8px 12px 10px', borderTop: '1px solid var(--theme-border)', background: 'var(--theme-bg)', flexShrink: 0 }}>

      {/* Reply context */}
      {replyTo && <ReplyBanner msg={replyTo} onDismiss={() => setReplyingTo(roomId, null)} />}

      {/* Slash command suggestions */}
      {slashSuggestions.length > 0 && (
        <div style={{
          position: 'relative', marginBottom: 4,
        }}>
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'var(--theme-bg-secondary)',
            border: '1px solid var(--theme-border)',
            borderRadius: 6, overflow: 'hidden',
            boxShadow: '0 -4px 16px rgba(0,0,0,0.2)',
            zIndex: 100,
          }}>
            <div style={{ padding: '4px 10px 3px', fontSize: 10, color: 'var(--theme-fg-muted)', fontWeight: 600, borderBottom: '1px solid var(--theme-border)', letterSpacing: '0.05em' }}>
              COMMANDS
            </div>
            {slashSuggestions.map((cmd, i) => (
              <div
                key={cmd.command}
                onClick={() => applySuggestion(cmd)}
                style={{
                  padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                  background: i === slashIndex ? 'var(--theme-bg-active, var(--theme-bg-tertiary))' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={() => setSlashIndex(i)}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--theme-accent)', fontFamily: 'var(--font-mono, monospace)', minWidth: 80 }}>
                  {cmd.command}{cmd.args ? ` ${cmd.args}` : ''}
                </span>
                <span style={{ fontSize: 11, color: 'var(--theme-fg-muted)' }}>{cmd.description}</span>
              </div>
            ))}
          </div>
        </div>
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
            onClick={() => setMode('text')}
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
        onFocusCapture={(e) => { if (mode !== 'code') e.currentTarget.style.borderColor = 'var(--theme-accent)'; }}
        onBlurCapture={(e) => { if (mode !== 'code') e.currentTarget.style.borderColor = 'var(--theme-border)'; }}
      >
        {/* Contenteditable editor */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          {/* Placeholder */}
          {isEmpty && (
            <div style={{
              position: 'absolute', top: 0, left: 0, pointerEvents: 'none',
              fontSize: 13, color: 'var(--theme-fg-muted)', lineHeight: 1.55,
              userSelect: 'none', opacity: 0.5, whiteSpace: 'nowrap', overflow: 'hidden',
              maxWidth: '100%', textOverflow: 'ellipsis',
            }}>
              {placeholder}
            </div>
          )}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={() => { isComposingRef.current = false; handleInput(); }}
            spellCheck
            style={{
              outline: 'none', fontSize: 13, lineHeight: 1.55,
              color: 'var(--theme-fg)', minHeight: 22, maxHeight: 160,
              overflowY: 'auto', wordBreak: 'break-word',
              fontFamily: mode === 'code' ? 'var(--font-mono, monospace)' : 'inherit',
              whiteSpace: 'pre-wrap',
            }}
          />
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
          <ComposeBtn
            title={mode === 'code' ? 'Switch to text mode' : 'Send code snippet'}
            onClick={() => setMode(mode === 'code' ? 'text' : 'code')}
            active={mode === 'code'}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 4L1 8l4 4M11 4l4 4-4 4" />
            </svg>
          </ComposeBtn>

          <ComposeBtn title="Attach file (max 2 MB)" onClick={() => fileInputRef.current?.click()}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13.5 8.5l-6 6a4 4 0 01-5.66-5.66l7-7a2.5 2.5 0 013.54 3.54l-7 7a1 1 0 01-1.42-1.42l6-6" />
            </svg>
          </ComposeBtn>

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

// ── Reply banner ───────────────────────────────────────────────────────────────

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

// ── Compose button ─────────────────────────────────────────────────────────────

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
    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--theme-bg-tertiary)'; e.currentTarget.style.color = 'var(--theme-fg)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = active ? 'var(--theme-accent)22' : 'none'; e.currentTarget.style.color = active ? 'var(--theme-accent)' : 'var(--theme-fg-muted)'; }}
  >
    {children}
  </button>
);
