import { useEffect } from 'react';
import type { RenderingEngine } from '@cornerstonejs/core';
import type { LayoutType } from '../types';
import type { ModernAnnotationManager } from '../utils/annotation-manager';

interface ViewportContainerProps {
  renderingEngine: RenderingEngine | null;
  layoutType: LayoutType;
  annotationManager: ModernAnnotationManager;
}

export function ViewportContainer({ 
  renderingEngine, 
  layoutType,
  annotationManager 
}: ViewportContainerProps) {
  
  useEffect(() => {
    if (!renderingEngine) return;

    // Setup annotation event listeners
    const handleAnnotationAdded = (event: any) => {
      console.log('Annotation added:', event.detail);
    };

    const handleAnnotationModified = (event: any) => {
      console.log('Annotation modified:', event.detail);
    };

    // Add event listeners
    document.addEventListener('cornerstone-annotation-added', handleAnnotationAdded);
    document.addEventListener('cornerstone-annotation-modified', handleAnnotationModified);

    return () => {
      document.removeEventListener('cornerstone-annotation-added', handleAnnotationAdded);
      document.removeEventListener('cornerstone-annotation-modified', handleAnnotationModified);
    };
  }, [renderingEngine, annotationManager]);

  return (
    <div className="viewport-container-inner">
      {/* Viewport elements will be created dynamically by the useCornerstone hook */}
      <div className="viewport-info">
        <span className="layout-indicator">Layout: {layoutType}</span>
        {renderingEngine && (
          <span className="engine-indicator">
            Engine: {renderingEngine.id}
          </span>
        )}
      </div>
    </div>
  );
}