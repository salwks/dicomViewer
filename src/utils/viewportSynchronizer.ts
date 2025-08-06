/**
 * Viewport Synchronizer for Comparison Mode
 * Manages synchronization of scroll, zoom, and window/level between viewports
 * Refactored for security compliance and type safety
 */

import { log } from './logger';

// Safe property access helper
function safePropertyAccess<T extends object, K extends keyof T>(obj: T, key: K): T[K] | undefined {
  if (Object.prototype.hasOwnProperty.call(obj, key)) {
    // eslint-disable-next-line security/detect-object-injection
    return obj[key];
  }
  return undefined;
}

// Safe rendering engine registry with type safety
const renderingEngines = new Map<string, unknown>();

export function registerRenderingEngine(id: string, engine: unknown): void {
  if (typeof id !== 'string' || !id.trim()) {
    console.error('ViewportSynchronizer: Invalid engine ID provided');
    return;
  }

  renderingEngines.set(id, engine);
  log.info('ViewportSynchronizer: Rendering engine registered', { id, hasEngine: !!engine });
}

export function unregisterRenderingEngine(id: string): void {
  if (typeof id !== 'string') {
    console.error('ViewportSynchronizer: Invalid engine ID for unregistration');
    return;
  }
  renderingEngines.delete(id);
}

function getRenderingEngine(id: string): unknown {
  return renderingEngines.get(id);
}

// Viewport interface with type safety
export interface ViewportLike {
  canvas?: HTMLCanvasElement;
  element?: HTMLElement;
  getCamera?(): CameraLike | undefined;
  setCamera?(camera: CameraLike): void;
  render?(): void;
  getImageIds?(): string[];
  getCurrentImageIdIndex?(): number;
  setImageIdIndex?(index: number): void;
  scroll?(delta: number): void;
  getProperties?(): { voiRange?: VOIRange };
  setProperties?(properties: { voiRange?: VOIRange }): void;
  getSliceRange?(): SliceRange | undefined;
}

export interface CameraLike {
  position?: [number, number, number];
  focalPoint?: [number, number, number];
  viewUp?: [number, number, number];
  parallelScale?: number;
  parallelProjection?: boolean;
  viewPlaneNormal?: [number, number, number];
}

export interface VOIRange {
  lower: number;
  upper: number;
}

export interface SliceRange {
  min: number;
  max: number;
  current: number;
}

export interface SynchronizationOptions {
  enableScroll?: boolean;
  enableZoom?: boolean;
  enableWindowLevel?: boolean;
  enableSliceSync?: boolean;
  enableAnatomicalMapping?: boolean;
}

// Sync state management interface
interface SyncState {
  isEnabled: boolean;
  isSyncing: boolean;
  lastRenderTime: number;
  sliceMapping: Map<number, number>;
}

export class ViewportSynchronizer {
  private readonly sourceViewportId: string;
  private readonly targetViewportId: string;
  private readonly sourceEngineId: string;
  private readonly targetEngineId: string;
  private readonly options: Required<SynchronizationOptions>;
  private readonly listeners: Map<string, EventListener> = new Map();
  // private readonly renderDebounceMs = 16; // ~60fps - for future use
  private readonly syncState: SyncState;

  constructor(
    sourceEngineId: string,
    sourceViewportId: string,
    targetEngineId: string,
    targetViewportId: string,
    options: SynchronizationOptions = {},
  ) {
    // Input validation
    if (!sourceEngineId?.trim() || !sourceViewportId?.trim() || !targetEngineId?.trim() || !targetViewportId?.trim()) {
      throw new Error('ViewportSynchronizer: All engine and viewport IDs must be non-empty strings');
    }

    this.sourceEngineId = sourceEngineId;
    this.sourceViewportId = sourceViewportId;
    this.targetEngineId = targetEngineId;
    this.targetViewportId = targetViewportId;

    // Set default options with type safety
    this.options = {
      enableScroll: options.enableScroll ?? true,
      enableZoom: options.enableZoom ?? true,
      enableWindowLevel: options.enableWindowLevel ?? true,
      enableSliceSync: options.enableSliceSync ?? true,
      enableAnatomicalMapping: options.enableAnatomicalMapping ?? false,
    };

    // Initialize sync state
    this.syncState = {
      isEnabled: false,
      isSyncing: false,
      lastRenderTime: 0,
      sliceMapping: new Map(),
    };
  }

  enable(): void {
    if (this.syncState.isEnabled) return;

    const { sourceViewport, targetViewport } = this.getValidatedViewports();
    if (!sourceViewport || !targetViewport) {
      console.error('ViewportSynchronizer: Cannot enable - viewports not available');
      return;
    }

    try {
      this.setupSynchronization(sourceViewport, targetViewport);
      this.syncState.isEnabled = true;
      log.info('ViewportSynchronizer: Synchronization enabled successfully');
    } catch (error) {
      console.error('ViewportSynchronizer: Failed to enable synchronization', error);
      this.cleanup();
    }
  }

  disable(): void {
    if (!this.syncState.isEnabled) return;

    this.cleanup();
    this.syncState.isEnabled = false;
    log.info('ViewportSynchronizer: Synchronization disabled');
  }

  updateOptions(options: Partial<SynchronizationOptions>): void {
    if (!options || typeof options !== 'object') {
      console.warn('ViewportSynchronizer: Invalid options provided for update');
      return;
    }

    // Update options safely
    Object.keys(options).forEach(key => {
      if (Object.prototype.hasOwnProperty.call(this.options, key)) {
        const optionKey = key as keyof SynchronizationOptions;
        const value = safePropertyAccess(options, optionKey);
        if (typeof value === 'boolean') {
          // eslint-disable-next-line security/detect-object-injection -- Safe: optionKey is validated keyof SynchronizationOptions
          (this.options as any)[optionKey] = value;
        }
      }
    });

    // Restart synchronization with new options
    if (this.syncState.isEnabled) {
      this.disable();
      this.enable();
    }
  }

  isActive(): boolean {
    return this.syncState.isEnabled;
  }

  private getValidatedViewports(): {
    sourceViewport: ViewportLike | null;
    targetViewport: ViewportLike | null;
    } {
    const sourceEngine = getRenderingEngine(this.sourceEngineId);
    const targetEngine = getRenderingEngine(this.targetEngineId);

    if (!sourceEngine || !targetEngine) {
      console.warn('ViewportSynchronizer: Rendering engines not available', {
        sourceEngineAvailable: !!sourceEngine,
        targetEngineAvailable: !!targetEngine,
      });
      return { sourceViewport: null, targetViewport: null };
    }

    // Safe viewport access
    let sourceViewport: ViewportLike | null = null;
    let targetViewport: ViewportLike | null = null;

    try {
      if (this.hasGetViewportMethod(sourceEngine)) {
        sourceViewport = sourceEngine.getViewport(this.sourceViewportId);
      }
      if (this.hasGetViewportMethod(targetEngine)) {
        targetViewport = targetEngine.getViewport(this.targetViewportId);
      }
    } catch (error) {
      console.error('ViewportSynchronizer: Error accessing viewports', error);
      return { sourceViewport: null, targetViewport: null };
    }

    if (!sourceViewport || !targetViewport) {
      console.warn('ViewportSynchronizer: Viewports not found', {
        sourceViewportFound: !!sourceViewport,
        targetViewportFound: !!targetViewport,
      });
      return { sourceViewport: null, targetViewport: null };
    }

    return { sourceViewport, targetViewport };
  }

  private hasGetViewportMethod(engine: unknown): engine is { getViewport: (id: string) => ViewportLike } {
    return (
      typeof engine === 'object' &&
      engine !== null &&
      'getViewport' in engine &&
      typeof (engine as any).getViewport === 'function'
    );
  }

  private setupSynchronization(sourceViewport: ViewportLike, targetViewport: ViewportLike): void {
    // Setup camera synchronization
    if (this.options.enableZoom) {
      this.setupCameraSynchronization(sourceViewport, targetViewport);
    }

    // Setup slice synchronization
    if (this.options.enableScroll || this.options.enableSliceSync) {
      this.setupSliceSynchronization(sourceViewport, targetViewport);
    }

    // Setup window/level synchronization
    if (this.options.enableWindowLevel) {
      this.setupWindowLevelSynchronization(sourceViewport, targetViewport);
    }
  }

  private setupCameraSynchronization(sourceViewport: ViewportLike, targetViewport: ViewportLike): void {
    if (!sourceViewport.element) {
      console.warn('ViewportSynchronizer: Source viewport element not available for camera sync');
      return;
    }

    // Primary camera modification handler
    const cameraModifiedHandler = (_evt: Event): void => {
      this.handleCameraModification(sourceViewport, targetViewport);
    };

    sourceViewport.element.addEventListener('CORNERSTONE_CAMERA_MODIFIED', cameraModifiedHandler);
    this.listeners.set('CORNERSTONE_CAMERA_MODIFIED', cameraModifiedHandler);

    // Enhanced mouse interaction handlers for immediate feedback
    this.setupMouseBasedCameraSync(sourceViewport, targetViewport);

    // Image rendered handler for additional sync opportunities
    this.setupImageRenderedSync(sourceViewport, targetViewport);
  }

  private setupMouseBasedCameraSync(sourceViewport: ViewportLike, targetViewport: ViewportLike): void {
    if (!sourceViewport.element) return;

    let isInteracting = false;
    let interactionTimer: NodeJS.Timeout | null = null;

    const startInteraction = (): void => {
      isInteracting = true;
      log.info('ViewportSynchronizer: Camera interaction started');
    };

    const endInteraction = (): void => {
      isInteracting = false;
      if (interactionTimer) {
        clearInterval(interactionTimer);
        interactionTimer = null;
      }
      log.info('ViewportSynchronizer: Camera interaction ended');
    };

    const handleInteraction = (): void => {
      if (isInteracting && !interactionTimer) {
        interactionTimer = setInterval(() => {
          if (isInteracting && !this.syncState.isSyncing) {
            this.handleCameraModification(sourceViewport, targetViewport);
          }
        }, 50); // Sync every 50ms during interaction
      }
    };

    // Mouse events for pan/zoom
    sourceViewport.element.addEventListener('mousedown', startInteraction);
    sourceViewport.element.addEventListener('mouseup', endInteraction);
    sourceViewport.element.addEventListener('mousemove', handleInteraction);
    sourceViewport.element.addEventListener('mouseleave', endInteraction);

    // Touch events for mobile support
    sourceViewport.element.addEventListener('touchstart', startInteraction);
    sourceViewport.element.addEventListener('touchend', endInteraction);
    sourceViewport.element.addEventListener('touchmove', handleInteraction);

    // Store cleanup handlers
    this.listeners.set('mousedown_camera', startInteraction as EventListener);
    this.listeners.set('mouseup_camera', endInteraction as EventListener);
    this.listeners.set('mousemove_camera', handleInteraction as EventListener);
    this.listeners.set('mouseleave_camera', endInteraction as EventListener);
    this.listeners.set('touchstart_camera', startInteraction as EventListener);
    this.listeners.set('touchend_camera', endInteraction as EventListener);
    this.listeners.set('touchmove_camera', handleInteraction as EventListener);
  }

  private setupImageRenderedSync(sourceViewport: ViewportLike, targetViewport: ViewportLike): void {
    if (!sourceViewport.element) return;

    const imageRenderedHandler = (_evt: Event): void => {
      // Debounced sync for image rendered events
      if (this.syncState.isSyncing) return;

      const now = Date.now();
      if (now - this.syncState.lastRenderTime < 100) {
        // 100ms debounce
        return;
      }

      this.syncState.isSyncing = true;
      this.syncState.lastRenderTime = now;

      setTimeout(() => {
        this.handleCameraModification(sourceViewport, targetViewport);
        this.syncState.isSyncing = false;
      }, 16); // Next frame
    };

    sourceViewport.element.addEventListener('CORNERSTONE_IMAGE_RENDERED', imageRenderedHandler);
    this.listeners.set('CORNERSTONE_IMAGE_RENDERED', imageRenderedHandler);
  }

  private setupSliceSynchronization(sourceViewport: ViewportLike, targetViewport: ViewportLike): void {
    if (!sourceViewport.element) {
      console.warn('ViewportSynchronizer: Source viewport element not available for slice sync');
      return;
    }

    // Enhanced wheel handler with debouncing
    let wheelTimeout: NodeJS.Timeout | null = null;
    const wheelHandler = (evt: WheelEvent): void => {
      evt.preventDefault();

      // Debounce wheel events for smoother scrolling
      if (wheelTimeout) {
        clearTimeout(wheelTimeout);
      }

      wheelTimeout = setTimeout(() => {
        const delta = evt.deltaY > 0 ? 1 : -1;
        this.handleSliceNavigation(sourceViewport, targetViewport, delta);
      }, 10); // 10ms debounce
    };

    // Enhanced slice change handler for stack viewports
    const sliceChangedHandler = (_evt: Event): void => {
      if (!this.syncState.isSyncing) {
        this.handleSliceIndexChanged(sourceViewport, targetViewport);
      }
    };

    // Keyboard navigation handler
    const keyHandler = (evt: KeyboardEvent): void => {
      if (evt.target !== sourceViewport.element) return;

      let delta = 0;
      switch (evt.key) {
        case 'ArrowUp':
        case 'PageUp':
          delta = -1;
          break;
        case 'ArrowDown':
        case 'PageDown':
          delta = 1;
          break;
        default:
          return;
      }

      evt.preventDefault();
      this.handleSliceNavigation(sourceViewport, targetViewport, delta);
    };

    // Register event listeners
    sourceViewport.element.addEventListener('wheel', wheelHandler, { passive: false });
    sourceViewport.element.addEventListener('CORNERSTONE_STACK_NEW_IMAGE', sliceChangedHandler);
    sourceViewport.element.addEventListener('CORNERSTONE_IMAGE_VOLUME_MODIFIED', sliceChangedHandler);
    sourceViewport.element.addEventListener('keydown', keyHandler);

    // Store cleanup handlers
    this.listeners.set('wheel', wheelHandler as EventListener);
    this.listeners.set('CORNERSTONE_STACK_NEW_IMAGE', sliceChangedHandler);
    this.listeners.set('CORNERSTONE_IMAGE_VOLUME_MODIFIED', sliceChangedHandler);
    this.listeners.set('keydown_slice', keyHandler as EventListener);

    // Initialize anatomical mapping if enabled
    if (this.options.enableAnatomicalMapping) {
      this.initializeAnatomicalMapping(sourceViewport, targetViewport);
    }
  }

  private setupWindowLevelSynchronization(sourceViewport: ViewportLike, targetViewport: ViewportLike): void {
    if (!sourceViewport.element) {
      console.warn('ViewportSynchronizer: Source viewport element not available for W/L sync');
      return;
    }

    // Primary VOI modified handler
    const voiModifiedHandler = (_evt: Event): void => {
      this.handleWindowLevelChange(sourceViewport, targetViewport);
    };

    sourceViewport.element.addEventListener('CORNERSTONE_VOI_MODIFIED', voiModifiedHandler);
    this.listeners.set('CORNERSTONE_VOI_MODIFIED', voiModifiedHandler);

    // Enhanced mouse-based W/L sync for immediate feedback
    this.setupMouseBasedWindowLevelSync(sourceViewport, targetViewport);

    // Stack viewport new image handler for W/L sync
    this.setupImageLoadedSync(sourceViewport, targetViewport);
  }

  private setupMouseBasedWindowLevelSync(sourceViewport: ViewportLike, targetViewport: ViewportLike): void {
    if (!sourceViewport.element) return;

    let isAdjustingWL = false;
    let wlTimer: NodeJS.Timeout | null = null;

    const startWLAdjustment = (evt: MouseEvent): void => {
      // Check if right mouse button or specific key combination for W/L
      if (evt.button === 2 || (evt.button === 0 && evt.shiftKey)) {
        isAdjustingWL = true;
        log.info('ViewportSynchronizer: W/L adjustment started');
      }
    };

    const endWLAdjustment = (): void => {
      if (isAdjustingWL) {
        isAdjustingWL = false;
        if (wlTimer) {
          clearInterval(wlTimer);
          wlTimer = null;
        }
        log.info('ViewportSynchronizer: W/L adjustment ended');
      }
    };

    const handleWLAdjustment = (): void => {
      if (isAdjustingWL && !wlTimer) {
        wlTimer = setInterval(() => {
          if (isAdjustingWL && !this.syncState.isSyncing) {
            this.handleWindowLevelChange(sourceViewport, targetViewport);
          }
        }, 100); // Sync every 100ms during W/L adjustment
      }
    };

    // Mouse events for W/L adjustment
    sourceViewport.element.addEventListener('mousedown', startWLAdjustment);
    sourceViewport.element.addEventListener('mouseup', endWLAdjustment);
    sourceViewport.element.addEventListener('mousemove', handleWLAdjustment);
    sourceViewport.element.addEventListener('mouseleave', endWLAdjustment);

    // Context menu prevention for right-click W/L
    const preventContextMenu = (evt: Event): void => {
      if (isAdjustingWL) {
        evt.preventDefault();
      }
    };

    sourceViewport.element.addEventListener('contextmenu', preventContextMenu);

    // Store cleanup handlers
    this.listeners.set('mousedown_wl', startWLAdjustment as EventListener);
    this.listeners.set('mouseup_wl', endWLAdjustment as EventListener);
    this.listeners.set('mousemove_wl', handleWLAdjustment as EventListener);
    this.listeners.set('mouseleave_wl', endWLAdjustment as EventListener);
    this.listeners.set('contextmenu_wl', preventContextMenu);
  }

  private setupImageLoadedSync(sourceViewport: ViewportLike, targetViewport: ViewportLike): void {
    if (!sourceViewport.element) return;

    const imageLoadedHandler = (_evt: Event): void => {
      // Sync W/L when new image is loaded
      setTimeout(() => {
        this.handleWindowLevelChange(sourceViewport, targetViewport);
      }, 100); // Small delay to ensure image is fully loaded
    };

    // Listen for new image events
    sourceViewport.element.addEventListener('CORNERSTONE_STACK_NEW_IMAGE', imageLoadedHandler);
    sourceViewport.element.addEventListener('CORNERSTONE_IMAGE_LOADED', imageLoadedHandler);

    this.listeners.set('CORNERSTONE_STACK_NEW_IMAGE', imageLoadedHandler);
    this.listeners.set('CORNERSTONE_IMAGE_LOADED', imageLoadedHandler);
  }

  private handleCameraModification(sourceViewport: ViewportLike, targetViewport: ViewportLike): void {
    if (this.syncState.isSyncing) return;

    this.syncState.isSyncing = true;

    try {
      const sourceCamera = sourceViewport.getCamera?.();
      const targetCamera = targetViewport.getCamera?.();

      if (!sourceCamera) {
        console.warn('ViewportSynchronizer: Source camera not available');
        return;
      }

      if (!targetCamera) {
        console.warn('ViewportSynchronizer: Target camera not available');
        return;
      }

      // Create enhanced camera sync with validation
      const newCamera: CameraLike = this.createSynchronizedCamera(sourceCamera, targetCamera);

      // Apply camera with validation
      if (this.isValidCamera(newCamera)) {
        targetViewport.setCamera?.(newCamera);

        // Render with error handling
        this.safeRender(targetViewport, 'camera sync');

        // Update sync state timestamp
        this.syncState.lastRenderTime = Date.now();
      } else {
        console.warn('ViewportSynchronizer: Invalid camera state, skipping sync');
      }
    } catch (error) {
      console.error('ViewportSynchronizer: Camera synchronization failed', error);
    } finally {
      // Reset sync flag after a short delay
      setTimeout(() => {
        this.syncState.isSyncing = false;
      }, 16);
    }
  }

  private createSynchronizedCamera(sourceCamera: CameraLike, targetCamera: CameraLike): CameraLike {
    return {
      // Preserve target camera properties where appropriate, sync others
      position: sourceCamera.position
        ? ([...sourceCamera.position] as [number, number, number])
        : targetCamera.position,
      focalPoint: sourceCamera.focalPoint
        ? ([...sourceCamera.focalPoint] as [number, number, number])
        : targetCamera.focalPoint,
      viewUp: sourceCamera.viewUp ? ([...sourceCamera.viewUp] as [number, number, number]) : targetCamera.viewUp,
      parallelScale: sourceCamera.parallelScale ?? targetCamera.parallelScale,
      parallelProjection: sourceCamera.parallelProjection ?? targetCamera.parallelProjection,
      viewPlaneNormal: sourceCamera.viewPlaneNormal
        ? ([...sourceCamera.viewPlaneNormal] as [number, number, number])
        : targetCamera.viewPlaneNormal,
    };
  }

  private isValidCamera(camera: CameraLike): boolean {
    // Validate camera properties
    if (camera.position && camera.position.some(val => !isFinite(val))) {
      return false;
    }
    if (camera.focalPoint && camera.focalPoint.some(val => !isFinite(val))) {
      return false;
    }
    if (camera.viewUp && camera.viewUp.some(val => !isFinite(val))) {
      return false;
    }
    if (camera.parallelScale && (!isFinite(camera.parallelScale) || camera.parallelScale <= 0)) {
      return false;
    }
    return true;
  }

  private safeRender(viewport: ViewportLike, context: string): void {
    try {
      viewport.render?.();
    } catch (error) {
      console.error(`ViewportSynchronizer: Render failed during ${context}`, error);
    }
  }

  private handleSliceNavigation(sourceViewport: ViewportLike, targetViewport: ViewportLike, delta: number): void {
    if (this.syncState.isSyncing) return;

    this.syncState.isSyncing = true;

    try {
      // Handle stack viewports
      if (sourceViewport.getCurrentImageIdIndex && sourceViewport.setImageIdIndex && sourceViewport.getImageIds) {
        const currentIndex = sourceViewport.getCurrentImageIdIndex();
        const imageIds = sourceViewport.getImageIds();
        const newIndex = Math.max(0, Math.min(currentIndex + delta, imageIds.length - 1));

        sourceViewport.setImageIdIndex(newIndex);
        this.syncSliceByIndex(newIndex, targetViewport);
      }
      // Handle volume viewports
      else if (sourceViewport.scroll) {
        sourceViewport.scroll(delta);
        this.syncSliceByPosition(sourceViewport, targetViewport);
      }
    } finally {
      setTimeout(() => {
        this.syncState.isSyncing = false;
      }, 50);
    }
  }

  private handleWindowLevelChange(sourceViewport: ViewportLike, targetViewport: ViewportLike): void {
    if (this.syncState.isSyncing) return;

    this.syncState.isSyncing = true;

    try {
      const sourceProperties = sourceViewport.getProperties?.();
      const targetProperties = targetViewport.getProperties?.();

      if (!sourceProperties?.voiRange) {
        console.warn('ViewportSynchronizer: Source VOI range not available');
        return;
      }

      // Enhanced VOI range validation and synchronization
      const sourceVOI = sourceProperties.voiRange;
      const synchronizedVOI = this.createSynchronizedVOI(sourceVOI, targetProperties?.voiRange);

      if (this.isValidVOIRange(synchronizedVOI)) {
        // Apply synchronized VOI range
        targetViewport.setProperties?.({ voiRange: synchronizedVOI });

        // Safe render with context
        this.safeRender(targetViewport, 'window/level sync');

        // Update sync state
        this.syncState.lastRenderTime = Date.now();

        log.info('ViewportSynchronizer: W/L synchronized', {
          window: synchronizedVOI.upper - synchronizedVOI.lower,
          level: (synchronizedVOI.upper + synchronizedVOI.lower) / 2,
        });
      } else {
        console.warn('ViewportSynchronizer: Invalid VOI range, skipping sync', synchronizedVOI);
      }
    } catch (error) {
      console.error('ViewportSynchronizer: Window/Level synchronization failed', error);
    } finally {
      // Reset sync flag after a delay
      setTimeout(() => {
        this.syncState.isSyncing = false;
      }, 50);
    }
  }

  private createSynchronizedVOI(sourceVOI: VOIRange, _targetVOI?: VOIRange): VOIRange {
    // Create synchronized VOI with fallback to target values if needed
    return {
      lower: sourceVOI.lower,
      upper: sourceVOI.upper,
    };
  }

  private isValidVOIRange(voiRange: VOIRange): boolean {
    // Validate VOI range properties
    if (!isFinite(voiRange.lower) || !isFinite(voiRange.upper)) {
      return false;
    }
    if (voiRange.lower >= voiRange.upper) {
      return false;
    }
    // Check for reasonable ranges (avoid extreme values)
    const window = voiRange.upper - voiRange.lower;
    if (window <= 0 || window > 100000) {
      return false;
    }
    return true;
  }

  private syncSliceByIndex(sourceIndex: number, targetViewport: ViewportLike): void {
    try {
      let targetIndex = sourceIndex;

      // Use anatomical mapping if enabled and available
      if (this.options.enableAnatomicalMapping && this.syncState.sliceMapping.has(sourceIndex)) {
        const mappedIndex = this.syncState.sliceMapping.get(sourceIndex);
        if (mappedIndex !== undefined) {
          targetIndex = mappedIndex;
          log.info('ViewportSynchronizer: Using anatomical mapping', { sourceIndex, targetIndex });
        }
      }

      if (targetViewport.setImageIdIndex && targetViewport.getImageIds) {
        const targetImageIds = targetViewport.getImageIds();

        // Validate target index bounds
        if (targetIndex >= 0 && targetIndex < targetImageIds.length) {
          targetViewport.setImageIdIndex(targetIndex);
          this.safeRender(targetViewport, 'slice index sync');

          // Update sync state
          this.syncState.lastRenderTime = Date.now();
          log.info('ViewportSynchronizer: Slice synchronized by index', {
            sourceIndex,
            targetIndex,
            totalSlices: targetImageIds.length,
          });
        } else {
          console.warn('ViewportSynchronizer: Target index out of bounds', {
            targetIndex,
            maxIndex: targetImageIds.length - 1,
          });
        }
      } else {
        console.warn('ViewportSynchronizer: Target viewport does not support index-based navigation');
      }
    } catch (error) {
      console.error('ViewportSynchronizer: Slice index synchronization failed', error);
    }
  }

  private syncSliceByPosition(sourceViewport: ViewportLike, targetViewport: ViewportLike): void {
    try {
      const sourceCamera = sourceViewport.getCamera?.();
      if (!sourceCamera?.focalPoint) {
        console.warn('ViewportSynchronizer: Source camera focal point not available for position sync');
        return;
      }

      // Validate source focal point
      if (!this.isValidVector3(sourceCamera.focalPoint)) {
        console.warn('ViewportSynchronizer: Invalid source focal point', sourceCamera.focalPoint);
        return;
      }

      if (targetViewport.setCamera) {
        const targetCamera = targetViewport.getCamera?.();
        if (targetCamera) {
          // Create synchronized camera with enhanced validation
          const newCamera: CameraLike = {
            ...targetCamera,
            focalPoint: [...sourceCamera.focalPoint] as [number, number, number],
          };

          // Validate the new camera before applying
          if (this.isValidCamera(newCamera)) {
            targetViewport.setCamera(newCamera);
            this.safeRender(targetViewport, 'slice position sync');

            // Update sync state
            this.syncState.lastRenderTime = Date.now();
            log.info('ViewportSynchronizer: Slice synchronized by position', {
              focalPoint: newCamera.focalPoint,
            });
          } else {
            console.warn('ViewportSynchronizer: Invalid camera for position sync');
          }
        } else {
          console.warn('ViewportSynchronizer: Target camera not available for position sync');
        }
      } else {
        console.warn('ViewportSynchronizer: Target viewport does not support camera-based navigation');
      }
    } catch (error) {
      console.error('ViewportSynchronizer: Slice position synchronization failed', error);
    }
  }

  private isValidVector3(vector: [number, number, number]): boolean {
    return vector.length === 3 && vector.every(val => isFinite(val));
  }

  // New methods for enhanced slice synchronization

  private handleSliceIndexChanged(sourceViewport: ViewportLike, targetViewport: ViewportLike): void {
    if (this.syncState.isSyncing) return;

    try {
      // Get current slice index from source viewport
      const currentIndex = sourceViewport.getCurrentImageIdIndex?.();
      if (currentIndex !== undefined) {
        this.syncSliceByIndex(currentIndex, targetViewport);
      }
    } catch (error) {
      console.error('ViewportSynchronizer: Slice index change handling failed', error);
    }
  }

  private initializeAnatomicalMapping(sourceViewport: ViewportLike, targetViewport: ViewportLike): void {
    try {
      log.info('ViewportSynchronizer: Initializing anatomical mapping');

      // Get image information from both viewports
      const sourceImages = sourceViewport.getImageIds?.();
      const targetImages = targetViewport.getImageIds?.();

      if (!sourceImages || !targetImages) {
        console.warn('ViewportSynchronizer: Cannot initialize anatomical mapping - image IDs not available');
        return;
      }

      // For now, create a simple 1:1 mapping
      // In a real implementation, this would analyze DICOM metadata for anatomical positions
      const mappingCount = Math.min(sourceImages.length, targetImages.length);

      this.syncState.sliceMapping.clear();
      for (let i = 0; i < mappingCount; i++) {
        this.syncState.sliceMapping.set(i, i);
      }

      log.info('ViewportSynchronizer: Anatomical mapping initialized', {
        sourceSlices: sourceImages.length,
        targetSlices: targetImages.length,
        mappedSlices: mappingCount,
      });
    } catch (error) {
      console.error('ViewportSynchronizer: Anatomical mapping initialization failed', error);
    }
  }

  // Enhanced cleanup with better event listener management
  private cleanup(): void {
    // Remove all event listeners with comprehensive cleanup
    const { sourceViewport } = this.getValidatedViewports();
    if (sourceViewport?.element) {
      this.listeners.forEach((handler, eventType) => {
        try {
          // Handle special event types that might use different removal patterns
          if (eventType.includes('_')) {
            // Extract base event type for complex handlers
            const baseEventType = eventType.split('_')[0];
            sourceViewport.element?.removeEventListener(baseEventType, handler);
          } else {
            sourceViewport.element?.removeEventListener(eventType, handler);
          }
        } catch (error) {
          console.warn(`ViewportSynchronizer: Failed to remove event listener ${eventType}`, error);
        }
      });
    }

    // Clear all references and state
    this.listeners.clear();
    this.syncState.sliceMapping.clear();
    this.syncState.isSyncing = false;
    this.syncState.lastRenderTime = 0;

    log.info('ViewportSynchronizer: Cleanup completed', {
      sourceEngineId: this.sourceEngineId,
      targetEngineId: this.targetEngineId,
    });
  }
}

// Factory function for creating bidirectional synchronization
export function createBidirectionalSync(
  engineIdA: string,
  viewportIdA: string,
  engineIdB: string,
  viewportIdB: string,
  options?: SynchronizationOptions,
): { syncAtoB: ViewportSynchronizer; syncBtoA: ViewportSynchronizer } {
  const syncAtoB = new ViewportSynchronizer(engineIdA, viewportIdA, engineIdB, viewportIdB, options);
  const syncBtoA = new ViewportSynchronizer(engineIdB, viewportIdB, engineIdA, viewportIdA, options);

  return { syncAtoB, syncBtoA };
}

// Enhanced Zoom and Pan Synchronization Utilities
import { viewportSynchronizer as globalSynchronizer } from '../services/ViewportSynchronizer';

/**
 * Synchronizes zoom level across all viewports in the same group
 */
export const synchronizeZoomGlobal = (sourceViewportId: string, zoomLevel: number): void => {
  try {
    globalSynchronizer.updateViewportState(sourceViewportId, { zoom: zoomLevel }, true);

    log.info('Global zoom synchronization triggered', {
      sourceViewportId,
      zoomLevel,
    });
  } catch (error) {
    console.error('Failed to synchronize zoom globally', {
      sourceViewportId,
      zoomLevel,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Synchronizes pan position across all viewports in the same group
 */
export const synchronizePanGlobal = (sourceViewportId: string, panPosition: [number, number]): void => {
  try {
    globalSynchronizer.updateViewportState(sourceViewportId, { pan: panPosition }, true);

    log.info('Global pan synchronization triggered', {
      sourceViewportId,
      panPosition,
    });
  } catch (error) {
    console.error('Failed to synchronize pan globally', {
      sourceViewportId,
      panPosition,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Gets current zoom level from global synchronizer
 */
export const getGlobalViewportZoom = (viewportId: string): number => {
  const state = globalSynchronizer.getViewportState(viewportId);
  return state?.zoom || 1.0;
};

/**
 * Gets current pan position from global synchronizer
 */
export const getGlobalViewportPan = (viewportId: string): [number, number] => {
  const state = globalSynchronizer.getViewportState(viewportId);
  return state?.pan || [0, 0];
};

/**
 * Resets zoom and pan for all viewports
 */
export const resetZoomPanGlobal = (viewportIds: string[]): void => {
  try {
    for (const viewportId of viewportIds) {
      globalSynchronizer.updateViewportState(
        viewportId,
        {
          zoom: 1.0,
          pan: [0, 0],
        },
        false,
      );
    }

    // Trigger sync from first viewport
    if (viewportIds.length > 0) {
      globalSynchronizer.synchronize('zoom', viewportIds[0], { zoom: 1.0 });
      globalSynchronizer.synchronize('pan', viewportIds[0], { pan: [0, 0] });
    }

    log.info('Global zoom and pan reset completed', {
      affectedViewports: viewportIds.length,
    });
  } catch (error) {
    console.error('Failed to reset zoom and pan globally', {
      viewportIds,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
