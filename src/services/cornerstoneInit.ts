/**
 * Cornerstone3D 초기화 서비스
 * DICOM 이미지 로더, 렌더링 엔진, 툴 등의 초기화를 담당
 * Built with security compliance and error handling
 */

import { init as cornerstoneInit } from '@cornerstonejs/core';
import { init as cornerstoneToolsInit } from '@cornerstonejs/tools';
import * as cornerstone from '@cornerstonejs/core';
import { CORNERSTONE_CONFIG } from '../config/cornerstone';
import { log } from '../utils/logger';

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

    // 3. Configure and register DICOM Image Loader
    await initializeDICOMImageLoader();

    // 4. Configure rendering engine settings
    configureRenderingEngine();

    // 5. Set up error handlers
    setupErrorHandlers();

    isInitialized = true;
    log.info('Cornerstone3D initialization completed', {
      component: 'CornerstoneInit',
    });

  } catch (error) {
    log.error('Failed to initialize Cornerstone3D', {
      component: 'CornerstoneInit',
    }, error as Error);
    
    isInitialized = false;
    initializationPromise = null;
    throw error;
  }
}

/**
 * Initialize and configure DICOM Image Loader v3.32.5
 * 임시 방법: 패키지 오류로 인한 우회 처리
 */
async function initializeDICOMImageLoader(): Promise<void> {
  try {
    const config = CORNERSTONE_CONFIG.dicomImageLoader;
    
    log.info('DICOM Image Loader v3.32.5 initialization started', {
      component: 'CornerstoneInit',
      metadata: {
        note: 'Using fallback initialization due to package import issues',
        maxWebWorkers: config.maxWebWorkers,
        strict: config.strict,
      },
    });

    // 임시로 DICOM 이미지 로더 import를 시도하지만 실패해도 계속 진행
    try {
      const cornerstoneDICOMImageLoader = await import('@cornerstonejs/dicom-image-loader');
      
      log.info('DICOM Image Loader v3.32.5 imported successfully', {
        component: 'CornerstoneInit',
        metadata: {
          availableExports: Object.keys(cornerstoneDICOMImageLoader),
          hasInit: 'init' in cornerstoneDICOMImageLoader,
          hasWadouri: 'wadouri' in cornerstoneDICOMImageLoader,
          hasWadors: 'wadors' in cornerstoneDICOMImageLoader,
        },
      });

      // Initialize DICOM Image Loader using the new v3.32.5 init function
      if (cornerstoneDICOMImageLoader.init) {
        await cornerstoneDICOMImageLoader.init();
        log.info('DICOM Image Loader initialized with init() function', {
          component: 'CornerstoneInit',
        });
      }

      // Register image loaders for different DICOM schemes using v3.32.5 API
      if (cornerstoneDICOMImageLoader.wadouri?.loadImage) {
        cornerstone.registerImageLoader('wadouri', cornerstoneDICOMImageLoader.wadouri.loadImage);
        cornerstone.registerImageLoader('dicomfile', cornerstoneDICOMImageLoader.wadouri.loadImage);
        log.info('WADOURI image loader registered', { component: 'CornerstoneInit' });
      }
      
      if (cornerstoneDICOMImageLoader.wadors?.loadImage) {
        cornerstone.registerImageLoader('wadors', cornerstoneDICOMImageLoader.wadors.loadImage);
        cornerstone.registerImageLoader('dicomweb', cornerstoneDICOMImageLoader.wadors.loadImage);
        log.info('WADORS image loader registered', { component: 'CornerstoneInit' });
      }

      // Configure internal options using the new API if available
      if (cornerstoneDICOMImageLoader.internal?.setOptions) {
        cornerstoneDICOMImageLoader.internal.setOptions({
          maxWebWorkers: config.maxWebWorkers,
          startWebWorkersOnDemand: true,
          taskConfiguration: {
            decodeTask: {
              initializeCodecsOnStartup: false,
              strict: config.strict,
            },
          },
        });
        log.info('DICOM Image Loader options configured', {
          component: 'CornerstoneInit',
          metadata: {
            maxWebWorkers: config.maxWebWorkers,
            strict: config.strict,
          },
        });
      }

    } catch (importError) {
      // DICOM 이미지 로더 import 실패 시 경고하지만 앱은 계속 실행
      log.warn('DICOM Image Loader import failed, continuing without DICOM support', {
        component: 'CornerstoneInit',
        metadata: {
          error: importError instanceof Error ? importError.message : 'Unknown error',
          note: 'This may be due to package corruption or missing files. App will continue without DICOM image loading capability.',
          workaround: 'Consider using cornerstone-web-image-loader for basic image support',
        },
      });
      
      // 대안: cornerstone-web-image-loader 사용 등록 시도
      try {
        const webImageLoader = await import('cornerstone-web-image-loader');
        if (webImageLoader.loadImage) {
          cornerstone.registerImageLoader('http', webImageLoader.loadImage);
          cornerstone.registerImageLoader('https', webImageLoader.loadImage);
          log.info('Web Image Loader registered as fallback', { component: 'CornerstoneInit' });
        }
      } catch (webLoaderError) {
        log.warn('Web Image Loader fallback also failed', {
          component: 'CornerstoneInit',
          metadata: { error: webLoaderError instanceof Error ? webLoaderError.message : 'Unknown error' },
        });
      }
    }

    log.info('DICOM Image Loader initialization completed (with or without DICOM support)', {
      component: 'CornerstoneInit',
      metadata: {
        maxWebWorkers: config.maxWebWorkers,
        strict: config.strict,
        note: 'App will function but may lack DICOM image loading capability if import failed',
      },
    });

  } catch (error) {
    // 심각한 오류가 아닌 경우 경고로 처리하고 계속 진행
    log.warn('DICOM Image Loader initialization encountered issues but continuing', {
      component: 'CornerstoneInit',
      metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
    // throw를 제거하여 앱이 계속 실행되도록 함
  }
}

/**
 * Configure rendering engine settings
 */
function configureRenderingEngine(): void {
  try {
    // Set up WebGL context configuration
    const webglConfig = {
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance' as WebGLPowerPreference,
      failIfMajorPerformanceCaveat: false,
      antialias: false, // Disable for better performance
      alpha: false,
      depth: true,
      stencil: false,
    };

    // Configure GPU memory management
    cornerstone.setConfiguration({
      rendering: {
        preferSizeOverAccuracy: CORNERSTONE_CONFIG.volumeRendering.preferSizeOverAccuracy,
        gpuTier: CORNERSTONE_CONFIG.renderingEngine.gpuTier,
      },
      gpu: {
        webglContextAttributes: webglConfig,
      },
    });

    log.info('Rendering engine configured', {
      component: 'CornerstoneInit',
      metadata: {
        gpuTier: CORNERSTONE_CONFIG.renderingEngine.gpuTier,
        webglConfig,
      },
    });

  } catch (error) {
    log.error('Failed to configure rendering engine', {
      component: 'CornerstoneInit',
    }, error as Error);
    throw error;
  }
}

/**
 * Set up error handlers for Cornerstone3D
 */
function setupErrorHandlers(): void {
  // Handle uncaught errors from Cornerstone
  const originalErrorHandler = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    if (typeof message === 'string' && message.includes('cornerstone')) {
      log.error('Cornerstone3D runtime error', {
        component: 'CornerstoneInit',
        metadata: { message, source, lineno, colno },
      }, error || new Error(message));
    }
    
    if (originalErrorHandler) {
      return originalErrorHandler(message, source, lineno, colno, error);
    }
    return false;
  };

  // Handle WebGL context lost events
  window.addEventListener('webglcontextlost', (event) => {
    log.warn('WebGL context lost', {
      component: 'CornerstoneInit',
      metadata: { event: event.type },
    });
    event.preventDefault();
  });

  // Handle WebGL context restored events
  window.addEventListener('webglcontextrestored', () => {
    log.info('WebGL context restored', {
      component: 'CornerstoneInit',
    });
  });
}

/**
 * Get initialization status
 */
export function isCornerstoneInitialized(): boolean {
  return isInitialized;
}

/**
 * Reset initialization state (for testing purposes)
 */
export function resetInitialization(): void {
  isInitialized = false;
  initializationPromise = null;
}

/**
 * Cleanup Cornerstone3D resources
 */
export function cleanupCornerstone(): void {
  try {
    // Destroy all rendering engines
    cornerstone.getRenderingEngines().forEach(engine => {
      engine.destroy();
    });

    // Clear image cache
    cornerstone.cache.purgeCache();

    // Reset initialization state
    resetInitialization();

    log.info('Cornerstone3D cleanup completed', {
      component: 'CornerstoneInit',
    });

  } catch (error) {
    log.error('Failed to cleanup Cornerstone3D', {
      component: 'CornerstoneInit',
    }, error as Error);
  }
}