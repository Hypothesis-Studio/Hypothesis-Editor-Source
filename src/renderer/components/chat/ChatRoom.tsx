/**
 * ChatRoom - Main chat area with presence indicators, join approval queue,
 * AI agent toggle, participant details, and full header controls.
 */
import React, { useCallback, useState, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import type { ChatUser, JoinRequest } from '../../../shared/types/chat';

interface Props {
  roomId: string;
}

export const ChatRoomView: React.FC<Props> = ({ roomId }) => {
  const {
    rooms, messages, leaveRoom, closeRoom, copyUrl, clearMessages,
    kickUser, approveJoin, denyJoin, toggleAi, sendPresence, regenerateTunnel,
    pendingTunnelRoomId, tunnelStatuses,
  } = useChatStore();
  const [copied, setCopied] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);
  const [showApprovals, setShowApprovals] = useState(false);

  const room = rooms.find((r) => r.id === roomId);
  const roomMessages = messages[roomId] ?? [];

  // Derive self user id — host is always room.host.id; guest is the first guest participant
  const selfUserId = room
    ? room.status === 'hosting'
      ? room.host.id
      : room.participants.find((u) => u.role === 'guest')?.id
    : undefined;

  // Auto-show approval panel when pending requests arrive
  useEffect(() => {
    if ((room?.pendingJoins?.length ?? 0) > 0) setShowApprovals(true);
  }, [room?.pendingJoins?.length]);

  // Broadcast presence when room is active
  useEffect(() => {
    if (!room || (room.status !== 'hosting' && room.status !== 'connected')) return;
    const activeFile = (window as any).__hypothesis_activeFile as string | undefined;
    const activeLine = (window as any).__hypothesis_activeLine as number | undefined;
    sendPresence(roomId, activeFile, activeLine);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

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
  const isHost = room.status === 'hosting';
  const isPublic = !!room.publicUrl;
  const pendingCount = room.pendingJoins?.length ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--theme-bg)' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '0 14px', height: 52,
        borderBottom: '1px solid var(--theme-border)',
        background: 'var(--theme-bg-secondary)',
        flexShrink: 0, gap: 10,
      }}>
        {/* Room icon */}
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'var(--theme-bg)',
          border: `2px solid ${statusDot[room.status] ?? '#6e6e6e'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>
          {isHost
            ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M1 6.5L8 1l7 5.5V14a1 1 0 01-1 1H2a1 1 0 01-1-1V6.5z" /><path d="M6 15V9h4v6" /></svg>
            : <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 2h12a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 3V3a1 1 0 011-1z" /></svg>
          }
        </div>

        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'nowrap', minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--theme-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
              {room.name}
            </span>
            {isPublic && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#4fc1ff22', color: '#4fc1ff', border: '1px solid #4fc1ff44', textTransform: 'uppercase', flexShrink: 0 }}>
                Public
              </span>
            )}
            {room.aiEnabled && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#c586c022', color: '#c586c0', border: '1px solid #c586c033', textTransform: 'uppercase', flexShrink: 0 }}>
                AI
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--theme-fg-muted)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusDot[room.status] ?? '#6e6e6e', display: 'inline-block', flexShrink: 0 }} />
            <span>{room.participants.filter((u) => u.id !== 'ai').length} participant{room.participants.filter((u) => u.id !== 'ai').length !== 1 ? 's' : ''}</span>
            <span style={{ opacity: 0.5 }}>·</span>
            {/* Tunnel status / URL */}
            {isHost && tunnelStatuses[roomId] === 'generating' ? (
              <span style={{ fontSize: 10, color: '#d7ba7d', display: 'flex', alignItems: 'center', gap: 3 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                Generating…
              </span>
            ) : isHost && tunnelStatuses[roomId] === 'connecting' ? (
              <span style={{ fontSize: 10, color: '#4fc1ff', display: 'flex', alignItems: 'center', gap: 3 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                Connecting…
              </span>
            ) : isHost && tunnelStatuses[roomId] === 'failed' ? (
              <span style={{ fontSize: 10, color: '#f48771', display: 'flex', alignItems: 'center', gap: 3 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Tunnel Failed
              </span>
            ) : isHost && isPublic ? (
              <span style={{ fontFamily: 'monospace', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220, color: '#89d185' }}>{wsUrl}</span>
            ) : (
              <span style={{ fontFamily: 'monospace', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{wsUrl}</span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Pending approvals badge */}
          {isHost && pendingCount > 0 && (
            <HeaderBtn title={`${pendingCount} pending join request${pendingCount > 1 ? 's' : ''}`} onClick={() => setShowApprovals((v) => !v)} active={showApprovals}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <circle cx="8" cy="6" r="3.5" /><path d="M2 14c0-2.8 2.2-4 6-4s6 1.2 6 4" />
                </svg>
                <span style={{ position: 'absolute', top: -6, right: -7, minWidth: 14, height: 14, borderRadius: 7, background: '#f48771', color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{pendingCount}</span>
              </div>
            </HeaderBtn>
          )}

          {/* AI toggle (host only) */}
          {isHost && (
            <HeaderBtn title={room.aiEnabled ? 'Disable AI assistant' : 'Enable AI assistant (@ai)'} onClick={() => toggleAi(roomId, !room.aiEnabled)} active={room.aiEnabled}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="8" width="18" height="12" rx="2" />
                <path d="M9 8V6a3 3 0 016 0v2" />
                <circle cx="9" cy="14" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="15" cy="14" r="1.5" fill="currentColor" stroke="none" />
                <path d="M9 18h6" />
                <path d="M12 2v2" />
              </svg>
            </HeaderBtn>
          )}

          {/* Participants toggle */}
          <HeaderBtn title={showParticipants ? 'Hide participants' : 'Show participants'} onClick={() => setShowParticipants((v) => !v)} active={showParticipants}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="6" cy="5" r="2.5" /><path d="M1 13c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5" />
              <circle cx="12.5" cy="4.5" r="1.8" /><path d="M15 12c0-1.9-1.1-3-2.5-3" />
            </svg>
          </HeaderBtn>

          {/* Clear */}
          <HeaderBtn title="Clear local chat history" onClick={() => clearMessages(roomId)}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M2 4h12M5 4V2h6v2M3 4l1 10h8l1-10" />
            </svg>
          </HeaderBtn>

          {/* Copy URL */}
          <HeaderBtn title={copied ? 'Copied!' : 'Copy room URL'} onClick={handleCopyUrl} active={copied}>
            {copied
              ? <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#89d185" strokeWidth="2.2" strokeLinecap="round"><path d="M3 8l4 4 6-7" /></svg>
              : <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="5" y="5" width="9" height="10" rx="1.5" /><path d="M3 11H2a1 1 0 01-1-1V2a1 1 0 011-1h8a1 1 0 011 1v2" /></svg>
            }
          </HeaderBtn>

          {/* Regenerate public URL (host + public room only) */}
          {isHost && isPublic && (
            <HeaderBtn
              title={pendingTunnelRoomId === roomId ? 'Generating new URL…' : 'Regenerate public URL'}
              onClick={() => regenerateTunnel(roomId)}
              active={pendingTunnelRoomId === roomId}
            >
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                style={pendingTunnelRoomId === roomId ? { animation: 'spin 1s linear infinite' } : undefined}
              >
                <path d="M23 4v6h-6" />
                <path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
            </HeaderBtn>
          )}

          <div style={{ width: 1, height: 18, background: 'var(--theme-border)', margin: '0 4px' }} />

          {/* Leave / Disconnect */}
          <button
            onClick={handleLeaveOrClose}
            title={isHost ? 'Disconnect room' : 'Leave room'}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 6,
              border: '1px solid #f4877133', background: 'none',
              color: '#f48771', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {isHost
              ? <><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg> Disconnect</>
              : <><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 2h3a1 1 0 011 1v10a1 1 0 01-1 1h-3M6 11l-4-4 4-4M2 8h8" /></svg> Leave</>
            }
          </button>
        </div>
      </div>

      {/* ── Join approval banner ── */}
      {showApprovals && isHost && pendingCount > 0 && (
        <div style={{
          borderBottom: '1px solid var(--theme-border)',
          background: '#d7ba7d11',
          flexShrink: 0,
        }}>
          <div style={{ padding: '8px 14px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#d7ba7d' }}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ marginRight: 5 }}>
                <path d="M8 2L1 14h14L8 2z" /><path d="M8 7v3M8 12v.5" />
              </svg>
              {pendingCount} pending join request{pendingCount > 1 ? 's' : ''}
            </span>
            <button onClick={() => setShowApprovals(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-fg-muted)', padding: '2px 4px' }}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
            </button>
          </div>
          <div style={{ padding: '0 14px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(room.pendingJoins ?? []).map((req) => (
              <JoinRequestRow key={req.id} request={req}
                onApprove={() => approveJoin(roomId, req.id)}
                onDeny={() => denyJoin(roomId, req.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Messages + input */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <ChatMessageList messages={roomMessages} roomId={roomId} currentUserId={selfUserId} />
          {isActive
            ? <ChatInput roomId={roomId} currentUserId={selfUserId} isHost={isHost} />
            : (
              <div style={{
                padding: '12px 16px', textAlign: 'center', fontSize: 12,
                color: 'var(--theme-fg-muted)', borderTop: '1px solid var(--theme-border)',
                background: 'var(--theme-bg-secondary)',
              }}>
                {room.status === 'error'
                  ? <span style={{ color: '#f48771', display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 2L1 14h14L8 2z" /><path d="M8 7v4M8 12.5v.5" /></svg>
                      {room.error}
                    </span>
                  : 'Room disconnected'}
              </div>
            )
          }
        </div>

        {/* Participants sidebar */}
        {showParticipants && (
          <div style={{
            width: 180, flexShrink: 0,
            borderLeft: '1px solid var(--theme-border)',
            background: 'var(--theme-bg-secondary)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 12px 8px',
              fontSize: 10, fontWeight: 700, color: 'var(--theme-fg-muted)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              borderBottom: '1px solid var(--theme-border)', flexShrink: 0,
            }}>
              Participants · {room.participants.filter((u) => u.id !== 'ai').length}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
              {room.participants.map((u) => (
                <ParticipantRow
                  key={u.id}
                  user={u}
                  canKick={isHost && u.role !== 'host' && u.id !== 'ai'}
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

// ── Join request row ──────────────────────────────────────────────────────────

const JoinRequestRow: React.FC<{ request: JoinRequest; onApprove: () => void; onDeny: () => void }> = ({ request, onApprove, onDeny }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--theme-bg)', borderRadius: 7,
    padding: '6px 10px', border: '1px solid var(--theme-border)',
  }}>
    <div style={{
      width: 24, height: 24, borderRadius: '50%',
      background: request.user.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
    }}>
      {request.user.name.charAt(0).toUpperCase()}
    </div>
    <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--theme-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {request.user.name}
    </span>
    <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)', flexShrink: 0 }}>
      {new Date(request.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </span>
    <button
      onClick={onApprove}
      title="Approve"
      style={{ background: '#89d18522', border: '1px solid #89d18555', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', color: '#89d185', fontSize: 11, fontWeight: 600 }}
    >
      Allow
    </button>
    <button
      onClick={onDeny}
      title="Deny"
      style={{ background: '#f4877122', border: '1px solid #f4877155', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', color: '#f48771', fontSize: 11, fontWeight: 600 }}
    >
      Deny
    </button>
  </div>
);

// ── Participant row ───────────────────────────────────────────────────────────

const ParticipantRow: React.FC<{ user: ChatUser; canKick: boolean; onKick: () => void }> = ({ user, canKick, onKick }) => {
  const [hover, setHover] = useState(false);
  const isAi = user.id === 'ai';

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: '6px 12px',
        background: hover ? 'var(--theme-bg-tertiary)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: isAi ? 'linear-gradient(135deg, #c586c0, #9cdcfe)' : user.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: isAi ? 14 : 11, fontWeight: 700, color: '#fff', flexShrink: 0,
        marginTop: 1,
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
        ) : user.name.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--theme-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)', display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
          {isAi
            ? <span style={{ color: '#c586c0' }}>AI assistant</span>
            : user.role === 'host'
              ? <><svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="2" width="14" height="5" rx="1.5" /><rect x="1" y="9" width="14" height="5" rx="1.5" /></svg> host</>
              : <><svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="8" cy="5" r="3" /><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" /></svg> guest</>
          }
        </div>
        {/* Presence: active file */}
        {user.activeFile && (
          <div style={{ fontSize: 9, color: 'var(--theme-fg-muted)', marginTop: 2, opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}
               title={`Editing: ${user.activeFile}${user.activeLine ? `:${user.activeLine}` : ''}`}>
            <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" style={{ marginRight: 3 }}>
              <path d="M12 2l2 2-9 9H3v-2L12 2z" />
            </svg>
            {user.activeFile.split('/').pop()}{user.activeLine ? `:${user.activeLine}` : ''}
          </div>
        )}
      </div>
      {canKick && hover && (
        <button
          onClick={onKick}
          title={`Kick ${user.name}`}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f48771', padding: '3px 4px', borderRadius: 4, display: 'flex', alignItems: 'center', marginTop: 2 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f4877122'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="5" r="3" /><path d="M1 14c0-3.3 2.2-5 5-5s5 1.7 5 5" /><path d="M12 8l3 3m0-3l-3 3" />
          </svg>
        </button>
      )}
    </div>
  );
};

// ── Header button ─────────────────────────────────────────────────────────────

const HeaderBtn: React.FC<{ title: string; onClick: () => void; active?: boolean; children: React.ReactNode }> = ({ title, onClick, active, children }) => (
  <button
    title={title}
    onClick={onClick}
    style={{
      background: active ? 'var(--theme-bg-tertiary)' : 'none',
      border: 'none', borderRadius: 5, cursor: 'pointer',
      color: active ? 'var(--theme-fg)' : 'var(--theme-fg-muted)',
      padding: '5px 6px', display: 'flex', alignItems: 'center',
      transition: 'background 0.1s, color 0.1s',
    }}
    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-tertiary)'; (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = active ? 'var(--theme-bg-tertiary)' : 'none'; (e.currentTarget as HTMLElement).style.color = active ? 'var(--theme-fg)' : 'var(--theme-fg-muted)'; }}
  >
    {children}
  </button>
);
