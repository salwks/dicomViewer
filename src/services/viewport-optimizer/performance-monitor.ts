/**
 * Viewport Performance Monitor
 * Monitors and collects performance metrics for viewports
 */

import { EventEmitter } from 'events';
import { PerformanceMetrics, PerformanceMonitoringData, ViewportOptimizationState } from './types';
import { log } from '../../utils/logger';

export class ViewportPerformanceMonitor extends EventEmitter {
  private readonly performanceHistory: PerformanceMonitoringData[] = [];
  private readonly MAX_HISTORY_SIZE = 1000;
  private frameRequestId: number | null = null;
  private lastFrameTime = 0;
  private isMonitoring = false;

  // Initialize performance monitor with event emitter

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring(viewportStates: Map<string, ViewportOptimizationState>): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    const monitor = (): void => {
      if (!this.isMonitoring) return;

      const now = performance.now();
      const deltaTime = now - this.lastFrameTime;
      this.lastFrameTime = now;

      // Collect metrics for each viewport
      viewportStates.forEach((state, viewportId) => {
        if (state.isRendering) {
          const metrics = this.collectViewportMetrics(viewportId, deltaTime);
          const monitoringData: PerformanceMonitoringData = {
            timestamp: now,
            viewportId,
            fps: metrics.fps,
            renderTime: metrics.renderTime,
            memoryUsage: metrics.memoryUsage,
            cpuUsage: 0, // Would be implemented with actual CPU monitoring
            gpuUsage: 0, // Would be implemented with actual GPU monitoring
            networkLatency: 0, // Would be implemented with network monitoring
            cacheHitRate: metrics.cacheHitRate,
            triangleCount: metrics.triangleCount,
            drawCalls: metrics.drawCalls,
            shaderCompileTime: 0,
            textureUploadTime: 0,
            vertexBufferUploadTime: 0,
            frameDropCount: 0,
            qualityLevel: state.qualityLevel.name,
            adaptiveQualityChanges: 0,
            memoryPressure: 'low',
            thermalState: 'nominal',
          };

          this.performanceHistory.push(monitoringData);
          this.emit('performance-metrics', monitoringData);

          // Keep history size manageable
          if (this.performanceHistory.length > this.MAX_HISTORY_SIZE) {
            this.performanceHistory.shift();
          }
        }
      });

      this.frameRequestId = requestAnimationFrame(monitor);
    };

    this.frameRequestId = requestAnimationFrame(monitor);

    log.info('Performance monitoring started', {
      component: 'ViewportPerformanceMonitor',
    });
  }

  /**
   * Stop performance monitoring
   */
  stopPerformanceMonitoring(): void {
    this.isMonitoring = false;

    if (this.frameRequestId !== null) {
      cancelAnimationFrame(this.frameRequestId);
      this.frameRequestId = null;
    }

    log.info('Performance monitoring stopped', {
      component: 'ViewportPerformanceMonitor',
    });
  }

  /**
   * Collect performance metrics for a specific viewport
   */
  private collectViewportMetrics(viewportId: string, deltaTime: number): PerformanceMetrics {
    try {
      // Calculate FPS from delta time
      const fps = deltaTime > 0 ? 1000 / deltaTime : 0;

      // Collect memory usage information
      const memoryInfo = this.getMemoryInfo();

      // Collect GPU metrics (simulated for now)
      const gpuMetrics = this.getGPUMetrics();

      return {
        fps,
        renderTime: deltaTime,
        memoryUsage: memoryInfo.usedJSHeapSize || 0,
        cacheHitRate: 0.85, // Simulated cache hit rate
        gpuMemoryUsage: gpuMetrics.memoryUsed,
        triangleCount: gpuMetrics.triangleCount,
        drawCalls: gpuMetrics.drawCalls,
      };
    } catch (error) {
      log.warn('Failed to collect viewport metrics', {
        component: 'ViewportPerformanceMonitor',
        metadata: { viewportId },
      }, error as Error);

      return {
        fps: 0,
        renderTime: deltaTime,
        memoryUsage: 0,
        cacheHitRate: 0,
        gpuMemoryUsage: 0,
        triangleCount: 0,
        drawCalls: 0,
      };
    }
  }

  /**
   * Get memory information
   */
  private getMemoryInfo(): {
    usedJSHeapSize?: number;
    totalJSHeapSize?: number;
    jsHeapSizeLimit?: number;
    } {
    if ('memory' in performance) {
      return (performance as any).memory;
    }
    return {};
  }

  /**
   * Get GPU metrics (simulated)
   */
  private getGPUMetrics(): {
    memoryUsed: number;
    triangleCount: number;
    drawCalls: number;
    } {
    // In a real implementation, this would query WebGL context for actual metrics
    return {
      memoryUsed: Math.random() * 100 * 1024 * 1024, // Random memory usage
      triangleCount: Math.floor(Math.random() * 100000), // Random triangle count
      drawCalls: Math.floor(Math.random() * 1000), // Random draw calls
    };
  }

  /**
   * Get performance statistics for a viewport
   */
  getViewportPerformanceStats(viewportId: string, timeWindow?: number): {
    averageFps: number;
    averageRenderTime: number;
    averageMemoryUsage: number;
    frameDropCount: number;
    qualityChanges: number;
  } {
    const now = Date.now();
    const windowStart = timeWindow ? now - timeWindow : 0;

    const relevantData = this.performanceHistory.filter(data =>
      data.viewportId === viewportId && data.timestamp >= windowStart,
    );

    if (relevantData.length === 0) {
      return {
        averageFps: 0,
        averageRenderTime: 0,
        averageMemoryUsage: 0,
        frameDropCount: 0,
        qualityChanges: 0,
      };
    }

    const totalFps = relevantData.reduce((sum, data) => sum + data.fps, 0);
    const totalRenderTime = relevantData.reduce((sum, data) => sum + data.renderTime, 0);
    const totalMemoryUsage = relevantData.reduce((sum, data) => sum + data.memoryUsage, 0);
    const frameDropCount = relevantData.reduce((sum, data) => sum + (data.frameDropCount || 0), 0);
    const qualityChanges = relevantData.reduce((sum, data) => sum + (data.adaptiveQualityChanges || 0), 0);

    return {
      averageFps: totalFps / relevantData.length,
      averageRenderTime: totalRenderTime / relevantData.length,
      averageMemoryUsage: totalMemoryUsage / relevantData.length,
      frameDropCount,
      qualityChanges,
    };
  }

  /**
   * Get overall system performance statistics
   */
  getSystemPerformanceStats(timeWindow?: number): {
    totalViewports: number;
    activeViewports: number;
    averageSystemFps: number;
    totalMemoryUsage: number;
    totalDrawCalls: number;
    totalTriangles: number;
  } {
    const now = Date.now();
    const windowStart = timeWindow ? now - timeWindow : 0;

    const relevantData = this.performanceHistory.filter(data =>
      data.timestamp >= windowStart,
    );

    if (relevantData.length === 0) {
      return {
        totalViewports: 0,
        activeViewports: 0,
        averageSystemFps: 0,
        totalMemoryUsage: 0,
        totalDrawCalls: 0,
        totalTriangles: 0,
      };
    }

    const uniqueViewports = new Set(relevantData.map(data => data.viewportId));
    const totalFps = relevantData.reduce((sum, data) => sum + data.fps, 0);
    const totalMemoryUsage = relevantData.reduce((sum, data) => sum + data.memoryUsage, 0);
    const totalDrawCalls = relevantData.reduce((sum, data) => sum + (data.drawCalls || 0), 0);
    const totalTriangles = relevantData.reduce((sum, data) => sum + (data.triangleCount || 0), 0);

    return {
      totalViewports: uniqueViewports.size,
      activeViewports: uniqueViewports.size, // All monitored viewports are considered active
      averageSystemFps: totalFps / relevantData.length,
      totalMemoryUsage: totalMemoryUsage / relevantData.length, // Average memory usage
      totalDrawCalls,
      totalTriangles,
    };
  }

  /**
   * Get higher severity between two severity levels
   */
  private getHigherSeverity(
    current: 'low' | 'medium' | 'high' | 'critical',
    proposed: 'low' | 'medium' | 'high' | 'critical',
  ): 'low' | 'medium' | 'high' | 'critical' {
    const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
    // eslint-disable-next-line security/detect-object-injection -- Safe: current is validated severity level string
    const currentLevel = severityLevels[current];
    // eslint-disable-next-line security/detect-object-injection -- Safe: proposed is validated severity level string
    const proposedLevel = severityLevels[proposed];

    if (proposedLevel > currentLevel) {
      return proposed;
    }
    return current;
  }

  /**
   * Detect performance issues
   */
  detectPerformanceIssues(viewportId: string): {
    issues: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
    recommendations: string[];
  } {
    const stats = this.getViewportPerformanceStats(viewportId, 10000); // Last 10 seconds
    const issues: string[] = [];
    const recommendations: string[] = [];
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Check FPS issues
    if (stats.averageFps < 15) {
      issues.push('Very low frame rate detected');
      recommendations.push('Consider reducing quality settings');
      severity = 'critical';
    } else if (stats.averageFps < 30) {
      issues.push('Low frame rate detected');
      recommendations.push('Consider optimizing rendering quality');
      severity = this.getHigherSeverity(severity, 'high');
    }

    // Check render time issues
    if (stats.averageRenderTime > 50) {
      issues.push('High render time detected');
      recommendations.push('Check for expensive rendering operations');
      severity = this.getHigherSeverity(severity, 'medium');
    }

    // Check memory usage
    if (stats.averageMemoryUsage > 500 * 1024 * 1024) { // 500MB
      issues.push('High memory usage detected');
      recommendations.push('Consider enabling memory cleanup');
      severity = this.getHigherSeverity(severity, 'high');
    }

    // Check frame drops
    if (stats.frameDropCount > 10) {
      issues.push('Frequent frame drops detected');
      recommendations.push('Check system performance or reduce load');
      severity = this.getHigherSeverity(severity, 'medium');
    }

    return { issues, severity, recommendations };
  }

  /**
   * Clear performance history
   */
  clearHistory(): void {
    this.performanceHistory.length = 0;

    log.info('Performance history cleared', {
      component: 'ViewportPerformanceMonitor',
    });
  }

  /**
   * Get performance history
   */
  getPerformanceHistory(viewportId?: string): PerformanceMonitoringData[] {
    if (viewportId) {
      return this.performanceHistory.filter(data => data.viewportId === viewportId);
    }
    return [...this.performanceHistory];
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopPerformanceMonitoring();
    this.clearHistory();
    this.removeAllListeners();
  }
}
