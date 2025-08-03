/**
 * DICOM Data Types
 *
 * Based on Cornerstone3D Context7 documentation
 * Reference: /cornerstonejs/cornerstone3d - 443 code examples
 */

export interface DICOMMetadata {
  imageId?: string; // Image identifier for Cornerstone3D
  StudyInstanceUID: string;
  SeriesInstanceUID: string;
  SOPInstanceUID: string;
  SOPClassUID?: string;
  PatientID?: string;
  PatientName?: string;
  StudyDate?: string;
  Modality?: string;
  SeriesDescription?: string;
  NumberOfFrames?: number;
  Rows?: number;
  Columns?: number;
  PixelSpacing?: [number, number];
  SliceThickness?: number;
  ImageOrientationPatient?: number[];
  ImagePositionPatient?: number[];
  RescaleSlope?: number;
  RescaleIntercept?: number;
  WindowCenter?: number;
  WindowWidth?: number;
  BitsAllocated?: number;
  BitsStored?: number;
  HighBit?: number;
  PixelRepresentation?: number;
  PhotometricInterpretation?: string;
  SamplesPerPixel?: number;
  TransferSyntaxUID?: string;

  // Calculated fields
  PixelArea?: number;
  AspectRatio?: number;
  EstimatedSizeBytes?: number;
}

export interface DICOMSeries {
  seriesInstanceUID: string;
  seriesDescription: string;
  modality: string;
  seriesNumber?: number;
  numberOfInstances: number;
  imageIds: string[];
  metadata: DICOMMetadata[];
  // Enhanced multi-study management
  studyInstanceUID: string; // Parent study reference
  thumbnailUrl?: string; // Series thumbnail
  seriesDate?: string;
  seriesTime?: string;
  bodyPartExamined?: string;
  protocolName?: string;
  acquisitionDate?: string;
  acquisitionTime?: string;
  // Viewport assignment tracking
  assignedViewport?: string; // Currently assigned viewport ID
  lastViewedAt?: Date; // Last time this series was viewed
  viewCount?: number; // Number of times viewed in session
  isLoaded?: boolean; // Whether series data is loaded
  loadingProgress?: number; // Loading progress 0-100
}

export interface DICOMStudy {
  studyInstanceUID: string;
  studyDescription?: string;
  studyDate?: string;
  studyTime?: string;
  patientName?: string;
  patientID?: string;
  patientAge?: string;
  patientSex?: string;
  accessionNumber?: string;
  studyID?: string;
  institutionName?: string;
  referringPhysicianName?: string;
  series: DICOMSeries[];
  // Enhanced multi-study management
  color?: string; // Color coding for multi-study visualization
  priority?: number; // Display priority for studies
  isActive?: boolean; // Currently selected/active study
  loadingState?: 'idle' | 'loading' | 'loaded' | 'error';
  thumbnailUrl?: string; // Representative thumbnail for the study
  numberOfSeries?: number; // Cached series count
  totalImages?: number; // Cached total image count across all series
}

export interface ViewportDisplaySettings {
  windowCenter: number;
  windowWidth: number;
  zoom: number;
  pan: [number, number];
  rotation: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  interpolationType: 'LINEAR' | 'NEAREST';
}

export interface AnnotationData {
  id: string;
  toolName: string;
  data: {
    handles: {
      points: Array<[number, number, number]>;
      textBox?: {
        hasMoved: boolean;
        worldPosition: [number, number, number];
      };
    };
    cachedStats?: {
      [key: string]: number | string | boolean | undefined;
    };
  };
  metadata: {
    viewPlaneNormal: [number, number, number];
    viewUp: [number, number, number];
    FrameOfReferenceUID: string;
    referencedImageId?: string;
  };
}

export interface MeasurementResult {
  length?: number;
  area?: number;
  volume?: number;
  meanValue?: number;
  minValue?: number;
  maxValue?: number;
  stdDev?: number;
  unit: string;
}

export interface SegmentationData {
  segmentationId: string;
  type: 'LABELMAP' | 'CONTOUR';
  data: {
    volumeId: string;
  };
  config?: {
    renderInactiveSegmentations: boolean;
    representations: {
      LABELMAP: {
        renderOutline: boolean;
        outlineWidthActive: number;
        outlineWidthInactive: number;
      };
    };
  };
}

export interface RenderingEngineConfig {
  id: string;
  gpuTier?: number;
}

export interface ViewportConfig {
  viewportId: string;
  type: 'STACK' | 'ORTHOGRAPHIC' | 'VOLUME_3D' | 'VIDEO';
  element: HTMLElement;
  defaultOptions?: {
    orientation?: 'AXIAL' | 'SAGITTAL' | 'CORONAL';
    background?: [number, number, number];
  };
}

export interface VolumeConfig {
  volumeId: string;
  imageIds: string[];
  blendMode?: 'MIP' | 'MINIP' | 'AVERAGE';
  callback?: (params: { volumeActor: unknown; volumeId: string }) => void;
}

export interface ToolConfig {
  toolName: string;
  bindings: Array<{
    mouseButton: number;
    modifierKey?: 'ctrl' | 'alt' | 'shift';
  }>;
  mode: 'ACTIVE' | 'PASSIVE' | 'ENABLED' | 'DISABLED';
  configuration?: {
    [key: string]: unknown;
  };
}

// Enhanced Series Management Types for Multi-Study Support
export interface SeriesAssignment {
  seriesInstanceUID: string;
  viewportId: string;
  assignedAt: Date;
  studyInstanceUID: string;
}

export interface StudyColorScheme {
  studyInstanceUID: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
}

export interface MultiStudySession {
  sessionId: string;
  studies: DICOMStudy[];
  activeStudyId: string | null;
  viewportAssignments: Map<string, SeriesAssignment>;
  colorSchemes: Map<string, StudyColorScheme>;
  loadedSeries: Set<string>;
  createdAt: Date;
  lastActivity: Date;
}

export interface SeriesManagementState {
  studies: DICOMStudy[];
  selectedStudy: string | null;
  selectedSeries: string | null;
  viewportAssignments: Record<string, string>; // viewport -> seriesInstanceUID
  draggedSeries: string | null;
  loadingStates: Record<string, boolean>;
  colorMappings: Record<string, string>; // studyUID -> color
  filterModality: string;
  sortBy: 'seriesNumber' | 'seriesDescription' | 'modality' | 'studyDate';
  viewMode: 'grid' | 'list' | 'tree';
  showThumbnails: boolean;
  groupByStudy: boolean;
}

export interface SeriesDropData {
  seriesInstanceUID: string;
  studyInstanceUID: string;
  modality: string;
  seriesDescription: string;
  numberOfInstances: number;
  sourceViewport?: string;
  dragStartTime: number;
}

export interface ViewportDropZone {
  viewportId: string;
  isActive: boolean;
  isValidTarget: boolean;
  position: { x: number; y: number; width: number; height: number };
}

// Viewport Synchronization Types
export type SyncType = 'windowLevel' | 'zoom' | 'pan' | 'scroll' | 'crosshairs' | 'orientation';

export interface SynchronizationSettings {
  windowLevel: boolean;
  zoom: boolean;
  pan: boolean;
  scroll: boolean;
  crosshairs: boolean;
  orientation: boolean;
  globalSync: boolean; // Sync all viewports or just selected ones
}

export interface ViewportSyncState {
  viewportId: string;
  isSource: boolean; // Whether this viewport initiated the sync
  windowCenter: number;
  windowWidth: number;
  zoom: number;
  pan: [number, number];
  scrollIndex: number;
  orientation?: 'AXIAL' | 'SAGITTAL' | 'CORONAL';
  lastSyncTime: number;
}

export interface CrossReferenceSettings {
  enabled: boolean;
  color: string;
  thickness: number;
  dashLength: number;
  gapLength: number;
  opacity: number;
}

export interface SynchronizationEvent {
  type: SyncType;
  sourceViewportId: string;
  targetViewportIds: string[];
  data: {
    windowCenter?: number;
    windowWidth?: number;
    zoom?: number;
    pan?: [number, number];
    scrollIndex?: number;
    orientation?: string;
  };
  timestamp: number;
}
