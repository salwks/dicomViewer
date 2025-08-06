/**
 * Security Headers Configuration
 * Provides comprehensive security headers for medical applications
 * with HIPAA compliance and enhanced protection
 */

import { log } from '../utils/logger';

export interface SecurityHeadersConfig {
  enableCSP: boolean;
  enableHSTS: boolean;
  enableXFrameOptions: boolean;
  enableXSSProtection: boolean;
  enableContentTypeOptions: boolean;
  enableReferrerPolicy: boolean;
  enablePermissionsPolicy: boolean;
  medicalModeStrict: boolean;
}

export interface CSPDirectives {
  'default-src': string[];
  'script-src': string[];
  'style-src': string[];
  'img-src': string[];
  'connect-src': string[];
  'font-src': string[];
  'object-src': string[];
  'media-src': string[];
  'frame-src': string[];
  'worker-src': string[];
  'child-src': string[];
  'form-action': string[];
  'frame-ancestors': string[];
  'base-uri': string[];
  'upgrade-insecure-requests': boolean;
  'block-all-mixed-content': boolean;
}

class SecurityHeadersManager {
  private config: SecurityHeadersConfig;
  private cspDirectives: CSPDirectives;

  constructor(config?: Partial<SecurityHeadersConfig>) {
    this.config = {
      enableCSP: true,
      enableHSTS: true,
      enableXFrameOptions: true,
      enableXSSProtection: true,
      enableContentTypeOptions: true,
      enableReferrerPolicy: true,
      enablePermissionsPolicy: true,
      medicalModeStrict: true,
      ...config,
    };

    this.cspDirectives = this.initializeCSPDirectives();

    log.security('Security headers manager initialized', {
      component: 'SecurityHeadersManager',
      metadata: {
        cspEnabled: this.config.enableCSP,
        hstsEnabled: this.config.enableHSTS,
        medicalModeStrict: this.config.medicalModeStrict,
      },
    });
  }

  /**
   * Generate all security headers
   */
  generateSecurityHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    try {
      // Content Security Policy
      if (this.config.enableCSP) {
        headers['Content-Security-Policy'] = this.generateCSPHeader();
      }

      // HTTP Strict Transport Security
      if (this.config.enableHSTS) {
        headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
      }

      // X-Frame-Options
      if (this.config.enableXFrameOptions) {
        headers['X-Frame-Options'] = this.config.medicalModeStrict ? 'DENY' : 'SAMEORIGIN';
      }

      // X-XSS-Protection
      if (this.config.enableXSSProtection) {
        headers['X-XSS-Protection'] = '1; mode=block';
      }

      // X-Content-Type-Options
      if (this.config.enableContentTypeOptions) {
        headers['X-Content-Type-Options'] = 'nosniff';
      }

      // Referrer Policy
      if (this.config.enableReferrerPolicy) {
        headers['Referrer-Policy'] = this.config.medicalModeStrict
          ? 'no-referrer'
          : 'strict-origin-when-cross-origin';
      }

      // Permissions Policy
      if (this.config.enablePermissionsPolicy) {
        headers['Permissions-Policy'] = this.generatePermissionsPolicyHeader();
      }

      // Additional medical-specific headers
      if (this.config.medicalModeStrict) {
        headers['X-Permitted-Cross-Domain-Policies'] = 'none';
        headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
        headers['Cross-Origin-Opener-Policy'] = 'same-origin';
        headers['Cross-Origin-Resource-Policy'] = 'same-site';
      }

      // Cache control for medical data
      headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0';
      headers['Pragma'] = 'no-cache';
      headers['Expires'] = '0';

      log.security('Security headers generated', {
        component: 'SecurityHeadersManager',
        metadata: {
          headerCount: Object.keys(headers).length,
          medicalMode: this.config.medicalModeStrict,
        },
      });

      return headers;
    } catch (error) {
      log.error('Failed to generate security headers', {
        component: 'SecurityHeadersManager',
      }, error as Error);

      // Return minimal security headers on error
      return {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
      };
    }
  }

  /**
   * Apply security headers to HTML meta tags
   */
  generateSecurityMetaTags(): string {
    const headers = this.generateSecurityHeaders();
    const metaTags: string[] = [];

    // CSP meta tag
    if (headers['Content-Security-Policy']) {
      metaTags.push(
        `<meta http-equiv="Content-Security-Policy" content="${headers['Content-Security-Policy']}">`,
      );
    }

    // X-UA-Compatible for IE
    metaTags.push('<meta http-equiv="X-UA-Compatible" content="IE=edge">');

    // Viewport for responsive design
    metaTags.push('<meta name="viewport" content="width=device-width, initial-scale=1.0">');

    // Additional security meta tags
    metaTags.push('<meta name="referrer" content="no-referrer">');
    metaTags.push('<meta name="format-detection" content="telephone=no">');

    return metaTags.join('\n');
  }

  /**
   * Validate current security headers
   */
  validateSecurityHeaders(responseHeaders: Record<string, string>): {
    isSecure: boolean;
    missingHeaders: string[];
    recommendations: string[];
  } {
    const requiredHeaders = [
      'Content-Security-Policy',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection',
    ];

    const recommendedHeaders = [
      'Strict-Transport-Security',
      'Referrer-Policy',
      'Permissions-Policy',
    ];

    const missingHeaders: string[] = [];
    const recommendations: string[] = [];

    // Check required headers safely
    for (const header of requiredHeaders) {
      if (!this.safeHasHeader(responseHeaders, header)) {
        missingHeaders.push(header);
      }
    }

    // Check recommended headers safely
    for (const header of recommendedHeaders) {
      if (!this.safeHasHeader(responseHeaders, header)) {
        recommendations.push(`Consider adding ${header} header`);
      }
    }

    // Validate CSP if present
    if (responseHeaders['Content-Security-Policy']) {
      const cspIssues = this.validateCSP(responseHeaders['Content-Security-Policy']);
      recommendations.push(...cspIssues);
    }

    const isSecure = missingHeaders.length === 0;

    log.security('Security headers validation completed', {
      component: 'SecurityHeadersManager',
      metadata: {
        isSecure,
        missingCount: missingHeaders.length,
        recommendationCount: recommendations.length,
      },
    });

    return {
      isSecure,
      missingHeaders,
      recommendations,
    };
  }

  /**
   * Update CSP directives
   */
  updateCSPDirective(directive: keyof CSPDirectives, values: string[] | boolean): void {
    try {
      // Safe CSP directive update
      const allowedBooleanDirectives = ['upgrade-insecure-requests', 'block-all-mixed-content'] as const;

      if (typeof values === 'boolean' && allowedBooleanDirectives.includes(directive as any)) {
        this.safeSetDirective(directive, values);
      } else if (Array.isArray(values) && !allowedBooleanDirectives.includes(directive as any)) {
        this.safeSetDirective(directive, values);
      }

      log.security('CSP directive updated', {
        component: 'SecurityHeadersManager',
        metadata: { directive, valueCount: Array.isArray(values) ? values.length : 1 },
      });
    } catch (error) {
      log.error('Failed to update CSP directive', {
        component: 'SecurityHeadersManager',
        metadata: { directive },
      }, error as Error);
    }
  }

  // Private helper methods

  private initializeCSPDirectives(): CSPDirectives {
    const baseDirectives: CSPDirectives = {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        "'unsafe-inline'", // Required for React development
        "'unsafe-eval'", // Required for development tools
        'blob:', // Required for Web Workers
      ],
      'style-src': [
        "'self'",
        "'unsafe-inline'", // Required for styled-components and CSS-in-JS
        'https://fonts.googleapis.com',
      ],
      'img-src': [
        "'self'",
        'data:', // Required for base64 images and DICOM
        'blob:', // Required for generated images
        'https:', // Required for external medical imaging services
      ],
      'connect-src': [
        "'self'",
        'https:', // Required for API calls
        'wss:', // Required for WebSocket connections
        'blob:', // Required for Web Workers
      ],
      'font-src': [
        "'self'",
        'https://fonts.gstatic.com',
        'data:', // Required for embedded fonts
      ],
      'object-src': ["'none'"],
      'media-src': [
        "'self'",
        'blob:', // Required for medical imaging
        'data:',
      ],
      'frame-src': this.config.medicalModeStrict ? ["'none'"] : ["'self'"],
      'worker-src': [
        "'self'",
        'blob:', // Required for Web Workers
      ],
      'child-src': [
        "'self'",
        'blob:',
      ],
      'form-action': ["'self'"],
      'frame-ancestors': this.config.medicalModeStrict ? ["'none'"] : ["'self'"],
      'base-uri': ["'self'"],
      'upgrade-insecure-requests': true,
      'block-all-mixed-content': this.config.medicalModeStrict,
    };

    // Stricter CSP for medical mode
    if (this.config.medicalModeStrict) {
      baseDirectives['script-src'] = ["'self'", 'blob:'];
      baseDirectives['connect-src'] = ["'self'", 'blob:'];
      baseDirectives['img-src'] = ["'self'", 'data:', 'blob:'];
    }

    return baseDirectives;
  }

  private generateCSPHeader(): string {
    const directives: string[] = [];

    // Add source directives safely with Map-based approach
    const allowedDirectives = new Map<string, boolean>([
      ['default-src', true],
      ['script-src', true],
      ['style-src', true],
      ['img-src', true],
      ['connect-src', true],
      ['font-src', true],
      ['object-src', true],
      ['media-src', true],
      ['frame-src', true],
      ['worker-src', true],
      ['child-src', true],
      ['form-action', true],
      ['frame-ancestors', true],
      ['base-uri', true],
      ['upgrade-insecure-requests', true],
      ['block-all-mixed-content', true],
    ]);

    const booleanDirectives = new Set(['upgrade-insecure-requests', 'block-all-mixed-content']);

    for (const [directive] of allowedDirectives) {
      if (Object.prototype.hasOwnProperty.call(this.cspDirectives, directive)) {
        const values = this.safeGetDirectiveValue(directive);

        if (booleanDirectives.has(directive)) {
          if (values === true) {
            directives.push(directive.replace(/([A-Z])/g, '-$1').toLowerCase());
          }
        } else if (Array.isArray(values) && values.length > 0) {
          directives.push(`${directive} ${values.join(' ')}`);
        }
      }
    }

    return directives.join('; ');
  }

  /**
   * Safely get CSP directive value without object injection
   */
  private safeGetDirectiveValue(directive: string): unknown {
    const knownDirectives = new Set([
      'default-src', 'script-src', 'style-src', 'img-src', 'connect-src',
      'font-src', 'object-src', 'media-src', 'frame-src', 'worker-src',
      'child-src', 'form-action', 'frame-ancestors', 'base-uri',
      'upgrade-insecure-requests', 'block-all-mixed-content',
    ]);

    if (!knownDirectives.has(directive)) {
      return undefined;
    }

    return Object.prototype.hasOwnProperty.call(this.cspDirectives, directive)
      ? this.safeGetCSPDirectiveProperty(directive)
      : undefined;
  }

  /**
   * Safe header existence check
   */
  private safeHasHeader(headers: Record<string, string>, header: string): boolean {
    const allowedHeaders = new Set(['Content-Security-Policy', 'X-Content-Type-Options', 'X-Frame-Options', 'X-XSS-Protection', 'Strict-Transport-Security', 'Referrer-Policy', 'Permissions-Policy']);
    return typeof header === 'string' &&
           allowedHeaders.has(header) &&
           Object.prototype.hasOwnProperty.call(headers, header) &&
           Boolean(Object.getOwnPropertyDescriptor(headers, header)?.value);
  }

  /**
   * Safe CSP directive setting
   */
  private safeSetDirective(directive: string, value: string[] | boolean): void {
    const knownDirectives = new Set([
      'default-src', 'script-src', 'style-src', 'img-src', 'connect-src',
      'font-src', 'object-src', 'media-src', 'frame-src', 'worker-src',
      'child-src', 'form-action', 'frame-ancestors', 'base-uri',
      'upgrade-insecure-requests', 'block-all-mixed-content',
    ]);

    if (typeof directive === 'string' && knownDirectives.has(directive)) {
      Object.defineProperty(this.cspDirectives as unknown as Record<string, unknown>, directive, { value, writable: true, enumerable: true, configurable: true });
    }
  }

  /**
   * Safe CSP directive property access
   */
  private safeGetCSPDirectiveProperty(directive: string): unknown {
    const knownDirectives = new Set([
      'default-src', 'script-src', 'style-src', 'img-src', 'connect-src',
      'font-src', 'object-src', 'media-src', 'frame-src', 'worker-src',
      'child-src', 'form-action', 'frame-ancestors', 'base-uri',
      'upgrade-insecure-requests', 'block-all-mixed-content',
    ]);

    if (typeof directive === 'string' && knownDirectives.has(directive)) {
      return Object.getOwnPropertyDescriptor(this.cspDirectives as unknown as Record<string, unknown>, directive)?.value;
    }
    return undefined;
  }

  private generatePermissionsPolicyHeader(): string {
    const permissions = [
      'accelerometer=()',
      'autoplay=()',
      'camera=()',
      'cross-origin-isolated=()',
      'display-capture=()',
      'encrypted-media=()',
      'fullscreen=(self)',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'payment=()',
      'picture-in-picture=()',
      'publickey-credentials-get=()',
      'screen-wake-lock=()',
      'sync-xhr=()',
      'usb=()',
      'web-share=()',
      'xr-spatial-tracking=()',
    ];

    // More restrictive for medical mode
    if (this.config.medicalModeStrict) {
      return permissions.map(p => p.replace('=(self)', '=()')).join(', ');
    }

    return permissions.join(', ');
  }

  private validateCSP(cspHeader: string): string[] {
    const issues: string[] = [];

    // Check for unsafe directives
    if (cspHeader.includes("'unsafe-eval'")) {
      issues.push("CSP contains 'unsafe-eval' which may pose security risks");
    }

    if (cspHeader.includes("'unsafe-inline'")) {
      issues.push("CSP contains 'unsafe-inline' which may pose security risks");
    }

    // Check for missing directives
    const requiredDirectives = ['default-src', 'script-src', 'object-src'];
    for (const directive of requiredDirectives) {
      if (!cspHeader.includes(directive)) {
        issues.push(`CSP missing required directive: ${directive}`);
      }
    }

    // Check for overly permissive directives
    if (cspHeader.includes('*')) {
      issues.push('CSP contains wildcard (*) sources which may be too permissive');
    }

    return issues;
  }
}

// Export singleton instance
export const securityHeaders = new SecurityHeadersManager();
export default securityHeaders;
