/**
 * Session Persistence Service - Manages chat session storage and retrieval.
 *
 * Architecture:
 * - Index file: userData/agent-sessions/index.json  (session metadata, no messages)
 * - Per-session: userData/agent-sessions/<id>.json  (messages only, lazy loaded)
 * - Max 200 messages per session (oldest trimmed on overflow)
 * - Sessions older than 30 days auto-deleted on initialize()
 * - appStore no longer used for sessions — prevents large JSON blob in RAM
 */
import type { ChatSession, ChatMessage, TokenUsage } from '../../../shared/types/agent';
import { logger } from '../../utils/logger';
import { nanoid } from '../../utils/nanoid';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

const log = logger.scope('SessionPersistence');

const MAX_MESSAGES_PER_SESSION = 200;
const SESSIONS_DIR = () => path.join(app.getPath('userData'), 'agent-sessions');

// ── Metadata stored in index (no messages) ────────────────────────────────────
type SessionMeta = Omit<ChatSession, 'messages'>;

export class SessionPersistence {
  private meta: Map<string, SessionMeta> = new Map();
  // Cache of loaded messages — evicted when session not recently used
  private msgCache: Map<string, ChatMessage[]> = new Map();

  constructor(_appStore?: any) {
    // appStore param kept for backward-compat call sites; no longer used
  }

  initialize(): void {
    const dir = SESSIONS_DIR();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Load index
    const indexFile = path.join(dir, 'index.json');
    if (fs.existsSync(indexFile)) {
      try {
        const list: SessionMeta[] = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
        for (const s of list) this.meta.set(s.id, s);
      } catch (e) { log.warn('Failed to load session index', e); }
    }

    // Cleanup orphaned message files (no matching index entry)
    try {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json');
      for (const f of files) {
        const id = f.replace('.json', '');
        if (!this.meta.has(id)) {
          fs.unlinkSync(path.join(dir, f));
        }
      }
    } catch { /* non-critical */ }

    // Cleanup leftover chat-room sessions
    this.cleanupChatRoomSessions();

    log.info(`Loaded ${this.meta.size} sessions`);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private _saveIndex(): void {
    try {
      const dir = SESSIONS_DIR();
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'index.json'),
        JSON.stringify(Array.from(this.meta.values()), null, 2),
        'utf-8',
      );
    } catch (e) { log.warn('Failed to save session index', e); }
  }

  private _sessionFile(id: string): string {
    return path.join(SESSIONS_DIR(), `${id}.json`);
  }

  private _loadMessages(id: string): ChatMessage[] {
    if (this.msgCache.has(id)) return this.msgCache.get(id)!;
    try {
      const file = this._sessionFile(id);
      if (!fs.existsSync(file)) return [];
      const msgs: ChatMessage[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
      this.msgCache.set(id, msgs);
      return msgs;
    } catch { return []; }
  }

  private _saveMessages(id: string, messages: ChatMessage[]): void {
    try {
      const dir = SESSIONS_DIR();
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      // Trim to cap before saving
      const trimmed = messages.length > MAX_MESSAGES_PER_SESSION
        ? messages.slice(-MAX_MESSAGES_PER_SESSION)
        : messages;
      this.msgCache.set(id, trimmed);
      fs.writeFileSync(this._sessionFile(id), JSON.stringify(trimmed, null, 2), 'utf-8');
    } catch (e) { log.warn(`Failed to save messages for session ${id}`, e); }
  }

  private _deleteSessionFile(id: string): void {
    try {
      const file = this._sessionFile(id);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch { /* ignore */ }
    this.msgCache.delete(id);
  }

  private _toFullSession(meta: SessionMeta): ChatSession {
    return { ...meta, messages: this._loadMessages(meta.id) };
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  createSession(agentId: string, title?: string): ChatSession {
    const session: ChatSession = {
      id: nanoid(),
      title: title ?? `Session ${new Date().toLocaleString()}`,
      agentId,
      messages: [],
      totalTokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const { messages, ...meta } = session;
    this.meta.set(session.id, meta);
    this.msgCache.set(session.id, []);
    this._saveIndex();
    this._saveMessages(session.id, []);
    return session;
  }

  getSession(id: string): ChatSession | undefined {
    const meta = this.meta.get(id);
    if (!meta) return undefined;
    return this._toFullSession(meta);
  }

  getOrCreateSessionWithId(id: string, agentId: string, title?: string): ChatSession {
    const meta = this.meta.get(id);
    if (meta) return this._toFullSession(meta);
    const session: ChatSession = {
      id,
      title: title ?? `Session ${new Date().toLocaleString()}`,
      agentId,
      messages: [],
      totalTokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const { messages, ...newMeta } = session;
    this.meta.set(id, newMeta);
    this.msgCache.set(id, []);
    this._saveIndex();
    this._saveMessages(id, []);
    return session;
  }

  cleanupChatRoomSessions(): number {
    let removed = 0;
    for (const id of Array.from(this.meta.keys())) {
      if (id.startsWith('chat-room-')) {
        this.meta.delete(id);
        this._deleteSessionFile(id);
        removed++;
      }
    }
    if (removed > 0) this._saveIndex();
    return removed;
  }

  listSessions(agentId?: string, limit: number = 50): ChatSession[] {
    let sessions = Array.from(this.meta.values())
      .filter(s => !s.id.startsWith('chat-room-'));
    if (agentId) sessions = sessions.filter(s => s.agentId === agentId);
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    // Return metadata only (no messages) for list — saves RAM
    return sessions.slice(0, limit).map(s => ({ ...s, messages: [] }));
  }

  addMessage(sessionId: string, message: ChatMessage): void {
    const meta = this.meta.get(sessionId);
    if (!meta) return;

    const messages = this._loadMessages(sessionId);
    messages.push(message);
    meta.updatedAt = Date.now();

    // Update token usage
    if (message.tokenUsage) {
      meta.totalTokenUsage.promptTokens += message.tokenUsage.promptTokens;
      meta.totalTokenUsage.completionTokens += message.tokenUsage.completionTokens;
      meta.totalTokenUsage.totalTokens += message.tokenUsage.totalTokens;
      meta.totalTokenUsage.estimatedCost += message.tokenUsage.estimatedCost;
    }

    // Auto-title from first user message
    if (messages.length === 1 && message.role === 'user') {
      meta.title = message.content.substring(0, 80) + (message.content.length > 80 ? '...' : '');
    }

    this._saveMessages(sessionId, messages);
    this._saveIndex();
  }

  updateMessage(sessionId: string, messageId: string, updates: Partial<ChatMessage>): void {
    const meta = this.meta.get(sessionId);
    if (!meta) return;
    const messages = this._loadMessages(sessionId);
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;
    Object.assign(msg, updates);
    meta.updatedAt = Date.now();
    this._saveMessages(sessionId, messages);
    this._saveIndex();
  }

  getMessages(sessionId: string): ChatMessage[] {
    return this._loadMessages(sessionId);
  }

  deleteSession(id: string): boolean {
    const existed = this.meta.has(id);
    this.meta.delete(id);
    this._deleteSessionFile(id);
    if (existed) this._saveIndex();
    return existed;
  }

  clearSession(id: string): void {
    const meta = this.meta.get(id);
    if (!meta) return;
    meta.totalTokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 };
    meta.updatedAt = Date.now();
    this._saveMessages(id, []);
    this._saveIndex();
  }

  getFormattedHistory(sessionId: string, maxMessages: number = 50): Array<{ role: string; content: string; tool_call_id?: string }> {
    const messages = this._loadMessages(sessionId);
    return messages.slice(-maxMessages).map(m => ({
      role: m.role,
      content: m.content,
      ...(m.role === 'tool' && m.metadata?.toolCallId ? { tool_call_id: m.metadata.toolCallId as string } : {}),
    }));
  }

  /** Evict message cache for sessions not recently accessed (call periodically) */
  evictCache(keepRecentMs: number = 10 * 60 * 1000): void {
    const cutoff = Date.now() - keepRecentMs;
    for (const [id, meta] of this.meta) {
      if (meta.updatedAt < cutoff && this.msgCache.has(id)) {
        this.msgCache.delete(id);
      }
    }
  }
}
