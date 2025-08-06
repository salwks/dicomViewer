/**
 * Selection State Manager
 * Comprehensive selection state management system for Cornerstone3D annotations
 * Provides centralized state management, history tracking, and bulk operations
 */

import { EventEmitter } from 'events';
import { AnnotationCompat } from '../types/annotation-compat';
import { log } from '../utils/logger';

// Selection state interface
export interface SelectionState {
  readonly id: string;
  readonly timestamp: number;
  readonly viewportId: string;
  readonly selectedAnnotationIds: ReadonlySet<string>;
  readonly metadata?: Record<string, unknown>;
}

// Selection history entry
export interface SelectionHistoryEntry {
  readonly id: string;
  readonly timestamp: number;
  readonly action: 'select' | 'deselect' | 'clear' | 'bulk-select' | 'bulk-deselect';
  readonly beforeState: SelectionState;
  readonly afterState: SelectionState;
  readonly description: string;
}

// Bulk operation configuration
export interface BulkOperationConfig {
  batchSize: number;
  delayBetweenBatches: number; // milliseconds
  progressCallback?: (completed: number, total: number) => void;
  errorCallback?: (error: Error, annotation: AnnotationCompat) => void;
}

// Selection state events
export interface SelectionStateEvents {
  'state-changed': [SelectionState, SelectionState]; // before, after
  'bulk-operation-started': [string, number]; // operation type, total count
  'bulk-operation-progress': [number, number]; // completed, total
  'bulk-operation-completed': [string, number, number]; // operation type, completed, failed
  'history-entry-added': [SelectionHistoryEntry];
  'state-restored': [SelectionState];
  'state-persisted': [SelectionState];
}

export class SelectionStateManager extends EventEmitter {
  private states = new Map<string, SelectionState>(); // viewportId -> current state
  private history: SelectionHistoryEntry[] = [];
  private maxHistorySize = 100;
  private stateIdCounter = 0;
  private historyIdCounter = 0;

  // Bulk operation settings
  private defaultBulkConfig: BulkOperationConfig = {
    batchSize: 10,
    delayBetweenBatches: 50,
  };

  constructor() {
    super();

    log.info('SelectionStateManager initialized', {
      component: 'SelectionStateManager',
      metadata: {
        maxHistorySize: this.maxHistorySize,
        defaultBatchSize: this.defaultBulkConfig.batchSize,
      },
    });
  }

  /**
   * Create a new selection state
   */
  public createState(
    viewportId: string,
    selectedAnnotationIds: string[] = [],
    metadata?: Record<string, unknown>,
  ): SelectionState {
    const state: SelectionState = {
      id: `state-${++this.stateIdCounter}`,
      timestamp: Date.now(),
      viewportId,
      selectedAnnotationIds: new Set(selectedAnnotationIds),
      metadata: metadata ? { ...metadata } : undefined,
    };

    return state;
  }

  /**
   * Get current selection state for a viewport
   */
  public getCurrentState(viewportId: string): SelectionState | null {
    return this.states.get(viewportId) || null;
  }

  /**
   * Update selection state for a viewport
   */
  public updateState(
    viewportId: string,
    selectedAnnotationIds: string[],
    action: SelectionHistoryEntry['action'] = 'select',
    description?: string,
    metadata?: Record<string, unknown>,
  ): SelectionState {
    const beforeState = this.getCurrentState(viewportId);
    const afterState = this.createState(viewportId, selectedAnnotationIds, metadata);

    // Update current state
    this.states.set(viewportId, afterState);

    // Create history entry if we have a before state
    if (beforeState) {
      this.addHistoryEntry(action, beforeState, afterState, description);
    }

    // Emit state change event
    this.emit('state-changed', beforeState, afterState);

    log.info('Selection state updated', {
      component: 'SelectionStateManager',
      metadata: {
        viewportId,
        action,
        beforeCount: beforeState?.selectedAnnotationIds.size || 0,
        afterCount: afterState.selectedAnnotationIds.size,
      },
    });

    return afterState;
  }

  /**
   * Add annotation to selection
   */
  public selectAnnotation(
    viewportId: string,
    annotationId: string,
    preserveExisting: boolean = true,
    metadata?: Record<string, unknown>,
  ): SelectionState {
    const currentState = this.getCurrentState(viewportId);
    const currentIds = currentState?.selectedAnnotationIds || new Set<string>();

    const newIds = preserveExisting ? new Set([...currentIds, annotationId]) : new Set([annotationId]);

    return this.updateState(viewportId, Array.from(newIds), 'select', `Selected annotation ${annotationId}`, metadata);
  }

  /**
   * Remove annotation from selection
   */
  public deselectAnnotation(
    viewportId: string,
    annotationId: string,
    metadata?: Record<string, unknown>,
  ): SelectionState {
    const currentState = this.getCurrentState(viewportId);
    if (!currentState) {
      return this.createState(viewportId);
    }

    const newIds = new Set(currentState.selectedAnnotationIds);
    newIds.delete(annotationId);

    return this.updateState(
      viewportId,
      Array.from(newIds),
      'deselect',
      `Deselected annotation ${annotationId}`,
      metadata,
    );
  }

  /**
   * Clear all selections in a viewport
   */
  public clearSelection(viewportId: string, metadata?: Record<string, unknown>): SelectionState {
    const currentState = this.getCurrentState(viewportId);
    const clearedCount = currentState?.selectedAnnotationIds.size || 0;

    return this.updateState(viewportId, [], 'clear', `Cleared ${clearedCount} selections`, metadata);
  }

  /**
   * Select multiple annotations (bulk operation)
   */
  public async selectMultipleAnnotations(
    viewportId: string,
    annotationIds: string[],
    preserveExisting: boolean = true,
    config?: Partial<BulkOperationConfig>,
  ): Promise<SelectionState> {
    const operationConfig = { ...this.defaultBulkConfig, ...config };
    const operationType = 'bulk-select';

    this.emit('bulk-operation-started', operationType, annotationIds.length);

    try {
      const currentState = this.getCurrentState(viewportId);
      const currentIds =
        preserveExisting && currentState ? new Set(currentState.selectedAnnotationIds) : new Set<string>();

      let completed = 0;
      let failed = 0;

      // Process in batches
      for (let i = 0; i < annotationIds.length; i += operationConfig.batchSize) {
        const batch = annotationIds.slice(i, i + operationConfig.batchSize);

        // Add batch to selection
        batch.forEach(id => {
          try {
            currentIds.add(id);
            completed++;
          } catch (error) {
            failed++;
            if (operationConfig.errorCallback) {
              operationConfig.errorCallback(error as Error, { annotationId: id } as AnnotationCompat);
            }
          }
        });

        // Report progress
        if (operationConfig.progressCallback) {
          operationConfig.progressCallback(completed, annotationIds.length);
        }
        this.emit('bulk-operation-progress', completed, annotationIds.length);

        // Delay between batches
        if (i + operationConfig.batchSize < annotationIds.length) {
          await new Promise(resolve => setTimeout(resolve, operationConfig.delayBetweenBatches));
        }
      }

      // Update state with final result
      const finalState = this.updateState(
        viewportId,
        Array.from(currentIds),
        'bulk-select',
        `Bulk selected ${completed} annotations (${failed} failed)`,
        { completed, failed, total: annotationIds.length },
      );

      this.emit('bulk-operation-completed', operationType, completed, failed);

      log.info('Bulk select operation completed', {
        component: 'SelectionStateManager',
        metadata: { viewportId, completed, failed, total: annotationIds.length },
      });

      return finalState;
    } catch (error) {
      log.error(
        'Bulk select operation failed',
        {
          component: 'SelectionStateManager',
          metadata: { viewportId, total: annotationIds.length },
        },
        error as Error,
      );

      throw error;
    }
  }

  /**
   * Deselect multiple annotations (bulk operation)
   */
  public async deselectMultipleAnnotations(
    viewportId: string,
    annotationIds: string[],
    config?: Partial<BulkOperationConfig>,
  ): Promise<SelectionState> {
    const operationConfig = { ...this.defaultBulkConfig, ...config };
    const operationType = 'bulk-deselect';

    this.emit('bulk-operation-started', operationType, annotationIds.length);

    try {
      const currentState = this.getCurrentState(viewportId);
      if (!currentState) {
        return this.createState(viewportId);
      }

      const currentIds = new Set(currentState.selectedAnnotationIds);
      let completed = 0;
      let failed = 0;

      // Process in batches
      for (let i = 0; i < annotationIds.length; i += operationConfig.batchSize) {
        const batch = annotationIds.slice(i, i + operationConfig.batchSize);

        // Remove batch from selection
        batch.forEach(id => {
          try {
            currentIds.delete(id);
            completed++;
          } catch (error) {
            failed++;
            if (operationConfig.errorCallback) {
              operationConfig.errorCallback(error as Error, { annotationId: id } as AnnotationCompat);
            }
          }
        });

        // Report progress
        if (operationConfig.progressCallback) {
          operationConfig.progressCallback(completed, annotationIds.length);
        }
        this.emit('bulk-operation-progress', completed, annotationIds.length);

        // Delay between batches
        if (i + operationConfig.batchSize < annotationIds.length) {
          await new Promise(resolve => setTimeout(resolve, operationConfig.delayBetweenBatches));
        }
      }

      // Update state with final result
      const finalState = this.updateState(
        viewportId,
        Array.from(currentIds),
        'bulk-deselect',
        `Bulk deselected ${completed} annotations (${failed} failed)`,
        { completed, failed, total: annotationIds.length },
      );

      this.emit('bulk-operation-completed', operationType, completed, failed);

      log.info('Bulk deselect operation completed', {
        component: 'SelectionStateManager',
        metadata: { viewportId, completed, failed, total: annotationIds.length },
      });

      return finalState;
    } catch (error) {
      log.error(
        'Bulk deselect operation failed',
        {
          component: 'SelectionStateManager',
          metadata: { viewportId, total: annotationIds.length },
        },
        error as Error,
      );

      throw error;
    }
  }

  /**
   * Check if annotation is selected
   */
  public isAnnotationSelected(viewportId: string, annotationId: string): boolean {
    const state = this.getCurrentState(viewportId);
    return state ? state.selectedAnnotationIds.has(annotationId) : false;
  }

  /**
   * Get selected annotation IDs for a viewport
   */
  public getSelectedAnnotationIds(viewportId: string): string[] {
    const state = this.getCurrentState(viewportId);
    return state ? Array.from(state.selectedAnnotationIds) : [];
  }

  /**
   * Get selection count for a viewport
   */
  public getSelectionCount(viewportId: string): number {
    const state = this.getCurrentState(viewportId);
    return state ? state.selectedAnnotationIds.size : 0;
  }

  /**
   * Add entry to selection history
   */
  private addHistoryEntry(
    action: SelectionHistoryEntry['action'],
    beforeState: SelectionState,
    afterState: SelectionState,
    description?: string,
  ): void {
    const entry: SelectionHistoryEntry = {
      id: `history-${++this.historyIdCounter}`,
      timestamp: Date.now(),
      action,
      beforeState: this.cloneState(beforeState),
      afterState: this.cloneState(afterState),
      description: description || `${action} operation`,
    };

    this.history.push(entry);

    // Maintain history size limit
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    this.emit('history-entry-added', entry);
  }

  /**
   * Clone a selection state (deep copy)
   */
  private cloneState(state: SelectionState): SelectionState {
    return {
      id: state.id,
      timestamp: state.timestamp,
      viewportId: state.viewportId,
      selectedAnnotationIds: new Set(state.selectedAnnotationIds),
      metadata: state.metadata ? { ...state.metadata } : undefined,
    };
  }

  /**
   * Get selection history
   */
  public getHistory(limit?: number): ReadonlyArray<SelectionHistoryEntry> {
    const entries = limit ? this.history.slice(-limit) : this.history;
    return entries;
  }

  /**
   * Undo last selection operation
   */
  public undoLastOperation(viewportId: string): SelectionState | null {
    // Find the most recent history entry for this viewport
    const relevantEntries = this.history.filter(entry => entry.afterState.viewportId === viewportId);

    if (relevantEntries.length === 0) {
      return null;
    }

    const lastEntry = relevantEntries[relevantEntries.length - 1];

    // Restore the before state
    const restoredState = this.cloneState(lastEntry.beforeState);
    this.states.set(viewportId, restoredState);

    // Remove the undone entry from history
    const entryIndex = this.history.indexOf(lastEntry);
    if (entryIndex !== -1) {
      this.history.splice(entryIndex, 1);
    }

    this.emit('state-restored', restoredState);

    log.info('Selection operation undone', {
      component: 'SelectionStateManager',
      metadata: {
        viewportId,
        undoneAction: lastEntry.action,
        restoredSelectionCount: restoredState.selectedAnnotationIds.size,
      },
    });

    return restoredState;
  }

  /**
   * Clear history for a viewport
   */
  public clearHistory(viewportId?: string): void {
    if (viewportId) {
      this.history = this.history.filter(
        entry => entry.beforeState.viewportId !== viewportId && entry.afterState.viewportId !== viewportId,
      );
    } else {
      this.history = [];
    }

    log.info('Selection history cleared', {
      component: 'SelectionStateManager',
      metadata: { viewportId: viewportId || 'all' },
    });
  }

  /**
   * Persist selection state (for session management)
   */
  public persistState(viewportId: string): string {
    const state = this.getCurrentState(viewportId);
    if (!state) {
      return '';
    }

    try {
      const serializedState = JSON.stringify({
        ...state,
        selectedAnnotationIds: Array.from(state.selectedAnnotationIds),
      });

      this.emit('state-persisted', state);

      log.info('Selection state persisted', {
        component: 'SelectionStateManager',
        metadata: { viewportId, stateId: state.id },
      });

      return serializedState;
    } catch (error) {
      log.error(
        'Failed to persist selection state',
        {
          component: 'SelectionStateManager',
          metadata: { viewportId },
        },
        error as Error,
      );

      return '';
    }
  }

  /**
   * Restore selection state from persisted data
   */
  public restoreState(viewportId: string, serializedState: string): SelectionState | null {
    try {
      const parsed = JSON.parse(serializedState);

      const state: SelectionState = {
        ...parsed,
        selectedAnnotationIds: new Set(parsed.selectedAnnotationIds),
      };

      this.states.set(viewportId, state);
      this.emit('state-restored', state);

      log.info('Selection state restored', {
        component: 'SelectionStateManager',
        metadata: { viewportId, stateId: state.id, selectionCount: state.selectedAnnotationIds.size },
      });

      return state;
    } catch (error) {
      log.error(
        'Failed to restore selection state',
        {
          component: 'SelectionStateManager',
          metadata: { viewportId },
        },
        error as Error,
      );

      return null;
    }
  }

  /**
   * Get all viewport IDs with active selections
   */
  public getActiveViewportIds(): string[] {
    return Array.from(this.states.keys()).filter(viewportId => {
      const state = this.states.get(viewportId);
      return state && state.selectedAnnotationIds.size > 0;
    });
  }

  /**
   * Get statistics about selection states
   */
  public getStatistics(): {
    totalViewports: number;
    activeViewports: number;
    totalSelections: number;
    historyEntries: number;
    oldestHistoryEntry?: Date;
    newestHistoryEntry?: Date;
    } {
    const activeViewports = this.getActiveViewportIds();
    const totalSelections = activeViewports.reduce((sum, viewportId) => {
      return sum + this.getSelectionCount(viewportId);
    }, 0);

    const oldestEntry = this.history.length > 0 ? this.history[0] : null;
    const newestEntry = this.history.length > 0 ? this.history[this.history.length - 1] : null;

    return {
      totalViewports: this.states.size,
      activeViewports: activeViewports.length,
      totalSelections,
      historyEntries: this.history.length,
      oldestHistoryEntry: oldestEntry ? new Date(oldestEntry.timestamp) : undefined,
      newestHistoryEntry: newestEntry ? new Date(newestEntry.timestamp) : undefined,
    };
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    this.states.clear();
    this.history = [];
    this.removeAllListeners();

    log.info('SelectionStateManager disposed', {
      component: 'SelectionStateManager',
    });
  }
}

// Export singleton instance
export const selectionStateManager = new SelectionStateManager();
export default selectionStateManager;
