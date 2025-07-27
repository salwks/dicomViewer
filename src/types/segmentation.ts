/**
 * Segmentation Types and Interfaces
 * Types for segmentation management, tools, and visualization
 */

/**
 * Segmentation representation types
 */
export enum SegmentationRepresentation {
  LABELMAP = 'labelmap',
  CONTOUR = 'contour',
  SURFACE = 'surface',
}

/**
 * Segmentation tool types
 */
export enum SegmentationToolType {
  BRUSH = 'brush',
  ERASER = 'eraser',
  THRESHOLD = 'threshold',
  REGION_GROWING = 'region_growing',
  LIVEWIRE = 'livewire',
  SCISSORS = 'scissors',
  FREEHAND = 'freehand',
}

/**
 * Segmentation export formats
 */
export enum SegmentationFormat {
  NIFTI = 'nifti',
  DICOM_SEG = 'dicom-seg',
  NRRD = 'nrrd',
  STL = 'stl',
  JSON = 'json',
  PNG_SERIES = 'png-series',
}

/**
 * Segment properties for individual segments within a segmentation
 */
export interface Segment {
  segmentIndex: number;
  label: string;
  color: [number, number, number]; // RGB color
  opacity: number;
  visible: boolean;
  locked: boolean;
  category?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for segmentation creation and management
 */
export interface SegmentationConfig {
  segmentationId: string;
  representation: SegmentationRepresentation;
  activeSegmentIndex: number;
  visibility: boolean;
  locked: boolean;
  renderInactiveSegmentations: boolean;
  segments: Segment[];
  metadata?: {
    patientId?: string;
    studyInstanceUID?: string;
    seriesInstanceUID?: string;
    imageIds?: string[];
    createdAt?: Date;
    lastModified?: Date;
    createdBy?: string;
  };
}

/**
 * Segmentation data structure
 */
export interface Segmentation {
  segmentationId: string;
  config: SegmentationConfig;
  data: {
    volumeId?: string;
    imageIds?: string[];
    dimensions?: [number, number, number];
    spacing?: [number, number, number];
    origin?: [number, number, number];
    direction?: number[];
    studyInstanceUID?: string;
    seriesInstanceUID?: string;
  };
  statistics?: {
    totalVolume: number;
    segmentVolumes: Record<number, number>;
    voxelCount: number;
    boundingBox: {
      min: [number, number, number];
      max: [number, number, number];
    };
  };
}

/**
 * Brush tool configuration
 */
export interface BrushToolConfig {
  radius: number;
  hardness: number; // 0-1, 0 = soft, 1 = hard
  mode: 'paint' | 'erase' | 'fill';
  pressureSensitive: boolean;
  shape: 'circle' | 'square';
  spacing: number; // Controls brush stroke density
}

/**
 * Threshold segmentation configuration
 */
export interface ThresholdConfig {
  lower: number;
  upper: number;
  connectivityMode: '6' | '18' | '26'; // 3D connectivity
  seedPoints?: Array<{ x: number; y: number; z: number }>;
  fillHoles: boolean;
  smoothing: boolean;
}

/**
 * Region growing segmentation configuration
 */
export interface RegionGrowingConfig {
  seedPoints: Array<{ x: number; y: number; z: number }>;
  similarity: {
    mode: 'intensity' | 'gradient' | 'adaptive';
    threshold: number;
    radius?: number; // For adaptive mode
  };
  constraints: {
    maxRegionSize?: number;
    minRegionSize?: number;
    maxDistance?: number;
  };
  stopCriteria: {
    maxIterations: number;
    convergenceThreshold: number;
  };
}

/**
 * Segmentation editing operations
 */
export enum EditingOperation {
  SMOOTH = 'smooth',
  DILATE = 'dilate',
  ERODE = 'erode',
  FILL_HOLES = 'fill_holes',
  REMOVE_ISLANDS = 'remove_islands',
  UNION = 'union',
  INTERSECTION = 'intersection',
  DIFFERENCE = 'difference',
  INTERPOLATE = 'interpolate',
}

/**
 * Editing operation configuration
 */
export interface EditingConfig {
  operation: EditingOperation;
  parameters: {
    iterations?: number;
    kernelSize?: number;
    threshold?: number;
    connectivity?: '6' | '18' | '26';
    targetSegments?: number[];
  };
}

/**
 * Segmentation export configuration
 */
export interface ExportConfig {
  format: SegmentationFormat;
  segmentationIds: string[];
  options: {
    includeMetadata?: boolean;
    compression?: boolean;
    resolution?: number; // For STL export
    quality?: number; // For image formats
    coordinateSystem?: 'patient' | 'image';
    mergeSegments?: boolean; // For STL export
  };
  outputPath?: string;
}

/**
 * Segmentation event types
 */
export enum SegmentationEventType {
  CREATED = 'segmentation_created',
  UPDATED = 'segmentation_updated',
  DELETED = 'segmentation_deleted',
  SEGMENT_ADDED = 'segment_added',
  SEGMENT_UPDATED = 'segment_updated',
  SEGMENT_REMOVED = 'segment_removed',
  REPRESENTATION_CHANGED = 'representation_changed',
  VISIBILITY_CHANGED = 'visibility_changed',
  ACTIVE_SEGMENT_CHANGED = 'active_segment_changed',
}

/**
 * Segmentation event data
 */
export interface SegmentationEvent {
  type: SegmentationEventType;
  segmentationId: string;
  segmentIndex?: number;
  timestamp: Date;
  data?: Record<string, unknown>;
}

/**
 * Validation result for segmentation operations
 */
export interface SegmentationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: string[];
}

/**
 * Performance metrics for segmentation operations
 */
export interface SegmentationPerformanceMetrics extends Record<string, unknown> {
  operationType: string;
  duration: number;
  memoryUsage: number;
  voxelsProcessed: number;
  timestamp: Date;
}
