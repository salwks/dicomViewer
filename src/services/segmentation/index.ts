/**
 * Segmentation Services Index
 * Exports all segmentation-related services and utilities
 */

// Core manager
export { SegmentationManager, segmentationManager } from './SegmentationManager';

// Tools
export { BrushTool } from './tools/BrushTool';
export { ThresholdTool } from './tools/ThresholdTool';
export { RegionGrowingTool } from './tools/RegionGrowingTool';
export { SegmentationEditingTools } from './tools/SegmentationEditingTools';

// Visualization
export { SegmentationVisualizer } from './visualization/SegmentationVisualizer';

// Export
export { SegmentationExporter } from './export/SegmentationExporter';

// Types (re-export from types directory)
export * from '../../types/segmentation';

// Tool-specific types
export type {
  Point3D,
  BrushStroke,
  BrushOperationResult,
} from './tools/BrushTool';

export type {
  ConnectedComponent,
  ThresholdResult,
  HistogramData,
} from './tools/ThresholdTool';

export type {
  Voxel,
  RegionGrowingResult,
  SimilarityMetrics,
  RegionStats,
} from './tools/RegionGrowingTool';

export type {
  EditingResult,
  Component,
  InterpolationParams,
} from './tools/SegmentationEditingTools';

// Visualization types
export type {
  VisualizationConfig,
  SegmentVisualization,
  SurfaceRepresentation,
  VisualizationStats,
} from './visualization/SegmentationVisualizer';

// Export types
export type {
  ExportProgress,
  ExportResult,
  DICOMSEGHeader,
  NIfTIHeader,
  STLExportOptions,
} from './export/SegmentationExporter';

// Enums
export {
  VisualizationMode,
  ColorScheme,
  RenderingQuality,
} from './visualization/SegmentationVisualizer';

// Import the actual classes for the toolkit
import { SegmentationManager } from './SegmentationManager';
import { BrushTool } from './tools/BrushTool';
import { ThresholdTool } from './tools/ThresholdTool';
import { RegionGrowingTool } from './tools/RegionGrowingTool';
import { SegmentationEditingTools } from './tools/SegmentationEditingTools';
import { SegmentationVisualizer } from './visualization/SegmentationVisualizer';
import { SegmentationExporter } from './export/SegmentationExporter';

/**
 * Create a complete segmentation toolkit with all tools initialized
 */
export class SegmentationToolkit {
  public readonly manager: SegmentationManager;
  public readonly brushTool: BrushTool;
  public readonly thresholdTool: ThresholdTool;
  public readonly regionGrowingTool: RegionGrowingTool;
  public readonly editingTools: SegmentationEditingTools;
  public readonly visualizer: SegmentationVisualizer;
  public readonly exporter: SegmentationExporter;

  constructor() {
    this.manager = SegmentationManager.getInstance();
    this.brushTool = new BrushTool();
    this.thresholdTool = new ThresholdTool();
    this.regionGrowingTool = new RegionGrowingTool();
    this.editingTools = new SegmentationEditingTools();
    this.visualizer = new SegmentationVisualizer();
    this.exporter = new SegmentationExporter();

    // Connect tools to manager events
    this.setupEventConnections();
  }

  /**
   * Setup event connections between tools and manager
   */
  private setupEventConnections(): void {
    // Forward important events from tools to toolkit
    this.manager.on('segmentationCreated', (event: unknown) => {
      this.emit('segmentationCreated', event);
    });

    this.manager.on('segmentationUpdated', (event: unknown) => {
      this.emit('segmentationUpdated', event);
    });

    this.brushTool.on('strokeCompleted', (event: unknown) => {
      this.emit('brushStrokeCompleted', event);
    });

    this.thresholdTool.on('thresholdCompleted', (event: unknown) => {
      this.emit('thresholdCompleted', event);
    });

    this.regionGrowingTool.on('regionGrowingCompleted', (event: unknown) => {
      this.emit('regionGrowingCompleted', event);
    });

    this.editingTools.on('editingCompleted', (event: unknown) => {
      this.emit('editingCompleted', event);
    });

    this.visualizer.on('visualizationInitialized', (event: unknown) => {
      this.emit('visualizationInitialized', event);
    });

    this.exporter.on('exportCompleted', (event: unknown) => {
      this.emit('exportCompleted', event);
    });
  }

  /**
   * Event emitter methods (toolkit extends EventEmitter conceptually)
   */
  private listeners: Map<string, Array<(...args: any[]) => void>> = new Map();

  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const listener of eventListeners) {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      }
    }
  }

  off(event: string, listener: (...args: any[]) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  /**
   * Get toolkit status and statistics
   */
  getStatus(): {
    segmentationCount: number;
    activeTools: string[];
    memoryUsage: number;
    } {
    const segmentations = this.manager.getAllSegmentations();
    const activeTools: string[] = [];

    if (this.brushTool.isActiveStroke()) activeTools.push('brush');
    if (this.thresholdTool.isCurrentlyProcessing()) activeTools.push('threshold');
    if (this.regionGrowingTool.isCurrentlyProcessing()) activeTools.push('regionGrowing');
    if (this.editingTools.isCurrentlyProcessing()) activeTools.push('editing');
    if (this.visualizer.isCurrentlyRendering()) activeTools.push('visualizer');
    if (this.exporter.isCurrentlyExporting()) activeTools.push('exporter');

    const visualizerStats = this.visualizer.getVisualizationStats();

    return {
      segmentationCount: segmentations.length,
      activeTools,
      memoryUsage: visualizerStats.memoryUsage,
    };
  }
}

/**
 * Create singleton toolkit instance
 */
export const segmentationToolkit = new SegmentationToolkit();

export default {
  SegmentationManager,
  segmentationManager: SegmentationManager.getInstance(),
  BrushTool,
  ThresholdTool,
  RegionGrowingTool,
  SegmentationEditingTools,
  SegmentationVisualizer,
  SegmentationExporter,
  SegmentationToolkit,
  segmentationToolkit,
};
