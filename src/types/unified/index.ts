/**
 * Unified Type Definitions
 *
 * Consolidated and optimized type system for the medical imaging application
 * Removes redundancy and provides better type safety
 */

// ========== Core Application Types ==========

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

// ========== DICOM Types (Unified) ==========

export interface DICOMIdentifiers {
  studyInstanceUID: string;
  seriesInstanceUID: string;
  sopInstanceUID: string;
}

export interface DICOMMetadata extends DICOMIdentifiers {
  // Patient Information
  patientID?: string;
  patientName?: string;
  patientBirthDate?: string;
  patientSex?: string;

  // Study Information
  studyDate?: string;
  studyTime?: string;
  studyDescription?: string;
  accessionNumber?: string;

  // Series Information
  seriesNumber?: number;
  seriesDate?: string;
  seriesTime?: string;
  seriesDescription?: string;
  modality?: string;
  bodyPartExamined?: string;

  // Instance Information
  instanceNumber?: number;
  acquisitionNumber?: number;
  contentDate?: string;
  contentTime?: string;

  // Image Properties
  rows?: number;
  columns?: number;
  numberOfFrames?: number;
  pixelSpacing?: [number, number];
  sliceThickness?: number;
  spacingBetweenSlices?: number;
  imageOrientationPatient?: number[];
  imagePositionPatient?: number[];

  // Display Properties
  windowCenter?: number;
  windowWidth?: number;
  rescaleSlope?: number;
  rescaleIntercept?: number;

  // Technical Properties
  bitsAllocated?: number;
  bitsStored?: number;
  highBit?: number;
  pixelRepresentation?: number;
  photometricInterpretation?: string;
  samplesPerPixel?: number;
  planarConfiguration?: number;

  // Transfer Syntax
  transferSyntaxUID?: string;
  sopClassUID?: string;

  // Calculated Properties
  pixelArea?: number;
  aspectRatio?: number;
  estimatedSizeBytes?: number;
}

export interface DICOMSeries extends DICOMIdentifiers {
  metadata: DICOMMetadata;
  imageIds: string[];
  instanceCount: number;
  thumbnailUrl?: string;
}

export interface DICOMStudy {
  studyInstanceUID: string;
  metadata: DICOMMetadata;
  series: DICOMSeries[];
  seriesCount: number;
}

// ========== Geometry Types ==========

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Vector3D extends Point3D {}

export interface BoundingBox2D {
  topLeft: Point2D;
  bottomRight: Point2D;
  width: number;
  height: number;
}

export interface BoundingBox3D {
  min: Point3D;
  max: Point3D;
  dimensions: Vector3D;
}

// ========== Annotation Types (Unified) ==========

export enum AnnotationType {
  POINT = 'point',
  LINE = 'line',
  RECTANGLE = 'rectangle',
  ELLIPSE = 'ellipse',
  POLYGON = 'polygon',
  FREEHAND = 'freehand',
  TEXT = 'text',
  ARROW = 'arrow',
  RULER = 'ruler',
  ANGLE = 'angle',
  AREA = 'area',
  VOLUME = 'volume',
}

export enum AnnotationState {
  CREATING = 'creating',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SELECTED = 'selected',
  EDITING = 'editing',
  LOCKED = 'locked',
  HIDDEN = 'hidden',
}

export interface AnnotationColor {
  rgb: [number, number, number];
  hex: string;
  rgba?: [number, number, number, number];
  hsl?: [number, number, number];
}

export interface AnnotationStyle {
  id: string;
  name: string;
  description?: string;

  // Line properties
  lineColor: AnnotationColor;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';

  // Fill properties
  fillColor?: AnnotationColor;
  fillOpacity?: number;

  // Text properties
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  textColor?: AnnotationColor;

  // Visual effects
  opacity: number;
  shadow?: {
    color: AnnotationColor;
    blur: number;
    offset: Point2D;
  };

  // Behavior
  selectable: boolean;
  editable: boolean;
  resizable: boolean;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  version: string;
  tags: string[];
}

export interface AnnotationData {
  id: string;
  type: AnnotationType;
  state: AnnotationState;

  // Geometry
  points: Point3D[];
  boundingBox?: BoundingBox3D;

  // Visual
  style: AnnotationStyle;
  zIndex: number;
  visible: boolean;

  // Content
  text?: string;
  description?: string;

  // Context
  viewportId: string;
  imageId?: string;
  seriesInstanceUID?: string;
  studyInstanceUID?: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tags: string[];

  // Measurements (if applicable)
  measurements?: MeasurementResult[];
}

// ========== Measurement Types (Unified) ==========

export enum MeasurementType {
  LENGTH = 'length',
  AREA = 'area',
  VOLUME = 'volume',
  ANGLE = 'angle',
  DENSITY = 'density',
  DISTANCE = 'distance',
  PERIMETER = 'perimeter',
  DIAMETER = 'diameter',
  RADIUS = 'radius',
}

export enum MeasurementUnit {
  // Length units
  MM = 'mm',
  CM = 'cm',
  M = 'm',
  PIXEL = 'pixel',

  // Area units
  MM2 = 'mm²',
  CM2 = 'cm²',

  // Volume units
  MM3 = 'mm³',
  CM3 = 'cm³',
  ML = 'ml',
  L = 'l',

  // Angle units
  DEGREE = '°',
  RADIAN = 'rad',

  // Density units
  HU = 'HU',
  SUV = 'SUV',
}

export interface MeasurementResult {
  id: string;
  type: MeasurementType;
  value: number;
  unit: MeasurementUnit;

  // Precision and validation
  precision: number;
  confidence: number;
  validationStatus: 'valid' | 'warning' | 'error';

  // Context
  annotationId?: string;
  imageId?: string;
  pixelSpacing?: [number, number];
  sliceThickness?: number;

  // Statistical data (for ROI measurements)
  statistics?: {
    mean: number;
    median: number;
    standardDeviation: number;
    minimum: number;
    maximum: number;
    count: number;
    percentiles: {
      p25: number;
      p75: number;
      p90: number;
      p95: number;
    };
  };

  // Metadata
  createdAt: Date;
  calculatedBy: string;
  algorithm?: string;
  version: string;
}

// ========== Segmentation Types (Unified) ==========

export enum SegmentationType {
  MANUAL = 'manual',
  AUTOMATIC = 'automatic',
  SEMI_AUTOMATIC = 'semi_automatic',
  AI_ASSISTED = 'ai_assisted',
}

export enum SegmentationFormat {
  LABELMAP = 'labelmap',
  CONTOUR = 'contour',
  SURFACE = 'surface',
  DICOM_SEG = 'dicom_seg',
  NIFTI = 'nifti',
  STL = 'stl',
}

export interface SegmentationData {
  id: string;
  name: string;
  description?: string;
  type: SegmentationType;
  format: SegmentationFormat;

  // Data
  data: ArrayBuffer | Float32Array | Uint8Array | Uint16Array;
  dimensions: [number, number, number];
  spacing: [number, number, number];
  origin: [number, number, number];
  direction: number[];

  // Segments
  segments: Array<{
    id: number;
    name: string;
    color: AnnotationColor;
    opacity: number;
    visible: boolean;
    statistics?: {
      volume: number;
      surfaceArea: number;
      boundingBox: BoundingBox3D;
    };
  }>;

  // Context
  seriesInstanceUID: string;
  studyInstanceUID: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  algorithm?: string;
  version: string;
  tags: string[];
}

// ========== Error Types (Unified) ==========

export enum ErrorCategory {
  DICOM_PARSING = 'dicom_parsing',
  RENDERING = 'rendering',
  NETWORK = 'network',
  SECURITY = 'security',
  USER_INPUT = 'user_input',
  AUTHENTICATION = 'authentication',
  MEMORY = 'memory',
  VALIDATION = 'validation',
  CONFIGURATION = 'configuration',
  CORRUPTION = 'corruption',
  PERFORMANCE = 'performance',
  LOADING = 'loading',
  ANNOTATION = 'annotation',
  MEASUREMENT = 'measurement',
  SEGMENTATION = 'segmentation',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface MedicalImagingError extends Error {
  code: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context?: {
    // DICOM context
    studyInstanceUID?: string;
    seriesInstanceUID?: string;
    sopInstanceUID?: string;
    sopClassUID?: string;

    // Application context
    viewportId?: string;
    toolName?: string;
    imageId?: string;
    volumeId?: string;
    annotationId?: string;

    // Technical context
    imageCount?: number;
    sizeInBytes?: number;
    stage?: string;
    timestamp?: Date;
    stackTrace?: string;
    additionalData?: Record<string, unknown>;
  };

  // Recovery information
  recoverable: boolean;
  recoveryActions?: string[];
  userMessage?: string;
}

// ========== API Types (Unified) ==========

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    category?: ErrorCategory;
    severity?: ErrorSeverity;
  };
  metadata?: {
    timestamp: string;
    requestId: string;
    version: string;
    processingTime?: number;
  };
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// ========== Component Types (Unified) ==========

export interface BaseComponentProps {
  className?: string;
  style?: React.CSSProperties;
  'data-testid'?: string;
  disabled?: boolean;
  loading?: boolean;
}

export interface ViewportProps extends BaseComponentProps {
  viewportId: string;
  element?: HTMLElement;
  width: number;
  height: number;
}

// ========== Performance Types ==========

export interface PerformanceMetrics {
  // Rendering performance
  fps: number;
  frameTime: number;
  renderTime: number;

  // Memory usage
  memoryUsed: number;
  memoryTotal: number;
  memoryPercentage: number;

  // Loading performance
  imageLoadTime: number;
  volumeLoadTime: number;
  cacheHitRate: number;

  // User interaction
  responseTime: number;
  interactionLatency: number;

  // Timestamps
  timestamp: Date;
  sessionDuration: number;
}

// ========== Configuration Types ==========

export interface ViewerConfiguration {
  // Viewport settings
  defaultViewportType: 'stack' | 'volume' | 'orthographic';
  enableWebGL: boolean;
  maxTextureSize: number;

  // Rendering settings
  useWebWorkers: boolean;
  workerThreads: number;
  enableProgressiveLoading: boolean;

  // Memory settings
  maxCacheSize: number;
  autoMemoryManagement: boolean;

  // Feature flags
  features: {
    annotations: boolean;
    measurements: boolean;
    segmentation: boolean;
    aiTools: boolean;
    collaboration: boolean;
  };

  // Performance settings
  performance: {
    enableVSync: boolean;
    targetFPS: number;
    qualityLevel: 'low' | 'medium' | 'high' | 'ultra';
  };
}

// ========== Re-exports for Compatibility ==========

// Legacy type aliases for backward compatibility
export type Point2 = Point2D;
export type Point3 = Point3D;
export type PixelSpacing = [number, number];
export type ImageData = ArrayBuffer | Float32Array | Uint8Array | Uint16Array;

// Re-export Cornerstone3D types for convenience
export type {
  Types as CornerstoneTypes,
  Enums as CornerstoneEnums,
} from '@cornerstonejs/core';

export type {
  Types as CornerstoneToolsTypes,
  Enums as CornerstoneToolsEnums,
} from '@cornerstonejs/tools';
