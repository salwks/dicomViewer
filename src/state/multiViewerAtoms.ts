/**
 * Multi-Viewer System State Management using Recoil
 * 
 * This module defines all the atoms needed for the multi-layout DICOM viewer system.
 * Each atom handles a specific aspect of the viewer state to ensure proper isolation
 * and independent operation of multiple viewers.
 */

import { atom, selector, selectorFamily } from 'recoil';

// Types for the multi-viewer system
export interface AppFile {
  id: string;
  name: string;
  file: File;
  imageId: string;
  loadedImageId?: string;
  metadata?: any;
  loadingStatus: 'pending' | 'loading' | 'loaded' | 'error';
  errorMessage?: string;
}

export interface Annotation {
  id: string;
  type: string;
  data: any;
  toolName: string;
  timestamp: string;
  viewportId: string;
  imageId: string;
  unit?: string;
}

export type LayoutMode = '1xN' | '2xN';
export type ToolType = 'Length' | 'Angle' | 'RectangleROI' | 'EllipseROI' | 'Probe' | 'Pan' | 'Zoom' | 'WindowLevel';

// Core atoms for multi-viewer system

/**
 * All loaded DICOM files
 * Contains complete file information including loading status and metadata
 */
export const allFilesState = atom<AppFile[]>({
  key: 'allFilesState',
  default: [],
});

/**
 * Selected file IDs in order
 * The index in this array determines the display order (1st, 2nd, 3rd, 4th)
 * Maximum 4 files can be selected
 */
export const selectedFileIdsState = atom<string[]>({
  key: 'selectedFileIdsState',
  default: [],
});

/**
 * Current layout mode
 * '1xN': Display files in a single row (1x1, 1x2, 1x3, 1x4)
 * '2xN': Display files in a 2x2 grid layout
 */
export const layoutModeState = atom<LayoutMode>({
  key: 'layoutModeState',
  default: '1xN',
});

/**
 * Active viewer ID
 * Tracks which viewer is currently active and should receive tool interactions
 */
export const activeViewerIdState = atom<string | null>({
  key: 'activeViewerIdState',
  default: null,
});

/**
 * Annotations by viewer ID
 * Each viewer maintains its own independent annotation data
 * Key: viewer/file ID, Value: array of annotations for that viewer
 */
export const annotationsByViewerIdState = atom<Record<string, Annotation[]>>({
  key: 'annotationsByViewerIdState',
  default: {},
});

/**
 * Tool state by viewer ID
 * Each viewer can have a different active tool
 * Key: viewer/file ID, Value: currently active tool for that viewer
 */
export const toolStateByViewerIdState = atom<Record<string, ToolType>>({
  key: 'toolStateByViewerIdState',
  default: {},
});

/**
 * Viewport settings by viewer ID
 * Each viewer maintains its own viewport settings (zoom, pan, window/level)
 * Key: viewer/file ID, Value: viewport settings for that viewer
 */
export const viewportSettingsByViewerIdState = atom<Record<string, any>>({
  key: 'viewportSettingsByViewerIdState',
  default: {},
});

/**
 * Loading state for each viewer
 * Tracks loading status for each individual viewer
 */
export const viewerLoadingStatesState = atom<Record<string, boolean>>({
  key: 'viewerLoadingStatesState',
  default: {},
});

// Selectors for derived state

/**
 * Get files that are currently selected and visible
 * Returns files in the order they were selected (1st, 2nd, 3rd, 4th)
 */
export const visibleFilesSelector = selector({
  key: 'visibleFilesSelector',
  get: ({ get }) => {
    const allFiles = get(allFilesState);
    const selectedIds = get(selectedFileIdsState);
    
    return selectedIds
      .map(id => allFiles.find(file => file.id === id))
      .filter(file => file !== undefined) as AppFile[];
  },
});

/**
 * Get the maximum number of files that can be selected based on layout mode
 */
export const maxSelectableFilesSelector = selector({
  key: 'maxSelectableFilesSelector',
  get: ({ get }) => {
    const layoutMode = get(layoutModeState);
    return layoutMode === '1xN' ? 4 : 4; // Both modes support up to 4 files
  },
});

/**
 * Check if maximum files are selected
 */
export const isMaxFilesSelectedSelector = selector({
  key: 'isMaxFilesSelectedSelector',
  get: ({ get }) => {
    const selectedIds = get(selectedFileIdsState);
    const maxSelectable = get(maxSelectableFilesSelector);
    return selectedIds.length >= maxSelectable;
  },
});

/**
 * Get grid layout configuration based on current layout mode and selected files
 */
export const gridLayoutConfigSelector = selector({
  key: 'gridLayoutConfigSelector',
  get: ({ get }) => {
    const layoutMode = get(layoutModeState);
    const selectedIds = get(selectedFileIdsState);
    const fileCount = selectedIds.length;

    if (fileCount === 0) {
      return { rows: 1, cols: 1, gridTemplate: '1fr / 1fr' };
    }

    if (layoutMode === '1xN') {
      return {
        rows: 1,
        cols: fileCount,
        gridTemplate: `1fr / repeat(${fileCount}, 1fr)`,
      };
    } else { // 2xN mode
      if (fileCount === 1) {
        return { rows: 1, cols: 1, gridTemplate: '1fr / 1fr' };
      } else if (fileCount === 2) {
        return { rows: 1, cols: 2, gridTemplate: '1fr / 1fr 1fr' };
      } else if (fileCount === 3) {
        return { rows: 2, cols: 2, gridTemplate: '1fr 1fr / 1fr 1fr' };
      } else { // fileCount === 4
        return { rows: 2, cols: 2, gridTemplate: '1fr 1fr / 1fr 1fr' };
      }
    }
  },
});

/**
 * Get annotations for a specific viewer
 */
export const annotationsForViewerSelector = selectorFamily<Annotation[], string>({
  key: 'annotationsForViewerSelector',
  get: (viewerId) => ({ get }) => {
    const allAnnotations = get(annotationsByViewerIdState);
    return allAnnotations[viewerId] || [];
  },
});

/**
 * Get the current tool for a specific viewer
 */
export const toolForViewerSelector = selectorFamily<ToolType, string>({
  key: 'toolForViewerSelector',
  get: (viewerId) => ({ get }) => {
    const allTools = get(toolStateByViewerIdState);
    return allTools[viewerId] || 'Pan'; // Default to Pan tool
  },
});

/**
 * Check if a specific viewer is active
 */
export const isViewerActiveSelector = selectorFamily<boolean, string>({
  key: 'isViewerActiveSelector',
  get: (viewerId) => ({ get }) => {
    const activeId = get(activeViewerIdState);
    return activeId === viewerId;
  },
});

/**
 * Get viewport settings for a specific viewer
 */
export const viewportSettingsForViewerSelector = selectorFamily<any, string>({
  key: 'viewportSettingsForViewerSelector',
  get: (viewerId) => ({ get }) => {
    const allSettings = get(viewportSettingsByViewerIdState);
    return allSettings[viewerId] || {
      zoom: 1,
      pan: { x: 0, y: 0 },
      windowLevel: { width: 400, center: 40 },
      invert: false,
      rotation: 0,
      hFlip: false,
      vFlip: false,
    };
  },
});

/**
 * Get loading state for a specific viewer
 */
export const isViewerLoadingSelector = selectorFamily<boolean, string>({
  key: 'isViewerLoadingSelector',
  get: (viewerId) => ({ get }) => {
    const loadingStates = get(viewerLoadingStatesState);
    return loadingStates[viewerId] || false;
  },
});

/**
 * Get the selection order number for a specific file
 * Returns 1-4 for selected files, null for unselected files
 */
export const fileSelectionOrderSelector = selectorFamily<number | null, string>({
  key: 'fileSelectionOrderSelector',
  get: (fileId) => ({ get }) => {
    const selectedIds = get(selectedFileIdsState);
    const index = selectedIds.indexOf(fileId);
    return index !== -1 ? index + 1 : null;
  },
});