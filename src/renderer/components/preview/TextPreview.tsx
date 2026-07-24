/**
 * Text Preview — Syntax-highlighted text/code preview.
 * Uses Monaco editor in read-only mode for code files,
 * or plain styled text for .txt/.log files.
 */
import React, { useEffect, useRef } from 'react';
import type { PreviewData } from '../../../shared/types/preview';

interface TextPreviewProps {
  data: PreviewData;
}

// Map file extensions to Monaco language IDs
const EXT_TO_LANG: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescriptreact', '.js': 'javascript', '.jsx': 'javascriptreact',
  '.json': 'json', '.html': 'html', '.htm': 'html', '.css': 'css', '.scss': 'scss',
  '.py': 'python', '.rb': 'ruby', '.go': 'go', '.rs': 'rust', '.java': 'java',
  '.c': 'c', '.cpp': 'cpp', '.h': 'c', '.hpp': 'cpp', '.cs': 'csharp',
  '.swift': 'swift', '.kt': 'kotlin', '.php': 'php', '.sh': 'shell', '.bash': 'shell',
  '.sql': 'sql', '.xml': 'xml', '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
  '.md': 'markdown', '.graphql': 'graphql', '.dockerfile': 'dockerfile',
  '.lua': 'lua', '.r': 'r', '.dart': 'dart', '.ex': 'elixir', '.exs': 'elixir',
  '.scala': 'scala', '.vue': 'html', '.svelte': 'html',
  '.txt': 'plaintext', '.log': 'plaintext', '.ini': 'ini', '.cfg': 'plaintext',
  '.conf': 'plaintext', '.env': 'plaintext', '.gitignore': 'plaintext',
};

export const TextPreview: React.FC<TextPreviewProps> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !data.content) return;

    let disposed = false;

    const loadMonaco = async () => {
      try {
        const monaco = await import('monaco-editor');
        if (disposed || !containerRef.current) return;

        // Clean up previous editor
        if (editorRef.current) {
          editorRef.current.dispose();
        }

        const ext = getExtension(data.filePath);
        const language = EXT_TO_LANG[ext] || 'plaintext';

        const model = monaco.editor.createModel(data.content ?? '', language);
        const editor = monaco.editor.create(containerRef.current, {
          model,
          readOnly: true,
          domReadOnly: true,
          fontSize: 13,
          lineNumbers: 'on',
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          folding: true,
          bracketPairColorization: { enabled: true },
          renderLineHighlight: 'none',
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
          padding: { top: 12, bottom: 12 },
          theme: getMonacoTheme(),
          automaticLayout: true,
        });

        editorRef.current = editor;
      } catch {
        // Monaco not available — fall back to plain text
      }
    };

    loadMonaco();

    return () => {
      disposed = true;
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, [data.content, data.filePath]);

  if (!data.content) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ color: 'var(--theme-fg-muted)', fontSize: 12 }}>No content to display</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', background: 'var(--theme-bg)' }}
    />
  );
};

function getExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  return lastDot >= 0 ? filePath.slice(lastDot).toLowerCase() : '';
}

function getMonacoTheme(): string {
  // Try to detect current theme
  const themeId = (window as any).__hypothesis_theme || 'hypothesis-dark';
  if (themeId.includes('light')) return 'vs';
  if (themeId.includes('hc')) return 'hc-black';
  return 'vs-dark';
}
