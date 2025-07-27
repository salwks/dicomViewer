/**
 * Annotation Persistence Service
 *
 * Handles serialization, deserialization, and persistence of annotations
 * Supports JSON export/import, DICOM SR, PDF export, and state management
 */

import {
  AnnotationStyling,
  AnnotationType,
  AnnotationStyleCategory,
} from '../types/annotation-styling';
import { log } from '../utils/logger';
import * as pako from 'pako';

/**
 * Serialized annotation data structure
 */
export interface SerializedAnnotation {
  /** Unique annotation ID */
  id: string;
  /** Annotation type */
  type: AnnotationType;
  /** Annotation data (geometry, measurements, etc.) */
  data: Record<string, unknown>;
  /** Applied styling */
  styling: AnnotationStyling;
  /** Viewport information */
  viewportInfo: {
    viewportId: string;
    imageId: string;
    seriesInstanceUID?: string;
    studyInstanceUID?: string;
    frameNumber?: number;
  };
  /** Metadata */
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    version: string;
    tags?: string[];
    description?: string;
    clinicalContext?: {
      finding?: string;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      confidence?: number;
      reviewStatus?: 'pending' | 'reviewed' | 'approved' | 'rejected';
      reviewer?: string;
      reviewDate?: Date;
    };
  };
  /** State information */
  state: {
    visible: boolean;
    selected: boolean;
    locked: boolean;
    active: boolean;
    zIndex: number;
  };
}

/**
 * Annotation collection export format
 */
export interface AnnotationExport {
  /** Export format version */
  version: string;
  /** Export timestamp */
  exportedAt: Date;
  /** Export metadata */
  metadata: {
    exportedBy: string;
    application: string;
    applicationVersion: string;
    totalCount: number;
    categories: AnnotationStyleCategory[];
    types: AnnotationType[];
    studyInfo?: {
      studyInstanceUID?: string;
      patientId?: string;
      studyDate?: string;
      modality?: string;
    };
  };
  /** Serialized annotations */
  annotations: SerializedAnnotation[];
  /** Style definitions used */
  styles: AnnotationStyling[];
  /** Validation checksum */
  checksum: string;
}

/**
 * Import validation result
 */
export interface ImportValidation {
  /** Whether import data is valid */
  isValid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Successfully validated annotations */
  validAnnotations: SerializedAnnotation[];
  /** Failed annotations with reasons */
  failedAnnotations: Array<{
    annotation: Partial<SerializedAnnotation>;
    reason: string;
  }>;
}

/**
 * Persistence options
 */
export interface PersistenceOptions {
  /** Include styling information */
  includeStyles?: boolean;
  /** Include metadata */
  includeMetadata?: boolean;
  /** Include state information */
  includeState?: boolean;
  /** Compress data */
  compress?: boolean;
  /** Validate before save */
  validate?: boolean;
  /** Backup before overwrite */
  backup?: boolean;
}

/**
 * Storage backend interface
 */
export interface StorageBackend {
  /** Save data */
  save(key: string, data: string): Promise<void>;
  /** Load data */
  load(key: string): Promise<string | null>;
  /** Delete data */
  delete(key: string): Promise<void>;
  /** List keys */
  list(): Promise<string[]>;
  /** Clear all data */
  clear(): Promise<void>;
}

/**
 * Local Storage backend implementation
 */
export class LocalStorageBackend implements StorageBackend {
  private prefix = 'cornerstone3d-annotations-';

  async save(key: string, data: string): Promise<void> {
    try {
      localStorage.setItem(this.prefix + key, data);
    } catch (error) {
      throw new Error(`Failed to save to localStorage: ${error}`);
    }
  }

  async load(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(this.prefix + key);
    } catch (error) {
      throw new Error(`Failed to load from localStorage: ${error}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch (error) {
      throw new Error(`Failed to delete from localStorage: ${error}`);
    }
  }

  async list(): Promise<string[]> {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        keys.push(key.substring(this.prefix.length));
      }
    }
    return keys;
  }

  async clear(): Promise<void> {
    const keys = await this.list();
    for (const key of keys) {
      await this.delete(key);
    }
  }
}

/**
 * IndexedDB backend implementation
 */
export class IndexedDBBackend implements StorageBackend {
  private dbName = 'cornerstone3d-annotations';
  private dbVersion = 1;
  private storeName = 'annotations';

  private async getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  async save(key: string, data: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(data, key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async load(key: string): Promise<string | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async delete(key: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async list(): Promise<string[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result.map(key => String(key)));
    });
  }

  async clear(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

/**
 * Annotation Persistence Service
 */
export class AnnotationPersistenceService {
  private static instance: AnnotationPersistenceService;
  private backend: StorageBackend;
  private eventListeners: Map<string, Function[]> = new Map();

  private constructor(backend?: StorageBackend) {
    this.backend = backend || new LocalStorageBackend();
    log.info('Annotation Persistence Service initialized', {
      component: 'AnnotationPersistenceService',
      metadata: { backendType: this.backend.constructor.name },
    });
  }

  static getInstance(backend?: StorageBackend): AnnotationPersistenceService {
    if (!AnnotationPersistenceService.instance) {
      AnnotationPersistenceService.instance = new AnnotationPersistenceService(backend);
    }
    return AnnotationPersistenceService.instance;
  }

  /**
   * Set storage backend
   */
  setBackend(backend: StorageBackend): void {
    this.backend = backend;
    this.emit('backendChanged', { backend });
  }

  /**
   * Initialize the service (placeholder for compatibility)
   */
  async initialize(): Promise<void> {
    // Service is already initialized in constructor
    // This method exists for API compatibility
    return Promise.resolve();
  }

  /**
   * Get service statistics
   */
  getStatistics(): Record<string, unknown> {
    return {
      backend: this.backend.constructor.name,
      eventListeners: this.eventListeners.size,
      initialized: true,
    };
  }

  /* =============================================================================
   * SERIALIZATION
   * ============================================================================= */

  /**
   * Serialize single annotation
   */
  serializeAnnotation(annotation: any, options: PersistenceOptions = {}): SerializedAnnotation {
    const {
      includeStyles = true,
      includeMetadata = true,
      includeState = true,
    } = options;

    // Basic validation
    if (!annotation.id || !annotation.type) {
      throw new Error('Annotation must have id and type');
    }

    const serialized: SerializedAnnotation = {
      id: annotation.id,
      type: annotation.type,
      data: this.sanitizeData(annotation.data || {}),
      styling: includeStyles ? (annotation.styling || {}) : {} as AnnotationStyling,
      viewportInfo: {
        viewportId: annotation.viewportId || '',
        imageId: annotation.imageId || '',
        seriesInstanceUID: annotation.seriesInstanceUID,
        studyInstanceUID: annotation.studyInstanceUID,
        frameNumber: annotation.frameNumber,
      },
      metadata: includeMetadata ? {
        createdAt: annotation.createdAt || new Date(),
        updatedAt: annotation.updatedAt || new Date(),
        createdBy: annotation.createdBy || 'system',
        version: annotation.version || '1.0.0',
        tags: annotation.tags || [],
        description: annotation.description,
        clinicalContext: annotation.clinicalContext,
      } : {
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system',
        version: '1.0.0',
      },
      state: includeState ? {
        visible: annotation.visible !== false,
        selected: annotation.selected || false,
        locked: annotation.locked || false,
        active: annotation.active || false,
        zIndex: annotation.zIndex || 100,
      } : {
        visible: true,
        selected: false,
        locked: false,
        active: false,
        zIndex: 100,
      },
    };

    return serialized;
  }

  /**
   * Deserialize single annotation
   */
  deserializeAnnotation(serialized: SerializedAnnotation): any {
    // Validate serialized data
    const validation = this.validateSerializedAnnotation(serialized);
    if (!validation.isValid) {
      throw new Error(`Invalid serialized annotation: ${validation.errors.join(', ')}`);
    }

    return {
      id: serialized.id,
      type: serialized.type,
      data: serialized.data,
      styling: serialized.styling,
      viewportId: serialized.viewportInfo.viewportId,
      imageId: serialized.viewportInfo.imageId,
      seriesInstanceUID: serialized.viewportInfo.seriesInstanceUID,
      studyInstanceUID: serialized.viewportInfo.studyInstanceUID,
      frameNumber: serialized.viewportInfo.frameNumber,
      createdAt: new Date(serialized.metadata.createdAt),
      updatedAt: new Date(serialized.metadata.updatedAt),
      createdBy: serialized.metadata.createdBy,
      version: serialized.metadata.version,
      tags: serialized.metadata.tags || [],
      description: serialized.metadata.description,
      clinicalContext: serialized.metadata.clinicalContext,
      visible: serialized.state.visible,
      selected: serialized.state.selected,
      locked: serialized.state.locked,
      active: serialized.state.active,
      zIndex: serialized.state.zIndex,
    };
  }

  /**
   * Sanitize annotation data for serialization
   */
  private sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    // Whitelist of allowed data properties
    const allowedProperties = new Set([
      'points', 'handles', 'measurements', 'text', 'value', 'unit',
      'geometry', 'coordinates', 'bounds', 'center', 'radius',
      'width', 'height', 'angle', 'area', 'length', 'volume',
      'cachedStats', 'textBox', 'color', 'lineWidth', 'lineDash',
    ]);

    Object.keys(data).forEach(key => {
      if (allowedProperties.has(key) && Object.prototype.hasOwnProperty.call(data, key)) {
        // eslint-disable-next-line security/detect-object-injection
        const value = data[key];

        // Recursive sanitization for nested objects
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // eslint-disable-next-line security/detect-object-injection
          sanitized[key] = this.sanitizeData(value as Record<string, unknown>);
        } else {
          // eslint-disable-next-line security/detect-object-injection
          sanitized[key] = value;
        }
      }
    });

    return sanitized;
  }

  /* =============================================================================
   * EXPORT/IMPORT
   * ============================================================================= */

  /**
   * Export annotations to JSON
   */
  exportToJSON(
    annotations: any[],
    options: PersistenceOptions & {
      studyInfo?: {
        studyInstanceUID?: string;
        patientId?: string;
        studyDate?: string;
        modality?: string;
      };
    } = {},
  ): AnnotationExport {
    const serializedAnnotations = annotations.map(annotation =>
      this.serializeAnnotation(annotation, options),
    );

    const styles = options.includeStyles !== false
      ? this.extractUniqueStyles(serializedAnnotations)
      : [];

    const exportData: AnnotationExport = {
      version: '1.0.0',
      exportedAt: new Date(),
      metadata: {
        exportedBy: 'Cornerstone3D Viewer',
        application: 'Cornerstone3D Medical Viewer',
        applicationVersion: '1.0.0',
        totalCount: serializedAnnotations.length,
        categories: [...new Set(styles.map(s => s.category))],
        types: [...new Set(serializedAnnotations.map(a => a.type))],
        studyInfo: options.studyInfo,
      },
      annotations: serializedAnnotations,
      styles,
      checksum: this.calculateChecksum(serializedAnnotations),
    };

    this.emit('exported', { exportData, count: annotations.length });
    log.medical(`Exported ${annotations.length} annotations`, {
      component: 'AnnotationPersistenceService',
      operation: 'export',
      metadata: { annotationCount: annotations.length, format: 'JSON' },
    });

    return exportData;
  }

  /**
   * Import annotations from JSON
   */
  importFromJSON(exportData: AnnotationExport): ImportValidation {
    const validation = this.validateImportData(exportData);

    if (validation.isValid) {
      const annotations = validation.validAnnotations.map(serialized =>
        this.deserializeAnnotation(serialized),
      );

      this.emit('imported', {
        annotations,
        count: annotations.length,
        warnings: validation.warnings,
      });

      log.medical(`Imported ${annotations.length} annotations`, {
        component: 'AnnotationPersistenceService',
        operation: 'import',
        metadata: { annotationCount: annotations.length, warnings: validation.warnings.length },
      });
    }

    return validation;
  }

  /**
   * Extract unique styles from annotations
   */
  private extractUniqueStyles(annotations: SerializedAnnotation[]): AnnotationStyling[] {
    const styleMap = new Map<string, AnnotationStyling>();

    annotations.forEach(annotation => {
      if (annotation.styling && annotation.styling.id) {
        styleMap.set(annotation.styling.id, annotation.styling);
      }
    });

    return Array.from(styleMap.values());
  }

  /**
   * Calculate checksum for validation
   */
  private calculateChecksum(annotations: SerializedAnnotation[]): string {
    const content = JSON.stringify(annotations.map(a => ({ id: a.id, type: a.type, data: a.data })));
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /* =============================================================================
   * PERSISTENCE
   * ============================================================================= */

  /**
   * Save single annotation (wrapper for saveAnnotations)
   */
  async saveAnnotation(
    annotation: SerializedAnnotation,
    options: PersistenceOptions = {},
  ): Promise<void> {
    const key = `annotation-${annotation.id}`;
    await this.saveAnnotations(key, [annotation], options);
  }

  /**
   * Save annotations to storage
   */
  async saveAnnotations(
    key: string,
    annotations: any[],
    options: PersistenceOptions = {},
  ): Promise<void> {
    try {
      if (options.backup) {
        await this.createBackup(key);
      }

      const exportData = this.exportToJSON(annotations, options);

      if (options.validate) {
        const validation = this.validateExportData(exportData);
        if (!validation.isValid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }
      }

      let jsonData = JSON.stringify(exportData);

      if (options.compress) {
        // Simple compression (in production, use a proper compression library)
        jsonData = this.compressData(jsonData);
      }

      await this.backend.save(key, jsonData);

      this.emit('saved', { key, count: annotations.length });
      log.info(`Saved ${annotations.length} annotations to ${key}`, {
        component: 'AnnotationPersistenceService',
        metadata: { annotationCount: annotations.length, key },
      });

    } catch (error) {
      this.emit('saveError', { key, error });
      throw error;
    }
  }

  /**
   * Load annotations from storage
   */
  async loadAnnotations(key: string): Promise<any[]> {
    try {
      const data = await this.backend.load(key);
      if (!data) {
        return [];
      }

      let jsonData = data;

      // Try to decompress if data appears compressed
      if (this.isCompressed(data)) {
        jsonData = this.decompressData(data);
      }

      const exportData: AnnotationExport = JSON.parse(jsonData);
      const validation = this.importFromJSON(exportData);

      if (!validation.isValid) {
        log.warn('Loaded annotations with validation warnings', {
          component: 'AnnotationPersistenceService',
          metadata: { warnings: validation.warnings },
        });
      }

      const annotations = validation.validAnnotations.map(serialized =>
        this.deserializeAnnotation(serialized),
      );

      this.emit('loaded', { key, count: annotations.length });
      log.info(`Loaded ${annotations.length} annotations from ${key}`, {
        component: 'AnnotationPersistenceService',
        metadata: { annotationCount: annotations.length, key },
      });

      return annotations;

    } catch (error) {
      this.emit('loadError', { key, error });
      throw error;
    }
  }

  /**
   * Delete single annotation (wrapper for deleteAnnotations)
   */
  async deleteAnnotation(annotationId: string): Promise<void> {
    const key = `annotation-${annotationId}`;
    await this.deleteAnnotations(key);
  }

  /**
   * Delete annotations from storage
   */
  async deleteAnnotations(key: string): Promise<void> {
    try {
      await this.backend.delete(key);
      this.emit('deleted', { key });
      log.info(`Deleted annotations: ${key}`, {
        component: 'AnnotationPersistenceService',
        metadata: { key },
      });
    } catch (error) {
      this.emit('deleteError', { key, error });
      throw error;
    }
  }

  /**
   * List all annotation keys
   */
  async listAnnotationKeys(): Promise<string[]> {
    return this.backend.list();
  }

  /**
   * Clear all annotations
   */
  async clearAllAnnotations(): Promise<void> {
    await this.backend.clear();
    this.emit('cleared', {});
    log.info('Cleared all annotations', {
      component: 'AnnotationPersistenceService',
    });
  }

  /**
   * Create backup before overwrite
   */
  private async createBackup(key: string): Promise<void> {
    try {
      const existing = await this.backend.load(key);
      if (existing) {
        const backupKey = `${key}-backup-${Date.now()}`;
        await this.backend.save(backupKey, existing);
        log.info(`Created backup: ${backupKey}`, {
          component: 'AnnotationPersistenceService',
          metadata: { backupKey },
        });
      }
    } catch (error) {
      log.warn('Failed to create backup', {
        component: 'AnnotationPersistenceService',
      }, error as Error);
    }
  }

  /**
   * Compress data using pako deflate
   */
  private compressData(data: string): string {
    try {
      const inputData = new TextEncoder().encode(data);
      const compressed = pako.deflate(inputData);
      const base64 = btoa(String.fromCharCode(...compressed));
      return `PAKO:${base64}`;
    } catch (error) {
      log.warn('Compression failed, storing uncompressed', {
        component: 'AnnotationPersistenceService',
      }, error as Error);
      return data;
    }
  }

  /**
   * Decompress data using pako inflate
   */
  private decompressData(data: string): string {
    try {
      if (!data.startsWith('PAKO:')) {
        // Handle legacy compressed format
        if (data.startsWith('COMPRESSED:')) {
          return data.substring(11);
        }
        return data;
      }

      const base64Data = data.substring(5);
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        // eslint-disable-next-line security/detect-object-injection
        bytes[i] = binary.charCodeAt(i);
      }

      const decompressed = pako.inflate(bytes);
      return new TextDecoder().decode(decompressed);
    } catch (error) {
      log.warn('Decompression failed, trying raw data', {
        component: 'AnnotationPersistenceService',
      }, error as Error);
      // Fallback to raw data if decompression fails
      return data.startsWith('PAKO:') ? data.substring(5) : data;
    }
  }

  /**
   * Check if data is compressed
   */
  private isCompressed(data: string): boolean {
    return data.startsWith('PAKO:') || data.startsWith('COMPRESSED:');
  }

  /* =============================================================================
   * VALIDATION
   * ============================================================================= */

  /**
   * Validate serialized annotation
   */
  private validateSerializedAnnotation(annotation: SerializedAnnotation): ImportValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!annotation.id) {
      errors.push('Missing annotation ID');
    }

    if (!annotation.type) {
      errors.push('Missing annotation type');
    }

    if (!annotation.viewportInfo) {
      errors.push('Missing viewport information');
    }

    if (!annotation.metadata) {
      warnings.push('Missing metadata information');
    }

    if (!annotation.state) {
      warnings.push('Missing state information');
    }

    // Validate dates
    if (annotation.metadata?.createdAt && isNaN(new Date(annotation.metadata.createdAt).getTime())) {
      warnings.push('Invalid createdAt date');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validAnnotations: errors.length === 0 ? [annotation] : [],
      failedAnnotations: errors.length > 0 ? [{ annotation, reason: errors.join(', ') }] : [],
    };
  }

  /**
   * Validate import data
   */
  private validateImportData(exportData: AnnotationExport): ImportValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const validAnnotations: SerializedAnnotation[] = [];
    const failedAnnotations: Array<{ annotation: Partial<SerializedAnnotation>; reason: string }> = [];

    // Validate export format
    if (!exportData.version) {
      errors.push('Missing export version');
    }

    if (!exportData.annotations || !Array.isArray(exportData.annotations)) {
      errors.push('Invalid or missing annotations array');
      return { isValid: false, errors, warnings, validAnnotations, failedAnnotations };
    }

    // Validate checksum
    const calculatedChecksum = this.calculateChecksum(exportData.annotations);
    if (exportData.checksum && exportData.checksum !== calculatedChecksum) {
      warnings.push('Checksum mismatch - data may be corrupted');
    }

    // Validate individual annotations
    exportData.annotations.forEach(annotation => {
      const validation = this.validateSerializedAnnotation(annotation);
      if (validation.isValid) {
        validAnnotations.push(annotation);
      } else {
        failedAnnotations.push({
          annotation,
          reason: validation.errors.join(', '),
        });
        warnings.push(`Invalid annotation ${annotation.id}: ${validation.errors.join(', ')}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validAnnotations,
      failedAnnotations,
    };
  }

  /**
   * Validate export data
   */
  private validateExportData(exportData: AnnotationExport): ImportValidation {
    return this.validateImportData(exportData);
  }

  /* =============================================================================
   * EVENT SYSTEM
   * ============================================================================= */

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }
}

// Export singleton instance
export const annotationPersistenceService = AnnotationPersistenceService.getInstance();
