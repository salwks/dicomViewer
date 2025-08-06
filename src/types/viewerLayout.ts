/**
 * Viewer Layout Types
 * Task-based interface types for medical imaging viewer
 * Replaces mode-based architecture with layout-based approach
 */

// 레이아웃 상태 정의 (mode 개념 대체)
export interface ViewerLayout {
  rows: number;
  cols: number;
}

// 뷰포트 위치 및 상태
export interface ViewportPosition {
  row: number;
  col: number;
}

// 뷰포트 동기화 설정
export interface ViewportSynchronization {
  camera: boolean;
  slice: boolean;
  windowLevel: boolean;
}

// 개별 뷰포트 상태
export interface ViewportState {
  id: string;
  studyInstanceUID?: string;
  seriesInstanceUID?: string;
  imageId?: string;
  isActive: boolean;
  position: ViewportPosition;
  synchronization?: ViewportSynchronization;
}

// 전역 동기화 상태
export interface SynchronizationState {
  enabled: boolean;
  types: ViewportSynchronization;
}

// 도구 상태 관리
export interface ToolState {
  activeToolByViewport: Record<string, string>;
  availableTools: string[];
  toolConfiguration: Record<string, Record<string, unknown>>;
}

// 메인 뷰어 상태 (mode 제거, layout 기반)
export interface ViewerState {
  layout: ViewerLayout;
  viewports: ViewportState[];
  activeViewportId: string | null;
  synchronization: SynchronizationState;
  tools: ToolState;
  isLoading: boolean;
  error: string | null;
}

// 레이아웃 변경 액션 타입
export type LayoutAction =
  | { type: 'SET_LAYOUT'; payload: ViewerLayout }
  | { type: 'SET_ACTIVE_VIEWPORT'; payload: string }
  | { type: 'ADD_VIEWPORT'; payload: Omit<ViewportState, 'id'> }
  | { type: 'UPDATE_VIEWPORT'; payload: { id: string; updates: Partial<ViewportState> } }
  | { type: 'REMOVE_VIEWPORT'; payload: string }
  | { type: 'SET_SYNCHRONIZATION'; payload: Partial<SynchronizationState> }
  | { type: 'SET_ACTIVE_TOOL'; payload: { viewportId: string; toolName: string } }
  | {
      type: 'SET_TOOL_CONFIGURATION';
      payload: { viewportId: string; toolName: string; config: Record<string, unknown> };
    }
  | { type: 'UPDATE_AVAILABLE_TOOLS'; payload: string[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'LOAD_STUDY_IN_VIEWPORT'; payload: { viewportId: string; studyInstanceUID: string } }
  | { type: 'RESET_VIEWER' };

// 레이아웃 유틸리티 함수 타입
export interface LayoutUtils {
  getTotalViewports: (layout: ViewerLayout) => number;
  isMultiViewport: (layout: ViewerLayout) => boolean;
  getViewportIndex: (position: ViewportPosition, layout: ViewerLayout) => number;
  getPositionFromIndex: (index: number, layout: ViewerLayout) => ViewportPosition;
  validateLayout: (layout: ViewerLayout) => boolean;
}

// 미리 정의된 레이아웃 설정
export const PREDEFINED_LAYOUTS = {
  SINGLE: { rows: 1, cols: 1 } as ViewerLayout,
  SIDE_BY_SIDE: { rows: 1, cols: 2 } as ViewerLayout,
  STACK_VERTICAL: { rows: 2, cols: 1 } as ViewerLayout,
  QUAD: { rows: 2, cols: 2 } as ViewerLayout,
} as const;

export type PredefinedLayoutKey = keyof typeof PREDEFINED_LAYOUTS;
