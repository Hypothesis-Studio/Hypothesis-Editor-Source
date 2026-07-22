/**
 * StatusBar - Bottom information bar with interactive click-to-toggle items.
 */
import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useEditorStore } from '../../stores/editorStore';

interface StatusBarProps {
  rootPath?: string | null;
  onOpenSettings?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({ rootPath, onOpenSettings }) => {
  const {
    togglePanel, panelVisible, activePanel, setActivePanel,
    lineNumbers, wordWrap, toggleLineNumbers, toggleWordWrap,
    toggleMinimap, minimapVisible, toggleBreadcrumbs, breadcrumbsVisible,
    toggleStickyScroll, stickyScroll,
  } = useAppStore();
  const { tabs, activeTabId, cursorPosition } = useEditorStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  // ── Live Server status indicator ─────────────────────────────────
  const [liveServerUrl, setLiveServerUrl] = useState<string | null>(null);
  useEffect(() => {
    const unsub = (window as any).api?.menu?.onChannel?.(
      'live-server:status',
      (data: { running: boolean; url?: string }) => {
        setLiveServerUrl(data.running ? (data.url || null) : null);
      }
    );
    return () => { unsub?.(); };
  }, []);

  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px',
    height: '100%', fontSize: 11, color: '#ffffff',
    background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', height: 24, background: 'var(--theme-accent)', color: '#ffffff', fontSize: 11, userSelect: 'none' }}>
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <button style={itemStyle} title="Source Control"
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >
          <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          <span>main</span>
        </button>
        <button style={itemStyle} title="Errors and Warnings"
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >
          <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <span>0</span>
          <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ marginLeft: 4 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>0</span>
        </button>
      </div>

      <div style={{ flex: 1 }} />

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        {activeTab && (
          <button style={itemStyle} title="Go to Line" onClick={() => useEditorStore.getState().triggerGoToLine()}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
          >
            <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
          </button>
        )}
        <button style={itemStyle} title="Word Wrap" onClick={toggleWordWrap}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >
          <span>{wordWrap === 'on' ? 'Wrap On' : 'Wrap Off'}</span>
        </button>
        <button style={itemStyle} title="Line Numbers" onClick={toggleLineNumbers}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >
          <span>Ln {lineNumbers === 'on' ? 'On' : 'Off'}</span>
        </button>
        <button style={itemStyle} title="Minimap" onClick={toggleMinimap}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >
          <span>Minimap {minimapVisible ? 'On' : 'Off'}</span>
        </button>
        <button style={itemStyle} title="Breadcrumbs" onClick={toggleBreadcrumbs}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >
          <span>Breadcrumbs {breadcrumbsVisible ? 'On' : 'Off'}</span>
        </button>
        <button style={itemStyle} title="Sticky Scroll" onClick={toggleStickyScroll}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >
          <span>Sticky {stickyScroll ? 'On' : 'Off'}</span>
        </button>
        {liveServerUrl && (
          <button
            style={itemStyle}
            title={`Live Server: ${liveServerUrl} — Click to open`}
            onClick={() => { try { window.open(liveServerUrl, '_blank'); } catch {} }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
          >
            <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            <span style={{ color: '#4ade80' }}>Live {liveServerUrl.replace('http://', '')}</span>
          </button>
        )}
        <div style={itemStyle}><span>UTF-8</span></div>
        <div style={itemStyle}><span>LF</span></div>
        {activeTab && <div style={itemStyle}><span>{activeTab.language}</span></div>}
        <button style={itemStyle} title="Terminal" onClick={() => { togglePanel(); setActivePanel('terminal'); }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >
          <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        </button>
        <button style={itemStyle} title="Settings" onClick={onOpenSettings}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >
          <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
        </button>
      </div>
    </div>
  );
};
