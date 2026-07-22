import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';

/**
 * AppStore - Tests
 */
import { useAppStore } from '../../stores/appStore';

describe('AppStore', () => {
  beforeEach(() => {
    // Reset store
    useAppStore.setState({
      sidebarVisible: true,
      activeSidebarView: 'explorer',
      sidebarWidth: 260,
      panelVisible: false,
      activePanel: 'terminal',
      panelHeight: 250,
      commandPaletteVisible: false,
      currentTheme: 'hypothesis-dark',
      isMaximized: false,
      isLoading: true,
      statusMessage: null,
      statusType: 'info',
    });
  });

  describe('sidebar', () => {
    it('should toggle sidebar visibility', () => {
      expect(useAppStore.getState().sidebarVisible).toBe(true);
      useAppStore.getState().toggleSidebar();
      expect(useAppStore.getState().sidebarVisible).toBe(false);
      useAppStore.getState().toggleSidebar();
      expect(useAppStore.getState().sidebarVisible).toBe(true);
    });

    it('should set active sidebar view', () => {
      useAppStore.getState().setActiveSidebarView('search');
      expect(useAppStore.getState().activeSidebarView).toBe('search');
    });

    it('should toggle sidebar when same view is set', () => {
      useAppStore.getState().setActiveSidebarView('explorer');
      expect(useAppStore.getState().sidebarVisible).toBe(false);
    });

    it('should set sidebar width', () => {
      useAppStore.getState().setSidebarWidth(300);
      expect(useAppStore.getState().sidebarWidth).toBe(300);
    });
  });

  describe('panel', () => {
    it('should toggle panel visibility', () => {
      expect(useAppStore.getState().panelVisible).toBe(false);
      useAppStore.getState().togglePanel();
      expect(useAppStore.getState().panelVisible).toBe(true);
    });

    it('should set active panel', () => {
      useAppStore.getState().setActivePanel('output');
      expect(useAppStore.getState().activePanel).toBe('output');
    });

    it('should set panel height', () => {
      useAppStore.getState().setPanelHeight(300);
      expect(useAppStore.getState().panelHeight).toBe(300);
    });
  });

  describe('command palette', () => {
    it('should toggle command palette', () => {
      expect(useAppStore.getState().commandPaletteVisible).toBe(false);
      useAppStore.getState().toggleCommandPalette();
      expect(useAppStore.getState().commandPaletteVisible).toBe(true);
    });

    it('should show command palette', () => {
      useAppStore.getState().showCommandPalette();
      expect(useAppStore.getState().commandPaletteVisible).toBe(true);
    });

    it('should hide command palette', () => {
      useAppStore.getState().showCommandPalette();
      useAppStore.getState().hideCommandPalette();
      expect(useAppStore.getState().commandPaletteVisible).toBe(false);
    });
  });

  describe('theme', () => {
    it('should set theme', () => {
      useAppStore.getState().setTheme('hypothesis-light');
      expect(useAppStore.getState().currentTheme).toBe('hypothesis-light');
    });
  });

  describe('window', () => {
    it('should set maximized state', () => {
      useAppStore.getState().setMaximized(true);
      expect(useAppStore.getState().isMaximized).toBe(true);
    });
  });

  describe('loading', () => {
    it('should set loading state', () => {
      useAppStore.getState().setLoading(false);
      expect(useAppStore.getState().isLoading).toBe(false);
    });
  });

  describe('status message', () => {
    it('should set status message', () => {
      useAppStore.getState().setStatusMessage('Test message', 'success');
      expect(useAppStore.getState().statusMessage).toBe('Test message');
      expect(useAppStore.getState().statusType).toBe('success');
    });

    it('should clear status message', () => {
      useAppStore.getState().setStatusMessage('Test');
      useAppStore.getState().setStatusMessage(null);
      expect(useAppStore.getState().statusMessage).toBeNull();
    });

    it('should default to info type', () => {
      useAppStore.getState().setStatusMessage('Test');
      expect(useAppStore.getState().statusType).toBe('info');
    });
  });
});
