/**
 * Intelligent Cache System
 * Advanced caching strategy for DICOM images with LRU, priority-based eviction,
 * and predictive preloading
 */

import { CachePriority } from './progressiveImageLoader';

export interface CacheEntry {
  imageId: string;
  data: any;
  size: number;
  priority: CachePriority;
  accessCount: number;
  lastAccessed: number;
  created: number;
  seriesUID: string;
  studyUID: string;
  metadata?: any;
  compressed?: boolean;
}

export interface CacheStats {
  totalSize: number;
  entryCount: number;
  hitRate: number;
  evictionCount: number;
  compressionRatio: number;
  averageAccessTime: number;
  memoryPressure: number;
}

export interface CacheConfig {
  maxSize: number;
  maxEntries: number;
  enableCompression: boolean;
  compressionThreshold: number;
  evictionStrategy: 'lru' | 'lfu' | 'hybrid';
  priorityWeights: Record<CachePriority, number>;
  preloadThreshold: number;
  memoryPressureThreshold: number;
  enablePredictive: boolean;
  accessPatternWindow: number;
}

export interface AccessPattern {
  imageId: string;
  frequency: number;
  lastAccess: number;
  predictedNext: string[];
  seriesPosition: number;
}

/**
 * Intelligent caching system with adaptive strategies
 */
export class IntelligentCache extends EventTarget {
  /**
   * Trigger custom event
   */
  private triggerEvent(type: string, detail: any): void {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
  private static instance: IntelligentCache | null = null;
  private config: CacheConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private accessOrder: string[] = [];
  private accessPatterns: Map<string, AccessPattern> = new Map();
  private stats: CacheStats;
  private compressionWorker: Worker | null = null;
  private cleanupInterval: number | null = null;
  private preloadQueue: Set<string> = new Set();

  private constructor(config: Partial<CacheConfig> = {}) {
    super();

    this.config = {
      maxSize: 500 * 1024 * 1024, // 500MB
      maxEntries: 1000,
      enableCompression: true,
      compressionThreshold: 1024 * 1024, // 1MB
      evictionStrategy: 'hybrid',
      priorityWeights: {
        [CachePriority.NEVER_EVICT]: 1000,
        [CachePriority.LOW_EVICT]: 100,
        [CachePriority.NORMAL_EVICT]: 10,
        [CachePriority.HIGH_EVICT]: 1,
      },
      preloadThreshold: 0.8, // 80% cache full
      memoryPressureThreshold: 0.9, // 90% memory usage
      enablePredictive: true,
      accessPatternWindow: 100, // Track last 100 accesses
      ...config,
    };

    this.stats = {
      totalSize: 0,
      entryCount: 0,
      hitRate: 0,
      evictionCount: 0,
      compressionRatio: 0,
      averageAccessTime: 0,
      memoryPressure: 0,
    };

    this.initializeCompression();
    this.startCleanupTimer();
  }

  public static getInstance(config?: Partial<CacheConfig>): IntelligentCache {
    if (!IntelligentCache.instance) {
      IntelligentCache.instance = new IntelligentCache(config);
    }
    return IntelligentCache.instance;
  }

  /**
   * Initialize compression worker
   */
  private initializeCompression(): void {
    if (!this.config.enableCompression || typeof Worker === 'undefined') {
      return;
    }

    try {
      const workerScript = this.createCompressionWorkerScript();
      const blob = new Blob([workerScript], { type: 'application/javascript' });
      this.compressionWorker = new Worker(URL.createObjectURL(blob));

      this.compressionWorker.onmessage = (event) => {
        this.handleCompressionResult(event.data);
      };

      this.compressionWorker.onerror = (error) => {
        console.warn('Compression worker error:', error);
      };
    } catch (error) {
      console.warn('Failed to create compression worker:', error);
    }
  }

  /**
   * Create compression worker script
   */
  private createCompressionWorkerScript(): string {
    return `
      // Simple compression simulation (in real implementation, use actual compression)
      self.onmessage = function(event) {
        const { type, imageId, data } = event.data;
        
        if (type === 'compress') {
          // Simulate compression
          const compressed = compressData(data);
          self.postMessage({
            type: 'compressed',
            imageId,
            compressedData: compressed,
            originalSize: data.length || data.byteLength || 0,
            compressedSize: compressed.length || compressed.byteLength || 0,
          });
        } else if (type === 'decompress') {
          // Simulate decompression
          const decompressed = decompressData(data);
          self.postMessage({
            type: 'decompressed',
            imageId,
            data: decompressed,
          });
        }
      };
      
      function compressData(data) {
        // Simulate compression by returning smaller data
        // In real implementation, use actual compression algorithm
        const compressionRatio = 0.6; // 60% of original size
        return new Uint8Array(Math.floor((data.length || data.byteLength) * compressionRatio));
      }
      
      function decompressData(compressedData) {
        // Simulate decompression
        return new Uint8Array(Math.floor((compressedData.length || compressedData.byteLength) / 0.6));
      }
    `;
  }

  /**
   * Handle compression worker results
   */
  private handleCompressionResult(result: any): void {
    const { type, imageId } = result;

    if (type === 'compressed') {
      this.updateCompressedEntry(imageId, result);
    } else if (type === 'decompressed') {
      this.triggerEvent('cache:decompressed', { imageId, data: result.data });
    }
  }

  /**
   * Update cache entry with compressed data
   */
  private updateCompressedEntry(imageId: string, result: any): void {
    const entry = this.cache.get(imageId);
    if (entry) {
      const sizeDiff = entry.size - result.compressedSize;

      entry.data = result.compressedData;
      entry.size = result.compressedSize;
      entry.compressed = true;

      this.stats.totalSize -= sizeDiff;
      this.updateCompressionRatio();

      this.triggerEvent('cache:compressed', {
        imageId,
        sizeSaved: sizeDiff,
        compressionRatio: result.originalSize / result.compressedSize,
      });
    }
  }

  /**
   * Store image in cache
   */
  public async store(
    imageId: string,
    data: any,
    metadata: {
      seriesUID: string;
      studyUID: string;
      priority?: CachePriority;
      size?: number;
    },
  ): Promise<void> {
    const size = metadata.size || this.estimateSize(data);
    const priority = metadata.priority || CachePriority.NORMAL_EVICT;

    // Check if we need to make space
    await this.ensureSpace(size);

    // Create cache entry
    const entry: CacheEntry = {
      imageId,
      data,
      size,
      priority,
      accessCount: 1,
      lastAccessed: Date.now(),
      created: Date.now(),
      seriesUID: metadata.seriesUID,
      studyUID: metadata.studyUID,
      metadata,
      compressed: false,
    };

    // Store in cache
    this.cache.set(imageId, entry);
    this.updateAccessOrder(imageId);
    this.updateStats();

    // Update access patterns
    this.updateAccessPattern(imageId);

    // Compress if needed
    if (this.shouldCompress(entry)) {
      this.compressEntry(imageId);
    }

    this.triggerEvent('cache:stored', { imageId, size, priority });

    // Trigger predictive preloading
    if (this.config.enablePredictive) {
      this.triggerPredictiveLoading(imageId);
    }
  }

  /**
   * Retrieve image from cache
   */
  public async get(imageId: string): Promise<any | null> {
    const entry = this.cache.get(imageId);

    if (!entry) {
      this.updateHitRate(false);
      return null;
    }

    // Update access information
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.updateAccessOrder(imageId);
    this.updateAccessPattern(imageId);

    // Decompress if needed
    if (entry.compressed && this.compressionWorker) {
      return new Promise((resolve) => {
        const handler = (event: MessageEvent) => {
          const { type, imageId: resultImageId, data } = event.data;
          if (type === 'decompressed' && resultImageId === imageId) {
            this.compressionWorker!.removeEventListener('message', handler);
            resolve(data);
          }
        };

        this.compressionWorker!.addEventListener('message', handler);
        this.compressionWorker!.postMessage({
          type: 'decompress',
          imageId,
          data: entry.data,
        });
      });
    }

    this.updateHitRate(true);
    this.triggerEvent('cache:hit', { imageId, accessCount: entry.accessCount });

    return entry.data;
  }

  /**
   * Check if image exists in cache
   */
  public has(imageId: string): boolean {
    return this.cache.has(imageId);
  }

  /**
   * Remove image from cache
   */
  public remove(imageId: string): boolean {
    const entry = this.cache.get(imageId);
    if (!entry) {
      return false;
    }

    this.cache.delete(imageId);
    this.removeFromAccessOrder(imageId);
    this.stats.totalSize -= entry.size;
    this.updateStats();

    this.triggerEvent('cache:removed', { imageId, size: entry.size });
    return true;
  }

  /**
   * Clear cache entries for a series
   */
  public clearSeries(seriesUID: string): number {
    let removedCount = 0;

    for (const [imageId, entry] of this.cache) {
      if (entry.seriesUID === seriesUID) {
        this.remove(imageId);
        removedCount++;
      }
    }

    this.triggerEvent('cache:series_cleared', { seriesUID, removedCount });
    return removedCount;
  }

  /**
   * Clear cache entries for a study
   */
  public clearStudy(studyUID: string): number {
    let removedCount = 0;

    for (const [imageId, entry] of this.cache) {
      if (entry.studyUID === studyUID) {
        this.remove(imageId);
        removedCount++;
      }
    }

    this.triggerEvent('cache:study_cleared', { studyUID, removedCount });
    return removedCount;
  }

  /**
   * Clear entire cache
   */
  public clear(): void {
    const entryCount = this.cache.size;

    this.cache.clear();
    this.accessOrder.length = 0;
    this.accessPatterns.clear();
    this.preloadQueue.clear();

    this.stats = {
      totalSize: 0,
      entryCount: 0,
      hitRate: 0,
      evictionCount: 0,
      compressionRatio: 0,
      averageAccessTime: 0,
      memoryPressure: 0,
    };

    this.triggerEvent('cache:cleared', { removedCount: entryCount });
  }

  /**
   * Ensure space for new entry
   */
  private async ensureSpace(requiredSize: number): Promise<void> {
    // Check size limit
    while (this.stats.totalSize + requiredSize > this.config.maxSize && this.cache.size > 0) {
      await this.evictEntry();
    }

    // Check entry count limit
    while (this.cache.size >= this.config.maxEntries && this.cache.size > 0) {
      await this.evictEntry();
    }
  }

  /**
   * Evict cache entry based on strategy
   */
  private async evictEntry(): Promise<void> {
    let victimImageId: string | null = null;

    switch (this.config.evictionStrategy) {
      case 'lru':
        victimImageId = this.findLRUVictim();
        break;
      case 'lfu':
        victimImageId = this.findLFUVictim();
        break;
      case 'hybrid':
        victimImageId = this.findHybridVictim();
        break;
    }

    if (victimImageId) {
      this.remove(victimImageId);
      this.stats.evictionCount++;

      this.triggerEvent('cache:evicted', {
        imageId: victimImageId,
        strategy: this.config.evictionStrategy,
      });
    }
  }

  /**
   * Find LRU (Least Recently Used) victim
   */
  private findLRUVictim(): string | null {
    let oldestTime = Date.now();
    let victim: string | null = null;

    for (const [imageId, entry] of this.cache) {
      if (entry.priority !== CachePriority.NEVER_EVICT && entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        victim = imageId;
      }
    }

    return victim;
  }

  /**
   * Find LFU (Least Frequently Used) victim
   */
  private findLFUVictim(): string | null {
    let lowestCount = Infinity;
    let victim: string | null = null;

    for (const [imageId, entry] of this.cache) {
      if (entry.priority !== CachePriority.NEVER_EVICT && entry.accessCount < lowestCount) {
        lowestCount = entry.accessCount;
        victim = imageId;
      }
    }

    return victim;
  }

  /**
   * Find hybrid victim (combines LRU, LFU, and priority)
   */
  private findHybridVictim(): string | null {
    let lowestScore = Infinity;
    let victim: string | null = null;
    const now = Date.now();

    for (const [imageId, entry] of this.cache) {
      if (entry.priority === CachePriority.NEVER_EVICT) {
        continue;
      }

      // Calculate hybrid score
      const timeFactor = (now - entry.lastAccessed) / 1000; // seconds since last access
      const frequencyFactor = 1 / (entry.accessCount + 1); // inverse frequency
      const priorityFactor = this.config.priorityWeights[entry.priority];
      const sizeFactor = entry.size / (1024 * 1024); // size in MB

      const score = (timeFactor * frequencyFactor * sizeFactor) / priorityFactor;

      if (score < lowestScore) {
        lowestScore = score;
        victim = imageId;
      }
    }

    return victim;
  }

  /**
   * Update access order for LRU tracking
   */
  private updateAccessOrder(imageId: string): void {
    // Remove from current position
    const index = this.accessOrder.indexOf(imageId);
    if (index >= 0) {
      this.accessOrder.splice(index, 1);
    }

    // Add to end (most recent)
    this.accessOrder.push(imageId);

    // Limit access order size
    if (this.accessOrder.length > this.config.accessPatternWindow) {
      this.accessOrder.shift();
    }
  }

  /**
   * Remove from access order
   */
  private removeFromAccessOrder(imageId: string): void {
    const index = this.accessOrder.indexOf(imageId);
    if (index >= 0) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Update access patterns for predictive loading
   */
  private updateAccessPattern(imageId: string): void {
    if (!this.config.enablePredictive) return;

    const pattern = this.accessPatterns.get(imageId) || {
      imageId,
      frequency: 0,
      lastAccess: 0,
      predictedNext: [],
      seriesPosition: 0,
    };

    pattern.frequency++;
    pattern.lastAccess = Date.now();

    // Analyze sequence patterns
    const recentAccesses = this.accessOrder.slice(-10);
    const currentIndex = recentAccesses.indexOf(imageId);

    if (currentIndex >= 0 && currentIndex < recentAccesses.length - 1) {
      const nextImageId = recentAccesses[currentIndex + 1];
      if (!pattern.predictedNext.includes(nextImageId)) {
        pattern.predictedNext.push(nextImageId);
      }
    }

    this.accessPatterns.set(imageId, pattern);
  }

  /**
   * Trigger predictive loading based on access patterns
   */
  private triggerPredictiveLoading(imageId: string): void {
    const pattern = this.accessPatterns.get(imageId);
    if (!pattern || this.getSpaceUtilization() < this.config.preloadThreshold) {
      return;
    }

    // Preload predicted next images
    pattern.predictedNext.forEach(nextImageId => {
      if (!this.cache.has(nextImageId) && !this.preloadQueue.has(nextImageId)) {
        this.preloadQueue.add(nextImageId);
        this.triggerEvent('cache:preload_requested', { imageId: nextImageId });
      }
    });
  }

  /**
   * Check if entry should be compressed
   */
  private shouldCompress(entry: CacheEntry): boolean {
    return this.config.enableCompression &&
           entry.size >= this.config.compressionThreshold &&
           entry.priority !== CachePriority.NEVER_EVICT &&
           this.compressionWorker !== null;
  }

  /**
   * Compress cache entry
   */
  private compressEntry(imageId: string): void {
    const entry = this.cache.get(imageId);
    if (!entry || entry.compressed || !this.compressionWorker) {
      return;
    }

    this.compressionWorker.postMessage({
      type: 'compress',
      imageId,
      data: entry.data,
    });
  }

  /**
   * Estimate data size
   */
  private estimateSize(data: any): number {
    if (data instanceof ArrayBuffer) {
      return data.byteLength;
    } else if (data instanceof Uint8Array || data instanceof Uint16Array) {
      return data.byteLength;
    } else if (typeof data === 'string') {
      return data.length * 2; // UTF-16
    } else if (data && typeof data === 'object') {
      return JSON.stringify(data).length * 2;
    }
    return 1024; // Default estimate
  }

  /**
   * Get space utilization ratio
   */
  private getSpaceUtilization(): number {
    return this.stats.totalSize / this.config.maxSize;
  }

  /**
   * Update cache statistics
   */
  private updateStats(): void {
    this.stats.entryCount = this.cache.size;
    this.updateCompressionRatio();
    this.updateMemoryPressure();
  }

  /**
   * Update hit rate
   */
  private updateHitRate(hit: boolean): void {
    // Simple moving average (could be improved with more sophisticated tracking)
    const weight = 0.1;
    this.stats.hitRate = hit ?
      this.stats.hitRate * (1 - weight) + weight :
      this.stats.hitRate * (1 - weight);
  }

  /**
   * Update compression ratio
   */
  private updateCompressionRatio(): void {
    let originalSize = 0;
    let compressedSize = 0;

    for (const entry of this.cache.values()) {
      if (entry.compressed) {
        compressedSize += entry.size;
        originalSize += entry.size / 0.6; // Estimate original size
      } else {
        originalSize += entry.size;
        compressedSize += entry.size;
      }
    }

    this.stats.compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;
  }

  /**
   * Update memory pressure
   */
  private updateMemoryPressure(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.stats.memoryPressure = memory.usedJSHeapSize / memory.totalJSHeapSize;
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = window.setInterval(() => {
      this.performMaintenance();
    }, 30000); // Every 30 seconds
  }

  /**
   * Perform periodic maintenance
   */
  private performMaintenance(): void {
    // Check memory pressure
    if (this.stats.memoryPressure > this.config.memoryPressureThreshold) {
      this.performAgressiveCleanup();
    }

    // Clean old access patterns
    this.cleanOldAccessPatterns();

    // Update statistics
    this.updateStats();

    this.triggerEvent('cache:maintenance', { stats: this.stats });
  }

  /**
   * Perform aggressive cleanup under memory pressure
   */
  private performAgressiveCleanup(): void {
    const targetReduction = 0.3; // Remove 30% of cache
    const targetSize = this.stats.totalSize * (1 - targetReduction);

    while (this.stats.totalSize > targetSize && this.cache.size > 0) {
      this.evictEntry();
    }

    this.triggerEvent('cache:aggressive_cleanup', {
      reducedBy: this.stats.totalSize / (this.stats.totalSize + targetSize),
    });
  }

  /**
   * Clean old access patterns
   */
  private cleanOldAccessPatterns(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours

    for (const [imageId, pattern] of this.accessPatterns) {
      if (pattern.lastAccess < cutoffTime) {
        this.accessPatterns.delete(imageId);
      }
    }
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get cache entries for debugging
   */
  public getEntries(): CacheEntry[] {
    return Array.from(this.cache.values());
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
    this.triggerEvent('config:updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  public getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Cleanup and destroy
   */
  public destroy(): void {
    // Clear cache
    this.clear();

    // Terminate compression worker
    if (this.compressionWorker) {
      this.compressionWorker.terminate();
    }

    // Clear cleanup timer
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    IntelligentCache.instance = null;
  }
}

// Export singleton instance
export const intelligentCache = IntelligentCache.getInstance();
