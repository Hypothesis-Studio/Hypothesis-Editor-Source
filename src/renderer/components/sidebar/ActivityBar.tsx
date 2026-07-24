/**
 * ActivityBar - Left icon bar for switching sidebar views and panels.
 * AI Agent opens as an editor tab, not a sidebar view.
 */
import React from 'react';
import { useAppStore } from '../../stores/appStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Icon } from '../common/Icon';

interface ActivityBarProps {
  onOpenSettings?: () => void;
  onOpenAgent?: () => void;
}

const views = [
  { id: 'explorer', label: 'Explorer', icon: 'files' },
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'git', label: 'Source Control', icon: 'source-control' },
  { id: 'extensions', label: 'Extensions', icon: 'extensions' },
];

const bottomItems = [
  { id: 'terminal', label: 'Terminal', icon: 'terminal' },
  { id: 'problems', label: 'Problems', icon: 'error' },
  { id: 'output', label: 'Output', icon: 'output' },
];

export const ActivityBar: React.FC<ActivityBarProps> = ({ onOpenSettings, onOpenAgent }) => {
  const {
    activeSidebarView, setActiveSidebarView,
    togglePanel, panelVisible, activePanel, setActivePanel,
  } = useAppStore();
  const agentEnabled = useSettingsStore((s) => s.settings['agent.enabled'] !== false);

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
            <Icon name={v.icon} size={20} />
          </button>
        ))}
      </div>

      {/* Bottom panels */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 8, gap: 4 }}>
        {/* AI Agent - opens as editor tab */}
        {agentEnabled && (
          <button
            onClick={onOpenAgent}
            style={{ ...iconBtnStyle(false) }}
            title="AI Agent (Ctrl+Shift+A)"
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-fg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-fg-muted)'; }}
          >
            <Icon name="robot" size={20} />
          </button>
        )}

        {bottomItems.map((p) => (
          <button
            key={p.id}
            onClick={() => handlePanelClick(p.id)}
            style={iconBtnStyle(panelVisible && activePanel === p.id)}
            title={p.label}
            onMouseEnter={(e) => { if (!(panelVisible && activePanel === p.id)) e.currentTarget.style.color = 'var(--theme-fg)'; }}
            onMouseLeave={(e) => { if (!(panelVisible && activePanel === p.id)) e.currentTarget.style.color = 'var(--theme-fg-muted)'; }}
          >
            <Icon name={p.icon} size={20} />
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
          <Icon name="settings-gear" size={20} />
        </button>
      </div>
    </div>
  );
};
