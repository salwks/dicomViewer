/**
 * Measurement Tool Compatibility Tests
 * Comprehensive test suite for measurement tool v3 API compatibility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as cornerstoneTools from '@cornerstonejs/tools';
import {
  MeasurementToolCompatibility,
  MeasurementVerificationResult,
  measurementToolCompatibility,
  verifyAllMeasurementTools,
  verifyMeasurementTool,
} from '../services/MeasurementToolCompatibility';
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
  LengthTool: {
    toolName: 'Length',
    configuration: {},
    supportedInteractionTypes: ['mouse', 'touch'],
  },
  BidirectionalTool: {
    toolName: 'Bidirectional',
    configuration: {},
    supportedInteractionTypes: ['mouse', 'touch'],
  },
  RectangleROITool: {
    toolName: 'RectangleROI',
    configuration: {},
    supportedInteractionTypes: ['mouse', 'touch'],
  },
  EllipticalROITool: {
    toolName: 'EllipticalROI',
    configuration: {},
    supportedInteractionTypes: ['mouse', 'touch'],
  },
  AngleTool: {
    toolName: 'Angle',
    configuration: {},
    supportedInteractionTypes: ['mouse', 'touch'],
  },
  ProbeTool: {
    toolName: 'Probe',
    configuration: {},
    supportedInteractionTypes: ['mouse', 'touch'],
  },
  HeightTool: {
    toolName: 'Height',
    configuration: {},
    supportedInteractionTypes: ['mouse', 'touch'],
  },
  CobbAngleTool: {
    toolName: 'CobbAngle',
    configuration: {},
    supportedInteractionTypes: ['mouse', 'touch'],
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

describe('MeasurementToolCompatibility', () => {
  let compatibility: MeasurementToolCompatibility;
  let mockToolGroup: any;
  const testToolGroupId = 'test-tool-group';

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

    compatibility = new MeasurementToolCompatibility();
  });

  afterEach(() => {
    compatibility.clearResults();
  });

  describe('Constructor', () => {
    it('should initialize with default verification framework', () => {
      const instance = new MeasurementToolCompatibility();
      expect(instance).toBeInstanceOf(MeasurementToolCompatibility);
    });
  });

  describe('verifyAllMeasurementTools', () => {
    it('should verify all measurement tools successfully', async () => {
      const results = await compatibility.verifyAllMeasurementTools(testToolGroupId);

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);

      // Check that all measurement tools are included
      const toolTypes = results.map(r => r.toolType);
      expect(toolTypes).toContain(ToolType.LENGTH);
      expect(toolTypes).toContain(ToolType.ANGLE);
      expect(toolTypes).toContain(ToolType.RECTANGLE_ROI);
      expect(toolTypes).toContain(ToolType.PROBE);
    });

    it('should handle tool group not found gracefully', async () => {
      vi.mocked(cornerstoneTools.ToolGroupManager.getToolGroup).mockReturnValue(null);

      const results = await compatibility.verifyAllMeasurementTools('invalid-group');

      // Should still return results, but they may have errors
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should store results in internal map', async () => {
      await compatibility.verifyAllMeasurementTools(testToolGroupId);

      const lengthResult = compatibility.getMeasurementResult(testToolGroupId, ToolType.LENGTH);
      expect(lengthResult).toBeDefined();
      expect(lengthResult?.toolType).toBe(ToolType.LENGTH);
    });
  });

  describe('verifyMeasurementTool', () => {
    it('should verify length tool compatibility', async () => {
      const config = {
        toolType: ToolType.LENGTH,
        toolClass: cornerstoneTools.LengthTool,
        expectedPrecision: 0.1,
        supportedUnits: ['mm', 'cm', 'px'] as const,
        requiresCalibration: true,
        annotationProperties: ['length', 'unit', 'handles', 'textBox'] as const,
      };

      const result = await compatibility.verifyMeasurementTool(config, testToolGroupId);

      expect(result).toBeDefined();
      expect(result.toolType).toBe(ToolType.LENGTH);
      expect(result.toolName).toBe('Length');
      expect(result.measurementAccuracy).toBeGreaterThan(0);
      expect(result.unitsSupported).toEqual(['mm', 'cm', 'px']);
      expect(result.calibrationStatus).toBe('required');
      expect(result.annotationDataValid).toBe(true);
      expect(result.interactionTests).toBeInstanceOf(Array);
      expect(result.interactionTests.length).toBeGreaterThan(0);
    });

    it('should verify angle tool compatibility', async () => {
      const config = {
        toolType: ToolType.ANGLE,
        toolClass: cornerstoneTools.AngleTool,
        expectedPrecision: 0.1,
        supportedUnits: ['degrees', 'radians'] as const,
        requiresCalibration: false,
        annotationProperties: ['angle', 'unit', 'handles', 'textBox'] as const,
      };

      const result = await compatibility.verifyMeasurementTool(config, testToolGroupId);

      expect(result).toBeDefined();
      expect(result.toolType).toBe(ToolType.ANGLE);
      expect(result.toolName).toBe('Angle');
      expect(result.calibrationStatus).toBe('not_needed');
      expect(result.unitsSupported).toEqual(['degrees', 'radians']);
    });

    it('should verify rectangle ROI tool compatibility', async () => {
      const config = {
        toolType: ToolType.RECTANGLE_ROI,
        toolClass: cornerstoneTools.RectangleROITool,
        expectedPrecision: 0.01,
        supportedUnits: ['mm²', 'cm²', 'px²'] as const,
        requiresCalibration: true,
        annotationProperties: ['area', 'meanStdDev', 'unit', 'handles', 'textBox'] as const,
      };

      const result = await compatibility.verifyMeasurementTool(config, testToolGroupId);

      expect(result).toBeDefined();
      expect(result.toolType).toBe(ToolType.RECTANGLE_ROI);
      expect(result.toolName).toBe('RectangleROI');
      expect(result.unitsSupported).toEqual(['mm²', 'cm²', 'px²']);
    });
  });

  describe('Measurement Accuracy Tests', () => {
    it('should calculate measurement accuracy based on precision', async () => {
      const highPrecisionConfig = {
        toolType: ToolType.LENGTH,
        toolClass: cornerstoneTools.LengthTool,
        expectedPrecision: 0.01, // High precision
        supportedUnits: ['mm'] as const,
        requiresCalibration: true,
        annotationProperties: ['length'] as const,
      };

      const lowPrecisionConfig = {
        toolType: ToolType.PROBE,
        toolClass: cornerstoneTools.ProbeTool,
        expectedPrecision: 1.0, // Low precision
        supportedUnits: ['HU'] as const,
        requiresCalibration: false,
        annotationProperties: ['value'] as const,
      };

      const highPrecisionResult = await compatibility.verifyMeasurementTool(highPrecisionConfig, testToolGroupId);
      const lowPrecisionResult = await compatibility.verifyMeasurementTool(lowPrecisionConfig, testToolGroupId);

      expect(highPrecisionResult.measurementAccuracy).toBeGreaterThan(lowPrecisionResult.measurementAccuracy);
    });
  });

  describe('Interaction Tests', () => {
    it('should perform all required interaction tests', async () => {
      const config = {
        toolType: ToolType.LENGTH,
        toolClass: cornerstoneTools.LengthTool,
        expectedPrecision: 0.1,
        supportedUnits: ['mm'] as const,
        requiresCalibration: true,
        annotationProperties: ['length'] as const,
      };

      const result = await compatibility.verifyMeasurementTool(config, testToolGroupId);

      expect(result.interactionTests).toHaveLength(4);

      const testNames = result.interactionTests.map(t => t.testName);
      expect(testNames).toContain('Tool Activation');
      expect(testNames).toContain('Annotation Creation');
      expect(testNames).toContain('Annotation Modification');
      expect(testNames).toContain('Annotation Deletion');

      // All tests should have duration measurements
      result.interactionTests.forEach(test => {
        expect(test.duration).toBeTypeOf('number');
        expect(test.duration).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle tool activation failure gracefully', async () => {
      // Mock tool activation to throw error
      mockToolGroup.setToolActive.mockImplementation(() => {
        throw new Error('Tool activation failed');
      });

      const config = {
        toolType: ToolType.LENGTH,
        toolClass: cornerstoneTools.LengthTool,
        expectedPrecision: 0.1,
        supportedUnits: ['mm'] as const,
        requiresCalibration: true,
        annotationProperties: ['length'] as const,
      };

      const result = await compatibility.verifyMeasurementTool(config, testToolGroupId);

      const activationTest = result.interactionTests.find(t => t.testName === 'Tool Activation');
      expect(activationTest).toBeDefined();
      expect(activationTest?.passed).toBe(false);
      expect(activationTest?.errorMessage).toBe('Tool activation failed');
    });
  });

  describe('Annotation Data Validation', () => {
    it('should validate annotation properties for length tool', async () => {
      const config = {
        toolType: ToolType.LENGTH,
        toolClass: cornerstoneTools.LengthTool,
        expectedPrecision: 0.1,
        supportedUnits: ['mm'] as const,
        requiresCalibration: true,
        annotationProperties: ['length', 'unit', 'handles', 'textBox'] as const,
      };

      const result = await compatibility.verifyMeasurementTool(config, testToolGroupId);
      expect(result.annotationDataValid).toBe(true);
    });

    it('should reject invalid annotation properties', async () => {
      const config = {
        toolType: ToolType.LENGTH,
        toolClass: cornerstoneTools.LengthTool,
        expectedPrecision: 0.1,
        supportedUnits: ['mm'] as const,
        requiresCalibration: true,
        annotationProperties: ['invalidProperty', 'maliciousScript'] as const,
      };

      const result = await compatibility.verifyMeasurementTool(config, testToolGroupId);
      expect(result.annotationDataValid).toBe(false);
    });

    it('should validate required properties for specific tool types', async () => {
      // Length tool without required 'length' property
      const invalidConfig = {
        toolType: ToolType.LENGTH,
        toolClass: cornerstoneTools.LengthTool,
        expectedPrecision: 0.1,
        supportedUnits: ['mm'] as const,
        requiresCalibration: true,
        annotationProperties: ['unit', 'handles'] as const, // Missing 'length'
      };

      const result = await compatibility.verifyMeasurementTool(invalidConfig, testToolGroupId);
      expect(result.annotationDataValid).toBe(false);
    });
  });

  describe('Results Management', () => {
    it('should store and retrieve measurement results', async () => {
      await compatibility.verifyAllMeasurementTools(testToolGroupId);

      const lengthResult = compatibility.getMeasurementResult(testToolGroupId, ToolType.LENGTH);
      expect(lengthResult).toBeDefined();
      expect(lengthResult?.toolType).toBe(ToolType.LENGTH);

      const allResults = compatibility.getAllMeasurementResults();
      expect(allResults.length).toBeGreaterThan(0);
    });

    it('should clear results successfully', async () => {
      await compatibility.verifyAllMeasurementTools(testToolGroupId);

      let allResults = compatibility.getAllMeasurementResults();
      expect(allResults.length).toBeGreaterThan(0);

      compatibility.clearResults();

      allResults = compatibility.getAllMeasurementResults();
      expect(allResults.length).toBe(0);
    });
  });

  describe('Report Generation', () => {
    it('should generate comprehensive measurement report', async () => {
      const results = await compatibility.verifyAllMeasurementTools(testToolGroupId);
      const report = compatibility.generateMeasurementReport(results);

      expect(report).toContain('Measurement Tool Compatibility Report');
      expect(report).toContain('Total Tools Tested:');
      expect(report).toContain('Individual Tool Results');
      expect(report).toContain('Measurement Accuracy');
      expect(report).toContain('Units Supported');
      expect(report).toContain('Calibration');
      expect(report).toContain('Interaction Tests');
    });

    it('should include error and warning information in report', async () => {
      // Force an error by using invalid tool group
      vi.mocked(cornerstoneTools.ToolGroupManager.getToolGroup).mockReturnValue(null);

      const results = await compatibility.verifyAllMeasurementTools('invalid-group');
      const report = compatibility.generateMeasurementReport(results);

      expect(report).toContain('FAIL');
    });
  });

  describe('Utility Functions', () => {
    it('should verify all measurement tools using utility function', async () => {
      const results = await verifyAllMeasurementTools(testToolGroupId);

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should verify single measurement tool using utility function', async () => {
      const result = await verifyMeasurementTool(ToolType.LENGTH, testToolGroupId);

      expect(result).toBeDefined();
      expect(result?.toolType).toBe(ToolType.LENGTH);
    });

    it('should return null for unknown tool type in utility function', async () => {
      const result = await verifyMeasurementTool('unknownTool' as ToolType, testToolGroupId);

      expect(result).toBeNull();
    });
  });

  describe('Performance Tests', () => {
    it('should complete verification within reasonable time', async () => {
      const startTime = performance.now();

      await compatibility.verifyAllMeasurementTools(testToolGroupId);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within 5 seconds (generous timeout for CI)
      expect(duration).toBeLessThan(5000);
    });

    it('should measure interaction test durations', async () => {
      const config = {
        toolType: ToolType.LENGTH,
        toolClass: cornerstoneTools.LengthTool,
        expectedPrecision: 0.1,
        supportedUnits: ['mm'] as const,
        requiresCalibration: true,
        annotationProperties: ['length'] as const,
      };

      const result = await compatibility.verifyMeasurementTool(config, testToolGroupId);

      result.interactionTests.forEach(test => {
        expect(test.duration).toBeTypeOf('number');
        expect(test.duration).toBeGreaterThanOrEqual(0);
        expect(test.duration).toBeLessThan(1000); // Should be fast
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing tool class gracefully', async () => {
      const config = {
        toolType: ToolType.LENGTH,
        toolClass: null, // Missing tool class
        expectedPrecision: 0.1,
        supportedUnits: ['mm'] as const,
        requiresCalibration: true,
        annotationProperties: ['length'] as const,
      };

      const result = await compatibility.verifyMeasurementTool(config, testToolGroupId);

      expect(result.verificationPassed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle tool group errors gracefully', async () => {
      vi.mocked(cornerstoneTools.ToolGroupManager.getToolGroup).mockImplementation(() => {
        throw new Error('Tool group access failed');
      });

      const results = await compatibility.verifyAllMeasurementTools(testToolGroupId);

      // Should still return results with errors
      expect(results).toBeInstanceOf(Array);
      results.forEach(result => {
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });
});
