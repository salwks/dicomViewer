/**
 * Sync Settings Persistence Hook
 * Manages saving and loading synchronization settings using secure storage
 * Built with shadcn/ui patterns and security compliance
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { SynchronizationSettings } from '../components/SynchronizationControls';
import { secureStorage } from '../security/secureStorage';
import { log } from '../utils/logger';

interface SyncSettingsProfile {
  id: string;
  name: string;
  settings: SynchronizationSettings;
  createdAt: string;
  lastUsed: string;
  isDefault?: boolean;
}

interface UseSyncSettingsPersistenceOptions {
  autoSave?: boolean;
  autoSaveDelay?: number;
  enableProfiles?: boolean;
  storagePrefix?: string;
}

interface UseSyncSettingsPersistenceReturn {
  // Current settings
  settings: SynchronizationSettings;
  updateSettings: (newSettings: SynchronizationSettings) => void;

  // Persistence operations
  saveSettings: (name?: string) => Promise<void>;
  loadSettings: (profileId?: string) => Promise<boolean>;
  deleteSettings: (profileId: string) => Promise<boolean>;

  // Profile management
  profiles: SyncSettingsProfile[];
  createProfile: (name: string, settings?: SynchronizationSettings) => Promise<string>;
  updateProfile: (profileId: string, updates: Partial<SyncSettingsProfile>) => Promise<boolean>;
  setDefaultProfile: (profileId: string) => Promise<boolean>;

  // Auto-save status
  isAutoSaving: boolean;
  lastSaved?: Date;

  // Export/Import
  exportSettings: () => Promise<string>;
  importSettings: (data: string) => Promise<boolean>;

  // Reset
  resetToDefaults: () => void;
}

const DEFAULT_SETTINGS: SynchronizationSettings = {
  enableZoom: false,
  enablePan: false,
  enableScroll: false,
  enableWindowLevel: false,
  enableReferenceLines: false,
  enableSliceSync: false,
  enableAnatomicalMapping: false,
};

const DEFAULT_OPTIONS: Required<UseSyncSettingsPersistenceOptions> = {
  autoSave: true,
  autoSaveDelay: 1000, // 1 second
  enableProfiles: true,
  storagePrefix: 'sync-settings',
};

export function useSyncSettingsPersistence(
  initialSettings?: Partial<SynchronizationSettings>,
  options: UseSyncSettingsPersistenceOptions = {},
): UseSyncSettingsPersistenceReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // State management
  const [settings, setSettings] = useState<SynchronizationSettings>({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
  });
  const [profiles, setProfiles] = useState<SyncSettingsProfile[]>([]);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date>();

  // Refs for managing auto-save
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isInitializedRef = useRef(false);

  // Storage keys
  const getStorageKey = useCallback((suffix: string): string => {
    return `${opts.storagePrefix}-${suffix}`;
  }, [opts.storagePrefix]);

  // Initialize secure storage
  useEffect(() => {
    const initializeStorage = async (): Promise<void> => {
      try {
        // Initialize with a session-based key (in production, use proper key management)
        const sessionKey = `sync-settings-${Date.now()}`;
        if (!secureStorage) {
          throw new Error('Secure storage not available');
        }
        secureStorage.initialize(sessionKey);

        log.info('Sync settings persistence initialized', {
          component: 'useSyncSettingsPersistence',
          metadata: { autoSave: opts.autoSave, enableProfiles: opts.enableProfiles },
        });
      } catch (error) {
        log.error(
          'Failed to initialize sync settings persistence',
          { component: 'useSyncSettingsPersistence' },
          error as Error,
        );
      }
    };

    initializeStorage();
  }, [opts.autoSave, opts.enableProfiles]);

  // Load settings and profiles on mount
  useEffect(() => {
    const loadInitialData = async (): Promise<void> => {
      if (isInitializedRef.current) return;

      try {
        // Load current settings
        await loadSettings();

        // Load profiles if enabled
        if (opts.enableProfiles) {
          await loadProfiles();
        }

        isInitializedRef.current = true;

        log.info('Initial sync settings data loaded', {
          component: 'useSyncSettingsPersistence',
        });
      } catch (error) {
        log.error(
          'Failed to load initial sync settings data',
          { component: 'useSyncSettingsPersistence' },
          error as Error,
        );
      }
    };

    loadInitialData();
  }, [opts.enableProfiles, loadSettings, loadProfiles]);

  // Auto-save functionality
  useEffect(() => {
    if (!opts.autoSave || !isInitializedRef.current) return;

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save
    autoSaveTimeoutRef.current = setTimeout(() => {
      saveSettings();
    }, opts.autoSaveDelay);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [settings, opts.autoSave, opts.autoSaveDelay, saveSettings]);

  // Load profiles from storage
  const loadProfiles = useCallback(async (): Promise<void> => {
    try {
      const profilesData = await secureStorage.retrieve(getStorageKey('profiles'));
      if (profilesData) {
        const loadedProfiles: SyncSettingsProfile[] = JSON.parse(profilesData);
        setProfiles(loadedProfiles);

        log.info('Sync settings profiles loaded', {
          component: 'useSyncSettingsPersistence',
          metadata: { count: loadedProfiles.length },
        });
      }
    } catch (error) {
      log.error(
        'Failed to load sync settings profiles',
        { component: 'useSyncSettingsPersistence' },
        error as Error,
      );
    }
  }, [getStorageKey]);

  // Save profiles to storage
  const saveProfiles = useCallback(async (updatedProfiles: SyncSettingsProfile[]): Promise<void> => {
    try {
      await secureStorage.store(
        getStorageKey('profiles'),
        JSON.stringify(updatedProfiles),
        'sync-settings-profiles',
        { encrypt: true },
      );

      log.info('Sync settings profiles saved', {
        component: 'useSyncSettingsPersistence',
        metadata: { count: updatedProfiles.length },
      });
    } catch (error) {
      log.error(
        'Failed to save sync settings profiles',
        { component: 'useSyncSettingsPersistence' },
        error as Error,
      );
      throw error;
    }
  }, [getStorageKey]);

  // Update settings with validation
  const updateSettings = useCallback((newSettings: SynchronizationSettings): void => {
    // Validate settings object
    const validatedSettings = { ...DEFAULT_SETTINGS };

    // Safe property copying
    Object.keys(DEFAULT_SETTINGS).forEach(key => {
      const settingKey = key as keyof SynchronizationSettings;
      if (Object.prototype.hasOwnProperty.call(newSettings, settingKey)) {
        const value = newSettings[settingKey];
        if (typeof value === 'boolean') {
          validatedSettings[settingKey] = value;
        }
      }
    });

    setSettings(validatedSettings);

    log.info('Sync settings updated', {
      component: 'useSyncSettingsPersistence',
      metadata: {
        activeCount: Object.values(validatedSettings).filter(Boolean).length,
        changes: Object.keys(validatedSettings).filter(
          key => validatedSettings[key as keyof SynchronizationSettings] !==
                 settings[key as keyof SynchronizationSettings],
        ),
      },
    });
  }, [settings]);

  // Save current settings
  const saveSettings = useCallback(async (name?: string): Promise<void> => {
    if (isAutoSaving) return;

    setIsAutoSaving(true);

    try {
      // Save current settings
      await secureStorage.store(
        getStorageKey('current'),
        JSON.stringify(settings),
        'sync-settings-current',
        { encrypt: true },
      );

      // If name provided, create/update profile
      if (name && opts.enableProfiles) {
        await createProfile(name, settings);
      }

      setLastSaved(new Date());

      log.info('Sync settings saved', {
        component: 'useSyncSettingsPersistence',
        metadata: {
          profileName: name,
          activeCount: Object.values(settings).filter(Boolean).length,
        },
      });
    } catch (error) {
      log.error(
        'Failed to save sync settings',
        { component: 'useSyncSettingsPersistence', metadata: { profileName: name } },
        error as Error,
      );
      throw error;
    } finally {
      setIsAutoSaving(false);
    }
  }, [settings, isAutoSaving, getStorageKey, opts.enableProfiles, createProfile]);

  // Load settings from storage
  const loadSettings = useCallback(async (profileId?: string): Promise<boolean> => {
    try {
      let settingsData: string | null = null;

      if (profileId && opts.enableProfiles) {
        // Load from specific profile
        const profile = profiles.find(p => p.id === profileId);
        if (profile) {
          setSettings(profile.settings);

          // Update last used timestamp
          const updatedProfiles = profiles.map(p =>
            p.id === profileId ? { ...p, lastUsed: new Date().toISOString() } : p,
          );
          setProfiles(updatedProfiles);
          await saveProfiles(updatedProfiles);

          log.info('Sync settings loaded from profile', {
            component: 'useSyncSettingsPersistence',
            metadata: { profileId, profileName: profile.name },
          });

          return true;
        } else {
          log.warn('Profile not found', {
            component: 'useSyncSettingsPersistence',
            metadata: { profileId },
          });
          return false;
        }
      } else {
        // Load current settings
        settingsData = await secureStorage.retrieve(getStorageKey('current'));
      }

      if (settingsData) {
        const loadedSettings: SynchronizationSettings = JSON.parse(settingsData);
        updateSettings(loadedSettings);

        log.info('Sync settings loaded', {
          component: 'useSyncSettingsPersistence',
          metadata: {
            source: profileId ? 'profile' : 'current',
            activeCount: Object.values(loadedSettings).filter(Boolean).length,
          },
        });

        return true;
      } else if (!profileId) {
        // No saved settings, use defaults
        log.info('No saved sync settings found, using defaults', {
          component: 'useSyncSettingsPersistence',
        });
      }

      return false;
    } catch (error) {
      log.error(
        'Failed to load sync settings',
        { component: 'useSyncSettingsPersistence', metadata: { profileId } },
        error as Error,
      );
      return false;
    }
  }, [profiles, updateSettings, getStorageKey, opts.enableProfiles, saveProfiles]);

  // Delete settings profile
  const deleteSettings = useCallback(async (profileId: string): Promise<boolean> => {
    try {
      const updatedProfiles = profiles.filter(p => p.id !== profileId);
      setProfiles(updatedProfiles);
      await saveProfiles(updatedProfiles);

      log.info('Sync settings profile deleted', {
        component: 'useSyncSettingsPersistence',
        metadata: { profileId },
      });

      return true;
    } catch (error) {
      log.error(
        'Failed to delete sync settings profile',
        { component: 'useSyncSettingsPersistence', metadata: { profileId } },
        error as Error,
      );
      return false;
    }
  }, [profiles, saveProfiles]);

  // Create new profile
  const createProfile = useCallback(async (
    name: string,
    profileSettings?: SynchronizationSettings,
  ): Promise<string> => {
    try {
      const profileId = `profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newProfile: SyncSettingsProfile = {
        id: profileId,
        name,
        settings: profileSettings || settings,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
      };

      const updatedProfiles = [...profiles, newProfile];
      setProfiles(updatedProfiles);
      await saveProfiles(updatedProfiles);

      log.info('Sync settings profile created', {
        component: 'useSyncSettingsPersistence',
        metadata: { profileId, name },
      });

      return profileId;
    } catch (error) {
      log.error(
        'Failed to create sync settings profile',
        { component: 'useSyncSettingsPersistence', metadata: { name } },
        error as Error,
      );
      throw error;
    }
  }, [settings, profiles, saveProfiles]);

  // Update profile
  const updateProfile = useCallback(async (
    profileId: string,
    updates: Partial<SyncSettingsProfile>,
  ): Promise<boolean> => {
    try {
      const updatedProfiles = profiles.map(profile =>
        profile.id === profileId ? { ...profile, ...updates } : profile,
      );

      setProfiles(updatedProfiles);
      await saveProfiles(updatedProfiles);

      log.info('Sync settings profile updated', {
        component: 'useSyncSettingsPersistence',
        metadata: { profileId, updates: Object.keys(updates) },
      });

      return true;
    } catch (error) {
      log.error(
        'Failed to update sync settings profile',
        { component: 'useSyncSettingsPersistence', metadata: { profileId } },
        error as Error,
      );
      return false;
    }
  }, [profiles, saveProfiles]);

  // Set default profile
  const setDefaultProfile = useCallback(async (profileId: string): Promise<boolean> => {
    try {
      const updatedProfiles = profiles.map(profile => ({
        ...profile,
        isDefault: profile.id === profileId,
      }));

      setProfiles(updatedProfiles);
      await saveProfiles(updatedProfiles);

      log.info('Default sync settings profile set', {
        component: 'useSyncSettingsPersistence',
        metadata: { profileId },
      });

      return true;
    } catch (error) {
      log.error(
        'Failed to set default sync settings profile',
        { component: 'useSyncSettingsPersistence', metadata: { profileId } },
        error as Error,
      );
      return false;
    }
  }, [profiles, saveProfiles]);

  // Export settings
  const exportSettings = useCallback(async (): Promise<string> => {
    try {
      const exportData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        settings,
        profiles: opts.enableProfiles ? profiles : [],
      };

      const exportString = JSON.stringify(exportData, null, 2);

      log.info('Sync settings exported', {
        component: 'useSyncSettingsPersistence',
        metadata: { profileCount: profiles.length },
      });

      return exportString;
    } catch (error) {
      log.error(
        'Failed to export sync settings',
        { component: 'useSyncSettingsPersistence' },
        error as Error,
      );
      throw error;
    }
  }, [settings, profiles, opts.enableProfiles]);

  // Import settings
  const importSettings = useCallback(async (data: string): Promise<boolean> => {
    try {
      const importData = JSON.parse(data);

      // Validate import data structure
      if (!importData.settings || typeof importData.settings !== 'object') {
        throw new Error('Invalid import data: missing settings');
      }

      // Import settings
      updateSettings(importData.settings);

      // Import profiles if enabled and available
      if (opts.enableProfiles && Array.isArray(importData.profiles)) {
        // Merge with existing profiles (avoiding duplicates by name)
        const existingNames = new Set(profiles.map(p => p.name));
        const newProfiles = importData.profiles.filter(
          (p: SyncSettingsProfile) => !existingNames.has(p.name),
        );

        if (newProfiles.length > 0) {
          const updatedProfiles = [...profiles, ...newProfiles];
          setProfiles(updatedProfiles);
          await saveProfiles(updatedProfiles);
        }
      }

      // Save imported settings
      await saveSettings();

      log.info('Sync settings imported', {
        component: 'useSyncSettingsPersistence',
        metadata: {
          version: importData.version,
          profileCount: importData.profiles?.length || 0,
        },
      });

      return true;
    } catch (error) {
      log.error(
        'Failed to import sync settings',
        { component: 'useSyncSettingsPersistence' },
        error as Error,
      );
      return false;
    }
  }, [updateSettings, profiles, opts.enableProfiles, saveProfiles, saveSettings]);

  // Reset to defaults
  const resetToDefaults = useCallback((): void => {
    updateSettings(DEFAULT_SETTINGS);

    log.info('Sync settings reset to defaults', {
      component: 'useSyncSettingsPersistence',
    });
  }, [updateSettings]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  return {
    // Current settings
    settings,
    updateSettings,

    // Persistence operations
    saveSettings,
    loadSettings,
    deleteSettings,

    // Profile management
    profiles,
    createProfile,
    updateProfile,
    setDefaultProfile,

    // Auto-save status
    isAutoSaving,
    lastSaved,

    // Export/Import
    exportSettings,
    importSettings,

    // Reset
    resetToDefaults,
  };
}
