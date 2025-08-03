/**
 * Components Barrel Export
 *
 * Centralized exports for existing UI components
 */

// ===== Core Viewer Components =====
import { DicomViewer } from './DicomViewer';
export { DicomViewer };

// ===== Stack Components =====
import { StackScrollIndicator } from './StackScrollIndicator';
export { StackScrollIndicator };

// ===== Viewport Grid System =====
export { ViewportGrid, type ViewportLayout, type ViewportState, type ViewportGridRef } from './ViewportGrid';
export { EnhancedViewportGrid } from './ViewportGrid/enhanced';
export { LayoutSelector } from './LayoutSelector';
export { SynchronizationControls, type SynchronizationSettings } from './SynchronizationControls';
export { ViewportManager, type ViewportManagerRef } from './ViewportManager';

// ===== Enhanced Series Management =====
export { SeriesBrowser, EnhancedSeriesBrowser } from './SeriesBrowser';
export { EnhancedSeriesPanel, type Study, type DicomSeries, type ViewportAssignment } from './EnhancedSeriesPanel';
export { ViewportAssignmentPanel } from './ViewportAssignmentPanel';
export { StudySelector } from './StudySelector';
export { SynchronizationPanel } from './SynchronizationPanel';

// ===== Drag & Drop System =====
export { DragDropProvider, useDragDrop, DraggableSeries, ViewportDropZone } from './DragDropSystem';

// ===== Cross-Reference Lines System =====
export { CrossReferenceLines } from './CrossReferenceLines';
export type { CrossReferencePoint, CrossReferenceLine, CrossReferenceLinesProps } from './CrossReferenceLines';
export { calculateCrossReferencePoint, DEFAULT_LINE_CONFIGS } from './CrossReferenceLines';

// ===== UI Components =====
export { Progress } from './ui/progress';
export { Slider } from './ui/slider';
export { Input } from './ui/input';
export { Label } from './ui/label';
export { Textarea } from './ui/textarea';
export { Separator } from './ui/separator';
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
export { Toggle } from './ui/toggle';
export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';

// ===== Utility Components =====
import { ErrorBoundary } from './ErrorBoundary';
export { ErrorBoundary };

// ===== Viewer Components =====
export * from './viewers';

// ===== Settings Management =====
export { SyncSettingsManager } from './SyncSettingsManager';

// ===== Performance Monitoring =====
export { PerformanceMonitorDashboard } from './PerformanceMonitorDashboard';

// ===== Comparison Features =====
export { ComparisonModeToggle } from './ComparisonModeToggle';
export { DragDropStudyAssignment } from './DragDropStudyAssignment';
export { StudyMetadataPanel } from './StudyMetadataPanel';

// ===== App Container =====
export { AppContainer } from './AppContainer';

// ===== Essential viewer components bundle =====
export const essentialViewerBundle = {
  DicomViewer,
  StackScrollIndicator,
  ErrorBoundary,
} as const;

// ===== Default Export =====
export default essentialViewerBundle;
