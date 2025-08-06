/**
 * Viewport Rendering Optimization Tests
 * Tests for advanced viewport-level rendering optimization features
 */

import { ViewportOptimizer } from '../services/viewport-optimizer/index';
import { RenderPriority } from '../services/viewport-optimizer/types';

describe('ViewportOptimizer - Rendering Optimization', () => {
  let optimizer: ViewportOptimizer;

  beforeEach(() => {
    optimizer = new ViewportOptimizer({
      maxFps: 60,
      memoryThreshold: 512,
      adaptiveQuality: true,
      priorityThrottling: true,
    });
  });

  afterEach(() => {
    optimizer.dispose();
  });

  describe('Frame Rate Control', () => {
    it('should calculate correct target FPS based on priority', () => {
      const testCases = [
        { priority: RenderPriority.CRITICAL, expectedMin: 50, expectedMax: 60 },
        { priority: RenderPriority.HIGH, expectedMin: 40, expectedMax: 54 },
        { priority: RenderPriority.MEDIUM, expectedMin: 20, expectedMax: 42 },
        { priority: RenderPriority.LOW, expectedMin: 10, expectedMax: 30 },
        { priority: RenderPriority.SUSPENDED, expectedMin: 0, expectedMax: 0 },
      ];

      testCases.forEach(({ priority, expectedMin, expectedMax }) => {
        // Access private method for testing (in real implementation, this would be through public interface)
        const targetFps = (optimizer as any).calculateTargetFps(priority, {
          name: 'High',
          targetFps: 60,
          textureQuality: 0.8,
          shadowQuality: 0.8,
          renderScale: 0.9,
          maxTextureSize: 1024,
          enableVSync: true,
          interpolationType: 'LINEAR' as const,
        });

        expect(targetFps).toBeGreaterThanOrEqual(expectedMin);
        expect(targetFps).toBeLessThanOrEqual(expectedMax);
      });
    });

    it('should adjust throttle ratio based on performance', () => {
      const mockState = {
        viewportId: 'test-viewport',
        priority: RenderPriority.MEDIUM,
        qualityLevel: {
          name: 'Medium',
          targetFps: 30,
          textureQuality: 0.6,
          shadowQuality: 0.6,
          renderScale: 0.8,
          maxTextureSize: 512,
          enableVSync: false,
          interpolationType: 'LINEAR' as const,
        },
        isRendering: true,
        lastRenderTime: Date.now(),
        frameCount: 100,
        memoryAllocated: 50 * 1024 * 1024,
        resourcesLoaded: true,
        throttleRatio: 1.0,
      };

      // Simulate adding viewport state
      (optimizer as any).viewportStates.set('test-viewport', mockState);

      // Mock performance monitor to return high FPS (should increase throttling)
      jest.spyOn(optimizer as any, 'performanceMonitor').mockReturnValue({
        getViewportPerformanceStats: jest.fn().mockReturnValue({ fps: 45 }),
      });

      (optimizer as any).performAdvancedRenderingOptimization('test-viewport');

      // Should have adjusted throttle ratio down due to high FPS
      expect(mockState.throttleRatio).toBeLessThan(1.0);
    });
  });

  describe('Priority Management', () => {
    it('should set correct priorities based on viewport interaction', () => {
      const now = Date.now();
      const mockStates = new Map([
        [
          'active-viewport',
          {
            viewportId: 'active-viewport',
            priority: RenderPriority.MEDIUM,
            lastRenderTime: now,
            qualityLevel: { name: 'Medium' },
            isRendering: true,
            frameCount: 0,
            memoryAllocated: 0,
            resourcesLoaded: false,
            throttleRatio: 1.0,
          },
        ],
        [
          'inactive-viewport',
          {
            viewportId: 'inactive-viewport',
            priority: RenderPriority.MEDIUM,
            lastRenderTime: now - 10000, // 10 seconds ago
            qualityLevel: { name: 'Medium' },
            isRendering: false,
            frameCount: 0,
            memoryAllocated: 0,
            resourcesLoaded: false,
            throttleRatio: 1.0,
          },
        ],
      ]);

      (optimizer as any).viewportStates = mockStates;

      // Mock viewport state manager
      jest.spyOn(optimizer as any, 'viewportStateManager').mockReturnValue({
        getViewportState: jest.fn().mockImplementation(id => ({
          activation: { isActive: id === 'active-viewport' },
        })),
      });

      (optimizer as any).updateDynamicPriorities('active-viewport');

      expect(mockStates.get('active-viewport')?.priority).toBe(RenderPriority.CRITICAL);
      expect(mockStates.get('inactive-viewport')?.priority).toBe(RenderPriority.LOW);
    });

    it('should sort rendering queue by priority', () => {
      const mockStates = new Map([
        ['low-priority', { priority: RenderPriority.LOW }],
        ['high-priority', { priority: RenderPriority.HIGH }],
        ['critical-priority', { priority: RenderPriority.CRITICAL }],
      ]);

      (optimizer as any).viewportStates = mockStates;

      // Mock rendering priority manager
      const mockSetPriority = jest.fn();
      const mockSetRenderOrder = jest.fn();
      jest.spyOn(optimizer as any, 'renderingPriorityManager').mockReturnValue({
        setPriority: mockSetPriority,
        setRenderOrder: mockSetRenderOrder,
      });

      (optimizer as any).updateRenderingQueue();

      // Should be called in priority order: CRITICAL (0), HIGH (1), LOW (3)
      expect(mockSetRenderOrder).toHaveBeenCalledWith('critical-priority', 0);
      expect(mockSetRenderOrder).toHaveBeenCalledWith('high-priority', 1);
      expect(mockSetRenderOrder).toHaveBeenCalledWith('low-priority', 2);
    });
  });

  describe('Memory-Based Optimizations', () => {
    it('should reduce quality under memory pressure', () => {
      const mockQualityManager = {
        getLowerQualityLevel: jest.fn().mockReturnValue({
          name: 'Low',
          targetFps: 30,
          textureQuality: 0.4,
        }),
        applyQualityToViewport: jest.fn(),
      };

      const mockMemoryManager = {
        getMemoryStatistics: jest.fn().mockReturnValue({
          usageRatio: 0.9, // High memory pressure
        }),
      };

      const mockState = {
        priority: RenderPriority.MEDIUM,
        qualityLevel: { name: 'High' },
      };

      (optimizer as any).qualityManager = mockQualityManager;
      (optimizer as any).memoryManager = mockMemoryManager;
      (optimizer as any).viewportStates.set('test-viewport', mockState);

      (optimizer as any).applyMemoryBasedOptimizations();

      expect(mockQualityManager.getLowerQualityLevel).toHaveBeenCalled();
      expect(mockQualityManager.applyQualityToViewport).toHaveBeenCalledWith(
        'test-viewport',
        expect.objectContaining({ name: 'Low' })
      );
    });

    it('should suspend low priority viewports under extreme memory pressure', () => {
      const mockMemoryManager = {
        getMemoryStatistics: jest.fn().mockReturnValue({
          usageRatio: 0.96, // Extreme memory pressure
        }),
      };

      const mockState = {
        priority: RenderPriority.LOW,
        isRendering: true,
      };

      (optimizer as any).memoryManager = mockMemoryManager;
      (optimizer as any).viewportStates.set('test-viewport', mockState);

      (optimizer as any).applyMemoryBasedOptimizations();

      expect(mockState.priority).toBe(RenderPriority.SUSPENDED);
      expect(mockState.isRendering).toBe(false);
    });
  });

  describe('System Load Calculation', () => {
    it('should calculate system load correctly', () => {
      const mockPerformanceStats = {
        cpuUsage: 60, // 60% CPU
        memoryUsage: 256 * 1024 * 1024, // 256MB
        averageFps: 45, // Good FPS
      };

      jest.spyOn(optimizer as any, 'performanceMonitor').mockReturnValue({
        getSystemPerformanceStats: jest.fn().mockReturnValue(mockPerformanceStats),
      });

      const systemLoad = (optimizer as any).calculateSystemLoad();

      // Should be a reasonable load value between 0 and 1
      expect(systemLoad).toBeGreaterThanOrEqual(0);
      expect(systemLoad).toBeLessThanOrEqual(1);

      // With 60% CPU, 50% memory (256MB of 512MB), and good FPS, should be moderate load
      expect(systemLoad).toBeGreaterThan(0.3);
      expect(systemLoad).toBeLessThan(0.8);
    });
  });

  describe('Integration Test', () => {
    it('should complete full optimization cycle without errors', () => {
      // Mock all dependencies
      jest.spyOn(optimizer as any, 'updateViewportStates').mockImplementation(() => {});
      jest.spyOn(optimizer as any, 'performanceMonitor').mockReturnValue({
        getViewportPerformanceStats: jest.fn().mockReturnValue({ fps: 30 }),
        getSystemPerformanceStats: jest.fn().mockReturnValue({
          cpuUsage: 50,
          memoryUsage: 200 * 1024 * 1024,
          averageFps: 30,
        }),
      });
      jest.spyOn(optimizer as any, 'memoryManager').mockReturnValue({
        getMemoryPressureRatio: jest.fn().mockReturnValue(0.5),
        getMemoryStatistics: jest.fn().mockReturnValue({ usageRatio: 0.5 }),
      });

      // Should not throw any errors
      expect(() => {
        optimizer.optimizeRendering('test-viewport');
      }).not.toThrow();
    });
  });
});
