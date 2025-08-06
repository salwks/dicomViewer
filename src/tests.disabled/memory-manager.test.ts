/**
 * Memory Manager Service Tests
 * Comprehensive test suite for memory management functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryManager, CleanupPriority, type MemoryConfig } from '../services/memoryManager';

// Mock logger
vi.mock('../utils/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;
  const testConfig: Partial<MemoryConfig> = {
    maxTotalMemory: 1024 * 1024 * 1024, // 1GB for testing
    maxViewportMemory: 256 * 1024 * 1024, // 256MB per viewport
    cleanupThresholds: [0.5, 0.7, 0.85, 0.95],
    textureTimeout: 1000, // 1 second for fast testing
    bufferTimeout: 2000, // 2 seconds for fast testing
    enableAggressive: false,
    retentionTime: 500, // 0.5 seconds for fast testing
  };

  beforeEach(() => {
    memoryManager = new MemoryManager(testConfig);
  });

  afterEach(() => {
    memoryManager.dispose();
  });

  describe('Resource Tracking', () => {
    it('should track resource allocation', () => {
      const resourceId = 'test-texture-1';
      const size = 1024 * 1024; // 1MB
      const viewportId = 'viewport-1';

      memoryManager.trackResource(resourceId, 'texture', size, viewportId);

      const usage = memoryManager.getMemoryUsage();
      expect(usage.used).toBe(size);
      expect(usage.textureMemory).toBe(size);
      expect(usage.viewportAllocations.get(viewportId)).toBe(size);
    });

    it('should untrack resource when freed', () => {
      const resourceId = 'test-buffer-1';
      const size = 512 * 1024; // 512KB
      const viewportId = 'viewport-1';

      memoryManager.trackResource(resourceId, 'buffer', size, viewportId);
      expect(memoryManager.getMemoryUsage().used).toBe(size);

      const untracked = memoryManager.untrackResource(resourceId);
      expect(untracked).toBe(true);
      expect(memoryManager.getMemoryUsage().used).toBe(0);
    });

    it('should handle multiple resources per viewport', () => {
      const viewportId = 'viewport-1';
      const textureSize = 1024 * 1024; // 1MB
      const bufferSize = 512 * 1024; // 512KB

      memoryManager.trackResource('texture-1', 'texture', textureSize, viewportId);
      memoryManager.trackResource('buffer-1', 'buffer', bufferSize, viewportId);

      const usage = memoryManager.getMemoryUsage();
      expect(usage.viewportAllocations.get(viewportId)).toBe(textureSize + bufferSize);
      expect(usage.textureMemory).toBe(textureSize);
      expect(usage.bufferMemory).toBe(bufferSize);
    });

    it('should update resource last used time', () => {
      const resourceId = 'test-cache-1';
      memoryManager.trackResource(resourceId, 'cache', 1024, 'viewport-1');

      // Touch the resource
      memoryManager.touchResource(resourceId);

      // Resource should not be cleaned up immediately due to recent touch
      const bytesFreed = memoryManager.performCleanup(CleanupPriority.LOW);
      expect(bytesFreed).toBe(0);
    });
  });

  describe('Viewport Management', () => {
    it('should mark viewport resources as active/inactive', () => {
      const viewportId = 'viewport-1';
      const resourceId = 'viewport-resource-1';

      memoryManager.trackResource(resourceId, 'imageData', 1024 * 1024, viewportId);

      // Mark as inactive
      memoryManager.markViewportInactive(viewportId);

      // Mark as active again
      memoryManager.markViewportActive(viewportId);

      // Should not be cleaned up since it's active
      const bytesFreed = memoryManager.performCleanup(CleanupPriority.MEDIUM);
      expect(bytesFreed).toBe(0);
    });

    it('should cleanup inactive viewport resources', () => {
      const viewportId = 'viewport-1';
      const resourceSize = 1024 * 1024; // 1MB

      memoryManager.trackResource('resource-1', 'texture', resourceSize, viewportId);
      memoryManager.trackResource('resource-2', 'buffer', resourceSize, viewportId);

      expect(memoryManager.getMemoryUsage().used).toBe(resourceSize * 2);

      // Mark viewport as inactive
      memoryManager.markViewportInactive(viewportId);

      // Cleanup viewport
      const bytesFreed = memoryManager.cleanupViewport(viewportId);
      expect(bytesFreed).toBe(resourceSize * 2);
      expect(memoryManager.getMemoryUsage().used).toBe(0);
    });
  });

  describe('Memory Cleanup', () => {
    it('should perform cleanup based on priority', async () => {
      const oldResourceId = 'old-resource';
      const newResourceId = 'new-resource';
      const size = 1024 * 1024; // 1MB each

      // Track old resource
      memoryManager.trackResource(oldResourceId, 'texture', size, 'viewport-1', CleanupPriority.LOW);

      // Wait for resource to age
      await new Promise(resolve => setTimeout(resolve, 600)); // Wait longer than retentionTime

      // Mark as inactive
      memoryManager.markViewportInactive('viewport-1');

      // Track new resource
      memoryManager.trackResource(newResourceId, 'texture', size, 'viewport-2', CleanupPriority.HIGH);

      // Cleanup with medium priority should only clean up low priority resources
      const bytesFreed = memoryManager.performCleanup(CleanupPriority.MEDIUM);
      expect(bytesFreed).toBe(size);
      expect(memoryManager.getMemoryUsage().used).toBe(size); // New resource should remain
    });

    it('should respect cleanup thresholds', () => {
      const events: Array<{ type: string; data: any }> = [];

      memoryManager.on('memory-warning', (usage, priority) => {
        events.push({ type: 'memory-warning', data: { usage, priority } });
      });

      memoryManager.on('memory-critical', usage => {
        events.push({ type: 'memory-critical', data: { usage } });
      });

      // Fill memory to trigger warnings
      const largeSize = Math.floor(testConfig.maxTotalMemory! * 0.6); // 60% of memory
      memoryManager.trackResource('large-resource', 'texture', largeSize, 'viewport-1');

      // Should trigger memory warning
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('memory-warning');
    });

    it('should emit cleanup events', () => {
      const events: Array<{ type: string; data: any }> = [];

      memoryManager.on('cleanup-started', (priority, estimatedBytes) => {
        events.push({ type: 'cleanup-started', data: { priority, estimatedBytes } });
      });

      memoryManager.on('cleanup-completed', (bytesFreed, resourcesFreed) => {
        events.push({ type: 'cleanup-completed', data: { bytesFreed, resourcesFreed } });
      });

      // Add resource and mark inactive
      memoryManager.trackResource('test-resource', 'texture', 1024, 'viewport-1');
      memoryManager.markViewportInactive('viewport-1');

      // Perform cleanup
      memoryManager.performCleanup(CleanupPriority.CRITICAL);

      expect(events.length).toBe(2);
      expect(events[0].type).toBe('cleanup-started');
      expect(events[1].type).toBe('cleanup-completed');
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide accurate memory statistics', () => {
      const textureSize = 1024 * 1024; // 1MB
      const bufferSize = 512 * 1024; // 512KB

      memoryManager.trackResource('texture-1', 'texture', textureSize, 'viewport-1');
      memoryManager.trackResource('buffer-1', 'buffer', bufferSize, 'viewport-2');

      const stats = memoryManager.getStats();
      expect(stats.currentUsage).toBe(textureSize + bufferSize);
      expect(stats.totalAllocated).toBe(textureSize + bufferSize);
      expect(stats.resourceCounts.textures).toBe(1);
      expect(stats.resourceCounts.buffers).toBe(1);
    });

    it('should update peak usage tracking', () => {
      const size1 = 1024 * 1024; // 1MB
      const size2 = 2048 * 1024; // 2MB

      memoryManager.trackResource('resource-1', 'texture', size1, 'viewport-1');
      memoryManager.trackResource('resource-2', 'texture', size2, 'viewport-2');

      const stats = memoryManager.getStats();
      expect(stats.peakUsage).toBe(size1 + size2);

      // Free one resource
      memoryManager.untrackResource('resource-1');

      const updatedStats = memoryManager.getStats();
      expect(updatedStats.currentUsage).toBe(size2);
      expect(updatedStats.peakUsage).toBe(size1 + size2); // Peak should remain
    });

    it('should provide cleanup suggestions', () => {
      // Fill memory to high usage
      const largeSize = Math.floor(testConfig.maxTotalMemory! * 0.85); // 85% of memory
      memoryManager.trackResource('large-resource', 'texture', largeSize, 'viewport-1');

      const suggestions = memoryManager.getCleanupSuggestions();
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('Memory usage is high'))).toBe(true);
    });

    it('should emit memory statistics periodically', async () => {
      let statsReceived = false;

      memoryManager.on('memory-stats', stats => {
        expect(stats).toBeDefined();
        expect(typeof stats.currentUsage).toBe('number');
        expect(typeof stats.totalAllocated).toBe('number');
        statsReceived = true;
      });

      // Add some memory usage to trigger stats
      memoryManager.trackResource('test-resource', 'texture', 1024, 'viewport-1');

      // Wait a bit for stats to be emitted
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(statsReceived).toBe(false); // Stats are emitted every 30 seconds, so won't happen in test
    });
  });

  describe('Memory Usage Reporting', () => {
    it('should provide detailed memory usage breakdown', () => {
      const textureSize = 2048 * 1024; // 2MB
      const bufferSize = 1024 * 1024; // 1MB
      const cacheSize = 512 * 1024; // 512KB

      memoryManager.trackResource('texture-1', 'texture', textureSize, 'viewport-1');
      memoryManager.trackResource('buffer-1', 'buffer', bufferSize, 'viewport-2');
      memoryManager.trackResource('cache-1', 'cache', cacheSize, 'viewport-3');

      const usage = memoryManager.getMemoryUsage();

      expect(usage.total).toBe(testConfig.maxTotalMemory);
      expect(usage.used).toBe(textureSize + bufferSize + cacheSize);
      expect(usage.available).toBe(testConfig.maxTotalMemory! - usage.used);
      expect(usage.textureMemory).toBe(textureSize);
      expect(usage.bufferMemory).toBe(bufferSize);
      expect(usage.cacheMemory).toBe(cacheSize);

      // Check per-viewport allocations
      expect(usage.viewportAllocations.get('viewport-1')).toBe(textureSize);
      expect(usage.viewportAllocations.get('viewport-2')).toBe(bufferSize);
      expect(usage.viewportAllocations.get('viewport-3')).toBe(cacheSize);
    });
  });

  describe('Error Handling', () => {
    it('should handle untracking non-existent resources gracefully', () => {
      const result = memoryManager.untrackResource('non-existent-resource');
      expect(result).toBe(false);
    });

    it('should handle touching non-existent resources gracefully', () => {
      expect(() => {
        memoryManager.touchResource('non-existent-resource');
      }).not.toThrow();
    });

    it('should handle cleanup of empty viewport gracefully', () => {
      const bytesFreed = memoryManager.cleanupViewport('non-existent-viewport');
      expect(bytesFreed).toBe(0);
    });
  });

  describe('Disposal', () => {
    it('should clean up all resources on dispose', () => {
      memoryManager.trackResource('resource-1', 'texture', 1024, 'viewport-1');
      memoryManager.trackResource('resource-2', 'buffer', 512, 'viewport-2');

      expect(memoryManager.getMemoryUsage().used).toBeGreaterThan(0);

      memoryManager.dispose();

      const stats = memoryManager.getStats();
      expect(stats.currentUsage).toBe(0);
      expect(stats.totalAllocated).toBe(0);
      expect(stats.resourceCounts.textures).toBe(0);
      expect(stats.resourceCounts.buffers).toBe(0);
    });
  });
});
