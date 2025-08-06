/**
 * Application configuration
 * Centralized configuration for Cornerstone3D and viewer settings
 */

export const APP_CONFIG = {
  // Cornerstone3D Configuration
  cornerstone: {
    defaultRenderingEngineId: 'dicomViewerRenderingEngine',
    defaultToolGroupId: 'dicomViewerToolGroup',
    preferSizeToFit: true,
    strictZSpacingForVolumeViewport: true,
  },

  // Viewport Configuration
  viewport: {
    defaultOrientation: 'axial',
    enableStackPrefetch: true,
    maxTextureSizeInBytes: 128 * 1024 * 1024, // 128MB
  },

  // Tool Configuration
  tools: {
    defaultTool: 'WindowLevel',
    mouseBindings: {
      primary: 'WindowLevel',
      secondary: 'Pan',
      wheel: 'StackScrollMouseWheel',
    },
  },

  // Performance Configuration
  performance: {
    targetFrameRate: 60,
    maxMemoryUsage: 2 * 1024 * 1024 * 1024, // 2GB
    enableGPUOptimization: true,
  },

  // UI Configuration
  ui: {
    theme: 'light' as const,
    minViewportSize: { width: 256, height: 256 },
    defaultGridLayout: '1x1' as const,
  },
} as const;

export type AppConfig = typeof APP_CONFIG;

// Cornerstone3D 통합 exports
// NOTE: These functions are not implemented yet in cornerstone.ts
// export {
//   initializeCornerstone3D,
//   getRenderingEngineInstance,
//   isCornerstone3DInitialized,
//   createViewportInput,
//   createStackViewportInput,
//   createVolumeViewportInput,
//   cleanupCornerstone3D,
//   checkWebGLSupport,
//   getGPUMemoryInfo,
// } from './cornerstone';

// NOTE: These exports are not implemented yet
// Tools exports
// export type { ToolName, MouseButton, ToolBinding } from './tools';
// export {
//   registerAllTools,
//   createDefaultToolGroup,
//   addViewportToToolGroup,
//   removeViewportFromToolGroup,
//   setActiveTool,
//   cleanupToolGroups,
//   annotationManager,
//   ToolNames,
// } from './tools';

// Viewport exports
// export type { ViewportConfiguration, ViewportManager } from './viewport';
// export {
//   createViewportManager,
//   setupViewportSynchronization,
//   getViewportProperties,
//   captureViewportScreenshot,
// } from './viewport';
