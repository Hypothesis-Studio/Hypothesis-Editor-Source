/**
 * Markdown Preview — Renders Markdown with styled HTML output.
 */
import React, { useMemo } from 'react';
import type { PreviewData } from '../../../shared/types/preview';

interface MarkdownPreviewProps {
  data: PreviewData;
  zoom: number;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ data, zoom }) => {
  const html = data.renderedHtml || data.content || '';

  const styledHtml = useMemo(() => wrapWithStyles(html), [html]);

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--theme-bg)' }}>
      <div
        className="markdown-preview"
        style={{
          maxWidth: 860,
          margin: '0 auto',
          padding: '24px 32px',
          fontSize: `${zoom}%`,
          lineHeight: 1.7,
          color: 'var(--theme-fg)',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}
        dangerouslySetInnerHTML={{ __html: styledHtml }}
      />
    </div>
  );
};

function wrapWithStyles(html: string): string {
  return html;
}
