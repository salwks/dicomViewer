/**
 * Viewport State Type Definitions
 * Comprehensive viewport state management interface
 * Built with security compliance and type safety
 */

import { SynchronizationSettings } from '../components/SynchronizationControls';

// Camera state interface for viewport positioning
export interface CameraState {
  position: [number, number, number];
  focalPoint: [number, number, number];
  viewUp: [number, number, number];
  parallelScale: number;
  parallelProjection: boolean;
  viewPlaneNormal?: [number, number, number];
}

// Window/Level settings for display
export interface WindowLevelState {
  width: number;
  center: number;
  presetName?: string;
}

// Pan and zoom state
export interface TransformState {
  pan: { x: number; y: number };
  zoom: number;
  rotation?: number;
}

// Stack-specific viewport state
export interface StackState {
  currentImageIndex: number;
  totalImages: number;
  imageIds: string[];
  currentImageId: string;
  pixelSpacing?: [number, number];
  thickness?: number;
}

// Volume-specific viewport state
export interface VolumeState {
  volumeId: string;
  sliceIndex: number;
  orientation: 'axial' | 'sagittal' | 'coronal' | 'oblique';
  thickness: number;
  spacing: [number, number, number];
}

// Tool state for this viewport
export interface ToolState {
  activeTool: string;
  availableTools: string[];
  toolConfiguration: Record<string, unknown>;
  annotations: AnnotationState[];
  measurements: MeasurementState[];
}

// Annotation state
export interface AnnotationState {
  id: string;
  type: 'length' | 'angle' | 'area' | 'rectangle' | 'ellipse' | 'arrow' | 'text';
  data: Record<string, unknown>;
  isVisible: boolean;
  isLocked: boolean;
  style: Record<string, unknown>;
  metadata: {
    createdAt: string;
    modifiedAt: string;
    author?: string;
  };
}

// Measurement state
export interface MeasurementState {
  id: string;
  type: 'length' | 'area' | 'angle' | 'volume';
  value: number;
  unit: string;
  precision: number;
  isVisible: boolean;
  coordinates: number[][];
  metadata: {
    createdAt: string;
    imageId?: string;
    frameIndex?: number;
  };
}

// Rendering settings
export interface RenderingState {
  interpolationType: 'LINEAR' | 'NEAREST';
  colormap?: string;
  opacity: number;
  invertColors: boolean;
  useCPURendering: boolean;
  quality: 'low' | 'medium' | 'high';
}

// Series assignment information
export interface SeriesAssignment {
  seriesInstanceUID: string;
  studyInstanceUID: string;
  modality: string;
  seriesNumber: number;
  numberOfImages: number;
  description?: string;
  bodyPart?: string;
}

// Viewport activation and focus state
export interface ActivationState {
  isActive: boolean;
  isFocused: boolean;
  isVisible: boolean;
  activatedAt?: string;
  lastInteractionAt?: string;
}

// Performance and debug state
export interface PerformanceState {
  fps: number;
  renderTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  isRenderingEnabled: boolean;
  debugMode: boolean;
  targetFrameInterval?: number; // Target milliseconds between frames
  throttleRatio?: number; // Rendering throttle ratio (0.0 to 1.0)
  dynamicQualityEnabled?: boolean; // Enable dynamic quality adjustment
  currentQualityLevel?: string; // Current quality level name
}

// Main viewport state interface
export interface ViewportState {
  // Basic identification
  readonly id: string;
  readonly type: 'stack' | 'volume' | 'multiplanar';

  // Series and content
  seriesAssignment: SeriesAssignment | null;

  // Visual presentation
  camera: CameraState;
  windowLevel: WindowLevelState;
  transform: TransformState;
  rendering: RenderingState;

  // Content-specific state
  stack?: StackState;
  volume?: VolumeState;

  // Interaction state
  tools: ToolState;
  activation: ActivationState;
  synchronization: SynchronizationSettings;

  // Performance and debugging
  performance: PerformanceState;

  // Metadata
  metadata: {
    createdAt: string;
    modifiedAt: string;
    version: string;
    layout: {
      position: { row: number; col: number };
      size: { width: number; height: number };
    };
    preferences: Record<string, unknown>;
  };
}

// Partial state for updates - exclude readonly fields completely
export type ViewportStateUpdate = Partial<
  Omit<ViewportState, 'id' | 'type' | 'metadata'> & {
    metadata?: Partial<ViewportState['metadata']> & {
      modifiedAt?: string;  // Allow updating modification time
      preferences?: Record<string, unknown>; // Allow updating preferences
    };
  }
>;

// State validation interface
export interface ViewportStateValidator {
  validateState(state: ViewportState): ValidationResult;
  validateUpdate(update: ViewportStateUpdate): ValidationResult;
  sanitizeState(state: ViewportState): ViewportState;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

// Factory function for creating default viewport state
export function createDefaultViewportState(
  id: string,
  type: ViewportState['type'] = 'stack',
): ViewportState {
  const now = new Date().toISOString();

  return {
    id,
    type,
    seriesAssignment: null,
    camera: {
      position: [0, 0, -1000],
      focalPoint: [0, 0, 0],
      viewUp: [0, -1, 0],
      parallelScale: 300,
      parallelProjection: true,
    },
    windowLevel: {
      width: 400,
      center: 40,
    },
    transform: {
      pan: { x: 0, y: 0 },
      zoom: 1.0,
    },
    rendering: {
      interpolationType: 'LINEAR',
      opacity: 1.0,
      invertColors: false,
      useCPURendering: false,
      quality: 'high',
    },
    tools: {
      activeTool: 'WindowLevel',
      availableTools: ['WindowLevel', 'Pan', 'Zoom', 'Length', 'Angle'],
      toolConfiguration: {},
      annotations: [],
      measurements: [],
    },
    activation: {
      isActive: false,
      isFocused: false,
      isVisible: true,
    },
    synchronization: {
      enableZoom: false,
      enablePan: false,
      enableScroll: false,
      enableWindowLevel: false,
      enableReferenceLines: false,
      enableSliceSync: false,
      enableAnatomicalMapping: false,
    },
    performance: {
      fps: 60,
      renderTime: 16,
      memoryUsage: 0,
      cacheHitRate: 0.8,
      isRenderingEnabled: true,
      debugMode: false,
    },
    metadata: {
      createdAt: now,
      modifiedAt: now,
      version: '1.0.0',
      layout: {
        position: { row: 0, col: 0 },
        size: { width: 512, height: 512 },
      },
      preferences: {},
    },
  };
}

// Utility type for state change notifications
export interface ViewportStateChange {
  viewportId: string;
  previousState: ViewportState;
  newState: ViewportState;
  changedFields: (keyof ViewportState)[];
  timestamp: string;
}

// State persistence configuration
export interface StatePersistenceConfig {
  enablePersistence: boolean;
  persistFields: (keyof ViewportState)[];
  storageKey: string;
  encryptionEnabled: boolean;
  compressionEnabled: boolean;
  maxStorageSize: number; // in bytes
}

// Default persistence configuration
export const DEFAULT_PERSISTENCE_CONFIG: StatePersistenceConfig = {
  enablePersistence: true,
  persistFields: [
    'seriesAssignment',
    'windowLevel',
    'transform',
    'tools',
    'synchronization',
    'rendering',
  ],
  storageKey: 'viewport-states',
  encryptionEnabled: true,
  compressionEnabled: false,
  maxStorageSize: 10 * 1024 * 1024, // 10MB
};

// All types are already exported above through interfaces
