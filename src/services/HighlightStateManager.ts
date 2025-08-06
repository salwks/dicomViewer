/**
 * Highlight State Manager
 * Manages state and transitions for annotation highlights
 * Task 34.4: Create Highlight State Manager
 */

import { EventEmitter } from 'events';
import { log } from '../utils/logger';
// import { AnnotationCompat } from '../types/annotation-compat'; // Currently unused

export interface HighlightState {
  id: string;
  annotationId: string;
  viewportId: string;
  state: 'inactive' | 'active' | 'transitioning' | 'error';
  style: HighlightStyle;
  animation?: HighlightAnimation;
  metadata: {
    createdAt: number;
    lastUpdated: number;
    transitionCount: number;
    errorCount: number;
  };
}

export interface HighlightStyle {
  color: string;
  thickness: number;
  opacity: number;
  glowRadius: number;
  pulseEnabled: boolean;
  pulseSpeed: number;
  pattern?: 'solid' | 'dashed' | 'dotted';
  shadowEnabled?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
}

export interface HighlightAnimation {
  type: 'pulse' | 'glow' | 'fade' | 'scale' | 'rotate';
  duration: number;
  iterations: number | 'infinite';
  direction: 'normal' | 'reverse' | 'alternate';
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  startTime: number;
  progress: number;
  isPlaying: boolean;
}

export interface StateTransition {
  id: string;
  fromState: HighlightState['state'];
  toState: HighlightState['state'];
  timestamp: number;
  duration: number;
  reason: string;
  success: boolean;
  error?: string;
}

export interface HighlightStateManagerConfig {
  maxStates: number;
  defaultStyle: HighlightStyle;
  transitionDuration: number;
  enableAnimations: boolean;
  enableBatching: boolean;
  batchSize: number;
  cleanupInterval: number;
  retentionPeriod: number;
}

export const DEFAULT_HIGHLIGHT_STATE_CONFIG: HighlightStateManagerConfig = {
  maxStates: 1000,
  defaultStyle: {
    color: '#87CEEB', // Sky blue as specified
    thickness: 3,
    opacity: 0.8,
    glowRadius: 8,
    pulseEnabled: true,
    pulseSpeed: 2000, // 2 second pulse cycle
    pattern: 'solid',
    shadowEnabled: true,
    shadowColor: 'rgba(135, 206, 235, 0.3)',
    shadowBlur: 4,
  },
  transitionDuration: 300, // 300ms transitions
  enableAnimations: true,
  enableBatching: true,
  batchSize: 10,
  cleanupInterval: 60000, // 1 minute
  retentionPeriod: 300000, // 5 minutes
};

export class HighlightStateManager extends EventEmitter {
  private readonly config: HighlightStateManagerConfig;
  private readonly states = new Map<string, HighlightState>();
  private readonly transitions: StateTransition[] = [];
  private readonly animationFrames = new Map<string, number>();
  private readonly batchQueue: (() => void)[] = [];

  private cleanupTimer: NodeJS.Timeout | null = null;
  private batchTimer: NodeJS.Timeout | null = null;
  private isProcessingBatch = false;

  constructor(config: Partial<HighlightStateManagerConfig> = {}) {
    super();

    this.config = { ...DEFAULT_HIGHLIGHT_STATE_CONFIG, ...config };

    this.initialize();
  }

  private initialize(): void {
    log.info('HighlightStateManager initializing', {
      component: 'HighlightStateManager',
      metadata: {
        maxStates: this.config.maxStates,
        enableAnimations: this.config.enableAnimations,
        enableBatching: this.config.enableBatching,
      },
    });

    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);

    this.emit('initialized');
  }

  /**
   * Create a new highlight state
   */
  createHighlightState(annotationId: string, viewportId: string, style: Partial<HighlightStyle> = {}): string {
    const stateId = this.generateStateId();

    const highlightState: HighlightState = {
      id: stateId,
      annotationId,
      viewportId,
      state: 'inactive',
      style: { ...this.config.defaultStyle, ...style },
      metadata: {
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        transitionCount: 0,
        errorCount: 0,
      },
    };

    // Check capacity
    if (this.states.size >= this.config.maxStates) {
      this.evictOldestState();
    }

    this.states.set(stateId, highlightState);

    this.emit('state-created', highlightState);

    log.info('Highlight state created', {
      component: 'HighlightStateManager',
      metadata: {
        stateId,
        annotationId,
        viewportId,
        totalStates: this.states.size,
      },
    });

    return stateId;
  }

  /**
   * Activate highlight state
   */
  activateState(stateId: string, animation?: Partial<HighlightAnimation>): boolean {
    const state = this.states.get(stateId);
    if (!state) {
      log.warn('Cannot activate non-existent state', {
        component: 'HighlightStateManager',
        metadata: { stateId },
      });
      return false;
    }

    return this.transitionState(stateId, 'active', 'user-activation', animation);
  }

  /**
   * Deactivate highlight state
   */
  deactivateState(stateId: string): boolean {
    const state = this.states.get(stateId);
    if (!state) {
      log.warn('Cannot deactivate non-existent state', {
        component: 'HighlightStateManager',
        metadata: { stateId },
      });
      return false;
    }

    return this.transitionState(stateId, 'inactive', 'user-deactivation');
  }

  /**
   * Update highlight style
   */
  updateStyle(stateId: string, styleUpdate: Partial<HighlightStyle>): boolean {
    const state = this.states.get(stateId);
    if (!state) return false;

    const operation = () => {
      state.style = { ...state.style, ...styleUpdate };
      state.metadata.lastUpdated = Date.now();

      this.emit('style-updated', state, styleUpdate);

      log.info('Highlight style updated', {
        component: 'HighlightStateManager',
        metadata: { stateId, styleUpdate },
      });
    };

    if (this.config.enableBatching) {
      this.queueBatchOperation(operation);
    } else {
      operation();
    }

    return true;
  }

  /**
   * Start animation for highlight state
   */
  startAnimation(stateId: string, animation: Partial<HighlightAnimation>): boolean {
    const state = this.states.get(stateId);
    if (!state || !this.config.enableAnimations) return false;

    const fullAnimation: HighlightAnimation = {
      type: 'pulse',
      duration: 1000,
      iterations: 'infinite',
      direction: 'alternate',
      easing: 'ease-in-out',
      startTime: Date.now(),
      progress: 0,
      isPlaying: true,
      ...animation,
    };

    state.animation = fullAnimation;
    state.metadata.lastUpdated = Date.now();

    // Start animation loop
    this.startAnimationLoop(stateId);

    this.emit('animation-started', state, fullAnimation);

    log.info('Animation started', {
      component: 'HighlightStateManager',
      metadata: { stateId, animationType: fullAnimation.type },
    });

    return true;
  }

  /**
   * Stop animation for highlight state
   */
  stopAnimation(stateId: string): boolean {
    const state = this.states.get(stateId);
    if (!state || !state.animation) return false;

    state.animation.isPlaying = false;

    // Cancel animation frame
    const frameId = this.animationFrames.get(stateId);
    if (frameId) {
      cancelAnimationFrame(frameId);
      this.animationFrames.delete(stateId);
    }

    this.emit('animation-stopped', state);

    log.info('Animation stopped', {
      component: 'HighlightStateManager',
      metadata: { stateId },
    });

    return true;
  }

  /**
   * Get all states for a viewport
   */
  getViewportStates(viewportId: string): HighlightState[] {
    return Array.from(this.states.values()).filter(state => state.viewportId === viewportId);
  }

  /**
   * Get all states for an annotation
   */
  getAnnotationStates(annotationId: string): HighlightState[] {
    return Array.from(this.states.values()).filter(state => state.annotationId === annotationId);
  }

  /**
   * Get active states
   */
  getActiveStates(): HighlightState[] {
    return Array.from(this.states.values()).filter(state => state.state === 'active');
  }

  /**
   * Get state by ID
   */
  getState(stateId: string): HighlightState | undefined {
    return this.states.get(stateId);
  }

  /**
   * Remove highlight state
   */
  removeState(stateId: string): boolean {
    const state = this.states.get(stateId);
    if (!state) return false;

    // Stop any running animation
    this.stopAnimation(stateId);

    // Remove state
    this.states.delete(stateId);

    this.emit('state-removed', stateId);

    log.info('Highlight state removed', {
      component: 'HighlightStateManager',
      metadata: { stateId, remainingStates: this.states.size },
    });

    return true;
  }

  /**
   * Clear all states for a viewport
   */
  clearViewportStates(viewportId: string): number {
    const statesToRemove = this.getViewportStates(viewportId);
    let removed = 0;

    statesToRemove.forEach(state => {
      if (this.removeState(state.id)) {
        removed++;
      }
    });

    log.info('Viewport states cleared', {
      component: 'HighlightStateManager',
      metadata: { viewportId, removed },
    });

    return removed;
  }

  /**
   * Get state statistics
   */
  getStatistics(): {
    totalStates: number;
    activeStates: number;
    animatingStates: number;
    transitioningStates: number;
    errorStates: number;
    totalTransitions: number;
    recentTransitions: number;
    memoryUsage: number;
    } {
    const states = Array.from(this.states.values());
    const now = Date.now();
    const recentThreshold = now - 60000; // Last minute

    return {
      totalStates: states.length,
      activeStates: states.filter(s => s.state === 'active').length,
      animatingStates: states.filter(s => s.animation?.isPlaying).length,
      transitioningStates: states.filter(s => s.state === 'transitioning').length,
      errorStates: states.filter(s => s.state === 'error').length,
      totalTransitions: this.transitions.length,
      recentTransitions: this.transitions.filter(t => t.timestamp > recentThreshold).length,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  // ===== Private Implementation =====

  private transitionState(
    stateId: string,
    toState: HighlightState['state'],
    reason: string,
    animation?: Partial<HighlightAnimation>,
  ): boolean {
    const state = this.states.get(stateId);
    if (!state) return false;

    const fromState = state.state;
    const transitionId = this.generateTransitionId();
    const startTime = Date.now();

    // Create transition record
    const transition: StateTransition = {
      id: transitionId,
      fromState,
      toState,
      timestamp: startTime,
      duration: this.config.transitionDuration,
      reason,
      success: false,
    };

    try {
      // Set transitioning state
      state.state = 'transitioning';
      state.metadata.lastUpdated = startTime;
      state.metadata.transitionCount++;

      // Start animation if provided
      if (animation && this.config.enableAnimations) {
        this.startAnimation(stateId, animation);
      }

      // Perform transition after duration
      setTimeout(() => {
        try {
          state.state = toState;
          state.metadata.lastUpdated = Date.now();

          transition.success = true;
          transition.duration = Date.now() - startTime;

          this.emit('state-transitioned', state, transition);

          log.info('State transition completed', {
            component: 'HighlightStateManager',
            metadata: { stateId, fromState, toState, duration: transition.duration },
          });
        } catch (error) {
          state.state = 'error';
          state.metadata.errorCount++;

          transition.error = (error as Error).message;

          this.emit('transition-error', state, transition, error as Error);

          log.error(
            'State transition failed',
            {
              component: 'HighlightStateManager',
              metadata: { stateId, fromState, toState },
            },
            error as Error,
          );
        }
      }, this.config.transitionDuration);

      this.transitions.push(transition);
      this.emit('transition-started', state, transition);

      return true;
    } catch (error) {
      state.state = 'error';
      state.metadata.errorCount++;

      transition.error = (error as Error).message;
      this.transitions.push(transition);

      this.emit('transition-error', state, transition, error as Error);

      log.error(
        'Failed to start state transition',
        {
          component: 'HighlightStateManager',
          metadata: { stateId, fromState, toState },
        },
        error as Error,
      );

      return false;
    }
  }

  private startAnimationLoop(stateId: string): void {
    const state = this.states.get(stateId);
    if (!state || !state.animation || !state.animation.isPlaying) return;

    const animate = () => {
      const animation = state.animation!;
      const now = Date.now();
      const elapsed = now - animation.startTime;

      // Calculate progress
      let progress = elapsed / animation.duration;

      // Handle iterations
      if (animation.iterations !== 'infinite') {
        const totalDuration = animation.duration * (animation.iterations as number);
        if (elapsed >= totalDuration) {
          animation.isPlaying = false;
          animation.progress = 1;
          this.emit('animation-completed', state);
          return;
        }
      }

      // Apply easing and direction
      progress = this.applyEasing(progress % 1, animation.easing);

      if (animation.direction === 'reverse') {
        progress = 1 - progress;
      } else if (animation.direction === 'alternate') {
        const cycle = Math.floor(elapsed / animation.duration);
        if (cycle % 2 === 1) {
          progress = 1 - progress;
        }
      }

      animation.progress = progress;

      // Apply animation to style
      this.applyAnimationToStyle(state, animation, progress);

      // Schedule next frame
      if (animation.isPlaying) {
        const frameId = requestAnimationFrame(animate);
        this.animationFrames.set(stateId, frameId);
      }

      this.emit('animation-frame', state, progress);
    };

    animate();
  }

  private applyAnimationToStyle(state: HighlightState, animation: HighlightAnimation, progress: number): void {
    const baseStyle = { ...state.style };

    switch (animation.type) {
      case 'pulse':
        state.style.opacity = baseStyle.opacity * (0.5 + 0.5 * Math.sin(progress * Math.PI * 2));
        break;

      case 'glow':
        state.style.glowRadius = baseStyle.glowRadius * (1 + 0.5 * progress);
        break;

      case 'fade':
        state.style.opacity = baseStyle.opacity * (1 - progress);
        break;

      case 'scale': {
        const scale = 1 + 0.2 * progress;
        state.style.thickness = baseStyle.thickness * scale;
        break;
      }

      case 'rotate':
        // Rotation would be handled by the rendering system
        break;
    }

    this.emit('style-animated', state, animation.type, progress);
  }

  private applyEasing(t: number, easing: HighlightAnimation['easing']): number {
    switch (easing) {
      case 'linear':
        return t;
      case 'ease-in':
        return t * t;
      case 'ease-out':
        return 1 - (1 - t) * (1 - t);
      case 'ease-in-out':
        return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
      default:
        return t;
    }
  }

  private queueBatchOperation(operation: () => void): void {
    this.batchQueue.push(operation);

    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, 16); // ~60fps
    }
  }

  private processBatch(): void {
    if (this.isProcessingBatch) return;

    this.isProcessingBatch = true;
    this.batchTimer = null;

    const operations = this.batchQueue.splice(0, this.config.batchSize);

    try {
      operations.forEach(operation => operation());

      this.emit('batch-processed', operations.length);
    } catch (error) {
      log.error(
        'Batch processing failed',
        {
          component: 'HighlightStateManager',
        },
        error as Error,
      );
    } finally {
      this.isProcessingBatch = false;

      // Process remaining operations if any
      if (this.batchQueue.length > 0) {
        this.queueBatchOperation(() => {});
      }
    }
  }

  private evictOldestState(): void {
    let oldestState: HighlightState | null = null;
    let oldestTime = Date.now();

    for (const state of this.states.values()) {
      if (state.metadata.createdAt < oldestTime) {
        oldestTime = state.metadata.createdAt;
        oldestState = state;
      }
    }

    if (oldestState) {
      this.removeState(oldestState.id);

      log.info('Evicted oldest state due to capacity limit', {
        component: 'HighlightStateManager',
        metadata: { evictedStateId: oldestState.id },
      });
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const cutoffTime = now - this.config.retentionPeriod;
    let removed = 0;

    // Clean up old inactive states
    for (const [stateId, state] of this.states.entries()) {
      if (state.state === 'inactive' && state.metadata.lastUpdated < cutoffTime) {
        this.removeState(stateId);
        removed++;
      }
    }

    // Clean up old transitions
    const transitionsBefore = this.transitions.length;
    while (this.transitions.length > 0 && this.transitions[0].timestamp < cutoffTime) {
      this.transitions.shift();
    }
    const transitionsRemoved = transitionsBefore - this.transitions.length;

    if (removed > 0 || transitionsRemoved > 0) {
      log.info('Cleanup completed', {
        component: 'HighlightStateManager',
        metadata: { statesRemoved: removed, transitionsRemoved },
      });
    }
  }

  private estimateMemoryUsage(): number {
    // Rough estimation in bytes
    const stateSize = 500; // Estimated bytes per state
    const transitionSize = 200; // Estimated bytes per transition

    return this.states.size * stateSize + this.transitions.length * transitionSize;
  }

  private generateStateId(): string {
    return `highlight-state-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTransitionId(): string {
    return `transition-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup and dispose resources
   */
  dispose(): void {
    // Stop all animations
    this.animationFrames.forEach(frameId => cancelAnimationFrame(frameId));
    this.animationFrames.clear();

    // Clear timers
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Clear data
    this.states.clear();
    this.transitions.length = 0;
    this.batchQueue.length = 0;

    // Remove listeners
    this.removeAllListeners();

    log.info('HighlightStateManager disposed', {
      component: 'HighlightStateManager',
    });
  }
}

// Export singleton instance
export const highlightStateManager = new HighlightStateManager();
