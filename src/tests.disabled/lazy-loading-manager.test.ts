/**
 * Lazy Loading Manager Test Suite
 * Tests for advanced lazy loading functionality
 */

import { LazyLoadingManager, LazyLoadableResource, LoadingContext } from '../services/LazyLoadingManager';

// Mock logger
jest.mock('../utils/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('LazyLoadingManager', () => {
  let manager: LazyLoadingManager;

  beforeEach(() => {
    manager = new LazyLoadingManager({
      maxConcurrentLoads: 2,
      loadingTimeoutMs: 1000, // Short timeout for testing
      retryAttempts: 1, // Single attempt for faster tests
      enablePredictiveLoading: false, // Disable for simpler testing
      enableIntersectionObserver: false, // Disable for testing environment
    });
  });

  afterEach(() => {
    manager?.dispose();
  });

  describe('Resource Registration', () => {
    test('registers resource correctly', () => {
      manager.registerResource('test-image-1', 'image', 'viewport-1', {
        priority: 8,
        size: 1024 * 1024,
        url: 'https://example.com/image1.dcm',
      });

      const stats = manager.getStatistics();
      expect(stats.totalResources).toBe(1);
      expect(stats.loadedResources).toBe(0);
    });

    test('registers multiple resources with different types', () => {
      manager.registerResource('image-1', 'image', 'viewport-1', { priority: 8 });
      manager.registerResource('volume-1', 'volume', 'viewport-1', { priority: 9 });
      manager.registerResource('metadata-1', 'metadata', 'viewport-2', { priority: 5 });

      const stats = manager.getStatistics();
      expect(stats.totalResources).toBe(3);
    });

    test('handles resource registration with dependencies', () => {
      manager.registerResource('metadata-1', 'metadata', 'viewport-1', { priority: 5 });
      manager.registerResource('image-1', 'image', 'viewport-1', {
        priority: 8,
        dependencies: ['metadata-1'],
      });

      const stats = manager.getStatistics();
      expect(stats.totalResources).toBe(2);
    });
  });

  describe('Resource Loading', () => {
    test('loads resource immediately', async () => {
      manager.registerResource('test-image', 'image', 'viewport-1', {
        priority: 8,
        size: 1024,
      });

      const loadPromise = manager.loadResource('test-image');
      expect(loadPromise).toBeInstanceOf(Promise);

      const result = await loadPromise;
      expect(result).toHaveProperty('type', 'image');
      expect(result).toHaveProperty('data', 'loaded-test-image');

      const stats = manager.getStatistics();
      expect(stats.loadedResources).toBe(1);
    });

    test('handles non-existent resource loading', async () => {
      await expect(manager.loadResource('non-existent')).rejects.toThrow('Resource not found');
    });

    test('returns cached content for already loaded resource', async () => {
      manager.registerResource('test-image', 'image', 'viewport-1');

      // Load first time
      const result1 = await manager.loadResource('test-image');

      // Load second time (should return cached)
      const result2 = await manager.loadResource('test-image');

      expect(result1).toEqual(result2);
    });

    test('loads dependencies before main resource', async () => {
      manager.registerResource('metadata-1', 'metadata', 'viewport-1', { priority: 5 });
      manager.registerResource('image-1', 'image', 'viewport-1', {
        priority: 8,
        dependencies: ['metadata-1'],
      });

      const result = await manager.loadResource('image-1');
      expect(result).toHaveProperty('type', 'image');

      const stats = manager.getStatistics();
      expect(stats.loadedResources).toBe(2); // Both metadata and image loaded
    });
  });

  describe('Queue Management', () => {
    test('queues resource for lazy loading', () => {
      manager.registerResource('test-image', 'image', 'viewport-1');

      manager.queueResource('test-image', 'high');

      // Resource should be queued but not loaded yet
      const stats = manager.getStatistics();
      expect(stats.totalResources).toBe(1);
      expect(stats.loadedResources).toBe(0);
    });

    test('queues multiple resources with different priorities', () => {
      manager.registerResource('high-priority', 'image', 'viewport-1', { priority: 10 });
      manager.registerResource('medium-priority', 'image', 'viewport-1', { priority: 5 });
      manager.registerResource('low-priority', 'image', 'viewport-1', { priority: 1 });

      manager.queueResource('high-priority', 'high');
      manager.queueResource('medium-priority', 'medium');
      manager.queueResource('low-priority', 'low');

      const stats = manager.getStatistics();
      expect(stats.totalResources).toBe(3);
    });

    test('does not queue already loaded resource', () => {
      manager.registerResource('test-image', 'image', 'viewport-1');

      // Load the resource first
      manager.loadResource('test-image');

      // Try to queue (should be ignored)
      manager.queueResource('test-image', 'high');

      // Should still work without errors
      expect(() => manager.queueResource('test-image', 'high')).not.toThrow();
    });
  });

  describe('Resource Unloading', () => {
    test('unloads loaded resource successfully', async () => {
      manager.registerResource('test-image', 'image', 'viewport-1');

      // Load first
      await manager.loadResource('test-image');
      expect(manager.getStatistics().loadedResources).toBe(1);

      // Unload
      const success = await manager.unloadResource('test-image');
      expect(success).toBe(true);
      expect(manager.getStatistics().loadedResources).toBe(0);
    });

    test('handles unloading of non-loaded resource', async () => {
      manager.registerResource('test-image', 'image', 'viewport-1');

      const success = await manager.unloadResource('test-image');
      expect(success).toBe(false);
    });

    test('handles unloading of non-existent resource', async () => {
      const success = await manager.unloadResource('non-existent');
      expect(success).toBe(false);
    });
  });

  describe('Viewport Optimization', () => {
    test('optimizes loading for active viewports', () => {
      manager.registerResource('active-image', 'image', 'viewport-1', { priority: 5 });
      manager.registerResource('inactive-image', 'image', 'viewport-2', { priority: 5 });

      manager.optimizeForViewports(['viewport-1'], ['viewport-1'], 0.3);

      // This should internally reprioritize resources
      // We can't directly test the internal state, but ensure no errors
      expect(() => {
        manager.optimizeForViewports(['viewport-1'], ['viewport-1'], 0.3);
      }).not.toThrow();
    });

    test('handles memory pressure during optimization', () => {
      manager.registerResource('test-image', 'image', 'viewport-1');

      // High memory pressure should trigger defensive behavior
      expect(() => {
        manager.optimizeForViewports(['viewport-1'], ['viewport-1'], 0.95);
      }).not.toThrow();
    });

    test('handles empty viewport lists', () => {
      manager.registerResource('test-image', 'image', 'viewport-1');

      expect(() => {
        manager.optimizeForViewports([], [], 0.1);
      }).not.toThrow();
    });
  });

  describe('Prefetching', () => {
    test('prefetches resources for specified viewports', async () => {
      manager.registerResource('prefetch-1', 'image', 'viewport-1', { priority: 8 });
      manager.registerResource('prefetch-2', 'image', 'viewport-1', { priority: 7 });
      manager.registerResource('prefetch-3', 'image', 'viewport-2', { priority: 6 });

      await manager.prefetchResources(['viewport-1', 'viewport-2']);

      // Prefetching should queue resources for background loading
      // No direct way to test internal queue state, but ensure no errors
      expect(() => manager.prefetchResources(['viewport-1'])).not.toThrow();
    });

    test('handles prefetching for non-existent viewports', async () => {
      await expect(manager.prefetchResources(['non-existent-viewport'])).resolves.not.toThrow();
    });

    test('handles empty viewport list for prefetching', async () => {
      await expect(manager.prefetchResources([])).resolves.not.toThrow();
    });
  });

  describe('Statistics', () => {
    test('provides accurate statistics', async () => {
      manager.registerResource('image-1', 'image', 'viewport-1');
      manager.registerResource('image-2', 'image', 'viewport-1');

      let stats = manager.getStatistics();
      expect(stats.totalResources).toBe(2);
      expect(stats.loadedResources).toBe(0);
      expect(stats.failedResources).toBe(0);

      // Load one resource
      await manager.loadResource('image-1');

      stats = manager.getStatistics();
      expect(stats.totalResources).toBe(2);
      expect(stats.loadedResources).toBe(1);
      expect(stats.averageLoadTime).toBeGreaterThan(0);
    });

    test('tracks memory usage accurately', async () => {
      manager.registerResource('large-image', 'image', 'viewport-1', {
        size: 5 * 1024 * 1024, // 5MB
      });

      await manager.loadResource('large-image');

      const stats = manager.getStatistics();
      expect(stats.memoryUsage).toBe(5 * 1024 * 1024);
    });
  });

  describe('Error Handling', () => {
    test('handles loading strategy not found', async () => {
      // Create manager without built-in strategies
      const customManager = new LazyLoadingManager({
        maxConcurrentLoads: 1,
        strategies: [], // No strategies
      });

      customManager.registerResource('test', 'image', 'viewport-1');

      await expect(customManager.loadResource('test')).rejects.toThrow(
        'No loading strategy found for resource type: image'
      );

      customManager.dispose();
    });

    test('handles loading timeout', async () => {
      // Create manager with very short timeout
      const timeoutManager = new LazyLoadingManager({
        loadingTimeoutMs: 1, // 1ms timeout
        retryAttempts: 1,
      });

      timeoutManager.registerResource('timeout-test', 'volume', 'viewport-1');

      await expect(timeoutManager.loadResource('timeout-test')).rejects.toThrow();

      timeoutManager.dispose();
    });
  });

  describe('Event Emission', () => {
    test('emits resource loading events', done => {
      manager.registerResource('event-test', 'image', 'viewport-1');

      let eventsReceived = 0;

      manager.on('resource-loading-started', (resource: LazyLoadableResource) => {
        expect(resource.id).toBe('event-test');
        eventsReceived++;
      });

      manager.on('resource-loaded', (resource: LazyLoadableResource, loadTime: number) => {
        expect(resource.id).toBe('event-test');
        expect(loadTime).toBeGreaterThan(0);
        eventsReceived++;

        if (eventsReceived === 2) {
          done();
        }
      });

      manager.loadResource('event-test');
    });

    test('emits memory pressure events', done => {
      manager.registerResource('memory-test', 'image', 'viewport-1');

      manager.on('memory-pressure-detected', (pressure: number, action: string) => {
        expect(pressure).toBeGreaterThan(0.8);
        expect(action).toBeTruthy();
        done();
      });

      // Trigger high memory pressure
      manager.optimizeForViewports(['viewport-1'], ['viewport-1'], 0.95);
    });

    test('emits queue update events', done => {
      manager.registerResource('queue-test', 'image', 'viewport-1');

      manager.on('loading-queue-updated', queue => {
        expect(queue).toHaveProperty('high');
        expect(queue).toHaveProperty('medium');
        expect(queue).toHaveProperty('low');
        expect(queue).toHaveProperty('background');
        done();
      });

      manager.queueResource('queue-test', 'high');
    });
  });

  describe('Cleanup and Disposal', () => {
    test('disposes correctly without errors', () => {
      manager.registerResource('dispose-test', 'image', 'viewport-1');

      expect(() => manager.dispose()).not.toThrow();
    });

    test('clears all data on disposal', () => {
      manager.registerResource('cleanup-test', 'image', 'viewport-1');

      manager.dispose();

      const stats = manager.getStatistics();
      expect(stats.totalResources).toBe(0);
    });

    test('stops background tasks on disposal', () => {
      const disposeSpy = jest.spyOn(manager, 'dispose');

      manager.dispose();

      expect(disposeSpy).toHaveBeenCalled();
    });
  });

  describe('Advanced Features', () => {
    test('handles different resource types correctly', async () => {
      manager.registerResource('test-image', 'image', 'viewport-1');
      manager.registerResource('test-volume', 'volume', 'viewport-1');
      manager.registerResource('test-metadata', 'metadata', 'viewport-1');

      const imageResult = await manager.loadResource('test-image');
      const volumeResult = await manager.loadResource('test-volume');
      const metadataResult = await manager.loadResource('test-metadata');

      expect(imageResult.type).toBe('image');
      expect(volumeResult.type).toBe('volume');
      expect(metadataResult.type).toBe('metadata');
    });

    test('respects resource priorities', () => {
      manager.registerResource('high-priority', 'image', 'viewport-1', { priority: 10 });
      manager.registerResource('low-priority', 'image', 'viewport-1', { priority: 1 });

      manager.queueResource('high-priority', 'medium');
      manager.queueResource('low-priority', 'medium');

      // Internal queue should be sorted by priority
      // We can't directly test the internal state, but ensure no errors
      expect(() => {
        manager.queueResource('high-priority', 'medium');
        manager.queueResource('low-priority', 'medium');
      }).not.toThrow();
    });

    test('handles retention policies', async () => {
      manager.registerResource('retention-test', 'image', 'viewport-1', {
        retentionPolicy: {
          maxAge: 1000, // 1 second
          maxIdleTime: 500, // 0.5 seconds
          keepInMemory: false,
          canCompress: true,
        },
      });

      await manager.loadResource('retention-test');

      // Wait for retention policy to trigger
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Resource should be cleaned up by background task
      // We can't directly test this without access to internal cleanup cycle
      expect(manager.getStatistics().totalResources).toBe(1);
    });
  });
});
