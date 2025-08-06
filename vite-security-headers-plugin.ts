/**
 * Vite Security Headers Plugin
 * Medical-grade security configuration for DICOM viewer
 */

import { Plugin } from 'vite';

export interface CSPConfig {
  'default-src': string[];
  'script-src': string[];
  'style-src': string[];
  'img-src': string[];
  'connect-src': string[];
  'font-src': string[];
  'object-src': string[];
  'media-src': string[];
  'worker-src': string[];
  'child-src': string[];
  'frame-ancestors': string[];
  'base-uri': string[];
  'form-action': string[];
}

export const medicalCSPConfig: CSPConfig = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'", // Required for dynamic medical imaging scripts
    "'unsafe-eval'", // Required for cornerstone3D WebGL shaders
    'blob:', // Allow blob: URLs for Web Workers
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for dynamic styling
  ],
  'img-src': [
    "'self'",
    'data:', // Allow data URLs for medical images
    'blob:', // Allow blob URLs for processed images
    'https:', // Allow HTTPS image sources
  ],
  'connect-src': [
    "'self'",
    'https:', // Allow HTTPS connections for DICOM retrieval
    'wss:', // Allow WebSocket connections
    'blob:', // Allow blob URLs for DICOM image loading
    'data:', // Allow data URLs for WASM module loading - CRITICAL FIX
  ],
  'font-src': [
    "'self'",
    'data:', // Allow data URLs for fonts
  ],
  'object-src': ["'none'"], // Disable object embedding for security
  'media-src': [
    "'self'",
    'blob:', // Allow blob URLs for medical media
    'data:', // Allow data URLs for medical media
  ],
  'worker-src': [
    "'self'",
    'blob:', // Allow blob: URLs for Web Workers - CRITICAL FIX
  ],
  'child-src': [
    "'self'",
    'blob:', // Allow blob URLs for child contexts
  ],
  'frame-ancestors': ["'none'"], // Prevent framing for security
  'base-uri': ["'self'"], // Restrict base URI
  'form-action': ["'self'"], // Restrict form actions
};

function generateCSPString(config: CSPConfig): string {
  return Object.entries(config)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}

export function securityHeaders(): Plugin {
  return {
    name: 'security-headers',
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        // Modify CSP for development environment to allow test URLs
        const isDevelopment = process.env.NODE_ENV === 'development' || server.config.command === 'serve';
        let cspConfig = { ...medicalCSPConfig };
        
        if (isDevelopment) {
          // Add test URLs for development testing
          cspConfig = {
            ...cspConfig,
            'connect-src': [
              ...medicalCSPConfig['connect-src'],
              'http://test-registration-check/', // Allow wadouri test URL
              'wadouri://', // Allow wadouri protocol testing
            ],
          };
        }
        
        // Content Security Policy - Medical Grade
        res.setHeader('Content-Security-Policy', generateCSPString(cspConfig));
        
        // Additional security headers for medical applications
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        
        // Cross-Origin policies for Web Workers
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        
        next();
      });
    },
  };
}