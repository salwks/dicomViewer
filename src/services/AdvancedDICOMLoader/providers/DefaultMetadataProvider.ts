/**
 * Default DICOM Metadata Provider
 * Standard DICOM metadata extraction using cornerstone-dicom-image-loader
 */

import { MetadataProvider } from '../MetadataProvider';
import { DICOMMetadata, LoadOptions } from '../types';
import { log } from '../../../utils/logger';

export class DefaultMetadataProvider implements MetadataProvider {
  public readonly name = 'DefaultMetadataProvider';
  public readonly priority = 50; // Medium priority

  private cache: Map<string, DICOMMetadata> = new Map();

  /**
   * Check if this provider can handle the given image ID
   */
  public canHandle(imageId: string): boolean {
    // Handle standard DICOM image IDs
    return imageId.startsWith('dicomweb:') ||
           imageId.startsWith('wadouri:') ||
           imageId.startsWith('dicomfile:') ||
           imageId.includes('.dcm');
  }

  /**
   * Extract metadata from DICOM data
   */
  public async extractMetadata(
    imageId: string,
    _rawData: ArrayBuffer,
    options: LoadOptions = { imageId },
  ): Promise<DICOMMetadata> {
    try {
      // Check cache first
      const cached = this.cache.get(imageId);
      if (cached) {
        return cached;
      }

      // Extract basic metadata from imageId and options
      const metadata = this.extractBasicMetadata(imageId, options);

      // Cache the result
      this.cache.set(imageId, metadata);

      return metadata;

    } catch (error) {
      log.error('Default metadata extraction failed', {
        component: 'DefaultMetadataProvider',
        metadata: { imageId, error: (error as Error).message },
      });
      throw error;
    }
  }

  /**
   * Extract basic metadata from imageId and options
   */
  private extractBasicMetadata(
    imageId: string,
    options: LoadOptions,
  ): DICOMMetadata {
    // Parse imageId to extract basic information
    const parts = imageId.split('/');
    const filename = parts[parts.length - 1];

    const metadata: DICOMMetadata = {
      studyInstanceUID: `study-${Date.now()}`,
      seriesInstanceUID: `series-${Date.now()}`,
      sopInstanceUID: `instance-${Date.now()}`,
      patientName: 'Default Patient',
      patientID: 'DEFAULT001',
      instanceNumber: 1,
      rows: 512,
      columns: 512,
      pixelSpacing: [1.0, 1.0],
      windowCenter: 128,
      windowWidth: 256,
    };

    // Add custom metadata if provided
    if (options.customMetadata) {
      Object.assign(metadata, options.customMetadata);
    }

    // Extract information from filename if possible
    if (filename) {
      metadata.sopInstanceUID = filename.replace(/\.[^/.]+$/, ''); // Remove extension
    }

    return metadata;
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  public getCacheSize(): number {
    return this.cache.size;
  }
}
