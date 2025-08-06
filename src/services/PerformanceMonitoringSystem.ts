/**
 * Performance Monitoring System
 * Advanced performance monitoring and analysis for the entire viewport optimization system
 *
 * @deprecated Use ./performance-monitoring/index.ts instead
 * This file is kept for backward compatibility
 */

import { log } from '../utils/logger';

// Log deprecation warning
log.warn('PerformanceMonitoringSystem.ts is deprecated, use performance-monitoring/index.ts instead', {
  component: 'PerformanceMonitoringSystem',
  metadata: { deprecated: true },
});

// Re-export from the new modular structure
export * from './performance-monitoring/index';
import { performanceMonitoringSystem } from './performance-monitoring/index';
export default performanceMonitoringSystem;
