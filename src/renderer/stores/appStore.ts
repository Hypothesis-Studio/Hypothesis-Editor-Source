/**
 * App Store - Global application state using Zustand.
 */
import { create } from 'zustand';

interface AppState {
  // Sidebar
  sidebarVisible: boolean;
  activeSidebarView: string;
  sidebarWidth: number;
  toggleSidebar: () => void;
  setActiveSidebarView: (view: string) => void;
  setSidebarWidth: (width: number) => void;

  // Panel
  panelVisible: boolean;
  activePanel: string;
  panelHeight: number;
  togglePanel: () => void;
  setActivePanel: (panel: string) => void;
  setPanelHeight: (height: number) => void;
  runCommand: (command: string) => void;
  activeTerminalId: string | null;
  setActiveTerminalId: (id: string | null) => void;

  // Command Palette
  commandPaletteVisible: boolean;
  toggleCommandPalette: () => void;
  showCommandPalette: () => void;
  hideCommandPalette: () => void;

  // View toggles
  activityBarVisible: boolean;
  statusBarVisible: boolean;
  breadcrumbsVisible: boolean;
  zenMode: boolean;
  wordWrap: 'off' | 'on' | 'wordWrapColumn' | 'bounded';
  minimapVisible: boolean;
  lineNumbers: 'on' | 'off' | 'relative' | 'interval';
  stickyScroll: boolean;
  toggleActivityBar: () => void;
  toggleStatusBar: () => void;
  toggleBreadcrumbs: () => void;
  toggleZenMode: () => void;
  toggleWordWrap: () => void;
  toggleMinimap: () => void;
  toggleLineNumbers: () => void;
  toggleStickyScroll: () => void;

  // Theme
  currentTheme: string;
  setTheme: (theme: string) => void;

  // Window
  isMaximized: boolean;
  setMaximized: (maximized: boolean) => void;

  // Loading
  isLoading: boolean;
  setLoading: (loading: boolean) => void;

  // Status messages
  statusMessage: string | null;
  statusType: 'info' | 'warning' | 'error' | 'success';
  setStatusMessage: (message: string | null, type?: 'info' | 'warning' | 'error' | 'success') => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Sidebar
  sidebarVisible: true,
  activeSidebarView: 'explorer',
  sidebarWidth: 260,
  toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),
  setActiveSidebarView: (view) =>
    set((state) => ({
      activeSidebarView: view,
      sidebarVisible: state.activeSidebarView === view ? !state.sidebarVisible : true,
    })),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),

  // Panel
  panelVisible: false,
  activePanel: 'terminal',
  panelHeight: 250,
  activeTerminalId: null as string | null,
  togglePanel: () => set((state) => ({ panelVisible: !state.panelVisible })),
  setActivePanel: (panel) => set((state) => ({
    activePanel: panel,
    panelVisible: true,
  })),
  setPanelHeight: (height) => set({ panelHeight: height }),
  setActiveTerminalId: (id) => set({ activeTerminalId: id }),
  runCommand: (command) => {
    // Get workspace root for cwd
    const rootPath = (window as any).__hypothesis_rootPath || undefined;
    // Execute via run:execute API for structured output capture
    const api = (window as any).api;
    if (api?.run?.execute) {
      api.run.execute({ command, cwd: rootPath }).then((result: any) => {
        if (!result?.success) {
          console.error('Failed to run command:', result?.error);
          fallbackToTerminal(command);
        }
      }).catch(() => {
        fallbackToTerminal(command);
      });
    } else {
      fallbackToTerminal(command);
    }

    function fallbackToTerminal(cmd: string) {
      const tryWrite = (attempts: number) => {
        const terminalId = get().activeTerminalId;
        if (terminalId) {
          window.api.terminal.write(terminalId, '\x03');
          setTimeout(() => { window.api.terminal.write(terminalId, cmd + '\n'); }, 150);
        } else if (attempts < 20) {
          setTimeout(() => tryWrite(attempts + 1), 200);
        }
      };
      tryWrite(0);
    }
  },

  // Command Palette
  commandPaletteVisible: false,
  toggleCommandPalette: () =>
    set((state) => ({ commandPaletteVisible: !state.commandPaletteVisible })),
  showCommandPalette: () => set({ commandPaletteVisible: true }),
  hideCommandPalette: () => set({ commandPaletteVisible: false }),

  // View toggles
  activityBarVisible: true,
  statusBarVisible: true,
  breadcrumbsVisible: true,
  zenMode: false,
  wordWrap: 'off',
  minimapVisible: true,
  lineNumbers: 'on',
  stickyScroll: true,
  toggleActivityBar: () => set((s) => ({ activityBarVisible: !s.activityBarVisible })),
  toggleStatusBar: () => set((s) => ({ statusBarVisible: !s.statusBarVisible })),
  toggleBreadcrumbs: () => set((s) => ({ breadcrumbsVisible: !s.breadcrumbsVisible })),
  toggleZenMode: () => {
    const s = get();
    const entering = !s.zenMode;
    set({
      zenMode: entering,
      ...(entering ? { sidebarVisible: false, panelVisible: false } : {}),
    });
  },
  toggleWordWrap: () =>
    set((s) => ({ wordWrap: s.wordWrap === 'off' ? 'on' : 'off' })),
  toggleMinimap: () => set((s) => ({ minimapVisible: !s.minimapVisible })),
  toggleLineNumbers: () =>
    set((s) => ({
      lineNumbers: s.lineNumbers === 'on' ? 'off' : 'on',
    })),
  toggleStickyScroll: () => set((s) => ({ stickyScroll: !s.stickyScroll })),

  // Theme
  currentTheme: 'hypothesis-dark',
  setTheme: (theme) => set({ currentTheme: theme }),

  // Window
  isMaximized: false,
  setMaximized: (maximized) => set({ isMaximized: maximized }),

  // Loading
  isLoading: true,
  setLoading: (loading) => set({ isLoading: loading }),

  // Status messages
  statusMessage: null,
  statusType: 'info',
  setStatusMessage: (message, type = 'info') => set({ statusMessage: message, statusType: type }),
}));
