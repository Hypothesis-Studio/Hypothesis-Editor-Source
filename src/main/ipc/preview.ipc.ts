/**
 * Preview IPC Handlers
 */
import { ipcMain, BrowserWindow } from 'electron';
import { PreviewService } from '../services/preview/PreviewService';
import { PREVIEW_CHANNELS } from '../../shared/types/preview';

export function registerPreviewIPC(previewService: PreviewService): void {
  /**
   * Load preview data for a file.
   */
  ipcMain.handle(PREVIEW_CHANNELS.LOAD_PREVIEW, async (_event, filePath: string) => {
    try {
      const data = await previewService.loadPreview(filePath);
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  /**
   * Render Markdown string to HTML.
   */
  ipcMain.handle(PREVIEW_CHANNELS.RENDER_MARKDOWN, async (_event, markdown: string) => {
    try {
      const html = await previewService.renderMarkdown(markdown);
      return { success: true, data: html };
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  /**
   * Get preview category for a file extension.
   */
  ipcMain.handle(PREVIEW_CHANNELS.GET_FILE_TYPE, async (_event, ext: string) => {
    try {
      const category = previewService.getFileCategory(ext);
      const isPreviewable = previewService.isPreviewable(ext);
      return { success: true, data: { category, isPreviewable } };
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  /**
   * Start watching a file for changes.
   */
  ipcMain.handle(PREVIEW_CHANNELS.WATCH_FILE, async (event, filePath: string) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) {
        previewService.startWatching(filePath, event.sender);
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  /**
   * Stop watching a file.
   */
  ipcMain.handle(PREVIEW_CHANNELS.UNWATCH_FILE, async (_event, filePath: string) => {
    try {
      previewService.stopWatching(filePath);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  });
}
