/**
 * Preview Panel — Main container for file previews.
 * Routes to the appropriate renderer based on file category.
 */
import React, { useEffect, useState, useCallback } from 'react';
import type { PreviewData, PreviewCategory, PreviewMode } from '../../../shared/types/preview';
import { Icon } from '../common/Icon';
import { HtmlPreview } from './HtmlPreview';
import { MarkdownPreview } from './MarkdownPreview';
import { SvgPreview } from './SvgPreview';
import { ImagePreview } from './ImagePreview';
import { AudioPreview } from './AudioPreview';
import { VideoPreview } from './VideoPreview';
import { TextPreview } from './TextPreview';

interface PreviewPanelProps {
  filePath: string;
  onOpenSource?: () => void;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ filePath, onOpenSource }) => {
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<PreviewMode>('preview');
  const [zoom, setZoom] = useState(100);
  const [autoReload, setAutoReload] = useState(true);

  // Load auto-reload setting
  useEffect(() => {
    const api = (window as any).api;
    if (api?.settings) {
      api.settings.get('editor.preview.autoReload').then((val: unknown) => {
        if (val !== undefined) setAutoReload(!!val);
      }).catch(() => {});
    }
  }, []);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const api = (window as any).api;
      if (!api?.preview) {
        setError('Preview API not available');
        return;
      }
      const result = await api.preview.loadPreview(filePath);
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to load preview');
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [filePath]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  // Auto-reload on file change (controlled by Settings > Editor > Auto Reload Preview)
  useEffect(() => {
    if (!autoReload || !filePath) return;
    const api = (window as any).api;
    if (!api?.preview) return;

    api.preview.watchFile(filePath);
    const unsub = api.preview.onFileChanged((event: { filePath: string }) => {
      if (event.filePath === filePath) {
        loadPreview();
      }
    });

    return () => {
      api.preview.unwatchFile(filePath);
      unsub?.();
    };
  }, [filePath, autoReload, loadPreview]);

  const handleZoomIn = () => setZoom(z => Math.min(z + 25, 500));
  const handleZoomOut = () => setZoom(z => Math.max(z - 25, 10));
  const handleZoomReset = () => setZoom(100);

  const handleOpenInBrowser = async () => {
    try {
      const { shell } = require('electron');
      shell.openPath(filePath);
    } catch {
      window.open(`file://${filePath}`, '_blank');
    }
  };

  const category = data?.category;

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
        <Icon name="loading" size={32} className="animate-spin" style={{ color: 'var(--theme-fg-muted)' }} />
        <div style={{ color: 'var(--theme-fg-muted)', fontSize: 12 }}>Loading preview...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
        <Icon name="error" size={32} style={{ color: '#ef4444' }} />
        <div style={{ color: '#f87171', fontSize: 13 }}>{error || 'No preview available'}</div>
        <button onClick={loadPreview} style={{ padding: '6px 16px', fontSize: 12, color: '#fff', background: 'var(--theme-accent)', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--theme-bg)' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid var(--theme-border)', background: 'var(--theme-bg-secondary)', flexShrink: 0, gap: 8 }}>
        {/* Left: file info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <Icon name={getCategoryIcon(category)} size={14} style={{ color: 'var(--theme-accent)', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--theme-fg)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.fileName}
          </span>
          <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)', flexShrink: 0 }}>
            {formatFileSize(data.fileSize)}
          </span>
        </div>

        {/* Right: controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {/* Zoom controls for image/svg/markdown/pdf */}
          {(category === 'image' || category === 'svg' || category === 'markdown' || category === 'pdf') && (
            <>
              <ToolbarButton icon="remove" onClick={handleZoomOut} title="Zoom Out" />
              <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)', minWidth: 36, textAlign: 'center' }}>{zoom}%</span>
              <ToolbarButton icon="add" onClick={handleZoomIn} title="Zoom In" />
              <ToolbarButton icon="screen-normal" onClick={handleZoomReset} title="Reset Zoom" />
              <div style={{ width: 1, height: 16, background: 'var(--theme-border)', margin: '0 4px' }} />
            </>
          )}

          <ToolbarButton icon="refresh" onClick={loadPreview} title="Reload" />
          <div style={{ width: 1, height: 16, background: 'var(--theme-border)', margin: '0 4px' }} />
          <ToolbarButton icon="link-external" onClick={handleOpenInBrowser} title="Open in System Viewer" />
        </div>
      </div>

      {/* Preview content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {category === 'html' && <HtmlPreview data={data} />}
        {category === 'markdown' && <MarkdownPreview data={data} zoom={zoom} />}
        {category === 'svg' && <SvgPreview data={data} zoom={zoom} />}
        {category === 'image' && <ImagePreview data={data} zoom={zoom} onZoomChange={setZoom} />}
        {category === 'audio' && <AudioPreview data={data} />}
        {category === 'video' && <VideoPreview data={data} />}
        {category === 'text' && <TextPreview data={data} />}
        {category === 'pdf' && <PdfPreview data={data} />}
        {category === 'code' && <TextPreview data={data} />}
      </div>
    </div>
  );
};

// ── Toolbar Button ───────────────────────────────────────────────
const ToolbarButton: React.FC<{ icon: string; onClick: () => void; title: string; active?: boolean }> = ({ icon, onClick, title, active }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: active ? 'var(--theme-accent)' : 'transparent',
      border: 'none', borderRadius: 4, cursor: 'pointer',
      color: active ? '#fff' : 'var(--theme-fg-muted)',
    }}
    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--theme-bg-hover)'; }}
    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
  >
    <Icon name={icon} size={14} />
  </button>
);

// ── PDF Preview ──────────────────────────────────────────────────
const PdfPreview: React.FC<{ data: PreviewData }> = ({ data }) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (data.dataUrl) {
      setSrc(data.dataUrl);
    } else if (data.filePath) {
      setSrc(`file:///${data.filePath.replace(/\\/g, '/')}`);
    }
  }, [data]);

  if (!src) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
        <Icon name="file-pdf" size={32} style={{ color: 'var(--theme-fg-muted)' }} />
        <div style={{ color: 'var(--theme-fg-muted)', fontSize: 12 }}>PDF preview not available</div>
      </div>
    );
  }

  return (
    <iframe
      src={src}
      style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
      title={data.fileName}
      sandbox="allow-same-origin"
    />
  );
};

// ── Helpers ──────────────────────────────────────────────────────
function getCategoryIcon(category: PreviewCategory): string {
  switch (category) {
    case 'html': return 'code';
    case 'markdown': return 'markdown';
    case 'svg':
    case 'image': return 'file-media';
    case 'audio': return 'file-media';
    case 'video': return 'file-media';
    case 'pdf': return 'file-pdf';
    case 'text': return 'file-text';
    case 'code': return 'file-code';
    default: return 'file';
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
}
