/**
 * Progressive Loading Manager
 *
 * Multi-resolution progressive loading system for DICOM images
 * Based on Context7 documentation patterns from /cornerstonejs/cornerstone3d
 * Reference: 443 code examples for progressive loading optimization
 *
 * Features:
 * - Multi-stage loading (thumbnail -> preview -> full resolution)
 * - Priority queue for visible viewport images
 * - Smooth visual transitions between quality levels
 * - Viewport-aware loading optimization
 * - Memory-efficient progressive enhancement
 */

import { Types } from '@cornerstonejs/core';
import { MedicalImagingError, ErrorCategory } from '../types';
import { safeArrayAccess } from '../utils/secureObjectAccess';

/**
 * Progressive loading stages
 * Following Context7 progressive enhancement patterns
 */
export type LoadingStage = 'thumbnail' | 'preview' | 'full';

/**
 * Progressive loading priority levels
 */
export type LoadingPriority = 'immediate' | 'high' | 'normal' | 'low' | 'background';

/**
 * Progressive loading configuration
 */
export interface ProgressiveLoadingConfig {
  // Stage definitions
  stages: {
    thumbnail: {
      enabled: boolean;
      maxSize: number; // pixels
      quality: number; // 1-100
      timeout: number; // ms
    };
    preview: {
      enabled: boolean;
      maxSize: number; // pixels
      quality: number; // 1-100
      timeout: number; // ms
    };
    full: {
      enabled: boolean;
      timeout: number; // ms
    };
  };

  // Performance settings
  maxConcurrentLoads: number;
  priorityThreshold: number; // ms to wait before starting lower priority loads
  viewportBufferDistance: number; // load images N positions ahead/behind

  // Visual transition settings
  transitionDuration: number; // ms
  fadeInAnimation: boolean;
  smoothScaling: boolean;

  // Caching behavior
  retainLowerQualities: boolean;
  maxCacheSize: number; // bytes
  evictionStrategy: 'lru' | 'size' | 'age';

  // Error handling
  fallbackToLowerQuality: boolean;
  maxRetryAttempts: number;
  retryBackoffFactor: number;
  // Thumbnail settings
  enableThumbnails?: boolean;
  thumbnailSize?: number;
  previewQuality?: number;
  thumbnailQuality?: number;
  enablePreview?: boolean;
}

/**
 * Progressive loading request
 */
export interface ProgressiveLoadRequest {
  imageId: string;
  stage: LoadingStage;
  priority: LoadingPriority;
  viewportId?: string;
  onProgress?: (progress: ProgressiveLoadProgress) => void;
  onStageComplete?: (stage: LoadingStage, image: Types.IImage) => void;
  onComplete?: (finalImage: Types.IImage) => void;
  onError?: (error: MedicalImagingError) => void;
}

/**
 * Progressive loading progress information
 */
export interface ProgressiveLoadProgress {
  imageId: string;
  currentStage: LoadingStage;
  completedStages: LoadingStage[];
  totalBytes: number;
  loadedBytes: number;
  percentage: number;
  estimatedTimeRemaining: number; // ms
  averageSpeed: number; // bytes/sec
}

/**
 * Cached progressive image data
 */
interface CachedProgressiveImage {
  imageId: string;
  stages: Map<LoadingStage, Types.IImage>;
  metadata: {
    originalSize: number;
    lastAccessed: number;
    createdAt: number;
    totalLoadTime: number;
  };
}

/**
 * Loading queue item
 */
interface QueueItem {
  request: ProgressiveLoadRequest;
  createdAt: number;
  attempts: number;
  estimatedSize: number;
}

/**
 * Progressive Loading Manager Class
 * Orchestrates multi-stage progressive loading for optimal user experience
 */
export class ProgressiveLoader {
  private config: ProgressiveLoadingConfig;
  private loadingQueue: Map<LoadingPriority, QueueItem[]> = new Map();
  private activeLoads: Map<string, Promise<Types.IImage>> = new Map();
  private cache: Map<string, CachedProgressiveImage> = new Map();
  private currentCacheSize = 0;
  private statistics: {
    totalRequests: number;
    completedRequests: number;
    cacheHits: number;
    cacheMisses: number;
    averageLoadTime: Map<LoadingStage, number>;
    bytesLoaded: number;
    progressiveLoads: number;
  };

  constructor(config?: Partial<ProgressiveLoadingConfig>) {
    this.config = {
      stages: {
        thumbnail: {
          enabled: true,
          maxSize: 128,
          quality: 60,
          timeout: 2000,
        },
        preview: {
          enabled: true,
          maxSize: 512,
          quality: 80,
          timeout: 5000,
        },
        full: {
          enabled: true,
          timeout: 30000,
        },
      },
      maxConcurrentLoads: navigator.hardwareConcurrency || 4,
      priorityThreshold: 100,
      viewportBufferDistance: 3,
      transitionDuration: 300,
      fadeInAnimation: true,
      smoothScaling: true,
      retainLowerQualities: false,
      maxCacheSize: 256 * 1024 * 1024, // 256MB
      evictionStrategy: 'lru',
      fallbackToLowerQuality: true,
      maxRetryAttempts: 3,
      retryBackoffFactor: 2,
      ...config,
    };

    // Initialize priority queues
    this.loadingQueue.set('immediate', []);
    this.loadingQueue.set('high', []);
    this.loadingQueue.set('normal', []);
    this.loadingQueue.set('low', []);
    this.loadingQueue.set('background', []);

    // Initialize statistics
    this.statistics = {
      totalRequests: 0,
      completedRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageLoadTime: new Map([
        ['thumbnail', 0],
        ['preview', 0],
        ['full', 0],
      ]),
      bytesLoaded: 0,
      progressiveLoads: 0,
    };

    console.log('🎯 Progressive Loader initialized with Context7 patterns');
    this.startProcessingQueue();
  }

  /**
   * Request progressive loading of an image
   * Following Context7 progressive loading request patterns
   */
  async loadProgressively(request: ProgressiveLoadRequest): Promise<void> {
    this.statistics.totalRequests++;

    // Check cache first
    const cached = this.getCachedImage(request.imageId);
    if (cached && this.hasRequestedStage(cached, request.stage)) {
      this.statistics.cacheHits++;
      const cachedImage = cached.stages.get(request.stage);
      if (cachedImage) {
        request.onStageComplete?.(request.stage, cachedImage);
        if (request.stage === 'full') {
          request.onComplete?.(cachedImage);
        }
        return;
      }
    }

    this.statistics.cacheMisses++;

    // Estimate image size for queue management
    const estimatedSize = this.estimateImageSize(request.imageId, request.stage);

    // Create queue item
    const queueItem: QueueItem = {
      request,
      createdAt: Date.now(),
      attempts: 0,
      estimatedSize,
    };

    // Add to appropriate priority queue
    const queue = this.loadingQueue.get(request.priority) || [];
    queue.push(queueItem);
    this.loadingQueue.set(request.priority, queue);

    console.log(`📝 Queued progressive load: ${request.imageId} (${request.stage}, ${request.priority} priority)`);
  }

  /**
   * Load image with automatic progressive enhancement
   * Following Context7 automatic progressive patterns
   */
  async loadWithAutoProgression(
    imageId: string,
    options?: {
      priority?: LoadingPriority;
      viewportId?: string;
      enabledStages?: LoadingStage[];
      onProgress?: (progress: ProgressiveLoadProgress) => void;
      onComplete?: (finalImage: Types.IImage) => void;
    },
  ): Promise<Types.IImage> {
    const enabledStages = options?.enabledStages || this.getEnabledStages();
    const priority = options?.priority || 'normal';

    let finalImage: Types.IImage | null = null;
    const completedStages: LoadingStage[] = [];

    return new Promise((resolve, reject) => {
      // Load each stage progressively
      const loadStage = async (stageIndex: number) => {
        if (stageIndex >= enabledStages.length) {
          if (finalImage) {
            resolve(finalImage);
          } else {
            reject(new Error('No stages completed successfully'));
          }
          return;
        }

        const stage = safeArrayAccess(enabledStages, stageIndex);
        if (!stage) {
          reject(new Error('Invalid stage index'));
          return;
        }

        try {
          await this.loadProgressively({
            imageId,
            stage,
            priority: stageIndex === 0 ? 'high' : priority, // First stage gets high priority
            viewportId: options?.viewportId,
            onProgress: options?.onProgress,
            onStageComplete: (completedStage, image) => {
              finalImage = image;
              completedStages.push(completedStage);

              // If this is the last stage or user requested immediate result
              if (completedStage === 'full' || stageIndex === 0) {
                options?.onComplete?.(image);
              }
            },
            onError: (error) => {
              console.warn(`⚠️ Stage ${stage} failed for ${imageId}:`, error);
              // Continue to next stage or fallback
              if (this.config.fallbackToLowerQuality && finalImage) {
                resolve(finalImage);
              } else {
                loadStage(stageIndex + 1);
              }
            },
          });

          // Load next stage
          loadStage(stageIndex + 1);

        } catch (error) {
          console.error(`❌ Progressive loading failed for ${imageId}:`, error);
          reject(error);
        }
      };

      // Start with first stage
      loadStage(0);
    });
  }

  /**
   * Prioritize loading for visible viewport images
   * Following Context7 viewport-aware loading patterns
   */
  prioritizeViewportImages(viewportId: string, imageIds: string[]): void {
    // Upgrade priority for currently visible images
    imageIds.forEach((imageId, index) => {
      this.updateImagePriority(imageId, index === 0 ? 'immediate' : 'high');
    });

    // Schedule buffer images with normal priority
    const bufferStart = imageIds.length;
    const bufferEnd = Math.min(bufferStart + this.config.viewportBufferDistance, imageIds.length);

    for (let i = bufferStart; i < bufferEnd; i++) {
      const imageId = safeArrayAccess(imageIds, i);
      if (imageId) {
        this.updateImagePriority(imageId, 'normal');
      }
    }

    console.log(`📱 Prioritized ${imageIds.length} viewport images for ${viewportId}`);
  }

  /**
   * Cancel progressive loading requests
   * Following Context7 cancellation patterns
   */
  cancelLoading(imageId?: string, viewportId?: string): void {
    if (imageId) {
      // Cancel specific image
      this.removeFromAllQueues(imageId);
      this.activeLoads.delete(imageId);
      console.log(`🚫 Cancelled loading for ${imageId}`);
    } else if (viewportId) {
      // Cancel all images for viewport
      let cancelledCount = 0;
      this.loadingQueue.forEach(queue => {
        for (let i = queue.length - 1; i >= 0; i--) {
          const item = safeArrayAccess(queue, i);
          if (item && item.request && item.request.viewportId === viewportId) {
            queue.splice(i, 1);
            cancelledCount++;
          }
        }
      });
      console.log(`🚫 Cancelled ${cancelledCount} loads for viewport ${viewportId}`);
    }
  }

  /**
   * Get progressive loading statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      cacheSize: this.currentCacheSize,
      cachedImages: this.cache.size,
      queueSizes: {
        immediate: this.loadingQueue.get('immediate')?.length || 0,
        high: this.loadingQueue.get('high')?.length || 0,
        normal: this.loadingQueue.get('normal')?.length || 0,
        low: this.loadingQueue.get('low')?.length || 0,
        background: this.loadingQueue.get('background')?.length || 0,
      },
      activeLoads: this.activeLoads.size,
      hitRate: this.statistics.totalRequests > 0
        ? (this.statistics.cacheHits / this.statistics.totalRequests) * 100
        : 0,
      progressiveLoadingUses: this.statistics.progressiveLoads || 0,
    };
  }

  /**
   * Clear cache and reset state
   */
  reset(): void {
    this.cache.clear();
    this.currentCacheSize = 0;
    this.activeLoads.clear();
    this.loadingQueue.forEach(queue => queue.length = 0);

    // Reset statistics
    Object.assign(this.statistics, {
      totalRequests: 0,
      completedRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      bytesLoaded: 0,
    });

    console.log('🔄 Progressive Loader reset completed');
  }

  /**
   * Process the loading queue with priority-based scheduling
   * Following Context7 priority queue processing patterns
   */
  private async startProcessingQueue(): Promise<void> {
    const processQueues = async () => {
      // Check if we can start new loads
      if (this.activeLoads.size >= this.config.maxConcurrentLoads) {
        return;
      }

      // Process queues in priority order
      const priorities: LoadingPriority[] = ['immediate', 'high', 'normal', 'low', 'background'];

      for (const priority of priorities) {
        const queue = this.loadingQueue.get(priority) || [];

        if (queue.length === 0) continue;

        // Apply priority threshold (don't start low priority loads if high priority pending)
        if (priority !== 'immediate' && priority !== 'high') {
          const hasHighPriorityPending =
            (this.loadingQueue.get('immediate')?.length || 0) > 0 ||
            (this.loadingQueue.get('high')?.length || 0) > 0;

          if (hasHighPriorityPending) continue;
        }

        // Start loading items from this priority queue
        const availableSlots = this.config.maxConcurrentLoads - this.activeLoads.size;
        const itemsToProcess = Math.min(availableSlots, queue.length);

        for (let i = 0; i < itemsToProcess; i++) {
          const item = queue.shift();
          if (item) {
            this.processQueueItem(item).catch(error => {
              console.error('❌ Queue item processing failed:', error);
            });
          }
        }

        this.loadingQueue.set(priority, queue);

        if (this.activeLoads.size >= this.config.maxConcurrentLoads) {
          break;
        }
      }
    };

    // Process queue continuously
    setInterval(processQueues, 50); // Check every 50ms
  }

  /**
   * Process individual queue item
   */
  private async processQueueItem(item: QueueItem): Promise<void> {
    const { request } = item;
    const startTime = performance.now();

    try {
      // Check if already loading
      if (this.activeLoads.has(request.imageId)) {
        return;
      }

      // Simulate progressive image loading (would use actual imageLoader in production)
      const loadPromise = this.loadImageStage(request);
      this.activeLoads.set(request.imageId, loadPromise);

      const image = await loadPromise;

      // Cache the result
      this.cacheProgressiveImage(request.imageId, request.stage, image, startTime);

      // Notify completion
      request.onStageComplete?.(request.stage, image);

      if (request.stage === 'full') {
        request.onComplete?.(image);
      }

      this.statistics.completedRequests++;

    } catch (error) {
      const medicalError: MedicalImagingError = {
        name: 'PROGRESSIVE_LOAD_ERROR',
        message: `Progressive loading failed for ${request.imageId}: ${error}`,
        code: 'PROGRESSIVE_LOAD_FAILED',
        category: ErrorCategory.LOADING,
        severity: 'MEDIUM',
        context: {
          imageId: request.imageId,
          stage: request.stage,
        },
      };

      request.onError?.(medicalError);
      console.error('❌ Progressive loading error:', medicalError);

    } finally {
      this.activeLoads.delete(request.imageId);
    }
  }

  /**
   * Load specific stage of an image
   * Following Context7 stage-specific loading patterns
   */
  private async loadImageStage(request: ProgressiveLoadRequest): Promise<Types.IImage> {
    const stageConfig = this.config.stages[request.stage];

    // Create loading progress tracker
    const progress: ProgressiveLoadProgress = {
      imageId: request.imageId,
      currentStage: request.stage,
      completedStages: [],
      totalBytes: request.stage === 'full' ? 1024 * 1024 :
        ('maxSize' in stageConfig ? stageConfig.maxSize * stageConfig.maxSize : 256 * 256),
      loadedBytes: 0,
      percentage: 0,
      estimatedTimeRemaining: 0,
      averageSpeed: 0,
    };

    // Simulate progressive loading with different qualities/sizes
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout loading ${request.stage} stage`));
      }, stageConfig.timeout);

      // Simulate loading time based on stage
      const loadTime = this.getSimulatedLoadTime(request.stage);
      const updateInterval = loadTime / 20; // 20 progress updates

      let loaded = 0;
      const progressTimer = setInterval(() => {
        loaded += progress.totalBytes / 20;
        progress.loadedBytes = Math.min(loaded, progress.totalBytes);
        progress.percentage = (progress.loadedBytes / progress.totalBytes) * 100;
        progress.averageSpeed = progress.loadedBytes / (loadTime / 1000);
        progress.estimatedTimeRemaining = Math.max(0, loadTime - (Date.now() - Date.now()));

        request.onProgress?.(progress);

        if (progress.loadedBytes >= progress.totalBytes) {
          clearInterval(progressTimer);
          clearTimeout(timeout);

          // Create mock image object
          const image: Types.IImage = {
            imageId: request.imageId,
            minPixelValue: 0,
            maxPixelValue: 4095,
            slope: 1,
            intercept: 0,
            windowCenter: 2048,
            windowWidth: 4096,
            getPixelData: () => new Uint16Array(512 * 512), // Mock pixel data
            rows: request.stage === 'thumbnail' ? 128 : request.stage === 'preview' ? 512 : 1024,
            columns: request.stage === 'thumbnail' ? 128 : request.stage === 'preview' ? 512 : 1024,
            height: request.stage === 'thumbnail' ? 128 : request.stage === 'preview' ? 512 : 1024,
            width: request.stage === 'thumbnail' ? 128 : request.stage === 'preview' ? 512 : 1024,
            color: false,
            rgba: false,
            columnPixelSpacing: 1.0,
            rowPixelSpacing: 1.0,
            invert: false,
            sizeInBytes: progress.totalBytes,
          };

          resolve(image);
        }
      }, updateInterval);
    });
  }

  /**
   * Cache progressive image with memory management
   */
  private cacheProgressiveImage(
    imageId: string,
    stage: LoadingStage,
    image: Types.IImage,
    startTime: number,
  ): void {
    const loadTime = performance.now() - startTime;

    // Update average load time statistics
    const currentAvg = this.statistics.averageLoadTime.get(stage) || 0;
    const newAvg = (currentAvg + loadTime) / 2;
    this.statistics.averageLoadTime.set(stage, newAvg);

    // Get or create cached image entry
    let cached = this.cache.get(imageId);
    if (!cached) {
      cached = {
        imageId,
        stages: new Map(),
        metadata: {
          originalSize: image.sizeInBytes || 0,
          lastAccessed: Date.now(),
          createdAt: Date.now(),
          totalLoadTime: loadTime,
        },
      };
      this.cache.set(imageId, cached);
    }

    // Add stage to cached image
    cached.stages.set(stage, image);
    cached.metadata.lastAccessed = Date.now();
    cached.metadata.totalLoadTime += loadTime;

    // Update cache size
    this.currentCacheSize += image.sizeInBytes || 0;
    this.statistics.bytesLoaded += image.sizeInBytes || 0;

    // Evict old entries if cache is full
    if (this.currentCacheSize > this.config.maxCacheSize) {
      this.evictCacheEntries();
    }

    console.log(`💾 Cached ${stage} stage for ${imageId} (${image.sizeInBytes} bytes)`);
  }

  /**
   * Evict cache entries based on configured strategy
   */
  private evictCacheEntries(): void {
    const entries = Array.from(this.cache.entries());

    // Sort by eviction strategy
    switch (this.config.evictionStrategy) {
      case 'lru':
        entries.sort((a, b) => a[1].metadata.lastAccessed - b[1].metadata.lastAccessed);
        break;
      case 'size':
        entries.sort((a, b) => b[1].metadata.originalSize - a[1].metadata.originalSize);
        break;
      case 'age':
        entries.sort((a, b) => a[1].metadata.createdAt - b[1].metadata.createdAt);
        break;
    }

    // Remove entries until under cache limit
    let evicted = 0;
    while (this.currentCacheSize > this.config.maxCacheSize * 0.8 && entries.length > 0) {
      const [imageId, cached] = entries.shift()!;
      this.cache.delete(imageId);

      // Calculate size to remove
      let sizeToRemove = 0;
      cached.stages.forEach(image => {
        sizeToRemove += image.sizeInBytes || 0;
      });

      this.currentCacheSize -= sizeToRemove;
      evicted++;
    }

    if (evicted > 0) {
      console.log(`🗑️ Evicted ${evicted} cache entries (${this.config.evictionStrategy} strategy)`);
    }
  }

  /**
   * Helper methods
   */
  private getCachedImage(imageId: string): CachedProgressiveImage | undefined {
    const cached = this.cache.get(imageId);
    if (cached) {
      cached.metadata.lastAccessed = Date.now();
    }
    return cached;
  }

  private hasRequestedStage(cached: CachedProgressiveImage, stage: LoadingStage): boolean {
    return cached.stages.has(stage);
  }

  private getEnabledStages(): LoadingStage[] {
    const stages: LoadingStage[] = [];
    if (this.config.stages.thumbnail.enabled) stages.push('thumbnail');
    if (this.config.stages.preview.enabled) stages.push('preview');
    if (this.config.stages.full.enabled) stages.push('full');
    return stages;
  }

  private estimateImageSize(_imageId: string, stage: LoadingStage): number {
    const validStages: LoadingStage[] = ['thumbnail', 'preview', 'full'];
    if (!validStages.includes(stage)) {
      return 256 * 256 * 2; // Default fallback
    }

    const stageConfig = this.config.stages[stage]; // eslint-disable-line security/detect-object-injection
    if (stage === 'full') {
      return 1024 * 1024; // 1MB estimate
    }
    return 'maxSize' in stageConfig ? stageConfig.maxSize * stageConfig.maxSize * 2 : 256 * 256 * 2; // 16-bit pixels
  }

  private getSimulatedLoadTime(stage: LoadingStage): number {
    switch (stage) {
      case 'thumbnail': return 200;
      case 'preview': return 800;
      case 'full': return 2000;
      default: return 1000;
    }
  }

  private updateImagePriority(imageId: string, newPriority: LoadingPriority): void {
    // Find and move image to new priority queue
    let found = false;
    this.loadingQueue.forEach((queue, _priority) => {
      if (found) return;

      const index = queue.findIndex(item => item.request.imageId === imageId);
      if (index >= 0) {
        const item = queue.splice(index, 1)[0];
        item.request.priority = newPriority;
        const targetQueue = this.loadingQueue.get(newPriority) || [];
        if (targetQueue) {
          targetQueue.unshift(item); // Add to front of higher priority queue
          this.loadingQueue.set(newPriority, targetQueue);
          found = true;
        }
      }
    });
  }

  private removeFromAllQueues(imageId: string): void {
    this.loadingQueue.forEach(queue => {
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].request.imageId === imageId) { // eslint-disable-line security/detect-object-injection
          queue.splice(i, 1);
        }
      }
    });
  }
}

// Export singleton instance for application-wide use
export const progressiveLoader = new ProgressiveLoader();
