/**
 * Viewport Synchronizer Service
 * Manages viewport synchronization for window/level, zoom, pan, scroll, and cross-reference lines
 */

import { EventEmitter } from 'events';
import { log } from '../utils/logger';
import { safePropertyAccess } from '../lib/utils';
import {
  SyncType,
  SynchronizationSettings,
  SynchronizationEvent,
  ViewportSyncState,
  CrossReferenceSettings,
} from '../types/dicom';
import {
  MatrixTransformSync,
  type ViewportTransform,
  type MatrixTransformConfig,
  DEFAULT_MATRIX_TRANSFORM_CONFIG,
} from './MatrixTransformSync';

export interface ViewportReference {
  viewportId: string;
  renderingEngineId: string;
}

export interface SyncConfig {
  camera: boolean;
  voi: boolean;
  scroll: boolean;
  crossReference: boolean;
}

export const DEFAULT_SYNCHRONIZATION_SETTINGS: SynchronizationSettings = {
  windowLevel: false,
  zoom: false,
  pan: false,
  scroll: false,
  crosshairs: false,
  orientation: false,
  globalSync: true,
};

export const DEFAULT_CROSSREFERENCE_SETTINGS: CrossReferenceSettings = {
  enabled: false,
  color: '#00ff00',
  thickness: 1,
  dashLength: 4,
  gapLength: 4,
  opacity: 0.8,
};

export interface ViewportSynchronizerConfig {
  maxViewports: number;
  syncDebounceMs: number;
  enableCrossReference: boolean;
  strictModeValidation: boolean;
  matrixTransform?: Partial<MatrixTransformConfig>;
}

export const DEFAULT_SYNCHRONIZER_CONFIG: ViewportSynchronizerConfig = {
  maxViewports: 16,
  syncDebounceMs: 50,
  enableCrossReference: true,
  strictModeValidation: true,
};

export class ViewportSynchronizer extends EventEmitter {
  private config: ViewportSynchronizerConfig;
  private settings: SynchronizationSettings;
  private crossReferenceSettings: CrossReferenceSettings;
  private viewports: Map<string, ViewportSyncState>;
  private syncGroups: Map<string, Set<string>>; // group -> viewport IDs
  private syncTimeouts: Map<string, NodeJS.Timeout>;
  private lastSyncEvents: Map<string, SynchronizationEvent>;
  private matrixTransformSync: MatrixTransformSync;

  constructor(
    config: Partial<ViewportSynchronizerConfig> = {},
    settings: Partial<SynchronizationSettings> = {},
    crossReferenceSettings: Partial<CrossReferenceSettings> = {},
  ) {
    super();

    this.config = { ...DEFAULT_SYNCHRONIZER_CONFIG, ...config };
    this.settings = { ...DEFAULT_SYNCHRONIZATION_SETTINGS, ...settings };
    this.crossReferenceSettings = { ...DEFAULT_CROSSREFERENCE_SETTINGS, ...crossReferenceSettings };

    this.viewports = new Map();
    this.syncGroups = new Map();
    this.syncTimeouts = new Map();
    this.lastSyncEvents = new Map();

    // Initialize matrix transform synchronization
    this.matrixTransformSync = new MatrixTransformSync({
      ...DEFAULT_MATRIX_TRANSFORM_CONFIG,
      ...this.config.matrixTransform,
    });

    this.initializeSynchronizer();
  }

  private initializeSynchronizer(): void {
    log.info('Initializing Viewport Synchronizer', {
      component: 'ViewportSynchronizer',
      metadata: {
        config: this.config,
        settings: this.settings,
        crossReferenceSettings: this.crossReferenceSettings,
      },
    });

    // Create default sync group for global synchronization
    this.syncGroups.set('global', new Set());
  }

  // ===== Viewport Management =====

  public addViewport(viewportId: string, initialState: Partial<ViewportSyncState> = {}): void {
    if (this.viewports.has(viewportId)) {
      log.warn('Viewport already exists', {
        component: 'ViewportSynchronizer',
        metadata: { viewportId },
      });
      return;
    }

    if (this.viewports.size >= this.config.maxViewports) {
      log.error('Maximum viewport limit reached', {
        component: 'ViewportSynchronizer',
        metadata: { maxViewports: this.config.maxViewports },
      });
      return;
    }

    const viewportState: ViewportSyncState = {
      viewportId,
      isSource: false,
      windowCenter: 128,
      windowWidth: 256,
      zoom: 1.0,
      pan: [0, 0],
      scrollIndex: 0,
      lastSyncTime: Date.now(),
      ...initialState,
    };

    this.viewports.set(viewportId, viewportState);

    // Add to global sync group if global sync is enabled
    if (this.settings.globalSync) {
      this.addViewportToGroup(viewportId, 'global');
    }

    this.emit('viewportAdded', { viewportId, state: viewportState });

    log.info('Viewport added to synchronizer', {
      component: 'ViewportSynchronizer',
      metadata: { viewportId, state: viewportState },
    });
  }

  public removeViewport(viewportId: string): void {
    if (!this.viewports.has(viewportId)) {
      return;
    }

    // Remove from all sync groups
    for (const [groupId, viewportIds] of this.syncGroups) {
      if (viewportIds.has(viewportId)) {
        this.removeViewportFromGroup(viewportId, groupId);
      }
    }

    // Clear any pending sync timeouts
    const timeoutKey = `${viewportId}_sync`;
    if (this.syncTimeouts.has(timeoutKey)) {
      clearTimeout(this.syncTimeouts.get(timeoutKey)!);
      this.syncTimeouts.delete(timeoutKey);
    }

    this.viewports.delete(viewportId);
    this.emit('viewportRemoved', { viewportId });

    log.info('Viewport removed from synchronizer', {
      component: 'ViewportSynchronizer',
      metadata: { viewportId },
    });
  }

  public updateViewportState(
    viewportId: string,
    updates: Partial<ViewportSyncState>,
    triggerSync: boolean = true,
  ): void {
    const viewport = this.viewports.get(viewportId);
    if (!viewport) {
      log.warn('Attempt to update non-existent viewport', {
        component: 'ViewportSynchronizer',
        metadata: { viewportId },
      });
      return;
    }

    // Update viewport state
    const updatedViewport = {
      ...viewport,
      ...updates,
      lastSyncTime: Date.now(),
    };

    this.viewports.set(viewportId, updatedViewport);

    // Trigger synchronization if enabled
    if (triggerSync) {
      this.triggerSync(viewportId, updates);
    }

    this.emit('viewportStateUpdated', { viewportId, state: updatedViewport });
  }

  // ===== Synchronization Settings =====

  public updateSyncSettings(newSettings: Partial<SynchronizationSettings>): void {
    const previousSettings = { ...this.settings };
    this.settings = { ...this.settings, ...newSettings };

    // Handle global sync mode change
    if (newSettings.globalSync !== undefined && newSettings.globalSync !== previousSettings.globalSync) {
      if (newSettings.globalSync) {
        // Add all viewports to global group
        const globalGroup = this.syncGroups.get('global') || new Set();
        for (const viewportId of this.viewports.keys()) {
          globalGroup.add(viewportId);
        }
        this.syncGroups.set('global', globalGroup);
      } else {
        // Remove global group
        this.syncGroups.delete('global');
      }
    }

    this.emit('syncSettingsUpdated', {
      previous: previousSettings,
      current: this.settings,
    });

    log.info('Synchronization settings updated', {
      component: 'ViewportSynchronizer',
      metadata: { previousSettings, newSettings: this.settings },
    });
  }

  public getSyncSettings(): SynchronizationSettings {
    return { ...this.settings };
  }

  public updateCrossReferenceSettings(newSettings: Partial<CrossReferenceSettings>): void {
    const previousSettings = { ...this.crossReferenceSettings };
    this.crossReferenceSettings = { ...this.crossReferenceSettings, ...newSettings };

    this.emit('crossReferenceSettingsUpdated', {
      previous: previousSettings,
      current: this.crossReferenceSettings,
    });

    log.info('Cross-reference settings updated', {
      component: 'ViewportSynchronizer',
      metadata: { previousSettings, newSettings: this.crossReferenceSettings },
    });
  }

  public getCrossReferenceSettings(): CrossReferenceSettings {
    return { ...this.crossReferenceSettings };
  }

  // ===== Synchronization Groups =====

  public createSyncGroup(groupId: string, viewportIds: string[] = []): void {
    if (this.syncGroups.has(groupId)) {
      log.warn('Sync group already exists', {
        component: 'ViewportSynchronizer',
        metadata: { groupId },
      });
      return;
    }

    const group = new Set<string>();
    for (const viewportId of viewportIds) {
      if (this.viewports.has(viewportId)) {
        group.add(viewportId);
      }
    }

    this.syncGroups.set(groupId, group);
    this.emit('syncGroupCreated', { groupId, viewportIds: Array.from(group) });

    log.info('Sync group created', {
      component: 'ViewportSynchronizer',
      metadata: { groupId, viewportIds: Array.from(group) },
    });
  }

  public addViewportToGroup(viewportId: string, groupId: string): void {
    if (!this.viewports.has(viewportId)) {
      log.warn('Cannot add non-existent viewport to group', {
        component: 'ViewportSynchronizer',
        metadata: { viewportId, groupId },
      });
      return;
    }

    let group = this.syncGroups.get(groupId);
    if (!group) {
      group = new Set();
      this.syncGroups.set(groupId, group);
    }

    group.add(viewportId);
    this.emit('viewportAddedToGroup', { viewportId, groupId });

    log.info('Viewport added to sync group', {
      component: 'ViewportSynchronizer',
      metadata: { viewportId, groupId },
    });
  }

  public removeViewportFromGroup(viewportId: string, groupId: string): void {
    const group = this.syncGroups.get(groupId);
    if (!group || !group.has(viewportId)) {
      return;
    }

    group.delete(viewportId);

    // Remove empty groups except global
    if (group.size === 0 && groupId !== 'global') {
      this.syncGroups.delete(groupId);
    }

    this.emit('viewportRemovedFromGroup', { viewportId, groupId });

    log.info('Viewport removed from sync group', {
      component: 'ViewportSynchronizer',
      metadata: { viewportId, groupId },
    });
  }

  // ===== Core Synchronization =====

  public synchronize(type: SyncType, sourceViewportId: string, data: Record<string, unknown>): void {
    if (!safePropertyAccess(this.settings, type)) {
      return; // Sync type is disabled
    }

    const sourceViewport = this.viewports.get(sourceViewportId);
    if (!sourceViewport) {
      log.warn('Cannot sync from non-existent viewport', {
        component: 'ViewportSynchronizer',
        metadata: { sourceViewportId, type },
      });
      return;
    }

    // Find target viewports
    const targetViewportIds = this.getTargetViewports(sourceViewportId);
    if (targetViewportIds.length === 0) {
      return; // No targets to sync to
    }

    // Create synchronization event
    const syncEvent: SynchronizationEvent = {
      type,
      sourceViewportId,
      targetViewportIds,
      data,
      timestamp: Date.now(),
    };

    // Store last sync event for deduplication
    this.lastSyncEvents.set(`${type}_${sourceViewportId}`, syncEvent);

    // Apply synchronization with debouncing
    this.debouncedSync(syncEvent);
  }

  private triggerSync(sourceViewportId: string, updates: Partial<ViewportSyncState>): void {
    // Determine which sync types to trigger based on updates
    const syncTypes: Array<{ type: SyncType; data: Record<string, unknown> }> = [];

    if (updates.windowCenter !== undefined || updates.windowWidth !== undefined) {
      syncTypes.push({
        type: 'windowLevel',
        data: {
          windowCenter: updates.windowCenter,
          windowWidth: updates.windowWidth,
        },
      });
    }

    if (updates.zoom !== undefined) {
      syncTypes.push({
        type: 'zoom',
        data: { zoom: updates.zoom },
      });
    }

    if (updates.pan !== undefined) {
      syncTypes.push({
        type: 'pan',
        data: { pan: updates.pan },
      });
    }

    if (updates.scrollIndex !== undefined) {
      syncTypes.push({
        type: 'scroll',
        data: { scrollIndex: updates.scrollIndex },
      });
    }

    if (updates.orientation !== undefined) {
      syncTypes.push({
        type: 'orientation',
        data: { orientation: updates.orientation },
      });
    }

    // Trigger synchronization for each type
    for (const { type, data } of syncTypes) {
      this.synchronize(type, sourceViewportId, data);
    }
  }

  private debouncedSync(syncEvent: SynchronizationEvent): void {
    const debounceKey = `${syncEvent.type}_${syncEvent.sourceViewportId}`;

    // Clear existing timeout
    if (this.syncTimeouts.has(debounceKey)) {
      clearTimeout(this.syncTimeouts.get(debounceKey)!);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      this.applySynchronization(syncEvent);
      this.syncTimeouts.delete(debounceKey);
    }, this.config.syncDebounceMs);

    this.syncTimeouts.set(debounceKey, timeout);
  }

  private applySynchronization(syncEvent: SynchronizationEvent): void {
    const { type, sourceViewportId, targetViewportIds, data, timestamp } = syncEvent;

    for (const targetViewportId of targetViewportIds) {
      const targetViewport = this.viewports.get(targetViewportId);
      if (!targetViewport) {
        continue;
      }

      // Skip if target has been updated more recently
      if (targetViewport.lastSyncTime > timestamp) {
        continue;
      }

      // Apply sync data based on type
      const updates: Partial<ViewportSyncState> = {};

      switch (type) {
        case 'windowLevel':
          if (data.windowCenter !== undefined) updates.windowCenter = data.windowCenter as number;
          if (data.windowWidth !== undefined) updates.windowWidth = data.windowWidth as number;
          break;

        case 'zoom':
          if (data.zoom !== undefined) updates.zoom = data.zoom as number;
          break;

        case 'pan':
          if (data.pan !== undefined) updates.pan = data.pan as [number, number];
          break;

        case 'scroll':
          if (data.scrollIndex !== undefined) updates.scrollIndex = data.scrollIndex as number;
          break;

        case 'orientation':
          if (data.orientation !== undefined) {
            updates.orientation = data.orientation as 'AXIAL' | 'SAGITTAL' | 'CORONAL';
          }
          break;
      }

      // Update target viewport without triggering another sync
      this.updateViewportState(targetViewportId, updates, false);
    }

    this.emit('synchronizationApplied', syncEvent);

    log.info('Synchronization applied', {
      component: 'ViewportSynchronizer',
      metadata: {
        type,
        sourceViewportId,
        targetCount: targetViewportIds.length,
        data,
      },
    });
  }

  private getTargetViewports(sourceViewportId: string): string[] {
    const targets = new Set<string>();

    // Find all groups containing the source viewport
    for (const [, viewportIds] of this.syncGroups) {
      if (viewportIds.has(sourceViewportId)) {
        // Add all other viewports in the group
        for (const viewportId of viewportIds) {
          if (viewportId !== sourceViewportId) {
            targets.add(viewportId);
          }
        }
      }
    }

    return Array.from(targets);
  }

  // ===== State Queries =====

  public getViewportState(viewportId: string): ViewportSyncState | null {
    return this.viewports.get(viewportId) || null;
  }

  public getAllViewportStates(): Map<string, ViewportSyncState> {
    return new Map(this.viewports);
  }

  public getSyncGroups(): Map<string, Set<string>> {
    return new Map(this.syncGroups);
  }

  public isViewportInGroup(viewportId: string, groupId: string): boolean {
    const group = this.syncGroups.get(groupId);
    return group ? group.has(viewportId) : false;
  }

  public getViewportGroups(viewportId: string): string[] {
    const groups: string[] = [];
    for (const [groupId, viewportIds] of this.syncGroups) {
      if (viewportIds.has(viewportId)) {
        groups.push(groupId);
      }
    }
    return groups;
  }

  // ===== Cross-Reference Lines =====

  public enableCrossReference(viewportId?: string): void {
    this.crossReferenceSettings.enabled = true;

    if (viewportId) {
      this.emit('crossReferenceEnabled', { viewportId });
    } else {
      this.emit('crossReferenceEnabled', { global: true });
    }

    log.info('Cross-reference lines enabled', {
      component: 'ViewportSynchronizer',
      metadata: { viewportId: viewportId || 'global' },
    });
  }

  public disableCrossReference(): void {
    this.crossReferenceSettings.enabled = false;
    this.emit('crossReferenceDisabled');

    log.info('Cross-reference lines disabled', {
      component: 'ViewportSynchronizer',
    });
  }

  // ===== Matrix Transform Synchronization =====

  public updateViewportTransform(transform: ViewportTransform): void {
    // Update the matrix transform sync service
    this.matrixTransformSync.updateViewportTransform(transform);

    // Update local viewport state if it exists
    const viewport = this.viewports.get(transform.viewportId);
    if (viewport) {
      viewport.zoom = transform.transform.scale;
      viewport.pan = [transform.transform.translate.x, transform.transform.translate.y];
      this.viewports.set(transform.viewportId, viewport);
    }

    this.emit('viewportTransformUpdated', transform);
  }

  public getViewportTransform(viewportId: string): ViewportTransform | null {
    return this.matrixTransformSync.getViewportTransform(viewportId);
  }

  public setMatrixSyncEnabled(enabled: boolean): void {
    this.matrixTransformSync.setSyncEnabled(enabled);

    log.info('Matrix transform sync toggled', {
      component: 'ViewportSynchronizer',
      metadata: { enabled },
    });
  }

  public isMatrixSyncEnabled(): boolean {
    return this.matrixTransformSync.isSyncEnabled();
  }

  public updateMatrixTransformConfig(config: Partial<MatrixTransformConfig>): void {
    this.matrixTransformSync.updateConfig(config);

    log.info('Matrix transform config updated', {
      component: 'ViewportSynchronizer',
      metadata: config,
    });
  }

  public getMatrixTransformConfig(): any {
    return this.matrixTransformSync.getConfig();
  }

  // ===== Cleanup =====

  public destroy(): void {
    // Clear all timeouts
    for (const timeout of this.syncTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.syncTimeouts.clear();

    // Dispose matrix transform sync
    this.matrixTransformSync.dispose();

    // Clear all data
    this.viewports.clear();
    this.syncGroups.clear();
    this.lastSyncEvents.clear();

    // Remove all listeners
    this.removeAllListeners();

    log.info('Viewport Synchronizer destroyed', {
      component: 'ViewportSynchronizer',
    });
  }
}

// Singleton instance for global use
export const viewportSynchronizer = new ViewportSynchronizer();
