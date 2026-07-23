/**
 * AgentLogs - Real-time execution log viewer for the agent system.
 */
import React, { useEffect, useState, useRef } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import type { AgentLogEntry, LogLevel } from '../../../shared/types/agent';

export const AgentLogs: React.FC = () => {
  const { logs, loadLogs, clearLogs } = useAgentStore();
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadLogs();
    const interval = setInterval(() => loadLogs(), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    if (levelFilter !== 'all' && log.level !== levelFilter) return false;
    if (categoryFilter !== 'all' && log.category !== categoryFilter) return false;
    return true;
  });

  const getLevelColor = (level: LogLevel): string => {
    switch (level) {
      case 'error': return 'var(--theme-error, #f44336)';
      case 'warn': return 'var(--theme-warning, #ff9800)';
      case 'info': return 'var(--theme-accent)';
      case 'debug': return 'var(--theme-fg-muted)';
      default: return 'var(--theme-fg-muted)';
    }
  };

  const getLevelBg = (level: LogLevel): string => {
    switch (level) {
      case 'error': return 'rgba(244,67,54,0.08)';
      case 'warn': return 'rgba(255,152,0,0.08)';
      default: return 'transparent';
    }
  };

  const categories = ['all', 'agent', 'provider', 'tool', 'memory', 'task', 'stream', 'config'];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', borderBottom: '1px solid var(--theme-border)',
        background: 'var(--theme-bg-secondary)', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 11, color: 'var(--theme-fg)', fontWeight: 500 }}>Logs</span>
        <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)' }}>({filteredLogs.length})</span>

        <div style={{ flex: 1 }} />

        {/* Level filter */}
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as LogLevel | 'all')}
          style={filterSelect}
        >
          <option value="all">All Levels</option>
          <option value="error">Error</option>
          <option value="warn">Warning</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </select>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={filterSelect}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>
          ))}
        </select>

        {/* Auto-scroll toggle */}
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          style={{
            ...filterBtn,
            background: autoScroll ? 'var(--theme-accent)' : 'var(--theme-bg-tertiary)',
            color: autoScroll ? '#fff' : 'var(--theme-fg-muted)',
          }}
          title="Auto-scroll"
        >
          ↓
        </button>

        {/* Clear */}
        <button onClick={clearLogs} style={filterBtn} title="Clear logs">
          Clear
        </button>
      </div>

      {/* Log entries */}
      <div style={{ flex: 1, overflow: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
        {filteredLogs.length === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 200, color: 'var(--theme-fg-muted)', fontSize: 11,
          }}>
            No log entries
          </div>
        ) : (
          filteredLogs.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '3px 12px', borderBottom: '1px solid var(--theme-border)',
                background: getLevelBg(entry.level),
              }}
            >
              {/* Timestamp */}
              <span style={{ color: 'var(--theme-fg-muted)', fontSize: 10, flexShrink: 0, minWidth: 70 }}>
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>

              {/* Level badge */}
              <span style={{
                color: getLevelColor(entry.level), fontSize: 9, fontWeight: 600,
                textTransform: 'uppercase', minWidth: 36, flexShrink: 0,
              }}>
                {entry.level}
              </span>

              {/* Category */}
              <span style={{
                color: 'var(--theme-fg-muted)', fontSize: 9,
                background: 'var(--theme-bg-tertiary)', padding: '0 4px',
                borderRadius: 2, flexShrink: 0,
              }}>
                {entry.category}
              </span>

              {/* Message */}
              <span style={{ color: 'var(--theme-fg)', flex: 1, wordBreak: 'break-word' }}>
                {entry.message}
              </span>

              {/* Data */}
              {entry.data !== undefined && entry.data !== null && (
                <span style={{ color: 'var(--theme-fg-muted)', fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data)}
                </span>
              )}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};

const filterSelect: React.CSSProperties = {
  background: 'var(--theme-bg-tertiary)', border: '1px solid var(--theme-border-light)',
  borderRadius: 3, padding: '2px 4px', fontSize: 10, color: 'var(--theme-fg)',
  outline: 'none', cursor: 'pointer',
};

const filterBtn: React.CSSProperties = {
  background: 'var(--theme-bg-tertiary)', border: '1px solid var(--theme-border-light)',
  borderRadius: 3, padding: '2px 8px', fontSize: 10, color: 'var(--theme-fg-muted)',
  cursor: 'pointer',
};
