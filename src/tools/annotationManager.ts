import { 
    addTool,
    ProbeTool,
    AnnotationTool,
    ToolGroupManager,
    Enums as ToolEnums,
    annotation
} from '@cornerstonejs/tools';
import { eventTarget } from '@cornerstonejs/core';
import { Types } from '@cornerstonejs/core';

export interface AnnotationData {
    annotationUID: string;
    toolName: string;
    text?: string;
    position?: Types.Point2;
    handles?: {
        start?: Types.Point2;
        end?: Types.Point2;
        textBox?: Types.Point2;
        points?: Types.Point2[];
    };
    style?: {
        color?: string;
        lineWidth?: number;
        font?: string;
        textBackgroundColor?: string;
        textColor?: string;
        fillColor?: string;
        fillOpacity?: number;
        opacity?: number;
    };
    imageId: string;
    viewportId: string;
    timestamp: string;
    metadata?: {
        patientId?: string;
        studyId?: string;
        seriesId?: string;
        instanceId?: string;
    };
}

export interface AnnotationManagerConfig {
    enableTextAnnotations?: boolean;
    enableArrowAnnotations?: boolean;
    enableProbeAnnotations?: boolean;
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

export class AnnotationManager {
    private config: AnnotationManagerConfig;
    private eventListeners: Map<string, (event: any) => void> = new Map();
    private isInitialized: boolean = false;
    private autoSaveTimer: number | null = null;
    private toolGroupId: string;
    private annotations: Map<string, AnnotationData> = new Map();

    constructor(toolGroupId: string = 'annotation-manager', config: AnnotationManagerConfig = {}) {
        this.toolGroupId = toolGroupId;
        this.config = {
            enableTextAnnotations: true,
            enableArrowAnnotations: true,
            enableProbeAnnotations: true,
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
            this.setupEventListeners();
            this.setupAutoSave();
            this.isInitialized = true;
            
            console.log('✓ Annotation Manager initialized');
        } catch (error) {
            console.error('❌ Error initializing Annotation Manager:', error);
            throw error;
        }
    }

    private setupEventListeners(): void {
        // Listen for annotation added events
        const annotationAddedListener = (event: any) => {
            this.handleAnnotationAdded(event);
        };

        // Listen for annotation modified events
        const annotationModifiedListener = (event: any) => {
            this.handleAnnotationModified(event);
        };

        // Listen for annotation removed events
        const annotationRemovedListener = (event: any) => {
            this.handleAnnotationRemoved(event);
        };

        // Listen for annotation selected events
        const annotationSelectedListener = (event: any) => {
            this.handleAnnotationSelected(event);
        };

        // Store event listeners for cleanup
        this.eventListeners.set('ANNOTATION_ADDED', annotationAddedListener);
        this.eventListeners.set('ANNOTATION_MODIFIED', annotationModifiedListener);
        this.eventListeners.set('ANNOTATION_REMOVED', annotationRemovedListener);
        this.eventListeners.set('ANNOTATION_SELECTED', annotationSelectedListener);

        // Add event listeners
        eventTarget.addEventListener('ANNOTATION_ADDED', annotationAddedListener);
        eventTarget.addEventListener('ANNOTATION_MODIFIED', annotationModifiedListener);
        eventTarget.addEventListener('ANNOTATION_REMOVED', annotationRemovedListener);
        eventTarget.addEventListener('ANNOTATION_SELECTED', annotationSelectedListener);
    }

    private setupAutoSave(): void {
        if (this.config.autoSave && this.config.autoSaveInterval) {
            this.autoSaveTimer = window.setInterval(() => {
                this.saveAnnotations();
            }, this.config.autoSaveInterval);
        }
    }

    private handleAnnotationAdded(event: any): void {
        try {
            console.log('🔍 [ANNOTATION_DEBUG] AnnotationManager.handleAnnotationAdded called');
            console.log('🔍 [ANNOTATION_DEBUG] Event detail:', event.detail);
            
            const annotationData = this.extractAnnotationData(event.detail);
            console.log('🔍 [ANNOTATION_DEBUG] Extracted annotation data:', annotationData);
            
            if (annotationData) {
                // Check annotation limit
                if (this.config.maxAnnotations && this.annotations.size >= this.config.maxAnnotations) {
                    console.warn('⚠️ Maximum annotation limit reached');
                    return;
                }

                this.annotations.set(annotationData.annotationUID, annotationData);
                console.log('🔍 [ANNOTATION_DEBUG] Added to local map. Total annotations:', this.annotations.size);
                console.log('🔍 [ANNOTATION_DEBUG] All annotation UIDs:', Array.from(this.annotations.keys()));
                
                console.log('✓ Annotation added:', annotationData.annotationUID);
                
                // Trigger custom event
                this.triggerAnnotationEvent('annotationAdded', annotationData);
            } else {
                console.warn('🔍 [ANNOTATION_DEBUG] No annotation data extracted from event');
            }
        } catch (error) {
            console.error('❌ Error handling annotation added:', error);
        }
    }

    private handleAnnotationModified(event: any): void {
        try {
            const annotationData = this.extractAnnotationData(event.detail);
            if (annotationData && this.annotations.has(annotationData.annotationUID)) {
                // Update existing annotation
                annotationData.timestamp = new Date().toISOString();
                this.annotations.set(annotationData.annotationUID, annotationData);
                
                console.log('✓ Annotation modified:', annotationData.annotationUID);
                
                // Trigger custom event
                this.triggerAnnotationEvent('annotationModified', annotationData);
            }
        } catch (error) {
            console.error('❌ Error handling annotation modified:', error);
        }
    }

    private handleAnnotationRemoved(event: any): void {
        try {
            const annotationUID = event.detail.annotationUID;
            if (annotationUID && this.annotations.has(annotationUID)) {
                const annotationData = this.annotations.get(annotationUID);
                this.annotations.delete(annotationUID);
                
                console.log('✓ Annotation removed:', annotationUID);
                
                // Trigger custom event
                this.triggerAnnotationEvent('annotationRemoved', annotationData);
            }
        } catch (error) {
            console.error('❌ Error handling annotation removed:', error);
        }
    }

    private handleAnnotationSelected(event: any): void {
        try {
            const annotationUID = event.detail.annotationUID;
            if (annotationUID && this.annotations.has(annotationUID)) {
                const annotationData = this.annotations.get(annotationUID);
                
                console.log('✓ Annotation selected:', annotationUID);
                
                // Trigger custom event
                this.triggerAnnotationEvent('annotationSelected', annotationData);
            }
        } catch (error) {
            console.error('❌ Error handling annotation selected:', error);
        }
    }

    private extractAnnotationData(eventDetail: any): AnnotationData | null {
        try {
            const annotationObj = eventDetail.annotation || eventDetail;
            if (!annotationObj) return null;

            const annotationData: AnnotationData = {
                annotationUID: annotationObj.annotationUID || `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                toolName: eventDetail.toolName || annotationObj.toolName || 'Unknown',
                imageId: eventDetail.imageId || annotationObj.imageId || '',
                viewportId: eventDetail.viewportId || annotationObj.viewportId || '',
                timestamp: new Date().toISOString(),
                metadata: eventDetail.metadata || {}
            };

            // Extract text if available
            if (annotationObj.text) {
                annotationData.text = annotationObj.text;
            }

            // Extract position if available
            if (annotationObj.position) {
                annotationData.position = annotationObj.position;
            }

            // Extract handles if available
            if (annotationObj.data && annotationObj.data.handles) {
                annotationData.handles = {
                    start: annotationObj.data.handles.start,
                    end: annotationObj.data.handles.end,
                    textBox: annotationObj.data.handles.textBox,
                    points: annotationObj.data.handles.points
                };
            }

            // Extract style if available
            if (annotationObj.style) {
                annotationData.style = {
                    color: annotationObj.style.color,
                    lineWidth: annotationObj.style.lineWidth,
                    font: annotationObj.style.font,
                    textBackgroundColor: annotationObj.style.textBackgroundColor,
                    textColor: annotationObj.style.textColor,
                    fillColor: annotationObj.style.fillColor,
                    fillOpacity: annotationObj.style.fillOpacity
                };
            } else {
                // Apply default style
                annotationData.style = { ...this.config.defaultStyle };
            }

            return annotationData;

        } catch (error) {
            console.error('❌ Error extracting annotation data:', error);
            return null;
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

    public addAnnotation(annotationData: Partial<AnnotationData>): string {
        try {
            console.log('🔍 [ANNOTATION_DEBUG] AnnotationManager.addAnnotation called with data:', annotationData);
            
            // Generate annotation UID if not provided
            const annotationUID = annotationData.annotationUID || `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            console.log('🔍 [ANNOTATION_DEBUG] Generated/using annotation UID:', annotationUID);
            
            // Check annotation limit
            if (this.config.maxAnnotations && this.annotations.size >= this.config.maxAnnotations) {
                console.error('🔍 [ANNOTATION_DEBUG] Maximum annotation limit reached');
                throw new Error('Maximum annotation limit reached');
            }

            const fullAnnotationData: AnnotationData = {
                annotationUID,
                toolName: annotationData.toolName || 'Manual',
                text: annotationData.text || '',
                position: annotationData.position,
                handles: annotationData.handles,
                style: { ...this.config.defaultStyle, ...annotationData.style },
                imageId: annotationData.imageId || '',
                viewportId: annotationData.viewportId || '',
                timestamp: new Date().toISOString(),
                metadata: annotationData.metadata || {}
            };
            console.log('🔍 [ANNOTATION_DEBUG] Full annotation data created:', fullAnnotationData);

            // Store in local map for compatibility
            this.annotations.set(annotationUID, fullAnnotationData);
            console.log('🔍 [ANNOTATION_DEBUG] Stored in local map. New size:', this.annotations.size);
            
            // Try to add to official annotation state as well
            try {
                console.log('🔍 [ANNOTATION_DEBUG] Attempting to add to official Cornerstone3D state...');
                
                // Try to create annotation object in Cornerstone3D format if compatible
                if (fullAnnotationData.viewportId) {
                    const element = document.getElementById(fullAnnotationData.viewportId);
                    console.log('🔍 [ANNOTATION_DEBUG] Found viewport element:', element);
                    
                    if (element && fullAnnotationData.handles) {
                        try {
                            // Convert Point2 to Point3 for compatibility
                            const convertedHandles = this.convertHandlesToPoint3(fullAnnotationData.handles);
                            console.log('🔍 [ANNOTATION_DEBUG] Converted handles:', convertedHandles);
                            
                            const cornerstone3DAnnotation = {
                                annotationUID,
                                metadata: {
                                    toolName: fullAnnotationData.toolName,
                                    imageId: fullAnnotationData.imageId,
                                    viewportId: fullAnnotationData.viewportId,
                                    timestamp: fullAnnotationData.timestamp
                                },
                                data: {
                                    handles: convertedHandles,
                                    text: fullAnnotationData.text
                                }
                            };
                            console.log('🔍 [ANNOTATION_DEBUG] Cornerstone3D annotation object:', cornerstone3DAnnotation);
                            
                            // Use proper type casting for element
                            annotation.state.addAnnotation(cornerstone3DAnnotation, element as HTMLDivElement);
                            console.log('🔍 [ANNOTATION_DEBUG] Successfully added to official annotation state');
                        } catch (conversionError) {
                            console.warn('🔍 [ANNOTATION_DEBUG] Could not convert annotation to Cornerstone3D format:', conversionError);
                        }
                    } else {
                        console.warn('🔍 [ANNOTATION_DEBUG] Missing element or handles for official state');
                    }
                } else {
                    console.warn('🔍 [ANNOTATION_DEBUG] No viewportId provided for official state');
                }
            } catch (officialError) {
                console.warn('🔍 [ANNOTATION_DEBUG] Could not add to official annotation state:', officialError);
            }
            
            console.log('✓ Annotation added manually:', annotationUID);
            
            // Trigger custom event
            this.triggerAnnotationEvent('annotationAdded', fullAnnotationData);
            
            return annotationUID;

        } catch (error) {
            console.error('❌ Error adding annotation:', error);
            throw error;
        }
    }

    public updateAnnotation(annotationUID: string, updates: Partial<AnnotationData>): boolean {
        try {
            if (!this.annotations.has(annotationUID)) {
                console.warn(`Annotation ${annotationUID} not found`);
                return false;
            }

            const existingAnnotation = this.annotations.get(annotationUID)!;
            const updatedAnnotation: AnnotationData = {
                ...existingAnnotation,
                ...updates,
                annotationUID, // Ensure UID doesn't change
                timestamp: new Date().toISOString()
            };

            this.annotations.set(annotationUID, updatedAnnotation);
            
            console.log('✓ Annotation updated:', annotationUID);
            
            // Trigger custom event
            this.triggerAnnotationEvent('annotationModified', updatedAnnotation);
            
            return true;

        } catch (error) {
            console.error('❌ Error updating annotation:', error);
            return false;
        }
    }

    public removeAnnotation(annotationUID: string): boolean {
        try {
            if (!this.annotations.has(annotationUID)) {
                console.warn(`Annotation ${annotationUID} not found`);
                return false;
            }

            const annotationData = this.annotations.get(annotationUID);
            this.annotations.delete(annotationUID);
            
            console.log('✓ Annotation removed manually:', annotationUID);
            
            // Trigger custom event
            this.triggerAnnotationEvent('annotationRemoved', annotationData);
            
            return true;

        } catch (error) {
            console.error('❌ Error removing annotation:', error);
            return false;
        }
    }

    public getAnnotation(annotationUID: string): AnnotationData | null {
        return this.annotations.get(annotationUID) || null;
    }

    public getAnnotations(): AnnotationData[] {
        console.log('🔍 [ANNOTATION_DEBUG] AnnotationManager.getAnnotations called');
        
        // Use official Cornerstone3D annotation state API
        try {
            // Get all annotations using the official API
            const allAnnotations = annotation.state.getAllAnnotations();
            console.log('🔍 [ANNOTATION_DEBUG] Official annotations from Cornerstone3D:', allAnnotations);
            
            // Convert to our format while maintaining compatibility
            const converted = this.convertOfficialAnnotations(allAnnotations);
            console.log('🔍 [ANNOTATION_DEBUG] Converted annotations:', converted);
            console.log('🔍 [ANNOTATION_DEBUG] Local annotations map size:', this.annotations.size);
            console.log('🔍 [ANNOTATION_DEBUG] Local annotations:', Array.from(this.annotations.values()));
            
            return converted;
        } catch (error) {
            console.warn('🔍 [ANNOTATION_DEBUG] Failed to get official annotations, using local storage:', error);
            const localAnnotations = Array.from(this.annotations.values());
            console.log('🔍 [ANNOTATION_DEBUG] Returning local annotations:', localAnnotations);
            return localAnnotations;
        }
    }

    private convertOfficialAnnotations(officialAnnotations: any): AnnotationData[] {
        const converted: AnnotationData[] = [];
        
        Object.values(officialAnnotations).forEach((frameAnnotations: any) => {
            Object.values(frameAnnotations).forEach((toolAnnotations: any) => {
                if (Array.isArray(toolAnnotations)) {
                    toolAnnotations.forEach((ann: any) => {
                        const convertedAnnotation: AnnotationData = {
                            annotationUID: ann.annotationUID || `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            toolName: ann.metadata?.toolName || 'Unknown',
                            imageId: ann.metadata?.imageId || '',
                            viewportId: ann.metadata?.viewportId || '',
                            timestamp: ann.metadata?.timestamp || new Date().toISOString(),
                            metadata: ann.metadata || {},
                            handles: ann.data?.handles,
                            style: this.config.defaultStyle
                        };
                        converted.push(convertedAnnotation);
                    });
                }
            });
        });
        
        return converted;
    }

    private convertHandlesToPoint3(handles: any): any {
        if (!handles) return handles;
        
        const convertPoint2ToPoint3 = (point: any) => {
            if (Array.isArray(point) && point.length === 2) {
                return [point[0], point[1], 0]; // Add z-coordinate of 0
            }
            return point;
        };

        const convertedHandles: any = {};
        
        if (handles.start) {
            convertedHandles.start = convertPoint2ToPoint3(handles.start);
        }
        if (handles.end) {
            convertedHandles.end = convertPoint2ToPoint3(handles.end);
        }
        if (handles.textBox) {
            convertedHandles.textBox = convertPoint2ToPoint3(handles.textBox);
        }
        if (handles.points) {
            convertedHandles.points = handles.points.map(convertPoint2ToPoint3);
        }
        
        return convertedHandles;
    }

    public getAnnotationsByType(toolName: string): AnnotationData[] {
        return this.getAnnotations().filter(annotation => annotation.toolName === toolName);
    }

    public getAnnotationsByViewport(viewportId: string): AnnotationData[] {
        return this.getAnnotations().filter(annotation => annotation.viewportId === viewportId);
    }

    public getAnnotationsByImage(imageId: string): AnnotationData[] {
        return this.getAnnotations().filter(annotation => annotation.imageId === imageId);
    }

    public clearAnnotations(): void {
        const annotationCount = this.annotations.size;
        this.annotations.clear();
        
        console.log(`✓ Cleared ${annotationCount} annotations`);
        
        // Trigger custom event
        this.triggerAnnotationEvent('annotationsCleared', { count: annotationCount });
    }

    public clearAnnotationsByType(toolName: string): void {
        const annotationsToRemove = this.getAnnotationsByType(toolName);
        annotationsToRemove.forEach(annotation => {
            this.annotations.delete(annotation.annotationUID);
        });
        
        console.log(`✓ Cleared ${annotationsToRemove.length} ${toolName} annotations`);
    }

    public clearAnnotationsByViewport(viewportId: string): void {
        const annotationsToRemove = this.getAnnotationsByViewport(viewportId);
        annotationsToRemove.forEach(annotation => {
            this.annotations.delete(annotation.annotationUID);
        });
        
        console.log(`✓ Cleared ${annotationsToRemove.length} annotations for viewport: ${viewportId}`);
    }

    public clearAnnotationsByImage(imageId: string): void {
        const annotationsToRemove = this.getAnnotationsByImage(imageId);
        annotationsToRemove.forEach(annotation => {
            this.annotations.delete(annotation.annotationUID);
        });
        
        console.log(`✓ Cleared ${annotationsToRemove.length} annotations for image: ${imageId}`);
    }

    public getAnnotationCount(): number {
        return this.annotations.size;
    }

    public getAnnotationCountByType(toolName: string): number {
        return this.getAnnotationsByType(toolName).length;
    }

    public getAnnotationCountByViewport(viewportId: string): number {
        return this.getAnnotationsByViewport(viewportId).length;
    }

    public getAnnotationCountByImage(imageId: string): number {
        return this.getAnnotationsByImage(imageId).length;
    }

    public saveAnnotations(): string {
        try {
            const annotationsData = {
                annotations: this.getAnnotations(),
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            };

            const data = JSON.stringify(annotationsData, null, 2);
            localStorage.setItem('cornerstone3d-annotations', data);
            
            console.log(`✓ Saved ${this.annotations.size} annotations`);
            
            return data;

        } catch (error) {
            console.error('❌ Error saving annotations:', error);
            throw error;
        }
    }

    public loadAnnotations(): AnnotationData[] {
        try {
            const data = localStorage.getItem('cornerstone3d-annotations');
            if (!data) {
                console.log('No saved annotations found');
                return [];
            }

            const parsedData = JSON.parse(data);
            const annotations = parsedData.annotations || [];
            
            // Validate and load annotations
            let loadedCount = 0;
            annotations.forEach((annotation: any) => {
                if (this.validateAnnotationData(annotation)) {
                    this.annotations.set(annotation.annotationUID, annotation);
                    loadedCount++;
                }
            });

            console.log(`✓ Loaded ${loadedCount} annotations`);
            
            return this.getAnnotations();

        } catch (error) {
            console.error('❌ Error loading annotations:', error);
            return [];
        }
    }

    public exportAnnotations(format: 'json' | 'csv' = 'json'): string {
        try {
            const annotations = this.getAnnotations();
            
            if (format === 'json') {
                return JSON.stringify({
                    annotations,
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                }, null, 2);
            } else if (format === 'csv') {
                return this.convertAnnotationsToCSV(annotations);
            }
            
            throw new Error(`Unsupported export format: ${format}`);

        } catch (error) {
            console.error('❌ Error exporting annotations:', error);
            throw error;
        }
    }

    public importAnnotations(data: string, format: 'json' | 'csv' = 'json'): number {
        try {
            let annotations: AnnotationData[] = [];
            
            if (format === 'json') {
                const parsedData = JSON.parse(data);
                annotations = parsedData.annotations || parsedData;
            } else if (format === 'csv') {
                annotations = this.parseAnnotationsFromCSV(data);
            } else {
                throw new Error(`Unsupported import format: ${format}`);
            }

            // Validate and import annotations
            let importedCount = 0;
            annotations.forEach(annotation => {
                if (this.validateAnnotationData(annotation)) {
                    this.annotations.set(annotation.annotationUID, annotation);
                    importedCount++;
                }
            });

            console.log(`✓ Imported ${importedCount} annotations`);
            
            return importedCount;

        } catch (error) {
            console.error('❌ Error importing annotations:', error);
            throw error;
        }
    }

    private validateAnnotationData(data: any): boolean {
        return (
            data &&
            typeof data.annotationUID === 'string' &&
            typeof data.toolName === 'string' &&
            typeof data.timestamp === 'string' &&
            typeof data.imageId === 'string' &&
            typeof data.viewportId === 'string'
        );
    }

    private convertAnnotationsToCSV(annotations: AnnotationData[]): string {
        if (annotations.length === 0) return '';

        const headers = ['UID', 'Tool', 'Text', 'X', 'Y', 'ImageID', 'ViewportID', 'Timestamp'];
        const rows = annotations.map(annotation => {
            const x = annotation.position?.[0] || annotation.handles?.start?.[0] || '';
            const y = annotation.position?.[1] || annotation.handles?.start?.[1] || '';
            
            return [
                annotation.annotationUID,
                annotation.toolName,
                annotation.text || '',
                x,
                y,
                annotation.imageId,
                annotation.viewportId,
                annotation.timestamp
            ];
        });

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    private parseAnnotationsFromCSV(csvData: string): AnnotationData[] {
        // Simple CSV parsing - in production, use a proper CSV parser
        const lines = csvData.trim().split('\n');
        const annotations: AnnotationData[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            if (values.length >= 8) {
                const annotation: AnnotationData = {
                    annotationUID: values[0],
                    toolName: values[1],
                    text: values[2],
                    position: values[3] && values[4] ? [parseFloat(values[3]), parseFloat(values[4])] : undefined,
                    imageId: values[5],
                    viewportId: values[6],
                    timestamp: values[7],
                    style: { ...this.config.defaultStyle }
                };
                annotations.push(annotation);
            }
        }

        return annotations;
    }

    public getConfig(): AnnotationManagerConfig {
        return { ...this.config };
    }

    public updateConfig(newConfig: Partial<AnnotationManagerConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        // Restart auto-save if configuration changed
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
        
        this.setupAutoSave();
        
        console.log('✓ Annotation Manager configuration updated');
    }

    public getToolGroupId(): string {
        return this.toolGroupId;
    }

    public getInitializationStatus(): boolean {
        return this.isInitialized;
    }

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

            // Clear annotations
            this.annotations.clear();

            this.isInitialized = false;
            
            console.log('✓ Annotation Manager disposed');

        } catch (error) {
            console.error('❌ Error disposing Annotation Manager:', error);
        }
    }
}

// Convenience functions
export function createAnnotationManager(toolGroupId?: string, config?: AnnotationManagerConfig): AnnotationManager {
    return new AnnotationManager(toolGroupId, config);
}

export function getDefaultAnnotationConfig(): AnnotationManagerConfig {
    return {
        enableTextAnnotations: true,
        enableArrowAnnotations: true,
        enableProbeAnnotations: true,
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