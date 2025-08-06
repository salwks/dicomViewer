# Selection API Documentation

The Selection API provides a unified, high-level interface for managing annotation selections in the Cornerstone3D medical imaging viewer. It's built on top of the SelectionStateManager and AnnotationSelectionHandler components and follows shadcn/ui design patterns.

## Features

- ✅ **Unified Public API** - Single interface for all selection operations
- ✅ **Event-driven Architecture** - Real-time selection events
- ✅ **Bulk Operations** - Efficient handling of multiple selections
- ✅ **History Management** - Undo/redo functionality
- ✅ **State Persistence** - Save/restore selection states
- ✅ **Comprehensive Error Handling** - Robust error management
- ✅ **TypeScript Support** - Full type safety
- ✅ **Performance Optimized** - Batched operations for large datasets

## Quick Start

### Basic Usage

```typescript
import { selectionAPI } from '@/services/SelectionAPI';

// Select a single annotation
await selectionAPI.selectAnnotation('annotation-123', 'viewport-1');

// Select multiple annotations
await selectionAPI.selectMultipleAnnotations(['annotation-1', 'annotation-2', 'annotation-3'], 'viewport-1');

// Check if annotation is selected
const isSelected = selectionAPI.isAnnotationSelected('annotation-123', 'viewport-1');

// Get all selected annotations
const selected = selectionAPI.getSelectedAnnotationIds('viewport-1');

// Clear selections
selectionAPI.clearSelection('viewport-1');
```

### Event Handling

```typescript
// Listen for selection changes
selectionAPI.on('selection-changed', (selectedIds, viewportId) => {
  console.log(`Viewport ${viewportId} has ${selectedIds.length} selections`);
});

// Listen for individual annotation events
selectionAPI.on('annotation-selected', (annotation, viewportId) => {
  console.log('Annotation selected:', annotation.annotationId);
});

// Listen for bulk operation progress
selectionAPI.on('bulk-operation-progress', (completed, total) => {
  const progress = (completed / total) * 100;
  console.log(`Progress: ${progress}%`);
});

// Handle errors
selectionAPI.on('error', error => {
  console.error('Selection API error:', error.message);
});
```

## API Reference

### Core Methods

#### `selectAnnotation(annotationOrId, viewportId, options?)`

Select a single annotation.

**Parameters:**

- `annotationOrId`: `AnnotationCompat | string` - Annotation object or ID
- `viewportId`: `string` - Target viewport ID
- `options`: `SelectionOptions` - Optional configuration

**Returns:** `Promise<boolean>` - Success status

**Example:**

```typescript
// Select with default options
await selectionAPI.selectAnnotation('ann-123', 'viewport-1');

// Select while preserving existing selections
await selectionAPI.selectAnnotation('ann-123', 'viewport-1', {
  preserveExisting: true,
  validateAnnotation: true,
});
```

#### `deselectAnnotation(annotationOrId, viewportId, options?)`

Deselect a single annotation.

**Parameters:**

- `annotationOrId`: `AnnotationCompat | string` - Annotation object or ID
- `viewportId`: `string` - Target viewport ID
- `options`: `SelectionOptions` - Optional configuration

**Returns:** `Promise<boolean>` - Success status

#### `selectMultipleAnnotations(annotationsOrIds, viewportId, options?)`

Select multiple annotations in a single operation.

**Parameters:**

- `annotationsOrIds`: `(AnnotationCompat | string)[]` - Array of annotations or IDs
- `viewportId`: `string` - Target viewport ID
- `options`: `BulkSelectionOptions` - Bulk operation configuration

**Returns:** `Promise<{successful: number, failed: number}>` - Operation results

**Example:**

```typescript
const result = await selectionAPI.selectMultipleAnnotations(['ann-1', 'ann-2', 'ann-3'], 'viewport-1', {
  batchSize: 5,
  delayBetweenBatches: 100,
  onProgress: (completed, total) => {
    console.log(`Progress: ${completed}/${total}`);
  },
  onError: (error, annotationId) => {
    console.error(`Failed to select ${annotationId}:`, error.message);
  },
});

console.log(`Selected ${result.successful}, failed ${result.failed}`);
```

#### `deselectMultipleAnnotations(annotationsOrIds, viewportId, options?)`

Deselect multiple annotations in a single operation.

#### `clearSelection(viewportId, options?)`

Clear all selections in a specific viewport.

#### `clearAllSelections(options?)`

Clear all selections across all viewports.

### Query Methods

#### `isAnnotationSelected(annotationOrId, viewportId)`

Check if an annotation is currently selected.

**Returns:** `boolean`

#### `getSelectedAnnotationIds(viewportId)`

Get array of selected annotation IDs for a viewport.

**Returns:** `string[]`

#### `getSelectedAnnotations(viewportId)`

Get array of selected annotation objects for a viewport.

**Returns:** `AnnotationCompat[]`

#### `getSelectionCount(viewportId)`

Get the number of selected annotations in a viewport.

**Returns:** `number`

### History Methods

#### `undoLastSelection(viewportId)`

Undo the last selection operation in a viewport.

**Returns:** `boolean` - Success status

#### `getSelectionHistory(limit?)`

Get selection history entries.

**Parameters:**

- `limit`: `number` - Optional limit on number of entries

**Returns:** `ReadonlyArray<SelectionHistoryEntry>`

#### `clearSelectionHistory(viewportId?)`

Clear selection history for a viewport or all viewports.

### State Management

#### `saveSelectionState(viewportId)`

Save current selection state for persistence.

**Returns:** `string | null` - Serialized state or null if failed

#### `restoreSelectionState(viewportId, savedState)`

Restore selection state from saved data.

**Parameters:**

- `viewportId`: `string` - Target viewport ID
- `savedState`: `string` - Previously saved state

**Returns:** `boolean` - Success status

**Example:**

```typescript
// Save state
const savedState = selectionAPI.saveSelectionState('viewport-1');
localStorage.setItem('viewport-1-selections', savedState);

// Restore state later
const savedState = localStorage.getItem('viewport-1-selections');
if (savedState) {
  selectionAPI.restoreSelectionState('viewport-1', savedState);
}
```

### Statistics

#### `getStatistics()`

Get comprehensive selection statistics.

**Returns:** `SelectionStatistics`

```typescript
const stats = selectionAPI.getStatistics();
console.log(`Total selections: ${stats.totalSelections}`);
console.log(`Active viewports: ${stats.activeViewports}`);
console.log(`History entries: ${stats.historyEntries}`);
```

## Configuration

### SelectionAPIConfig

```typescript
interface SelectionAPIConfig {
  enableHistory: boolean; // Enable undo/redo functionality
  maxHistorySize: number; // Maximum history entries to keep
  enableValidation: boolean; // Validate annotations before operations
  enableEvents: boolean; // Emit events for operations
  defaultBatchSize: number; // Default batch size for bulk operations
  defaultDelay: number; // Default delay between batches (ms)
}
```

### Updating Configuration

```typescript
selectionAPI.updateConfig({
  enableHistory: true,
  maxHistorySize: 50,
  defaultBatchSize: 20,
});
```

## Events

### Available Events

- `selection-changed`: Fired when selection changes
- `annotation-selected`: Fired when annotation is selected
- `annotation-deselected`: Fired when annotation is deselected
- `selection-cleared`: Fired when selections are cleared
- `bulk-operation-progress`: Fired during bulk operations
- `selection-restored`: Fired when state is restored
- `error`: Fired when errors occur

### Event Handler Examples

```typescript
// Selection change handler
selectionAPI.on('selection-changed', (selectedIds: string[], viewportId: string) => {
  updateUI(selectedIds, viewportId);
});

// Error handler with UI feedback
selectionAPI.on('error', (error: Error) => {
  showErrorNotification(error.message);
});

// Progress indicator for bulk operations
selectionAPI.on('bulk-operation-progress', (completed: number, total: number) => {
  updateProgressBar((completed / total) * 100);
});
```

## Integration Examples

### React Component Integration

```typescript
import React, { useEffect, useState } from 'react';
import { selectionAPI } from '@/services/SelectionAPI';

const AnnotationPanel: React.FC = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Listen for selection changes
    const handleSelectionChange = (ids: string[], viewportId: string) => {
      setSelectedIds(ids);
    };

    // Listen for bulk operation progress
    const handleProgress = (completed: number, total: number) => {
      if (completed === total) {
        setIsLoading(false);
      }
    };

    selectionAPI.on('selection-changed', handleSelectionChange);
    selectionAPI.on('bulk-operation-progress', handleProgress);

    return () => {
      selectionAPI.off('selection-changed', handleSelectionChange);
      selectionAPI.off('bulk-operation-progress', handleProgress);
    };
  }, []);

  const handleSelectAll = async () => {
    setIsLoading(true);
    const allAnnotationIds = getAllAnnotationIds(); // Your implementation
    await selectionAPI.selectMultipleAnnotations(allAnnotationIds, 'viewport-1');
  };

  const handleClearSelection = () => {
    selectionAPI.clearSelection('viewport-1');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={handleSelectAll} disabled={isLoading}>
          Select All
        </Button>
        <Button onClick={handleClearSelection} variant="outline">
          Clear Selection
        </Button>
      </div>
      <div>Selected: {selectedIds.length} annotations</div>
    </div>
  );
};
```

### Vue.js Integration

```typescript
import { defineComponent, ref, onMounted, onUnmounted } from 'vue';
import { selectionAPI } from '@/services/SelectionAPI';

export default defineComponent({
  setup() {
    const selectedCount = ref(0);
    const isOperating = ref(false);

    const handleSelectionChange = (selectedIds: string[]) => {
      selectedCount.value = selectedIds.length;
    };

    const handleBulkProgress = (completed: number, total: number) => {
      isOperating.value = completed < total;
    };

    onMounted(() => {
      selectionAPI.on('selection-changed', handleSelectionChange);
      selectionAPI.on('bulk-operation-progress', handleBulkProgress);
    });

    onUnmounted(() => {
      selectionAPI.off('selection-changed', handleSelectionChange);
      selectionAPI.off('bulk-operation-progress', handleBulkProgress);
    });

    return {
      selectedCount,
      isOperating,
      selectAll: () => selectionAPI.selectMultipleAnnotations(getAllIds(), 'viewport-1'),
      clearAll: () => selectionAPI.clearSelection('viewport-1'),
      undo: () => selectionAPI.undoLastSelection('viewport-1'),
    };
  },
});
```

## Error Handling

### Common Error Scenarios

1. **Invalid Annotation ID**: When annotation doesn't exist
2. **Viewport Not Found**: When viewport ID is invalid
3. **API Not Initialized**: When using API before initialization
4. **Operation Failed**: When underlying selection operation fails

### Error Handling Patterns

```typescript
// Basic error handling
try {
  await selectionAPI.selectAnnotation('invalid-id', 'viewport-1');
} catch (error) {
  console.error('Selection failed:', error.message);
}

// Event-based error handling
selectionAPI.on('error', error => {
  switch (error.message) {
    case 'Annotation not found':
      showNotification('Annotation no longer exists', 'warning');
      break;
    case 'Selection API is not initialized':
      initializeAPI();
      break;
    default:
      showNotification('Selection operation failed', 'error');
  }
});

// Bulk operation error handling
await selectionAPI.selectMultipleAnnotations(ids, 'viewport-1', {
  onError: (error, annotationId) => {
    console.warn(`Failed to select ${annotationId}: ${error.message}`);
    // Continue with other annotations
  },
});
```

## Performance Considerations

### Batch Size Optimization

```typescript
// For large datasets, optimize batch size
selectionAPI.updateConfig({
  defaultBatchSize: 50, // Larger batches for better performance
  defaultDelay: 10, // Shorter delays
});

// For UI responsiveness, use smaller batches
selectionAPI.updateConfig({
  defaultBatchSize: 5, // Smaller batches
  defaultDelay: 100, // Longer delays for UI updates
});
```

### Memory Management

```typescript
// Limit history size for memory efficiency
selectionAPI.updateConfig({
  maxHistorySize: 50, // Keep last 50 operations only
});

// Clear history periodically
setInterval(
  () => {
    selectionAPI.clearSelectionHistory();
  },
  5 * 60 * 1000
); // Every 5 minutes
```

## Best Practices

1. **Always handle errors** - Use try/catch or event handlers
2. **Use bulk operations** - For selecting multiple annotations
3. **Optimize batch sizes** - Based on your use case
4. **Listen for events** - Keep UI in sync with selection state
5. **Validate inputs** - Enable validation in production
6. **Cleanup listeners** - Remove event listeners when components unmount
7. **Use TypeScript** - Leverage full type safety

## Troubleshooting

### Common Issues

**Q: Selections aren't being highlighted visually**
A: Check that the AnnotationSelectionHandler is properly initialized and connected to your viewport elements.

**Q: Bulk operations are slow**
A: Increase the batch size and decrease delays in the configuration.

**Q: Events aren't firing**
A: Ensure `enableEvents` is true in the configuration.

**Q: Undo functionality not working**
A: Check that `enableHistory` is true and history isn't full.

**Q: TypeScript errors with annotation objects**
A: Ensure your annotation objects implement the `AnnotationCompat` interface.

For additional support, check the implementation details in:

- `src/services/SelectionAPI.ts`
- `src/services/SelectionStateManager.ts`
- `src/services/AnnotationSelectionHandler.ts`
