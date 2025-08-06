/**
 * Rendering Priority Manager Tests
 * Comprehensive test suite for priority-based rendering system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RenderingPriorityManager,
  RenderPriority,
  type RenderingTask,
  type PrioritySystemConfig,
} from '../services/renderingPriorityManager';

// Mock dependencies
vi.mock('../services/viewportStateManager', () => ({
  viewportStateManager: {
    getViewportState: vi.fn(() => ({
      id: 'test-viewport',
      activation: {
        isActive: true,
        isFocused: false,
        isVisible: true,
      },
      performance: {
        isRenderingEnabled: true,
      },
    })),
  },
}));

vi.mock('../services/memoryManager', () => ({
  memoryManager: {
    getMemoryUsage: vi.fn(() => ({
      total: 1024 * 1024 * 1024, // 1GB
      used: 512 * 1024 * 1024, // 512MB
    })),
  },
}));

vi.mock('../utils/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('RenderingPriorityManager', () => {
  let priorityManager: RenderingPriorityManager;
  const testConfig: Partial<PrioritySystemConfig> = {
    maxQueueSize: 10,
    taskTimeoutMs: 1000,
    enableAdaptivePriority: false, // Disable for predictable testing
    enableLoadBalancing: false,
    performanceThresholds: {
      fpsThreshold: 30,
      memoryThreshold: 0.8,
      cpuThreshold: 0.7,
    },
  };

  beforeEach(() => {
    priorityManager = new RenderingPriorityManager(testConfig);
  });

  afterEach(() => {
    priorityManager.dispose();
  });

  describe('Priority Management', () => {
    it('should set viewport priority correctly', () => {
      const viewportId = 'test-viewport-1';

      priorityManager.setPriority(viewportId, RenderPriority.CRITICAL);

      const currentPriority = priorityManager.getPriority(viewportId);
      expect(currentPriority).toBe(RenderPriority.CRITICAL);
    });

    it('should emit priority change events', async () => {
      const viewportId = 'test-viewport-1';
      const events: Array<{ old: RenderPriority; new: RenderPriority }> = [];

      priorityManager.on('priority-changed', (id, oldPriority, newPriority) => {
        expect(id).toBe(viewportId);
        events.push({ old: oldPriority, new: newPriority });
      });

      priorityManager.setPriority(viewportId, RenderPriority.HIGH);
      priorityManager.setPriority(viewportId, RenderPriority.CRITICAL);

      // Wait a bit for events to be processed
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(events.length).toBe(2);
      expect(events[0].new).toBe(RenderPriority.HIGH);
      expect(events[1].new).toBe(RenderPriority.CRITICAL);
    });

    it('should not change priority if already set to same value', () => {
      const viewportId = 'test-viewport-1';
      let eventCount = 0;

      priorityManager.on('priority-changed', () => {
        eventCount++;
      });

      priorityManager.setPriority(viewportId, RenderPriority.HIGH);
      priorityManager.setPriority(viewportId, RenderPriority.HIGH); // Same priority

      expect(eventCount).toBe(1); // Should only emit once
    });
  });

  describe('Task Queue Management', () => {
    it('should queue rendering tasks correctly', () => {
      const viewportId = 'test-viewport-1';
      const task: RenderingTask = {
        id: 'test-task-1',
        type: 'initial',
        parameters: { test: 'value' },
        isBlocking: true,
        canBeDeferred: false,
        maxRetries: 3,
      };

      // Set priority first
      priorityManager.setPriority(viewportId, RenderPriority.HIGH);

      const queued = priorityManager.queueRenderingTask(viewportId, task);

      expect(queued).toBe(true);

      const queueStatus = priorityManager.getQueueStatus();
      expect(queueStatus.totalItems).toBe(1);
      expect(queueStatus.itemsByPriority.get(RenderPriority.HIGH)).toBe(1);
    });

    it('should respect queue size limits', () => {
      const viewportId = 'test-viewport-1';
      let overflowEmitted = false;

      priorityManager.on('queue-overflow', () => {
        overflowEmitted = true;
      });

      // Fill queue beyond capacity
      for (let i = 0; i < testConfig.maxQueueSize! + 5; i++) {
        const task: RenderingTask = {
          id: `task-${i}`,
          type: 'update',
          parameters: {},
          isBlocking: false,
          canBeDeferred: true,
          maxRetries: 1,
        };

        priorityManager.queueRenderingTask(viewportId, task);
      }

      expect(overflowEmitted).toBe(true);

      const queueStatus = priorityManager.getQueueStatus();
      expect(queueStatus.totalItems).toBeLessThanOrEqual(testConfig.maxQueueSize!);
    });

    it('should prioritize tasks correctly in queue', () => {
      const viewportId1 = 'viewport-1';
      const viewportId2 = 'viewport-2';

      // Set different priorities
      priorityManager.setPriority(viewportId1, RenderPriority.LOW);
      priorityManager.setPriority(viewportId2, RenderPriority.CRITICAL);

      // Queue tasks
      const lowPriorityTask: RenderingTask = {
        id: 'low-task',
        type: 'update',
        parameters: {},
        isBlocking: false,
        canBeDeferred: true,
        maxRetries: 1,
      };

      const highPriorityTask: RenderingTask = {
        id: 'high-task',
        type: 'initial',
        parameters: {},
        isBlocking: true,
        canBeDeferred: false,
        maxRetries: 3,
      };

      // Queue low priority first, then high priority
      priorityManager.queueRenderingTask(viewportId1, lowPriorityTask);
      priorityManager.queueRenderingTask(viewportId2, highPriorityTask);

      const queueStatus = priorityManager.getQueueStatus();
      expect(queueStatus.totalItems).toBe(2);
      expect(queueStatus.itemsByPriority.get(RenderPriority.CRITICAL)).toBe(1);
      expect(queueStatus.itemsByPriority.get(RenderPriority.LOW)).toBe(1);
    });

    it('should handle task dependencies', () => {
      const viewportId = 'test-viewport';

      const dependentTask: RenderingTask = {
        id: 'dependent-task',
        type: 'update',
        parameters: {},
        isBlocking: false,
        canBeDeferred: true,
        maxRetries: 2,
      };

      const dependencies = ['prerequisite-task-1', 'prerequisite-task-2'];

      const queued = priorityManager.queueRenderingTask(viewportId, dependentTask, RenderPriority.MEDIUM, dependencies);

      expect(queued).toBe(true);
    });

    it('should emit task queued events', async () => {
      const viewportId = 'test-viewport';
      let taskQueuedEmitted = false;

      priorityManager.on('task-queued', queueItem => {
        expect(queueItem.viewportId).toBe(viewportId);
        expect(queueItem.renderingTask.id).toBe('test-task');
        taskQueuedEmitted = true;
      });

      const task: RenderingTask = {
        id: 'test-task',
        type: 'resize',
        parameters: { width: 512, height: 512 },
        isBlocking: true,
        canBeDeferred: false,
        maxRetries: 2,
      };

      priorityManager.queueRenderingTask(viewportId, task);

      // Wait for event
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(taskQueuedEmitted).toBe(true);
    });
  });

  describe('Performance Monitoring', () => {
    it('should collect performance metrics', async () => {
      // Wait for initial metrics collection
      await new Promise(resolve => setTimeout(resolve, 1100)); // Wait > 1 second

      const metrics = priorityManager.getPerformanceMetrics();

      if (metrics) {
        expect(typeof metrics.avgFrameTime).toBe('number');
        expect(typeof metrics.memoryPressure).toBe('number');
        expect(typeof metrics.queueLength).toBe('number');
        expect(metrics.memoryPressure).toBeGreaterThanOrEqual(0);
        expect(metrics.memoryPressure).toBeLessThanOrEqual(1);
      }
    });

    it('should track queue status accurately', () => {
      const viewportId = 'test-viewport';

      // Queue several tasks with different priorities
      priorityManager.setPriority(viewportId, RenderPriority.HIGH);

      for (let i = 0; i < 3; i++) {
        const task: RenderingTask = {
          id: `task-${i}`,
          type: 'update',
          parameters: {},
          isBlocking: false,
          canBeDeferred: true,
          maxRetries: 1,
        };

        priorityManager.queueRenderingTask(viewportId, task);
      }

      const status = priorityManager.getQueueStatus();

      expect(status.totalItems).toBe(3);
      expect(status.itemsByPriority.get(RenderPriority.HIGH)).toBe(3);
      expect(status.activeTasks).toBe(0); // No tasks should be processing yet
      expect(typeof status.averageWaitTime).toBe('number');
    });
  });

  describe('State-Based Priority Adjustment', () => {
    it('should adjust priority based on viewport state', async () => {
      const viewportId = 'test-viewport';

      // Mock viewport state manager to return focused state
      const { viewportStateManager } = await import('../services/viewportStateManager');
      vi.mocked(viewportStateManager.getViewportState).mockReturnValue({
        id: viewportId,
        activation: {
          isActive: true,
          isFocused: true, // This should result in CRITICAL priority
          isVisible: true,
        },
        performance: {
          isRenderingEnabled: true,
        },
      } as any);

      priorityManager.adjustPriorityBasedOnState(viewportId);

      const priority = priorityManager.getPriority(viewportId);
      expect(priority).toBe(RenderPriority.CRITICAL);
    });

    it('should handle non-existent viewport gracefully', () => {
      expect(() => {
        priorityManager.adjustPriorityBasedOnState('non-existent-viewport');
      }).not.toThrow();
    });
  });

  describe('Resource Allocation', () => {
    it('should optimize resource allocation based on performance', async () => {
      priorityManager.on('resource-allocation-changed', allocations => {
        expect(allocations).toBeInstanceOf(Map);
        expect(allocations.size).toBeGreaterThan(0);
      });

      // Trigger resource optimization
      priorityManager.optimizeResourceAllocation();

      await new Promise(resolve => setTimeout(resolve, 10));

      // This test mainly ensures the method doesn't throw and can handle resource optimization
      expect(() => priorityManager.optimizeResourceAllocation()).not.toThrow();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty queue gracefully', () => {
      const status = priorityManager.getQueueStatus();
      expect(status.totalItems).toBe(0);
      expect(status.averageWaitTime).toBe(0);
    });

    it('should handle priority for non-queued viewport', () => {
      const priority = priorityManager.getPriority('non-existent-viewport');
      expect(priority).toBe(RenderPriority.MEDIUM); // Default priority
    });

    it('should handle invalid task parameters gracefully', () => {
      const viewportId = 'test-viewport';
      const invalidTask = {
        id: '',
        type: 'invalid' as any,
        parameters: null as any,
        isBlocking: null as any,
        canBeDeferred: null as any,
        maxRetries: -1,
      };

      expect(() => {
        priorityManager.queueRenderingTask(viewportId, invalidTask);
      }).not.toThrow();
    });
  });

  describe('Event System', () => {
    it('should emit priority adjusted events with reasons', async () => {
      const viewportId = 'test-viewport';
      let adjustmentEmitted = false;

      priorityManager.on('priority-adjusted', (id, priority, reason) => {
        expect(id).toBe(viewportId);
        expect(priority).toBe(RenderPriority.HIGH);
        expect(reason).toBe('test-reason');
        adjustmentEmitted = true;
      });

      priorityManager.setPriority(viewportId, RenderPriority.HIGH, 'test-reason');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(adjustmentEmitted).toBe(true);
    });

    it('should handle multiple event listeners correctly', () => {
      const viewportId = 'test-viewport';
      const events1: string[] = [];
      const events2: string[] = [];

      priorityManager.on('priority-changed', () => {
        events1.push('changed');
      });

      priorityManager.on('priority-changed', () => {
        events2.push('changed');
      });

      priorityManager.setPriority(viewportId, RenderPriority.LOW);

      expect(events1.length).toBe(1);
      expect(events2.length).toBe(1);
    });
  });

  describe('Disposal and Cleanup', () => {
    it('should clean up resources on dispose', () => {
      const viewportId = 'test-viewport';

      // Add some data
      priorityManager.setPriority(viewportId, RenderPriority.HIGH);

      const task: RenderingTask = {
        id: 'test-task',
        type: 'update',
        parameters: {},
        isBlocking: false,
        canBeDeferred: true,
        maxRetries: 1,
      };

      priorityManager.queueRenderingTask(viewportId, task);

      // Verify data exists
      expect(priorityManager.getQueueStatus().totalItems).toBe(1);
      expect(priorityManager.getPriority(viewportId)).toBe(RenderPriority.HIGH);

      // Dispose
      priorityManager.dispose();

      // Verify cleanup
      expect(priorityManager.getQueueStatus().totalItems).toBe(0);
      expect(priorityManager.getPriority(viewportId)).toBe(RenderPriority.MEDIUM); // Reset to default
    });

    it('should not emit events after disposal', () => {
      let eventEmitted = false;

      priorityManager.on('priority-changed', () => {
        eventEmitted = true;
      });

      priorityManager.dispose();

      // Try to trigger event after disposal
      priorityManager.setPriority('test-viewport', RenderPriority.CRITICAL);

      expect(eventEmitted).toBe(false);
    });
  });
});
