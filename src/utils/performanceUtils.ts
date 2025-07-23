/* eslint-disable security/detect-object-injection */
// NOTE: Performance monitoring requires dynamic property access for metrics collection
/**
 * Performance Utilities
 *
 * Utility functions for DICOM loading performance optimization
 * Based on Context7 documentation patterns from /cornerstonejs/cornerstone3d
 * Reference: 443 code examples for performance optimization utilities
 */

import { PerformanceMetrics, CachePriority } from '../services/performanceOptimizer';

/**
 * Memory usage monitoring utilities
 */
export const MemoryUtils = {
  /**
   * Get current memory usage information
   */
  getCurrentMemoryUsage(): {
    used: number;
    total: number;
    percentage: number;
    available: number;
    } {
    if (performance.memory) {
      const memory = performance.memory;
      return {
        used: memory.usedJSHeapSize / (1024 * 1024), // MB
        total: memory.totalJSHeapSize / (1024 * 1024), // MB
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
        available: (memory.totalJSHeapSize - memory.usedJSHeapSize) / (1024 * 1024), // MB
      };
    }

    return {
      used: 0,
      total: 0,
      percentage: 0,
      available: 0,
    };
  },

  /**
   * Check if memory usage is approaching limits
   */
  isMemoryPressure(threshold: number = 80): boolean {
    const usage = this.getCurrentMemoryUsage();
    return usage.percentage > threshold;
  },

  /**
   * Estimate memory required for image
   */
  estimateImageMemory(width: number, height: number, bitsPerPixel: number = 16): number {
    const bytesPerPixel = bitsPerPixel / 8;
    return width * height * bytesPerPixel; // bytes
  },

  /**
   * Format memory size for display
   */
  formatMemorySize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  },
};

/**
 * Network performance monitoring utilities
 */
export const NetworkUtils = {
  /**
   * Measure network latency to a server
   */
  async measureLatency(url: string, attempts: number = 3): Promise<number> {
    const measurements: number[] = [];

    for (let i = 0; i < attempts; i++) {
      const start = performance.now();

      try {
        await fetch(url, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-cache',
        });

        const latency = performance.now() - start;
        measurements.push(latency);
      } catch (error) {
        console.warn(`Latency measurement failed for ${url}:`, error);
      }
    }

    if (measurements.length === 0) return 0;

    // Return median latency
    measurements.sort((a, b) => a - b);
    return measurements[Math.floor(measurements.length / 2)];
  },

  /**
   * Estimate available bandwidth
   */
  async estimateBandwidth(url: string, _testSize: number = 1024 * 1024): Promise<number> {
    const start = performance.now();

    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-cache',
      });

      const data = await response.arrayBuffer();
      const duration = (performance.now() - start) / 1000; // seconds
      const sizeBytes = data.byteLength;

      return (sizeBytes / duration) / (1024 * 1024); // MB/s
    } catch (error) {
      console.warn(`Bandwidth estimation failed for ${url}:`, error);
      return 0;
    }
  },

  /**
   * Check if connection is slow
   */
  isSlowConnection(): boolean {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      return connection && (
        connection.effectiveType === 'slow-2g' ||
        connection.effectiveType === '2g' ||
        connection.downlink < 1.5
      );
    }
    return false;
  },

  /**
   * Get connection type information
   */
  getConnectionInfo(): {
    type: string;
    effectiveType: string;
    downlink: number;
    rtt: number;
    } {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      return {
        type: connection?.type || 'unknown',
        effectiveType: connection?.effectiveType || 'unknown',
        downlink: connection?.downlink || 0,
        rtt: connection?.rtt || 0,
      };
    }

    return {
      type: 'unknown',
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0,
    };
  },
};

/**
 * GPU performance utilities
 */
export const GPUUtils = {
  /**
   * Check WebGL support and capabilities
   */
  getWebGLInfo(): {
    supported: boolean;
    version: string;
    vendor: string;
    renderer: string;
    maxTextureSize: number;
    maxViewportDims: number[];
    } {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

    if (!gl) {
      return {
        supported: false,
        version: 'none',
        vendor: 'unknown',
        renderer: 'unknown',
        maxTextureSize: 0,
        maxViewportDims: [0, 0],
      };
    }

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

    return {
      supported: true,
      version: gl.constructor.name,
      vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown',
      renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown',
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
    };
  },

  /**
   * Check if GPU acceleration is beneficial
   */
  shouldUseGPUAcceleration(imageSize: number): boolean {
    const webglInfo = this.getWebGLInfo();

    if (!webglInfo.supported) return false;

    // Use GPU for larger images
    return imageSize > 1024 * 1024; // 1MB threshold
  },

  /**
   * Get optimal texture format for GPU processing
   */
  getOptimalTextureFormat(): 'rgba8' | 'rgba16f' | 'rgba32f' {
    const webglInfo = this.getWebGLInfo();

    if (webglInfo.version.includes('WebGL2')) {
      return 'rgba16f'; // Better precision for medical imaging
    }

    return 'rgba8'; // Fallback for WebGL1
  },
};

/**
 * Performance measurement utilities
 */
export const PerformanceUtils = {
  /**
   * Create a performance timer
   */
  createTimer(name: string): {
    start: () => void;
    stop: () => number;
    lap: () => number;
  } {
    let startTime = 0;
    let lapTime = 0;

    return {
      start: () => {
        startTime = performance.now();
        lapTime = startTime;
      },

      stop: () => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
        return duration;
      },

      lap: () => {
        const currentTime = performance.now();
        const lapDuration = currentTime - lapTime;
        lapTime = currentTime;
        console.log(`⏱️ ${name} (lap): ${lapDuration.toFixed(2)}ms`);
        return lapDuration;
      },
    };
  },

  /**
   * Measure function execution time
   */
  async measureAsync<T>(
    fn: () => Promise<T>,
    name?: string,
  ): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;

    if (name) {
      console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
    }

    return { result, duration };
  },

  /**
   * Measure synchronous function execution time
   */
  measure<T>(fn: () => T, name?: string): { result: T; duration: number } {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    if (name) {
      console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
    }

    return { result, duration };
  },

  /**
   * Create a debounced function for performance optimization
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number,
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;

    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  },

  /**
   * Create a throttled function for performance optimization
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number,
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;

    return (...args: Parameters<T>) => {
      const now = performance.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        func(...args);
      }
    };
  },
};

/**
 * Cache optimization utilities
 */
export const CacheUtils = {
  /**
   * Calculate optimal cache size based on available memory
   */
  calculateOptimalCacheSize(
    availableMemory: number, // MB
    imageSize: number, // MB per image
    targetImages: number = 50,
  ): number {
    const maxCacheSize = availableMemory * 0.7; // Use 70% of available memory
    const idealCacheSize = imageSize * targetImages;

    return Math.min(maxCacheSize, idealCacheSize);
  },

  /**
   * Determine cache priority based on image characteristics
   */
  calculateCachePriority(
    imageIndex: number,
    currentIndex: number,
    _seriesLength: number,
    isCurrentSeries: boolean = true,
  ): CachePriority {
    if (!isCurrentSeries) {
      return CachePriority.BACKGROUND;
    }

    const distance = Math.abs(imageIndex - currentIndex);

    if (imageIndex === currentIndex) {
      return CachePriority.CRITICAL;
    } else if (distance === 1) {
      return CachePriority.HIGH;
    } else if (distance <= 3) {
      return CachePriority.MEDIUM;
    } else if (distance <= 10) {
      return CachePriority.LOW;
    } else {
      return CachePriority.BACKGROUND;
    }
  },

  /**
   * Estimate cache hit rate based on usage patterns
   */
  estimateCacheHitRate(
    preloadDistance: number,
    seriesLength: number,
    navigationType: 'sequential' | 'random' = 'sequential',
  ): number {
    if (navigationType === 'sequential') {
      // Sequential navigation has high hit rate with proper preloading
      const coverage = Math.min(preloadDistance * 2 + 1, seriesLength) / seriesLength;
      return Math.min(90, coverage * 100);
    } else {
      // Random navigation has lower hit rate
      const coverage = Math.min(preloadDistance * 2 + 1, seriesLength) / seriesLength;
      return Math.min(50, coverage * 60);
    }
  },
};

/**
 * Dataset optimization utilities
 */
export const DatasetUtils = {
  /**
   * Analyze dataset characteristics for optimization
   */
  analyzeDataset(config: {
    totalImages: number;
    estimatedImageSize: number; // MB per image
    seriesCount: number;
    studyCount: number;
  }): {
    totalSize: number; // MB
    complexity: 'simple' | 'moderate' | 'complex';
    recommendedStrategy: 'eager' | 'progressive' | 'streaming';
    estimatedLoadTime: number; // seconds
  } {
    const { totalImages, estimatedImageSize, seriesCount: _seriesCount, studyCount: _studyCount } = config;
    // Variables extracted from config but not used in current implementation
    _seriesCount;
    _studyCount;
    const totalSize = totalImages * estimatedImageSize;

    let complexity: 'simple' | 'moderate' | 'complex';
    let recommendedStrategy: 'eager' | 'progressive' | 'streaming';

    if (totalImages < 100 && totalSize < 500) {
      complexity = 'simple';
      recommendedStrategy = 'eager';
    } else if (totalImages < 1000 && totalSize < 2000) {
      complexity = 'moderate';
      recommendedStrategy = 'progressive';
    } else {
      complexity = 'complex';
      recommendedStrategy = 'streaming';
    }

    // Estimate load time (very rough)
    const networkSpeed = NetworkUtils.isSlowConnection() ? 1 : 10; // MB/s
    const estimatedLoadTime = totalSize / networkSpeed;

    return {
      totalSize,
      complexity,
      recommendedStrategy,
      estimatedLoadTime,
    };
  },

  /**
   * Get optimization recommendations based on dataset analysis
   */
  getOptimizationRecommendations(dataset: {
    totalSize: number;
    complexity: 'simple' | 'moderate' | 'complex';
    recommendedStrategy: 'eager' | 'progressive' | 'streaming';
  }): string[] {
    const recommendations: string[] = [];

    switch (dataset.complexity) {
      case 'simple':
        recommendations.push('Enable eager loading for fast access');
        recommendations.push('Use larger cache size for better hit rates');
        break;

      case 'moderate':
        recommendations.push('Enable progressive loading for balanced performance');
        recommendations.push('Use moderate preloading distance (3-5 images)');
        recommendations.push('Enable compression to reduce network usage');
        break;

      case 'complex':
        recommendations.push('Enable streaming with aggressive memory management');
        recommendations.push('Use minimal preloading to conserve memory');
        recommendations.push('Enable all compression and optimization features');
        recommendations.push('Consider viewport-based loading');
        break;
    }

    if (NetworkUtils.isSlowConnection()) {
      recommendations.push('Detected slow connection - enable compression and reduce quality');
    }

    if (MemoryUtils.isMemoryPressure()) {
      recommendations.push('Memory pressure detected - reduce cache size and enable aggressive GC');
    }

    return recommendations;
  },
};

/**
 * Viewport optimization utilities
 */
export const ViewportUtils = {
  /**
   * Calculate visible image indices for a viewport
   */
  calculateVisibleIndices(
    currentIndex: number,
    viewportSize: { width: number; height: number },
    imageSize: { width: number; height: number },
    totalImages: number,
  ): number[] {
    // Simplified calculation - in reality this would depend on layout
    const visibleCount = Math.ceil(viewportSize.width / imageSize.width) *
                        Math.ceil(viewportSize.height / imageSize.height);

    const indices: number[] = [];
    const start = Math.max(0, currentIndex - Math.floor(visibleCount / 2));
    const end = Math.min(totalImages - 1, start + visibleCount - 1);

    for (let i = start; i <= end; i++) {
      indices.push(i);
    }

    return indices;
  },

  /**
   * Calculate preload indices based on viewport and navigation direction
   */
  calculatePreloadIndices(
    currentIndex: number,
    direction: 'forward' | 'backward' | 'bidirectional',
    preloadDistance: number,
    totalImages: number,
  ): number[] {
    const indices: number[] = [];

    if (direction === 'forward' || direction === 'bidirectional') {
      for (let i = 1; i <= preloadDistance; i++) {
        const index = currentIndex + i;
        if (index < totalImages) {
          indices.push(index);
        }
      }
    }

    if (direction === 'backward' || direction === 'bidirectional') {
      for (let i = 1; i <= preloadDistance; i++) {
        const index = currentIndex - i;
        if (index >= 0) {
          indices.push(index);
        }
      }
    }

    return indices;
  },
};

/**
 * Generate performance optimization summary
 */
export function generateOptimizationSummary(metrics: PerformanceMetrics): string {
  const memoryInfo = MemoryUtils.getCurrentMemoryUsage();
  const networkInfo = NetworkUtils.getConnectionInfo();
  const webglInfo = GPUUtils.getWebGLInfo();

  return `
Performance Optimization Summary
===============================

System Capabilities:
--------------------
• Memory: ${memoryInfo.total.toFixed(1)} MB total, ${memoryInfo.used.toFixed(1)} MB used (${memoryInfo.percentage.toFixed(1)}%)
• Network: ${networkInfo.effectiveType} (${networkInfo.downlink} Mbps down, ${networkInfo.rtt}ms RTT)
• GPU: ${webglInfo.supported ? webglInfo.renderer : 'Not supported'}
• WebGL: ${webglInfo.version} (Max texture: ${webglInfo.maxTextureSize}px)

Current Performance:
-------------------
• Load Time: ${metrics.loadingTimes.average.toFixed(0)}ms avg (${metrics.loadingTimes.p95.toFixed(0)}ms p95)
• Memory Usage: ${metrics.memoryUsage.percentage.toFixed(1)}%
• Cache Hit Rate: ${metrics.cachePerformance.hitRate.toFixed(1)}%
• Rendering: ${metrics.renderingPerformance.fps.toFixed(1)} FPS

Optimization Status:
-------------------
• Memory Pressure: ${MemoryUtils.isMemoryPressure() ? 'HIGH' : 'OK'}
• Network Speed: ${NetworkUtils.isSlowConnection() ? 'SLOW' : 'GOOD'}
• GPU Acceleration: ${webglInfo.supported ? 'AVAILABLE' : 'DISABLED'}

Recommendations:
---------------
${DatasetUtils.getOptimizationRecommendations({
    totalSize: metrics.memoryUsage.used,
    complexity: metrics.loadingTimes.average > 2000 ? 'complex' : 'moderate',
    recommendedStrategy: 'progressive',
  }).map(r => `• ${r}`).join('\n')}

Generated: ${new Date().toISOString()}
===============================
  `.trim();
}
