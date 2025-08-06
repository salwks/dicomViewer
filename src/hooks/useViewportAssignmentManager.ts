/**
 * Viewport Assignment Manager Hook
 * React hook for managing viewport assignments with the ViewportAssignmentManager service
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ViewportAssignmentManager,
  ViewportAssignmentState,
  ViewportAssignmentConfig,
  viewportAssignmentManager as defaultManager,
} from '../services/ViewportAssignmentManager';
import { SeriesDropData } from '../types/dicom';
import { log } from '../utils/logger';
import { safePropertyAccess } from '../lib/utils';

interface UseViewportAssignmentManagerOptions {
  manager?: ViewportAssignmentManager;
  config?: Partial<ViewportAssignmentConfig>;
  viewportIds?: string[];
}

interface UseViewportAssignmentManagerReturn {
  // State
  assignments: Record<string, ViewportAssignmentState | null>;
  activeViewport: string | null;
  assignedViewports: string[];
  unassignedViewports: string[];
  isLoading: Record<string, boolean>;

  // Assignment Methods
  assignSeries: (
    seriesUID: string,
    viewportId: string,
    options?: { skipValidation?: boolean; autoLoad?: boolean }
  ) => Promise<boolean>;
  clearAssignment: (viewportId: string) => void;
  clearAllAssignments: () => void;

  // Query Methods
  getAssignment: (viewportId: string) => ViewportAssignmentState | null;
  isViewportAssigned: (viewportId: string) => boolean;
  isSeriesAssigned: (seriesUID: string) => boolean;
  getAssignmentBySeries: (seriesUID: string) => ViewportAssignmentState | null;

  // Active Viewport
  setActiveViewport: (viewportId: string) => void;

  // Drag & Drop Handlers
  handleDrop: (dropData: SeriesDropData, viewportId: string) => Promise<boolean>;

  // Manager Instance
  manager: ViewportAssignmentManager;
}

export const useViewportAssignmentManager = (
  options: UseViewportAssignmentManagerOptions = {},
): UseViewportAssignmentManagerReturn => {
  const { manager = defaultManager, config, viewportIds = ['A', 'B', 'C', 'D'] } = options;

  // Create manager instance if config is provided
  const managerRef = useRef<ViewportAssignmentManager>(manager);
  if (config && managerRef.current === defaultManager) {
    managerRef.current = new ViewportAssignmentManager(config);
  }

  const [assignments, setAssignments] = useState<Record<string, ViewportAssignmentState | null>>({});
  const [activeViewport, setActiveViewport] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});

  // Update state from manager
  const updateState = useCallback(() => {
    const state = managerRef.current.getState();
    setAssignments(state);
    setActiveViewport(managerRef.current.getActiveViewport());
  }, []);

  // Setup event listeners
  useEffect(() => {
    const currentManager = managerRef.current;

    const handleStateChange = () => {
      updateState();
    };

    const handleActiveViewportChange = ({ current }: { previous: string | null; current: string | null }) => {
      setActiveViewport(current);
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

    const handleAssignmentCreated = (assignment: ViewportAssignmentState) => {
      log.info('Assignment created via hook', {
        component: 'useViewportAssignmentManager',
        metadata: { ...assignment } as Record<string, unknown>,
      });
    };

    const handleAssignmentCleared = ({ viewportId }: { viewportId: string; previousSeriesUID: string | null }) => {
      log.info('Assignment cleared via hook', {
        component: 'useViewportAssignmentManager',
        metadata: { viewportId },
      });
    };

    // Subscribe to events
    currentManager.on('stateChanged', handleStateChange);
    currentManager.on('activeViewportChanged', handleActiveViewportChange);
    currentManager.on('seriesLoadingStarted', handleLoadingStarted);
    currentManager.on('seriesLoadingCompleted', handleLoadingCompleted);
    currentManager.on('seriesLoadingFailed', handleLoadingFailed);
    currentManager.on('assignmentCreated', handleAssignmentCreated);
    currentManager.on('assignmentCleared', handleAssignmentCleared);

    // Initial state sync
    updateState();

    return () => {
      currentManager.off('stateChanged', handleStateChange);
      currentManager.off('activeViewportChanged', handleActiveViewportChange);
      currentManager.off('seriesLoadingStarted', handleLoadingStarted);
      currentManager.off('seriesLoadingCompleted', handleLoadingCompleted);
      currentManager.off('seriesLoadingFailed', handleLoadingFailed);
      currentManager.off('assignmentCreated', handleAssignmentCreated);
      currentManager.off('assignmentCleared', handleAssignmentCleared);
    };
  }, [updateState]);

  // Assignment Methods
  const assignSeries = useCallback(
    async (
      seriesUID: string,
      viewportId: string,
      assignOptions?: { skipValidation?: boolean; autoLoad?: boolean },
    ): Promise<boolean> => {
      try {
        return await managerRef.current.assignSeriesToViewport(seriesUID, viewportId, assignOptions);
      } catch (error) {
        log.error('Failed to assign series via hook', {
          component: 'useViewportAssignmentManager',
          metadata: { seriesUID, viewportId, error: error instanceof Error ? error.message : 'Unknown error' },
        });
        return false;
      }
    },
    [],
  );

  const clearAssignment = useCallback((viewportId: string) => {
    managerRef.current.clearViewportAssignment(viewportId);
  }, []);

  const clearAllAssignments = useCallback(() => {
    managerRef.current.clearAllAssignments();
  }, []);

  // Query Methods
  const getAssignment = useCallback((viewportId: string): ViewportAssignmentState | null => {
    return managerRef.current.getAssignment(viewportId);
  }, []);

  const isViewportAssigned = useCallback((viewportId: string): boolean => {
    return managerRef.current.isViewportAssigned(viewportId);
  }, []);

  const isSeriesAssigned = useCallback((seriesUID: string): boolean => {
    return managerRef.current.isSeriesAssigned(seriesUID);
  }, []);

  const getAssignmentBySeries = useCallback((seriesUID: string): ViewportAssignmentState | null => {
    return managerRef.current.getAssignmentBySeries(seriesUID);
  }, []);

  // Active Viewport
  const handleSetActiveViewport = useCallback((viewportId: string) => {
    managerRef.current.setActiveViewport(viewportId);
  }, []);

  // Drag & Drop Handler
  const handleDrop = useCallback(
    async (dropData: SeriesDropData, viewportId: string): Promise<boolean> => {
      log.info('Handling drop via hook', {
        component: 'useViewportAssignmentManager',
        metadata: { dropData, viewportId },
      });

      // If series is being moved from another viewport, clear the source
      if (dropData.sourceViewport && dropData.sourceViewport !== viewportId) {
        clearAssignment(dropData.sourceViewport);
      }

      return await assignSeries(dropData.seriesInstanceUID, viewportId, { autoLoad: true });
    },
    [assignSeries, clearAssignment],
  );

  // Compute derived state
  const assignedViewports = viewportIds.filter(id => safePropertyAccess(assignments, id)?.seriesInstanceUID);
  const unassignedViewports = viewportIds.filter(id => !safePropertyAccess(assignments, id)?.seriesInstanceUID);

  return {
    // State
    assignments,
    activeViewport,
    assignedViewports,
    unassignedViewports,
    isLoading,

    // Assignment Methods
    assignSeries,
    clearAssignment,
    clearAllAssignments,

    // Query Methods
    getAssignment,
    isViewportAssigned,
    isSeriesAssigned,
    getAssignmentBySeries,

    // Active Viewport
    setActiveViewport: handleSetActiveViewport,

    // Drag & Drop Handlers
    handleDrop,

    // Manager Instance
    manager: managerRef.current,
  };
};

// Simplified hook for single viewport management
export const useSingleViewportAssignment = (viewportId: string, options: UseViewportAssignmentManagerOptions = {}) => {
  const { assignments, activeViewport, isLoading, assignSeries, clearAssignment, setActiveViewport, handleDrop } =
    useViewportAssignmentManager({ ...options, viewportIds: [viewportId] });

  // eslint-disable-next-line security/detect-object-injection -- Safe: viewportId is validated viewport identifier
  const assignment = assignments[viewportId];
  const isAssigned = Boolean(assignment?.seriesInstanceUID);
  const isActive = activeViewport === viewportId;
  // eslint-disable-next-line security/detect-object-injection -- Safe: viewportId is validated viewport identifier
  const isLoadingSeries = isLoading[viewportId] || false;

  const assign = useCallback(
    (seriesUID: string, assignOptions?: { skipValidation?: boolean; autoLoad?: boolean }) => {
      return assignSeries(seriesUID, viewportId, assignOptions);
    },
    [assignSeries, viewportId],
  );

  const clear = useCallback(() => {
    clearAssignment(viewportId);
  }, [clearAssignment, viewportId]);

  const activate = useCallback(() => {
    setActiveViewport(viewportId);
  }, [setActiveViewport, viewportId]);

  const handleDropOnViewport = useCallback(
    (dropData: SeriesDropData) => {
      return handleDrop(dropData, viewportId);
    },
    [handleDrop, viewportId],
  );

  return {
    assignment,
    isAssigned,
    isActive,
    isLoading: isLoadingSeries,
    assign,
    clear,
    activate,
    handleDrop: handleDropOnViewport,
  };
};
