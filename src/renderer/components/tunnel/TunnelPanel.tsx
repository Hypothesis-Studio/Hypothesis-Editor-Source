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
    downloadProgress,
    setDownloadProgress,
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

    const unsubDownload = api.tunnel.onDownloadProgress?.((evt: { percent: number; message: string }) => {
      setDownloadProgress(evt.percent >= 100 ? null : evt);
    });

    return () => {
      unsubStatus?.();
      unsubRequest?.();
      unsubDownload?.();
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
        {downloadProgress && (
          <div style={{
            padding: '6px 10px',
            background: 'var(--theme-bg-secondary)',
            borderBottom: '1px solid var(--theme-border)',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'var(--theme-fg-muted)' }}>{downloadProgress.message}</span>
              {downloadProgress.percent >= 0 && (
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-accent)' }}>{downloadProgress.percent}%</span>
              )}
            </div>
            {downloadProgress.percent >= 0 && (
              <div style={{ height: 4, borderRadius: 2, background: 'var(--theme-border)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  background: 'var(--theme-accent)',
                  width: `${downloadProgress.percent}%`,
                  transition: 'width 0.2s ease',
                }} />
              </div>
            )}
          </div>
        )}
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
