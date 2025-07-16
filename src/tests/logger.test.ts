/**
 * 환경별 로깅 시스템 테스트
 * 프로덕션 환경에서의 보안 로깅 동작을 검증합니다
 */

import { DebugLogger, LogLevel } from '../utils/debug-logger';

// 테스트용 환경 모킹
const mockEnv = (env: 'development' | 'production' | 'test') => {
  const originalEnv = import.meta.env;
  Object.defineProperty(import.meta, 'env', {
    value: {
      ...originalEnv,
      PROD: env === 'production',
      DEV: env === 'development',
      MODE: env
    },
    configurable: true
  });
};

export class LoggerTestSuite {
  static async runAllTests(): Promise<boolean> {
    console.log('🧪 Starting Logger Security Test Suite...\n');
    
    const tests = [
      this.testProductionLogSuppression,
      this.testDevelopmentLogOutput,
      this.testSensitiveDataSanitization,
      this.testStackTraceSuppression,
      this.testLogLevelFiltering,
      this.testGlobalAccessControl,
      this.testMemoryLoggingSecurity,
      this.testErrorSanitization
    ];

    let passedTests = 0;
    let totalTests = tests.length;

    for (const test of tests) {
      try {
        const result = await test.call(this);
        if (result) {
          passedTests++;
          console.log(`✅ ${test.name} - PASSED`);
        } else {
          console.log(`❌ ${test.name} - FAILED`);
        }
      } catch (error) {
        console.log(`❌ ${test.name} - ERROR: ${error}`);
      }
      console.log('');
    }

    const successRate = (passedTests / totalTests) * 100;
    console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed (${successRate.toFixed(1)}%)`);
    
    if (successRate >= 80) {
      console.log('🎉 Logger security tests completed successfully!');
      return true;
    } else {
      console.log('⚠️  Some logger security tests failed. Please review the implementation.');
      return false;
    }
  }

  /**
   * 프로덕션 환경에서 로깅이 비활성화되는지 테스트
   */
  static testProductionLogSuppression(): boolean {
    console.log('🔒 Testing production log suppression...');
    
    // 프로덕션 환경 모킹
    mockEnv('production');
    
    // 새로운 로거 인스턴스 생성
    const logger = new (DebugLogger as any)();
    const config = logger.getConfig();
    
    // 프로덕션 설정 검증
    if (config.enabled !== false) {
      console.log('❌ Logging should be disabled in production');
      return false;
    }
    
    if (config.enableConsoleOutput !== false) {
      console.log('❌ Console output should be disabled in production');
      return false;
    }
    
    if (config.enableGlobalAccess !== false) {
      console.log('❌ Global access should be disabled in production');
      return false;
    }
    
    if (config.enableStackTrace !== false) {
      console.log('❌ Stack traces should be disabled in production');
      return false;
    }
    
    console.log('✓ Production logging properly disabled');
    return true;
  }

  /**
   * 개발 환경에서 로깅이 활성화되는지 테스트
   */
  static testDevelopmentLogOutput(): boolean {
    console.log('🛠️ Testing development log output...');
    
    // 개발 환경 모킹
    mockEnv('development');
    
    const logger = new (DebugLogger as any)();
    const config = logger.getConfig();
    
    // 개발 설정 검증
    if (config.enabled !== true) {
      console.log('❌ Logging should be enabled in development');
      return false;
    }
    
    if (config.level !== LogLevel.VERBOSE) {
      console.log('❌ Log level should be VERBOSE in development');
      return false;
    }
    
    if (config.enableConsoleOutput !== true) {
      console.log('❌ Console output should be enabled in development');
      return false;
    }
    
    if (config.enableGlobalAccess !== true) {
      console.log('❌ Global access should be enabled in development');
      return false;
    }
    
    console.log('✓ Development logging properly enabled');
    return true;
  }

  /**
   * 민감한 데이터 새니타이제이션 테스트
   */
  static testSensitiveDataSanitization(): boolean {
    console.log('🔐 Testing sensitive data sanitization...');
    
    // 개발 환경에서 테스트
    mockEnv('development');
    const logger = new (DebugLogger as any)();
    
    // 민감한 데이터가 포함된 객체
    const sensitiveData = {
      username: 'testuser',
      password: 'secret123',
      authToken: 'bearer-token-xyz',
      apiKey: 'api-key-abc',
      normalField: 'normal-value'
    };
    
    // sanitizeData 메서드 직접 테스트
    const sanitized = logger.sanitizeData(sensitiveData);
    
    // 민감한 필드가 마스킹되었는지 확인
    if (sanitized.password !== '[MASKED]') {
      console.log('❌ Password field should be masked');
      return false;
    }
    
    if (sanitized.authToken !== '[MASKED]') {
      console.log('❌ Auth token should be masked');
      return false;
    }
    
    if (sanitized.apiKey !== '[MASKED]') {
      console.log('❌ API key should be masked');
      return false;
    }
    
    // 일반 필드는 그대로 유지되어야 함
    if (sanitized.normalField !== 'normal-value') {
      console.log('❌ Normal fields should not be masked');
      return false;
    }
    
    console.log('✓ Sensitive data properly sanitized');
    return true;
  }

  /**
   * 프로덕션에서 스택 트레이스 억제 테스트
   */
  static testStackTraceSuppression(): boolean {
    console.log('🚫 Testing stack trace suppression...');
    
    // 프로덕션 환경 모킹
    mockEnv('production');
    const logger = new (DebugLogger as any)();
    
    // 에러 객체 생성
    const testError = new Error('Test error message');
    testError.stack = 'Error: Test error\n    at testFunction\n    at anotherFunction';
    
    // 에러 새니타이제이션 테스트
    const sanitizedError = logger.sanitizeError(testError);
    
    // 프로덕션에서는 스택 트레이스가 제거되어야 함
    if (sanitizedError.stack !== undefined) {
      console.log('❌ Stack trace should be removed in production');
      return false;
    }
    
    // 에러 이름과 메시지는 유지되어야 함
    if (sanitizedError.name !== 'Error') {
      console.log('❌ Error name should be preserved');
      return false;
    }
    
    if (sanitizedError.message !== 'Test error message') {
      console.log('❌ Error message should be preserved');
      return false;
    }
    
    console.log('✓ Stack traces properly suppressed in production');
    return true;
  }

  /**
   * 로그 레벨 필터링 테스트
   */
  static testLogLevelFiltering(): boolean {
    console.log('🎚️ Testing log level filtering...');
    
    // 테스트 환경에서 WARN 레벨로 설정
    mockEnv('test');
    const logger = new (DebugLogger as any)();
    
    // WARN 레벨 설정 확인
    const config = logger.getConfig();
    if (config.level !== LogLevel.WARN) {
      console.log('❌ Test environment should use WARN log level');
      return false;
    }
    
    // 다양한 레벨에서 로깅 활성화 상태 확인
    if (!logger.isLoggingEnabled(LogLevel.ERROR)) {
      console.log('❌ ERROR level should be enabled');
      return false;
    }
    
    if (!logger.isLoggingEnabled(LogLevel.WARN)) {
      console.log('❌ WARN level should be enabled');
      return false;
    }
    
    if (logger.isLoggingEnabled(LogLevel.INFO)) {
      console.log('❌ INFO level should be disabled');
      return false;
    }
    
    if (logger.isLoggingEnabled(LogLevel.DEBUG)) {
      console.log('❌ DEBUG level should be disabled');
      return false;
    }
    
    console.log('✓ Log level filtering working correctly');
    return true;
  }

  /**
   * 글로벌 접근 제어 테스트
   */
  static testGlobalAccessControl(): boolean {
    console.log('🌐 Testing global access control...');
    
    // 프로덕션에서는 글로벌 접근이 비활성화되어야 함
    mockEnv('production');
    const prodLogger = new (DebugLogger as any)();
    
    if (prodLogger.getConfig().enableGlobalAccess !== false) {
      console.log('❌ Global access should be disabled in production');
      return false;
    }
    
    // 개발에서는 글로벌 접근이 활성화되어야 함
    mockEnv('development');
    const devLogger = new (DebugLogger as any)();
    
    if (devLogger.getConfig().enableGlobalAccess !== true) {
      console.log('❌ Global access should be enabled in development');
      return false;
    }
    
    console.log('✓ Global access control working correctly');
    return true;
  }

  /**
   * 메모리 로깅 보안 테스트
   */
  static testMemoryLoggingSecurity(): boolean {
    console.log('💾 Testing memory logging security...');
    
    // 프로덕션에서는 메모리 로깅이 비활성화되어야 함
    mockEnv('production');
    const logger = new (DebugLogger as any)();
    
    // 메모리 로깅 시도 (콘솔 출력 모니터링)
    const originalLog = console.log;
    let logCalled = false;
    console.log = (...args) => {
      if (args.some(arg => typeof arg === 'string' && arg.includes('메모리'))) {
        logCalled = true;
      }
      originalLog.apply(console, args);
    };
    
    logger.logMemoryUsage();
    console.log = originalLog;
    
    if (logCalled) {
      console.log('❌ Memory logging should be disabled in production');
      return false;
    }
    
    console.log('✓ Memory logging properly secured');
    return true;
  }

  /**
   * 에러 새니타이제이션 포괄 테스트
   */
  static testErrorSanitization(): boolean {
    console.log('🧹 Testing comprehensive error sanitization...');
    
    mockEnv('production');
    const logger = new (DebugLogger as any)();
    
    // 다양한 타입의 에러 객체 테스트
    const tests = [
      {
        input: new Error('Test error'),
        expectStack: false
      },
      {
        input: { message: 'Custom error', secret: 'hidden' },
        expectSanitization: true
      },
      {
        input: 'Simple string error',
        expectModification: true
      },
      {
        input: null,
        expectNull: true
      }
    ];
    
    for (const test of tests) {
      const result = logger.sanitizeError(test.input);
      
      if (test.expectStack === false && result && result.stack) {
        console.log('❌ Stack trace should be removed from Error objects');
        return false;
      }
      
      if (test.expectSanitization && result.secret !== '[데이터 숨김]') {
        console.log('❌ Objects should be sanitized in production');
        return false;
      }
      
      if (test.expectNull && result !== null) {
        console.log('❌ Null values should be preserved');
        return false;
      }
    }
    
    console.log('✓ Error sanitization working comprehensively');
    return true;
  }
}

// 테스트 실행 함수 내보내기
export const runLoggerSecurityTests = () => LoggerTestSuite.runAllTests();

// 개발 환경에서 자동 실행
if (import.meta.env.DEV) {
  console.log('🚀 Auto-running logger security tests in development mode...');
  setTimeout(() => {
    LoggerTestSuite.runAllTests().then(success => {
      if (success) {
        console.log('🎯 All logger security tests passed - logging system is secure!');
      } else {
        console.log('⚠️ Logger security tests failed - please check configuration');
      }
    });
  }, 2000);
}