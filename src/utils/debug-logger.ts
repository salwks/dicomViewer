/**
 * 환경별 디버깅 로거
 * 개발 환경에서만 상세 로깅을 제공하고, 프로덕션에서는 민감한 정보를 보호합니다
 * 
 * 보안 특징:
 * - 프로덕션 환경에서 디버그 로그 비활성화
 * - 스택 트레이스 및 민감한 정보 노출 방지
 * - 환경별 로그 레벨 관리
 */

// 로그 레벨 정의
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  VERBOSE = 4
}

// 환경별 설정
interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  enableStackTrace: boolean;
  enableConsoleOutput: boolean;
  enableLogStorage: boolean;
  enableGlobalAccess: boolean;
}

export class DebugLogger {
  private static instance: DebugLogger;
  private logs: Array<{ timestamp: string; level: string; message: string; data?: any }> = [];
  private config: LoggerConfig;
  
  private constructor() {
    this.config = this.getEnvironmentConfig();
  }

  static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }

  /**
   * 환경별 로거 설정을 반환합니다
   */
  private getEnvironmentConfig(): LoggerConfig {
    const isProduction = import.meta.env.PROD;
    const isDevelopment = import.meta.env.DEV;
    
    if (isProduction) {
      // 프로덕션: 최소한의 로깅만 허용
      return {
        enabled: false,
        level: LogLevel.ERROR,
        enableStackTrace: false,
        enableConsoleOutput: false,
        enableLogStorage: false,
        enableGlobalAccess: false
      };
    } else if (isDevelopment) {
      // 개발: 모든 로깅 허용
      return {
        enabled: true,
        level: LogLevel.VERBOSE,
        enableStackTrace: true,
        enableConsoleOutput: true,
        enableLogStorage: true,
        enableGlobalAccess: true
      };
    } else {
      // 기타 환경 (테스트 등): 제한적 로깅
      return {
        enabled: true,
        level: LogLevel.WARN,
        enableStackTrace: false,
        enableConsoleOutput: true,
        enableLogStorage: false,
        enableGlobalAccess: false
      };
    }
  }

  /**
   * 수동 설정 업데이트 (주로 테스트용)
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 로깅이 활성화되어 있는지 확인
   */
  private isLoggingEnabled(level: LogLevel): boolean {
    return this.config.enabled && level <= this.config.level;
  }

  private formatTimestamp(): string {
    return new Date().toISOString().split('T')[1].slice(0, -1);
  }

  log(message: string, data?: any) {
    if (!this.isLoggingEnabled(LogLevel.INFO)) return;
    
    const logEntry = {
      timestamp: this.formatTimestamp(),
      level: 'INFO',
      message,
      data: this.sanitizeData(data)
    };
    
    if (this.config.enableLogStorage) {
      this.logs.push(logEntry);
    }
    
    if (this.config.enableConsoleOutput) {
      console.log(`🔍 [${logEntry.timestamp}] ${message}`, logEntry.data || '');
    }
  }

  error(message: string, error?: any) {
    if (!this.isLoggingEnabled(LogLevel.ERROR)) return;
    
    const sanitizedError = this.sanitizeError(error);
    const logEntry = {
      timestamp: this.formatTimestamp(),
      level: 'ERROR',
      message,
      data: sanitizedError
    };
    
    if (this.config.enableLogStorage) {
      this.logs.push(logEntry);
    }
    
    if (this.config.enableConsoleOutput) {
      console.error(`❌ [${logEntry.timestamp}] ${message}`, sanitizedError || '');
      
      // 개발 환경에서만 상세 오류 정보 표시
      if (error && this.config.enableStackTrace) {
        if (error instanceof Error) {
          console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
          });
        } else {
          console.error('Error object:', error);
        }
      }
    }
  }

  warn(message: string, data?: any) {
    if (!this.isLoggingEnabled(LogLevel.WARN)) return;
    
    const logEntry = {
      timestamp: this.formatTimestamp(),
      level: 'WARN',
      message,
      data: this.sanitizeData(data)
    };
    
    if (this.config.enableLogStorage) {
      this.logs.push(logEntry);
    }
    
    if (this.config.enableConsoleOutput) {
      console.warn(`⚠️ [${logEntry.timestamp}] ${message}`, logEntry.data || '');
    }
  }

  success(message: string, data?: any) {
    if (!this.isLoggingEnabled(LogLevel.INFO)) return;
    
    const logEntry = {
      timestamp: this.formatTimestamp(),
      level: 'SUCCESS',
      message,
      data: this.sanitizeData(data)
    };
    
    if (this.config.enableLogStorage) {
      this.logs.push(logEntry);
    }
    
    if (this.config.enableConsoleOutput) {
      console.log(`✅ [${logEntry.timestamp}] ${message}`, logEntry.data || '');
    }
  }

  /**
   * 디버그 레벨 로깅 (가장 상세한 로깅)
   */
  debug(message: string, data?: any) {
    if (!this.isLoggingEnabled(LogLevel.DEBUG)) return;
    
    const logEntry = {
      timestamp: this.formatTimestamp(),
      level: 'DEBUG',
      message,
      data: this.sanitizeData(data)
    };
    
    if (this.config.enableLogStorage) {
      this.logs.push(logEntry);
    }
    
    if (this.config.enableConsoleOutput) {
      console.log(`🐛 [${logEntry.timestamp}] ${message}`, logEntry.data || '');
    }
  }

  // 진행 상황 표시
  progress(step: string, current: number, total: number, details?: string) {
    if (!this.isLoggingEnabled(LogLevel.INFO)) return;
    
    const percentage = Math.round((current / total) * 100);
    const message = `${step}: ${current}/${total} (${percentage}%)${details ? ` - ${details}` : ''}`;
    
    this.log(message);
  }

  // 모든 로그 출력 (개발 환경에서만)
  dumpLogs() {
    if (!this.config.enableConsoleOutput || !this.config.enableLogStorage) return;
    
    console.group('🔍 DICOM 렌더링 디버그 로그');
    this.logs.forEach(log => {
      const style = this.getLogStyle(log.level);
      console.log(`[${log.timestamp}] ${log.level}: ${log.message}`, log.data || '');
    });
    console.groupEnd();
  }

  // 오류만 출력
  dumpErrors() {
    if (!this.config.enableLogStorage) return;
    
    const errors = this.logs.filter(log => log.level === 'ERROR');
    if (errors.length > 0 && this.config.enableConsoleOutput) {
      console.group('❌ DICOM 렌더링 오류 요약');
      errors.forEach(error => {
        console.error(`[${error.timestamp}] ${error.message}`, error.data || '');
      });
      console.groupEnd();
    }
  }

  // 최근 로그 가져오기
  getRecentLogs(count: number = 10) {
    return this.logs.slice(-count);
  }

  // 로그 지우기
  clear() {
    if (this.config.enableLogStorage) {
      this.logs = [];
    }
    
    if (this.config.enableConsoleOutput) {
      console.clear();
      this.log('디버그 로그가 초기화되었습니다');
    }
  }

  private getLogStyle(level: string): string {
    switch (level) {
      case 'ERROR': return 'color: #ef4444; font-weight: bold;';
      case 'WARN': return 'color: #f59e0b; font-weight: bold;';
      case 'SUCCESS': return 'color: #10b981; font-weight: bold;';
      default: return 'color: #6b7280;';
    }
  }

  // 특정 단계의 성능 측정
  time(label: string) {
    if (!this.isLoggingEnabled(LogLevel.DEBUG)) return;
    
    if (this.config.enableConsoleOutput) {
      console.time(`⏱️ ${label}`);
    }
    this.debug(`시간 측정 시작: ${label}`);
  }

  timeEnd(label: string) {
    if (!this.isLoggingEnabled(LogLevel.DEBUG)) return;
    
    if (this.config.enableConsoleOutput) {
      console.timeEnd(`⏱️ ${label}`);
    }
    this.debug(`시간 측정 종료: ${label}`);
  }

  // 메모리 사용량 로깅 (개발 환경에서만)
  logMemoryUsage() {
    if (!this.isLoggingEnabled(LogLevel.DEBUG)) return;
    
    if ((performance as any).memory) {
      const memory = {
        used: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round((performance as any).memory.jsHeapSizeLimit / 1024 / 1024)
      };
      
      this.debug('메모리 사용량', memory);
    }
  }

  /**
   * 민감한 데이터를 제거하거나 마스킹합니다
   */
  private sanitizeData(data: any): any {
    if (!data) return data;
    
    // 프로덕션에서는 데이터를 완전히 제거
    if (import.meta.env.PROD) {
      return '[데이터 숨김]';
    }
    
    // 개발 환경에서도 민감한 정보는 마스킹
    if (typeof data === 'object') {
      const sanitized = { ...data };
      
      // 확장된 민감한 키워드 목록 (의료 데이터 포함)
      const sensitiveKeys = [
        'password', 'token', 'key', 'secret', 'auth', 'credential',
        'ssn', 'social', 'credit', 'card', 'bank', 'account',
        'patient', 'medical', 'record', 'private', 'confidential',
        'session', 'cookie', 'bearer', 'jwt', 'oauth', 'api_key',
        'access_token', 'refresh_token', 'user_id', 'patient_id',
        'dicom_tag', 'patient_name', 'date_birth', 'phone_number',
        'email_address', 'address', 'zip_code', 'postal_code',
        'insurance', 'diagnosis', 'treatment', 'medication',
        'allergy', 'symptom', 'vital_sign', 'lab_result'
      ];
      
      Object.keys(sanitized).forEach(key => {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          sanitized[key] = '[MASKED]';
        }
      });
      
      return sanitized;
    }
    
    // 문자열에서 민감한 패턴 마스킹
    if (typeof data === 'string') {
      let sanitized = data;
      
      // 의료 데이터 패턴 마스킹
      const medicalPatterns = [
        /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
        /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
        /\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/g, // Phone number
        /\b\d{5}(-\d{4})?\b/g, // ZIP code
        /Bearer\s+[A-Za-z0-9\-_\.]+/gi, // Bearer token
        /jwt\s+[A-Za-z0-9\-_\.]+/gi, // JWT token
        /api[_-]?key[:\s=]+[A-Za-z0-9\-_\.]+/gi, // API key
      ];
      
      medicalPatterns.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '[REDACTED]');
      });
      
      return sanitized;
    }
    
    return data;
  }

  /**
   * 오류 객체를 안전하게 처리합니다
   */
  private sanitizeError(error: any): any {
    if (!error) return error;
    
    if (error instanceof Error) {
      // 프로덕션에서는 스택 트레이스 제거
      if (import.meta.env.PROD) {
        return {
          name: error.name,
          message: error.message
          // stack 제거
        };
      } else {
        return {
          name: error.name,
          message: error.message,
          stack: error.stack
        };
      }
    }
    
    return this.sanitizeData(error);
  }

  /**
   * 현재 로거 설정 반환
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

// 전역 인스턴스 생성
export const debugLogger = DebugLogger.getInstance();

// 개발 환경에서만 개발자 도구에서 접근 가능하도록 전역에 등록
if (typeof window !== 'undefined' && debugLogger.getConfig().enableGlobalAccess) {
  (window as any).dicomDebugLogger = debugLogger;
}