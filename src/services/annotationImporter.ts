/**
 * External Annotation Import Service
 *
 * Imports annotations from various external sources and formats
 * Supports DICOM SR, JSON, CSV, XML, and other medical imaging formats
 */

import {
  SerializedAnnotation,
  ImportValidation,
  annotationPersistenceService,
} from './annotationPersistence';
import { AnnotationType, AnnotationStyling } from '../types/annotation-styling';
import { styleManager } from '../styles/StyleManager';
import { log } from '../utils/logger';

/**
 * Import source types
 */
export enum ImportSourceType {
  JSON = 'json',
  DICOM_SR = 'dicom-sr',
  CSV = 'csv',
  XML = 'xml',
  CORNERSTONE_LEGACY = 'cornerstone-legacy',
  OHIF = 'ohif',
  MITK = 'mitk',
  SLICER = 'slicer',
  CUSTOM = 'custom',
}

/**
 * Import configuration
 */
export interface ImportConfig {
  /** Source type */
  sourceType: ImportSourceType;
  /** Merge strategy for existing annotations */
  mergeStrategy: 'replace' | 'merge' | 'skip' | 'prompt';
  /** Validation level */
  validationLevel: 'strict' | 'moderate' | 'lenient';
  /** Auto-assign styles */
  autoAssignStyles: boolean;
  /** Default style mappings */
  defaultStyleMappings: Record<AnnotationType, string>;
  /** Coordinate system conversion */
  coordinateConversion?: {
    from: 'image' | 'world' | 'pixel';
    to: 'image' | 'world' | 'pixel';
    transform?: number[];
  };
  /** Custom field mappings */
  fieldMappings?: Record<string, string>;
  /** Import filters */
  filters?: {
    annotationTypes?: AnnotationType[];
    dateRange?: { start: Date; end: Date };
    userFilter?: string[];
    tagFilter?: string[];
  };
}

/**
 * Import result
 */
export interface ImportResult {
  /** Success status */
  success: boolean;
  /** Import validation */
  validation: ImportValidation;
  /** Imported annotations */
  importedAnnotations: SerializedAnnotation[];
  /** Merge conflicts (if any) */
  conflicts: ImportConflict[];
  /** Import statistics */
  statistics: {
    totalProcessed: number;
    successfulImports: number;
    failedImports: number;
    duplicatesFound: number;
    conflictsResolved: number;
    processingTime: number;
  };
  /** Import metadata */
  metadata: {
    sourceType: ImportSourceType;
    importedAt: Date;
    sourceInfo?: any;
  };
}

/**
 * Import conflict
 */
export interface ImportConflict {
  /** Conflict type */
  type: 'duplicate' | 'version' | 'style' | 'data';
  /** Existing annotation */
  existing: SerializedAnnotation;
  /** Incoming annotation */
  incoming: SerializedAnnotation;
  /** Suggested resolution */
  suggestedResolution: 'keep-existing' | 'use-incoming' | 'merge' | 'manual';
  /** Conflict description */
  description: string;
}

/**
 * Field mapper interface
 */
export interface FieldMapper {
  /** Map annotation data */
  mapAnnotation(sourceData: any): Partial<SerializedAnnotation>;
  /** Map metadata */
  mapMetadata(sourceData: any): SerializedAnnotation['metadata'];
  /** Map styling */
  mapStyling(sourceData: any): AnnotationStyling | null;
  /** Validate mapped data */
  validate(mapped: Partial<SerializedAnnotation>): string[];
}

/**
 * JSON format mapper
 */
export class JSONFieldMapper implements FieldMapper {
  private config: ImportConfig;

  constructor(config: ImportConfig) {
    this.config = config;
  }

  mapAnnotation(sourceData: any): Partial<SerializedAnnotation> {
    // Direct mapping for JSON format (already compatible)
    const mapped: Partial<SerializedAnnotation> = {
      id: sourceData.id || this.generateId(),
      type: this.mapAnnotationType(sourceData.type),
      data: this.sanitizeData(sourceData.data || {}),
      viewportInfo: {
        viewportId: sourceData.viewportId || 'imported',
        imageId: sourceData.imageId || '',
        seriesInstanceUID: sourceData.seriesInstanceUID,
        studyInstanceUID: sourceData.studyInstanceUID,
        frameNumber: sourceData.frameNumber,
      },
      state: {
        visible: sourceData.visible !== false,
        selected: false,
        locked: sourceData.locked || false,
        active: false,
        zIndex: sourceData.zIndex || 100,
      },
    };

    return mapped;
  }

  mapMetadata(sourceData: any): SerializedAnnotation['metadata'] {
    return {
      createdAt: sourceData.createdAt ? new Date(sourceData.createdAt) : new Date(),
      updatedAt: sourceData.updatedAt ? new Date(sourceData.updatedAt) : new Date(),
      createdBy: sourceData.createdBy || 'imported',
      version: sourceData.version || '1.0.0',
      tags: Array.isArray(sourceData.tags) ? sourceData.tags : [],
      description: sourceData.description || '',
      clinicalContext: sourceData.clinicalContext,
    };
  }

  mapStyling(sourceData: any): AnnotationStyling | null {
    if (!sourceData.styling) return null;

    // Validate and sanitize styling
    try {
      const validation = styleManager.validateStyle(sourceData.styling);
      if (validation.isValid) {
        return sourceData.styling;
      }
    } catch (error) {
      console.warn('Invalid styling in source data:', error);
    }

    return null;
  }

  validate(mapped: Partial<SerializedAnnotation>): string[] {
    const errors: string[] = [];

    if (!mapped.id) {
      errors.push('Missing annotation ID');
    }

    if (!mapped.type) {
      errors.push('Missing annotation type');
    }

    if (!mapped.viewportInfo?.imageId && this.config.validationLevel === 'strict') {
      errors.push('Missing image ID');
    }

    return errors;
  }

  private mapAnnotationType(sourceType: string): AnnotationType {
    // Map common type variations
    const typeMap: Record<string, AnnotationType> = {
      'length': AnnotationType.LENGTH,
      'line': AnnotationType.LENGTH,
      'distance': AnnotationType.LENGTH,
      'area': AnnotationType.AREA,
      'region': AnnotationType.AREA,
      'volume': AnnotationType.AREA,
      '3d-volume': AnnotationType.AREA,
      'angle': AnnotationType.ANGLE,
      'text': AnnotationType.TEXT,
      'annotation': AnnotationType.TEXT,
      'comment': AnnotationType.TEXT,
      'arrow': AnnotationType.ARROW,
      'pointer': AnnotationType.ARROW,
      'point': AnnotationType.PROBE,
      'marker': AnnotationType.PROBE,
      'circle': AnnotationType.ELLIPSE,
      'ellipse': AnnotationType.ELLIPSE,
      'rectangle': AnnotationType.RECTANGLE,
      'rect': AnnotationType.RECTANGLE,
      'polygon': AnnotationType.FREEHAND,
      'freehand': AnnotationType.FREEHAND,
      'spline': AnnotationType.FREEHAND,
    };

    const normalizedType = sourceType.toLowerCase().replace(/[_-]/g, '');
    // eslint-disable-next-line security/detect-object-injection
    return typeMap[normalizedType] || AnnotationType.TEXT;
  }

  private sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
    // Apply field mappings if configured
    if (this.config.fieldMappings) {
      const mappedData: Record<string, unknown> = {};

      Object.entries(data).forEach(([key, value]) => {
        // eslint-disable-next-line security/detect-object-injection
        const mappedKey = this.config.fieldMappings![key] || key;
        // eslint-disable-next-line security/detect-object-injection
        mappedData[mappedKey] = value;
      });

      return mappedData;
    }

    return data;
  }

  private generateId(): string {
    return `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * CSV format mapper
 */
export class CSVFieldMapper implements FieldMapper {
  private config: ImportConfig;
  private headers: string[];

  constructor(config: ImportConfig, headers: string[]) {
    this.config = config;
    this.headers = headers;
  }

  mapAnnotation(csvRow: string[]): Partial<SerializedAnnotation> {
    const data: Record<string, unknown> = {};

    // Map CSV columns to object properties
    csvRow.forEach((value, index) => {
      if (index < this.headers.length) {
        // eslint-disable-next-line security/detect-object-injection
        const header = this.headers[index];
        // eslint-disable-next-line security/detect-object-injection
        data[header] = this.parseValue(value);
      }
    });

    const mapped: Partial<SerializedAnnotation> = {
      id: String(data.id || data.ID || this.generateId()),
      type: this.mapAnnotationType(String(data.type || data.Type || 'text')),
      data: this.extractAnnotationData(data),
      viewportInfo: {
        viewportId: String(data.viewportId || data.ViewportId || 'imported'),
        imageId: String(data.imageId || data.ImageId || ''),
        seriesInstanceUID: data.seriesInstanceUID as string,
        studyInstanceUID: data.studyInstanceUID as string,
        frameNumber: data.frameNumber as number,
      },
      state: {
        visible: this.parseBoolean(data.visible, true),
        selected: false,
        locked: this.parseBoolean(data.locked, false),
        active: false,
        zIndex: this.parseNumber(data.zIndex, 100),
      },
    };

    return mapped;
  }

  mapMetadata(csvRow: string[]): SerializedAnnotation['metadata'] {
    const data: Record<string, unknown> = {};

    csvRow.forEach((value, index) => {
      if (index < this.headers.length) {
        // eslint-disable-next-line security/detect-object-injection
        data[this.headers[index]] = this.parseValue(value);
      }
    });

    return {
      createdAt: this.parseDate(data.createdAt || data.CreatedAt) || new Date(),
      updatedAt: this.parseDate(data.updatedAt || data.UpdatedAt) || new Date(),
      createdBy: String(data.createdBy || data.CreatedBy || 'imported'),
      version: String(data.version || data.Version || '1.0.0'),
      tags: this.parseArray(data.tags || data.Tags),
      description: String(data.description || data.Description || ''),
    };
  }

  mapStyling(): AnnotationStyling | null {
    // CSV typically doesn't contain styling information
    // Could potentially be configured through this.config in future
    if (this.config.autoAssignStyles) {
      // Future: could return default styling based on config
    }
    return null;
  }

  validate(mapped: Partial<SerializedAnnotation>): string[] {
    const errors: string[] = [];

    if (!mapped.id) {
      errors.push('Missing annotation ID');
    }

    if (!mapped.type) {
      errors.push('Missing annotation type');
    }

    return errors;
  }

  private extractAnnotationData(data: Record<string, unknown>): Record<string, unknown> {
    const annotationData: Record<string, unknown> = {};

    // Extract coordinate data
    if (data.x1 !== undefined && data.y1 !== undefined) {
      annotationData.points = [];
      if (data.x2 !== undefined && data.y2 !== undefined) {
        annotationData.points = [[data.x1, data.y1], [data.x2, data.y2]];
      } else {
        annotationData.points = [[data.x1, data.y1]];
      }
    }

    // Extract measurement data
    if (data.value !== undefined) {
      annotationData.measurements = {
        value: this.parseNumber(data.value),
        unit: data.unit || 'mm',
      };
    }

    // Extract text data
    if (data.text !== undefined) {
      annotationData.text = String(data.text);
    }

    return annotationData;
  }

  private mapAnnotationType(type: string): AnnotationType {
    // Similar to JSON mapper
    const typeMap: Record<string, AnnotationType> = {
      'length': AnnotationType.LENGTH,
      'area': AnnotationType.AREA,
      'volume': AnnotationType.AREA,
      'angle': AnnotationType.ANGLE,
      'text': AnnotationType.TEXT,
      'arrow': AnnotationType.ARROW,
      'point': AnnotationType.PROBE,
      'circle': AnnotationType.ELLIPSE,
      'ellipse': AnnotationType.ELLIPSE,
      'rectangle': AnnotationType.RECTANGLE,
      'polygon': AnnotationType.FREEHAND,
      'spline': AnnotationType.FREEHAND,
    };

    return typeMap[type.toLowerCase()] || AnnotationType.TEXT;
  }

  private parseValue(value: string): unknown {
    // Try to parse as number
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      return numValue;
    }

    // Try to parse as boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Return as string
    return value;
  }

  private parseBoolean(value: unknown, defaultValue: boolean = false): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return defaultValue;
  }

  private parseNumber(value: unknown, defaultValue: number = 0): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? defaultValue : parsed;
    }
    return defaultValue;
  }

  private parseDate(value: unknown): Date | null {
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  private parseArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string') {
      return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }
    return [];
  }

  private generateId(): string {
    return `csv-import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Annotation Import Service
 */
export class AnnotationImportService {
  private static instance: AnnotationImportService;
  private fieldMappers: Map<ImportSourceType, (config: ImportConfig, ...args: any[]) => FieldMapper> = new Map();

  private constructor() {
    this.initializeMappers();
    log.info('Annotation Import Service initialized', {
      component: 'AnnotationImportService',
    });
  }

  static getInstance(): AnnotationImportService {
    if (!AnnotationImportService.instance) {
      AnnotationImportService.instance = new AnnotationImportService();
    }
    return AnnotationImportService.instance;
  }

  /**
   * Initialize field mappers
   */
  private initializeMappers(): void {
    this.fieldMappers.set(ImportSourceType.JSON, (config) => new JSONFieldMapper(config));
    this.fieldMappers.set(ImportSourceType.CSV, (config, headers) => new CSVFieldMapper(config, headers));
    // Add more mappers as needed
  }

  /**
   * Import annotations from file
   */
  async importFromFile(
    file: File,
    config: ImportConfig,
  ): Promise<ImportResult> {
    const startTime = Date.now();

    try {
      // Read file content
      const content = await this.readFile(file);

      // Parse content based on source type
      const sourceData = await this.parseContent(content, config.sourceType);

      // Import parsed data
      const result = await this.importFromData(sourceData, config);

      // Update processing time
      result.statistics.processingTime = Date.now() - startTime;

      log.info(`Import completed: ${result.statistics.successfulImports}/${result.statistics.totalProcessed} annotations`, {
        component: 'AnnotationImportService',
        metadata: { successfulImports: result.statistics.successfulImports, totalProcessed: result.statistics.totalProcessed },
      });

      return result;

    } catch (error) {
      console.error('Import failed:', error);
      return {
        success: false,
        validation: {
          isValid: false,
          errors: [String(error)],
          warnings: [],
          validAnnotations: [],
          failedAnnotations: [],
        },
        importedAnnotations: [],
        conflicts: [],
        statistics: {
          totalProcessed: 0,
          successfulImports: 0,
          failedImports: 1,
          duplicatesFound: 0,
          conflictsResolved: 0,
          processingTime: Date.now() - startTime,
        },
        metadata: {
          sourceType: config.sourceType,
          importedAt: new Date(),
        },
      };
    }
  }

  /**
   * Import annotations from data
   */
  async importFromData(
    sourceData: any,
    config: ImportConfig,
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const result: ImportResult = {
      success: false,
      validation: {
        isValid: true,
        errors: [],
        warnings: [],
        validAnnotations: [],
        failedAnnotations: [],
      },
      importedAnnotations: [],
      conflicts: [],
      statistics: {
        totalProcessed: 0,
        successfulImports: 0,
        failedImports: 0,
        duplicatesFound: 0,
        conflictsResolved: 0,
        processingTime: 0,
      },
      metadata: {
        sourceType: config.sourceType,
        importedAt: new Date(),
        sourceInfo: this.extractSourceInfo(sourceData),
      },
    };

    try {
      // Get field mapper
      const mapperFactory = this.fieldMappers.get(config.sourceType);
      if (!mapperFactory) {
        throw new Error(`Unsupported source type: ${config.sourceType}`);
      }

      const mapper = mapperFactory(config, ...this.getMapperArgs(sourceData, config.sourceType));

      // Process source data
      const annotations = await this.processSourceData(sourceData, mapper, config);
      result.statistics.totalProcessed = annotations.length;

      // Validate annotations
      const validationResult = await this.validateAnnotations(annotations, config);
      result.validation = validationResult;

      // Handle conflicts and merging
      const { importedAnnotations, conflicts } = await this.handleConflicts(
        validationResult.validAnnotations,
        config,
      );

      result.importedAnnotations = importedAnnotations;
      result.conflicts = conflicts;
      result.statistics.successfulImports = importedAnnotations.length;
      result.statistics.failedImports = validationResult.failedAnnotations.length;
      result.statistics.conflictsResolved = conflicts.filter(c => c.suggestedResolution !== 'manual').length;

      // Apply auto-styling if enabled
      if (config.autoAssignStyles) {
        await this.applyAutoStyling(result.importedAnnotations, config);
      }

      result.success = result.statistics.successfulImports > 0;
      result.statistics.processingTime = Date.now() - startTime;

      return result;

    } catch (error) {
      console.error('Import processing failed:', error);
      result.validation.errors.push(String(error));
      result.statistics.processingTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Import annotations from URL
   */
  async importFromURL(
    url: string,
    config: ImportConfig,
  ): Promise<ImportResult> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      const sourceData = await this.parseContent(content, config.sourceType);

      return this.importFromData(sourceData, config);

    } catch (error) {
      console.error('URL import failed:', error);
      throw error;
    }
  }

  /**
   * Read file content
   */
  private readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Parse content based on source type
   */
  private async parseContent(
    content: string,
    sourceType: ImportSourceType,
  ): Promise<any> {
    switch (sourceType) {
      case ImportSourceType.JSON:
        return JSON.parse(content);

      case ImportSourceType.CSV:
        return this.parseCSV(content);

      case ImportSourceType.XML:
        return this.parseXML(content);

      default:
        throw new Error(`Unsupported source type: ${sourceType}`);
    }
  }

  /**
   * Parse CSV content
   */
  private parseCSV(content: string): { headers: string[]; rows: string[][] } {
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) {
      throw new Error('Empty CSV file');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map(line =>
      line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')),
    );

    return { headers, rows };
  }

  /**
   * Parse XML content
   */
  private parseXML(content: string): any {
    // Simplified XML parsing - in production, use a proper XML parser
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, 'text/xml');

    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Invalid XML format');
    }

    return this.xmlToJson(xmlDoc.documentElement);
  }

  /**
   * Convert XML to JSON
   */
  private xmlToJson(xml: Element): any {
    const result: any = {};

    // Attributes
    if (xml.attributes && xml.attributes.length > 0) {
      result['@attributes'] = {};
      for (let i = 0; i < xml.attributes.length; i++) {
        // eslint-disable-next-line security/detect-object-injection
        const attr = xml.attributes[i];

        result['@attributes'][attr.nodeName] = attr.nodeValue;
      }
    }

    // Child nodes
    if (xml.childNodes && xml.childNodes.length > 0) {
      for (let i = 0; i < xml.childNodes.length; i++) {
        // eslint-disable-next-line security/detect-object-injection
        const child = xml.childNodes[i];

        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.nodeValue?.trim();
          if (text) {

            result['#text'] = text;
          }
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const childName = child.nodeName;

          const childValue = this.xmlToJson(child as Element);

          // eslint-disable-next-line security/detect-object-injection
          if (result[childName]) {
            // eslint-disable-next-line security/detect-object-injection
            if (!Array.isArray(result[childName])) {
              // eslint-disable-next-line security/detect-object-injection
              result[childName] = [result[childName]];
            }
            // eslint-disable-next-line security/detect-object-injection
            result[childName].push(childValue);
          } else {
            // eslint-disable-next-line security/detect-object-injection
            result[childName] = childValue;
          }
        }
      }
    }

    return result;
  }

  /**
   * Get mapper arguments
   */
  private getMapperArgs(sourceData: any, sourceType: ImportSourceType): any[] {
    switch (sourceType) {
      case ImportSourceType.CSV:
        return [sourceData.headers];
      default:
        return [];
    }
  }

  /**
   * Process source data with mapper
   */
  private async processSourceData(
    sourceData: any,
    mapper: FieldMapper,
    config: ImportConfig,
  ): Promise<SerializedAnnotation[]> {
    const annotations: SerializedAnnotation[] = [];

    if (config.sourceType === ImportSourceType.JSON) {
      // Handle AnnotationExport format
      if (sourceData.annotations && Array.isArray(sourceData.annotations)) {
        for (const item of sourceData.annotations) {
          try {
            const mapped = mapper.mapAnnotation(item);
            const metadata = mapper.mapMetadata(item);
            const styling = mapper.mapStyling(item);

            const annotation: SerializedAnnotation = {
              ...mapped,
              metadata,
              styling: styling || this.getDefaultStyling(mapped.type!),
            } as SerializedAnnotation;

            if (this.passesFilters(annotation, config)) {
              annotations.push(annotation);
            }
          } catch (error) {
            console.warn('Failed to process annotation:', error);
          }
        }
      }

    } else if (config.sourceType === ImportSourceType.CSV) {
      // Handle CSV format
      const { rows } = sourceData;
      for (const row of rows) {
        try {
          const mapped = mapper.mapAnnotation(row);
          const metadata = mapper.mapMetadata(row);
          const styling = mapper.mapStyling(row);

          const annotation: SerializedAnnotation = {
            ...mapped,
            metadata,
            styling: styling || this.getDefaultStyling(mapped.type!),
          } as SerializedAnnotation;

          if (this.passesFilters(annotation, config)) {
            annotations.push(annotation);
          }
        } catch (error) {
          console.warn('Failed to process CSV row:', error);
        }
      }
    }

    return annotations;
  }

  /**
   * Validate annotations
   */
  private async validateAnnotations(
    annotations: SerializedAnnotation[],
    config: ImportConfig,
  ): Promise<ImportValidation> {
    const validAnnotations: SerializedAnnotation[] = [];
    const failedAnnotations: ImportValidation['failedAnnotations'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const annotation of annotations) {
      try {
        // Use persistence service validation
        const exportData = {
          annotations: [annotation],
          version: '1.0.0',
          exportedAt: new Date(),
          metadata: {
            exportedBy: 'Import Service',
            application: 'Cornerstone3D',
            applicationVersion: '1.0.0',
            totalCount: 1,
            categories: [],
            types: [annotation.type],
          },
          styles: [],
          checksum: '',
        };

        const validation = annotationPersistenceService.importFromJSON(exportData);

        if (validation.isValid) {
          validAnnotations.push(annotation);
        } else {
          failedAnnotations.push({
            annotation,
            reason: validation.errors.join(', '),
          });

          if (config.validationLevel === 'strict') {
            errors.push(...validation.errors);
          } else {
            warnings.push(...validation.errors);
          }
        }

      } catch (error) {
        failedAnnotations.push({
          annotation,
          reason: String(error),
        });

        if (config.validationLevel === 'strict') {
          errors.push(String(error));
        } else {
          warnings.push(String(error));
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validAnnotations,
      failedAnnotations,
    };
  }

  /**
   * Handle conflicts and merging
   */
  private async handleConflicts(
    annotations: SerializedAnnotation[],
    config: ImportConfig,
  ): Promise<{ importedAnnotations: SerializedAnnotation[]; conflicts: ImportConflict[] }> {
    const importedAnnotations: SerializedAnnotation[] = [];
    const conflicts: ImportConflict[] = [];

    // For now, simply import all valid annotations
    // In a full implementation, this would check for existing annotations
    // and handle conflicts based on the merge strategy

    for (const annotation of annotations) {
      switch (config.mergeStrategy) {
        case 'replace':
        case 'merge':
        case 'skip':
          importedAnnotations.push(annotation);
          break;

        case 'prompt':
          // Would require user interaction in a real implementation
          importedAnnotations.push(annotation);
          break;
      }
    }

    return { importedAnnotations, conflicts };
  }

  /**
   * Apply auto-styling
   */
  private async applyAutoStyling(
    annotations: SerializedAnnotation[],
    config: ImportConfig,
  ): Promise<void> {
    for (const annotation of annotations) {
      if (!annotation.styling || !annotation.styling.id) {
        const defaultStyleId = config.defaultStyleMappings[annotation.type];
        if (defaultStyleId) {
          const style = styleManager.getStyle(defaultStyleId);
          if (style) {
            annotation.styling = style;
          }
        }
      }
    }
  }

  /**
   * Check if annotation passes filters
   */
  private passesFilters(annotation: SerializedAnnotation, config: ImportConfig): boolean {
    const filters = config.filters;
    if (!filters) return true;

    // Type filter
    if (filters.annotationTypes && !filters.annotationTypes.includes(annotation.type)) {
      return false;
    }

    // Date range filter
    if (filters.dateRange) {
      const createdAt = new Date(annotation.metadata.createdAt);
      if (createdAt < filters.dateRange.start || createdAt > filters.dateRange.end) {
        return false;
      }
    }

    // User filter
    if (filters.userFilter && !filters.userFilter.includes(annotation.metadata.createdBy)) {
      return false;
    }

    // Tag filter
    if (filters.tagFilter && annotation.metadata.tags) {
      const hasMatchingTag = filters.tagFilter.some(tag =>
        annotation.metadata.tags!.includes(tag),
      );
      if (!hasMatchingTag) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get default styling for annotation type
   */
  private getDefaultStyling(type: AnnotationType): AnnotationStyling {
    const presets = styleManager.getPresetsByType(type);
    if (presets.length > 0) {
      return presets[0].styling;
    }

    // Fallback default styling
    return styleManager.createStyle({
      name: `Default ${type}`,
      compatibleTypes: [type],
    });
  }

  /**
   * Extract source info from data
   */
  private extractSourceInfo(sourceData: any): any {
    if (sourceData.metadata) {
      return {
        application: sourceData.metadata.application,
        version: sourceData.metadata.applicationVersion,
        exportedAt: sourceData.exportedAt,
        totalCount: sourceData.metadata.totalCount,
      };
    }

    return {
      dataKeys: Object.keys(sourceData),
      estimatedSize: JSON.stringify(sourceData).length,
    };
  }

  /**
   * Register custom field mapper
   */
  registerMapper(
    sourceType: ImportSourceType,
    mapperFactory: (config: ImportConfig, ...args: any[]) => FieldMapper,
  ): void {
    this.fieldMappers.set(sourceType, mapperFactory);
    log.info(`Registered custom mapper for ${sourceType}`, {
      component: 'AnnotationImportService',
      metadata: { sourceType },
    });
  }

  /**
   * Get supported source types
   */
  getSupportedSourceTypes(): ImportSourceType[] {
    return Array.from(this.fieldMappers.keys());
  }
}

// Export singleton instance
export const annotationImportService = AnnotationImportService.getInstance();
