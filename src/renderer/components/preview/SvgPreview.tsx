/**
 * SVG Preview — Renders SVG inline with zoom and pan support.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { PreviewData } from '../../../shared/types/preview';

interface SvgPreviewProps {
  data: PreviewData;
  zoom: number;
}

export const SvgPreview: React.FC<SvgPreviewProps> = ({ data, zoom }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOffset = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      e.preventDefault();
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      // Zoom is handled by parent
    }
  }, []);

  // Reset pan on file change
  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [data.filePath]);

  if (!data.content) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ color: 'var(--theme-fg-muted)', fontSize: 12 }}>No SVG content</div>
      </div>
    );
  }

  // Check if SVG has its own background
  const hasOwnBackground = /<svg[^>]*(?:style\s*=\s*"[^"]*(?:background|fill)\s*:[^"]*")[^>]*>/i.test(data.content) ||
    /fill\s*=\s*"(?!none|transparent)[^"]+"/i.test(data.content);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hasOwnBackground ? 'transparent' : 'var(--theme-bg-secondary)',
        backgroundImage: !hasOwnBackground ? 'radial-gradient(circle, var(--theme-border) 1px, transparent 1px)' : undefined,
        backgroundSize: !hasOwnBackground ? '20px 20px' : undefined,
        cursor: isPanning ? 'grabbing' : 'grab',
        position: 'relative',
      }}
    >
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
          transition: isPanning ? 'none' : 'transform 0.15s ease',
          maxWidth: '90%',
          maxHeight: '90%',
        }}
        dangerouslySetInnerHTML={{ __html: data.content }}
      />
    </div>
  );
};
