/**
 * 프로덕션 환경 콘솔 보안 가드
 * 프로덕션 환경에서 콘솔 로그를 완전히 차단하여 민감한 정보 노출을 방지합니다.
 */

// 원본 콘솔 메서드 저장
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
  trace: console.trace,
  group: console.group,
  groupEnd: console.groupEnd,
  groupCollapsed: console.groupCollapsed,
  table: console.table,
  time: console.time,
  timeEnd: console.timeEnd,
  timeLog: console.timeLog,
  count: console.count,
  countReset: console.countReset,
  assert: console.assert,
  clear: console.clear,
  dir: console.dir,
  dirxml: console.dirxml,
  profile: console.profile,
  profileEnd: console.profileEnd,
  timeStamp: console.timeStamp
};

// 허용된 로그 패턴 (필수 시스템 로그만)
const ALLOWED_LOG_PATTERNS = [
  /^🛡️/, // 보안 관련 로그
  /^\[SECURITY\]/, // 보안 이벤트
  /^🏥/, // 의료 데이터 관련 로그
  /^\[MEDICAL\]/, // 의료 시스템 로그
  /^❌.*ERROR/, // 크리티컬 오류
  /^⚠️.*WARNING/, // 중요 경고
  /^Emergency/, // 응급 상황
  /^Critical/, // 중대 상황
];

// 민감한 정보 패턴 (항상 차단)
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /key/i,
  /secret/i,
  /auth/i,
  /credential/i,
  /session/i,
  /cookie/i,
  /user.*id/i,
  /patient.*id/i,
  /medical.*record/i,
  /private/i,
  /confidential/i,
  /ssn/i,
  /social.*security/i,
  /credit.*card/i,
  /bank.*account/i,
  /api.*key/i,
  /access.*token/i,
  /refresh.*token/i,
  /bearer/i,
  /jwt/i,
  /oauth/i,
  /dicom.*tag/i,
  /patient.*name/i,
  /date.*birth/i,
  /phone.*number/i,
  /email.*address/i,
  /address/i,
  /zip.*code/i,
  /postal.*code/i,
];

// 프로덕션 환경 감지
const isProduction = (): boolean => {
  // Vite 환경 변수 확인
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.PROD === true;
  }
  
  // Node.js 환경 변수 확인
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV === 'production';
  }
  
  // 기타 프로덕션 환경 감지
  return (
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1' &&
    !window.location.hostname.startsWith('192.168.') &&
    !window.location.hostname.startsWith('10.') &&
    !window.location.hostname.includes('dev') &&
    !window.location.hostname.includes('test')
  );
};

// 로그 내용 검증
const isLogAllowed = (args: any[]): boolean => {
  if (!isProduction()) {
    return true; // 개발 환경에서는 모든 로그 허용
  }
  
  const logContent = args.join(' ').toLowerCase();
  
  // 민감한 정보 패턴 검사
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(logContent)) {
      return false; // 민감한 정보 포함 시 차단
    }
  }
  
  // 허용된 패턴 검사
  for (const pattern of ALLOWED_LOG_PATTERNS) {
    if (pattern.test(args[0])) {
      return true; // 허용된 패턴 매치 시 허용
    }
  }
  
  // 기본적으로 프로덕션에서는 차단
  return false;
};

// 로그 내용 살균화
const sanitizeLogContent = (args: any[]): any[] => {
  if (!isProduction()) {
    return args; // 개발 환경에서는 원본 반환
  }
  
  return args.map(arg => {
    if (typeof arg === 'string') {
      // 민감한 정보 마스킹
      let sanitized = arg;
      SENSITIVE_PATTERNS.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '[REDACTED]');
      });
      return sanitized;
    } else if (typeof arg === 'object' && arg !== null) {
      // 객체의 민감한 필드 마스킹
      const sanitized = { ...arg };
      Object.keys(sanitized).forEach(key => {
        if (SENSITIVE_PATTERNS.some(pattern => pattern.test(key))) {
          sanitized[key] = '[REDACTED]';
        }
      });
      return sanitized;
    }
    return arg;
  });
};

// 보안 콘솔 래퍼 생성
export class ProductionConsoleGuard {
  private static isInitialized = false;
  
  /**
   * 프로덕션 환경에서 콘솔 보안 가드를 초기화합니다
   */
  static initialize(): void {
    if (ProductionConsoleGuard.isInitialized) {
      return;
    }
    
    if (isProduction()) {
      console.log('🛡️  Initializing production console security guard...');
      
      // 콘솔 메서드 오버라이드
      console.log = (...args: any[]) => {
        if (isLogAllowed(args)) {
          const sanitized = sanitizeLogContent(args);
          originalConsole.log(...sanitized);
        }
      };
      
      console.error = (...args: any[]) => {
        if (isLogAllowed(args)) {
          const sanitized = sanitizeLogContent(args);
          originalConsole.error(...sanitized);
        }
      };
      
      console.warn = (...args: any[]) => {
        if (isLogAllowed(args)) {
          const sanitized = sanitizeLogContent(args);
          originalConsole.warn(...sanitized);
        }
      };
      
      console.info = (...args: any[]) => {
        if (isLogAllowed(args)) {
          const sanitized = sanitizeLogContent(args);
          originalConsole.info(...sanitized);
        }
      };
      
      console.debug = (...args: any[]) => {
        // 프로덕션에서는 디버그 로그 완전 차단
        return;
      };
      
      console.trace = (...args: any[]) => {
        // 프로덕션에서는 트레이스 정보 완전 차단
        return;
      };
      
      console.group = (...args: any[]) => {
        if (isLogAllowed(args)) {
          const sanitized = sanitizeLogContent(args);
          originalConsole.group(...sanitized);
        }
      };
      
      console.groupCollapsed = (...args: any[]) => {
        if (isLogAllowed(args)) {
          const sanitized = sanitizeLogContent(args);
          originalConsole.groupCollapsed(...sanitized);
        }
      };
      
      console.table = (data: any) => {
        // 프로덕션에서는 테이블 출력 차단 (민감한 데이터 노출 위험)
        return;
      };
      
      console.dir = (obj: any) => {
        // 프로덕션에서는 객체 상세 출력 차단
        return;
      };
      
      console.dirxml = (obj: any) => {
        // 프로덕션에서는 XML 출력 차단
        return;
      };
      
      // 개발자 도구 프로파일링 차단
      console.profile = () => {};
      console.profileEnd = () => {};
      console.timeStamp = () => {};
      
      // 전역 접근 차단
      delete (window as any).dicomDebugLogger;
      delete (window as any).debugLogger;
      delete (window as any).logger;
      
      console.log('🛡️  Production console security guard activated');
    } else {
      console.log('🔧 Development mode: Full console logging enabled');
    }
    
    ProductionConsoleGuard.isInitialized = true;
  }
  
  /**
   * 원본 콘솔 메서드 복원 (테스트용)
   */
  static restore(): void {
    if (!ProductionConsoleGuard.isInitialized) {
      return;
    }
    
    Object.assign(console, originalConsole);
    ProductionConsoleGuard.isInitialized = false;
  }
  
  /**
   * 현재 환경이 프로덕션인지 확인
   */
  static isProductionEnvironment(): boolean {
    return isProduction();
  }
  
  /**
   * 로그 필터링 상태 정보 반환
   */
  static getStatus(): {
    isProduction: boolean;
    isInitialized: boolean;
    allowedPatterns: number;
    sensitivePatterns: number;
  } {
    return {
      isProduction: isProduction(),
      isInitialized: ProductionConsoleGuard.isInitialized,
      allowedPatterns: ALLOWED_LOG_PATTERNS.length,
      sensitivePatterns: SENSITIVE_PATTERNS.length,
    };
  }
  
  /**
   * 응급 상황용 로그 (프로덕션에서도 허용)
   */
  static emergencyLog(message: string, data?: any): void {
    const emergencyMessage = `🚨 Emergency: ${message}`;
    originalConsole.error(emergencyMessage, data || '');
  }
  
  /**
   * 보안 이벤트 로그 (프로덕션에서도 허용)
   */
  static securityLog(message: string, data?: any): void {
    const securityMessage = `🛡️ Security: ${message}`;
    originalConsole.warn(securityMessage, data || '');
  }
  
  /**
   * 의료 데이터 관련 로그 (프로덕션에서도 허용, 단 민감정보 제외)
   */
  static medicalLog(message: string, data?: any): void {
    const medicalMessage = `🏥 Medical: ${message}`;
    const sanitized = data ? sanitizeLogContent([data]) : [''];
    originalConsole.info(medicalMessage, sanitized[0]);
  }
}

// 자동 초기화 (애플리케이션 시작 시)
if (typeof window !== 'undefined') {
  // DOM 로드 완료 후 초기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ProductionConsoleGuard.initialize();
    });
  } else {
    ProductionConsoleGuard.initialize();
  }
}

export default ProductionConsoleGuard;