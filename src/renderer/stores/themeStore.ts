/**
 * Theme System - Applies color themes to the entire application.
 * Supports built-in themes + extension-registered themes + CSS injection.
 */
import { create } from 'zustand';
import { useSettingsStore } from './settingsStore';

interface ThemeColors {
  // Background
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  bgHover: string;
  bgActive: string;

  // Foreground
  fg: string;
  fgMuted: string;
  fgDim: string;

  // Border
  border: string;
  borderLight: string;

  // Accent
  accent: string;
  accentFg: string;

  // Editor
  editorBg: string;
  editorFg: string;
  editorLineHighlight: string;
  editorSelection: string;

  // Status
  error: string;
  warning: string;
  success: string;

  [key: string]: string;
}

const themeDefinitions: Record<string, ThemeColors> = {
  'hypothesis-dark': {
    bg: '#1e1e1e',
    bgSecondary: '#252526',
    bgTertiary: '#2d2d2d',
    bgHover: '#2a2d2e',
    bgActive: '#094771',
    fg: '#cccccc',
    fgMuted: '#858585',
    fgDim: '#6e6e6e',
    border: '#2d2d2d',
    borderLight: '#333333',
    accent: '#007acc',
    accentFg: '#ffffff',
    editorBg: '#1e1e1e',
    editorFg: '#d4d4d4',
    editorLineHighlight: '#2a2d2e',
    editorSelection: '#264f78',
    error: '#f48771',
    warning: '#cca700',
    success: '#89d185',
  },

  'hypothesis-light': {
    bg: '#ffffff',
    bgSecondary: '#f3f3f3',
    bgTertiary: '#e5e5e5',
    bgHover: '#e8e8e8',
    bgActive: '#d6ebff',
    fg: '#333333',
    fgMuted: '#616161',
    fgDim: '#858585',
    border: '#e5e5e5',
    borderLight: '#d4d4d4',
    accent: '#007acc',
    accentFg: '#ffffff',
    editorBg: '#ffffff',
    editorFg: '#333333',
    editorLineHighlight: '#f5f5f5',
    editorSelection: '#add6ff',
    error: '#cd3131',
    warning: '#bf8803',
    success: '#388a34',
  },

  'vs-dark': {
    bg: '#1e1e1e',
    bgSecondary: '#252526',
    bgTertiary: '#303030',
    bgHover: '#2a2d2e',
    bgActive: '#094771',
    fg: '#d4d4d4',
    fgMuted: '#808080',
    fgDim: '#555555',
    border: '#303030',
    borderLight: '#3c3c3c',
    accent: '#0e639c',
    accentFg: '#ffffff',
    editorBg: '#1e1e1e',
    editorFg: '#d4d4d4',
    editorLineHighlight: '#2a2d2e',
    editorSelection: '#264f78',
    error: '#f48771',
    warning: '#cca700',
    success: '#89d185',
  },

  'hc-black': {
    bg: '#000000',
    bgSecondary: '#000000',
    bgTertiary: '#1a1a1a',
    bgHover: '#1a1a1a',
    bgActive: '#0040a0',
    fg: '#ffffff',
    fgMuted: '#808080',
    fgDim: '#555555',
    border: '#6fc3df',
    borderLight: '#6fc3df',
    accent: '#6fc3df',
    accentFg: '#000000',
    editorBg: '#000000',
    editorFg: '#ffffff',
    editorLineHighlight: '#1a1a1a',
    editorSelection: '#0040a0',
    error: '#f48771',
    warning: '#ffcc00',
    success: '#89d185',
  },
};

// Apply theme colors to document as CSS variables
function applyThemeToDocument(colors: ThemeColors) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(colors)) {
    const cssKey = `--theme-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    root.style.setProperty(cssKey, value);
  }
}

/** Map extension dot-separated color keys → the 19 CSS vars components actually use */
function mapExtensionColors(extColors: Record<string, string>): ThemeColors {
  return {
    bg: extColors['editor.background'] || extColors.bg || '#1e1e1e',
    bgSecondary: extColors['sideBar.background'] || extColors.bgSecondary || '#252526',
    bgTertiary: extColors['tab.inactiveBackground'] || extColors.bgTertiary || '#2d2d2d',
    bgHover: extColors['list.hoverBackground'] || extColors.bgHover || '#2a2d2e',
    bgActive: extColors['list.activeSelectionBackground'] || extColors.bgActive || '#094771',
    fg: extColors['editor.foreground'] || extColors.fg || '#cccccc',
    fgMuted: extColors['editorLineNumber.foreground'] || extColors.fgMuted || '#858585',
    fgDim: extColors.descriptionForeground || extColors.fgDim || '#6e6e6e',
    border: extColors['sideBar.border'] || extColors.border || '#2d2d2d',
    borderLight: extColors['titleBar.border'] || extColors.borderLight || '#333333',
    accent: extColors['statusBar.background'] || extColors.accent || '#007acc',
    accentFg: extColors['statusBar.foreground'] || extColors.accentFg || '#ffffff',
    editorBg: extColors['editor.background'] || extColors.editorBg || '#1e1e1e',
    editorFg: extColors['editor.foreground'] || extColors.editorFg || '#cccccc',
    editorLineHighlight: extColors['editor.lineHighlightBackground'] || extColors.editorLineHighlight || '#2a2d2e',
    editorSelection: extColors['editor.selectionBackground'] || extColors.editorSelection || '#264f78',
    error: extColors.errorForeground || extColors.error || '#f48771',
    warning: extColors['statusBar.debuggingBackground'] || extColors.warning || '#cca700',
    success: extColors['gitDecoration.addedResourceForeground'] || extColors.success || '#89d185',
  };
}

interface ExtensionThemeEntry {
  id: string;
  name: string;
  type: string;
  colors: ThemeColors;
  rawColors: Record<string, string>;
  tokenColors?: any[];
  cssVars: Record<string, string>;
}

interface ThemeState {
  currentTheme: string;
  colors: ThemeColors;
  extensionThemes: Record<string, ExtensionThemeEntry>;
  injectedCss: Record<string, string>;
  setTheme: (themeId: string) => void;
  registerExtensionTheme: (themeDef: { id: string; name: string; type: string; colors: Record<string, string>; tokenColors?: any[] }) => void;
  unregisterExtensionTheme: (themeId: string) => void;
  injectCSS: (cssId: string, css: string) => void;
  removeCSS: (cssId: string) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  currentTheme: 'hypothesis-dark',
  colors: themeDefinitions['hypothesis-dark'],
  extensionThemes: {},
  injectedCss: {},

  setTheme: (themeId: string) => {
    const state = get();
    const extTheme = state.extensionThemes[themeId];
    if (extTheme) {
      const root = document.documentElement;
      const c = extTheme.rawColors || {};
      // 1. Apply the 19 core CSS vars
      applyThemeToDocument(extTheme.colors);
      // 2. Apply ALL --theme-* CSS vars
      for (const [key, value] of Object.entries(c)) {
        if (typeof value === 'string') {
          const cssKey = `--theme-${key.replace(/\./g, '-').replace(/([A-Z])/g, '-$1').toLowerCase()}`;
          root.style.setProperty(cssKey, value);
        }
      }
      // 3. Apply :root shorthand vars from cssVars (stored in extTheme)
      const cssVars = (extTheme as any).cssVars || {};
      for (const [varName, value] of Object.entries(cssVars)) {
        if (typeof value === 'string') root.style.setProperty(varName, value);
      }
      // 4. Apply syntax vars from tokenColors
      const tokenMap: Record<string, string> = { comment: '--editor-comment', keyword: '--editor-keyword', string: '--editor-string', number: '--editor-number', function: '--editor-function', variable: '--editor-variable', type: '--editor-type' };
      if (extTheme.tokenColors) {
        for (const tc of extTheme.tokenColors) {
          const scopes = Array.isArray(tc.scope) ? tc.scope : [tc.scope];
          for (const scope of scopes) {
            const varName = tokenMap[scope];
            if (varName && tc.settings?.foreground) root.style.setProperty(varName, tc.settings.foreground);
          }
        }
      }
      set({ currentTheme: themeId, colors: extTheme.colors });
      return;
    }
    const colors = themeDefinitions[themeId] || themeDefinitions['hypothesis-dark'];
    applyThemeToDocument(colors);
    set({ currentTheme: themeId, colors });
  },

  registerExtensionTheme: (themeDef) => {
    const mappedColors = mapExtensionColors(themeDef.colors);

    // 1. Store the extension theme entry — always, regardless of whether it's
    //    the active theme.  This lets setTheme() find it later.
    const extThemes = { ...get().extensionThemes };
    extThemes[themeDef.id] = {
      id: themeDef.id,
      name: themeDef.name,
      type: themeDef.type,
      colors: mappedColors,
      rawColors: themeDef.colors,
      tokenColors: themeDef.tokenColors,
      cssVars: (themeDef as any).cssVars || {},
    };
    set({ extensionThemes: extThemes });

    // 2. If this extension's theme is the one the user actually selected,
    //    apply it immediately so the UI updates even if setTheme() hasn't
    //    been called yet (race: setTheme ran before this extension loaded).
    //    Do NOT touch currentTheme — let setTheme() be the single source
    //    of truth for which theme is active.
    const savedTheme = useSettingsStore.getState().settings['workbench.colorTheme'] as string;
    if (savedTheme === themeDef.id) {
      const root = document.documentElement;
      const c = themeDef.colors || {};
      applyThemeToDocument(mappedColors);
      for (const [key, value] of Object.entries(c)) {
        if (typeof value === 'string') {
          const cssKey = `--theme-${key.replace(/\./g, '-').replace(/([A-Z])/g, '-$1').toLowerCase()}`;
          root.style.setProperty(cssKey, value);
        }
      }
      const cssVars = (themeDef as any).cssVars || {};
      for (const [varName, value] of Object.entries(cssVars)) {
        if (typeof value === 'string') root.style.setProperty(varName, value);
      }
      const tokenMap: Record<string, string> = { comment: '--editor-comment', keyword: '--editor-keyword', string: '--editor-string', number: '--editor-number', function: '--editor-function', variable: '--editor-variable', type: '--editor-type' };
      if (themeDef.tokenColors) {
        for (const tc of themeDef.tokenColors) {
          const scopes = Array.isArray(tc.scope) ? tc.scope : [tc.scope];
          for (const scope of scopes) {
            const varName = tokenMap[scope];
            if (varName && tc.settings?.foreground) root.style.setProperty(varName, tc.settings.foreground);
          }
        }
      }
      // Let setTheme handle currentTheme + colors via microtask
      queueMicrotask(() => {
        try { get().setTheme(themeDef.id); } catch {}
      });
    }
  },

  unregisterExtensionTheme: (themeId: string) => {
    const extThemes = { ...get().extensionThemes };
    delete extThemes[themeId];
    set({ extensionThemes: extThemes });

    // Use settings store (source of truth) to check active theme.
    const activeTheme = (useSettingsStore.getState().settings['workbench.colorTheme'] as string) || 'hypothesis-dark';
    console.log('[themeStore] unregisterExtensionTheme:', { themeId, activeTheme, willRevert: activeTheme === themeId });
    if (activeTheme === themeId) {
      get().setTheme('hypothesis-dark');
      try {
        useSettingsStore.getState().setSetting('workbench.colorTheme', 'hypothesis-dark');
      } catch {}
    }
  },

  injectCSS: (cssId: string, css: string) => {
    const existing = document.getElementById(`ext-css-${cssId}`);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = `ext-css-${cssId}`;
    style.textContent = css;
    document.head.appendChild(style);
    const injected = { ...get().injectedCss };
    injected[cssId] = css;
    set({ injectedCss: injected });
  },

  removeCSS: (cssId: string) => {
    const el = document.getElementById(`ext-css-${cssId}`);
    if (el) el.remove();
    const injected = { ...get().injectedCss };
    delete injected[cssId];
    set({ injectedCss: injected });
  },
}));

// Apply default theme immediately
applyThemeToDocument(themeDefinitions['hypothesis-dark']);
