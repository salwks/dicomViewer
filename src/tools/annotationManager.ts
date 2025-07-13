import { 
    ToolGroupManager,
    Enums as ToolEnums,
    annotation
} from '@cornerstonejs/tools';
import { eventTarget } from '@cornerstonejs/core';
import { Types } from '@cornerstonejs/core';

// Legacy type export for backwards compatibility
export interface AnnotationData {
    annotationUID: string;
    toolName: string;
    data?: any;
    metadata?: any;
    [key: string]: any;
}

export interface AnnotationManagerConfig {
    enableEventListeners?: boolean;
    autoSave?: boolean;
    autoSaveInterval?: number;
    maxAnnotations?: number;
    defaultStyle?: {
        color?: string;
        lineWidth?: number;
        font?: string;
        textBackgroundColor?: string;
        textColor?: string;
    };
}

/**
 * Refactored Annotation Manager that uses official Cornerstone3D v3 APIs
 * All annotation state management is delegated to cornerstoneTools.annotation.state
 */
export class AnnotationManager {
    private config: AnnotationManagerConfig;
    private eventListeners: Map<string, (event: any) => void> = new Map();
    private isInitialized: boolean = false;
    private autoSaveTimer: number | null = null;
    private toolGroupId: string;

    constructor(toolGroupId: string = 'annotation-manager', config: AnnotationManagerConfig = {}) {
        this.toolGroupId = toolGroupId;
        this.config = {
            enableEventListeners: true,
            autoSave: true,
            autoSaveInterval: 30000, // 30 seconds
            maxAnnotations: 1000,
            defaultStyle: {
                color: '#FFFF00',
                lineWidth: 2,
                font: '14px Arial',
                textBackgroundColor: 'rgba(0, 0, 0, 0.8)',
                textColor: '#FFFFFF'
            },
            ...config
        };

        this.initialize();
    }

    private initialize(): void {
        try {
            if (this.config.enableEventListeners) {
                this.setupEventListeners();
            }
            
            if (this.config.autoSave) {
                this.setupAutoSave();
            }
            
            this.isInitialized = true;
            console.log('✓ Annotation Manager initialized using official Cornerstone3D v3 APIs');
        } catch (error) {
            console.error('❌ Error initializing Annotation Manager:', error);
            throw error;
        }
    }

    private setupEventListeners(): void {
        // Listen for annotation events using the official event system
        const annotationAddedListener = (evt: any) => {
            this.handleAnnotationAdded(evt);
        };

        const annotationModifiedListener = (evt: any) => {
            this.handleAnnotationModified(evt);
        };

        const annotationRemovedListener = (evt: any) => {
            this.handleAnnotationRemoved(evt);
        };

        // Store listeners for cleanup
        this.eventListeners.set('ANNOTATION_ADDED', annotationAddedListener);
        this.eventListeners.set('ANNOTATION_MODIFIED', annotationModifiedListener);
        this.eventListeners.set('ANNOTATION_REMOVED', annotationRemovedListener);

        // Add event listeners using the official event target
        eventTarget.addEventListener(ToolEnums.Events.ANNOTATION_ADDED, annotationAddedListener);
        eventTarget.addEventListener(ToolEnums.Events.ANNOTATION_MODIFIED, annotationModifiedListener);
        eventTarget.addEventListener(ToolEnums.Events.ANNOTATION_REMOVED, annotationRemovedListener);
    }

    private setupAutoSave(): void {
        if (this.config.autoSaveInterval) {
            this.autoSaveTimer = window.setInterval(() => {
                this.saveAnnotations();
            }, this.config.autoSaveInterval);
        }
    }

    private handleAnnotationAdded(evt: any): void {
        try {
            const { annotation: annotationData } = evt.detail;
            
            // Check annotation limit using the official API
            if (this.config.maxAnnotations) {
                const currentCount = this.getAnnotationCount();
                if (currentCount >= this.config.maxAnnotations) {
                    console.warn('⚠️ Maximum annotation limit reached');
                    return;
                }
            }

            console.log('✓ Annotation added:', annotationData.annotationUID);
            
            // Trigger custom event for external listeners
            this.triggerAnnotationEvent('annotationAdded', annotationData);
        } catch (error) {
            console.error('❌ Error handling annotation added:', error);
        }
    }

    private handleAnnotationModified(evt: any): void {
        try {
            const { annotation: annotationData } = evt.detail;
            console.log('✓ Annotation modified:', annotationData.annotationUID);
            
            // Trigger custom event for external listeners
            this.triggerAnnotationEvent('annotationModified', annotationData);
        } catch (error) {
            console.error('❌ Error handling annotation modified:', error);
        }
    }

    private handleAnnotationRemoved(evt: any): void {
        try {
            const { annotationUID } = evt.detail;
            console.log('✓ Annotation removed:', annotationUID);
            
            // Trigger custom event for external listeners
            this.triggerAnnotationEvent('annotationRemoved', { annotationUID });
        } catch (error) {
            console.error('❌ Error handling annotation removed:', error);
        }
    }

    private triggerAnnotationEvent(eventType: string, data: any): void {
        const customEvent = new CustomEvent(eventType, {
            detail: {
                annotationData: data,
                timestamp: new Date().toISOString(),
                source: 'AnnotationManager'
            }
        });

        eventTarget.dispatchEvent(customEvent);
    }

    /**
     * Get all annotations using the official Cornerstone3D v3 API
     */
    public getAnnotations(): any[] {
        try {
            const allAnnotations = annotation.state.getAllAnnotations();
            return this.flattenAnnotationState(allAnnotations);
        } catch (error) {
            console.error('❌ Error getting annotations:', error);
            return [];
        }
    }

    /**
     * Get annotations for a specific viewport
     */
    public getAnnotationsForViewport(element: HTMLDivElement): any[] {
        try {
            // Try both element and element.id approaches for compatibility
            let viewportAnnotations;
            try {
                // Use the element ID for getting annotations - provide toolGroupId as 2nd param if needed
                viewportAnnotations = annotation.state.getAnnotations(element.id || 'viewport', this.toolGroupId);
            } catch {
                // Fallback to all annotations and filter
                const allAnnotations = annotation.state.getAllAnnotations();
                return this.flattenAnnotationState(allAnnotations);
            }
            return this.flattenAnnotationState(viewportAnnotations);
        } catch (error) {
            console.error('❌ Error getting viewport annotations:', error);
            return [];
        }
    }

    /**
     * Get annotations by tool name
     */
    public getAnnotationsByToolName(toolName: string): any[] {
        try {
            const allAnnotations = this.getAnnotations();
            return allAnnotations.filter(ann => ann.metadata?.toolName === toolName);
        } catch (error) {
            console.error('❌ Error filtering annotations by tool name:', error);
            return [];
        }
    }

    /**
     * Remove annotation using the official API
     */
    public removeAnnotation(annotationUID: string): boolean {
        try {
            const allAnnotations = annotation.state.getAllAnnotations();
            
            // Find and remove the annotation
            for (const frameKey in allAnnotations) {
                const frameData = allAnnotations[frameKey];
                for (const toolName in frameData) {
                    const toolAnnotations = frameData[toolName];
                    if (Array.isArray(toolAnnotations)) {
                        const annotationToRemove = toolAnnotations.find(
                            ann => ann.annotationUID === annotationUID
                        );
                        if (annotationToRemove) {
                            annotation.state.removeAnnotation(annotationToRemove.annotationUID);
                            console.log('✓ Annotation removed:', annotationUID);
                            return true;
                        }
                    }
                }
            }
            
            console.warn(`Annotation ${annotationUID} not found`);
            return false;
        } catch (error) {
            console.error('❌ Error removing annotation:', error);
            return false;
        }
    }

    /**
     * Clear all annotations using the official API
     */
    public clearAllAnnotations(): void {
        try {
            annotation.state.removeAllAnnotations();
            console.log('✓ All annotations cleared');
        } catch (error) {
            console.error('❌ Error clearing annotations:', error);
        }
    }

    /**
     * Clear annotations for a specific viewport
     */
    public clearAnnotationsForViewport(element: HTMLDivElement): void {
        try {
            // Get annotations for the viewport
            let viewportAnnotations;
            try {
                // Use the element ID for getting annotations - provide toolGroupId as 2nd param if needed
                viewportAnnotations = annotation.state.getAnnotations(element.id || 'viewport', this.toolGroupId);
            } catch {
                // If specific viewport annotations fail, clear all
                this.clearAllAnnotations();
                return;
            }
            
            const annotationsToRemove = this.flattenAnnotationState(viewportAnnotations);
            
            annotationsToRemove.forEach(ann => {
                if (ann.annotationUID) {
                    annotation.state.removeAnnotation(ann.annotationUID);
                }
            });
            
            console.log(`✓ Cleared ${annotationsToRemove.length} annotations for viewport`);
        } catch (error) {
            console.error('❌ Error clearing viewport annotations:', error);
        }
    }

    /**
     * Get total annotation count
     */
    public getAnnotationCount(): number {
        try {
            const allAnnotations = this.getAnnotations();
            return allAnnotations.length;
        } catch (error) {
            console.error('❌ Error getting annotation count:', error);
            return 0;
        }
    }

    /**
     * Save annotations to local storage
     */
    public saveAnnotations(): string {
        try {
            const allAnnotations = annotation.state.getAllAnnotations();
            const annotationsData = {
                annotations: allAnnotations,
                timestamp: new Date().toISOString(),
                version: '3.0.0'
            };

            const data = JSON.stringify(annotationsData, null, 2);
            localStorage.setItem('cornerstone3d-annotations', data);
            
            console.log(`✓ Saved annotation state`);
            return data;
        } catch (error) {
            console.error('❌ Error saving annotations:', error);
            throw error;
        }
    }

    /**
     * Load annotations from local storage
     */
    public loadAnnotations(): boolean {
        try {
            const data = localStorage.getItem('cornerstone3d-annotations');
            if (!data) {
                console.log('No saved annotations found');
                return false;
            }

            const parsedData = JSON.parse(data);
            const savedAnnotations = parsedData.annotations || {};
            
            // Clear existing annotations
            this.clearAllAnnotations();
            
            // Restore annotations using the official API
            for (const frameKey in savedAnnotations) {
                const frameData = savedAnnotations[frameKey];
                for (const toolName in frameData) {
                    const toolAnnotations = frameData[toolName];
                    if (Array.isArray(toolAnnotations)) {
                        toolAnnotations.forEach(ann => {
                            try {
                                // Find the appropriate element for this annotation
                                const element = this.findElementForAnnotation(ann);
                                if (element) {
                                    annotation.state.addAnnotation(ann, element);
                                }
                            } catch (addError) {
                                console.warn('Error restoring annotation:', addError);
                            }
                        });
                    }
                }
            }

            console.log('✓ Loaded annotation state');
            return true;
        } catch (error) {
            console.error('❌ Error loading annotations:', error);
            return false;
        }
    }

    /**
     * Export annotations in JSON format
     */
    public exportAnnotations(format: 'json' = 'json'): string {
        try {
            const allAnnotations = annotation.state.getAllAnnotations();
            return JSON.stringify({
                annotations: allAnnotations,
                timestamp: new Date().toISOString(),
                version: '3.0.0',
                format
            }, null, 2);
        } catch (error) {
            console.error('❌ Error exporting annotations:', error);
            throw error;
        }
    }

    /**
     * Helper method to flatten annotation state structure
     */
    private flattenAnnotationState(annotationState: any): any[] {
        const flattened: any[] = [];
        
        if (!annotationState) return flattened;
        
        for (const frameKey in annotationState) {
            const frameData = annotationState[frameKey];
            for (const toolName in frameData) {
                const toolAnnotations = frameData[toolName];
                if (Array.isArray(toolAnnotations)) {
                    flattened.push(...toolAnnotations);
                }
            }
        }
        
        return flattened;
    }

    /**
     * Helper method to find the appropriate element for an annotation
     */
    private findElementForAnnotation(annotationData: any): HTMLDivElement | null {
        // Try to find element by viewport ID from metadata
        const viewportId = annotationData.metadata?.viewportId;
        if (viewportId) {
            const element = document.getElementById(viewportId);
            if (element instanceof HTMLDivElement) {
                return element;
            }
        }
        
        // Fallback: return the first viewport element found
        const viewportElements = document.querySelectorAll('[data-viewport-uid]');
        if (viewportElements.length > 0 && viewportElements[0] instanceof HTMLDivElement) {
            return viewportElements[0];
        }
        
        return null;
    }

    /**
     * Update configuration
     */
    public updateConfig(newConfig: Partial<AnnotationManagerConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        // Restart auto-save if configuration changed
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
        
        if (this.config.autoSave) {
            this.setupAutoSave();
        }
        
        console.log('✓ Annotation Manager configuration updated');
    }

    /**
     * Get current configuration
     */
    public getConfig(): AnnotationManagerConfig {
        return { ...this.config };
    }

    /**
     * Check initialization status
     */
    public getInitializationStatus(): boolean {
        return this.isInitialized;
    }
    
    /**
     * Legacy method: Get single annotation by UID (for backwards compatibility)
     */
    public getAnnotation(annotationUID: string): any | null {
        try {
            const allAnnotations = this.getAnnotations();
            return allAnnotations.find(ann => ann.annotationUID === annotationUID) || null;
        } catch (error) {
            console.error('❌ Error getting annotation by UID:', error);
            return null;
        }
    }
    
    /**
     * Legacy method: Add annotation (for backwards compatibility)
     */
    public addAnnotation(annotationData: AnnotationData): boolean {
        try {
            // Create a properly formatted annotation for Cornerstone3D
            const formattedAnnotation = {
                ...annotationData,
                data: annotationData.data || {},
                metadata: {
                    ...annotationData.metadata,
                    toolName: annotationData.toolName
                }
            };
            
            // Find the appropriate element for this annotation
            const element = this.findElementForAnnotation(annotationData);
            if (element) {
                annotation.state.addAnnotation(formattedAnnotation, element);
                console.log('✓ Annotation added:', annotationData.annotationUID);
                return true;
            } else {
                console.warn('No suitable element found for annotation');
                return false;
            }
        } catch (error) {
            console.error('❌ Error adding annotation:', error);
            return false;
        }
    }
    
    /**
     * Legacy method: Update annotation (for backwards compatibility)
     */
    public updateAnnotation(annotationUID: string, updateData: Partial<AnnotationData>): boolean {
        try {
            const existingAnnotation = this.getAnnotation(annotationUID);
            if (!existingAnnotation) {
                console.warn(`Annotation ${annotationUID} not found for update`);
                return false;
            }
            
            // Merge update data
            Object.assign(existingAnnotation, updateData);
            
            // Trigger annotation modified event
            this.triggerAnnotationEvent('annotationModified', existingAnnotation);
            
            console.log('✓ Annotation updated:', annotationUID);
            return true;
        } catch (error) {
            console.error('❌ Error updating annotation:', error);
            return false;
        }
    }
    
    /**
     * Legacy method: Get annotations by type (for backwards compatibility)
     */
    public getAnnotationsByType(toolName: string): any[] {
        return this.getAnnotationsByToolName(toolName);
    }
    
    /**
     * Legacy method: Clear annotations (for backwards compatibility)
     */
    public clearAnnotations(): void {
        this.clearAllAnnotations();
    }

    /**
     * Dispose of the annotation manager and clean up resources
     */
    public dispose(): void {
        try {
            // Remove event listeners
            this.eventListeners.forEach((listener, eventType) => {
                eventTarget.removeEventListener(eventType, listener);
            });
            this.eventListeners.clear();

            // Stop auto-save timer
            if (this.autoSaveTimer) {
                clearInterval(this.autoSaveTimer);
                this.autoSaveTimer = null;
            }

            this.isInitialized = false;
            console.log('✓ Annotation Manager disposed');
        } catch (error) {
            console.error('❌ Error disposing Annotation Manager:', error);
        }
    }
}

/**
 * Convenience function to create an annotation manager instance
 */
export function createAnnotationManager(
    toolGroupId?: string, 
    config?: AnnotationManagerConfig
): AnnotationManager {
    return new AnnotationManager(toolGroupId, config);
}

/**
 * Get default annotation manager configuration
 */
export function getDefaultAnnotationConfig(): AnnotationManagerConfig {
    return {
        enableEventListeners: true,
        autoSave: true,
        autoSaveInterval: 30000,
        maxAnnotations: 1000,
        defaultStyle: {
            color: '#FFFF00',
            lineWidth: 2,
            font: '14px Arial',
            textBackgroundColor: 'rgba(0, 0, 0, 0.8)',
            textColor: '#FFFFFF'
        }
    };
}