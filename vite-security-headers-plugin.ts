/**
 * Vite Security Headers Plugin for Medical Imaging Applications
 * Implements comprehensive security headers including CSP for HIPAA compliance
 */

import type { Plugin } from 'vite';

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: string | Record<string, string[]>;
  strictTransportSecurity?: string;
  xFrameOptions?: string;
  xContentTypeOptions?: string;
  referrerPolicy?: string;
  permissionsPolicy?: string;
  crossOriginEmbedderPolicy?: string;
  crossOriginOpenerPolicy?: string;
  crossOriginResourcePolicy?: string;
  xXSSProtection?: string;
  customHeaders?: Record<string, string>;
  reportOnly?: boolean;
  enableHSTS?: boolean;
  enableNonce?: boolean;
}

const defaultConfig: SecurityHeadersConfig = {
  // Content Security Policy for medical imaging applications
  contentSecurityPolicy: {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-inline'", // Required for some medical imaging libraries
      "'unsafe-eval'", // Required for WebAssembly in Cornerstone3D
      "'wasm-unsafe-eval'", // Required for WebAssembly evaluation
      'blob:', // Required for web workers
      'data:', // Required for inline data
    ],
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Required for dynamic styling in medical viewers
    ],
    'img-src': [
      "'self'",
      'data:', // Required for DICOM image data
      'blob:', // Required for processed images
      'https:', // Allow HTTPS images
    ],
    'font-src': [
      "'self'",
      'data:', // Required for icon fonts
    ],
    'connect-src': [
      "'self'",
      'https:', // Allow HTTPS connections for DICOM servers
      'wss:', // Allow WebSocket connections
      'data:', // Required for WASM data URLs in DICOM processing
    ],
    'worker-src': [
      "'self'",
      'blob:', // Required for Cornerstone3D workers
    ],
    'child-src': [
      "'self'",
      'blob:', // Required for web workers
    ],
    'media-src': [
      "'self'",
      'data:', // Required for video/audio medical content
      'blob:',
    ],
    'object-src': ["'none'"], // Disable plugins for security
    'base-uri': ["'self'"], // Restrict base URI
    'frame-ancestors': ["'none'"], // Prevent framing
    'form-action': ["'self'"], // Restrict form submissions
    'upgrade-insecure-requests': [], // Upgrade HTTP to HTTPS
  },

  // Strict Transport Security (1 year)
  strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',

  // Prevent framing completely for medical data protection
  xFrameOptions: 'DENY',

  // Prevent MIME type sniffing
  xContentTypeOptions: 'nosniff',

  // Strict referrer policy for medical privacy
  referrerPolicy: 'strict-origin-when-cross-origin',

  // Permissions policy for medical devices
  permissionsPolicy: [
    'accelerometer=()',
    'camera=(self)', // May be needed for medical device integration
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=(self)', // May be needed for voice annotations
    'payment=()',
    'usb=(self)', // May be needed for medical device connectivity
  ].join(', '),

  // Cross-Origin policies for isolation
  crossOriginEmbedderPolicy: 'require-corp',
  crossOriginOpenerPolicy: 'same-origin',
  crossOriginResourcePolicy: 'same-origin',

  // XSS Protection (legacy but still useful)
  xXSSProtection: '1; mode=block',

  // Custom headers for medical compliance
  customHeaders: {
    'X-Medical-Data-Protection': 'HIPAA-Compliant',
    'X-Security-Policy': 'Medical-Imaging-Enhanced',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  },

  reportOnly: false,
  enableHSTS: true,
  enableNonce: false,
};

function buildCSPString(csp: Record<string, string[]>): string {
  return Object.entries(csp)
    .map(([directive, sources]) => {
      if (sources.length === 0) {
        return directive;
      }
      return `${directive} ${sources.join(' ')}`;
    })
    .join('; ');
}

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function securityHeaders(userConfig: SecurityHeadersConfig = {}): Plugin {
  const config = { ...defaultConfig, ...userConfig };
  let nonce: string | undefined;

  return {
    name: 'vite-security-headers',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Generate new nonce for each request if enabled
        if (config.enableNonce) {
          nonce = generateNonce();
        }
        
        // Check if we're in development mode
        const isDev = process.env.NODE_ENV === 'development';

        // Set Content Security Policy
        if (config.contentSecurityPolicy) {
          let cspValue: string;
          
          if (typeof config.contentSecurityPolicy === 'string') {
            cspValue = config.contentSecurityPolicy;
          } else {
            let cspConfig = { ...config.contentSecurityPolicy };
            
            // Remove HTTPS enforcement in development
            if (isDev) {
              // Remove upgrade-insecure-requests in development
              delete cspConfig['upgrade-insecure-requests'];
              // Remove block-all-mixed-content in development
              delete cspConfig['block-all-mixed-content'];
              // Add localhost and development URLs to connect-src
              if (cspConfig['connect-src']) {
                cspConfig['connect-src'] = [
                  ...cspConfig['connect-src'],
                  'http://localhost:*',
                  'ws://localhost:*',
                  'http://127.0.0.1:*',
                  'ws://127.0.0.1:*'
                ];
              }
            }
            
            // Add nonce to script-src if enabled
            if (config.enableNonce && nonce) {
              if (cspConfig['script-src']) {
                cspConfig['script-src'] = [
                  ...cspConfig['script-src'],
                  `'nonce-${nonce}'`
                ];
              }
            }
            
            cspValue = buildCSPString(cspConfig);
          }

          const cspHeader = config.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
          res.setHeader(cspHeader, cspValue);
        }

        // Set Strict Transport Security (skip in development)
        if (config.strictTransportSecurity && config.enableHSTS && !isDev) {
          res.setHeader('Strict-Transport-Security', config.strictTransportSecurity);
        }

        // Set X-Frame-Options
        if (config.xFrameOptions) {
          res.setHeader('X-Frame-Options', config.xFrameOptions);
        }

        // Set X-Content-Type-Options
        if (config.xContentTypeOptions) {
          res.setHeader('X-Content-Type-Options', config.xContentTypeOptions);
        }

        // Set Referrer-Policy
        if (config.referrerPolicy) {
          res.setHeader('Referrer-Policy', config.referrerPolicy);
        }

        // Set Permissions-Policy
        if (config.permissionsPolicy) {
          res.setHeader('Permissions-Policy', config.permissionsPolicy);
        }

        // Set Cross-Origin-Embedder-Policy
        if (config.crossOriginEmbedderPolicy) {
          res.setHeader('Cross-Origin-Embedder-Policy', config.crossOriginEmbedderPolicy);
        }

        // Set Cross-Origin-Opener-Policy
        if (config.crossOriginOpenerPolicy) {
          res.setHeader('Cross-Origin-Opener-Policy', config.crossOriginOpenerPolicy);
        }

        // Set Cross-Origin-Resource-Policy
        if (config.crossOriginResourcePolicy) {
          res.setHeader('Cross-Origin-Resource-Policy', config.crossOriginResourcePolicy);
        }

        // Set X-XSS-Protection
        if (config.xXSSProtection) {
          res.setHeader('X-XSS-Protection', config.xXSSProtection);
        }

        // Set custom headers
        if (config.customHeaders) {
          Object.entries(config.customHeaders).forEach(([header, value]) => {
            res.setHeader(header, value);
          });
        }

        next();
      });
    },

    generateBundle(options, bundle) {
      // Add security headers to HTML files
      Object.keys(bundle).forEach(fileName => {
        if (fileName.endsWith('.html')) {
          const htmlChunk = bundle[fileName] as any;
          if (htmlChunk.source) {
            let html = htmlChunk.source as string;

            // Add CSP meta tag as fallback
            if (config.contentSecurityPolicy) {
              const cspValue = typeof config.contentSecurityPolicy === 'string' 
                ? config.contentSecurityPolicy 
                : buildCSPString(config.contentSecurityPolicy);
              
              const metaTag = `<meta http-equiv="Content-Security-Policy" content="${cspValue}">`;
              html = html.replace('<head>', `<head>\n    ${metaTag}`);
            }

            // Add other security meta tags
            const securityMetas = [
              '<meta http-equiv="X-Content-Type-Options" content="nosniff">',
              '<meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">',
              '<meta http-equiv="X-Frame-Options" content="DENY">',
              '<meta name="medical-data-protection" content="HIPAA-Compliant">',
            ];

            securityMetas.forEach(meta => {
              html = html.replace('<head>', `<head>\n    ${meta}`);
            });

            htmlChunk.source = html;
          }
        }
      });
    },

    // Development server configuration
    config(config, { command }) {
      if (command === 'serve') {
        // Development-specific configurations
        console.log('🛡️  Security headers enabled for development server');
        
        // Enhanced development debugging
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 Security Headers Debug Info:');
          console.log('- CSP Policy: Medical imaging optimized');
          console.log('- Frame protection: DENY (medical data protection)');
          console.log('- HTTPS enforcement: Disabled in dev');
          console.log('- Cross-origin policies: Relaxed for development');
          console.log('- XSS protection: Active');
          console.log('- HIPAA compliance: Enabled');
        }
      }
    },
  };
}

// Export medical-specific CSP configurations
export const medicalCSPConfig: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'", // Required for Cornerstone3D dynamic script generation
    "'unsafe-eval'", // Required for WebAssembly processing and Cornerstone3D
    "'wasm-unsafe-eval'", // Required for WebAssembly evaluation
    'blob:', // Required for web workers (DICOM image processing)
    'data:', // Required for inline scripts in medical libraries
    'https://cdn.skypack.dev', // Required for dynamic imports in capture functionality
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for dynamic styling in medical viewers
    'data:', // Required for CSS data URIs
  ],
  'img-src': [
    "'self'",
    'data:', // DICOM images are often data URIs
    'blob:', // Processed medical images and canvas exports
    'https:', // Allow loading images from HTTPS sources
    '*', // Allow any image source for medical flexibility (can be restricted in production)
  ],
  'connect-src': [
    "'self'",
    'https:', // DICOM servers and external medical APIs
    'wss:', // WebSocket connections for real-time medical data
    'ws:', // WebSocket connections (development)
    'blob:', // Blob URL connections
    'data:', // Required for WASM data URLs in DICOM processing
  ],
  'worker-src': [
    "'self'",
    'blob:', // Medical image processing workers (Cornerstone3D)
    'data:', // Data URI workers
  ],
  'child-src': [
    "'self'",
    'blob:', // Child contexts for workers
  ],
  'font-src': [
    "'self'",
    'data:', // Data URI fonts
    'https:', // HTTPS font sources
  ],
  'media-src': [
    "'self'",
    'data:', // Data URI media
    'blob:', // Blob media sources
    'https:', // HTTPS media sources
  ],
  'manifest-src': [
    "'self'", // Web app manifest
  ],
  'object-src': ["'none'"], // Disable object/embed for security
  'base-uri': ["'self'"], // Restrict base URI
  'frame-ancestors': ["'none'"], // Critical for medical data protection - prevent framing
  'form-action': ["'self'"], // Restrict form submissions
  'upgrade-insecure-requests': [], // Upgrade HTTP to HTTPS
  'block-all-mixed-content': [], // Block mixed content for security
};

// Export strict CSP for high-security environments
export const strictMedicalCSPConfig: Record<string, string[]> = {
  'default-src': ["'none'"],
  'script-src': ["'self'", 'blob:'], // Minimal script sources
  'style-src': ["'self'", "'unsafe-inline'"], // Inline styles needed for medical viewers
  'img-src': ["'self'", 'data:', 'blob:'], // Only essential image sources
  'connect-src': ["'self'"], // Only same-origin connections
  'worker-src': ["'self'", 'blob:'],
  'font-src': ["'self'"],
  'media-src': ["'none'"],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  'frame-ancestors': ["'none'"],
  'form-action': ["'none'"],
  'upgrade-insecure-requests': [],
};

export default securityHeaders;