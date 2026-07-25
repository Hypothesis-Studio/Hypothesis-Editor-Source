/**
 * QueryEditor — clean multi-tab SQL editor with results panel
 */
import React, { useRef, useState } from 'react';
import { useDBStore, type QueryTab } from '../../stores/dbStore';

// ── Icons ─────────────────────────────────────────────────────────
const IcoRun = () => (
  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3.24 1.178a1.5 1.5 0 0 1 1.56.12l8.5 5.5a1.5 1.5 0 0 1 0 2.4l-8.5 5.5A1.5 1.5 0 0 1 2.5 13.5v-11a1.5 1.5 0 0 1 .74-1.322z"/>
  </svg>
);
const IcoPlus = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z"/>
  </svg>
);

const Spinner = ({ size = 10 }: { size?: number }) => (
  <span style={{
    display: 'inline-block', width: size, height: size, flexShrink: 0,
    border: `${size > 12 ? 2 : 1.5}px solid var(--theme-fg-muted)`,
    borderTopColor: 'var(--theme-accent)',
    borderRadius: '50%', animation: 'spin 0.6s linear infinite',
  }} />
);

// ── Styles ────────────────────────────────────────────────────────
const S = {
  root: { height: '100%', display: 'flex', flexDirection: 'column' as const, background: 'var(--theme-bg)' },

  // Tab bar
  tabBar: {
    display: 'flex', alignItems: 'center',
    borderBottom: '1px solid var(--theme-border)',
    background: 'var(--theme-bg-secondary)',
    flexShrink: 0, overflowX: 'auto' as const, minHeight: 36,
  },
  tab: (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '0 12px 0 14px', height: 36, fontSize: 12, cursor: 'pointer',
    flexShrink: 0, whiteSpace: 'nowrap' as const, userSelect: 'none',
    color: active ? 'var(--theme-fg)' : 'var(--theme-fg-muted)',
    background: active ? 'var(--theme-bg)' : 'transparent',
    borderRight: '1px solid var(--theme-border)',
    borderBottom: active ? '2px solid var(--theme-accent)' : '2px solid transparent',
    fontWeight: active ? 500 : 400,
    transition: 'background 0.1s',
  }),
  tabClose: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'inherit', padding: '1px 2px', fontSize: 14, lineHeight: 1,
    opacity: 0.5, borderRadius: 3,
    display: 'flex', alignItems: 'center',
  } as React.CSSProperties,
  newTabBtn: {
    padding: '0 10px', height: 36, background: 'none', border: 'none',
    cursor: 'pointer', color: 'var(--theme-fg-muted)', display: 'flex',
    alignItems: 'center', flexShrink: 0,
  } as React.CSSProperties,

  // Toolbar
  toolbar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 12px', borderBottom: '1px solid var(--theme-border)',
    background: 'var(--theme-bg-secondary)', flexShrink: 0,
  },
  runBtn: (executing: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '4px 14px', fontSize: 12, fontWeight: 500,
    background: executing ? 'transparent' : 'var(--theme-accent)',
    color: executing ? 'var(--theme-fg-muted)' : '#fff',
    border: `1px solid ${executing ? 'var(--theme-border)' : 'var(--theme-accent)'}`,
    borderRadius: 5, cursor: executing ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s',
  }),
  kbd: {
    fontSize: 10, color: 'var(--theme-fg-muted)',
    background: 'var(--theme-bg-tertiary, rgba(255,255,255,0.06))',
    border: '1px solid var(--theme-border)', borderRadius: 3,
    padding: '1px 5px', fontFamily: 'monospace',
  } as React.CSSProperties,
  connPill: {
    marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
    fontSize: 11, color: 'var(--theme-fg-muted)',
    background: 'var(--theme-bg-tertiary, rgba(255,255,255,0.05))',
    padding: '2px 8px', borderRadius: 10,
  } as React.CSSProperties,

  // Editor
  editorWrap: { flex: '0 0 45%', position: 'relative' as const, borderBottom: '3px solid var(--theme-border)' },
  textarea: {
    width: '100%', height: '100%', padding: '12px 14px',
    fontSize: 13, fontFamily: 'var(--editor-font, "JetBrains Mono", monospace)',
    background: 'var(--theme-bg)', color: 'var(--theme-fg)',
    border: 'none', outline: 'none', resize: 'none' as const,
    boxSizing: 'border-box' as const, lineHeight: 1.7, tabSize: 2,
    caretColor: 'var(--theme-accent)',
  },

  // Results
  resultsWrap: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' as const },
  resultsBar: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '4px 12px', borderBottom: '1px solid var(--theme-border)',
    background: 'var(--theme-bg-secondary)', flexShrink: 0, fontSize: 11, minHeight: 30,
  },
  badge: (ok: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '1px 7px', borderRadius: 10, fontSize: 11, fontWeight: 500,
    background: ok ? 'rgba(63,185,80,0.12)' : 'rgba(248,81,73,0.12)',
    color: ok ? '#3fb950' : '#f85149',
    border: `1px solid ${ok ? 'rgba(63,185,80,0.3)' : 'rgba(248,81,73,0.3)'}`,
  }),
  timeBadge: {
    fontSize: 11, color: 'var(--theme-fg-muted)',
    padding: '1px 6px', borderRadius: 10,
    background: 'var(--theme-bg-tertiary, rgba(255,255,255,0.05))',
  } as React.CSSProperties,
  tableScroll: { flex: 1, overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 },
  th: {
    padding: '6px 12px', textAlign: 'left' as const, fontWeight: 600, fontSize: 11,
    color: 'var(--theme-fg-muted)', background: 'var(--theme-bg-secondary)',
    borderBottom: '1px solid var(--theme-border)',
    whiteSpace: 'nowrap' as const, position: 'sticky' as const, top: 0,
    userSelect: 'none' as const,
  },
  td: {
    padding: '5px 12px', borderBottom: '1px solid var(--theme-border)',
    color: 'var(--theme-fg)', maxWidth: 320,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
    fontSize: 12,
  },
  tdNull: { color: 'var(--theme-fg-muted)', fontStyle: 'italic' as const, opacity: 0.6 },
  rowNum: {
    padding: '5px 8px', borderBottom: '1px solid var(--theme-border)',
    color: 'var(--theme-fg-muted)', fontSize: 11, textAlign: 'right' as const,
    opacity: 0.5, userSelect: 'none' as const,
  } as React.CSSProperties,

  center: {
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', justifyContent: 'center',
    height: '100%', gap: 8, color: 'var(--theme-fg-muted)', fontSize: 12,
  },
  errorBox: {
    margin: 12, padding: '10px 14px', borderRadius: 6, fontSize: 12,
    fontFamily: 'monospace', lineHeight: 1.6,
    background: 'rgba(248,81,73,0.08)',
    border: '1px solid rgba(248,81,73,0.25)',
    color: '#f85149',
  },
};

// ── Query pane ────────────────────────────────────────────────────
const QueryPane: React.FC<{ tab: QueryTab }> = ({ tab }) => {
  const { executeQuery, updateQueryTabSql, connections } = useDBStore();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const conn = connections.find(c => c.id === tab.connectionId);
  const result = tab.result;
  const hasRows = result && result.columns.length > 0 && !result.error;
  const isWrite = result && result.affectedRows !== undefined && !result.error;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      executeQuery(tab.id);
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = taRef.current!;
      const s = ta.selectionStart, end = ta.selectionEnd;
      const next = tab.sql.substring(0, s) + '  ' + tab.sql.substring(end);
      updateQueryTabSql(tab.id, next);
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = s + 2; }, 0);
    }
  };

  return (
    <div style={S.root}>
      {/* Toolbar */}
      <div style={S.toolbar}>
        <button
          style={S.runBtn(tab.isExecuting)}
          onClick={() => executeQuery(tab.id)}
          disabled={tab.isExecuting}
          title="Run query"
        >
          {tab.isExecuting ? <><Spinner /><span>Running…</span></> : <><IcoRun /><span>Run</span></>}
        </button>
        <span style={S.kbd}>Ctrl+Enter</span>
        {conn && (
          <span style={S.connPill}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3fb950', display: 'inline-block' }} />
            {conn.name}
          </span>
        )}
      </div>

      {/* SQL Editor */}
      <div style={S.editorWrap}>
        <textarea
          ref={taRef}
          style={S.textarea}
          value={tab.sql}
          onChange={e => updateQueryTabSql(tab.id, e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={'-- Write SQL here\n-- Ctrl+Enter to run'}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>

      {/* Results */}
      <div style={S.resultsWrap}>
        {tab.error && <div style={S.errorBox}>⚠ {tab.error}</div>}

        {!tab.error && result && (
          <>
            <div style={S.resultsBar}>
              {hasRows && <span style={S.badge(true)}>✓ {result.rowCount} row{result.rowCount !== 1 ? 's' : ''}</span>}
              {isWrite && <span style={S.badge(true)}>✓ {result.affectedRows} affected</span>}
              {result.error && <span style={S.badge(false)}>✗ Error</span>}
              {result.executionTime > 0 && <span style={S.timeBadge}>{result.executionTime} ms</span>}
            </div>
            {hasRows ? (
              <div style={S.tableScroll}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={{ ...S.th, width: 36, textAlign: 'center' as const }}>#</th>
                      {result.columns.map(col => <th key={col.name} style={S.th}>{col.name}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                        <td style={S.rowNum}>{i + 1}</td>
                        {result.columns.map(col => {
                          const val = row[col.name];
                          const isNull = val === null || val === undefined;
                          return (
                            <td key={col.name} style={{ ...S.td, ...(isNull ? S.tdNull : {}) }} title={isNull ? 'NULL' : String(val)}>
                              {isNull ? 'NULL' : String(val)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : !isWrite ? (
              <div style={S.center}><span>Query executed successfully.</span></div>
            ) : (
              <div style={S.center}><span style={S.badge(true)}>✓ {result.affectedRows} row{(result.affectedRows ?? 0) !== 1 ? 's' : ''} affected</span></div>
            )}
          </>
        )}

        {!result && !tab.isExecuting && !tab.error && (
          <div style={S.center}>
            <span style={{ fontSize: 22, opacity: 0.3 }}>▷</span>
            <span>Write a query and press Run</span>
          </div>
        )}

        {tab.isExecuting && !result && (
          <div style={S.center}><Spinner size={16} /><span>Executing…</span></div>
        )}
      </div>
    </div>
  );
};

// ── Query Editor (tabs container) ─────────────────────────────────
export const QueryEditor: React.FC = () => {
  const { queryTabs, activeQueryTabId, setActiveQueryTab, closeQueryTab, activeConnectionId, connections, openQueryTab } = useDBStore();

  const handleNewTab = () => {
    const connId = activeConnectionId || connections.find(c => c.isConnected)?.id;
    if (connId) openQueryTab(connId);
  };

  const activeTab = queryTabs.find(t => t.id === activeQueryTabId);
  const hasConn = !!(activeConnectionId || connections.find(c => c.isConnected));

  if (queryTabs.length === 0) {
    return (
      <div style={{ ...S.root, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <span style={{ fontSize: 32, opacity: 0.2 }}>🗄️</span>
        <span style={{ fontSize: 13, color: 'var(--theme-fg-muted)' }}>No query tabs open</span>
        <button
          onClick={handleNewTab}
          disabled={!hasConn}
          style={{
            padding: '6px 18px', fontSize: 13, borderRadius: 5, cursor: hasConn ? 'pointer' : 'not-allowed',
            background: hasConn ? 'var(--theme-accent)' : 'var(--theme-bg-secondary)',
            color: hasConn ? '#fff' : 'var(--theme-fg-muted)',
            border: `1px solid ${hasConn ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
          }}
        >
          {hasConn ? 'New Query Tab' : 'Connect to a database first'}
        </button>
      </div>
    );
  }

  return (
    <div style={S.root}>
      {/* Tab bar */}
      <div style={S.tabBar}>
        {queryTabs.map(tab => (
          <div
            key={tab.id}
            style={S.tab(tab.id === activeQueryTabId)}
            onClick={() => setActiveQueryTab(tab.id)}
          >
            {tab.isExecuting && <Spinner />}
            <span>{tab.title}</span>
            <button
              style={S.tabClose}
              onClick={e => { e.stopPropagation(); closeQueryTab(tab.id); }}
              title="Close tab"
            >×</button>
          </div>
        ))}
        <button style={S.newTabBtn} title="New query tab" onClick={handleNewTab}>
          <IcoPlus />
        </button>
      </div>

      {activeTab && <QueryPane tab={activeTab} />}
    </div>
  );
};
