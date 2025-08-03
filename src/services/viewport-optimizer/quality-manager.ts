/**
 * Viewport Quality Manager
 * Handles quality level management and adaptation for viewports
 */

import { EventEmitter } from 'events';
import { QualityLevel, RenderPriority, OptimizationConfig } from './types';
import { viewportStateManager } from '../viewportStateManager';
import { log } from '../../utils/logger';

export class QualityManager extends EventEmitter {
  private readonly config: OptimizationConfig;

  constructor(config: OptimizationConfig) {
    super();
    this.config = config;
  }

  /**
   * Get quality level based on render priority
   */
  getQualityForPriority(priority: RenderPriority): QualityLevel {
    switch (priority) {
      case RenderPriority.CRITICAL:
        return this.config.qualityLevels[0]; // Ultra
      case RenderPriority.HIGH:
        return this.config.qualityLevels[1]; // High
      case RenderPriority.MEDIUM:
        return this.config.qualityLevels[2]; // Medium
      case RenderPriority.LOW:
        return this.config.qualityLevels[3]; // Low
      case RenderPriority.SUSPENDED:
        return this.config.qualityLevels[4]; // PowerSave
      default:
        return this.config.qualityLevels[2]; // Medium default
    }
  }

  /**
   * Apply quality settings to viewport
   */
  applyQualityToViewport(viewportId: string, quality: QualityLevel): void {
    try {
      // Update viewport state with new quality settings
      viewportStateManager.updateViewportState(viewportId, {
        rendering: {
          interpolationType: quality.interpolationType,
          opacity: 1.0,
          invertColors: false,
          useCPURendering: quality.name === 'PowerSave',
          quality: quality.name.toLowerCase() as 'low' | 'medium' | 'high',
        },
        performance: {
          fps: quality.targetFps,
          renderTime: 1000 / quality.targetFps,
          memoryUsage: 0,
          cacheHitRate: 0.8,
          isRenderingEnabled: quality.name !== 'PowerSave',
          debugMode: false,
        },
      });

      this.emit('quality-applied', viewportId, quality);

    } catch (error) {
      log.error('Failed to apply quality to viewport', {
        component: 'QualityManager',
        metadata: { viewportId, qualityName: quality.name },
      }, error as Error);
    }
  }

  /**
   * Determine quality level based on performance metrics
   */
  adaptiveQualityAdjustment(
    viewportId: string,
    currentQuality: QualityLevel,
    fps: number,
    memoryPressure: number,
  ): QualityLevel | null {
    if (!this.config.adaptiveQuality) {
      return null;
    }

    const targetFps = currentQuality.targetFps;
    const qualityIndex = this.config.qualityLevels.indexOf(currentQuality);

    // Performance is poor, downgrade quality
    if (fps < targetFps * 0.8 || memoryPressure > 0.8) {
      if (qualityIndex < this.config.qualityLevels.length - 1) {
        const newQuality = this.config.qualityLevels[qualityIndex + 1];
        this.emit('quality-downgraded', viewportId, currentQuality, newQuality);
        return newQuality;
      }
    }

    // Performance is good, upgrade quality
    if (fps > targetFps * 1.2 && memoryPressure < 0.5) {
      if (qualityIndex > 0) {
        const newQuality = this.config.qualityLevels[qualityIndex - 1];
        this.emit('quality-upgraded', viewportId, currentQuality, newQuality);
        return newQuality;
      }
    }

    return null;
  }

  /**
   * Get quality configuration recommendations based on system capabilities
   */
  getRecommendedQualityLevels(): QualityLevel[] {
    // Default quality levels with conservative settings
    const defaultLevels: QualityLevel[] = [
      {
        name: 'Ultra',
        interpolationType: 'LINEAR',
        textureQuality: 1.0,
        shadowQuality: 1.0,
        renderScale: 1.0,
        maxTextureSize: 2048,
        enableVSync: true,
        targetFps: 60,
      },
      {
        name: 'High',
        interpolationType: 'LINEAR',
        textureQuality: 0.8,
        shadowQuality: 0.8,
        renderScale: 0.9,
        maxTextureSize: 1024,
        enableVSync: true,
        targetFps: 60,
      },
      {
        name: 'Medium',
        interpolationType: 'LINEAR',
        textureQuality: 0.6,
        shadowQuality: 0.6,
        renderScale: 0.8,
        maxTextureSize: 512,
        enableVSync: false,
        targetFps: 30,
      },
      {
        name: 'Low',
        interpolationType: 'NEAREST',
        textureQuality: 0.4,
        shadowQuality: 0.3,
        renderScale: 0.6,
        maxTextureSize: 256,
        enableVSync: false,
        targetFps: 30,
      },
      {
        name: 'PowerSave',
        interpolationType: 'NEAREST',
        textureQuality: 0.2,
        shadowQuality: 0.1,
        renderScale: 0.5,
        maxTextureSize: 128,
        enableVSync: false,
        targetFps: 15,
      },
    ];

    return defaultLevels;
  }

  /**
   * Get lower quality level than current
   */
  getLowerQualityLevel(currentQuality: QualityLevel): QualityLevel | null {
    const currentIndex = this.config.qualityLevels.findIndex(q => q.name === currentQuality.name);
    if (currentIndex === -1 || currentIndex >= this.config.qualityLevels.length - 1) {
      return null; // Already at lowest quality or not found
    }
    return this.config.qualityLevels[currentIndex + 1];
  }

  /**
   * Get higher quality level than current
   */
  getHigherQualityLevel(currentQuality: QualityLevel): QualityLevel | null {
    const currentIndex = this.config.qualityLevels.findIndex(q => q.name === currentQuality.name);
    if (currentIndex === -1 || currentIndex <= 0) {
      return null; // Already at highest quality or not found
    }
    return this.config.qualityLevels[currentIndex - 1];
  }

  /**
   * Create quality level based on performance budget
   */
  createCustomQualityLevel(
    name: string,
    performanceBudget: number, // 0.0 to 1.0
    memoryBudget: number, // 0.0 to 1.0
  ): QualityLevel {
    return {
      name,
      interpolationType: performanceBudget > 0.7 ? 'LINEAR' : 'NEAREST',
      textureQuality: Math.max(0.1, Math.min(1.0, performanceBudget)),
      shadowQuality: Math.max(0.1, Math.min(1.0, performanceBudget * 0.8)),
      renderScale: Math.max(0.5, Math.min(1.0, 0.5 + performanceBudget * 0.5)),
      maxTextureSize: memoryBudget > 0.8 ? 2048 : memoryBudget > 0.6 ? 1024 : memoryBudget > 0.4 ? 512 : 256,
      enableVSync: performanceBudget > 0.8,
      targetFps: performanceBudget > 0.7 ? 60 : 30,
    };
  }
}
