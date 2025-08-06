/**
 * Viewer Types
 * 통합 뷰어 시스템을 위한 타입 정의
 */

import React from 'react';

export type LayoutType = '1x1' | '1x2' | '2x1' | '2x2';

export type ViewerModeType = 'single' | 'comparison' | 'advanced';

export interface ViewerMode {
  type: ViewerModeType;
  layout: LayoutType;
  syncEnabled: boolean;
  crossReferenceEnabled: boolean;
}

export interface ViewportState {
  id: string;
  studyInstanceUID?: string;
  seriesInstanceUID?: string;
  imageIndex: number;
  zoom: number;
  pan: { x: number; y: number };
  windowLevel: { window: number; level: number };
  rotation: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  isActive: boolean;
}

export interface VolumeRenderingConfig {
  enabled: boolean;
  preset: 'ct-bone' | 'ct-chest' | 'ct-abdomen' | 'mri-default' | 'custom';
  opacity: number;
  ambient: number;
  diffuse: number;
  specular: number;
  specularPower: number;
  shade: boolean;
  colorMap: string;
  windowLevel: { window: number; level: number };
}

export interface MPRConfig {
  enabled: boolean;
  axialVisible: boolean;
  sagittalVisible: boolean;
  coronalVisible: boolean;
  thickness: number;
  blendMode: 'maximum' | 'minimum' | 'average';
}

export interface AdvancedViewportState extends ViewportState {
  volumeRendering: VolumeRenderingConfig;
  mpr: MPRConfig;
  renderingType: 'stack' | 'volume' | 'mpr';
}

export interface UnifiedViewerProps {
  initialMode?: ViewerMode;
  onModeChange?: (mode: ViewerMode) => void;
  className?: string;
  children?: React.ReactNode;
}

export interface ViewerContextType {
  mode: ViewerMode;
  setMode: (mode: ViewerMode) => void;
  // Cornerstone3D 상태 읽기 전용 접근자들
  getViewportCount: () => number;
  getViewportIds: () => string[];
}

export const DEFAULT_VIEWER_MODE: ViewerMode = {
  type: 'single',
  layout: '1x1',
  syncEnabled: false,
  crossReferenceEnabled: false,
};

export interface ViewportGridProps {
  mode?: ViewerMode;
  layout: LayoutType;
  viewports: ViewportState[];
  onLayoutChange?: (layout: LayoutType) => void;
  onViewportChange?: (id: string, state: Partial<ViewportState>) => void;
  className?: string;
  animationDuration?: number;
}

export interface ViewportItemProps {
  viewport: ViewportState;
  gridArea: string;
  onViewportChange?: (id: string, state: Partial<ViewportState>) => void;
  className?: string;
}

export interface GridLayoutConfig {
  layout: LayoutType;
  gridTemplate: {
    columns: string;
    rows: string;
    areas: string[][];
  };
  viewportCount: number;
}

export const DEFAULT_VIEWPORT_STATE: Omit<ViewportState, 'id'> = {
  imageIndex: 0,
  zoom: 1,
  pan: { x: 0, y: 0 },
  windowLevel: { window: 400, level: 40 },
  rotation: 0,
  flipHorizontal: false,
  flipVertical: false,
  isActive: false,
};
