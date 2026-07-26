/**
 * Hypothesis Editor - Main Process Entry Point
 * Electron main process bootstrap with Clean Architecture.
 */
import { app, BrowserWindow } from 'electron';
import { APP_NAME } from '../shared/utils/appMeta';
import { WindowManager } from './windows/WindowManager';
import { registerIPC } from './ipc';
import { killAllTerminals } from './ipc/terminal.ipc';
import { killAllRunProcesses } from './ipc/run.ipc';
import { logger } from './utils/logger';
import { AppStore } from './services/AppStore';
import { ThemeService } from './services/ThemeService';
import { FileService } from './services/FileService';
import { GitService } from './services/GitService';
import { PluginService } from './services/PluginService';
import { SettingsService } from './services/SettingsService';
import { RecentService } from './services/RecentService';
import { AgentService } from './services/agent/AgentService';
import { ProviderRegistry } from './services/agent/ProviderRegistry';
import { ToolRegistry } from './services/agent/ToolRegistry';
import { MemoryService } from './services/agent/MemoryService';
import { TaskService } from './services/agent/TaskService';
import { SessionPersistence } from './services/agent/SessionPersistence';
import { AgentLogService } from './services/agent/AgentLogService';
import { RateLimiter } from './services/agent/RateLimiter';
import { ProjectInsightsService } from './services/insights/ProjectInsightsService';
import { PreviewService } from './services/preview/PreviewService';
import { RestClientService } from './services/rest-client/RestClientService';
import { DatabaseService } from './services/database/DatabaseService';
import { BrowserService } from './services/browser/BrowserService';
import { TunnelService } from './services/tunnel/TunnelService';
import { createApplicationMenu } from './menu';

// ── Security hardening ────────────────────────────────────────────
// Note: app.enableSandbox() removed because it prevents require() in renderer preload,
// which is needed for proper plugin loading. Electron's default sandbox is sufficient.

app.on('web-contents-created', (_event, contents) => {
  // Block devtools shortcuts in production builds
  if (app.isPackaged) {
    contents.on('before-input-event', (_evt, input) => {
      const isDevToolsShortcut =
        (input.control && input.shift && input.key.toLowerCase() === 'i') || // Ctrl+Shift+I
        (input.control && input.shift && input.key.toLowerCase() === 'j') || // Ctrl+Shift+J
        input.key === 'F12';                                                  // F12
      if (isDevToolsShortcut) {
        _evt.preventDefault();
        contents.closeDevTools();
      }
    });
  }

  contents.on('will-attach-webview', (event, webPreferences) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
  });

  contents.on('will-navigate', (event, url) => {
    // Only block navigation on the main renderer window, not webview contents
    // Check if this is the main window renderer (file:// or localhost dev server)
    const currentUrl = contents.getURL();
    const isMainRenderer = currentUrl.startsWith('file://') || currentUrl.startsWith('http://localhost');
    if (isMainRenderer && !url.startsWith('file://') && !url.startsWith('http://localhost')) {
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
  let databaseService: DatabaseService | undefined;
  let browserService: BrowserService | undefined;
  let tunnelService: TunnelService | undefined;

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

    // Inject service dependencies into PluginService for extension context
    pluginService.setDependencies({ gitService, themeService });

    await pluginService.initialize();

    // Initialize Agent system
    const providerRegistry = new ProviderRegistry(appStore);
    const toolRegistry = new ToolRegistry(fileService, gitService);
    const memoryService = new MemoryService(appStore);
    const taskService = new TaskService(appStore);
    const sessionPersistence = new SessionPersistence(appStore);
    const agentLogService = new AgentLogService();
    const rateLimiter = new RateLimiter();

    toolRegistry.initialize();
    memoryService.initialize();
    taskService.initialize();
    sessionPersistence.initialize();
    await providerRegistry.initialize();

    const agentService = new AgentService(
      appStore, providerRegistry, toolRegistry,
      memoryService, taskService, sessionPersistence,
      agentLogService, rateLimiter,
    );
    await agentService.initialize();

    // Initialize Project Insights service
    const insightsService = new ProjectInsightsService();

    // Initialize Preview service
    const previewService = new PreviewService();

    // Initialize REST Client service
    const restClientService = new RestClientService(appStore);

    // Initialize Database Explorer service
    databaseService = new DatabaseService(app.getPath('userData'));

    // Initialize Browser service
    browserService = new BrowserService(() => BrowserWindow.getAllWindows()[0] ?? null);

    // Initialize Tunnel service
    tunnelService = new TunnelService();

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
      agentService,
      insightsService,
      previewService,
      restClientService,
      databaseService: databaseService!,
      browserService: browserService!,
      tunnelService: tunnelService!,
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
    killAllRunProcesses();
    await databaseService?.dispose();
    browserService?.dispose();
    tunnelService?.dispose();
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
