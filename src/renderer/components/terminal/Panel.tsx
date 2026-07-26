/**
 * Panel Component - Container for terminal, output, problems, and console panels.
 * All panels are now synchronized through the run store and console store.
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useConsoleStore, type ConsoleLevel } from '../../stores/consoleStore';
import { useRunStore, type RunOutputEntry, type ProblemEntry } from '../../stores/runStore';
import { useTunnelStore } from '../../stores/tunnelStore';
import { useLiveServerStore } from '../../stores/liveServerStore';
import { TerminalPanel } from './TerminalPanel';
import { TunnelPanel } from '../tunnel/TunnelPanel';
import { LiveServerPanel } from '../live-server/LiveServerPanel';

// ── Output Panel ──────────────────────────────────────────────────
const OutputPanel: React.FC = () => {
  const outputEntries = useRunStore((s) => s.outputEntries);
  const clearOutput = useRunStore((s) => s.clearOutput);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [outputEntries.length]);

  const getEntryColor = (type: RunOutputEntry['type']) => {
    switch (type) {
      case 'stdout': return 'var(--theme-fg)';
      case 'stderr': return 'var(--theme-error)';
      case 'system': return 'var(--theme-accent)';
      default: return 'var(--theme-fg-muted)';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--theme-bg)' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', height: 28, padding: '0 8px', borderBottom: '1px solid var(--theme-border)', gap: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--theme-fg-muted)', flex: 1 }}>Output</span>
        <button
          onClick={clearOutput}
          style={{ padding: '2px 8px', fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-fg-muted)', borderRadius: 3 }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-fg)'; e.currentTarget.style.background = 'var(--theme-bg-tertiary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-fg-muted)'; e.currentTarget.style.background = 'none'; }}
          title="Clear Output"
        >
          Clear
        </button>
      </div>
      {/* Entries */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {outputEntries.length === 0 ? (
          <div style={{ padding: 12, color: 'var(--theme-fg-muted)' }}>No output yet. Run a file (Ctrl+F5) to see output here.</div>
        ) : (
          outputEntries.map((entry) => {
            const time = new Date(entry.timestamp);
            const ts = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}.${time.getMilliseconds().toString().padStart(3, '0')}`;
            return (
              <div key={entry.id} style={{
                display: 'flex', alignItems: 'flex-start', padding: '2px 12px',
                borderBottom: '1px solid var(--theme-border-light)',
              }}>
                <span style={{ color: 'var(--theme-fg-dim)', marginRight: 8, flexShrink: 0, fontSize: 10, minWidth: 72 }}>{ts}</span>
                <span style={{ color: getEntryColor(entry.type), wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{entry.text}</span>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
};

// ── Problems Panel ────────────────────────────────────────────────
const ProblemsPanel: React.FC = () => {
  const problems = useRunStore((s) => s.problems);
  const clearProblems = useRunStore((s) => s.clearProblems);
  const setActivePanel = useAppStore((s) => s.setActivePanel);

  const errorCount = problems.filter(p => p.severity === 'error').length;
  const warningCount = problems.filter(p => p.severity === 'warning').length;
  const infoCount = problems.filter(p => p.severity === 'info').length;

  const severityIcons: Record<string, { icon: string; color: string }> = {
    error: { icon: '✖', color: 'var(--theme-error)' },
    warning: { icon: '▲', color: '#e5a500' },
    info: { icon: 'ℹ', color: 'var(--theme-accent)' },
  };

  const handleProblemClick = (problem: ProblemEntry) => {
    // Switch to output panel to show context
    setActivePanel('output');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--theme-bg)' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', height: 28, padding: '0 8px', borderBottom: '1px solid var(--theme-border)', gap: 8 }}>
        {errorCount > 0 && (
          <span style={{ fontSize: 11, color: 'var(--theme-error)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontWeight: 600 }}>{errorCount}</span> Error{errorCount !== 1 ? 's' : ''}
          </span>
        )}
        {warningCount > 0 && (
          <span style={{ fontSize: 11, color: '#e5a500', display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontWeight: 600 }}>{warningCount}</span> Warning{warningCount !== 1 ? 's' : ''}
          </span>
        )}
        {infoCount > 0 && (
          <span style={{ fontSize: 11, color: 'var(--theme-accent)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontWeight: 600 }}>{infoCount}</span> Info
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={clearProblems}
          style={{ padding: '2px 8px', fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-fg-muted)', borderRadius: 3 }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-fg)'; e.currentTarget.style.background = 'var(--theme-bg-tertiary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-fg-muted)'; e.currentTarget.style.background = 'none'; }}
          title="Clear Problems"
        >
          Clear
        </button>
      </div>
      {/* Problem entries */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0', fontFamily: 'monospace', fontSize: 12 }}>
        {problems.length === 0 ? (
          <div style={{ padding: 12, color: 'var(--theme-fg-muted)' }}>No problems detected.</div>
        ) : (
          problems.map((problem) => {
            const { icon, color } = severityIcons[problem.severity] || severityIcons.info;
            const time = new Date(problem.timestamp);
            const ts = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}`;
            return (
              <div
                key={problem.id}
                onClick={() => handleProblemClick(problem)}
                style={{
                  display: 'flex', alignItems: 'flex-start', padding: '4px 12px',
                  borderBottom: '1px solid var(--theme-border-light)',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--theme-bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ color, marginRight: 8, flexShrink: 0, fontWeight: 600 }}>{icon}</span>
                <span style={{ color: 'var(--theme-fg)', flex: 1, wordBreak: 'break-word' }}>{problem.message}</span>
                {problem.file && (
                  <span style={{ color: 'var(--theme-fg-dim)', marginLeft: 12, flexShrink: 0, fontSize: 11 }}>
                    {problem.file.split(/[/\\]/).pop()}{problem.line > 0 ? `:${problem.line}` : ''}{problem.column > 0 ? `:${problem.column}` : ''}
                  </span>
                )}
                <span style={{ color: 'var(--theme-fg-dim)', marginLeft: 8, flexShrink: 0, fontSize: 10 }}>{ts}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ── Console Panel ─────────────────────────────────────────────────
const ConsolePanel: React.FC = () => {
  const consoleEntries = useConsoleStore((s) => s.entries);
  const clearConsole = useConsoleStore((s) => s.clear);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleEntries.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--theme-bg)' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', height: 28, padding: '0 8px', borderBottom: '1px solid var(--theme-border)', gap: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--theme-fg-muted)', flex: 1 }}>
          Console{consoleEntries.length > 0 ? ` (${consoleEntries.length})` : ''}
        </span>
        <button
          onClick={clearConsole}
          style={{ padding: '2px 8px', fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-fg-muted)', borderRadius: 3 }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-fg)'; e.currentTarget.style.background = 'var(--theme-bg-tertiary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-fg-muted)'; e.currentTarget.style.background = 'none'; }}
          title="Clear Console"
        >
          Clear
        </button>
      </div>
      {/* Console entries */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0', fontFamily: 'monospace', fontSize: 12 }}>
        {consoleEntries.length === 0 ? (
          <div style={{ padding: 12, color: 'var(--theme-fg-muted)' }}>Console ready. Use console.log() in your code or run a file.</div>
        ) : (
          consoleEntries.map((entry) => {
            const levelColors: Record<ConsoleLevel, string> = {
              info: 'var(--theme-fg)',
              warn: '#e5a500',
              error: 'var(--theme-error)',
              success: '#4ade80',
              debug: 'var(--theme-fg-dim)',
            };
            const levelIcons: Record<ConsoleLevel, string> = {
              info: 'ℹ',
              warn: '⚠',
              error: '✖',
              success: '✔',
              debug: '⚙',
            };
            const time = new Date(entry.timestamp);
            const ts = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}.${time.getMilliseconds().toString().padStart(3, '0')}`;
            return (
              <div key={entry.id} style={{
                display: 'flex', alignItems: 'flex-start', padding: '3px 12px',
                borderBottom: '1px solid var(--theme-border-light)',
              }}>
                <span style={{ color: 'var(--theme-fg-dim)', marginRight: 8, flexShrink: 0, fontSize: 10, minWidth: 72 }}>{ts}</span>
                <span style={{ color: levelColors[entry.level], marginRight: 8, flexShrink: 0 }}>{levelIcons[entry.level]}</span>
                <span style={{ color: 'var(--theme-accent)', marginRight: 8, flexShrink: 0, fontSize: 11 }}>[{entry.source}]</span>
                <span style={{ color: levelColors[entry.level], wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{entry.message}</span>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
};

// ── Main Panel Component ──────────────────────────────────────────
export const Panel: React.FC = () => {
  const { activePanel, panelHeight, setPanelHeight, togglePanel, setActivePanel } = useAppStore();
  const [isResizing, setIsResizing] = React.useState(false);

  // Run event listeners are registered globally in App.tsx via initRunListeners().
  // Only listen for extension:console IPC messages here.
  useEffect(() => {
    const unsub1 = (window as any).api?.menu?.onChannel?.(
      'extension:console',
      (data: { level?: ConsoleLevel; source?: string; message: string }) => {
        useConsoleStore.getState().addEntry(
          data.level || 'info',
          data.source || 'Extension',
          data.message
        );
      }
    );
    const unsub2 = (window as any).api?.menu?.onChannel?.(
      'extension:console-open',
      () => {
        setActivePanel('console');
      }
    );
    return () => { unsub1?.(); unsub2?.(); };
  }, [setActivePanel]);

  const handleResizeStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);

      const startY = e.clientY;
      const startHeight = panelHeight;

      const handleMouseMove = (e: MouseEvent) => {
        const delta = startY - e.clientY;
        const newHeight = Math.max(100, Math.min(600, startHeight + delta));
        setPanelHeight(newHeight);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [panelHeight, setPanelHeight],
  );

  const problemsCount = useRunStore((s) => s.problems.length);
  const consoleEntries = useConsoleStore((s) => s.entries);

  const tunnelCount = useTunnelStore((s) => s.tunnels.filter((t) => t.status !== 'closed').length);
  const liveServerCount = useLiveServerStore((s) => s.servers.filter((sv) => sv.status === 'running').length);

  const tabs = [
    { id: 'terminal', label: 'Terminal' },
    { id: 'output', label: 'Output' },
    { id: 'problems', label: `Problems${problemsCount > 0 ? ` (${problemsCount})` : ''}` },
    { id: 'console', label: `Console${consoleEntries.length > 0 ? ` (${consoleEntries.length})` : ''}` },
    { id: 'tunnels', label: `Tunnels${tunnelCount > 0 ? ` (${tunnelCount})` : ''}` },
    { id: 'live-server', label: `Live Server${liveServerCount > 0 ? ` (${liveServerCount})` : ''}` },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: panelHeight, borderTop: '1px solid var(--theme-border)' }}>
      {/* Resize handle */}
      <div
        style={{ height: 4, cursor: 'row-resize', background: isResizing ? 'var(--theme-accent)' : 'transparent' }}
        onMouseDown={handleResizeStart}
        onMouseEnter={(e) => { if (!isResizing) e.currentTarget.style.background = 'var(--theme-accent)'; }}
        onMouseLeave={(e) => { if (!isResizing) e.currentTarget.style.background = 'transparent'; }}
      />

      {/* Panel tabs */}
      <div style={{ display: 'flex', alignItems: 'center', height: 32, background: 'var(--theme-bg-secondary)', borderBottom: '1px solid var(--theme-border)', paddingLeft: 8, paddingRight: 8 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActivePanel(tab.id)}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderBottom: activePanel === tab.id ? '2px solid var(--theme-accent)' : '2px solid transparent',
              color: activePanel === tab.id ? 'var(--theme-fg)' : 'var(--theme-fg-muted)',
              transition: 'color 0.15s',
              fontWeight: tab.id === 'problems' && problemsCount > 0 ? 600 : tab.id === 'console' && consoleEntries.length > 0 ? 600 : 400,
            }}
            onMouseEnter={(e) => { if (activePanel !== tab.id) e.currentTarget.style.color = 'var(--theme-fg)'; }}
            onMouseLeave={(e) => { if (activePanel !== tab.id) e.currentTarget.style.color = 'var(--theme-fg-muted)'; }}
          >
            {tab.label}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Close button */}
        <button
          onClick={togglePanel}
          style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-fg-muted)', borderRadius: 4 }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-fg)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-fg-muted)'; }}
          title="Close Panel"
        >
          <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activePanel === 'terminal' && <TerminalPanel />}
        {activePanel === 'output' && <OutputPanel />}
        {activePanel === 'problems' && <ProblemsPanel />}
        {activePanel === 'console' && <ConsolePanel />}
        {activePanel === 'tunnels' && <TunnelPanel />}
        {activePanel === 'live-server' && <LiveServerPanel />}
      </div>
    </div>
  );
};
