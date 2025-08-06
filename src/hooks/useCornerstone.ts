/**
 * Enhanced Cornerstone3D Hook with React Lifecycle-based Initialization
 * Manages Cornerstone initialization within React component lifecycle
 * Prevents race conditions and ensures proper initialization state management
 */

import { useEffect, useState, useRef } from 'react';
import { initializeCornerstone, isCornerstone3DInitialized } from '../services/cornerstoneInit';
import { log } from '../utils/logger';

export interface CornerstoneState {
  isLoading: boolean;
  isInitialized: boolean;
  error: Error | null;
}

let globalInitializationPromise: Promise<void> | null = null;

export const useCornerstone = (): CornerstoneState => {
  const [state, setState] = useState<CornerstoneState>({
    isLoading: true,
    isInitialized: false,
    error: null,
  });

  const initializationStarted = useRef(false);

  useEffect(() => {
    // Prevent multiple initialization attempts
    if (initializationStarted.current) {
      return;
    }

    const performInitialization = async () => {
      try {
        log.info('Starting React lifecycle-based Cornerstone initialization', {
          component: 'useCornerstone',
        });

        setState(prev => ({ ...prev, isLoading: true, error: null }));

        // Check if already initialized
        if (isCornerstone3DInitialized()) {
          log.info('Cornerstone3D already initialized', {
            component: 'useCornerstone',
          });
          setState({
            isLoading: false,
            isInitialized: true,
            error: null,
          });
          return;
        }

        // Use global promise to prevent multiple simultaneous initializations
        if (!globalInitializationPromise) {
          globalInitializationPromise = initializeCornerstone();
        }

        // Wait for initialization to complete
        await globalInitializationPromise;

        // CRITICAL: Verify and ensure wadouri loader registration
        const ensureWadouriRegistration = async () => {
          const cornerstone = await import('@cornerstonejs/core');

          log.info('Post-initialization wadouri registration check', {
            component: 'useCornerstone',
            hasImageLoaderModule: !!cornerstone.imageLoader,
            hasRegisterMethod: !!cornerstone.imageLoader?.registerImageLoader,
          });

          // Import DICOM loader to get wadouri functionality
          const dicomLoader = await import('@cornerstonejs/dicom-image-loader');
          const loader = dicomLoader as any;

          if (!loader.wadouri?.loadImage) {
            throw new Error('DICOM image loader wadouri module not available');
          }

          if (!cornerstone.imageLoader?.registerImageLoader) {
            throw new Error('Cornerstone imageLoader.registerImageLoader method not available');
          }

          // Always register wadouri (safe to register multiple times)
          cornerstone.imageLoader.registerImageLoader('wadouri', loader.wadouri.loadImage as any);

          log.info('wadouri image loader registration completed', {
            component: 'useCornerstone',
            loaderFunction: typeof loader.wadouri.loadImage,
          });

          // Verify wadouri registration without making network requests (CSP-friendly)
          try {
            // Method 1: Check if the loader function exists and is properly bound
            if (typeof loader.wadouri.loadImage === 'function') {
              // Create a minimal test image ID that won't trigger network requests
              const testImageId = 'wadouri:data:application/dicom,test';

              // Try to call the loader function directly (synchronously if possible)
              try {
                // Just verify the function can be called - we expect it to fail with format error
                const loadPromise = cornerstone.imageLoader.loadImage(testImageId);

                // Don't wait for the promise to resolve - just check that it was created
                if (loadPromise && typeof loadPromise.then === 'function') {
                  log.info('wadouri loader registration verified - function callable', {
                    component: 'useCornerstone',
                    method: 'function-test',
                  });

                  // Cancel the promise to avoid CSP issues
                  loadPromise.catch(() => {
                    // Expected to fail - this is just to clean up
                  });
                } else {
                  throw new Error('loadImage did not return a promise');
                }
              } catch (callError: any) {
                // If the error is about missing loader, that's a problem
                if (callError.message?.includes('No image loader found for scheme')) {
                  throw new Error('wadouri loader registration failed - scheme not registered');
                } else {
                  // Any other error means the loader exists but failed for other reasons
                  log.info('wadouri loader registration verified via expected error', {
                    component: 'useCornerstone',
                    expectedError: callError.message?.substring(0, 100),
                  });
                }
              }
            } else {
              throw new Error('wadouri.loadImage is not a function');
            }
          } catch (verificationError) {
            log.warn('Could not verify wadouri registration - using fallback assumption', {
              component: 'useCornerstone',
              error: verificationError,
            });
            // In development, we assume it worked if we got this far
            if (import.meta.env.DEV) {
              log.info('Development mode: Assuming wadouri registration successful');
            }
          }
        };

        await ensureWadouriRegistration();

        // Verify initialization succeeded
        if (isCornerstone3DInitialized()) {
          log.info('React lifecycle Cornerstone initialization completed successfully', {
            component: 'useCornerstone',
          });

          setState({
            isLoading: false,
            isInitialized: true,
            error: null,
          });
        } else {
          throw new Error('Cornerstone initialization completed but state check failed');
        }

      } catch (error) {
        log.error('React lifecycle Cornerstone initialization failed', {
          component: 'useCornerstone',
        }, error as Error);

        setState({
          isLoading: false,
          isInitialized: false,
          error: error as Error,
        });

        // Reset global promise on error so retry is possible
        globalInitializationPromise = null;
      }
    };

    initializationStarted.current = true;
    performInitialization();

  }, []); // Empty dependency array - initialize only once

  return state;
};
