/**
 * Main Viewport Optimizer
 * Orchestrates viewport optimization using specialized managers
 */

import { EventEmitter } from 'events';
import { viewportStateManager } from '../viewportStateManager';
import { renderingPriorityManager, RenderPriority as NewRenderPriority } from '../renderingPriorityManager';
import { log } from '../../utils/logger';

// Import specialized managers
import { QualityManager } from './quality-manager';
import { ViewportMemoryManager } from './memory-manager';
import { ViewportPerformanceMonitor } from './performance-monitor';
import { ViewportResourcePool } from './resource-pool';

// Import global performance monitoring system
import { performanceMonitoringSystem } from '../performance-monitoring/index';

// Import types
import {
  OptimizationConfig,
  RenderPriority,
  ViewportOptimizationState,
} from './types';

// Default optimization configuration
const DEFAULT_CONFIG: OptimizationConfig = {
  maxFps: 60,
  memoryThreshold: 512, // MB
  qualityLevels: [
    {
      name: 'Ultra',
      interpolationType: 'LINEAR',
      textureQuality: 1.0,
      shadowQuality: 1.0,
      renderScale: 1.0,
      maxTextureSize: 2048,
      enableVSync: true,
      targetFps: 60,
    },
    {
      name: 'High',
      interpolationType: 'LINEAR',
      textureQuality: 0.8,
      shadowQuality: 0.8,
      renderScale: 0.9,
      maxTextureSize: 1024,
      enableVSync: true,
      targetFps: 60,
    },
    {
      name: 'Medium',
      interpolationType: 'LINEAR',
      textureQuality: 0.6,
      shadowQuality: 0.6,
      renderScale: 0.8,
      maxTextureSize: 512,
      enableVSync: false,
      targetFps: 30,
    },
    {
      name: 'Low',
      interpolationType: 'NEAREST',
      textureQuality: 0.4,
      shadowQuality: 0.3,
      renderScale: 0.6,
      maxTextureSize: 256,
      enableVSync: false,
      targetFps: 30,
    },
    {
      name: 'PowerSave',
      interpolationType: 'NEAREST',
      textureQuality: 0.2,
      shadowQuality: 0.1,
      renderScale: 0.5,
      maxTextureSize: 128,
      enableVSync: false,
      targetFps: 15,
    },
  ],
  adaptiveQuality: true,
  resourcePooling: true,
  lazyLoading: true,
  priorityThrottling: true,
};

export class ViewportOptimizer extends EventEmitter {
  private readonly config: OptimizationConfig;
  private readonly viewportStates = new Map<string, ViewportOptimizationState>();

  // Specialized managers
  private readonly qualityManager: QualityManager;
  private readonly memoryManager: ViewportMemoryManager;
  private readonly performanceMonitor: ViewportPerformanceMonitor;
  private readonly resourcePool: ViewportResourcePool;

  private memoryCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<OptimizationConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize specialized managers
    this.qualityManager = new QualityManager(this.config);
    this.memoryManager = new ViewportMemoryManager();
    this.performanceMonitor = new ViewportPerformanceMonitor();
    this.resourcePool = new ViewportResourcePool(this.config.memoryThreshold * 1024 * 1024);

    // Setup event forwarding
    this.setupEventForwarding();

    // Initialize optimization system
    this.initialize();
  }

  /**
   * Initialize the optimization system
   */
  private initialize(): void {
    log.info('ViewportOptimizer initializing', {
      component: 'ViewportOptimizer',
      metadata: {
        maxFps: this.config.maxFps,
        memoryThreshold: this.config.memoryThreshold,
        adaptiveQuality: this.config.adaptiveQuality,
      },
    });

    // Start memory monitoring
    this.startMemoryMonitoring();

    // Start performance monitoring
    this.performanceMonitor.startPerformanceMonitoring(this.viewportStates);

    // Start global performance monitoring system
    performanceMonitoringSystem.startMonitoring();

    // Setup integration with global performance monitoring
    this.setupPerformanceMonitoringIntegration();
  }

  /**
   * Setup integration with global performance monitoring system
   */
  private setupPerformanceMonitoringIntegration(): void {
    // Listen for performance issues from global system
    performanceMonitoringSystem.on('issue-detected', (issue) => {
      if (issue.category === 'rendering' || issue.category === 'memory') {
        this.handlePerformanceIssue(issue);
      }
    });

    // Listen for performance reports
    performanceMonitoringSystem.on('report-generated', (report) => {
      this.analyzePerformanceReport(report);
    });

    // Forward viewport optimization events to global system
    this.on('optimization-applied', (viewportId, description) => {
      log.info('Viewport optimization applied', {
        component: 'ViewportOptimizer',
        metadata: { viewportId, description },
      });
    });

    log.info('Performance monitoring integration setup completed', {
      component: 'ViewportOptimizer',
    });
  }

  /**
   * Handle performance issues detected by global monitoring system
   */
  private handlePerformanceIssue(issue: any): void {
    log.warn('Performance issue detected, applying optimizations', {
      component: 'ViewportOptimizer',
      metadata: {
        issueId: issue.id,
        severity: issue.severity,
        category: issue.category,
        title: issue.title,
      },
    });

    // Apply automatic optimizations based on issue type
    switch (issue.category) {
      case 'rendering':
        this.handleRenderingIssue(issue);
        break;
      case 'memory':
        this.handleMemoryIssue(issue);
        break;
      default:
        log.info('No specific optimization available for issue category', {
          component: 'ViewportOptimizer',
          metadata: { category: issue.category },
        });
    }
  }

  /**
   * Handle rendering performance issues
   */
  private handleRenderingIssue(issue: any): void {
    if (issue.severity === 'critical') {
      // Emergency rendering optimizations
      this.viewportStates.forEach((state, viewportId) => {
        if (state.priority < RenderPriority.CRITICAL) {
          // Downgrade quality for non-critical viewports
          const lowerQuality = this.qualityManager.getLowerQualityLevel(state.qualityLevel);
          if (lowerQuality) {
            state.qualityLevel = lowerQuality;
            this.qualityManager.applyQualityToViewport(viewportId, lowerQuality);
          }
          
          // Increase throttling
          state.throttleRatio *= 0.7;
        }
      });

      this.emit('emergency-optimization', 'rendering', 'Quality downgraded for non-critical viewports');
    }
  }

  /**
   * Handle memory performance issues
   */
  private handleMemoryIssue(issue: any): void {
    if (issue.severity === 'critical' || issue.severity === 'high') {
      // Trigger emergency memory cleanup
      this.memoryManager.triggerEmergencyCleanup();
      
      // Suspend low priority viewports
      this.viewportStates.forEach((state, viewportId) => {
        if (state.priority >= RenderPriority.LOW) {
          state.priority = RenderPriority.SUSPENDED;
          state.isRendering = false;
        }
      });

      this.emit('emergency-optimization', 'memory', 'Low priority viewports suspended');
    }
  }

  /**
   * Analyze performance reports for optimization insights
   */
  private analyzePerformanceReport(report: any): void {
    // Extract optimization opportunities from performance report
    const overallScore = report.summary.overallScore;
    const criticalIssues = report.summary.criticalIssues;

    if (overallScore < 60 || criticalIssues > 0) {
      log.warn('Performance degradation detected, scheduling optimization review', {
        component: 'ViewportOptimizer',
        metadata: {
          reportId: report.id,
          overallScore,
          criticalIssues,
        },
      });

      // Schedule comprehensive optimization
      setTimeout(() => {
        this.performComprehensiveOptimization();
      }, 1000);
    }
  }

  /**
   * Perform comprehensive optimization based on current performance state
   */
  private performComprehensiveOptimization(): void {
    log.info('Performing comprehensive optimization', {
      component: 'ViewportOptimizer',
    });

    // Get current performance statistics from global system
    const stats = performanceMonitoringSystem.getPerformanceStatistics();
    
    if (stats.lastSnapshot) {
      const snapshot = stats.lastSnapshot;
      
      // Adjust optimization strategy based on performance metrics
      if (snapshot.metrics.rendering.frameRate.current < 30) {
        this.applyAggressiveRenderingOptimization();
      }
      
      if (snapshot.metrics.memory.usage.used / snapshot.metrics.memory.usage.total > 0.8) {
        this.applyAggressiveMemoryOptimization();
      }
    }

    this.emit('comprehensive-optimization', 'Performance optimization completed');
  }

  /**
   * Apply aggressive rendering optimizations
   */
  private applyAggressiveRenderingOptimization(): void {
    this.viewportStates.forEach((state, viewportId) => {
      // Reduce quality to minimum for non-critical viewports
      if (state.priority > RenderPriority.HIGH) {
        const lowestQuality = this.config.qualityLevels[this.config.qualityLevels.length - 1];
        state.qualityLevel = lowestQuality;
        this.qualityManager.applyQualityToViewport(viewportId, lowestQuality);
      }
      
      // Increase throttling significantly
      state.throttleRatio *= 0.5;
    });

    log.info('Aggressive rendering optimization applied', {
      component: 'ViewportOptimizer',
    });
  }

  /**
   * Apply aggressive memory optimizations
   */
  private applyAggressiveMemoryOptimization(): void {
    // Trigger comprehensive memory cleanup
    this.memoryManager.triggerEmergencyCleanup();
    this.resourcePool.forceGarbageCollection();

    // Suspend all but critical viewports
    this.viewportStates.forEach((state, viewportId) => {
      if (state.priority > RenderPriority.CRITICAL) {
        state.priority = RenderPriority.SUSPENDED;
        state.isRendering = false;
      }
    });

    log.info('Aggressive memory optimization applied', {
      component: 'ViewportOptimizer',
    });
  }

  /**
   * Setup event forwarding from specialized managers
   */
  private setupEventForwarding(): void {
    // Forward quality manager events
    this.qualityManager.on('quality-applied', (viewportId, quality) => {
      this.emit('optimization-applied', viewportId, `Quality: ${quality.name}`);
    });

    this.qualityManager.on('quality-upgraded', (viewportId, oldQuality, newQuality) => {
      this.emit('quality-changed', viewportId, oldQuality, newQuality);
    });

    this.qualityManager.on('quality-downgraded', (viewportId, oldQuality, newQuality) => {
      this.emit('quality-changed', viewportId, oldQuality, newQuality);
    });

    // Forward memory manager events
    this.memoryManager.on('memory-pressure', (viewportId, ratio, threshold) => {
      this.emit('memory-pressure', viewportId, ratio * 100, threshold.maxMemory);
    });

    this.memoryManager.on('emergency-cleanup-completed', (freedCount) => {
      this.emit('resource-cleanup', 'emergency', [`${freedCount} textures`], 0);
    });

    // Forward performance monitor events
    this.performanceMonitor.on('performance-metrics', (data) => {
      // Check for performance issues and adapt quality if needed
      if (this.config.adaptiveQuality) {
        const state = this.viewportStates.get(data.viewportId);
        if (state) {
          const newQuality = this.qualityManager.adaptiveQualityAdjustment(
            data.viewportId,
            state.qualityLevel,
            data.fps,
            data.memoryUsage / (this.config.memoryThreshold * 1024 * 1024),
          );

          if (newQuality) {
            state.qualityLevel = newQuality;
            this.qualityManager.applyQualityToViewport(data.viewportId, newQuality);
          }
        }
      }
    });

    // Forward resource pool events
    this.resourcePool.on('memory-pressure', (currentUsage, maxMemory) => {
      // Trigger emergency cleanup if memory pressure is too high
      if (currentUsage / maxMemory > 0.95) {
        this.memoryManager.triggerEmergencyCleanup();
      }
    });
  }

  /**
   * Main optimization entry point
   */
  public optimizeViewports(activeViewportId?: string): void {
    try {
      // Update viewport states from the state manager
      this.updateViewportStates();

      // Set priorities based on active viewport
      if (activeViewportId) {
        this.updateViewportPriorities(activeViewportId);
      }

      // Manage memory allocation
      this.memoryManager.manageResourceAllocation(
        this.viewportStates,
        this.config.memoryThreshold * 1024 * 1024,
      );

      // Apply optimizations based on priorities
      this.viewportStates.forEach((state, viewportId) => {
        this.applyPriorityOptimizations(viewportId, state.priority);
      });

      // Update rendering priorities for external systems
      this.updateRenderingPriorities();

      log.info('Viewport optimization completed', {
        component: 'ViewportOptimizer',
        metadata: {
          activeViewportId,
          totalViewports: this.viewportStates.size,
        },
      });

    } catch (error) {
      log.error('Viewport optimization failed', {
        component: 'ViewportOptimizer',
        metadata: { activeViewportId },
      }, error as Error);
    }
  }

  /**
   * Update viewport states from state manager
   */
  private updateViewportStates(): void {
    try {
      // Get all viewport IDs from the state manager
      const allViewportIds: string[] = []; // Would be populated from actual state manager

      allViewportIds.forEach((viewportId) => {
        const viewportState = viewportStateManager.getViewportState(viewportId);
        if (!viewportState) return;
        const existingState = this.viewportStates.get(viewportId);

        if (!existingState) {
          // Create new optimization state
          this.viewportStates.set(viewportId, {
            viewportId,
            priority: RenderPriority.MEDIUM,
            qualityLevel: this.qualityManager.getQualityForPriority(RenderPriority.MEDIUM),
            isRendering: viewportState.activation.isActive,
            lastRenderTime: 0,
            frameCount: 0,
            memoryAllocated: 0,
            resourcesLoaded: false,
            throttleRatio: 1.0,
          });
        } else {
          // Update existing state
          existingState.isRendering = viewportState.activation.isActive;
        }
      });

      // Remove states for deleted viewports
      const activeViewportIds = new Set(allViewportIds);
      for (const [viewportId] of this.viewportStates) {
        if (!activeViewportIds.has(viewportId)) {
          this.viewportStates.delete(viewportId);
        }
      }
    } catch (error) {
      log.warn('Failed to update viewport states', {
        component: 'ViewportOptimizer',
      }, error as Error);
    }
  }

  /**
   * Update viewport priorities based on active viewport
   */
  private updateViewportPriorities(activeViewportId: string): void {
    this.viewportStates.forEach((state, viewportId) => {
      if (viewportId === activeViewportId) {
        state.priority = RenderPriority.CRITICAL;
      } else if (state.isRendering) {
        state.priority = RenderPriority.HIGH;
      } else {
        state.priority = RenderPriority.LOW;
      }
    });
  }

  /**
   * Apply priority-based optimizations
   */
  private applyPriorityOptimizations(viewportId: string, priority: RenderPriority): void {
    const state = this.viewportStates.get(viewportId);
    if (!state) return;

    // Enable/disable rendering based on priority
    const shouldRender = priority < RenderPriority.SUSPENDED;

    if (state.isRendering !== shouldRender) {
      state.isRendering = shouldRender;

      try {
        const currentState = viewportStateManager.getViewportState(viewportId);
        if (currentState) {
          viewportStateManager.updateViewportState(viewportId, {
            performance: {
              fps: currentState.performance.fps,
              renderTime: currentState.performance.renderTime,
              memoryUsage: currentState.performance.memoryUsage,
              cacheHitRate: currentState.performance.cacheHitRate,
              isRenderingEnabled: shouldRender,
              debugMode: currentState.performance.debugMode,
            },
          });
        }
      } catch (error) {
        log.warn('Failed to update viewport rendering state', {
          component: 'ViewportOptimizer',
          metadata: { viewportId, shouldRender },
        });
      }
    }

    // Apply quality level based on priority
    const targetQuality = this.qualityManager.getQualityForPriority(priority);
    if (state.qualityLevel.name !== targetQuality.name) {
      state.qualityLevel = targetQuality;
      this.qualityManager.applyQualityToViewport(viewportId, targetQuality);
    }
  }

  /**
   * Update rendering priorities for external systems
   */
  private updateRenderingPriorities(): void {
    try {
      this.viewportStates.forEach((state, viewportId) => {
        const priority = this.convertToNewPriority(state.priority);
        renderingPriorityManager.setPriority(viewportId, priority);
      });
    } catch (error) {
      log.warn('Failed to update rendering priorities', {
        component: 'ViewportOptimizer',
      }, error as Error);
    }
  }

  /**
   * Convert RenderPriority to NewRenderPriority
   */
  private convertToNewPriority(priority: RenderPriority): NewRenderPriority {
    switch (priority) {
      case RenderPriority.CRITICAL:
        return NewRenderPriority.CRITICAL;
      case RenderPriority.HIGH:
        return NewRenderPriority.HIGH;
      case RenderPriority.MEDIUM:
        return NewRenderPriority.MEDIUM;
      case RenderPriority.LOW:
        return NewRenderPriority.LOW;
      case RenderPriority.SUSPENDED:
        return NewRenderPriority.SUSPENDED;
      default:
        return NewRenderPriority.MEDIUM;
    }
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    if (this.memoryCheckInterval) return;

    this.memoryCheckInterval = setInterval(() => {
      this.memoryManager.checkMemoryPressure();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Stop memory monitoring
   */
  private stopMemoryMonitoring(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
  }

  /**
   * Get comprehensive optimization statistics including global performance data
   */
  getOptimizationStats(): {
    viewportCount: number;
    activeViewports: number;
    memoryStats: any;
    resourceStats: any;
    performanceStats: any;
    globalPerformanceStats: any;
    } {
    const activeViewports = Array.from(this.viewportStates.values()).filter(s => s.isRendering).length;

    return {
      viewportCount: this.viewportStates.size,
      activeViewports,
      memoryStats: this.memoryManager.getMemoryStatistics(),
      resourceStats: this.resourcePool.getResourceStatistics(),
      performanceStats: this.performanceMonitor.getSystemPerformanceStats(),
      globalPerformanceStats: performanceMonitoringSystem.getPerformanceStatistics(),
    };
  }

  /**
   * Force optimization of a specific viewport
   */
  optimizeViewport(viewportId: string, priority?: RenderPriority): void {
    const state = this.viewportStates.get(viewportId);
    if (!state) {
      log.warn('Cannot optimize unknown viewport', {
        component: 'ViewportOptimizer',
        metadata: { viewportId },
      });
      return;
    }

    if (priority !== undefined) {
      state.priority = priority;
    }

    this.applyPriorityOptimizations(viewportId, state.priority);
  }

  /**
   * Optimize rendering for active viewports with advanced frame rate control
   */
  optimizeRendering(activeViewportId?: string): void {
    try {
      // Enhanced rendering optimization with frame rate control
      this.performAdvancedRenderingOptimization(activeViewportId);

      // Apply viewport-specific throttling based on performance metrics
      this.applyFrameRateThrottling();

      // Update priority queue for rendering operations
      this.updateRenderingQueue();

      // Apply memory-based rendering adjustments
      this.applyMemoryBasedOptimizations();

      log.info('Advanced rendering optimization completed', {
        component: 'ViewportOptimizer',
        metadata: {
          activeViewportId,
          optimizedViewports: this.viewportStates.size,
          avgThrottleRatio: this.calculateAverageThrottleRatio(),
        },
      });

    } catch (error) {
      log.error('Advanced rendering optimization failed', {
        component: 'ViewportOptimizer',
        metadata: { activeViewportId },
      }, error as Error);

      // Fallback to basic optimization
      this.optimizeViewports(activeViewportId);
    }
  }

  /**
   * Set priority for a specific viewport
   */
  setPriority(viewportId: string, priority: RenderPriority): void {
    const state = this.viewportStates.get(viewportId);
    if (state) {
      state.priority = priority;
      this.applyPriorityOptimizations(viewportId, priority);
    }
  }

  /**
   * Queue a rendering task for a viewport
   */
  queueRenderingTask(viewportId: string, task: any): void {
    // Delegate to performance monitor for tracking
    log.info('Rendering task queued', {
      component: 'ViewportOptimizer',
      metadata: { viewportId, taskType: typeof task },
    });
  }

  /**
   * Manage memory for all viewports
   */
  manageMemory(): void {
    this.memoryManager.manageResourceAllocation(
      this.viewportStates,
      this.config.memoryThreshold * 1024 * 1024,
    );
  }

  /**
   * Get performance metrics for a viewport
   */
  getPerformanceMetrics(viewportId?: string): any {
    if (viewportId) {
      return this.performanceMonitor.getViewportPerformanceStats(viewportId);
    }
    return this.performanceMonitor.getSystemPerformanceStats();
  }

  /**
   * Perform advanced rendering optimization with frame rate control
   */
  private performAdvancedRenderingOptimization(activeViewportId?: string): void {
    // Update viewport states first
    this.updateViewportStates();

    // Set dynamic priorities based on viewport visibility and interaction
    this.updateDynamicPriorities(activeViewportId);

    // Apply frame rate targeting for each viewport
    this.viewportStates.forEach((state, viewportId) => {
      const targetFps = this.calculateTargetFps(state.priority, state.qualityLevel);
      const currentFps = this.performanceMonitor.getViewportPerformanceStats(viewportId)?.fps || 60;

      // Adjust throttling based on actual vs target FPS
      if (currentFps > targetFps * 1.1) {
        // Too fast, can throttle more
        state.throttleRatio = Math.max(0.1, state.throttleRatio * 0.9);
      } else if (currentFps < targetFps * 0.9) {
        // Too slow, reduce throttling
        state.throttleRatio = Math.min(1.0, state.throttleRatio * 1.1);
      }

      this.applyPriorityOptimizations(viewportId, state.priority);
    });
  }

  /**
   * Apply frame rate throttling based on performance metrics
   */
  private applyFrameRateThrottling(): void {
    this.viewportStates.forEach((state, viewportId) => {
      const performanceStats = this.performanceMonitor.getViewportPerformanceStats(viewportId);
      if (!performanceStats) return;

      // Calculate dynamic throttling based on multiple factors
      const memoryPressure = this.memoryManager.getMemoryPressureRatio();
      const systemLoad = this.calculateSystemLoad();

      let dynamicThrottle = state.throttleRatio;

      // Adjust for memory pressure
      if (memoryPressure > 0.8) {
        dynamicThrottle *= 0.7; // More aggressive throttling
      } else if (memoryPressure > 0.6) {
        dynamicThrottle *= 0.85;
      }

      // Adjust for system load
      if (systemLoad > 0.9) {
        dynamicThrottle *= 0.6;
      } else if (systemLoad > 0.7) {
        dynamicThrottle *= 0.8;
      }

      // Apply viewport-specific rendering intervals
      this.setViewportRenderingInterval(viewportId, dynamicThrottle);
    });
  }

  /**
   * Update rendering queue based on priorities
   */
  private updateRenderingQueue(): void {
    // Sort viewports by priority for rendering queue
    const sortedViewports = Array.from(this.viewportStates.entries())
      .sort(([, a], [, b]) => a.priority - b.priority);

    // Update rendering priorities in the external system
    sortedViewports.forEach(([viewportId, state], index) => {
      const priority = this.convertToNewPriority(state.priority);
      renderingPriorityManager.setPriority(viewportId, priority);

      // Set rendering order based on priority
      renderingPriorityManager.setRenderOrder(viewportId, index);
    });
  }

  /**
   * Apply memory-based rendering optimizations
   */
  private applyMemoryBasedOptimizations(): void {
    const memoryStats = this.memoryManager.getMemoryStatistics();
    const memoryPressure = memoryStats.usageRatio;

    this.viewportStates.forEach((state, viewportId) => {
      // Reduce quality for non-critical viewports under memory pressure
      if (memoryPressure > 0.85 && state.priority > RenderPriority.HIGH) {
        const lowerQuality = this.qualityManager.getLowerQualityLevel(state.qualityLevel);
        if (lowerQuality && lowerQuality.name !== state.qualityLevel.name) {
          state.qualityLevel = lowerQuality;
          this.qualityManager.applyQualityToViewport(viewportId, lowerQuality);
        }
      }

      // Suspend rendering for low priority viewports under extreme pressure
      if (memoryPressure > 0.95 && state.priority >= RenderPriority.LOW) {
        state.priority = RenderPriority.SUSPENDED;
        state.isRendering = false;
      }
    });
  }

  /**
   * Update dynamic priorities based on viewport interaction and visibility
   */
  private updateDynamicPriorities(activeViewportId?: string): void {
    const now = Date.now();

    this.viewportStates.forEach((state, viewportId) => {
      // Active viewport gets highest priority
      if (viewportId === activeViewportId) {
        state.priority = RenderPriority.CRITICAL;
        state.lastRenderTime = now;
        return;
      }

      // Check viewport visibility and interaction recency
      const viewportState = viewportStateManager.getViewportState(viewportId);
      if (!viewportState) return;

      const timeSinceLastInteraction = now - (state.lastRenderTime || 0);
      const isVisible = viewportState.activation.isActive;

      if (isVisible) {
        if (timeSinceLastInteraction < 5000) { // 5 seconds
          state.priority = RenderPriority.HIGH;
        } else if (timeSinceLastInteraction < 30000) { // 30 seconds
          state.priority = RenderPriority.MEDIUM;
        } else {
          state.priority = RenderPriority.LOW;
        }
      } else {
        // Hidden viewports get lower priority
        state.priority = RenderPriority.LOW;
        if (timeSinceLastInteraction > 60000) { // 1 minute
          state.priority = RenderPriority.SUSPENDED;
        }
      }
    });
  }

  /**
   * Calculate target FPS based on priority and quality level
   */
  private calculateTargetFps(priority: RenderPriority, quality: QualityLevel): number {
    const baseFps = quality.targetFps;

    // Adjust based on priority
    switch (priority) {
      case RenderPriority.CRITICAL:
        return Math.min(baseFps, this.config.maxFps);
      case RenderPriority.HIGH:
        return Math.min(baseFps * 0.9, this.config.maxFps * 0.8);
      case RenderPriority.MEDIUM:
        return Math.min(baseFps * 0.7, this.config.maxFps * 0.6);
      case RenderPriority.LOW:
        return Math.min(baseFps * 0.5, this.config.maxFps * 0.4);
      case RenderPriority.SUSPENDED:
        return 0;
      default:
        return baseFps;
    }
  }

  /**
   * Calculate current system load
   */
  private calculateSystemLoad(): number {
    const performanceStats = this.performanceMonitor.getSystemPerformanceStats();
    if (!performanceStats) return 0.5; // Default moderate load

    // Combine multiple metrics for system load assessment
    const cpuLoad = (performanceStats.cpuUsage || 50) / 100;
    const memoryLoad = (performanceStats.memoryUsage || 512) / (this.config.memoryThreshold * 1024 * 1024);
    const avgFps = performanceStats.averageFps || 30;
    const fpsLoad = Math.max(0, (60 - avgFps) / 60);

    return Math.min(1.0, (cpuLoad * 0.4 + memoryLoad * 0.4 + fpsLoad * 0.2));
  }

  /**
   * Set viewport-specific rendering interval
   */
  private setViewportRenderingInterval(viewportId: string, throttleRatio: number): void {
    // Calculate frame interval based on throttle ratio
    const targetInterval = Math.max(16, (1 / (this.config.maxFps * throttleRatio)) * 1000);

    // Apply interval to viewport rendering system
    try {
      const currentState = viewportStateManager.getViewportState(viewportId);
      if (currentState) {
        viewportStateManager.updateViewportState(viewportId, {
          performance: {
            ...currentState.performance,
            targetFrameInterval: targetInterval,
            throttleRatio,
          },
        });
      }
    } catch (error) {
      log.warn('Failed to set viewport rendering interval', {
        component: 'ViewportOptimizer',
        metadata: { viewportId, throttleRatio, targetInterval },
      });
    }
  }

  /**
   * Calculate average throttle ratio across all viewports
   */
  private calculateAverageThrottleRatio(): number {
    if (this.viewportStates.size === 0) return 1.0;

    const totalThrottle = Array.from(this.viewportStates.values())
      .reduce((sum, state) => sum + state.throttleRatio, 0);

    return totalThrottle / this.viewportStates.size;
  }

  /**
   * Generate comprehensive performance report
   */
  generatePerformanceReport(): any {
    // Generate report from global performance monitoring system
    const globalReport = performanceMonitoringSystem.generateReport();
    
    // Add viewport-specific optimization data
    const optimizationStats = this.getOptimizationStats();
    
    const enhancedReport = {
      ...globalReport,
      optimization: {
        viewportOptimizer: optimizationStats,
        qualityLevels: this.config.qualityLevels.map(level => ({
          name: level.name,
          targetFps: level.targetFps,
          renderScale: level.renderScale,
        })),
        adaptiveQualityEnabled: this.config.adaptiveQuality,
        resourcePoolingEnabled: this.config.resourcePooling,
        viewportStates: Array.from(this.viewportStates.entries()).map(([id, state]) => ({
          viewportId: id,
          priority: state.priority,
          qualityLevel: state.qualityLevel.name,
          isRendering: state.isRendering,
          throttleRatio: state.throttleRatio,
          memoryAllocated: state.memoryAllocated,
        })),
      },
    };

    log.info('Comprehensive performance report generated', {
      component: 'ViewportOptimizer',
      metadata: {
        reportId: enhancedReport.id,
        overallScore: enhancedReport.summary.overallScore,
        viewportCount: this.viewportStates.size,
      },
    });

    return enhancedReport;
  }

  /**
   * Cleanup and dispose resources
   */
  dispose(): void {
    this.stopMemoryMonitoring();
    
    // Stop global performance monitoring
    performanceMonitoringSystem.stopMonitoring();
    
    this.performanceMonitor.dispose();
    this.memoryManager.dispose();
    this.resourcePool.dispose();
    this.qualityManager.removeAllListeners();

    this.viewportStates.clear();
    this.removeAllListeners();

    log.info('ViewportOptimizer disposed', {
      component: 'ViewportOptimizer',
    });
  }
}

// Export types and create singleton instance
export * from './types';
export { QualityManager } from './quality-manager';
export { ViewportMemoryManager } from './memory-manager';
export { ViewportPerformanceMonitor } from './performance-monitor';
export { ViewportResourcePool } from './resource-pool';

// Singleton instance
export const viewportOptimizer = new ViewportOptimizer();
