/**
 * EditorArea - Main editor container with tabs, Monaco editor, welcome page.
 * Supports Tab and Side-by-side preview layout for previewable file types.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { MonacoEditor } from './MonacoEditor';
import { EditorTabs } from '../tabs/EditorTabs';
import { Breadcrumb } from './Breadcrumb';
import { WelcomePage } from '../pages/WelcomePage';
import { AgentPanel } from '../agent/AgentPanel';
import { ProjectInsightsPanel } from '../insights/ProjectInsightsPanel';
import { PreviewPanel } from '../preview/PreviewPanel';
import { useAppStore } from '../../stores/appStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Icon } from '../common/Icon';
import { DiffEditor } from './DiffEditor';

// Extensions that support preview mode
const PREVIEWABLE_EXTENSIONS = new Set([
  'html', 'htm', 'md', 'mdx', 'markdown', 'svg',
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'ico', 'avif', 'apng',
  'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma',
  'mp4', 'm4v', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'ogv',
  'pdf',
]);

function isPreviewable(filePath: string | null): boolean {
  if (!filePath) return false;
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return PREVIEWABLE_EXTENSIONS.has(ext);
}

type PreviewLayoutMode = 'tab' | 'side-by-side';

interface EditorAreaProps {
  onOpenFolder?: (path: string) => void;
  onOpenSettings?: (category?: string) => void;
}

export const EditorArea: React.FC<EditorAreaProps> = ({ onOpenFolder, onOpenSettings }) => {
  const { tabs, activeTabId, splits, diffOriginalTabId, diffModifiedTabId } = useEditorStore();
  const { breadcrumbsVisible } = useAppStore();
  const showTabs = useSettingsStore((s) => s.settings['workbench.editor.showTabs'] !== false);
  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Preview layout mode from settings
  const [previewLayout, setPreviewLayout] = useState<PreviewLayoutMode>('tab');
  useEffect(() => {
    const api = (window as any).api;
    if (api?.settings) {
      api.settings.get('editor.preview.layout').then((val: unknown) => {
        if (val === 'tab' || val === 'side-by-side') setPreviewLayout(val);
      }).catch(() => {});
    }
  }, []);

  // Side-by-side split ratio (0.0–1.0, default 50%)
  const [splitRatio, setSplitRatio] = useState<number>(0.5);
  const [isResizingSplit, setIsResizingSplit] = useState(false);

  // Per-tab view mode: 'code' | 'preview'
  const [viewModes, setViewModes] = useState<Record<string, 'code' | 'preview'>>({});

  const getViewMode = useCallback((tabId: string): 'code' | 'preview' => {
    return viewModes[tabId] || 'code';
  }, [viewModes]);

  const setViewMode = useCallback((tabId: string, mode: 'code' | 'preview') => {
    setViewModes(prev => ({ ...prev, [tabId]: mode }));
  }, []);

  // Listen for settings changes
  useEffect(() => {
    const api = (window as any).api;
    if (!api?.settings?.onChanged) return;
    const unsub = api.settings.onChanged((settings: Record<string, unknown>) => {
      if (settings['editor.preview.layout']) {
        const val = settings['editor.preview.layout'];
        if (val === 'tab' || val === 'side-by-side') setPreviewLayout(val);
      }
    });
    return unsub;
  }, []);

  if (tabs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: 'var(--theme-bg)' }}>
        <WelcomePage onOpenFolder={onOpenFolder} />
      </div>
    );
  }

  const isAgentTab = activeTab?.id === 'agent-tab';
  const isInsightsTab = activeTab?.id === 'insights-tab';
  const canPreview = activeTab ? isPreviewable(activeTab.filePath) : false;
  const currentViewMode = activeTab ? getViewMode(activeTab.id) : 'code';

  // Diff mode
  const diffOriginalTab = diffOriginalTabId ? tabs.find(t => t.id === diffOriginalTabId) : null;
  const diffModifiedTab = diffModifiedTabId ? tabs.find(t => t.id === diffModifiedTabId) : null;
  const isDiffMode = diffOriginalTab && diffModifiedTab;

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--theme-bg)' }}>
      {showTabs && <EditorTabs />}
      {activeTab && breadcrumbsVisible && !isAgentTab && !isInsightsTab && <Breadcrumb tab={activeTab} />}

      {/* Code | Preview toggle bar */}
      {canPreview && activeTab && previewLayout === 'tab' && (
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '0 12px', height: 30,
          background: 'var(--theme-bg-secondary)',
          borderBottom: '1px solid var(--theme-border)',
          flexShrink: 0, gap: 0,
        }}>
          <button
            onClick={() => setViewMode(activeTab.id, 'code')}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '0 12px', height: '100%',
              background: currentViewMode === 'code' ? 'var(--theme-bg)' : 'transparent',
              border: 'none',
              borderBottom: currentViewMode === 'code' ? '2px solid var(--theme-accent)' : '2px solid transparent',
              color: currentViewMode === 'code' ? 'var(--theme-fg)' : 'var(--theme-fg-muted)',
              fontSize: 11, fontWeight: currentViewMode === 'code' ? 600 : 400,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <Icon name="code" size={13} />
            Code
          </button>
          <button
            onClick={() => setViewMode(activeTab.id, 'preview')}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '0 12px', height: '100%',
              background: currentViewMode === 'preview' ? 'var(--theme-bg)' : 'transparent',
              border: 'none',
              borderBottom: currentViewMode === 'preview' ? '2px solid var(--theme-accent)' : '2px solid transparent',
              color: currentViewMode === 'preview' ? 'var(--theme-fg)' : 'var(--theme-fg-muted)',
              fontSize: 11, fontWeight: currentViewMode === 'preview' ? 600 : 400,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <Icon name="preview" size={13} />
            Preview
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {isDiffMode ? (
          <DiffEditor originalTab={diffOriginalTab!} modifiedTab={diffModifiedTab!} />
        ) : isAgentTab ? (
          <AgentPanel onOpenSettings={onOpenSettings} />
        ) : isInsightsTab ? (
          <ProjectInsightsPanel rootPath={(window as any).__hypothesis_rootPath || null} />
        ) : canPreview && activeTab ? (
          previewLayout === 'side-by-side' ? (
            <div style={{ display: 'flex', height: '100%', position: 'relative' }}>
              <div style={{ width: `${splitRatio * 100}%`, borderRight: '1px solid var(--theme-border)', overflow: 'hidden' }}>
                <MonacoEditor tab={activeTab} isActive={true} />
              </div>
              {/* Resize handle */}
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsResizingSplit(true);
                  document.body.style.cursor = 'col-resize';
                  document.body.style.userSelect = 'none';
                  const startX = e.clientX;
                  const container = (e.target as HTMLElement).parentElement!;
                  const containerWidth = container.getBoundingClientRect().width;
                  const startRatio = splitRatio;

                  const onMove = (ev: MouseEvent) => {
                    const delta = ev.clientX - startX;
                    const newRatio = Math.max(0.15, Math.min(0.85, startRatio + delta / containerWidth));
                    setSplitRatio(newRatio);
                  };
                  const onUp = () => {
                    setIsResizingSplit(false);
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                  };
                  document.addEventListener('mousemove', onMove);
                  document.addEventListener('mouseup', onUp);
                }}
                style={{
                  width: 6,
                  cursor: 'col-resize',
                  background: isResizingSplit ? 'var(--theme-accent)' : 'var(--theme-border)',
                  flexShrink: 0,
                  transition: isResizingSplit ? 'none' : 'background 0.15s',
                  zIndex: 10,
                  position: 'relative',
                }}
                onMouseEnter={(e) => { if (!isResizingSplit) (e.target as HTMLElement).style.background = 'var(--theme-accent)'; }}
                onMouseLeave={(e) => { if (!isResizingSplit) (e.target as HTMLElement).style.background = 'var(--theme-border)'; }}
              />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <PreviewPanel filePath={activeTab.filePath!} />
              </div>
              {/* Overlay to capture mouse during resize (blocks iframe/preview events) */}
              {isResizingSplit && (
                <div style={{
                  position: 'absolute', inset: 0,
                  zIndex: 9999,
                  cursor: 'col-resize',
                  background: 'transparent',
                }} />
              )}
            </div>
          ) : currentViewMode === 'preview' ? (
            <PreviewPanel filePath={activeTab.filePath!} />
          ) : (
            <MonacoEditor tab={activeTab} isActive={true} />
          )
        ) : splits.length <= 1 ? (
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
