/**
 * Hooks Index
 * Centralized export for all custom hooks in the layout-based architecture
 * Optimized for shadcn/ui integration with minimal dependencies
 */

// Layout management hooks
export { useLayoutManager } from './useLayoutManager';
export type { LayoutManagerReturn, LayoutInfo, TransitionInfo } from './useLayoutManager';

// Viewport management hooks
export { useViewportManager, useViewport } from './useViewportManager';
export type { ViewportManagerReturn, StudyLoadOptions } from './useViewportManager';

// Synchronization management hooks
export { useSynchronizationManager, useSynchronizationUI } from './useSynchronizationManager';
export type {
  SynchronizationManagerReturn,
  SynchronizationType,
  SynchronizationStatus,
} from './useSynchronizationManager';

// Study management hooks
export { useStudyManagement } from './useStudyManagement';

// Layout persistence hooks
export { useLayoutPersistence } from './useLayoutPersistence';
export type { UseLayoutPersistenceReturn } from './useLayoutPersistence';

// Security hooks
export { useAuditLogger } from './useAuditLogger';
export { useSecurityValidator } from './useSecurityValidator';

// Re-export context hooks for convenience
export {
  useViewer,
  useViewerLayout,
  useActiveViewport,
  useViewportById,
  useSynchronization,
  useTools,
  useViewportTools,
  useActiveTool,
} from '../context/ViewerContext';
