/**
 * DICOM Loader Module Types
 */

export interface DicomFile {
  file: File;
  imageId: string;
  instanceNumber?: number;
  metadata?: DicomMetadata;
}

export interface DicomMetadata {
  studyInstanceUID: string;
  seriesInstanceUID: string;
  sopInstanceUID: string;
  studyDescription?: string;
  seriesDescription?: string;
  modality?: string;
  patientName?: string;
  patientId?: string;
  studyDate?: string;
  rows?: number;
  cols?: number;
  windowCenter?: number;
  windowWidth?: number;
}

export interface DicomSeries {
  seriesInstanceUID: string;
  studyInstanceUID: string;
  seriesDescription?: string;
  modality?: string;
  seriesNumber?: number;
  imageIds: string[];
  files: DicomFile[];
}

export interface DicomStudy {
  studyInstanceUID: string;
  studyDescription?: string;
  studyDate?: string;
  patientName?: string;
  patientId?: string;
  series: Map<string, DicomSeries>;
}

export interface DicomLoaderConfig {
  maxConcurrentLoads?: number;
  enableCaching?: boolean;
  wadouriRoot?: string;
}

export interface DicomLoaderEvents {
  'file:loaded': { file: DicomFile; progress: number };
  'series:loaded': { series: DicomSeries };
  'study:loaded': { study: DicomStudy };
  'load:error': { error: Error; file?: File };
  'load:progress': { loaded: number; total: number };
}