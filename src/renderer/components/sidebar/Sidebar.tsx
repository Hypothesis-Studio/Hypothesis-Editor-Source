/**
 * Sidebar Component - Main sidebar container with multiple views.
 */
import React, { useState, useCallback } from 'react';
import { FileExplorer } from './FileExplorer';
import { SearchView } from '../search/SearchView';
import { GitView } from '../git/GitView';
import { ExtensionsView } from '../extensions/ExtensionsView';
import { useAppStore } from '../../stores/appStore';

interface SidebarProps {
  activeView: string;
  rootPath: string | null;
  activeFilePath?: string | null;
  onOpenFolder: () => void;
  onCloseFolder?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, rootPath, activeFilePath, onOpenFolder, onCloseFolder }) => {
  const { sidebarWidth, setSidebarWidth } = useAppStore();
  const [isResizing, setIsResizing] = useState(false);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);

      const startX = e.clientX;
      const startWidth = sidebarWidth;

      const handleMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - startX;
        const newWidth = Math.max(180, Math.min(500, startWidth + delta));
        setSidebarWidth(newWidth);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [sidebarWidth, setSidebarWidth],
  );

  const renderContent = () => {
    switch (activeView) {
      case 'explorer':
        return (
          <FileExplorer rootPath={rootPath} activeFilePath={activeFilePath} onCloseFolder={onCloseFolder} />
        );
      case 'search':
        return <SearchView />;
      case 'git':
        return <GitView repoPath={rootPath} />;
      case 'agent':
        return null; // Agent is now an editor tab, not a sidebar view
      case 'extensions':
        return <ExtensionsView />;
      default:
        return null;
    }
  };

  return (
    <div
      className="flex flex-col bg-[var(--theme-bg-secondary)] border-r border-[var(--theme-border)] relative"
      style={{ width: sidebarWidth }}
    >
      {/* Header */}
      <div className="h-10 flex items-center px-4 text-xs font-semibold text-[var(--theme-fg)] uppercase tracking-wider border-b border-[var(--theme-border)]">
        {activeView === 'explorer' && 'Explorer'}
        {activeView === 'search' && 'Search'}
        {activeView === 'git' && 'Source Control'}
        {activeView === 'agent' && 'AI Agent'}
        {activeView === 'extensions' && 'Extensions'}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">{renderContent()}</div>

      {/* Resize handle */}
      <div
        className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--theme-accent)] ${
          isResizing ? 'bg-[var(--theme-accent)]' : ''
        }`}
        onMouseDown={handleResizeStart}
      />
    </div>
  );
};
