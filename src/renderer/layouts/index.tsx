/**
 * Layout Components - Application layout wrappers.
 */
import React from 'react';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--editor-bg)] text-[var(--editor-fg)]">
      {children}
    </div>
  );
};

interface PanelLayoutProps {
  sidebar?: React.ReactNode;
  main: React.ReactNode;
  panel?: React.ReactNode;
  sidebarWidth?: number;
  panelHeight?: number;
  sidebarPosition?: 'left' | 'right';
  panelPosition?: 'bottom' | 'right';
}

export const PanelLayout: React.FC<PanelLayoutProps> = ({
  sidebar,
  main,
  panel,
  sidebarWidth = 260,
  panelHeight = 250,
  sidebarPosition = 'left',
  panelPosition = 'bottom',
}) => {
  const isHorizontalPanel = panelPosition === 'right';

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar - left */}
      {sidebar && sidebarPosition === 'left' && (
        <div style={{ width: sidebarWidth }} className="flex-shrink-0 overflow-hidden">
          {sidebar}
        </div>
      )}

      {/* Main + Panel */}
      <div className={`flex flex-1 overflow-hidden ${isHorizontalPanel ? '' : 'flex-col'}`}>
        {/* Main editor */}
        <div className="flex-1 overflow-hidden">{main}</div>

        {/* Panel */}
        {panel && (
          <div
            className="flex-shrink-0 overflow-hidden"
            style={isHorizontalPanel ? { width: panelHeight, borderTop: '1px solid var(--theme-border)' } : { height: panelHeight, borderTop: '1px solid var(--theme-border)' }}
          >
            {panel}
          </div>
        )}
      </div>

      {/* Sidebar - right */}
      {sidebar && sidebarPosition === 'right' && (
        <div style={{ width: sidebarWidth }} className="flex-shrink-0 overflow-hidden">
          {sidebar}
        </div>
      )}
    </div>
  );
};
