/**
 * LiveServerPanel - Main container for the Live Server panel.
 */
import React, { useEffect } from 'react';
import { useLiveServerStore } from '../../stores/liveServerStore';
import { LiveServerForm } from './LiveServerForm';
import { LiveServerList } from './LiveServerList';
import { LiveServerRequestLog } from './LiveServerRequestLog';

export const LiveServerPanel: React.FC = () => {
  const { loadServers, servers, selectedServerId } = useLiveServerStore();

  useEffect(() => {
    loadServers();
  }, []);

  const hasSelected = !!selectedServerId && servers.some((s) => s.id === selectedServerId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--theme-bg)', overflow: 'hidden' }}>
      <LiveServerForm />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <LiveServerList />
        {hasSelected && (
          <LiveServerRequestLog serverId={selectedServerId!} />
        )}
      </div>
    </div>
  );
};
