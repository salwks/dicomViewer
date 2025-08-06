/**
 * Custom Metadata Provider
 * Template for creating custom metadata providers for specific use cases
 */

import { MetadataProvider } from '../MetadataProvider';
import { DICOMMetadata, LoadOptions } from '../types';
import { log } from '../../../utils/logger';

export interface CustomProviderConfig {
  name: string;
  priority: number;
  urlPatterns: string[];
  headerMapping?: Record<string, string>;
  customAttributes?: Record<string, unknown>;
  transformFunction?: (metadata: DICOMMetadata) => DICOMMetadata;
}

export class CustomMetadataProvider implements MetadataProvider {
  public readonly name: string;
  public readonly priority: number;

  private config: CustomProviderConfig;
  private cache: Map<string, DICOMMetadata> = new Map();
  private urlPatterns: RegExp[];

  constructor(config: CustomProviderConfig) {
    this.config = config;
    this.name = config.name;
    this.priority = config.priority;

    // Compile URL patterns to RegExp for efficient matching

    this.urlPatterns = config.urlPatterns.map(pattern => {
      // eslint-disable-next-line security/detect-non-literal-regexp -- Pattern is from controlled config
      return new RegExp(pattern.replace(/\*/g, '.*'));
    });
  }

  /**
   * Check if this provider can handle the given image ID
   */
  public canHandle(imageId: string, metadata?: DICOMMetadata): boolean {
    // Check URL patterns
    const urlMatch = this.urlPatterns.some(pattern => pattern.test(imageId));
    if (urlMatch) return true;

    // Check metadata-based conditions if provided
    if (metadata && this.canHandleMetadata(metadata)) {
      return true;
    }

    return false;
  }

  /**
   * Check if provider can handle based on existing metadata
   */
  private canHandleMetadata(metadata: DICOMMetadata): boolean {
    // Override this method in subclasses for metadata-based filtering
    // Example: check specific SOP Class UID, modality, etc.

    // Default implementation - check for custom attributes
    if (this.config.customAttributes) {
      for (const [key] of Object.entries(this.config.customAttributes)) {
        if (key in metadata) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Extract metadata using custom logic
   */
  public async extractMetadata(
    imageId: string,
    rawData: ArrayBuffer,
    options: LoadOptions = { imageId },
  ): Promise<DICOMMetadata> {
    try {
      // Start with basic metadata extraction
      let metadata = await this.extractBasicMetadata(imageId, rawData, options);

      // Apply header mapping if configured
      if (this.config.headerMapping && options.headers) {
        metadata = this.applyHeaderMapping(metadata, options.headers);
      }

      // Add custom attributes
      if (this.config.customAttributes) {
        metadata = { ...metadata, ...this.config.customAttributes };
      }

      // Apply custom transformation function
      if (this.config.transformFunction) {
        metadata = this.config.transformFunction(metadata);
      }

      // Cache the result
      this.cache.set(imageId, metadata);

      log.info('Custom metadata extracted', {
        component: 'CustomMetadataProvider',
        metadata: {
          provider: this.name,
          imageId,
          studyUID: metadata.studyInstanceUID,
        },
      });

      return metadata;

    } catch (error) {
      log.error('Custom metadata extraction failed', {
        component: 'CustomMetadataProvider',
        metadata: {
          provider: this.name,
          imageId,
          error: (error as Error).message,
        },
      });
      throw error;
    }
  }

  /**
   * Extract basic metadata - override in subclasses
   */
  protected async extractBasicMetadata(
    imageId: string,
    _rawData: ArrayBuffer,
    _options: LoadOptions = { imageId },
  ): Promise<DICOMMetadata> {
    // Default implementation - create minimal metadata
    return {
      studyInstanceUID: 'custom-study',
      seriesInstanceUID: 'custom-series',
      sopInstanceUID: 'custom-instance',
      patientName: 'Custom Patient',
      patientID: 'CUSTOM001',
      instanceNumber: 1,
      rows: 512,
      columns: 512,
      pixelSpacing: [1.0, 1.0],
      windowCenter: 0,
      windowWidth: 1,
    };
  }

  /**
   * Apply header mapping to metadata
   */
  private applyHeaderMapping(
    metadata: DICOMMetadata,
    headers: Record<string, string>,
  ): DICOMMetadata {
    const mapped = { ...metadata };

    for (const [headerKey, metadataKey] of Object.entries(this.config.headerMapping || {})) {
      // eslint-disable-next-line security/detect-object-injection -- Safe: headerKey is from controlled config
      const headerValue = headers[headerKey];
      if (headerValue) {

        // eslint-disable-next-line security/detect-object-injection -- Safe header mapping
        (mapped as any)[metadataKey] = headerValue;
      }
    }

    return mapped;
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
    log.info('Custom metadata provider cache cleared', {
      component: 'CustomMetadataProvider',
      metadata: { provider: this.name },
    });
  }

  /**
   * Update provider configuration
   */
  public updateConfig(updates: Partial<CustomProviderConfig>): void {
    this.config = { ...this.config, ...updates };

    // Recompile URL patterns if they changed
    if (updates.urlPatterns) {

      this.urlPatterns = this.config.urlPatterns.map(pattern => {
        // eslint-disable-next-line security/detect-non-literal-regexp -- Pattern is from controlled config
        return new RegExp(pattern.replace(/\*/g, '.*'));
      });
    }

    log.info('Custom metadata provider config updated', {
      component: 'CustomMetadataProvider',
      metadata: { provider: this.name, updates },
    });
  }
}

/**
 * Factory function to create custom metadata providers
 */
export function createCustomMetadataProvider(config: CustomProviderConfig): CustomMetadataProvider {
  return new CustomMetadataProvider(config);
}

/**
 * Example: Create a provider for a specific PACS system
 */
export function createPACSMetadataProvider(
  pacsName: string,
  baseUrl: string,
  customMapping?: Record<string, string>,
): CustomMetadataProvider {
  return createCustomMetadataProvider({
    name: `${pacsName}MetadataProvider`,
    priority: 70,
    urlPatterns: [`${baseUrl}/*`],
    headerMapping: {
      'X-Study-UID': 'studyInstanceUID',
      'X-Series-UID': 'seriesInstanceUID',
      'X-Instance-UID': 'sopInstanceUID',
      'X-Patient-Name': 'patientName',
      ...customMapping,
    },
    customAttributes: {
      pacsSystem: pacsName,
      loadedFrom: baseUrl,
    },
  });
}

/**
 * Example: Create a provider for research datasets
 */
export function createResearchMetadataProvider(
  studyName: string,
  customAttributes?: Record<string, unknown>,
): CustomMetadataProvider {
  return createCustomMetadataProvider({
    name: `${studyName}ResearchProvider`,
    priority: 60,
    urlPatterns: [`*${studyName}*`, '*research*'],
    customAttributes: {
      studyType: 'research',
      studyName,
      ...customAttributes,
    },
    transformFunction: (metadata) => ({
      ...metadata,
      patientName: `Research Subject ${metadata.instanceNumber}`,
    }),
  });
}
