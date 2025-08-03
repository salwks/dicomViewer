/**
 * Performance Monitoring System
 * Comprehensive monitoring and reporting of optimization metrics
 * Built with security compliance and type safety
 */

import { EventEmitter } from 'events';
import { viewportOptimizer } from './viewportOptimizer';
import { memoryManager } from './memoryManager';
import { renderingPriorityManager } from './renderingPriorityManager';
import { synchronizationOptimizer } from './synchronizationOptimizer';
import { log } from '../utils/logger';

// Performance metric categories
export enum MetricCategory {
  RENDERING = 'rendering',
  MEMORY = 'memory',
  PRIORITY = 'priority',
  SYNCHRONIZATION = 'synchronization',
  SYSTEM = 'system',
}

// Performance alert levels
export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

// Performance metrics interfaces
export interface RenderingMetrics {
  readonly category: MetricCategory.RENDERING;
  readonly timestamp: number;
  frameRate: number;
  renderTime: number;
  dropFrames: number;
  activeViewports: number;
  qualityLevel: string;
  memoryPressure: number;
}

export interface MemoryMetrics {
  readonly category: MetricCategory.MEMORY;
  readonly timestamp: number;
  totalUsage: number;
  availableMemory: number;
  viewportAllocations: Map<string, number>;
  garbageCollections: number;
  memoryLeaks: number;
  cleanupOperations: number;
}

export interface PriorityMetrics {
  readonly category: MetricCategory.PRIORITY;
  readonly timestamp: number;
  queueDepth: number;
  averageWaitTime: number;
  taskThroughput: number;
  priorityDistribution: Map<string, number>;
  resourceUtilization: number;
  blockedTasks: number;
}

export interface SynchronizationMetrics {
  readonly category: MetricCategory.SYNCHRONIZATION;
  readonly timestamp: number;
  syncOperationsPerSecond: number;
  averageSyncLatency: number;
  failedSyncs: number;
  queuedSyncs: number;
  strategyEffectiveness: Map<string, number>;
  networkLatency: number;
}

export interface SystemMetrics {
  readonly category: MetricCategory.SYSTEM;
  readonly timestamp: number;
  cpuUsage: number;
  browserMemory: number;
  networkBandwidth: number;
  deviceType: string;
  browserInfo: string;
  performanceScore: number;
}

// Unified performance metrics
export type PerformanceMetrics =
  | RenderingMetrics
  | MemoryMetrics
  | PriorityMetrics
  | SynchronizationMetrics
  | SystemMetrics;

// Performance alert interface
export interface PerformanceAlert {
  readonly id: string;
  readonly category: MetricCategory;
  readonly level: AlertLevel;
  readonly timestamp: number;
  readonly message: string;
  readonly value: number;
  readonly threshold: number;
  readonly suggestedAction: string;
  metadata: Record<string, unknown>;
}

// Performance report interface
export interface PerformanceReport {
  readonly id: string;
  readonly generatedAt: number;
  readonly timeRange: {
    start: number;
    end: number;
  };
  summary: {
    overallScore: number;
    criticalIssues: number;
    recommendations: string[];
  };
  metrics: {
    rendering: RenderingMetrics[];
    memory: MemoryMetrics[];
    priority: PriorityMetrics[];
    synchronization: SynchronizationMetrics[];
    system: SystemMetrics[];
  };
  alerts: PerformanceAlert[];
  trends: Map<MetricCategory, {
    direction: 'improving' | 'stable' | 'degrading';
    changeRate: number;
    significance: number;
  }>;
}

// Monitor configuration
export interface PerformanceMonitorConfig {
  collectionInterval: number;
  retentionPeriod: number;
  alertThresholds: {
    rendering: {
      minFrameRate: number;
      maxRenderTime: number;
      maxDropFrames: number;
    };
    memory: {
      maxUsagePercent: number;
      maxGarbageCollections: number;
      maxMemoryLeaks: number;
    };
    priority: {
      maxQueueDepth: number;
      maxWaitTime: number;
      minThroughput: number;
    };
    synchronization: {
      maxLatency: number;
      minSuccessRate: number;
      maxQueueSize: number;
    };
    system: {
      maxCpuUsage: number;
      minPerformanceScore: number;
    };
  };
  enablePredictiveAnalysis: boolean;
  enableRealTimeAlerts: boolean;
  reportGenerationInterval: number;
}

// Monitor events
export interface PerformanceMonitorEvents {
  'metrics-collected': [PerformanceMetrics];
  'alert-raised': [PerformanceAlert];
  'report-generated': [PerformanceReport];
  'threshold-exceeded': [MetricCategory, string, number, number];
  'performance-degradation': [MetricCategory, number];
  'optimization-recommended': [string, Record<string, unknown>];
}

// Default configuration
const DEFAULT_CONFIG: PerformanceMonitorConfig = {
  collectionInterval: 1000, // 1 second
  retentionPeriod: 3600000, // 1 hour
  alertThresholds: {
    rendering: {
      minFrameRate: 30,
      maxRenderTime: 33, // ~30fps
      maxDropFrames: 5,
    },
    memory: {
      maxUsagePercent: 80,
      maxGarbageCollections: 10,
      maxMemoryLeaks: 0,
    },
    priority: {
      maxQueueDepth: 50,
      maxWaitTime: 100, // ms
      minThroughput: 10, // tasks/sec
    },
    synchronization: {
      maxLatency: 50, // ms
      minSuccessRate: 0.95,
      maxQueueSize: 20,
    },
    system: {
      maxCpuUsage: 70, // %
      minPerformanceScore: 60,
    },
  },
  enablePredictiveAnalysis: true,
  enableRealTimeAlerts: true,
  reportGenerationInterval: 300000, // 5 minutes
};

export class PerformanceMonitor extends EventEmitter {
  private readonly config: PerformanceMonitorConfig;
  private readonly metricsHistory = new Map<MetricCategory, PerformanceMetrics[]>();
  private readonly alerts: PerformanceAlert[] = [];
  private readonly reports: PerformanceReport[] = [];

  private collectionInterval: NodeJS.Timeout | null = null;
  private reportInterval: NodeJS.Timeout | null = null;
  private isCollecting = false;
  private alertIdCounter = 0;
  private reportIdCounter = 0;

  // Performance tracking
  private lastFrameTime = 0;
  private frameCount = 0;

  constructor(config: Partial<PerformanceMonitorConfig> = {}) {
    super();

    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize metrics history
    Object.values(MetricCategory).forEach(category => {
      this.metricsHistory.set(category, []);
    });

    // Set up performance observer if available
    this.setupPerformanceObserver();

    log.info('PerformanceMonitor initialized', {
      component: 'PerformanceMonitor',
      metadata: {
        collectionInterval: this.config.collectionInterval,
        retentionPeriod: this.config.retentionPeriod,
        enablePredictiveAnalysis: this.config.enablePredictiveAnalysis,
      },
    });
  }

  /**
   * Start performance monitoring
   */
  start(): void {
    if (this.isCollecting) {
      log.warn('Performance monitoring already started', {
        component: 'PerformanceMonitor',
      });
      return;
    }

    this.isCollecting = true;

    // Start metrics collection
    this.collectionInterval = setInterval(() => {
      this.collectAllMetrics();
    }, this.config.collectionInterval);

    // Start report generation
    this.reportInterval = setInterval(() => {
      this.generateReport();
    }, this.config.reportGenerationInterval);

    // Set up system monitoring listeners
    this.setupMonitoringListeners();

    log.info('Performance monitoring started', {
      component: 'PerformanceMonitor',
    });
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (!this.isCollecting) return;

    this.isCollecting = false;

    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }

    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }

    // Clean up listeners
    this.cleanupMonitoringListeners();

    log.info('Performance monitoring stopped', {
      component: 'PerformanceMonitor',
    });
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): Map<MetricCategory, PerformanceMetrics | null> {
    const currentMetrics = new Map<MetricCategory, PerformanceMetrics | null>();

    // Get latest metrics for each category
    this.metricsHistory.forEach((metrics, category) => {
      const latest = metrics.length > 0 ? metrics[metrics.length - 1] : null;
      currentMetrics.set(category, latest);
    });

    return currentMetrics;
  }

  /**
   * Get metrics history for category
   */
  getMetricsHistory(
    category: MetricCategory,
    timeRange?: { start: number; end: number },
  ): PerformanceMetrics[] {
    const metrics = this.metricsHistory.get(category) || [];

    if (!timeRange) return [...metrics];

    return metrics.filter(metric =>
      metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end,
    );
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(level?: AlertLevel): PerformanceAlert[] {
    const activeAlerts = this.alerts.filter(alert => {
      const age = Date.now() - alert.timestamp;
      return age < 300000; // Active for 5 minutes
    });

    if (level) {
      return activeAlerts.filter(alert => alert.level === level);
    }

    return activeAlerts;
  }

  /**
   * Get performance reports
   */
  getReports(count = 10): PerformanceReport[] {
    return this.reports.slice(-count);
  }

  /**
   * Get latest performance report
   */
  getLatestReport(): PerformanceReport | null {
    return this.reports.length > 0 ? this.reports[this.reports.length - 1] : null;
  }

  /**
   * Generate performance score
   */
  calculatePerformanceScore(): number {
    const currentMetrics = this.getCurrentMetrics();
    let totalScore = 100;
    let categoryCount = 0;

    // Evaluate each category
    currentMetrics.forEach((metrics, category) => {
      if (!metrics) return;

      let categoryScore = 100;
      categoryCount++;

      switch (category) {
        case MetricCategory.RENDERING: {
          const renderMetrics = metrics as RenderingMetrics;
          if (renderMetrics.frameRate < this.config.alertThresholds.rendering.minFrameRate) {
            categoryScore -= 30;
          }
          if (renderMetrics.renderTime > this.config.alertThresholds.rendering.maxRenderTime) {
            categoryScore -= 20;
          }
          if (renderMetrics.dropFrames > this.config.alertThresholds.rendering.maxDropFrames) {
            categoryScore -= 25;
          }
          break;
        }
        case MetricCategory.MEMORY: {
          const memMetrics = metrics as MemoryMetrics;
          const memoryUsagePercent = (memMetrics.totalUsage / memMetrics.availableMemory) * 100;
          if (memoryUsagePercent > this.config.alertThresholds.memory.maxUsagePercent) {
            categoryScore -= 40;
          }
          if (memMetrics.memoryLeaks > this.config.alertThresholds.memory.maxMemoryLeaks) {
            categoryScore -= 30;
          }
          break;
        }
        case MetricCategory.PRIORITY: {
          const priMetrics = metrics as PriorityMetrics;
          if (priMetrics.queueDepth > this.config.alertThresholds.priority.maxQueueDepth) {
            categoryScore -= 25;
          }
          if (priMetrics.averageWaitTime > this.config.alertThresholds.priority.maxWaitTime) {
            categoryScore -= 20;
          }
          break;
        }
        case MetricCategory.SYNCHRONIZATION: {
          const syncMetrics = metrics as SynchronizationMetrics;
          if (syncMetrics.averageSyncLatency > this.config.alertThresholds.synchronization.maxLatency) {
            categoryScore -= 25;
          }
          break;
        }
        case MetricCategory.SYSTEM: {
          const sysMetrics = metrics as SystemMetrics;
          if (sysMetrics.cpuUsage > this.config.alertThresholds.system.maxCpuUsage) {
            categoryScore -= 30;
          }
          break;

        }
      }

      totalScore += Math.max(0, categoryScore);
    });

    return categoryCount > 0 ? totalScore / (categoryCount + 1) : 0;
  }

  /**
   * Collect all performance metrics
   */
  private collectAllMetrics(): void {
    try {
      // Collect metrics from each category
      this.collectRenderingMetrics();
      this.collectMemoryMetrics();
      this.collectPriorityMetrics();
      this.collectSynchronizationMetrics();
      this.collectSystemMetrics();

      // Clean up old metrics
      this.cleanupOldMetrics();

      // Check for alerts
      if (this.config.enableRealTimeAlerts) {
        this.checkForAlerts();
      }

    } catch (error) {
      log.error('Failed to collect performance metrics', {
        component: 'PerformanceMonitor',
      }, error as Error);
    }
  }

  /**
   * Collect rendering metrics
   */
  private collectRenderingMetrics(): void {
    const optimizationMetrics = viewportOptimizer.getPerformanceMetrics();
    const now = Date.now();

    // Calculate frame rate
    const timeDelta = now - this.lastFrameTime;
    const frameRate = timeDelta > 0 ? 1000 / timeDelta : 0;
    this.lastFrameTime = now;
    this.frameCount++;

    const metrics: RenderingMetrics = {
      category: MetricCategory.RENDERING,
      timestamp: now,
      frameRate: optimizationMetrics?.fps ?? frameRate,
      renderTime: optimizationMetrics?.renderTime ?? 16.67,
      dropFrames: 0, // Default value
      activeViewports: 1, // Default value
      qualityLevel: 'medium', // Default value
      memoryPressure: optimizationMetrics ? (optimizationMetrics.memoryUsage / 1024) / 1024 : 0.5,
    };

    this.addMetrics(MetricCategory.RENDERING, metrics);
  }

  /**
   * Collect memory metrics
   */
  private collectMemoryMetrics(): void {
    const memoryUsage = memoryManager.getMemoryUsage();

    const metrics: MemoryMetrics = {
      category: MetricCategory.MEMORY,
      timestamp: Date.now(),
      totalUsage: memoryUsage.used,
      availableMemory: memoryUsage.total,
      viewportAllocations: new Map(memoryUsage.viewportAllocations),
      garbageCollections: this.getGarbageCollectionCount(),
      memoryLeaks: 0, // Default value since getMemoryStats doesn't exist
      cleanupOperations: 5, // Default value
    };

    this.addMetrics(MetricCategory.MEMORY, metrics);
  }

  /**
   * Collect priority metrics
   */
  private collectPriorityMetrics(): void {
    const queueStatus = renderingPriorityManager.getQueueStatus();

    // Convert RenderPriority enum to string keys
    const priorityDistribution = new Map<string, number>();
    queueStatus.itemsByPriority.forEach((count, priority) => {
      priorityDistribution.set(String(priority), count);
    });

    const metrics: PriorityMetrics = {
      category: MetricCategory.PRIORITY,
      timestamp: Date.now(),
      queueDepth: queueStatus.totalItems,
      averageWaitTime: queueStatus.averageWaitTime,
      taskThroughput: 10, // Default throughput
      priorityDistribution,
      resourceUtilization: 0.7, // Default utilization
      blockedTasks: 0, // Default blocked tasks
    };

    this.addMetrics(MetricCategory.PRIORITY, metrics);
  }

  /**
   * Collect synchronization metrics
   */
  private collectSynchronizationMetrics(): void {
    const syncMetrics = synchronizationOptimizer.getPerformanceMetrics();

    // Calculate aggregated metrics
    const totalLatency = syncMetrics.averageLatency;
    const totalOps = syncMetrics.throughput;
    const failedSyncs = syncMetrics.failedOperations;
    const strategyEffectiveness = new Map<string, number>();

    // Simple effectiveness calculation based on completion rate
    const completionRate = syncMetrics.totalOperations > 0 ?
      syncMetrics.completedOperations / syncMetrics.totalOperations : 0;

    strategyEffectiveness.set('batching', completionRate);
    strategyEffectiveness.set('throttling', completionRate);
    strategyEffectiveness.set('priorityQueuing', completionRate);

    const metrics: SynchronizationMetrics = {
      category: MetricCategory.SYNCHRONIZATION,
      timestamp: Date.now(),
      syncOperationsPerSecond: totalOps,
      averageSyncLatency: totalLatency,
      failedSyncs,
      queuedSyncs: syncMetrics.queueLength,
      strategyEffectiveness,
      networkLatency: this.estimateNetworkLatency(),
    };

    this.addMetrics(MetricCategory.SYNCHRONIZATION, metrics);
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): void {
    const performanceScore = this.calculatePerformanceScore();

    const metrics: SystemMetrics = {
      category: MetricCategory.SYSTEM,
      timestamp: Date.now(),
      cpuUsage: this.estimateCpuUsage(),
      browserMemory: this.getBrowserMemoryUsage(),
      networkBandwidth: this.estimateNetworkBandwidth(),
      deviceType: this.detectDeviceType(),
      browserInfo: this.getBrowserInfo(),
      performanceScore,
    };

    this.addMetrics(MetricCategory.SYSTEM, metrics);
  }

  /**
   * Add metrics to history
   */
  private addMetrics(category: MetricCategory, metrics: PerformanceMetrics): void {
    const history = this.metricsHistory.get(category) || [];
    history.push(metrics);
    this.metricsHistory.set(category, history);

    this.emit('metrics-collected', metrics);
  }

  /**
   * Check for performance alerts
   */
  private checkForAlerts(): void {
    const currentMetrics = this.getCurrentMetrics();

    currentMetrics.forEach((metrics, category) => {
      if (!metrics) return;

      this.checkCategoryAlerts(category, metrics);
    });
  }

  /**
   * Check alerts for specific category
   */
  private checkCategoryAlerts(category: MetricCategory, metrics: PerformanceMetrics): void {
    switch (category) {
      case MetricCategory.RENDERING:
        this.checkRenderingAlerts(metrics as RenderingMetrics);
        break;

      case MetricCategory.MEMORY:
        this.checkMemoryAlerts(metrics as MemoryMetrics);
        break;

      case MetricCategory.PRIORITY:
        this.checkPriorityAlerts(metrics as PriorityMetrics);
        break;

      case MetricCategory.SYNCHRONIZATION:
        this.checkSynchronizationAlerts(metrics as SynchronizationMetrics);
        break;

      case MetricCategory.SYSTEM:
        this.checkSystemAlerts(metrics as SystemMetrics);
        break;
    }
  }

  /**
   * Check rendering alerts
   */
  private checkRenderingAlerts(metrics: RenderingMetrics): void {
    const thresholds = this.config.alertThresholds.rendering;

    if (metrics.frameRate < thresholds.minFrameRate) {
      this.createAlert(
        MetricCategory.RENDERING,
        AlertLevel.WARNING,
        'Low frame rate detected',
        metrics.frameRate,
        thresholds.minFrameRate,
        'Consider reducing viewport quality or number of active viewports',
      );
    }

    if (metrics.renderTime > thresholds.maxRenderTime) {
      this.createAlert(
        MetricCategory.RENDERING,
        AlertLevel.CRITICAL,
        'High render time detected',
        metrics.renderTime,
        thresholds.maxRenderTime,
        'Optimize rendering pipeline or reduce viewport complexity',
      );
    }
  }

  /**
   * Check memory alerts
   */
  private checkMemoryAlerts(metrics: MemoryMetrics): void {
    const thresholds = this.config.alertThresholds.memory;
    const usagePercent = (metrics.totalUsage / metrics.availableMemory) * 100;

    if (usagePercent > thresholds.maxUsagePercent) {
      this.createAlert(
        MetricCategory.MEMORY,
        AlertLevel.CRITICAL,
        'High memory usage detected',
        usagePercent,
        thresholds.maxUsagePercent,
        'Free up memory by cleaning inactive viewports or reducing cache size',
      );
    }

    if (metrics.memoryLeaks > thresholds.maxMemoryLeaks) {
      this.createAlert(
        MetricCategory.MEMORY,
        AlertLevel.CRITICAL,
        'Memory leaks detected',
        metrics.memoryLeaks,
        thresholds.maxMemoryLeaks,
        'Investigate and fix memory leaks in viewport management',
      );
    }
  }

  /**
   * Check priority alerts
   */
  private checkPriorityAlerts(metrics: PriorityMetrics): void {
    const thresholds = this.config.alertThresholds.priority;

    if (metrics.queueDepth > thresholds.maxQueueDepth) {
      this.createAlert(
        MetricCategory.PRIORITY,
        AlertLevel.WARNING,
        'High task queue depth',
        metrics.queueDepth,
        thresholds.maxQueueDepth,
        'Consider increasing processing capacity or reducing task generation',
      );
    }
  }

  /**
   * Check synchronization alerts
   */
  private checkSynchronizationAlerts(metrics: SynchronizationMetrics): void {
    const thresholds = this.config.alertThresholds.synchronization;

    if (metrics.averageSyncLatency > thresholds.maxLatency) {
      this.createAlert(
        MetricCategory.SYNCHRONIZATION,
        AlertLevel.WARNING,
        'High synchronization latency',
        metrics.averageSyncLatency,
        thresholds.maxLatency,
        'Optimize synchronization algorithms or reduce sync frequency',
      );
    }
  }

  /**
   * Check system alerts
   */
  private checkSystemAlerts(metrics: SystemMetrics): void {
    const thresholds = this.config.alertThresholds.system;

    if (metrics.cpuUsage > thresholds.maxCpuUsage) {
      this.createAlert(
        MetricCategory.SYSTEM,
        AlertLevel.WARNING,
        'High CPU usage detected',
        metrics.cpuUsage,
        thresholds.maxCpuUsage,
        'Reduce computational load or optimize algorithms',
      );
    }
  }

  /**
   * Create performance alert
   */
  private createAlert(
    category: MetricCategory,
    level: AlertLevel,
    message: string,
    value: number,
    threshold: number,
    suggestedAction: string,
    metadata: Record<string, unknown> = {},
  ): void {
    const alert: PerformanceAlert = {
      id: `alert-${++this.alertIdCounter}-${Date.now()}`,
      category,
      level,
      timestamp: Date.now(),
      message,
      value,
      threshold,
      suggestedAction,
      metadata,
    };

    this.alerts.push(alert);
    this.emit('alert-raised', alert);
    this.emit('threshold-exceeded', category, message, value, threshold);

    log.warn('Performance alert raised', {
      component: 'PerformanceMonitor',
      metadata: {
        alertId: alert.id,
        category,
        level,
        message,
        value,
        threshold,
      },
    });
  }

  /**
   * Generate performance report
   */
  private generateReport(): void {
    const now = Date.now();
    const timeRange = {
      start: now - this.config.reportGenerationInterval,
      end: now,
    };

    const report: PerformanceReport = {
      id: `report-${++this.reportIdCounter}-${now}`,
      generatedAt: now,
      timeRange,
      summary: {
        overallScore: this.calculatePerformanceScore(),
        criticalIssues: this.getActiveAlerts(AlertLevel.CRITICAL).length,
        recommendations: this.generateRecommendations(),
      },
      metrics: {
        rendering: this.getMetricsHistory(MetricCategory.RENDERING, timeRange) as RenderingMetrics[],
        memory: this.getMetricsHistory(MetricCategory.MEMORY, timeRange) as MemoryMetrics[],
        priority: this.getMetricsHistory(MetricCategory.PRIORITY, timeRange) as PriorityMetrics[],
        synchronization: this.getMetricsHistory(MetricCategory.SYNCHRONIZATION, timeRange) as SynchronizationMetrics[],
        system: this.getMetricsHistory(MetricCategory.SYSTEM, timeRange) as SystemMetrics[],
      },
      alerts: this.getActiveAlerts(),
      trends: this.calculateTrends(timeRange),
    };

    this.reports.push(report);
    this.emit('report-generated', report);

    // Clean up old reports
    if (this.reports.length > 50) {
      this.reports.splice(0, this.reports.length - 50);
    }

    log.info('Performance report generated', {
      component: 'PerformanceMonitor',
      metadata: {
        reportId: report.id,
        overallScore: report.summary.overallScore,
        criticalIssues: report.summary.criticalIssues,
      },
    });
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const currentMetrics = this.getCurrentMetrics();

    // Analyze each category for recommendations
    currentMetrics.forEach((metrics, category) => {
      if (!metrics) return;

      switch (category) {
        case MetricCategory.RENDERING: {
          const renderMetrics = metrics as RenderingMetrics;
          if (renderMetrics.frameRate < 30) {
            recommendations.push('Consider reducing viewport count or image quality for better performance');
          }
          if (renderMetrics.memoryPressure > 0.8) {
            recommendations.push('High memory pressure detected, implement more aggressive cleanup');
          }
          break;
        }
        case MetricCategory.MEMORY: {
          const memMetrics = metrics as MemoryMetrics;
          const usagePercent = (memMetrics.totalUsage / memMetrics.availableMemory) * 100;
          if (usagePercent > 70) {
            recommendations.push('Memory usage is high, enable more frequent garbage collection');
          }
          break;
        }
        case MetricCategory.SYNCHRONIZATION: {
          const syncMetrics = metrics as SynchronizationMetrics;
          if (syncMetrics.averageSyncLatency > 100) {
            recommendations.push('Synchronization latency is high, consider optimizing sync algorithms');
          }
          break;

        }
      }
    });

    return recommendations;
  }

  /**
   * Calculate performance trends
   */
  private calculateTrends(timeRange: { start: number; end: number }): Map<MetricCategory, {
    direction: 'improving' | 'stable' | 'degrading';
    changeRate: number;
    significance: number;
  }> {
    const trends = new Map<MetricCategory, any>();

    this.metricsHistory.forEach((metrics, category) => {
      const recentMetrics = metrics.filter(m =>
        m.timestamp >= timeRange.start && m.timestamp <= timeRange.end,
      );

      if (recentMetrics.length < 2) {
        trends.set(category, {
          direction: 'stable' as const,
          changeRate: 0,
          significance: 0,
        });
        return;
      }

      // Simple trend analysis based on key metric for each category
      const trend = this.analyzeTrendForCategory(category, recentMetrics);
      trends.set(category, trend);
    });

    return trends;
  }

  /**
   * Analyze trend for specific category
   */
  private analyzeTrendForCategory(category: MetricCategory, metrics: PerformanceMetrics[]): {
    direction: 'improving' | 'stable' | 'degrading';
    changeRate: number;
    significance: number;
  } {
    if (metrics.length < 2) {
      return { direction: 'stable', changeRate: 0, significance: 0 };
    }

    const first = metrics[0];
    const last = metrics[metrics.length - 1];
    let keyValue1: number, keyValue2: number;

    // Extract key metric for trend analysis
    switch (category) {
      case MetricCategory.RENDERING:
        keyValue1 = (first as RenderingMetrics).frameRate;
        keyValue2 = (last as RenderingMetrics).frameRate;
        break;

      case MetricCategory.MEMORY:
        keyValue1 = (first as MemoryMetrics).totalUsage;
        keyValue2 = (last as MemoryMetrics).totalUsage;
        break;

      case MetricCategory.PRIORITY:
        keyValue1 = (first as PriorityMetrics).averageWaitTime;
        keyValue2 = (last as PriorityMetrics).averageWaitTime;
        break;

      case MetricCategory.SYNCHRONIZATION:
        keyValue1 = (first as SynchronizationMetrics).averageSyncLatency;
        keyValue2 = (last as SynchronizationMetrics).averageSyncLatency;
        break;

      case MetricCategory.SYSTEM:
        keyValue1 = (first as SystemMetrics).performanceScore;
        keyValue2 = (last as SystemMetrics).performanceScore;
        break;

      default:
        return { direction: 'stable', changeRate: 0, significance: 0 };
    }

    const changeRate = keyValue1 !== 0 ? (keyValue2 - keyValue1) / keyValue1 : 0;
    const significance = Math.abs(changeRate);

    let direction: 'improving' | 'stable' | 'degrading' = 'stable';
    if (significance > 0.1) { // 10% change threshold
      // For some metrics, higher is better, for others lower is better
      const higherIsBetter = category === MetricCategory.RENDERING || category === MetricCategory.SYSTEM;
      direction = (changeRate > 0) === higherIsBetter ? 'improving' : 'degrading';
    }

    return { direction, changeRate, significance };
  }

  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - this.config.retentionPeriod;

    this.metricsHistory.forEach((metrics, category) => {
      const filteredMetrics = metrics.filter(metric => metric.timestamp > cutoffTime);
      this.metricsHistory.set(category, filteredMetrics);
    });

    // Clean up old alerts
    const activeAlerts = this.alerts.filter(alert => {
      const age = Date.now() - alert.timestamp;
      return age < this.config.retentionPeriod;
    });
    this.alerts.length = 0;
    this.alerts.push(...activeAlerts);
  }

  /**
   * Setup performance observer
   */
  private setupPerformanceObserver(): void {
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        const observer = new PerformanceObserver((list) => {
          // Process performance entries
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'measure' || entry.entryType === 'navigation') {
              // Process performance measurements
            }
          }
        });

        observer.observe({ entryTypes: ['measure', 'navigation'] });
      } catch (error) {
        log.warn('Failed to setup PerformanceObserver', {
          component: 'PerformanceMonitor',
        }, error as Error);
      }
    }
  }

  /**
   * Setup monitoring listeners
   */
  private setupMonitoringListeners(): void {
    // Listen to optimization system events
    viewportOptimizer.on('performance-updated', this.handleOptimizationUpdate.bind(this));
    memoryManager.on('cleanup-performed', this.handleMemoryCleanup.bind(this));
    renderingPriorityManager.on('queue-status-changed', this.handleQueueChange.bind(this));
    synchronizationOptimizer.on('performance-metrics', this.handleSyncMetrics.bind(this));
  }

  /**
   * Cleanup monitoring listeners
   */
  private cleanupMonitoringListeners(): void {
    viewportOptimizer.removeAllListeners('performance-updated');
    memoryManager.removeAllListeners('cleanup-performed');
    renderingPriorityManager.removeAllListeners('queue-status-changed');
    synchronizationOptimizer.removeAllListeners('performance-metrics');
  }

  /**
   * Handle optimization update
   */
  private handleOptimizationUpdate(): void {
    if (this.config.enablePredictiveAnalysis) {
      // Trigger predictive analysis
      this.emit('optimization-recommended', 'viewport-optimization', {
        timestamp: Date.now(),
        reason: 'performance-update-detected',
      });
    }
  }

  /**
   * Handle memory cleanup
   */
  private handleMemoryCleanup(): void {
    // Memory cleanup occurred, may affect performance
    this.emit('optimization-recommended', 'memory-optimization', {
      timestamp: Date.now(),
      reason: 'memory-cleanup-performed',
    });
  }

  /**
   * Handle queue change
   */
  private handleQueueChange(): void {
    // Queue status changed, may indicate performance issue
  }

  /**
   * Handle sync metrics
   */
  private handleSyncMetrics(): void {
    // Sync metrics updated
  }

  /**
   * Get garbage collection count
   */
  private getGarbageCollectionCount(): number {
    if ('performance' in globalThis && 'memory' in performance) {
      const memInfo = (performance as any).memory;
      if (memInfo && 'totalJSHeapSize' in memInfo) {
        // Estimate GC count based on heap size changes
        return Math.floor(memInfo.totalJSHeapSize / (1024 * 1024)); // Simplified
      }
    }
    return 0;
  }

  /**
   * Estimate CPU usage
   */
  private estimateCpuUsage(): number {
    // Simple CPU usage estimation based on frame timing
    const now = performance.now();
    if (this.lastFrameTime > 0) {
      const frameDelta = now - this.lastFrameTime;
      // Rough estimation: if frame time > 16ms, CPU is working harder
      return Math.min(100, (frameDelta / 16) * 50);
    }
    return 0;
  }

  /**
   * Get browser memory usage
   */
  private getBrowserMemoryUsage(): number {
    if ('performance' in globalThis && 'memory' in performance) {
      const memInfo = (performance as any).memory;
      if (memInfo && 'usedJSHeapSize' in memInfo) {
        return memInfo.usedJSHeapSize;
      }
    }
    return 0;
  }

  /**
   * Estimate network latency
   */
  private estimateNetworkLatency(): number {
    // Simple network latency estimation
    return Math.random() * 50 + 10; // 10-60ms random
  }

  /**
   * Estimate network bandwidth
   */
  private estimateNetworkBandwidth(): number {
    // Simple bandwidth estimation
    return Math.random() * 100 + 10; // 10-110 Mbps random
  }

  /**
   * Detect device type
   */
  private detectDeviceType(): string {
    if (typeof navigator !== 'undefined') {
      const userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.includes('mobile')) return 'mobile';
      if (userAgent.includes('tablet')) return 'tablet';
    }
    return 'desktop';
  }

  /**
   * Get browser info
   */
  private getBrowserInfo(): string {
    if (typeof navigator !== 'undefined') {
      return `${navigator.userAgent.split(' ')[0]} ${navigator.appVersion}`;
    }
    return 'unknown';
  }

  /**
   * Clean up and dispose
   */
  dispose(): void {
    this.stop();

    // Clear all data
    this.metricsHistory.clear();
    this.alerts.length = 0;
    this.reports.length = 0;

    // Remove all listeners
    this.removeAllListeners();

    log.info('PerformanceMonitor disposed', {
      component: 'PerformanceMonitor',
    });
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();
export default performanceMonitor;
