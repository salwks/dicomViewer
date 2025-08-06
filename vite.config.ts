import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { securityHeaders, medicalCSPConfig } from './vite-security-headers-plugin';
import { wasmResolver } from './vite-wasm-resolver.js';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';

// package.json에서 버전 정보 읽기
const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, 'package.json'), 'utf8')
);

// https://vitejs.dev/config/
export default defineConfig({
  // Disable all sourcemaps to prevent blob URL issues
  css: {
    devSourcemap: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // Replace problematic WASM module with canvas-based polygon segmentation
      '@icr/polyseg-wasm': resolve(__dirname, './src/utils/polygonSegmentation.ts'),
      // Fix cornerstone tools module resolution
      '@cornerstonejs/tools': resolve(__dirname, './node_modules/@cornerstonejs/tools/dist/esm/index.js'),
      // CRITICAL: Block all DICOM codec imports to prevent loading errors
      '@cornerstonejs/codec-libjpeg-turbo-8bit': resolve(__dirname, './src/utils/mockCodec.ts'),
      '@cornerstonejs/codec-charls': resolve(__dirname, './src/utils/mockCodec.ts'),
      '@cornerstonejs/codec-openjpeg': resolve(__dirname, './src/utils/mockCodec.ts'),
      '@cornerstonejs/codec-openjph': resolve(__dirname, './src/utils/mockCodec.ts'),
      // Block all codec submodules and factory imports
      '@cornerstonejs/codec-openjph/wasmjs': resolve(__dirname, './src/utils/mockCodec.ts'),
      '@cornerstonejs/codec-libjpeg-turbo-8bit/dist/libjpegturbowasm_decode.js': resolve(__dirname, './src/utils/mockCodec.ts'),
      '@cornerstonejs/codec-charls/dist/charlswasm_decode.js': resolve(__dirname, './src/utils/mockCodec.ts'),
      '@cornerstonejs/codec-openjpeg/dist/openjpegwasm_decode.js': resolve(__dirname, './src/utils/mockCodec.ts'),
    },
  },
  plugins: [
    react(),
    // wasmResolver(), // Temporarily disabled to debug esbuild error
    wasm(),
    topLevelAwait(),
    
    // Custom plugin to block codec imports
    {
      name: 'block-codec-imports',
      resolveId(id) {
        // Block all codec-related imports
        if (id.includes('@cornerstonejs/codec-') || 
            id.includes('/wasmjs') ||
            id.includes('wasm_decode') ||
            id.includes('charlswasm') ||
            id.includes('libjpegturbowasm') ||
            id.includes('openjpegwasm') ||
            id.includes('openjphjs')) {
          console.log('🚫 Blocking codec import:', id);
          return resolve(__dirname, './src/utils/mockCodec.ts');
        }
        return null;
      },
      load(id) {
        // Handle decoder files in DICOM image loader
        if (id.includes('decodeJPEGBaseline8Bit.js') ||
            id.includes('decodeJPEGLS.js') ||
            id.includes('decodeJPEG2000.js') ||
            id.includes('decodeHTJ2K.js') ||
            id.includes('decodeRLE.js')) {
          console.log('🚫 Blocking decoder file:', id);
          return `
            export default function mockDecoder() {
              console.warn('Mock decoder called - codec disabled in development');
              return Promise.reject(new Error('Codec disabled in development mode'));
            }
          `;
        }
        return null;
      }
    },
    
    // Security Headers Plugin with CSP blob: URL support
    securityHeaders(),
    
    // CRITICAL: Copy worker files for production stability
    viteStaticCopy({
      targets: [
        // Cornerstone Tools compute worker
        {
          src: 'node_modules/@cornerstonejs/tools/dist/esm/workers/computeWorker.js',
          dest: 'cornerstone-workers',
          rename: 'computeWorker.js'
        },
        // DICOM decode workers (if they exist as separate files)
        {
          src: 'node_modules/@cornerstonejs/dicom-image-loader/dist/esm/decodeImageFrameWorker.js',
          dest: 'cornerstone-workers',
          rename: 'decodeImageFrameWorker.js'
        }
      ].filter(target => {
        // Only copy files that actually exist
        if (existsSync(target.src)) {
          console.log(`✅ Worker file found: ${target.src}`);
          return true;
        } else {
          console.log(`⚠️ Worker file not found: ${target.src}`);
          return false;
        }
      })
    })
  ],
  server: {
    port: 3000,
    host: true,
    fs: {
      allow: ['..']
    },
    // CORS headers now handled by security plugin
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable sourcemaps to prevent worker issues
    minify: false, // Disable minification to prevent sourcemap generation
    target: 'esnext',
    rollupOptions: {
      // Simplify plugin configuration to fix esbuild error
      plugins: [],
      external: (id) => {
        // Ensure id is a string before processing
        if (typeof id !== 'string') {
          return false;
        }
        
        // External 모든 polyseg 관련 모듈
        if (id.includes('@icr/polyseg-wasm') || 
            id.includes('ICRPolySeg') || 
            id.includes('.wasm') ||
            id === 'a') {
          return true;
        }
        
        return false;
      },
      onwarn(warning, warn) {
        // Ignore WASM-related warnings
        if (warning.code === 'UNRESOLVED_IMPORT' && warning.source?.includes('.wasm')) {
          return;
        }
        // Ignore specific polyseg warnings
        if (warning.message?.includes('@icr/polyseg-wasm') || warning.message?.includes('ICRPolySeg.wasm')) {
          return;
        }
        // Ignore export warnings for external modules
        if (warning.code === 'MISSING_EXPORT' && warning.source?.includes('@icr/polyseg-wasm')) {
          return;
        }
        warn(warning);
      },
      output: {
        // Handle WASM files properly
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.wasm')) {
            return 'assets/[name].[hash][extname]';
          }
          return 'assets/[name].[hash][extname]';
        }
      }
    }
  },
  define: {
    // Fix for some Cornerstone3D dependencies
    global: 'globalThis',
    // Disable polyseg WASM module to prevent build issues
    'process.env.DISABLE_POLYSEG': 'true',
    // 🚀 버전 정보 환경 변수 추가
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version),
    'import.meta.env.VITE_APP_NAME': JSON.stringify(packageJson.name),
  },
  optimizeDeps: {
    include: ['@cornerstonejs/core', '@cornerstonejs/tools'],
    exclude: [
      '@icr/polyseg-wasm', 
      '@icr/polyseg-wasm/dist/ICRPolySeg.wasm',
      'a',
      // Exclude DICOM image loader and codecs from optimization
      '@cornerstonejs/dicom-image-loader',
      '@cornerstonejs/codec-libjpeg-turbo-8bit',
      '@cornerstonejs/codec-charls',
      '@cornerstonejs/codec-openjpeg',
      '@cornerstonejs/codec-openjph',
      // Exclude all codec submodules
      '@cornerstonejs/codec-openjph/wasmjs',
      '@cornerstonejs/codec-libjpeg-turbo-8bit/dist/libjpegturbowasm_decode.js',
      '@cornerstonejs/codec-charls/dist/charlswasm_decode.js',
      '@cornerstonejs/codec-openjpeg/dist/openjpegwasm_decode.js'
    ],
    esbuildOptions: {
      // Force ESM format for problematic modules
      format: 'esm',
      target: 'esnext'
    }
  },
  worker: {
    format: 'es',
    plugins: () => [wasm(), topLevelAwait()],
    rollupOptions: {
      output: {
        inlineDynamicImports: false,
        sourcemap: false, // Critical: No sourcemaps for workers
        // Simple naming without hashes to prevent blob URL issues
        entryFileNames: '[name].worker.js',
        chunkFileNames: '[name].worker.js',
        assetFileNames: '[name][extname]'
      },
      onwarn(warning, warn) {
        // Suppress sourcemap warnings for workers
        if (warning.code === 'SOURCEMAP_ERROR' || warning.message?.includes('sourcemap')) {
          return;
        }
        warn(warning);
      }
    }
  }
});