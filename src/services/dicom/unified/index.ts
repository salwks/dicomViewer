/**
 * Unified DICOM Services
 *
 * Consolidated exports for the unified DICOM loader system
 */

export { UnifiedDICOMLoader, unifiedDicomLoader } from './UnifiedDICOMLoader';
export type {
  UnifiedDicomMetadata,
  UnifiedDicomFile,
  DicomSeries,
  LoadingProgress,
} from './UnifiedDICOMLoader';

// Re-export commonly used types for convenience
export type {
  DICOMLoaderConfig,
  VolumeLoadingOptions,
} from '../config/loaderConfig';

export type {
  DICOMMetadata,
  DICOMTypes,
} from '../interfaces/DICOMTypes';
