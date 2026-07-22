/**
 * ActivityBar - Left icon bar for switching sidebar views and panels.
 */
import React from 'react';
import { useAppStore } from '../../stores/appStore';

interface ActivityBarProps {
  onOpenSettings?: () => void;
}

const views = [
  { id: 'explorer', label: 'Explorer', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { id: 'search', label: 'Search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { id: 'git', label: 'Source Control', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { id: 'extensions', label: 'Extensions', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
];

const bottomItems = [
  { id: 'terminal', label: 'Terminal', icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'problems', label: 'Problems', icon: 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'output', label: 'Output', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
];

const settingsIcon = 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4';

const Icon: React.FC<{ path: string; size?: number }> = ({ path, size = 20 }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={path} />
  </svg>
);

export const ActivityBar: React.FC<ActivityBarProps> = ({ onOpenSettings }) => {
  const {
    activeSidebarView, setActiveSidebarView,
    togglePanel, panelVisible, activePanel, setActivePanel,
  } = useAppStore();

  const handlePanelClick = (id: string) => {
    const { panelVisible, activePanel } = useAppStore.getState();
    if (panelVisible && activePanel === id) {
      useAppStore.setState({ panelVisible: false });
    } else {
      useAppStore.setState({ activePanel: id, panelVisible: true });
    }
  };

  const iconBtnStyle = (active: boolean): React.CSSProperties => ({
    width: 48,
    height: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    borderLeft: active ? '2px solid var(--theme-fg)' : '2px solid transparent',
    color: active ? 'var(--theme-fg)' : 'var(--theme-fg-muted)',
    transition: 'color 0.15s',
  });

  return (
    <div style={{ width: 48, background: 'var(--theme-bg-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: '1px solid var(--theme-border)' }}>
      {/* Sidebar views */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => setActiveSidebarView(v.id)}
            style={iconBtnStyle(activeSidebarView === v.id)}
            title={v.label}
            onMouseEnter={(e) => { if (activeSidebarView !== v.id) e.currentTarget.style.color = 'var(--theme-fg)'; }}
            onMouseLeave={(e) => { if (activeSidebarView !== v.id) e.currentTarget.style.color = 'var(--theme-fg-muted)'; }}
          >
            <Icon path={v.icon} />
          </button>
        ))}
      </div>

      {/* Bottom panels */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 8, gap: 4 }}>
        {bottomItems.map((p) => (
          <button
            key={p.id}
            onClick={() => handlePanelClick(p.id)}
            style={iconBtnStyle(panelVisible && activePanel === p.id)}
            title={p.label}
            onMouseEnter={(e) => { if (!(panelVisible && activePanel === p.id)) e.currentTarget.style.color = 'var(--theme-fg)'; }}
            onMouseLeave={(e) => { if (!(panelVisible && activePanel === p.id)) e.currentTarget.style.color = 'var(--theme-fg-muted)'; }}
          >
            <Icon path={p.icon} />
          </button>
        ))}

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          style={{ ...iconBtnStyle(false), marginTop: 8 }}
          title="Settings"
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-fg)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-fg-muted)'; }}
        >
          <Icon path={settingsIcon} />
        </button>
      </div>
    </div>
  );
};
