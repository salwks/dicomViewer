/**
 * Viewport Manager Hook
 * Specialized hook for viewport state management in layout-based architecture
 * Optimized for medical imaging workflows with shadcn/ui integration
 */

import { useCallback, useMemo } from 'react';
import { useViewer, useViewerLayout, useActiveViewport } from '../context/ViewerContext';
import type { ViewportState } from '../types/viewerLayout';
import { getViewportIndex, getViewportClasses } from '../utils/layoutUtils';
import { log } from '../utils/logger';

/**
 * Viewport manager hook return type
 */
export interface ViewportManagerReturn {
  // Current state
  viewports: ViewportState[];
  activeViewport: ViewportState | null;
  activeViewportId: string | null;

  // Viewport actions
  setActiveViewport: (id: string) => void;
  updateViewport: (id: string, updates: Partial<ViewportState>) => void;
  loadStudyInViewport: (viewportId: string, studyInstanceUID: string, seriesInstanceUID?: string) => void;

  // Viewport utilities
  getViewportById: (id: string) => ViewportState | null;
  getViewportByPosition: (row: number, col: number) => ViewportState | null;
  getViewportIndex: (viewportId: string) => number;
  isViewportActive: (id: string) => boolean;

  // UI utilities for shadcn/ui components
  getViewportClasses: (viewportId: string) => string;
  getViewportTabIndex: (viewportId: string) => number;
  canLoadStudy: (viewportId: string) => boolean;
}

/**
 * Study loading options
 */
export interface StudyLoadOptions {
  studyInstanceUID: string;
  seriesInstanceUID?: string;
  imageId?: string;
  autoActivate?: boolean;
}

/**
 * Viewport manager hook for managing individual viewports
 */
export const useViewportManager = (): ViewportManagerReturn => {
  const { state, setActiveViewport: setActive, updateViewport: updateVp, loadStudyInViewport: loadStudy } = useViewer();
  const layout = useViewerLayout();
  const activeViewport = useActiveViewport();

  // Memoized viewport data
  const viewports = useMemo(() => state.viewports, [state.viewports]);
  const activeViewportId = useMemo(() => state.activeViewportId, [state.activeViewportId]);

  // Viewport action handlers
  const setActiveViewport = useCallback(
    (id: string) => {
      const viewport = viewports.find(v => v.id === id);
      if (viewport) {
        setActive(id);
        log.info('Active viewport changed', {
          component: 'useViewportManager',
          metadata: { viewportId: id },
        });
      } else {
        log.warn('Attempted to set non-existent viewport as active', {
          component: 'useViewportManager',
          viewportId: id,
        });
      }
    },
    [setActive, viewports],
  );

  const updateViewport = useCallback(
    (id: string, updates: Partial<ViewportState>) => {
      updateVp(id, updates);
      log.info('Viewport updated', {
        component: 'useViewportManager',
        metadata: { viewportId: id, updates },
      });
    },
    [updateVp],
  );

  const loadStudyInViewport = useCallback(
    (viewportId: string, studyInstanceUID: string, seriesInstanceUID?: string) => {
      loadStudy(viewportId, studyInstanceUID, seriesInstanceUID);
      log.info('Study loaded in viewport', {
        component: 'useViewportManager',
        metadata: { viewportId, studyInstanceUID, seriesInstanceUID },
      });
    },
    [loadStudy],
  );

  // Viewport utility functions
  const getViewportById = useCallback(
    (id: string): ViewportState | null => {
      return viewports.find(v => v.id === id) || null;
    },
    [viewports],
  );

  const getViewportByPosition = useCallback(
    (row: number, col: number): ViewportState | null => {
      return viewports.find(v => v.position.row === row && v.position.col === col) || null;
    },
    [viewports],
  );

  const getViewportIndexCallback = useCallback(
    (viewportId: string): number => {
      const viewport = getViewportById(viewportId);
      if (!viewport) return -1;

      return getViewportIndex(viewport.position, layout);
    },
    [getViewportById, layout],
  );

  const isViewportActive = useCallback(
    (id: string): boolean => {
      return activeViewportId === id;
    },
    [activeViewportId],
  );

  // UI utility functions for shadcn/ui components
  const getViewportClassesCallback = useCallback(
    (viewportId: string): string => {
      const viewport = getViewportById(viewportId);
      if (!viewport) return '';

      return getViewportClasses(viewport.position, viewport.isActive);
    },
    [getViewportById],
  );

  const getViewportTabIndex = useCallback(
    (viewportId: string): number => {
      const viewport = getViewportById(viewportId);
      if (!viewport) return -1;

      return viewport.isActive ? 0 : -1;
    },
    [getViewportById],
  );

  const canLoadStudy = useCallback(
    (viewportId: string): boolean => {
      const viewport = getViewportById(viewportId);
      return viewport !== null && !state.isLoading;
    },
    [getViewportById, state.isLoading],
  );

  return {
    // Current state
    viewports,
    activeViewport,
    activeViewportId,

    // Viewport actions
    setActiveViewport,
    updateViewport,
    loadStudyInViewport,

    // Viewport utilities
    getViewportById,
    getViewportByPosition,
    getViewportIndex: getViewportIndexCallback,
    isViewportActive,

    // UI utilities
    getViewportClasses: getViewportClassesCallback,
    getViewportTabIndex,
    canLoadStudy,
  };
};

/**
 * Hook for managing a specific viewport
 */
export const useViewport = (viewportId: string) => {
  const {
    getViewportById,
    isViewportActive,
    setActiveViewport,
    updateViewport,
    loadStudyInViewport,
    getViewportClasses,
    getViewportTabIndex,
    canLoadStudy,
  } = useViewportManager();

  const viewport = useMemo(() => getViewportById(viewportId), [getViewportById, viewportId]);
  const isActive = useMemo(() => isViewportActive(viewportId), [isViewportActive, viewportId]);

  const activate = useCallback(() => {
    setActiveViewport(viewportId);
  }, [setActiveViewport, viewportId]);

  const update = useCallback(
    (updates: Partial<ViewportState>) => {
      updateViewport(viewportId, updates);
    },
    [updateViewport, viewportId],
  );

  const loadStudy = useCallback(
    (studyInstanceUID: string, seriesInstanceUID?: string) => {
      loadStudyInViewport(viewportId, studyInstanceUID, seriesInstanceUID);
    },
    [loadStudyInViewport, viewportId],
  );

  const classes = useMemo(() => getViewportClasses(viewportId), [getViewportClasses, viewportId]);
  const tabIndex = useMemo(() => getViewportTabIndex(viewportId), [getViewportTabIndex, viewportId]);
  const canLoad = useMemo(() => canLoadStudy(viewportId), [canLoadStudy, viewportId]);

  return {
    viewport,
    isActive,
    activate,
    update,
    loadStudy,
    classes,
    tabIndex,
    canLoad,
  };
};
