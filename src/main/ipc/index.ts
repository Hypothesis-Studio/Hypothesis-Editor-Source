/**
 * IPC Registration - Central hub for all IPC handlers.
 */
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import { registerFileIPC } from './file.ipc';
import { registerTerminalIPC } from './terminal.ipc';
import { registerGitIPC } from './git.ipc';
import { registerSettingsIPC } from './settings.ipc';
import { registerThemeIPC } from './theme.ipc';
import { registerWindowIPC } from './window.ipc';
import { registerPluginIPC } from './plugin.ipc';
import { registerUpdateIPC } from './update.ipc';
import { registerExtensionIPC } from './extension.ipc';
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

interface IPCDependencies {
  appStore: AppStore;
  settingsService: SettingsService;
  themeService: ThemeService;
  fileService: FileService;
  gitService: GitService;
  pluginService: PluginService;
  recentService: RecentService;
  agentService: AgentService;
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
}
