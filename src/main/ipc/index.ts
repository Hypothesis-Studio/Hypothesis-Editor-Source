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
}

/** Kill all run processes on app quit */
export { killAllRunProcesses } from './run.ipc';
