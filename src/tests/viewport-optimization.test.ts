/**
 * Viewport Optimization Tests
 * Tests for viewport-level rendering optimization
 */

import { viewportOptimizer, RenderPriority } from '../services/viewportOptimizer';

describe('Viewport Optimization', () => {
  beforeEach(() => {
    // Reset optimizer state before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
    viewportOptimizer.dispose();
  });

  describe('optimizeRendering', () => {
    it('should optimize rendering for active viewport', () => {
      const activeViewportId = 'test-viewport-1';

      expect(() => {
        viewportOptimizer.optimizeRendering(activeViewportId);
      }).not.toThrow();
    });

    it('should handle multiple viewport optimization', () => {
      const viewportIds = ['viewport-1', 'viewport-2', 'viewport-3'];

      viewportIds.forEach(id => {
        expect(() => {
          viewportOptimizer.optimizeRendering(id);
        }).not.toThrow();
      });
    });
  });

  describe('setPriority', () => {
    it('should set viewport priority correctly', () => {
      const viewportId = 'test-viewport';

      expect(() => {
        viewportOptimizer.setPriority(viewportId, RenderPriority.CRITICAL);
      }).not.toThrow();

      expect(() => {
        viewportOptimizer.setPriority(viewportId, RenderPriority.LOW);
      }).not.toThrow();
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return null for non-existent viewport', () => {
      const metrics = viewportOptimizer.getPerformanceMetrics('non-existent');
      expect(metrics).toBeNull();
    });

    it('should return aggregated metrics when no viewport specified', () => {
      const metrics = viewportOptimizer.getPerformanceMetrics();
      // Should be null initially as no data exists
      expect(metrics).toBeNull();
    });
  });

  describe('getOptimizationSuggestions', () => {
    it('should return array of suggestions', () => {
      const suggestions = viewportOptimizer.getOptimizationSuggestions();
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('memory management', () => {
    it('should handle empty viewport states', () => {
      expect(() => {
        viewportOptimizer.manageMemory([]);
      }).not.toThrow();
    });

    it('should handle viewport states with proper structure', () => {
      const mockViewportStates = [
        {
          id: 'viewport-1',
          activation: { isActive: true, isVisible: true },
          performance: { isRenderingEnabled: true },
        },
        {
          id: 'viewport-2',
          activation: { isActive: false, isVisible: true },
          performance: { isRenderingEnabled: false },
        },
      ];

      expect(() => {
        viewportOptimizer.manageMemory(mockViewportStates as any);
      }).not.toThrow();
    });
  });
});
