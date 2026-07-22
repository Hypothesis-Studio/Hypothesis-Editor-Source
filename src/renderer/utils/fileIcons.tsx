/**
 * File Icon Theme System
 * Provides SVG-based file icons matching VS Code's Seti/Minimal themes.
 * Returns React elements for consistent rendering.
 */
import React from 'react';

type IconDef = { color: string; path: string };

// ── Seti-style file icons (simplified SVG paths) ─────────────────
const ICONS: Record<string, IconDef> = {
  // Languages
  typescript:    { color: '#3178c6', path: 'M3 3h18v18H3V3zm16.5 13.5v-3c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v3c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5zm-6 0v-6h-1.5v6H13.5zm-4.5 0v-3.75L10.5 15l1.13-.75L10.5 13.5l1.12-.75L10.5 12l-1.5 1V15.5H9z' },
  javascript:    { color: '#f1e05a', path: 'M3 3h18v18H3V3zm14.5 14.5c0 1.38-1.12 2.5-2.5 2.5-1 0-1.8-.58-2.2-1.42l1.32-.76c.22.48.7.82 1.28.82.78 0 1.4-.65 1.4-1.45h-2.8v-1.5h4.3v.31zm-4.5-3.25c0-.69.56-1.25 1.25-1.25s1.25.56 1.25 1.25v.5c0 .69-.56 1.25-1.25 1.25S13 14.94 13 14.25v-.5z' },
  python:        { color: '#3572a5', path: 'M14.25 1h-7.5C5.79 1 5 1.79 5 2.75v4.5C5 8.21 5.79 9 6.75 9h1.5v2.5H5.5v1h3V15h3v-2.5h-3v-1h3.75c.97 0 1.75-.78 1.75-1.75v-7C16 1.79 15.21 1 14.25 1zm-1.5 1c.28 0 .5.22.5.5s-.22.5-.5.5-.5-.22-.5-.5.22-.5.5-.5zm-5 1c.28 0 .5.22.5.5S8.03 4 7.75 4s-.5-.22-.5-.5.22-.5.5-.5z' },
  rust:          { color: '#dea584', path: 'M3 3h18v18H3V3zm13.5 9c0-3.04-2.46-5.5-5.5-5.5S5.5 8.96 5.5 12s2.46 5.5 5.5 5.5 5.5-2.46 5.5-5.5zm-2 0c0 1.93-1.57 3.5-3.5 3.5S8 13.93 8 12s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5z' },
  go:            { color: '#00acd7', path: 'M3 3h18v18H3V3zm13.5 10.5c0 .83-.67 1.5-1.5 1.5H9v1.5h6v1.5H9c-.83 0-1.5-.67-1.5-1.5V9h9v4.5zm-6-3h3v1.5h-3V10.5z' },
  java:          { color: '#b07219', path: 'M3 3h18v18H3V3zm8 14c-1.1 0-2-.45-2-1s.9-1 2-1 2 .45 2 1-.9 1-2 1zm4-1c0 .55-.9 1-2 1s-2-.45-2-1 .9-1 2-1 2 .45 2 1z' },
  html:          { color: '#e34c26', path: 'M3 3h18v18H3V3zm3 3v12h12V6H6zm2 2h8v8H8V8z' },
  css:           { color: '#563d7c', path: 'M3 3h18v18H3V3zm3 3v12h12V6H6zm2 2h8v2H8V8zm0 3h8v2H8v-2z' },
  scss:          { color: '#c6538c', path: 'M3 3h18v18H3V3zm3 3v12h12V6H6zm2 2h8v2H8V8zm0 3h8v2H8v-2z' },
  json:          { color: '#cbcb41', path: 'M5 3h14v18H5V3zm2 2v14h10V5H7zm2 2h6v2H9V7zm0 3h6v2H9v-2zm0 3h6v2H9v-2z' },
  xml:           { color: '#e34c26', path: 'M5 3h14v18H5V3zm2 2v14h10V5H7zm2 3l3 4-3 4h2l3-4-3-4H9z' },
  yaml:          { color: '#cb171e', path: 'M5 3h14v18H5V3zm2 2v14h10V5H7zm2 2h6v1.5H9V7zm0 3h6v1.5H9V10zm0 3h4v1.5H9V13z' },
  markdown:      { color: '#083fa1', path: 'M3 3h18v18H3V3zm2 2v14h14V5H5zm2 3h2.5l1.5 2 1.5-2H15v6h-2V10l-1.5 2L10 10v5H7V8zm8 0h2v6h-2V8z' },
  shell:         { color: '#89e051', path: 'M3 3h18v18H3V3zm2 2v14h14V5H5zm3 4l3 3-3 3 1.5 1.5L13 11l-3.5-3.5L8 9zm5 7h5v1.5H13V16z' },
  powershell:    { color: '#012456', path: 'M3 3h18v18H3V3zm2 2v14h14V5H5zm3 4l3 3-3 3 1.5 1.5L13 11l-3.5-3.5L8 9zm5 7h5v1.5H13V16z' },
  bat:           { color: '#c1f12e', path: 'M3 3h18v18H3V3zm2 2v14h14V5H5zm3 4l3 3-3 3 1.5 1.5L13 11l-3.5-3.5L8 9z' },

  // Files
  image:         { color: '#a074c4', path: 'M5 3h14v18H5V3zm2 2v14h10V5H7zm2 2l3 4 2-2.5L16 13H8l-1-1.5 2-2.5z' },
  pdf:           { color: '#d35400', path: 'M5 3h10l4 4v14H5V3zm9 0v4h4M8 10h8M8 13h8M8 16h4' },
  zip:           { color: '#6d8086', path: 'M7 2h10v20H7V2zm2 2v4h2V4h2v4h2V4h2v4h-1l1 2h-1v2h1l-1 2h1v4h-2v-4h-2v4h-2v-4H9v4H7v-4h1l-1-2h1v-2H7l1-2h1V4H7z' },
  gitignore:     { color: '#f05133', path: 'M5 3h14v18H5V3zm2 2v14h10V5H7zm2 2h6v2H9V7zm0 3h6v2H9v-2zm0 3h4v2H9v-2z' },
  env:           { color: '#ecd53f', path: 'M5 3h14v18H5V3zm2 2v14h10V5H7zm2 2h6v2H9V7zm0 3h6v2H9v-2zm0 3h6v2H9v-2z' },
  dockerfile:    { color: '#2496ed', path: 'M3 3h18v18H3V3zm2 2v14h14V5H5zm3 3h8v2H8V8zm0 3h8v2H8v-2zm3 3h5v2H11v-2z' },
  sql:           { color: '#e38c00', path: 'M5 3h14v18H5V3zm2 2v14h10V5H7zm2 2h6v1.5H9V7zm0 3h6v1.5H9V10zm0 3h6v1.5H9V13zm0 3h6v1.5H9V16z' },
  ruby:          { color: '#cc342d', path: 'M12 2L3 9l9 13 9-13L12 2zm0 3.5L17.5 11 12 20.5 6.5 11 12 5.5z' },
  lock:          { color: '#6d8086', path: 'M12 2C9.24 2 7 4.24 7 7v3H5v12h14V10h-2V7c0-2.76-2.24-5-5-5zm0 2c1.66 0 3 1.34 3 3v3H9V7c0-1.66 1.34-3 3-3zm0 10c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z' },
  txt:           { color: '#6d8086', path: 'M5 3h14v18H5V3zm2 2v14h10V5H7zm2 2h6v1H9V7zm0 3h6v1H9v-1zm0 3h6v1H9v-1zm0 3h4v1H9v-1z' },

  // Folders
  folder:        { color: '#dcb67a', path: 'M2 6c0-1.1.9-2 2-2h5l2 2h9c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6z' },
  folderOpen:    { color: '#dcb67a', path: 'M2 6c0-1.1.9-2 2-2h5l2 2h9c1.1 0 2 .9 2 2v1H4c-1.1 0-2 .9-2 2v7c0 1.1-.9 2-2 2V6zm0 7h18v5c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2v-5z' },
  folderNone:    { color: '#6d8086', path: 'M2 6c0-1.1.9-2 2-2h5l2 2h9c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6z' },
};

// ── Extension → icon key mapping ─────────────────────────────────
const EXT_MAP: Record<string, keyof typeof ICONS> = {
  // TypeScript/JavaScript
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  // Python
  py: 'python', pyw: 'python',
  // Rust
  rs: 'rust',
  // Go
  go: 'go',
  // Java
  java: 'java', class: 'java', jar: 'java',
  // Web
  html: 'html', htm: 'html',
  css: 'css', scss: 'scss', less: 'css', sass: 'scss',
  // Data
  json: 'json', jsonc: 'json', json5: 'json',
  xml: 'xml', svg: 'xml',
  yaml: 'yaml', yml: 'yaml', toml: 'yaml',
  // Docs
  md: 'markdown', mdx: 'markdown',
  // Shell
  sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
  ps1: 'powershell', psm1: 'powershell', psd1: 'powershell',
  bat: 'bat', cmd: 'bat',
  // Images
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', ico: 'image', bmp: 'image',
  // PDF
  pdf: 'pdf',
  // Archive
  zip: 'zip', tar: 'zip', gz: 'zip', '7z': 'zip', rar: 'zip',
  // Git
  gitignore: 'gitignore', gitattributes: 'gitignore', gitmodules: 'gitignore',
  // Env
  env: 'env',
  // Docker
  dockerfile: 'dockerfile',
  // SQL
  sql: 'sql', sqlite: 'sql',
  // Ruby
  rb: 'ruby', erb: 'ruby',
  // Lock
  lock: 'lock',
  // Text
  txt: 'txt', log: 'txt', csv: 'txt',
  // Config
  conf: 'txt', cfg: 'txt', ini: 'txt', config: 'txt',
};

// ── Theme color palettes ───────────────────────────────────────
const PALETTES: Record<string, Record<string, string>> = {
  'vs-seti': {}, // uses ICONS default colors
  'vs-minimal': {}, // resolved at render time to theme fg-muted
  'material': {
    typescript: '#2196f3',
    javascript: '#ffeb3b',
    python: '#2196f3',
    rust: '#ff7043',
    go: '#00bcd4',
    java: '#ff9800',
    html: '#e91e63',
    css: '#9c27b0',
    scss: '#e91e63',
    json: '#4caf50',
    xml: '#e91e63',
    yaml: '#f44336',
    markdown: '#2196f3',
    shell: '#8bc34a',
    powershell: '#2196f3',
    bat: '#8bc34a',
    image: '#9c27b0',
    pdf: '#ff5722',
    zip: '#607d8b',
    gitignore: '#ff5722',
    env: '#ffc107',
    dockerfile: '#2196f3',
    sql: '#ff9800',
    ruby: '#e91e63',
    lock: '#607d8b',
    txt: '#9e9e9e',
    folder: '#ffc107',
    folderOpen: '#ffc107',
    folderNone: '#9e9e9e',
  },
  'catppuccin': {
    typescript: '#89b4fa',
    javascript: '#f9e2af',
    python: '#89b4fa',
    rust: '#fab387',
    go: '#94e2d5',
    java: '#fab387',
    html: '#f38ba8',
    css: '#cba6f7',
    scss: '#f38ba8',
    json: '#a6e3a1',
    xml: '#f38ba8',
    yaml: '#f38ba8',
    markdown: '#89b4fa',
    shell: '#a6e3a1',
    powershell: '#89b4fa',
    bat: '#a6e3a1',
    image: '#f5c2e7',
    pdf: '#fab387',
    zip: '#6c7086',
    gitignore: '#f38ba8',
    env: '#f9e2af',
    dockerfile: '#89b4fa',
    sql: '#fab387',
    ruby: '#f38ba8',
    lock: '#6c7086',
    txt: '#a6adc8',
    folder: '#f9e2af',
    folderOpen: '#f9e2af',
    folderNone: '#a6adc8',
  },
  'nord': {
    typescript: '#88c0d0',
    javascript: '#ebcb8b',
    python: '#88c0d0',
    rust: '#d08770',
    go: '#8fbcbb',
    java: '#d08770',
    html: '#bf616a',
    css: '#b48ead',
    scss: '#bf616a',
    json: '#a3be8c',
    xml: '#bf616a',
    yaml: '#bf616a',
    markdown: '#88c0d0',
    shell: '#a3be8c',
    powershell: '#88c0d0',
    bat: '#a3be8c',
    image: '#b48ead',
    pdf: '#d08770',
    zip: '#4c566a',
    gitignore: '#bf616a',
    env: '#ebcb8b',
    dockerfile: '#88c0d0',
    sql: '#d08770',
    ruby: '#bf616a',
    lock: '#4c566a',
    txt: '#d8dee9',
    folder: '#ebcb8b',
    folderOpen: '#ebcb8b',
    folderNone: '#d8dee9',
  },
};
export type IconTheme = 'vs-seti' | 'vs-minimal' | 'none' | 'material' | 'catppuccin' | 'nord';

function resolveColor(iconKey: string, theme: IconTheme, defaultColor: string): string {
  if (theme === 'none') return 'transparent';
  if (theme === 'vs-minimal') return 'var(--theme-fg-muted)';
  const palette = PALETTES[theme];
  if (palette && palette[iconKey]) return palette[iconKey];
  return defaultColor;
}

function getIconDefForExt(ext: string): { key: string; def: IconDef } | null {
  const key = EXT_MAP[ext];
  if (key && ICONS[key]) return { key, def: ICONS[key] };
  return { key: 'txt', def: ICONS['txt'] };
}

/**
 * Render file icon as an SVG React element.
 */
export function renderFileIcon(
  ext: string,
  theme: IconTheme,
  size: number = 14,
): React.ReactElement | null {
  if (theme === 'none') return null;
  const result = getIconDefForExt(ext);
  if (!result) return null;
  const color = resolveColor(result.key, theme, result.def.color);
  return React.createElement('svg', {
    width: size, height: size, viewBox: '0 0 20 20', fill: 'none',
    style: { flexShrink: 0 },
    children: React.createElement('path', { d: result.def.path, fill: color, fillRule: 'evenodd', clipRule: 'evenodd' }),
  });
}

/**
 * Render folder icon as an SVG React element.
 */
export function renderFolderIcon(
  isExpanded: boolean,
  theme: IconTheme,
  size: number = 14,
): React.ReactElement | null {
  if (theme === 'none') return null;
  const iconKey = isExpanded ? 'folderOpen' : 'folder';
  const def = ICONS[iconKey];
  const color = resolveColor(iconKey, theme, def.color);
  return React.createElement('svg', {
    width: size, height: size, viewBox: '0 0 20 20', fill: 'none',
    style: { flexShrink: 0 },
    children: React.createElement('path', { d: def.path, fill: color, fillRule: 'evenodd', clipRule: 'evenodd' }),
  });
}
