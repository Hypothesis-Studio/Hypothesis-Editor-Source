/**
 * REST Client - Response Viewer
 * Body (pretty/raw/preview), headers, cookies, timeline, test results.
 */
import React, { useState, useMemo } from 'react';
import type { RestClientResponse, AssertionResult } from '../../../shared/types/rest-client';
import { Icon } from '../common/Icon';
import { useRestClientStore } from '../../stores/restClientStore';

// ── Helpers ──────────────────────────────────────────────────────────

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(1)}s`;
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const STATUS_COLOR = (code: number): string =>
  code >= 200 && code < 300 ? '#4ade80' :
  code >= 300 && code < 400 ? '#facc15' :
  code >= 400 && code < 500 ? '#fb923c' :
  code >= 500 ? '#f87171' : 'var(--theme-fg-muted)';

// ── Styles ───────────────────────────────────────────────────────────

const S = {
  container: { display: 'flex', flexDirection: 'column' as const, height: '100%', overflow: 'hidden' as const },
  statusBar: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '6px 12px', borderBottom: '1px solid var(--theme-border)',
    background: 'var(--theme-bg-secondary)', flexShrink: 0,
  },
  badge: (color: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
  }),
  badgeValue: (color: string): React.CSSProperties => ({
    color, fontFamily: 'monospace', fontWeight: 500,
  }),
  formatBtn: (active: boolean): React.CSSProperties => ({
    padding: '2px 8px', border: '1px solid var(--theme-border)',
    borderRadius: 3, cursor: 'pointer', fontSize: 10,
    background: active ? 'var(--theme-accent)' : 'transparent',
    color: active ? '#fff' : 'var(--theme-fg-muted)',
  }),
  tabBar: { display: 'flex', borderBottom: '1px solid var(--theme-border)', padding: '0 12px' },
  tab: (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '7px 12px', border: 'none',
    borderBottom: active ? '2px solid var(--theme-accent)' : '2px solid transparent',
    background: 'transparent',
    color: active ? 'var(--theme-fg)' : 'var(--theme-fg-muted)',
    cursor: 'pointer', fontSize: 11, fontWeight: active ? 600 : 400,
  }),
  badgeCount: {
    fontSize: 9, padding: '1px 4px', borderRadius: 8,
    background: 'rgba(66,133,244,0.15)', color: 'var(--theme-accent)',
  },
  copyBtn: (copied: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '2px 8px', border: '1px solid var(--theme-border)',
    borderRadius: 3, background: 'transparent',
    color: copied ? '#4ade80' : 'var(--theme-fg-muted)',
    cursor: 'pointer', fontSize: 10,
  }),
  headerSearch: {
    width: '100%', padding: '5px 8px', marginBottom: 8,
    background: 'var(--theme-bg-input, var(--theme-bg))',
    border: '1px solid var(--theme-border)', borderRadius: 4,
    color: 'var(--theme-fg)', fontSize: 11, outline: 'none', boxSizing: 'border-box' as const,
  },
  tableHeader: {
    textAlign: 'left' as const, padding: '6px 8px',
    borderBottom: '2px solid var(--theme-border)',
    fontSize: 10, fontWeight: 600, color: 'var(--theme-fg-muted)',
    textTransform: 'uppercase' as const, letterSpacing: 0.5,
  },
  tableCell: { padding: '6px 8px', fontSize: 12, verticalAlign: 'top' as const },
  kbd: {
    display: 'inline-block', padding: '1px 5px',
    background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)',
    borderRadius: 3, fontSize: 10, fontFamily: 'monospace',
  },
  timelineBar: (pct: number, color: string): React.CSSProperties => ({
    width: `${pct}%`, background: color, minWidth: 2,
  }),
  timelinePhase: { display: 'flex', alignItems: 'center', gap: 8 },
  timelineDot: (color: string): React.CSSProperties => ({
    width: 12, height: 12, borderRadius: 2, background: color, flexShrink: 0,
  }),
  testItem: (passed: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 10px', borderRadius: 4,
    background: passed ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
    border: `1px solid ${passed ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
  }),
};

// ── JSON Syntax Highlighting ─────────────────────────────────────────

const JsonHighlight: React.FC<{ json: string }> = ({ json }) => {
  const html = json
    .replace(/"([^"]+)"(?=\s*:)/g, '<span style="color:#60a5fa">"$1"</span>')
    .replace(/:\s*"([^"]*?)"/g, ': <span style="color:#4ade80">"$1"</span>')
    .replace(/:\s*(\d+\.?\d*)/g, ': <span style="color:#facc15">$1</span>')
    .replace(/:\s*(true|false)/g, ': <span style="color:#a78bfa">$1</span>')
    .replace(/:\s*(null)/g, ': <span style="color:#f87171">$1</span>');
  return <code dangerouslySetInnerHTML={{ __html: html }} />;
};

// ── Timeline View ────────────────────────────────────────────────────

const TimelineView: React.FC<{ response: RestClientResponse }> = ({ response }) => {
  const t = response.timeline;
  if (!t) return <div style={{ color: 'var(--theme-fg-muted)', textAlign: 'center', padding: '24px 0', fontSize: 12 }}>No timeline data</div>;

  const phases = [
    { label: 'DNS Lookup', value: t.phases.dns, color: '#60a5fa' },
    { label: 'TCP Connect', value: t.phases.tcp, color: '#a78bfa' },
    { label: 'TLS Handshake', value: t.phases.tls, color: '#facc15' },
    { label: 'Request', value: t.phases.request, color: '#4ade80' },
    { label: 'First Byte', value: t.phases.firstByte, color: '#fb923c' },
    { label: 'Download', value: t.phases.download, color: '#f87171' },
  ].filter(p => p.value && p.value > 0);

  const total = t.phases.total || 1;

  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 12 }}>
        Total: <span style={{ color: 'var(--theme-accent)' }}>{formatDuration(total)}</span>
      </div>

      {/* Bar visualization */}
      <div style={{ display: 'flex', height: 24, borderRadius: 4, overflow: 'hidden', marginBottom: 12, background: 'var(--theme-bg-secondary)' }}>
        {phases.map((p, i) => {
          const pct = ((p.value || 0) / total) * 100;
          if (pct < 0.5) return null;
          return (
            <div
              key={i}
              title={`${p.label}: ${formatDuration(p.value || 0)}`}
              style={S.timelineBar(pct, p.color)}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {phases.map((p, i) => (
          <div key={i} style={S.timelinePhase}>
            <div style={S.timelineDot(p.color)} />
            <span style={{ flex: 1, fontSize: 11, color: 'var(--theme-fg-muted)' }}>{p.label}</span>
            <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{formatDuration(p.value || 0)}</span>
            <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)', width: 40, textAlign: 'right' }}>
              {((p.value || 0) / total * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      {/* TLS Info */}
      {response.tlsInfo && (
        <div style={{ marginTop: 16, padding: 10, background: 'var(--theme-bg-secondary)', borderRadius: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>TLS/SSL Info</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
            {response.tlsInfo.protocol && <div>Protocol: <span style={{ color: 'var(--theme-accent)' }}>{response.tlsInfo.protocol}</span></div>}
            {response.tlsInfo.cipher && <div>Cipher: <span style={{ color: 'var(--theme-accent)' }}>{response.tlsInfo.cipher}</span></div>}
            {response.tlsInfo.certificate && (
              <>
                <div>Subject: <span style={{ fontFamily: 'monospace' }}>{response.tlsInfo.certificate.subject}</span></div>
                <div>Issuer: <span style={{ fontFamily: 'monospace' }}>{response.tlsInfo.certificate.issuer}</span></div>
                <div>Valid: {response.tlsInfo.certificate.validFrom} → {response.tlsInfo.certificate.validTo}</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────────

interface Props {
  response: RestClientResponse | null;
  error: string | null;
  isLoading: boolean;
}

export const ResponseViewer: React.FC<Props> = ({ response, error, isLoading }) => {
  const { responseTab, setResponseTab, responseBodyFormat: fmt, setResponseBodyFormat: setFmt, responseWrap: wrap, setResponseWrap: setWrap } = useRestClientStore();
  const [headerSearch, setHeaderSearch] = useState('');
  const [copied, setCopied] = useState(false);

  const sc = response?.statusCode || 0;
  const parsedBody = useMemo(() => {
    if (!response?.body) return null;
    try { return JSON.parse(response.body); } catch { return null; }
  }, [response?.body]);

  const filteredHeaders = useMemo(() => {
    if (!response?.headers) return [];
    const entries = Object.entries(response.headers);
    if (!headerSearch.trim()) return entries;
    const q = headerSearch.toLowerCase();
    return entries.filter(([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q));
  }, [response?.headers, headerSearch]);

  const prettyBody = useMemo(() => {
    if (!parsedBody) return response?.body || '';
    try { return JSON.stringify(parsedBody, null, 2); } catch { return response?.body || ''; }
  }, [parsedBody, response?.body]);

  const tests: AssertionResult[] = (response as any)?.assertions || [];

  const handleCopy = async () => {
    if (response) { await navigator.clipboard.writeText(response.body); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  };

  // ── Empty states ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--theme-border)', borderTopColor: 'var(--theme-accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ color: 'var(--theme-fg-muted)', fontSize: 12 }}>Sending request...</div>
      </div>
    );
  }

  if (!response && !error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--theme-fg-muted)' }}>
        <Icon name="send" size={32} style={{ opacity: 0.3 }} />
        <div style={{ fontSize: 13 }}>Send a request to see the response</div>
        <div style={{ fontSize: 11 }}><kbd style={S.kbd}>Ctrl</kbd>+<kbd style={S.kbd}>Enter</kbd> to send</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
        <Icon name="error" size={32} style={{ color: '#f87171' }} />
        <div style={{ color: '#f87171', fontSize: 13, fontWeight: 500 }}>Request Failed</div>
        <div style={{ color: 'var(--theme-fg-muted)', fontSize: 12, maxWidth: 400, textAlign: 'center' }}>{error}</div>
      </div>
    );
  }

  // At this point response is guaranteed non-null
  const resp = response!;

  // ── resp tabs ────────────────────────────────────────────────

  const responseTabs = [
    { id: 'body' as const, label: 'Body' },
    { id: 'headers' as const, label: 'Headers', count: Object.keys(resp.headers).length },
    { id: 'cookies' as const, label: 'Cookies', count: resp.cookies?.length },
    { id: 'timeline' as const, label: 'Timeline' },
    { id: 'tests' as const, label: 'Tests', count: tests.length || undefined },
    { id: 'console' as const, label: 'Console' },
  ];

  // prettyBody is computed above (before early returns) to satisfy Rules of Hooks

  return (
    <div style={S.container}>
      {/* Status bar */}
      <div style={S.statusBar}>
        <span style={{ fontSize: 14, fontWeight: 700, color: STATUS_COLOR(sc), fontFamily: 'monospace' }}>{sc}</span>
        <span style={{ fontSize: 11, color: 'var(--theme-fg-muted)' }}>{resp.statusText}</span>
        <div style={{ height: 16, width: 1, background: 'var(--theme-border)' }} />
        <div style={S.badge('')}>
          <span style={{ color: 'var(--theme-fg-muted)' }}>Time:</span>
          <span style={S.badgeValue('#60a5fa')}>{formatDuration(resp.responseTime)}</span>
        </div>
        <div style={S.badge('')}>
          <span style={{ color: 'var(--theme-fg-muted)' }}>Size:</span>
          <span style={S.badgeValue('#a78bfa')}>{formatSize(resp.bodySize)}</span>
        </div>
        {resp.httpVersion && (
          <div style={S.badge('')}>
            <span style={{ color: 'var(--theme-fg-muted)' }}>HTTP:</span>
            <span style={S.badgeValue('var(--theme-fg-muted)')}>{resp.httpVersion}</span>
          </div>
        )}
        {resp.redirects && resp.redirects.length > 0 && (
          <div style={S.badge('')}>
            <span style={{ color: 'var(--theme-fg-muted)' }}>Redirects:</span>
            <span style={S.badgeValue('#facc15')}>{resp.redirects.length}</span>
          </div>
        )}
        <div style={{ flex: 1 }} />
        {/* Format buttons */}
        <div style={{ display: 'flex', gap: 2 }}>
          {(['pretty', 'raw', 'preview'] as const).map(f => (
            <button key={f} onClick={() => setFmt(f)} style={S.formatBtn(fmt === f)}>
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={() => setWrap(!wrap)} style={S.formatBtn(wrap)}>Wrap</button>
      </div>

      {/* Tab bar */}
      <div style={S.tabBar}>
        {responseTabs.map(t => (
          <button key={t.id} onClick={() => setResponseTab(t.id)} style={S.tab(responseTab === t.id)}>
            {t.label}
            {t.count !== undefined && t.count > 0 && <span style={S.badgeCount}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Body */}
        {responseTab === 'body' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 8px', flexShrink: 0 }}>
              <button onClick={handleCopy} style={S.copyBtn(copied)}>
                <Icon name={copied ? 'check' : 'copy'} size={11} />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            {fmt === 'preview' && resp.contentType?.includes('html') ? (
              <iframe srcDoc={resp.body} style={{ flex: 1, border: 'none', background: '#fff' }} sandbox="allow-scripts" />
            ) : (
              <pre style={{
                flex: 1, margin: 0, padding: '8px 12px',
                fontFamily: 'var(--theme-font-mono, monospace)', fontSize: 12, lineHeight: 1.6,
                color: 'var(--theme-fg)', overflow: 'auto',
                whiteSpace: wrap ? 'pre-wrap' : 'pre',
                wordBreak: wrap ? 'break-all' : 'normal', tabSize: 2,
              }}>
                {parsedBody && fmt === 'pretty' ? <JsonHighlight json={prettyBody} /> : resp.body}
              </pre>
            )}
          </div>
        )}

        {/* Headers */}
        {responseTab === 'headers' && (
          <div style={{ padding: 8 }}>
            <input
              value={headerSearch}
              onChange={e => setHeaderSearch(e.target.value)}
              placeholder="Filter headers..."
              style={S.headerSearch}
            />
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr><th style={S.tableHeader}>Name</th><th style={S.tableHeader}>Value</th></tr></thead>
              <tbody>
                {filteredHeaders.map(([key, value]) => (
                  <tr key={key} style={{ borderBottom: '1px solid var(--theme-border)' }}>
                    <td style={S.tableCell}><span style={{ fontWeight: 500, color: 'var(--theme-accent)' }}>{key}</span></td>
                    <td style={{ ...S.tableCell, fontFamily: 'monospace', wordBreak: 'break-all' }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Cookies */}
        {responseTab === 'cookies' && (
          <div style={{ padding: 8 }}>
            {resp.cookies && resp.cookies.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr><th style={S.tableHeader}>Name</th><th style={S.tableHeader}>Value</th></tr></thead>
                <tbody>
                  {resp.cookies.map((cookie, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--theme-border)' }}>
                      <td style={S.tableCell}>{cookie.key}</td>
                      <td style={{ ...S.tableCell, fontFamily: 'monospace', wordBreak: 'break-all' }}>{cookie.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ color: 'var(--theme-fg-muted)', textAlign: 'center', padding: '24px 0', fontSize: 12 }}>No cookies in resp</div>
            )}
          </div>
        )}

        {/* Timeline */}
        {responseTab === 'timeline' && <TimelineView response={resp} />}

        {/* Tests */}
        {responseTab === 'tests' && (
          <div style={{ padding: 8 }}>
            {tests.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {tests.map((result, i) => (
                  <div key={i} style={S.testItem(result.passed)}>
                    <Icon name={result.passed ? 'check' : 'close'} size={14} style={{ color: result.passed ? '#4ade80' : '#f87171', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: result.passed ? '#4ade80' : '#f87171' }}>{result.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--theme-fg-muted)', textAlign: 'center', padding: '24px 0', fontSize: 12 }}>No test assertions configured</div>
            )}
          </div>
        )}

        {/* Console */}
        {responseTab === 'console' && (
          <div style={{ padding: 8, fontFamily: 'monospace', fontSize: 11, color: 'var(--theme-fg-muted)' }}>
            <div>resp received at {new Date().toLocaleTimeString()}</div>
            {resp.tlsInfo && <div>TLS: {resp.tlsInfo.protocol} / {resp.tlsInfo.cipher}</div>}
          </div>
        )}
      </div>
    </div>
  );
};
