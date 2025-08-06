/**
 * Viewport Manager Component
 * Handles viewport state management and coordination
 */

import React, { useRef, useCallback } from 'react';
import { ViewportGrid, ViewportLayout, ViewportState, ViewportGridRef } from '../ViewportGrid/index';
import { SynchronizationSettings } from '../SynchronizationControls/index';
import { viewportOptimizer, RenderPriority } from '../../services/viewport-optimizer';
import { log } from '../../utils/logger';
import { safePropertyAccess } from '../../lib/utils';

export interface ViewportManagerProps {
  layout: ViewportLayout;
  viewports: ViewportState[];
  seriesData: any[];
  syncSettings: SynchronizationSettings;
  onViewportChange: (viewports: ViewportState[]) => void;
  onViewportActivated: (viewportId: string) => void;
  onSeriesAssignment?: (viewportId: string, seriesIndex: number | null) => void;
  className?: string;
}

export interface ViewportManagerRef {
  getViewportRef: (viewportId: string) => any;
  setViewportTool: (viewportId: string, tool: string) => void;
  getActiveViewportId: () => string | null;
  syncViewports: () => void;
  optimizeViewport: (viewportId: string) => void;
  setViewportPriority: (viewportId: string, priority: 'critical' | 'high' | 'medium' | 'low' | 'suspended') => void;
}

const ViewportManagerComponent = React.forwardRef<ViewportManagerRef, ViewportManagerProps>(
  ({
    layout,
    viewports,
    seriesData,
    syncSettings,
    onViewportChange,
    onViewportActivated,
    onSeriesAssignment: _onSeriesAssignment,
    className = '',
  }, ref) => {
    const viewportGridRef = useRef<ViewportGridRef>(null);

    // Handle viewport activation
    const handleViewportActivated = useCallback((viewportId: string) => {
      const updatedViewports = viewports.map(viewport => ({
        ...viewport,
        isActive: viewport.id === viewportId,
      }));

      // Optimize rendering for the newly active viewport
      try {
        const renderingViewportId = `VIEWPORT_${viewportId}`;
        viewportOptimizer.optimizeRendering(renderingViewportId);

        log.info('Viewport rendering optimized', {
          component: 'ViewportManager',
          metadata: {
            activeViewportId: viewportId,
            renderingViewportId,
            totalViewports: viewports.length,
          },
        });
      } catch (error) {
        log.error('Failed to optimize viewport rendering', {
          component: 'ViewportManager',
          metadata: { viewportId },
        }, error as Error);
      }

      onViewportChange(updatedViewports);
      onViewportActivated(viewportId);
    }, [viewports, onViewportChange, onViewportActivated]);


    // Get viewport IDs for current layout
    const getViewportIds = (layout: ViewportLayout): string[] => {
      switch (layout) {
        case '1x1': return ['A'];
        case '1x2': return ['A', 'B'];
        case '2x2': return ['A', 'B', 'C', 'D'];
        default: return ['A'];
      }
    };

    // Ensure we have viewport states for current layout
    const ensureViewportStates = useCallback((): ViewportState[] => {
      const requiredIds = getViewportIds(layout);
      const currentIds = viewports.map(v => v.id);

      // Add missing viewports
      const missingIds = requiredIds.filter(id => !currentIds.includes(id));
      const newViewports = missingIds.map(id => ({
        id,
        seriesIndex: null,
        isActive: false,
        activeTool: 'WindowLevel',
      }));

      // Filter out viewports not needed for current layout
      const filteredViewports = viewports.filter(v => requiredIds.includes(v.id));

      return [...filteredViewports, ...newViewports];
    }, [layout, viewports]);

    // Update viewports when layout changes
    React.useEffect(() => {
      const requiredViewports = ensureViewportStates();
      if (JSON.stringify(requiredViewports) !== JSON.stringify(viewports)) {
        onViewportChange(requiredViewports);
      }
    }, [layout, ensureViewportStates, viewports, onViewportChange]);

    // Expose methods through ref
    React.useImperativeHandle(
      ref,
      () => ({
        getViewportRef: (viewportId: string) => {
          return viewportGridRef.current?.getViewportRef(viewportId) || null;
        },
        setViewportTool: (viewportId: string, tool: string) => {
          viewportGridRef.current?.setViewportTool(viewportId, tool);

          // Update viewport state
          const updatedViewports = viewports.map(viewport =>
            viewport.id === viewportId
              ? { ...viewport, activeTool: tool }
              : viewport,
          );
          onViewportChange(updatedViewports);
        },
        getActiveViewportId: () => {
          return viewportGridRef.current?.getActiveViewportId() || null;
        },
        syncViewports: () => {
          // Trigger synchronization
          log.info('Manual viewport synchronization triggered');
        },
        optimizeViewport: (viewportId: string) => {
          try {
            const renderingViewportId = `VIEWPORT_${viewportId}`;
            viewportOptimizer.optimizeRendering(renderingViewportId);

            log.info('Manual viewport optimization triggered', {
              component: 'ViewportManager',
              metadata: { viewportId: renderingViewportId },
            });
          } catch (error) {
            log.error('Failed to manually optimize viewport', {
              component: 'ViewportManager',
              metadata: { viewportId },
            }, error as Error);
          }
        },
        setViewportPriority: (viewportId: string, priority: 'critical' | 'high' | 'medium' | 'low' | 'suspended') => {
          try {
            const renderingViewportId = `VIEWPORT_${viewportId}`;
            // Map string priority to enum value
            const priorityMap = {
              critical: RenderPriority.CRITICAL,
              high: RenderPriority.HIGH,
              medium: RenderPriority.MEDIUM,
              low: RenderPriority.LOW,
              suspended: RenderPriority.SUSPENDED,
            };

            const mappedPriority = safePropertyAccess(priorityMap, priority);
            if (mappedPriority !== undefined) {
              viewportOptimizer.setPriority(renderingViewportId, mappedPriority);
            }

            log.info('Viewport priority set', {
              component: 'ViewportManager',
              metadata: {
                viewportId: renderingViewportId,
                priority,
                priorityValue: safePropertyAccess(priorityMap, priority),
              },
            });
          } catch (error) {
            log.error('Failed to set viewport priority', {
              component: 'ViewportManager',
              metadata: { viewportId, priority },
            }, error as Error);
          }
        },
      }),
      [viewports, onViewportChange],
    );

    // Set up viewport synchronization and optimization when viewports change
    React.useEffect(() => {
      const activeViewports = viewports.filter(v => v.seriesIndex !== null);

      if (activeViewports.length > 1) {
        // Set up synchronization between active viewports
        const viewportIds = activeViewports.map(v => `VIEWPORT_${v.id}`);

        // Initialize synchronization (this would need to be implemented in ViewportSynchronizer)
        log.info('Setting up synchronization for viewports:', viewportIds);
      }

      // Apply memory management optimization for all viewports
      try {
        viewportOptimizer.manageMemory();

        log.info('Viewport memory management applied', {
          component: 'ViewportManager',
          metadata: {
            viewportCount: viewports.length,
            activeCount: activeViewports.length,
          },
        });
      } catch (error) {
        log.error('Failed to apply viewport memory management', {
          component: 'ViewportManager',
          metadata: { viewportCount: viewports.length },
        }, error as Error);
      }
    }, [viewports, syncSettings]);

    return (
      <ViewportGrid
        ref={viewportGridRef}
        layout={layout}
        viewports={ensureViewportStates()}
        seriesData={seriesData}
        onViewportActivated={handleViewportActivated}
        className={className}
      />
    );
  },
);

ViewportManagerComponent.displayName = 'ViewportManager';

export const ViewportManager = React.memo(ViewportManagerComponent, (prevProps, nextProps) => {
  return (
    prevProps.layout === nextProps.layout &&
    JSON.stringify(prevProps.viewports) === JSON.stringify(nextProps.viewports) &&
    JSON.stringify(prevProps.syncSettings) === JSON.stringify(nextProps.syncSettings) &&
    prevProps.seriesData.length === nextProps.seriesData.length
  );
});
