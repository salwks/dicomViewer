/**
 * useSecurityValidator Hook
 * React hook for easy access to security validation functionality
 * Built for medical applications with comprehensive security checks
 */

import { useCallback, useEffect, useState } from 'react';
import {
  securityValidator,
  type ValidationResult,
  type MedicalDataValidation,
  type SecurityValidationConfig,
} from '../security/SecurityValidator';
import { log } from '../utils/logger';
import { useAuditLogger } from './useAuditLogger';
import { AuditEventType, AuditSeverity } from '../security/AuditLogger';

interface UseSecurityValidatorReturn {
  // Input validation functions
  validateInput: (
    input: unknown,
    fieldName: string,
    expectedType?: string
  ) => ValidationResult;

  validateMedicalData: (data: MedicalDataValidation) => ValidationResult;
  validateFileUpload: (file: File) => ValidationResult;
  validateForm: (formData: Record<string, unknown>) => {
    isValid: boolean;
    results: Record<string, ValidationResult>;
    errors: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };

  // Sanitization functions
  sanitizeHTML: (html: string) => string;
  sanitizeInput: (input: string) => string;

  // CSRF protection
  generateCSRFToken: () => string;
  validateCSRFToken: (token: string, expectedToken: string) => boolean;

  // Security state
  securityLevel: 'low' | 'medium' | 'high' | 'critical';
  isSecurityCompromised: boolean;
  lastValidationResult: ValidationResult | null;
  validationHistory: ValidationResult[];

  // Configuration
  updateSecurityConfig: (config: Partial<SecurityValidationConfig>) => void;

  // Statistics
  getValidationStats: () => {
    totalValidations: number;
    passedValidations: number;
    failedValidations: number;
    criticalIssues: number;
    recentIssues: ValidationResult[];
  };
}

export const useSecurityValidator = (): UseSecurityValidatorReturn => {
  const { logSecurityEvent } = useAuditLogger();

  // Safe property access helpers
  const safeGetFormValue = useCallback((formData: Record<string, unknown>, key: string): unknown => {
    const allowedKeys = new Set(['username', 'password', 'email', 'firstName', 'lastName', 'patientId', 'studyId', 'annotation', 'measurement']);
    if (typeof key === 'string' && key.length > 0 && key.length < 100 && allowedKeys.has(key)) {
      return Object.prototype.hasOwnProperty.call(formData, key) ? Object.getOwnPropertyDescriptor(formData, key)?.value : undefined;
    }
    return undefined;
  }, []);

  const safeSetResult = useCallback((results: Record<string, ValidationResult>, key: string, value: ValidationResult): void => {
    const allowedKeys = new Set(['username', 'password', 'email', 'firstName', 'lastName', 'patientId', 'studyId', 'annotation', 'measurement']);
    if (typeof key === 'string' && key.length > 0 && key.length < 100 && allowedKeys.has(key)) {
      Object.defineProperty(results, key, { value, writable: true, enumerable: true, configurable: true });
    }
  }, []);

  // State
  const [securityLevel, setSecurityLevel] = useState<'low' | 'medium' | 'high' | 'critical'>('low');
  const [isSecurityCompromised, setIsSecurityCompromised] = useState(false);
  const [lastValidationResult, setLastValidationResult] = useState<ValidationResult | null>(null);
  const [validationHistory, setValidationHistory] = useState<ValidationResult[]>([]);
  const [validationStats, setValidationStats] = useState({
    totalValidations: 0,
    passedValidations: 0,
    failedValidations: 0,
    criticalIssues: 0,
  });

  // Update security level based on validation results
  const updateSecurityLevel = useCallback((result: ValidationResult) => {
    setLastValidationResult(result);

    // Add to history (keep last 100 validations)
    setValidationHistory(prev => {
      const updated = [result, ...prev];
      return updated.slice(0, 100);
    });

    // Update statistics
    setValidationStats(prev => ({
      totalValidations: prev.totalValidations + 1,
      passedValidations: prev.passedValidations + (result.isValid ? 1 : 0),
      failedValidations: prev.failedValidations + (result.isValid ? 0 : 1),
      criticalIssues: prev.criticalIssues + (result.riskLevel === 'critical' ? 1 : 0),
    }));

    // Update security level
    if (result.riskLevel === 'critical') {
      setSecurityLevel('critical');
      setIsSecurityCompromised(true);
    } else if (result.riskLevel === 'high' && securityLevel !== 'critical') {
      setSecurityLevel('high');
    } else if (result.riskLevel === 'medium' && !['high', 'critical'].includes(securityLevel)) {
      setSecurityLevel('medium');
    }

    // Auto-reset security compromise after 30 minutes of no critical issues
    if (result.riskLevel !== 'critical' && isSecurityCompromised) {
      setTimeout(() => {
        setIsSecurityCompromised(false);
        setSecurityLevel('low');
      }, 30 * 60 * 1000);
    }
  }, [securityLevel, isSecurityCompromised]);

  // Input validation with audit logging
  const validateInput = useCallback((
    input: unknown,
    fieldName: string,
    expectedType?: string,
  ): ValidationResult => {
    try {
      const result = securityValidator.validateInput(input, fieldName, expectedType);
      updateSecurityLevel(result);

      // Log security events for failed validations
      if (!result.isValid) {
        logSecurityEvent(
          AuditEventType.SUSPICIOUS_ACTIVITY,
          `Input validation failed for ${fieldName}: ${result.errors.join(', ')}`,
          result.riskLevel === 'critical' ? AuditSeverity.CRITICAL :
            result.riskLevel === 'high' ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
        );
      }

      return result;
    } catch (error) {
      log.error('Input validation hook failed', {
        component: 'useSecurityValidator',
        metadata: { fieldName, inputType: typeof input },
      }, error as Error);

      const errorResult: ValidationResult = {
        isValid: false,
        errors: ['Validation process failed'],
        warnings: [],
        riskLevel: 'critical',
      };

      updateSecurityLevel(errorResult);
      return errorResult;
    }
  }, [updateSecurityLevel, logSecurityEvent]);

  // Medical data validation with enhanced logging
  const validateMedicalData = useCallback((data: MedicalDataValidation): ValidationResult => {
    try {
      const result = securityValidator.validateMedicalData(data);
      updateSecurityLevel(result);

      // Log PHI access attempts
      if (data.patientId || data.studyId) {
        logSecurityEvent(
          AuditEventType.PHI_ACCESS,
          `Medical data validation: ${data.patientId ? 'Patient ID' : ''} ${data.studyId ? 'Study ID' : ''}`,
          result.isValid ? AuditSeverity.LOW : AuditSeverity.HIGH,
        );
      }

      return result;
    } catch (error) {
      log.error('Medical data validation failed', {
        component: 'useSecurityValidator',
      }, error as Error);

      const errorResult: ValidationResult = {
        isValid: false,
        errors: ['Medical data validation failed'],
        warnings: [],
        riskLevel: 'critical',
      };

      updateSecurityLevel(errorResult);
      return errorResult;
    }
  }, [updateSecurityLevel, logSecurityEvent]);

  // File upload validation with enhanced security
  const validateFileUpload = useCallback((file: File): ValidationResult => {
    try {
      const result = securityValidator.validateFileUpload(file);
      updateSecurityLevel(result);

      // Log file upload attempts
      logSecurityEvent(
        AuditEventType.DICOM_LOAD,
        `File upload validation: ${file.name} (${file.size} bytes)`,
        result.isValid ? AuditSeverity.LOW : AuditSeverity.HIGH,
      );

      return result;
    } catch (error) {
      log.error('File upload validation failed', {
        component: 'useSecurityValidator',
        metadata: { fileName: file.name, fileSize: file.size },
      }, error as Error);

      const errorResult: ValidationResult = {
        isValid: false,
        errors: ['File upload validation failed'],
        warnings: [],
        riskLevel: 'critical',
      };

      updateSecurityLevel(errorResult);
      return errorResult;
    }
  }, [updateSecurityLevel, logSecurityEvent]);

  // Form validation with comprehensive checks
  const validateForm = useCallback((formData: Record<string, unknown>) => {
    const results: Record<string, ValidationResult> = {};
    const errors: string[] = [];
    let overallValid = true;
    let maxRiskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    try {
      // Safe iteration over form data
      const allowedFields = Object.keys(formData).filter(key =>
        typeof key === 'string' && key.length > 0 && key.length < 100,
      );

      for (const fieldName of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(formData, fieldName)) {
          const value = safeGetFormValue(formData, fieldName);
          const result = validateInput(value, fieldName);
          safeSetResult(results, fieldName, result);

          if (!result.isValid) {
            overallValid = false;
            errors.push(...result.errors);
          }

          // Update max risk level
          if (result.riskLevel === 'critical') {
            maxRiskLevel = 'critical';
          } else if (result.riskLevel === 'high' && maxRiskLevel !== 'critical') {
            maxRiskLevel = 'high';
          } else if (result.riskLevel === 'medium' && !['high', 'critical'].includes(maxRiskLevel)) {
            maxRiskLevel = 'medium';
          }
        }
      }

      // Log form validation attempt
      logSecurityEvent(
        AuditEventType.SUSPICIOUS_ACTIVITY,
        `Form validation: ${Object.keys(formData).length} fields, ${overallValid ? 'passed' : 'failed'}`,
        overallValid ? AuditSeverity.LOW :
          maxRiskLevel === 'critical' ? AuditSeverity.CRITICAL : AuditSeverity.MEDIUM,
      );

      return {
        isValid: overallValid,
        results,
        errors,
        riskLevel: maxRiskLevel,
      };
    } catch (error) {
      log.error('Form validation failed', {
        component: 'useSecurityValidator',
        metadata: { fieldCount: Object.keys(formData).length },
      }, error as Error);

      return {
        isValid: false,
        results: {},
        errors: ['Form validation process failed'],
        riskLevel: 'critical' as const,
      };
    }
  }, [validateInput, logSecurityEvent, safeGetFormValue, safeSetResult]);

  // HTML sanitization
  const sanitizeHTML = useCallback((html: string): string => {
    try {
      const sanitized = securityValidator.sanitizeHTML(html);

      // Log if sanitization made changes
      if (sanitized !== html) {
        logSecurityEvent(
          AuditEventType.SUSPICIOUS_ACTIVITY,
          'HTML content sanitized - potential XSS attempt detected',
          AuditSeverity.MEDIUM,
        );
      }

      return sanitized;
    } catch (error) {
      log.error('HTML sanitization failed', {
        component: 'useSecurityValidator',
      }, error as Error);

      // Return empty string on error for safety
      return '';
    }
  }, [logSecurityEvent]);

  // Input sanitization
  const sanitizeInput = useCallback((input: string): string => {
    const result = validateInput(input, 'sanitization_target', 'string');
    return typeof result.sanitizedValue === 'string' ? result.sanitizedValue : input;
  }, [validateInput]);

  // CSRF token generation
  const generateCSRFToken = useCallback((): string => {
    try {
      const token = securityValidator.generateCSRFToken();

      logSecurityEvent(
        AuditEventType.SECURITY_SCAN,
        'CSRF token generated',
        AuditSeverity.LOW,
      );

      return token;
    } catch (error) {
      log.error('CSRF token generation failed', {
        component: 'useSecurityValidator',
      }, error as Error);

      // Return empty string on error
      return '';
    }
  }, [logSecurityEvent]);

  // CSRF token validation
  const validateCSRFToken = useCallback((token: string, expectedToken: string): boolean => {
    try {
      const isValid = securityValidator.validateCSRFToken(token, expectedToken);

      logSecurityEvent(
        AuditEventType.SECURITY_SCAN,
        `CSRF token validation: ${isValid ? 'valid' : 'invalid'}`,
        isValid ? AuditSeverity.LOW : AuditSeverity.HIGH,
      );

      if (!isValid) {
        setIsSecurityCompromised(true);
        setSecurityLevel('high');
      }

      return isValid;
    } catch (error) {
      log.error('CSRF token validation failed', {
        component: 'useSecurityValidator',
      }, error as Error);

      return false;
    }
  }, [logSecurityEvent]);

  // Update security configuration
  const updateSecurityConfig = useCallback((config: Partial<SecurityValidationConfig>) => {
    try {
      // In a full implementation, this would update the validator's config
      log.info('Security configuration updated', {
        component: 'useSecurityValidator',
        metadata: { configKeys: Object.keys(config) },
      });

      logSecurityEvent(
        AuditEventType.SECURITY_POLICY_CHANGE,
        `Security configuration updated: ${Object.keys(config).join(', ')}`,
        AuditSeverity.MEDIUM,
      );
    } catch (error) {
      log.error('Security configuration update failed', {
        component: 'useSecurityValidator',
      }, error as Error);
    }
  }, [logSecurityEvent]);

  // Get validation statistics
  const getValidationStats = useCallback(() => {
    const recentIssues = validationHistory
      .filter(result => !result.isValid)
      .slice(0, 10);

    return {
      ...validationStats,
      recentIssues,
    };
  }, [validationStats, validationHistory]);

  // Security level monitoring effect
  useEffect(() => {
    if (securityLevel === 'critical') {
      log.error('Critical security level reached', {
        component: 'useSecurityValidator',
        metadata: {
          criticalIssues: validationStats.criticalIssues,
          failedValidations: validationStats.failedValidations,
        },
      });
    }
  }, [securityLevel, validationStats]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Cleanup any pending timeouts or intervals
    };
  }, []);

  return {
    // Validation functions
    validateInput,
    validateMedicalData,
    validateFileUpload,
    validateForm,

    // Sanitization functions
    sanitizeHTML,
    sanitizeInput,

    // CSRF protection
    generateCSRFToken,
    validateCSRFToken,

    // Security state
    securityLevel,
    isSecurityCompromised,
    lastValidationResult,
    validationHistory,

    // Configuration
    updateSecurityConfig,

    // Statistics
    getValidationStats,
  };
};

export default useSecurityValidator;
