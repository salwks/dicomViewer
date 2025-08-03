/**
 * Performance Monitoring System
 * Advanced performance monitoring and analysis for the entire viewport optimization system
 */

import { EventEmitter } from 'events';
import { log } from '../../utils/logger';
import {
  PerformanceSnapshot,
  PerformanceReport,
  PerformanceIssue,
  PerformanceRecommendation,
  MonitoringConfig,
  RenderingPerformanceMetrics,
  MemoryPerformanceMetrics,
  SyncPerformanceMetrics,
  LazyLoadingPerformanceMetrics,
  SystemPerformanceMetrics,
} from './types';

// Default monitoring configuration
const DEFAULT_CONFIG: MonitoringConfig = {
  sampleInterval: 1000, // 1 second
  retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
  alertThresholds: {
    fps: { warning: 30, critical: 15 },
    renderTime: { warning: 33, critical: 66 }, // milliseconds
    memoryUsage: { warning: 75, critical: 90 }, // percentage
    cpuUsage: { warning: 80, critical: 95 },
    gpuUsage: { warning: 85, critical: 95 },
  },
  enabledMetrics: {
    rendering: true,
    memory: true,
    synchronization: true,
    lazyLoading: true,
    system: true,
  },
  reportGeneration: {
    autoGenerate: true,
    interval: 5 * 60 * 1000, // 5 minutes
    includeCharts: true,
    includeRawData: false,
  },
};

export class PerformanceMonitoringSystem extends EventEmitter {
  private readonly config: MonitoringConfig;
  private readonly snapshots: PerformanceSnapshot[] = [];
  private readonly issues: Map<string, PerformanceIssue> = new Map();
  private readonly sessionId: string;

  private monitoringInterval: NodeJS.Timeout | null = null;
  private reportInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private lastCleanup = 0;

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = this.generateSessionId();

    log.info('PerformanceMonitoringSystem initialized', {
      component: 'PerformanceMonitoringSystem',
      metadata: {
        sessionId: this.sessionId,
        sampleInterval: this.config.sampleInterval,
        retentionPeriod: this.config.retentionPeriod,
      },
    });
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    // Start snapshot collection
    this.monitoringInterval = setInterval(() => {
      this.collectSnapshot();
    }, this.config.sampleInterval);

    // Start report generation if enabled
    if (this.config.reportGeneration.autoGenerate) {
      this.reportInterval = setInterval(() => {
        this.generateReport();
      }, this.config.reportGeneration.interval);
    }

    // Cleanup old data periodically
    setInterval(() => {
      this.cleanupOldData();
    }, 60000); // Every minute

    log.info('Performance monitoring started', {
      component: 'PerformanceMonitoringSystem',
      metadata: { sessionId: this.sessionId },
    });
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }

    log.info('Performance monitoring stopped', {
      component: 'PerformanceMonitoringSystem',
      metadata: { sessionId: this.sessionId },
    });
  }

  /**
   * Collect a performance snapshot
   */
  private collectSnapshot(): void {
    try {
      const snapshot: PerformanceSnapshot = {
        timestamp: Date.now(),
        sessionId: this.sessionId,
        metrics: {
          rendering: this.collectRenderingMetrics(),
          memory: this.collectMemoryMetrics(),
          synchronization: this.collectSyncMetrics(),
          lazyLoading: this.collectLazyLoadingMetrics(),
          system: this.collectSystemMetrics(),
        },
        issues: [],
        recommendations: [],
      };

      // Analyze for issues
      const issues = this.analyzePerformanceIssues(snapshot);
      snapshot.issues = issues;

      // Generate recommendations
      const recommendations = this.generateRecommendations(snapshot);
      snapshot.recommendations = recommendations;

      // Store snapshot
      this.snapshots.push(snapshot);

      // Emit events for new issues
      issues.forEach(issue => {
        if (!this.issues.has(issue.id)) {
          this.issues.set(issue.id, issue);
          this.emit('issue-detected', issue);
        }
      });

      // Update existing issues
      this.updateIssueStatus(issues);

      // Store updated issues
      issues.forEach(issue => {
        this.issues.set(issue.id, issue);
      });

      this.emit('snapshot-collected', snapshot);

    } catch (error) {
      log.error('Failed to collect performance snapshot', {
        component: 'PerformanceMonitoringSystem',
        metadata: { sessionId: this.sessionId },
      }, error as Error);
    }
  }

  /**
   * Collect rendering performance metrics
   */
  private collectRenderingMetrics(): RenderingPerformanceMetrics {
    // Simulated implementation - would integrate with actual rendering system
    return {
      frameRate: {
        current: 60,
        average: 58.5,
        target: 60,
        drops: 2,
      },
      renderTime: {
        average: 16.7,
        peak: 33.3,
        p95: 25.0,
        p99: 30.0,
      },
      viewportMetrics: new Map(),
      optimization: {
        throttledFrames: 0,
        adaptiveQualityChanges: 1,
        cullingSavings: 15,
      },
    };
  }

  /**
   * Collect memory performance metrics
   */
  private collectMemoryMetrics(): MemoryPerformanceMetrics {
    const memInfo = this.getMemoryInfo();

    return {
      usage: {
        total: memInfo.totalJSHeapSize || 0,
        used: memInfo.usedJSHeapSize || 0,
        available: (memInfo.totalJSHeapSize || 0) - (memInfo.usedJSHeapSize || 0),
        peak: memInfo.jsHeapSizeLimit || 0,
      },
      allocation: {
        rate: 1.5, // MB/sec
        peak: 5.0,
        frequency: 0.1, // allocations per ms
      },
      gc: {
        collections: 0,
        totalTime: 0,
        averageTime: 0,
        pressure: 'low',
      },
      pools: {
        texturePool: { used: 45, total: 100, hitRate: 0.85 },
        bufferPool: { used: 30, total: 50, hitRate: 0.90 },
        shaderPool: { used: 12, total: 20, hitRate: 0.95 },
      },
    };
  }

  /**
   * Collect synchronization performance metrics
   */
  private collectSyncMetrics(): SyncPerformanceMetrics {
    return {
      operations: {
        total: 100,
        successful: 98,
        failed: 2,
        pending: 0,
      },
      timing: {
        averageLatency: 5.2,
        maxLatency: 15.0,
        p95Latency: 12.0,
        p99Latency: 14.5,
      },
      conflicts: {
        total: 3,
        resolved: 3,
        unresolved: 0,
        averageResolutionTime: 2.5,
      },
      throughput: {
        operationsPerSecond: 50,
        bytesPerSecond: 1024 * 1024, // 1MB/s
        peakThroughput: 2048 * 1024, // 2MB/s
      },
    };
  }

  /**
   * Collect lazy loading performance metrics
   */
  private collectLazyLoadingMetrics(): LazyLoadingPerformanceMetrics {
    return {
      requests: {
        total: 200,
        completed: 195,
        pending: 3,
        failed: 2,
      },
      caching: {
        hitRate: 0.78,
        missRate: 0.22,
        evictions: 5,
        size: 150 * 1024 * 1024, // 150MB
      },
      loading: {
        averageTime: 250,
        p95Time: 500,
        p99Time: 1000,
        bandwidth: 5 * 1024 * 1024, // 5MB/s
      },
    };
  }

  /**
   * Collect system performance metrics
   */
  private collectSystemMetrics(): SystemPerformanceMetrics {
    return {
      cpu: {
        usage: 45,
        cores: 8,
        frequency: 3200,
        temperature: 65,
      },
      memory: {
        physical: { total: 16 * 1024 * 1024 * 1024, available: 8 * 1024 * 1024 * 1024 },
        virtual: { total: 32 * 1024 * 1024 * 1024, available: 20 * 1024 * 1024 * 1024 },
        swap: { total: 4 * 1024 * 1024 * 1024, used: 512 * 1024 * 1024 },
      },
      gpu: {
        usage: 60,
        memory: { total: 8 * 1024 * 1024 * 1024, used: 3 * 1024 * 1024 * 1024 },
        temperature: 70,
        driver: 'Unknown',
      },
      network: {
        latency: 25,
        bandwidth: { upload: 50 * 1024 * 1024, download: 100 * 1024 * 1024 },
        packetLoss: 0.1,
      },
      storage: {
        readSpeed: 500 * 1024 * 1024, // 500MB/s
        writeSpeed: 400 * 1024 * 1024, // 400MB/s
        availableSpace: 500 * 1024 * 1024 * 1024, // 500GB
        iops: 1000,
      },
    };
  }

  /**
   * Analyze performance snapshot for issues
   */
  private analyzePerformanceIssues(snapshot: PerformanceSnapshot): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    // Check FPS issues
    if (snapshot.metrics.rendering.frameRate.current < this.config.alertThresholds.fps.critical) {
      issues.push({
        id: `fps-critical-${Date.now()}`,
        severity: 'critical',
        category: 'rendering',
        title: 'Critical Frame Rate Drop',
        description: `Frame rate has dropped to ${snapshot.metrics.rendering.frameRate.current} FPS`,
        impact: 'Severe impact on user experience and medical diagnosis accuracy',
        detectedAt: snapshot.timestamp,
        affectedViewports: [],
        metrics: {
          current: snapshot.metrics.rendering.frameRate.current,
          threshold: this.config.alertThresholds.fps.critical,
          trend: 'degrading',
        },
        suggestions: ['Reduce quality settings', 'Free memory resources', 'Check GPU utilization'],
      });
    }

    // Check memory usage
    const memoryUsagePercent = (snapshot.metrics.memory.usage.used / snapshot.metrics.memory.usage.total) * 100;
    if (memoryUsagePercent > this.config.alertThresholds.memoryUsage.warning) {
      issues.push({
        id: `memory-high-${Date.now()}`,
        severity: memoryUsagePercent > this.config.alertThresholds.memoryUsage.critical ? 'critical' : 'high',
        category: 'memory',
        title: 'High Memory Usage',
        description: `Memory usage is at ${memoryUsagePercent.toFixed(1)}%`,
        impact: 'May cause system instability and performance degradation',
        detectedAt: snapshot.timestamp,
        affectedViewports: [],
        metrics: {
          current: memoryUsagePercent,
          threshold: this.config.alertThresholds.memoryUsage.warning,
          trend: 'stable',
        },
        suggestions: ['Trigger memory cleanup', 'Reduce texture quality', 'Clear unused caches'],
      });
    }

    return issues;
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(snapshot: PerformanceSnapshot): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];

    // Analyze rendering performance
    if (snapshot.metrics.rendering.frameRate.current < snapshot.metrics.rendering.frameRate.target) {
      recommendations.push({
        id: `optimize-rendering-${Date.now()}`,
        priority: 'high',
        category: 'optimization',
        title: 'Optimize Rendering Performance',
        description: 'Frame rate is below target, consider optimization strategies',
        expectedImprovement: 'Increase frame rate by 10-20%',
        implementationEffort: 'medium',
        steps: [
          'Enable adaptive quality adjustment',
          'Implement viewport culling',
          'Optimize shader compilation',
        ],
        relatedIssues: [],
      });
    }

    return recommendations;
  }

  /**
   * Generate performance report
   */
  generateReport(timeRange?: { start: number; end: number }): PerformanceReport {
    const now = Date.now();
    const range = timeRange || {
      start: now - this.config.reportGeneration.interval,
      end: now,
    };

    const relevantSnapshots = this.snapshots.filter(s =>
      s.timestamp >= range.start && s.timestamp <= range.end,
    );

    const report: PerformanceReport = {
      id: `report-${now}`,
      sessionId: this.sessionId,
      generatedAt: now,
      timeRange: {
        start: range.start,
        end: range.end,
        duration: range.end - range.start,
      },
      summary: {
        overallScore: this.calculateOverallScore(relevantSnapshots),
        status: 'good',
        criticalIssues: Array.from(this.issues.values()).filter(i => i.severity === 'critical').length,
        recommendations: relevantSnapshots.reduce((sum, s) => sum + s.recommendations.length, 0),
      },
      sections: [],
      trends: [],
      rawData: this.config.reportGeneration.includeRawData ? relevantSnapshots : [],
    };

    report.summary.status = this.determineOverallStatus(report.summary.overallScore);

    this.emit('report-generated', report);

    log.info('Performance report generated', {
      component: 'PerformanceMonitoringSystem',
      metadata: {
        reportId: report.id,
        timeRange: report.timeRange,
        overallScore: report.summary.overallScore,
      },
    });

    return report;
  }

  /**
   * Get memory information
   */
  private getMemoryInfo(): {
    usedJSHeapSize?: number;
    totalJSHeapSize?: number;
    jsHeapSizeLimit?: number;
    } {
    if ('memory' in performance) {
      return (performance as any).memory;
    }
    return {};
  }

  /**
   * Calculate overall performance score
   */
  private calculateOverallScore(snapshots: PerformanceSnapshot[]): number {
    if (snapshots.length === 0) return 100;

    // Simplified scoring algorithm
    let totalScore = 0;

    snapshots.forEach(snapshot => {
      let snapshotScore = 100;

      // Deduct points for issues
      snapshot.issues.forEach(issue => {
        switch (issue.severity) {
          case 'critical': snapshotScore -= 30; break;
          case 'high': snapshotScore -= 20; break;
          case 'medium': snapshotScore -= 10; break;
          case 'low': snapshotScore -= 5; break;
        }
      });

      totalScore += Math.max(0, snapshotScore);
    });

    return Math.round(totalScore / snapshots.length);
  }

  /**
   * Determine overall status from score
   */
  private determineOverallStatus(score: number): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'critical';
  }

  /**
   * Update status of existing issues
   */
  private updateIssueStatus(currentIssues: PerformanceIssue[]): void {
    const currentIssueIds = new Set(currentIssues.map(i => i.id));

    // Check for resolved issues
    for (const [issueId] of this.issues.entries()) {
      if (!currentIssueIds.has(issueId)) {
        this.issues.delete(issueId);
        this.emit('issue-resolved', issueId);
      }
    }
  }

  /**
   * Clean up old data beyond retention period
   */
  private cleanupOldData(): void {
    const now = Date.now();
    if (now - this.lastCleanup < 60000) return; // Only cleanup once per minute

    const cutoffTime = now - this.config.retentionPeriod;

    // Remove old snapshots
    let removed = 0;

    while (this.snapshots.length > 0 && this.snapshots[0].timestamp < cutoffTime) {
      this.snapshots.shift();
      removed++;
    }

    if (removed > 0) {
      log.info('Cleaned up old performance data', {
        component: 'PerformanceMonitoringSystem',
        metadata: { removed, remaining: this.snapshots.length },
      });
    }

    this.lastCleanup = now;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current performance statistics
   */
  getPerformanceStatistics(): {
    sessionId: string;
    isMonitoring: boolean;
    snapshotCount: number;
    activeIssues: number;
    lastSnapshot?: PerformanceSnapshot;
    } {
    return {
      sessionId: this.sessionId,
      isMonitoring: this.isMonitoring,
      snapshotCount: this.snapshots.length,
      activeIssues: this.issues.size,
      lastSnapshot: this.snapshots[this.snapshots.length - 1],
    };
  }

  /**
   * Cleanup and dispose resources
   */
  dispose(): void {
    this.stopMonitoring();
    this.snapshots.length = 0;
    this.issues.clear();
    this.removeAllListeners();

    log.info('PerformanceMonitoringSystem disposed', {
      component: 'PerformanceMonitoringSystem',
      metadata: { sessionId: this.sessionId },
    });
  }
}

// Export types and create singleton instance
export * from './types';

// Singleton instance
export const performanceMonitoringSystem = new PerformanceMonitoringSystem();
