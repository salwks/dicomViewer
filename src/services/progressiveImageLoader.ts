/**
 * Progressive Image Loader
 * Implements progressive loading strategy for DICOM images with priority-based loading
 */

import { performanceManager } from './performanceManager';

export interface ImageLoadRequest {
  imageId: string;
  priority: LoadPriority;
  seriesUID: string;
  instanceNumber: number;
  frameIndex?: number;
  options?: LoadOptions;
}

export interface LoadOptions {
  useWebWorker?: boolean;
  cachePriority?: CachePriority;
  compressionLevel?: number;
  targetPixelData?: boolean;
  previewQuality?: boolean;
}

export enum LoadPriority {
  CRITICAL = 0,    // Currently visible viewport
  HIGH = 1,        // Next/previous in stack
  MEDIUM = 2,      // Same series, nearby images
  LOW = 3,         // Other series in study
  BACKGROUND = 4,  // Prefetch for other studies
}

export enum CachePriority {
  NEVER_EVICT = 0,    // Critical images
  LOW_EVICT = 1,      // Important images
  NORMAL_EVICT = 2,   // Standard images
  HIGH_EVICT = 3,     // Prefetched images
}

export interface LoadingState {
  imageId: string;
  status: 'pending' | 'loading' | 'loaded' | 'error' | 'cancelled';
  progress: number;
  priority: LoadPriority;
  startTime: number;
  loadTime?: number;
  error?: Error;
  retryCount: number;
  cancelled: boolean;
}

export interface ProgressiveLoadConfig {
  maxConcurrentLoads: number;
  retryAttempts: number;
  retryDelay: number;
  preloadBuffer: number;
  enableWebWorkers: boolean;
  compressionThreshold: number;
  cacheSizeLimit: number;
  priorityTimeouts: Record<LoadPriority, number>;
}

/**
 * Progressive image loading system with priority queuing
 */
export class ProgressiveImageLoader extends EventTarget {
  /**
   * Trigger custom event
   */
  private triggerEvent(type: string, detail: any): void {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
  private static instance: ProgressiveImageLoader | null = null;
  private config: ProgressiveLoadConfig;
  private loadQueues: Map<LoadPriority, ImageLoadRequest[]> = new Map();
  private activeLoads: Map<string, LoadingState> = new Map();
  private loadingWorkers: Worker[] = [];
  private cancelledRequests: Set<string> = new Set();
  private retryTimeouts: Map<string, number> = new Map();

  private constructor(config: Partial<ProgressiveLoadConfig> = {}) {
    super();

    this.config = {
      maxConcurrentLoads: 4,
      retryAttempts: 3,
      retryDelay: 1000,
      preloadBuffer: 5,
      enableWebWorkers: true,
      compressionThreshold: 1024 * 1024, // 1MB
      cacheSizeLimit: 500 * 1024 * 1024, // 500MB
      priorityTimeouts: {
        [LoadPriority.CRITICAL]: 100,
        [LoadPriority.HIGH]: 500,
        [LoadPriority.MEDIUM]: 2000,
        [LoadPriority.LOW]: 5000,
        [LoadPriority.BACKGROUND]: 10000,
      },
      ...config,
    };

    // Initialize priority queues
    Object.values(LoadPriority).forEach(priority => {
      if (typeof priority === 'number') {
        this.loadQueues.set(priority, []);
      }
    });

    this.initializeWebWorkers();
  }

  public static getInstance(config?: Partial<ProgressiveLoadConfig>): ProgressiveImageLoader {
    if (!ProgressiveImageLoader.instance) {
      ProgressiveImageLoader.instance = new ProgressiveImageLoader(config);
    }
    return ProgressiveImageLoader.instance;
  }

  /**
   * Initialize web workers for image processing
   */
  private initializeWebWorkers(): void {
    if (!this.config.enableWebWorkers || typeof Worker === 'undefined') {
      return;
    }

    const workerCount = Math.min(this.config.maxConcurrentLoads, navigator.hardwareConcurrency || 2);

    for (let i = 0; i < workerCount; i++) {
      try {
        // Create worker for image processing
        // Note: In real implementation, you'd have a separate worker file
        const workerScript = this.createWorkerScript();
        const blob = new Blob([workerScript], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));

        worker.onmessage = (event) => this.handleWorkerMessage(event);
        worker.onerror = (error) => this.handleWorkerError(error);

        this.loadingWorkers.push(worker);
      } catch (error) {
        console.warn('Failed to create worker:', error);
      }
    }
  }

  /**
   * Create worker script for image processing
   */
  private createWorkerScript(): string {
    return `
      self.onmessage = function(event) {
        const { type, data } = event.data;
        
        switch (type) {
          case 'processImage':
            processImageData(data);
            break;
          case 'decompressImage':
            decompressImageData(data);
            break;
        }
      };
      
      function processImageData(data) {
        // Simulate image processing
        setTimeout(() => {
          self.postMessage({
            type: 'imageProcessed',
            imageId: data.imageId,
            result: { processed: true }
          });
        }, Math.random() * 100);
      }
      
      function decompressImageData(data) {
        // Simulate decompression
        setTimeout(() => {
          self.postMessage({
            type: 'imageDecompressed',
            imageId: data.imageId,
            result: { decompressed: true }
          });
        }, Math.random() * 200);
      }
    `;
  }

  /**
   * Handle worker messages
   */
  private handleWorkerMessage(event: MessageEvent): void {
    const { type, imageId, result, error } = event.data;

    switch (type) {
      case 'imageProcessed':
        this.handleImageProcessed(imageId, result);
        break;
      case 'imageDecompressed':
        this.handleImageDecompressed(imageId, result);
        break;
      case 'error':
        this.handleImageError(imageId, error);
        break;
    }
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(error: ErrorEvent): void {
    console.error('Worker error:', error);
    this.triggerEvent('worker:error', { error });
  }

  /**
   * Request image load with priority
   */
  public requestImageLoad(request: ImageLoadRequest): void {
    const { imageId, priority } = request;

    // Check if already loading or loaded
    if (this.activeLoads.has(imageId)) {
      const state = this.activeLoads.get(imageId)!;
      if (state.status === 'loaded' || state.status === 'loading') {
        return;
      }
    }

    // Check if cancelled
    if (this.cancelledRequests.has(imageId)) {
      return;
    }

    // Add to appropriate priority queue
    const queue = this.loadQueues.get(priority);
    if (queue) {
      // Remove any existing request for this image
      const existingIndex = queue.findIndex(req => req.imageId === imageId);
      if (existingIndex >= 0) {
        queue.splice(existingIndex, 1);
      }

      queue.push(request);
      this.sortQueueByPriority(queue);
    }

    // Create loading state
    this.activeLoads.set(imageId, {
      imageId,
      status: 'pending',
      progress: 0,
      priority,
      startTime: performance.now(),
      retryCount: 0,
      cancelled: false,
    });

    this.triggerEvent('request:queued', { imageId, priority });
    this.processLoadQueue();
  }

  /**
   * Sort queue by priority factors
   */
  private sortQueueByPriority(queue: ImageLoadRequest[]): void {
    queue.sort((a, b) => {
      // Primary sort by priority
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      // Secondary sort by instance number (for stack order)
      return a.instanceNumber - b.instanceNumber;
    });
  }

  /**
   * Process load queue
   */
  private processLoadQueue(): void {
    // Count active loads
    const activeCount = Array.from(this.activeLoads.values())
      .filter(state => state.status === 'loading').length;

    if (activeCount >= this.config.maxConcurrentLoads) {
      return;
    }

    // Find next request to process (highest priority first)
    let nextRequest: ImageLoadRequest | null = null;
    for (const [, queue] of this.loadQueues) {
      if (queue.length > 0) {
        nextRequest = queue.shift()!;
        break;
      }
    }

    if (!nextRequest) {
      return;
    }

    this.startImageLoad(nextRequest);

    // Continue processing queue if capacity allows
    setTimeout(() => this.processLoadQueue(), 0);
  }

  /**
   * Start loading an image
   */
  private async startImageLoad(request: ImageLoadRequest): Promise<void> {
    const { imageId, options = {} } = request;
    const state = this.activeLoads.get(imageId);

    if (!state || state.cancelled) {
      return;
    }

    state.status = 'loading';
    state.startTime = performance.now();

    this.triggerEvent('load:started', { imageId, priority: request.priority });
    performanceManager.startTiming(`image-load-${imageId}`);

    try {
      // Check if we should use web worker
      const useWorker = options.useWebWorker && this.loadingWorkers.length > 0;

      if (useWorker) {
        await this.loadImageWithWorker(request);
      } else {
        await this.loadImageDirect(request);
      }

      // Mark as loaded
      state.status = 'loaded';
      state.progress = 100;
      state.loadTime = performance.now() - state.startTime;

      performanceManager.endTiming(`image-load-${imageId}`);
      this.triggerEvent('load:completed', {
        imageId,
        loadTime: state.loadTime,
        priority: request.priority,
      });

    } catch (error) {
      await this.handleLoadError(request, error as Error);
    }
  }

  /**
   * Load image using web worker
   */
  private async loadImageWithWorker(request: ImageLoadRequest): Promise<void> {
    const worker = this.getAvailableWorker();
    if (!worker) {
      // Fallback to direct loading
      return this.loadImageDirect(request);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker load timeout'));
      }, this.config.priorityTimeouts[request.priority]);

      const messageHandler = (event: MessageEvent) => {
        const { type, imageId: workerId } = event.data;

        if (workerId === request.imageId) {
          clearTimeout(timeout);
          worker.removeEventListener('message', messageHandler);

          if (type === 'imageProcessed' || type === 'imageDecompressed') {
            resolve();
          } else if (type === 'error') {
            reject(new Error(event.data.error));
          }
        }
      };

      worker.addEventListener('message', messageHandler);
      worker.postMessage({
        type: 'processImage',
        data: {
          imageId: request.imageId,
          options: request.options,
        },
      });
    });
  }

  /**
   * Load image directly (without web worker)
   */
  private async loadImageDirect(request: ImageLoadRequest): Promise<void> {
    const { imageId } = request;

    // Simulate image loading
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Direct load timeout'));
      }, this.config.priorityTimeouts[request.priority]);

      // Simulate progressive loading with updates
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += Math.random() * 20;
        progress = Math.min(progress, 90);

        const state = this.activeLoads.get(imageId);
        if (state && !state.cancelled) {
          state.progress = progress;
          this.triggerEvent('load:progress', { imageId, progress });
        } else {
          clearInterval(progressInterval);
          clearTimeout(timeout);
          reject(new Error('Load cancelled'));
        }
      }, 50);

      // Complete loading
      setTimeout(() => {
        clearInterval(progressInterval);
        clearTimeout(timeout);

        const state = this.activeLoads.get(imageId);
        if (state && !state.cancelled) {
          resolve();
        } else {
          reject(new Error('Load cancelled'));
        }
      }, Math.random() * 500 + 200); // 200-700ms load time
    });
  }

  /**
   * Get available web worker
   */
  private getAvailableWorker(): Worker | null {
    // Simple round-robin selection
    return this.loadingWorkers.length > 0 ? this.loadingWorkers[0] : null;
  }

  /**
   * Handle load error with retry logic
   */
  private async handleLoadError(request: ImageLoadRequest, error: Error): Promise<void> {
    const { imageId } = request;
    const state = this.activeLoads.get(imageId);

    if (!state) return;

    state.retryCount++;

    if (state.retryCount <= this.config.retryAttempts) {
      // Schedule retry
      const delay = this.config.retryDelay * Math.pow(2, state.retryCount - 1);

      this.triggerEvent('load:retry', {
        imageId,
        attempt: state.retryCount,
        delay,
      });

      const timeoutId = window.setTimeout(() => {
        this.retryTimeouts.delete(imageId);
        if (!state.cancelled) {
          this.startImageLoad(request);
        }
      }, delay);

      this.retryTimeouts.set(imageId, timeoutId);
    } else {
      // Max retries reached
      state.status = 'error';
      state.error = error;

      performanceManager.endTiming(`image-load-${imageId}`);
      this.triggerEvent('load:failed', {
        imageId,
        error,
        retryCount: state.retryCount,
      });
    }
  }

  /**
   * Handle successful image processing
   */
  private handleImageProcessed(imageId: string, result: any): void {
    this.triggerEvent('image:processed', { imageId, result });
  }

  /**
   * Handle successful image decompression
   */
  private handleImageDecompressed(imageId: string, result: any): void {
    this.triggerEvent('image:decompressed', { imageId, result });
  }

  /**
   * Handle image processing error
   */
  private handleImageError(imageId: string, error: Error): void {
    const state = this.activeLoads.get(imageId);
    if (state) {
      state.status = 'error';
      state.error = error;
    }

    this.triggerEvent('load:failed', { imageId, error });
  }

  /**
   * Cancel image load request
   */
  public cancelImageLoad(imageId: string): void {
    // Mark as cancelled
    this.cancelledRequests.add(imageId);

    // Update state
    const state = this.activeLoads.get(imageId);
    if (state) {
      state.status = 'cancelled';
      state.cancelled = true;
    }

    // Remove from queues
    this.loadQueues.forEach(queue => {
      const index = queue.findIndex(req => req.imageId === imageId);
      if (index >= 0) {
        queue.splice(index, 1);
      }
    });

    // Cancel retry timeout
    const timeoutId = this.retryTimeouts.get(imageId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.retryTimeouts.delete(imageId);
    }

    this.triggerEvent('load:cancelled', { imageId });
  }

  /**
   * Cancel all loads for a series
   */
  public cancelSeriesLoads(seriesUID: string): void {
    // Find all requests for this series
    const imageIds: string[] = [];

    this.loadQueues.forEach(queue => {
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].seriesUID === seriesUID) {
          imageIds.push(queue[i].imageId);
          queue.splice(i, 1);
        }
      }
    });

    this.activeLoads.forEach((state, imageId) => {
      if (state.status !== 'loaded' && imageIds.includes(imageId)) {
        this.cancelImageLoad(imageId);
      }
    });

    this.triggerEvent('series:cancelled', { seriesUID, imageIds });
  }

  /**
   * Get loading state for an image
   */
  public getLoadingState(imageId: string): LoadingState | null {
    return this.activeLoads.get(imageId) || null;
  }

  /**
   * Get queue status
   */
  public getQueueStatus(): {
    priority: LoadPriority;
    count: number;
    nextImage?: string;
  }[] {
    return Array.from(this.loadQueues.entries()).map(([priority, queue]) => ({
      priority,
      count: queue.length,
      nextImage: queue[0]?.imageId,
    }));
  }

  /**
   * Clear all queues
   */
  public clearQueues(): void {
    this.loadQueues.forEach(queue => queue.length = 0);
    this.cancelledRequests.clear();

    this.triggerEvent('queues:cleared', {});
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ProgressiveLoadConfig>): void {
    this.config = { ...this.config, ...config };
    this.triggerEvent('config:updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  public getConfig(): ProgressiveLoadConfig {
    return { ...this.config };
  }

  /**
   * Cleanup and destroy
   */
  public destroy(): void {
    // Cancel all loads
    this.activeLoads.forEach((_, imageId) => {
      this.cancelImageLoad(imageId);
    });

    // Terminate workers
    this.loadingWorkers.forEach(worker => {
      worker.terminate();
    });

    // Clear timeouts
    this.retryTimeouts.forEach(timeoutId => {
      clearTimeout(timeoutId);
    });

    // Clear data
    this.loadQueues.clear();
    this.activeLoads.clear();
    this.loadingWorkers.length = 0;
    this.cancelledRequests.clear();
    this.retryTimeouts.clear();

    ProgressiveImageLoader.instance = null;
  }
}

// Export singleton instance
export const progressiveImageLoader = ProgressiveImageLoader.getInstance();
