/**
 * DICOM Loader Configuration Interfaces
 *
 * Configuration options and interfaces for the advanced DICOM loader.
 * These interfaces define the structure for configuring WADO protocols,
 * progressive loading, caching, performance, and security settings.
 */

import type {
  WADOURIConfig,
  WADORSConfig,
} from '../../wadoProtocolHandler';
import type {
  ProgressiveLoadingConfig,
} from '../../progressiveLoader';

/**
 * Main configuration interface for the DICOM loader
 */
export interface DICOMLoaderConfig {
  // WADO Protocol Configuration
  wadoUriEndpoint?: string;
  wadoRsEndpoint?: string;
  wadoUriConfig?: Partial<WADOURIConfig>;
  wadoRsConfig?: Partial<WADORSConfig>;

  // Progressive Loading Configuration
  progressiveConfig?: Partial<ProgressiveLoadingConfig>;

  // Metadata Management Configuration
  metadataConfig?: {
    maxCacheSize?: number;
    enablePrivateTags?: boolean;
    enableSequences?: boolean;
    autoAnonymize?: boolean;
    customTags?: string[];
  };

  // SOP Class Configuration
  sopClassConfig?: {
    enableAll?: boolean;
    enabledCategories?: string[];
    disabledSOPClasses?: string[];
    fallbackEnabled?: boolean;
    validationStrict?: boolean;
  };

  // Performance Settings
  maxConcurrentRequests: number;
  enableProgressive: boolean;
  maxWebWorkers?: number;

  // Supported Features
  supportedSOPClasses: string[];
  enableMultiframe: boolean;
  enableCompression: boolean;

  // Caching Configuration
  cacheSize: number; // in bytes
  enablePrefetch: boolean;
  prefetchDistance: number; // number of images to prefetch

  // Security Settings
  authenticateRequests: boolean;
  apiKey?: string;
  customHeaders?: Record<string, string>;

  // Error Handling
  retryAttempts: number;
  retryDelay: number; // in milliseconds
  enableFallback: boolean;

  // Progressive Loading
  progressiveStages?: {
    thumbnail?: boolean;
    preview?: boolean;
    fullResolution?: boolean;
  };

  // Image Processing
  decodeConfig?: {
    convertColorspace?: boolean;
    convertFloatPixelDataToInt?: boolean;
    use16BitDataType?: boolean;
  };
}

/**
 * Loading progress tracking interface
 */
export interface LoadingProgress {
  imageId: string;
  loaded: number;
  total: number;
  percentage: number;
  stage: 'thumbnail' | 'preview' | 'full';
}

/**
 * Volume loading options interface
 */
export interface VolumeLoadingOptions {
  imageIds: string[];
  volumeId: string;
  progressive?: boolean;
  callback?: (progress: LoadingProgress) => void;
}

/**
 * Default configuration for the DICOM loader
 */
export const DEFAULT_DICOM_LOADER_CONFIG: DICOMLoaderConfig = {
  // Performance defaults
  maxConcurrentRequests: 6,
  enableProgressive: true,
  maxWebWorkers: 4,

  // Feature defaults
  supportedSOPClasses: [],
  enableMultiframe: true,
  enableCompression: true,

  // Caching defaults
  cacheSize: 1024 * 1024 * 512, // 512MB
  enablePrefetch: true,
  prefetchDistance: 10,

  // Security defaults
  authenticateRequests: false,

  // Error handling defaults
  retryAttempts: 3,
  retryDelay: 1000,
  enableFallback: true,

  // Progressive loading defaults
  progressiveStages: {
    thumbnail: true,
    preview: true,
    fullResolution: true,
  },

  // Metadata defaults
  metadataConfig: {
    maxCacheSize: 1000,
    enablePrivateTags: false,
    enableSequences: true,
    autoAnonymize: false,
    customTags: [],
  },

  // SOP Class defaults
  sopClassConfig: {
    enableAll: true,
    enabledCategories: ['IMAGE_STORAGE', 'ENHANCED_STORAGE', 'MULTIFRAME_STORAGE'],
    disabledSOPClasses: [],
    fallbackEnabled: true,
    validationStrict: false,
  },

  // Image processing defaults
  decodeConfig: {
    convertColorspace: true,
    convertFloatPixelDataToInt: false,
    use16BitDataType: true,
  },
};

/**
 * Configuration validation utilities
 */
export class ConfigValidator {
  /**
   * Validate DICOM loader configuration
   */
  static validateConfig(config: Partial<DICOMLoaderConfig>): string[] {
    const errors: string[] = [];

    // Validate performance settings
    if (config.maxConcurrentRequests !== undefined && config.maxConcurrentRequests < 1) {
      errors.push('maxConcurrentRequests must be at least 1');
    }

    if (config.maxWebWorkers !== undefined && config.maxWebWorkers < 0) {
      errors.push('maxWebWorkers must be non-negative');
    }

    // Validate cache settings
    if (config.cacheSize !== undefined && config.cacheSize < 0) {
      errors.push('cacheSize must be non-negative');
    }

    if (config.prefetchDistance !== undefined && config.prefetchDistance < 0) {
      errors.push('prefetchDistance must be non-negative');
    }

    // Validate retry settings
    if (config.retryAttempts !== undefined && config.retryAttempts < 0) {
      errors.push('retryAttempts must be non-negative');
    }

    if (config.retryDelay !== undefined && config.retryDelay < 0) {
      errors.push('retryDelay must be non-negative');
    }

    return errors;
  }

  /**
   * Merge configuration with defaults
   */
  static mergeWithDefaults(config: Partial<DICOMLoaderConfig>): DICOMLoaderConfig {
    return {
      ...DEFAULT_DICOM_LOADER_CONFIG,
      ...config,
      metadataConfig: {
        ...DEFAULT_DICOM_LOADER_CONFIG.metadataConfig,
        ...config.metadataConfig,
      },
      sopClassConfig: {
        ...DEFAULT_DICOM_LOADER_CONFIG.sopClassConfig,
        ...config.sopClassConfig,
      },
      progressiveStages: {
        ...DEFAULT_DICOM_LOADER_CONFIG.progressiveStages,
        ...(config.progressiveStages || {}),
      },
      decodeConfig: {
        ...DEFAULT_DICOM_LOADER_CONFIG.decodeConfig,
        ...config.decodeConfig,
      },
    };
  }
}
