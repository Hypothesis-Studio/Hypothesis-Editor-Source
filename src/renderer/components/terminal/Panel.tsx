/**
 * Panel Component - Container for terminal, output, problems, and console panels.
 */
import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useConsoleStore, type ConsoleLevel } from '../../stores/consoleStore';
import { TerminalPanel } from './TerminalPanel';

export const Panel: React.FC = () => {
  const { activePanel, panelHeight, setPanelHeight, togglePanel, setActivePanel } = useAppStore();
  const [isResizing, setIsResizing] = React.useState(false);

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

  const consoleEntries = useConsoleStore((s) => s.entries);
  const clearConsole = useConsoleStore((s) => s.clear);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll console to bottom
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleEntries.length]);

  // Listen for extension:console IPC messages
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
    // Auto-open console panel when extension sends a message
    const unsub2 = (window as any).api?.menu?.onChannel?.(
      'extension:console-open',
      () => {
        setActivePanel('console');
      }
    );
    return () => { unsub1?.(); unsub2?.(); };
  }, [setActivePanel]);

  const tabs = [
    { id: 'terminal', label: 'Terminal' },
    { id: 'output', label: 'Output' },
    { id: 'problems', label: 'Problems' },
    { id: 'console', label: `Console${consoleEntries.length > 0 ? ` (${consoleEntries.length})` : ''}` },
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
        {activePanel === 'output' && (
          <div style={{ padding: 12, fontSize: 12, color: 'var(--theme-fg-muted)', fontFamily: 'monospace' }}>No output to display</div>
        )}
        {activePanel === 'problems' && (
          <div style={{ padding: 12, fontSize: 12, color: 'var(--theme-fg-muted)' }}>No problems detected</div>
        )}
        {activePanel === 'console' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--theme-bg)' }}>
            {/* Console toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', height: 28, padding: '0 8px', borderBottom: '1px solid var(--theme-border)', gap: 4 }}>
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
                <div style={{ padding: 12, color: 'var(--theme-fg-muted)' }}>Console ready</div>
              ) : (
                consoleEntries.map((entry) => {
                  const levelColors: Record<ConsoleLevel, string> = {
                    info: 'var(--theme-fg)',
                    warn: '#e5a500',
                    error: 'var(--theme-error)',
                    success: '#4ade80',
                  };
                  const levelIcons: Record<ConsoleLevel, string> = {
                    info: '\u2139',
                    warn: '\u26A0',
                    error: '\u2716',
                    success: '\u2714',
                  };
                  const time = new Date(entry.timestamp);
                  const ts = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}`;
                  return (
                    <div key={entry.id} style={{
                      display: 'flex', alignItems: 'flex-start', padding: '3px 12px',
                      borderBottom: '1px solid var(--theme-border-light)',
                    }}>
                      <span style={{ color: 'var(--theme-fg-dim)', marginRight: 8, flexShrink: 0, fontSize: 10 }}>{ts}</span>
                      <span style={{ color: levelColors[entry.level], marginRight: 8, flexShrink: 0 }}>{levelIcons[entry.level]}</span>
                      <span style={{ color: 'var(--theme-accent)', marginRight: 8, flexShrink: 0, fontSize: 11 }}>[{entry.source}]</span>
                      <span style={{ color: levelColors[entry.level], wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{entry.message}</span>
                    </div>
                  );
                })
              )}
              <div ref={consoleEndRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
