/**
 * Linear Measurement Calculator
 * Handles linear distance and angle calculations
 */

import {
  Point3,
  PixelSpacing,
  MeasurementResult,
  CalibrationData,
  ICalculator,
  SafePropertyAccess,
  measurementLogger,
  MeasurementValidation,
} from '../interfaces/MeasurementTypes';

/**
 * Linear measurement calculator for distance and angle measurements
 */
export class LinearCalculator implements ICalculator {
  private initialized = false;

  getName(): string {
    return 'LinearCalculator';
  }

  async initialize(): Promise<void> {
    this.initialized = true;
    measurementLogger.info('Linear Calculator initialized', this.getName());
  }

  cleanup(): void {
    this.initialized = false;
    measurementLogger.info('Linear Calculator cleaned up', this.getName());
  }

  /**
   * Calculate linear distance between points
   */
  calculateLength(
    points: Point3[],
    pixelSpacing: PixelSpacing,
    imageId?: string,
  ): MeasurementResult {
    if (!this.initialized) {
      throw new Error('LinearCalculator not initialized');
    }

    if (!MeasurementValidation.validatePoints(points, 2)) {
      throw new Error('At least 2 points required for length measurement');
    }

    if (!MeasurementValidation.validatePixelSpacing(pixelSpacing)) {
      throw new Error('Invalid pixel spacing for length measurement');
    }

    let totalDistance = 0;
    const method = points.length === 2 ? 'straight-line' : 'multi-point-path';

    // Calculate distance between consecutive points
    for (let i = 0; i < points.length - 1; i++) {
      // eslint-disable-next-line security/detect-object-injection
      const p1 = points[i];
      const p2 = SafePropertyAccess.safeArrayAccess(points, i + 1);
      if (!p2) continue;

      // Calculate distance in pixel space with safe property access
      const dx = (p2.x - p1.x) * SafePropertyAccess.safePropertyAccess(pixelSpacing, 'columnSpacing');
      const dy = (p2.y - p1.y) * SafePropertyAccess.safePropertyAccess(pixelSpacing, 'rowSpacing');
      const sliceThickness = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'sliceThickness');
      const dz = sliceThickness ? (p2.z - p1.z) * sliceThickness : 0;

      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      totalDistance += distance;
    }

    const calibration: CalibrationData = {
      pixelSpacing,
      accuracy: this.estimateCalibrationAccuracy(pixelSpacing),
      calibrationSource: imageId ? 'dicom' : 'manual',
      lastCalibrated: new Date(),
    };
    const confidence = this.calculateMeasurementConfidence(method, calibration);

    const result: MeasurementResult = {
      value: totalDistance,
      unit: 'mm',
      confidence,
      metadata: {
        timestamp: new Date(),
        method,
        calibration,
        imageContext: {
          imageId,
        },
      },
      alternativeUnits: [
        { value: totalDistance / 10, unit: 'cm' },
        { value: totalDistance / 25.4, unit: 'inch' },
      ],
    };

    measurementLogger.info(`Calculated length: ${totalDistance.toFixed(2)}mm`, this.getName(), {
      value: totalDistance,
      unit: 'mm',
      method,
      pointCount: points.length,
    });

    return result;
  }

  /**
   * Calculate angle between three points
   */
  calculateAngle(
    points: [Point3, Point3, Point3],
    pixelSpacing: PixelSpacing,
    imageId?: string,
  ): MeasurementResult {
    if (!this.initialized) {
      throw new Error('LinearCalculator not initialized');
    }

    if (points.length !== 3) {
      throw new Error('Angle measurement requires exactly 3 points');
    }

    if (!MeasurementValidation.validatePixelSpacing(pixelSpacing)) {
      throw new Error('Invalid pixel spacing for angle measurement');
    }

    const [p1, p2, p3] = points;

    // Convert to world coordinates using safe property access
    const columnSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'columnSpacing');
    const rowSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'rowSpacing');
    const sliceThickness = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'sliceThickness');

    const v1x = (p1.x - p2.x) * columnSpacing;
    const v1y = (p1.y - p2.y) * rowSpacing;
    const v1z = sliceThickness ? (p1.z - p2.z) * sliceThickness : 0;

    const v2x = (p3.x - p2.x) * columnSpacing;
    const v2y = (p3.y - p2.y) * rowSpacing;
    const v2z = sliceThickness ? (p3.z - p2.z) * sliceThickness : 0;

    // Calculate dot product and magnitudes
    const dotProduct = v1x * v2x + v1y * v2y + v1z * v2z;
    const mag1 = Math.sqrt(v1x * v1x + v1y * v1y + v1z * v1z);
    const mag2 = Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z);

    if (mag1 === 0 || mag2 === 0) {
      throw new Error('Cannot calculate angle with zero-length vectors');
    }

    // Calculate angle in radians then convert to degrees
    const angleRad = Math.acos(Math.max(-1, Math.min(1, dotProduct / (mag1 * mag2))));
    const angleDeg = (angleRad * 180) / Math.PI;

    const calibration: CalibrationData = {
      pixelSpacing,
      accuracy: this.estimateCalibrationAccuracy(pixelSpacing),
      calibrationSource: imageId ? 'dicom' : 'manual',
      lastCalibrated: new Date(),
    };
    const confidence = this.calculateMeasurementConfidence('angle', calibration);

    const result: MeasurementResult = {
      value: angleDeg,
      unit: 'degrees',
      confidence,
      metadata: {
        timestamp: new Date(),
        method: 'three-point-angle',
        calibration,
        imageContext: {
          imageId,
        },
      },
      alternativeUnits: [
        { value: angleRad, unit: 'radians' },
      ],
    };

    measurementLogger.info(`Calculated angle: ${angleDeg.toFixed(2)}°`, this.getName(), {
      value: angleDeg,
      unit: 'degrees',
      vertexPoint: p2,
    });

    return result;
  }

  /**
   * Estimate calibration accuracy based on pixel spacing
   */
  private estimateCalibrationAccuracy(pixelSpacing: PixelSpacing): number {
    // Higher accuracy for smaller pixel spacing (higher resolution)
    const columnSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'columnSpacing');
    const rowSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'rowSpacing');
    const avgSpacing = (columnSpacing + rowSpacing) / 2;

    if (avgSpacing <= 0.1) return 0.95;
    if (avgSpacing <= 0.5) return 0.90;
    if (avgSpacing <= 1.0) return 0.85;
    if (avgSpacing <= 2.0) return 0.75;
    return 0.65;
  }

  /**
   * Calculate measurement confidence based on method and calibration
   */
  private calculateMeasurementConfidence(method: string, calibration: CalibrationData): number {
    let baseConfidence = 0.8;

    // Adjust based on method
    switch (method) {
      case 'straight-line':
        baseConfidence = 0.95;
        break;
      case 'multi-point-path':
        baseConfidence = 0.90;
        break;
      case 'angle':
        baseConfidence = 0.85;
        break;
    }

    // Adjust based on calibration accuracy
    return Math.min(0.99, baseConfidence * calibration.accuracy);
  }
}

// Factory function
export function createLinearCalculator(): LinearCalculator {
  return new LinearCalculator();
}
