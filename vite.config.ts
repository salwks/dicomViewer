import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  define: {
    // Fix for some Cornerstone3D dependencies
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['@cornerstonejs/core', '@cornerstonejs/tools']
  }
});