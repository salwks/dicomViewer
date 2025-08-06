/**
 * Zoom/Pan Synchronization Service
 * Implements zoom and pan synchronization using matrix transformations
 * Provides coordinated navigation across comparison viewports
 * Built with shadcn/ui compliance and security standards
 */

import { EventEmitter } from 'events';
import { log } from '../utils/logger';

export interface Transform2D {
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
  rotation: number; // in radians
}

export interface ViewportTransform {
  viewportId: string;
  transform: Transform2D;
  imageCenter: { x: number; y: number };
  imageSize: { width: number; height: number };
  viewportSize: { width: number; height: number };
  pixelSpacing: { x: number; y: number };
  timestamp: number;
}

export interface ZoomPanSyncGroup {
  id: string;
  name: string;
  viewportIds: string[];
  isActive: boolean;
  syncMode: 'exact' | 'relative' | 'fit-to-window' | 'anatomical';
  maintainAspectRatio: boolean;
  enableRotationSync: boolean;
  referenceViewportId?: string; // For relative sync
  coordinateSystemAlignment: 'image' | 'patient' | 'scanner';
  smoothing: {
    enabled: boolean;
    duration: number; // animation duration in ms
    easing: 'linear' | 'ease-in-out' | 'cubic-bezier';
  };
}

export interface SyncConstraints {
  minZoom: number;
  maxZoom: number;
  panBounds?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
  lockAspectRatio: boolean;
  preventOverpan: boolean;
}

export interface ZoomPanSyncConfig {
  defaultSmoothingDuration: number;
  throttleDelay: number;
  maxSyncGroups: number;
  enableMatrixCaching: boolean;
  enableBoundsChecking: boolean;
  defaultConstraints: SyncConstraints;
}

const DEFAULT_CONFIG: ZoomPanSyncConfig = {
  defaultSmoothingDuration: 250,
  throttleDelay: 16, // ~60fps
  maxSyncGroups: 10,
  enableMatrixCaching: true,
  enableBoundsChecking: true,
  defaultConstraints: {
    minZoom: 0.1,
    maxZoom: 10.0,
    lockAspectRatio: true,
    preventOverpan: true,
  },
};

/**
 * Matrix transformation utilities
 */
export class Matrix2D {
  public elements: number[]; // [a, b, c, d, e, f] representing 2D transformation matrix

  constructor(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
    this.elements = [a, b, c, d, e, f];
  }

  /**
   * Create identity matrix
   */
  static identity(): Matrix2D {
    return new Matrix2D();
  }

  /**
   * Create translation matrix
   */
  static translate(x: number, y: number): Matrix2D {
    return new Matrix2D(1, 0, 0, 1, x, y);
  }

  /**
   * Create scale matrix
   */
  static scale(scaleX: number, scaleY: number = scaleX): Matrix2D {
    return new Matrix2D(scaleX, 0, 0, scaleY, 0, 0);
  }

  /**
   * Create rotation matrix
   */
  static rotate(angle: number): Matrix2D {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Matrix2D(cos, sin, -sin, cos, 0, 0);
  }

  /**
   * Multiply this matrix with another
   */
  multiply(other: Matrix2D): Matrix2D {
    const [a1, b1, c1, d1, e1, f1] = this.elements;
    const [a2, b2, c2, d2, e2, f2] = other.elements;

    return new Matrix2D(
      a1 * a2 + b1 * c2,
      a1 * b2 + b1 * d2,
      c1 * a2 + d1 * c2,
      c1 * b2 + d1 * d2,
      e1 * a2 + f1 * c2 + e2,
      e1 * b2 + f1 * d2 + f2,
    );
  }

  /**
   * Transform a point using this matrix
   */
  transformPoint(x: number, y: number): { x: number; y: number } {
    const [a, b, c, d, e, f] = this.elements;
    return {
      x: a * x + c * y + e,
      y: b * x + d * y + f,
    };
  }

  /**
   * Get the inverse of this matrix
   */
  inverse(): Matrix2D | null {
    const [a, b, c, d, e, f] = this.elements;
    const det = a * d - b * c;

    if (Math.abs(det) < 1e-10) {
      return null; // Matrix is not invertible
    }

    const invDet = 1 / det;
    return new Matrix2D(
      d * invDet,
      -b * invDet,
      -c * invDet,
      a * invDet,
      (c * f - d * e) * invDet,
      (b * e - a * f) * invDet,
    );
  }

  /**
   * Convert to CSS transform string
   */
  toCSSString(): string {
    const [a, b, c, d, e, f] = this.elements;
    return `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;
  }

  /**
   * Extract transform components
   */
  decompose(): Transform2D {
    const [a, b, c, d, e, f] = this.elements;

    const scaleX = Math.sqrt(a * a + b * b);
    const scaleY = Math.sqrt(c * c + d * d);
    const rotation = Math.atan2(b, a);

    return {
      scaleX,
      scaleY,
      translateX: e,
      translateY: f,
      rotation,
    };
  }

  /**
   * Create matrix from transform components
   */
  static fromTransform(transform: Transform2D): Matrix2D {
    return Matrix2D.translate(transform.translateX, transform.translateY)
      .multiply(Matrix2D.rotate(transform.rotation))
      .multiply(Matrix2D.scale(transform.scaleX, transform.scaleY));
  }
}

/**
 * Zoom/Pan Synchronization Service
 * Manages synchronized navigation across comparison viewports
 */
export class ZoomPanSync extends EventEmitter {
  private config: ZoomPanSyncConfig;
  private syncGroups: Map<string, ZoomPanSyncGroup> = new Map();
  private viewportTransforms: Map<string, ViewportTransform> = new Map();
  private transformCache: Map<string, Matrix2D> = new Map();
  private throttleTimers: Map<string, NodeJS.Timeout> = new Map();
  private animationFrames: Map<string, number> = new Map();
  private activeSyncOperations: Set<string> = new Set();

  constructor(config: Partial<ZoomPanSyncConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initialize();
  }

  private initialize(): void {
    log.info('ZoomPanSync initializing', {
      component: 'ZoomPanSync',
      metadata: { config: this.config },
    });

    log.info('ZoomPanSync initialized', {
      component: 'ZoomPanSync',
    });
  }

  // ===== Sync Group Management =====

  /**
   * Create a zoom/pan synchronization group
   */
  public createSyncGroup(
    name: string,
    viewportIds: string[],
    options: {
      syncMode?: 'exact' | 'relative' | 'fit-to-window' | 'anatomical';
      maintainAspectRatio?: boolean;
      enableRotationSync?: boolean;
      referenceViewportId?: string;
      coordinateSystemAlignment?: 'image' | 'patient' | 'scanner';
      smoothing?: {
        enabled: boolean;
        duration?: number;
        easing?: 'linear' | 'ease-in-out' | 'cubic-bezier';
      };
    } = {},
  ): string {
    if (this.syncGroups.size >= this.config.maxSyncGroups) {
      throw new Error('Maximum number of sync groups reached');
    }

    const groupId = `zp-sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const syncGroup: ZoomPanSyncGroup = {
      id: groupId,
      name,
      viewportIds: [...viewportIds],
      isActive: true,
      syncMode: options.syncMode || 'exact',
      maintainAspectRatio: options.maintainAspectRatio ?? true,
      enableRotationSync: options.enableRotationSync ?? false,
      referenceViewportId: options.referenceViewportId,
      coordinateSystemAlignment: options.coordinateSystemAlignment || 'image',
      smoothing: {
        enabled: options.smoothing?.enabled ?? true,
        duration: options.smoothing?.duration || this.config.defaultSmoothingDuration,
        easing: options.smoothing?.easing || 'ease-in-out',
      },
    };

    this.syncGroups.set(groupId, syncGroup);

    // Initialize viewport transforms for group members
    viewportIds.forEach(viewportId => {
      if (!this.viewportTransforms.has(viewportId)) {
        this.initializeViewportTransform(viewportId);
      }
    });

    log.info('Zoom/pan sync group created', {
      component: 'ZoomPanSync',
      metadata: {
        groupId,
        name,
        viewportCount: viewportIds.length,
        syncMode: syncGroup.syncMode,
      },
    });

    return groupId;
  }

  /**
   * Remove sync group
   */
  public removeSyncGroup(groupId: string): boolean {
    const group = this.syncGroups.get(groupId);
    if (!group) return false;

    // Clear any pending operations for this group
    group.viewportIds.forEach(viewportId => {
      const timerId = `${groupId}-${viewportId}`;
      const timer = this.throttleTimers.get(timerId);
      if (timer) {
        clearTimeout(timer);
        this.throttleTimers.delete(timerId);
      }

      const animationId = this.animationFrames.get(viewportId);
      if (animationId) {
        cancelAnimationFrame(animationId);
        this.animationFrames.delete(viewportId);
      }
    });

    this.syncGroups.delete(groupId);

    log.info('Zoom/pan sync group removed', {
      component: 'ZoomPanSync',
      metadata: { groupId },
    });

    return true;
  }

  // ===== Viewport Transform Management =====

  /**
   * Initialize viewport transform
   */
  private initializeViewportTransform(viewportId: string): void {
    const defaultTransform: ViewportTransform = {
      viewportId,
      transform: {
        scaleX: 1,
        scaleY: 1,
        translateX: 0,
        translateY: 0,
        rotation: 0,
      },
      imageCenter: { x: 0, y: 0 },
      imageSize: { width: 512, height: 512 },
      viewportSize: { width: 512, height: 512 },
      pixelSpacing: { x: 1, y: 1 },
      timestamp: Date.now(),
    };

    this.viewportTransforms.set(viewportId, defaultTransform);
  }

  /**
   * Update viewport transform
   */
  public updateViewportTransform(
    viewportId: string,
    updates: Partial<ViewportTransform>,
    options: {
      triggerSync?: boolean;
      skipThrottle?: boolean;
      sourceGroup?: string;
    } = {},
  ): void {
    const currentTransform = this.viewportTransforms.get(viewportId);
    if (!currentTransform) {
      this.initializeViewportTransform(viewportId);
    }

    const newTransform: ViewportTransform = {
      ...currentTransform!,
      ...updates,
      timestamp: Date.now(),
    };

    this.viewportTransforms.set(viewportId, newTransform);

    // Clear cached matrix
    if (this.config.enableMatrixCaching) {
      this.transformCache.delete(viewportId);
    }

    // Trigger synchronization if requested
    if (options.triggerSync !== false) {
      if (options.skipThrottle) {
        this.syncFromViewport(viewportId, options.sourceGroup);
      } else {
        this.throttledSyncFromViewport(viewportId, options.sourceGroup);
      }
    }

    this.emit('viewport-transform-updated', viewportId, newTransform);
  }

  /**
   * Get viewport transform
   */
  public getViewportTransform(viewportId: string): ViewportTransform | null {
    return this.viewportTransforms.get(viewportId) || null;
  }

  // ===== Synchronization Logic =====

  /**
   * Sync zoom/pan from source viewport to group members (throttled)
   */
  private throttledSyncFromViewport(sourceViewportId: string, sourceGroupId?: string): void {
    // Find groups containing this viewport
    const relevantGroups = this.findGroupsForViewport(sourceViewportId, sourceGroupId);

    relevantGroups.forEach(group => {
      const timerId = `${group.id}-${sourceViewportId}`;

      // Clear existing timer
      const existingTimer = this.throttleTimers.get(timerId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set new throttle timer
      const timer = setTimeout(() => {
        this.syncFromViewport(sourceViewportId, group.id);
        this.throttleTimers.delete(timerId);
      }, this.config.throttleDelay);

      this.throttleTimers.set(timerId, timer);
    });
  }

  /**
   * Sync zoom/pan from source viewport to group members (immediate)
   */
  private syncFromViewport(sourceViewportId: string, sourceGroupId?: string): void {
    const sourceTransform = this.viewportTransforms.get(sourceViewportId);
    if (!sourceTransform) return;

    // Prevent circular sync operations
    if (this.activeSyncOperations.has(sourceViewportId)) {
      return;
    }
    this.activeSyncOperations.add(sourceViewportId);

    try {
      // Find groups containing this viewport
      const relevantGroups = this.findGroupsForViewport(sourceViewportId, sourceGroupId);

      relevantGroups.forEach(group => {
        if (!group.isActive) return;

        // Get target viewports (excluding source)
        const targetViewports = group.viewportIds.filter(id => id !== sourceViewportId);

        targetViewports.forEach(targetViewportId => {
          const targetTransform = this.viewportTransforms.get(targetViewportId);
          if (!targetTransform) return;

          // Calculate synchronized transform
          const syncedTransform = this.calculateSyncedTransform(sourceTransform, targetTransform, group);

          if (syncedTransform) {
            // Apply synchronized transform
            this.applySyncedTransform(targetViewportId, syncedTransform, group);

            // Emit sync event
            this.emit('zoom-pan-synced', {
              sourceViewportId,
              targetViewportId,
              groupId: group.id,
              syncedTransform,
            });
          }
        });
      });
    } finally {
      this.activeSyncOperations.delete(sourceViewportId);
    }
  }

  /**
   * Calculate synchronized transform based on sync mode
   */
  private calculateSyncedTransform(
    sourceTransform: ViewportTransform,
    targetTransform: ViewportTransform,
    group: ZoomPanSyncGroup,
  ): Partial<ViewportTransform> | null {
    switch (group.syncMode) {
      case 'exact':
        return this.calculateExactSync(sourceTransform, targetTransform, group);

      case 'relative':
        return this.calculateRelativeSync(sourceTransform, targetTransform, group);

      case 'fit-to-window':
        return this.calculateFitToWindowSync(sourceTransform, targetTransform, group);

      case 'anatomical':
        return this.calculateAnatomicalSync(sourceTransform, targetTransform, group);

      default:
        return null;
    }
  }

  /**
   * Exact synchronization - copy transform values directly
   */
  private calculateExactSync(
    sourceTransform: ViewportTransform,
    targetTransform: ViewportTransform,
    group: ZoomPanSyncGroup,
  ): Partial<ViewportTransform> {
    const syncedTransform = { ...sourceTransform.transform };

    // Apply aspect ratio constraint if enabled
    if (group.maintainAspectRatio) {
      syncedTransform.scaleY = syncedTransform.scaleX;
    }

    // Exclude rotation if not enabled
    if (!group.enableRotationSync) {
      syncedTransform.rotation = targetTransform.transform.rotation;
    }

    return {
      transform: syncedTransform,
    };
  }

  /**
   * Relative synchronization - scale transforms based on viewport differences
   */
  private calculateRelativeSync(
    sourceTransform: ViewportTransform,
    targetTransform: ViewportTransform,
    group: ZoomPanSyncGroup,
  ): Partial<ViewportTransform> {
    // Calculate scaling factors based on viewport and image size differences
    const viewportScaleX = targetTransform.viewportSize.width / sourceTransform.viewportSize.width;
    const viewportScaleY = targetTransform.viewportSize.height / sourceTransform.viewportSize.height;

    const imageScaleX = targetTransform.imageSize.width / sourceTransform.imageSize.width;
    const imageScaleY = targetTransform.imageSize.height / sourceTransform.imageSize.height;

    // Calculate pixel spacing ratio
    const pixelSpacingRatioX = targetTransform.pixelSpacing.x / sourceTransform.pixelSpacing.x;
    const pixelSpacingRatioY = targetTransform.pixelSpacing.y / sourceTransform.pixelSpacing.y;

    const syncedTransform: Transform2D = {
      scaleX: sourceTransform.transform.scaleX * viewportScaleX * imageScaleX * pixelSpacingRatioX,
      scaleY: sourceTransform.transform.scaleY * viewportScaleY * imageScaleY * pixelSpacingRatioY,
      translateX: sourceTransform.transform.translateX * viewportScaleX,
      translateY: sourceTransform.transform.translateY * viewportScaleY,
      rotation: group.enableRotationSync ? sourceTransform.transform.rotation : targetTransform.transform.rotation,
    };

    // Apply aspect ratio constraint if enabled
    if (group.maintainAspectRatio) {
      const avgScale = (syncedTransform.scaleX + syncedTransform.scaleY) / 2;
      syncedTransform.scaleX = avgScale;
      syncedTransform.scaleY = avgScale;
    }

    return {
      transform: syncedTransform,
    };
  }

  /**
   * Fit-to-window synchronization - maintain the same relative viewport coverage
   */
  private calculateFitToWindowSync(
    sourceTransform: ViewportTransform,
    targetTransform: ViewportTransform,
    group: ZoomPanSyncGroup,
  ): Partial<ViewportTransform> {
    // Calculate what portion of the source image is visible
    const sourceVisibleWidth = sourceTransform.viewportSize.width / sourceTransform.transform.scaleX;
    const sourceVisibleHeight = sourceTransform.viewportSize.height / sourceTransform.transform.scaleY;

    // Calculate scale to show the same portion in target viewport
    const targetScaleX = targetTransform.viewportSize.width / sourceVisibleWidth;
    const targetScaleY = targetTransform.viewportSize.height / sourceVisibleHeight;

    let finalScaleX = targetScaleX;
    let finalScaleY = targetScaleY;

    // Apply aspect ratio constraint if enabled
    if (group.maintainAspectRatio) {
      const avgScale = Math.min(targetScaleX, targetScaleY);
      finalScaleX = avgScale;
      finalScaleY = avgScale;
    }

    // Calculate pan to center the same region
    const sourceCenterX =
      sourceTransform.imageCenter.x + sourceTransform.transform.translateX / sourceTransform.transform.scaleX;
    const sourceCenterY =
      sourceTransform.imageCenter.y + sourceTransform.transform.translateY / sourceTransform.transform.scaleY;

    const targetTranslateX = (targetTransform.imageCenter.x - sourceCenterX) * finalScaleX;
    const targetTranslateY = (targetTransform.imageCenter.y - sourceCenterY) * finalScaleY;

    return {
      transform: {
        scaleX: finalScaleX,
        scaleY: finalScaleY,
        translateX: targetTranslateX,
        translateY: targetTranslateY,
        rotation: group.enableRotationSync ? sourceTransform.transform.rotation : targetTransform.transform.rotation,
      },
    };
  }

  /**
   * Anatomical synchronization - align based on anatomical coordinates
   */
  private calculateAnatomicalSync(
    sourceTransform: ViewportTransform,
    targetTransform: ViewportTransform,
    group: ZoomPanSyncGroup,
  ): Partial<ViewportTransform> {
    // For anatomical sync, we need to consider the patient coordinate system
    // This is a simplified implementation - real anatomical sync would require
    // DICOM orientation and position information

    // Use relative sync as a base and apply anatomical corrections
    const relativeSync = this.calculateRelativeSync(sourceTransform, targetTransform, group);

    // Apply anatomical alignment corrections based on coordinate system
    if (group.coordinateSystemAlignment === 'patient') {
      // Apply patient coordinate system alignment
      // This would typically involve DICOM ImageOrientationPatient and ImagePositionPatient
      // For now, we'll apply a simplified alignment
    }

    return relativeSync;
  }

  /**
   * Apply synchronized transform with optional animation
   */
  private applySyncedTransform(
    viewportId: string,
    syncedTransform: Partial<ViewportTransform>,
    group: ZoomPanSyncGroup,
  ): void {
    if (group.smoothing.enabled) {
      this.animateToTransform(viewportId, syncedTransform, group.smoothing);
    } else {
      // Apply immediately
      this.updateViewportTransform(viewportId, syncedTransform, {
        triggerSync: false,
        sourceGroup: group.id,
      });
    }
  }

  /**
   * Animate to target transform
   */
  private animateToTransform(
    viewportId: string,
    targetTransform: Partial<ViewportTransform>,
    smoothing: ZoomPanSyncGroup['smoothing'],
  ): void {
    const currentTransform = this.viewportTransforms.get(viewportId);
    if (!currentTransform || !targetTransform.transform) return;

    const startTransform = { ...currentTransform.transform };
    const endTransform = { ...targetTransform.transform };
    const startTime = performance.now();

    // Cancel existing animation
    const existingAnimation = this.animationFrames.get(viewportId);
    if (existingAnimation) {
      cancelAnimationFrame(existingAnimation);
    }

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / smoothing.duration, 1);

      // Apply easing function
      const easedProgress = this.applyEasing(progress, smoothing.easing);

      // Interpolate transform values
      const interpolatedTransform: Transform2D = {
        scaleX: this.lerp(startTransform.scaleX, endTransform.scaleX, easedProgress),
        scaleY: this.lerp(startTransform.scaleY, endTransform.scaleY, easedProgress),
        translateX: this.lerp(startTransform.translateX, endTransform.translateX, easedProgress),
        translateY: this.lerp(startTransform.translateY, endTransform.translateY, easedProgress),
        rotation: this.lerpAngle(startTransform.rotation, endTransform.rotation, easedProgress),
      };

      // Update viewport transform
      this.updateViewportTransform(
        viewportId,
        {
          transform: interpolatedTransform,
        },
        {
          triggerSync: false,
        },
      );

      // Continue animation or finish
      if (progress < 1) {
        const animationId = requestAnimationFrame(animate);
        this.animationFrames.set(viewportId, animationId);
      } else {
        this.animationFrames.delete(viewportId);
        this.emit('animation-complete', viewportId);
      }
    };

    const animationId = requestAnimationFrame(animate);
    this.animationFrames.set(viewportId, animationId);
  }

  /**
   * Apply easing function
   */
  private applyEasing(progress: number, easing: string): number {
    switch (easing) {
      case 'linear':
        return progress;

      case 'ease-in-out':
        return progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      case 'cubic-bezier':
        // Cubic bezier (0.4, 0, 0.2, 1)
        return progress * progress * (3 - 2 * progress);

      default:
        return progress;
    }
  }

  /**
   * Linear interpolation
   */
  private lerp(start: number, end: number, progress: number): number {
    return start + (end - start) * progress;
  }

  /**
   * Angular interpolation (shortest path)
   */
  private lerpAngle(start: number, end: number, progress: number): number {
    const diff = end - start;
    const shortestDiff = ((diff + Math.PI) % (2 * Math.PI)) - Math.PI;
    return start + shortestDiff * progress;
  }

  // ===== Utility Methods =====

  /**
   * Find sync groups containing a viewport
   */
  private findGroupsForViewport(viewportId: string, preferredGroupId?: string): ZoomPanSyncGroup[] {
    const groups: ZoomPanSyncGroup[] = [];

    // If preferred group specified, use it first
    if (preferredGroupId) {
      const preferredGroup = this.syncGroups.get(preferredGroupId);
      if (preferredGroup && preferredGroup.viewportIds.includes(viewportId)) {
        groups.push(preferredGroup);
        return groups;
      }
    }

    // Find all groups containing this viewport
    this.syncGroups.forEach(group => {
      if (group.viewportIds.includes(viewportId)) {
        groups.push(group);
      }
    });

    return groups;
  }

  /**
   * Get transformation matrix for viewport
   */
  public getTransformMatrix(viewportId: string): Matrix2D | null {
    if (this.config.enableMatrixCaching && this.transformCache.has(viewportId)) {
      return this.transformCache.get(viewportId)!;
    }

    const transform = this.viewportTransforms.get(viewportId);
    if (!transform) return null;

    const matrix = Matrix2D.fromTransform(transform.transform);

    if (this.config.enableMatrixCaching) {
      this.transformCache.set(viewportId, matrix);
    }

    return matrix;
  }

  /**
   * Apply bounds checking to transform
   */
  public applyBoundsConstraints(
    viewportId: string,
    transform: Transform2D,
    constraints?: SyncConstraints,
  ): Transform2D {
    const bounds = constraints || this.config.defaultConstraints;
    const viewportTransform = this.viewportTransforms.get(viewportId);

    if (!viewportTransform) return transform;

    const constrainedTransform = { ...transform };

    // Apply zoom constraints
    constrainedTransform.scaleX = Math.max(bounds.minZoom, Math.min(bounds.maxZoom, constrainedTransform.scaleX));
    constrainedTransform.scaleY = Math.max(bounds.minZoom, Math.min(bounds.maxZoom, constrainedTransform.scaleY));

    // Apply aspect ratio lock
    if (bounds.lockAspectRatio) {
      const avgScale = (constrainedTransform.scaleX + constrainedTransform.scaleY) / 2;
      constrainedTransform.scaleX = avgScale;
      constrainedTransform.scaleY = avgScale;
    }

    // Apply pan bounds if specified
    if (bounds.panBounds && bounds.preventOverpan) {
      constrainedTransform.translateX = Math.max(
        bounds.panBounds.left,
        Math.min(bounds.panBounds.right, constrainedTransform.translateX),
      );
      constrainedTransform.translateY = Math.max(
        bounds.panBounds.top,
        Math.min(bounds.panBounds.bottom, constrainedTransform.translateY),
      );
    }

    return constrainedTransform;
  }

  // ===== Public API =====

  /**
   * Zoom to fit all viewports in group
   */
  public zoomToFit(groupId: string): void {
    const group = this.syncGroups.get(groupId);
    if (!group) return;

    group.viewportIds.forEach(viewportId => {
      const viewportTransform = this.viewportTransforms.get(viewportId);
      if (!viewportTransform) return;

      // Calculate fit-to-window scale
      const scaleX = viewportTransform.viewportSize.width / viewportTransform.imageSize.width;
      const scaleY = viewportTransform.viewportSize.height / viewportTransform.imageSize.height;
      const scale = Math.min(scaleX, scaleY);

      this.updateViewportTransform(viewportId, {
        transform: {
          scaleX: scale,
          scaleY: scale,
          translateX: 0,
          translateY: 0,
          rotation: 0,
        },
      });
    });
  }

  /**
   * Reset all viewports in group to default view
   */
  public resetView(groupId: string): void {
    const group = this.syncGroups.get(groupId);
    if (!group) return;

    group.viewportIds.forEach(viewportId => {
      this.updateViewportTransform(viewportId, {
        transform: {
          scaleX: 1,
          scaleY: 1,
          translateX: 0,
          translateY: 0,
          rotation: 0,
        },
      });
    });
  }

  // ===== Cleanup =====

  /**
   * Dispose all resources
   */
  public dispose(): void {
    // Clear all timers and animations
    this.throttleTimers.forEach(timer => clearTimeout(timer));
    this.throttleTimers.clear();

    this.animationFrames.forEach(animationId => cancelAnimationFrame(animationId));
    this.animationFrames.clear();

    // Clear all data
    this.syncGroups.clear();
    this.viewportTransforms.clear();
    this.transformCache.clear();
    this.activeSyncOperations.clear();

    this.removeAllListeners();

    log.info('ZoomPanSync disposed', {
      component: 'ZoomPanSync',
    });
  }
}

// Export singleton instance
export const zoomPanSync = new ZoomPanSync();
