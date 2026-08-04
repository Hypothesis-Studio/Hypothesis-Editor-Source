/**
 * TunnelList - Renders all active tunnels in a table-style list.
 * Matches VSCode's Ports panel column layout: Port, Label, Status, Public URL, Actions.
 */
import React, { useState, useCallback } from 'react';
import { useTunnelStore } from '../../stores/tunnelStore';
import type { TunnelEntry, TunnelStatus } from '../../../shared/types/tunnel';

export const TunnelList: React.FC = () => {
  const { tunnels, selectedTunnelId, setSelectedTunnel, closeTunnel, copyUrl, openInBrowser, updateLabel } = useTunnelStore();

  const activeTunnels = tunnels.filter((t) => t.status !== 'closed');

  if (activeTunnels.length === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--theme-fg-muted)',
        fontSize: 12,
        gap: 6,
        padding: 16,
      }}>
        <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        <span>No forwarded ports. Enter a port above to expose it via a public tunnel URL.</span>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Header row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '60px 1fr 90px 1fr 80px',
        alignItems: 'center',
        height: 24,
        padding: '0 8px',
        borderBottom: '1px solid var(--theme-border)',
        background: 'var(--theme-bg-secondary)',
        flexShrink: 0,
      }}>
        {['Port', 'Label', 'Status', 'Public URL', 'Actions'].map((col) => (
          <span key={col} style={{ fontSize: 10, color: 'var(--theme-fg-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {col}
          </span>
        ))}
      </div>

      {/* Tunnel rows */}
      {activeTunnels.map((tunnel) => (
        <TunnelRow
          key={tunnel.id}
          tunnel={tunnel}
          isSelected={selectedTunnelId === tunnel.id}
          onSelect={() => setSelectedTunnel(tunnel.id === selectedTunnelId ? null : tunnel.id)}
          onClose={() => closeTunnel(tunnel.id)}
          onCopyUrl={() => copyUrl(tunnel.id)}
          onOpenBrowser={() => openInBrowser(tunnel.id)}
          onUpdateLabel={(label) => updateLabel(tunnel.id, label)}
        />
      ))}
    </div>
  );
};

// ── Tunnel Row ────────────────────────────────────────────────────

interface TunnelRowProps {
  tunnel: TunnelEntry;
  isSelected: boolean;
  onSelect: () => void;
  onClose: () => void;
  onCopyUrl: () => void;
  onOpenBrowser: () => void;
  onUpdateLabel: (label: string) => void;
}

const TunnelRow: React.FC<TunnelRowProps> = ({
  tunnel, isSelected, onSelect, onClose, onCopyUrl, onOpenBrowser, onUpdateLabel,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(tunnel.label);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  const handleLabelCommit = useCallback(() => {
    setEditingLabel(false);
    onUpdateLabel(labelDraft.trim() || tunnel.label);
  }, [labelDraft, onUpdateLabel, tunnel.label]);

  const handleCopyUrl = useCallback(async () => {
    onCopyUrl();
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 1500);
  }, [onCopyUrl]);

  const rowBg = isSelected
    ? 'var(--theme-list-active-bg, rgba(255,255,255,0.07))'
    : isHovered
    ? 'var(--theme-bg-hover, rgba(255,255,255,0.04))'
    : 'transparent';

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '60px 1fr 90px 1fr 80px',
        alignItems: 'center',
        height: 28,
        padding: '0 8px',
        borderBottom: '1px solid var(--theme-border-light, var(--theme-border))',
        background: rowBg,
        cursor: 'pointer',
        transition: 'background 0.1s',
        flexShrink: 0,
      }}
    >
      {/* Port */}
      <span style={{ fontSize: 12, fontFamily: 'var(--theme-font-mono, monospace)', color: 'var(--theme-fg)', fontWeight: 500 }}>
        {tunnel.localPort}
      </span>

      {/* Label (editable) */}
      <div style={{ overflow: 'hidden', paddingRight: 8 }}>
        {editingLabel ? (
          <input
            autoFocus
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={handleLabelCommit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLabelCommit();
              if (e.key === 'Escape') { setLabelDraft(tunnel.label); setEditingLabel(false); }
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', fontSize: 11, background: 'var(--theme-input-bg, var(--theme-bg-secondary))', color: 'var(--theme-fg)', border: '1px solid var(--theme-accent)', borderRadius: 3, padding: '1px 4px', outline: 'none' }}
          />
        ) : (
          <span
            title={tunnel.label}
            onDoubleClick={(e) => { e.stopPropagation(); setLabelDraft(tunnel.label); setEditingLabel(true); }}
            style={{ fontSize: 11, color: 'var(--theme-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
          >
            {tunnel.label}
          </span>
        )}
      </div>

      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <StatusDot status={tunnel.status} />
        <span style={{ fontSize: 11, color: statusColor(tunnel.status) }}>
          {statusLabel(tunnel.status)}
        </span>
      </div>

      {/* Public URL */}
      <div style={{ overflow: 'hidden', paddingRight: 4 }}>
        {tunnel.publicUrl ? (
          <a
            href={tunnel.publicUrl}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenBrowser(); }}
            title={tunnel.publicUrl}
            style={{ fontSize: 11, color: 'var(--theme-accent)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = 'underline'; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = 'none'; }}
          >
            {tunnel.publicUrl}
          </a>
        ) : tunnel.error ? (
          <span title={tunnel.error} style={{ fontSize: 11, color: 'var(--theme-error)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
            {tunnel.error}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--theme-fg-dim, var(--theme-fg-muted))' }}>—</span>
        )}
      </div>

      {/* Actions */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 2 }}
        onClick={(e) => e.stopPropagation()}
      >
        {tunnel.publicUrl && (
          <ActionButton title={copiedFeedback ? 'Copied!' : 'Copy URL'} onClick={handleCopyUrl}>
            {copiedFeedback ? (
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x={9} y={9} width={13} height={13} rx={2} ry={2} />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </ActionButton>
        )}
        {tunnel.publicUrl && (
          <ActionButton title="Open in browser" onClick={onOpenBrowser}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1={10} y1={14} x2={21} y2={3} />
            </svg>
          </ActionButton>
        )}
        <ActionButton title="Close tunnel" onClick={onClose} danger>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <line x1={18} y1={6} x2={6} y2={18} />
            <line x1={6} y1={6} x2={18} y2={18} />
          </svg>
        </ActionButton>
      </div>
    </div>
  );
};

// ── Status helpers ────────────────────────────────────────────────

const StatusDot: React.FC<{ status: TunnelStatus }> = ({ status }) => {
  const color = statusColor(status);
  const isPulse = status === 'connecting';
  return (
    <span style={{
      display: 'inline-block',
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: color,
      flexShrink: 0,
      animation: isPulse ? 'tunnel-pulse 1.2s ease-in-out infinite' : undefined,
    }}>
      <style>{`
        @keyframes tunnel-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </span>
  );
};

function statusColor(status: TunnelStatus): string {
  switch (status) {
    case 'connected':   return '#4ade80';
    case 'connecting':  return '#facc15';
    case 'downloading': return '#4fc1ff';
    case 'error':       return 'var(--theme-error)';
    case 'closed':      return 'var(--theme-fg-muted)';
  }
}

function statusLabel(status: TunnelStatus): string {
  switch (status) {
    case 'connected':   return 'Connected';
    case 'connecting':  return 'Connecting';
    case 'downloading': return 'Downloading';
    case 'error':       return 'Error';
    case 'closed':      return 'Closed';
  }
}

// ── Action button ─────────────────────────────────────────────────

const ActionButton: React.FC<{
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}> = ({ title, onClick, children, danger }) => (
  <button
    title={title}
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: 20, height: 20,
      background: 'none', border: 'none', cursor: 'pointer',
      color: 'var(--theme-fg-muted)', borderRadius: 3,
      padding: 0,
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.color = danger ? 'var(--theme-error)' : 'var(--theme-fg)';
      e.currentTarget.style.background = 'var(--theme-bg-tertiary)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.color = 'var(--theme-fg-muted)';
      e.currentTarget.style.background = 'none';
    }}
  >
    {children}
  </button>
);
