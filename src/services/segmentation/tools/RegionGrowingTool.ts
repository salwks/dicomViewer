/**
 * Region Growing Segmentation Tool
 * Implements region growing algorithm with multiple similarity criteria and constraints
 */

import { EventEmitter } from 'events';
import { RegionGrowingConfig, Segmentation } from '../../../types/segmentation';
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
 * Voxel information for region growing
 */
export interface Voxel {
  point: Point3D;
  value: number;
  gradient?: number;
  visited: boolean;
  inRegion: boolean;
}

/**
 * Region growing result
 */
export interface RegionGrowingResult {
  segmentIndex: number;
  grownVoxels: number;
  iterations: number;
  finalSimilarityMeasure: number;
  regionBounds: {
    min: Point3D;
    max: Point3D;
  };
  volume: number;
  centroid: Point3D;
  processingTime: number;
  convergenceReached: boolean;
}

/**
 * Similarity metrics for region growing
 */
export interface SimilarityMetrics {
  intensityDifference: number;
  gradientDifference: number;
  adaptiveThreshold: number;
  distance: number;
}

/**
 * Region growing statistics
 */
export interface RegionStats {
  meanIntensity: number;
  standardDeviation: number;
  minIntensity: number;
  maxIntensity: number;
  voxelCount: number;
  compactness: number;
}

/**
 * Region growing segmentation tool
 */
export class RegionGrowingTool extends EventEmitter {
  private config: RegionGrowingConfig;
  private isProcessing = false;
  private lastResult: RegionGrowingResult | null = null;
  private shouldStop = false;

  constructor(config: Partial<RegionGrowingConfig> = {}) {
    super();

    // Default region growing configuration
    this.config = {
      seedPoints: [],
      similarity: {
        mode: 'intensity',
        threshold: 50,
      },
      constraints: {
        maxRegionSize: 100000,
        minRegionSize: 10,
        maxDistance: Infinity,
      },
      stopCriteria: {
        maxIterations: 1000,
        convergenceThreshold: 0.01,
      },
      ...config,
    };

    log.info('RegionGrowingTool initialized', {
      component: 'RegionGrowingTool',
      metadata: { config: this.config },
    });
  }

  /**
   * Update region growing configuration
   */
  updateConfig(updates: Partial<RegionGrowingConfig>): void {
    this.config = { ...this.config, ...updates };

    log.debug('RegionGrowingTool configuration updated', {
      component: 'RegionGrowingTool',
      metadata: { config: this.config },
    });

    this.emit('configChanged', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): RegionGrowingConfig {
    return { ...this.config };
  }

  /**
   * Apply region growing segmentation
   */
  async applyRegionGrowing(
    segmentation: Segmentation,
    segmentIndex: number,
    config?: Partial<RegionGrowingConfig>,
  ): Promise<RegionGrowingResult> {
    if (this.isProcessing) {
      throw new Error('Region growing operation already in progress');
    }

    const effectiveConfig = config ? { ...this.config, ...config } : this.config;

    if (effectiveConfig.seedPoints.length === 0) {
      throw new Error('At least one seed point is required for region growing');
    }

    this.isProcessing = true;
    this.shouldStop = false;
    const startTime = performance.now();

    try {
      log.info('Starting region growing segmentation', {
        component: 'RegionGrowingTool',
        metadata: {
          segmentationId: segmentation.segmentationId,
          segmentIndex,
          seedPointCount: effectiveConfig.seedPoints.length,
          config: effectiveConfig,
        },
      });

      // Step 1: Initialize volume data and seed points
      const volumeData = await this.getVolumeData(segmentation);
      const gradientData = this.calculateGradientData(volumeData, segmentation);

      // Step 2: Initialize region growing
      const region = this.initializeRegion(volumeData, gradientData, effectiveConfig, segmentation);

      // Step 3: Perform region growing
      const growthResult = await this.performRegionGrowing(
        region, volumeData, gradientData, effectiveConfig, segmentation,
      );

      // Step 4: Apply result to segmentation
      const appliedVoxels = this.applyRegionToSegmentation(region, segmentation, segmentIndex);

      // Step 5: Calculate final statistics
      const stats = this.calculateRegionStatistics(region, volumeData, segmentation);

      const result: RegionGrowingResult = {
        segmentIndex,
        grownVoxels: appliedVoxels,
        iterations: growthResult.iterations,
        finalSimilarityMeasure: growthResult.finalSimilarity,
        regionBounds: this.calculateRegionBounds(region),
        volume: stats.voxelCount * this.calculateVoxelVolume(segmentation),
        centroid: this.calculateCentroid(region),
        processingTime: performance.now() - startTime,
        convergenceReached: growthResult.converged,
      };

      this.lastResult = result;

      log.info('Region growing completed', {
        component: 'RegionGrowingTool',
        metadata: {
          segmentationId: segmentation.segmentationId,
          segmentIndex,
          grownVoxels: appliedVoxels,
          iterations: growthResult.iterations,
          processingTime: result.processingTime,
          converged: growthResult.converged,
        },
      });

      this.emit('regionGrowingCompleted', {
        segmentation,
        result,
        config: effectiveConfig,
      });

      return result;

    } catch (error) {
      log.error('Region growing failed', {
        component: 'RegionGrowingTool',
        metadata: {
          segmentationId: segmentation.segmentationId,
          segmentIndex,
        },
      }, error as Error);

      this.emit('regionGrowingError', { error, segmentation, segmentIndex });
      throw error;

    } finally {
      this.isProcessing = false;
      this.shouldStop = false;
    }
  }

  /**
   * Stop current region growing operation
   */
  stopRegionGrowing(): void {
    if (this.isProcessing) {
      this.shouldStop = true;
      log.info('Region growing stop requested', {
        component: 'RegionGrowingTool',
      });
    }
  }

  /**
   * Preview region growing without applying to segmentation
   */
  async previewRegionGrowing(
    segmentation: Segmentation,
    config?: Partial<RegionGrowingConfig>,
  ): Promise<{
    grownVoxels: number;
    iterations: number;
    estimatedVolume: number;
    previewMask: Uint8Array;
  }> {
    const effectiveConfig = config ? { ...this.config, ...config } : this.config;

    try {
      const volumeData = await this.getVolumeData(segmentation);
      const gradientData = this.calculateGradientData(volumeData, segmentation);
      const region = this.initializeRegion(volumeData, gradientData, effectiveConfig, segmentation);

      // Run limited iterations for preview
      const previewConfig = {
        ...effectiveConfig,
        stopCriteria: {
          ...effectiveConfig.stopCriteria,
          maxIterations: Math.min(100, effectiveConfig.stopCriteria.maxIterations),
        },
      };

      const growthResult = await this.performRegionGrowing(
        region, volumeData, gradientData, previewConfig, segmentation,
      );

      const mask = this.createRegionMask(region, segmentation);
      const grownVoxels = Object.values(region).filter(voxel => voxel.inRegion).length;
      const estimatedVolume = grownVoxels * this.calculateVoxelVolume(segmentation);

      return {
        grownVoxels,
        iterations: growthResult.iterations,
        estimatedVolume,
        previewMask: mask,
      };

    } catch (error) {
      log.error('Failed to preview region growing', {
        component: 'RegionGrowingTool',
      }, error as Error);
      throw error;
    }
  }

  /**
   * Get last region growing result
   */
  getLastResult(): RegionGrowingResult | null {
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
    const dimensions = segmentation.data.dimensions!;
    const totalVoxels = dimensions[0] * dimensions[1] * dimensions[2];

    // Generate mock data for now
    const data = new Float32Array(totalVoxels);
    for (let i = 0; i < totalVoxels; i++) {
      data[i] = Math.random() * 1000; // Random values for testing
    }

    log.warn('Using mock volume data - implement actual volume data retrieval', {
      component: 'RegionGrowingTool',
    });

    return data;
  }

  /**
   * Calculate gradient data for gradient-based similarity
   */
  private calculateGradientData(volumeData: Float32Array, segmentation: Segmentation): Float32Array {
    const dimensions = segmentation.data.dimensions!;
    const gradientData = new Float32Array(volumeData.length);

    // Calculate gradient magnitude using central differences
    for (let z = 1; z < dimensions[2] - 1; z++) {
      for (let y = 1; y < dimensions[1] - 1; y++) {
        for (let x = 1; x < dimensions[0] - 1; x++) {
          const index = this.coordsToIndex({ x, y, z }, dimensions);

          // Calculate gradient in each direction
          const gx = (this.getVoxelValue(volumeData, { x: x + 1, y, z }, dimensions) -
                     this.getVoxelValue(volumeData, { x: x - 1, y, z }, dimensions)) / 2;
          const gy = (this.getVoxelValue(volumeData, { x, y: y + 1, z }, dimensions) -
                     this.getVoxelValue(volumeData, { x, y: y - 1, z }, dimensions)) / 2;
          const gz = (this.getVoxelValue(volumeData, { x, y, z: z + 1 }, dimensions) -
                     this.getVoxelValue(volumeData, { x, y, z: z - 1 }, dimensions)) / 2;

          // Gradient magnitude
          gradientData[index] = Math.sqrt(gx * gx + gy * gy + gz * gz);
        }
      }
    }

    return gradientData;
  }

  /**
   * Initialize region with seed points
   */
  private initializeRegion(
    volumeData: Float32Array,
    gradientData: Float32Array,
    config: RegionGrowingConfig,
    segmentation: Segmentation,
  ): Record<string, Voxel> {
    const dimensions = segmentation.data.dimensions!;
    const region: Record<string, Voxel> = {};

    // Add seed points to region
    for (const seedPoint of config.seedPoints) {
      if (this.isValidCoord(seedPoint, dimensions)) {
        const key = this.pointToKey(seedPoint);
        const index = this.coordsToIndex(seedPoint, dimensions);

        region[key] = {
          point: seedPoint,
          value: volumeData[index],
          gradient: gradientData[index],
          visited: true,
          inRegion: true,
        };
      }
    }

    return region;
  }

  /**
   * Perform the main region growing algorithm
   */
  private async performRegionGrowing(
    region: Record<string, Voxel>,
    volumeData: Float32Array,
    gradientData: Float32Array,
    config: RegionGrowingConfig,
    segmentation: Segmentation,
  ): Promise<{ iterations: number; finalSimilarity: number; converged: boolean }> {
    const dimensions = segmentation.data.dimensions!;
    const queue: Point3D[] = [...config.seedPoints];

    let iterations = 0;
    let previousRegionSize = Object.keys(region).length;
    let finalSimilarity = 0;

    const offsets = this.getNeighborOffsets();

    while (queue.length > 0 &&
           iterations < config.stopCriteria.maxIterations &&
           !this.shouldStop) {

      const currentPoint = queue.shift()!;

      // Check region size constraint
      if (Object.keys(region).length >= (config.constraints.maxRegionSize || Infinity)) {
        break;
      }

      // Check all neighbors
      for (const offset of offsets) {
        const neighbor: Point3D = {
          x: currentPoint.x + offset.x,
          y: currentPoint.y + offset.y,
          z: currentPoint.z + offset.z,
        };

        if (!this.isValidCoord(neighbor, dimensions)) {
          continue;
        }

        const neighborKey = this.pointToKey(neighbor);

        // Skip if already processed
        if (region[neighborKey]) {
          continue;
        }

        // Check distance constraint
        const distance = this.calculateMinDistanceToSeeds(neighbor, config.seedPoints);
        if (distance > (config.constraints.maxDistance || Infinity)) {
          continue;
        }

        // Calculate similarity
        const similarity = this.calculateSimilarity(
          neighbor, volumeData, gradientData, region, config, dimensions,
        );

        finalSimilarity = similarity.intensityDifference; // Store for result

        // Check if neighbor should be added to region
        if (this.shouldAddToRegion(similarity, config)) {
          const index = this.coordsToIndex(neighbor, dimensions);

          region[neighborKey] = {
            point: neighbor,
            value: volumeData[index],
            gradient: gradientData[index],
            visited: true,
            inRegion: true,
          };

          queue.push(neighbor);

          // Emit progress periodically
          if (iterations % 100 === 0) {
            this.emit('regionGrowingProgress', {
              iterations,
              regionSize: Object.keys(region).length,
              queueSize: queue.length,
            });
          }
        } else {
          // Mark as visited but not in region
          const index = this.coordsToIndex(neighbor, dimensions);
          region[neighborKey] = {
            point: neighbor,
            value: volumeData[index],
            gradient: gradientData[index],
            visited: true,
            inRegion: false,
          };
        }
      }

      iterations++;

      // Check convergence
      if (iterations % 50 === 0) {
        const currentRegionSize = Object.values(region).filter(v => v.inRegion).length;
        const growthRate = (currentRegionSize - previousRegionSize) / previousRegionSize;

        if (growthRate < config.stopCriteria.convergenceThreshold) {
          log.debug('Region growing converged', {
            component: 'RegionGrowingTool',
            metadata: { iterations, regionSize: currentRegionSize, growthRate },
          });
          return { iterations, finalSimilarity, converged: true };
        }

        previousRegionSize = currentRegionSize;
      }
    }

    const finalRegionSize = Object.values(region).filter(v => v.inRegion).length;
    const converged = iterations < config.stopCriteria.maxIterations && !this.shouldStop;

    log.debug('Region growing finished', {
      component: 'RegionGrowingTool',
      metadata: {
        iterations,
        finalRegionSize,
        converged,
        stopped: this.shouldStop,
      },
    });

    return { iterations, finalSimilarity, converged };
  }

  /**
   * Calculate similarity between a point and the current region
   */
  private calculateSimilarity(
    point: Point3D,
    volumeData: Float32Array,
    gradientData: Float32Array,
    region: Record<string, Voxel>,
    config: RegionGrowingConfig,
    dimensions: number[],
  ): SimilarityMetrics {
    const index = this.coordsToIndex(point, dimensions);
    const pointValue = volumeData[index];
    const pointGradient = gradientData[index];

    // Get region statistics
    const regionVoxels = Object.values(region).filter(v => v.inRegion);
    const regionStats = this.calculateRegionStatistics(
      Object.fromEntries(regionVoxels.map(v => [this.pointToKey(v.point), v])),
      volumeData,
      { data: { dimensions } } as Segmentation,
    );

    let intensityDifference = 0;
    let gradientDifference = 0;
    let adaptiveThreshold = config.similarity.threshold;

    switch (config.similarity.mode) {
      case 'intensity':
        intensityDifference = Math.abs(pointValue - regionStats.meanIntensity);
        break;

      case 'gradient': {
        const regionGradientMean = regionVoxels.reduce((sum, v) => sum + (v.gradient || 0), 0) / regionVoxels.length;
        gradientDifference = Math.abs(pointGradient - regionGradientMean);
        intensityDifference = gradientDifference;
        break;
      }

      case 'adaptive': {
        intensityDifference = Math.abs(pointValue - regionStats.meanIntensity);
        // Adaptive threshold based on region statistics
        const radiusFromSeed = config.similarity.radius || 5;
        const distanceToSeeds = this.calculateMinDistanceToSeeds(point, config.seedPoints);
        const adaptiveFactor = Math.min(1.0, distanceToSeeds / radiusFromSeed);
        adaptiveThreshold = config.similarity.threshold * (1 + adaptiveFactor * regionStats.standardDeviation / regionStats.meanIntensity);
        break;
      }
    }

    const distance = this.calculateMinDistanceToRegion(point, regionVoxels);

    return {
      intensityDifference,
      gradientDifference,
      adaptiveThreshold,
      distance,
    };
  }

  /**
   * Determine if a point should be added to the region
   */
  private shouldAddToRegion(similarity: SimilarityMetrics, config: RegionGrowingConfig): boolean {
    const threshold = config.similarity.mode === 'adaptive'
      ? similarity.adaptiveThreshold
      : config.similarity.threshold;

    return similarity.intensityDifference <= threshold;
  }

  /**
   * Apply region to segmentation
   */
  private applyRegionToSegmentation(
    region: Record<string, Voxel>,
    _segmentation: Segmentation,
    segmentIndex: number,
  ): number {
    // TODO: Implement actual application to segmentation volume
    const regionVoxels = Object.values(region).filter(v => v.inRegion);

    log.warn('Region application to segmentation not yet implemented', {
      component: 'RegionGrowingTool',
      metadata: { segmentIndex, regionSize: regionVoxels.length },
    });

    return regionVoxels.length;
  }

  /**
   * Calculate region statistics
   */
  private calculateRegionStatistics(
    region: Record<string, Voxel>,
    _volumeData: Float32Array,
    segmentation: Segmentation,
  ): RegionStats {
    const regionVoxels = Object.values(region).filter(v => v.inRegion);

    if (regionVoxels.length === 0) {
      return {
        meanIntensity: 0,
        standardDeviation: 0,
        minIntensity: 0,
        maxIntensity: 0,
        voxelCount: 0,
        compactness: 0,
      };
    }

    const values = regionVoxels.map(v => v.value);
    const meanIntensity = values.reduce((sum, val) => sum + val, 0) / values.length;
    const minIntensity = Math.min(...values);
    const maxIntensity = Math.max(...values);

    const variance = values.reduce((sum, val) => sum + Math.pow(val - meanIntensity, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);

    // Calculate compactness (sphericity measure)
    const bounds = this.calculateRegionBounds(region);
    const volume = regionVoxels.length * this.calculateVoxelVolume(segmentation);
    const boundingBoxVolume = (bounds.max.x - bounds.min.x + 1) *
                             (bounds.max.y - bounds.min.y + 1) *
                             (bounds.max.z - bounds.min.z + 1);
    const compactness = boundingBoxVolume > 0 ? volume / boundingBoxVolume : 0;

    return {
      meanIntensity,
      standardDeviation,
      minIntensity,
      maxIntensity,
      voxelCount: regionVoxels.length,
      compactness,
    };
  }

  /**
   * Calculate region bounds
   */
  private calculateRegionBounds(region: Record<string, Voxel>): { min: Point3D; max: Point3D } {
    const regionVoxels = Object.values(region).filter(v => v.inRegion);

    if (regionVoxels.length === 0) {
      return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
    }

    const firstPoint = regionVoxels[0].point;
    const min = { ...firstPoint };
    const max = { ...firstPoint };

    for (const voxel of regionVoxels) {
      const p = voxel.point;
      min.x = Math.min(min.x, p.x);
      min.y = Math.min(min.y, p.y);
      min.z = Math.min(min.z, p.z);
      max.x = Math.max(max.x, p.x);
      max.y = Math.max(max.y, p.y);
      max.z = Math.max(max.z, p.z);
    }

    return { min, max };
  }

  /**
   * Calculate region centroid
   */
  private calculateCentroid(region: Record<string, Voxel>): Point3D {
    const regionVoxels = Object.values(region).filter(v => v.inRegion);

    if (regionVoxels.length === 0) {
      return { x: 0, y: 0, z: 0 };
    }

    const sum = regionVoxels.reduce(
      (acc, voxel) => ({
        x: acc.x + voxel.point.x,
        y: acc.y + voxel.point.y,
        z: acc.z + voxel.point.z,
      }),
      { x: 0, y: 0, z: 0 },
    );

    return {
      x: sum.x / regionVoxels.length,
      y: sum.y / regionVoxels.length,
      z: sum.z / regionVoxels.length,
    };
  }

  /**
   * Create binary mask from region
   */
  private createRegionMask(region: Record<string, Voxel>, _segmentation: Segmentation): Uint8Array {
    const dimensions = _segmentation.data.dimensions!;
    const mask = new Uint8Array(dimensions[0] * dimensions[1] * dimensions[2]);

    const regionVoxels = Object.values(region).filter(v => v.inRegion);
    for (const voxel of regionVoxels) {
      const index = this.coordsToIndex(voxel.point, dimensions);
      mask[index] = 255;
    }

    return mask;
  }

  /**
   * Calculate minimum distance to seed points
   */
  private calculateMinDistanceToSeeds(point: Point3D, seedPoints: Point3D[]): number {
    if (seedPoints.length === 0) return Infinity;

    return Math.min(...seedPoints.map(seed => this.calculateDistance(point, seed)));
  }

  /**
   * Calculate minimum distance to region
   */
  private calculateMinDistanceToRegion(point: Point3D, regionVoxels: Voxel[]): number {
    if (regionVoxels.length === 0) return Infinity;

    return Math.min(...regionVoxels.map(voxel => this.calculateDistance(point, voxel.point)));
  }

  /**
   * Calculate distance between two points
   */
  private calculateDistance(point1: Point3D, point2: Point3D): number {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    const dz = point1.z - point2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Get neighbor offsets for region growing
   */
  private getNeighborOffsets(): Point3D[] {
    // 26-connectivity (all neighbors)
    const offsets: Point3D[] = [];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx !== 0 || dy !== 0 || dz !== 0) {
            offsets.push({ x: dx, y: dy, z: dz });
          }
        }
      }
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
   * Convert point to string key
   */
  private pointToKey(point: Point3D): string {
    return `${point.x},${point.y},${point.z}`;
  }

  /**
   * Get voxel value safely
   */
  private getVoxelValue(volumeData: Float32Array, point: Point3D, dimensions: number[]): number {
    if (!this.isValidCoord(point, dimensions)) {
      return 0;
    }
    const index = this.coordsToIndex(point, dimensions);
    return volumeData[index];
  }

  /**
   * Calculate voxel volume
   */
  private calculateVoxelVolume(segmentation: Segmentation): number {
    const spacing = segmentation.data.spacing || [1, 1, 1];
    return spacing[0] * spacing[1] * spacing[2];
  }
}

export default RegionGrowingTool;
