/**
 * TitleBar - Full menu bar with functional dropdown menus.
 */
import React, { useState, useCallback, useRef } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useEditorStore } from '../../stores/editorStore';
import { APP_NAME, APP_VERSION } from '../../../shared/utils/appMeta';
import { DropdownMenu, type MenuItem } from '../common/DropdownMenu';
import { WindowControls } from '../common/WindowControls';
import { showAbout } from '../../stores/dialogStore';

interface TitleBarProps {
  onNewFile?: () => void;
  onOpenFile?: () => void;
  onOpenFolder?: () => void;
  onCloseFolder?: () => void;
  hasFolder?: boolean;
  onSave?: () => void;
  onSaveAs?: () => void;
  onOpenSettings?: () => void;
  onOpenDocs?: () => void;
  onOpenShortcuts?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ onNewFile, onOpenFile, onOpenFolder, onCloseFolder, hasFolder, onSave, onSaveAs, onOpenSettings, onOpenDocs, onOpenShortcuts }) => {
  const {
    isMaximized, toggleCommandPalette, toggleSidebar, togglePanel, setActivePanel, setActiveSidebarView,
    sidebarVisible, panelVisible, runCommand,
    toggleActivityBar, toggleStatusBar, toggleBreadcrumbs, toggleZenMode, toggleWordWrap,
    toggleMinimap, toggleLineNumbers, toggleStickyScroll,
  } = useAppStore();
  const { tabs, activeTabId, closeTab } = useEditorStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  const handleMenuClick = useCallback((menuId: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({ x: rect.left, y: rect.bottom + 2 });
    setOpenMenu(openMenu === menuId ? null : menuId);
  }, [openMenu]);

  const close = () => setOpenMenu(null);

  // ── Menu definitions ────────────────────────────────────────────
  const fileMenu: MenuItem[] = [
    { label: 'New File', keybinding: 'Ctrl+N', action: onNewFile },
    { label: 'Open File', keybinding: 'Ctrl+O', action: onOpenFile },
    { label: 'Open Folder', keybinding: 'Ctrl+Shift+O', action: onOpenFolder },
    { label: 'Close Folder', keybinding: 'Ctrl+K F', action: onCloseFolder, disabled: !hasFolder },
    { separator: true, label: '' },
    { label: 'Add Folder to Workspace', action: onOpenFolder },
    { separator: true, label: '' },
    { label: 'Save', keybinding: 'Ctrl+S', action: onSave },
    { label: 'Save As', keybinding: 'Ctrl+Shift+S', action: onSaveAs },
    { label: 'Save All', action: () => {
      const state = useEditorStore.getState();
      state.tabs.forEach(t => {
        if (t.filePath && t.isDirty) {
          window.api.file.save(t.filePath, t.content);
          state.setTabDirty(t.id, false);
        }
      });
    }},
    { separator: true, label: '' },
    { label: 'Close Editor', keybinding: 'Ctrl+W', action: () => { if (activeTabId) closeTab(activeTabId); } },
    { label: 'Close All', action: () => useEditorStore.setState({ tabs: [], activeTabId: null }) },
    { separator: true, label: '' },
    { label: 'Preferences', keybinding: 'Ctrl+,', action: onOpenSettings },
    { separator: true, label: '' },
    { label: 'Exit', action: () => window.api.window.close() },
  ];

  const editMenu: MenuItem[] = [
    { label: 'Undo', keybinding: 'Ctrl+Z', action: () => useEditorStore.getState().triggerUndo() },
    { label: 'Redo', keybinding: 'Ctrl+Y', action: () => useEditorStore.getState().triggerRedo() },
    { separator: true, label: '' },
    { label: 'Cut', keybinding: 'Ctrl+X', action: () => useEditorStore.getState().triggerCut() },
    { label: 'Copy', keybinding: 'Ctrl+C', action: () => useEditorStore.getState().triggerCopy() },
    { label: 'Paste', keybinding: 'Ctrl+V', action: () => useEditorStore.getState().triggerPaste() },
    { separator: true, label: '' },
    { label: 'Find', keybinding: 'Ctrl+F', action: () => useEditorStore.getState().triggerFind() },
    { label: 'Replace', keybinding: 'Ctrl+H', action: () => useEditorStore.getState().triggerReplace() },
    { label: 'Find in Files', keybinding: 'Ctrl+Shift+F', action: () => setActiveSidebarView('search') },
    { separator: true, label: '' },
    { label: 'Select All', keybinding: 'Ctrl+A', action: () => useEditorStore.getState().triggerSelectAll() },
    { separator: true, label: '' },
    { label: 'Toggle Line Comment', keybinding: 'Ctrl+/', action: () => useEditorStore.getState().triggerComment() },
    { separator: true, label: '' },
    { label: 'Fold All', keybinding: 'Ctrl+K Ctrl+0', action: () => useEditorStore.getState().triggerFoldAll() },
    { label: 'Unfold All', keybinding: 'Ctrl+K Ctrl+J', action: () => useEditorStore.getState().triggerUnfoldAll() },
  ];

  const viewMenu: MenuItem[] = [
    { label: 'Command Palette', keybinding: 'Ctrl+Shift+P', action: toggleCommandPalette },
    { separator: true, label: '' },
    // Sidebar views
    { label: 'Explorer', keybinding: 'Ctrl+Shift+E', action: () => setActiveSidebarView('explorer') },
    { label: 'Search', keybinding: 'Ctrl+Shift+F', action: () => setActiveSidebarView('search') },
    { label: 'Source Control', keybinding: 'Ctrl+Shift+G', action: () => setActiveSidebarView('git') },
    { separator: true, label: '' },
    // Layout
    { label: 'Sidebar', keybinding: 'Ctrl+B', action: toggleSidebar, checked: sidebarVisible },
    { label: 'Panel', keybinding: 'Ctrl+J', action: togglePanel, checked: panelVisible },
    { separator: true, label: '' },
    // Editor
    { label: 'Word Wrap', keybinding: 'Alt+Z', action: toggleWordWrap, checked: useAppStore.getState().wordWrap === 'on' },
    { label: 'Minimap', action: toggleMinimap, checked: useAppStore.getState().minimapVisible },
    { label: 'Line Numbers', action: toggleLineNumbers, checked: useAppStore.getState().lineNumbers === 'on' },
    { separator: true, label: '' },
    // Quick access
    { label: 'Terminal', keybinding: 'Ctrl+`', action: () => { togglePanel(); setActivePanel('terminal'); } },
    { separator: true, label: '' },
    { label: 'Full Screen', keybinding: 'F11', action: () => window.api.window.maximize() },
  ];

  const goMenu: MenuItem[] = [
    { label: 'Go to File', keybinding: 'Ctrl+P', action: toggleCommandPalette },
    { label: 'Go to Line/Column', keybinding: 'Ctrl+G', action: () => useEditorStore.getState().triggerGoToLine() },
    { label: 'Go to Symbol', keybinding: 'Ctrl+Shift+O', action: () => useEditorStore.getState().triggerGoToSymbol() },
    { separator: true, label: '' },
    { label: 'Go to Definition', keybinding: 'F12', action: () => useEditorStore.getState().triggerGoToDefinition() },
    { label: 'Peek Definition', keybinding: 'Alt+F12', action: () => useEditorStore.getState().triggerPeekDefinition() },
    { separator: true, label: '' },
    { label: 'Back', keybinding: 'Alt+Left', action: () => useEditorStore.getState().triggerGoBack() },
    { label: 'Forward', keybinding: 'Alt+Right', action: () => useEditorStore.getState().triggerGoForward() },
  ];

  const getRunCommand = (): string | null => {
    const tab = useEditorStore.getState().tabs.find(t => t.id === useEditorStore.getState().activeTabId);
    if (!tab?.filePath) return null;
    // Save first
    window.api.file.save(tab.filePath, tab.content);
    useEditorStore.getState().setTabDirty(tab.id, false);
    const ext = tab.fileName.split('.').pop()?.toLowerCase() || '';
    const commands: Record<string, string> = {
      js: `node "${tab.filePath}"`,
      ts: `npx ts-node "${tab.filePath}"`,
      py: `python "${tab.filePath}"`,
      rb: `ruby "${tab.filePath}"`,
      go: `go run "${tab.filePath}"`,
      rs: `cargo run`,
      java: `javac "${tab.filePath}" && java "${tab.fileName.replace('.java', '')}"`,
      sh: `bash "${tab.filePath}"`,
      php: `php "${tab.filePath}"`,
    };
    return commands[ext] || null;
  };

  const runMenu: MenuItem[] = [
    { label: 'Run File', keybinding: 'Ctrl+F5', action: () => {
      const cmd = getRunCommand();
      if (cmd) {
        togglePanel();
        setActivePanel('terminal');
        setTimeout(() => runCommand(cmd), 300);
      }
    }},
    { separator: true, label: '' },
    { label: 'Stop', keybinding: 'Shift+F5', action: () => runCommand('\x03') },
    { label: 'Restart', keybinding: 'Ctrl+Shift+F5', action: () => {
      const cmd = getRunCommand();
      if (cmd) {
        runCommand(cmd);
      }
    }},
    { separator: true, label: '' },
    { label: 'Run Build Task', keybinding: 'Ctrl+Shift+B', action: () => {
      togglePanel();
      setActivePanel('terminal');
      setTimeout(() => runCommand('npm run build'), 300);
    }},
  ];

  const terminalMenu: MenuItem[] = [
    { label: 'New Terminal', keybinding: 'Ctrl+Shift+`', action: () => {
      togglePanel();
      setActivePanel('terminal');
      setTimeout(() => (window as any).__terminalPanel?.createTerminal(), 300);
    }},
    { separator: true, label: '' },
    { label: 'Kill Terminal', action: () => (window as any).__terminalPanel?.killTerminal() },
    { label: 'Clear Terminal', action: () => (window as any).__terminalPanel?.clearTerminal() },
  ];

  const helpMenu: MenuItem[] = [
    { label: 'Welcome', action: () => useEditorStore.setState({ tabs: [], activeTabId: null }) },
    { label: 'Documentation', keybinding: 'F1', action: () => onOpenDocs?.() },
    { label: 'Keyboard Shortcuts', keybinding: 'Ctrl+K Ctrl+S', action: () => onOpenShortcuts?.() },
    { separator: true, label: '' },
    { label: `About ${APP_NAME}`, action: () => {
      const v = (typeof process !== 'undefined' && process.versions) ? process.versions : {} as any;
      showAbout(`Version: ${APP_VERSION}`);
    }},
  ];

  const menus: Record<string, { label: string; items: MenuItem[] }> = {
    file: { label: 'File', items: fileMenu },
    edit: { label: 'Edit', items: editMenu },
    view: { label: 'View', items: viewMenu },
    go: { label: 'Go', items: goMenu },
    run: { label: 'Run', items: runMenu },
    terminal: { label: 'Terminal', items: terminalMenu },
    help: { label: 'Help', items: helpMenu },
  };

  return (
    <div
      className="drag-region h-9 flex items-center bg-[var(--theme-bg-tertiary)] border-b border-[var(--theme-border)] select-none"
      onDoubleClick={() => isMaximized ? window.api.window.restore() : window.api.window.maximize()}
    >
      <div className="w-2" />

      {/* Menu bar */}
      <div className="flex items-center gap-0 no-drag">
        {Object.entries(menus).map(([id, menu]) => (
          <button
            key={id}
            data-menu-id={id}
            className={`px-2.5 py-1 text-xs rounded transition-colors ${
              openMenu === id ? 'bg-[var(--theme-bg-hover)] text-[var(--theme-fg)]' : 'text-[var(--theme-fg)] hover:bg-[var(--theme-bg-hover)]'
            }`}
            onClick={(e) => handleMenuClick(id, e)}
            onMouseEnter={(ev) => {
              if (openMenu && openMenu !== id) {
                const rect = ev.currentTarget.getBoundingClientRect();
                setMenuPos({ x: rect.left, y: rect.bottom + 2 });
                setOpenMenu(id);
              }
            }}
          >
            {menu.label}
          </button>
        ))}
      </div>

      {/* Title */}
      <div className="flex-1 text-center text-xs text-[var(--theme-fg)]">
        {activeTab ? `${activeTab.isDirty ? '● ' : ''}${activeTab.fileName} — ${APP_NAME}` : APP_NAME}
      </div>

      {/* Search */}
      <div className="no-drag flex items-center gap-2 mr-2">
        <button onClick={toggleCommandPalette} className="flex items-center gap-2 px-3 py-1 w-48 text-xs text-[var(--theme-fg-muted)] bg-[var(--theme-bg-tertiary)] border border-[var(--theme-border-light)] rounded hover:bg-[var(--theme-bg-hover)]">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          Search
        </button>
      </div>

      {/* Window controls */}
      <WindowControls />

      {/* Dropdown */}
      {openMenu && menus[openMenu] && (
        <DropdownMenu items={menus[openMenu].items} x={menuPos.x} y={menuPos.y} onClose={close} />
      )}
    </div>
  );
};
