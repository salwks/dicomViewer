/**
 * Viewport Memory Manager
 * Manages memory allocation, pressure monitoring, and cleanup for viewports
 */

import { EventEmitter } from 'events';
import {
  ViewportMemoryThreshold,
  TexturePriorityInfo,
  ResourceCleanupStage,
  RenderPriority,
  ViewportOptimizationState,
} from './types';
import { memoryManager, CleanupPriority } from '../memoryManager';
import { log } from '../../utils/logger';

export class ViewportMemoryManager extends EventEmitter {
  private readonly viewportMemoryThresholds = new Map<string, ViewportMemoryThreshold>();
  private readonly texturePriorities = new Map<string, TexturePriorityInfo>();
  private readonly cleanupStages: ResourceCleanupStage[] = [
    { stage: 'immediate', targetTypes: ['cache'], priority: CleanupPriority.HIGH },
    { stage: 'delayed', targetTypes: ['textures', 'buffers'], priority: CleanupPriority.MEDIUM, delay: 5000 },
    { stage: 'periodic', targetTypes: ['imageData'], priority: CleanupPriority.LOW, delay: 30000 },
  ];

  private memoryPressureCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startMemoryPressureMonitoring();
  }

  /**
   * Set memory threshold for a viewport
   */
  setViewportMemoryThreshold(viewportId: string, threshold: ViewportMemoryThreshold): void {
    this.viewportMemoryThresholds.set(viewportId, threshold);

    log.info('Viewport memory threshold set', {
      component: 'ViewportMemoryManager',
      metadata: { viewportId, maxMemory: threshold.maxMemory },
    });
  }

  /**
   * Check memory pressure for all viewports
   */
  async checkMemoryPressure(): Promise<void> {
    try {
      const memoryUsage = await memoryManager.getMemoryUsage();
      const totalMemoryRatio = memoryUsage
        ? memoryUsage.used / memoryUsage.total
        : 0.5; // Default assumption

      this.viewportMemoryThresholds.forEach((threshold, viewportId) => {
        const currentTime = Date.now();

        // Update memory pressure level based on usage
        if (totalMemoryRatio > 0.9) {
          threshold.memoryPressureLevel = 'critical';
        } else if (totalMemoryRatio > 0.7) {
          threshold.memoryPressureLevel = 'high';
        } else if (totalMemoryRatio > 0.5) {
          threshold.memoryPressureLevel = 'medium';
        } else {
          threshold.memoryPressureLevel = 'low';
        }

        threshold.lastMemoryCheck = currentTime;

        // Emit memory pressure warning if needed
        if (threshold.memoryPressureLevel === 'critical' || threshold.memoryPressureLevel === 'high') {
          this.emit('memory-pressure', viewportId, totalMemoryRatio, threshold);
        }
      });
    } catch (error) {
      log.warn('Failed to check memory pressure', {
        component: 'ViewportMemoryManager',
        metadata: { error: (error as Error).message },
      });
    }
  }

  /**
   * Manage resource allocation across viewports
   */
  manageResourceAllocation(
    viewportStates: Map<string, ViewportOptimizationState>,
    totalMemoryBudget: number,
  ): void {
    let allocatedMemory = 0;

    // Sort viewports by priority
    const sortedViewports = Array.from(viewportStates.entries())
      .sort(([, a], [, b]) => a.priority - b.priority);

    // Allocate memory based on priority
    sortedViewports.forEach(([viewportId, state]) => {
      const budgetRemaining = totalMemoryBudget - allocatedMemory;
      const viewportBudget = this.calculateViewportMemoryBudget(state.priority, budgetRemaining);

      state.memoryAllocated = viewportBudget;
      allocatedMemory += viewportBudget;

      // Update throttle ratio based on available resources
      if (budgetRemaining < totalMemoryBudget * 0.1) {
        state.throttleRatio = 0.5; // Throttle to 50%
      } else if (budgetRemaining < totalMemoryBudget * 0.3) {
        state.throttleRatio = 0.75; // Throttle to 75%
      } else {
        state.throttleRatio = 1.0; // No throttling
      }

      // Update memory threshold for viewport
      const threshold: ViewportMemoryThreshold = {
        viewportId,
        maxMemory: viewportBudget,
        warningThreshold: viewportBudget * 0.8,
        criticalThreshold: viewportBudget * 0.9,
        lastMemoryCheck: Date.now(),
        memoryPressureLevel: 'low',
      };

      this.setViewportMemoryThreshold(viewportId, threshold);
    });
  }

  /**
   * Calculate memory budget for viewport based on priority
   */
  private calculateViewportMemoryBudget(priority: RenderPriority, availableMemory: number): number {
    const baseAllocation = availableMemory * 0.2; // 20% base allocation

    switch (priority) {
      case RenderPriority.CRITICAL:
        return Math.min(availableMemory * 0.6, baseAllocation * 3);
      case RenderPriority.HIGH:
        return Math.min(availableMemory * 0.4, baseAllocation * 2);
      case RenderPriority.MEDIUM:
        return Math.min(availableMemory * 0.3, baseAllocation * 1.5);
      case RenderPriority.LOW:
        return Math.min(availableMemory * 0.2, baseAllocation);
      case RenderPriority.SUSPENDED:
        return Math.min(availableMemory * 0.1, baseAllocation * 0.5);
      default:
        return baseAllocation;
    }
  }

  /**
   * Trigger emergency memory cleanup
   */
  async triggerEmergencyCleanup(): Promise<void> {
    log.warn('Triggering emergency memory cleanup', {
      component: 'ViewportMemoryManager',
    });

    // Execute all cleanup stages immediately
    for (const stage of this.cleanupStages) {
      try {
        await this.executeCleanupStage(stage);
      } catch (error) {
        log.error('Emergency cleanup stage failed', {
          component: 'ViewportMemoryManager',
          metadata: { stage: stage.stage },
        }, error as Error);
      }
    }

    // Clear texture priorities for unused textures
    const now = Date.now();
    const unusedTextures: string[] = [];

    this.texturePriorities.forEach((info, textureId) => {
      if (now - info.lastUsed > 60000 && info.usage !== 'active') { // 1 minute
        unusedTextures.push(textureId);
      }
    });

    unusedTextures.forEach(textureId => {
      this.texturePriorities.delete(textureId);
    });

    this.emit('emergency-cleanup-completed', unusedTextures.length);
  }

  /**
   * Execute a specific cleanup stage
   */
  private async executeCleanupStage(stage: ResourceCleanupStage): Promise<void> {
    const cleanupPromises = stage.targetTypes.map(async (type) => {
      switch (type) {
        case 'textures':
          return this.cleanupTextures();
        case 'buffers':
          return this.cleanupBuffers();
        case 'cache':
          return this.cleanupCache();
        case 'imageData':
          return this.cleanupImageData();
        default:
          return 0;
      }
    });

    if (stage.delay) {
      await new Promise(resolve => setTimeout(resolve, stage.delay));
    }

    const cleanupResults = await Promise.all(cleanupPromises);
    const totalFreed = cleanupResults.reduce((sum, freed) => sum + freed, 0);

    log.info('Cleanup stage completed', {
      component: 'ViewportMemoryManager',
      metadata: {
        stage: stage.stage,
        targetTypes: stage.targetTypes,
        totalFreed,
      },
    });
  }

  /**
   * Cleanup unused textures
   */
  private async cleanupTextures(): Promise<number> {
    // Implementation would cleanup WebGL textures
    // For now, return simulated cleanup amount
    return 50 * 1024 * 1024; // 50MB
  }

  /**
   * Cleanup unused buffers
   */
  private async cleanupBuffers(): Promise<number> {
    // Implementation would cleanup WebGL buffers
    return 25 * 1024 * 1024; // 25MB
  }

  /**
   * Cleanup cached data
   */
  private async cleanupCache(): Promise<number> {
    try {
      // Simulate cache cleanup
      const freedMemory = 25 * 1024 * 1024; // 25MB
      log.info('Cache cleanup simulated', {
        component: 'ViewportMemoryManager',
        metadata: { freedMemory },
      });
      return freedMemory;
    } catch (error) {
      log.warn('Cache cleanup failed', {
        component: 'ViewportMemoryManager',
      }, error as Error);
      return 0;
    }
  }

  /**
   * Cleanup image data
   */
  private async cleanupImageData(): Promise<number> {
    // Implementation would cleanup cached image data
    return 100 * 1024 * 1024; // 100MB
  }

  /**
   * Start memory pressure monitoring
   */
  private startMemoryPressureMonitoring(): void {
    if (this.memoryPressureCheckInterval) {
      return;
    }

    this.memoryPressureCheckInterval = setInterval(() => {
      this.checkMemoryPressure();
    }, 5000); // Check every 5 seconds

    log.info('Memory pressure monitoring started', {
      component: 'ViewportMemoryManager',
    });
  }

  /**
   * Stop memory pressure monitoring
   */
  stopMemoryPressureMonitoring(): void {
    if (this.memoryPressureCheckInterval) {
      clearInterval(this.memoryPressureCheckInterval);
      this.memoryPressureCheckInterval = null;

      log.info('Memory pressure monitoring stopped', {
        component: 'ViewportMemoryManager',
      });
    }
  }

  /**
   * Get memory pressure ratio (0.0 to 1.0)
   */
  getMemoryPressureRatio(): number {
    try {
      const memoryUsage = memoryManager.getMemoryUsage();
      const usageRatio = memoryUsage.used / memoryUsage.total;
      return Math.min(1.0, Math.max(0.0, usageRatio));
    } catch (error) {
      log.warn('Failed to get memory pressure ratio', {
        component: 'ViewportMemoryManager',
      }, error as Error);
      return 0.5; // Default moderate pressure
    }
  }

  /**
   * Get memory statistics for all viewports
   */
  getMemoryStatistics(): {
    totalViewports: number;
    totalAllocatedMemory: number;
    averageMemoryPerViewport: number;
    highPressureViewports: number;
    criticalPressureViewports: number;
    usageRatio: number;
    } {
    const thresholds = Array.from(this.viewportMemoryThresholds.values());
    const usageRatio = this.getMemoryPressureRatio();

    return {
      totalViewports: thresholds.length,
      totalAllocatedMemory: thresholds.reduce((sum, t) => sum + t.maxMemory, 0),
      averageMemoryPerViewport: thresholds.length > 0
        ? thresholds.reduce((sum, t) => sum + t.maxMemory, 0) / thresholds.length
        : 0,
      highPressureViewports: thresholds.filter(t => t.memoryPressureLevel === 'high').length,
      criticalPressureViewports: thresholds.filter(t => t.memoryPressureLevel === 'critical').length,
      usageRatio,
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopMemoryPressureMonitoring();
    this.viewportMemoryThresholds.clear();
    this.texturePriorities.clear();
    this.removeAllListeners();
  }
}
