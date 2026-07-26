/**
 * LiveServerRequestLog - Side pane showing per-server HTTP activity and file change log.
 */
import React, { useState, useRef, useEffect } from 'react';
import { useLiveServerStore } from '../../stores/liveServerStore';

const STATUS_COLOR: Record<number, string> = {};
function getStatusColor(code: number): string {
  if (code >= 500) return 'var(--theme-error)';
  if (code >= 400) return '#e5a500';
  if (code >= 300) return 'var(--theme-accent)';
  return '#4ade80';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
}

const CHANGE_COLOR: Record<string, string> = {
  add: '#4ade80',
  change: 'var(--theme-accent)',
  unlink: 'var(--theme-error)',
};

const CHANGE_ICON: Record<string, string> = {
  add: '+',
  change: '~',
  unlink: '−',
};

type Tab = 'requests' | 'files';

export const LiveServerRequestLog: React.FC<{ serverId: string }> = ({ serverId }) => {
  const { requestLogs, fileLogs, servers, clearRequestLogs, clearFileLogs } = useLiveServerStore();
  const [tab, setTab] = useState<Tab>('requests');
  const endRef = useRef<HTMLDivElement>(null);

  const server = servers.find((s) => s.id === serverId);
  const serverRequests = requestLogs.filter((l) => l.serverId === serverId && !l.isLiveReload);
  const serverFiles = fileLogs.filter((l) => l.serverId === serverId);

  const totalBytes = server?.bytesSent ?? 0;
  const reqCount = server?.requestCount ?? 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [serverRequests.length, serverFiles.length]);

  return (
    <div style={{
      width: 320, flexShrink: 0,
      borderLeft: '1px solid var(--theme-border)',
      display: 'flex', flexDirection: 'column',
      background: 'var(--theme-bg)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        height: 28, padding: '0 8px', gap: 4,
        borderBottom: '1px solid var(--theme-border)',
        background: 'var(--theme-bg-secondary)',
        flexShrink: 0,
      }}>
        {/* Tabs */}
        {(['requests', 'files'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '2px 8px', fontSize: 11, background: 'none', border: 'none',
              cursor: 'pointer',
              borderBottom: tab === t ? '2px solid var(--theme-accent)' : '2px solid transparent',
              color: tab === t ? 'var(--theme-fg)' : 'var(--theme-fg-muted)',
              fontWeight: tab === t ? 600 : 400,
              transition: 'color 0.1s',
              textTransform: 'capitalize',
            }}
          >
            {t === 'requests' ? `Requests${serverRequests.length > 0 ? ` (${serverRequests.length})` : ''}` : `File Changes${serverFiles.length > 0 ? ` (${serverFiles.length})` : ''}`}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Clear */}
        <button
          onClick={() => tab === 'requests' ? clearRequestLogs(serverId) : clearFileLogs(serverId)}
          title="Clear log"
          style={{
            padding: '2px 6px', fontSize: 10, background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--theme-fg-muted)', borderRadius: 3,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-fg)'; e.currentTarget.style.background = 'var(--theme-bg-tertiary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-fg-muted)'; e.currentTarget.style.background = 'none'; }}
        >
          Clear
        </button>
      </div>

      {/* Stats bar */}
      {tab === 'requests' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '3px 8px', borderBottom: '1px solid var(--theme-border)',
          background: 'var(--theme-bg-secondary)', flexShrink: 0,
        }}>
          <StatChip label="Requests" value={reqCount.toLocaleString()} />
          <StatChip label="Sent" value={formatBytes(totalBytes)} />
        </div>
      )}

      {/* Log entries */}
      <div style={{ flex: 1, overflow: 'auto', fontFamily: 'monospace', fontSize: 11 }}>
        {tab === 'requests' ? (
          serverRequests.length === 0 ? (
            <div style={{ padding: 12, color: 'var(--theme-fg-muted)', fontSize: 11 }}>
              No requests yet. Open the server URL to see activity.
            </div>
          ) : (
            [...serverRequests].reverse().map((log) => (
              <div key={log.id} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '3px 8px', borderBottom: '1px solid var(--theme-border-light)',
              }}>
                {/* Status */}
                <span style={{
                  fontSize: 10, fontWeight: 600, minWidth: 28, textAlign: 'center',
                  color: getStatusColor(log.statusCode),
                }}>
                  {log.statusCode}
                </span>
                {/* Method */}
                <span style={{ fontSize: 10, fontWeight: 600, minWidth: 30, color: 'var(--theme-accent)' }}>
                  {log.method}
                </span>
                {/* Path */}
                <span style={{
                  flex: 1, fontSize: 11, color: 'var(--theme-fg)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {log.path}
                </span>
                {/* Duration */}
                <span style={{ fontSize: 10, color: 'var(--theme-fg-dim)', flexShrink: 0 }}>
                  {log.durationMs}ms
                </span>
                {/* Time */}
                <span style={{ fontSize: 10, color: 'var(--theme-fg-dim)', flexShrink: 0, minWidth: 84 }}>
                  {formatTime(log.timestamp)}
                </span>
              </div>
            ))
          )
        ) : (
          serverFiles.length === 0 ? (
            <div style={{ padding: 12, color: 'var(--theme-fg-muted)', fontSize: 11 }}>
              No file changes detected yet. Edit a file to trigger live-reload.
            </div>
          ) : (
            [...serverFiles].map((log) => (
              <div key={log.id} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '3px 8px', borderBottom: '1px solid var(--theme-border-light)',
              }}>
                {/* Change type */}
                <span style={{
                  fontSize: 11, fontWeight: 700, minWidth: 14, textAlign: 'center',
                  color: CHANGE_COLOR[log.changeType] ?? 'var(--theme-fg)',
                }}>
                  {CHANGE_ICON[log.changeType] ?? '?'}
                </span>
                {/* File path */}
                <span style={{
                  flex: 1, fontSize: 11, color: 'var(--theme-fg)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {log.filePath}
                </span>
                {/* Time */}
                <span style={{ fontSize: 10, color: 'var(--theme-fg-dim)', flexShrink: 0, minWidth: 84 }}>
                  {formatTime(log.timestamp)}
                </span>
              </div>
            ))
          )
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
};

const StatChip: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)' }}>{label}</span>
    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-fg)', fontFamily: 'monospace' }}>{value}</span>
  </div>
);
