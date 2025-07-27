/**
 * Validation Manager
 * Handles measurement validation, quality assessment, and validation rules
 */

import {
  Point3,
  PixelSpacing,
  MeasurementResult,
  ImageData,
  SafePropertyAccess,
  measurementLogger,
  MeasurementValidation as BaseMeasurementValidation,
} from '../interfaces/MeasurementTypes';

/**
 * Validation severity levels
 */
export enum ValidationSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

/**
 * Validation rule result
 */
export interface ValidationRuleResult {
  /** Rule name */
  rule: string;
  /** Is rule passed */
  passed: boolean;
  /** Severity level */
  severity: ValidationSeverity;
  /** Validation message */
  message: string;
  /** Suggested fixes */
  suggestions: string[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Comprehensive validation result
 */
export interface MeasurementValidationResult {
  /** Overall validation status */
  isValid: boolean;
  /** Has critical errors */
  hasCriticalErrors: boolean;
  /** Has warnings */
  hasWarnings: boolean;
  /** Validation score (0-1) */
  score: number;
  /** Individual rule results */
  rules: ValidationRuleResult[];
  /** Summary of errors */
  errors: string[];
  /** Summary of warnings */
  warnings: string[];
  /** Summary of suggestions */
  suggestions: string[];
  /** Validation metadata */
  metadata: {
    timestamp: Date;
    validatedBy: string;
    validationVersion: string;
  };
}

/**
 * Validation rule configuration
 */
export interface ValidationRule {
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Is rule enabled */
  enabled: boolean;
  /** Rule severity */
  severity: ValidationSeverity;
  /** Rule validator function */
  validator: (context: ValidationContext) => ValidationRuleResult;
}

/**
 * Validation context
 */
export interface ValidationContext {
  /** Measurement type */
  measurementType: string;
  /** Points data */
  points?: Point3[];
  /** Pixel spacing */
  pixelSpacing?: PixelSpacing;
  /** Image data */
  imageData?: ImageData;
  /** Measurement result */
  result?: MeasurementResult;
  /** Additional context data */
  metadata?: Record<string, unknown>;
}

/**
 * Quality metrics for measurements
 */
export interface QualityMetrics {
  /** Geometric quality (0-1) */
  geometricQuality: number;
  /** Calibration quality (0-1) */
  calibrationQuality: number;
  /** Data quality (0-1) */
  dataQuality: number;
  /** Overall quality score (0-1) */
  overallQuality: number;
  /** Quality breakdown */
  breakdown: {
    pointAccuracy: number;
    spacingConsistency: number;
    measurementPrecision: number;
    confidenceLevel: number;
  };
}

/**
 * Validation Manager
 */
export class ValidationManager {
  private static instance: ValidationManager;
  private validationRules: Map<string, ValidationRule> = new Map();
  private validationHistory: MeasurementValidationResult[] = [];

  private constructor() {
    this.initializeDefaultRules();
    measurementLogger.info('Validation Manager initialized', 'ValidationManager');
  }

  static getInstance(): ValidationManager {
    if (!ValidationManager.instance) {
      ValidationManager.instance = new ValidationManager();
    }
    return ValidationManager.instance;
  }

  /**
   * Initialize default validation rules
   */
  private initializeDefaultRules(): void {
    // Point validation rules
    this.addRule({
      name: 'minimum_points_length',
      description: 'Length measurements require at least 2 points',
      enabled: true,
      severity: ValidationSeverity.ERROR,
      validator: (context) => this.validateMinimumPoints(context, 2, 'length'),
    });

    this.addRule({
      name: 'minimum_points_angle',
      description: 'Angle measurements require exactly 3 points',
      enabled: true,
      severity: ValidationSeverity.ERROR,
      validator: (context) => this.validateExactPoints(context, 3, 'angle'),
    });

    this.addRule({
      name: 'minimum_points_area',
      description: 'Area measurements require at least 3 points',
      enabled: true,
      severity: ValidationSeverity.ERROR,
      validator: (context) => this.validateMinimumPoints(context, 3, 'area'),
    });

    // Pixel spacing validation rules
    this.addRule({
      name: 'pixel_spacing_validity',
      description: 'Pixel spacing must be positive and reasonable',
      enabled: true,
      severity: ValidationSeverity.ERROR,
      validator: (context) => this.validatePixelSpacing(context),
    });

    this.addRule({
      name: 'pixel_spacing_consistency',
      description: 'Column and row spacing should be consistent',
      enabled: true,
      severity: ValidationSeverity.WARNING,
      validator: (context) => this.validatePixelSpacingConsistency(context),
    });

    // Geometric validation rules
    this.addRule({
      name: 'point_proximity',
      description: 'Points should not be too close together',
      enabled: true,
      severity: ValidationSeverity.WARNING,
      validator: (context) => this.validatePointProximity(context),
    });

    this.addRule({
      name: 'measurement_range',
      description: 'Measurement values should be within reasonable ranges',
      enabled: true,
      severity: ValidationSeverity.WARNING,
      validator: (context) => this.validateMeasurementRange(context),
    });

    // Confidence validation rules
    this.addRule({
      name: 'measurement_confidence',
      description: 'Measurement confidence should be adequate',
      enabled: true,
      severity: ValidationSeverity.WARNING,
      validator: (context) => this.validateMeasurementConfidence(context),
    });
  }

  /**
   * Add validation rule
   */
  addRule(rule: ValidationRule): void {
    this.validationRules.set(rule.name, rule);
    measurementLogger.debug(`Added validation rule: ${rule.name}`, 'ValidationManager');
  }

  /**
   * Remove validation rule
   */
  removeRule(ruleName: string): boolean {
    const removed = this.validationRules.delete(ruleName);
    if (removed) {
      measurementLogger.debug(`Removed validation rule: ${ruleName}`, 'ValidationManager');
    }
    return removed;
  }

  /**
   * Enable/disable validation rule
   */
  setRuleEnabled(ruleName: string, enabled: boolean): void {
    const rule = this.validationRules.get(ruleName);
    if (rule) {
      rule.enabled = enabled;
      measurementLogger.debug(`Rule ${ruleName} ${enabled ? 'enabled' : 'disabled'}`, 'ValidationManager');
    }
  }

  /**
   * Validate measurement
   */
  validateMeasurement(context: ValidationContext): MeasurementValidationResult {
    const results: ValidationRuleResult[] = [];
    let criticalErrorCount = 0;
    let warningCount = 0;
    let totalScore = 0;
    let ruleCount = 0;

    // Run all enabled validation rules
    for (const rule of this.validationRules.values()) {
      if (!rule.enabled) continue;

      try {
        const result = rule.validator(context);
        results.push(result);

        if (!result.passed) {
          if (result.severity === ValidationSeverity.ERROR) {
            criticalErrorCount++;
          } else if (result.severity === ValidationSeverity.WARNING) {
            warningCount++;
          }
        }

        // Calculate score contribution
        const ruleScore = result.passed ? 1 : (result.severity === ValidationSeverity.ERROR ? 0 : 0.5);
        totalScore += ruleScore;
        ruleCount++;
      } catch (error) {
        measurementLogger.error(`Error in validation rule ${rule.name}`, 'ValidationManager', {
          rule: rule.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, error instanceof Error ? error : undefined);
      }
    }

    // Calculate overall validation result
    const score = ruleCount > 0 ? totalScore / ruleCount : 1;
    const isValid = criticalErrorCount === 0;
    const hasCriticalErrors = criticalErrorCount > 0;
    const hasWarnings = warningCount > 0;

    // Collect errors, warnings, and suggestions
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    results.forEach(result => {
      if (!result.passed) {
        if (result.severity === ValidationSeverity.ERROR) {
          errors.push(result.message);
        } else if (result.severity === ValidationSeverity.WARNING) {
          warnings.push(result.message);
        }
        suggestions.push(...result.suggestions);
      }
    });

    const validationResult: MeasurementValidationResult = {
      isValid,
      hasCriticalErrors,
      hasWarnings,
      score,
      rules: results,
      errors,
      warnings,
      suggestions,
      metadata: {
        timestamp: new Date(),
        validatedBy: 'ValidationManager',
        validationVersion: '1.0.0',
      },
    };

    // Add to history
    this.addToHistory(validationResult);

    measurementLogger.info(`Validation completed: ${isValid ? 'VALID' : 'INVALID'}`, 'ValidationManager', {
      score,
      errors: errors.length,
      warnings: warnings.length,
      measurementType: context.measurementType,
    });

    return validationResult;
  }

  /**
   * Assess measurement quality
   */
  assessQuality(context: ValidationContext): QualityMetrics {
    const geometricQuality = this.assessGeometricQuality(context);
    const calibrationQuality = this.assessCalibrationQuality(context);
    const dataQuality = this.assessDataQuality(context);

    // Calculate breakdown metrics
    const pointAccuracy = this.calculatePointAccuracy(context);
    const spacingConsistency = this.calculateSpacingConsistency(context);
    const measurementPrecision = this.calculateMeasurementPrecision(context);
    const confidenceLevel = context.result?.confidence || 0;

    const overallQuality = (geometricQuality + calibrationQuality + dataQuality) / 3;

    const metrics: QualityMetrics = {
      geometricQuality,
      calibrationQuality,
      dataQuality,
      overallQuality,
      breakdown: {
        pointAccuracy,
        spacingConsistency,
        measurementPrecision,
        confidenceLevel,
      },
    };

    measurementLogger.debug('Quality assessment completed', 'ValidationManager', {
      overallQuality,
      geometricQuality,
      calibrationQuality,
      dataQuality,
    });

    return metrics;
  }

  /* =============================================================================
   * VALIDATION RULE IMPLEMENTATIONS
   * ============================================================================= */

  private validateMinimumPoints(context: ValidationContext, minPoints: number, type: string): ValidationRuleResult {
    const pointCount = context.points?.length || 0;
    const passed = pointCount >= minPoints;

    return {
      rule: `minimum_points_${type}`,
      passed,
      severity: ValidationSeverity.ERROR,
      message: passed
        ? `${type} measurement has sufficient points (${pointCount})`
        : `${type} measurement requires at least ${minPoints} points, got ${pointCount}`,
      suggestions: passed ? [] : [`Add ${minPoints - pointCount} more points for ${type} measurement`],
      metadata: { requiredPoints: minPoints, actualPoints: pointCount },
    };
  }

  private validateExactPoints(context: ValidationContext, exactPoints: number, type: string): ValidationRuleResult {
    const pointCount = context.points?.length || 0;
    const passed = pointCount === exactPoints;

    return {
      rule: `exact_points_${type}`,
      passed,
      severity: ValidationSeverity.ERROR,
      message: passed
        ? `${type} measurement has correct number of points (${pointCount})`
        : `${type} measurement requires exactly ${exactPoints} points, got ${pointCount}`,
      suggestions: passed ? [] : [`Adjust to exactly ${exactPoints} points for ${type} measurement`],
      metadata: { requiredPoints: exactPoints, actualPoints: pointCount },
    };
  }

  private validatePixelSpacing(context: ValidationContext): ValidationRuleResult {
    if (!context.pixelSpacing) {
      return {
        rule: 'pixel_spacing_validity',
        passed: false,
        severity: ValidationSeverity.ERROR,
        message: 'Pixel spacing is required but not provided',
        suggestions: ['Provide valid pixel spacing information'],
      };
    }

    const isValid = BaseMeasurementValidation.validatePixelSpacing(context.pixelSpacing);

    return {
      rule: 'pixel_spacing_validity',
      passed: isValid,
      severity: ValidationSeverity.ERROR,
      message: isValid ? 'Pixel spacing is valid' : 'Invalid pixel spacing values',
      suggestions: isValid ? [] : ['Check pixel spacing values are positive and reasonable'],
      metadata: { pixelSpacing: context.pixelSpacing },
    };
  }

  private validatePixelSpacingConsistency(context: ValidationContext): ValidationRuleResult {
    if (!context.pixelSpacing) {
      return {
        rule: 'pixel_spacing_consistency',
        passed: true,
        severity: ValidationSeverity.WARNING,
        message: 'No pixel spacing to validate',
        suggestions: [],
      };
    }

    const columnSpacing = SafePropertyAccess.safePropertyAccess(context.pixelSpacing, 'columnSpacing');
    const rowSpacing = SafePropertyAccess.safePropertyAccess(context.pixelSpacing, 'rowSpacing');

    const ratio = columnSpacing / rowSpacing;
    const consistent = ratio >= 0.8 && ratio <= 1.25; // Allow 25% variation

    return {
      rule: 'pixel_spacing_consistency',
      passed: consistent,
      severity: ValidationSeverity.WARNING,
      message: consistent
        ? 'Pixel spacing is consistent'
        : `Pixel spacing inconsistent: ${columnSpacing.toFixed(3)} x ${rowSpacing.toFixed(3)}mm`,
      suggestions: consistent ? [] : ['Check if non-square pixels are expected for this imaging protocol'],
      metadata: { columnSpacing, rowSpacing, ratio },
    };
  }

  private validatePointProximity(context: ValidationContext): ValidationRuleResult {
    if (!context.points || context.points.length < 2) {
      return {
        rule: 'point_proximity',
        passed: true,
        severity: ValidationSeverity.WARNING,
        message: 'Insufficient points for proximity check',
        suggestions: [],
      };
    }

    const minDistance = 2; // pixels
    let hasClosePoints = false;
    const distances: number[] = [];

    for (let i = 0; i < context.points.length - 1; i++) {
      // eslint-disable-next-line security/detect-object-injection
      const p1 = context.points[i];
      const p2 = SafePropertyAccess.safeArrayAccess(context.points, i + 1);
      if (!p2) continue;

      const distance = Math.sqrt(
        Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2),
      );
      distances.push(distance);

      if (distance < minDistance) {
        hasClosePoints = true;
      }
    }

    return {
      rule: 'point_proximity',
      passed: !hasClosePoints,
      severity: ValidationSeverity.WARNING,
      message: hasClosePoints
        ? 'Some points are very close together'
        : 'Point spacing is adequate',
      suggestions: hasClosePoints ? ['Consider spacing points further apart for better accuracy'] : [],
      metadata: { minDistance: Math.min(...distances), avgDistance: distances.reduce((a, b) => a + b, 0) / distances.length },
    };
  }

  private validateMeasurementRange(context: ValidationContext): ValidationRuleResult {
    if (!context.result) {
      return {
        rule: 'measurement_range',
        passed: true,
        severity: ValidationSeverity.WARNING,
        message: 'No measurement result to validate',
        suggestions: [],
      };
    }

    const value = context.result.value;
    const unit = context.result.unit;
    let passed = true;
    let message = 'Measurement value is within expected range';
    const suggestions: string[] = [];

    // Define reasonable ranges for different measurement types
    if (unit === 'mm') {
      if (value < 0.1 || value > 1000) {
        passed = false;
        message = `Linear measurement ${value.toFixed(2)}mm is outside typical range (0.1-1000mm)`;
        suggestions.push('Verify measurement accuracy and calibration');
      }
    } else if (unit === 'mm²') {
      if (value < 0.01 || value > 1000000) {
        passed = false;
        message = `Area measurement ${value.toFixed(2)}mm² is outside typical range (0.01-1,000,000mm²)`;
        suggestions.push('Verify area calculation and calibration');
      }
    } else if (unit === 'degrees') {
      if (value < 0 || value > 180) {
        passed = false;
        message = `Angle measurement ${value.toFixed(1)}° is outside valid range (0-180°)`;
        suggestions.push('Check angle calculation method');
      }
    }

    return {
      rule: 'measurement_range',
      passed,
      severity: ValidationSeverity.WARNING,
      message,
      suggestions,
      metadata: { value, unit },
    };
  }

  private validateMeasurementConfidence(context: ValidationContext): ValidationRuleResult {
    if (!context.result) {
      return {
        rule: 'measurement_confidence',
        passed: true,
        severity: ValidationSeverity.WARNING,
        message: 'No measurement result to validate',
        suggestions: [],
      };
    }

    const confidence = context.result.confidence;
    const minConfidence = 0.7;
    const passed = confidence >= minConfidence;

    return {
      rule: 'measurement_confidence',
      passed,
      severity: ValidationSeverity.WARNING,
      message: passed
        ? `Measurement confidence is adequate (${(confidence * 100).toFixed(1)}%)`
        : `Low measurement confidence (${(confidence * 100).toFixed(1)}%)`,
      suggestions: passed ? [] : [
        'Check calibration accuracy',
        'Verify measurement method',
        'Consider re-measuring with better technique',
      ],
      metadata: { confidence, threshold: minConfidence },
    };
  }

  /* =============================================================================
   * QUALITY ASSESSMENT METHODS
   * ============================================================================= */

  private assessGeometricQuality(context: ValidationContext): number {
    if (!context.points || context.points.length === 0) return 0;

    let quality = 1.0;

    // Assess point distribution
    const pointDistribution = this.assessPointDistribution(context.points);
    quality *= pointDistribution;

    // Assess measurement stability
    const stability = this.assessMeasurementStability(context);
    quality *= stability;

    return Math.max(0, Math.min(1, quality));
  }

  private assessCalibrationQuality(context: ValidationContext): number {
    if (!context.pixelSpacing) return 0.5; // Default for missing calibration

    const consistency = this.calculateSpacingConsistency(context);
    const resolution = this.assessResolutionAdequacy(context.pixelSpacing);

    return (consistency + resolution) / 2;
  }

  private assessDataQuality(context: ValidationContext): number {
    let quality = 1.0;

    // Check if all required data is present
    const completeness = this.assessDataCompleteness(context);
    quality *= completeness;

    // Check data integrity
    const integrity = this.assessDataIntegrity(context);
    quality *= integrity;

    return Math.max(0, Math.min(1, quality));
  }

  private calculatePointAccuracy(context: ValidationContext): number {
    if (!context.points || context.points.length < 2) return 1.0;

    // Simple heuristic: closer points may indicate less accuracy due to user input precision
    const distances: number[] = [];
    for (let i = 0; i < context.points.length - 1; i++) {
      // eslint-disable-next-line security/detect-object-injection
      const p1 = context.points[i];
      const p2 = SafePropertyAccess.safeArrayAccess(context.points, i + 1);
      if (!p2) continue;

      const distance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      distances.push(distance);
    }

    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    return Math.min(1, avgDistance / 10); // Normalize to 0-1 scale
  }

  private calculateSpacingConsistency(context: ValidationContext): number {
    if (!context.pixelSpacing) return 0.5;

    const columnSpacing = SafePropertyAccess.safePropertyAccess(context.pixelSpacing, 'columnSpacing');
    const rowSpacing = SafePropertyAccess.safePropertyAccess(context.pixelSpacing, 'rowSpacing');

    const ratio = Math.min(columnSpacing, rowSpacing) / Math.max(columnSpacing, rowSpacing);
    return ratio; // Closer to 1 means more consistent
  }

  private calculateMeasurementPrecision(context: ValidationContext): number {
    if (!context.result) return 0.5;

    // Use confidence as a proxy for precision
    return context.result.confidence;
  }

  private assessPointDistribution(points: Point3[]): number {
    if (points.length < 3) return 1.0;

    // Check if points are well distributed (not clustered)
    const distances: number[] = [];
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        // eslint-disable-next-line security/detect-object-injection
        const p1 = points[i];
        // eslint-disable-next-line security/detect-object-injection
        const p2 = points[j];
        const distance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        distances.push(distance);
      }
    }

    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    const variance = distances.reduce((acc, d) => acc + Math.pow(d - avgDistance, 2), 0) / distances.length;
    const stdDev = Math.sqrt(variance);

    // Lower coefficient of variation indicates better distribution
    const cv = avgDistance > 0 ? stdDev / avgDistance : 1;
    return Math.max(0, 1 - cv);
  }

  private assessMeasurementStability(_context: ValidationContext): number {
    // Placeholder for stability assessment
    // In practice, this could check for measurement repeatability
    return 0.9;
  }

  private assessResolutionAdequacy(pixelSpacing: PixelSpacing): number {
    const columnSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'columnSpacing');
    const rowSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'rowSpacing');
    const avgSpacing = (columnSpacing + rowSpacing) / 2;

    // Rate resolution adequacy
    if (avgSpacing <= 0.5) return 1.0;
    if (avgSpacing <= 1.0) return 0.9;
    if (avgSpacing <= 2.0) return 0.8;
    if (avgSpacing <= 5.0) return 0.6;
    return 0.4;
  }

  private assessDataCompleteness(context: ValidationContext): number {
    let score = 0;
    let total = 0;

    // Check for required fields
    if (context.measurementType) { score++; total++; }
    if (context.points && context.points.length > 0) { score++; total++; }
    if (context.pixelSpacing) { score++; total++; }

    return total > 0 ? score / total : 0;
  }

  private assessDataIntegrity(context: ValidationContext): number {
    // Check for obvious data integrity issues
    if (context.points) {
      for (const point of context.points) {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) {
          return 0.5; // Partially corrupt data
        }
      }
    }

    if (context.pixelSpacing) {
      const columnSpacing = SafePropertyAccess.safePropertyAccess(context.pixelSpacing, 'columnSpacing');
      const rowSpacing = SafePropertyAccess.safePropertyAccess(context.pixelSpacing, 'rowSpacing');

      if (!Number.isFinite(columnSpacing) || !Number.isFinite(rowSpacing)) {
        return 0.5;
      }
    }

    return 1.0; // Data appears intact
  }

  /**
   * Add validation result to history
   */
  private addToHistory(result: MeasurementValidationResult): void {
    this.validationHistory.push(result);

    // Keep only last 1000 validations
    if (this.validationHistory.length > 1000) {
      this.validationHistory = this.validationHistory.slice(-1000);
    }
  }

  /**
   * Get validation history
   */
  getValidationHistory(): MeasurementValidationResult[] {
    return [...this.validationHistory];
  }

  /**
   * Get validation statistics
   */
  getValidationStatistics(): {
    totalValidations: number;
    validCount: number;
    invalidCount: number;
    averageScore: number;
    commonErrors: Record<string, number>;
    } {
    const total = this.validationHistory.length;
    const valid = this.validationHistory.filter(v => v.isValid).length;
    const invalid = total - valid;
    const avgScore = total > 0
      ? this.validationHistory.reduce((sum, v) => sum + v.score, 0) / total
      : 0;

    const errorCounts: Record<string, number> = {};
    this.validationHistory.forEach(validation => {
      validation.errors.forEach(error => {
        // eslint-disable-next-line security/detect-object-injection
        errorCounts[error] = (errorCounts[error] || 0) + 1;
      });
    });

    return {
      totalValidations: total,
      validCount: valid,
      invalidCount: invalid,
      averageScore: avgScore,
      commonErrors: errorCounts,
    };
  }
}

// Export singleton instance
export const validationManager = ValidationManager.getInstance();
