/**
 * Performance Monitoring Types
 * Type definitions for the performance monitoring system
 */

export interface PerformanceSnapshot {
  timestamp: number;
  sessionId: string;
  metrics: {
    rendering: RenderingPerformanceMetrics;
    memory: MemoryPerformanceMetrics;
    synchronization: SyncPerformanceMetrics;
    lazyLoading: LazyLoadingPerformanceMetrics;
    system: SystemPerformanceMetrics;
  };
  issues: PerformanceIssue[];
  recommendations: PerformanceRecommendation[];
}

export interface RenderingPerformanceMetrics {
  frameRate: {
    current: number;
    average: number;
    target: number;
    drops: number;
  };
  renderTime: {
    average: number;
    peak: number;
    p95: number;
    p99: number;
  };
  viewportMetrics: Map<string, {
    fps: number;
    renderTime: number;
    droppedFrames: number;
    qualityLevel: string;
  }>;
  optimization: {
    throttledFrames: number;
    adaptiveQualityChanges: number;
    cullingSavings: number;
  };
}

export interface MemoryPerformanceMetrics {
  usage: {
    total: number;
    used: number;
    available: number;
    peak: number;
  };
  allocation: {
    rate: number; // MB/sec
    peak: number;
    frequency: number;
  };
  gc: {
    collections: number;
    totalTime: number;
    averageTime: number;
    pressure: 'low' | 'medium' | 'high' | 'critical';
  };
  pools: {
    texturePool: { used: number; total: number; hitRate: number };
    bufferPool: { used: number; total: number; hitRate: number };
    shaderPool: { used: number; total: number; hitRate: number };
  };
}

export interface SyncPerformanceMetrics {
  operations: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
  };
  timing: {
    averageLatency: number;
    maxLatency: number;
    p95Latency: number;
    p99Latency: number;
  };
  conflicts: {
    total: number;
    resolved: number;
    unresolved: number;
    averageResolutionTime: number;
  };
  throughput: {
    operationsPerSecond: number;
    bytesPerSecond: number;
    peakThroughput: number;
  };
}

export interface LazyLoadingPerformanceMetrics {
  requests: {
    total: number;
    completed: number;
    pending: number;
    failed: number;
  };
  caching: {
    hitRate: number;
    missRate: number;
    evictions: number;
    size: number;
  };
  loading: {
    averageTime: number;
    p95Time: number;
    p99Time: number;
    bandwidth: number;
  };
}

export interface SystemPerformanceMetrics {
  cpu: {
    usage: number;
    cores: number;
    frequency: number;
    temperature?: number;
  };
  memory: {
    physical: { total: number; available: number };
    virtual: { total: number; available: number };
    swap: { total: number; used: number };
  };
  gpu: {
    usage: number;
    memory: { total: number; used: number };
    temperature?: number;
    driver: string;
  };
  network: {
    latency: number;
    bandwidth: { upload: number; download: number };
    packetLoss: number;
  };
  storage: {
    readSpeed: number;
    writeSpeed: number;
    availableSpace: number;
    iops: number;
  };
}

export interface PerformanceIssue {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'rendering' | 'memory' | 'synchronization' | 'loading' | 'system';
  title: string;
  description: string;
  impact: string;
  detectedAt: number;
  affectedViewports: string[];
  metrics: {
    current: number;
    threshold: number;
    trend: 'improving' | 'stable' | 'degrading';
  };
  suggestions: string[];
}

export interface PerformanceRecommendation {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'optimization' | 'configuration' | 'hardware' | 'software';
  title: string;
  description: string;
  expectedImprovement: string;
  implementationEffort: 'low' | 'medium' | 'high';
  steps: string[];
  relatedIssues: string[];
}

export interface PerformanceReport {
  id: string;
  sessionId: string;
  generatedAt: number;
  timeRange: {
    start: number;
    end: number;
    duration: number;
  };
  summary: {
    overallScore: number; // 0-100
    status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    criticalIssues: number;
    recommendations: number;
  };
  sections: PerformanceSection[];
  trends: PerformanceTrend[];
  rawData: PerformanceSnapshot[];
}

export interface PerformanceSection {
  title: string;
  score: number; // 0-100
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  metrics: Record<string, number>;
  issues: PerformanceIssue[];
  recommendations: PerformanceRecommendation[];
  charts: {
    type: 'line' | 'bar' | 'pie' | 'gauge';
    data: Record<string, unknown>;
  }[];
}

export interface PerformanceTrend {
  metric: string;
  direction: 'up' | 'down' | 'stable';
  changePercent: number;
  significance: 'low' | 'medium' | 'high';
  timeframe: string;
}

export interface MonitoringConfig {
  sampleInterval: number; // milliseconds
  retentionPeriod: number; // milliseconds
  alertThresholds: {
    fps: { warning: number; critical: number };
    renderTime: { warning: number; critical: number };
    memoryUsage: { warning: number; critical: number };
    cpuUsage: { warning: number; critical: number };
    gpuUsage: { warning: number; critical: number };
  };
  enabledMetrics: {
    rendering: boolean;
    memory: boolean;
    synchronization: boolean;
    lazyLoading: boolean;
    system: boolean;
  };
  reportGeneration: {
    autoGenerate: boolean;
    interval: number; // milliseconds
    includeCharts: boolean;
    includeRawData: boolean;
  };
}

export interface PerformanceMonitoringSystemEvents {
  'snapshot-collected': [PerformanceSnapshot];
  'issue-detected': [PerformanceIssue];
  'issue-resolved': [string]; // issue ID
  'report-generated': [PerformanceReport];
  'threshold-exceeded': [string, number, number]; // metric, current, threshold
  'recommendation-generated': [PerformanceRecommendation];
}
