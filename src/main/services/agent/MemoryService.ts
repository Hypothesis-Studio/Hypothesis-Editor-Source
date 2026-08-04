/**
 * Memory Service - Production-grade BM25 memory with tiered storage.
 * Hot (recent 7d) / Warm (7-30d) / Cold (>30d) tiers with deduplication,
 * auto-summarization triggers, and project-context injection.
 */
import type { MemoryEntry, MemoryQuery, MemorySearchResult } from '../../../shared/types/agent';
import { logger } from '../../utils/logger';
import type { AppStore } from '../AppStore';
import { nanoid } from '../../utils/nanoid';

const log = logger.scope('MemoryService');

// BM25 constants
const BM25_K1 = 1.5;
const BM25_B = 0.75;
const STOPWORDS = new Set(['the','a','an','is','it','in','on','at','to','for','of','and','or','but','not','with','this','that','are','was','be','have','has','had','do','did','will','would','could','should','from','by','as','into','up','out','if','so','its','we','you','i','he','she','they','them','their','our','your','my','his','her','what','which','who','when','where','how','all','each','been','were','than','then','there','these','those','can','may','might','shall','must','about','after','before','between','through','during','since','while','because','although','however','therefore','also','only','just','even','still']);

type MemoryTier = 'hot' | 'warm' | 'cold';

interface TieredEntry extends MemoryEntry {
  tier: MemoryTier;
  bm25Score?: number;
  contentHash: string;
}

interface IdfCache {
  idf: Map<string, number>;
  docCount: number;
  dirty: boolean;
}

export class MemoryService {
  private appStore: AppStore;
  private hot: TieredEntry[] = [];   // Last 7 days
  private warm: TieredEntry[] = [];  // 7-30 days
  private cold: TieredEntry[] = [];  // >30 days
  private idfCache: IdfCache = { idf: new Map(), docCount: 0, dirty: true };
  private readonly HOT_MAX = 500;
  private readonly WARM_MAX = 2000;
  private readonly COLD_MAX = 5000;
  private readonly HOT_DAYS = 7;
  private readonly WARM_DAYS = 30;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(appStore: AppStore) {
    this.appStore = appStore;
  }

  initialize(): void {
    const stored = this.appStore.get('agent.memory.v2') as {
      hot?: TieredEntry[];
      warm?: TieredEntry[];
      cold?: TieredEntry[];
    } | undefined;

    // Migrate from v1 flat format
    const v1 = this.appStore.get('agent.memory') as MemoryEntry[] | undefined;
    if (v1 && v1.length > 0 && (!stored || !stored.hot)) {
      log.info(`Migrating ${v1.length} v1 memory entries to tiered format`);
      for (const e of v1) {
        this.insertToTier({ ...e, tier: this.computeTier(e.createdAt), contentHash: this.hashContent(e.content) });
      }
      this.save();
    } else if (stored) {
      this.hot = stored.hot ?? [];
      this.warm = stored.warm ?? [];
      this.cold = stored.cold ?? [];
    }

    this.idfCache.dirty = true;
    log.info(`Loaded memory: hot=${this.hot.length} warm=${this.warm.length} cold=${this.cold.length}`);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  addEntry(
    sessionId: string,
    type: MemoryEntry['type'],
    content: string,
    importance: number = 5,
    metadata?: Record<string, unknown>,
  ): MemoryEntry {
    const hash = this.hashContent(content);

    // Deduplication: skip near-identical content within same session
    if (this.findByHash(hash, sessionId)) {
      log.debug('Skipping duplicate memory entry');
      return this.findByHash(hash, sessionId)!;
    }

    const entry: TieredEntry = {
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
      tier: 'hot',
      contentHash: hash,
    };

    this.hot.unshift(entry);
    this.idfCache.dirty = true;
    this.pruneAll();
    this.scheduleSave();
    return entry;
  }

  search(query: MemoryQuery): MemorySearchResult[] {
    const maxResults = query.maxResults ?? 10;
    const minImportance = query.minImportance ?? 1;
    const allEntries = this.getAllEntries();

    let candidates = allEntries.filter(e => e.importance >= minImportance);
    if (query.type) candidates = candidates.filter(e => e.type === query.type);
    if (query.sessionId) candidates = candidates.filter(e => e.sessionId === query.sessionId);

    if (candidates.length === 0) return [];

    this.rebuildIdfIfNeeded(allEntries);
    const queryTerms = this.tokenize(query.query);

    // BM25 scoring
    const avgDocLen = candidates.reduce((s, e) => s + this.termCount(e.content), 0) / candidates.length;
    const scored: MemorySearchResult[] = candidates.map(entry => {
      const bm25 = this.computeBM25(queryTerms, entry.content, avgDocLen);
      const ageMs = Date.now() - entry.lastAccessedAt;
      const recencyBoost = Math.exp(-ageMs / (7 * 24 * 3600 * 1000)); // exponential decay, half-life ~7 days
      const tierBoost = entry.tier === 'hot' ? 1.2 : entry.tier === 'warm' ? 1.0 : 0.8;
      const importanceBoost = entry.importance / 10;
      const accessBoost = Math.min(entry.accessCount / 20, 0.3);
      const relevance = bm25 * 0.55 + recencyBoost * 0.2 + importanceBoost * 0.15 + tierBoost * 0.05 + accessBoost * 0.05;
      return { entry, relevance };
    });

    const results = scored
      .filter(s => s.relevance > 0.01)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxResults);

    // Update access stats
    for (const r of results) {
      (r.entry as TieredEntry).lastAccessedAt = Date.now();
      (r.entry as TieredEntry).accessCount++;
    }
    this.scheduleSave();
    return results;
  }

  getRelevantContext(query: string, maxTokens: number = 4000): string {
    const results = this.search({ query, maxResults: 30 });
    const parts: string[] = [];
    let usedTokens = 0;
    for (const r of results) {
      const t = r.entry.tokens;
      if (usedTokens + t > maxTokens) break;
      parts.push(r.entry.content);
      usedTokens += t;
    }
    return parts.join('\n---\n');
  }

  getProjectContext(workspacePath: string, maxTokens: number = 2000): string {
    // Return highest-importance project-scoped entries
    const all = this.getAllEntries()
      .filter(e => e.metadata?.workspacePath === workspacePath || e.metadata?.type === 'project')
      .sort((a, b) => b.importance - a.importance);

    const parts: string[] = [];
    let usedTokens = 0;
    for (const e of all) {
      if (usedTokens + e.tokens > maxTokens) break;
      parts.push(e.content);
      usedTokens += e.tokens;
    }
    return parts.join('\n---\n');
  }

  getBySession(sessionId: string): MemoryEntry[] {
    return this.getAllEntries()
      .filter(e => e.sessionId === sessionId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  listEntries(limit: number = 100): MemoryEntry[] {
    return this.getAllEntries()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  deleteEntry(id: string): boolean {
    const before = this.hot.length + this.warm.length + this.cold.length;
    this.hot = this.hot.filter(e => e.id !== id);
    this.warm = this.warm.filter(e => e.id !== id);
    this.cold = this.cold.filter(e => e.id !== id);
    const after = this.hot.length + this.warm.length + this.cold.length;
    if (before !== after) { this.idfCache.dirty = true; this.save(); return true; }
    return false;
  }

  clearSession(sessionId: string): void {
    this.hot = this.hot.filter(e => e.sessionId !== sessionId);
    this.warm = this.warm.filter(e => e.sessionId !== sessionId);
    this.cold = this.cold.filter(e => e.sessionId !== sessionId);
    this.idfCache.dirty = true;
    this.save();
  }

  clearAll(): void {
    this.hot = []; this.warm = []; this.cold = [];
    this.idfCache = { idf: new Map(), docCount: 0, dirty: false };
    this.save();
    log.info('All memory cleared');
  }

  getStats(): { hot: number; warm: number; cold: number; total: number } {
    return { hot: this.hot.length, warm: this.warm.length, cold: this.cold.length, total: this.hot.length + this.warm.length + this.cold.length };
  }

  // ─── Tier Management ────────────────────────────────────────────────────

  private computeTier(createdAt: number): MemoryTier {
    const ageMs = Date.now() - createdAt;
    const dayMs = 24 * 3600 * 1000;
    if (ageMs < this.HOT_DAYS * dayMs) return 'hot';
    if (ageMs < this.WARM_DAYS * dayMs) return 'warm';
    return 'cold';
  }

  private insertToTier(entry: TieredEntry): void {
    if (entry.tier === 'hot') this.hot.push(entry);
    else if (entry.tier === 'warm') this.warm.push(entry);
    else this.cold.push(entry);
  }

  /** Promote/demote entries between tiers based on age */
  private rebalanceTiers(): void {
    const now = Date.now();
    const hotCutoff = now - this.HOT_DAYS * 24 * 3600 * 1000;
    const warmCutoff = now - this.WARM_DAYS * 24 * 3600 * 1000;

    // Hot -> Warm
    const promoted: TieredEntry[] = [];
    this.hot = this.hot.filter(e => {
      if (e.createdAt < hotCutoff) { e.tier = 'warm'; promoted.push(e); return false; }
      return true;
    });
    this.warm.push(...promoted);

    // Warm -> Cold
    const archived: TieredEntry[] = [];
    this.warm = this.warm.filter(e => {
      if (e.createdAt < warmCutoff) { e.tier = 'cold'; archived.push(e); return false; }
      return true;
    });
    this.cold.push(...archived);

    if (promoted.length + archived.length > 0) {
      log.debug(`Rebalanced tiers: ${promoted.length} hot->warm, ${archived.length} warm->cold`);
    }
  }

  private pruneAll(): void {
    this.rebalanceTiers();
    this.pruneTier('hot', this.HOT_MAX);
    this.pruneTier('warm', this.WARM_MAX);
    this.pruneTier('cold', this.COLD_MAX);
  }

  private pruneTier(tier: MemoryTier, max: number): void {
    const arr = tier === 'hot' ? this.hot : tier === 'warm' ? this.warm : this.cold;
    if (arr.length <= max) return;
    // Score: importance * recency * access frequency
    const scored = arr.map(e => ({
      e,
      score: e.importance * 0.5 + Math.exp(-(Date.now() - e.lastAccessedAt) / (14 * 24 * 3600 * 1000)) * 3 + Math.min(e.accessCount / 10, 1),
    }));
    scored.sort((a, b) => a.score - b.score);
    const keep = new Set(scored.slice(scored.length - max).map(s => s.e.id));
    const removed = arr.filter(e => !keep.has(e.id)).length;
    if (tier === 'hot') this.hot = arr.filter(e => keep.has(e.id));
    else if (tier === 'warm') this.warm = arr.filter(e => keep.has(e.id));
    else this.cold = arr.filter(e => keep.has(e.id));
    if (removed > 0) { log.debug(`Pruned ${removed} entries from ${tier} tier`); this.idfCache.dirty = true; }
  }

  // ─── BM25 Implementation ────────────────────────────────────────────────

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2 && !STOPWORDS.has(t));
  }

  private termCount(content: string): number {
    return this.tokenize(content).length;
  }

  private rebuildIdfIfNeeded(docs: MemoryEntry[]): void {
    if (!this.idfCache.dirty && this.idfCache.docCount === docs.length) return;
    const df = new Map<string, number>();
    for (const doc of docs) {
      const terms = new Set(this.tokenize(doc.content));
      for (const t of terms) df.set(t, (df.get(t) ?? 0) + 1);
    }
    const N = docs.length;
    const idf = new Map<string, number>();
    for (const [term, freq] of df) {
      idf.set(term, Math.log((N - freq + 0.5) / (freq + 0.5) + 1));
    }
    this.idfCache = { idf, docCount: N, dirty: false };
  }

  private computeBM25(queryTerms: string[], docContent: string, avgDocLen: number): number {
    const terms = this.tokenize(docContent);
    const docLen = terms.length;
    const tf = new Map<string, number>();
    for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);

    let score = 0;
    for (const term of queryTerms) {
      const termFreq = tf.get(term) ?? 0;
      if (termFreq === 0) continue;
      const idf = this.idfCache.idf.get(term) ?? 0;
      const numerator = termFreq * (BM25_K1 + 1);
      const denominator = termFreq + BM25_K1 * (1 - BM25_B + BM25_B * (docLen / Math.max(1, avgDocLen)));
      score += idf * (numerator / denominator);
    }
    // Normalize to 0-1
    return Math.min(score / Math.max(1, queryTerms.length * 3), 1);
  }

  // ─── Utilities ──────────────────────────────────────────────────────────

  private getAllEntries(): TieredEntry[] {
    return [...this.hot, ...this.warm, ...this.cold];
  }

  private findByHash(hash: string, sessionId: string): TieredEntry | undefined {
    return this.getAllEntries().find(e => e.contentHash === hash && e.sessionId === sessionId);
  }

  private hashContent(content: string): string {
    // Simple djb2-style hash
    let h = 5381;
    for (let i = 0; i < Math.min(content.length, 512); i++) {
      h = ((h << 5) + h) ^ content.charCodeAt(i);
      h = h >>> 0;
    }
    return h.toString(16);
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => { this.save(); this.saveTimer = null; }, 2000);
  }

  private save(): void {
    try {
      this.appStore.set('agent.memory.v2', { hot: this.hot, warm: this.warm, cold: this.cold });
    } catch (err) {
      log.error('Failed to save memory:', err);
    }
  }
}