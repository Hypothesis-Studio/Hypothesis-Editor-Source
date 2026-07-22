/**
 * EditorArea - Main editor container with tabs, Monaco editor, welcome page.
 */
import React from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { MonacoEditor } from './MonacoEditor';
import { EditorTabs } from '../tabs/EditorTabs';
import { Breadcrumb } from './Breadcrumb';
import { WelcomePage } from '../pages/WelcomePage';
import { useAppStore } from '../../stores/appStore';
import { useSettingsStore } from '../../stores/settingsStore';

interface EditorAreaProps {
  onOpenFolder?: (path: string) => void;
}

export const EditorArea: React.FC<EditorAreaProps> = ({ onOpenFolder }) => {
  const { tabs, activeTabId, splits } = useEditorStore();
  const { breadcrumbsVisible } = useAppStore();
  const showTabs = useSettingsStore((s) => s.settings['workbench.editor.showTabs'] !== false);
  const activeTab = tabs.find((t) => t.id === activeTabId);

  if (tabs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: 'var(--theme-bg)' }}>
        <WelcomePage onOpenFolder={onOpenFolder} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--theme-bg)' }}>
      {showTabs && <EditorTabs />}
      {activeTab && breadcrumbsVisible && <Breadcrumb tab={activeTab} />}
      <div className="flex-1 overflow-hidden">
        {splits.length <= 1 ? (
          tabs.map((tab) => (
            <MonacoEditor key={tab.id} tab={tab} isActive={tab.id === activeTabId} />
          ))
        ) : (
          <div className="flex h-full">
            {splits.map((splitTabs, index) => (
              <div key={index} className="flex-1" style={{ borderRight: '1px solid var(--theme-border)' }}>
                {splitTabs.map((tabId) => {
                  const tab = tabs.find((t) => t.id === tabId);
                  if (!tab) return null;
                  return <MonacoEditor key={tab.id} tab={tab} isActive={tab.id === activeTabId} />;
                })}
                {splitTabs.length === 0 && (
                  <div className="h-full flex items-center justify-center text-xs" style={{ color: 'var(--theme-fg-muted)' }}>
                    Drop a file here
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
