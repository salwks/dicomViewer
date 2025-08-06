/**
 * Annotation Selection Handler
 * Advanced annotation selection system for Cornerstone3D v3
 * Provides click handling, visual feedback, and selection state management
 */

import { EventEmitter } from 'events';
import { AnnotationCompat, AnnotationCompatLayer } from '../types/annotation-compat';
import { toolStateManager } from './ToolStateManager';
import { selectionStateManager, SelectionStateManager } from './SelectionStateManager';
import { log } from '../utils/logger';
import { cn } from '../lib/utils';

// Selection event types
export interface SelectionEvents {
  'annotation-selected': [AnnotationCompat, string]; // annotation, viewportId
  'annotation-deselected': [AnnotationCompat, string]; // annotation, viewportId
  'selection-cleared': [string]; // viewportId
  'selection-changed': [AnnotationCompat[], string]; // selectedAnnotations, viewportId
  'annotation-deleted': [AnnotationCompat, string]; // annotation, viewportId
  'highlight-applied': [string, HighlightStyle]; // annotationId, style
  'highlight-removed': [string]; // annotationId

  // New selection state management events
  'bulk-operation-started': [string, number]; // operation type, total count
  'bulk-operation-progress': [number, number]; // completed, total
  'bulk-operation-completed': [string, number, number]; // operation type, completed, failed
  'selection-state-changed': [any, any]; // before state, after state
  'selection-history-updated': [any]; // history entry
  'selection-state-restored': [any]; // restored state
  'selection-statistics-updated': [any]; // statistics
}

// Highlight styling configuration
export interface HighlightStyle {
  color: string;
  opacity: number;
  strokeWidth: number;
  fillOpacity: number;
  shadowBlur: number;
  shadowColor: string;
  animation?: 'pulse' | 'glow' | 'none';
  duration?: number; // animation duration in ms
}

// Selection configuration
export interface SelectionConfig {
  multiSelect: boolean;
  highlightSelected: boolean;
  highlightHovered: boolean;
  selectionStyle: HighlightStyle;
  hoverStyle: HighlightStyle;
  clearOnClickOutside: boolean;
  enableKeyboardShortcuts: boolean;
  animateSelection: boolean;
}

// Default selection configuration
const DEFAULT_SELECTION_CONFIG: SelectionConfig = {
  multiSelect: true,
  highlightSelected: true,
  highlightHovered: true,
  selectionStyle: {
    color: '#87CEEB', // Sky blue as specified in the task
    opacity: 1.0,
    strokeWidth: 3,
    fillOpacity: 0.2,
    shadowBlur: 5,
    shadowColor: '#87CEEB',
    animation: 'glow',
    duration: 300,
  },
  hoverStyle: {
    color: '#FFD700', // Gold color for hover
    opacity: 0.8,
    strokeWidth: 2,
    fillOpacity: 0.1,
    shadowBlur: 3,
    shadowColor: '#FFD700',
    animation: 'pulse',
    duration: 200,
  },
  clearOnClickOutside: true,
  enableKeyboardShortcuts: true,
  animateSelection: true,
};

export class AnnotationSelectionHandler extends EventEmitter {
  private config: SelectionConfig;
  private stateManager: SelectionStateManager;
  private hoveredAnnotations = new Map<string, string>(); // viewportId -> annotationId
  private highlightedElements = new Map<string, HTMLElement>(); // annotationId -> highlightElement
  private clickListeners = new Map<string, (event: MouseEvent) => void>(); // viewportId -> listener
  private keyboardListener: ((event: KeyboardEvent) => void) | null = null;

  constructor(config: Partial<SelectionConfig> = {}, stateManager?: SelectionStateManager) {
    super();
    this.config = { ...DEFAULT_SELECTION_CONFIG, ...config };
    this.stateManager = stateManager || selectionStateManager;

    this.initialize();
    this.setupStateManagerIntegration();

    log.info('AnnotationSelectionHandler initialized with SelectionStateManager', {
      component: 'AnnotationSelectionHandler',
      metadata: {
        multiSelect: this.config.multiSelect,
        animateSelection: this.config.animateSelection,
      },
    });
  }

  /**
   * Initialize the selection handler
   */
  private initialize(): void {
    if (this.config.enableKeyboardShortcuts) {
      this.setupKeyboardHandlers();
    }
  }

  /**
   * Setup integration with SelectionStateManager
   */
  private setupStateManagerIntegration(): void {
    // Listen to state manager events and sync visual highlights
    this.stateManager.on('state-changed', (beforeState, afterState) => {
      this.syncVisualHighlights(afterState.viewportId, afterState);
      this.emit('selection-state-changed', beforeState, afterState);
    });

    // Forward bulk operation events
    this.stateManager.on('bulk-operation-started', (operationType, total) => {
      this.emit('bulk-operation-started', operationType, total);
    });

    this.stateManager.on('bulk-operation-progress', (completed, total) => {
      this.emit('bulk-operation-progress', completed, total);
    });

    this.stateManager.on('bulk-operation-completed', (operationType, completed, failed) => {
      this.emit('bulk-operation-completed', operationType, completed, failed);
    });

    // Forward other state management events
    this.stateManager.on('history-entry-added', entry => {
      this.emit('selection-history-updated', entry);
    });

    this.stateManager.on('state-restored', state => {
      this.emit('selection-state-restored', state);
    });

    this.stateManager.on('state-persisted', _state => {
      // Emit statistics update when state is persisted
      const stats = this.stateManager.getStatistics();
      this.emit('selection-statistics-updated', stats);
    });

    log.info('SelectionStateManager integration setup complete', {
      component: 'AnnotationSelectionHandler',
    });
  }

  /**
   * Sync visual highlights with state manager
   */
  private syncVisualHighlights(viewportId: string, state: any): void {
    try {
      // Remove all existing highlights for this viewport
      this.clearViewportHighlights(viewportId);

      // Apply highlights for currently selected annotations
      state.selectedAnnotationIds.forEach((annotationId: string) => {
        if (this.config.highlightSelected) {
          this.highlightSelectedAnnotation(annotationId, viewportId);
        }
      });
    } catch (error) {
      log.error(
        'Failed to sync visual highlights',
        {
          component: 'AnnotationSelectionHandler',
          metadata: { viewportId },
        },
        error as Error,
      );
    }
  }

  /**
   * Clear all highlights for a viewport
   */
  private clearViewportHighlights(_viewportId: string): void {
    // Remove highlights that belong to this viewport
    // (In a real implementation, you'd track which highlights belong to which viewport)
    this.highlightedElements.forEach((_element, annotationId) => {
      this.removeHighlight(annotationId);
    });
  }

  /**
   * Setup keyboard event handlers
   */
  private setupKeyboardHandlers(): void {
    this.keyboardListener = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          this.clearAllSelections();
          break;
        case 'Delete':
        case 'Backspace':
          this.deleteSelectedAnnotations();
          break;
        case 'a':
        case 'A':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            this.selectAllAnnotations();
          }
          break;
      }
    };

    document.addEventListener('keydown', this.keyboardListener);
  }

  /**
   * Setup click event handler for a viewport
   */
  public setupViewportClickHandler(viewportId: string, viewportElement: HTMLElement): void {
    // Remove existing listener if any
    this.removeViewportClickHandler(viewportId);

    const clickHandler = (event: MouseEvent) => {
      this.handleViewportClick(event, viewportId);
    };

    viewportElement.addEventListener('click', clickHandler);
    this.clickListeners.set(viewportId, clickHandler);

    log.info('Click handler setup for viewport', {
      component: 'AnnotationSelectionHandler',
      metadata: { viewportId },
    });
  }

  /**
   * Remove click event handler for a viewport
   */
  public removeViewportClickHandler(viewportId: string): void {
    const existingListener = this.clickListeners.get(viewportId);
    if (existingListener) {
      // Find viewport element and remove listener
      const viewportElement = document.querySelector(`[data-viewport-id="${viewportId}"]`) as HTMLElement;
      if (viewportElement) {
        viewportElement.removeEventListener('click', existingListener);
      }
      this.clickListeners.delete(viewportId);
    }
  }

  /**
   * Handle viewport click events
   */
  private handleViewportClick(event: MouseEvent, viewportId: string): void {
    try {
      // Check if click hit an annotation
      const annotation = this.getAnnotationAtPoint(event, viewportId);

      if (annotation) {
        // Click on annotation
        this.handleAnnotationClick(annotation, viewportId, event);
      } else {
        // Click on empty space
        if (this.config.clearOnClickOutside) {
          this.clearSelection(viewportId);
        }
      }
    } catch (error) {
      log.error(
        'Error handling viewport click',
        {
          component: 'AnnotationSelectionHandler',
          metadata: { viewportId },
        },
        error as Error,
      );
    }
  }

  /**
   * Handle annotation click
   */
  private handleAnnotationClick(annotation: AnnotationCompat, viewportId: string, event: MouseEvent): void {
    const annotationId = AnnotationCompatLayer.getAnnotationId(annotation);
    if (!annotationId) {
      log.warn('Cannot handle click on annotation without valid ID', {
        component: 'AnnotationSelectionHandler',
        metadata: { viewportId },
      });
      return;
    }

    const isSelected = this.isAnnotationSelected(annotationId, viewportId);
    const isMultiSelect = this.config.multiSelect && (event.ctrlKey || event.metaKey || event.shiftKey);

    if (isSelected) {
      // Deselect if already selected
      this.deselectAnnotation(annotation, viewportId);
    } else {
      // Select annotation
      if (isMultiSelect) {
        this.selectAnnotation(annotation, viewportId, true); // preserve existing selection
      } else {
        this.selectAnnotation(annotation, viewportId, false); // clear existing selection
      }
    }
  }

  /**
   * Select an annotation with Cornerstone3D v3 API and SelectionStateManager
   */
  public selectAnnotation(
    annotation: AnnotationCompat,
    viewportId: string,
    preserveSelected: boolean = false,
  ): boolean {
    const annotationId = AnnotationCompatLayer.getAnnotationId(annotation);
    if (!annotationId) {
      log.warn('Cannot select annotation without valid ID', {
        component: 'AnnotationSelectionHandler',
        metadata: { viewportId },
      });
      return false;
    }

    try {
      // Use AnnotationCompatLayer for Cornerstone3D v3 API compatibility
      const success = AnnotationCompatLayer.selectAnnotation(annotation, true, preserveSelected);

      if (success !== null) {
        // Update selection state through SelectionStateManager
        this.stateManager.selectAnnotation(viewportId, annotationId, preserveSelected, {
          source: 'user-click',
          timestamp: Date.now(),
          annotationType: (annotation.data as any)?.toolName || 'unknown',
        });

        // Emit events
        this.emit('annotation-selected', annotation, viewportId);
        this.emitSelectionChanged(viewportId);

        log.info('Annotation selected successfully via SelectionStateManager', {
          component: 'AnnotationSelectionHandler',
          metadata: { viewportId, annotationId, preserveSelected },
        });

        return true;
      }
    } catch (error) {
      log.error(
        'Failed to select annotation',
        {
          component: 'AnnotationSelectionHandler',
          metadata: { viewportId, annotationId },
        },
        error as Error,
      );
    }

    return false;
  }

  /**
   * Deselect an annotation
   */
  public deselectAnnotation(annotation: AnnotationCompat, viewportId: string): boolean {
    const annotationId = AnnotationCompatLayer.getAnnotationId(annotation);
    if (!annotationId) {
      return false;
    }

    try {
      // Use AnnotationCompatLayer for Cornerstone3D v3 API compatibility
      const success = AnnotationCompatLayer.selectAnnotation(annotation, false, true);

      if (success !== null) {
        // Update selection state through SelectionStateManager
        this.stateManager.deselectAnnotation(viewportId, annotationId, {
          source: 'user-action',
          timestamp: Date.now(),
          annotationType: (annotation.data as any)?.toolName || 'unknown',
        });

        // Emit events
        this.emit('annotation-deselected', annotation, viewportId);
        this.emitSelectionChanged(viewportId);

        log.info('Annotation deselected successfully via SelectionStateManager', {
          component: 'AnnotationSelectionHandler',
          metadata: { viewportId, annotationId },
        });

        return true;
      }
    } catch (error) {
      log.error(
        'Failed to deselect annotation',
        {
          component: 'AnnotationSelectionHandler',
          metadata: { viewportId, annotationId },
        },
        error as Error,
      );
    }

    return false;
  }

  /**
   * Clear selection for a viewport
   */
  public clearSelection(viewportId: string): void {
    const currentState = this.stateManager.getCurrentState(viewportId);
    if (!currentState || currentState.selectedAnnotationIds.size === 0) {
      return;
    }

    try {
      // Get all selected annotations for this viewport - mock implementation
      log.info('Mock getSelectedAnnotations - function not implemented yet');
      const selectedAnnotations: any[] = [];

      // Deselect all annotations through Cornerstone API
      selectedAnnotations.forEach((annotation: any) => {
        AnnotationCompatLayer.selectAnnotation(annotation, false, true);
      });

      // Clear selection state through SelectionStateManager
      this.stateManager.clearSelection(viewportId, {
        source: 'user-action',
        timestamp: Date.now(),
        clearedCount: currentState.selectedAnnotationIds.size,
      });

      // Emit event
      this.emit('selection-cleared', viewportId);
      this.emitSelectionChanged(viewportId);

      log.info('Selection cleared for viewport via SelectionStateManager', {
        component: 'AnnotationSelectionHandler',
        metadata: { viewportId, clearedCount: currentState.selectedAnnotationIds.size },
      });
    } catch (error) {
      log.error(
        'Failed to clear selection',
        {
          component: 'AnnotationSelectionHandler',
          metadata: { viewportId },
        },
        error as Error,
      );
    }
  }

  /**
   * Clear all selections across all viewports
   */
  public clearAllSelections(): void {
    const viewportIds = this.stateManager.getActiveViewportIds();
    viewportIds.forEach(viewportId => {
      this.clearSelection(viewportId);
    });
  }

  /**
   * Select all annotations in a viewport
   */
  public selectAllAnnotations(viewportId?: string): void {
    if (viewportId) {
      this.selectAllInViewport(viewportId);
    } else {
      // Select all in all viewports
      // Mock implementation - method not available
      const viewportIds: string[] = [];
      viewportIds.forEach(id => this.selectAllInViewport(id));
    }
  }

  /**
   * Deselect all annotations in a viewport
   */
  public deselectAllAnnotations(viewportId?: string): void {
    if (viewportId) {
      this.clearSelection(viewportId);
    } else {
      this.clearAllSelections();
    }
  }

  /**
   * Select all annotations in a specific viewport
   */
  private selectAllInViewport(viewportId: string): void {
    try {
      const toolState = toolStateManager.getViewportToolState(viewportId);
      if (!toolState) {
        return;
      }

      // Select all annotations
      toolState.annotations.forEach(annotationState => {
        // Convert to AnnotationCompat
        const annotation: AnnotationCompat = {
          annotationUID: annotationState.id,
          uid: annotationState.id,
          id: annotationState.id,
          annotationId: annotationState.id,
        };

        this.selectAnnotation(annotation, viewportId, true);
      });
    } catch (error) {
      log.error(
        'Failed to select all annotations',
        {
          component: 'AnnotationSelectionHandler',
          metadata: { viewportId },
        },
        error as Error,
      );
    }
  }

  /**
   * Delete selected annotations
   */
  public deleteSelectedAnnotations(viewportId?: string): void {
    if (viewportId) {
      this.deleteSelectedInViewport(viewportId);
    } else {
      // Delete selected in all viewports
      // Mock implementation - method not available
      const viewportIds: string[] = [];
      viewportIds.forEach(id => this.deleteSelectedInViewport(id));
    }
  }

  /**
   * Delete selected annotations in a specific viewport
   */
  private deleteSelectedInViewport(viewportId: string): void {
    // Mock implementation - method not available
    const viewportSelections = new Set();
    if (!viewportSelections || viewportSelections.size === 0) {
      return;
    }

    try {
      // Mock implementation - function not available
      log.info('Mock getSelectedAnnotations - function not implemented yet');
      const selectedAnnotations: any[] = [];

      selectedAnnotations.forEach((annotation: any) => {
        AnnotationCompatLayer.deleteAnnotation(annotation);
        const annotationId = AnnotationCompatLayer.getAnnotationId(annotation);
        if (annotationId) {
          this.removeHighlight(annotationId);
        }
      });

      // Clear selection state
      viewportSelections.clear();
      this.emitSelectionChanged(viewportId);

      log.info('Selected annotations deleted', {
        component: 'AnnotationSelectionHandler',
        metadata: { viewportId, deletedCount: selectedAnnotations.length },
      });
    } catch (error) {
      log.error(
        'Failed to delete selected annotations',
        {
          component: 'AnnotationSelectionHandler',
          metadata: { viewportId },
        },
        error as Error,
      );
    }
  }

  /**
   * Apply sky blue highlight to selected annotation
   */
  public highlightSelectedAnnotation(annotationId: string, _viewportId: string): void {
    this.applyHighlight(annotationId, this.config.selectionStyle, 'selected');
  }

  /**
   * Apply hover highlight to annotation
   */
  public highlightHoveredAnnotation(annotationId: string, _viewportId: string): void {
    if (this.config.highlightHovered) {
      this.applyHighlight(annotationId, this.config.hoverStyle, 'hovered');
    }
  }

  /**
   * Apply highlight with specific style
   */
  private applyHighlight(annotationId: string, style: HighlightStyle, type: 'selected' | 'hovered'): void {
    try {
      // Find annotation element in DOM
      const annotationElement = document.querySelector(`[data-annotation-id="${annotationId}"]`) as HTMLElement;
      if (!annotationElement) {
        log.warn('Annotation element not found for highlighting', {
          component: 'AnnotationSelectionHandler',
          metadata: { annotationId, type },
        });
        return;
      }

      // Create or update highlight overlay
      let highlightElement = this.highlightedElements.get(annotationId);
      if (!highlightElement) {
        highlightElement = this.createHighlightElement(annotationId, style);
        this.highlightedElements.set(annotationId, highlightElement);
      } else {
        this.updateHighlightStyle(highlightElement, style);
      }

      // Apply animation if configured
      if (this.config.animateSelection && style.animation && style.animation !== 'none') {
        this.applyHighlightAnimation(highlightElement, style);
      }

      // Emit event
      this.emit('highlight-applied', annotationId, style);

      log.info('Highlight applied to annotation', {
        component: 'AnnotationSelectionHandler',
        metadata: { annotationId, type, color: style.color },
      });
    } catch (error) {
      log.error(
        'Failed to apply highlight',
        {
          component: 'AnnotationSelectionHandler',
          metadata: { annotationId, type },
        },
        error as Error,
      );
    }
  }

  /**
   * Create highlight element
   */
  private createHighlightElement(annotationId: string, style: HighlightStyle): HTMLElement {
    const highlightElement = document.createElement('div');
    highlightElement.className = cn('annotation-highlight', 'absolute pointer-events-none z-10');
    highlightElement.setAttribute('data-highlight-for', annotationId);

    this.updateHighlightStyle(highlightElement, style);

    // Append to annotation parent or viewport
    const annotationElement = document.querySelector(`[data-annotation-id="${annotationId}"]`);
    const container = annotationElement?.parentElement || document.body;
    container.appendChild(highlightElement);

    return highlightElement;
  }

  /**
   * Update highlight element style
   */
  private updateHighlightStyle(element: HTMLElement, style: HighlightStyle): void {
    element.style.cssText = `
      border: ${style.strokeWidth}px solid ${style.color};
      background-color: ${style.color};
      opacity: ${style.opacity};
      box-shadow: 0 0 ${style.shadowBlur}px ${style.shadowColor};
      transition: all 0.2s ease-in-out;
    `;
  }

  /**
   * Apply highlight animation
   */
  private applyHighlightAnimation(element: HTMLElement, style: HighlightStyle): void {
    const duration = style.duration || 300;

    switch (style.animation) {
      case 'pulse':
        element.style.animation = `annotation-pulse ${duration}ms ease-in-out infinite alternate`;
        break;
      case 'glow':
        element.style.animation = `annotation-glow ${duration}ms ease-in-out`;
        break;
    }
  }

  /**
   * Remove highlight from annotation
   */
  public removeHighlight(annotationId: string): void {
    const highlightElement = this.highlightedElements.get(annotationId);
    if (highlightElement) {
      highlightElement.remove();
      this.highlightedElements.delete(annotationId);
      this.emit('highlight-removed', annotationId);
    }
  }

  /**
   * Check if annotation is selected
   */
  public isAnnotationSelected(annotationId: string, viewportId: string): boolean {
    return this.stateManager.isAnnotationSelected(viewportId, annotationId);
  }

  /**
   * Get selected annotations for a viewport
   */
  public getSelectedAnnotations(viewportId: string): AnnotationCompat[] {
    try {
      const selectedIds = this.stateManager.getSelectedAnnotationIds(viewportId);
      // Convert IDs back to AnnotationCompat objects
      // In a real implementation, you'd need to look up actual annotation objects
      return selectedIds.map(
        id =>
          ({
            annotationUID: id,
            uid: id,
            id,
            annotationId: id,
          }) as AnnotationCompat,
      );
    } catch (error) {
      log.error(
        'Failed to get selected annotations',
        {
          component: 'AnnotationSelectionHandler',
          metadata: { viewportId },
        },
        error as Error,
      );
      return [];
    }
  }

  /**
   * Get selected annotation IDs for a viewport
   */
  public getSelectedAnnotationIds(viewportId: string): string[] {
    return this.stateManager.getSelectedAnnotationIds(viewportId);
  }

  /**
   * Get annotation at mouse click point
   */
  private getAnnotationAtPoint(event: MouseEvent, viewportId: string): AnnotationCompat | null {
    try {
      // This would use Cornerstone3D's hit detection API
      // For now, we'll simulate by checking DOM elements
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const annotationElement = element?.closest('[data-annotation-id]') as HTMLElement;

      if (annotationElement) {
        const annotationId = annotationElement.getAttribute('data-annotation-id');
        if (annotationId) {
          // Return a basic AnnotationCompat object
          return {
            annotationUID: annotationId,
            uid: annotationId,
            id: annotationId,
            annotationId,
          };
        }
      }

      return null;
    } catch (error) {
      log.error(
        'Failed to get annotation at point',
        {
          component: 'AnnotationSelectionHandler',
          metadata: { viewportId },
        },
        error as Error,
      );
      return null;
    }
  }

  /**
   * Emit selection changed event
   */
  private emitSelectionChanged(viewportId: string): void {
    const selectedAnnotations = this.getSelectedAnnotations(viewportId);
    this.emit('selection-changed', selectedAnnotations, viewportId);
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<SelectionConfig>): void {
    this.config = { ...this.config, ...updates };

    log.info('Selection handler configuration updated', {
      component: 'AnnotationSelectionHandler',
      metadata: { updatedKeys: Object.keys(updates) },
    });
  }

  /**
   * Get current configuration
   */
  public getConfig(): SelectionConfig {
    return { ...this.config };
  }

  // ===== NEW SELECTION STATE MANAGEMENT METHODS =====

  /**
   * Select multiple annotations using bulk operation
   */
  public async selectMultipleAnnotations(
    viewportId: string,
    annotationIds: string[],
    preserveExisting: boolean = true,
  ): Promise<boolean> {
    try {
      await this.stateManager.selectMultipleAnnotations(viewportId, annotationIds, preserveExisting, {
        progressCallback: (completed, total) => {
          this.emit('bulk-operation-progress', completed, total);
        },
        errorCallback: (error, annotation) => {
          log.error(
            'Bulk selection error for annotation',
            {
              component: 'AnnotationSelectionHandler',
              metadata: { viewportId, annotationId: annotation.annotationId },
            },
            error,
          );
        },
      });

      this.emitSelectionChanged(viewportId);
      return true;
    } catch (error) {
      log.error(
        'Failed to select multiple annotations',
        {
          component: 'AnnotationSelectionHandler',
          metadata: { viewportId, count: annotationIds.length },
        },
        error as Error,
      );
      return false;
    }
  }

  /**
   * Deselect multiple annotations using bulk operation
   */
  public async deselectMultipleAnnotations(viewportId: string, annotationIds: string[]): Promise<boolean> {
    try {
      await this.stateManager.deselectMultipleAnnotations(viewportId, annotationIds, {
        progressCallback: (completed, total) => {
          this.emit('bulk-operation-progress', completed, total);
        },
        errorCallback: (error, annotation) => {
          log.error(
            'Bulk deselection error for annotation',
            {
              component: 'AnnotationSelectionHandler',
              metadata: { viewportId, annotationId: annotation.annotationId },
            },
            error,
          );
        },
      });

      this.emitSelectionChanged(viewportId);
      return true;
    } catch (error) {
      log.error(
        'Failed to deselect multiple annotations',
        {
          component: 'AnnotationSelectionHandler',
          metadata: { viewportId, count: annotationIds.length },
        },
        error as Error,
      );
      return false;
    }
  }

  /**
   * Get selection count for a viewport
   */
  public getSelectionCount(viewportId: string): number {
    return this.stateManager.getSelectionCount(viewportId);
  }

  /**
   * Get selection history for a viewport
   */
  public getSelectionHistory(limit?: number): ReadonlyArray<any> {
    return this.stateManager.getHistory(limit);
  }

  /**
   * Undo last selection operation
   */
  public undoLastSelection(viewportId: string): boolean {
    try {
      const restoredState = this.stateManager.undoLastOperation(viewportId);
      if (restoredState) {
        // Sync visual highlights with restored state
        this.syncVisualHighlights(viewportId, restoredState);
        this.emitSelectionChanged(viewportId);

        log.info('Selection operation undone successfully', {
          component: 'AnnotationSelectionHandler',
          metadata: { viewportId, restoredCount: restoredState.selectedAnnotationIds.size },
        });

        return true;
      }
      return false;
    } catch (error) {
      log.error(
        'Failed to undo selection operation',
        {
          component: 'AnnotationSelectionHandler',
          metadata: { viewportId },
        },
        error as Error,
      );
      return false;
    }
  }

  /**
   * Save current selection state for session persistence
   */
  public saveSelectionState(viewportId: string): string {
    return this.stateManager.persistState(viewportId);
  }

  /**
   * Restore selection state from saved data
   */
  public restoreSelectionState(viewportId: string, savedState: string): boolean {
    try {
      const restoredState = this.stateManager.restoreState(viewportId, savedState);
      if (restoredState) {
        // Sync visual highlights with restored state
        this.syncVisualHighlights(viewportId, restoredState);
        this.emitSelectionChanged(viewportId);

        log.info('Selection state restored successfully', {
          component: 'AnnotationSelectionHandler',
          metadata: { viewportId, restoredCount: restoredState.selectedAnnotationIds.size },
        });

        return true;
      }
      return false;
    } catch (error) {
      log.error(
        'Failed to restore selection state',
        {
          component: 'AnnotationSelectionHandler',
          metadata: { viewportId },
        },
        error as Error,
      );
      return false;
    }
  }

  /**
   * Get selection statistics across all viewports
   */
  public getSelectionStatistics(): {
    totalViewports: number;
    activeViewports: number;
    totalSelections: number;
    historyEntries: number;
    oldestHistoryEntry?: Date;
    newestHistoryEntry?: Date;
    } {
    return this.stateManager.getStatistics();
  }

  /**
   * Clear selection history for a viewport or all viewports
   */
  public clearSelectionHistory(viewportId?: string): void {
    this.stateManager.clearHistory(viewportId);

    log.info('Selection history cleared', {
      component: 'AnnotationSelectionHandler',
      metadata: { viewportId: viewportId || 'all' },
    });
  }

  /**
   * Get current selection state for a viewport
   */
  public getCurrentSelectionState(viewportId: string): any {
    return this.stateManager.getCurrentState(viewportId);
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    // Remove keyboard listener
    if (this.keyboardListener) {
      document.removeEventListener('keydown', this.keyboardListener);
      this.keyboardListener = null;
    }

    // Remove all click listeners
    this.clickListeners.forEach((_listener, viewportId) => {
      this.removeViewportClickHandler(viewportId);
    });

    // Remove all highlights
    this.highlightedElements.forEach((_element, annotationId) => {
      this.removeHighlight(annotationId);
    });

    // Clear internal state
    this.hoveredAnnotations.clear();
    this.highlightedElements.clear();
    this.clickListeners.clear();

    // Dispose state manager (if we own it)
    // Note: We don't dispose the shared singleton instance
    // this.stateManager.dispose();

    // Remove all event listeners
    this.removeAllListeners();

    log.info('AnnotationSelectionHandler disposed', {
      component: 'AnnotationSelectionHandler',
    });
  }
}

// Add CSS animations for highlights (would be added to global CSS)
export const highlightCSS = `
@keyframes annotation-pulse {
  0% { opacity: 0.6; transform: scale(1); }
  100% { opacity: 1; transform: scale(1.02); }
}

@keyframes annotation-glow {
  0% { box-shadow: 0 0 5px currentColor; }
  50% { box-shadow: 0 0 20px currentColor, 0 0 30px currentColor; }
  100% { box-shadow: 0 0 5px currentColor; }
}

.annotation-highlight {
  border-radius: 4px;
  pointer-events: none;
  z-index: 1000;
}
`;

// Export singleton instance with enhanced selection state management
export const annotationSelectionHandler = new AnnotationSelectionHandler();

// Export SelectionStateManager for direct access if needed
export { selectionStateManager, SelectionStateManager } from './SelectionStateManager';

export default annotationSelectionHandler;
