/**
 * Cornerstone3D Service Layer
 *
 * Based on Context7 documentation patterns from /cornerstonejs/cornerstone3d
 * Reference: 443 code examples available
 */

import { RenderingEngine, volumeLoader, setVolumesForViewports } from '@cornerstonejs/core';
import { ToolGroupManager } from '@cornerstonejs/tools';

export interface ViewportConfig {
  viewportId: string;
  element: HTMLElement;
  type: 'orthographic' | 'perspective' | 'stack';
  defaultOptions?: {
    orientation?: 'axial' | 'sagittal' | 'coronal';
    background?: [number, number, number];
  };
}

export interface VolumeConfig {
  volumeId: string;
  imageIds: string[];
  callback?: (params: { volumeActor: unknown }) => void;
}

export class CornerstoneService {
  private renderingEngine: any | null = null;
  private toolGroups: Map<string, any> = new Map();

  /**
   * Initialize rendering engine
   * Following Context7 documented pattern
   */
  createRenderingEngine(renderingEngineId: string): any {
    this.renderingEngine = new RenderingEngine(renderingEngineId);
    return this.renderingEngine;
  }

  /**
   * Set up viewports based on Context7 examples
   */
  setViewports(viewportConfigs: ViewportConfig[]): void {
    if (!this.renderingEngine) {
      throw new Error('Rendering engine not initialized. Call createRenderingEngine first.');
    }

    this.renderingEngine.setViewports(viewportConfigs);
  }

  /**
   * Create and cache volume following documented patterns
   */
  async createAndCacheVolume(volumeId: string, imageIds: string[]) {
    if (!volumeLoader.createAndCacheVolume) {
      throw new Error('volumeLoader.createAndCacheVolume is not available');
    }
    const volume = await volumeLoader.createAndCacheVolume(volumeId, {
      imageIds,
    });

    return volume;
  }

  /**
   * Set volumes for viewports using Context7 pattern
   */
  async setVolumesForViewports(
    volumeConfigs: VolumeConfig[],
    viewportIds: string[],
  ): Promise<void> {
    if (!this.renderingEngine) {
      throw new Error('Rendering engine not initialized');
    }

    await setVolumesForViewports(
      this.renderingEngine,
      volumeConfigs,
      viewportIds,
    );
  }

  /**
   * Create tool group following Context7 examples
   */
  createToolGroup(toolGroupId: string) {
    const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
    this.toolGroups.set(toolGroupId, toolGroup);
    return toolGroup;
  }

  /**
   * Add viewport to tool group
   */
  addViewportToToolGroup(
    toolGroupId: string,
    viewportId: string,
    renderingEngineId?: string,
  ): void {
    const toolGroup = this.toolGroups.get(toolGroupId);
    if (!toolGroup) {
      throw new Error(`Tool group ${toolGroupId} not found`);
    }

    toolGroup.addViewport(viewportId, renderingEngineId);
  }

  /**
   * Get viewport instance
   */
  getViewport(viewportId: string) {
    if (!this.renderingEngine) {
      throw new Error('Rendering engine not initialized');
    }

    return this.renderingEngine.getViewport(viewportId);
  }

  /**
   * Render viewports
   */
  render(viewportIds?: string[]): void {
    if (!this.renderingEngine) {
      throw new Error('Rendering engine not initialized');
    }

    if (viewportIds) {
      this.renderingEngine.renderViewports(viewportIds);
    } else {
      this.renderingEngine.render();
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.renderingEngine) {
      this.renderingEngine.destroy();
      this.renderingEngine = null;
    }

    this.toolGroups.clear();
  }
}

// Singleton instance for application-wide use
export const cornerstoneService = new CornerstoneService();
