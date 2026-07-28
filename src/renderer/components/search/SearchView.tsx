/**
 * Search View Component - Global search across files with file opening support.
 */
import React, { useState, useCallback } from 'react';
import type { SearchResult } from '../../../shared/types';
import { Icon } from '../common/Icon';
import { useEditorStore } from '../../stores/editorStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';

export const SearchView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [replaceValue, setReplaceValue] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [isWholeWord, setIsWholeWord] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const { openTab } = useEditorStore();
  const { folders } = useWorkspaceStore();
  const rootPath = folders.length > 0 ? folders[0] : null;

  const handleSearch = useCallback(async () => {
    if (!query.trim()) { setResults([]); return; }
    // Always read rootPath fresh from store at call time to avoid stale closure
    const currentRootPath = useWorkspaceStore.getState().folders[0] ?? null;
    if (!currentRootPath) { setSearchError('No folder opened. Open a folder first.'); return; }
    setIsSearching(true);
    setSearchError(null);
    try {
      const searchResults = await window.api.search.find({
        query,
        rootPath: currentRootPath,
        isRegex,
        isCaseSensitive,
        isWholeWord,
        useIgnoreFiles: true,
        followSymlinks: false,
        maxResults: 1000,
      });
      setResults(searchResults as SearchResult[]);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchError('Search failed. Check your query.');
    }
    setIsSearching(false);
  }, [query, isRegex, isCaseSensitive, isWholeWord]);

  const handleReplace = async (result: SearchResult) => {
    try {
      await window.api.search.replace({
        file: result.file,
        line: result.line,
        column: result.column,
        length: result.length,
        replace: replaceValue,
      });
      await handleSearch();
    } catch (error) {
      console.error('Replace failed:', error);
    }
  };

  const handleReplaceAll = async () => {
    try {
      const currentRootPath = useWorkspaceStore.getState().folders[0] ?? undefined;
      await window.api.search.replaceAll({
        query,
        replace: replaceValue,
        rootPath: currentRootPath,
        isRegex,
        isCaseSensitive,
        isWholeWord,
      });
      await handleSearch();
    } catch (error) {
      console.error('Replace all failed:', error);
    }
  };

  const openFileAtResult = async (filePath: string, line: number) => {
    try {
      const content = await window.api.file.read(filePath);
      const ext = filePath.split('.').pop() || '';
      const fileName = filePath.split(/[/\\]/).pop() || '';
      const langMap: Record<string, string> = {
        ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact',
        py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', c: 'c', cpp: 'cpp',
        h: 'c', hpp: 'cpp', cs: 'csharp', swift: 'swift', kt: 'kotlin', php: 'php',
        html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less', json: 'json',
        xml: 'xml', yaml: 'yaml', yml: 'yaml', toml: 'toml', md: 'markdown', sql: 'sql',
        sh: 'shell', bash: 'shell', zsh: 'shell', ps1: 'powershell', bat: 'bat', cmd: 'bat',
        dockerfile: 'dockerfile', txt: 'plaintext',
      };
      openTab({
        id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        filePath, fileName, language: langMap[ext.toLowerCase()] || 'plaintext', content,
        isDirty: false, isPinned: false, isPreview: false, viewState: null,
        scrollTop: 0, scrollLeft: 0, cursorPosition: { line, column: 1 },
        encoding: 'UTF-8', lineEnding: 'LF', savedContent: content,
        createdAt: Date.now(), modifiedAt: Date.now(),
      });
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  };

  const groupedResults = results.reduce<Record<string, SearchResult[]>>((acc, result) => {
    if (!acc[result.file]) acc[result.file] = [];
    acc[result.file].push(result);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--theme-bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--theme-border)' }}>
        <span className="text-xs font-semibold" style={{ color: 'var(--theme-fg)' }}>Search</span>
      </div>

      {/* Search input */}
      <div className="p-2 space-y-2" style={{ borderBottom: '1px solid var(--theme-border)' }}>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowReplace(!showReplace)}
            className="p-1 rounded" style={{ color: 'var(--theme-fg-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
            title="Toggle Replace"
          >
            <Icon name="chevron-right" size={12} className={`transform transition-transform ${showReplace ? 'rotate-90' : ''}`} style={{ color: 'var(--theme-fg)' }} />
          </button>
          <input
            type="text" value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search..."
            className="input flex-1 text-xs"
          />
          <div className="flex">
            <button onClick={() => setIsRegex(!isRegex)} className="px-1.5 py-0.5 text-xs border"
              style={isRegex ? { background: 'var(--theme-accent)', color: '#ffffff', borderColor: 'var(--theme-accent)' } : { color: 'var(--theme-fg-muted)', borderColor: 'transparent' }}
              title="Regex"
            >.*</button>
            <button onClick={() => setIsCaseSensitive(!isCaseSensitive)} className="px-1.5 py-0.5 text-xs border"
              style={isCaseSensitive ? { background: 'var(--theme-accent)', color: '#ffffff', borderColor: 'var(--theme-accent)' } : { color: 'var(--theme-fg-muted)', borderColor: 'transparent' }}
              title="Case Sensitive"
            >Aa</button>
            <button onClick={() => setIsWholeWord(!isWholeWord)} className="px-1.5 py-0.5 text-xs border"
              style={isWholeWord ? { background: 'var(--theme-accent)', color: '#ffffff', borderColor: 'var(--theme-accent)' } : { color: 'var(--theme-fg-muted)', borderColor: 'transparent' }}
              title="Whole Word"
            >ab</button>
          </div>
        </div>

        {showReplace && (
          <div className="flex items-center gap-1">
            <div className="w-5" />
            <input type="text" value={replaceValue} onChange={(e) => setReplaceValue(e.target.value)} placeholder="Replace..." className="input flex-1 text-xs" />
            <button onClick={handleReplaceAll} className="px-2 py-0.5 text-xs rounded" style={{ color: 'var(--theme-fg)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-hover)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
              title="Replace All"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {isSearching && (
          <div className="p-4 text-center text-xs" style={{ color: 'var(--theme-fg-muted)' }}>Searching...</div>
        )}

        {searchError && (
          <div className="p-4 text-center text-xs" style={{ color: 'var(--theme-error)' }}>{searchError}</div>
        )}

        {!isSearching && !searchError && results.length === 0 && query && (
          <div className="p-4 text-center text-xs" style={{ color: 'var(--theme-fg-muted)' }}>No results found</div>
        )}

        {!isSearching && Object.entries(groupedResults).map(([file, fileResults]) => (
          <div key={file} className="mb-1">
            <div className="flex items-center px-2 py-1.5 text-xs" style={{ color: 'var(--theme-fg)', background: 'var(--theme-bg-tertiary)' }}>
              <Icon name="document" size={12} className="mr-1.5 flex-shrink-0" />
              <span className="truncate flex-1 font-medium">
                {file.split('/').pop()}
                <span className="ml-1 font-normal" style={{ color: 'var(--theme-fg-muted)' }}>({fileResults.length})</span>
              </span>
              <span className="text-[10px] ml-2 truncate max-w-[120px]" style={{ color: 'var(--theme-fg-muted)' }}>
                {file.substring(0, file.lastIndexOf('/'))}
              </span>
            </div>
            {fileResults.map((result, idx) => (
              <div key={idx} className="flex items-center px-4 py-0.5 text-xs cursor-pointer group"
                style={{ color: 'var(--theme-fg)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
                onClick={() => openFileAtResult(file, result.line)}
              >
                <span className="w-10 text-right mr-2 flex-shrink-0" style={{ color: 'var(--theme-fg-muted)' }}>{result.line}</span>
                <span className="truncate flex-1">
                  {result.preview.before}
                  <span style={{ background: 'var(--theme-editor-selection)', color: 'var(--theme-fg)' }}>{result.preview.match}</span>
                  {result.preview.after}
                </span>
                {showReplace && (
                  <button onClick={(e) => { e.stopPropagation(); handleReplace(result); }}
                    className="opacity-0 group-hover:opacity-100 px-1" style={{ color: 'var(--theme-fg-muted)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
                    title="Replace"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      {results.length > 0 && (
        <div className="px-3 py-1.5 text-[10px]" style={{ borderTop: '1px solid var(--theme-border)', color: 'var(--theme-fg-muted)' }}>
          {results.length} result{results.length !== 1 ? 's' : ''} in {Object.keys(groupedResults).length} file{Object.keys(groupedResults).length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};
