/**
 * Plugin IPC Handlers
 */
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import type { PluginService } from '../services/PluginService';

export function registerPluginIPC(pluginService: PluginService): void {
  ipcMain.handle(IPC_CHANNELS.PLUGIN_LIST, async () => {
    return pluginService.getPlugins();
  });

  ipcMain.handle(IPC_CHANNELS.PLUGIN_INSTALL, async (_event, pluginPath: string) => {
    const plugin = await pluginService.install(pluginPath);
    return { manifest: plugin.manifest, path: plugin.path, enabled: plugin.enabled, loaded: plugin.loaded };
  });

  ipcMain.handle(IPC_CHANNELS.PLUGIN_UNINSTALL, async (_event, pluginId: string) => {
    return pluginService.uninstall(pluginId);
  });

  ipcMain.handle(
    IPC_CHANNELS.PLUGIN_ENABLE,
    async (_event, pluginId: string) => {
      return pluginService.enable(pluginId);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.PLUGIN_DISABLE,
    async (_event, pluginId: string) => {
      return pluginService.disable(pluginId);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.PLUGIN_ACTIVATE,
    async (_event, pluginId: string) => {
      return pluginService.activate(pluginId);
    },
  );

  ipcMain.handle('plugin:installHyp', async (_event, hypPath: string) => {
    const plugin = await pluginService.installHyp(hypPath);
    // Return serializable subset (not the full InstalledPlugin with functions)
    return { manifest: plugin.manifest, path: plugin.path, enabled: plugin.enabled, loaded: plugin.loaded };
  });

  ipcMain.handle('plugin:pack', async (_event, folderPath: string, outputPath?: string) => {
    return pluginService.packExtension(folderPath, outputPath);
  });

  ipcMain.handle('plugin:getExtensionCommands', async () => {
    return pluginService.getExtensionCommands();
  });

  ipcMain.handle('plugin:executeCommand', async (_event, commandId: string, args?: unknown) => {
    return pluginService.executeCommand(commandId, args);
  });
}
