/**
 * Viewport Setup Hook
 * Handles Cornerstone3D viewport initialization and rendering
 */

import { useCallback, useRef } from 'react';
import * as cornerstoneCore from '@cornerstonejs/core';
import { log } from '../../../utils/logger';
import { registerRenderingEngine, unregisterRenderingEngine } from '../../../utils/viewportSynchronizer';
import { mouseEventLogger } from '../../../utils/mouseEventLogger';
import { webglContextManager } from '../../../services/WebGLContextManager';
import { isCornerstoneInitialized } from '../../../services/cornerstoneInit';

const { RenderingEngine, Enums: csEnums } = cornerstoneCore;

export const useViewportSetup = (renderingEngineId: string, viewportId: string) => {
  const renderingEngineRef = useRef<any>(null);

  const setupViewport = useCallback(
    async (element: HTMLDivElement, imageIds: string[], currentImageIndex: number = 0) => {
      try {
        // Check if Cornerstone is initialized
        if (!isCornerstoneInitialized()) {
          throw new Error('Cornerstone3D is not initialized yet');
        }

        // Clean up previous rendering engine
        if (renderingEngineRef.current) {
          renderingEngineRef.current.destroy();
          webglContextManager.releaseContext(renderingEngineId);
        }

        // Acquire WebGL context
        const canvas = element.querySelector('canvas') || document.createElement('canvas');
        const context = webglContextManager.acquireContext(canvas, renderingEngineId, viewportId);
        
        if (!context) {
          throw new Error('Failed to acquire WebGL context');
        }

        // Create rendering engine
        const renderingEngine = new RenderingEngine(renderingEngineId);
        renderingEngineRef.current = renderingEngine;

        // Register for synchronization
        registerRenderingEngine(renderingEngineId, renderingEngine);

        // Create viewport using v3 preferred API
        const viewportInput = [{
          viewportId,
          type: csEnums.ViewportType.STACK,
          element,
          defaultOptions: {
            background: [0, 0, 0] as [number, number, number],
          },
        }];

        renderingEngine.setViewports(viewportInput);

        // Get the stack viewport
        const viewport = (renderingEngine as any).getViewport(viewportId);

        // Set the stack of images
        await viewport.setStack(imageIds, currentImageIndex);

        // Render the image first
        console.info('🎨🎨🎨 VIEWPORT SETUP: Initial rendering', { viewportId, renderingEngineId });
        renderingEngine.render();
        console.info('✅✅✅ VIEWPORT SETUP: Initial render completed');

        // Attach mouse event logger
        mouseEventLogger.attachToViewport(element, viewportId);

        // Wait for viewport to be ready
        await viewport.getImageData();
        console.info('✅✅✅ VIEWPORT SETUP: Image data loaded', { viewportId });

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
        log.error(
          'Failed to setup viewport',
          {
            component: 'useViewportSetup',
            metadata: { renderingEngineId, viewportId },
          },
          error as Error,
        );
        throw error;
      }
    },
    [renderingEngineId, viewportId],
  );

  const destroyViewport = useCallback(() => {
    if (renderingEngineRef.current) {
      // Unregister before destroying
      unregisterRenderingEngine(renderingEngineId);
      renderingEngineRef.current.destroy();
      renderingEngineRef.current = null;
      
      // Release WebGL context
      webglContextManager.releaseContext(renderingEngineId);
    }
  }, [renderingEngineId]);

  const getRenderingEngine = useCallback(() => {
    return renderingEngineRef.current;
  }, []);

  return {
    setupViewport,
    destroyViewport,
    getRenderingEngine,
  };
};
