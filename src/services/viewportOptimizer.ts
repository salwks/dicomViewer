/**
 * Viewport Performance Optimizer
 * Advanced optimization system for multi-viewport medical imaging
 * Built with security compliance and type safety
 *
 * @deprecated Use ./viewport-optimizer/index.ts instead
 * This file is kept for backward compatibility
 */

import { log } from '../utils/logger';

// Log deprecation warning
log.warn('viewportOptimizer.ts is deprecated, use viewport-optimizer/index.ts instead', {
  component: 'ViewportOptimizer',
  metadata: { deprecated: true },
});

// Re-export from the new modular structure
export * from './viewport-optimizer/index';
export { viewportOptimizer as default } from './viewport-optimizer/index';
