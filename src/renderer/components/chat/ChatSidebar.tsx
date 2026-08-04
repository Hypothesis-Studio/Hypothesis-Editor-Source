/**
 * ChatSidebar - WA-web style left sidebar:
 * Header + Create/Join form + Room list
 */
import React, { useState, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import type { ChatRoom } from '../../../shared/types/chat';
import type { HostingMode } from '../../stores/chatStore';

export const ChatSidebar: React.FC = () => {
  const {
    rooms, selectedRoomId, setSelectedRoom,
    sidebarPanel, setSidebarPanel,
    isLoading, pendingTunnelRoomId,
    createName, setCreateName,
    createUserName, setCreateUserName,
    createPort, setCreatePort,
    createOpenJoin, setCreateOpenJoin,
    hostingMode, setHostingMode,
    createSubdomain, setCreateSubdomain,
    tunnelProvider, setTunnelProvider,
    joinUrl, setJoinUrl,
    joinUserName, setJoinUserName,
    createRoom, joinRoom,
    findFreePort,
    messages,
    unreadCounts,
  } = useChatStore();

  const [portLoading, setPortLoading] = useState(false);
  const [dlProgress, setDlProgress] = useState<{ percent: number; message: string } | null>(null);

  useEffect(() => {
    const api = (window as any).api;
    const unsub = api?.tunnel?.onDownloadProgress?.((evt: { percent: number; message: string }) => {
      setDlProgress(evt.percent >= 100 ? null : evt);
    });
    return () => unsub?.();
  }, []);

  const handleFindPort = async () => {
    setPortLoading(true);
    try { setCreatePort(String(await findFreePort())); }
    finally { setPortLoading(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRoom();
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    await joinRoom();
  };

  return (
    <div style={{
      width: 280,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--theme-bg-secondary)',
      borderRight: '1px solid var(--theme-border)',
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '14px 16px 10px',
        borderBottom: '1px solid var(--theme-border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--theme-fg)' }}>Chat</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <SidebarBtn
              active={sidebarPanel === 'join'}
              title="Join a room"
              onClick={() => setSidebarPanel(sidebarPanel === 'join' ? null : 'join')}
            >
              {/* login: arrow entering a box */}
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3" />
                <path d="M10 11l4-4-4-4" />
                <path d="M14 7H6" />
              </svg>
              Join
            </SidebarBtn>
            <SidebarBtn
              active={sidebarPanel === 'create'}
              title="Host a room"
              onClick={() => setSidebarPanel(sidebarPanel === 'create' ? null : 'create')}
              accent
            >
              {/* server/host icon */}
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="2" width="14" height="5" rx="1.5" />
                <rect x="1" y="9" width="14" height="5" rx="1.5" />
                <circle cx="12" cy="4.5" r="1" fill="currentColor" stroke="none" />
                <circle cx="12" cy="11.5" r="1" fill="currentColor" stroke="none" />
              </svg>
              Host
            </SidebarBtn>
          </div>
        </div>

        {/* ── Create form ── */}
        {sidebarPanel === 'create' && (
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
            <SidebarInput placeholder="Room name" value={createName} onChange={setCreateName} required />
            <SidebarInput placeholder="Your name" value={createUserName} onChange={setCreateUserName} required />

            {/* Local / Public toggle */}
            <div style={{ display: 'flex', gap: 4 }}>
              {(['local', 'public'] as HostingMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setHostingMode(m)}
                  style={{
                    flex: 1,
                    padding: '5px 0',
                    fontSize: 11,
                    fontWeight: 600,
                    border: `1px solid ${hostingMode === m ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
                    borderRadius: 5,
                    background: hostingMode === m ? 'var(--theme-accent)' : 'transparent',
                    color: hostingMode === m ? '#fff' : 'var(--theme-fg-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                    {m === 'local'
                      ? <><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M1 6.5L8 1l7 5.5V14a1 1 0 01-1 1H2a1 1 0 01-1-1V6.5z"/><path d="M6 15V9h4v6"/></svg> Local</>
                      : <><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="8" cy="8" r="6.5"/><path d="M8 1.5C6 4 5 6 5 8s1 4 3 6.5M8 1.5C10 4 11 6 11 8s-1 4-3 6.5M1.5 8h13"/></svg> Public</>
                    }
                  </span>
                </button>
              ))}
            </div>

            {hostingMode === 'local' && (
              <div style={{ display: 'flex', gap: 5 }}>
                <SidebarInput placeholder="Port (auto)" value={createPort} onChange={setCreatePort} style={{ flex: 1 }} />
                <button type="button" onClick={handleFindPort} disabled={portLoading} style={tinyBtnStyle}>
                  {portLoading ? '…' : 'Auto'}
                </button>
              </div>
            )}

            {hostingMode === 'public' && (
              <>
                <div style={{ display: 'flex', gap: 5 }}>
                  <SidebarInput placeholder="Port (auto)" value={createPort} onChange={setCreatePort} style={{ flex: 1 }} />
                  <button type="button" onClick={handleFindPort} disabled={portLoading} style={tinyBtnStyle}>
                    {portLoading ? '…' : 'Auto'}
                  </button>
                </div>

                {/* Tunnel provider */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {(['cloudflare', 'localtunnel'] as const).map((p) => (
                    <label key={p} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, cursor: 'pointer', fontSize: 11 }}>
                      <input
                        type="radio"
                        name="tunnelProvider"
                        checked={tunnelProvider === p}
                        onChange={() => setTunnelProvider(p)}
                        style={{ accentColor: 'var(--theme-accent)', marginTop: 2, flexShrink: 0 }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--theme-fg)', fontSize: 11 }}>
                          {p === 'cloudflare' ? 'Cloudflare' : 'LocalTunnel'}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)' }}>
                          {p === 'cloudflare' ? 'trycloudflare.com — stable' : 'loca.lt — subdomain support'}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                {tunnelProvider === 'localtunnel' && (
                  <SidebarInput placeholder="Subdomain (optional)" value={createSubdomain} onChange={setCreateSubdomain} />
                )}

                <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)', lineHeight: 1.5, padding: '0 2px' }}>
                  A tunnel will open automatically so anyone can join from any network.
                </div>
              </>
            )}

            {/* Download progress banner */}
            {dlProgress && (
              <div style={{
                borderRadius: 5, overflow: 'hidden',
                border: '1px solid var(--theme-border)',
                background: 'var(--theme-bg-secondary)',
              }}>
                <div style={{ padding: '5px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)' }}>{dlProgress.message}</span>
                  {dlProgress.percent >= 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--theme-accent)' }}>{dlProgress.percent}%</span>
                  )}
                </div>
                {dlProgress.percent >= 0 && (
                  <div style={{ height: 3, background: 'var(--theme-border)' }}>
                    <div style={{
                      height: '100%', background: 'var(--theme-accent)',
                      width: `${dlProgress.percent}%`, transition: 'width 0.2s ease',
                    }} />
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !createName.trim() || !createUserName.trim()}
              style={{ ...accentBtnStyle, opacity: isLoading || !createName.trim() || !createUserName.trim() ? 0.5 : 1 }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {isLoading
                  ? pendingTunnelRoomId
                    ? <><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="8" cy="8" r="6.5"/><path d="M8 1.5C6 4 5 6 5 8s1 4 3 6.5M8 1.5C10 4 11 6 11 8s-1 4-3 6.5M1.5 8h13"/></svg> Opening tunnel…</>
                    : 'Creating…'
                  : hostingMode === 'public'
                    ? <><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="8" cy="8" r="6.5"/><path d="M8 1.5C6 4 5 6 5 8s1 4 3 6.5M8 1.5C10 4 11 6 11 8s-1 4-3 6.5M1.5 8h13"/></svg> Host Public Room</>
                    : <><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M1 6.5L8 1l7 5.5V14a1 1 0 01-1 1H2a1 1 0 01-1-1V6.5z"/><path d="M6 15V9h4v6"/></svg> Host Local Room</>
                }
              </span>
            </button>
          </form>
        )}

        {/* ── Join form ── */}
        {sidebarPanel === 'join' && (
          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
            <SidebarInput placeholder="ws://host:port or wss://..." value={joinUrl} onChange={setJoinUrl} required />
            <SidebarInput placeholder="Your name" value={joinUserName} onChange={setJoinUserName} required />
            <button
              type="submit"
              disabled={isLoading || !joinUrl.trim() || !joinUserName.trim()}
              style={{ ...accentBtnStyle, opacity: isLoading || !joinUrl.trim() || !joinUserName.trim() ? 0.5 : 1 }}
            >
              {isLoading ? 'Connecting…' : 'Join Room'}
            </button>
          </form>
        )}
      </div>

      {/* ── Room list ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {rooms.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--theme-fg-muted)', fontSize: 12 }}>
            No active rooms.<br />Host or join one above.
          </div>
        ) : (
          rooms.map((r) => (
            <RoomRow
              key={r.id}
              room={r}
              active={r.id === selectedRoomId}
              unread={unreadCounts[r.id] ?? 0}
              onClick={() => setSelectedRoom(r.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ── Room row ────────────────────────────────────────────────────────────────

const RoomRow: React.FC<{
  room: ChatRoom;
  active: boolean;
  unread: number;
  onClick: () => void;
}> = ({ room, active, unread, onClick }) => {
  const statusColor: Record<string, string> = {
    hosting: '#4fc1ff', connected: '#89d185',
    connecting: '#d7ba7d', error: '#f48771',
    closed: '#6e6e6e', idle: '#6e6e6e',
  };

  const lastMsg = room.messages?.[room.messages.length - 1];

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        cursor: 'pointer',
        background: active ? 'var(--theme-bg-tertiary)' : 'transparent',
        borderLeft: active ? '2px solid var(--theme-accent)' : '2px solid transparent',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-tertiary)50'; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      {/* Icon */}
      <div style={{
        width: 38, height: 38, borderRadius: '50%',
        background: 'var(--theme-bg)',
        border: `2px solid ${statusColor[room.status] ?? '#6e6e6e'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontSize: 14,
        boxShadow: `0 0 8px ${statusColor[room.status] ?? '#6e6e6e'}44`,
      }}>
        {room.status === 'hosting'
          ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M1 6.5L8 1l7 5.5V14a1 1 0 01-1 1H2a1 1 0 01-1-1V6.5z"/><path d="M6 15V9h4v6"/></svg>
          : <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 2h12a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 3V3a1 1 0 011-1z"/></svg>
        }
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {room.name}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 4 }}>
            {unread > 0 && (
              <span style={{
                fontSize: 9, minWidth: 16, height: 16, borderRadius: 8,
                background: 'var(--theme-accent)', color: '#fff',
                fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 4px',
              }}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
            <span style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 8,
              background: 'var(--theme-bg)',
              color: statusColor[room.status] ?? '#6e6e6e',
              fontWeight: 700, textTransform: 'uppercase',
            }}>
              {room.status === 'hosting' ? 'host' : room.status}
            </span>
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--theme-fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
          {lastMsg
            ? `${lastMsg.senderName}: ${lastMsg.content}`
            : `${room.participants.length} participant${room.participants.length !== 1 ? 's' : ''}`
          }
        </div>
      </div>
    </div>
  );
};

// ── Primitives ───────────────────────────────────────────────────────────────

const SidebarBtn: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  accent?: boolean;
  title?: string;
}> = ({ children, onClick, active, accent, title }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '4px 8px',
      fontSize: 11, fontWeight: 600,
      border: `1px solid ${active || accent ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
      borderRadius: 5,
      background: active || accent ? 'var(--theme-accent)' : 'transparent',
      color: active || accent ? '#fff' : 'var(--theme-fg-muted)',
      cursor: 'pointer',
      transition: 'all 0.12s',
    }}
  >
    {children}
  </button>
);

const SidebarInput: React.FC<{
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  style?: React.CSSProperties;
}> = ({ placeholder, value, onChange, required, style }) => (
  <input
    type="text"
    placeholder={placeholder}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    required={required}
    style={{
      background: 'var(--theme-bg)',
      border: '1px solid var(--theme-border)',
      borderRadius: 5,
      padding: '5px 9px',
      fontSize: 12,
      color: 'var(--theme-fg)',
      outline: 'none',
      width: '100%',
      boxSizing: 'border-box',
      ...style,
    }}
    onFocus={(e) => (e.target.style.borderColor = 'var(--theme-accent)')}
    onBlur={(e) => (e.target.style.borderColor = 'var(--theme-border)')}
  />
);

const accentBtnStyle: React.CSSProperties = {
  background: 'var(--theme-accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 5,
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  width: '100%',
  transition: 'opacity 0.15s',
};

const tinyBtnStyle: React.CSSProperties = {
  background: 'var(--theme-bg)',
  color: 'var(--theme-fg-muted)',
  border: '1px solid var(--theme-border)',
  borderRadius: 5,
  padding: '5px 8px',
  fontSize: 11,
  cursor: 'pointer',
  flexShrink: 0,
  whiteSpace: 'nowrap',
};
