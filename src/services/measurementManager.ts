/**
 * Measurement Manager Service
 *
 * Integrates with annotation system to provide comprehensive measurement
 * capabilities including calibration, validation, and persistence
 */

// Updated to use new modular architecture
import {
  measurementOrchestrator,
  MeasurementOperation,
  MeasurementRequest,
  ComprehensiveMeasurementResult,
  MeasurementResult,
  Point3,
  PixelSpacing,
  ROI,
  ImageData,
} from './measurement';
import { AnnotationType } from '../types/annotation-styling';
import { log } from '../utils/logger';

/**
 * Measurement tool types that can be used
 */
export enum MeasurementTool {
  LENGTH = 'length',
  ANGLE = 'angle',
  AREA = 'area',
  VOLUME = 'volume',
  ROI_ANALYSIS = 'roi-analysis',
  PROBE = 'probe',
}

/**
 * Measurement configuration
 */
export interface MeasurementConfig {
  /** Tool type */
  tool: MeasurementTool;
  /** Annotation type this measurement is associated with */
  annotationType: AnnotationType;
  /** Auto-calculate on annotation change */
  autoCalculate: boolean;
  /** Display precision (decimal places) */
  precision: number;
  /** Units to display */
  displayUnits: string[];
  /** Calibration override */
  calibrationOverride?: PixelSpacing;
}

/**
 * Measurement context from viewport
 */
export interface MeasurementContext {
  /** Viewport ID */
  viewportId: string;
  /** Image ID */
  imageId: string;
  /** Pixel spacing from DICOM */
  pixelSpacing: PixelSpacing;
  /** Image data for ROI analysis */
  imageData?: ImageData;
  /** Series instance UID */
  seriesInstanceUID?: string;
  /** Study instance UID */
  studyInstanceUID?: string;
  /** Frame number */
  frameNumber?: number;
}

/**
 * Measurement annotation data
 */
export interface MeasurementAnnotation {
  /** Annotation ID */
  id: string;
  /** Annotation type */
  type: AnnotationType;
  /** Measurement configuration */
  config: MeasurementConfig;
  /** Annotation geometry data */
  data: {
    points?: Point3[];
    handles?: Record<string, Point3>;
    contour?: Point3[];
    [key: string]: unknown;
  };
  /** Measurement context */
  context: MeasurementContext;
  /** Calculated measurement result */
  result?: MeasurementResult;
  /** Last calculation timestamp */
  lastCalculated?: Date;
}

/**
 * Measurement validation result
 */
export interface MeasurementValidation {
  /** Is measurement valid */
  isValid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Suggested fixes */
  suggestions: string[];
}

/**
 * Measurement export options
 */
export interface MeasurementExportOptions {
  /** Include raw annotation data */
  includeRawData?: boolean;
  /** Include statistical analysis */
  includeStatistics?: boolean;
  /** Include calibration information */
  includeCalibration?: boolean;
  /** Export format */
  format: 'json' | 'csv' | 'pdf' | 'dicom-sr';
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Measurement report
 */
export interface MeasurementReport {
  /** Report ID */
  id: string;
  /** Generated timestamp */
  timestamp: Date;
  /** Patient/study information */
  studyInfo?: {
    patientId?: string;
    studyInstanceUID?: string;
    studyDate?: string;
    modality?: string;
  };
  /** All measurements in report */
  measurements: MeasurementAnnotation[];
  /** Report summary */
  summary: {
    totalMeasurements: number;
    measurementTypes: Record<MeasurementTool, number>;
    averageConfidence: number;
    calibrationAccuracy: number;
  };
}

/**
 * Measurement Manager
 */
export class MeasurementManager {
  private static instance: MeasurementManager;
  private measurements: Map<string, MeasurementAnnotation> = new Map();
  private configurations: Map<AnnotationType, MeasurementConfig> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();
  // Updated to use new orchestrator
  private orchestrator = measurementOrchestrator;

  private constructor() {
    this.initializeDefaultConfigurations();
    log.info('Measurement Manager initialized (using new modular architecture)', {
      component: 'MeasurementManager',
    });
  }

  static getInstance(): MeasurementManager {
    if (!MeasurementManager.instance) {
      MeasurementManager.instance = new MeasurementManager();
    }
    return MeasurementManager.instance;
  }

  /* =============================================================================
   * CONFIGURATION MANAGEMENT
   * ============================================================================= */

  /**
   * Initialize default measurement configurations
   */
  private initializeDefaultConfigurations(): void {
    // Length measurements
    this.configurations.set(AnnotationType.LENGTH, {
      tool: MeasurementTool.LENGTH,
      annotationType: AnnotationType.LENGTH,
      autoCalculate: true,
      precision: 2,
      displayUnits: ['mm', 'cm'],
      calibrationOverride: undefined,
    });

    // Angle measurements
    this.configurations.set(AnnotationType.ANGLE, {
      tool: MeasurementTool.ANGLE,
      annotationType: AnnotationType.ANGLE,
      autoCalculate: true,
      precision: 1,
      displayUnits: ['degrees', 'radians'],
      calibrationOverride: undefined,
    });

    // Area measurements
    this.configurations.set(AnnotationType.AREA, {
      tool: MeasurementTool.AREA,
      annotationType: AnnotationType.AREA,
      autoCalculate: true,
      precision: 2,
      displayUnits: ['mm²', 'cm²'],
      calibrationOverride: undefined,
    });

    this.configurations.set(AnnotationType.ELLIPSE, {
      tool: MeasurementTool.AREA,
      annotationType: AnnotationType.ELLIPSE,
      autoCalculate: true,
      precision: 2,
      displayUnits: ['mm²', 'cm²'],
      calibrationOverride: undefined,
    });

    this.configurations.set(AnnotationType.RECTANGLE, {
      tool: MeasurementTool.AREA,
      annotationType: AnnotationType.RECTANGLE,
      autoCalculate: true,
      precision: 2,
      displayUnits: ['mm²', 'cm²'],
      calibrationOverride: undefined,
    });

    this.configurations.set(AnnotationType.FREEHAND, {
      tool: MeasurementTool.AREA,
      annotationType: AnnotationType.FREEHAND,
      autoCalculate: true,
      precision: 2,
      displayUnits: ['mm²', 'cm²'],
      calibrationOverride: undefined,
    });

    // ROI analysis
    this.configurations.set(AnnotationType.PROBE, {
      tool: MeasurementTool.ROI_ANALYSIS,
      annotationType: AnnotationType.PROBE,
      autoCalculate: true,
      precision: 1,
      displayUnits: ['HU', 'value'],
      calibrationOverride: undefined,
    });
  }

  /**
   * Set measurement configuration for annotation type
   */
  setMeasurementConfig(annotationType: AnnotationType, config: MeasurementConfig): void {
    this.configurations.set(annotationType, config);
    this.emit('configurationChanged', { annotationType, config });
    log.info(`Updated configuration for ${annotationType}`, {
      component: 'MeasurementManager',
      operation: 'setConfiguration',
      metadata: { annotationType },
    });
  }

  /**
   * Get measurement configuration for annotation type
   */
  getMeasurementConfig(annotationType: AnnotationType): MeasurementConfig | undefined {
    return this.configurations.get(annotationType);
  }

  /* =============================================================================
   * MEASUREMENT OPERATIONS
   * ============================================================================= */

  /**
   * Create measurement from annotation
   */
  createMeasurement(
    annotationId: string,
    annotationType: AnnotationType,
    annotationData: any,
    context: MeasurementContext,
  ): MeasurementAnnotation {
    const config = this.configurations.get(annotationType);
    if (!config) {
      throw new Error(`No measurement configuration found for ${annotationType}`);
    }

    const measurement: MeasurementAnnotation = {
      id: annotationId,
      type: annotationType,
      config,
      data: this.extractGeometryData(annotationData),
      context,
    };

    this.measurements.set(annotationId, measurement);

    // Auto-calculate if enabled
    if (config.autoCalculate) {
      this.calculateMeasurement(annotationId);
    }

    this.emit('measurementCreated', { measurement });
    log.info(`Created measurement for annotation ${annotationId}`, {
      component: 'MeasurementManager',
      operation: 'createMeasurement',
      metadata: { annotationId, annotationType },
    });

    return measurement;
  }

  /**
   * Update measurement
   */
  updateMeasurement(
    annotationId: string,
    annotationData: any,
    context?: Partial<MeasurementContext>,
  ): MeasurementAnnotation | undefined {
    const measurement = this.measurements.get(annotationId);
    if (!measurement) {
      console.warn(`Measurement not found: ${annotationId}`);
      return undefined;
    }

    // Update data
    measurement.data = this.extractGeometryData(annotationData);

    // Update context if provided
    if (context) {
      measurement.context = { ...measurement.context, ...context };
    }

    // Recalculate if auto-calculate is enabled
    if (measurement.config.autoCalculate) {
      this.calculateMeasurement(annotationId);
    }

    this.emit('measurementUpdated', { measurement });
    log.info(`Updated measurement ${annotationId}`, {
      component: 'MeasurementManager',
      operation: 'updateMeasurement',
      metadata: { annotationId },
    });

    return measurement;
  }

  /**
   * Calculate measurement
   */
  calculateMeasurement(annotationId: string): MeasurementResult | undefined {
    const measurement = this.measurements.get(annotationId);
    if (!measurement) {
      console.warn(`Measurement not found: ${annotationId}`);
      return undefined;
    }

    try {
      const pixelSpacing = measurement.config.calibrationOverride || measurement.context.pixelSpacing;
      let result: MeasurementResult;

      switch (measurement.config.tool) {
        case MeasurementTool.LENGTH:
          result = this.calculateLength(measurement, pixelSpacing);
          break;
        case MeasurementTool.ANGLE:
          result = this.calculateAngle(measurement, pixelSpacing);
          break;
        case MeasurementTool.AREA:
          result = this.calculateArea(measurement, pixelSpacing);
          break;
        case MeasurementTool.VOLUME:
          result = this.calculateVolume(measurement, pixelSpacing);
          break;
        case MeasurementTool.ROI_ANALYSIS:
          result = this.calculateROIAnalysis(measurement, pixelSpacing);
          break;
        default:
          throw new Error(`Unsupported measurement tool: ${measurement.config.tool}`);
      }

      measurement.result = result;
      measurement.lastCalculated = new Date();

      this.emit('measurementCalculated', { measurement, result });
      log.info(`Calculated measurement ${annotationId}: ${result.value} ${result.unit}`, {
        component: 'MeasurementManager',
        operation: 'calculateMeasurement',
        metadata: { annotationId, value: result.value, unit: result.unit, tool: measurement.config.tool },
      });

      return result;
    } catch (error) {
      console.error(`Failed to calculate measurement ${annotationId}:`, error);
      this.emit('measurementError', { annotationId, error });
      return undefined;
    }
  }

  /**
   * Calculate length measurement
   */
  private calculateLength(measurement: MeasurementAnnotation, pixelSpacing: PixelSpacing): MeasurementResult {
    const points = this.extractPoints(measurement.data);
    if (points.length < 2) {
      throw new Error('Length measurement requires at least 2 points');
    }

    // Use new orchestrator for enhanced measurement with validation
    return this.orchestrator.measureLength(
      points,
      pixelSpacing,
      measurement.context.imageId,
    );
  }

  /**
   * Calculate angle measurement
   */
  private calculateAngle(measurement: MeasurementAnnotation, pixelSpacing: PixelSpacing): MeasurementResult {
    const points = this.extractPoints(measurement.data);
    if (points.length !== 3) {
      throw new Error('Angle measurement requires exactly 3 points');
    }

    // Use new orchestrator for enhanced measurement with validation
    return this.orchestrator.measureAngle(
      [points[0], points[1], points[2]],
      pixelSpacing,
      measurement.context.imageId,
    );
  }

  /**
   * Calculate area measurement
   */
  private calculateArea(measurement: MeasurementAnnotation, pixelSpacing: PixelSpacing): MeasurementResult {
    const contour = this.extractContour(measurement.data);
    if (contour.length < 3) {
      throw new Error('Area measurement requires at least 3 points');
    }

    // Use new orchestrator for enhanced measurement with validation
    return this.orchestrator.measureArea(
      contour,
      pixelSpacing,
      measurement.context.imageId,
    );
  }

  /**
   * Calculate volume measurement
   */
  private calculateVolume(_measurement: MeasurementAnnotation, _pixelSpacing: PixelSpacing): MeasurementResult {
    // This would require segmentation data
    throw new Error('Volume measurement not yet implemented');
  }

  /**
   * Calculate ROI analysis
   */
  private calculateROIAnalysis(measurement: MeasurementAnnotation, pixelSpacing: PixelSpacing): MeasurementResult {
    if (!measurement.context.imageData) {
      throw new Error('ROI analysis requires image data');
    }

    const roi: ROI = {
      type: this.getROIType(measurement.type),
      points: this.extractPoints(measurement.data).map(p => ({ x: p.x, y: p.y })),
      pixelSpacing,
    };

    // Use new orchestrator for enhanced ROI analysis with validation
    return this.orchestrator.analyzeROI(roi, measurement.context.imageData, measurement.context.imageId);
  }

  /**
   * Perform comprehensive measurement with validation and quality assessment
   * Enhanced method using new architecture
   */
  async performComprehensiveMeasurement(annotationId: string): Promise<ComprehensiveMeasurementResult | undefined> {
    const measurement = this.measurements.get(annotationId);
    if (!measurement) {
      console.warn(`Measurement not found: ${annotationId}`);
      return undefined;
    }

    try {
      const pixelSpacing = measurement.config.calibrationOverride || measurement.context.pixelSpacing;

      // Create measurement request based on tool type
      const request: MeasurementRequest = {
        operation: this.mapToolToOperation(measurement.config.tool),
        points: this.extractPoints(measurement.data),
        pixelSpacing,
        imageId: measurement.context.imageId,
        metadata: {
          annotationId,
          annotationType: measurement.type,
          measurementConfig: measurement.config,
        },
      };

      // Add ROI and image data for ROI analysis
      if (measurement.config.tool === MeasurementTool.ROI_ANALYSIS && measurement.context.imageData) {
        request.roi = {
          type: this.getROIType(measurement.type),
          points: this.extractPoints(measurement.data).map(p => ({ x: p.x, y: p.y })),
          pixelSpacing,
        };
        request.imageData = measurement.context.imageData;
      }

      const comprehensiveResult = await this.orchestrator.performMeasurement(request);

      // Update measurement with comprehensive result
      measurement.result = comprehensiveResult.result;
      measurement.lastCalculated = new Date();

      this.emit('measurementCalculated', {
        measurement,
        result: comprehensiveResult.result,
        validation: comprehensiveResult.validation,
        quality: comprehensiveResult.quality,
      });

      log.info(`Comprehensive measurement calculated ${annotationId}`, {
        component: 'MeasurementManager',
        operation: 'performComprehensiveMeasurement',
        metadata: {
          annotationId,
          value: comprehensiveResult.result.value,
          unit: comprehensiveResult.result.unit,
          validationScore: comprehensiveResult.validation.score,
          qualityScore: comprehensiveResult.quality.overallQuality,
          tool: measurement.config.tool,
        },
      });

      return comprehensiveResult;
    } catch (error) {
      console.error(`Failed to perform comprehensive measurement ${annotationId}:`, error);
      this.emit('measurementError', { annotationId, error });
      return undefined;
    }
  }

  /**
   * Map MeasurementTool to MeasurementOperation
   */
  private mapToolToOperation(tool: MeasurementTool): MeasurementOperation {
    switch (tool) {
      case MeasurementTool.LENGTH:
        return MeasurementOperation.LENGTH;
      case MeasurementTool.ANGLE:
        return MeasurementOperation.ANGLE;
      case MeasurementTool.AREA:
        return MeasurementOperation.AREA;
      case MeasurementTool.VOLUME:
        return MeasurementOperation.VOLUME;
      case MeasurementTool.ROI_ANALYSIS:
      case MeasurementTool.PROBE:
        return MeasurementOperation.ROI_ANALYSIS;
      default:
        throw new Error(`Unsupported measurement tool: ${tool}`);
    }
  }

  /**
   * Get enhanced export capabilities using new architecture
   */
  async exportMeasurementsEnhanced(
    format: 'json' | 'csv' | 'pdf',
    options?: any,
  ): Promise<any> {
    const measurements = Array.from(this.measurements.values());
    const exportData = measurements.map(m => ({
      id: m.id,
      type: m.type,
      result: m.result,
    }));

    return this.orchestrator.exportMeasurements({
      measurements: exportData,
      format,
      options,
    });
  }

  /**
   * Get system status from orchestrator
   */
  getSystemStatus() {
    return this.orchestrator.getSystemStatus();
  }

  /**
   * Get performance metrics from orchestrator
   */
  getPerformanceMetrics() {
    return this.orchestrator.getPerformanceMetrics();
  }

  /* =============================================================================
   * DATA EXTRACTION UTILITIES
   * ============================================================================= */

  /**
   * Extract geometry data from annotation
   */
  private extractGeometryData(annotationData: any): MeasurementAnnotation['data'] {
    const data: MeasurementAnnotation['data'] = {};

    // Extract points array
    if (annotationData.points) {
      data.points = annotationData.points;
    }

    // Extract handles
    if (annotationData.handles) {
      data.handles = annotationData.handles;
    }

    // Extract contour
    if (annotationData.contour) {
      data.contour = annotationData.contour;
    }

    // Copy other relevant data with safe property access
    const allowedKeys = ['points', 'handles', 'contour'];
    Object.keys(annotationData).forEach(key => {
      if (!allowedKeys.includes(key) && Object.prototype.hasOwnProperty.call(annotationData, key)) {
        // eslint-disable-next-line security/detect-object-injection
        data[key] = annotationData[key];
      }
    });

    return data;
  }

  /**
   * Extract points from measurement data
   */
  private extractPoints(data: MeasurementAnnotation['data']): Point3[] {
    if (data.points) {
      return data.points;
    }

    if (data.handles) {
      // Extract points from handles (common pattern)
      const points: Point3[] = [];
      Object.values(data.handles).forEach(handle => {
        if (handle && typeof handle.x === 'number' && typeof handle.y === 'number') {
          points.push({
            x: handle.x,
            y: handle.y,
            z: handle.z || 0,
          });
        }
      });
      return points;
    }

    return [];
  }

  /**
   * Extract contour from measurement data
   */
  private extractContour(data: MeasurementAnnotation['data']): Point3[] {
    if (data.contour) {
      return data.contour;
    }

    // Fallback to points
    return this.extractPoints(data);
  }

  /**
   * Get ROI type from annotation type
   */
  private getROIType(annotationType: AnnotationType): ROI['type'] {
    switch (annotationType) {
      case AnnotationType.RECTANGLE:
        return 'rectangle';
      case AnnotationType.ELLIPSE:
        return 'ellipse';
      case AnnotationType.FREEHAND:
        return 'freehand';
      default:
        return 'polygon';
    }
  }

  /* =============================================================================
   * MEASUREMENT MANAGEMENT
   * ============================================================================= */

  /**
   * Get measurement by ID
   */
  getMeasurement(annotationId: string): MeasurementAnnotation | undefined {
    return this.measurements.get(annotationId);
  }

  /**
   * Get all measurements
   */
  getAllMeasurements(): MeasurementAnnotation[] {
    return Array.from(this.measurements.values());
  }

  /**
   * Get measurements by type
   */
  getMeasurementsByType(annotationType: AnnotationType): MeasurementAnnotation[] {
    return Array.from(this.measurements.values()).filter(m => m.type === annotationType);
  }

  /**
   * Get measurements by viewport
   */
  getMeasurementsByViewport(viewportId: string): MeasurementAnnotation[] {
    return Array.from(this.measurements.values()).filter(m => m.context.viewportId === viewportId);
  }

  /**
   * Remove measurement
   */
  removeMeasurement(annotationId: string): boolean {
    const measurement = this.measurements.get(annotationId);
    if (!measurement) {
      return false;
    }

    this.measurements.delete(annotationId);
    this.emit('measurementRemoved', { annotationId, measurement });
    log.info(`Removed measurement ${annotationId}`, {
      component: 'MeasurementManager',
      operation: 'removeMeasurement',
      metadata: { annotationId },
    });

    return true;
  }

  /**
   * Clear all measurements
   */
  clearAllMeasurements(): void {
    const count = this.measurements.size;
    this.measurements.clear();
    this.emit('measurementsCleared', { count });
    log.info(`Cleared ${count} measurements`, {
      component: 'MeasurementManager',
      operation: 'clearAllMeasurements',
      metadata: { count },
    });
  }

  /* =============================================================================
   * VALIDATION
   * ============================================================================= */

  /**
   * Validate measurement
   */
  validateMeasurement(annotationId: string): MeasurementValidation {
    const measurement = this.measurements.get(annotationId);
    if (!measurement) {
      return {
        isValid: false,
        errors: ['Measurement not found'],
        warnings: [],
        suggestions: [],
      };
    }

    const validation: MeasurementValidation = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    // Validate geometry data
    const points = this.extractPoints(measurement.data);

    switch (measurement.config.tool) {
      case MeasurementTool.LENGTH:
        if (points.length < 2) {
          validation.errors.push('Length measurement requires at least 2 points');
          validation.isValid = false;
        }
        break;

      case MeasurementTool.ANGLE:
        if (points.length !== 3) {
          validation.errors.push('Angle measurement requires exactly 3 points');
          validation.isValid = false;
        }
        break;

      case MeasurementTool.AREA:
        if (points.length < 3) {
          validation.errors.push('Area measurement requires at least 3 points');
          validation.isValid = false;
        }
        break;

      case MeasurementTool.ROI_ANALYSIS:
        if (!measurement.context.imageData) {
          validation.errors.push('ROI analysis requires image data');
          validation.isValid = false;
        }
        break;
    }

    // Validate calibration
    const pixelSpacing = measurement.config.calibrationOverride || measurement.context.pixelSpacing;
    if (!pixelSpacing || pixelSpacing.columnSpacing <= 0 || pixelSpacing.rowSpacing <= 0) {
      validation.errors.push('Invalid pixel spacing for calibration');
      validation.isValid = false;
    }

    // Check measurement confidence
    if (measurement.result && measurement.result.confidence < 0.7) {
      validation.warnings.push('Low measurement confidence - consider recalibrating');
      validation.suggestions.push('Check pixel spacing calibration');
    }

    return validation;
  }

  /* =============================================================================
   * EXPORT AND REPORTING
   * ============================================================================= */

  /**
   * Export measurements
   */
  async exportMeasurements(options: MeasurementExportOptions): Promise<string | Blob> {
    const measurements = Array.from(this.measurements.values());

    switch (options.format) {
      case 'json':
        return this.exportToJSON(measurements, options);
      case 'csv':
        return this.exportToCSV(measurements, options);
      case 'pdf':
        return this.exportToPDF(measurements, options);
      case 'dicom-sr':
        return this.exportToDICOM(measurements, options);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Export to JSON
   */
  private exportToJSON(measurements: MeasurementAnnotation[], options: MeasurementExportOptions): string {
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      options,
      measurements: measurements.map(m => ({
        id: m.id,
        type: m.type,
        tool: m.config.tool,
        result: m.result,
        context: options.includeCalibration ? m.context : {
          viewportId: m.context.viewportId,
          imageId: m.context.imageId,
        },
        ...(options.includeRawData && { data: m.data }),
      })),
      metadata: options.metadata,
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export to CSV
   */
  private exportToCSV(measurements: MeasurementAnnotation[], options: MeasurementExportOptions): string {
    const headers = [
      'ID',
      'Type',
      'Tool',
      'Value',
      'Unit',
      'Confidence',
      'Method',
      'Timestamp',
      'Image ID',
      'Viewport ID',
    ];

    if (options.includeStatistics) {
      headers.push('Mean', 'Std Dev', 'Min', 'Max', 'Count');
    }

    const rows = measurements
      .filter(m => m.result)
      .map(m => {
        const row = [
          m.id,
          m.type,
          m.config.tool,
          m.result!.value.toString(),
          m.result!.unit,
          m.result!.confidence.toString(),
          m.result!.metadata.method,
          m.result!.metadata.timestamp.toISOString(),
          m.context.imageId,
          m.context.viewportId,
        ];

        if (options.includeStatistics && m.result!.statistics) {
          const stats = m.result!.statistics;
          row.push(
            stats.mean.toString(),
            stats.standardDeviation.toString(),
            stats.minimum.toString(),
            stats.maximum.toString(),
            stats.count.toString(),
          );
        }

        return row;
      });

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Export to PDF (placeholder)
   */
  private async exportToPDF(_measurements: MeasurementAnnotation[], _options: MeasurementExportOptions): Promise<Blob> {
    // This would integrate with the PDF export service
    throw new Error('PDF export not yet implemented');
  }

  /**
   * Export to DICOM SR (placeholder)
   */
  private async exportToDICOM(_measurements: MeasurementAnnotation[], _options: MeasurementExportOptions): Promise<Blob> {
    // This would integrate with the DICOM SR export service
    throw new Error('DICOM SR export not yet implemented');
  }

  /**
   * Generate measurement report
   */
  generateReport(studyInfo?: MeasurementReport['studyInfo']): MeasurementReport {
    const measurements = Array.from(this.measurements.values());
    const measurementTypes: Record<MeasurementTool, number> = {
      [MeasurementTool.LENGTH]: 0,
      [MeasurementTool.ANGLE]: 0,
      [MeasurementTool.AREA]: 0,
      [MeasurementTool.VOLUME]: 0,
      [MeasurementTool.ROI_ANALYSIS]: 0,
      [MeasurementTool.PROBE]: 0,
    };

    let totalConfidence = 0;
    let confidenceCount = 0;
    let totalAccuracy = 0;
    let accuracyCount = 0;

    measurements.forEach(m => {
      measurementTypes[m.config.tool]++;

      if (m.result) {
        totalConfidence += m.result.confidence;
        confidenceCount++;

        totalAccuracy += m.result.metadata.calibration.accuracy;
        accuracyCount++;
      }
    });

    return {
      id: `report-${Date.now()}`,
      timestamp: new Date(),
      studyInfo,
      measurements,
      summary: {
        totalMeasurements: measurements.length,
        measurementTypes,
        averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
        calibrationAccuracy: accuracyCount > 0 ? totalAccuracy / accuracyCount : 0,
      },
    };
  }

  /* =============================================================================
   * EVENT SYSTEM
   * ============================================================================= */

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in measurement event listener for ${event}:`, error);
        }
      });
    }
  }
}

// Export singleton instance
export const measurementManager = MeasurementManager.getInstance();
