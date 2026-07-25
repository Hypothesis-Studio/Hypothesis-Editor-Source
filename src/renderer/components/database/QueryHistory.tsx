/**
 * QueryHistory — clean history list with re-run support
 */
import React from 'react';
import { useDBStore } from '../../stores/dbStore';
import { ConfirmDialog } from '../dialogs';
import type { QueryHistoryEntry } from '../../../shared/types/database';

const S = {
  root: { height: '100%', display: 'flex', flexDirection: 'column' as const, background: 'var(--theme-bg)' },
  toolbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '6px 12px', borderBottom: '1px solid var(--theme-border)',
    background: 'var(--theme-bg-secondary)', flexShrink: 0, minHeight: 38,
  },
  toolbarTitle: { fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)' },
  clearBtn: {
    background: 'none', border: '1px solid var(--theme-border)', borderRadius: 4,
    padding: '3px 10px', fontSize: 11, cursor: 'pointer', color: 'var(--theme-fg-muted)',
    transition: 'all 0.1s',
  } as React.CSSProperties,
  scroll: { flex: 1, overflowY: 'auto' as const },
  item: (hov: boolean): React.CSSProperties => ({
    padding: '8px 14px', borderBottom: '1px solid var(--theme-border)',
    cursor: 'pointer', background: hov ? 'rgba(255,255,255,0.04)' : 'transparent',
    transition: 'background 0.1s',
  }),
  itemHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  time: { fontSize: 10, color: 'var(--theme-fg-muted)', fontFamily: 'monospace' },
  badgeOk: {
    fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 500,
    background: 'rgba(63,185,80,0.12)', color: '#3fb950',
    border: '1px solid rgba(63,185,80,0.25)',
  } as React.CSSProperties,
  badgeErr: {
    fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 500,
    background: 'rgba(248,81,73,0.12)', color: '#f85149',
    border: '1px solid rgba(248,81,73,0.25)',
  } as React.CSSProperties,
  execTime: {
    marginLeft: 'auto', fontSize: 10, color: 'var(--theme-fg-muted)',
    background: 'var(--theme-bg-tertiary, rgba(255,255,255,0.05))',
    padding: '1px 6px', borderRadius: 8,
  } as React.CSSProperties,
  sql: {
    fontSize: 11, fontFamily: 'var(--editor-font, monospace)',
    color: 'var(--theme-fg)', overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
    opacity: 0.8,
  },
  hint: {
    fontSize: 10, color: 'var(--theme-fg-muted)', opacity: 0.5, marginTop: 2,
  },
  center: {
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', justifyContent: 'center',
    height: '100%', gap: 8, color: 'var(--theme-fg-muted)', fontSize: 12,
  },
};

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString();
}

export const QueryHistory: React.FC = () => {
  const { history, clearHistory, openQueryTab, activeConnectionId, connections } = useDBStore();
  const [hov, setHov] = React.useState<string | null>(null);
  const [confirmClear, setConfirmClear] = React.useState(false);

  const handleRerun = (entry: QueryHistoryEntry) => {
    const connId = entry.connectionId || activeConnectionId || connections.find(c => c.isConnected)?.id;
    if (connId) {
      openQueryTab(connId, entry.sql);
      useDBStore.getState().setActiveView('query');
    }
  };

  // Group by date
  const groups: Record<string, QueryHistoryEntry[]> = {};
  for (const entry of history) {
    const label = fmtDate(entry.executedAt);
    if (!groups[label]) groups[label] = [];
    groups[label].push(entry);
  }

  return (
    <div style={S.root}>
      <div style={S.toolbar}>
        <span style={S.toolbarTitle}>Query History</span>
        {history.length > 0 && (
          <button
            style={S.clearBtn}
            onClick={() => setConfirmClear(true)}
          >
            Clear All
          </button>
        )}
      </div>

      <div style={S.scroll}>
        {history.length === 0 ? (
          <div style={S.center}>
            <span style={{ fontSize: 26, opacity: 0.2 }}>🕐</span>
            <span>No queries executed yet.</span>
            <span style={{ fontSize: 11, opacity: 0.5 }}>Your query history will appear here.</span>
          </div>
        ) : (
          Object.entries(groups).map(([date, entries]) => (
            <div key={date}>
              <div style={{
                padding: '6px 14px 3px', fontSize: 10, fontWeight: 700,
                color: 'var(--theme-fg-muted)', textTransform: 'uppercase' as const,
                letterSpacing: '0.07em', opacity: 0.6,
                background: 'var(--theme-bg-secondary)',
                borderBottom: '1px solid var(--theme-border)',
              }}>
                {date}
              </div>
              {entries.map(entry => (
                <div
                  key={entry.id}
                  style={S.item(hov === entry.id)}
                  onClick={() => handleRerun(entry)}
                  onMouseEnter={() => setHov(entry.id)}
                  onMouseLeave={() => setHov(null)}
                  title="Click to open in Query Editor"
                >
                  <div style={S.itemHeader}>
                    <span style={S.time}>{fmtTime(entry.executedAt)}</span>
                    {entry.error
                      ? <span style={S.badgeErr}>✗ Error</span>
                      : <span style={S.badgeOk}>✓ {entry.rowCount} row{entry.rowCount !== 1 ? 's' : ''}</span>
                    }
                    <span style={S.execTime}>{entry.executionTime} ms</span>
                  </div>
                  <div style={S.sql}>{entry.sql}</div>
                  {hov === entry.id && (
                    <div style={S.hint}>Click to open in Query Editor</div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clearHistory}
        title="Clear History"
        message="Clear all query history? This cannot be undone."
        confirmLabel="Clear All"
        variant="danger"
      />
    </div>
  );
};
