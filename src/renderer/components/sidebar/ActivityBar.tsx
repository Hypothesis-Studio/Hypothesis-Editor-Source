/**
 * ActivityBar - Left icon bar with grouped layout:
 *
 * Group 1 (top):    Explorer, Search, Source Control, Extensions
 * Group 2 (middle): AI Agent, REST Client, Database Explorer, Project Insights
 * Group 3 (bottom): Terminal, Problems, Output, Settings
 */
import React, { useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Icon } from '../common/Icon';

interface ActivityBarProps {
  onOpenSettings?: () => void;
  onOpenAgent?: () => void;
  onOpenInsights?: () => void;
  onOpenRestClient?: () => void;
  onOpenDatabase?: () => void;
}

// ── Single icon button ─────────────────────────────────────────────
interface ItemProps {
  icon: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

const Item: React.FC<ItemProps> = ({ icon, label, active = false, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      title={label}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 48, height: 44,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', border: 'none', background: 'transparent',
        borderLeft: active
          ? '2px solid var(--theme-fg)'
          : '2px solid transparent',
        color: (active || hov) ? 'var(--theme-fg)' : 'var(--theme-fg-muted)',
        transition: 'color 0.12s',
        flexShrink: 0,
      }}
    >
      <Icon name={icon} size={20} />
    </button>
  );
};

// ── ActivityBar ───────────────────────────────────────────────────
export const ActivityBar: React.FC<ActivityBarProps> = ({
  onOpenSettings,
  onOpenAgent,
  onOpenInsights,
  onOpenRestClient,
  onOpenDatabase,
}) => {
  const { activeSidebarView, setActiveSidebarView, panelVisible, activePanel } = useAppStore();
  const agentEnabled = useSettingsStore(s => s.settings['agent.enabled'] !== false);

  const handlePanelClick = (id: string) => {
    const state = useAppStore.getState();
    if (state.panelVisible && state.activePanel === id) {
      useAppStore.setState({ panelVisible: false });
    } else {
      useAppStore.setState({ activePanel: id, panelVisible: true });
    }
  };

  const isPanelActive = (id: string) => panelVisible && activePanel === id;

  return (
    <div style={{
      width: 48,
      background: 'var(--theme-bg-secondary)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      borderRight: '1px solid var(--theme-border)',
    }}>

      {/* ── Group 1: top ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
        <Item icon="files"          label="Explorer"       active={activeSidebarView === 'explorer'}   onClick={() => setActiveSidebarView('explorer')} />
        <Item icon="search"         label="Search"         active={activeSidebarView === 'search'}     onClick={() => setActiveSidebarView('search')} />
        <Item icon="source-control" label="Source Control" active={activeSidebarView === 'git'}        onClick={() => setActiveSidebarView('git')} />
        <Item icon="extensions"     label="Extensions"     active={activeSidebarView === 'extensions'} onClick={() => setActiveSidebarView('extensions')} />
      </div>

      {/* ── Group 2: center ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {agentEnabled && (
          <Item icon="robot"     label="AI Agent"        onClick={onOpenAgent} />
        )}
        <Item icon="plug"      label="REST Client"       onClick={onOpenRestClient} />
        <Item icon="database"  label="Database Explorer" onClick={onOpenDatabase} />
        <Item icon="dashboard" label="Project Insights"  onClick={onOpenInsights} />
      </div>

      {/* ── Group 3: bottom ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 4 }}>
        <Item icon="terminal"      label="Terminal" active={isPanelActive('terminal')} onClick={() => handlePanelClick('terminal')} />
        <Item icon="error"         label="Problems" active={isPanelActive('problems')} onClick={() => handlePanelClick('problems')} />
        <Item icon="output"        label="Output"   active={isPanelActive('output')}   onClick={() => handlePanelClick('output')} />
        <Item icon="settings-gear" label="Settings" onClick={onOpenSettings} />
      </div>

    </div>
  );
};
