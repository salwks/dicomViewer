/**
 * Annotation Persistence Manager
 *
 * Unified interface for all annotation persistence operations
 * Integrates all persistence services into a cohesive system
 */

import {
  SerializedAnnotation,
  AnnotationExport,
  PersistenceOptions,
  annotationPersistenceService,
  AnnotationPersistenceService,
} from './annotationPersistence';
import { viewportPersistenceService, ViewportPersistenceService } from './viewportPersistence';
import { undoRedoManager, UndoRedoManager, Command, CommandType } from './undoRedoManager';
import { pdfExportService, PDFExportService, PDFExportOptions } from './pdfExporter';
import { dicomSRExporter, DicomSRExporter, SRExportOptions } from './dicomSRExporter';
import { annotationImportService, AnnotationImportService, ImportConfig, ImportResult } from './annotationImporter';
import { log } from '../utils/logger';

/**
 * Persistence manager configuration
 */
export interface PersistenceManagerConfig {
  /** Enable automatic viewport persistence */
  enableViewportPersistence: boolean;
  /** Enable undo/redo functionality */
  enableUndoRedo: boolean;
  /** Auto-save interval in milliseconds */
  autoSaveInterval: number;
  /** Default export options */
  defaultExportOptions: {
    pdf: Partial<PDFExportOptions>;
    dicomSR: Partial<SRExportOptions>;
  };
  /** Default import configuration */
  defaultImportConfig: Partial<ImportConfig>;
  /** Notification callbacks */
  callbacks?: {
    onAnnotationSaved?: (annotation: SerializedAnnotation) => void;
    onAnnotationLoaded?: (annotations: SerializedAnnotation[]) => void;
    onExportCompleted?: (type: string, result: any) => void;
    onImportCompleted?: (result: ImportResult) => void;
    onError?: (error: Error, operation: string) => void;
  };
}

/**
 * Operation result
 */
export interface OperationResult<T = any> {
  /** Success status */
  success: boolean;
  /** Result data */
  data?: T;
  /** Error message */
  error?: string;
  /** Operation metadata */
  metadata?: {
    operation: string;
    timestamp: Date;
    duration: number;
  };
}

/**
 * Annotation command for undo/redo
 */
export class AnnotationCommand implements Command {
  public readonly id: string;
  public readonly type: CommandType;
  public readonly description: string;
  public readonly metadata: Command['metadata'];

  private operation: 'create' | 'update' | 'delete';
  private annotation: SerializedAnnotation;
  private previousState?: SerializedAnnotation;
  private manager: AnnotationPersistenceManager;

  constructor(
    operation: 'create' | 'update' | 'delete',
    annotation: SerializedAnnotation,
    manager: AnnotationPersistenceManager,
    previousState?: SerializedAnnotation,
  ) {
    this.id = `annotation-${operation}-${annotation.id}-${Date.now()}`;
    this.type = this.mapOperationType(operation);
    this.description = `${operation} ${annotation.type} annotation`;
    this.operation = operation;
    this.annotation = annotation;
    this.previousState = previousState;
    this.manager = manager;

    this.metadata = {
      timestamp: new Date(),
      affectedAnnotations: [annotation.id],
      context: {
        viewportId: annotation.viewportInfo.viewportId,
        imageId: annotation.viewportInfo.imageId,
        seriesInstanceUID: annotation.viewportInfo.seriesInstanceUID,
      },
    };
  }

  async execute(): Promise<void> {
    switch (this.operation) {
      case 'create':
        await this.manager.createAnnotationInternal(this.annotation);
        break;
      case 'update':
        await this.manager.updateAnnotationInternal(this.annotation);
        break;
      case 'delete':
        await this.manager.deleteAnnotationInternal(this.annotation.id);
        break;
    }
  }

  async undo(): Promise<void> {
    switch (this.operation) {
      case 'create':
        await this.manager.deleteAnnotationInternal(this.annotation.id);
        break;
      case 'update':
        if (this.previousState) {
          await this.manager.updateAnnotationInternal(this.previousState);
        }
        break;
      case 'delete':
        await this.manager.createAnnotationInternal(this.annotation);
        break;
    }
  }

  canUndo(): boolean {
    return true;
  }

  canRedo(): boolean {
    return true;
  }

  private mapOperationType(operation: string): CommandType {
    switch (operation) {
      case 'create': return CommandType.CREATE_ANNOTATION;
      case 'update': return CommandType.UPDATE_ANNOTATION;
      case 'delete': return CommandType.DELETE_ANNOTATION;
      default: return CommandType.UPDATE_ANNOTATION;
    }
  }
}

/**
 * Annotation Persistence Manager
 */
export class AnnotationPersistenceManager {
  private static instance: AnnotationPersistenceManager;
  private config: PersistenceManagerConfig;
  private isInitialized = false;
  private eventListeners: Map<string, Function[]> = new Map();

  // Service references
  private persistenceService: AnnotationPersistenceService;
  private viewportService: ViewportPersistenceService;
  private undoRedoService: UndoRedoManager;
  private pdfService: PDFExportService;
  private dicomService: DicomSRExporter;
  private importService: AnnotationImportService;

  private constructor(config?: Partial<PersistenceManagerConfig>) {
    this.config = {
      enableViewportPersistence: true,
      enableUndoRedo: true,
      autoSaveInterval: 30000,
      defaultExportOptions: {
        pdf: {
          orientation: 'portrait',
          format: 'A4',
          includePatientInfo: true,
          includeMeasurements: true,
        },
        dicomSR: {
          includePatientInfo: true,
          includeMeasurements: true,
          verificationFlag: 'UNVERIFIED',
        },
      },
      defaultImportConfig: {
        sourceType: 'json' as any,
        mergeStrategy: 'merge',
        validationLevel: 'moderate',
        autoAssignStyles: true,
        defaultStyleMappings: {} as any,
      },
      ...config,
    };

    // Initialize service references
    this.persistenceService = annotationPersistenceService;
    this.viewportService = viewportPersistenceService;
    this.undoRedoService = undoRedoManager;
    this.pdfService = pdfExportService;
    this.dicomService = dicomSRExporter;
    this.importService = annotationImportService;

    log.info('🔧 Annotation Persistence Manager initialized');
  }

  static getInstance(config?: Partial<PersistenceManagerConfig>): AnnotationPersistenceManager {
    if (!AnnotationPersistenceManager.instance) {
      AnnotationPersistenceManager.instance = new AnnotationPersistenceManager(config);
    }
    return AnnotationPersistenceManager.instance;
  }

  /**
   * Initialize the manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize all services
      await this.persistenceService.initialize();

      if (this.config.enableViewportPersistence) {
        await this.viewportService.initialize();
      }

      this.isInitialized = true;
      this.emit('initialized', { timestamp: new Date() });

      log.info('🔧 Annotation Persistence Manager ready');
    } catch (error) {
      log.error('Failed to initialize persistence manager:', undefined, error as Error);
      throw error;
    }
  }

  /* =============================================================================
   * ANNOTATION MANAGEMENT
   * ============================================================================= */

  /**
   * Create annotation with undo/redo support
   */
  async createAnnotation(annotation: SerializedAnnotation): Promise<OperationResult<SerializedAnnotation>> {
    const startTime = Date.now();

    try {
      if (this.config.enableUndoRedo) {
        const command = new AnnotationCommand('create', annotation, this);
        await this.undoRedoService.executeCommand(command);
      } else {
        await this.createAnnotationInternal(annotation);
      }

      this.config.callbacks?.onAnnotationSaved?.(annotation);
      this.emit('annotationCreated', { annotation });

      return {
        success: true,
        data: annotation,
        metadata: {
          operation: 'createAnnotation',
          timestamp: new Date(),
          duration: Date.now() - startTime,
        },
      };

    } catch (error) {
      const errorMsg = `Failed to create annotation: ${error}`;
      this.config.callbacks?.onError?.(error as Error, 'createAnnotation');
      log.error(errorMsg);

      return {
        success: false,
        error: errorMsg,
        metadata: {
          operation: 'createAnnotation',
          timestamp: new Date(),
          duration: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Update annotation with undo/redo support
   */
  async updateAnnotation(annotation: SerializedAnnotation): Promise<OperationResult<SerializedAnnotation>> {
    const startTime = Date.now();

    try {
      let previousState: SerializedAnnotation | undefined;

      if (this.config.enableUndoRedo) {
        // Get current state for undo
        const currentAnnotations = await this.persistenceService.loadAnnotations(annotation.id);
        previousState = currentAnnotations.find(a => a.id === annotation.id);

        const command = new AnnotationCommand('update', annotation, this, previousState);
        await this.undoRedoService.executeCommand(command);
      } else {
        await this.updateAnnotationInternal(annotation);
      }

      this.config.callbacks?.onAnnotationSaved?.(annotation);
      this.emit('annotationUpdated', { annotation, previousState });

      return {
        success: true,
        data: annotation,
        metadata: {
          operation: 'updateAnnotation',
          timestamp: new Date(),
          duration: Date.now() - startTime,
        },
      };

    } catch (error) {
      const errorMsg = `Failed to update annotation: ${error}`;
      this.config.callbacks?.onError?.(error as Error, 'updateAnnotation');
      log.error(errorMsg);

      return {
        success: false,
        error: errorMsg,
        metadata: {
          operation: 'updateAnnotation',
          timestamp: new Date(),
          duration: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Delete annotation with undo/redo support
   */
  async deleteAnnotation(annotationId: string): Promise<OperationResult<void>> {
    const startTime = Date.now();

    try {
      // Get annotation for undo if needed
      let annotation: SerializedAnnotation | undefined;

      if (this.config.enableUndoRedo) {
        const annotations = await this.persistenceService.loadAnnotations(annotationId);
        annotation = annotations.find(a => a.id === annotationId);

        if (annotation) {
          const command = new AnnotationCommand('delete', annotation, this);
          await this.undoRedoService.executeCommand(command);
        }
      } else {
        await this.deleteAnnotationInternal(annotationId);
      }

      this.emit('annotationDeleted', { annotationId, annotation });

      return {
        success: true,
        metadata: {
          operation: 'deleteAnnotation',
          timestamp: new Date(),
          duration: Date.now() - startTime,
        },
      };

    } catch (error) {
      const errorMsg = `Failed to delete annotation: ${error}`;
      this.config.callbacks?.onError?.(error as Error, 'deleteAnnotation');
      log.error(errorMsg);

      return {
        success: false,
        error: errorMsg,
        metadata: {
          operation: 'deleteAnnotation',
          timestamp: new Date(),
          duration: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Load annotations for key
   */
  async loadAnnotations(key: string): Promise<OperationResult<SerializedAnnotation[]>> {
    const startTime = Date.now();

    try {
      const annotations = await this.persistenceService.loadAnnotations(key);

      this.config.callbacks?.onAnnotationLoaded?.(annotations);
      this.emit('annotationsLoaded', { key, annotations, count: annotations.length });

      return {
        success: true,
        data: annotations,
        metadata: {
          operation: 'loadAnnotations',
          timestamp: new Date(),
          duration: Date.now() - startTime,
        },
      };

    } catch (error) {
      const errorMsg = `Failed to load annotations: ${error}`;
      this.config.callbacks?.onError?.(error as Error, 'loadAnnotations');
      log.error(errorMsg);

      return {
        success: false,
        error: errorMsg,
        metadata: {
          operation: 'loadAnnotations',
          timestamp: new Date(),
          duration: Date.now() - startTime,
        },
      };
    }
  }

  /* =============================================================================
   * VIEWPORT INTEGRATION
   * ============================================================================= */

  /**
   * Register viewport for persistence
   */
  registerViewport(viewportId: string, initialState: any): void {
    if (this.config.enableViewportPersistence) {
      this.viewportService.registerViewport(viewportId, initialState);
    }
  }

  /**
   * Update viewport state
   */
  updateViewportState(viewportId: string, updates: any): void {
    if (this.config.enableViewportPersistence) {
      this.viewportService.updateViewportState(viewportId, updates);
    }
  }

  /**
   * Get viewport annotations
   */
  async getViewportAnnotations(viewportId: string): Promise<OperationResult<SerializedAnnotation[]>> {
    const startTime = Date.now();

    try {
      let annotations: SerializedAnnotation[] = [];

      if (this.config.enableViewportPersistence) {
        annotations = await this.viewportService.getViewportAnnotations(viewportId);
      }

      return {
        success: true,
        data: annotations,
        metadata: {
          operation: 'getViewportAnnotations',
          timestamp: new Date(),
          duration: Date.now() - startTime,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to get viewport annotations: ${error}`,
        metadata: {
          operation: 'getViewportAnnotations',
          timestamp: new Date(),
          duration: Date.now() - startTime,
        },
      };
    }
  }

  /* =============================================================================
   * UNDO/REDO OPERATIONS
   * ============================================================================= */

  /**
   * Undo last operation
   */
  async undo(): Promise<OperationResult<boolean>> {
    if (!this.config.enableUndoRedo) {
      return { success: false, error: 'Undo/Redo is disabled' };
    }

    const startTime = Date.now();
    const success = await this.undoRedoService.undo();

    return {
      success,
      data: success,
      metadata: {
        operation: 'undo',
        timestamp: new Date(),
        duration: Date.now() - startTime,
      },
    };
  }

  /**
   * Redo last operation
   */
  async redo(): Promise<OperationResult<boolean>> {
    if (!this.config.enableUndoRedo) {
      return { success: false, error: 'Undo/Redo is disabled' };
    }

    const startTime = Date.now();
    const success = await this.undoRedoService.redo();

    return {
      success,
      data: success,
      metadata: {
        operation: 'redo',
        timestamp: new Date(),
        duration: Date.now() - startTime,
      },
    };
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.config.enableUndoRedo && this.undoRedoService.canUndo();
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.config.enableUndoRedo && this.undoRedoService.canRedo();
  }

  /* =============================================================================
   * EXPORT OPERATIONS
   * ============================================================================= */

  /**
   * Export to PDF
   */
  async exportToPDF(
    annotationData: AnnotationExport,
    options?: PDFExportOptions,
  ): Promise<OperationResult<Blob>> {
    const startTime = Date.now();

    try {
      const mergedOptions = { ...this.config.defaultExportOptions.pdf, ...options };
      const blob = await this.pdfService.exportToPDF(annotationData, mergedOptions);

      this.config.callbacks?.onExportCompleted?.(
        'pdf',
        { blob, size: blob.size, annotationCount: annotationData.annotations.length },
      );

      return {
        success: true,
        data: blob,
        metadata: {
          operation: 'exportToPDF',
          timestamp: new Date(),
          duration: Date.now() - startTime,
        },
      };

    } catch (error) {
      const errorMsg = `PDF export failed: ${error}`;
      this.config.callbacks?.onError?.(error as Error, 'exportToPDF');

      return {
        success: false,
        error: errorMsg,
        metadata: {
          operation: 'exportToPDF',
          timestamp: new Date(),
          duration: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Export to DICOM SR
   */
  async exportToDicomSR(
    annotationData: AnnotationExport,
    options?: SRExportOptions,
  ): Promise<OperationResult<any>> {
    const startTime = Date.now();

    try {
      const mergedOptions = { ...this.config.defaultExportOptions.dicomSR, ...options };
      const srDocument = this.dicomService.exportToSR(annotationData, mergedOptions);

      this.config.callbacks?.onExportCompleted?.(
        'dicom-sr',
        { document: srDocument, annotationCount: annotationData.annotations.length },
      );

      return {
        success: true,
        data: srDocument,
        metadata: {
          operation: 'exportToDicomSR',
          timestamp: new Date(),
          duration: Date.now() - startTime,
        },
      };

    } catch (error) {
      const errorMsg = `DICOM SR export failed: ${error}`;
      this.config.callbacks?.onError?.(error as Error, 'exportToDicomSR');

      return {
        success: false,
        error: errorMsg,
        metadata: {
          operation: 'exportToDicomSR',
          timestamp: new Date(),
          duration: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Export to JSON
   */
  async exportToJSON(
    key: string,
    options?: PersistenceOptions,
  ): Promise<OperationResult<AnnotationExport>> {
    const startTime = Date.now();

    try {
      // First load the annotations for the key
      const annotations = await this.persistenceService.loadAnnotations(key);
      const exportData = await this.persistenceService.exportToJSON(annotations, options);

      this.config.callbacks?.onExportCompleted?.(
        'json',
        { data: exportData, annotationCount: exportData.annotations.length },
      );

      return {
        success: true,
        data: exportData,
        metadata: {
          operation: 'exportToJSON',
          timestamp: new Date(),
          duration: Date.now() - startTime,
        },
      };

    } catch (error) {
      const errorMsg = `JSON export failed: ${error}`;
      this.config.callbacks?.onError?.(error as Error, 'exportToJSON');

      return {
        success: false,
        error: errorMsg,
        metadata: {
          operation: 'exportToJSON',
          timestamp: new Date(),
          duration: Date.now() - startTime,
        },
      };
    }
  }

  /* =============================================================================
   * IMPORT OPERATIONS
   * ============================================================================= */

  /**
   * Import from file
   */
  async importFromFile(file: File, config?: ImportConfig): Promise<OperationResult<ImportResult>> {
    const startTime = Date.now();

    try {
      const mergedConfig = { ...this.config.defaultImportConfig, ...config };
      const result = await this.importService.importFromFile(file, mergedConfig as ImportConfig);

      this.config.callbacks?.onImportCompleted?.(result);

      return {
        success: result.success,
        data: result,
        error: result.success ? undefined : 'Import failed',
        metadata: {
          operation: 'importFromFile',
          timestamp: new Date(),
          duration: Date.now() - startTime,
        },
      };

    } catch (error) {
      const errorMsg = `Import failed: ${error}`;
      this.config.callbacks?.onError?.(error as Error, 'importFromFile');

      return {
        success: false,
        error: errorMsg,
        metadata: {
          operation: 'importFromFile',
          timestamp: new Date(),
          duration: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Import from URL
   */
  async importFromURL(url: string, config?: ImportConfig): Promise<OperationResult<ImportResult>> {
    const startTime = Date.now();

    try {
      const mergedConfig = { ...this.config.defaultImportConfig, ...config };
      const result = await this.importService.importFromURL(url, mergedConfig as ImportConfig);

      this.config.callbacks?.onImportCompleted?.(result);

      return {
        success: result.success,
        data: result,
        error: result.success ? undefined : 'Import failed',
        metadata: {
          operation: 'importFromURL',
          timestamp: new Date(),
          duration: Date.now() - startTime,
        },
      };

    } catch (error) {
      const errorMsg = `URL import failed: ${error}`;
      this.config.callbacks?.onError?.(error as Error, 'importFromURL');

      return {
        success: false,
        error: errorMsg,
        metadata: {
          operation: 'importFromURL',
          timestamp: new Date(),
          duration: Date.now() - startTime,
        },
      };
    }
  }

  /* =============================================================================
   * INTERNAL OPERATIONS (used by commands)
   * ============================================================================= */

  /**
   * Internal create annotation (bypasses undo/redo)
   */
  async createAnnotationInternal(annotation: SerializedAnnotation): Promise<void> {
    await this.persistenceService.saveAnnotation(annotation);

    if (this.config.enableViewportPersistence) {
      this.viewportService.addAnnotationToViewport(
        annotation.viewportInfo.viewportId,
        annotation,
      );
    }
  }

  /**
   * Internal update annotation (bypasses undo/redo)
   */
  async updateAnnotationInternal(annotation: SerializedAnnotation): Promise<void> {
    await this.persistenceService.saveAnnotation(annotation);
  }

  /**
   * Internal delete annotation (bypasses undo/redo)
   */
  async deleteAnnotationInternal(annotationId: string): Promise<void> {
    await this.persistenceService.deleteAnnotation(annotationId);

    if (this.config.enableViewportPersistence) {
      // Find viewport and remove annotation
      // This is simplified - in production would need proper viewport lookup
      log.info(`Removing annotation ${annotationId} from viewport persistence`);
    }
  }

  /* =============================================================================
   * UTILITY METHODS
   * ============================================================================= */

  /**
   * Get manager statistics
   */
  getStatistics() {
    return {
      isInitialized: this.isInitialized,
      config: this.config,
      persistence: this.persistenceService.getStatistics(),
      viewport: this.config.enableViewportPersistence
        ? this.viewportService.getStatistics()
        : null,
      undoRedo: this.config.enableUndoRedo
        ? this.undoRedoService.getStatistics()
        : null,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PersistenceManagerConfig>): void {
    this.config = { ...this.config, ...config };
    log.info('🔧 Persistence manager configuration updated');
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
          log.error(`Error in event listener for ${event}:`, undefined, error as Error);
        }
      });
    }
  }

  /**
   * Dispose manager
   */
  dispose(): void {
    this.viewportService.dispose();
    this.eventListeners.clear();
    this.isInitialized = false;
    log.info('🔧 Annotation Persistence Manager disposed');
  }
}

// Export singleton instance
export const annotationPersistenceManager = AnnotationPersistenceManager.getInstance();
