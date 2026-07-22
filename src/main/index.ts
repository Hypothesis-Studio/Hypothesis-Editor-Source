/**
 * Hypothesis Editor - Main Process Entry Point
 * Electron main process bootstrap with Clean Architecture.
 */
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { APP_NAME } from '../shared/utils/appMeta';
import { WindowManager } from './windows/WindowManager';
import { registerIPC } from './ipc';
import { killAllTerminals } from './ipc/terminal.ipc';
import { logger } from './utils/logger';
import { AppStore } from './services/AppStore';
import { ThemeService } from './services/ThemeService';
import { FileService } from './services/FileService';
import { GitService } from './services/GitService';
import { PluginService } from './services/PluginService';
import { SettingsService } from './services/SettingsService';
import { RecentService } from './services/RecentService';
import { createApplicationMenu } from './menu';

// ── Security hardening ────────────────────────────────────────────
// Note: app.enableSandbox() removed because it prevents require() in renderer preload,
// which is needed for proper plugin loading. Electron's default sandbox is sufficient.

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event, webPreferences) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
  });

  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://') && !url.startsWith('http://localhost')) {
      event.preventDefault();
    }
  });
});

// ── Single instance lock ──────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  let windowManager: WindowManager;
  let appStore: AppStore;

  app.whenReady().then(async () => {
    logger.info(`${APP_NAME} starting...`, {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      electron: process.versions.electron,
      node: process.versions.node,
    });

    // Initialize core services
    appStore = new AppStore();
    const settingsService = new SettingsService(appStore);
    const themeService = new ThemeService(appStore);
    const fileService = new FileService();
    const gitService = new GitService();
    const pluginService = new PluginService(appStore);
    const recentService = new RecentService(appStore);

    await settingsService.initialize();
    await themeService.initialize();
    await pluginService.initialize();

    // Auto-updater (wrapped — fails silently for dev/portable builds)
    try {
      const { autoUpdater } = await import('electron-updater');
      autoUpdater.logger = require('electron-log');
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;

      autoUpdater.on('update-available', (info) => {
        logger.info('Update available', info);
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send('update:available', info);
        });
      });

      autoUpdater.on('update-downloaded', (info) => {
        logger.info('Update downloaded', info);
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send('update:downloaded', info);
        });
      });

      autoUpdater.on('error', () => {
        // Silent — expected for dev/portable builds
      });

      setTimeout(() => {
        autoUpdater.checkForUpdates().catch(() => {});
      }, 30000);
    } catch {
      logger.warn('Auto-updater not available (dev/portable build)');
    }

    // Register IPC handlers
    registerIPC({
      appStore,
      settingsService,
      themeService,
      fileService,
      gitService,
      pluginService,
      recentService,
    });

    // Create application menu
    createApplicationMenu();

    // Create main window
    windowManager = new WindowManager({
      settingsService,
      themeService,
      recentService,
    });

    await windowManager.createMainWindow();
    logger.info(`${APP_NAME} started successfully`);
  });

  app.on('second-instance', () => {
    if (windowManager) {
      const mainWindow = windowManager.getMainWindow();
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (windowManager) {
      windowManager.createMainWindow();
    }
  });

  app.on('before-quit', async () => {
    logger.info(`${APP_NAME} shutting down...`);
    killAllTerminals();
    if (appStore) {
      await appStore.save();
    }
  });

  // Graceful error handling
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', reason);
  });
}
