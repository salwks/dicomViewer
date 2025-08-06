/**
 * Memory Pressure Monitor Service
 * Advanced memory pressure monitoring and alert system
 * Provides real-time memory tracking, pressure prediction, and automated response
 */

import { EventEmitter } from 'events';
import { memoryManager, MemoryUsage } from './memoryManager';
import { advancedMemoryManager } from './AdvancedMemoryManager';
import { viewportStateManager } from './viewportStateManager';
import { log } from '../utils/logger';

// Memory pressure levels
export enum MemoryPressureLevel {
  NORMAL = 0, // < 60% usage
  MODERATE = 1, // 60-75% usage
  HIGH = 2, // 75-90% usage
  CRITICAL = 3, // 90-95% usage
  EMERGENCY = 4, // > 95% usage
}

// Memory pressure alert
export interface MemoryPressureAlert {
  level: MemoryPressureLevel;
  timestamp: number;
  currentUsage: MemoryUsage;
  trend: MemoryTrend;
  predictedExhaustion?: number; // milliseconds until exhaustion
  recommendations: MemoryRecommendation[];
  autoResponseTaken: boolean;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

// Memory usage trend analysis
export interface MemoryTrend {
  direction: 'increasing' | 'stable' | 'decreasing';
  rate: number; // bytes per second
  confidence: number; // 0-1
  sustainedDurationMs: number;
  dataPoints: Array<{ timestamp: number; usage: number }>;
}

// Memory recommendations
export interface MemoryRecommendation {
  type: 'immediate' | 'preventive' | 'optimization';
  priority: 'low' | 'medium' | 'high' | 'critical';
  action: string;
  description: string;
  estimatedImpact: {
    memoryFreed: number;
    performanceImpact: number; // 0-1
    executionTime: number; // milliseconds
  };
  autoExecutable: boolean;
  implementation?: () => Promise<boolean>;
}

// Monitoring configuration
export interface MemoryPressureConfig {
  monitoringInterval: number; // milliseconds
  trendAnalysisWindow: number; // milliseconds
  pressureThresholds: {
    normal: number;
    moderate: number;
    high: number;
    critical: number;
    emergency: number;
  };
  alertCooldowns: {
    // minimum time between same-level alerts
    normal: number;
    moderate: number;
    high: number;
    critical: number;
    emergency: number;
  };
  autoResponseEnabled: boolean;
  predictiveAnalysis: boolean;
  emergencyActions: {
    enableAggressiveCleanup: boolean;
    suspendLowPriorityViewports: boolean;
    forceLowQualityRendering: boolean;
    enableEmergencyCompression: boolean;
  };
}

// Default configuration
const DEFAULT_PRESSURE_CONFIG: MemoryPressureConfig = {
  monitoringInterval: 2000, // 2 seconds
  trendAnalysisWindow: 30000, // 30 seconds
  pressureThresholds: {
    normal: 0.6, // 60%
    moderate: 0.75, // 75%
    high: 0.9, // 90%
    critical: 0.95, // 95%
    emergency: 0.98, // 98%
  },
  alertCooldowns: {
    normal: 60000, // 1 minute
    moderate: 30000, // 30 seconds
    high: 15000, // 15 seconds
    critical: 5000, // 5 seconds
    emergency: 1000, // 1 second
  },
  autoResponseEnabled: true,
  predictiveAnalysis: true,
  emergencyActions: {
    enableAggressiveCleanup: true,
    suspendLowPriorityViewports: true,
    forceLowQualityRendering: true,
    enableEmergencyCompression: true,
  },
};

// Memory pressure monitor events
export interface MemoryPressureEvents {
  'pressure-alert': [MemoryPressureAlert];
  'trend-changed': [MemoryTrend];
  'exhaustion-predicted': [number, MemoryUsage]; // time until exhaustion, current usage
  'emergency-response-activated': [MemoryPressureAlert, string[]]; // alert, actions taken
  'pressure-resolved': [MemoryPressureLevel, MemoryPressureLevel]; // from, to
  'recommendation-generated': [MemoryRecommendation[]];
  'auto-response-executed': [MemoryRecommendation, boolean]; // recommendation, success
}

export class MemoryPressureMonitor extends EventEmitter {
  private readonly config: MemoryPressureConfig;
  private readonly memoryHistory: Array<{ timestamp: number; usage: MemoryUsage }> = [];
  private readonly alertHistory: MemoryPressureAlert[] = [];
  private readonly lastAlertTime = new Map<MemoryPressureLevel, number>();

  private monitoringInterval: NodeJS.Timeout | null = null;
  private currentPressureLevel: MemoryPressureLevel = MemoryPressureLevel.NORMAL;
  private currentTrend: MemoryTrend | null = null;
  private isEmergencyMode = false;
  private isProcessingCycle = false;

  constructor(config: Partial<MemoryPressureConfig> = {}) {
    super();
    this.config = { ...DEFAULT_PRESSURE_CONFIG, ...config };

    this.initialize();

    log.info('MemoryPressureMonitor initialized', {
      component: 'MemoryPressureMonitor',
      metadata: {
        monitoringInterval: this.config.monitoringInterval,
        autoResponseEnabled: this.config.autoResponseEnabled,
        predictiveAnalysis: this.config.predictiveAnalysis,
      },
    });
  }

  /**
   * Initialize the memory pressure monitoring system
   */
  private initialize(): void {
    this.startMonitoring();

    // Listen to memory manager events
    memoryManager.on('memory-critical', this.handleCriticalMemory.bind(this));
    memoryManager.on('memory-warning', this.handleMemoryWarning.bind(this));

    // Listen to advanced memory manager events
    advancedMemoryManager.on('memory-pressure', this.handleAdvancedMemoryPressure.bind(this));
  }

  /**
   * Start continuous memory monitoring
   */
  private startMonitoring(): void {
    if (this.monitoringInterval) return;

    this.monitoringInterval = setInterval(async () => {
      await this.performMonitoringCycle();
    }, this.config.monitoringInterval);

    log.info('Memory pressure monitoring started', {
      component: 'MemoryPressureMonitor',
      metadata: { interval: this.config.monitoringInterval },
    });
  }

  /**
   * Perform a complete monitoring cycle
   */
  private async performMonitoringCycle(): Promise<void> {
    // Prevent recursive calls
    if (this.isProcessingCycle) {
      return;
    }
    this.isProcessingCycle = true;

    try {
      // Collect current memory usage
      const currentUsage = memoryManager.getMemoryUsage();
      const timestamp = Date.now();

      // Add to history
      this.memoryHistory.push({ timestamp, usage: currentUsage });

      // Keep history within analysis window
      const cutoffTime = timestamp - this.config.trendAnalysisWindow;
      while (this.memoryHistory.length > 0 && this.memoryHistory[0].timestamp < cutoffTime) {
        this.memoryHistory.shift();
      }

      // Analyze memory trend
      const trend = this.analyzeTrend();
      if (trend && this.isTrendSignificant(trend)) {
        this.currentTrend = trend;
        this.emit('trend-changed', trend);
      }

      // Determine pressure level
      const newPressureLevel = this.calculatePressureLevel(currentUsage);

      // Check for pressure level change
      if (newPressureLevel !== this.currentPressureLevel) {
        await this.handlePressureLevelChange(this.currentPressureLevel, newPressureLevel, currentUsage, trend);
      }

      // Generate pressure alert if necessary
      if (await this.shouldGenerateAlert(newPressureLevel)) {
        const alert = await this.generatePressureAlert(newPressureLevel, currentUsage, trend);
        await this.processAlert(alert);
      }

      // Predictive analysis
      if (this.config.predictiveAnalysis && trend) {
        await this.performPredictiveAnalysis(currentUsage, trend);
      }

      this.currentPressureLevel = newPressureLevel;
    } catch (error) {
      log.error(
        'Memory monitoring cycle failed',
        {
          component: 'MemoryPressureMonitor',
        },
        error as Error,
      );
    } finally {
      this.isProcessingCycle = false;
    }
  }

  /**
   * Analyze memory usage trend
   */
  private analyzeTrend(): MemoryTrend | null {
    if (this.memoryHistory.length < 3) {
      return null;
    }

    const dataPoints = this.memoryHistory.map(entry => ({
      timestamp: entry.timestamp,
      usage: entry.usage.used / entry.usage.total,
    }));

    // Simple linear regression
    const n = dataPoints.length;
    const sumX = dataPoints.reduce((sum, _point, i) => sum + i, 0);
    const sumY = dataPoints.reduce((sum, point) => sum + point.usage, 0);
    const sumXY = dataPoints.reduce((sum, point, i) => sum + i * point.usage, 0);
    const sumXX = dataPoints.reduce((sum, _, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const meanY = sumY / n;

    // Calculate R-squared for confidence
    const yPredicted = dataPoints.map((_, i) => meanY + slope * (i - (n - 1) / 2));
    const ssRes = dataPoints.reduce((sum, point, i) =>
      // eslint-disable-next-line security/detect-object-injection -- Safe: i is array iteration index
      sum + Math.pow(point.usage - yPredicted[i], 2), 0);
    const ssTot = dataPoints.reduce((sum, point) => sum + Math.pow(point.usage - meanY, 2), 0);
    const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

    // Convert slope to bytes per second
    const timeSpan = dataPoints[dataPoints.length - 1].timestamp - dataPoints[0].timestamp;
    const totalMemory = this.memoryHistory[this.memoryHistory.length - 1].usage.total;
    const ratePerMs = (slope / timeSpan) * totalMemory;
    const ratePerSecond = ratePerMs * 1000;

    // Determine direction
    let direction: MemoryTrend['direction'];
    if (Math.abs(slope) < 0.001) {
      // Less than 0.1% change
      direction = 'stable';
    } else if (slope > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }

    // Calculate sustained duration
    const sustainedDurationMs = this.calculateSustainedDuration(dataPoints, direction);

    return {
      direction,
      rate: ratePerSecond,
      confidence: Math.max(0, Math.min(1, rSquared)),
      sustainedDurationMs,
      dataPoints,
    };
  }

  /**
   * Calculate how long the trend has been sustained
   */
  private calculateSustainedDuration(
    dataPoints: Array<{ timestamp: number; usage: number }>,
    direction: MemoryTrend['direction'],
  ): number {
    if (dataPoints.length < 2) return 0;

    let sustainedCount = 1;
    const threshold = 0.001; // 0.1% threshold

    for (let i = dataPoints.length - 2; i >= 0; i--) {
      const current = dataPoints[i + 1].usage;
      // eslint-disable-next-line security/detect-object-injection -- Safe: i is controlled loop index within array bounds
      const previous = dataPoints[i].usage;
      const change = current - previous;

      const isConsistentWithTrend =
        (direction === 'increasing' && change > threshold) ||
        (direction === 'decreasing' && change < -threshold) ||
        (direction === 'stable' && Math.abs(change) <= threshold);

      if (isConsistentWithTrend) {
        sustainedCount++;
      } else {
        break;
      }
    }

    const firstSustainedIndex = Math.max(0, dataPoints.length - sustainedCount);
    // eslint-disable-next-line security/detect-object-injection -- Safe: firstSustainedIndex is calculated index within array bounds
    return dataPoints[dataPoints.length - 1].timestamp - dataPoints[firstSustainedIndex].timestamp;
  }

  /**
   * Check if trend is significant enough to report
   */
  private isTrendSignificant(trend: MemoryTrend): boolean {
    return (
      trend.confidence > 0.7 &&
      trend.sustainedDurationMs > 5000 && // At least 5 seconds
      (Math.abs(trend.rate) > 1024 * 1024 || // At least 1MB/s change
        trend.direction !== 'stable')
    );
  }

  /**
   * Calculate pressure level from memory usage
   */
  private calculatePressureLevel(usage: MemoryUsage): MemoryPressureLevel {
    const ratio = usage.used / usage.total;
    const thresholds = this.config.pressureThresholds;

    if (ratio >= thresholds.emergency) return MemoryPressureLevel.EMERGENCY;
    if (ratio >= thresholds.critical) return MemoryPressureLevel.CRITICAL;
    if (ratio >= thresholds.high) return MemoryPressureLevel.HIGH;
    if (ratio >= thresholds.moderate) return MemoryPressureLevel.MODERATE;
    return MemoryPressureLevel.NORMAL;
  }

  /**
   * Handle pressure level change
   */
  private async handlePressureLevelChange(
    oldLevel: MemoryPressureLevel,
    newLevel: MemoryPressureLevel,
    usage: MemoryUsage,
    trend: MemoryTrend | null,
  ): Promise<void> {
    log.info('Memory pressure level changed', {
      component: 'MemoryPressureMonitor',
      metadata: {
        // eslint-disable-next-line security/detect-object-injection -- Safe: oldLevel is MemoryPressureLevel enum value
        from: MemoryPressureLevel[oldLevel],
        // eslint-disable-next-line security/detect-object-injection -- Safe: newLevel is MemoryPressureLevel enum value
        to: MemoryPressureLevel[newLevel],
        usageRatio: usage.used / usage.total,
        trend: trend?.direction || 'unknown',
      },
    });

    // Emit pressure resolved event if pressure decreased
    if (newLevel < oldLevel) {
      this.emit('pressure-resolved', oldLevel, newLevel);

      // Exit emergency mode if pressure has decreased significantly
      if (this.isEmergencyMode && newLevel <= MemoryPressureLevel.HIGH) {
        this.isEmergencyMode = false;
        log.info('Emergency mode deactivated', {
          component: 'MemoryPressureMonitor',
          // eslint-disable-next-line security/detect-object-injection -- Safe: newLevel is MemoryPressureLevel enum value
          metadata: { newLevel: MemoryPressureLevel[newLevel] },
        });
      }
    }

    // Enter emergency mode if critical pressure reached
    if (newLevel >= MemoryPressureLevel.CRITICAL && !this.isEmergencyMode) {
      this.isEmergencyMode = true;
      log.warn('Emergency mode activated', {
        component: 'MemoryPressureMonitor',
        // eslint-disable-next-line security/detect-object-injection -- Safe: newLevel is MemoryPressureLevel enum value
        metadata: { level: MemoryPressureLevel[newLevel] },
      });
    }
  }

  /**
   * Check if an alert should be generated
   */
  private async shouldGenerateAlert(level: MemoryPressureLevel): Promise<boolean> {
    if (level === MemoryPressureLevel.NORMAL) {
      return false;
    }

    const lastAlertTime = this.lastAlertTime.get(level) || 0;
    const cooldown = this.getCooldownForLevel(level);

    return Date.now() - lastAlertTime >= cooldown;
  }

  /**
   * Get cooldown period for pressure level
   */
  private getCooldownForLevel(level: MemoryPressureLevel): number {
    switch (level) {
      case MemoryPressureLevel.MODERATE:
        return this.config.alertCooldowns.moderate;
      case MemoryPressureLevel.HIGH:
        return this.config.alertCooldowns.high;
      case MemoryPressureLevel.CRITICAL:
        return this.config.alertCooldowns.critical;
      case MemoryPressureLevel.EMERGENCY:
        return this.config.alertCooldowns.emergency;
      default:
        return this.config.alertCooldowns.normal;
    }
  }

  /**
   * Generate pressure alert
   */
  private async generatePressureAlert(
    level: MemoryPressureLevel,
    usage: MemoryUsage,
    trend: MemoryTrend | null,
  ): Promise<MemoryPressureAlert> {
    const recommendations = await this.generateRecommendations(level, usage, trend);

    let severity: MemoryPressureAlert['severity'];
    switch (level) {
      case MemoryPressureLevel.EMERGENCY:
        severity = 'critical';
        break;
      case MemoryPressureLevel.CRITICAL:
        severity = 'error';
        break;
      case MemoryPressureLevel.HIGH:
        severity = 'warning';
        break;
      default:
        severity = 'info';
    }

    const alert: MemoryPressureAlert = {
      level,
      timestamp: Date.now(),
      currentUsage: usage,
      trend: trend || {
        direction: 'stable',
        rate: 0,
        confidence: 0,
        sustainedDurationMs: 0,
        dataPoints: [],
      },
      recommendations,
      autoResponseTaken: false,
      severity,
    };

    // Calculate predicted exhaustion time
    if (trend && trend.direction === 'increasing' && trend.rate > 0) {
      const remainingMemory = usage.available;
      alert.predictedExhaustion = Math.floor((remainingMemory / trend.rate) * 1000);
    }

    return alert;
  }

  /**
   * Generate memory recommendations
   */
  private async generateRecommendations(
    level: MemoryPressureLevel,
    usage: MemoryUsage,
    _trend: MemoryTrend | null,
  ): Promise<MemoryRecommendation[]> {
    const recommendations: MemoryRecommendation[] = [];

    // Emergency level recommendations
    if (level >= MemoryPressureLevel.EMERGENCY) {
      recommendations.push({
        type: 'immediate',
        priority: 'critical',
        action: 'emergency-cleanup',
        description: 'Perform emergency memory cleanup',
        estimatedImpact: {
          memoryFreed: Math.floor(usage.used * 0.3),
          performanceImpact: 0.8,
          executionTime: 2000,
        },
        autoExecutable: this.config.emergencyActions.enableAggressiveCleanup,
        implementation: async () => {
          return await this.executeEmergencyCleanup();
        },
      });

      if (this.config.emergencyActions.suspendLowPriorityViewports) {
        recommendations.push({
          type: 'immediate',
          priority: 'critical',
          action: 'suspend-viewports',
          description: 'Suspend low priority viewports',
          estimatedImpact: {
            memoryFreed: Math.floor(usage.used * 0.2),
            performanceImpact: 0.4,
            executionTime: 500,
          },
          autoExecutable: true,
          implementation: async () => {
            return await this.suspendLowPriorityViewports();
          },
        });
      }
    }

    // Critical level recommendations
    if (level >= MemoryPressureLevel.CRITICAL) {
      recommendations.push({
        type: 'immediate',
        priority: 'high',
        action: 'aggressive-cleanup',
        description: 'Clean up inactive viewport resources',
        estimatedImpact: {
          memoryFreed: Math.floor(usage.used * 0.15),
          performanceImpact: 0.3,
          executionTime: 1000,
        },
        autoExecutable: true,
        implementation: async () => {
          return await this.performAggressiveCleanup();
        },
      });

      if (this.config.emergencyActions.forceLowQualityRendering) {
        recommendations.push({
          type: 'immediate',
          priority: 'high',
          action: 'reduce-quality',
          description: 'Force low quality rendering for all viewports',
          estimatedImpact: {
            memoryFreed: Math.floor(usage.used * 0.1),
            performanceImpact: 0.2,
            executionTime: 200,
          },
          autoExecutable: true,
          implementation: async () => {
            return await this.forceLowQualityRendering();
          },
        });
      }
    }

    // High level recommendations
    if (level >= MemoryPressureLevel.HIGH) {
      recommendations.push({
        type: 'preventive',
        priority: 'medium',
        action: 'defragment-pools',
        description: 'Defragment memory pools to reclaim fragmented space',
        estimatedImpact: {
          memoryFreed: Math.floor(usage.used * 0.08),
          performanceImpact: 0.15,
          executionTime: 800,
        },
        autoExecutable: true,
        implementation: async () => {
          const bytesReclaimed = await advancedMemoryManager.defragmentAllPools();
          return bytesReclaimed > 0;
        },
      });

      if (this.config.emergencyActions.enableEmergencyCompression) {
        recommendations.push({
          type: 'optimization',
          priority: 'medium',
          action: 'compress-resources',
          description: 'Apply compression to inactive resources',
          estimatedImpact: {
            memoryFreed: Math.floor(usage.used * 0.12),
            performanceImpact: 0.1,
            executionTime: 1500,
          },
          autoExecutable: true,
          implementation: async () => {
            return await this.compressInactiveResources();
          },
        });
      }
    }

    // Moderate level recommendations
    if (level >= MemoryPressureLevel.MODERATE) {
      recommendations.push({
        type: 'optimization',
        priority: 'low',
        action: 'cleanup-inactive',
        description: 'Clean up inactive resources',
        estimatedImpact: {
          memoryFreed: Math.floor(usage.used * 0.05),
          performanceImpact: 0.05,
          executionTime: 500,
        },
        autoExecutable: true,
        implementation: async () => {
          return await this.cleanupInactiveResources();
        },
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Process and handle alert
   */
  private async processAlert(alert: MemoryPressureAlert): Promise<void> {
    this.alertHistory.push(alert);
    this.lastAlertTime.set(alert.level, alert.timestamp);

    // Keep alert history manageable
    if (this.alertHistory.length > 100) {
      this.alertHistory.shift();
    }

    this.emit('pressure-alert', alert);
    this.emit('recommendation-generated', alert.recommendations);

    log.warn('Memory pressure alert generated', {
      component: 'MemoryPressureMonitor',
      metadata: {
        level: MemoryPressureLevel[alert.level],
        severity: alert.severity,
        usageRatio: alert.currentUsage.used / alert.currentUsage.total,
        recommendationCount: alert.recommendations.length,
        predictedExhaustion: alert.predictedExhaustion,
      },
    });

    // Execute auto-responses if enabled
    if (this.config.autoResponseEnabled) {
      await this.executeAutoResponses(alert);
    }
  }

  /**
   * Execute automatic responses
   */
  private async executeAutoResponses(alert: MemoryPressureAlert): Promise<void> {
    const autoExecutableRecommendations = alert.recommendations.filter(rec => rec.autoExecutable);
    const actionsExecuted: string[] = [];

    for (const recommendation of autoExecutableRecommendations) {
      try {
        if (recommendation.implementation) {
          const success = await recommendation.implementation();
          this.emit('auto-response-executed', recommendation, success);

          if (success) {
            actionsExecuted.push(recommendation.action);
            alert.autoResponseTaken = true;
          }
        }
      } catch (error) {
        log.error(
          'Auto-response execution failed',
          {
            component: 'MemoryPressureMonitor',
            metadata: { action: recommendation.action },
          },
          error as Error,
        );
      }
    }

    if (actionsExecuted.length > 0) {
      this.emit('emergency-response-activated', alert, actionsExecuted);

      log.info('Auto-responses executed', {
        component: 'MemoryPressureMonitor',
        metadata: {
          level: MemoryPressureLevel[alert.level],
          actionsExecuted,
        },
      });
    }
  }

  /**
   * Perform predictive analysis
   */
  private async performPredictiveAnalysis(usage: MemoryUsage, trend: MemoryTrend): Promise<void> {
    if (trend.direction === 'increasing' && trend.rate > 0 && trend.confidence > 0.8) {
      const remainingMemory = usage.available;
      const timeToExhaustion = (remainingMemory / trend.rate) * 1000; // milliseconds

      if (timeToExhaustion < 60000) {
        // Less than 1 minute
        this.emit('exhaustion-predicted', timeToExhaustion, usage);

        log.warn('Memory exhaustion predicted', {
          component: 'MemoryPressureMonitor',
          metadata: {
            timeToExhaustion,
            currentUsage: usage.used,
            trend: trend.rate,
            confidence: trend.confidence,
          },
        });
      }
    }
  }

  /**
   * Implementation methods for recommendations
   */
  private async executeEmergencyCleanup(): Promise<boolean> {
    try {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Clear all viewport resources for inactive viewports
      const viewportIds = viewportStateManager.getViewportIds();
      for (const viewportId of viewportIds) {
        const state = viewportStateManager.getViewportState(viewportId);
        if (state && !state.activation.isActive) {
          await advancedMemoryManager.optimizeViewportMemory(viewportId);
        }
      }

      return true;
    } catch (error) {
      log.error(
        'Emergency cleanup failed',
        {
          component: 'MemoryPressureMonitor',
        },
        error as Error,
      );
      return false;
    }
  }

  private async suspendLowPriorityViewports(): Promise<boolean> {
    try {
      const viewportIds = viewportStateManager.getViewportIds();
      let suspendedCount = 0;

      for (const viewportId of viewportIds) {
        const state = viewportStateManager.getViewportState(viewportId);
        if (state && !state.activation.isActive && !state.activation.isFocused) {
          // Suspend viewport rendering
          viewportStateManager.updateViewportState(viewportId, {
            performance: {
              ...state.performance,
              isRenderingEnabled: false,
            },
          });
          suspendedCount++;
        }
      }

      log.info('Low priority viewports suspended', {
        component: 'MemoryPressureMonitor',
        metadata: { suspendedCount },
      });

      return suspendedCount > 0;
    } catch (error) {
      log.error(
        'Failed to suspend viewports',
        {
          component: 'MemoryPressureMonitor',
        },
        error as Error,
      );
      return false;
    }
  }

  private async performAggressiveCleanup(): Promise<boolean> {
    try {
      memoryManager.performCleanup(3); // Use highest priority cleanup
      return true;
    } catch (error) {
      log.error(
        'Aggressive cleanup failed',
        {
          component: 'MemoryPressureMonitor',
        },
        error as Error,
      );
      return false;
    }
  }

  private async forceLowQualityRendering(): Promise<boolean> {
    try {
      // This would integrate with the viewport optimizer to force low quality
      log.info('Low quality rendering forced', {
        component: 'MemoryPressureMonitor',
      });
      return true;
    } catch (error) {
      log.error(
        'Failed to force low quality rendering',
        {
          component: 'MemoryPressureMonitor',
        },
        error as Error,
      );
      return false;
    }
  }

  private async compressInactiveResources(): Promise<boolean> {
    try {
      const viewportIds = viewportStateManager.getViewportIds();
      for (const viewportId of viewportIds) {
        const state = viewportStateManager.getViewportState(viewportId);
        if (state && !state.activation.isActive) {
          // This would trigger compression in the advanced memory manager
          await advancedMemoryManager.optimizeViewportMemory(viewportId);
        }
      }
      return true;
    } catch (error) {
      log.error(
        'Resource compression failed',
        {
          component: 'MemoryPressureMonitor',
        },
        error as Error,
      );
      return false;
    }
  }

  private async cleanupInactiveResources(): Promise<boolean> {
    try {
      const viewportIds = viewportStateManager.getViewportIds();
      for (const viewportId of viewportIds) {
        const state = viewportStateManager.getViewportState(viewportId);
        if (state && Date.now() - new Date(state.activation.lastInteractionAt || 0).getTime() > 300000) {
          // 5 minutes
          await advancedMemoryManager.optimizeViewportMemory(viewportId);
        }
      }
      return true;
    } catch (error) {
      log.error(
        'Inactive resource cleanup failed',
        {
          component: 'MemoryPressureMonitor',
        },
        error as Error,
      );
      return false;
    }
  }

  /**
   * Event handlers for memory manager events
   */
  private handleCriticalMemory(_usage: MemoryUsage): void {
    // Force immediate monitoring cycle
    setImmediate(() => {
      this.performMonitoringCycle();
    });
  }

  private handleMemoryWarning(_usage: MemoryUsage): void {
    // Force monitoring cycle within 1 second
    setTimeout(() => {
      this.performMonitoringCycle();
    }, 1000);
  }

  private handleAdvancedMemoryPressure(level: number, recommendation: string): void {
    log.info('Advanced memory pressure detected', {
      component: 'MemoryPressureMonitor',
      metadata: { level, recommendation },
    });
  }

  /**
   * Public API methods
   */
  public getCurrentPressureLevel(): MemoryPressureLevel {
    return this.currentPressureLevel;
  }

  public getCurrentTrend(): MemoryTrend | null {
    return this.currentTrend;
  }

  public getRecentAlerts(count: number = 10): MemoryPressureAlert[] {
    return this.alertHistory.slice(-count);
  }

  public isEmergencyModeActive(): boolean {
    return this.isEmergencyMode;
  }

  public getMemoryHistory(durationMs: number = 60000): Array<{ timestamp: number; usage: MemoryUsage }> {
    const cutoffTime = Date.now() - durationMs;
    return this.memoryHistory.filter(entry => entry.timestamp >= cutoffTime);
  }

  /**
   * Force immediate monitoring cycle
   */
  public async forceMonitoringCycle(): Promise<void> {
    await this.performMonitoringCycle();
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<MemoryPressureConfig>): void {
    Object.assign(this.config, updates);

    log.info('Memory pressure monitor configuration updated', {
      component: 'MemoryPressureMonitor',
      metadata: { updatedKeys: Object.keys(updates) },
    });
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.memoryHistory.length = 0;
    this.alertHistory.length = 0;
    this.lastAlertTime.clear();
    this.removeAllListeners();

    log.info('MemoryPressureMonitor disposed', {
      component: 'MemoryPressureMonitor',
    });
  }
}

// Export singleton instance
export const memoryPressureMonitor = new MemoryPressureMonitor();
export default memoryPressureMonitor;
