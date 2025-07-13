import { 
    addTool,
    ProbeTool,
    ToolGroupManager,
    Enums as ToolEnums,
    annotation
} from '@cornerstonejs/tools';
import { eventTarget } from '@cornerstonejs/core';
import { Types } from '@cornerstonejs/core';
import { AnnotationData } from './annotationManager';

export interface TextAnnotationData extends AnnotationData {
    text: string;
    position: Types.Point2;
    textBox?: {
        width: number;
        height: number;
        hasMoved: boolean;
        worldPosition: Types.Point3;
    };
    style: {
        color: string;
        lineWidth: number;
        font: string;
        textBackgroundColor: string;
        textColor: string;
        fontSize: number;
        fontFamily: string;
        textAlign: 'left' | 'center' | 'right';
        textBaseline: 'top' | 'middle' | 'bottom';
        padding: number;
        borderRadius: number;
        opacity: number;
    };
}

export interface TextAnnotationConfig {
    enableTextInput?: boolean;
    enableTextEdit?: boolean;
    enableTextMove?: boolean;
    enableTextDelete?: boolean;
    maxTextLength?: number;
    defaultText?: string;
    style?: {
        color?: string;
        lineWidth?: number;
        font?: string;
        textBackgroundColor?: string;
        textColor?: string;
        fontSize?: number;
        fontFamily?: string;
        textAlign?: 'left' | 'center' | 'right';
        textBaseline?: 'top' | 'middle' | 'bottom';
        padding?: number;
        borderRadius?: number;
        opacity?: number;
    };
    interactive?: boolean;
    showTextBox?: boolean;
    allowMultiline?: boolean;
}

export class TextAnnotationTool {
    private toolGroupId: string;
    private config: TextAnnotationConfig;
    private annotations: Map<string, TextAnnotationData> = new Map();
    private eventListeners: Map<string, (event: any) => void> = new Map();
    private isInitialized: boolean = false;
    private activeTextInput: HTMLInputElement | null = null;
    private editingAnnotationId: string | null = null;

    constructor(toolGroupId: string, config: TextAnnotationConfig = {}) {
        this.toolGroupId = toolGroupId;
        this.config = {
            enableTextInput: true,
            enableTextEdit: true,
            enableTextMove: true,
            enableTextDelete: true,
            maxTextLength: 500,
            defaultText: 'New Text',
            style: {
                color: '#FFFF00',
                lineWidth: 2,
                font: '14px Arial',
                textBackgroundColor: 'rgba(0, 0, 0, 0.8)',
                textColor: '#FFFFFF',
                fontSize: 14,
                fontFamily: 'Arial',
                textAlign: 'left',
                textBaseline: 'top',
                padding: 4,
                borderRadius: 2,
                opacity: 1.0
            },
            interactive: true,
            showTextBox: true,
            allowMultiline: true,
            ...config
        };

        this.initialize();
    }

    private initialize(): void {
        try {
            this.setupEventListeners();
            this.isInitialized = true;
            
            console.log('✓ Text Annotation Tool initialized');
        } catch (error) {
            console.error('❌ Error initializing Text Annotation Tool:', error);
            throw error;
        }
    }

    private setupEventListeners(): void {
        // Listen for mouse/touch events for text placement
        const mouseClickListener = (event: any) => {
            if (this.isActiveTextTool() && this.config.enableTextInput) {
                this.handleTextPlacement(event);
            }
        };

        const mouseDoubleClickListener = (event: any) => {
            if (this.config.enableTextEdit) {
                this.handleTextEdit(event);
            }
        };

        const keydownListener = (event: KeyboardEvent) => {
            this.handleKeydown(event);
        };

        // Store event listeners for cleanup
        this.eventListeners.set('mouseClick', mouseClickListener);
        this.eventListeners.set('mouseDoubleClick', mouseDoubleClickListener);
        this.eventListeners.set('keydown', keydownListener);

        // Note: In a real implementation, these would be attached to specific viewport elements
        // For now, we'll use document-level listeners
        document.addEventListener('keydown', keydownListener);
    }

    private isActiveTextTool(): boolean {
        // Check if text annotation tool is currently active
        try {
            const toolGroup = ToolGroupManager.getToolGroup(this.toolGroupId);
            if (toolGroup) {
                // In a real implementation, we would check the active tool state
                // For now, we'll return true if the tool group exists
                return true;
            }
        } catch (error) {
            console.error('Error checking active tool:', error);
        }
        return false;
    }

    private handleTextPlacement(event: any): void {
        try {
            if (!this.config.enableTextInput) return;

            const position = this.getMousePosition(event);
            if (!position) return;

            // Create new text annotation
            const annotationId = this.createTextAnnotation(position);
            
            // Start text input if interactive
            if (this.config.interactive && annotationId) {
                this.startTextInput(annotationId, position);
            }

        } catch (error) {
            console.error('❌ Error handling text placement:', error);
        }
    }

    private handleTextEdit(event: any): void {
        try {
            if (!this.config.enableTextEdit) return;

            const position = this.getMousePosition(event);
            if (!position) return;

            // Find annotation at this position
            const annotationId = this.findAnnotationAtPosition(position);
            if (annotationId) {
                this.startTextEdit(annotationId);
            }

        } catch (error) {
            console.error('❌ Error handling text edit:', error);
        }
    }

    private handleKeydown(event: KeyboardEvent): void {
        try {
            // Handle keyboard shortcuts
            if (event.key === 'Escape') {
                this.cancelTextInput();
            } else if (event.key === 'Enter' && !event.shiftKey) {
                if (!this.config.allowMultiline) {
                    this.completeTextInput();
                }
            } else if (event.key === 'Delete' && this.config.enableTextDelete) {
                this.deleteSelectedAnnotation();
            }

        } catch (error) {
            console.error('❌ Error handling keydown:', error);
        }
    }

    private getMousePosition(event: any): Types.Point2 | null {
        try {
            // Extract mouse position from event
            // In a real implementation, this would convert screen coordinates to image coordinates
            const rect = event.target?.getBoundingClientRect();
            if (rect) {
                return [
                    event.clientX - rect.left,
                    event.clientY - rect.top
                ];
            }
        } catch (error) {
            console.error('Error getting mouse position:', error);
        }
        return null;
    }

    private createTextAnnotation(position: Types.Point2, text?: string): string {
        try {
            const annotationId = `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            const textAnnotation: TextAnnotationData = {
                annotationUID: annotationId,
                toolName: 'TextAnnotation',
                text: text || this.config.defaultText || 'New Text',
                position: position,
                textBox: {
                    width: 100,
                    height: 30,
                    hasMoved: false,
                    worldPosition: [position[0], position[1], 0]
                },
                style: {
                    color: this.config.style?.color || '#FFFF00',
                    lineWidth: this.config.style?.lineWidth || 2,
                    font: this.config.style?.font || '14px Arial',
                    textBackgroundColor: this.config.style?.textBackgroundColor || 'rgba(0, 0, 0, 0.8)',
                    textColor: this.config.style?.textColor || '#FFFFFF',
                    fontSize: this.config.style?.fontSize || 14,
                    fontFamily: this.config.style?.fontFamily || 'Arial',
                    textAlign: this.config.style?.textAlign || 'left',
                    textBaseline: this.config.style?.textBaseline || 'top',
                    padding: this.config.style?.padding || 4,
                    borderRadius: this.config.style?.borderRadius || 2,
                    opacity: this.config.style?.opacity || 1.0
                },
                imageId: '',
                viewportId: '',
                timestamp: new Date().toISOString(),
                metadata: {}
            };

            this.annotations.set(annotationId, textAnnotation);
            
            console.log('✓ Text annotation created:', annotationId);
            
            // Trigger custom event
            this.triggerAnnotationEvent('textAnnotationCreated', textAnnotation);
            
            return annotationId;

        } catch (error) {
            console.error('❌ Error creating text annotation:', error);
            throw error;
        }
    }

    private startTextInput(annotationId: string, position: Types.Point2): void {
        try {
            const annotation = this.annotations.get(annotationId);
            if (!annotation) return;

            // Create input element
            const input = document.createElement('input');
            input.type = 'text';
            input.value = annotation.text;
            input.maxLength = this.config.maxTextLength || 500;
            input.style.cssText = `
                position: absolute;
                left: ${position[0]}px;
                top: ${position[1]}px;
                background: ${annotation.style.textBackgroundColor};
                color: ${annotation.style.textColor};
                font: ${annotation.style.font};
                border: 1px solid ${annotation.style.color};
                border-radius: ${annotation.style.borderRadius}px;
                padding: ${annotation.style.padding}px;
                opacity: ${annotation.style.opacity};
                z-index: 10000;
                outline: none;
            `;

            // Add event listeners
            input.addEventListener('blur', () => {
                this.completeTextInput();
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    this.completeTextInput();
                    e.preventDefault();
                } else if (e.key === 'Escape') {
                    this.cancelTextInput();
                    e.preventDefault();
                }
            });

            // Add to DOM
            document.body.appendChild(input);
            input.focus();
            input.select();

            this.activeTextInput = input;
            this.editingAnnotationId = annotationId;

        } catch (error) {
            console.error('❌ Error starting text input:', error);
        }
    }

    private startTextEdit(annotationId: string): void {
        try {
            const annotation = this.annotations.get(annotationId);
            if (!annotation) return;

            this.startTextInput(annotationId, annotation.position);

        } catch (error) {
            console.error('❌ Error starting text edit:', error);
        }
    }

    private completeTextInput(): void {
        try {
            if (!this.activeTextInput || !this.editingAnnotationId) return;

            const newText = this.activeTextInput.value.trim();
            if (newText) {
                this.updateAnnotationText(this.editingAnnotationId, newText);
            } else {
                // Remove annotation if text is empty
                this.removeAnnotation(this.editingAnnotationId);
            }

            this.cleanupTextInput();

        } catch (error) {
            console.error('❌ Error completing text input:', error);
        }
    }

    private cancelTextInput(): void {
        try {
            if (this.editingAnnotationId) {
                // If this was a new annotation, remove it
                const annotation = this.annotations.get(this.editingAnnotationId);
                if (annotation && annotation.text === this.config.defaultText) {
                    this.removeAnnotation(this.editingAnnotationId);
                }
            }

            this.cleanupTextInput();

        } catch (error) {
            console.error('❌ Error canceling text input:', error);
        }
    }

    private cleanupTextInput(): void {
        if (this.activeTextInput) {
            document.body.removeChild(this.activeTextInput);
            this.activeTextInput = null;
        }
        this.editingAnnotationId = null;
    }

    private updateAnnotationText(annotationId: string, newText: string): void {
        try {
            const annotation = this.annotations.get(annotationId);
            if (!annotation) return;

            annotation.text = newText;
            annotation.timestamp = new Date().toISOString();

            // Update text box size based on text
            const textMetrics = this.measureText(newText, annotation.style);
            annotation.textBox!.width = textMetrics.width + (annotation.style.padding * 2);
            annotation.textBox!.height = textMetrics.height + (annotation.style.padding * 2);

            console.log('✓ Text annotation updated:', annotationId);
            
            // Trigger custom event
            this.triggerAnnotationEvent('textAnnotationUpdated', annotation);

        } catch (error) {
            console.error('❌ Error updating annotation text:', error);
        }
    }

    private measureText(text: string, style: TextAnnotationData['style']): { width: number; height: number } {
        try {
            // Create temporary canvas for text measurement
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
                ctx.font = `${style.fontSize}px ${style.fontFamily}`;
                const metrics = ctx.measureText(text);
                
                return {
                    width: metrics.width,
                    height: style.fontSize * 1.2 // Approximate line height
                };
            }

        } catch (error) {
            console.error('Error measuring text:', error);
        }

        // Fallback measurements
        return {
            width: text.length * (this.config.style?.fontSize || 14) * 0.6,
            height: (this.config.style?.fontSize || 14) * 1.2
        };
    }

    private findAnnotationAtPosition(position: Types.Point2): string | null {
        try {
            for (const [id, annotation] of this.annotations) {
                if (this.isPositionInAnnotation(position, annotation)) {
                    return id;
                }
            }
        } catch (error) {
            console.error('Error finding annotation at position:', error);
        }
        return null;
    }

    private isPositionInAnnotation(position: Types.Point2, annotation: TextAnnotationData): boolean {
        try {
            if (!annotation.textBox) return false;

            const left = annotation.position[0];
            const top = annotation.position[1];
            const right = left + annotation.textBox.width;
            const bottom = top + annotation.textBox.height;

            return position[0] >= left && position[0] <= right &&
                   position[1] >= top && position[1] <= bottom;

        } catch (error) {
            console.error('Error checking position in annotation:', error);
            return false;
        }
    }

    private deleteSelectedAnnotation(): void {
        try {
            // In a real implementation, this would delete the currently selected annotation
            // For now, we'll just log the action
            console.log('Delete selected annotation requested');

        } catch (error) {
            console.error('❌ Error deleting selected annotation:', error);
        }
    }

    private triggerAnnotationEvent(eventType: string, data: any): void {
        const customEvent = new CustomEvent(eventType, {
            detail: {
                annotationData: data,
                timestamp: new Date().toISOString(),
                source: 'TextAnnotationTool'
            }
        });

        eventTarget.dispatchEvent(customEvent);
    }

    public addTextAnnotation(position: Types.Point2, text?: string, style?: Partial<TextAnnotationData['style']>): string {
        try {
            const annotationId = this.createTextAnnotation(position, text);
            
            if (style) {
                this.updateAnnotationStyle(annotationId, style);
            }

            return annotationId;

        } catch (error) {
            console.error('❌ Error adding text annotation:', error);
            throw error;
        }
    }

    public updateAnnotationStyle(annotationId: string, style: Partial<TextAnnotationData['style']>): boolean {
        try {
            const annotation = this.annotations.get(annotationId);
            if (!annotation) return false;

            annotation.style = { ...annotation.style, ...style };
            annotation.timestamp = new Date().toISOString();

            // Update font string if font properties changed
            if (style.fontSize || style.fontFamily) {
                annotation.style.font = `${annotation.style.fontSize}px ${annotation.style.fontFamily}`;
            }

            console.log('✓ Text annotation style updated:', annotationId);
            
            // Trigger custom event
            this.triggerAnnotationEvent('textAnnotationStyleUpdated', annotation);

            return true;

        } catch (error) {
            console.error('❌ Error updating annotation style:', error);
            return false;
        }
    }

    public moveAnnotation(annotationId: string, newPosition: Types.Point2): boolean {
        try {
            if (!this.config.enableTextMove) return false;

            const annotation = this.annotations.get(annotationId);
            if (!annotation) return false;

            annotation.position = newPosition;
            annotation.timestamp = new Date().toISOString();
            
            if (annotation.textBox) {
                annotation.textBox.hasMoved = true;
                annotation.textBox.worldPosition = [newPosition[0], newPosition[1], 0];
            }

            console.log('✓ Text annotation moved:', annotationId);
            
            // Trigger custom event
            this.triggerAnnotationEvent('textAnnotationMoved', annotation);

            return true;

        } catch (error) {
            console.error('❌ Error moving annotation:', error);
            return false;
        }
    }

    public removeAnnotation(annotationId: string): boolean {
        try {
            if (!this.annotations.has(annotationId)) return false;

            const annotation = this.annotations.get(annotationId);
            this.annotations.delete(annotationId);

            console.log('✓ Text annotation removed:', annotationId);
            
            // Trigger custom event
            this.triggerAnnotationEvent('textAnnotationRemoved', annotation);

            return true;

        } catch (error) {
            console.error('❌ Error removing annotation:', error);
            return false;
        }
    }

    public getAnnotation(annotationId: string): TextAnnotationData | null {
        return this.annotations.get(annotationId) || null;
    }

    public getAnnotations(): TextAnnotationData[] {
        return Array.from(this.annotations.values());
    }

    public getAnnotationsByViewport(viewportId: string): TextAnnotationData[] {
        return this.getAnnotations().filter(annotation => annotation.viewportId === viewportId);
    }

    public getAnnotationsByImage(imageId: string): TextAnnotationData[] {
        return this.getAnnotations().filter(annotation => annotation.imageId === imageId);
    }

    public clearAnnotations(): void {
        const count = this.annotations.size;
        this.annotations.clear();
        console.log(`✓ Cleared ${count} text annotations`);
    }

    public getAnnotationCount(): number {
        return this.annotations.size;
    }

    public enableTextTool(): boolean {
        try {
            const toolGroup = ToolGroupManager.getToolGroup(this.toolGroupId);
            if (!toolGroup) {
                console.error('Tool group not found:', this.toolGroupId);
                return false;
            }

            // In a real implementation, this would activate the text annotation tool
            // For now, we'll just log the action
            console.log('✓ Text annotation tool enabled');
            return true;

        } catch (error) {
            console.error('❌ Error enabling text tool:', error);
            return false;
        }
    }

    public disableTextTool(): boolean {
        try {
            const toolGroup = ToolGroupManager.getToolGroup(this.toolGroupId);
            if (!toolGroup) {
                console.error('Tool group not found:', this.toolGroupId);
                return false;
            }

            // Cancel any active text input
            this.cancelTextInput();

            // In a real implementation, this would deactivate the text annotation tool
            console.log('✓ Text annotation tool disabled');
            return true;

        } catch (error) {
            console.error('❌ Error disabling text tool:', error);
            return false;
        }
    }

    public exportAnnotations(): string {
        const annotations = this.getAnnotations();
        return JSON.stringify(annotations, null, 2);
    }

    public importAnnotations(data: string): boolean {
        try {
            const annotations = JSON.parse(data) as TextAnnotationData[];
            
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

            console.log(`✓ Imported ${importedCount} text annotations`);
            return true;

        } catch (error) {
            console.error('❌ Error importing text annotations:', error);
            return false;
        }
    }

    private validateAnnotationData(data: any): boolean {
        return (
            data &&
            typeof data.annotationUID === 'string' &&
            typeof data.toolName === 'string' &&
            typeof data.text === 'string' &&
            Array.isArray(data.position) &&
            data.position.length === 2 &&
            typeof data.style === 'object'
        );
    }

    public updateConfig(newConfig: Partial<TextAnnotationConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log('✓ Text annotation tool configuration updated');
    }

    public getConfig(): TextAnnotationConfig {
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
            // Cancel any active text input
            this.cancelTextInput();

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
            
            console.log('✓ Text Annotation Tool disposed');

        } catch (error) {
            console.error('❌ Error disposing Text Annotation Tool:', error);
        }
    }
}

// Convenience functions
export function createTextAnnotationTool(toolGroupId: string, config?: TextAnnotationConfig): TextAnnotationTool {
    return new TextAnnotationTool(toolGroupId, config);
}

export function getDefaultTextAnnotationConfig(): TextAnnotationConfig {
    return {
        enableTextInput: true,
        enableTextEdit: true,
        enableTextMove: true,
        enableTextDelete: true,
        maxTextLength: 500,
        defaultText: 'New Text',
        style: {
            color: '#FFFF00',
            lineWidth: 2,
            font: '14px Arial',
            textBackgroundColor: 'rgba(0, 0, 0, 0.8)',
            textColor: '#FFFFFF',
            fontSize: 14,
            fontFamily: 'Arial',
            textAlign: 'left',
            textBaseline: 'top',
            padding: 4,
            borderRadius: 2,
            opacity: 1.0
        },
        interactive: true,
        showTextBox: true,
        allowMultiline: true
    };
}