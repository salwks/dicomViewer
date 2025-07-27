/**
 * Services Barrel Export
 *
 * Comprehensive export system for all medical imaging services.
 * Provides clean imports, tree-shaking support, and logical grouping.
 */

// ===== Core Services =====
export { CornerstoneService } from './cornerstoneService';
export { ErrorManager, ErrorSeverity, RecoveryStrategy } from './errorManager';
export { PerformanceOptimizer } from './performanceOptimizer';
export { UndoRedoManager } from './undoRedoManager';

// ===== Performance Services =====
export { PerformanceManager, performanceManager } from './performanceManager';
export { ProgressiveImageLoader, progressiveImageLoader } from './progressiveImageLoader';
export { IntelligentCache, intelligentCache } from './intelligentCache';
export { MemoryManager, memoryManager } from './memoryManager';
export { WebWorkerManager, webWorkerManager } from './webWorkerManager';

// ===== DICOM Services =====
export * from './dicom';
export { AdvancedDICOMLoader } from './advancedDicomLoader';
export { MetadataManager } from './metadataManager';
export { SOPClassHandler } from './sopClassHandler';
export { WADOProtocolHandler } from './wadoProtocolHandler';
export { ProgressiveLoader } from './progressiveLoader';

// ===== Measurement Services =====
export * from './measurement';
export { MeasurementCalculator } from './measurementCalculator';
export { MeasurementManager } from './measurementManager';

// ===== Segmentation Services =====
export * from './segmentation';

// ===== Annotation Services =====
export { AnnotationImportService, annotationImportService } from './annotationImporter';
export { AnnotationPersistenceService, annotationPersistenceService } from './annotationPersistence';
export { AnnotationPersistenceManager } from './annotationPersistenceManager';

// ===== Export Services =====
export { DicomSRExporter } from './dicomSRExporter';
export { PDFExportService, pdfExportService } from './pdfExporter';

// ===== Persistence Services =====
export { ViewportPersistenceService } from './viewportPersistence';

// ===== Import services for bundles =====
import { CornerstoneService } from './cornerstoneService';
import { ErrorManager } from './errorManager';
import { PerformanceOptimizer } from './performanceOptimizer';
import { performanceManager } from './performanceManager';
import { intelligentCache } from './intelligentCache';
import { memoryManager } from './memoryManager';
import { AdvancedDICOMLoader } from './advancedDicomLoader';
import { MetadataManager } from './metadataManager';
import { SOPClassHandler } from './sopClassHandler';
import { WADOProtocolHandler } from './wadoProtocolHandler';
import { ProgressiveLoader } from './progressiveLoader';
import { AnnotationImportService } from './annotationImporter';
import { AnnotationPersistenceService } from './annotationPersistence';
import { AnnotationPersistenceManager } from './annotationPersistenceManager';
import { DicomSRExporter } from './dicomSRExporter';
import { pdfExportService } from './pdfExporter';
import { ViewportPersistenceService } from './viewportPersistence';

// ===== Service Bundles for Common Use Cases =====

/**
 * Essential services for basic medical imaging applications
 */
export const essentialServices = {
  CornerstoneService,
  ErrorManager,
  PerformanceOptimizer,
} as const;

/**
 * Performance optimization bundle
 */
export const performanceServiceBundle = {
  performanceManager,
  intelligentCache,
  memoryManager,
} as const;

/**
 * Complete DICOM handling bundle
 */
export const dicomServiceBundle = {
  AdvancedDICOMLoader,
  MetadataManager,
  SOPClassHandler,
  WADOProtocolHandler,
  ProgressiveLoader,
} as const;

/**
 * Complete annotation workflow bundle
 */
export const annotationServiceBundle = {
  AnnotationImportService,
  AnnotationPersistenceService,
  AnnotationPersistenceManager,
} as const;

/**
 * Export and persistence bundle
 */
export const exportServiceBundle = {
  DicomSRExporter,
  pdfExportService,
  ViewportPersistenceService,
} as const;

// ===== Service Information and Utilities =====

/**
 * Get information about available services
 */
export function getServiceInfo() {
  return {
    core: ['CornerstoneService', 'ErrorManager', 'PerformanceOptimizer', 'UndoRedoManager'],
    performance: ['PerformanceManager', 'ProgressiveImageLoader', 'IntelligentCache', 'MemoryManager', 'WebWorkerManager'],
    dicom: ['AdvancedDICOMLoader', 'MetadataManager', 'SOPClassHandler', 'WADOProtocolHandler', 'ProgressiveLoader'],
    measurement: ['MeasurementOrchestrator', 'MeasurementCalculator', 'MeasurementManager'],
    segmentation: ['SegmentationManager', 'SegmentationToolkit'],
    annotation: ['AnnotationImporter', 'AnnotationPersistence', 'AnnotationPersistenceManager'],
    export: ['DICOMSRExporter', 'PDFExporter'],
    persistence: ['ViewportPersistence'],
  };
}

/**
 * Service dependency information
 */
export const serviceDependencies = {
  CornerstoneService: [],
  ErrorManager: [],
  PerformanceOptimizer: ['ErrorManager'],
  PerformanceManager: [],
  ProgressiveImageLoader: ['PerformanceManager'],
  IntelligentCache: ['PerformanceManager'],
  MemoryManager: ['PerformanceManager', 'IntelligentCache'],
  WebWorkerManager: ['PerformanceManager'],
  AdvancedDICOMLoader: ['ErrorManager', 'MetadataManager', 'SOPClassHandler'],
  MeasurementManager: ['CornerstoneService', 'ErrorManager'],
  SegmentationManager: ['CornerstoneService', 'ErrorManager'],
  AnnotationPersistenceManager: ['CornerstoneService', 'ErrorManager'],
} as const;

// ===== Legacy Exports (with deprecation warnings) =====

// Note: These maintain backward compatibility but should be migrated to new APIs
export { MeasurementCalculator as LegacyMeasurementCalculator } from './measurementCalculator';

// ===== Type Re-exports =====

// Export commonly used types from all services
export type {
  Point2,
  Point3,
  MeasurementMetadata,
  ICalculator,
} from './measurement';

export type {
  Segmentation,
  SegmentationFormat,
  BrushStroke,
} from './segmentation';

export type {
  DICOMLoaderConfig,
  LoadingProgress,
  VolumeLoadingOptions,
} from './dicom';

// ===== Module Information =====

/**
 * Get module version and build information
 */
export function getModuleInfo() {
  return {
    name: 'Medical Imaging Services',
    version: '1.0.0',
    build: new Date().toISOString(),
    services: Object.keys(getServiceInfo()).length,
  };
}
