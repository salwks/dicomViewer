/**
 * Viewer State Migration Utility
 * Migrates mode-based ViewerContext state to layout-based structure
 * Built with security compliance and safe property access patterns
 */

import { log } from '../utils/logger';
import { safePropertyAccess, safePropertySet } from '../lib/utils';

// Legacy mode-based interfaces (from old viewer.ts)
interface LegacyViewerMode {
  type: 'single' | 'comparison' | 'advanced';
  layout: '1x1' | '1x2' | '2x1' | '2x2';
  syncEnabled: boolean;
  crossReferenceEnabled: boolean;
}

interface LegacyViewportState {
  id: string;
  studyInstanceUID?: string;
  seriesInstanceUID?: string;
  imageIndex: number;
  zoom: number;
  pan: { x: number; y: number };
  windowLevel: { window: number; level: number };
  rotation: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  isActive: boolean;
}

interface LegacyViewerState {
  mode?: LegacyViewerMode;
  viewports?: LegacyViewportState[];
  activeViewportId?: string;
  // Additional legacy fields
  [key: string]: unknown;
}

// New layout-based interfaces (from viewerLayout.ts)
import {
  ViewerState as NewViewerState,
  ViewerLayout,
  ViewportState as NewViewportState,
  ViewportPosition,
  SynchronizationState,
  ToolState,
  PREDEFINED_LAYOUTS,
} from '../types/viewerLayout';

/**
 * Migration configuration options
 */
export interface ViewerStateMigrationConfig {
  preserveViewportStates: boolean;
  defaultSynchronization: boolean;
  defaultActiveViewport: boolean;
  validateAfterMigration: boolean;
  logMigrationSteps: boolean;
}

/**
 * Migration result information
 */
export interface ViewerStateMigrationResult {
  success: boolean;
  migratedState?: NewViewerState;
  errors: string[];
  warnings: string[];
  preservedFields: string[];
  droppedFields: string[];
  migrationTime: number;
}

/**
 * Default migration configuration
 */
export const DEFAULT_MIGRATION_CONFIG: ViewerStateMigrationConfig = {
  preserveViewportStates: true,
  defaultSynchronization: false,
  defaultActiveViewport: true,
  validateAfterMigration: true,
  logMigrationSteps: true,
};

/**
 * Safe property access whitelist for legacy state
 * Currently used for documentation but can be extended for runtime validation
 */
const ALLOWED_LEGACY_PROPERTIES = new Set([
  'mode',
  'viewports',
  'activeViewportId',
  'synchronization',
  'tools',
  'studyData',
  'userPreferences',
  'lastModified',
  'version',
]);

/**
 * Safe property access whitelist for viewport state
 * Currently used for documentation but can be extended for runtime validation
 */
const ALLOWED_VIEWPORT_PROPERTIES = new Set([
  'id',
  'studyInstanceUID',
  'seriesInstanceUID',
  'imageIndex',
  'zoom',
  'pan',
  'windowLevel',
  'rotation',
  'flipHorizontal',
  'flipVertical',
  'isActive',
]);

/**
 * Validate property access against whitelist (future enhancement)
 */
export function isAllowedLegacyProperty(property: string): boolean {
  return ALLOWED_LEGACY_PROPERTIES.has(property);
}

/**
 * Validate viewport property access against whitelist (future enhancement)
 */
export function isAllowedViewportProperty(property: string): boolean {
  return ALLOWED_VIEWPORT_PROPERTIES.has(property);
}

/**
 * ViewerState Migration Utility Class
 */
export class ViewerStateMigration {
  private config: ViewerStateMigrationConfig;

  constructor(config: Partial<ViewerStateMigrationConfig> = {}) {
    this.config = { ...DEFAULT_MIGRATION_CONFIG, ...config };
  }

  /**
   * Main migration method: converts legacy state to new layout-based structure
   */
  public migrateViewerState(legacyState: LegacyViewerState): ViewerStateMigrationResult {
    const startTime = Date.now();
    const result: ViewerStateMigrationResult = {
      success: false,
      errors: [],
      warnings: [],
      preservedFields: [],
      droppedFields: [],
      migrationTime: 0,
    };

    try {
      if (this.config.logMigrationSteps) {
        log.info('Starting viewer state migration', {
          component: 'ViewerStateMigration',
          metadata: { legacyStateKeys: Object.keys(legacyState) },
        });
      }

      // Step 1: Extract and validate legacy mode
      const legacyMode = this.extractLegacyMode(legacyState, result);
      if (!legacyMode) {
        result.errors.push('Failed to extract valid legacy mode from state');
        return this.finalizeResult(result, startTime);
      }

      // Step 2: Convert layout string to ViewerLayout object
      const newLayout = this.convertLayoutToViewerLayout(legacyMode.layout, result);
      if (!newLayout) {
        result.errors.push('Failed to convert legacy layout to new format');
        return this.finalizeResult(result, startTime);
      }

      // Step 3: Migrate viewport states
      const newViewports = this.migrateViewportStates(legacyState, newLayout, result);

      // Step 4: Create synchronization state
      const synchronizationState = this.createSynchronizationState(legacyMode, result);

      // Step 5: Create tool state
      const toolState = this.createToolState(legacyState, result);

      // Step 6: Determine active viewport
      const activeViewportId = this.determineActiveViewport(legacyState, newViewports, result);

      // Step 7: Assemble new state
      const migratedState: NewViewerState = {
        layout: newLayout,
        viewports: newViewports,
        activeViewportId,
        synchronization: synchronizationState,
        tools: toolState,
        isLoading: false,
        error: null,
      };

      // Step 8: Validation
      if (this.config.validateAfterMigration) {
        const validationResult = this.validateMigratedState(migratedState, result);
        if (!validationResult) {
          result.errors.push('Migration validation failed');
          return this.finalizeResult(result, startTime);
        }
      }

      result.migratedState = migratedState;
      result.success = true;

      if (this.config.logMigrationSteps) {
        log.info('Viewer state migration completed successfully', {
          component: 'ViewerStateMigration',
          metadata: {
            viewportsCount: newViewports.length,
            layout: newLayout,
            preservedFields: result.preservedFields,
            warnings: result.warnings.length,
          },
        });
      }

      return this.finalizeResult(result, startTime);
    } catch (error) {
      result.errors.push(`Migration failed: ${(error as Error).message}`);
      log.error(
        'Viewer state migration error',
        {
          component: 'ViewerStateMigration',
          metadata: { error: (error as Error).message },
        },
        error as Error,
      );
      return this.finalizeResult(result, startTime);
    }
  }

  /**
   * Extract legacy mode from state with safe property access
   */
  private extractLegacyMode(
    legacyState: LegacyViewerState,
    result: ViewerStateMigrationResult,
  ): LegacyViewerMode | null {
    const mode = safePropertyAccess(legacyState, 'mode');

    if (!mode || typeof mode !== 'object') {
      // Create default mode if none exists
      result.warnings.push('No mode found in legacy state, using default single mode');
      return {
        type: 'single',
        layout: '1x1',
        syncEnabled: false,
        crossReferenceEnabled: false,
      };
    }

    const legacyMode = mode as LegacyViewerMode;

    // Validate mode properties
    const validTypes = ['single', 'comparison', 'advanced'];
    const validLayouts = ['1x1', '1x2', '2x1', '2x2'];

    if (!validTypes.includes(legacyMode.type)) {
      result.warnings.push(`Invalid mode type '${legacyMode.type}', defaulting to 'single'`);
      legacyMode.type = 'single';
    }

    if (!validLayouts.includes(legacyMode.layout)) {
      result.warnings.push(`Invalid layout '${legacyMode.layout}', defaulting to '1x1'`);
      legacyMode.layout = '1x1';
    }

    result.preservedFields.push('mode');
    return legacyMode;
  }

  /**
   * Convert legacy layout string to ViewerLayout object
   */
  private convertLayoutToViewerLayout(
    legacyLayout: string,
    result: ViewerStateMigrationResult,
  ): ViewerLayout | null {
    const layoutMap: Record<string, ViewerLayout> = {
      '1x1': PREDEFINED_LAYOUTS.SINGLE,
      '1x2': PREDEFINED_LAYOUTS.SIDE_BY_SIDE,
      '2x1': PREDEFINED_LAYOUTS.STACK_VERTICAL,
      '2x2': PREDEFINED_LAYOUTS.QUAD,
    };

    const newLayout = safePropertyAccess(layoutMap, legacyLayout);
    if (!newLayout) {
      result.warnings.push(`Unknown legacy layout '${legacyLayout}', using default single layout`);
      return PREDEFINED_LAYOUTS.SINGLE;
    }

    result.preservedFields.push('layout');
    return newLayout;
  }

  /**
   * Migrate viewport states from legacy format to new format
   */
  private migrateViewportStates(
    legacyState: LegacyViewerState,
    layout: ViewerLayout,
    result: ViewerStateMigrationResult,
  ): NewViewportState[] {
    const legacyViewports = safePropertyAccess(legacyState, 'viewports');
    const expectedViewports = layout.rows * layout.cols;
    const migratedViewports: NewViewportState[] = [];

    if (!Array.isArray(legacyViewports)) {
      result.warnings.push('No viewports array found in legacy state, creating default viewports');
      return this.createDefaultViewports(layout);
    }

    // Migrate existing viewports
    for (let i = 0; i < Math.min(legacyViewports.length, expectedViewports); i++) {
      const legacyViewport = safePropertyAccess(legacyViewports, i);
      if (!legacyViewport || typeof legacyViewport !== 'object') {
        continue;
      }

      const position = this.calculateViewportPosition(i, layout);
      const migratedViewport = this.migrateIndividualViewport(
        legacyViewport as LegacyViewportState,
        position,
        result,
      );

      if (migratedViewport) {
        migratedViewports.push(migratedViewport);
      }
    }

    // Create additional viewports if needed
    if (migratedViewports.length < expectedViewports) {
      const additionalViewports = this.createDefaultViewports(layout, migratedViewports.length);
      migratedViewports.push(...additionalViewports);
      result.warnings.push(`Created ${additionalViewports.length} additional default viewports`);
    }

    result.preservedFields.push('viewports');
    return migratedViewports;
  }

  /**
   * Migrate individual viewport state
   */
  private migrateIndividualViewport(
    legacyViewport: LegacyViewportState,
    position: ViewportPosition,
    result: ViewerStateMigrationResult,
  ): NewViewportState | null {
    try {
      const id = safePropertyAccess(legacyViewport, 'id');
      if (typeof id !== 'string') {
        result.warnings.push('Viewport missing ID, skipping');
        return null;
      }

      const migratedViewport: NewViewportState = {
        id,
        position,
        isActive: Boolean(safePropertyAccess(legacyViewport, 'isActive')),
      };

      // Migrate optional fields with safe property access
      const studyInstanceUID = safePropertyAccess(legacyViewport, 'studyInstanceUID');
      if (typeof studyInstanceUID === 'string') {
        safePropertySet(migratedViewport, 'studyInstanceUID', studyInstanceUID);
      }

      const seriesInstanceUID = safePropertyAccess(legacyViewport, 'seriesInstanceUID');
      if (typeof seriesInstanceUID === 'string') {
        safePropertySet(migratedViewport, 'seriesInstanceUID', seriesInstanceUID);
      }

      // Note: Some legacy fields like imageIndex, zoom, pan, windowLevel, rotation, flip states
      // are not part of the new ViewportState interface as they're managed by Cornerstone3D directly
      result.droppedFields.push('imageIndex', 'zoom', 'pan', 'windowLevel', 'rotation', 'flipHorizontal', 'flipVertical');

      return migratedViewport;
    } catch (error) {
      result.warnings.push(`Failed to migrate viewport: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Calculate viewport position from index and layout
   */
  private calculateViewportPosition(index: number, layout: ViewerLayout): ViewportPosition {
    const row = Math.floor(index / layout.cols);
    const col = index % layout.cols;
    return { row, col };
  }

  /**
   * Create default viewports for layout
   */
  private createDefaultViewports(layout: ViewerLayout, startIndex: number = 0): NewViewportState[] {
    const viewports: NewViewportState[] = [];
    const totalViewports = layout.rows * layout.cols;

    for (let i = startIndex; i < totalViewports; i++) {
      const position = this.calculateViewportPosition(i, layout);
      viewports.push({
        id: `viewport-${i + 1}`,
        position,
        isActive: i === 0, // First viewport is active by default
      });
    }

    return viewports;
  }

  /**
   * Create synchronization state from legacy mode
   */
  private createSynchronizationState(
    legacyMode: LegacyViewerMode,
    result: ViewerStateMigrationResult,
  ): SynchronizationState {
    const synchronization: SynchronizationState = {
      enabled: Boolean(legacyMode.syncEnabled),
      types: {
        camera: Boolean(legacyMode.syncEnabled),
        slice: Boolean(legacyMode.syncEnabled),
        windowLevel: Boolean(legacyMode.syncEnabled),
      },
    };

    result.preservedFields.push('synchronization');
    return synchronization;
  }

  /**
   * Create tool state from legacy state
   */
  private createToolState(legacyState: LegacyViewerState, result: ViewerStateMigrationResult): ToolState {
    const toolState: ToolState = {
      activeToolByViewport: {},
      availableTools: ['WindowLevel', 'Zoom', 'Pan', 'Length', 'Angle'],
      toolConfiguration: {},
    };

    // Try to preserve existing tool configuration if available
    const legacyTools = safePropertyAccess(legacyState, 'tools');
    if (legacyTools && typeof legacyTools === 'object') {
      result.preservedFields.push('tools');
      // Note: Legacy tool format migration would be implemented here
      // For now, using default configuration
    }

    return toolState;
  }

  /**
   * Determine active viewport from legacy state
   */
  private determineActiveViewport(
    legacyState: LegacyViewerState,
    viewports: NewViewportState[],
    result: ViewerStateMigrationResult,
  ): string | null {
    if (!this.config.defaultActiveViewport || viewports.length === 0) {
      return null;
    }

    // Try to preserve existing active viewport
    const legacyActiveId = safePropertyAccess(legacyState, 'activeViewportId');
    if (typeof legacyActiveId === 'string') {
      const foundViewport = viewports.find(vp => vp.id === legacyActiveId);
      if (foundViewport) {
        result.preservedFields.push('activeViewportId');
        return legacyActiveId;
      }
    }

    // Find first active viewport or default to first viewport
    const activeViewport = viewports.find(vp => vp.isActive) || viewports[0];
    if (activeViewport) {
      result.warnings.push('Using default active viewport selection');
      return activeViewport.id;
    }

    return null;
  }

  /**
   * Validate migrated state structure
   */
  private validateMigratedState(
    state: NewViewerState,
    result: ViewerStateMigrationResult,
  ): boolean {
    try {
      // Validate layout
      if (!state.layout || typeof state.layout.rows !== 'number' || typeof state.layout.cols !== 'number') {
        result.errors.push('Invalid layout in migrated state');
        return false;
      }

      // Validate viewports
      if (!Array.isArray(state.viewports)) {
        result.errors.push('Invalid viewports array in migrated state');
        return false;
      }

      const expectedViewports = state.layout.rows * state.layout.cols;
      if (state.viewports.length !== expectedViewports) {
        result.errors.push(`Viewport count mismatch: expected ${expectedViewports}, got ${state.viewports.length}`);
        return false;
      }

      // Validate viewport positions
      for (const viewport of state.viewports) {
        if (!viewport.id || typeof viewport.position !== 'object') {
          result.errors.push('Invalid viewport structure in migrated state');
          return false;
        }

        const { row, col } = viewport.position;
        if (row < 0 || row >= state.layout.rows || col < 0 || col >= state.layout.cols) {
          result.errors.push(`Invalid viewport position: ${row},${col} for layout ${state.layout.rows}x${state.layout.cols}`);
          return false;
        }
      }

      // Validate active viewport
      if (state.activeViewportId && !state.viewports.find(vp => vp.id === state.activeViewportId)) {
        result.errors.push('Active viewport ID not found in viewports array');
        return false;
      }

      return true;
    } catch (error) {
      result.errors.push(`Validation error: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Finalize migration result with timing information
   */
  private finalizeResult(
    result: ViewerStateMigrationResult,
    startTime: number,
  ): ViewerStateMigrationResult {
    result.migrationTime = Date.now() - startTime;
    return result;
  }

  /**
   * Static helper method for quick migration
   */
  public static migrate(legacyState: LegacyViewerState): ViewerStateMigrationResult {
    const migration = new ViewerStateMigration();
    return migration.migrateViewerState(legacyState);
  }

  /**
   * Static helper method for migration with custom config
   */
  public static migrateWithConfig(
    legacyState: LegacyViewerState,
    config: Partial<ViewerStateMigrationConfig>,
  ): ViewerStateMigrationResult {
    const migration = new ViewerStateMigration(config);
    return migration.migrateViewerState(legacyState);
  }
}

// Export singleton instance for convenience
export const viewerStateMigration = new ViewerStateMigration();
