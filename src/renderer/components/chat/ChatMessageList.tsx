/**
 * ChatMessageList - Full-featured message list with code snippets, file previews,
 * reactions, reply context, read receipts, typing indicators, and AI messages.
 * All UI uses SVG icons, no emoji in UI chrome.
 */
import React, { useEffect, useRef, useState, useCallback, memo, useMemo } from 'react';
import type { ChatMessage } from '../../../shared/types/chat';
import { useChatStore } from '../../stores/chatStore';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked
marked.setOptions({ breaks: true, gfm: true });

/** Render markdown to sanitized HTML */
function renderMarkdown(content: string): string {
  const raw = marked.parse(content) as string;
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ['p','br','strong','em','code','pre','blockquote','ul','ol','li','h1','h2','h3','h4','h5','h6','a','hr','del','table','thead','tbody','tr','th','td'],
    ALLOWED_ATTR: ['href','target','rel'],
    FORCE_BODY: true,
  });
}

interface Props {
  messages: ChatMessage[];
  roomId: string;
  currentUserId?: string;
}

const REACTION_OPTIONS = [
  { emoji: '👍', label: 'thumbs-up' },
  { emoji: '❤️', label: 'heart' },
  { emoji: '😂', label: 'laugh' },
  { emoji: '😮', label: 'surprised' },
  { emoji: '😢', label: 'sad' },
  { emoji: '🔥', label: 'fire' },
  { emoji: '✅', label: 'check' },
  { emoji: '👎', label: 'thumbs-down' },
];

export const ChatMessageList: React.FC<Props> = ({ messages, roomId, currentUserId }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(0);
  const { roomUI, addReaction, markRead, setReplyingTo } = useChatStore();
  const typingUsers = roomUI[roomId]?.typingUsers ?? {};
  const typingList = Object.values(typingUsers).filter((u) => u.name);
  const hasAiTyping = typingList.some((u) => u.name === 'AI Assistant');

  useEffect(() => {
    if (messages.length > prevLenRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      // Mark last message as read
      const last = messages[messages.length - 1];
      if (last && last.senderId !== currentUserId && last.senderId !== 'system') {
        markRead(roomId, last.id);
      }
    }
    prevLenRef.current = messages.length;
  }, [messages.length, roomId, currentUserId, markRead]);

  if (messages.length === 0 && typingList.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 12, color: 'var(--theme-fg-muted)', padding: 24, textAlign: 'center',
      }}>
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity={0.3}>
          <path d="M4 8a4 4 0 014-4h28a4 4 0 014 4v20a4 4 0 01-4 4H14l-8 8V8z" />
          <path d="M13 17h18M13 23h12" />
        </svg>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>No messages yet</div>
          <div style={{ fontSize: 11, marginTop: 4, opacity: 0.65 }}>Be the first to say something</div>
        </div>
      </div>
    );
  }

  const groups = groupMessages(messages);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {groups.map((group, gi) =>
        group.isSystem
          ? <SystemDivider key={`sys-${gi}`} messages={group.messages} />
          : (
            <BubbleGroup
              key={`grp-${gi}`}
              group={group}
              isSelf={group.senderId === currentUserId}
              isAi={group.senderId === 'ai'}
              roomId={roomId}
              currentUserId={currentUserId}
              onReact={(msgId, emoji) => addReaction(roomId, msgId, emoji)}
              onReply={(msg) => setReplyingTo(roomId, msg)}
            />
          )
      )}

      {/* Typing indicator */}
      {typingList.length > 0 && (
        <TypingIndicator users={typingList} currentUserId={currentUserId} />
      )}

      <div ref={bottomRef} />
    </div>
  );
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface MsgGroup {
  senderId: string;
  senderName: string;
  senderColor: string;
  timestamp: string;
  messages: ChatMessage[];
  isSystem: boolean;
  isAi: boolean;
}

function groupMessages(messages: ChatMessage[]): MsgGroup[] {
  const groups: MsgGroup[] = [];
  for (const msg of messages) {
    const isSystem = msg.type === 'system' || msg.senderId === 'system';
    const isAi = msg.senderId === 'ai' || msg.type === 'ai';
    const last = groups[groups.length - 1];
    const timeDiff = last ? new Date(msg.timestamp).getTime() - new Date(last.timestamp).getTime() : Infinity;
    if (last && last.senderId === msg.senderId && !last.isSystem && !isSystem && timeDiff < 2 * 60 * 1000) {
      last.messages.push(msg);
    } else {
      groups.push({ senderId: msg.senderId, senderName: msg.senderName, senderColor: msg.senderColor, timestamp: msg.timestamp, messages: [msg], isSystem, isAi: isAi });
    }
  }
  return groups;
}

// ── Bubble group ──────────────────────────────────────────────────────────────

interface BubbleGroupProps {
  group: MsgGroup;
  isSelf: boolean;
  isAi: boolean;
  roomId: string;
  currentUserId?: string;
  onReact: (msgId: string, emoji: string) => void;
  onReply: (msg: ChatMessage) => void;
}

const BubbleGroup = memo<BubbleGroupProps>(({ group, isSelf, isAi, roomId, currentUserId, onReact, onReply }) => {
  const time = new Date(group.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ display: 'flex', flexDirection: isSelf ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, marginTop: 8 }}>
      {/* Avatar */}
      {!isSelf && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: isAi ? 'linear-gradient(135deg, #c586c0, #9cdcfe)' : group.senderColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: isAi ? 11 : 11, fontWeight: 700, color: '#fff', flexShrink: 0,
          marginBottom: 2, boxShadow: `0 0 0 2px var(--theme-bg)`,
        }}>
          {isAi ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="8" width="18" height="12" rx="2" />
              <path d="M9 8V6a3 3 0 016 0v2" />
              <circle cx="9" cy="14" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="15" cy="14" r="1.5" fill="currentColor" stroke="none" />
              <path d="M9 18h6" />
              <path d="M12 2v2" />
            </svg>
          ) : (
            group.senderName.charAt(0).toUpperCase()
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isSelf ? 'flex-end' : 'flex-start', maxWidth: '74%', gap: 2 }}>
        {/* Sender label */}
        {!isSelf && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, paddingLeft: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: isAi ? '#c586c0' : group.senderColor }}>{group.senderName}</span>
            {isAi && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 6, background: '#c586c022', color: '#c586c0', border: '1px solid #c586c033', fontWeight: 700 }}>AI</span>}
            <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)', opacity: 0.7 }}>{time}</span>
          </div>
        )}

        {/* Bubbles */}
        {group.messages.map((msg, i) => {
          const isFirst = i === 0;
          const isLast = i === group.messages.length - 1;
          return (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isSelf={isSelf}
              isAi={isAi}
              isFirst={isFirst}
              isLast={isLast}
              currentUserId={currentUserId}
              onReact={onReact}
              onReply={onReply}
            />
          );
        })}

        {/* Timestamp for self */}
        {isSelf && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingRight: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)', opacity: 0.6 }}>{time}</span>
            {/* Read receipt for last message */}
            {group.messages[group.messages.length - 1]?.readBy && (group.messages[group.messages.length - 1].readBy!.length > 1) && (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#89d185" strokeWidth="2" strokeLinecap="round">
                <path d="M1 8l4 4 6-7M6 8l4 4 6-7" />
              </svg>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// ── Single bubble ─────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  msg: ChatMessage;
  isSelf: boolean;
  isAi: boolean;
  isFirst: boolean;
  isLast: boolean;
  currentUserId?: string;
  onReact: (msgId: string, emoji: string) => void;
  onReply: (msg: ChatMessage) => void;
}

const MessageBubble = memo<MessageBubbleProps>(({ msg, isSelf, isAi, isFirst, isLast, currentUserId, onReact, onReply }) => {
  const [showEmoji, setShowEmoji] = useState(false);
  const [hover, setHover] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHover(true);
  }, []);
  const handleMouseLeave = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => { setHover(false); setShowEmoji(false); }, 200);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const radius = isSelf
    ? `${isFirst ? 14 : 6}px ${isFirst ? 6 : 14}px ${isLast ? 4 : 6}px ${isLast ? 14 : 6}px`
    : `${isFirst ? 6 : 14}px ${isFirst ? 14 : 6}px ${isLast ? 14 : 6}px ${isLast ? 4 : 6}px`;

  const bgColor = isAi
    ? 'linear-gradient(135deg, var(--theme-bg-secondary) 0%, #c586c011 100%)'
    : isSelf
      ? 'var(--theme-accent)'
      : 'var(--theme-bg-secondary)';

  const hasReactions = msg.reactions && Object.keys(msg.reactions).length > 0;

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative', maxWidth: '100%' }}
    >
      {/* Reply context */}
      {msg.replyToId && msg.replyToContent && (
        <div style={{
          fontSize: 11, color: 'var(--theme-fg-muted)',
          borderLeft: `2px solid ${isSelf ? 'rgba(255,255,255,0.4)' : 'var(--theme-accent)'}`,
          paddingLeft: 7, marginBottom: 3,
          opacity: 0.8, fontStyle: 'italic',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: 280,
        }}>
          <span style={{ fontWeight: 600, fontStyle: 'normal' }}>{msg.replyToSenderName}</span>
          {' · '}{msg.replyToContent}
        </div>
      )}

      {/* Bubble */}
      <div
        title={new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        style={{
          padding: msg.type === 'code' ? '10px 12px' : '7px 12px',
          borderRadius: radius,
          background: bgColor,
          color: isSelf && !isAi ? '#fff' : 'var(--theme-fg)',
          fontSize: 13, lineHeight: 1.55, wordBreak: 'break-word',
          boxShadow: isSelf && !isAi ? '0 1px 4px rgba(0,0,0,0.18)' : '0 1px 3px rgba(0,0,0,0.10)',
          border: isSelf && !isAi ? 'none' : `1px solid ${isAi ? '#c586c033' : 'var(--theme-border)'}`,
          position: 'relative', userSelect: 'text', cursor: 'text',
        }}
      >
        {msg.type === 'code' ? (
          <CodeBlock content={msg.content} language={msg.language} isSelf={isSelf} />
        ) : msg.type === 'file' ? (
          <FileBlock msg={msg} isSelf={isSelf} />
        ) : (
          <MarkdownContent content={msg.content} isSelf={isSelf && !isAi} />
        )}
        {msg.edited && (
          <span style={{ fontSize: 9, opacity: 0.5, marginLeft: 6, fontStyle: 'italic' }}>(edited)</span>
        )}
      </div>

      {/* Reactions */}
      {hasReactions && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3, justifyContent: isSelf ? 'flex-end' : 'flex-start' }}>
          {Object.entries(msg.reactions!).map(([emoji, users]) => (
            <ReactionChip
              key={emoji}
              emoji={emoji}
              count={users.length}
              reacted={currentUserId ? users.includes(currentUserId) : false}
              onClick={() => onReact(msg.id, emoji)}
            />
          ))}
        </div>
      )}

      {/* Hover actions */}
      {hover && (
        <div style={{
          position: 'absolute', top: -34,
          [isSelf ? 'left' : 'right']: 0,
          display: 'flex', alignItems: 'center', gap: 2,
          background: 'var(--theme-bg)', border: '1px solid var(--theme-border)',
          borderRadius: 8, padding: '3px 6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)', zIndex: 10,
          whiteSpace: 'nowrap',
        }}>
          {/* React toggle */}
          <ActionBtn title="React" onClick={() => setShowEmoji((v) => !v)}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="6" />
              <circle cx="6" cy="7" r="0.8" fill="currentColor" />
              <circle cx="10" cy="7" r="0.8" fill="currentColor" />
              <path d="M5 10c.5 1 1.5 1.5 3 1.5s2.5-.5 3-1.5" />
            </svg>
          </ActionBtn>
          {/* Reply */}
          <ActionBtn title="Reply" onClick={() => onReply(msg)}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3L3 8l5 5M13 8H3" />
            </svg>
          </ActionBtn>

          {/* Emoji picker */}
          {showEmoji && (
            <div style={{
              position: 'absolute', top: 32,
              [isSelf ? 'left' : 'right']: 0,
              display: 'flex', gap: 3,
              background: 'var(--theme-bg)', border: '1px solid var(--theme-border)',
              borderRadius: 8, padding: '5px 7px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.22)', zIndex: 20,
            }}>
              {REACTION_OPTIONS.map((r) => (
                <button
                  key={r.emoji}
                  onClick={() => { onReact(msg.id, r.emoji); setShowEmoji(false); setHover(false); }}
                  title={r.label}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 16, padding: '2px 3px', borderRadius: 5,
                    transition: 'transform 0.1s',
                  }}
                  onMouseEnter={(ev) => { ev.currentTarget.style.transform = 'scale(1.3)'; }}
                  onMouseLeave={(ev) => { ev.currentTarget.style.transform = 'scale(1)'; }}
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ── Markdown content ─────────────────────────────────────────────────────────

const MarkdownContent: React.FC<{ content: string; isSelf: boolean }> = ({ content, isSelf }) => {
  const html = useMemo(() => renderMarkdown(content), [content]);
  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        // Reset aggressive margins from browser defaults
        lineHeight: 1.6,
        color: isSelf ? '#fff' : 'var(--theme-fg)',
      }}
      className={`chat-md${isSelf ? ' chat-md-self' : ''}`}
    />
  );
};

// ── Code block ────────────────────────────────────────────────────────────────

const CodeBlock: React.FC<{ content: string; language?: string; isSelf: boolean }> = ({ content, language, isSelf }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }, [content]);

  return (
    <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, opacity: 0.7 }}>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{language ?? 'code'}</span>
        <button
          onClick={handleCopy}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, opacity: 0.8, padding: '1px 4px', borderRadius: 4 }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8'; }}
        >
          {copied
            ? <><svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="#89d185" strokeWidth="2.2" strokeLinecap="round"><path d="M3 8l4 4 6-7" /></svg> Copied</>
            : <><svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="5" y="5" width="9" height="10" rx="1.5" /><path d="M3 11H2a1 1 0 01-1-1V2a1 1 0 011-1h8a1 1 0 011 1v2" /></svg> Copy</>
          }
        </button>
      </div>
      <pre style={{
        margin: 0, overflowX: 'auto', whiteSpace: 'pre',
        background: isSelf ? 'rgba(0,0,0,0.15)' : 'var(--theme-bg)',
        borderRadius: 5, padding: '8px 10px',
        maxHeight: 320, fontSize: 12, lineHeight: 1.5,
        userSelect: 'text', cursor: 'text',
      }}>
        <code style={{ userSelect: 'text' }}>{content}</code>
      </pre>
    </div>
  );
};

// ── File block ────────────────────────────────────────────────────────────────

const FileBlock: React.FC<{ msg: ChatMessage; isSelf: boolean }> = ({ msg, isSelf }) => {
  const isImage = msg.fileMimeType?.startsWith('image/');
  const sizeStr = msg.fileSize ? `${(msg.fileSize / 1024).toFixed(1)} KB` : '';

  const handleDownload = useCallback(async () => {
    if (!msg.fileData) return;
    const api = (window as any).api;
    // Use Electron dialog to save to Downloads folder (cross-platform: Win/Mac/Linux)
    if (api?.chat?.downloadFile) {
      await api.chat.downloadFile(msg.fileName ?? 'file', msg.fileData, msg.fileMimeType ?? 'application/octet-stream');
    } else {
      // Fallback for non-Electron environments
      const a = document.createElement('a');
      a.href = `data:${msg.fileMimeType};base64,${msg.fileData}`;
      a.download = msg.fileName ?? 'file';
      a.click();
    }
  }, [msg]);

  if (isImage && msg.fileData) {
    return (
      <div>
        <img
          src={`data:${msg.fileMimeType};base64,${msg.fileData}`}
          alt={msg.fileName}
          style={{ maxWidth: 260, maxHeight: 200, borderRadius: 6, display: 'block', cursor: 'pointer' }}
          onClick={handleDownload}
        />
        <div style={{ fontSize: 10, opacity: 0.65, marginTop: 4 }}>{msg.fileName} · {sizeStr}</div>
      </div>
    );
  }

  return (
    <button
      onClick={handleDownload}
      disabled={!msg.fileData}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        background: isSelf ? 'rgba(0,0,0,0.12)' : 'var(--theme-bg)',
        border: `1px solid ${isSelf ? 'rgba(255,255,255,0.2)' : 'var(--theme-border)'}`,
        borderRadius: 7, padding: '8px 12px', cursor: msg.fileData ? 'pointer' : 'default',
        color: 'inherit', width: '100%', textAlign: 'left', minWidth: 180,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
        {msg.fileData && <path d="M12 12v6M9 15l3 3 3-3" />}
      </svg>
      <div>
        <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{msg.fileName}</div>
        <div style={{ fontSize: 10, opacity: 0.6, marginTop: 1 }}>{sizeStr}{!msg.fileData ? ' · Not available offline' : ''}</div>
      </div>
    </button>
  );
};

// ── Reaction chip ─────────────────────────────────────────────────────────────

const ReactionChip: React.FC<{ emoji: string; count: number; reacted: boolean; onClick: () => void }> = ({ emoji, count, reacted, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      background: reacted ? 'var(--theme-accent)22' : 'var(--theme-bg-secondary)',
      border: `1px solid ${reacted ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
      borderRadius: 12, padding: '2px 7px', cursor: 'pointer',
      fontSize: 12, color: 'var(--theme-fg)', fontWeight: reacted ? 600 : 400,
      transition: 'background 0.1s, border-color 0.1s',
    }}
  >
    <span>{emoji}</span>
    <span style={{ fontSize: 10, opacity: 0.85 }}>{count}</span>
  </button>
);

// ── Typing indicator ──────────────────────────────────────────────────────────

const TypingIndicator: React.FC<{ users: Array<{ name: string; since: number }>; currentUserId?: string }> = ({ users, currentUserId }) => {
  const filteredUsers = users.filter((u) => u.name);
  if (filteredUsers.length === 0) return null;

  const MAX_SHOWN = 3;
  const shown = filteredUsers.slice(0, MAX_SHOWN);
  const overflow = filteredUsers.length - MAX_SHOWN;

  // Build label parts with AI styled differently
  const nameParts = shown.map((u) => {
    const isAi = u.name === 'AI Assistant';
    return (
      <span key={u.name} className={isAi ? 'ai-typing-breath' : undefined} style={{ color: isAi ? '#c586c0' : 'var(--theme-fg-muted)', fontWeight: isAi ? 600 : 400 }}>
        {u.name}
      </span>
    );
  });

  // Join with commas + Oxford-style last separator
  const parts: React.ReactNode[] = [];
  nameParts.forEach((part, i) => {
    parts.push(part);
    if (i < nameParts.length - 1) parts.push(<span key={`sep-${i}`}>, </span>);
  });
  if (overflow > 0) {
    parts.push(<span key="overflow">, <strong>{overflow} other{overflow > 1 ? 's' : ''}</strong></span>);
  }

  const verb = filteredUsers.length === 1 ? 'is' : 'are';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 0', marginTop: 4 }}>
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 5, height: 5, borderRadius: '50%',
              background: 'var(--theme-fg-muted)',
              display: 'inline-block',
              animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              opacity: 0.6,
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 11, color: 'var(--theme-fg-muted)', fontStyle: 'italic' }}>
        {parts} {verb} typing…
      </span>
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
};

// ── System divider ────────────────────────────────────────────────────────────

const SystemDivider: React.FC<{ messages: ChatMessage[] }> = ({ messages }) => (
  <div style={{ padding: '6px 0' }}>
    {messages.map((msg) => (
      <div key={msg.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--theme-border)', opacity: 0.4 }} />
        <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)', fontStyle: 'italic', whiteSpace: 'nowrap', opacity: 0.75 }}>
          {msg.content}
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--theme-border)', opacity: 0.4 }} />
      </div>
    ))}
  </div>
);

// ── Action button ─────────────────────────────────────────────────────────────

const ActionBtn: React.FC<{ title: string; onClick: () => void; children: React.ReactNode }> = ({ title, onClick, children }) => (
  <button
    title={title}
    onClick={onClick}
    style={{
      background: 'none', border: 'none', cursor: 'pointer',
      color: 'var(--theme-fg-muted)', padding: '3px 5px', borderRadius: 5,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, transition: 'background 0.1s, color 0.1s',
    }}
    onMouseEnter={(e) => { (e.currentTarget.style.background = 'var(--theme-bg-secondary)'); (e.currentTarget.style.color = 'var(--theme-fg)'); }}
    onMouseLeave={(e) => { (e.currentTarget.style.background = 'none'); (e.currentTarget.style.color = 'var(--theme-fg-muted)'); }}
  >
    {children}
  </button>
);
