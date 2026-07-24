/**
 * Run IPC Handlers - Execute scripts and capture structured output.
 * Uses child_process.exec for reliable output capture on all platforms.
 */
import { ipcMain, BrowserWindow } from 'electron';
import { exec, spawn, ChildProcess } from 'child_process';
import { logger } from '../utils/logger';

interface RunProcess {
  process: ChildProcess;
  windowId: string;
  command: string;
  pid: number;
}

const runProcesses = new Map<string, RunProcess>();

export function registerRunIPC(): void {
  ipcMain.handle('run:execute', async (event, options: {
    command: string;
    cwd?: string;
    env?: Record<string, string>;
  }) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return { success: false, error: 'No window' };

    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const cwd = options.cwd || process.env.HOME || process.env.USERPROFILE || '/';

    const env: Record<string, string> = { ...process.env } as Record<string, string>;
    env.TERM = env.TERM || 'xterm-256color';
    if (options.env) Object.assign(env, options.env);

    try {
      // Notify renderer: run started
      if (!window.isDestroyed()) {
        window.webContents.send('run:started', { runId, command: options.command, pid: 0 });
      }

      logger.info(`Run executing: ${options.command} (cwd: ${cwd})`);

      // Use exec with maxBuffer for reliable output capture.
      // exec runs via the OS shell (cmd.exe on Windows, sh on Unix).
      const child = exec(options.command, {
        cwd,
        env,
        windowsHide: true,
        maxBuffer: 50 * 1024 * 1024, // 50MB max output
        timeout: 0, // no timeout — user controls via Stop
        encoding: 'utf-8',
      }, (error, stdout, stderr) => {
        // Process finished — send all collected output
        if (!window.isDestroyed()) {
          // Send stdout
          if (stdout) {
            window.webContents.send('run:stdout', { runId, data: stdout });
          }
          // Send stderr
          if (stderr) {
            window.webContents.send('run:stderr', { runId, data: stderr });
          }
          // Send exit
          const exitCode = error ? (error.code ?? 1) : 0;
          const signal = (error as any)?.signal ?? null;
          window.webContents.send('run:exit', { runId, exitCode, signal });
        }
        runProcesses.delete(runId);
        logger.info(`Run completed: ${runId} (code: ${error?.code ?? 0})`);
      });

      if (child.pid) {
        runProcesses.set(runId, {
          process: child,
          windowId: window.id.toString(),
          command: options.command,
          pid: child.pid,
        });
        // Update the started event with real pid
        if (!window.isDestroyed()) {
          window.webContents.send('run:started', { runId, command: options.command, pid: child.pid });
        }
      }

      // Handle spawn errors (e.g., command not found)
      child.on('error', (err) => {
        logger.error(`Run process error: ${runId}`, err);
        runProcesses.delete(runId);
        if (!window.isDestroyed()) {
          window.webContents.send('run:error', { runId, error: err.message });
          window.webContents.send('run:exit', { runId, exitCode: 1, signal: null });
        }
      });

      return { success: true, runId, pid: child.pid || 0 };
    } catch (error: any) {
      logger.error('Failed to start run process', error);
      return { success: false, error: error.message };
    }
  });

  // Kill a running process
  ipcMain.handle('run:kill', async (_event, runId: string) => {
    const run = runProcesses.get(runId);
    if (run) {
      try {
        if (process.platform === 'win32') {
          const killer = spawn('taskkill', ['/pid', String(run.pid), '/T', '/F'], { windowsHide: true });
          killer.on('error', () => {});
        } else {
          run.process.kill('SIGTERM');
          setTimeout(() => {
            try { run.process.kill('SIGKILL'); } catch {}
          }, 2000);
        }
        runProcesses.delete(runId);
        if (!run.process.killed) {
          // Send exit event
          const window = BrowserWindow.getAllWindows().find(w => w.id.toString() === run.windowId);
          if (window && !window.isDestroyed()) {
            window.webContents.send('run:exit', { runId, exitCode: null, signal: 'SIGTERM' });
          }
        }
        return { success: true };
      } catch (error: any) {
        logger.error(`Failed to kill run process: ${runId}`, error);
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: 'Process not found' };
  });

  // Kill all running processes
  ipcMain.handle('run:kill-all', async () => {
    for (const [id, run] of runProcesses) {
      try {
        if (process.platform === 'win32') {
          const killer = spawn('taskkill', ['/pid', String(run.pid), '/T', '/F'], { windowsHide: true });
          killer.on('error', () => {});
        } else {
          run.process.kill('SIGTERM');
        }
      } catch (e) {
        logger.error(`Failed to kill run process: ${id}`, e);
      }
    }
    runProcesses.clear();
    return { success: true };
  });

  // List running processes
  ipcMain.handle('run:list', async () => {
    return Array.from(runProcesses.entries()).map(([id, run]) => ({
      runId: id,
      command: run.command,
      pid: run.pid,
    }));
  });
}

/** Kill all run processes on app quit */
export function killAllRunProcesses(): void {
  for (const [id, run] of runProcesses) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(run.pid), '/T', '/F'], { windowsHide: true });
      } else {
        run.process.kill('SIGKILL');
      }
      logger.info(`Killed run process: ${id} (pid: ${run.pid})`);
    } catch (e) {
      logger.error(`Failed to kill run process: ${id}`, e);
    }
  }
  runProcesses.clear();
}
