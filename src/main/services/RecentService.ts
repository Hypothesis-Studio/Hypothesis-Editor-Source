/**
 * Recent Service - Manages recent files and workspaces.
 */
import type { AppStore } from './AppStore';
import { logger } from '../utils/logger';

export class RecentService {
  private appStore: AppStore;
  private maxRecentFiles = 50;
  private maxRecentWorkspaces = 20;

  constructor(appStore: AppStore) {
    this.appStore = appStore;
  }

  getRecentFiles(): string[] {
    return this.appStore.get('recentFiles');
  }

  addRecentFile(filePath: string): void {
    const recent = this.getRecentFiles().filter((f) => f !== filePath);
    recent.unshift(filePath);
    if (recent.length > this.maxRecentFiles) {
      recent.length = this.maxRecentFiles;
    }
    this.appStore.set('recentFiles', recent);
  }

  removeRecentFile(filePath: string): void {
    const recent = this.getRecentFiles().filter((f) => f !== filePath);
    this.appStore.set('recentFiles', recent);
  }

  clearRecentFiles(): void {
    this.appStore.set('recentFiles', []);
  }

  getRecentWorkspaces(): string[] {
    return this.appStore.get('recentWorkspaces');
  }

  addRecentWorkspace(workspacePath: string): void {
    const recent = this.getRecentWorkspaces().filter((w) => w !== workspacePath);
    recent.unshift(workspacePath);
    if (recent.length > this.maxRecentWorkspaces) {
      recent.length = this.maxRecentWorkspaces;
    }
    this.appStore.set('recentWorkspaces', recent);
  }

  removeRecentWorkspace(workspacePath: string): void {
    const recent = this.getRecentWorkspaces().filter((w) => w !== workspacePath);
    this.appStore.set('recentWorkspaces', recent);
  }

  clearRecentWorkspaces(): void {
    this.appStore.set('recentWorkspaces', []);
  }
}
