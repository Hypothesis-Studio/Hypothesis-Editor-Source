/**
 * keyboardShortcutStore.ts
 * Centralized keyboard shortcut definitions and customization store.
 * Persists overrides to localStorage; no IPC required.
 */
import { create } from 'zustand';

export interface ShortcutDef {
  id: string;
  label: string;
  category: string;
  description: string;
  defaultKeys: string;
  currentKeys: string;
  isChord?: boolean;
  chordKey?: string;
  scope?: 'global' | 'editor' | 'browser' | 'terminal';
}

const STORAGE_KEY = 'hypothesis:keyboard-shortcuts';

export const DEFAULT_SHORTCUTS: ShortcutDef[] = [
  // General
  { id: 'command-palette',      label: 'Command Palette',         category: 'General',            description: 'Open the command palette',                      defaultKeys: 'Ctrl+Shift+P', currentKeys: 'Ctrl+Shift+P' },
  { id: 'new-file',             label: 'New File',                category: 'General',            description: 'Create a new untitled file',                    defaultKeys: 'Ctrl+N',       currentKeys: 'Ctrl+N' },
  { id: 'open-file',            label: 'Open File',               category: 'General',            description: 'Open an existing file',                         defaultKeys: 'Ctrl+O',       currentKeys: 'Ctrl+O' },
  { id: 'open-folder',          label: 'Open Folder',             category: 'General',            description: 'Open a folder as workspace',                    defaultKeys: 'Ctrl+Shift+O', currentKeys: 'Ctrl+Shift+O' },
  { id: 'save',                 label: 'Save',                    category: 'General',            description: 'Save the current file',                         defaultKeys: 'Ctrl+S',       currentKeys: 'Ctrl+S' },
  { id: 'save-as',              label: 'Save As',                 category: 'General',            description: 'Save the current file with a new name',         defaultKeys: 'Ctrl+Shift+S', currentKeys: 'Ctrl+Shift+S' },
  { id: 'save-all',             label: 'Save All',                category: 'General',            description: 'Save all open files',                           defaultKeys: 'Ctrl+K S',     currentKeys: 'Ctrl+K S',     isChord: true, chordKey: 'S' },
  { id: 'close-tab',            label: 'Close Tab',               category: 'General',            description: 'Close the active editor tab',                   defaultKeys: 'Ctrl+W',       currentKeys: 'Ctrl+W' },
  { id: 'settings',             label: 'Settings',                category: 'General',            description: 'Open settings panel',                           defaultKeys: 'Ctrl+,',       currentKeys: 'Ctrl+,' },
  { id: 'fullscreen',           label: 'Full Screen',             category: 'General',            description: 'Toggle full screen mode',                       defaultKeys: 'F11',          currentKeys: 'F11' },
  { id: 'documentation',        label: 'Documentation',           category: 'General',            description: 'Open documentation',                            defaultKeys: 'F1',           currentKeys: 'F1' },
  { id: 'keyboard-shortcuts',   label: 'Keyboard Shortcuts',      category: 'General',            description: 'Open keyboard shortcuts reference',             defaultKeys: 'Ctrl+K Ctrl+S', currentKeys: 'Ctrl+K Ctrl+S', isChord: true, chordKey: 'S' },

  // Sidebar / Views
  { id: 'toggle-sidebar',       label: 'Toggle Sidebar',          category: 'Sidebar',            description: 'Show or hide the sidebar',                      defaultKeys: 'Ctrl+B',       currentKeys: 'Ctrl+B' },
  { id: 'toggle-panel',         label: 'Toggle Panel',            category: 'Sidebar',            description: 'Show or hide the bottom panel',                 defaultKeys: 'Ctrl+J',       currentKeys: 'Ctrl+J' },
  { id: 'toggle-terminal',      label: 'Toggle Terminal',         category: 'Sidebar',            description: 'Show or hide the integrated terminal',          defaultKeys: 'Ctrl+`',       currentKeys: 'Ctrl+`' },
  { id: 'new-terminal',         label: 'New Terminal',            category: 'Sidebar',            description: 'Open a new terminal instance',                  defaultKeys: 'Ctrl+Shift+`', currentKeys: 'Ctrl+Shift+`' },
  { id: 'view-explorer',        label: 'Explorer',                category: 'Sidebar',            description: 'Show the file explorer sidebar',                defaultKeys: 'Ctrl+Shift+E', currentKeys: 'Ctrl+Shift+E' },
  { id: 'view-search',          label: 'Search',                  category: 'Sidebar',            description: 'Show the search (find in files) sidebar',       defaultKeys: 'Ctrl+Shift+F', currentKeys: 'Ctrl+Shift+F' },
  { id: 'view-git',             label: 'Source Control',          category: 'Sidebar',            description: 'Show the source control (git) sidebar',         defaultKeys: 'Ctrl+Shift+G', currentKeys: 'Ctrl+Shift+G' },
  { id: 'view-agent',           label: 'AI Agent',                category: 'Sidebar',            description: 'Open the AI Agent panel',                       defaultKeys: 'Ctrl+Shift+A', currentKeys: 'Ctrl+Shift+A' },
  { id: 'view-rest-client',     label: 'REST Client',             category: 'Sidebar',            description: 'Open the REST Client panel',                    defaultKeys: 'Ctrl+Shift+R', currentKeys: 'Ctrl+Shift+R' },
  { id: 'view-database',        label: 'Database Explorer',       category: 'Sidebar',            description: 'Open the Database Explorer panel',              defaultKeys: 'Ctrl+Shift+D', currentKeys: 'Ctrl+Shift+D' },
  { id: 'view-browser',         label: 'Web Browser',             category: 'Sidebar',            description: 'Open the embedded Web Browser',                 defaultKeys: 'Ctrl+Shift+B', currentKeys: 'Ctrl+Shift+B' },
  { id: 'view-extensions',      label: 'Extensions',              category: 'Sidebar',            description: 'Show the extensions sidebar',                   defaultKeys: 'Ctrl+Shift+X', currentKeys: 'Ctrl+Shift+X' },
  { id: 'zen-mode',             label: 'Zen Mode',                category: 'Sidebar',            description: 'Toggle distraction-free zen mode',              defaultKeys: 'Ctrl+Shift+Z', currentKeys: 'Ctrl+Shift+Z' },

  // Editing
  { id: 'undo',                 label: 'Undo',                    category: 'Editing',            description: 'Undo the last change',                          defaultKeys: 'Ctrl+Z',       currentKeys: 'Ctrl+Z',       scope: 'editor' },
  { id: 'redo',                 label: 'Redo',                    category: 'Editing',            description: 'Redo the last undone change',                   defaultKeys: 'Ctrl+Y',       currentKeys: 'Ctrl+Y',       scope: 'editor' },
  { id: 'cut',                  label: 'Cut',                     category: 'Editing',            description: 'Cut selection to clipboard',                    defaultKeys: 'Ctrl+X',       currentKeys: 'Ctrl+X',       scope: 'editor' },
  { id: 'copy',                 label: 'Copy',                    category: 'Editing',            description: 'Copy selection to clipboard',                   defaultKeys: 'Ctrl+C',       currentKeys: 'Ctrl+C',       scope: 'editor' },
  { id: 'paste',                label: 'Paste',                   category: 'Editing',            description: 'Paste from clipboard',                          defaultKeys: 'Ctrl+V',       currentKeys: 'Ctrl+V',       scope: 'editor' },
  { id: 'select-all',           label: 'Select All',              category: 'Editing',            description: 'Select all text in the editor',                 defaultKeys: 'Ctrl+A',       currentKeys: 'Ctrl+A',       scope: 'editor' },
  { id: 'toggle-comment',       label: 'Toggle Comment',          category: 'Editing',            description: 'Toggle line or block comment',                  defaultKeys: 'Ctrl+/',       currentKeys: 'Ctrl+/',       scope: 'editor' },
  { id: 'toggle-word-wrap',     label: 'Toggle Word Wrap',        category: 'Editing',            description: 'Toggle word wrap in the editor',                defaultKeys: 'Alt+Z',        currentKeys: 'Alt+Z',        scope: 'editor' },
  { id: 'format-document',      label: 'Format Document',         category: 'Editing',            description: 'Format the entire document',                    defaultKeys: 'Shift+Alt+F',  currentKeys: 'Shift+Alt+F',  scope: 'editor' },
  { id: 'ai-inline-edit',       label: 'AI Edit Selection',       category: 'Editing',            description: 'Edit all selected code blocks with AI simultaneously', defaultKeys: 'Ctrl+K Ctrl+K', currentKeys: 'Ctrl+K Ctrl+K', isChord: true, chordKey: 'K', scope: 'editor' },
  { id: 'run-file',             label: 'Run File',                category: 'Editing',            description: 'Run the current file',                          defaultKeys: 'Ctrl+F5',      currentKeys: 'Ctrl+F5' },
  { id: 'stop-process',         label: 'Stop Process',            category: 'Editing',            description: 'Stop the running process',                      defaultKeys: 'Shift+F5',     currentKeys: 'Shift+F5' },
  { id: 'restart-process',      label: 'Restart Process',         category: 'Editing',            description: 'Restart the running process',                   defaultKeys: 'Ctrl+Shift+F5',currentKeys: 'Ctrl+Shift+F5' },
  { id: 'kill-terminal',        label: 'Kill Terminal',           category: 'Sidebar',            description: 'Kill the active terminal instance',             defaultKeys: 'Ctrl+Shift+Delete', currentKeys: 'Ctrl+Shift+Delete' },
  { id: 'close-folder',         label: 'Close Folder',            category: 'General',            description: 'Close the current workspace folder',           defaultKeys: 'Ctrl+K F',     currentKeys: 'Ctrl+K F',     isChord: true, chordKey: 'F' },
  { id: 'rename-file',          label: 'Rename File',             category: 'General',            description: 'Rename the selected file in explorer',         defaultKeys: 'F2',           currentKeys: 'F2' },

  // Screenshot
  { id: 'screenshot-visible',   label: 'Screenshot Visible Code', category: 'Screenshot',         description: 'Capture visible code in editor',               defaultKeys: 'Ctrl+Shift+C', currentKeys: 'Ctrl+Shift+C' },
  { id: 'screenshot-full',      label: 'Screenshot Full Code',    category: 'Screenshot',         description: 'Capture entire code in current tab',           defaultKeys: 'Ctrl+Shift+Alt+C', currentKeys: 'Ctrl+Shift+Alt+C' },
  { id: 'screenshot-selection', label: 'Screenshot Selection',    category: 'Screenshot',         description: 'Capture selected code block only',             defaultKeys: 'Ctrl+K Ctrl+C', currentKeys: 'Ctrl+K Ctrl+C', isChord: true, chordKey: 'C', scope: 'editor' },

  // Search & Navigation
  { id: 'find',                 label: 'Find',                    category: 'Search & Navigation', description: 'Find text in the current file',                defaultKeys: 'Ctrl+F',       currentKeys: 'Ctrl+F',       scope: 'editor' },
  { id: 'replace',              label: 'Find & Replace',          category: 'Search & Navigation', description: 'Find and replace text in the current file',    defaultKeys: 'Ctrl+H',       currentKeys: 'Ctrl+H',       scope: 'editor' },
  { id: 'quick-open',           label: 'Quick Open',              category: 'Search & Navigation', description: 'Go to file by name',                           defaultKeys: 'Ctrl+P',       currentKeys: 'Ctrl+P' },
  { id: 'go-to-line',           label: 'Go to Line',              category: 'Search & Navigation', description: 'Jump to a specific line number',               defaultKeys: 'Ctrl+G',       currentKeys: 'Ctrl+G',       scope: 'editor' },
  { id: 'go-to-symbol',         label: 'Go to Symbol',            category: 'Search & Navigation', description: 'Navigate to a symbol in the current file',     defaultKeys: 'Ctrl+Shift+M', currentKeys: 'Ctrl+Shift+M', scope: 'editor' },
  { id: 'go-to-definition',     label: 'Go to Definition',        category: 'Search & Navigation', description: 'Jump to the definition of the symbol',         defaultKeys: 'F12',          currentKeys: 'F12',          scope: 'editor' },
  { id: 'peek-definition',      label: 'Peek Definition',         category: 'Search & Navigation', description: 'Peek at the definition inline',                defaultKeys: 'Alt+F12',      currentKeys: 'Alt+F12',      scope: 'editor' },
  { id: 'navigate-back',        label: 'Navigate Back',           category: 'Search & Navigation', description: 'Go back in navigation history',                defaultKeys: 'Alt+Left',     currentKeys: 'Alt+Left',     scope: 'editor' },
  { id: 'navigate-forward',     label: 'Navigate Forward',        category: 'Search & Navigation', description: 'Go forward in navigation history',             defaultKeys: 'Alt+Right',    currentKeys: 'Alt+Right',    scope: 'editor' },
];

// ── Key parsing helpers ───────────────────────────────────────────────────────

interface ParsedKeys {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  key: string;
}

export function parseKeys(combo: string): ParsedKeys {
  const parts = combo.split('+');
  const key = parts[parts.length - 1];
  return {
    ctrl:  parts.includes('Ctrl'),
    shift: parts.includes('Shift'),
    alt:   parts.includes('Alt'),
    meta:  parts.includes('Meta') || parts.includes('Cmd'),
    key:   normalizeKey(key),
  };
}

function normalizeKey(raw: string): string {
  const map: Record<string, string> = {
    'Left': 'ArrowLeft', 'Right': 'ArrowRight', 'Up': 'ArrowUp', 'Down': 'ArrowDown',
    '`': '`', ',': ',', '/': '/', 'Space': ' ', 'Backspace': 'Backspace',
    'Delete': 'Delete', 'Escape': 'Escape', 'Enter': 'Enter', 'Tab': 'Tab',
  };
  return map[raw] ?? raw;
}

function eventMatchesParsed(e: KeyboardEvent, p: ParsedKeys): boolean {
  const eKey = e.key === ' ' ? ' ' : e.key;
  return (
    (e.ctrlKey || e.metaKey) === (p.ctrl || p.meta) &&
    e.shiftKey === p.shift &&
    e.altKey   === p.alt &&
    eKey.toLowerCase() === p.key.toLowerCase()
  );
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface KeyboardShortcutState {
  shortcuts: ShortcutDef[];
  getShortcut: (id: string) => ShortcutDef | undefined;
  setShortcut: (id: string, keys: string) => void;
  resetShortcut: (id: string) => void;
  resetAll: () => void;
  matchShortcut: (e: KeyboardEvent) => string | null;
}

function loadOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOverrides(shortcuts: ShortcutDef[]) {
  const overrides: Record<string, string> = {};
  for (const s of shortcuts) {
    if (s.currentKeys !== s.defaultKeys) {
      overrides[s.id] = s.currentKeys;
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

function buildInitialShortcuts(): ShortcutDef[] {
  const overrides = loadOverrides();
  return DEFAULT_SHORTCUTS.map(s => ({
    ...s,
    currentKeys: overrides[s.id] ?? s.defaultKeys,
  }));
}

export const useKeyboardShortcutStore = create<KeyboardShortcutState>((set, get) => ({
  shortcuts: buildInitialShortcuts(),

  getShortcut(id) {
    return get().shortcuts.find(s => s.id === id);
  },

  setShortcut(id, keys) {
    set(state => {
      const shortcuts = state.shortcuts.map(s =>
        s.id === id ? { ...s, currentKeys: keys } : s,
      );
      saveOverrides(shortcuts);
      return { shortcuts };
    });
  },

  resetShortcut(id) {
    set(state => {
      const shortcuts = state.shortcuts.map(s =>
        s.id === id ? { ...s, currentKeys: s.defaultKeys } : s,
      );
      saveOverrides(shortcuts);
      return { shortcuts };
    });
  },

  resetAll() {
    set(state => {
      const shortcuts = state.shortcuts.map(s => ({ ...s, currentKeys: s.defaultKeys }));
      localStorage.removeItem(STORAGE_KEY);
      return { shortcuts };
    });
  },

  matchShortcut(e: KeyboardEvent): string | null {
    const { shortcuts } = get();
    for (const s of shortcuts) {
      if (s.isChord) continue; // chord shortcuts handled manually in App.tsx
      try {
        const parsed = parseKeys(s.currentKeys);
        if (eventMatchesParsed(e, parsed)) return s.id;
      } catch {
        // malformed key combo — skip
      }
    }
    return null;
  },
}));
