/**
 * Segmentation Manager
 * Comprehensive segmentation management system for medical imaging
 * Handles segmentation creation, manipulation, and lifecycle management
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  Segmentation,
  SegmentationConfig,
  Segment,
  SegmentationRepresentation,
  SegmentationEvent,
  SegmentationEventType,
  SegmentationValidationResult,
  SegmentationPerformanceMetrics,
  EditingConfig,
  EditingOperation,
  ExportConfig,
  SegmentationFormat,
} from '../../types/segmentation';
import { log } from '../../utils/logger';

/**
 * Central manager for all segmentation operations
 */
export class SegmentationManager extends EventEmitter {
  private static instance: SegmentationManager | null = null;
  private segmentations: Map<string, Segmentation> = new Map();
  private activeSegmentationId: string | null = null;
  private maxHistorySize = 50;
  private operationHistory: Array<{
    operation: string;
    segmentationId: string;
    timestamp: Date;
    undoData?: unknown;
  }> = [];

  constructor() {
    super();
    this.initializeEventHandlers();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SegmentationManager {
    if (!SegmentationManager.instance) {
      SegmentationManager.instance = new SegmentationManager();
    }
    return SegmentationManager.instance;
  }

  /**
   * Initialize event handlers for internal state management
   */
  private initializeEventHandlers(): void {
    this.on('error', (error: Error) => {
      log.error('SegmentationManager error', {
        component: 'SegmentationManager',
      }, error);
    });
  }

  /**
   * Create a new segmentation
   */
  createSegmentation(config: Partial<SegmentationConfig>): string {
    const startTime = performance.now();

    try {
      const segmentationId = config.segmentationId || uuidv4();

      // Validate segmentation ID uniqueness
      if (this.segmentations.has(segmentationId)) {
        throw new Error(`Segmentation with ID ${segmentationId} already exists`);
      }

      // Create default configuration
      const defaultConfig: SegmentationConfig = {
        segmentationId,
        representation: SegmentationRepresentation.LABELMAP,
        activeSegmentIndex: 1,
        visibility: true,
        locked: false,
        renderInactiveSegmentations: true,
        segments: [],
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
        },
      };

      // Merge with provided configuration
      const finalConfig = { ...defaultConfig, ...config, segmentationId };

      // Create segmentation object
      const segmentation: Segmentation = {
        segmentationId,
        config: finalConfig,
        data: {
          dimensions: [0, 0, 0],
          spacing: [1, 1, 1],
          origin: [0, 0, 0],
          direction: [1, 0, 0, 0, 1, 0, 0, 0, 1],
        },
        statistics: {
          totalVolume: 0,
          segmentVolumes: {},
          voxelCount: 0,
          boundingBox: {
            min: [0, 0, 0],
            max: [0, 0, 0],
          },
        },
      };

      // Store segmentation
      this.segmentations.set(segmentationId, segmentation);

      // Set as active if none exists
      if (!this.activeSegmentationId) {
        this.activeSegmentationId = segmentationId;
      }

      // Record operation
      this.recordOperation('create', segmentationId);

      // Emit event
      this.emitSegmentationEvent(SegmentationEventType.CREATED, segmentationId);

      // Log performance
      this.logPerformance('createSegmentation', startTime, 0);

      log.info(`Created segmentation: ${segmentationId}`, {
        component: 'SegmentationManager',
        metadata: { segmentationId, representation: finalConfig.representation },
      });

      return segmentationId;

    } catch (error) {
      log.error('Failed to create segmentation', {
        component: 'SegmentationManager',
      }, error as Error);
      throw error;
    }
  }

  /**
   * Add a segment to an existing segmentation
   */
  addSegment(segmentationId: string, segment: Partial<Segment>): void {
    const segmentation = this.getSegmentation(segmentationId);
    if (!segmentation) {
      throw new Error(`Segmentation ${segmentationId} not found`);
    }

    // Create segment with defaults
    const newSegment: Segment = {
      segmentIndex: segment.segmentIndex || this.getNextSegmentIndex(segmentationId),
      label: segment.label || `Segment ${segment.segmentIndex}`,
      color: segment.color || this.generateSegmentColor(segment.segmentIndex || 1),
      opacity: segment.opacity ?? 0.5,
      visible: segment.visible ?? true,
      locked: segment.locked ?? false,
      category: segment.category,
      description: segment.description,
      metadata: segment.metadata,
    };

    // Validate segment index uniqueness
    const existingSegment = segmentation.config.segments.find(
      s => s.segmentIndex === newSegment.segmentIndex,
    );
    if (existingSegment) {
      throw new Error(`Segment with index ${newSegment.segmentIndex} already exists`);
    }

    // Add segment
    segmentation.config.segments.push(newSegment);
    segmentation.config.metadata!.lastModified = new Date();

    // Record operation
    this.recordOperation('addSegment', segmentationId, { segment: newSegment });

    // Emit event
    this.emitSegmentationEvent(SegmentationEventType.SEGMENT_ADDED, segmentationId, newSegment.segmentIndex);

    log.info(`Added segment ${newSegment.segmentIndex} to segmentation ${segmentationId}`, {
      component: 'SegmentationManager',
      metadata: { segmentationId, segmentIndex: newSegment.segmentIndex },
    });
  }

  /**
   * Update segment properties
   */
  updateSegment(segmentationId: string, segmentIndex: number, updates: Partial<Segment>): void {
    const segmentation = this.getSegmentation(segmentationId);
    if (!segmentation) {
      throw new Error(`Segmentation ${segmentationId} not found`);
    }

    const segmentIdx = segmentation.config.segments.findIndex(
      s => s.segmentIndex === segmentIndex,
    );
    if (segmentIdx === -1) {
      throw new Error(`Segment ${segmentIndex} not found`);
    }

    // Store original for undo
    const originalSegment = { ...segmentation.config.segments[segmentIdx] };

    // Apply updates
    segmentation.config.segments[segmentIdx] = {
      ...segmentation.config.segments[segmentIdx],
      ...updates,
      segmentIndex, // Preserve segment index
    };

    segmentation.config.metadata!.lastModified = new Date();

    // Record operation
    this.recordOperation('updateSegment', segmentationId, {
      segmentIndex,
      originalSegment,
    });

    // Emit event
    this.emitSegmentationEvent(SegmentationEventType.SEGMENT_UPDATED, segmentationId, segmentIndex);

    log.info(`Updated segment ${segmentIndex} in segmentation ${segmentationId}`, {
      component: 'SegmentationManager',
      metadata: { segmentationId, segmentIndex },
    });
  }

  /**
   * Remove a segment from segmentation
   */
  removeSegment(segmentationId: string, segmentIndex: number): void {
    const segmentation = this.getSegmentation(segmentationId);
    if (!segmentation) {
      throw new Error(`Segmentation ${segmentationId} not found`);
    }

    const segmentIdx = segmentation.config.segments.findIndex(
      s => s.segmentIndex === segmentIndex,
    );
    if (segmentIdx === -1) {
      throw new Error(`Segment ${segmentIndex} not found`);
    }

    // Store for undo
    const removedSegment = segmentation.config.segments[segmentIdx];

    // Remove segment
    segmentation.config.segments.splice(segmentIdx, 1);
    segmentation.config.metadata!.lastModified = new Date();

    // Adjust active segment if necessary
    if (segmentation.config.activeSegmentIndex === segmentIndex) {
      segmentation.config.activeSegmentIndex =
        segmentation.config.segments.length > 0 ? segmentation.config.segments[0].segmentIndex : 0;
    }

    // Record operation
    this.recordOperation('removeSegment', segmentationId, {
      segmentIndex,
      removedSegment,
    });

    // Emit event
    this.emitSegmentationEvent(SegmentationEventType.SEGMENT_REMOVED, segmentationId, segmentIndex);

    log.info(`Removed segment ${segmentIndex} from segmentation ${segmentationId}`, {
      component: 'SegmentationManager',
      metadata: { segmentationId, segmentIndex },
    });
  }

  /**
   * Get segmentation by ID
   */
  getSegmentation(segmentationId: string): Segmentation | null {
    return this.segmentations.get(segmentationId) || null;
  }

  /**
   * Get all segmentations
   */
  getAllSegmentations(): Segmentation[] {
    return Array.from(this.segmentations.values());
  }

  /**
   * Get active segmentation
   */
  getActiveSegmentation(): Segmentation | null {
    return this.activeSegmentationId ? this.getSegmentation(this.activeSegmentationId) : null;
  }

  /**
   * Set active segmentation
   */
  setActiveSegmentation(segmentationId: string): void {
    if (!this.segmentations.has(segmentationId)) {
      throw new Error(`Segmentation ${segmentationId} not found`);
    }

    const previousId = this.activeSegmentationId;
    this.activeSegmentationId = segmentationId;

    // Emit event
    this.emitSegmentationEvent(SegmentationEventType.ACTIVE_SEGMENT_CHANGED, segmentationId);

    log.info(`Set active segmentation: ${segmentationId}`, {
      component: 'SegmentationManager',
      metadata: { segmentationId, previousId },
    });
  }

  /**
   * Delete segmentation
   */
  deleteSegmentation(segmentationId: string): void {
    const segmentation = this.getSegmentation(segmentationId);
    if (!segmentation) {
      throw new Error(`Segmentation ${segmentationId} not found`);
    }

    // Remove from storage
    this.segmentations.delete(segmentationId);

    // Update active segmentation if deleted
    if (this.activeSegmentationId === segmentationId) {
      const remaining = Array.from(this.segmentations.keys());
      this.activeSegmentationId = remaining.length > 0 ? remaining[0] : null;
    }

    // Record operation
    this.recordOperation('delete', segmentationId, { segmentation });

    // Emit event
    this.emitSegmentationEvent(SegmentationEventType.DELETED, segmentationId);

    log.info(`Deleted segmentation: ${segmentationId}`, {
      component: 'SegmentationManager',
      metadata: { segmentationId },
    });
  }

  /**
   * Validate segmentation configuration
   */
  validateSegmentation(config: SegmentationConfig): SegmentationValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Required field validation
    if (!config.segmentationId) {
      errors.push('Segmentation ID is required');
    }

    if (!Object.values(SegmentationRepresentation).includes(config.representation)) {
      errors.push('Invalid segmentation representation');
    }

    // Segment validation
    const segmentIndices = new Set<number>();
    for (const segment of config.segments) {
      if (segmentIndices.has(segment.segmentIndex)) {
        errors.push(`Duplicate segment index: ${segment.segmentIndex}`);
      }
      segmentIndices.add(segment.segmentIndex);

      if (segment.opacity < 0 || segment.opacity > 1) {
        errors.push(`Invalid opacity for segment ${segment.segmentIndex}: must be between 0 and 1`);
      }

      if (segment.color.length !== 3 || segment.color.some(c => c < 0 || c > 255)) {
        errors.push(`Invalid color for segment ${segment.segmentIndex}: must be RGB array [0-255, 0-255, 0-255]`);
      }
    }

    // Warnings and suggestions
    if (config.segments.length === 0) {
      warnings.push('Segmentation has no segments');
      suggestions.push('Add at least one segment to make the segmentation useful');
    }

    if (config.segments.length > 100) {
      warnings.push('Large number of segments may impact performance');
      suggestions.push('Consider grouping related segments or using hierarchical organization');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Export segmentation in specified format
   */
  async exportSegmentation(config: ExportConfig): Promise<ArrayBuffer> {
    const startTime = performance.now();

    try {
      if (config.segmentationIds.length === 0) {
        throw new Error('No segmentations specified for export');
      }

      // Validate all segmentations exist
      for (const id of config.segmentationIds) {
        if (!this.segmentations.has(id)) {
          throw new Error(`Segmentation ${id} not found`);
        }
      }

      let result: ArrayBuffer;

      switch (config.format) {
        case SegmentationFormat.JSON:
          result = this.exportToJSON(config);
          break;
        case SegmentationFormat.DICOM_SEG:
          result = await this.exportToDICOMSEG(config);
          break;
        case SegmentationFormat.NIFTI:
          result = await this.exportToNIfTI(config);
          break;
        case SegmentationFormat.NRRD:
          result = await this.exportToNRRD(config);
          break;
        case SegmentationFormat.STL:
          result = await this.exportToSTL(config);
          break;
        case SegmentationFormat.PNG_SERIES:
          result = await this.exportToPNGSeries(config);
          break;
        default:
          throw new Error(`Unsupported export format: ${config.format}`);
      }

      // Log performance
      this.logPerformance('exportSegmentation', startTime, result.byteLength);

      log.info(`Exported segmentations in ${config.format} format`, {
        component: 'SegmentationManager',
        metadata: {
          format: config.format,
          segmentationCount: config.segmentationIds.length,
          size: result.byteLength,
        },
      });

      return result;

    } catch (error) {
      log.error('Failed to export segmentation', {
        component: 'SegmentationManager',
        metadata: { format: config.format },
      }, error as Error);
      throw error;
    }
  }

  /**
   * Apply editing operation to segmentation
   */
  applyEditingOperation(segmentationId: string, operation: EditingConfig): void {
    const segmentation = this.getSegmentation(segmentationId);
    if (!segmentation) {
      throw new Error(`Segmentation ${segmentationId} not found`);
    }

    const startTime = performance.now();

    try {
      switch (operation.operation) {
        case EditingOperation.SMOOTH:
          this.applySmoothOperation(segmentation, operation.parameters);
          break;
        case EditingOperation.DILATE:
          this.applyDilateOperation(segmentation, operation.parameters);
          break;
        case EditingOperation.ERODE:
          this.applyErodeOperation(segmentation, operation.parameters);
          break;
        case EditingOperation.FILL_HOLES:
          this.applyFillHolesOperation(segmentation, operation.parameters);
          break;
        case EditingOperation.REMOVE_ISLANDS:
          this.applyRemoveIslandsOperation(segmentation, operation.parameters);
          break;
        default:
          throw new Error(`Unsupported editing operation: ${operation.operation}`);
      }

      // Update last modified
      segmentation.config.metadata!.lastModified = new Date();

      // Record operation
      this.recordOperation('edit', segmentationId, { operation });

      // Emit event
      this.emitSegmentationEvent(SegmentationEventType.UPDATED, segmentationId);

      // Log performance
      this.logPerformance(`editOperation_${operation.operation}`, startTime, 0);

      log.info(`Applied ${operation.operation} operation to segmentation ${segmentationId}`, {
        component: 'SegmentationManager',
        metadata: { segmentationId, operation: operation.operation },
      });

    } catch (error) {
      log.error(`Failed to apply ${operation.operation} operation`, {
        component: 'SegmentationManager',
        metadata: { segmentationId, operation: operation.operation },
      }, error as Error);
      throw error;
    }
  }

  /**
   * Get next available segment index
   */
  private getNextSegmentIndex(segmentationId: string): number {
    const segmentation = this.getSegmentation(segmentationId);
    if (!segmentation) return 1;

    const usedIndices = new Set(segmentation.config.segments.map(s => s.segmentIndex));
    let index = 1;
    while (usedIndices.has(index)) {
      index++;
    }
    return index;
  }

  /**
   * Generate color for segment based on index
   */
  private generateSegmentColor(index: number): [number, number, number] {
    // Generate distinct colors using HSV color space
    const hue = (index * 137.508) % 360; // Golden angle approximation for good distribution
    const saturation = 0.7;
    const value = 0.9;

    // Convert HSV to RGB
    const c = value * saturation;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = value - c;

    let r = 0, g = 0, b = 0;

    if (hue >= 0 && hue < 60) {
      r = c; g = x; b = 0;
    } else if (hue >= 60 && hue < 120) {
      r = x; g = c; b = 0;
    } else if (hue >= 120 && hue < 180) {
      r = 0; g = c; b = x;
    } else if (hue >= 180 && hue < 240) {
      r = 0; g = x; b = c;
    } else if (hue >= 240 && hue < 300) {
      r = x; g = 0; b = c;
    } else if (hue >= 300 && hue < 360) {
      r = c; g = 0; b = x;
    }

    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
    ];
  }

  /**
   * Record operation for history/undo
   */
  private recordOperation(operation: string, segmentationId: string, undoData?: unknown): void {
    this.operationHistory.push({
      operation,
      segmentationId,
      timestamp: new Date(),
      undoData,
    });

    // Limit history size
    if (this.operationHistory.length > this.maxHistorySize) {
      this.operationHistory.shift();
    }
  }

  /**
   * Emit segmentation event
   */
  private emitSegmentationEvent(
    type: SegmentationEventType,
    segmentationId: string,
    segmentIndex?: number,
  ): void {
    const event: SegmentationEvent = {
      type,
      segmentationId,
      segmentIndex,
      timestamp: new Date(),
    };

    this.emit(type, event);
  }

  /**
   * Log performance metrics
   */
  private logPerformance(operationType: string, startTime: number, dataSize: number): void {
    const metrics: SegmentationPerformanceMetrics = {
      operationType,
      duration: performance.now() - startTime,
      memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
      voxelsProcessed: dataSize,
      timestamp: new Date(),
    };

    log.performance(`Segmentation operation: ${operationType}`, metrics.duration, {
      component: 'SegmentationManager',
      metadata: metrics,
    });
  }

  // Export format implementations (placeholder implementations)
  private exportToJSON(config: ExportConfig): ArrayBuffer {
    const data = config.segmentationIds.map(id => this.getSegmentation(id));
    const jsonString = JSON.stringify(data, null, 2);
    const encoded = new TextEncoder().encode(jsonString);
    return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer;
  }

  private async exportToDICOMSEG(_config: ExportConfig): Promise<ArrayBuffer> {
    // TODO: Implement DICOM-SEG export
    throw new Error('DICOM-SEG export not yet implemented');
  }

  private async exportToNIfTI(_config: ExportConfig): Promise<ArrayBuffer> {
    // TODO: Implement NIfTI export
    throw new Error('NIfTI export not yet implemented');
  }

  private async exportToNRRD(_config: ExportConfig): Promise<ArrayBuffer> {
    // TODO: Implement NRRD export
    throw new Error('NRRD export not yet implemented');
  }

  private async exportToSTL(_config: ExportConfig): Promise<ArrayBuffer> {
    // TODO: Implement STL export
    throw new Error('STL export not yet implemented');
  }

  private async exportToPNGSeries(_config: ExportConfig): Promise<ArrayBuffer> {
    // TODO: Implement PNG series export
    throw new Error('PNG series export not yet implemented');
  }

  // Editing operation implementations (placeholder implementations)
  private applySmoothOperation(_segmentation: Segmentation, _parameters: Record<string, unknown>): void {
    // TODO: Implement smoothing operation
    log.warn('Smooth operation not yet implemented', { component: 'SegmentationManager' });
  }

  private applyDilateOperation(_segmentation: Segmentation, _parameters: Record<string, unknown>): void {
    // TODO: Implement dilation operation
    log.warn('Dilate operation not yet implemented', { component: 'SegmentationManager' });
  }

  private applyErodeOperation(_segmentation: Segmentation, _parameters: Record<string, unknown>): void {
    // TODO: Implement erosion operation
    log.warn('Erode operation not yet implemented', { component: 'SegmentationManager' });
  }

  private applyFillHolesOperation(_segmentation: Segmentation, _parameters: Record<string, unknown>): void {
    // TODO: Implement fill holes operation
    log.warn('Fill holes operation not yet implemented', { component: 'SegmentationManager' });
  }

  private applyRemoveIslandsOperation(_segmentation: Segmentation, _parameters: Record<string, unknown>): void {
    // TODO: Implement remove islands operation
    log.warn('Remove islands operation not yet implemented', { component: 'SegmentationManager' });
  }
}

// Create and export singleton instance
export const segmentationManager = SegmentationManager.getInstance();
export default SegmentationManager;
