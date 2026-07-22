/**
 * Terminal IPC Handlers
 */
import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import * as pty from 'node-pty';
import { execSync } from 'child_process';
import { logger } from '../utils/logger';
import type { TerminalInstance } from '../../shared/types';

interface Terminal {
  pty: pty.IPty;
  windowId: string;
  instance: TerminalInstance;
}

const terminals = new Map<string, Terminal>();

/** Kill all pty processes — call on app quit to prevent zombie processes. */
export function killAllTerminals(): void {
  for (const [id, terminal] of terminals) {
    try {
      terminal.pty.kill();
      logger.info(`Killed terminal: ${id} (pid: ${terminal.pty.pid})`);
    } catch (e) {
      logger.error(`Failed to kill terminal ${id}`, e);
    }
  }
  terminals.clear();
}

function getDefaultShell(): string {
  switch (process.platform) {
    case 'win32':
      return process.env.COMSPEC || 'powershell.exe';
    case 'darwin':
      return process.env.SHELL || '/bin/zsh';
    default:
      return process.env.SHELL || '/bin/bash';
  }
}

/**
 * Build a full environment for the terminal pty process.
 * When launched from a GUI shortcut (not a terminal), Electron's process.env
 * may be missing entries that a login shell would have (e.g. updated PATH).
 * On Windows we merge the current process env with the system-wide PATH
 * read from the registry so tools like git, node, npm, python are available.
 */
function getTerminalEnv(): Record<string, string> {
  const env: Record<string, string> = { ...process.env } as Record<string, string>;

  // Ensure basic terminal variables are set
  env.TERM = env.TERM || 'xterm-256color';
  env.COLORTERM = env.COLORTERM || 'truecolor';
  env.TERM_PROGRAM = 'Hypothesis';

  if (process.platform === 'win32') {
    try {
      // Read the system-wide PATH from the Windows registry
      const sysPath = execSync(
        'powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(' + "'" + 'PATH' + "'" + ', ' + "'" + 'Machine' + "'" + ')"',
        { encoding: 'utf-8', timeout: 5000, windowsHide: true }
      ).trim();

      // Read the user-level PATH from the Windows registry
      const userPath = execSync(
        'powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(' + "'" + 'PATH' + "'" + ', ' + "'" + 'User' + "'" + ')"',
        { encoding: 'utf-8', timeout: 5000, windowsHide: true }
      ).trim();

      // Merge: system PATH + user PATH + current process PATH (deduplicated)
      const currentPath = env.Path || env.PATH || '';
      const allPaths = [sysPath, userPath, currentPath]
        .filter(Boolean)
        .join(';')
        .split(';')
        .map(p => p.trim())
        .filter(Boolean);

      const uniquePaths = [...new Set(allPaths)];
      env.Path = uniquePaths.join(';');
      env.PATH = env.Path;

      logger.info('Terminal env: merged system PATH from registry');
    } catch (e) {
      logger.warn('Failed to read system PATH from registry, using process.env', e);
    }
  }

  return env;
}

export function registerTerminalIPC(): void {
  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_CREATE,
    async (event, options?: { shell?: string; cwd?: string; name?: string }) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) return null;

      const id = `terminal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const shell = options?.shell || getDefaultShell();
      const cwd = options?.cwd || process.env.HOME || process.env.USERPROFILE || '/';

      try {
        const ptyProcess = pty.spawn(shell, [], {
          name: 'xterm-256color',
          cols: 80,
          rows: 30,
          cwd,
          env: getTerminalEnv(),
        });

        const instance: TerminalInstance = {
          id,
          name: options?.name || `Terminal ${terminals.size + 1}`,
          shell,
          cwd,
          pid: ptyProcess.pid,
          isActive: true,
          title: shell,
          rows: 30,
          cols: 80,
          createdAt: Date.now(),
        };

        terminals.set(id, {
          pty: ptyProcess,
          windowId: window.id.toString(),
          instance,
        });

        ptyProcess.onData((data) => {
          if (!window.isDestroyed()) {
            window.webContents.send(IPC_CHANNELS.TERMINAL_DATA, { id, data });
          }
        });

        ptyProcess.onExit(({ exitCode, signal }) => {
          terminals.delete(id);
          if (!window.isDestroyed()) {
            window.webContents.send(IPC_CHANNELS.TERMINAL_EXIT, { id, exitCode, signal });
          }
        });

        logger.info(`Terminal created: ${id} (pid: ${ptyProcess.pid})`);
        return instance;
      } catch (error) {
        logger.error('Failed to create terminal', error);
        return null;
      }
    },
  );

  ipcMain.on(
    IPC_CHANNELS.TERMINAL_WRITE,
    (_event, { id, data }: { id: string; data: string }) => {
      const terminal = terminals.get(id);
      if (terminal) {
        terminal.pty.write(data);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_RESIZE,
    async (_event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
      const terminal = terminals.get(id);
      if (terminal) {
        terminal.pty.resize(cols, rows);
        terminal.instance.cols = cols;
        terminal.instance.rows = rows;
      }
      return true;
    },
  );

  ipcMain.handle(IPC_CHANNELS.TERMINAL_CLOSE, async (_event, id: string) => {
    const terminal = terminals.get(id);
    if (terminal) {
      terminal.pty.kill();
      terminals.delete(id);
    }
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_KILL, async (_event, id: string) => {
    const terminal = terminals.get(id);
    if (terminal) {
      terminal.pty.kill('SIGKILL');
      terminals.delete(id);
    }
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_LIST, async () => {
    return Array.from(terminals.values()).map((t) => t.instance);
  });
}
