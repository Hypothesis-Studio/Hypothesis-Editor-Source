/**
 * IconRegistry — Loads SVG icons from built-in packs and extension-contributed themes.
 * Uses Vite's import.meta.glob with ?raw to load SVGs at build time.
 */

// ── Load all SVGs from both packs at build time ─────────────────
const materialSvgs = import.meta.glob('/src/renderer/assets/icons/pack/material/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const codiSvgs = import.meta.glob('/src/renderer/assets/icons/pack/codi/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

type IconMap = Record<string, string>;

interface IconTheme {
  id: string;
  label: string;
  icons: IconMap;
  loaded: boolean;
}

// Cache for loaded themes
const themeCache: Map<string, IconTheme> = new Map();

// Extension-contributed themes (runtime registered)
const extensionThemes: Map<string, { id: string; label: string; iconMap: IconMap }> = new Map();

// Resolve a glob map into { iconName: svgContent }
// With eager: true, values are already strings (not loader functions)
async function loadGlobMap(glob: Record<string, string>, prefix: string): Promise<IconMap> {
  const icons: IconMap = {};
  for (const [filePath, value] of Object.entries(glob)) {
    const match = filePath.match(/\/([^/]+)\.svg$/);
    if (match) {
      icons[match[1]] = value;
    }
  }
  return icons;
}

// Built-in theme loaders
const builtinLoaders: Record<string, { label: string; glob: Record<string, string> }> = {
  material: { label: 'Material', glob: materialSvgs },
  codi: { label: 'Codi', glob: codiSvgs },
};

/**
 * Load a built-in icon theme (lazy, cached).
 */
async function loadBuiltinTheme(themeId: string): Promise<IconTheme | null> {
  if (themeCache.has(themeId)) return themeCache.get(themeId)!;

  const builtin = builtinLoaders[themeId];
  if (!builtin) return null;

  const icons = await loadGlobMap(builtin.glob, themeId);
  const theme: IconTheme = { id: themeId, label: builtin.label, icons, loaded: true };
  themeCache.set(themeId, theme);
  return theme;
}

/**
 * Get SVG markup for an icon from a specific theme.
 * Returns null if not found.
 */
export async function getIcon(themeId: string, iconName: string): Promise<string | null> {
  // Check extension themes first
  const extTheme = extensionThemes.get(themeId);
  if (extTheme && extTheme.iconMap[iconName]) return extTheme.iconMap[iconName];

  // Check built-in themes
  const theme = await loadBuiltinTheme(themeId);
  if (theme && theme.icons[iconName]) return theme.icons[iconName];

  // Fallback: try codi theme for UI icons
  if (themeId !== 'codi') {
    const codi = await loadBuiltinTheme('codi');
    if (codi && codi.icons[iconName]) return codi.icons[iconName];
  }

  return null;
}

/**
 * Synchronous version — only works after theme has been loaded.
 */
export function getIconSync(themeId: string, iconName: string): string | null {
  const extTheme = extensionThemes.get(themeId);
  if (extTheme && extTheme.iconMap[iconName]) return extTheme.iconMap[iconName];

  const theme = themeCache.get(themeId);
  if (theme && theme.icons[iconName]) return theme.icons[iconName];

  // Try codi as fallback
  if (themeId !== 'codi') {
    const codi = themeCache.get('codi');
    if (codi && codi.icons[iconName]) return codi.icons[iconName];
  }

  return null;
}

/**
 * Preload a theme so getIconSync works immediately.
 */
export async function preloadTheme(themeId: string): Promise<void> {
  await loadBuiltinTheme(themeId);
}

/**
 * Register an extension-contributed icon theme at runtime.
 */
export function registerIconTheme(id: string, label: string, iconMap: IconMap): void {
  extensionThemes.set(id, { id, label, iconMap });
  // Also cache it so getIconSync works
  themeCache.set(id, { id, label, icons: iconMap, loaded: true });
}

/**
 * Unregister an extension icon theme.
 */
export function unregisterIconTheme(id: string): void {
  extensionThemes.delete(id);
  themeCache.delete(id);
}

/**
 * Get list of all available icon themes (built-in + extension).
 */
export function getAvailableThemes(): Array<{ id: string; label: string; builtin: boolean }> {
  const themes: Array<{ id: string; label: string; builtin: boolean }> = [
    { id: 'material', label: 'Material', builtin: true },
    { id: 'codi', label: 'Codi', builtin: true },
  ];
  for (const [id, ext] of extensionThemes) {
    themes.push({ id, label: ext.label, builtin: false });
  }
  return themes;
}

// Listen for extension icon themes registered by plugins
if (typeof window !== 'undefined' && (window as any).api?.menu?.onChannel) {
  (window as any).api.menu.onChannel('extension:iconTheme:registered', (_event: any, data: { id: string; label: string; iconMap: Record<string, string> }) => {
    registerIconTheme(data.id, data.label, data.iconMap);
  });
}

/**
 * Initialize — preload default themes on app start.
 */
export async function initIconRegistry(): Promise<void> {
  await Promise.all([loadBuiltinTheme('material'), loadBuiltinTheme('codi')]);
}
