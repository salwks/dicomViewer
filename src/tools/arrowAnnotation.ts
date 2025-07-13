import { 
    addTool,
    ToolGroupManager,
    Enums as ToolEnums,
    annotation
} from '@cornerstonejs/tools';
import { eventTarget } from '@cornerstonejs/core';
import { Types } from '@cornerstonejs/core';
import { AnnotationData } from './annotationManager';

export interface ArrowAnnotationData extends AnnotationData {
    text?: string;
    handles: {
        start: Types.Point2;
        end: Types.Point2;
        textBox?: Types.Point2;
    };
    arrowHead?: {
        size: number;
        angle: number;
        style: 'filled' | 'outline' | 'line';
    };
    style: {
        color: string;
        lineWidth: number;
        lineDash: number[];
        font: string;
        textBackgroundColor: string;
        textColor: string;
        arrowHeadColor: string;
        arrowHeadSize: number;
        opacity: number;
    };
}

export interface ArrowAnnotationConfig {
    enableArrowDrawing?: boolean;
    enableArrowEdit?: boolean;
    enableArrowMove?: boolean;
    enableArrowDelete?: boolean;
    enableTextLabels?: boolean;
    defaultText?: string;
    maxTextLength?: number;
    arrowHead?: {
        size?: number;
        angle?: number;
        style?: 'filled' | 'outline' | 'line';
    };
    style?: {
        color?: string;
        lineWidth?: number;
        lineDash?: number[];
        font?: string;
        textBackgroundColor?: string;
        textColor?: string;
        arrowHeadColor?: string;
        arrowHeadSize?: number;
        opacity?: number;
    };
    interactive?: boolean;
    showTextBox?: boolean;
    snapToGrid?: boolean;
    gridSize?: number;
}

export class ArrowAnnotationTool {
    private toolGroupId: string;
    private config: ArrowAnnotationConfig;
    private annotations: Map<string, ArrowAnnotationData> = new Map();
    private eventListeners: Map<string, (event: any) => void> = new Map();
    private isInitialized: boolean = false;
    private isDrawing: boolean = false;
    private currentAnnotationId: string | null = null;
    private drawingStartPoint: Types.Point2 | null = null;

    constructor(toolGroupId: string, config: ArrowAnnotationConfig = {}) {
        this.toolGroupId = toolGroupId;
        this.config = {
            enableArrowDrawing: true,
            enableArrowEdit: true,
            enableArrowMove: true,
            enableArrowDelete: true,
            enableTextLabels: true,
            defaultText: '',
            maxTextLength: 200,
            arrowHead: {
                size: 10,
                angle: 30,
                style: 'filled'
            },
            style: {
                color: '#FF0000',
                lineWidth: 2,
                lineDash: [],
                font: '12px Arial',
                textBackgroundColor: 'rgba(0, 0, 0, 0.8)',
                textColor: '#FFFFFF',
                arrowHeadColor: '#FF0000',
                arrowHeadSize: 10,
                opacity: 1.0
            },
            interactive: true,
            showTextBox: true,
            snapToGrid: false,
            gridSize: 10,
            ...config
        };

        this.initialize();
    }

    private initialize(): void {
        try {
            this.setupEventListeners();
            this.isInitialized = true;
            
            console.log('✓ Arrow Annotation Tool initialized');
        } catch (error) {
            console.error('❌ Error initializing Arrow Annotation Tool:', error);
            throw error;
        }
    }

    private setupEventListeners(): void {
        // Listen for mouse events for arrow drawing
        const mouseDownListener = (event: any) => {
            if (this.isActiveArrowTool() && this.config.enableArrowDrawing) {
                this.handleMouseDown(event);
            }
        };

        const mouseMoveListener = (event: any) => {
            if (this.isDrawing) {
                this.handleMouseMove(event);
            }
        };

        const mouseUpListener = (event: any) => {
            if (this.isDrawing) {
                this.handleMouseUp(event);
            }
        };

        const mouseDoubleClickListener = (event: any) => {
            if (this.config.enableArrowEdit) {
                this.handleDoubleClick(event);
            }
        };

        const keydownListener = (event: KeyboardEvent) => {
            this.handleKeydown(event);
        };

        // Store event listeners for cleanup
        this.eventListeners.set('mouseDown', mouseDownListener);
        this.eventListeners.set('mouseMove', mouseMoveListener);
        this.eventListeners.set('mouseUp', mouseUpListener);
        this.eventListeners.set('mouseDoubleClick', mouseDoubleClickListener);
        this.eventListeners.set('keydown', keydownListener);

        // Note: In a real implementation, these would be attached to specific viewport elements
        document.addEventListener('keydown', keydownListener);
    }

    private isActiveArrowTool(): boolean {
        try {
            const toolGroup = ToolGroupManager.getToolGroup(this.toolGroupId);
            if (toolGroup) {
                // In a real implementation, we would check if the arrow tool is active
                return true;
            }
        } catch (error) {
            console.error('Error checking active arrow tool:', error);
        }
        return false;
    }

    private handleMouseDown(event: any): void {
        try {
            if (this.isDrawing) return;

            const position = this.getMousePosition(event);
            if (!position) return;

            // Start drawing new arrow
            this.startArrowDrawing(position);

        } catch (error) {
            console.error('❌ Error handling mouse down:', error);
        }
    }

    private handleMouseMove(event: any): void {
        try {
            if (!this.isDrawing || !this.currentAnnotationId) return;

            const position = this.getMousePosition(event);
            if (!position) return;

            // Update arrow end point
            this.updateArrowEndPoint(this.currentAnnotationId, position);

        } catch (error) {
            console.error('❌ Error handling mouse move:', error);
        }
    }

    private handleMouseUp(event: any): void {
        try {
            if (!this.isDrawing || !this.currentAnnotationId) return;

            const position = this.getMousePosition(event);
            if (!position) return;

            // Complete arrow drawing
            this.completeArrowDrawing(this.currentAnnotationId, position);

        } catch (error) {
            console.error('❌ Error handling mouse up:', error);
        }
    }

    private handleDoubleClick(event: any): void {
        try {
            const position = this.getMousePosition(event);
            if (!position) return;

            // Find arrow at this position and start text editing
            const annotationId = this.findArrowAtPosition(position);
            if (annotationId && this.config.enableTextLabels) {
                this.startTextEdit(annotationId);
            }

        } catch (error) {
            console.error('❌ Error handling double click:', error);
        }
    }

    private handleKeydown(event: KeyboardEvent): void {
        try {
            if (event.key === 'Escape') {
                this.cancelArrowDrawing();
            } else if (event.key === 'Delete' && this.config.enableArrowDelete) {
                this.deleteSelectedAnnotation();
            }

        } catch (error) {
            console.error('❌ Error handling keydown:', error);
        }
    }

    private getMousePosition(event: any): Types.Point2 | null {
        try {
            const rect = event.target?.getBoundingClientRect();
            if (rect) {
                let position: Types.Point2 = [
                    event.clientX - rect.left,
                    event.clientY - rect.top
                ];

                // Apply grid snapping if enabled
                if (this.config.snapToGrid && this.config.gridSize) {
                    position = this.snapToGrid(position);
                }

                return position;
            }
        } catch (error) {
            console.error('Error getting mouse position:', error);
        }
        return null;
    }

    private snapToGrid(position: Types.Point2): Types.Point2 {
        const gridSize = this.config.gridSize || 10;
        return [
            Math.round(position[0] / gridSize) * gridSize,
            Math.round(position[1] / gridSize) * gridSize
        ];
    }

    private startArrowDrawing(startPosition: Types.Point2): void {
        try {
            const annotationId = this.createArrowAnnotation(startPosition, startPosition);
            this.currentAnnotationId = annotationId;
            this.drawingStartPoint = startPosition;
            this.isDrawing = true;

            console.log('✓ Started arrow drawing:', annotationId);

        } catch (error) {
            console.error('❌ Error starting arrow drawing:', error);
        }
    }

    private updateArrowEndPoint(annotationId: string, endPosition: Types.Point2): void {
        try {
            const annotation = this.annotations.get(annotationId);
            if (!annotation) return;

            annotation.handles.end = endPosition;
            annotation.timestamp = new Date().toISOString();

            // Update arrow head
            this.updateArrowHead(annotation);

            // Trigger update event
            this.triggerAnnotationEvent('arrowAnnotationUpdated', annotation);

        } catch (error) {
            console.error('❌ Error updating arrow end point:', error);
        }
    }

    private completeArrowDrawing(annotationId: string, endPosition: Types.Point2): void {
        try {
            const annotation = this.annotations.get(annotationId);
            if (!annotation) return;

            // Check if arrow is long enough
            const length = this.calculateArrowLength(annotation.handles.start, endPosition);
            if (length < 5) {
                // Arrow too short, remove it
                this.removeAnnotation(annotationId);
                this.resetDrawingState();
                return;
            }

            annotation.handles.end = endPosition;
            annotation.timestamp = new Date().toISOString();

            // Update arrow head
            this.updateArrowHead(annotation);

            // Reset drawing state
            this.resetDrawingState();

            console.log('✓ Arrow drawing completed:', annotationId);

            // Trigger completion event
            this.triggerAnnotationEvent('arrowAnnotationCompleted', annotation);

            // Start text input if enabled
            if (this.config.enableTextLabels && this.config.interactive) {
                this.startTextEdit(annotationId);
            }

        } catch (error) {
            console.error('❌ Error completing arrow drawing:', error);
        }
    }

    private cancelArrowDrawing(): void {
        try {
            if (this.isDrawing && this.currentAnnotationId) {
                this.removeAnnotation(this.currentAnnotationId);
                this.resetDrawingState();
                console.log('✓ Arrow drawing cancelled');
            }

        } catch (error) {
            console.error('❌ Error cancelling arrow drawing:', error);
        }
    }

    private resetDrawingState(): void {
        this.isDrawing = false;
        this.currentAnnotationId = null;
        this.drawingStartPoint = null;
    }

    private createArrowAnnotation(startPosition: Types.Point2, endPosition: Types.Point2): string {
        try {
            const annotationId = `arrow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            const arrowAnnotation: ArrowAnnotationData = {
                annotationUID: annotationId,
                toolName: 'ArrowAnnotation',
                text: this.config.defaultText || '',
                handles: {
                    start: startPosition,
                    end: endPosition,
                    textBox: this.calculateTextBoxPosition(startPosition, endPosition)
                },
                arrowHead: {
                    size: this.config.arrowHead?.size || 10,
                    angle: this.config.arrowHead?.angle || 30,
                    style: this.config.arrowHead?.style || 'filled'
                },
                style: {
                    color: this.config.style?.color || '#FF0000',
                    lineWidth: this.config.style?.lineWidth || 2,
                    lineDash: this.config.style?.lineDash || [],
                    font: this.config.style?.font || '12px Arial',
                    textBackgroundColor: this.config.style?.textBackgroundColor || 'rgba(0, 0, 0, 0.8)',
                    textColor: this.config.style?.textColor || '#FFFFFF',
                    arrowHeadColor: this.config.style?.arrowHeadColor || '#FF0000',
                    arrowHeadSize: this.config.style?.arrowHeadSize || 10,
                    opacity: this.config.style?.opacity || 1.0
                },
                imageId: '',
                viewportId: '',
                timestamp: new Date().toISOString(),
                metadata: {}
            };

            this.annotations.set(annotationId, arrowAnnotation);
            
            console.log('✓ Arrow annotation created:', annotationId);
            
            return annotationId;

        } catch (error) {
            console.error('❌ Error creating arrow annotation:', error);
            throw error;
        }
    }

    private calculateTextBoxPosition(startPosition: Types.Point2, endPosition: Types.Point2): Types.Point2 {
        // Place text box at the midpoint of the arrow
        return [
            (startPosition[0] + endPosition[0]) / 2,
            (startPosition[1] + endPosition[1]) / 2
        ];
    }

    private updateArrowHead(annotation: ArrowAnnotationData): void {
        try {
            const start = annotation.handles.start;
            const end = annotation.handles.end;
            
            // Calculate arrow angle
            const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
            
            if (annotation.arrowHead) {
                annotation.arrowHead.angle = angle;
            }

            // Update text box position
            annotation.handles.textBox = this.calculateTextBoxPosition(start, end);

        } catch (error) {
            console.error('❌ Error updating arrow head:', error);
        }
    }

    private calculateArrowLength(start: Types.Point2, end: Types.Point2): number {
        const dx = end[0] - start[0];
        const dy = end[1] - start[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    private findArrowAtPosition(position: Types.Point2): string | null {
        try {
            for (const [id, annotation] of this.annotations) {
                if (this.isPositionOnArrow(position, annotation)) {
                    return id;
                }
            }
        } catch (error) {
            console.error('Error finding arrow at position:', error);
        }
        return null;
    }

    private isPositionOnArrow(position: Types.Point2, annotation: ArrowAnnotationData): boolean {
        try {
            const start = annotation.handles.start;
            const end = annotation.handles.end;
            const tolerance = 5; // pixels

            // Check if position is near the arrow line
            const distance = this.distanceToLine(position, start, end);
            return distance <= tolerance;

        } catch (error) {
            console.error('Error checking position on arrow:', error);
            return false;
        }
    }

    private distanceToLine(point: Types.Point2, lineStart: Types.Point2, lineEnd: Types.Point2): number {
        const A = point[0] - lineStart[0];
        const B = point[1] - lineStart[1];
        const C = lineEnd[0] - lineStart[0];
        const D = lineEnd[1] - lineStart[1];

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) {
            // Line is a point
            return Math.sqrt(A * A + B * B);
        }

        let param = dot / lenSq;
        
        let xx, yy;
        if (param < 0) {
            xx = lineStart[0];
            yy = lineStart[1];
        } else if (param > 1) {
            xx = lineEnd[0];
            yy = lineEnd[1];
        } else {
            xx = lineStart[0] + param * C;
            yy = lineStart[1] + param * D;
        }

        const dx = point[0] - xx;
        const dy = point[1] - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private startTextEdit(annotationId: string): void {
        try {
            const annotation = this.annotations.get(annotationId);
            if (!annotation || !annotation.handles.textBox) return;

            // Create text input element
            const input = document.createElement('input');
            input.type = 'text';
            input.value = annotation.text || '';
            input.maxLength = this.config.maxTextLength || 200;
            input.style.cssText = `
                position: absolute;
                left: ${annotation.handles.textBox[0]}px;
                top: ${annotation.handles.textBox[1]}px;
                background: ${annotation.style.textBackgroundColor};
                color: ${annotation.style.textColor};
                font: ${annotation.style.font};
                border: 1px solid ${annotation.style.color};
                padding: 2px 4px;
                z-index: 10000;
                outline: none;
            `;

            // Add event listeners
            input.addEventListener('blur', () => {
                this.completeTextEdit(annotationId, input.value);
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.completeTextEdit(annotationId, input.value);
                    e.preventDefault();
                } else if (e.key === 'Escape') {
                    this.cancelTextEdit(input);
                    e.preventDefault();
                }
            });

            // Add to DOM
            document.body.appendChild(input);
            input.focus();
            input.select();

        } catch (error) {
            console.error('❌ Error starting text edit:', error);
        }
    }

    private completeTextEdit(annotationId: string, newText: string): void {
        try {
            const annotation = this.annotations.get(annotationId);
            if (!annotation) return;

            annotation.text = newText.trim();
            annotation.timestamp = new Date().toISOString();

            // Remove input element
            const input = document.querySelector('input[type="text"]') as HTMLInputElement;
            if (input) {
                document.body.removeChild(input);
            }

            console.log('✓ Arrow text updated:', annotationId);

            // Trigger update event
            this.triggerAnnotationEvent('arrowAnnotationTextUpdated', annotation);

        } catch (error) {
            console.error('❌ Error completing text edit:', error);
        }
    }

    private cancelTextEdit(input: HTMLInputElement): void {
        try {
            if (input) {
                document.body.removeChild(input);
            }
        } catch (error) {
            console.error('❌ Error cancelling text edit:', error);
        }
    }

    private deleteSelectedAnnotation(): void {
        try {
            // In a real implementation, this would delete the currently selected annotation
            console.log('Delete selected arrow annotation requested');

        } catch (error) {
            console.error('❌ Error deleting selected annotation:', error);
        }
    }

    private triggerAnnotationEvent(eventType: string, data: any): void {
        const customEvent = new CustomEvent(eventType, {
            detail: {
                annotationData: data,
                timestamp: new Date().toISOString(),
                source: 'ArrowAnnotationTool'
            }
        });

        eventTarget.dispatchEvent(customEvent);
    }

    public addArrowAnnotation(startPosition: Types.Point2, endPosition: Types.Point2, text?: string): string {
        try {
            const annotationId = this.createArrowAnnotation(startPosition, endPosition);
            
            if (text) {
                const annotation = this.annotations.get(annotationId);
                if (annotation) {
                    annotation.text = text;
                    this.updateArrowHead(annotation);
                }
            }

            return annotationId;

        } catch (error) {
            console.error('❌ Error adding arrow annotation:', error);
            throw error;
        }
    }

    public updateArrowAnnotation(annotationId: string, updates: Partial<ArrowAnnotationData>): boolean {
        try {
            const annotation = this.annotations.get(annotationId);
            if (!annotation) return false;

            // Update annotation properties
            Object.assign(annotation, updates);
            annotation.timestamp = new Date().toISOString();

            // Update arrow head if handles changed
            if (updates.handles) {
                this.updateArrowHead(annotation);
            }

            console.log('✓ Arrow annotation updated:', annotationId);

            // Trigger update event
            this.triggerAnnotationEvent('arrowAnnotationUpdated', annotation);

            return true;

        } catch (error) {
            console.error('❌ Error updating arrow annotation:', error);
            return false;
        }
    }

    public removeAnnotation(annotationId: string): boolean {
        try {
            if (!this.annotations.has(annotationId)) return false;

            const annotation = this.annotations.get(annotationId);
            this.annotations.delete(annotationId);

            console.log('✓ Arrow annotation removed:', annotationId);

            // Trigger removal event
            this.triggerAnnotationEvent('arrowAnnotationRemoved', annotation);

            return true;

        } catch (error) {
            console.error('❌ Error removing arrow annotation:', error);
            return false;
        }
    }

    public getAnnotation(annotationId: string): ArrowAnnotationData | null {
        return this.annotations.get(annotationId) || null;
    }

    public getAnnotations(): ArrowAnnotationData[] {
        return Array.from(this.annotations.values());
    }

    public getAnnotationsByViewport(viewportId: string): ArrowAnnotationData[] {
        return this.getAnnotations().filter(annotation => annotation.viewportId === viewportId);
    }

    public getAnnotationsByImage(imageId: string): ArrowAnnotationData[] {
        return this.getAnnotations().filter(annotation => annotation.imageId === imageId);
    }

    public clearAnnotations(): void {
        const count = this.annotations.size;
        this.annotations.clear();
        console.log(`✓ Cleared ${count} arrow annotations`);
    }

    public getAnnotationCount(): number {
        return this.annotations.size;
    }

    public enableArrowTool(): boolean {
        try {
            const toolGroup = ToolGroupManager.getToolGroup(this.toolGroupId);
            if (!toolGroup) {
                console.error('Tool group not found:', this.toolGroupId);
                return false;
            }

            console.log('✓ Arrow annotation tool enabled');
            return true;

        } catch (error) {
            console.error('❌ Error enabling arrow tool:', error);
            return false;
        }
    }

    public disableArrowTool(): boolean {
        try {
            const toolGroup = ToolGroupManager.getToolGroup(this.toolGroupId);
            if (!toolGroup) {
                console.error('Tool group not found:', this.toolGroupId);
                return false;
            }

            // Cancel any active drawing
            this.cancelArrowDrawing();

            console.log('✓ Arrow annotation tool disabled');
            return true;

        } catch (error) {
            console.error('❌ Error disabling arrow tool:', error);
            return false;
        }
    }

    public exportAnnotations(): string {
        const annotations = this.getAnnotations();
        return JSON.stringify(annotations, null, 2);
    }

    public importAnnotations(data: string): boolean {
        try {
            const annotations = JSON.parse(data) as ArrowAnnotationData[];
            
            if (!Array.isArray(annotations)) {
                throw new Error('Invalid annotations data format');
            }

            let importedCount = 0;
            annotations.forEach(annotation => {
                if (this.validateAnnotationData(annotation)) {
                    this.annotations.set(annotation.annotationUID, annotation);
                    importedCount++;
                }
            });

            console.log(`✓ Imported ${importedCount} arrow annotations`);
            return true;

        } catch (error) {
            console.error('❌ Error importing arrow annotations:', error);
            return false;
        }
    }

    private validateAnnotationData(data: any): boolean {
        return (
            data &&
            typeof data.annotationUID === 'string' &&
            typeof data.toolName === 'string' &&
            data.handles &&
            Array.isArray(data.handles.start) &&
            Array.isArray(data.handles.end) &&
            data.handles.start.length === 2 &&
            data.handles.end.length === 2 &&
            typeof data.style === 'object'
        );
    }

    public updateConfig(newConfig: Partial<ArrowAnnotationConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log('✓ Arrow annotation tool configuration updated');
    }

    public getConfig(): ArrowAnnotationConfig {
        return { ...this.config };
    }

    public getToolGroupId(): string {
        return this.toolGroupId;
    }

    public getInitializationStatus(): boolean {
        return this.isInitialized;
    }

    public dispose(): void {
        try {
            // Cancel any active drawing
            this.cancelArrowDrawing();

            // Remove event listeners
            this.eventListeners.forEach((listener, eventType) => {
                if (eventType === 'keydown') {
                    document.removeEventListener('keydown', listener);
                }
            });
            this.eventListeners.clear();

            // Clear annotations
            this.annotations.clear();

            this.isInitialized = false;
            
            console.log('✓ Arrow Annotation Tool disposed');

        } catch (error) {
            console.error('❌ Error disposing Arrow Annotation Tool:', error);
        }
    }
}

// Convenience functions
export function createArrowAnnotationTool(toolGroupId: string, config?: ArrowAnnotationConfig): ArrowAnnotationTool {
    return new ArrowAnnotationTool(toolGroupId, config);
}

export function getDefaultArrowAnnotationConfig(): ArrowAnnotationConfig {
    return {
        enableArrowDrawing: true,
        enableArrowEdit: true,
        enableArrowMove: true,
        enableArrowDelete: true,
        enableTextLabels: true,
        defaultText: '',
        maxTextLength: 200,
        arrowHead: {
            size: 10,
            angle: 30,
            style: 'filled'
        },
        style: {
            color: '#FF0000',
            lineWidth: 2,
            lineDash: [],
            font: '12px Arial',
            textBackgroundColor: 'rgba(0, 0, 0, 0.8)',
            textColor: '#FFFFFF',
            arrowHeadColor: '#FF0000',
            arrowHeadSize: 10,
            opacity: 1.0
        },
        interactive: true,
        showTextBox: true,
        snapToGrid: false,
        gridSize: 10
    };
}