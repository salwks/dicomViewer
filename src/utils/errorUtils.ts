/**
 * Error Handling Utilities
 *
 * Utility functions for working with DICOM loading errors and recovery
 * Based on Context7 documentation patterns from /cornerstonejs/cornerstone3d
 * Reference: 443 code examples for error handling utility functions
 */

import { MedicalImagingError, ErrorCategory } from '../types';
import { ErrorSeverity, RecoveryStrategy } from '../services/errorManager';

/**
 * Common error codes for medical imaging
 */
export const ERROR_CODES = {
  // Network errors
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_UNAVAILABLE: 'NETWORK_UNAVAILABLE',
  SERVER_ERROR: 'SERVER_ERROR',
  CONNECTION_FAILED: 'CONNECTION_FAILED',

  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // DICOM parsing errors
  INVALID_DICOM: 'INVALID_DICOM',
  UNSUPPORTED_SOP_CLASS: 'UNSUPPORTED_SOP_CLASS',
  METADATA_PARSING_FAILED: 'METADATA_PARSING_FAILED',
  PIXEL_DATA_CORRUPTED: 'PIXEL_DATA_CORRUPTED',

  // Memory errors
  OUT_OF_MEMORY: 'OUT_OF_MEMORY',
  ALLOCATION_FAILED: 'ALLOCATION_FAILED',
  BUFFER_OVERFLOW: 'BUFFER_OVERFLOW',

  // Rendering errors
  WEBGL_NOT_SUPPORTED: 'WEBGL_NOT_SUPPORTED',
  SHADER_COMPILATION_FAILED: 'SHADER_COMPILATION_FAILED',
  TEXTURE_CREATION_FAILED: 'TEXTURE_CREATION_FAILED',

  // Configuration errors
  INVALID_CONFIG: 'INVALID_CONFIG',
  MISSING_DEPENDENCY: 'MISSING_DEPENDENCY',
  INITIALIZATION_FAILED: 'INITIALIZATION_FAILED',
} as const;

/**
 * Create standardized medical imaging error
 * Following Context7 error creation patterns
 */
export function createMedicalError(
  code: string,
  message: string,
  options: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    imageId?: string;
    context?: Record<string, any>;
    originalError?: Error;
  } = {},
): MedicalImagingError {
  const {
    category = ErrorCategory.CONFIGURATION,
    severity = ErrorSeverity.MEDIUM,
    imageId,
    context = {},
    originalError,
  } = options;

  return {
    name: 'MedicalImagingError',
    message,
    code,
    category,
    severity,
    context: {
      timestamp: new Date(),
      imageId,
      stackTrace: originalError?.stack,
      ...context,
    },
  };
}

/**
 * Wrap async function with error handling
 * Following Context7 error wrapping patterns
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  errorContext: {
    operation: string;
    category?: ErrorCategory;
    severity?: ErrorSeverity;
  },
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const medicalError = createMedicalError(
        `${errorContext.operation.toUpperCase()}_FAILED`,
        `${errorContext.operation} failed: ${error}`,
        {
          category: errorContext.category || ErrorCategory.CONFIGURATION,
          severity: errorContext.severity || ErrorSeverity.MEDIUM,
          originalError: error as Error,
          context: {
            operation: errorContext.operation,
            arguments: args,
          },
        },
      );

      throw medicalError;
    }
  };
}

/**
 * Retry function with exponential backoff
 * Following Context7 retry patterns
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: Error) => boolean;
    onRetry?: (attempt: number, error: Error) => void;
  } = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    shouldRetry = () => true,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts || !shouldRetry(lastError)) {
        throw lastError;
      }

      const delay = Math.min(
        baseDelay * Math.pow(backoffMultiplier, attempt - 1),
        maxDelay,
      );

      if (onRetry) {
        onRetry(attempt, lastError);
      }

      console.warn(`🔄 Retry attempt ${attempt}/${maxAttempts} after ${delay}ms: ${lastError.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Circuit breaker pattern for error handling
 * Following Context7 circuit breaker patterns
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private options: {
      failureThreshold: number;
      timeout: number;
      resetTimeout: number;
    } = {
      failureThreshold: 5,
      timeout: 60000,
      resetTimeout: 30000,
    },
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.options.resetTimeout) {
        this.state = 'HALF_OPEN';
        console.log('🔄 Circuit breaker moving to HALF_OPEN state');
      } else {
        throw createMedicalError(
          'CIRCUIT_BREAKER_OPEN',
          'Circuit breaker is OPEN - too many failures',
          {
            category: ErrorCategory.PERFORMANCE,
            severity: ErrorSeverity.HIGH,
            context: {
              failures: this.failures,
              lastFailureTime: this.lastFailureTime,
            },
          },
        );
      }
    }

    try {
      const result = await fn();

      if (this.state === 'HALF_OPEN') {
        this.reset();
        console.log('✅ Circuit breaker reset to CLOSED state');
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.options.failureThreshold) {
      this.state = 'OPEN';
      console.warn(`⚠️ Circuit breaker OPEN after ${this.failures} failures`);
    }
  }

  private reset(): void {
    this.failures = 0;
    this.lastFailureTime = 0;
    this.state = 'CLOSED';
  }

  getStatus() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

/**
 * Error aggregator for collecting multiple errors
 * Following Context7 error aggregation patterns
 */
export class ErrorAggregator {
  private errors: MedicalImagingError[] = [];

  add(error: Error | MedicalImagingError, context?: Record<string, any>): void {
    let medicalError: MedicalImagingError;

    if ('code' in error && 'category' in error) {
      medicalError = error as MedicalImagingError;
    } else {
      medicalError = createMedicalError(
        'AGGREGATED_ERROR',
        error.message,
        {
          originalError: error,
          context,
        },
      );
    }

    this.errors.push(medicalError);
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  getErrors(): MedicalImagingError[] {
    return [...this.errors];
  }

  getErrorCount(): number {
    return this.errors.length;
  }

  getCriticalErrors(): MedicalImagingError[] {
    return this.errors.filter(error => error.severity === ErrorSeverity.CRITICAL);
  }

  getErrorsByCategory(category: ErrorCategory): MedicalImagingError[] {
    return this.errors.filter(error => error.category === category);
  }

  clear(): void {
    this.errors = [];
  }

  createAggregatedError(): MedicalImagingError {
    if (this.errors.length === 0) {
      throw new Error('No errors to aggregate');
    }

    const criticalErrors = this.getCriticalErrors();
    const severity = criticalErrors.length > 0 ? ErrorSeverity.CRITICAL :
      this.errors.some(e => e.severity === ErrorSeverity.HIGH) ? ErrorSeverity.HIGH :
        ErrorSeverity.MEDIUM;

    const categories = [...new Set(this.errors.map(e => e.category))];
    const category = categories.length === 1 ? categories[0] : ErrorCategory.CONFIGURATION;

    return createMedicalError(
      'MULTIPLE_ERRORS',
      `Multiple errors occurred: ${this.errors.map(e => e.message).join('; ')}`,
      {
        category,
        severity,
        context: {
          errorCount: this.errors.length,
          categories,
          errors: this.errors.map(e => ({
            code: e.code,
            message: e.message,
            category: e.category,
            severity: e.severity,
          })),
        },
      },
    );
  }
}

/**
 * Timeout wrapper for operations
 * Following Context7 timeout patterns
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation = 'Operation',
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(createMedicalError(
        'OPERATION_TIMEOUT',
        `${operation} timed out after ${timeoutMs}ms`,
        {
          category: ErrorCategory.PERFORMANCE,
          severity: ErrorSeverity.MEDIUM,
          context: {
            timeoutMs,
            operation,
          },
        },
      ));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Error classification utilities
 * Following Context7 error classification patterns
 */
export const ErrorClassifier = {
  /**
   * Check if error is retryable
   */
  isRetryable(error: Error | MedicalImagingError): boolean {
    const message = error.message.toLowerCase();

    // Network errors are usually retryable
    if (message.includes('network') || message.includes('timeout') ||
        message.includes('connection')) {
      return true;
    }

    // Authentication errors are not retryable without intervention
    if (message.includes('unauthorized') || message.includes('forbidden')) {
      return false;
    }

    // Memory errors might be retryable with degradation
    if (message.includes('memory') || message.includes('heap')) {
      return true;
    }

    // Default to retryable for unknown errors
    return true;
  },

  /**
   * Check if error is critical
   */
  isCritical(error: Error | MedicalImagingError): boolean {
    if ('severity' in error) {
      return error.severity === ErrorSeverity.CRITICAL;
    }

    const message = error.message.toLowerCase();

    // Memory errors are critical
    if (message.includes('out of memory') || message.includes('allocation failed')) {
      return true;
    }

    // Security errors are critical
    if (message.includes('security') || message.includes('violation')) {
      return true;
    }

    return false;
  },

  /**
   * Get recommended recovery strategy
   */
  getRecoveryStrategy(error: Error | MedicalImagingError): RecoveryStrategy {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('timeout')) {
      return RecoveryStrategy.RETRY;
    }

    if (message.includes('memory') || message.includes('performance')) {
      return RecoveryStrategy.DEGRADE;
    }

    if (message.includes('unauthorized') || message.includes('authentication')) {
      return RecoveryStrategy.MANUAL;
    }

    if (message.includes('parsing') || message.includes('dicom')) {
      return RecoveryStrategy.FALLBACK;
    }

    return RecoveryStrategy.RETRY;
  },
};

/**
 * Error reporter for external logging systems
 * Following Context7 error reporting patterns
 */
export class ErrorReporter {
  private reportingEndpoint?: string;
  private reportingLevel: 'minimal' | 'detailed' | 'verbose' = 'detailed';

  constructor(config?: {
    endpoint?: string;
    level?: 'minimal' | 'detailed' | 'verbose';
  }) {
    this.reportingEndpoint = config?.endpoint;
    this.reportingLevel = config?.level || 'detailed';
  }

  async report(error: MedicalImagingError): Promise<void> {
    // Only report critical and high severity errors by default
    if (error.severity !== ErrorSeverity.CRITICAL &&
        error.severity !== ErrorSeverity.HIGH &&
        this.reportingLevel === 'minimal') {
      return;
    }

    const report = this.formatErrorReport(error);

    try {
      if (this.reportingEndpoint) {
        await this.sendToEndpoint(report);
      } else {
        // Log to console as fallback
        console.error('🚨 Error Report:', report);
      }
    } catch (reportingError) {
      console.error('❌ Failed to report error:', reportingError);
    }
  }

  private formatErrorReport(error: MedicalImagingError): Record<string, any> {
    const baseReport = {
      timestamp: new Date().toISOString(),
      error: {
        code: error.code,
        message: error.message,
        category: error.category,
        severity: error.severity,
      },
      context: error.context,
    };

    if (this.reportingLevel === 'verbose') {
      return {
        ...baseReport,
        stackTrace: error.context?.stackTrace,
        userAgent: navigator.userAgent,
        url: window.location.href,
        sessionInfo: {
          timestamp: error.context?.timestamp,
          additionalData: error.context?.additionalData,
        },
      };
    }

    return baseReport;
  }

  private async sendToEndpoint(report: Record<string, any>): Promise<void> {
    if (!this.reportingEndpoint) return;

    const response = await fetch(this.reportingEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(report),
    });

    if (!response.ok) {
      throw new Error(`Error reporting failed: ${response.status} ${response.statusText}`);
    }
  }
}

// Export pre-configured instances
export const defaultCircuitBreaker = new CircuitBreaker();
export const defaultErrorReporter = new ErrorReporter();
