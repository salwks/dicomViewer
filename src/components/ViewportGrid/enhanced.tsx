/**
 * Enhanced ViewportGrid Component with Drag & Drop Support
 * Extends the existing ViewportGrid with integrated drop zones
 */

import React, { forwardRef } from 'react';
import { ViewportGrid, type ViewportGridProps, type ViewportGridRef } from './index';
import { ViewportDropZone } from '../DragDropSystem';

interface EnhancedViewportGridProps extends ViewportGridProps {
  enableDropZones?: boolean;
  onSeriesAssign?: (seriesUID: string, viewportId: string) => void;
  acceptedModalities?: string[];
}

export const EnhancedViewportGrid = forwardRef<ViewportGridRef, EnhancedViewportGridProps>(
  ({
    enableDropZones = true,
    onSeriesAssign,
    acceptedModalities,
    viewports,
    ...props
  }, ref) => {
    // Get assigned series for each viewport
    const getAssignedSeries = (viewportId: string): string | undefined => {
      const viewport = viewports.find(v => v.id === viewportId);
      return viewport?.seriesIndex !== null && viewport?.seriesIndex !== undefined
        ? `series-${viewport.seriesIndex}` // Using seriesIndex as identifier - in practice this would be seriesInstanceUID
        : undefined;
    };

    if (!enableDropZones) {
      return <ViewportGrid ref={ref} viewports={viewports} {...props} />;
    }

    // Create enhanced viewports with drop zones
    const enhancedViewports = viewports.map(viewport => ({
      ...viewport,
      renderWrapper: (children: React.ReactNode) => (
        <ViewportDropZone
          key={`drop-zone-${viewport.id}`}
          viewportId={viewport.id}
          onDrop={onSeriesAssign ? (seriesUID) => onSeriesAssign(seriesUID, viewport.id) : undefined}
          acceptedModalities={acceptedModalities}
          currentSeries={getAssignedSeries(viewport.id)}
          className="h-full w-full"
        >
          {children}
        </ViewportDropZone>
      ),
    }));

    return (
      <ViewportGrid
        ref={ref}
        viewports={enhancedViewports}
        {...props}
      />
    );
  },
);

EnhancedViewportGrid.displayName = 'EnhancedViewportGrid';
