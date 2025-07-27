/**
 * Threshold-based Segmentation Tool
 * Automatic segmentation based on intensity thresholds with connected component analysis
 */

import { EventEmitter } from 'events';
import { ThresholdConfig, Segmentation } from '../../../types/segmentation';
import { log } from '../../../utils/logger';

/**
 * Point in 3D space
 */
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Connected component information
 */
export interface ConnectedComponent {
  id: number;
  voxelCount: number;
  boundingBox: {
    min: Point3D;
    max: Point3D;
  };
  centroid: Point3D;
  volume: number;
}

/**
 * Threshold segmentation result
 */
export interface ThresholdResult {
  segmentIndex: number;
  thresholdedVoxels: number;
  components: ConnectedComponent[];
  totalVolume: number;
  processingTime: number;
}

/**
 * Histogram data for threshold visualization
 */
export interface HistogramData {
  bins: number[];
  counts: number[];
  minValue: number;
  maxValue: number;
  totalVoxels: number;
}

/**
 * Threshold-based segmentation tool
 */
export class ThresholdTool extends EventEmitter {
  private config: ThresholdConfig;
  private isProcessing = false;
  private lastResult: ThresholdResult | null = null;

  constructor(config: Partial<ThresholdConfig> = {}) {
    super();

    // Default threshold configuration
    this.config = {
      lower: 100,
      upper: 1000,
      connectivityMode: '26',
      seedPoints: [],
      fillHoles: true,
      smoothing: false,
      ...config,
    };

    log.info('ThresholdTool initialized', {
      component: 'ThresholdTool',
      metadata: { config: this.config },
    });
  }

  /**
   * Update threshold configuration
   */
  updateConfig(updates: Partial<ThresholdConfig>): void {
    this.config = { ...this.config, ...updates };

    log.debug('ThresholdTool configuration updated', {
      component: 'ThresholdTool',
      metadata: { config: this.config },
    });

    this.emit('configChanged', this.config);
  }

  /**
   * Get current threshold configuration
   */
  getConfig(): ThresholdConfig {
    return { ...this.config };
  }

  /**
   * Apply threshold segmentation to volume
   */
  async applyThreshold(
    segmentation: Segmentation,
    segmentIndex: number,
    config?: Partial<ThresholdConfig>,
  ): Promise<ThresholdResult> {
    if (this.isProcessing) {
      throw new Error('Threshold operation already in progress');
    }

    const effectiveConfig = config ? { ...this.config, ...config } : this.config;
    this.isProcessing = true;
    const startTime = performance.now();

    try {
      log.info('Starting threshold segmentation', {
        component: 'ThresholdTool',
        metadata: {
          segmentationId: segmentation.segmentationId,
          segmentIndex,
          config: effectiveConfig,
        },
      });

      // Step 1: Get volume data
      const volumeData = await this.getVolumeData(segmentation);

      // Step 2: Apply threshold
      const binaryMask = this.applyThresholdToVolume(volumeData, effectiveConfig);

      // Step 3: Apply seed point filtering if specified
      let filteredMask = binaryMask;
      if (effectiveConfig.seedPoints && effectiveConfig.seedPoints.length > 0) {
        filteredMask = this.applySeedPointFiltering(binaryMask, effectiveConfig.seedPoints, segmentation);
      }

      // Step 4: Find connected components
      const components = this.findConnectedComponents(filteredMask, segmentation, effectiveConfig.connectivityMode);

      // Step 5: Apply post-processing
      let finalMask = filteredMask;
      if (effectiveConfig.fillHoles) {
        finalMask = this.fillHoles(finalMask, segmentation);
      }
      if (effectiveConfig.smoothing) {
        finalMask = this.applySmoothingFilter(finalMask, segmentation);
      }

      // Step 6: Apply to segmentation
      const appliedVoxels = this.applyMaskToSegmentation(finalMask, segmentation, segmentIndex);

      // Step 7: Calculate statistics
      const totalVolume = this.calculateTotalVolume(components, segmentation);

      const result: ThresholdResult = {
        segmentIndex,
        thresholdedVoxels: appliedVoxels,
        components,
        totalVolume,
        processingTime: performance.now() - startTime,
      };

      this.lastResult = result;

      log.info('Threshold segmentation completed', {
        component: 'ThresholdTool',
        metadata: {
          segmentationId: segmentation.segmentationId,
          segmentIndex,
          thresholdedVoxels: appliedVoxels,
          componentCount: components.length,
          processingTime: result.processingTime,
        },
      });

      this.emit('thresholdCompleted', {
        segmentation,
        result,
        config: effectiveConfig,
      });

      return result;

    } catch (error) {
      log.error('Threshold segmentation failed', {
        component: 'ThresholdTool',
        metadata: {
          segmentationId: segmentation.segmentationId,
          segmentIndex,
        },
      }, error as Error);

      this.emit('thresholdError', { error, segmentation, segmentIndex });
      throw error;

    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Generate histogram for threshold visualization
   */
  async generateHistogram(
    segmentation: Segmentation,
    binCount = 256,
    roi?: {
      min: Point3D;
      max: Point3D;
    },
  ): Promise<HistogramData> {
    const startTime = performance.now();

    try {
      const volumeData = await this.getVolumeData(segmentation);
      const dimensions = segmentation.data.dimensions!;

      let minValue = Infinity;
      let maxValue = -Infinity;
      const values: number[] = [];

      // Collect voxel values within ROI (or entire volume)
      for (let z = 0; z < dimensions[2]; z++) {
        for (let y = 0; y < dimensions[1]; y++) {
          for (let x = 0; x < dimensions[0]; x++) {
            // Check if point is in ROI
            if (roi) {
              if (x < roi.min.x || x > roi.max.x ||
                  y < roi.min.y || y > roi.max.y ||
                  z < roi.min.z || z > roi.max.z) {
                continue;
              }
            }

            const index = z * dimensions[0] * dimensions[1] + y * dimensions[0] + x;
            const value = volumeData[index];

            values.push(value);
            minValue = Math.min(minValue, value);
            maxValue = Math.max(maxValue, value);
          }
        }
      }

      // Create histogram bins
      const binSize = (maxValue - minValue) / binCount;
      const bins = Array.from({ length: binCount }, (_, i) => minValue + i * binSize);
      const counts = new Array(binCount).fill(0);

      // Count values in each bin
      for (const value of values) {
        const binIndex = Math.min(Math.floor((value - minValue) / binSize), binCount - 1);
        counts[binIndex]++;
      }

      const histogram: HistogramData = {
        bins,
        counts,
        minValue,
        maxValue,
        totalVoxels: values.length,
      };

      log.performance('Generated histogram', performance.now() - startTime, {
        component: 'ThresholdTool',
        metadata: {
          binCount,
          totalVoxels: values.length,
          valueRange: [minValue, maxValue],
        },
      });

      return histogram;

    } catch (error) {
      log.error('Failed to generate histogram', {
        component: 'ThresholdTool',
      }, error as Error);
      throw error;
    }
  }

  /**
   * Preview threshold without applying to segmentation
   */
  async previewThreshold(
    segmentation: Segmentation,
    config?: Partial<ThresholdConfig>,
  ): Promise<{
    mask: Uint8Array;
    componentCount: number;
    affectedVoxels: number;
  }> {
    const effectiveConfig = config ? { ...this.config, ...config } : this.config;

    try {
      const volumeData = await this.getVolumeData(segmentation);
      const mask = this.applyThresholdToVolume(volumeData, effectiveConfig);

      // Quick component counting
      const components = this.findConnectedComponents(mask, segmentation, effectiveConfig.connectivityMode);

      const affectedVoxels = mask.reduce((sum, value) => sum + (value > 0 ? 1 : 0), 0);

      return {
        mask,
        componentCount: components.length,
        affectedVoxels,
      };

    } catch (error) {
      log.error('Failed to preview threshold', {
        component: 'ThresholdTool',
      }, error as Error);
      throw error;
    }
  }

  /**
   * Get last threshold result
   */
  getLastResult(): ThresholdResult | null {
    return this.lastResult;
  }

  /**
   * Check if tool is currently processing
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Get volume data from segmentation (placeholder implementation)
   */
  private async getVolumeData(segmentation: Segmentation): Promise<Float32Array> {
    // TODO: Implement actual volume data retrieval from Cornerstone3D
    // This would typically involve accessing the volume's scalar data

    const dimensions = segmentation.data.dimensions!;
    const totalVoxels = dimensions[0] * dimensions[1] * dimensions[2];

    // Generate mock data for now
    const data = new Float32Array(totalVoxels);
    for (let i = 0; i < totalVoxels; i++) {
      data[i] = Math.random() * 1000; // Random values for testing
    }

    log.warn('Using mock volume data - implement actual volume data retrieval', {
      component: 'ThresholdTool',
    });

    return data;
  }

  /**
   * Apply threshold to volume data
   */
  private applyThresholdToVolume(
    volumeData: Float32Array,
    config: ThresholdConfig,
  ): Uint8Array {
    const mask = new Uint8Array(volumeData.length);

    for (let i = 0; i < volumeData.length; i++) {
      const value = volumeData[i];
      mask[i] = (value >= config.lower && value <= config.upper) ? 255 : 0;
    }

    return mask;
  }

  /**
   * Apply seed point filtering to keep only components connected to seed points
   */
  private applySeedPointFiltering(
    mask: Uint8Array,
    seedPoints: Point3D[],
    segmentation: Segmentation,
  ): Uint8Array {
    const dimensions = segmentation.data.dimensions!;
    const filteredMask = new Uint8Array(mask.length);
    const visited = new Uint8Array(mask.length);

    // Use flood fill from each seed point
    for (const seedPoint of seedPoints) {
      const seedIndex = this.coordsToIndex(seedPoint, dimensions);

      if (seedIndex >= 0 && seedIndex < mask.length && mask[seedIndex] > 0) {
        this.floodFill3D(mask, filteredMask, visited, seedPoint, dimensions);
      }
    }

    return filteredMask;
  }

  /**
   * Find connected components using 3D connectivity
   */
  private findConnectedComponents(
    mask: Uint8Array,
    segmentation: Segmentation,
    connectivity: '6' | '18' | '26',
  ): ConnectedComponent[] {
    const dimensions = segmentation.data.dimensions!;
    const spacing = segmentation.data.spacing || [1, 1, 1];
    const labels = new Int32Array(mask.length);
    const components: ConnectedComponent[] = [];
    let currentLabel = 1;

    // Get connectivity offsets
    const offsets = this.getConnectivityOffsets(connectivity, dimensions);

    // Connected component labeling
    for (let z = 0; z < dimensions[2]; z++) {
      for (let y = 0; y < dimensions[1]; y++) {
        for (let x = 0; x < dimensions[0]; x++) {
          const index = this.coordsToIndex({ x, y, z }, dimensions);

          if (mask[index] > 0 && labels[index] === 0) {
            // Start new component
            const component = this.labelComponent(
              mask, labels, { x, y, z }, currentLabel, dimensions, offsets, spacing,
            );

            components.push({
              id: currentLabel,
              ...component,
            });

            currentLabel++;
          }
        }
      }
    }

    return components;
  }

  /**
   * Label a connected component and return its statistics
   */
  private labelComponent(
    mask: Uint8Array,
    labels: Int32Array,
    startPoint: Point3D,
    label: number,
    dimensions: number[],
    offsets: Point3D[],
    spacing: number[],
  ): Omit<ConnectedComponent, 'id'> {
    const queue: Point3D[] = [startPoint];
    const visited = new Set<number>();

    let voxelCount = 0;
    const minBounds = { ...startPoint };
    const maxBounds = { ...startPoint };
    const centroidSum = { x: 0, y: 0, z: 0 };

    while (queue.length > 0) {
      const point = queue.shift()!;
      const index = this.coordsToIndex(point, dimensions);

      if (visited.has(index) || labels[index] !== 0 || mask[index] === 0) {
        continue;
      }

      // Label this voxel
      labels[index] = label;
      visited.add(index);
      voxelCount++;

      // Update statistics
      minBounds.x = Math.min(minBounds.x, point.x);
      minBounds.y = Math.min(minBounds.y, point.y);
      minBounds.z = Math.min(minBounds.z, point.z);
      maxBounds.x = Math.max(maxBounds.x, point.x);
      maxBounds.y = Math.max(maxBounds.y, point.y);
      maxBounds.z = Math.max(maxBounds.z, point.z);

      centroidSum.x += point.x;
      centroidSum.y += point.y;
      centroidSum.z += point.z;

      // Add neighbors to queue
      for (const offset of offsets) {
        const neighbor = {
          x: point.x + offset.x,
          y: point.y + offset.y,
          z: point.z + offset.z,
        };

        if (this.isValidCoord(neighbor, dimensions)) {
          const neighborIndex = this.coordsToIndex(neighbor, dimensions);
          if (!visited.has(neighborIndex) && mask[neighborIndex] > 0) {
            queue.push(neighbor);
          }
        }
      }
    }

    // Calculate centroid
    const centroid = {
      x: centroidSum.x / voxelCount,
      y: centroidSum.y / voxelCount,
      z: centroidSum.z / voxelCount,
    };

    // Calculate volume
    const voxelVolume = spacing[0] * spacing[1] * spacing[2];
    const volume = voxelCount * voxelVolume;

    return {
      voxelCount,
      boundingBox: { min: minBounds, max: maxBounds },
      centroid,
      volume,
    };
  }

  /**
   * Fill holes in binary mask
   */
  private fillHoles(mask: Uint8Array, _segmentation: Segmentation): Uint8Array {
    // TODO: Implement actual hole filling algorithm
    // This is a complex operation that typically involves:
    // 1. Finding background components
    // 2. Identifying which ones are holes (enclosed by foreground)
    // 3. Filling the holes

    log.warn('Hole filling not yet implemented', {
      component: 'ThresholdTool',
    });

    return new Uint8Array(mask); // Return copy for now
  }

  /**
   * Apply smoothing filter to binary mask
   */
  private applySmoothingFilter(mask: Uint8Array, segmentation: Segmentation): Uint8Array {
    const dimensions = segmentation.data.dimensions!;
    const smoothed = new Uint8Array(mask.length);

    // Simple 3x3x3 median filter
    for (let z = 1; z < dimensions[2] - 1; z++) {
      for (let y = 1; y < dimensions[1] - 1; y++) {
        for (let x = 1; x < dimensions[0] - 1; x++) {
          const values: number[] = [];

          // Collect 3x3x3 neighborhood
          for (let dz = -1; dz <= 1; dz++) {
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const neighborIndex = this.coordsToIndex(
                  { x: x + dx, y: y + dy, z: z + dz },
                  dimensions,
                );
                values.push(mask[neighborIndex]);
              }
            }
          }

          // Apply median
          values.sort((a, b) => a - b);
          const index = this.coordsToIndex({ x, y, z }, dimensions);
          smoothed[index] = values[Math.floor(values.length / 2)];
        }
      }
    }

    return smoothed;
  }

  /**
   * Apply binary mask to segmentation
   */
  private applyMaskToSegmentation(
    mask: Uint8Array,
    _segmentation: Segmentation,
    segmentIndex: number,
  ): number {
    // TODO: Implement actual application to segmentation volume
    // This would involve setting the segmentation labelmap values

    let appliedVoxels = 0;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] > 0) {
        appliedVoxels++;
      }
    }

    log.warn('Mask application to segmentation not yet implemented', {
      component: 'ThresholdTool',
      metadata: { segmentIndex, appliedVoxels },
    });

    return appliedVoxels;
  }

  /**
   * Perform 3D flood fill
   */
  private floodFill3D(
    mask: Uint8Array,
    output: Uint8Array,
    visited: Uint8Array,
    startPoint: Point3D,
    dimensions: number[],
  ): void {
    const queue: Point3D[] = [startPoint];
    const offsets = this.getConnectivityOffsets('26', dimensions);

    while (queue.length > 0) {
      const point = queue.shift()!;
      const index = this.coordsToIndex(point, dimensions);

      // eslint-disable-next-line security/detect-object-injection
      if (visited[index] > 0 || mask[index] === 0) {
        continue;
      }

      // eslint-disable-next-line security/detect-object-injection
      visited[index] = 1;
      // eslint-disable-next-line security/detect-object-injection
      output[index] = mask[index];

      // Add neighbors
      for (const offset of offsets) {
        const neighbor = {
          x: point.x + offset.x,
          y: point.y + offset.y,
          z: point.z + offset.z,
        };

        if (this.isValidCoord(neighbor, dimensions)) {
          const neighborIndex = this.coordsToIndex(neighbor, dimensions);
          if (visited[neighborIndex] === 0 && mask[neighborIndex] > 0) {
            queue.push(neighbor);
          }
        }
      }
    }
  }

  /**
   * Get connectivity offsets based on connectivity mode
   */
  private getConnectivityOffsets(connectivity: '6' | '18' | '26', _dimensions: number[]): Point3D[] {
    const offsets: Point3D[] = [];

    // 6-connectivity (face neighbors)
    if (connectivity === '6' || connectivity === '18' || connectivity === '26') {
      offsets.push(
        { x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
        { x: 0, y: -1, z: 0 }, { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 1 },
      );
    }

    // 18-connectivity (face + edge neighbors)
    if (connectivity === '18' || connectivity === '26') {
      offsets.push(
        { x: -1, y: -1, z: 0 }, { x: -1, y: 1, z: 0 },
        { x: 1, y: -1, z: 0 }, { x: 1, y: 1, z: 0 },
        { x: -1, y: 0, z: -1 }, { x: -1, y: 0, z: 1 },
        { x: 1, y: 0, z: -1 }, { x: 1, y: 0, z: 1 },
        { x: 0, y: -1, z: -1 }, { x: 0, y: -1, z: 1 },
        { x: 0, y: 1, z: -1 }, { x: 0, y: 1, z: 1 },
      );
    }

    // 26-connectivity (face + edge + corner neighbors)
    if (connectivity === '26') {
      offsets.push(
        { x: -1, y: -1, z: -1 }, { x: -1, y: -1, z: 1 },
        { x: -1, y: 1, z: -1 }, { x: -1, y: 1, z: 1 },
        { x: 1, y: -1, z: -1 }, { x: 1, y: -1, z: 1 },
        { x: 1, y: 1, z: -1 }, { x: 1, y: 1, z: 1 },
      );
    }

    return offsets;
  }

  /**
   * Convert 3D coordinates to linear index
   */
  private coordsToIndex(point: Point3D, dimensions: number[]): number {
    return point.z * dimensions[0] * dimensions[1] + point.y * dimensions[0] + point.x;
  }

  /**
   * Check if coordinates are valid
   */
  private isValidCoord(point: Point3D, dimensions: number[]): boolean {
    return (
      point.x >= 0 && point.x < dimensions[0] &&
      point.y >= 0 && point.y < dimensions[1] &&
      point.z >= 0 && point.z < dimensions[2]
    );
  }

  /**
   * Calculate total volume from components
   */
  private calculateTotalVolume(components: ConnectedComponent[], _segmentation: Segmentation): number {
    return components.reduce((total, component) => total + component.volume, 0);
  }
}

export default ThresholdTool;
