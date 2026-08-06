/**
 * Markdown Preview — Renders Markdown with styled HTML output.
 * Follows system/app theme (light & dark).
 */
import React, { useMemo, useEffect, useRef } from 'react';
import { useThemeStore } from '../../stores/themeStore';
import type { PreviewData } from '../../../shared/types/preview';

interface MarkdownPreviewProps {
  data: PreviewData;
  zoom: number;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ data, zoom }) => {
  const html = data.renderedHtml || data.content || '';
  const { currentTheme } = useThemeStore();
  const isDark = currentTheme !== 'hypothesis-light';

  const styledHtml = useMemo(() => html, [html]);

  return (
    <div style={{
      height: '100%',
      overflow: 'auto',
      background: isDark ? '#1e1e1e' : '#ffffff',
      // smooth theme transition
      transition: 'background 0.2s',
    }}>
      {/* Inject markdown styles scoped to this preview */}
      <style>{getMarkdownStyles(isDark, zoom)}</style>
      <div
        className="md-preview-body"
        dangerouslySetInnerHTML={{ __html: styledHtml }}
      />
    </div>
  );
};

function getMarkdownStyles(isDark: boolean, zoom: number): string {
  const c = isDark
    ? {
        bg: '#1e1e1e',
        fg: '#cccccc',
        fgMuted: '#858585',
        border: '#3c3c3c',
        codeBg: '#252526',
        blockquoteBorder: '#555',
        blockquoteFg: '#999',
        linkColor: '#4fc1ff',
        hrColor: '#3c3c3c',
        tableBorder: '#3c3c3c',
        tableHeaderBg: '#2a2a2a',
        tableAltBg: '#252525',
        h1BorderColor: '#3c3c3c',
      }
    : {
        bg: '#ffffff',
        fg: '#24292e',
        fgMuted: '#57606a',
        border: '#d0d7de',
        codeBg: '#f6f8fa',
        blockquoteBorder: '#d0d7de',
        blockquoteFg: '#57606a',
        linkColor: '#0969da',
        hrColor: '#d0d7de',
        tableBorder: '#d0d7de',
        tableHeaderBg: '#f6f8fa',
        tableAltBg: '#f6f8fa',
        h1BorderColor: '#d0d7de',
      };

  return `
    .md-preview-body {
      max-width: 780px;
      margin: 0 auto;
      padding: 40px 48px;
      font-size: ${zoom / 100 * 15}px;
      line-height: 1.75;
      color: ${c.fg};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Helvetica, Arial, sans-serif;
      word-break: break-word;
    }
    @media (max-width: 680px) {
      .md-preview-body { padding: 24px 20px; }
    }
    .md-preview-body h1, .md-preview-body h2, .md-preview-body h3,
    .md-preview-body h4, .md-preview-body h5, .md-preview-body h6 {
      color: ${c.fg};
      font-weight: 600;
      line-height: 1.25;
      margin-top: 1.75em;
      margin-bottom: 0.6em;
    }
    .md-preview-body h1 { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid ${c.h1BorderColor}; }
    .md-preview-body h2 { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid ${c.h1BorderColor}; }
    .md-preview-body h3 { font-size: 1.25em; }
    .md-preview-body h4 { font-size: 1em; }
    .md-preview-body h5 { font-size: 0.875em; }
    .md-preview-body h6 { font-size: 0.85em; color: ${c.fgMuted}; }
    .md-preview-body p { margin: 0 0 1em; }
    .md-preview-body a { color: ${c.linkColor}; text-decoration: none; }
    .md-preview-body a:hover { text-decoration: underline; }
    .md-preview-body strong { font-weight: 600; }
    .md-preview-body em { font-style: italic; }
    .md-preview-body code {
      font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
      font-size: 0.875em;
      background: ${c.codeBg};
      color: ${isDark ? '#ce9178' : '#d01040'};
      padding: 0.2em 0.4em;
      border-radius: 4px;
      border: 1px solid ${c.border};
    }
    .md-preview-body pre {
      background: ${c.codeBg};
      border: 1px solid ${c.border};
      border-radius: 6px;
      padding: 16px 20px;
      overflow-x: auto;
      margin: 1em 0 1.25em;
    }
    .md-preview-body pre code {
      background: none;
      border: none;
      padding: 0;
      font-size: 0.875em;
      color: ${c.fg};
      border-radius: 0;
    }
    .md-preview-body blockquote {
      border-left: 4px solid ${c.blockquoteBorder};
      color: ${c.blockquoteFg};
      margin: 1em 0;
      padding: 0.25em 0 0.25em 1em;
    }
    .md-preview-body blockquote p { margin: 0; }
    .md-preview-body ul, .md-preview-body ol { margin: 0 0 1em; padding-left: 2em; }
    .md-preview-body li { margin: 0.25em 0; }
    .md-preview-body li + li { margin-top: 0.25em; }
    .md-preview-body hr {
      border: none;
      border-top: 1px solid ${c.hrColor};
      margin: 2em 0;
    }
    .md-preview-body img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      display: block;
      margin: 1em 0;
    }
    .md-preview-body table {
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0 1.25em;
      font-size: 0.9em;
    }
    .md-preview-body th, .md-preview-body td {
      border: 1px solid ${c.tableBorder};
      padding: 8px 12px;
      text-align: left;
    }
    .md-preview-body th {
      background: ${c.tableHeaderBg};
      font-weight: 600;
    }
    .md-preview-body tr:nth-child(even) td { background: ${c.tableAltBg}; }
    .md-preview-body input[type="checkbox"] { margin-right: 6px; }
    .md-preview-body details { margin: 1em 0; }
    .md-preview-body summary { cursor: pointer; font-weight: 600; }
  `;
}
