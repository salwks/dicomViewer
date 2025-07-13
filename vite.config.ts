import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@cornerstonejs/dicom-image-loader/dist/index.worker.bundle.min.worker.js',
          dest: 'workers',
          rename: 'cornerstoneDICOMImageLoaderWebWorker.min.js'
        },
        {
          src: 'node_modules/@cornerstonejs/dicom-image-loader/dist/dynamic-import/*.worker.js',
          dest: 'workers'
        }
      ]
    })
  ],
  server: {
    port: 3000,
    host: true,
    fs: {
      allow: ['..']
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'esnext',
    rollupOptions: {
      external: ['@icr/polyseg-wasm']
    }
  },
  define: {
    // Fix for some Cornerstone3D dependencies
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['@cornerstonejs/core', '@cornerstonejs/tools'],
    exclude: ['@icr/polyseg-wasm']
  },
  worker: {
    format: 'es',
    plugins: () => [wasm(), topLevelAwait()]
  }
});