/**
 * Measurement System Unified Entry Point
 * Provides both new modular architecture and legacy compatibility
 */

// Export new modular architecture
export * from './interfaces/MeasurementTypes';

// Export calculators
export * from './calculators/LinearCalculator';
export * from './calculators/AreaCalculator';
export * from './calculators/VolumeCalculator';
export * from './calculators/StatisticalCalculator';

// Export managers
export * from './managers/CalibrationManager';
export * from './managers/ValidationManager';

// Export exporters
export * from './exporters/JSONExporter';
export * from './exporters/CSVExporter';
export * from './exporters/PDFExporter';

// Export orchestrator
export * from './MeasurementOrchestrator';

// Legacy compatibility exports
import { measurementOrchestrator, MeasurementOperation, MeasurementRequest } from './MeasurementOrchestrator';
import {
  Point3,
  Point2,
  PixelSpacing,
  MeasurementResult,
  StatisticalData,
  CalibrationData,
  ImageData,
  ROI,
  Segmentation,
} from './interfaces/MeasurementTypes';

/**
 * Legacy MeasurementCalculator API for backward compatibility
 *
 * This class provides the same API as the original MeasurementCalculator
 * but delegates to the new modular architecture internally.
 */
export class MeasurementCalculator {
  private static instance: MeasurementCalculator;
  private orchestrator = measurementOrchestrator;

  private constructor() {
    // Private constructor for singleton pattern
  }

  static getInstance(): MeasurementCalculator {
    if (!MeasurementCalculator.instance) {
      MeasurementCalculator.instance = new MeasurementCalculator();
    }
    return MeasurementCalculator.instance;
  }

  /**
   * Calculate linear distance between points
   * @deprecated Use measurementOrchestrator.measureLength() instead
   */
  calculateLength(
    points: Point3[],
    pixelSpacing: PixelSpacing,
    imageId?: string,
  ): MeasurementResult {
    return this.orchestrator.measureLength(points, pixelSpacing, imageId);
  }

  /**
   * Calculate angle between three points
   * @deprecated Use measurementOrchestrator.measureAngle() instead
   */
  calculateAngle(
    points: [Point3, Point3, Point3],
    pixelSpacing: PixelSpacing,
    imageId?: string,
  ): MeasurementResult {
    return this.orchestrator.measureAngle(points, pixelSpacing, imageId);
  }

  /**
   * Calculate area of a contour/ROI
   * @deprecated Use measurementOrchestrator.measureArea() instead
   */
  calculateArea(
    contour: Point3[],
    pixelSpacing: PixelSpacing,
    imageId?: string,
  ): MeasurementResult {
    return this.orchestrator.measureArea(contour, pixelSpacing, imageId);
  }

  /**
   * Calculate volume from segmentation data
   * @deprecated Use measurementOrchestrator.performMeasurement() with VOLUME operation
   */
  calculateVolume(segmentation: Segmentation): MeasurementResult {
    const request: MeasurementRequest = {
      operation: MeasurementOperation.VOLUME,
      pixelSpacing: segmentation.pixelSpacing,
      segmentation,
    };

    // Use sync version for legacy compatibility
    return this.orchestrator.performMeasurementSync(request);
  }

  /**
   * Analyze ROI statistics
   * @deprecated Use measurementOrchestrator.analyzeROI() instead
   */
  analyzeROI(roi: ROI, imageData: ImageData): StatisticalData {
    const result = this.orchestrator.analyzeROI(roi, imageData);

    // Return statistics directly for legacy compatibility
    if (result.statistics) {
      return result.statistics;
    }

    // Create minimal statistical data if not available
    return {
      mean: result.value,
      median: result.value,
      standardDeviation: 0,
      minimum: result.value,
      maximum: result.value,
      count: 1,
      percentile25: result.value,
      percentile75: result.value,
      skewness: 0,
      kurtosis: 0,
      histogram: {
        bins: [result.value],
        counts: [1],
        binWidth: 0,
      },
    };
  }

  /**
   * Get measurement history
   * @deprecated Use measurementOrchestrator.getPerformanceMetrics() instead
   */
  getMeasurementHistory(): MeasurementResult[] {
    // Legacy method - return empty array as history is now managed differently
    console.warn('getMeasurementHistory() is deprecated. Use measurementOrchestrator.getPerformanceMetrics() instead.');
    return [];
  }

  /**
   * Clear measurement history
   * @deprecated History management has changed in new architecture
   */
  clearMeasurementHistory(): void {
    console.warn('clearMeasurementHistory() is deprecated. History management has changed in new architecture.');
  }

  /**
   * Set calibration data manually
   * @deprecated Use measurementOrchestrator.setCalibration() instead
   */
  setCalibration(imageId: string, calibration: CalibrationData): void {
    this.orchestrator.setCalibration(imageId, calibration.pixelSpacing, calibration.calibrationSource);
  }

  /**
   * Get calibration info
   * @deprecated Use measurementOrchestrator.getCalibration() instead
   */
  getCalibration(imageId: string): CalibrationData | undefined {
    const calibration = this.orchestrator.getCalibration(imageId);
    if (!calibration) return undefined;

    // Convert to legacy format
    return {
      pixelSpacing: calibration.pixelSpacing,
      accuracy: calibration.accuracy,
      calibrationSource: calibration.calibrationSource,
      lastCalibrated: calibration.lastCalibrated,
    };
  }

  /**
   * Export measurements to JSON
   * @deprecated Use measurementOrchestrator.exportMeasurements() instead
   */
  exportMeasurements(): string {
    console.warn('exportMeasurements() is deprecated. Use measurementOrchestrator.exportMeasurements() instead.');
    return JSON.stringify({
      measurements: [],
      calibrations: {},
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
    }, null, 2);
  }

  /**
   * Import measurements from JSON
   * @deprecated Import functionality has changed in new architecture
   */
  importMeasurements(jsonData: string): void {
    console.warn('importMeasurements() is deprecated. Import functionality has changed in new architecture.');
    console.log('Data to import:', `${jsonData.substring(0, 100)}...`);
  }
}

// Export legacy singleton instance for backward compatibility
export const measurementCalculator = MeasurementCalculator.getInstance();

/**
 * Modern API exports (recommended for new code)
 */
export {
  // Main orchestrator
  measurementOrchestrator,

  // Enums and types
  MeasurementOperation,
  type MeasurementRequest,

  // Legacy compatibility types
  type Point3,
  type Point2,
  type PixelSpacing,
  type MeasurementResult,
  type StatisticalData,
  type CalibrationData,
  type ImageData,
  type ROI,
  type Segmentation,
};

/**
 * Factory functions for creating calculator instances
 * (For advanced users who want to manage instances manually)
 */
export {
  createLinearCalculator,
  createAreaCalculator,
  createVolumeCalculator,
  createStatisticalCalculator,
} from './calculators';

// Re-export all calculator interfaces
export type { ICalculator } from './interfaces/MeasurementTypes';

/**
 * Convenience function to migrate from legacy to new API
 */
export function migrateLegacyUsage(): {
  recommendations: string[];
  examples: Record<string, { legacy: string; modern: string }>;
  } {
  return {
    recommendations: [
      'Use measurementOrchestrator instead of measurementCalculator',
      'Use performMeasurement() for comprehensive results with validation',
      'Use specific measure* methods for simple operations',
      'Use exportMeasurements() with format-specific options',
      'Use validation and quality metrics for better measurement reliability',
    ],
    examples: {
      'Length Measurement': {
        legacy: 'measurementCalculator.calculateLength(points, pixelSpacing)',
        modern: 'measurementOrchestrator.measureLength(points, pixelSpacing)',
      },
      'Area Measurement': {
        legacy: 'measurementCalculator.calculateArea(contour, pixelSpacing)',
        modern: 'measurementOrchestrator.measureArea(contour, pixelSpacing)',
      },
      'Comprehensive Measurement': {
        legacy: 'measurementCalculator.calculateLength(points, pixelSpacing)',
        modern: 'measurementOrchestrator.performMeasurement({ operation: MeasurementOperation.LENGTH, points, pixelSpacing })',
      },
      'Export to JSON': {
        legacy: 'measurementCalculator.exportMeasurements()',
        modern: 'measurementOrchestrator.exportMeasurements({ measurements, format: "json", options: { prettyPrint: true } })',
      },
    },
  };
}

/**
 * System information
 */
export function getSystemInfo(): {
  version: string;
  architecture: string;
  components: string[];
  legacySupport: boolean;
  } {
  return {
    version: '2.0.0',
    architecture: 'modular',
    components: [
      'LinearCalculator',
      'AreaCalculator',
      'VolumeCalculator',
      'StatisticalCalculator',
      'CalibrationManager',
      'ValidationManager',
      'JSONExporter',
      'CSVExporter',
      'PDFExporter',
      'MeasurementOrchestrator',
    ],
    legacySupport: true,
  };
}
