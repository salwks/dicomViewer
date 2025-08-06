/**
 * Security Validation Framework
 * Provides comprehensive input validation, XSS protection, and security validation
 * for medical applications with HIPAA compliance requirements
 */

import { log } from '../utils/logger';

export interface ValidationResult {
  isValid: boolean;
  sanitizedValue?: unknown;
  errors: string[];
  warnings: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityValidationConfig {
  enableXSSProtection: boolean;
  enableSQLInjectionProtection: boolean;
  enableCSRFProtection: boolean;
  maxInputLength: number;
  allowedFileTypes: string[];
  blockedPatterns: RegExp[];
  medicalDataProtection: boolean;
}

export interface MedicalDataValidation {
  patientId?: string;
  studyId?: string;
  seriesId?: string;
  organizationId?: string;
}

class SecurityValidator {
  private config: SecurityValidationConfig;

  // XSS patterns to detect and block (ReDoS-safe)
  private xssPatterns = [
    /<script[\s\S]{0,1000}?<\/script>/gi, // Limited length to prevent ReDoS
    /<iframe[\s\S]{0,1000}?<\/iframe>/gi,
    /<object[\s\S]{0,1000}?<\/object>/gi,
    /<embed[^>]{0,1000}>/gi,
    /<form[\s\S]{0,1000}?<\/form>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /data:text\/html/gi,
    /on\w{1,20}\s*=/gi, // Limited word length
    /<[^>]{0,1000}style\s*=[^>]{0,1000}expression\s*\(/gi, // Limited length
  ];

  // SQL injection detection using simple string checks (ReDoS-safe)
  private sqlKeywords = [
    'union', 'select', 'insert', 'update', 'delete', 'drop',
    'create', 'alter', 'exec', 'execute',
  ];

  private sqlSpecialChars = [
    "'", '"', ';', '|', '*', '%', '<', '>', '{', '}',
    '[', ']', '&', '?', '$', '(', ')', '`',
  ];

  // Medical data validation helpers (ReDoS-safe)
  private validatePatientId(input: string): boolean {
    return input.length >= 6 && input.length <= 20 && /^[A-Z0-9]+$/.test(input);
  }

  private validateDicomUID(input: string): boolean {
    // DICOM UID format: numbers separated by dots, limited length
    if (input.length > 64) return false; // DICOM UID max length
    const parts = input.split('.');
    if (parts.length < 3) return false;
    return parts.every(part => /^\d{1,10}$/.test(part));
  }

  private validateOrganizationId(input: string): boolean {
    return input.length >= 2 && input.length <= 10 && /^[A-Z0-9]+$/.test(input);
  }

  // Dangerous file extensions
  private dangerousExtensions = [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
    '.php', '.asp', '.aspx', '.jsp', '.sh', '.pl', '.py', '.rb',
  ];

  constructor(config?: Partial<SecurityValidationConfig>) {
    this.config = {
      enableXSSProtection: true,
      enableSQLInjectionProtection: true,
      enableCSRFProtection: true,
      maxInputLength: 10000,
      allowedFileTypes: ['.dcm', '.jpg', '.jpeg', '.png', '.pdf', '.txt', '.json'],
      blockedPatterns: [],
      medicalDataProtection: true,
      ...config,
    };

    log.security('Security validator initialized', {
      component: 'SecurityValidator',
      metadata: {
        xssProtection: this.config.enableXSSProtection,
        sqlProtection: this.config.enableSQLInjectionProtection,
        csrfProtection: this.config.enableCSRFProtection,
        medicalProtection: this.config.medicalDataProtection,
      },
    });
  }

  /**
   * Validate and sanitize input data
   */
  validateInput(input: unknown, fieldName: string, expectedType?: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      sanitizedValue: input,
      errors: [],
      warnings: [],
      riskLevel: 'low',
    };

    try {
      // Null/undefined check
      if (input === null || input === undefined) {
        if (expectedType && expectedType !== 'undefined') {
          result.errors.push(`${fieldName} cannot be null or undefined`);
          result.isValid = false;
          result.riskLevel = 'medium';
        }
        return result;
      }

      // Type validation
      if (expectedType && typeof input !== expectedType) {
        result.errors.push(`${fieldName} must be of type ${expectedType}, got ${typeof input}`);
        result.isValid = false;
        result.riskLevel = 'medium';
      }

      // String-specific validations
      if (typeof input === 'string') {
        result.sanitizedValue = this.validateString(input, fieldName, result);
      }

      // Number-specific validations
      if (typeof input === 'number') {
        this.validateNumber(input, fieldName, result);
      }

      // Object-specific validations
      if (typeof input === 'object' && input !== null) {
        result.sanitizedValue = this.validateObject(input, fieldName, result);
      }

      // Array-specific validations
      if (Array.isArray(input)) {
        result.sanitizedValue = this.validateArray(input, fieldName, result);
      }

      return result;
    } catch (error) {
      log.error('Input validation failed', {
        component: 'SecurityValidator',
        metadata: { fieldName, inputType: typeof input },
      }, error as Error);

      result.errors.push('Validation process failed');
      result.isValid = false;
      result.riskLevel = 'critical';
      return result;
    }
  }

  /**
   * Validate medical data with HIPAA compliance
   */
  validateMedicalData(data: MedicalDataValidation): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      sanitizedValue: { ...data },
      errors: [],
      warnings: [],
      riskLevel: 'low',
    };

    if (!this.config.medicalDataProtection) {
      return result;
    }

    try {
      // Validate Patient ID
      if (data.patientId) {
        if (!this.validatePatientId(data.patientId)) {
          result.errors.push('Invalid Patient ID format');
          result.isValid = false;
          result.riskLevel = 'high';
        }
      }

      // Validate Study ID (DICOM UID format)
      if (data.studyId) {
        if (!this.validateDicomUID(data.studyId)) {
          result.errors.push('Invalid Study ID format (must be valid DICOM UID)');
          result.isValid = false;
          result.riskLevel = 'high';
        }
      }

      // Validate Series ID (DICOM UID format)
      if (data.seriesId) {
        if (!this.validateDicomUID(data.seriesId)) {
          result.errors.push('Invalid Series ID format (must be valid DICOM UID)');
          result.isValid = false;
          result.riskLevel = 'high';
        }
      }

      // Validate Organization ID
      if (data.organizationId) {
        if (!this.validateOrganizationId(data.organizationId)) {
          result.errors.push('Invalid Organization ID format');
          result.isValid = false;
          result.riskLevel = 'medium';
        }
      }

      return result;
    } catch (error) {
      log.error('Medical data validation failed', {
        component: 'SecurityValidator',
      }, error as Error);

      result.errors.push('Medical data validation failed');
      result.isValid = false;
      result.riskLevel = 'critical';
      return result;
    }
  }

  /**
   * Validate file uploads with security checks
   */
  validateFileUpload(file: File): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      sanitizedValue: file,
      errors: [],
      warnings: [],
      riskLevel: 'low',
    };

    try {
      // Check file extension
      const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;

      if (this.dangerousExtensions.includes(extension)) {
        result.errors.push(`Dangerous file type: ${extension}`);
        result.isValid = false;
        result.riskLevel = 'critical';
      }

      if (!this.config.allowedFileTypes.includes(extension)) {
        result.errors.push(`File type not allowed: ${extension}`);
        result.isValid = false;
        result.riskLevel = 'high';
      }

      // Check file size (max 100MB for medical images)
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxSize) {
        result.errors.push('File size exceeds maximum allowed (100MB)');
        result.isValid = false;
        result.riskLevel = 'medium';
      }

      // Check filename for suspicious patterns
      if (this.containsSuspiciousPatterns(file.name)) {
        result.errors.push('Filename contains suspicious patterns');
        result.isValid = false;
        result.riskLevel = 'high';
      }

      return result;
    } catch (error) {
      log.error('File validation failed', {
        component: 'SecurityValidator',
        metadata: { fileName: file.name, fileSize: file.size },
      }, error as Error);

      result.errors.push('File validation failed');
      result.isValid = false;
      result.riskLevel = 'critical';
      return result;
    }
  }

  /**
   * Generate secure CSRF token
   */
  generateCSRFToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate CSRF token
   */
  validateCSRFToken(token: string, expectedToken: string): boolean {
    if (!this.config.enableCSRFProtection) {
      return true;
    }

    // Constant-time comparison to prevent timing attacks
    if (token.length !== expectedToken.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < token.length; i++) {
      result |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Sanitize HTML content to prevent XSS
   */
  sanitizeHTML(html: string): string {
    if (!this.config.enableXSSProtection) {
      return html;
    }

    // Remove dangerous tags and attributes
    let sanitized = html;

    // Remove script tags and content (ReDoS-safe)
    sanitized = sanitized.replace(/<script[\s\S]{0,1000}?<\/script>/gi, '');

    // Remove dangerous tags
    sanitized = sanitized.replace(/<(iframe|object|embed|form|meta|link|style)[^>]*>/gi, '');

    // Remove event handlers
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^>\s]+/gi, '');

    // Remove javascript: and vbscript: protocols
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/vbscript:/gi, '');

    // Remove data URLs
    sanitized = sanitized.replace(/data:text\/html/gi, '');

    return sanitized;
  }

  // Private helper methods

  private validateString(input: string, fieldName: string, result: ValidationResult): string {
    let sanitized = input;

    // Length check
    if (input.length > this.config.maxInputLength) {
      result.errors.push(`${fieldName} exceeds maximum length (${this.config.maxInputLength})`);
      result.isValid = false;
      result.riskLevel = 'medium';
      sanitized = input.substring(0, this.config.maxInputLength);
    }

    // XSS protection
    if (this.config.enableXSSProtection && this.containsXSS(input)) {
      result.warnings.push(`${fieldName} contains potential XSS patterns`);
      result.riskLevel = 'high';
      sanitized = this.sanitizeHTML(sanitized);
    }

    // SQL injection protection
    if (this.config.enableSQLInjectionProtection && this.containsSQLInjection(input)) {
      result.errors.push(`${fieldName} contains potential SQL injection patterns`);
      result.isValid = false;
      result.riskLevel = 'critical';
    }

    // Custom blocked patterns
    if (this.containsBlockedPatterns(input)) {
      result.errors.push(`${fieldName} contains blocked patterns`);
      result.isValid = false;
      result.riskLevel = 'high';
    }

    return sanitized;
  }

  private validateNumber(input: number, fieldName: string, result: ValidationResult): void {
    // Check for NaN
    if (isNaN(input)) {
      result.errors.push(`${fieldName} is not a valid number`);
      result.isValid = false;
      result.riskLevel = 'medium';
    }

    // Check for infinity
    if (!isFinite(input)) {
      result.errors.push(`${fieldName} must be a finite number`);
      result.isValid = false;
      result.riskLevel = 'medium';
    }

    // Range validation for medical data
    if (fieldName.includes('pixel') || fieldName.includes('dimension')) {
      if (input < 0 || input > 65535) {
        result.warnings.push(`${fieldName} value (${input}) is outside typical medical imaging range`);
        result.riskLevel = 'low';
      }
    }
  }

  private validateObject(input: object, fieldName: string, result: ValidationResult): object {
    let sanitized = { ...input };

    // Check for prototype pollution
    if (Object.prototype.hasOwnProperty.call(input, '__proto__') ||
        Object.prototype.hasOwnProperty.call(input, 'constructor') ||
        Object.prototype.hasOwnProperty.call(input, 'prototype')) {
      result.errors.push(`${fieldName} contains dangerous object properties`);
      result.isValid = false;
      result.riskLevel = 'critical';

      // Remove dangerous properties safely using allowlist approach
      const safeKeys = Object.keys(sanitized).filter(key =>
        key !== '__proto__' && key !== 'constructor' && key !== 'prototype',
      );
      const safeSanitized: Record<string, unknown> = {};
      for (const key of safeKeys) {
        if (Object.prototype.hasOwnProperty.call(sanitized, key) && typeof key === 'string') {
          const value = this.safeGetProperty(sanitized as Record<string, unknown>, key);
          if (value !== undefined) {
            this.safeSetProperty(safeSanitized, key, value);
          }
        }
      }
      sanitized = safeSanitized;
    }

    // Recursively validate object properties
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'string') {
        const stringResult = this.validateInput(value, `${fieldName}.${key}`, 'string');
        if (!stringResult.isValid) {
          result.errors.push(...stringResult.errors);
          result.warnings.push(...stringResult.warnings);
          result.isValid = false;
          if (stringResult.riskLevel === 'critical') {
            result.riskLevel = 'critical';
          }
        }
        // Update sanitized object safely
        const mutableSanitized = sanitized as Record<string, unknown>;
        if (Object.prototype.hasOwnProperty.call(mutableSanitized, key) && typeof key === 'string') {
          this.safeSetProperty(mutableSanitized, key, stringResult.sanitizedValue);
        }
      }
    }

    return sanitized;
  }

  private validateArray(input: unknown[], fieldName: string, result: ValidationResult): unknown[] {
    const sanitized = [...input];

    // Check array length
    if (input.length > 1000) {
      result.warnings.push(`${fieldName} array is very large (${input.length} items)`);
      result.riskLevel = 'medium';
    }

    // Validate each item
    for (let i = 0; i < sanitized.length; i++) {
      const itemResult = this.validateInput(this.safeGetArrayElement(sanitized, i), `${fieldName}[${i}]`);
      if (!itemResult.isValid) {
        result.errors.push(...itemResult.errors);
        result.warnings.push(...itemResult.warnings);
        result.isValid = false;
        if (itemResult.riskLevel === 'critical') {
          result.riskLevel = 'critical';
        }
      }
      if (i < sanitized.length) {
        this.safeSetArrayElement(sanitized, i, itemResult.sanitizedValue);
      }
    }

    return sanitized;
  }

  private containsXSS(input: string): boolean {
    return this.xssPatterns.some(pattern => pattern.test(input));
  }

  private containsSQLInjection(input: string): boolean {
    const lowerInput = input.toLowerCase();

    // Check for SQL keywords
    const hasKeywords = this.sqlKeywords.some(keyword => lowerInput.includes(keyword));

    // Check for special characters
    const hasSpecialChars = this.sqlSpecialChars.some(char => input.includes(char));

    return hasKeywords && hasSpecialChars;
  }

  private containsBlockedPatterns(input: string): boolean {
    return this.config.blockedPatterns.some(pattern => pattern.test(input));
  }

  private containsSuspiciousPatterns(input: string): boolean {
    const suspiciousPatterns = [
      /\.\./g, // Directory traversal
      /[<>:"\\|?*]/g, // Invalid filename characters
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, // Windows reserved names
    ];

    return suspiciousPatterns.some(pattern => {
      try {
        return pattern.test(input);
      } catch {
        return false;
      }
    });
  }

  /**
   * Safe property access without Object Injection
   */
  private safeGetProperty<T extends object, K extends keyof T>(obj: T, key: K): T[K] | undefined {
    if (typeof key !== 'string' && typeof key !== 'number' && typeof key !== 'symbol') {
      return undefined;
    }
    return Object.prototype.hasOwnProperty.call(obj, key) ? Object.getOwnPropertyDescriptor(obj, key as string)?.value as T[K] : undefined;
  }

  /**
   * Safe property setting without Object Injection
   */
  private safeSetProperty<T extends object>(obj: T, key: string, value: unknown): void {
    if (typeof key === 'string' && key.length > 0 && key.length < 100) {
      Object.defineProperty(obj as Record<string, unknown>, key, { value, writable: true, enumerable: true, configurable: true });
    }
  }

  /**
   * Safe array element access
   */
  private safeGetArrayElement<T>(arr: T[], index: number): T | undefined {
    if (typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < arr.length) {
      return Object.getOwnPropertyDescriptor(arr, index)?.value as T;
    }
    return undefined;
  }

  /**
   * Safe array element setting
   */
  private safeSetArrayElement<T>(arr: T[], index: number, value: T): void {
    if (typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < arr.length) {
      Object.defineProperty(arr, index, { value, writable: true, enumerable: true, configurable: true });
    }
  }
}

// Export singleton instance
export const securityValidator = new SecurityValidator();
export default securityValidator;
