/**
 * Agent IPC Handlers - Secure IPC bridge for the agent system.
 */
import { ipcMain, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { AGENT_IPC_CHANNELS } from '../../shared/types/agent';
import type { AgentService } from '../services/agent/AgentService';
import { logger } from '../utils/logger';

const log = logger.scope('AgentIPC');

/**
 * Resolve workspace path: prefer opened workspace, fallback to dedicated agent workspace.
 * Creates the agent workspace directory if it doesn't exist.
 */
function resolveWorkspace(explicitPath?: string): string {
  if (explicitPath && fs.existsSync(explicitPath)) return explicitPath;
  const agentWs = path.join(app.getPath('userData'), 'agent-workspace');
  if (!fs.existsSync(agentWs)) {
    fs.mkdirSync(agentWs, { recursive: true });
  }
  return agentWs;
}

export function registerAgentIPC(agentService: AgentService): void {
  const CH = AGENT_IPC_CHANNELS;

  // ── Chat ──────────────────────────────────────────────────────
  ipcMain.handle(CH.AGENT_CHAT_SEND, async (_event, sessionId: string, content: string, agentId?: string, workspacePath?: string) => {
    try {
      const resolvedWs = resolveWorkspace(workspacePath);
      const message = await agentService.sendMessage(sessionId, content, agentId, resolvedWs);
      return { success: true, data: message };
    } catch (err) {
      log.error('Chat send failed', err);
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(CH.AGENT_CHAT_CANCEL, async (_event, sessionId: string) => {
    try {
      agentService.cancelStream(sessionId);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(CH.AGENT_CHAT_HISTORY, async (_event, sessionId: string) => {
    try {
      const messages = agentService.sessions.getMessages(sessionId);
      return { success: true, data: messages };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ── Streaming (uses webContents.send for push events) ─────────
  ipcMain.handle(CH.AGENT_CHAT_STREAM, async (event, sessionId: string, content: string, agentId?: string, workspacePath?: string) => {
    try {
      const webContents = event.sender;
      const resolvedWs = resolveWorkspace(workspacePath);
      const stream = agentService.streamMessage(sessionId, content, agentId, resolvedWs);

      (async () => {
        try {
          for await (const streamEvent of stream) {
            if (webContents.isDestroyed()) break;
            webContents.send(CH.AGENT_STREAM_EVENT, streamEvent);
          }
        } catch (err) {
          log.error('Stream error', err);
          if (!webContents.isDestroyed()) {
            webContents.send(CH.AGENT_STREAM_EVENT, {
              type: 'error',
              data: { message: (err as Error).message || 'Stream failed' },
              timestamp: Date.now(),
            });
          }
        } finally {
          if (!webContents.isDestroyed()) {
            webContents.send(CH.AGENT_STREAM_EVENT, { type: 'done', data: null, timestamp: Date.now() });
            webContents.send(CH.AGENT_STREAM_END, { sessionId });
          }
        }
      })();

      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ── Sessions ──────────────────────────────────────────────────
  ipcMain.handle(CH.AGENT_SESSION_CREATE, async (_event, agentId: string, title?: string) => {
    try {
      const session = agentService.sessions.createSession(agentId, title);
      return { success: true, data: session };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(CH.AGENT_SESSION_LIST, async (_event, agentId?: string, limit?: number) => {
    try {
      const sessions = agentService.sessions.listSessions(agentId, limit);
      return { success: true, data: sessions };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(CH.AGENT_SESSION_DELETE, async (_event, sessionId: string) => {
    try {
      agentService.sessions.deleteSession(sessionId);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(CH.AGENT_SESSION_GET, async (_event, sessionId: string) => {
    try {
      const session = agentService.sessions.getSession(sessionId);
      return { success: true, data: session };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ── Providers ─────────────────────────────────────────────────
  ipcMain.handle(CH.AGENT_PROVIDER_LIST, async () => {
    try {
      const providers = agentService.providers.listProviders();
      return { success: true, data: providers };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(CH.AGENT_PROVIDER_ADD, async (_event, config) => {
    try {
      const provider = await agentService.providers.addProvider(config);
      return { success: true, data: provider };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(CH.AGENT_PROVIDER_UPDATE, async (_event, id: string, updates) => {
    try {
      const provider = await agentService.providers.updateProvider(id, updates);
      return { success: true, data: provider };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(CH.AGENT_PROVIDER_REMOVE, async (_event, id: string) => {
    try {
      await agentService.providers.removeProvider(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(CH.AGENT_PROVIDER_TEST, async (_event, id: string) => {
    try {
      const result = await agentService.providers.testProvider(id);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(CH.AGENT_PROVIDER_MODELS, async (_event, id: string) => {
    try {
      const models = await agentService.providers.fetchModels(id);
      return { success: true, data: models };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ── Config ────────────────────────────────────────────────────
  ipcMain.handle(CH.AGENT_CONFIG_LIST, async () => {
    try {
      return { success: true, data: agentService.listAgentConfigs() };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(CH.AGENT_CONFIG_GET, async (_event, id: string) => {
    try {
      return { success: true, data: agentService.getAgentConfig(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(CH.AGENT_CONFIG_CREATE, async (_event, config) => {
    try {
      return { success: true, data: agentService.createAgentConfig(config) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(CH.AGENT_CONFIG_UPDATE, async (_event, id: string, updates) => {
    try {
      return { success: true, data: agentService.updateAgentConfig(id, updates) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(CH.AGENT_CONFIG_DELETE, async (_event, id: string) => {
    try {
      agentService.deleteAgentConfig(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ── Tasks ─────────────────────────────────────────────────────
  ipcMain.handle(CH.AGENT_TASK_LIST, async (_event, filters?) => {
    try {
      return { success: true, data: agentService.tasks.listTasks(filters) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(CH.AGENT_TASK_GET, async (_event, id: string) => {
    try {
      return { success: true, data: agentService.tasks.getTask(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(CH.AGENT_TASK_CANCEL, async (_event, id: string) => {
    try {
      agentService.tasks.cancelTask(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(CH.AGENT_TASK_DELETE, async (_event, id: string) => {
    try {
      agentService.tasks.deleteTask(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ── Tools ─────────────────────────────────────────────────────
  ipcMain.handle(CH.AGENT_TOOL_LIST, async () => {
    try {
      return { success: true, data: agentService.tools.listTools() };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(CH.AGENT_TOOL_ENABLE, async (_event, id: string) => {
    try {
      agentService.tools.enableTool(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(CH.AGENT_TOOL_DISABLE, async (_event, id: string) => {
    try {
      agentService.tools.disableTool(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ── Memory ────────────────────────────────────────────────────
  ipcMain.handle(CH.AGENT_MEMORY_SEARCH, async (_event, query) => {
    try {
      return { success: true, data: agentService.memory.search(query) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(CH.AGENT_MEMORY_LIST, async (_event, limit?: number) => {
    try {
      return { success: true, data: agentService.memory.listEntries(limit) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(CH.AGENT_MEMORY_CLEAR, async (_event, sessionId?: string) => {
    try {
      if (sessionId) {
        agentService.memory.clearSession(sessionId);
      } else {
        agentService.memory.clearAll();
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ── Logs ──────────────────────────────────────────────────────
  ipcMain.handle(CH.AGENT_LOG_LIST, async (_event, filters?) => {
    try {
      return { success: true, data: agentService.agentLogs.getLogs(filters) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(CH.AGENT_LOG_CLEAR, async () => {
    try {
      agentService.agentLogs.clearLogs();
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ── Status ────────────────────────────────────────────────────
  ipcMain.handle(CH.AGENT_STATUS, async () => {
    try {
      return { success: true, data: agentService.getHealthStatus() };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ── Log streaming (push to renderer) ─────────────────────────
  agentService.agentLogs.addListener((entry) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(CH.AGENT_LOG_ENTRY, entry);
      }
    }
  });

  log.info('Agent IPC handlers registered');
}
