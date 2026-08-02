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
import { useDialogStore } from '../../stores/dialogStore';
import { Icon } from '../common/Icon';

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
    { label: 'AI Agent', keybinding: 'Ctrl+Shift+A', action: () => window.dispatchEvent(new CustomEvent('hypothesis:open-agent-tab')) },
    { label: 'REST Client', keybinding: 'Ctrl+Shift+R', action: () => {
      const id = 'rest-client-tab';
      const s = useEditorStore.getState();
      if (s.tabs.find(t => t.id === id)) { s.setActiveTab(id); } else {
        s.openTab({ id, filePath: null, fileName: 'REST Client', language: 'rest-client', content: '', isDirty: false, isPinned: true, isPreview: false, viewState: null, scrollTop: 0, scrollLeft: 0, cursorPosition: { line: 1, column: 1 }, encoding: 'UTF-8', lineEnding: 'LF', savedContent: '', createdAt: Date.now(), modifiedAt: Date.now() });
      }
    }},
    { label: 'Database Explorer', keybinding: 'Ctrl+Shift+D', action: () => {
      const id = 'database-tab';
      const s = useEditorStore.getState();
      if (s.tabs.find(t => t.id === id)) { s.setActiveTab(id); } else {
        s.openTab({ id, filePath: null, fileName: 'Database Explorer', language: 'database', content: '', isDirty: false, isPinned: true, isPreview: false, viewState: null, scrollTop: 0, scrollLeft: 0, cursorPosition: { line: 1, column: 1 }, encoding: 'UTF-8', lineEnding: 'LF', savedContent: '', createdAt: Date.now(), modifiedAt: Date.now() });
      }
    }},
    { label: 'Web Browser', keybinding: 'Ctrl+Shift+B', action: () => {
      const id = 'browser-tab';
      const s = useEditorStore.getState();
      if (s.tabs.find(t => t.id === id)) { s.setActiveTab(id); } else {
        s.openTab({ id, filePath: null, fileName: 'Web Browser', language: 'browser', content: '', isDirty: false, isPinned: true, isPreview: false, viewState: null, scrollTop: 0, scrollLeft: 0, cursorPosition: { line: 1, column: 1 }, encoding: 'UTF-8', lineEnding: 'LF', savedContent: '', createdAt: Date.now(), modifiedAt: Date.now() });
      }
    }},
    { label: 'Extensions', keybinding: 'Ctrl+Shift+X', action: () => setActiveSidebarView('extensions') },
    { separator: true, label: '' },
    { label: 'Project Insights', action: () => {
      const insightsTabId = 'insights-tab';
      const existing = useEditorStore.getState().tabs.find(t => t.id === insightsTabId);
      if (existing) {
        useEditorStore.getState().setActiveTab(insightsTabId);
      } else {
        useEditorStore.getState().openTab({
          id: insightsTabId, filePath: null, fileName: 'Insights', language: 'insights',
          content: '', isDirty: false, isPinned: true, isPreview: false, viewState: null,
          scrollTop: 0, scrollLeft: 0, cursorPosition: { line: 1, column: 1 },
          encoding: 'UTF-8', lineEnding: 'LF', savedContent: '',
          createdAt: Date.now(), modifiedAt: Date.now(),
        });
      }
    }},
    { separator: true, label: '' },
    { label: 'Zen Mode', keybinding: 'Ctrl+Shift+Z', action: toggleZenMode },
    { separator: true, label: '' },
    { label: 'Full Screen', keybinding: 'F11', action: () => window.api.window.maximize() },
  ];

  const goMenu: MenuItem[] = [
    { label: 'Go to File', keybinding: 'Ctrl+P', action: toggleCommandPalette },
    { label: 'Go to Line/Column', keybinding: 'Ctrl+G', action: () => useEditorStore.getState().triggerGoToLine() },
    { label: 'Go to Symbol', keybinding: 'Ctrl+Shift+M', action: () => useEditorStore.getState().triggerGoToSymbol() },
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
        if (!panelVisible) togglePanel();
        setActivePanel('output');
        setTimeout(() => runCommand(cmd), 100);
      } else {
        useDialogStore.getState().showDialog({
          title: 'Cannot Run',
          message: 'No active file or unsupported file type.',
          type: 'alert',
          buttons: [{ label: 'OK', variant: 'primary' }],
        });
      }
    }},
    { separator: true, label: '' },
    { label: 'Stop', keybinding: 'Shift+F5', action: async () => {
      try {
        const api = (window as any).api;
        const runs = await api?.run?.list?.();
        if (Array.isArray(runs) && runs.length > 0) {
          await api?.run?.kill?.(runs[runs.length - 1].runId);
        } else {
          const terminalId = useAppStore.getState().activeTerminalId;
          if (terminalId) window.api.terminal.write(terminalId, '\x03');
        }
      } catch {
        const terminalId = useAppStore.getState().activeTerminalId;
        if (terminalId) window.api.terminal.write(terminalId, '\x03');
      }
    }},
    { label: 'Stop All', action: async () => {
      try {
        const api = (window as any).api;
        await api?.run?.killAll?.();
      } catch { /* no active runs */ }
    }},
    { separator: true, label: '' },
    { label: 'Restart', keybinding: 'Ctrl+Shift+F5', action: () => {
      const cmd = getRunCommand();
      if (cmd) {
        if (!panelVisible) togglePanel();
        setActivePanel('output');
        runCommand(cmd);
      }
    }},
    { separator: true, label: '' },
    { label: 'Run Build Task', action: () => {
      if (!panelVisible) togglePanel();
      setActivePanel('output');
      setTimeout(() => runCommand('npm run build'), 100);
    }},
  ];

  const terminalMenu: MenuItem[] = [
    { label: 'New Terminal', keybinding: 'Ctrl+Shift+`', action: () => {
      if (!panelVisible) togglePanel();
      setActivePanel('terminal');
      // Try global ref first, fall back to IPC
      setTimeout(() => {
        const panel = (window as any).__terminalPanel;
        if (panel?.createTerminal) {
          panel.createTerminal();
        } else {
          window.api.menu?.onChannel?.('menu:new-terminal', () => {});
          const win = (window as any);
          win.dispatchEvent(new CustomEvent('hypothesis:new-terminal'));
        }
      }, 150);
    }},
    { separator: true, label: '' },
    { label: 'Kill Terminal', keybinding: 'Ctrl+Shift+Delete', action: () => {
      const panel = (window as any).__terminalPanel;
      if (panel?.killTerminal) {
        panel.killTerminal();
      } else {
        const terminalId = useAppStore.getState().activeTerminalId;
        if (terminalId) window.api.terminal.write(terminalId, '\x03');
      }
    }},
    { label: 'Clear Terminal', action: () => {
      const panel = (window as any).__terminalPanel;
      if (panel?.clearTerminal) {
        panel.clearTerminal();
      } else {
        const terminalId = useAppStore.getState().activeTerminalId;
        if (terminalId) window.api.terminal.write(terminalId, '\x0C');
      }
    }},
  ];

  const helpMenu: MenuItem[] = [
    { label: 'Welcome', action: () => {
      window.dispatchEvent(new CustomEvent('hypothesis:open-welcome'));
    }},
    { label: 'Documentation', keybinding: 'F1', action: () => onOpenDocs?.() },
    { label: 'Keyboard Shortcuts', keybinding: 'Ctrl+K Ctrl+S', action: () => onOpenShortcuts?.() },
    { separator: true, label: '' },
    { label: 'Check for Updates', action: async () => {
      const { checkForUpdates, openReleaseUrl } = await import('../../utils/updateChecker');
      const info = await checkForUpdates();
      if (info.error) {
        useDialogStore.getState().showDialog({
          title: 'Update Check',
          message: `Failed to check for updates:\n${info.error}`,
          type: 'alert',
          buttons: [{ label: 'OK', variant: 'primary' }],
        });
        return;
      }
      if (info.hasUpdate) {
        const pubDate = info.publishedAt
          ? new Date(info.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : '';
        const btnIndex = await useDialogStore.getState().showDialog({
          title: 'Update Available',
          message: `A new version of ${APP_NAME} is available!\n\nCurrent: v${info.currentVersion}\nLatest: v${info.latestVersion}${pubDate ? '\nPublished: ' + pubDate : ''}\n\nWould you like to download the update?`,
          type: 'confirm',
          buttons: [
            { label: 'Later', variant: 'secondary' },
            { label: 'Update Now', variant: 'primary' },
          ],
        });
        if (btnIndex === 1) openReleaseUrl(info.releaseUrl);
      } else {
        useDialogStore.getState().showDialog({
          title: 'Up to Date',
          message: `You are running the latest version of ${APP_NAME} (v${info.currentVersion}).`,
          type: 'alert',
          buttons: [{ label: 'OK', variant: 'primary' }],
        });
      }
    }},
    { separator: true, label: '' },
    { label: `About ${APP_NAME}`, action: () => showAbout(`Version: ${APP_VERSION}`) },
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
          <Icon name="search" size={12} />
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
