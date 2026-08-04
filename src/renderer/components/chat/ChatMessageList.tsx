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
import { CollapsibleCodeBlock } from '../shared/CollapsibleCodeBlock';

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
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToMessage = useCallback((msgId: string) => {
    const el = listRef.current?.querySelector(`[data-msg-id="${msgId}"]`) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Flash highlight like WhatsApp
    el.style.transition = 'background 0.15s';
    el.style.background = 'rgba(var(--theme-accent-rgb, 0,122,204), 0.18)';
    setTimeout(() => { el.style.background = ''; }, 1200);
  }, []);
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
    <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
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
              onScrollTo={scrollToMessage}
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
  onScrollTo: (msgId: string) => void;
}

const BubbleGroup = memo<BubbleGroupProps>(({ group, isSelf, isAi, roomId, currentUserId, onReact, onReply, onScrollTo }) => {
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
              onScrollTo={onScrollTo}
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
  onScrollTo: (msgId: string) => void;
}

const MessageBubble = memo<MessageBubbleProps>(({ msg, isSelf, isAi, isFirst, isLast, currentUserId, onReact, onReply, onScrollTo }) => {
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
      data-msg-id={msg.id}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative', maxWidth: '100%' }}
    >
      {/* Reply context */}
      {msg.replyToId && msg.replyToContent && (
        <div
          onClick={() => msg.replyToId && onScrollTo(msg.replyToId)}
          style={{
            fontSize: 11, color: 'var(--theme-fg-muted)',
            borderLeft: `2px solid ${isSelf ? 'rgba(255,255,255,0.4)' : 'var(--theme-accent)'}`,
            paddingLeft: 7, marginBottom: 3,
            opacity: 0.8, fontStyle: 'italic',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: 280, cursor: 'pointer',
            borderRadius: '0 4px 4px 0',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,122,204,0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
        >
          <span style={{ fontWeight: 600, fontStyle: 'normal' }}>{msg.replyToSenderName}</span>
          {' · '}{msg.replyToContent}
        </div>
      )}

      {/* Code snippet — full width, no bubble */}
      {msg.type === 'code' ? (
        <div style={{ width: '100%' }}>
          <CollapsibleCodeBlock lang={msg.language ?? ''} code={msg.content} />
          {msg.edited && <span style={{ fontSize: 9, opacity: 0.4, fontStyle: 'italic', marginLeft: 2 }}>(edited)</span>}
        </div>
      ) : (
        <div
          title={new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          style={{
            padding: '7px 12px',
            borderRadius: radius,
            background: bgColor,
            color: isSelf && !isAi ? '#fff' : 'var(--theme-fg)',
            fontSize: 13, lineHeight: 1.55, wordBreak: 'break-word',
            boxShadow: isSelf && !isAi ? '0 1px 4px rgba(0,0,0,0.18)' : '0 1px 3px rgba(0,0,0,0.10)',
            border: isSelf && !isAi ? 'none' : `1px solid ${isAi ? '#c586c033' : 'var(--theme-border)'}`,
            position: 'relative', userSelect: 'text', cursor: 'text',
          }}
        >
          {msg.type === 'file' ? (
            <FileBlock msg={msg} isSelf={isSelf} />
          ) : (
            <MarkdownContent content={msg.content} isSelf={isSelf && !isAi} />
          )}
          {msg.edited && (
            <span style={{ fontSize: 9, opacity: 0.5, marginLeft: 6, fontStyle: 'italic' }}>(edited)</span>
          )}
        </div>
      )}

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

      {/* Hover actions — shown for all message types */}
      {hover && (
        <div style={{
          position: 'absolute', top: msg.type === 'code' ? 4 : -34,
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
  // Split content into segments: code fences vs prose
  const segments = useMemo(() => {
    const result: Array<{ type: 'prose' | 'code'; text: string; lang: string }> = [];
    const lines = content.split('\n');
    let i = 0;
    let proseLines: string[] = [];

    while (i < lines.length) {
      const line = lines[i];
      const fenceMatch = line.trimStart().match(/^```(\S*)/);
      if (fenceMatch) {
        // Flush accumulated prose
        if (proseLines.length > 0) {
          result.push({ type: 'prose', text: proseLines.join('\n'), lang: '' });
          proseLines = [];
        }
        const lang = fenceMatch[1] || '';
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // skip closing ```
        if (codeLines.join('\n').trim()) {
          result.push({ type: 'code', text: codeLines.join('\n'), lang });
        }
      } else {
        proseLines.push(line);
        i++;
      }
    }
    if (proseLines.length > 0) {
      result.push({ type: 'prose', text: proseLines.join('\n'), lang: '' });
    }
    return result;
  }, [content]);

  return (
    <div style={{ lineHeight: 1.6, color: isSelf ? '#fff' : 'var(--theme-fg)' }}>
      {segments.map((seg, idx) =>
        seg.type === 'code' ? (
          <CollapsibleCodeBlock key={idx} lang={seg.lang} code={seg.text} />
        ) : (
          <div
            key={idx}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(seg.text) }}
            className={`chat-md${isSelf ? ' chat-md-self' : ''}`}
          />
        )
      )}
    </div>
  );
};

// ── File block ────────────────────────────────────────────────────────────────

const FILE_ICON_COLOR: Record<string, string> = {
  pdf: '#f48771', doc: '#4fc1ff', docx: '#4fc1ff',
  xls: '#89d185', xlsx: '#89d185', csv: '#89d185',
  zip: '#d7ba7d', rar: '#d7ba7d', '7z': '#d7ba7d',
  mp4: '#c586c0', mp3: '#c586c0', mov: '#c586c0',
  default: '#9cdcfe',
};
function getFileExt(name?: string) {
  if (!name) return '';
  return name.split('.').pop()?.toLowerCase() ?? '';
}
function getFileIconColor(name?: string) {
  const ext = getFileExt(name);
  return FILE_ICON_COLOR[ext] ?? FILE_ICON_COLOR.default;
}
function formatSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FileBlock: React.FC<{ msg: ChatMessage; isSelf: boolean }> = ({ msg, isSelf }) => {
  const isImage = msg.fileMimeType?.startsWith('image/');
  const isVideo = msg.fileMimeType?.startsWith('video/');
  const isAudio = msg.fileMimeType?.startsWith('audio/');
  const [downloading, setDownloading] = useState(false);
  const [hover, setHover] = useState(false);
  const iconColor = getFileIconColor(msg.fileName);
  const ext = getFileExt(msg.fileName);

  const handleDownload = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!msg.fileData || downloading) return;
    setDownloading(true);
    try {
      const api = (window as any).api;
      if (api?.chat?.downloadFile) {
        await api.chat.downloadFile(msg.fileName ?? 'file', msg.fileData, msg.fileMimeType ?? 'application/octet-stream');
      } else {
        const a = document.createElement('a');
        a.href = `data:${msg.fileMimeType};base64,${msg.fileData}`;
        a.download = msg.fileName ?? 'file';
        a.click();
      }
    } finally {
      setDownloading(false);
    }
  }, [msg, downloading]);

  const dataUrl = msg.fileUrl ?? (msg.fileData ? `data:${msg.fileMimeType};base64,${msg.fileData}` : undefined);

  // ── Download button overlay ──────────────────────────────────────────────
  const DownloadBtn = (
    <button
      onClick={handleDownload}
      title="Download"
      style={{
        position: 'absolute', top: 8, right: 8,
        background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 6, padding: '4px 8px',
        display: 'flex', alignItems: 'center', gap: 5,
        color: '#fff', fontSize: 11, fontWeight: 500, cursor: 'pointer',
        backdropFilter: 'blur(4px)',
        opacity: hover ? 1 : 0,
        transition: 'opacity 0.15s',
        zIndex: 2,
      }}
    >
      {downloading
        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M12 2a10 10 0 0 1 10 10" /></svg>
        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
      }
      Save
    </button>
  );

  // ── Image preview ────────────────────────────────────────────────────────
  if (isImage && dataUrl) {
    return (
      <div
        style={{ margin: '-2px -4px', position: 'relative' }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <div style={{
          borderRadius: 8, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.2)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}>
          <img
            src={dataUrl}
            alt={msg.fileName}
            style={{ maxWidth: 280, maxHeight: 220, display: 'block', width: '100%', objectFit: 'cover' }}
          />
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 10px',
            background: 'rgba(0,0,0,0.3)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
              {msg.fileName}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', flexShrink: 0, marginLeft: 8 }}>
              {formatSize(msg.fileSize)}
            </span>
          </div>
        </div>
        {DownloadBtn}
      </div>
    );
  }

  // ── Video preview ────────────────────────────────────────────────────────
  if (isVideo && dataUrl) {
    return (
      <div
        style={{ margin: '-2px -4px', position: 'relative' }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: '#000' }}>
          <video
            src={dataUrl}
            controls
            style={{ maxWidth: 300, maxHeight: 200, display: 'block', width: '100%' }}
          />
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 10px',
            background: 'rgba(0,0,0,0.3)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
              {msg.fileName}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', flexShrink: 0, marginLeft: 8 }}>
              {formatSize(msg.fileSize)}
            </span>
          </div>
        </div>
        {DownloadBtn}
      </div>
    );
  }

  // ── Audio preview ────────────────────────────────────────────────────────
  if (isAudio && dataUrl) {
    return (
      <div
        style={{ margin: '-2px -4px', position: 'relative', minWidth: 260 }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <div style={{
          borderRadius: 8, overflow: 'hidden',
          border: `1px solid ${isSelf ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.08)'}`,
          background: isSelf ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.04)',
          padding: '10px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9cdcfe" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            <span style={{ fontSize: 11.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {msg.fileName}
            </span>
            <span style={{ fontSize: 10, opacity: 0.4, flexShrink: 0 }}>{formatSize(msg.fileSize)}</span>
          </div>
          <audio src={dataUrl} controls style={{ width: '100%', height: 32 }} />
        </div>
        {DownloadBtn}
      </div>
    );
  }

  // ── File card (non-media) ────────────────────────────────────────────────
  return (
    <button
      onClick={handleDownload}
      disabled={!msg.fileData || downloading}
      title={msg.fileData ? 'Click to download' : 'File not available offline'}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: isSelf ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isSelf ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 10, padding: '10px 14px',
        cursor: msg.fileData ? 'pointer' : 'default',
        color: 'inherit', width: '100%', textAlign: 'left',
        minWidth: 220, maxWidth: 300,
        margin: '-2px -4px',
        transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={(e) => { if (msg.fileData) e.currentTarget.style.background = isSelf ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.07)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = isSelf ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.04)'; }}
    >
      {/* File type icon */}
      <div style={{
        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
        background: `${iconColor}18`, border: `1px solid ${iconColor}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 2,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        {ext && <span style={{ fontSize: 8, fontWeight: 700, color: iconColor, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1 }}>{ext}</span>}
      </div>
      {/* File info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
          {msg.fileName ?? 'Unknown file'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10.5, opacity: 0.5 }}>{formatSize(msg.fileSize)}</span>
          {!msg.fileData && <span style={{ fontSize: 10, color: '#f48771', opacity: 0.8 }}>Not available offline</span>}
        </div>
      </div>
      {/* Download icon */}
      {msg.fileData && (
        <div style={{ flexShrink: 0, opacity: downloading ? 0.4 : 0.6 }}>
          {downloading
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M12 2a10 10 0 0 1 10 10" /></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          }
        </div>
      )}
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
