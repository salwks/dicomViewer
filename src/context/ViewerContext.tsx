/**
 * ViewerContext - 통합 뷰어 전역 상태 관리
 * 싱글 뷰와 비교 뷰 모드를 통합하여 관리하는 컨텍스트
 */

import React, { createContext, useContext, useReducer, ReactNode, useCallback, useEffect } from 'react';
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

// 초기 상태 - layout 기반으로 변경
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

// 리듀서 함수
function viewerReducer(state: ViewerState, action: ViewerAction): ViewerState {
  switch (action.type) {
    case 'SET_LAYOUT': {
      const newLayout = action.payload;

      // 레이아웃 유효성 검사
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

      // const { rows, cols } = newLayout; // 현재 미사용
      const totalViewports = getTotalViewports(newLayout);
      const isMulti = isMultiViewport(newLayout);

      // 필요한 뷰포트 수에 맞게 조정
      let newViewports = [...state.viewports];

      if (totalViewports > newViewports.length) {
        // 뷰포트 추가
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
        // 뷰포트 제거 (필요한 수만큼만 유지)
        newViewports = newViewports.slice(0, totalViewports);
      }

      // 뷰포트 위치 업데이트
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

// 컨텍스트 인터페이스
interface ViewerContextType {
  state: ViewerState;
  dispatch: React.Dispatch<ViewerAction>;
  // 편의 메서드들
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
  loadStudy: (studyInstanceUID: string, seriesInstanceUID?: string) => Promise<void>;
  // URL 관련 메서드들
  initializeFromUrl: () => void;
  updateUrlState: () => void;
  getShareableUrl: () => string;
  loadStudiesFromUrl: (studies: string[]) => Promise<void>;
  // 도구 관련 메서드들
  setActiveTool: (viewportId: string, toolName: string) => void;
  getActiveTool: (viewportId: string) => string | null;
  setToolConfiguration: (viewportId: string, toolName: string, config: Record<string, unknown>) => void;
  getToolConfiguration: (viewportId: string, toolName: string) => Record<string, unknown>;
  getAvailableTools: () => string[];
  verifyTool: (viewportId: string, toolType: ToolType) => Promise<boolean>;
  initializeViewportTools: (viewportId: string, viewportType?: 'stack' | 'volume' | 'multiplanar') => void;
}

// 컨텍스트 생성
const ViewerContext = createContext<ViewerContextType | undefined>(undefined);

// Provider 컴포넌트
interface ViewerProviderProps {
  children: ReactNode;
}

export function ViewerProvider({ children }: ViewerProviderProps) {
  const [state, dispatch] = useReducer(viewerReducer, initialState);

  // 편의 메서드들
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
        // 특정 동기화 타입 토글
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
        // 전체 동기화 토글
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

  // ToolStateManager 통합
  useEffect(() => {
    // ViewerProvider 마운트 시 기본 뷰포트 도구 초기화
    if (state.viewports.length > 0) {
      state.viewports.forEach(viewport => {
        toolStateManager.initializeViewportTools(viewport.id, 'stack');
      });
    }
  }, [state.viewports]); // state.viewports 변경 시 실행

  // 도구 관련 메서드들
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

        // 상태 업데이트
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

  // URL 관련 메서드들
  const initializeFromUrl = useCallback(() => {
    const urlParams = parseCurrentUrl();
    if (Object.keys(urlParams).length > 0) {
      dispatch({ type: 'INITIALIZE_FROM_URL', payload: urlParams });

      // Load studies from URL if present - moved inline to avoid circular dependency
      if (urlParams.studies && urlParams.studies.length > 0) {
        Promise.all(
          urlParams.studies.map(async (studyConfig) => {
            try {
              // This is a placeholder implementation that would need to be completed
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

  // Load study into the active viewport
  const loadStudy = useCallback(
    async (studyInstanceUID: string, seriesInstanceUID?: string): Promise<void> => {
      const activeViewportId = state.activeViewportId || state.viewports[0]?.id;

      if (!activeViewportId) {
        log.error('No active viewport available for loading study', {
          component: 'ViewerContext',
          metadata: { studyInstanceUID, seriesInstanceUID },
        });
        throw new Error('No active viewport available');
      }

      log.info('Loading study into active viewport', {
        component: 'ViewerContext',
        metadata: {
          studyInstanceUID,
          seriesInstanceUID,
          activeViewportId,
        },
      });

      loadStudyInViewport(activeViewportId, studyInstanceUID, seriesInstanceUID);
    },
    [state.activeViewportId, state.viewports, loadStudyInViewport],
  );

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
    loadStudy,
    // URL 관련 메서드들
    initializeFromUrl,
    updateUrlState,
    getShareableUrl,
    loadStudiesFromUrl,
    // 도구 관련 메서드들
    setActiveTool,
    getActiveTool,
    setToolConfiguration,
    getToolConfiguration,
    getAvailableTools,
    verifyTool,
    initializeViewportTools,
  };

  return <ViewerContext.Provider value={contextValue}>{children}</ViewerContext.Provider>;
}

// useViewer 훅
export function useViewer() {
  const context = useContext(ViewerContext);

  if (context === undefined) {
    throw new Error('useViewer must be used within a ViewerProvider');
  }

  return context;
}

// 편의 훅들
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

// 도구 관련 편의 훅들
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
