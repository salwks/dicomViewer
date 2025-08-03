/**
 * Viewport Resource Pool Manager
 * Manages shared resources like textures, buffers, and shaders across viewports
 */

import { EventEmitter } from 'events';
import { ResourcePool, TexturePriorityInfo } from './types';
import { log } from '../../utils/logger';

export class ViewportResourcePool extends EventEmitter {
  private readonly resourcePool: ResourcePool;
  private readonly texturePriorities = new Map<string, TexturePriorityInfo>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxMemory: number = 512 * 1024 * 1024) { // Default 512MB
    super();

    this.resourcePool = {
      textures: new Map<string, WebGLTexture>(),
      buffers: new Map<string, WebGLBuffer>(),
      shaders: new Map<string, WebGLProgram>(),
      memoryUsage: 0,
      lastCleanup: Date.now(),
    };

    // Add maxMemory property to resource pool
    (this.resourcePool as any).maxMemory = maxMemory;

    this.startPeriodicCleanup();
  }

  /**
   * Get a texture from the pool or create a new one
   */
  getTexture(textureId: string, viewportId: string, createFn?: () => WebGLTexture): WebGLTexture | null {
    let texture = this.resourcePool.textures.get(textureId);

    if (!texture && createFn) {
      try {
        texture = createFn();
        this.resourcePool.textures.set(textureId, texture);

        // Update texture priority info
        this.updateTexturePriority(textureId, viewportId, 5, 'active');

        log.info('Texture created and added to pool', {
          component: 'ViewportResourcePool',
          metadata: { textureId, viewportId },
        });
      } catch (error) {
        log.error('Failed to create texture', {
          component: 'ViewportResourcePool',
          metadata: { textureId, viewportId },
        }, error as Error);
        return null;
      }
    } else if (texture) {
      // Update last used time for existing texture
      this.updateTexturePriority(textureId, viewportId, 5, 'active');
    }

    return texture || null;
  }

  /**
   * Get a buffer from the pool or create a new one
   */
  getBuffer(bufferId: string, createFn?: () => WebGLBuffer): WebGLBuffer | null {
    let buffer = this.resourcePool.buffers.get(bufferId);

    if (!buffer && createFn) {
      try {
        buffer = createFn();
        this.resourcePool.buffers.set(bufferId, buffer);

        log.info('Buffer created and added to pool', {
          component: 'ViewportResourcePool',
          metadata: { bufferId },
        });
      } catch (error) {
        log.error('Failed to create buffer', {
          component: 'ViewportResourcePool',
          metadata: { bufferId },
        }, error as Error);
        return null;
      }
    }

    return buffer || null;
  }

  /**
   * Get a shader program from the pool or create a new one
   */
  getShader(shaderId: string, createFn?: () => WebGLProgram): WebGLProgram | null {
    let shader = this.resourcePool.shaders.get(shaderId);

    if (!shader && createFn) {
      try {
        shader = createFn();
        this.resourcePool.shaders.set(shaderId, shader);

        log.info('Shader created and added to pool', {
          component: 'ViewportResourcePool',
          metadata: { shaderId },
        });
      } catch (error) {
        log.error('Failed to create shader', {
          component: 'ViewportResourcePool',
          metadata: { shaderId },
        }, error as Error);
        return null;
      }
    }

    return shader || null;
  }

  /**
   * Update texture priority information
   */
  private updateTexturePriority(
    textureId: string,
    viewportId: string,
    priority: number,
    usage: 'active' | 'cached' | 'stale',
  ): void {
    const existing = this.texturePriorities.get(textureId);

    this.texturePriorities.set(textureId, {
      textureId,
      viewportId,
      priority,
      lastUsed: Date.now(),
      size: existing?.size || 0, // Would calculate actual size
      isShared: false, // Would determine if shared across viewports
      usage,
    });
  }

  /**
   * Free texture resources based on memory pressure
   */
  freeTexturesByPriority(freeThreshold: number): string[] {
    const freedTextures: string[] = [];
    let freedMemory = 0;

    // Sort textures by priority and last used time
    const sortedTextures = Array.from(this.texturePriorities.entries())
      .sort(([, a], [, b]) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return a.lastUsed - b.lastUsed; // Older first for same priority
      });

    for (const [textureId, info] of sortedTextures) {
      if (freedMemory >= freeThreshold) break;

      // Don't free active textures
      if (info.usage === 'active') continue;

      const texture = this.resourcePool.textures.get(textureId);
      if (texture) {
        try {
          // In a real implementation, would call gl.deleteTexture(texture)
          this.resourcePool.textures.delete(textureId);
          this.texturePriorities.delete(textureId);

          freedTextures.push(textureId);
          freedMemory += info.size;

          this.emit('texture-freed', textureId, info.size);
        } catch (error) {
          log.warn('Failed to free texture', {
            component: 'ViewportResourcePool',
            metadata: { textureId },
          }, error as Error);
        }
      }
    }

    if (freedTextures.length > 0) {
      this.resourcePool.memoryUsage -= freedMemory;
      this.emit('memory-freed', freedMemory, freedTextures);

      log.info('Textures freed based on priority', {
        component: 'ViewportResourcePool',
        metadata: {
          freedCount: freedTextures.length,
          freedMemory,
          freeThreshold,
        },
      });
    }

    return freedTextures;
  }

  /**
   * Clean up stale resources
   */
  private cleanupStaleResources(): void {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    // Mark old textures as stale
    this.texturePriorities.forEach((info) => {
      if (now - info.lastUsed > staleThreshold && info.usage !== 'stale') {
        info.usage = 'stale';
      }
    });

    // Free stale resources if memory usage is high
    const maxMemory = (this.resourcePool as any).maxMemory || (512 * 1024 * 1024);
    if (this.resourcePool.memoryUsage > maxMemory * 0.8) {
      this.freeTexturesByPriority(maxMemory * 0.2);
    }

    this.resourcePool.lastCleanup = now;
  }

  /**
   * Start periodic cleanup
   */
  private startPeriodicCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleResources();
    }, 30000); // Cleanup every 30 seconds

    log.info('Periodic resource cleanup started', {
      component: 'ViewportResourcePool',
    });
  }

  /**
   * Stop periodic cleanup
   */
  private stopPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;

      log.info('Periodic resource cleanup stopped', {
        component: 'ViewportResourcePool',
      });
    }
  }

  /**
   * Get resource pool statistics
   */
  getResourceStatistics(): {
    textureCount: number;
    bufferCount: number;
    shaderCount: number;
    memoryUsage: number;
    maxMemory: number;
    memoryUtilization: number;
    staleTextureCount: number;
    activeTextureCount: number;
    } {
    const maxMemory = (this.resourcePool as any).maxMemory || (512 * 1024 * 1024);
    const staleTextures = Array.from(this.texturePriorities.values()).filter(t => t.usage === 'stale');
    const activeTextures = Array.from(this.texturePriorities.values()).filter(t => t.usage === 'active');

    return {
      textureCount: this.resourcePool.textures.size,
      bufferCount: this.resourcePool.buffers.size,
      shaderCount: this.resourcePool.shaders.size,
      memoryUsage: this.resourcePool.memoryUsage,
      maxMemory,
      memoryUtilization: this.resourcePool.memoryUsage / maxMemory,
      staleTextureCount: staleTextures.length,
      activeTextureCount: activeTextures.length,
    };
  }

  /**
   * Force cleanup of all resources
   */
  forceCleanup(): void {
    const stats = this.getResourceStatistics();

    // Clear all maps
    this.resourcePool.textures.clear();
    this.resourcePool.buffers.clear();
    this.resourcePool.shaders.clear();
    this.texturePriorities.clear();

    this.resourcePool.memoryUsage = 0;
    this.resourcePool.lastCleanup = Date.now();

    this.emit('force-cleanup-completed', stats);

    log.info('Force cleanup completed', {
      component: 'ViewportResourcePool',
      metadata: stats,
    });
  }

  /**
   * Get resource pool reference
   */
  getResourcePool(): ResourcePool {
    return this.resourcePool;
  }

  /**
   * Update memory usage
   */
  updateMemoryUsage(delta: number): void {
    this.resourcePool.memoryUsage = Math.max(0, this.resourcePool.memoryUsage + delta);

    const maxMemory = (this.resourcePool as any).maxMemory || (512 * 1024 * 1024);
    const utilization = this.resourcePool.memoryUsage / maxMemory;

    if (utilization > 0.9) {
      this.emit('memory-pressure', this.resourcePool.memoryUsage, maxMemory);
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopPeriodicCleanup();
    this.forceCleanup();
    this.removeAllListeners();
  }
}
