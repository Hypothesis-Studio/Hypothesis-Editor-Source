/**
 * Breadcrumb Component - Shows file path and symbol context.
 */
import React from 'react';
import type { EditorTab } from '../../../shared/types';

interface BreadcrumbProps {
  tab: EditorTab;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ tab }) => {
  if (!tab.filePath) return null;

  const parts = tab.filePath.split(/[/\\]/);
  const fileName = parts.pop() || '';
  const folderParts = parts.slice(-3); // Show last 3 folder levels

  return (
    <div className="breadcrumb">
      {folderParts.map((part, index) => (
        <React.Fragment key={index}>
          <span className="breadcrumb-item">{part}</span>
          <span className="breadcrumb-separator">/</span>
        </React.Fragment>
      ))}
      <span className="breadcrumb-item" style={{ color: 'var(--theme-fg)' }}>{fileName}</span>
    </div>
  );
};
