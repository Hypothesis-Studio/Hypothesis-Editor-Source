/**
 * Agent Settings Panel - Dedicated AI Agent configuration within Settings.
 * Provides provider management, agent config, tools, and system health.
 * Aligned with the multi-turn tool execution architecture.
 */
import React, { useState, useEffect } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { AIProviderConfig, AgentConfig as AgentConfigType, AIProviderType } from '../../../shared/types/agent';

// Load profile avatar SVGs eagerly
const profileSvgs = import.meta.glob('/src/renderer/assets/icons/profile/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const PROFILE_AVATARS: string[] = Object.values(profileSvgs);

type SettingsSection = 'providers' | 'agents' | 'tools' | 'source-control' | 'chat' | 'system';

export const AgentSettingsPanel: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('providers');
  const { providers, agentConfigs, tools, healthStatus, loadProviders, loadAgentConfigs, loadTools, loadHealthStatus } = useAgentStore();

  useEffect(() => {
    loadProviders();
    loadAgentConfigs();
    loadTools();
    loadHealthStatus();
    const interval = setInterval(loadHealthStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const sections: { id: SettingsSection; label: string; count?: number }[] = [
    { id: 'providers', label: 'Providers', count: providers.length },
    { id: 'agents', label: 'Agent Profiles', count: agentConfigs.length },
    { id: 'tools', label: 'Tools', count: tools.length },
    { id: 'source-control', label: 'Source Control' },
    { id: 'chat', label: 'Chat Collaboration' },
    { id: 'system', label: 'System & Health' },
  ];

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--theme-bg)' }}>
      {/* Section nav */}
      <div style={{
        width: 180, borderRight: '1px solid var(--theme-border)',
        overflowY: 'auto', background: 'var(--theme-bg-secondary)',
      }}>
        <div style={{
          padding: '10px 14px', fontSize: 11, fontWeight: 600,
          color: 'var(--theme-fg)', borderBottom: '1px solid var(--theme-border)',
        }}>
          AI Agent
        </div>
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            style={{
              width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 11,
              border: 'none', cursor: 'pointer',
              background: activeSection === s.id ? 'var(--theme-bg-active)' : 'transparent',
              color: activeSection === s.id ? 'var(--theme-fg)' : 'var(--theme-fg-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <span>{s.label}</span>
            {s.count !== undefined && (
              <span style={{ fontSize: 9, opacity: 0.6 }}>{s.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {activeSection === 'providers' && <ProvidersSection />}
        {activeSection === 'agents' && <AgentsSection />}
        {activeSection === 'tools' && <ToolsSection />}
        {activeSection === 'source-control' && <SourceControlSection />}
        {activeSection === 'chat' && <ChatCollaborationSection />}
        {activeSection === 'system' && <SystemSection />}
      </div>
    </div>
  );
};

// ── Providers Section ──────────────────────────────────────────
// ── Chat Collaboration Section ───────────────────────────────

const ChatCollaborationSection: React.FC = () => {
  const { agentConfigs } = useAgentStore();
  const { settings, setSetting } = useSettingsStore();
  const currentAgentId = (settings['chat.aiAgentId'] as string) || '';
  const selectedAgent = agentConfigs.find(a => a.id === currentAgentId) ?? agentConfigs[0] ?? null;

  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', margin: '0 0 8px' }}>Chat Collaboration</h3>
      <p style={{ fontSize: 11, color: 'var(--theme-fg-muted)', marginBottom: 16 }}>
        Select the AI agent used when someone mentions <code style={{ background: 'var(--theme-bg-tertiary)', padding: '1px 5px', borderRadius: 3, fontSize: 10 }}>@ai</code> in a chat room.
        The selected agent will respond to mentions in all hosted rooms.
      </p>

      {agentConfigs.length === 0 ? (
        <div style={{
          padding: '16px 20px', borderRadius: 6, border: '1px solid var(--theme-border)',
          background: 'var(--theme-bg-secondary)', fontSize: 11, color: 'var(--theme-fg-muted)',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ color: 'var(--theme-warning, #f59e0b)', fontWeight: 500 }}>⚠ No AI agents configured yet</div>
          <div>Open the <strong>Agent Profiles</strong> tab to create an agent first.</div>
        </div>
      ) : (
        <div style={cardStyle}>
          <label style={{ ...labelStyle, fontSize: 11, marginBottom: 8, display: 'block' }}>Agent for @ai mentions</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Default option */}
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 8px', borderRadius: 4,
              background: !currentAgentId ? 'var(--theme-bg-active)' : 'transparent',
              border: !currentAgentId ? '1px solid var(--theme-accent)' : '1px solid transparent',
            }}>
              <input type="radio" name="chatAgent" value=""
                checked={!currentAgentId}
                onChange={() => setSetting('chat.aiAgentId', '')}
                style={{ accentColor: 'var(--theme-accent)' }}
              />
              <div>
                <div style={{ fontSize: 11, color: 'var(--theme-fg)', fontWeight: 500 }}>
                  Auto (first agent) {agentConfigs[0] ? `— ${agentConfigs[0].name}` : ''}
                </div>
                <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)' }}>Always use first agent from Agent Profiles list</div>
              </div>
            </label>

            {/* Per-agent options */}
            {agentConfigs.map(agent => {
              const isSelected = currentAgentId === agent.id;
              return (
                <label key={agent.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 8px', borderRadius: 4,
                  background: isSelected ? 'var(--theme-bg-active)' : 'transparent',
                  border: isSelected ? '1px solid var(--theme-accent)' : '1px solid transparent',
                }}>
                  <input type="radio" name="chatAgent" value={agent.id}
                    checked={isSelected}
                    onChange={() => setSetting('chat.aiAgentId', agent.id)}
                    style={{ accentColor: 'var(--theme-accent)' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--theme-fg)', fontWeight: 500 }}>{agent.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {agent.modelId || 'No model'} · temp={agent.temperature}
                    </div>
                  </div>
                  {/* Robot icon badge */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--theme-fg-muted)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="8" width="18" height="12" rx="2" />
                    <path d="M9 8V6a3 3 0 016 0v2" />
                    <circle cx="9" cy="14" r="1.5" fill="var(--theme-fg-muted)" stroke="none" />
                    <circle cx="15" cy="14" r="1.5" fill="var(--theme-fg-muted)" stroke="none" />
                    <path d="M9 18h6" />
                    <path d="M12 2v2" />
                  </svg>
                </label>
              );
            })}
          </div>

          {selectedAgent && (
            <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 4, background: 'var(--theme-bg-tertiary)', fontSize: 10, color: 'var(--theme-fg-muted)' }}>
              <strong style={{ color: 'var(--theme-fg)' }}>Agent aktif:</strong> {selectedAgent.name}
              {selectedAgent.modelId && <> · <span>{selectedAgent.modelId}</span></>}
              {!selectedAgent.providerId && (
                <span style={{ color: 'var(--theme-warning, #f59e0b)', marginLeft: 8 }}>⚠ Provider not configured</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Source Control Section ────────────────────────────────────

const SourceControlSection: React.FC = () => {
  const { agentConfigs } = useAgentStore();
  const { settings, setSetting } = useSettingsStore();
  const currentAgentId = (settings['git.commitMessageAgentId'] as string) || '';

  const selectedAgent = agentConfigs.find(a => a.id === currentAgentId) ?? agentConfigs[0] ?? null;

  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', margin: '0 0 8px' }}>Source Control</h3>
      <p style={{ fontSize: 11, color: 'var(--theme-fg-muted)', marginBottom: 16 }}>
        Select the AI agent used for Source Control features like automatic commit message generation.
        Defaults to using the first available agent.
      </p>

      {agentConfigs.length === 0 ? (
        <div style={{
          padding: '16px 20px', borderRadius: 6, border: '1px solid var(--theme-border)',
          background: 'var(--theme-bg-secondary)', fontSize: 11, color: 'var(--theme-fg-muted)',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ color: 'var(--theme-warning, #f59e0b)', fontWeight: 500 }}>⚠ No AI agents configured yet</div>
          <div>Open the <strong>Agent Profiles</strong> tab to create an agent, then select a provider and model first.</div>
        </div>
      ) : (
        <div style={cardStyle}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ ...labelStyle, fontSize: 11, marginBottom: 6 }}>Agent for Commit Message Generator</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Default option */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 8px', borderRadius: 4,
                background: !currentAgentId ? 'var(--theme-bg-active)' : 'transparent',
                border: !currentAgentId ? '1px solid var(--theme-accent)' : '1px solid transparent',
              }}>
                <input type="radio" name="commitAgent" value=""
                  checked={!currentAgentId}
                  onChange={() => setSetting('git.commitMessageAgentId', '')}
                  style={{ accentColor: 'var(--theme-accent)' }}
                />
                <div>
                  <div style={{ fontSize: 11, color: 'var(--theme-fg)', fontWeight: 500 }}>
                    Auto (first agent) {agentConfigs[0] ? `— ${agentConfigs[0].name}` : ''}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)' }}>Always use first agent from Agent Profiles list</div>
                </div>
              </label>

              {/* Per-agent options */}
              {agentConfigs.map(agent => (
                <label key={agent.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 8px', borderRadius: 4,
                  background: currentAgentId === agent.id ? 'var(--theme-bg-active)' : 'transparent',
                  border: currentAgentId === agent.id ? '1px solid var(--theme-accent)' : '1px solid transparent',
                }}>
                  <input type="radio" name="commitAgent" value={agent.id}
                    checked={currentAgentId === agent.id}
                    onChange={() => setSetting('git.commitMessageAgentId', agent.id)}
                    style={{ accentColor: 'var(--theme-accent)' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--theme-fg)', fontWeight: 500 }}>{agent.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {agent.modelId || 'No model'} · temp={agent.temperature}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {selectedAgent && (
            <div style={{ padding: '8px 10px', borderRadius: 4, background: 'var(--theme-bg-tertiary)', fontSize: 10, color: 'var(--theme-fg-muted)' }}>
              <strong style={{ color: 'var(--theme-fg)' }}>Agent aktif:</strong> {selectedAgent.name}
              {selectedAgent.modelId && <> · <span>{selectedAgent.modelId}</span></>}
              {!selectedAgent.providerId && (
                <span style={{ color: 'var(--theme-warning, #f59e0b)', marginLeft: 8 }}>⚠ Provider not configured</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};


const ProvidersSection: React.FC = () => {
  const { providers, addProvider, updateProvider, removeProvider, testProvider, fetchModels } = useAgentStore();
  const [showAdd, setShowAdd] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; latencyMs: number } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ id: string; success: boolean; count: number; error?: string } | null>(null);

  const handleTest = async (id: string) => {
    setTesting(id);
    setTestResult(null);
    const result = await testProvider(id);
    setTestResult(result ? { id, ...result } : null);
    setTesting(null);
    setTimeout(() => setTestResult(null), 8000);
  };

  const handleSyncModels = async (id: string) => {
    setSyncing(id);
    setSyncResult(null);
    try {
      await fetchModels(id);
      const provider = providers.find(p => p.id === id);
      setSyncResult({ id, success: true, count: provider?.models?.length ?? 0 });
    } catch (err) {
      setSyncResult({ id, success: false, count: 0, error: (err as Error).message });
    }
    setSyncing(null);
    setTimeout(() => setSyncResult(null), 8000);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', margin: 0 }}>AI Providers</h3>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowAdd(!showAdd)} style={primaryBtn}>
          + Add Provider
        </button>
      </div>

      <p style={{ fontSize: 11, color: 'var(--theme-fg-muted)', marginBottom: 16 }}>
        Configure AI gateway providers (OpenRouter, 9Router, OpenAI-compatible). API keys are stored securely.
      </p>

      {showAdd && <AddProviderForm onAdd={(c) => { addProvider(c); setShowAdd(false); }} onCancel={() => setShowAdd(false)} />}

      {providers.length === 0 && !showAdd && (
        <div style={emptyState}>
          <p style={{ margin: 0 }}>No providers configured yet.</p>
          <p style={{ margin: '4px 0 0', fontSize: 10 }}>Add an OpenRouter, 9Router, or OpenAI-compatible provider to get started.</p>
        </div>
      )}

      {providers.map((p) => (
        <div key={p.id} style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.enabled ? 'var(--theme-accent)' : 'var(--theme-fg-muted)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--theme-fg)' }}>{p.name}</div>
              <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)' }}>
                {p.type} · {p.models?.length || 0} models · {p.baseUrl.replace(/\/v1\/?$/, '')}
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); handleTest(p.id); }} style={smallBtn} disabled={testing === p.id}>
              {testing === p.id ? '⟳ Testing...' : 'Test'}
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleSyncModels(p.id); }} style={smallBtn} disabled={syncing === p.id}>
              {syncing === p.id ? '⟳ Syncing...' : 'Sync Models'}
            </button>
            <button onClick={(e) => { e.stopPropagation(); updateProvider(p.id, { enabled: !p.enabled }); }} style={smallBtn}>
              {p.enabled ? 'Disable' : 'Enable'}
            </button>
            <button onClick={(e) => { e.stopPropagation(); removeProvider(p.id); }} style={{ ...smallBtn, color: 'var(--theme-error)' }}>Remove</button>
          </div>
          {testResult?.id === p.id && (
            <div style={{ marginTop: 6, padding: '4px 8px', borderRadius: 3, fontSize: 10,
              background: testResult.success ? 'rgba(99,102,241,0.1)' : 'rgba(244,67,54,0.1)',
              color: testResult.success ? 'var(--theme-accent)' : 'var(--theme-error)' }}>
              {testResult.success ? `✓ Connected (${testResult.latencyMs}ms)` : '✗ Connection failed'}
            </div>
          )}
          {syncResult?.id === p.id && (
            <div style={{ marginTop: 6, padding: '4px 8px', borderRadius: 3, fontSize: 10,
              background: syncResult.success ? 'rgba(99,102,241,0.1)' : 'rgba(244,67,54,0.1)',
              color: syncResult.success ? 'var(--theme-accent)' : 'var(--theme-error)' }}>
              {syncResult.success ? `✓ Synced ${syncResult.count} models` : `✗ Sync failed: ${syncResult.error}`}
            </div>
          )}
          {expandedId === p.id && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--theme-border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10, color: 'var(--theme-fg-muted)' }}>
                <div><strong>Base URL:</strong> {p.baseUrl}</div>
                <div><strong>Type:</strong> {p.type}</div>
                <div><strong>Timeout:</strong> {p.timeout ?? 60000}ms</div>
                <div><strong>Max Retries:</strong> {p.maxRetries ?? 3}</div>
                {p.rateLimit && <div><strong>Rate Limit:</strong> {p.rateLimit.requestsPerMinute} req/min</div>}
              </div>
              {p.models && p.models.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--theme-fg-muted)', marginBottom: 4 }}>MODELS</div>
                  <div style={{ maxHeight: 120, overflow: 'auto' }}>
                    {p.models.map((m) => (
                      <div key={m.id} style={{ fontSize: 10, padding: '2px 0', color: 'var(--theme-fg)' }}>
                        {m.name} <span style={{ color: 'var(--theme-fg-muted)' }}>({m.contextWindow} ctx)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const AddProviderForm: React.FC<{ onAdd: (c: AIProviderConfig) => void; onCancel: () => void }> = ({ onAdd, onCancel }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<AIProviderType>('openai-compatible');
  const [baseUrl, setBaseUrl] = useState('https://openrouter.ai/api/v1');
  const [apiKey, setApiKey] = useState('');

  const presets: Array<{ label: string; type: AIProviderType; url: string }> = [
    { label: 'OpenRouter', type: 'openrouter', url: 'https://openrouter.ai/api/v1' },
    { label: '9Router', type: 'ninerouter', url: 'https://api.9router.com/v1' },
    { label: 'OpenAI', type: 'openai-compatible', url: 'https://api.openai.com/v1' },
    { label: 'Groq', type: 'openai-compatible', url: 'https://api.groq.com/openai/v1' },
    { label: 'Together AI', type: 'openai-compatible', url: 'https://api.together.xyz/v1' },
    { label: 'Custom', type: 'custom', url: '' },
  ];

  return (
    <div style={{ ...cardStyle, borderColor: 'var(--theme-accent)', marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-fg)', marginBottom: 10 }}>Quick Presets</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {presets.map((p) => (
          <button key={p.label} onClick={() => { setName(p.label); setType(p.type); setBaseUrl(p.url); }} style={{
            ...smallBtn, background: name === p.label ? 'var(--theme-accent)' : undefined,
            color: name === p.label ? '#fff' : undefined,
          }}>{p.label}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <Field label="Name" value={name} onChange={setName} placeholder="My Provider" />
        <div>
          <label style={labelStyle}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as AIProviderType)} style={inputStyle}>
            <option value="openai-compatible">OpenAI Compatible</option>
            <option value="openrouter">OpenRouter</option>
            <option value="ninerouter">9Router</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>
      <Field label="Base URL" value={baseUrl} onChange={setBaseUrl} placeholder="https://api.openai.com/v1" />
      <Field label="API Key" value={apiKey} onChange={setApiKey} placeholder="sk-..." type="password" />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        <button onClick={onCancel} style={smallBtn}>Cancel</button>
        <button onClick={() => name && baseUrl && apiKey && onAdd({
          id: `provider-${Date.now()}`, name, type, baseUrl, apiKey,
          enabled: true, timeout: 60000, maxRetries: 3, models: [],
        })} style={primaryBtn}>Add Provider</button>
      </div>
    </div>
  );
};

// ── Agents Section ─────────────────────────────────────────────

const AgentsSection: React.FC = () => {
  const { agentConfigs, providers, createAgentConfig, updateAgentConfig, deleteAgentConfig } = useAgentStore();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', margin: 0 }}>Agent Profiles</h3>
        <div style={{ flex: 1 }} />
        <button onClick={() => createAgentConfig({})} style={primaryBtn}>+ New Agent</button>
      </div>
      <p style={{ fontSize: 11, color: 'var(--theme-fg-muted)', marginBottom: 16 }}>
        Agent profiles define model, temperature, system prompt, and tool permissions. The agent uses a multi-turn tool execution loop — it calls tools, observes results, and continues until the task is complete.
      </p>

      {agentConfigs.map((agent) => {
        const provider = providers.find(p => p.id === agent.providerId);
        const isOpen = editingId === agent.id;
        return (
          <div key={agent.id} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              onClick={() => setEditingId(isOpen ? null : agent.id)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--theme-fg)' }}>{agent.name}</div>
                <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)' }}>
                  {provider?.name || 'No provider'} · {agent.modelId || 'No model'} · temp={agent.temperature} · max={agent.maxTokens}
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setEditingId(isOpen ? null : agent.id); }} style={smallBtn}>
                {isOpen ? 'Close' : 'Edit'}
              </button>
              <button onClick={(e) => { e.stopPropagation(); deleteAgentConfig(agent.id); }} style={{ ...smallBtn, color: 'var(--theme-error)' }}>Delete</button>
            </div>

            {isOpen && (
              <AgentEditor agent={agent} providers={providers}
                onSave={(updates) => { updateAgentConfig(agent.id, updates); setEditingId(null); }} />
            )}
          </div>
        );
      })}
    </div>
  );
};

const AgentEditor: React.FC<{
  agent: AgentConfigType;
  providers: AIProviderConfig[];
  onSave: (updates: Partial<AgentConfigType>) => void;
}> = ({ agent, providers, onSave }) => {
  const [name, setName] = useState(agent.name);
  const [providerId, setProviderId] = useState(agent.providerId);
  const [modelId, setModelId] = useState(agent.modelId);
  const [temperature, setTemperature] = useState(agent.temperature);
  const [maxTokens, setMaxTokens] = useState(agent.maxTokens);
  const [streaming, setStreaming] = useState(agent.streaming);
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt);
  const [memoryEnabled, setMemoryEnabled] = useState(agent.memoryEnabled);
  const [memoryMaxTokens, setMemoryMaxTokens] = useState(agent.memoryMaxTokens);
  const [retryOnFailure, setRetryOnFailure] = useState(agent.retryOnFailure);
  const [maxRetries, setMaxRetries] = useState(agent.maxRetries);
  const [maxToolCalls, setMaxToolCalls] = useState(agent.maxToolCalls);
  const [toolCallTimeout, setToolCallTimeout] = useState(agent.toolCallTimeout);
  const [userAvatar, setUserAvatar] = useState(agent.userAvatar || PROFILE_AVATARS[0] || 'U');
  const [agentAvatar, setAgentAvatar] = useState(agent.agentAvatar || PROFILE_AVATARS[5] || 'A');

  const selectedProvider = providers.find(p => p.id === providerId);

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--theme-border)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <Field label="Name" value={name} onChange={setName} />
        <div>
          <label style={labelStyle}>Provider</label>
          <select value={providerId} onChange={(e) => { setProviderId(e.target.value); setModelId(''); }} style={inputStyle}>
            <option value="">Select provider...</option>
            {providers.filter(p => p.enabled).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Model</label>
          <select value={modelId} onChange={(e) => setModelId(e.target.value)} style={inputStyle}>
            <option value="">Select model...</option>
            {selectedProvider?.models?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Temperature ({temperature})</label>
          <input type="range" min={0} max={2} step={0.05} value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))} style={{ width: '100%' }} />
        </div>
        <Field label="Max Tokens per Response" value={String(maxTokens)} onChange={(v) => setMaxTokens(parseInt(v) || 4096)} type="number" />
        <Field label="Max Tool Calls per Turn" value={String(maxToolCalls)} onChange={(v) => setMaxToolCalls(parseInt(v) || 10)} type="number" />
        <Field label="Tool Call Timeout (ms)" value={String(toolCallTimeout)} onChange={(v) => setToolCallTimeout(parseInt(v) || 30000)} type="number" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 16 }}>
          <ToggleSwitch value={streaming} onChange={setStreaming} />
          <label style={{ ...labelStyle, margin: 0 }}>Streaming</label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ToggleSwitch value={memoryEnabled} onChange={setMemoryEnabled} />
          <label style={{ ...labelStyle, margin: 0 }}>Memory</label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ToggleSwitch value={retryOnFailure} onChange={setRetryOnFailure} />
          <label style={{ ...labelStyle, margin: 0 }}>Retry on Failure</label>
        </div>
        {memoryEnabled && <Field label="Memory Max Tokens" value={String(memoryMaxTokens)} onChange={(v) => setMemoryMaxTokens(parseInt(v) || 4000)} type="number" />}
        {retryOnFailure && <Field label="Max Retries" value={String(maxRetries)} onChange={(v) => setMaxRetries(parseInt(v) || 3)} type="number" />}
      </div>
      {/* Avatar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>User Avatar</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {PROFILE_AVATARS.map((svg, i) => (
              <button key={i} onClick={() => setUserAvatar(svg)} style={{
                width: 36, height: 36, borderRadius: 6, padding: 2,
                border: userAvatar === svg ? '2px solid var(--theme-accent)' : '1px solid var(--theme-border)',
                background: userAvatar === svg ? 'rgba(99,102,241,0.1)' : 'var(--theme-bg-tertiary)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ width: 28, height: 28, display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: svg.replace(/<svg/, '<svg width="28" height="28"') }} />
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Agent Avatar</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {PROFILE_AVATARS.map((svg, i) => (
              <button key={i} onClick={() => setAgentAvatar(svg)} style={{
                width: 36, height: 36, borderRadius: 6, padding: 2,
                border: agentAvatar === svg ? '2px solid var(--theme-accent)' : '1px solid var(--theme-border)',
                background: agentAvatar === svg ? 'rgba(99,102,241,0.1)' : 'var(--theme-bg-tertiary)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ width: 28, height: 28, display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: svg.replace(/<svg/, '<svg width="28" height="28"') }} />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>System Prompt</label>
        <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} style={{
          ...inputStyle, width: '100%', minHeight: 80, resize: 'vertical', fontFamily: 'inherit',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => onSave({
          name, providerId, modelId, temperature, maxTokens, streaming,
          systemPrompt, memoryEnabled, memoryMaxTokens,
          retryOnFailure, maxRetries, maxToolCalls, toolCallTimeout,
          userAvatar, agentAvatar,
        })} style={primaryBtn}>Save Changes</button>
      </div>
    </div>
  );
};

// ── Tools Section ──────────────────────────────────────────────

const ToolsSection: React.FC = () => {
  const { tools, enableTool, disableTool } = useAgentStore();
  const categories = [...new Set(tools.map(t => t.category))];

  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', margin: '0 0 8px' }}>Available Tools</h3>
      <p style={{ fontSize: 11, color: 'var(--theme-fg-muted)', marginBottom: 16 }}>
        Tools the agent can use during conversations. The AI decides which tools to call based on the task.
      </p>

      {categories.map((cat) => (
        <div key={cat} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--theme-fg-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            {cat}
          </div>
          {tools.filter(t => t.category === cat).map((tool) => (
            <div key={tool.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 4,
              marginBottom: 4, background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)',
            }}>
              <ToggleSwitch value={tool.enabled} onChange={() => tool.enabled ? disableTool(tool.id) : enableTool(tool.id)} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--theme-fg)' }}>{tool.name}</div>
                <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)' }}>{tool.description}</div>
              </div>
              {tool.dangerous && (
                <span style={{ fontSize: 9, color: '#ff9800', padding: '1px 4px', borderRadius: 2, background: 'rgba(255,152,0,0.1)' }}>⚠ risky</span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

// ── System Section ─────────────────────────────────────────────

const SystemSection: React.FC = () => {
  const { healthStatus } = useAgentStore();

  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', margin: '0 0 12px' }}>System Health</h3>

      {healthStatus && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, marginBottom: 20 }}>
          <HealthCard label="Agents" value={String(healthStatus.agents)} />
          <HealthCard label="Providers Online" value={`${healthStatus.providers.connected}/${healthStatus.providers.total}`} />
          <HealthCard label="Active Streams" value={String(healthStatus.activeStreams)} />
          <HealthCard label="Memory Entries" value={String(healthStatus.memoryEntries)} />
          <HealthCard label="Active Tasks" value={String(healthStatus.activeTasks)} />
        </div>
      )}

      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', margin: '0 0 12px' }}>How It Works</h3>
      <div style={cardStyle}>
        <div style={{ fontSize: 11, color: 'var(--theme-fg-muted)', lineHeight: 2 }}>
          <div>1. You send a message describing what you need</div>
          <div>2. The AI analyzes your request and responds with text + tool calls</div>
          <div>3. Tools are executed (read files, write files, run commands, etc.)</div>
          <div>4. Results are sent back to the AI</div>
          <div>5. The AI sees the results and continues with more tool calls if needed</div>
          <div>6. This repeats until the AI produces a final response (no more tools needed)</div>
          <div>7. Everything is streamed to you in real-time</div>
        </div>
      </div>

      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', margin: '0 0 12px' }}>Security</h3>
      <div style={cardStyle}>
        <div style={{ fontSize: 11, color: 'var(--theme-fg-muted)', lineHeight: 2 }}>
          <div>• Provider API keys are stored locally and never sent to third parties</div>
          <div>• Agent memory is persisted in the app data directory</div>
          <div>• Rate limiting is applied per-provider to prevent API abuse</div>
          <div>• Tool execution has configurable timeouts</div>
          <div>• Dangerous tools are marked and can be disabled</div>
        </div>
      </div>
    </div>
  );
};

const HealthCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ background: 'var(--theme-bg-secondary)', borderRadius: 6, border: '1px solid var(--theme-border)', padding: '10px 12px' }}>
    <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--theme-fg)' }}>{value}</div>
    <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)', marginTop: 2 }}>{label}</div>
  </div>
);

// ── Shared Components ──────────────────────────────────────────

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }> =
  ({ label, value, onChange, type = 'text', placeholder }) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );

const ToggleSwitch: React.FC<{ value: boolean; onChange: (v: boolean) => void }> = ({ value, onChange }) => (
  <button onClick={() => onChange(!value)} style={{
    width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
    background: value ? 'var(--theme-accent)' : 'var(--theme-bg-tertiary)',
    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
  }}>
    <div style={{
      width: 14, height: 14, borderRadius: '50%', background: '#fff',
      position: 'absolute', top: 3, left: value ? 19 : 3, transition: 'left 0.2s',
    }} />
  </button>
);

// ── Styles ─────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'var(--theme-bg-tertiary)', border: '1px solid var(--theme-border-light)',
  borderRadius: 4, padding: '4px 8px', fontSize: 11, color: 'var(--theme-fg)', outline: 'none', width: '100%',
};

const labelStyle: React.CSSProperties = {
  fontSize: 10, color: 'var(--theme-fg-muted)', marginBottom: 4, display: 'block',
};

const smallBtn: React.CSSProperties = {
  background: 'var(--theme-bg-tertiary)', border: '1px solid var(--theme-border-light)',
  borderRadius: 4, padding: '3px 8px', fontSize: 10, color: 'var(--theme-fg)', cursor: 'pointer',
};

const primaryBtn: React.CSSProperties = {
  background: 'var(--theme-accent)', border: 'none', borderRadius: 4,
  padding: '5px 12px', fontSize: 11, color: '#fff', cursor: 'pointer',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--theme-bg-secondary)', borderRadius: 6,
  border: '1px solid var(--theme-border)', padding: '10px 14px', marginBottom: 8,
};

const emptyState: React.CSSProperties = {
  padding: 24, textAlign: 'center', color: 'var(--theme-fg-muted)', fontSize: 11,
  background: 'var(--theme-bg-secondary)', borderRadius: 6, border: '1px solid var(--theme-border)',
};
