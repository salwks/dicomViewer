/**
 * Annotation Click Handler Component
 * Advanced click handling and event binding system for annotations
 * Task 34.3: Implement Click Handler and Event Binding
 * Built with shadcn/ui components
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { AnnotationCompat } from '../../types/annotation-compat';
import { AnnotationSelectionHandler } from '../../services/AnnotationSelectionHandler';
import { log } from '../../utils/logger';

export interface ClickEventData {
  annotationId: string;
  annotation: AnnotationCompat;
  viewportId: string;
  clickType: 'single' | 'double' | 'right';
  coordinates: {
    viewport: { x: number; y: number };
    screen: { x: number; y: number };
    canvas: { x: number; y: number };
  };
  modifiers: {
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
  };
  timestamp: number;
}

export interface ClickHandlerOptions {
  enableSingleClick: boolean;
  enableDoubleClick: boolean;
  enableRightClick: boolean;
  enableMultiSelect: boolean;
  doubleClickDelay: number;
  clickTolerance: number; // Pixel tolerance for click detection
  preventDefaultOnAnnotation: boolean;
  propagateToViewport: boolean;
}

export interface ClickHandlerProps {
  viewportId: string;
  annotations: AnnotationCompat[];
  selectionHandler: AnnotationSelectionHandler;
  className?: string;
  options?: Partial<ClickHandlerOptions>;
  onAnnotationClick?: (event: ClickEventData) => void;
  onAnnotationDoubleClick?: (event: ClickEventData) => void;
  onAnnotationRightClick?: (event: ClickEventData) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  disabled?: boolean;
}

const DEFAULT_OPTIONS: ClickHandlerOptions = {
  enableSingleClick: true,
  enableDoubleClick: true,
  enableRightClick: true,
  enableMultiSelect: true,
  doubleClickDelay: 300,
  clickTolerance: 5,
  preventDefaultOnAnnotation: true,
  propagateToViewport: false,
};

export const ClickHandler: React.FC<ClickHandlerProps> = ({
  viewportId,
  annotations,
  selectionHandler,
  className,
  options: userOptions,
  onAnnotationClick,
  onAnnotationDoubleClick,
  onAnnotationRightClick,
  onSelectionChange,
  disabled = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastClickRef = useRef<{ time: number; annotationId: string | null }>({
    time: 0,
    annotationId: null,
  });

  const [activeAnnotation, setActiveAnnotation] = useState<string | null>(null);
  const [clickStats, setClickStats] = useState({
    totalClicks: 0,
    singleClicks: 0,
    doubleClicks: 0,
    rightClicks: 0,
  });

  // Merge options
  const options = { ...DEFAULT_OPTIONS, ...userOptions };

  // Get annotation at coordinates
  const getAnnotationAtPoint = useCallback((x: number, y: number): AnnotationCompat | null => {
    // In a real implementation, this would use Cornerstone3D's viewport coordinate system
    // For now, we'll simulate hit detection based on mock bounds
    for (const annotation of annotations) {
      // Mock bounds calculation
      const bounds = {
        x: 100 + Math.random() * 400,
        y: 100 + Math.random() * 300,
        width: 50 + Math.random() * 100,
        height: 50 + Math.random() * 100,
      };

      if (
        x >= bounds.x - options.clickTolerance &&
        x <= bounds.x + bounds.width + options.clickTolerance &&
        y >= bounds.y - options.clickTolerance &&
        y <= bounds.y + bounds.height + options.clickTolerance
      ) {
        return annotation;
      }
    }
    return null;
  }, [annotations, options.clickTolerance]);

  // Create click event data
  const createClickEventData = useCallback((
    annotation: AnnotationCompat,
    event: MouseEvent,
    clickType: 'single' | 'double' | 'right',
  ): ClickEventData => {
    const container = containerRef.current;
    const rect = container?.getBoundingClientRect() || { left: 0, top: 0 };

    return {
      annotationId: annotation.id,
      annotation,
      viewportId,
      clickType,
      coordinates: {
        viewport: {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        },
        screen: {
          x: event.screenX,
          y: event.screenY,
        },
        canvas: {
          x: event.offsetX,
          y: event.offsetY,
        },
      },
      modifiers: {
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
        alt: event.altKey,
        meta: event.metaKey,
      },
      timestamp: Date.now(),
    };
  }, [viewportId]);

  // Handle selection change
  const handleSelectionChange = useCallback((annotation: AnnotationCompat, event: MouseEvent) => {
    const preserveSelected = options.enableMultiSelect && (event.ctrlKey || event.metaKey);

    const success = selectionHandler.selectAnnotation(annotation, viewportId, preserveSelected);

    if (success) {
      const selectedIds = selectionHandler.getSelectedAnnotationIds(viewportId);
      onSelectionChange?.(selectedIds);

      log.info('Annotation selection changed', {
        component: 'ClickHandler',
        metadata: {
          annotationId: annotation.id,
          viewportId,
          preserveSelected,
          totalSelected: selectedIds.length,
        },
      });
    }
  }, [selectionHandler, viewportId, options.enableMultiSelect, onSelectionChange]);

  // Handle single click
  const handleSingleClick = useCallback((event: MouseEvent) => {
    if (!options.enableSingleClick || disabled) return;

    const x = event.offsetX;
    const y = event.offsetY;
    const annotation = getAnnotationAtPoint(x, y);

    if (!annotation) {
      // Click on empty space - deselect all if not multi-selecting
      if (!event.ctrlKey && !event.metaKey) {
        selectionHandler.deselectAllAnnotations(viewportId);
        onSelectionChange?.([]);
      }
      return;
    }

    setActiveAnnotation(annotation.id);

    // Update stats
    setClickStats(prev => ({
      ...prev,
      totalClicks: prev.totalClicks + 1,
      singleClicks: prev.singleClicks + 1,
    }));

    // Handle selection
    handleSelectionChange(annotation, event);

    // Create and emit click event
    const clickEvent = createClickEventData(annotation, event, 'single');
    onAnnotationClick?.(clickEvent);

    if (options.preventDefaultOnAnnotation) {
      event.preventDefault();
    }

    if (!options.propagateToViewport) {
      event.stopPropagation();
    }
  }, [
    options.enableSingleClick,
    options.preventDefaultOnAnnotation,
    options.propagateToViewport,
    disabled,
    getAnnotationAtPoint,
    selectionHandler,
    viewportId,
    onSelectionChange,
    handleSelectionChange,
    createClickEventData,
    onAnnotationClick,
  ]);

  // Handle double click
  const handleDoubleClick = useCallback((event: MouseEvent) => {
    if (!options.enableDoubleClick || disabled) return;

    const x = event.offsetX;
    const y = event.offsetY;
    const annotation = getAnnotationAtPoint(x, y);

    if (!annotation) return;

    // Update stats
    setClickStats(prev => ({
      ...prev,
      doubleClicks: prev.doubleClicks + 1,
    }));

    // Create and emit double click event
    const clickEvent = createClickEventData(annotation, event, 'double');
    onAnnotationDoubleClick?.(clickEvent);

    if (options.preventDefaultOnAnnotation) {
      event.preventDefault();
    }

    if (!options.propagateToViewport) {
      event.stopPropagation();
    }
  }, [
    options.enableDoubleClick,
    options.preventDefaultOnAnnotation,
    options.propagateToViewport,
    disabled,
    getAnnotationAtPoint,
    createClickEventData,
    onAnnotationDoubleClick,
  ]);

  // Handle right click
  const handleRightClick = useCallback((event: MouseEvent) => {
    if (!options.enableRightClick || disabled) return;

    const x = event.offsetX;
    const y = event.offsetY;
    const annotation = getAnnotationAtPoint(x, y);

    if (!annotation) return;

    event.preventDefault(); // Always prevent context menu on annotations

    // Update stats
    setClickStats(prev => ({
      ...prev,
      rightClicks: prev.rightClicks + 1,
    }));

    // Create and emit right click event
    const clickEvent = createClickEventData(annotation, event, 'right');
    onAnnotationRightClick?.(clickEvent);

    if (!options.propagateToViewport) {
      event.stopPropagation();
    }
  }, [
    options.enableRightClick,
    options.propagateToViewport,
    disabled,
    getAnnotationAtPoint,
    createClickEventData,
    onAnnotationRightClick,
  ]);

  // Main click handler with double-click detection
  const handleClick = useCallback((event: MouseEvent) => {
    const now = Date.now();
    const timeSinceLastClick = now - lastClickRef.current.time;

    const x = event.offsetX;
    const y = event.offsetY;
    const annotation = getAnnotationAtPoint(x, y);
    const annotationId = annotation?.id || null;

    // Check for double click
    if (
      timeSinceLastClick < options.doubleClickDelay &&
      annotationId === lastClickRef.current.annotationId
    ) {
      // Clear single click timer
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }

      handleDoubleClick(event);

      // Reset last click to prevent triple clicks
      lastClickRef.current = { time: 0, annotationId: null };
    } else {
      // Set timer for single click
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }

      clickTimerRef.current = setTimeout(() => {
        handleSingleClick(event);
        clickTimerRef.current = null;
      }, options.doubleClickDelay);

      lastClickRef.current = { time: now, annotationId };
    }
  }, [options.doubleClickDelay, getAnnotationAtPoint, handleSingleClick, handleDoubleClick]);

  // Keyboard event handler for selection
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (disabled) return;

    const selectedIds = selectionHandler.getSelectedAnnotationIds(viewportId);

    switch (event.key) {
      case 'Escape':
        // Deselect all on Escape
        if (selectedIds.length > 0) {
          selectionHandler.deselectAllAnnotations(viewportId);
          onSelectionChange?.([]);
          event.preventDefault();
        }
        break;

      case 'a':
      case 'A':
        // Select all on Ctrl/Cmd+A
        if (event.ctrlKey || event.metaKey) {
          annotations.forEach(annotation => {
            selectionHandler.selectAnnotation(annotation, viewportId, true);
          });
          const allIds = annotations.map(a => a.id);
          onSelectionChange?.(allIds);
          event.preventDefault();
        }
        break;

      case 'Delete':
      case 'Backspace':
        // Could trigger deletion event here
        if (selectedIds.length > 0) {
          log.info('Delete key pressed on selected annotations', {
            component: 'ClickHandler',
            metadata: { selectedIds, viewportId },
          });
        }
        break;
    }
  }, [disabled, selectionHandler, viewportId, annotations, onSelectionChange]);

  // Set up event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('click', handleClick);
    container.addEventListener('contextmenu', handleRightClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('click', handleClick);
      container.removeEventListener('contextmenu', handleRightClick);
      document.removeEventListener('keydown', handleKeyDown);

      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    };
  }, [handleClick, handleRightClick, handleKeyDown]);

  // Get selection statistics
  const selectionStats = {
    total: annotations.length,
    selected: selectionHandler.getSelectedAnnotationIds(viewportId).length,
  };

  return (
    <Card className={cn('relative', className)}>
      <CardContent className="p-0">
        <div
          ref={containerRef}
          className={cn(
            'relative w-full h-full min-h-[400px]',
            'cursor-pointer select-none',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
          data-viewport-id={viewportId}
        >
          {/* Click area overlay */}
          <div className="absolute inset-0 bg-transparent" />

          {/* Status indicators */}
          <div className="absolute top-2 right-2 z-10 space-y-2">
            {/* Selection count */}
            <Badge variant="secondary" className="text-xs">
              {selectionStats.selected} / {selectionStats.total} selected
            </Badge>

            {/* Active annotation indicator */}
            {activeAnnotation && (
              <Badge
                variant="secondary"
                className={cn(
                  'text-xs animate-in fade-in-0 slide-in-from-top-1',
                  'bg-background/90 backdrop-blur-sm',
                )}
              >
                Active: {activeAnnotation}
              </Badge>
            )}
          </div>

          {/* Click statistics (development only) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="absolute bottom-2 left-2 z-10">
              <Badge
                variant="secondary"
                className="text-xs font-mono bg-background/90 backdrop-blur-sm"
              >
                Clicks: {clickStats.totalClicks} |
                Single: {clickStats.singleClicks} |
                Double: {clickStats.doubleClicks} |
                Right: {clickStats.rightClicks}
              </Badge>
            </div>
          )}

          {/* Feature indicators */}
          <div className="absolute top-2 left-2 z-10 flex gap-1">
            {options.enableMultiSelect && (
              <Badge variant="outline" className="text-xs">
                Multi-select
              </Badge>
            )}
            {options.enableDoubleClick && (
              <Badge variant="outline" className="text-xs">
                Double-click
              </Badge>
            )}
            {options.enableRightClick && (
              <Badge variant="outline" className="text-xs">
                Right-click
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClickHandler;
