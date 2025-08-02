/**
 * Cornerstone3D v1 vs v3 Annotation Compatibility Layer
 * Handles API differences between versions
 */

export interface AnnotationCompat {
  // v1 properties
  annotationUID?: string;

  // v3 possible properties
  uid?: string;
  id?: string;
  annotationId?: string;

  // Common properties
  metadata?: {
    toolName: string;
    viewPlaneNormal: number[];
    FrameOfReferenceUID: string;
    referencedImageId?: string;
    viewUp?: number[];
  };

  data?: {
    handles: {
      points: number[][];
    };
    cachedStats?: any;
  };

  // Additional v3 properties
  highlighted?: boolean;
  selected?: boolean;
  invalidated?: boolean;
}

/**
 * Compatibility layer for handling annotation property differences
 * between Cornerstone3D v1 and v3
 */
export class AnnotationCompatLayer {
  /**
   * Get annotation UID with fallback for different property names
   */
  static getAnnotationId(annotation: any): string | null {
    if (!annotation) {
      console.warn('🚨 AnnotationCompatLayer: annotation is null/undefined');
      return null;
    }

    // If annotation is already a string (UID), return it directly
    if (typeof annotation === 'string') {
      console.info('🔍 AnnotationCompatLayer: Annotation is UID string:', annotation);
      return annotation;
    }

    // Try all possible UID property names for object annotations
    const uid = annotation.annotationUID ||
                annotation.uid ||
                annotation.id ||
                annotation.annotationId;

    if (!uid) {
      console.warn('🚨 AnnotationCompatLayer: No valid UID found in annotation', {
        availableKeys: Object.keys(annotation),
        annotation,
      });
    }

    return uid || null;
  }

  /**
   * Normalize annotation object to consistent format
   */
  static normalizeAnnotation(annotation: any): AnnotationCompat | null {
    if (!annotation) {
      return null;
    }

    const uid = this.getAnnotationId(annotation);
    if (!uid) {
      return null;
    }

    return {
      // Ensure we have a consistent UID property
      annotationUID: uid,
      uid,
      id: uid,
      annotationId: uid,

      // Copy metadata if available
      metadata: annotation.metadata ? {
        toolName: annotation.metadata.toolName,
        viewPlaneNormal: annotation.metadata.viewPlaneNormal,
        FrameOfReferenceUID: annotation.metadata.FrameOfReferenceUID,
        referencedImageId: annotation.metadata.referencedImageId,
        viewUp: annotation.metadata.viewUp,
      } : undefined,

      // Copy data if available
      data: annotation.data ? {
        handles: annotation.data.handles,
        cachedStats: annotation.data.cachedStats,
      } : undefined,

      // Copy state properties
      highlighted: annotation.highlighted,
      selected: annotation.selected,
      invalidated: annotation.invalidated,
    };
  }

  /**
   * Safe annotation selection with fallback UID handling
   */
  static async selectAnnotation(annotation: any, selected: boolean = true, preserveSelected: boolean = false): Promise<boolean> {
    const uid = this.getAnnotationId(annotation);
    if (!uid) {
      console.warn('🚨 AnnotationCompatLayer: Cannot select annotation without valid UID');
      return false;
    }

    try {
      // Import ES module dynamically
      const cornerstoneTools = await import('@cornerstonejs/tools');
      cornerstoneTools.annotation.selection.setAnnotationSelected(uid, selected, preserveSelected);
      console.info('✅ AnnotationCompatLayer: Annotation selection successful', { uid, selected });
      return true;
    } catch (error) {
      console.error('🚨 AnnotationCompatLayer: Annotation selection failed', { uid, error });
      return false;
    }
  }

  /**
   * Safe annotation deletion with fallback UID handling
   */
  static async deleteAnnotation(annotation: any): Promise<boolean> {
    const uid = this.getAnnotationId(annotation);
    if (!uid) {
      console.warn('🚨 AnnotationCompatLayer: Cannot delete annotation without valid UID');
      return false;
    }

    try {
      // Import ES module dynamically
      const cornerstoneTools = await import('@cornerstonejs/tools');
      cornerstoneTools.annotation.state.removeAnnotation(uid);
      console.info('✅ AnnotationCompatLayer: Annotation deletion successful', { uid });
      return true;
    } catch (error) {
      console.error('🚨 AnnotationCompatLayer: Annotation deletion failed', { uid, error });
      return false;
    }
  }

  /**
   * Get all selected annotations with normalized structure
   */
  static async getSelectedAnnotations(): Promise<AnnotationCompat[]> {
    try {
      // Import ES module dynamically
      const cornerstoneTools = await import('@cornerstonejs/tools');
      const selectedUids = cornerstoneTools.annotation.selection.getAnnotationsSelected();

      if (!selectedUids || selectedUids.length === 0) {
        console.info('ℹ️ AnnotationCompatLayer: No annotations currently selected');
        return [];
      }

      console.info('🔍 AnnotationCompatLayer: Raw selected annotation UIDs:', selectedUids);

      // selectedUids is an array of UID strings, convert to AnnotationCompat objects
      const normalizedAnnotations: AnnotationCompat[] = selectedUids
        .filter((uid: any) => typeof uid === 'string' && uid.length > 0)
        .map((uid: string) => ({
          annotationUID: uid,
          uid: uid,
          id: uid,
          annotationId: uid,
        }));

      console.info('✅ AnnotationCompatLayer: Normalized selected annotations:', normalizedAnnotations);
      return normalizedAnnotations;
    } catch (error) {
      console.error('🚨 AnnotationCompatLayer: Failed to get selected annotations', error);
      return [];
    }
  }

  /**
   * Analyze annotation structure for debugging
   */
  static analyzeAnnotationStructure(annotation: any): void {
    if (!annotation) {
      console.warn('🔍 AnnotationCompatLayer: Annotation is null/undefined');
      return;
    }

    console.group('🔍 AnnotationCompatLayer: Annotation Structure Analysis');
    console.info('📋 All properties:', Object.keys(annotation));
    console.info('🆔 UID candidates:', {
      annotationUID: annotation.annotationUID,
      uid: annotation.uid,
      id: annotation.id,
      annotationId: annotation.annotationId,
    });
    console.info('📝 Metadata:', annotation.metadata);
    console.info('📊 Data:', annotation.data);
    console.info('🎨 State:', {
      highlighted: annotation.highlighted,
      selected: annotation.selected,
      invalidated: annotation.invalidated,
    });
    console.info('🔢 Full object:', annotation);
    console.groupEnd();
  }
}

/**
 * V3 API Changes Documentation
 */
export const V3_API_CHANGES = {
  annotation: {
    properties: {
      uid: 'Primary identifier in v3 (was annotationUID in v1)',
      id: 'Alternative identifier in some v3 contexts',
      annotationId: 'Another possible identifier variant',
      selected: 'New state property in v3',
      highlighted: 'Existing property, may have behavior changes',
      invalidated: 'Existing property, may have behavior changes',
    },
    selection: {
      getAnnotationsSelected: 'API exists in v3, returns different structure',
      setAnnotationSelected: 'API exists in v3, parameters may differ',
    },
    state: {
      removeAnnotation: 'API exists in v3, requires correct UID property',
      getAnnotations: 'API exists in v3, may return different structure',
    },
  },
  breaking_changes: [
    'Annotation UID property name changed from annotationUID to uid/id',
    'Selected annotations array structure may be different',
    'Tool names in metadata may have changed',
    'Event handling may have changed',
  ],
};
