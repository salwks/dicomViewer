/**
 * Window/Level Synchronization Service
 * Implements window/level synchronization with debouncing and value normalization
 * Ensures consistent contrast and brightness across comparison viewports
 * Built with shadcn/ui compliance and security standards
 */

import { EventEmitter } from 'events';
import { log } from '../utils/logger';
import { safePropertyAccess } from '../lib/utils';

export interface WindowLevelState {
  windowWidth: number;
  windowCenter: number;
  voiLUTFunction?: 'LINEAR' | 'LINEAR_EXACT' | 'SIGMOID';
  invert: boolean;
  colormap?: string;
  modality: string;
  isPreset: boolean;
  presetName?: string;
}

export interface WindowLevelSyncGroup {
  id: string;
  name: string;
  viewportIds: string[];
  isActive: boolean;
  syncMode: 'exact' | 'relative' | 'preset-only';
  modalityFilter?: string[]; // Only sync between matching modalities
  debounceDelay: number;
  tolerance: number; // Percentage tolerance for relative sync
  masterViewportId?: string; // Designated master for relative sync
}

export interface WindowLevelPreset {
  name: string;
  modality: string;
  windowWidth: number;
  windowCenter: number;
  voiLUTFunction?: 'LINEAR' | 'LINEAR_EXACT' | 'SIGMOID';
  description?: string;
}

export interface WindowLevelSyncConfig {
  defaultDebounceDelay: number;
  defaultTolerance: number;
  enableAutoNormalization: boolean;
  enableModalityFiltering: boolean;
  enablePresetSync: boolean;
  maxSyncGroups: number;
}

const DEFAULT_CONFIG: WindowLevelSyncConfig = {
  defaultDebounceDelay: 100, // 100ms debounce
  defaultTolerance: 5, // 5% tolerance for relative sync
  enableAutoNormalization: true,
  enableModalityFiltering: true,
  enablePresetSync: true,
  maxSyncGroups: 10,
};

// Common window/level presets
const DEFAULT_PRESETS: WindowLevelPreset[] = [
  // CT Presets
  { name: 'Abdomen', modality: 'CT', windowWidth: 400, windowCenter: 40 },
  { name: 'Bone', modality: 'CT', windowWidth: 1500, windowCenter: 300 },
  { name: 'Brain', modality: 'CT', windowWidth: 80, windowCenter: 40 },
  { name: 'Chest', modality: 'CT', windowWidth: 400, windowCenter: 40 },
  { name: 'Liver', modality: 'CT', windowWidth: 150, windowCenter: 30 },
  { name: 'Lung', modality: 'CT', windowWidth: 1500, windowCenter: -600 },
  { name: 'Mediastinum', modality: 'CT', windowWidth: 350, windowCenter: 50 },

  // MR Presets
  { name: 'T1', modality: 'MR', windowWidth: 600, windowCenter: 300 },
  { name: 'T2', modality: 'MR', windowWidth: 1000, windowCenter: 500 },
  { name: 'FLAIR', modality: 'MR', windowWidth: 1200, windowCenter: 600 },

  // CR/DR Presets
  { name: 'Chest X-Ray', modality: 'CR', windowWidth: 2000, windowCenter: 1000 },
  { name: 'Chest X-Ray', modality: 'DX', windowWidth: 2000, windowCenter: 1000 },
];

/**
 * Window/Level Synchronization Service
 * Manages window/level synchronization across comparison viewports
 */
export class WindowLevelSync extends EventEmitter {
  private config: WindowLevelSyncConfig;
  private syncGroups: Map<string, WindowLevelSyncGroup> = new Map();
  private viewportStates: Map<string, WindowLevelState> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private presets: Map<string, WindowLevelPreset[]> = new Map();
  private activeSyncOperations: Set<string> = new Set();
  private syncHistory: Array<{ timestamp: number; action: string; data: unknown }> = [];

  constructor(config: Partial<WindowLevelSyncConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initialize();
  }

  private initialize(): void {
    log.info('WindowLevelSync initializing', {
      component: 'WindowLevelSync',
      metadata: { config: this.config },
    });

    // Load default presets
    this.loadDefaultPresets();

    log.info('WindowLevelSync initialized', {
      component: 'WindowLevelSync',
    });
  }

  // ===== Sync Group Management =====

  /**
   * Create a window/level synchronization group
   */
  public createSyncGroup(
    name: string,
    viewportIds: string[],
    options: {
      syncMode?: 'exact' | 'relative' | 'preset-only';
      modalityFilter?: string[];
      debounceDelay?: number;
      tolerance?: number;
      masterViewportId?: string;
    } = {},
  ): string {
    if (this.syncGroups.size >= this.config.maxSyncGroups) {
      throw new Error('Maximum number of sync groups reached');
    }

    const groupId = `wl-sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const syncGroup: WindowLevelSyncGroup = {
      id: groupId,
      name,
      viewportIds: [...viewportIds],
      isActive: true,
      syncMode: options.syncMode || 'exact',
      modalityFilter: options.modalityFilter,
      debounceDelay: options.debounceDelay || this.config.defaultDebounceDelay,
      tolerance: options.tolerance || this.config.defaultTolerance,
      masterViewportId: options.masterViewportId,
    };

    this.syncGroups.set(groupId, syncGroup);

    // Initialize viewport states for group members
    viewportIds.forEach(viewportId => {
      if (!this.viewportStates.has(viewportId)) {
        this.initializeViewportState(viewportId);
      }
    });

    log.info('Window/level sync group created', {
      component: 'WindowLevelSync',
      metadata: {
        groupId,
        name,
        viewportCount: viewportIds.length,
        syncMode: syncGroup.syncMode,
      },
    });

    return groupId;
  }

  /**
   * Remove sync group
   */
  public removeSyncGroup(groupId: string): boolean {
    const group = this.syncGroups.get(groupId);
    if (!group) return false;

    // Clear any pending debounce timers for this group
    group.viewportIds.forEach(viewportId => {
      const timerId = `${groupId}-${viewportId}`;
      const timer = this.debounceTimers.get(timerId);
      if (timer) {
        clearTimeout(timer);
        this.debounceTimers.delete(timerId);
      }
    });

    this.syncGroups.delete(groupId);

    log.info('Window/level sync group removed', {
      component: 'WindowLevelSync',
      metadata: { groupId },
    });

    return true;
  }

  /**
   * Add viewport to sync group
   */
  public addViewportToGroup(groupId: string, viewportId: string): boolean {
    const group = this.syncGroups.get(groupId);
    if (!group) return false;

    if (!group.viewportIds.includes(viewportId)) {
      group.viewportIds.push(viewportId);

      // Initialize viewport state if needed
      if (!this.viewportStates.has(viewportId)) {
        this.initializeViewportState(viewportId);
      }

      log.info('Viewport added to window/level sync group', {
        component: 'WindowLevelSync',
        metadata: { groupId, viewportId },
      });
    }

    return true;
  }

  /**
   * Remove viewport from sync group
   */
  public removeViewportFromGroup(groupId: string, viewportId: string): boolean {
    const group = this.syncGroups.get(groupId);
    if (!group) return false;

    const index = group.viewportIds.indexOf(viewportId);
    if (index > -1) {
      group.viewportIds.splice(index, 1);

      // Clear debounce timer
      const timerId = `${groupId}-${viewportId}`;
      const timer = this.debounceTimers.get(timerId);
      if (timer) {
        clearTimeout(timer);
        this.debounceTimers.delete(timerId);
      }

      log.info('Viewport removed from window/level sync group', {
        component: 'WindowLevelSync',
        metadata: { groupId, viewportId },
      });
    }

    return true;
  }

  // ===== Viewport State Management =====

  /**
   * Initialize viewport state
   */
  private initializeViewportState(viewportId: string): void {
    const defaultState: WindowLevelState = {
      windowWidth: 400,
      windowCenter: 40,
      voiLUTFunction: 'LINEAR',
      invert: false,
      modality: 'CT',
      isPreset: false,
    };

    this.viewportStates.set(viewportId, defaultState);
  }

  /**
   * Update viewport window/level state
   */
  public updateViewportState(
    viewportId: string,
    state: Partial<WindowLevelState>,
    options: {
      triggerSync?: boolean;
      skipDebounce?: boolean;
      sourceGroup?: string;
    } = {},
  ): void {
    const currentState = this.viewportStates.get(viewportId);
    if (!currentState) {
      this.initializeViewportState(viewportId);
    }

    const newState: WindowLevelState = {
      ...currentState!,
      ...state,
    };

    this.viewportStates.set(viewportId, newState);

    // Record action in history
    this.addToHistory('viewport-state-updated', {
      viewportId,
      state: newState,
      triggerSync: options.triggerSync,
    });

    // Trigger synchronization if requested
    if (options.triggerSync !== false) {
      if (options.skipDebounce) {
        this.syncFromViewport(viewportId, options.sourceGroup);
      } else {
        this.debouncedSyncFromViewport(viewportId, options.sourceGroup);
      }
    }

    this.emit('viewport-state-updated', viewportId, newState);
  }

  /**
   * Get viewport state
   */
  public getViewportState(viewportId: string): WindowLevelState | null {
    return this.viewportStates.get(viewportId) || null;
  }

  // ===== Synchronization Logic =====

  /**
   * Sync window/level from source viewport to group members (debounced)
   */
  private debouncedSyncFromViewport(sourceViewportId: string, sourceGroupId?: string): void {
    // Find groups containing this viewport
    const relevantGroups = this.findGroupsForViewport(sourceViewportId, sourceGroupId);

    relevantGroups.forEach(group => {
      const timerId = `${group.id}-${sourceViewportId}`;

      // Clear existing timer
      const existingTimer = this.debounceTimers.get(timerId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set new debounce timer
      const timer = setTimeout(() => {
        this.syncFromViewport(sourceViewportId, group.id);
        this.debounceTimers.delete(timerId);
      }, group.debounceDelay);

      this.debounceTimers.set(timerId, timer);
    });
  }

  /**
   * Sync window/level from source viewport to group members (immediate)
   */
  private syncFromViewport(sourceViewportId: string, sourceGroupId?: string): void {
    const sourceState = this.viewportStates.get(sourceViewportId);
    if (!sourceState) return;

    // Prevent circular sync operations
    const operationId = `${sourceViewportId}-${Date.now()}`;
    if (this.activeSyncOperations.has(sourceViewportId)) {
      return;
    }
    this.activeSyncOperations.add(sourceViewportId);

    try {
      // Find groups containing this viewport
      const relevantGroups = this.findGroupsForViewport(sourceViewportId, sourceGroupId);

      relevantGroups.forEach(group => {
        if (!group.isActive) return;

        // Get target viewports (excluding source)
        const targetViewports = group.viewportIds.filter(id => id !== sourceViewportId);

        targetViewports.forEach(targetViewportId => {
          const targetState = this.viewportStates.get(targetViewportId);
          if (!targetState) return;

          // Apply modality filtering
          if (this.config.enableModalityFiltering && group.modalityFilter) {
            if (!group.modalityFilter.includes(targetState.modality)) {
              return;
            }
          }

          // Calculate synchronized state
          const syncedState = this.calculateSyncedState(sourceState, targetState, group);

          if (syncedState) {
            // Update target viewport state (without triggering sync)
            this.updateViewportState(targetViewportId, syncedState, {
              triggerSync: false,
              sourceGroup: group.id,
            });

            // Emit sync event for external handling
            this.emit('window-level-synced', {
              sourceViewportId,
              targetViewportId,
              groupId: group.id,
              syncedState,
            });
          }
        });
      });

      // Record sync action
      this.addToHistory('sync-performed', {
        sourceViewportId,
        groupCount: relevantGroups.length,
        operationId,
      });
    } finally {
      this.activeSyncOperations.delete(sourceViewportId);
    }
  }

  /**
   * Calculate synced state based on sync mode
   */
  private calculateSyncedState(
    sourceState: WindowLevelState,
    targetState: WindowLevelState,
    group: WindowLevelSyncGroup,
  ): Partial<WindowLevelState> | null {
    switch (group.syncMode) {
      case 'exact':
        return this.calculateExactSync(sourceState, targetState);

      case 'relative':
        return this.calculateRelativeSync(sourceState, targetState, group);

      case 'preset-only':
        return this.calculatePresetSync(sourceState, targetState);

      default:
        return null;
    }
  }

  /**
   * Exact synchronization - copy values directly
   */
  private calculateExactSync(sourceState: WindowLevelState, _targetState: WindowLevelState): Partial<WindowLevelState> {
    return {
      windowWidth: sourceState.windowWidth,
      windowCenter: sourceState.windowCenter,
      voiLUTFunction: sourceState.voiLUTFunction,
      invert: sourceState.invert,
      colormap: sourceState.colormap,
      isPreset: sourceState.isPreset,
      presetName: sourceState.presetName,
    };
  }

  /**
   * Relative synchronization - scale values based on modality differences
   */
  private calculateRelativeSync(
    sourceState: WindowLevelState,
    targetState: WindowLevelState,
    group: WindowLevelSyncGroup,
  ): Partial<WindowLevelState> | null {
    // For relative sync, we need to normalize based on modality characteristics
    const normalizationFactor = this.calculateNormalizationFactor(sourceState.modality, targetState.modality);

    if (normalizationFactor === null) {
      // Cannot normalize between these modalities
      return null;
    }

    const scaledWidth = sourceState.windowWidth * normalizationFactor;
    const scaledCenter = sourceState.windowCenter * normalizationFactor;

    // Check tolerance
    const widthDiff = (Math.abs(scaledWidth - targetState.windowWidth) / targetState.windowWidth) * 100;
    const centerDiff =
      (Math.abs(scaledCenter - targetState.windowCenter) / Math.abs(targetState.windowCenter || 1)) * 100;

    if (widthDiff > group.tolerance || centerDiff > group.tolerance) {
      return {
        windowWidth: scaledWidth,
        windowCenter: scaledCenter,
        voiLUTFunction: sourceState.voiLUTFunction,
        invert: sourceState.invert,
        isPreset: false,
      };
    }

    return null; // Within tolerance, no sync needed
  }

  /**
   * Preset-only synchronization - only sync preset changes
   */
  private calculatePresetSync(
    sourceState: WindowLevelState,
    targetState: WindowLevelState,
  ): Partial<WindowLevelState> | null {
    if (!sourceState.isPreset || !sourceState.presetName) {
      return null; // Only sync preset changes
    }

    // Find matching preset for target modality
    const targetPreset = this.findPresetForModality(sourceState.presetName, targetState.modality);

    if (targetPreset) {
      return {
        windowWidth: targetPreset.windowWidth,
        windowCenter: targetPreset.windowCenter,
        voiLUTFunction: targetPreset.voiLUTFunction,
        isPreset: true,
        presetName: targetPreset.name,
      };
    }

    return null;
  }

  // ===== Utility Methods =====

  /**
   * Find sync groups containing a viewport
   */
  private findGroupsForViewport(viewportId: string, preferredGroupId?: string): WindowLevelSyncGroup[] {
    const groups: WindowLevelSyncGroup[] = [];

    // If preferred group specified, use it first
    if (preferredGroupId) {
      const preferredGroup = this.syncGroups.get(preferredGroupId);
      if (preferredGroup && preferredGroup.viewportIds.includes(viewportId)) {
        groups.push(preferredGroup);
        return groups; // Return only preferred group
      }
    }

    // Find all groups containing this viewport
    this.syncGroups.forEach(group => {
      if (group.viewportIds.includes(viewportId)) {
        groups.push(group);
      }
    });

    return groups;
  }

  /**
   * Calculate normalization factor between modalities
   */
  private calculateNormalizationFactor(sourceModality: string, targetModality: string): number | null {
    // Same modality - no normalization needed
    if (sourceModality === targetModality) {
      return 1.0;
    }

    // Define modality relationships and scaling factors
    const modalityScales: Record<string, Record<string, number>> = {
      CT: {
        MR: 0.5, // CT to MR
        CR: 2.0, // CT to CR
        DX: 2.0, // CT to DX
      },
      MR: {
        CT: 2.0, // MR to CT
        CR: 4.0, // MR to CR
        DX: 4.0, // MR to DX
      },
      CR: {
        CT: 0.5, // CR to CT
        MR: 0.25, // CR to MR
        DX: 1.0, // CR to DX
      },
      DX: {
        CT: 0.5, // DX to CT
        MR: 0.25, // DX to MR
        CR: 1.0, // DX to CR
      },
    };

    const scales = safePropertyAccess(modalityScales, sourceModality);
    return scales ? safePropertyAccess(scales, targetModality) || null : null;
  }

  // ===== Preset Management =====

  /**
   * Load default window/level presets
   */
  private loadDefaultPresets(): void {
    DEFAULT_PRESETS.forEach(preset => {
      if (!this.presets.has(preset.modality)) {
        this.presets.set(preset.modality, []);
      }
      this.presets.get(preset.modality)!.push(preset);
    });
  }

  /**
   * Add custom preset
   */
  public addPreset(preset: WindowLevelPreset): void {
    if (!this.presets.has(preset.modality)) {
      this.presets.set(preset.modality, []);
    }

    const modalityPresets = this.presets.get(preset.modality)!;

    // Replace if preset with same name exists
    const existingIndex = modalityPresets.findIndex(p => p.name === preset.name);
    if (existingIndex > -1) {
      // eslint-disable-next-line security/detect-object-injection -- Safe: existingIndex is validated array index from findIndex
      modalityPresets[existingIndex] = preset;
    } else {
      modalityPresets.push(preset);
    }

    log.info('Window/level preset added', {
      component: 'WindowLevelSync',
      metadata: { preset },
    });
  }

  /**
   * Find preset for modality
   */
  private findPresetForModality(presetName: string, modality: string): WindowLevelPreset | null {
    const modalityPresets = this.presets.get(modality);
    if (!modalityPresets) return null;

    return modalityPresets.find(p => p.name === presetName) || null;
  }

  /**
   * Get presets for modality
   */
  public getPresetsForModality(modality: string): WindowLevelPreset[] {
    return this.presets.get(modality) || [];
  }

  /**
   * Apply preset to viewport
   */
  public applyPreset(viewportId: string, presetName: string, modality?: string): boolean {
    const viewport = this.viewportStates.get(viewportId);
    if (!viewport) return false;

    const targetModality = modality || viewport.modality;
    const preset = this.findPresetForModality(presetName, targetModality);

    if (!preset) {
      log.warn('Preset not found', {
        component: 'WindowLevelSync',
        metadata: { presetName, modality: targetModality },
      });
      return false;
    }

    this.updateViewportState(viewportId, {
      windowWidth: preset.windowWidth,
      windowCenter: preset.windowCenter,
      voiLUTFunction: preset.voiLUTFunction,
      isPreset: true,
      presetName: preset.name,
    });

    return true;
  }

  // ===== History & Monitoring =====

  /**
   * Add action to history
   */
  private addToHistory(action: string, data: unknown): void {
    this.syncHistory.push({
      timestamp: Date.now(),
      action,
      data,
    });

    // Keep only recent history (last 100 entries)
    if (this.syncHistory.length > 100) {
      this.syncHistory = this.syncHistory.slice(-50);
    }
  }

  /**
   * Get sync history
   */
  public getSyncHistory(): Array<{ timestamp: number; action: string; data: unknown }> {
    return [...this.syncHistory];
  }

  /**
   * Get sync group status
   */
  public getSyncGroupStatus(groupId: string): {
    group: WindowLevelSyncGroup | null;
    viewportStates: Map<string, WindowLevelState>;
    activeSyncs: number;
  } {
    const group = this.syncGroups.get(groupId) || null;
    const viewportStates = new Map<string, WindowLevelState>();

    if (group) {
      group.viewportIds.forEach(viewportId => {
        const state = this.viewportStates.get(viewportId);
        if (state) {
          viewportStates.set(viewportId, state);
        }
      });
    }

    return {
      group,
      viewportStates,
      activeSyncs: this.activeSyncOperations.size,
    };
  }

  // ===== Cleanup =====

  /**
   * Dispose all resources
   */
  public dispose(): void {
    // Clear all debounce timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();

    // Clear all data
    this.syncGroups.clear();
    this.viewportStates.clear();
    this.presets.clear();
    this.activeSyncOperations.clear();
    this.syncHistory = [];

    this.removeAllListeners();

    log.info('WindowLevelSync disposed', {
      component: 'WindowLevelSync',
    });
  }
}

// Export singleton instance
export const windowLevelSync = new WindowLevelSync();
