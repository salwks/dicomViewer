# Services Module - Barrel Exports

This module provides a comprehensive barrel export system for all medical imaging services, designed for clean imports, tree-shaking support, and optimal developer experience.

## Usage Examples

### Basic Service Imports

```typescript
// Clean, single import statement
import { 
  CornerstoneService, 
  ErrorManager, 
  AdvancedDICOMLoader,
  measurementOrchestrator 
} from './services';

// Instead of multiple import statements:
// import { CornerstoneService } from './services/cornerstoneService';
// import { ErrorManager } from './services/errorManager';
// import { AdvancedDICOMLoader } from './services/advancedDicomLoader';
// import { measurementOrchestrator } from './services/measurement';
```

### Service Bundles for Common Use Cases

```typescript
import { 
  essentialServices,
  dicomServiceBundle,
  annotationServiceBundle,
  exportServiceBundle 
} from './services';

// Essential services for basic medical imaging
const { CornerstoneService, ErrorManager, PerformanceOptimizer } = essentialServices;

// Complete DICOM handling setup
const { 
  AdvancedDICOMLoader, 
  MetadataManager, 
  SOPClassHandler 
} = dicomServiceBundle;

// Annotation workflow
const { 
  AnnotationImportService, 
  AnnotationPersistenceService 
} = annotationServiceBundle;
```

### Type Imports

```typescript
import type { 
  Point2,
  Point3,
  MeasurementMetadata,
  Segmentation,
  DICOMLoaderConfig 
} from './services';
```

### Specific Module Imports (Tree-shakable)

```typescript
// Import only what you need - fully tree-shakable
import { BrushTool, ThresholdTool } from './services';
import { LinearCalculator, AreaCalculator } from './services';
import { DicomSRExporter } from './services';
```

## Service Categories

### Core Services
- `CornerstoneService` - Main Cornerstone3D integration
- `ErrorManager` - Centralized error handling
- `PerformanceOptimizer` - Performance monitoring
- `UndoRedoManager` - Action history management

### DICOM Services
- `AdvancedDICOMLoader` - High-performance DICOM loading
- `MetadataManager` - DICOM metadata extraction
- `SOPClassHandler` - SOP class validation
- `WADOProtocolHandler` - WADO protocol support
- `ProgressiveLoader` - Progressive image loading

### Measurement Services
- `measurementOrchestrator` - Main measurement coordination
- `MeasurementCalculator` - Legacy measurement calculations
- `MeasurementManager` - Measurement lifecycle management
- Individual calculators: `LinearCalculator`, `AreaCalculator`, `VolumeCalculator`, etc.

### Segmentation Services
- `SegmentationManager` - Main segmentation coordination
- `SegmentationToolkit` - Complete toolkit for convenience
- Individual tools: `BrushTool`, `ThresholdTool`, `RegionGrowingTool`, etc.
- `SegmentationVisualizer` - Visualization support

### Annotation Services
- `AnnotationImportService` - Import annotations from various formats
- `AnnotationPersistenceService` - Annotation storage and retrieval
- `AnnotationPersistenceManager` - Lifecycle management

### Export Services
- `DicomSRExporter` - DICOM Structured Report export
- `PDFExportService` - PDF report generation

### Persistence Services
- `ViewportPersistenceService` - Viewport state persistence

## Service Information and Utilities

```typescript
import { getServiceInfo, getModuleInfo, serviceDependencies } from './services';

// Get information about available services
const serviceInfo = getServiceInfo();
console.log(serviceInfo.core); // ['CornerstoneService', 'ErrorManager', ...]

// Get module version and build information
const moduleInfo = getModuleInfo();
console.log(`${moduleInfo.name} v${moduleInfo.version}`);

// Check service dependencies
console.log(serviceDependencies.AdvancedDICOMLoader); 
// ['ErrorManager', 'MetadataManager', 'SOPClassHandler']
```

## Migration Guide

### From Individual Imports
```typescript
// Old way
import { CornerstoneService } from '../services/cornerstoneService';
import { ErrorManager } from '../services/errorManager';
import { measurementOrchestrator } from '../services/measurement';

// New way
import { 
  CornerstoneService, 
  ErrorManager, 
  measurementOrchestrator 
} from '../services';
```

### From Direct Service Paths
```typescript
// Old way
import { BrushTool } from '../services/segmentation/tools/BrushTool';
import { ThresholdTool } from '../services/segmentation/tools/ThresholdTool';

// New way
import { BrushTool, ThresholdTool } from '../services';
```

## Tree-Shaking Benefits

The barrel export system is designed to be fully tree-shakable:

```typescript
// Only BrushTool code will be included in the final bundle
import { BrushTool } from './services';

// Service bundles are marked with 'as const' for optimal tree-shaking
import { essentialServices } from './services';
const { ErrorManager } = essentialServices; // Only ErrorManager code included
```

## Performance Considerations

- **Individual exports**: Use for specific functionality to minimize bundle size
- **Service bundles**: Use for common workflows where multiple related services are needed
- **Type imports**: Always use `import type` for TypeScript types to ensure they're stripped from runtime builds
- **Lazy loading**: Consider dynamic imports for large service modules in non-critical paths

## Architecture

The barrel export system maintains the existing modular architecture while providing convenient access patterns:

- Each service module (`/dicom/`, `/measurement/`, `/segmentation/`) maintains its own `index.ts`
- The root `/services/index.ts` provides the main barrel export
- No circular dependencies - clear dependency hierarchy is maintained
- Legacy exports are preserved for backward compatibility