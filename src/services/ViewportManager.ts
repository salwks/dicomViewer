/**
 * Enhanced Viewport Manager Service
 * Advanced viewport state management with synchronization integration
 * Built on top of ViewportStateManager with additional features
 */

import { EventEmitter } from 'events';
import { viewportStateManager } from './viewportStateManager';
import { viewportSynchronizer } from './ViewportSynchronizer';
import { ViewportState, ViewportStateUpdate } from '../types/viewportState';
import { ViewportSyncState } from '../types/dicom';
import { log } from '../utils/logger';

export interface ViewportManagerConfig {
  maxViewports: number;
  enableSynchronization: boolean;
  enablePersistence: boolean;
  autoCleanup: boolean;
  defaultViewportType: 'stack' | 'volume' | 'multiplanar';
}

export const DEFAULT_VIEWPORT_MANAGER_CONFIG: ViewportManagerConfig = {
  maxViewports: 16,
  enableSynchronization: true,
  enablePersistence: true,
  autoCleanup: true,
  defaultViewportType: 'stack',
};

export interface ViewportManagerEvents {
  'viewport-created': [string, ViewportState];
  'viewport-removed': [string];
  'viewport-updated': [string, ViewportState];
  'viewport-activated': [string];
  'viewport-synchronized': [string, ViewportSyncState];
  'layout-changed': [ViewportLayout];
  'manager-error': [Error, string];
}

export interface ViewportLayout {
  id: string;
  name: string;
  viewportIds: string[];
  rows: number;
  columns: number;
  isActive: boolean;
}

export interface ViewportMetrics {
  totalViewports: number;
  activeViewports: number;
  synchronizedViewports: number;
  memoryUsageBytes: number;
  averageUpdateTime: number;
}

export class ViewportManager extends EventEmitter {
  private config: ViewportManagerConfig;
  private layouts: Map<string, ViewportLayout> = new Map();
  private activeLayout: string | null = null;
  private performanceMetrics: Map<string, number[]> = new Map();
  private cleanupIntervalId: NodeJS.Timeout | null = null;

  constructor(config: Partial<ViewportManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_VIEWPORT_MANAGER_CONFIG, ...config };

    this.initialize();
  }

  private initialize(): void {
    log.info('ViewportManager initializing', {
      component: 'ViewportManager',
      metadata: { config: this.config },
    });

    // Listen to state manager events
    viewportStateManager.on('state-updated', this.handleStateUpdate.bind(this));
    viewportStateManager.on('viewport-activated', this.handleViewportActivated.bind(this));
    viewportStateManager.on('viewport-deactivated', this.handleViewportDeactivated.bind(this));

    // Listen to synchronizer events if enabled
    if (this.config.enableSynchronization) {
      viewportSynchronizer.on('viewportAdded', this.handleSynchronizerViewportAdded.bind(this));
      viewportSynchronizer.on('viewportRemoved', this.handleSynchronizerViewportRemoved.bind(this));
      viewportSynchronizer.on('viewportStateUpdated', this.handleSynchronizerStateUpdate.bind(this));
    }

    // Setup auto-cleanup if enabled
    if (this.config.autoCleanup) {
      this.setupAutoCleanup();
    }

    // Create default layout
    this.createLayout('default', 'Default Layout', 2, 2);
  }

  // ===== Viewport Management =====

  public createViewport(
    viewportId: string,
    type?: ViewportState['type'],
    initialState?: ViewportStateUpdate,
  ): ViewportState {
    // Check viewport limit
    if (this.getViewportCount() >= this.config.maxViewports) {
      throw new Error(`Maximum viewport limit (${this.config.maxViewports}) reached`);
    }

    const startTime = Date.now();

    try {
      // Create viewport in state manager
      const state = viewportStateManager.createViewport(
        viewportId,
        type || this.config.defaultViewportType,
        initialState,
      );

      // Register with synchronizer if enabled
      if (this.config.enableSynchronization) {
        this.registerWithSynchronizer(viewportId, state);
      }

      // Track performance
      this.trackPerformance('create', Date.now() - startTime);

      this.emit('viewport-created', viewportId, state);

      log.info('Viewport created via ViewportManager', {
        component: 'ViewportManager',
        metadata: { viewportId, type: state.type },
      });

      return state;
    } catch (error) {
      this.emit('manager-error', error as Error, 'create-viewport');
      throw error;
    }
  }

  public updateViewport(viewportId: string, updates: ViewportStateUpdate): ViewportState {
    const startTime = Date.now();

    try {
      // Update in state manager
      const updatedState = viewportStateManager.updateViewportState(viewportId, updates);

      // Sync with synchronizer if enabled
      if (this.config.enableSynchronization) {
        this.syncWithSynchronizer(viewportId, updatedState);
      }

      // Track performance
      this.trackPerformance('update', Date.now() - startTime);

      this.emit('viewport-updated', viewportId, updatedState);

      return updatedState;
    } catch (error) {
      this.emit('manager-error', error as Error, 'update-viewport');
      throw error;
    }
  }

  public removeViewport(viewportId: string): boolean {
    try {
      // Remove from synchronizer first
      if (this.config.enableSynchronization) {
        viewportSynchronizer.removeViewport(viewportId);
      }

      // Remove from state manager
      const removed = viewportStateManager.removeViewport(viewportId);

      if (removed) {
        // Remove from all layouts
        this.removeViewportFromLayouts(viewportId);

        this.emit('viewport-removed', viewportId);

        log.info('Viewport removed via ViewportManager', {
          component: 'ViewportManager',
          metadata: { viewportId },
        });
      }

      return removed;
    } catch (error) {
      this.emit('manager-error', error as Error, 'remove-viewport');
      throw error;
    }
  }

  public getViewport(viewportId: string): ViewportState | null {
    return viewportStateManager.getViewportState(viewportId);
  }

  public getAllViewports(): Map<string, ViewportState> {
    return viewportStateManager.getViewports();
  }

  public getViewportCount(): number {
    return viewportStateManager.getViewportCount();
  }

  public hasViewport(viewportId: string): boolean {
    return viewportStateManager.hasViewport(viewportId);
  }

  public getViewportIds(): string[] {
    return viewportStateManager.getViewportIds();
  }

  // ===== Layout Management =====

  public createLayout(
    layoutId: string,
    name: string,
    rows: number,
    columns: number,
    viewportIds?: string[],
  ): ViewportLayout {
    if (rows < 1 || columns < 1) {
      throw new Error('Layout must have at least 1 row and 1 column');
    }

    if (rows * columns > this.config.maxViewports) {
      throw new Error(`Layout size (${rows}x${columns}) exceeds maximum viewports`);
    }

    const layout: ViewportLayout = {
      id: layoutId,
      name,
      viewportIds: viewportIds || [],
      rows,
      columns,
      isActive: false,
    };

    this.layouts.set(layoutId, layout);

    log.info('Layout created', {
      component: 'ViewportManager',
      metadata: { layoutId, name, rows, columns },
    });

    return layout;
  }

  public setActiveLayout(layoutId: string): ViewportLayout {
    const layout = this.layouts.get(layoutId);
    if (!layout) {
      throw new Error(`Layout not found: ${layoutId}`);
    }

    // Deactivate previous layout
    if (this.activeLayout) {
      const prevLayout = this.layouts.get(this.activeLayout);
      if (prevLayout) {
        prevLayout.isActive = false;
      }
    }

    // Activate new layout
    layout.isActive = true;
    this.activeLayout = layoutId;

    // Create viewports for layout if they don't exist
    this.ensureLayoutViewports(layout);

    this.emit('layout-changed', layout);

    log.info('Active layout changed', {
      component: 'ViewportManager',
      metadata: { layoutId, viewportCount: layout.viewportIds.length },
    });

    return layout;
  }

  public getLayout(layoutId: string): ViewportLayout | null {
    return this.layouts.get(layoutId) || null;
  }

  public getActiveLayout(): ViewportLayout | null {
    return this.activeLayout ? this.layouts.get(this.activeLayout) || null : null;
  }

  public getAllLayouts(): ViewportLayout[] {
    return Array.from(this.layouts.values());
  }

  private ensureLayoutViewports(layout: ViewportLayout): void {
    const requiredViewports = layout.rows * layout.columns;

    // Generate viewport IDs if not provided
    if (layout.viewportIds.length === 0) {
      for (let i = 0; i < requiredViewports; i++) {
        const viewportId = `${layout.id}-viewport-${i}`;
        layout.viewportIds.push(viewportId);
      }
    }

    // Create missing viewports
    layout.viewportIds.forEach(viewportId => {
      if (!this.hasViewport(viewportId)) {
        this.createViewport(viewportId);
      }
    });
  }

  private removeViewportFromLayouts(viewportId: string): void {
    this.layouts.forEach(layout => {
      const index = layout.viewportIds.indexOf(viewportId);
      if (index !== -1) {
        layout.viewportIds.splice(index, 1);
      }
    });
  }

  // ===== Synchronization Integration =====

  private registerWithSynchronizer(viewportId: string, state: ViewportState): void {
    const syncState: Partial<ViewportSyncState> = {
      windowCenter: state.windowLevel?.center || 128,
      windowWidth: state.windowLevel?.width || 256,
      zoom: state.transform?.zoom || 1.0,
      pan: [state.transform?.pan?.x || 0, state.transform?.pan?.y || 0],
      scrollIndex: 0,
    };

    viewportSynchronizer.addViewport(viewportId, syncState);
  }

  private syncWithSynchronizer(viewportId: string, state: ViewportState): void {
    const updates: Partial<ViewportSyncState> = {};

    if (state.windowLevel) {
      updates.windowCenter = state.windowLevel.center;
      updates.windowWidth = state.windowLevel.width;
    }

    if (state.transform) {
      updates.zoom = state.transform.zoom;
      updates.pan = [state.transform.pan?.x || 0, state.transform.pan?.y || 0];
    }

    if (Object.keys(updates).length > 0) {
      viewportSynchronizer.updateViewportState(viewportId, updates, true);
    }
  }

  // ===== Event Handlers =====

  private handleStateUpdate(viewportId: string, state: ViewportState): void {
    this.emit('viewport-updated', viewportId, state);
  }

  private handleViewportActivated(viewportId: string): void {
    this.emit('viewport-activated', viewportId);
  }

  private handleViewportDeactivated(_viewportId: string): void {
    // Handle deactivation if needed
  }

  private handleSynchronizerViewportAdded({ viewportId }: { viewportId: string }): void {
    log.info('Viewport added to synchronizer', {
      component: 'ViewportManager',
      metadata: { viewportId },
    });
  }

  private handleSynchronizerViewportRemoved({ viewportId }: { viewportId: string }): void {
    log.info('Viewport removed from synchronizer', {
      component: 'ViewportManager',
      metadata: { viewportId },
    });
  }

  private handleSynchronizerStateUpdate({ viewportId, state }: { viewportId: string; state: ViewportSyncState }): void {
    this.emit('viewport-synchronized', viewportId, state);
  }

  // ===== Performance Tracking =====

  private trackPerformance(operation: string, timeMs: number): void {
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, []);
    }

    const metrics = this.performanceMetrics.get(operation)!;
    metrics.push(timeMs);

    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  public getPerformanceMetrics(): ViewportMetrics {
    const allViewports = this.getAllViewports();
    const syncStates = viewportSynchronizer.getAllViewportStates();

    const updateTimes = this.performanceMetrics.get('update') || [];
    const averageUpdateTime = updateTimes.length > 0 ? updateTimes.reduce((a, b) => a + b, 0) / updateTimes.length : 0;

    // Rough memory estimation
    const memoryUsageBytes = allViewports.size * 1024; // Rough estimate per viewport

    return {
      totalViewports: allViewports.size,
      activeViewports: Array.from(allViewports.values()).filter(v => v.activation.isActive).length,
      synchronizedViewports: syncStates.size,
      memoryUsageBytes,
      averageUpdateTime,
    };
  }

  // ===== Auto Cleanup =====

  private setupAutoCleanup(): void {
    this.cleanupIntervalId = setInterval(
      () => {
        this.performCleanup();
      },
      5 * 60 * 1000,
    ); // Every 5 minutes
  }

  private performCleanup(): void {
    const metrics = this.getPerformanceMetrics();

    log.info('Performing viewport cleanup', {
      component: 'ViewportManager',
      metadata: { metrics },
    });

    // Clear old performance metrics
    this.performanceMetrics.forEach((times, operation) => {
      if (times.length > 50) {
        this.performanceMetrics.set(operation, times.slice(-50));
      }
    });
  }

  // ===== Utility Methods =====

  public resetViewport(viewportId: string): ViewportState {
    const state = this.getViewport(viewportId);
    if (!state) {
      throw new Error(`Viewport not found: ${viewportId}`);
    }

    // Reset to default state
    const resetUpdates: ViewportStateUpdate = {
      camera: {
        position: [0, 0, 0],
        focalPoint: [0, 0, 0],
        viewUp: [0, 1, 0],
        parallelScale: 300,
        parallelProjection: true,
      },
      windowLevel: {
        center: 128,
        width: 256,
      },
      transform: {
        zoom: 1.0,
        pan: { x: 0, y: 0 },
        rotation: 0,
      },
    };

    return this.updateViewport(viewportId, resetUpdates);
  }

  public resetAllViewports(): void {
    this.getViewportIds().forEach(viewportId => {
      try {
        this.resetViewport(viewportId);
      } catch (error) {
        log.error(
          'Failed to reset viewport',
          {
            component: 'ViewportManager',
            metadata: { viewportId },
          },
          error as Error,
        );
      }
    });
  }

  // ===== Cleanup =====

  public dispose(): void {
    // Clear cleanup interval
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }

    // Clear layouts
    this.layouts.clear();
    this.activeLayout = null;

    // Clear performance metrics
    this.performanceMetrics.clear();

    // Remove all listeners
    this.removeAllListeners();

    log.info('ViewportManager disposed', {
      component: 'ViewportManager',
    });
  }
}

// Singleton instance
export const viewportManager = new ViewportManager();
