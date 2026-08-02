/**
 * Preview Panel — Main container for file previews.
 * Routes to the appropriate renderer based on file category.
 * Supports viewport preset simulation for HTML previews.
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

// ── Viewport presets ──────────────────────────────────────────────────────────

type ViewportPresetId = 'responsive' | 'mobile' | 'tablet' | 'desktop' | 'custom';

interface ViewportPreset {
  id: ViewportPresetId;
  label: string;
  width: number | null; // null = responsive / fill container
  tooltip: string;
}

const VIEWPORT_PRESETS: ViewportPreset[] = [
  { id: 'responsive', label: 'Responsive', width: null, tooltip: 'Responsive — fill container' },
  { id: 'mobile',     label: 'Mobile',     width: 375,  tooltip: 'Mobile — 375px (iPhone SE)' },
  { id: 'tablet',     label: 'Tablet',     width: 768,  tooltip: 'Tablet — 768px (iPad)' },
  { id: 'desktop',    label: 'Desktop',    width: 1280, tooltip: 'Desktop — 1280px' },
  { id: 'custom',     label: 'Custom',     width: null, tooltip: 'Custom width' },
];

// ── Viewport SVG icons ────────────────────────────────────────────────────────

const ViewportIcon: React.FC<{ id: ViewportPresetId; size?: number }> = ({ id, size = 13 }) => {
  const s = size;
  switch (id) {
    case 'responsive':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <rect x="1" y="2" width="14" height="10" rx="1" />
          <path d="M5 14h6M8 12v2" />
        </svg>
      );
    case 'mobile':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <rect x="4.5" y="1" width="7" height="14" rx="1.5" />
          <circle cx="8" cy="13" r="0.7" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'tablet':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <rect x="2" y="1" width="12" height="14" rx="1.5" />
          <circle cx="8" cy="13" r="0.7" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'desktop':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <rect x="1" y="2" width="14" height="9" rx="1" />
          <path d="M5 14h6M8 11v3" />
        </svg>
      );
    case 'custom':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <path d="M2 8h2M12 8h2M8 2v2M8 12v2" />
          <circle cx="8" cy="8" r="2.5" />
        </svg>
      );
    default:
      return null;
  }
};

// ── Toolbar Button ─────────────────────────────────────────────────────────────

const ToolbarButton: React.FC<{
  icon: string;
  onClick: () => void;
  title: string;
  active?: boolean;
}> = ({ icon, onClick, title, active }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      width: 28, height: 28,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: active ? 'var(--theme-accent)' : 'transparent',
      border: 'none', borderRadius: 4, cursor: 'pointer',
      color: active ? '#fff' : 'var(--theme-fg-muted)',
      flexShrink: 0,
    }}
    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--theme-bg-hover)'; }}
    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
  >
    <Icon name={icon} size={14} />
  </button>
);

// ── PDF Preview ────────────────────────────────────────────────────────────────

const PdfPreview: React.FC<{ data: PreviewData }> = ({ data }) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (data.dataUrl) setSrc(data.dataUrl);
    else if (data.filePath) setSrc(`file:///${data.filePath.replace(/\\/g, '/')}`);
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function getCategoryIcon(category: PreviewCategory): string {
  switch (category) {
    case 'html':     return 'code';
    case 'markdown': return 'markdown';
    case 'svg':
    case 'image':    return 'file-media';
    case 'audio':    return 'file-media';
    case 'video':    return 'file-media';
    case 'pdf':      return 'file-pdf';
    case 'text':     return 'file-text';
    case 'code':     return 'file-code';
    default:         return 'file';
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
}

// ── PreviewPanel ───────────────────────────────────────────────────────────────

interface PreviewPanelProps {
  filePath: string;
  onOpenSource?: () => void;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ filePath, onOpenSource }) => {
  const [data, setData]       = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [mode, setMode]       = useState<PreviewMode>('preview');
  const [zoom, setZoom]       = useState(100);
  const [autoReload, setAutoReload] = useState(true);

  // Viewport state — only meaningful for HTML previews
  const [viewportPreset, setViewportPreset]   = useState<ViewportPresetId>('responsive');
  const [customWidth, setCustomWidth]         = useState<string>('1024');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const customInputRef = React.useRef<HTMLInputElement>(null);

  const resolvedViewportWidth: number | null =
    viewportPreset === 'responsive' ? null :
    viewportPreset === 'custom'     ? (parseInt(customWidth, 10) || null) :
    (VIEWPORT_PRESETS.find(p => p.id === viewportPreset)?.width ?? null);

  // Load auto-reload setting
  useEffect(() => {
    const api = (window as any).api;
    if (api?.settings) {
      api.settings.get('editor.preview.autoReload').then((val: unknown) => {
        if (val !== undefined) setAutoReload(!!val);
      }).catch(() => {});
    }
  }, []);

  // Focus custom width input when shown
  useEffect(() => {
    if (showCustomInput) setTimeout(() => customInputRef.current?.focus(), 50);
  }, [showCustomInput]);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const api = (window as any).api;
      if (!api?.preview) { setError('Preview API not available'); return; }
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

  useEffect(() => { loadPreview(); }, [loadPreview]);

  // Auto-reload on file change
  useEffect(() => {
    if (!autoReload || !filePath) return;
    const api = (window as any).api;
    if (!api?.preview) return;
    api.preview.watchFile(filePath);
    const unsub = api.preview.onFileChanged((event: { filePath: string }) => {
      if (event.filePath === filePath) loadPreview();
    });
    return () => { api.preview.unwatchFile(filePath); unsub?.(); };
  }, [filePath, autoReload, loadPreview]);

  const handleZoomIn    = () => setZoom(z => Math.min(z + 25, 500));
  const handleZoomOut   = () => setZoom(z => Math.max(z - 25, 10));
  const handleZoomReset = () => setZoom(100);

  const handleOpenInBrowser = async () => {
    try {
      const { shell } = require('electron');
      shell.openPath(filePath);
    } catch {
      window.open(`file://${filePath}`, '_blank');
    }
  };

  const handlePresetClick = (preset: ViewportPreset) => {
    if (preset.id === 'custom') {
      setViewportPreset('custom');
      setShowCustomInput(true);
    } else {
      setViewportPreset(preset.id);
      setShowCustomInput(false);
    }
  };

  const handleCustomWidthCommit = () => {
    const v = parseInt(customWidth, 10);
    if (!v || v < 100) setCustomWidth('375');
    else if (v > 3840) setCustomWidth('3840');
    setShowCustomInput(false);
  };

  const category = data?.category;
  const isHtml   = category === 'html';

  // ── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
        <Icon name="loading" size={32} className="animate-spin" style={{ color: 'var(--theme-fg-muted)' }} />
        <div style={{ color: 'var(--theme-fg-muted)', fontSize: 12 }}>Loading preview...</div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
        <Icon name="error" size={32} style={{ color: '#ef4444' }} />
        <div style={{ color: '#f87171', fontSize: 13 }}>{error || 'No preview available'}</div>
        <button
          onClick={loadPreview}
          style={{ padding: '6px 16px', fontSize: 12, color: '#fff', background: 'var(--theme-accent)', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Main ─────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--theme-bg)' }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 10px', height: 38, flexShrink: 0,
        borderBottom: '1px solid var(--theme-border)',
        background: 'var(--theme-bg-secondary)',
      }}>

        {/* Left: file info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: '0 1 auto', overflow: 'hidden' }}>
          <Icon name={getCategoryIcon(category!)} size={13} style={{ color: 'var(--theme-accent)', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--theme-fg)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.fileName}
          </span>
          <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)', flexShrink: 0 }}>
            {formatFileSize(data.fileSize)}
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Center: Viewport presets — HTML only */}
        {isHtml && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            {/* Separator */}
            <div style={{ width: 1, height: 16, background: 'var(--theme-border)', marginRight: 6 }} />

            {VIEWPORT_PRESETS.map(preset => {
              const isActive = viewportPreset === preset.id;

              if (preset.id === 'custom') {
                return (
                  <div key="custom" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <button
                      onClick={() => handlePresetClick(preset)}
                      title={preset.tooltip}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '2px 7px', height: 24, borderRadius: 4,
                        border: isActive ? '1px solid var(--theme-accent)' : '1px solid transparent',
                        background: isActive ? 'var(--theme-accent)18' : 'transparent',
                        color: isActive ? 'var(--theme-accent)' : 'var(--theme-fg-muted)',
                        cursor: 'pointer', fontSize: 10, fontWeight: isActive ? 600 : 400,
                      }}
                      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--theme-bg-hover)'; e.currentTarget.style.color = 'var(--theme-fg)'; } }}
                      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--theme-fg-muted)'; } }}
                    >
                      <ViewportIcon id="custom" />
                      {preset.label}
                    </button>
                    {showCustomInput && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <input
                          ref={customInputRef}
                          type="number"
                          value={customWidth}
                          min={100}
                          max={3840}
                          onChange={e => setCustomWidth(e.target.value)}
                          onBlur={handleCustomWidthCommit}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleCustomWidthCommit();
                            if (e.key === 'Escape') setShowCustomInput(false);
                          }}
                          style={{
                            width: 58, padding: '2px 5px', fontSize: 11,
                            background: 'var(--theme-bg)',
                            border: '1px solid var(--theme-accent)',
                            borderRadius: 4, color: 'var(--theme-fg)', outline: 'none',
                          }}
                        />
                        <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)' }}>px</span>
                      </div>
                    )}
                    {isActive && !showCustomInput && (
                      <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)' }}>{customWidth}px</span>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={preset.id}
                  onClick={() => handlePresetClick(preset)}
                  title={preset.tooltip}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '2px 7px', height: 24, borderRadius: 4,
                    border: isActive ? '1px solid var(--theme-accent)' : '1px solid transparent',
                    background: isActive ? 'var(--theme-accent)18' : 'transparent',
                    color: isActive ? 'var(--theme-accent)' : 'var(--theme-fg-muted)',
                    cursor: 'pointer', fontSize: 10, fontWeight: isActive ? 600 : 400,
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--theme-bg-hover)'; e.currentTarget.style.color = 'var(--theme-fg)'; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--theme-fg-muted)'; } }}
                >
                  <ViewportIcon id={preset.id} />
                  {preset.label}
                  {isActive && preset.width !== null && (
                    <span style={{ fontSize: 9, opacity: 0.65, marginLeft: 1 }}>{preset.width}px</span>
                  )}
                </button>
              );
            })}

            <div style={{ width: 1, height: 16, background: 'var(--theme-border)', marginLeft: 6 }} />
          </div>
        )}

        {/* Right: zoom + reload + open */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          {(category === 'image' || category === 'svg' || category === 'markdown' || category === 'pdf') && (
            <>
              <ToolbarButton icon="remove"        onClick={handleZoomOut}   title="Zoom Out" />
              <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)', minWidth: 34, textAlign: 'center' }}>{zoom}%</span>
              <ToolbarButton icon="add"           onClick={handleZoomIn}    title="Zoom In" />
              <ToolbarButton icon="screen-normal" onClick={handleZoomReset} title="Reset Zoom" />
              <div style={{ width: 1, height: 16, background: 'var(--theme-border)', margin: '0 4px' }} />
            </>
          )}
          <ToolbarButton icon="refresh"       onClick={loadPreview}          title="Reload" />
          <div style={{ width: 1, height: 16, background: 'var(--theme-border)', margin: '0 4px' }} />
          <ToolbarButton icon="link-external" onClick={handleOpenInBrowser}  title="Open in System Viewer" />
        </div>
      </div>

      {/* ── Preview content ── */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {category === 'html'     && <HtmlPreview     data={data} viewportWidth={resolvedViewportWidth} />}
        {category === 'markdown' && <MarkdownPreview data={data} zoom={zoom} />}
        {category === 'svg'      && <SvgPreview      data={data} zoom={zoom} />}
        {category === 'image'    && <ImagePreview    data={data} zoom={zoom} onZoomChange={setZoom} />}
        {category === 'audio'    && <AudioPreview    data={data} />}
        {category === 'video'    && <VideoPreview    data={data} />}
        {category === 'text'     && <TextPreview     data={data} />}
        {category === 'pdf'      && <PdfPreview      data={data} />}
        {category === 'code'     && <TextPreview     data={data} />}
      </div>
    </div>
  );
};
