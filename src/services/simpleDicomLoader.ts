/**
 * Simple DICOM File Loader
 * Simplified approach to load DICOM files using cornerstone
 */

/* eslint-disable security/detect-object-injection */

import * as dicomParser from 'dicom-parser';
import { log } from '../utils/logger';

export interface DicomMetadata {
  seriesInstanceUID: string;
  seriesNumber: number;
  seriesDescription: string;
  modality: string;
  studyInstanceUID: string;
  studyDescription: string;
  patientName: string;
  studyDate: string;
  imageNumber?: number;
  sopInstanceUID?: string;
  numberOfFrames?: number; // For multi-frame DICOM support
  frameIndex?: number; // For multi-frame DICOM frames
}

export interface SimpleDicomFile {
  file: File;
  imageId: string;
  metadata: DicomMetadata;
}

export class SimpleDicomLoader {
  private static instance: SimpleDicomLoader;
  private loadedFiles: SimpleDicomFile[] = [];

  private constructor() {
    // Empty constructor
  }

  public static getInstance(): SimpleDicomLoader {
    if (!SimpleDicomLoader.instance) {
      SimpleDicomLoader.instance = new SimpleDicomLoader();
    }
    return SimpleDicomLoader.instance;
  }

  /**
   * Check if file is likely a DICOM file
   */
  private isDicomFile(file: File): boolean {
    // Check file extension
    const fileName = file.name.toLowerCase();
    const dicomExtensions = ['.dcm', '.dicom', '.dic'];
    const hasValidExtension = dicomExtensions.some(ext => fileName.endsWith(ext));

    // Check MIME type
    const hasValidMimeType = file.type === 'application/dicom' || file.type === '';

    // Allow files without extension if they have no MIME type (common for DICOM)
    const noExtension = !fileName.includes('.');

    return hasValidExtension || hasValidMimeType || noExtension;
  }

  /**
   * Parse DICOM file to extract metadata (optimized)
   */
  private async parseDicomMetadata(file: File): Promise<DicomMetadata> {
    // For large files, only read the header portion first (faster)
    const HEADER_SIZE = Math.min(file.size, 65536); // Read up to 64KB for header
    const headerBuffer = await file.slice(0, HEADER_SIZE).arrayBuffer();
    const byteArray = new Uint8Array(headerBuffer);

    try {
      const dataSet = dicomParser.parseDicom(byteArray);

      // Extract DICOM tags with fallbacks
      const seriesInstanceUID = dataSet.string('x0020000e') || `generated-series-${Date.now()}-${Math.random()}`;
      const seriesNumber = parseInt(dataSet.string('x00200011') || '1');
      const seriesDescription = dataSet.string('x0008103e') || 'Unknown Series';
      const modality = dataSet.string('x00080060') || 'OT';
      const studyInstanceUID = dataSet.string('x0020000d') || `generated-study-${Date.now()}`;
      const studyDescription = dataSet.string('x00081030') || 'Unknown Study';
      const patientName = dataSet.string('x00100010') || 'Anonymous Patient';
      const studyDate = dataSet.string('x00080020') || new Date().toISOString().split('T')[0];
      const imageNumber = parseInt(dataSet.string('x00200013') || '1');
      const sopInstanceUID = dataSet.string('x00080018');

      // Check for multi-frame DICOM (NumberOfFrames tag)
      const numberOfFrames = parseInt(dataSet.string('x00280008') || '1');

      // Validate essential DICOM image pixel module tags
      const rows = dataSet.uint16('x00280010'); // Rows
      const columns = dataSet.uint16('x00280011'); // Columns
      const samplesPerPixel = dataSet.uint16('x00280002'); // Samples per Pixel
      const bitsAllocated = dataSet.uint16('x00280100'); // Bits Allocated
      const bitsStored = dataSet.uint16('x00280101'); // Bits Stored
      const pixelRepresentation = dataSet.uint16('x00280103'); // Pixel Representation

      // Check if essential pixel data tags are present
      if (!rows || !columns) {
        throw new Error(`Invalid DICOM file: Missing image dimensions (rows: ${rows}, columns: ${columns})`);
      }

      if (samplesPerPixel === undefined || samplesPerPixel < 1) {
        log.warn('Missing or invalid samples per pixel, assuming 1', {
          component: 'SimpleDicomLoader',
          metadata: { fileName: file.name, samplesPerPixel },
        });
      }

      if (!bitsAllocated) {
        throw new Error(`Invalid DICOM file: Missing bits allocated for ${file.name}`);
      }

      // Check if pixel data exists (lightweight check)
      const pixelDataElement = dataSet.elements.x7fe00010;
      if (!pixelDataElement && HEADER_SIZE >= file.size) {
        // Only throw error if we read the entire file and still no pixel data
        throw new Error(`Invalid DICOM file: No pixel data found in ${file.name}`);
      }

      log.info('DICOM pixel module validation passed', {
        component: 'SimpleDicomLoader',
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          headerSize: HEADER_SIZE,
          dimensions: `${columns}x${rows}`,
          samplesPerPixel: samplesPerPixel || 1,
          bitsAllocated,
          bitsStored,
          pixelRepresentation,
          pixelDataSize: pixelDataElement?.length || 'not-checked',
        },
      });

      return {
        seriesInstanceUID,
        seriesNumber,
        seriesDescription,
        modality,
        studyInstanceUID,
        studyDescription,
        patientName,
        studyDate,
        imageNumber,
        sopInstanceUID,
        numberOfFrames, // Add number of frames information
      };
    } catch (error) {
      log.warn(
        'Failed to parse DICOM metadata, using defaults',
        {
          component: 'SimpleDicomLoader',
          metadata: { fileName: file.name },
        },
        error as Error,
      );

      // Return default metadata if parsing fails
      return {
        seriesInstanceUID: `fallback-series-${Date.now()}-${Math.random()}`,
        seriesNumber: 1,
        seriesDescription: `File: ${file.name}`,
        modality: 'OT',
        studyInstanceUID: `fallback-study-${Date.now()}`,
        studyDescription: 'Uploaded Study',
        patientName: 'Anonymous Patient',
        studyDate: new Date().toISOString().split('T')[0],
      };
    }
  }

  /**
   * Load DICOM files and create blob URLs (optimized for performance)
   */
  public async loadFiles(files: File[]): Promise<SimpleDicomFile[]> {
    this.loadedFiles = [];
    const startTime = Date.now();

    log.info('Starting DICOM files loading', {
      component: 'SimpleDicomLoader',
      metadata: { fileCount: files.length },
    });

    // Filter valid DICOM files first
    const validFiles = files.filter(file => {
      if (!file) return false;
      if (!this.isDicomFile(file)) {
        log.warn('Skipping non-DICOM file', {
          component: 'SimpleDicomLoader',
          metadata: { fileName: file.name, fileType: file.type, fileSize: file.size },
        });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) {
      log.warn('No valid DICOM files found');
      return [];
    }

    // Process files in parallel with limited concurrency
    const BATCH_SIZE = 5; // Process 5 files at a time to avoid overwhelming
    const results: SimpleDicomFile[] = [];

    for (let i = 0; i < validFiles.length; i += BATCH_SIZE) {
      const batch = validFiles.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (file, batchIndex) => {
        const globalIndex = i + batchIndex;

        try {
          log.info(`Processing DICOM file ${globalIndex + 1}/${validFiles.length}`, {
            component: 'SimpleDicomLoader',
            metadata: { fileName: file.name },
          });

          // Parse DICOM metadata (this is the heaviest operation)
          const metadata = await this.parseDicomMetadata(file);

          // Create blob URL efficiently
          const blob = new Blob([file], { type: 'application/dicom' });
          const blobUrl = URL.createObjectURL(blob);

          // Handle multi-frame DICOM files
          const numberOfFrames = metadata.numberOfFrames || 1;
          const frameFiles: SimpleDicomFile[] = [];

          if (numberOfFrames > 1) {
            // Multi-frame DICOM: create multiple image IDs for each frame
            for (let frameIndex = 0; frameIndex < numberOfFrames; frameIndex++) {
              const frameImageId = `wadouri:${blobUrl}?frame=${frameIndex}`;

              const frameMetadata = {
                ...metadata,
                imageNumber: (metadata.imageNumber || 1) + frameIndex,
                frameIndex,
              };

              frameFiles.push({
                file,
                imageId: frameImageId,
                metadata: frameMetadata,
              });
            }

            log.info('Multi-frame DICOM processed', {
              component: 'SimpleDicomLoader',
              metadata: {
                fileName: file.name,
                frameCount: numberOfFrames,
                seriesUID: metadata.seriesInstanceUID,
              },
            });
          } else {
            // Single-frame DICOM: create one image ID
            const imageId = `wadouri:${blobUrl}`;

            frameFiles.push({
              file,
              imageId,
              metadata,
            });
          }

          return frameFiles;
        } catch (error) {
          log.error(
            `Failed to load DICOM file ${globalIndex + 1}/${validFiles.length}`,
            {
              component: 'SimpleDicomLoader',
              metadata: { fileName: file.name },
            },
            error as Error,
          );
          return [];
        }
      });

      // Wait for current batch to complete
      const batchResults = await Promise.all(batchPromises);

      // Flatten and add to results
      for (const fileResults of batchResults) {
        results.push(...fileResults);
      }

      // Log progress
      log.info(`Completed batch ${Math.ceil((i + BATCH_SIZE) / BATCH_SIZE)}/${Math.ceil(validFiles.length / BATCH_SIZE)}`, {
        component: 'SimpleDicomLoader',
        metadata: { processedFiles: Math.min(i + BATCH_SIZE, validFiles.length), totalFiles: validFiles.length },
      });
    }

    this.loadedFiles = results;
    const totalTime = Date.now() - startTime;

    log.info('DICOM files loading completed', {
      component: 'SimpleDicomLoader',
      metadata: {
        totalFiles: validFiles.length,
        loadedFrames: results.length,
        processingTime: `${totalTime}ms`,
        averageTimePerFile: `${Math.round(totalTime / validFiles.length)}ms`,
      },
    });

    return this.loadedFiles;
  }

  /**
   * Get image IDs for viewer
   */
  public getImageIds(): string[] {
    return this.loadedFiles.map(f => f.imageId);
  }

  /**
   * Get image IDs for a specific series
   */
  public getImageIdsForSeries(seriesInstanceUID: string): string[] {
    const seriesFiles = this.loadedFiles.filter(f => f.metadata.seriesInstanceUID === seriesInstanceUID);

    // Sort by image number if available
    const sortedFiles = seriesFiles.sort((a, b) => {
      const aNum = a.metadata.imageNumber || 0;
      const bNum = b.metadata.imageNumber || 0;
      return aNum - bNum;
    });

    return sortedFiles.map(f => f.imageId);
  }

  /**
   * Get loaded files
   */
  public getLoadedFiles(): SimpleDicomFile[] {
    return this.loadedFiles;
  }

  /**
   * Clear loaded files and blob URLs
   */
  public clearFiles(): void {
    // Revoke blob URLs to free memory
    this.loadedFiles.forEach(file => {
      if (file.imageId.startsWith('wadouri:blob:')) {
        const blobUrl = file.imageId.replace('wadouri:', '');
        URL.revokeObjectURL(blobUrl);
      }
    });

    this.loadedFiles = [];

    log.info('Cleared all DICOM files', {
      component: 'SimpleDicomLoader',
    });
  }

  /**
   * Get series data grouped by actual DICOM series
   */
  public async getSeriesData() {
    if (this.loadedFiles.length === 0) return [];

    // Group files by series instance UID
    const seriesMap = new Map<string, SimpleDicomFile[]>();

    for (const file of this.loadedFiles) {
      const seriesUID = file.metadata.seriesInstanceUID;
      if (!seriesMap.has(seriesUID)) {
        seriesMap.set(seriesUID, []);
      }
      seriesMap.get(seriesUID)!.push(file);
    }

    // Convert grouped series to series data
    const seriesDataPromises = Array.from(seriesMap.entries()).map(async ([seriesUID, files]) => {
      // Use metadata from the first file as representative
      const representativeFile = files[0];
      const metadata = representativeFile.metadata;

      // Sort files by image number if available
      const sortedFiles = files.sort((a, b) => {
        const aNum = a.metadata.imageNumber || 0;
        const bNum = b.metadata.imageNumber || 0;
        return aNum - bNum;
      });

      return {
        seriesInstanceUID: seriesUID,
        seriesNumber: metadata.seriesNumber,
        seriesDescription: metadata.seriesDescription,
        modality: metadata.modality,
        numberOfImages: files.length,
        studyInstanceUID: metadata.studyInstanceUID,
        studyDescription: metadata.studyDescription,
        patientName: metadata.patientName,
        studyDate: metadata.studyDate,
        imageIds: sortedFiles.map(f => f.imageId),
        thumbnail: this.getFallbackThumbnailForFile(sortedFiles[0]), // Use fast fallback initially
        // Note: this.generateThumbnailForSeries(sortedFiles[0]) available for future use
      };
    });

    const seriesData = await Promise.all(seriesDataPromises);

    // Sort series by series number
    seriesData.sort((a, b) => a.seriesNumber - b.seriesNumber);

    log.info('Generated series data from DICOM metadata', {
      component: 'SimpleDicomLoader',
      metadata: {
        totalFiles: this.loadedFiles.length,
        totalSeries: seriesData.length,
        seriesInfo: seriesData.map(s => ({
          uid: s.seriesInstanceUID,
          description: s.seriesDescription,
          modality: s.modality,
          imageCount: s.numberOfImages,
        })),
      },
    });

    return seriesData;
  }

  /**
   * Generate thumbnail for a specific series file
   * Direct DICOM pixel extraction for thumbnails
   * Currently unused - thumbnails use fallback for performance
   */
  public async generateThumbnailForSeries(file: SimpleDicomFile): Promise<string> {
    try {
      log.info('Generating DICOM thumbnail using direct pixel extraction', {
        component: 'SimpleDicomLoader',
        metadata: {
          seriesUID: file.metadata.seriesInstanceUID,
          fileName: file.file.name,
        },
      });

      // Read the file as ArrayBuffer
      const arrayBuffer = await file.file.arrayBuffer();
      const byteArray = new Uint8Array(arrayBuffer);

      // Parse DICOM to get pixel data
      const dataSet = dicomParser.parseDicom(byteArray);

      // Get image dimensions
      const width = dataSet.uint16('x00280011') || 512; // Columns
      const height = dataSet.uint16('x00280010') || 512; // Rows
      const bitsAllocated = dataSet.uint16('x00280100') || 16; // Bits Allocated
      const pixelRepresentation = dataSet.uint16('x00280103') || 0; // 0 = unsigned, 1 = signed
      const photometricInterpretation = dataSet.string('x00280004') || 'MONOCHROME2';
      const numberOfFrames = parseInt(dataSet.string('x00280008') || '1'); // Number of frames

      // Get pixel data element
      const pixelDataElement = dataSet.elements.x7fe00010;
      if (!pixelDataElement) {
        log.warn('No pixel data found in DICOM file, using fallback', {
          component: 'SimpleDicomLoader',
          metadata: { fileName: file.file.name },
        });
        return this.getFallbackThumbnailForFile(file);
      }

      // Calculate bytes per pixel and frame size
      const bytesPerPixel = Math.ceil(bitsAllocated / 8);
      const pixelsPerFrame = width * height;
      const bytesPerFrame = pixelsPerFrame * bytesPerPixel;

      // Extract pixel data (first frame only for multi-frame DICOM)
      let pixelData: Uint8Array | Uint16Array | Int16Array;
      let dataLength: number;

      if (numberOfFrames > 1) {
        // Multi-frame: read only first frame
        dataLength = bytesPerFrame;
        log.info('Multi-frame DICOM detected, extracting first frame for thumbnail', {
          component: 'SimpleDicomLoader',
          metadata: {
            numberOfFrames,
            frameSize: `${width}x${height}`,
            bytesPerFrame,
          },
        });
      } else {
        // Single frame: read all pixel data
        dataLength = pixelDataElement.length;
      }

      if (bitsAllocated === 8) {
        pixelData = new Uint8Array(arrayBuffer, pixelDataElement.dataOffset, dataLength);
      } else if (bitsAllocated === 16) {
        const pixelCount = Math.floor(dataLength / 2);
        if (pixelRepresentation === 0) {
          pixelData = new Uint16Array(arrayBuffer, pixelDataElement.dataOffset, pixelCount);
        } else {
          pixelData = new Int16Array(arrayBuffer, pixelDataElement.dataOffset, pixelCount);
        }
      } else {
        log.warn('Unsupported bits allocated', {
          component: 'SimpleDicomLoader',
          metadata: { bitsAllocated },
        });
        return this.getFallbackThumbnailForFile(file);
      }

      // Create thumbnail canvas
      const thumbnailSize = 120;
      const canvas = document.createElement('canvas');
      canvas.width = thumbnailSize;
      canvas.height = thumbnailSize;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return this.getFallbackThumbnailForFile(file);
      }

      // Validate pixel data length
      const expectedPixels = width * height;
      if (pixelData.length < expectedPixels) {
        log.warn('Insufficient pixel data for thumbnail generation', {
          component: 'SimpleDicomLoader',
          metadata: {
            expected: expectedPixels,
            actual: pixelData.length,
            frameSize: `${width}x${height}`,
          },
        });
        return this.getFallbackThumbnailForFile(file);
      }

      // Calculate scaling
      const scaleX = width / thumbnailSize;
      const scaleY = height / thumbnailSize;

      // Find min/max for window/level (only sample first frame pixels)
      let min = Number.MAX_VALUE;
      let max = Number.MIN_VALUE;
      const pixelsToSample = Math.min(expectedPixels, pixelData.length);
      const sampleRate = Math.max(1, Math.floor(pixelsToSample / 10000)); // Sample pixels for performance

      for (let i = 0; i < pixelsToSample; i += sampleRate) {
        const value = pixelData[i];
        if (value !== undefined) {
          if (value < min) min = value;
          if (value > max) max = value;
        }
      }

      const range = max - min;
      if (range === 0) {
        return this.getFallbackThumbnailForFile(file);
      }

      // Create thumbnail image data
      const imageData = ctx.createImageData(thumbnailSize, thumbnailSize);

      // Downsample and render (first frame only)
      for (let y = 0; y < thumbnailSize; y++) {
        for (let x = 0; x < thumbnailSize; x++) {
          const sourceX = Math.floor(x * scaleX);
          const sourceY = Math.floor(y * scaleY);
          const sourceIndex = sourceY * width + sourceX;

          // Ensure we only access pixels from the first frame
          if (sourceIndex < expectedPixels && sourceIndex >= 0 && sourceIndex < pixelData.length) {
            const pixelValue = pixelData[sourceIndex];
            if (pixelValue === undefined) continue;
            let normalizedValue = ((pixelValue - min) / range) * 255;

            // Invert if MONOCHROME1
            if (photometricInterpretation === 'MONOCHROME1') {
              normalizedValue = 255 - normalizedValue;
            }

            const clampedValue = Math.max(0, Math.min(255, Math.floor(normalizedValue)));

            const destIndex = (y * thumbnailSize + x) * 4;
            if (destIndex >= 0 && destIndex + 3 < imageData.data.length) {
              imageData.data[destIndex] = clampedValue; // R
              imageData.data[destIndex + 1] = clampedValue; // G
              imageData.data[destIndex + 2] = clampedValue; // B
              imageData.data[destIndex + 3] = 255; // A
            }
          }
        }
      }

      // Draw to canvas
      ctx.putImageData(imageData, 0, 0);

      log.info('Generated DICOM thumbnail successfully', {
        component: 'SimpleDicomLoader',
        metadata: {
          seriesUID: file.metadata.seriesInstanceUID,
          imageSize: `${width}x${height}`,
          bitsAllocated,
          pixelRange: `${min}-${max}`,
          numberOfFrames,
          isMultiFrame: numberOfFrames > 1,
        },
      });

      return canvas.toDataURL('image/png');
    } catch (error) {
      log.error(
        'Failed to generate DICOM thumbnail',
        {
          component: 'SimpleDicomLoader',
          metadata: { seriesUID: file.metadata.seriesInstanceUID },
        },
        error as Error,
      );
      return this.getFallbackThumbnailForFile(file);
    }
  }

  /**
   * Fallback thumbnail for specific file when canvas fails
   */
  private getFallbackThumbnailForFile(file: SimpleDicomFile): string {
    const { modality, seriesDescription } = file.metadata;

    // Modality-specific colors
    const modalityColors: Record<string, string> = {
      CT: '#4a90e2',
      MR: '#7ed321',
      US: '#f5a623',
      XA: '#bd10e0',
      RF: '#b8e986',
      CR: '#50e3c2',
      DX: '#9013fe',
      MG: '#e91e63',
      PT: '#ff9800',
      NM: '#795548',
      OT: '#607d8b',
    };

    const color = modalityColors[modality] || '#607d8b';

    return `data:image/svg+xml,${encodeURIComponent(`
      <svg width="120" height="120" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="120" fill="${color}20"/>
        <rect x="10" y="10" width="100" height="100" fill="none" stroke="${color}" stroke-width="2"/>
        <text x="60" y="45" text-anchor="middle" font-family="Arial" font-size="16" font-weight="bold" fill="${color}">${modality}</text>
        <text x="60" y="65" text-anchor="middle" font-family="Arial" font-size="10" fill="${color}80">
          ${seriesDescription.substring(0, 12)}${seriesDescription.length > 12 ? '...' : ''}
        </text>
        <text x="60" y="85" text-anchor="middle" font-family="Arial" font-size="10" fill="${color}">DICOM</text>
      </svg>
    `)}`;
  }
}

// Export singleton
export const simpleDicomLoader = SimpleDicomLoader.getInstance();
