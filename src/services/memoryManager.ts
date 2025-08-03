/**
 * Memory Manager Service
 * Advanced memory management system for medical imaging viewport resources
 * Built with security compliance and type safety
 */

import { EventEmitter } from 'events';
import { viewportStateManager } from './viewportStateManager';
import { log } from '../utils/logger';

// Memory usage tracking interface
export interface MemoryUsage {
  total: number;
  used: number;
  available: number;
  viewportAllocations: Map<string, number>;
  textureMemory: number;
  bufferMemory: number;
  cacheMemory: number;
}

// Resource cleanup priority levels
export enum CleanupPriority {
  LOW = 0,      // Clean when memory usage > 50%
  MEDIUM = 1,   // Clean when memory usage > 70%
  HIGH = 2,     // Clean when memory usage > 85%
  CRITICAL = 3, // Clean when memory usage > 95%
}

// Memory management configuration
export interface MemoryConfig {
  maxTotalMemory: number;        // Maximum total memory in bytes
  maxViewportMemory: number;     // Maximum per-viewport memory in bytes
  cleanupThresholds: number[];   // Cleanup thresholds for each priority level
  textureTimeout: number;        // Texture cache timeout in ms
  bufferTimeout: number;         // Buffer cache timeout in ms
  enableAggressive: boolean;     // Enable aggressive memory cleanup
  retentionTime: number;         // How long to retain inactive resources
}

// Resource tracking interface
interface ResourceTracker {
  id: string;
  type: 'texture' | 'buffer' | 'cache' | 'imageData';
  size: number;
  lastUsed: number;
  viewportId: string;
  isActive: boolean;
  priority: CleanupPriority;
}

// Memory statistics interface
export interface MemoryStats {
  totalAllocated: number;
  totalFreed: number;
  currentUsage: number;
  peakUsage: number;
  cleanupCount: number;
  averageViewportMemory: number;
  resourceCounts: {
    textures: number;
    buffers: number;
    caches: number;
    imageData: number;
  };
}

// Default memory configuration
const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  maxTotalMemory: 4 * 1024 * 1024 * 1024, // 4GB
  maxViewportMemory: 512 * 1024 * 1024,   // 512MB per viewport
  cleanupThresholds: [0.5, 0.7, 0.85, 0.95],
  textureTimeout: 5 * 60 * 1000,          // 5 minutes
  bufferTimeout: 10 * 60 * 1000,          // 10 minutes
  enableAggressive: false,
  retentionTime: 2 * 60 * 1000,           // 2 minutes
};

// Memory manager events
export interface MemoryManagerEvents {
  'memory-warning': [MemoryUsage, CleanupPriority];
  'memory-critical': [MemoryUsage];
  'cleanup-started': [CleanupPriority, number]; // priority, estimated bytes to free
  'cleanup-completed': [number, number]; // bytes freed, resources cleaned
  'memory-stats': [MemoryStats];
  'resource-allocated': [string, ResourceTracker];
  'resource-freed': [string, number]; // resource id, bytes freed
}

export class MemoryManager extends EventEmitter {
  private readonly config: MemoryConfig;
  private readonly resources = new Map<string, ResourceTracker>();
  private readonly stats: MemoryStats;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private statsInterval: NodeJS.Timeout | null = null;
  private lastCleanupTime = 0;
  private readonly CLEANUP_DEBOUNCE_MS = 1000; // 1 second debounce

  constructor(config: Partial<MemoryConfig> = {}) {
    super();

    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };

    // Initialize statistics
    this.stats = {
      totalAllocated: 0,
      totalFreed: 0,
      currentUsage: 0,
      peakUsage: 0,
      cleanupCount: 0,
      averageViewportMemory: 0,
      resourceCounts: {
        textures: 0,
        buffers: 0,
        caches: 0,
        imageData: 0,
      },
    };

    // Start monitoring systems
    this.startMemoryMonitoring();
    this.startStatsCollection();

    log.info('MemoryManager initialized', {
      component: 'MemoryManager',
      metadata: {
        maxTotalMemory: this.config.maxTotalMemory,
        maxViewportMemory: this.config.maxViewportMemory,
        aggressiveMode: this.config.enableAggressive,
      },
    });
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage(): MemoryUsage {
    const totalUsed = Array.from(this.resources.values())
      .reduce((sum, resource) => sum + resource.size, 0);

    const viewportAllocations = new Map<string, number>();
    this.resources.forEach(resource => {
      const current = viewportAllocations.get(resource.viewportId) || 0;
      viewportAllocations.set(resource.viewportId, current + resource.size);
    });

    // Calculate memory breakdown
    const textureMemory = Array.from(this.resources.values())
      .filter(r => r.type === 'texture')
      .reduce((sum, r) => sum + r.size, 0);

    const bufferMemory = Array.from(this.resources.values())
      .filter(r => r.type === 'buffer')
      .reduce((sum, r) => sum + r.size, 0);

    const cacheMemory = Array.from(this.resources.values())
      .filter(r => r.type === 'cache')
      .reduce((sum, r) => sum + r.size, 0);

    return {
      total: this.config.maxTotalMemory,
      used: totalUsed,
      available: this.config.maxTotalMemory - totalUsed,
      viewportAllocations,
      textureMemory,
      bufferMemory,
      cacheMemory,
    };
  }

  /**
   * Track resource allocation
   */
  trackResource(
    id: string,
    type: ResourceTracker['type'],
    size: number,
    viewportId: string,
    priority: CleanupPriority = CleanupPriority.MEDIUM,
  ): void {
    const resource: ResourceTracker = {
      id,
      type,
      size,
      lastUsed: Date.now(),
      viewportId,
      isActive: true,
      priority,
    };

    this.resources.set(id, resource);
    this.stats.totalAllocated += size;
    this.stats.currentUsage += size;
    this.stats.resourceCounts[`${type}s` as keyof typeof this.stats.resourceCounts]++;

    // Update peak usage
    if (this.stats.currentUsage > this.stats.peakUsage) {
      this.stats.peakUsage = this.stats.currentUsage;
    }

    this.emit('resource-allocated', id, resource);

    log.info('Resource tracked', {
      component: 'MemoryManager',
      metadata: { id, type, size, viewportId, currentUsage: this.stats.currentUsage },
    });

    // Check if cleanup is needed
    this.checkMemoryPressure();
  }

  /**
   * Untrack resource (when freed)
   */
  untrackResource(id: string): boolean {
    const resource = this.resources.get(id);
    if (!resource) {
      return false;
    }

    this.resources.delete(id);
    this.stats.totalFreed += resource.size;
    this.stats.currentUsage -= resource.size;
    this.stats.resourceCounts[`${resource.type}s` as keyof typeof this.stats.resourceCounts]--;

    this.emit('resource-freed', id, resource.size);

    log.info('Resource untracked', {
      component: 'MemoryManager',
      metadata: { id, type: resource.type, size: resource.size },
    });

    return true;
  }

  /**
   * Update resource last used time
   */
  touchResource(id: string): void {
    const resource = this.resources.get(id);
    if (resource) {
      resource.lastUsed = Date.now();
      resource.isActive = true;
    }
  }

  /**
   * Mark viewport resources as inactive
   */
  markViewportInactive(viewportId: string): void {
    this.resources.forEach(resource => {
      if (resource.viewportId === viewportId) {
        resource.isActive = false;
      }
    });

    log.info('Viewport resources marked inactive', {
      component: 'MemoryManager',
      metadata: { viewportId },
    });

    // Schedule cleanup check
    this.scheduleCleanup();
  }

  /**
   * Mark viewport resources as active
   */
  markViewportActive(viewportId: string): void {
    const now = Date.now();
    this.resources.forEach(resource => {
      if (resource.viewportId === viewportId) {
        resource.isActive = true;
        resource.lastUsed = now;
      }
    });

    log.info('Viewport resources marked active', {
      component: 'MemoryManager',
      metadata: { viewportId },
    });
  }

  /**
   * Force cleanup for specific viewport
   */
  cleanupViewport(viewportId: string): number {
    let bytesFreed = 0;
    const resourcesToDelete: string[] = [];

    this.resources.forEach((resource, id) => {
      if (resource.viewportId === viewportId && !resource.isActive) {
        resourcesToDelete.push(id);
        bytesFreed += resource.size;
      }
    });

    // Actually free the resources
    resourcesToDelete.forEach(id => {
      this.freeResource(id);
    });

    log.info('Viewport cleanup completed', {
      component: 'MemoryManager',
      metadata: { viewportId, bytesFreed, resourcesFreed: resourcesToDelete.length },
    });

    return bytesFreed;
  }

  /**
   * Perform memory cleanup based on priority
   */
  performCleanup(priority: CleanupPriority = CleanupPriority.MEDIUM): number {
    const now = Date.now();
    let bytesFreed = 0;
    const resourcesToClean: string[] = [];

    // Find resources eligible for cleanup
    this.resources.forEach((resource, id) => {
      const shouldCleanup = this.shouldCleanupResource(resource, priority, now);
      if (shouldCleanup) {
        resourcesToClean.push(id);
        bytesFreed += resource.size;
      }
    });

    this.emit('cleanup-started', priority, bytesFreed);

    // Perform the actual cleanup
    resourcesToClean.forEach(id => {
      this.freeResource(id);
    });

    this.stats.cleanupCount++;
    this.lastCleanupTime = now;

    this.emit('cleanup-completed', bytesFreed, resourcesToClean.length);

    log.info('Memory cleanup completed', {
      component: 'MemoryManager',
      metadata: {
        priority: CleanupPriority[priority],
        bytesFreed,
        resourcesFreed: resourcesToClean.length,
      },
    });

    return bytesFreed;
  }

  /**
   * Get memory statistics
   */
  getStats(): MemoryStats {
    // Update average viewport memory
    const viewportCount = viewportStateManager.getViewportCount();
    this.stats.averageViewportMemory = viewportCount > 0
      ? this.stats.currentUsage / viewportCount
      : 0;

    return { ...this.stats };
  }

  /**
   * Get cleanup suggestions
   */
  getCleanupSuggestions(): string[] {
    const suggestions: string[] = [];
    const usage = this.getMemoryUsage();
    const memoryRatio = usage.used / usage.total;

    if (memoryRatio > 0.8) {
      suggestions.push('Memory usage is high - consider cleaning up inactive viewport resources');
    }

    if (usage.textureMemory > usage.used * 0.6) {
      suggestions.push('Texture memory is dominant - clean up unused textures');
    }

    if (usage.cacheMemory > usage.used * 0.3) {
      suggestions.push('Cache memory is large - consider reducing cache retention time');
    }

    const inactiveResources = Array.from(this.resources.values())
      .filter(r => !r.isActive).length;

    if (inactiveResources > this.resources.size * 0.4) {
      suggestions.push(`${inactiveResources} inactive resources can be cleaned up`);
    }

    return suggestions;
  }

  /**
   * Check memory pressure and trigger cleanup if needed
   */
  private checkMemoryPressure(): void {
    const usage = this.getMemoryUsage();
    const memoryRatio = usage.used / usage.total;

    // Check against each threshold
    for (let i = this.config.cleanupThresholds.length - 1; i >= 0; i--) {
      const threshold = this.config.cleanupThresholds[i];

      if (memoryRatio > threshold) {
        const priority = i as CleanupPriority;

        if (priority === CleanupPriority.CRITICAL) {
          this.emit('memory-critical', usage);
          // Immediate aggressive cleanup
          this.performCleanup(CleanupPriority.CRITICAL);
        } else {
          this.emit('memory-warning', usage, priority);
          // Schedule cleanup with debouncing
          this.scheduleCleanup(priority);
        }
        break;
      }
    }
  }

  /**
   * Schedule cleanup with debouncing
   */
  private scheduleCleanup(priority: CleanupPriority = CleanupPriority.MEDIUM): void {
    const now = Date.now();

    // Debounce cleanup operations
    if (now - this.lastCleanupTime < this.CLEANUP_DEBOUNCE_MS) {
      return;
    }

    setTimeout(() => {
      this.performCleanup(priority);
    }, this.CLEANUP_DEBOUNCE_MS);
  }

  /**
   * Determine if resource should be cleaned up
   */
  private shouldCleanupResource(
    resource: ResourceTracker,
    priority: CleanupPriority,
    currentTime: number,
  ): boolean {
    // Never cleanup active resources unless critical
    if (resource.isActive && priority < CleanupPriority.CRITICAL) {
      return false;
    }

    // Check resource age
    const age = currentTime - resource.lastUsed;

    // Get timeout based on resource type
    let timeout: number;
    switch (resource.type) {
      case 'texture':
        timeout = this.config.textureTimeout;
        break;
      case 'buffer':
        timeout = this.config.bufferTimeout;
        break;
      default:
        timeout = this.config.retentionTime;
    }

    // Adjust timeout based on priority
    switch (priority) {
      case CleanupPriority.CRITICAL:
        timeout *= 0.1; // Very aggressive
        break;
      case CleanupPriority.HIGH:
        timeout *= 0.5; // Aggressive
        break;
      case CleanupPriority.MEDIUM:
        timeout *= 0.8; // Moderate
        break;
      case CleanupPriority.LOW:
      default:
        // Use full timeout
        break;
    }

    // Check if resource is old enough and has appropriate priority
    return age > timeout && resource.priority <= priority;
  }

  /**
   * Actually free a resource
   */
  private freeResource(id: string): boolean {
    const resource = this.resources.get(id);
    if (!resource) {
      return false;
    }

    // In a real implementation, this would free the actual WebGL resources
    // For now, we just remove it from tracking
    return this.untrackResource(id);
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.checkMemoryPressure();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Start statistics collection
   */
  private startStatsCollection(): void {
    if (this.statsInterval) return;

    this.statsInterval = setInterval(() => {
      const stats = this.getStats();
      this.emit('memory-stats', stats);
    }, 30000); // Emit stats every 30 seconds
  }

  /**
   * Clean up and dispose
   */
  dispose(): void {
    // Stop monitoring
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    // Free all tracked resources
    this.resources.clear();

    // Reset stats
    Object.assign(this.stats, {
      totalAllocated: 0,
      totalFreed: 0,
      currentUsage: 0,
      peakUsage: 0,
      cleanupCount: 0,
      averageViewportMemory: 0,
      resourceCounts: {
        textures: 0,
        buffers: 0,
        caches: 0,
        imageData: 0,
      },
    });

    // Remove all listeners
    this.removeAllListeners();

    log.info('MemoryManager disposed', {
      component: 'MemoryManager',
    });
  }
}

// Export singleton instance
export const memoryManager = new MemoryManager();
export default memoryManager;
