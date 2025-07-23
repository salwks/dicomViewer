/**
 * Dummy implementation for polyseg-wasm to prevent build issues
 * This is a placeholder that provides the expected interface
 */

export default class ICRPolySeg {
  constructor() {
    console.warn('ICRPolySeg dummy implementation - actual segmentation disabled');
  }

  static getInstance() {
    return new ICRPolySeg();
  }

  // Dummy methods to match expected interface
  init() {
    return Promise.resolve();
  }

  process() {
    return Promise.resolve(null);
  }
}

// Export for CommonJS compatibility
module.exports = ICRPolySeg;
