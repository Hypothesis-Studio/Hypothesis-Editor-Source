/**
 * Theme System - Applies color themes to the entire application.
 */
import { create } from 'zustand';

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
}

const themeDefinitions: Record<string, ThemeColors> = {
  'hypothesis-dark': {
    bg: '#1e1e1e',
    bgSecondary: '#252526',
    bgTertiary: '#2d2d2d',
    bgHover: '#2a2d2e',
    bgActive: '#094771',
    fg: '#cccccc',
    fgMuted: '#888888',
    fgDim: '#555555',
    border: '#2d2d2d',
    borderLight: '#333333',
    accent: '#007acc',
    accentFg: '#ffffff',
    editorBg: '#1e1e1e',
    editorFg: '#cccccc',
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
    fgMuted: '#6e6e6e',
    fgDim: '#a0a0a0',
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

interface ThemeState {
  currentTheme: string;
  colors: ThemeColors;
  setTheme: (themeId: string) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  currentTheme: 'hypothesis-dark',
  colors: themeDefinitions['hypothesis-dark'],

  setTheme: (themeId: string) => {
    const colors = themeDefinitions[themeId] || themeDefinitions['hypothesis-dark'];
    applyThemeToDocument(colors);
    set({ currentTheme: themeId, colors });
  },
}));

// Apply default theme immediately
applyThemeToDocument(themeDefinitions['hypothesis-dark']);
