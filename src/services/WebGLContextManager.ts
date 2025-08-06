/**
 * WebGL Context Manager
 * Manages WebGL contexts to prevent "too many active WebGL contexts" errors
 * Implements context pooling and automatic cleanup
 */

import { log } from '../utils/logger';
import { safePropertyAccess } from '../lib/utils';

interface WebGLContextInfo {
  canvas: HTMLCanvasElement;
  context: WebGLRenderingContext | WebGL2RenderingContext | CanvasRenderingContext2D;
  createdAt: number;
  lastUsed: number;
  isActive: boolean;
  viewport?: string;
}

class WebGLContextManager {
  private contexts: Map<string, WebGLContextInfo> = new Map();
  private maxContexts = 16; // Browser limit is usually around 16
  private cleanupInterval: NodeJS.Timeout | null = null;
  private cleanupIntervalMs = 30000; // 30 seconds
  private maxIdleTime = 60000; // 1 minute

  constructor() {
    this.startCleanupInterval();
    this.setupEventListeners();
  }

  /**
   * Create or reuse a WebGL context
   */
  public acquireContext(
    canvas: HTMLCanvasElement,
    contextId: string,
    viewportId?: string,
  ): WebGLRenderingContext | WebGL2RenderingContext | CanvasRenderingContext2D | null {
    try {
      // Check if we already have a context for this canvas
      const existingContext = this.contexts.get(contextId);
      if (existingContext) {
        // Check if it's a WebGL context and if it's lost
        const isWebGLContext = 'isContextLost' in existingContext.context;
        const isContextLost = isWebGLContext && existingContext.context.isContextLost();

        if (!isContextLost) {
          existingContext.lastUsed = Date.now();
          existingContext.isActive = true;
          return existingContext.context;
        }
      }

      // Clean up old contexts if we're approaching the limit
      if (this.contexts.size >= this.maxContexts - 2) {
        this.cleanupInactiveContexts();
      }

      // Create new context with optimized attributes
      const contextAttributes: WebGLContextAttributes = {
        alpha: false,
        antialias: false,
        depth: true,
        failIfMajorPerformanceCaveat: false,
        powerPreference: 'high-performance',
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        stencil: false,
      };

      // Try WebGL2 first, fallback to WebGL1, then Canvas 2D
      let context: WebGLRenderingContext | WebGL2RenderingContext | CanvasRenderingContext2D | null = null;
      let contextType = 'Unknown';

      context = canvas.getContext('webgl2', contextAttributes) as WebGL2RenderingContext | null;
      if (context) {
        contextType = 'WebGL2';
      } else {
        context = canvas.getContext('webgl', contextAttributes) as WebGLRenderingContext | null;
        if (context) {
          contextType = 'WebGL1';
        }
      }

      // Fallback to Canvas 2D if WebGL is not available
      if (!context) {
        log.warn('WebGL not available, falling back to Canvas 2D', {
          component: 'WebGLContextManager',
          metadata: { contextId, viewportId },
        });

        context = canvas.getContext('2d') as CanvasRenderingContext2D | null;
        if (context) {
          contextType = 'Canvas2D';
          log.info('Canvas 2D context created as WebGL fallback', {
            component: 'WebGLContextManager',
            metadata: { contextId, viewportId },
          });
        }
      }

      if (!context) {
        log.error('Failed to create any rendering context (WebGL or Canvas 2D)', {
          component: 'WebGLContextManager',
          metadata: { contextId, viewportId },
        });
        return null;
      }

      // Store context info
      const contextInfo: WebGLContextInfo = {
        canvas,
        context: context as WebGLRenderingContext | WebGL2RenderingContext | CanvasRenderingContext2D,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        isActive: true,
        viewport: viewportId,
      };

      this.contexts.set(contextId, contextInfo);

      // Set up context lost/restored handlers (only for WebGL contexts)
      if (contextType !== 'Canvas2D') {
        this.setupContextEventHandlers(canvas, contextId);
      }

      log.info('Rendering context created', {
        component: 'WebGLContextManager',
        metadata: {
          contextId,
          viewportId,
          totalContexts: this.contexts.size,
          contextType,
          fallbackMode: contextType === 'Canvas2D',
        },
      });

      return context;
    } catch (error) {
      log.error(
        'Error acquiring rendering context',
        {
          component: 'WebGLContextManager',
          metadata: { contextId, viewportId },
        },
        error as Error,
      );
      return null;
    }
  }

  /**
   * Release a WebGL context
   */
  public releaseContext(contextId: string): void {
    const contextInfo = this.contexts.get(contextId);
    if (contextInfo) {
      contextInfo.isActive = false;
      contextInfo.lastUsed = Date.now();

      log.info('WebGL context released', {
        component: 'WebGLContextManager',
        metadata: { contextId, viewport: contextInfo.viewport },
      });
    }
  }

  /**
   * Force cleanup of a specific context
   */
  public destroyContext(contextId: string): void {
    const contextInfo = this.contexts.get(contextId);
    if (contextInfo) {
      try {
        // Lose context intentionally (only for WebGL contexts)
        const isWebGLContext = 'getExtension' in contextInfo.context;
        if (isWebGLContext) {
          const loseContextExt = (contextInfo.context as WebGLRenderingContext).getExtension('WEBGL_lose_context');
          if (loseContextExt) {
            loseContextExt.loseContext();
          }
        }

        this.contexts.delete(contextId);

        log.info('WebGL context destroyed', {
          component: 'WebGLContextManager',
          metadata: { contextId, viewport: contextInfo.viewport },
        });
      } catch (error) {
        log.error(
          'Error destroying WebGL context',
          {
            component: 'WebGLContextManager',
            metadata: { contextId },
          },
          error as Error,
        );
      }
    }
  }

  /**
   * Get context statistics
   */
  public getStatistics(): {
    totalContexts: number;
    activeContexts: number;
    inactiveContexts: number;
    oldestContext: number;
    newestContext: number;
    } {
    const now = Date.now();
    let activeCount = 0;
    let oldestTime = now;
    let newestTime = 0;

    this.contexts.forEach(info => {
      if (info.isActive) activeCount++;
      if (info.createdAt < oldestTime) oldestTime = info.createdAt;
      if (info.createdAt > newestTime) newestTime = info.createdAt;
    });

    return {
      totalContexts: this.contexts.size,
      activeContexts: activeCount,
      inactiveContexts: this.contexts.size - activeCount,
      oldestContext: now - oldestTime,
      newestContext: now - newestTime,
    };
  }

  /**
   * Clean up inactive contexts
   */
  private cleanupInactiveContexts(): void {
    const now = Date.now();
    const contextsToDestroy: string[] = [];

    // Find old inactive contexts
    this.contexts.forEach((info, contextId) => {
      if (!info.isActive && now - info.lastUsed > this.maxIdleTime) {
        contextsToDestroy.push(contextId);
      }
    });

    // If we still have too many contexts, remove oldest ones
    if (this.contexts.size - contextsToDestroy.length >= this.maxContexts - 1) {
      const sortedContexts = Array.from(this.contexts.entries())
        .filter(([id]) => !contextsToDestroy.includes(id))
        .sort(([, a], [, b]) => a.lastUsed - b.lastUsed);

      const additionalToRemove = Math.min(4, sortedContexts.length - (this.maxContexts - 4));

      for (let i = 0; i < additionalToRemove; i++) {
        const contextEntry = safePropertyAccess(sortedContexts, i);
        if (contextEntry) {
          contextsToDestroy.push(contextEntry[0]);
        }
      }
    }

    // Destroy selected contexts
    contextsToDestroy.forEach(contextId => {
      this.destroyContext(contextId);
    });

    if (contextsToDestroy.length > 0) {
      log.info('WebGL contexts cleaned up', {
        component: 'WebGLContextManager',
        metadata: {
          destroyed: contextsToDestroy.length,
          remaining: this.contexts.size,
        },
      });
    }
  }

  /**
   * Setup context event handlers
   */
  private setupContextEventHandlers(canvas: HTMLCanvasElement, contextId: string): void {
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      log.warn('WebGL context lost', {
        component: 'WebGLContextManager',
        metadata: { contextId },
      });

      // Mark context as lost
      const contextInfo = this.contexts.get(contextId);
      if (contextInfo) {
        contextInfo.isActive = false;
      }
    });

    canvas.addEventListener('webglcontextrestored', () => {
      log.info('WebGL context restored', {
        component: 'WebGLContextManager',
        metadata: { contextId },
      });

      // Context will be recreated on next acquisition
      this.contexts.delete(contextId);
    });
  }

  /**
   * Start periodic cleanup
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveContexts();
    }, this.cleanupIntervalMs);
  }

  /**
   * Setup global event listeners
   */
  private setupEventListeners(): void {
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Page is hidden, clean up inactive contexts more aggressively
        this.cleanupInactiveContexts();
      }
    });

    // Handle beforeunload
    window.addEventListener('beforeunload', () => {
      this.dispose();
    });
  }

  /**
   * Force emergency cleanup
   */
  public forceCleanup(): void {
    log.warn('Force cleaning WebGL contexts', {
      component: 'WebGLContextManager',
      metadata: { totalContexts: this.contexts.size },
    });

    // Keep only the most recently used active contexts
    const activeContexts = Array.from(this.contexts.entries())
      .filter(([, info]) => info.isActive)
      .sort(([, a], [, b]) => b.lastUsed - a.lastUsed)
      .slice(0, Math.floor(this.maxContexts / 2));

    // Destroy all others
    this.contexts.forEach((_info, contextId) => {
      if (!activeContexts.find(([id]) => id === contextId)) {
        this.destroyContext(contextId);
      }
    });
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Destroy all contexts
    Array.from(this.contexts.keys()).forEach(contextId => {
      this.destroyContext(contextId);
    });

    this.contexts.clear();

    log.info('WebGLContextManager disposed', {
      component: 'WebGLContextManager',
    });
  }
}

// Export singleton instance
export const webglContextManager = new WebGLContextManager();
