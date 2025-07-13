import { annotation } from '@cornerstonejs/tools';
import { v4 as uuidv4 } from 'uuid';
import type { AnnotationData, RequiredAnnotationData } from '../types';

/**
 * Modern Annotation Manager using Cornerstone3D v3 APIs
 * Fixes all TypeScript annotation-related errors
 */
export class ModernAnnotationManager {
  private static instance: ModernAnnotationManager;

  public static getInstance(): ModernAnnotationManager {
    if (!ModernAnnotationManager.instance) {
      ModernAnnotationManager.instance = new ModernAnnotationManager();
    }
    return ModernAnnotationManager.instance;
  }

  /**
   * Get all annotations with proper typing - Fix for TS7053
   */
  public getAllAnnotations(): AnnotationData[] {
    try {
      const annotationState = annotation.state.getAllAnnotations();
      return this.flattenAnnotationState(annotationState);
    } catch (error) {
      console.error('Error getting all annotations:', error);
      return [];
    }
  }

  /**
   * Get annotations by tool name with type safety
   */
  public getAnnotationsByTool(toolName: string): AnnotationData[] {
    const allAnnotations = this.getAllAnnotations();
    return allAnnotations.filter(ann => {
      // Safe property access - Fix for TS7053
      const annotationToolName = this.getAnnotationProperty(ann, 'toolName') || 
                                 this.getAnnotationProperty(ann.metadata, 'toolName');
      return annotationToolName === toolName;
    });
  }

  /**
   * Add annotation with proper typing - Fix for TS2345 missing annotationUID
   */
  public addAnnotation(
    annotationData: Omit<RequiredAnnotationData, 'annotationUID'> & { annotationUID?: string },
    element: HTMLDivElement
  ): string {
    // Ensure annotationUID is always present - Fix for missing annotationUID
    const completeAnnotation: AnnotationData = {
      ...annotationData,
      annotationUID: annotationData.annotationUID || uuidv4(),
      metadata: {
        ...annotationData.metadata,
        toolName: annotationData.toolName
      }
    };

    try {
      annotation.state.addAnnotation(completeAnnotation, element);
      console.log(`✓ Annotation added: ${completeAnnotation.annotationUID}`);
      return completeAnnotation.annotationUID;
    } catch (error) {
      console.error('Error adding annotation:', error);
      throw error;
    }
  }

  /**
   * Remove annotation with string type validation - Fix for TS2345 boolean to string
   */
  public removeAnnotation(annotationUID: string): boolean {
    // Type validation - Fix for TS2345
    if (typeof annotationUID !== 'string' || !annotationUID) {
      console.error('Invalid annotationUID: must be a non-empty string');
      return false;
    }

    try {
      annotation.state.removeAnnotation(annotationUID);
      console.log(`✓ Annotation removed: ${annotationUID}`);
      return true;
    } catch (error) {
      console.error(`Error removing annotation ${annotationUID}:`, error);
      return false;
    }
  }

  /**
   * Update annotation with proper typing - Fix for Partial<AnnotationData> issues
   */
  public updateAnnotation(
    annotationUID: string, 
    updates: Partial<AnnotationData>
  ): boolean {
    // Type validation - Fix for TS2345
    if (typeof annotationUID !== 'string' || !annotationUID) {
      console.error('Invalid annotationUID: must be a non-empty string');
      return false;
    }

    try {
      const existingAnnotation = this.getAnnotationByUID(annotationUID);
      if (!existingAnnotation) {
        console.error(`Annotation ${annotationUID} not found`);
        return false;
      }

      // Create updated annotation with proper typing
      const updatedAnnotation: AnnotationData = {
        ...existingAnnotation,
        ...updates,
        annotationUID, // Ensure UID remains string type
      };

      // Remove old and add updated
      annotation.state.removeAnnotation(annotationUID);
      
      // Find appropriate element for re-adding
      const element = this.findElementForAnnotation(updatedAnnotation);
      if (element) {
        annotation.state.addAnnotation(updatedAnnotation, element);
        console.log(`✓ Annotation updated: ${annotationUID}`);
        return true;
      } else {
        console.error('No suitable element found for updated annotation');
        return false;
      }
    } catch (error) {
      console.error(`Error updating annotation ${annotationUID}:`, error);
      return false;
    }
  }

  /**
   * Get single annotation by UID with proper typing
   */
  public getAnnotationByUID(annotationUID: string): AnnotationData | null {
    if (typeof annotationUID !== 'string' || !annotationUID) {
      return null;
    }

    const allAnnotations = this.getAllAnnotations();
    return allAnnotations.find(ann => ann.annotationUID === annotationUID) || null;
  }

  /**
   * Clear all annotations with confirmation
   */
  public clearAllAnnotations(): void {
    try {
      annotation.state.removeAllAnnotations();
      console.log('✓ All annotations cleared');
    } catch (error) {
      console.error('Error clearing annotations:', error);
    }
  }

  /**
   * Safe property access to fix TS7053 index signature errors
   */
  private getAnnotationProperty(obj: any, property: string): any {
    if (!obj || typeof obj !== 'object') {
      return undefined;
    }
    
    // Use proper property access instead of bracket notation when possible
    if (property === 'toolName' && 'toolName' in obj) {
      return obj.toolName;
    }
    if (property === 'annotationUID' && 'annotationUID' in obj) {
      return obj.annotationUID;
    }
    
    // Safe bracket notation for dynamic properties
    return Object.prototype.hasOwnProperty.call(obj, property) ? obj[property] : undefined;
  }

  /**
   * Flatten annotation state structure safely
   */
  private flattenAnnotationState(annotationState: any): AnnotationData[] {
    const flattened: AnnotationData[] = [];
    
    if (!annotationState || typeof annotationState !== 'object') {
      return flattened;
    }

    try {
      // Handle different annotation state structures
      Object.keys(annotationState).forEach(frameKey => {
        const frameData = annotationState[frameKey];
        if (frameData && typeof frameData === 'object') {
          Object.keys(frameData).forEach(toolName => {
            const toolAnnotations = frameData[toolName];
            if (Array.isArray(toolAnnotations)) {
              toolAnnotations.forEach(ann => {
                if (ann && typeof ann === 'object' && ann.annotationUID) {
                  flattened.push(ann as AnnotationData);
                }
              });
            }
          });
        }
      });
    } catch (error) {
      console.error('Error flattening annotation state:', error);
    }

    return flattened;
  }

  /**
   * Find appropriate element for annotation
   */
  private findElementForAnnotation(annotation: AnnotationData): HTMLDivElement | null {
    // Try to find by viewport ID from metadata
    const viewportId = this.getAnnotationProperty(annotation.metadata, 'viewportId');
    if (viewportId) {
      const element = document.getElementById(viewportId);
      if (element instanceof HTMLDivElement) {
        return element;
      }
    }

    // Fallback: find first available viewport element
    const viewportElements = document.querySelectorAll('[data-viewport-uid], .viewport-element');
    for (const element of viewportElements) {
      if (element instanceof HTMLDivElement) {
        return element;
      }
    }

    return null;
  }

  /**
   * Create annotation with all required fields - prevents TS2741 errors
   */
  public createAnnotation(params: {
    toolName: string;
    data: AnnotationData['data'];
    metadata: Partial<AnnotationData['metadata']>;
    annotationUID?: string;
  }): RequiredAnnotationData {
    return {
      annotationUID: params.annotationUID || uuidv4(),
      toolName: params.toolName,
      data: params.data,
      metadata: {
        toolName: params.toolName,
        FrameOfReferenceUID: 'default',
        ...params.metadata
      }
    };
  }

  /**
   * Validate annotation data structure
   */
  public validateAnnotation(annotation: any): annotation is AnnotationData {
    return (
      annotation &&
      typeof annotation === 'object' &&
      typeof annotation.annotationUID === 'string' &&
      typeof annotation.toolName === 'string' &&
      annotation.data &&
      annotation.metadata &&
      typeof annotation.metadata === 'object'
    );
  }
}