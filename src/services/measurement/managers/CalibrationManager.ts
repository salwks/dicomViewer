/**
 * Calibration Manager
 * Handles calibration data, accuracy estimation, and calibration persistence
 */

import {
  PixelSpacing,
  CalibrationData,
  SafePropertyAccess,
  measurementLogger,
  MeasurementValidation,
} from '../interfaces/MeasurementTypes';

/**
 * Calibration source information
 */
export interface CalibrationSource {
  /** Source type */
  type: 'dicom' | 'manual' | 'estimated' | 'external';
  /** Source description */
  description: string;
  /** Reliability score (0-1) */
  reliability: number;
  /** Last updated timestamp */
  lastUpdated: Date;
  /** Source metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Extended calibration data with validation
 */
export interface ValidatedCalibrationData extends CalibrationData {
  /** Validation status */
  isValid: boolean;
  /** Validation errors */
  validationErrors: string[];
  /** Calibration source information */
  sourceInfo: CalibrationSource;
  /** Quality metrics */
  quality: {
    /** Pixel spacing consistency */
    consistency: number;
    /** Resolution adequacy */
    resolution: number;
    /** Overall quality score */
    overallScore: number;
  };
}

/**
 * Calibration history entry
 */
export interface CalibrationHistoryEntry {
  /** Entry ID */
  id: string;
  /** Image ID */
  imageId: string;
  /** Calibration data */
  calibration: ValidatedCalibrationData;
  /** Timestamp */
  timestamp: Date;
  /** User who created/modified */
  userId?: string;
  /** Reason for calibration */
  reason: string;
}

/**
 * Calibration Manager
 */
export class CalibrationManager {
  private static instance: CalibrationManager;
  private calibrationCache: Map<string, ValidatedCalibrationData> = new Map();
  private calibrationHistory: CalibrationHistoryEntry[] = [];
  private defaultCalibration?: ValidatedCalibrationData;

  private constructor() {
    this.initializeDefaultCalibration();
    measurementLogger.info('Calibration Manager initialized', 'CalibrationManager');
  }

  static getInstance(): CalibrationManager {
    if (!CalibrationManager.instance) {
      CalibrationManager.instance = new CalibrationManager();
    }
    return CalibrationManager.instance;
  }

  /**
   * Initialize default calibration for fallback
   */
  private initializeDefaultCalibration(): void {
    const defaultPixelSpacing: PixelSpacing = {
      columnSpacing: 1.0,
      rowSpacing: 1.0,
      sliceThickness: 1.0,
      sliceSpacing: 1.0,
    };

    this.defaultCalibration = this.createValidatedCalibration(
      defaultPixelSpacing,
      'estimated',
      'Default calibration fallback',
    );
  }

  /**
   * Set calibration data for an image
   */
  setCalibration(
    imageId: string,
    pixelSpacing: PixelSpacing,
    source: CalibrationData['calibrationSource'] = 'manual',
    reason: string = 'Manual calibration',
    userId?: string,
  ): ValidatedCalibrationData {
    const validatedCalibration = this.createValidatedCalibration(pixelSpacing, source, reason);

    this.calibrationCache.set(imageId, validatedCalibration);

    // Add to history
    this.addToHistory(imageId, validatedCalibration, reason, userId);

    measurementLogger.info(`Calibration set for ${imageId}`, 'CalibrationManager', {
      imageId,
      source,
      accuracy: validatedCalibration.accuracy,
      quality: validatedCalibration.quality.overallScore,
    });

    return validatedCalibration;
  }

  /**
   * Get calibration data for an image
   */
  getCalibration(imageId: string): ValidatedCalibrationData | undefined {
    return this.calibrationCache.get(imageId);
  }

  /**
   * Get calibration with fallback to default
   */
  getCalibrationWithFallback(imageId: string): ValidatedCalibrationData {
    const calibration = this.calibrationCache.get(imageId);
    if (calibration) {
      return calibration;
    }

    measurementLogger.warn(`No calibration found for ${imageId}, using default`, 'CalibrationManager', {
      imageId,
    });

    return this.defaultCalibration!;
  }

  /**
   * Create validated calibration data
   */
  private createValidatedCalibration(
    pixelSpacing: PixelSpacing,
    source: CalibrationData['calibrationSource'],
    description: string,
  ): ValidatedCalibrationData {
    const validationResult = this.validatePixelSpacing(pixelSpacing);
    const sourceInfo = this.createSourceInfo(source, description);
    const quality = this.assessCalibrationQuality(pixelSpacing, sourceInfo);
    const accuracy = this.estimateCalibrationAccuracy(pixelSpacing, sourceInfo);

    const calibration: ValidatedCalibrationData = {
      pixelSpacing,
      accuracy,
      calibrationSource: source,
      lastCalibrated: new Date(),
      isValid: validationResult.isValid,
      validationErrors: validationResult.errors,
      sourceInfo,
      quality,
    };

    return calibration;
  }

  /**
   * Create calibration source information
   */
  private createSourceInfo(
    source: CalibrationData['calibrationSource'],
    description: string,
  ): CalibrationSource {
    const reliability = this.getSourceReliability(source);

    return {
      type: source,
      description,
      reliability,
      lastUpdated: new Date(),
      metadata: {
        version: '1.0.0',
      },
    };
  }

  /**
   * Get reliability score for calibration source
   */
  private getSourceReliability(source: CalibrationData['calibrationSource']): number {
    switch (source) {
      case 'dicom':
        return 0.95; // DICOM metadata is generally very reliable
      case 'manual':
        return 0.85; // Manual calibration depends on user accuracy
      case 'estimated':
        return 0.60; // Estimated values have lower reliability
      default:
        return 0.70;
    }
  }

  /**
   * Validate pixel spacing data
   */
  private validatePixelSpacing(pixelSpacing: PixelSpacing): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!MeasurementValidation.validatePixelSpacing(pixelSpacing)) {
      errors.push('Invalid pixel spacing values');
    }

    // Additional validation checks
    const columnSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'columnSpacing');
    const rowSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'rowSpacing');

    if (columnSpacing <= 0) {
      errors.push('Column spacing must be positive');
    }
    if (rowSpacing <= 0) {
      errors.push('Row spacing must be positive');
    }

    // Check for reasonable values (should be between 0.01mm and 100mm)
    if (columnSpacing < 0.01 || columnSpacing > 100) {
      errors.push('Column spacing outside reasonable range (0.01-100mm)');
    }
    if (rowSpacing < 0.01 || rowSpacing > 100) {
      errors.push('Row spacing outside reasonable range (0.01-100mm)');
    }

    // Check for aspect ratio consistency
    const aspectRatio = columnSpacing / rowSpacing;
    if (aspectRatio < 0.5 || aspectRatio > 2.0) {
      errors.push('Unusual pixel aspect ratio detected');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Assess calibration quality
   */
  private assessCalibrationQuality(
    pixelSpacing: PixelSpacing,
    sourceInfo: CalibrationSource,
  ): ValidatedCalibrationData['quality'] {
    const columnSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'columnSpacing');
    const rowSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'rowSpacing');

    // Consistency: how similar are column and row spacing
    const avgSpacing = (columnSpacing + rowSpacing) / 2;
    const spacingDiff = Math.abs(columnSpacing - rowSpacing);
    const consistency = Math.max(0, 1 - (spacingDiff / avgSpacing));

    // Resolution: how good is the spatial resolution
    let resolution = 1.0;
    if (avgSpacing <= 0.1) resolution = 1.0;
    else if (avgSpacing <= 0.5) resolution = 0.95;
    else if (avgSpacing <= 1.0) resolution = 0.85;
    else if (avgSpacing <= 2.0) resolution = 0.75;
    else resolution = 0.65;

    // Overall score combines consistency, resolution, and source reliability
    const overallScore = (consistency * 0.3 + resolution * 0.4 + sourceInfo.reliability * 0.3);

    return {
      consistency,
      resolution,
      overallScore,
    };
  }

  /**
   * Estimate calibration accuracy
   */
  private estimateCalibrationAccuracy(
    pixelSpacing: PixelSpacing,
    sourceInfo: CalibrationSource,
  ): number {
    const columnSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'columnSpacing');
    const rowSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'rowSpacing');
    const avgSpacing = (columnSpacing + rowSpacing) / 2;

    // Base accuracy from pixel spacing resolution
    let baseAccuracy = 0.65;
    if (avgSpacing <= 0.1) baseAccuracy = 0.95;
    else if (avgSpacing <= 0.5) baseAccuracy = 0.90;
    else if (avgSpacing <= 1.0) baseAccuracy = 0.85;
    else if (avgSpacing <= 2.0) baseAccuracy = 0.75;

    // Adjust based on source reliability
    const sourceAdjustment = sourceInfo.reliability;

    // Combine base accuracy with source reliability
    const finalAccuracy = baseAccuracy * sourceAdjustment;

    return Math.min(0.99, Math.max(0.1, finalAccuracy));
  }

  /**
   * Add calibration to history
   */
  private addToHistory(
    imageId: string,
    calibration: ValidatedCalibrationData,
    reason: string,
    userId?: string,
  ): void {
    const entry: CalibrationHistoryEntry = {
      id: `cal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      imageId,
      calibration,
      timestamp: new Date(),
      userId,
      reason,
    };

    this.calibrationHistory.push(entry);

    // Keep only last 1000 entries
    if (this.calibrationHistory.length > 1000) {
      this.calibrationHistory = this.calibrationHistory.slice(-1000);
    }
  }

  /**
   * Get calibration history for an image
   */
  getCalibrationHistory(imageId: string): CalibrationHistoryEntry[] {
    return this.calibrationHistory.filter(entry => entry.imageId === imageId);
  }

  /**
   * Get all calibration history
   */
  getAllCalibrationHistory(): CalibrationHistoryEntry[] {
    return [...this.calibrationHistory];
  }

  /**
   * Clear calibration cache
   */
  clearCalibrationCache(): void {
    const count = this.calibrationCache.size;
    this.calibrationCache.clear();

    measurementLogger.info(`Cleared ${count} calibrations from cache`, 'CalibrationManager', {
      count,
    });
  }

  /**
   * Remove calibration for specific image
   */
  removeCalibration(imageId: string): boolean {
    const removed = this.calibrationCache.delete(imageId);

    if (removed) {
      measurementLogger.info(`Removed calibration for ${imageId}`, 'CalibrationManager', {
        imageId,
      });
    }

    return removed;
  }

  /**
   * Export calibration data
   */
  exportCalibrations(): string {
    const exportData = {
      calibrations: Object.fromEntries(this.calibrationCache),
      history: this.calibrationHistory,
      defaultCalibration: this.defaultCalibration,
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import calibration data
   */
  importCalibrations(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData);

      if (data.calibrations) {
        this.calibrationCache = new Map(Object.entries(data.calibrations));
      }

      if (data.history) {
        this.calibrationHistory = data.history;
      }

      if (data.defaultCalibration) {
        this.defaultCalibration = data.defaultCalibration;
      }

      measurementLogger.info(`Imported ${this.calibrationCache.size} calibrations`, 'CalibrationManager', {
        count: this.calibrationCache.size,
        historyCount: this.calibrationHistory.length,
      });
    } catch (error) {
      measurementLogger.error('Failed to import calibrations', 'CalibrationManager', {
        error: error instanceof Error ? error.message : 'Unknown error',
      }, error instanceof Error ? error : undefined);
      throw new Error(`Failed to import calibrations: ${error}`);
    }
  }

  /**
   * Get calibration statistics
   */
  getCalibrationStatistics(): {
    totalCalibrations: number;
    sourceDistribution: Record<string, number>;
    averageAccuracy: number;
    averageQuality: number;
    } {
    const calibrations = Array.from(this.calibrationCache.values());
    const sourceDistribution: Record<string, number> = {};
    let totalAccuracy = 0;
    let totalQuality = 0;

    calibrations.forEach(cal => {
      sourceDistribution[cal.calibrationSource] = (sourceDistribution[cal.calibrationSource] || 0) + 1;
      totalAccuracy += cal.accuracy;
      totalQuality += cal.quality.overallScore;
    });

    return {
      totalCalibrations: calibrations.length,
      sourceDistribution,
      averageAccuracy: calibrations.length > 0 ? totalAccuracy / calibrations.length : 0,
      averageQuality: calibrations.length > 0 ? totalQuality / calibrations.length : 0,
    };
  }
}

// Export singleton instance
export const calibrationManager = CalibrationManager.getInstance();
