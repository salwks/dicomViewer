/**
 * Viewport State Manager Service
 * Centralized state management system for viewport configuration
 * Built with security compliance and type safety
 */

import { EventEmitter } from 'events';
import {
  ViewportState,
  ViewportStateUpdate,
  ViewportStateChange,
  ViewportStateValidator,
  ValidationResult,
  ValidationError,
  createDefaultViewportState,
  StatePersistenceConfig,
  DEFAULT_PERSISTENCE_CONFIG,
} from '../types/viewportState';
import { secureStorage } from '../security/secureStorage';
import { log } from '../utils/logger';

// Safe property access helper
function safePropertyAccess<T extends object, K extends keyof T>(obj: T, key: K): T[K] | undefined {
  if (Object.prototype.hasOwnProperty.call(obj, key)) {
    return obj[key];
  }
  return undefined;
}

// State change event types
export interface ViewportStateManagerEvents {
  'state-changed': [ViewportStateChange];
  'state-updated': [string, ViewportState];
  'viewport-activated': [string];
  'viewport-deactivated': [string];
  'validation-error': [ValidationError[], string];
  'persistence-error': [Error, string];
}

export class ViewportStateManager extends EventEmitter {
  private readonly viewports = new Map<string, ViewportState>();
  private activeViewportId: string | null = null;
  private readonly validator: ViewportStateValidator;
  private readonly persistenceConfig: StatePersistenceConfig;
  private saveTimeoutId: NodeJS.Timeout | null = null;
  private readonly SAVE_DEBOUNCE_MS = 1000; // 1 second debounce

  constructor(
    validator?: ViewportStateValidator,
    persistenceConfig?: Partial<StatePersistenceConfig>,
  ) {
    super();
    this.validator = validator || new DefaultViewportStateValidator();
    this.persistenceConfig = { ...DEFAULT_PERSISTENCE_CONFIG, ...persistenceConfig };

    // Initialize secure storage if persistence is enabled
    if (this.persistenceConfig.enablePersistence) {
      this.initializePersistence();
    }

    log.info('ViewportStateManager initialized', {
      component: 'ViewportStateManager',
      metadata: {
        persistenceEnabled: this.persistenceConfig.enablePersistence,
        encryptionEnabled: this.persistenceConfig.encryptionEnabled,
      },
    });
  }

  /**
   * Initialize persistence system
   */
  private async initializePersistence(): Promise<void> {
    try {
      // Load existing states from storage
      await this.loadPersistedStates();

      log.info('Viewport state persistence initialized', {
        component: 'ViewportStateManager',
        metadata: { viewportCount: this.viewports.size },
      });
    } catch (error) {
      log.error(
        'Failed to initialize viewport state persistence',
        { component: 'ViewportStateManager' },
        error as Error,
      );
      this.emit('persistence-error', error as Error, 'initialization');
    }
  }

  /**
   * Get all viewport states
   */
  getViewports(): Map<string, ViewportState> {
    return new Map(this.viewports);
  }

  /**
   * Get specific viewport state
   */
  getViewportState(viewportId: string): ViewportState | null {
    const state = this.viewports.get(viewportId);
    return state ? { ...state } : null; // Return deep copy for immutability
  }

  /**
   * Get active viewport ID
   */
  getActiveViewportId(): string | null {
    return this.activeViewportId;
  }

  /**
   * Get active viewport state
   */
  getActiveViewportState(): ViewportState | null {
    return this.activeViewportId ? this.getViewportState(this.activeViewportId) : null;
  }

  /**
   * Create new viewport with default state
   */
  createViewport(
    viewportId: string,
    type: ViewportState['type'] = 'stack',
    initialState?: ViewportStateUpdate,
  ): ViewportState {
    if (this.viewports.has(viewportId)) {
      log.warn('Viewport already exists, updating instead of creating', {
        component: 'ViewportStateManager',
        metadata: { viewportId },
      });
      return this.getViewportState(viewportId)!;
    }

    // Create default state
    const defaultState = createDefaultViewportState(viewportId, type);

    // Apply initial state if provided
    const finalState = initialState ? this.mergeStates(defaultState, initialState as Partial<ViewportState>) : defaultState;

    // Validate the new state
    const validation = this.validator.validateState(finalState);
    if (!validation.isValid) {
      log.error('Invalid viewport state during creation', {
        component: 'ViewportStateManager',
        metadata: { viewportId, errors: validation.errors },
      });
      this.emit('validation-error', validation.errors, viewportId);
      throw new Error(`Invalid viewport state: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Store the state
    this.viewports.set(viewportId, finalState);

    // Emit state updated event
    this.emit('state-updated', viewportId, finalState);

    // Schedule persistence save
    this.schedulePersistence();

    log.info('Viewport created', {
      component: 'ViewportStateManager',
      metadata: { viewportId, type },
    });

    return { ...finalState };
  }

  /**
   * Update viewport state with partial updates
   */
  updateViewportState(viewportId: string, updates: ViewportStateUpdate): ViewportState {
    const currentState = this.viewports.get(viewportId);
    if (!currentState) {
      throw new Error(`Viewport not found: ${viewportId}`);
    }

    // Validate the update
    const validation = this.validator.validateUpdate(updates);
    if (!validation.isValid) {
      log.error('Invalid viewport state update', {
        component: 'ViewportStateManager',
        metadata: { viewportId, errors: validation.errors },
      });
      this.emit('validation-error', validation.errors, viewportId);
      throw new Error(`Invalid state update: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Create new state with updates
    const newState = this.mergeStates(currentState, updates as Partial<ViewportState>);

    // Update modification timestamp
    newState.metadata.modifiedAt = new Date().toISOString();

    // Validate the final state
    const finalValidation = this.validator.validateState(newState);
    if (!finalValidation.isValid) {
      log.error('Invalid final viewport state after update', {
        component: 'ViewportStateManager',
        metadata: { viewportId, errors: finalValidation.errors },
      });
      this.emit('validation-error', finalValidation.errors, viewportId);
      throw new Error(`Invalid final state: ${finalValidation.errors.map(e => e.message).join(', ')}`);
    }

    // Store the updated state
    this.viewports.set(viewportId, newState);

    // Determine changed fields
    const changedFields = this.getChangedFields(currentState, newState);

    // Create state change event
    const stateChange: ViewportStateChange = {
      viewportId,
      previousState: currentState,
      newState,
      changedFields,
      timestamp: new Date().toISOString(),
    };

    // Emit events
    this.emit('state-changed', stateChange);
    this.emit('state-updated', viewportId, newState);

    // Schedule persistence save
    this.schedulePersistence();

    log.info('Viewport state updated', {
      component: 'ViewportStateManager',
      metadata: {
        viewportId,
        changedFields: changedFields.length,
        updateKeys: Object.keys(updates),
      },
    });

    return { ...newState };
  }

  /**
   * Set active viewport
   */
  setActiveViewport(viewportId: string | null): void {
    const previousActiveId = this.activeViewportId;

    // Validate viewport exists if not null
    if (viewportId && !this.viewports.has(viewportId)) {
      throw new Error(`Cannot activate viewport that doesn't exist: ${viewportId}`);
    }

    // Deactivate previous viewport
    if (previousActiveId && this.viewports.has(previousActiveId)) {
      this.updateViewportState(previousActiveId, {
        activation: {
          ...this.viewports.get(previousActiveId)!.activation,
          isActive: false,
        },
      });
      this.emit('viewport-deactivated', previousActiveId);
    }

    // Activate new viewport
    if (viewportId) {
      this.updateViewportState(viewportId, {
        activation: {
          ...this.viewports.get(viewportId)!.activation,
          isActive: true,
          activatedAt: new Date().toISOString(),
        },
      });
      this.emit('viewport-activated', viewportId);
    }

    this.activeViewportId = viewportId;

    log.info('Active viewport changed', {
      component: 'ViewportStateManager',
      metadata: { previousActiveId, newActiveId: viewportId },
    });
  }

  /**
   * Set active tool for specific viewport
   */
  setActiveTool(viewportId: string, toolName: string): void {
    const currentState = this.getViewportState(viewportId);
    if (!currentState) {
      throw new Error(`Viewport not found: ${viewportId}`);
    }

    // Validate tool is available
    if (!currentState.tools.availableTools.includes(toolName)) {
      log.warn('Tool not in available tools list, adding it', {
        component: 'ViewportStateManager',
        metadata: { viewportId, toolName, availableTools: currentState.tools.availableTools },
      });
    }

    this.updateViewportState(viewportId, {
      tools: {
        ...currentState.tools,
        activeTool: toolName,
        availableTools: currentState.tools.availableTools.includes(toolName)
          ? currentState.tools.availableTools
          : [...currentState.tools.availableTools, toolName],
      },
    });

    log.info('Active tool changed', {
      component: 'ViewportStateManager',
      metadata: { viewportId, toolName },
    });
  }

  /**
   * Remove viewport
   */
  removeViewport(viewportId: string): boolean {
    const existed = this.viewports.has(viewportId);

    if (existed) {
      // Deactivate if it was active
      if (this.activeViewportId === viewportId) {
        this.setActiveViewport(null);
      }

      // Remove from storage
      this.viewports.delete(viewportId);

      // Schedule persistence save
      this.schedulePersistence();

      log.info('Viewport removed', {
        component: 'ViewportStateManager',
        metadata: { viewportId },
      });
    }

    return existed;
  }

  /**
   * Clear all viewports
   */
  clearAllViewports(): void {
    const viewportCount = this.viewports.size;
    this.viewports.clear();
    this.activeViewportId = null;

    // Schedule persistence save
    this.schedulePersistence();

    log.info('All viewports cleared', {
      component: 'ViewportStateManager',
      metadata: { clearedCount: viewportCount },
    });
  }

  /**
   * Get viewport count
   */
  getViewportCount(): number {
    return this.viewports.size;
  }

  /**
   * Check if viewport exists
   */
  hasViewport(viewportId: string): boolean {
    return this.viewports.has(viewportId);
  }

  /**
   * Get all viewport IDs
   */
  getViewportIds(): string[] {
    return Array.from(this.viewports.keys());
  }

  /**
   * Export all states for backup/migration
   */
  exportStates(): Record<string, ViewportState> {
    const states: Record<string, ViewportState> = {};
    this.viewports.forEach((state, id) => {
      states[id] = { ...state };
    });
    return states;
  }

  /**
   * Import states from backup/migration
   */
  importStates(states: Record<string, ViewportState>, clearExisting = false): void {
    if (clearExisting) {
      this.clearAllViewports();
    }

    let importedCount = 0;
    let errorCount = 0;

    Object.entries(states).forEach(([viewportId, state]) => {
      try {
        // Validate imported state
        const validation = this.validator.validateState(state);
        if (!validation.isValid) {
          log.error('Invalid imported viewport state', {
            component: 'ViewportStateManager',
            metadata: { viewportId, errors: validation.errors },
          });
          errorCount++;
          return;
        }

        this.viewports.set(viewportId, state);
        importedCount++;
      } catch (error) {
        log.error('Failed to import viewport state', {
          component: 'ViewportStateManager',
          metadata: { viewportId },
        }, error as Error);
        errorCount++;
      }
    });

    // Schedule persistence save
    this.schedulePersistence();

    log.info('States imported', {
      component: 'ViewportStateManager',
      metadata: { importedCount, errorCount, clearExisting },
    });
  }

  /**
   * Merge states safely
   */
  private mergeStates(
    currentState: ViewportState,
    updates: Partial<ViewportState>,
  ): ViewportState {
    const newState = { ...currentState };

    // Safely merge each top-level property
    Object.keys(updates).forEach(key => {
      const updateKey = key as keyof ViewportState;
      const updateValue = safePropertyAccess(updates, updateKey);

      if (updateValue !== undefined) {
        if (typeof updateValue === 'object' && updateValue !== null && !Array.isArray(updateValue)) {
          // Deep merge for objects
          const currentValue = safePropertyAccess(currentState, updateKey);
          if (currentValue && typeof currentValue === 'object') {
            newState[updateKey] = {
              ...currentValue,
              ...updateValue,
            } as any;
          } else {
            newState[updateKey] = updateValue as any;
          }
        } else {
          // Direct assignment for primitives and arrays
          newState[updateKey] = updateValue as any;
        }
      }
    });

    return newState;
  }

  /**
   * Get changed fields between states
   */
  private getChangedFields(
    previousState: ViewportState,
    newState: ViewportState,
  ): (keyof ViewportState)[] {
    const changedFields: (keyof ViewportState)[] = [];

    const allKeys = new Set([
      ...Object.keys(previousState) as (keyof ViewportState)[],
      ...Object.keys(newState) as (keyof ViewportState)[],
    ]);

    allKeys.forEach(key => {
      const previousValue = safePropertyAccess(previousState, key);
      const newValue = safePropertyAccess(newState, key);

      // Simple comparison - in production, you might want deep comparison
      if (JSON.stringify(previousValue) !== JSON.stringify(newValue)) {
        changedFields.push(key);
      }
    });

    return changedFields;
  }

  /**
   * Schedule persistence save with debouncing
   */
  private schedulePersistence(): void {
    if (!this.persistenceConfig.enablePersistence) return;

    // Cancel existing timeout
    if (this.saveTimeoutId) {
      clearTimeout(this.saveTimeoutId);
    }

    // Schedule new save
    this.saveTimeoutId = setTimeout(() => {
      this.saveToStorage().catch(error => {
        log.error('Failed to save viewport states', {
          component: 'ViewportStateManager',
        }, error as Error);
        this.emit('persistence-error', error as Error, 'save');
      });
    }, this.SAVE_DEBOUNCE_MS);
  }

  /**
   * Save states to secure storage
   */
  private async saveToStorage(): Promise<void> {
    try {
      const exportedStates = this.exportStates();
      const serializedStates = JSON.stringify(exportedStates);

      // Check size limits
      const sizeInBytes = new Blob([serializedStates]).size;
      if (sizeInBytes > this.persistenceConfig.maxStorageSize) {
        throw new Error(`State size (${sizeInBytes} bytes) exceeds limit (${this.persistenceConfig.maxStorageSize} bytes)`);
      }

      await secureStorage.store(
        this.persistenceConfig.storageKey,
        serializedStates,
        'viewport-states',
        {
          encrypt: this.persistenceConfig.encryptionEnabled,
          compress: this.persistenceConfig.compressionEnabled,
        },
      );

      log.info('Viewport states saved to storage', {
        component: 'ViewportStateManager',
        metadata: {
          viewportCount: this.viewports.size,
          sizeInBytes,
          encrypted: this.persistenceConfig.encryptionEnabled,
        },
      });
    } catch (error) {
      log.error('Failed to save viewport states to storage', {
        component: 'ViewportStateManager',
      }, error as Error);
      throw error;
    }
  }

  /**
   * Load states from secure storage
   */
  private async loadPersistedStates(): Promise<void> {
    try {
      const serializedStates = await secureStorage.retrieve(this.persistenceConfig.storageKey);

      if (serializedStates) {
        const states = JSON.parse(serializedStates) as Record<string, ViewportState>;
        this.importStates(states, false);

        log.info('Viewport states loaded from storage', {
          component: 'ViewportStateManager',
          metadata: { viewportCount: Object.keys(states).length },
        });
      }
    } catch (error) {
      log.error('Failed to load viewport states from storage', {
        component: 'ViewportStateManager',
      }, error as Error);
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Cancel pending saves
    if (this.saveTimeoutId) {
      clearTimeout(this.saveTimeoutId);
      this.saveTimeoutId = null;
    }

    // Clear data
    this.viewports.clear();
    this.activeViewportId = null;

    // Remove all listeners
    this.removeAllListeners();

    log.info('ViewportStateManager disposed', {
      component: 'ViewportStateManager',
    });
  }
}

/**
 * Default implementation of viewport state validator
 */
class DefaultViewportStateValidator implements ViewportStateValidator {
  validateState(state: ViewportState): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Required fields validation
    if (!state.id || typeof state.id !== 'string') {
      errors.push({
        field: 'id',
        message: 'Viewport ID is required and must be a string',
        code: 'INVALID_ID',
        severity: 'error',
      });
    }

    if (!state.type || !['stack', 'volume', 'multiplanar'].includes(state.type)) {
      errors.push({
        field: 'type',
        message: 'Viewport type must be one of: stack, volume, multiplanar',
        code: 'INVALID_TYPE',
        severity: 'error',
      });
    }

    // Camera validation
    if (state.camera) {
      if (!Array.isArray(state.camera.position) || state.camera.position.length !== 3) {
        errors.push({
          field: 'camera.position',
          message: 'Camera position must be an array of 3 numbers',
          code: 'INVALID_CAMERA_POSITION',
          severity: 'error',
        });
      }

      if (!Array.isArray(state.camera.focalPoint) || state.camera.focalPoint.length !== 3) {
        errors.push({
          field: 'camera.focalPoint',
          message: 'Camera focal point must be an array of 3 numbers',
          code: 'INVALID_CAMERA_FOCAL_POINT',
          severity: 'error',
        });
      }
    }

    // Window/Level validation
    if (state.windowLevel) {
      if (typeof state.windowLevel.width !== 'number' || state.windowLevel.width <= 0) {
        errors.push({
          field: 'windowLevel.width',
          message: 'Window width must be a positive number',
          code: 'INVALID_WINDOW_WIDTH',
          severity: 'error',
        });
      }

      if (typeof state.windowLevel.center !== 'number') {
        errors.push({
          field: 'windowLevel.center',
          message: 'Window center must be a number',
          code: 'INVALID_WINDOW_CENTER',
          severity: 'error',
        });
      }
    }

    // Transform validation
    if (state.transform) {
      if (typeof state.transform.zoom !== 'number' || state.transform.zoom <= 0) {
        errors.push({
          field: 'transform.zoom',
          message: 'Zoom must be a positive number',
          code: 'INVALID_ZOOM',
          severity: 'error',
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateUpdate(update: ViewportStateUpdate): ValidationResult {
    // Create a temporary state for validation
    const tempState = createDefaultViewportState('temp');
    const mergedState = { ...tempState, ...update } as ViewportState;

    // Use the main validation logic
    return this.validateState(mergedState);
  }

  sanitizeState(state: ViewportState): ViewportState {
    const sanitized = { ...state };

    // Ensure camera values are finite
    if (sanitized.camera) {
      sanitized.camera.position = sanitized.camera.position.map(val =>
        isFinite(val) ? val : 0,
      ) as [number, number, number];

      sanitized.camera.focalPoint = sanitized.camera.focalPoint.map(val =>
        isFinite(val) ? val : 0,
      ) as [number, number, number];
    }

    // Ensure zoom is positive
    if (sanitized.transform && sanitized.transform.zoom <= 0) {
      sanitized.transform.zoom = 1.0;
    }

    // Ensure window width is positive
    if (sanitized.windowLevel && sanitized.windowLevel.width <= 0) {
      sanitized.windowLevel.width = 400;
    }

    return sanitized;
  }
}

// Export singleton instance
export const viewportStateManager = new ViewportStateManager();
export default viewportStateManager;
