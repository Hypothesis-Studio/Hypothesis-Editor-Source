/**
 * Editor Tabs - Tab bar with right-click context menu, drag-drop reorder, dirty indicator.
 */
import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { renderFileIcon, type IconTheme } from '../../utils/fileIcons';
import type { EditorTab } from '../../../shared/types';
import { Icon } from '../common/Icon';

export const EditorTabs: React.FC = () => {
  const { tabs, activeTabId, setActiveTab, closeTab, setTabPinned, reorderTabs, startDiff } = useEditorStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const [diffPickerSource, setDiffPickerSource] = useState<string | null>(null);
  const contextRef = useRef<HTMLDivElement>(null);

  const handleCloseTab = useCallback((e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    closeTab(tabId);
  }, [closeTab]);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(fromIndex) && fromIndex !== toIndex) reorderTabs(fromIndex, toIndex);
  }, [reorderTabs]);

  const handleContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    return () => { document.removeEventListener('click', close); };
  }, [contextMenu]);

  // ── Context menu actions ────────────────────────────────────────
  const ctxClose = () => { if (contextMenu) closeTab(contextMenu.tabId); setContextMenu(null); };
  const ctxCloseOthers = () => {
    if (!contextMenu) return;
    const keepId = contextMenu.tabId;
    tabs.forEach(t => { if (t.id !== keepId) closeTab(t.id); });
    setContextMenu(null);
  };
  const ctxCloseRight = () => {
    if (!contextMenu) return;
    const idx = tabs.findIndex(t => t.id === contextMenu.tabId);
    tabs.slice(idx + 1).forEach(t => closeTab(t.id));
    setContextMenu(null);
  };
  const ctxCloseLeft = () => {
    if (!contextMenu) return;
    const idx = tabs.findIndex(t => t.id === contextMenu.tabId);
    tabs.slice(0, idx).forEach(t => closeTab(t.id));
    setContextMenu(null);
  };
  const ctxCloseAll = () => {
    tabs.forEach(t => closeTab(t.id));
    setContextMenu(null);
  };
  const ctxCloseSaved = () => {
    tabs.filter(t => !t.isDirty).forEach(t => closeTab(t.id));
    setContextMenu(null);
  };
  const ctxCloseUnpinned = () => {
    tabs.filter(t => !t.isPinned).forEach(t => closeTab(t.id));
    setContextMenu(null);
  };
  const ctxPin = () => {
    if (contextMenu) setTabPinned(contextMenu.tabId, true);
    setContextMenu(null);
  };
  const ctxUnpin = () => {
    if (contextMenu) setTabPinned(contextMenu.tabId, false);
    setContextMenu(null);
  };
  const ctxCopyPath = () => {
    if (contextMenu) {
      const tab = tabs.find(t => t.id === contextMenu.tabId);
      if (tab?.filePath) navigator.clipboard.writeText(tab.filePath);
    }
    setContextMenu(null);
  };
  const ctxCopyFileName = () => {
    if (contextMenu) {
      const tab = tabs.find(t => t.id === contextMenu.tabId);
      if (tab) navigator.clipboard.writeText(tab.fileName);
    }
    setContextMenu(null);
  };
  const ctxRevealInExplorer = () => {
    if (contextMenu) {
      const tab = tabs.find(t => t.id === contextMenu.tabId);
      if (tab?.filePath) {
        // Open containing folder in OS explorer
        const lastSlash = Math.max(tab.filePath.lastIndexOf('/'), tab.filePath.lastIndexOf('\\'));
        const dir = lastSlash >= 0 ? tab.filePath.substring(0, lastSlash) : '';
        window.api.directory.read(dir).catch(() => {});
      }
    }
    setContextMenu(null);
  };
  const ctxCompareWith = () => {
    if (!contextMenu) return;
    setDiffPickerSource(contextMenu.tabId);
    setContextMenu(null);
  };

  // ── Icon theme ──────────────────────────────────────────────
  const iconTheme = (useSettingsStore((s) => s.settings['workbench.iconTheme'] as string) || 'material') as IconTheme;
  const getFileIcon = (tab: EditorTab): React.ReactElement | null => {
    const ext = tab.fileName.split('.').pop()?.toLowerCase() || '';
    return renderFileIcon(ext, iconTheme);
  };

  const ctxTab = contextMenu ? tabs.find(t => t.id === contextMenu.tabId) : null;
  const ctxIndex = contextMenu ? tabs.findIndex(t => t.id === contextMenu.tabId) : -1;

  if (tabs.length === 0) return null;

  return (
    <>
      <div className="flex bg-[var(--theme-bg-secondary)] border-b border-[var(--theme-border)] overflow-x-auto">
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'active' : ''} group`}
            onClick={() => setActiveTab(tab.id)}
            onContextMenu={(e) => handleContextMenu(e, tab.id)}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, index)}
          >
            <span className="text-sm mr-1">{getFileIcon(tab)}</span>
            <span className="truncate flex-1 text-xs">
              {tab.isDirty && <span className="mr-1" style={{ color: 'var(--theme-warning)' }}>●</span>}
              {tab.fileName}
            </span>
            {tab.isPinned && <span className="text-[10px] mr-1" style={{ color: 'var(--theme-fg-muted)' }}><Icon name="pin" size={10} /></span>}
            <button
              className="close-button ml-1 opacity-0 group-hover:opacity-100"
              onClick={(e) => handleCloseTab(e, tab.id)}
              title="Close"
            >
              <Icon name="close" size={12} />
            </button>
          </div>
        ))}
        <div className="flex-1" />
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextRef}
          className="context-menu fixed z-[9999]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu-item" onClick={ctxClose}>Close</div>
          <div className="context-menu-item" onClick={ctxCloseOthers}>Close Others</div>
          <div className={`context-menu-item ${ctxIndex <= 0 ? 'opacity-40 cursor-default' : ''}`} onClick={ctxIndex > 0 ? ctxCloseLeft : undefined}>Close to the Left</div>
          <div className={`context-menu-item ${ctxIndex >= tabs.length - 1 ? 'opacity-40 cursor-default' : ''}`} onClick={ctxIndex < tabs.length - 1 ? ctxCloseRight : undefined}>Close to the Right</div>
          <div className="context-menu-item" onClick={ctxCloseSaved}>Close Saved</div>
          <div className="context-menu-item" onClick={ctxCloseUnpinned}>Close Unpinned</div>
          <div className="context-menu-separator" />
          <div className="context-menu-item" onClick={ctxCloseAll}>Close All</div>
          <div className="context-menu-separator" />
          {ctxTab?.isPinned ? (
            <div className="context-menu-item" onClick={ctxUnpin}>Unpin Tab</div>
          ) : (
            <div className="context-menu-item" onClick={ctxPin}>Pin Tab</div>
          )}
          <div className="context-menu-separator" />
          <div className={`context-menu-item ${!ctxTab?.filePath ? 'opacity-40 cursor-default' : ''}`} onClick={ctxTab?.filePath ? ctxCopyPath : undefined}>Copy Path</div>
          <div className="context-menu-item" onClick={ctxCopyFileName}>Copy File Name</div>
          <div className={`context-menu-item ${!ctxTab?.filePath ? 'opacity-40 cursor-default' : ''}`} onClick={ctxTab?.filePath ? ctxRevealInExplorer : undefined}>Reveal in File Explorer</div>
          <div className="context-menu-separator" />
          <div className={`context-menu-item ${tabs.length < 2 || !ctxTab?.filePath ? 'opacity-40 cursor-default' : ''}`} onClick={tabs.length >= 2 && ctxTab?.filePath ? ctxCompareWith : undefined}>Compare With...</div>
        </div>
      )}

      {/* Diff Picker — select a tab to compare with */}
      {diffPickerSource && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setDiffPickerSource(null)} />
          <div
            className="context-menu fixed z-[9999]"
            style={{
              left: '50%', top: '30%', transform: 'translateX(-50%)',
              minWidth: 280, padding: '4px 0',
            }}
          >
            <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, color: 'var(--theme-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Compare "{tabs.find(t => t.id === diffPickerSource)?.fileName}" with:
            </div>
            <div className="context-menu-separator" />
            {tabs.filter(t => t.id !== diffPickerSource && t.filePath !== null).map(t => (
              <div
                key={t.id}
                className="context-menu-item"
                onClick={() => {
                  startDiff(diffPickerSource, t.id);
                  setDiffPickerSource(null);
                }}
              >
                {t.fileName}
                {t.filePath && (
                  <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)', marginLeft: 8 }}>
                    {t.filePath}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
};
