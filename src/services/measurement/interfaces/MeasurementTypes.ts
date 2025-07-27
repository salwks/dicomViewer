/**
 * Common measurement interfaces and types
 * Shared across all measurement components
 */

import { log } from '../../../utils/logger';

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
  calibration: CalibrationData;
  /** Image context */
  imageContext: {
    imageId?: string;
    seriesInstanceUID?: string;
    studyInstanceUID?: string;
    modality?: string;
    sliceLocation?: number;
    sliceCount?: number;
    dimensions?: [number, number, number];
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
 * Base interface for all calculators
 */
export interface ICalculator {
  /** Calculator name for logging */
  getName(): string;
  /** Initialize the calculator */
  initialize(): Promise<void>;
  /** Clean up resources */
  cleanup(): void;
}

/**
 * Safe property access helper for all calculators
 */
export class SafePropertyAccess {
  /**
   * Safe property access to prevent object injection
   */
  static safePropertyAccess<T extends object, K extends keyof T>(obj: T, key: K): T[K] {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // eslint-disable-next-line security/detect-object-injection
      return obj[key];
    }
    throw new Error(`Property ${String(key)} not found in object`);
  }

  /**
   * Safe property set to prevent object injection
   */
  static safePropertySet<T extends object, K extends keyof T>(obj: T, key: K, value: T[K]): void {
    if (typeof key === 'string' || typeof key === 'number' || typeof key === 'symbol') {
      // eslint-disable-next-line security/detect-object-injection
      (obj as Record<string | number | symbol, unknown>)[key] = value;
    }
  }

  /**
   * Safe array access with bounds checking
   */
  static safeArrayAccess<T>(array: T[], index: number): T | undefined {
    if (index >= 0 && index < array.length) {
      // eslint-disable-next-line security/detect-object-injection
      return array[index];
    }
    return undefined;
  }

  /**
   * Safe array set with bounds checking
   */
  static safeArraySet<T>(array: T[], index: number, value: T): boolean {
    if (index >= 0 && index < array.length) {
      // eslint-disable-next-line security/detect-object-injection
      array[index] = value;
      return true;
    }
    return false;
  }
}

/**
 * Logger wrapper for measurement components
 */
export const measurementLogger = {
  info: (message: string, component: string, metadata?: Record<string, unknown>) => {
    log.info(message, {
      component: `Measurement.${component}`,
      operation: 'measurement',
      metadata,
    });
  },

  debug: (message: string, component: string, metadata?: Record<string, unknown>) => {
    log.debug(message, {
      component: `Measurement.${component}`,
      operation: 'measurement',
      metadata,
    });
  },

  warn: (message: string, component: string, metadata?: Record<string, unknown>, error?: Error) => {
    log.warn(message, {
      component: `Measurement.${component}`,
      operation: 'measurement',
      metadata,
    }, error);
  },

  error: (message: string, component: string, metadata?: Record<string, unknown>, error?: Error) => {
    log.error(message, {
      component: `Measurement.${component}`,
      operation: 'measurement',
      metadata,
    }, error);
  },
};

/**
 * Validation utilities for measurement inputs
 */
export class MeasurementValidation {
  /**
   * Validate pixel spacing
   */
  static validatePixelSpacing(pixelSpacing: PixelSpacing): boolean {
    const columnSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'columnSpacing');
    const rowSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'rowSpacing');

    return columnSpacing > 0 && rowSpacing > 0;
  }

  /**
   * Validate points array
   */
  static validatePoints(points: Point3[], minCount: number): boolean {
    return Array.isArray(points) && points.length >= minCount;
  }

  /**
   * Validate image data
   */
  static validateImageData(imageData: ImageData): boolean {
    return imageData.pixelData && imageData.width > 0 && imageData.height > 0;
  }
}
