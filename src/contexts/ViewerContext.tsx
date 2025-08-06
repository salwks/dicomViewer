/**
 * ViewerContext
 * Layout-based unified viewer state management React Context
 * Manages UI state independently from Cornerstone3D state
 * Built with shadcn/ui patterns and medical workflow optimization
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect, type ReactNode } from 'react';
import { log } from '../utils/logger';
import { toolStateManager } from '../services/ToolStateManager';
import { ToolType } from '../types/tools';
import { urlHandler, parseCurrentUrl, updateUrl, ViewerUrlParams } from '../utils/urlParameterHandler';
import type { ViewerLayout, ViewerState, ViewportState, LayoutAction } from '../types/viewerLayout';
import { validateLayout, getTotalViewports, isMultiViewport, getPositionFromIndex } from '../utils/layoutUtils';

// Export types from viewerLayout for backward compatibility
export type { ViewerLayout, ViewportState, ViewerState } from '../types/viewerLayout';

// Action types - using LayoutAction from types and adding URL actions
export type ViewerAction = LayoutAction | { type: 'INITIALIZE_FROM_URL'; payload: ViewerUrlParams };

// Initial state - layout-based structure
const initialState: ViewerState = {
  layout: { rows: 1, cols: 1 },
  viewports: [
    {
      id: 'main-viewport',
      isActive: true,
      position: { row: 0, col: 0 },
      synchronization: {
        camera: false,
        slice: false,
        windowLevel: false,
      },
    },
  ],
  activeViewportId: 'main-viewport',
  synchronization: {
    enabled: false,
    types: {
      camera: true,
      slice: true,
      windowLevel: false,
    },
  },
  tools: {
    activeToolByViewport: {
      'main-viewport': 'WindowLevel',
    },
    availableTools: ['WindowLevel', 'Pan', 'Zoom', 'Length', 'Angle', 'Rectangle'],
    toolConfiguration: {},
  },
  isLoading: false,
  error: null,
};

// Reducer function for state management
function viewerReducer(state: ViewerState, action: ViewerAction): ViewerState {
  switch (action.type) {
    case 'SET_LAYOUT': {
      const newLayout = action.payload;

      // Layout validation
      if (!validateLayout(newLayout)) {
        log.error('Invalid layout provided', {
          component: 'ViewerContext',
          layout: newLayout,
        });
        return state;
      }

      log.info('Viewer layout changed', {
        component: 'ViewerContext',
        metadata: { from: state.layout, to: newLayout },
      });

      const totalViewports = getTotalViewports(newLayout);
      const isMulti = isMultiViewport(newLayout);

      // Adjust viewport count as needed
      let newViewports = [...state.viewports];

      if (totalViewports > newViewports.length) {
        // Add viewports
        for (let i = newViewports.length; i < totalViewports; i++) {
          const position = getPositionFromIndex(i, newLayout);
          newViewports.push({
            id: `viewport-${i}`,
            isActive: false,
            position,
            synchronization: {
              camera: isMulti,
              slice: isMulti,
              windowLevel: false,
            },
          });
        }
      } else if (totalViewports < newViewports.length) {
        // Remove viewports (keep only needed count)
        newViewports = newViewports.slice(0, totalViewports);
      }

      // Update viewport positions
      newViewports = newViewports.map((viewport, index) => ({
        ...viewport,
        position: getPositionFromIndex(index, newLayout),
      }));

      return {
        ...state,
        layout: newLayout,
        viewports: newViewports,
        synchronization: {
          ...state.synchronization,
          enabled: isMulti,
        },
      };
    }

    case 'SET_ACTIVE_VIEWPORT': {
      const viewportId = action.payload;
      return {
        ...state,
        activeViewportId: viewportId,
        viewports: state.viewports.map(viewport => ({
          ...viewport,
          isActive: viewport.id === viewportId,
        })),
      };
    }

    case 'ADD_VIEWPORT': {
      const newViewport: ViewportState = {
        ...action.payload,
        id: `viewport-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };

      return {
        ...state,
        viewports: [...state.viewports, newViewport],
      };
    }

    case 'UPDATE_VIEWPORT': {
      const { id, updates } = action.payload;
      return {
        ...state,
        viewports: state.viewports.map(viewport => (viewport.id === id ? { ...viewport, ...updates } : viewport)),
      };
    }

    case 'REMOVE_VIEWPORT': {
      const viewportId = action.payload;
      const filteredViewports = state.viewports.filter(v => v.id !== viewportId);

      return {
        ...state,
        viewports: filteredViewports,
        activeViewportId:
          state.activeViewportId === viewportId ? filteredViewports[0]?.id || null : state.activeViewportId,
      };
    }

    case 'SET_SYNCHRONIZATION': {
      return {
        ...state,
        synchronization: {
          ...state.synchronization,
          ...action.payload,
        },
      };
    }

    case 'SET_ACTIVE_TOOL': {
      const { viewportId, toolName } = action.payload;
      return {
        ...state,
        tools: {
          ...state.tools,
          activeToolByViewport: {
            ...state.tools.activeToolByViewport,
            [viewportId]: toolName,
          },
        },
      };
    }

    case 'SET_TOOL_CONFIGURATION': {
      const { viewportId, toolName, config } = action.payload;
      return {
        ...state,
        tools: {
          ...state.tools,
          toolConfiguration: {
            ...state.tools.toolConfiguration,
            [`${viewportId}-${toolName}`]: config,
          },
        },
      };
    }

    case 'UPDATE_AVAILABLE_TOOLS': {
      return {
        ...state,
        tools: {
          ...state.tools,
          availableTools: action.payload,
        },
      };
    }

    case 'SET_LOADING': {
      return {
        ...state,
        isLoading: action.payload,
      };
    }

    case 'SET_ERROR': {
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
    }

    case 'INITIALIZE_FROM_URL': {
      const urlParams = action.payload;
      log.info('Initializing viewer from URL parameters', {
        component: 'ViewerContext',
        metadata: { urlParams },
      });

      const newState = { ...state };

      // Set layout from URL (replacing mode logic)
      if (urlParams.layout) {
        const [rows, cols] = urlParams.layout.split('x').map(Number);
        if (rows && cols && validateLayout({ rows, cols })) {
          newState.layout = { rows, cols };
        }
      }

      // Set active viewport from URL
      if (urlParams.viewport) {
        newState.activeViewportId = urlParams.viewport;
      }

      // Set active tool from URL
      if (urlParams.tool && newState.activeViewportId) {
        newState.tools.activeToolByViewport[newState.activeViewportId] = urlParams.tool;
      }

      return newState;
    }

    case 'LOAD_STUDY_IN_VIEWPORT': {
      const { viewportId, studyInstanceUID } = action.payload;
      log.info('Loading study in viewport', {
        component: 'ViewerContext',
        metadata: { viewportId, studyInstanceUID },
      });

      return {
        ...state,
        viewports: state.viewports.map(viewport =>
          viewport.id === viewportId ? { ...viewport, studyInstanceUID } : viewport,
        ),
      };
    }

    case 'RESET_VIEWER': {
      log.info('Viewer state reset', {
        component: 'ViewerContext',
      });
      return initialState;
    }

    default:
      return state;
  }
}

// Context interface
interface ViewerContextType {
  state: ViewerState;
  dispatch: React.Dispatch<ViewerAction>;
  // Convenience methods
  setLayout: (layout: ViewerLayout) => void;
  setActiveViewport: (id: string) => void;
  addViewport: (viewport: Omit<ViewportState, 'id'>) => void;
  updateViewport: (id: string, updates: Partial<ViewportState>) => void;
  removeViewport: (id: string) => void;
  toggleSynchronization: (type?: keyof ViewerState['synchronization']['types']) => void;
  switchToSingleLayout: () => void;
  switchToSideBySideLayout: () => void;
  switchToQuadLayout: () => void;
  loadStudyInViewport: (viewportId: string, studyInstanceUID: string, seriesInstanceUID?: string) => void;
  // URL-related methods
  initializeFromUrl: () => void;
  updateUrlState: () => void;
  getShareableUrl: () => string;
  loadStudiesFromUrl: (studies: string[]) => Promise<void>;
  // Tool-related methods
  setActiveTool: (viewportId: string, toolName: string) => void;
  getActiveTool: (viewportId: string) => string | null;
  setToolConfiguration: (viewportId: string, toolName: string, config: Record<string, unknown>) => void;
  getToolConfiguration: (viewportId: string, toolName: string) => Record<string, unknown>;
  getAvailableTools: () => string[];
  verifyTool: (viewportId: string, toolType: ToolType) => Promise<boolean>;
  initializeViewportTools: (viewportId: string, viewportType?: 'stack' | 'volume' | 'multiplanar') => void;
  // Legacy Cornerstone3D state accessors (for backward compatibility)
  getViewportCount: () => number;
  getViewportIds: () => string[];
}

export const ViewerContext = createContext<ViewerContextType | undefined>(undefined);

interface ViewerProviderProps {
  children: ReactNode;
}

export const ViewerProvider: React.FC<ViewerProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(viewerReducer, initialState);

  // Convenience methods
  const setLayout = useCallback((layout: ViewerLayout) => {
    dispatch({ type: 'SET_LAYOUT', payload: layout });
  }, []);

  const setActiveViewport = useCallback((id: string) => {
    dispatch({ type: 'SET_ACTIVE_VIEWPORT', payload: id });
  }, []);

  const addViewport = useCallback((viewport: Omit<ViewportState, 'id'>) => {
    dispatch({ type: 'ADD_VIEWPORT', payload: viewport });
  }, []);

  const updateViewport = useCallback((id: string, updates: Partial<ViewportState>) => {
    dispatch({ type: 'UPDATE_VIEWPORT', payload: { id, updates } });
  }, []);

  const removeViewport = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_VIEWPORT', payload: id });
  }, []);

  const toggleSynchronization = useCallback(
    (type?: keyof ViewerState['synchronization']['types']) => {
      if (type) {
        // Toggle specific synchronization type
        dispatch({
          type: 'SET_SYNCHRONIZATION',
          payload: {
            types: {
              ...state.synchronization.types,
              // eslint-disable-next-line security/detect-object-injection -- Safe: type is validated synchronization type string
              [type]: !state.synchronization.types[type],
            },
          },
        });
      } else {
        // Toggle global synchronization
        dispatch({
          type: 'SET_SYNCHRONIZATION',
          payload: {
            enabled: !state.synchronization.enabled,
          },
        });
      }
    },
    [state.synchronization],
  );

  const switchToSingleLayout = useCallback(() => {
    setLayout({ rows: 1, cols: 1 });
  }, [setLayout]);

  const switchToSideBySideLayout = useCallback(() => {
    setLayout({ rows: 1, cols: 2 });
  }, [setLayout]);

  const switchToQuadLayout = useCallback(() => {
    setLayout({ rows: 2, cols: 2 });
  }, [setLayout]);

  const loadStudyInViewport = useCallback(
    (viewportId: string, studyInstanceUID: string, seriesInstanceUID?: string) => {
      dispatch({ type: 'SET_LOADING', payload: true });

      try {
        updateViewport(viewportId, {
          studyInstanceUID,
          seriesInstanceUID,
        });

        log.info('Study loaded in viewport', {
          component: 'ViewerContext',
          metadata: { viewportId, studyInstanceUID, seriesInstanceUID },
        });

        dispatch({ type: 'SET_LOADING', payload: false });
      } catch (error) {
        log.error(
          'Failed to load study in viewport',
          {
            component: 'ViewerContext',
            metadata: { viewportId, studyInstanceUID },
          },
          error as Error,
        );

        dispatch({ type: 'SET_ERROR', payload: `Failed to load study: ${error}` });
      }
    },
    [updateViewport],
  );

  // ToolStateManager integration
  useEffect(() => {
    // Initialize default viewport tools when ViewerProvider mounts
    if (state.viewports.length > 0) {
      state.viewports.forEach(viewport => {
        toolStateManager.initializeViewportTools(viewport.id, 'stack');
      });
    }
  }, [state.viewports]);

  // Tool-related methods
  const setActiveTool = useCallback((viewportId: string, toolName: string) => {
    try {
      toolStateManager.setActiveTool(viewportId, toolName);
      dispatch({ type: 'SET_ACTIVE_TOOL', payload: { viewportId, toolName } });

      log.info('Active tool changed via ViewerContext', {
        component: 'ViewerContext',
        metadata: { viewportId, toolName },
      });
    } catch (error) {
      log.error(
        'Failed to set active tool',
        {
          component: 'ViewerContext',
          metadata: { viewportId, toolName },
        },
        error as Error,
      );

      dispatch({ type: 'SET_ERROR', payload: `Failed to set active tool: ${error}` });
    }
  }, []);

  const getActiveTool = useCallback(
    (viewportId: string): string | null => {
      // eslint-disable-next-line security/detect-object-injection -- Safe: viewportId is validated viewport identifier
      return state.tools.activeToolByViewport[viewportId] || null;
    },
    [state.tools.activeToolByViewport],
  );

  const setToolConfiguration = useCallback((viewportId: string, toolName: string, config: Record<string, unknown>) => {
    try {
      toolStateManager.setToolConfiguration(viewportId, toolName, config);
      dispatch({ type: 'SET_TOOL_CONFIGURATION', payload: { viewportId, toolName, config } });

      log.info('Tool configuration updated via ViewerContext', {
        component: 'ViewerContext',
        metadata: { viewportId, toolName, configKeys: Object.keys(config) },
      });
    } catch (error) {
      log.error(
        'Failed to set tool configuration',
        {
          component: 'ViewerContext',
          metadata: { viewportId, toolName },
        },
        error as Error,
      );

      dispatch({ type: 'SET_ERROR', payload: `Failed to set tool configuration: ${error}` });
    }
  }, []);

  const getToolConfiguration = useCallback(
    (viewportId: string, toolName: string): Record<string, unknown> => {
      return state.tools.toolConfiguration[`${viewportId}-${toolName}`] || {};
    },
    [state.tools.toolConfiguration],
  );

  const getAvailableTools = useCallback((): string[] => {
    return [...state.tools.availableTools];
  }, [state.tools.availableTools]);

  const verifyTool = useCallback(async (viewportId: string, toolType: ToolType): Promise<boolean> => {
    try {
      const result = await toolStateManager.verifyTool('main-toolgroup', toolType);

      log.info('Tool verification completed via ViewerContext', {
        component: 'ViewerContext',
        metadata: { viewportId, toolType, result },
      });

      return result;
    } catch (error) {
      log.error(
        'Tool verification failed',
        {
          component: 'ViewerContext',
          metadata: { viewportId, toolType },
        },
        error as Error,
      );

      return false;
    }
  }, []);

  const initializeViewportTools = useCallback(
    (viewportId: string, viewportType: 'stack' | 'volume' | 'multiplanar' = 'stack') => {
      try {
        const toolState = toolStateManager.initializeViewportTools(viewportId, viewportType);

        // Update state
        dispatch({ type: 'SET_ACTIVE_TOOL', payload: { viewportId, toolName: toolState.activeTool } });
        dispatch({ type: 'UPDATE_AVAILABLE_TOOLS', payload: toolState.availableTools });

        log.info('Viewport tools initialized via ViewerContext', {
          component: 'ViewerContext',
          metadata: { viewportId, viewportType, toolCount: toolState.availableTools.length },
        });
      } catch (error) {
        log.error(
          'Failed to initialize viewport tools',
          {
            component: 'ViewerContext',
            metadata: { viewportId, viewportType },
          },
          error as Error,
        );

        dispatch({ type: 'SET_ERROR', payload: `Failed to initialize viewport tools: ${error}` });
      }
    },
    [],
  );

  // URL-related methods
  const initializeFromUrl = useCallback(() => {
    const urlParams = parseCurrentUrl();
    if (Object.keys(urlParams).length > 0) {
      dispatch({ type: 'INITIALIZE_FROM_URL', payload: urlParams });

      // Load studies from URL if present
      if (urlParams.studies && urlParams.studies.length > 0) {
        Promise.all(
          urlParams.studies.map(async (studyConfig) => {
            try {
              log.info('Loading study from URL', { studyConfig });
              return studyConfig;
            } catch (error) {
              log.error('Failed to load study from URL', { studyConfig }, error as Error);
              return null;
            }
          }),
        ).catch((error) => {
          log.error('Failed to load studies from URL', {}, error as Error);
        });
      }
    }
  }, []);

  const updateUrlState = useCallback(() => {
    const urlParams: ViewerUrlParams = {
      layout: `${state.layout.rows}x${state.layout.cols}`,
      viewport: state.activeViewportId || undefined,
    };

    // Add active tool for current viewport
    if (state.activeViewportId && state.tools.activeToolByViewport[state.activeViewportId]) {
      urlParams.tool = state.tools.activeToolByViewport[state.activeViewportId];
    }

    // Add studies from viewports
    const studies = state.viewports.map(v => v.studyInstanceUID).filter((uid): uid is string => uid !== undefined);
    if (studies.length > 0) {
      urlParams.studies = studies;
    }

    updateUrl(urlParams, true);
  }, [state]);

  const getShareableUrl = useCallback((): string => {
    const urlParams: ViewerUrlParams = {
      layout: `${state.layout.rows}x${state.layout.cols}`,
    };

    // Add studies from viewports
    const studies = state.viewports.map(v => v.studyInstanceUID).filter((uid): uid is string => uid !== undefined);
    if (studies.length > 0) {
      urlParams.studies = studies;
    }

    return urlHandler.generateShareableUrl(urlParams);
  }, [state]);

  const loadStudiesFromUrl = useCallback(
    async (studies: string[]): Promise<void> => {
      if (!urlHandler.validateStudyParams(studies)) {
        log.warn('Invalid study parameters in URL', {
          component: 'ViewerContext',
          studies,
        });
        return;
      }

      dispatch({ type: 'SET_LOADING', payload: true });

      try {
        // Load studies into available viewports
        for (let i = 0; i < studies.length && i < state.viewports.length; i++) {
          // eslint-disable-next-line security/detect-object-injection -- Safe: i is controlled loop index within bounds
          const viewport = state.viewports[i];
          // eslint-disable-next-line security/detect-object-injection -- Safe: i is controlled loop index within bounds
          const studyUID = studies[i];

          dispatch({
            type: 'LOAD_STUDY_IN_VIEWPORT',
            payload: { viewportId: viewport.id, studyInstanceUID: studyUID },
          });
        }

        log.info('Studies loaded from URL', {
          component: 'ViewerContext',
          metadata: { studies },
        });
      } catch (error) {
        log.error(
          'Failed to load studies from URL',
          {
            component: 'ViewerContext',
          },
          error as Error,
        );

        dispatch({ type: 'SET_ERROR', payload: `Failed to load studies from URL: ${error}` });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [state.viewports],
  );

  // Legacy Cornerstone3D state accessors (for backward compatibility)
  const getViewportCount = useCallback((): number => {
    return state.viewports.length;
  }, [state.viewports.length]);

  const getViewportIds = useCallback((): string[] => {
    return state.viewports.map(v => v.id);
  }, [state.viewports]);

  // Initialize from URL on mount
  useEffect(() => {
    initializeFromUrl();

    // Listen for URL parameter changes
    const handleUrlChange = (urlParams: ViewerUrlParams) => {
      dispatch({ type: 'INITIALIZE_FROM_URL', payload: urlParams });

      if (urlParams.studies && urlParams.studies.length > 0) {
        loadStudiesFromUrl(urlParams.studies);
      }
    };

    urlHandler.addListener(handleUrlChange);

    return () => {
      urlHandler.removeListener(handleUrlChange);
    };
  }, [initializeFromUrl, loadStudiesFromUrl]);

  // Update URL when state changes
  useEffect(() => {
    updateUrlState();
  }, [state.layout, state.activeViewportId, state.viewports, updateUrlState]);

  const contextValue: ViewerContextType = {
    state,
    dispatch,
    setLayout,
    setActiveViewport,
    addViewport,
    updateViewport,
    removeViewport,
    toggleSynchronization,
    switchToSingleLayout,
    switchToSideBySideLayout,
    switchToQuadLayout,
    loadStudyInViewport,
    // URL-related methods
    initializeFromUrl,
    updateUrlState,
    getShareableUrl,
    loadStudiesFromUrl,
    // Tool-related methods
    setActiveTool,
    getActiveTool,
    setToolConfiguration,
    getToolConfiguration,
    getAvailableTools,
    verifyTool,
    initializeViewportTools,
    // Legacy Cornerstone3D state accessors (for backward compatibility)
    getViewportCount,
    getViewportIds,
  };

  return <ViewerContext.Provider value={contextValue}>{children}</ViewerContext.Provider>;
};

// useViewer hook
export function useViewer() {
  const context = useContext(ViewerContext);

  if (context === undefined) {
    throw new Error('useViewer must be used within a ViewerProvider');
  }

  return context;
}

// Convenience hooks
export function useViewerLayout() {
  const { state } = useViewer();
  return state.layout;
}

export function useActiveViewport() {
  const { state } = useViewer();
  const activeViewport = state.viewports.find(v => v.id === state.activeViewportId);
  return activeViewport || null;
}

export function useViewportById(id: string) {
  const { state } = useViewer();
  return state.viewports.find(v => v.id === id) || null;
}

export function useSynchronization() {
  const { state, toggleSynchronization } = useViewer();
  return {
    synchronization: state.synchronization,
    toggleSynchronization,
    isEnabled: state.synchronization.enabled,
  };
}

// Tool-related convenience hooks
export function useTools() {
  const {
    state,
    setActiveTool,
    getActiveTool,
    setToolConfiguration,
    getToolConfiguration,
    getAvailableTools,
    verifyTool,
    initializeViewportTools,
  } = useViewer();
  return {
    tools: state.tools,
    setActiveTool,
    getActiveTool,
    setToolConfiguration,
    getToolConfiguration,
    getAvailableTools,
    verifyTool,
    initializeViewportTools,
  };
}

export function useViewportTools(viewportId: string) {
  const { state, setActiveTool, getActiveTool, setToolConfiguration, getToolConfiguration } = useViewer();

  return {
    activeTool: getActiveTool(viewportId),
    availableTools: state.tools.availableTools,
    setActiveTool: (toolName: string) => setActiveTool(viewportId, toolName),
    setToolConfiguration: (toolName: string, config: Record<string, unknown>) =>
      setToolConfiguration(viewportId, toolName, config),
    getToolConfiguration: (toolName: string) => getToolConfiguration(viewportId, toolName),
  };
}

export function useActiveTool(viewportId: string) {
  const { getActiveTool, setActiveTool } = useViewer();

  return {
    activeTool: getActiveTool(viewportId),
    setActiveTool: (toolName: string) => setActiveTool(viewportId, toolName),
  };
}
