/**
 * Dummy polyseg implementation to prevent build errors
 * This module is temporarily disabled to avoid WASM loading issues
 */

class ICRPolySeg {
  static async createModule() {
    console.warn('PolySeg WASM module is disabled');
    return null;
  }
}

// Default export for compatibility
export default ICRPolySeg;