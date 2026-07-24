/**
 * HTML Preview — Renders HTML content in a sandboxed iframe.
 */
import React, { useRef, useEffect, useState } from 'react';
import type { PreviewData } from '../../../shared/types/preview';

interface HtmlPreviewProps {
  data: PreviewData;
}

export const HtmlPreview: React.FC<HtmlPreviewProps> = ({ data }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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
  }, [data.content, data.filePath]);

  if (loadError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
        <div style={{ color: '#f87171', fontSize: 12 }}>{loadError}</div>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      title={data.fileName}
      sandbox="allow-scripts allow-same-origin"
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        background: '#fff',
      }}
    />
  );
};
