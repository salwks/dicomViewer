/**
 * ViewportGrid Component
 * Flexible viewport grid system supporting 1x1, 1x2, and 2x2 layouts with responsive sizing
 * Enhanced with smooth transitions, responsive design, and accessibility features
 * Built with shadcn/ui components and security compliance
 */

import React, {
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { Badge } from '../ui/badge';
import { DicomViewer, DicomViewerRef } from '../DicomViewer';
import { CrossReferenceLines, CrossReferenceLine } from '../CrossReferenceLines/index';
import { cn, safePropertyAccess } from '../../lib/utils';
import { log } from '../../utils/logger';

export type ViewportLayout = '1x1' | '1x2' | '2x2';

export interface ViewportState {
  id: string;
  seriesIndex: number | null;
  isActive: boolean;
  activeTool: string;
  windowLevel?: { width: number; center: number };
  zoom?: number;
  pan?: { x: number; y: number };
}

export interface ViewportGridProps {
  layout: ViewportLayout;
  viewports: ViewportState[];
  seriesData: any[];
  onViewportActivated: (id: string) => void;
  showCrossReferenceLines?: boolean;
  crossReferenceOpacity?: number;
  className?: string;
  enableAnimations?: boolean;
  responsiveBreakpoint?: number;
  onLayoutTransition?: (fromLayout: ViewportLayout, toLayout: ViewportLayout) => void;
  onViewportResize?: (viewportId: string, dimensions: { width: number; height: number }) => void;
}

export interface ViewportGridRef {
  getViewportRef: (viewportId: string) => DicomViewerRef | null;
  setViewportTool: (viewportId: string, tool: string) => void;
  getActiveViewportId: () => string | null;
}

// Viewport color mapping using shadcn/ui badge variants (for future use)
// const VIEWPORT_COLORS = {
//   A: 'default',
//   B: 'secondary',
//   C: 'outline',
//   D: 'destructive',
// } as const;

// Enhanced grid configuration with responsive design
interface GridConfig {
  gridTemplate: string;
  viewportCount: number;
  viewportIds: string[];
  aspectRatio: string;
  minViewportSize: string;
  gridGap: string;
}

const ViewportGridComponent = forwardRef<ViewportGridRef, ViewportGridProps>(
  ({
    layout,
    viewports,
    seriesData,
    onViewportActivated,
    showCrossReferenceLines = false,
    crossReferenceOpacity = 0.8,
    className = '',
    enableAnimations = true,
    responsiveBreakpoint = 768,
    onLayoutTransition,
    onViewportResize,
  }, ref) => {
    const viewportRefs = useRef<Map<string, DicomViewerRef | null>>(new Map());
    const canvasRefs = useRef<Map<string, React.RefObject<HTMLCanvasElement>>>(new Map());
    const containerRef = useRef<HTMLDivElement>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);

    const [crossReferenceLines, setCrossReferenceLines] = useState<CrossReferenceLine[]>([]);
    const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
    const [previousLayout, setPreviousLayout] = useState<ViewportLayout | null>(null);

    // Initialize canvas refs for each viewport
    useEffect(() => {
      const layoutConfigs = {
        '1x1': { viewportIds: ['A'] },
        '1x2': { viewportIds: ['A', 'B'] },
        '2x2': { viewportIds: ['A', 'B', 'C', 'D'] },
      };
      const config = safePropertyAccess(layoutConfigs, layout);
      config?.viewportIds.forEach(id => {
        if (!canvasRefs.current.has(id)) {
          const ref = React.createRef<HTMLCanvasElement>() as React.RefObject<HTMLCanvasElement>;
          canvasRefs.current.set(id, ref);
        }
      });
    }, [layout]);

    // Update cross-reference lines when viewports change
    useEffect(() => {
      if (!showCrossReferenceLines) return;

      const updateCrossReferenceLines = (): void => {
        const lines: CrossReferenceLine[] = [];
        const activeViewport = viewports.find(v => v.isActive);

        if (!activeViewport) return;

        // Create cross-reference lines from active viewport to all others
        viewports.forEach(viewport => {
          if (viewport.id !== activeViewport.id && viewport.seriesIndex !== null) {
            // Generate unique color based on viewport position
            const color = viewport.id === 'B' ? '#22c55e' :
              viewport.id === 'C' ? '#3b82f6' :
                viewport.id === 'D' ? '#a855f7' : '#ef4444';

            lines.push({
              id: `${activeViewport.id}-${viewport.id}`,
              sourcePoint: {
                x: 256, // Center point - would be calculated from actual viewport
                y: 256,
                viewportId: activeViewport.id,
              },
              targetPoint: {
                x: 256, // Center point - would be calculated from actual viewport
                y: 256,
                viewportId: viewport.id,
              },
              color,
              visible: true,
              label: `${activeViewport.id} → ${viewport.id}`,
            });
          }
        });

        setCrossReferenceLines(lines);
      };

      updateCrossReferenceLines();
    }, [viewports, showCrossReferenceLines]);

    // Enhanced grid configuration with responsive design and accessibility
    const getGridConfig = useCallback((
      layout: ViewportLayout,
      containerWidth: number = containerDimensions.width,
    ): GridConfig => {
      const isSmallScreen = containerWidth < responsiveBreakpoint;

      switch (layout) {
        case '1x1':
          return {
            gridTemplate: 'grid-cols-1 grid-rows-1',
            viewportCount: 1,
            viewportIds: ['A'],
            aspectRatio: 'aspect-square',
            minViewportSize: 'min-h-[400px] md:min-h-[500px]',
            gridGap: 'gap-4',
          };
        case '1x2':
          return {
            gridTemplate: isSmallScreen ? 'grid-cols-1 grid-rows-2' : 'grid-cols-2 grid-rows-1',
            viewportCount: 2,
            viewportIds: ['A', 'B'],
            aspectRatio: isSmallScreen ? 'aspect-[4/3]' : 'aspect-[16/9]',
            minViewportSize: 'min-h-[300px] md:min-h-[400px]',
            gridGap: 'gap-3',
          };
        case '2x2':
          return {
            gridTemplate: isSmallScreen ? 'grid-cols-1 grid-rows-4' : 'grid-cols-2 grid-rows-2',
            viewportCount: 4,
            viewportIds: ['A', 'B', 'C', 'D'],
            aspectRatio: 'aspect-square',
            minViewportSize: 'min-h-[200px] md:min-h-[300px]',
            gridGap: 'gap-2 md:gap-3',
          };
        default:
          return {
            gridTemplate: 'grid-cols-1 grid-rows-1',
            viewportCount: 1,
            viewportIds: ['A'],
            aspectRatio: 'aspect-square',
            minViewportSize: 'min-h-[400px] md:min-h-[500px]',
            gridGap: 'gap-4',
          };
      }
    }, [containerDimensions.width, responsiveBreakpoint]);

    // Memoized grid configuration
    const gridConfig = useMemo(() => getGridConfig(layout), [getGridConfig, layout]);
    const { gridTemplate, viewportCount, viewportIds, aspectRatio, minViewportSize, gridGap } = gridConfig;

    // Setup ResizeObserver for responsive design
    useEffect(() => {
      if (!containerRef.current) return;

      resizeObserverRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          setContainerDimensions({ width, height });

          // Notify parent of container resize
          if (onViewportResize) {
            viewportIds.forEach((viewportId) => {
              const viewportWidth = width / (layout === '1x2' || layout === '2x2' ? 2 : 1);
              const viewportHeight = height / (layout === '2x2' ? 2 : 1);
              onViewportResize(viewportId, { width: viewportWidth, height: viewportHeight });
            });
          }
        }
      });

      resizeObserverRef.current.observe(containerRef.current);

      return () => {
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
        }
      };
    }, [layout, viewportIds, onViewportResize]);

    // Handle layout changes - immediate for medical software stability
    useEffect(() => {
      if (previousLayout && previousLayout !== layout) {
        // Call transition callback (now immediate)
        if (onLayoutTransition) {
          onLayoutTransition(previousLayout, layout);
        }
      }

      setPreviousLayout(layout);
    }, [layout, previousLayout, enableAnimations, onLayoutTransition]);

    // Get viewport state by ID or create default
    const getViewportState = useCallback((viewportId: string): ViewportState => {
      const existingViewport = viewports.find(v => v.id === viewportId);
      return existingViewport || {
        id: viewportId,
        seriesIndex: null,
        isActive: false,
        activeTool: 'WindowLevel',
      };
    }, [viewports]);

    // Enhanced viewport activation with logging and validation
    const handleViewportClick = useCallback((viewportId: string): void => {
      // Validate viewport ID
      if (!viewportIds.includes(viewportId)) {
        log.warn('Attempted to activate invalid viewport', {
          component: 'ViewportGrid',
          metadata: { viewportId, validIds: viewportIds },
        });
        return;
      }


      log.info('Viewport activated', {
        component: 'ViewportGrid',
        metadata: { viewportId, layout },
      });

      onViewportActivated(viewportId);
    }, [viewportIds, onViewportActivated, layout]);

    // Keyboard navigation support
    const handleKeyDown = useCallback((event: React.KeyboardEvent, viewportId: string): void => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleViewportClick(viewportId);
      }
    }, [handleViewportClick]);

    // Expose methods through ref
    useImperativeHandle(
      ref,
      () => ({
        getViewportRef: (viewportId: string) => {
          return viewportRefs.current.get(viewportId) || null;
        },
        setViewportTool: (viewportId: string, tool: string) => {
          const viewportRef = viewportRefs.current.get(viewportId);
          if (viewportRef) {
            viewportRef.setActiveTool(tool);
          }
        },
        getActiveViewportId: () => {
          const activeViewport = viewports.find(v => v.isActive);
          return activeViewport?.id || null;
        },
      }),
      [viewports],
    );

    // Clean up viewport refs when layout changes
    useEffect(() => {
      const currentRefs = viewportRefs.current;

      // Remove refs for viewports not in current layout
      for (const [id] of currentRefs) {
        if (!viewportIds.includes(id)) {
          currentRefs.delete(id);
        }
      }
    }, [viewportIds]);

    const renderViewport = useCallback((viewportId: string): React.ReactNode => {
      const viewportState = getViewportState(viewportId);
      const series = viewportState.seriesIndex !== null && viewportState.seriesIndex < seriesData.length
        ? seriesData[viewportState.seriesIndex]
        : null;

      return (
        <div
          key={viewportId}
          className={cn(
            'relative cursor-pointer bg-background rounded-lg',
            minViewportSize,
            aspectRatio,
            'focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2',
            viewportState.isActive && [
              'ring-2 ring-primary ring-offset-2 shadow-sm',
              'bg-gradient-to-br from-background to-muted/20',
            ],
          )}
          onClick={() => handleViewportClick(viewportId)}
          onKeyDown={(event) => handleKeyDown(event, viewportId)}
          tabIndex={0}
          role="button"
          aria-label={`Viewport ${viewportId}${series ? ` - ${series.modality} series` : ' - empty'}`}
          aria-pressed={viewportState.isActive}
        >
          {/* Viewport Header using shadcn/ui positioning */}
          <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
            <Badge
              variant={viewportState.isActive ? 'default' : 'secondary'}
              className="text-xs font-medium"
            >
              {viewportId}
            </Badge>
            {series && (
              <Badge variant="outline" className="text-xs">
                {series.modality}
              </Badge>
            )}
          </div>

          {/* Series Info Header */}
          {series && (
            <div className="absolute top-2 right-2 z-10">
              <Badge variant="secondary" className="text-xs">
                {series.numberOfImages} images
              </Badge>
            </div>
          )}

          <div className="h-full">
            {/* Check if viewport has a render wrapper (for drop zones) */}
            {(viewportState as any).renderWrapper ?
              (viewportState as any).renderWrapper(
                series ? (
                  <>
                    <DicomViewer
                      ref={(ref) => {
                        if (ref) {
                          viewportRefs.current.set(viewportId, ref);
                        } else {
                          viewportRefs.current.delete(viewportId);
                        }
                      }}
                      key={`viewport-${viewportId}-${viewportState.seriesIndex}`}
                      seriesInstanceUID={series.seriesInstanceUID}
                      renderingEngineId={`renderingEngine_${viewportId}`}
                      viewportId={`VIEWPORT_${viewportId}`}
                    />
                    {showCrossReferenceLines && (() => {
                      const ref = canvasRefs.current.get(viewportId);
                      if (!ref) {
                        const newRef = React.createRef<HTMLCanvasElement>() as React.RefObject<HTMLCanvasElement>;
                        canvasRefs.current.set(viewportId, newRef);
                        return (
                          <CrossReferenceLines
                            lines={crossReferenceLines}
                            viewportId={viewportId}
                            canvasRef={newRef}
                            enabled={viewportState.isActive}
                            opacity={crossReferenceOpacity}
                            showLabels={true}
                          />
                        );
                      }
                      return (
                        <CrossReferenceLines
                          lines={crossReferenceLines}
                          viewportId={viewportId}
                          canvasRef={ref}
                          enabled={viewportState.isActive}
                          opacity={crossReferenceOpacity}
                          showLabels={true}
                        />
                      );
                    })()}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-2">
                      <div className="text-4xl text-muted-foreground/50">{viewportId}</div>
                      <p className="text-sm text-muted-foreground">Drop series here</p>
                      <p className="text-xs text-muted-foreground">
                    or click from sidebar
                      </p>
                    </div>
                  </div>
                ),
              ) :
              series ? (
                <>
                  <DicomViewer
                    ref={(ref) => {
                      if (ref) {
                        viewportRefs.current.set(viewportId, ref);
                      } else {
                        viewportRefs.current.delete(viewportId);
                      }
                    }}
                    key={`viewport-${viewportId}-${viewportState.seriesIndex}`}
                    seriesInstanceUID={series.seriesInstanceUID}
                    renderingEngineId={`renderingEngine_${viewportId}`}
                    viewportId={`VIEWPORT_${viewportId}`}
                  />
                  {showCrossReferenceLines && (() => {
                    const ref = canvasRefs.current.get(viewportId);
                    if (!ref) {
                      const newRef = React.createRef<HTMLCanvasElement>() as React.RefObject<HTMLCanvasElement>;
                      canvasRefs.current.set(viewportId, newRef);
                      return (
                        <CrossReferenceLines
                          lines={crossReferenceLines}
                          viewportId={viewportId}
                          canvasRef={newRef}
                          enabled={viewportState.isActive}
                          opacity={crossReferenceOpacity}
                          showLabels={true}
                        />
                      );
                    }
                    return (
                      <CrossReferenceLines
                        lines={crossReferenceLines}
                        viewportId={viewportId}
                        canvasRef={ref}
                        enabled={viewportState.isActive}
                        opacity={crossReferenceOpacity}
                        showLabels={true}
                      />
                    );
                  })()}
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-2">
                    <div className="text-4xl text-muted-foreground/50">{viewportId}</div>
                    <p className="text-sm text-muted-foreground">Drop series here</p>
                    <p className="text-xs text-muted-foreground">
                      or click from sidebar
                    </p>
                  </div>
                </div>
              )
            }
          </div>

          {/* Active Viewport Indicator using shadcn/ui badge */}
          {viewportState.isActive && (
            <div className="absolute bottom-2 right-2 z-10">
              <Badge variant="default" className="w-2 h-2 p-0 rounded-full animate-pulse" />
            </div>
          )}
        </div>
      );
    }, [
      getViewportState,
      seriesData,
      minViewportSize,
      aspectRatio,
      handleViewportClick,
      handleKeyDown,
      showCrossReferenceLines,
      crossReferenceLines,
      crossReferenceOpacity,
      canvasRefs,
      viewportRefs,
    ]);

    // Performance optimization: memoize viewport list
    const renderedViewports = useMemo(() =>
      viewportIds.slice(0, viewportCount).map((viewportId) => renderViewport(viewportId)),
    [viewportIds, viewportCount, renderViewport],
    );

    return (
      <div
        ref={containerRef}
        className={cn(
          'h-full w-full grid',
          gridTemplate,
          gridGap,
          className,
        )}
        role="grid"
        aria-label={`${layout} viewport layout with ${viewportCount} viewports`}
        data-layout={layout}
        data-viewport-count={viewportCount}
      >
        {renderedViewports}
      </div>
    );
  },
);

ViewportGridComponent.displayName = 'ViewportGrid';

export const ViewportGrid = React.memo(ViewportGridComponent, (prevProps, nextProps) => {
  // Detailed comparison for performance optimization
  if (prevProps.layout !== nextProps.layout) return false;
  if (prevProps.showCrossReferenceLines !== nextProps.showCrossReferenceLines) return false;
  if (prevProps.crossReferenceOpacity !== nextProps.crossReferenceOpacity) return false;
  if (prevProps.enableAnimations !== nextProps.enableAnimations) return false;
  if (prevProps.responsiveBreakpoint !== nextProps.responsiveBreakpoint) return false;
  if (prevProps.className !== nextProps.className) return false;

  // Compare viewports array efficiently
  if (prevProps.viewports.length !== nextProps.viewports.length) return false;
  for (let i = 0; i < prevProps.viewports.length; i++) {
    const prev = safePropertyAccess(prevProps.viewports, i);
    const next = safePropertyAccess(nextProps.viewports, i);
    if (!prev || !next) return false;
    if (
      prev.id !== next.id ||
      prev.seriesIndex !== next.seriesIndex ||
      prev.isActive !== next.isActive ||
      prev.activeTool !== next.activeTool
    ) {
      return false;
    }
  }

  // Compare seriesData array length and key properties
  if (prevProps.seriesData.length !== nextProps.seriesData.length) return false;

  // For large series arrays, do shallow comparison of first few items
  const compareCount = Math.min(5, prevProps.seriesData.length);
  for (let i = 0; i < compareCount; i++) {
    const prev = safePropertyAccess(prevProps.seriesData, i);
    const next = safePropertyAccess(nextProps.seriesData, i);
    if (prev?.seriesInstanceUID !== next?.seriesInstanceUID) {
      return false;
    }
  }

  return true; // No significant changes detected
});

export default ViewportGrid;
