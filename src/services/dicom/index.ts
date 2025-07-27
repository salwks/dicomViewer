/**
 * DICOM Service Module
 *
 * This module provides comprehensive DICOM handling capabilities including
 * image loading, metadata extraction, and protocol handling.
 *
 * Now includes the new modular advanced DICOM loader implementation.
 */

// Legacy exports for backward compatibility
export * from './interfaces/DICOMTypes';

// Legacy loaders
export { DICOMImageLoader, createDICOMImageLoader } from './loaders/DICOMImageLoader';
export { DICOMVolumeLoader, createDICOMVolumeLoader } from './loaders/DICOMVolumeLoader';
export { WADOLoader, createWADOLoader } from './loaders/WADOLoader';

// Legacy processors
export { MetadataExtractor, createMetadataExtractor } from './processors/MetadataExtractor';
export { SOPClassProcessor, createSOPClassProcessor } from './processors/SOPClassProcessor';

// Legacy orchestrator (commented out - not yet implemented)
// export {
//   DICOMLoaderOrchestrator,
//   createDICOMLoaderOrchestrator,
//   dicomLoaderOrchestrator,
// } from './DICOMLoaderOrchestrator';

// New modular components
export { AdvancedDICOMLoader } from './core/advancedLoader';
export type {
  DICOMLoaderConfig,
  LoadingProgress,
  VolumeLoadingOptions,
} from './config/loaderConfig';
export {
  DEFAULT_DICOM_LOADER_CONFIG,
  ConfigValidator,
} from './config/loaderConfig';
export {
  SUPPORTED_SOP_CLASSES,
  SOP_CLASS_CATEGORIES,
  ALL_SUPPORTED_SOP_CLASSES,
  isSupportedSOPClass,
  getSOPClassCategory,
} from './constants/sopClasses';

// Create singleton instance for backward compatibility
import { AdvancedDICOMLoader } from './core/advancedLoader';
import { DEFAULT_DICOM_LOADER_CONFIG } from './config/loaderConfig';

export const advancedDicomLoader = new AdvancedDICOMLoader(DEFAULT_DICOM_LOADER_CONFIG);

/**
 * 간편한 팩토리 함수 - 기본 설정으로 전체 시스템 초기화
 */
export function createDICOMSystem(config?: any) {
  return new AdvancedDICOMLoader(config);
}
