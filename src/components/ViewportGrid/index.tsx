/**
 * ViewportGrid Component
 * Multi-viewport layout manager for medical imaging viewer
 */

/* eslint-disable security/detect-object-injection */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import './styles.css';

export interface ViewportConfig {
  id: string;
  seriesInstanceUID?: string;
  studyInstanceUID?: string;
  sopInstanceUID?: string;
  orientation?: 'axial' | 'sagittal' | 'coronal' | 'oblique';
  windowLevel?: { window: number; level: number };
  zoom?: number;
  pan?: { x: number; y: number };
  isActive?: boolean;
  isLinked?: boolean;
}

export interface GridLayout {
  rows: number;
  columns: number;
  name: string;
  description: string;
}

interface ViewportGridProps {
  viewports: ViewportConfig[];
  activeViewportId?: string;
  layout?: GridLayout;
  onViewportClick?: (viewportId: string) => void;
  onViewportDoubleClick?: (viewportId: string) => void;
  onLayoutChange?: (layout: GridLayout) => void;
  onViewportConfigChange?: (viewportId: string, config: Partial<ViewportConfig>) => void;
  enableSynchronization?: boolean;
  enableDragDrop?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const DEFAULT_LAYOUTS: GridLayout[] = [
  { rows: 1, columns: 1, name: '1x1', description: 'Single viewport' },
  { rows: 1, columns: 2, name: '1x2', description: 'Two viewports side by side' },
  { rows: 2, columns: 1, name: '2x1', description: 'Two viewports stacked' },
  { rows: 2, columns: 2, name: '2x2', description: 'Four viewports in grid' },
  { rows: 1, columns: 3, name: '1x3', description: 'Three viewports horizontal' },
  { rows: 3, columns: 1, name: '3x1', description: 'Three viewports vertical' },
  { rows: 2, columns: 3, name: '2x3', description: 'Six viewports grid' },
  { rows: 3, columns: 3, name: '3x3', description: 'Nine viewports grid' },
];

export const ViewportGrid: React.FC<ViewportGridProps> = ({
  viewports,
  activeViewportId,
  layout = DEFAULT_LAYOUTS[0],
  onViewportClick,
  onViewportDoubleClick,
  onLayoutChange,
  onViewportConfigChange: _onViewportConfigChange,
  enableSynchronization = false,
  enableDragDrop = false,
  className = '',
  children,
}) => {
  const [draggedViewport, setDraggedViewport] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Calculate total number of viewports needed for current layout
  const totalViewports = layout.rows * layout.columns;

  // Create viewport grid with proper indexing
  const viewportGrid = useMemo(() => {
    const grid: (ViewportConfig | null)[] = new Array(totalViewports).fill(null);

    // Fill grid with existing viewports
    viewports.slice(0, totalViewports).forEach((viewport, index) => {
      grid[index] = viewport;
    });

    return grid;
  }, [viewports, totalViewports]);

  const handleViewportClick = useCallback((viewportId: string | null, _index: number) => {
    if (viewportId && onViewportClick) {
      onViewportClick(viewportId);
    }
  }, [onViewportClick]);

  const handleViewportDoubleClick = useCallback((viewportId: string | null) => {
    if (viewportId && onViewportDoubleClick) {
      onViewportDoubleClick(viewportId);
    }
  }, [onViewportDoubleClick]);

  const handleLayoutSelect = useCallback((newLayout: GridLayout) => {
    if (onLayoutChange) {
      onLayoutChange(newLayout);
    }
  }, [onLayoutChange]);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, viewportId: string) => {
    if (!enableDragDrop) return;

    setDraggedViewport(viewportId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', viewportId);
  }, [enableDragDrop]);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    if (!enableDragDrop || !draggedViewport) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, [enableDragDrop, draggedViewport]);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, _targetIndex: number) => {
    if (!enableDragDrop || !draggedViewport) return;

    e.preventDefault();

    const sourceViewport = viewports.find(v => v.id === draggedViewport);
    if (!sourceViewport) return;

    // Handle viewport reordering logic here
    // This would typically involve updating the viewport order

    setDraggedViewport(null);
    setDragOverIndex(null);
  }, [enableDragDrop, draggedViewport, viewports]);

  const handleDragEnd = useCallback(() => {
    setDraggedViewport(null);
    setDragOverIndex(null);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeViewportId) return;

      const currentIndex = viewportGrid.findIndex(v => v?.id === activeViewportId);
      if (currentIndex === -1) return;

      let newIndex = currentIndex;

      switch (e.key) {
        case 'ArrowLeft':
          if (currentIndex % layout.columns > 0) {
            newIndex = currentIndex - 1;
          }
          break;
        case 'ArrowRight':
          if (currentIndex % layout.columns < layout.columns - 1) {
            newIndex = currentIndex + 1;
          }
          break;
        case 'ArrowUp':
          if (Math.floor(currentIndex / layout.columns) > 0) {
            newIndex = currentIndex - layout.columns;
          }
          break;
        case 'ArrowDown':
          if (Math.floor(currentIndex / layout.columns) < layout.rows - 1) {
            newIndex = currentIndex + layout.columns;
          }
          break;
        default:
          return;
      }

      const targetViewport = viewportGrid[newIndex];
      if (targetViewport && onViewportClick) {
        e.preventDefault();
        onViewportClick(targetViewport.id);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeViewportId, viewportGrid, layout, onViewportClick]);

  return (
    <div className={`viewport-grid ${className}`}>
      {/* Layout Selector */}
      <div className="viewport-grid__header">
        <div className="viewport-grid__layout-selector">
          <label className="viewport-grid__layout-label">Layout:</label>
          <div className="viewport-grid__layout-options">
            {DEFAULT_LAYOUTS.map((layoutOption) => (
              <button
                key={layoutOption.name}
                className={`viewport-grid__layout-option ${
                  layout.name === layoutOption.name ? 'viewport-grid__layout-option--active' : ''
                }`}
                onClick={() => handleLayoutSelect(layoutOption)}
                title={layoutOption.description}
                aria-label={`Select ${layoutOption.description}`}
              >
                <div className="viewport-grid__layout-preview">
                  <div
                    className="viewport-grid__layout-preview-grid"
                    style={{
                      gridTemplateRows: `repeat(${layoutOption.rows}, 1fr)`,
                      gridTemplateColumns: `repeat(${layoutOption.columns}, 1fr)`,
                    }}
                  >
                    {Array.from({ length: layoutOption.rows * layoutOption.columns }).map((_, i) => (
                      <div key={i} className="viewport-grid__layout-preview-cell" />
                    ))}
                  </div>
                </div>
                <span className="viewport-grid__layout-name">{layoutOption.name}</span>
              </button>
            ))}
          </div>
        </div>

        {enableSynchronization && (
          <div className="viewport-grid__sync-controls">
            <label className="viewport-grid__sync-label">
              <input
                type="checkbox"
                className="viewport-grid__sync-checkbox"
              />
              Synchronize Viewports
            </label>
          </div>
        )}
      </div>

      {/* Viewport Grid */}
      <div
        ref={gridRef}
        className="viewport-grid__container"
        style={{
          gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
          gridTemplateColumns: `repeat(${layout.columns}, 1fr)`,
        }}
      >
        {viewportGrid.map((viewport, index) => (
          <div
            key={viewport?.id || `empty-${index}`}
            className={`viewport-grid__viewport ${
              viewport?.id === activeViewportId ? 'viewport-grid__viewport--active' : ''
            } ${
              viewport?.isLinked ? 'viewport-grid__viewport--linked' : ''
            } ${
              dragOverIndex === index ? 'viewport-grid__viewport--drag-over' : ''
            }`}
            onClick={() => handleViewportClick(viewport?.id || null, index)}
            onDoubleClick={() => handleViewportDoubleClick(viewport?.id || null)}
            draggable={enableDragDrop && !!viewport}
            onDragStart={(e) => viewport && handleDragStart(e, viewport.id)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            role="button"
            tabIndex={0}
            aria-label={viewport
              ? `Viewport ${index + 1}: ${viewport.orientation || 'Unknown orientation'}`
              : `Empty viewport ${index + 1}`}
          >
            {viewport ? (
              <>
                {/* Viewport Content */}
                <div className="viewport-grid__viewport-content">
                  {children}
                </div>

                {/* Viewport Info Overlay */}
                <div className="viewport-grid__viewport-info">
                  <div className="viewport-grid__viewport-orientation">
                    {viewport.orientation || 'Unknown'}
                  </div>
                  {viewport.isLinked && (
                    <div className="viewport-grid__viewport-link-indicator">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1z
                              M8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Viewport Controls */}
                <div className="viewport-grid__viewport-controls">
                  <button
                    className="viewport-grid__viewport-control"
                    title="Viewport settings"
                    aria-label="Open viewport settings"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M12 1v6m0 10v6m11-7h-6m-10 0H1m15.5-6.5l-4.24 4.24M7.5 7.5l-4.24-4.24m0 12.73l4.24-4.24m9.73 4.24l-4.24-4.24" />
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              <div className="viewport-grid__empty-viewport">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="12" cy="12" r="1"/>
                </svg>
                <span>Empty Viewport</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
