/**
 * snippetStore.ts - Zustand store for user-defined code snippets.
 * Persists via window.api.settings under key "snippets.userSnippets".
 */
import { create } from 'zustand';
import type { Snippet } from '../../shared/types';
import builtinSnippets from '../assets/snippets_b1.json';

function genId(): string {
  return `snip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface SnippetStore {
  snippets: Snippet[];
  loaded: boolean;

  // CRUD
  loadSnippets: () => Promise<void>;
  addSnippet: (s: Omit<Snippet, 'id' | 'isBuiltin'>) => void;
  updateSnippet: (id: string, patch: Partial<Omit<Snippet, 'id' | 'isBuiltin'>>) => void;
  deleteSnippet: (id: string) => void;

  // Import / export
  importVSCodeSnippets: (json: string, scope: string) => { added: number; errors: string[] };
  exportVSCodeSnippets: (scope?: string) => string;
}

/** Persist user snippets to AppStore via IPC */
async function persist(userSnippets: Snippet[]) {
  try {
    const api = (window as any).api;
    await api?.snippets?.set?.(userSnippets);
  } catch (e) {
    console.warn('[SnippetStore] persist failed:', e);
  }
}

export const useSnippetStore = create<SnippetStore>((set, get) => ({
  snippets: [],
  loaded: false,

  loadSnippets: async () => {
    if (get().loaded) return;
    try {
      const api = (window as any).api;
      const stored: Snippet[] = (await api?.snippets?.get?.()) ?? [];
      const userSnippets = Array.isArray(stored) ? stored : [];

      // Merge builtin snippets (from assets) with user snippets
      const builtin = (builtinSnippets as Snippet[]).map(s => ({ ...s, isBuiltin: true }));
      set({ snippets: [...builtin, ...userSnippets], loaded: true });
    } catch {
      // Fallback: at least load builtins
      const builtin = (builtinSnippets as Snippet[]).map(s => ({ ...s, isBuiltin: true }));
      set({ snippets: builtin, loaded: true });
    }
  },

  addSnippet: (s) => {
    const snippet: Snippet = { ...s, id: genId(), isBuiltin: false };
    const next = [...get().snippets, snippet];
    set({ snippets: next });
    persist(get().snippets.filter(x => !x.isBuiltin));
  },

  updateSnippet: (id, patch) => {
    const next = get().snippets.map(s => s.id === id ? { ...s, ...patch } : s);
    set({ snippets: next });
    persist(next.filter(x => !x.isBuiltin));
  },

  deleteSnippet: (id) => {
    const next = get().snippets.filter(s => s.id !== id);
    set({ snippets: next });
    persist(next.filter(x => !x.isBuiltin));
  },

  importVSCodeSnippets: (json, scope) => {
    const errors: string[] = [];
    let added = 0;
    try {
      const parsed = JSON.parse(json);
      const existing = get().snippets;
      const toAdd: Snippet[] = [];

      for (const [name, raw] of Object.entries(parsed as Record<string, any>)) {
        if (!raw || typeof raw !== 'object') { errors.push(`Skip "${name}": not an object`); continue; }
        const prefix = typeof raw.prefix === 'string' ? raw.prefix
          : Array.isArray(raw.prefix) ? raw.prefix[0] : '';
        if (!prefix) { errors.push(`Skip "${name}": missing prefix`); continue; }
        const bodyLines: string[] = Array.isArray(raw.body)
          ? raw.body
          : typeof raw.body === 'string' ? raw.body.split('\n') : [];
        if (bodyLines.length === 0) { errors.push(`Skip "${name}": empty body`); continue; }

        // Skip exact duplicates (same prefix + scope)
        const dup = existing.find(e => e.prefix === prefix && (e.scope || '') === scope);
        if (dup) { errors.push(`Skip "${name}": duplicate prefix "${prefix}"`); continue; }

        toAdd.push({
          id: genId(),
          name,
          prefix,
          body: bodyLines,
          description: typeof raw.description === 'string' ? raw.description : '',
          scope,
          language: scope || undefined,
          isBuiltin: false,
        });
        added++;
      }

      if (toAdd.length > 0) {
        const next = [...existing, ...toAdd];
        set({ snippets: next });
        persist(next.filter(x => !x.isBuiltin));
      }
    } catch (e: any) {
      errors.push(`Parse error: ${e?.message || String(e)}`);
    }
    return { added, errors };
  },

  exportVSCodeSnippets: (scope) => {
    const snippets = scope
      ? get().snippets.filter(s => !s.isBuiltin && (s.scope === scope || s.language === scope))
      : get().snippets.filter(s => !s.isBuiltin);

    const out: Record<string, any> = {};
    for (const s of snippets) {
      out[s.name] = {
        prefix: s.prefix,
        body: Array.isArray(s.body) ? s.body : s.body.split('\n'),
        description: s.description || undefined,
        scope: s.scope || undefined,
      };
    }
    return JSON.stringify(out, null, 2);
  },
}));
