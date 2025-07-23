/**
 * Type Definitions Index
 *
 * Centralized exports for all application types
 */

// DICOM and Medical Imaging Types
export * from './dicom';

// Re-export Cornerstone3D types for convenience
export type {
  Types as CornerstoneTypes,
  Enums as CornerstoneEnums,
} from '@cornerstonejs/core';

export type {
  Types as CornerstoneToolsTypes,
  Enums as CornerstoneToolsEnums,
} from '@cornerstonejs/tools';

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
  LOADING = 'LOADING'
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
    additionalData?: Record<string, any>;
    sizeInBytes?: number;
    stage?: string;
  };
}

// API response types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
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
