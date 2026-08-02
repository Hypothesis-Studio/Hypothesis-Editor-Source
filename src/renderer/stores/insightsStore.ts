/**
 * Project Insights Store - Zustand store for project analysis state.
 * Supports single-path and multi-root workspace scanning.
 */
import { create } from 'zustand';
import type { ProjectInsights, ScanProgress } from '../../shared/types/insights';

type SectionId = 'overview' | 'languages' | 'complexity' | 'dependencies' | 'security' | 'git' | 'health' | 'duplicates';

interface InsightsState {
  // Data
  insights: ProjectInsights | null;
  /** The path(s) last scanned. Array for multi-root, string for single. */
  projectPath: string | string[] | null;

  // Scan state
  isScanning: boolean;
  scanProgress: ScanProgress | null;
  lastScanError: string | null;

  // UI state
  activeSection: SectionId;
  expandedSections: Set<string>;

  // Actions
  scanProject: (projectPath: string | string[]) => Promise<void>;
  loadCached: (projectPath: string | string[]) => Promise<void>;
  clearCache: () => Promise<void>;
  setActiveSection: (section: SectionId) => void;
  toggleSection: (section: string) => void;
  reset: () => void;
}

export const useInsightsStore = create<InsightsState>((set, get) => ({
  insights: null,
  projectPath: null,
  isScanning: false,
  scanProgress: null,
  lastScanError: null,
  activeSection: 'overview',
  expandedSections: new Set(['overview']),

  /**
   * Trigger a full project scan. Accepts a single path or an array of paths
   * for multi-root workspaces. Listens for IPC progress events.
   */
  scanProject: async (projectPath: string | string[]) => {
    const api = (window as any).api;
    if (!api?.insights) return;

    set({ isScanning: true, scanProgress: null, lastScanError: null, projectPath });

    const unsubscribe = api.insights.onProgress((progress: ScanProgress) => {
      set({ scanProgress: progress });
    });

    try {
      const result = await api.insights.scanProject(projectPath);
      if (result.success && result.data) {
        set({
          insights: result.data,
          isScanning: false,
          scanProgress: { phase: 'complete', progress: 100, message: 'Scan complete' },
        });
      } else {
        set({ isScanning: false, lastScanError: result.error || 'Scan failed' });
      }
    } catch (error: any) {
      set({ isScanning: false, lastScanError: error?.message || String(error) });
    } finally {
      unsubscribe?.();
    }
  },

  /**
   * Load cached insights for the given path(s) without rescanning.
   * For multi-root, uses the serialised key of all paths joined.
   */
  loadCached: async (projectPath: string | string[]) => {
    const api = (window as any).api;
    if (!api?.insights) return;

    // Normalise: always pass what the main process expects
    const key = Array.isArray(projectPath) ? projectPath : projectPath;
    try {
      const result = await api.insights.getCached(key);
      if (result.success && result.data) {
        set({ insights: result.data, projectPath });
      }
    } catch {
      // Cache miss — silent
    }
  },

  clearCache: async () => {
    const api = (window as any).api;
    if (!api?.insights) return;
    const { projectPath } = get();
    try {
      await api.insights.clearCache(projectPath ?? undefined);
      set({ insights: null });
    } catch {
      // Silent
    }
  },

  setActiveSection: (section) => set({ activeSection: section }),

  toggleSection: (section) => {
    const { expandedSections } = get();
    const next = new Set(expandedSections);
    if (next.has(section)) next.delete(section);
    else next.add(section);
    set({ expandedSections: next });
  },

  reset: () => set({
    insights: null,
    projectPath: null,
    isScanning: false,
    scanProgress: null,
    lastScanError: null,
    activeSection: 'overview',
    expandedSections: new Set(['overview']),
  }),
}));
