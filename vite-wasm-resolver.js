// Custom WASM resolver plugin for Vite
export function wasmResolver() {
  return {
    name: 'wasm-resolver',
    resolveId(id, importer) {
      // Ensure id is a string before processing
      if (typeof id !== 'string') {
        return null;
      }
      
      // Skip polyseg WASM modules completely
      if (id.includes('@icr/polyseg-wasm') || 
          id.includes('ICRPolySeg.wasm') || 
          id.includes('ICRPolySeg.js') ||
          id.endsWith('.wasm')) {
        return {
          id: 'virtual:empty-module',
          external: false
        };
      }
      
      // Skip segmentation polyseg worker registration
      if (id.includes('registerPolySegWorker')) {
        return {
          id: 'virtual:empty-module',
          external: false
        };
      }
      
      return null;
    },
    load(id) {
      // Return empty module for problematic imports
      if (id === 'virtual:empty-module') {
        return 'export default {};';
      }
      
      return null;
    }
  };
}