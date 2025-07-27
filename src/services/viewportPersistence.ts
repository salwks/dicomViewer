/**
 * Viewport Annotation Persistence Service
 *
 * Manages annotation persistence across viewport changes, ensuring annotations
 * are maintained when switching between viewports, images, or series
 */

import { SerializedAnnotation, annotationPersistenceService } from './annotationPersistence';
import { AnnotationType } from '../types/annotation-styling';
import { log } from '../utils/logger';

/**
 * Viewport state information
 */
export interface ViewportState {
  /** Viewport ID */
  viewportId: string;
  /** Current image ID */
  imageId: string;
  /** Series Instance UID */
  seriesInstanceUID?: string;
  /** Study Instance UID */
  studyInstanceUID?: string;
  /** Frame number */
  frameNumber?: number;
  /** Viewport type */
  viewportType: 'stack' | 'volume' | 'video';
  /** Camera state */
  cameraState?: {
    position: [number, number, number];
    focalPoint: [number, number, number];
    viewUp: [number, number, number];
    parallelScale?: number;
    viewPlane?: {
      normal: [number, number, number];
      viewUp: [number, number, number];
    };
  };
  /** Display settings */
  displaySettings?: {
    windowLevel: number;
    windowWidth: number;
    zoom: number;
    pan: [number, number];
    rotation: number;
    flipHorizontal: boolean;
    flipVertical: boolean;
    invert: boolean;
  };
  /** Annotations associated with this viewport */
  annotationIds: string[];
  /** Last accessed timestamp */
  lastAccessed: Date;
  /** Viewport dimensions */
  dimensions?: {
    width: number;
    height: number;
  };
}

/**
 * Annotation persistence policy
 */
export interface PersistencePolicy {
  /** Persist across image changes */
  persistAcrossImages: boolean;
  /** Persist across series changes */
  persistAcrossSeries: boolean;
  /** Persist across study changes */
  persistAcrossStudies: boolean;
  /** Persist across viewport changes */
  persistAcrossViewports: boolean;
  /** Auto-save interval in milliseconds */
  autoSaveInterval?: number;
  /** Maximum cache size */
  maxCacheSize?: number;
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
  /** Annotation types to persist */
  annotationTypes?: AnnotationType[];
}

/**
 * Viewport annotation mapping
 */
export interface ViewportAnnotationMapping {
  /** Viewport ID */
  viewportId: string;
  /** Image ID */
  imageId: string;
  /** Annotation IDs */
  annotationIds: string[];
  /** Mapping metadata */
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    accessCount: number;
    lastAccessed: Date;
  };
}

/**
 * Persistence event types
 */
export enum PersistenceEventType {
  VIEWPORT_CHANGED = 'viewportChanged',
  IMAGE_CHANGED = 'imageChanged',
  SERIES_CHANGED = 'seriesChanged',
  ANNOTATION_ADDED = 'annotationAdded',
  ANNOTATION_REMOVED = 'annotationRemoved',
  ANNOTATION_UPDATED = 'annotationUpdated',
  STATE_SAVED = 'stateSaved',
  STATE_LOADED = 'stateLoaded',
  CACHE_CLEARED = 'cacheCleared',
}

/**
 * Persistence event data
 */
export interface PersistenceEvent {
  /** Event type */
  type: PersistenceEventType;
  /** Viewport ID */
  viewportId: string;
  /** Event data */
  data: any;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Viewport Persistence Service
 */
export class ViewportPersistenceService {
  private static instance: ViewportPersistenceService;
  private viewportStates: Map<string, ViewportState> = new Map();
  private annotationMappings: Map<string, ViewportAnnotationMapping> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();
  private persistencePolicy: PersistencePolicy;
  private autoSaveTimer?: NodeJS.Timeout;
  private isInitialized = false;

  private constructor(policy?: Partial<PersistencePolicy>) {
    this.persistencePolicy = {
      persistAcrossImages: true,
      persistAcrossSeries: true,
      persistAcrossStudies: false,
      persistAcrossViewports: true,
      autoSaveInterval: 30000, // 30 seconds
      maxCacheSize: 1000,
      cacheTTL: 24 * 60 * 60 * 1000, // 24 hours
      annotationTypes: Object.values(AnnotationType),
      ...policy,
    };

    log.info('🔄 Viewport Persistence Service initialized');
  }

  static getInstance(policy?: Partial<PersistencePolicy>): ViewportPersistenceService {
    if (!ViewportPersistenceService.instance) {
      ViewportPersistenceService.instance = new ViewportPersistenceService(policy);
    }
    return ViewportPersistenceService.instance;
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load existing viewport states
      await this.loadViewportStates();

      // Load annotation mappings
      await this.loadAnnotationMappings();

      // Start auto-save timer
      this.startAutoSave();

      this.isInitialized = true;
      this.emit(PersistenceEventType.STATE_LOADED, { initialized: true });

      log.info('🔄 Viewport persistence initialized');
    } catch (error) {
      log.error('Failed to initialize viewport persistence:', {
        component: 'ViewportPersistence',
      }, error as Error);
      throw error;
    }
  }

  /**
   * Update persistence policy
   */
  updatePolicy(policy: Partial<PersistencePolicy>): void {
    this.persistencePolicy = { ...this.persistencePolicy, ...policy };

    // Restart auto-save with new interval
    if (policy.autoSaveInterval !== undefined) {
      this.stopAutoSave();
      this.startAutoSave();
    }

    log.info('🔄 Persistence policy updated');
  }

  /* =============================================================================
   * VIEWPORT STATE MANAGEMENT
   * ============================================================================= */

  /**
   * Register viewport
   */
  registerViewport(
    viewportId: string,
    initialState: Partial<ViewportState>,
  ): void {
    const state: ViewportState = {
      viewportId,
      imageId: initialState.imageId || '',
      seriesInstanceUID: initialState.seriesInstanceUID,
      studyInstanceUID: initialState.studyInstanceUID,
      frameNumber: initialState.frameNumber,
      viewportType: initialState.viewportType || 'stack',
      cameraState: initialState.cameraState,
      displaySettings: initialState.displaySettings,
      annotationIds: [],
      lastAccessed: new Date(),
      dimensions: initialState.dimensions,
    };

    this.viewportStates.set(viewportId, state);

    this.emit(PersistenceEventType.VIEWPORT_CHANGED, {
      viewportId,
      state,
      action: 'registered',
    });

    log.info(`🔄 Registered viewport: ${viewportId}`);
  }

  /**
   * Update viewport state
   */
  updateViewportState(
    viewportId: string,
    updates: Partial<ViewportState>,
  ): void {
    const currentState = this.viewportStates.get(viewportId);
    if (!currentState) {
      log.warn(`Viewport not found: ${viewportId}`);
      return;
    }

    const previousImageId = currentState.imageId;
    const previousSeriesUID = currentState.seriesInstanceUID;
    const previousStudyUID = currentState.studyInstanceUID;

    // Update state
    const updatedState: ViewportState = {
      ...currentState,
      ...updates,
      lastAccessed: new Date(),
    };

    this.viewportStates.set(viewportId, updatedState);

    // Handle context changes
    this.handleContextChange(
      viewportId,
      previousImageId,
      previousSeriesUID,
      previousStudyUID,
      updatedState,
    );

    this.emit(PersistenceEventType.VIEWPORT_CHANGED, {
      viewportId,
      state: updatedState,
      previous: currentState,
      action: 'updated',
    });
  }

  /**
   * Get viewport state
   */
  getViewportState(viewportId: string): ViewportState | undefined {
    const state = this.viewportStates.get(viewportId);
    if (state) {
      state.lastAccessed = new Date();
    }
    return state;
  }

  /**
   * Remove viewport
   */
  removeViewport(viewportId: string): void {
    const state = this.viewportStates.get(viewportId);
    if (!state) return;

    // Save annotations before removing viewport
    this.saveViewportAnnotations(viewportId);

    this.viewportStates.delete(viewportId);

    this.emit(PersistenceEventType.VIEWPORT_CHANGED, {
      viewportId,
      state,
      action: 'removed',
    });

    log.info(`🔄 Removed viewport: ${viewportId}`);
  }

  /* =============================================================================
   * ANNOTATION PERSISTENCE
   * ============================================================================= */

  /**
   * Add annotation to viewport
   */
  addAnnotationToViewport(
    viewportId: string,
    annotation: SerializedAnnotation,
  ): void {
    const state = this.viewportStates.get(viewportId);
    if (!state) {
      log.warn(`Viewport not found: ${viewportId}`);
      return;
    }

    // Check if annotation type should be persisted
    if (!this.shouldPersistAnnotationType(annotation.type)) {
      return;
    }

    // Add to viewport state
    if (!state.annotationIds.includes(annotation.id)) {
      state.annotationIds.push(annotation.id);
    }

    // Create/update annotation mapping
    const mappingKey = this.createMappingKey(viewportId, state.imageId);
    let mapping = this.annotationMappings.get(mappingKey);

    if (!mapping) {
      mapping = {
        viewportId,
        imageId: state.imageId,
        annotationIds: [],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          accessCount: 0,
          lastAccessed: new Date(),
        },
      };
      this.annotationMappings.set(mappingKey, mapping);
    }

    if (!mapping.annotationIds.includes(annotation.id)) {
      mapping.annotationIds.push(annotation.id);
      mapping.metadata.updatedAt = new Date();
      mapping.metadata.accessCount++;
    }

    this.emit(PersistenceEventType.ANNOTATION_ADDED, {
      viewportId,
      annotationId: annotation.id,
      annotation,
    });
  }

  /**
   * Remove annotation from viewport
   */
  removeAnnotationFromViewport(
    viewportId: string,
    annotationId: string,
  ): void {
    const state = this.viewportStates.get(viewportId);
    if (!state) return;

    // Remove from viewport state
    const index = state.annotationIds.indexOf(annotationId);
    if (index > -1) {
      state.annotationIds.splice(index, 1);
    }

    // Remove from annotation mapping
    const mappingKey = this.createMappingKey(viewportId, state.imageId);
    const mapping = this.annotationMappings.get(mappingKey);
    if (mapping) {
      const mappingIndex = mapping.annotationIds.indexOf(annotationId);
      if (mappingIndex > -1) {
        mapping.annotationIds.splice(mappingIndex, 1);
        mapping.metadata.updatedAt = new Date();
      }
    }

    this.emit(PersistenceEventType.ANNOTATION_REMOVED, {
      viewportId,
      annotationId,
    });
  }

  /**
   * Get annotations for viewport
   */
  async getViewportAnnotations(viewportId: string): Promise<SerializedAnnotation[]> {
    const state = this.viewportStates.get(viewportId);
    if (!state) return [];

    const mappingKey = this.createMappingKey(viewportId, state.imageId);
    const mapping = this.annotationMappings.get(mappingKey);

    if (!mapping || mapping.annotationIds.length === 0) {
      return [];
    }

    // Load annotations from persistence service
    const annotations: SerializedAnnotation[] = [];

    for (const annotationId of mapping.annotationIds) {
      try {
        // Try to load from cache first
        const cached = await this.loadAnnotationFromCache(annotationId);
        if (cached) {
          annotations.push(cached);
        }
      } catch (error) {
        log.warn(`Failed to load annotation ${annotationId}:`, {
          component: 'ViewportPersistence',
          metadata: { annotationId },
        }, error as Error);
      }
    }

    // Update access metadata
    mapping.metadata.lastAccessed = new Date();
    mapping.metadata.accessCount++;

    return annotations;
  }

  /**
   * Save viewport annotations
   */
  async saveViewportAnnotations(viewportId: string): Promise<void> {
    const state = this.viewportStates.get(viewportId);
    if (!state) return;

    try {
      const annotations = await this.getViewportAnnotations(viewportId);
      if (annotations.length === 0) return;

      const key = `viewport-${viewportId}-${state.imageId}`;
      await annotationPersistenceService.saveAnnotations(
        key,
        annotations,
        { includeMetadata: true, includeState: true },
      );

      this.emit(PersistenceEventType.STATE_SAVED, {
        viewportId,
        annotationCount: annotations.length,
      });

    } catch (error) {
      log.error(`Failed to save viewport annotations for ${viewportId}:`, {
        component: 'ViewportPersistence',
        metadata: { viewportId },
      }, error as Error);
    }
  }

  /**
   * Load viewport annotations
   */
  async loadViewportAnnotations(viewportId: string): Promise<SerializedAnnotation[]> {
    const state = this.viewportStates.get(viewportId);
    if (!state) return [];

    try {
      const key = `viewport-${viewportId}-${state.imageId}`;
      const annotations = await annotationPersistenceService.loadAnnotations(key);

      // Update viewport state with loaded annotation IDs
      state.annotationIds = annotations.map(a => a.id);

      // Update annotation mappings
      const mappingKey = this.createMappingKey(viewportId, state.imageId);
      this.annotationMappings.set(mappingKey, {
        viewportId,
        imageId: state.imageId,
        annotationIds: state.annotationIds,
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          accessCount: 1,
          lastAccessed: new Date(),
        },
      });

      this.emit(PersistenceEventType.STATE_LOADED, {
        viewportId,
        annotationCount: annotations.length,
      });

      return annotations;

    } catch (error) {
      log.error(`Failed to load viewport annotations for ${viewportId}:`, {
        component: 'ViewportPersistence',
        metadata: { viewportId },
      }, error as Error);
      return [];
    }
  }

  /* =============================================================================
   * CONTEXT CHANGE HANDLING
   * ============================================================================= */

  /**
   * Handle context changes (image, series, study)
   */
  private async handleContextChange(
    viewportId: string,
    previousImageId: string,
    previousSeriesUID: string | undefined,
    previousStudyUID: string | undefined,
    newState: ViewportState,
  ): Promise<void> {
    const imageChanged = previousImageId !== newState.imageId;
    const seriesChanged = previousSeriesUID !== newState.seriesInstanceUID;
    const studyChanged = previousStudyUID !== newState.studyInstanceUID;

    if (!imageChanged && !seriesChanged && !studyChanged) {
      return;
    }

    // Save current annotations if context changed
    if (previousImageId) {
      await this.saveViewportAnnotations(viewportId);
    }

    // Determine what annotations to load based on persistence policy
    let shouldLoadAnnotations = false;

    if (imageChanged) {
      this.emit(PersistenceEventType.IMAGE_CHANGED, {
        viewportId,
        previousImageId,
        newImageId: newState.imageId,
      });

      if (this.persistencePolicy.persistAcrossImages) {
        shouldLoadAnnotations = true;
      }
    }

    if (seriesChanged) {
      this.emit(PersistenceEventType.SERIES_CHANGED, {
        viewportId,
        previousSeriesUID,
        newSeriesUID: newState.seriesInstanceUID,
      });

      if (this.persistencePolicy.persistAcrossSeries) {
        shouldLoadAnnotations = true;
      }
    }

    if (studyChanged) {
      if (this.persistencePolicy.persistAcrossStudies) {
        shouldLoadAnnotations = true;
      }
    }

    // Load annotations for new context
    if (shouldLoadAnnotations) {
      const annotations = await this.loadViewportAnnotations(viewportId);
      log.info(`🔄 Loaded ${annotations.length} annotations for context change`);
    } else {
      // Clear annotations if not persisting across this context change
      newState.annotationIds = [];
    }
  }

  /* =============================================================================
   * PERSISTENCE UTILITIES
   * ============================================================================= */

  /**
   * Create mapping key
   */
  private createMappingKey(viewportId: string, imageId: string): string {
    return `${viewportId}:${imageId}`;
  }

  /**
   * Check if annotation type should be persisted
   */
  private shouldPersistAnnotationType(type: AnnotationType): boolean {
    return this.persistencePolicy.annotationTypes?.includes(type) || false;
  }

  /**
   * Load annotation from cache
   */
  private async loadAnnotationFromCache(annotationId: string): Promise<SerializedAnnotation | null> {
    try {
      // Try loading from persistence service
      const annotations = await annotationPersistenceService.loadAnnotations(annotationId);
      return annotations.find(a => a.id === annotationId) || null;
    } catch {
      return null;
    }
  }

  /**
   * Load viewport states from storage
   */
  private async loadViewportStates(): Promise<void> {
    try {
      const keys = await annotationPersistenceService.listAnnotationKeys();
      const viewportKeys = keys.filter(key => key.startsWith('viewport-state-'));

      for (const key of viewportKeys) {
        try {
          const data = await annotationPersistenceService.loadAnnotations(key);
          // Parse viewport state from data (simplified)
          if (data.length > 0) {
            // Implementation would depend on how viewport states are stored
            log.info(`Loaded viewport state: ${key}`);
          }
        } catch (error) {
          log.warn(`Failed to load viewport state ${key}:`, {
            component: 'ViewportPersistence',
            metadata: { key },
          }, error as Error);
        }
      }
    } catch (error) {
      log.warn('Failed to load viewport states:', {
        component: 'ViewportPersistence',
      }, error as Error);
    }
  }

  /**
   * Load annotation mappings from storage
   */
  private async loadAnnotationMappings(): Promise<void> {
    try {
      const keys = await annotationPersistenceService.listAnnotationKeys();
      const mappingKeys = keys.filter(key => key.startsWith('viewport-mapping-'));

      for (const key of mappingKeys) {
        try {
          const data = await annotationPersistenceService.loadAnnotations(key);
          // Parse annotation mappings from data (simplified)
          if (data.length > 0) {
            log.info(`Loaded annotation mapping: ${key}`);
          }
        } catch (error) {
          log.warn(`Failed to load annotation mapping ${key}:`, {
            component: 'ViewportPersistence',
            metadata: { key },
          }, error as Error);
        }
      }
    } catch (error) {
      log.warn('Failed to load annotation mappings:', {
        component: 'ViewportPersistence',
      }, error as Error);
    }
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    if (this.persistencePolicy.autoSaveInterval && this.persistencePolicy.autoSaveInterval > 0) {
      this.autoSaveTimer = setInterval(() => {
        this.performAutoSave();
      }, this.persistencePolicy.autoSaveInterval);
    }
  }

  /**
   * Stop auto-save timer
   */
  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }

  /**
   * Perform auto-save
   */
  private async performAutoSave(): Promise<void> {
    try {
      const savePromises: Promise<void>[] = [];

      Array.from(this.viewportStates.keys()).forEach(viewportId => {
        savePromises.push(this.saveViewportAnnotations(viewportId));
      });

      await Promise.allSettled(savePromises);
      log.info('🔄 Auto-save completed');

    } catch (error) {
      log.error('Auto-save failed:', {
        component: 'ViewportPersistence',
      }, error as Error);
    }
  }

  /* =============================================================================
   * CACHE MANAGEMENT
   * ============================================================================= */

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    const ttl = this.persistencePolicy.cacheTTL || 24 * 60 * 60 * 1000;

    let removedCount = 0;

    const entriesToRemove: string[] = [];
    Array.from(this.annotationMappings.entries()).forEach(([key, mapping]) => {
      const age = now - mapping.metadata.lastAccessed.getTime();
      if (age > ttl) {
        entriesToRemove.push(key);
      }
    });

    entriesToRemove.forEach(key => {
      this.annotationMappings.delete(key);
      removedCount++;
    });

    if (removedCount > 0) {
      log.info(`🧹 Cleared ${removedCount} expired cache entries`);
      this.emit(PersistenceEventType.CACHE_CLEARED, { removedCount });
    }
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    const count = this.annotationMappings.size;
    this.annotationMappings.clear();

    log.info(`🧹 Cleared all cache (${count} entries)`);
    this.emit(PersistenceEventType.CACHE_CLEARED, { removedCount: count });
  }

  /* =============================================================================
   * STATISTICS
   * ============================================================================= */

  /**
   * Get persistence statistics
   */
  getStatistics() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const activeViewports = Array.from(this.viewportStates.values())
      .filter(state => now - state.lastAccessed.getTime() < oneHour);

    return {
      totalViewports: this.viewportStates.size,
      activeViewports: activeViewports.length,
      totalMappings: this.annotationMappings.size,
      totalAnnotations: Array.from(this.annotationMappings.values())
        .reduce((sum, mapping) => sum + mapping.annotationIds.length, 0),
      cacheHitRate: this.calculateCacheHitRate(),
      persistencePolicy: this.persistencePolicy,
      isInitialized: this.isInitialized,
    };
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    // Simplified calculation - in production, track actual hits/misses
    return 0.85; // Placeholder
  }

  /* =============================================================================
   * EVENT SYSTEM
   * ============================================================================= */

  /**
   * Add event listener
   */
  on(event: PersistenceEventType | string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: PersistenceEventType | string, callback: Function): void {
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
  private emit(event: PersistenceEventType, data: any): void {
    const eventData: PersistenceEvent = {
      type: event,
      viewportId: data.viewportId || '',
      data,
      timestamp: new Date(),
    };

    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(eventData);
        } catch (error) {
          log.error(`Error in event listener for ${event}:`, {
            component: 'ViewportPersistence',
            metadata: { event },
          }, error as Error);
        }
      });
    }
  }

  /* =============================================================================
   * CLEANUP
   * ============================================================================= */

  /**
   * Dispose of the service
   */
  dispose(): void {
    // Stop auto-save
    this.stopAutoSave();

    // Save all current states
    const savePromises: Promise<void>[] = [];
    Array.from(this.viewportStates.keys()).forEach(viewportId => {
      savePromises.push(this.saveViewportAnnotations(viewportId));
    });

    Promise.allSettled(savePromises).then(() => {
      log.info('🔄 Viewport persistence disposed');
    });

    // Clear all data
    this.viewportStates.clear();
    this.annotationMappings.clear();
    this.eventListeners.clear();

    this.isInitialized = false;
  }
}

// Export singleton instance
export const viewportPersistenceService = ViewportPersistenceService.getInstance();
