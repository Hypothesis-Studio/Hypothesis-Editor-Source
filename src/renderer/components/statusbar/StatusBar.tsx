/**
 * StatusBar - Bottom information bar with interactive click-to-toggle items.
 */
import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useEditorStore } from '../../stores/editorStore';
import { Icon } from '../common/Icon';

interface StatusBarProps {
  rootPath?: string | null;
  onOpenSettings?: () => void;
  onOpenSnippets?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({ rootPath, onOpenSettings, onOpenSnippets }) => {
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
          <Icon name="source-control" size={14} />
          <span>main</span>
        </button>
        <button style={itemStyle} title="Errors and Warnings"
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >
          <Icon name="warning" size={14} />
          <span>0</span>
          <Icon name="error" size={14} style={{ marginLeft: 4 }} />
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
            <Icon name="link-external" size={14} />
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
          <Icon name="terminal" size={14} />
        </button>
        <button style={itemStyle} title="Snippets" onClick={onOpenSnippets}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >
          <Icon name="symbol-snippet" size={14} />
          <span>Snippets</span>
        </button>
        <button style={itemStyle} title="Settings" onClick={onOpenSettings}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >
          <Icon name="settings-gear" size={14} />
        </button>
      </div>
    </div>
  );
};
