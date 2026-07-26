/**
 * IPC Registration - Central hub for all IPC handlers.
 */
import { registerFileIPC } from './file.ipc';
import { registerTerminalIPC } from './terminal.ipc';
import { registerGitIPC } from './git.ipc';
import { registerSettingsIPC } from './settings.ipc';
import { registerThemeIPC } from './theme.ipc';
import { registerWindowIPC } from './window.ipc';
import { registerPluginIPC } from './plugin.ipc';
import { registerUpdateIPC } from './update.ipc';
import { registerExtensionIPC } from './extension.ipc';
import { registerRunIPC } from './run.ipc';
import './format.ipc';
import type { AppStore } from '../services/AppStore';
import type { SettingsService } from '../services/SettingsService';
import type { ThemeService } from '../services/ThemeService';
import type { FileService } from '../services/FileService';
import type { GitService } from '../services/GitService';
import type { PluginService } from '../services/PluginService';
import type { RecentService } from '../services/RecentService';
import type { AgentService } from '../services/agent/AgentService';
import { registerAgentIPC } from './agent.ipc';
import { registerSearchIPC } from './search.ipc';
import { registerInsightsIPC } from './insights.ipc';
import type { ProjectInsightsService } from '../services/insights/ProjectInsightsService';
import { registerPreviewIPC } from './preview.ipc';
import type { PreviewService } from '../services/preview/PreviewService';
import { registerRestClientIPC } from './rest-client.ipc';
import type { RestClientService } from '../services/rest-client/RestClientService';
import { registerDatabaseIPC } from './database.ipc';
import { DatabaseService } from '../services/database/DatabaseService';
export { DatabaseService };
import { registerBrowserIPC } from './browser.ipc';
import { BrowserService } from '../services/browser/BrowserService';
export { BrowserService };
import { registerTunnelIPC } from './tunnel.ipc';
import { TunnelService } from '../services/tunnel/TunnelService';
export { TunnelService };
import { registerLiveServerIPC } from './live-server.ipc';
import { LiveServerService } from '../services/live-server/LiveServerService';
export { LiveServerService };

interface IPCDependencies {
  appStore: AppStore;
  settingsService: SettingsService;
  themeService: ThemeService;
  fileService: FileService;
  gitService: GitService;
  pluginService: PluginService;
  recentService: RecentService;
  agentService: AgentService;
  insightsService: ProjectInsightsService;
  previewService: PreviewService;
  restClientService: RestClientService;
  databaseService: DatabaseService;
  browserService: BrowserService;
  tunnelService: TunnelService;
  liveServerService: LiveServerService;
}

export function registerIPC(deps: IPCDependencies): void {
  registerFileIPC(deps.fileService, deps.recentService);
  registerTerminalIPC();
  registerGitIPC(deps.gitService);
  registerSettingsIPC(deps.settingsService);
  registerThemeIPC(deps.themeService);
  registerWindowIPC();
  registerPluginIPC(deps.pluginService);
  registerUpdateIPC();
  registerExtensionIPC(
    deps.appStore,
    deps.pluginService,
    deps.settingsService,
    deps.themeService,
    deps.fileService,
    deps.gitService,
  );
  registerAgentIPC(deps.agentService);
  registerRunIPC();
  registerSearchIPC();
  registerInsightsIPC(deps.insightsService);
  registerPreviewIPC(deps.previewService);
  registerRestClientIPC(deps.restClientService);
  registerDatabaseIPC(deps.databaseService, () => require('electron').BrowserWindow.getAllWindows()[0] ?? null);
  registerBrowserIPC(deps.browserService, () => require('electron').BrowserWindow.getAllWindows()[0] ?? null);
  registerTunnelIPC(deps.tunnelService);
  registerLiveServerIPC(deps.liveServerService);
}

/** Kill all run processes on app quit */
export { killAllRunProcesses } from './run.ipc';
