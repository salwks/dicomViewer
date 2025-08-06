/**
 * Viewport Configuration Manager Service
 * Advanced configuration management with profiles, templates, and validation
 * Handles viewport settings, presets, user preferences, and system defaults
 */

import { EventEmitter } from 'events';
import { secureStorage } from '../security/secureStorage';
import { log } from '../utils/logger';
import { safePropertySet } from '../lib/utils';

interface RegExpLike {
  test(string: string): boolean;
}

export interface ViewportConfiguration {
  id: string;
  name: string;
  description?: string;
  viewport: {
    defaultType: 'stack' | 'volume' | 'multiplanar';
    rendering: {
      interpolationType: 'LINEAR' | 'NEAREST';
      quality: 'low' | 'medium' | 'high';
      useCPURendering: boolean;
      enableGPUAcceleration: boolean;
    };
    display: {
      windowLevel: {
        width: number;
        center: number;
        presets: WindowLevelPreset[];
      };
      colormap: string;
      invertColors: boolean;
      opacity: number;
    };
    interaction: {
      enablePan: boolean;
      enableZoom: boolean;
      enableWindowLevel: boolean;
      enableRotation: boolean;
      sensitivity: {
        pan: number;
        zoom: number;
        windowLevel: number;
      };
      constraints: {
        minZoom: number;
        maxZoom: number;
        panBounds?: { x: number; y: number; width: number; height: number };
      };
    };
    tools: {
      defaultTool: string;
      enabledTools: string[];
      toolSettings: Record<string, Record<string, unknown>>;
    };
    synchronization: {
      enabledByDefault: boolean;
      syncTypes: ('windowLevel' | 'zoom' | 'pan' | 'scroll')[];
      autoGrouping: boolean;
    };
  };
  layout: {
    defaultLayout: string;
    allowedLayouts: string[];
    customLayouts: LayoutConfiguration[];
  };
  performance: {
    enableOptimization: boolean;
    cacheSize: number;
    renderPriority: 'quality' | 'performance' | 'balanced';
    memoryLimit: number; // MB
  };
  metadata: {
    createdAt: string;
    modifiedAt: string;
    version: string;
    createdBy?: string;
    tags: string[];
    isDefault: boolean;
    isReadOnly: boolean;
  };
}

export interface WindowLevelPreset {
  name: string;
  description?: string;
  window: number;
  level: number;
  modality?: string[];
  bodyPart?: string[];
}

export interface LayoutConfiguration {
  id: string;
  name: string;
  rows: number;
  columns: number;
  viewportSettings: ViewportSlotConfiguration[];
}

export interface ViewportSlotConfiguration {
  row: number;
  col: number;
  defaultType?: 'stack' | 'volume' | 'multiplanar';
  initialState?: Record<string, unknown>;
  constraints?: {
    allowedTypes?: ('stack' | 'volume' | 'multiplanar')[];
    readOnly?: boolean;
  };
}

export interface ConfigurationProfile {
  id: string;
  name: string;
  description?: string;
  configurations: string[]; // Configuration IDs
  priority: number;
  conditions: ProfileCondition[];
  metadata: {
    createdAt: string;
    modifiedAt: string;
    isActive: boolean;
    isSystem: boolean;
  };
}

export interface ProfileCondition {
  type: 'modality' | 'bodyPart' | 'studyDescription' | 'userRole' | 'custom';
  operator: 'equals' | 'contains' | 'matches' | 'in' | 'not';
  value: string | string[];
  weight: number; // 0-1, for scoring profile matches
}

export interface ConfigurationManagerConfig {
  enableProfiles: boolean;
  enableTemplates: boolean;
  enableUserPreferences: boolean;
  enableValidation: boolean;
  persistence: {
    enabled: boolean;
    strategy: 'local' | 'session' | 'secure';
    autoSave: boolean;
    saveInterval: number; // milliseconds
  };
  validation: {
    strictMode: boolean;
    validateOnLoad: boolean;
    validateOnSave: boolean;
  };
  profiles: {
    enableAutoSelection: boolean;
    maxActiveProfiles: number;
    fallbackProfile?: string;
  };
}

export const DEFAULT_CONFIGURATION_MANAGER_CONFIG: ConfigurationManagerConfig = {
  enableProfiles: true,
  enableTemplates: true,
  enableUserPreferences: true,
  enableValidation: true,
  persistence: {
    enabled: true,
    strategy: 'secure',
    autoSave: true,
    saveInterval: 10000, // 10 seconds
  },
  validation: {
    strictMode: false,
    validateOnLoad: true,
    validateOnSave: true,
  },
  profiles: {
    enableAutoSelection: true,
    maxActiveProfiles: 3,
    fallbackProfile: 'default',
  },
};

export const DEFAULT_WINDOW_LEVEL_PRESETS: WindowLevelPreset[] = [
  { name: 'Lung', window: 1500, level: -600, modality: ['CT'], bodyPart: ['CHEST', 'LUNG'] },
  { name: 'Mediastinum', window: 350, level: 50, modality: ['CT'], bodyPart: ['CHEST'] },
  { name: 'Abdomen', window: 400, level: 50, modality: ['CT'], bodyPart: ['ABDOMEN'] },
  { name: 'Brain', window: 80, level: 40, modality: ['CT'], bodyPart: ['HEAD', 'BRAIN'] },
  { name: 'Bone', window: 2000, level: 300, modality: ['CT'] },
  { name: 'Soft Tissue', window: 400, level: 40, modality: ['CT'] },
  { name: 'T1', window: 500, level: 250, modality: ['MR'] },
  { name: 'T2', window: 1000, level: 500, modality: ['MR'] },
  { name: 'FLAIR', window: 2000, level: 1000, modality: ['MR'] },
];

export interface ViewportConfigurationManagerEvents {
  'configuration-created': [ViewportConfiguration];
  'configuration-updated': [ViewportConfiguration];
  'configuration-deleted': [string];
  'configuration-applied': [string, ViewportConfiguration]; // [viewportId, config]
  'profile-activated': [ConfigurationProfile];
  'profile-deactivated': [ConfigurationProfile];
  'validation-error': [string, ValidationError[]]; // [configId, errors]
  'auto-save-completed': [string[]]; // [configIds]
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  code: string;
}

export class ViewportConfigurationManager extends EventEmitter {
  private config: ConfigurationManagerConfig;
  private configurations = new Map<string, ViewportConfiguration>();
  private profiles = new Map<string, ConfigurationProfile>();
  private activeProfiles = new Set<string>();
  private userPreferences: Record<string, unknown> = {};
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private pendingChanges = new Set<string>();

  constructor(config: Partial<ConfigurationManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIGURATION_MANAGER_CONFIG, ...config };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    log.info('ViewportConfigurationManager initializing', {
      component: 'ViewportConfigurationManager',
      metadata: {
        enableProfiles: this.config.enableProfiles,
        persistenceEnabled: this.config.persistence.enabled,
      },
    });

    // Load default configurations
    await this.loadDefaultConfigurations();

    // Load saved configurations if persistence is enabled
    if (this.config.persistence.enabled) {
      // In development, clear potentially corrupted data first
      if (process.env.NODE_ENV !== 'production') {
        try {
          await secureStorage.clearCorruptedData();
        } catch {
          // Ignore cleanup errors
        }
      }

      await this.loadPersistedConfigurations();
      await this.loadPersistedProfiles();
      await this.loadUserPreferences();
    }

    // Setup auto-save if enabled
    if (this.config.persistence.autoSave) {
      this.setupAutoSave();
    }

    // Activate default profiles
    if (this.config.enableProfiles) {
      await this.activateDefaultProfiles();
    }
  }

  // ===== Configuration Management =====

  public createConfiguration(
    name: string,
    configData: Partial<ViewportConfiguration['viewport']>,
    options: {
      description?: string;
      tags?: string[];
      isDefault?: boolean;
      isReadOnly?: boolean;
    } = {},
  ): ViewportConfiguration {
    const now = new Date().toISOString();

    const configuration: ViewportConfiguration = {
      id: this.generateConfigurationId(),
      name,
      description: options.description,
      viewport: this.mergeWithDefaults(configData),
      layout: {
        defaultLayout: '2x2',
        allowedLayouts: ['1x1', '1x2', '2x2', '2x3'],
        customLayouts: [],
      },
      performance: {
        enableOptimization: true,
        cacheSize: 256, // MB
        renderPriority: 'balanced',
        memoryLimit: 512, // MB
      },
      metadata: {
        createdAt: now,
        modifiedAt: now,
        version: '1.0.0',
        tags: options.tags || [],
        isDefault: options.isDefault || false,
        isReadOnly: options.isReadOnly || false,
      },
    };

    // Validate configuration if enabled
    if (this.config.enableValidation) {
      const validation = this.validateConfiguration(configuration);
      if (!validation.isValid) {
        this.emit('validation-error', configuration.id, validation.errors);
        if (this.config.validation.strictMode) {
          throw new Error(`Configuration validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
        }
      }
    }

    this.configurations.set(configuration.id, configuration);
    this.markForAutoSave(configuration.id);

    this.emit('configuration-created', configuration);

    log.info('Viewport configuration created', {
      component: 'ViewportConfigurationManager',
      metadata: { configId: configuration.id, name },
    });

    return configuration;
  }

  public updateConfiguration(configId: string, updates: Partial<ViewportConfiguration>): ViewportConfiguration {
    const existing = this.configurations.get(configId);
    if (!existing) {
      throw new Error(`Configuration not found: ${configId}`);
    }

    if (existing.metadata.isReadOnly) {
      throw new Error(`Cannot update read-only configuration: ${configId}`);
    }

    // Deep merge updates
    const updated: ViewportConfiguration = {
      ...existing,
      ...updates,
      metadata: {
        ...existing.metadata,
        ...updates.metadata,
        modifiedAt: new Date().toISOString(),
      },
    };

    // Validate updated configuration
    if (this.config.enableValidation && this.config.validation.validateOnSave) {
      const validation = this.validateConfiguration(updated);
      if (!validation.isValid) {
        this.emit('validation-error', configId, validation.errors);
        if (this.config.validation.strictMode) {
          throw new Error(`Configuration validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
        }
      }
    }

    this.configurations.set(configId, updated);
    this.markForAutoSave(configId);

    this.emit('configuration-updated', updated);

    log.info('Viewport configuration updated', {
      component: 'ViewportConfigurationManager',
      metadata: { configId, updateKeys: Object.keys(updates) },
    });

    return updated;
  }

  public deleteConfiguration(configId: string): boolean {
    const configuration = this.configurations.get(configId);
    if (!configuration) {
      return false;
    }

    if (configuration.metadata.isReadOnly || configuration.metadata.isDefault) {
      throw new Error(`Cannot delete protected configuration: ${configId}`);
    }

    this.configurations.delete(configId);
    this.pendingChanges.delete(configId);

    this.emit('configuration-deleted', configId);

    log.info('Viewport configuration deleted', {
      component: 'ViewportConfigurationManager',
      metadata: { configId, name: configuration.name },
    });

    return true;
  }

  public getConfiguration(configId: string): ViewportConfiguration | null {
    const config = this.configurations.get(configId);
    return config ? { ...config } : null;
  }

  public getAllConfigurations(): ViewportConfiguration[] {
    return Array.from(this.configurations.values()).map(config => ({ ...config }));
  }

  public getConfigurationsByTag(tag: string): ViewportConfiguration[] {
    return Array.from(this.configurations.values())
      .filter(config => config.metadata.tags.includes(tag))
      .map(config => ({ ...config }));
  }

  // ===== Profile Management =====

  public createProfile(
    name: string,
    configurationIds: string[],
    conditions: ProfileCondition[] = [],
    options: {
      description?: string;
      priority?: number;
    } = {},
  ): ConfigurationProfile {
    // Validate configuration IDs exist
    const invalidIds = configurationIds.filter(id => !this.configurations.has(id));
    if (invalidIds.length > 0) {
      throw new Error(`Invalid configuration IDs: ${invalidIds.join(', ')}`);
    }

    const profile: ConfigurationProfile = {
      id: this.generateProfileId(),
      name,
      description: options.description,
      configurations: configurationIds,
      priority: options.priority || 0,
      conditions,
      metadata: {
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        isActive: false,
        isSystem: false,
      },
    };

    this.profiles.set(profile.id, profile);

    log.info('Configuration profile created', {
      component: 'ViewportConfigurationManager',
      metadata: { profileId: profile.id, name, configCount: configurationIds.length },
    });

    return profile;
  }

  public activateProfile(profileId: string): ConfigurationProfile {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    // Check active profile limit
    if (this.activeProfiles.size >= this.config.profiles.maxActiveProfiles) {
      const oldestProfile = Array.from(this.activeProfiles)[0];
      this.deactivateProfile(oldestProfile);
    }

    profile.metadata.isActive = true;
    profile.metadata.modifiedAt = new Date().toISOString();
    this.activeProfiles.add(profileId);

    this.emit('profile-activated', profile);

    log.info('Configuration profile activated', {
      component: 'ViewportConfigurationManager',
      metadata: { profileId, name: profile.name },
    });

    return profile;
  }

  public deactivateProfile(profileId: string): boolean {
    const profile = this.profiles.get(profileId);
    if (!profile || !profile.metadata.isActive) {
      return false;
    }

    profile.metadata.isActive = false;
    profile.metadata.modifiedAt = new Date().toISOString();
    this.activeProfiles.delete(profileId);

    this.emit('profile-deactivated', profile);

    log.info('Configuration profile deactivated', {
      component: 'ViewportConfigurationManager',
      metadata: { profileId, name: profile.name },
    });

    return true;
  }

  public getActiveProfiles(): ConfigurationProfile[] {
    return Array.from(this.activeProfiles)
      .map(id => this.profiles.get(id))
      .filter((profile): profile is ConfigurationProfile => profile !== undefined)
      .map(profile => ({ ...profile }));
  }

  // ===== Configuration Application =====

  public selectConfigurationForContext(context: {
    modality?: string;
    bodyPart?: string;
    studyDescription?: string;
    userRole?: string;
    custom?: Record<string, unknown>;
  }): ViewportConfiguration | null {
    if (!this.config.profiles.enableAutoSelection) {
      return this.getDefaultConfiguration();
    }

    // Score active profiles based on context
    const profileScores = this.getActiveProfiles().map(profile => ({
      profile,
      score: this.calculateProfileScore(profile, context),
    }));

    // Sort by score (highest first) and priority
    profileScores.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return b.profile.priority - a.profile.priority;
    });

    // Get best matching profile
    const bestProfile = profileScores[0]?.profile;
    if (!bestProfile || profileScores[0].score === 0) {
      return this.getDefaultConfiguration();
    }

    // Return first configuration from best profile
    const configId = bestProfile.configurations[0];
    return this.getConfiguration(configId);
  }

  public applyConfigurationToViewport(viewportId: string, configId: string): ViewportConfiguration {
    const configuration = this.getConfiguration(configId);
    if (!configuration) {
      throw new Error(`Configuration not found: ${configId}`);
    }

    this.emit('configuration-applied', viewportId, configuration);

    log.info('Configuration applied to viewport', {
      component: 'ViewportConfigurationManager',
      metadata: { viewportId, configId, configName: configuration.name },
    });

    return configuration;
  }

  // ===== Validation =====

  private sanitizeRegexPattern(pattern: string): string {
    // Escape special regex characters in user input
    return pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private testRegexPattern(pattern: string, text: string): boolean {
    try {
      // Create a static regex tester for security
      const tester: RegExpLike = {
        test: (str: string): boolean => {
          const sanitized = this.sanitizeRegexPattern(pattern);
          return str.toLowerCase().includes(sanitized.toLowerCase());
        },
      };
      return tester.test(text);
    } catch {
      return false;
    }
  }

  private validateConfiguration(config: ViewportConfiguration): { isValid: boolean; errors: ValidationError[] } {
    const errors: ValidationError[] = [];

    // Basic validation
    if (!config.name || config.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Configuration name is required',
        severity: 'error',
        code: 'REQUIRED_FIELD',
      });
    }

    // Viewport validation
    if (config.viewport) {
      const { rendering, display, interaction } = config.viewport;

      // Rendering validation
      if (rendering) {
        if (rendering.quality && !['low', 'medium', 'high'].includes(rendering.quality)) {
          errors.push({
            field: 'viewport.rendering.quality',
            message: 'Quality must be low, medium, or high',
            severity: 'error',
            code: 'INVALID_VALUE',
          });
        }
      }

      // Display validation
      if (display) {
        if (display.opacity < 0 || display.opacity > 1) {
          errors.push({
            field: 'viewport.display.opacity',
            message: 'Opacity must be between 0 and 1',
            severity: 'error',
            code: 'OUT_OF_RANGE',
          });
        }
      }

      // Interaction validation
      if (interaction) {
        if (interaction.constraints) {
          const { minZoom, maxZoom } = interaction.constraints;
          if (minZoom >= maxZoom) {
            errors.push({
              field: 'viewport.interaction.constraints',
              message: 'minZoom must be less than maxZoom',
              severity: 'error',
              code: 'INVALID_RANGE',
            });
          }
        }
      }

      // Performance validation (using config.performance instead of just performance)
      if (config.performance) {
        if (config.performance.memoryLimit <= 0) {
          errors.push({
            field: 'performance.memoryLimit',
            message: 'Memory limit must be positive',
            severity: 'error',
            code: 'INVALID_VALUE',
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // ===== Utility Methods =====

  private mergeWithDefaults(configData: Partial<ViewportConfiguration['viewport']>): ViewportConfiguration['viewport'] {
    return {
      defaultType: configData.defaultType || 'stack',
      rendering: {
        interpolationType: 'LINEAR',
        quality: 'high',
        useCPURendering: false,
        enableGPUAcceleration: true,
        ...configData.rendering,
      },
      display: {
        windowLevel: {
          width: 400,
          center: 40,
          presets: DEFAULT_WINDOW_LEVEL_PRESETS,
          ...configData.display?.windowLevel,
        },
        colormap: 'grayscale',
        invertColors: false,
        opacity: 1.0,
        ...configData.display,
      },
      interaction: {
        enablePan: true,
        enableZoom: true,
        enableWindowLevel: true,
        enableRotation: false,
        sensitivity: {
          pan: 1.0,
          zoom: 1.0,
          windowLevel: 1.0,
          ...configData.interaction?.sensitivity,
        },
        constraints: {
          minZoom: 0.1,
          maxZoom: 10.0,
          ...configData.interaction?.constraints,
        },
        ...configData.interaction,
      },
      tools: {
        defaultTool: 'WindowLevel',
        enabledTools: ['WindowLevel', 'Pan', 'Zoom', 'Length', 'Angle'],
        toolSettings: {},
        ...configData.tools,
      },
      synchronization: {
        enabledByDefault: false,
        syncTypes: ['windowLevel'],
        autoGrouping: false,
        ...configData.synchronization,
      },
    };
  }

  private calculateProfileScore(profile: ConfigurationProfile, context: Record<string, unknown>): number {
    let totalScore = 0;
    let totalWeight = 0;

    profile.conditions.forEach(condition => {
      const contextValue = context[condition.type];
      if (contextValue !== undefined) {
        const conditionMet = this.evaluateCondition(condition, contextValue);
        if (conditionMet) {
          totalScore += condition.weight;
        }
        totalWeight += condition.weight;
      }
    });

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private evaluateCondition(condition: ProfileCondition, contextValue: unknown): boolean {
    const { operator, value } = condition;

    switch (operator) {
      case 'equals':
        return contextValue === value;
      case 'contains':
        return (
          typeof contextValue === 'string' &&
          typeof value === 'string' &&
          contextValue.toLowerCase().includes(value.toLowerCase())
        );
      case 'matches':
        return (
          typeof contextValue === 'string' && typeof value === 'string' && this.testRegexPattern(value, contextValue)
        );
      case 'in':
        return Array.isArray(value) && value.includes(contextValue as string);
      case 'not':
        return contextValue !== value;
      default:
        return false;
    }
  }

  private getDefaultConfiguration(): ViewportConfiguration | null {
    const defaultConfig = Array.from(this.configurations.values()).find(config => config.metadata.isDefault);

    return defaultConfig ? { ...defaultConfig } : null;
  }

  private async loadDefaultConfigurations(): Promise<void> {
    // Create default configuration
    this.createConfiguration(
      'Default',
      {},
      {
        description: 'Default viewport configuration',
        isDefault: true,
        isReadOnly: true,
        tags: ['system', 'default'],
      },
    );

    // Create specialized configurations
    this.createConfiguration(
      'CT Chest',
      {
        display: {
          windowLevel: {
            width: 1500,
            center: -600,
            presets: DEFAULT_WINDOW_LEVEL_PRESETS.filter(p => p.modality?.includes('CT')),
          },
          colormap: 'grayscale',
          invertColors: false,
          opacity: 1.0,
        },
      },
      {
        description: 'Optimized for CT chest imaging',
        tags: ['CT', 'chest', 'lung'],
      },
    );

    this.createConfiguration(
      'MR Brain',
      {
        display: {
          windowLevel: {
            width: 500,
            center: 250,
            presets: DEFAULT_WINDOW_LEVEL_PRESETS.filter(p => p.modality?.includes('MR')),
          },
          colormap: 'grayscale',
          invertColors: false,
          opacity: 1.0,
        },
        tools: {
          defaultTool: 'WindowLevel',
          enabledTools: ['WindowLevel', 'Pan', 'Zoom', 'Length', 'Angle', 'Rectangle'],
          toolSettings: {},
        },
      },
      {
        description: 'Optimized for MR brain imaging',
        tags: ['MR', 'brain', 'head'],
      },
    );

    log.info('Default configurations loaded', {
      component: 'ViewportConfigurationManager',
      metadata: { configCount: this.configurations.size },
    });
  }

  private async activateDefaultProfiles(): Promise<void> {
    // Create and activate default profile
    const defaultProfile = this.createProfile(
      'Default Profile',
      [Array.from(this.configurations.keys())[0]], // First config (default)
      [],
      {
        description: 'Default configuration profile',
        priority: 0,
      },
    );

    this.activateProfile(defaultProfile.id);
  }

  private markForAutoSave(configId: string): void {
    if (this.config.persistence.autoSave) {
      this.pendingChanges.add(configId);
    }
  }

  private setupAutoSave(): void {
    this.autoSaveInterval = setInterval(() => {
      this.performAutoSave();
    }, this.config.persistence.saveInterval);
  }

  private async performAutoSave(): Promise<void> {
    if (this.pendingChanges.size === 0) {
      return;
    }

    try {
      await this.saveConfigurations();
      await this.saveProfiles();
      await this.saveUserPreferences();

      const savedConfigs = Array.from(this.pendingChanges);
      this.pendingChanges.clear();

      this.emit('auto-save-completed', savedConfigs);

      log.info('Auto-save completed', {
        component: 'ViewportConfigurationManager',
        metadata: { savedCount: savedConfigs.length },
      });
    } catch (error) {
      log.error(
        'Auto-save failed',
        {
          component: 'ViewportConfigurationManager',
        },
        error as Error,
      );
    }
  }

  private async saveConfigurations(): Promise<void> {
    if (this.config.persistence.strategy === 'secure') {
      const data = JSON.stringify(Array.from(this.configurations.entries()));
      await secureStorage.store('viewport-configurations', data, 'configurations');
    }
  }

  private async loadPersistedConfigurations(): Promise<void> {
    try {
      if (this.config.persistence.strategy === 'secure') {
        const data = await secureStorage.retrieve('viewport-configurations');
        if (data) {
          const entries = JSON.parse(data) as [string, ViewportConfiguration][];
          entries.forEach(([id, config]) => {
            if (this.config.validation.validateOnLoad) {
              const validation = this.validateConfiguration(config);
              if (validation.isValid) {
                this.configurations.set(id, config);
              }
            } else {
              this.configurations.set(id, config);
            }
          });
        }
      }
    } catch (error) {
      log.error(
        'Failed to load persisted configurations',
        {
          component: 'ViewportConfigurationManager',
        },
        error as Error,
      );
    }
  }

  private async saveProfiles(): Promise<void> {
    if (this.config.persistence.strategy === 'secure') {
      const data = JSON.stringify(Array.from(this.profiles.entries()));
      await secureStorage.store('configuration-profiles', data, 'profiles');
    }
  }

  private async loadPersistedProfiles(): Promise<void> {
    try {
      if (this.config.persistence.strategy === 'secure') {
        const data = await secureStorage.retrieve('configuration-profiles');
        if (data) {
          const entries = JSON.parse(data) as [string, ConfigurationProfile][];
          entries.forEach(([id, profile]) => {
            this.profiles.set(id, profile);
            if (profile.metadata.isActive) {
              this.activeProfiles.add(id);
            }
          });
        }
      }
    } catch (error) {
      // Silent fail for development - corrupted encryption data
      log.warn('Failed to load persisted profiles - will use defaults', {
        component: 'ViewportConfigurationManager',
        metadata: {
          isDevelopment: process.env.NODE_ENV !== 'production',
          errorType: (error as Error).name,
        },
      });

      // In development, clear corrupted data
      if (process.env.NODE_ENV !== 'production') {
        try {
          await secureStorage.remove('configuration-profiles');
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  private async saveUserPreferences(): Promise<void> {
    if (this.config.persistence.strategy === 'secure') {
      const data = JSON.stringify(this.userPreferences);
      await secureStorage.store('user-preferences', data, 'preferences');
    }
  }

  private async loadUserPreferences(): Promise<void> {
    try {
      if (this.config.persistence.strategy === 'secure') {
        const data = await secureStorage.retrieve('user-preferences');
        if (data) {
          this.userPreferences = JSON.parse(data);
        }
      }
    } catch (error) {
      // Silent fail for development - corrupted encryption data
      log.warn('Failed to load user preferences - will use defaults', {
        component: 'ViewportConfigurationManager',
        metadata: {
          isDevelopment: process.env.NODE_ENV !== 'production',
          errorType: (error as Error).name,
        },
      });

      // In development, clear corrupted data and reset to defaults
      if (process.env.NODE_ENV !== 'production') {
        try {
          await secureStorage.remove('user-preferences');
          // Reset to default preferences
          this.userPreferences = {
            autoSave: true,
            defaultQuality: 'medium',
            enableSynchronization: true,
            theme: 'system',
          };
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  private generateConfigurationId(): string {
    return `config-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateProfileId(): string {
    return `profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ===== User Preferences =====

  public setUserPreference(key: string, value: unknown): void {
    safePropertySet(this.userPreferences, key, value);
    this.markForAutoSave('preferences');

    log.info('User preference updated', {
      component: 'ViewportConfigurationManager',
      metadata: { key, valueType: typeof value },
    });
  }

  public getUserPreference(key: string): unknown {
    // eslint-disable-next-line security/detect-object-injection -- Safe: accessing user preferences with validated string key
    return this.userPreferences[key];
  }

  public getAllUserPreferences(): Record<string, unknown> {
    return { ...this.userPreferences };
  }

  // ===== Cleanup =====

  public dispose(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }

    this.configurations.clear();
    this.profiles.clear();
    this.activeProfiles.clear();
    this.pendingChanges.clear();
    this.userPreferences = {};
    this.removeAllListeners();

    log.info('ViewportConfigurationManager disposed', {
      component: 'ViewportConfigurationManager',
    });
  }
}

// Singleton instance
export const viewportConfigurationManager = new ViewportConfigurationManager();
