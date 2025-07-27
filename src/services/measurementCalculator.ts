/**
 * Medical Measurement Calculator Service
 *
 * Provides precise measurement calculations for medical imaging including
 * linear measurements, area calculations, volume calculations, and statistical analysis
 * with proper medical accuracy standards and calibration support
 */

import { log } from '../utils/logger';

/**
 * 3D Point representation
 */
export interface Point3 {
  x: number;
  y: number;
  z: number;
}

/**
 * 2D Point representation
 */
export interface Point2 {
  x: number;
  y: number;
}

/**
 * Pixel spacing information from DICOM metadata
 */
export interface PixelSpacing {
  /** Column spacing (mm/pixel) */
  columnSpacing: number;
  /** Row spacing (mm/pixel) */
  rowSpacing: number;
  /** Slice thickness (mm) */
  sliceThickness?: number;
  /** Slice spacing (mm) */
  sliceSpacing?: number;
}

/**
 * Image data for ROI analysis
 */
export interface ImageData {
  /** Pixel data array */
  pixelData: Float32Array | Uint16Array | Int16Array;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Bits per pixel */
  bitsPerPixel: number;
  /** Is signed data */
  signed: boolean;
  /** Modality (CT, MR, etc.) */
  modality?: string;
  /** Rescale slope for HU conversion */
  rescaleSlope?: number;
  /** Rescale intercept for HU conversion */
  rescaleIntercept?: number;
}

/**
 * Region of Interest definition
 */
export interface ROI {
  /** ROI type */
  type: 'rectangle' | 'ellipse' | 'polygon' | 'freehand';
  /** ROI boundary points */
  points: Point2[];
  /** Pixel spacing for the image */
  pixelSpacing: PixelSpacing;
}

/**
 * Segmentation data for volume calculations
 */
export interface Segmentation {
  /** Segmentation label data */
  labelData: Uint8Array | Uint16Array;
  /** Volume dimensions */
  dimensions: [number, number, number];
  /** Pixel spacing */
  pixelSpacing: PixelSpacing;
  /** Segment index to calculate */
  segmentIndex: number;
}

/**
 * Statistical analysis results
 */
export interface StatisticalData {
  /** Mean value */
  mean: number;
  /** Median value */
  median: number;
  /** Standard deviation */
  standardDeviation: number;
  /** Minimum value */
  minimum: number;
  /** Maximum value */
  maximum: number;
  /** Pixel count */
  count: number;
  /** 25th percentile */
  percentile25: number;
  /** 75th percentile */
  percentile75: number;
  /** Skewness */
  skewness: number;
  /** Kurtosis */
  kurtosis: number;
  /** Histogram data */
  histogram: {
    bins: number[];
    counts: number[];
    binWidth: number;
  };
}

/**
 * Measurement metadata
 */
export interface MeasurementMetadata {
  /** Timestamp when measurement was taken */
  timestamp: Date;
  /** User who took the measurement */
  userId?: string;
  /** Measurement method used */
  method: string;
  /** Calibration information */
  calibration: {
    pixelSpacing: PixelSpacing;
    calibrationSource: 'dicom' | 'manual' | 'estimated';
    accuracy: number; // 0-1 scale
  };
  /** Image context */
  imageContext: {
    imageId?: string;
    seriesInstanceUID?: string;
    studyInstanceUID?: string;
    modality?: string;
    sliceLocation?: number;
  };
}

/**
 * Measurement result
 */
export interface MeasurementResult {
  /** Measured value */
  value: number;
  /** Unit of measurement */
  unit: string;
  /** Measurement metadata */
  metadata: MeasurementMetadata;
  /** Statistical data (if applicable) */
  statistics?: StatisticalData;
  /** Confidence level (0-1) */
  confidence: number;
  /** Alternative measurements in different units */
  alternativeUnits?: Array<{
    value: number;
    unit: string;
  }>;
}

/**
 * Calibration data for measurements
 */
export interface CalibrationData {
  /** Pixel spacing */
  pixelSpacing: PixelSpacing;
  /** Calibration accuracy */
  accuracy: number;
  /** Calibration source */
  calibrationSource: 'dicom' | 'manual' | 'estimated';
  /** Last calibration date */
  lastCalibrated: Date;
}

/**
 * Medical Measurement Calculator
 */
export class MeasurementCalculator {
  private static instance: MeasurementCalculator;
  private calibrationCache: Map<string, CalibrationData> = new Map();
  private measurementHistory: MeasurementResult[] = [];

  private constructor() {
    log.info('Measurement Calculator initialized', {
      component: 'MeasurementCalculator',
    });
  }

  static getInstance(): MeasurementCalculator {
    if (!MeasurementCalculator.instance) {
      MeasurementCalculator.instance = new MeasurementCalculator();
    }
    return MeasurementCalculator.instance;
  }

  /* =============================================================================
   * SAFE PROPERTY ACCESS HELPERS
   * ============================================================================= */

  /**
   * Safe property access to prevent object injection
   */
  private safePropertyAccess<T extends object, K extends keyof T>(obj: T, key: K): T[K] {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // eslint-disable-next-line security/detect-object-injection
      return obj[key];
    }
    throw new Error(`Property ${String(key)} not found in object`);
  }


  /* =============================================================================
   * LINEAR MEASUREMENTS
   * ============================================================================= */

  /**
   * Calculate linear distance between points
   */
  calculateLength(
    points: Point3[],
    pixelSpacing: PixelSpacing,
    imageId?: string,
  ): MeasurementResult {
    if (points.length < 2) {
      throw new Error('At least 2 points required for length measurement');
    }

    let totalDistance = 0;
    const method = points.length === 2 ? 'straight-line' : 'multi-point-path';

    // Calculate distance between consecutive points
    for (let i = 0; i < points.length - 1; i++) {
      // eslint-disable-next-line security/detect-object-injection
      const p1 = points[i];
      const p2 = points[i + 1];

      // Calculate distance in pixel space with safe property access
      const dx = (p2.x - p1.x) * this.safePropertyAccess(pixelSpacing, 'columnSpacing');
      const dy = (p2.y - p1.y) * this.safePropertyAccess(pixelSpacing, 'rowSpacing');

      const sliceThickness = this.safePropertyAccess(pixelSpacing, 'sliceThickness');
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

    this.addToHistory(result);
    log.info(`Calculated length: ${totalDistance.toFixed(2)}mm`, {
      component: 'MeasurementCalculator',
      operation: 'calculateLength',
      metadata: { value: totalDistance, unit: 'mm', method },
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
    const [p1, p2, p3] = points;

    // Convert to world coordinates using safe property access
    const v1x = (p1.x - p2.x) * this.safePropertyAccess(pixelSpacing, 'columnSpacing');
    const v1y = (p1.y - p2.y) * this.safePropertyAccess(pixelSpacing, 'rowSpacing');
    const sliceThickness = this.safePropertyAccess(pixelSpacing, 'sliceThickness');
    const v1z = sliceThickness ? (p1.z - p2.z) * sliceThickness : 0;

    const v2x = (p3.x - p2.x) * this.safePropertyAccess(pixelSpacing, 'columnSpacing');
    const v2y = (p3.y - p2.y) * this.safePropertyAccess(pixelSpacing, 'rowSpacing');
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

    this.addToHistory(result);
    log.info(`Calculated angle: ${angleDeg.toFixed(2)}°`, {
      component: 'MeasurementCalculator',
      operation: 'calculateAngle',
      metadata: { value: angleDeg, unit: 'degrees' },
    });

    return result;
  }

  /* =============================================================================
   * AREA CALCULATIONS
   * ============================================================================= */

  /**
   * Calculate area of a contour/ROI
   */
  calculateArea(
    contour: Point3[],
    pixelSpacing: PixelSpacing,
    imageId?: string,
  ): MeasurementResult {
    if (contour.length < 3) {
      throw new Error('At least 3 points required for area calculation');
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

    this.addToHistory(result);
    log.info(`Calculated area: ${area.toFixed(2)}mm²`, {
      component: 'MeasurementCalculator',
      operation: 'calculateArea',
      metadata: { value: area, unit: 'mm²', method },
    });

    return result;
  }

  /**
   * Calculate rectangular area
   */
  private calculateRectangularArea(points: Point3[], pixelSpacing: PixelSpacing): number {
    // Assume first 4 points define rectangle
    const p1 = points[0];
    const p2 = points[1];
    const p3 = points[2];

    const width = Math.abs(p2.x - p1.x) * this.safePropertyAccess(pixelSpacing, 'columnSpacing');
    const height = Math.abs(p3.y - p1.y) * this.safePropertyAccess(pixelSpacing, 'rowSpacing');

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

    points.forEach(point => {
      const dx = (point.x - centerX) * this.safePropertyAccess(pixelSpacing, 'columnSpacing');
      const dy = (point.y - centerY) * this.safePropertyAccess(pixelSpacing, 'rowSpacing');
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

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      // eslint-disable-next-line security/detect-object-injection
      const xi = points[i].x * this.safePropertyAccess(pixelSpacing, 'columnSpacing');
      // eslint-disable-next-line security/detect-object-injection
      const yi = points[i].y * this.safePropertyAccess(pixelSpacing, 'rowSpacing');
      // eslint-disable-next-line security/detect-object-injection
      const xj = points[j].x * this.safePropertyAccess(pixelSpacing, 'columnSpacing');
      // eslint-disable-next-line security/detect-object-injection
      const yj = points[j].y * this.safePropertyAccess(pixelSpacing, 'rowSpacing');

      area += xi * yj - xj * yi;
    }

    return Math.abs(area) / 2;
  }

  /* =============================================================================
   * VOLUME CALCULATIONS
   * ============================================================================= */

  /**
   * Calculate volume from segmentation data
   */
  calculateVolume(segmentation: Segmentation): MeasurementResult {
    const { labelData, pixelSpacing, segmentIndex } = segmentation;

    let voxelCount = 0;

    // Count voxels with matching segment index
    for (let i = 0; i < labelData.length; i++) {
      // eslint-disable-next-line security/detect-object-injection
      if (labelData[i] === segmentIndex) {
        voxelCount++;
      }
    }

    // Calculate volume using safe property access
    const columnSpacing = this.safePropertyAccess(pixelSpacing, 'columnSpacing');
    const rowSpacing = this.safePropertyAccess(pixelSpacing, 'rowSpacing');
    const sliceSpacing = this.safePropertyAccess(pixelSpacing, 'sliceThickness') ||
                         this.safePropertyAccess(pixelSpacing, 'sliceSpacing') || 1;
    const voxelVolume = columnSpacing * rowSpacing * sliceSpacing;

    const totalVolume = voxelCount * voxelVolume; // in mm³

    const calibration: CalibrationData = {
      pixelSpacing,
      accuracy: this.estimateCalibrationAccuracy(pixelSpacing),
      calibrationSource: 'manual',
      lastCalibrated: new Date(),
    };
    const confidence = this.calculateMeasurementConfidence('volume-segmentation', calibration);

    const result: MeasurementResult = {
      value: totalVolume,
      unit: 'mm³',
      confidence,
      metadata: {
        timestamp: new Date(),
        method: 'voxel-counting',
        calibration,
        imageContext: {},
      },
      alternativeUnits: [
        { value: totalVolume / 1000, unit: 'cm³' },
        { value: totalVolume / 1000, unit: 'ml' },
        { value: totalVolume / 16387.064, unit: 'inch³' },
      ],
    };

    this.addToHistory(result);
    log.info(`Calculated volume: ${totalVolume.toFixed(2)}mm³`, {
      component: 'MeasurementCalculator',
      operation: 'calculateVolume',
      metadata: { value: totalVolume, unit: 'mm³', voxelCount },
    });

    return result;
  }

  /* =============================================================================
   * ROI STATISTICAL ANALYSIS
   * ============================================================================= */

  /**
   * Analyze ROI statistics
   */
  analyzeROI(roi: ROI, imageData: ImageData): StatisticalData {
    const pixelValues = this.extractROIPixels(roi, imageData);

    if (pixelValues.length === 0) {
      throw new Error('No pixels found in ROI');
    }

    // Convert to Hounsfield Units if CT
    const processedValues = this.convertToHU(pixelValues, imageData);

    // Sort values for percentile calculations
    const sortedValues = [...processedValues].sort((a, b) => a - b);

    const statistics: StatisticalData = {
      mean: this.calculateMean(processedValues),
      median: this.calculateMedian(sortedValues),
      standardDeviation: this.calculateStandardDeviation(processedValues),
      minimum: sortedValues[0],
      maximum: sortedValues[sortedValues.length - 1],
      count: processedValues.length,
      percentile25: this.calculatePercentile(sortedValues, 25),
      percentile75: this.calculatePercentile(sortedValues, 75),
      skewness: this.calculateSkewness(processedValues),
      kurtosis: this.calculateKurtosis(processedValues),
      histogram: this.generateHistogram(processedValues),
    };

    log.info(`Analyzed ROI: ${statistics.count} pixels, mean=${statistics.mean.toFixed(2)}`, {
      component: 'MeasurementCalculator',
      operation: 'analyzeROI',
      metadata: {
        pixelCount: statistics.count,
        mean: statistics.mean,
        roiType: roi.type,
      },
    });

    return statistics;
  }

  /**
   * Extract pixel values from ROI
   */
  private extractROIPixels(roi: ROI, imageData: ImageData): number[] {
    const pixels: number[] = [];
    const { width, height, pixelData } = imageData;

    // Create mask for ROI
    const mask = this.createROIMask(roi, width, height);

    // Extract pixel values using mask with safe array access
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        // eslint-disable-next-line security/detect-object-injection
        if (mask[index] && index >= 0 && index < pixelData.length) {
          // eslint-disable-next-line security/detect-object-injection
          pixels.push(pixelData[index]);
        }
      }
    }

    return pixels;
  }

  /**
   * Create mask for ROI
   */
  private createROIMask(roi: ROI, width: number, height: number): boolean[] {
    // Create mask based on ROI type

    switch (roi.type) {
      case 'rectangle':
        return this.createRectangleMask(roi.points, width, height);
      case 'ellipse':
        return this.createEllipseMask(roi.points, width, height);
      case 'polygon':
      case 'freehand':
        return this.createPolygonMask(roi.points, width, height);
      default:
        throw new Error(`Unsupported ROI type: ${roi.type}`);
    }
  }

  /**
   * Create rectangle mask
   */
  private createRectangleMask(points: Point2[], width: number, height: number): boolean[] {
    const mask = new Array(width * height).fill(false);

    if (points.length < 2) return mask;

    const minX = Math.max(0, Math.min(points[0].x, points[1].x));
    const maxX = Math.min(width - 1, Math.max(points[0].x, points[1].x));
    const minY = Math.max(0, Math.min(points[0].y, points[1].y));
    const maxY = Math.min(height - 1, Math.max(points[0].y, points[1].y));

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
  private createEllipseMask(points: Point2[], width: number, height: number): boolean[] {
    const mask = new Array(width * height).fill(false);

    if (points.length < 2) return mask;

    // Calculate center and radii
    const centerX = (points[0].x + points[1].x) / 2;
    const centerY = (points[0].y + points[1].y) / 2;
    const radiusX = Math.abs(points[1].x - points[0].x) / 2;
    const radiusY = Math.abs(points[1].y - points[0].y) / 2;

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
  private createPolygonMask(points: Point2[], width: number, height: number): boolean[] {
    const mask = new Array(width * height).fill(false);

    if (points.length < 3) return mask;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.isPointInPolygon({ x, y }, points)) {
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
   * Convert pixel values to Hounsfield Units for CT
   */
  private convertToHU(values: number[], imageData: ImageData): number[] {
    if (imageData.modality !== 'CT' ||
        imageData.rescaleSlope === undefined ||
        imageData.rescaleIntercept === undefined) {
      return values;
    }

    return values.map(value =>
      value * imageData.rescaleSlope! + imageData.rescaleIntercept!,
    );
  }

  /* =============================================================================
   * STATISTICAL CALCULATIONS
   * ============================================================================= */

  /**
   * Calculate mean
   */
  private calculateMean(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  /**
   * Calculate median
   */
  private calculateMedian(sortedValues: number[]): number {
    const n = sortedValues.length;
    if (n % 2 === 0) {
      return (sortedValues[n / 2 - 1] + sortedValues[n / 2]) / 2;
    } else {
      return sortedValues[Math.floor(n / 2)];
    }
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      // eslint-disable-next-line security/detect-object-injection
      return sortedValues[lower];
    }

    const weight = index - lower;
    // eslint-disable-next-line security/detect-object-injection
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Calculate skewness
   */
  private calculateSkewness(values: number[]): number {
    const mean = this.calculateMean(values);
    const std = this.calculateStandardDeviation(values);
    const n = values.length;

    if (std === 0) return 0;

    const sum = values.reduce((acc, value) => {
      return acc + Math.pow((value - mean) / std, 3);
    }, 0);

    return (n / ((n - 1) * (n - 2))) * sum;
  }

  /**
   * Calculate kurtosis
   */
  private calculateKurtosis(values: number[]): number {
    const mean = this.calculateMean(values);
    const std = this.calculateStandardDeviation(values);
    const n = values.length;

    if (std === 0) return 0;

    const sum = values.reduce((acc, value) => {
      return acc + Math.pow((value - mean) / std, 4);
    }, 0);

    return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum -
           (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
  }

  /**
   * Generate histogram
   */
  private generateHistogram(values: number[], binCount: number = 50): StatisticalData['histogram'] {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binWidth = (max - min) / binCount;

    const bins: number[] = [];
    const counts: number[] = new Array(binCount).fill(0);

    for (let i = 0; i < binCount; i++) {
      bins.push(min + i * binWidth);
    }

    values.forEach(value => {
      const binIndex = Math.min(Math.floor((value - min) / binWidth), binCount - 1);
      // eslint-disable-next-line security/detect-object-injection
      counts[binIndex]++;
    });

    return { bins, counts, binWidth };
  }

  /* =============================================================================
   * UTILITY METHODS
   * ============================================================================= */

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
   * Check if points have right angles (for rectangle detection)
   */
  private hasRightAngles(_points: Point3[]): boolean {
    // Simplified check - would need more sophisticated geometry in production
    return true; // Placeholder
  }

  /**
   * Check if points form approximate ellipse
   */
  private isApproximatelyElliptical(_points: Point3[]): boolean {
    // Simplified check - would need more sophisticated geometry in production
    return false; // Placeholder
  }

  // Removed getCalibrationData method - using inline calibration creation instead

  /**
   * Estimate calibration accuracy
   */
  private estimateCalibrationAccuracy(pixelSpacing: PixelSpacing): number {
    // Higher accuracy for smaller pixel spacing (higher resolution)

    const columnSpacing = this.safePropertyAccess(pixelSpacing, 'columnSpacing');
    const rowSpacing = this.safePropertyAccess(pixelSpacing, 'rowSpacing');
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
      case 'straight-line':
        baseConfidence = 0.95;
        break;
      case 'multi-point-path':
        baseConfidence = 0.90;
        break;
      case 'angle':
        baseConfidence = 0.85;
        break;
      case 'rectangular-area':
        baseConfidence = 0.90;
        break;
      case 'elliptical-area':
        baseConfidence = 0.85;
        break;
      case 'polygon-area':
        baseConfidence = 0.80;
        break;
      case 'volume-segmentation':
        baseConfidence = 0.75;
        break;
    }

    // Adjust based on calibration accuracy
    return Math.min(0.99, baseConfidence * calibration.accuracy);
  }

  /**
   * Add measurement to history
   */
  private addToHistory(result: MeasurementResult): void {
    this.measurementHistory.push(result);

    // Keep only last 1000 measurements
    if (this.measurementHistory.length > 1000) {
      this.measurementHistory = this.measurementHistory.slice(-1000);
    }
  }

  /* =============================================================================
   * PUBLIC API METHODS
   * ============================================================================= */

  /**
   * Get measurement history
   */
  getMeasurementHistory(): MeasurementResult[] {
    return [...this.measurementHistory];
  }

  /**
   * Clear measurement history
   */
  clearMeasurementHistory(): void {
    this.measurementHistory = [];
    log.info('Measurement history cleared', {
      component: 'MeasurementCalculator',
      operation: 'clearHistory',
    });
  }

  /**
   * Set calibration data manually
   */
  setCalibration(imageId: string, calibration: CalibrationData): void {
    this.calibrationCache.set(imageId, calibration);
    log.info(`Calibration set for ${imageId}`, {
      component: 'MeasurementCalculator',
      operation: 'setCalibration',
      imageId,
    });
  }

  /**
   * Get calibration info
   */
  getCalibration(imageId: string): CalibrationData | undefined {
    return this.calibrationCache.get(imageId);
  }

  /**
   * Export measurements to JSON
   */
  exportMeasurements(): string {
    return JSON.stringify({
      measurements: this.measurementHistory,
      calibrations: Object.fromEntries(this.calibrationCache),
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
    }, null, 2);
  }

  /**
   * Import measurements from JSON
   */
  importMeasurements(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData);

      if (data.measurements) {
        this.measurementHistory = data.measurements;
      }

      if (data.calibrations) {
        this.calibrationCache = new Map(Object.entries(data.calibrations));
      }

      log.info(`Imported ${this.measurementHistory.length} measurements`, {
        component: 'MeasurementCalculator',
        operation: 'importMeasurements',
        metadata: { count: this.measurementHistory.length },
      });
    } catch (error) {
      throw new Error(`Failed to import measurements: ${error}`);
    }
  }
}

// Export singleton instance
export const measurementCalculator = MeasurementCalculator.getInstance();
