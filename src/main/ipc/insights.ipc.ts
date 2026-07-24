/**
 * Project Insights IPC Handlers
 * Bridges renderer requests to ProjectInsightsService.
 */
import { ipcMain, BrowserWindow } from 'electron';
import { ProjectInsightsService } from '../services/insights/ProjectInsightsService';
import { INSIGHTS_CHANNELS } from '../../shared/types/insights';
import type { ScanProgress } from '../../shared/types/insights';

export function registerInsightsIPC(insightsService: ProjectInsightsService): void {
  /**
   * Full project scan with progress events.
   */
  ipcMain.handle(INSIGHTS_CHANNELS.SCAN_PROJECT, async (event, projectPath: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: 'No window' };

    try {
      const result = await insightsService.scanProject(projectPath, (progress: ScanProgress) => {
        if (!win.isDestroyed()) {
          win.webContents.send(INSIGHTS_CHANNELS.SCAN_PROGRESS, progress);
        }
      });
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  /**
   * Get cached insights without re-scanning.
   */
  ipcMain.handle(INSIGHTS_CHANNELS.GET_CACHED, async (_event, projectPath: string) => {
    try {
      const cached = insightsService.getCached(projectPath);
      return { success: true, data: cached };
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  /**
   * Clear cached insights.
   */
  ipcMain.handle(INSIGHTS_CHANNELS.CLEAR_CACHE, async (_event, projectPath?: string) => {
    insightsService.clearCache(projectPath);
    return { success: true };
  });

  /**
   * Run npm audit only.
   */
  ipcMain.handle(INSIGHTS_CHANNELS.RUN_AUDIT, async (_event, projectPath: string) => {
    try {
      // Re-use the service's security audit method via a quick scan
      const cached = insightsService.getCached(projectPath);
      if (cached) {
        return { success: true, data: cached.security };
      }
      // If no cache, do a full scan (security is part of it)
      const result = await insightsService.scanProject(projectPath);
      return { success: true, data: result.security };
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  /**
   * Check for outdated dependencies only.
   */
  ipcMain.handle(INSIGHTS_CHANNELS.CHECK_OUTDATED, async (_event, projectPath: string) => {
    try {
      const cached = insightsService.getCached(projectPath);
      if (cached) {
        return { success: true, data: cached.dependencies };
      }
      const result = await insightsService.scanProject(projectPath);
      return { success: true, data: result.dependencies };
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  /**
   * Find duplicate files only.
   */
  ipcMain.handle(INSIGHTS_CHANNELS.FIND_DUPLICATES, async (_event, projectPath: string) => {
    try {
      const cached = insightsService.getCached(projectPath);
      if (cached) {
        return { success: true, data: cached.duplicates };
      }
      const result = await insightsService.scanProject(projectPath);
      return { success: true, data: result.duplicates };
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  });
}
