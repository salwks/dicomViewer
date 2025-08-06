/**
 * Viewport Assignment Panel Component
 * Interactive panel for managing viewport assignments with drag & drop support
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn, safePropertyAccess } from '../../lib/utils';
import { ViewportDropZone } from '../DragDropSystem';
import { viewportAssignmentManager, ViewportAssignmentState } from '../../services/ViewportAssignmentManager';
import { seriesManagementService } from '../../services/SeriesManagementService';
import { log } from '../../utils/logger';

interface ViewportAssignmentPanelProps {
  viewportIds: string[];
  activeViewport?: string;
  className?: string;
  showLoadingIndicators?: boolean;
  enableDragDrop?: boolean;
  onViewportClick?: (viewportId: string) => void;
  onAssignmentChange?: (viewportId: string, seriesUID: string | null) => void;
}

export const ViewportAssignmentPanel: React.FC<ViewportAssignmentPanelProps> = ({
  viewportIds,
  activeViewport,
  className = '',
  showLoadingIndicators = true,
  enableDragDrop = true,
  onViewportClick,
  onAssignmentChange,
}) => {
  const [assignments, setAssignments] = useState<Record<string, ViewportAssignmentState | null>>({});
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});

  // Apply dynamic colors via CSS properties
  useEffect(() => {
    // Apply study colors to indicators
    const colorIndicators = document.querySelectorAll('[data-study-color]');
    colorIndicators.forEach((element) => {
      const color = element.getAttribute('data-study-color');
      if (color && element instanceof HTMLElement) {
        element.style.backgroundColor = color;
      }
    });

    // Apply study colors to badges
    const badges = document.querySelectorAll('[data-study-badge-color]');
    badges.forEach((element) => {
      const color = element.getAttribute('data-study-badge-color');
      if (color && element instanceof HTMLElement) {
        element.style.borderColor = color;
        element.style.color = color;
        element.style.backgroundColor = `${color}10`; // 10% opacity
      }
    });
  });

  // Update assignments when state changes
  useEffect(() => {
    const handleStateChange = () => {
      const state = viewportAssignmentManager.getState();
      setAssignments(state);
    };

    const handleLoadingStarted = ({ viewportId }: { viewportId: string }) => {
      setIsLoading(prev => ({ ...prev, [viewportId]: true }));
    };

    const handleLoadingCompleted = ({ viewportId }: { viewportId: string }) => {
      setIsLoading(prev => ({ ...prev, [viewportId]: false }));
    };

    const handleLoadingFailed = ({ viewportId }: { viewportId: string }) => {
      setIsLoading(prev => ({ ...prev, [viewportId]: false }));
    };

    // Subscribe to events
    viewportAssignmentManager.on('stateChanged', handleStateChange);
    viewportAssignmentManager.on('seriesLoadingStarted', handleLoadingStarted);
    viewportAssignmentManager.on('seriesLoadingCompleted', handleLoadingCompleted);
    viewportAssignmentManager.on('seriesLoadingFailed', handleLoadingFailed);

    // Initial state sync
    handleStateChange();

    return () => {
      viewportAssignmentManager.off('stateChanged', handleStateChange);
      viewportAssignmentManager.off('seriesLoadingStarted', handleLoadingStarted);
      viewportAssignmentManager.off('seriesLoadingCompleted', handleLoadingCompleted);
      viewportAssignmentManager.off('seriesLoadingFailed', handleLoadingFailed);
    };
  }, []);

  // Handle viewport click
  const handleViewportClick = useCallback((viewportId: string) => {
    viewportAssignmentManager.setActiveViewport(viewportId);

    if (onViewportClick) {
      onViewportClick(viewportId);
    }

    log.info('Viewport clicked', {
      component: 'ViewportAssignmentPanel',
      metadata: { viewportId },
    });
  }, [onViewportClick]);

  // Handle series drop
  const handleSeriesDrop = useCallback((seriesUID: string, viewportId: string) => {
    viewportAssignmentManager.assignSeriesToViewport(seriesUID, viewportId).then(success => {
      if (success && onAssignmentChange) {
        onAssignmentChange(viewportId, seriesUID);
      }
    });
  }, [onAssignmentChange]);

  // Handle clear assignment
  const handleClearAssignment = useCallback((viewportId: string) => {
    viewportAssignmentManager.clearViewportAssignment(viewportId);

    if (onAssignmentChange) {
      onAssignmentChange(viewportId, null);
    }

    log.info('Assignment cleared', {
      component: 'ViewportAssignmentPanel',
      metadata: { viewportId },
    });
  }, [onAssignmentChange]);

  // Get study color for series
  const getStudyColor = (studyInstanceUID: string | null): string => {
    if (!studyInstanceUID) return '#6b7280';
    const state = seriesManagementService.getState();
    return safePropertyAccess(state.colorMappings, studyInstanceUID) || '#6b7280';
  };

  const renderViewportCard = (viewportId: string) => {
    const assignment = safePropertyAccess(assignments, viewportId);
    const isActive = activeViewport === viewportId || assignment?.isActive;
    const isLoadingSeries = showLoadingIndicators && (safePropertyAccess(isLoading, viewportId) || assignment?.isLoading);
    const hasAssignment = Boolean(assignment?.seriesInstanceUID);
    const studyColor = getStudyColor(assignment?.studyInstanceUID || null);

    const viewportContent = (
      <Card
        className={cn(
          'relative cursor-pointer transition-all duration-200',
          'hover:shadow-md hover:scale-[1.02]',
          isActive && 'ring-2 ring-primary ring-offset-2 shadow-lg',
          !hasAssignment && 'border-dashed',
          className,
        )}
        onClick={() => handleViewportClick(viewportId)}
        role="button"
        tabIndex={0}
        aria-label={`Viewport ${viewportId}${hasAssignment && assignment ? ` - ${assignment.metadata?.seriesDescription}` : ' - Empty'}`}
        aria-pressed={isActive}
      >
        {/* Study Color Indicator */}
        {hasAssignment && (
          <div
            className="absolute top-0 left-0 w-1 h-full rounded-l-lg bg-current"
            data-study-color={studyColor}
          />
        )}

        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge
                variant={isActive ? 'default' : 'secondary'}
                className="text-xs font-bold"
              >
                {viewportId}
              </Badge>
              {hasAssignment && assignment?.metadata?.modality && (
                <Badge
                  variant="outline"
                  className="text-xs border-2"
                  data-study-badge-color={studyColor}
                >
                  {assignment.metadata!.modality}
                </Badge>
              )}
            </div>

            {hasAssignment && (
              <Button
                size="sm"
                variant="ghost"
                className="h-5 w-5 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearAssignment(viewportId);
                }}
                title="Clear assignment"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {hasAssignment && assignment ? (
            <div className="space-y-2">
              <div className="font-medium text-sm truncate" title={assignment.metadata?.seriesDescription}>
                {assignment?.metadata?.seriesDescription || 'Unnamed Series'}
              </div>
              <div className="text-xs text-muted-foreground">
                {assignment?.metadata?.numberOfImages} images
              </div>
              {assignment.lastModified && (
                <div className="text-xs text-muted-foreground">
                  Updated {new Date(assignment.lastModified).toLocaleTimeString()}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <div className="text-xs mb-1">Drop series here</div>
              <div className="text-xs opacity-70">or drag from browser</div>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoadingSeries && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
              <div className="space-y-2 text-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="text-xs">Loading series...</div>
              </div>
            </div>
          )}
        </CardContent>

        {/* Active Indicator */}
        {isActive && (
          <div className="absolute bottom-2 right-2">
            <Badge variant="default" className="w-2 h-2 p-0 rounded-full animate-pulse" />
          </div>
        )}
      </Card>
    );

    // Wrap in drop zone if drag & drop is enabled
    if (enableDragDrop) {
      return (
        <ViewportDropZone
          key={viewportId}
          viewportId={viewportId}
          onDrop={(seriesUID) => handleSeriesDrop(seriesUID, viewportId)}
          currentSeries={assignment?.seriesInstanceUID || undefined}
          className="h-full"
        >
          {viewportContent}
        </ViewportDropZone>
      );
    }

    return viewportContent;
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">Viewport Assignments</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => viewportAssignmentManager.clearAllAssignments()}
          className="text-xs"
        >
          Clear All
        </Button>
      </div>

      <div className={cn(
        'grid gap-3',
        viewportIds.length === 1 && 'grid-cols-1',
        viewportIds.length === 2 && 'grid-cols-2',
        viewportIds.length === 3 && 'grid-cols-3',
        viewportIds.length >= 4 && 'grid-cols-2',
      )}>
        {viewportIds.map(renderViewportCard)}
      </div>

      {/* Summary */}
      <div className="text-xs text-muted-foreground text-center">
        {Object.values(assignments).filter(a => a?.seriesInstanceUID).length} of {viewportIds.length} viewports assigned
      </div>
    </div>
  );
};
