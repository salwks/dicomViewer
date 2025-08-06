/**
 * Migration System Service
 * Handles data migration between different versions of the application
 * Ensures backward compatibility and smooth upgrades
 */

import { EventEmitter } from 'events';
import { secureStorage } from '../security/secureStorage';
import { log } from '../utils/logger';
import { safePropertyAccess } from '../lib/utils';
import { MigrationData } from '../types';

export interface MigrationConfig {
  currentVersion: string;
  enableAutoMigration: boolean;
  backupBeforeMigration: boolean;
  validateAfterMigration: boolean;
  migrationTimeout: number; // milliseconds
}

export interface Migration {
  id: string;
  fromVersion: string;
  toVersion: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  migrate: (data: MigrationData) => Promise<MigrationData>;
  validate?: (data: MigrationData) => Promise<boolean>;
  rollback?: (data: MigrationData) => Promise<MigrationData>;
}

export interface MigrationResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  migrationsApplied: string[];
  backupId?: string;
  errors: string[];
  warnings: string[];
  duration: number;
}

export interface MigrationPlan {
  migrations: Migration[];
  totalSteps: number;
  estimatedDuration: number;
  requiresBackup: boolean;
  hasRiskyMigrations: boolean;
}

export const DEFAULT_MIGRATION_CONFIG: MigrationConfig = {
  currentVersion: '1.0.0',
  enableAutoMigration: true,
  backupBeforeMigration: true,
  validateAfterMigration: true,
  migrationTimeout: 30000, // 30 seconds
};

export class MigrationSystem extends EventEmitter {
  private config: MigrationConfig;
  private migrations = new Map<string, Migration>();
  private migrationHistory: Array<{
    id: string;
    fromVersion: string;
    toVersion: string;
    appliedAt: number;
    success: boolean;
  }> = [];

  constructor(config: Partial<MigrationConfig> = {}) {
    super();
    this.config = { ...DEFAULT_MIGRATION_CONFIG, ...config };

    this.initializeMigrations();
  }

  /**
   * Register a new migration
   */
  public registerMigration(migration: Migration): void {
    if (this.migrations.has(migration.id)) {
      log.warn('Migration already registered, overwriting', {
        component: 'MigrationSystem',
        metadata: { migrationId: migration.id },
      });
    }

    this.migrations.set(migration.id, migration);

    log.info('Migration registered', {
      component: 'MigrationSystem',
      metadata: {
        id: migration.id,
        fromVersion: migration.fromVersion,
        toVersion: migration.toVersion,
        priority: migration.priority,
      },
    });
  }

  /**
   * Check if migration is needed
   */
  public async checkMigrationNeeded(): Promise<boolean> {
    try {
      const storedVersion = await secureStorage.retrieve('app-version');
      if (!storedVersion) {
        // First time setup
        await secureStorage.store('app-version', this.config.currentVersion, 'app-setup');
        return false;
      }

      return this.compareVersions(storedVersion, this.config.currentVersion) < 0;
    } catch (error) {
      log.error(
        'Failed to check migration status',
        {
          component: 'MigrationSystem',
          metadata: { error: (error as Error).message },
        },
        error as Error,
      );
      return false;
    }
  }

  /**
   * Create migration plan
   */
  public async createMigrationPlan(fromVersion?: string): Promise<MigrationPlan> {
    const sourceVersion = fromVersion || (await this.getStoredVersion());
    const targetVersion = this.config.currentVersion;

    const applicableMigrations = this.findMigrationPath(sourceVersion, targetVersion);

    const plan: MigrationPlan = {
      migrations: applicableMigrations,
      totalSteps: applicableMigrations.length,
      estimatedDuration: applicableMigrations.length * 5000, // 5s per migration estimate
      requiresBackup: this.config.backupBeforeMigration || applicableMigrations.some(m => m.priority === 'critical'),
      hasRiskyMigrations: applicableMigrations.some(m => m.priority === 'critical' || m.priority === 'high'),
    };

    log.info('Migration plan created', {
      component: 'MigrationSystem',
      metadata: {
        fromVersion: sourceVersion,
        toVersion: targetVersion,
        migrationsCount: plan.totalSteps,
        requiresBackup: plan.requiresBackup,
      },
    });

    return plan;
  }

  /**
   * Execute migration plan
   */
  public async executeMigration(plan?: MigrationPlan): Promise<MigrationResult> {
    const startTime = Date.now();
    const fromVersion = await this.getStoredVersion();
    const toVersion = this.config.currentVersion;

    const result: MigrationResult = {
      success: false,
      fromVersion,
      toVersion,
      migrationsApplied: [],
      errors: [],
      warnings: [],
      duration: 0,
    };

    try {
      // Create plan if not provided
      if (!plan) {
        plan = await this.createMigrationPlan(fromVersion);
      }

      if (plan.migrations.length === 0) {
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      this.emit('migration-started', plan);

      // Create backup if required
      if (plan.requiresBackup) {
        result.backupId = await this.createBackup();
        this.emit('backup-created', result.backupId);
      }

      // Execute migrations in order
      for (let i = 0; i < plan.migrations.length; i++) {
        const migration = safePropertyAccess(plan.migrations, i);
        if (!migration) continue;

        try {
          this.emit('migration-step-started', migration, i + 1, plan.totalSteps);

          await this.executeSingleMigration(migration);
          result.migrationsApplied.push(migration.id);

          this.emit('migration-step-completed', migration, i + 1, plan.totalSteps);
        } catch (error) {
          const errorMsg = `Migration ${migration.id} failed: ${(error as Error).message}`;
          result.errors.push(errorMsg);

          this.emit('migration-step-failed', migration, error as Error);

          // Critical migrations must succeed
          if (migration.priority === 'critical') {
            throw new Error(`Critical migration failed: ${migration.id}`);
          } else {
            result.warnings.push(`Non-critical migration failed: ${migration.id}`);
          }
        }
      }

      // Update stored version
      await secureStorage.store('app-version', toVersion, 'migration-complete');

      // Validate migration if enabled
      if (this.config.validateAfterMigration) {
        const validationResult = await this.validateMigration(plan);
        if (!validationResult) {
          result.warnings.push('Migration validation failed');
        }
      }

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      this.emit('migration-completed', result);

      log.info('Migration completed', {
        component: 'MigrationSystem',
        metadata: {
          success: result.success,
          fromVersion,
          toVersion,
          migrationsApplied: result.migrationsApplied.length,
          duration: result.duration,
          errors: result.errors.length,
          warnings: result.warnings.length,
        },
      });

      return result;
    } catch (error) {
      result.errors.push((error as Error).message);
      result.duration = Date.now() - startTime;

      this.emit('migration-failed', result, error as Error);

      log.error(
        'Migration failed',
        {
          component: 'MigrationSystem',
          metadata: {
            fromVersion,
            toVersion,
            migrationsAttempted: result.migrationsApplied.length,
            duration: result.duration,
            error: (error as Error).message,
          },
        },
        error as Error,
      );

      return result;
    }
  }

  /**
   * Rollback to previous version using backup
   */
  public async rollbackMigration(backupId: string): Promise<boolean> {
    try {
      this.emit('rollback-started', backupId);

      const backupData = await secureStorage.retrieve(`backup-${backupId}`);
      if (!backupData) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      const backup = JSON.parse(backupData);

      // Restore application data
      await secureStorage.store('app-version', backup.version, 'rollback-restore');

      // Restore other data if available
      if (backup.data) {
        for (const [key, value] of Object.entries(backup.data)) {
          await secureStorage.store(key, JSON.stringify(value), 'rollback-data');
        }
      }

      this.emit('rollback-completed', backupId);

      log.info('Migration rollback completed', {
        component: 'MigrationSystem',
        metadata: { backupId, restoredVersion: backup.version },
      });

      return true;
    } catch (error) {
      this.emit('rollback-failed', backupId, error as Error);

      log.error(
        'Migration rollback failed',
        {
          component: 'MigrationSystem',
          metadata: { backupId, error: (error as Error).message },
        },
        error as Error,
      );

      return false;
    }
  }

  // ===== Private Methods =====

  private initializeMigrations(): void {
    // Register built-in migrations
    this.registerBuiltInMigrations();
  }

  private registerBuiltInMigrations(): void {
    // ViewerContext State Migration - Mode-based to Layout-based
    this.registerMigration({
      id: 'viewer-context-layout-migration-v1',
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
      description: 'Migrate ViewerContext from mode-based to layout-based architecture',
      priority: 'high',
      migrate: async (data: any) => {
        // Import migration utility
        const { ViewerStateMigration } = await import('./ViewerStateMigration');

        if (data.viewerState || data.viewerContext) {
          const legacyState = data.viewerState || data.viewerContext;
          const migrationResult = ViewerStateMigration.migrate(legacyState);

          if (migrationResult.success && migrationResult.migratedState) {
            return {
              ...data,
              viewerState: migrationResult.migratedState,
              // Keep migration metadata for troubleshooting
              migrationMetadata: {
                migrationId: 'viewer-context-layout-migration-v1',
                migrationTime: migrationResult.migrationTime,
                preservedFields: migrationResult.preservedFields,
                droppedFields: migrationResult.droppedFields,
                warnings: migrationResult.warnings,
                migratedAt: new Date().toISOString(),
              },
              // Remove old state
              viewerContext: undefined,
            };
          } else {
            throw new Error(`ViewerState migration failed: ${migrationResult.errors.join(', ')}`);
          }
        }
        return data;
      },
      validate: async (data: any) => {
        // Validate that the new layout-based structure exists and is valid
        if (!data.viewerState) {
          return false;
        }

        const viewerState = data.viewerState;

        // Check for required layout-based fields
        if (!viewerState.layout || typeof viewerState.layout !== 'object') {
          return false;
        }

        if (!viewerState.layout.rows || !viewerState.layout.cols) {
          return false;
        }

        if (!Array.isArray(viewerState.viewports)) {
          return false;
        }

        // Ensure no legacy mode field exists
        if (viewerState.mode !== undefined) {
          return false;
        }

        return true;
      },
      rollback: async (data: any) => {
        // For rollback, we could restore from backup or use reverse migration
        // This is a simplified approach - in production, you'd want more sophisticated rollback
        if (data.migrationMetadata?.backupData) {
          return {
            ...data,
            viewerState: undefined,
            viewerContext: data.migrationMetadata.backupData,
            migrationMetadata: undefined,
          };
        }
        throw new Error('Cannot rollback ViewerState migration: no backup data available');
      },
    });

    // Example migration from v0.9.x to v1.0.0
    this.registerMigration({
      id: 'viewport-state-restructure-v1',
      fromVersion: '0.9.0',
      toVersion: '1.0.0',
      description: 'Restructure viewport state format for v1.0.0',
      priority: 'high',
      migrate: async (data: any) => {
        // Migrate viewport state structure
        if (data.viewportStates) {
          const migratedStates = data.viewportStates.map((state: any) => ({
            ...state,
            version: '1.0.0',
            // Add new fields
            performance: {
              renderTime: 0,
              lastUpdate: Date.now(),
            },
            // Rename old fields
            windowLevel: state.windowWidth
              ? {
                width: state.windowWidth,
                center: state.windowCenter || 0,
              }
              : undefined,
          }));

          return { ...data, viewportStates: migratedStates };
        }
        return data;
      },
      validate: async (data: any) => {
        return data.viewportStates?.every((state: any) => state.version === '1.0.0') || false;
      },
    });

    // Migration for annotation format changes
    this.registerMigration({
      id: 'annotation-format-v1',
      fromVersion: '0.8.0',
      toVersion: '1.0.0',
      description: 'Update annotation storage format',
      priority: 'medium',
      migrate: async (data: any) => {
        if (data.annotations) {
          const migratedAnnotations = data.annotations.map((annotation: any) => ({
            ...annotation,
            metadata: {
              ...annotation.metadata,
              version: '1.0.0',
              migrated: true,
              migratedAt: new Date().toISOString(),
            },
          }));

          return { ...data, annotations: migratedAnnotations };
        }
        return data;
      },
    });

    // Security enhancement migration
    this.registerMigration({
      id: 'security-enhancement-v1',
      fromVersion: '0.9.5',
      toVersion: '1.0.0',
      description: 'Apply security enhancements',
      priority: 'critical',
      migrate: async (data: any) => {
        // Re-encrypt sensitive data with new security standards
        if (data.sessionData) {
          return {
            ...data,
            sessionData: {
              ...data.sessionData,
              securityVersion: '1.0.0',
              encrypted: true,
            },
          };
        }
        return data;
      },
      validate: async (data: any) => {
        return data.sessionData?.securityVersion === '1.0.0';
      },
    });
  }

  private async executeSingleMigration(migration: Migration): Promise<void> {
    const timeout = this.config.migrationTimeout;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Migration ${migration.id} timed out after ${timeout}ms`));
      }, timeout);

      const migrationData: MigrationData = {
        version: migration.fromVersion,
        data: {},
        timestamp: Date.now(),
      };

      migration
        .migrate(migrationData)
        .then(() => {
          clearTimeout(timer);

          // Add to migration history
          this.migrationHistory.push({
            id: migration.id,
            fromVersion: migration.fromVersion,
            toVersion: migration.toVersion,
            appliedAt: Date.now(),
            success: true,
          });

          resolve();
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private async validateMigration(plan: MigrationPlan): Promise<boolean> {
    try {
      for (const migration of plan.migrations) {
        if (migration.validate) {
          const validationData: MigrationData = {
            version: migration.fromVersion,
            data: {},
            timestamp: Date.now(),
          };
          const isValid = await migration.validate(validationData);
          if (!isValid) {
            return false;
          }
        }
      }
      return true;
    } catch (error) {
      log.error(
        'Migration validation error',
        {
          component: 'MigrationSystem',
          metadata: { error: (error as Error).message },
        },
        error as Error,
      );
      return false;
    }
  }

  private async createBackup(): Promise<string> {
    const backupId = `migration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const currentVersion = await this.getStoredVersion();

    const backup = {
      id: backupId,
      version: currentVersion,
      createdAt: new Date().toISOString(),
      data: {
        // Include key application data in backup
        viewports: await this.captureViewportStates(),
        annotations: await this.captureAnnotations(),
        userPreferences: await this.captureUserPreferences(),
        toolConfiguration: await this.captureToolConfiguration(),
        studyData: await this.captureStudyData(),
      },
    };

    await secureStorage.store(`backup-${backupId}`, JSON.stringify(backup), 'migration-backup');

    log.info('Migration backup created', {
      component: 'MigrationSystem',
      metadata: { backupId, version: currentVersion },
    });

    return backupId;
  }

  private async getStoredVersion(): Promise<string> {
    const version = await secureStorage.retrieve('app-version');
    return version || '0.0.0';
  }

  private findMigrationPath(fromVersion: string, toVersion: string): Migration[] {
    const migrations: Migration[] = [];

    // Simple approach: find all migrations that apply to the version range
    for (const migration of this.migrations.values()) {
      if (
        this.compareVersions(migration.fromVersion, fromVersion) >= 0 &&
        this.compareVersions(migration.toVersion, toVersion) <= 0
      ) {
        migrations.push(migration);
      }
    }

    // Sort by version order
    migrations.sort((a, b) => this.compareVersions(a.toVersion, b.toVersion));

    return migrations;
  }

  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      // eslint-disable-next-line security/detect-object-injection -- Safe: i is controlled loop index within version parts array bounds
      const v1Part = v1Parts[i] || 0;
      // eslint-disable-next-line security/detect-object-injection -- Safe: i is controlled loop index within version parts array bounds
      const v2Part = v2Parts[i] || 0;

      if (v1Part < v2Part) return -1;
      if (v1Part > v2Part) return 1;
    }

    return 0;
  }

  /**
   * Get migration system statistics
   */
  public getStatistics(): {
    totalMigrations: number;
    pendingMigrations: number;
    completedMigrations: number;
    currentVersion: string;
    availableBackups: number;
    lastMigrationDate?: Date;
    migrationHistory: Array<{
      fromVersion: string;
      toVersion: string;
      date: Date;
      success: boolean;
    }>;
    } {
    return {
      totalMigrations: this.migrations.size,
      pendingMigrations: 0, // Would calculate based on current version vs available migrations
      completedMigrations: this.migrationHistory.length,
      currentVersion: this.config.currentVersion,
      availableBackups: 0, // Would count available backup files
      lastMigrationDate:
        this.migrationHistory.length > 0
          ? new Date(this.migrationHistory[this.migrationHistory.length - 1].appliedAt)
          : undefined,
      migrationHistory: this.migrationHistory.map(m => ({
        fromVersion: m.fromVersion,
        toVersion: m.toVersion,
        date: new Date(m.appliedAt),
        success: m.success,
      })),
    };
  }

  /**
   * Cleanup old backups and migration data
   */
  public async cleanup(olderThanDays: number = 30): Promise<void> {
    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    try {
      // Clean up old backup files from secure storage
      const { secureStorage } = await import('../security/secureStorage');

      // Get all backup keys
      const allKeys = await secureStorage.getAllKeys('migration-backup');
      let cleanedCount = 0;

      for (const key of allKeys) {
        try {
          const backupData = await secureStorage.retrieve(key);
          if (backupData) {
            const backup = JSON.parse(backupData);
            const backupTime = new Date(backup.createdAt).getTime();

            if (backupTime < cutoffTime) {
              await secureStorage.remove(key);
              cleanedCount++;
            }
          }
        } catch (error) {
          log.warn(
            'Failed to process backup for cleanup',
            {
              component: 'MigrationSystem',
              metadata: { key },
            },
            error as Error,
          );
        }
      }

      // Clean up temporary migration files
      if (typeof localStorage !== 'undefined') {
        const tempMigrationKeys = Object.keys(localStorage).filter(
          key => key.startsWith('migration_temp_') || key.startsWith('backup_temp_'),
        );

        tempMigrationKeys.forEach(key => {
          try {
            localStorage.removeItem(key);
            cleanedCount++;
          } catch (error) {
            log.warn(
              'Failed to remove temporary migration data',
              {
                component: 'MigrationSystem',
                metadata: { key },
              },
              error as Error,
            );
          }
        });
      }

      log.info('Migration system cleanup completed', {
        component: 'MigrationSystem',
        metadata: { olderThanDays, cutoffTime, cleanedCount },
      });
    } catch (error) {
      log.error(
        'Migration system cleanup failed',
        {
          component: 'MigrationSystem',
          metadata: { olderThanDays },
        },
        error as Error,
      );
    }
  }

  // Helper methods for capturing application state
  private async captureViewportStates(): Promise<any[]> {
    // In a real implementation, this would capture actual viewport states
    return [
      {
        id: 'viewport-1',
        type: 'stack',
        seriesInstanceUID: 'mock-series',
        imageIndex: 0,
        windowLevel: { window: 400, level: 40 },
        zoom: 1.0,
        pan: { x: 0, y: 0 },
      },
    ];
  }

  private async captureAnnotations(): Promise<any[]> {
    // In a real implementation, this would capture actual annotations
    return [];
  }

  private async captureUserPreferences(): Promise<any> {
    // In a real implementation, this would capture user preferences
    return {
      theme: 'dark',
      language: 'en',
      defaultTools: ['WindowLevel', 'Zoom', 'Pan'],
    };
  }

  private async captureToolConfiguration(): Promise<any> {
    // In a real implementation, this would capture tool configuration
    return {
      activeToolGroup: 'default',
      toolSettings: {},
    };
  }

  private async captureStudyData(): Promise<any> {
    // In a real implementation, this would capture study metadata
    return {
      loadedStudies: [],
      activeStudy: null,
    };
  }
}

// Singleton instance
export const migrationSystem = new MigrationSystem();
