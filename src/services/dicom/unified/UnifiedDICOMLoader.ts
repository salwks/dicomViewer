/**
 * Unified DICOM Loader Service
 *
 * Combines functionality from SimpleDicomLoader and DicomFileLoaderService
 * Provides a single point for all DICOM loading operations
 */

/* eslint-disable security/detect-object-injection */

import * as cornerstoneCore from '@cornerstonejs/core';
import * as cornerstoneWADOImageLoader from '@cornerstonejs/dicom-image-loader';
import * as dicomParser from 'dicom-parser';
import { log } from '../../../utils/logger';

export interface UnifiedDicomMetadata {
  // Core DICOM identifiers
  seriesInstanceUID: string;
  studyInstanceUID: string;
  sopInstanceUID: string;

  // Series information
  seriesNumber: number;
  seriesDescription: string;
  modality: string;

  // Study information
  studyDescription: string;
  studyDate: string;

  // Patient information
  patientName: string;
  patientID?: string;

  // Instance information
  imageNumber?: number;
  instanceNumber?: number;

  // Technical metadata
  rows?: number;
  columns?: number;
  pixelSpacing?: [number, number];
  sliceThickness?: number;

  // Additional metadata
  windowCenter?: number;
  windowWidth?: number;
  rescaleSlope?: number;
  rescaleIntercept?: number;
}

export interface UnifiedDicomFile {
  file: File;
  imageId: string;
  metadata: UnifiedDicomMetadata;
  thumbnailUrl?: string;
  isLoaded: boolean;
}

export interface DicomSeries {
  seriesInstanceUID: string;
  metadata: UnifiedDicomMetadata;
  files: UnifiedDicomFile[];
  thumbnailUrl?: string;
}

export interface LoadingProgress {
  loaded: number;
  total: number;
  percentage: number;
  currentFile?: string;
}

export class UnifiedDICOMLoader {
  private static instance: UnifiedDICOMLoader;
  private loadedFiles: Map<string, UnifiedDicomFile> = new Map();
  private imageIdToFile: Map<string, File> = new Map();
  private seriesMap: Map<string, DicomSeries> = new Map();
  private isInitialized = false;

  private constructor() {
    // Empty constructor - initialization happens in initialize()
  }

  public static getInstance(): UnifiedDICOMLoader {
    if (!UnifiedDICOMLoader.instance) {
      UnifiedDICOMLoader.instance = new UnifiedDICOMLoader();
    }
    return UnifiedDICOMLoader.instance;
  }

  /**
   * Initialize the DICOM loader
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Set up external dependencies
      cornerstoneWADOImageLoader.external.cornerstone = cornerstoneCore;
      cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

      // Register WADO image loader
      if (cornerstoneWADOImageLoader.wadouri) {
        (cornerstoneWADOImageLoader.wadouri as any).register(cornerstoneCore);
      }

      // Register custom loader for local files
      this.registerLocalFileLoader();

      this.isInitialized = true;
      log('UnifiedDICOMLoader initialized successfully');
    } catch (error) {
      log('Failed to initialize UnifiedDICOMLoader', 'error', error);
      throw error;
    }
  }

  /**
   * Register custom image loader for local DICOM files
   */
  private registerLocalFileLoader(): void {
    cornerstoneCore.imageLoader.registerImageLoader(
      'dicomfile',
      this.loadLocalDicomFile.bind(this),
    );

    cornerstoneCore.imageLoader.registerImageLoader(
      'dicomblob',
      this.loadDicomBlob.bind(this),
    );
  }

  /**
   * Load local DICOM file
   */
  private async loadLocalDicomFile(imageId: string): Promise<any> {
    const file = this.imageIdToFile.get(imageId);
    if (!file) {
      throw new Error(`File not found for imageId: ${imageId}`);
    }

    return this.loadDicomFromFile(file);
  }

  /**
   * Load DICOM from blob URL
   */
  private async loadDicomBlob(imageId: string): Promise<any> {
    const blobUrl = imageId.replace('dicomblob:', '');
    const response = await fetch(blobUrl);
    const arrayBuffer = await response.arrayBuffer();

    return this.loadDicomFromArrayBuffer(arrayBuffer);
  }

  /**
   * Load DICOM from File object
   */
  private async loadDicomFromFile(file: File): Promise<any> {
    const arrayBuffer = await file.arrayBuffer();
    return this.loadDicomFromArrayBuffer(arrayBuffer);
  }

  /**
   * Load DICOM from ArrayBuffer
   */
  private async loadDicomFromArrayBuffer(arrayBuffer: ArrayBuffer): Promise<any> {
    try {
      const byteArray = new Uint8Array(arrayBuffer);
      const dataSet = dicomParser.parseDicom(byteArray);

      // Extract pixel data and create Cornerstone image
      const image = await this.createCornerstoneImage(dataSet, byteArray);

      return image;
    } catch (error) {
      log('Failed to load DICOM from array buffer', 'error', error);
      throw error;
    }
  }

  /**
   * Create Cornerstone image from DICOM dataset
   */
  private async createCornerstoneImage(dataSet: any, pixelData: Uint8Array): Promise<any> {
    // Extract basic image properties
    const rows = dataSet.string('x00280010');
    const columns = dataSet.string('x00280011');
    const samplesPerPixel = dataSet.string('x00280002') || '1';

    if (!rows || !columns) {
      throw new Error('Invalid DICOM: missing rows or columns');
    }

    // Create basic image object
    const image = {
      imageId: `dicom-${Date.now()}-${Math.random()}`,
      width: parseInt(columns),
      height: parseInt(rows),
      color: samplesPerPixel > 1,
      columnPixelSpacing: 1,
      rowPixelSpacing: 1,
      invert: false,
      sizeInBytes: pixelData.length,
      getPixelData: () => pixelData,
      rows: parseInt(rows),
      columns: parseInt(columns),
      intercept: parseFloat(safeDicomTagAccess(dataSet, 'x00281052') || '0'),
      slope: parseFloat(safeDicomTagAccess(dataSet, 'x00281053') || '1'),
      windowCenter: parseFloat(safeDicomTagAccess(dataSet, 'x00281050') || '128'),
      windowWidth: parseFloat(safeDicomTagAccess(dataSet, 'x00281051') || '256'),
      render: cornerstoneCore.getRenderingEngine(),
      data: dataSet,
    };

    return image;
  }

  /**
   * Parse DICOM file metadata
   */
  private async parseDicomMetadata(file: File): Promise<UnifiedDicomMetadata> {
    const arrayBuffer = await file.arrayBuffer();
    const byteArray = new Uint8Array(arrayBuffer);

    try {
      const dataSet = dicomParser.parseDicom(byteArray);

      return {
        seriesInstanceUID: safeDicomTagAccess(dataSet, 'x0020000e') || `generated-series-${Date.now()}-${Math.random()}`,
        studyInstanceUID: safeDicomTagAccess(dataSet, 'x0020000d') || `generated-study-${Date.now()}`,
        sopInstanceUID: safeDicomTagAccess(dataSet, 'x00080018') || `generated-sop-${Date.now()}-${Math.random()}`,

        seriesNumber: parseInt(safeDicomTagAccess(dataSet, 'x00200011') || '1'),
        seriesDescription: safeDicomTagAccess(dataSet, 'x0008103e') || 'Unknown Series',
        modality: safeDicomTagAccess(dataSet, 'x00080060') || 'OT',

        studyDescription: safeDicomTagAccess(dataSet, 'x00081030') || 'Unknown Study',
        studyDate: safeDicomTagAccess(dataSet, 'x00080020') || new Date().toISOString().slice(0, 8),

        patientName: safeDicomTagAccess(dataSet, 'x00100010') || 'Anonymous',
        patientID: safeDicomTagAccess(dataSet, 'x00100020'),

        imageNumber: parseInt(safeDicomTagAccess(dataSet, 'x00200013') || '1'),
        instanceNumber: parseInt(safeDicomTagAccess(dataSet, 'x00200013') || '1'),

        rows: parseInt(safeDicomTagAccess(dataSet, 'x00280010') || '512'),
        columns: parseInt(safeDicomTagAccess(dataSet, 'x00280011') || '512'),
        pixelSpacing: this.parsePixelSpacing(dataSet),
        sliceThickness: parseFloat(safeDicomTagAccess(dataSet, 'x00180050') || '1'),

        windowCenter: parseFloat(safeDicomTagAccess(dataSet, 'x00281050') || '128'),
        windowWidth: parseFloat(safeDicomTagAccess(dataSet, 'x00281051') || '256'),
        rescaleSlope: parseFloat(safeDicomTagAccess(dataSet, 'x00281053') || '1'),
        rescaleIntercept: parseFloat(safeDicomTagAccess(dataSet, 'x00281052') || '0'),
      };
    } catch (error) {
      log('Error parsing DICOM metadata', 'error', error);

      // Return minimal metadata for non-DICOM files
      return {
        seriesInstanceUID: `file-series-${Date.now()}`,
        studyInstanceUID: `file-study-${Date.now()}`,
        sopInstanceUID: `file-sop-${Date.now()}`,
        seriesNumber: 1,
        seriesDescription: file.name,
        modality: 'OT',
        studyDescription: 'File Upload',
        studyDate: new Date().toISOString().slice(0, 8),
        patientName: 'Anonymous',
        imageNumber: 1,
        instanceNumber: 1,
      };
    }
  }

  /**
   * Parse pixel spacing from DICOM dataset
   */
  private parsePixelSpacing(dataSet: any): [number, number] | undefined {
    const pixelSpacingStr = safeDicomTagAccess(dataSet, 'x00280030');
    if (pixelSpacingStr) {
      const values = pixelSpacingStr.split('\\');
      if (values.length >= 2) {
        return [parseFloat(values[0]), parseFloat(values[1])];
      }
    }
    return undefined;
  }

  /**
   * Load multiple DICOM files
   */
  public async loadFiles(
    files: File[],
    onProgress?: (progress: LoadingProgress) => void,
  ): Promise<DicomSeries[]> {
    await this.initialize();

    const totalFiles = files.length;
    const loadedFiles: UnifiedDicomFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        // Update progress
        onProgress?.({
          loaded: i,
          total: totalFiles,
          percentage: (i / totalFiles) * 100,
          currentFile: file.name,
        });

        // Parse metadata
        const metadata = await this.parseDicomMetadata(file);

        // Create image ID
        const imageId = `dicomfile:${Date.now()}-${i}`;

        // Store file mapping
        this.imageIdToFile.set(imageId, file);

        // Create unified file object
        const unifiedFile: UnifiedDicomFile = {
          file,
          imageId,
          metadata,
          isLoaded: false,
        };

        // Generate thumbnail if possible
        try {
          unifiedFile.thumbnailUrl = await this.generateThumbnail(file, metadata);
        } catch (error) {
          log('Failed to generate thumbnail', 'warn', error);
        }

        loadedFiles.push(unifiedFile);
        this.loadedFiles.set(imageId, unifiedFile);

      } catch (error) {
        log(`Failed to load file ${file.name}`, 'error', error);
      }
    }

    // Final progress update
    onProgress?.({
      loaded: totalFiles,
      total: totalFiles,
      percentage: 100,
    });

    // Group files by series
    const series = this.groupFilesBySeries(loadedFiles);

    // Update series map
    series.forEach(s => this.seriesMap.set(s.seriesInstanceUID, s));

    return series;
  }

  /**
   * Group files by series
   */
  private groupFilesBySeries(files: UnifiedDicomFile[]): DicomSeries[] {
    const seriesMap = new Map<string, UnifiedDicomFile[]>();

    // Group files by series UID
    files.forEach(file => {
      const seriesUID = file.metadata.seriesInstanceUID;
      if (!seriesMap.has(seriesUID)) {
        seriesMap.set(seriesUID, []);
      }
      seriesMap.get(seriesUID)!.push(file);
    });

    // Create series objects
    const series: DicomSeries[] = [];
    seriesMap.forEach((seriesFiles, seriesUID) => {
      // Sort files by instance number
      seriesFiles.sort((a, b) =>
        (a.metadata.instanceNumber || 0) - (b.metadata.instanceNumber || 0),
      );

      const firstFile = seriesFiles[0];
      const dicomSeries: DicomSeries = {
        seriesInstanceUID: seriesUID,
        metadata: firstFile.metadata,
        files: seriesFiles,
        thumbnailUrl: firstFile.thumbnailUrl,
      };

      series.push(dicomSeries);
    });

    return series;
  }

  /**
   * Generate thumbnail for DICOM file
   */
  private async generateThumbnail(file: File, metadata: UnifiedDicomMetadata): Promise<string> {
    try {
      // Create a temporary image ID for thumbnail generation
      const tempImageId = `thumbnail-${Date.now()}`;
      this.imageIdToFile.set(tempImageId, file);

      // Load the image
      const image = await this.loadLocalDicomFile(tempImageId);

      // Create canvas for thumbnail
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Set thumbnail size
      const thumbnailSize = 150;
      canvas.width = thumbnailSize;
      canvas.height = thumbnailSize;

      // Calculate aspect ratio
      const aspectRatio = image.width / image.height;
      let drawWidth = thumbnailSize;
      let drawHeight = thumbnailSize;

      if (aspectRatio > 1) {
        drawHeight = thumbnailSize / aspectRatio;
      } else {
        drawWidth = thumbnailSize * aspectRatio;
      }

      // Center the image
      const offsetX = (thumbnailSize - drawWidth) / 2;
      const offsetY = (thumbnailSize - drawHeight) / 2;

      // Draw placeholder for now (actual pixel data rendering would be more complex)
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, thumbnailSize, thumbnailSize);

      ctx.fillStyle = '#4a5568';
      ctx.fillRect(offsetX, offsetY, drawWidth, drawHeight);

      // Add modality label
      ctx.fillStyle = '#fff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(metadata.modality, thumbnailSize / 2, thumbnailSize - 10);

      // Clean up
      this.imageIdToFile.delete(tempImageId);

      return canvas.toDataURL();
    } catch (error) {
      log('Failed to generate thumbnail', 'warn', error);
      return this.generatePlaceholderThumbnail(metadata.modality);
    }
  }

  /**
   * Generate placeholder thumbnail
   */
  private generatePlaceholderThumbnail(modality: string): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return '';
    }

    canvas.width = 150;
    canvas.height = 150;

    // Draw placeholder
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(0, 0, 150, 150);

    ctx.fillStyle = '#4a5568';
    ctx.fillRect(10, 10, 130, 130);

    // Add modality text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(modality, 75, 80);

    return canvas.toDataURL();
  }

  /**
   * Get all loaded series
   */
  public getAllSeries(): DicomSeries[] {
    return Array.from(this.seriesMap.values());
  }

  /**
   * Get series by UID
   */
  public getSeriesByUID(seriesInstanceUID: string): DicomSeries | undefined {
    return this.seriesMap.get(seriesInstanceUID);
  }

  /**
   * Get file by image ID
   */
  public getFileByImageId(imageId: string): UnifiedDicomFile | undefined {
    return this.loadedFiles.get(imageId);
  }

  /**
   * Clear all loaded files
   */
  public clearAll(): void {
    this.loadedFiles.clear();
    this.imageIdToFile.clear();
    this.seriesMap.clear();
  }

  /**
   * Get loading statistics
   */
  public getStatistics(): {
    totalFiles: number;
    totalSeries: number;
    memoryUsage: number;
    } {
    const totalFiles = this.loadedFiles.size;
    const totalSeries = this.seriesMap.size;

    // Estimate memory usage
    let memoryUsage = 0;
    this.loadedFiles.forEach(file => {
      memoryUsage += file.file.size;
    });

    return {
      totalFiles,
      totalSeries,
      memoryUsage,
    };
  }
}

// Create singleton instance
export const unifiedDicomLoader = UnifiedDICOMLoader.getInstance();
