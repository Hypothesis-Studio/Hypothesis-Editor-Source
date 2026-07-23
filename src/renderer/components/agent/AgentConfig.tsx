/**
 * AgentConfig - Quick-access config overview inside the Agent editor tab.
 * Detailed configuration is in Settings → AI Agent (AgentSettingsPanel).
 */
import React, { useEffect } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import type { ToolDefinition, AgentConfig as AgentConfigType } from '../../../shared/types/agent';

interface AgentConfigProps {
  onOpenSettings?: () => void;
}

export const AgentConfig: React.FC<AgentConfigProps> = ({ onOpenSettings }) => {
  const { providers, agentConfigs, tools, healthStatus, loadProviders, loadAgentConfigs, loadTools, loadHealthStatus, enableTool, disableTool } = useAgentStore();

  useEffect(() => {
    loadProviders();
    loadAgentConfigs();
    loadTools();
    loadHealthStatus();
    const interval = setInterval(loadHealthStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const enabledProviders = providers.filter(p => p.enabled);
  const totalModels = providers.reduce((sum, p) => sum + (p.models?.length ?? 0), 0);
  const enabledTools = tools.filter(t => t.enabled);

  return (
    <div style={{ padding: 16, overflow: 'auto', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', margin: 0 }}>Agent Overview</h3>
        <div style={{ flex: 1 }} />
        <button onClick={onOpenSettings} style={primaryBtn}>Open Full Settings</button>
      </div>

      {/* Health cards */}
      {healthStatus && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginBottom: 16 }}>
          <HealthCard label="Agents" value={String(healthStatus.agents)} />
          <HealthCard label="Providers" value={`${healthStatus.providers.connected}/${healthStatus.providers.total}`} color={healthStatus.providers.connected > 0 ? 'var(--theme-accent)' : 'var(--theme-fg)'} />
          <HealthCard label="Models" value={String(totalModels)} />
          <HealthCard label="Tools" value={`${enabledTools.length}/${tools.length}`} />
          <HealthCard label="Memory" value={String(healthStatus.memoryEntries)} />
        </div>
      )}

      {/* Agent profiles */}
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-fg-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          Agent Profiles
        </h4>
        {agentConfigs.length === 0 ? (
          <div style={emptyCard}>No agent profiles. Create one in Settings → AI Agent → Agent Profiles.</div>
        ) : agentConfigs.map((agent) => {
          const provider = providers.find(p => p.id === agent.providerId);
          return (
            <div key={agent.id} style={cardStyle}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--theme-fg)' }}>{agent.name}</div>
              <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)', marginTop: 2 }}>
                {provider?.name || 'No provider'} · {agent.modelId || 'No model'} · temp={agent.temperature} · streaming={agent.streaming ? 'on' : 'off'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)', marginTop: 4, display: 'flex', gap: 12 }}>
                <span>Max Tokens: {agent.maxTokens}</span>
                <span>Memory: {agent.memoryEnabled ? `${agent.memoryMaxTokens}` : 'off'}</span>
                <span>Max Turns: {agent.maxTurns}</span>
                <span>Tools: {agent.enabledTools.length}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Providers summary */}
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-fg-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          Providers
        </h4>
        {providers.length === 0 ? (
          <div style={emptyCard}>No providers configured. Add one in Settings → AI Agent → Providers.</div>
        ) : providers.map((p) => (
          <div key={p.id} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.enabled ? 'var(--theme-accent)' : 'var(--theme-fg-muted)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--theme-fg)' }}>{p.name}</div>
                <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)' }}>
                  {p.type} · {p.models?.length || 0} models
                </div>
              </div>
              <span style={{
                fontSize: 9, padding: '1px 6px', borderRadius: 3,
                background: p.enabled ? 'rgba(99,102,241,0.15)' : 'rgba(158,158,158,0.15)',
                color: p.enabled ? 'var(--theme-accent)' : 'var(--theme-fg-muted)',
              }}>
                {p.enabled ? 'Active' : 'Disabled'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Tools quick toggle */}
      <div>
        <h4 style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-fg-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          Tools
        </h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => tool.enabled ? disableTool(tool.id) : enableTool(tool.id)}
              style={{
                padding: '4px 10px', borderRadius: 12, border: '1px solid var(--theme-border)',
                background: tool.enabled ? 'rgba(76,175,80,0.1)' : 'var(--theme-bg-tertiary)',
                color: tool.enabled ? 'var(--theme-accent)' : 'var(--theme-fg-muted)',
                fontSize: 10, cursor: 'pointer', transition: 'all 0.15s',
              }}
              title={tool.description}
            >
              {tool.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const HealthCard: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div style={{ background: 'var(--theme-bg-secondary)', borderRadius: 6, border: '1px solid var(--theme-border)', padding: '8px 10px' }}>
    <div style={{ fontSize: 18, fontWeight: 600, color: color || 'var(--theme-fg)' }}>{value}</div>
    <div style={{ fontSize: 9, color: 'var(--theme-fg-muted)', marginTop: 2 }}>{label}</div>
  </div>
);

const cardStyle: React.CSSProperties = {
  background: 'var(--theme-bg-secondary)', borderRadius: 6,
  border: '1px solid var(--theme-border)', padding: '8px 12px', marginBottom: 6,
};

const emptyCard: React.CSSProperties = {
  ...cardStyle, textAlign: 'center', color: 'var(--theme-fg-muted)', fontSize: 11, padding: 16,
};

const primaryBtn: React.CSSProperties = {
  background: 'var(--theme-accent)', border: 'none', borderRadius: 4,
  padding: '5px 12px', fontSize: 11, color: '#fff', cursor: 'pointer',
};
