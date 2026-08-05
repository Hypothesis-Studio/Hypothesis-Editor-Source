/**
 * App.tsx - Root application component. Session restore, all features wired.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { APP_NAME } from '../shared/utils/appMeta';
import { TitleBar } from './components/titlebar/TitleBar';
import { ActivityBar } from './components/sidebar/ActivityBar';
import { Sidebar } from './components/sidebar/Sidebar';
import { EditorArea } from './components/editor/EditorArea';
import { StatusBar } from './components/statusbar/StatusBar';
import { Panel } from './components/terminal/Panel';
import { WindowControls } from './components/common/WindowControls';
import { CommandPalette } from './components/command-palette/CommandPalette';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { DocumentationPage } from './components/docs/DocumentationPage';
import { KeyboardShortcutsPage } from './components/docs/KeyboardShortcutsPage';
import { GlobalDialog } from './components/common/GlobalDialog';
import { useDialogStore } from './stores/dialogStore';
import { useThemeStore } from './stores/themeStore';
import { useSettingsStore } from './stores/settingsStore';
import { useAppStore } from './stores/appStore';
import { useEditorStore } from './stores/editorStore';
import { useSessionStore } from './stores/sessionStore';
import { useWorkspaceStore } from './stores/workspaceStore';
import { initRunListeners } from './stores/runStore';
import { useBrowserStore } from './stores/browserStore';
import { pluginManager } from './plugins/PluginManager';
import { useKeyboardShortcutStore } from './stores/keyboardShortcutStore';
import { WelcomePage } from './components/pages/WelcomePage';
import { AboutDialog } from './components/docs/AboutDialog';
import { SnippetManagerPanel } from './components/snippets/SnippetManagerPanel';

const App: React.FC = () => {
  const {
    sidebarVisible, activeSidebarView, panelVisible,
    commandPaletteVisible, showCommandPalette, hideCommandPalette,
    toggleSidebar, togglePanel, setActivePanel, setActiveSidebarView,
    setStatusMessage,
    toggleActivityBar, toggleStatusBar, toggleBreadcrumbs,
    toggleZenMode, toggleWordWrap, toggleMinimap, toggleLineNumbers,
    toggleStickyScroll, activityBarVisible, statusBarVisible, zenMode,
  } = useAppStore();
  const { openTab, tabs, activeTabId, setTabDirty, updateTab, closeTab } = useEditorStore();
  const settings = useSettingsStore((s) => s.settings);
  const agentEnabled = settings['agent.enabled'] !== false; // default true

  // Close agent tab when agent is disabled
  useEffect(() => {
    if (!agentEnabled) {
      const agentTab = useEditorStore.getState().tabs.find(t => t.id === 'agent-tab');
      if (agentTab) {
        useEditorStore.getState().closeTab('agent-tab');
      }
    }
  }, [agentEnabled]);
  const session = useSessionStore();
  const workspace = useWorkspaceStore();
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsCategory, setSettingsCategory] = useState<string | undefined>(undefined);
  const [showDocs, setShowDocs] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);
  const [sessionRestored, setSessionRestored] = useState(false);

  // ── Wire stores to PluginManager for extension API ─────────────
  useEffect(() => {
    pluginManager.wireStores({
      editorStore: useEditorStore,
      appStore: useAppStore,
      settingsStore: useSettingsStore,
    });
  }, []);

  // ── Init global run event listeners (once) ────────────────────
  useEffect(() => {
    initRunListeners();
  }, []);

  // ── Push editor state to main process for extensions ──────────
  const _extActiveTabId = useEditorStore((s) => s.activeTabId);
  const _extEditorTabs = useEditorStore((s) => s.tabs);
  const _extCursorPos = useEditorStore((s) => s.cursorPosition);
  const _extLastPushRef = React.useRef<string>('');

  // Push active document state on tab switch or save
  useEffect(() => {
    const tab = _extEditorTabs.find(t => t.id === _extActiveTabId);
    if (tab) {
      const key = tab.filePath + '|' + tab.isDirty;
      if (key !== _extLastPushRef.current || !_extLastPushRef.current) {
        _extLastPushRef.current = key;
        (window as any).api?.extension?.editor?.pushState?.({
          uri: tab.filePath || '',
          content: tab.content,
          language: tab.language,
          filePath: tab.filePath,
        });
      }
    } else {
      if (_extLastPushRef.current !== '') {
        _extLastPushRef.current = '';
        (window as any).api?.extension?.editor?.pushState?.(null);
      }
    }
  }, [_extActiveTabId, _extEditorTabs.length, _extEditorTabs.find(t => t.id === _extActiveTabId)?.isDirty]);

  // Push cursor changes (debounced)
  const _extCursorTimerRef = React.useRef<any>(null);
  useEffect(() => {
    if (_extCursorTimerRef.current) clearTimeout(_extCursorTimerRef.current);
    _extCursorTimerRef.current = setTimeout(() => {
      (window as any).api?.extension?.editor?.pushSelection?.({
        start: { line: _extCursorPos.line, column: _extCursorPos.column },
        end: { line: _extCursorPos.line, column: _extCursorPos.column },
      });
    }, 150);
  }, [_extCursorPos.line, _extCursorPos.column]);

  // ── Sync theme from settings ──────────────────────────────────
  const setTheme = useThemeStore((s) => s.setTheme);
  useEffect(() => {
    // Load settings on mount so theme + all prefs restore on restart
    useSettingsStore.getState().loadSettings().then(() => {
      // Sync appStore view toggles from persisted settings
      const s = useSettingsStore.getState().settings;
      const stickyEnabled = (s['editor.stickyScroll.enabled'] as boolean) !== false;
      useAppStore.getState().setStickyScroll(stickyEnabled);
    });
  }, []);
  useEffect(() => {
    const themeId = (settings['workbench.colorTheme'] as string) || 'hypothesis-dark';
    setTheme(themeId);
  }, [settings['workbench.colorTheme']]);

  // ── Extension theme registration from main process ─────────────
  const registerExtensionTheme = useThemeStore((s) => s.registerExtensionTheme);
  const unregisterExtensionTheme = useThemeStore((s) => s.unregisterExtensionTheme);
  const injectCSS = useThemeStore((s) => s.injectCSS);
  const removeCSS = useThemeStore((s) => s.removeCSS);
  useEffect(() => {
    const api = (window as any).api;
    if (!api?.menu?.onChannel) return;
    const unsubs: Array<() => void> = [];

    // When extension registers a theme → store it, re-apply if active
    unsubs.push(api.menu.onChannel('ext:theme:registered', (themeDef: any) => {
      if (themeDef?.id && themeDef?.colors) {
        registerExtensionTheme(themeDef);
        // Re-apply if this is the current theme (handles race condition)
        // Check settings store, not themeStore, because setTheme may have fallen back
        const savedTheme = useSettingsStore.getState().settings['workbench.colorTheme'];
        if (savedTheme === themeDef.id) {
          useThemeStore.getState().setTheme(themeDef.id);
        }
      }
    }));

    unsubs.push(api.menu.onChannel('ext:theme:unregistered', (data: any) => {
      if (data?.id) unregisterExtensionTheme(data.id);
    }));

    unsubs.push(api.menu.onChannel('ext:theme:injectCSS', (data: any) => {
      if (data?.id && data?.css) injectCSS(data.id, data.css);
    }));

    unsubs.push(api.menu.onChannel('ext:theme:removeCSS', (data: any) => {
      if (data?.id) removeCSS(data.id);
    }));

    unsubs.push(api.menu.onChannel('ext:ui:injectCSS', (data: any) => {
      if (data?.id && data?.css) injectCSS(data.id, data.css);
    }));

    unsubs.push(api.menu.onChannel('ext:ui:removeCSS', (data: any) => {
      if (data?.id) removeCSS(data.id);
    }));

    // NOTE: ext:theme:revert is never sent from main process — removed dead code.
    // Theme revert logic lives in unregisterExtensionTheme() in themeStore.

    // Sync settings from main process (extension settings.set → renderer store)
    unsubs.push(api.menu.onChannel('settings:changed', (settingsData: any) => {
      if (settingsData && typeof settingsData === 'object') {
        const store = useSettingsStore.getState();
        for (const [key, value] of Object.entries(settingsData)) {
          if (store.settings[key] !== value) {
            store.setSetting(key, value);
          }
        }
      }
    }));

    // Restore extension themes on app start (ext:theme:registered may have been missed)
    api.theme.list().then((themes: any[]) => {
      if (Array.isArray(themes)) {
        for (const t of themes) {
          if (!t.isBuiltin && t.id && t.colors) {
            registerExtensionTheme(t);
          }
        }
        // Re-apply current theme now that extension themes are registered
        const currentTheme = useSettingsStore.getState().settings['workbench.colorTheme'] || 'hypothesis-dark';
        setTheme(currentTheme);
      }
    }).catch(() => {});

    return () => unsubs.forEach(u => u());
  }, []);

  // ── Zoom level ──────────────────────────────────────────────────
  useEffect(() => {
    const level = (settings['window.zoomLevel'] as number) || 0;
    (document as any).body.style.zoom = `${100 + level * 10}%`;
  }, [settings['window.zoomLevel']]);

  // ── Accessibility mode ──────────────────────────────────────────
  useEffect(() => {
    const enabled = settings['accessibility.supportAccessibilityMode'];
    document.body.setAttribute('data-accessibility-mode', enabled ? 'true' : 'false');
  }, [settings['accessibility.supportAccessibilityMode']]);

  // ── Auto-save ───────────────────────────────────────────────────
  useEffect(() => {
    const autoSaveMode = (settings['files.autoSave'] as string) || 'off';
    if (autoSaveMode === 'off') return;

    const delay = (settings['files.autoSaveDelay'] as number) || 1000;

    const saveDirtyTabs = () => {
      const { tabs, activeTabId } = useEditorStore.getState();
      const dirtyTabs = tabs.filter(t => t.isDirty && t.filePath);
      for (const tab of dirtyTabs) {
        let content = tab.content;
        // Apply file settings
        if (settings['files.trimTrailingWhitespace']) {
          content = content.split('\n').map(line => line.replace(/\s+$/, '')).join('\n');
        }
        if (settings['files.insertFinalNewline'] && !content.endsWith('\n')) {
          content += '\n';
        }
        window.api.file.save(tab.filePath!, content).then(() => {
          useEditorStore.getState().setTabDirty(tab.id, false);
          useEditorStore.getState().updateTab(tab.id, { savedContent: content, content });
        }).catch(() => {});
      }
    };

    if (autoSaveMode === 'afterDelay') {
      const interval = setInterval(saveDirtyTabs, delay);
      return () => clearInterval(interval);
    }

    if (autoSaveMode === 'onFocusChange') {
      const handler = () => saveDirtyTabs();
      window.addEventListener('blur', handler);
      return () => window.removeEventListener('blur', handler);
    }

    if (autoSaveMode === 'onWindowChange') {
      const handler = () => saveDirtyTabs();
      document.addEventListener('visibilitychange', handler);
      return () => document.removeEventListener('visibilitychange', handler);
    }
  }, [settings['files.autoSave'], settings['files.autoSaveDelay'], settings['files.trimTrailingWhitespace'], settings['files.insertFinalNewline']]);

  // ── Session restore on mount ────────────────────────────────────
  useEffect(() => {
    const saved = session.restoreSession();
    // Await workspace restore so folders are validated before we read them
    workspace.restoreSession().then(() => {
      const folders = useWorkspaceStore.getState().folders;
      if (folders.length > 0) {
        setRootPath(folders[0]);
      } else if (saved.rootPath) {
        setRootPath(saved.rootPath);
      }
      setSessionRestored(true);
    });
  }, []);

  // ── Persist rootPath changes ────────────────────────────────────
  useEffect(() => {
    if (sessionRestored) {
      session.setRootPath(rootPath);
      if (rootPath && !workspace.folders.includes(rootPath)) {
        workspace.addFolder(rootPath);
      }
      // Expose rootPath globally for agent workspace detection
      (window as any).__hypothesis_rootPath = rootPath;
      (window as any).__hypothesis_workspaceFolders = workspace.folders;
    }
  }, [rootPath, sessionRestored]);

  // ── Sync rootPath with workspace folders (auto-clear if removed) ──
  useEffect(() => {
    if (workspace.folders.length === 0) {
      if (rootPath !== null) setRootPath(null);
    } else if (!workspace.folders.includes(rootPath || '')) {
      setRootPath(workspace.folders[0]);
    }
    // Keep global rootPath + all folders in sync for agent
    (window as any).__hypothesis_rootPath = workspace.folders.length > 0 ? workspace.folders[0] : null;
    (window as any).__hypothesis_workspaceFolders = [...workspace.folders];
  }, [workspace.folders.join('|')]);

  // ── Persist rootPath changes ────────────────────────────────────
  useEffect(() => {
    if (sessionRestored) {
      session.setRootPath(rootPath);
      if (rootPath && !workspace.folders.includes(rootPath)) {
        workspace.addFolder(rootPath);
      }
      // Expose rootPath globally for agent workspace detection
      (window as any).__hypothesis_rootPath = rootPath;
    }
  }, [rootPath, sessionRestored]);
  useEffect(() => {
    const api = window.api;
    const on = (ch: string, cb: () => void) => api.menu.onChannel(ch, cb);
    const cleanups = [
      on('menu:command-palette', () => useAppStore.getState().toggleCommandPalette()),
      on('menu:toggle-sidebar', () => useAppStore.getState().toggleSidebar()),
      on('menu:toggle-terminal', () => { useAppStore.getState().togglePanel(); useAppStore.getState().setActivePanel('terminal'); }),
      on('menu:toggle-panel', () => useAppStore.getState().togglePanel()),
      on('menu:toggle-minimap', () => useAppStore.getState().toggleMinimap()),
      on('menu:toggle-word-wrap', () => useAppStore.getState().toggleWordWrap()),
      on('menu:toggle-breadcrumbs', () => useAppStore.getState().toggleBreadcrumbs()),
      on('menu:toggle-line-numbers', () => useAppStore.getState().toggleLineNumbers()),
      on('menu:toggle-sticky-scroll', () => useAppStore.getState().toggleStickyScroll()),
      on('menu:toggle-activity-bar', () => useAppStore.getState().toggleActivityBar()),
      on('menu:toggle-status-bar', () => useAppStore.getState().toggleStatusBar()),
      on('menu:toggle-fullscreen', () => { /* F11 handled via window api */ }),
      on('menu:toggle-zen-mode', () => useAppStore.getState().toggleZenMode()),
      on('menu:toggle-agent', () => openAgentTab()),
      on('menu:open-rest-client', () => openRestClientTab()),
      on('menu:open-database', () => openDatabaseTab()),
      on('menu:open-browser', () => openBrowserTab()),
      on('menu:about', () => setShowAbout(true)),
      // Edit menu actions
      on('menu:undo', () => useEditorStore.getState().triggerUndo()),
      on('menu:redo', () => useEditorStore.getState().triggerRedo()),
      on('menu:cut', () => useEditorStore.getState().triggerCut()),
      on('menu:copy', () => useEditorStore.getState().triggerCopy()),
      on('menu:paste', () => useEditorStore.getState().triggerPaste()),
      on('menu:select-all', () => useEditorStore.getState().triggerSelectAll()),
      on('menu:find', () => useEditorStore.getState().triggerFind()),
      on('menu:replace', () => useEditorStore.getState().triggerReplace()),
      on('menu:format-document', () => useEditorStore.getState().triggerFormat()),
      on('menu:check-update', async () => {
        const { checkForUpdates, openReleaseUrl } = await import('./utils/updateChecker');
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
          const pubDate = info.publishedAt ? new Date(info.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
          const btnIndex = await useDialogStore.getState().showDialog({
            title: 'Update Available',
            message: `A new version of ${APP_NAME} is available!\n\nCurrent: v${info.currentVersion}\nLatest: v${info.latestVersion}${pubDate ? '\nPublished: ' + pubDate : ''}\n\nCompared against GitHub Releases tag (v${info.latestVersion}).\n\nWould you like to download the update?`,
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
      }),
    ];
    return () => cleanups.forEach((fn) => fn?.());
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────────
  const matchShortcut = useKeyboardShortcutStore(s => s.matchShortcut);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // Skip editor shortcuts when focus is inside the agent panel
      const agentPanel = document.querySelector('[data-agent-panel]');
      const isInAgentPanel = agentPanel?.contains(document.activeElement);
      const AGENT_PANEL_ALLOWLIST = new Set([
        'command-palette', 'view-agent', 'view-browser', 'view-rest-client',
        'view-database', 'settings', 'fullscreen', 'documentation',
      ]);
      if (isInAgentPanel) {
        // Also allow Ctrl+P (command palette lowercase)
        if (!(ctrl && !shift && e.key === 'p')) {
          const id = matchShortcut(e);
          if (!id || !AGENT_PANEL_ALLOWLIST.has(id)) return;
        }
      }

      // ── Chord: Ctrl+K sequences ────────────────────────────────
      if (ctrl && !shift && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const onSecond = (e2: KeyboardEvent) => {
          window.removeEventListener('keydown', onSecond, true);
          const k = e2.key.toLowerCase();
          const ctrl2 = e2.ctrlKey || e2.metaKey;
          if (k === 's') {
            e2.preventDefault();
            if (ctrl2) {
              // Ctrl+K Ctrl+S → Open Keyboard Shortcuts page
              setShowShortcuts(true);
            } else {
              // Ctrl+K S → Save All
              const { tabs } = useEditorStore.getState();
              tabs.filter(t => t.isDirty && t.filePath).forEach(t => {
                window.api.file.save(t.filePath!, t.content).then(() => {
                  useEditorStore.getState().setTabDirty(t.id, false);
                  useEditorStore.getState().updateTab(t.id, { savedContent: t.content });
                }).catch(() => {});
              });
            }
          } else if (k === 'z' && ctrl2) {
            // Ctrl+K Ctrl+Z → Zen Mode (chord alternative)
            e2.preventDefault();
            useAppStore.getState().toggleZenMode();
          } else if (k === '0' && ctrl2) {
            // Ctrl+K Ctrl+0 → Fold All
            e2.preventDefault();
            useEditorStore.getState().triggerFoldAll?.();
          } else if (k === 'j' && ctrl2) {
            // Ctrl+K Ctrl+J → Unfold All
            e2.preventDefault();
            useEditorStore.getState().triggerUnfoldAll?.();
          }
        };
        window.addEventListener('keydown', onSecond, true);
        return;
      }

      const actionId = matchShortcut(e);
      if (!actionId) return;

      switch (actionId) {
        case 'command-palette':
          e.preventDefault();
          commandPaletteVisible ? hideCommandPalette() : showCommandPalette();
          break;
        case 'new-file':
          e.preventDefault();
          handleNewFile();
          break;
        case 'open-file':
          e.preventDefault();
          handleOpenFile();
          break;
        case 'save':
          e.preventDefault();
          handleSave();
          break;
        case 'save-as':
          e.preventDefault();
          handleSaveAs();
          break;
        case 'close-tab':
          e.preventDefault();
          if (activeTabId) useEditorStore.getState().closeTab(activeTabId);
          break;
        case 'settings':
          e.preventDefault();
          setShowSettings(v => !v);
          break;
        case 'fullscreen':
          e.preventDefault();
          window.api.window.maximize();
          break;
        case 'documentation':
          e.preventDefault();
          setShowDocs(true);
          break;
        case 'toggle-sidebar':
          e.preventDefault();
          toggleSidebar();
          break;
        case 'toggle-panel':
          e.preventDefault();
          togglePanel();
          setActivePanel('terminal');
          break;
        case 'toggle-terminal':
          e.preventDefault();
          togglePanel();
          setActivePanel('terminal');
          break;
        case 'view-explorer':
          e.preventDefault();
          setActiveSidebarView('explorer');
          break;
        case 'view-search':
          e.preventDefault();
          setActiveSidebarView('search');
          break;
        case 'view-git':
          e.preventDefault();
          setActiveSidebarView('git');
          break;
        case 'view-agent':
          e.preventDefault();
          openAgentTab();
          break;
        case 'view-rest-client':
          e.preventDefault();
          openRestClientTab();
          break;
        case 'view-database':
          e.preventDefault();
          openDatabaseTab();
          break;
        case 'view-browser':
          e.preventDefault();
          openBrowserTab();
          break;
        case 'view-extensions':
          e.preventDefault();
          setActiveSidebarView('extensions');
          break;
        case 'zen-mode':
          e.preventDefault();
          useAppStore.getState().toggleZenMode();
          break;
        case 'undo':
          e.preventDefault();
          useEditorStore.getState().triggerUndo();
          break;
        case 'redo':
          e.preventDefault();
          useEditorStore.getState().triggerRedo();
          break;
        case 'toggle-comment':
          e.preventDefault();
          useEditorStore.getState().triggerComment();
          break;
        case 'toggle-word-wrap':
          e.preventDefault();
          useAppStore.getState().toggleWordWrap();
          break;
        case 'format-document':
          e.preventDefault();
          useEditorStore.getState().triggerFormat();
          break;
        case 'find':
          e.preventDefault();
          useEditorStore.getState().triggerFind();
          break;
        case 'replace':
          e.preventDefault();
          useEditorStore.getState().triggerReplace();
          break;
        case 'quick-open':
          e.preventDefault();
          showCommandPalette();
          break;
        case 'go-to-line':
          e.preventDefault();
          useEditorStore.getState().triggerGoToLine();
          break;
        case 'go-to-symbol':
          e.preventDefault();
          useEditorStore.getState().triggerGoToSymbol();
          break;
        case 'go-to-definition':
          e.preventDefault();
          useEditorStore.getState().triggerGoToDefinition();
          break;
        case 'peek-definition':
          e.preventDefault();
          useEditorStore.getState().triggerPeekDefinition();
          break;
        case 'navigate-back':
          e.preventDefault();
          useEditorStore.getState().triggerGoBack();
          break;
        case 'navigate-forward':
          e.preventDefault();
          useEditorStore.getState().triggerGoForward();
          break;
        case 'run-file': {
          e.preventDefault();
          const tab = useEditorStore.getState().tabs.find(t => t.id === useEditorStore.getState().activeTabId);
          if (tab?.filePath) {
            const ext = tab.fileName.split('.').pop()?.toLowerCase() || '';
            const cmds: Record<string, string> = {
              js: `node "${tab.filePath}"`, ts: `npx ts-node "${tab.filePath}"`,
              py: `python "${tab.filePath}"`, rb: `ruby "${tab.filePath}"`,
              go: `go run "${tab.filePath}"`, rs: 'cargo run',
              sh: `bash "${tab.filePath}"`, php: `php "${tab.filePath}"`,
            };
            const cmd = cmds[ext];
            if (cmd) {
              if (!useAppStore.getState().panelVisible) useAppStore.getState().togglePanel();
              useAppStore.getState().setActivePanel('output');
              setTimeout(() => useAppStore.getState().runCommand(cmd), 100);
            }
          }
          break;
        }
        case 'restart-process': {
          e.preventDefault();
          const tab2 = useEditorStore.getState().tabs.find(t => t.id === useEditorStore.getState().activeTabId);
          if (tab2?.filePath) {
            const ext2 = tab2.fileName.split('.').pop()?.toLowerCase() || '';
            const cmds2: Record<string, string> = {
              js: `node "${tab2.filePath}"`, ts: `npx ts-node "${tab2.filePath}"`,
              py: `python "${tab2.filePath}"`, rb: `ruby "${tab2.filePath}"`,
              go: `go run "${tab2.filePath}"`, rs: 'cargo run',
              sh: `bash "${tab2.filePath}"`, php: `php "${tab2.filePath}"`,
            };
            const cmd2 = cmds2[ext2];
            if (cmd2) {
              if (!useAppStore.getState().panelVisible) useAppStore.getState().togglePanel();
              useAppStore.getState().setActivePanel('output');
              useAppStore.getState().runCommand(cmd2);
            }
          }
          break;
        }
        case 'kill-terminal':
          e.preventDefault();
          (window as any).__terminalPanel?.killTerminal?.() ??
            (() => { const tid = useAppStore.getState().activeTerminalId; if (tid) window.api.terminal.write(tid, '\x03'); })();
          break;
          e.preventDefault();
          (async () => {
            try {
              const api = (window as any).api;
              const runs = await api?.run?.list?.();
              if (Array.isArray(runs) && runs.length > 0) {
                await api?.run?.kill?.(runs[runs.length - 1].runId);
              } else {
                const tid = useAppStore.getState().activeTerminalId;
                if (tid) window.api.terminal.write(tid, '\x03');
              }
            } catch {
              const tid = useAppStore.getState().activeTerminalId;
              if (tid) window.api.terminal.write(tid, '\x03');
            }
          })();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [commandPaletteVisible, showCommandPalette, hideCommandPalette, toggleSidebar, togglePanel, setActivePanel, setActiveSidebarView, activeTabId, matchShortcut]);

  // ── Drag & drop files ───────────────────────────────────────────
  useEffect(() => {
    const onDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    const onDrop = async (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      for (const file of Array.from(e.dataTransfer?.files || [])) {
        try {
          const content = await window.api.file.read((file as any).path);
          const ext = file.name.split('.').pop() || '';
          openTab({
            id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            filePath: (file as any).path, fileName: file.name,
            language: getLang(ext), content, isDirty: false, isPinned: false,
            isPreview: true, viewState: null, scrollTop: 0, scrollLeft: 0,
            cursorPosition: { line: 1, column: 1 }, encoding: 'UTF-8', lineEnding: 'LF',
            savedContent: content, createdAt: Date.now(), modifiedAt: Date.now(),
          });
        } catch (err) { console.error('Drop failed:', err); }
      }
    };
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDrop);
    return () => { document.removeEventListener('dragover', onDragOver); document.removeEventListener('drop', onDrop); };
  }, [openTab]);

  // ── Agent file-changed: reload open tab content from disk ────────
  useEffect(() => {
    const cleanup = (window.api.agent as any).onFileChanged?.(async (data: { filePath: string }) => {
      const { filePath } = data;
      if (!filePath) return;
      const { tabs, updateTab } = useEditorStore.getState();
      const tab = tabs.find(t => t.filePath === filePath);
      if (!tab) return; // file not open in editor, nothing to do
      try {
        const newContent = await window.api.file.read(filePath);
        // Only update if content actually changed to avoid cursor jump
        if (newContent !== tab.content) {
          updateTab(tab.id, {
            content: newContent,
            savedContent: newContent,
            isDirty: false,
            modifiedAt: Date.now(),
          });
        }
      } catch (err) {
        console.warn('[Agent] Failed to reload file after agent edit:', filePath, err);
      }
    });
    return () => cleanup?.();
  }, []);

  // Listen for open-welcome event from TitleBar Help menu
  useEffect(() => {
    const handler = () => setShowWelcome(true);
    window.addEventListener('hypothesis:open-welcome', handler);
    return () => window.removeEventListener('hypothesis:open-welcome', handler);
  }, []);

  // ── Open AI Agent as editor tab ──────────────────────────────────
  const openAgentTab = useCallback(() => {
    if (!agentEnabled) return;
    const agentTabId = 'agent-tab';
    const existing = useEditorStore.getState().tabs.find(t => t.id === agentTabId);
    if (existing) {
      useEditorStore.getState().setActiveTab(agentTabId);
    } else {
      useEditorStore.getState().openTab({
        id: agentTabId,
        filePath: null,
        fileName: 'AI Agent',
        language: 'agent',
        content: '',
        isDirty: false,
        isPinned: true,
        isPreview: false,
        viewState: null,
        scrollTop: 0,
        scrollLeft: 0,
        cursorPosition: { line: 1, column: 1 },
        encoding: 'UTF-8',
        lineEnding: 'LF',
        savedContent: '',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      });
    }
  }, []);

  // Listen for open-agent-tab events from editor context menu
  useEffect(() => {
    const handler = (e: Event) => {
      openAgentTab();
      const detail = (e as CustomEvent).detail;
      if (detail?.code) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('hypothesis:agent-with-code', { detail }));
        }, 200);
      }
    };
    window.addEventListener('hypothesis:open-agent-tab', handler);
    return () => window.removeEventListener('hypothesis:open-agent-tab', handler);
  }, [openAgentTab, agentEnabled]);

  // ── Open Project Insights as editor tab ────────────────────────
  const openInsightsTab = useCallback(() => {
    const insightsTabId = 'insights-tab';
    const existing = useEditorStore.getState().tabs.find(t => t.id === insightsTabId);
    if (existing) {
      useEditorStore.getState().setActiveTab(insightsTabId);
    } else {
      useEditorStore.getState().openTab({
        id: insightsTabId,
        filePath: null,
        fileName: 'Insights',
        language: 'insights',
        content: '',
        isDirty: false,
        isPinned: true,
        isPreview: false,
        viewState: null,
        scrollTop: 0,
        scrollLeft: 0,
        cursorPosition: { line: 1, column: 1 },
        encoding: 'UTF-8',
        lineEnding: 'LF',
        savedContent: '',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      });
    }
  }, []);

  // ── Open REST Client as editor tab ──────────────────────────────
  const openRestClientTab = useCallback(() => {
    const restClientTabId = 'rest-client-tab';
    const existing = useEditorStore.getState().tabs.find(t => t.id === restClientTabId);
    if (existing) {
      useEditorStore.getState().setActiveTab(restClientTabId);
    } else {
      useEditorStore.getState().openTab({
        id: restClientTabId,
        filePath: null,
        fileName: 'REST Client',
        language: 'rest-client',
        content: '',
        isDirty: false,
        isPinned: true,
        isPreview: false,
        viewState: null,
        scrollTop: 0,
        scrollLeft: 0,
        cursorPosition: { line: 1, column: 1 },
        encoding: 'UTF-8',
        lineEnding: 'LF',
        savedContent: '',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      });
    }
  }, []);

  const openDatabaseTab = useCallback(() => {
    const dbTabId = 'database-tab';
    const existing = useEditorStore.getState().tabs.find(t => t.id === dbTabId);
    if (existing) {
      useEditorStore.getState().setActiveTab(dbTabId);
    } else {
      useEditorStore.getState().openTab({
        id: dbTabId,
        filePath: null,
        fileName: 'Database Explorer',
        language: 'database',
        content: '',
        isDirty: false,
        isPinned: true,
        isPreview: false,
        viewState: null,
        scrollTop: 0,
        scrollLeft: 0,
        cursorPosition: { line: 1, column: 1 },
        encoding: 'UTF-8',
        lineEnding: 'LF',
        savedContent: '',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      });
    }
  }, []);

  const openChatTab = useCallback(() => {
    const tabId = 'chat-tab';
    const existing = useEditorStore.getState().tabs.find(t => t.id === tabId);
    if (existing) {
      useEditorStore.getState().setActiveTab(tabId);
    } else {
      useEditorStore.getState().openTab({
        id: tabId,
        filePath: null,
        fileName: 'Chat',
        language: 'chat',
        content: '',
        isDirty: false,
        isPinned: true,
        isPreview: false,
        viewState: null,
        scrollTop: 0,
        scrollLeft: 0,
        cursorPosition: { line: 1, column: 1 },
        encoding: 'UTF-8',
        lineEnding: 'LF',
        savedContent: '',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      });
    }
  }, []);

  const openBrowserTab = useCallback(() => {
    const tabId = 'browser-tab';
    const existing = useEditorStore.getState().tabs.find(t => t.id === tabId);
    if (existing) {
      useEditorStore.getState().setActiveTab(tabId);
    } else {
      useEditorStore.getState().openTab({
        id: tabId,
        filePath: null,
        fileName: 'Web Browser',
        language: 'browser',
        content: '',
        isDirty: false,
        isPinned: true,
        isPreview: false,
        viewState: null,
        scrollTop: 0,
        scrollLeft: 0,
        cursorPosition: { line: 1, column: 1 },
        encoding: 'UTF-8',
        lineEnding: 'LF',
        savedContent: '',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      });
    }
  }, []);

  // Register global hook so tunnel/live-server can open URLs in the internal browser
  useEffect(() => {
    (window as any).__openInternalBrowser = (url: string) => {
      openBrowserTab();
      // Wait one tick for the browser tab to mount before navigating
      setTimeout(() => {
        const { tabs: browserTabs, createTab, navigate, activeTabId } = useBrowserStore.getState();
        if (browserTabs.length === 0) {
          createTab(url);
        } else {
          const targetId = activeTabId ?? browserTabs[browserTabs.length - 1].id;
          navigate(targetId, url);
        }
      }, 80);
    };
    return () => { delete (window as any).__openInternalBrowser; };
  }, [openBrowserTab]);

  // ── Actions ─────────────────────────────────────────────────────
  const handleNewFile = useCallback(() => {
    openTab({
      id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      filePath: null, fileName: `Untitled-${tabs.length + 1}`, language: 'plaintext',
      content: '', isDirty: false, isPinned: false, isPreview: true, viewState: null,
      scrollTop: 0, scrollLeft: 0, cursorPosition: { line: 1, column: 1 },
      encoding: 'UTF-8', lineEnding: 'LF', savedContent: '', createdAt: Date.now(), modifiedAt: Date.now(),
    });
  }, [openTab, tabs.length]);

  const handleOpenFile = useCallback(async () => {
    try {
      const result = await window.api.file.open();
      if (result) {
        for (const { filePath, content } of result) {
          const ext = filePath.split('.').pop() || '';
          openTab({
            id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            filePath, fileName: filePath.split(/[/\\]/).pop() || '',
            language: getLang(ext), content, isDirty: false, isPinned: false,
            isPreview: true, viewState: null, scrollTop: 0, scrollLeft: 0,
            cursorPosition: { line: 1, column: 1 }, encoding: 'UTF-8', lineEnding: 'LF',
            savedContent: content, createdAt: Date.now(), modifiedAt: Date.now(),
          });
        }
        setStatusMessage(`Opened ${result.length} file(s)`, 'success');
      }
    } catch { setStatusMessage('Failed to open file', 'error'); }
  }, [openTab, setStatusMessage]);

  const handleOpenFolder = useCallback(async () => {
    try {
      const result = await window.api.file.dialogOpen({ properties: ['openDirectory', 'multiSelections'] });
      if (!result.canceled && result.filePaths.length > 0) {
        // Multi-root: add all selected folders
        for (const folderPath of result.filePaths) {
          workspace.addFolder(folderPath);
        }
        setRootPath(result.filePaths[0]);
        setActiveSidebarView('explorer');
        setStatusMessage(`Opened ${result.filePaths.length} folder(s)`, 'info');
      }
    } catch { setStatusMessage('Failed to open folder', 'error'); }
  }, [setActiveSidebarView, setStatusMessage, workspace]);

  const handleCloseFolder = useCallback(() => {
    // Clear all workspace folders
    workspace.folders.forEach(f => workspace.removeFolder(f));
    setRootPath(null);
    setActiveSidebarView('explorer');
    setStatusMessage('Workspace cleared', 'info');
  }, [setActiveSidebarView, setStatusMessage, workspace]);

  // ── Apply file settings to content before save ────────────────
  const applyFileSettings = useCallback((content: string): string => {
    const s = useSettingsStore.getState().settings;
    let result = content;
    // Trim trailing whitespace per line
    if (s['files.trimTrailingWhitespace']) {
      result = result.split('\n').map(line => line.replace(/\s+$/, '')).join('\n');
    }
    // Insert final newline
    if (s['files.insertFinalNewline'] && !result.endsWith('\n')) {
      result += '\n';
    }
    return result;
  }, []);

  const handleSaveAs = useCallback(async () => {
    const state = useEditorStore.getState();
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (!tab) return;
    try {
      const newPath = await window.api.file.saveAs(tab.content);
      if (newPath) {
        updateTab(tab.id, { filePath: newPath, fileName: newPath.split(/[/\\]/).pop() || tab.fileName, language: getLang(newPath.split('.').pop() || ''), isDirty: false, savedContent: tab.content });
        setStatusMessage(`Saved: ${newPath.split(/[/\\]/).pop()}`, 'success');
        window.dispatchEvent(new CustomEvent('hypothesis:file-saved', { detail: { filePath: newPath } }));
      }
    } catch (err: any) {
      setStatusMessage('Failed to save: ' + (err?.message || String(err)), 'error');
    }
  }, [updateTab, setStatusMessage]);

  const handleSave = useCallback(async () => {
    const state = useEditorStore.getState();
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (!tab) return;
    if (tab.filePath) {
      try {
        const content = applyFileSettings(state.tabs.find(t => t.id === tab.id)?.content || tab.content);
        await window.api.file.save(tab.filePath, content);
        setTabDirty(tab.id, false);
        updateTab(tab.id, { savedContent: content, content });
        setStatusMessage(`Saved: ${tab.fileName}`, 'success');
        window.dispatchEvent(new CustomEvent('hypothesis:file-saved', { detail: { filePath: tab.filePath } }));
      } catch (err: any) {
        setStatusMessage('Failed to save: ' + (err?.message || String(err)), 'error');
      }
    } else {
      // New file → same as Save As
      const newPath = await window.api.file.saveAs(state.tabs.find(t => t.id === state.activeTabId)?.content || '');
      if (newPath) {
        updateTab(tab.id, { filePath: newPath, fileName: newPath.split(/[/\\]/).pop() || tab.fileName, language: getLang(newPath.split('.').pop() || ''), isDirty: false, savedContent: tab.content });
        setStatusMessage(`Saved: ${newPath.split(/[/\\]/).pop()}`, 'success');
        window.dispatchEvent(new CustomEvent('hypothesis:file-saved', { detail: { filePath: newPath } }));
      }
    }
  }, [setTabDirty, updateTab, setStatusMessage, applyFileSettings]);

  // ── Settings overlay ────────────────────────────────────────────
  if (showSettings) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden select-none" style={{ background: 'var(--theme-bg)' }}>
        <div className="flex items-center" style={{ height: 36, background: 'var(--theme-bg-tertiary)', borderBottom: '1px solid var(--theme-border)' }}>
          {/* Left: Back */}
          <div className="flex items-center pl-4 gap-2">
            <button onClick={() => setShowSettings(false)} className="text-xs flex items-center gap-1" style={{ color: 'var(--theme-fg-muted)' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back to Editor
            </button>
          </div>
          {/* Center: Title */}
          <div className="flex-1 text-center text-xs" style={{ color: 'var(--theme-fg)' }}>Settings — {APP_NAME}</div>
          {/* Right: Window Controls */}
          <WindowControls />
        </div>
        <div className="flex-1 overflow-hidden"><SettingsPanel initialCategory={settingsCategory} /></div>
      </div>
    );
  }

  // ── Docs overlay ──────────────────────────────────────────────
  if (showDocs) {
    return <DocumentationPage onClose={() => setShowDocs(false)} />;
  }

  // ── Shortcuts overlay ─────────────────────────────────────────
  if (showShortcuts) {
    return <KeyboardShortcutsPage onClose={() => setShowShortcuts(false)} />;
  }

  // ── Welcome overlay ───────────────────────────────────────────
  if (showWelcome) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden select-none" style={{ background: 'var(--theme-bg)' }}>
        <div className="flex items-center" style={{ height: 36, background: 'var(--theme-bg-tertiary)', borderBottom: '1px solid var(--theme-border)' }}>
          <div className="flex items-center pl-4 gap-2">
            <button onClick={() => setShowWelcome(false)} className="text-xs flex items-center gap-1" style={{ color: 'var(--theme-fg-muted)' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back to Editor
            </button>
          </div>
          <div className="flex-1 text-center text-xs" style={{ color: 'var(--theme-fg)' }}>Welcome — {APP_NAME}</div>
          <WindowControls />
        </div>
        <div className="flex-1 overflow-hidden">
          <WelcomePage onOpenFolder={(p) => { setShowWelcome(false); setRootPath(p); setActiveSidebarView('explorer'); }} />
        </div>
      </div>
    );
  }

  // ── About overlay ─────────────────────────────────────────────
  if (showAbout) {
    return <AboutDialog onClose={() => setShowAbout(false)} />;
  }

  // ── Snippet Manager overlay ───────────────────────────────────
  if (showSnippets) {
    return <SnippetManagerPanel onClose={() => setShowSnippets(false)} />;
  }

  // ── Main layout ─────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden select-none" style={{ background: 'var(--theme-bg)' }}>
      {!zenMode && <TitleBar
        onNewFile={handleNewFile}
        onOpenFile={handleOpenFile}
        onOpenFolder={handleOpenFolder}
        onCloseFolder={handleCloseFolder}
        hasFolder={!!rootPath}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onOpenSettings={() => setShowSettings(true)}
        onOpenDocs={() => setShowDocs(true)}
        onOpenShortcuts={() => setShowShortcuts(true)}
      />}
      <div className="flex flex-1 overflow-hidden">
        {activityBarVisible && <ActivityBar onOpenSettings={() => setShowSettings(true)} onOpenAgent={agentEnabled ? openAgentTab : undefined} onOpenInsights={openInsightsTab} onOpenRestClient={openRestClientTab} onOpenDatabase={openDatabaseTab} onOpenBrowser={openBrowserTab} onOpenChat={openChatTab} />}
        {sidebarVisible && (
          <Sidebar
            activeView={activeSidebarView}
            rootPath={rootPath}
            activeFilePath={tabs.find(t => t.id === activeTabId)?.filePath || null}
            onOpenFolder={handleOpenFolder}
            onCloseFolder={handleCloseFolder}
          />
        )}
        <div className="flex flex-col flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          <div className="flex-1 overflow-hidden" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <EditorArea
              onOpenFolder={(p) => { setRootPath(p); setActiveSidebarView('explorer'); }}
              onOpenSettings={(category) => { setSettingsCategory(category); setShowSettings(true); }}
            />
          </div>
          {panelVisible && <Panel />}
        </div>
      </div>
      {statusBarVisible && <StatusBar rootPath={rootPath} onOpenSettings={() => setShowSettings(true)} onOpenSnippets={() => setShowSnippets(true)} />}
      {commandPaletteVisible && (
        <CommandPalette
          onClose={hideCommandPalette}
          onNewFile={handleNewFile}
          onOpenFile={handleOpenFile}
          onOpenFolder={handleOpenFolder}
          onCloseFolder={handleCloseFolder}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          onOpenSettings={() => { hideCommandPalette(); setShowSettings(true); }}
          onOpenDocs={() => { hideCommandPalette(); setShowDocs(true); }}
          onOpenShortcuts={() => { hideCommandPalette(); setShowShortcuts(true); }}
          onOpenWelcome={() => { hideCommandPalette(); setShowWelcome(true); }}
          onOpenAbout={() => { hideCommandPalette(); setShowAbout(true); }}
          onOpenAgent={agentEnabled ? () => { hideCommandPalette(); openAgentTab(); } : undefined}
          onOpenInsights={() => { hideCommandPalette(); openInsightsTab(); }}
          onOpenRestClient={() => { hideCommandPalette(); openRestClientTab(); }}
          onOpenDatabase={() => { hideCommandPalette(); openDatabaseTab(); }}
              onOpenBrowser={() => { hideCommandPalette(); openBrowserTab(); }}
          onOpenSnippets={() => { hideCommandPalette(); setShowSnippets(true); }}
        />
      )}

      {/* Global Themed Dialog */}
      <GlobalDialog />
    </div>
  );
};

const PREVIEW_EXTENSIONS = new Set([
  'html', 'htm', 'md', 'mdx', 'markdown', 'svg',
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'ico', 'avif', 'apng',
  'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma',
  'mp4', 'm4v', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'ogv',
  'pdf',
]);

function getLang(ext: string): string {
  const m: Record<string, string> = {
    ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', c: 'c', cpp: 'cpp',
    h: 'c', hpp: 'cpp', cs: 'csharp', swift: 'swift', kt: 'kotlin', php: 'php',
    html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less', json: 'json',
    xml: 'xml', yaml: 'yaml', yml: 'yaml', toml: 'toml', md: 'markdown', sql: 'sql',
    sh: 'shell', bash: 'shell', zsh: 'shell', ps1: 'powershell', bat: 'bat', cmd: 'bat',
    dockerfile: 'dockerfile', txt: 'plaintext',
  };
  return m[ext.toLowerCase()] || 'plaintext';
}

export default App;
