/**
 * DICOM Worker Configuration
 * Handles worker setup for DICOM image loading without Vite optimization issues
 */

import { log } from '../utils/logger';

// Worker configuration to avoid Vite dependency optimization issues
export const DICOM_WORKER_CONFIG = {
  // Disable web workers in development to avoid Vite issues
  useWebWorkers: false,
  maxWebWorkers: 0,
  startWebWorkersOnDemand: false,
  taskConfiguration: {
    decodeTask: {
      initializeCodecsOnStartup: false,
      strict: false,
      usePDFJS: false,
    },
  },
  // Disable problematic codecs
  codecs: {
    decodeJPEGBaseline8Bit: false,
    decodeJPEGBaseline12Bit: false,
    decodeJPEGLossless: false,
    decodeJPEGLS: false,
    decodeJPEG2000: false,
    decodeRLE: false,
  },
};

/**
 * Configure DICOM loader to work without web workers
 * This avoids Vite dependency optimization issues in development
 */
export function configureDicomLoaderWithoutWorkers(loader: any): void {
  try {
    // Disable web workers completely
    if (loader.webWorkerManager) {
      loader.webWorkerManager.initialize({
        maxWebWorkers: 0,
        startWebWorkersOnDemand: false,
        taskConfiguration: {
          decodeTask: {
            initializeCodecsOnStartup: false,
            strict: false,
          },
        },
      });
      log.info('DICOM loader configured without web workers');
    }

    // Configure the loader to use synchronous decoding
    if (loader.configure) {
      loader.configure({
        maxWebWorkers: 0,
        strict: false,
        decodeConfig: {
          convertFloatPixelDataToInt: false,
          use16BitDataType: true,
        },
      });
    }

    // Set flag to use synchronous decoding
    if (loader.setUseWebWorkers) {
      loader.setUseWebWorkers(false);
    }

    log.info('DICOM loader configured for synchronous operation');
  } catch (error) {
    log.warn('Failed to configure DICOM loader without workers', { error });
  }
}

/**
 * Create a mock worker that runs synchronously
 * This is used when web workers are not available
 */
export function createMockWorker(): Worker {
  const mockWorker = {
    postMessage: (data: any) => {
      // Handle message synchronously
      log.info('Mock worker received message', { data });
    },
    terminate: () => {
      log.info('Mock worker terminated');
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    onmessage: null,
    onmessageerror: null,
    onerror: null,
  } as unknown as Worker;

  return mockWorker;
}
