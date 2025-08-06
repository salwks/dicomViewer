/**
 * Canvas 2D Renderer - WebGL 폴백용 기본 DICOM 렌더링
 * WebGL을 사용할 수 없는 환경에서 Canvas 2D API를 이용하여 DICOM 이미지를 렌더링
 */

import { log } from '../utils/logger';
import * as dicomParser from 'dicom-parser';

export interface Canvas2DRenderOptions {
  windowCenter?: number;
  windowWidth?: number;
  zoom?: number;
  pan?: { x: number; y: number };
  rotation?: number;
  invert?: boolean;
}

export class Canvas2DRenderer {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private pixelData: Uint8Array | Uint16Array | Int16Array | null = null;
  private imageMetadata: {
    width: number;
    height: number;
    bitsAllocated: number;
    bitsStored: number;
    pixelRepresentation: number;
    photometricInterpretation: string;
    windowCenter?: number;
    windowWidth?: number;
    minPixelValue: number;
    maxPixelValue: number;
  } | null = null;

  constructor(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
    this.canvas = canvas;
    this.context = context;

    log.info('Canvas2DRenderer initialized', {
      component: 'Canvas2DRenderer',
      metadata: {
        canvasSize: `${canvas.width}x${canvas.height}`,
      },
    });
  }

  /**
   * Load DICOM image from blob URL
   */
  public async loadDicomImage(blobUrl: string): Promise<void> {
    try {
      log.info('Loading DICOM image for Canvas 2D rendering', {
        component: 'Canvas2DRenderer',
        metadata: { blobUrl: `${blobUrl.substring(0, 50)}...` },
      });

      // Fetch the blob data
      const response = await fetch(blobUrl);
      const arrayBuffer = await response.arrayBuffer();
      const byteArray = new Uint8Array(arrayBuffer);

      // Parse DICOM
      const dataSet = dicomParser.parseDicom(byteArray);

      // Extract image metadata
      const width = dataSet.uint16('x00280011') || 512; // Columns
      const height = dataSet.uint16('x00280010') || 512; // Rows
      const bitsAllocated = dataSet.uint16('x00280100') || 16; // Bits Allocated
      const bitsStored = dataSet.uint16('x00280101') || bitsAllocated; // Bits Stored
      const pixelRepresentation = dataSet.uint16('x00280103') || 0; // Pixel Representation
      const photometricInterpretation = dataSet.string('x00280004') || 'MONOCHROME2';

      // Window/Level information
      const windowCenter = parseFloat(dataSet.string('x00281050') || '0');
      const windowWidth = parseFloat(dataSet.string('x00281051') || '0');

      // Get pixel data
      const pixelDataElement = dataSet.elements.x7fe00010;
      if (!pixelDataElement) {
        throw new Error('No pixel data found in DICOM file');
      }

      // Extract pixel data based on bits allocated
      let pixelData: Uint8Array | Uint16Array | Int16Array;
      if (bitsAllocated === 8) {
        pixelData = new Uint8Array(arrayBuffer, pixelDataElement.dataOffset, pixelDataElement.length);
      } else if (bitsAllocated === 16) {
        const pixelCount = Math.floor(pixelDataElement.length / 2);
        if (pixelRepresentation === 0) {
          pixelData = new Uint16Array(arrayBuffer, pixelDataElement.dataOffset, pixelCount);
        } else {
          pixelData = new Int16Array(arrayBuffer, pixelDataElement.dataOffset, pixelCount);
        }
      } else {
        throw new Error(`Unsupported bits allocated: ${bitsAllocated}`);
      }

      // Validate pixel data size
      const expectedPixels = width * height;
      if (pixelData.length < expectedPixels) {
        throw new Error(`Insufficient pixel data: expected ${expectedPixels}, got ${pixelData.length}`);
      }

      // Calculate min/max pixel values for window/level calculation
      let minPixelValue = Number.MAX_VALUE;
      let maxPixelValue = Number.MIN_VALUE;

      const maxIndex = Math.min(expectedPixels, pixelData.length);
      for (let i = 0; i < maxIndex; i++) {
        const value = pixelData.at(i);
        if (value !== undefined) {
          if (value < minPixelValue) minPixelValue = value;
          if (value > maxPixelValue) maxPixelValue = value;
        }
      }

      // Store image data
      this.pixelData = pixelData;
      this.imageMetadata = {
        width,
        height,
        bitsAllocated,
        bitsStored,
        pixelRepresentation,
        photometricInterpretation,
        windowCenter: windowCenter || (minPixelValue + maxPixelValue) / 2,
        windowWidth: windowWidth || (maxPixelValue - minPixelValue),
        minPixelValue,
        maxPixelValue,
      };

      log.info('DICOM image loaded successfully for Canvas 2D rendering', {
        component: 'Canvas2DRenderer',
        metadata: {
          dimensions: `${width}x${height}`,
          bitsAllocated,
          pixelDataSize: pixelData.length,
          windowCenter: this.imageMetadata.windowCenter,
          windowWidth: this.imageMetadata.windowWidth,
          pixelRange: `${minPixelValue}-${maxPixelValue}`,
          photometricInterpretation,
        },
      });

      // Initial render
      this.render();
    } catch (error) {
      log.error(
        'Failed to load DICOM image for Canvas 2D rendering',
        {
          component: 'Canvas2DRenderer',
          metadata: { blobUrl: `${blobUrl.substring(0, 50)}...` },
        },
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Render the DICOM image to canvas
   */
  public render(options: Canvas2DRenderOptions = {}): void {
    if (!this.pixelData || !this.imageMetadata) {
      log.warn('No image data to render', {
        component: 'Canvas2DRenderer',
      });
      return;
    }

    try {
      const {
        windowCenter = this.imageMetadata.windowCenter!,
        windowWidth = this.imageMetadata.windowWidth!,
        zoom = 1,
        pan = { x: 0, y: 0 },
        rotation = 0,
        invert = false,
      } = options;

      const { width, height, photometricInterpretation } = this.imageMetadata;

      // Clear canvas
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Calculate window/level bounds
      const windowMin = windowCenter - windowWidth / 2;
      const windowMax = windowCenter + windowWidth / 2;
      const windowRange = windowMax - windowMin;

      if (windowRange === 0) {
        log.warn('Invalid window range, using default values');
        return;
      }

      // Create image data for rendering
      const canvasImageData = this.context.createImageData(width, height);
      const canvasData = canvasImageData.data;

      // Convert DICOM pixel data to RGB
      const totalPixels = width * height;
      for (let i = 0; i < totalPixels; i++) {
        const pixelValue = this.pixelData!.at(i);
        if (pixelValue !== undefined) {
          let normalizedValue = ((pixelValue - windowMin) / windowRange) * 255;

          // Clamp to 0-255 range
          normalizedValue = Math.max(0, Math.min(255, normalizedValue));

          // Apply photometric interpretation
          if (photometricInterpretation === 'MONOCHROME1') {
            normalizedValue = 255 - normalizedValue;
          }

          // Apply invert if requested
          if (invert) {
            normalizedValue = 255 - normalizedValue;
          }

          const pixelIndex = i * 4;
          const grayValue = Math.floor(normalizedValue);

          if (pixelIndex + 3 < canvasData.length) {
            canvasData.set([grayValue, grayValue, grayValue, 255], pixelIndex);
          }
        }
      }

      // Apply transformations
      this.context.save();

      // Move to center for transformations
      const centerX = this.canvas.width / 2;
      const centerY = this.canvas.height / 2;
      this.context.translate(centerX + pan.x, centerY + pan.y);

      // Apply zoom and rotation
      this.context.scale(zoom, zoom);
      this.context.rotate((rotation * Math.PI) / 180);

      // Calculate image position (centered)
      const imageX = -width / 2;
      const imageY = -height / 2;

      // Create temporary canvas for the image
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempContext = tempCanvas.getContext('2d')!;
      tempContext.putImageData(canvasImageData, 0, 0);

      // Draw the image to main canvas
      this.context.drawImage(tempCanvas, imageX, imageY);

      this.context.restore();

      log.info('DICOM image rendered successfully with Canvas 2D', {
        component: 'Canvas2DRenderer',
        metadata: {
          imageSize: `${width}x${height}`,
          canvasSize: `${this.canvas.width}x${this.canvas.height}`,
          windowCenter,
          windowWidth,
          zoom,
          rotation,
          invert,
        },
      });
    } catch (error) {
      log.error(
        'Failed to render DICOM image with Canvas 2D',
        {
          component: 'Canvas2DRenderer',
        },
        error as Error,
      );
    }
  }

  /**
   * Update rendering options and re-render
   */
  public updateRenderOptions(options: Canvas2DRenderOptions): void {
    this.render(options);
  }

  /**
   * Get image metadata
   */
  public getImageMetadata() {
    return this.imageMetadata;
  }

  /**
   * Check if image is loaded
   */
  public isImageLoaded(): boolean {
    return this.pixelData !== null && this.imageMetadata !== null;
  }

  /**
   * Clear the canvas
   */
  public clear(): void {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.pixelData = null;
    this.imageMetadata = null;

    log.info('Canvas 2D renderer cleared', {
      component: 'Canvas2DRenderer',
    });
  }
}
