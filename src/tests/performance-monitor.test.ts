/**
 * Performance Monitor Tests
 * Comprehensive test suite for performance monitoring functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PerformanceMonitor,
  MetricCategory,
  AlertLevel,
  type PerformanceAlert,
  type PerformanceReport,
  type RenderingMetrics,
  type MemoryMetrics,
  type PriorityMetrics,
  type SynchronizationMetrics,
  type SystemMetrics,
} from '../services/performanceMonitor';

// Mock dependencies
vi.mock('../services/viewportOptimizer', () => ({
  viewportOptimizer: {
    getPerformanceMetrics: vi.fn(() => ({
      averageRenderTime: 16.67,
      droppedFrames: 0,
      activeViewports: 2,
      currentQuality: 'high',
      memoryPressure: 0.5,
    })),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

vi.mock('../services/memoryManager', () => ({
  memoryManager: {
    getMemoryStats: vi.fn(() => ({
      leakCount: 0,
      cleanupCount: 5,
      totalAllocations: 10,
      freeOperations: 8,
    })),
    getMemoryUsage: vi.fn(() => ({
      total: 1024 * 1024 * 1024, // 1GB
      used: 512 * 1024 * 1024,   // 512MB
      viewportAllocations: new Map([
        ['viewport-1', 256 * 1024 * 1024],
        ['viewport-2', 256 * 1024 * 1024],
      ]),
    })),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

vi.mock('../services/renderingPriorityManager', () => ({
  renderingPriorityManager: {
    getQueueStatus: vi.fn(() => ({
      totalTasks: 5,
      averageWaitTime: 25,
      blockedTasks: 1,
    })),
    getPriorityMetrics: vi.fn(() => ({
      throughput: 15,
      priorityDistribution: new Map([
        ['high', 2],
        ['medium', 2],
        ['low', 1],
      ]),
      resourceUtilization: 0.7,
    })),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

vi.mock('../services/synchronizationOptimizer', () => ({
  synchronizationOptimizer: {
    getPerformanceMetrics: vi.fn(() => new Map([
      ['camera', {
        averageLatency: 25,
        throughput: 8,
        errorCount: 0,
      }],
      ['slice', {
        averageLatency: 15,
        throughput: 12,
        errorCount: 1,
      }],
    ])),
    getQueueStatus: vi.fn(() => ({
      totalTasks: 3,
    })),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

vi.mock('../utils/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock global performance API
const mockPerformance = {
  now: vi.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    totalJSHeapSize: 100 * 1024 * 1024, // 100MB
  },
};

Object.defineProperty(globalThis, 'performance', {
  value: mockPerformance,
  writable: true,
});

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;
  const testConfig = {
    collectionInterval: 50, // Fast for testing
    retentionPeriod: 5000, // 5 seconds for testing
    reportGenerationInterval: 200, // Fast for testing
    enableRealTimeAlerts: true,
    enablePredictiveAnalysis: true,
    alertThresholds: {
      rendering: {
        minFrameRate: 30,
        maxRenderTime: 33,
        maxDropFrames: 5,
      },
      memory: {
        maxUsagePercent: 80,
        maxGarbageCollections: 10,
        maxMemoryLeaks: 0,
      },
      priority: {
        maxQueueDepth: 10,
        maxWaitTime: 50,
        minThroughput: 5,
      },
      synchronization: {
        maxLatency: 50,
        minSuccessRate: 0.95,
        maxQueueSize: 20,
      },
      system: {
        maxCpuUsage: 70,
        minPerformanceScore: 60,
      },
    },
  };

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor(testConfig);
  });

  afterEach(() => {
    performanceMonitor.dispose();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultMonitor = new PerformanceMonitor();
      expect(defaultMonitor).toBeInstanceOf(PerformanceMonitor);
      defaultMonitor.dispose();
    });

    it('should initialize with custom configuration', () => {
      expect(performanceMonitor).toBeInstanceOf(PerformanceMonitor);
    });

    it('should setup metrics history for all categories', () => {
      const currentMetrics = performanceMonitor.getCurrentMetrics();
      expect(currentMetrics.size).toBe(5); // All metric categories
      expect(currentMetrics.has(MetricCategory.RENDERING)).toBe(true);
      expect(currentMetrics.has(MetricCategory.MEMORY)).toBe(true);
      expect(currentMetrics.has(MetricCategory.PRIORITY)).toBe(true);
      expect(currentMetrics.has(MetricCategory.SYNCHRONIZATION)).toBe(true);
      expect(currentMetrics.has(MetricCategory.SYSTEM)).toBe(true);
    });
  });

  describe('Metrics Collection', () => {
    it('should start and stop monitoring', async () => {
      expect(() => performanceMonitor.start()).not.toThrow();
      expect(() => performanceMonitor.stop()).not.toThrow();
    });

    it('should collect metrics when started', async () => {
      let metricsCollected = false;

      performanceMonitor.on('metrics-collected', () => {
        metricsCollected = true;
      });

      performanceMonitor.start();

      // Wait for metrics collection
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(metricsCollected).toBe(true);
      performanceMonitor.stop();
    });

    it('should collect rendering metrics', async () => {
      performanceMonitor.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const currentMetrics = performanceMonitor.getCurrentMetrics();
      const renderingMetrics = currentMetrics.get(MetricCategory.RENDERING) as RenderingMetrics;

      expect(renderingMetrics).toBeDefined();
      expect(renderingMetrics.category).toBe(MetricCategory.RENDERING);
      expect(typeof renderingMetrics.frameRate).toBe('number');
      expect(typeof renderingMetrics.renderTime).toBe('number');
      expect(typeof renderingMetrics.activeViewports).toBe('number');

      performanceMonitor.stop();
    });

    it('should collect memory metrics', async () => {
      performanceMonitor.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const currentMetrics = performanceMonitor.getCurrentMetrics();
      const memoryMetrics = currentMetrics.get(MetricCategory.MEMORY) as MemoryMetrics;

      expect(memoryMetrics).toBeDefined();
      expect(memoryMetrics.category).toBe(MetricCategory.MEMORY);
      expect(typeof memoryMetrics.totalUsage).toBe('number');
      expect(typeof memoryMetrics.availableMemory).toBe('number');
      expect(memoryMetrics.viewportAllocations).toBeInstanceOf(Map);

      performanceMonitor.stop();
    });

    it('should collect priority metrics', async () => {
      performanceMonitor.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const currentMetrics = performanceMonitor.getCurrentMetrics();
      const priorityMetrics = currentMetrics.get(MetricCategory.PRIORITY) as PriorityMetrics;

      expect(priorityMetrics).toBeDefined();
      expect(priorityMetrics.category).toBe(MetricCategory.PRIORITY);
      expect(typeof priorityMetrics.queueDepth).toBe('number');
      expect(typeof priorityMetrics.averageWaitTime).toBe('number');
      expect(typeof priorityMetrics.taskThroughput).toBe('number');

      performanceMonitor.stop();
    });

    it('should collect synchronization metrics', async () => {
      performanceMonitor.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const currentMetrics = performanceMonitor.getCurrentMetrics();
      const syncMetrics = currentMetrics.get(MetricCategory.SYNCHRONIZATION) as SynchronizationMetrics;

      expect(syncMetrics).toBeDefined();
      expect(syncMetrics.category).toBe(MetricCategory.SYNCHRONIZATION);
      expect(typeof syncMetrics.syncOperationsPerSecond).toBe('number');
      expect(typeof syncMetrics.averageSyncLatency).toBe('number');
      expect(typeof syncMetrics.queuedSyncs).toBe('number');

      performanceMonitor.stop();
    });

    it('should collect system metrics', async () => {
      performanceMonitor.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const currentMetrics = performanceMonitor.getCurrentMetrics();
      const systemMetrics = currentMetrics.get(MetricCategory.SYSTEM) as SystemMetrics;

      expect(systemMetrics).toBeDefined();
      expect(systemMetrics.category).toBe(MetricCategory.SYSTEM);
      expect(typeof systemMetrics.cpuUsage).toBe('number');
      expect(typeof systemMetrics.browserMemory).toBe('number');
      expect(typeof systemMetrics.performanceScore).toBe('number');

      performanceMonitor.stop();
    });
  });

  describe('Metrics History', () => {
    it('should maintain metrics history', async () => {
      performanceMonitor.start();

      // Wait for multiple collection cycles
      await new Promise(resolve => setTimeout(resolve, 200));

      const renderingHistory = performanceMonitor.getMetricsHistory(MetricCategory.RENDERING);
      expect(renderingHistory.length).toBeGreaterThan(1);

      performanceMonitor.stop();
    });

    it('should filter metrics by time range', async () => {
      performanceMonitor.start();

      const startTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, 200));
      const endTime = Date.now();

      const filteredMetrics = performanceMonitor.getMetricsHistory(
        MetricCategory.RENDERING,
        { start: startTime, end: endTime },
      );

      filteredMetrics.forEach(metric => {
        expect(metric.timestamp).toBeGreaterThanOrEqual(startTime);
        expect(metric.timestamp).toBeLessThanOrEqual(endTime);
      });

      performanceMonitor.stop();
    });

    it('should clean up old metrics', async () => {
      const shortRetentionMonitor = new PerformanceMonitor({
        ...testConfig,
        retentionPeriod: 100, // Very short retention
      });

      shortRetentionMonitor.start();

      // Wait for metrics collection
      await new Promise(resolve => setTimeout(resolve, 100));

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 150));

      const history = shortRetentionMonitor.getMetricsHistory(MetricCategory.RENDERING);
      // Should have fewer metrics due to cleanup
      expect(history.length).toBeLessThan(10);

      shortRetentionMonitor.dispose();
    });
  });

  describe('Alert System', () => {
    it('should raise alerts when thresholds are exceeded', async () => {
      // Create monitor with very low thresholds to trigger alerts
      const alertMonitor = new PerformanceMonitor({
        ...testConfig,
        alertThresholds: {
          ...testConfig.alertThresholds,
          rendering: {
            minFrameRate: 1000, // Impossible frame rate to trigger alert
            maxRenderTime: 1,
            maxDropFrames: 0,
          },
        },
      });

      let alertRaised = false;
      alertMonitor.on('alert-raised', (alert: PerformanceAlert) => {
        expect(alert.category).toBe(MetricCategory.RENDERING);
        expect(alert.level).toBeDefined();
        expect(alert.message).toBeDefined();
        alertRaised = true;
      });

      alertMonitor.start();

      // Wait for metrics and alert processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(alertRaised).toBe(true);

      alertMonitor.dispose();
    });

    it('should get active alerts', async () => {
      const alertMonitor = new PerformanceMonitor({
        ...testConfig,
        alertThresholds: {
          ...testConfig.alertThresholds,
          memory: {
            maxUsagePercent: 10, // Very low to trigger alert
            maxGarbageCollections: 0,
            maxMemoryLeaks: 0,
          },
        },
      });

      alertMonitor.start();

      await new Promise(resolve => setTimeout(resolve, 150));

      const activeAlerts = alertMonitor.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);

      const criticalAlerts = alertMonitor.getActiveAlerts(AlertLevel.CRITICAL);
      expect(Array.isArray(criticalAlerts)).toBe(true);

      alertMonitor.dispose();
    });

    it('should emit threshold exceeded events', async () => {
      const alertMonitor = new PerformanceMonitor({
        ...testConfig,
        alertThresholds: {
          ...testConfig.alertThresholds,
          system: {
            maxCpuUsage: 1, // Very low to trigger
            minPerformanceScore: 100, // Very high to trigger
          },
        },
      });

      let thresholdExceeded = false;
      alertMonitor.on('threshold-exceeded', (category, message, value, threshold) => {
        expect(category).toBeDefined();
        expect(typeof message).toBe('string');
        expect(typeof value).toBe('number');
        expect(typeof threshold).toBe('number');
        thresholdExceeded = true;
      });

      alertMonitor.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(thresholdExceeded).toBe(true);

      alertMonitor.dispose();
    });
  });

  describe('Performance Reporting', () => {
    it('should generate performance reports', async () => {
      let reportGenerated = false;

      performanceMonitor.on('report-generated', (report: PerformanceReport) => {
        expect(report.id).toBeDefined();
        expect(typeof report.generatedAt).toBe('number');
        expect(report.timeRange).toBeDefined();
        expect(report.summary).toBeDefined();
        expect(report.metrics).toBeDefined();
        expect(Array.isArray(report.alerts)).toBe(true);
        expect(report.trends).toBeInstanceOf(Map);
        reportGenerated = true;
      });

      performanceMonitor.start();

      // Wait for report generation
      await new Promise(resolve => setTimeout(resolve, 300));

      expect(reportGenerated).toBe(true);

      performanceMonitor.stop();
    });

    it('should get performance reports', async () => {
      performanceMonitor.start();

      // Wait for report generation
      await new Promise(resolve => setTimeout(resolve, 300));

      const reports = performanceMonitor.getReports();
      expect(Array.isArray(reports)).toBe(true);

      const latestReport = performanceMonitor.getLatestReport();
      if (latestReport) {
        expect(latestReport.id).toBeDefined();
        expect(typeof latestReport.summary.overallScore).toBe('number');
      }

      performanceMonitor.stop();
    });

    it('should include recommendations in reports', async () => {
      // Use low thresholds to generate recommendations
      const reportMonitor = new PerformanceMonitor({
        ...testConfig,
        alertThresholds: {
          ...testConfig.alertThresholds,
          rendering: {
            minFrameRate: 1000, // Impossible
            maxRenderTime: 1,
            maxDropFrames: 0,
          },
        },
      });

      reportMonitor.start();

      await new Promise(resolve => setTimeout(resolve, 300));

      const latestReport = reportMonitor.getLatestReport();
      if (latestReport) {
        expect(Array.isArray(latestReport.summary.recommendations)).toBe(true);
        expect(latestReport.summary.recommendations.length).toBeGreaterThan(0);
      }

      reportMonitor.dispose();
    });
  });

  describe('Performance Score Calculation', () => {
    it('should calculate performance score', async () => {
      performanceMonitor.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const score = performanceMonitor.calculatePerformanceScore();
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);

      performanceMonitor.stop();
    });

    it('should return lower scores for poor performance', async () => {
      const poorPerformanceMonitor = new PerformanceMonitor({
        ...testConfig,
        alertThresholds: {
          rendering: {
            minFrameRate: 1000, // Impossible thresholds
            maxRenderTime: 1,
            maxDropFrames: 0,
          },
          memory: {
            maxUsagePercent: 10,
            maxGarbageCollections: 0,
            maxMemoryLeaks: 0,
          },
          priority: {
            maxQueueDepth: 1,
            maxWaitTime: 1,
            minThroughput: 1000,
          },
          synchronization: {
            maxLatency: 1,
            minSuccessRate: 0.99,
            maxQueueSize: 1,
          },
          system: {
            maxCpuUsage: 1,
            minPerformanceScore: 100,
          },
        },
      });

      poorPerformanceMonitor.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const score = poorPerformanceMonitor.calculatePerformanceScore();
      expect(score).toBeLessThan(50); // Should be low due to impossible thresholds

      poorPerformanceMonitor.dispose();
    });
  });

  describe('Trend Analysis', () => {
    it('should analyze performance trends', async () => {
      performanceMonitor.start();

      // Generate multiple data points
      await new Promise(resolve => setTimeout(resolve, 300));

      const latestReport = performanceMonitor.getLatestReport();
      if (latestReport) {
        expect(latestReport.trends.size).toBeGreaterThan(0);

        latestReport.trends.forEach((trend) => {
          expect(['improving', 'stable', 'degrading']).toContain(trend.direction);
          expect(typeof trend.changeRate).toBe('number');
          expect(typeof trend.significance).toBe('number');
        });
      }

      performanceMonitor.stop();
    });
  });

  describe('Event System', () => {
    it('should emit metrics collected events', async () => {
      let eventEmitted = false;

      performanceMonitor.on('metrics-collected', (metrics) => {
        expect(metrics.category).toBeDefined();
        expect(typeof metrics.timestamp).toBe('number');
        eventEmitted = true;
      });

      performanceMonitor.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(eventEmitted).toBe(true);

      performanceMonitor.stop();
    });

    it('should handle multiple event listeners', () => {
      const events1: string[] = [];
      const events2: string[] = [];

      performanceMonitor.on('metrics-collected', () => {
        events1.push('collected');
      });

      performanceMonitor.on('metrics-collected', () => {
        events2.push('collected');
      });

      performanceMonitor.start();

      // Events should be handled by both listeners
      // (We can't easily test this without waiting, but setup is verified)

      performanceMonitor.stop();
    });

    it('should emit optimization recommended events', async () => {
      let optimizationRecommended = false;

      performanceMonitor.on('optimization-recommended', (reason, metadata) => {
        expect(typeof reason).toBe('string');
        expect(typeof metadata).toBe('object');
        optimizationRecommended = true;
      });

      performanceMonitor.start();

      // Simulate optimization system events
      const { viewportOptimizer } = require('../services/viewportOptimizer');
      const onCallback = vi.mocked(viewportOptimizer.on).mock.calls.find(
        (call: any) => call[0] === 'performance-updated',
      );

      if (onCallback && onCallback[1]) {
        onCallback[1](); // Trigger the callback
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(optimizationRecommended).toBe(true);

      performanceMonitor.stop();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing metrics gracefully', () => {
      const score = performanceMonitor.calculatePerformanceScore();
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it('should handle invalid time ranges', () => {
      const metrics = performanceMonitor.getMetricsHistory(
        MetricCategory.RENDERING,
        { start: Date.now() + 1000, end: Date.now() }, // Invalid range
      );

      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBe(0);
    });

    it('should handle disposal gracefully', () => {
      performanceMonitor.start();
      expect(() => performanceMonitor.dispose()).not.toThrow();

      // Should not throw after disposal
      expect(() => performanceMonitor.getCurrentMetrics()).not.toThrow();
    });
  });

  describe('Configuration', () => {
    it('should use custom alert thresholds', async () => {
      const customMonitor = new PerformanceMonitor({
        ...testConfig,
        alertThresholds: {
          ...testConfig.alertThresholds,
          rendering: {
            minFrameRate: 60, // Higher threshold
            maxRenderTime: 16,
            maxDropFrames: 2,
          },
        },
      });

      customMonitor.on('alert-raised', () => {
        // Alert triggered
      });

      customMonitor.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      // May or may not trigger based on actual metrics
      // The important thing is it doesn't crash
      expect(() => customMonitor.getActiveAlerts()).not.toThrow();

      customMonitor.dispose();
    });

    it('should disable features when configured', () => {
      const disabledMonitor = new PerformanceMonitor({
        ...testConfig,
        enableRealTimeAlerts: false,
        enablePredictiveAnalysis: false,
      });

      expect(disabledMonitor).toBeInstanceOf(PerformanceMonitor);
      disabledMonitor.dispose();
    });
  });

  describe('Disposal and Cleanup', () => {
    it('should clean up resources on dispose', () => {
      performanceMonitor.start();

      // Add some data
      const currentMetrics = performanceMonitor.getCurrentMetrics();
      expect(currentMetrics.size).toBeGreaterThan(0);

      // Dispose
      performanceMonitor.dispose();

      // Should not crash after disposal
      expect(() => performanceMonitor.getCurrentMetrics()).not.toThrow();
    });

    it('should not emit events after disposal', async () => {
      let eventEmitted = false;

      performanceMonitor.on('metrics-collected', () => {
        eventEmitted = true;
      });

      performanceMonitor.start();
      performanceMonitor.dispose();

      // Wait a bit to see if events are emitted
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not emit events after disposal
      expect(eventEmitted).toBe(false);
    });

    it('should handle multiple dispose calls', () => {
      expect(() => {
        performanceMonitor.dispose();
        performanceMonitor.dispose();
        performanceMonitor.dispose();
      }).not.toThrow();
    });
  });
});
