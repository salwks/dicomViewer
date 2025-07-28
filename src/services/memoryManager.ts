/**
 * Memory Management System
 * Advanced memory management for medical imaging applications with garbage collection,
 * memory pressure monitoring, and resource optimization
 */

import { intelligentCache } from './intelligentCache';

export interface MemoryInfo {
  used: number;
  total: number;
  limit: number;
  pressure: number;
  heapSize: number;
  heapLimit: number;
}

export interface MemoryStats {
  totalAllocated: number;
  totalDeallocated: number;
  activeObjects: number;
  gcCount: number;
  lastGcTime: number;
  memoryLeaks: number;
  peakUsage: number;
  averageUsage: number;
}

export interface MemoryConfig {
  enableMonitoring: boolean;
  gcThreshold: number;
  pressureThreshold: number;
  leakDetectionEnabled: boolean;
  autoCleanup: boolean;
  monitoringInterval: number;
  emergencyThreshold: number;
  maxRetainedObjects: number;
}

export interface MemoryObject {
  id: string;
  type: string;
  size: number;
  created: number;
  lastAccessed: number;
  refCount: number;
  data: any;
  disposable: boolean;
}

export interface MemoryAlert {
  type: 'pressure' | 'leak' | 'emergency' | 'gc';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  memoryInfo: MemoryInfo;
  recommendations: string[];
}

/**
 * Comprehensive memory management system
 */
export class MemoryManager extends EventTarget {
  /**
   * Trigger custom event
   */
  private triggerEvent(type: string, detail: any): void {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
  private static instance: MemoryManager | null = null;
  private config: MemoryConfig;
  private managedObjects: Map<string, MemoryObject> = new Map();
  private objectTypes: Map<string, Set<string>> = new Map();
  private stats: MemoryStats;
  private monitoringInterval: number | null = null;
  private gcTimeout: number | null = null;
  private memoryHistory: MemoryInfo[] = [];
  private weakRefs: Set<WeakRef<any>> = new Set();
  private disposalQueue: Set<string> = new Set();

  private constructor(config: Partial<MemoryConfig> = {}) {
    super();

    this.config = {
      enableMonitoring: true,
      gcThreshold: 0.8, // 80% memory usage
      pressureThreshold: 0.9, // 90% memory usage
      leakDetectionEnabled: true,
      autoCleanup: true,
      monitoringInterval: 5000, // 5 seconds
      emergencyThreshold: 0.95, // 95% memory usage
      maxRetainedObjects: 10000,
      ...config,
    };

    this.stats = {
      totalAllocated: 0,
      totalDeallocated: 0,
      activeObjects: 0,
      gcCount: 0,
      lastGcTime: 0,
      memoryLeaks: 0,
      peakUsage: 0,
      averageUsage: 0,
    };

    this.startMonitoring();
  }

  public static getInstance(config?: Partial<MemoryConfig>): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager(config);
    }
    return MemoryManager.instance;
  }

  /**
   * Start memory monitoring
   */
  private startMonitoring(): void {
    if (!this.config.enableMonitoring) return;

    this.monitoringInterval = window.setInterval(() => {
      this.checkMemoryStatus();
    }, this.config.monitoringInterval);

    // Register for memory pressure events if available
    if ('memory' in performance) {
      this.setupMemoryPressureHandling();
    }
  }

  /**
   * Setup memory pressure event handling
   */
  private setupMemoryPressureHandling(): void {
    // Listen for memory pressure events (Chrome DevTools protocol)
    if ('onmemorywarning' in window) {
      (window as any).onmemorywarning = () => {
        this.handleMemoryPressure('high');
      };
    }

    // Setup performance observers for memory
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => {
            if (entry.entryType === 'memory') {
              this.processMemoryEntry(entry as any);
            }
          });
        });

        observer.observe({ entryTypes: ['memory'] });
      } catch {
        // Memory performance entries not supported
      }
    }
  }

  /**
   * Process memory performance entries
   */
  private processMemoryEntry(entry: any): void {
    if (entry.bytes && entry.bytes > this.stats.peakUsage) {
      this.stats.peakUsage = entry.bytes;
    }
  }

  /**
   * Check current memory status
   */
  private checkMemoryStatus(): void {
    const memoryInfo = this.getMemoryInfo();

    // Update history
    this.memoryHistory.push(memoryInfo);
    if (this.memoryHistory.length > 100) {
      this.memoryHistory.shift();
    }

    // Update statistics
    this.updateMemoryStats(memoryInfo);

    // Check for pressure conditions
    if (memoryInfo.pressure >= this.config.emergencyThreshold) {
      this.handleMemoryPressure('critical');
    } else if (memoryInfo.pressure >= this.config.pressureThreshold) {
      this.handleMemoryPressure('high');
    } else if (memoryInfo.pressure >= this.config.gcThreshold) {
      this.handleMemoryPressure('medium');
    }

    // Detect memory leaks
    if (this.config.leakDetectionEnabled) {
      this.detectMemoryLeaks();
    }

    // Cleanup dead weak references
    this.cleanupWeakRefs();

    this.triggerEvent('memory:status', { memoryInfo, stats: this.stats });
  }

  /**
   * Get current memory information
   */
  public getMemoryInfo(): MemoryInfo {
    let memoryInfo: MemoryInfo = {
      used: 0,
      total: 0,
      limit: 0,
      pressure: 0,
      heapSize: 0,
      heapLimit: 0,
    };

    if ('memory' in performance) {
      const memory = (performance as any).memory;
      memoryInfo = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        pressure: memory.usedJSHeapSize / memory.jsHeapSizeLimit,
        heapSize: memory.totalJSHeapSize,
        heapLimit: memory.jsHeapSizeLimit,
      };
    } else {
      // Estimate memory usage when performance.memory is not available
      const estimatedUsage = this.estimateMemoryUsage();
      const estimatedLimit = 1024 * 1024 * 1024; // 1GB estimate

      memoryInfo = {
        used: estimatedUsage,
        total: estimatedUsage,
        limit: estimatedLimit,
        pressure: estimatedUsage / estimatedLimit,
        heapSize: estimatedUsage,
        heapLimit: estimatedLimit,
      };
    }

    return memoryInfo;
  }

  /**
   * Estimate memory usage when performance.memory is not available
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;

    // Sum managed objects
    for (const obj of this.managedObjects.values()) {
      totalSize += obj.size;
    }

    // Add cache size
    const cacheStats = intelligentCache.getStats();
    totalSize += cacheStats.totalSize;

    return totalSize;
  }

  /**
   * Handle memory pressure situations
   */
  private handleMemoryPressure(severity: 'medium' | 'high' | 'critical'): void {
    const memoryInfo = this.getMemoryInfo();
    const recommendations: string[] = [];

    switch (severity) {
      case 'medium':
        if (this.config.autoCleanup) {
          this.performLightCleanup();
          recommendations.push('Performed light cleanup');
        }
        break;

      case 'high':
        if (this.config.autoCleanup) {
          this.performAggresiveCleanup();
          recommendations.push('Performed aggressive cleanup');
        }
        this.triggerGarbageCollection();
        recommendations.push('Triggered garbage collection');
        break;

      case 'critical':
        this.performEmergencyCleanup();
        this.triggerGarbageCollection();
        recommendations.push('Performed emergency cleanup', 'Consider reducing application load');
        break;
    }

    const alert: MemoryAlert = {
      type: 'pressure',
      severity: severity === 'medium' ? 'medium' : severity === 'high' ? 'high' : 'critical',
      message: `Memory pressure detected: ${severity}`,
      timestamp: Date.now(),
      memoryInfo,
      recommendations,
    };

    this.emitAlert(alert);
  }

  /**
   * Register a managed object
   */
  public registerObject(
    id: string,
    data: any,
    options: {
      type?: string;
      size?: number;
      disposable?: boolean;
      weak?: boolean;
    } = {},
  ): void {
    const size = options.size || this.estimateObjectSize(data);
    const type = options.type || 'unknown';

    const memoryObject: MemoryObject = {
      id,
      type,
      size,
      created: Date.now(),
      lastAccessed: Date.now(),
      refCount: 1,
      data,
      disposable: options.disposable !== false,
    };

    this.managedObjects.set(id, memoryObject);

    // Track by type
    if (!this.objectTypes.has(type)) {
      this.objectTypes.set(type, new Set());
    }
    this.objectTypes.get(type)!.add(id);

    // Create weak reference if requested
    if (options.weak && 'WeakRef' in window) {
      const weakRef = new WeakRef(data);
      this.weakRefs.add(weakRef);
    }

    this.stats.totalAllocated += size;
    this.stats.activeObjects++;

    this.triggerEvent('object:registered', { id, type, size });
  }

  /**
   * Unregister a managed object
   */
  public unregisterObject(id: string): boolean {
    const obj = this.managedObjects.get(id);
    if (!obj) {
      return false;
    }

    // Remove from type tracking
    const typeSet = this.objectTypes.get(obj.type);
    if (typeSet) {
      typeSet.delete(id);
      if (typeSet.size === 0) {
        this.objectTypes.delete(obj.type);
      }
    }

    this.managedObjects.delete(id);
    this.stats.totalDeallocated += obj.size;
    this.stats.activeObjects--;

    this.triggerEvent('object:unregistered', { id, type: obj.type, size: obj.size });
    return true;
  }

  /**
   * Access a managed object (updates access time)
   */
  public accessObject(id: string): any {
    const obj = this.managedObjects.get(id);
    if (obj) {
      obj.lastAccessed = Date.now();
      obj.refCount++;
      return obj.data;
    }
    return null;
  }

  /**
   * Dispose of an object
   */
  public disposeObject(id: string): boolean {
    const obj = this.managedObjects.get(id);
    if (!obj || !obj.disposable) {
      return false;
    }

    // Call dispose method if available
    if (obj.data && typeof obj.data.dispose === 'function') {
      try {
        obj.data.dispose();
      } catch (error) {
        console.warn('Error disposing object:', error);
      }
    }

    return this.unregisterObject(id);
  }

  /**
   * Perform light cleanup
   */
  private performLightCleanup(): void {
    const now = Date.now();
    const oldThreshold = 10 * 60 * 1000; // 10 minutes
    let cleanedCount = 0;

    // Clean old, unused objects
    for (const [id, obj] of this.managedObjects) {
      if (obj.disposable &&
          obj.refCount <= 1 &&
          now - obj.lastAccessed > oldThreshold) {
        this.disposalQueue.add(id);
        cleanedCount++;
      }
    }

    this.processDisposalQueue();

    this.triggerEvent('cleanup:light', { cleanedCount });
  }

  /**
   * Perform aggressive cleanup
   */
  private performAggresiveCleanup(): void {
    const now = Date.now();
    const recentThreshold = 5 * 60 * 1000; // 5 minutes
    let cleanedCount = 0;

    // Clean less recently used objects
    for (const [id, obj] of this.managedObjects) {
      if (obj.disposable &&
          obj.refCount <= 2 &&
          now - obj.lastAccessed > recentThreshold) {
        this.disposalQueue.add(id);
        cleanedCount++;
      }
    }

    this.processDisposalQueue();

    // Clear cache if pressure is high
    const cacheStats = intelligentCache.getStats();
    if (cacheStats.totalSize > 100 * 1024 * 1024) { // > 100MB
      intelligentCache.clear();
    }

    this.triggerEvent('cleanup:aggressive', { cleanedCount });
  }

  /**
   * Perform emergency cleanup
   */
  private performEmergencyCleanup(): void {
    let cleanedCount = 0;

    // Dispose all disposable objects
    for (const [id, obj] of this.managedObjects) {
      if (obj.disposable) {
        this.disposalQueue.add(id);
        cleanedCount++;
      }
    }

    this.processDisposalQueue();

    // Clear all caches
    intelligentCache.clear();

    // Clear weak references
    this.weakRefs.clear();

    this.triggerEvent('cleanup:emergency', { cleanedCount });
  }

  /**
   * Process disposal queue
   */
  private processDisposalQueue(): void {
    for (const id of this.disposalQueue) {
      this.disposeObject(id);
    }
    this.disposalQueue.clear();
  }

  /**
   * Trigger garbage collection
   */
  private triggerGarbageCollection(): void {
    // Clear GC timeout if exists
    if (this.gcTimeout) {
      clearTimeout(this.gcTimeout);
    }

    // Schedule GC hint
    this.gcTimeout = window.setTimeout(() => {
      this.performGarbageCollection();
      this.gcTimeout = null;
    }, 100);
  }

  /**
   * Perform garbage collection
   */
  private performGarbageCollection(): void {
    const beforeMemory = this.getMemoryInfo();

    // Force GC if available (development/debugging only)
    if ('gc' in window && typeof (window as any).gc === 'function') {
      try {
        (window as any).gc();
      } catch {
        // GC not available
      }
    }

    // Clean up our internal structures
    this.cleanupInternalStructures();

    const afterMemory = this.getMemoryInfo();
    const memoryFreed = beforeMemory.used - afterMemory.used;

    this.stats.gcCount++;
    this.stats.lastGcTime = Date.now();

    this.triggerEvent('gc:completed', {
      memoryFreed,
      beforeMemory,
      afterMemory,
    });
  }

  /**
   * Clean up internal structures
   */
  private cleanupInternalStructures(): void {
    // Remove objects that no longer exist
    for (const [id, obj] of this.managedObjects) {
      if (!obj.data || (typeof obj.data === 'object' && Object.keys(obj.data).length === 0)) {
        this.unregisterObject(id);
      }
    }
  }

  /**
   * Detect memory leaks
   */
  private detectMemoryLeaks(): void {
    const now = Date.now();
    const leakThreshold = 30 * 60 * 1000; // 30 minutes
    let leakCount = 0;

    // Objects that haven't been accessed in a long time and have high ref counts
    for (const [id, obj] of this.managedObjects) {
      if (obj.refCount > 10 &&
          now - obj.lastAccessed > leakThreshold) {
        leakCount++;

        this.triggerEvent('memory:leak_detected', {
          objectId: id,
          type: obj.type,
          refCount: obj.refCount,
          age: now - obj.created,
        });
      }
    }

    if (leakCount > 0) {
      this.stats.memoryLeaks += leakCount;

      const alert: MemoryAlert = {
        type: 'leak',
        severity: leakCount > 10 ? 'high' : 'medium',
        message: `Detected ${leakCount} potential memory leaks`,
        timestamp: now,
        memoryInfo: this.getMemoryInfo(),
        recommendations: [
          'Review object references',
          'Check for circular dependencies',
          'Consider using weak references',
        ],
      };

      this.emitAlert(alert);
    }
  }

  /**
   * Clean up dead weak references
   */
  private cleanupWeakRefs(): void {
    const deadRefs: WeakRef<any>[] = [];

    for (const weakRef of this.weakRefs) {
      if (weakRef.deref() === undefined) {
        deadRefs.push(weakRef);
      }
    }

    deadRefs.forEach(ref => this.weakRefs.delete(ref));
  }

  /**
   * Estimate object size
   */
  private estimateObjectSize(obj: any): number {
    if (obj instanceof ArrayBuffer) {
      return obj.byteLength;
    } else if (obj instanceof Uint8Array || obj instanceof Uint16Array) {
      return obj.byteLength;
    } else if (typeof obj === 'string') {
      return obj.length * 2; // UTF-16
    } else if (obj && typeof obj === 'object') {
      try {
        return JSON.stringify(obj).length * 2;
      } catch {
        return 1024; // Default estimate for circular objects
      }
    }
    return 64; // Default estimate for primitives
  }

  /**
   * Update memory statistics
   */
  private updateMemoryStats(memoryInfo: MemoryInfo): void {
    // Update peak usage
    if (memoryInfo.used > this.stats.peakUsage) {
      this.stats.peakUsage = memoryInfo.used;
    }

    // Update average usage (simple moving average)
    const weight = 0.1;
    this.stats.averageUsage = this.stats.averageUsage * (1 - weight) + memoryInfo.used * weight;
  }

  /**
   * Emit memory alert
   */
  private emitAlert(alert: MemoryAlert): void {
    this.triggerEvent('memory:alert', alert);
  }

  /**
   * Get memory statistics
   */
  public getStats(): MemoryStats {
    return { ...this.stats };
  }

  /**
   * Get managed objects summary
   */
  public getObjectsSummary(): {
    byType: Record<string, number>;
    total: number;
    totalSize: number;
    } {
    const byType: Record<string, number> = {};
    let totalSize = 0;

    for (const obj of this.managedObjects.values()) {
      byType[obj.type] = (byType[obj.type] || 0) + 1;
      totalSize += obj.size;
    }

    return {
      byType,
      total: this.managedObjects.size,
      totalSize,
    };
  }

  /**
   * Get memory history
   */
  public getMemoryHistory(): MemoryInfo[] {
    return [...this.memoryHistory];
  }

  /**
   * Force cleanup by type
   */
  public cleanupByType(type: string): number {
    const typeSet = this.objectTypes.get(type);
    if (!typeSet) {
      return 0;
    }

    let cleanedCount = 0;
    for (const id of typeSet) {
      if (this.disposeObject(id)) {
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<MemoryConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart monitoring if interval changed
    if (config.monitoringInterval && this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.startMonitoring();
    }

    this.triggerEvent('config:updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  public getConfig(): MemoryConfig {
    return { ...this.config };
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.gcTimeout) {
      clearTimeout(this.gcTimeout);
      this.gcTimeout = null;
    }
  }

  /**
   * Cleanup and destroy
   */
  public destroy(): void {
    this.stopMonitoring();

    // Dispose all managed objects
    for (const id of this.managedObjects.keys()) {
      this.disposeObject(id);
    }

    // Clear data structures
    this.managedObjects.clear();
    this.objectTypes.clear();
    this.weakRefs.clear();
    this.disposalQueue.clear();
    this.memoryHistory.length = 0;

    MemoryManager.instance = null;
  }
}

// Export singleton instance
export const memoryManager = MemoryManager.getInstance();
