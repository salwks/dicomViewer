/**
 * Dummy polyseg module to prevent build errors
 * This replaces the problematic @icr/polyseg-wasm module
 */

// Export a dummy class that matches the expected interface
export default class DummyPolySeg {
  static instance: DummyPolySeg | null = null;
  
  static getInstance(): DummyPolySeg {
    if (!DummyPolySeg.instance) {
      DummyPolySeg.instance = new DummyPolySeg();
    }
    return DummyPolySeg.instance;
  }
  
  // Dummy methods that might be called
  async initialize() {
    console.warn('PolySeg WASM module is disabled to prevent build issues');
    return false;
  }
  
  async segment() {
    console.warn('PolySeg segmentation is disabled');
    return null;
  }
  
  dispose() {
    // No-op
  }
}

// Export as both default and named export
export { DummyPolySeg };