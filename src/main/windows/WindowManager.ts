/**
 * Window Manager - Manages application windows
 * Supports multi-window with state persistence.
 */
import { app, BrowserWindow, screen, shell } from 'electron';
import path from 'path';
import { logger } from '../utils/logger';
import type { SettingsService } from '../services/SettingsService';
import type { ThemeService } from '../services/ThemeService';
import type { RecentService } from '../services/RecentService';

interface WindowManagerDependencies {
  settingsService: SettingsService;
  themeService: ThemeService;
  recentService: RecentService;
}

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
  isFullScreen: boolean;
}

export class WindowManager {
  private windows: Map<string, BrowserWindow> = new Map();
  private mainWindowId: string | null = null;
  private settingsService: SettingsService;
  private themeService: ThemeService;
  private recentService: RecentService;

  constructor(deps: WindowManagerDependencies) {
    this.settingsService = deps.settingsService;
    this.themeService = deps.themeService;
    this.recentService = deps.recentService;
  }

  async createMainWindow(openPaths?: string[]): Promise<BrowserWindow> {
    const windowState = this.getSavedWindowState();
    const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

    const defaultState: WindowState = {
      width: Math.min(1400, Math.floor(screenW * 0.85)),
      height: Math.min(900, Math.floor(screenH * 0.85)),
      isMaximized: false,
      isFullScreen: false,
    };

    const state = windowState || defaultState;

    // Ensure window is on-screen (handle multi-monitor disconnect)
    if (state.x !== undefined && state.y !== undefined) {
      const displays = screen.getAllDisplays();
      const onScreen = displays.some(d => {
        const b = d.workArea;
        return state.x! >= b.x - 100 && state.x! < b.x + b.width + 100 &&
               state.y! >= b.y - 100 && state.y! < b.y + b.height + 100;
      });
      if (!onScreen) {
        delete state.x;
        delete state.y;
      }
    }

    const appPath = app.getAppPath();
    const preloadPath = path.join(appPath, 'dist', 'preload', 'index.js');
    const rendererPath = path.join(appPath, 'dist', 'renderer', 'index.html');

    logger.info(`Creating window — preload: ${preloadPath}`);
    logger.info(`Creating window — renderer: ${rendererPath}`);

    const window = new BrowserWindow({
      x: state.x,
      y: state.y,
      width: state.width,
      height: state.height,
      minWidth: 600,
      minHeight: 400,
      frame: false,
      titleBarStyle: 'hidden',
      backgroundColor: '#1e1e1e',
      icon: path.join(app.getAppPath(), 'src', 'renderer', 'assets', 'icons', 'icon.png'),
      show: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        nodeIntegrationInSubFrames: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
        safeDialogs: true,
        navigateOnDragDrop: false,
        autoplayPolicy: 'no-user-gesture-required',
      },
    });

    const windowId = `window-${Date.now()}`;
    this.windows.set(windowId, window);

    if (!this.mainWindowId) {
      this.mainWindowId = windowId;
    }

    // ── Load renderer ─────────────────────────────────────────────
    if (process.env.VITE_DEV_SERVER_URL) {
      logger.info(`Loading dev URL: ${process.env.VITE_DEV_SERVER_URL}`);
      window.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
      logger.info(`Loading file: ${rendererPath}`);
      window.loadFile(rendererPath);
    }

    // ── Show window — with fallback if ready-to-show never fires ──
    let shown = false;
    const showWindow = () => {
      if (shown) return;
      shown = true;
      if (state.isMaximized) window.maximize();
      if (state.isFullScreen) window.setFullScreen(true);
      window.show();
      window.focus();
      logger.info(`Window shown: ${windowId}`);
    };

    window.once('ready-to-show', showWindow);

    // Fallback: show after 5s even if page didn't fully load
    const fallbackTimer = setTimeout(showWindow, 5000);

    // Cancel fallback if page loads normally
    window.webContents.on('did-finish-load', () => {
      clearTimeout(fallbackTimer);
      showWindow();
    });

    // Log load errors
    window.webContents.on('did-fail-load', (_e, errorCode, errorDesc, validatedURL) => {
      logger.error(`Window load failed: ${errorCode} ${errorDesc} — ${validatedURL}`);
      // Show window anyway so user sees something
      showWindow();
    });

    // ── Handle external links ─────────────────────────────────────
    window.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    // ── Security: prevent navigation ──────────────────────────────
    window.webContents.on('will-navigate', (event, url) => {
      const allowedOrigins = [
        process.env.VITE_DEV_SERVER_URL,
        `file:///${rendererPath.replace(/\\/g, '/')}`,
      ].filter(Boolean);

      if (!allowedOrigins.some((origin) => url.startsWith(origin!))) {
        event.preventDefault();
        logger.warn(`Blocked navigation to: ${url}`);
      }
    });

    // ── Save state on close ───────────────────────────────────────
    window.on('close', () => {
      this.saveWindowState(windowId, window);
    });

    window.on('closed', () => {
      this.windows.delete(windowId);
      if (this.mainWindowId === windowId) {
        this.mainWindowId = null;
        if (this.windows.size > 0) {
          this.mainWindowId = this.windows.keys().next().value ?? null;
        }
      }
    });

    logger.info(`Window created: ${windowId}`);
    return window;
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindowId ? this.windows.get(this.mainWindowId) ?? null : null;
  }

  getWindow(id: string): BrowserWindow | null {
    return this.windows.get(id) ?? null;
  }

  getAllWindows(): BrowserWindow[] {
    return Array.from(this.windows.values());
  }

  closeAll(): void {
    for (const window of this.windows.values()) {
      window.close();
    }
  }

  private getSavedWindowState(): WindowState | null {
    try {
      const state = this.settingsService.get('windowState');
      if (state && typeof state === 'object' && 'width' in state && 'height' in state) {
        return state as WindowState;
      }
      return null;
    } catch {
      return null;
    }
  }

  private saveWindowState(windowId: string, window: BrowserWindow): void {
    try {
      if (!window.isDestroyed()) {
        const bounds = window.getBounds();
        const state: WindowState = {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          isMaximized: window.isMaximized(),
          isFullScreen: window.isFullScreen(),
        };
        this.settingsService.set('windowState', state);
      }
    } catch (error) {
      logger.error(`Failed to save window state for ${windowId}`, error);
    }
  }
}
