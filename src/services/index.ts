/**
 * Core Services Export
 * Only exports existing services used by the application
 */

// Core DICOM loading service
export { simpleDicomLoader } from './simpleDicomLoader';

// Canvas 2D rendering fallback service
export { Canvas2DRenderer } from './Canvas2DRenderer';

// Sample data service
export { sampleDataService } from './sampleDataService';

// Viewport state management service
export { ViewportStateManager, viewportStateManager } from './viewportStateManager';

// Viewport performance optimization service
export {
  ViewportOptimizer,
  viewportOptimizer,
  RenderPriority,
  type PerformanceMetrics as ViewportPerformanceMetrics,
  type OptimizationConfig,
  type QualityLevel,
} from './viewport-optimizer';

// Memory management service
export {
  MemoryManager,
  memoryManager,
  CleanupPriority,
  type MemoryUsage,
  type MemoryConfig,
  type MemoryStats,
} from './memoryManager';

// Rendering priority management service
export {
  RenderingPriorityManager,
  renderingPriorityManager,
  RenderPriority as NewRenderPriority,
  type PriorityQueueItem,
  type RenderingTask,
  type ResourceAllocation,
  type PrioritySystemConfig,
  type PriorityMetrics as RenderingPriorityMetrics,
} from './renderingPriorityManager';

// Performance monitoring service
export {
  PerformanceMonitor,
  performanceMonitor,
  MetricCategory,
  AlertLevel,
  type PerformanceMetrics,
  type PerformanceAlert,
  type PerformanceReport as LegacyPerformanceReport,
  type RenderingMetrics,
  type MemoryMetrics,
  type PriorityMetrics,
  type SynchronizationMetrics,
  type SystemMetrics,
  type PerformanceMonitorConfig,
} from './performanceMonitor';

// Series Management Service
export {
  SeriesManagementService,
  seriesManagementService,
  type SeriesManagementConfig,
  DEFAULT_SERIES_MANAGEMENT_CONFIG,
} from './SeriesManagementService';

// Viewport Assignment Manager
export {
  ViewportAssignmentManager,
  viewportAssignmentManager,
  type ViewportAssignmentConfig,
  type ViewportAssignmentState,
  type AssignmentValidationResult,
  DEFAULT_VIEWPORT_ASSIGNMENT_CONFIG,
} from './ViewportAssignmentManager';

// Viewport Synchronizer
export {
  ViewportSynchronizer,
  viewportSynchronizer,
  type ViewportSynchronizerConfig,
  DEFAULT_SYNCHRONIZER_CONFIG,
  DEFAULT_SYNCHRONIZATION_SETTINGS,
  DEFAULT_CROSSREFERENCE_SETTINGS,
} from './ViewportSynchronizer';

// Enhanced Viewport Manager
export {
  ViewportManager,
  viewportManager,
  type ViewportManagerConfig,
  type ViewportLayout,
  type ViewportMetrics,
  DEFAULT_VIEWPORT_MANAGER_CONFIG,
} from './ViewportManager';

// Viewport State Persistence
export {
  ViewportStatePersistence,
  viewportStatePersistence,
  type PersistenceStrategy,
  type PersistenceOptions,
  type ViewportSnapshot,
  type ViewportSession,
  type ViewportStatePersistenceConfig,
  DEFAULT_PERSISTENCE_CONFIG,
} from './ViewportStatePersistence';

// Tool State Manager
export {
  ToolStateManager,
  toolStateManager,
  type ToolDefinition,
  type ToolInteraction,
  type ToolGroup,
  type ToolValidationRule,
  type ToolStateManagerConfig,
  DEFAULT_TOOL_STATE_CONFIG,
  BUILT_IN_TOOLS,
} from './ToolStateManager';

// Viewport Configuration Manager
export {
  ViewportConfigurationManager,
  viewportConfigurationManager,
  type ViewportConfiguration,
  type WindowLevelPreset,
  type LayoutConfiguration,
  type ConfigurationProfile,
  type ProfileCondition,
  type ConfigurationManagerConfig,
  DEFAULT_CONFIGURATION_MANAGER_CONFIG,
  DEFAULT_WINDOW_LEVEL_PRESETS,
} from './ViewportConfigurationManager';

// Viewport State Validator & Recovery
export {
  ViewportStateValidator,
  viewportStateValidator,
  type ValidationRule,
  type ValidationRuleResult,
  type ValidationResult,
  type ValidationIssue,
  type StateBackup,
  type RecoveryStrategy as ValidatorRecoveryStrategy,
  type ValidatorConfig,
  DEFAULT_VALIDATOR_CONFIG,
} from './ViewportStateValidator';

// Enhanced Rendering Optimizer
export {
  EnhancedRenderingOptimizer,
  enhancedRenderingOptimizer,
  type RenderFrame,
  type ViewportRenderState,
  type RenderingOptimizationConfig,
  DEFAULT_RENDERING_CONFIG,
} from './EnhancedRenderingOptimizer';

// Advanced Memory Manager
export {
  AdvancedMemoryManager,
  advancedMemoryManager,
  type MemoryPool,
  type MemoryBlock,
  type ViewportMemoryProfile,
  type MemoryAllocationRequest,
  type MemoryAllocationResult,
  type AdvancedMemoryConfig,
  DEFAULT_ADVANCED_MEMORY_CONFIG,
} from './AdvancedMemoryManager';

// Lazy Loading Manager
export {
  LazyLoadingManager,
  lazyLoadingManager,
  type LazyLoadableResource,
  type ResourceRetentionPolicy,
  type LoadingStrategy as LazyLoadingStrategy,
  type LoadingContext,
  type LoadingQueue,
  type LazyLoadingConfig,
  DEFAULT_LAZY_LOADING_CONFIG,
} from './LazyLoadingManager';

// Synchronization Optimizer (Task 30.4 - enhanced version)
export {
  SynchronizationOptimizer,
  synchronizationOptimizer,
  type SyncOperation,
  type SyncTask,
  type SyncGroup,
  type SyncOptimizerConfig,
  type SyncPerformanceMetrics,
  OptimizationStrategy,
  DEFAULT_SYNC_OPTIMIZER_CONFIG,
} from './synchronizationOptimizer';

// Performance Monitoring System
export {
  PerformanceMonitoringSystem,
  performanceMonitoringSystem,
  type PerformanceSnapshot,
  type PerformanceReport,
  type PerformanceIssue,
  type PerformanceRecommendation,
  type PerformanceTrend,
  type MonitoringConfig,
} from './PerformanceMonitoringSystem';

// Migration System
export {
  MigrationSystem,
  migrationSystem,
  type Migration,
  type MigrationConfig,
  type MigrationResult,
  type MigrationPlan,
  DEFAULT_MIGRATION_CONFIG,
} from './MigrationSystem';

// Viewer State Migration
export {
  ViewerStateMigration,
  viewerStateMigration,
  type ViewerStateMigrationConfig,
  type ViewerStateMigrationResult,
  DEFAULT_MIGRATION_CONFIG as DEFAULT_VIEWER_MIGRATION_CONFIG,
} from './ViewerStateMigration';

// Layout State Persistence
export {
  LayoutStatePersistence,
  layoutStatePersistence,
  type LayoutPersistenceConfig,
  type StoredLayoutState,
  DEFAULT_PERSISTENCE_CONFIG as DEFAULT_LAYOUT_PERSISTENCE_CONFIG,
} from './LayoutStatePersistence';

// Error Recovery System
export {
  ErrorRecoverySystem,
  errorRecoverySystem,
  type ErrorRecoveryConfig,
  type ErrorContext,
  type RecoveryStrategy,
  type RecoveryResult,
  type SystemState,
  DEFAULT_ERROR_RECOVERY_CONFIG,
} from './ErrorRecoverySystem';

// Keyboard Shortcut System
export {
  KeyboardShortcutSystem,
  keyboardShortcutSystem,
  type KeyboardShortcut,
  type ShortcutCategory,
  type KeyboardShortcutConfig,
  DEFAULT_KEYBOARD_SHORTCUT_CONFIG,
} from './KeyboardShortcutSystem';

// Annotation Selection API
export {
  SelectionAPI,
  selectionAPI,
  type SelectionAPIEvents,
  type SelectionOptions,
  type BulkSelectionOptions,
  type SelectionStatistics,
  type SelectionAPIConfig,
} from './SelectionAPI';

// Annotation Selection Handler
export { annotationSelectionHandler, AnnotationSelectionHandler } from './AnnotationSelectionHandler';

// Selection State Manager
export {
  selectionStateManager,
  SelectionStateManager,
  type SelectionState,
  type SelectionHistoryEntry,
} from './SelectionStateManager';

// ===== Core Initialization Services =====
export { initializeCornerstone, isCornerstone3DInitialized, cleanupCornerstone } from './cornerstoneInit';
export { webglContextManager } from './WebGLContextManager';

// ===== Integration Testing & Verification =====
export { ToolVerificationFramework, toolVerificationFramework } from './ToolVerificationFramework';

export { MeasurementToolCompatibility, measurementToolCompatibility } from './MeasurementToolCompatibility';

export { NavigationToolCompatibility, navigationToolCompatibility } from './NavigationToolCompatibility';

export {
  SystemIntegrationVerifier,
  systemIntegrationVerifier,
  type IntegrationTestResult,
  type SystemHealthReport,
  type PerformanceBenchmark,
} from './SystemIntegrationVerifier';

export {
  IntegrationTestRunner,
  integrationTestRunner,
  type TestRunConfiguration,
  type TestRunSummary,
  type TestRunProgress,
} from './IntegrationTestRunner';

// ===== Comparison Features =====
export { ComparisonViewportManager } from './ComparisonViewportManager';
export { LazyViewportLoader } from './LazyViewportLoader';
export { ViewportPoolManager } from './ViewportPoolManager';
export { WindowLevelSync, windowLevelSync } from './WindowLevelSync';
export { ZoomPanSync, zoomPanSync } from './ZoomPanSync';

// Matrix Transform Synchronization
export {
  MatrixTransformSync,
  matrixTransformSync,
  type Point2D,
  type Transform2D,
  type ViewportTransform,
  type MatrixTransformConfig,
  type MatrixTransformEvents,
  DEFAULT_MATRIX_TRANSFORM_CONFIG,
} from './MatrixTransformSync';

// Sync Toggle Manager
export {
  SyncToggleManager,
  syncToggleManager,
  type SyncFeatures,
  type ViewportSyncSettings,
  type SyncToggleConfig,
  type SyncToggleEvents,
  DEFAULT_SYNC_FEATURES,
  DEFAULT_SYNC_TOGGLE_CONFIG,
} from './SyncToggleManager';

// Sync Event Emitter
export {
  SyncEventEmitter,
  syncEventEmitter,
  type SyncEvent,
  type ScrollSyncEvent,
  type WindowLevelSyncEvent,
  type ZoomPanSyncEvent,
  type CrossReferenceSyncEvent,
  type StateChangedEvent,
  type ErrorEvent,
  type EventSubscription,
  type EventFilter,
  type PropagationOptions,
  type EventPropagationContext,
  type SyncEventEmitterConfig,
  DEFAULT_SYNC_EVENT_CONFIG,
} from './SyncEventEmitter';

// Advanced DICOM Loader
export {
  AdvancedDICOMLoaderImpl,
  advancedDICOMLoader,
} from './AdvancedDICOMLoader/AdvancedDICOMLoaderImpl';

export {
  BaseDICOMLoader,
  SOPClassHandler,
  type DICOMLoaderConfig,
  type LoadProgress,
  type DICOMMetadata,
  type LoadOptions,
  type LoadRequest,
  SUPPORTED_SOP_CLASSES,
  DEFAULT_DICOM_LOADER_CONFIG,
} from './AdvancedDICOMLoader';

export {
  CTImageHandler,
  MRImageHandler,
  PETImageHandler,
  UltrasoundHandler,
  DigitalXRayHandler,
  RTHandler,
  MultiFrameHandler,
  SegmentationHandler,
  SOPClassHandlerFactory,
} from './AdvancedDICOMLoader/SOPClassHandlers';

// WADO Protocol Support
export {
  WADOProtocolManager,
  WADOURIHandler,
  WADORSHandler,
  type WADORequest,
  type WADOResponse,
  type WADOAuthConfig,
  type WADORetryConfig,
  DEFAULT_WADO_RETRY_CONFIG,
} from './AdvancedDICOMLoader/WADOProtocolHandler';

// Progressive Loading System
export {
  ProgressiveLoader,
  progressiveLoader,
  LoadPriority,
  type ProgressiveLoadingConfig,
  type ProgressiveLoadRequest,
  type LoadingSession,
  type LoadingSessionProgress,
  type ChunkProgress,
  type LoadingStrategy,
  DEFAULT_PROGRESSIVE_CONFIG,
} from './AdvancedDICOMLoader/ProgressiveLoader';

// Metadata Provider System
export {
  MetadataProviderManager,
  type MetadataProvider,
  type MetadataProviderConfig,
} from './AdvancedDICOMLoader/MetadataProvider';

export {
  DefaultMetadataProvider,
  WADOMetadataProvider,
  CustomMetadataProvider,
  createCustomMetadataProvider,
  createPACSMetadataProvider,
  createResearchMetadataProvider,
  type CustomProviderConfig,
} from './AdvancedDICOMLoader/providers';

// Enhanced DICOM Types
export {
  type EnhancedDICOMMetadata,
  type MetadataExtractionOptions,
  type MetadataValidationResult,
  type ProviderCapabilities,
  type ExtendedLoadOptions,
} from './AdvancedDICOMLoader/types';
