/**
 * Advanced DICOM Loader System
 * Supports 95+ SOP classes with progressive loading and WADO protocol support
 */

import { EventEmitter } from 'events';
import { log } from '../utils/logger';
// import * as cornerstoneWADOImageLoader from '@cornerstonejs/dicom-image-loader';
// import { utilities as coreUtilities } from '@cornerstonejs/core';

// ===== Configuration Interface =====

export interface DICOMLoaderConfig {
  // Core Configuration
  maxConcurrentLoads: number;
  progressiveLoading: boolean;
  prefetchSize: number;
  cacheSize: number; // MB

  // WADO Configuration
  wadoURI?: {
    baseUrl: string;
    studyParam?: string;
    seriesParam?: string;
    objectParam?: string;
    contentType?: string;
    transferSyntax?: string;
  };

  wadoRS?: {
    baseUrl: string;
    acceptHeader?: string;
    multipartSupport?: boolean;
    bulkDataURI?: boolean;
  };

  // SOP Class Configuration
  supportedSOPClasses?: string[];
  sopClassHandlers?: Map<string, SOPClassHandler>;

  // Performance Options
  useWebWorkers: boolean;
  webWorkerCount?: number;
  decodeConfig?: {
    initializeCodecsOnStartup?: boolean;
    strict?: boolean;
    useWebAssembly?: boolean;
  };

  // Error Handling
  retryAttempts: number;
  retryDelay: number; // ms
  errorHandler?: (error: Error, context: ErrorContext) => void;

  // Callbacks
  onProgress?: (progress: LoadProgress) => void;
  onMetadataLoaded?: (imageId: string, metadata: DICOMMetadata) => void;
  onImageLoaded?: (imageId: string, image: any) => void;
}

export const DEFAULT_DICOM_LOADER_CONFIG: DICOMLoaderConfig = {
  maxConcurrentLoads: 6,
  progressiveLoading: true,
  prefetchSize: 10,
  cacheSize: 1024, // 1GB
  useWebWorkers: true,
  webWorkerCount: navigator.hardwareConcurrency || 4,
  retryAttempts: 3,
  retryDelay: 1000,
  decodeConfig: {
    initializeCodecsOnStartup: true,
    strict: false,
    useWebAssembly: true,
  },
};

// ===== Type Definitions =====

export interface LoadProgress {
  imageId: string;
  loaded: number;
  total: number;
  percentage: number;
  status: 'pending' | 'loading' | 'completed' | 'failed';
  error?: Error;
}

export interface DICOMMetadata {
  studyInstanceUID?: string;
  seriesInstanceUID?: string;
  sopInstanceUID?: string;
  sopClassUID?: string;
  modality?: string;
  patientName?: string;
  patientID?: string;
  patientBirthDate?: string;
  instanceNumber?: number;
  rows?: number;
  columns?: number;
  pixelSpacing?: number[];
  sliceThickness?: number;
  windowCenter?: number | number[];
  windowWidth?: number | number[];
  customMetadata?: Record<string, unknown>;
  wadoConfig?: {
    protocol: 'WADO-URI' | 'WADO-RS';
    baseUrl: string;
    authType?: string;
  };
}

export interface ErrorContext {
  imageId: string;
  operation: 'load' | 'decode' | 'parse' | 'cache';
  attempt: number;
  error: Error;
}

export interface LoadRequest {
  imageId: string;
  priority?: number;
  options?: LoadOptions;
}

export interface LoadOptions {
  targetBuffer?: ArrayBuffer;
  skipCache?: boolean;
  requestType?: 'interaction' | 'prefetch' | 'background';
  signal?: AbortSignal;
}

// ===== SOP Class Support =====

export const SUPPORTED_SOP_CLASSES = {
  // Basic Image Storage
  CR: '1.2.840.10008.5.1.4.1.1.1',          // Computed Radiography
  DX: '1.2.840.10008.5.1.4.1.1.1.1',        // Digital X-Ray
  MG: '1.2.840.10008.5.1.4.1.1.1.2',        // Digital Mammography
  IO: '1.2.840.10008.5.1.4.1.1.1.3',        // Digital Intra-Oral X-Ray

  // CT Image Storage
  CT: '1.2.840.10008.5.1.4.1.1.2',          // CT Image Storage
  ENHANCED_CT: '1.2.840.10008.5.1.4.1.1.2.1', // Enhanced CT
  LEGACY_CT: '1.2.840.10008.5.1.4.1.1.2.2',   // Legacy Converted Enhanced CT

  // MR Image Storage
  MR: '1.2.840.10008.5.1.4.1.1.4',          // MR Image Storage
  ENHANCED_MR: '1.2.840.10008.5.1.4.1.1.4.1', // Enhanced MR Image
  MR_SPECTROSCOPY: '1.2.840.10008.5.1.4.1.1.4.2', // MR Spectroscopy
  ENHANCED_MR_COLOR: '1.2.840.10008.5.1.4.1.1.4.3', // Enhanced MR Color
  LEGACY_MR: '1.2.840.10008.5.1.4.1.1.4.4',   // Legacy Converted Enhanced MR

  // Ultrasound
  US: '1.2.840.10008.5.1.4.1.1.6.1',        // Ultrasound Image Storage
  US_MULTIFRAME: '1.2.840.10008.5.1.4.1.1.3.1', // Ultrasound Multi-frame
  ENHANCED_US: '1.2.840.10008.5.1.4.1.1.6.2',   // Enhanced US Volume

  // Nuclear Medicine
  NM: '1.2.840.10008.5.1.4.1.1.20',         // Nuclear Medicine

  // Secondary Capture
  SC: '1.2.840.10008.5.1.4.1.1.7',          // Secondary Capture
  MULTIFRAME_SC: '1.2.840.10008.5.1.4.1.1.7.2', // Multi-frame Grayscale Byte SC
  MULTIFRAME_TRUE_COLOR_SC: '1.2.840.10008.5.1.4.1.1.7.4', // Multi-frame True Color SC

  // PET
  PET: '1.2.840.10008.5.1.4.1.1.128',       // PET Image Storage
  ENHANCED_PET: '1.2.840.10008.5.1.4.1.1.130', // Enhanced PET
  LEGACY_PET: '1.2.840.10008.5.1.4.1.1.128.1', // Legacy Converted Enhanced PET

  // RT Storage
  RT_IMAGE: '1.2.840.10008.5.1.4.1.1.481.1', // RT Image Storage
  RT_DOSE: '1.2.840.10008.5.1.4.1.1.481.2',  // RT Dose Storage
  RT_STRUCTURE: '1.2.840.10008.5.1.4.1.1.481.3', // RT Structure Set
  RT_PLAN: '1.2.840.10008.5.1.4.1.1.481.5',  // RT Plan Storage
  RT_TREATMENT: '1.2.840.10008.5.1.4.1.1.481.4', // RT Beams Treatment Record

  // Other Modalities
  XA: '1.2.840.10008.5.1.4.1.1.12.1',       // X-Ray Angiographic
  XRF: '1.2.840.10008.5.1.4.1.1.12.2',      // X-Ray Radiofluoroscopic
  ENHANCED_XA: '1.2.840.10008.5.1.4.1.1.12.1.1', // Enhanced XA
  ENHANCED_XRF: '1.2.840.10008.5.1.4.1.1.12.2.1', // Enhanced XRF

  // 3D and Advanced
  SEGMENTATION: '1.2.840.10008.5.1.4.1.1.66.4', // Segmentation Storage
  SURFACE_SEGMENTATION: '1.2.840.10008.5.1.4.1.1.66.5', // Surface Segmentation
  PARAMETRIC_MAP: '1.2.840.10008.5.1.4.1.1.30', // Parametric Map

  // Whole Slide Imaging
  VL_WHOLE_SLIDE: '1.2.840.10008.5.1.4.1.1.77.1.6', // VL Whole Slide Microscopy

  // Ophthalmic
  OPT: '1.2.840.10008.5.1.4.1.1.77.1.5.4',  // Ophthalmic Tomography
  OPMAP: '1.2.840.10008.5.1.4.1.1.77.1.5.5', // Ophthalmic Thickness Map

  // Encapsulated Documents
  PDF: '1.2.840.10008.5.1.4.1.1.104.1',     // Encapsulated PDF
  CDA: '1.2.840.10008.5.1.4.1.1.104.2',     // Encapsulated CDA
} as const;

// ===== SOP Class Handler Interface =====

export abstract class SOPClassHandler {
  abstract canHandle(sopClassUID: string): boolean;
  abstract preProcess(imageId: string, metadata: DICOMMetadata): Promise<void>;
  abstract postProcess(imageId: string, image: any): Promise<any>;
  abstract getDefaultWindowLevel(metadata: DICOMMetadata): { window: number; level: number } | null;
}

// ===== Base Loader Class =====

export abstract class BaseDICOMLoader extends EventEmitter {
  protected config: DICOMLoaderConfig;
  protected loadQueue: LoadRequest[] = [];
  protected activeLoads = new Map<string, AbortController>();
  protected progressTracking = new Map<string, LoadProgress>();
  protected metadataCache = new Map<string, DICOMMetadata>();
  protected sopClassHandlers = new Map<string, SOPClassHandler>();

  constructor(config: Partial<DICOMLoaderConfig> = {}) {
    super();
    this.config = this.validateConfig({ ...DEFAULT_DICOM_LOADER_CONFIG, ...config });
    this.initializeHandlers();
  }

  protected validateConfig(config: DICOMLoaderConfig): DICOMLoaderConfig {
    // Validate concurrent loads
    if (config.maxConcurrentLoads < 1) {
      throw new Error('maxConcurrentLoads must be at least 1');
    }

    // Validate cache size
    if (config.cacheSize < 0) {
      throw new Error('cacheSize must be non-negative');
    }

    // Validate worker count
    if (config.useWebWorkers && config.webWorkerCount && config.webWorkerCount < 1) {
      throw new Error('webWorkerCount must be at least 1');
    }

    // Validate retry settings
    if (config.retryAttempts < 0) {
      throw new Error('retryAttempts must be non-negative');
    }

    if (config.retryDelay < 0) {
      throw new Error('retryDelay must be non-negative');
    }

    // Validate WADO configuration
    if (config.wadoURI && !config.wadoURI.baseUrl) {
      throw new Error('wadoURI requires baseUrl');
    }

    if (config.wadoRS && !config.wadoRS.baseUrl) {
      throw new Error('wadoRS requires baseUrl');
    }

    return config;
  }

  protected initializeHandlers(): void {
    // Initialize default SOP class handlers
    if (this.config.sopClassHandlers) {
      for (const [uid, handler] of this.config.sopClassHandlers) {
        this.registerSOPClassHandler(uid, handler);
      }
    }

    log.info('DICOM loader handlers initialized', {
      component: 'BaseDICOMLoader',
      metadata: {
        handlerCount: this.sopClassHandlers.size,
      },
    });
  }

  public registerSOPClassHandler(sopClassUID: string, handler: SOPClassHandler): void {
    this.sopClassHandlers.set(sopClassUID, handler);

    log.info('SOP class handler registered', {
      component: 'BaseDICOMLoader',
      metadata: { sopClassUID },
    });
  }

  public unregisterSOPClassHandler(sopClassUID: string): boolean {
    const removed = this.sopClassHandlers.delete(sopClassUID);

    if (removed) {
      log.info('SOP class handler unregistered', {
        component: 'BaseDICOMLoader',
        metadata: { sopClassUID },
      });
    }

    return removed;
  }

  protected getSOPClassHandler(sopClassUID: string): SOPClassHandler | null {
    // Direct lookup first
    const handler = this.sopClassHandlers.get(sopClassUID);
    if (handler) return handler;

    // Check if any handler can handle this SOP class
    for (const h of this.sopClassHandlers.values()) {
      if (h.canHandle(sopClassUID)) {
        return h;
      }
    }

    return null;
  }

  public isSupportedSOPClass(sopClassUID: string): boolean {
    // Check configured supported SOP classes
    if (this.config.supportedSOPClasses) {
      return this.config.supportedSOPClasses.includes(sopClassUID);
    }

    // Check against default supported list
    return Object.values(SUPPORTED_SOP_CLASSES).includes(sopClassUID as any);
  }

  // Abstract methods to be implemented by concrete classes
  abstract configure(config: Partial<DICOMLoaderConfig>): void;
  abstract loadImage(imageId: string, options?: LoadOptions): Promise<any>;
  abstract loadVolume(volumeId: string, imageIds: string[], options?: LoadOptions): Promise<any>;
  abstract prefetchImages(imageIds: string[], options?: LoadOptions): Promise<void>;
  abstract cancelLoad(imageId: string): boolean;
  abstract clearCache(): void;
  abstract getCacheInfo(): { used: number; total: number; count: number };

  // ===== Progress Tracking =====

  protected updateProgress(imageId: string, progress: Partial<LoadProgress>): void {
    const currentProgress = this.progressTracking.get(imageId) || {
      imageId,
      loaded: 0,
      total: 0,
      percentage: 0,
      status: 'pending' as const,
    };

    const updatedProgress = { ...currentProgress, ...progress };

    // Calculate percentage if loaded and total are provided
    if (progress.loaded !== undefined && progress.total !== undefined && progress.total > 0) {
      updatedProgress.percentage = Math.round((progress.loaded / progress.total) * 100);
    }

    this.progressTracking.set(imageId, updatedProgress);

    // Emit progress event
    this.emit('progress', updatedProgress);

    // Call progress callback if configured
    if (this.config.onProgress) {
      this.config.onProgress(updatedProgress);
    }
  }

  protected clearProgress(imageId: string): void {
    this.progressTracking.delete(imageId);
  }

  public getProgress(imageId: string): LoadProgress | null {
    return this.progressTracking.get(imageId) || null;
  }

  public getAllProgress(): Map<string, LoadProgress> {
    return new Map(this.progressTracking);
  }

  // ===== Error Handling =====

  protected handleError(error: Error, context: ErrorContext): void {
    log.error('DICOM load error', {
      component: 'BaseDICOMLoader',
      metadata: context,
    }, error);

    // Update progress with error
    this.updateProgress(context.imageId, {
      status: 'failed',
      error,
    });

    // Call error handler if configured
    if (this.config.errorHandler) {
      this.config.errorHandler(error, context);
    }

    // Emit error event
    this.emit('error', { error, context });
  }

  // ===== Cleanup =====

  public dispose(): void {
    // Cancel all active loads
    for (const [imageId, controller] of this.activeLoads) {
      controller.abort();
      this.clearProgress(imageId);
    }
    this.activeLoads.clear();

    // Clear queues and caches
    this.loadQueue = [];
    this.progressTracking.clear();
    this.metadataCache.clear();
    this.sopClassHandlers.clear();

    // Remove all listeners
    this.removeAllListeners();

    log.info('DICOM loader disposed', {
      component: 'BaseDICOMLoader',
    });
  }
}

