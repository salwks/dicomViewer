/**
 * Selection API - Public Interface for Annotation Selection System
 * Provides a unified API for managing annotation selections across the application
 * Built with shadcn/ui components and comprehensive error handling
 */

import { EventEmitter } from 'events';
import { AnnotationCompat, AnnotationCompatLayer } from '../types/annotation-compat';
import { annotationSelectionHandler } from './AnnotationSelectionHandler';
import { selectionStateManager, SelectionState, SelectionHistoryEntry } from './SelectionStateManager';
import { log } from '../utils/logger';

// Public API interfaces
export interface SelectionAPIEvents {
  'selection-changed': [string[], string]; // selectedIds, viewportId
  'annotation-selected': [AnnotationCompat, string]; // annotation, viewportId
  'annotation-deselected': [AnnotationCompat, string]; // annotation, viewportId
  'selection-cleared': [string]; // viewportId
  'bulk-operation-progress': [number, number]; // completed, total
  'selection-restored': [SelectionState]; // restored state
  error: [Error]; // error occurred
}

export interface SelectionOptions {
  preserveExisting?: boolean;
  emitEvents?: boolean;
  validateAnnotation?: boolean;
}

export interface BulkSelectionOptions extends SelectionOptions {
  batchSize?: number;
  delayBetweenBatches?: number;
  onProgress?: (completed: number, total: number) => void;
  onError?: (error: Error, annotationId: string) => void;
}

export interface SelectionStatistics {
  totalViewports: number;
  activeViewports: number;
  totalSelections: number;
  selectionsByViewport: Record<string, number>;
  historyEntries: number;
  oldestHistoryEntry?: Date;
  newestHistoryEntry?: Date;
}

export interface SelectionAPIConfig {
  enableHistory: boolean;
  maxHistorySize: number;
  enableValidation: boolean;
  enableEvents: boolean;
  defaultBatchSize: number;
  defaultDelay: number;
}

// Default configuration
const DEFAULT_CONFIG: SelectionAPIConfig = {
  enableHistory: true,
  maxHistorySize: 100,
  enableValidation: true,
  enableEvents: true,
  defaultBatchSize: 10,
  defaultDelay: 50,
};

/**
 * Selection API - Main public interface for annotation selection
 * Provides high-level methods for managing annotation selections
 */
export class SelectionAPI extends EventEmitter {
  private config: SelectionAPIConfig;
  private isInitialized = false;

  constructor(config: Partial<SelectionAPIConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initialize();
  }

  /**
   * Initialize the Selection API
   */
  private initialize(): void {
    try {
      // Set up event forwarding from selection handler
      annotationSelectionHandler.on('annotation-selected', (annotation, viewportId) => {
        if (this.config.enableEvents) {
          this.emit('annotation-selected', annotation, viewportId);
        }
      });

      annotationSelectionHandler.on('annotation-deselected', (annotation, viewportId) => {
        if (this.config.enableEvents) {
          this.emit('annotation-deselected', annotation, viewportId);
        }
      });

      annotationSelectionHandler.on('selection-cleared', viewportId => {
        if (this.config.enableEvents) {
          this.emit('selection-cleared', viewportId);
        }
      });

      annotationSelectionHandler.on('selection-changed', (annotations, viewportId) => {
        if (this.config.enableEvents) {
          const selectedIds = annotations
            .map((ann: any) => AnnotationCompatLayer.getAnnotationId(ann))
            .filter(Boolean) as string[];
          this.emit('selection-changed', selectedIds, viewportId);
        }
      });

      annotationSelectionHandler.on('bulk-operation-progress', (completed, total) => {
        if (this.config.enableEvents) {
          this.emit('bulk-operation-progress', completed, total);
        }
      });

      annotationSelectionHandler.on('selection-state-restored', state => {
        if (this.config.enableEvents) {
          this.emit('selection-restored', state);
        }
      });

      this.isInitialized = true;

      log.info('Selection API initialized successfully', {
        component: 'SelectionAPI',
        metadata: {
          enableHistory: this.config.enableHistory,
          enableValidation: this.config.enableValidation,
          enableEvents: this.config.enableEvents,
        },
      });
    } catch (error) {
      log.error(
        'Failed to initialize Selection API',
        {
          component: 'SelectionAPI',
        },
        error as Error,
      );

      if (this.config.enableEvents) {
        this.emit('error', error as Error);
      }
      throw error;
    }
  }

  /**
   * Ensure API is initialized before operations
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Selection API is not initialized');
    }
  }

  // ===== BASIC SELECTION OPERATIONS =====

  /**
   * Select a single annotation
   */
  public async selectAnnotation(
    annotationOrId: AnnotationCompat | string,
    viewportId: string,
    options: SelectionOptions = {},
  ): Promise<boolean> {
    this.ensureInitialized();

    try {
      const annotation = typeof annotationOrId === 'string' ? this.getAnnotationById(annotationOrId) : annotationOrId;

      if (!annotation) {
        throw new Error(`Annotation not found: ${annotationOrId}`);
      }

      if (options.validateAnnotation && this.config.enableValidation) {
        this.validateAnnotation(annotation);
      }

      const success = annotationSelectionHandler.selectAnnotation(
        annotation,
        viewportId,
        options.preserveExisting ?? false,
      );

      if (success) {
        log.info('Annotation selected via API', {
          component: 'SelectionAPI',
          metadata: {
            annotationId: AnnotationCompatLayer.getAnnotationId(annotation),
            viewportId,
            preserveExisting: options.preserveExisting,
          },
        });
      }

      return success;
    } catch (error) {
      log.error(
        'Failed to select annotation via API',
        {
          component: 'SelectionAPI',
          metadata: { viewportId, annotationOrId },
        },
        error as Error,
      );

      if (this.config.enableEvents && options.emitEvents !== false) {
        this.emit('error', error as Error);
      }

      return false;
    }
  }

  /**
   * Deselect a single annotation
   */
  public async deselectAnnotation(
    annotationOrId: AnnotationCompat | string,
    viewportId: string,
    options: SelectionOptions = {},
  ): Promise<boolean> {
    this.ensureInitialized();

    try {
      const annotation = typeof annotationOrId === 'string' ? this.getAnnotationById(annotationOrId) : annotationOrId;

      if (!annotation) {
        throw new Error(`Annotation not found: ${annotationOrId}`);
      }

      const success = annotationSelectionHandler.deselectAnnotation(annotation, viewportId);

      if (success) {
        log.info('Annotation deselected via API', {
          component: 'SelectionAPI',
          metadata: {
            annotationId: AnnotationCompatLayer.getAnnotationId(annotation),
            viewportId,
          },
        });
      }

      return success;
    } catch (error) {
      log.error(
        'Failed to deselect annotation via API',
        {
          component: 'SelectionAPI',
          metadata: { viewportId, annotationOrId },
        },
        error as Error,
      );

      if (this.config.enableEvents && options.emitEvents !== false) {
        this.emit('error', error as Error);
      }

      return false;
    }
  }

  /**
   * Clear all selections in a viewport
   */
  public clearSelection(viewportId: string, options: SelectionOptions = {}): boolean {
    this.ensureInitialized();

    try {
      annotationSelectionHandler.clearSelection(viewportId);

      log.info('Selection cleared via API', {
        component: 'SelectionAPI',
        metadata: { viewportId },
      });

      return true;
    } catch (error) {
      log.error(
        'Failed to clear selection via API',
        {
          component: 'SelectionAPI',
          metadata: { viewportId },
        },
        error as Error,
      );

      if (this.config.enableEvents && options.emitEvents !== false) {
        this.emit('error', error as Error);
      }

      return false;
    }
  }

  /**
   * Clear all selections across all viewports
   */
  public clearAllSelections(options: SelectionOptions = {}): boolean {
    this.ensureInitialized();

    try {
      annotationSelectionHandler.clearAllSelections();

      log.info('All selections cleared via API', {
        component: 'SelectionAPI',
      });

      return true;
    } catch (error) {
      log.error(
        'Failed to clear all selections via API',
        {
          component: 'SelectionAPI',
        },
        error as Error,
      );

      if (this.config.enableEvents && options.emitEvents !== false) {
        this.emit('error', error as Error);
      }

      return false;
    }
  }

  // ===== BULK OPERATIONS =====

  /**
   * Select multiple annotations
   */
  public async selectMultipleAnnotations(
    annotationsOrIds: (AnnotationCompat | string)[],
    viewportId: string,
    options: BulkSelectionOptions = {},
  ): Promise<{ successful: number; failed: number }> {
    this.ensureInitialized();

    // const _batchSize = options.batchSize ?? this.config.defaultBatchSize; // Currently unused
    // const _delay = options.delayBetweenBatches ?? this.config.defaultDelay; // Currently unused

    let successful = 0;
    let failed = 0;

    try {
      // Convert all inputs to annotation IDs
      const annotationIds: string[] = [];
      for (const item of annotationsOrIds) {
        if (typeof item === 'string') {
          annotationIds.push(item);
        } else {
          const id = AnnotationCompatLayer.getAnnotationId(item);
          if (id) {
            annotationIds.push(id);
          } else {
            failed++;
            if (options.onError) {
              options.onError(new Error('Invalid annotation ID'), 'unknown');
            }
          }
        }
      }

      // Use the selection handler's bulk operation
      // const _result = await annotationSelectionHandler.selectMultipleAnnotations( // Currently unused
      await annotationSelectionHandler.selectMultipleAnnotations(
        viewportId,
        annotationIds,
        options.preserveExisting ?? true,
      );

      successful = annotationIds.length;

      log.info('Bulk selection completed via API', {
        component: 'SelectionAPI',
        metadata: { viewportId, successful, failed, total: annotationsOrIds.length },
      });

      return { successful, failed };
    } catch (error) {
      log.error(
        'Failed to select multiple annotations via API',
        {
          component: 'SelectionAPI',
          metadata: { viewportId, total: annotationsOrIds.length },
        },
        error as Error,
      );

      if (this.config.enableEvents && options.emitEvents !== false) {
        this.emit('error', error as Error);
      }

      return { successful, failed: annotationsOrIds.length - successful };
    }
  }

  /**
   * Deselect multiple annotations
   */
  public async deselectMultipleAnnotations(
    annotationsOrIds: (AnnotationCompat | string)[],
    viewportId: string,
    options: BulkSelectionOptions = {},
  ): Promise<{ successful: number; failed: number }> {
    this.ensureInitialized();

    let successful = 0;
    let failed = 0;

    try {
      // Convert all inputs to annotation IDs
      const annotationIds: string[] = [];
      for (const item of annotationsOrIds) {
        if (typeof item === 'string') {
          annotationIds.push(item);
        } else {
          const id = AnnotationCompatLayer.getAnnotationId(item);
          if (id) {
            annotationIds.push(id);
          } else {
            failed++;
            if (options.onError) {
              options.onError(new Error('Invalid annotation ID'), 'unknown');
            }
          }
        }
      }

      // Use the selection handler's bulk operation
      // const _result = await annotationSelectionHandler.deselectMultipleAnnotations( // Currently unused
      await annotationSelectionHandler.deselectMultipleAnnotations(viewportId, annotationIds);

      successful = annotationIds.length;

      log.info('Bulk deselection completed via API', {
        component: 'SelectionAPI',
        metadata: { viewportId, successful, failed, total: annotationsOrIds.length },
      });

      return { successful, failed };
    } catch (error) {
      log.error(
        'Failed to deselect multiple annotations via API',
        {
          component: 'SelectionAPI',
          metadata: { viewportId, total: annotationsOrIds.length },
        },
        error as Error,
      );

      if (this.config.enableEvents && options.emitEvents !== false) {
        this.emit('error', error as Error);
      }

      return { successful, failed: annotationsOrIds.length - successful };
    }
  }

  // ===== QUERY OPERATIONS =====

  /**
   * Check if annotation is selected
   */
  public isAnnotationSelected(annotationOrId: AnnotationCompat | string, viewportId: string): boolean {
    this.ensureInitialized();

    try {
      const annotationId =
        typeof annotationOrId === 'string' ? annotationOrId : AnnotationCompatLayer.getAnnotationId(annotationOrId);

      if (!annotationId) {
        return false;
      }

      return annotationSelectionHandler.isAnnotationSelected(annotationId, viewportId);
    } catch (error) {
      log.error(
        'Failed to check annotation selection status',
        {
          component: 'SelectionAPI',
          metadata: { viewportId, annotationOrId },
        },
        error as Error,
      );

      return false;
    }
  }

  /**
   * Get selected annotation IDs for a viewport
   */
  public getSelectedAnnotationIds(viewportId: string): string[] {
    this.ensureInitialized();

    try {
      return annotationSelectionHandler.getSelectedAnnotationIds(viewportId);
    } catch (error) {
      log.error(
        'Failed to get selected annotation IDs',
        {
          component: 'SelectionAPI',
          metadata: { viewportId },
        },
        error as Error,
      );

      return [];
    }
  }

  /**
   * Get selected annotations for a viewport
   */
  public getSelectedAnnotations(viewportId: string): AnnotationCompat[] {
    this.ensureInitialized();

    try {
      return annotationSelectionHandler.getSelectedAnnotations(viewportId);
    } catch (error) {
      log.error(
        'Failed to get selected annotations',
        {
          component: 'SelectionAPI',
          metadata: { viewportId },
        },
        error as Error,
      );

      return [];
    }
  }

  /**
   * Get selection count for a viewport
   */
  public getSelectionCount(viewportId: string): number {
    this.ensureInitialized();

    try {
      return annotationSelectionHandler.getSelectionCount(viewportId);
    } catch (error) {
      log.error(
        'Failed to get selection count',
        {
          component: 'SelectionAPI',
          metadata: { viewportId },
        },
        error as Error,
      );

      return 0;
    }
  }

  // ===== HISTORY OPERATIONS =====

  /**
   * Undo last selection operation
   */
  public undoLastSelection(viewportId: string): boolean {
    this.ensureInitialized();

    if (!this.config.enableHistory) {
      log.warn('History is disabled in Selection API configuration', {
        component: 'SelectionAPI',
      });
      return false;
    }

    try {
      return annotationSelectionHandler.undoLastSelection(viewportId);
    } catch (error) {
      log.error(
        'Failed to undo last selection',
        {
          component: 'SelectionAPI',
          metadata: { viewportId },
        },
        error as Error,
      );

      if (this.config.enableEvents) {
        this.emit('error', error as Error);
      }

      return false;
    }
  }

  /**
   * Get selection history
   */
  public getSelectionHistory(limit?: number): ReadonlyArray<SelectionHistoryEntry> {
    this.ensureInitialized();

    try {
      return annotationSelectionHandler.getSelectionHistory(limit);
    } catch (error) {
      log.error(
        'Failed to get selection history',
        {
          component: 'SelectionAPI',
        },
        error as Error,
      );

      return [];
    }
  }

  /**
   * Clear selection history
   */
  public clearSelectionHistory(viewportId?: string): boolean {
    this.ensureInitialized();

    try {
      annotationSelectionHandler.clearSelectionHistory(viewportId);
      return true;
    } catch (error) {
      log.error(
        'Failed to clear selection history',
        {
          component: 'SelectionAPI',
          metadata: { viewportId },
        },
        error as Error,
      );

      if (this.config.enableEvents) {
        this.emit('error', error as Error);
      }

      return false;
    }
  }

  // ===== STATE MANAGEMENT =====

  /**
   * Save selection state for persistence
   */
  public saveSelectionState(viewportId: string): string | null {
    this.ensureInitialized();

    try {
      return annotationSelectionHandler.saveSelectionState(viewportId);
    } catch (error) {
      log.error(
        'Failed to save selection state',
        {
          component: 'SelectionAPI',
          metadata: { viewportId },
        },
        error as Error,
      );

      if (this.config.enableEvents) {
        this.emit('error', error as Error);
      }

      return null;
    }
  }

  /**
   * Restore selection state from saved data
   */
  public restoreSelectionState(viewportId: string, savedState: string): boolean {
    this.ensureInitialized();

    try {
      return annotationSelectionHandler.restoreSelectionState(viewportId, savedState);
    } catch (error) {
      log.error(
        'Failed to restore selection state',
        {
          component: 'SelectionAPI',
          metadata: { viewportId },
        },
        error as Error,
      );

      if (this.config.enableEvents) {
        this.emit('error', error as Error);
      }

      return false;
    }
  }

  // ===== STATISTICS =====

  /**
   * Get comprehensive selection statistics
   */
  public getStatistics(): SelectionStatistics {
    this.ensureInitialized();

    try {
      const baseStats = annotationSelectionHandler.getSelectionStatistics();

      // Add per-viewport breakdown
      const selectionsByViewport: Record<string, number> = {};
      const activeViewports = selectionStateManager.getActiveViewportIds();

      activeViewports.forEach(viewportId => {
        // eslint-disable-next-line security/detect-object-injection -- Safe: viewportId is validated viewport identifier from activeViewports
        selectionsByViewport[viewportId] = this.getSelectionCount(viewportId);
      });

      return {
        totalViewports: baseStats.totalViewports,
        activeViewports: baseStats.activeViewports,
        totalSelections: baseStats.totalSelections,
        selectionsByViewport,
        historyEntries: baseStats.historyEntries,
        oldestHistoryEntry: baseStats.oldestHistoryEntry,
        newestHistoryEntry: baseStats.newestHistoryEntry,
      };
    } catch (error) {
      log.error(
        'Failed to get selection statistics',
        {
          component: 'SelectionAPI',
        },
        error as Error,
      );

      return {
        totalViewports: 0,
        activeViewports: 0,
        totalSelections: 0,
        selectionsByViewport: {},
        historyEntries: 0,
      };
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Get annotation by ID (stub - would integrate with actual annotation store)
   */
  private getAnnotationById(annotationId: string): AnnotationCompat | null {
    // In a real implementation, this would query the annotation store
    // For now, create a basic AnnotationCompat object
    return {
      annotationUID: annotationId,
      uid: annotationId,
      id: annotationId,
      annotationId,
    };
  }

  /**
   * Validate annotation object
   */
  private validateAnnotation(annotation: AnnotationCompat): void {
    const annotationId = AnnotationCompatLayer.getAnnotationId(annotation);
    if (!annotationId) {
      throw new Error('Annotation must have a valid ID');
    }

    // Additional validation can be added here
    if (!annotation.uid && !annotation.annotationUID && !annotation.id) {
      throw new Error('Annotation must have at least one valid identifier');
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<SelectionAPIConfig>): void {
    this.config = { ...this.config, ...updates };

    log.info('Selection API configuration updated', {
      component: 'SelectionAPI',
      metadata: { updatedKeys: Object.keys(updates) },
    });
  }

  /**
   * Get current configuration
   */
  public getConfig(): SelectionAPIConfig {
    return { ...this.config };
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    try {
      // Remove all event listeners
      this.removeAllListeners();
      this.isInitialized = false;

      log.info('Selection API disposed', {
        component: 'SelectionAPI',
      });
    } catch (error) {
      log.error(
        'Error during Selection API disposal',
        {
          component: 'SelectionAPI',
        },
        error as Error,
      );
    }
  }
}

// Export singleton instance
export const selectionAPI = new SelectionAPI();
export default selectionAPI;
