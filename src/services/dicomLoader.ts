/**
 * DICOM Loader Service
 * Service for loading and managing DICOM data
 */

import { init as dicomImageLoaderInit } from '@cornerstonejs/dicom-image-loader';
import { imageLoader, type Types } from '@cornerstonejs/core';
import { log } from '../utils/logger';

export class DicomLoaderService {
  private static instance: DicomLoaderService | null = null;
  private isInitialized = false;

  private constructor() {
    // Don't auto-initialize, let it be called explicitly
  }

  public static getInstance(): DicomLoaderService {
    DicomLoaderService.instance ??= new DicomLoaderService();
    return DicomLoaderService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Modern DICOM image loader initialization
      dicomImageLoaderInit({
        maxWebWorkers: Math.min(navigator.hardwareConcurrency || 1, 4),
        // startWebWorkersOnDemand property doesn't exist in DICOMImageLoaderConfig
      });

      this.isInitialized = true;
      log.info('✓ DICOM image loader initialized successfully');
    } catch (error) {
      console.error('Failed to initialize DICOM image loader:', error);
      throw error;
    }
  }

  public async loadImage(imageId: string): Promise<Types.IImage> {
    try {
      return await imageLoader.loadImage(imageId);
    } catch (error) {
      console.error('Failed to load image:', imageId, error);
      throw error;
    }
  }

  public async loadAndCacheImage(imageId: string): Promise<Types.IImage> {
    try {
      return (await imageLoader.loadAndCacheImage?.(imageId)) || ({} as Types.IImage);
    } catch (error) {
      console.error('Failed to load and cache image:', imageId, error);
      throw error;
    }
  }
}
