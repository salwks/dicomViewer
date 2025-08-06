/**
 * Sync Toggle Manager
 * Manages selective synchronization settings per viewport and feature
 */

import { EventEmitter } from 'events';
import { log } from '../utils/logger';
import { secureStorage } from '../security/secureStorage';

export interface SyncFeatures {
  scroll: boolean;
  windowLevel: boolean;
  zoom: boolean;
  pan: boolean;
  crossReference: boolean;
  orientation: boolean;
}

export interface ViewportSyncSettings {
  viewportId: string;
  enabled: boolean;
  features: SyncFeatures;
  groupId?: string;
  priority?: number; // Higher priority viewports take precedence in conflicts
}

export interface SyncToggleConfig {
  enablePersistence: boolean;
  storageKey: string;
  debounceMs: number;
  defaultSettings: Partial<SyncFeatures>;
}

export const DEFAULT_SYNC_FEATURES: SyncFeatures = {
  scroll: true,
  windowLevel: true,
  zoom: true,
  pan: true,
  crossReference: false,
  orientation: false,
};

export const DEFAULT_SYNC_TOGGLE_CONFIG: SyncToggleConfig = {
  enablePersistence: true,
  storageKey: 'viewer_sync_settings',
  debounceMs: 100,
  defaultSettings: DEFAULT_SYNC_FEATURES,
};

export interface SyncToggleEvents {
  'settings-changed': [string, ViewportSyncSettings]; // [viewportId, settings]
  'feature-toggled': [string, keyof SyncFeatures, boolean]; // [viewportId, feature, enabled]
  'group-sync-changed': [string, boolean]; // [groupId, enabled]
  'global-sync-changed': [boolean]; // [enabled]
  'settings-loaded': [Map<string, ViewportSyncSettings>]; // [allSettings]
}

export class SyncToggleManager extends EventEmitter {
  private config: SyncToggleConfig;
  private viewportSettings = new Map<string, ViewportSyncSettings>();
  private syncGroups = new Map<string, Set<string>>(); // groupId -> viewportIds
  private debounceTimeouts = new Map<string, NodeJS.Timeout>();
  private globalSyncEnabled = true;

  constructor(config: Partial<SyncToggleConfig> = {}) {
    super();
    this.config = { ...DEFAULT_SYNC_TOGGLE_CONFIG, ...config };
    this.initializeManager();
  }

  private async initializeManager(): Promise<void> {
    log.info('Initializing Sync Toggle Manager', {
      component: 'SyncToggleManager',
      metadata: { config: this.config },
    });

    // Load persisted settings if enabled
    if (this.config.enablePersistence) {
      await this.loadPersistedSettings();
    }

    // Create default sync group
    this.syncGroups.set('default', new Set());
  }

  // ===== Viewport Settings Management =====

  public setViewportSyncSettings(settings: Partial<ViewportSyncSettings> & { viewportId: string }): void {
    const existingSettings = this.viewportSettings.get(settings.viewportId);

    const newSettings: ViewportSyncSettings = {
      enabled: true,
      features: { ...DEFAULT_SYNC_FEATURES, ...this.config.defaultSettings },
      priority: 1,
      ...existingSettings,
      ...settings,
    };

    this.viewportSettings.set(settings.viewportId, newSettings);

    // Add to sync group if specified
    if (newSettings.groupId) {
      this.addViewportToGroup(settings.viewportId, newSettings.groupId);
    } else {
      // Add to default group
      this.addViewportToGroup(settings.viewportId, 'default');
    }

    this.emit('settings-changed', settings.viewportId, newSettings);
    this.debouncedPersist();

    log.info('Viewport sync settings updated', {
      component: 'SyncToggleManager',
      metadata: { viewportId: settings.viewportId, settings: newSettings },
    });
  }

  public getViewportSyncSettings(viewportId: string): ViewportSyncSettings | null {
    return this.viewportSettings.get(viewportId) || null;
  }

  public getAllViewportSettings(): Map<string, ViewportSyncSettings> {
    return new Map(this.viewportSettings);
  }

  public removeViewportSettings(viewportId: string): void {
    const settings = this.viewportSettings.get(viewportId);
    if (!settings) return;

    // Remove from sync groups
    if (settings.groupId) {
      this.removeViewportFromGroup(viewportId, settings.groupId);
    }
    this.removeViewportFromGroup(viewportId, 'default');

    this.viewportSettings.delete(viewportId);
    this.debouncedPersist();

    log.info('Viewport sync settings removed', {
      component: 'SyncToggleManager',
      metadata: { viewportId },
    });
  }

  // ===== Feature Toggle Management =====

  public toggleViewportFeature(viewportId: string, feature: keyof SyncFeatures, enabled: boolean): void {
    const settings = this.viewportSettings.get(viewportId);
    if (!settings) {
      log.warn('Cannot toggle feature for non-existent viewport', {
        component: 'SyncToggleManager',
        metadata: { viewportId, feature },
      });
      return;
    }

    // eslint-disable-next-line security/detect-object-injection -- Safe: feature is keyof SyncFeatures
    settings.features[feature] = enabled;
    this.viewportSettings.set(viewportId, settings);

    this.emit('feature-toggled', viewportId, feature, enabled);
    this.emit('settings-changed', viewportId, settings);
    this.debouncedPersist();

    log.info('Viewport feature toggled', {
      component: 'SyncToggleManager',
      metadata: { viewportId, feature, enabled },
    });
  }

  public isViewportFeatureEnabled(viewportId: string, feature: keyof SyncFeatures): boolean {
    if (!this.globalSyncEnabled) return false;

    const settings = this.viewportSettings.get(viewportId);
    if (!settings || !settings.enabled) return false;

    // eslint-disable-next-line security/detect-object-injection -- Safe: feature is keyof SyncFeatures
    return settings.features[feature];
  }

  public toggleAllFeatures(enabled: boolean): void {
    for (const [viewportId, settings] of this.viewportSettings) {
      settings.enabled = enabled;
      this.emit('settings-changed', viewportId, settings);
    }

    this.debouncedPersist();

    log.info('All viewport sync features toggled', {
      component: 'SyncToggleManager',
      metadata: { enabled },
    });
  }

  // ===== Group Management =====

  public addViewportToGroup(viewportId: string, groupId: string): void {
    let group = this.syncGroups.get(groupId);
    if (!group) {
      group = new Set();
      this.syncGroups.set(groupId, group);
    }

    group.add(viewportId);

    // Update viewport settings with group assignment
    const settings = this.viewportSettings.get(viewportId);
    if (settings) {
      settings.groupId = groupId;
      this.viewportSettings.set(viewportId, settings);
    }

    log.info('Viewport added to sync group', {
      component: 'SyncToggleManager',
      metadata: { viewportId, groupId },
    });
  }

  public removeViewportFromGroup(viewportId: string, groupId: string): void {
    const group = this.syncGroups.get(groupId);
    if (!group) return;

    group.delete(viewportId);

    // Remove empty groups except default
    if (group.size === 0 && groupId !== 'default') {
      this.syncGroups.delete(groupId);
    }

    log.info('Viewport removed from sync group', {
      component: 'SyncToggleManager',
      metadata: { viewportId, groupId },
    });
  }

  public getGroupViewports(groupId: string): string[] {
    const group = this.syncGroups.get(groupId);
    return group ? Array.from(group) : [];
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

  public toggleGroupSync(groupId: string, enabled: boolean): void {
    const viewportIds = this.getGroupViewports(groupId);

    for (const viewportId of viewportIds) {
      const settings = this.viewportSettings.get(viewportId);
      if (settings) {
        settings.enabled = enabled;
        this.emit('settings-changed', viewportId, settings);
      }
    }

    this.emit('group-sync-changed', groupId, enabled);
    this.debouncedPersist();

    log.info('Group sync toggled', {
      component: 'SyncToggleManager',
      metadata: { groupId, enabled, affectedViewports: viewportIds.length },
    });
  }

  // ===== Global Sync Control =====

  public setGlobalSyncEnabled(enabled: boolean): void {
    this.globalSyncEnabled = enabled;
    this.emit('global-sync-changed', enabled);

    log.info('Global sync toggled', {
      component: 'SyncToggleManager',
      metadata: { enabled },
    });
  }

  public isGlobalSyncEnabled(): boolean {
    return this.globalSyncEnabled;
  }

  // ===== Sync Query Methods =====

  public shouldSyncViewports(sourceViewportId: string, targetViewportId: string, feature: keyof SyncFeatures): boolean {
    // Check global sync first
    if (!this.globalSyncEnabled) return false;

    // Check if both viewports have the feature enabled
    const sourceEnabled = this.isViewportFeatureEnabled(sourceViewportId, feature);
    const targetEnabled = this.isViewportFeatureEnabled(targetViewportId, feature);

    if (!sourceEnabled || !targetEnabled) return false;

    // Check if viewports are in the same sync group
    const sourceGroups = this.getViewportGroups(sourceViewportId);
    const targetGroups = this.getViewportGroups(targetViewportId);

    return sourceGroups.some(group => targetGroups.includes(group));
  }

  public getSyncTargets(sourceViewportId: string, feature: keyof SyncFeatures): string[] {
    if (!this.isViewportFeatureEnabled(sourceViewportId, feature)) {
      return [];
    }

    const sourceGroups = this.getViewportGroups(sourceViewportId);
    const targets = new Set<string>();

    for (const groupId of sourceGroups) {
      const groupViewports = this.getGroupViewports(groupId);
      for (const viewportId of groupViewports) {
        if (viewportId !== sourceViewportId && this.isViewportFeatureEnabled(viewportId, feature)) {
          targets.add(viewportId);
        }
      }
    }

    return Array.from(targets);
  }

  // ===== Persistence =====

  private debouncedPersist(): void {
    if (!this.config.enablePersistence) return;

    // Clear existing timeout
    const existingTimeout = this.debounceTimeouts.get('persist');
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      this.persistSettings();
      this.debounceTimeouts.delete('persist');
    }, this.config.debounceMs) as NodeJS.Timeout;

    this.debounceTimeouts.set('persist', timeout);
  }

  private async persistSettings(): Promise<void> {
    try {
      const settingsData = {
        viewportSettings: Array.from(this.viewportSettings.entries()),
        syncGroups: Array.from(this.syncGroups.entries()).map(([groupId, viewportIds]) => [
          groupId,
          Array.from(viewportIds),
        ]),
        globalSyncEnabled: this.globalSyncEnabled,
        timestamp: Date.now(),
      };

      await secureStorage.store(this.config.storageKey, JSON.stringify(settingsData), 'sync-settings');

      log.info('Sync settings persisted', {
        component: 'SyncToggleManager',
        metadata: { settingsCount: this.viewportSettings.size },
      });
    } catch (error) {
      log.error('Failed to persist sync settings', {
        component: 'SyncToggleManager',
      }, error as Error);
    }
  }

  private async loadPersistedSettings(): Promise<void> {
    try {
      const settingsJson = await secureStorage.retrieve(this.config.storageKey);
      if (!settingsJson) return;

      const settingsData = JSON.parse(settingsJson);

      // Restore viewport settings
      if (settingsData.viewportSettings) {
        this.viewportSettings = new Map(settingsData.viewportSettings);
      }

      // Restore sync groups
      if (settingsData.syncGroups) {
        this.syncGroups = new Map(
          settingsData.syncGroups.map(([groupId, viewportIds]: [string, string[]]) => [
            groupId,
            new Set(viewportIds),
          ]),
        );
      }

      // Restore global sync state
      if (typeof settingsData.globalSyncEnabled === 'boolean') {
        this.globalSyncEnabled = settingsData.globalSyncEnabled;
      }

      this.emit('settings-loaded', this.viewportSettings);

      log.info('Sync settings loaded', {
        component: 'SyncToggleManager',
        metadata: {
          settingsCount: this.viewportSettings.size,
          groupsCount: this.syncGroups.size,
        },
      });
    } catch (error) {
      log.error('Failed to load persisted sync settings', {
        component: 'SyncToggleManager',
      }, error as Error);
    }
  }

  // ===== Configuration =====

  public updateConfig(config: Partial<SyncToggleConfig>): void {
    this.config = { ...this.config, ...config };

    log.info('Sync toggle config updated', {
      component: 'SyncToggleManager',
      metadata: config,
    });
  }

  public getConfig(): SyncToggleConfig {
    return { ...this.config };
  }

  // ===== Cleanup =====

  public dispose(): void {
    // Clear debounce timeouts
    for (const timeout of this.debounceTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.debounceTimeouts.clear();

    // Persist final state
    if (this.config.enablePersistence) {
      this.persistSettings();
    }

    // Clear data structures
    this.viewportSettings.clear();
    this.syncGroups.clear();

    // Remove event listeners
    this.removeAllListeners();

    log.info('SyncToggleManager disposed', {
      component: 'SyncToggleManager',
    });
  }
}

// Singleton instance
export const syncToggleManager = new SyncToggleManager();

