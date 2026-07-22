import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';

/**
 * EditorStore - Tests
 */
import { useEditorStore } from '../../stores/editorStore';
import type { EditorTab } from '../../../shared/types';

function createTestTab(overrides?: Partial<EditorTab>): EditorTab {
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    filePath: '/test/file.ts',
    fileName: 'file.ts',
    language: 'typescript',
    content: 'const x = 1;',
    isDirty: false,
    isPinned: false,
    isPreview: true,
    viewState: null,
    scrollTop: 0,
    scrollLeft: 0,
    cursorPosition: { line: 1, column: 1 },
    encoding: 'UTF-8',
    lineEnding: 'LF',
    savedContent: 'const x = 1;',
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    ...overrides,
  };
}

describe('EditorStore', () => {
  beforeEach(() => {
    // Reset store
    useEditorStore.setState({
      tabs: [],
      activeTabId: null,
      splits: [[]],
      activeSplitIndex: 0,
      cursorPosition: { line: 1, column: 1 },
      recentFiles: [],
      clipboardHistory: [],
      bookmarks: new Map(),
    });
  });

  describe('openTab', () => {
    it('should add a tab and set it as active', () => {
      const tab = createTestTab();
      useEditorStore.getState().openTab(tab);

      const state = useEditorStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].id).toBe(tab.id);
      expect(state.activeTabId).toBe(tab.id);
    });

    it('should not add duplicate tab for same file', () => {
      const tab1 = createTestTab({ filePath: '/test/file.ts' });
      const tab2 = createTestTab({ filePath: '/test/file.ts' });

      useEditorStore.getState().openTab(tab1);
      useEditorStore.getState().openTab(tab2);

      const state = useEditorStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.activeTabId).toBe(tab1.id);
    });

    it('should allow multiple untitled tabs', () => {
      const tab1 = createTestTab({ filePath: null, fileName: 'Untitled-1' });
      const tab2 = createTestTab({ filePath: null, fileName: 'Untitled-2' });

      useEditorStore.getState().openTab(tab1);
      useEditorStore.getState().openTab(tab2);

      const state = useEditorStore.getState();
      expect(state.tabs).toHaveLength(2);
    });
  });

  describe('closeTab', () => {
    it('should remove a tab', () => {
      const tab = createTestTab();
      useEditorStore.getState().openTab(tab);
      useEditorStore.getState().closeTab(tab.id);

      const state = useEditorStore.getState();
      expect(state.tabs).toHaveLength(0);
      expect(state.activeTabId).toBeNull();
    });

    it('should set next tab as active when closing active tab', () => {
      const tab1 = createTestTab({ filePath: '/test/1.ts' });
      const tab2 = createTestTab({ filePath: '/test/2.ts' });

      useEditorStore.getState().openTab(tab1);
      useEditorStore.getState().openTab(tab2);
      useEditorStore.getState().closeTab(tab2.id);

      const state = useEditorStore.getState();
      expect(state.activeTabId).toBe(tab1.id);
    });

    it('should handle closing all tabs', () => {
      const tab1 = createTestTab({ filePath: '/test/1.ts' });
      const tab2 = createTestTab({ filePath: '/test/2.ts' });

      useEditorStore.getState().openTab(tab1);
      useEditorStore.getState().openTab(tab2);
      useEditorStore.getState().closeTab(tab1.id);
      useEditorStore.getState().closeTab(tab2.id);

      const state = useEditorStore.getState();
      expect(state.tabs).toHaveLength(0);
      expect(state.activeTabId).toBeNull();
    });
  });

  describe('setActiveTab', () => {
    it('should set active tab', () => {
      const tab1 = createTestTab({ filePath: '/test/1.ts' });
      const tab2 = createTestTab({ filePath: '/test/2.ts' });

      useEditorStore.getState().openTab(tab1);
      useEditorStore.getState().openTab(tab2);
      useEditorStore.getState().setActiveTab(tab1.id);

      expect(useEditorStore.getState().activeTabId).toBe(tab1.id);
    });
  });

  describe('updateTab', () => {
    it('should update tab properties', () => {
      const tab = createTestTab();
      useEditorStore.getState().openTab(tab);
      useEditorStore.getState().updateTab(tab.id, { isDirty: true });

      expect(useEditorStore.getState().tabs[0].isDirty).toBe(true);
    });
  });

  describe('setTabDirty', () => {
    it('should set tab dirty state', () => {
      const tab = createTestTab();
      useEditorStore.getState().openTab(tab);
      useEditorStore.getState().setTabDirty(tab.id, true);

      expect(useEditorStore.getState().tabs[0].isDirty).toBe(true);
    });
  });

  describe('setTabPinned', () => {
    it('should set tab pinned state', () => {
      const tab = createTestTab();
      useEditorStore.getState().openTab(tab);
      useEditorStore.getState().setTabPinned(tab.id, true);

      expect(useEditorStore.getState().tabs[0].isPinned).toBe(true);
    });
  });

  describe('reorderTabs', () => {
    it('should reorder tabs', () => {
      const tab1 = createTestTab({ filePath: '/test/1.ts' });
      const tab2 = createTestTab({ filePath: '/test/2.ts' });
      const tab3 = createTestTab({ filePath: '/test/3.ts' });

      useEditorStore.getState().openTab(tab1);
      useEditorStore.getState().openTab(tab2);
      useEditorStore.getState().openTab(tab3);
      useEditorStore.getState().reorderTabs(0, 2);

      const tabs = useEditorStore.getState().tabs;
      expect(tabs[0].id).toBe(tab2.id);
      expect(tabs[1].id).toBe(tab3.id);
      expect(tabs[2].id).toBe(tab1.id);
    });
  });

  describe('splits', () => {
    it('should create horizontal split', () => {
      useEditorStore.getState().splitHorizontal();
      expect(useEditorStore.getState().splits).toHaveLength(2);
    });

    it('should create vertical split', () => {
      useEditorStore.getState().splitVertical();
      expect(useEditorStore.getState().splits).toHaveLength(2);
    });

    it('should close split', () => {
      useEditorStore.getState().splitHorizontal();
      useEditorStore.getState().closeSplit(1);
      expect(useEditorStore.getState().splits).toHaveLength(1);
    });

    it('should not close last split', () => {
      useEditorStore.getState().closeSplit(0);
      expect(useEditorStore.getState().splits).toHaveLength(1);
    });
  });

  describe('cursorPosition', () => {
    it('should set cursor position', () => {
      useEditorStore.getState().setCursorPosition({ line: 10, column: 5 });
      expect(useEditorStore.getState().cursorPosition).toEqual({ line: 10, column: 5 });
    });
  });

  describe('recentFiles', () => {
    it('should add recent file', () => {
      useEditorStore.getState().addRecentFile('/test/file.ts');
      expect(useEditorStore.getState().recentFiles).toContain('/test/file.ts');
    });

    it('should not add duplicate recent file', () => {
      useEditorStore.getState().addRecentFile('/test/file.ts');
      useEditorStore.getState().addRecentFile('/test/file.ts');
      expect(useEditorStore.getState().recentFiles).toHaveLength(1);
    });

    it('should limit recent files to 50', () => {
      for (let i = 0; i < 60; i++) {
        useEditorStore.getState().addRecentFile(`/test/file${i}.ts`);
      }
      expect(useEditorStore.getState().recentFiles).toHaveLength(50);
    });
  });

  describe('clipboardHistory', () => {
    it('should add to clipboard history', () => {
      useEditorStore.getState().addToClipboardHistory('test');
      expect(useEditorStore.getState().clipboardHistory).toContain('test');
    });

    it('should not add duplicate clipboard entry', () => {
      useEditorStore.getState().addToClipboardHistory('test');
      useEditorStore.getState().addToClipboardHistory('test');
      expect(useEditorStore.getState().clipboardHistory).toHaveLength(1);
    });

    it('should limit clipboard history to 100', () => {
      for (let i = 0; i < 110; i++) {
        useEditorStore.getState().addToClipboardHistory(`entry${i}`);
      }
      expect(useEditorStore.getState().clipboardHistory).toHaveLength(100);
    });
  });

  describe('bookmarks', () => {
    it('should toggle bookmark', () => {
      useEditorStore.getState().toggleBookmark('/test/file.ts', 5);
      expect(useEditorStore.getState().bookmarks.get('/test/file.ts')).toContain(5);

      useEditorStore.getState().toggleBookmark('/test/file.ts', 5);
      expect(useEditorStore.getState().bookmarks.get('/test/file.ts')).not.toContain(5);
    });

    it('should get bookmarks for file', () => {
      useEditorStore.getState().toggleBookmark('/test/file.ts', 5);
      useEditorStore.getState().toggleBookmark('/test/file.ts', 10);
      const bookmarks = useEditorStore.getState().getBookmarks('/test/file.ts');
      expect(bookmarks).toEqual([5, 10]);
    });

    it('should return empty array for unknown file', () => {
      const bookmarks = useEditorStore.getState().getBookmarks('/unknown/file.ts');
      expect(bookmarks).toEqual([]);
    });
  });
});
