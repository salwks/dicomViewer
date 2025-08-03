/**
 * Context7 Documentation Integration
 *
 * Provides easy access to Cornerstone3D documentation and code examples
 * Library ID: /cornerstonejs/cornerstone3d (443 code examples)
 */

export const CONTEXT7_CONFIG = {
  libraryId: '/cornerstonejs/cornerstone3d',
  codeExamplesCount: 443,
  trustScore: 7.9,
} as const;

/**
 * Documentation reference links for common Cornerstone3D patterns
 */
export const DOCUMENTATION_REFERENCES = {
  initialization: {
    title: 'Cornerstone3D Initialization',
    context7Query: 'initialization basic setup',
    keyPatterns: ['await coreInit()', 'await dicomImageLoaderInit()', 'await cornerstoneToolsInit()'],
    usage: 'Core library initialization pattern',
  },

  renderingEngine: {
    title: 'Rendering Engine Setup',
    context7Query: 'rendering engine viewport setup',
    keyPatterns: [
      'new RenderingEngine(renderingEngineId)',
      'renderingEngine.setViewports(viewportInput)',
      'renderingEngine.render()',
    ],
    usage: 'Creating and configuring rendering engines',
  },

  volumeRendering: {
    title: 'Volume Rendering',
    context7Query: 'volume rendering 3d medical images',
    keyPatterns: [
      'volumeLoader.createAndCacheVolume(volumeId, { imageIds })',
      'setVolumesForViewports(renderingEngine, volumes, viewportIds)',
      'ViewportType.ORTHOGRAPHIC',
    ],
    usage: '3D volume rendering and display',
  },

  tools: {
    title: 'Tool Management',
    context7Query: 'tools annotation measurement',
    keyPatterns: [
      'ToolGroupManager.createToolGroup(toolGroupId)',
      'addTool(ToolName)',
      'toolGroup.setToolActive(toolName, bindings)',
    ],
    usage: 'Managing annotation and measurement tools',
  },

  segmentation: {
    title: 'Segmentation Tools',
    context7Query: 'segmentation brush tools labelmap',
    keyPatterns: [
      'segmentation.addSegmentations([segmentationData])',
      'BrushTool',
      'createAndCacheDerivedLabelmapVolume',
    ],
    usage: 'Image segmentation and labeling',
  },

  dicomLoader: {
    title: 'DICOM Image Loading',
    context7Query: 'dicom image loader configuration',
    keyPatterns: ['dicomImageLoaderInit({ maxWebWorkers })', 'createImageIdsAndCacheMetaData', 'wadoRsRoot'],
    usage: 'Loading and caching DICOM images',
  },
} as const;

/**
 * Get Context7 query for specific Cornerstone3D functionality
 */
export function getContext7Query(functionality: keyof typeof DOCUMENTATION_REFERENCES): string {
  const ref = Object.prototype.hasOwnProperty.call(DOCUMENTATION_REFERENCES, functionality)
    ? // eslint-disable-next-line security/detect-object-injection -- Safe: functionality is constrained to keys of DOCUMENTATION_REFERENCES
    DOCUMENTATION_REFERENCES[functionality]
    : null;
  return ref?.context7Query || '';
}

/**
 * Get usage description for specific functionality
 */
export function getUsageDescription(functionality: keyof typeof DOCUMENTATION_REFERENCES): string {
  const ref = Object.prototype.hasOwnProperty.call(DOCUMENTATION_REFERENCES, functionality)
    ? // eslint-disable-next-line security/detect-object-injection -- Safe: functionality is constrained to keys of DOCUMENTATION_REFERENCES
    DOCUMENTATION_REFERENCES[functionality]
    : null;
  return ref?.usage || '';
}

/**
 * Get key code patterns for specific functionality
 */
export function getKeyPatterns(functionality: keyof typeof DOCUMENTATION_REFERENCES): string[] {
  const ref = Object.prototype.hasOwnProperty.call(DOCUMENTATION_REFERENCES, functionality)
    ? // eslint-disable-next-line security/detect-object-injection -- Safe: functionality is constrained to keys of DOCUMENTATION_REFERENCES
    DOCUMENTATION_REFERENCES[functionality]
    : null;
  return ref?.keyPatterns ? [...ref.keyPatterns] : [];
}

/**
 * Format Context7 reference for comments
 */
export function formatContext7Reference(functionality: keyof typeof DOCUMENTATION_REFERENCES): string {
  const ref = Object.prototype.hasOwnProperty.call(DOCUMENTATION_REFERENCES, functionality)
    ? // eslint-disable-next-line security/detect-object-injection -- Safe: functionality is constrained to keys of DOCUMENTATION_REFERENCES
    DOCUMENTATION_REFERENCES[functionality]
    : DOCUMENTATION_REFERENCES.dicomLoader; // fallback
  return `/**
 * ${ref.title}
 * 
 * Context7 Reference: ${CONTEXT7_CONFIG.libraryId}
 * Query: "${ref.context7Query}"
 * Usage: ${ref.usage}
 * 
 * Key patterns:
 * ${ref.keyPatterns.map(pattern => ` * - ${pattern}`).join('\n')}
 */`;
}

/**
 * Common error patterns and their Context7 documentation references
 */
export const ERROR_DOCUMENTATION = {
  'rendering engine not initialized': {
    query: 'rendering engine initialization setup',
    suggestion: 'Ensure createRenderingEngine() is called before using viewports',
  },
  'viewport not found': {
    query: 'viewport setup configuration',
    suggestion: 'Check viewport ID and ensure setViewports() was called',
  },
  'tool group not found': {
    query: 'tool group management',
    suggestion: 'Create tool group with ToolGroupManager.createToolGroup()',
  },
  'volume loading failed': {
    query: 'volume loading createAndCacheVolume',
    suggestion: 'Verify imageIds and WADO-RS endpoint configuration',
  },
} as const;

/**
 * Get documentation suggestion for common errors
 */
export function getErrorDocumentation(errorMessage: string) {
  const lowerError = errorMessage.toLowerCase();

  for (const [pattern, doc] of Object.entries(ERROR_DOCUMENTATION)) {
    if (lowerError.includes(pattern)) {
      return {
        context7Query: doc.query,
        suggestion: doc.suggestion,
        libraryId: CONTEXT7_CONFIG.libraryId,
      };
    }
  }

  return {
    context7Query: 'troubleshooting common issues',
    suggestion: 'Check Context7 documentation for common patterns',
    libraryId: CONTEXT7_CONFIG.libraryId,
  };
}
