/**
 * Viewport Drop Zone Component
 * Handles drop operations for viewport assignment
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { useDragDrop } from './DragDropProvider';
import { SeriesDropData, ViewportDropZone as DropZoneType } from '../../types/dicom';
import { Badge } from '../ui/badge';
import { log } from '../../utils/logger';

interface ViewportDropZoneProps {
  viewportId: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onDrop?: (seriesUID: string, dropData: SeriesDropData) => void;
  acceptedModalities?: string[];
  currentSeries?: string; // Currently assigned series UID
}

export const ViewportDropZone: React.FC<ViewportDropZoneProps> = ({
  viewportId,
  children,
  className = '',
  disabled = false,
  onDrop,
  acceptedModalities,
  currentSeries,
}) => {
  const {
    isDragging,
    dragPreview,
    registerDropZone,
    unregisterDropZone,
    setActiveDropZone,
    activeDropZone,
    onSeriesAssign,
  } = useDragDrop();

  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isValidTarget, setIsValidTarget] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  // const [dropZoneRect, setDropZoneRect] = useState<DOMRect | null>(null);

  // const isActive = activeDropZone === viewportId;
  const canAcceptDrop = !disabled && (!acceptedModalities || !dragPreview ||
    acceptedModalities.includes(dragPreview.modality));

  // Register/unregister drop zone
  useEffect(() => {
    if (!dropZoneRef.current) return;

    const rect = dropZoneRef.current.getBoundingClientRect();
    // setDropZoneRect(rect);

    const dropZone: DropZoneType = {
      viewportId,
      isActive: false,
      isValidTarget: canAcceptDrop,
      position: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      },
    };

    registerDropZone(viewportId, dropZone);

    return () => {
      unregisterDropZone(viewportId);
    };
  }, [viewportId, canAcceptDrop, registerDropZone, unregisterDropZone]);

  // Update drop zone validity when drag preview changes
  useEffect(() => {
    setIsValidTarget(canAcceptDrop);
  }, [canAcceptDrop]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (disabled || !canAcceptDrop) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, [disabled, canAcceptDrop]);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (disabled || !canAcceptDrop) return;

    e.preventDefault();
    setIsHovering(true);
    setActiveDropZone(viewportId);

    log.info('Drag entered viewport', {
      component: 'ViewportDropZone',
      metadata: { viewportId, dragPreview },
    });
  }, [disabled, canAcceptDrop, viewportId, setActiveDropZone, dragPreview]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Only trigger leave if we're actually leaving the drop zone
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsHovering(false);
      if (activeDropZone === viewportId) {
        setActiveDropZone(null);
      }

      log.info('Drag left viewport', {
        component: 'ViewportDropZone',
        metadata: { viewportId },
      });
    }
  }, [viewportId, activeDropZone, setActiveDropZone]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (disabled || !canAcceptDrop) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    setIsHovering(false);
    setActiveDropZone(null);

    try {
      const dataText = e.dataTransfer.getData('application/json');
      if (!dataText) {
        log.warn('No drag data found in drop event', {
          component: 'ViewportDropZone',
          metadata: { viewportId },
        });
        return;
      }

      const dropData = JSON.parse(dataText) as SeriesDropData;

      log.info('Series dropped on viewport', {
        component: 'ViewportDropZone',
        metadata: { viewportId, dropData },
      });

      // Call local handler first
      if (onDrop) {
        onDrop(dropData.seriesInstanceUID, dropData);
      }

      // Then call global handler
      if (onSeriesAssign) {
        onSeriesAssign(dropData.seriesInstanceUID, viewportId);
      }

    } catch (error) {
      log.error('Failed to parse drop data', {
        component: 'ViewportDropZone',
        metadata: { viewportId, error: error instanceof Error ? error.message : 'Unknown error' },
      });
    }
  }, [disabled, canAcceptDrop, viewportId, onDrop, onSeriesAssign, setActiveDropZone]);

  const getDropIndicatorText = (): string => {
    if (!isDragging) return '';
    if (!isValidTarget) return 'Cannot drop here';
    if (dragPreview?.sourceViewport === viewportId) return 'Already assigned';
    if (currentSeries && currentSeries !== dragPreview?.seriesInstanceUID) return 'Replace current series';
    return 'Drop to assign series';
  };

  return (
    <div
      ref={dropZoneRef}
      className={cn(
        'relative transition-all duration-200',
        isDragging && isValidTarget && [
          'ring-2 ring-primary/50 ring-offset-2',
          isHovering && 'ring-primary bg-primary/5 scale-[1.02]',
        ],
        isDragging && !isValidTarget && 'ring-2 ring-destructive/50 ring-offset-2',
        className,
      )}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}

      {/* Drop Indicator Overlay */}
      {isDragging && (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center',
            'bg-background/80 backdrop-blur-sm',
            'border-2 border-dashed transition-all duration-200',
            isValidTarget ? 'border-primary text-primary' : 'border-destructive text-destructive',
            isHovering && isValidTarget && 'bg-primary/10 border-solid',
            'pointer-events-none z-10',
          )}
        >
          <div className="text-center space-y-2">
            {/* Icon */}
            <div className="mx-auto w-8 h-8 flex items-center justify-center">
              {isValidTarget ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>

            {/* Text */}
            <div className="space-y-1">
              <Badge variant={isValidTarget ? 'default' : 'destructive'} className="text-xs">
                {viewportId}
              </Badge>
              <p className="text-xs font-medium">
                {getDropIndicatorText()}
              </p>
              {dragPreview && (
                <p className="text-xs opacity-75">
                  {dragPreview.modality} • {dragPreview.numberOfInstances} images
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Current Series Indicator */}
      {currentSeries && !isDragging && (
        <div className="absolute top-2 right-2 z-5">
          <Badge variant="secondary" className="text-xs">
            Assigned
          </Badge>
        </div>
      )}
    </div>
  );
};
