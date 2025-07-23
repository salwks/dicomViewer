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
  numberOfInstances: number;
  imageIds: string[];
  metadata: DICOMMetadata[];
}

export interface DICOMStudy {
  studyInstanceUID: string;
  studyDescription?: string;
  studyDate?: string;
  patientName?: string;
  patientID?: string;
  series: DICOMSeries[];
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
      [key: string]: any;
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
  callback?: (params: { volumeActor: any; volumeId: string }) => void;
}

export interface ToolConfig {
  toolName: string;
  bindings: Array<{
    mouseButton: number;
    modifierKey?: 'ctrl' | 'alt' | 'shift';
  }>;
  mode: 'ACTIVE' | 'PASSIVE' | 'ENABLED' | 'DISABLED';
  configuration?: {
    [key: string]: any;
  };
}
