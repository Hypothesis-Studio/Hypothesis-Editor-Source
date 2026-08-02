/**
 * ChatRoom - Main chat area (right panel in WA-web layout).
 * No back navigation — room selection is handled by ChatSidebar.
 */
import React, { useCallback, useState } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import type { ChatUser } from '../../../shared/types/chat';

interface Props {
  roomId: string;
}

export const ChatRoomView: React.FC<Props> = ({ roomId }) => {
  const { rooms, messages, leaveRoom, closeRoom, copyUrl, clearMessages, kickUser, selectedRoomId: _ } = useChatStore();
  const [copied, setCopied] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);

  const room = rooms.find((r) => r.id === roomId);
  const roomMessages = messages[roomId] ?? [];

  const handleLeaveOrClose = useCallback(async () => {
    if (!room) return;
    if (room.status === 'hosting') await closeRoom(roomId);
    else await leaveRoom(roomId);
  }, [room, roomId, closeRoom, leaveRoom]);

  const handleCopyUrl = useCallback(async () => {
    await copyUrl(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [copyUrl, roomId]);

  if (!room) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--theme-fg-muted)', fontSize: 13 }}>
        Room not found.
      </div>
    );
  }

  const statusDot: Record<string, string> = {
    hosting: '#4fc1ff', connected: '#89d185',
    connecting: '#d7ba7d', error: '#f48771',
    closed: '#6e6e6e', idle: '#6e6e6e',
  };

  const wsUrl = room.publicUrl ?? `ws://localhost:${room.localPort}`;
  const isActive = room.status === 'hosting' || room.status === 'connected';
  const isPublic = !!room.publicUrl;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--theme-bg)' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        height: 52,
        borderBottom: '1px solid var(--theme-border)',
        background: 'var(--theme-bg-secondary)',
        flexShrink: 0,
        gap: 10,
      }}>
        {/* Room avatar */}
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'var(--theme-bg)',
          border: `2px solid ${statusDot[room.status] ?? '#6e6e6e'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>
          {room.status === 'hosting'
            ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M1 6.5L8 1l7 5.5V14a1 1 0 01-1 1H2a1 1 0 01-1-1V6.5z"/><path d="M6 15V9h4v6"/></svg>
            : <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 2h12a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 3V3a1 1 0 011-1z"/></svg>
          }
        </div>

        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
			<div
			  style={{
				display: 'flex',
				alignItems: 'center',
				gap: 7,
				flexWrap: 'nowrap',
				minWidth: 0,
			  }}
			>
			  <span
				style={{
				  fontSize: 14,
				  fontWeight: 700,
				  color: 'var(--theme-fg)',
				  overflow: 'hidden',
				  textOverflow: 'ellipsis',
				  whiteSpace: 'nowrap',
				  minWidth: 0,
				}}
			  >
				{room.name}
			  </span>

			  {isPublic && (
				<span
				  style={{
					fontSize: 9,
					fontWeight: 700,
					padding: '1px 6px',
					borderRadius: 8,
					background: '#4fc1ff22',
					color: '#4fc1ff',
					border: '1px solid #4fc1ff44',
					textTransform: 'uppercase',
					flexShrink: 0,
					whiteSpace: 'nowrap',
				  }}
				>
				  <svg
					width="10"
					height="10"
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.7"
					strokeLinecap="round"
					style={{ marginRight: 3 }}
				  >
					<circle cx="8" cy="8" r="6.5" />
					<path d="M8 1.5C6 4 5 6 5 8s1 4 3 6.5M8 1.5C10 4 11 6 11 8s-1 4-3 6.5M1.5 8h13" />
				  </svg>
				  Public
				</span>
			  )}
			</div>
          <div style={{ fontSize: 11, color: 'var(--theme-fg-muted)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: statusDot[room.status] ?? '#6e6e6e',
              display: 'inline-block', flexShrink: 0,
            }} />
            <span>{room.participants.length} participant{room.participants.length !== 1 ? 's' : ''}</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span style={{ fontFamily: 'monospace', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
              {wsUrl}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <HeaderBtn title={showParticipants ? 'Hide participants' : 'Show participants'} onClick={() => setShowParticipants(v => !v)} active={showParticipants}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="6" cy="5" r="2.5" /><path d="M1 13c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5" />
              <circle cx="12.5" cy="4.5" r="1.8" /><path d="M15 12c0-1.9-1.1-3-2.5-3" />
            </svg>
          </HeaderBtn>

          <HeaderBtn title="Clear chat" onClick={() => clearMessages(roomId)}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M2 4h12M5 4V2h6v2M3 4l1 10h8l1-10" />
            </svg>
          </HeaderBtn>

          <HeaderBtn title={copied ? 'Copied!' : 'Copy room URL'} onClick={handleCopyUrl} active={copied}>
            {copied
              ? <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#89d185" strokeWidth="2.2" strokeLinecap="round"><path d="M3 8l4 4 6-7" /></svg>
              : <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <rect x="5" y="5" width="9" height="10" rx="1.5" /><path d="M3 11H2a1 1 0 01-1-1V2a1 1 0 011-1h8a1 1 0 011 1v2" />
                </svg>
            }
          </HeaderBtn>

          <div style={{ width: 1, height: 18, background: 'var(--theme-border)', margin: '0 4px' }} />

          <button
            onClick={handleLeaveOrClose}
            title={room.status === 'hosting' ? 'Disconnect room' : 'Leave room'}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 6,
              border: '1px solid #f4877133',
              background: 'none', color: '#f48771',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {room.status === 'hosting'
              ? <><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg> Disconnect</>
              : <><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 2h3a1 1 0 011 1v10a1 1 0 01-1 1h-3M6 11l-4-4 4-4M2 8h8"/></svg> Leave</>
            }
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Messages */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <ChatMessageList messages={roomMessages} currentUserId={room.host?.id} />
          {isActive
            ? <ChatInput roomId={roomId} />
            : (
              <div style={{
                padding: '12px 16px', textAlign: 'center',
                fontSize: 12, color: 'var(--theme-fg-muted)',
                borderTop: '1px solid var(--theme-border)',
                background: 'var(--theme-bg-secondary)',
              }}>
                {room.status === 'error'
                  ? <span style={{ color: '#f48771', display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 2L1 14h14L8 2z"/><path d="M8 7v4M8 12.5v.5"/></svg>{room.error}</span>
                  : 'Room is Disconnect'}
              </div>
            )
          }
        </div>

        {/* Participants sidebar */}
        {showParticipants && (
          <div style={{
            width: 170, flexShrink: 0,
            borderLeft: '1px solid var(--theme-border)',
            background: 'var(--theme-bg-secondary)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 12px 8px',
              fontSize: 10, fontWeight: 700,
              color: 'var(--theme-fg-muted)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              borderBottom: '1px solid var(--theme-border)',
              flexShrink: 0,
            }}>
              Participants · {room.participants.length}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
              {room.participants.map((u) => (
                <ParticipantRow
                  key={u.id}
                  user={u}
                  canKick={room.status === 'hosting' && u.role !== 'host'}
                  onKick={() => kickUser(roomId, u.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Participant row ──────────────────────────────────────────────────────────

const ParticipantRow: React.FC<{ user: ChatUser; canKick: boolean; onKick: () => void }> = ({ user, canKick, onKick }) => {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px',
        background: hover ? 'var(--theme-bg-tertiary)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: user.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
      }}>
        {user.name.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--theme-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
          {user.role === 'host'
            ? <><svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="2" width="14" height="5" rx="1.5"/><rect x="1" y="9" width="14" height="5" rx="1.5"/><circle cx="12" cy="4.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="11.5" r="1" fill="currentColor" stroke="none"/></svg> host</>
            : <><svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5"/></svg> guest</>
          }
        </div>
      </div>
      {canKick && hover && (
        <button
          onClick={onKick}
          title={`Kick ${user.name}`}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#f48771', padding: '3px 4px', borderRadius: 4,
            display: 'flex', alignItems: 'center',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f4877122')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
        >
          {/* person-remove / kick icon */}
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="5" r="3"/>
            <path d="M1 14c0-3.3 2.2-5 5-5s5 1.7 5 5"/>
            <path d="M12 8l3 3m0-3l-3 3"/>
          </svg>
        </button>
      )}
    </div>
  );
};

// ── Header button ────────────────────────────────────────────────────────────

const HeaderBtn: React.FC<{ title: string; onClick: () => void; active?: boolean; children: React.ReactNode }> = ({ title, onClick, active, children }) => (
  <button
    title={title}
    onClick={onClick}
    style={{
      background: active ? 'var(--theme-bg-tertiary)' : 'none',
      border: 'none', borderRadius: 5, cursor: 'pointer',
      color: active ? 'var(--theme-fg)' : 'var(--theme-fg-muted)',
      padding: '5px 6px',
      display: 'flex', alignItems: 'center',
      transition: 'background 0.1s, color 0.1s',
    }}
    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-tertiary)'; (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = active ? 'var(--theme-bg-tertiary)' : 'none'; (e.currentTarget as HTMLElement).style.color = active ? 'var(--theme-fg)' : 'var(--theme-fg-muted)'; }}
  >
    {children}
  </button>
);
