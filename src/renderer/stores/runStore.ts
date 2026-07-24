/**
 * Run Store - Manages script execution state and output for panels.
 * Bridges run:execute IPC events to Console, Output, and Problems panels.
 * Event listeners are registered globally so output is captured even when
 * the Panel component is not yet mounted.
 */
import { create } from 'zustand';
import { useConsoleStore } from './consoleStore';

export type RunOutputType = 'stdout' | 'stderr' | 'system';
export type RunStatus = 'idle' | 'running' | 'success' | 'error' | 'killed';

export interface RunOutputEntry {
  id: string;
  runId: string;
  type: RunOutputType;
  text: string;
  timestamp: number;
}

export interface ProblemEntry {
  id: string;
  runId: string;
  file: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  source: string;
  timestamp: number;
}

export interface RunInstance {
  runId: string;
  command: string;
  pid: number;
  status: RunStatus;
  startedAt: number;
  exitedAt?: number;
  exitCode?: number | null;
  signal?: string | null;
}

interface RunState {
  // Current state
  status: RunStatus;
  activeRunId: string | null;
  runs: RunInstance[];
  
  // Output buffers
  outputEntries: RunOutputEntry[];
  problems: ProblemEntry[];
  
  // Console entries (unified log from all sources)
  consoleEntries: RunOutputEntry[];
  
  // Actions
  startRun: (runId: string, command: string, pid: number) => void;
  addStdout: (runId: string, data: string) => void;
  addStderr: (runId: string, data: string) => void;
  endRun: (runId: string, exitCode: number | null, signal: string | null) => void;
  errorRun: (runId: string, error: string) => void;
  killRun: (runId: string) => void;
  
  // Clear actions
  clearOutput: () => void;
  clearProblems: () => void;
  clearConsole: () => void;
  clearAll: () => void;
  
  // Getters
  getActiveRun: () => RunInstance | null;
  getRunOutput: (runId: string) => RunOutputEntry[];
  getRunProblems: (runId: string) => ProblemEntry[];
}

let entryCounter = 0;
const nextId = () => `entry-${++entryCounter}-${Date.now()}`;

/**
 * Parse stderr/output for common error/warning patterns.
 * Returns structured problem entries when detected.
 */
function parseProblems(text: string, runId: string): ProblemEntry[] {
  const problems: ProblemEntry[] = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // Node.js error patterns
    // SyntaxError: ... at <file>:<line>:<col>
    const nodeError = line.match(/^(SyntaxError|TypeError|ReferenceError|RangeError|Error|URIError|EvalError|InternalError):\s*(.+?)(?:\s+at\s+(.+):(\d+):(\d+))?$/);
    if (nodeError) {
      problems.push({
        id: nextId(),
        runId,
        file: nodeError[3] || '',
        line: parseInt(nodeError[4] || '0', 10),
        column: parseInt(nodeError[5] || '0', 10),
        message: `${nodeError[1]}: ${nodeError[2]}`,
        severity: 'error',
        source: 'node',
        timestamp: Date.now(),
      });
      continue;
    }
    
    // at <file>:<line>:<col>
    const stackLine = line.match(/^\s+at\s+.+?\s+\((.+):(\d+):(\d+)\)/);
    if (stackLine) {
      problems.push({
        id: nextId(),
        runId,
        file: stackLine[1],
        line: parseInt(stackLine[2], 10),
        column: parseInt(stackLine[3], 10),
        message: line.trim(),
        severity: 'error',
        source: 'stack',
        timestamp: Date.now(),
      });
      continue;
    }
    
    // Python error: File "<file>", line <N>
    const pythonError = line.match(/^\s*File "(.+)", line (\d+)/);
    if (pythonError) {
      problems.push({
        id: nextId(),
        runId,
        file: pythonError[1],
        line: parseInt(pythonError[2], 10),
        column: 0,
        message: line.trim(),
        severity: 'error',
        source: 'python',
        timestamp: Date.now(),
      });
      continue;
    }
    
    // Generic warning pattern: <file>:<line>:<col>: warning: <message>
    const warningMatch = line.match(/^(.+?):(\d+):(\d+):\s*(warning|error|note):\s*(.+)$/i);
    if (warningMatch) {
      problems.push({
        id: nextId(),
        runId,
        file: warningMatch[1],
        line: parseInt(warningMatch[2], 10),
        column: parseInt(warningMatch[3], 10),
        message: warningMatch[5],
        severity: warningMatch[4].toLowerCase() as 'error' | 'warning' | 'info',
        source: 'compiler',
        timestamp: Date.now(),
      });
      continue;
    }
    
    // Unhandled rejection / uncaught exception
    if (line.includes('UnhandledPromiseRejection') || line.includes('unhandledRejection') || line.includes('Uncaught')) {
      problems.push({
        id: nextId(),
        runId,
        file: '',
        line: 0,
        column: 0,
        message: line.trim(),
        severity: 'error',
        source: 'runtime',
        timestamp: Date.now(),
      });
    }
  }
  
  return problems;
}

export const useRunStore = create<RunState>((set, get) => ({
  status: 'idle',
  activeRunId: null,
  runs: [],
  outputEntries: [],
  problems: [],
  consoleEntries: [],

  startRun: (runId, command, pid) => {
    const run: RunInstance = {
      runId,
      command,
      pid,
      status: 'running',
      startedAt: Date.now(),
    };
    set((state) => ({
      status: 'running',
      activeRunId: runId,
      runs: [...state.runs, run],
      // Add system message to output
      outputEntries: [...state.outputEntries, {
        id: nextId(),
        runId,
        type: 'system',
        text: `▶ Running: ${command}`,
        timestamp: Date.now(),
      }],
      consoleEntries: [...state.consoleEntries, {
        id: nextId(),
        runId,
        type: 'system',
        text: `▶ Running: ${command}`,
        timestamp: Date.now(),
      }],
    }));
  },

  addStdout: (runId, data) => {
    const entry: RunOutputEntry = {
      id: nextId(),
      runId,
      type: 'stdout',
      text: data,
      timestamp: Date.now(),
    };
    set((state) => ({
      outputEntries: [...state.outputEntries, entry],
      consoleEntries: [...state.consoleEntries, entry],
    }));
  },

  addStderr: (runId, data) => {
    const entry: RunOutputEntry = {
      id: nextId(),
      runId,
      type: 'stderr',
      text: data,
      timestamp: Date.now(),
    };
    
    // Parse stderr for structured problems
    const newProblems = parseProblems(data, runId);
    
    set((state) => ({
      outputEntries: [...state.outputEntries, entry],
      consoleEntries: [...state.consoleEntries, entry],
      problems: [...state.problems, ...newProblems],
    }));
  },

  endRun: (runId, exitCode, signal) => {
    const success = exitCode === 0;
    const exitMsg = signal
      ? `⚑ Process killed (signal: ${signal})`
      : success
        ? `✔ Process exited with code 0`
        : `✖ Process exited with code ${exitCode}`;
    
    const exitEntry: RunOutputEntry = {
      id: nextId(),
      runId,
      type: 'system',
      text: exitMsg,
      timestamp: Date.now(),
    };
    
    set((state) => ({
      status: success ? 'success' : 'error',
      activeRunId: state.activeRunId === runId ? null : state.activeRunId,
      runs: state.runs.map(r => r.runId === runId ? { ...r, status: success ? 'success' as const : 'error' as const, exitedAt: Date.now(), exitCode, signal } : r),
      outputEntries: [...state.outputEntries, exitEntry],
      consoleEntries: [...state.consoleEntries, exitEntry],
    }));
  },

  errorRun: (runId, error) => {
    const errorEntry: RunOutputEntry = {
      id: nextId(),
      runId,
      type: 'stderr',
      text: `Error: ${error}`,
      timestamp: Date.now(),
    };
    
    set((state) => ({
      status: 'error',
      activeRunId: state.activeRunId === runId ? null : state.activeRunId,
      runs: state.runs.map(r => r.runId === runId ? { ...r, status: 'error' as const, exitedAt: Date.now() } : r),
      outputEntries: [...state.outputEntries, errorEntry],
      consoleEntries: [...state.consoleEntries, errorEntry],
      problems: [...state.problems, {
        id: nextId(),
        runId,
        file: '',
        line: 0,
        column: 0,
        message: error,
        severity: 'error' as const,
        source: 'runner',
        timestamp: Date.now(),
      }],
    }));
  },

  killRun: (runId) => {
    set((state) => ({
      status: 'killed',
      activeRunId: state.activeRunId === runId ? null : state.activeRunId,
      runs: state.runs.map(r => r.runId === runId ? { ...r, status: 'killed' as const, exitedAt: Date.now() } : r),
      outputEntries: [...state.outputEntries, {
        id: nextId(),
        runId,
        type: 'system',
        text: '⚑ Process killed by user',
        timestamp: Date.now(),
      }],
    }));
  },

  clearOutput: () => set({ outputEntries: [] }),
  clearProblems: () => set({ problems: [] }),
  clearConsole: () => set({ consoleEntries: [] }),
  clearAll: () => set({ outputEntries: [], problems: [], consoleEntries: [] }),

  getActiveRun: () => {
    const state = get();
    return state.runs.find(r => r.runId === state.activeRunId) || null;
  },

  getRunOutput: (runId) => {
    return get().outputEntries.filter(e => e.runId === runId);
  },

  getRunProblems: (runId) => {
    return get().problems.filter(p => p.runId === runId);
  },
}));

/**
 * Register global IPC listeners for run events.
 * Called once at app startup so output is captured even if Panel is not mounted.
 */
export function initRunListeners(): void {
  const api = (window as any).api;
  if (!api?.run) return;

  const store = useRunStore.getState();

  api.run.onStarted((data: { runId: string; command: string; pid: number }) => {
    store.startRun(data.runId, data.command, data.pid);
  });

  api.run.onStdout((data: { runId: string; data: string }) => {
    store.addStdout(data.runId, data.data);
    useConsoleStore.getState().addEntry('info', 'stdout', data.data);
  });

  api.run.onStderr((data: { runId: string; data: string }) => {
    store.addStderr(data.runId, data.data);
    useConsoleStore.getState().addEntry('error', 'stderr', data.data);
  });

  api.run.onExit((data: { runId: string; exitCode: number | null; signal: string | null }) => {
    store.endRun(data.runId, data.exitCode, data.signal);
    const success = data.exitCode === 0;
    useConsoleStore.getState().addEntry(
      success ? 'success' : 'error',
      'runner',
      data.signal
        ? `Process killed (signal: ${data.signal})`
        : `Process exited with code ${data.exitCode}`
    );
  });

  api.run.onError((data: { runId: string; error: string }) => {
    store.errorRun(data.runId, data.error);
    useConsoleStore.getState().addEntry('error', 'runner', data.error);
  });
}
