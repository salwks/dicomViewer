/**
 * WADO Metadata Provider
 * Specialized metadata extraction for WADO-URI and WADO-RS protocols
 */

import { MetadataProvider } from '../MetadataProvider';
import { DICOMMetadata, LoadOptions } from '../types';
import { log } from '../../../utils/logger';

export class WADOMetadataProvider implements MetadataProvider {
  public readonly name = 'WADOMetadataProvider';
  public readonly priority = 80; // High priority for WADO sources

  private cache: Map<string, DICOMMetadata> = new Map();

  /**
   * Check if this provider can handle the given image ID
   */
  public canHandle(imageId: string): boolean {
    return imageId.startsWith('wado:') ||
           imageId.includes('/wado') ||
           imageId.includes('dicomweb:');
  }

  /**
   * Extract metadata from WADO response
   */
  public async extractMetadata(
    imageId: string,
    rawData: ArrayBuffer,
    options: LoadOptions = { imageId },
  ): Promise<DICOMMetadata> {
    try {
      // Parse WADO response
      const metadata = await this.parseWADOResponse(imageId, rawData, options);

      // Cache the result
      this.cache.set(imageId, metadata);

      log.info('WADO metadata extracted', {
        component: 'WADOMetadataProvider',
        metadata: { imageId, studyUID: metadata.studyInstanceUID },
      });

      return metadata;

    } catch (error) {
      log.error('WADO metadata extraction failed', {
        component: 'WADOMetadataProvider',
        metadata: { imageId, error: (error as Error).message },
      });
      throw error;
    }
  }

  /**
   * Parse WADO response and extract metadata
   */
  private async parseWADOResponse(
    imageId: string,
    rawData: ArrayBuffer,
    options: LoadOptions,
  ): Promise<DICOMMetadata> {
    // Check if this is a WADO-RS JSON response
    if (this.isJSONResponse(rawData)) {
      return this.parseWADORSJSON(imageId, rawData, options);
    }

    // Otherwise, treat as DICOM binary data
    return this.parseWADOBinary(imageId, rawData, options);
  }

  /**
   * Check if response is JSON format
   */
  private isJSONResponse(data: ArrayBuffer): boolean {
    try {
      const text = new TextDecoder().decode(data.slice(0, 10));
      return text.trim().startsWith('{') || text.trim().startsWith('[');
    } catch {
      return false;
    }
  }

  /**
   * Parse WADO-RS JSON metadata response
   */
  private parseWADORSJSON(
    imageId: string,
    rawData: ArrayBuffer,
    options: LoadOptions,
  ): DICOMMetadata {
    try {
      const text = new TextDecoder().decode(rawData);
      const jsonData = JSON.parse(text);

      // WADO-RS returns DICOM JSON format
      const dicomJson = Array.isArray(jsonData) ? jsonData[0] : jsonData;

      return this.extractFromDICOMJSON(dicomJson, imageId, options);

    } catch (error) {
      throw new Error(`Failed to parse WADO-RS JSON: ${(error as Error).message}`);
    }
  }

  /**
   * Parse WADO binary DICOM data
   */
  private parseWADOBinary(
    _imageId: string,
    _rawData: ArrayBuffer,
    _options: LoadOptions,
  ): DICOMMetadata {
    // For binary DICOM data, we would need a DICOM parser
    // This is a simplified implementation - in practice you'd use a library like dicom-parser
    throw new Error('WADO binary DICOM parsing not implemented - use WADO-RS JSON instead');
  }

  /**
   * Extract metadata from DICOM JSON format
   */
  private extractFromDICOMJSON(
    dicomJson: any,
    _imageId: string,
    options: LoadOptions,
  ): DICOMMetadata {
    const getValue = (tag: string, type: 'Value' | 'InlineBinary' = 'Value') => {
      // eslint-disable-next-line security/detect-object-injection -- Safe DICOM tag access
      const element = dicomJson[tag];
      if (!element) return undefined;

      if (type === 'Value' && element.Value) {
        return Array.isArray(element.Value) ? element.Value[0] : element.Value;
      }

      // eslint-disable-next-line security/detect-object-injection -- Safe property access
      return element[type];
    };

    const getArrayValue = (tag: string) => {
      // eslint-disable-next-line security/detect-object-injection -- Safe DICOM tag access
      const element = dicomJson[tag];
      return element?.Value || [];
    };

    const metadata: DICOMMetadata = {
      // Patient Information
      patientName: getValue('00100010') || 'Unknown Patient',
      patientID: getValue('00100020') || '',
      patientBirthDate: getValue('00100030') || '',

      // Study Information
      studyInstanceUID: getValue('0020000D') || 'unknown',

      // Series Information
      seriesInstanceUID: getValue('0020000E') || 'unknown',

      // Instance Information
      sopInstanceUID: getValue('00080018') || 'unknown',
      instanceNumber: parseInt(getValue('00200013') || '1', 10),

      // Image Properties
      rows: parseInt(getValue('00280010') || '512', 10),
      columns: parseInt(getValue('00280011') || '512', 10),
      pixelSpacing: getArrayValue('00280030').map(Number) || [1.0, 1.0],

      // Display Properties
      windowCenter: parseFloat(getValue('00281050') || '0'),
      windowWidth: parseFloat(getValue('00281051') || '1'),
    };

    // Add WADO-specific metadata
    if (options.wadoConfig) {
      metadata.wadoConfig = {
        protocol: 'WADO-URI',
        baseUrl: options.wadoConfig.url,
      };
    }

    // Add custom options if provided
    if (options.customMetadata) {
      Object.assign(metadata, options.customMetadata);
    }

    return metadata;
  }

  /**
   * Get cached metadata
   */
  public getCachedMetadata(imageId: string): DICOMMetadata | null {
    return this.cache.get(imageId) || null;
  }

  /**
   * Clear provider cache
   */
  public clearCache(): void {
    this.cache.clear();
    log.info('WADO metadata provider cache cleared', {
      component: 'WADOMetadataProvider',
    });
  }
}
