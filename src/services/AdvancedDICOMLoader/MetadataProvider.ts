/**
 * Custom Metadata Provider System
 * Enables flexible metadata handling for different DICOM sources
 * Supports custom attribute mapping and caching strategies
 */

import { EventEmitter } from 'events';
import { DICOMMetadata, LoadOptions } from './types';
import { log } from '../../utils/logger';

// Metadata provider interface
export interface MetadataProvider {
  readonly name: string;
  readonly priority: number;
  canHandle(imageId: string, metadata?: DICOMMetadata): boolean;
  extractMetadata(imageId: string, rawData: ArrayBuffer, options?: LoadOptions): Promise<DICOMMetadata>;
  getCachedMetadata?(imageId: string): DICOMMetadata | null;
  clearCache?(): void;
}

// Provider registration entry
interface ProviderEntry {
  provider: MetadataProvider;
  priority: number;
  enabled: boolean;
}

// Metadata cache entry
interface CacheEntry {
  metadata: DICOMMetadata;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

// Provider configuration
export interface MetadataProviderConfig {
  maxCacheSize: number;
  cacheTimeout: number; // milliseconds
  enableFallback: boolean;
  retryAttempts: number;
  customAttributeMapping?: Record<string, string>;
}

// Default provider configuration
const DEFAULT_CONFIG: MetadataProviderConfig = {
  maxCacheSize: 1000,
  cacheTimeout: 5 * 60 * 1000, // 5 minutes
  enableFallback: true,
  retryAttempts: 3,
};

export class MetadataProviderManager extends EventEmitter {
  private providers: Map<string, ProviderEntry> = new Map();
  private cache: Map<string, CacheEntry> = new Map();
  private config: MetadataProviderConfig;

  constructor(config: Partial<MetadataProviderConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupCacheCleanup();
  }

  /**
   * Register a metadata provider
   */
  public registerProvider(provider: MetadataProvider): void {
    const entry: ProviderEntry = {
      provider,
      priority: provider.priority,
      enabled: true,
    };

    this.providers.set(provider.name, entry);

    // Sort providers by priority (higher first)
    const sortedEntries = Array.from(this.providers.entries())
      .sort(([, a], [, b]) => b.priority - a.priority);

    this.providers.clear();
    sortedEntries.forEach(([name, entry]) => {
      this.providers.set(name, entry);
    });

    log.info('Metadata provider registered', {
      component: 'MetadataProviderManager',
      metadata: {
        name: provider.name,
        priority: provider.priority,
        totalProviders: this.providers.size,
      },
    });

    this.emit('providerRegistered', provider);
  }

  /**
   * Unregister a metadata provider
   */
  public unregisterProvider(name: string): boolean {
    const removed = this.providers.delete(name);

    if (removed) {
      log.info('Metadata provider unregistered', {
        component: 'MetadataProviderManager',
        metadata: { name, remainingProviders: this.providers.size },
      });
      this.emit('providerUnregistered', name);
    }

    return removed;
  }

  /**
   * Enable/disable a specific provider
   */
  public setProviderEnabled(name: string, enabled: boolean): boolean {
    const entry = this.providers.get(name);
    if (!entry) return false;

    entry.enabled = enabled;
    log.info('Metadata provider status changed', {
      component: 'MetadataProviderManager',
      metadata: { name, enabled },
    });

    return true;
  }

  /**
   * Extract metadata using registered providers
   */
  public async extractMetadata(
    imageId: string,
    rawData: ArrayBuffer,
    options: LoadOptions = { imageId },
  ): Promise<DICOMMetadata> {
    // Check cache first
    const cached = this.getCachedMetadata(imageId);
    if (cached) {
      return cached;
    }

    let lastError: Error | null = null;
    let attempts = 0;

    // Try each provider in priority order
    for (const [name, entry] of this.providers) {
      if (!entry.enabled) continue;

      const { provider } = entry;

      try {
        if (!provider.canHandle(imageId)) continue;

        attempts++;
        const metadata = await provider.extractMetadata(imageId, rawData, options);

        // Apply custom attribute mapping if configured
        const mappedMetadata = this.applyAttributeMapping(metadata);

        // Cache the result
        this.cacheMetadata(imageId, mappedMetadata);

        log.info('Metadata extracted successfully', {
          component: 'MetadataProviderManager',
          metadata: {
            imageId,
            provider: name,
            attempts,
            cacheSize: this.cache.size,
          },
        });

        this.emit('metadataExtracted', { imageId, metadata: mappedMetadata, provider: name });
        return mappedMetadata;

      } catch (error) {
        lastError = error as Error;
        log.warn('Metadata provider failed', {
          component: 'MetadataProviderManager',
          metadata: {
            imageId,
            provider: name,
            error: lastError.message,
            attempts,
          },
        });

        // Retry logic for current provider
        if (attempts < this.config.retryAttempts) {
          continue;
        }
      }
    }

    // Fallback mechanism
    if (this.config.enableFallback) {
      const fallbackMetadata = this.createFallbackMetadata(imageId);
      this.cacheMetadata(imageId, fallbackMetadata);

      log.warn('Using fallback metadata', {
        component: 'MetadataProviderManager',
        metadata: { imageId, totalAttempts: attempts },
      });

      return fallbackMetadata;
    }

    throw new Error(
      `Failed to extract metadata for ${imageId} after ${attempts} attempts. Last error: ${lastError?.message || 'Unknown error'}`,
    );
  }

  /**
   * Get cached metadata
   */
  public getCachedMetadata(imageId: string): DICOMMetadata | null {
    const entry = this.cache.get(imageId);
    if (!entry) return null;

    // Check if cache entry is expired
    const now = Date.now();
    if (now - entry.timestamp > this.config.cacheTimeout) {
      this.cache.delete(imageId);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;

    return entry.metadata;
  }

  /**
   * Cache metadata
   */
  private cacheMetadata(imageId: string, metadata: DICOMMetadata): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictLeastRecentlyUsed();
    }

    const entry: CacheEntry = {
      metadata,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
    };

    this.cache.set(imageId, entry);
  }

  /**
   * Apply custom attribute mapping
   */
  private applyAttributeMapping(metadata: DICOMMetadata): DICOMMetadata {
    if (!this.config.customAttributeMapping) {
      return metadata;
    }

    const mapped = { ...metadata };

    for (const [sourceKey, targetKey] of Object.entries(this.config.customAttributeMapping)) {
      if (sourceKey in mapped && targetKey !== sourceKey) {

        // eslint-disable-next-line security/detect-object-injection -- Safe property mapping
        (mapped as any)[targetKey] = (mapped as any)[sourceKey];
        // eslint-disable-next-line security/detect-object-injection -- Safe property deletion
        delete (mapped as any)[sourceKey];
      }
    }

    return mapped;
  }

  /**
   * Create fallback metadata when all providers fail
   */
  private createFallbackMetadata(_imageId: string): DICOMMetadata {
    return {
      studyInstanceUID: 'unknown',
      seriesInstanceUID: 'unknown',
      sopInstanceUID: 'unknown',
      patientName: 'Unknown Patient',
      patientID: 'UNKNOWN',
      instanceNumber: 1,
      rows: 512,
      columns: 512,
      pixelSpacing: [1.0, 1.0],
      windowCenter: 0,
      windowWidth: 1,
    };
  }

  /**
   * Evict least recently used cache entries
   */
  private evictLeastRecentlyUsed(): void {
    if (this.cache.size === 0) return;

    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      log.info('Cache entry evicted', {
        component: 'MetadataProviderManager',
        metadata: { imageId: oldestKey, cacheSize: this.cache.size },
      });
    }
  }

  /**
   * Setup periodic cache cleanup
   */
  private setupCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const expiredKeys: string[] = [];

      for (const [key, entry] of this.cache) {
        if (now - entry.timestamp > this.config.cacheTimeout) {
          expiredKeys.push(key);
        }
      }

      for (const key of expiredKeys) {
        this.cache.delete(key);
      }

      if (expiredKeys.length > 0) {
        log.info('Expired cache entries cleaned', {
          component: 'MetadataProviderManager',
          metadata: {
            expiredCount: expiredKeys.length,
            remainingCount: this.cache.size,
          },
        });
      }
    }, this.config.cacheTimeout / 2); // Run cleanup twice per timeout period
  }

  /**
   * Clear all cached metadata
   */
  public clearCache(): void {
    const clearedCount = this.cache.size;
    this.cache.clear();

    // Clear provider-specific caches
    for (const [, entry] of this.providers) {
      if (entry.provider.clearCache) {
        entry.provider.clearCache();
      }
    }

    log.info('All metadata cache cleared', {
      component: 'MetadataProviderManager',
      metadata: { clearedCount },
    });

    this.emit('cacheCleared', { clearedCount });
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ imageId: string; timestamp: number; accessCount: number }>;
    } {
    const entries = Array.from(this.cache.entries()).map(([imageId, entry]) => ({
      imageId,
      timestamp: entry.timestamp,
      accessCount: entry.accessCount,
    }));

    const totalAccesses = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
    const hitRate = totalAccesses > 0 ? (totalAccesses - entries.length) / totalAccesses : 0;

    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      hitRate,
      entries,
    };
  }

  /**
   * Get registered providers info
   */
  public getProvidersInfo(): Array<{
    name: string;
    priority: number;
    enabled: boolean;
  }> {
    return Array.from(this.providers.entries()).map(([name, entry]) => ({
      name,
      priority: entry.priority,
      enabled: entry.enabled,
    }));
  }
}
