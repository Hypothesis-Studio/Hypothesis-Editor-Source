/**
 * Welcome Page Component - Shown when no files are open.
 */
import React from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { useThemeStore } from '../../stores/themeStore';
import { APP_NAME, APP_VERSION, APP_DESCRIPTION } from '../../../shared/utils/appMeta';

const iconLight = new URL('../../assets/icons/icon-light.png', import.meta.url).href;
const iconDark = new URL('../../assets/icons/icon-dark.png', import.meta.url).href;

interface WelcomePageProps {
  onOpenFolder?: (path: string) => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({ onOpenFolder }) => {
  const { openTab } = useEditorStore();
  const currentTheme = useThemeStore((s) => s.currentTheme);
  const isLight = currentTheme.includes('light') || currentTheme === 'vs';
  const iconSrc = isLight ? iconDark : iconLight;

  const handleOpenFile = async () => {
    try {
      const result = await window.api.file.open();
      if (result) {
        result.forEach(({ filePath, content }: { filePath: string; content: string }) => {
          const ext = filePath.split('.').pop() || '';
          const language = getLanguageFromExtension(ext);
          const fileName = filePath.split(/[/\\]/).pop() || '';

          openTab({
            id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            filePath, fileName, language, content, isDirty: false, isPinned: false,
            isPreview: true, viewState: null, scrollTop: 0, scrollLeft: 0,
            cursorPosition: { line: 1, column: 1 }, encoding: 'UTF-8', lineEnding: 'LF',
            savedContent: content, createdAt: Date.now(), modifiedAt: Date.now(),
          });
        });
      }
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  };

  const handleOpenFolder = async () => {
    try {
      const result = await window.api.file.dialogOpen({
        properties: ['openDirectory'],
      });
      if (!result.canceled && result.filePaths.length > 0) {
        onOpenFolder?.(result.filePaths[0]);
      }
    } catch (error) {
      console.error('Failed to open folder:', error);
    }
  };

  const handleNewFile = () => {
    openTab({
      id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      filePath: null, fileName: 'Untitled-1', language: 'plaintext', content: '',
      isDirty: false, isPinned: false, isPreview: true, viewState: null,
      scrollTop: 0, scrollLeft: 0, cursorPosition: { line: 1, column: 1 },
      encoding: 'UTF-8', lineEnding: 'LF', savedContent: '',
      createdAt: Date.now(), modifiedAt: Date.now(),
    });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="mb-8">
        <div className="mb-4 flex justify-center"><img src={iconSrc} alt="Hypothesis" style={{ width: 96, height: 96 }} /></div>
        <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--theme-fg)' }}>{APP_NAME}</h1>
        <p className="text-sm" style={{ color: 'var(--theme-fg-muted)' }}>{APP_DESCRIPTION}</p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs mb-8">
        <button onClick={handleNewFile} className="btn btn-primary justify-center py-3">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New File
        </button>
        <button onClick={handleOpenFile} className="btn btn-secondary justify-center py-3">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
          </svg>
          Open File
        </button>
        <button onClick={handleOpenFolder} className="btn btn-secondary justify-center py-3">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          Open Folder
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs" style={{ color: 'var(--theme-fg-muted)' }}>
        <div className="text-left">
          <p><kbd className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg)' }}>Ctrl+N</kbd><span className="ml-2">New File</span></p>
          <p><kbd className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg)' }}>Ctrl+O</kbd><span className="ml-2">Open File</span></p>
          <p><kbd className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg)' }}>Ctrl+S</kbd><span className="ml-2">Save</span></p>
        </div>
        <div className="text-left">
          <p><kbd className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg)' }}>Ctrl+P</kbd><span className="ml-2">Quick Open</span></p>
          <p><kbd className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg)' }}>Ctrl+Shift+P</kbd><span className="ml-2">Command Palette</span></p>
          <p><kbd className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg)' }}>Ctrl+`</kbd><span className="ml-2">Terminal</span></p>
        </div>
      </div>

      <div className="mt-8 text-xs" style={{ color: 'var(--theme-fg-dim)' }}>Version {APP_VERSION}</div>
    </div>
  );
};

function getLanguageFromExtension(ext: string): string {
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
    c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp',
    swift: 'swift', kt: 'kotlin', php: 'php', html: 'html', htm: 'html',
    css: 'css', scss: 'scss', less: 'less', json: 'json', xml: 'xml',
    yaml: 'yaml', yml: 'yaml', toml: 'toml', md: 'markdown', sql: 'sql',
    sh: 'shell', bash: 'shell', zsh: 'shell', ps1: 'powershell',
    bat: 'bat', cmd: 'bat', dockerfile: 'dockerfile', txt: 'plaintext',
  };
  return langMap[ext.toLowerCase()] || 'plaintext';
}
