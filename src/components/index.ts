/**
 * Components Barrel Export
 *
 * Centralized exports for all UI components
 * Features both modern refactored components and legacy compatibility
 */

// ===== Core Viewer Components =====
export { ModeSelector } from './ModeSelector';
export type { ModeSelectorProps } from './ModeSelector';

export { DicomViewer } from './DicomViewer';
export type { DicomViewerProps } from './DicomViewer';

export { SeriesBrowser } from './SeriesBrowser';
export type { SeriesBrowserProps } from './SeriesBrowser';

export { SampleDataLoader } from './SampleDataLoader';
export type { SampleDataLoaderProps } from './SampleDataLoader';

// ===== Refactored Annotation Components =====
// Main component (refactored for better modularity)
export { AnnotationPersistencePanel } from './AnnotationPersistence';
export type { AnnotationPersistencePanelProps } from './AnnotationPersistence';

// Sub-components (available for custom layouts)
export {
  AnnotationSaveLoadSection,
  AnnotationExportSection,
  AnnotationImportSection,
  AnnotationHistorySection,
  AnnotationListDisplay,
  AnnotationToolbar,
} from './AnnotationPersistence/components';

export type {
  AnnotationSaveLoadSectionProps,
  AnnotationExportSectionProps,
  AnnotationImportSectionProps,
  AnnotationHistorySectionProps,
  AnnotationListDisplayProps,
  AnnotationToolbarProps,
} from './AnnotationPersistence/components';

// Hook for custom implementations
export { useAnnotationPersistence } from './AnnotationPersistence/hooks/useAnnotationPersistence';
export type {
  UseAnnotationPersistenceProps,
  UseAnnotationPersistenceReturn,
} from './AnnotationPersistence/hooks/useAnnotationPersistence';

// ===== Utility Components =====
export { ErrorBoundary } from './ErrorBoundary';
export type { ErrorBoundaryProps } from './ErrorBoundary';

export { TextStyleRenderer } from './TextStyleRenderer';
export type { TextStyleRendererProps } from './TextStyleRenderer';

// ===== Style and Annotation Management =====
export { AnnotationVisibilityManager } from './AnnotationVisibilityManager';
export type { AnnotationVisibilityManagerProps } from './AnnotationVisibilityManager';

// ===== Keyboard Shortcuts =====
export { KeyboardShortcutsProvider } from './KeyboardShortcutsProvider';
export type { KeyboardShortcutsProviderProps } from './KeyboardShortcutsProvider';

export { useKeyboardShortcutsContext } from './KeyboardShortcutsProvider/hooks';
export type { KeyboardShortcutsContextType } from './KeyboardShortcutsProvider/context';

// ===== Tool Components =====
export { ToolPanel } from './ToolPanel';
export type { ToolPanelProps } from './ToolPanel';

// ===== Component Bundles for Common Use Cases =====

/**
 * Essential viewer components bundle
 * Includes the minimum components needed for a basic DICOM viewer
 */
export const essentialViewerBundle = {
  ModeSelector,
  DicomViewer,
  SeriesBrowser,
  ErrorBoundary,
} as const;

/**
 * Complete annotation workflow bundle
 * Includes all components needed for annotation management
 */
export const annotationWorkflowBundle = {
  AnnotationPersistencePanel,
  AnnotationVisibilityManager,
  ToolPanel,
  // Sub-components for custom layouts
  AnnotationSaveLoadSection,
  AnnotationExportSection,
  AnnotationImportSection,
  AnnotationHistorySection,
  AnnotationListDisplay,
  AnnotationToolbar,
} as const;

/**
 * Advanced components bundle
 * Includes components for power users and advanced workflows
 */
export const advancedComponentBundle = {
  ...essentialViewerBundle,
  ...annotationWorkflowBundle,
  KeyboardShortcutsProvider,
  TextStyleRenderer,
  SampleDataLoader,
} as const;

// ===== Component Information and Utilities =====

/**
 * Get information about available components
 */
export function getComponentInfo() {
  return {
    essential: Object.keys(essentialViewerBundle),
    annotation: Object.keys(annotationWorkflowBundle),
    advanced: Object.keys(advancedComponentBundle),
    refactored: [
      'AnnotationPersistencePanel',
      'AnnotationSaveLoadSection',
      'AnnotationExportSection',
      'AnnotationImportSection',
      'AnnotationHistorySection',
      'AnnotationListDisplay',
      'AnnotationToolbar',
    ],
    hooks: [
      'useAnnotationPersistence',
      'useKeyboardShortcutsContext',
    ],
  };
}

/**
 * Component migration guide
 */
export function getComponentMigrationGuide() {
  return {
    description: 'Migration guide for component refactoring',
    changes: {
      'AnnotationPersistencePanel': 'Refactored into smaller, reusable components',
      'Component Hooks': 'Business logic extracted into custom hooks',
      'Barrel Exports': 'Improved import structure with component bundles',
      'TypeScript Support': 'Enhanced type definitions for better developer experience',
    },
    recommendations: [
      'Use component bundles for quick setup of common workflows',
      'Import individual components for custom layouts',
      'Use hooks for custom implementations with different UI frameworks',
      'Gradually migrate from large components to modular architecture',
    ],
    examples: {
      'Basic Viewer Setup': {
        old: 'Import and configure components individually',
        new: 'import { essentialViewerBundle } from "@/components";',
      },
      'Custom Annotation UI': {
        old: 'Use monolithic AnnotationPersistencePanel',
        new: 'Use individual annotation components and hooks',
      },
      'Advanced Workflow': {
        old: 'Manual component configuration',
        new: 'import { advancedComponentBundle } from "@/components";',
      },
    },
  };
}

/**
 * Get component bundle by use case
 */
export function getComponentBundle(useCase: 'essential' | 'annotation' | 'advanced') {
  switch (useCase) {
    case 'essential':
      return essentialViewerBundle;
    case 'annotation':
      return annotationWorkflowBundle;
    case 'advanced':
      return advancedComponentBundle;
    default:
      return essentialViewerBundle;
  }
}

// ===== Default Export =====

/**
 * Default export provides access to all component bundles
 */
export default {
  essential: essentialViewerBundle,
  annotation: annotationWorkflowBundle,
  advanced: advancedComponentBundle,
  info: getComponentInfo(),
  migrationGuide: getComponentMigrationGuide(),
  getBundle: getComponentBundle,
};
