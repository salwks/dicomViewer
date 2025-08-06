/**
 * Sync Event Emitter
 * Advanced event emission system for viewport synchronization with typed events and propagation control
 */

import { EventEmitter } from 'events';
import { log } from '../utils/logger';

// ===== Event Type Definitions =====

export interface BaseSyncEvent {
  type: string;
  timestamp: number;
  sourceViewportId: string;
  metadata?: Record<string, unknown>;
}

export interface ScrollSyncEvent extends BaseSyncEvent {
  type: 'scroll-sync';
  data: {
    imageIndex: number;
    sliceIndex?: number;
    frameIndex?: number;
    scrollDelta?: number;
  };
}

export interface WindowLevelSyncEvent extends BaseSyncEvent {
  type: 'window-level-sync';
  data: {
    windowCenter: number;
    windowWidth: number;
    preset?: string;
  };
}

export interface ZoomPanSyncEvent extends BaseSyncEvent {
  type: 'zoom-pan-sync';
  data: {
    zoom: number;
    pan: { x: number; y: number };
    transform?: {
      scale: number;
      translate: { x: number; y: number };
      rotation?: number;
    };
  };
}

export interface CrossReferenceSyncEvent extends BaseSyncEvent {
  type: 'cross-reference-sync';
  data: {
    position: { x: number; y: number; z: number };
    orientation: string;
    visible: boolean;
  };
}

export interface StateChangedEvent extends BaseSyncEvent {
  type: 'state-changed';
  data: {
    property: string;
    oldValue: unknown;
    newValue: unknown;
  };
}

export interface ErrorEvent extends BaseSyncEvent {
  type: 'sync-error';
  data: {
    error: Error;
    context: string;
    recoverable: boolean;
  };
}

// Union type for all sync events
export type SyncEvent =
  | ScrollSyncEvent
  | WindowLevelSyncEvent
  | ZoomPanSyncEvent
  | CrossReferenceSyncEvent
  | StateChangedEvent
  | ErrorEvent;

// ===== Event Subscription Types =====

export interface EventSubscription {
  id: string;
  eventType: string | string[];
  handler: (event: SyncEvent) => void;
  filter?: EventFilter;
  priority?: number;
  once?: boolean;
}

export interface EventFilter {
  viewportIds?: string[];
  excludeViewportIds?: string[];
  metadata?: Record<string, unknown>;
  custom?: (event: SyncEvent) => boolean;
}

// ===== Propagation Control =====

export interface PropagationOptions {
  stopPropagation?: boolean;
  preventDefault?: boolean;
  async?: boolean;
  debounce?: number;
  throttle?: number;
}

export interface EventPropagationContext {
  stopped: boolean;
  prevented: boolean;
  propagatedTo: Set<string>;
  errors: Error[];
}

// ===== Configuration =====

export interface SyncEventEmitterConfig {
  maxListeners: number;
  enableLogging: boolean;
  enableMetrics: boolean;
  errorHandler?: (error: Error, event: SyncEvent) => void;
  performanceThreshold: number; // ms
}

export const DEFAULT_SYNC_EVENT_CONFIG: SyncEventEmitterConfig = {
  maxListeners: 100,
  enableLogging: true,
  enableMetrics: true,
  performanceThreshold: 16, // 60fps target
};

// ===== Main Event Emitter Class =====

export class SyncEventEmitter extends EventEmitter {
  private config: SyncEventEmitterConfig;
  private subscriptions = new Map<string, EventSubscription>();
  private eventMetrics = new Map<string, { count: number; totalTime: number }>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private throttleTimers = new Map<string, NodeJS.Timeout>();
  private propagationContexts = new WeakMap<SyncEvent, EventPropagationContext>();

  constructor(config: Partial<SyncEventEmitterConfig> = {}) {
    super();
    this.config = { ...DEFAULT_SYNC_EVENT_CONFIG, ...config };
    this.setMaxListeners(this.config.maxListeners);
    this.initializeEmitter();
  }

  private initializeEmitter(): void {
    log.info('Initializing Sync Event Emitter', {
      component: 'SyncEventEmitter',
      metadata: { config: this.config },
    });

    // Set up error handling
    this.on('error', (error: Error) => {
      if (this.config.errorHandler) {
        this.config.errorHandler(error, { type: 'internal-error', timestamp: Date.now() } as any);
      } else {
        log.error('Unhandled event emitter error', {
          component: 'SyncEventEmitter',
        }, error);
      }
    });
  }

  // ===== Event Emission =====

  public emitSync<T extends SyncEvent>(event: T, options: PropagationOptions = {}): boolean {
    const startTime = performance.now();

    // Create propagation context
    const context: EventPropagationContext = {
      stopped: false,
      prevented: false,
      propagatedTo: new Set(),
      errors: [],
    };
    this.propagationContexts.set(event, context);

    // Handle debounce/throttle
    if (options.debounce) {
      return this.emitDebounced(event, options);
    }
    if (options.throttle) {
      return this.emitThrottled(event, options);
    }

    // Log event emission
    if (this.config.enableLogging) {
      log.info('Emitting sync event', {
        component: 'SyncEventEmitter',
        metadata: {
          type: event.type,
          sourceViewport: event.sourceViewportId,
          timestamp: event.timestamp,
        },
      });
    }

    // Get sorted subscriptions by priority
    const subscriptions = this.getMatchingSubscriptions(event);
    let emitted = false;

    // Emit to subscriptions
    for (const subscription of subscriptions) {
      if (context.stopped) break;

      try {
        // Apply filters
        if (!this.shouldEmitToSubscription(event, subscription)) continue;

        // Call handler
        if (options.async) {
          setImmediate(() => {
            this.callSubscriptionHandler(subscription, event, context);
          });
        } else {
          this.callSubscriptionHandler(subscription, event, context);
        }

        context.propagatedTo.add(subscription.id);
        emitted = true;

        // Handle once subscriptions
        if (subscription.once) {
          this.unsubscribe(subscription.id);
        }
      } catch (error) {
        context.errors.push(error as Error);
        this.handleSubscriptionError(error as Error, subscription, event);
      }
    }

    // Emit to native EventEmitter listeners
    if (!context.stopped) {
      emitted = super.emit(event.type, event) || emitted;
    }

    // Update metrics
    if (this.config.enableMetrics) {
      this.updateMetrics(event.type, performance.now() - startTime);
    }

    // Clean up propagation context
    this.propagationContexts.delete(event);

    return emitted && !context.prevented;
  }

  private emitDebounced<T extends SyncEvent>(event: T, options: PropagationOptions): boolean {
    const key = `${event.type}-${event.sourceViewportId}`;

    // Clear existing timer
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      const { debounce: _debounce, ...restOptions } = options; // eslint-disable-line @typescript-eslint/no-unused-vars
      this.emitSync(event, restOptions);
    }, options.debounce!) as NodeJS.Timeout;

    this.debounceTimers.set(key, timer);
    return true;
  }

  private emitThrottled<T extends SyncEvent>(event: T, options: PropagationOptions): boolean {
    const key = `${event.type}-${event.sourceViewportId}`;

    // Check if already throttled
    if (this.throttleTimers.has(key)) {
      return false;
    }

    // Emit immediately
    const { throttle: _throttle, ...restOptions } = options; // eslint-disable-line @typescript-eslint/no-unused-vars
    const result = this.emitSync(event, restOptions);

    // Set throttle timer
    const timer = setTimeout(() => {
      this.throttleTimers.delete(key);
    }, options.throttle!) as NodeJS.Timeout;

    this.throttleTimers.set(key, timer);
    return result;
  }

  // ===== Subscription Management =====

  public subscribe(subscription: Omit<EventSubscription, 'id'>): string {
    const id = this.generateSubscriptionId();
    const fullSubscription: EventSubscription = { ...subscription, id };

    this.subscriptions.set(id, fullSubscription);

    log.info('Event subscription created', {
      component: 'SyncEventEmitter',
      metadata: {
        id,
        eventTypes: Array.isArray(subscription.eventType) ? subscription.eventType : [subscription.eventType],
        priority: subscription.priority || 0,
      },
    });

    return id;
  }

  public unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;

    this.subscriptions.delete(subscriptionId);

    log.info('Event subscription removed', {
      component: 'SyncEventEmitter',
      metadata: { id: subscriptionId },
    });

    return true;
  }

  public unsubscribeAll(filter?: { eventType?: string; viewportId?: string }): number {
    let removed = 0;

    for (const [id, subscription] of this.subscriptions) {
      let shouldRemove = true;

      if (filter?.eventType) {
        const eventTypes = Array.isArray(subscription.eventType) ? subscription.eventType : [subscription.eventType];
        shouldRemove = shouldRemove && eventTypes.includes(filter.eventType);
      }

      if (filter?.viewportId && subscription.filter?.viewportIds) {
        shouldRemove = shouldRemove && subscription.filter.viewportIds.includes(filter.viewportId);
      }

      if (shouldRemove) {
        this.subscriptions.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      log.info('Multiple event subscriptions removed', {
        component: 'SyncEventEmitter',
        metadata: { count: removed, filter },
      });
    }

    return removed;
  }

  public getSubscriptions(filter?: { eventType?: string; viewportId?: string }): EventSubscription[] {
    const subscriptions: EventSubscription[] = [];

    for (const subscription of this.subscriptions.values()) {
      let matches = true;

      if (filter?.eventType) {
        const eventTypes = Array.isArray(subscription.eventType) ? subscription.eventType : [subscription.eventType];
        matches = matches && eventTypes.includes(filter.eventType);
      }

      if (filter?.viewportId && subscription.filter?.viewportIds) {
        matches = matches && subscription.filter.viewportIds.includes(filter.viewportId);
      }

      if (matches) {
        subscriptions.push(subscription);
      }
    }

    return subscriptions;
  }

  // ===== Propagation Control =====

  public stopPropagation(event: SyncEvent): void {
    const context = this.propagationContexts.get(event);
    if (context) {
      context.stopped = true;
    }
  }

  public preventDefault(event: SyncEvent): void {
    const context = this.propagationContexts.get(event);
    if (context) {
      context.prevented = true;
    }
  }

  public isPropagationStopped(event: SyncEvent): boolean {
    const context = this.propagationContexts.get(event);
    return context?.stopped || false;
  }

  public isDefaultPrevented(event: SyncEvent): boolean {
    const context = this.propagationContexts.get(event);
    return context?.prevented || false;
  }

  // ===== Helper Methods =====

  private getMatchingSubscriptions(event: SyncEvent): EventSubscription[] {
    const matching: EventSubscription[] = [];

    for (const subscription of this.subscriptions.values()) {
      const eventTypes = Array.isArray(subscription.eventType) ? subscription.eventType : [subscription.eventType];
      if (eventTypes.includes(event.type) || eventTypes.includes('*')) {
        matching.push(subscription);
      }
    }

    // Sort by priority (higher priority first)
    return matching.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  private shouldEmitToSubscription(event: SyncEvent, subscription: EventSubscription): boolean {
    if (!subscription.filter) return true;

    const filter = subscription.filter;

    // Check viewport filters
    if (filter.viewportIds && !filter.viewportIds.includes(event.sourceViewportId)) {
      return false;
    }

    if (filter.excludeViewportIds && filter.excludeViewportIds.includes(event.sourceViewportId)) {
      return false;
    }

    // Check metadata filters
    if (filter.metadata && event.metadata) {
      for (const [key, value] of Object.entries(filter.metadata)) {
        // eslint-disable-next-line security/detect-object-injection -- Safe: key from metadata entries
        if (event.metadata[key] !== value) {
          return false;
        }
      }
    }

    // Check custom filter
    if (filter.custom && !filter.custom(event)) {
      return false;
    }

    return true;
  }

  private callSubscriptionHandler(
    subscription: EventSubscription,
    event: SyncEvent,
    context: EventPropagationContext,
  ): void {
    try {
      subscription.handler(event);
    } catch (error) {
      context.errors.push(error as Error);
      throw error;
    }
  }

  private handleSubscriptionError(error: Error, subscription: EventSubscription, event: SyncEvent): void {
    log.error('Error in event subscription handler', {
      component: 'SyncEventEmitter',
      metadata: {
        subscriptionId: subscription.id,
        eventType: event.type,
        sourceViewport: event.sourceViewportId,
      },
    }, error);

    // Emit error event
    const errorEvent: ErrorEvent = {
      type: 'sync-error',
      timestamp: Date.now(),
      sourceViewportId: event.sourceViewportId,
      data: {
        error,
        context: `Subscription handler error for ${event.type}`,
        recoverable: true,
      },
    };

    // Use setTimeout to avoid recursive emission
    setTimeout(() => {
      this.emitSync(errorEvent);
    }, 0);
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateMetrics(eventType: string, duration: number): void {
    const metrics = this.eventMetrics.get(eventType) || { count: 0, totalTime: 0 };
    metrics.count++;
    metrics.totalTime += duration;
    this.eventMetrics.set(eventType, metrics);

    // Log performance warning if threshold exceeded
    if (duration > this.config.performanceThreshold) {
      log.warn('Event processing exceeded performance threshold', {
        component: 'SyncEventEmitter',
        metadata: {
          eventType,
          duration,
          threshold: this.config.performanceThreshold,
        },
      });
    }
  }

  // ===== Metrics and Debugging =====

  public getMetrics(eventType?: string): Record<string, { count: number; avgTime: number }> {
    const result: Record<string, { count: number; avgTime: number }> = {};

    if (eventType) {
      const metrics = this.eventMetrics.get(eventType);
      if (metrics) {
        // eslint-disable-next-line security/detect-object-injection -- Safe: eventType from method parameter
        result[eventType] = {
          count: metrics.count,
          avgTime: metrics.totalTime / metrics.count,
        };
      }
    } else {
      for (const [type, metrics] of this.eventMetrics) {
        // eslint-disable-next-line security/detect-object-injection -- Safe: type from eventMetrics entries
        result[type] = {
          count: metrics.count,
          avgTime: metrics.totalTime / metrics.count,
        };
      }
    }

    return result;
  }

  public resetMetrics(): void {
    this.eventMetrics.clear();
    log.info('Event metrics reset', {
      component: 'SyncEventEmitter',
    });
  }

  // ===== Configuration =====

  public updateConfig(config: Partial<SyncEventEmitterConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.maxListeners !== undefined) {
      this.setMaxListeners(config.maxListeners);
    }

    log.info('Event emitter config updated', {
      component: 'SyncEventEmitter',
      metadata: config,
    });
  }

  public getConfig(): SyncEventEmitterConfig {
    return { ...this.config };
  }

  // ===== Cleanup =====

  public dispose(): void {
    // Clear all timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    for (const timer of this.throttleTimers.values()) {
      clearTimeout(timer);
    }

    // Clear data structures
    this.subscriptions.clear();
    this.eventMetrics.clear();
    this.debounceTimers.clear();
    this.throttleTimers.clear();

    // Remove all listeners
    this.removeAllListeners();

    log.info('SyncEventEmitter disposed', {
      component: 'SyncEventEmitter',
    });
  }
}

// Singleton instance
export const syncEventEmitter = new SyncEventEmitter();

