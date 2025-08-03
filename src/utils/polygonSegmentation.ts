/**
 * Canvas-based polygon segmentation implementation
 * Provides basic polygon detection and contour tracing for medical images
 */

/* eslint-disable security/detect-object-injection */

import { log } from './logger';

export interface SegmentationPoint {
  x: number;
  y: number;
}

export interface SegmentationOptions {
  threshold?: number;
  minArea?: number;
  smoothing?: boolean;
  tolerance?: number;
}

export interface SegmentationResult {
  contours: SegmentationPoint[][];
  areas: number[];
  boundingBoxes: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

export default class ICRPolySeg {
  private initialized = false;

  constructor() {
    log.info('Canvas-based polygon segmentation initialized', {
      component: 'ICRPolySeg',
    });
  }

  static getInstance() {
    return new ICRPolySeg();
  }

  async init(): Promise<void> {
    this.initialized = true;
    return Promise.resolve();
  }

  /**
   * Process image data for polygon segmentation using canvas-based algorithms
   */
  async process(
    imageData: ImageData | Uint8Array | Uint16Array,
    width: number,
    height: number,
    options: SegmentationOptions = {},
  ): Promise<SegmentationResult | null> {
    if (!this.initialized) {
      log.warn('ICRPolySeg not initialized, call init() first', {
        component: 'ICRPolySeg',
      });
      return null;
    }

    const { threshold = 128, minArea = 100, smoothing = true, tolerance = 2 } = options;

    try {
      // Convert input to standardized format
      const pixels = this.normalizeImageData(imageData, width, height);

      // Apply threshold to create binary image
      const binaryImage = this.applyThreshold(pixels, width, height, threshold);

      // Find contours using edge detection
      const rawContours = this.findContours(binaryImage, width, height);

      // Filter contours by minimum area
      const filteredContours = rawContours.filter(contour => this.calculatePolygonArea(contour) >= minArea);

      // Smooth contours if requested
      const finalContours = smoothing
        ? filteredContours.map(contour => this.smoothContour(contour, tolerance))
        : filteredContours;

      // Calculate additional metadata
      const areas = finalContours.map(contour => this.calculatePolygonArea(contour));
      const boundingBoxes = finalContours.map(contour => this.calculateBoundingBox(contour));

      log.info(`Found ${finalContours.length} polygon segments`, {
        component: 'ICRPolySeg',
        metadata: { segmentCount: finalContours.length },
      });

      return {
        contours: finalContours,
        areas,
        boundingBoxes,
      };
    } catch (error) {
      log.error(
        'Polygon segmentation failed',
        {
          component: 'ICRPolySeg',
        },
        error as Error,
      );
      return null;
    }
  }

  /**
   * Normalize different image data formats to Uint8Array
   */
  private normalizeImageData(
    imageData: ImageData | Uint8Array | Uint16Array,
    width: number,
    height: number,
  ): Uint8Array {
    if (imageData instanceof ImageData) {
      // Convert RGBA to grayscale
      const grayscale = new Uint8Array(width * height);
      for (let i = 0; i < grayscale.length; i++) {
        const rgbaIndex = i * 4;
        grayscale[i] = Math.round(
          imageData.data[rgbaIndex] * 0.299 +
            imageData.data[rgbaIndex + 1] * 0.587 +
            imageData.data[rgbaIndex + 2] * 0.114,
        );
      }
      return grayscale;
    }

    if (imageData instanceof Uint16Array) {
      // Convert 16-bit to 8-bit
      const normalized = new Uint8Array(imageData.length);
      const max = Math.max(...imageData);
      const scale = max > 0 ? 255 / max : 0;
      for (let i = 0; i < imageData.length; i++) {
        normalized[i] = Math.round(imageData[i] * scale);
      }
      return normalized;
    }

    return imageData instanceof Uint8Array ? imageData : new Uint8Array(imageData);
  }

  /**
   * Apply threshold to create binary image
   */
  private applyThreshold(pixels: Uint8Array, _width: number, _height: number, threshold: number): Uint8Array {
    const binary = new Uint8Array(pixels.length);
    for (let i = 0; i < pixels.length; i++) {
      binary[i] = pixels[i] > threshold ? 255 : 0;
    }
    return binary;
  }

  /**
   * Find contours using Moore's boundary tracing algorithm
   */
  private findContours(binaryImage: Uint8Array, width: number, height: number): SegmentationPoint[][] {
    const contours: SegmentationPoint[][] = [];
    const visited = new Set<number>();

    // Directions for 8-connectivity (Moore neighborhood)
    const directions = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
      [1, 0],
      [1, -1],
      [0, -1],
    ];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;

        if (binaryImage[index] === 255 && !visited.has(index)) {
          const contour = this.traceContour(binaryImage, width, height, x, y, directions, visited);

          if (contour.length > 3) {
            // Minimum viable polygon
            contours.push(contour);
          }
        }
      }
    }

    return contours;
  }

  /**
   * Trace contour starting from given point using Moore's algorithm
   */
  private traceContour(
    binaryImage: Uint8Array,
    width: number,
    height: number,
    startX: number,
    startY: number,
    directions: number[][],
    visited: Set<number>,
  ): SegmentationPoint[] {
    const contour: SegmentationPoint[] = [];
    let x = startX,
      y = startY;
    let direction = 0; // Start looking up

    do {
      const index = y * width + x;
      visited.add(index);
      contour.push({ x, y });

      // Find next boundary point
      let found = false;
      for (let i = 0; i < 8; i++) {
        const dir = (direction + i) % 8;
        const [dx, dy] = directions[dir];
        const nx = x + dx;
        const ny = y + dy;

        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIndex = ny * width + nx;
          if (binaryImage[nIndex] === 255) {
            x = nx;
            y = ny;
            direction = (dir + 6) % 8; // Turn left for next iteration
            found = true;
            break;
          }
        }
      }

      if (!found) break;
    } while (!(x === startX && y === startY) && contour.length < width * height);

    return contour;
  }

  /**
   * Smooth contour using Douglas-Peucker algorithm
   */
  private smoothContour(contour: SegmentationPoint[], tolerance: number): SegmentationPoint[] {
    if (contour.length <= 2) return contour;

    return this.douglasPeucker(contour, tolerance);
  }

  /**
   * Douglas-Peucker line simplification algorithm
   */
  private douglasPeucker(points: SegmentationPoint[], tolerance: number): SegmentationPoint[] {
    if (points.length <= 2) return points;

    // Find the point with maximum distance from line between start and end
    let maxDistance = 0;
    let maxIndex = 0;
    const start = points[0];
    const end = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const distance = this.pointToLineDistance(points[i], start, end);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }

    // If max distance is greater than tolerance, recursively simplify
    if (maxDistance > tolerance) {
      const left = this.douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
      const right = this.douglasPeucker(points.slice(maxIndex), tolerance);

      return [...left.slice(0, -1), ...right];
    }

    return [start, end];
  }

  /**
   * Calculate distance from point to line
   */
  private pointToLineDistance(
    point: SegmentationPoint,
    lineStart: SegmentationPoint,
    lineEnd: SegmentationPoint,
  ): number {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) {
      return Math.sqrt(A * A + B * B);
    }

    const param = dot / lenSq;

    let xx: number, yy: number;

    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;

    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate polygon area using shoelace formula
   */
  private calculatePolygonArea(contour: SegmentationPoint[]): number {
    if (contour.length < 3) return 0;

    let area = 0;
    for (let i = 0; i < contour.length; i++) {
      const j = (i + 1) % contour.length;
      area += contour[i].x * contour[j].y;
      area -= contour[j].x * contour[i].y;
    }

    return Math.abs(area) / 2;
  }

  /**
   * Calculate bounding box for contour
   */
  private calculateBoundingBox(contour: SegmentationPoint[]): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    if (contour.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = contour[0].x;
    let maxX = contour[0].x;
    let minY = contour[0].y;
    let maxY = contour[0].y;

    for (const point of contour) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }
}

// Export for CommonJS compatibility
module.exports = ICRPolySeg;
