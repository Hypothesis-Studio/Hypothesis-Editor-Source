/**
 * ChatInput - Clean compose bar with auto-resize textarea.
 */
import React, { useRef, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';

interface Props {
  roomId: string;
}

export const ChatInput: React.FC<Props> = ({ roomId }) => {
  const { draftMessages, setDraft, sendMessage } = useChatStore();
  const draft = draftMessages[roomId] ?? '';
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [draft]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (!draft.trim()) return;
    await sendMessage(roomId, draft);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    textareaRef.current?.focus();
  };

  const canSend = draft.trim().length > 0;

  return (
    <div style={{
      padding: '10px 12px',
      borderTop: '1px solid var(--theme-border)',
      background: 'var(--theme-bg)',
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        background: 'var(--theme-bg-secondary)',
        border: '1px solid var(--theme-border)',
        borderRadius: 8,
        padding: '6px 8px 6px 12px',
        transition: 'border-color 0.15s',
      }}
      onFocusCapture={(e) => (e.currentTarget.style.borderColor = 'var(--theme-accent)')}
      onBlurCapture={(e) => (e.currentTarget.style.borderColor = 'var(--theme-border)')}
      >
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(roomId, e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message…  (Enter to send · Shift+Enter for newline)"
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 13,
            color: 'var(--theme-fg)',
            lineHeight: 1.55,
            maxHeight: 120,
            overflowY: 'auto',
            fontFamily: 'inherit',
            padding: 0,
          }}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          title="Send (Enter)"
          style={{
            width: 36,
            height: 36,
            borderRadius: 6,
            border: 'none',
            background: 'var(--theme-accent)',
            color: '#fff',
            cursor: canSend ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: canSend ? 1 : 0.4,
            transition: 'opacity 0.15s',
          }}
        >
          <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-4-4l4 4-4 4" />
          </svg>
        </button>
      </div>
      <div style={{ marginTop: 4, fontSize: 10, color: 'var(--theme-fg-muted)', paddingLeft: 4 }}>
        Enter to send · Shift+Enter for newline
      </div>
    </div>
  );
};
