/**
 * Layout Utilities
 * Pure utility functions for viewport layout management
 * Low dependency, modular functions for task-based interface
 */

import type { ViewerLayout, ViewportPosition, LayoutUtils } from '../types/viewerLayout';
import { log } from './logger';

/**
 * Calculate total number of viewports for a given layout
 */
export const getTotalViewports = (layout: ViewerLayout): number => {
  return layout.rows * layout.cols;
};

/**
 * Check if layout supports multiple viewports
 */
export const isMultiViewport = (layout: ViewerLayout): boolean => {
  return getTotalViewports(layout) > 1;
};

/**
 * Convert viewport position to linear index
 */
export const getViewportIndex = (position: ViewportPosition, layout: ViewerLayout): number => {
  return position.row * layout.cols + position.col;
};

/**
 * Convert linear index to viewport position
 */
export const getPositionFromIndex = (index: number, layout: ViewerLayout): ViewportPosition => {
  return {
    row: Math.floor(index / layout.cols),
    col: index % layout.cols,
  };
};

/**
 * Validate layout configuration
 */
export const validateLayout = (layout: ViewerLayout): boolean => {
  if (!layout || typeof layout !== 'object') {
    log.warn('Invalid layout: not an object', {
      component: 'LayoutUtils',
      layout,
    });
    return false;
  }

  if (!Number.isInteger(layout.rows) || layout.rows < 1 || layout.rows > 4) {
    log.warn('Invalid layout rows: must be integer between 1-4', {
      component: 'LayoutUtils',
      rows: layout.rows,
    });
    return false;
  }

  if (!Number.isInteger(layout.cols) || layout.cols < 1 || layout.cols > 4) {
    log.warn('Invalid layout cols: must be integer between 1-4', {
      component: 'LayoutUtils',
      cols: layout.cols,
    });
    return false;
  }

  const totalViewports = getTotalViewports(layout);
  if (totalViewports > 9) {
    log.warn('Invalid layout: too many viewports (max 9)', {
      component: 'LayoutUtils',
      totalViewports,
    });
    return false;
  }

  return true;
};

/**
 * Generate viewport IDs for a given layout
 */
export const generateViewportIds = (layout: ViewerLayout): string[] => {
  const totalViewports = getTotalViewports(layout);
  return Array.from({ length: totalViewports }, (_, index) => `viewport-${index}`);
};

/**
 * Calculate grid CSS properties for layout
 */
export const getGridStyles = (layout: ViewerLayout): React.CSSProperties => {
  return {
    display: 'grid',
    gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
    gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
    gap: '2px',
    width: '100%',
    height: '100%',
  };
};

/**
 * Get responsive layout based on viewport size
 */
export const getResponsiveLayout = (
  preferredLayout: ViewerLayout,
  containerWidth: number,
  containerHeight: number,
): ViewerLayout => {
  // For mobile/small screens, force single column
  if (containerWidth < 768) {
    return { rows: preferredLayout.rows * preferredLayout.cols, cols: 1 };
  }

  // For very wide screens, prefer horizontal layouts
  if (containerWidth / containerHeight > 2) {
    if (preferredLayout.rows === 2 && preferredLayout.cols === 2) {
      return { rows: 1, cols: 4 };
    }
  }

  return preferredLayout;
};

/**
 * Compare two layouts for equality
 */
export const layoutsEqual = (a: ViewerLayout, b: ViewerLayout): boolean => {
  return a.rows === b.rows && a.cols === b.cols;
};

/**
 * Create layout utilities object
 */
export const createLayoutUtils = (): LayoutUtils => ({
  getTotalViewports,
  isMultiViewport,
  getViewportIndex,
  getPositionFromIndex,
  validateLayout,
});

/**
 * Layout transition helpers for smooth UI changes
 */
export const getLayoutTransition = (
  fromLayout: ViewerLayout,
  toLayout: ViewerLayout,
): {
  added: number;
  removed: number;
  shouldAnimate: boolean;
} => {
  const fromTotal = getTotalViewports(fromLayout);
  const toTotal = getTotalViewports(toLayout);

  return {
    added: Math.max(0, toTotal - fromTotal),
    removed: Math.max(0, fromTotal - toTotal),
    shouldAnimate: Math.abs(fromTotal - toTotal) <= 2, // Only animate small changes
  };
};

/**
 * Generate CSS classes for viewport positioning
 */
export const getViewportClasses = (
  _position: ViewportPosition, // 현재 미사용이지만 향후 확장을 위해 유지
  isActive: boolean,
): string => {
  const baseClasses = [
    'relative',
    'border',
    'border-border',
    'bg-background',
    'overflow-hidden',
    'transition-all',
    'duration-200',
  ];

  const activeClasses = isActive
    ? ['border-primary', 'border-2', 'shadow-md']
    : ['border-muted', 'hover:border-muted-foreground/50'];

  return [...baseClasses, ...activeClasses].join(' ');
};
