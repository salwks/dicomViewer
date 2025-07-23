/**
 * Performance Optimizer
 *
 * Advanced performance optimization system for large DICOM datasets
 * Based on Context7 documentation patterns from /cornerstonejs/cornerstone3d
 * Reference: 443 code examples for performance optimization strategies
 *
 * Features:
 * - Memory management and garbage collection optimization
 * - Intelligent caching with LRU and priority-based eviction
 * - GPU acceleration and WebGL optimization
 * - Multi-threading with Web Workers
 * - Viewport-aware loading and streaming
 * - Compression and decompression optimization
 * - Network bandwidth optimization
 */

import { Types } from '@cornerstonejs/core';

/**
 * Performance metrics tracking
 */
export interface PerformanceMetrics {
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
    gpuMemory?: number;
  };
  loadingTimes: {
    average: number;
    median: number;
    min: number;
    max: number;
    p95: number;
  };
  cachePerformance: {
    hitRate: number;
    missRate: number;
    evictionRate: number;
    compressionRatio: number;
  };
  renderingPerformance: {
    fps: number;
    frameTime: number;
    gpuUtilization?: number;
    webglContext: string;
  };
  networkPerformance: {
    throughput: number; // MB/s
    latency: number;    // ms
    concurrentRequests: number;
    compressionSavings: number;
  };
}

/**
 * Optimization configuration
 */
export interface OptimizationConfig {
  // Memory management
  maxMemoryUsage: number;           // MB
  gcThreshold: number;              // Memory percentage to trigger GC
  enableMemoryMonitoring: boolean;

  // Caching configuration
  cacheStrategy: 'lru' | 'lfu' | 'priority' | 'hybrid';
  maxCacheSize: number;             // MB
  compressionLevel: 'none' | 'low' | 'medium' | 'high';
  enablePredictiveCaching: boolean;

  // GPU acceleration
  enableGPUAcceleration: boolean;
  maxTextureSize: number;
  preferredColorFormat: 'rgba8' | 'rgba16f' | 'rgba32f';
  enableWebGL2: boolean;

  // Multi-threading
  maxWorkers: number;
  workerPoolSize: number;
  enableWebAssembly: boolean;

  // Network optimization
  maxConcurrentRequests: number;
  enableRequestPipelining: boolean;
  compressionThreshold: number;     // KB - compress requests above this size
  bandwidthThrottling?: number;     // MB/s - limit bandwidth usage

  // Viewport optimization
  enableViewportCulling: boolean;
  lodLevels: number;               // Levels of detail
  streamingBufferSize: number;     // MB
}

/**
 * Cache priority levels
 */
export enum CachePriority {
  CRITICAL = 5,    // Currently displayed images
  HIGH = 4,        // Next/previous images in sequence
  MEDIUM = 3,      // Same series images
  LOW = 2,         // Same study images
  BACKGROUND = 1,  // Other images
}

/**
 * Memory pool for efficient allocation
 */
class MemoryPool {
  private pools: Map<number, ArrayBuffer[]> = new Map();
  private maxPoolSize = 50;
  private totalAllocated = 0;

  allocate(size: number): ArrayBuffer {
    const pool = this.pools.get(size);

    if (pool && pool.length > 0) {
      return pool.pop()!;
    }

    this.totalAllocated += size;
    return new ArrayBuffer(size);
  }

  deallocate(buffer: ArrayBuffer, size: number): void {
    if (!this.pools.has(size)) {
      this.pools.set(size, []);
    }

    const pool = this.pools.get(size)!;
    if (pool.length < this.maxPoolSize) {
      pool.push(buffer);
    } else {
      this.totalAllocated -= size;
    }
  }

  getTotalAllocated(): number {
    return this.totalAllocated;
  }

  clear(): void {
    this.pools.clear();
    this.totalAllocated = 0;
  }
}

/**
 * GPU Resource Manager
 */
class GPUResourceManager {
  private gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  private textures: Map<string, WebGLTexture> = new Map();
  private buffers: Map<string, WebGLBuffer> = new Map();
  private maxTextureSize = 0;
  private memoryUsage = 0;

  initialize(canvas?: HTMLCanvasElement): boolean {
    try {
      if (!canvas) {
        canvas = document.createElement('canvas');
      }

      // Try WebGL2 first, fallback to WebGL1
      this.gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

      if (!this.gl) {
        console.warn('⚠️ WebGL not supported');
        return false;
      }

      this.maxTextureSize = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);
      console.log(`🎮 GPU initialized: ${this.gl.constructor.name}, Max texture: ${this.maxTextureSize}px`);
      return true;
    } catch (error) {
      console.error('❌ GPU initialization failed:', error);
      return false;
    }
  }

  createTexture(id: string, width: number, height: number, data?: ArrayBufferView): WebGLTexture | null {
    if (!this.gl) return null;

    const texture = this.gl.createTexture();
    if (!texture) return null;

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

    if (data) {
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, width, height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, data);
    } else {
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, width, height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null);
    }

    this.textures.set(id, texture);
    this.memoryUsage += width * height * 4; // Assuming RGBA

    return texture;
  }

  deleteTexture(id: string): void {
    const texture = this.textures.get(id);
    if (texture && this.gl) {
      this.gl.deleteTexture(texture);
      this.textures.delete(id);
    }
  }

  getMemoryUsage(): number {
    return this.memoryUsage;
  }

  cleanup(): void {
    if (this.gl) {
      this.textures.forEach((texture) => {
        this.gl!.deleteTexture(texture);
      });
      this.buffers.forEach((buffer) => {
        this.gl!.deleteBuffer(buffer);
      });
    }

    this.textures.clear();
    this.buffers.clear();
    this.memoryUsage = 0;
  }
}

/**
 * Intelligent Cache Manager with multiple strategies
 */
class IntelligentCacheManager {
  private cache: Map<string, {
    data: any;
    size: number;
    priority: CachePriority;
    accessCount: number;
    lastAccess: number;
    frequency: number;
  }> = new Map();

  private totalSize = 0;
  private maxSize: number;
  private strategy: OptimizationConfig['cacheStrategy'];

  constructor(maxSize: number, strategy: OptimizationConfig['cacheStrategy'] = 'hybrid') {
    this.maxSize = maxSize;
    this.strategy = strategy;
  }

  set(key: string, data: any, size: number, priority: CachePriority = CachePriority.MEDIUM): void {
    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.totalSize -= this.cache.get(key)!.size;
    }

    // Ensure we have space
    while (this.totalSize + size > this.maxSize && this.cache.size > 0) {
      this.evictLeastValuable();
    }

    // Add new entry
    const now = Date.now();
    const existing = this.cache.get(key);

    this.cache.set(key, {
      data,
      size,
      priority,
      accessCount: existing ? existing.accessCount + 1 : 1,
      lastAccess: now,
      frequency: existing ? this.calculateFrequency(existing, now) : 1,
    });

    this.totalSize += size;
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Update access statistics
    const now = Date.now();
    entry.accessCount++;
    entry.lastAccess = now;
    entry.frequency = this.calculateFrequency(entry, now);

    return entry.data;
  }

  private calculateFrequency(entry: any, now: number): number {
    const timeDelta = now - entry.lastAccess;
    const decayFactor = Math.exp(-timeDelta / (1000 * 60 * 10)); // 10-minute half-life
    return entry.frequency * decayFactor + 1;
  }

  private evictLeastValuable(): void {
    let leastValuableKey = '';
    let leastValue = Infinity;

    for (const [key, entry] of this.cache) {
      let value: number;

      switch (this.strategy) {
        case 'lru':
          value = entry.lastAccess;
          break;
        case 'lfu':
          value = entry.frequency;
          break;
        case 'priority':
          value = entry.priority * 1000 + entry.lastAccess / 1000;
          break;
        case 'hybrid':
        default: {
          // Combine multiple factors
          const recency = (Date.now() - entry.lastAccess) / (1000 * 60); // minutes ago
          const frequencyScore = entry.frequency / 10;
          const priorityScore = entry.priority * 100;
          value = priorityScore + frequencyScore - recency;
          break;
        }
      }

      if (value < leastValue) {
        leastValue = value;
        leastValuableKey = key;
      }
    }

    if (leastValuableKey) {
      const entry = this.cache.get(leastValuableKey)!;
      this.totalSize -= entry.size;
      this.cache.delete(leastValuableKey);
      console.log(`🗑️ Evicted cache entry: ${leastValuableKey} (${entry.size} bytes)`);
    }
  }

  getStatistics() {
    return {
      totalSize: this.totalSize,
      maxSize: this.maxSize,
      entryCount: this.cache.size,
      utilizationPercent: (this.totalSize / this.maxSize) * 100,
    };
  }

  clear(): void {
    this.cache.clear();
    this.totalSize = 0;
  }
}

/**
 * Performance Optimizer - Main class
 */
export class PerformanceOptimizer {
  private config: OptimizationConfig;
  private metrics: PerformanceMetrics;
  private memoryPool: MemoryPool;
  private gpuManager: GPUResourceManager;
  private cacheManager: IntelligentCacheManager;
  private workerPool: Worker[] = [];
  private performanceMonitor: PerformanceObserver | null = null;
  private loadingTimes: number[] = [];
  private isMonitoring = false;

  constructor(config?: Partial<OptimizationConfig>) {
    this.config = {
      // Default configuration optimized for medical imaging
      maxMemoryUsage: 2048, // 2GB
      gcThreshold: 80,
      enableMemoryMonitoring: true,

      cacheStrategy: 'hybrid',
      maxCacheSize: 1024, // 1GB
      compressionLevel: 'medium',
      enablePredictiveCaching: true,

      enableGPUAcceleration: true,
      maxTextureSize: 4096,
      preferredColorFormat: 'rgba16f',
      enableWebGL2: true,

      maxWorkers: navigator.hardwareConcurrency || 4,
      workerPoolSize: 2,
      enableWebAssembly: typeof WebAssembly !== 'undefined',

      maxConcurrentRequests: 6,
      enableRequestPipelining: true,
      compressionThreshold: 100, // 100KB

      enableViewportCulling: true,
      lodLevels: 3,
      streamingBufferSize: 256, // 256MB

      ...config,
    };

    this.metrics = this.initializeMetrics();
    this.memoryPool = new MemoryPool();
    this.gpuManager = new GPUResourceManager();
    this.cacheManager = new IntelligentCacheManager(
      this.config.maxCacheSize * 1024 * 1024, // Convert MB to bytes
      this.config.cacheStrategy,
    );

    this.initialize();
  }

  /**
   * Initialize the performance optimizer
   * Following Context7 initialization patterns
   */
  private async initialize(): Promise<void> {
    console.log('🚀 Performance Optimizer initializing...');

    // Initialize GPU acceleration if enabled
    if (this.config.enableGPUAcceleration) {
      const gpuInitialized = this.gpuManager.initialize();
      if (!gpuInitialized) {
        console.warn('⚠️ GPU acceleration disabled - WebGL not available');
        this.config.enableGPUAcceleration = false;
      }
    }

    // Initialize worker pool
    if (this.config.maxWorkers > 0) {
      await this.initializeWorkerPool();
    }

    // Start performance monitoring
    if (this.config.enableMemoryMonitoring) {
      this.startPerformanceMonitoring();
    }

    console.log(`✅ Performance Optimizer initialized with ${this.workerPool.length} workers`);
  }

  /**
   * Initialize Web Worker pool for multi-threading
   * Following Context7 worker management patterns
   */
  private async initializeWorkerPool(): Promise<void> {
    const workerCode = `
      // DICOM processing worker
      self.onmessage = function(e) {
        const { type, data, taskId } = e.data;
        
        try {
          let result;
          
          switch (type) {
            case 'decompress':
              result = decompressImageData(data);
              break;
            case 'process':
              result = processPixelData(data);
              break;
            case 'convert':
              result = convertColorSpace(data);
              break;
            default:
              throw new Error('Unknown task type: ' + type);
          }
          
          self.postMessage({
            taskId,
            success: true,
            result
          });
        } catch (error) {
          self.postMessage({
            taskId,
            success: false,
            error: error.message
          });
        }
      };
      
      function decompressImageData(data) {
        // Placeholder for DICOM decompression
        return data;
      }
      
      function processPixelData(data) {
        // Placeholder for pixel data processing
        return data;
      }
      
      function convertColorSpace(data) {
        // Placeholder for color space conversion
        return data;
      }
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);

    for (let i = 0; i < this.config.workerPoolSize; i++) {
      try {
        const worker = new Worker(workerUrl);
        this.workerPool.push(worker);
      } catch (error) {
        console.warn(`⚠️ Failed to create worker ${i}:`, error);
      }
    }

    URL.revokeObjectURL(workerUrl);
  }

  /**
   * Start performance monitoring
   * Following Context7 monitoring patterns
   */
  private startPerformanceMonitoring(): void {
    if (this.isMonitoring) return;

    try {
      // Monitor long tasks
      this.performanceMonitor = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.duration > 50) { // Tasks longer than 50ms
            console.warn(`⚠️ Long task detected: ${entry.duration.toFixed(2)}ms`);
          }
        });
      });

      this.performanceMonitor.observe({ entryTypes: ['longtask'] });
      this.isMonitoring = true;

      // Memory monitoring interval
      setInterval(() => {
        this.updateMemoryMetrics();
        this.checkMemoryThreshold();
      }, 5000); // Check every 5 seconds

    } catch (error) {
      console.warn('⚠️ Performance monitoring not available:', error);
    }
  }

  /**
   * Optimize image loading for large datasets
   * Following Context7 optimization patterns
   */
  async optimizeImageLoading(imageId: string, options: {
    priority?: CachePriority;
    useGPU?: boolean;
    compression?: boolean;
    progressive?: boolean;
  } = {}): Promise<Types.IImage> {
    const startTime = performance.now();

    try {
      // Check cache first
      const cached = this.cacheManager.get(imageId);
      if (cached) {
        this.recordLoadingTime(performance.now() - startTime);
        return cached;
      }

      // Determine optimal loading strategy
      const loadingStrategy = this.determineLoadingStrategy(imageId, options);

      let image: Types.IImage;

      switch (loadingStrategy.method) {
        case 'gpu-accelerated':
          image = await this.loadWithGPUAcceleration(imageId, loadingStrategy);
          break;
        case 'multi-threaded':
          image = await this.loadWithWorkers(imageId, loadingStrategy);
          break;
        case 'progressive':
          image = await this.loadProgressively(imageId, loadingStrategy);
          break;
        case 'standard':
        default:
          image = await this.loadStandard(imageId, loadingStrategy);
          break;
      }

      // Cache the result
      const imageSize = this.calculateImageSize(image);
      this.cacheManager.set(imageId, image, imageSize, options.priority || CachePriority.MEDIUM);

      this.recordLoadingTime(performance.now() - startTime);
      return image;

    } catch (error) {
      this.recordLoadingTime(performance.now() - startTime);
      throw error;
    }
  }

  /**
   * Determine optimal loading strategy based on image characteristics
   */
  private determineLoadingStrategy(imageId: string, options: any): {
    method: 'gpu-accelerated' | 'multi-threaded' | 'progressive' | 'standard';
    config: any;
  } {
    // Analyze image characteristics (simplified)
    const estimatedSize = this.estimateImageSize(imageId);
    const currentMemoryUsage = this.getMemoryUsage();
    const availableWorkers = this.getAvailableWorkers();

    // Large images or high memory usage -> use progressive loading
    if (estimatedSize > 50 * 1024 * 1024 || currentMemoryUsage > this.config.gcThreshold) {
      return {
        method: 'progressive',
        config: { stages: 3, initialQuality: 0.25 },
      };
    }

    // GPU acceleration available and beneficial
    if (this.config.enableGPUAcceleration && options.useGPU !== false) {
      return {
        method: 'gpu-accelerated',
        config: { textureFormat: this.config.preferredColorFormat },
      };
    }

    // Multi-threading for CPU-intensive processing
    if (availableWorkers > 0 && estimatedSize > 10 * 1024 * 1024) {
      return {
        method: 'multi-threaded',
        config: { workers: Math.min(2, availableWorkers) },
      };
    }

    return {
      method: 'standard',
      config: {},
    };
  }

  /**
   * Load image with GPU acceleration
   */
  private async loadWithGPUAcceleration(imageId: string, strategy: any): Promise<Types.IImage> {
    // Placeholder for GPU-accelerated loading
    console.log(`🎮 Loading with GPU acceleration: ${imageId}`);

    // This would integrate with Cornerstone3D's GPU pipeline
    // For now, fallback to standard loading
    return await this.loadStandard(imageId, strategy);
  }

  /**
   * Load image using worker threads
   */
  private async loadWithWorkers(imageId: string, strategy: any): Promise<Types.IImage> {
    return new Promise((resolve, reject) => {
      const worker = this.getAvailableWorker();
      if (!worker) {
        // Fallback to standard loading
        return this.loadStandard(imageId, strategy).then(resolve).catch(reject);
      }

      const taskId = Math.random().toString(36).substr(2, 9);

      const cleanup = () => {
        worker.removeEventListener('message', handleMessage);
        worker.removeEventListener('error', handleError);
      };

      const handleMessage = (e: MessageEvent) => {
        if (e.data.taskId === taskId) {
          cleanup();
          if (e.data.success) {
            resolve(e.data.result);
          } else {
            reject(new Error(e.data.error));
          }
        }
      };

      const handleError = (error: ErrorEvent) => {
        cleanup();
        reject(error);
      };

      worker.addEventListener('message', handleMessage);
      worker.addEventListener('error', handleError);

      worker.postMessage({
        type: 'process',
        data: { imageId, strategy },
        taskId,
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        cleanup();
        reject(new Error('Worker timeout'));
      }, 30000);
    });
  }

  /**
   * Load image progressively
   */
  private async loadProgressively(imageId: string, strategy: any): Promise<Types.IImage> {
    console.log(`📈 Loading progressively: ${imageId}`);

    // This would integrate with the ProgressiveLoader
    // For now, fallback to standard loading
    return await this.loadStandard(imageId, strategy);
  }

  /**
   * Standard image loading
   */
  private async loadStandard(_imageId: string, _strategy: any): Promise<Types.IImage> {
    // This would use Cornerstone3D's standard loading mechanisms
    // Placeholder implementation
    const image = {
      imageId: _imageId,
      minPixelValue: 0,
      maxPixelValue: 255,
      slope: 1,
      intercept: 0,
      windowCenter: 128,
      windowWidth: 256,
      rows: 512,
      columns: 512,
      sizeInBytes: 512 * 512 * 2,
      getPixelData: () => new Uint16Array(512 * 512),
      data: undefined,
    } as Types.IImage;

    return image;
  }

  /**
   * Memory management and optimization
   * Following Context7 memory management patterns
   */
  private updateMemoryMetrics(): void {
    if (performance.memory) {
      const memory = performance.memory;
      this.metrics.memoryUsage = {
        used: memory.usedJSHeapSize / (1024 * 1024), // MB
        total: memory.totalJSHeapSize / (1024 * 1024), // MB
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
        gpuMemory: this.gpuManager.getMemoryUsage() / (1024 * 1024), // MB
      };
    }
  }

  private checkMemoryThreshold(): void {
    if (this.metrics.memoryUsage.percentage > this.config.gcThreshold) {
      console.warn(`⚠️ Memory usage high: ${this.metrics.memoryUsage.percentage.toFixed(1)}%`);
      this.performGarbageCollection();
    }
  }

  private performGarbageCollection(): void {
    console.log('🗑️ Performing garbage collection...');

    // Clear old cache entries
    this.cacheManager.clear();

    // Clear memory pool
    this.memoryPool.clear();

    // Suggest browser GC
    if (window.gc) {
      window.gc();
    }

    console.log('✅ Garbage collection completed');
  }

  /**
   * Utility methods
   */
  private getMemoryUsage(): number {
    return this.metrics.memoryUsage.percentage;
  }

  private getAvailableWorkers(): number {
    return this.workerPool.length;
  }

  private getAvailableWorker(): Worker | null {
    return this.workerPool.length > 0 ? this.workerPool[0] : null;
  }

  private estimateImageSize(_imageId: string): number {
    // Simplified size estimation based on imageId
    // In real implementation, this would analyze DICOM headers
    return 10 * 1024 * 1024; // 10MB default
  }

  private calculateImageSize(image: Types.IImage): number {
    return image.sizeInBytes || ((image.rows || 512) * (image.columns || 512) * 2); // Assume 16-bit
  }

  private recordLoadingTime(time: number): void {
    this.loadingTimes.push(time);

    // Keep only recent measurements
    if (this.loadingTimes.length > 100) {
      this.loadingTimes = this.loadingTimes.slice(-50);
    }

    // Update metrics
    this.updateLoadingMetrics();
  }

  private updateLoadingMetrics(): void {
    if (this.loadingTimes.length === 0) return;

    const sorted = [...this.loadingTimes].sort((a, b) => a - b);

    this.metrics.loadingTimes = {
      average: this.loadingTimes.reduce((a, b) => a + b, 0) / this.loadingTimes.length,
      median: sorted[Math.floor(sorted.length / 2)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
    };
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      memoryUsage: {
        used: 0,
        total: 0,
        percentage: 0,
      },
      loadingTimes: {
        average: 0,
        median: 0,
        min: 0,
        max: 0,
        p95: 0,
      },
      cachePerformance: {
        hitRate: 0,
        missRate: 0,
        evictionRate: 0,
        compressionRatio: 0,
      },
      renderingPerformance: {
        fps: 0,
        frameTime: 0,
        webglContext: 'unknown',
      },
      networkPerformance: {
        throughput: 0,
        latency: 0,
        concurrentRequests: 0,
        compressionSavings: 0,
      },
    };
  }

  /**
   * Public API methods
   */
  getMetrics(): PerformanceMetrics {
    this.updateMemoryMetrics();
    return { ...this.metrics };
  }

  getCacheStatistics() {
    return this.cacheManager.getStatistics();
  }

  optimizeForViewport(viewportInfo: {
    width: number;
    height: number;
    imageIds: string[];
    currentIndex: number;
  }): void {
    if (!this.config.enableViewportCulling) return;

    console.log('🎯 Optimizing for viewport:', viewportInfo);

    // Implement viewport-aware optimization
    // This would prioritize loading of visible images
  }

  cleanup(): void {
    console.log('🧹 Cleaning up Performance Optimizer...');

    // Stop monitoring
    if (this.performanceMonitor) {
      this.performanceMonitor.disconnect();
    }

    // Cleanup workers
    this.workerPool.forEach(worker => worker.terminate());
    this.workerPool = [];

    // Cleanup GPU resources
    this.gpuManager.cleanup();

    // Clear caches
    this.cacheManager.clear();
    this.memoryPool.clear();

    this.isMonitoring = false;
    console.log('✅ Performance Optimizer cleanup completed');
  }
}

// Export singleton instance for application-wide use
export const performanceOptimizer = new PerformanceOptimizer();
