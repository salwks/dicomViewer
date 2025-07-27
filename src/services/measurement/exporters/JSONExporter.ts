/**
 * JSON Export Manager
 * Handles export of measurements to JSON format
 */

import {
  MeasurementResult,
  measurementLogger,
} from '../interfaces/MeasurementTypes';

/**
 * JSON export options
 */
export interface JSONExportOptions {
  /** Include measurement metadata */
  includeMetadata?: boolean;
  /** Include statistical data */
  includeStatistics?: boolean;
  /** Include calibration information */
  includeCalibration?: boolean;
  /** Include alternative units */
  includeAlternativeUnits?: boolean;
  /** Pretty print JSON */
  prettyPrint?: boolean;
  /** Custom metadata to include */
  customMetadata?: Record<string, unknown>;
}

/**
 * JSON export result
 */
export interface JSONExportResult {
  /** Success status */
  success: boolean;
  /** Exported JSON string */
  data?: string;
  /** Error message if failed */
  error?: string;
  /** Export metadata */
  metadata: {
    exportedAt: string;
    measurementCount: number;
    format: string;
    version: string;
  };
}

/**
 * Measurement data for JSON export
 */
export interface JSONMeasurementData {
  /** Measurement ID */
  id: string;
  /** Measurement type */
  type: string;
  /** Measurement value */
  value: number;
  /** Measurement unit */
  unit: string;
  /** Confidence level */
  confidence: number;
  /** Measurement timestamp */
  timestamp: string;
  /** Measurement method */
  method: string;
  /** Image context */
  imageContext?: {
    imageId?: string;
    seriesInstanceUID?: string;
    studyInstanceUID?: string;
    modality?: string;
    sliceLocation?: number;
  };
  /** Calibration data */
  calibration?: {
    pixelSpacing: {
      columnSpacing: number;
      rowSpacing: number;
      sliceThickness?: number;
      sliceSpacing?: number;
    };
    accuracy: number;
    calibrationSource: string;
    lastCalibrated: string;
  };
  /** Statistical data */
  statistics?: {
    mean: number;
    median: number;
    standardDeviation: number;
    minimum: number;
    maximum: number;
    count: number;
    percentile25: number;
    percentile75: number;
    skewness: number;
    kurtosis: number;
  };
  /** Alternative units */
  alternativeUnits?: Array<{
    value: number;
    unit: string;
  }>;
}

/**
 * JSON Export Manager
 */
export class JSONExporter {
  private static instance: JSONExporter;

  private constructor() {
    measurementLogger.info('JSON Exporter initialized', 'JSONExporter');
  }

  static getInstance(): JSONExporter {
    if (!JSONExporter.instance) {
      JSONExporter.instance = new JSONExporter();
    }
    return JSONExporter.instance;
  }

  /**
   * Export measurements to JSON
   */
  exportMeasurements(
    measurements: Array<{ id: string; type: string; result?: MeasurementResult }>,
    options: JSONExportOptions = {},
  ): JSONExportResult {
    try {
      const exportData = this.prepareMeasurementData(measurements, options);
      const jsonString = this.serializeToJSON(exportData, options);

      const result: JSONExportResult = {
        success: true,
        data: jsonString,
        metadata: {
          exportedAt: new Date().toISOString(),
          measurementCount: measurements.length,
          format: 'application/json',
          version: '1.0.0',
        },
      };

      measurementLogger.info(`Exported ${measurements.length} measurements to JSON`, 'JSONExporter', {
        measurementCount: measurements.length,
        dataSize: jsonString.length,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during JSON export';

      measurementLogger.error('Failed to export measurements to JSON', 'JSONExporter', {
        error: errorMessage,
        measurementCount: measurements.length,
      }, error instanceof Error ? error : undefined);

      return {
        success: false,
        error: errorMessage,
        metadata: {
          exportedAt: new Date().toISOString(),
          measurementCount: measurements.length,
          format: 'application/json',
          version: '1.0.0',
        },
      };
    }
  }

  /**
   * Export single measurement to JSON
   */
  exportSingleMeasurement(
    id: string,
    type: string,
    result: MeasurementResult,
    options: JSONExportOptions = {},
  ): JSONExportResult {
    return this.exportMeasurements([{ id, type, result }], options);
  }

  /**
   * Prepare measurement data for JSON export
   */
  private prepareMeasurementData(
    measurements: Array<{ id: string; type: string; result?: MeasurementResult }>,
    options: JSONExportOptions,
  ): {
    measurements: JSONMeasurementData[];
    export: {
      version: string;
      exportedAt: string;
      options: JSONExportOptions;
      summary: {
        totalMeasurements: number;
        measurementTypes: Record<string, number>;
      };
    };
    metadata?: Record<string, unknown>;
  } {
    const measurementData: JSONMeasurementData[] = [];
    const measurementTypes: Record<string, number> = {};

    measurements.forEach(measurement => {
      // Count measurement types
      measurementTypes[measurement.type] = (measurementTypes[measurement.type] || 0) + 1;

      if (!measurement.result) {
        // Skip measurements without results
        return;
      }

      const data: JSONMeasurementData = {
        id: measurement.id,
        type: measurement.type,
        value: measurement.result.value,
        unit: measurement.result.unit,
        confidence: measurement.result.confidence,
        timestamp: measurement.result.metadata.timestamp.toISOString(),
        method: measurement.result.metadata.method,
      };

      // Add image context if metadata is included
      if (options.includeMetadata && measurement.result.metadata.imageContext) {
        data.imageContext = measurement.result.metadata.imageContext;
      }

      // Add calibration data if requested
      if (options.includeCalibration && measurement.result.metadata.calibration) {
        data.calibration = {
          pixelSpacing: measurement.result.metadata.calibration.pixelSpacing,
          accuracy: measurement.result.metadata.calibration.accuracy,
          calibrationSource: measurement.result.metadata.calibration.calibrationSource,
          lastCalibrated: measurement.result.metadata.calibration.lastCalibrated.toISOString(),
        };
      }

      // Add statistical data if requested and available
      if (options.includeStatistics && measurement.result.statistics) {
        data.statistics = {
          mean: measurement.result.statistics.mean,
          median: measurement.result.statistics.median,
          standardDeviation: measurement.result.statistics.standardDeviation,
          minimum: measurement.result.statistics.minimum,
          maximum: measurement.result.statistics.maximum,
          count: measurement.result.statistics.count,
          percentile25: measurement.result.statistics.percentile25,
          percentile75: measurement.result.statistics.percentile75,
          skewness: measurement.result.statistics.skewness,
          kurtosis: measurement.result.statistics.kurtosis,
        };
      }

      // Add alternative units if requested
      if (options.includeAlternativeUnits && measurement.result.alternativeUnits) {
        data.alternativeUnits = measurement.result.alternativeUnits;
      }

      measurementData.push(data);
    });

    const exportData = {
      measurements: measurementData,
      export: {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        options,
        summary: {
          totalMeasurements: measurementData.length,
          measurementTypes,
        },
      },
    };

    // Add custom metadata if provided
    if (options.customMetadata) {
      (exportData as any).metadata = options.customMetadata;
    }

    return exportData;
  }

  /**
   * Serialize data to JSON string
   */
  private serializeToJSON(data: any, options: JSONExportOptions): string {
    if (options.prettyPrint) {
      return JSON.stringify(data, null, 2);
    } else {
      return JSON.stringify(data);
    }
  }

  /**
   * Validate JSON export data
   */
  validateExportData(jsonString: string): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const data = JSON.parse(jsonString);

      // Check required fields
      if (!data.measurements) {
        errors.push('Missing measurements array');
      } else if (!Array.isArray(data.measurements)) {
        errors.push('Measurements must be an array');
      }

      if (!data.export) {
        errors.push('Missing export metadata');
      } else {
        if (!data.export.version) {
          warnings.push('Missing export version');
        }
        if (!data.export.exportedAt) {
          warnings.push('Missing export timestamp');
        }
      }

      // Validate individual measurements
      if (Array.isArray(data.measurements)) {
        data.measurements.forEach((measurement: any, index: number) => {
          if (!measurement.id) {
            errors.push(`Measurement ${index}: missing ID`);
          }
          if (!measurement.type) {
            errors.push(`Measurement ${index}: missing type`);
          }
          if (typeof measurement.value !== 'number') {
            errors.push(`Measurement ${index}: invalid value`);
          }
          if (!measurement.unit) {
            errors.push(`Measurement ${index}: missing unit`);
          }
          if (typeof measurement.confidence !== 'number' || measurement.confidence < 0 || measurement.confidence > 1) {
            warnings.push(`Measurement ${index}: invalid confidence value`);
          }
        });
      }

    } catch {
      errors.push('Invalid JSON format');
    }

    const result = {
      isValid: errors.length === 0,
      errors,
      warnings,
    };

    measurementLogger.debug('JSON validation completed', 'JSONExporter', {
      isValid: result.isValid,
      errorCount: errors.length,
      warningCount: warnings.length,
    });

    return result;
  }

  /**
   * Import measurements from JSON
   */
  importMeasurements(jsonString: string): {
    success: boolean;
    measurements?: JSONMeasurementData[];
    error?: string;
    metadata?: any;
  } {
    try {
      const validation = this.validateExportData(jsonString);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Invalid JSON data: ${validation.errors.join(', ')}`,
        };
      }

      const data = JSON.parse(jsonString);

      measurementLogger.info(`Imported ${data.measurements.length} measurements from JSON`, 'JSONExporter', {
        measurementCount: data.measurements.length,
        version: data.export?.version,
      });

      return {
        success: true,
        measurements: data.measurements,
        metadata: data.export,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during JSON import';

      measurementLogger.error('Failed to import measurements from JSON', 'JSONExporter', {
        error: errorMessage,
      }, error instanceof Error ? error : undefined);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}

// Export singleton instance
export const jsonExporter = JSONExporter.getInstance();
