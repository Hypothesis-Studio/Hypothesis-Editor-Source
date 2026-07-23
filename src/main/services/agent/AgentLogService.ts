/**
 * Agent Log Service - Manages structured logging and telemetry for the agent system.
 */
import type {
  AgentLogEntry,
  LogLevel,
  TelemetryEvent,
} from '../../../shared/types/agent';
import { logger } from '../../utils/logger';
import { nanoid } from '../../utils/nanoid';

const log = logger.scope('AgentLogService');

export class AgentLogService {
  private logs: AgentLogEntry[] = [];
  private telemetryBuffer: TelemetryEvent[] = [];
  private maxLogs: number = 5000;
  private maxTelemetry: number = 1000;
  private listeners: Array<(entry: AgentLogEntry) => void> = [];

  log(
    level: LogLevel,
    category: AgentLogEntry['category'],
    message: string,
    data?: unknown,
    sessionId?: string,
    agentId?: string,
  ): AgentLogEntry {
    const entry: AgentLogEntry = {
      id: nanoid(),
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
      sessionId,
      agentId,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Also log to the main logger
    const logFn = log[level] || log.info;
    logFn(`[${category}] ${message}`, data ?? '');

    // Notify listeners
    for (const listener of this.listeners) {
      try { listener(entry); } catch { /* ignore */ }
    }

    return entry;
  }

  debug(category: AgentLogEntry['category'], message: string, data?: unknown): AgentLogEntry {
    return this.log('debug', category, message, data);
  }

  info(category: AgentLogEntry['category'], message: string, data?: unknown): AgentLogEntry {
    return this.log('info', category, message, data);
  }

  warn(category: AgentLogEntry['category'], message: string, data?: unknown): AgentLogEntry {
    return this.log('warn', category, message, data);
  }

  error(category: AgentLogEntry['category'], message: string, data?: unknown): AgentLogEntry {
    return this.log('error', category, message, data);
  }

  getLogs(filters?: {
    level?: LogLevel;
    category?: AgentLogEntry['category'];
    sessionId?: string;
    limit?: number;
    since?: number;
  }): AgentLogEntry[] {
    let entries = [...this.logs];

    if (filters?.level) {
      const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
      const minLevel = levels[filters.level];
      entries = entries.filter(e => levels[e.level] >= minLevel);
    }

    if (filters?.category) {
      entries = entries.filter(e => e.category === filters.category);
    }

    if (filters?.sessionId) {
      entries = entries.filter(e => e.sessionId === filters.sessionId);
    }

    if (filters?.since) {
      entries = entries.filter(e => e.timestamp >= filters.since!);
    }

    entries.sort((a, b) => b.timestamp - a.timestamp);

    if (filters?.limit) {
      entries = entries.slice(0, filters.limit);
    }

    return entries;
  }

  clearLogs(): void {
    this.logs = [];
    log.info('Agent logs cleared');
  }

  // Telemetry
  trackEvent(type: string, data: Record<string, unknown>): void {
    const event: TelemetryEvent = { type, timestamp: Date.now(), data };
    this.telemetryBuffer.push(event);
    if (this.telemetryBuffer.length > this.maxTelemetry) {
      this.telemetryBuffer = this.telemetryBuffer.slice(-this.maxTelemetry);
    }
  }

  getTelemetry(limit: number = 100): TelemetryEvent[] {
    return this.telemetryBuffer.slice(-limit);
  }

  clearTelemetry(): void {
    this.telemetryBuffer = [];
  }

  // Listeners for real-time log streaming
  addListener(listener: (entry: AgentLogEntry) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}
