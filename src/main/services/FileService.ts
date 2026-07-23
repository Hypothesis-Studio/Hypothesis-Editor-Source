/**
 * File Service - File system operations with validation and error handling.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import type { FileEntry } from '../../shared/types';

export class FileService {
  private watchers: Map<string, any> = new Map();

  /**
   * Start watching a directory for changes using chokidar.
   */
  startWatching(dirPath: string, eventSender: Electron.WebContents): void {
    if (this.watchers.has(dirPath)) return;
    try {
      const chokidar = require('chokidar');
      const watcher = chokidar.watch(dirPath, {
        persistent: true,
        ignoreInitial: true,
        depth: 10,
        ignored: ['**/node_modules/**', '**/.git/**', '**/__pycache__/**', '**/.DS_Store'],
        awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
      });

      const sendEvent = (eventType: string, filePath: string) => {
        try {
          if (!eventSender.isDestroyed()) {
            eventSender.send('file-watcher:event', { type: eventType, path: filePath, dirPath });
          }
        } catch {}
      };

      watcher.on('add', (p: string) => sendEvent('add', p));
      watcher.on('change', (p: string) => sendEvent('change', p));
      watcher.on('unlink', (p: string) => sendEvent('unlink', p));
      watcher.on('addDir', (p: string) => sendEvent('addDir', p));
      watcher.on('unlinkDir', (p: string) => sendEvent('unlinkDir', p));
      watcher.on('error', (err: Error) => logger.error(`File watcher error for ${dirPath}:`, err));

      this.watchers.set(dirPath, watcher);
      logger.info(`File watcher started for: ${dirPath}`);
    } catch (e) {
      logger.error(`Failed to start file watcher for ${dirPath}: ${e}`);
    }
  }

  /**
   * Stop watching a directory.
   */
  stopWatching(dirPath: string): void {
    const watcher = this.watchers.get(dirPath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(dirPath);
      logger.info(`File watcher stopped for: ${dirPath}`);
    }
  }

  /**
   * Stop all file watchers.
   */
  stopAllWatchers(): void {
    for (const [_dirPath, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
  }

  async readFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      logger.error(`Failed to read file: ${filePath}`, error);
      throw error;
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      logger.info(`File written: ${filePath} (${content.length} chars)`);
    } catch (error) {
      logger.error(`Failed to write file: ${filePath}`, error);
      throw error;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async createFile(filePath: string, content: string = ''): Promise<void> {
    await this.writeFile(filePath, content);
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        await fs.rm(filePath, { recursive: true, force: true });
      } else {
        await fs.unlink(filePath);
      }
    } catch (error) {
      logger.error(`Failed to delete: ${filePath}`, error);
      throw error;
    }
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    try {
      await fs.rename(oldPath, newPath);
    } catch (error) {
      logger.error(`Failed to rename: ${oldPath} -> ${newPath}`, error);
      throw error;
    }
  }

  async copyFile(source: string, destination: string): Promise<void> {
    try {
      await fs.mkdir(path.dirname(destination), { recursive: true });
      const stat = await fs.stat(source);
      if (stat.isDirectory()) {
        await fs.cp(source, destination, { recursive: true });
      } else {
        await fs.copyFile(source, destination);
      }
    } catch (error) {
      logger.error(`Failed to copy: ${source} -> ${destination}`, error);
      throw error;
    }
  }

  async moveFile(source: string, destination: string): Promise<void> {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.rename(source, destination);
  }

  async getFileStat(filePath: string) {
    try {
      const stat = await fs.stat(filePath);
      return {
        size: stat.size,
        createdAt: stat.birthtime,
        modifiedAt: stat.mtime,
        isDirectory: stat.isDirectory(),
        isFile: stat.isFile(),
        isSymlink: stat.isSymbolicLink(),
      };
    } catch (error) {
      logger.error(`Failed to stat: ${filePath}`, error);
      throw error;
    }
  }

  async readDirectory(dirPath: string): Promise<FileEntry[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const result: FileEntry[] = [];

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        try {
          const stat = await fs.stat(fullPath);
          result.push({
            name: entry.name,
            path: fullPath,
            type: entry.isDirectory() ? 'directory' : entry.isSymbolicLink() ? 'symlink' : 'file',
            size: stat.size,
            modifiedAt: stat.mtime,
            createdAt: stat.birthtime,
            isHidden: entry.name.startsWith('.'),
            extension: entry.isFile() ? path.extname(entry.name).slice(1) : '',
            depth: 0,
          });
        } catch {
          // Skip entries we can't stat
        }
      }

      return result.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      logger.error(`Failed to read directory: ${dirPath}`, error);
      throw error;
    }
  }

  async createDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  async getDirectoryTree(dirPath: string, maxDepth: number = 10): Promise<FileEntry[]> {
    const buildTree = async (currentPath: string, depth: number): Promise<FileEntry[]> => {
      if (depth > maxDepth) return [];

      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      const result: FileEntry[] = [];

      for (const entry of entries) {
        // Skip node_modules, .git, etc.
        if (['node_modules', '.git', '.vscode', '__pycache__', '.DS_Store'].includes(entry.name)) {
          continue;
        }

        const fullPath = path.join(currentPath, entry.name);
        try {
          const stat = await fs.stat(fullPath);
          const fileEntry: FileEntry = {
            name: entry.name,
            path: fullPath,
            type: entry.isDirectory() ? 'directory' : entry.isSymbolicLink() ? 'symlink' : 'file',
            size: stat.size,
            modifiedAt: stat.mtime,
            createdAt: stat.birthtime,
            isHidden: entry.name.startsWith('.'),
            extension: entry.isFile() ? path.extname(entry.name).slice(1) : '',
            depth,
            children: [],
            isExpanded: false,
            isLoading: false,
          };

          if (entry.isDirectory()) {
            fileEntry.children = await buildTree(fullPath, depth + 1);
          }

          result.push(fileEntry);
        } catch {
          // Skip entries we can't access
        }
      }

      return result.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });
    };

    return buildTree(dirPath, 0);
  }
}
