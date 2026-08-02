/**
 * ChatMessageList - Chat bubbles, grouped by sender, Discord/Telegram style.
 */
import React, { useEffect, useRef } from 'react';
import type { ChatMessage } from '../../../shared/types/chat';

interface Props {
  messages: ChatMessage[];
  currentUserId?: string;
}

export const ChatMessageList: React.FC<Props> = ({ messages, currentUserId }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(0);

  useEffect(() => {
    if (messages.length > prevLenRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevLenRef.current = messages.length;
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        color: 'var(--theme-fg-muted)',
        padding: 24,
        textAlign: 'center',
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
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}>
      {groups.map((group, gi) =>
        group.isSystem
          ? <SystemDivider key={gi} messages={group.messages} />
          : <BubbleGroup key={gi} group={group} isSelf={group.senderId === currentUserId} />
      )}
      <div ref={bottomRef} />
    </div>
  );
};

// ── Types ────────────────────────────────────────────────────────────────────

interface MsgGroup {
  senderId: string;
  senderName: string;
  senderColor: string;
  timestamp: string;
  messages: ChatMessage[];
  isSystem: boolean;
}

function groupMessages(messages: ChatMessage[]): MsgGroup[] {
  const groups: MsgGroup[] = [];
  for (const msg of messages) {
    const isSystem = msg.type === 'system' || msg.senderId === 'system';
    const last = groups[groups.length - 1];
    const timeDiff = last
      ? new Date(msg.timestamp).getTime() - new Date(last.timestamp).getTime()
      : Infinity;

    if (
      last &&
      last.senderId === msg.senderId &&
      !last.isSystem &&
      !isSystem &&
      timeDiff < 2 * 60 * 1000
    ) {
      last.messages.push(msg);
    } else {
      groups.push({
        senderId: msg.senderId,
        senderName: msg.senderName,
        senderColor: msg.senderColor,
        timestamp: msg.timestamp,
        messages: [msg],
        isSystem,
      });
    }
  }
  return groups;
}

// ── Bubble group ─────────────────────────────────────────────────────────────

const BubbleGroup: React.FC<{ group: MsgGroup; isSelf: boolean }> = ({ group, isSelf }) => {
  const time = new Date(group.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{
      display: 'flex',
      flexDirection: isSelf ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
      gap: 8,
      marginTop: 8,
    }}>
      {/* Avatar — only for others */}
      {!isSelf && (
        <div style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: group.senderColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: '#fff',
          flexShrink: 0,
          marginBottom: 2,
          boxShadow: `0 0 0 2px var(--theme-bg)`,
        }}>
          {group.senderName.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Bubble column */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isSelf ? 'flex-end' : 'flex-start',
        maxWidth: '72%',
        gap: 2,
      }}>
        {/* Sender name + time — only for others */}
        {!isSelf && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, paddingLeft: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: group.senderColor }}>
              {group.senderName}
            </span>
            <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)', opacity: 0.7 }}>{time}</span>
          </div>
        )}

        {/* Bubbles */}
        {group.messages.map((msg, i) => {
          const isFirst = i === 0;
          const isLast = i === group.messages.length - 1;
          return (
            <div
              key={msg.id}
              title={new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              style={{
                padding: '7px 12px',
                borderRadius: isSelf
                  ? `${isFirst ? 14 : 6}px ${isFirst ? 6 : 14}px ${isLast ? 4 : 6}px ${isLast ? 14 : 6}px`
                  : `${isFirst ? 6 : 14}px ${isFirst ? 14 : 6}px ${isLast ? 14 : 6}px ${isLast ? 4 : 6}px`,
                background: isSelf
                  ? 'var(--theme-accent)'
                  : 'var(--theme-bg-secondary)',
                color: isSelf ? '#fff' : 'var(--theme-fg)',
                fontSize: 13,
                lineHeight: 1.55,
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
                boxShadow: isSelf
                  ? '0 1px 4px rgba(0,0,0,0.18)'
                  : '0 1px 3px rgba(0,0,0,0.10)',
                border: isSelf
                  ? 'none'
                  : '1px solid var(--theme-border)',
                position: 'relative',
              }}
            >
              {msg.content}
            </div>
          );
        })}

        {/* Time — only for self, below last bubble */}
        {isSelf && (
          <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)', opacity: 0.6, paddingRight: 2 }}>
            {time}
          </span>
        )}
      </div>
    </div>
  );
};

// ── System divider ───────────────────────────────────────────────────────────

const SystemDivider: React.FC<{ messages: ChatMessage[] }> = ({ messages }) => (
  <div style={{ padding: '8px 0' }}>
    {messages.map((msg) => (
      <div key={msg.id} style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 4px',
      }}>
        <div style={{ flex: 1, height: 1, background: 'var(--theme-border)', opacity: 0.4 }} />
        <span style={{
          fontSize: 10,
          color: 'var(--theme-fg-muted)',
          fontStyle: 'italic',
          whiteSpace: 'nowrap',
          opacity: 0.75,
        }}>
          {msg.content}
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--theme-border)', opacity: 0.4 }} />
      </div>
    ))}
  </div>
);
