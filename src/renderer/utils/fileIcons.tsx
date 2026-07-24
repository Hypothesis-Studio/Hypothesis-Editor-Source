/**
 * File Icon System — Uses IconRegistry to load icons from theme packs.
 * Includes auto-reload mechanism and robust fallbacks.
 */
import React, { useState, useEffect } from 'react';
import { getIconSync, preloadTheme } from '../services/IconRegistry';

export type IconTheme = 'material' | 'codi' | 'none' | string;

// ── Theme loading state with subscribers ────────────────────────
const loadedThemes = new Set<string>();
const themeListeners: Map<string, Set<() => void>> = new Map();

function notifyThemeLoaded(themeId: string) {
  loadedThemes.add(themeId);
  const listeners = themeListeners.get(themeId);
  if (listeners) {
    listeners.forEach(fn => fn());
    listeners.clear();
  }
}

function onThemeLoaded(themeId: string, cb: () => void) {
  if (loadedThemes.has(themeId)) return cb();
  if (!themeListeners.has(themeId)) themeListeners.set(themeId, new Set());
  themeListeners.get(themeId)!.add(cb);
}

// Kick off loading immediately on module import
preloadTheme('material').then(() => notifyThemeLoaded('material'));
preloadTheme('codi').then(() => notifyThemeLoaded('codi'));

// ── Extension → icon name mapping ──────────────────────────────
const EXT_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'react_ts', js: 'javascript', jsx: 'react', mjs: 'javascript', cjs: 'javascript',
  py: 'python', pyw: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java', class: 'javaclass', jar: 'jar',
  c: 'c', h: 'h', cpp: 'cpp', hpp: 'hpp', cc: 'cpp', cxx: 'cpp',
  cs: 'csharp',
  swift: 'swift',
  kt: 'kotlin', kts: 'kotlin',
  php: 'php',
  rb: 'ruby', erb: 'ruby',
  html: 'html', htm: 'html',
  css: 'css', scss: 'sass', less: 'less', sass: 'sass',
  json: 'json', jsonc: 'json', json5: 'json',
  xml: 'xml', svg: 'svg',
  yaml: 'yaml', yml: 'yaml', toml: 'toml',
  md: 'markdown', mdx: 'mdx',
  sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
  ps1: 'powershell', psm1: 'powershell', psd1: 'powershell',
  bat: 'shell', cmd: 'shell',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', ico: 'image', bmp: 'image', avif: 'image',
  pdf: 'pdf',
  zip: 'zip', tar: 'zip', gz: 'zip', '7z': 'zip', rar: 'zip',
  gitignore: 'git', gitattributes: 'git', gitmodules: 'git',
  env: 'env',
  dockerfile: 'docker', dockerignore: 'docker',
  sql: 'database', sqlite: 'database',
  lock: 'lock',
  txt: 'document', log: 'document', csv: 'document',
  conf: 'settings', cfg: 'settings', ini: 'settings', config: 'settings',
  tsconfig: 'tsconfig',
  webpack: 'webpack', vite: 'vite', rollup: 'rollup', esbuild: 'esbuild',
  eslint: 'eslint', prettier: 'prettier',
  test: 'test-ts', spec: 'test-ts',
  makefile: 'makefile', cmake: 'cmake',
  ttf: 'font', otf: 'font', woff: 'font', woff2: 'font',
  mp4: 'video', mkv: 'video', avi: 'video', mov: 'video',
  mp3: 'audio', wav: 'audio', flac: 'audio', ogg: 'audio',
  vue: 'vue', svelte: 'svelte',
  graphql: 'graphql', gql: 'graphql',
  prisma: 'prisma',
  dart: 'dart',
  lua: 'lua',
  r: 'r',
  scala: 'scala',
  zig: 'zig',
  nim: 'nim',
  jl: 'julia',
  tf: 'terraform', hcl: 'hcl',
  proto: 'proto',
  sol: 'solidity',
};

// ── Special filename → icon mapping ────────────────────────────
const FILENAME_MAP: Record<string, string> = {
  'package.json': 'nodejs', 'package-lock.json': 'npm',
  'yarn.lock': 'yarn', 'pnpm-lock.yaml': 'pnpm', 'bun.lockb': 'bun',
  'tsconfig.json': 'tsconfig', 'jsconfig.json': 'jsconfig',
  '.eslintrc': 'eslint', '.eslintrc.js': 'eslint', '.eslintrc.json': 'eslint',
  '.prettierrc': 'prettier', '.prettierrc.js': 'prettier', '.prettierrc.json': 'prettier',
  'Dockerfile': 'docker', 'docker-compose.yml': 'docker', 'docker-compose.yaml': 'docker',
  '.gitignore': 'git', '.gitattributes': 'git',
  '.env': 'env', '.env.local': 'env', '.env.development': 'env', '.env.production': 'env',
  'Makefile': 'makefile', 'CMakeLists.txt': 'cmake',
  'Cargo.toml': 'rust', 'go.mod': 'go-mod', 'Gemfile': 'gemfile',
  'readme.md': 'readme', 'README.md': 'readme',
  'LICENSE': 'license', 'LICENSE.md': 'license', 'CHANGELOG.md': 'changelog',
};

// ── Folder name → icon mapping ─────────────────────────────────
const FOLDER_MAP: Record<string, string> = {
  src: 'folder-src', lib: 'folder-lib', dist: 'folder-dist', build: 'folder-dist',
  node_modules: 'folder-node', '.git': 'folder-git',
  components: 'folder-components', pages: 'folder-pages', views: 'folder-views',
  hooks: 'folder-hooks', utils: 'folder-utils', helpers: 'folder-utils',
  services: 'folder-services', api: 'folder-api', routes: 'folder-routes',
  models: 'folder-class', types: 'folder-interface',
  config: 'folder-config', settings: 'folder-config',
  public: 'folder-public', static: 'folder-public', assets: 'folder-images',
  images: 'folder-images', img: 'folder-images', icons: 'folder-images',
  fonts: 'folder-font', css: 'folder-css', styles: 'folder-css',
  test: 'folder-test', tests: 'folder-test', '__tests__': 'folder-test', spec: 'folder-test',
  docs: 'folder-docs', doc: 'folder-docs',
  scripts: 'folder-scripts', bin: 'folder-scripts',
  server: 'folder-server', client: 'folder-client',
  database: 'folder-database', db: 'folder-database',
  middleware: 'folder-middleware', controllers: 'folder-controller',
  storage: 'folder-storage', temp: 'folder-temp', tmp: 'folder-temp',
  logs: 'folder-log', log: 'folder-log',
  plugins: 'folder-plugin', extensions: 'folder-plugin',
  themes: 'folder-theme', templates: 'folder-template',
  i18n: 'folder-i18n', locales: 'folder-i18n', lang: 'folder-i18n',
  '.github': 'folder-github', '.vscode': 'folder-vscode',
};

/**
 * Resolve icon name with fallback chain:
 * requested → codi fallback → generic fallback
 */
function resolveIcon(themeId: string, iconName: string, genericFallback: string): string | null {
  // Try requested theme
  let svg = getIconSync(themeId, iconName);
  if (svg) return svg;

  // Try codi fallback (unless already codi)
  if (themeId !== 'codi') {
    svg = getIconSync('codi', iconName);
    if (svg) return svg;
  }

  // Try generic fallback in requested theme
  if (iconName !== genericFallback) {
    svg = getIconSync(themeId, genericFallback);
    if (svg) return svg;

    // Try generic fallback in codi
    if (themeId !== 'codi') {
      svg = getIconSync('codi', genericFallback);
      if (svg) return svg;
    }
  }

  return null;
}

/**
 * Render an SVG string into a React span element.
 */
function renderSvg(svg: string, size: number): React.ReactElement {
  let processed = svg;

  // Set width
  if (/width="/.test(processed)) {
    processed = processed.replace(/width="[^"]*"/, `width="${size}"`);
  } else {
    processed = processed.replace(/<svg/, `<svg width="${size}"`);
  }
  // Set height
  if (/height="/.test(processed)) {
    processed = processed.replace(/height="[^"]*"/, `height="${size}"`);
  } else {
    processed = processed.replace(/<svg/, `<svg height="${size}"`);
  }

  // Preserve original SVG colors — material icons use per-filetype colors
  // Only codi icons use currentColor which inherits from parent CSS

  return React.createElement('span', {
    style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, flexShrink: 0, color: 'inherit' },
    dangerouslySetInnerHTML: { __html: processed },
  });
}

// ── Internal component: auto-reloads when theme loads ──────────
const FileIconInner: React.FC<{ iconName: string; fallback: string; theme: string; size: number }> = ({ iconName, fallback, theme, size }) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const found = resolveIcon(theme, iconName, fallback);
    if (!found) {
      // Icon not found — listen for theme load then re-render
      const cb = () => setTick(t => t + 1);
      onThemeLoaded(theme, cb);
      // Also try codi if it's not the current theme
      if (theme !== 'codi') onThemeLoaded('codi', cb);
    }
  }, [theme, iconName, fallback]);

  const svg = resolveIcon(theme, iconName, fallback);
  if (!svg) return null;
  return renderSvg(svg, size);
};

const FolderIconInner: React.FC<{ iconName: string; theme: string; size: number }> = ({ iconName, theme, size }) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const found = resolveIcon(theme, iconName, 'folder');
    if (!found) {
      const cb = () => setTick(t => t + 1);
      onThemeLoaded(theme, cb);
      if (theme !== 'codi') onThemeLoaded('codi', cb);
    }
  }, [theme, iconName]);

  const svg = resolveIcon(theme, iconName, 'folder');
  if (!svg) return null;
  return renderSvg(svg, size);
};

/**
 * Get icon name for a file by extension and filename.
 */
export function getFileIconName(fileName: string, extension: string): string {
  const lower = fileName.toLowerCase();
  if (FILENAME_MAP[lower]) return FILENAME_MAP[lower];
  const ext = extension.toLowerCase().replace(/^\./, '');
  return EXT_MAP[ext] || 'document';
}

/**
 * Get icon name for a folder by its name.
 */
export function getFolderIconName(folderName: string, _isExpanded: boolean): string {
  return FOLDER_MAP[folderName.toLowerCase()] || 'folder';
}

/**
 * Render file icon — returns a React component that auto-reloads when themes load.
 */
export function renderFileIcon(
  ext: string,
  theme: IconTheme,
  size: number = 14,
): React.ReactElement | null {
  if (theme === 'none') return null;
  const iconName = EXT_MAP[ext.toLowerCase()] || 'document';
  return React.createElement(FileIconInner, { iconName, fallback: 'file', theme, size });
}

/**
 * Render folder icon — returns a React component that auto-reloads when themes load.
 */
export function renderFolderIcon(
  isExpanded: boolean,
  theme: IconTheme,
  size: number = 14,
): React.ReactElement | null {
  if (theme === 'none') return null;
  const iconName = isExpanded ? 'folder-opened' : 'folder';
  return React.createElement(FolderIconInner, { iconName, theme, size });
}
