/**
 * Navigation Tool Compatibility Tests
 * Comprehensive test suite for navigation tool v3 API compatibility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as cornerstoneTools from '@cornerstonejs/tools';
import {
  NavigationToolCompatibility,
  NavigationVerificationResult,
  navigationToolCompatibility,
  verifyAllNavigationTools,
  verifyNavigationTool,
} from '../services/NavigationToolCompatibility';
import { ToolType } from '../components/ToolPanel/constants';

// Mock cornerstone tools
vi.mock('@cornerstonejs/tools', () => ({
  ToolGroupManager: {
    getToolGroup: vi.fn(),
    createToolGroup: vi.fn(),
    destroyToolGroup: vi.fn(),
    getAllToolGroups: vi.fn(() => []),
  },
  Enums: {
    MouseBindings: {
      Primary: 1,
      Secondary: 2,
      Auxiliary: 4,
      Wheel: 8,
    },
  },
  PanTool: {
    toolName: 'Pan',
    configuration: {},
    supportedInteractionTypes: ['mouse', 'touch', 'keyboard'],
  },
  ZoomTool: {
    toolName: 'Zoom',
    configuration: {},
    supportedInteractionTypes: ['mouse', 'touch', 'keyboard'],
  },
  WindowLevelTool: {
    toolName: 'WindowLevel',
    configuration: {},
    supportedInteractionTypes: ['mouse', 'touch', 'keyboard'],
  },
  StackScrollTool: {
    toolName: 'StackScroll',
    configuration: {},
    supportedInteractionTypes: ['mouse', 'touch', 'keyboard'],
  },
  addTool: vi.fn(),
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('NavigationToolCompatibility', () => {
  let compatibility: NavigationToolCompatibility;
  let mockToolGroup: any;
  const testToolGroupId = 'test-navigation-group';

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock tool group
    mockToolGroup = {
      id: testToolGroupId,
      setToolActive: vi.fn(),
      setToolPassive: vi.fn(),
      addTool: vi.fn(),
      getViewportIds: vi.fn(() => ['viewport-1']),
      getToolGroup: vi.fn(() => mockToolGroup),
    };

    vi.mocked(cornerstoneTools.ToolGroupManager.getToolGroup).mockReturnValue(mockToolGroup);

    compatibility = new NavigationToolCompatibility();
  });

  afterEach(() => {
    compatibility.clearResults();
  });

  describe('Constructor', () => {
    it('should initialize with default verification framework', () => {
      const instance = new NavigationToolCompatibility();
      expect(instance).toBeInstanceOf(NavigationToolCompatibility);
    });
  });

  describe('verifyAllNavigationTools', () => {
    it('should verify all navigation tools successfully', async () => {
      const results = await compatibility.verifyAllNavigationTools(testToolGroupId);

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(4); // Pan, Zoom, WindowLevel, StackScroll

      // Check that all navigation tools are included
      const toolTypes = results.map(r => r.toolType);
      expect(toolTypes).toContain(ToolType.PAN);
      expect(toolTypes).toContain(ToolType.ZOOM);
      expect(toolTypes).toContain(ToolType.WINDOW_LEVEL);
      expect(toolTypes).toContain(ToolType.STACK_SCROLL);
    });

    it('should handle tool group not found gracefully', async () => {
      vi.mocked(cornerstoneTools.ToolGroupManager.getToolGroup).mockReturnValue(null);

      const results = await compatibility.verifyAllNavigationTools('invalid-group');

      // Should still return results, but they may have errors
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(4);
    });

    it('should store results in internal map', async () => {
      await compatibility.verifyAllNavigationTools(testToolGroupId);

      const panResult = compatibility.getNavigationResult(testToolGroupId, ToolType.PAN);
      expect(panResult).toBeDefined();
      expect(panResult?.toolType).toBe(ToolType.PAN);
    });
  });

  describe('verifyNavigationTool', () => {
    it('should verify pan tool compatibility', async () => {
      const config = {
        toolType: ToolType.PAN,
        toolClass: cornerstoneTools.PanTool,
        supportsTouch: true,
        supportsKeyboard: true,
        supportsMouse: true,
        defaultBindings: [{ button: cornerstoneTools.Enums.MouseBindings.Auxiliary }] as const,
        gestureTypes: ['drag', 'flick', 'inertia'] as const,
        performanceMetrics: ['panLatency', 'smoothnessScore'] as const,
      };

      const result = await compatibility.verifyNavigationTool(config, testToolGroupId);

      expect(result).toBeDefined();
      expect(result.toolType).toBe(ToolType.PAN);
      expect(result.toolName).toBe('Pan');
      expect(result.touchGestureSupport).toBe(true);
      expect(result.keyboardShortcutSupport).toBe(true);
      expect(result.mouseInteractionSupport).toBe(true);
      expect(result.gestureTests).toBeInstanceOf(Array);
      expect(result.gestureTests.length).toBe(3); // drag, flick, inertia
      expect(result.performanceMetrics).toBeDefined();
    });

    it('should verify zoom tool compatibility', async () => {
      const config = {
        toolType: ToolType.ZOOM,
        toolClass: cornerstoneTools.ZoomTool,
        supportsTouch: true,
        supportsKeyboard: true,
        supportsMouse: true,
        defaultBindings: [
          { button: cornerstoneTools.Enums.MouseBindings.Secondary },
          { button: cornerstoneTools.Enums.MouseBindings.Wheel },
        ] as const,
        gestureTypes: ['pinch', 'wheel', 'doubleClick'] as const,
        performanceMetrics: ['zoomLatency', 'renderingFPS'] as const,
      };

      const result = await compatibility.verifyNavigationTool(config, testToolGroupId);

      expect(result).toBeDefined();
      expect(result.toolType).toBe(ToolType.ZOOM);
      expect(result.toolName).toBe('Zoom');
      expect(result.gestureTests.length).toBe(3); // pinch, wheel, doubleClick
    });

    it('should verify window level tool compatibility', async () => {
      const config = {
        toolType: ToolType.WINDOW_LEVEL,
        toolClass: cornerstoneTools.WindowLevelTool,
        supportsTouch: true,
        supportsKeyboard: true,
        supportsMouse: true,
        defaultBindings: [{ button: cornerstoneTools.Enums.MouseBindings.Primary }] as const,
        gestureTypes: ['drag', 'multiTouch'] as const,
        performanceMetrics: ['renderingFPS', 'smoothnessScore'] as const,
      };

      const result = await compatibility.verifyNavigationTool(config, testToolGroupId);

      expect(result).toBeDefined();
      expect(result.toolType).toBe(ToolType.WINDOW_LEVEL);
      expect(result.toolName).toBe('WindowLevel');
    });

    it('should verify stack scroll tool compatibility', async () => {
      const config = {
        toolType: ToolType.STACK_SCROLL,
        toolClass: cornerstoneTools.StackScrollTool,
        supportsTouch: true,
        supportsKeyboard: true,
        supportsMouse: true,
        defaultBindings: [{ button: cornerstoneTools.Enums.MouseBindings.Wheel }] as const,
        gestureTypes: ['wheel', 'swipe', 'keyArrows'] as const,
        performanceMetrics: ['renderingFPS', 'memoryUsage'] as const,
      };

      const result = await compatibility.verifyNavigationTool(config, testToolGroupId);

      expect(result).toBeDefined();
      expect(result.toolType).toBe(ToolType.STACK_SCROLL);
      expect(result.toolName).toBe('StackScroll');
    });
  });

  describe('Touch Gesture Validation', () => {
    it('should validate allowed gesture types', async () => {
      const validConfig = {
        toolType: ToolType.PAN,
        toolClass: cornerstoneTools.PanTool,
        supportsTouch: true,
        supportsKeyboard: false,
        supportsMouse: false,
        defaultBindings: [] as const,
        gestureTypes: ['drag', 'pinch', 'wheel'] as const, // All valid
        performanceMetrics: [] as const,
      };

      const result = await compatibility.verifyNavigationTool(validConfig, testToolGroupId);
      expect(result.touchGestureSupport).toBe(true);
    });

    it('should reject invalid gesture types', async () => {
      const invalidConfig = {
        toolType: ToolType.PAN,
        toolClass: cornerstoneTools.PanTool,
        supportsTouch: true,
        supportsKeyboard: false,
        supportsMouse: false,
        defaultBindings: [] as const,
        gestureTypes: ['invalidGesture', 'maliciousScript'] as const, // Invalid
        performanceMetrics: [] as const,
      };

      const result = await compatibility.verifyNavigationTool(invalidConfig, testToolGroupId);
      expect(result.touchGestureSupport).toBe(false);
    });

    it('should handle tools without touch support correctly', async () => {
      const config = {
        toolType: ToolType.PAN,
        toolClass: cornerstoneTools.PanTool,
        supportsTouch: false, // No touch support claimed
        supportsKeyboard: true,
        supportsMouse: true,
        defaultBindings: [{ button: cornerstoneTools.Enums.MouseBindings.Primary }] as const,
        gestureTypes: [] as const,
        performanceMetrics: [] as const,
      };

      const result = await compatibility.verifyNavigationTool(config, testToolGroupId);
      expect(result.touchGestureSupport).toBe(true); // Should be true since no touch support is claimed
    });
  });

  describe('Mouse Interaction Validation', () => {
    it('should validate mouse bindings correctly', async () => {
      const config = {
        toolType: ToolType.ZOOM,
        toolClass: cornerstoneTools.ZoomTool,
        supportsTouch: false,
        supportsKeyboard: false,
        supportsMouse: true,
        defaultBindings: [
          { button: cornerstoneTools.Enums.MouseBindings.Primary },
          { button: cornerstoneTools.Enums.MouseBindings.Secondary, modifiers: ['shift', 'ctrl'] },
        ] as const,
        gestureTypes: [] as const,
        performanceMetrics: [] as const,
      };

      const result = await compatibility.verifyNavigationTool(config, testToolGroupId);
      expect(result.mouseInteractionSupport).toBe(true);
    });

    it('should reject invalid mouse button values', async () => {
      const config = {
        toolType: ToolType.ZOOM,
        toolClass: cornerstoneTools.ZoomTool,
        supportsTouch: false,
        supportsKeyboard: false,
        supportsMouse: true,
        defaultBindings: [
          { button: -1 }, // Invalid button value
        ] as const,
        gestureTypes: [] as const,
        performanceMetrics: [] as const,
      };

      const result = await compatibility.verifyNavigationTool(config, testToolGroupId);
      expect(result.mouseInteractionSupport).toBe(false);
    });

    it('should reject empty modifier strings', async () => {
      const config = {
        toolType: ToolType.ZOOM,
        toolClass: cornerstoneTools.ZoomTool,
        supportsTouch: false,
        supportsKeyboard: false,
        supportsMouse: true,
        defaultBindings: [
          { button: cornerstoneTools.Enums.MouseBindings.Primary, modifiers: [''] }, // Empty modifier
        ] as const,
        gestureTypes: [] as const,
        performanceMetrics: [] as const,
      };

      const result = await compatibility.verifyNavigationTool(config, testToolGroupId);
      expect(result.mouseInteractionSupport).toBe(false);
    });
  });

  describe('Gesture Testing', () => {
    it('should perform gesture tests for all gesture types', async () => {
      const config = {
        toolType: ToolType.PAN,
        toolClass: cornerstoneTools.PanTool,
        supportsTouch: true,
        supportsKeyboard: false,
        supportsMouse: false,
        defaultBindings: [] as const,
        gestureTypes: ['drag', 'flick', 'pinch', 'wheel'] as const,
        performanceMetrics: [] as const,
      };

      const result = await compatibility.verifyNavigationTool(config, testToolGroupId);

      expect(result.gestureTests).toHaveLength(4);

      const gestureTypes = result.gestureTests.map(t => t.gestureType);
      expect(gestureTypes).toContain('drag');
      expect(gestureTypes).toContain('flick');
      expect(gestureTypes).toContain('pinch');
      expect(gestureTypes).toContain('wheel');

      // All tests should have timing measurements
      result.gestureTests.forEach(test => {
        expect(test.responseTime).toBeTypeOf('number');
        expect(test.responseTime).toBeGreaterThanOrEqual(0);
        expect(test.accuracy).toBeTypeOf('number');
        expect(test.accuracy).toBeGreaterThanOrEqual(0);
        expect(test.accuracy).toBeLessThanOrEqual(100);
      });
    });

    it('should handle invalid gesture types in tests', async () => {
      const config = {
        toolType: ToolType.PAN,
        toolClass: cornerstoneTools.PanTool,
        supportsTouch: true,
        supportsKeyboard: false,
        supportsMouse: false,
        defaultBindings: [] as const,
        gestureTypes: ['invalidGesture'] as const,
        performanceMetrics: [] as const,
      };

      const result = await compatibility.verifyNavigationTool(config, testToolGroupId);

      expect(result.gestureTests).toHaveLength(1);
      const gestureTest = result.gestureTests[0];
      expect(gestureTest.gestureType).toBe('invalidGesture');
      expect(gestureTest.supported).toBe(false);
      expect(gestureTest.errorMessage).toContain('Invalid gesture type');
    });

    it('should measure different accuracy levels for different gestures', async () => {
      const config = {
        toolType: ToolType.ZOOM,
        toolClass: cornerstoneTools.ZoomTool,
        supportsTouch: true,
        supportsKeyboard: false,
        supportsMouse: false,
        defaultBindings: [] as const,
        gestureTypes: ['drag', 'pinch', 'wheel', 'swipe'] as const,
        performanceMetrics: [] as const,
      };

      const result = await compatibility.verifyNavigationTool(config, testToolGroupId);

      const dragTest = result.gestureTests.find(t => t.gestureType === 'drag');
      const wheelTest = result.gestureTests.find(t => t.gestureType === 'wheel');

      expect(dragTest).toBeDefined();
      expect(wheelTest).toBeDefined();

      // Wheel gestures should have higher accuracy than drag
      expect(wheelTest!.accuracy).toBeGreaterThan(dragTest!.accuracy);
    });
  });

  describe('Performance Metrics', () => {
    it('should measure performance metrics correctly', async () => {
      const config = {
        toolType: ToolType.PAN,
        toolClass: cornerstoneTools.PanTool,
        supportsTouch: true,
        supportsKeyboard: false,
        supportsMouse: false,
        defaultBindings: [] as const,
        gestureTypes: [] as const,
        performanceMetrics: ['panLatency', 'smoothnessScore'] as const,
      };

      const result = await compatibility.verifyNavigationTool(config, testToolGroupId);

      expect(result.performanceMetrics).toBeDefined();
      expect(result.performanceMetrics.panLatency).toBeTypeOf('number');
      expect(result.performanceMetrics.panLatency).toBeGreaterThan(0);
      expect(result.performanceMetrics.smoothnessScore).toBeTypeOf('number');
      expect(result.performanceMetrics.smoothnessScore).toBeGreaterThanOrEqual(0);
      expect(result.performanceMetrics.smoothnessScore).toBeLessThanOrEqual(100);
    });

    it('should validate performance metric names', async () => {
      const config = {
        toolType: ToolType.PAN,
        toolClass: cornerstoneTools.PanTool,
        supportsTouch: false,
        supportsKeyboard: false,
        supportsMouse: false,
        defaultBindings: [] as const,
        gestureTypes: [] as const,
        performanceMetrics: ['invalidMetric', 'maliciousScript'] as const,
      };

      const result = await compatibility.verifyNavigationTool(config, testToolGroupId);
      expect(result.performanceOptimized).toBe(false);
    });

    it('should measure all expected performance metrics', async () => {
      const config = {
        toolType: ToolType.ZOOM,
        toolClass: cornerstoneTools.ZoomTool,
        supportsTouch: false,
        supportsKeyboard: false,
        supportsMouse: false,
        defaultBindings: [] as const,
        gestureTypes: [] as const,
        performanceMetrics: ['zoomLatency', 'renderingFPS', 'memoryUsage'] as const,
      };

      const result = await compatibility.verifyNavigationTool(config, testToolGroupId);

      const metrics = result.performanceMetrics;
      expect(metrics.zoomLatency).toBeGreaterThan(0);
      expect(metrics.renderingFPS).toBeGreaterThan(0);
      expect(metrics.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('Results Management', () => {
    it('should store and retrieve navigation results', async () => {
      await compatibility.verifyAllNavigationTools(testToolGroupId);

      const panResult = compatibility.getNavigationResult(testToolGroupId, ToolType.PAN);
      expect(panResult).toBeDefined();
      expect(panResult?.toolType).toBe(ToolType.PAN);

      const allResults = compatibility.getAllNavigationResults();
      expect(allResults.length).toBe(4);
    });

    it('should clear results successfully', async () => {
      await compatibility.verifyAllNavigationTools(testToolGroupId);

      let allResults = compatibility.getAllNavigationResults();
      expect(allResults.length).toBe(4);

      compatibility.clearResults();

      allResults = compatibility.getAllNavigationResults();
      expect(allResults.length).toBe(0);
    });
  });

  describe('Report Generation', () => {
    it('should generate comprehensive navigation report', async () => {
      const results = await compatibility.verifyAllNavigationTools(testToolGroupId);
      const report = compatibility.generateNavigationReport(results);

      expect(report).toContain('Navigation Tool Compatibility Report');
      expect(report).toContain('Total Tools Tested:');
      expect(report).toContain('Individual Tool Results');
      expect(report).toContain('Touch Gesture Support');
      expect(report).toContain('Keyboard Shortcut Support');
      expect(report).toContain('Mouse Interaction Support');
      expect(report).toContain('Performance Metrics');
      expect(report).toContain('Pan Latency');
      expect(report).toContain('Zoom Latency');
      expect(report).toContain('Rendering FPS');
      expect(report).toContain('Memory Usage');
      expect(report).toContain('Smoothness Score');
    });

    it('should include error information in report', async () => {
      // Force an error by using invalid tool group
      vi.mocked(cornerstoneTools.ToolGroupManager.getToolGroup).mockReturnValue(null);

      const results = await compatibility.verifyAllNavigationTools('invalid-group');
      const report = compatibility.generateNavigationReport(results);

      expect(report).toContain('FAIL');
    });

    it('should format performance metrics correctly in report', async () => {
      const results = await compatibility.verifyAllNavigationTools(testToolGroupId);
      const report = compatibility.generateNavigationReport(results);

      // Check that metrics are formatted with decimal places
      expect(report).toMatch(/Pan Latency: \d+\.\d+ms/);
      expect(report).toMatch(/Zoom Latency: \d+\.\d+ms/);
      expect(report).toMatch(/Rendering FPS: \d+\.\d+/);
      expect(report).toMatch(/Memory Usage: \d+\.\d+MB/);
      expect(report).toMatch(/Smoothness Score: \d+\.\d+\/100/);
    });
  });

  describe('Utility Functions', () => {
    it('should verify all navigation tools using utility function', async () => {
      const results = await verifyAllNavigationTools(testToolGroupId);

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(4);
    });

    it('should verify single navigation tool using utility function', async () => {
      const result = await verifyNavigationTool(ToolType.PAN, testToolGroupId);

      expect(result).toBeDefined();
      expect(result?.toolType).toBe(ToolType.PAN);
    });

    it('should return null for unknown tool type in utility function', async () => {
      const result = await verifyNavigationTool('unknownTool' as ToolType, testToolGroupId);

      expect(result).toBeNull();
    });
  });

  describe('Performance Tests', () => {
    it('should complete verification within reasonable time', async () => {
      const startTime = performance.now();

      await compatibility.verifyAllNavigationTools(testToolGroupId);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within 5 seconds (generous timeout for CI)
      expect(duration).toBeLessThan(5000);
    });

    it('should measure gesture test response times', async () => {
      const config = {
        toolType: ToolType.PAN,
        toolClass: cornerstoneTools.PanTool,
        supportsTouch: true,
        supportsKeyboard: false,
        supportsMouse: false,
        defaultBindings: [] as const,
        gestureTypes: ['drag', 'flick'] as const,
        performanceMetrics: [] as const,
      };

      const result = await compatibility.verifyNavigationTool(config, testToolGroupId);

      result.gestureTests.forEach(test => {
        expect(test.responseTime).toBeTypeOf('number');
        expect(test.responseTime).toBeGreaterThanOrEqual(0);
        expect(test.responseTime).toBeLessThan(1000); // Should be fast
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing tool class gracefully', async () => {
      const config = {
        toolType: ToolType.PAN,
        toolClass: null, // Missing tool class
        supportsTouch: true,
        supportsKeyboard: false,
        supportsMouse: false,
        defaultBindings: [] as const,
        gestureTypes: [] as const,
        performanceMetrics: [] as const,
      };

      const result = await compatibility.verifyNavigationTool(config, testToolGroupId);

      expect(result.verificationPassed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle tool group errors gracefully', async () => {
      vi.mocked(cornerstoneTools.ToolGroupManager.getToolGroup).mockImplementation(() => {
        throw new Error('Tool group access failed');
      });

      const results = await compatibility.verifyAllNavigationTools(testToolGroupId);

      // Should still return results with errors
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(4);
    });

    it('should handle viewport state validation errors', async () => {
      // Mock tool group to return null for viewport state test
      mockToolGroup.getViewportIds.mockReturnValue([]);

      const results = await compatibility.verifyAllNavigationTools(testToolGroupId);

      // Should still return results
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(4);
    });
  });

  describe('Keyboard Support Validation', () => {
    it('should validate keyboard support correctly', async () => {
      const config = {
        toolType: ToolType.STACK_SCROLL,
        toolClass: cornerstoneTools.StackScrollTool,
        supportsTouch: false,
        supportsKeyboard: true,
        supportsMouse: false,
        defaultBindings: [] as const,
        gestureTypes: ['keyArrows'] as const, // Keyboard-related gesture
        performanceMetrics: [] as const,
      };

      const result = await compatibility.verifyNavigationTool(config, testToolGroupId);
      expect(result.keyboardShortcutSupport).toBe(true);
    });

    it('should handle tools without keyboard support', async () => {
      const config = {
        toolType: ToolType.PAN,
        toolClass: cornerstoneTools.PanTool,
        supportsTouch: true,
        supportsKeyboard: false, // No keyboard support
        supportsMouse: true,
        defaultBindings: [{ button: cornerstoneTools.Enums.MouseBindings.Primary }] as const,
        gestureTypes: ['drag'] as const, // Non-keyboard gesture
        performanceMetrics: [] as const,
      };

      const result = await compatibility.verifyNavigationTool(config, testToolGroupId);
      expect(result.keyboardShortcutSupport).toBe(true); // Should be true since no keyboard support is claimed
    });
  });
});
