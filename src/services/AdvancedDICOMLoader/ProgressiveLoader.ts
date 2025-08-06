/**
 * Progressive Loading System
 * Implements chunk-based loading with priority queues for large DICOM datasets
 */

import { EventEmitter } from 'events';
import { log } from '../../utils/logger';
import type { LoadOptions } from '../AdvancedDICOMLoader';

// ===== Progressive Loading Configuration =====

export interface ProgressiveLoadingConfig {
  chunkSize: number; // Number of images per chunk
  maxConcurrentChunks: number; // Maximum concurrent chunk loads
  priorityLevels: number; // Number of priority levels (1-N)
  preloadDistance: number; // Distance for predictive preloading
  memoryThreshold: number; // Memory threshold in MB
  adaptiveChunkSize: boolean; // Dynamically adjust chunk size
  networkAdaptation: boolean; // Adapt to network conditions
  cacheStrategy: 'lru' | 'priority' | 'hybrid';
}

export const DEFAULT_PROGRESSIVE_CONFIG: ProgressiveLoadingConfig = {
  chunkSize: 10,
  maxConcurrentChunks: 3,
  priorityLevels: 5,
  preloadDistance: 20,
  memoryThreshold: 512, // 512MB
  adaptiveChunkSize: true,
  networkAdaptation: true,
  cacheStrategy: 'hybrid',
};

// ===== Priority Queue Implementation =====

export enum LoadPriority {
  CRITICAL = 1,   // Currently viewing/needed immediately
  HIGH = 2,       // Likely to be viewed soon
  NORMAL = 3,     // Standard loading priority
  LOW = 4,        // Background/prefetch
  IDLE = 5,       // Load when idle
}

export interface ProgressiveLoadRequest {
  id: string;
  imageIds: string[];
  priority: LoadPriority;
  chunkIndex: number;
  totalChunks: number;
  options?: LoadOptions;
  estimatedSize?: number;
  createdAt: number;
  timeout?: number;
  onProgress?: (progress: ChunkProgress) => void;
  onComplete?: (results: any[]) => void;
  onError?: (error: Error) => void;
}

export interface ChunkProgress {
  chunkId: string;
  chunkIndex: number;
  totalChunks: number;
  loadedImages: number;
  totalImages: number;
  bytesLoaded: number;
  totalBytes: number;
  estimatedTimeRemaining: number;
  networkSpeed: number; // bytes/second
  status: 'pending' | 'loading' | 'completed' | 'error' | 'cancelled';
  error?: Error;
}

export interface LoadingSession {
  sessionId: string;
  chunks: ProgressiveLoadRequest[];
  currentPosition: number;
  totalImages: number;
  strategy: LoadingStrategy;
  metadata: {
    studyUID: string;
    seriesUID: string;
    modality: string;
  };
  createdAt: number;
  lastAccessed: number;
}

export type LoadingStrategy = 'sequential' | 'adaptive' | 'priority-based' | 'predictive';

// ===== Progressive Loader Implementation =====

export class ProgressiveLoader extends EventEmitter {
  private config: ProgressiveLoadingConfig;
  private priorityQueues: Map<LoadPriority, ProgressiveLoadRequest[]> = new Map();
  private activeChunks = new Map<string, AbortController>();
  private completedChunks = new Map<string, any[]>();
  private chunkProgress = new Map<string, ChunkProgress>();
  private loadingSessions = new Map<string, LoadingSession>();
  private networkMonitor: NetworkMonitor;
  private memoryMonitor: MemoryMonitor;
  private isProcessing = false;
  private processingInterval?: NodeJS.Timeout;

  constructor(config: Partial<ProgressiveLoadingConfig> = {}) {
    super();
    this.config = { ...DEFAULT_PROGRESSIVE_CONFIG, ...config };
    this.initializePriorityQueues();
    this.networkMonitor = new NetworkMonitor();
    this.memoryMonitor = new MemoryMonitor(this.config.memoryThreshold);
    this.startProcessingLoop();

    log.info('Progressive Loader initialized', {
      component: 'ProgressiveLoader',
      metadata: this.config,
    });
  }

  private initializePriorityQueues(): void {
    for (let priority = 1; priority <= this.config.priorityLevels; priority++) {
      this.priorityQueues.set(priority as LoadPriority, []);
    }
  }

  private startProcessingLoop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.processingInterval = setInterval(() => {
      if (!this.isProcessing) {
        this.processQueue();
      }
    }, 100) as NodeJS.Timeout; // Check every 100ms
  }

  // ===== Session Management =====

  public createLoadingSession(
    sessionId: string,
    imageIds: string[],
    metadata: {
      studyUID: string;
      seriesUID: string;
      modality: string;
    },
    strategy: LoadingStrategy = 'adaptive',
  ): string {
    const chunks = this.createChunks(imageIds, sessionId, strategy);

    const session: LoadingSession = {
      sessionId,
      chunks,
      currentPosition: 0,
      totalImages: imageIds.length,
      strategy,
      metadata,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    };

    this.loadingSessions.set(sessionId, session);

    log.info('Loading session created', {
      component: 'ProgressiveLoader',
      metadata: {
        sessionId,
        totalImages: imageIds.length,
        totalChunks: chunks.length,
        strategy,
      },
    });

    return sessionId;
  }

  private createChunks(
    imageIds: string[],
    sessionId: string,
    strategy: LoadingStrategy,
  ): ProgressiveLoadRequest[] {
    const chunks: ProgressiveLoadRequest[] = [];
    let chunkSize = this.config.chunkSize;

    // Adaptive chunk sizing based on strategy and conditions
    if (this.config.adaptiveChunkSize) {
      chunkSize = this.calculateOptimalChunkSize(imageIds.length, strategy);
    }

    const totalChunks = Math.ceil(imageIds.length / chunkSize);

    for (let i = 0; i < imageIds.length; i += chunkSize) {
      const chunkImageIds = imageIds.slice(i, i + chunkSize);
      const chunkIndex = Math.floor(i / chunkSize);

      const priority = this.calculateChunkPriority(chunkIndex, totalChunks, strategy);

      const chunk: ProgressiveLoadRequest = {
        id: `${sessionId}-chunk-${chunkIndex}`,
        imageIds: chunkImageIds,
        priority,
        chunkIndex,
        totalChunks,
        estimatedSize: chunkImageIds.length * 512 * 1024, // Rough estimate
        createdAt: Date.now(),
        timeout: 30000, // 30 second timeout per chunk
      };

      chunks.push(chunk);
    }

    return chunks;
  }

  private calculateOptimalChunkSize(totalImages: number, strategy: LoadingStrategy): number {
    const baseChunkSize = this.config.chunkSize;
    const networkSpeed = this.networkMonitor.getAverageSpeed();
    const memoryUsage = this.memoryMonitor.getCurrentUsage();

    let multiplier = 1;

    // Adjust based on network speed
    if (this.config.networkAdaptation) {
      if (networkSpeed > 10 * 1024 * 1024) { // > 10 MB/s
        multiplier *= 1.5;
      } else if (networkSpeed < 1 * 1024 * 1024) { // < 1 MB/s
        multiplier *= 0.5;
      }
    }

    // Adjust based on memory usage
    if (memoryUsage > 0.8) { // > 80% memory usage
      multiplier *= 0.6;
    } else if (memoryUsage < 0.4) { // < 40% memory usage
      multiplier *= 1.3;
    }

    // Strategy-based adjustments
    switch (strategy) {
      case 'sequential':
        multiplier *= 0.8; // Smaller chunks for better progress feedback
        break;
      case 'predictive':
        multiplier *= 1.2; // Larger chunks for efficiency
        break;
      case 'priority-based':
        multiplier *= 1.0; // Keep default
        break;
      case 'adaptive':
        // Already handled above
        break;
    }

    const adjustedSize = Math.max(1, Math.floor(baseChunkSize * multiplier));
    const maxChunkSize = Math.min(50, Math.ceil(totalImages / 10)); // Cap at 50 or 10% of total

    return Math.min(adjustedSize, maxChunkSize);
  }

  private calculateChunkPriority(
    chunkIndex: number,
    totalChunks: number,
    strategy: LoadingStrategy,
  ): LoadPriority {
    switch (strategy) {
      case 'sequential':
        // First chunks get higher priority
        if (chunkIndex === 0) return LoadPriority.CRITICAL;
        if (chunkIndex === 1) return LoadPriority.HIGH;
        return LoadPriority.NORMAL;

      case 'priority-based': {
        // Distributed priority
        const section = Math.floor((chunkIndex / totalChunks) * 5);
        return Math.min(LoadPriority.IDLE, section + 1) as LoadPriority;
      }

      case 'predictive': {
        // Middle chunks get higher priority (assuming user will navigate there)
        const middleIndex = Math.floor(totalChunks / 2);
        const distance = Math.abs(chunkIndex - middleIndex);
        if (distance <= 1) return LoadPriority.HIGH;
        if (distance <= 3) return LoadPriority.NORMAL;
        return LoadPriority.LOW;
      }

      case 'adaptive':
      default:
        // Balanced approach
        if (chunkIndex < 2) return LoadPriority.HIGH;
        if (chunkIndex < totalChunks * 0.3) return LoadPriority.NORMAL;
        return LoadPriority.LOW;
    }
  }

  // ===== Queue Management =====

  public queueChunk(request: ProgressiveLoadRequest): void {
    const queue = this.priorityQueues.get(request.priority);
    if (!queue) {
      log.warn('Invalid priority level', {
        component: 'ProgressiveLoader',
        metadata: { priority: request.priority },
      });
      return;
    }

    // Insert maintaining priority order within the queue
    const insertIndex = queue.findIndex(r => r.createdAt > request.createdAt);
    if (insertIndex === -1) {
      queue.push(request);
    } else {
      queue.splice(insertIndex, 0, request);
    }

    // Initialize progress tracking
    this.chunkProgress.set(request.id, {
      chunkId: request.id,
      chunkIndex: request.chunkIndex,
      totalChunks: request.totalChunks,
      loadedImages: 0,
      totalImages: request.imageIds.length,
      bytesLoaded: 0,
      totalBytes: request.estimatedSize || 0,
      estimatedTimeRemaining: 0,
      networkSpeed: this.networkMonitor.getAverageSpeed(),
      status: 'pending',
    });

    this.emit('chunk-queued', request);
  }

  public queueSession(sessionId: string, priority: LoadPriority = LoadPriority.NORMAL): void {
    const session = this.loadingSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Queue all chunks with updated priority
    for (const chunk of session.chunks) {
      chunk.priority = priority;
      this.queueChunk(chunk);
    }

    log.info('Session queued for loading', {
      component: 'ProgressiveLoader',
      metadata: {
        sessionId,
        chunks: session.chunks.length,
        priority,
      },
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;

    try {
      // Check memory constraints
      if (this.memoryMonitor.isOverThreshold()) {
        await this.handleMemoryPressure();
      }

      // Process chunks by priority
      const activeCount = this.activeChunks.size;
      const maxConcurrent = this.config.maxConcurrentChunks;

      if (activeCount < maxConcurrent) {
        const availableSlots = maxConcurrent - activeCount;
        const requests = this.getNextRequests(availableSlots);

        for (const request of requests) {
          await this.processChunk(request);
        }
      }
    } catch (error) {
      log.error('Error in queue processing', {
        component: 'ProgressiveLoader',
      }, error as Error);
    } finally {
      this.isProcessing = false;
    }
  }

  private getNextRequests(count: number): ProgressiveLoadRequest[] {
    const requests: ProgressiveLoadRequest[] = [];

    // Process by priority (lower number = higher priority)
    for (let priority = 1; priority <= this.config.priorityLevels && requests.length < count; priority++) {
      const queue = this.priorityQueues.get(priority as LoadPriority);
      if (!queue || queue.length === 0) continue;

      while (queue.length > 0 && requests.length < count) {
        const request = queue.shift()!;
        requests.push(request);
      }
    }

    return requests;
  }

  private async processChunk(request: ProgressiveLoadRequest): Promise<void> {
    const abortController = new AbortController();
    this.activeChunks.set(request.id, abortController);

    // Update progress
    const progress = this.chunkProgress.get(request.id)!;
    progress.status = 'loading';
    this.chunkProgress.set(request.id, progress);

    try {
      const startTime = Date.now();
      this.networkMonitor.startTransfer(request.id);

      // Set up timeout
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, request.timeout || 30000);

      const results: any[] = [];

      // Load images in the chunk with progress tracking
      for (let i = 0; i < request.imageIds.length; i++) {
        if (abortController.signal.aborted) {
          throw new Error('Chunk loading cancelled');
        }

        // eslint-disable-next-line security/detect-object-injection -- Safe: i is a controlled loop index
        const imageId = request.imageIds[i];

        try {
          // Simulate image loading - in real implementation, this would call the actual loader
          await new Promise(resolve => setTimeout(resolve, 50)); // Placeholder

          const mockImage = {
            imageId,
            loaded: true,
            sizeInBytes: 512 * 1024, // 512KB estimate
          };

          results.push(mockImage);

          // Update progress
          progress.loadedImages = i + 1;
          progress.bytesLoaded += mockImage.sizeInBytes;

          const elapsed = Date.now() - startTime;
          const rate = progress.bytesLoaded / (elapsed / 1000); // bytes/second
          progress.networkSpeed = rate;
          progress.estimatedTimeRemaining = (progress.totalBytes - progress.bytesLoaded) / rate;

          this.chunkProgress.set(request.id, progress);
          this.emit('chunk-progress', progress);

          // Progress callback
          if (request.onProgress) {
            request.onProgress(progress);
          }

        } catch (imageError) {
          log.warn('Failed to load image in chunk', {
            component: 'ProgressiveLoader',
            metadata: { chunkId: request.id, imageId },
          }, imageError as Error);

          // Continue with other images in chunk
          results.push({ imageId, error: imageError, loaded: false });
        }
      }

      clearTimeout(timeoutId);
      this.networkMonitor.endTransfer(request.id, progress.bytesLoaded);

      // Mark chunk as completed
      progress.status = 'completed';
      this.chunkProgress.set(request.id, progress);
      this.completedChunks.set(request.id, results);

      // Success callback
      if (request.onComplete) {
        request.onComplete(results);
      }

      this.emit('chunk-completed', { chunkId: request.id, results, progress });

      log.info('Chunk completed successfully', {
        component: 'ProgressiveLoader',
        metadata: {
          chunkId: request.id,
          imagesLoaded: results.length,
          timeElapsed: Date.now() - startTime,
        },
      });

    } catch (error) {
      this.networkMonitor.endTransfer(request.id, 0);

      // Mark chunk as error
      progress.status = 'error';
      progress.error = error as Error;
      this.chunkProgress.set(request.id, progress);

      // Error callback
      if (request.onError) {
        request.onError(error as Error);
      }

      this.emit('chunk-error', { chunkId: request.id, error, progress });

      log.error('Chunk loading failed', {
        component: 'ProgressiveLoader',
        metadata: { chunkId: request.id },
      }, error as Error);

    } finally {
      this.activeChunks.delete(request.id);
    }
  }

  // ===== Memory Management =====

  private async handleMemoryPressure(): Promise<void> {
    log.warn('Memory pressure detected, clearing caches', {
      component: 'ProgressiveLoader',
      metadata: {
        currentUsage: this.memoryMonitor.getCurrentUsage(),
        threshold: this.config.memoryThreshold,
      },
    });

    // Clear oldest completed chunks based on strategy
    const sortedChunks = Array.from(this.completedChunks.entries())
      .sort((a, b) => {
        const progressA = this.chunkProgress.get(a[0]);
        const progressB = this.chunkProgress.get(b[0]);

        if (!progressA || !progressB) return 0;

        // Sort by last access time (oldest first)
        return progressA.chunkIndex - progressB.chunkIndex;
      });

    // Remove 25% of completed chunks
    const toRemove = Math.ceil(sortedChunks.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      // eslint-disable-next-line security/detect-object-injection -- Safe: i is a controlled loop index
      const [chunkId] = sortedChunks[i];
      this.completedChunks.delete(chunkId);
      this.emit('chunk-evicted', chunkId);
    }
  }

  // ===== Public API =====

  public async loadDataset(
    imageIds: string[],
    options: {
      sessionId?: string;
      strategy?: LoadingStrategy;
      priority?: LoadPriority;
      metadata?: {
        studyUID: string;
        seriesUID: string;
        modality: string;
      };
      onProgress?: (progress: LoadingSessionProgress) => void;
      onComplete?: (sessionId: string, results: Map<string, any[]>) => void;
    } = {},
  ): Promise<string> {
    const sessionId = options.sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const strategy = options.strategy || 'adaptive';
    const priority = options.priority || LoadPriority.NORMAL;

    const metadata = options.metadata || {
      studyUID: 'unknown',
      seriesUID: 'unknown',
      modality: 'unknown',
    };

    // Create loading session
    this.createLoadingSession(sessionId, imageIds, metadata, strategy);

    // Set up session progress tracking
    if (options.onProgress || options.onComplete) {
      this.setupSessionCallbacks(sessionId, options.onProgress, options.onComplete);
    }

    // Queue session for loading
    this.queueSession(sessionId, priority);

    return sessionId;
  }

  private setupSessionCallbacks(
    sessionId: string,
    onProgress?: (progress: LoadingSessionProgress) => void,
    onComplete?: (sessionId: string, results: Map<string, any[]>) => void,
  ): void {
    const session = this.loadingSessions.get(sessionId);
    if (!session) return;

    const totalChunks = session.chunks.length;

    const checkSessionProgress = () => {
      const allProgress = session.chunks.map(chunk => this.chunkProgress.get(chunk.id));
      const completed = allProgress.filter(p => p?.status === 'completed').length;
      const loading = allProgress.filter(p => p?.status === 'loading').length;
      const errors = allProgress.filter(p => p?.status === 'error').length;

      const totalImages = session.totalImages;
      const loadedImages = allProgress.reduce((sum, p) => sum + (p?.loadedImages || 0), 0);
      const totalBytes = allProgress.reduce((sum, p) => sum + (p?.totalBytes || 0), 0);
      const loadedBytes = allProgress.reduce((sum, p) => sum + (p?.bytesLoaded || 0), 0);

      const sessionProgress: LoadingSessionProgress = {
        sessionId,
        totalChunks,
        completedChunks: completed,
        loadingChunks: loading,
        errorChunks: errors,
        totalImages,
        loadedImages,
        totalBytes,
        loadedBytes,
        percentage: totalImages > 0 ? Math.round((loadedImages / totalImages) * 100) : 0,
        status: completed === totalChunks ? 'completed' : errors > 0 ? 'error' : 'loading',
      };

      if (onProgress) {
        onProgress(sessionProgress);
      }

      // Check if session is complete
      if (completed === totalChunks && onComplete) {
        const results = new Map<string, any[]>();
        for (const chunk of session.chunks) {
          const chunkResults = this.completedChunks.get(chunk.id);
          if (chunkResults) {
            results.set(chunk.id, chunkResults);
          }
        }
        onComplete(sessionId, results);
      }
    };

    // Listen for chunk events for this session
    const chunkHandler = (data: any) => {
      if (data.chunkId && data.chunkId.startsWith(sessionId)) {
        checkSessionProgress();
      }
    };

    this.on('chunk-completed', chunkHandler);
    this.on('chunk-error', chunkHandler);
    this.on('chunk-progress', chunkHandler);
  }

  public cancelSession(sessionId: string): void {
    const session = this.loadingSessions.get(sessionId);
    if (!session) return;

    // Cancel active chunks
    for (const chunk of session.chunks) {
      const controller = this.activeChunks.get(chunk.id);
      if (controller) {
        controller.abort();
      }

      // Update progress
      const progress = this.chunkProgress.get(chunk.id);
      if (progress) {
        progress.status = 'cancelled';
        this.chunkProgress.set(chunk.id, progress);
      }
    }

    // Remove from queues
    for (const queue of this.priorityQueues.values()) {
      for (let i = queue.length - 1; i >= 0; i--) {
        // eslint-disable-next-line security/detect-object-injection -- Safe: i is a controlled loop index
        if (queue[i].id.startsWith(sessionId)) {
          queue.splice(i, 1);
        }
      }
    }

    this.emit('session-cancelled', sessionId);

    log.info('Session cancelled', {
      component: 'ProgressiveLoader',
      metadata: { sessionId },
    });
  }

  public getSessionProgress(sessionId: string): LoadingSessionProgress | null {
    const session = this.loadingSessions.get(sessionId);
    if (!session) return null;

    const allProgress = session.chunks.map(chunk => this.chunkProgress.get(chunk.id));
    const completed = allProgress.filter(p => p?.status === 'completed').length;
    const loading = allProgress.filter(p => p?.status === 'loading').length;
    const errors = allProgress.filter(p => p?.status === 'error').length;

    const totalImages = session.totalImages;
    const loadedImages = allProgress.reduce((sum, p) => sum + (p?.loadedImages || 0), 0);
    const totalBytes = allProgress.reduce((sum, p) => sum + (p?.totalBytes || 0), 0);
    const loadedBytes = allProgress.reduce((sum, p) => sum + (p?.bytesLoaded || 0), 0);

    return {
      sessionId,
      totalChunks: session.chunks.length,
      completedChunks: completed,
      loadingChunks: loading,
      errorChunks: errors,
      totalImages,
      loadedImages,
      totalBytes,
      loadedBytes,
      percentage: totalImages > 0 ? Math.round((loadedImages / totalImages) * 100) : 0,
      status: completed === session.chunks.length ? 'completed' : errors > 0 ? 'error' : 'loading',
    };
  }

  public dispose(): void {
    // Stop processing loop
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    // Cancel all active chunks
    for (const [, controller] of this.activeChunks) {
      controller.abort();
    }

    // Clear all data structures
    this.priorityQueues.clear();
    this.activeChunks.clear();
    this.completedChunks.clear();
    this.chunkProgress.clear();
    this.loadingSessions.clear();

    // Dispose monitors
    this.networkMonitor.dispose();
    this.memoryMonitor.dispose();

    // Remove all listeners
    this.removeAllListeners();

    log.info('Progressive Loader disposed', {
      component: 'ProgressiveLoader',
    });
  }
}

// ===== Supporting Classes =====

export interface LoadingSessionProgress {
  sessionId: string;
  totalChunks: number;
  completedChunks: number;
  loadingChunks: number;
  errorChunks: number;
  totalImages: number;
  loadedImages: number;
  totalBytes: number;
  loadedBytes: number;
  percentage: number;
  status: 'pending' | 'loading' | 'completed' | 'error' | 'cancelled';
}

class NetworkMonitor {
  private transfers = new Map<string, { startTime: number; bytesTransferred: number }>();
  private speedHistory: number[] = [];
  private maxHistory = 10;

  public startTransfer(id: string): void {
    this.transfers.set(id, {
      startTime: Date.now(),
      bytesTransferred: 0,
    });
  }

  public endTransfer(id: string, bytesTransferred: number): void {
    const transfer = this.transfers.get(id);
    if (!transfer) return;

    const duration = Date.now() - transfer.startTime;
    const speed = bytesTransferred / (duration / 1000); // bytes/second

    this.speedHistory.push(speed);
    if (this.speedHistory.length > this.maxHistory) {
      this.speedHistory.shift();
    }

    this.transfers.delete(id);
  }

  public getAverageSpeed(): number {
    if (this.speedHistory.length === 0) return 1024 * 1024; // 1MB/s default

    const sum = this.speedHistory.reduce((a, b) => a + b, 0);
    return sum / this.speedHistory.length;
  }

  public dispose(): void {
    this.transfers.clear();
    this.speedHistory = [];
  }
}

class MemoryMonitor {
  private checkInterval?: NodeJS.Timeout;

  // eslint-disable-next-line no-useless-constructor -- Constructor required for initialization
  constructor(_thresholdMB: number) {
    // threshold is no longer used in the current implementation
  }

  public getCurrentUsage(): number {
    // Simple memory usage estimation
    // In a real implementation, this would use performance.memory or similar
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / memory.totalJSHeapSize;
    }
    return 0.5; // Default assumption
  }

  public isOverThreshold(): boolean {
    return this.getCurrentUsage() > 0.8; // 80% threshold
  }

  public dispose(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }
}

// Singleton instance
export const progressiveLoader = new ProgressiveLoader();
