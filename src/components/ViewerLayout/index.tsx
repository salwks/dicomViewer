/**
 * ViewerLayout Component
 * Main application layout for the medical imaging viewer
 */

import React, { useState, useCallback, ReactNode } from 'react';
import { useThemeStyles } from '../../theme';
import { ThemeToggle } from '../ThemeToggle';

interface ViewerLayoutProps {
  children?: ReactNode;
  toolPanel?: ReactNode;
  sidePanel?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export const ViewerLayout: React.FC<ViewerLayoutProps> = ({
  children,
  toolPanel,
  sidePanel,
  header,
  footer,
  className = '',
}) => {
  const theme = useThemeStyles();
  const [isToolPanelCollapsed, setIsToolPanelCollapsed] = useState(false);
  const [isSidePanelCollapsed, setIsSidePanelCollapsed] = useState(false);

  const toggleToolPanel = useCallback(() => {
    setIsToolPanelCollapsed(prev => !prev);
  }, []);

  const toggleSidePanel = useCallback(() => {
    setIsSidePanelCollapsed(prev => !prev);
  }, []);

  return (
    <div className={`viewer-layout ${className}`} data-theme={theme.mode}>
      {/* Header */}
      {header && (
        <header className='viewer-layout__header'>
          <div className='viewer-layout__header-content'>{header}</div>
          <div className='viewer-layout__header-actions'>
            <ThemeToggle />
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <div className='viewer-layout__body'>
        {/* Tool Panel */}
        {toolPanel && (
          <aside
            className={`viewer-layout__tool-panel ${
              isToolPanelCollapsed ? 'viewer-layout__tool-panel--collapsed' : ''
            }`}
          >
            <button
              className='viewer-layout__panel-toggle viewer-layout__panel-toggle--left'
              onClick={toggleToolPanel}
              aria-label={isToolPanelCollapsed ? 'Expand tool panel' : 'Collapse tool panel'}
              title={isToolPanelCollapsed ? 'Expand tool panel' : 'Collapse tool panel'}
            >
              <svg
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                {isToolPanelCollapsed ? <polyline points='9 18 15 12 9 6' /> : <polyline points='15 18 9 12 15 6' />}
              </svg>
            </button>
            <div className='viewer-layout__panel-content'>{toolPanel}</div>
          </aside>
        )}

        {/* Main Viewport Area */}
        <main className='viewer-layout__main'>
          <div className='viewer-layout__viewport-container'>
            {children || (
              <div className='default-viewport'>
                <div className='default-viewport__content'>
                  <div className='default-viewport__icon'>
                    <svg width='64' height='64' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1'>
                      <rect x='3' y='3' width='18' height='18' rx='2' ry='2' />
                      <circle cx='8.5' cy='8.5' r='1.5' />
                      <polyline points='21,15 16,10 5,21' />
                    </svg>
                  </div>
                  <h3>DICOM Viewer Ready</h3>
                  <p>Load medical images to begin analysis</p>
                  <div className='default-viewport__features'>
                    <span>• Multi-planar reconstruction</span>
                    <span>• Advanced measurement tools</span>
                    <span>• 3D visualization</span>
                    <span>• Annotation system</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Side Panel */}
        {sidePanel && (
          <aside
            className={`viewer-layout__side-panel ${
              isSidePanelCollapsed ? 'viewer-layout__side-panel--collapsed' : ''
            }`}
          >
            <button
              className='viewer-layout__panel-toggle viewer-layout__panel-toggle--right'
              onClick={toggleSidePanel}
              aria-label={isSidePanelCollapsed ? 'Expand side panel' : 'Collapse side panel'}
              title={isSidePanelCollapsed ? 'Expand side panel' : 'Collapse side panel'}
            >
              <svg
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                {isSidePanelCollapsed ? <polyline points='15 18 9 12 15 6' /> : <polyline points='9 18 15 12 9 6' />}
              </svg>
            </button>
            <div className='viewer-layout__panel-content'>{sidePanel}</div>
          </aside>
        )}
      </div>

      {/* Footer */}
      {footer && <footer className='viewer-layout__footer'>{footer}</footer>}
    </div>
  );
};
