/**
 * Segmentation Visualizer
 * Handles visualization and rendering of multi-segment segmentations
 */

import { EventEmitter } from 'events';
import { Segmentation, Segment } from '../../../types/segmentation';
import { log } from '../../../utils/logger';

/**
 * Visualization mode for segmentations
 */
export enum VisualizationMode {
  FILLED = 'filled',
  OUTLINE = 'outline',
  FILLED_OUTLINE = 'filled_outline',
  SURFACE = 'surface',
  POINTS = 'points',
}

/**
 * Color scheme for multi-segment visualization
 */
export enum ColorScheme {
  RAINBOW = 'rainbow',
  VIRIDIS = 'viridis',
  PLASMA = 'plasma',
  COOL_WARM = 'cool_warm',
  CUSTOM = 'custom',
}

/**
 * Rendering quality settings
 */
export enum RenderingQuality {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  ULTRA = 'ultra',
}

/**
 * Visualization configuration
 */
export interface VisualizationConfig {
  mode: VisualizationMode;
  colorScheme: ColorScheme;
  opacity: number;
  outlineWidth: number;
  renderingQuality: RenderingQuality;
  showLabels: boolean;
  labelFontSize: number;
  smoothSurfaces: boolean;
  enableLighting: boolean;
  customColors?: Map<number, [number, number, number]>;
}

/**
 * Segment visualization properties
 */
export interface SegmentVisualization {
  segmentIndex: number;
  visible: boolean;
  opacity: number;
  color: [number, number, number];
  outlineColor: [number, number, number];
  outlineWidth: number;
  renderingMode: VisualizationMode;
  customProperties?: Record<string, unknown>;
}

/**
 * 3D surface representation
 */
export interface SurfaceRepresentation {
  segmentIndex: number;
  vertices: Float32Array;
  faces: Uint32Array;
  normals: Float32Array;
  colors: Float32Array;
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
  };
}

/**
 * Visualization statistics
 */
export interface VisualizationStats {
  totalSegments: number;
  visibleSegments: number;
  totalVertices: number;
  totalFaces: number;
  renderingTime: number;
  memoryUsage: number;
}

/**
 * Main segmentation visualizer class
 */
export class SegmentationVisualizer extends EventEmitter {
  private config: VisualizationConfig;
  private segmentVisualizations: Map<number, SegmentVisualization> = new Map();
  private surfaceRepresentations: Map<number, SurfaceRepresentation> = new Map();
  private isRendering = false;

  constructor(config: Partial<VisualizationConfig> = {}) {
    super();

    this.config = {
      mode: VisualizationMode.FILLED_OUTLINE,
      colorScheme: ColorScheme.RAINBOW,
      opacity: 0.7,
      outlineWidth: 2.0,
      renderingQuality: RenderingQuality.MEDIUM,
      showLabels: true,
      labelFontSize: 14,
      smoothSurfaces: true,
      enableLighting: true,
      ...config,
    };

    log.info('SegmentationVisualizer initialized', {
      component: 'SegmentationVisualizer',
      metadata: { config: this.config },
    });
  }

  /**
   * Initialize visualization for a segmentation
   */
  async initializeSegmentation(segmentation: Segmentation): Promise<void> {
    const startTime = performance.now();

    try {
      log.info('Initializing segmentation visualization', {
        component: 'SegmentationVisualizer',
        metadata: {
          segmentationId: segmentation.segmentationId,
          segmentCount: segmentation.config.segments.length,
        },
      });

      // Clear existing visualizations
      this.segmentVisualizations.clear();
      this.surfaceRepresentations.clear();

      // Initialize visualization for each segment
      for (const segment of segmentation.config.segments) {
        await this.initializeSegmentVisualization(segment, segmentation);
      }

      // Generate surface representations if needed
      if (this.config.mode === VisualizationMode.SURFACE) {
        await this.generateSurfaceRepresentations(segmentation);
      }

      const duration = performance.now() - startTime;

      log.performance('Segmentation visualization initialized', duration, {
        component: 'SegmentationVisualizer',
        metadata: {
          segmentationId: segmentation.segmentationId,
          segmentCount: segmentation.config.segments.length,
        },
      });

      this.emit('visualizationInitialized', {
        segmentation,
        duration,
        segmentCount: segmentation.config.segments.length,
      });

    } catch (error) {
      log.error('Failed to initialize segmentation visualization', {
        component: 'SegmentationVisualizer',
        metadata: { segmentationId: segmentation.segmentationId },
      }, error as Error);
      throw error;
    }
  }

  /**
   * Update visualization configuration
   */
  updateVisualizationConfig(updates: Partial<VisualizationConfig>): void {
    const previousConfig = { ...this.config };
    this.config = { ...this.config, ...updates };

    log.debug('Visualization configuration updated', {
      component: 'SegmentationVisualizer',
      metadata: { previousConfig, newConfig: this.config },
    });

    // Check if changes require re-rendering
    const requiresRerender = this.configChangesRequireRerender(previousConfig, this.config);

    if (requiresRerender) {
      this.emit('rerenderRequired', { previousConfig, newConfig: this.config });
    }

    this.emit('configurationChanged', this.config);
  }

  /**
   * Update individual segment visualization
   */
  updateSegmentVisualization(
    segmentIndex: number,
    updates: Partial<SegmentVisualization>,
  ): void {
    const existing = this.segmentVisualizations.get(segmentIndex);
    if (!existing) {
      log.warn(`Segment ${segmentIndex} not found in visualization`, {
        component: 'SegmentationVisualizer',
      });
      return;
    }

    const updated = { ...existing, ...updates };
    this.segmentVisualizations.set(segmentIndex, updated);

    log.debug('Segment visualization updated', {
      component: 'SegmentationVisualizer',
      metadata: { segmentIndex, updates },
    });

    this.emit('segmentVisualizationChanged', {
      segmentIndex,
      visualization: updated,
    });
  }

  /**
   * Set visibility for specific segments
   */
  setSegmentVisibility(segmentIndices: number[], visible: boolean): void {
    let changedCount = 0;

    for (const segmentIndex of segmentIndices) {
      const visualization = this.segmentVisualizations.get(segmentIndex);
      if (visualization && visualization.visible !== visible) {
        visualization.visible = visible;
        changedCount++;
      }
    }

    if (changedCount > 0) {
      log.info(`Updated visibility for ${changedCount} segments`, {
        component: 'SegmentationVisualizer',
        metadata: { segmentIndices, visible },
      });

      this.emit('segmentVisibilityChanged', {
        segmentIndices,
        visible,
        changedCount,
      });
    }
  }

  /**
   * Set opacity for specific segments
   */
  setSegmentOpacity(segmentIndices: number[], opacity: number): void {
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    let changedCount = 0;

    for (const segmentIndex of segmentIndices) {
      const visualization = this.segmentVisualizations.get(segmentIndex);
      if (visualization) {
        visualization.opacity = clampedOpacity;
        changedCount++;
      }
    }

    if (changedCount > 0) {
      log.info(`Updated opacity for ${changedCount} segments`, {
        component: 'SegmentationVisualizer',
        metadata: { segmentIndices, opacity: clampedOpacity },
      });

      this.emit('segmentOpacityChanged', {
        segmentIndices,
        opacity: clampedOpacity,
        changedCount,
      });
    }
  }

  /**
   * Apply color scheme to all segments
   */
  applyColorScheme(colorScheme: ColorScheme): void {
    this.config.colorScheme = colorScheme;

    // Regenerate colors for all segments
    const segmentIndices = Array.from(this.segmentVisualizations.keys());

    for (const segmentIndex of segmentIndices) {
      const visualization = this.segmentVisualizations.get(segmentIndex)!;
      visualization.color = this.generateSegmentColor(segmentIndex, colorScheme);
      visualization.outlineColor = this.generateOutlineColor(visualization.color);
    }

    log.info(`Applied ${colorScheme} color scheme to ${segmentIndices.length} segments`, {
      component: 'SegmentationVisualizer',
      metadata: { colorScheme, segmentCount: segmentIndices.length },
    });

    this.emit('colorSchemeChanged', {
      colorScheme,
      affectedSegments: segmentIndices,
    });
  }

  /**
   * Generate surface representation for segmentation
   */
  async generateSurfaceRepresentations(segmentation: Segmentation): Promise<void> {
    if (this.isRendering) {
      log.warn('Surface generation already in progress', {
        component: 'SegmentationVisualizer',
      });
      return;
    }

    this.isRendering = true;
    const startTime = performance.now();

    try {
      log.info('Generating surface representations', {
        component: 'SegmentationVisualizer',
        metadata: {
          segmentationId: segmentation.segmentationId,
          segmentCount: segmentation.config.segments.length,
        },
      });

      this.surfaceRepresentations.clear();

      for (const segment of segmentation.config.segments) {
        if (segment.visible) {
          const surface = await this.generateSegmentSurface(segment, segmentation);
          if (surface) {
            this.surfaceRepresentations.set(segment.segmentIndex, surface);
          }
        }
      }

      const duration = performance.now() - startTime;

      log.performance('Surface representations generated', duration, {
        component: 'SegmentationVisualizer',
        metadata: {
          segmentationId: segmentation.segmentationId,
          surfaceCount: this.surfaceRepresentations.size,
        },
      });

      this.emit('surfaceRepresentationsGenerated', {
        segmentation,
        surfaceCount: this.surfaceRepresentations.size,
        duration,
      });

    } catch (error) {
      log.error('Failed to generate surface representations', {
        component: 'SegmentationVisualizer',
        metadata: { segmentationId: segmentation.segmentationId },
      }, error as Error);
      throw error;
    } finally {
      this.isRendering = false;
    }
  }

  /**
   * Get visualization statistics
   */
  getVisualizationStats(): VisualizationStats {
    const visibleSegments = Array.from(this.segmentVisualizations.values())
      .filter(v => v.visible).length;

    let totalVertices = 0;
    let totalFaces = 0;

    Array.from(this.surfaceRepresentations.values()).forEach(surface => {
      totalVertices += surface.vertices.length / 3; // 3 components per vertex
      totalFaces += surface.faces.length / 3; // 3 vertices per face
    });

    return {
      totalSegments: this.segmentVisualizations.size,
      visibleSegments,
      totalVertices,
      totalFaces,
      renderingTime: 0, // Would be updated during actual rendering
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  /**
   * Get segment visualization by index
   */
  getSegmentVisualization(segmentIndex: number): SegmentVisualization | null {
    return this.segmentVisualizations.get(segmentIndex) || null;
  }

  /**
   * Get all segment visualizations
   */
  getAllSegmentVisualizations(): Map<number, SegmentVisualization> {
    return new Map(this.segmentVisualizations);
  }

  /**
   * Get surface representation by segment index
   */
  getSurfaceRepresentation(segmentIndex: number): SurfaceRepresentation | null {
    return this.surfaceRepresentations.get(segmentIndex) || null;
  }

  /**
   * Get all surface representations
   */
  getAllSurfaceRepresentations(): Map<number, SurfaceRepresentation> {
    return new Map(this.surfaceRepresentations);
  }

  /**
   * Check if currently rendering
   */
  isCurrentlyRendering(): boolean {
    return this.isRendering;
  }

  /**
   * Initialize visualization for a single segment
   */
  private async initializeSegmentVisualization(
    segment: Segment,
    _segmentation: Segmentation,
  ): Promise<void> {
    const color = this.config.customColors?.get(segment.segmentIndex) ||
                  segment.color ||
                  this.generateSegmentColor(segment.segmentIndex, this.config.colorScheme);

    const visualization: SegmentVisualization = {
      segmentIndex: segment.segmentIndex,
      visible: segment.visible,
      opacity: segment.opacity,
      color,
      outlineColor: this.generateOutlineColor(color),
      outlineWidth: this.config.outlineWidth,
      renderingMode: this.config.mode,
      customProperties: {},
    };

    this.segmentVisualizations.set(segment.segmentIndex, visualization);

    log.debug('Segment visualization initialized', {
      component: 'SegmentationVisualizer',
      metadata: {
        segmentationId: _segmentation.segmentationId,
        segmentIndex: segment.segmentIndex,
        visualization,
      },
    });
  }

  /**
   * Generate surface for a single segment
   */
  private async generateSegmentSurface(
    segment: Segment,
    _segmentation: Segmentation,
  ): Promise<SurfaceRepresentation | null> {
    try {
      // TODO: Implement actual marching cubes or similar surface generation algorithm
      // This is a placeholder implementation

      const mockVertexCount = Math.floor(Math.random() * 10000) + 1000;
      const mockFaceCount = Math.floor(mockVertexCount / 3);

      const surface: SurfaceRepresentation = {
        segmentIndex: segment.segmentIndex,
        vertices: new Float32Array(mockVertexCount * 3), // x, y, z for each vertex
        faces: new Uint32Array(mockFaceCount * 3), // 3 vertex indices per face
        normals: new Float32Array(mockVertexCount * 3), // normal vector for each vertex
        colors: new Float32Array(mockVertexCount * 4), // RGBA for each vertex
        boundingBox: {
          min: [0, 0, 0],
          max: [100, 100, 100], // Mock bounding box
        },
      };

      // Fill with mock data
      const color = this.segmentVisualizations.get(segment.segmentIndex)?.color || [255, 0, 0];
      const normalizedColor = [color[0] / 255, color[1] / 255, color[2] / 255, segment.opacity];

      for (let i = 0; i < mockVertexCount; i++) {
        // Mock vertices
        surface.vertices[i * 3] = Math.random() * 100;
        surface.vertices[i * 3 + 1] = Math.random() * 100;
        surface.vertices[i * 3 + 2] = Math.random() * 100;

        // Mock normals (pointing up)
        surface.normals[i * 3] = 0;
        surface.normals[i * 3 + 1] = 0;
        surface.normals[i * 3 + 2] = 1;

        // Colors
        surface.colors[i * 4] = normalizedColor[0];
        surface.colors[i * 4 + 1] = normalizedColor[1];
        surface.colors[i * 4 + 2] = normalizedColor[2];
        surface.colors[i * 4 + 3] = normalizedColor[3];
      }

      // Mock faces
      for (let i = 0; i < mockFaceCount; i++) {
        surface.faces[i * 3] = Math.floor(Math.random() * mockVertexCount);
        surface.faces[i * 3 + 1] = Math.floor(Math.random() * mockVertexCount);
        surface.faces[i * 3 + 2] = Math.floor(Math.random() * mockVertexCount);
      }

      log.warn('Using mock surface generation - implement actual marching cubes algorithm', {
        component: 'SegmentationVisualizer',
        metadata: {
          segmentIndex: segment.segmentIndex,
          vertexCount: mockVertexCount,
          faceCount: mockFaceCount,
        },
      });

      return surface;

    } catch (error) {
      log.error(`Failed to generate surface for segment ${segment.segmentIndex}`, {
        component: 'SegmentationVisualizer',
        metadata: { segmentIndex: segment.segmentIndex },
      }, error as Error);
      return null;
    }
  }

  /**
   * Generate color for segment based on color scheme
   */
  private generateSegmentColor(segmentIndex: number, colorScheme: ColorScheme): [number, number, number] {
    switch (colorScheme) {
      case ColorScheme.RAINBOW:
        return this.generateRainbowColor(segmentIndex);
      case ColorScheme.VIRIDIS:
        return this.generateViridisColor(segmentIndex);
      case ColorScheme.PLASMA:
        return this.generatePlasmaColor(segmentIndex);
      case ColorScheme.COOL_WARM:
        return this.generateCoolWarmColor(segmentIndex);
      case ColorScheme.CUSTOM:
        return this.config.customColors?.get(segmentIndex) || [255, 255, 255];
      default:
        return this.generateRainbowColor(segmentIndex);
    }
  }

  /**
   * Generate rainbow color based on segment index
   */
  private generateRainbowColor(segmentIndex: number): [number, number, number] {
    const hue = (segmentIndex * 137.508) % 360; // Golden angle for good distribution
    const saturation = 0.8;
    const value = 0.9;

    return this.hsvToRgb(hue, saturation, value);
  }

  /**
   * Generate viridis colormap color
   */
  private generateViridisColor(segmentIndex: number): [number, number, number] {
    // Simplified viridis approximation
    const t = (segmentIndex % 20) / 20; // Normalize to 0-1

    const r = Math.round(255 * (0.267004 + t * (0.329415 - 0.267004)));
    const g = Math.round(255 * (0.004874 + t * (0.886681 - 0.004874)));
    const b = Math.round(255 * (0.329415 + t * (0.173919 - 0.329415)));

    return [r, g, b];
  }

  /**
   * Generate plasma colormap color
   */
  private generatePlasmaColor(segmentIndex: number): [number, number, number] {
    // Simplified plasma approximation
    const t = (segmentIndex % 20) / 20; // Normalize to 0-1

    const r = Math.round(255 * (0.050383 + t * (0.940015 - 0.050383)));
    const g = Math.round(255 * (0.029803 + t * (0.975158 - 0.029803)));
    const b = Math.round(255 * (0.527975 + t * (0.131326 - 0.527975)));

    return [r, g, b];
  }

  /**
   * Generate cool-warm color
   */
  private generateCoolWarmColor(segmentIndex: number): [number, number, number] {
    const t = (segmentIndex % 2 === 0) ? 0.2 : 0.8; // Alternate between cool and warm

    // Cool: blue, Warm: red
    const r = Math.round(255 * t);
    const g = Math.round(255 * 0.3);
    const b = Math.round(255 * (1 - t));

    return [r, g, b];
  }

  /**
   * Generate outline color (typically darker version of main color)
   */
  private generateOutlineColor(baseColor: [number, number, number]): [number, number, number] {
    const darkenFactor = 0.6;
    return [
      Math.round(baseColor[0] * darkenFactor),
      Math.round(baseColor[1] * darkenFactor),
      Math.round(baseColor[2] * darkenFactor),
    ];
  }

  /**
   * Convert HSV to RGB
   */
  private hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let r = 0, g = 0, b = 0;

    if (h >= 0 && h < 60) {
      r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
      r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
      r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
      r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
      r = x; g = 0; b = c;
    } else if (h >= 300 && h < 360) {
      r = c; g = 0; b = x;
    }

    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
    ];
  }

  /**
   * Check if configuration changes require re-rendering
   */
  private configChangesRequireRerender(
    previous: VisualizationConfig,
    current: VisualizationConfig,
  ): boolean {
    const rerenderKeys: (keyof VisualizationConfig)[] = [
      'mode',
      'colorScheme',
      'opacity',
      'outlineWidth',
      'renderingQuality',
      'smoothSurfaces',
      'enableLighting',
    ];

    return rerenderKeys.some(key => previous[key] !== current[key]);
  }

  /**
   * Estimate memory usage for visualizations
   */
  private estimateMemoryUsage(): number {
    let totalBytes = 0;

    Array.from(this.surfaceRepresentations.values()).forEach(surface => {
      totalBytes += surface.vertices.byteLength;
      totalBytes += surface.faces.byteLength;
      totalBytes += surface.normals.byteLength;
      totalBytes += surface.colors.byteLength;
    });

    // Add overhead for visualization objects
    totalBytes += this.segmentVisualizations.size * 1024; // Estimated overhead per segment

    return totalBytes;
  }
}

export default SegmentationVisualizer;
