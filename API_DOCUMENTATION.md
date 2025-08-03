# Cornerstone3D DICOM Viewer - API Documentation

## Overview

The Cornerstone3D DICOM Viewer is a comprehensive medical imaging application built with React, TypeScript, and Cornerstone3D. This API documentation covers all major services, components, and utilities.

## Architecture

### Core Services

#### 1. DICOM Loading Services

##### SimpleDicomLoader
**File:** `src/services/simpleDicomLoader.ts`

```typescript
interface DicomLoadingOptions {
  enableCaching: boolean;
  maxCacheSize: number;
  loadingTimeout: number;
}

class SimpleDicomLoader {
  loadDicomImage(url: string, options?: DicomLoadingOptions): Promise<DicomImage>
  clearCache(): void
  getCacheStats(): CacheStats
}
```

**Usage:**
```typescript
import { simpleDicomLoader } from '@/services';

const image = await simpleDicomLoader.loadDicomImage('/path/to/dicom.dcm');
```

##### SampleDataService
**File:** `src/services/sampleDataService.ts`

Provides sample DICOM data for testing and development.

```typescript
interface SampleDataService {
  getSampleSeries(): Promise<DicomSeries[]>
  getSampleStudy(): Promise<DicomStudy>
  generateMockDicomData(): Promise<DicomData>
}
```

#### 2. Viewport Management

##### ViewportStateManager
**File:** `src/services/viewportStateManager.ts`

Manages viewport state with secure persistence and validation.

```typescript
class ViewportStateManager extends EventEmitter {
  createViewport(config: ViewportConfig): ViewportState
  updateViewportState(id: string, updates: ViewportStateUpdate): ViewportState
  getViewportState(id: string): ViewportState | null
  setActiveViewport(id: string): void
  setActiveTool(viewportId: string, toolName: string): void
}
```

**Events:**
- `state-changed`: Emitted when viewport state changes
- `viewport-activated`: Emitted when viewport becomes active
- `validation-error`: Emitted when state validation fails

##### ViewportOptimizer
**File:** `src/services/viewportOptimizer.ts`

Optimizes viewport performance with adaptive quality and frame rate control.

```typescript
interface OptimizationConfig {
  targetFrameRate: number;
  adaptiveQuality: boolean;
  memoryThreshold: number;
  enableProfiling: boolean;
}

class ViewportOptimizer {
  optimizeForViewports(viewportStates: ViewportState[]): void
  getPerformanceMetrics(): PerformanceMetrics
  setQualityLevel(level: QualityLevel): void
}
```

#### 3. Memory Management

##### MemoryManager
**File:** `src/services/memoryManager.ts`

Handles memory allocation and cleanup for DICOM data.

```typescript
class MemoryManager extends EventEmitter {
  allocateMemory(size: number, priority: Priority): MemoryBlock
  deallocateMemory(blockId: string): boolean
  cleanup(strategy: CleanupStrategy): void
  getMemoryStats(): MemoryStats
}
```

##### AdvancedMemoryManager
**File:** `src/services/AdvancedMemoryManager.ts`

Advanced memory management with pools and defragmentation.

```typescript
interface MemoryAllocationRequest {
  size: number;
  type: 'image' | 'volume' | 'annotation';
  priority: number;
  viewportId: string;
}

class AdvancedMemoryManager extends EventEmitter {
  allocateMemory(request: MemoryAllocationRequest): Promise<MemoryAllocationResult>
  defragmentMemory(): Promise<DefragmentationResult>
  compressMemory(blockId: string): Promise<boolean>
}
```

#### 4. Performance Optimization

##### EnhancedRenderingOptimizer
**File:** `src/services/EnhancedRenderingOptimizer.ts`

Viewport-level rendering optimization with Web Workers.

```typescript
interface RenderingOptimizationConfig {
  frameRateControl: {
    targetFPS: number;
    adaptiveFrameRate: boolean;
  };
  qualityControl: {
    enableAdaptiveQuality: boolean;
    baseQuality: number;
  };
  asyncRendering: {
    enabled: boolean;
    workerCount: number;
  };
}

class EnhancedRenderingOptimizer extends EventEmitter {
  optimizeRendering(activeViewportId: string, viewportStates: ViewportState[]): void
  setQualityLevel(viewportId: string, quality: number): void
  getOptimizationMetrics(): OptimizationMetrics
}
```

##### LazyLoadingManager
**File:** `src/services/LazyLoadingManager.ts`

Manages lazy loading of inactive viewport content.

```typescript
interface LazyLoadableResource {
  id: string;
  type: 'image' | 'texture' | 'mesh' | 'volume';
  viewportId: string;
  priority: number;
  loadState: 'unloaded' | 'loading' | 'loaded' | 'error';
}

class LazyLoadingManager extends EventEmitter {
  registerResource(id: string, type: string, viewportId: string): void
  loadResource(resourceId: string): Promise<any>
  optimizeForViewports(activeViewports: string[], visibleViewports: string[]): void
  prefetchResources(viewportIds: string[]): Promise<void>
}
```

##### SynchronizationOptimizer
**File:** `src/services/synchronizationOptimizer.ts`

Optimizes synchronization operations between viewports.

```typescript
interface SyncOperation {
  type: 'pan' | 'zoom' | 'window-level' | 'scroll' | 'crosshair';
  sourceViewportId: string;
  targetViewportIds: string[];
  priority: number;
  data: any;
}

class SynchronizationOptimizer extends EventEmitter {
  createSyncGroup(name: string, viewportIds: string[], syncTypes: string[]): string
  queueSyncOperation(operation: Omit<SyncOperation, 'id' | 'timestamp'>): string
  synchronizeViewports(sourceId: string, targetIds: string[], syncTypes: string[], data: any): Promise<boolean>
  optimizeForViewports(viewportStates: ViewportState[]): void
}
```

##### PerformanceMonitoringSystem
**File:** `src/services/PerformanceMonitoringSystem.ts`

Comprehensive performance monitoring and reporting.

```typescript
interface PerformanceSnapshot {
  timestamp: number;
  sessionId: string;
  metrics: {
    rendering: RenderingMetrics;
    memory: MemoryMetrics;
    synchronization: SynchronizationMetrics;
    lazyLoading: LazyLoadingMetrics;
    system: SystemMetrics;
  };
  issues: PerformanceIssue[];
  recommendations: PerformanceRecommendation[];
}

class PerformanceMonitoringSystem extends EventEmitter {
  captureSnapshot(): Promise<PerformanceSnapshot>
  generateReport(timeRange: TimeRange): Promise<PerformanceReport>
  startContinuousMonitoring(interval: number): void
  detectIssues(snapshot: PerformanceSnapshot): PerformanceIssue[]
}
```

#### 5. Series and Study Management

##### SeriesManagementService
**File:** `src/services/SeriesManagementService.ts`

Manages DICOM series loading and organization.

```typescript
interface SeriesManagementConfig {
  maxConcurrentLoads: number;
  cacheSize: number;
  preloadNextSeries: boolean;
}

class SeriesManagementService extends EventEmitter {
  loadSeries(seriesInstanceUID: string): Promise<DicomSeries>
  unloadSeries(seriesInstanceUID: string): void
  getSeriesMetadata(seriesInstanceUID: string): SeriesMetadata
  organizeSeriesByStudy(series: DicomSeries[]): Map<string, DicomSeries[]>
}
```

##### ViewportAssignmentManager
**File:** `src/services/ViewportAssignmentManager.ts`

Manages assignment of series to viewports.

```typescript
interface ViewportAssignmentConfig {
  maxViewports: number;
  allowMultipleAssignments: boolean;
  autoLoadSeries: boolean;
  validateAssignments: boolean;
}

class ViewportAssignmentManager extends EventEmitter {
  assignSeriesToViewport(viewportId: string, seriesInstanceUID: string): Promise<boolean>
  unassignSeriesFromViewport(viewportId: string): Promise<boolean>
  getViewportAssignments(): Map<string, SeriesAssignment>
  validateAssignment(viewportId: string, seriesInstanceUID: string): AssignmentValidationResult
}
```

#### 6. Synchronization Services

##### ViewportSynchronizer
**File:** `src/services/ViewportSynchronizer.ts`

Advanced viewport synchronization with cross-reference support.

```typescript
interface SynchronizationSettings {
  pan: boolean;
  zoom: boolean;
  windowLevel: boolean;
  scroll: boolean;
  crosshair: boolean;
}

class ViewportSynchronizer extends EventEmitter {
  synchronizeViewports(sourceId: string, targetIds: string[], settings: SynchronizationSettings): void
  enableCrossReference(viewportIds: string[]): void
  updateCrosshairPosition(position: { x: number; y: number; z: number }): void
}
```

#### 7. Migration System

##### MigrationSystem
**File:** `src/services/MigrationSystem.ts`

Handles data migration between application versions.

```typescript
interface Migration {
  id: string;
  fromVersion: string;
  toVersion: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  migrate: (data: any) => Promise<any>;
  validate?: (data: any) => Promise<boolean>;
}

class MigrationSystem extends EventEmitter {
  registerMigration(migration: Migration): void
  checkMigrationNeeded(): Promise<boolean>
  createMigrationPlan(fromVersion?: string): Promise<MigrationPlan>
  executeMigration(plan?: MigrationPlan): Promise<MigrationResult>
  rollbackMigration(backupId: string): Promise<boolean>
}
```

### Security Services

#### Authentication
**File:** `src/security/authentication.ts`

Medical-grade authentication with role-based permissions.

```typescript
interface UserCredentials {
  username: string;
  password: string;
  organizationId?: string;
  licenseKey?: string;
}

interface UserSession {
  userId: string;
  username: string;
  permissions: string[];
  roles: string[];
  sessionId: string;
  expiresAt: number;
}

class MedicalAuthentication {
  authenticate(credentials: UserCredentials): Promise<AuthenticationResult>
  validateSession(sessionId: string): Promise<SessionValidationResult>
  refreshSession(sessionId: string): Promise<UserSession>
  logout(sessionId: string): Promise<void>
}
```

#### Secure Storage
**File:** `src/security/secureStorage.ts`

Encrypted storage with compression and integrity validation.

```typescript
interface SecureStorageConfig {
  encryptionKey: string;
  compressionEnabled: boolean;
  integrityValidation: boolean;
  maxRetries: number;
}

class SecureStorage {
  store(key: string, data: string, options?: StorageOptions): Promise<void>
  retrieve(key: string): Promise<string | null>
  remove(key: string): Promise<boolean>
  clear(): Promise<void>
  getStorageStats(): StorageStats
}
```

### React Components

#### Core Components

##### DicomViewer
**File:** `src/components/DicomViewer/index.tsx`

Main DICOM viewer component with full feature set.

```typescript
interface DicomViewerProps {
  studyInstanceUID?: string;
  seriesInstanceUID?: string;
  imageIds?: string[];
  layout?: ViewportLayout;
  tools?: ToolConfig[];
  onImageLoad?: (image: DicomImage) => void;
  onError?: (error: Error) => void;
}

const DicomViewer: React.FC<DicomViewerProps>
```

##### LayoutSelector
**File:** `src/components/LayoutSelector/index.tsx`

Visual layout selector with keyboard shortcuts.

```typescript
interface LayoutSelectorProps {
  currentLayout: ViewportLayout;
  onLayoutChange: (layout: ViewportLayout) => void;
  disabled?: boolean;
}

const LayoutSelector: React.FC<LayoutSelectorProps>
```

##### ToolPanel
**File:** `src/components/ToolPanel/index.tsx`

Tool selection and configuration panel.

```typescript
interface ToolPanelProps {
  availableTools: ToolDefinition[];
  activeTool: string;
  onToolChange: (toolName: string) => void;
  onToolConfigChange: (toolName: string, config: any) => void;
}

const ToolPanel: React.FC<ToolPanelProps>
```

##### ViewportGrid
**File:** `src/components/ViewportGrid/index.tsx`

Responsive viewport grid with drag-and-drop support.

```typescript
interface ViewportGridProps {
  layout: ViewportLayout;
  viewportStates: ViewportState[];
  onViewportChange: (viewportId: string, state: Partial<ViewportState>) => void;
  onSeriesDrop?: (viewportId: string, seriesId: string) => void;
}

const ViewportGrid: React.FC<ViewportGridProps>
```

#### Study Management Components

##### SeriesBrowser
**File:** `src/components/SeriesBrowser/index.tsx`

Browse and select DICOM series with thumbnails.

```typescript
interface SeriesBrowserProps {
  studies: DicomStudy[];
  selectedSeries?: string[];
  onSeriesSelect: (seriesInstanceUID: string) => void;
  onSeriesLoad: (seriesInstanceUID: string, viewportId?: string) => void;
}

const SeriesBrowser: React.FC<SeriesBrowserProps>
```

##### StudyComparison
**File:** `src/components/StudyComparison/index.tsx`

Side-by-side study comparison with synchronization.

```typescript
interface StudyComparisonProps {
  primaryStudy: DicomStudy;
  comparisonStudy: DicomStudy;
  syncSettings: SynchronizationSettings;
  onSyncChange: (settings: SynchronizationSettings) => void;
}

const StudyComparison: React.FC<StudyComparisonProps>
```

### Utility Functions

#### Logger
**File:** `src/utils/logger.ts`

Structured logging with different levels and metadata support.

```typescript
interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  component?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

const log = {
  info(message: string, context?: LogContext, metadata?: any): void
  warn(message: string, context?: LogContext, metadata?: any): void
  error(message: string, context?: LogContext, error?: Error): void
}
```

## Usage Examples

### Basic DICOM Loading

```typescript
import { DicomViewer } from '@/components';

function App() {
  return (
    <DicomViewer
      seriesInstanceUID="1.2.3.4.5"
      layout="2x2"
      onImageLoad={(image) => console.log('Image loaded:', image)}
      onError={(error) => console.error('Loading failed:', error)}
    />
  );
}
```

### Advanced Viewport Management

```typescript
import { viewportStateManager, ViewportOptimizer } from '@/services';

// Create and configure viewport
const viewport = viewportStateManager.createViewport({
  element: document.getElementById('viewport'),
  viewportType: 'orthographic',
  background: [0, 0, 0],
});

// Optimize performance
const optimizer = new ViewportOptimizer({
  targetFrameRate: 60,
  adaptiveQuality: true,
  memoryThreshold: 0.8,
});

optimizer.optimizeForViewports([viewport]);
```

### Series Management

```typescript
import { seriesManagementService, viewportAssignmentManager } from '@/services';

// Load series
const series = await seriesManagementService.loadSeries('1.2.3.4.5');

// Assign to viewport
await viewportAssignmentManager.assignSeriesToViewport('viewport-1', '1.2.3.4.5');
```

### Performance Monitoring

```typescript
import { performanceMonitoringSystem } from '@/services';

// Start monitoring
performanceMonitoringSystem.startContinuousMonitoring(1000); // Every 1 second

// Listen for issues
performanceMonitoringSystem.on('issue-detected', (issue) => {
  console.warn('Performance issue detected:', issue);
});

// Generate performance report
const report = await performanceMonitoringSystem.generateReport({
  startTime: Date.now() - 3600000, // Last hour
  endTime: Date.now(),
});
```

### Migration System

```typescript
import { migrationSystem } from '@/services';

// Check if migration is needed
const needsMigration = await migrationSystem.checkMigrationNeeded();

if (needsMigration) {
  // Create migration plan
  const plan = await migrationSystem.createMigrationPlan();
  
  // Execute migration
  const result = await migrationSystem.executeMigration(plan);
  
  if (result.success) {
    console.log('Migration completed successfully');
  } else {
    console.error('Migration failed:', result.errors);
  }
}
```

## Error Handling

All services implement comprehensive error handling with structured error messages and recovery strategies.

```typescript
try {
  const image = await simpleDicomLoader.loadDicomImage('/path/to/dicom.dcm');
} catch (error) {
  if (error instanceof NetworkError) {
    // Handle network issues
    console.error('Network error:', error.message);
  } else if (error instanceof ValidationError) {
    // Handle validation issues
    console.error('Validation error:', error.details);
  } else {
    // Handle other errors
    console.error('Unexpected error:', error);
  }
}
```

## Performance Considerations

### Memory Management
- Use `MemoryManager` for efficient memory allocation
- Enable lazy loading for better performance
- Regular cleanup of unused resources

### Rendering Optimization
- Configure appropriate quality levels
- Use Web Workers for heavy operations
- Enable adaptive frame rate control

### Caching Strategy
- Configure cache sizes based on available memory
- Use LRU eviction policies
- Enable compression for stored data

## Security Best Practices

### Authentication
- Always validate user sessions
- Use secure credential storage
- Implement proper role-based access

### Data Protection
- Enable encryption for sensitive data
- Use secure communication channels
- Validate all user inputs

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Dependencies

### Core Dependencies
- React 18.2+
- TypeScript 5.2+
- Cornerstone3D 1.77+
- Lucide React (icons)
- Tailwind CSS (styling)

### Development Dependencies
- Vite (build tool)
- ESLint (linting)
- Vitest (testing)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines and contribution process.

## License

[License information]