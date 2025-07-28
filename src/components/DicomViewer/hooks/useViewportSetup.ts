/**
 * Viewport Setup Hook
 * Handles Cornerstone3D viewport initialization and rendering
 */

import { useCallback, useRef } from 'react';
import * as cornerstoneCore from '@cornerstonejs/core';
import { log } from '../../../utils/logger';

const {
  RenderingEngine,
  Enums: csEnums,
} = cornerstoneCore;

export const useViewportSetup = (renderingEngineId: string, viewportId: string) => {
  const renderingEngineRef = useRef<any>(null);

  const setupViewport = useCallback(async (
    element: HTMLDivElement,
    imageIds: string[],
    currentImageIndex: number = 0,
  ) => {
    try {
      // Clean up previous rendering engine
      if (renderingEngineRef.current) {
        renderingEngineRef.current.destroy();
      }

      // Create rendering engine
      const renderingEngine = new RenderingEngine(renderingEngineId);
      renderingEngineRef.current = renderingEngine;

      // Create viewport
      const viewportInput = {
        viewportId,
        type: csEnums.ViewportType.STACK,
        element,
        defaultOptions: {
          background: [0, 0, 0],
        },
      };

      (renderingEngine as any).enableElement(viewportInput);

      // Get the stack viewport
      const viewport = (renderingEngine as any).getViewport(viewportId);

      // Set the stack of images
      await viewport.setStack(imageIds, currentImageIndex);

      // Render the image first
      renderingEngine.render();

      // Wait for viewport to be ready
      await viewport.getImageData();

      log.info('Viewport setup completed', {
        component: 'useViewportSetup',
        metadata: {
          renderingEngineId,
          viewportId,
          imageCount: imageIds.length,
          currentIndex: currentImageIndex,
        },
      });

      return { renderingEngine, viewport };

    } catch (error) {
      log.error('Failed to setup viewport', {
        component: 'useViewportSetup',
        metadata: { renderingEngineId, viewportId },
      }, error as Error);
      throw error;
    }
  }, [renderingEngineId, viewportId]);

  const destroyViewport = useCallback(() => {
    if (renderingEngineRef.current) {
      renderingEngineRef.current.destroy();
      renderingEngineRef.current = null;
    }
  }, []);

  const getRenderingEngine = useCallback(() => {
    return renderingEngineRef.current;
  }, []);

  return {
    setupViewport,
    destroyViewport,
    getRenderingEngine,
  };
};
