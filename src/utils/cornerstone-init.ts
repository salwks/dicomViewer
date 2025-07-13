import { init as csRenderInit } from '@cornerstonejs/core';
import { init as csToolsInit } from '@cornerstonejs/tools';
import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';
import dicomParser from 'dicom-parser';

let isInitialized = false;

/**
 * Initialize Cornerstone3D with proper error handling
 */
export async function initializeCornerstone3D(): Promise<boolean> {
  if (isInitialized) {
    console.log('Cornerstone3D already initialized');
    return true;
  }

  try {
    console.log('Initializing Cornerstone3D...');

    // Initialize core
    await csRenderInit();
    console.log('✓ Cornerstone3D core initialized');

    // Initialize tools
    await csToolsInit();
    console.log('✓ Cornerstone3D tools initialized');

    // Configure DICOM Image Loader
    cornerstoneDICOMImageLoader.external.cornerstone = await import('@cornerstonejs/core');
    cornerstoneDICOMImageLoader.external.dicomParser = dicomParser;

    // Configure DICOM Image Loader settings
    cornerstoneDICOMImageLoader.configure({
      useWebWorkers: true,
      decodeConfig: {
        convertFloatPixelDataToInt: false,
      },
      webWorkerPath: '/cornerstoneWADOImageLoaderWebWorker.min.js',
      taskConfiguration: {
        decodeTask: {
          loadCodecsOnStartup: true,
          initializeCodecsOnStartup: false,
          codecsPath: '/cornerstoneWADOImageLoaderCodecs.min.js',
          usePDFJS: false,
        },
      },
    });

    console.log('✓ DICOM Image Loader configured');

    isInitialized = true;
    console.log('✓ Cornerstone3D initialization complete');
    return true;

  } catch (error) {
    console.error('❌ Failed to initialize Cornerstone3D:', error);
    isInitialized = false;
    return false;
  }
}

/**
 * Check if Cornerstone3D is initialized
 */
export function isCornerstone3DInitialized(): boolean {
  return isInitialized;
}

/**
 * Reset initialization state (useful for testing)
 */
export function resetInitialization(): void {
  isInitialized = false;
}