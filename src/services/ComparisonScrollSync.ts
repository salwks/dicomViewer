/**
 * Comparison Scroll Synchronization Service
 * Enhanced scroll synchronization specifically designed for comparison workflows
 * Built with requestAnimationFrame for smooth performance and security compliance
 */

import { EventEmitter } from 'events';
import { ViewportSynchronizer, ViewportSynchronizerConfig } from './ViewportSynchronizer';
import { ViewportSyncState } from '../types/dicom';
import { log } from '../utils/logger';

export interface ComparisonScrollConfig extends ViewportSynchronizerConfig {
  enableSmoothing: boolean;
  smoothingFactor: number;
  enableInertia: boolean;
  inertiaDecay: number;
  enableStackAlignment: boolean;
  alignmentTolerance: number;
  enableCrossStudySync: boolean;
  maxSyncDistance: number;
}

export const DEFAULT_COMPARISON_SCROLL_CONFIG: ComparisonScrollConfig = {
  maxViewports: 16,
  syncDebounceMs: 16, // ~60fps
  enableCrossReference: true,
  strictModeValidation: true,
  enableSmoothing: true,
  smoothingFactor: 0.15,
  enableInertia: true,
  inertiaDecay: 0.92,
  enableStackAlignment: true,
  alignmentTolerance: 0.5,
  enableCrossStudySync: true,
  maxSyncDistance: 10,
};

export interface ScrollState {
  viewportId: string;
  currentIndex: number;
  totalImages: number;
  velocity: number;
  targetIndex: number;
  isAnimating: boolean;
  lastUpdateTime: number;
  stackPosition: number; // normalized position (0-1)
}

export interface CrossStudyMapping {
  sourceStudyUID: string;
  targetStudyUID: string;
  indexMapping: Map<number, number>; // source index -> target index
  alignmentType: 'anatomical' | 'position' | 'time';
  confidence: number;
}

export interface ComparisonScrollSyncEvents {
  'scroll-sync-started': [string, number]; // viewportId, targetIndex
  'scroll-sync-completed': [string, number]; // viewportId, finalIndex
  'scroll-velocity-changed': [string, number]; // viewportId, velocity
  'cross-study-mapped': [CrossStudyMapping];
  'alignment-detected': [string, string, number]; // sourceViewport, targetViewport, confidence
  'sync-error': [Error, string]; // error, viewportId
}

/**
 * Enhanced Scroll Synchronization for Comparison Mode
 * Provides smooth, frame-rate independent scrolling with cross-study alignment
 */
export class ComparisonScrollSync extends EventEmitter {
  private config: ComparisonScrollConfig;
  private baseSynchronizer: ViewportSynchronizer;
  private scrollStates: Map<string, ScrollState> = new Map();
  private crossStudyMappings: Map<string, CrossStudyMapping> = new Map();
  private animationFrameId: number | null = null;
  private syncGroups: Map<string, Set<string>> = new Map();
  private isScrolling: boolean = false;
  // private _scrollStartTime: number = 0; // Currently unused

  constructor(config: Partial<ComparisonScrollConfig> = {}, baseSynchronizer?: ViewportSynchronizer) {
    super();

    this.config = { ...DEFAULT_COMPARISON_SCROLL_CONFIG, ...config };
    this.baseSynchronizer = baseSynchronizer || new ViewportSynchronizer(this.config);

    this.initialize();
  }

  private initialize(): void {
    log.info('ComparisonScrollSync initializing', {
      component: 'ComparisonScrollSync',
      metadata: { config: this.config },
    });

    // Set up base synchronizer event forwarding
    this.setupBaseSynchronizerEvents();

    // Initialize default sync group
    this.syncGroups.set('comparison', new Set());

    log.info('ComparisonScrollSync initialized successfully', {
      component: 'ComparisonScrollSync',
    });
  }

  // ===== Viewport Management =====

  /**
   * Register a viewport for scroll synchronization
   */
  public registerViewport(viewportId: string, totalImages: number, initialIndex: number = 0, studyUID?: string): void {
    // Validate input parameters
    if (!viewportId || totalImages <= 0) {
      throw new Error('Invalid viewport parameters');
    }

    const scrollState: ScrollState = {
      viewportId,
      currentIndex: Math.max(0, Math.min(initialIndex, totalImages - 1)),
      totalImages,
      velocity: 0,
      targetIndex: initialIndex,
      isAnimating: false,
      lastUpdateTime: performance.now(),
      stackPosition: totalImages > 1 ? initialIndex / (totalImages - 1) : 0,
    };

    this.scrollStates.set(viewportId, scrollState);

    // Register with base synchronizer
    this.baseSynchronizer.addViewport(viewportId, {
      scrollIndex: scrollState.currentIndex,
    });

    // Add to default comparison group
    this.addViewportToSyncGroup(viewportId, 'comparison');

    // Generate cross-study mapping if studyUID provided
    if (studyUID) {
      this.generateCrossStudyMapping(viewportId, studyUID);
    }

    log.info('Viewport registered for scroll sync', {
      component: 'ComparisonScrollSync',
      metadata: { viewportId, totalImages, initialIndex, studyUID },
    });
  }

  /**
   * Unregister a viewport from scroll synchronization
   */
  public unregisterViewport(viewportId: string): void {
    // Remove from scroll states
    this.scrollStates.delete(viewportId);

    // Remove from all sync groups
    this.syncGroups.forEach(group => group.delete(viewportId));

    // Remove from base synchronizer
    this.baseSynchronizer.removeViewport(viewportId);

    // Clean up cross-study mappings
    const mappingKey = Array.from(this.crossStudyMappings.keys()).find(key => key.includes(viewportId));
    if (mappingKey) {
      this.crossStudyMappings.delete(mappingKey);
    }

    log.info('Viewport unregistered from scroll sync', {
      component: 'ComparisonScrollSync',
      metadata: { viewportId },
    });
  }

  // ===== Core Scroll Synchronization =====

  /**
   * Synchronize scroll position across viewports
   */
  public synchronizeScroll(sourceViewportId: string, targetIndex: number, immediately: boolean = false): void {
    const sourceState = this.scrollStates.get(sourceViewportId);
    if (!sourceState) {
      log.warn('Attempted to sync from unregistered viewport', {
        component: 'ComparisonScrollSync',
        metadata: { sourceViewportId },
      });
      return;
    }

    // Validate target index
    const clampedIndex = Math.max(0, Math.min(targetIndex, sourceState.totalImages - 1));
    if (clampedIndex !== targetIndex) {
      log.warn('Target index clamped to valid range', {
        component: 'ComparisonScrollSync',
        metadata: { sourceViewportId, requested: targetIndex, clamped: clampedIndex },
      });
    }

    // Update source state
    sourceState.targetIndex = clampedIndex;
    sourceState.lastUpdateTime = performance.now();

    if (immediately) {
      sourceState.currentIndex = clampedIndex;
      sourceState.velocity = 0;
      sourceState.isAnimating = false;
    } else {
      sourceState.isAnimating = true;
      // Calculate initial velocity for smooth animation
      const distance = clampedIndex - sourceState.currentIndex;
      sourceState.velocity = distance * this.config.smoothingFactor;
    }

    // Update normalized stack position
    sourceState.stackPosition = sourceState.totalImages > 1 ? clampedIndex / (sourceState.totalImages - 1) : 0;

    // Emit sync started event
    this.emit('scroll-sync-started', sourceViewportId, clampedIndex);

    // Find and sync target viewports
    this.syncTargetViewports(sourceViewportId, immediately);

    // Start animation loop if needed
    if (!immediately && !this.isScrolling) {
      this.startScrollAnimation();
    }

    // Update base synchronizer
    this.baseSynchronizer.updateViewportState(
      sourceViewportId,
      {
        scrollIndex: immediately ? clampedIndex : sourceState.currentIndex,
      },
      false,
    ); // Don't trigger base sync to avoid loops
  }

  /**
   * Get current scroll position for a viewport
   */
  public getScrollPosition(viewportId: string): number | null {
    const state = this.scrollStates.get(viewportId);
    return state ? state.currentIndex : null;
  }

  /**
   * Get normalized stack position (0-1) for a viewport
   */
  public getStackPosition(viewportId: string): number | null {
    const state = this.scrollStates.get(viewportId);
    return state ? state.stackPosition : null;
  }

  // ===== Sync Group Management =====

  /**
   * Create a new synchronization group
   */
  public createSyncGroup(groupId: string, viewportIds: string[] = []): void {
    if (this.syncGroups.has(groupId)) {
      log.warn('Sync group already exists', {
        component: 'ComparisonScrollSync',
        metadata: { groupId },
      });
      return;
    }

    const group = new Set<string>();
    viewportIds.forEach(id => {
      if (this.scrollStates.has(id)) {
        group.add(id);
      }
    });

    this.syncGroups.set(groupId, group);

    log.info('Scroll sync group created', {
      component: 'ComparisonScrollSync',
      metadata: { groupId, viewportCount: group.size },
    });
  }

  /**
   * Add viewport to sync group
   */
  public addViewportToSyncGroup(viewportId: string, groupId: string): void {
    if (!this.scrollStates.has(viewportId)) {
      log.warn('Cannot add unregistered viewport to sync group', {
        component: 'ComparisonScrollSync',
        metadata: { viewportId, groupId },
      });
      return;
    }

    let group = this.syncGroups.get(groupId);
    if (!group) {
      group = new Set();
      this.syncGroups.set(groupId, group);
    }

    group.add(viewportId);

    log.info('Viewport added to scroll sync group', {
      component: 'ComparisonScrollSync',
      metadata: { viewportId, groupId },
    });
  }

  /**
   * Remove viewport from sync group
   */
  public removeViewportFromSyncGroup(viewportId: string, groupId: string): void {
    const group = this.syncGroups.get(groupId);
    if (group) {
      group.delete(viewportId);

      // Remove empty groups (except default comparison group)
      if (group.size === 0 && groupId !== 'comparison') {
        this.syncGroups.delete(groupId);
      }
    }
  }

  // ===== Animation System =====

  /**
   * Start smooth scroll animation loop using requestAnimationFrame
   */
  private startScrollAnimation(): void {
    if (this.isScrolling) return;

    this.isScrolling = true;
    // this._scrollStartTime = performance.now(); // Currently unused
    this.animateScroll();
  }

  /**
   * Main animation loop for smooth scrolling
   */
  private animateScroll(): void {
    const currentTime = performance.now();
    let hasActiveAnimations = false;

    // Update each animating viewport
    this.scrollStates.forEach((state, viewportId) => {
      if (!state.isAnimating) return;

      // const _deltaTime = currentTime - state.lastUpdateTime; // Currently unused
      state.lastUpdateTime = currentTime;

      // Calculate smooth movement towards target
      const distance = state.targetIndex - state.currentIndex;

      if (Math.abs(distance) < 0.01) {
        // Close enough to target, snap to final position
        state.currentIndex = state.targetIndex;
        state.velocity = 0;
        state.isAnimating = false;

        // Update stack position
        state.stackPosition = state.totalImages > 1 ? state.currentIndex / (state.totalImages - 1) : 0;

        // Emit completion event
        this.emit('scroll-sync-completed', viewportId, state.targetIndex);

        // Update base synchronizer with final position
        this.baseSynchronizer.updateViewportState(
          viewportId,
          {
            scrollIndex: state.currentIndex,
          },
          false,
        );
      } else {
        hasActiveAnimations = true;

        // Apply smoothing
        if (this.config.enableSmoothing) {
          state.velocity = distance * this.config.smoothingFactor;
        } else {
          state.velocity = distance > 0 ? 1 : -1;
        }

        // Apply inertia
        if (this.config.enableInertia) {
          state.velocity *= this.config.inertiaDecay;
        }

        // Update position
        state.currentIndex += state.velocity;

        // Update stack position
        state.stackPosition = state.totalImages > 1 ? state.currentIndex / (state.totalImages - 1) : 0;

        // Emit velocity change event
        this.emit('scroll-velocity-changed', viewportId, state.velocity);

        // Update base synchronizer with current position
        this.baseSynchronizer.updateViewportState(
          viewportId,
          {
            scrollIndex: state.currentIndex,
          },
          false,
        );
      }
    });

    // Continue animation if there are active animations
    if (hasActiveAnimations) {
      this.animationFrameId = requestAnimationFrame(() => this.animateScroll());
    } else {
      this.stopScrollAnimation();
    }
  }

  /**
   * Stop scroll animation loop
   */
  private stopScrollAnimation(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isScrolling = false;
  }

  // ===== Target Viewport Synchronization =====

  /**
   * Synchronize target viewports based on sync groups and cross-study mappings
   */
  private syncTargetViewports(sourceViewportId: string, immediately: boolean): void {
    const sourceState = this.scrollStates.get(sourceViewportId);
    if (!sourceState) return;

    // Find target viewports in same sync groups
    const targetViewports = new Set<string>();

    this.syncGroups.forEach(group => {
      if (group.has(sourceViewportId)) {
        group.forEach(viewportId => {
          if (viewportId !== sourceViewportId) {
            targetViewports.add(viewportId);
          }
        });
      }
    });

    // Sync each target viewport
    targetViewports.forEach(targetViewportId => {
      this.syncSingleTarget(sourceState, targetViewportId, immediately);
    });
  }

  /**
   * Synchronize a single target viewport
   */
  private syncSingleTarget(sourceState: ScrollState, targetViewportId: string, immediately: boolean): void {
    const targetState = this.scrollStates.get(targetViewportId);
    if (!targetState) return;

    let targetIndex: number;

    // Check for cross-study mapping
    const mappingKey = this.findCrossStudyMapping(sourceState.viewportId, targetViewportId);
    if (mappingKey && this.config.enableCrossStudySync) {
      const mapping = this.crossStudyMappings.get(mappingKey);
      if (mapping) {
        const mappedIndex = mapping.indexMapping.get(
          Math.round(sourceState.stackPosition * (sourceState.totalImages - 1)),
        );
        targetIndex = mappedIndex ?? this.calculatePositionBasedIndex(sourceState, targetState);
      } else {
        targetIndex = this.calculatePositionBasedIndex(sourceState, targetState);
      }
    } else {
      // Use normalized position for sync
      targetIndex = this.calculatePositionBasedIndex(sourceState, targetState);
    }

    // Apply synchronization
    this.synchronizeScroll(targetViewportId, targetIndex, immediately);
  }

  /**
   * Calculate target index based on normalized stack position
   */
  private calculatePositionBasedIndex(sourceState: ScrollState, targetState: ScrollState): number {
    if (targetState.totalImages <= 1) return 0;

    return Math.round(sourceState.stackPosition * (targetState.totalImages - 1));
  }

  // ===== Cross-Study Mapping =====

  /**
   * Generate cross-study mapping between different studies
   */
  private generateCrossStudyMapping(viewportId: string, studyUID: string): void {
    // This is a placeholder for cross-study mapping logic
    // In a real implementation, this would analyze study metadata
    // and generate intelligent mappings based on anatomy, position, or time

    log.info('Cross-study mapping placeholder', {
      component: 'ComparisonScrollSync',
      metadata: { viewportId, studyUID },
    });
  }

  /**
   * Find cross-study mapping key for two viewports
   */
  private findCrossStudyMapping(viewport1: string, viewport2: string): string | null {
    const keys = Array.from(this.crossStudyMappings.keys());
    return (
      keys.find(
        key =>
          (key.includes(viewport1) && key.includes(viewport2)) || (key.includes(viewport2) && key.includes(viewport1)),
      ) || null
    );
  }

  // ===== Base Synchronizer Integration =====

  /**
   * Set up event forwarding from base synchronizer
   */
  private setupBaseSynchronizerEvents(): void {
    this.baseSynchronizer.on('viewportStateUpdated', (data: { viewportId: string; state: ViewportSyncState }) => {
      // Handle external scroll updates
      if (data.state.scrollIndex !== undefined) {
        const scrollState = this.scrollStates.get(data.viewportId);
        if (scrollState && Math.abs(scrollState.currentIndex - data.state.scrollIndex) > 0.1) {
          // External scroll detected, update our state
          this.synchronizeScroll(data.viewportId, data.state.scrollIndex, true);
        }
      }
    });
  }

  // ===== Utility Methods =====

  /**
   * Get all registered viewports
   */
  public getRegisteredViewports(): string[] {
    return Array.from(this.scrollStates.keys());
  }

  /**
   * Get sync groups
   */
  public getSyncGroups(): Map<string, Set<string>> {
    return new Map(this.syncGroups);
  }

  /**
   * Check if viewport is currently animating
   */
  public isViewportAnimating(viewportId: string): boolean {
    const state = this.scrollStates.get(viewportId);
    return state ? state.isAnimating : false;
  }

  // ===== Cleanup =====

  /**
   * Dispose of resources and clean up
   */
  public dispose(): void {
    // Stop animation
    this.stopScrollAnimation();

    // Clear all states
    this.scrollStates.clear();
    this.syncGroups.clear();
    this.crossStudyMappings.clear();

    // Dispose base synchronizer
    this.baseSynchronizer.destroy();

    // Remove all listeners
    this.removeAllListeners();

    log.info('ComparisonScrollSync disposed', {
      component: 'ComparisonScrollSync',
    });
  }
}

// Create singleton instance for comparison workflows
export const comparisonScrollSync = new ComparisonScrollSync();
