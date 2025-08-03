/**
 * Draggable Series Component
 * Handles drag operations for series thumbnails
 */

import React, { useCallback, useRef } from 'react';
import { cn } from '../../lib/utils';
import { useDragDrop } from './DragDropProvider';
import { SeriesDropData, DICOMSeries } from '../../types/dicom';

interface DraggableSeriesProps {
  series: DICOMSeries & {
    studyInstanceUID: string;
    studyColor?: string;
    studyDescription?: string;
    patientName?: string;
    studyDate?: string;
  };
  children: React.ReactNode;
  enabled?: boolean;
  className?: string;
  sourceViewport?: string;
}

export const DraggableSeries: React.FC<DraggableSeriesProps> = ({
  series,
  children,
  enabled = true,
  className = '',
  sourceViewport,
}) => {
  const { startDrag, endDrag, draggedSeries } = useDragDrop();
  const dragElementRef = useRef<HTMLDivElement>(null);

  const isDragging = draggedSeries === series.seriesInstanceUID;

  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!enabled) {
      e.preventDefault();
      return;
    }

    const dropData: SeriesDropData = {
      seriesInstanceUID: series.seriesInstanceUID,
      studyInstanceUID: series.studyInstanceUID,
      modality: series.modality,
      seriesDescription: series.seriesDescription,
      numberOfInstances: series.numberOfInstances,
      sourceViewport,
      dragStartTime: Date.now(),
    };

    // Set drag data for external drop targets
    e.dataTransfer.setData('application/json', JSON.stringify(dropData));
    e.dataTransfer.setData('text/plain', series.seriesInstanceUID);
    e.dataTransfer.effectAllowed = 'move';

    // Create custom drag image with series info
    if (dragElementRef.current) {
      const dragImage = createDragImage(series);
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, dragImage.offsetWidth / 2, dragImage.offsetHeight / 2);

      // Clean up drag image after a short delay
      setTimeout(() => {
        if (document.body.contains(dragImage)) {
          document.body.removeChild(dragImage);
        }
      }, 0);
    }

    startDrag(series.seriesInstanceUID, dropData);
  }, [enabled, series, sourceViewport, startDrag]);

  const handleDragEnd = useCallback(() => {
    endDrag();
  }, [endDrag]);

  const createDragImage = (series: DICOMSeries & { studyColor?: string }): HTMLElement => {
    const dragImage = document.createElement('div');
    dragImage.className = 'fixed pointer-events-none z-50 bg-white border-2 border-primary rounded-lg shadow-lg p-2 min-w-[200px]';
    dragImage.style.transform = 'translate(-1000px, -1000px)'; // Hide off-screen initially

    const color = series.studyColor || '#3b82f6';

    dragImage.innerHTML = `
      <div class="flex items-center gap-2">
        <div class="w-3 h-3 rounded-full" style="background-color: ${color}"></div>
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm truncate">${series.seriesDescription || 'Unnamed Series'}</div>
          <div class="text-xs text-gray-500">${series.modality} • ${series.numberOfInstances} images</div>
        </div>
      </div>
    `;

    return dragImage;
  };

  return (
    <div
      ref={dragElementRef}
      className={cn(
        'transition-all duration-200',
        enabled && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50 scale-95 pointer-events-none',
        className,
      )}
      draggable={enabled}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {children}
    </div>
  );
};
