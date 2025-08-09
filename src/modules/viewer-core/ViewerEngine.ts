/**
 * ViewerEngine - Core viewer functionality module
 * Manages the rendering engine and viewport lifecycle
 */

import { RenderingEngine, Types as CornerstoneTypes, getRenderingEngine } from '@cornerstonejs/core';
import { EventEmitter } from '../../utils/EventEmitter';
import { log } from '../../utils/logger';
import type { ViewerEngineConfig, ViewerEngineState, ViewerEngineEvents, ViewportConfig } from './types';

export class ViewerEngine extends EventEmitter<ViewerEngineEvents> {
  private config: ViewerEngineConfig;
  private state: ViewerEngineState;

  constructor(config: ViewerEngineConfig) {
    super();
    this.config = config;
    this.state = {
      isInitialized: false,
      activeViewportId: null,
      viewports: new Map(),
      renderingEngine: null,
    };
  }

  /**
   * Initialize the viewer engine
   */
  async initialize(): Promise<void> {
    if (this.state.isInitialized) {
      log.warn('ViewerEngine already initialized', {
        component: 'ViewerEngine',
      });
      return;
    }

    try {
      // Check if rendering engine already exists
      let renderingEngine = getRenderingEngine(this.config.renderingEngineId);
      
      if (!renderingEngine) {
        renderingEngine = new RenderingEngine(this.config.renderingEngineId);
      }

      this.state.renderingEngine = renderingEngine;
      this.state.isInitialized = true;

      log.info('ViewerEngine initialized', {
        component: 'ViewerEngine',
        metadata: { renderingEngineId: this.config.renderingEngineId },
      });

      this.emit('engine:initialized');
    } catch (error) {
      log.error(
        'Failed to initialize ViewerEngine',
        { component: 'ViewerEngine' },
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Create a new viewport
   */
  async createViewport(config: ViewportConfig): Promise<void> {
    if (!this.state.isInitialized || !this.state.renderingEngine) {
      throw new Error('ViewerEngine not initialized');
    }

    try {
      const viewportInput: CornerstoneTypes.PublicViewportInput = {
        viewportId: config.viewportId,
        element: config.element,
        type: config.viewportType,
        ...config.viewportInput,
      };

      this.state.renderingEngine.enableElement(viewportInput);
      this.state.viewports.set(config.viewportId, config);

      log.info('Viewport created', {
        component: 'ViewerEngine',
        metadata: { viewportId: config.viewportId },
      });

      this.emit('viewport:created', { viewportId: config.viewportId });
    } catch (error) {
      log.error(
        'Failed to create viewport',
        { component: 'ViewerEngine', metadata: { viewportId: config.viewportId } },
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Remove a viewport
   */
  async removeViewport(viewportId: string): Promise<void> {
    if (!this.state.renderingEngine) {
      return;
    }

    try {
      this.state.renderingEngine.disableElement(viewportId);
      this.state.viewports.delete(viewportId);

      if (this.state.activeViewportId === viewportId) {
        this.state.activeViewportId = null;
      }

      log.info('Viewport removed', {
        component: 'ViewerEngine',
        metadata: { viewportId },
      });

      this.emit('viewport:removed', { viewportId });
    } catch (error) {
      log.error(
        'Failed to remove viewport',
        { component: 'ViewerEngine', metadata: { viewportId } },
        error as Error,
      );
    }
  }

  /**
   * Activate a viewport
   */
  activateViewport(viewportId: string): void {
    if (!this.state.viewports.has(viewportId)) {
      log.warn('Cannot activate non-existent viewport', {
        component: 'ViewerEngine',
        metadata: { viewportId },
      });
      return;
    }

    this.state.activeViewportId = viewportId;
    this.emit('viewport:activated', { viewportId });
  }

  /**
   * Get viewport by ID
   */
  getViewport(viewportId: string): CornerstoneTypes.IViewport | null {
    if (!this.state.renderingEngine) {
      return null;
    }
    return this.state.renderingEngine.getViewport(viewportId);
  }

  /**
   * Get all viewports
   */
  getAllViewports(): CornerstoneTypes.IViewport[] {
    if (!this.state.renderingEngine) {
      return [];
    }
    return this.state.renderingEngine.getViewports();
  }

  /**
   * Get rendering engine
   */
  getRenderingEngine(): CornerstoneTypes.IRenderingEngine | null {
    return this.state.renderingEngine;
  }

  /**
   * Destroy the viewer engine
   */
  async destroy(): Promise<void> {
    if (!this.state.isInitialized) {
      return;
    }

    try {
      // Remove all viewports
      const viewportIds = Array.from(this.state.viewports.keys());
      for (const viewportId of viewportIds) {
        await this.removeViewport(viewportId);
      }

      // Destroy rendering engine
      if (this.state.renderingEngine) {
        this.state.renderingEngine.destroy();
      }

      this.state.isInitialized = false;
      this.state.renderingEngine = null;
      this.state.activeViewportId = null;
      this.state.viewports.clear();

      log.info('ViewerEngine destroyed', {
        component: 'ViewerEngine',
      });

      this.emit('engine:destroyed');
    } catch (error) {
      log.error(
        'Failed to destroy ViewerEngine',
        { component: 'ViewerEngine' },
        error as Error,
      );
    }
  }

  /**
   * Get engine state
   */
  getState(): Readonly<ViewerEngineState> {
    return { ...this.state };
  }
}