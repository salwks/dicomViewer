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
import { isCornerstone3DInitialized } from '../../../services/cornerstoneInit';

const { RenderingEngine, Enums: csEnums } = cornerstoneCore;

export const useViewportSetup = (renderingEngineId: string, viewportId: string) => {
  const renderingEngineRef = useRef<any>(null);

  const setupViewport = useCallback(
    async (element: HTMLDivElement, imageIds: string[], currentImageIndex: number = 0) => {
      try {
        // Check if Cornerstone is initialized
        if (!isCornerstone3DInitialized()) {
          throw new Error('Cornerstone3D is not initialized yet');
        }

        // Clean up previous rendering engine
        if (renderingEngineRef.current) {
          renderingEngineRef.current.destroy();
          webglContextManager.releaseContext(renderingEngineId);
        }

        // Acquire rendering context (WebGL or Canvas 2D fallback)
        const canvas = element.querySelector('canvas') || document.createElement('canvas');
        const context = webglContextManager.acquireContext(canvas, renderingEngineId, viewportId);

        if (!context) {
          throw new Error('Failed to acquire any rendering context (WebGL or Canvas 2D)');
        }

        // Check if we got a Canvas 2D context (fallback mode)
        const isCanvas2D = !('getExtension' in context);
        if (isCanvas2D) {
          log.warn('Using Canvas 2D fallback mode - Cornerstone3D features will be limited', {
            component: 'useViewportSetup',
            metadata: { renderingEngineId, viewportId },
          });
          // For Canvas 2D fallback, we'll handle this differently
          throw new Error('Canvas 2D fallback required - will use Canvas2DViewport component');
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

        // CRITICAL: Ensure wadouri loader is available before loading images
        try {
          const cornerstone = await import('@cornerstonejs/core');

          log.info('Pre-load wadouri preparation', {
            component: 'useViewportSetup',
            hasImageLoaderModule: !!cornerstone.imageLoader,
            firstImageId: imageIds[0],
            totalImageIds: imageIds.length,
            imageIdScheme: imageIds[0]?.split('://')?.[0] || 'unknown',
          });

          // Ensure we have the image loader module
          if (!cornerstone.imageLoader) {
            throw new Error('Cornerstone imageLoader module not available');
          }

          // Extract the scheme from the first image ID to verify we can handle it
          const firstImageScheme = imageIds[0]?.split('://')?.[0];
          if (firstImageScheme && firstImageScheme !== 'wadouri') {
            log.warn('Non-wadouri image scheme detected', {
              component: 'useViewportSetup',
              scheme: firstImageScheme,
              imageId: imageIds[0],
            });
          }

        } catch (loaderCheckError) {
          log.error('Pre-load preparation failed', {
            component: 'useViewportSetup',
            error: loaderCheckError,
          });
          throw loaderCheckError;
        }

        // Set the stack of images
        await viewport.setStack(imageIds, currentImageIndex);

        // Render the image first
        log.info('Viewport initial rendering started', {
          component: 'useViewportSetup',
          metadata: { viewportId, renderingEngineId },
        });
        renderingEngine.render();
        log.info('Viewport initial render completed', {
          component: 'useViewportSetup',
        });

        // Attach mouse event logger
        mouseEventLogger.attachToViewport(element, viewportId);

        // Wait for viewport to be ready
        await viewport.getImageData();
        log.info('Viewport image data loaded', {
          component: 'useViewportSetup',
          metadata: { viewportId },
        });

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
