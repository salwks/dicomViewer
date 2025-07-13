import { 
    Enums as ToolEnums,
    ToolGroupManager 
} from '@cornerstonejs/tools';
import { eventTarget } from '@cornerstonejs/core';
import { Types } from '@cornerstonejs/core';
import { MeasurementManager } from './measurementManager';

export interface MeasurementEventHandlerConfig {
    enableKeyboardShortcuts?: boolean;
    enableMouseInteractions?: boolean;
    enableTouchInteractions?: boolean;
    enableVisualFeedback?: boolean;
    enableErrorHandling?: boolean;
    keyboardShortcuts?: {
        length?: string;
        angle?: string;
        elliptical?: string;
        rectangle?: string;
        delete?: string;
        escape?: string;
    };
    mouseBindings?: {
        primary?: ToolEnums.MouseBindings;
        secondary?: ToolEnums.MouseBindings;
        auxiliary?: ToolEnums.MouseBindings;
    };
    touchBindings?: {
        singleTap?: boolean;
        doubleTap?: boolean;
        longPress?: boolean;
    };
}

export interface MeasurementEventDetail {
    toolName: string;
    measurementData: any;
    annotation: any;
    viewport: any;
    event: Event;
    timestamp: string;
}

export class MeasurementEventHandler {
    private measurementManager: MeasurementManager;
    private config: MeasurementEventHandlerConfig;
    private eventListeners: Map<string, (event: any) => void> = new Map();
    private keyboardListeners: Map<string, (event: Event) => void> = new Map();
    private isInitialized: boolean = false;
    private currentTool: string | null = null;
    private hoveredMeasurement: string | null = null;
    private selectedMeasurement: string | null = null;
    private activeViewports: Set<string> = new Set();

    constructor(measurementManager: MeasurementManager, config: MeasurementEventHandlerConfig = {}) {
        this.measurementManager = measurementManager;
        this.config = {
            enableKeyboardShortcuts: true,
            enableMouseInteractions: true,
            enableTouchInteractions: true,
            enableVisualFeedback: true,
            enableErrorHandling: true,
            keyboardShortcuts: {
                length: 'KeyL',
                angle: 'KeyA',
                elliptical: 'KeyE',
                rectangle: 'KeyR',
                delete: 'Delete',
                escape: 'Escape'
            },
            mouseBindings: {
                primary: ToolEnums.MouseBindings.Primary,
                secondary: ToolEnums.MouseBindings.Secondary,
                auxiliary: ToolEnums.MouseBindings.Auxiliary
            },
            touchBindings: {
                singleTap: true,
                doubleTap: true,
                longPress: true
            },
            ...config
        };

        this.initialize();
    }

    private initialize(): void {
        try {
            this.setupCornerstoneEventListeners();
            this.setupKeyboardEventListeners();
            this.setupMouseEventListeners();
            this.setupTouchEventListeners();
            this.setupVisualFeedbackListeners();
            this.setupErrorHandlingListeners();

            this.isInitialized = true;
            console.log('✓ Measurement Event Handler initialized');

        } catch (error) {
            console.error('❌ Error initializing Measurement Event Handler:', error);
            throw error;
        }
    }

    private setupCornerstoneEventListeners(): void {
        // Measurement completion events
        const measurementCompletedListener = (event: any) => {
            this.handleMeasurementCompleted(event);
        };

        const measurementModifiedListener = (event: any) => {
            this.handleMeasurementModified(event);
        };

        const measurementRemovedListener = (event: any) => {
            this.handleMeasurementRemoved(event);
        };

        const measurementSelectedListener = (event: any) => {
            this.handleMeasurementSelected(event);
        };

        const measurementHoveredListener = (event: any) => {
            this.handleMeasurementHovered(event);
        };

        // Tool state change events
        const toolActivatedListener = (event: any) => {
            this.handleToolActivated(event);
        };

        const toolDeactivatedListener = (event: any) => {
            this.handleToolDeactivated(event);
        };

        // Store event listeners for cleanup
        this.eventListeners.set('MEASUREMENT_COMPLETED', measurementCompletedListener);
        this.eventListeners.set('MEASUREMENT_MODIFIED', measurementModifiedListener);
        this.eventListeners.set('MEASUREMENT_REMOVED', measurementRemovedListener);
        this.eventListeners.set('MEASUREMENT_SELECTED', measurementSelectedListener);
        this.eventListeners.set('MEASUREMENT_HOVERED', measurementHoveredListener);
        this.eventListeners.set('TOOL_ACTIVATED', toolActivatedListener);
        this.eventListeners.set('TOOL_DEACTIVATED', toolDeactivatedListener);

        // Add event listeners
        eventTarget.addEventListener('MEASUREMENT_COMPLETED', measurementCompletedListener);
        eventTarget.addEventListener('MEASUREMENT_MODIFIED', measurementModifiedListener);
        eventTarget.addEventListener('MEASUREMENT_REMOVED', measurementRemovedListener);
        eventTarget.addEventListener('MEASUREMENT_SELECTED', measurementSelectedListener);
        eventTarget.addEventListener('MEASUREMENT_HOVERED', measurementHoveredListener);
        eventTarget.addEventListener('TOOL_ACTIVATED', toolActivatedListener);
        eventTarget.addEventListener('TOOL_DEACTIVATED', toolDeactivatedListener);
    }

    private setupKeyboardEventListeners(): void {
        if (!this.config.enableKeyboardShortcuts) return;

        const keyboardListener = (event: Event) => {
            this.handleKeyboardEvent(event as KeyboardEvent);
        };

        this.keyboardListeners.set('keydown', keyboardListener);
        document.addEventListener('keydown', keyboardListener);
    }

    private setupMouseEventListeners(): void {
        if (!this.config.enableMouseInteractions) return;

        // Mouse events are handled by Cornerstone3D tools directly
        // We'll listen for custom mouse events if needed
        const mouseDownListener = (event: MouseEvent) => {
            this.handleMouseDown(event);
        };

        const mouseUpListener = (event: MouseEvent) => {
            this.handleMouseUp(event);
        };

        const mouseMoveListener = (event: MouseEvent) => {
            this.handleMouseMove(event);
        };

        const contextMenuListener = (event: MouseEvent) => {
            this.handleContextMenu(event);
        };

        this.eventListeners.set('mousedown', mouseDownListener);
        this.eventListeners.set('mouseup', mouseUpListener);
        this.eventListeners.set('mousemove', mouseMoveListener);
        this.eventListeners.set('contextmenu', contextMenuListener);
    }

    private setupTouchEventListeners(): void {
        if (!this.config.enableTouchInteractions) return;

        const touchStartListener = (event: TouchEvent) => {
            this.handleTouchStart(event);
        };

        const touchEndListener = (event: TouchEvent) => {
            this.handleTouchEnd(event);
        };

        const touchMoveListener = (event: TouchEvent) => {
            this.handleTouchMove(event);
        };

        this.eventListeners.set('touchstart', touchStartListener);
        this.eventListeners.set('touchend', touchEndListener);
        this.eventListeners.set('touchmove', touchMoveListener);
    }

    private setupVisualFeedbackListeners(): void {
        if (!this.config.enableVisualFeedback) return;

        // Listen for measurement events to provide visual feedback
        const feedbackListener = (event: any) => {
            this.provideFeedback(event);
        };

        this.eventListeners.set('measurementManagerEvent', feedbackListener);
        eventTarget.addEventListener('measurementManagerEvent', feedbackListener);
    }

    private setupErrorHandlingListeners(): void {
        if (!this.config.enableErrorHandling) return;

        const errorListener = (event: any) => {
            this.handleError(event);
        };

        this.eventListeners.set('error', errorListener);
        document.addEventListener('error', errorListener);
    }

    private handleMeasurementCompleted(event: any): void {
        try {
            const detail = this.extractEventDetail(event);
            
            console.log(`✓ Measurement completed: ${detail.toolName}`, detail.measurementData);
            
            // Provide visual feedback
            this.showSuccessToast(`${detail.toolName} measurement completed`);
            
            // Trigger custom event
            this.triggerCustomEvent('measurementCompleted', detail);
            
        } catch (error) {
            console.error('❌ Error handling measurement completion:', error);
            this.showErrorToast('Error completing measurement');
        }
    }

    private handleMeasurementModified(event: any): void {
        try {
            const detail = this.extractEventDetail(event);
            
            console.log(`✓ Measurement modified: ${detail.toolName}`, detail.measurementData);
            
            // Provide visual feedback
            this.showInfoToast(`${detail.toolName} measurement updated`);
            
            // Trigger custom event
            this.triggerCustomEvent('measurementModified', detail);
            
        } catch (error) {
            console.error('❌ Error handling measurement modification:', error);
            this.showErrorToast('Error modifying measurement');
        }
    }

    private handleMeasurementRemoved(event: any): void {
        try {
            const detail = this.extractEventDetail(event);
            
            console.log(`✓ Measurement removed: ${detail.toolName}`);
            
            // Clear selection if this was the selected measurement
            if (this.selectedMeasurement === detail.measurementData?.id) {
                this.selectedMeasurement = null;
            }
            
            // Provide visual feedback
            this.showWarningToast(`${detail.toolName} measurement removed`);
            
            // Trigger custom event
            this.triggerCustomEvent('measurementRemoved', detail);
            
        } catch (error) {
            console.error('❌ Error handling measurement removal:', error);
            this.showErrorToast('Error removing measurement');
        }
    }

    private handleMeasurementSelected(event: any): void {
        try {
            const detail = this.extractEventDetail(event);
            
            this.selectedMeasurement = detail.measurementData?.id || null;
            
            console.log(`✓ Measurement selected: ${detail.toolName}`, detail.measurementData);
            
            // Provide visual feedback
            this.highlightMeasurement(detail.measurementData?.id, 'selected');
            
            // Trigger custom event
            this.triggerCustomEvent('measurementSelected', detail);
            
        } catch (error) {
            console.error('❌ Error handling measurement selection:', error);
        }
    }

    private handleMeasurementHovered(event: any): void {
        try {
            const detail = this.extractEventDetail(event);
            
            this.hoveredMeasurement = detail.measurementData?.id || null;
            
            // Provide visual feedback
            this.highlightMeasurement(detail.measurementData?.id, 'hovered');
            
            // Trigger custom event
            this.triggerCustomEvent('measurementHovered', detail);
            
        } catch (error) {
            console.error('❌ Error handling measurement hover:', error);
        }
    }

    private handleToolActivated(event: any): void {
        try {
            const toolName = event.detail?.toolName;
            
            if (toolName) {
                this.currentTool = toolName;
                console.log(`✓ Tool activated: ${toolName}`);
                
                // Provide visual feedback
                this.showInfoToast(`${toolName} tool activated`);
                this.updateCursor(toolName);
                
                // Trigger custom event
                this.triggerCustomEvent('toolActivated', { toolName, timestamp: new Date().toISOString() });
            }
            
        } catch (error) {
            console.error('❌ Error handling tool activation:', error);
        }
    }

    private handleToolDeactivated(event: any): void {
        try {
            const toolName = event.detail?.toolName;
            
            if (toolName) {
                this.currentTool = null;
                console.log(`✓ Tool deactivated: ${toolName}`);
                
                // Provide visual feedback
                this.showInfoToast(`${toolName} tool deactivated`);
                this.resetCursor();
                
                // Trigger custom event
                this.triggerCustomEvent('toolDeactivated', { toolName, timestamp: new Date().toISOString() });
            }
            
        } catch (error) {
            console.error('❌ Error handling tool deactivation:', error);
        }
    }

    private handleKeyboardEvent(event: KeyboardEvent): void {
        try {
            const { code, ctrlKey, altKey, shiftKey } = event;
            
            // Handle keyboard shortcuts
            if (this.config.keyboardShortcuts) {
                if (code === this.config.keyboardShortcuts.length && !ctrlKey && !altKey) {
                    event.preventDefault();
                    this.measurementManager.activateTool('length');
                    return;
                }
                
                if (code === this.config.keyboardShortcuts.angle && !ctrlKey && !altKey) {
                    event.preventDefault();
                    this.measurementManager.activateTool('angle');
                    return;
                }
                
                if (code === this.config.keyboardShortcuts.elliptical && !ctrlKey && !altKey) {
                    event.preventDefault();
                    this.measurementManager.activateTool('elliptical');
                    return;
                }
                
                if (code === this.config.keyboardShortcuts.rectangle && !ctrlKey && !altKey) {
                    event.preventDefault();
                    this.measurementManager.activateTool('rectangle');
                    return;
                }
                
                if (code === this.config.keyboardShortcuts.delete && !ctrlKey && !altKey) {
                    event.preventDefault();
                    this.deleteSelectedMeasurement();
                    return;
                }
                
                if (code === this.config.keyboardShortcuts.escape && !ctrlKey && !altKey) {
                    event.preventDefault();
                    this.measurementManager.deactivateAllTools();
                    return;
                }
            }
            
            // Handle modifier keys for enhanced interactions
            if (ctrlKey && code === 'KeyZ') {
                event.preventDefault();
                this.handleUndo();
                return;
            }
            
            if (ctrlKey && code === 'KeyY') {
                event.preventDefault();
                this.handleRedo();
                return;
            }
            
            if (ctrlKey && code === 'KeyA') {
                event.preventDefault();
                this.selectAllMeasurements();
                return;
            }
            
        } catch (error) {
            console.error('❌ Error handling keyboard event:', error);
        }
    }

    private handleMouseDown(event: MouseEvent): void {
        try {
            // Handle mouse interactions if needed
            console.log('Mouse down event:', event);
            
        } catch (error) {
            console.error('❌ Error handling mouse down:', error);
        }
    }

    private handleMouseUp(event: MouseEvent): void {
        try {
            // Handle mouse interactions if needed
            console.log('Mouse up event:', event);
            
        } catch (error) {
            console.error('❌ Error handling mouse up:', error);
        }
    }

    private handleMouseMove(event: MouseEvent): void {
        try {
            // Handle mouse move for cursor updates, etc.
            
        } catch (error) {
            console.error('❌ Error handling mouse move:', error);
        }
    }

    private handleContextMenu(event: MouseEvent): void {
        try {
            // Handle right-click context menu
            if (this.selectedMeasurement) {
                event.preventDefault();
                this.showContextMenu(event.clientX, event.clientY);
            }
            
        } catch (error) {
            console.error('❌ Error handling context menu:', error);
        }
    }

    private handleTouchStart(event: TouchEvent): void {
        try {
            // Handle touch interactions
            console.log('Touch start event:', event);
            
        } catch (error) {
            console.error('❌ Error handling touch start:', error);
        }
    }

    private handleTouchEnd(event: TouchEvent): void {
        try {
            // Handle touch interactions
            console.log('Touch end event:', event);
            
        } catch (error) {
            console.error('❌ Error handling touch end:', error);
        }
    }

    private handleTouchMove(event: TouchEvent): void {
        try {
            // Handle touch move interactions
            
        } catch (error) {
            console.error('❌ Error handling touch move:', error);
        }
    }

    private handleError(event: any): void {
        try {
            console.error('❌ Measurement error:', event);
            this.showErrorToast('An error occurred with the measurement tool');
            
        } catch (error) {
            console.error('❌ Error handling error event:', error);
        }
    }

    private extractEventDetail(event: any): MeasurementEventDetail {
        return {
            toolName: event.detail?.toolName || 'Unknown',
            measurementData: event.detail?.measurementData || event.detail?.annotation || null,
            annotation: event.detail?.annotation || null,
            viewport: event.detail?.viewport || null,
            event: event,
            timestamp: event.detail?.timestamp || new Date().toISOString()
        };
    }

    private triggerCustomEvent(eventType: string, detail: any): void {
        const customEvent = new CustomEvent(eventType, {
            detail: {
                ...detail,
                source: 'MeasurementEventHandler'
            }
        });
        
        eventTarget.dispatchEvent(customEvent);
    }

    private provideFeedback(event: any): void {
        // Provide visual/audio feedback for measurement events
        const eventType = event.detail?.eventType;
        
        switch (eventType) {
            case 'lengthMeasurementCompleted':
                this.highlightMeasurement(event.detail?.measurementData?.id, 'success');
                break;
            case 'angleMeasurementCompleted':
                this.highlightMeasurement(event.detail?.measurementData?.id, 'success');
                break;
            case 'areaMeasurementCompleted':
                this.highlightMeasurement(event.detail?.measurementData?.id, 'success');
                break;
            default:
                break;
        }
    }

    private showSuccessToast(message: string): void {
        this.showToast(message, 'success');
    }

    private showInfoToast(message: string): void {
        this.showToast(message, 'info');
    }

    private showWarningToast(message: string): void {
        this.showToast(message, 'warning');
    }

    private showErrorToast(message: string): void {
        this.showToast(message, 'error');
    }

    private showToast(message: string, type: 'success' | 'info' | 'warning' | 'error'): void {
        // Create a simple toast notification
        const toast = document.createElement('div');
        toast.className = `measurement-toast measurement-toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
            max-width: 300px;
        `;
        
        // Set background color based on type
        switch (type) {
            case 'success':
                toast.style.backgroundColor = '#10b981';
                break;
            case 'info':
                toast.style.backgroundColor = '#3b82f6';
                break;
            case 'warning':
                toast.style.backgroundColor = '#f59e0b';
                break;
            case 'error':
                toast.style.backgroundColor = '#ef4444';
                break;
        }
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.opacity = '1';
        }, 100);
        
        // Remove after delay
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }

    private highlightMeasurement(measurementId: string | null, type: 'selected' | 'hovered' | 'success'): void {
        if (!measurementId) return;
        
        // This would typically update the visual appearance of the measurement
        // For now, we'll just log the action
        console.log(`Highlighting measurement ${measurementId} with type: ${type}`);
    }

    private updateCursor(toolName: string): void {
        const cursor = this.getCursorForTool(toolName);
        document.body.style.cursor = cursor;
    }

    private resetCursor(): void {
        document.body.style.cursor = 'default';
    }

    private getCursorForTool(toolName: string): string {
        switch (toolName.toLowerCase()) {
            case 'length':
                return 'crosshair';
            case 'angle':
                return 'crosshair';
            case 'ellipticalroi':
            case 'rectangleroi':
                return 'cell';
            default:
                return 'crosshair';
        }
    }

    private deleteSelectedMeasurement(): void {
        if (this.selectedMeasurement) {
            const success = this.measurementManager.removeMeasurement(this.selectedMeasurement);
            if (success) {
                this.selectedMeasurement = null;
                this.showSuccessToast('Measurement deleted');
            } else {
                this.showErrorToast('Failed to delete measurement');
            }
        }
    }

    private selectAllMeasurements(): void {
        // This would typically select all measurements in the current viewport
        const measurements = this.measurementManager.getAllMeasurements();
        console.log(`Selecting all ${measurements.length} measurements`);
        this.showInfoToast(`Selected ${measurements.length} measurements`);
    }

    private handleUndo(): void {
        // Implement undo functionality
        console.log('Undo requested');
        this.showInfoToast('Undo not implemented yet');
    }

    private handleRedo(): void {
        // Implement redo functionality
        console.log('Redo requested');
        this.showInfoToast('Redo not implemented yet');
    }

    private showContextMenu(x: number, y: number): void {
        // Create and show context menu
        const menu = document.createElement('div');
        menu.className = 'measurement-context-menu';
        menu.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 10001;
            min-width: 150px;
        `;
        
        const menuItems = [
            { label: 'Delete', action: () => this.deleteSelectedMeasurement() },
            { label: 'Properties', action: () => this.showMeasurementProperties() },
            { label: 'Copy', action: () => this.copyMeasurement() }
        ];
        
        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'measurement-context-menu-item';
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
        const removeMenu = (event: Event) => {
            if (!menu.contains(event.target as Node)) {
                document.body.removeChild(menu);
                document.removeEventListener('click', removeMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', removeMenu);
        }, 100);
    }

    private showMeasurementProperties(): void {
        if (this.selectedMeasurement) {
            const measurement = this.measurementManager.getMeasurement(this.selectedMeasurement);
            if (measurement) {
                console.log('Measurement properties:', measurement);
                this.showInfoToast('Measurement properties shown in console');
            }
        }
    }

    private copyMeasurement(): void {
        if (this.selectedMeasurement) {
            const measurement = this.measurementManager.getMeasurement(this.selectedMeasurement);
            if (measurement) {
                // Copy to clipboard
                navigator.clipboard.writeText(JSON.stringify(measurement, null, 2));
                this.showSuccessToast('Measurement copied to clipboard');
            }
        }
    }

    public addViewport(viewportId: string): void {
        this.activeViewports.add(viewportId);
        
        // Add viewport-specific event listeners if needed
        const viewportElement = document.getElementById(viewportId);
        if (viewportElement) {
            // Add mouse event listeners to viewport
            if (this.config.enableMouseInteractions) {
                viewportElement.addEventListener('mousedown', this.eventListeners.get('mousedown')!);
                viewportElement.addEventListener('mouseup', this.eventListeners.get('mouseup')!);
                viewportElement.addEventListener('mousemove', this.eventListeners.get('mousemove')!);
                viewportElement.addEventListener('contextmenu', this.eventListeners.get('contextmenu')!);
            }
            
            // Add touch event listeners to viewport
            if (this.config.enableTouchInteractions) {
                viewportElement.addEventListener('touchstart', this.eventListeners.get('touchstart')!);
                viewportElement.addEventListener('touchend', this.eventListeners.get('touchend')!);
                viewportElement.addEventListener('touchmove', this.eventListeners.get('touchmove')!);
            }
        }
    }

    public removeViewport(viewportId: string): void {
        this.activeViewports.delete(viewportId);
        
        // Remove viewport-specific event listeners if needed
        const viewportElement = document.getElementById(viewportId);
        if (viewportElement) {
            // Remove mouse event listeners from viewport
            if (this.config.enableMouseInteractions) {
                viewportElement.removeEventListener('mousedown', this.eventListeners.get('mousedown')!);
                viewportElement.removeEventListener('mouseup', this.eventListeners.get('mouseup')!);
                viewportElement.removeEventListener('mousemove', this.eventListeners.get('mousemove')!);
                viewportElement.removeEventListener('contextmenu', this.eventListeners.get('contextmenu')!);
            }
            
            // Remove touch event listeners from viewport
            if (this.config.enableTouchInteractions) {
                viewportElement.removeEventListener('touchstart', this.eventListeners.get('touchstart')!);
                viewportElement.removeEventListener('touchend', this.eventListeners.get('touchend')!);
                viewportElement.removeEventListener('touchmove', this.eventListeners.get('touchmove')!);
            }
        }
    }

    public getConfig(): MeasurementEventHandlerConfig {
        return { ...this.config };
    }

    public updateConfig(newConfig: Partial<MeasurementEventHandlerConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log('✓ Measurement Event Handler configuration updated');
    }

    public getCurrentTool(): string | null {
        return this.currentTool;
    }

    public getSelectedMeasurement(): string | null {
        return this.selectedMeasurement;
    }

    public getHoveredMeasurement(): string | null {
        return this.hoveredMeasurement;
    }

    public getActiveViewports(): string[] {
        return Array.from(this.activeViewports);
    }

    public getInitializationStatus(): boolean {
        return this.isInitialized;
    }

    public dispose(): void {
        try {
            // Remove Cornerstone event listeners
            this.eventListeners.forEach((listener, eventType) => {
                if (eventType.startsWith('MEASUREMENT_') || eventType.startsWith('TOOL_')) {
                    eventTarget.removeEventListener(eventType, listener);
                }
            });
            
            // Remove keyboard event listeners
            this.keyboardListeners.forEach((listener, eventType) => {
                document.removeEventListener(eventType, listener);
            });
            
            // Remove other event listeners
            if (this.eventListeners.has('error')) {
                document.removeEventListener('error', this.eventListeners.get('error')!);
            }
            
            if (this.eventListeners.has('measurementManagerEvent')) {
                eventTarget.removeEventListener('measurementManagerEvent', this.eventListeners.get('measurementManagerEvent')!);
            }
            
            // Clear all listeners
            this.eventListeners.clear();
            this.keyboardListeners.clear();
            
            // Clear state
            this.activeViewports.clear();
            this.currentTool = null;
            this.selectedMeasurement = null;
            this.hoveredMeasurement = null;
            this.isInitialized = false;
            
            // Reset cursor
            this.resetCursor();
            
            console.log('✓ Measurement Event Handler disposed');
            
        } catch (error) {
            console.error('❌ Error disposing Measurement Event Handler:', error);
        }
    }
}

// Convenience functions
export function createMeasurementEventHandler(
    measurementManager: MeasurementManager, 
    config?: MeasurementEventHandlerConfig
): MeasurementEventHandler {
    return new MeasurementEventHandler(measurementManager, config);
}

export function getDefaultEventHandlerConfig(): MeasurementEventHandlerConfig {
    return {
        enableKeyboardShortcuts: true,
        enableMouseInteractions: true,
        enableTouchInteractions: true,
        enableVisualFeedback: true,
        enableErrorHandling: true,
        keyboardShortcuts: {
            length: 'KeyL',
            angle: 'KeyA',
            elliptical: 'KeyE',
            rectangle: 'KeyR',
            delete: 'Delete',
            escape: 'Escape'
        },
        mouseBindings: {
            primary: ToolEnums.MouseBindings.Primary,
            secondary: ToolEnums.MouseBindings.Secondary,
            auxiliary: ToolEnums.MouseBindings.Auxiliary
        },
        touchBindings: {
            singleTap: true,
            doubleTap: true,
            longPress: true
        }
    };
}