/**
 * Undo/Redo State Management Service
 *
 * Manages annotation state history for undo/redo operations
 * Supports command pattern with batching and selective undo
 */

import { SerializedAnnotation } from './annotationPersistence';
import { log } from '../utils/logger';

/**
 * Command interface for undo/redo operations
 */
export interface Command {
  /** Unique command ID */
  id: string;
  /** Command type */
  type: CommandType;
  /** Command description */
  description: string;
  /** Execute the command */
  execute(): Promise<void>;
  /** Undo the command */
  undo(): Promise<void>;
  /** Whether command can be undone */
  canUndo(): boolean;
  /** Whether command can be redone */
  canRedo(): boolean;
  /** Command metadata */
  metadata: {
    timestamp: Date;
    userId?: string;
    sessionId?: string;
    batchId?: string;
    affectedAnnotations: string[];
    context: {
      viewportId: string;
      imageId: string;
      seriesInstanceUID?: string;
    };
  };
}

/**
 * Command types
 */
export enum CommandType {
  CREATE_ANNOTATION = 'createAnnotation',
  UPDATE_ANNOTATION = 'updateAnnotation',
  DELETE_ANNOTATION = 'deleteAnnotation',
  MOVE_ANNOTATION = 'moveAnnotation',
  STYLE_ANNOTATION = 'styleAnnotation',
  BATCH_OPERATION = 'batchOperation',
  IMPORT_ANNOTATIONS = 'importAnnotations',
  CLEAR_ANNOTATIONS = 'clearAnnotations',
}

/**
 * Annotation state snapshot
 */
export interface AnnotationSnapshot {
  /** Annotation data */
  annotation: SerializedAnnotation;
  /** Snapshot timestamp */
  timestamp: Date;
  /** Snapshot metadata */
  metadata: {
    commandId: string;
    commandType: CommandType;
    isBeforeState: boolean;
  };
}

/**
 * Batch command for grouping operations
 */
export interface BatchCommand extends Command {
  /** Child commands in the batch */
  commands: Command[];
  /** Batch execution strategy */
  strategy: 'sequential' | 'parallel';
}

/**
 * Undo/Redo manager configuration
 */
export interface UndoRedoConfig {
  /** Maximum history size */
  maxHistorySize: number;
  /** Maximum batch size */
  maxBatchSize: number;
  /** Auto-batch timeout in milliseconds */
  autoBatchTimeout: number;
  /** Enable selective undo */
  enableSelectiveUndo: boolean;
  /** Enable command compression */
  enableCompression: boolean;
  /** Excluded command types from history */
  excludedCommandTypes: CommandType[];
  /** Viewport-specific history */
  viewportSpecificHistory: boolean;
}

/**
 * Create annotation command
 */
export class CreateAnnotationCommand implements Command {
  public readonly id: string;
  public readonly type = CommandType.CREATE_ANNOTATION;
  public readonly description: string;
  public readonly metadata: Command['metadata'];

  private annotation: SerializedAnnotation;
  private onExecute: (annotation: SerializedAnnotation) => Promise<void>;
  private onUndo: (annotationId: string) => Promise<void>;

  constructor(
    annotation: SerializedAnnotation,
    context: Command['metadata']['context'],
    onExecute: (annotation: SerializedAnnotation) => Promise<void>,
    onUndo: (annotationId: string) => Promise<void>,
  ) {
    this.id = `create-${annotation.id}-${Date.now()}`;
    this.description = `Create ${annotation.type} annotation`;
    this.annotation = annotation;
    this.onExecute = onExecute;
    this.onUndo = onUndo;
    this.metadata = {
      timestamp: new Date(),
      affectedAnnotations: [annotation.id],
      context,
    };
  }

  async execute(): Promise<void> {
    await this.onExecute(this.annotation);
  }

  async undo(): Promise<void> {
    await this.onUndo(this.annotation.id);
  }

  canUndo(): boolean {
    return true;
  }

  canRedo(): boolean {
    return true;
  }
}

/**
 * Update annotation command
 */
export class UpdateAnnotationCommand implements Command {
  public readonly id: string;
  public readonly type = CommandType.UPDATE_ANNOTATION;
  public readonly description: string;
  public readonly metadata: Command['metadata'];

  private _annotationId: string;
  private beforeState: SerializedAnnotation;
  private afterState: SerializedAnnotation;
  private onUpdate: (annotation: SerializedAnnotation) => Promise<void>;

  constructor(
    annotationId: string,
    beforeState: SerializedAnnotation,
    afterState: SerializedAnnotation,
    context: Command['metadata']['context'],
    onUpdate: (annotation: SerializedAnnotation) => Promise<void>,
  ) {
    this.id = `update-${annotationId}-${Date.now()}`;
    this.description = `Update ${afterState.type} annotation`;
    this._annotationId = annotationId;
    this.beforeState = beforeState;
    this.afterState = afterState;
    this.onUpdate = onUpdate;
    this.metadata = {
      timestamp: new Date(),
      affectedAnnotations: [this._annotationId],
      context,
    };
  }

  async execute(): Promise<void> {
    await this.onUpdate(this.afterState);
  }

  async undo(): Promise<void> {
    await this.onUpdate(this.beforeState);
  }

  canUndo(): boolean {
    return true;
  }

  canRedo(): boolean {
    return true;
  }
}

/**
 * Delete annotation command
 */
export class DeleteAnnotationCommand implements Command {
  public readonly id: string;
  public readonly type = CommandType.DELETE_ANNOTATION;
  public readonly description: string;
  public readonly metadata: Command['metadata'];

  private annotation: SerializedAnnotation;
  private onDelete: (annotationId: string) => Promise<void>;
  private onRestore: (annotation: SerializedAnnotation) => Promise<void>;

  constructor(
    annotation: SerializedAnnotation,
    context: Command['metadata']['context'],
    onDelete: (annotationId: string) => Promise<void>,
    onRestore: (annotation: SerializedAnnotation) => Promise<void>,
  ) {
    this.id = `delete-${annotation.id}-${Date.now()}`;
    this.description = `Delete ${annotation.type} annotation`;
    this.annotation = annotation;
    this.onDelete = onDelete;
    this.onRestore = onRestore;
    this.metadata = {
      timestamp: new Date(),
      affectedAnnotations: [annotation.id],
      context,
    };
  }

  async execute(): Promise<void> {
    await this.onDelete(this.annotation.id);
  }

  async undo(): Promise<void> {
    await this.onRestore(this.annotation);
  }

  canUndo(): boolean {
    return true;
  }

  canRedo(): boolean {
    return true;
  }
}

/**
 * Batch command implementation
 */
export class BatchCommandImpl implements BatchCommand {
  public readonly id: string;
  public readonly type = CommandType.BATCH_OPERATION;
  public readonly description: string;
  public readonly metadata: Command['metadata'];
  public readonly commands: Command[];
  public readonly strategy: 'sequential' | 'parallel';

  constructor(
    commands: Command[],
    description: string,
    context: Command['metadata']['context'],
    strategy: 'sequential' | 'parallel' = 'sequential',
  ) {
    this.id = `batch-${Date.now()}`;
    this.description = description;
    this.commands = commands;
    this.strategy = strategy;

    const affectedAnnotations = commands.reduce((acc, cmd) => {
      return [...acc, ...cmd.metadata.affectedAnnotations];
    }, [] as string[]);

    this.metadata = {
      timestamp: new Date(),
      batchId: this.id,
      affectedAnnotations: Array.from(new Set(affectedAnnotations)),
      context,
    };

    // Update child commands with batch ID
    commands.forEach(cmd => {
      cmd.metadata.batchId = this.id;
    });
  }

  async execute(): Promise<void> {
    if (this.strategy === 'parallel') {
      await Promise.all(this.commands.map(cmd => cmd.execute()));
    } else {
      for (const command of this.commands) {
        await command.execute();
      }
    }
  }

  async undo(): Promise<void> {
    // Undo in reverse order
    const reverseCommands = [...this.commands].reverse();

    if (this.strategy === 'parallel') {
      await Promise.all(reverseCommands.map(cmd => cmd.undo()));
    } else {
      for (const command of reverseCommands) {
        await command.undo();
      }
    }
  }

  canUndo(): boolean {
    return this.commands.every(cmd => cmd.canUndo());
  }

  canRedo(): boolean {
    return this.commands.every(cmd => cmd.canRedo());
  }
}

/**
 * History entry
 */
export interface HistoryEntry {
  /** Command */
  command: Command;
  /** Entry state */
  state: 'executed' | 'undone';
  /** Index in history */
  index: number;
}

/**
 * Undo/Redo Manager
 */
export class UndoRedoManager {
  private static instance: UndoRedoManager;
  private config: UndoRedoConfig;
  private history: HistoryEntry[] = [];
  private currentIndex = -1;
  private snapshots: Map<string, AnnotationSnapshot[]> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();
  private pendingBatch: Command[] = [];
  private batchTimer?: NodeJS.Timeout;
  private isExecuting = false;

  private constructor(config?: Partial<UndoRedoConfig>) {
    this.config = {
      maxHistorySize: 100,
      maxBatchSize: 50,
      autoBatchTimeout: 1000,
      enableSelectiveUndo: false,
      enableCompression: true,
      excludedCommandTypes: [],
      viewportSpecificHistory: false,
      ...config,
    };

    log.info('↩️ Undo/Redo Manager initialized');
  }

  static getInstance(config?: Partial<UndoRedoConfig>): UndoRedoManager {
    if (!UndoRedoManager.instance) {
      UndoRedoManager.instance = new UndoRedoManager(config);
    }
    return UndoRedoManager.instance;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<UndoRedoConfig>): void {
    this.config = { ...this.config, ...config };

    // Trim history if max size changed
    this.trimHistory();

    log.info('↩️ Undo/Redo configuration updated');
  }

  /* =============================================================================
   * COMMAND EXECUTION
   * ============================================================================= */

  /**
   * Execute a command
   */
  async executeCommand(command: Command): Promise<void> {
    if (this.isExecuting) {
      log.warn('Command execution in progress, queuing command');
      return;
    }

    // Check if command type is excluded
    if (this.config.excludedCommandTypes.includes(command.type)) {
      await command.execute();
      return;
    }

    try {
      this.isExecuting = true;

      // Execute the command
      await command.execute();

      // Add to history
      this.addToHistory(command);

      // Create snapshot
      await this.createSnapshot(command);

      this.emit('commandExecuted', { command });
      log.info(`↩️ Executed command: ${command.description}`);

    } catch (error) {
      log.error('Failed to execute command:', {
        component: 'UndoRedoManager',
        metadata: { commandDescription: command.description },
      }, error as Error);
      this.emit('commandFailed', { command, error });
      throw error;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Execute multiple commands as a batch
   */
  async executeBatch(
    commands: Command[],
    description: string,
    context: Command['metadata']['context'],
    strategy: 'sequential' | 'parallel' = 'sequential',
  ): Promise<void> {
    if (commands.length === 0) return;

    if (commands.length > this.config.maxBatchSize) {
      throw new Error(`Batch size exceeds maximum: ${commands.length} > ${this.config.maxBatchSize}`);
    }

    const batchCommand = new BatchCommandImpl(commands, description, context, strategy);
    await this.executeCommand(batchCommand);
  }

  /**
   * Add command to pending batch
   */
  addToBatch(command: Command): void {
    this.pendingBatch.push(command);

    // Clear existing timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    // Set new timer
    this.batchTimer = setTimeout(() => {
      this.flushBatch();
    }, this.config.autoBatchTimeout);
  }

  /**
   * Flush pending batch
   */
  async flushBatch(): Promise<void> {
    if (this.pendingBatch.length === 0) return;

    const commands = [...this.pendingBatch];
    this.pendingBatch = [];

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    if (commands.length === 1) {
      await this.executeCommand(commands[0]);
    } else {
      const firstCommand = commands[0];
      await this.executeBatch(
        commands,
        `Batch operation (${commands.length} commands)`,
        firstCommand.metadata.context,
      );
    }
  }

  /* =============================================================================
   * UNDO/REDO OPERATIONS
   * ============================================================================= */

  /**
   * Undo the last command
   */
  async undo(): Promise<boolean> {
    if (!this.canUndo()) {
      return false;
    }

    try {
      this.isExecuting = true;

      const entry = this.history[this.currentIndex];
      await entry.command.undo();

      entry.state = 'undone';
      this.currentIndex--;

      this.emit('commandUndone', { command: entry.command });
      log.info(`↩️ Undone command: ${entry.command.description}`);

      return true;
    } catch (error) {
      const entry = this.history[this.currentIndex];
      log.error('Failed to undo command:', {
        component: 'UndoRedoManager',
        metadata: { commandDescription: entry?.command?.description || 'unknown' },
      }, error as Error);
      this.emit('undoFailed', { error });
      return false;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Redo the next command
   */
  async redo(): Promise<boolean> {
    if (!this.canRedo()) {
      return false;
    }

    try {
      this.isExecuting = true;

      const entry = this.history[this.currentIndex + 1];
      await entry.command.execute();

      entry.state = 'executed';
      this.currentIndex++;

      this.emit('commandRedone', { command: entry.command });
      log.info(`↩️ Redone command: ${entry.command.description}`);

      return true;
    } catch (error) {
      const entry = this.history[this.currentIndex + 1];
      log.error('Failed to redo command:', {
        component: 'UndoRedoManager',
        metadata: { commandDescription: entry?.command?.description || 'unknown' },
      }, error as Error);
      this.emit('redoFailed', { error });
      return false;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Undo multiple commands
   */
  async undoMultiple(count: number): Promise<number> {
    let undoneCount = 0;

    for (let i = 0; i < count && this.canUndo(); i++) {
      const success = await this.undo();
      if (success) {
        undoneCount++;
      } else {
        break;
      }
    }

    return undoneCount;
  }

  /**
   * Redo multiple commands
   */
  async redoMultiple(count: number): Promise<number> {
    let redoneCount = 0;

    for (let i = 0; i < count && this.canRedo(); i++) {
      const success = await this.redo();
      if (success) {
        redoneCount++;
      } else {
        break;
      }
    }

    return redoneCount;
  }

  /**
   * Selective undo - undo specific command
   */
  async selectiveUndo(commandId: string): Promise<boolean> {
    if (!this.config.enableSelectiveUndo) {
      log.warn('Selective undo is disabled');
      return false;
    }

    const entry = this.history.find(e => e.command.id === commandId);
    if (!entry || entry.state === 'undone') {
      return false;
    }

    try {
      this.isExecuting = true;

      await entry.command.undo();
      entry.state = 'undone';

      this.emit('selectiveUndo', { command: entry.command });
      log.info(`↩️ Selectively undone command: ${entry.command.description}`);

      return true;
    } catch (error) {
      log.error('Failed to selectively undo command:', {
        component: 'UndoRedoManager',
        metadata: { commandId },
      }, error as Error);
      return false;
    } finally {
      this.isExecuting = false;
    }
  }

  /* =============================================================================
   * HISTORY MANAGEMENT
   * ============================================================================= */

  /**
   * Add command to history
   */
  private addToHistory(command: Command): void {
    // Remove any commands after current index (they become invalid after new command)
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Add new entry
    const entry: HistoryEntry = {
      command,
      state: 'executed',
      index: this.history.length,
    };

    this.history.push(entry);
    this.currentIndex = this.history.length - 1;

    // Trim history if needed
    this.trimHistory();

    this.emit('historyChanged', {
      historySize: this.history.length,
      currentIndex: this.currentIndex,
    });
  }

  /**
   * Trim history to maximum size
   */
  private trimHistory(): void {
    if (this.history.length <= this.config.maxHistorySize) {
      return;
    }

    const excess = this.history.length - this.config.maxHistorySize;
    this.history = this.history.slice(excess);
    this.currentIndex = Math.max(0, this.currentIndex - excess);

    // Update indices
    this.history.forEach((entry, index) => {
      entry.index = index;
    });

    log.info(`↩️ Trimmed history: removed ${excess} entries`);
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    const clearedCount = this.history.length;
    this.history = [];
    this.currentIndex = -1;
    this.snapshots.clear();

    this.emit('historyCleared', { clearedCount });
    log.info(`↩️ Cleared history: ${clearedCount} entries`);
  }

  /**
   * Get history information
   */
  getHistoryInfo() {
    return {
      totalCommands: this.history.length,
      currentIndex: this.currentIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoCount: this.currentIndex + 1,
      redoCount: this.history.length - this.currentIndex - 1,
      lastCommand: this.history[this.currentIndex]?.command,
      nextCommand: this.history[this.currentIndex + 1]?.command,
    };
  }

  /**
   * Get command history
   */
  getCommandHistory(limit?: number): HistoryEntry[] {
    const history = limit ? this.history.slice(-limit) : this.history;
    return history.map(entry => ({ ...entry })); // Return copy
  }

  /* =============================================================================
   * SNAPSHOTS
   * ============================================================================= */

  /**
   * Create annotation snapshot
   */
  private async createSnapshot(command: Command): Promise<void> {
    for (const annotationId of command.metadata.affectedAnnotations) {
      try {
        // This would need integration with actual annotation storage
        // For now, create a placeholder snapshot
        const snapshot: AnnotationSnapshot = {
          annotation: {} as SerializedAnnotation, // Would be actual annotation data
          timestamp: new Date(),
          metadata: {
            commandId: command.id,
            commandType: command.type,
            isBeforeState: false,
          },
        };

        if (!this.snapshots.has(annotationId)) {
          this.snapshots.set(annotationId, []);
        }

        this.snapshots.get(annotationId)!.push(snapshot);

        // Limit snapshots per annotation
        const snapshots = this.snapshots.get(annotationId)!;
        if (snapshots.length > 20) {
          snapshots.shift();
        }

      } catch (error) {
        log.warn(`Failed to create snapshot for annotation ${annotationId}:`, {
          component: 'UndoRedoManager',
          metadata: { annotationId },
        }, error as Error);
      }
    }
  }

  /**
   * Get snapshots for annotation
   */
  getAnnotationSnapshots(annotationId: string): AnnotationSnapshot[] {
    return this.snapshots.get(annotationId) || [];
  }

  /* =============================================================================
   * UTILITY METHODS
   * ============================================================================= */

  /**
   * Check if undo is possible
   */
  canUndo(): boolean {
    return this.currentIndex >= 0 &&
           this.history[this.currentIndex]?.state === 'executed' &&
           this.history[this.currentIndex]?.command.canUndo();
  }

  /**
   * Check if redo is possible
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1 &&
           this.history[this.currentIndex + 1]?.state === 'undone' &&
           this.history[this.currentIndex + 1]?.command.canRedo();
  }

  /**
   * Get current state
   */
  getCurrentState() {
    return {
      historyLength: this.history.length,
      currentIndex: this.currentIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      pendingBatchSize: this.pendingBatch.length,
      isExecuting: this.isExecuting,
      config: this.config,
    };
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const commandCounts = new Map<CommandType, number>();
    const annotationCounts = new Map<string, number>();

    this.history.forEach(entry => {
      // Count by command type
      const currentCount = commandCounts.get(entry.command.type) || 0;
      commandCounts.set(entry.command.type, currentCount + 1);

      // Count by affected annotations
      entry.command.metadata.affectedAnnotations.forEach(annotationId => {
        const currentCount = annotationCounts.get(annotationId) || 0;
        annotationCounts.set(annotationId, currentCount + 1);
      });
    });

    return {
      totalCommands: this.history.length,
      executedCommands: this.history.filter(e => e.state === 'executed').length,
      undoneCommands: this.history.filter(e => e.state === 'undone').length,
      commandsByType: Object.fromEntries(commandCounts),
      totalSnapshots: Array.from(this.snapshots.values()).reduce((sum, snapshots) => sum + snapshots.length, 0),
      affectedAnnotations: annotationCounts.size,
      currentIndex: this.currentIndex,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    // Rough estimation in bytes
    let size = 0;

    // History entries
    size += this.history.length * 200; // Rough estimate per entry

    // Snapshots
    this.snapshots.forEach(snapshots => {
      size += snapshots.length * 1000; // Rough estimate per snapshot
    });

    return size;
  }

  /* =============================================================================
   * EVENT SYSTEM
   * ============================================================================= */

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          log.error(`Error in event listener for ${event}:`, {
            component: 'UndoRedoManager',
            metadata: { event },
          }, error as Error);
        }
      });
    }
  }
}

// Export singleton instance
export const undoRedoManager = UndoRedoManager.getInstance();
