/**
 * Brush Tool for Manual Segmentation
 * Provides brush-based segmentation functionality with various brush modes and shapes
 */

import { EventEmitter } from 'events';
import { BrushToolConfig, Segmentation } from '../../../types/segmentation';
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
 * Brush stroke data
 */
export interface BrushStroke {
  points: Point3D[];
  radius: number;
  segmentIndex: number;
  mode: 'paint' | 'erase' | 'fill';
  timestamp: Date;
}

/**
 * Brush operation result
 */
export interface BrushOperationResult {
  affectedVoxels: number;
  boundingBox: {
    min: Point3D;
    max: Point3D;
  };
  modifiedSlices: number[];
}

/**
 * Brush tool for manual segmentation painting
 */
export class BrushTool extends EventEmitter {
  private config: BrushToolConfig;
  private isActive = false;
  private currentStroke: BrushStroke | null = null;
  private undoStack: BrushStroke[] = [];
  private maxUndoSteps = 50;

  constructor(config: Partial<BrushToolConfig> = {}) {
    super();

    // Default brush configuration
    this.config = {
      radius: 5,
      hardness: 0.8,
      mode: 'paint',
      pressureSensitive: false,
      shape: 'circle',
      spacing: 1.0,
      ...config,
    };

    log.info('BrushTool initialized', {
      component: 'BrushTool',
      metadata: { config: this.config },
    });
  }

  /**
   * Update brush configuration
   */
  updateConfig(updates: Partial<BrushToolConfig>): void {
    this.config = { ...this.config, ...updates };

    log.debug('BrushTool configuration updated', {
      component: 'BrushTool',
      metadata: { config: this.config },
    });

    this.emit('configChanged', this.config);
  }

  /**
   * Get current brush configuration
   */
  getConfig(): BrushToolConfig {
    return { ...this.config };
  }

  /**
   * Start brush stroke
   */
  startStroke(
    point: Point3D,
    segmentIndex: number,
    pressure = 1.0,
  ): void {
    if (this.isActive) {
      this.endStroke();
    }

    const effectiveRadius = this.config.pressureSensitive
      ? this.config.radius * pressure
      : this.config.radius;

    this.currentStroke = {
      points: [point],
      radius: effectiveRadius,
      segmentIndex,
      mode: this.config.mode,
      timestamp: new Date(),
    };

    this.isActive = true;

    log.debug('Brush stroke started', {
      component: 'BrushTool',
      metadata: {
        point,
        segmentIndex,
        mode: this.config.mode,
        radius: effectiveRadius,
      },
    });

    this.emit('strokeStarted', {
      stroke: this.currentStroke,
      point,
    });
  }

  /**
   * Continue brush stroke by adding point
   */
  addStrokePoint(point: Point3D, pressure = 1.0): void {
    if (!this.isActive || !this.currentStroke) {
      log.warn('Attempted to add point without active stroke', {
        component: 'BrushTool',
      });
      return;
    }

    // Check spacing to avoid duplicate points
    const lastPoint = this.currentStroke.points[this.currentStroke.points.length - 1];
    const distance = this.calculateDistance(point, lastPoint);

    if (distance < this.config.spacing) {
      return; // Skip point if too close
    }

    // Update radius based on pressure if enabled
    if (this.config.pressureSensitive) {
      this.currentStroke.radius = this.config.radius * pressure;
    }

    this.currentStroke.points.push(point);

    this.emit('strokePoint', {
      stroke: this.currentStroke,
      point,
      pressure,
    });
  }

  /**
   * End current brush stroke
   */
  endStroke(): BrushOperationResult | null {
    if (!this.isActive || !this.currentStroke) {
      return null;
    }

    const stroke = this.currentStroke;
    this.currentStroke = null;
    this.isActive = false;

    // Add to undo stack
    this.addToUndoStack(stroke);

    // Calculate operation result
    const result = this.calculateStrokeResult(stroke);

    log.info('Brush stroke completed', {
      component: 'BrushTool',
      metadata: {
        pointCount: stroke.points.length,
        affectedVoxels: result.affectedVoxels,
        mode: stroke.mode,
      },
    });

    this.emit('strokeCompleted', {
      stroke,
      result,
    });

    return result;
  }

  /**
   * Cancel current stroke without applying
   */
  cancelStroke(): void {
    if (this.isActive && this.currentStroke) {
      const stroke = this.currentStroke;
      this.currentStroke = null;
      this.isActive = false;

      this.emit('strokeCancelled', { stroke });

      log.debug('Brush stroke cancelled', {
        component: 'BrushTool',
      });
    }
  }

  /**
   * Apply brush stroke to segmentation volume
   */
  applyStrokeToSegmentation(
    segmentation: Segmentation,
    stroke: BrushStroke,
  ): BrushOperationResult {
    const startTime = performance.now();

    try {
      const result = this.processStroke(segmentation, stroke);

      // Update segmentation statistics
      this.updateSegmentationStatistics(segmentation, result);

      const duration = performance.now() - startTime;
      log.performance('Applied brush stroke', duration, {
        component: 'BrushTool',
        metadata: {
          mode: stroke.mode,
          pointCount: stroke.points.length,
          affectedVoxels: result.affectedVoxels,
        },
      });

      return result;

    } catch (error) {
      log.error('Failed to apply brush stroke to segmentation', {
        component: 'BrushTool',
      }, error as Error);
      throw error;
    }
  }

  /**
   * Get brush preview at specific point
   */
  getBrushPreview(point: Point3D, pressure = 1.0): {
    points: Point3D[];
    radius: number;
  } {
    const effectiveRadius = this.config.pressureSensitive
      ? this.config.radius * pressure
      : this.config.radius;

    const points = this.generateBrushShape(point, effectiveRadius);

    return {
      points,
      radius: effectiveRadius,
    };
  }

  /**
   * Undo last brush operation
   */
  undo(): BrushStroke | null {
    if (this.undoStack.length === 0) {
      return null;
    }

    const lastStroke = this.undoStack.pop()!;

    this.emit('strokeUndone', { stroke: lastStroke });

    log.debug('Brush stroke undone', {
      component: 'BrushTool',
      metadata: { remainingUndos: this.undoStack.length },
    });

    return lastStroke;
  }

  /**
   * Clear undo history
   */
  clearUndoHistory(): void {
    this.undoStack = [];
    this.emit('undoHistoryCleared');

    log.debug('Brush undo history cleared', {
      component: 'BrushTool',
    });
  }

  /**
   * Check if brush is currently active
   */
  isActiveStroke(): boolean {
    return this.isActive;
  }

  /**
   * Get current stroke if active
   */
  getCurrentStroke(): BrushStroke | null {
    return this.currentStroke;
  }

  /**
   * Process stroke and apply to volume data
   */
  private processStroke(
    segmentation: Segmentation,
    stroke: BrushStroke,
  ): BrushOperationResult {
    let affectedVoxels = 0;
    const modifiedSlices = new Set<number>();
    const minBounds = { ...stroke.points[0] };
    const maxBounds = { ...stroke.points[0] };

    // Process each point in the stroke
    for (const point of stroke.points) {
      const voxelsInBrush = this.generateBrushShape(point, stroke.radius);

      for (const voxel of voxelsInBrush) {
        // Check bounds
        if (this.isVoxelInBounds(voxel, segmentation)) {
          const modified = this.applyBrushToVoxel(
            segmentation,
            voxel,
            stroke.segmentIndex,
            stroke.mode,
          );

          if (modified) {
            affectedVoxels++;
            modifiedSlices.add(Math.round(voxel.z));

            // Update bounding box
            minBounds.x = Math.min(minBounds.x, voxel.x);
            minBounds.y = Math.min(minBounds.y, voxel.y);
            minBounds.z = Math.min(minBounds.z, voxel.z);
            maxBounds.x = Math.max(maxBounds.x, voxel.x);
            maxBounds.y = Math.max(maxBounds.y, voxel.y);
            maxBounds.z = Math.max(maxBounds.z, voxel.z);
          }
        }
      }
    }

    return {
      affectedVoxels,
      boundingBox: {
        min: minBounds,
        max: maxBounds,
      },
      modifiedSlices: Array.from(modifiedSlices),
    };
  }

  /**
   * Generate brush shape points based on configuration
   */
  private generateBrushShape(center: Point3D, radius: number): Point3D[] {
    const intRadius = Math.ceil(radius);

    switch (this.config.shape) {
      case 'circle':
        return this.generateCircularBrush(center, radius);
      case 'square':
        return this.generateSquareBrush(center, intRadius);
      default:
        log.warn(`Unknown brush shape: ${this.config.shape}`, {
          component: 'BrushTool',
        });
        return this.generateCircularBrush(center, radius);
    }
  }

  /**
   * Generate circular brush shape
   */
  private generateCircularBrush(center: Point3D, radius: number): Point3D[] {
    const points: Point3D[] = [];
    const intRadius = Math.ceil(radius);
    const radiusSquared = radius * radius;

    for (let dx = -intRadius; dx <= intRadius; dx++) {
      for (let dy = -intRadius; dy <= intRadius; dy++) {
        const distanceSquared = dx * dx + dy * dy;

        if (distanceSquared <= radiusSquared) {
          // Apply hardness - softer brushes have gradual falloff
          const distance = Math.sqrt(distanceSquared);
          const falloff = this.calculateBrushFalloff(distance, radius);

          if (falloff > 0) {
            points.push({
              x: Math.round(center.x + dx),
              y: Math.round(center.y + dy),
              z: Math.round(center.z),
            });
          }
        }
      }
    }

    return points;
  }

  /**
   * Generate square brush shape
   */
  private generateSquareBrush(center: Point3D, radius: number): Point3D[] {
    const points: Point3D[] = [];

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        points.push({
          x: Math.round(center.x + dx),
          y: Math.round(center.y + dy),
          z: Math.round(center.z),
        });
      }
    }

    return points;
  }

  /**
   * Calculate brush falloff based on hardness
   */
  private calculateBrushFalloff(distance: number, radius: number): number {
    if (distance >= radius) return 0;

    // Hardness affects falloff curve
    if (this.config.hardness >= 1.0) {
      return 1.0; // Hard brush - no falloff
    }

    // Soft brush with gradual falloff
    const falloffStart = radius * this.config.hardness;
    if (distance <= falloffStart) {
      return 1.0;
    }

    const falloffRange = radius - falloffStart;
    const falloffDistance = distance - falloffStart;
    return 1.0 - (falloffDistance / falloffRange);
  }

  /**
   * Apply brush effect to single voxel
   */
  private applyBrushToVoxel(
    segmentation: Segmentation,
    voxel: Point3D,
    segmentIndex: number,
    mode: 'paint' | 'erase' | 'fill',
  ): boolean {
    // This is a placeholder - actual implementation would depend on the
    // segmentation data structure and volume representation

    switch (mode) {
      case 'paint':
        // Set voxel to segment index
        return this.setVoxelValue(segmentation, voxel, segmentIndex);
      case 'erase':
        // Set voxel to background (0)
        return this.setVoxelValue(segmentation, voxel, 0);
      case 'fill':
        // Flood fill operation would be more complex
        return this.performFloodFill(segmentation, voxel, segmentIndex);
      default:
        return false;
    }
  }

  /**
   * Set voxel value in segmentation (placeholder implementation)
   */
  private setVoxelValue(
    _segmentation: Segmentation,
    _voxel: Point3D,
    _value: number,
  ): boolean {
    // TODO: Implement actual voxel setting based on segmentation data structure
    // This would involve accessing the underlying volume data and setting the value
    return true; // Placeholder return
  }

  /**
   * Perform flood fill operation (placeholder implementation)
   */
  private performFloodFill(
    _segmentation: Segmentation,
    _startVoxel: Point3D,
    _targetValue: number,
  ): boolean {
    // TODO: Implement flood fill algorithm
    log.warn('Flood fill not yet implemented', {
      component: 'BrushTool',
    });
    return false;
  }

  /**
   * Check if voxel is within segmentation bounds
   */
  private isVoxelInBounds(voxel: Point3D, segmentation: Segmentation): boolean {
    const dims = segmentation.data.dimensions;
    if (!dims) return false;

    return (
      voxel.x >= 0 && voxel.x < dims[0] &&
      voxel.y >= 0 && voxel.y < dims[1] &&
      voxel.z >= 0 && voxel.z < dims[2]
    );
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
   * Calculate stroke operation result
   */
  private calculateStrokeResult(stroke: BrushStroke): BrushOperationResult {
    // Calculate approximate affected area based on stroke path and radius
    const approximateVoxels = stroke.points.length * Math.PI * stroke.radius * stroke.radius;

    const minBounds = { ...stroke.points[0] };
    const maxBounds = { ...stroke.points[0] };
    const slices = new Set<number>();

    for (const point of stroke.points) {
      minBounds.x = Math.min(minBounds.x, point.x - stroke.radius);
      minBounds.y = Math.min(minBounds.y, point.y - stroke.radius);
      minBounds.z = Math.min(minBounds.z, point.z);
      maxBounds.x = Math.max(maxBounds.x, point.x + stroke.radius);
      maxBounds.y = Math.max(maxBounds.y, point.y + stroke.radius);
      maxBounds.z = Math.max(maxBounds.z, point.z);
      slices.add(Math.round(point.z));
    }

    return {
      affectedVoxels: Math.round(approximateVoxels),
      boundingBox: { min: minBounds, max: maxBounds },
      modifiedSlices: Array.from(slices),
    };
  }

  /**
   * Add stroke to undo stack
   */
  private addToUndoStack(stroke: BrushStroke): void {
    this.undoStack.push(stroke);

    // Limit undo stack size
    if (this.undoStack.length > this.maxUndoSteps) {
      this.undoStack.shift();
    }
  }

  /**
   * Update segmentation statistics after operation
   */
  private updateSegmentationStatistics(
    segmentation: Segmentation,
    result: BrushOperationResult,
  ): void {
    if (!segmentation.statistics) {
      segmentation.statistics = {
        totalVolume: 0,
        segmentVolumes: {},
        voxelCount: 0,
        boundingBox: {
          min: [0, 0, 0],
          max: [0, 0, 0],
        },
      };
    }

    // Update voxel count (approximate)
    segmentation.statistics.voxelCount += result.affectedVoxels;

    // Update bounding box
    const stats = segmentation.statistics;
    const spacing = segmentation.data.spacing || [1, 1, 1];

    stats.boundingBox.min[0] = Math.min(stats.boundingBox.min[0], result.boundingBox.min.x);
    stats.boundingBox.min[1] = Math.min(stats.boundingBox.min[1], result.boundingBox.min.y);
    stats.boundingBox.min[2] = Math.min(stats.boundingBox.min[2], result.boundingBox.min.z);

    stats.boundingBox.max[0] = Math.max(stats.boundingBox.max[0], result.boundingBox.max.x);
    stats.boundingBox.max[1] = Math.max(stats.boundingBox.max[1], result.boundingBox.max.y);
    stats.boundingBox.max[2] = Math.max(stats.boundingBox.max[2], result.boundingBox.max.z);

    // Calculate total volume
    const width = (stats.boundingBox.max[0] - stats.boundingBox.min[0]) * spacing[0];
    const height = (stats.boundingBox.max[1] - stats.boundingBox.min[1]) * spacing[1];
    const depth = (stats.boundingBox.max[2] - stats.boundingBox.min[2]) * spacing[2];
    stats.totalVolume = width * height * depth;
  }
}

export default BrushTool;
