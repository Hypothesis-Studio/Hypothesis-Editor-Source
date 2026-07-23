/**
 * Session Persistence Service - Manages chat session storage and retrieval.
 */
import type {
  ChatSession,
  ChatMessage,
  TokenUsage,
} from '../../../shared/types/agent';
import { logger } from '../../utils/logger';
import type { AppStore } from '../AppStore';
import { nanoid } from '../../utils/nanoid';

const log = logger.scope('SessionPersistence');

export class SessionPersistence {
  private appStore: AppStore;
  private sessions: Map<string, ChatSession> = new Map();

  constructor(appStore: AppStore) {
    this.appStore = appStore;
  }

  initialize(): void {
    const stored = this.appStore.get('agent.sessions') as ChatSession[] | undefined;
    if (stored) {
      for (const session of stored) {
        this.sessions.set(session.id, session);
      }
    }
    log.info(`Loaded ${this.sessions.size} sessions`);
  }

  private save(): void {
    this.appStore.set('agent.sessions', Array.from(this.sessions.values()));
  }

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
    this.sessions.set(session.id, session);
    this.save();
    return session;
  }

  getSession(id: string): ChatSession | undefined {
    return this.sessions.get(id);
  }

  listSessions(agentId?: string, limit: number = 50): ChatSession[] {
    let sessions = Array.from(this.sessions.values());
    if (agentId) {
      sessions = sessions.filter(s => s.agentId === agentId);
    }
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    return sessions.slice(0, limit);
  }

  addMessage(sessionId: string, message: ChatMessage): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.messages.push(message);
    session.updatedAt = Date.now();

    // Update total usage
    if (message.tokenUsage) {
      session.totalTokenUsage.promptTokens += message.tokenUsage.promptTokens;
      session.totalTokenUsage.completionTokens += message.tokenUsage.completionTokens;
      session.totalTokenUsage.totalTokens += message.tokenUsage.totalTokens;
      session.totalTokenUsage.estimatedCost += message.tokenUsage.estimatedCost;
    }

    // Auto-title from first user message
    if (session.messages.length === 1 && message.role === 'user') {
      session.title = message.content.substring(0, 80) + (message.content.length > 80 ? '...' : '');
    }

    this.save();
  }

  updateMessage(sessionId: string, messageId: string, updates: Partial<ChatMessage>): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const msg = session.messages.find(m => m.id === messageId);
    if (!msg) return;
    Object.assign(msg, updates);
    session.updatedAt = Date.now();
    this.save();
  }

  getMessages(sessionId: string): ChatMessage[] {
    return this.sessions.get(sessionId)?.messages ?? [];
  }

  deleteSession(id: string): boolean {
    const deleted = this.sessions.delete(id);
    if (deleted) this.save();
    return deleted;
  }

  clearSession(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.messages = [];
    session.totalTokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 };
    session.updatedAt = Date.now();
    this.save();
  }

  /**
   * Get conversation history formatted for the AI provider.
   */
  getFormattedHistory(sessionId: string, maxMessages: number = 50): Array<{ role: string; content: string; tool_call_id?: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const messages = session.messages.slice(-maxMessages);
    return messages.map(m => ({
      role: m.role,
      content: m.content,
      ...(m.role === 'tool' && m.metadata?.toolCallId ? { tool_call_id: m.metadata.toolCallId as string } : {}),
    }));
  }

  cleanup(olderThanDays: number = 30): number {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    let removed = 0;
    for (const [id, session] of this.sessions) {
      if (session.updatedAt < cutoff) {
        this.sessions.delete(id);
        removed++;
      }
    }
    if (removed > 0) {
      this.save();
      log.info(`Cleaned up ${removed} old sessions`);
    }
    return removed;
  }
}
