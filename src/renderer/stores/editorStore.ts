/**
 * Editor Store - Manages editor tabs, splits, content, and exposes active editor actions.
 */
import { create } from 'zustand';
import type { EditorTab, CursorPosition } from '../../shared/types';
import type * as monaco from 'monaco-editor';

interface NavigationEntry {
  tabId: string;
  line: number;
  column: number;
}

interface EditorState {
  // Diff mode
  diffOriginalTabId: string | null;
  diffModifiedTabId: string | null;
  startDiff: (originalTabId: string, modifiedTabId: string) => void;
  exitDiffMode: () => void;

  // Tabs
  tabs: EditorTab[];
  activeTabId: string | null;
  openTab: (tab: EditorTab) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<EditorTab>) => void;
  setTabDirty: (tabId: string, isDirty: boolean) => void;
  setTabPinned: (tabId: string, isPinned: boolean) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;

  // Splits
  splits: string[][];
  activeSplitIndex: number;
  splitHorizontal: () => void;
  splitVertical: () => void;
  closeSplit: (index: number) => void;
  setActiveSplit: (index: number) => void;
  moveTabToSplit: (tabId: string, splitIndex: number) => void;

  // Editor state
  cursorPosition: CursorPosition;
  setCursorPosition: (position: CursorPosition) => void;

  // Active editor reference (for menu actions)
  activeEditor: monaco.editor.IStandaloneCodeEditor | null;
  setActiveEditor: (editor: monaco.editor.IStandaloneCodeEditor | null) => void;

  // Editor actions (called from menus/shortcuts)
  triggerUndo: () => void;
  triggerRedo: () => void;
  triggerCut: () => void;
  triggerCopy: () => void;
  triggerPaste: () => void;
  triggerFind: () => void;
  triggerReplace: () => void;
  triggerSelectAll: () => void;
  triggerFormat: () => void;
  triggerFormatSelection: () => void;
  triggerComment: () => void;
  triggerFoldAll: () => void;
  triggerUnfoldAll: () => void;
  triggerGoToLine: () => void;
  triggerGoToSymbol: () => void;
  triggerGoToDefinition: () => void;
  triggerPeekDefinition: () => void;
  triggerGoBack: () => void;
  triggerGoForward: () => void;
  pushNavigation: () => void;
  navigationStack: NavigationEntry[];
  navigationIndex: number;

  // Recent files
  recentFiles: string[];
  addRecentFile: (path: string) => void;

  // Clipboard history
  clipboardHistory: string[];
  addToClipboardHistory: (text: string) => void;

  // Bookmarks
  bookmarks: Map<string, number[]>;
  toggleBookmark: (filePath: string, line: number) => void;
  getBookmarks: (filePath: string) => number[];
}

export const useEditorStore = create<EditorState>((set, get) => ({
  // Diff mode
  diffOriginalTabId: null,
  diffModifiedTabId: null,
  startDiff: (originalTabId, modifiedTabId) => {
    set({ diffOriginalTabId: originalTabId, diffModifiedTabId: modifiedTabId });
  },
  exitDiffMode: () => {
    set({ diffOriginalTabId: null, diffModifiedTabId: null });
  },

  // Tabs
  tabs: [],
  activeTabId: null,

  openTab: (tab) =>
    set((state) => {
      // If file is already open, just activate it
      const existing = state.tabs.find((t) => t.filePath === tab.filePath && tab.filePath !== null);
      if (existing) {
        return { activeTabId: existing.id };
      }

      // Preview mode: replace an existing non-dirty, non-pinned preview tab
      if (tab.isPreview) {
        const previewIndex = state.tabs.findIndex((t) => t.isPreview && !t.isDirty && !t.isPinned);
        if (previewIndex !== -1) {
          const newTabs = [...state.tabs];
          newTabs[previewIndex] = tab;
          return { tabs: newTabs, activeTabId: tab.id };
        }
      }

      // Otherwise, add as new tab
      return { tabs: [...state.tabs, tab], activeTabId: tab.id };
    }),

  closeTab: (tabId) =>
    set((state) => {
      const index = state.tabs.findIndex((t) => t.id === tabId);
      const newTabs = state.tabs.filter((t) => t.id !== tabId);
      if (newTabs.length === 0) return { tabs: [], activeTabId: null };
      let newActiveId = state.activeTabId;
      if (state.activeTabId === tabId) {
        const newIndex = Math.min(index, newTabs.length - 1);
        newActiveId = newTabs[newIndex].id;
      }
      return { tabs: newTabs, activeTabId: newActiveId };
    }),

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  updateTab: (tabId, updates) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, ...updates } : t)),
    })),

  setTabDirty: (tabId, isDirty) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, isDirty } : t)),
    })),

  setTabPinned: (tabId, isPinned) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, isPinned } : t)),
    })),

  reorderTabs: (fromIndex, toIndex) =>
    set((state) => {
      const newTabs = [...state.tabs];
      const [moved] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, moved);
      return { tabs: newTabs };
    }),

  // Splits
  splits: [[]],
  activeSplitIndex: 0,

  splitHorizontal: () =>
    set((state) => ({
      splits: [...state.splits, []],
      activeSplitIndex: state.splits.length,
    })),

  splitVertical: () =>
    set((state) => ({
      splits: [...state.splits, []],
      activeSplitIndex: state.splits.length,
    })),

  closeSplit: (index) =>
    set((state) => {
      if (state.splits.length <= 1) return state;
      const newSplits = state.splits.filter((_, i) => i !== index);
      return {
        splits: newSplits,
        activeSplitIndex: Math.min(state.activeSplitIndex, newSplits.length - 1),
      };
    }),

  setActiveSplit: (index) => set({ activeSplitIndex: index }),

  moveTabToSplit: (tabId, splitIndex) =>
    set((state) => {
      const newSplits = state.splits.map((split) => split.filter((id) => id !== tabId));
      if (newSplits[splitIndex]) newSplits[splitIndex].push(tabId);
      return { splits: newSplits };
    }),

  // Editor state
  cursorPosition: { line: 1, column: 1 },
  setCursorPosition: (position) => set({ cursorPosition: position }),

  // Active editor reference
  activeEditor: null,
  setActiveEditor: (editor) => set({ activeEditor: editor }),

  // Navigation stack
  navigationStack: [],
  navigationIndex: -1,

  // ── Editor actions (delegate to Monaco) ─────────────────────────
  triggerUndo: () => {
    const editor = get().activeEditor;
    if (editor) {
      editor.trigger('menu', 'undo', undefined);
      editor.focus();
    }
  },

  triggerRedo: () => {
    const editor = get().activeEditor;
    if (editor) {
      editor.trigger('menu', 'redo', undefined);
      editor.focus();
    }
  },

  triggerCut: () => {
    const editor = get().activeEditor;
    if (editor) {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        const model = editor.getModel();
        if (model) {
          const text = model.getValueInRange(selection);
          navigator.clipboard.writeText(text).catch(() => {});
          editor.executeEdits('menu', [{ range: selection, text: '' }]);
        }
      }
      editor.focus();
    }
  },

  triggerCopy: () => {
    const editor = get().activeEditor;
    if (editor) {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        const model = editor.getModel();
        if (model) {
          const text = model.getValueInRange(selection);
          navigator.clipboard.writeText(text).catch(() => {});
        }
      }
      editor.focus();
    }
  },

  triggerPaste: () => {
    const editor = get().activeEditor;
    if (editor) {
      navigator.clipboard.readText().then((text) => {
        if (text) {
          const selection = editor.getSelection();
          if (selection) {
            editor.executeEdits('menu', [{ range: selection, text }]);
          }
        }
        editor.focus();
      }).catch(() => {});
    }
  },

  triggerFind: () => {
    const editor = get().activeEditor;
    if (editor) {
      editor.trigger('menu', 'actions.find', undefined);
      editor.focus();
    }
  },

  triggerReplace: () => {
    const editor = get().activeEditor;
    if (editor) {
      editor.trigger('menu', 'editor.action.startFindReplaceAction', undefined);
      editor.focus();
    }
  },

  triggerSelectAll: () => {
    const editor = get().activeEditor;
    if (editor) {
      const model = editor.getModel();
      if (model) {
        const lastLine = model.getLineCount();
        const lastCol = model.getLineMaxColumn(lastLine);
        editor.setSelection(new (window as any).monaco.Range(1, 1, lastLine, lastCol));
      }
      editor.focus();
    }
  },

  triggerFormat: () => {
    const editor = get().activeEditor;
    if (editor) {
      // Use the custom format function attached by MonacoEditor
      const fn = (editor as any).__hypothesis_formatDocument;
      if (fn) {
        fn(editor);
      } else {
        // Fallback to Monaco action trigger
        editor.trigger('menu', 'editor.action.formatDocument', undefined);
      }
      editor.focus();
    }
  },

  triggerFormatSelection: () => {
    const editor = get().activeEditor;
    if (editor) {
      const fn = (editor as any).__hypothesis_formatSelection;
      if (fn) {
        fn(editor);
      } else {
        editor.trigger('menu', 'editor.action.formatSelection', undefined);
      }
      editor.focus();
    }
  },

  triggerComment: () => {
    const editor = get().activeEditor;
    if (editor) {
      editor.trigger('menu', 'editor.action.commentLine', undefined);
      editor.focus();
    }
  },

  triggerFoldAll: () => {
    const editor = get().activeEditor;
    if (editor) {
      editor.trigger('menu', 'editor.foldAll', undefined);
      editor.focus();
    }
  },

  triggerUnfoldAll: () => {
    const editor = get().activeEditor;
    if (editor) {
      editor.trigger('menu', 'editor.unfoldAll', undefined);
      editor.focus();
    }
  },

  triggerGoToLine: () => {
    const editor = get().activeEditor;
    if (editor) {
      editor.focus();
      setTimeout(() => {
        const action = editor.getAction('editor.action.gotoLine');
        if (action) action.run();
      }, 50);
    }
  },

  triggerGoToSymbol: () => {
    const editor = get().activeEditor;
    if (editor) {
      editor.focus();
      setTimeout(() => {
        // Try multiple action IDs
        const actionIds = [
          'editor.action.quickOutline',
          'outline.quickOutline',
          'editor.action.gotoSymbol',
        ];
        for (const id of actionIds) {
          const action = editor.getAction(id);
          if (action) {
            action.run();
            return;
          }
        }
        // Fallback: use trigger
        editor.trigger('keyboard', 'editor.action.quickOutline', null);
      }, 50);
    }
  },

  triggerGoToDefinition: () => {
    const editor = get().activeEditor;
    if (editor) {
      get().pushNavigation();
      editor.focus();
      setTimeout(() => {
        const actionIds = [
          'editor.action.revealDefinition',
          'editor.action.goToDefinition',
          'editor.action.revealDefinitionAside',
        ];
        for (const id of actionIds) {
          const action = editor.getAction(id);
          if (action) {
            action.run();
            return;
          }
        }
        // Fallback
        editor.trigger('keyboard', 'editor.action.revealDefinition', null);
      }, 50);
    }
  },

  triggerPeekDefinition: () => {
    const editor = get().activeEditor;
    if (editor) {
      editor.focus();
      setTimeout(() => {
        const actionIds = [
          'editor.action.peekDefinition',
          'editor.action.previewDeclaration',
        ];
        for (const id of actionIds) {
          const action = editor.getAction(id);
          if (action) {
            action.run();
            return;
          }
        }
        // Fallback
        editor.trigger('keyboard', 'editor.action.peekDefinition', null);
      }, 50);
    }
  },

  pushNavigation: () => {
    const editor = get().activeEditor;
    const activeTabId = get().activeTabId;
    if (editor && activeTabId) {
      const pos = editor.getPosition();
      if (pos) {
        set((state) => {
          // Trim forward history
          const stack = state.navigationStack.slice(0, state.navigationIndex + 1);
          stack.push({ tabId: activeTabId, line: pos.lineNumber, column: pos.column });
          return { navigationStack: stack, navigationIndex: stack.length - 1 };
        });
      }
    }
  },

  triggerGoBack: () => {
    const { navigationStack, navigationIndex, setActiveTab, activeEditor } = get();
    if (navigationIndex > 0) {
      const entry = navigationStack[navigationIndex - 1];
      set({ navigationIndex: navigationIndex - 1 });
      setActiveTab(entry.tabId);
      setTimeout(() => {
        const editor = get().activeEditor;
        if (editor) {
          editor.setPosition({ lineNumber: entry.line, column: entry.column });
          editor.revealLineInCenter(entry.line);
          editor.focus();
        }
      }, 100);
    }
  },

  triggerGoForward: () => {
    const { navigationStack, navigationIndex, setActiveTab } = get();
    if (navigationIndex < navigationStack.length - 1) {
      const entry = navigationStack[navigationIndex + 1];
      set({ navigationIndex: navigationIndex + 1 });
      setActiveTab(entry.tabId);
      setTimeout(() => {
        const editor = get().activeEditor;
        if (editor) {
          editor.setPosition({ lineNumber: entry.line, column: entry.column });
          editor.revealLineInCenter(entry.line);
          editor.focus();
        }
      }, 100);
    }
  },

  // Recent files
  recentFiles: [],
  addRecentFile: (path) =>
    set((state) => {
      const filtered = state.recentFiles.filter((f) => f !== path);
      return { recentFiles: [path, ...filtered].slice(0, 50) };
    }),

  // Clipboard history
  clipboardHistory: [],
  addToClipboardHistory: (text) =>
    set((state) => {
      const filtered = state.clipboardHistory.filter((t) => t !== text);
      return { clipboardHistory: [text, ...filtered].slice(0, 100) };
    }),

  // Bookmarks
  bookmarks: new Map(),
  toggleBookmark: (filePath, line) =>
    set((state) => {
      const newBookmarks = new Map(state.bookmarks);
      const fileBookmarks = newBookmarks.get(filePath) || [];
      const index = fileBookmarks.indexOf(line);
      if (index >= 0) {
        fileBookmarks.splice(index, 1);
      } else {
        fileBookmarks.push(line);
        fileBookmarks.sort((a, b) => a - b);
      }
      newBookmarks.set(filePath, fileBookmarks);
      return { bookmarks: newBookmarks };
    }),
  getBookmarks: (filePath) => get().bookmarks.get(filePath) || [],
}));
