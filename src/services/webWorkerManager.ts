/**
 * Web Worker Manager
 * Manages pool of web workers for heavy computational tasks
 */

import { performanceManager } from './performanceManager';

export interface WorkerTask {
  id: string;
  type: string;
  data: any;
  priority: TaskPriority;
  timeout?: number;
  retries?: number;
}

export interface WorkerResult {
  taskId: string;
  success: boolean;
  data?: any;
  error?: string;
  processingTime: number;
  workerId: string;
}

export enum TaskPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

export interface WorkerStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageProcessingTime: number;
  activeWorkers: number;
  queuedTasks: number;
}

export interface WorkerConfig {
  maxWorkers: number;
  workerScript: string;
  taskTimeout: number;
  maxRetries: number;
  enableFallback: boolean;
  idleTimeout: number;
}

interface ManagedWorker {
  id: string;
  worker: Worker;
  busy: boolean;
  currentTask: string | null;
  tasksCompleted: number;
  lastUsed: number;
  created: number;
}

/**
 * Web Worker pool manager for parallel processing
 */
export class WebWorkerManager extends EventTarget {
  /**
   * Trigger custom event
   */
  private triggerEvent(type: string, detail: any): void {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
  private static instance: WebWorkerManager | null = null;
  private config: WorkerConfig;
  private workers: Map<string, ManagedWorker> = new Map();
  private taskQueue: Map<TaskPriority, WorkerTask[]> = new Map();
  private activeTasks: Map<string, WorkerTask> = new Map();
  private taskResults: Map<string, Promise<WorkerResult>> = new Map();
  private stats: WorkerStats;
  private cleanupInterval: number | null = null;
  private workerCounter = 0;

  private constructor(config: Partial<WorkerConfig> = {}) {
    super();

    this.config = {
      maxWorkers: Math.min(navigator.hardwareConcurrency || 4, 8),
      workerScript: new URL('../workers/imageProcessingWorker.ts', import.meta.url).href,
      taskTimeout: 30000, // 30 seconds
      maxRetries: 3,
      enableFallback: true,
      idleTimeout: 300000, // 5 minutes
      ...config,
    };

    this.stats = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageProcessingTime: 0,
      activeWorkers: 0,
      queuedTasks: 0,
    };

    // Initialize priority queues
    Object.values(TaskPriority).forEach(priority => {
      if (typeof priority === 'number') {
        this.taskQueue.set(priority, []);
      }
    });

    this.startCleanupTimer();
  }

  public static getInstance(config?: Partial<WorkerConfig>): WebWorkerManager {
    if (!WebWorkerManager.instance) {
      WebWorkerManager.instance = new WebWorkerManager(config);
    }
    return WebWorkerManager.instance;
  }

  /**
   * Submit task for processing
   */
  public async submitTask(task: WorkerTask): Promise<WorkerResult> {
    this.stats.totalTasks++;
    this.stats.queuedTasks++;

    // Add to appropriate priority queue
    const queue = this.taskQueue.get(task.priority);
    if (queue) {
      queue.push(task);
      this.sortQueueByPriority(queue);
    }

    // Store task
    this.activeTasks.set(task.id, task);

    // Create promise for result
    const resultPromise = new Promise<WorkerResult>((resolve, reject) => {
      const timeout = task.timeout || this.config.taskTimeout;

      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.handleTaskTimeout(task.id);
        reject(new Error(`Task ${task.id} timed out after ${timeout}ms`));
      }, timeout);

      // Store resolve/reject functions
      const handleResult = (result: WorkerResult) => {
        clearTimeout(timeoutId);
        if (result.success) {
          resolve(result);
        } else {
          reject(new Error(result.error || 'Task failed'));
        }
      };

      // Listen for result
      const resultHandler = (event: Event) => {
        const customEvent = event as CustomEvent;
        const result = customEvent.detail as WorkerResult;
        if (result.taskId === task.id) {
          this.removeEventListener('task:completed', resultHandler);
          handleResult(result);
        }
      };

      this.addEventListener('task:completed', resultHandler);
    });

    this.taskResults.set(task.id, resultPromise);

    // Process queue
    this.processQueue();

    this.triggerEvent('task:submitted', { taskId: task.id, priority: task.priority });

    return resultPromise;
  }

  /**
   * Cancel a task
   */
  public cancelTask(taskId: string): boolean {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      return false;
    }

    // Remove from queue if not started
    const queue = this.taskQueue.get(task.priority);
    if (queue) {
      const index = queue.findIndex(t => t.id === taskId);
      if (index >= 0) {
        queue.splice(index, 1);
        this.stats.queuedTasks--;
      }
    }

    // Find worker executing this task
    for (const [, worker] of this.workers) {
      if (worker.currentTask === taskId) {
        // Send cancel message to worker
        worker.worker.postMessage({
          type: 'cancel',
          id: taskId,
        });

        worker.busy = false;
        worker.currentTask = null;
        break;
      }
    }

    // Clean up
    this.activeTasks.delete(taskId);
    this.taskResults.delete(taskId);

    this.triggerEvent('task:cancelled', { taskId });
    return true;
  }

  /**
   * Process task queue
   */
  private async processQueue(): Promise<void> {
    // Find available worker
    const availableWorker = this.getAvailableWorker();
    if (!availableWorker) {
      // Try to create new worker if under limit
      if (this.workers.size < this.config.maxWorkers) {
        await this.createWorker();
        return this.processQueue();
      }
      return; // No available workers
    }

    // Find next task (highest priority first)
    const nextTask = this.getNextTask();
    if (!nextTask) {
      return; // No tasks to process
    }

    // Assign task to worker
    this.assignTaskToWorker(nextTask, availableWorker);
  }

  /**
   * Get available worker
   */
  private getAvailableWorker(): ManagedWorker | null {
    for (const worker of this.workers.values()) {
      if (!worker.busy) {
        return worker;
      }
    }
    return null;
  }

  /**
   * Get next task from queue (highest priority first)
   */
  private getNextTask(): WorkerTask | null {
    // Check priorities from highest to lowest
    const priorities = [TaskPriority.CRITICAL, TaskPriority.HIGH, TaskPriority.NORMAL, TaskPriority.LOW];

    for (const priority of priorities) {
      const queue = this.taskQueue.get(priority);
      if (queue && queue.length > 0) {
        return queue.shift()!;
      }
    }

    return null;
  }

  /**
   * Assign task to worker
   */
  private assignTaskToWorker(task: WorkerTask, worker: ManagedWorker): void {
    worker.busy = true;
    worker.currentTask = task.id;
    worker.lastUsed = Date.now();

    this.stats.queuedTasks--;

    performanceManager.startTiming(`worker-task-${task.id}`);

    // Send task to worker
    worker.worker.postMessage({
      type: 'process',
      id: task.id,
      data: {
        type: task.type,
        imageId: task.id,
        data: task.data,
        options: task.data.options || {},
      },
    });

    this.triggerEvent('task:started', {
      taskId: task.id,
      workerId: worker.id,
      priority: task.priority,
    });
  }

  /**
   * Create new worker
   */
  private async createWorker(): Promise<ManagedWorker> {
    return new Promise((resolve, reject) => {
      try {
        // Create worker using actual worker file
        const worker = new Worker(
          new URL('../workers/imageProcessingWorker.ts', import.meta.url),
          { type: 'module' },
        );

        const workerId = `worker-${++this.workerCounter}`;

        const managedWorker: ManagedWorker = {
          id: workerId,
          worker,
          busy: false,
          currentTask: null,
          tasksCompleted: 0,
          lastUsed: Date.now(),
          created: Date.now(),
        };

        // Set up message handler
        worker.onmessage = (event) => {
          this.handleWorkerMessage(workerId, event);
        };

        // Set up error handler
        worker.onerror = (error) => {
          this.handleWorkerError(workerId, error);
        };

        // Test worker is ready
        worker.postMessage({ type: 'ping', id: 'test' });

        // Wait for pong or timeout
        const testTimeout = setTimeout(() => {
          reject(new Error('Worker failed to respond'));
        }, 5000);

        const testHandler = (event: MessageEvent) => {
          if (event.data.type === 'pong') {
            clearTimeout(testTimeout);
            worker.removeEventListener('message', testHandler);

            this.workers.set(workerId, managedWorker);
            this.stats.activeWorkers = this.workers.size;

            this.triggerEvent('worker:created', { workerId });
            resolve(managedWorker);
          }
        };

        worker.addEventListener('message', testHandler);

      } catch (error) {
        reject(error);
      }
    });
  }


  /**
   * Handle worker message
   */
  private handleWorkerMessage(workerId: string, event: MessageEvent): void {
    const { type, id, data } = event.data;
    const worker = this.workers.get(workerId);

    if (!worker) return;

    switch (type) {
      case 'result':
        this.handleTaskResult(workerId, data);
        break;
      case 'error':
        this.handleTaskError(workerId, id, data.error);
        break;
      case 'cancelled':
        this.handleTaskCancelled(workerId, id);
        break;
    }
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(workerId: string, error: ErrorEvent): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    const taskId = worker.currentTask;
    if (taskId) {
      this.handleTaskError(workerId, taskId, error.message);
    }

    this.triggerEvent('worker:error', { workerId, error: error.message });
  }

  /**
   * Handle task result
   */
  private handleTaskResult(workerId: string, resultData: any): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    const taskId = resultData.imageId;
    const task = this.activeTasks.get(taskId);

    if (!task) return;

    // Update worker state
    worker.busy = false;
    worker.currentTask = null;
    worker.tasksCompleted++;
    worker.lastUsed = Date.now();

    // Update stats
    this.stats.completedTasks++;
    this.updateAverageProcessingTime(resultData.processingTime);

    // Create result
    const result: WorkerResult = {
      taskId,
      success: true,
      data: resultData.result,
      processingTime: resultData.processingTime,
      workerId,
    };

    // Clean up
    this.activeTasks.delete(taskId);
    performanceManager.endTiming(`worker-task-${taskId}`);

    // Emit result
    this.triggerEvent('task:completed', result);

    // Process next task
    this.processQueue();
  }

  /**
   * Handle task error
   */
  private handleTaskError(workerId: string, taskId: string, error: string): void {
    const worker = this.workers.get(workerId);
    const task = this.activeTasks.get(taskId);

    if (!worker || !task) return;

    // Update worker state
    worker.busy = false;
    worker.currentTask = null;

    // Try retry if enabled
    const retryCount = (task as any).retryCount || 0;
    if (retryCount < (task.retries || this.config.maxRetries)) {
      (task as any).retryCount = retryCount + 1;

      // Requeue task
      const queue = this.taskQueue.get(task.priority);
      if (queue) {
        queue.unshift(task); // Add to front of queue
        this.stats.queuedTasks++;
      }

      this.triggerEvent('task:retry', { taskId, attempt: retryCount + 1 });

      // Process queue
      setTimeout(() => this.processQueue(), 1000); // Delay retry
      return;
    }

    // Max retries reached
    this.stats.failedTasks++;

    const result: WorkerResult = {
      taskId,
      success: false,
      error,
      processingTime: 0,
      workerId,
    };

    // Clean up
    this.activeTasks.delete(taskId);
    performanceManager.endTiming(`worker-task-${taskId}`);

    // Emit result
    this.triggerEvent('task:completed', result);

    // Process next task
    this.processQueue();
  }

  /**
   * Handle task cancelled
   */
  private handleTaskCancelled(workerId: string, taskId: string): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    worker.busy = false;
    worker.currentTask = null;

    this.triggerEvent('task:cancelled', { taskId, workerId });

    // Process next task
    this.processQueue();
  }

  /**
   * Handle task timeout
   */
  private handleTaskTimeout(taskId: string): void {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    // Find and reset worker
    for (const [workerInstanceId, worker] of this.workers) {
      if (worker.currentTask === taskId) {
        worker.busy = false;
        worker.currentTask = null;

        // Terminate and recreate worker
        this.recreateWorker(workerInstanceId);
        break;
      }
    }

    this.stats.failedTasks++;
    this.activeTasks.delete(taskId);

    this.triggerEvent('task:timeout', { taskId });
  }

  /**
   * Recreate worker after timeout or error
   */
  private async recreateWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    // Terminate old worker
    worker.worker.terminate();
    this.workers.delete(workerId);
    this.stats.activeWorkers = this.workers.size;

    // Create new worker
    try {
      await this.createWorker();
    } catch (error) {
      console.error('Failed to recreate worker:', error);
    }
  }

  /**
   * Sort queue by priority
   */
  private sortQueueByPriority(queue: WorkerTask[]): void {
    queue.sort((a, b) => {
      // Primary sort by priority (higher first)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      // Secondary sort by submission order (FIFO)
      return 0;
    });
  }

  /**
   * Update average processing time
   */
  private updateAverageProcessingTime(processingTime: number): void {
    const weight = 0.1;
    this.stats.averageProcessingTime =
      this.stats.averageProcessingTime * (1 - weight) + processingTime * weight;
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = window.setInterval(() => {
      this.cleanupIdleWorkers();
    }, 60000); // Check every minute
  }

  /**
   * Clean up idle workers
   */
  private cleanupIdleWorkers(): void {
    const now = Date.now();
    const idleWorkers: string[] = [];

    for (const [workerId, worker] of this.workers) {
      if (!worker.busy &&
          now - worker.lastUsed > this.config.idleTimeout &&
          this.workers.size > 1) { // Keep at least one worker
        idleWorkers.push(workerId);
      }
    }

    // Terminate idle workers
    idleWorkers.forEach(workerId => {
      const worker = this.workers.get(workerId);
      if (worker) {
        worker.worker.terminate();
        this.workers.delete(workerId);
      }
    });

    if (idleWorkers.length > 0) {
      this.stats.activeWorkers = this.workers.size;
      this.triggerEvent('workers:cleaned', { terminated: idleWorkers.length });
    }
  }

  /**
   * Get worker statistics
   */
  public getStats(): WorkerStats {
    this.stats.activeWorkers = this.workers.size;
    this.stats.queuedTasks = Array.from(this.taskQueue.values())
      .reduce((total, queue) => total + queue.length, 0);

    return { ...this.stats };
  }

  /**
   * Get worker information
   */
  public getWorkerInfo(): {
    id: string;
    busy: boolean;
    tasksCompleted: number;
    uptime: number;
  }[] {
    const now = Date.now();
    return Array.from(this.workers.values()).map(worker => ({
      id: worker.id,
      busy: worker.busy,
      tasksCompleted: worker.tasksCompleted,
      uptime: now - worker.created,
    }));
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<WorkerConfig>): void {
    this.config = { ...this.config, ...config };
    this.triggerEvent('config:updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  public getConfig(): WorkerConfig {
    return { ...this.config };
  }

  /**
   * Terminate all workers
   */
  public terminateAllWorkers(): void {
    for (const worker of this.workers.values()) {
      worker.worker.terminate();
    }

    this.workers.clear();
    this.stats.activeWorkers = 0;

    this.triggerEvent('workers:terminated', {});
  }

  /**
   * Cleanup and destroy
   */
  public destroy(): void {
    // Clear cleanup timer
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Cancel all tasks
    for (const taskId of this.activeTasks.keys()) {
      this.cancelTask(taskId);
    }

    // Terminate all workers
    this.terminateAllWorkers();

    // Clear data
    this.taskQueue.clear();
    this.activeTasks.clear();
    this.taskResults.clear();

    WebWorkerManager.instance = null;
  }
}

// Export singleton instance
export const webWorkerManager = WebWorkerManager.getInstance();
