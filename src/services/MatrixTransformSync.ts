/**
 * Matrix Transform Synchronization Service
 * Handles zoom and pan synchronization using matrix transformations
 */

import { EventEmitter } from 'events';
import { log } from '../utils/logger';

export interface Point2D {
  x: number;
  y: number;
}

export interface Transform2D {
  scale: number;
  translate: Point2D;
  rotation?: number;
}

export interface ViewportTransform {
  viewportId: string;
  transform: Transform2D;
  bounds: {
    width: number;
    height: number;
  };
  imageSize: {
    width: number;
    height: number;
  };
}

export interface MatrixTransformConfig {
  enableZoomSync: boolean;
  enablePanSync: boolean;
  syncThreshold: number; // Minimum change threshold to trigger sync
  maxScale: number;
  minScale: number;
  smoothTransition: boolean;
  transitionDuration: number; // ms
}

export const DEFAULT_MATRIX_TRANSFORM_CONFIG: MatrixTransformConfig = {
  enableZoomSync: true,
  enablePanSync: true,
  syncThreshold: 0.01,
  maxScale: 10.0,
  minScale: 0.1,
  smoothTransition: true,
  transitionDuration: 150,
};

export interface MatrixTransformEvents {
  'transform-updated': [ViewportTransform];
  'sync-applied': [string[], ViewportTransform]; // [targetViewportIds, sourceTransform]
  'sync-error': [Error, string]; // [error, viewportId]
}

export class MatrixTransformSync extends EventEmitter {
  private config: MatrixTransformConfig;
  private viewportTransforms = new Map<string, ViewportTransform>();
  private syncEnabled = true;
  private animationFrameId: number | null = null;

  constructor(config: Partial<MatrixTransformConfig> = {}) {
    super();
    this.config = { ...DEFAULT_MATRIX_TRANSFORM_CONFIG, ...config };
  }

  // ===== Transform Management =====

  public updateViewportTransform(transform: ViewportTransform): void {
    const previousTransform = this.viewportTransforms.get(transform.viewportId);

    // Check if change is significant enough to sync
    if (previousTransform && !this.shouldSync(previousTransform.transform, transform.transform)) {
      return;
    }

    this.viewportTransforms.set(transform.viewportId, transform);
    this.emit('transform-updated', transform);

    // Synchronize with other viewports if enabled
    if (this.syncEnabled) {
      this.synchronizeTransform(transform);
    }

    log.info('Viewport transform updated', {
      component: 'MatrixTransformSync',
      metadata: {
        viewportId: transform.viewportId,
        scale: transform.transform.scale,
        translate: transform.transform.translate,
      },
    });
  }

  public getViewportTransform(viewportId: string): ViewportTransform | null {
    return this.viewportTransforms.get(viewportId) || null;
  }

  public getAllTransforms(): ViewportTransform[] {
    return Array.from(this.viewportTransforms.values());
  }

  // ===== Synchronization =====

  public setSyncEnabled(enabled: boolean): void {
    this.syncEnabled = enabled;
    log.info('Matrix transform sync toggled', {
      component: 'MatrixTransformSync',
      metadata: { enabled },
    });
  }

  public isSyncEnabled(): boolean {
    return this.syncEnabled;
  }

  private synchronizeTransform(sourceTransform: ViewportTransform): void {
    const targetViewports = Array.from(this.viewportTransforms.keys())
      .filter(id => id !== sourceTransform.viewportId);

    if (targetViewports.length === 0) return;

    // Apply transform to target viewports
    targetViewports.forEach(targetId => {
      const targetTransform = this.viewportTransforms.get(targetId);
      if (!targetTransform) return;

      try {
        const syncedTransform = this.calculateSyncedTransform(
          sourceTransform,
          targetTransform,
        );

        // Update the target transform
        this.viewportTransforms.set(targetId, syncedTransform);

        // Apply the transform to the actual viewport
        this.applyTransformToViewport(syncedTransform);

      } catch (error) {
        this.emit('sync-error', error as Error, targetId);
        log.error('Failed to sync transform', {
          component: 'MatrixTransformSync',
          metadata: { sourceId: sourceTransform.viewportId, targetId },
        }, error as Error);
      }
    });

    this.emit('sync-applied', targetViewports, sourceTransform);
  }

  // ===== Matrix Calculations =====

  private calculateSyncedTransform(
    source: ViewportTransform,
    target: ViewportTransform,
  ): ViewportTransform {
    // Calculate relative scale change
    const scaleChange = source.transform.scale / (this.getLastScale(source.viewportId) || 1);

    // Apply scale sync if enabled
    let newScale = target.transform.scale;
    if (this.config.enableZoomSync) {
      newScale = Math.max(
        this.config.minScale,
        Math.min(this.config.maxScale, target.transform.scale * scaleChange),
      );
    }

    // Calculate pan sync if enabled
    let newTranslate = { ...target.transform.translate };
    if (this.config.enablePanSync) {
      newTranslate = this.calculatePanSync(source, target, newScale);
    }

    return {
      ...target,
      transform: {
        ...target.transform,
        scale: newScale,
        translate: newTranslate,
      },
    };
  }

  private calculatePanSync(
    source: ViewportTransform,
    target: ViewportTransform,
    newScale: number,
  ): Point2D {
    // Convert source image coordinates to normalized coordinates (0-1)
    const sourceNormalized = this.imageToNormalized(
      source.transform.translate,
      source.imageSize,
      source.bounds,
    );

    // Convert normalized coordinates to target image coordinates
    return this.normalizedToImage(
      sourceNormalized,
      target.imageSize,
      target.bounds,
      newScale,
    );
  }

  private imageToNormalized(
    translate: Point2D,
    imageSize: { width: number; height: number },
    _bounds: { width: number; height: number },
  ): Point2D {
    return {
      x: translate.x / imageSize.width,
      y: translate.y / imageSize.height,
    };
  }

  private normalizedToImage(
    normalized: Point2D,
    imageSize: { width: number; height: number },
    _bounds: { width: number; height: number },
    _scale: number,
  ): Point2D {
    return {
      x: normalized.x * imageSize.width,
      y: normalized.y * imageSize.height,
    };
  }

  // ===== Transform Application =====

  private applyTransformToViewport(transform: ViewportTransform): void {
    if (this.config.smoothTransition) {
      this.applyTransformWithAnimation(transform);
    } else {
      this.applyTransformImmediate(transform);
    }
  }

  private applyTransformWithAnimation(transform: ViewportTransform): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const startTime = performance.now();
    const duration = this.config.transitionDuration;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic for smooth animation
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      // Apply interpolated transform
      this.applyInterpolatedTransform(transform, easedProgress);

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        this.animationFrameId = null;
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  private applyTransformImmediate(transform: ViewportTransform): void {
    // Direct transform application - would integrate with Cornerstone3D viewport
    this.notifyViewportTransform(transform);
  }

  private applyInterpolatedTransform(transform: ViewportTransform, progress: number): void {
    const currentTransform = this.viewportTransforms.get(transform.viewportId);
    if (!currentTransform) return;

    const interpolated: ViewportTransform = {
      ...transform,
      transform: {
        scale: this.lerp(currentTransform.transform.scale, transform.transform.scale, progress),
        translate: {
          x: this.lerp(currentTransform.transform.translate.x, transform.transform.translate.x, progress),
          y: this.lerp(currentTransform.transform.translate.y, transform.transform.translate.y, progress),
        },
      },
    };

    this.notifyViewportTransform(interpolated);
  }

  private lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  // ===== External Integration =====

  private notifyViewportTransform(transform: ViewportTransform): void {
    // This would integrate with Cornerstone3D to actually apply the transform
    // For now, we emit an event that external systems can listen to
    this.emit('viewport-transform-apply', transform);
  }

  // ===== Utility Methods =====

  private shouldSync(previous: Transform2D, current: Transform2D): boolean {
    const scaleChange = Math.abs(current.scale - previous.scale);
    const translateChange = Math.sqrt(
      Math.pow(current.translate.x - previous.translate.x, 2) +
      Math.pow(current.translate.y - previous.translate.y, 2),
    );

    return scaleChange > this.config.syncThreshold ||
           translateChange > this.config.syncThreshold;
  }

  private getLastScale(viewportId: string): number | null {
    const transform = this.viewportTransforms.get(viewportId);
    return transform ? transform.transform.scale : null;
  }

  // ===== Configuration =====

  public updateConfig(config: Partial<MatrixTransformConfig>): void {
    this.config = { ...this.config, ...config };
    log.info('Matrix transform config updated', {
      component: 'MatrixTransformSync',
      metadata: config,
    });
  }

  public getConfig(): MatrixTransformConfig {
    return { ...this.config };
  }

  // ===== Reset and Cleanup =====

  public resetViewport(viewportId: string): void {
    this.viewportTransforms.delete(viewportId);
    log.info('Viewport transform reset', {
      component: 'MatrixTransformSync',
      metadata: { viewportId },
    });
  }

  public resetAllViewports(): void {
    this.viewportTransforms.clear();
    log.info('All viewport transforms reset', {
      component: 'MatrixTransformSync',
    });
  }

  public dispose(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.viewportTransforms.clear();
    this.removeAllListeners();

    log.info('MatrixTransformSync disposed', {
      component: 'MatrixTransformSync',
    });
  }
}

// Singleton instance
export const matrixTransformSync = new MatrixTransformSync();

