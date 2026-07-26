/**
 * TunnelRequestLog - Shows per-tunnel HTTP request activity log.
 * Displayed as a side pane when a tunnel row is selected.
 */
import React, { useRef, useEffect } from 'react';
import { useTunnelStore } from '../../stores/tunnelStore';

interface Props {
  tunnelId: string;
}

export const TunnelRequestLog: React.FC<Props> = ({ tunnelId }) => {
  const { requestLogs, tunnels, clearRequestLogs } = useTunnelStore();
  const endRef = useRef<HTMLDivElement>(null);

  const tunnel = tunnels.find((t) => t.id === tunnelId);
  const logs = requestLogs.filter((l) => l.tunnelId === tunnelId);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  return (
    <div style={{
      width: 320,
      flexShrink: 0,
      borderLeft: '1px solid var(--theme-border)',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--theme-bg)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        height: 28,
        padding: '0 8px',
        borderBottom: '1px solid var(--theme-border)',
        flexShrink: 0,
        gap: 6,
      }}>
        <span style={{ fontSize: 11, color: 'var(--theme-fg)', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tunnel?.label ?? 'Requests'}
        </span>
        {logs.length > 0 && (
          <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)' }}>{logs.length}</span>
        )}
        <button
          onClick={() => clearRequestLogs(tunnelId)}
          title="Clear logs"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-fg-muted)', borderRadius: 3, padding: 0 }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-fg)'; e.currentTarget.style.background = 'var(--theme-bg-tertiary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-fg-muted)'; e.currentTarget.style.background = 'none'; }}
        >
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
          </svg>
        </button>
      </div>

      {/* Stats bar */}
      {tunnel && (
        <div style={{
          display: 'flex',
          gap: 12,
          padding: '4px 8px',
          borderBottom: '1px solid var(--theme-border)',
          flexShrink: 0,
        }}>
          <StatChip label="Requests" value={String(tunnel.requestCount)} />
          <StatChip label="In" value={formatBytes(tunnel.bytesIn)} />
          <StatChip label="Out" value={formatBytes(tunnel.bytesOut)} />
        </div>
      )}

      {/* Log entries */}
      <div style={{ flex: 1, overflow: 'auto', fontFamily: 'var(--theme-font-mono, monospace)', fontSize: 11 }}>
        {logs.length === 0 ? (
          <div style={{ padding: 12, color: 'var(--theme-fg-muted)', textAlign: 'center', fontSize: 11 }}>
            Waiting for requests…
          </div>
        ) : (
          logs.map((log) => {
            const ts = new Date(log.timestamp);
            const timeStr = `${ts.getHours().toString().padStart(2, '0')}:${ts.getMinutes().toString().padStart(2, '0')}:${ts.getSeconds().toString().padStart(2, '0')}`;
            const isError = log.statusCode >= 500;
            const isWarn = log.statusCode >= 400 && log.statusCode < 500;

            return (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '2px 8px',
                  borderBottom: '1px solid var(--theme-border-light, var(--theme-border))',
                }}
              >
                <span style={{ color: 'var(--theme-fg-dim, var(--theme-fg-muted))', fontSize: 10, flexShrink: 0, minWidth: 54 }}>{timeStr}</span>
                <span style={{ fontWeight: 600, color: methodColor(log.method), flexShrink: 0, minWidth: 36 }}>{log.method}</span>
                <span style={{
                  color: isError ? 'var(--theme-error)' : isWarn ? '#facc15' : '#4ade80',
                  flexShrink: 0,
                  minWidth: 28,
                }}>
                  {log.statusCode}
                </span>
                <span style={{ color: 'var(--theme-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={log.path}>
                  {log.path}
                </span>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────

const StatChip: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
    <span style={{ fontSize: 9, color: 'var(--theme-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
    <span style={{ fontSize: 11, color: 'var(--theme-fg)', fontWeight: 600 }}>{value}</span>
  </div>
);

function methodColor(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':    return '#4ade80';
    case 'POST':   return '#60a5fa';
    case 'PUT':    return '#facc15';
    case 'PATCH':  return '#fb923c';
    case 'DELETE': return 'var(--theme-error)';
    default:       return 'var(--theme-fg-muted)';
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
