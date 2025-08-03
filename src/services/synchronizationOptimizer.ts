/**
 * Synchronization Optimizer Service
 * Advanced synchronization operations optimization for viewport performance
 * Task 30.4: Implement Synchronization Operations Optimization
 */

import { EventEmitter } from 'events';
import { ViewportState } from '../types/viewportState';
import { log } from '../utils/logger';

export interface SyncOperation {
  id: string;
  type: 'pan' | 'zoom' | 'window-level' | 'scroll' | 'crosshair' | 'orientation';
  sourceViewportId: string;
  targetViewportIds: string[];
  priority: number;
  timestamp: number;
  data: {
    x?: number;
    y?: number;
    z?: number;
    zoom?: number;
    pan?: { x: number; y: number };
    windowWidth?: number;
    windowCenter?: number;
    imageIndex?: number;
    crosshairPosition?: { x: number; y: number; z: number };
    orientation?: {
      rowCosines: [number, number, number];
      columnCosines: [number, number, number];
    };
  };
  constraints?: {
    maxDelay: number;
    requireExactMatch: boolean;
    allowPartialSync: boolean;
    priority: number;
  };
}

export interface SyncTask {
  id: string;
  operation: SyncOperation;
  targetViewportId: string;
  scheduledTime: number;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  estimatedDuration: number;
  dependencies: string[];
}

export interface SyncGroup {
  id: string;
  name: string;
  viewportIds: string[];
  syncTypes: SyncOperation['type'][];
  priority: number;
  isActive: boolean;
  constraints: {
    maxLatency: number;
    tolerateFailures: boolean;
    requireConsensus: boolean;
    batchOperations: boolean;
  };
  performance: {
    averageLatency: number;
    successRate: number;
    operationsPerSecond: number;
    lastSyncTime: number;
  };
}

export interface SyncOptimizerConfig {
  maxConcurrentOperations: number;
  operationTimeoutMs: number;
  retryAttempts: number;
  batchingEnabled: boolean;
  batchDelayMs: number;
  throttlingEnabled: boolean;
  throttleThresholdMs: number;
  priorityQueueEnabled: boolean;
  performanceTracking: boolean;
  optimizationStrategies: OptimizationStrategy[];
}

export enum OptimizationStrategy {
  BATCHING = 'batching',
  THROTTLING = 'throttling',
  PRIORITY_QUEUING = 'priority-queuing',
  PREDICTIVE_SYNC = 'predictive-sync',
  ADAPTIVE_DELAY = 'adaptive-delay',
  SELECTIVE_SYNC = 'selective-sync',
}

export interface SyncPerformanceMetrics {
  totalOperations: number;
  completedOperations: number;
  failedOperations: number;
  averageLatency: number;
  peakLatency: number;
  throughput: number; // operations per second
  queueLength: number;
  activeGroups: number;
  throttledOperations: number;
  batchedOperations: number;
}

export const DEFAULT_SYNC_OPTIMIZER_CONFIG: SyncOptimizerConfig = {
  maxConcurrentOperations: 8,
  operationTimeoutMs: 100,
  retryAttempts: 2,
  batchingEnabled: true,
  batchDelayMs: 16, // ~60fps
  throttlingEnabled: true,
  throttleThresholdMs: 33, // ~30fps minimum
  priorityQueueEnabled: true,
  performanceTracking: true,
  optimizationStrategies: [
    OptimizationStrategy.BATCHING,
    OptimizationStrategy.THROTTLING,
    OptimizationStrategy.PRIORITY_QUEUING,
  ],
};

export class SynchronizationOptimizer extends EventEmitter {
  private config: SyncOptimizerConfig;
  private syncGroups = new Map<string, SyncGroup>();
  private operationQueue = new Map<number, SyncOperation[]>(); // priority -> operations
  private activeTasks = new Map<string, SyncTask>();
  private batchTimer: NodeJS.Timeout | null = null;
  private performanceTimer: NodeJS.Timeout | null = null;

  // Performance tracking
  private metrics: SyncPerformanceMetrics = {
    totalOperations: 0,
    completedOperations: 0,
    failedOperations: 0,
    averageLatency: 0,
    peakLatency: 0,
    throughput: 0,
    queueLength: 0,
    activeGroups: 0,
    throttledOperations: 0,
    batchedOperations: 0,
  };

  // Optimization state
  private lastOperationTime = 0;
  private operationHistory: number[] = [];
  private throttleState = {
    isThrottling: false,
    lastThrottleTime: 0,
    consecutiveOperations: 0,
  };

  // Batching state
  private pendingBatches = new Map<string, SyncOperation[]>();

  constructor(config: Partial<SyncOptimizerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_SYNC_OPTIMIZER_CONFIG, ...config };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    log.info('SynchronizationOptimizer initializing', {
      component: 'SynchronizationOptimizer',
      metadata: {
        maxConcurrentOperations: this.config.maxConcurrentOperations,
        batchingEnabled: this.config.batchingEnabled,
        optimizationStrategies: this.config.optimizationStrategies,
      },
    });

    // Initialize priority queues
    for (let priority = 0; priority <= 10; priority++) {
      this.operationQueue.set(priority, []);
    }

    // Start performance monitoring
    if (this.config.performanceTracking) {
      this.startPerformanceMonitoring();
    }

    // Start operation processing
    this.startOperationProcessing();
  }

  // ===== Public API =====

  /**
   * Create a synchronization group
   */
  public createSyncGroup(
    name: string,
    viewportIds: string[],
    syncTypes: SyncOperation['type'][],
    options: {
      priority?: number;
      maxLatency?: number;
      tolerateFailures?: boolean;
      requireConsensus?: boolean;
      batchOperations?: boolean;
    } = {},
  ): string {
    const groupId = this.generateGroupId();

    const syncGroup: SyncGroup = {
      id: groupId,
      name,
      viewportIds: [...viewportIds],
      syncTypes: [...syncTypes],
      priority: options.priority || 5,
      isActive: true,
      constraints: {
        maxLatency: options.maxLatency || 50, // 50ms default
        tolerateFailures: options.tolerateFailures || true,
        requireConsensus: options.requireConsensus || false,
        batchOperations: options.batchOperations || this.config.batchingEnabled,
      },
      performance: {
        averageLatency: 0,
        successRate: 1.0,
        operationsPerSecond: 0,
        lastSyncTime: 0,
      },
    };

    this.syncGroups.set(groupId, syncGroup);
    this.metrics.activeGroups = this.syncGroups.size;

    log.info('Sync group created', {
      component: 'SynchronizationOptimizer',
      metadata: { groupId, name, viewportCount: viewportIds.length, syncTypes },
    });

    return groupId;
  }

  /**
   * Queue synchronization operation
   */
  public queueSyncOperation(operation: Omit<SyncOperation, 'id' | 'timestamp'>): string {
    const syncOperation: SyncOperation = {
      ...operation,
      id: this.generateOperationId(),
      timestamp: Date.now(),
    };

    // Apply optimization strategies before queuing
    if (this.shouldOptimizeOperation(syncOperation)) {
      this.applyOptimizationStrategies(syncOperation);
    }

    // Add to appropriate priority queue
    const priority = Math.min(10, Math.max(0, syncOperation.priority));
    const queue = this.operationQueue.get(priority)!;
    queue.push(syncOperation);

    this.metrics.totalOperations++;
    this.metrics.queueLength = this.getTotalQueueLength();

    this.emit('operation-queued', syncOperation);

    log.info('Sync operation queued', {
      component: 'SynchronizationOptimizer',
      metadata: {
        operationId: syncOperation.id,
        type: syncOperation.type,
        priority,
        targetCount: syncOperation.targetViewportIds.length,
      },
    });

    return syncOperation.id;
  }

  /**
   * Synchronize viewports immediately
   */
  public async synchronizeViewports(
    sourceViewportId: string,
    targetViewportIds: string[],
    syncTypes: SyncOperation['type'][],
    data: SyncOperation['data'],
  ): Promise<boolean> {
    const operations = syncTypes.map(type => ({
      type,
      sourceViewportId,
      targetViewportIds,
      priority: 10, // High priority for immediate sync
      data,
    }));

    const operationIds = operations.map(op => this.queueSyncOperation(op));

    // Wait for all operations to complete
    const promises = operationIds.map(id => this.waitForOperation(id));
    const results = await Promise.allSettled(promises);

    return results.every(result => result.status === 'fulfilled');
  }

  /**
   * Get synchronization performance metrics
   */
  public getPerformanceMetrics(): SyncPerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Optimize synchronization for viewport states
   */
  public optimizeForViewports(viewportStates: ViewportState[]): void {
    try {
      // Update sync groups based on active viewports
      this.updateSyncGroupsForViewports(viewportStates);

      // Apply performance optimizations
      this.applyPerformanceOptimizations();

      // Adjust configuration based on performance
      this.adaptConfiguration();

      log.info('Synchronization optimized for viewports', {
        component: 'SynchronizationOptimizer',
        metadata: {
          viewportCount: viewportStates.length,
          activeGroups: this.metrics.activeGroups,
          queueLength: this.metrics.queueLength,
        },
      });

    } catch (error) {
      log.error('Failed to optimize synchronization', {
        component: 'SynchronizationOptimizer',
      }, error as Error);
    }
  }

  // ===== Private Implementation =====

  private shouldOptimizeOperation(operation: SyncOperation): boolean {
    // Check if operation should be batched, throttled, or optimized
    const timeSinceLastOp = Date.now() - this.lastOperationTime;

    // Apply throttling check
    if (this.config.throttlingEnabled && timeSinceLastOp < this.config.throttleThresholdMs) {
      return true;
    }

    // Check for duplicate operations
    const recentOperations = this.getRecentOperations(100); // Last 100ms
    const duplicates = recentOperations.filter(op =>
      op.type === operation.type &&
      op.sourceViewportId === operation.sourceViewportId,
    );

    return duplicates.length > 2; // Optimize if many duplicates
  }

  private applyOptimizationStrategies(operation: SyncOperation): void {
    for (const strategy of this.config.optimizationStrategies) {
      switch (strategy) {
        case OptimizationStrategy.BATCHING:
          this.applyBatchingStrategy(operation);
          break;

        case OptimizationStrategy.THROTTLING:
          this.applyThrottlingStrategy(operation);
          break;

        case OptimizationStrategy.PRIORITY_QUEUING:
          this.applyPriorityStrategy(operation);
          break;

        case OptimizationStrategy.SELECTIVE_SYNC:
          this.applySelectiveStrategy(operation);
          break;
      }
    }
  }

  private applyBatchingStrategy(operation: SyncOperation): void {
    if (!this.config.batchingEnabled) return;

    const batchKey = `${operation.type}-${operation.sourceViewportId}`;

    if (!this.pendingBatches.has(batchKey)) {
      this.pendingBatches.set(batchKey, []);
    }

    const batch = this.pendingBatches.get(batchKey)!;
    batch.push(operation);

    // Schedule batch processing
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatches();
      }, this.config.batchDelayMs);
    }

    this.metrics.batchedOperations++;
    this.emit('optimization-applied', OptimizationStrategy.BATCHING, 1);
  }

  private applyThrottlingStrategy(operation: SyncOperation): void {
    if (!this.config.throttlingEnabled) return;

    const now = Date.now();
    const timeSinceLastOp = now - this.lastOperationTime;

    if (timeSinceLastOp < this.config.throttleThresholdMs) {
      this.throttleState.consecutiveOperations++;

      if (this.throttleState.consecutiveOperations > 5) {
        // Apply progressive throttling
        const delay = Math.min(100, this.throttleState.consecutiveOperations * 5);
        operation.constraints = {
          ...operation.constraints,
          maxDelay: delay,
          requireExactMatch: operation.constraints?.requireExactMatch ?? false,
          allowPartialSync: operation.constraints?.allowPartialSync ?? true,
          priority: Math.max(0, operation.priority - 1),
        };

        this.metrics.throttledOperations++;
        this.emit('throttling-applied', 'consecutive-operations', delay);
        this.emit('optimization-applied', OptimizationStrategy.THROTTLING, delay);
      }
    } else {
      this.throttleState.consecutiveOperations = 0;
    }
  }

  private applyPriorityStrategy(operation: SyncOperation): void {
    // Boost priority for critical operations
    if (operation.type === 'crosshair' || operation.type === 'window-level') {
      operation.priority = Math.min(10, operation.priority + 2);
    }

    // Reduce priority for redundant operations
    const recentSimilar = this.getRecentOperations(50).filter(op =>
      op.type === operation.type && op.sourceViewportId === operation.sourceViewportId,
    );

    if (recentSimilar.length > 3) {
      operation.priority = Math.max(0, operation.priority - 1);
    }

    this.emit('optimization-applied', OptimizationStrategy.PRIORITY_QUEUING, 1);
  }

  private applySelectiveStrategy(operation: SyncOperation): void {
    // Filter target viewports based on visibility and activity
    const activeTargets = operation.targetViewportIds.filter(_viewportId => {
      // In a real implementation, this would check viewport visibility/activity
      return true; // Simplified for now
    });

    if (activeTargets.length !== operation.targetViewportIds.length) {
      operation.targetViewportIds = activeTargets;
      this.emit('optimization-applied', OptimizationStrategy.SELECTIVE_SYNC,
        operation.targetViewportIds.length - activeTargets.length);
    }
  }

  private processBatches(): void {
    this.batchTimer = null;
    const startTime = Date.now();

    for (const [_batchKey, operations] of this.pendingBatches) {
      if (operations.length === 0) continue;

      // Merge operations of the same type
      const mergedOperation = this.mergeOperations(operations);
      if (mergedOperation) {
        this.processOperationImmediate(mergedOperation);
      }

      this.emit('batch-processed', operations, Date.now() - startTime);
    }

    this.pendingBatches.clear();
  }

  private mergeOperations(operations: SyncOperation[]): SyncOperation | null {
    if (operations.length === 0) return null;
    if (operations.length === 1) return operations[0];

    // Take the most recent operation as base
    const latest = operations[operations.length - 1];
    const merged: SyncOperation = {
      ...latest,
      id: this.generateOperationId(),
      timestamp: Date.now(),
    };

    // Merge target viewports
    const allTargets = new Set<string>();
    operations.forEach(op => {
      op.targetViewportIds.forEach(id => allTargets.add(id));
    });
    merged.targetViewportIds = Array.from(allTargets);

    // Use highest priority
    merged.priority = Math.max(...operations.map(op => op.priority));

    return merged;
  }

  private async processOperationImmediate(operation: SyncOperation): Promise<void> {
    for (const targetViewportId of operation.targetViewportIds) {
      const task: SyncTask = {
        id: this.generateTaskId(),
        operation,
        targetViewportId,
        scheduledTime: Date.now(),
        attempts: 0,
        maxAttempts: this.config.retryAttempts,
        estimatedDuration: this.estimateOperationDuration(operation),
        dependencies: [],
      };

      this.activeTasks.set(task.id, task);
      await this.executeTask(task);
    }
  }

  private startOperationProcessing(): void {
    const processNext = async () => {
      try {
        if (this.activeTasks.size < this.config.maxConcurrentOperations) {
          const nextOperation = this.getNextOperation();
          if (nextOperation) {
            await this.processOperationImmediate(nextOperation);
          }
        }
      } catch (error) {
        log.error('Operation processing error', {
          component: 'SynchronizationOptimizer',
        }, error as Error);
      }

      // Schedule next processing cycle
      setTimeout(processNext, 1);
    };

    processNext();
  }

  private getNextOperation(): SyncOperation | null {
    // Get operation from highest priority queue
    for (let priority = 10; priority >= 0; priority--) {
      const queue = this.operationQueue.get(priority)!;
      if (queue.length > 0) {
        return queue.shift()!;
      }
    }
    return null;
  }

  private async executeTask(task: SyncTask): Promise<void> {
    const startTime = Date.now();
    task.attempts++;

    this.emit('operation-started', task);

    try {
      // Simulate synchronization work
      await this.performSynchronization(task.operation, task.targetViewportId);

      const duration = Date.now() - startTime;
      this.updateMetrics(task, duration, true);

      this.emit('operation-completed', task, duration);

    } catch (error) {
      const duration = Date.now() - startTime;
      task.lastError = (error as Error).message;

      if (task.attempts < task.maxAttempts) {
        // Retry with delay
        setTimeout(() => {
          this.executeTask(task);
        }, 100 * task.attempts);
      } else {
        this.updateMetrics(task, duration, false);
        this.emit('operation-failed', task, error as Error);
      }
    } finally {
      if (task.attempts >= task.maxAttempts || task.lastError === undefined) {
        this.activeTasks.delete(task.id);
      }
    }
  }

  private async performSynchronization(operation: SyncOperation, _targetViewportId: string): Promise<void> {
    // Simulate synchronization work based on operation type
    const baseDelay = this.getOperationComplexity(operation.type);
    const delay = baseDelay + Math.random() * 10; // Add some variance

    await new Promise(resolve => setTimeout(resolve, delay));

    // Simulate occasional failures for testing
    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error(`Sync failed for ${operation.type} to ${_targetViewportId}`);
    }
  }

  private getOperationComplexity(type: SyncOperation['type']): number {
    const complexityMap = {
      'pan': 5,
      'zoom': 8,
      'window-level': 3,
      'scroll': 10,
      'crosshair': 2,
      'orientation': 15,
    };
    return complexityMap[type] || 5;
  }

  private updateMetrics(_task: SyncTask, duration: number, success: boolean): void {
    if (success) {
      this.metrics.completedOperations++;

      // Update average latency
      const total = this.metrics.completedOperations;
      this.metrics.averageLatency =
        (this.metrics.averageLatency * (total - 1) + duration) / total;

      // Update peak latency
      this.metrics.peakLatency = Math.max(this.metrics.peakLatency, duration);

    } else {
      this.metrics.failedOperations++;
    }

    // Update throughput (operations per second)
    this.operationHistory.push(Date.now());

    // Keep only last 10 seconds of history
    const tenSecondsAgo = Date.now() - 10000;
    this.operationHistory = this.operationHistory.filter(time => time > tenSecondsAgo);
    this.metrics.throughput = this.operationHistory.length / 10;

    this.metrics.queueLength = this.getTotalQueueLength();
  }

  private updateSyncGroupsForViewports(viewportStates: ViewportState[]): void {
    const activeViewportIds = new Set(viewportStates.map(state => state.id));

    this.syncGroups.forEach((group, _groupId) => {
      // Filter out inactive viewports
      const activeViewportsInGroup = group.viewportIds.filter(id =>
        activeViewportIds.has(id),
      );

      if (activeViewportsInGroup.length !== group.viewportIds.length) {
        group.viewportIds = activeViewportsInGroup;

        // Deactivate group if too few viewports remain
        if (activeViewportsInGroup.length < 2) {
          group.isActive = false;
        }
      }
    });
  }

  private applyPerformanceOptimizations(): void {
    // Adjust configuration based on current performance
    if (this.metrics.averageLatency > 100) {
      // High latency - enable more aggressive optimizations
      this.config.batchDelayMs = Math.max(8, this.config.batchDelayMs - 2);
      this.config.throttleThresholdMs = Math.min(50, this.config.throttleThresholdMs + 5);
    } else if (this.metrics.averageLatency < 20) {
      // Low latency - can be less aggressive
      this.config.batchDelayMs = Math.min(32, this.config.batchDelayMs + 2);
      this.config.throttleThresholdMs = Math.max(16, this.config.throttleThresholdMs - 2);
    }
  }

  private adaptConfiguration(): void {
    // Adapt based on throughput and error rate
    const errorRate = this.metrics.totalOperations > 0 ?
      this.metrics.failedOperations / this.metrics.totalOperations : 0;

    if (errorRate > 0.1) { // More than 10% error rate
      // Reduce concurrent operations
      this.config.maxConcurrentOperations = Math.max(2, this.config.maxConcurrentOperations - 1);
      this.config.operationTimeoutMs = Math.min(200, this.config.operationTimeoutMs + 20);
    } else if (errorRate < 0.02 && this.metrics.throughput > 50) {
      // Low error rate and high throughput - can increase concurrency
      this.config.maxConcurrentOperations = Math.min(16, this.config.maxConcurrentOperations + 1);
      this.config.operationTimeoutMs = Math.max(50, this.config.operationTimeoutMs - 10);
    }
  }

  private startPerformanceMonitoring(): void {
    this.performanceTimer = setInterval(() => {
      this.emit('performance-updated', this.getPerformanceMetrics());
    }, 5000); // Update every 5 seconds
  }

  private getTotalQueueLength(): number {
    let total = 0;
    for (const queue of this.operationQueue.values()) {
      total += queue.length;
    }
    return total;
  }

  private getRecentOperations(timeWindowMs: number): SyncOperation[] {
    const cutoff = Date.now() - timeWindowMs;
    const recent: SyncOperation[] = [];

    for (const queue of this.operationQueue.values()) {
      recent.push(...queue.filter(op => op.timestamp > cutoff));
    }

    return recent;
  }

  private estimateOperationDuration(operation: SyncOperation): number {
    const baseTime = this.getOperationComplexity(operation.type);
    const targetMultiplier = Math.min(3, operation.targetViewportIds.length * 0.5);
    return baseTime * targetMultiplier;
  }

  private async waitForOperation(operationId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const checkCompletion = () => {
        const task = Array.from(this.activeTasks.values())
          .find(t => t.operation.id === operationId);

        if (!task) {
          resolve(true); // Operation completed
          return;
        }

        if (task.attempts >= task.maxAttempts && task.lastError) {
          resolve(false); // Operation failed
          return;
        }

        // Check again in a bit
        setTimeout(checkCompletion, 10);
      };

      checkCompletion();
    });
  }

  private generateOperationId(): string {
    return `sync-op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTaskId(): string {
    return `sync-task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateGroupId(): string {
    return `sync-group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ===== Cleanup =====

  public dispose(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.performanceTimer) {
      clearInterval(this.performanceTimer);
      this.performanceTimer = null;
    }

    this.syncGroups.clear();
    this.operationQueue.clear();
    this.activeTasks.clear();
    this.pendingBatches.clear();
    this.operationHistory = [];
    this.removeAllListeners();

    log.info('SynchronizationOptimizer disposed', {
      component: 'SynchronizationOptimizer',
    });
  }
}

// Singleton instance
export const synchronizationOptimizer = new SynchronizationOptimizer();
