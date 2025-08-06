# Architecture Dependencies Analysis

## Current Dependency Structure

```
src/
├── types/                           # Level 0 - Pure Types
│   ├── tools.ts                     # ToolType, ToolCategory, utility functions
│   ├── index.ts                     # Main types
│   └── viewportState.ts             # Viewport and tool states
│
├── utils/                           # Level 1 - Pure Utilities
│   ├── logger.ts                    # Logging system
│   └── ...
│
├── services/                        # Level 2 - Business Logic
│   ├── ToolStateManager.ts          # → types/tools, utils/logger
│   ├── ToolVerificationFramework.ts
│   ├── MeasurementToolCompatibility.ts
│   └── NavigationToolCompatibility.ts
│
├── context/                         # Level 3 - State Management
│   └── ViewerContext.tsx            # → types/tools, services/ToolStateManager
│
├── components/                      # Level 4 - UI Components
│   ├── ui/                          # Reusable UI primitives
│   ├── ToolPanel/
│   │   ├── constants.ts             # → types/tools (re-export)
│   │   └── index.tsx                # → types/tools, context/ViewerContext
│   └── ...
│
└── App.tsx                          # Level 5 - Application Entry
```

## Dependency Rules

### ✅ Good Dependencies (Following the flow)
- `types/` → nothing (pure types)
- `utils/` → nothing (pure utilities) 
- `services/` → `types/`, `utils/`
- `context/` → `types/`, `utils/`, `services/`
- `components/` → `types/`, `utils/`, `context/`, `components/ui/`
- `App.tsx` → `components/`

### ❌ Bad Dependencies (Avoided)
- `types/` → anything else
- `services/` → `context/`, `components/`
- `context/` → `components/`

## Tool State Management Architecture

### Core Components
1. **ToolStateManager** (Service Layer)
   - Central business logic for tool state
   - Integrates with verification frameworks
   - No UI dependencies

2. **ViewerContext** (Context Layer) 
   - React state management wrapper
   - Bridges ToolStateManager with React components
   - Provides hooks for components

3. **ToolPanel** (Component Layer)
   - UI component for tool selection
   - Uses ViewerContext hooks
   - Backward compatible with prop-based API

### Modularity Benefits
- **Testability**: Each layer can be tested independently
- **Reusability**: ToolStateManager can be used without React
- **Maintainability**: Clear separation of concerns
- **Type Safety**: Shared types prevent inconsistencies

## Integration Points

### ToolStateManager ↔ ViewerContext
```typescript
// ViewerContext acts as React adapter
const setActiveTool = useCallback((viewportId: string, toolName: string) => {
  toolStateManager.setActiveTool(viewportId, toolName);
  dispatch({ type: 'SET_ACTIVE_TOOL', payload: { viewportId, toolName } });
}, []);
```

### ViewerContext ↔ Components
```typescript
// Components use clean hook API
const { activeTool, setActiveTool } = useViewportTools(viewportId);
```

### Verification Framework Integration
```typescript
// ToolStateManager coordinates verification services
const result = await Promise.all([
  toolVerificationFramework.verifyToolGroup(toolGroupId),
  measurementCompatibility.verifyAllMeasurementTools(toolGroupId),
  navigationCompatibility.verifyAllNavigationTools(toolGroupId),
]);
```

This architecture ensures clean separation, testability, and maintainability while supporting the medical-grade requirements of the DICOM viewer.