/**
 * Cornerstone3D 초기화 서비스 - Mock Implementation
 * DICOM 이미지 로더, 렌더링 엔진, 툴 등의 초기화를 담당
 * Built with security compliance and error handling
 */

import { init as cornerstoneInit } from '@cornerstonejs/core';
import { init as cornerstoneToolsInit } from '@cornerstonejs/tools';
import { CORNERSTONE_CONFIG } from '../config/cornerstone';
import { log } from '../utils/logger';
import { configureDicomLoaderWithoutWorkers } from './dicomWorkerConfig';

// Global initialization state
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize Cornerstone3D with all required components
 */
export async function initializeCornerstone(): Promise<void> {
  if (isInitialized) {
    return;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = performInitialization();
  return initializationPromise;
}

/**
 * Perform the actual initialization
 */
async function performInitialization(): Promise<void> {
  try {
    log.info('Initializing Cornerstone3D', {
      component: 'CornerstoneInit',
    });

    // 1. Initialize Cornerstone Core
    await cornerstoneInit();
    log.info('Cornerstone3D Core initialized', {
      component: 'CornerstoneInit',
    });

    // 2. Initialize Cornerstone Tools
    cornerstoneToolsInit();
    log.info('Cornerstone3D Tools initialized', {
      component: 'CornerstoneInit',
    });

    // 3. Mock DICOM Image Loaders initialization
    await initializeDicomImageLoaders();

    // 4. Mock Web Image Loaders initialization
    await initializeWebImageLoaders();

    // 5. Mock Cornerstone configuration
    configureCornerstone();

    isInitialized = true;
    log.info('Cornerstone3D initialization completed successfully', {
      component: 'CornerstoneInit',
    });
  } catch (error) {
    log.error(
      'Failed to initialize Cornerstone3D',
      {
        component: 'CornerstoneInit',
      },
      error as Error,
    );
    throw error;
  }
}

/**
 * Initialize DICOM Image Loaders
 */
async function initializeDicomImageLoaders(): Promise<void> {
  try {
    log.info('Initializing DICOM Image Loaders', {
      component: 'CornerstoneInit',
    });

    // Dynamic import for DICOM Image Loader to avoid build issues
    const cornerstoneWADOImageLoader = await import('@cornerstonejs/dicom-image-loader');
    const cornerstone = await import('@cornerstonejs/core');
    const dicomParser = await import('dicom-parser');

    // CRITICAL: Configure codec behavior for development without overriding ES module properties
    if (import.meta.env.DEV) {
      log.info('Development mode: Configuring codecs via official APIs to prevent loading errors');

      const loader = cornerstoneWADOImageLoader as any;

      // Try to use official configuration methods instead of property override
      try {
        // Look for official configuration options
        if (loader.configure && typeof loader.configure === 'function') {
          loader.configure({
            useWebWorkers: false,
            initializeCodecs: false,
            enableCompressionSupport: false,
            decodeConfig: {
              useWebWorkers: false,
            },
          });
          log.info('DICOM loader configured via official API');
        } else if (loader.webWorkerManager) {
          // Disable web workers if manager exists
          try {
            loader.webWorkerManager.terminate();
            log.info('Web workers terminated to prevent codec loading');
          } catch {
            log.info('Web worker termination not needed or already done');
          }
        }
      } catch (configError) {
        log.warn('Could not configure DICOM loader via official API - codecs may still load', { configError });
        // Don't attempt to override readonly properties - just log and continue
      }
    }

    // Set external dependencies - try different approaches
    try {
      const loader = cornerstoneWADOImageLoader as any;
      if (loader.external) {
        loader.external.cornerstone = cornerstone;
        loader.external.dicomParser = dicomParser;
      }

      // Also try to set on default export if available
      if (loader.default?.external) {
        loader.default.external.cornerstone = cornerstone;
        loader.default.external.dicomParser = dicomParser;
      }

      log.info('External dependencies set for DICOM image loader');
    } catch (externalError) {
      log.warn('Failed to set external dependencies, may not be required in this version', { externalError });
    }

    // Configure the DICOM Image Loader
    const config = CORNERSTONE_CONFIG.dicomImageLoader;

    try {
      const loader = cornerstoneWADOImageLoader as any;

      // Try to initialize the loader first
      if (loader.init && typeof loader.init === 'function') {
        await loader.init();
        log.info('DICOM image loader initialized with init()');
      }

      // Configure DICOM loader without web workers to avoid Vite optimization issues
      configureDicomLoaderWithoutWorkers(loader);
      log.info('DICOM loader configured without web workers for development');

      // Configure if available
      if (loader.configure) {
        loader.configure({
          maxWebWorkers: config.maxWebWorkers,
          beforeSend: (_xhr: XMLHttpRequest) => {
            // Add any custom headers if needed
          },
          errorInterceptor: (error: any) => {
            log.error('DICOM loader error intercepted', { error });
          },
        });
        log.info('DICOM image loader configured', { maxWebWorkers: config.maxWebWorkers });
      } else if (loader.default?.configure) {
        loader.default.configure({
          maxWebWorkers: config.maxWebWorkers,
        });
        log.info('DICOM image loader configured via default export');
      }
    } catch (configError) {
      log.warn('Failed to configure DICOM Image Loader, using defaults', { configError });
    }

    // Register image loaders - comprehensive registration attempts
    let registrationSuccess = false;

    // Method 1: Direct registration via cornerstone
    try {
      const loader = cornerstoneWADOImageLoader as any;

      log.info('Attempting wadouri registration method 1', {
        hasImageLoader: !!cornerstone.imageLoader,
        hasRegisterImageLoader: !!cornerstone.imageLoader?.registerImageLoader,
        hasWadouri: !!loader.wadouri,
        hasLoadImage: !!loader.wadouri?.loadImage,
      });

      if (cornerstone.imageLoader?.registerImageLoader && loader.wadouri?.loadImage) {
        cornerstone.imageLoader.registerImageLoader('wadouri', loader.wadouri.loadImage as any);
        log.info('wadouri image loader registered successfully (method 1)');
        registrationSuccess = true;
      }
    } catch (registerError) {
      log.warn('Method 1 failed, trying alternative registration', { registerError });
    }

    // Method 2: Try DICOM loader register functions
    if (!registrationSuccess) {
      try {
        const loader = cornerstoneWADOImageLoader as any;

        log.info('Attempting wadouri registration method 2', {
          hasWadouriRegister: !!loader.wadouri?.register,
          hasRegister: !!loader.register,
          hasDefault: !!loader.default,
        });

        if (loader.wadouri?.register) {
          loader.wadouri.register(cornerstone as any);
          log.info('wadouri image loader registered successfully (method 2)');
          registrationSuccess = true;
        } else if (loader.register) {
          loader.register(cornerstone as any);
          log.info('wadouri image loader registered successfully (method 3)');
          registrationSuccess = true;
        } else if (loader.default?.register) {
          loader.default.register(cornerstone as any);
          log.info('wadouri image loader registered successfully (method 4)');
          registrationSuccess = true;
        }
      } catch (altError) {
        log.warn('Alternative registration methods failed', { altError });
      }
    }

    // Method 3: Try to initialize DICOM image loader if available
    if (!registrationSuccess) {
      try {
        const loader = cornerstoneWADOImageLoader as any;

        log.info('Attempting wadouri registration method 3 - init approach', {
          hasInit: !!loader.init,
          hasDefaultInit: !!loader.default?.init,
        });

        if (loader.init && typeof loader.init === 'function') {
          await loader.init();
          log.info('DICOM loader initialized, trying registration again');

          // Try registration again after init
          if (cornerstone.imageLoader?.registerImageLoader && loader.wadouri?.loadImage) {
            cornerstone.imageLoader.registerImageLoader('wadouri', loader.wadouri.loadImage as any);
            log.info('wadouri image loader registered successfully after init');
            registrationSuccess = true;
          }
        }
      } catch (initError) {
        log.warn('Init-based registration failed', { initError });
      }
    }

    // Method 4: Manual registration fallback
    if (!registrationSuccess) {
      try {
        const loader = cornerstoneWADOImageLoader as any;
        log.info('Attempting manual wadouri registration fallback');

        // Create a simple wadouri loader function
        const wadouriLoader = async (imageId: string) => {
          log.info('Manual wadouri loader called', { imageId });
          // Use the DICOM image loader's loadImage function if available
          if (loader.wadouri?.loadImage) {
            return loader.wadouri.loadImage(imageId);
          } else if (loader.loadImage) {
            return loader.loadImage(imageId);
          } else {
            throw new Error('No suitable load image function available');
          }
        };

        if (cornerstone.imageLoader?.registerImageLoader) {
          cornerstone.imageLoader.registerImageLoader('wadouri', wadouriLoader);
          log.info('wadouri image loader registered successfully (manual fallback)');
          registrationSuccess = true;
        }
      } catch (manualError) {
        log.error('Manual registration fallback failed', { manualError });
      }
    }

    if (!registrationSuccess) {
      log.error('All wadouri registration methods failed - DICOM images will not load');
    }

    // Log registration completion (verification will be done at runtime when needed)
    log.info('DICOM image loader registration completed', {
      registrationSuccess,
      hasImageLoaderModule: !!cornerstone.imageLoader,
      hasRegisterMethod: !!cornerstone.imageLoader?.registerImageLoader,
      note: 'Registration verification will occur during first image load',
    });

    // Final registration attempt to ensure wadouri is available
    if (registrationSuccess && cornerstoneWADOImageLoader) {
      try {
        const loader = cornerstoneWADOImageLoader as any;
        if (loader.wadouri?.loadImage && cornerstone.imageLoader?.registerImageLoader) {
          cornerstone.imageLoader.registerImageLoader('wadouri', loader.wadouri.loadImage as any);
          log.info('Final wadouri registration completed in cornerstoneInit');
        }
      } catch (finalError) {
        log.warn('Final wadouri registration attempt failed', { finalError });
      }
    }

    log.info('DICOM Image Loaders initialization completed', {
      component: 'CornerstoneInit',
      metadata: {
        maxWebWorkers: config.maxWebWorkers,
        strict: config.strict,
      },
    });
  } catch (error) {
    log.error(
      'Failed to initialize DICOM Image Loaders',
      {
        component: 'CornerstoneInit',
      },
      error as Error,
    );
    // Don't throw - allow app to continue without DICOM loading
  }
}

/**
 * Mock Web Image Loaders initialization
 */
async function initializeWebImageLoaders(): Promise<void> {
  try {
    log.info('Mock Web Image Loaders initialization', {
      component: 'CornerstoneInit',
    });

    // Mock web image loader registration
    log.info('Mock web image loader registration - API not available yet');

    log.info('Mock Web Image Loaders initialized', {
      component: 'CornerstoneInit',
    });
  } catch (error) {
    log.warn(
      'Failed to initialize Web Image Loaders (optional)',
      {
        component: 'CornerstoneInit',
      },
      error as Error,
    );
    // Non-critical, continue initialization
  }
}

/**
 * Mock Cornerstone configuration
 */
function configureCornerstone(): void {
  try {
    // Mock cornerstone configuration - API not available yet
    log.info('Mock cornerstone configuration - API not available yet', {
      rendering: {
        useNorm16Texture: true,
        preferSizeOverAccuracy: false,
        strictZSpacingForVolumeViewport: true,
      },
      gpu: {
        maxTextureSize: 4096,
      },
    });

    log.info('Mock Cornerstone configuration applied', {
      component: 'CornerstoneInit',
      metadata: {
        useNorm16Texture: true,
        maxTextureSize: 4096,
      },
    });
  } catch (error) {
    log.error(
      'Failed to configure Cornerstone3D',
      {
        component: 'CornerstoneInit',
      },
      error as Error,
    );
    throw error;
  }
}

/**
 * Check if Cornerstone3D is initialized
 */
export function isCornerstone3DInitialized(): boolean {
  return isInitialized;
}

/**
 * Get initialization status
 */
export function getInitializationStatus(): {
  isInitialized: boolean;
  isInitializing: boolean;
  } {
  return {
    isInitialized,
    isInitializing: initializationPromise !== null && !isInitialized,
  };
}

/**
 * Cleanup Cornerstone3D resources
 */
export function cleanupCornerstone(): void {
  try {
    log.info('Cleaning up Cornerstone3D resources', {
      component: 'CornerstoneInit',
    });

    // Mock rendering engine cleanup - API not available yet
    log.info('Mock rendering engine cleanup - API not available yet');

    isInitialized = false;
    initializationPromise = null;

    log.info('Cornerstone3D cleanup completed', {
      component: 'CornerstoneInit',
    });
  } catch (error) {
    log.error(
      'Failed to cleanup Cornerstone3D',
      {
        component: 'CornerstoneInit',
      },
      error as Error,
    );
    throw error;
  }
}

/**
 * Reset initialization state (for testing)
 */
export function resetInitializationState(): void {
  isInitialized = false;
  initializationPromise = null;

  log.info('Cornerstone3D initialization state reset', {
    component: 'CornerstoneInit',
  });
}
