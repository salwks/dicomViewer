/**
 * Viewport State Validator & Recovery Service
 * Advanced state validation with automatic recovery, backup, and rollback capabilities
 * Ensures viewport state integrity and provides graceful failure handling
 */

import { EventEmitter } from 'events';
import { ViewportState } from '../types/viewportState';
import { secureStorage } from '../security/secureStorage';
import { log } from '../utils/logger';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  category: 'critical' | 'warning' | 'info';
  validator: (state: ViewportState) => ValidationRuleResult;
  autoFix?: (state: ViewportState) => ViewportState | null;
  priority: number; // Higher number = higher priority
}

export interface ValidationRuleResult {
  isValid: boolean;
  message?: string;
  details?: Record<string, unknown>;
  suggestion?: string;
  canAutoFix: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
  fixableIssues: ValidationIssue[];
  criticalIssues: ValidationIssue[];
}

export interface ValidationIssue {
  ruleId: string;
  ruleName: string;
  category: 'critical' | 'warning' | 'info';
  message: string;
  field?: string;
  details?: Record<string, unknown>;
  suggestion?: string;
  canAutoFix: boolean;
  priority: number;
}

export interface StateBackup {
  id: string;
  viewportId: string;
  state: ViewportState;
  timestamp: string;
  reason: 'manual' | 'auto' | 'pre-validation' | 'recovery';
  metadata: {
    version: string;
    isCorrupted: boolean;
    validationResult?: ValidationResult;
  };
}

export interface RecoveryStrategy {
  name: string;
  description: string;
  priority: number;
  canApply: (state: ViewportState, issue: ValidationIssue) => boolean;
  apply: (state: ViewportState, issue: ValidationIssue) => ViewportState | null;
}

export interface ValidatorConfig {
  enableAutoValidation: boolean;
  enableAutoRecovery: boolean;
  enableBackups: boolean;
  validationFrequency: number; // milliseconds
  maxBackups: number;
  backupRetention: number; // milliseconds
  strictMode: boolean;
  recoveryStrategies: RecoveryStrategy[];
  customRules: ValidationRule[];
}

export const DEFAULT_VALIDATOR_CONFIG: ValidatorConfig = {
  enableAutoValidation: true,
  enableAutoRecovery: true,
  enableBackups: true,
  validationFrequency: 30000, // 30 seconds
  maxBackups: 50,
  backupRetention: 24 * 60 * 60 * 1000, // 24 hours
  strictMode: false,
  recoveryStrategies: [],
  customRules: [],
};

export interface ValidatorEvents {
  'validation-started': [string]; // [viewportId]
  'validation-completed': [string, ValidationResult]; // [viewportId, result]
  'validation-failed': [string, Error]; // [viewportId, error]
  'state-corrupted': [string, ValidationResult]; // [viewportId, result]
  'recovery-started': [string, ValidationIssue[]]; // [viewportId, issues]
  'recovery-completed': [string, ViewportState]; // [viewportId, recoveredState]
  'recovery-failed': [string, Error]; // [viewportId, error]
  'backup-created': [StateBackup];
  'backup-restored': [string, StateBackup]; // [viewportId, backup]
  'auto-fix-applied': [string, ValidationIssue, ViewportState]; // [viewportId, issue, newState]
}

export class ViewportStateValidator extends EventEmitter {
  private config: ValidatorConfig;
  private validationRules = new Map<string, ValidationRule>();
  private recoveryStrategies: RecoveryStrategy[] = [];
  private backups = new Map<string, StateBackup[]>(); // viewportId -> backups
  private backupHistory = new Map<string, StateBackup>(); // backupId -> backup
  private validationInterval: NodeJS.Timeout | null = null;
  private validatingViewports = new Set<string>();

  constructor(config: Partial<ValidatorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_VALIDATOR_CONFIG, ...config };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    log.info('ViewportStateValidator initializing', {
      component: 'ViewportStateValidator',
      metadata: {
        autoValidation: this.config.enableAutoValidation,
        autoRecovery: this.config.enableAutoRecovery,
      },
    });

    // Load built-in validation rules
    this.loadBuiltInRules();

    // Load custom rules
    this.config.customRules.forEach(rule => this.addValidationRule(rule));

    // Load built-in recovery strategies
    this.loadBuiltInRecoveryStrategies();

    // Load custom recovery strategies
    this.recoveryStrategies.push(...this.config.recoveryStrategies);

    // Load persisted backups
    if (this.config.enableBackups) {
      await this.loadPersistedBackups();
    }

    // Setup auto-validation if enabled
    if (this.config.enableAutoValidation) {
      this.setupAutoValidation();
    }
  }

  // ===== Validation Rules Management =====

  public addValidationRule(rule: ValidationRule): void {
    this.validationRules.set(rule.id, rule);

    log.info('Validation rule added', {
      component: 'ViewportStateValidator',
      metadata: { ruleId: rule.id, category: rule.category },
    });
  }

  public removeValidationRule(ruleId: string): boolean {
    const existed = this.validationRules.has(ruleId);
    this.validationRules.delete(ruleId);

    if (existed) {
      log.info('Validation rule removed', {
        component: 'ViewportStateValidator',
        metadata: { ruleId },
      });
    }

    return existed;
  }

  public getValidationRules(): ValidationRule[] {
    return Array.from(this.validationRules.values());
  }

  // ===== Validation =====

  public async validateState(viewportId: string, state: ViewportState): Promise<ValidationResult> {
    if (this.validatingViewports.has(viewportId)) {
      throw new Error(`Validation already in progress for viewport: ${viewportId}`);
    }

    this.validatingViewports.add(viewportId);
    this.emit('validation-started', viewportId);

    try {
      const result = await this.performValidation(state);

      this.emit('validation-completed', viewportId, result);

      // Handle critical issues
      if (result.criticalIssues.length > 0) {
        this.emit('state-corrupted', viewportId, result);

        if (this.config.enableAutoRecovery) {
          await this.attemptRecovery(viewportId, state, result);
        }
      }

      log.info('State validation completed', {
        component: 'ViewportStateValidator',
        metadata: {
          viewportId,
          isValid: result.isValid,
          errorCount: result.errors.length,
          warningCount: result.warnings.length,
        },
      });

      return result;
    } catch (error) {
      this.emit('validation-failed', viewportId, error as Error);
      throw error;
    } finally {
      this.validatingViewports.delete(viewportId);
    }
  }

  private async performValidation(state: ViewportState): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];

    // Sort rules by priority (highest first)
    const sortedRules = Array.from(this.validationRules.values()).sort((a, b) => b.priority - a.priority);

    // Run each validation rule
    for (const rule of sortedRules) {
      try {
        const ruleResult = rule.validator(state);

        if (!ruleResult.isValid) {
          issues.push({
            ruleId: rule.id,
            ruleName: rule.name,
            category: rule.category,
            message: ruleResult.message || `Validation failed for rule: ${rule.name}`,
            details: ruleResult.details,
            suggestion: ruleResult.suggestion,
            canAutoFix: ruleResult.canAutoFix && !!rule.autoFix,
            priority: rule.priority,
          });
        }
      } catch (error) {
        log.error(
          'Validation rule execution failed',
          {
            component: 'ViewportStateValidator',
            metadata: { ruleId: rule.id, ruleName: rule.name },
          },
          error as Error,
        );

        issues.push({
          ruleId: rule.id,
          ruleName: rule.name,
          category: 'critical',
          message: `Validation rule execution failed: ${(error as Error).message}`,
          canAutoFix: false,
          priority: rule.priority,
        });
      }
    }

    // Categorize issues
    const errors = issues.filter(issue => issue.category === 'critical');
    const warnings = issues.filter(issue => issue.category === 'warning');
    const info = issues.filter(issue => issue.category === 'info');
    const fixableIssues = issues.filter(issue => issue.canAutoFix);
    const criticalIssues = errors;

    return {
      isValid: errors.length === 0 && (!this.config.strictMode || warnings.length === 0),
      errors,
      warnings,
      info,
      fixableIssues,
      criticalIssues,
    };
  }

  // ===== Auto-Fix and Recovery =====

  public async autoFixState(
    viewportId: string,
    state: ViewportState,
    issues?: ValidationIssue[],
  ): Promise<ViewportState | null> {
    const issuesToFix = issues || (await this.validateState(viewportId, state)).fixableIssues;

    if (issuesToFix.length === 0) {
      return null;
    }

    let fixedState = { ...state };
    let fixesApplied = 0;

    // Sort issues by priority (highest first)
    const sortedIssues = issuesToFix.sort((a, b) => b.priority - a.priority);

    for (const issue of sortedIssues) {
      const rule = this.validationRules.get(issue.ruleId);
      if (!rule || !rule.autoFix) {
        continue;
      }

      try {
        const autoFixedState = rule.autoFix(fixedState);
        if (autoFixedState) {
          fixedState = autoFixedState;
          fixesApplied++;

          this.emit('auto-fix-applied', viewportId, issue, fixedState);

          log.info('Auto-fix applied', {
            component: 'ViewportStateValidator',
            metadata: { viewportId, ruleId: issue.ruleId, ruleName: issue.ruleName },
          });
        }
      } catch (error) {
        log.error(
          'Auto-fix failed',
          {
            component: 'ViewportStateValidator',
            metadata: { viewportId, ruleId: issue.ruleId },
          },
          error as Error,
        );
      }
    }

    return fixesApplied > 0 ? fixedState : null;
  }

  private async attemptRecovery(
    viewportId: string,
    corruptedState: ViewportState,
    validationResult: ValidationResult,
  ): Promise<void> {
    this.emit('recovery-started', viewportId, validationResult.criticalIssues);

    try {
      // Strategy 1: Try auto-fix first
      const autoFixed = await this.autoFixState(viewportId, corruptedState, validationResult.fixableIssues);
      if (autoFixed) {
        const revalidation = await this.performValidation(autoFixed);
        if (revalidation.isValid || revalidation.criticalIssues.length === 0) {
          this.emit('recovery-completed', viewportId, autoFixed);
          return;
        }
      }

      // Strategy 2: Apply recovery strategies
      let recoveredState = { ...corruptedState };

      for (const issue of validationResult.criticalIssues) {
        const applicableStrategies = this.recoveryStrategies
          .filter(strategy => strategy.canApply(recoveredState, issue))
          .sort((a, b) => b.priority - a.priority);

        for (const strategy of applicableStrategies) {
          try {
            const strategyResult = strategy.apply(recoveredState, issue);
            if (strategyResult) {
              recoveredState = strategyResult;

              log.info('Recovery strategy applied', {
                component: 'ViewportStateValidator',
                metadata: { viewportId, strategyName: strategy.name, issueRuleId: issue.ruleId },
              });
              break;
            }
          } catch (error) {
            log.error(
              'Recovery strategy failed',
              {
                component: 'ViewportStateValidator',
                metadata: { viewportId, strategyName: strategy.name },
              },
              error as Error,
            );
          }
        }
      }

      // Strategy 3: Restore from backup
      if (this.config.enableBackups) {
        const backup = await this.findBestBackup(viewportId);
        if (backup && !backup.metadata.isCorrupted) {
          recoveredState = backup.state;
          this.emit('backup-restored', viewportId, backup);

          log.info('State recovered from backup', {
            component: 'ViewportStateValidator',
            metadata: { viewportId, backupId: backup.id, backupTimestamp: backup.timestamp },
          });
        }
      }

      // Validate recovered state
      const finalValidation = await this.performValidation(recoveredState);
      if (finalValidation.criticalIssues.length < validationResult.criticalIssues.length) {
        this.emit('recovery-completed', viewportId, recoveredState);
      } else {
        throw new Error('Recovery strategies failed to resolve critical issues');
      }
    } catch (error) {
      this.emit('recovery-failed', viewportId, error as Error);
      throw error;
    }
  }

  // ===== Backup Management =====

  public async createBackup(
    viewportId: string,
    state: ViewportState,
    reason: StateBackup['reason'] = 'manual',
  ): Promise<StateBackup> {
    if (!this.config.enableBackups) {
      throw new Error('Backups are disabled');
    }

    const backup: StateBackup = {
      id: this.generateBackupId(),
      viewportId,
      state: { ...state },
      timestamp: new Date().toISOString(),
      reason,
      metadata: {
        version: '1.0.0',
        isCorrupted: false,
      },
    };

    // Validate the state being backed up
    try {
      const validation = await this.performValidation(state);
      backup.metadata.validationResult = validation;
      backup.metadata.isCorrupted = validation.criticalIssues.length > 0;
    } catch {
      backup.metadata.isCorrupted = true;
    }

    // Store backup
    if (!this.backups.has(viewportId)) {
      this.backups.set(viewportId, []);
    }

    const viewportBackups = this.backups.get(viewportId)!;
    viewportBackups.push(backup);

    // Cleanup old backups
    await this.cleanupBackups(viewportId);

    // Persist backup
    await this.persistBackup(backup);

    this.emit('backup-created', backup);

    log.info('State backup created', {
      component: 'ViewportStateValidator',
      metadata: { viewportId, backupId: backup.id, reason },
    });

    return backup;
  }

  public async restoreBackup(viewportId: string, backupId: string): Promise<ViewportState> {
    const viewportBackups = this.backups.get(viewportId) || [];
    const backup = viewportBackups.find(b => b.id === backupId);

    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    if (backup.metadata.isCorrupted) {
      log.warn('Restoring corrupted backup', {
        component: 'ViewportStateValidator',
        metadata: { viewportId, backupId },
      });
    }

    this.emit('backup-restored', viewportId, backup);

    log.info('State backup restored', {
      component: 'ViewportStateValidator',
      metadata: { viewportId, backupId, backupTimestamp: backup.timestamp },
    });

    return { ...backup.state };
  }

  public getBackups(viewportId: string): StateBackup[] {
    return (this.backups.get(viewportId) || []).map(backup => ({ ...backup }));
  }

  private async findBestBackup(viewportId: string): Promise<StateBackup | null> {
    const viewportBackups = this.backups.get(viewportId) || [];

    // Filter out corrupted backups and sort by timestamp (newest first)
    const validBackups = viewportBackups
      .filter(backup => !backup.metadata.isCorrupted)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return validBackups[0] || null;
  }

  private async cleanupBackups(viewportId: string): Promise<void> {
    const viewportBackups = this.backups.get(viewportId) || [];

    // Remove old backups beyond retention period
    const now = Date.now();
    const retentionCutoff = now - this.config.backupRetention;

    const activeBackups = viewportBackups.filter(backup => new Date(backup.timestamp).getTime() > retentionCutoff);

    // Keep only max number of backups
    if (activeBackups.length > this.config.maxBackups) {
      activeBackups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      activeBackups.splice(this.config.maxBackups);
    }

    this.backups.set(viewportId, activeBackups);
  }

  // ===== Built-in Rules and Strategies =====

  private loadBuiltInRules(): void {
    const builtInRules: ValidationRule[] = [
      {
        id: 'viewport-id-required',
        name: 'Viewport ID Required',
        description: 'Viewport must have a valid ID',
        category: 'critical',
        priority: 100,
        validator: state => ({
          isValid: !!state.id && typeof state.id === 'string' && state.id.trim().length > 0,
          message: 'Viewport ID is required and must be a non-empty string',
          canAutoFix: false,
        }),
      },
      {
        id: 'viewport-type-valid',
        name: 'Viewport Type Valid',
        description: 'Viewport type must be valid',
        category: 'critical',
        priority: 90,
        validator: state => ({
          isValid: ['stack', 'volume', 'multiplanar'].includes(state.type),
          message: 'Viewport type must be stack, volume, or multiplanar',
          canAutoFix: true,
        }),
        autoFix: state => ({
          ...state,
          type: 'stack',
        }),
      },
      {
        id: 'camera-position-finite',
        name: 'Camera Position Finite',
        description: 'Camera position values must be finite numbers',
        category: 'critical',
        priority: 80,
        validator: state => ({
          isValid: state.camera?.position?.every(val => isFinite(val)) || false,
          message: 'Camera position values must be finite numbers',
          canAutoFix: true,
        }),
        autoFix: state => ({
          ...state,
          camera: {
            ...state.camera,
            position: state.camera.position.map(val => (isFinite(val) ? val : 0)) as [number, number, number],
          },
        }),
      },
      {
        id: 'window-level-positive',
        name: 'Window Level Positive',
        description: 'Window width must be positive',
        category: 'critical',
        priority: 70,
        validator: state => ({
          isValid: !state.windowLevel || state.windowLevel.width > 0,
          message: 'Window width must be positive',
          canAutoFix: true,
        }),
        autoFix: state => ({
          ...state,
          windowLevel: {
            ...state.windowLevel,
            width: Math.max(state.windowLevel?.width || 400, 1),
          },
        }),
      },
      {
        id: 'zoom-positive',
        name: 'Zoom Positive',
        description: 'Zoom value must be positive',
        category: 'warning',
        priority: 60,
        validator: state => ({
          isValid: !state.transform || state.transform.zoom > 0,
          message: 'Zoom value must be positive',
          canAutoFix: true,
        }),
        autoFix: state => ({
          ...state,
          transform: {
            ...state.transform,
            zoom: Math.max(state.transform?.zoom || 1, 0.1),
          },
        }),
      },
    ];

    builtInRules.forEach(rule => this.addValidationRule(rule));
  }

  private loadBuiltInRecoveryStrategies(): void {
    const builtInStrategies: RecoveryStrategy[] = [
      {
        name: 'Reset to Default',
        description: 'Reset viewport to default state',
        priority: 10,
        canApply: () => true,
        apply: state => ({
          ...state,
          camera: {
            position: [0, 0, -1000],
            focalPoint: [0, 0, 0],
            viewUp: [0, -1, 0],
            parallelScale: 300,
            parallelProjection: true,
          },
          windowLevel: {
            width: 400,
            center: 40,
          },
          transform: {
            pan: { x: 0, y: 0 },
            zoom: 1.0,
          },
        }),
      },
      {
        name: 'Fix Numeric Values',
        description: 'Fix invalid numeric values',
        priority: 80,
        canApply: (_state, issue) => issue.ruleId.includes('finite') || issue.ruleId.includes('positive'),
        apply: state => {
          const fixed = { ...state };

          // Fix camera positions
          if (fixed.camera?.position) {
            fixed.camera.position = fixed.camera.position.map(val => (isFinite(val) ? val : 0)) as [
              number,
              number,
              number,
            ];
          }

          // Fix window level
          if (fixed.windowLevel) {
            fixed.windowLevel.width = Math.max(fixed.windowLevel.width, 1);
          }

          // Fix zoom
          if (fixed.transform) {
            fixed.transform.zoom = Math.max(fixed.transform.zoom, 0.1);
          }

          return fixed;
        },
      },
    ];

    this.recoveryStrategies.push(...builtInStrategies);
  }

  // ===== Auto-Validation =====

  private setupAutoValidation(): void {
    this.validationInterval = setInterval(() => {
      // Auto-validation would be triggered externally by providing states to validate
    }, this.config.validationFrequency);
  }

  // ===== Persistence =====

  private async persistBackup(backup: StateBackup): Promise<void> {
    try {
      const key = `backup-${backup.viewportId}-${backup.id}`;
      const data = JSON.stringify(backup);
      await secureStorage.store(key, data, 'state-backup');
    } catch (error) {
      log.error(
        'Failed to persist backup',
        {
          component: 'ViewportStateValidator',
          metadata: { backupId: backup.id, viewportId: backup.viewportId },
        },
        error as Error,
      );
    }
  }

  private async loadPersistedBackups(): Promise<void> {
    try {
      // Load backups from secure storage
      const { secureStorage } = await import('../security/secureStorage');

      // Get all backup keys from secure storage
      const backupKeys = await secureStorage.getAllKeys('viewport-backup');
      let loadedCount = 0;

      for (const key of backupKeys) {
        try {
          const backupData = await secureStorage.retrieve(key);
          if (backupData) {
            const backup = JSON.parse(backupData);

            // Validate backup structure
            if (backup.id && backup.state && backup.timestamp) {
              // Store in memory for quick access
              this.backupHistory.set(backup.id, {
                id: backup.id,
                viewportId: backup.viewportId || 'unknown',
                state: backup.state,
                timestamp: backup.timestamp,
                reason: backup.reason || 'auto',
                metadata: backup.metadata || {
                  version: '1.0.0',
                  isCorrupted: false,
                },
              });
              loadedCount++;
            }
          }
        } catch (error) {
          log.warn(
            'Failed to load individual backup',
            {
              component: 'ViewportStateValidator',
              metadata: { key },
            },
            error as Error,
          );
        }
      }

      // Limit memory usage by keeping only recent backups
      if (this.backupHistory.size > this.config.maxBackups) {
        const sortedBackups = Array.from(this.backupHistory.entries()).sort(
          ([, a], [, b]) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );

        // Keep only the most recent backups
        this.backupHistory.clear();
        sortedBackups.slice(0, this.config.maxBackups).forEach(([id, backup]) => {
          this.backupHistory.set(id, backup);
        });
      }

      log.info('Persisted backups loaded', {
        component: 'ViewportStateValidator',
        metadata: { loadedCount, totalInMemory: this.backupHistory.size },
      });
    } catch (error) {
      log.error(
        'Failed to load persisted backups',
        {
          component: 'ViewportStateValidator',
        },
        error as Error,
      );
    }
  }

  // ===== Utility Methods =====

  private generateBackupId(): string {
    return `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ===== Cleanup =====

  public dispose(): void {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
    }

    this.validationRules.clear();
    this.recoveryStrategies = [];
    this.backups.clear();
    this.validatingViewports.clear();
    this.removeAllListeners();

    log.info('ViewportStateValidator disposed', {
      component: 'ViewportStateValidator',
    });
  }
}

// Singleton instance
export const viewportStateValidator = new ViewportStateValidator();
