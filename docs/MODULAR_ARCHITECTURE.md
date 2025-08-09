# Modular Architecture Guide

## Overview

The new modular architecture separates functionality into independent, loosely coupled modules that communicate through well-defined interfaces.

## Architecture Benefits

### 1. **Separation of Concerns**
- Each module handles a specific domain (viewer, DICOM loading, tools, etc.)
- Clear boundaries between different functionalities
- Easier to understand and maintain

### 2. **Loose Coupling**
- Modules communicate through events and interfaces
- Dependencies are injected, not hard-coded
- Easy to replace or upgrade individual modules

### 3. **Extensibility**
- New modules can be added without modifying existing code
- Plugins can hook into the event system
- Third-party integrations are simplified

### 4. **Testability**
- Each module can be tested in isolation
- Mock implementations are easy to create
- Integration tests can focus on module interactions

## Module Structure

```
src/modules/
├── viewer-core/          # Core viewer functionality
│   ├── ViewerEngine.ts   # Manages rendering engine and viewports
│   ├── types.ts          # Type definitions
│   └── index.ts          # Module exports
├── dicom-loader/         # DICOM file handling
│   ├── DicomLoader.ts    # Loads and organizes DICOM files
│   ├── types.ts          # Type definitions
│   └── index.ts          # Module exports
├── tools/                # Annotation and measurement tools
├── annotations/          # Annotation management
├── synchronization/      # Viewport synchronization
└── layout/              # Layout management
```

## Core Modules

### ViewerEngine
Manages the Cornerstone3D rendering engine and viewport lifecycle.

```typescript
const viewerEngine = new ViewerEngine({
  renderingEngineId: 'my-engine',
  viewportIdPrefix: 'viewport',
});

await viewerEngine.initialize();
await viewerEngine.createViewport({
  viewportId: 'viewport-1',
  element: divElement,
  viewportType: ViewportType.STACK,
});
```

### DicomLoader
Handles DICOM file loading and organization into studies/series.

```typescript
const dicomLoader = new DicomLoader({
  maxConcurrentLoads: 4,
  enableCaching: true,
});

const studies = await dicomLoader.loadFiles(fileArray);
const series = dicomLoader.getSeries(studyUID, seriesUID);
```

### ModuleManager
Coordinates modules and provides high-level operations.

```typescript
const moduleManager = new ModuleManager({
  viewer: { renderingEngineId: 'main-engine' },
  dicomLoader: { enableCaching: true },
});

await moduleManager.initialize();
await moduleManager.loadAndDisplayDicom(files, viewportId);
```

## React Integration

### ModuleProvider
Provides module access throughout the React component tree.

```typescript
<ModuleProvider config={moduleConfig}>
  <App />
</ModuleProvider>
```

### Hooks
Access modules from React components:

```typescript
const { moduleManager, isInitialized } = useModuleManager();
const viewerEngine = useViewerEngine();
const dicomLoader = useDicomLoader();
```

## Migration Guide

### Step 1: Identify Current Usage
Find components that directly use Cornerstone3D or DICOM loading.

### Step 2: Replace Direct Usage
Instead of:
```typescript
// Old way
const renderingEngine = new RenderingEngine(engineId);
renderingEngine.enableElement(viewportInput);
```

Use:
```typescript
// New way
const viewerEngine = useViewerEngine();
await viewerEngine.createViewport(config);
```

### Step 3: Update Event Handling
Replace direct event listeners with module events:

```typescript
// Old way
element.addEventListener('cornerstoneimagerendered', handler);

// New way
viewerEngine.on('viewport:rendered', handler);
```

### Step 4: Gradual Migration
1. Start with new features using the modular system
2. Migrate existing features one at a time
3. Keep both systems running during transition
4. Remove old code once migration is complete

## Best Practices

1. **Use Module Interfaces**: Always interact through module interfaces, not implementation details
2. **Event-Driven Communication**: Use events for loose coupling between modules
3. **Dependency Injection**: Pass dependencies through constructors or providers
4. **Single Responsibility**: Each module should have one clear purpose
5. **Documentation**: Document module interfaces and events clearly

## Example: Adding a New Module

```typescript
// 1. Define types
export interface MyModuleConfig {
  option1: string;
  option2?: number;
}

export interface MyModuleEvents {
  'module:ready': void;
  'module:error': { error: Error };
}

// 2. Create module class
export class MyModule extends EventEmitter<MyModuleEvents> {
  constructor(private config: MyModuleConfig) {
    super();
  }

  async initialize(): Promise<void> {
    // Module initialization
    this.emit('module:ready');
  }
}

// 3. Add to ModuleManager
class ModuleManager {
  private myModule: MyModule;
  
  constructor(config: ModuleManagerConfig) {
    this.myModule = new MyModule(config.myModule);
  }
}

// 4. Create React hook
export const useMyModule = () => {
  const { moduleManager } = useModuleManager();
  return moduleManager.getMyModule();
};
```

## Future Enhancements

1. **Plugin System**: Allow third-party plugins to register with modules
2. **Module Hot Reloading**: Support module updates without full reload
3. **Module Versioning**: Handle multiple versions of modules
4. **Performance Monitoring**: Track module performance metrics
5. **Module Marketplace**: Share and discover community modules