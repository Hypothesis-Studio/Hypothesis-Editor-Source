/**
 * REST Client - Request Editor
 * URL bar with method selector, tabs for params/headers/body/auth/scripts.
 */
import React, { useState, useEffect, useCallback } from 'react';
import type {
  RestClientRequest, KeyValue, HttpMethod, BodyType, RestClientAuth, RestClientBody,
} from '../../../shared/types/rest-client';
import { Icon } from '../common/Icon';
import { useRestClientStore } from '../../stores/restClientStore';

// ── Constants ────────────────────────────────────────────────────────

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const BODY_TYPES: Array<{ value: BodyType; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'form-data', label: 'Form Data' },
  { value: 'x-www-form-urlencoded', label: 'URL Encoded' },
  { value: 'raw', label: 'Raw' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'binary', label: 'Binary' },
];

const AUTH_TYPES: Array<{ value: string; label: string }> = [
  { value: 'none', label: 'No Auth' },
  { value: 'basic', label: 'Basic' },
  { value: 'bearer', label: 'Bearer' },
  { value: 'apikey', label: 'API Key' },
  { value: 'oauth2', label: 'OAuth 2.0' },
  { value: 'digest', label: 'Digest' },
];

const METHOD_COLORS: Record<string, string> = {
  GET: '#4ade80', POST: '#facc15', PUT: '#60a5fa',
  PATCH: '#a78bfa', DELETE: '#f87171', HEAD: '#94a3b8', OPTIONS: '#94a3b8',
};

// ── Styles ───────────────────────────────────────────────────────────

const S = {
  container: { display: 'flex', flexDirection: 'column' as const, height: '100%', overflow: 'hidden' as const },
  nameInput: { background: 'transparent', border: 'none', color: 'var(--theme-fg)', fontSize: 14, fontWeight: 600, outline: 'none', width: '100%' },
  urlBar: { padding: '4px 12px 8px', display: 'flex' },
  methodBtn: (color: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '6px 10px', borderRadius: '6px 0 0 6px',
    border: '1px solid var(--theme-border)', borderRight: 'none',
    background: 'var(--theme-bg-secondary)', color,
    cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'monospace', minWidth: 80,
  }),
  methodDropdown: {
    position: 'absolute' as const, top: '100%', left: 0, marginTop: 4, zIndex: 100,
    minWidth: 120, background: 'var(--theme-bg-secondary)',
    border: '1px solid var(--theme-border)', borderRadius: 6,
    padding: '4px 0', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  },
  methodItem: (active: boolean, color: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', width: '100%',
    padding: '6px 12px',
    background: active ? 'var(--theme-bg-active)' : 'transparent',
    border: 'none', cursor: 'pointer', fontSize: 12,
    fontWeight: 600, fontFamily: 'monospace', color,
  }),
  urlInput: {
    flex: 1, padding: '6px 10px',
    background: 'var(--theme-bg-input, var(--theme-bg))',
    border: '1px solid var(--theme-border)',
    borderLeft: 'none', borderRight: '1px solid var(--theme-border)',
    color: 'var(--theme-fg)', fontSize: 12, outline: 'none', fontFamily: 'monospace',
    borderRadius: '0 0 0 0',
  },
  sendBtn: (loading: boolean): React.CSSProperties => ({
    width: 36, height: 36, borderRadius: 6,
    border: 'none', background: loading ? 'var(--theme-error, #f87171)' : 'var(--theme-accent)',
    color: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  }),
  tabBar: { display: 'flex', borderBottom: '1px solid var(--theme-border)', padding: '0 12px' },
  tab: (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '8px 12px', border: 'none',
    borderBottom: active ? '2px solid var(--theme-accent)' : '2px solid transparent',
    background: 'transparent',
    color: active ? 'var(--theme-fg)' : 'var(--theme-fg-muted)',
    cursor: 'pointer', fontSize: 11, fontWeight: active ? 600 : 400,
  }),
  badge: {
    fontSize: 9, padding: '1px 4px', borderRadius: 8,
    background: 'rgba(66,133,244,0.15)', color: 'var(--theme-accent)',
  },
  tabContent: { flex: 1, overflow: 'auto' as const, padding: '8px 12px' },

  // Key-Value editor
  kvRow: { display: 'flex', gap: 8, marginBottom: 4, alignItems: 'center' },
  kvCheck: (enabled: boolean): React.CSSProperties => ({
    width: 18, height: 18, border: '1px solid var(--theme-border)',
    borderRadius: 3, cursor: 'pointer', flexShrink: 0,
    background: enabled ? 'var(--theme-accent)' : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }),
  kvInput: (enabled: boolean): React.CSSProperties => ({
    flex: 1, padding: '5px 8px',
    background: 'var(--theme-bg-input, var(--theme-bg))',
    border: '1px solid var(--theme-border)', borderRadius: 4,
    color: 'var(--theme-fg)', fontSize: 12, outline: 'none',
    fontFamily: 'monospace', opacity: enabled ? 1 : 0.6,
  }),
  kvRemove: {
    width: 24, height: 24, border: 'none', borderRadius: 3,
    background: 'transparent', color: 'var(--theme-fg-muted)',
    cursor: 'pointer', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  addBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '5px 10px', border: 'none',
    borderRadius: 4, background: 'transparent',
    color: 'var(--theme-fg-muted)', cursor: 'pointer', fontSize: 11, marginTop: 4,
    transition: 'color 0.15s, background 0.15s',
  },

  // Body/Auth type selector
  typeRow: { display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' as const },
  typeBtn: (active: boolean): React.CSSProperties => ({
    padding: '4px 10px', border: '1px solid var(--theme-border)',
    borderRadius: 4, cursor: 'pointer', fontSize: 11,
    background: active ? 'var(--theme-accent)' : 'transparent',
    color: active ? '#fff' : 'var(--theme-fg-muted)',
    fontWeight: active ? 500 : 400,
  }),

  // Text areas
  textarea: {
    width: '100%', padding: '8px 10px',
    background: 'var(--theme-bg-input, var(--theme-bg))',
    border: '1px solid var(--theme-border)', borderRadius: 4,
    color: 'var(--theme-fg)', fontSize: 12, fontFamily: 'monospace',
    outline: 'none', resize: 'vertical' as const, lineHeight: 1.5, boxSizing: 'border-box' as const,
  },
  label: { display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--theme-fg-muted)', marginBottom: 4 },
  input: {
    width: '100%', padding: '6px 8px',
    background: 'var(--theme-bg-input, var(--theme-bg))',
    border: '1px solid var(--theme-border)', borderRadius: 4,
    color: 'var(--theme-fg)', fontSize: 12, outline: 'none', boxSizing: 'border-box' as const,
  },
  emptyState: { color: 'var(--theme-fg-muted)', textAlign: 'center' as const, padding: '24px 0', fontSize: 12 },
  scriptHint: { fontSize: 10, color: 'var(--theme-fg-muted)', marginBottom: 4 },
};

// ── Component ────────────────────────────────────────────────────────

interface Props {
  request: RestClientRequest;
  collectionId: string;
  isLoading: boolean;
}

export const RequestEditor: React.FC<Props> = ({ request, collectionId, isLoading }) => {
  const { activeTab, setActiveTab, sendRequest, cancelRequest, updateRequest } = useRestClientStore();
  const [name, setName] = useState(request.name);
  const [method, setMethod] = useState(request.method);
  const [url, setUrl] = useState(request.url);
  const [showMethods, setShowMethods] = useState(false);

  useEffect(() => {
    setName(request.name);
    setMethod(request.method);
    setUrl(request.url);
  }, [request.id, request.name, request.method, request.url]);

  const save = useCallback(() => {
    const updates: Partial<RestClientRequest> = {};
    if (name !== request.name) updates.name = name;
    if (method !== request.method) updates.method = method;
    if (url !== request.url) updates.url = url;
    if (Object.keys(updates).length > 0) updateRequest(collectionId, request.id, updates);
  }, [name, method, url, request, collectionId, updateRequest]);

  const handleSend = () => {
    if (isLoading) cancelRequest(request.id);
    else { save(); sendRequest(request.id, collectionId); }
  };

  const tabs = [
    { id: 'params' as const, label: 'Params', count: request.params.filter(p => p.enabled).length },
    { id: 'headers' as const, label: 'Headers', count: request.headers.filter(h => h.enabled).length },
    { id: 'body' as const, label: 'Body' },
    { id: 'auth' as const, label: 'Auth' },
    { id: 'pre-script' as const, label: 'Pre-Script' },
    { id: 'test-script' as const, label: 'Test Script' },
  ];

  return (
    <div style={S.container}>
      {/* Request name */}
      <div style={{ padding: '8px 12px 4px' }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={save}
          style={S.nameInput}
        />
      </div>

      {/* URL bar */}
      <div style={S.urlBar}>
        {/* Method selector */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowMethods(!showMethods)}
            style={S.methodBtn(METHOD_COLORS[method] || 'var(--theme-fg-muted)')}
          >
            {method}
            <Icon name="chevron-down" size={10} />
          </button>
          {showMethods && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                onClick={() => setShowMethods(false)}
              />
              <div style={S.methodDropdown}>
                {HTTP_METHODS.map(m => (
                  <button
                    key={m}
                    onClick={() => {
                      setMethod(m);
                      setShowMethods(false);
                      updateRequest(collectionId, request.id, { method: m });
                    }}
                    style={S.methodItem(m === method, METHOD_COLORS[m])}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* URL input */}
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Enter request URL..."
          style={S.urlInput}
        />

        {/* Send button */}
        <button onClick={handleSend} style={S.sendBtn(isLoading)} title={isLoading ? 'Cancel' : 'Send (Enter)'}>
          {isLoading ? (
            <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-4-4l4 4-4 4" />
            </svg>
          )}
        </button>
      </div>

      {/* Tab bar */}
      <div style={S.tabBar}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={S.tab(activeTab === t.id)}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span style={S.badge}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={S.tabContent}>
        {activeTab === 'params' && (
          <KVEditor
            items={request.params}
            onChange={p => updateRequest(collectionId, request.id, { params: p })}
            keyPlaceholder="Parameter"
            valuePlaceholder="Value"
          />
        )}
        {activeTab === 'headers' && (
          <KVEditor
            items={request.headers}
            onChange={h => updateRequest(collectionId, request.id, { headers: h })}
            keyPlaceholder="Header"
            valuePlaceholder="Value"
          />
        )}
        {activeTab === 'body' && (
          <BodyEditor
            body={request.body}
            onChange={b => updateRequest(collectionId, request.id, { body: b })}
          />
        )}
        {activeTab === 'auth' && (
          <AuthEditor
            auth={request.auth}
            onChange={a => updateRequest(collectionId, request.id, { auth: a })}
          />
        )}
        {activeTab === 'pre-script' && (
          <div>
            <div style={S.scriptHint}>
              JavaScript — access via <code style={{ background: 'var(--theme-bg-secondary)', padding: '1px 4px', borderRadius: 2 }}>pm</code> object
            </div>
            <textarea
              value={request.preRequestScript || ''}
              onChange={e => updateRequest(collectionId, request.id, { preRequestScript: e.target.value })}
              placeholder={"// Pre-request script\n// pm.request.setUrl('...');\n// pm.variables.set('key', 'value');"}
              style={{ ...S.textarea, minHeight: 200 }}
            />
          </div>
        )}
        {activeTab === 'test-script' && (
          <div>
            <div style={S.scriptHint}>
              JavaScript — access response via <code style={{ background: 'var(--theme-bg-secondary)', padding: '1px 4px', borderRadius: 2 }}>pm.response</code>
            </div>
            <textarea
              value={request.testScript || ''}
              onChange={e => updateRequest(collectionId, request.id, { testScript: e.target.value })}
              placeholder={"// Test script\n// pm.assertions.equal(pm.response.status, 200);\n// const data = pm.response.json();\n// pm.assertions.ok(data.id, 'Has ID');"}
              style={{ ...S.textarea, minHeight: 200 }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// ── Key-Value Editor ─────────────────────────────────────────────────

interface KVEditorProps {
  items: KeyValue[];
  onChange: (items: KeyValue[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

const KVEditor: React.FC<KVEditorProps> = ({
  items, onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value',
}) => {
  const handleUpdate = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleToggle = (index: number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    onChange(updated);
  };

  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={S.kvRow}>
          <button onClick={() => handleToggle(i)} style={S.kvCheck(item.enabled)}>
            {item.enabled && <Icon name="check" size={10} style={{ color: '#fff' }} />}
          </button>
          <input
            value={item.key}
            onChange={e => handleUpdate(i, 'key', e.target.value)}
            placeholder={keyPlaceholder}
            style={S.kvInput(item.enabled)}
          />
          <input
            value={item.value}
            onChange={e => handleUpdate(i, 'value', e.target.value)}
            placeholder={valuePlaceholder}
            style={S.kvInput(item.enabled)}
          />
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} style={S.kvRemove}>
            <Icon name="close" size={12} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, { key: '', value: '', enabled: true }])}
        style={S.addBtn}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--theme-accent)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--theme-bg-hover, var(--theme-bg-secondary))'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--theme-fg-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
      >
        <Icon name="add" size={12} />
        Add
      </button>
    </div>
  );
};

// ── Body Editor ──────────────────────────────────────────────────────

interface BodyEditorProps {
  body: RestClientBody;
  onChange: (body: RestClientBody) => void;
}

const BodyEditor: React.FC<BodyEditorProps> = ({ body, onChange }) => (
  <div>
    {/* Type selector */}
    <div style={S.typeRow}>
      {BODY_TYPES.map(bt => (
        <button
          key={bt.value}
          onClick={() => onChange({ ...body, type: bt.value })}
          style={S.typeBtn(body.type === bt.value)}
        >
          {bt.label}
        </button>
      ))}
    </div>

    {/* Content */}
    {(body.type === 'json' || body.type === 'raw') && (
      <textarea
        value={body.raw || ''}
        onChange={e => onChange({ ...body, raw: e.target.value })}
        placeholder={body.type === 'json' ? '{\n  "key": "value"\n}' : 'Enter raw body...'}
        style={{ ...S.textarea, minHeight: 200 }}
        rows={12}
      />
    )}

    {body.type === 'form-data' && (
      <KVEditor
        items={body.formData || []}
        onChange={fd => onChange({ ...body, formData: fd })}
        keyPlaceholder="Field"
        valuePlaceholder="Value"
      />
    )}

    {body.type === 'x-www-form-urlencoded' && (
      <KVEditor
        items={body.urlEncoded || []}
        onChange={ue => onChange({ ...body, urlEncoded: ue })}
        keyPlaceholder="Field"
        valuePlaceholder="Value"
      />
    )}

    {body.type === 'graphql' && (
      <div>
        <div style={S.label}>Query</div>
        <textarea
          value={body.graphql?.query || ''}
          onChange={e => onChange({ ...body, graphql: { ...body.graphql!, query: e.target.value } })}
          placeholder="query { ... }"
          style={{ ...S.textarea, minHeight: 160 }}
          rows={8}
        />
        <div style={{ ...S.label, marginTop: 8 }}>Variables (JSON)</div>
        <textarea
          value={body.graphql?.variables || ''}
          onChange={e => onChange({ ...body, graphql: { ...body.graphql!, variables: e.target.value } })}
          placeholder='{ "id": 1 }'
          style={{ ...S.textarea, minHeight: 80 }}
          rows={4}
        />
      </div>
    )}

    {body.type === 'none' && (
      <div style={S.emptyState}>This request does not have a body</div>
    )}
  </div>
);

// ── Auth Editor ──────────────────────────────────────────────────────

interface AuthEditorProps {
  auth: RestClientAuth;
  onChange: (auth: RestClientAuth) => void;
}

const AuthEditor: React.FC<AuthEditorProps> = ({ auth, onChange }) => (
  <div>
    {/* Type selector */}
    <div style={S.typeRow}>
      {AUTH_TYPES.map(at => (
        <button
          key={at.value}
          onClick={() => onChange({ ...auth, type: at.value as any })}
          style={S.typeBtn(auth.type === at.value)}
        >
          {at.label}
        </button>
      ))}
    </div>

    {/* Basic Auth */}
    {auth.type === 'basic' && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <label style={S.label}>Username</label>
          <input
            value={auth.basic?.username || ''}
            onChange={e => onChange({ ...auth, basic: { ...auth.basic!, username: e.target.value } })}
            style={S.input}
          />
        </div>
        <div>
          <label style={S.label}>Password</label>
          <input
            type="password"
            value={auth.basic?.password || ''}
            onChange={e => onChange({ ...auth, basic: { ...auth.basic!, password: e.target.value } })}
            style={S.input}
          />
        </div>
      </div>
    )}

    {/* Bearer Token */}
    {auth.type === 'bearer' && (
      <div>
        <label style={S.label}>Token</label>
        <textarea
          value={auth.bearer?.token || ''}
          onChange={e => onChange({ ...auth, bearer: { ...auth.bearer!, token: e.target.value } })}
          placeholder="Enter token..."
          style={{ ...S.textarea, minHeight: 80 }}
        />
      </div>
    )}

    {/* API Key */}
    {auth.type === 'apikey' && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <label style={S.label}>Key Name</label>
          <input
            value={auth.apikey?.key || ''}
            onChange={e => onChange({
              ...auth,
              apikey: { ...auth.apikey!, key: e.target.value, value: auth.apikey?.value || '', addTo: auth.apikey?.addTo || 'header' },
            })}
            placeholder="X-API-Key"
            style={S.input}
          />
        </div>
        <div>
          <label style={S.label}>Value</label>
          <input
            value={auth.apikey?.value || ''}
            onChange={e => onChange({
              ...auth,
              apikey: { ...auth.apikey!, value: e.target.value, key: auth.apikey?.key || '', addTo: auth.apikey?.addTo || 'header' },
            })}
            style={S.input}
          />
        </div>
        <div>
          <label style={S.label}>Add To</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['header', 'query'] as const).map(loc => (
              <button
                key={loc}
                onClick={() => onChange({
                  ...auth,
                  apikey: { ...auth.apikey!, addTo: loc, key: auth.apikey?.key || '', value: auth.apikey?.value || '' },
                })}
                style={S.typeBtn(auth.apikey?.addTo === loc)}
              >
                {loc === 'header' ? 'Header' : 'Query Param'}
              </button>
            ))}
          </div>
        </div>
      </div>
    )}

    {/* OAuth 2.0 */}
    {auth.type === 'oauth2' && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <label style={S.label}>Grant Type</label>
          <select
            value={auth.oauth2?.grantType || 'authorization_code'}
            onChange={e => onChange({
              ...auth,
              oauth2: { ...auth.oauth2!, grantType: e.target.value as any, clientId: auth.oauth2?.clientId || '' },
            })}
            style={S.input}
          >
            <option value="authorization_code">Authorization Code</option>
            <option value="client_credentials">Client Credentials</option>
            <option value="password">Password</option>
            <option value="implicit">Implicit</option>
          </select>
        </div>
        {auth.oauth2?.grantType === 'authorization_code' && (
          <>
            <div>
              <label style={S.label}>Auth URL</label>
              <input
                value={auth.oauth2?.authUrl || ''}
                onChange={e => onChange({ ...auth, oauth2: { ...auth.oauth2!, authUrl: e.target.value, clientId: auth.oauth2?.clientId || '' } })}
                style={S.input}
              />
            </div>
            <div>
              <label style={S.label}>Token URL</label>
              <input
                value={auth.oauth2?.tokenUrl || ''}
                onChange={e => onChange({ ...auth, oauth2: { ...auth.oauth2!, tokenUrl: e.target.value, clientId: auth.oauth2?.clientId || '' } })}
                style={S.input}
              />
            </div>
          </>
        )}
        {auth.oauth2?.grantType === 'client_credentials' && (
          <div>
            <label style={S.label}>Token URL</label>
            <input
              value={auth.oauth2?.tokenUrl || ''}
              onChange={e => onChange({ ...auth, oauth2: { ...auth.oauth2!, tokenUrl: e.target.value, clientId: auth.oauth2?.clientId || '' } })}
              style={S.input}
            />
          </div>
        )}
        <div>
          <label style={S.label}>Client ID</label>
          <input
            value={auth.oauth2?.clientId || ''}
            onChange={e => onChange({ ...auth, oauth2: { ...auth.oauth2!, clientId: e.target.value } })}
            style={S.input}
          />
        </div>
        <div>
          <label style={S.label}>Client Secret</label>
          <input
            type="password"
            value={auth.oauth2?.clientSecret || ''}
            onChange={e => onChange({ ...auth, oauth2: { ...auth.oauth2!, clientSecret: e.target.value, clientId: auth.oauth2?.clientId || '' } })}
            style={S.input}
          />
        </div>
        <div>
          <label style={S.label}>Scope</label>
          <input
            value={auth.oauth2?.scope || ''}
            onChange={e => onChange({ ...auth, oauth2: { ...auth.oauth2!, scope: e.target.value, clientId: auth.oauth2?.clientId || '' } })}
            style={S.input}
          />
        </div>
        <div>
          <label style={S.label}>Access Token</label>
          <textarea
            value={auth.oauth2?.accessToken || ''}
            onChange={e => onChange({ ...auth, oauth2: { ...auth.oauth2!, accessToken: e.target.value, clientId: auth.oauth2?.clientId || '' } })}
            placeholder="Paste access token or click Get Token..."
            style={{ ...S.textarea, minHeight: 60 }}
          />
        </div>
      </div>
    )}

    {/* No Auth */}
    {auth.type === 'none' && (
      <div style={S.emptyState}>No authentication configured</div>
    )}
  </div>
);
