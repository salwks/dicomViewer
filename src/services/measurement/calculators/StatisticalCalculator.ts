/**
 * Statistical Calculator
 * Handles ROI analysis and statistical computations
 */

import {
  Point2,
  PixelSpacing,
  MeasurementResult,
  CalibrationData,
  ICalculator,
  ROI,
  ImageData,
  StatisticalData,
  SafePropertyAccess,
  measurementLogger,
  MeasurementValidation,
} from '../interfaces/MeasurementTypes';

/**
 * Statistical calculator for ROI analysis and pixel value statistics
 */
export class StatisticalCalculator implements ICalculator {
  private initialized = false;

  getName(): string {
    return 'StatisticalCalculator';
  }

  async initialize(): Promise<void> {
    this.initialized = true;
    measurementLogger.info('Statistical Calculator initialized', this.getName());
  }

  cleanup(): void {
    this.initialized = false;
    measurementLogger.info('Statistical Calculator cleaned up', this.getName());
  }

  /**
   * Analyze ROI statistics
   */
  analyzeROI(roi: ROI, imageData: ImageData): StatisticalData {
    if (!this.initialized) {
      throw new Error('StatisticalCalculator not initialized');
    }

    if (!this.validateROI(roi)) {
      throw new Error('Invalid ROI data for statistical analysis');
    }

    if (!MeasurementValidation.validateImageData(imageData)) {
      throw new Error('Invalid image data for statistical analysis');
    }

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

    measurementLogger.info(`Analyzed ROI: ${statistics.count} pixels, mean=${statistics.mean.toFixed(2)}`, this.getName(), {
      pixelCount: statistics.count,
      mean: statistics.mean,
      roiType: roi.type,
      modality: imageData.modality,
    });

    return statistics;
  }

  /**
   * Create ROI analysis measurement result
   */
  createROIAnalysisResult(
    roi: ROI,
    imageData: ImageData,
    imageId?: string,
  ): MeasurementResult {
    const statistics = this.analyzeROI(roi, imageData);

    const calibration: CalibrationData = {
      pixelSpacing: roi.pixelSpacing,
      accuracy: this.estimateCalibrationAccuracy(roi.pixelSpacing),
      calibrationSource: 'dicom',
      lastCalibrated: new Date(),
    };

    const confidence = this.calculateMeasurementConfidence('roi-analysis', calibration);

    // Return mean value as primary measurement
    const result: MeasurementResult = {
      value: statistics.mean,
      unit: imageData.modality === 'CT' ? 'HU' : 'value',
      confidence,
      statistics,
      metadata: {
        timestamp: new Date(),
        method: 'roi-analysis',
        calibration,
        imageContext: {
          imageId,
          modality: imageData.modality,
        },
      },
    };

    return result;
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
  private createEllipseMask(points: Point2[], width: number, height: number): boolean[] {
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
      const mid1 = SafePropertyAccess.safeArrayAccess(sortedValues, n / 2 - 1);
      const mid2 = SafePropertyAccess.safeArrayAccess(sortedValues, n / 2);
      return mid1 && mid2 ? (mid1 + mid2) / 2 : 0;
    } else {
      const mid = SafePropertyAccess.safeArrayAccess(sortedValues, Math.floor(n / 2));
      return mid || 0;
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
      return sortedValues[lower] || 0;
    }

    const weight = index - lower;
    const lowerValue = SafePropertyAccess.safeArrayAccess(sortedValues, lower);
    const upperValue = SafePropertyAccess.safeArrayAccess(sortedValues, upper);

    if (!lowerValue || !upperValue) return 0;

    return lowerValue * (1 - weight) + upperValue * weight;
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

  /**
   * Validate ROI data
   */
  private validateROI(roi: ROI): boolean {
    return !!(
      roi.type &&
      roi.points &&
      Array.isArray(roi.points) &&
      roi.points.length > 0 &&
      roi.pixelSpacing
    );
  }

  /**
   * Estimate calibration accuracy
   */
  private estimateCalibrationAccuracy(pixelSpacing: PixelSpacing): number {
    // Statistical analysis doesn't depend heavily on calibration accuracy
    // but pixel resolution still matters for ROI precision
    const columnSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'columnSpacing');
    const rowSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'rowSpacing');
    const avgSpacing = (columnSpacing + rowSpacing) / 2;

    if (avgSpacing <= 0.5) return 0.98;
    if (avgSpacing <= 1.0) return 0.95;
    if (avgSpacing <= 2.0) return 0.90;
    return 0.85;
  }

  /**
   * Calculate measurement confidence
   */
  private calculateMeasurementConfidence(method: string, calibration: CalibrationData): number {
    let baseConfidence = 0.95; // ROI analysis is generally very reliable

    // Adjust based on method
    switch (method) {
      case 'roi-analysis':
        baseConfidence = 0.95;
        break;
      case 'histogram-analysis':
        baseConfidence = 0.90;
        break;
    }

    // Adjust based on calibration accuracy
    return Math.min(0.99, baseConfidence * calibration.accuracy);
  }
}

// Factory function
export function createStatisticalCalculator(): StatisticalCalculator {
  return new StatisticalCalculator();
}
