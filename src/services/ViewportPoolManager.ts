/**
 * Viewport Pool Manager Service
 * Implements viewport pooling and recycling for optimal resource usage
 * Provides automatic garbage collection and memory management
 * Built with shadcn/ui compliance and security standards
 */

import { EventEmitter } from 'events';
import { log } from '../utils/logger';
import { safePropertyAccess } from '../lib/utils';
// import { ViewportState } from '../types/viewportState'; // Currently unused

export interface PooledViewport {
  id: string;
  poolId: string;
  state: 'available' | 'in-use' | 'pending-cleanup' | 'disposed';
  type: 'stack' | 'volume';
  createdAt: number;
  lastUsedAt: number;
  usageCount: number;
  assignedStudyId?: string;
  element?: HTMLDivElement;
  renderingEngineId?: string;
  metadata?: Record<string, unknown>;
}

export interface ViewportPoolConfig {
  minPoolSize: number;
  maxPoolSize: number;
  initialPoolSize: number;
  expandThreshold: number; // % of pool in use before expansion
  shrinkThreshold: number; // % of pool unused before shrinking
  gcInterval: number; // Garbage collection interval in ms
  maxIdleTime: number; // Max time viewport can be idle before cleanup
  maxMemoryUsage: number; // Max memory usage in bytes
  enableAutoScaling: boolean;
  enableGarbageCollection: boolean;
}

export interface PoolStatistics {
  totalViewports: number;
  availableViewports: number;
  inUseViewports: number;
  pendingCleanup: number;
  recycleCount: number;
  gcRunCount: number;
  memoryUsage: number;
  lastGcTime: number;
  poolEfficiency: number; // % of successful recycling
}

export interface GarbageCollectionResult {
  cleanedViewports: number;
  freedMemory: number;
  duration: number;
  errors: string[];
}

const DEFAULT_CONFIG: ViewportPoolConfig = {
  minPoolSize: 2,
  maxPoolSize: 16,
  initialPoolSize: 4,
  expandThreshold: 0.8,
  shrinkThreshold: 0.2,
  gcInterval: 60000, // 1 minute
  maxIdleTime: 300000, // 5 minutes
  maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
  enableAutoScaling: true,
  enableGarbageCollection: true,
};

/**
 * Viewport Pool Manager
 * Manages a pool of reusable viewports with automatic garbage collection
 */
export class ViewportPoolManager extends EventEmitter {
  private config: ViewportPoolConfig;
  private pool: Map<string, PooledViewport> = new Map();
  private availableQueue: string[] = [];
  private inUseSet: Set<string> = new Set();
  private pendingCleanupQueue: string[] = [];
  private nextPoolId: number = 1;
  private gcIntervalId?: NodeJS.Timeout;
  private statistics: PoolStatistics;
  private memoryMonitor?: NodeJS.Timeout;

  constructor(config: Partial<ViewportPoolConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.statistics = this.initializeStatistics();
    this.initialize();
  }

  private initializeStatistics(): PoolStatistics {
    return {
      totalViewports: 0,
      availableViewports: 0,
      inUseViewports: 0,
      pendingCleanup: 0,
      recycleCount: 0,
      gcRunCount: 0,
      memoryUsage: 0,
      lastGcTime: 0,
      poolEfficiency: 100,
    };
  }

  private initialize(): void {
    log.info('ViewportPoolManager initializing', {
      component: 'ViewportPoolManager',
      metadata: { config: this.config },
    });

    // Create initial pool
    this.createInitialPool();

    // Start garbage collection if enabled
    if (this.config.enableGarbageCollection) {
      this.startGarbageCollection();
    }

    // Start memory monitoring
    this.startMemoryMonitoring();

    log.info('ViewportPoolManager initialized', {
      component: 'ViewportPoolManager',
      metadata: {
        poolSize: this.pool.size,
        availableCount: this.availableQueue.length,
      },
    });
  }

  // ===== Pool Management =====

  /**
   * Create initial viewport pool
   */
  private createInitialPool(): void {
    for (let i = 0; i < this.config.initialPoolSize; i++) {
      this.createPooledViewport();
    }
  }

  /**
   * Create a new pooled viewport
   */
  private createPooledViewport(type: 'stack' | 'volume' = 'stack'): PooledViewport {
    const poolId = `pool-vp-${this.nextPoolId++}`;
    const viewport: PooledViewport = {
      id: `viewport-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      poolId,
      state: 'available',
      type,
      createdAt: Date.now(),
      lastUsedAt: 0,
      usageCount: 0,
    };

    this.pool.set(poolId, viewport);
    this.availableQueue.push(poolId);
    this.statistics.totalViewports++;
    this.statistics.availableViewports++;

    log.info('Created pooled viewport', {
      component: 'ViewportPoolManager',
      metadata: { poolId, type },
    });

    return viewport;
  }

  /**
   * Acquire a viewport from the pool
   */
  public async acquireViewport(type: 'stack' | 'volume' = 'stack', studyId?: string): Promise<PooledViewport | null> {
    // Check for available viewport of requested type
    let availableViewport = this.findAvailableViewport(type);

    // If none available, try to expand pool
    if (!availableViewport && this.shouldExpandPool()) {
      availableViewport = this.expandPool(type);
    }

    // If still none available, try to recycle
    if (!availableViewport) {
      availableViewport = await this.recycleViewport(type);
    }

    if (!availableViewport) {
      log.warn('No viewport available in pool', {
        component: 'ViewportPoolManager',
        metadata: {
          type,
          poolSize: this.pool.size,
          inUse: this.inUseSet.size,
        },
      });
      return null;
    }

    // Mark viewport as in-use
    availableViewport.state = 'in-use';
    availableViewport.lastUsedAt = Date.now();
    availableViewport.usageCount++;
    availableViewport.assignedStudyId = studyId;

    // Update tracking
    const index = this.availableQueue.indexOf(availableViewport.poolId);
    if (index > -1) {
      this.availableQueue.splice(index, 1);
    }
    this.inUseSet.add(availableViewport.poolId);

    // Update statistics
    this.statistics.availableViewports--;
    this.statistics.inUseViewports++;

    this.emit('viewport-acquired', availableViewport);

    log.info('Viewport acquired from pool', {
      component: 'ViewportPoolManager',
      metadata: {
        poolId: availableViewport.poolId,
        type,
        studyId,
        usageCount: availableViewport.usageCount,
      },
    });

    return availableViewport;
  }

  /**
   * Release viewport back to pool
   */
  public async releaseViewport(poolId: string): Promise<boolean> {
    const viewport = this.pool.get(poolId);
    if (!viewport) {
      log.warn('Viewport not found in pool', {
        component: 'ViewportPoolManager',
        metadata: { poolId },
      });
      return false;
    }

    if (viewport.state !== 'in-use') {
      log.warn('Viewport not in use', {
        component: 'ViewportPoolManager',
        metadata: { poolId, state: viewport.state },
      });
      return false;
    }

    // Clean viewport data
    await this.cleanViewport(viewport);

    // Mark as pending cleanup
    viewport.state = 'pending-cleanup';
    viewport.assignedStudyId = undefined;

    // Remove from in-use set
    this.inUseSet.delete(poolId);
    this.pendingCleanupQueue.push(poolId);

    // Update statistics
    this.statistics.inUseViewports--;
    this.statistics.pendingCleanup++;

    // Schedule cleanup
    this.scheduleViewportCleanup(viewport);

    this.emit('viewport-released', viewport);

    log.info('Viewport released to pool', {
      component: 'ViewportPoolManager',
      metadata: {
        poolId,
        usageCount: viewport.usageCount,
      },
    });

    return true;
  }

  /**
   * Find available viewport of specific type
   */
  private findAvailableViewport(type: 'stack' | 'volume'): PooledViewport | null {
    for (const poolId of this.availableQueue) {
      const viewport = this.pool.get(poolId);
      if (viewport && viewport.type === type && viewport.state === 'available') {
        return viewport;
      }
    }
    return null;
  }

  /**
   * Check if pool should be expanded
   */
  private shouldExpandPool(): boolean {
    if (!this.config.enableAutoScaling) return false;
    if (this.pool.size >= this.config.maxPoolSize) return false;

    const utilizationRatio = this.inUseSet.size / this.pool.size;
    return utilizationRatio >= this.config.expandThreshold;
  }

  /**
   * Expand the pool with new viewports
   */
  private expandPool(type: 'stack' | 'volume'): PooledViewport | null {
    if (this.pool.size >= this.config.maxPoolSize) {
      log.warn('Pool at maximum size', {
        component: 'ViewportPoolManager',
        metadata: {
          currentSize: this.pool.size,
          maxSize: this.config.maxPoolSize,
        },
      });
      return null;
    }

    const newViewport = this.createPooledViewport(type);

    log.info('Pool expanded', {
      component: 'ViewportPoolManager',
      metadata: {
        newSize: this.pool.size,
        type,
      },
    });

    return newViewport;
  }

  /**
   * Shrink pool by removing excess viewports
   */
  private async shrinkPool(): Promise<void> {
    if (!this.config.enableAutoScaling) return;
    if (this.pool.size <= this.config.minPoolSize) return;

    const utilizationRatio = this.inUseSet.size / this.pool.size;
    if (utilizationRatio >= this.config.shrinkThreshold) return;

    // Find viewports to remove (oldest, least used)
    const viewportsToRemove = this.identifyViewportsForRemoval();

    for (const poolId of viewportsToRemove) {
      await this.removeViewportFromPool(poolId);
    }

    log.info('Pool shrunk', {
      component: 'ViewportPoolManager',
      metadata: {
        newSize: this.pool.size,
        removed: viewportsToRemove.length,
      },
    });
  }

  /**
   * Identify viewports for removal during shrinking
   */
  private identifyViewportsForRemoval(): string[] {
    const candidates: Array<{ poolId: string; viewport: PooledViewport }> = [];

    this.pool.forEach((viewport, poolId) => {
      if (viewport.state === 'available') {
        candidates.push({ poolId, viewport });
      }
    });

    // Sort by usage (least used first) and age (oldest first)
    candidates.sort((a, b) => {
      if (a.viewport.usageCount !== b.viewport.usageCount) {
        return a.viewport.usageCount - b.viewport.usageCount;
      }
      return a.viewport.createdAt - b.viewport.createdAt;
    });

    // Calculate how many to remove
    const targetSize = Math.max(this.config.minPoolSize, Math.ceil(this.inUseSet.size / this.config.shrinkThreshold));
    const toRemove = Math.max(0, this.pool.size - targetSize);

    return candidates.slice(0, toRemove).map(c => c.poolId);
  }

  // ===== Recycling =====

  /**
   * Recycle a viewport for reuse
   */
  private async recycleViewport(type: 'stack' | 'volume'): Promise<PooledViewport | null> {
    // Find least recently used viewport of different type
    let oldestViewport: PooledViewport | null = null;
    let oldestPoolId: string | null = null;

    for (const poolId of this.availableQueue) {
      const viewport = this.pool.get(poolId);
      if (viewport && viewport.state === 'available') {
        if (!oldestViewport || viewport.lastUsedAt < oldestViewport.lastUsedAt) {
          oldestViewport = viewport;
          oldestPoolId = poolId;
        }
      }
    }

    if (!oldestViewport || !oldestPoolId) {
      return null;
    }

    // Recycle the viewport
    await this.cleanViewport(oldestViewport);
    oldestViewport.type = type;
    oldestViewport.lastUsedAt = Date.now();

    this.statistics.recycleCount++;

    log.info('Viewport recycled', {
      component: 'ViewportPoolManager',
      metadata: {
        poolId: oldestPoolId,
        newType: type,
        recycleCount: this.statistics.recycleCount,
      },
    });

    return oldestViewport;
  }

  // ===== Cleanup =====

  /**
   * Clean viewport data
   */
  private async cleanViewport(viewport: PooledViewport): Promise<void> {
    try {
      // In real implementation, this would:
      // 1. Clear Cornerstone viewport
      // 2. Release GPU resources
      // 3. Clear cache
      // 4. Reset DOM element

      viewport.element = undefined;
      viewport.renderingEngineId = undefined;
      viewport.assignedStudyId = undefined;
      viewport.metadata = {};

      log.info('Viewport cleaned', {
        component: 'ViewportPoolManager',
        metadata: { poolId: viewport.poolId },
      });
    } catch (error) {
      log.error(
        'Failed to clean viewport',
        {
          component: 'ViewportPoolManager',
          metadata: { poolId: viewport.poolId },
        },
        error as Error,
      );
    }
  }

  /**
   * Schedule viewport cleanup after release
   */
  private scheduleViewportCleanup(viewport: PooledViewport): void {
    setTimeout(async () => {
      if (viewport.state === 'pending-cleanup') {
        await this.completeViewportCleanup(viewport);
      }
    }, 1000); // 1 second delay
  }

  /**
   * Complete viewport cleanup and return to available pool
   */
  private async completeViewportCleanup(viewport: PooledViewport): Promise<void> {
    viewport.state = 'available';

    // Remove from pending cleanup
    const index = this.pendingCleanupQueue.indexOf(viewport.poolId);
    if (index > -1) {
      this.pendingCleanupQueue.splice(index, 1);
    }

    // Add to available queue
    this.availableQueue.push(viewport.poolId);

    // Update statistics
    this.statistics.pendingCleanup--;
    this.statistics.availableViewports++;

    log.info('Viewport cleanup completed', {
      component: 'ViewportPoolManager',
      metadata: { poolId: viewport.poolId },
    });
  }

  /**
   * Remove viewport from pool completely
   */
  private async removeViewportFromPool(poolId: string): Promise<void> {
    const viewport = this.pool.get(poolId);
    if (!viewport) return;

    // Clean up resources
    await this.cleanViewport(viewport);

    // Remove from all tracking
    this.pool.delete(poolId);

    const availableIndex = this.availableQueue.indexOf(poolId);
    if (availableIndex > -1) {
      this.availableQueue.splice(availableIndex, 1);
    }

    this.inUseSet.delete(poolId);

    const pendingIndex = this.pendingCleanupQueue.indexOf(poolId);
    if (pendingIndex > -1) {
      this.pendingCleanupQueue.splice(pendingIndex, 1);
    }

    // Update statistics
    this.statistics.totalViewports--;
    if (viewport.state === 'available') {
      this.statistics.availableViewports--;
    } else if (viewport.state === 'in-use') {
      this.statistics.inUseViewports--;
    } else if (viewport.state === 'pending-cleanup') {
      this.statistics.pendingCleanup--;
    }

    log.info('Viewport removed from pool', {
      component: 'ViewportPoolManager',
      metadata: { poolId },
    });
  }

  // ===== Garbage Collection =====

  /**
   * Start garbage collection interval
   */
  private startGarbageCollection(): void {
    this.gcIntervalId = setInterval(() => {
      this.runGarbageCollection();
    }, this.config.gcInterval);

    log.info('Garbage collection started', {
      component: 'ViewportPoolManager',
      metadata: { interval: this.config.gcInterval },
    });
  }

  /**
   * Run garbage collection cycle
   */
  public async runGarbageCollection(): Promise<GarbageCollectionResult> {
    const startTime = Date.now();
    const result: GarbageCollectionResult = {
      cleanedViewports: 0,
      freedMemory: 0,
      duration: 0,
      errors: [],
    };

    log.info('Garbage collection starting', {
      component: 'ViewportPoolManager',
    });

    try {
      // Clean up idle viewports
      const idleViewports = this.identifyIdleViewports();
      for (const poolId of idleViewports) {
        try {
          await this.removeViewportFromPool(poolId);
          result.cleanedViewports++;
        } catch (error) {
          result.errors.push(`Failed to clean viewport ${poolId}: ${error}`);
        }
      }

      // Shrink pool if needed
      await this.shrinkPool();

      // Estimate freed memory (in real implementation, use actual measurements)
      result.freedMemory = result.cleanedViewports * 50 * 1024 * 1024; // 50MB estimate per viewport

      // Update statistics
      this.statistics.gcRunCount++;
      this.statistics.lastGcTime = Date.now();
      this.statistics.memoryUsage = this.estimateMemoryUsage();

      // Calculate pool efficiency
      const totalAttempts = this.statistics.recycleCount + result.cleanedViewports;
      if (totalAttempts > 0) {
        this.statistics.poolEfficiency = (this.statistics.recycleCount / totalAttempts) * 100;
      }
    } catch (error) {
      log.error(
        'Garbage collection failed',
        {
          component: 'ViewportPoolManager',
        },
        error as Error,
      );
      result.errors.push(`GC failed: ${error}`);
    }

    result.duration = Date.now() - startTime;

    log.info('Garbage collection completed', {
      component: 'ViewportPoolManager',
      metadata: { ...result } as Record<string, unknown>,
    });

    this.emit('gc-completed', result);

    return result;
  }

  /**
   * Identify idle viewports for garbage collection
   */
  private identifyIdleViewports(): string[] {
    const idleViewports: string[] = [];
    const now = Date.now();

    this.pool.forEach((viewport, poolId) => {
      if (
        viewport.state === 'available' &&
        viewport.lastUsedAt > 0 &&
        now - viewport.lastUsedAt > this.config.maxIdleTime
      ) {
        idleViewports.push(poolId);
      }
    });

    return idleViewports;
  }

  // ===== Memory Management =====

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    this.memoryMonitor = setInterval(() => {
      this.checkMemoryUsage();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Check memory usage and trigger cleanup if needed
   */
  private async checkMemoryUsage(): Promise<void> {
    const currentUsage = this.estimateMemoryUsage();

    if (currentUsage > this.config.maxMemoryUsage) {
      log.warn('Memory usage exceeded threshold', {
        component: 'ViewportPoolManager',
        metadata: {
          currentUsage,
          threshold: this.config.maxMemoryUsage,
        },
      });

      // Trigger aggressive cleanup
      await this.performAggressiveCleanup();
    }

    this.statistics.memoryUsage = currentUsage;
  }

  /**
   * Estimate current memory usage
   */
  private estimateMemoryUsage(): number {
    // In real implementation, use actual memory measurements
    // This is a rough estimate
    const baseMemoryPerViewport = 50 * 1024 * 1024; // 50MB
    const activeMemoryMultiplier = 2; // Active viewports use more memory

    let totalMemory = 0;
    this.pool.forEach(viewport => {
      if (viewport.state === 'in-use') {
        totalMemory += baseMemoryPerViewport * activeMemoryMultiplier;
      } else {
        totalMemory += baseMemoryPerViewport * 0.5; // Idle viewports use less
      }
    });

    return totalMemory;
  }

  /**
   * Perform aggressive cleanup to free memory
   */
  private async performAggressiveCleanup(): Promise<void> {
    log.warn('Performing aggressive cleanup', {
      component: 'ViewportPoolManager',
    });

    // Remove all available viewports above minimum
    const availableViewports = Array.from(this.pool.entries())
      .filter(([_, vp]) => vp.state === 'available')
      .map(([poolId]) => poolId);

    const toRemove = Math.max(0, availableViewports.length - this.config.minPoolSize);

    for (let i = 0; i < toRemove; i++) {
      const viewport = safePropertyAccess(availableViewports, i);
      if (viewport) {
        await this.removeViewportFromPool(viewport);
      }
    }

    // Force garbage collection
    await this.runGarbageCollection();
  }

  // ===== Statistics & Monitoring =====

  /**
   * Get current pool statistics
   */
  public getStatistics(): PoolStatistics {
    return { ...this.statistics };
  }

  /**
   * Get pool health status
   */
  public getHealthStatus(): {
    healthy: boolean;
    issues: string[];
    recommendations: string[];
    } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check pool efficiency
    if (this.statistics.poolEfficiency < 50) {
      issues.push('Low pool efficiency - many viewports being disposed instead of recycled');
      recommendations.push('Consider adjusting pool size or idle timeout settings');
    }

    // Check memory usage
    if (this.statistics.memoryUsage > this.config.maxMemoryUsage * 0.9) {
      issues.push('High memory usage approaching limit');
      recommendations.push('Reduce pool size or trigger manual garbage collection');
    }

    // Check utilization
    const utilization = this.statistics.inUseViewports / this.statistics.totalViewports;
    if (utilization > 0.9) {
      issues.push('High pool utilization');
      recommendations.push('Consider increasing pool size');
    } else if (utilization < 0.1 && this.statistics.totalViewports > this.config.minPoolSize) {
      issues.push('Low pool utilization');
      recommendations.push('Consider decreasing pool size');
    }

    return {
      healthy: issues.length === 0,
      issues,
      recommendations,
    };
  }

  // ===== Cleanup =====

  /**
   * Dispose all resources
   */
  public async dispose(): Promise<void> {
    // Stop intervals
    if (this.gcIntervalId) {
      clearInterval(this.gcIntervalId);
    }
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
    }

    // Clean all viewports
    for (const [, viewport] of this.pool.entries()) {
      await this.cleanViewport(viewport);
    }

    // Clear all data
    this.pool.clear();
    this.availableQueue = [];
    this.inUseSet.clear();
    this.pendingCleanupQueue = [];

    this.removeAllListeners();

    log.info('ViewportPoolManager disposed', {
      component: 'ViewportPoolManager',
    });
  }
}

// Export singleton instance
export const viewportPoolManager = new ViewportPoolManager();
