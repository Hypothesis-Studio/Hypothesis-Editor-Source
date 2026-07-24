/**
 * Icon component — renders SVG from IconRegistry.
 * Material icons keep their original hardcoded colors (blue for TS, yellow for JS, etc).
 * Codi UI icons use currentColor which inherits from parent element's color.
 */
import React, { useState, useEffect } from 'react';
import { getIconSync, preloadTheme } from '../../services/IconRegistry';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  /** Icon theme to load from. Defaults to 'codi' for UI icons. */
  theme?: string;
}

// Global: track which themes have been loaded
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

// Kick off theme loading on module import
preloadTheme('material').then(() => notifyThemeLoaded('material'));
preloadTheme('codi').then(() => notifyThemeLoaded('codi'));

export const Icon: React.FC<IconProps> = ({ name, size = 16, className, style, title, theme = 'codi' }) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const found = getIconSync(theme, name);
    if (!found) {
      const cb = () => setTick(t => t + 1);
      onThemeLoaded(theme, cb);
      if (!loadedThemes.has(theme)) {
        preloadTheme(theme).then(() => notifyThemeLoaded(theme));
      }
    }
  }, [theme, name]);

  const svg = getIconSync(theme, name);
  if (!svg) return null;

  // Inject size into SVG
  let processed = svg;
  if (/width="/.test(processed)) {
    processed = processed.replace(/width="[^"]*"/, `width="${size}"`);
  } else {
    processed = processed.replace(/<svg/, `<svg width="${size}"`);
  }
  if (/height="/.test(processed)) {
    processed = processed.replace(/height="[^"]*"/, `height="${size}"`);
  } else {
    processed = processed.replace(/<svg/, `<svg height="${size}"`);
  }

  // Codi icons use fill="currentColor" — CSS inheritance via parent color handles
  // white icons in accent buttons. No need to rewrite fills/strokes here.
  // If caller passed a custom color via style prop, apply it directly to the SVG.
  const callerColor = style?.color;
  if (callerColor) {
    processed = processed.replace(/fill="currentColor"/g, `fill="${callerColor}"`);
    processed = processed.replace(/stroke="currentColor"/g, `stroke="${callerColor}"`);
  }

  return (
    <span
      className={`hypothesis-icon ${className || ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        flexShrink: 0,
        ...style,
      }}
      title={title}
      dangerouslySetInnerHTML={{ __html: processed }}
    />
  );
};

export default Icon;
