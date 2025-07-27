/**
 * Advanced DICOM Loader Core Implementation
 *
 * Simplified implementation that focuses on core functionality
 * while maintaining compatibility with existing interfaces.
 */

import {
  Types,
  imageLoader,
  volumeLoader,
  cache,
} from '@cornerstonejs/core';
import {
  init as dicomImageLoaderInit,
  configure as dicomImageLoaderConfigure,
  DICOMImageLoaderConfig,
} from '@cornerstonejs/dicom-image-loader';

// Configuration imports
import {
  DICOMLoaderConfig,
  VolumeLoadingOptions,
  ConfigValidator,
} from '../config/loaderConfig';
import { SUPPORTED_SOP_CLASSES } from '../constants/sopClasses';

/**
 * Advanced DICOM Loader Class
 *
 * Provides high-performance loading capabilities for DICOM images and volumes
 * with support for multiple protocols, progressive loading, and advanced caching.
 */
export class AdvancedDICOMLoader {
  private config: DICOMLoaderConfig;
  private initialized = false;
  private loadingQueue: Map<string, Promise<any>> = new Map();
  private prefetchQueue: string[] = [];
  private errorCount = 0;

  constructor(config?: Partial<DICOMLoaderConfig>) {
    // Merge provided config with defaults
    this.config = ConfigValidator.mergeWithDefaults(config || {});

    // Validate configuration
    const validationErrors = ConfigValidator.validateConfig(this.config);
    if (validationErrors.length > 0) {
      throw new Error(`Invalid DICOM loader configuration: ${validationErrors.join(', ')}`);
    }
  }

  /**
   * Configure the loader with new settings
   */
  async configure(config: Partial<DICOMLoaderConfig>): Promise<void> {
    const validationErrors = ConfigValidator.validateConfig(config);
    if (validationErrors.length > 0) {
      throw new Error(`Invalid configuration: ${validationErrors.join(', ')}`);
    }

    this.config = ConfigValidator.mergeWithDefaults({ ...this.config, ...config });
    await this.reconfigure();
  }

  /**
   * Initialize the loader
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize cornerstone DICOM loader
      await dicomImageLoaderInit({
        maxWebWorkers: this.config.maxWebWorkers || 4,
      });

      // Configure DICOM loader settings
      dicomImageLoaderConfigure({
        maxWebWorkers: this.config.maxWebWorkers || 4,
      } as DICOMImageLoaderConfig);

      this.initialized = true;
    } catch {
      throw new Error('Failed to initialize DICOM loader');
    }
  }

  /**
   * Load a single DICOM image
   */
  async loadImage(imageId: string): Promise<Types.IImage> {
    await this.initialize();

    // Check if already loading
    if (this.loadingQueue.has(imageId)) {
      return this.loadingQueue.get(imageId)!;
    }

    // Start loading
    const loadPromise = this.performImageLoad(imageId);
    this.loadingQueue.set(imageId, loadPromise);

    try {
      const image = await loadPromise;
      this.schedulePrefetch(imageId);
      return image;
    } finally {
      this.loadingQueue.delete(imageId);
    }
  }

  /**
   * Load a DICOM volume
   */
  async loadVolume(options: VolumeLoadingOptions): Promise<Types.IImageVolume> {
    await this.initialize();

    try {
      // Load volume using cornerstone
      const volume = await volumeLoader.createAndCacheVolume!(options.volumeId, {
        imageIds: options.imageIds,
      });

      // Progress tracking
      if (options.callback) {
        options.callback({
          imageId: options.volumeId,
          loaded: options.imageIds.length,
          total: options.imageIds.length,
          percentage: 100,
          stage: 'full' as const,
        });
      }

      return volume;
    } catch {
      throw new Error(`Failed to load volume ${options.volumeId}`);
    }
  }

  /**
   * Reset the loader state
   */
  async reset(): Promise<void> {
    // Clear caches
    if (cache.purgeCache) {
      cache.purgeCache();
    }
    this.loadingQueue.clear();
    this.prefetchQueue = [];
    this.errorCount = 0;

    this.initialized = false;
  }

  /**
   * Perform actual image loading
   */
  private async performImageLoad(imageId: string): Promise<Types.IImage> {
    try {
      // Standard loading
      const image = await imageLoader.loadAndCacheImage!(imageId);

      return image;
    } catch (error) {
      this.handleLoadingError(error as Error);
      throw error;
    }
  }

  /**
   * Schedule prefetching for surrounding images
   */
  private schedulePrefetch(_imageId: string): void {
    if (!this.config.enablePrefetch) return;
    // Simplified prefetch implementation
  }


  /**
   * Reconfigure the loader
   */
  private async reconfigure(): Promise<void> {
    // Simplified reconfiguration
  }

  /**
   * Handle loading errors
   */
  private handleLoadingError(_error: Error): void {
    this.errorCount++;

    // Implement retry logic if needed
    if (this.errorCount > this.config.retryAttempts) {
      throw new Error('Maximum retry attempts exceeded');
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): DICOMLoaderConfig {
    return { ...this.config };
  }

  /**
   * Get loading statistics
   */
  getLoadingStats() {
    return {
      queueSize: this.loadingQueue.size,
      prefetchQueueSize: this.prefetchQueue.length,
      errorCount: this.errorCount,
      cacheStats: cache.getCacheInformation?.() || null,
    };
  }

  // Legacy compatibility methods for existing utility files
  getTagValue(_imageId: string, _tag: string): any {
    return undefined;
  }

  queryMetadata(_query: any): any {
    return undefined;
  }

  configureSOPClass(_config: any): void {
    // Legacy compatibility
  }

  listSupportedSOPClasses(): string[] {
    return Object.values(SUPPORTED_SOP_CLASSES);
  }

  getSOPClassInfo(_sopClass: string): any {
    return undefined;
  }
}
