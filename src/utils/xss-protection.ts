/**
 * XSS Protection Utilities
 * Provides sanitization functions to protect against XSS attacks
 */

import DOMPurify from 'dompurify';

/**
 * XSS Protection Configuration
 */
export interface XSSSanitizeConfig {
  allowedTags?: string[];
  allowedAttributes?: string[];
  forbiddenTags?: string[];
  forbiddenAttributes?: string[];
  allowDataAttributes?: boolean;
  keepContent?: boolean;
}

/**
 * Default configuration for medical imaging application
 */
const DEFAULT_CONFIG: DOMPurify.Config = {
  // Only allow safe text formatting
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br'],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true,
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  SANITIZE_DOM: true,
  SANITIZE_NAMED_PROPS: true,
  FORCE_BODY: false,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_TRUSTED_TYPE: false,
};

/**
 * Strict configuration for annotation labels and user input
 */
const STRICT_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true,
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  SANITIZE_DOM: true,
  SANITIZE_NAMED_PROPS: true,
  FORCE_BODY: false,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_TRUSTED_TYPE: false,
};

/**
 * XSS Protection Utility Class
 */
export class XSSProtection {
  /**
   * Sanitize user input with default configuration
   */
  static sanitize(input: string, config?: DOMPurify.Config): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    try {
      const sanitizedInput = DOMPurify.sanitize(input.trim(), {
        ...DEFAULT_CONFIG,
        ...config,
      });

      // Log sanitization for security monitoring
      if (input !== sanitizedInput) {
        console.warn('[XSS Protection] Input sanitized:', {
          original: input.substring(0, 100),
          sanitized: sanitizedInput.substring(0, 100),
          removed: input.length - sanitizedInput.length,
        });

        // Log security event if security store is available
        if (typeof window !== 'undefined' && (window as any).securityStore) {
          (window as any).securityStore.logSecurityEvent({
            type: 'ACCESS_DENIED',
            details: `XSS attempt detected and sanitized in user input`,
            severity: 'MEDIUM',
            metadata: {
              originalLength: input.length,
              sanitizedLength: sanitizedInput.length,
              inputPreview: input.substring(0, 50),
              sanitizedPreview: sanitizedInput.substring(0, 50),
            },
          });
        }
      }

      return sanitizedInput;
    } catch (error) {
      console.error('[XSS Protection] Sanitization failed:', error);
      
      // Log security error
      if (typeof window !== 'undefined' && (window as any).securityStore) {
        (window as any).securityStore.logSecurityEvent({
          type: 'ERROR',
          details: `XSS sanitization failed: ${error}`,
          severity: 'HIGH',
          metadata: {
            inputLength: input.length,
            error: error?.toString(),
          },
        });
      }
      
      // Return empty string as fallback for safety
      return '';
    }
  }

  /**
   * Sanitize annotation labels and similar user input with strict configuration
   */
  static sanitizeStrict(input: string): string {
    return this.sanitize(input, STRICT_CONFIG);
  }

  /**
   * Sanitize HTML content while preserving basic formatting
   */
  static sanitizeHTML(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return this.sanitize(input, {
      ...DEFAULT_CONFIG,
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p', 'span'],
      ALLOWED_ATTR: ['class'],
    });
  }

  /**
   * Sanitize file names and paths
   */
  static sanitizeFileName(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Remove any HTML/script content
    let sanitized = this.sanitizeStrict(input);
    
    // Remove path traversal attempts
    sanitized = sanitized.replace(/\.\./g, '');
    sanitized = sanitized.replace(/[<>:"|?*]/g, '');
    
    // Limit length
    if (sanitized.length > 255) {
      sanitized = sanitized.substring(0, 255);
    }
    
    return sanitized.trim();
  }

  /**
   * Sanitize URLs to prevent javascript: and data: protocols
   */
  static sanitizeURL(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    const sanitized = this.sanitizeStrict(input);
    
    // Check for dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
    const lowerInput = sanitized.toLowerCase();
    
    for (const protocol of dangerousProtocols) {
      if (lowerInput.startsWith(protocol)) {
        console.warn('[XSS Protection] Dangerous URL protocol detected:', protocol);
        return '';
      }
    }
    
    return sanitized;
  }

  /**
   * Sanitize JSON string values
   */
  static sanitizeJSON(jsonString: string): string {
    if (!jsonString || typeof jsonString !== 'string') {
      return '{}';
    }

    try {
      const parsed = JSON.parse(jsonString);
      const sanitized = this.deepSanitizeObject(parsed);
      return JSON.stringify(sanitized);
    } catch (error) {
      console.error('[XSS Protection] JSON sanitization failed:', error);
      return '{}';
    }
  }

  /**
   * Deep sanitize object properties
   */
  static deepSanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeStrict(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepSanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeStrict(key);
        sanitized[sanitizedKey] = this.deepSanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Validate that input doesn't contain suspicious patterns
   */
  static validateInput(input: string): { isValid: boolean; reason?: string } {
    if (!input || typeof input !== 'string') {
      return { isValid: true };
    }

    const suspiciousPatterns = [
      /<script[^>]*>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe[^>]*>/i,
      /<object[^>]*>/i,
      /<embed[^>]*>/i,
      /<link[^>]*>/i,
      /<meta[^>]*>/i,
      /expression\s*\(/i,
      /vbscript:/i,
      /data:text\/html/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(input)) {
        return {
          isValid: false,
          reason: `Suspicious pattern detected: ${pattern.source}`,
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Check if sanitization removed any content
   */
  static wasModified(original: string, sanitized: string): boolean {
    return original !== sanitized;
  }

  /**
   * Get sanitization statistics
   */
  static getSanitizationStats(original: string, sanitized: string) {
    return {
      originalLength: original.length,
      sanitizedLength: sanitized.length,
      bytesRemoved: original.length - sanitized.length,
      wasModified: this.wasModified(original, sanitized),
      reductionPercentage: ((original.length - sanitized.length) / original.length) * 100,
    };
  }
}

/**
 * Convenience functions for common use cases
 */

/**
 * Sanitize annotation label
 */
export const sanitizeAnnotationLabel = (label: string): string => {
  return XSSProtection.sanitizeStrict(label);
};

/**
 * Sanitize user comment or description
 */
export const sanitizeUserComment = (comment: string): string => {
  return XSSProtection.sanitize(comment);
};

/**
 * Sanitize file name
 */
export const sanitizeFileName = (fileName: string): string => {
  return XSSProtection.sanitizeFileName(fileName);
};

/**
 * Sanitize URL
 */
export const sanitizeURL = (url: string): string => {
  return XSSProtection.sanitizeURL(url);
};

/**
 * Batch sanitize multiple strings
 */
export const sanitizeBatch = (inputs: string[], strict = false): string[] => {
  return inputs.map((input) =>
    strict ? XSSProtection.sanitizeStrict(input) : XSSProtection.sanitize(input)
  );
};

// Export default instance
export default XSSProtection;