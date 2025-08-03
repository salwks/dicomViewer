/**
 * Annotation Selection Handler
 * Advanced annotation selection system for Cornerstone3D v3
 * Provides click handling, visual feedback, and selection state management
 */

import { EventEmitter } from 'events';
import { AnnotationCompat, AnnotationCompatLayer } from '../types/annotation-compat';
import { toolStateManager } from './ToolStateManager';
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
  private selectedAnnotations = new Map<string, Set<string>>(); // viewportId -> Set<annotationId>
  private hoveredAnnotations = new Map<string, string>(); // viewportId -> annotationId
  private highlightedElements = new Map<string, HTMLElement>(); // annotationId -> highlightElement
  private clickListeners = new Map<string, (event: MouseEvent) => void>(); // viewportId -> listener
  private keyboardListener: ((event: KeyboardEvent) => void) | null = null;

  constructor(config: Partial<SelectionConfig> = {}) {
    super();
    this.config = { ...DEFAULT_SELECTION_CONFIG, ...config };

    this.initialize();

    log.info('AnnotationSelectionHandler initialized', {
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
      log.error('Error handling viewport click', {
        component: 'AnnotationSelectionHandler',
        metadata: { viewportId },
      }, error as Error);
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
   * Select an annotation with Cornerstone3D v3 API
   */
  public selectAnnotation(annotation: AnnotationCompat, viewportId: string, preserveSelected: boolean = false): boolean {
    const annotationId = AnnotationCompatLayer.getAnnotationId(annotation);
    if (!annotationId) {
      log.warn('Cannot select annotation without valid ID', {
        component: 'AnnotationSelectionHandler',
        metadata: { viewportId },
      });
      return false;
    }

    try {
      // Clear previous selection if not preserving
      if (!preserveSelected) {
        this.clearSelection(viewportId);
      }

      // Use AnnotationCompatLayer for Cornerstone3D v3 API compatibility
      const success = AnnotationCompatLayer.selectAnnotation(annotation, true, preserveSelected);

      if (success) {
        // Update internal state
        if (!this.selectedAnnotations.has(viewportId)) {
          this.selectedAnnotations.set(viewportId, new Set());
        }
        this.selectedAnnotations.get(viewportId)!.add(annotationId);

        // Apply visual highlight
        if (this.config.highlightSelected) {
          this.highlightSelectedAnnotation(annotationId, viewportId);
        }

        // Emit events
        this.emit('annotation-selected', annotation, viewportId);
        this.emitSelectionChanged(viewportId);

        log.info('Annotation selected successfully', {
          component: 'AnnotationSelectionHandler',
          metadata: { viewportId, annotationId, preserveSelected },
        });

        return true;
      }
    } catch (error) {
      log.error('Failed to select annotation', {
        component: 'AnnotationSelectionHandler',
        metadata: { viewportId, annotationId },
      }, error as Error);
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

      if (success) {
        // Update internal state
        const viewportSelections = this.selectedAnnotations.get(viewportId);
        if (viewportSelections) {
          viewportSelections.delete(annotationId);
        }

        // Remove visual highlight
        this.removeHighlight(annotationId);

        // Emit events
        this.emit('annotation-deselected', annotation, viewportId);
        this.emitSelectionChanged(viewportId);

        log.info('Annotation deselected successfully', {
          component: 'AnnotationSelectionHandler',
          metadata: { viewportId, annotationId },
        });

        return true;
      }
    } catch (error) {
      log.error('Failed to deselect annotation', {
        component: 'AnnotationSelectionHandler',
        metadata: { viewportId, annotationId },
      }, error as Error);
    }

    return false;
  }

  /**
   * Clear selection for a viewport
   */
  public clearSelection(viewportId: string): void {
    const viewportSelections = this.selectedAnnotations.get(viewportId);
    if (!viewportSelections || viewportSelections.size === 0) {
      return;
    }

    try {
      // Get all selected annotations for this viewport
      const selectedAnnotations = AnnotationCompatLayer.getSelectedAnnotations();

      // Deselect all annotations
      selectedAnnotations.forEach(annotation => {
        AnnotationCompatLayer.selectAnnotation(annotation, false, true);
        const annotationId = AnnotationCompatLayer.getAnnotationId(annotation);
        if (annotationId) {
          this.removeHighlight(annotationId);
        }
      });

      // Clear internal state
      viewportSelections.clear();

      // Emit event
      this.emit('selection-cleared', viewportId);
      this.emitSelectionChanged(viewportId);

      log.info('Selection cleared for viewport', {
        component: 'AnnotationSelectionHandler',
        metadata: { viewportId },
      });

    } catch (error) {
      log.error('Failed to clear selection', {
        component: 'AnnotationSelectionHandler',
        metadata: { viewportId },
      }, error as Error);
    }
  }

  /**
   * Clear all selections across all viewports
   */
  public clearAllSelections(): void {
    const viewportIds = Array.from(this.selectedAnnotations.keys());
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
      const viewportIds = Array.from(this.selectedAnnotations.keys());
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
      log.error('Failed to select all annotations', {
        component: 'AnnotationSelectionHandler',
        metadata: { viewportId },
      }, error as Error);
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
      const viewportIds = Array.from(this.selectedAnnotations.keys());
      viewportIds.forEach(id => this.deleteSelectedInViewport(id));
    }
  }

  /**
   * Delete selected annotations in a specific viewport
   */
  private deleteSelectedInViewport(viewportId: string): void {
    const viewportSelections = this.selectedAnnotations.get(viewportId);
    if (!viewportSelections || viewportSelections.size === 0) {
      return;
    }

    try {
      const selectedAnnotations = AnnotationCompatLayer.getSelectedAnnotations();

      selectedAnnotations.forEach(annotation => {
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
      log.error('Failed to delete selected annotations', {
        component: 'AnnotationSelectionHandler',
        metadata: { viewportId },
      }, error as Error);
    }
  }

  /**
   * Apply sky blue highlight to selected annotation
   */
  public highlightSelectedAnnotation(annotationId: string, viewportId: string): void {
    this.applyHighlight(annotationId, this.config.selectionStyle, 'selected');
  }

  /**
   * Apply hover highlight to annotation
   */
  public highlightHoveredAnnotation(annotationId: string, viewportId: string): void {
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
      log.error('Failed to apply highlight', {
        component: 'AnnotationSelectionHandler',
        metadata: { annotationId, type },
      }, error as Error);
    }
  }

  /**
   * Create highlight element
   */
  private createHighlightElement(annotationId: string, style: HighlightStyle): HTMLElement {
    const highlightElement = document.createElement('div');
    highlightElement.className = cn(
      'annotation-highlight',
      'absolute pointer-events-none z-10',
    );
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
    const viewportSelections = this.selectedAnnotations.get(viewportId);
    return viewportSelections ? viewportSelections.has(annotationId) : false;
  }

  /**
   * Get selected annotations for a viewport
   */
  public getSelectedAnnotations(viewportId: string): AnnotationCompat[] {
    try {
      const allSelected = AnnotationCompatLayer.getSelectedAnnotations();
      // Filter by viewport if needed (would require additional metadata)
      return allSelected;
    } catch (error) {
      log.error('Failed to get selected annotations', {
        component: 'AnnotationSelectionHandler',
        metadata: { viewportId },
      }, error as Error);
      return [];
    }
  }

  /**
   * Get selected annotation IDs for a viewport
   */
  public getSelectedAnnotationIds(viewportId: string): string[] {
    const viewportSelections = this.selectedAnnotations.get(viewportId);
    if (!viewportSelections) {
      return [];
    }
    return Array.from(viewportSelections);
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
      log.error('Failed to get annotation at point', {
        component: 'AnnotationSelectionHandler',
        metadata: { viewportId },
      }, error as Error);
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
    this.clickListeners.forEach((listener, viewportId) => {
      this.removeViewportClickHandler(viewportId);
    });

    // Remove all highlights
    this.highlightedElements.forEach((element, annotationId) => {
      this.removeHighlight(annotationId);
    });

    // Clear internal state
    this.selectedAnnotations.clear();
    this.hoveredAnnotations.clear();
    this.highlightedElements.clear();
    this.clickListeners.clear();

    // Remove all event listeners
    this.removeAllListeners();

    log.info('AnnotationSelectionHandler disposed', {
      component: 'AnnotationSelectionHandler',
    });
  }
}

// Add CSS animations for highlights (would be added to global CSS)
const highlightCSS = `
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

// Export singleton instance
export const annotationSelectionHandler = new AnnotationSelectionHandler();
export default annotationSelectionHandler;
