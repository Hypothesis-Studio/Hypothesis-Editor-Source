/**
 * Tunnel IPC Handlers - Registers all tunnel-related IPC channels.
 */
import { ipcMain } from 'electron';
import type { TunnelService } from '../services/tunnel/TunnelService';
import type { TunnelCreateOptions } from '../../shared/types/tunnel';
import { TUNNEL_IPC } from '../../shared/types/tunnel';

export function registerTunnelIPC(tunnelService: TunnelService): void {
  // Open a new tunnel
  ipcMain.handle(TUNNEL_IPC.OPEN, async (_event, options: TunnelCreateOptions) => {
    try {
      const tunnel = await tunnelService.open(options);
      return { success: true, tunnel };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    }
  });

  // Close a specific tunnel
  ipcMain.handle(TUNNEL_IPC.CLOSE, async (_event, id: string) => {
    try {
      await tunnelService.close(id);
      return { success: true };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    }
  });

  // Close all tunnels
  ipcMain.handle(TUNNEL_IPC.CLOSE_ALL, async () => {
    try {
      await tunnelService.closeAll();
      return { success: true };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    }
  });

  // List all tunnels
  ipcMain.handle(TUNNEL_IPC.LIST, () => {
    return { tunnels: tunnelService.list() };
  });

  // Get a single tunnel
  ipcMain.handle(TUNNEL_IPC.GET, (_event, id: string) => {
    const tunnel = tunnelService.get(id);
    return { tunnel };
  });

  // Update tunnel label
  ipcMain.handle(TUNNEL_IPC.UPDATE_LABEL, (_event, id: string, label: string) => {
    const tunnel = tunnelService.updateLabel(id, label);
    return { success: tunnel !== null, tunnel };
  });

  // Copy public URL to clipboard
  ipcMain.handle(TUNNEL_IPC.COPY_URL, (_event, id: string) => {
    const ok = tunnelService.copyUrl(id);
    return { success: ok };
  });

  // Open public URL in system browser
  ipcMain.handle(TUNNEL_IPC.OPEN_BROWSER, (_event, id: string) => {
    const ok = tunnelService.openInBrowser(id);
    return { success: ok };
  });
}
