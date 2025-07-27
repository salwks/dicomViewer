/**
 * Measurement Orchestrator
 * Coordinates all measurement components and provides unified API
 */

import {
  Point3,
  PixelSpacing,
  MeasurementResult,
  ImageData,
  ROI,
  Segmentation,
  measurementLogger,
} from './interfaces/MeasurementTypes';

// Calculator imports
import { LinearCalculator, createLinearCalculator } from './calculators/LinearCalculator';
import { AreaCalculator, createAreaCalculator } from './calculators/AreaCalculator';
import { VolumeCalculator, createVolumeCalculator } from './calculators/VolumeCalculator';
import { StatisticalCalculator, createStatisticalCalculator } from './calculators/StatisticalCalculator';

// Manager imports
import { CalibrationManager, calibrationManager } from './managers/CalibrationManager';
import {
  ValidationManager,
  validationManager,
  ValidationContext,
  MeasurementValidationResult,
  QualityMetrics,
} from './managers/ValidationManager';

// Exporter imports
import { JSONExporter, jsonExporter, JSONExportOptions, JSONExportResult } from './exporters/JSONExporter';
import { CSVExporter, csvExporter, CSVExportOptions, CSVExportResult } from './exporters/CSVExporter';
import { PDFExporter, pdfExporter, PDFExportOptions, PDFExportResult } from './exporters/PDFExporter';

/**
 * Measurement operation types
 */
export enum MeasurementOperation {
  LENGTH = 'length',
  ANGLE = 'angle',
  AREA = 'area',
  VOLUME = 'volume',
  ROI_ANALYSIS = 'roi-analysis',
}

/**
 * Measurement request
 */
export interface MeasurementRequest {
  /** Operation type */
  operation: MeasurementOperation;
  /** Input points */
  points?: Point3[];
  /** Pixel spacing */
  pixelSpacing: PixelSpacing;
  /** Image ID for context */
  imageId?: string;
  /** ROI data for statistical analysis */
  roi?: ROI;
  /** Image data for ROI analysis */
  imageData?: ImageData;
  /** Segmentation data for volume calculation */
  segmentation?: Segmentation;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Comprehensive measurement result with validation and quality metrics
 */
export interface ComprehensiveMeasurementResult {
  /** Basic measurement result */
  result: MeasurementResult;
  /** Validation results */
  validation: MeasurementValidationResult;
  /** Quality metrics */
  quality: QualityMetrics;
  /** Processing metadata */
  processing: {
    processingTime: number;
    calculatorUsed: string;
    orchestratorVersion: string;
  };
}

/**
 * Export request
 */
export interface ExportRequest {
  /** Measurements to export */
  measurements: Array<{ id: string; type: string; result?: MeasurementResult }>;
  /** Export format */
  format: 'json' | 'csv' | 'pdf';
  /** Format-specific options */
  options?: JSONExportOptions | CSVExportOptions | PDFExportOptions;
}

/**
 * Measurement system status
 */
export interface SystemStatus {
  /** Overall system health */
  healthy: boolean;
  /** Component statuses */
  components: {
    calculators: Record<string, boolean>;
    managers: Record<string, boolean>;
    exporters: Record<string, boolean>;
  };
  /** Performance metrics */
  performance: {
    averageProcessingTime: number;
    totalMeasurements: number;
    successRate: number;
  };
  /** Last health check */
  lastHealthCheck: Date;
}

/**
 * Measurement Orchestrator
 * Central coordinator for all measurement operations
 */
export class MeasurementOrchestrator {
  private static instance: MeasurementOrchestrator;

  // Calculators
  private linearCalculator!: LinearCalculator;
  private areaCalculator!: AreaCalculator;
  private volumeCalculator!: VolumeCalculator;
  private statisticalCalculator!: StatisticalCalculator;

  // Managers
  private calibrationManager!: CalibrationManager;
  private validationManager!: ValidationManager;

  // Exporters
  private jsonExporter!: JSONExporter;
  private csvExporter!: CSVExporter;
  private pdfExporter!: PDFExporter;

  // Performance tracking
  private processingTimes: number[] = [];
  private totalOperations = 0;
  private successfulOperations = 0;

  private constructor() {
    // Initialize components synchronously for immediate availability
    this.initializeComponentsSync();
    measurementLogger.info('Measurement Orchestrator initialized', 'MeasurementOrchestrator');
  }

  static getInstance(): MeasurementOrchestrator {
    if (!MeasurementOrchestrator.instance) {
      MeasurementOrchestrator.instance = new MeasurementOrchestrator();
    }
    return MeasurementOrchestrator.instance;
  }

  /**
   * Initialize all components synchronously for immediate availability
   */
  private initializeComponentsSync(): void {
    try {
      // Initialize calculators
      this.linearCalculator = createLinearCalculator();
      this.areaCalculator = createAreaCalculator();
      this.volumeCalculator = createVolumeCalculator();
      this.statisticalCalculator = createStatisticalCalculator();

      // Initialize managers
      this.calibrationManager = calibrationManager;
      this.validationManager = validationManager;

      // Initialize exporters
      this.jsonExporter = jsonExporter;
      this.csvExporter = csvExporter;
      this.pdfExporter = pdfExporter;

      measurementLogger.info('All measurement components initialized successfully', 'MeasurementOrchestrator');
    } catch (error) {
      measurementLogger.error('Failed to initialize measurement components', 'MeasurementOrchestrator', {
        error: error instanceof Error ? error.message : 'Unknown error',
      }, error instanceof Error ? error : undefined);
      throw error;
    }
  }


  /* =============================================================================
   * MAIN MEASUREMENT OPERATIONS
   * ============================================================================= */

  /**
   * Perform comprehensive measurement with validation and quality assessment
   */
  async performMeasurement(request: MeasurementRequest): Promise<ComprehensiveMeasurementResult> {
    const startTime = performance.now();
    this.totalOperations++;

    try {
      // Validate request
      this.validateRequest(request);

      // Get or create calibration
      const calibration = this.calibrationManager.getCalibrationWithFallback(request.imageId || 'default');

      // Use calibration override if provided, otherwise use from calibration manager
      const effectivePixelSpacing = request.pixelSpacing || calibration.pixelSpacing;

      // Perform the measurement
      let result: MeasurementResult;
      let calculatorUsed: string;

      switch (request.operation) {
        case MeasurementOperation.LENGTH:
          if (!request.points || request.points.length < 2) {
            throw new Error('Length measurement requires at least 2 points');
          }
          result = this.linearCalculator.calculateLength(request.points, effectivePixelSpacing, request.imageId);
          calculatorUsed = 'LinearCalculator';
          break;

        case MeasurementOperation.ANGLE:
          if (!request.points || request.points.length !== 3) {
            throw new Error('Angle measurement requires exactly 3 points');
          }
          result = this.linearCalculator.calculateAngle(
            [request.points[0], request.points[1], request.points[2]],
            effectivePixelSpacing,
            request.imageId,
          );
          calculatorUsed = 'LinearCalculator';
          break;

        case MeasurementOperation.AREA:
          if (!request.points || request.points.length < 3) {
            throw new Error('Area measurement requires at least 3 points');
          }
          result = this.areaCalculator.calculateArea(request.points, effectivePixelSpacing, request.imageId);
          calculatorUsed = 'AreaCalculator';
          break;

        case MeasurementOperation.VOLUME:
          if (!request.segmentation) {
            throw new Error('Volume measurement requires segmentation data');
          }
          result = this.volumeCalculator.calculateVolume(request.segmentation);
          calculatorUsed = 'VolumeCalculator';
          break;

        case MeasurementOperation.ROI_ANALYSIS:
          if (!request.roi || !request.imageData) {
            throw new Error('ROI analysis requires ROI and image data');
          }
          result = this.statisticalCalculator.createROIAnalysisResult(request.roi, request.imageData, request.imageId);
          calculatorUsed = 'StatisticalCalculator';
          break;

        default:
          throw new Error(`Unsupported measurement operation: ${request.operation}`);
      }

      // Create validation context
      const validationContext: ValidationContext = {
        measurementType: request.operation,
        points: request.points,
        pixelSpacing: effectivePixelSpacing,
        imageData: request.imageData,
        result,
        metadata: request.metadata,
      };

      // Validate measurement
      const validation = this.validationManager.validateMeasurement(validationContext);

      // Assess quality
      const quality = this.validationManager.assessQuality(validationContext);

      // Calculate processing time
      const processingTime = performance.now() - startTime;
      this.processingTimes.push(processingTime);

      // Keep only last 1000 processing times for average calculation
      if (this.processingTimes.length > 1000) {
        this.processingTimes = this.processingTimes.slice(-1000);
      }

      this.successfulOperations++;

      const comprehensiveResult: ComprehensiveMeasurementResult = {
        result,
        validation,
        quality,
        processing: {
          processingTime,
          calculatorUsed,
          orchestratorVersion: '1.0.0',
        },
      };

      measurementLogger.info(`Measurement completed: ${request.operation}`, 'MeasurementOrchestrator', {
        operation: request.operation,
        value: result.value,
        unit: result.unit,
        confidence: result.confidence,
        validationScore: validation.score,
        qualityScore: quality.overallQuality,
        processingTime,
        calculatorUsed,
      });

      return comprehensiveResult;
    } catch (error) {
      const processingTime = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      measurementLogger.error(`Measurement failed: ${request.operation}`, 'MeasurementOrchestrator', {
        operation: request.operation,
        error: errorMessage,
        processingTime,
      }, error instanceof Error ? error : undefined);

      throw error;
    }
  }

  /**
   * Perform simple measurement (legacy compatibility)
   */
  measureLength(points: Point3[], pixelSpacing: PixelSpacing, imageId?: string): MeasurementResult {
    const request: MeasurementRequest = {
      operation: MeasurementOperation.LENGTH,
      points,
      pixelSpacing,
      imageId,
    };

    // For legacy compatibility, make this synchronous
    return this.performMeasurementSync(request);
  }

  /**
   * Perform angle measurement (legacy compatibility)
   */
  measureAngle(points: [Point3, Point3, Point3], pixelSpacing: PixelSpacing, imageId?: string): MeasurementResult {
    const request: MeasurementRequest = {
      operation: MeasurementOperation.ANGLE,
      points,
      pixelSpacing,
      imageId,
    };

    return this.performMeasurementSync(request);
  }

  /**
   * Perform area measurement (legacy compatibility)
   */
  measureArea(contour: Point3[], pixelSpacing: PixelSpacing, imageId?: string): MeasurementResult {
    const request: MeasurementRequest = {
      operation: MeasurementOperation.AREA,
      points: contour,
      pixelSpacing,
      imageId,
    };

    return this.performMeasurementSync(request);
  }

  /**
   * Analyze ROI (legacy compatibility)
   */
  analyzeROI(roi: ROI, imageData: ImageData, imageId?: string): MeasurementResult {
    const request: MeasurementRequest = {
      operation: MeasurementOperation.ROI_ANALYSIS,
      pixelSpacing: roi.pixelSpacing,
      roi,
      imageData,
      imageId,
    };

    return this.performMeasurementSync(request);
  }

  /**
   * Synchronous measurement for legacy compatibility
   */
  performMeasurementSync(request: MeasurementRequest): MeasurementResult {
    const startTime = performance.now();
    this.totalOperations++;

    try {
      // Validate request
      this.validateRequest(request);

      // Get or create calibration
      const calibration = this.calibrationManager.getCalibrationWithFallback(request.imageId || 'default');

      // Use calibration override if provided, otherwise use from calibration manager
      const effectivePixelSpacing = request.pixelSpacing || calibration.pixelSpacing;

      // Perform the measurement
      let result: MeasurementResult;

      switch (request.operation) {
        case MeasurementOperation.LENGTH:
          if (!request.points || request.points.length < 2) {
            throw new Error('Length measurement requires at least 2 points');
          }
          result = this.linearCalculator.calculateLength(request.points, effectivePixelSpacing, request.imageId);
          break;

        case MeasurementOperation.ANGLE:
          if (!request.points || request.points.length !== 3) {
            throw new Error('Angle measurement requires exactly 3 points');
          }
          result = this.linearCalculator.calculateAngle(
            [request.points[0], request.points[1], request.points[2]],
            effectivePixelSpacing,
            request.imageId,
          );
          break;

        case MeasurementOperation.AREA:
          if (!request.points || request.points.length < 3) {
            throw new Error('Area measurement requires at least 3 points');
          }
          result = this.areaCalculator.calculateArea(request.points, effectivePixelSpacing, request.imageId);
          break;

        case MeasurementOperation.VOLUME:
          if (!request.segmentation) {
            throw new Error('Volume measurement requires segmentation data');
          }
          result = this.volumeCalculator.calculateVolume(request.segmentation);
          break;

        case MeasurementOperation.ROI_ANALYSIS:
          if (!request.roi || !request.imageData) {
            throw new Error('ROI analysis requires ROI and image data');
          }
          result = this.statisticalCalculator.createROIAnalysisResult(request.roi, request.imageData, request.imageId);
          break;

        default:
          throw new Error(`Unsupported measurement operation: ${request.operation}`);
      }

      // Calculate processing time
      const processingTime = performance.now() - startTime;
      this.processingTimes.push(processingTime);

      // Keep only last 1000 processing times for average calculation
      if (this.processingTimes.length > 1000) {
        this.processingTimes = this.processingTimes.slice(-1000);
      }

      this.successfulOperations++;

      measurementLogger.info(`Measurement completed: ${request.operation}`, 'MeasurementOrchestrator', {
        operation: request.operation,
        value: result.value,
        unit: result.unit,
        confidence: result.confidence,
        processingTime,
      });

      return result;
    } catch (error) {
      const processingTime = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      measurementLogger.error(`Measurement failed: ${request.operation}`, 'MeasurementOrchestrator', {
        operation: request.operation,
        error: errorMessage,
        processingTime,
      }, error instanceof Error ? error : undefined);

      throw error;
    }
  }

  /* =============================================================================
   * EXPORT OPERATIONS
   * ============================================================================= */

  /**
   * Export measurements
   */
  async exportMeasurements(exportRequest: ExportRequest): Promise<JSONExportResult | CSVExportResult | PDFExportResult> {
    try {
      switch (exportRequest.format) {
        case 'json':
          return this.jsonExporter.exportMeasurements(
            exportRequest.measurements,
            exportRequest.options as JSONExportOptions,
          );

        case 'csv':
          return this.csvExporter.exportMeasurements(
            exportRequest.measurements,
            exportRequest.options as CSVExportOptions,
          );

        case 'pdf':
          return await this.pdfExporter.exportMeasurements(
            exportRequest.measurements,
            exportRequest.options as PDFExportOptions,
          );

        default:
          throw new Error(`Unsupported export format: ${exportRequest.format}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      measurementLogger.error(`Export failed: ${exportRequest.format}`, 'MeasurementOrchestrator', {
        format: exportRequest.format,
        measurementCount: exportRequest.measurements.length,
        error: errorMessage,
      }, error instanceof Error ? error : undefined);

      throw error;
    }
  }

  /* =============================================================================
   * CALIBRATION MANAGEMENT
   * ============================================================================= */

  /**
   * Set calibration for an image
   */
  setCalibration(imageId: string, pixelSpacing: PixelSpacing, source: 'dicom' | 'manual' | 'estimated' = 'manual'): void {
    this.calibrationManager.setCalibration(imageId, pixelSpacing, source);
  }

  /**
   * Get calibration for an image
   */
  getCalibration(imageId: string) {
    return this.calibrationManager.getCalibration(imageId);
  }

  /* =============================================================================
   * SYSTEM MONITORING
   * ============================================================================= */

  /**
   * Get system status
   */
  getSystemStatus(): SystemStatus {
    const avgProcessingTime = this.processingTimes.length > 0
      ? this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length
      : 0;

    const successRate = this.totalOperations > 0
      ? this.successfulOperations / this.totalOperations
      : 1;

    return {
      healthy: successRate > 0.95, // Consider healthy if success rate > 95%
      components: {
        calculators: {
          LinearCalculator: true, // Simplified - would check actual health
          AreaCalculator: true,
          VolumeCalculator: true,
          StatisticalCalculator: true,
        },
        managers: {
          CalibrationManager: true,
          ValidationManager: true,
        },
        exporters: {
          JSONExporter: true,
          CSVExporter: true,
          PDFExporter: false, // PDF is placeholder implementation
        },
      },
      performance: {
        averageProcessingTime: avgProcessingTime,
        totalMeasurements: this.totalOperations,
        successRate,
      },
      lastHealthCheck: new Date(),
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    averageProcessingTime: number;
    totalOperations: number;
    successfulOperations: number;
    successRate: number;
    recentProcessingTimes: number[];
    } {
    const avgProcessingTime = this.processingTimes.length > 0
      ? this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length
      : 0;

    return {
      averageProcessingTime: avgProcessingTime,
      totalOperations: this.totalOperations,
      successfulOperations: this.successfulOperations,
      successRate: this.totalOperations > 0 ? this.successfulOperations / this.totalOperations : 1,
      recentProcessingTimes: [...this.processingTimes.slice(-10)], // Last 10 measurements
    };
  }

  /* =============================================================================
   * UTILITY METHODS
   * ============================================================================= */

  /**
   * Validate measurement request
   */
  private validateRequest(request: MeasurementRequest): void {
    if (!request.operation) {
      throw new Error('Measurement operation is required');
    }

    if (!request.pixelSpacing && !request.imageId) {
      throw new Error('Either pixel spacing or image ID must be provided');
    }

    // Operation-specific validations
    switch (request.operation) {
      case MeasurementOperation.LENGTH:
        if (!request.points || request.points.length < 2) {
          throw new Error('Length measurement requires at least 2 points');
        }
        break;

      case MeasurementOperation.ANGLE:
        if (!request.points || request.points.length !== 3) {
          throw new Error('Angle measurement requires exactly 3 points');
        }
        break;

      case MeasurementOperation.AREA:
        if (!request.points || request.points.length < 3) {
          throw new Error('Area measurement requires at least 3 points');
        }
        break;

      case MeasurementOperation.VOLUME:
        if (!request.segmentation) {
          throw new Error('Volume measurement requires segmentation data');
        }
        break;

      case MeasurementOperation.ROI_ANALYSIS:
        if (!request.roi || !request.imageData) {
          throw new Error('ROI analysis requires ROI and image data');
        }
        break;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      await Promise.all([
        this.linearCalculator.cleanup(),
        this.areaCalculator.cleanup(),
        this.volumeCalculator.cleanup(),
        this.statisticalCalculator.cleanup(),
      ]);

      measurementLogger.info('Measurement Orchestrator cleaned up', 'MeasurementOrchestrator');
    } catch (error) {
      measurementLogger.error('Error during cleanup', 'MeasurementOrchestrator', {
        error: error instanceof Error ? error.message : 'Unknown error',
      }, error instanceof Error ? error : undefined);
    }
  }
}

// Export singleton instance
export const measurementOrchestrator = MeasurementOrchestrator.getInstance();
