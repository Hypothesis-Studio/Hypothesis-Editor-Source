/**
 * HTML Preview — Renders HTML content in a sandboxed iframe with viewport simulation.
 * Follows system/app theme for container background.
 */
import React, { useRef, useEffect, useState } from 'react';
import { useThemeStore } from '../../stores/themeStore';
import type { PreviewData } from '../../../shared/types/preview';

interface HtmlPreviewProps {
  data: PreviewData;
  viewportWidth?: number | null; // null = fill container (responsive)
}

export const HtmlPreview: React.FC<HtmlPreviewProps> = ({ data, viewportWidth }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { currentTheme } = useThemeStore();
  const isDark = currentTheme !== 'hypothesis-light';

  useEffect(() => {
    if (!iframeRef.current || !data.content) return;
    try {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(data.content);
        doc.close();
        setLoadError(null);
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to render HTML');
    }
  }, [data.content, data.filePath, viewportWidth]);

  if (loadError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
        <div style={{ color: '#f87171', fontSize: 12 }}>{loadError}</div>
      </div>
    );
  }

  // Responsive mode — iframe fills container
  if (!viewportWidth) {
    return (
      <iframe
        ref={iframeRef}
        title={data.fileName}
        sandbox="allow-scripts allow-same-origin"
        style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
      />
    );
  }

  // Viewport simulation — iframe is fixed width, centered in a scrollable container
  const bgColor = isDark ? '#1a1a1a' : '#e8e8e8';
  const shadowColor = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.15)';
  const borderRadius = viewportWidth <= 430 ? 16 : viewportWidth <= 820 ? 10 : 6;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        background: bgColor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 24,
        paddingBottom: 24,
        transition: 'background 0.2s',
      }}
    >
      {/* Device frame */}
      <div style={{
        width: viewportWidth,
        minHeight: '100%',
        background: '#fff',
        boxShadow: `0 8px 40px ${shadowColor}, 0 2px 12px rgba(0,0,0,0.08)`,
        borderRadius,
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
      }}>
        <iframe
          ref={iframeRef}
          title={data.fileName}
          sandbox="allow-scripts allow-same-origin"
          style={{
            width: '100%',
            height: '100%',
            minHeight: 600,
            border: 'none',
            background: '#fff',
            display: 'block',
          }}
        />
      </div>
    </div>
  );
};
