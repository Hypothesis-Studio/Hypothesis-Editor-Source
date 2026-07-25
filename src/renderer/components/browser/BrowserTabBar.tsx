/**
 * Hypothesis Browser - Tab Bar
 */
import React, { useRef, useState } from 'react';
import { useBrowserStore } from '../../stores/browserStore';

const S = {
  bar: {
    display: 'flex', alignItems: 'center', height: 36,
    background: 'var(--theme-bg-secondary)',
    borderBottom: '1px solid var(--theme-border)',
    padding: '0 4px', gap: 2, overflow: 'hidden', flexShrink: 0,
  },
  tabList: {
    display: 'flex', flex: 1, gap: 2, overflow: 'hidden', alignItems: 'center', height: '100%',
  },
  tab: (active: boolean, pinned: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, height: 28,
    padding: pinned ? '0 8px' : '0 10px',
    borderRadius: 6, cursor: 'pointer', flexShrink: 0,
    maxWidth: pinned ? 36 : 200, minWidth: pinned ? 36 : 80,
    background: active ? 'var(--theme-bg)' : 'transparent',
    border: active ? '1px solid var(--theme-border)' : '1px solid transparent',
    color: active ? 'var(--theme-fg)' : 'var(--theme-fg-muted)',
    fontSize: 12, transition: 'background 0.1s, color 0.1s',
    position: 'relative', overflow: 'hidden',
    userSelect: 'none',
  }),
  favicon: { width: 14, height: 14, flexShrink: 0, objectFit: 'contain' as const },
  faviconPlaceholder: {
    width: 14, height: 14, flexShrink: 0, borderRadius: 2,
    background: 'var(--theme-fg-muted)', opacity: 0.3,
  },
  title: {
    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
    fontSize: 12,
  },
  close: {
    width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 3, flexShrink: 0, opacity: 0.6, fontSize: 12,
    transition: 'opacity 0.15s, background 0.15s',
  },
  spinner: {
    width: 12, height: 12, border: '2px solid var(--theme-border)',
    borderTopColor: 'var(--theme-accent)', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite', flexShrink: 0,
  },
  newBtn: {
    width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 5, cursor: 'pointer', flexShrink: 0,
    color: 'var(--theme-fg-muted)', fontSize: 18, lineHeight: 1,
    border: '1px solid transparent',
    transition: 'background 0.15s, color 0.15s',
  },
};

const BrowserTabBar: React.FC = () => {
  const { tabs, activeTabId, activateTab, closeTab, createTab } = useBrowserStore();
  const [hoverClose, setHoverClose] = useState<string | null>(null);
  const [hoverTab, setHoverTab] = useState<string | null>(null);

  return (
    <div style={S.bar}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={S.tabList}>
        {tabs.map(tab => (
          <div
            key={tab.id}
            style={{
              ...S.tab(tab.id === activeTabId, tab.isPinned),
              background: hoverTab === tab.id && tab.id !== activeTabId
                ? 'var(--theme-bg-tertiary)' : S.tab(tab.id === activeTabId, tab.isPinned).background,
            }}
            onClick={() => activateTab(tab.id)}
            onMouseEnter={() => setHoverTab(tab.id)}
            onMouseLeave={() => setHoverTab(null)}
            title={tab.title || tab.url}
          >
            {tab.isLoading
              ? <div style={S.spinner} />
              : tab.favicon
                ? <img src={tab.favicon} style={S.favicon} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                : <div style={S.faviconPlaceholder} />
            }
            {!tab.isPinned && (
              <span style={S.title}>{tab.title || tab.url}</span>
            )}
            {!tab.isPinned && (
              <span
                style={{
                  ...S.close,
                  opacity: hoverClose === tab.id ? 1 : hoverTab === tab.id ? 0.6 : 0,
                  background: hoverClose === tab.id ? 'var(--theme-bg-tertiary)' : 'transparent',
                }}
                onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
                onMouseEnter={() => setHoverClose(tab.id)}
                onMouseLeave={() => setHoverClose(null)}
              >×</span>
            )}
          </div>
        ))}
      </div>
      <div
        style={S.newBtn}
        onClick={() => createTab()}
        title="New Tab"
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-tertiary)'; (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
      >+</div>
    </div>
  );
};

export default BrowserTabBar;
