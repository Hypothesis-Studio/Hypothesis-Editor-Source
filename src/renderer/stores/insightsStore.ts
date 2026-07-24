/**
 * Project Insights Store - Zustand store for project analysis state.
 * Manages scan lifecycle, progress tracking, and cached results.
 */
import { create } from 'zustand';
import type { ProjectInsights, ScanProgress, INSIGHTS_CHANNELS } from '../../shared/types/insights';

interface InsightsState {
  // Data
  insights: ProjectInsights | null;
  projectPath: string | null;

  // Scan state
  isScanning: boolean;
  scanProgress: ScanProgress | null;
  lastScanError: string | null;

  // UI state
  activeSection: 'overview' | 'languages' | 'complexity' | 'dependencies' | 'security' | 'git' | 'health' | 'duplicates';
  expandedSections: Set<string>;

  // Actions
  scanProject: (projectPath: string) => Promise<void>;
  loadCached: (projectPath: string) => Promise<void>;
  clearCache: () => Promise<void>;
  setActiveSection: (section: InsightsState['activeSection']) => void;
  toggleSection: (section: string) => void;
  reset: () => void;
}

export const useInsightsStore = create<InsightsState>((set, get) => ({
  // Initial state
  insights: null,
  projectPath: null,
  isScanning: false,
  scanProgress: null,
  lastScanError: null,
  activeSection: 'overview',
  expandedSections: new Set(['overview']),

  /**
   * Trigger a full project scan. Listens for progress events.
   */
  scanProject: async (projectPath: string) => {
    const api = (window as any).api;
    if (!api?.insights) return;

    set({ isScanning: true, scanProgress: null, lastScanError: null, projectPath });

    // Register progress listener
    const unsubscribe = api.insights.onProgress((progress: ScanProgress) => {
      set({ scanProgress: progress });
    });

    try {
      const result = await api.insights.scanProject(projectPath);
      if (result.success && result.data) {
        set({ insights: result.data, isScanning: false, scanProgress: { phase: 'complete', progress: 100, message: 'Scan complete' } });
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
   * Load cached insights without triggering a new scan.
   */
  loadCached: async (projectPath: string) => {
    const api = (window as any).api;
    if (!api?.insights) return;

    try {
      const result = await api.insights.getCached(projectPath);
      if (result.success && result.data) {
        set({ insights: result.data, projectPath });
      }
    } catch {
      // Silent fail — cache miss is expected
    }
  },

  /**
   * Clear cached insights on the main process side.
   */
  clearCache: async () => {
    const api = (window as any).api;
    if (!api?.insights) return;
    const { projectPath } = get();
    try {
      await api.insights.clearCache(projectPath || undefined);
      set({ insights: null });
    } catch {
      // Silent fail
    }
  },

  setActiveSection: (section) => set({ activeSection: section }),

  toggleSection: (section) => {
    const { expandedSections } = get();
    const next = new Set(expandedSections);
    if (next.has(section)) {
      next.delete(section);
    } else {
      next.add(section);
    }
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
