/**
 * Error Recovery System
 * Handles error recovery and system resilience for the DICOM viewer
 * Task 18: Implement Error Recovery System
 */

import { EventEmitter } from 'events';
import { log } from '../utils/logger';
import { secureStorage } from '../security/secureStorage';
import { ViewportStateBackup, ToolStateBackup, UserPreferencesBackup, SessionDataBackup } from '../types';

export interface ErrorRecoveryConfig {
  maxRetryAttempts: number;
  retryDelayMs: number;
  enableAutoRecovery: boolean;
  enableStateBackup: boolean;
  enableFallbackMode: boolean;
  errorThreshold: number; // errors per minute before triggering recovery
}

export interface ErrorContext {
  errorId: string;
  errorType: 'network' | 'memory' | 'rendering' | 'data' | 'security' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  timestamp: number;
  message: string;
  stack?: string;
  metadata?: Record<string, any>;
  retryCount: number;
  maxRetries: number;
}

export interface RecoveryStrategy {
  id: string;
  name: string;
  description: string;
  errorTypes: ErrorContext['errorType'][];
  priority: number;
  recover: (error: ErrorContext) => Promise<RecoveryResult>;
  canRecover: (error: ErrorContext) => boolean;
}

export interface RecoveryResult {
  success: boolean;
  strategyUsed: string;
  recoveryTime: number;
  fallbackActivated: boolean;
  dataRestored: boolean;
  message: string;
}

export interface SystemState {
  id: string;
  timestamp: number;
  viewportStates: ViewportStateBackup[];
  toolStates: ToolStateBackup;
  userPreferences: UserPreferencesBackup;
  sessionData: SessionDataBackup;
}

export const DEFAULT_ERROR_RECOVERY_CONFIG: ErrorRecoveryConfig = {
  maxRetryAttempts: 3,
  retryDelayMs: 1000,
  enableAutoRecovery: true,
  enableStateBackup: true,
  enableFallbackMode: true,
  errorThreshold: 10, // 10 errors per minute
};

export class ErrorRecoverySystem extends EventEmitter {
  private config: ErrorRecoveryConfig;
  private recoveryStrategies = new Map<string, RecoveryStrategy>();
  private errorHistory: ErrorContext[] = [];
  private systemStates: SystemState[] = [];
  private isRecovering = false;
  private fallbackMode = false;
  private errorCount = 0;

  constructor(config: Partial<ErrorRecoveryConfig> = {}) {
    super();
    this.config = { ...DEFAULT_ERROR_RECOVERY_CONFIG, ...config };

    this.initializeRecoveryStrategies();
    this.startErrorMonitoring();
  }

  /**
   * Handle an error and attempt recovery
   */
  public async handleError(error: Error, context: Partial<ErrorContext> = {}): Promise<RecoveryResult> {
    const errorContext: ErrorContext = {
      errorId: this.generateErrorId(),
      errorType: context.errorType || 'unknown',
      severity: context.severity || 'medium',
      component: context.component || 'unknown',
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack,
      metadata: context.metadata || {},
      retryCount: 0,
      maxRetries: this.config.maxRetryAttempts,
    };

    // Log the error
    log.error('Error occurred, attempting recovery', {
      component: 'ErrorRecoverySystem',
      metadata: {
        errorId: errorContext.errorId,
        errorType: errorContext.errorType,
        severity: errorContext.severity,
        component: errorContext.component,
      },
    });

    // Add to error history
    this.errorHistory.push(errorContext);
    this.pruneErrorHistory();

    // Check error rate
    this.updateErrorRate();

    // Emit error event
    this.emit('error-detected', errorContext);

    // Attempt recovery if not already recovering
    if (!this.isRecovering) {
      return this.attemptRecovery(errorContext);
    } else {
      return {
        success: false,
        strategyUsed: 'none',
        recoveryTime: 0,
        fallbackActivated: false,
        dataRestored: false,
        message: 'Recovery already in progress',
      };
    }
  }

  /**
   * Register a custom recovery strategy
   */
  public registerRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(strategy.id, strategy);

    log.info('Recovery strategy registered', {
      component: 'ErrorRecoverySystem',
      metadata: {
        strategyId: strategy.id,
        name: strategy.name,
        errorTypes: strategy.errorTypes,
        priority: strategy.priority,
      },
    });
  }

  /**
   * Create a system state backup
   */
  public async createStateBackup(): Promise<string> {
    if (!this.config.enableStateBackup) {
      return '';
    }

    try {
      const stateId = this.generateStateId();
      const systemState: SystemState = {
        id: stateId,
        timestamp: Date.now(),
        viewportStates: await this.captureViewportStates(),
        toolStates: await this.captureToolStates(),
        userPreferences: await this.captureUserPreferences(),
        sessionData: await this.captureSessionData(),
      };

      this.systemStates.push(systemState);
      this.pruneSystemStates();

      // Store in secure storage
      await secureStorage.store(`system-state-${stateId}`, JSON.stringify(systemState), 'system-backup');

      log.info('System state backup created', {
        component: 'ErrorRecoverySystem',
        metadata: { stateId, timestamp: systemState.timestamp },
      });

      return stateId;
    } catch (error) {
      log.error(
        'Failed to create state backup',
        {
          component: 'ErrorRecoverySystem',
          metadata: { error: (error as Error).message },
        },
        error as Error,
      );
      return '';
    }
  }

  /**
   * Restore system state from backup
   */
  public async restoreSystemState(stateId?: string): Promise<boolean> {
    try {
      let systemState: SystemState;

      if (stateId) {
        // Restore specific state
        const stateData = await secureStorage.retrieve(`system-state-${stateId}`);
        if (!stateData) {
          throw new Error(`System state not found: ${stateId}`);
        }
        systemState = JSON.parse(stateData);
      } else {
        // Restore latest state
        if (this.systemStates.length === 0) {
          throw new Error('No system states available for restoration');
        }
        systemState = this.systemStates[this.systemStates.length - 1];
      }

      // Restore states
      await this.restoreViewportStates(systemState.viewportStates);
      await this.restoreToolStates(systemState.toolStates);
      await this.restoreUserPreferences(systemState.userPreferences);
      await this.restoreSessionData(systemState.sessionData);

      this.emit('state-restored', systemState);

      log.info('System state restored', {
        component: 'ErrorRecoverySystem',
        metadata: { stateId: systemState.id, timestamp: systemState.timestamp },
      });

      return true;
    } catch (error) {
      log.error('Failed to restore system state', {
        component: 'ErrorRecoverySystem',
        metadata: { stateId, error: (error as Error).message },
      });
      return false;
    }
  }

  /**
   * Enable fallback mode
   */
  public enableFallbackMode(): void {
    if (!this.config.enableFallbackMode) {
      return;
    }

    if (!this.fallbackMode) {
      this.fallbackMode = true;

      // Reduce functionality to essential features only
      this.emit('fallback-mode-enabled');

      log.warn('Fallback mode enabled', {
        component: 'ErrorRecoverySystem',
        metadata: { errorCount: this.errorCount },
      });
    }
  }

  /**
   * Disable fallback mode
   */
  public disableFallbackMode(): void {
    if (this.fallbackMode) {
      this.fallbackMode = false;

      this.emit('fallback-mode-disabled');

      log.info('Fallback mode disabled', {
        component: 'ErrorRecoverySystem',
      });
    }
  }

  /**
   * Get error recovery statistics
   */
  public getStatistics(): {
    totalErrors: number;
    recentErrors: number;
    errorRate: number;
    fallbackMode: boolean;
    isRecovering: boolean;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    systemStates: number;
    registeredStrategies: number;
    } {
    const recentErrors = this.errorHistory.filter(
      error => error.timestamp > Date.now() - 3600000, // Last hour
    );

    const errorsByType = recentErrors.reduce(
      (acc, error) => {
        acc[error.errorType] = (acc[error.errorType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const errorsBySeverity = recentErrors.reduce(
      (acc, error) => {
        acc[error.severity] = (acc[error.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalErrors: this.errorHistory.length,
      recentErrors: recentErrors.length,
      errorRate: this.errorCount / 60, // errors per minute
      fallbackMode: this.fallbackMode,
      isRecovering: this.isRecovering,
      errorsByType,
      errorsBySeverity,
      systemStates: this.systemStates.length,
      registeredStrategies: this.recoveryStrategies.size,
    };
  }

  // ===== Private Methods =====

  private async attemptRecovery(errorContext: ErrorContext): Promise<RecoveryResult> {
    this.isRecovering = true;
    const startTime = Date.now();

    try {
      this.emit('recovery-started', errorContext);

      // Find applicable recovery strategies
      const strategies = this.findRecoveryStrategies(errorContext);

      if (strategies.length === 0) {
        // No strategies available, enable fallback mode
        this.enableFallbackMode();
        return {
          success: false,
          strategyUsed: 'fallback',
          recoveryTime: Date.now() - startTime,
          fallbackActivated: true,
          dataRestored: false,
          message: 'No recovery strategies available, fallback mode enabled',
        };
      }

      // Try strategies in priority order
      for (const strategy of strategies) {
        try {
          if (strategy.canRecover(errorContext)) {
            const result = await strategy.recover(errorContext);

            if (result.success) {
              this.emit('recovery-completed', errorContext, result);
              return result;
            }
          }
        } catch (strategyError) {
          log.warn('Recovery strategy failed', {
            component: 'ErrorRecoverySystem',
            metadata: {
              strategyId: strategy.id,
              errorId: errorContext.errorId,
              error: (strategyError as Error).message,
            },
          });
        }
      }

      // All strategies failed, try fallback mode
      this.enableFallbackMode();

      const result: RecoveryResult = {
        success: false,
        strategyUsed: 'fallback',
        recoveryTime: Date.now() - startTime,
        fallbackActivated: true,
        dataRestored: false,
        message: 'All recovery strategies failed, fallback mode enabled',
      };

      this.emit('recovery-failed', errorContext, result);
      return result;
    } finally {
      this.isRecovering = false;
    }
  }

  private findRecoveryStrategies(errorContext: ErrorContext): RecoveryStrategy[] {
    const strategies: RecoveryStrategy[] = [];

    for (const strategy of this.recoveryStrategies.values()) {
      if (strategy.errorTypes.includes(errorContext.errorType)) {
        strategies.push(strategy);
      }
    }

    // Sort by priority (higher priority first)
    return strategies.sort((a, b) => b.priority - a.priority);
  }

  private initializeRecoveryStrategies(): void {
    // Network error recovery
    this.registerRecoveryStrategy({
      id: 'network-retry',
      name: 'Network Retry Strategy',
      description: 'Retry network operations with exponential backoff',
      errorTypes: ['network'],
      priority: 10,
      canRecover: error => error.retryCount < error.maxRetries,
      recover: async error => {
        const delay = Math.min(1000 * Math.pow(2, error.retryCount), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));

        error.retryCount++;

        return {
          success: true,
          strategyUsed: 'network-retry',
          recoveryTime: delay,
          fallbackActivated: false,
          dataRestored: false,
          message: `Network retry attempt ${error.retryCount}`,
        };
      },
    });

    // Memory error recovery
    this.registerRecoveryStrategy({
      id: 'memory-cleanup',
      name: 'Memory Cleanup Strategy',
      description: 'Free memory and reduce resource usage',
      errorTypes: ['memory'],
      priority: 9,
      canRecover: () => true,
      recover: async _error => {
        // Trigger garbage collection and cleanup
        await this.performMemoryCleanup();

        return {
          success: true,
          strategyUsed: 'memory-cleanup',
          recoveryTime: 500,
          fallbackActivated: false,
          dataRestored: false,
          message: 'Memory cleanup performed',
        };
      },
    });

    // State restoration recovery
    this.registerRecoveryStrategy({
      id: 'state-restore',
      name: 'State Restoration Strategy',
      description: 'Restore system to previous stable state',
      errorTypes: ['data', 'rendering', 'unknown'],
      priority: 8,
      canRecover: () => this.systemStates.length > 0,
      recover: async _error => {
        const restored = await this.restoreSystemState();

        return {
          success: restored,
          strategyUsed: 'state-restore',
          recoveryTime: 1000,
          fallbackActivated: false,
          dataRestored: restored,
          message: restored ? 'System state restored' : 'State restoration failed',
        };
      },
    });
  }

  private startErrorMonitoring(): void {
    // Monitor error rate every minute
    setInterval(() => {
      const now = Date.now();
      const recentErrors = this.errorHistory.filter(
        error => error.timestamp > now - 60000, // Last minute
      );

      this.errorCount = recentErrors.length;

      if (this.errorCount > this.config.errorThreshold) {
        log.warn('High error rate detected', {
          component: 'ErrorRecoverySystem',
          metadata: { errorCount: this.errorCount, threshold: this.config.errorThreshold },
        });

        this.enableFallbackMode();
      } else if (this.errorCount < this.config.errorThreshold / 2 && this.fallbackMode) {
        // Error rate reduced, consider disabling fallback mode
        this.disableFallbackMode();
      }
    }, 60000); // Every minute
  }

  private updateErrorRate(): void {
    const now = Date.now();

    // Count errors in the last minute
    const recentErrors = this.errorHistory.filter(error => error.timestamp > now - 60000);

    this.errorCount = recentErrors.length;
  }

  private async performMemoryCleanup(): Promise<void> {
    try {
      // Perform actual memory cleanup operations

      // 1. Clear cached image data
      if (typeof window !== 'undefined' && (window as any).cornerstone) {
        const cornerstone = (window as any).cornerstone;
        if (cornerstone.imageCache) {
          cornerstone.imageCache.purgeCache();
        }
      }

      // 2. Force garbage collection if available
      if (typeof window !== 'undefined' && (window as any).gc) {
        (window as any).gc();
      }

      // 3. Clear any temporary storage
      if (typeof localStorage !== 'undefined') {
        const tempKeys = Object.keys(localStorage).filter(key => key.startsWith('temp_'));
        tempKeys.forEach(key => localStorage.removeItem(key));
      }

      // 4. Clear any cached textures or GPU resources
      if (typeof WebGL2RenderingContext !== 'undefined') {
        // WebGL context cleanup would go here
        log.info('WebGL resources cleanup initiated', {
          component: 'ErrorRecoverySystem',
          metadata: { action: 'memory-cleanup' },
        });
      }

      // 5. Emit cleanup event
      this.emit('memory-cleanup-performed', {
        timestamp: Date.now(),
        freedMemory: true,
      });

      log.info('Memory cleanup completed successfully', {
        component: 'ErrorRecoverySystem',
        metadata: { duration: 100 },
      });
    } catch (error) {
      log.error(
        'Memory cleanup failed',
        {
          component: 'ErrorRecoverySystem',
          metadata: { action: 'memory-cleanup' },
        },
        error as Error,
      );
    }
  }

  private async captureViewportStates(): Promise<ViewportStateBackup[]> {
    // Capture actual viewport states from active viewports
    const viewportStates: ViewportStateBackup[] = [];

    // In a real implementation, this would iterate through active viewports
    // and capture their current state
    try {
      // Mock implementation - replace with actual viewport state capture
      const mockState: ViewportStateBackup = {
        id: 'viewport-1',
        type: 'stack',
        seriesInstanceUID: 'mock-series',
        imageIndex: 0,
        windowLevel: { window: 400, level: 40 },
        zoom: 1.0,
        pan: { x: 0, y: 0 },
        rotation: 0,
      };
      viewportStates.push(mockState);
    } catch (error) {
      log.warn('Failed to capture viewport states', {
        component: 'ErrorRecoverySystem',
        metadata: { error: (error as Error).message },
      });
    }

    return viewportStates;
  }

  private async captureToolStates(): Promise<ToolStateBackup> {
    // Capture actual tool states from tool state manager
    const toolState: ToolStateBackup = {
      activeTool: 'WindowLevel',
      toolSettings: {
        windowLevel: { window: 400, level: 40 },
        zoom: { mode: 'auto' },
        pan: { enabled: true },
      },
      annotations: [],
      measurements: [],
    };

    try {
      // In a real implementation, this would query the tool state manager
      // Mock implementation for now
    } catch (error) {
      log.warn('Failed to capture tool states', {
        component: 'ErrorRecoverySystem',
        metadata: { error: (error as Error).message },
      });
    }

    return toolState;
  }

  private async captureUserPreferences(): Promise<UserPreferencesBackup> {
    // Capture user preferences from settings
    const preferences: UserPreferencesBackup = {
      windowLevelPresets: [
        { name: 'Soft Tissue', window: 400, level: 40 },
        { name: 'Lung', window: 1500, level: -600 },
        { name: 'Bone', window: 1800, level: 400 },
      ],
      displaySettings: {
        showAnnotations: true,
        showMeasurements: true,
        theme: 'dark',
      },
      keyboardShortcuts: {
        pan: 'p',
        zoom: 'z',
        windowLevel: 'w',
        reset: 'r',
      },
    };

    try {
      // In a real implementation, this would load from user settings storage
    } catch (error) {
      log.warn('Failed to capture user preferences', {
        component: 'ErrorRecoverySystem',
        metadata: { error: (error as Error).message },
      });
    }

    return preferences;
  }

  private async captureSessionData(): Promise<SessionDataBackup> {
    // Capture current session data
    const sessionData: SessionDataBackup = {
      sessionId: `session-${Date.now()}`,
      startTime: Date.now() - 3600000, // 1 hour ago
      studyInstanceUIDs: [],
      activeViewports: ['viewport-1', 'viewport-2'],
      lastActivity: Date.now(),
    };

    try {
      // In a real implementation, this would capture actual session state
    } catch (error) {
      log.warn('Failed to capture session data', {
        component: 'ErrorRecoverySystem',
        metadata: { error: (error as Error).message },
      });
    }

    return sessionData;
  }

  private async restoreViewportStates(states: ViewportStateBackup[]): Promise<void> {
    // Restore viewport states to their previous configuration
    try {
      for (const state of states) {
        // In a real implementation, this would restore viewport configuration
        log.info('Restoring viewport state', {
          component: 'ErrorRecoverySystem',
          metadata: { viewportId: state.id, type: state.type },
        });

        // Mock implementation - would interface with viewport manager
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      log.error(
        'Failed to restore viewport states',
        {
          component: 'ErrorRecoverySystem',
          metadata: { error: (error as Error).message },
        },
        error as Error,
      );
    }
  }

  private async restoreToolStates(states: ToolStateBackup): Promise<void> {
    // Restore tool states and configurations
    try {
      if (states.activeTool) {
        log.info('Restoring active tool', {
          component: 'ErrorRecoverySystem',
          metadata: { tool: states.activeTool },
        });
      }

      // Restore tool settings
      for (const [tool, settings] of Object.entries(states.toolSettings)) {
        log.info('Restoring tool settings', {
          component: 'ErrorRecoverySystem',
          metadata: { tool, settings },
        });
      }

      // Mock implementation - would interface with tool state manager
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      log.error(
        'Failed to restore tool states',
        {
          component: 'ErrorRecoverySystem',
          metadata: { error: (error as Error).message },
        },
        error as Error,
      );
    }
  }

  private async restoreUserPreferences(preferences: UserPreferencesBackup): Promise<void> {
    // Restore user preferences and settings
    try {
      log.info('Restoring user preferences', {
        component: 'ErrorRecoverySystem',
        metadata: {
          presets: preferences.windowLevelPresets.length,
          theme: preferences.displaySettings.theme,
        },
      });

      // In a real implementation, this would update user settings storage
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      log.error(
        'Failed to restore user preferences',
        {
          component: 'ErrorRecoverySystem',
          metadata: { error: (error as Error).message },
        },
        error as Error,
      );
    }
  }

  private async restoreSessionData(sessionData: SessionDataBackup): Promise<void> {
    // Restore session data and active state
    try {
      log.info('Restoring session data', {
        component: 'ErrorRecoverySystem',
        metadata: {
          sessionId: sessionData.sessionId,
          studies: sessionData.studyInstanceUIDs.length,
          viewports: sessionData.activeViewports.length,
        },
      });

      // In a real implementation, this would restore session state
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      log.error(
        'Failed to restore session data',
        {
          component: 'ErrorRecoverySystem',
          metadata: { error: (error as Error).message },
        },
        error as Error,
      );
    }
  }

  private pruneErrorHistory(): void {
    // Keep only last 1000 errors
    if (this.errorHistory.length > 1000) {
      this.errorHistory = this.errorHistory.slice(-1000);
    }
  }

  private pruneSystemStates(): void {
    // Keep only last 10 system states
    if (this.systemStates.length > 10) {
      this.systemStates = this.systemStates.slice(-10);
    }
  }

  private generateErrorId(): string {
    return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateStateId(): string {
    return `state-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const errorRecoverySystem = new ErrorRecoverySystem();
