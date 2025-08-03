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
