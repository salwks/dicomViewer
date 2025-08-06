/**
 * Viewer State Migration Helper
 * Provides convenient utility functions for migrating viewer state
 * Built with security compliance and error handling
 */

import { ViewerStateMigration, type ViewerStateMigrationResult } from '../services/ViewerStateMigration';
import { migrationSystem } from '../services/MigrationSystem';
import { secureStorage } from '../security/secureStorage';
import { log } from './logger';

/**
 * Migration helper configuration
 */
export interface MigrationHelperConfig {
  autoBackup: boolean;
  validateBefore: boolean;
  logProgress: boolean;
  retryOnFailure: boolean;
  maxRetries: number;
}

/**
 * Default configuration for migration helper
 */
export const DEFAULT_MIGRATION_HELPER_CONFIG: MigrationHelperConfig = {
  autoBackup: true,
  validateBefore: true,
  logProgress: true,
  retryOnFailure: true,
  maxRetries: 3,
};

/**
 * Migration helper result
 */
export interface MigrationHelperResult {
  success: boolean;
  migrationResult?: ViewerStateMigrationResult;
  backupId?: string;
  errors: string[];
  warnings: string[];
  retryCount: number;
  totalTime: number;
}

/**
 * ViewerState Migration Helper Class
 * Provides high-level utilities for state migration
 */
export class ViewerStateMigrationHelper {
  private config: MigrationHelperConfig;

  constructor(config: Partial<MigrationHelperConfig> = {}) {
    this.config = { ...DEFAULT_MIGRATION_HELPER_CONFIG, ...config };
  }

  /**
   * Migrate viewer state with comprehensive error handling and backup
   */
  public async migrateWithBackup(legacyState: unknown): Promise<MigrationHelperResult> {
    const startTime = Date.now();
    const result: MigrationHelperResult = {
      success: false,
      errors: [],
      warnings: [],
      retryCount: 0,
      totalTime: 0,
    };

    try {
      if (this.config.logProgress) {
        log.info('Starting viewer state migration with backup', {
          component: 'ViewerStateMigrationHelper',
          metadata: { autoBackup: this.config.autoBackup },
        });
      }

      // Step 1: Create backup if enabled
      if (this.config.autoBackup) {
        result.backupId = await this.createBackup(legacyState);
        if (this.config.logProgress) {
          log.info('Backup created successfully', {
            component: 'ViewerStateMigrationHelper',
            metadata: { backupId: result.backupId },
          });
        }
      }

      // Step 2: Validate input if enabled
      if (this.config.validateBefore) {
        const validationResult = this.validateLegacyState(legacyState);
        if (!validationResult.isValid) {
          result.errors.push('Legacy state validation failed');
          result.warnings.push(...validationResult.warnings);
          return this.finalizeResult(result, startTime);
        }
      }

      // Step 3: Attempt migration with retry logic
      let migrationResult: ViewerStateMigrationResult | null = null;
      let retryCount = 0;

      do {
        try {
          migrationResult = ViewerStateMigration.migrate(legacyState as Record<string, unknown>);

          if (migrationResult.success) {
            break; // Success, exit retry loop
          } else {
            result.warnings.push(...migrationResult.warnings);
            if (retryCount < this.config.maxRetries - 1) {
              result.warnings.push(`Migration attempt ${retryCount + 1} failed, retrying...`);
            }
          }
        } catch (error) {
          const errorMsg = `Migration attempt ${retryCount + 1} threw error: ${(error as Error).message}`;
          if (retryCount < this.config.maxRetries - 1) {
            result.warnings.push(errorMsg);
          } else {
            result.errors.push(errorMsg);
          }
        }

        retryCount++;
      } while (this.config.retryOnFailure && retryCount < this.config.maxRetries && !migrationResult?.success);

      result.retryCount = retryCount;

      if (!migrationResult || !migrationResult.success) {
        result.errors.push('Migration failed after all retry attempts');
        if (migrationResult) {
          result.errors.push(...migrationResult.errors);
        }
        return this.finalizeResult(result, startTime);
      }

      // Step 4: Success
      result.migrationResult = migrationResult;
      result.success = true;
      result.warnings.push(...migrationResult.warnings);

      if (this.config.logProgress) {
        log.info('Viewer state migration completed successfully', {
          component: 'ViewerStateMigrationHelper',
          metadata: {
            retryCount: result.retryCount,
            migrationTime: migrationResult.migrationTime,
            preservedFields: migrationResult.preservedFields.length,
            droppedFields: migrationResult.droppedFields.length,
          },
        });
      }

      return this.finalizeResult(result, startTime);
    } catch (error) {
      result.errors.push(`Migration helper failed: ${(error as Error).message}`);
      log.error(
        'ViewerStateMigrationHelper error',
        {
          component: 'ViewerStateMigrationHelper',
          metadata: { error: (error as Error).message },
        },
        error as Error,
      );
      return this.finalizeResult(result, startTime);
    }
  }

  /**
   * Quick migration without backup (for development/testing)
   */
  public async quickMigrate(legacyState: unknown): Promise<ViewerStateMigrationResult> {
    const helper = new ViewerStateMigrationHelper({
      autoBackup: false,
      validateBefore: false,
      logProgress: false,
      retryOnFailure: false,
      maxRetries: 1,
    });

    const result = await helper.migrateWithBackup(legacyState);
    return result.migrationResult || {
      success: false,
      errors: result.errors,
      warnings: result.warnings,
      preservedFields: [],
      droppedFields: [],
      migrationTime: result.totalTime,
    };
  }

  /**
   * Migrate and integrate with existing migration system
   */
  public async migrateWithSystem(): Promise<boolean> {
    try {
      // Check if migration is needed
      const migrationNeeded = await migrationSystem.checkMigrationNeeded();

      if (!migrationNeeded) {
        if (this.config.logProgress) {
          log.info('No migration needed', { component: 'ViewerStateMigrationHelper' });
        }
        return true;
      }

      // Create migration plan
      const plan = await migrationSystem.createMigrationPlan();

      // Execute migration plan (includes our ViewerState migration)
      const migrationResult = await migrationSystem.executeMigration(plan);

      if (migrationResult.success) {
        if (this.config.logProgress) {
          log.info('System migration completed successfully', {
            component: 'ViewerStateMigrationHelper',
            metadata: {
              migrationsApplied: migrationResult.migrationsApplied.length,
              duration: migrationResult.duration,
            },
          });
        }
        return true;
      } else {
        log.error('System migration failed', {
          component: 'ViewerStateMigrationHelper',
          metadata: {
            errors: migrationResult.errors,
            migrationsApplied: migrationResult.migrationsApplied,
          },
        });
        return false;
      }
    } catch (error) {
      log.error(
        'System migration error',
        {
          component: 'ViewerStateMigrationHelper',
          metadata: { error: (error as Error).message },
        },
        error as Error,
      );
      return false;
    }
  }

  /**
   * Restore from backup
   */
  public async restoreFromBackup(backupId: string): Promise<boolean> {
    try {
      const backupData = await secureStorage.retrieve(`migration-backup-${backupId}`);
      if (!backupData) {
        log.error('Backup not found', {
          component: 'ViewerStateMigrationHelper',
          metadata: { backupId },
        });
        return false;
      }

      const backup = JSON.parse(backupData);

      // Restore the legacy state
      await secureStorage.store('viewer-state', JSON.stringify(backup.data), 'migration-restore');

      if (this.config.logProgress) {
        log.info('State restored from backup', {
          component: 'ViewerStateMigrationHelper',
          metadata: { backupId, backupTime: backup.createdAt },
        });
      }

      return true;
    } catch (error) {
      log.error(
        'Failed to restore from backup',
        {
          component: 'ViewerStateMigrationHelper',
          metadata: { backupId, error: (error as Error).message },
        },
        error as Error,
      );
      return false;
    }
  }

  /**
   * List available backups
   */
  public async listBackups(): Promise<Array<{ id: string; createdAt: string; version: string }>> {
    try {
      const allKeys = await secureStorage.getAllKeys('migration-backup');
      const backups: Array<{ id: string; createdAt: string; version: string }> = [];

      for (const key of allKeys) {
        if (key.startsWith('migration-backup-')) {
          const backupData = await secureStorage.retrieve(key);
          if (backupData) {
            const backup = JSON.parse(backupData);
            backups.push({
              id: backup.id,
              createdAt: backup.createdAt,
              version: backup.version || 'unknown',
            });
          }
        }
      }

      return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      log.error(
        'Failed to list backups',
        {
          component: 'ViewerStateMigrationHelper',
          metadata: { error: (error as Error).message },
        },
        error as Error,
      );
      return [];
    }
  }

  /**
   * Clean old backups
   */
  public async cleanOldBackups(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
      const allKeys = await secureStorage.getAllKeys('migration-backup');
      let cleanedCount = 0;

      for (const key of allKeys) {
        if (key.startsWith('migration-backup-')) {
          const backupData = await secureStorage.retrieve(key);
          if (backupData) {
            const backup = JSON.parse(backupData);
            const backupTime = new Date(backup.createdAt).getTime();

            if (backupTime < cutoffTime) {
              await secureStorage.remove(key);
              cleanedCount++;
            }
          }
        }
      }

      if (this.config.logProgress) {
        log.info('Old backups cleaned', {
          component: 'ViewerStateMigrationHelper',
          metadata: { cleanedCount, olderThanDays },
        });
      }

      return cleanedCount;
    } catch (error) {
      log.error(
        'Failed to clean old backups',
        {
          component: 'ViewerStateMigrationHelper',
          metadata: { error: (error as Error).message },
        },
        error as Error,
      );
      return 0;
    }
  }

  // ===== Private Methods =====

  private async createBackup(legacyState: unknown): Promise<string> {
    const backupId = `viewer-migration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const backup = {
      id: backupId,
      createdAt: new Date().toISOString(),
      version: '1.0.0', // Legacy version
      data: legacyState,
      type: 'viewer-state-migration',
    };

    await secureStorage.store(`migration-backup-${backupId}`, JSON.stringify(backup), 'migration-backup');
    return backupId;
  }

  private validateLegacyState(legacyState: unknown): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    if (!legacyState || typeof legacyState !== 'object') {
      return { isValid: false, warnings: ['Legacy state is not a valid object'] };
    }

    const state = legacyState as Record<string, unknown>;

    // Check for expected legacy structure
    if (!state.mode && !state.viewports) {
      warnings.push('No mode or viewports found in legacy state');
    }

    return { isValid: true, warnings };
  }

  private finalizeResult(result: MigrationHelperResult, startTime: number): MigrationHelperResult {
    result.totalTime = Date.now() - startTime;
    return result;
  }
}

// Export singleton instance for convenience
export const viewerStateMigrationHelper = new ViewerStateMigrationHelper();

// Export utility functions
export const migrateViewerState = ViewerStateMigration.migrate;
export const migrateViewerStateWithConfig = ViewerStateMigration.migrateWithConfig;
