/**
 * Cornerstone3D Configuration
 *
 * Based on Context7 documentation from /cornerstonejs/cornerstone3d
 * Reference: 443 code examples available
 */

import { RenderingEngineConfig } from '../types/dicom';
import { log } from '../utils/logger';

export const CORNERSTONE_CONFIG = {
  // Rendering Engine Settings
  renderingEngine: {
    id: 'mainRenderingEngine',
    gpuTier: 3, // Auto-detect or use tier 3 for high performance
  } as RenderingEngineConfig,

  // DICOM Image Loader Settings
  dicomImageLoader: {
    maxWebWorkers: navigator.hardwareConcurrency || 1,
    decodeConfig: {
      convertColorspace: true,
      targetBuffer: {
        type: 'Uint8Array',
      },
    },
    strict: false, // Set to true for strict DICOM compliance
    beforeSend: (_xhr: XMLHttpRequest) => {
      // Add custom headers if needed (e.g., authentication)
      // xhr.setRequestHeader('Authorization', 'Bearer token');
    },
    errorInterceptor: (error: Error) => {
      log.error('DICOM Image Loader Error:', error);
      // Custom error handling logic
    },
  },

  // Default Viewport Settings
  defaultViewportSettings: {
    windowCenter: 0,
    windowWidth: 400,
    zoom: 1,
    pan: [0, 0] as [number, number],
    rotation: 0,
    flipHorizontal: false,
    flipVertical: false,
    interpolationType: 'LINEAR' as const,
  },

  // Tool Configuration
  tools: {
    defaultToolGroup: 'defaultToolGroup',
    mouseBindings: {
      primary: 1, // Left click
      secondary: 2, // Middle click
      auxiliary: 4, // Right click
    },
    wheelBinding: 'zoom',
  },

  // Volume Rendering Settings
  volumeRendering: {
    gpuMemoryAutoFreeLimit: 1024 * 1024 * 1024, // 1GB
    useWebWorkers: true,
    preferSizeOverAccuracy: false,
    presets: {
      CT: {
        windowCenter: 0,
        windowWidth: 400,
      },
      MR: {
        windowCenter: 128,
        windowWidth: 256,
      },
      PT: {
        windowCenter: 2500,
        windowWidth: 5000,
      },
    },
  },

  // Segmentation Settings
  segmentation: {
    activeSegmentation: {
      outlineWidthActive: 3,
      outlineWidthInactive: 1,
      fillAlpha: 0.7,
      outlineAlpha: 1.0,
    },
    labelmap: {
      renderOutline: true,
      renderFill: true,
    },
  },

  // Performance Settings
  performance: {
    enableCaching: true,
    cacheSize: 512 * 1024 * 1024, // 512MB
    enableWebGL2: true,
    preferWebGPU: false, // Future feature
  },

  // Security Settings for Medical Applications
  security: {
    sanitizeImageData: true,
    validateDICOMHeaders: true,
    enforceCSP: true,
    auditImageAccess: true,
  },
} as const;

// Viewport presets for different imaging modalities
export const VIEWPORT_PRESETS = {
  CT_AXIAL: {
    viewportId: 'ct-axial',
    type: 'ORTHOGRAPHIC' as const,
    defaultOptions: {
      orientation: 'AXIAL' as const,
      background: [0, 0, 0] as [number, number, number],
    },
  },
  CT_SAGITTAL: {
    viewportId: 'ct-sagittal',
    type: 'ORTHOGRAPHIC' as const,
    defaultOptions: {
      orientation: 'SAGITTAL' as const,
      background: [0, 0, 0] as [number, number, number],
    },
  },
  CT_CORONAL: {
    viewportId: 'ct-coronal',
    type: 'ORTHOGRAPHIC' as const,
    defaultOptions: {
      orientation: 'CORONAL' as const,
      background: [0, 0, 0] as [number, number, number],
    },
  },
  STACK: {
    viewportId: 'stack',
    type: 'STACK' as const,
    defaultOptions: {
      background: [0, 0, 0] as [number, number, number],
    },
  },
} as const;

// Common WADO-RS endpoints for different environments
export const WADO_CONFIG = {
  development: {
    wadoRsRoot: 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
  },
  production: {
    wadoRsRoot: process.env.VITE_WADDERS_ROOT || '',
  },
} as const;
