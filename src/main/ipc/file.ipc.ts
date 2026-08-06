/**
 * File IPC Handlers
 */
import { ipcMain, dialog, BrowserWindow, shell } from 'electron';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import { IPC_CHANNELS } from '../../shared/types';
import type { FileService } from '../services/FileService';
import type { RecentService } from '../services/RecentService';

export function registerFileIPC(fileService: FileService, recentService: RecentService): void {
  // File watcher
  ipcMain.on('file-watcher:start', (event, dirPath: string) => {
    fileService.startWatching(dirPath, event.sender);
  });

  ipcMain.on('file-watcher:stop', (_event, dirPath: string) => {
    fileService.stopWatching(dirPath);
  });

  // Open folder in system file manager (Explorer / Finder / Nautilus)
  ipcMain.handle('file:revealInFileManager', async (_event, dirPath: string) => {
    shell.showItemInFolder(dirPath);
    return true;
  });

  // Open folder in system terminal
  ipcMain.handle('file:openInTerminal', async (_event, dirPath: string) => {
    const platform = os.platform();
    if (platform === 'win32') {
      spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/K', `cd /d "${dirPath}"`], { detached: true, stdio: 'ignore' }).unref();
    } else if (platform === 'darwin') {
      spawn('open', ['-a', 'Terminal', dirPath], { detached: true, stdio: 'ignore' }).unref();
    } else {
      const terminal = process.env.TERM || 'x-terminal-emulator';
      spawn(terminal, [], { cwd: dirPath, detached: true, stdio: 'ignore' }).unref();
    }
    return true;
  });
  ipcMain.handle(IPC_CHANNELS.FILE_OPEN, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return null;

    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'All Files', extensions: ['*'] },
        {
          name: 'Source Code',
          extensions: [
            'ts', 'tsx', 'js', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp',
            'cs', 'swift', 'kt', 'php', 'html', 'css', 'scss', 'less', 'json', 'xml', 'yaml',
            'yml', 'toml', 'md', 'sql', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd', 'dockerfile',
          ],
        },
      ],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const files = await Promise.all(
        result.filePaths.map(async (filePath) => {
          const content = await fileService.readFile(filePath);
          recentService.addRecentFile(filePath);
          return { filePath, content };
        }),
      );
      return files;
    }
    return null;
  });

  ipcMain.handle(IPC_CHANNELS.FILE_SAVE, async (_event, filePath: string, content: string) => {
    console.log('[FILE_SAVE] Writing to:', filePath, 'content length:', content?.length);
    try {
      await fileService.writeFile(filePath, content);
      console.log('[FILE_SAVE] Success:', filePath);
    } catch (err) {
      console.error('[FILE_SAVE] Error:', err);
      throw err;
    }
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.FILE_SAVE_AS, async (event, content: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) { console.error('[FILE_SAVE_AS] No window found'); return null; }

    const result = await dialog.showSaveDialog(window, {
      filters: [{ name: 'All Files', extensions: ['*'] }],
    });

    console.log('[FILE_SAVE_AS] Dialog result:', result.canceled, result.filePath, 'content length:', content?.length);
    if (!result.canceled && result.filePath) {
      try {
        await fileService.writeFile(result.filePath, content);
        console.log('[FILE_SAVE_AS] Success:', result.filePath);
      } catch (err) {
        console.error('[FILE_SAVE_AS] Error:', err);
        throw err;
      }
      recentService.addRecentFile(result.filePath);
      return result.filePath;
    }
    return null;
  });

  ipcMain.handle(IPC_CHANNELS.FILE_READ, async (_event, filePath: string) => {
    if (!filePath) {
      throw new Error('File path is required');
    }
    return fileService.readFile(filePath);
  });

  ipcMain.handle(IPC_CHANNELS.FILE_EXISTS, async (_event, filePath: string) => {
    return fileService.exists(filePath);
  });

  ipcMain.handle(
    IPC_CHANNELS.FILE_CREATE,
    async (_event, filePath: string, content: string = '') => {
      await fileService.createFile(filePath, content);
      return true;
    },
  );

  ipcMain.handle(IPC_CHANNELS.FILE_DELETE, async (_event, filePath: string) => {
    await fileService.deleteFile(filePath);
    return true;
  });

  ipcMain.handle(
    IPC_CHANNELS.FILE_RENAME,
    async (_event, oldPath: string, newPath: string) => {
      await fileService.renameFile(oldPath, newPath);
      return true;
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.FILE_COPY,
    async (_event, source: string, destination: string) => {
      await fileService.copyFile(source, destination);
      return true;
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.FILE_MOVE,
    async (_event, source: string, destination: string) => {
      await fileService.moveFile(source, destination);
      return true;
    },
  );

  ipcMain.handle(IPC_CHANNELS.FILE_STAT, async (_event, filePath: string) => {
    return fileService.getFileStat(filePath);
  });

  ipcMain.handle(IPC_CHANNELS.DIR_READ, async (_event, dirPath: string) => {
    return fileService.readDirectory(dirPath);
  });

  ipcMain.handle(IPC_CHANNELS.DIR_CREATE, async (_event, dirPath: string) => {
    await fileService.createDirectory(dirPath);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.DIR_TREE, async (_event, dirPath: string, depth: number = 10) => {
    return fileService.getDirectoryTree(dirPath, depth);
  });

  ipcMain.handle(IPC_CHANNELS.FILE_DIALOG_OPEN, async (event, options) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return null;
    return dialog.showOpenDialog(window, options);
  });

  ipcMain.handle(IPC_CHANNELS.FILE_DIALOG_SAVE, async (event, options) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return null;
    return dialog.showSaveDialog(window, options);
  });

  // Save screenshot with save dialog
  ipcMain.handle('file:saveScreenshot', async (event, blobBuffer: Buffer, defaultFilename: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return null;

    const result = await dialog.showSaveDialog(window, {
      defaultPath: defaultFilename,
      filters: [
        { name: 'PNG Image', extensions: ['png'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (!result.canceled && result.filePath) {
      await fs.writeFile(result.filePath, blobBuffer);
      return result.filePath;
    }
    return null;
  });
}
