/**
 * Components Barrel Export
 *
 * Centralized exports for existing UI components
 */

// ===== Core Viewer Components =====
export { ModeSelector } from './ModeSelector';
export type { ViewerMode } from './ModeSelector';

export { DicomViewer } from './DicomViewer';

export { SeriesBrowser } from './SeriesBrowser';

export { StudyComparison } from './StudyComparison';

export { ViewerLayout } from './ViewerLayout';

// ===== Tool Components =====
export { ToolPanel } from './ToolPanel';
export { ToolType } from './ToolPanel/constants';

// ===== Stack Components =====
export { StackScrollIndicator } from './StackScrollIndicator';

// ===== Utility Components =====
export { ErrorBoundary } from './ErrorBoundary';

export { ThemeToggle } from './ThemeToggle';

// ===== Essential viewer components bundle =====
export const essentialViewerBundle = {
  ModeSelector,
  DicomViewer,
  SeriesBrowser,
  StudyComparison,
  ViewerLayout,
  ToolPanel,
  StackScrollIndicator,
  ErrorBoundary,
  ThemeToggle,
} as const;

// ===== Default Export =====
export default essentialViewerBundle;
