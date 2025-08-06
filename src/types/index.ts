/**
 * Type Definitions Index
 *
 * Centralized exports for all application types
 */

// DICOM and Medical Imaging Types
export * from './dicom';

// Re-export Cornerstone3D types for convenience
export type { Types as CornerstoneTypes, Enums as CornerstoneEnums } from '@cornerstonejs/core';

export type { Types as CornerstoneToolsTypes, Enums as CornerstoneToolsEnums } from '@cornerstonejs/tools';

// Import specific types and re-export them for backward compatibility
// import type { Types } from '@cornerstonejs/core'; // Types not available
// Type aliases for missing Cornerstone3D types
export type IViewport = any; // Types.IViewport not available
export type IStackViewport = any; // Types.IStackViewport not available
export type IVolumeViewport = any; // Types.IVolumeViewport not available
export type PublicViewportInput = any; // Types.PublicViewportInput not available
export type Point3 = [number, number, number]; // Types.Point3 not available
export type Point2 = [number, number]; // Types.Point2 not available
export type IRenderingEngine = any; // Types.IRenderingEngine not available

// Layout-based viewer types
export interface ViewerLayout {
  rows: number;
  cols: number;
}

export interface ViewerViewport {
  id: string;
  position: { row: number; col: number };
  seriesInstanceUID?: string;
  studyInstanceUID?: string;
  imageIndex?: number;
  windowLevel?: { window: number; level: number };
  zoom?: number;
  pan?: { x: number; y: number };
  tools?: {
    activeTool: string;
    availableTools: string[];
    toolConfiguration: Record<string, unknown>;
    annotations: unknown[];
    measurements: unknown[];
  };
}

export interface ViewerSynchronization {
  enabled: boolean;
  types: ('windowLevel' | 'zoom' | 'pan' | 'scroll')[];
  viewportIds: string[];
}

export interface ViewerTools {
  activeTool: string;
  availableTools: string[];
  globalConfiguration: Record<string, unknown>;
}

export interface ViewerState {
  layout: ViewerLayout;
  viewports: Record<string, ViewerViewport>;
  activeViewportId: string | null;
  synchronization: ViewerSynchronization;
  tools: ViewerTools;
  isLoading: boolean;
  error: string | null;
}

// Application-specific types
export interface AppConfig {
  name: string;
  version: string;
  environment: 'development' | 'production' | 'test';
  features: {
    segmentation: boolean;
    measurement: boolean;
    annotation: boolean;
    multiplanarReconstruction: boolean;
    volumeRendering: boolean;
  };
}

// Error Recovery System Types
export interface ViewportStateBackup {
  id: string;
  type: 'stack' | 'volume' | 'multiplanar';
  seriesInstanceUID?: string;
  imageIndex?: number;
  windowLevel?: {
    window: number;
    level: number;
  };
  zoom?: number;
  pan?: { x: number; y: number };
  rotation?: number;
}

export interface ToolStateBackup {
  activeTool?: string;
  toolSettings: Record<string, any>;
  annotations: Array<{
    id: string;
    type: string;
    data: Record<string, any>;
  }>;
  measurements: Array<{
    id: string;
    type: string;
    value: number;
    unit: string;
  }>;
}

export interface UserPreferencesBackup {
  windowLevelPresets: Array<{
    name: string;
    window: number;
    level: number;
  }>;
  displaySettings: {
    showAnnotations: boolean;
    showMeasurements: boolean;
    theme: 'light' | 'dark';
  };
  keyboardShortcuts: Record<string, string>;
}

export interface SessionDataBackup {
  sessionId: string;
  startTime: number;
  studyInstanceUIDs: string[];
  activeViewports: string[];
  lastActivity: number;
}

// Migration System Types
export interface MigrationData {
  version: string;
  viewportStates?: ViewportStateBackup[];
  annotations?: Array<{
    id: string;
    type: string;
    data: Record<string, any>;
    metadata: Record<string, any>;
  }>;
  settings?: UserPreferencesBackup;
  [key: string]: any;
}

export interface User {
  id: string;
  name: string;
  role: 'radiologist' | 'technician' | 'physician' | 'researcher';
  permissions: string[];
}

export interface Session {
  id: string;
  user: User;
  startTime: Date;
  lastActivity: Date;
  studies: string[];
}

// Error types
export enum ErrorCategory {
  DICOM_PARSING = 'DICOM_PARSING',
  RENDERING = 'RENDERING',
  NETWORK = 'NETWORK',
  SECURITY = 'SECURITY',
  USER_INPUT = 'USER_INPUT',
  AUTHENTICATION = 'AUTHENTICATION',
  MEMORY = 'MEMORY',
  VALIDATION = 'VALIDATION',
  CONFIGURATION = 'CONFIGURATION',
  CORRUPTION = 'CORRUPTION',
  PERFORMANCE = 'PERFORMANCE',
  LOADING = 'LOADING',
}

export interface MedicalImagingError extends Error {
  code: string;
  category: ErrorCategory;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  context?: {
    studyInstanceUID?: string;
    seriesInstanceUID?: string;
    sopInstanceUID?: string;
    sopClassUID?: string;
    viewportId?: string;
    toolName?: string;
    imageId?: string;
    volumeId?: string;
    imageCount?: number;
    timestamp?: Date;
    stackTrace?: string;
    additionalData?: Record<string, unknown>;
    sizeInBytes?: number;
    stage?: string;
  };
}

// API response types
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

// Component prop types
export interface BaseComponentProps {
  className?: string;
  style?: React.CSSProperties;
  'data-testid'?: string;
}

// Viewport State types
export type {
  ViewportState,
  ViewportStateUpdate,
  ViewportStateChange,
  ViewportStateValidator,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  CameraState,
  WindowLevelState,
  TransformState,
  StackState,
  VolumeState,
  ToolState,
  AnnotationState,
  MeasurementState,
  RenderingState,
  SeriesAssignment,
  ActivationState,
  PerformanceState,
  StatePersistenceConfig,
} from './viewportState';
export { createDefaultViewportState, DEFAULT_PERSISTENCE_CONFIG } from './viewportState';
