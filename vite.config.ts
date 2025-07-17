import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { securityHeaders, medicalCSPConfig } from './vite-security-headers-plugin';
import { wasmResolver } from './vite-wasm-resolver.js';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';

// package.json에서 버전 정보 읽기
const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, 'package.json'), 'utf8')
);

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // Replace problematic WASM module with dummy implementation
      '@icr/polyseg-wasm': resolve(__dirname, './src/utils/polyseg-dummy.ts'),
    },
  },
  plugins: [
    react(),
    // wasmResolver(), // Temporarily disabled to debug esbuild error
    wasm(),
    topLevelAwait(),
    
    // Security Headers Plugin for Medical Imaging
    securityHeaders({
      contentSecurityPolicy: medicalCSPConfig,
      strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
      xFrameOptions: 'DENY',
      xContentTypeOptions: 'nosniff',
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: [
        'accelerometer=()',
        'camera=(self)',
        'geolocation=()',
        'gyroscope=()',
        'magnetometer=()',
        'microphone=(self)',
        'payment=()',
        'usb=(self)', // For medical device connectivity
      ].join(', '),
      // Relax CORS policies for development
      crossOriginEmbedderPolicy: process.env.NODE_ENV === 'development' ? undefined : 'require-corp',
      crossOriginOpenerPolicy: process.env.NODE_ENV === 'development' ? undefined : 'same-origin',
      crossOriginResourcePolicy: process.env.NODE_ENV === 'development' ? undefined : 'same-origin',
      xXSSProtection: '1; mode=block',
      customHeaders: {
        'X-Medical-Data-Protection': 'HIPAA-Compliant',
        'X-Security-Policy': 'Medical-Imaging-Enhanced',
        'X-Content-Security-Policy': 'Medical-Grade',
        'Cache-Control': process.env.NODE_ENV === 'development' ? 'no-cache' : 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
      enableHSTS: process.env.NODE_ENV !== 'development', // Disable HSTS in development
      enableNonce: false, // Disabled for compatibility with medical imaging libraries
    }),
    
    viteStaticCopy({
      targets: [
        {
          src: './node_modules/@cornerstonejs/dicom-image-loader/dist/index.worker.bundle.min.worker.js',
          dest: 'cornerstone-dicom-image-loader',
          rename: 'cornerstoneDICOMImageLoaderWebWorker.min.js'
        },
        {
          src: './node_modules/@cornerstonejs/dicom-image-loader/dist/dynamic-import/*.worker.js',
          dest: 'cornerstone-dicom-image-loader',
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
    sourcemap: process.env.NODE_ENV === 'development',
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
      'a'
    ]
  },
  worker: {
    format: 'es',
    plugins: () => [wasm(), topLevelAwait()],
    rollupOptions: {
      output: {
        inlineDynamicImports: false,
        sourcemap: false // Disable source maps for workers to prevent blob URL issues
      }
    }
  }
});