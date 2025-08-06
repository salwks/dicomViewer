# ViewerState Migration Utility

## Overview

The ViewerState Migration Utility handles the conversion of legacy mode-based ViewerContext state to the new layout-based architecture. This migration is part of Task #63.3 and provides a safe, comprehensive way to migrate existing application state.

## Key Features

- **Safe Property Access**: Uses secure property access patterns to prevent Object Injection vulnerabilities
- **Comprehensive Validation**: Validates both input and output states
- **Error Handling**: Robust error handling with detailed reporting
- **Backup Support**: Integrated with the existing MigrationSystem for automatic backups
- **Edge Case Handling**: Gracefully handles missing data, invalid formats, and malformed state
- **Performance Tracking**: Records migration timing and performance metrics

## Migration Architecture

### From: Mode-Based Structure
```typescript
interface LegacyViewerMode {
  type: 'single' | 'comparison' | 'advanced';
  layout: '1x1' | '1x2' | '2x1' | '2x2';
  syncEnabled: boolean;
  crossReferenceEnabled: boolean;
}

interface LegacyViewerState {
  mode?: LegacyViewerMode;
  viewports?: LegacyViewportState[];
  activeViewportId?: string;
}
```

### To: Layout-Based Structure
```typescript
interface ViewerLayout {
  rows: number;
  cols: number;
}

interface ViewerState {
  layout: ViewerLayout;
  viewports: ViewportState[];
  activeViewportId: string | null;
  synchronization: SynchronizationState;
  tools: ToolState;
  isLoading: boolean;
  error: string | null;
}
```

## Usage

### Basic Migration
```typescript
import { ViewerStateMigration } from '../services/ViewerStateMigration';

const legacyState = {
  mode: {
    type: 'comparison',
    layout: '1x2',
    syncEnabled: true,
    crossReferenceEnabled: false,
  },
  viewports: [
    { id: 'viewport-1', studyInstanceUID: 'study-123', isActive: true },
    { id: 'viewport-2', studyInstanceUID: 'study-456', isActive: false },
  ],
  activeViewportId: 'viewport-1',
};

const result = ViewerStateMigration.migrate(legacyState);

if (result.success) {
  console.log('Migration successful:', result.migratedState);
} else {
  console.error('Migration failed:', result.errors);
}
```

### Migration with Custom Configuration
```typescript
import { ViewerStateMigration } from '../services/ViewerStateMigration';

const customMigration = new ViewerStateMigration({
  preserveViewportStates: true,
  defaultSynchronization: false,
  validateAfterMigration: true,
  logMigrationSteps: true,
});

const result = customMigration.migrateViewerState(legacyState);
```

### Using the Migration Helper
```typescript
import { viewerStateMigrationHelper } from '../utils/viewerStateMigrationHelper';

// Migration with automatic backup
const result = await viewerStateMigrationHelper.migrateWithBackup(legacyState);

if (result.success) {
  console.log('Migration completed with backup ID:', result.backupId);
} else if (result.backupId) {
  // Restore from backup if needed
  await viewerStateMigrationHelper.restoreFromBackup(result.backupId);
}
```

### System Integration
```typescript
import { migrationSystem } from '../services/MigrationSystem';

// Check if migration is needed
const migrationNeeded = await migrationSystem.checkMigrationNeeded();

if (migrationNeeded) {
  // Execute full system migration (includes ViewerState migration)
  const plan = await migrationSystem.createMigrationPlan();
  const result = await migrationSystem.executeMigration(plan);
}
```

## Migration Process

### Step 1: Extract Legacy Mode
- Safely extracts mode configuration from legacy state
- Provides default values for missing mode data
- Validates mode type and layout strings

### Step 2: Convert Layout
- Maps legacy layout strings to new ViewerLayout objects
- Uses predefined layouts for consistency
- Handles invalid layout strings gracefully

### Step 3: Migrate Viewports
- Converts legacy viewport states to new format
- Calculates viewport positions based on layout
- Creates default viewports if insufficient data exists
- Preserves study/series assignments where possible

### Step 4: Create Synchronization State
- Maps legacy syncEnabled flag to new synchronization structure
- Creates comprehensive synchronization settings
- Preserves cross-reference preferences

### Step 5: Generate Tool State
- Creates default tool configuration
- Attempts to preserve existing tool settings
- Provides fallback to standard tool set

### Step 6: Determine Active Viewport
- Preserves existing active viewport if valid
- Falls back to first active viewport
- Creates sensible defaults if no active viewport exists

### Step 7: Validation
- Validates migrated state structure
- Checks viewport count consistency
- Ensures position calculations are correct
- Verifies all required fields are present

## Error Handling

### Migration Errors
- **Invalid Input**: Handles null, undefined, or malformed legacy state
- **Validation Failures**: Provides detailed error messages for validation issues
- **Type Mismatches**: Safely handles unexpected data types
- **Missing Data**: Creates sensible defaults for missing required fields

### Security Considerations
- **Object Injection Prevention**: Uses safe property access throughout
- **Input Validation**: Validates all input data against expected schemas
- **Property Whitelisting**: Only processes known, safe properties
- **Circular Reference Handling**: Safely handles circular object references

## Configuration Options

```typescript
interface ViewerStateMigrationConfig {
  preserveViewportStates: boolean;    // Keep existing viewport data
  defaultSynchronization: boolean;    // Enable sync by default
  defaultActiveViewport: boolean;     // Always set an active viewport
  validateAfterMigration: boolean;    // Validate migrated state
  logMigrationSteps: boolean;        // Log detailed progress
}
```

## Migration Results

```typescript
interface ViewerStateMigrationResult {
  success: boolean;                   // Migration success status
  migratedState?: NewViewerState;     // Migrated state data
  errors: string[];                   // List of errors encountered
  warnings: string[];                 // List of warnings/issues
  preservedFields: string[];          // Fields successfully preserved
  droppedFields: string[];           // Fields that were dropped
  migrationTime: number;             // Migration duration in ms
}
```

## Integration with MigrationSystem

The ViewerState migration is automatically registered with the main MigrationSystem:

- **Migration ID**: `viewer-context-layout-migration-v1`
- **Version Range**: `1.0.0` → `1.1.0`
- **Priority**: `high`
- **Features**: Automatic backup, validation, rollback support

## Testing

Comprehensive test suite available at:
`src/services/__tests__/ViewerStateMigration.test.ts`

### Test Coverage
- Basic migration scenarios (single, comparison, quad layouts)
- Edge cases (missing data, invalid formats, malformed input)
- Security tests (malicious property access, circular references)
- Performance tests (large datasets, timing validation)
- Configuration tests (different config options)
- Integration tests (MigrationSystem integration)

## Performance Considerations

- **Fast Processing**: Optimized for sub-millisecond migration of typical state
- **Memory Efficient**: Minimal memory overhead during migration
- **Scalable**: Handles large viewport arrays efficiently
- **Non-blocking**: Async operations don't block UI thread

## Migration Statistics

During migration, the utility tracks:
- Number of viewports migrated
- Fields preserved vs. dropped
- Warnings generated
- Total migration time
- Retry attempts (if using helper)

## Troubleshooting

### Common Issues

1. **"No mode found in legacy state"**
   - Solution: Default single mode will be used
   - Impact: Minimal, creates 1x1 layout

2. **"Viewport count mismatch"** 
   - Solution: Additional default viewports created
   - Impact: Layout requirements are met

3. **"Invalid active viewport ID"**
   - Solution: First viewport becomes active
   - Impact: User may need to reselect active viewport

4. **"Migration validation failed"**
   - Check: Ensure migrated state structure is valid
   - Solution: Enable detailed logging for diagnosis

### Debugging

Enable detailed logging:
```typescript
const migration = new ViewerStateMigration({
  logMigrationSteps: true,
  validateAfterMigration: true,
});
```

### Recovery

If migration fails:
1. Check migration result errors array
2. Use backup if available via MigrationHelper
3. Fall back to default state creation
4. Report issue with detailed logs

## Future Enhancements

- **Reverse Migration**: Support for migrating back to legacy format
- **Partial Migration**: Migrate only specific state components  
- **Custom Validators**: Allow registration of custom validation rules
- **Migration Analytics**: Detailed statistics and reporting
- **Incremental Migration**: Support for streaming large state objects