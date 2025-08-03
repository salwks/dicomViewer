/**
 * Rendering Priority Manager Service
 * Advanced priority-based rendering system for multi-viewport medical imaging
 * Built with security compliance and type safety
 */

import { EventEmitter } from 'events';
import { viewportStateManager } from './viewportStateManager';
import { memoryManager } from './memoryManager';
import { log } from '../utils/logger';

// Rendering priority levels (extending existing enum)
export enum RenderPriority {
  CRITICAL = 0,    // Active viewport with user interaction
  HIGH = 1,        // Active viewport
  MEDIUM = 2,      // Visible inactive viewport
  LOW = 3,         // Hidden viewport
  SUSPENDED = 4,   // Suspended rendering
  BACKGROUND = 5,  // Background processing only
}

// Priority queue item interface
export interface PriorityQueueItem {
  viewportId: string;
  priority: RenderPriority;
  timestamp: number;
  renderingTask: RenderingTask;
  dependencies: string[];
  estimatedDuration: number;
  retryCount: number;
}

// Rendering task types
export interface RenderingTask {
  id: string;
  type: 'initial' | 'update' | 'resize' | 'quality-change' | 'tool-change';
  parameters: Record<string, unknown>;
  isBlocking: boolean;
  canBeDeferred: boolean;
  maxRetries: number;
}

// Resource allocation configuration
export interface ResourceAllocation {
  cpuPercentage: number;
  memoryPercentage: number;
  gpuPercentage: number;
  maxConcurrentTasks: number;
  timeSliceMs: number;
}

// Priority system configuration
export interface PrioritySystemConfig {
  maxQueueSize: number;
  taskTimeoutMs: number;
  priorityDecayRate: number;
  resourceReservation: Map<RenderPriority, ResourceAllocation>;
  enableAdaptivePriority: boolean;
  enableLoadBalancing: boolean;
  performanceThresholds: {
    fpsThreshold: number;
    memoryThreshold: number;
    cpuThreshold: number;
  };
}

// Performance metrics for priority decisions
export interface PriorityMetrics {
  avgFrameTime: number;
  memoryPressure: number;
  cpuUsage: number;
  queueLength: number;
  completedTasks: number;
  failedTasks: number;
  averageWaitTime: number;
}

// Priority system events
export interface PrioritySystemEvents {
  'priority-changed': [string, RenderPriority, RenderPriority]; // viewportId, old, new
  'task-queued': [PriorityQueueItem];
  'task-started': [PriorityQueueItem];
  'task-completed': [PriorityQueueItem, number]; // item, duration
  'task-failed': [PriorityQueueItem, Error];
  'queue-overflow': [number]; // queue size
  'priority-adjusted': [string, RenderPriority, string]; // viewportId, new priority, reason
  'performance-degraded': [PriorityMetrics];
  'resource-allocation-changed': [Map<RenderPriority, ResourceAllocation>];
}

// Default resource allocations for each priority level
const DEFAULT_RESOURCE_ALLOCATIONS = new Map<RenderPriority, ResourceAllocation>([
  [RenderPriority.CRITICAL, {
    cpuPercentage: 60,
    memoryPercentage: 50,
    gpuPercentage: 70,
    maxConcurrentTasks: 1,
    timeSliceMs: 16, // Target 60fps
  }],
  [RenderPriority.HIGH, {
    cpuPercentage: 30,
    memoryPercentage: 30,
    gpuPercentage: 20,
    maxConcurrentTasks: 2,
    timeSliceMs: 33, // Target 30fps
  }],
  [RenderPriority.MEDIUM, {
    cpuPercentage: 20,
    memoryPercentage: 15,
    gpuPercentage: 10,
    maxConcurrentTasks: 3,
    timeSliceMs: 100, // Target 10fps
  }],
  [RenderPriority.LOW, {
    cpuPercentage: 10,
    memoryPercentage: 5,
    gpuPercentage: 5,
    maxConcurrentTasks: 2,
    timeSliceMs: 200, // Target 5fps
  }],
  [RenderPriority.SUSPENDED, {
    cpuPercentage: 0,
    memoryPercentage: 0,
    gpuPercentage: 0,
    maxConcurrentTasks: 0,
    timeSliceMs: 0,
  }],
  [RenderPriority.BACKGROUND, {
    cpuPercentage: 5,
    memoryPercentage: 2,
    gpuPercentage: 1,
    maxConcurrentTasks: 1,
    timeSliceMs: 1000, // Target 1fps
  }],
]);

// Default configuration
const DEFAULT_CONFIG: PrioritySystemConfig = {
  maxQueueSize: 100,
  taskTimeoutMs: 5000,
  priorityDecayRate: 0.95,
  resourceReservation: DEFAULT_RESOURCE_ALLOCATIONS,
  enableAdaptivePriority: true,
  enableLoadBalancing: true,
  performanceThresholds: {
    fpsThreshold: 30,
    memoryThreshold: 0.8,
    cpuThreshold: 0.7,
  },
};

export class RenderingPriorityManager extends EventEmitter {
  private readonly config: PrioritySystemConfig;
  private readonly priorityQueue: PriorityQueueItem[] = [];
  private readonly viewportPriorities = new Map<string, RenderPriority>();
  private readonly activeTasks = new Map<string, PriorityQueueItem>();
  private readonly performanceHistory: PriorityMetrics[] = [];
  private readonly MAX_HISTORY_SIZE = 100;

  private processingInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private adaptiveInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private lastProcessTime = 0;

  constructor(config: Partial<PrioritySystemConfig> = {}) {
    super();

    this.config = { ...DEFAULT_CONFIG, ...config };

    // Start processing systems
    this.startQueueProcessing();
    this.startMetricsCollection();

    if (this.config.enableAdaptivePriority) {
      this.startAdaptivePriorityAdjustment();
    }

    log.info('RenderingPriorityManager initialized', {
      component: 'RenderingPriorityManager',
      metadata: {
        maxQueueSize: this.config.maxQueueSize,
        adaptivePriority: this.config.enableAdaptivePriority,
        loadBalancing: this.config.enableLoadBalancing,
      },
    });
  }

  /**
   * Set rendering priority for viewport
   */
  setPriority(viewportId: string, priority: RenderPriority, reason?: string): void {
    const previousPriority = this.viewportPriorities.get(viewportId);

    // Validate priority change
    if (previousPriority === priority) {
      return; // No change needed
    }

    // Update priority tracking
    this.viewportPriorities.set(viewportId, priority);

    // Update any existing tasks in queue
    this.updateQueuedTaskPriority(viewportId, priority);

    // Update active tasks
    const activeTask = Array.from(this.activeTasks.values())
      .find(task => task.viewportId === viewportId);

    if (activeTask) {
      activeTask.priority = priority;
    }

    // Re-sort queue to reflect new priority
    this.sortQueue();

    // Emit priority change event
    this.emit('priority-changed', viewportId, previousPriority || RenderPriority.MEDIUM, priority);

    // Emit priority adjustment event if reason provided
    if (reason) {
      this.emit('priority-adjusted', viewportId, priority, reason);
    }

    log.info('Viewport priority changed', {
      component: 'RenderingPriorityManager',
      metadata: {
        viewportId,
        previousPriority: previousPriority ? RenderPriority[previousPriority] : 'none',
        newPriority: RenderPriority[priority],
        reason: reason || 'manual',
      },
    });
  }

  /**
   * Queue rendering task with priority
   */
  queueRenderingTask(
    viewportId: string,
    task: RenderingTask,
    priority?: RenderPriority,
    dependencies: string[] = [],
  ): boolean {
    // Check queue capacity
    if (this.priorityQueue.length >= this.config.maxQueueSize) {
      this.emit('queue-overflow', this.priorityQueue.length);
      log.warn('Priority queue overflow, dropping task', {
        component: 'RenderingPriorityManager',
        metadata: { viewportId, taskId: task.id, queueSize: this.priorityQueue.length },
      });
      return false;
    }

    // Determine priority
    const taskPriority = priority ?? this.viewportPriorities.get(viewportId) ?? RenderPriority.MEDIUM;

    // Estimate task duration based on type
    const estimatedDuration = this.estimateTaskDuration(task);

    // Create queue item
    const queueItem: PriorityQueueItem = {
      viewportId,
      priority: taskPriority,
      timestamp: Date.now(),
      renderingTask: task,
      dependencies,
      estimatedDuration,
      retryCount: 0,
    };

    // Add to queue
    this.priorityQueue.push(queueItem);

    // Sort queue by priority
    this.sortQueue();

    // Emit queued event
    this.emit('task-queued', queueItem);

    log.info('Rendering task queued', {
      component: 'RenderingPriorityManager',
      metadata: {
        viewportId,
        taskId: task.id,
        priority: RenderPriority[taskPriority],
        queuePosition: this.priorityQueue.indexOf(queueItem),
        queueSize: this.priorityQueue.length,
      },
    });

    return true;
  }

  /**
   * Get current priority for viewport
   */
  getPriority(viewportId: string): RenderPriority {
    return this.viewportPriorities.get(viewportId) ?? RenderPriority.MEDIUM;
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    totalItems: number;
    itemsByPriority: Map<RenderPriority, number>;
    activeTasks: number;
    averageWaitTime: number;
    } {
    const itemsByPriority = new Map<RenderPriority, number>();

    // Count items by priority
    this.priorityQueue.forEach(item => {
      const count = itemsByPriority.get(item.priority) || 0;
      itemsByPriority.set(item.priority, count + 1);
    });

    // Calculate average wait time
    const now = Date.now();
    const totalWaitTime = this.priorityQueue.reduce((sum, item) => sum + (now - item.timestamp), 0);
    const averageWaitTime = this.priorityQueue.length > 0 ? totalWaitTime / this.priorityQueue.length : 0;

    return {
      totalItems: this.priorityQueue.length,
      itemsByPriority,
      activeTasks: this.activeTasks.size,
      averageWaitTime,
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PriorityMetrics | null {
    if (this.performanceHistory.length === 0) {
      return null;
    }

    return this.performanceHistory[this.performanceHistory.length - 1];
  }

  /**
   * Adjust priority based on viewport state
   */
  adjustPriorityBasedOnState(viewportId: string): void {
    const viewportState = viewportStateManager.getViewportState(viewportId);
    if (!viewportState) {
      return;
    }

    let newPriority: RenderPriority;
    let reason: string;

    // Determine priority based on viewport state
    if (viewportState.activation.isActive) {
      if (viewportState.activation.isFocused) {
        newPriority = RenderPriority.CRITICAL;
        reason = 'viewport-focused';
      } else {
        newPriority = RenderPriority.HIGH;
        reason = 'viewport-active';
      }
    } else if (viewportState.activation.isVisible) {
      newPriority = RenderPriority.MEDIUM;
      reason = 'viewport-visible';
    } else {
      newPriority = RenderPriority.LOW;
      reason = 'viewport-hidden';
    }

    // Check performance state
    if (viewportState.performance.isRenderingEnabled) {
      // Keep current priority
    } else {
      newPriority = RenderPriority.SUSPENDED;
      reason = 'rendering-disabled';
    }

    // Apply priority change
    this.setPriority(viewportId, newPriority, reason);
  }

  /**
   * Optimize resource allocation based on current load
   */
  optimizeResourceAllocation(): void {
    const metrics = this.getPerformanceMetrics();
    if (!metrics) return;

    const memoryUsage = memoryManager.getMemoryUsage();
    const memoryRatio = memoryUsage.used / memoryUsage.total;

    // Adjust allocations based on system pressure
    const newAllocations = new Map<RenderPriority, ResourceAllocation>();

    this.config.resourceReservation.forEach((allocation, priority) => {
      const adjustedAllocation = { ...allocation };

      // Reduce allocations under memory pressure
      if (memoryRatio > this.config.performanceThresholds.memoryThreshold) {
        adjustedAllocation.memoryPercentage *= 0.7;
        adjustedAllocation.maxConcurrentTasks = Math.max(1, Math.floor(adjustedAllocation.maxConcurrentTasks * 0.8));
      }

      // Adjust for low FPS
      if (metrics.avgFrameTime > (1000 / this.config.performanceThresholds.fpsThreshold)) {
        if (priority === RenderPriority.CRITICAL) {
          adjustedAllocation.cpuPercentage = Math.min(80, adjustedAllocation.cpuPercentage * 1.2);
        } else {
          adjustedAllocation.cpuPercentage *= 0.8;
          adjustedAllocation.timeSliceMs = Math.min(1000, adjustedAllocation.timeSliceMs * 1.2);
        }
      }

      newAllocations.set(priority, adjustedAllocation);
    });

    // Update configuration
    this.config.resourceReservation = newAllocations;

    // Emit allocation change event
    this.emit('resource-allocation-changed', newAllocations);

    log.info('Resource allocation optimized', {
      component: 'RenderingPriorityManager',
      metadata: {
        memoryRatio,
        avgFrameTime: metrics.avgFrameTime,
        allocationsUpdated: newAllocations.size,
      },
    });
  }

  /**
   * Process priority queue
   */
  private processQueue(): void {
    if (this.isProcessing || this.priorityQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      // Get next task to process
      const nextTask = this.getNextProcessableTask();
      if (!nextTask) {
        this.isProcessing = false;
        return;
      }

      // Remove from queue
      const queueIndex = this.priorityQueue.indexOf(nextTask);
      if (queueIndex >= 0) {
        this.priorityQueue.splice(queueIndex, 1);
      }

      // Add to active tasks
      this.activeTasks.set(nextTask.renderingTask.id, nextTask);

      // Emit task started event
      this.emit('task-started', nextTask);

      // Process the task
      this.processRenderingTask(nextTask)
        .then((duration) => {
          // Remove from active tasks
          this.activeTasks.delete(nextTask.renderingTask.id);

          // Emit completion event
          this.emit('task-completed', nextTask, duration);

          log.info('Rendering task completed', {
            component: 'RenderingPriorityManager',
            metadata: {
              taskId: nextTask.renderingTask.id,
              viewportId: nextTask.viewportId,
              duration,
              priority: RenderPriority[nextTask.priority],
            },
          });
        })
        .catch((error) => {
          // Handle task failure
          this.handleTaskFailure(nextTask, error);
        })
        .finally(() => {
          this.isProcessing = false;
          this.lastProcessTime = Date.now() - startTime;
        });

    } catch (error) {
      this.isProcessing = false;
      log.error('Error processing priority queue', {
        component: 'RenderingPriorityManager',
      }, error as Error);
    }
  }

  /**
   * Get next processable task from queue
   */
  private getNextProcessableTask(): PriorityQueueItem | null {
    // Find highest priority task with satisfied dependencies
    for (const task of this.priorityQueue) {
      if (this.areDependenciesSatisfied(task) && this.canProcessTask(task)) {
        return task;
      }
    }
    return null;
  }

  /**
   * Check if task dependencies are satisfied
   */
  private areDependenciesSatisfied(task: PriorityQueueItem): boolean {
    return task.dependencies.every(depId => !this.activeTasks.has(depId));
  }

  /**
   * Check if task can be processed based on resource constraints
   */
  private canProcessTask(task: PriorityQueueItem): boolean {
    const allocation = this.config.resourceReservation.get(task.priority);
    if (!allocation) return false;

    // Check if we can run more concurrent tasks at this priority
    const activeSamePriority = Array.from(this.activeTasks.values())
      .filter(activeTask => activeTask.priority === task.priority).length;

    return activeSamePriority < allocation.maxConcurrentTasks;
  }

  /**
   * Process a rendering task
   */
  private async processRenderingTask(task: PriorityQueueItem): Promise<number> {
    const startTime = Date.now();

    try {
      // Get resource allocation for this priority
      const allocation = this.config.resourceReservation.get(task.priority);
      if (!allocation) {
        throw new Error(`No resource allocation for priority ${RenderPriority[task.priority]}`);
      }

      // Simulate task processing with time slice
      await new Promise(resolve => setTimeout(resolve, allocation.timeSliceMs));

      // In a real implementation, this would:
      // 1. Update viewport rendering settings
      // 2. Trigger Cornerstone3D rendering
      // 3. Apply quality/performance settings
      // 4. Handle WebGL resource allocation

      return Date.now() - startTime;

    } catch (error) {
      log.error('Failed to process rendering task', {
        component: 'RenderingPriorityManager',
        metadata: {
          taskId: task.renderingTask.id,
          viewportId: task.viewportId,
          priority: RenderPriority[task.priority],
        },
      }, error as Error);
      throw error;
    }
  }

  /**
   * Handle task failure
   */
  private handleTaskFailure(task: PriorityQueueItem, error: Error): void {
    task.retryCount++;

    // Emit failure event
    this.emit('task-failed', task, error);

    // Remove from active tasks
    this.activeTasks.delete(task.renderingTask.id);

    // Retry if possible
    if (task.retryCount < task.renderingTask.maxRetries) {
      // Add back to queue with lower priority
      task.priority = Math.min(RenderPriority.BACKGROUND, task.priority + 1);
      this.priorityQueue.push(task);
      this.sortQueue();

      log.warn('Retrying failed rendering task', {
        component: 'RenderingPriorityManager',
        metadata: {
          taskId: task.renderingTask.id,
          retryCount: task.retryCount,
          newPriority: RenderPriority[task.priority],
        },
      });
    } else {
      log.error('Rendering task failed permanently', {
        component: 'RenderingPriorityManager',
        metadata: {
          taskId: task.renderingTask.id,
          viewportId: task.viewportId,
          finalRetryCount: task.retryCount,
        },
      }, error);
    }
  }

  /**
   * Update priority of queued tasks for viewport
   */
  private updateQueuedTaskPriority(viewportId: string, priority: RenderPriority): void {
    this.priorityQueue.forEach(item => {
      if (item.viewportId === viewportId) {
        item.priority = priority;
      }
    });
  }

  /**
   * Sort queue by priority and timestamp
   */
  private sortQueue(): void {
    this.priorityQueue.sort((a, b) => {
      // First sort by priority (lower number = higher priority)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      // Then by timestamp (FIFO within same priority)
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Estimate task duration based on type
   */
  private estimateTaskDuration(task: RenderingTask): number {
    const baseDurations = {
      'initial': 100,
      'update': 50,
      'resize': 30,
      'quality-change': 20,
      'tool-change': 10,
    };

    return baseDurations[task.type] || 50;
  }

  /**
   * Start queue processing
   */
  private startQueueProcessing(): void {
    if (this.processingInterval) return;

    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 16); // ~60fps processing rate
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    if (this.metricsInterval) return;

    this.metricsInterval = setInterval(() => {
      const metrics = this.collectCurrentMetrics();
      this.performanceHistory.push(metrics);

      // Keep history size manageable
      if (this.performanceHistory.length > this.MAX_HISTORY_SIZE) {
        this.performanceHistory.shift();
      }

      // Check for performance degradation
      if (this.isPerformanceDegraded(metrics)) {
        this.emit('performance-degraded', metrics);
      }

    }, 1000); // Collect metrics every second
  }

  /**
   * Start adaptive priority adjustment
   */
  private startAdaptivePriorityAdjustment(): void {
    if (this.adaptiveInterval) return;

    this.adaptiveInterval = setInterval(() => {
      // Adjust priorities for all tracked viewports
      this.viewportPriorities.forEach((_, viewportId) => {
        this.adjustPriorityBasedOnState(viewportId);
      });

      // Optimize resource allocation
      this.optimizeResourceAllocation();

    }, 5000); // Adjust every 5 seconds
  }

  /**
   * Collect current performance metrics
   */
  private collectCurrentMetrics(): PriorityMetrics {
    const queueStatus = this.getQueueStatus();
    const memoryUsage = memoryManager.getMemoryUsage();

    return {
      avgFrameTime: this.lastProcessTime,
      memoryPressure: memoryUsage.used / memoryUsage.total,
      cpuUsage: 0.5, // Mock value - would be actual CPU monitoring
      queueLength: this.priorityQueue.length,
      completedTasks: this.performanceHistory.length, // Approximation
      failedTasks: 0, // Would track actual failures
      averageWaitTime: queueStatus.averageWaitTime,
    };
  }

  /**
   * Check if performance is degraded
   */
  private isPerformanceDegraded(metrics: PriorityMetrics): boolean {
    const thresholds = this.config.performanceThresholds;

    return (
      metrics.avgFrameTime > (1000 / thresholds.fpsThreshold) ||
      metrics.memoryPressure > thresholds.memoryThreshold ||
      metrics.cpuUsage > thresholds.cpuThreshold ||
      metrics.queueLength > this.config.maxQueueSize * 0.8
    );
  }

  /**
   * Set rendering order for viewport (used by ViewportOptimizer)
   */
  setRenderOrder(viewportId: string, order: number): void {
    try {
      // Update viewport priority with order-based adjustment
      const currentPriority = this.viewportPriorities.get(viewportId) || RenderPriority.MEDIUM;

      // Adjust priority slightly based on order (higher order = slightly lower priority)
      const orderAdjustment = Math.floor(order / 10); // Every 10 viewports = 1 priority level
      const adjustedPriority = Math.min(RenderPriority.SUSPENDED, currentPriority + orderAdjustment);

      this.viewportPriorities.set(viewportId, adjustedPriority);

      // Update queued tasks with new order-based priority
      this.updateQueuedTaskPriority(viewportId, adjustedPriority);
      this.sortQueue();

      log.info('Viewport render order updated', {
        component: 'RenderingPriorityManager',
        metadata: {
          viewportId,
          order,
          adjustedPriority: RenderPriority[adjustedPriority],
        },
      });

    } catch (error) {
      log.warn('Failed to set viewport render order', {
        component: 'RenderingPriorityManager',
        metadata: { viewportId, order },
      }, error as Error);
    }
  }

  /**
   * Clean up and dispose
   */
  dispose(): void {
    // Stop all intervals
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.adaptiveInterval) {
      clearInterval(this.adaptiveInterval);
      this.adaptiveInterval = null;
    }

    // Clear data structures
    this.priorityQueue.length = 0;
    this.viewportPriorities.clear();
    this.activeTasks.clear();
    this.performanceHistory.length = 0;

    // Remove all listeners
    this.removeAllListeners();

    log.info('RenderingPriorityManager disposed', {
      component: 'RenderingPriorityManager',
    });
  }
}

// Export singleton instance
export const renderingPriorityManager = new RenderingPriorityManager();
export default renderingPriorityManager;
