/**
 * Memory Service - Manages agent conversation memory and context.
 * Implements importance-based memory with retrieval, summarization, and pruning.
 */
import type {
  MemoryEntry,
  MemoryQuery,
  MemorySearchResult,
} from '../../../shared/types/agent';
import { logger } from '../../utils/logger';
import type { AppStore } from '../AppStore';
import { nanoid } from '../../utils/nanoid';

const log = logger.scope('MemoryService');

export class MemoryService {
  private appStore: AppStore;
  private entries: MemoryEntry[] = [];
  private maxEntries: number = 1000;

  constructor(appStore: AppStore) {
    this.appStore = appStore;
  }

  initialize(): void {
    const stored = this.appStore.get('agent.memory') as MemoryEntry[] | undefined;
    if (stored) {
      this.entries = stored;
    }
    log.info(`Loaded ${this.entries.length} memory entries`);
  }

  private save(): void {
    this.appStore.set('agent.memory', this.entries);
  }

  addEntry(
    sessionId: string,
    type: MemoryEntry['type'],
    content: string,
    importance: number = 5,
    metadata?: Record<string, unknown>,
  ): MemoryEntry {
    const entry: MemoryEntry = {
      id: nanoid(),
      sessionId,
      type,
      content,
      tokens: this.estimateTokens(content),
      importance: Math.max(1, Math.min(10, importance)),
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0,
      metadata,
    };

    this.entries.push(entry);

    // Prune if over limit
    if (this.entries.length > this.maxEntries) {
      this.prune();
    }

    this.save();
    return entry;
  }

  search(query: MemoryQuery): MemorySearchResult[] {
    const maxResults = query.maxResults ?? 10;
    const minImportance = query.minImportance ?? 1;

    let candidates = this.entries.filter(e => e.importance >= minImportance);

    if (query.type) {
      candidates = candidates.filter(e => e.type === query.type);
    }

    if (query.sessionId) {
      candidates = candidates.filter(e => e.sessionId === query.sessionId);
    }

    // Simple TF-based relevance scoring
    const queryTerms = query.query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const scored: MemorySearchResult[] = candidates.map(entry => {
      const content = entry.content.toLowerCase();
      let relevance = 0;

      for (const term of queryTerms) {
        if (content.includes(term)) {
          relevance += 1;
        }
      }

      // Normalize by query length
      relevance = queryTerms.length > 0 ? relevance / queryTerms.length : 0;

      // Boost by importance and recency
      const ageMs = Date.now() - entry.lastAccessedAt;
      const recencyBoost = Math.max(0, 1 - ageMs / (7 * 24 * 60 * 60 * 1000)); // 7 days
      relevance = relevance * 0.6 + (entry.importance / 10) * 0.25 + recencyBoost * 0.15;

      return { entry, relevance };
    });

    return scored
      .filter(s => s.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxResults)
      .map(result => {
        // Update access stats
        result.entry.lastAccessedAt = Date.now();
        result.entry.accessCount++;
        return result;
      });
  }

  getRelevantContext(query: string, maxTokens: number = 4000): string {
    const results = this.search({ query, maxResults: 20 });
    const contextParts: string[] = [];
    let totalTokens = 0;

    for (const result of results) {
      if (totalTokens + result.entry.tokens > maxTokens) break;
      contextParts.push(result.entry.content);
      totalTokens += result.entry.tokens;
    }

    return contextParts.join('\n---\n');
  }

  getBySession(sessionId: string): MemoryEntry[] {
    return this.entries
      .filter(e => e.sessionId === sessionId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  listEntries(limit: number = 100): MemoryEntry[] {
    return [...this.entries]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  deleteEntry(id: string): boolean {
    const index = this.entries.findIndex(e => e.id === id);
    if (index === -1) return false;
    this.entries.splice(index, 1);
    this.save();
    return true;
  }

  clearSession(sessionId: string): void {
    this.entries = this.entries.filter(e => e.sessionId !== sessionId);
    this.save();
  }

  clearAll(): void {
    this.entries = [];
    this.save();
    log.info('All memory cleared');
  }

  private prune(): void {
    // Sort by importance * recency score, remove lowest
    const scored = this.entries.map(e => {
      const ageMs = Date.now() - e.lastAccessedAt;
      const recency = Math.max(0, 1 - ageMs / (30 * 24 * 60 * 60 * 1000)); // 30 days
      return {
        entry: e,
        score: e.importance * 0.6 + recency * 3 + Math.min(e.accessCount / 10, 1) * 1,
      };
    });

    scored.sort((a, b) => a.score - b.score);
    const removeCount = Math.floor(this.maxEntries * 0.2); // Remove bottom 20%
    const toRemove = new Set(scored.slice(0, removeCount).map(s => s.entry.id));
    this.entries = this.entries.filter(e => !toRemove.has(e.id));
    log.info(`Pruned ${removeCount} memory entries`);
  }

  private estimateTokens(text: string): number {
    // Rough estimate: ~4 chars per token
    return Math.ceil(text.length / 4);
  }
}
