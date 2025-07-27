/**
 * Performance Manager
 * Centralized performance optimization and monitoring for medical imaging
 */


export interface PerformanceMetrics {
  renderTime: number;
  loadTime: number;
  memoryUsage: number;
  fps: number;
  cacheHitRate: number;
  networkLatency: number;
  imageDecodeTime: number;
  viewportUpdateTime: number;
}

export interface PerformanceConfig {
  enableMetrics: boolean;
  maxCacheSize: number;
  preloadBuffer: number;
  targetFPS: number;
  memoryThreshold: number;
  enableWebWorkers: boolean;
  compressionLevel: number;
}

export interface PerformanceAlert {
  type: 'memory' | 'fps' | 'cache' | 'network';
  severity: 'low' | 'medium' | 'high';
  message: string;
  timestamp: number;
  metrics: Partial<PerformanceMetrics>;
}

/**
 * Central performance management system
 */
export class PerformanceManager extends EventTarget {
  /**
   * Trigger custom event
   */
  private triggerEvent(type: string, detail: any): void {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
  private static instance: PerformanceManager | null = null;
  private config: PerformanceConfig;
  private metrics: PerformanceMetrics;
  private metricsHistory: PerformanceMetrics[] = [];
  private performanceObserver: PerformanceObserver | null = null;
  private memoryMonitorInterval: number | null = null;
  private fpsMonitorInterval: number | null = null;
  private lastFrameTime = performance.now();
  private frameCount = 0;
  private isMonitoring = false;

  private constructor(config: Partial<PerformanceConfig> = {}) {
    super();

    this.config = {
      enableMetrics: true,
      maxCacheSize: 500 * 1024 * 1024, // 500MB
      preloadBuffer: 3,
      targetFPS: 60,
      memoryThreshold: 0.8, // 80% of available memory
      enableWebWorkers: true,
      compressionLevel: 0.8,
      ...config,
    };

    this.metrics = {
      renderTime: 0,
      loadTime: 0,
      memoryUsage: 0,
      fps: 0,
      cacheHitRate: 0,
      networkLatency: 0,
      imageDecodeTime: 0,
      viewportUpdateTime: 0,
    };

    this.initializeMonitoring();
  }

  public static getInstance(config?: Partial<PerformanceConfig>): PerformanceManager {
    if (!PerformanceManager.instance) {
      PerformanceManager.instance = new PerformanceManager(config);
    }
    return PerformanceManager.instance;
  }

  /**
   * Initialize performance monitoring systems
   */
  private initializeMonitoring(): void {
    if (!this.config.enableMetrics) return;

    // Performance Observer for timing measurements
    if ('PerformanceObserver' in window) {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          this.processPerformanceEntries(list.getEntries());
        });

        this.performanceObserver.observe({
          entryTypes: ['measure', 'navigation', 'resource'],
        });
      } catch (error) {
        console.warn('PerformanceObserver not supported:', error);
      }
    }

    this.startMonitoring();
  }

  /**
   * Start performance monitoring
   */
  public startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    // Memory monitoring
    this.memoryMonitorInterval = window.setInterval(() => {
      this.updateMemoryMetrics();
    }, 5000); // Every 5 seconds

    // FPS monitoring
    this.fpsMonitorInterval = window.setInterval(() => {
      this.updateFPSMetrics();
    }, 1000); // Every second

    this.triggerEvent('monitoring:started', { config: this.config });
  }

  /**
   * Stop performance monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = null;
    }

    if (this.fpsMonitorInterval) {
      clearInterval(this.fpsMonitorInterval);
      this.fpsMonitorInterval = null;
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    this.triggerEvent('monitoring:stopped', {});
  }

  /**
   * Process performance entries from PerformanceObserver
   */
  private processPerformanceEntries(entries: PerformanceEntry[]): void {
    entries.forEach(entry => {
      switch (entry.entryType) {
        case 'measure':
          this.processMeasureEntry(entry as PerformanceMeasure);
          break;
        case 'resource':
          this.processResourceEntry(entry as PerformanceResourceTiming);
          break;
        case 'navigation':
          this.processNavigationEntry(entry as PerformanceNavigationTiming);
          break;
      }
    });
  }

  /**
   * Process performance measure entries
   */
  private processMeasureEntry(entry: PerformanceMeasure): void {
    const duration = entry.duration;

    if (entry.name.includes('render')) {
      this.metrics.renderTime = duration;
    } else if (entry.name.includes('load')) {
      this.metrics.loadTime = duration;
    } else if (entry.name.includes('decode')) {
      this.metrics.imageDecodeTime = duration;
    } else if (entry.name.includes('viewport')) {
      this.metrics.viewportUpdateTime = duration;
    }

    this.checkPerformanceThresholds();
  }

  /**
   * Process resource timing entries
   */
  private processResourceEntry(entry: PerformanceResourceTiming): void {
    if (entry.name.includes('.dcm') || entry.name.includes('dicom')) {
      const networkTime = entry.responseEnd - entry.requestStart;
      this.metrics.networkLatency = networkTime;

      // Calculate load time for DICOM resources
      this.metrics.loadTime = entry.responseEnd - entry.requestStart;
    }
  }

  /**
   * Process navigation timing entries
   */
  private processNavigationEntry(entry: PerformanceNavigationTiming): void {
    // Update overall page load metrics
    this.metrics.loadTime = entry.loadEventEnd - entry.loadEventStart;
  }

  /**
   * Update memory usage metrics
   */
  private updateMemoryMetrics(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.metrics.memoryUsage = memory.usedJSHeapSize / memory.totalJSHeapSize;

      // Check memory threshold
      if (this.metrics.memoryUsage > this.config.memoryThreshold) {
        this.emitAlert({
          type: 'memory',
          severity: 'high',
          message: `Memory usage ${(this.metrics.memoryUsage * 100).toFixed(1)}% exceeds threshold`,
          timestamp: Date.now(),
          metrics: { memoryUsage: this.metrics.memoryUsage },
        });
      }
    }
  }

  /**
   * Update FPS metrics
   */
  private updateFPSMetrics(): void {
    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;

    if (deltaTime >= 1000) {
      this.metrics.fps = Math.round((this.frameCount * 1000) / deltaTime);
      this.frameCount = 0;
      this.lastFrameTime = now;

      // Check FPS threshold
      if (this.metrics.fps < this.config.targetFPS * 0.8) {
        this.emitAlert({
          type: 'fps',
          severity: 'medium',
          message: `FPS ${this.metrics.fps} below target ${this.config.targetFPS}`,
          timestamp: Date.now(),
          metrics: { fps: this.metrics.fps },
        });
      }
    }
  }

  /**
   * Record frame for FPS calculation
   */
  public recordFrame(): void {
    this.frameCount++;
  }

  /**
   * Start timing measurement
   */
  public startTiming(name: string): void {
    performance.mark(`${name}-start`);
  }

  /**
   * End timing measurement
   */
  public endTiming(name: string): number {
    const endMark = `${name}-end`;
    performance.mark(endMark);
    performance.measure(name, `${name}-start`, endMark);

    const measure = performance.getEntriesByName(name, 'measure')[0] as PerformanceMeasure;
    return measure ? measure.duration : 0;
  }

  /**
   * Optimize rendering performance
   */
  public optimizeRendering(): void {
    // Request idle callback for non-critical operations
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        this.cleanupUnusedResources();
      });
    }

    // Defer heavy operations
    this.deferHeavyOperations();
  }

  /**
   * Clean up unused resources
   */
  private cleanupUnusedResources(): void {
    // Trigger garbage collection hint
    if ('gc' in window && typeof (window as any).gc === 'function') {
      try {
        (window as any).gc();
      } catch (error) {
        // gc() is only available in development/debugging
      }
    }

    this.triggerEvent('cleanup:completed', {
      memoryBefore: this.metrics.memoryUsage,
    });
  }

  /**
   * Defer heavy operations to improve perceived performance
   */
  private deferHeavyOperations(): void {
    // Use setTimeout to defer operations
    setTimeout(() => {
      this.processQueuedOperations();
    }, 16); // Next frame
  }

  /**
   * Process queued operations
   */
  private processQueuedOperations(): void {
    // Implementation for processing deferred operations
    this.triggerEvent('operations:processed', {});
  }

  /**
   * Check performance thresholds and emit alerts
   */
  private checkPerformanceThresholds(): void {
    // Check render time threshold
    if (this.metrics.renderTime > 16.67) { // 60 FPS = 16.67ms per frame
      this.emitAlert({
        type: 'fps',
        severity: 'medium',
        message: `Render time ${this.metrics.renderTime.toFixed(2)}ms exceeds frame budget`,
        timestamp: Date.now(),
        metrics: { renderTime: this.metrics.renderTime },
      });
    }

    // Check load time threshold
    if (this.metrics.loadTime > 3000) { // 3 seconds
      this.emitAlert({
        type: 'network',
        severity: 'medium',
        message: `Load time ${this.metrics.loadTime.toFixed(0)}ms is slow`,
        timestamp: Date.now(),
        metrics: { loadTime: this.metrics.loadTime },
      });
    }
  }

  /**
   * Emit performance alert
   */
  private emitAlert(alert: PerformanceAlert): void {
    this.triggerEvent('performance:alert', alert);
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get performance metrics history
   */
  public getMetricsHistory(limit = 100): PerformanceMetrics[] {
    return this.metricsHistory.slice(-limit);
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...config };
    this.triggerEvent('config:updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  public getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  /**
   * Take performance snapshot
   */
  public takeSnapshot(): void {
    const snapshot = {
      ...this.metrics,
      timestamp: Date.now(),
    };

    this.metricsHistory.push(snapshot);

    // Keep only recent history
    if (this.metricsHistory.length > 1000) {
      this.metricsHistory = this.metricsHistory.slice(-500);
    }

    this.triggerEvent('snapshot:taken', snapshot);
  }

  /**
   * Get performance report
   */
  public getPerformanceReport(): {
    current: PerformanceMetrics;
    average: PerformanceMetrics;
    peak: PerformanceMetrics;
    alerts: number;
    } {
    const history = this.metricsHistory;

    if (history.length === 0) {
      return {
        current: this.metrics,
        average: this.metrics,
        peak: this.metrics,
        alerts: 0,
      };
    }

    // Calculate averages
    const average = history.reduce((acc, metrics) => ({
      renderTime: acc.renderTime + metrics.renderTime,
      loadTime: acc.loadTime + metrics.loadTime,
      memoryUsage: acc.memoryUsage + metrics.memoryUsage,
      fps: acc.fps + metrics.fps,
      cacheHitRate: acc.cacheHitRate + metrics.cacheHitRate,
      networkLatency: acc.networkLatency + metrics.networkLatency,
      imageDecodeTime: acc.imageDecodeTime + metrics.imageDecodeTime,
      viewportUpdateTime: acc.viewportUpdateTime + metrics.viewportUpdateTime,
    }), {
      renderTime: 0,
      loadTime: 0,
      memoryUsage: 0,
      fps: 0,
      cacheHitRate: 0,
      networkLatency: 0,
      imageDecodeTime: 0,
      viewportUpdateTime: 0,
    });

    const count = history.length;
    Object.keys(average).forEach(key => {
      (average as any)[key] /= count;
    });

    // Calculate peaks
    const peak = history.reduce((acc, metrics) => ({
      renderTime: Math.max(acc.renderTime, metrics.renderTime),
      loadTime: Math.max(acc.loadTime, metrics.loadTime),
      memoryUsage: Math.max(acc.memoryUsage, metrics.memoryUsage),
      fps: Math.max(acc.fps, metrics.fps),
      cacheHitRate: Math.max(acc.cacheHitRate, metrics.cacheHitRate),
      networkLatency: Math.max(acc.networkLatency, metrics.networkLatency),
      imageDecodeTime: Math.max(acc.imageDecodeTime, metrics.imageDecodeTime),
      viewportUpdateTime: Math.max(acc.viewportUpdateTime, metrics.viewportUpdateTime),
    }), this.metrics);

    return {
      current: this.metrics,
      average,
      peak,
      alerts: 0, // Would track from event history
    };
  }

  /**
   * Cleanup and destroy instance
   */
  public destroy(): void {
    this.stopMonitoring();
    PerformanceManager.instance = null;
  }
}

// Export singleton instance
export const performanceManager = PerformanceManager.getInstance();
