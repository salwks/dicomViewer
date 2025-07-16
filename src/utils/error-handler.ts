/**
 * 보안 에러 처리 유틸리티
 * 민감한 정보 노출을 방지하면서 효과적인 에러 처리를 제공합니다.
 */

import { debugLogger } from './debug-logger';

// 에러 처리 옵션
export interface ErrorOptions {
  logToConsole?: boolean;
  reportToService?: boolean;
  showToUser?: boolean;
  includeStackTrace?: boolean;
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  userId?: string;
  context?: Record<string, any>;
}

// 에러 카테고리
export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  NETWORK = 'network',
  STORAGE = 'storage',
  RENDERING = 'rendering',
  DICOM = 'dicom',
  MEASUREMENT = 'measurement',
  SECURITY = 'security',
  SYSTEM = 'system',
  UNKNOWN = 'unknown'
}

// 에러 심각도
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// 에러 리포트 인터페이스
export interface ErrorReport {
  id: string;
  timestamp: number;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  userMessage: string;
  stackTrace?: string;
  userId?: string;
  context?: Record<string, any>;
  environment: 'development' | 'production';
  userAgent?: string;
  url?: string;
}

// 민감한 정보 패턴 (파일 경로, 토큰 등)
const SENSITIVE_PATTERNS = [
  /\/[A-Za-z]:\\.*?\\[^\\]*\.(ts|tsx|js|jsx)/g, // Windows 파일 경로
  /\/[^\/\s]+\/[^\/\s]+\/[^\/\s]+\.(ts|tsx|js|jsx)/g, // Unix 파일 경로
  /at\s+[^(]+\([^)]+\)/g, // 스택 트레이스 함수 호출
  /token[:\s=]+[A-Za-z0-9\-_\.]+/gi, // 토큰
  /key[:\s=]+[A-Za-z0-9\-_\.]+/gi, // API 키
  /password[:\s=]+[^\s]+/gi, // 패스워드
  /localhost:\d+/g, // 로컬호스트 포트
  /127\.0\.0\.1:\d+/g, // 로컬 IP
  /192\.168\.\d+\.\d+:\d+/g, // 내부 IP
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // 이메일
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // 신용카드
];

// 일반적인 에러 메시지 맵핑
const ERROR_MESSAGE_MAP: Record<string, string> = {
  'Network Error': '네트워크 연결에 문제가 발생했습니다.',
  'Failed to fetch': '서버 연결에 실패했습니다.',
  'Authentication failed': '인증에 실패했습니다. 다시 로그인해주세요.',
  'Access denied': '접근 권한이 없습니다.',
  'File not found': '파일을 찾을 수 없습니다.',
  'Invalid DICOM file': '유효하지 않은 DICOM 파일입니다.',
  'Storage quota exceeded': '저장 공간이 부족합니다.',
  'Permission denied': '권한이 없습니다.',
  'Timeout': '요청 시간이 초과되었습니다.',
  'Invalid input': '입력값이 올바르지 않습니다.',
  'Internal server error': '서버 내부 오류가 발생했습니다.',
  'Service unavailable': '서비스를 사용할 수 없습니다.',
  'Validation error': '입력값 검증에 실패했습니다.',
  'Encryption error': '암호화 처리 중 오류가 발생했습니다.',
  'Decryption error': '복호화 처리 중 오류가 발생했습니다.',
  'Security violation': '보안 정책 위반이 감지되었습니다.',
  'Resource not found': '요청한 리소스를 찾을 수 없습니다.',
  'Measurement calculation failed': '측정 계산에 실패했습니다.',
  'Rendering failed': '이미지 렌더링에 실패했습니다.'
};

// 에러 처리 통계
interface ErrorStats {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recentErrors: ErrorReport[];
}

/**
 * 보안 에러 처리기 클래스
 */
export class SecureErrorHandler {
  private static instance: SecureErrorHandler;
  private errorReports: ErrorReport[] = [];
  private maxReports: number = 1000;
  private errorStats: ErrorStats = {
    totalErrors: 0,
    errorsByCategory: {} as Record<ErrorCategory, number>,
    errorsBySeverity: {} as Record<ErrorSeverity, number>,
    recentErrors: []
  };

  private constructor() {
    this.initializeErrorTracking();
  }

  static getInstance(): SecureErrorHandler {
    if (!SecureErrorHandler.instance) {
      SecureErrorHandler.instance = new SecureErrorHandler();
    }
    return SecureErrorHandler.instance;
  }

  /**
   * 에러 처리 메인 함수
   */
  handleError(error: Error | string, message: string, options: ErrorOptions = {}): string {
    const opts = this.getDefaultOptions(options);
    
    // 에러 리포트 생성
    const errorReport = this.createErrorReport(error, message, opts);
    
    // 에러 저장
    this.storeErrorReport(errorReport);
    
    // 에러 통계 업데이트
    this.updateErrorStats(errorReport);
    
    // 콘솔 로깅 (개발 환경)
    if (opts.logToConsole) {
      this.logToConsole(errorReport, error);
    }
    
    // 에러 리포팅 서비스 전송 (프로덕션 환경)
    if (opts.reportToService) {
      this.reportToService(errorReport);
    }
    
    // 보안 이벤트 로깅 (보안 관련 에러)
    if (opts.category === ErrorCategory.SECURITY) {
      this.logSecurityEvent(errorReport);
    }
    
    return errorReport.userMessage;
  }

  /**
   * 기본 옵션 설정
   */
  private getDefaultOptions(options: ErrorOptions): Required<ErrorOptions> {
    return {
      logToConsole: !import.meta.env.PROD,
      reportToService: import.meta.env.PROD,
      showToUser: true,
      includeStackTrace: !import.meta.env.PROD,
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      userId: undefined,
      context: {},
      ...options
    };
  }

  /**
   * 에러 리포트 생성
   */
  private createErrorReport(error: Error | string, message: string, options: Required<ErrorOptions>): ErrorReport {
    const errorId = this.generateErrorId();
    const timestamp = Date.now();
    
    // 에러 메시지 추출
    const errorMessage = typeof error === 'string' ? error : error.message || 'Unknown error';
    const fullMessage = `${message}: ${errorMessage}`;
    
    // 스택 트레이스 추출 (안전하게)
    let stackTrace: string | undefined;
    if (options.includeStackTrace && typeof error === 'object' && error.stack) {
      stackTrace = this.sanitizeStackTrace(error.stack);
    }
    
    // 사용자 친화적 메시지 생성
    const userMessage = this.createUserFriendlyMessage(errorMessage, options.category);
    
    return {
      id: errorId,
      timestamp,
      message: fullMessage,
      category: options.category,
      severity: options.severity,
      userMessage,
      stackTrace,
      userId: options.userId,
      context: this.sanitizeContext(options.context),
      environment: import.meta.env.PROD ? 'production' : 'development',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined
    };
  }

  /**
   * 사용자 친화적 메시지 생성
   */
  private createUserFriendlyMessage(errorMessage: string, category: ErrorCategory): string {
    // 에러 메시지 맵핑에서 찾기
    for (const [key, friendlyMessage] of Object.entries(ERROR_MESSAGE_MAP)) {
      if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
        return friendlyMessage;
      }
    }
    
    // 카테고리별 기본 메시지
    switch (category) {
      case ErrorCategory.AUTHENTICATION:
        return '인증 처리 중 오류가 발생했습니다. 다시 시도해주세요.';
      case ErrorCategory.AUTHORIZATION:
        return '권한 확인 중 오류가 발생했습니다. 관리자에게 문의하세요.';
      case ErrorCategory.VALIDATION:
        return '입력값이 올바르지 않습니다. 다시 확인해주세요.';
      case ErrorCategory.NETWORK:
        return '네트워크 연결에 문제가 발생했습니다. 연결을 확인해주세요.';
      case ErrorCategory.STORAGE:
        return '데이터 저장 중 오류가 발생했습니다. 다시 시도해주세요.';
      case ErrorCategory.RENDERING:
        return '이미지 표시 중 오류가 발생했습니다. 파일을 다시 불러보세요.';
      case ErrorCategory.DICOM:
        return 'DICOM 파일 처리 중 오류가 발생했습니다. 파일을 확인해주세요.';
      case ErrorCategory.MEASUREMENT:
        return '측정 도구 사용 중 오류가 발생했습니다. 다시 시도해주세요.';
      case ErrorCategory.SECURITY:
        return '보안 검사 중 문제가 발생했습니다. 관리자에게 문의하세요.';
      case ErrorCategory.SYSTEM:
        return '시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      default:
        return '처리 중 오류가 발생했습니다. 다시 시도하거나 지원팀에 문의하세요.';
    }
  }

  /**
   * 스택 트레이스 정리 (민감한 정보 제거)
   */
  private sanitizeStackTrace(stackTrace: string): string {
    let sanitized = stackTrace;
    
    // 민감한 정보 패턴 제거
    SENSITIVE_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });
    
    // 파일 경로 정리
    sanitized = sanitized.replace(/at\s+[^(]+\([^)]+\)/g, 'at [FUNCTION] ([LOCATION])');
    
    return sanitized;
  }

  /**
   * 컨텍스트 정보 정리
   */
  private sanitizeContext(context: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(context)) {
      const keyLower = key.toLowerCase();
      
      // 민감한 키 필터링
      if (keyLower.includes('password') || keyLower.includes('token') || 
          keyLower.includes('secret') || keyLower.includes('key')) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        // 문자열 값에서 민감한 정보 제거
        let sanitizedValue = value;
        SENSITIVE_PATTERNS.forEach(pattern => {
          sanitizedValue = sanitizedValue.replace(pattern, '[REDACTED]');
        });
        sanitized[key] = sanitizedValue;
      } else if (typeof value === 'object' && value !== null) {
        // 중첩 객체 재귀 처리
        sanitized[key] = this.sanitizeContext(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * 에러 리포트 저장
   */
  private storeErrorReport(errorReport: ErrorReport): void {
    this.errorReports.push(errorReport);
    
    // 최대 개수 제한
    if (this.errorReports.length > this.maxReports) {
      this.errorReports.shift();
    }
  }

  /**
   * 에러 통계 업데이트
   */
  private updateErrorStats(errorReport: ErrorReport): void {
    this.errorStats.totalErrors++;
    
    // 카테고리별 통계
    if (!this.errorStats.errorsByCategory[errorReport.category]) {
      this.errorStats.errorsByCategory[errorReport.category] = 0;
    }
    this.errorStats.errorsByCategory[errorReport.category]++;
    
    // 심각도별 통계
    if (!this.errorStats.errorsBySeverity[errorReport.severity]) {
      this.errorStats.errorsBySeverity[errorReport.severity] = 0;
    }
    this.errorStats.errorsBySeverity[errorReport.severity]++;
    
    // 최근 에러 목록 업데이트
    this.errorStats.recentErrors.unshift(errorReport);
    if (this.errorStats.recentErrors.length > 10) {
      this.errorStats.recentErrors.pop();
    }
  }

  /**
   * 콘솔 로깅
   */
  private logToConsole(errorReport: ErrorReport, originalError: Error | string): void {
    console.group(`🚨 [ERROR] ${errorReport.category.toUpperCase()} - ${errorReport.severity.toUpperCase()}`);
    console.error('Message:', errorReport.message);
    console.error('User Message:', errorReport.userMessage);
    console.error('Error ID:', errorReport.id);
    console.error('Timestamp:', new Date(errorReport.timestamp).toISOString());
    
    if (errorReport.context && Object.keys(errorReport.context).length > 0) {
      console.error('Context:', errorReport.context);
    }
    
    if (errorReport.stackTrace) {
      console.error('Stack Trace:', errorReport.stackTrace);
    }
    
    if (typeof originalError === 'object') {
      console.error('Original Error:', originalError);
    }
    
    console.groupEnd();
  }

  /**
   * 에러 리포팅 서비스 전송
   */
  private reportToService(errorReport: ErrorReport): void {
    try {
      // 실제 환경에서는 Sentry, Rollbar, Bugsnag 등의 서비스 사용
      // 현재는 로컬 저장소에 저장
      const existingReports = JSON.parse(localStorage.getItem('error_reports') || '[]');
      existingReports.push(errorReport);
      
      // 최대 100개까지만 저장
      if (existingReports.length > 100) {
        existingReports.shift();
      }
      
      localStorage.setItem('error_reports', JSON.stringify(existingReports));
      
      debugLogger.log('Error reported to service', { errorId: errorReport.id });
    } catch (error) {
      debugLogger.error('Failed to report error to service', error);
    }
  }

  /**
   * 보안 이벤트 로깅
   */
  private logSecurityEvent(errorReport: ErrorReport): void {
    try {
      // 보안 관련 에러는 별도 로깅
      const securityEvent = {
        type: 'SECURITY_ERROR',
        timestamp: errorReport.timestamp,
        message: errorReport.message,
        severity: errorReport.severity,
        userId: errorReport.userId,
        context: errorReport.context,
        userAgent: errorReport.userAgent,
        url: errorReport.url
      };
      
      const existingEvents = JSON.parse(localStorage.getItem('security_events') || '[]');
      existingEvents.push(securityEvent);
      
      // 최대 50개까지만 저장
      if (existingEvents.length > 50) {
        existingEvents.shift();
      }
      
      localStorage.setItem('security_events', JSON.stringify(existingEvents));
      
      debugLogger.warn('Security event logged', { eventId: errorReport.id });
    } catch (error) {
      debugLogger.error('Failed to log security event', error);
    }
  }

  /**
   * 에러 추적 초기화
   */
  private initializeErrorTracking(): void {
    // 전역 에러 핸들러 등록
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.handleError(
          event.error || event.message,
          'Unhandled JavaScript error',
          {
            category: ErrorCategory.SYSTEM,
            severity: ErrorSeverity.HIGH,
            context: {
              filename: event.filename,
              lineno: event.lineno,
              colno: event.colno
            }
          }
        );
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.handleError(
          event.reason,
          'Unhandled Promise rejection',
          {
            category: ErrorCategory.SYSTEM,
            severity: ErrorSeverity.HIGH,
            context: { reason: event.reason }
          }
        );
      });
    }
  }

  /**
   * 에러 ID 생성
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 에러 통계 반환
   */
  getErrorStats(): ErrorStats {
    return { ...this.errorStats };
  }

  /**
   * 최근 에러 목록 반환
   */
  getRecentErrors(count: number = 10): ErrorReport[] {
    return this.errorReports.slice(-count);
  }

  /**
   * 특정 카테고리 에러 반환
   */
  getErrorsByCategory(category: ErrorCategory): ErrorReport[] {
    return this.errorReports.filter(report => report.category === category);
  }

  /**
   * 에러 목록 초기화
   */
  clearErrors(): void {
    this.errorReports = [];
    this.errorStats = {
      totalErrors: 0,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      recentErrors: []
    };
  }
}

// 싱글톤 인스턴스
const errorHandler = SecureErrorHandler.getInstance();

// 편의 함수들
export function handleError(error: Error | string, message: string, options?: ErrorOptions): string {
  return errorHandler.handleError(error, message, options);
}

export function handleAuthError(error: Error | string, message: string = 'Authentication failed'): string {
  return errorHandler.handleError(error, message, {
    category: ErrorCategory.AUTHENTICATION,
    severity: ErrorSeverity.HIGH,
    reportToService: true
  });
}

export function handleValidationError(error: Error | string, message: string = 'Validation failed'): string {
  return errorHandler.handleError(error, message, {
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.MEDIUM,
    showToUser: true
  });
}

export function handleNetworkError(error: Error | string, message: string = 'Network error occurred'): string {
  return errorHandler.handleError(error, message, {
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.HIGH,
    reportToService: true
  });
}

export function handleDicomError(error: Error | string, message: string = 'DICOM processing failed'): string {
  return errorHandler.handleError(error, message, {
    category: ErrorCategory.DICOM,
    severity: ErrorSeverity.HIGH,
    reportToService: true
  });
}

export function handleSecurityError(error: Error | string, message: string = 'Security violation detected'): string {
  return errorHandler.handleError(error, message, {
    category: ErrorCategory.SECURITY,
    severity: ErrorSeverity.CRITICAL,
    reportToService: true,
    logToConsole: true
  });
}

export function handleRenderingError(error: Error | string, message: string = 'Rendering failed'): string {
  return errorHandler.handleError(error, message, {
    category: ErrorCategory.RENDERING,
    severity: ErrorSeverity.MEDIUM,
    reportToService: true
  });
}

export function handleMeasurementError(error: Error | string, message: string = 'Measurement calculation failed'): string {
  return errorHandler.handleError(error, message, {
    category: ErrorCategory.MEASUREMENT,
    severity: ErrorSeverity.MEDIUM,
    reportToService: false
  });
}

export function handleStorageError(error: Error | string, message: string = 'Storage operation failed'): string {
  return errorHandler.handleError(error, message, {
    category: ErrorCategory.STORAGE,
    severity: ErrorSeverity.HIGH,
    reportToService: true
  });
}

export function getErrorStats(): ErrorStats {
  return errorHandler.getErrorStats();
}

export function getRecentErrors(count?: number): ErrorReport[] {
  return errorHandler.getRecentErrors(count);
}

export function clearErrors(): void {
  errorHandler.clearErrors();
}

export default errorHandler;