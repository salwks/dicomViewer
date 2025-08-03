/**
 * Lazy Loading Manager Service
 * Advanced lazy loading system for delayed loading of inactive viewport content
 * Task 30.3: Implement Lazy Loading Mechanism
 */

import { EventEmitter } from 'events';
import { log } from '../utils/logger';

export interface LazyLoadableResource {
  id: string;
  type: 'image' | 'texture' | 'mesh' | 'volume' | 'annotation' | 'metadata';
  viewportId: string;
  priority: number;
  size: number;
  url?: string;
  loadState: 'unloaded' | 'loading' | 'loaded' | 'error' | 'expired';
  loadPromise?: Promise<any>;
  content?: any;
  dependencies: string[];
  loadTime?: number;
  lastAccessed: number;
  accessCount: number;
  retentionPolicy: ResourceRetentionPolicy;
}

export interface ResourceRetentionPolicy {
  maxAge: number; // milliseconds
  maxIdleTime: number; // milliseconds
  keepInMemory: boolean;
  canCompress: boolean;
  priority: number;
}

export interface LoadingStrategy {
  name: string;
  description: string;
  priority: number;
  shouldLoad: (resource: LazyLoadableResource, context: LoadingContext) => boolean;
  loadResource: (resource: LazyLoadableResource) => Promise<any>;
  unloadResource: (resource: LazyLoadableResource) => Promise<void>;
}

export interface LoadingContext {
  activeViewports: Set<string>;
  visibleViewports: Set<string>;
  memoryPressure: number; // 0-1
  networkBandwidth: number; // bytes/sec
  currentTime: number;
  userInteractionState: 'idle' | 'navigating' | 'interacting';
}

export interface LoadingQueue {
  high: LazyLoadableResource[];
  medium: LazyLoadableResource[];
  low: LazyLoadableResource[];
  background: LazyLoadableResource[];
}

export interface LazyLoadingConfig {
  maxConcurrentLoads: number;
  loadingTimeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  prefetchDistance: number; // How many resources ahead to prefetch
  memoryThreshold: number; // 0-1, when to start unloading
  networkThreshold: number; // bytes/sec, minimum for aggressive loading
  strategies: LoadingStrategy[];
  enablePredictiveLoading: boolean;
  enableIntersectionObserver: boolean;
  preloadCriticalResources: boolean;
}

export const DEFAULT_LAZY_LOADING_CONFIG: LazyLoadingConfig = {
  maxConcurrentLoads: 4,
  loadingTimeoutMs: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelayMs: 1000,
  prefetchDistance: 2,
  memoryThreshold: 0.8,
  networkThreshold: 1024 * 1024, // 1MB/s
  strategies: [],
  enablePredictiveLoading: true,
  enableIntersectionObserver: true,
  preloadCriticalResources: true,
};

export interface LazyLoadingManagerEvents {
  'resource-loading-started': [LazyLoadableResource];
  'resource-loaded': [LazyLoadableResource, number]; // [resource, loadTime]
  'resource-load-failed': [LazyLoadableResource, Error];
  'resource-unloaded': [LazyLoadableResource];
  'resources-prefetched': [LazyLoadableResource[], number]; // [resources, totalTime]
  'memory-pressure-detected': [number, string]; // [pressure, action]
  'loading-queue-updated': [LoadingQueue];
  'predictive-load-triggered': [LazyLoadableResource[], string]; // [resources, reason]
}

export class LazyLoadingManager extends EventEmitter {
  private config: LazyLoadingConfig;
  private resources = new Map<string, LazyLoadableResource>();
  private loadingQueue: LoadingQueue = { high: [], medium: [], low: [], background: [] };
  private currentlyLoading = new Set<string>();
  private loadingWorkers: Promise<void>[] = [];
  private intersectionObserver?: IntersectionObserver;
  private loadingInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Performance tracking
  private stats = {
    totalResourcesRegistered: 0,
    totalResourcesLoaded: 0,
    totalResourcesUnloaded: 0,
    totalLoadTime: 0,
    averageLoadTime: 0,
    cacheHitRate: 0,
    memoryUsed: 0,
    predictiveLoadsTriggered: 0,
  };

  // Predictive loading
  private accessPatterns = new Map<string, number[]>(); // viewportId -> access times
  private loadingPredictions = new Map<string, LazyLoadableResource[]>();

  constructor(config: Partial<LazyLoadingConfig> = {}) {
    super();
    this.config = { ...DEFAULT_LAZY_LOADING_CONFIG, ...config };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    log.info('LazyLoadingManager initializing', {
      component: 'LazyLoadingManager',
      metadata: {
        maxConcurrentLoads: this.config.maxConcurrentLoads,
        enablePredictiveLoading: this.config.enablePredictiveLoading,
      },
    });

    // Load built-in loading strategies
    this.loadBuiltInStrategies();

    // Start loading workers
    this.startLoadingWorkers();

    // Setup intersection observer for viewport visibility
    if (this.config.enableIntersectionObserver) {
      this.setupIntersectionObserver();
    }

    // Start background tasks
    this.startBackgroundTasks();
  }

  // ===== Public API =====

  /**
   * Register a resource for lazy loading
   */
  public registerResource(
    id: string,
    type: LazyLoadableResource['type'],
    viewportId: string,
    options: {
      priority?: number;
      size?: number;
      url?: string;
      dependencies?: string[];
      retentionPolicy?: Partial<ResourceRetentionPolicy>;
    } = {},
  ): void {
    const resource: LazyLoadableResource = {
      id,
      type,
      viewportId,
      priority: options.priority || 5,
      size: options.size || 0,
      url: options.url,
      loadState: 'unloaded',
      dependencies: options.dependencies || [],
      lastAccessed: Date.now(),
      accessCount: 0,
      retentionPolicy: {
        maxAge: 30 * 60 * 1000, // 30 minutes
        maxIdleTime: 5 * 60 * 1000, // 5 minutes
        keepInMemory: false,
        canCompress: true,
        priority: options.priority || 5,
        ...options.retentionPolicy,
      },
    };

    this.resources.set(id, resource);
    this.stats.totalResourcesRegistered++;

    log.info('Resource registered for lazy loading', {
      component: 'LazyLoadingManager',
      metadata: { id, type, viewportId, priority: resource.priority },
    });
  }

  /**
   * Load resource immediately (bypass lazy loading)
   */
  public async loadResource(resourceId: string): Promise<any> {
    const resource = this.resources.get(resourceId);
    if (!resource) {
      throw new Error(`Resource not found: ${resourceId}`);
    }

    if (resource.loadState === 'loaded') {
      this.updateAccessTracking(resource);
      return resource.content;
    }

    if (resource.loadState === 'loading') {
      return resource.loadPromise;
    }

    return this.performResourceLoad(resource);
  }

  /**
   * Queue resource for lazy loading
   */
  public queueResource(resourceId: string, queueType: keyof LoadingQueue = 'medium'): void {
    const resource = this.resources.get(resourceId);
    if (!resource || resource.loadState !== 'unloaded') {
      return;
    }

    // Remove from other queues first
    this.removeFromAllQueues(resource);

    // Add to specified queue
    this.loadingQueue[queueType].push(resource);
    this.sortQueue(queueType);

    this.emit('loading-queue-updated', { ...this.loadingQueue });
  }

  /**
   * Unload resource to free memory
   */
  public async unloadResource(resourceId: string): Promise<boolean> {
    const resource = this.resources.get(resourceId);
    if (!resource || resource.loadState !== 'loaded') {
      return false;
    }

    try {
      // Find appropriate strategy to unload
      const strategy = this.findUnloadingStrategy(resource);
      if (strategy) {
        await strategy.unloadResource(resource);
      }

      resource.loadState = 'unloaded';
      resource.content = undefined;
      resource.loadPromise = undefined;
      resource.loadTime = undefined;

      this.stats.totalResourcesUnloaded++;
      this.updateMemoryStats();

      this.emit('resource-unloaded', resource);

      log.info('Resource unloaded', {
        component: 'LazyLoadingManager',
        metadata: { resourceId, type: resource.type },
      });

      return true;

    } catch (error) {
      log.error('Failed to unload resource', {
        component: 'LazyLoadingManager',
        metadata: { resourceId },
      }, error as Error);
      return false;
    }
  }

  /**
   * Optimize loading for specific viewports
   */
  public optimizeForViewports(
    activeViewports: string[],
    visibleViewports: string[],
    memoryPressure: number = 0,
  ): void {
    const context: LoadingContext = {
      activeViewports: new Set(activeViewports),
      visibleViewports: new Set(visibleViewports),
      memoryPressure,
      networkBandwidth: this.estimateNetworkBandwidth(),
      currentTime: Date.now(),
      userInteractionState: this.getUserInteractionState(),
    };

    // Update access patterns for predictive loading
    if (this.config.enablePredictiveLoading) {
      this.updateAccessPatterns(activeViewports);
    }

    // Prioritize resources for active/visible viewports
    this.reprioritizeResources(context);

    // Trigger predictive loading
    if (this.config.enablePredictiveLoading) {
      this.triggerPredictiveLoading(context);
    }

    // Handle memory pressure
    if (memoryPressure > this.config.memoryThreshold) {
      this.handleMemoryPressure(memoryPressure);
    }

    log.info('Loading optimization applied', {
      component: 'LazyLoadingManager',
      metadata: {
        activeViewports: activeViewports.length,
        visibleViewports: visibleViewports.length,
        memoryPressure,
      },
    });
  }

  /**
   * Prefetch resources based on predictions
   */
  public async prefetchResources(viewportIds: string[]): Promise<void> {
    const startTime = Date.now();
    const resourcesToPrefetch: LazyLoadableResource[] = [];

    for (const viewportId of viewportIds) {
      const viewportResources = Array.from(this.resources.values())
        .filter(r => r.viewportId === viewportId && r.loadState === 'unloaded')
        .sort((a, b) => b.priority - a.priority)
        .slice(0, this.config.prefetchDistance);

      resourcesToPrefetch.push(...viewportResources);
    }

    if (resourcesToPrefetch.length === 0) {
      return;
    }

    // Queue for loading
    resourcesToPrefetch.forEach(resource => {
      this.queueResource(resource.id, 'background');
    });

    const totalTime = Date.now() - startTime;
    this.emit('resources-prefetched', resourcesToPrefetch, totalTime);

    log.info('Resources prefetched', {
      component: 'LazyLoadingManager',
      metadata: {
        resourceCount: resourcesToPrefetch.length,
        viewportIds,
        totalTime,
      },
    });
  }

  /**
   * Get loading statistics
   */
  public getStatistics(): {
    totalResources: number;
    loadedResources: number;
    pendingResources: number;
    failedResources: number;
    memoryUsage: number;
    averageLoadTime: number;
    cacheHitRate: number;
    } {
    const resourcesByState = {
      unloaded: 0,
      loading: 0,
      loaded: 0,
      error: 0,
      expired: 0,
    };

    this.resources.forEach(resource => {
      resourcesByState[resource.loadState]++;
    });

    return {
      totalResources: this.resources.size,
      loadedResources: resourcesByState.loaded,
      pendingResources: resourcesByState.loading,
      failedResources: resourcesByState.error,
      memoryUsage: this.stats.memoryUsed,
      averageLoadTime: this.stats.averageLoadTime,
      cacheHitRate: this.stats.cacheHitRate,
    };
  }

  // ===== Private Implementation =====

  private async performResourceLoad(resource: LazyLoadableResource): Promise<any> {
    if (this.currentlyLoading.has(resource.id)) {
      return resource.loadPromise;
    }

    resource.loadState = 'loading';
    this.currentlyLoading.add(resource.id);
    this.emit('resource-loading-started', resource);

    const startTime = Date.now();
    const loadPromise = this.executeLoadingStrategy(resource);
    resource.loadPromise = loadPromise;

    try {
      const content = await loadPromise;

      resource.content = content;
      resource.loadState = 'loaded';
      resource.loadTime = Date.now() - startTime;

      this.updateAccessTracking(resource);
      this.updateLoadingStats(resource);

      this.emit('resource-loaded', resource, resource.loadTime);

      return content;

    } catch (error) {
      resource.loadState = 'error';
      this.emit('resource-load-failed', resource, error as Error);
      throw error;

    } finally {
      this.currentlyLoading.delete(resource.id);
      resource.loadPromise = undefined;
    }
  }

  private async executeLoadingStrategy(resource: LazyLoadableResource): Promise<any> {
    // Find appropriate loading strategy
    const strategy = this.findLoadingStrategy(resource);
    if (!strategy) {
      throw new Error(`No loading strategy found for resource type: ${resource.type}`);
    }

    // Load dependencies first
    if (resource.dependencies.length > 0) {
      await this.loadDependencies(resource);
    }

    // Execute loading with timeout and retry
    return this.executeWithRetry(
      () => strategy.loadResource(resource),
      this.config.retryAttempts,
      this.config.retryDelayMs,
    );
  }

  private async loadDependencies(resource: LazyLoadableResource): Promise<void> {
    const dependencyPromises = resource.dependencies.map(depId => {
      const dependency = this.resources.get(depId);
      if (dependency && dependency.loadState === 'unloaded') {
        return this.performResourceLoad(dependency);
      }
      return Promise.resolve();
    });

    await Promise.all(dependencyPromises);
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    attempts: number,
    delay: number,
  ): Promise<T> {
    let lastError: Error;

    for (let i = 0; i < attempts; i++) {
      try {
        return await Promise.race([
          operation(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Loading timeout')), this.config.loadingTimeoutMs),
          ),
        ]);
      } catch (error) {
        lastError = error as Error;
        if (i < attempts - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
      }
    }

    throw lastError!;
  }

  private findLoadingStrategy(resource: LazyLoadableResource): LoadingStrategy | null {
    return this.config.strategies.find(strategy =>
      strategy.shouldLoad && strategy.shouldLoad(resource, this.getCurrentContext()),
    ) || null;
  }

  private findUnloadingStrategy(_resource: LazyLoadableResource): LoadingStrategy | null {
    return this.config.strategies.find(strategy => strategy.unloadResource) || null;
  }

  private getCurrentContext(): LoadingContext {
    return {
      activeViewports: new Set(),
      visibleViewports: new Set(),
      memoryPressure: 0,
      networkBandwidth: this.estimateNetworkBandwidth(),
      currentTime: Date.now(),
      userInteractionState: this.getUserInteractionState(),
    };
  }

  private estimateNetworkBandwidth(): number {
    // Simple bandwidth estimation - in reality, this would use Navigator API
    return 5 * 1024 * 1024; // 5MB/s default
  }

  private getUserInteractionState(): 'idle' | 'navigating' | 'interacting' {
    // Simple heuristic - in reality, this would track user interactions
    return 'idle';
  }

  private reprioritizeResources(context: LoadingContext): void {
    this.resources.forEach(resource => {
      let priorityBoost = 0;

      if (context.activeViewports.has(resource.viewportId)) {
        priorityBoost += 10;
      } else if (context.visibleViewports.has(resource.viewportId)) {
        priorityBoost += 5;
      }

      // Boost critical resources
      if (resource.type === 'image' || resource.type === 'volume') {
        priorityBoost += 3;
      }

      // Apply priority boost temporarily
      const originalPriority = resource.retentionPolicy.priority;
      resource.priority = Math.min(10, originalPriority + priorityBoost);
    });
  }

  private updateAccessPatterns(activeViewports: string[]): void {
    const now = Date.now();

    activeViewports.forEach(viewportId => {
      if (!this.accessPatterns.has(viewportId)) {
        this.accessPatterns.set(viewportId, []);
      }

      const pattern = this.accessPatterns.get(viewportId)!;
      pattern.push(now);

      // Keep only recent access times (last hour)
      const hourAgo = now - 60 * 60 * 1000;
      const recentAccesses = pattern.filter(time => time > hourAgo);
      this.accessPatterns.set(viewportId, recentAccesses);
    });
  }

  private triggerPredictiveLoading(context: LoadingContext): void {
    // Predict next likely viewports based on access patterns
    const predictions = this.generateLoadingPredictions(context);

    if (predictions.length > 0) {
      predictions.forEach(resource => {
        if (resource.loadState === 'unloaded') {
          this.queueResource(resource.id, 'background');
        }
      });

      this.stats.predictiveLoadsTriggered++;
      this.emit('predictive-load-triggered', predictions, 'access-pattern-analysis');
    }
  }

  private generateLoadingPredictions(context: LoadingContext): LazyLoadableResource[] {
    const predictions: LazyLoadableResource[] = [];

    // Simple prediction: resources from recently accessed viewports
    context.activeViewports.forEach(viewportId => {
      const pattern = this.accessPatterns.get(viewportId);
      if (pattern && pattern.length > 1) {
        // Find unloaded resources for this viewport
        const unloadedResources = Array.from(this.resources.values())
          .filter(r => r.viewportId === viewportId && r.loadState === 'unloaded')
          .sort((a, b) => b.priority - a.priority)
          .slice(0, 2); // Predict top 2 resources

        predictions.push(...unloadedResources);
      }
    });

    return predictions;
  }

  private handleMemoryPressure(pressure: number): void {
    let action = '';

    if (pressure > 0.9) {
      // Critical pressure - unload low-priority resources
      action = 'unloading-low-priority-resources';
      this.unloadLowPriorityResources();
    } else if (pressure > this.config.memoryThreshold) {
      // High pressure - pause background loading
      action = 'pausing-background-loading';
      this.loadingQueue.background = [];
    }

    if (action) {
      this.emit('memory-pressure-detected', pressure, action);
    }
  }

  private async unloadLowPriorityResources(): Promise<void> {
    const lowPriorityResources = Array.from(this.resources.values())
      .filter(r => r.loadState === 'loaded' && r.priority < 5)
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 10); // Unload up to 10 resources

    for (const resource of lowPriorityResources) {
      await this.unloadResource(resource.id);
    }
  }

  private updateAccessTracking(resource: LazyLoadableResource): void {
    resource.lastAccessed = Date.now();
    resource.accessCount++;
  }

  private updateLoadingStats(resource: LazyLoadableResource): void {
    this.stats.totalResourcesLoaded++;

    if (resource.loadTime) {
      this.stats.totalLoadTime += resource.loadTime;
      this.stats.averageLoadTime = this.stats.totalLoadTime / this.stats.totalResourcesLoaded;
    }

    this.updateMemoryStats();
  }

  private updateMemoryStats(): void {
    this.stats.memoryUsed = Array.from(this.resources.values())
      .filter(r => r.loadState === 'loaded')
      .reduce((sum, r) => sum + r.size, 0);
  }

  private removeFromAllQueues(resource: LazyLoadableResource): void {
    Object.keys(this.loadingQueue).forEach(queueType => {
      const queue = this.loadingQueue[queueType as keyof LoadingQueue];
      const index = queue.indexOf(resource);
      if (index !== -1) {
        queue.splice(index, 1);
      }
    });
  }

  private sortQueue(queueType: keyof LoadingQueue): void {
    this.loadingQueue[queueType].sort((a, b) => b.priority - a.priority);
  }

  private loadBuiltInStrategies(): void {
    const strategies: LoadingStrategy[] = [
      {
        name: 'Image Loading Strategy',
        description: 'Loads DICOM images and textures',
        priority: 10,
        shouldLoad: (resource) => resource.type === 'image' || resource.type === 'texture',
        loadResource: async (resource) => {
          // Simulate image loading
          await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));
          return { type: resource.type, data: `loaded-${resource.id}`, size: resource.size };
        },
        unloadResource: async (_resource) => {
          // Simulate unloading
          await new Promise(resolve => setTimeout(resolve, 10));
        },
      },
      {
        name: 'Volume Loading Strategy',
        description: 'Loads 3D volume data',
        priority: 9,
        shouldLoad: (resource) => resource.type === 'volume',
        loadResource: async (resource) => {
          // Simulate volume loading
          await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
          return { type: resource.type, data: `loaded-${resource.id}`, size: resource.size };
        },
        unloadResource: async (_resource) => {
          await new Promise(resolve => setTimeout(resolve, 50));
        },
      },
      {
        name: 'Metadata Loading Strategy',
        description: 'Loads resource metadata',
        priority: 8,
        shouldLoad: (resource) => resource.type === 'metadata',
        loadResource: async (resource) => {
          // Simulate metadata loading
          await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
          return { type: resource.type, data: `loaded-${resource.id}`, size: resource.size };
        },
        unloadResource: async (_resource) => {
          await new Promise(resolve => setTimeout(resolve, 5));
        },
      },
    ];

    this.config.strategies.push(...strategies);
  }

  private startLoadingWorkers(): void {
    for (let i = 0; i < this.config.maxConcurrentLoads; i++) {
      this.loadingWorkers.push(this.createLoadingWorker());
    }
  }

  private async createLoadingWorker(): Promise<void> {
    while (true) {
      try {
        const resource = this.getNextResourceToLoad();
        if (resource) {
          await this.performResourceLoad(resource);
        } else {
          // No resources to load, wait a bit
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        log.error('Loading worker error', {
          component: 'LazyLoadingManager',
        }, error as Error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private getNextResourceToLoad(): LazyLoadableResource | null {
    // Check queues in priority order
    const queues: (keyof LoadingQueue)[] = ['high', 'medium', 'low', 'background'];

    for (const queueType of queues) {
      const queue = this.loadingQueue[queueType];
      if (queue.length > 0) {
        const resource = queue.shift()!;
        if (resource.loadState === 'unloaded' && !this.currentlyLoading.has(resource.id)) {
          return resource;
        }
      }
    }

    return null;
  }

  private setupIntersectionObserver(): void {
    if (typeof IntersectionObserver === 'undefined') {
      return; // Not available in this environment
    }

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const viewportId = entry.target.getAttribute('data-viewport-id');
          if (viewportId) {
            const resources = Array.from(this.resources.values())
              .filter(r => r.viewportId === viewportId);

            if (entry.isIntersecting) {
              // Viewport became visible - queue high-priority resources
              resources.forEach(resource => {
                if (resource.loadState === 'unloaded' && resource.priority > 7) {
                  this.queueResource(resource.id, 'high');
                }
              });
            }
          }
        });
      },
      { threshold: 0.1 },
    );
  }

  private startBackgroundTasks(): void {
    // Cleanup expired resources
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredResources();
    }, 60000); // Every minute

    // Process loading queue
    this.loadingInterval = setInterval(() => {
      this.emit('loading-queue-updated', { ...this.loadingQueue });
    }, 5000); // Every 5 seconds
  }

  private cleanupExpiredResources(): void {
    const now = Date.now();
    const expiredResources: LazyLoadableResource[] = [];

    this.resources.forEach(resource => {
      const { maxAge, maxIdleTime } = resource.retentionPolicy;
      const age = now - resource.lastAccessed;
      const idleTime = now - resource.lastAccessed;

      if ((maxAge > 0 && age > maxAge) || (maxIdleTime > 0 && idleTime > maxIdleTime)) {
        expiredResources.push(resource);
      }
    });

    expiredResources.forEach(resource => {
      if (resource.loadState === 'loaded') {
        this.unloadResource(resource.id);
      }
      resource.loadState = 'expired';
    });

    if (expiredResources.length > 0) {
      log.info('Expired resources cleaned up', {
        component: 'LazyLoadingManager',
        metadata: { count: expiredResources.length },
      });
    }
  }

  // ===== Cleanup =====

  public dispose(): void {
    if (this.loadingInterval) {
      clearInterval(this.loadingInterval);
      this.loadingInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = undefined;
    }

    // Cancel all loading workers
    this.loadingWorkers = [];

    this.resources.clear();
    this.loadingQueue = { high: [], medium: [], low: [], background: [] };
    this.currentlyLoading.clear();
    this.accessPatterns.clear();
    this.loadingPredictions.clear();
    this.removeAllListeners();

    log.info('LazyLoadingManager disposed', {
      component: 'LazyLoadingManager',
    });
  }
}

// Singleton instance
export const lazyLoadingManager = new LazyLoadingManager();
