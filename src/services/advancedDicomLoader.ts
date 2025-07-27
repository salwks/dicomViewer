/**
 * Advanced DICOM Loader - Entry Point
 *
 * This file now serves as the main entry point for the advanced DICOM loader,
 * re-exporting the core functionality from the modular implementation.
 *
 * The original monolithic file has been split into:
 * - constants/sopClasses.ts - SOP class definitions
 * - config/loaderConfig.ts - Configuration interfaces and defaults
 * - core/advancedLoader.ts - Main loader implementation
 */

// Re-export core functionality
export { AdvancedDICOMLoader } from './dicom/core/advancedLoader';

// Re-export configuration types and utilities
export type {
  DICOMLoaderConfig,
  LoadingProgress,
  VolumeLoadingOptions,
} from './dicom/config/loaderConfig';

export {
  DEFAULT_DICOM_LOADER_CONFIG,
  ConfigValidator,
} from './dicom/config/loaderConfig';

// Re-export constants
export {
  SUPPORTED_SOP_CLASSES,
  SOP_CLASS_CATEGORIES,
  ALL_SUPPORTED_SOP_CLASSES,
  isSupportedSOPClass,
  getSOPClassCategory,
} from './dicom/constants/sopClasses';

// Re-export the main loader instance for backward compatibility
export { advancedDicomLoader } from './dicom/index';
