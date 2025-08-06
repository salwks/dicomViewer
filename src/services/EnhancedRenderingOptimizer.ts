/**
 * Enhanced Rendering Optimizer
 * Advanced viewport-level rendering optimization with frame rate control and priority management
 * Task 30.1: Implement Viewport-Level Rendering Optimization
 */

import { EventEmitter } from 'events';
import { ViewportState } from '../types/viewportState';
import { QualityLevel } from './viewport-optimizer';
import { log } from '../utils/logger';

export interface RenderFrame {
  id: string;
  viewportId: string;
  timestamp: number;
  priority: number;
  frameData: {
    width: number;
    height: number;
    pixelRatio: number;
    colorSpace: 'srgb' | 'rec2020' | 'display-p3';
  };
  renderSettings: {
    enableAntialiasing: boolean;
    enableDepthTesting: boolean;
    enableBlending: boolean;
    cullFace: 'none' | 'front' | 'back';
  };
  optimizations: {
    enableOcclusionCulling: boolean;
    enableFrustumCulling: boolean;
    enableLevelOfDetail: boolean;
    adaptiveQuality: boolean;
  };
}

export interface ViewportRenderState {
  viewportId: string;
  isActive: boolean;
  isVisible: boolean;
  renderQueue: RenderFrame[];
  currentFrame: RenderFrame | null;
  frameRate: {
    target: number;
    actual: number;
    history: number[];
    dropCount: number;
  };
  renderMetrics: {
    averageRenderTime: number;
    lastRenderTime: number;
    framesRendered: number;
    framesDropped: number;
    trianglesRendered: number;
    drawCalls: number;
  };
  throttling: {
    enabled: boolean;
    ratio: number;
    lastThrottleTime: number;
    adaptiveMode: boolean;
  };
  qualityControl: {
    currentLevel: QualityLevel;
    autoAdjust: boolean;
    downgradeThreshold: number;
    upgradeThreshold: number;
  };
}

export interface RenderingOptimizationConfig {
  maxConcurrentRenders: number;
  frameDropThreshold: number; // Maximum consecutive dropped frames before quality reduction
  qualityAdjustmentSteps: number;
  adaptiveThrottling: {
    enabled: boolean;
    minThrottle: number;
    maxThrottle: number;
    adjustmentSpeed: number;
  };
  levelOfDetail: {
    enabled: boolean;
    nearDistance: number;
    farDistance: number;
    qualityLevels: number;
  };
  culling: {
    enableFrustumCulling: boolean;
    enableOcclusionCulling: boolean;
    occlusionQueryThreshold: number;
  };
  asyncRendering: {
    enabled: boolean;
    workerCount: number;
    batchSize: number;
  };
}

export const DEFAULT_RENDERING_CONFIG: RenderingOptimizationConfig = {
  maxConcurrentRenders: 4,
  frameDropThreshold: 3,
  qualityAdjustmentSteps: 5,
  adaptiveThrottling: {
    enabled: true,
    minThrottle: 0.5,
    maxThrottle: 1.0,
    adjustmentSpeed: 0.1,
  },
  levelOfDetail: {
    enabled: true,
    nearDistance: 100,
    farDistance: 1000,
    qualityLevels: 4,
  },
  culling: {
    enableFrustumCulling: true,
    enableOcclusionCulling: false, // Expensive, disabled by default
    occlusionQueryThreshold: 0.01,
  },
  asyncRendering: {
    enabled: true,
    workerCount: 2,
    batchSize: 10,
  },
};

export interface EnhancedRenderingOptimizerEvents {
  'frame-rendered': [string, RenderFrame, number]; // [viewportId, frame, renderTime]
  'frame-dropped': [string, RenderFrame, string]; // [viewportId, frame, reason]
  'quality-adjusted': [string, QualityLevel, QualityLevel]; // [viewportId, oldLevel, newLevel]
  'throttling-changed': [string, number, number]; // [viewportId, oldRatio, newRatio]
  'render-queue-updated': [string, number]; // [viewportId, queueLength]
  'performance-warning': [string, string, number]; // [viewportId, metric, value]
}

export class EnhancedRenderingOptimizer extends EventEmitter {
  private config: RenderingOptimizationConfig;
  private viewportRenderStates = new Map<string, ViewportRenderState>();
  private renderScheduler: NodeJS.Timeout | null = null;
  private performanceMonitor: NodeJS.Timeout | null = null;
  private frameRequestId: number | null = null;

  // Async rendering workers
  private renderWorkers: Worker[] = [];
  private renderQueue: RenderFrame[] = [];
  private processingFrames = new Set<string>();

  // Performance tracking
  private globalMetrics = {
    totalFrames: 0,
    totalDroppedFrames: 0,
    averageFrameTime: 0,
    lastPerformanceCheck: 0,
  };

  // Quality levels for adjustment
  private qualityLevels = {
    'ultra-low': {
      name: 'ultra-low',
      interpolationType: 'LINEAR' as const,
      textureQuality: 0.1,
      shadowQuality: 0.1,
      renderScale: 0.5,
      maxTextureSize: 256,
      enableVSync: false,
      targetFps: 15,
    },
    low: {
      name: 'low',
      interpolationType: 'LINEAR' as const,
      textureQuality: 0.3,
      shadowQuality: 0.3,
      renderScale: 0.6,
      maxTextureSize: 512,
      enableVSync: false,
      targetFps: 30,
    },
    medium: {
      name: 'medium',
      interpolationType: 'LINEAR' as const,
      textureQuality: 0.6,
      shadowQuality: 0.6,
      renderScale: 0.8,
      maxTextureSize: 1024,
      enableVSync: false,
      targetFps: 30,
    },
    high: {
      name: 'high',
      interpolationType: 'LINEAR' as const,
      textureQuality: 0.9,
      shadowQuality: 0.9,
      renderScale: 1.0,
      maxTextureSize: 2048,
      enableVSync: true,
      targetFps: 60,
    },
  };

  constructor(config: Partial<RenderingOptimizationConfig> = {}) {
    super();
    this.config = { ...DEFAULT_RENDERING_CONFIG, ...config };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    log.info('EnhancedRenderingOptimizer initializing', {
      component: 'EnhancedRenderingOptimizer',
      metadata: {
        maxConcurrentRenders: this.config.maxConcurrentRenders,
        asyncRendering: this.config.asyncRendering.enabled,
      },
    });

    // Initialize async rendering workers if enabled
    if (this.config.asyncRendering.enabled) {
      await this.initializeRenderWorkers();
    }

    // Start rendering scheduler
    this.startRenderScheduler();

    // Start performance monitoring
    this.startPerformanceMonitoring();
  }

  // ===== Public API =====

  /**
   * Optimize rendering for active viewport with enhanced controls
   */
  public optimizeRendering(activeViewportId: string, viewportStates: ViewportState[] = []): void {
    try {
      // Update viewport render states
      this.updateViewportRenderStates(viewportStates);

      // Set active viewport priority
      this.setActiveViewport(activeViewportId);

      // Apply frame rate control
      this.applyFrameRateControl();

      // Apply adaptive quality control
      this.applyAdaptiveQualityControl();

      // Apply throttling optimization
      this.applyThrottlingOptimization();

      // Update render queues
      this.updateRenderQueues();

      // Schedule rendering tasks
      this.scheduleRenderingTasks();

      log.info('Enhanced rendering optimization applied', {
        component: 'EnhancedRenderingOptimizer',
        metadata: {
          activeViewportId,
          totalViewports: this.viewportRenderStates.size,
          queuedFrames: this.renderQueue.length,
        },
      });
    } catch (error) {
      log.error(
        'Failed to optimize rendering',
        {
          component: 'EnhancedRenderingOptimizer',
          metadata: { activeViewportId },
        },
        error as Error,
      );
    }
  }

  /**
   * Queue a render frame for a viewport
   */
  public queueRenderFrame(viewportId: string, frameData: RenderFrame['frameData'], priority: number = 5): string {
    const frameId = this.generateFrameId();

    const frame: RenderFrame = {
      id: frameId,
      viewportId,
      timestamp: Date.now(),
      priority,
      frameData,
      renderSettings: this.getOptimalRenderSettings(viewportId),
      optimizations: this.getOptimalOptimizations(viewportId),
    };

    const renderState = this.viewportRenderStates.get(viewportId);
    if (renderState) {
      // Add to viewport-specific queue
      renderState.renderQueue.push(frame);

      // Sort by priority (higher number = higher priority)
      renderState.renderQueue.sort((a, b) => b.priority - a.priority);

      // Limit queue size to prevent memory issues
      if (renderState.renderQueue.length > 10) {
        const droppedFrame = renderState.renderQueue.pop()!;
        renderState.renderMetrics.framesDropped++;
        this.emit('frame-dropped', viewportId, droppedFrame, 'queue-overflow');
      }

      this.emit('render-queue-updated', viewportId, renderState.renderQueue.length);
    }

    // Add to global render queue for processing
    this.renderQueue.push(frame);

    return frameId;
  }

  /**
   * Set frame rate target for viewport
   */
  public setFrameRateTarget(viewportId: string, targetFps: number): void {
    const renderState = this.viewportRenderStates.get(viewportId);
    if (renderState) {
      renderState.frameRate.target = Math.max(1, Math.min(targetFps, 120));

      // Adjust throttling based on frame rate target
      if (targetFps < 30) {
        renderState.throttling.ratio = Math.max(0.5, targetFps / 60);
      }

      log.info('Frame rate target updated', {
        component: 'EnhancedRenderingOptimizer',
        metadata: { viewportId, targetFps },
      });
    }
  }

  /**
   * Force quality level for viewport
   */
  public setQualityLevel(viewportId: string, qualityLevel: QualityLevel): void {
    const renderState = this.viewportRenderStates.get(viewportId);
    if (renderState) {
      const oldLevel = renderState.qualityControl.currentLevel;
      renderState.qualityControl.currentLevel = qualityLevel;
      renderState.qualityControl.autoAdjust = false; // Disable auto adjustment

      this.emit('quality-adjusted', viewportId, oldLevel, qualityLevel);

      log.info('Quality level manually set', {
        component: 'EnhancedRenderingOptimizer',
        metadata: { viewportId, oldLevel: oldLevel.name, newLevel: qualityLevel.name },
      });
    }
  }

  /**
   * Enable/disable adaptive quality for viewport
   */
  public setAdaptiveQuality(viewportId: string, enabled: boolean): void {
    const renderState = this.viewportRenderStates.get(viewportId);
    if (renderState) {
      renderState.qualityControl.autoAdjust = enabled;

      log.info('Adaptive quality toggled', {
        component: 'EnhancedRenderingOptimizer',
        metadata: { viewportId, enabled },
      });
    }
  }

  /**
   * Get current rendering statistics
   */
  public getRenderingStats(viewportId?: string): any {
    if (viewportId) {
      const renderState = this.viewportRenderStates.get(viewportId);
      if (renderState) {
        return {
          frameRate: renderState.frameRate,
          renderMetrics: renderState.renderMetrics,
          throttling: renderState.throttling,
          qualityLevel: renderState.qualityControl.currentLevel.name,
          queueLength: renderState.renderQueue.length,
        };
      }
      return null;
    }

    // Return global statistics
    return {
      globalMetrics: this.globalMetrics,
      totalViewports: this.viewportRenderStates.size,
      activeViewports: Array.from(this.viewportRenderStates.values()).filter(s => s.isActive).length,
      queuedFrames: this.renderQueue.length,
      processingFrames: this.processingFrames.size,
    };
  }

  // ===== Private Implementation =====

  private updateViewportRenderStates(viewportStates: ViewportState[]): void {
    // Update existing states and create new ones
    viewportStates.forEach(state => {
      if (!this.viewportRenderStates.has(state.id)) {
        this.createViewportRenderState(state);
      } else {
        this.updateExistingRenderState(state);
      }
    });

    // Remove states for deleted viewports
    const activeIds = new Set(viewportStates.map(s => s.id));
    for (const [viewportId] of this.viewportRenderStates) {
      if (!activeIds.has(viewportId)) {
        this.viewportRenderStates.delete(viewportId);
      }
    }
  }

  private createViewportRenderState(state: ViewportState): void {
    // Get default quality level from viewportOptimizer
    const defaultQuality = {
      name: 'Medium',
      interpolationType: 'LINEAR' as const,
      textureQuality: 0.6,
      shadowQuality: 0.6,
      renderScale: 0.8,
      maxTextureSize: 1024,
      enableVSync: false,
      targetFps: 30,
    };

    const renderState: ViewportRenderState = {
      viewportId: state.id,
      isActive: state.activation.isActive,
      isVisible: state.activation.isVisible,
      renderQueue: [],
      currentFrame: null,
      frameRate: {
        target: state.performance?.fps || 60,
        actual: 0,
        history: [],
        dropCount: 0,
      },
      renderMetrics: {
        averageRenderTime: 0,
        lastRenderTime: 0,
        framesRendered: 0,
        framesDropped: 0,
        trianglesRendered: 0,
        drawCalls: 0,
      },
      throttling: {
        enabled: true,
        ratio: 1.0,
        lastThrottleTime: 0,
        adaptiveMode: this.config.adaptiveThrottling.enabled,
      },
      qualityControl: {
        currentLevel: defaultQuality,
        autoAdjust: true,
        downgradeThreshold: 100, // ms
        upgradeThreshold: 16, // ms (60fps)
      },
    };

    this.viewportRenderStates.set(state.id, renderState);
  }

  private updateExistingRenderState(state: ViewportState): void {
    const renderState = this.viewportRenderStates.get(state.id);
    if (renderState) {
      renderState.isActive = state.activation.isActive;
      renderState.isVisible = state.activation.isVisible;

      // Update frame rate target if specified in viewport state
      if (state.performance?.fps) {
        renderState.frameRate.target = state.performance.fps;
      }
    }
  }

  private setActiveViewport(activeViewportId: string): void {
    // Update all viewport states
    this.viewportRenderStates.forEach((renderState, viewportId) => {
      const wasActive = renderState.isActive;
      renderState.isActive = viewportId === activeViewportId;

      if (renderState.isActive && !wasActive) {
        // Boost priority for newly active viewport
        renderState.renderQueue.forEach(frame => {
          frame.priority = Math.max(frame.priority, 8);
        });
      }
    });
  }

  private applyFrameRateControl(): void {
    this.viewportRenderStates.forEach((renderState, viewportId) => {
      const { target, history } = renderState.frameRate;

      // Calculate average frame rate from history
      if (history.length > 0) {
        const average = history.reduce((sum, fps) => sum + fps, 0) / history.length;
        renderState.frameRate.actual = average;

        // Adjust frame rate target based on performance
        if (average < target * 0.8) {
          // Performance is poor, consider reducing quality or throttling
          this.adjustViewportPerformance(viewportId, 'reduce');
        } else if (average > target * 1.2 && renderState.qualityControl.autoAdjust) {
          // Performance is good, consider increasing quality
          this.adjustViewportPerformance(viewportId, 'increase');
        }
      }
    });
  }

  private applyAdaptiveQualityControl(): void {
    this.viewportRenderStates.forEach((renderState, viewportId) => {
      if (!renderState.qualityControl.autoAdjust) return;

      const { averageRenderTime, lastRenderTime } = renderState.renderMetrics;
      const { downgradeThreshold, upgradeThreshold } = renderState.qualityControl;

      if (lastRenderTime > downgradeThreshold) {
        // Rendering is too slow, downgrade quality
        this.adjustQuality(viewportId, 'downgrade');
      } else if (
        averageRenderTime < upgradeThreshold &&
        renderState.frameRate.actual > renderState.frameRate.target * 0.9
      ) {
        // Rendering is fast and frame rate is good, upgrade quality
        this.adjustQuality(viewportId, 'upgrade');
      }
    });
  }

  private applyThrottlingOptimization(): void {
    this.viewportRenderStates.forEach((renderState, viewportId) => {
      if (!renderState.throttling.adaptiveMode) return;

      const { target, actual, dropCount } = renderState.frameRate;
      const { minThrottle, maxThrottle, adjustmentSpeed } = this.config.adaptiveThrottling;

      let newRatio = renderState.throttling.ratio;

      if (actual < target * 0.8 || dropCount > this.config.frameDropThreshold) {
        // Performance is poor, increase throttling (reduce frame rate)
        newRatio = Math.max(minThrottle, newRatio - adjustmentSpeed);
      } else if (actual > target * 1.1 && dropCount === 0) {
        // Performance is good, reduce throttling (increase frame rate)
        newRatio = Math.min(maxThrottle, newRatio + adjustmentSpeed);
      }

      if (newRatio !== renderState.throttling.ratio) {
        const oldRatio = renderState.throttling.ratio;
        renderState.throttling.ratio = newRatio;
        renderState.throttling.lastThrottleTime = Date.now();

        this.emit('throttling-changed', viewportId, oldRatio, newRatio);
      }
    });
  }

  private updateRenderQueues(): void {
    // Sort global render queue by priority and timestamp
    this.renderQueue.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.timestamp - b.timestamp;
    });

    // Remove expired frames (older than 100ms)
    const now = Date.now();
    const expiredFrames = this.renderQueue.filter(frame => now - frame.timestamp > 100);

    expiredFrames.forEach(frame => {
      const renderState = this.viewportRenderStates.get(frame.viewportId);
      if (renderState) {
        renderState.renderMetrics.framesDropped++;
        this.emit('frame-dropped', frame.viewportId, frame, 'expired');
      }
    });

    this.renderQueue = this.renderQueue.filter(frame => now - frame.timestamp <= 100);
  }

  private scheduleRenderingTasks(): void {
    // Process frames up to concurrent limit
    const availableSlots = this.config.maxConcurrentRenders - this.processingFrames.size;
    const framesToProcess = this.renderQueue.splice(0, availableSlots);

    framesToProcess.forEach(frame => {
      this.processRenderFrame(frame);
    });
  }

  private async processRenderFrame(frame: RenderFrame): Promise<void> {
    this.processingFrames.add(frame.id);
    const startTime = Date.now();

    try {
      // Simulate rendering work
      if (this.config.asyncRendering.enabled && this.renderWorkers.length > 0) {
        await this.processFrameAsync(frame);
      } else {
        await this.processFrameSync(frame);
      }

      const renderTime = Date.now() - startTime;
      this.updateRenderMetrics(frame.viewportId, renderTime, true);

      this.emit('frame-rendered', frame.viewportId, frame, renderTime);
    } catch (error) {
      log.error(
        'Frame rendering failed',
        {
          component: 'EnhancedRenderingOptimizer',
          metadata: { frameId: frame.id, viewportId: frame.viewportId },
        },
        error as Error,
      );

      this.updateRenderMetrics(frame.viewportId, Date.now() - startTime, false);
      this.emit('frame-dropped', frame.viewportId, frame, 'render-error');
    } finally {
      this.processingFrames.delete(frame.id);
    }
  }

  private async processFrameSync(frame: RenderFrame): Promise<void> {
    // Simulate synchronous rendering
    const renderTime = this.simulateRenderTime(frame);
    await new Promise(resolve => setTimeout(resolve, renderTime));
  }

  private async processFrameAsync(frame: RenderFrame): Promise<void> {
    // Use worker for async rendering
    return new Promise((resolve, reject) => {
      const worker = this.getAvailableWorker();
      if (!worker) {
        reject(new Error('No available render worker'));
        return;
      }

      worker.postMessage({
        type: 'render-frame',
        frame,
      });

      const handleMessage = (event: MessageEvent) => {
        if (event.data.frameId === frame.id) {
          worker.removeEventListener('message', handleMessage);
          if (event.data.success) {
            resolve();
          } else {
            reject(new Error(event.data.error));
          }
        }
      };

      worker.addEventListener('message', handleMessage);
    });
  }

  private simulateRenderTime(frame: RenderFrame): number {
    // Simulate render time based on frame complexity
    const baseTime = 16; // 16ms for 60fps
    const qualityMultiplier = this.getQualityComplexity(frame.viewportId);
    const throttleMultiplier = this.getThrottlingMultiplier(frame.viewportId);

    return Math.max(1, baseTime * qualityMultiplier * throttleMultiplier);
  }

  private getQualityComplexity(viewportId: string): number {
    const renderState = this.viewportRenderStates.get(viewportId);
    if (!renderState) return 1.0;

    const quality = renderState.qualityControl.currentLevel;
    return quality.textureQuality * quality.shadowQuality * quality.renderScale;
  }

  private getThrottlingMultiplier(viewportId: string): number {
    const renderState = this.viewportRenderStates.get(viewportId);
    if (!renderState) return 1.0;

    return 1.0 / renderState.throttling.ratio;
  }

  private updateRenderMetrics(viewportId: string, renderTime: number, success: boolean): void {
    const renderState = this.viewportRenderStates.get(viewportId);
    if (!renderState) return;

    renderState.renderMetrics.lastRenderTime = renderTime;

    if (success) {
      renderState.renderMetrics.framesRendered++;

      // Update average render time
      const { averageRenderTime, framesRendered } = renderState.renderMetrics;
      renderState.renderMetrics.averageRenderTime =
        (averageRenderTime * (framesRendered - 1) + renderTime) / framesRendered;

      // Update frame rate history
      const fps = 1000 / renderTime;
      renderState.frameRate.history.push(fps);

      if (renderState.frameRate.history.length > 10) {
        renderState.frameRate.history.shift();
      }

      // Reset drop count on successful frame
      renderState.frameRate.dropCount = 0;
    } else {
      renderState.renderMetrics.framesDropped++;
      renderState.frameRate.dropCount++;
    }

    // Update global metrics
    this.globalMetrics.totalFrames++;
    if (!success) {
      this.globalMetrics.totalDroppedFrames++;
    }

    const totalFrames = this.globalMetrics.totalFrames;
    this.globalMetrics.averageFrameTime =
      (this.globalMetrics.averageFrameTime * (totalFrames - 1) + renderTime) / totalFrames;
  }

  private adjustViewportPerformance(viewportId: string, direction: 'increase' | 'reduce'): void {
    const renderState = this.viewportRenderStates.get(viewportId);
    if (!renderState) return;

    if (direction === 'reduce') {
      // Increase throttling or reduce quality
      if (renderState.throttling.ratio > this.config.adaptiveThrottling.minThrottle) {
        renderState.throttling.ratio -= 0.1;
      } else {
        this.adjustQuality(viewportId, 'downgrade');
      }
    } else {
      // Decrease throttling or increase quality
      if (renderState.throttling.ratio < this.config.adaptiveThrottling.maxThrottle) {
        renderState.throttling.ratio += 0.1;
      } else {
        this.adjustQuality(viewportId, 'upgrade');
      }
    }
  }

  private adjustQuality(_viewportId: string, direction: 'upgrade' | 'downgrade'): void {
    const renderState = this.viewportRenderStates.get(_viewportId);
    if (!renderState) return;

    // Integrate with the quality level system
    const currentLevel = renderState.qualityControl.currentLevel;
    let targetQuality: QualityLevel;

    // Determine target quality based on direction and current level
    if (direction === 'upgrade') {
      switch (currentLevel.name) {
        case 'ultra-low':
          targetQuality = this.qualityLevels.low;
          break;
        case 'low':
          targetQuality = this.qualityLevels.medium;
          break;
        case 'medium':
          targetQuality = this.qualityLevels.high;
          break;
        case 'high':
        default:
          targetQuality = currentLevel; // Already at max
          break;
      }
    } else {
      switch (currentLevel.name) {
        case 'high':
          targetQuality = this.qualityLevels.medium;
          break;
        case 'medium':
          targetQuality = this.qualityLevels.low;
          break;
        case 'low':
          targetQuality = this.qualityLevels['ultra-low'];
          break;
        case 'ultra-low':
        default:
          targetQuality = currentLevel; // Already at min
          break;
      }
    }

    // Apply the new quality level if different
    if (targetQuality.name !== currentLevel.name) {
      renderState.qualityControl.currentLevel = targetQuality;
      this.emit('quality-changed', {
        viewportId: _viewportId,
        from: currentLevel.name,
        to: targetQuality.name,
      });

      log.info(`Quality ${direction} applied for viewport`, {
        component: 'EnhancedRenderingOptimizer',
        metadata: {
          viewportId: _viewportId,
          fromQuality: currentLevel.name,
          toQuality: targetQuality.name,
        },
      });
    } else {
      log.info(`Quality ${direction} suggested but already at limit`, {
        component: 'EnhancedRenderingOptimizer',
        metadata: { viewportId: _viewportId, currentQuality: currentLevel.name },
      });
    }
  }

  private getOptimalRenderSettings(viewportId: string): RenderFrame['renderSettings'] {
    const renderState = this.viewportRenderStates.get(viewportId);
    if (!renderState) {
      return {
        enableAntialiasing: true,
        enableDepthTesting: true,
        enableBlending: true,
        cullFace: 'back',
      };
    }

    const quality = renderState.qualityControl.currentLevel;

    return {
      enableAntialiasing: quality.textureQuality > 0.5,
      enableDepthTesting: true,
      enableBlending: quality.shadowQuality > 0.3,
      cullFace: quality.renderScale > 0.7 ? 'back' : 'none',
    };
  }

  private getOptimalOptimizations(_viewportId: string): RenderFrame['optimizations'] {
    return {
      enableOcclusionCulling: this.config.culling.enableOcclusionCulling,
      enableFrustumCulling: this.config.culling.enableFrustumCulling,
      enableLevelOfDetail: this.config.levelOfDetail.enabled,
      adaptiveQuality: true,
    };
  }

  private startRenderScheduler(): void {
    if (this.renderScheduler) return;

    this.renderScheduler = setInterval(() => {
      this.scheduleRenderingTasks();
    }, 16); // ~60fps scheduling
  }

  private startPerformanceMonitoring(): void {
    if (this.performanceMonitor) return;

    this.performanceMonitor = setInterval(() => {
      this.checkPerformanceWarnings();
    }, 5000); // Check every 5 seconds
  }

  private checkPerformanceWarnings(): void {
    this.viewportRenderStates.forEach((renderState, viewportId) => {
      const { actual, target, dropCount } = renderState.frameRate;
      const { averageRenderTime, framesDropped, framesRendered } = renderState.renderMetrics;

      // Check frame rate warning
      if (actual < target * 0.5) {
        this.emit('performance-warning', viewportId, 'low-framerate', actual);
      }

      // Check dropped frame warning
      if (dropCount > this.config.frameDropThreshold) {
        this.emit('performance-warning', viewportId, 'dropped-frames', dropCount);
      }

      // Check render time warning
      if (averageRenderTime > 100) {
        // > 100ms is very slow
        this.emit('performance-warning', viewportId, 'slow-rendering', averageRenderTime);
      }

      // Check drop rate warning
      const dropRate = framesRendered > 0 ? framesDropped / (framesRendered + framesDropped) : 0;
      if (dropRate > 0.1) {
        // > 10% drop rate
        this.emit('performance-warning', viewportId, 'high-drop-rate', dropRate);
      }
    });
  }

  private async initializeRenderWorkers(): Promise<void> {
    // Initialize web workers for async rendering
    for (let i = 0; i < this.config.asyncRendering.workerCount; i++) {
      try {
        // Create actual Web Worker for rendering
        let worker: Worker;

        try {
          // Try to create Web Worker
          const workerBlob = new Blob(
            [
              `
            // Simple inline render worker
            let isInitialized = false;
            let renderingFrames = new Set();
            
            self.onmessage = async (event) => {
              const { type, frame, frameId } = event.data;
              
              try {
                switch (type) {
                  case 'init':
                    isInitialized = true;
                    self.postMessage({ type: 'init-complete', frameId: '', success: true });
                    break;
                    
                  case 'render':
                    if (frame && isInitialized) {
                      const startTime = performance.now();
                      renderingFrames.add(frame.id);
                      
                      // Simulate rendering work
                      const renderTime = Math.max(5, 16 * (1 + frame.complexity / 10));
                      await new Promise(resolve => setTimeout(resolve, renderTime));
                      
                      if (renderingFrames.has(frame.id)) {
                        const totalTime = performance.now() - startTime;
                        self.postMessage({
                          type: 'render-complete',
                          frameId: frame.id,  
                          success: true,
                          renderTime: totalTime,
                        });
                      }
                      
                      renderingFrames.delete(frame.id);
                    }
                    break;
                    
                  case 'cancel':
                    if (frameId) renderingFrames.delete(frameId);
                    break;
                }
              } catch (error) {
                self.postMessage({
                  type: 'render-error',
                  frameId: frameId || frame?.id || '',
                  success: false,
                  error: error.message,
                });
              }
            };
          `,
            ],
            { type: 'application/javascript' },
          );

          worker = new Worker(URL.createObjectURL(workerBlob));

          worker.onmessage = this.workerMessageHandler;
          worker.onerror = error => {
            log.error(
              'Render worker error',
              {
                component: 'EnhancedRenderingOptimizer',
                metadata: { workerId: i },
              },
              error as any,
            );
          };

          // Initialize the worker
          worker.postMessage({
            type: 'init',
            config: { workerId: i, renderingConfig: this.config },
          });
        } catch (workerError) {
          // Fallback to inline processing if Worker creation fails
          log.warn('Web Worker not available, using fallback', {
            component: 'EnhancedRenderingOptimizer',
            metadata: { error: (workerError as Error).message },
          });

          worker = {
            postMessage: (message: any) => {
              setTimeout(() => {
                if (this.workerMessageHandler && message.frame) {
                  this.workerMessageHandler({
                    data: {
                      type: 'render-complete',
                      frameId: message.frame.id,
                      success: true,
                      renderTime: this.simulateRenderTime(message.frame),
                    },
                  } as MessageEvent);
                }
              }, this.simulateRenderTime(message.frame));
            },
            terminate: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
          } as unknown as Worker;
        }

        this.renderWorkers.push(worker);
      } catch (error) {
        log.warn(
          'Failed to create render worker',
          {
            component: 'EnhancedRenderingOptimizer',
            metadata: { workerIndex: i },
          },
          error as Error,
        );
      }
    }

    log.info('Render workers initialized', {
      component: 'EnhancedRenderingOptimizer',
      metadata: { workerCount: this.renderWorkers.length },
    });
  }

  private workerMessageHandler: ((event: MessageEvent) => void) | null = null;

  private getAvailableWorker(): Worker | null {
    // Simple round-robin worker selection
    return this.renderWorkers.length > 0 ? this.renderWorkers[0] : null;
  }

  private generateFrameId(): string {
    return `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ===== Cleanup =====

  public dispose(): void {
    if (this.renderScheduler) {
      clearInterval(this.renderScheduler);
      this.renderScheduler = null;
    }

    if (this.performanceMonitor) {
      clearInterval(this.performanceMonitor);
      this.performanceMonitor = null;
    }

    if (this.frameRequestId) {
      cancelAnimationFrame(this.frameRequestId);
      this.frameRequestId = null;
    }

    // Terminate render workers
    this.renderWorkers.forEach(worker => {
      if ('terminate' in worker) {
        worker.terminate();
      }
    });
    this.renderWorkers = [];

    // Clear data
    this.viewportRenderStates.clear();
    this.renderQueue = [];
    this.processingFrames.clear();

    this.removeAllListeners();

    log.info('EnhancedRenderingOptimizer disposed', {
      component: 'EnhancedRenderingOptimizer',
    });
  }
}

// Singleton instance
export const enhancedRenderingOptimizer = new EnhancedRenderingOptimizer();
