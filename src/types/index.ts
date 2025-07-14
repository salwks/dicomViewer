import { Types } from '@cornerstonejs/core';

// Fix for TS7053: Proper annotation typing with index signature
export interface AnnotationData {
  annotationUID: string;
  toolName: string;
  data: {
    handles?: {
      points?: Types.Point3[];
      activeHandleIndex?: number;
      textBox?: {
        hasMoved: boolean;
        worldPosition: Types.Point3;
        worldBoundingBox?: {
          topLeft: Types.Point3;
          topRight: Types.Point3;
          bottomLeft: Types.Point3;
          bottomRight: Types.Point3;
        };
      };
      [key: string]: any;
    };
    label?: string;
    text?: string;
    cachedStats?: {
      [key: string]: any;
    };
    [key: string]: any;
  };
  metadata: {
    toolName: string;
    viewportId?: string;
    FrameOfReferenceUID: string;
    referencedImageId?: string;
    [key: string]: any;
  };
  isLocked?: boolean;
  isVisible?: boolean;
  highlighted?: boolean;
  invalidated?: boolean;
  [key: string]: any; // Index signature to fix TS7053
}

// Viewport configuration types
export interface ViewportConfig {
  viewportId: string;
  type: 'stack' | 'volume' | 'video';
  element: HTMLDivElement;
  defaultOptions?: {
    orientation?: any; // Using any to avoid OrientationAxis import issue
    background?: Types.RGB;
  };
}

// Tool configuration types
export interface ToolConfig {
  toolName: string;
  configuration?: {
    [key: string]: any;
  };
}

export interface ToolGroupConfig {
  toolGroupId: string;
  tools: ToolConfig[];
  viewportIds: string[];
}

// Series and image types
export interface SeriesInfo {
  seriesInstanceUID: string;
  seriesNumber: string;
  seriesDescription: string;
  modality: string;
  imageIds: string[];
  numberOfImages: number;
  studyInstanceUID: string;
  patientInfo?: {
    patientName?: string;
    patientId?: string;
    patientBirthDate?: string;
    patientSex?: string;
  };
}

export interface ImageInfo {
  imageId: string;
  instanceNumber: number;
  sopInstanceUID: string;
  rows: number;
  columns: number;
  pixelSpacing?: [number, number];
  sliceThickness?: number;
  sliceLocation?: number;
}

// Layout types
export type LayoutType = '1x1' | '1x2' | '2x1' | '2x2' | '3x3' | '4x4';

export interface LayoutConfig {
  rows: number;
  columns: number;
  viewports: ViewportConfig[];
}

// Window level types
export interface WindowLevelConfig {
  windowCenter: number;
  windowWidth: number;
  presetName?: string;
}

export interface WindowLevelPreset {
  name: string;
  windowCenter: number;
  windowWidth: number;
  description?: string;
}

// Annotation store state interface to fix type errors
export interface AnnotationState {
  annotations: {
    [frameOfReferenceUID: string]: {
      [toolName: string]: AnnotationData[];
    };
  };
  managers: {
    [managerId: string]: any;
  };
}

// Event types
export interface AnnotationEvent {
  type: string;
  detail: {
    annotation?: AnnotationData;
    annotationUID?: string;
    added?: AnnotationData[];
    removed?: AnnotationData[];
    [key: string]: any;
  };
}

// Utility types for strict typing
export type RequiredAnnotationData = Required<Pick<AnnotationData, 'annotationUID' | 'toolName' | 'data' | 'metadata'>>;

// Helper type for creating annotations with required fields
export type CreateAnnotationData = Omit<AnnotationData, 'annotationUID'> & {
  annotationUID?: string;
};

// State management types for Zustand store
export interface DicomViewerState {
  // Viewport state
  viewports: Map<string, ViewportConfig>;
  activeViewportId: string | null;
  layoutType: LayoutType;
  viewportConfigs: Map<string, any>;
  
  // Series state
  loadedSeries: SeriesInfo[];
  currentSeries: SeriesInfo | null;
  currentImageIndex: number;
  
  // Tool state
  activeTool: string | null;
  toolGroups: Map<string, ToolGroupConfig>;
  
  // Annotation state
  annotations: AnnotationData[];
  selectedAnnotationUID: string | null;
  
  
  // Window level state
  windowLevelPresets: WindowLevelPreset[];
  currentWindowLevel: WindowLevelConfig | null;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  sidebarOpen: boolean;
  
  // Actions
  setActiveViewport: (viewportId: string) => void;
  setLayout: (layout: LayoutType) => void;
  loadSeries: (series: SeriesInfo) => void;
  setActiveTool: (toolName: string) => void;
  activateToolInViewport: (toolName: string, toolGroupRef?: any) => boolean;
  addAnnotation: (annotation: RequiredAnnotationData) => void;
  updateAnnotation: (annotationUID: string, updates: Partial<AnnotationData>) => void;
  updateAnnotationLabel: (annotationUID: string, newLabel: string) => void;
  removeAnnotation: (annotationUID: string) => void;
  setWindowLevel: (config: WindowLevelConfig) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  toggleSidebar: () => void;
  clearAllAnnotations: () => void;
  saveAnnotations: () => void;
  loadAnnotations: () => void;
}