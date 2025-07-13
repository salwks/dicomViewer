import { eventTarget } from '@cornerstonejs/core';
import { AnnotationManager, AnnotationData } from './annotationManager';
import { TextAnnotationTool } from './textAnnotation';
import { ArrowAnnotationTool } from './arrowAnnotation';

export interface AnnotationEventHandlerConfig {
    enableKeyboardShortcuts?: boolean;
    enableMouseInteractions?: boolean;
    enableTouchInteractions?: boolean;
    enableVisualFeedback?: boolean;
    enableUndoRedo?: boolean;
    keyboardShortcuts?: {
        textAnnotation?: string;
        arrowAnnotation?: string;
        deleteAnnotation?: string;
        selectAll?: string;
        copy?: string;
        paste?: string;
        undo?: string;
        redo?: string;
        escape?: string;
    };
    mouseBehavior?: {
        doubleClickToEdit?: boolean;
        rightClickContextMenu?: boolean;
        dragToMove?: boolean;
        hoverHighlight?: boolean;
    };
    touchBehavior?: {
        longPressToEdit?: boolean;
        pinchToZoom?: boolean;
        tapToSelect?: boolean;
    };
    visualFeedback?: {
        showTooltips?: boolean;
        highlightOnHover?: boolean;
        showSelectionHandles?: boolean;
        animateCreation?: boolean;
    };
}

export interface AnnotationEventDetail {
    annotationData: AnnotationData;
    eventType: string;
    timestamp: string;
    source: string;
    viewport?: any;
    element?: HTMLElement;
}

export class AnnotationEventHandler {
    private annotationManager: AnnotationManager;
    private textAnnotationTool: TextAnnotationTool | null = null;
    private arrowAnnotationTool: ArrowAnnotationTool | null = null;
    private config: AnnotationEventHandlerConfig;
    private eventListeners: Map<string, (event: any) => void> = new Map();
    private isInitialized: boolean = false;
    private selectedAnnotationId: string | null = null;
    private hoveredAnnotationId: string | null = null;
    private draggedAnnotationId: string | null = null;
    private undoStack: AnnotationData[] = [];
    private redoStack: AnnotationData[] = [];
    private maxUndoStackSize: number = 50;
    private clipboard: AnnotationData | null = null;

    constructor(
        annotationManager: AnnotationManager,
        textAnnotationTool?: TextAnnotationTool,
        arrowAnnotationTool?: ArrowAnnotationTool,
        config: AnnotationEventHandlerConfig = {}
    ) {
        this.annotationManager = annotationManager;
        this.textAnnotationTool = textAnnotationTool || null;
        this.arrowAnnotationTool = arrowAnnotationTool || null;
        
        this.config = {
            enableKeyboardShortcuts: true,
            enableMouseInteractions: true,
            enableTouchInteractions: true,
            enableVisualFeedback: true,
            enableUndoRedo: true,
            keyboardShortcuts: {
                textAnnotation: 'KeyT',
                arrowAnnotation: 'KeyA',
                deleteAnnotation: 'Delete',
                selectAll: 'KeyA',
                copy: 'KeyC',
                paste: 'KeyV',
                undo: 'KeyZ',
                redo: 'KeyY',
                escape: 'Escape'
            },
            mouseBehavior: {
                doubleClickToEdit: true,
                rightClickContextMenu: true,
                dragToMove: true,
                hoverHighlight: true
            },
            touchBehavior: {
                longPressToEdit: true,
                pinchToZoom: false,
                tapToSelect: true
            },
            visualFeedback: {
                showTooltips: true,
                highlightOnHover: true,
                showSelectionHandles: true,
                animateCreation: true
            },
            ...config
        };

        this.initialize();
    }

    private initialize(): void {
        try {
            this.setupAnnotationEventListeners();
            this.setupKeyboardEventListeners();
            this.setupMouseEventListeners();
            this.setupTouchEventListeners();
            this.setupVisualFeedbackListeners();
            
            this.isInitialized = true;
            console.log('✓ Annotation Event Handler initialized');

        } catch (error) {
            console.error('❌ Error initializing Annotation Event Handler:', error);
            throw error;
        }
    }

    private setupAnnotationEventListeners(): void {
        // Listen for annotation manager events
        const annotationAddedListener = (event: any) => {
            this.handleAnnotationAdded(event);
        };

        const annotationModifiedListener = (event: any) => {
            this.handleAnnotationModified(event);
        };

        const annotationRemovedListener = (event: any) => {
            this.handleAnnotationRemoved(event);
        };

        const annotationSelectedListener = (event: any) => {
            this.handleAnnotationSelected(event);
        };

        // Listen for tool-specific events
        const textAnnotationCreatedListener = (event: any) => {
            this.handleTextAnnotationCreated(event);
        };

        const arrowAnnotationCreatedListener = (event: any) => {
            this.handleArrowAnnotationCreated(event);
        };

        const arrowAnnotationCompletedListener = (event: any) => {
            this.handleArrowAnnotationCompleted(event);
        };

        // Listen for camera/zoom events to update annotation scaling
        const cameraModifiedListener = (event: any) => {
            this.handleCameraModified(event);
        };

        // Store event listeners for cleanup
        this.eventListeners.set('annotationAdded', annotationAddedListener);
        this.eventListeners.set('annotationModified', annotationModifiedListener);
        this.eventListeners.set('annotationRemoved', annotationRemovedListener);
        this.eventListeners.set('annotationSelected', annotationSelectedListener);
        this.eventListeners.set('textAnnotationCreated', textAnnotationCreatedListener);
        this.eventListeners.set('arrowAnnotationCreated', arrowAnnotationCreatedListener);
        this.eventListeners.set('arrowAnnotationCompleted', arrowAnnotationCompletedListener);
        this.eventListeners.set('cameraModified', cameraModifiedListener);

        // Add event listeners
        eventTarget.addEventListener('annotationAdded', annotationAddedListener);
        eventTarget.addEventListener('annotationModified', annotationModifiedListener);
        eventTarget.addEventListener('annotationRemoved', annotationRemovedListener);
        eventTarget.addEventListener('annotationSelected', annotationSelectedListener);
        eventTarget.addEventListener('textAnnotationCreated', textAnnotationCreatedListener);
        eventTarget.addEventListener('arrowAnnotationCreated', arrowAnnotationCreatedListener);
        eventTarget.addEventListener('arrowAnnotationCompleted', arrowAnnotationCompletedListener);
        eventTarget.addEventListener('CAMERA_MODIFIED', cameraModifiedListener);
    }

    private setupKeyboardEventListeners(): void {
        if (!this.config.enableKeyboardShortcuts) return;

        const keyboardListener = (event: Event) => {
            this.handleKeyboardEvent(event as KeyboardEvent);
        };

        this.eventListeners.set('keydown', keyboardListener);
        document.addEventListener('keydown', keyboardListener);
    }

    private setupMouseEventListeners(): void {
        if (!this.config.enableMouseInteractions) return;

        const mouseDownListener = (event: MouseEvent) => {
            this.handleMouseDown(event);
        };

        const mouseMoveListener = (event: MouseEvent) => {
            this.handleMouseMove(event);
        };

        const mouseUpListener = (event: MouseEvent) => {
            this.handleMouseUp(event);
        };

        const doubleClickListener = (event: MouseEvent) => {
            this.handleDoubleClick(event);
        };

        const contextMenuListener = (event: MouseEvent) => {
            this.handleContextMenu(event);
        };

        this.eventListeners.set('mousedown', mouseDownListener);
        this.eventListeners.set('mousemove', mouseMoveListener);
        this.eventListeners.set('mouseup', mouseUpListener);
        this.eventListeners.set('dblclick', doubleClickListener);
        this.eventListeners.set('contextmenu', contextMenuListener);

        // Note: In a real implementation, these would be attached to viewport elements
        // For now, we'll use document-level listeners
        document.addEventListener('mousedown', mouseDownListener);
        document.addEventListener('mousemove', mouseMoveListener);
        document.addEventListener('mouseup', mouseUpListener);
        document.addEventListener('dblclick', doubleClickListener);
        document.addEventListener('contextmenu', contextMenuListener);
    }

    private setupTouchEventListeners(): void {
        if (!this.config.enableTouchInteractions) return;

        const touchStartListener = (event: TouchEvent) => {
            this.handleTouchStart(event);
        };

        const touchMoveListener = (event: TouchEvent) => {
            this.handleTouchMove(event);
        };

        const touchEndListener = (event: TouchEvent) => {
            this.handleTouchEnd(event);
        };

        this.eventListeners.set('touchstart', touchStartListener);
        this.eventListeners.set('touchmove', touchMoveListener);
        this.eventListeners.set('touchend', touchEndListener);

        document.addEventListener('touchstart', touchStartListener);
        document.addEventListener('touchmove', touchMoveListener);
        document.addEventListener('touchend', touchEndListener);
    }

    private setupVisualFeedbackListeners(): void {
        if (!this.config.enableVisualFeedback) return;

        // Visual feedback is handled in the individual event handlers
        console.log('✓ Visual feedback listeners setup');
    }

    private handleAnnotationAdded(event: any): void {
        try {
            const detail = this.extractEventDetail(event);
            
            // Add to undo stack for undo/redo functionality
            if (this.config.enableUndoRedo) {
                this.pushToUndoStack(detail.annotationData);
            }

            // Provide visual feedback
            if (this.config.visualFeedback?.animateCreation) {
                this.animateAnnotationCreation(detail.annotationData);
            }

            // Show tooltip if enabled
            if (this.config.visualFeedback?.showTooltips) {
                this.showTooltip('Annotation added', 'success');
            }

            console.log('✓ Annotation added event handled:', detail.annotationData.annotationUID);

        } catch (error) {
            console.error('❌ Error handling annotation added:', error);
        }
    }

    private handleAnnotationModified(event: any): void {
        try {
            const detail = this.extractEventDetail(event);
            
            // Update visual feedback
            if (this.config.visualFeedback?.highlightOnHover) {
                this.highlightAnnotation(detail.annotationData.annotationUID, 'modified');
            }

            console.log('✓ Annotation modified event handled:', detail.annotationData.annotationUID);

        } catch (error) {
            console.error('❌ Error handling annotation modified:', error);
        }
    }

    private handleAnnotationRemoved(event: any): void {
        try {
            const detail = this.extractEventDetail(event);
            
            // Clear selection if removed annotation was selected
            if (this.selectedAnnotationId === detail.annotationData.annotationUID) {
                this.selectedAnnotationId = null;
            }

            // Clear hover if removed annotation was hovered
            if (this.hoveredAnnotationId === detail.annotationData.annotationUID) {
                this.hoveredAnnotationId = null;
            }

            // Show tooltip if enabled
            if (this.config.visualFeedback?.showTooltips) {
                this.showTooltip('Annotation removed', 'warning');
            }

            console.log('✓ Annotation removed event handled:', detail.annotationData.annotationUID);

        } catch (error) {
            console.error('❌ Error handling annotation removed:', error);
        }
    }

    private handleAnnotationSelected(event: any): void {
        try {
            const detail = this.extractEventDetail(event);
            
            this.selectedAnnotationId = detail.annotationData.annotationUID;
            
            // Show selection handles if enabled
            if (this.config.visualFeedback?.showSelectionHandles) {
                this.showSelectionHandles(detail.annotationData.annotationUID);
            }

            console.log('✓ Annotation selected event handled:', detail.annotationData.annotationUID);

        } catch (error) {
            console.error('❌ Error handling annotation selected:', error);
        }
    }

    private handleTextAnnotationCreated(event: any): void {
        try {
            const detail = this.extractEventDetail(event);
            
            // Handle text annotation specific logic
            console.log('✓ Text annotation created event handled:', detail.annotationData.annotationUID);

        } catch (error) {
            console.error('❌ Error handling text annotation created:', error);
        }
    }

    private handleArrowAnnotationCreated(event: any): void {
        try {
            const detail = this.extractEventDetail(event);
            
            // Handle arrow annotation specific logic
            console.log('✓ Arrow annotation created event handled:', detail.annotationData.annotationUID);

        } catch (error) {
            console.error('❌ Error handling arrow annotation created:', error);
        }
    }

    private handleArrowAnnotationCompleted(event: any): void {
        try {
            const detail = this.extractEventDetail(event);
            
            // Handle arrow annotation completion
            if (this.config.visualFeedback?.animateCreation) {
                this.animateAnnotationCreation(detail.annotationData);
            }

            console.log('✓ Arrow annotation completed event handled:', detail.annotationData.annotationUID);

        } catch (error) {
            console.error('❌ Error handling arrow annotation completed:', error);
        }
    }

    private handleCameraModified(event: any): void {
        try {
            console.log('🔍 [EVENT_DEBUG] handleCameraModified called');
            console.log('🔍 [EVENT_DEBUG] Event type:', event.type);
            console.log('🔍 [EVENT_DEBUG] Event detail:', event.detail);
            
            // Handle camera modifications (zoom, pan, rotation) to ensure annotations scale properly
            const detail = event.detail;
            
            if (detail && detail.camera) {
                console.log('🔍 [EVENT_DEBUG] Camera detail found, updating annotation scaling');
                // Update annotation scaling when camera changes
                this.updateAnnotationScaling(detail.camera);
            } else {
                console.log('🔍 [EVENT_DEBUG] No camera detail found in event');
            }

            console.log('✓ Camera modified event handled for annotation scaling');

        } catch (error) {
            console.error('❌ Error handling camera modified event:', error);
            if (error instanceof Error) {
                console.error('❌ Error stack:', error.stack);
            }
        }
    }

    private updateAnnotationScaling(camera: any): void {
        try {
            // This ensures annotations scale with zoom level changes
            // Cornerstone3D should handle this automatically, but we can trigger a re-render
            // to make sure annotations are properly scaled
            
            if (this.annotationManager) {
                // Get all annotations and trigger a re-render
                const annotations = this.annotationManager.getAnnotations();
                
                // Force re-render of annotations by triggering a modified event
                annotations.forEach(annotation => {
                    if (annotation.annotationUID) {
                        this.triggerAnnotationRefresh(annotation.annotationUID);
                    }
                });
            }

        } catch (error) {
            console.error('❌ Error updating annotation scaling:', error);
        }
    }

    private triggerAnnotationRefresh(annotationUID: string): void {
        try {
            // Trigger a refresh of the annotation to ensure proper scaling
            const customEvent = new CustomEvent('annotationRefresh', {
                detail: {
                    annotationUID,
                    timestamp: new Date().toISOString(),
                    source: 'AnnotationEventHandler'
                }
            });

            eventTarget.dispatchEvent(customEvent);

        } catch (error) {
            console.error('❌ Error triggering annotation refresh:', error);
        }
    }

    private handleKeyboardEvent(event: KeyboardEvent): void {
        try {
            const { code, ctrlKey, metaKey, altKey, shiftKey } = event;
            const cmdKey = ctrlKey || metaKey;

            // Handle keyboard shortcuts
            if (this.config.keyboardShortcuts) {
                if (code === this.config.keyboardShortcuts.textAnnotation && !cmdKey && !altKey) {
                    this.activateTextAnnotationTool();
                    event.preventDefault();
                    return;
                }

                if (code === this.config.keyboardShortcuts.arrowAnnotation && !cmdKey && !altKey) {
                    this.activateArrowAnnotationTool();
                    event.preventDefault();
                    return;
                }

                if (code === this.config.keyboardShortcuts.deleteAnnotation && !cmdKey && !altKey) {
                    this.deleteSelectedAnnotation();
                    event.preventDefault();
                    return;
                }

                if (code === this.config.keyboardShortcuts.selectAll && cmdKey && !altKey) {
                    this.selectAllAnnotations();
                    event.preventDefault();
                    return;
                }

                if (code === this.config.keyboardShortcuts.copy && cmdKey && !altKey) {
                    this.copySelectedAnnotation();
                    event.preventDefault();
                    return;
                }

                if (code === this.config.keyboardShortcuts.paste && cmdKey && !altKey) {
                    this.pasteAnnotation();
                    event.preventDefault();
                    return;
                }

                if (code === this.config.keyboardShortcuts.undo && cmdKey && !altKey && !shiftKey) {
                    this.undoLastAction();
                    event.preventDefault();
                    return;
                }

                if (code === this.config.keyboardShortcuts.redo && cmdKey && !altKey) {
                    this.redoLastAction();
                    event.preventDefault();
                    return;
                }

                if (code === this.config.keyboardShortcuts.escape && !cmdKey && !altKey) {
                    this.deselectAllAnnotations();
                    event.preventDefault();
                    return;
                }
            }

        } catch (error) {
            console.error('❌ Error handling keyboard event:', error);
        }
    }

    private handleMouseDown(event: MouseEvent): void {
        try {
            // Handle mouse down for annotation interaction
            if (this.config.mouseBehavior?.dragToMove) {
                this.startAnnotationDrag(event);
            }

        } catch (error) {
            console.error('❌ Error handling mouse down:', error);
        }
    }

    private handleMouseMove(event: MouseEvent): void {
        try {
            // Handle mouse move for hover effects and dragging
            if (this.config.mouseBehavior?.hoverHighlight) {
                this.updateHoverHighlight(event);
            }

            if (this.draggedAnnotationId) {
                this.updateAnnotationDrag(event);
            }

        } catch (error) {
            console.error('❌ Error handling mouse move:', error);
        }
    }

    private handleMouseUp(event: MouseEvent): void {
        try {
            // Handle mouse up for completing drag operations
            if (this.draggedAnnotationId) {
                this.completeAnnotationDrag(event);
            }

        } catch (error) {
            console.error('❌ Error handling mouse up:', error);
        }
    }

    private handleDoubleClick(event: MouseEvent): void {
        try {
            if (this.config.mouseBehavior?.doubleClickToEdit) {
                this.editAnnotationAtPosition(event);
            }

        } catch (error) {
            console.error('❌ Error handling double click:', error);
        }
    }

    private handleContextMenu(event: MouseEvent): void {
        try {
            if (this.config.mouseBehavior?.rightClickContextMenu) {
                this.showContextMenu(event);
            }

        } catch (error) {
            console.error('❌ Error handling context menu:', error);
        }
    }

    private handleTouchStart(event: TouchEvent): void {
        try {
            // Handle touch start for mobile interactions
            if (this.config.touchBehavior?.tapToSelect) {
                this.handleTouchSelect(event);
            }

        } catch (error) {
            console.error('❌ Error handling touch start:', error);
        }
    }

    private handleTouchMove(event: TouchEvent): void {
        try {
            // Handle touch move for mobile interactions
            console.log('Touch move handled');

        } catch (error) {
            console.error('❌ Error handling touch move:', error);
        }
    }

    private handleTouchEnd(event: TouchEvent): void {
        try {
            // Handle touch end for mobile interactions
            console.log('Touch end handled');

        } catch (error) {
            console.error('❌ Error handling touch end:', error);
        }
    }

    private extractEventDetail(event: any): AnnotationEventDetail {
        return {
            annotationData: event.detail?.annotationData || {},
            eventType: event.detail?.eventType || event.type || 'unknown',
            timestamp: event.detail?.timestamp || new Date().toISOString(),
            source: event.detail?.source || 'unknown',
            viewport: event.detail?.viewport,
            element: event.detail?.element
        };
    }

    // Tool activation methods
    private activateTextAnnotationTool(): void {
        try {
            if (this.textAnnotationTool) {
                this.textAnnotationTool.enableTextTool();
                this.showTooltip('Text annotation tool activated', 'info');
            }
        } catch (error) {
            console.error('❌ Error activating text annotation tool:', error);
        }
    }

    private activateArrowAnnotationTool(): void {
        try {
            if (this.arrowAnnotationTool) {
                this.arrowAnnotationTool.enableArrowTool();
                this.showTooltip('Arrow annotation tool activated', 'info');
            }
        } catch (error) {
            console.error('❌ Error activating arrow annotation tool:', error);
        }
    }

    // Selection methods
    private selectAllAnnotations(): void {
        try {
            const annotations = this.annotationManager.getAnnotations();
            console.log(`Selected ${annotations.length} annotations`);
            this.showTooltip(`Selected ${annotations.length} annotations`, 'info');
        } catch (error) {
            console.error('❌ Error selecting all annotations:', error);
        }
    }

    private deselectAllAnnotations(): void {
        try {
            this.selectedAnnotationId = null;
            this.hoveredAnnotationId = null;
            this.showTooltip('All annotations deselected', 'info');
        } catch (error) {
            console.error('❌ Error deselecting all annotations:', error);
        }
    }

    private deleteSelectedAnnotation(): void {
        try {
            if (this.selectedAnnotationId) {
                this.annotationManager.removeAnnotation(this.selectedAnnotationId);
                this.selectedAnnotationId = null;
                this.showTooltip('Annotation deleted', 'success');
            }
        } catch (error) {
            console.error('❌ Error deleting selected annotation:', error);
        }
    }

    // Clipboard methods
    private copySelectedAnnotation(): void {
        try {
            if (this.selectedAnnotationId) {
                const annotation = this.annotationManager.getAnnotation(this.selectedAnnotationId);
                if (annotation) {
                    this.clipboard = { ...annotation };
                    this.showTooltip('Annotation copied', 'success');
                }
            }
        } catch (error) {
            console.error('❌ Error copying annotation:', error);
        }
    }

    private pasteAnnotation(): void {
        try {
            if (this.clipboard) {
                // Create new annotation with modified ID
                const newAnnotation = {
                    ...this.clipboard,
                    annotationUID: `${this.clipboard.annotationUID}_copy_${Date.now()}`
                };
                
                this.annotationManager.addAnnotation(newAnnotation);
                this.showTooltip('Annotation pasted', 'success');
            }
        } catch (error) {
            console.error('❌ Error pasting annotation:', error);
        }
    }

    // Undo/Redo methods
    private pushToUndoStack(annotation: AnnotationData): void {
        try {
            this.undoStack.push({ ...annotation });
            
            // Limit stack size
            if (this.undoStack.length > this.maxUndoStackSize) {
                this.undoStack.shift();
            }
            
            // Clear redo stack when new action is performed
            this.redoStack = [];
            
        } catch (error) {
            console.error('❌ Error pushing to undo stack:', error);
        }
    }

    private undoLastAction(): void {
        try {
            if (this.undoStack.length > 0) {
                const lastAction = this.undoStack.pop();
                if (lastAction) {
                    this.redoStack.push(lastAction);
                    this.showTooltip('Action undone', 'info');
                }
            }
        } catch (error) {
            console.error('❌ Error undoing last action:', error);
        }
    }

    private redoLastAction(): void {
        try {
            if (this.redoStack.length > 0) {
                const lastUndone = this.redoStack.pop();
                if (lastUndone) {
                    this.undoStack.push(lastUndone);
                    this.showTooltip('Action redone', 'info');
                }
            }
        } catch (error) {
            console.error('❌ Error redoing last action:', error);
        }
    }

    // Visual feedback methods
    private showTooltip(message: string, type: 'info' | 'success' | 'warning' | 'error'): void {
        try {
            if (!this.config.visualFeedback?.showTooltips) return;

            const tooltip = document.createElement('div');
            tooltip.className = `annotation-tooltip annotation-tooltip-${type}`;
            tooltip.textContent = message;
            tooltip.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 8px 12px;
                border-radius: 4px;
                color: white;
                font-size: 12px;
                z-index: 10000;
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: none;
            `;

            // Set background color based on type
            switch (type) {
                case 'info':
                    tooltip.style.backgroundColor = '#3b82f6';
                    break;
                case 'success':
                    tooltip.style.backgroundColor = '#10b981';
                    break;
                case 'warning':
                    tooltip.style.backgroundColor = '#f59e0b';
                    break;
                case 'error':
                    tooltip.style.backgroundColor = '#ef4444';
                    break;
            }

            document.body.appendChild(tooltip);

            // Animate in
            setTimeout(() => {
                tooltip.style.opacity = '1';
            }, 100);

            // Remove after delay
            setTimeout(() => {
                tooltip.style.opacity = '0';
                setTimeout(() => {
                    if (tooltip.parentNode) {
                        document.body.removeChild(tooltip);
                    }
                }, 300);
            }, 3000);

        } catch (error) {
            console.error('❌ Error showing tooltip:', error);
        }
    }

    private highlightAnnotation(annotationId: string, type: 'hover' | 'selected' | 'modified'): void {
        try {
            console.log(`Highlighting annotation ${annotationId} with type: ${type}`);
        } catch (error) {
            console.error('❌ Error highlighting annotation:', error);
        }
    }

    private showSelectionHandles(annotationId: string): void {
        try {
            console.log(`Showing selection handles for annotation: ${annotationId}`);
        } catch (error) {
            console.error('❌ Error showing selection handles:', error);
        }
    }

    private animateAnnotationCreation(annotation: AnnotationData): void {
        try {
            console.log(`Animating creation of annotation: ${annotation.annotationUID}`);
        } catch (error) {
            console.error('❌ Error animating annotation creation:', error);
        }
    }

    // Drag and drop methods
    private startAnnotationDrag(event: MouseEvent): void {
        try {
            // Implementation for starting annotation drag
            console.log('Starting annotation drag');
        } catch (error) {
            console.error('❌ Error starting annotation drag:', error);
        }
    }

    private updateAnnotationDrag(event: MouseEvent): void {
        try {
            // Implementation for updating annotation drag
            console.log('Updating annotation drag');
        } catch (error) {
            console.error('❌ Error updating annotation drag:', error);
        }
    }

    private completeAnnotationDrag(event: MouseEvent): void {
        try {
            // Implementation for completing annotation drag
            this.draggedAnnotationId = null;
            console.log('Completing annotation drag');
        } catch (error) {
            console.error('❌ Error completing annotation drag:', error);
        }
    }

    private updateHoverHighlight(event: MouseEvent): void {
        try {
            // Implementation for updating hover highlight
            console.log('Updating hover highlight');
        } catch (error) {
            console.error('❌ Error updating hover highlight:', error);
        }
    }

    private editAnnotationAtPosition(event: MouseEvent): void {
        try {
            // Implementation for editing annotation at position
            console.log('Editing annotation at position');
        } catch (error) {
            console.error('❌ Error editing annotation at position:', error);
        }
    }

    private showContextMenu(event: MouseEvent): void {
        try {
            event.preventDefault();
            
            const menu = document.createElement('div');
            menu.className = 'annotation-context-menu';
            menu.style.cssText = `
                position: fixed;
                left: ${event.clientX}px;
                top: ${event.clientY}px;
                background: white;
                border: 1px solid #ccc;
                border-radius: 4px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                z-index: 10001;
                min-width: 150px;
            `;

            const menuItems = [
                { label: 'Edit', action: () => this.editAnnotationAtPosition(event) },
                { label: 'Delete', action: () => this.deleteSelectedAnnotation() },
                { label: 'Copy', action: () => this.copySelectedAnnotation() },
                { label: 'Paste', action: () => this.pasteAnnotation() }
            ];

            menuItems.forEach(item => {
                const menuItem = document.createElement('div');
                menuItem.className = 'annotation-context-menu-item';
                menuItem.textContent = item.label;
                menuItem.style.cssText = `
                    padding: 8px 12px;
                    cursor: pointer;
                    border-bottom: 1px solid #eee;
                `;

                menuItem.addEventListener('click', () => {
                    item.action();
                    document.body.removeChild(menu);
                });

                menuItem.addEventListener('mouseenter', () => {
                    menuItem.style.backgroundColor = '#f0f0f0';
                });

                menuItem.addEventListener('mouseleave', () => {
                    menuItem.style.backgroundColor = 'white';
                });

                menu.appendChild(menuItem);
            });

            document.body.appendChild(menu);

            // Remove menu when clicking outside
            const removeMenu = (e: Event) => {
                if (!menu.contains(e.target as Node)) {
                    document.body.removeChild(menu);
                    document.removeEventListener('click', removeMenu);
                }
            };

            setTimeout(() => {
                document.addEventListener('click', removeMenu);
            }, 100);

        } catch (error) {
            console.error('❌ Error showing context menu:', error);
        }
    }

    private handleTouchSelect(event: TouchEvent): void {
        try {
            // Implementation for touch select
            console.log('Handling touch select');
        } catch (error) {
            console.error('❌ Error handling touch select:', error);
        }
    }

    // Public methods
    public getSelectedAnnotationId(): string | null {
        return this.selectedAnnotationId;
    }

    public getHoveredAnnotationId(): string | null {
        return this.hoveredAnnotationId;
    }

    public selectAnnotation(annotationId: string): void {
        this.selectedAnnotationId = annotationId;
        if (this.config.visualFeedback?.showSelectionHandles) {
            this.showSelectionHandles(annotationId);
        }
    }

    public deselectAnnotation(): void {
        this.selectedAnnotationId = null;
    }

    public updateConfig(newConfig: Partial<AnnotationEventHandlerConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log('✓ Annotation Event Handler configuration updated');
    }

    public getConfig(): AnnotationEventHandlerConfig {
        return { ...this.config };
    }

    public getInitializationStatus(): boolean {
        return this.isInitialized;
    }

    public dispose(): void {
        try {
            // Remove event listeners
            this.eventListeners.forEach((listener, eventType) => {
                if (['keydown', 'mousedown', 'mousemove', 'mouseup', 'dblclick', 'contextmenu', 'touchstart', 'touchmove', 'touchend'].includes(eventType)) {
                    document.removeEventListener(eventType, listener);
                } else if (eventType === 'cameraModified') {
                    eventTarget.removeEventListener('CAMERA_MODIFIED', listener);
                } else {
                    eventTarget.removeEventListener(eventType, listener);
                }
            });
            this.eventListeners.clear();

            // Clear state
            this.selectedAnnotationId = null;
            this.hoveredAnnotationId = null;
            this.draggedAnnotationId = null;
            this.undoStack = [];
            this.redoStack = [];
            this.clipboard = null;
            this.isInitialized = false;

            console.log('✓ Annotation Event Handler disposed');

        } catch (error) {
            console.error('❌ Error disposing Annotation Event Handler:', error);
        }
    }
}

// Convenience functions
export function createAnnotationEventHandler(
    annotationManager: AnnotationManager,
    textAnnotationTool?: TextAnnotationTool,
    arrowAnnotationTool?: ArrowAnnotationTool,
    config?: AnnotationEventHandlerConfig
): AnnotationEventHandler {
    return new AnnotationEventHandler(annotationManager, textAnnotationTool, arrowAnnotationTool, config);
}

export function getDefaultEventHandlerConfig(): AnnotationEventHandlerConfig {
    return {
        enableKeyboardShortcuts: true,
        enableMouseInteractions: true,
        enableTouchInteractions: true,
        enableVisualFeedback: true,
        enableUndoRedo: true,
        keyboardShortcuts: {
            textAnnotation: 'KeyT',
            arrowAnnotation: 'KeyA',
            deleteAnnotation: 'Delete',
            selectAll: 'KeyA',
            copy: 'KeyC',
            paste: 'KeyV',
            undo: 'KeyZ',
            redo: 'KeyY',
            escape: 'Escape'
        },
        mouseBehavior: {
            doubleClickToEdit: true,
            rightClickContextMenu: true,
            dragToMove: true,
            hoverHighlight: true
        },
        touchBehavior: {
            longPressToEdit: true,
            pinchToZoom: false,
            tapToSelect: true
        },
        visualFeedback: {
            showTooltips: true,
            highlightOnHover: true,
            showSelectionHandles: true,
            animateCreation: true
        }
    };
}