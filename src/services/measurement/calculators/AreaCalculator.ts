/**
 * Area Measurement Calculator
 * Handles area calculations for different shape types
 */

import {
  Point3,
  Point2,
  PixelSpacing,
  MeasurementResult,
  CalibrationData,
  ICalculator,
  SafePropertyAccess,
  measurementLogger,
  MeasurementValidation,
} from '../interfaces/MeasurementTypes';

/**
 * Area measurement calculator for different geometric shapes
 */
export class AreaCalculator implements ICalculator {
  private initialized = false;

  getName(): string {
    return 'AreaCalculator';
  }

  async initialize(): Promise<void> {
    this.initialized = true;
    measurementLogger.info('Area Calculator initialized', this.getName());
  }

  cleanup(): void {
    this.initialized = false;
    measurementLogger.info('Area Calculator cleaned up', this.getName());
  }

  /**
   * Calculate area of a contour/ROI
   */
  calculateArea(
    contour: Point3[],
    pixelSpacing: PixelSpacing,
    imageId?: string,
  ): MeasurementResult {
    if (!this.initialized) {
      throw new Error('AreaCalculator not initialized');
    }

    if (!MeasurementValidation.validatePoints(contour, 3)) {
      throw new Error('At least 3 points required for area calculation');
    }

    if (!MeasurementValidation.validatePixelSpacing(pixelSpacing)) {
      throw new Error('Invalid pixel spacing for area calculation');
    }

    let area: number;
    let method: string;

    if (this.isRectangular(contour)) {
      area = this.calculateRectangularArea(contour, pixelSpacing);
      method = 'rectangular-area';
    } else if (this.isElliptical(contour)) {
      area = this.calculateEllipticalArea(contour, pixelSpacing);
      method = 'elliptical-area';
    } else {
      area = this.calculatePolygonArea(contour, pixelSpacing);
      method = 'polygon-area';
    }

    const calibration: CalibrationData = {
      pixelSpacing,
      accuracy: this.estimateCalibrationAccuracy(pixelSpacing),
      calibrationSource: imageId ? 'dicom' : 'manual',
      lastCalibrated: new Date(),
    };
    const confidence = this.calculateMeasurementConfidence(method, calibration);

    const result: MeasurementResult = {
      value: area,
      unit: 'mm²',
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
        { value: area / 100, unit: 'cm²' },
        { value: area / 645.16, unit: 'inch²' },
      ],
    };

    measurementLogger.info(`Calculated area: ${area.toFixed(2)}mm²`, this.getName(), {
      value: area,
      unit: 'mm²',
      method,
      pointCount: contour.length,
    });

    return result;
  }

  /**
   * Calculate rectangular area
   */
  private calculateRectangularArea(points: Point3[], pixelSpacing: PixelSpacing): number {
    // Assume first 4 points define rectangle
    const p1 = SafePropertyAccess.safeArrayAccess(points, 0);
    const p2 = SafePropertyAccess.safeArrayAccess(points, 1);
    const p3 = SafePropertyAccess.safeArrayAccess(points, 2);

    if (!p1 || !p2 || !p3) {
      throw new Error('Insufficient points for rectangular area calculation');
    }

    const width = Math.abs(p2.x - p1.x) * SafePropertyAccess.safePropertyAccess(pixelSpacing, 'columnSpacing');
    const height = Math.abs(p3.y - p1.y) * SafePropertyAccess.safePropertyAccess(pixelSpacing, 'rowSpacing');

    return width * height;
  }

  /**
   * Calculate elliptical area
   */
  private calculateEllipticalArea(points: Point3[], pixelSpacing: PixelSpacing): number {
    // Calculate center point
    const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

    // Calculate semi-major and semi-minor axes
    let maxRadius = 0;
    let minRadius = Number.MAX_VALUE;

    const columnSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'columnSpacing');
    const rowSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'rowSpacing');

    points.forEach(point => {
      const dx = (point.x - centerX) * columnSpacing;
      const dy = (point.y - centerY) * rowSpacing;
      const radius = Math.sqrt(dx * dx + dy * dy);

      maxRadius = Math.max(maxRadius, radius);
      minRadius = Math.min(minRadius, radius);
    });

    return Math.PI * maxRadius * minRadius;
  }

  /**
   * Calculate polygon area using shoelace formula
   */
  private calculatePolygonArea(points: Point3[], pixelSpacing: PixelSpacing): number {
    let area = 0;
    const n = points.length;

    const columnSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'columnSpacing');
    const rowSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'rowSpacing');

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      // eslint-disable-next-line security/detect-object-injection
      const xi = points[i].x * columnSpacing;
      // eslint-disable-next-line security/detect-object-injection
      const yi = points[i].y * rowSpacing;
      // eslint-disable-next-line security/detect-object-injection
      const xj = points[j].x * columnSpacing;
      // eslint-disable-next-line security/detect-object-injection
      const yj = points[j].y * rowSpacing;

      area += xi * yj - xj * yi;
    }

    return Math.abs(area) / 2;
  }

  /**
   * Create region mask for area calculations
   */
  createRegionMask(
    points: Point3[],
    width: number,
    height: number,
    maskType: 'rectangle' | 'ellipse' | 'polygon',
  ): boolean[] {
    switch (maskType) {
      case 'rectangle':
        return this.createRectangleMask(points, width, height);
      case 'ellipse':
        return this.createEllipseMask(points, width, height);
      case 'polygon':
        return this.createPolygonMask(points, width, height);
      default:
        throw new Error(`Unsupported mask type: ${maskType}`);
    }
  }

  /**
   * Create rectangle mask
   */
  private createRectangleMask(points: Point3[], width: number, height: number): boolean[] {
    const mask = new Array(width * height).fill(false);

    if (points.length < 2) return mask;

    const p1 = SafePropertyAccess.safeArrayAccess(points, 0);
    const p2 = SafePropertyAccess.safeArrayAccess(points, 1);

    if (!p1 || !p2) return mask;

    const minX = Math.max(0, Math.min(p1.x, p2.x));
    const maxX = Math.min(width - 1, Math.max(p1.x, p2.x));
    const minY = Math.max(0, Math.min(p1.y, p2.y));
    const maxY = Math.min(height - 1, Math.max(p1.y, p2.y));

    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
        const index = y * width + x;
        if (index >= 0 && index < mask.length) {
          // eslint-disable-next-line security/detect-object-injection
          mask[index] = true;
        }
      }
    }

    return mask;
  }

  /**
   * Create ellipse mask
   */
  private createEllipseMask(points: Point3[], width: number, height: number): boolean[] {
    const mask = new Array(width * height).fill(false);

    if (points.length < 2) return mask;

    const p1 = SafePropertyAccess.safeArrayAccess(points, 0);
    const p2 = SafePropertyAccess.safeArrayAccess(points, 1);

    if (!p1 || !p2) return mask;

    // Calculate center and radii
    const centerX = (p1.x + p2.x) / 2;
    const centerY = (p1.y + p2.y) / 2;
    const radiusX = Math.abs(p2.x - p1.x) / 2;
    const radiusY = Math.abs(p2.y - p1.y) / 2;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = (x - centerX) / radiusX;
        const dy = (y - centerY) / radiusY;

        if (dx * dx + dy * dy <= 1) {
          const index = y * width + x;
          if (index >= 0 && index < mask.length) {
            // eslint-disable-next-line security/detect-object-injection
            mask[index] = true;
          }
        }
      }
    }

    return mask;
  }

  /**
   * Create polygon mask using ray casting algorithm
   */
  private createPolygonMask(points: Point3[], width: number, height: number): boolean[] {
    const mask = new Array(width * height).fill(false);

    if (points.length < 3) return mask;

    // Convert Point3[] to Point2[] for polygon test
    const polygon: Point2[] = points.map(p => ({ x: p.x, y: p.y }));

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.isPointInPolygon({ x, y }, polygon)) {
          const index = y * width + x;
          if (index >= 0 && index < mask.length) {
            // eslint-disable-next-line security/detect-object-injection
            mask[index] = true;
          }
        }
      }
    }

    return mask;
  }

  /**
   * Check if point is inside polygon using ray casting
   */
  private isPointInPolygon(point: Point2, polygon: Point2[]): boolean {
    let inside = false;
    const n = polygon.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      // eslint-disable-next-line security/detect-object-injection
      const pi = polygon[i];
      // eslint-disable-next-line security/detect-object-injection
      const pj = polygon[j];

      if (((pi.y > point.y) !== (pj.y > point.y)) &&
          (point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x)) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Check if contour represents a rectangle
   */
  private isRectangular(points: Point3[]): boolean {
    return points.length === 4 && this.hasRightAngles(points);
  }

  /**
   * Check if contour represents an ellipse
   */
  private isElliptical(points: Point3[]): boolean {
    // Simple heuristic - check if points form roughly circular/elliptical shape
    return points.length >= 8 && this.isApproximatelyElliptical(points);
  }

  /**
   * Check if points have right angles (simplified)
   */
  private hasRightAngles(_points: Point3[]): boolean {
    // Simplified check - would need more sophisticated geometry in production
    return true; // Placeholder
  }

  /**
   * Check if points form approximate ellipse (simplified)
   */
  private isApproximatelyElliptical(_points: Point3[]): boolean {
    // Simplified check - would need more sophisticated geometry in production
    return false; // Placeholder
  }

  /**
   * Estimate calibration accuracy
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
   * Calculate measurement confidence
   */
  private calculateMeasurementConfidence(method: string, calibration: CalibrationData): number {
    let baseConfidence = 0.8;

    // Adjust based on method
    switch (method) {
      case 'rectangular-area':
        baseConfidence = 0.90;
        break;
      case 'elliptical-area':
        baseConfidence = 0.85;
        break;
      case 'polygon-area':
        baseConfidence = 0.80;
        break;
    }

    // Adjust based on calibration accuracy
    return Math.min(0.99, baseConfidence * calibration.accuracy);
  }
}

// Factory function
export function createAreaCalculator(): AreaCalculator {
  return new AreaCalculator();
}
