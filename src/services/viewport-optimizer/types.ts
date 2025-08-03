/**
 * Viewport Optimizer Types & Interfaces
 * Type definitions for viewport optimization system
 */

import { CleanupPriority } from '../memoryManager';

// Performance metrics interface
export interface PerformanceMetrics {
  fps: number;
  renderTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  gpuMemoryUsage: number;
  triangleCount: number;
  drawCalls: number;
}

// Enhanced memory management interfaces
export interface ViewportMemoryThreshold {
  viewportId: string;
  maxMemory: number;
  warningThreshold: number;
  criticalThreshold: number;
  lastMemoryCheck: number;
  memoryPressureLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface TexturePriorityInfo {
  textureId: string;
  viewportId: string;
  priority: number;
  lastUsed: number;
  size: number;
  isShared: boolean;
  usage: 'active' | 'cached' | 'stale';
}

export interface ResourceCleanupStage {
  stage: 'immediate' | 'delayed' | 'periodic';
  targetTypes: ('textures' | 'buffers' | 'cache' | 'imageData')[];
  priority: CleanupPriority;
  delay?: number;
}

// Rendering priority levels
export enum RenderPriority {
  CRITICAL = 0,  // Active viewport with user interaction
  HIGH = 1,      // Active viewport
  MEDIUM = 2,    // Visible inactive viewport
  LOW = 3,       // Hidden viewport
  SUSPENDED = 4, // Suspended rendering
}

// Quality level configuration
export interface QualityLevel {
  name: string;
  interpolationType: 'LINEAR' | 'NEAREST';
  textureQuality: number; // 0.1 to 1.0
  shadowQuality: number;  // 0.1 to 1.0
  renderScale: number;    // 0.5 to 1.0
  maxTextureSize: number;
  enableVSync: boolean;
  targetFps: number;
}

// Optimization strategy configuration
export interface OptimizationConfig {
  maxFps: number;
  memoryThreshold: number; // MB
  qualityLevels: QualityLevel[];
  adaptiveQuality: boolean;
  resourcePooling: boolean;
  lazyLoading: boolean;
  priorityThrottling: boolean;
}

// Viewport optimization state
export interface ViewportOptimizationState {
  viewportId: string;
  priority: RenderPriority;
  qualityLevel: QualityLevel;
  isRendering: boolean;
  lastRenderTime: number;
  frameCount: number;
  memoryAllocated: number;
  resourcesLoaded: boolean;
  throttleRatio: number;
}

// Resource pool for sharing textures and buffers
export interface ResourcePool {
  textures: Map<string, WebGLTexture>;
  buffers: Map<string, WebGLBuffer>;
  shaders: Map<string, WebGLProgram>;
  memoryUsage: number;
  lastCleanup: number;
}

// Performance monitoring data structure
export interface PerformanceMonitoringData {
  timestamp: number;
  viewportId: string;
  fps: number;
  renderTime: number;
  memoryUsage: number;
  cpuUsage: number;
  gpuUsage: number;
  networkLatency: number;
  cacheHitRate: number;
  triangleCount: number;
  drawCalls: number;
  shaderCompileTime: number;
  textureUploadTime: number;
  vertexBufferUploadTime: number;
  frameDropCount: number;
  qualityLevel: string;
  adaptiveQualityChanges: number;
  memoryPressure: 'low' | 'medium' | 'high' | 'critical';
  thermalState: 'nominal' | 'fair' | 'serious' | 'critical';
  batteryLevel?: number;
  isLowPowerMode?: boolean;
  networkType?: 'wifi' | '4g' | '5g' | 'ethernet' | 'unknown';
  bandwidthUtilization?: number;
  storageType?: 'ssd' | 'hdd' | 'nvme' | 'unknown';
  diskIOWaitTime?: number;
  contextSwitches?: number;
  pageSwaps?: number;
  cacheLineHits?: number;
  cacheLineMisses?: number;
  branchMispredictions?: number;
  instructionsPerCycle?: number;
  l1CacheHitRate?: number;
  l2CacheHitRate?: number;
  l3CacheHitRate?: number;
  tlbHitRate?: number;
  vectorizedInstructions?: number;
  simdUtilization?: number;
  prefetchEfficiency?: number;
  memoryBandwidthUtilization?: number;
  pcieBandwidthUtilization?: number;
  thermalThrottlingEvents?: number;
  powerConsumption?: number;
  voltageRegulatorEfficiency?: number;
  coreTemperatures?: number[];
  gpuTemperature?: number;
  fanSpeed?: number;
  overclockingState?: 'disabled' | 'auto' | 'manual';
  memoryTimings?: {
    cas: number;
    tras: number;
    trp: number;
    trcd: number;
  };
  gpuClockSpeed?: number;
  gpuMemoryClockSpeed?: number;
  vramUsage?: number;
  shaderCoreUtilization?: number;
  textureMemoryBandwidth?: number;
  renderTargetSwitches?: number;
  stateChanges?: number;
  uniformBufferUpdates?: number;
  vertexArrayBindings?: number;
  textureBindings?: number;
  framebufferBindings?: number;
  cullFaceEnabled?: boolean;
  depthTestEnabled?: boolean;
  blendingEnabled?: boolean;
  multisamplingLevel?: number;
  anisotropicFilteringLevel?: number;
  mipmapGenerationTime?: number;
  tessellationPatchCount?: number;
  geometryShaderInvocations?: number;
  computeShaderDispatches?: number;
  atomicOperations?: number;
  memoryBarriers?: number;
  synchronizationStalls?: number;
  pipelineStalls?: number;
  vertexShaderExecutionTime?: number;
  fragmentShaderExecutionTime?: number;
  primitiveRestartCount?: number;
  vertexFetchStalls?: number;
  pixelFillRate?: number;
  vertexThroughput?: number;
  triangleSetupRate?: number;
  rasterizationEfficiency?: number;
  earlyDepthTestKillRate?: number;
  lateDepthTestKillRate?: number;
  alphaToCoverageRate?: number;
  occlusionQueryResults?: Map<string, boolean>;
  timerQueryResults?: Map<string, number>;
  debugMarkers?: string[];
  performanceCounters?: Map<string, number>;
  customMetrics?: Map<string, unknown>;
}

// Event types for viewport optimizer
export interface ViewportOptimizerEvents {
  'optimization-applied': [string, OptimizationConfig]; // [viewportId, config]
  'quality-changed': [string, QualityLevel, QualityLevel]; // [viewportId, oldLevel, newLevel]
  'memory-pressure': [string, number, number]; // [viewportId, currentUsage, threshold]
  'performance-warning': [string, string, number]; // [viewportId, metric, value]
  'resource-cleanup': [string, string[], number]; // [reason, cleanedResources, freedMemory]
}
