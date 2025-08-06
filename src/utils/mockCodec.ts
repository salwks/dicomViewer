/**
 * Mock DICOM Codec
 * Prevents codec loading errors in development environment
 * Returns safe mock implementations for all codec functions
 */

import { log } from './logger';

// Mock decoder function that returns unprocessed data
const mockDecoder = (_imageFrame: any, transferSyntaxUID: string, pixelData: any) => {
  log.warn('Mock codec decoder called - codecs disabled in development', {
    transferSyntaxUID,
    pixelDataLength: pixelData?.length || 0,
  });
  return Promise.resolve(pixelData);
};

// Mock factory function for WASM codecs
const mockWasmFactory = () => {
  log.info('Mock WASM factory called - returning mock module');
  return Promise.resolve({
    decode: mockDecoder,
    initialize: () => Promise.resolve(),
    destroy: () => {},
    memory: null,
    instance: null,
  });
};

// Mock codec object with all required exports
const mockCodec = {
  // Default export - can be decoder or factory depending on context
  default: mockWasmFactory,

  // Named exports
  decodeImageFrame: mockDecoder,
  decoder: mockDecoder,

  // Factory function exports (for wasmjs modules)
  wasmFactory: mockWasmFactory,
  createInstance: mockWasmFactory,

  // Initialize function
  initialize: () => {
    log.info('Mock codec initialized - no actual codec loaded');
    return Promise.resolve();
  },

  // Cleanup function
  destroy: () => {
    log.info('Mock codec destroyed');
  },

  // Configuration
  configure: () => {
    log.info('Mock codec configured');
  },

  // Status
  isInitialized: () => false,

  // WASM-specific properties
  wasmModule: null,
  memory: null,
  instance: null,

  // Any other properties that might be accessed
  [Symbol.toStringTag]: 'MockCodec',
};

// Export as both default and named exports to cover all import patterns
export default mockWasmFactory; // Default should be factory for wasmjs imports
export const decodeImageFrame = mockDecoder;
export const decoder = mockDecoder;
export const initialize = mockCodec.initialize;
export const destroy = mockCodec.destroy;
export const configure = mockCodec.configure;
export const isInitialized = mockCodec.isInitialized;
export const wasmFactory = mockWasmFactory;
export const createInstance = mockWasmFactory;

// Export all mockCodec properties for comprehensive coverage
export const wasmModule = mockCodec.wasmModule;
export const memory = mockCodec.memory;
