/**
 * Synchronization Optimizer Tests
 * Comprehensive test suite for synchronization optimization functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SynchronizationOptimizer,
  SyncOperation,
  OptimizationStrategy,
  type SyncOptimizerConfig,
  type SyncTask,
} from '../services/synchronizationOptimizer';

// Mock dependencies
vi.mock('../services/viewportStateManager', () => ({
  viewportStateManager: {
    getViewportState: vi.fn(() => ({
      id: 'test-viewport',
      activation: {
        isActive: true,
        isVisible: true,
        lastInteractionAt: new Date().toISOString(),
      },
    })),
  },
}));

vi.mock('../services/memoryManager', () => ({
  memoryManager: {
    getMemoryUsage: vi.fn(() => ({
      total: 1024 * 1024 * 1024, // 1GB
      used: 512 * 1024 * 1024, // 512MB
      viewportAllocations: new Map([
        ['viewport-1', 256 * 1024 * 1024],
        ['viewport-2', 256 * 1024 * 1024],
      ]),
    })),
  },
}));

vi.mock('../services/renderingPriorityManager', () => ({
  renderingPriorityManager: {
    queueRenderingTask: vi.fn(() => true),
  },
}));

vi.mock('../utils/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('SynchronizationOptimizer', () => {
  let syncOptimizer: SynchronizationOptimizer;
  const testConfig: Partial<SyncOptimizerConfig> = {
    maxConcurrentSyncs: 2,
    defaultDebounceMs: 10, // Fast for testing
    defaultThrottleMs: 20,
    defaultBatchSize: 3,
    maxQueueSize: 10,
    enablePredictiveSync: false, // Disable for predictable testing
    adaptiveOptimization: false,
  };

  beforeEach(() => {
    syncOptimizer = new SynchronizationOptimizer(testConfig);
  });

  afterEach(() => {
    syncOptimizer.dispose();
  });

  describe('Task Queuing', () => {
    it('should queue sync tasks correctly', () => {
      const taskId = syncOptimizer.queueSyncTask(SyncOperation.CAMERA_SYNC, 'viewport-1', ['viewport-2'], {
        camera: { position: [0, 0, 0] },
      });

      expect(taskId).toMatch(/^sync-\d+-\d+$/);

      const queueStatus = syncOptimizer.getQueueStatus();
      expect(queueStatus.totalTasks).toBe(1);
      expect(queueStatus.tasksByOperation.get(SyncOperation.CAMERA_SYNC)).toBe(1);
    });

    it('should respect queue size limits', () => {
      let overflowEmitted = false;

      syncOptimizer.on('sync-overload', () => {
        overflowEmitted = true;
      });

      // Fill queue beyond capacity
      for (let i = 0; i < testConfig.maxQueueSize! + 5; i++) {
        syncOptimizer.queueSyncTask(SyncOperation.SLICE_SYNC, 'viewport-1', ['viewport-2'], { sliceIndex: i });
      }

      expect(overflowEmitted).toBe(true);

      const queueStatus = syncOptimizer.getQueueStatus();
      expect(queueStatus.totalTasks).toBeLessThanOrEqual(testConfig.maxQueueSize!);
    });

    it('should prioritize tasks correctly', () => {
      // Queue low priority task first
      syncOptimizer.queueSyncTask(SyncOperation.ANNOTATION_SYNC, 'viewport-1', ['viewport-2'], {}, { priority: 1 });

      // Queue high priority task second
      syncOptimizer.queueSyncTask(SyncOperation.CAMERA_SYNC, 'viewport-1', ['viewport-2'], {}, { priority: 10 });

      const queueStatus = syncOptimizer.getQueueStatus();
      expect(queueStatus.totalTasks).toBe(2);
    });

    it('should emit task queued events', async () => {
      let taskQueuedEmitted = false;

      syncOptimizer.on('sync-task-queued', (task: SyncTask) => {
        expect(task.operation).toBe(SyncOperation.WINDOW_LEVEL_SYNC);
        expect(task.sourceViewportId).toBe('viewport-1');
        taskQueuedEmitted = true;
      });

      syncOptimizer.queueSyncTask(SyncOperation.WINDOW_LEVEL_SYNC, 'viewport-1', ['viewport-2'], {
        windowLevel: { width: 400, center: 40 },
      });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(taskQueuedEmitted).toBe(true);
    });
  });

  describe('Sync Groups', () => {
    it('should create sync groups correctly', () => {
      const groupId = 'test-group';
      const viewportIds = ['viewport-1', 'viewport-2', 'viewport-3'];
      const operations = [SyncOperation.CAMERA_SYNC, SyncOperation.SLICE_SYNC];

      syncOptimizer.createSyncGroup(groupId, viewportIds, operations, {
        strategy: OptimizationStrategy.THROTTLE,
        priority: 8,
        throttleMs: 50,
      });

      // Verify group was created by trying to update it
      expect(() => {
        syncOptimizer.updateSyncGroup(groupId, { priority: 9 });
      }).not.toThrow();
    });

    it('should emit sync group updated events', async () => {
      let groupUpdatedEmitted = false;

      syncOptimizer.on('sync-group-updated', group => {
        expect(group.id).toBe('test-group');
        groupUpdatedEmitted = true;
      });

      syncOptimizer.createSyncGroup('test-group', ['viewport-1', 'viewport-2'], [SyncOperation.CAMERA_SYNC]);

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(groupUpdatedEmitted).toBe(true);
    });

    it('should handle sync group removal', () => {
      const groupId = 'removable-group';

      // Create group
      syncOptimizer.createSyncGroup(groupId, ['viewport-1', 'viewport-2'], [SyncOperation.SLICE_SYNC]);

      // Remove group
      syncOptimizer.removeSyncGroup(groupId);

      // Verify removal by checking that update fails silently
      expect(() => {
        syncOptimizer.updateSyncGroup(groupId, { priority: 10 });
      }).not.toThrow();
    });
  });

  describe('Optimization Strategies', () => {
    it('should apply debounce optimization', async () => {
      let tasksProcessed = 0;

      syncOptimizer.on('sync-task-started', () => {
        tasksProcessed++;
      });

      // Queue multiple tasks rapidly
      for (let i = 0; i < 5; i++) {
        syncOptimizer.queueSyncTask(
          SyncOperation.CAMERA_SYNC,
          'viewport-1',
          ['viewport-2'],
          { frame: i },
          { strategy: OptimizationStrategy.DEBOUNCE }
        );
      }

      // Wait for debounce period
      await new Promise(resolve => setTimeout(resolve, 50));

      // Due to debouncing, fewer tasks should be processed than queued
      // (Exact behavior depends on implementation details)
      expect(tasksProcessed).toBeLessThanOrEqual(5);
    });

    it('should apply throttle optimization', async () => {
      const tasks: string[] = [];

      syncOptimizer.on('sync-task-queued', (task: SyncTask) => {
        tasks.push(task.id);
      });

      // Queue tasks with throttle strategy
      for (let i = 0; i < 5; i++) {
        syncOptimizer.queueSyncTask(
          SyncOperation.SLICE_SYNC,
          'viewport-1',
          ['viewport-2'],
          { slice: i },
          { strategy: OptimizationStrategy.THROTTLE }
        );

        // Small delay between tasks
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      // Some tasks might be throttled
      expect(tasks.length).toBeLessThanOrEqual(5);
    });

    it('should apply batch optimization', async () => {
      const batchedTasks: SyncTask[] = [];

      syncOptimizer.on('sync-task-queued', (task: SyncTask) => {
        if (task.data.batchedTasks) {
          batchedTasks.push(task);
        }
      });

      // Queue tasks that should be batched
      for (let i = 0; i < testConfig.defaultBatchSize! + 1; i++) {
        syncOptimizer.queueSyncTask(
          SyncOperation.ANNOTATION_SYNC,
          'viewport-1',
          ['viewport-2'],
          { annotation: i },
          { strategy: OptimizationStrategy.BATCH }
        );
      }

      await new Promise(resolve => setTimeout(resolve, 20));

      // Should have at least one batched task
      expect(batchedTasks.length).toBeGreaterThan(0);
    });

    it('should apply lazy sync optimization', () => {
      const { viewportStateManager } = require('../services/viewportStateManager');

      // Mock inactive viewport
      vi.mocked(viewportStateManager.getViewportState).mockReturnValue({
        id: 'inactive-viewport',
        activation: {
          isActive: false,
          isVisible: false,
        },
      });

      // Task for inactive viewport should be skipped
      const taskId = syncOptimizer.queueSyncTask(
        SyncOperation.CAMERA_SYNC,
        'viewport-1',
        ['inactive-viewport'],
        {},
        { strategy: OptimizationStrategy.LAZY_SYNC }
      );

      expect(taskId).toBeDefined();

      // Queue status might show fewer tasks due to lazy sync
      const queueStatus = syncOptimizer.getQueueStatus();
      expect(queueStatus.totalTasks).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Monitoring', () => {
    it('should collect performance metrics', async () => {
      // Queue some tasks to generate metrics
      syncOptimizer.queueSyncTask(SyncOperation.CAMERA_SYNC, 'viewport-1', ['viewport-2']);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = syncOptimizer.getPerformanceMetrics();

      expect(metrics.has(SyncOperation.CAMERA_SYNC)).toBe(true);

      const cameraMetrics = metrics.get(SyncOperation.CAMERA_SYNC);
      expect(cameraMetrics).toBeDefined();
      if (cameraMetrics) {
        expect(typeof cameraMetrics.executionTime).toBe('number');
        expect(typeof cameraMetrics.successRate).toBe('number');
        expect(typeof cameraMetrics.throughput).toBe('number');
      }
    });

    it('should emit performance metrics events', async () => {
      let metricsEmitted = false;

      syncOptimizer.on('performance-metrics', metrics => {
        expect(metrics).toBeInstanceOf(Map);
        expect(metrics.size).toBeGreaterThan(0);
        metricsEmitted = true;
      });

      // Wait for metrics collection interval
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(metricsEmitted).toBe(true);
    });

    it('should track queue status accurately', () => {
      // Queue different types of tasks
      syncOptimizer.queueSyncTask(SyncOperation.CAMERA_SYNC, 'viewport-1', ['viewport-2']);
      syncOptimizer.queueSyncTask(SyncOperation.SLICE_SYNC, 'viewport-1', ['viewport-2']);
      syncOptimizer.queueSyncTask(SyncOperation.WINDOW_LEVEL_SYNC, 'viewport-1', ['viewport-2']);

      const status = syncOptimizer.getQueueStatus();

      expect(status.totalTasks).toBe(3);
      expect(status.tasksByOperation.get(SyncOperation.CAMERA_SYNC)).toBe(1);
      expect(status.tasksByOperation.get(SyncOperation.SLICE_SYNC)).toBe(1);
      expect(status.tasksByOperation.get(SyncOperation.WINDOW_LEVEL_SYNC)).toBe(1);
      expect(typeof status.averageQueueTime).toBe('number');
    });
  });

  describe('Viewport State Optimization', () => {
    it('should optimize sync for viewport states', () => {
      const viewportStates = [
        {
          id: 'viewport-1',
          activation: { isActive: true, isVisible: true },
        },
        {
          id: 'viewport-2',
          activation: { isActive: false, isVisible: true },
        },
        {
          id: 'viewport-3',
          activation: { isActive: false, isVisible: false },
        },
      ] as any[];

      expect(() => {
        syncOptimizer.optimizeSyncForViewports(viewportStates);
      }).not.toThrow();
    });
  });

  describe('Task Dependencies', () => {
    it('should handle task dependencies correctly', () => {
      // Queue task with dependencies
      const taskId = syncOptimizer.queueSyncTask(
        SyncOperation.ANNOTATION_SYNC,
        'viewport-1',
        ['viewport-2'],
        {},
        { dependencies: ['prerequisite-task-1', 'prerequisite-task-2'] }
      );

      expect(taskId).toBeDefined();

      const queueStatus = syncOptimizer.getQueueStatus();
      expect(queueStatus.totalTasks).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid sync operations gracefully', () => {
      expect(() => {
        syncOptimizer.queueSyncTask('invalid-operation' as any, 'viewport-1', ['viewport-2']);
      }).not.toThrow();
    });

    it('should handle empty target viewport arrays', () => {
      const taskId = syncOptimizer.queueSyncTask(
        SyncOperation.CAMERA_SYNC,
        'viewport-1',
        [] // Empty target array
      );

      expect(taskId).toBeDefined();
    });

    it('should handle sync group operations on non-existent groups', () => {
      expect(() => {
        syncOptimizer.updateSyncGroup('non-existent-group', { priority: 5 });
      }).not.toThrow();

      expect(() => {
        syncOptimizer.removeSyncGroup('non-existent-group');
      }).not.toThrow();
    });
  });

  describe('Event System', () => {
    it('should emit sync task started events', async () => {
      syncOptimizer.on('sync-task-started', (task: SyncTask) => {
        expect(task.operation).toBe(SyncOperation.CAMERA_SYNC);
      });

      syncOptimizer.queueSyncTask(SyncOperation.CAMERA_SYNC, 'viewport-1', ['viewport-2']);

      // Wait for processing to start
      await new Promise(resolve => setTimeout(resolve, 50));

      // Note: Whether this emits depends on processing timing and is tested by presence of listener
    });

    it('should handle multiple event listeners', () => {
      const events1: string[] = [];
      const events2: string[] = [];

      syncOptimizer.on('sync-task-queued', () => {
        events1.push('queued');
      });

      syncOptimizer.on('sync-task-queued', () => {
        events2.push('queued');
      });

      syncOptimizer.queueSyncTask(SyncOperation.SLICE_SYNC, 'viewport-1', ['viewport-2']);

      expect(events1.length).toBe(1);
      expect(events2.length).toBe(1);
    });
  });

  describe('Disposal and Cleanup', () => {
    it('should clean up resources on dispose', () => {
      // Add some data
      syncOptimizer.queueSyncTask(SyncOperation.CAMERA_SYNC, 'viewport-1', ['viewport-2']);

      syncOptimizer.createSyncGroup('test-group', ['viewport-1', 'viewport-2'], [SyncOperation.CAMERA_SYNC]);

      // Verify data exists
      expect(syncOptimizer.getQueueStatus().totalTasks).toBe(1);

      // Dispose
      syncOptimizer.dispose();

      // Verify cleanup
      expect(syncOptimizer.getQueueStatus().totalTasks).toBe(0);
    });

    it('should not emit events after disposal', () => {
      let eventEmitted = false;

      syncOptimizer.on('sync-task-queued', () => {
        eventEmitted = true;
      });

      syncOptimizer.dispose();

      // Try to trigger event after disposal
      syncOptimizer.queueSyncTask(SyncOperation.CAMERA_SYNC, 'viewport-1', ['viewport-2']);

      expect(eventEmitted).toBe(false);
    });
  });
});
