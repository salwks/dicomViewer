/**
 * Volume Measurement Calculator
 * Handles volume calculations from segmentation data
 */

import {
  PixelSpacing,
  MeasurementResult,
  CalibrationData,
  ICalculator,
  Segmentation,
  SafePropertyAccess,
  measurementLogger,
  MeasurementValidation,
} from '../interfaces/MeasurementTypes';

/**
 * Volume measurement calculator for segmentation-based volume calculations
 */
export class VolumeCalculator implements ICalculator {
  private initialized = false;

  getName(): string {
    return 'VolumeCalculator';
  }

  async initialize(): Promise<void> {
    this.initialized = true;
    measurementLogger.info('Volume Calculator initialized', this.getName());
  }

  cleanup(): void {
    this.initialized = false;
    measurementLogger.info('Volume Calculator cleaned up', this.getName());
  }

  /**
   * Calculate volume from segmentation data
   */
  calculateVolume(segmentation: Segmentation): MeasurementResult {
    if (!this.initialized) {
      throw new Error('VolumeCalculator not initialized');
    }

    if (!this.validateSegmentation(segmentation)) {
      throw new Error('Invalid segmentation data for volume calculation');
    }

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
    const columnSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'columnSpacing');
    const rowSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'rowSpacing');
    const sliceSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'sliceThickness') ||
                         SafePropertyAccess.safePropertyAccess(pixelSpacing, 'sliceSpacing') || 1;
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

    measurementLogger.info(`Calculated volume: ${totalVolume.toFixed(2)}mm³`, this.getName(), {
      value: totalVolume,
      unit: 'mm³',
      voxelCount,
      segmentIndex,
    });

    return result;
  }

  /**
   * Calculate volume from multiple segmentation slices
   */
  calculateVolumeFromSlices(
    segmentations: Segmentation[],
    pixelSpacing: PixelSpacing,
  ): MeasurementResult {
    if (!this.initialized) {
      throw new Error('VolumeCalculator not initialized');
    }

    if (!segmentations.length) {
      throw new Error('At least one segmentation slice required for volume calculation');
    }

    if (!MeasurementValidation.validatePixelSpacing(pixelSpacing)) {
      throw new Error('Invalid pixel spacing for volume calculation');
    }

    let totalVoxelCount = 0;
    const segmentIndex = segmentations[0].segmentIndex;

    // Count voxels across all slices
    segmentations.forEach((segmentation, sliceIndex) => {
      if (segmentation.segmentIndex !== segmentIndex) {
        measurementLogger.warn(
          `Segment index mismatch in slice ${sliceIndex}: expected ${segmentIndex}, got ${segmentation.segmentIndex}`,
          this.getName(),
        );
      }

      for (let i = 0; i < segmentation.labelData.length; i++) {
        // eslint-disable-next-line security/detect-object-injection
        if (segmentation.labelData[i] === segmentIndex) {
          totalVoxelCount++;
        }
      }
    });

    // Calculate volume using safe property access
    const columnSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'columnSpacing');
    const rowSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'rowSpacing');
    const sliceSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'sliceThickness') ||
                         SafePropertyAccess.safePropertyAccess(pixelSpacing, 'sliceSpacing') || 1;
    const voxelVolume = columnSpacing * rowSpacing * sliceSpacing;

    const totalVolume = totalVoxelCount * voxelVolume; // in mm³

    const calibration: CalibrationData = {
      pixelSpacing,
      accuracy: this.estimateCalibrationAccuracy(pixelSpacing),
      calibrationSource: 'manual',
      lastCalibrated: new Date(),
    };
    const confidence = this.calculateMeasurementConfidence('multi-slice-volume', calibration);

    const result: MeasurementResult = {
      value: totalVolume,
      unit: 'mm³',
      confidence,
      metadata: {
        timestamp: new Date(),
        method: 'multi-slice-voxel-counting',
        calibration,
        imageContext: {
          sliceCount: segmentations.length,
        },
      },
      alternativeUnits: [
        { value: totalVolume / 1000, unit: 'cm³' },
        { value: totalVolume / 1000, unit: 'ml' },
        { value: totalVolume / 16387.064, unit: 'inch³' },
      ],
    };

    measurementLogger.info(`Calculated multi-slice volume: ${totalVolume.toFixed(2)}mm³`, this.getName(), {
      value: totalVolume,
      unit: 'mm³',
      voxelCount: totalVoxelCount,
      sliceCount: segmentations.length,
      segmentIndex,
    });

    return result;
  }

  /**
   * Calculate surface area from segmentation (approximation)
   */
  calculateSurfaceArea(segmentation: Segmentation): MeasurementResult {
    if (!this.initialized) {
      throw new Error('VolumeCalculator not initialized');
    }

    if (!this.validateSegmentation(segmentation)) {
      throw new Error('Invalid segmentation data for surface area calculation');
    }

    const { labelData, dimensions, pixelSpacing, segmentIndex } = segmentation;
    const [width, height, depth] = dimensions;

    // Simple surface area estimation using boundary detection
    let surfaceVoxels = 0;

    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = z * (width * height) + y * width + x;

          // eslint-disable-next-line security/detect-object-injection
          if (labelData[index] === segmentIndex) {
            // Check if this voxel is on the boundary
            if (this.isBoundaryVoxel(x, y, z, width, height, depth, labelData, segmentIndex)) {
              surfaceVoxels++;
            }
          }
        }
      }
    }

    // Calculate surface area using safe property access
    const columnSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'columnSpacing');
    const rowSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'rowSpacing');
    const sliceSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'sliceThickness') ||
                         SafePropertyAccess.safePropertyAccess(pixelSpacing, 'sliceSpacing') || 1;

    // Estimate surface area (simplified - would need more sophisticated mesh analysis for accuracy)
    const voxelSurfaceArea = Math.min(columnSpacing * rowSpacing, columnSpacing * sliceSpacing, rowSpacing * sliceSpacing);
    const approximateSurfaceArea = surfaceVoxels * voxelSurfaceArea;

    const calibration: CalibrationData = {
      pixelSpacing,
      accuracy: this.estimateCalibrationAccuracy(pixelSpacing) * 0.8, // Lower accuracy for surface approximation
      calibrationSource: 'manual',
      lastCalibrated: new Date(),
    };
    const confidence = this.calculateMeasurementConfidence('surface-area-approximation', calibration);

    const result: MeasurementResult = {
      value: approximateSurfaceArea,
      unit: 'mm²',
      confidence,
      metadata: {
        timestamp: new Date(),
        method: 'boundary-voxel-approximation',
        calibration,
        imageContext: {
          dimensions,
        },
      },
      alternativeUnits: [
        { value: approximateSurfaceArea / 100, unit: 'cm²' },
        { value: approximateSurfaceArea / 645.16, unit: 'inch²' },
      ],
    };

    measurementLogger.info(`Calculated surface area: ${approximateSurfaceArea.toFixed(2)}mm²`, this.getName(), {
      value: approximateSurfaceArea,
      unit: 'mm²',
      surfaceVoxels,
      segmentIndex,
    });

    return result;
  }

  /**
   * Check if voxel is on the boundary (has at least one non-segment neighbor)
   */
  private isBoundaryVoxel(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    labelData: Uint8Array | Uint16Array,
    segmentIndex: number,
  ): boolean {
    // Check 6-connectivity (face neighbors)
    const neighbors = [
      [x - 1, y, z], [x + 1, y, z], // left, right
      [x, y - 1, z], [x, y + 1, z], // back, front
      [x, y, z - 1], [x, y, z + 1], // below, above
    ];

    for (const [nx, ny, nz] of neighbors) {
      // Check bounds
      if (nx < 0 || nx >= width || ny < 0 || ny >= height || nz < 0 || nz >= depth) {
        return true; // Boundary of volume
      }

      const neighborIndex = nz * (width * height) + ny * width + nx;
      // eslint-disable-next-line security/detect-object-injection
      if (labelData[neighborIndex] !== segmentIndex) {
        return true; // Different segment or background
      }
    }

    return false;
  }

  /**
   * Validate segmentation data
   */
  private validateSegmentation(segmentation: Segmentation): boolean {
    return !!(
      segmentation.labelData &&
      segmentation.dimensions &&
      segmentation.dimensions.length === 3 &&
      segmentation.pixelSpacing &&
      typeof segmentation.segmentIndex === 'number'
    );
  }

  /**
   * Estimate calibration accuracy
   */
  private estimateCalibrationAccuracy(pixelSpacing: PixelSpacing): number {
    // Higher accuracy for smaller pixel spacing (higher resolution)
    const columnSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'columnSpacing');
    const rowSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'rowSpacing');
    const sliceSpacing = SafePropertyAccess.safePropertyAccess(pixelSpacing, 'sliceThickness') ||
                         SafePropertyAccess.safePropertyAccess(pixelSpacing, 'sliceSpacing') || 1;

    const avgSpacing = (columnSpacing + rowSpacing + sliceSpacing) / 3;

    if (avgSpacing <= 0.5) return 0.95;
    if (avgSpacing <= 1.0) return 0.90;
    if (avgSpacing <= 2.0) return 0.85;
    if (avgSpacing <= 3.0) return 0.75;
    return 0.65;
  }

  /**
   * Calculate measurement confidence
   */
  private calculateMeasurementConfidence(method: string, calibration: CalibrationData): number {
    let baseConfidence = 0.8;

    // Adjust based on method
    switch (method) {
      case 'volume-segmentation':
        baseConfidence = 0.90;
        break;
      case 'multi-slice-volume':
        baseConfidence = 0.85;
        break;
      case 'surface-area-approximation':
        baseConfidence = 0.70; // Lower confidence for approximation
        break;
    }

    // Adjust based on calibration accuracy
    return Math.min(0.99, baseConfidence * calibration.accuracy);
  }
}

// Factory function
export function createVolumeCalculator(): VolumeCalculator {
  return new VolumeCalculator();
}
