/**
 * DICOM File Loader Service
 * Handles loading DICOM files into Cornerstone3D
 */

/* eslint-disable security/detect-object-injection */

import * as cornerstoneCore from '@cornerstonejs/core';
import * as cornerstoneWADOImageLoader from '@cornerstonejs/dicom-image-loader';
import * as dicomParser from 'dicom-parser';
import { log } from '../utils/logger';

export interface DicomFileInfo {
  file: File;
  imageId: string;
  seriesInstanceUID: string;
  studyInstanceUID: string;
  sopInstanceUID: string;
  instanceNumber: number;
  metadata: any;
}

export class DicomFileLoaderService {
  private static instance: DicomFileLoaderService;
  private loadedFiles: Map<string, DicomFileInfo> = new Map();
  private imageIdToFile: Map<string, File> = new Map();

  private constructor() {
    // Register the dicomfile image loader with cornerstone
    this.registerDicomFileImageLoader();
  }

  public static getInstance(): DicomFileLoaderService {
    if (!DicomFileLoaderService.instance) {
      DicomFileLoaderService.instance = new DicomFileLoaderService();
    }
    return DicomFileLoaderService.instance;
  }

  /**
   * Register custom image loader for local DICOM files
   */
  private registerDicomFileImageLoader() {
    // Set up external dependencies
    cornerstoneWADOImageLoader.external.cornerstone = cornerstoneCore;
    cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

    // Register a custom scheme for local files
    (cornerstoneWADOImageLoader.wadouri as any).register(cornerstoneCore);

    // Register custom loader for dicomfile:// scheme
    cornerstoneCore.imageLoader.registerImageLoader(
      'dicomfile',
      this.loadImageFromFile.bind(this) as any,
    );
  }

  /**
   * Load image from local file
   */
  private async loadImageFromFile(imageId: string) {
    const file = this.imageIdToFile.get(imageId);
    if (!file) {
      throw new Error(`No file found for imageId: ${imageId}`);
    }

    try {
      // Convert file to array buffer
      const arrayBuffer = await file.arrayBuffer();

      // Create a blob URL for the file
      const blob = new Blob([arrayBuffer], { type: 'application/dicom' });
      const url = URL.createObjectURL(blob);

      // Use WADO URI loader to load the image
      const wadoImageId = `wadouri:${url}`;
      const image = await cornerstoneWADOImageLoader.wadouri.loadImage(wadoImageId);

      // Clean up the blob URL
      URL.revokeObjectURL(url);

      return image;
    } catch (error) {
      log.error('Failed to load DICOM image from file', {
        component: 'DicomFileLoaderService',
        metadata: { imageId, fileName: file.name },
      }, error as Error);
      throw error;
    }
  }

  /**
   * Load multiple DICOM files
   */
  public async loadDicomFiles(files: File[]): Promise<DicomFileInfo[]> {
    const loadedFileInfos: DicomFileInfo[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const fileInfo = await this.loadSingleDicomFile(file, i);
        loadedFileInfos.push(fileInfo);
      } catch (error) {
        log.error('Failed to load DICOM file', {
          component: 'DicomFileLoaderService',
          metadata: { fileName: file.name, index: i },
        }, error as Error);
      }
    }

    // Group by series
    const seriesMap = this.groupFilesBySeries(loadedFileInfos);

    log.info('DICOM files loaded successfully', {
      component: 'DicomFileLoaderService',
      metadata: {
        totalFiles: files.length,
        loadedFiles: loadedFileInfos.length,
        seriesCount: seriesMap.size,
      },
    });

    return loadedFileInfos;
  }

  /**
   * Load a single DICOM file
   */
  private async loadSingleDicomFile(file: File, index: number): Promise<DicomFileInfo> {
    // Create a unique image ID for this file
    const imageId = `dicomfile://${file.name}_${index}_${Date.now()}`;

    // Store file reference
    this.imageIdToFile.set(imageId, file);

    // Try to parse DICOM metadata
    const metadata = await this.parseDicomMetadata(file);

    const fileInfo: DicomFileInfo = {
      file,
      imageId,
      seriesInstanceUID: metadata.seriesInstanceUID || `series_${index}`,
      studyInstanceUID: metadata.studyInstanceUID || `study_${index}`,
      sopInstanceUID: metadata.sopInstanceUID || `sop_${index}`,
      instanceNumber: metadata.instanceNumber || index + 1,
      metadata,
    };

    this.loadedFiles.set(imageId, fileInfo);

    return fileInfo;
  }

  /**
   * Parse DICOM metadata from file
   */
  private async parseDicomMetadata(file: File): Promise<any> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const byteArray = new Uint8Array(arrayBuffer);

      // Basic DICOM file validation
      const isDicom = this.isDicomFile(byteArray);
      if (!isDicom) {
        log.warn('File does not appear to be a valid DICOM file', {
          component: 'DicomFileLoaderService',
          metadata: { fileName: file.name },
        });
      }

      // For now, return basic metadata
      // In a real implementation, we would parse DICOM tags
      return {
        fileName: file.name,
        fileSize: file.size,
        modality: 'CT', // Default, should be parsed from DICOM
        seriesInstanceUID: `series_${Date.now()}`,
        studyInstanceUID: `study_${Date.now()}`,
        sopInstanceUID: `sop_${Date.now()}`,
        instanceNumber: 1,
        patientName: 'Anonymous',
        studyDescription: 'Uploaded Study',
        seriesDescription: 'Uploaded Series',
      };
    } catch (error) {
      log.error('Failed to parse DICOM metadata', {
        component: 'DicomFileLoaderService',
        metadata: { fileName: file.name },
      }, error as Error);
      return {};
    }
  }

  /**
   * Check if file is a valid DICOM file
   */
  private isDicomFile(byteArray: Uint8Array): boolean {
    // Check for DICM prefix at byte 128
    if (byteArray.length < 132) return false;

    const dicm = String.fromCharCode(
      byteArray[128],
      byteArray[129],
      byteArray[130],
      byteArray[131],
    );

    return dicm === 'DICM';
  }

  /**
   * Group files by series
   */
  private groupFilesBySeries(files: DicomFileInfo[]): Map<string, DicomFileInfo[]> {
    const seriesMap = new Map<string, DicomFileInfo[]>();

    files.forEach(fileInfo => {
      const seriesId = fileInfo.seriesInstanceUID;
      if (!seriesMap.has(seriesId)) {
        seriesMap.set(seriesId, []);
      }
      seriesMap.get(seriesId)!.push(fileInfo);
    });

    // Sort files within each series by instance number
    seriesMap.forEach(seriesFiles => {
      seriesFiles.sort((a, b) => a.instanceNumber - b.instanceNumber);
    });

    return seriesMap;
  }

  /**
   * Get series list from loaded files
   */
  public getSeriesList() {
    const seriesMap = this.groupFilesBySeries(Array.from(this.loadedFiles.values()));
    const seriesList = [];

    for (const [seriesId, files] of seriesMap) {
      const firstFile = files[0];
      seriesList.push({
        seriesInstanceUID: seriesId,
        seriesDescription: firstFile.metadata.seriesDescription || 'Unnamed Series',
        modality: firstFile.metadata.modality || 'Unknown',
        numberOfImages: files.length,
        studyInstanceUID: firstFile.studyInstanceUID,
        studyDescription: firstFile.metadata.studyDescription || 'Unnamed Study',
        patientName: firstFile.metadata.patientName || 'Anonymous',
        imageIds: files.map(f => f.imageId),
      });
    }

    return seriesList;
  }

  /**
   * Get image IDs for a series
   */
  public getImageIdsForSeries(seriesInstanceUID: string): string[] {
    const imageIds: string[] = [];

    this.loadedFiles.forEach(fileInfo => {
      if (fileInfo.seriesInstanceUID === seriesInstanceUID) {
        imageIds.push(fileInfo.imageId);
      }
    });

    return imageIds;
  }

  /**
   * Clear all loaded files
   */
  public clearLoadedFiles() {
    this.loadedFiles.clear();
    this.imageIdToFile.clear();

    log.info('Cleared all loaded DICOM files', {
      component: 'DicomFileLoaderService',
    });
  }
}

// Export singleton instance
export const dicomFileLoader = DicomFileLoaderService.getInstance();
