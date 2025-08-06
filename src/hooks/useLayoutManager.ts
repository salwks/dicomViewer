/**
 * Layout Manager Hook
 * Specialized hook for layout-based state management
 * Optimized for shadcn/ui components with low dependency architecture
 */

import { useCallback, useMemo } from 'react';
import { useViewer, useViewerLayout } from '../context/ViewerContext';
import { PREDEFINED_LAYOUTS, type ViewerLayout } from '../types/viewerLayout';
import {
  validateLayout,
  getTotalViewports,
  isMultiViewport,
  getLayoutTransition,
  getGridStyles,
} from '../utils/layoutUtils';
import { log } from '../utils/logger';

/**
 * Layout manager hook return type
 */
export interface LayoutManagerReturn {
  // Current state
  layout: ViewerLayout;
  totalViewports: number;
  isMultiViewport: boolean;

  // Layout actions
  setLayout: (layout: ViewerLayout) => void;
  switchToSingle: () => void;
  switchToSideBySide: () => void;
  switchToVerticalStack: () => void;
  switchToQuad: () => void;

  // Layout utilities
  validateAndSetLayout: (layout: ViewerLayout) => boolean;
  getLayoutInfo: () => LayoutInfo;
  getTransitionInfo: (targetLayout: ViewerLayout) => TransitionInfo;

  // Grid styles for shadcn/ui components
  getGridClassName: () => string;
  getGridStyles: () => React.CSSProperties;
}

/**
 * Layout information interface
 */
export interface LayoutInfo {
  rows: number;
  cols: number;
  totalViewports: number;
  isMultiViewport: boolean;
  displayName: string;
  gridClass: string;
}

/**
 * Transition information interface
 */
export interface TransitionInfo {
  canTransition: boolean;
  addedViewports: number;
  removedViewports: number;
  shouldAnimate: boolean;
  reason?: string;
}

/**
 * Layout manager hook for managing viewport layouts
 */
export const useLayoutManager = (): LayoutManagerReturn => {
  const { setLayout: setViewerLayout } = useViewer();
  const layout = useViewerLayout();

  // Memoized calculations for performance
  const totalViewports = useMemo(() => getTotalViewports(layout), [layout]);
  const isMulti = useMemo(() => isMultiViewport(layout), [layout]);

  // Layout action handlers
  const setLayout = useCallback(
    (newLayout: ViewerLayout) => {
      if (validateLayout(newLayout)) {
        setViewerLayout(newLayout);
        log.info('Layout changed via useLayoutManager', {
          component: 'useLayoutManager',
          metadata: { from: layout, to: newLayout },
        });
      } else {
        log.warn('Invalid layout rejected', {
          component: 'useLayoutManager',
          layout: newLayout,
        });
      }
    },
    [setViewerLayout, layout],
  );

  const switchToSingle = useCallback(() => {
    setLayout(PREDEFINED_LAYOUTS.SINGLE);
  }, [setLayout]);

  const switchToSideBySide = useCallback(() => {
    setLayout(PREDEFINED_LAYOUTS.SIDE_BY_SIDE);
  }, [setLayout]);

  const switchToVerticalStack = useCallback(() => {
    setLayout(PREDEFINED_LAYOUTS.STACK_VERTICAL);
  }, [setLayout]);

  const switchToQuad = useCallback(() => {
    setLayout(PREDEFINED_LAYOUTS.QUAD);
  }, [setLayout]);

  // Validation and utility functions
  const validateAndSetLayout = useCallback(
    (newLayout: ViewerLayout): boolean => {
      if (validateLayout(newLayout)) {
        setLayout(newLayout);
        return true;
      }
      return false;
    },
    [setLayout],
  );

  const getLayoutInfo = useCallback((): LayoutInfo => {
    const displayName = getLayoutDisplayName(layout);
    const gridClass = getLayoutGridClass(layout);

    return {
      rows: layout.rows,
      cols: layout.cols,
      totalViewports,
      isMultiViewport: isMulti,
      displayName,
      gridClass,
    };
  }, [layout, totalViewports, isMulti]);

  const getTransitionInfo = useCallback(
    (targetLayout: ViewerLayout): TransitionInfo => {
      if (!validateLayout(targetLayout)) {
        return {
          canTransition: false,
          addedViewports: 0,
          removedViewports: 0,
          shouldAnimate: false,
          reason: 'Invalid target layout',
        };
      }

      const transition = getLayoutTransition(layout, targetLayout);

      return {
        canTransition: true,
        addedViewports: transition.added,
        removedViewports: transition.removed,
        shouldAnimate: transition.shouldAnimate,
      };
    },
    [layout],
  );

  // Grid styling for shadcn/ui components
  const getGridClassName = useCallback((): string => {
    return getLayoutGridClass(layout);
  }, [layout]);

  const getGridStylesCallback = useCallback((): React.CSSProperties => {
    return getGridStyles(layout);
  }, [layout]);

  return {
    // Current state
    layout,
    totalViewports,
    isMultiViewport: isMulti,

    // Layout actions
    setLayout,
    switchToSingle,
    switchToSideBySide,
    switchToVerticalStack,
    switchToQuad,

    // Layout utilities
    validateAndSetLayout,
    getLayoutInfo,
    getTransitionInfo,

    // Grid styles
    getGridClassName,
    getGridStyles: getGridStylesCallback,
  };
};

/**
 * Get display name for layout
 */
const getLayoutDisplayName = (layout: ViewerLayout): string => {
  const { rows, cols } = layout;

  if (rows === 1 && cols === 1) return '단일 뷰어';
  if (rows === 1 && cols === 2) return '좌우 분할';
  if (rows === 2 && cols === 1) return '상하 분할';
  if (rows === 2 && cols === 2) return '4분할 뷰어';

  return `${rows}×${cols} 뷰어`;
};

/**
 * Get CSS grid class for shadcn/ui styling
 */
const getLayoutGridClass = (layout: ViewerLayout): string => {
  const { rows, cols } = layout;

  const baseClasses = ['grid', 'gap-1', 'w-full', 'h-full'];

  // Grid template classes
  const gridClasses = [`grid-rows-${rows}`, `grid-cols-${cols}`];

  return [...baseClasses, ...gridClasses].join(' ');
};
