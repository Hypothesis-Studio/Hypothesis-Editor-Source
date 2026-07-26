/**
 * TunnelPanel - Main container for the Tunnels feature in the bottom panel.
 * Mirrors the VSCode port forwarding experience.
 */
import React, { useEffect, useCallback } from 'react';
import { useTunnelStore } from '../../stores/tunnelStore';
import { TunnelList } from './TunnelList';
import { TunnelForm } from './TunnelForm';
import { TunnelRequestLog } from './TunnelRequestLog';
import type { TunnelStatusChangedEvent, TunnelRequestEvent } from '../../../shared/types/tunnel';

export const TunnelPanel: React.FC = () => {
  const {
    tunnels,
    selectedTunnelId,
    loadTunnels,
    handleStatusChanged,
    handleRequest,
    closeAllTunnels,
    clearRequestLogs,
  } = useTunnelStore();

  // Load existing tunnels and subscribe to IPC events
  useEffect(() => {
    loadTunnels();

    const api = (window as any).api;
    if (!api?.tunnel) return;

    const unsubStatus = api.tunnel.onStatusChanged((evt: TunnelStatusChangedEvent) => {
      handleStatusChanged(evt);
    });

    const unsubRequest = api.tunnel.onRequest((evt: TunnelRequestEvent) => {
      handleRequest(evt);
    });

    return () => {
      unsubStatus?.();
      unsubRequest?.();
    };
  }, [loadTunnels, handleStatusChanged, handleRequest]);

  const handleCloseAll = useCallback(async () => {
    await closeAllTunnels();
  }, [closeAllTunnels]);

  const handleClearLogs = useCallback(() => {
    clearRequestLogs(selectedTunnelId ?? undefined);
  }, [clearRequestLogs, selectedTunnelId]);

  const activeTunnels = tunnels.filter((t) => t.status !== 'closed');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--theme-bg)' }}>
      {/* Body: form + list + logs */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <TunnelForm />
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'row' }}>
          <TunnelList />
          {selectedTunnelId && <TunnelRequestLog tunnelId={selectedTunnelId} />}
        </div>
      </div>
    </div>
  );
};

// ── Internal helpers ──────────────────────────────────────────────

const ToolbarButton: React.FC<{
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 3,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: 'var(--theme-fg-muted)',
      borderRadius: 3,
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.color = 'var(--theme-fg)';
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
