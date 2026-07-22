/**
 * Console Store - Collects log messages for the Console panel.
 * Extensions and internal code can push entries here.
 */
import { create } from 'zustand';

export type ConsoleLevel = 'info' | 'warn' | 'error' | 'success';

export interface ConsoleEntry {
  id: string;
  timestamp: number;
  level: ConsoleLevel;
  source: string;
  message: string;
}

interface ConsoleState {
  entries: ConsoleEntry[];
  addEntry: (level: ConsoleLevel, source: string, message: string) => void;
  clear: () => void;
}

export const useConsoleStore = create<ConsoleState>((set) => ({
  entries: [],

  addEntry: (level, source, message) =>
    set((state) => ({
      entries: [
        ...state.entries,
        {
          id: `console-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
          level,
          source,
          message,
        },
      ],
    })),

  clear: () => set({ entries: [] }),
}));
