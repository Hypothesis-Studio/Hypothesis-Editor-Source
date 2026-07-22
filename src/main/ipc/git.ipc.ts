/**
 * Git IPC Handlers
 */
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import type { GitService } from '../services/GitService';

export function registerGitIPC(gitService: GitService): void {
  ipcMain.handle(IPC_CHANNELS.GIT_STATUS, async (_event, repoPath: string) => {
    return gitService.getStatus(repoPath);
  });

  ipcMain.handle(
    IPC_CHANNELS.GIT_COMMIT,
    async (_event, repoPath: string, message: string, files?: string[]) => {
      return gitService.commit(repoPath, message, files);
    },
  );

  ipcMain.handle(IPC_CHANNELS.GIT_PUSH, async (_event, repoPath: string, remote?: string) => {
    return gitService.push(repoPath, remote);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_PULL, async (_event, repoPath: string, remote?: string) => {
    return gitService.pull(repoPath, remote);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_FETCH, async (_event, repoPath: string, remote?: string) => {
    return gitService.fetch(repoPath, remote);
  });

  ipcMain.handle(
    IPC_CHANNELS.GIT_CLONE,
    async (_event, url: string, destination: string) => {
      return gitService.clone(url, destination);
    },
  );

  ipcMain.handle(IPC_CHANNELS.GIT_BRANCH, async (_event, repoPath: string) => {
    return gitService.getBranches(repoPath);
  });

  ipcMain.handle(
    IPC_CHANNELS.GIT_CHECKOUT,
    async (_event, repoPath: string, branch: string) => {
      return gitService.checkout(repoPath, branch);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_MERGE,
    async (_event, repoPath: string, branch: string) => {
      return gitService.merge(repoPath, branch);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_DIFF,
    async (_event, repoPath: string, file?: string) => {
      return gitService.diff(repoPath, file);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_LOG,
    async (_event, repoPath: string, maxCount?: number) => {
      return gitService.log(repoPath, maxCount);
    },
  );

  ipcMain.handle(IPC_CHANNELS.GIT_STASH, async (_event, repoPath: string) => {
    return gitService.stash(repoPath);
  });

  ipcMain.handle(
    IPC_CHANNELS.GIT_ADD,
    async (_event, repoPath: string, files: string[]) => {
      return gitService.add(repoPath, files);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_RESET,
    async (_event, repoPath: string, files?: string[]) => {
      return gitService.reset(repoPath, files);
    },
  );

  ipcMain.handle(IPC_CHANNELS.GIT_INIT, async (_event, repoPath: string) => {
    return gitService.init(repoPath);
  });

  ipcMain.handle('git:discardFile', async (_event, repoPath: string, file: string) => {
    return gitService.discardFile(repoPath, file);
  });

  ipcMain.handle('git:discardAll', async (_event, repoPath: string) => {
    return gitService.discardAll(repoPath);
  });

  ipcMain.handle('git:isGitRepo', async (_event, repoPath: string) => {
    return gitService.isGitRepo(repoPath);
  });
}
