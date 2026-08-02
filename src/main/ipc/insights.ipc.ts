/**
 * Project Insights IPC Handlers
 * Bridges renderer requests to ProjectInsightsService.
 * Supports single-path and multi-root (array of paths) scanning.
 */
import { ipcMain, BrowserWindow } from 'electron';
import { ProjectInsightsService } from '../services/insights/ProjectInsightsService';
import { INSIGHTS_CHANNELS } from '../../shared/types/insights';
import type { ScanProgress, ProjectInsights } from '../../shared/types/insights';

export function registerInsightsIPC(insightsService: ProjectInsightsService): void {

  /**
   * Full project scan — accepts a single path string or an array of paths.
   * Multi-root: each folder is scanned sequentially then results are merged.
   */
  ipcMain.handle(INSIGHTS_CHANNELS.SCAN_PROJECT, async (event, projectPath: string | string[]) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: 'No window' };

    const send = (progress: ScanProgress) => {
      if (!win.isDestroyed()) win.webContents.send(INSIGHTS_CHANNELS.SCAN_PROGRESS, progress);
    };

    try {
      const paths = Array.isArray(projectPath) ? projectPath : [projectPath];

      if (paths.length === 1) {
        // Single-root: straightforward scan
        const result = await insightsService.scanProject(paths[0], send);
        return { success: true, data: result };
      }

      // Multi-root: scan each folder with proportional progress, then merge
      const results: ProjectInsights[] = [];
      for (let i = 0; i < paths.length; i++) {
        const folderPath = paths[i];
        const folderName = folderPath.split(/[\\/]/).pop() || folderPath;
        const baseProgress = Math.round((i / paths.length) * 90);
        const folderShare = Math.round(90 / paths.length);

        const folderProgress = (p: ScanProgress) => {
          send({
            ...p,
            progress: baseProgress + Math.round((p.progress / 100) * folderShare),
            message: `[${i + 1}/${paths.length}] ${folderName}: ${p.message}`,
            currentFolder: folderPath,
            folderIndex: i,
            totalFolders: paths.length,
          });
        };

        const r = await insightsService.scanProject(folderPath, folderProgress);
        results.push(r);
      }

      send({ phase: 'merging', progress: 92, message: `Merging results from ${paths.length} folders...` });
      const merged = insightsService.mergeResults(results);
      send({ phase: 'complete', progress: 100, message: 'Scan complete' });

      return { success: true, data: merged };
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  /**
   * Get cached insights. For multi-root, uses the combined cache key.
   */
  ipcMain.handle(INSIGHTS_CHANNELS.GET_CACHED, async (_event, projectPath: string | string[]) => {
    try {
      const paths = Array.isArray(projectPath) ? projectPath : [projectPath];
      if (paths.length === 1) {
        const cached = insightsService.getCached(paths[0]);
        return { success: true, data: cached };
      }
      const cached = insightsService.getCachedMulti(paths);
      return { success: true, data: cached };
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  /**
   * Clear cached insights for a path, array of paths, or all.
   */
  ipcMain.handle(INSIGHTS_CHANNELS.CLEAR_CACHE, async (_event, projectPath?: string | string[]) => {
    if (!projectPath) {
      insightsService.clearCache();
    } else if (Array.isArray(projectPath)) {
      projectPath.forEach(p => insightsService.clearCache(p));
      insightsService.clearCacheMulti(projectPath);
    } else {
      insightsService.clearCache(projectPath);
    }
    return { success: true };
  });

  /**
   * Run npm audit only — returns security data.
   */
  ipcMain.handle(INSIGHTS_CHANNELS.RUN_AUDIT, async (_event, projectPath: string | string[]) => {
    try {
      const paths = Array.isArray(projectPath) ? projectPath : [projectPath];
      const primary = paths[0];
      const cached = insightsService.getCached(primary);
      if (cached) return { success: true, data: cached.security };
      const result = await insightsService.scanProject(primary);
      return { success: true, data: result.security };
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  /**
   * Check outdated dependencies — returns dependency data.
   */
  ipcMain.handle(INSIGHTS_CHANNELS.CHECK_OUTDATED, async (_event, projectPath: string | string[]) => {
    try {
      const paths = Array.isArray(projectPath) ? projectPath : [projectPath];
      const primary = paths[0];
      const cached = insightsService.getCached(primary);
      if (cached) return { success: true, data: cached.dependencies };
      const result = await insightsService.scanProject(primary);
      return { success: true, data: result.dependencies };
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  /**
   * Find duplicates — returns duplicate analysis data.
   */
  ipcMain.handle(INSIGHTS_CHANNELS.FIND_DUPLICATES, async (_event, projectPath: string | string[]) => {
    try {
      const paths = Array.isArray(projectPath) ? projectPath : [projectPath];
      const primary = paths[0];
      const cached = insightsService.getCached(primary);
      if (cached) return { success: true, data: cached.duplicates };
      const result = await insightsService.scanProject(primary);
      return { success: true, data: result.duplicates };
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  });
}
