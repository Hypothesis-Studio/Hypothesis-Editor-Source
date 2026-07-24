/**
 * Image Preview — Renders images with zoom, pan, and fit-to-view.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { PreviewData } from '../../../shared/types/preview';
import { Icon } from '../common/Icon';

interface ImagePreviewProps {
  data: PreviewData;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({ data, zoom, onZoomChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [fitMode, setFitMode] = useState<'fit' | 'fill' | 'actual'>('fit');
  const panStart = useRef({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  const src = data.dataUrl || `file:///${data.filePath.replace(/\\/g, '/')}`;

  const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
  }, []);

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

  const handleDoubleClick = useCallback(() => {
    if (fitMode === 'fit') {
      setFitMode('actual');
      onZoomChange(100);
    } else {
      setFitMode('fit');
      onZoomChange(100);
    }
    setPan({ x: 0, y: 0 });
  }, [fitMode, onZoomChange]);

  // Reset pan on file change
  useEffect(() => {
    setPan({ x: 0, y: 0 });
    setFitMode('fit');
  }, [data.filePath]);

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--theme-bg-secondary)',
    backgroundImage: 'radial-gradient(circle, var(--theme-border) 1px, transparent 1px)',
    backgroundSize: '20px 20px',
    cursor: isPanning ? 'grabbing' : 'grab',
    position: 'relative',
  };

  const imgStyle: React.CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
    transition: isPanning ? 'none' : 'transform 0.15s ease',
    maxWidth: fitMode === 'fit' ? '90%' : undefined,
    maxHeight: fitMode === 'fit' ? '90%' : undefined,
    objectFit: fitMode === 'fill' ? 'contain' : undefined,
    imageRendering: zoom > 200 ? 'pixelated' : undefined,
  };

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      <img
        ref={imgRef}
        src={src}
        alt={data.fileName}
        onLoad={handleLoad}
        draggable={false}
        style={imgStyle}
      />

      {/* Image info overlay */}
      {naturalSize.width > 0 && (
        <div style={{
          position: 'absolute', bottom: 8, left: 8,
          padding: '4px 8px', borderRadius: 4,
          background: 'rgba(0,0,0,0.6)', color: '#fff',
          fontSize: 10, fontFamily: 'monospace',
          display: 'flex', gap: 12,
        }}>
          <span>{naturalSize.width} × {naturalSize.height}</span>
          <span>{formatFileSize(data.fileSize)}</span>
        </div>
      )}
    </div>
  );
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
}
