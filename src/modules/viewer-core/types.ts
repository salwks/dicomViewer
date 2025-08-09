/**
 * Viewer Core Module Types
 * Core types and interfaces for the viewer engine
 */

import { Types as CornerstoneTypes } from '@cornerstonejs/core';

export interface ViewerEngineConfig {
  renderingEngineId: string;
  viewportIdPrefix: string;
  maxViewports?: number;
  enableWebGL2?: boolean;
}

export interface ViewportConfig {
  viewportId: string;
  element: HTMLDivElement;
  viewportType: CornerstoneTypes.ViewportType;
  viewportInput?: CornerstoneTypes.PublicViewportInput;
}

export interface ViewerEngineState {
  isInitialized: boolean;
  activeViewportId: string | null;
  viewports: Map<string, ViewportConfig>;
  renderingEngine: CornerstoneTypes.IRenderingEngine | null;
}

export interface ViewerEngineEvents {
  'engine:initialized': void;
  'engine:destroyed': void;
  'viewport:created': { viewportId: string };
  'viewport:removed': { viewportId: string };
  'viewport:activated': { viewportId: string };
}