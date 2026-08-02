/**
 * ChatRoomList - Clean host/join forms + active room cards.
 */
import React, { useState } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useTunnelStore } from '../../stores/tunnelStore';
import type { ChatRoom } from '../../../shared/types/chat';

export const ChatRoomList: React.FC = () => {
  const {
    rooms, isLoading,
    createName, setCreateName,
    createUserName, setCreateUserName,
    createPort, setCreatePort,
    createOpenJoin, setCreateOpenJoin,
    createTunnelId, setCreateTunnelId,
    joinUrl, setJoinUrl,
    joinUserName, setJoinUserName,
    createRoom, joinRoom, setSelectedRoom,
    findFreePort,
  } = useChatStore();

  const tunnels = useTunnelStore((s) => s.tunnels);
  const connectedTunnels = tunnels.filter((t) => t.status === 'connected');

  const [tab, setTab] = useState<'host' | 'join'>('host');
  const [portLoading, setPortLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || !createUserName.trim()) return;
    await createRoom({
      name: createName.trim(),
      userName: createUserName.trim(),
      localPort: createPort ? parseInt(createPort, 10) : undefined,
      openJoin: createOpenJoin,
      tunnelId: createTunnelId || null,
    });
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinUrl.trim() || !joinUserName.trim()) return;
    await joinRoom({ url: joinUrl.trim(), userName: joinUserName.trim() });
  };

  const handleFindPort = async () => {
    setPortLoading(true);
    try {
      const port = await findFreePort();
      setCreatePort(String(port));
    } finally {
      setPortLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--theme-bg)' }}>

      {/* ── Page header ── */}
      <div style={{
        padding: '20px 20px 0',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="var(--theme-accent)" strokeWidth="1.6" strokeLinecap="round">
            <rect x="1" y="2" width="10" height="8" rx="2" />
            <path d="M5 10v4l3-2h4a2 2 0 002-2V6a2 2 0 00-2-2h-1" />
          </svg>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--theme-fg)' }}>Realtime Chat</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--theme-fg-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
          Host a local room or join via WebSocket URL. Share your URL with teammates on LAN or via a tunnel.
        </p>
      </div>

      {/* ── Tab selector ── */}
      <div style={{
        display: 'flex',
        padding: '0 20px',
        gap: 4,
        flexShrink: 0,
        marginBottom: 14,
      }}>
        {(['host', 'join'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '7px 0',
              fontSize: 12,
              fontWeight: 600,
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              background: tab === t ? 'var(--theme-accent)' : 'var(--theme-bg-secondary)',
              color: tab === t ? '#fff' : 'var(--theme-fg-muted)',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {t === 'host' ? '⊕  Host Room' : '→  Join Room'}
          </button>
        ))}
      </div>

      {/* ── Form ── */}
      <div style={{ padding: '0 20px', flexShrink: 0 }}>
        {tab === 'host' ? (
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label="Room name">
              <Input placeholder="e.g. Dev Standup" value={createName} onChange={setCreateName} required />
            </Field>
            <Field label="Your name">
              <Input placeholder="e.g. Alice" value={createUserName} onChange={setCreateUserName} required />
            </Field>
            <Field label="Port">
              <div style={{ display: 'flex', gap: 6 }}>
                <Input placeholder="Auto" value={createPort} onChange={setCreatePort} style={{ flex: 1 }} />
                <button type="button" onClick={handleFindPort} disabled={portLoading} style={smallBtnStyle}>
                  {portLoading ? '…' : 'Find free'}
                </button>
              </div>
            </Field>

            {connectedTunnels.length > 0 && (
              <Field label="Public tunnel (optional)">
                <select
                  value={createTunnelId ?? ''}
                  onChange={(e) => setCreateTunnelId(e.target.value || null)}
                  style={selectStyle}
                >
                  <option value="">None — local only</option>
                  {connectedTunnels.map((t) => (
                    <option key={t.id} value={t.id}>{t.label} — {t.publicUrl}</option>
                  ))}
                </select>
              </Field>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={createOpenJoin}
                onChange={(e) => setCreateOpenJoin(e.target.checked)}
                style={{ accentColor: 'var(--theme-accent)', width: 14, height: 14 }}
              />
              <span style={{ color: 'var(--theme-fg-muted)' }}>Allow anyone to join</span>
            </label>

            <button
              type="submit"
              disabled={isLoading || !createName.trim() || !createUserName.trim()}
              style={{
                ...primaryBtnStyle,
                opacity: isLoading || !createName.trim() || !createUserName.trim() ? 0.5 : 1,
              }}
            >
              {isLoading ? 'Creating…' : 'Host Room'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label="WebSocket URL">
              <Input placeholder="ws://192.168.1.x:4900" value={joinUrl} onChange={setJoinUrl} required />
            </Field>
            <Field label="Your name">
              <Input placeholder="e.g. Bob" value={joinUserName} onChange={setJoinUserName} required />
            </Field>
            <button
              type="submit"
              disabled={isLoading || !joinUrl.trim() || !joinUserName.trim()}
              style={{
                ...primaryBtnStyle,
                opacity: isLoading || !joinUrl.trim() || !joinUserName.trim() ? 0.5 : 1,
              }}
            >
              {isLoading ? 'Connecting…' : 'Join Room'}
            </button>
          </form>
        )}
      </div>

      {/* ── Divider ── */}
      {rooms.length > 0 && (
        <div style={{
          margin: '18px 20px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}>
          <div style={{ flex: 1, height: 1, background: 'var(--theme-border)' }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--theme-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Active Rooms
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--theme-border)' }} />
        </div>
      )}

      {/* ── Room cards ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: rooms.length > 0 ? '10px 20px 16px' : 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rooms.map((r) => (
          <RoomCard key={r.id} room={r} onSelect={() => setSelectedRoom(r.id)} />
        ))}
      </div>
    </div>
  );
};

// ── Room card ───────────────────────────────────────────────────────────────

const RoomCard: React.FC<{ room: ChatRoom; onSelect: () => void }> = ({ room, onSelect }) => {
  const [hover, setHover] = useState(false);

  const statusDot: Record<string, string> = {
    hosting: '#4fc1ff',
    connected: '#89d185',
    connecting: '#d7ba7d',
    error: '#f48771',
    closed: '#6e6e6e',
    idle: '#6e6e6e',
  };

  const wsUrl = room.publicUrl ?? `ws://localhost:${room.localPort}`;

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '10px 14px',
        borderRadius: 8,
        border: `1px solid ${hover ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
        background: hover ? 'var(--theme-bg-secondary)' : 'var(--theme-bg)',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: statusDot[room.status] ?? '#6e6e6e',
          flexShrink: 0,
          boxShadow: `0 0 5px ${statusDot[room.status] ?? '#6e6e6e'}66`,
        }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', flex: 1 }}>{room.name}</span>
        <span style={{
          fontSize: 10,
          background: 'var(--theme-bg-tertiary)',
          borderRadius: 10,
          padding: '1px 7px',
          color: 'var(--theme-fg-muted)',
        }}>
          {room.status === 'hosting' ? 'host' : 'guest'}
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--theme-fg-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>
        {wsUrl}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Participant avatars */}
        <div style={{ display: 'flex' }}>
          {room.participants.slice(0, 5).map((u, i) => (
            <div
              key={u.id}
              title={u.name}
              style={{
                width: 18, height: 18,
                borderRadius: '50%',
                background: u.color,
                border: '2px solid var(--theme-bg)',
                marginLeft: i === 0 ? 0 : -5,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, color: '#fff',
                zIndex: i,
              }}
            >
              {u.name.charAt(0).toUpperCase()}
            </div>
          ))}
          {room.participants.length > 5 && (
            <div style={{
              width: 18, height: 18,
              borderRadius: '50%',
              background: 'var(--theme-bg-tertiary)',
              border: '2px solid var(--theme-bg)',
              marginLeft: -5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, color: 'var(--theme-fg-muted)',
            }}>
              +{room.participants.length - 5}
            </div>
          )}
        </div>
        <span style={{ fontSize: 11, color: 'var(--theme-fg-muted)' }}>
          {room.participants.length} participant{room.participants.length !== 1 ? 's' : ''}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--theme-accent)', fontWeight: 500 }}>Open →</span>
      </div>
    </div>
  );
};

// ── Helpers ─────────────────────────────────────────────────────────────────

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-fg-muted)', letterSpacing: '0.04em' }}>{label}</label>
    {children}
  </div>
);

const Input: React.FC<{
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
      background: 'var(--theme-bg-secondary)',
      border: '1px solid var(--theme-border)',
      borderRadius: 6,
      padding: '6px 10px',
      fontSize: 12,
      color: 'var(--theme-fg)',
      outline: 'none',
      width: '100%',
      boxSizing: 'border-box',
      transition: 'border-color 0.15s',
      ...style,
    }}
    onFocus={(e) => (e.target.style.borderColor = 'var(--theme-accent)')}
    onBlur={(e) => (e.target.style.borderColor = 'var(--theme-border)')}
  />
);

const primaryBtnStyle: React.CSSProperties = {
  background: 'var(--theme-accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '8px 14px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  width: '100%',
  transition: 'opacity 0.15s',
};

const smallBtnStyle: React.CSSProperties = {
  background: 'var(--theme-bg-tertiary)',
  color: 'var(--theme-fg)',
  border: '1px solid var(--theme-border)',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 11,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

const selectStyle: React.CSSProperties = {
  background: 'var(--theme-bg-secondary)',
  border: '1px solid var(--theme-border)',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 12,
  color: 'var(--theme-fg)',
  outline: 'none',
  width: '100%',
};
