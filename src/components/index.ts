/**
 * Components Barrel Export
 *
 * Centralized exports for existing UI components
 */

// ===== Core Viewer Components =====
import { DicomViewer } from './DicomViewer';
export { DicomViewer };
export { Canvas2DViewport } from './Canvas2DViewport';

// ===== Stack Components =====
import { StackScrollIndicator } from './StackScrollIndicator';
export { StackScrollIndicator };

// ===== Viewport Grid System =====
export { ViewportGrid } from './ViewportGrid';
export type { ViewportLayout, ViewportState, ViewportGridProps } from './ViewportGrid/index';
export { EnhancedViewportGrid } from './ViewportGrid/enhanced';
export { LayoutSelector } from './LayoutSelector';
export { SynchronizationControls } from './SynchronizationControls';
export type { SynchronizationSettings } from './SynchronizationControls/index';
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

// ===== New Unified Viewer Architecture =====
export { UnifiedViewer } from './UnifiedViewer';
export { ViewportGridManager } from './ViewportGridManager';
export { HeaderNavigation } from './HeaderNavigation';
export { SidePanelSystem } from './SidePanelSystem';
export { ComparisonModeManager } from './ComparisonModeManager';

// ===== Legacy Viewer Components =====
export { AnalysisViewer } from './viewers/AnalysisViewer';
export { BasicViewer } from './viewers/BasicViewer';

// ===== Settings Management =====
export { SyncSettingsManager } from './SyncSettingsManager';

// ===== Performance Monitoring =====
export { PerformanceMonitorDashboard } from './PerformanceMonitorDashboard';

// ===== Integration Testing =====
export { IntegrationTestPanel } from './IntegrationTestPanel';

// ===== Comparison Features =====
export { ComparisonModeToggle } from './ComparisonModeToggle';
export { DragDropStudyAssignment } from './DragDropStudyAssignment';
export { StudyMetadataPanel } from './StudyMetadataPanel';

// ===== App Container =====
export { AppContainer } from './AppContainer';

// ===== Selection API Integration =====
export { SelectionAPIIntegration } from './SelectionAPIIntegration';
export { SelectionAPIDemo } from './examples/SelectionAPIDemo';

// ===== Security Dashboard =====
export { SecurityDashboard } from './SecurityDashboard';

// ===== Essential viewer components bundle =====
export const essentialViewerBundle = {
  DicomViewer,
  StackScrollIndicator,
  ErrorBoundary,
} as const;

// ===== Default Export =====
export default essentialViewerBundle;
