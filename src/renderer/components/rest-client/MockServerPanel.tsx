/**
 * Mock Server Panel - HTTP Mock Server UI inside REST Client.
 * Three-column layout: server list | endpoint list | endpoint editor / logs
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useMockServerStore } from '../../stores/mockServerStore';
import { Icon } from '../common/Icon';
import type { MockEndpoint, MockEndpointMethod, MockResponseBodyType } from '../../../shared/types/mock-server';

// ── Helpers ───────────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  GET: '#4ade80', POST: '#facc15', PUT: '#60a5fa', PATCH: '#a78bfa',
  DELETE: '#f87171', OPTIONS: '#fb923c', HEAD: '#94a3b8', ANY: '#e2e8f0',
};
const mc = (m: string) => METHOD_COLORS[m] ?? 'var(--theme-fg-muted)';
const STATUS_COLOR = (code: number) =>
  code >= 500 ? '#f87171' : code >= 400 ? '#fb923c' : code >= 300 ? '#facc15' : '#4ade80';
const METHODS: MockEndpointMethod[] = ['GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD','ANY'];
const BODY_TYPES: MockResponseBodyType[] = ['json','text','html','xml','empty'];
const DEFAULT_ENDPOINT: Omit<MockEndpoint, 'id'> = {
  method: 'GET', path: '/api/example', statusCode: 200, bodyType: 'json',
  body: '{\n  "message": "Hello from mock server"\n}',
  headers: [], delayMs: 0, enabled: true, description: '',
};
function fmt(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  panel: {
    display: 'flex', height: '100%', background: 'var(--theme-bg)',
    color: 'var(--theme-fg)', fontSize: 13, overflow: 'hidden' as const,
  },
  col: (w: number | string, border = true): React.CSSProperties => ({
    width: w, flexShrink: 0, display: 'flex', flexDirection: 'column',
    borderRight: border ? '1px solid var(--theme-border)' : 'none', overflow: 'hidden',
  }),
  colHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 12px', borderBottom: '1px solid var(--theme-border)',
    background: 'var(--theme-bg-secondary)', height: 40, flexShrink: 0,
  },
  colTitle: {
    fontSize: 11, fontWeight: 600, color: 'var(--theme-fg-muted)',
    textTransform: 'uppercase' as const, letterSpacing: 0.8,
  },
  iconBtn: (active = false): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 26, height: 26, border: 'none', borderRadius: 5,
    background: active ? 'var(--theme-bg-active)' : 'transparent',
    color: active ? 'var(--theme-accent)' : 'var(--theme-fg-muted)',
    cursor: 'pointer', transition: 'background 0.12s, color 0.12s',
  }),
  row: (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer',
    background: active ? 'var(--theme-bg-active)' : 'transparent',
    borderBottom: '1px solid var(--theme-border)', fontSize: 12,
    transition: 'background 0.1s',
  }),
  badge: (color: string): React.CSSProperties => ({
    fontSize: 9, fontWeight: 700, color, minWidth: 38,
    fontFamily: 'monospace', letterSpacing: 0.3,
  }),
  statusDot: (status: string): React.CSSProperties => ({
    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
    background: status === 'running' ? '#4ade80' : status === 'error' ? '#f87171'
      : status === 'starting' ? '#facc15' : 'var(--theme-fg-muted)',
    boxShadow: status === 'running' ? '0 0 5px #4ade8066' : 'none',
  }),
  input: {
    width: '100%', padding: '6px 9px', background: 'var(--theme-bg-input, var(--theme-bg))',
    border: '1px solid var(--theme-border)', borderRadius: 5,
    color: 'var(--theme-fg)', fontSize: 12, outline: 'none', boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s',
  },
  label: {
    fontSize: 11, fontWeight: 500, color: 'var(--theme-fg-muted)',
    marginBottom: 4, display: 'block', letterSpacing: 0.2,
  },
  btn: (variant: 'primary' | 'secondary' | 'danger' = 'secondary'): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '5px 11px', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 500,
    border: variant === 'secondary' ? '1px solid var(--theme-border)' : 'none',
    background: variant === 'primary' ? 'var(--theme-accent)'
      : variant === 'danger' ? 'rgba(248,113,113,0.12)' : 'var(--theme-bg-secondary)',
    color: variant === 'primary' ? '#fff' : variant === 'danger' ? '#f87171' : 'var(--theme-fg)',
    transition: 'opacity 0.12s',
  }),
  emptyState: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    justifyContent: 'center', height: '100%', gap: 12,
    color: 'var(--theme-fg-muted)', padding: 32, textAlign: 'center' as const,
  },
  select: {
    padding: '6px 9px', background: 'var(--theme-bg-input, var(--theme-bg))',
    border: '1px solid var(--theme-border)', borderRadius: 5,
    color: 'var(--theme-fg)', fontSize: 12, outline: 'none', cursor: 'pointer',
  },
  textarea: {
    width: '100%', padding: '7px 9px', background: 'var(--theme-bg-input, var(--theme-bg))',
    border: '1px solid var(--theme-border)', borderRadius: 5,
    color: 'var(--theme-fg)', fontSize: 12, outline: 'none',
    resize: 'vertical' as const, fontFamily: 'monospace', boxSizing: 'border-box' as const,
    lineHeight: 1.5,
  },
  resizeHandle: (active: boolean): React.CSSProperties => ({
    width: 4, flexShrink: 0, cursor: 'col-resize', zIndex: 10,
    background: active ? 'var(--theme-accent)' : 'transparent',
    transition: active ? 'none' : 'background 0.15s',
  }),
  section: { display: 'flex', flexDirection: 'column' as const, gap: 4 },
  divider: { height: 1, background: 'var(--theme-border)', margin: '4px 0' },
};

// ── Server List Column ────────────────────────────────────────────────────────

const ServerList: React.FC<{ width: number }> = ({ width }) => {
  const {
    servers, selectedServerId, showCreateForm, createName, createPort, createCors, isLoading,
    setSelectedServer, setShowCreateForm, setCreateName, setCreatePort, setCreateCors,
    loadServers, createServer, deleteServer, startServer, stopServer, copyUrl, findFreePort,
  } = useMockServerStore();

  useEffect(() => { loadServers(); }, []);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    const port = createPort ? parseInt(createPort, 10) : undefined;
    await createServer({ name: createName.trim(), port, cors: createCors });
  };

  const handleFreePort = async () => {
    const port = await findFreePort(3100);
    if (port) setCreatePort(String(port));
  };

  return (
    <div style={S.col(width)}>
      <div style={S.colHeader}>
        <span style={S.colTitle}>Servers</span>
        <button style={S.iconBtn(showCreateForm)} title="New server" onClick={() => setShowCreateForm(!showCreateForm)}>
          <Icon name="plus" size={14} />
        </button>
      </div>

      {showCreateForm && (
        <div style={{ padding: 12, borderBottom: '1px solid var(--theme-border)', background: 'var(--theme-bg-secondary)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={S.section}>
            <span style={S.label}>Name</span>
            <input style={S.input} placeholder="My Mock API" value={createName}
              onChange={e => setCreateName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus />
          </div>
          <div style={S.section}>
            <span style={S.label}>Port</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <input style={{ ...S.input, flex: 1 }} placeholder="3100" value={createPort}
                onChange={e => setCreatePort(e.target.value)} type="number" min={1024} max={65535} />
              <button style={S.iconBtn()} title="Find free port" onClick={handleFreePort}>
                <Icon name="refresh" size={13} />
              </button>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, cursor: 'pointer', color: 'var(--theme-fg)' }}>
            <input type="checkbox" checked={createCors} onChange={e => setCreateCors(e.target.checked)} />
            Enable CORS
          </label>
          <div style={{ display: 'flex', gap: 7, paddingTop: 2 }}>
            <button style={S.btn('primary')} onClick={handleCreate} disabled={isLoading || !createName.trim()}>
              {isLoading ? 'Creating...' : 'Create'}
            </button>
            <button style={S.btn()} onClick={() => setShowCreateForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>
        {servers.length === 0 && !showCreateForm ? (
          <div style={S.emptyState}>
            <Icon name="server" size={36} style={{ opacity: 0.2 }} />
            <div style={{ fontSize: 13, fontWeight: 500 }}>No servers yet</div>
            <div style={{ fontSize: 11 }}>Create a local HTTP mock server to simulate API responses</div>
            <button style={S.btn('primary')} onClick={() => setShowCreateForm(true)}>
              <Icon name="plus" size={13} /> New Server
            </button>
          </div>
        ) : servers.map(sv => (
          <div key={sv.id} style={S.row(sv.id === selectedServerId)}
            onClick={() => setSelectedServer(sv.id)}
            onMouseEnter={e => { if (sv.id !== selectedServerId) (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-hover)'; }}
            onMouseLeave={e => { if (sv.id !== selectedServerId) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <div style={S.statusDot(sv.status)} title={sv.status} />
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, fontSize: 12 }}>{sv.name}</div>
              <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)', marginTop: 1 }}>port {sv.port} · {sv.endpoints.length} endpoint{sv.endpoints.length !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ display: 'flex', gap: 1 }}>
              {sv.status === 'running' ? (
                <button style={S.iconBtn()} title="Stop server" onClick={e => { e.stopPropagation(); stopServer(sv.id); }}>
                  <Icon name="debug-stop" size={13} />
                </button>
              ) : (
                <button style={S.iconBtn()} title="Start server" onClick={e => { e.stopPropagation(); startServer(sv.id); }}>
                  <Icon name="play" size={13} />
                </button>
              )}
              {sv.status === 'running' && (
                <button style={S.iconBtn()} title="Copy base URL" onClick={e => { e.stopPropagation(); copyUrl(sv.id); }}>
                  <Icon name="copy" size={13} />
                </button>
              )}
              <button style={S.iconBtn()} title="Delete server" onClick={e => { e.stopPropagation(); deleteServer(sv.id); }}>
                <Icon name="trash" size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Endpoint Editor ───────────────────────────────────────────────────────────

interface EndpointEditorProps {
  serverId: string;
  endpoint: MockEndpoint | null;
  onSave: (updates: Partial<MockEndpoint>) => void;
  onClose: () => void;
}

const EndpointEditor: React.FC<EndpointEditorProps> = ({ endpoint, onSave, onClose }) => {
  const [form, setForm] = useState<Omit<MockEndpoint, 'id'>>({
    method: endpoint?.method ?? DEFAULT_ENDPOINT.method,
    path: endpoint?.path ?? DEFAULT_ENDPOINT.path,
    statusCode: endpoint?.statusCode ?? DEFAULT_ENDPOINT.statusCode,
    bodyType: endpoint?.bodyType ?? DEFAULT_ENDPOINT.bodyType,
    body: endpoint?.body ?? DEFAULT_ENDPOINT.body,
    headers: endpoint?.headers ? [...endpoint.headers] : [],
    delayMs: endpoint?.delayMs ?? 0,
    enabled: endpoint?.enabled ?? true,
    description: endpoint?.description ?? '',
  });

  const upd = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }));
  const addHeader = () => setForm(p => ({ ...p, headers: [...p.headers, { key: '', value: '', enabled: true }] }));
  const updHeader = (i: number, k: string, v: any) => setForm(p => {
    const headers = [...p.headers]; (headers[i] as any)[k] = v; return { ...p, headers };
  });
  const delHeader = (i: number) => setForm(p => ({ ...p, headers: p.headers.filter((_, idx) => idx !== i) }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Editor header */}
      <div style={{ ...S.colHeader, gap: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--theme-fg)' }}>
          {endpoint ? 'Edit Endpoint' : 'New Endpoint'}
        </span>
        <div style={{ flex: 1 }} />
        <button style={S.btn()} onClick={onClose}>Cancel</button>
        <button style={S.btn('primary')} onClick={() => onSave(form)}>
          <Icon name="check" size={13} /> Save
        </button>
      </div>

      {/* Editor body */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Method + Path */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={S.section}>
            <span style={S.label}>Method</span>
            <select style={S.select} value={form.method} onChange={e => upd('method', e.target.value)}>
              {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ ...S.section, flex: 1 }}>
            <span style={S.label}>Path</span>
            <input style={S.input} placeholder="/api/resource/:id" value={form.path}
              onChange={e => upd('path', e.target.value)} />
          </div>
        </div>

        {/* Status + Delay + Enabled */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={S.section}>
            <span style={S.label}>Status Code</span>
            <input style={{ ...S.input, width: 90 }} type="number" min={100} max={599}
              value={form.statusCode} onChange={e => upd('statusCode', parseInt(e.target.value, 10) || 200)} />
          </div>
          <div style={S.section}>
            <span style={S.label}>Delay (ms)</span>
            <input style={{ ...S.input, width: 90 }} type="number" min={0} max={30000}
              value={form.delayMs} onChange={e => upd('delayMs', parseInt(e.target.value, 10) || 0)} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', paddingBottom: 6, color: 'var(--theme-fg)', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={form.enabled} onChange={e => upd('enabled', e.target.checked)} />
            Enabled
          </label>
        </div>

        {/* Description */}
        <div style={S.section}>
          <span style={S.label}>Description</span>
          <input style={S.input} placeholder="Optional notes..." value={form.description}
            onChange={e => upd('description', e.target.value)} />
        </div>

        <div style={S.divider} />

        {/* Body */}
        <div style={S.section}>
          <span style={S.label}>Response Body Type</span>
          <select style={{ ...S.select, alignSelf: 'flex-start' }} value={form.bodyType} onChange={e => upd('bodyType', e.target.value)}>
            {BODY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {form.bodyType !== 'empty' && (
          <div style={S.section}>
            <span style={S.label}>Response Body</span>
            <textarea style={{ ...S.textarea, minHeight: 130 }} value={form.body}
              onChange={e => upd('body', e.target.value)} spellCheck={false} />
          </div>
        )}

        <div style={S.divider} />

        {/* Headers */}
        <div style={S.section}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={S.label}>Response Headers</span>
            <button style={S.iconBtn()} title="Add header" onClick={addHeader}>
              <Icon name="plus" size={13} />
            </button>
          </div>
          {form.headers.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--theme-fg-muted)', padding: '6px 0' }}>No custom headers</div>
          ) : form.headers.map((h, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <input style={{ ...S.input, flex: 1 }} placeholder="Key" value={h.key}
                onChange={e => updHeader(i, 'key', e.target.value)} />
              <input style={{ ...S.input, flex: 2 }} placeholder="Value" value={h.value}
                onChange={e => updHeader(i, 'value', e.target.value)} />
              <input type="checkbox" checked={h.enabled}
                onChange={e => updHeader(i, 'enabled', e.target.checked)} title="Enabled" />
              <button style={S.iconBtn()} onClick={() => delHeader(i)}>
                <Icon name="trash" size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Server Detail (endpoint list + editor) ────────────────────────────────────

const ServerDetail: React.FC<{ serverId: string; epWidth: number; onEpResize: (e: React.MouseEvent) => void; epResizing: boolean }> = ({ serverId, epWidth, onEpResize, epResizing }) => {
  const store = useMockServerStore();
  const server = store.servers.find(s => s.id === serverId);
  const { selectedEndpointId, activeView, logs,
    setSelectedEndpoint, setActiveView,
    addEndpoint, updateEndpoint, deleteEndpoint, loadLogs, clearLogs,
  } = store;

  const [editingNew, setEditingNew] = useState(false);
  const serverLogs = logs[serverId] ?? [];
  const selectedEndpoint = server?.endpoints.find(e => e.id === selectedEndpointId) ?? null;

  useEffect(() => {
    if (activeView === 'logs') loadLogs(serverId);
  }, [activeView, serverId]);

  if (!server) return null;

  const handleSaveNew = async (data: Partial<MockEndpoint>) => {
    await addEndpoint(serverId, data as Omit<MockEndpoint, 'id'>);
    setEditingNew(false);
  };
  const handleSaveEdit = async (data: Partial<MockEndpoint>) => {
    if (!selectedEndpointId) return;
    await updateEndpoint(serverId, selectedEndpointId, data);
    setSelectedEndpoint(null);
  };

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Endpoint / log list */}
      <div style={S.col(epWidth)}>
        <div style={S.colHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={S.statusDot(server.status)} />
            <span style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{server.name}</span>
            <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)', flexShrink: 0 }}>:{server.port}</span>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            <button style={S.iconBtn(activeView === 'endpoints')} title="Endpoints" onClick={() => setActiveView('endpoints')}>
              <Icon name="list-tree" size={13} />
            </button>
            <button style={S.iconBtn(activeView === 'logs')} title="Request logs"
              onClick={() => { setActiveView('logs'); loadLogs(serverId); }}>
              <Icon name="output" size={13} />
            </button>
            <button style={S.iconBtn()} title="Add endpoint"
              onClick={() => { setEditingNew(true); setSelectedEndpoint(null); }}>
              <Icon name="plus" size={13} />
            </button>
          </div>
        </div>

        {activeView === 'endpoints' && (
          <div style={{ flex: 1, overflow: 'auto' }}>
            {server.endpoints.length === 0 ? (
              <div style={S.emptyState}>
                <Icon name="plug" size={30} style={{ opacity: 0.2 }} />
                <div style={{ fontSize: 13, fontWeight: 500 }}>No endpoints</div>
                <div style={{ fontSize: 11 }}>Add an endpoint to start mocking requests</div>
                <button style={S.btn('primary')} onClick={() => setEditingNew(true)}>
                  <Icon name="plus" size={13} /> Add Endpoint
                </button>
              </div>
            ) : server.endpoints.map(ep => (
              <div key={ep.id}
                style={{ ...S.row(ep.id === selectedEndpointId && !editingNew), opacity: ep.enabled ? 1 : 0.45 }}
                onClick={() => { setSelectedEndpoint(ep.id); setEditingNew(false); }}
                onMouseEnter={e => { if (ep.id !== selectedEndpointId || editingNew) (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-hover)'; }}
                onMouseLeave={e => { if (ep.id !== selectedEndpointId || editingNew) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <span style={S.badge(mc(ep.method))}>{ep.method}</span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{ep.path}</div>
                  <div style={{ fontSize: 10, display: 'flex', gap: 6, color: 'var(--theme-fg-muted)', marginTop: 1 }}>
                    <span style={{ color: STATUS_COLOR(ep.statusCode) }}>{ep.statusCode}</span>
                    {ep.delayMs > 0 && <span>{ep.delayMs}ms delay</span>}
                    <span style={{ textTransform: 'uppercase', letterSpacing: 0.2 }}>{ep.bodyType}</span>
                  </div>
                </div>
                <button style={S.iconBtn()} title="Delete endpoint"
                  onClick={e => { e.stopPropagation(); deleteEndpoint(serverId, ep.id); }}>
                  <Icon name="trash" size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {activeView === 'logs' && (
          <div style={{ flex: 1, overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', borderBottom: '1px solid var(--theme-border)' }}>
              <span style={{ fontSize: 11, color: 'var(--theme-fg-muted)' }}>{serverLogs.length} request{serverLogs.length !== 1 ? 's' : ''}</span>
              <button style={S.iconBtn()} title="Clear logs" onClick={() => clearLogs(serverId)}>
                <Icon name="clear-all" size={13} />
              </button>
            </div>
            {serverLogs.length === 0
              ? <div style={{ ...S.emptyState, fontSize: 11 }}>No requests logged yet</div>
              : serverLogs.map(log => (
                <div key={log.id} style={{ padding: '7px 12px', borderBottom: '1px solid var(--theme-border)', fontSize: 11 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={S.badge(mc(log.method))}>{log.method}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.path}</span>
                    <span style={{ color: STATUS_COLOR(log.statusCode), fontWeight: 600 }}>{log.statusCode}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, color: 'var(--theme-fg-muted)', fontSize: 10, marginTop: 3 }}>
                    <span>{fmt(log.timestamp)}</span>
                    <span>{log.durationMs}ms</span>
                    {!log.matched && <span style={{ color: '#fb923c' }}>unmatched</span>}
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div onMouseDown={onEpResize} style={S.resizeHandle(epResizing)} />

      {/* Editor pane */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {editingNew ? (
          <EndpointEditor serverId={serverId} endpoint={null} onSave={handleSaveNew} onClose={() => setEditingNew(false)} />
        ) : selectedEndpoint ? (
          <EndpointEditor serverId={serverId} endpoint={selectedEndpoint} onSave={handleSaveEdit} onClose={() => setSelectedEndpoint(null)} />
        ) : (
          <div style={S.emptyState}>
            <Icon name="server" size={44} style={{ opacity: 0.15 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--theme-fg)' }}>
              {server.status === 'running'
                ? `http://localhost:${server.port}`
                : `Stopped · port ${server.port}`}
            </div>
            {server.status === 'running' && (
              <div style={{ fontSize: 11 }}>
                {server.requestCount} request{server.requestCount !== 1 ? 's' : ''} · {server.endpoints.length} endpoint{server.endpoints.length !== 1 ? 's' : ''}
              </div>
            )}
            {server.error && (
              <div style={{ fontSize: 11, color: '#f87171', background: 'rgba(248,113,113,0.08)', padding: '6px 12px', borderRadius: 5 }}>
                {server.error}
              </div>
            )}
            <button style={S.btn('primary')} onClick={() => setEditingNew(true)}>
              <Icon name="plus" size={13} /> Add Endpoint
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Root Panel ────────────────────────────────────────────────────────────────

export const MockServerPanel: React.FC = () => {
  const { servers, selectedServerId } = useMockServerStore();
  const activeServer = servers.find(s => s.id === selectedServerId);

  const [svWidth, setSvWidth] = useState(220);
  const [svResizing, setSvResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleSvResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setSvResizing(true);
    const startX = e.clientX;
    const startW = svWidth;
    const onMove = (ev: MouseEvent) => setSvWidth(Math.max(160, Math.min(400, startW + ev.clientX - startX)));
    const onUp = () => { setSvResizing(false); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [svWidth]);

  const [epWidth, setEpWidth] = useState(240);
  const [epResizing, setEpResizing] = useState(false);

  const handleEpResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setEpResizing(true);
    const startX = e.clientX;
    const startW = epWidth;
    const onMove = (ev: MouseEvent) => setEpWidth(Math.max(160, Math.min(480, startW + ev.clientX - startX)));
    const onUp = () => { setEpResizing(false); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [epWidth]);

  return (
    <div ref={panelRef} style={{ ...S.panel, userSelect: svResizing || epResizing ? 'none' : undefined }}>
      <ServerList width={svWidth} />
      <div onMouseDown={handleSvResize} style={S.resizeHandle(svResizing)} />
      {activeServer ? (
        <ServerDetail
          serverId={activeServer.id}
          epWidth={epWidth}
          onEpResize={handleEpResize}
          epResizing={epResizing}
        />
      ) : (
        <div style={{ flex: 1, ...S.emptyState }}>
          <Icon name="server" size={52} style={{ opacity: 0.12 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--theme-fg)' }}>HTTP Mock Server</div>
          <div style={{ fontSize: 12, maxWidth: 340, lineHeight: 1.6 }}>
            Create a local HTTP server with configurable endpoints.
            Simulate any API response — no backend needed.
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 11, color: 'var(--theme-fg-muted)' }}>
            <span>✓ Custom status codes</span>
            <span>✓ Response delay</span>
            <span>✓ CORS support</span>
          </div>
        </div>
      )}
    </div>
  );
};