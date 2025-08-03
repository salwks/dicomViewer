/**
 * Drag & Drop Provider for Series Management
 * Native HTML5 drag & drop implementation with viewport assignment
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { log } from '../../utils/logger';
import { SeriesDropData, ViewportDropZone } from '../../types/dicom';

interface DragDropContextValue {
  // Drag state
  draggedSeries: string | null;
  dragPreview: SeriesDropData | null;
  isDragging: boolean;

  // Drop zones
  dropZones: Map<string, ViewportDropZone>;
  activeDropZone: string | null;

  // Handlers
  startDrag: (seriesUID: string, data: SeriesDropData) => void;
  endDrag: () => void;
  registerDropZone: (viewportId: string, zone: ViewportDropZone) => void;
  unregisterDropZone: (viewportId: string) => void;
  setActiveDropZone: (viewportId: string | null) => void;

  // Events
  onSeriesAssign?: (seriesUID: string, viewportId: string) => void;
}

const DragDropContext = createContext<DragDropContextValue | null>(null);

export const useDragDrop = (): DragDropContextValue => {
  const context = useContext(DragDropContext);
  if (!context) {
    throw new Error('useDragDrop must be used within a DragDropProvider');
  }
  return context;
};

interface DragDropProviderProps {
  children: React.ReactNode;
  onSeriesAssign?: (seriesUID: string, viewportId: string) => void;
}

export const DragDropProvider: React.FC<DragDropProviderProps> = ({
  children,
  onSeriesAssign,
}) => {
  const [draggedSeries, setDraggedSeries] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<SeriesDropData | null>(null);
  const [dropZones, setDropZones] = useState<Map<string, ViewportDropZone>>(new Map());
  const [activeDropZone, setActiveDropZone] = useState<string | null>(null);

  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startDrag = useCallback((seriesUID: string, data: SeriesDropData) => {
    setDraggedSeries(seriesUID);
    setDragPreview(data);

    // Clear any existing timeout
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }

    log.info('Drag started', {
      component: 'DragDropProvider',
      metadata: { seriesUID, ...data },
    });
  }, []);

  const endDrag = useCallback(() => {
    // Delay clearing to allow drop events to complete
    dragTimeoutRef.current = setTimeout(() => {
      log.info('Drag ended', {
        component: 'DragDropProvider',
        metadata: { seriesUID: draggedSeries, activeDropZone },
      });

      setDraggedSeries(null);
      setDragPreview(null);
      setActiveDropZone(null);
    }, 100);
  }, [draggedSeries, activeDropZone]);

  const registerDropZone = useCallback((viewportId: string, zone: ViewportDropZone) => {
    setDropZones(prev => new Map(prev).set(viewportId, zone));

    log.info('Drop zone registered', {
      component: 'DragDropProvider',
      metadata: { viewportId, zone },
    });
  }, []);

  const unregisterDropZone = useCallback((viewportId: string) => {
    setDropZones(prev => {
      const newZones = new Map(prev);
      newZones.delete(viewportId);
      return newZones;
    });

    if (activeDropZone === viewportId) {
      setActiveDropZone(null);
    }

    log.info('Drop zone unregistered', {
      component: 'DragDropProvider',
      metadata: { viewportId },
    });
  }, [activeDropZone]);

  const handleSetActiveDropZone = useCallback((viewportId: string | null) => {
    setActiveDropZone(viewportId);
  }, []);

  const contextValue: DragDropContextValue = {
    draggedSeries,
    dragPreview,
    isDragging: draggedSeries !== null,
    dropZones,
    activeDropZone,
    startDrag,
    endDrag,
    registerDropZone,
    unregisterDropZone,
    setActiveDropZone: handleSetActiveDropZone,
    onSeriesAssign,
  };

  return (
    <DragDropContext.Provider value={contextValue}>
      {children}
    </DragDropContext.Provider>
  );
};
