/**
 * LiveServerList - VSCode-style table of running live servers.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLiveServerStore } from '../../stores/liveServerStore';
import type { LiveServerEntry } from '../../../shared/types/live-server';

const STATUS_DOT: Record<string, { color: string; animated: boolean }> = {
  starting: { color: '#e5a500', animated: true },
  running:  { color: '#4ade80', animated: false },
  error:    { color: 'var(--theme-error)', animated: false },
  stopped:  { color: 'var(--theme-fg-dim)', animated: false },
};

const StatusDot: React.FC<{ status: string }> = ({ status }) => {
  const { color, animated } = STATUS_DOT[status] ?? STATUS_DOT.stopped;
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: color, flexShrink: 0,
      boxShadow: animated ? `0 0 0 0 ${color}` : undefined,
      animation: animated ? 'ls-pulse 1.2s ease-out infinite' : undefined,
    }} />
  );
};

export const LiveServerList: React.FC = () => {
  const {
    servers, selectedServerId,
    setSelectedServer, stopServer, stopAllServers,
    copyUrl, openInBrowser, openFolder, updateLabel,
    clearRequestLogs, clearFileLogs,
  } = useLiveServerStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) editRef.current?.focus();
  }, [editingId]);

  const startEdit = (server: LiveServerEntry) => {
    setEditingId(server.id);
    setEditValue(server.label);
  };

  const commitEdit = useCallback((id: string) => {
    updateLabel(id, editValue);
    setEditingId(null);
  }, [editValue, updateLabel]);

  const cancelEdit = () => setEditingId(null);

  if (servers.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 8, color: 'var(--theme-fg-muted)', fontSize: 12,
      }}>
        <style>{`@keyframes ls-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,.4)} 50%{box-shadow:0 0 0 5px rgba(74,222,128,0)} }`}</style>
        <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
          <circle cx={12} cy={12} r={10} />
          <line x1={2} y1={12} x2={22} y2={12} />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span>No live servers running</span>
        <span style={{ fontSize: 11, opacity: 0.6 }}>Pick a folder and click Start Server</span>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      <style>{`
        @keyframes ls-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,.4)} 50%{box-shadow:0 0 0 5px rgba(74,222,128,0)} }
        .ls-row:hover .ls-actions { opacity: 1 !important; }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '22px 1fr 140px 80px 90px 90px',
        gap: 0, padding: '3px 8px',
        borderBottom: '1px solid var(--theme-border)',
        background: 'var(--theme-bg-secondary)',
      }}>
        {['', 'Label / Path', 'URL', 'Port', 'Requests', 'Actions'].map((h) => (
          <span key={h} style={{ fontSize: 10, color: 'var(--theme-fg-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 4px' }}>{h}</span>
        ))}
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {servers.map((server) => {
          const isSelected = selectedServerId === server.id;
          const isRunning = server.status === 'running';
          return (
            <div
              key={server.id}
              className="ls-row"
              onClick={() => setSelectedServer(isSelected ? null : server.id)}
              onMouseEnter={() => setHoveredId(server.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'grid',
                gridTemplateColumns: '22px 1fr 140px 80px 90px 90px',
                gap: 0,
                padding: '4px 8px',
                borderBottom: '1px solid var(--theme-border-light)',
                background: isSelected ? 'var(--theme-bg-active, var(--theme-accent)12)' : hoveredId === server.id ? 'var(--theme-bg-hover)' : 'transparent',
                cursor: 'pointer',
                alignItems: 'center',
                transition: 'background 0.1s',
              }}
            >
              {/* Status dot */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <StatusDot status={server.status} />
              </div>

              {/* Label + path */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '0 4px', minWidth: 0 }}>
                {editingId === server.id ? (
                  <input
                    ref={editRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => commitEdit(server.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit(server.id);
                      if (e.key === 'Escape') cancelEdit();
                      e.stopPropagation();
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      fontSize: 12, fontWeight: 500,
                      background: 'var(--theme-input-bg, var(--theme-bg-secondary))',
                      color: 'var(--theme-fg)',
                      border: '1px solid var(--theme-accent)',
                      borderRadius: 3, padding: '1px 4px', outline: 'none', width: '90%',
                    }}
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => { e.stopPropagation(); startEdit(server); }}
                    title="Double-click to rename"
                    style={{
                      fontSize: 12, fontWeight: 500, color: 'var(--theme-fg)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                  >
                    {server.label}
                  </span>
                )}
                <span style={{
                  fontSize: 10, color: 'var(--theme-fg-muted)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {server.rootPath}
                </span>
                {server.error && (
                  <span style={{ fontSize: 10, color: 'var(--theme-error)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {server.error}
                  </span>
                )}
              </div>

              {/* URL */}
              <div style={{ padding: '0 4px' }}>
                {isRunning ? (
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); openInBrowser(server.id); }}
                    style={{
                      fontSize: 11, color: 'var(--theme-accent)',
                      textDecoration: 'none', whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis', display: 'block',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                  >
                    {server.url}
                  </a>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--theme-fg-dim)' }}>—</span>
                )}
              </div>

              {/* Port */}
              <div style={{ padding: '0 4px' }}>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--theme-fg)' }}>{server.port}</span>
                {server.protocol === 'https' && (
                  <span style={{ marginLeft: 4, fontSize: 9, color: '#4ade80', fontWeight: 600 }}>TLS</span>
                )}
              </div>

              {/* Request count */}
              <div style={{ padding: '0 4px' }}>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--theme-fg-muted)' }}>
                  {server.requestCount.toLocaleString()}
                </span>
              </div>

              {/* Actions */}
              <div
                className="ls-actions"
                style={{ display: 'flex', alignItems: 'center', gap: 3, opacity: 1, padding: '0 4px' }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Copy URL */}
                {isRunning && (
                  <IconBtn title="Copy URL" onClick={() => copyUrl(server.id)}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x={9} y={9} width={13} height={13} rx={2} ry={2} />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </IconBtn>
                )}
                {/* Open in browser */}
                {isRunning && (
                  <IconBtn title="Open in browser" onClick={() => openInBrowser(server.id)}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1={10} y1={14} x2={21} y2={3} />
                    </svg>
                  </IconBtn>
                )}
                {/* Open folder */}
                <IconBtn title="Show in explorer" onClick={() => openFolder(server.id)}>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </IconBtn>
                {/* Stop */}
                <IconBtn title="Stop server" danger onClick={() => stopServer(server.id)}>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x={3} y={3} width={18} height={18} rx={2} ry={2} />
                  </svg>
                </IconBtn>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {servers.length > 1 && (
        <div style={{
          padding: '4px 8px', borderTop: '1px solid var(--theme-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          background: 'var(--theme-bg-secondary)',
        }}>
          <button
            onClick={stopAllServers}
            style={{
              fontSize: 11, padding: '2px 10px', background: 'none',
              border: '1px solid var(--theme-border)', borderRadius: 3,
              color: 'var(--theme-fg-muted)', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-error)'; e.currentTarget.style.borderColor = 'var(--theme-error)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-fg-muted)'; e.currentTarget.style.borderColor = 'var(--theme-border)'; }}
          >
            Stop All
          </button>
        </div>
      )}
    </div>
  );
};

const IconBtn: React.FC<{ title: string; onClick: () => void; children: React.ReactNode; danger?: boolean }> = ({ title, onClick, children, danger }) => (
  <button
    title={title}
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: 20, height: 20, padding: 0, background: 'none', border: 'none',
      borderRadius: 3, cursor: 'pointer',
      color: danger ? 'var(--theme-error)' : 'var(--theme-fg-muted)',
      transition: 'background 0.1s, color 0.1s',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'var(--theme-bg-tertiary)';
      e.currentTarget.style.color = danger ? 'var(--theme-error)' : 'var(--theme-fg)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'none';
      e.currentTarget.style.color = danger ? 'var(--theme-error)' : 'var(--theme-fg-muted)';
    }}
  >
    {children}
  </button>
);
