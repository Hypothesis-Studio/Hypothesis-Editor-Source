/**
 * AgentPanel - Main container for the AI Agent UI.
 * Contains chat, logs, and configuration views.
 */
import React, { useState, useEffect } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import { AgentChat } from './AgentChat';
import { AgentLogs } from './AgentLogs';
import { AgentConfig } from './AgentConfig';

type AgentTab = 'chat' | 'logs' | 'config';

interface AgentPanelProps {
  onOpenSettings?: (category?: string) => void;
}

export const AgentPanel: React.FC<AgentPanelProps> = ({ onOpenSettings }) => {
  const [activeTab, setActiveTab] = useState<AgentTab>('chat');
  const { loadAgentConfigs, loadSessions, loadProviders, loadTools, loadHealthStatus } = useAgentStore();

  useEffect(() => {
    loadAgentConfigs();
    loadSessions();
    loadProviders();
    loadTools();
    loadHealthStatus();
  }, []);

  const tabs: { id: AgentTab; label: string; icon: string }[] = [
    { id: 'chat', label: 'Chat', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
    { id: 'logs', label: 'Logs', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 'config', label: 'Config', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--theme-bg)' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        borderBottom: '1px solid var(--theme-border)',
        background: 'var(--theme-bg-secondary)',
        height: 36,
        paddingLeft: 8,
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0 14px', height: '100%',
              background: activeTab === tab.id ? 'var(--theme-bg)' : 'transparent',
              border: 'none', borderBottom: activeTab === tab.id ? '2px solid var(--theme-accent)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--theme-fg)' : 'var(--theme-fg-muted)',
              fontSize: 11, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <StatusIndicator />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'chat' && <AgentChat onOpenSettings={() => onOpenSettings?.('AI Agent')} />}
        {activeTab === 'logs' && <AgentLogs />}
        {activeTab === 'config' && <AgentConfig onOpenSettings={() => onOpenSettings?.('AI Agent')} />}
      </div>
    </div>
  );
};

const StatusIndicator: React.FC = () => {
  const { healthStatus, isStreaming } = useAgentStore();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 12 }}>
      {isStreaming && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 10, color: 'var(--theme-accent)',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--theme-accent)',
            animation: 'pulse 1.5s infinite',
          }} />
          Streaming
        </div>
      )}
      {healthStatus && (
        <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)' }}>
          {healthStatus.providers.connected}/{healthStatus.providers.total} providers
        </div>
      )}
    </div>
  );
};
