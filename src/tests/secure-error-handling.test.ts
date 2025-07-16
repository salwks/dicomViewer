/**
 * 보안 에러 처리 테스트
 * 중앙화된 에러 처리 시스템의 보안성과 기능성을 검증합니다.
 */

import { 
  SecureErrorHandler, 
  handleError, 
  handleAuthError, 
  handleDicomError, 
  handleSecurityError,
  ErrorCategory, 
  ErrorSeverity 
} from '../utils/error-handler';

import { ErrorReportingService } from '../utils/error-reporting';

// 테스트 에러 클래스
class TestError extends Error {
  constructor(message: string, public sensitiveData?: any) {
    super(message);
    this.name = 'TestError';
  }
}

// 테스트 데이터
const TEST_ERRORS = {
  simple: new Error('Simple test error'),
  withStack: new Error('Error with stack trace'),
  withSensitiveData: new TestError('Error with sensitive data', {
    password: 'secret123',
    token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    apiKey: 'sk-1234567890abcdef'
  }),
  withFilePath: new Error('Error at /Users/username/project/src/components/Test.tsx:42:15'),
  networkError: new Error('Network Error: Failed to fetch from https://api.example.com/data'),
  validationError: new Error('Validation failed: Invalid email format'),
  authError: new Error('Authentication failed: Invalid credentials'),
  securityError: new Error('Security violation: XSS attempt detected')
};

// 테스트 결과 인터페이스
interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  duration: number;
  error?: string;
}

// 테스트 실행기 클래스
class SecureErrorHandlingTestRunner {
  private results: TestResult[] = [];
  private testsPassed = 0;
  private testsFailed = 0;
  private errorHandler: SecureErrorHandler;
  private errorReportingService: ErrorReportingService;

  constructor() {
    this.errorHandler = SecureErrorHandler.getInstance();
    this.errorReportingService = ErrorReportingService.getInstance();
  }

  // 모든 테스트 실행
  async runAllTests(): Promise<void> {
    console.log('🔐 SECURE ERROR HANDLING TEST SUITE');
    console.log('='.repeat(60));

    await this.testBasicErrorHandling();
    await this.testSensitiveDataSanitization();
    await this.testErrorCategorization();
    await this.testErrorSeverity();
    await this.testUserFriendlyMessages();
    await this.testErrorReporting();
    await this.testPerformance();
    await this.testSecurityFeatures();

    this.printResults();
  }

  // 기본 에러 처리 테스트
  private async testBasicErrorHandling(): Promise<void> {
    const testName = 'Basic Error Handling';
    const startTime = performance.now();
    
    try {
      // 에러 처리 테스트
      const userMessage = this.errorHandler.handleError(
        TEST_ERRORS.simple,
        'Test error handling',
        {
          category: ErrorCategory.SYSTEM,
          severity: ErrorSeverity.MEDIUM,
          logToConsole: false,
          reportToService: false
        }
      );

      // 사용자 메시지가 생성되었는지 확인
      const hasUserMessage = typeof userMessage === 'string' && userMessage.length > 0;
      
      // 민감한 정보가 포함되지 않았는지 확인
      const isSanitized = !userMessage.includes('Test.tsx') && 
                         !userMessage.includes('/Users/') &&
                         !userMessage.includes('stack trace');

      const success = hasUserMessage && isSanitized;
      
      this.addResult({
        testName,
        passed: success,
        details: success ? 'Basic error handling works correctly' : 'Error handling failed',
        duration: performance.now() - startTime
      });
      
    } catch (error) {
      this.addResult({
        testName,
        passed: false,
        details: 'Exception occurred',
        duration: performance.now() - startTime,
        error: error?.toString()
      });
    }
  }

  // 민감한 데이터 살균화 테스트
  private async testSensitiveDataSanitization(): Promise<void> {
    const testName = 'Sensitive Data Sanitization';
    const startTime = performance.now();
    
    try {
      // 민감한 데이터가 포함된 에러 처리
      const userMessage = this.errorHandler.handleError(
        TEST_ERRORS.withSensitiveData,
        'Error with sensitive data',
        {
          category: ErrorCategory.SECURITY,
          severity: ErrorSeverity.HIGH,
          logToConsole: false,
          reportToService: false,
          context: {
            password: 'secret123',
            token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            apiKey: 'sk-1234567890abcdef',
            normalData: 'This is safe data'
          }
        }
      );

      // 민감한 데이터가 제거되었는지 확인
      const isPasswordRemoved = !userMessage.includes('secret123');
      const isTokenRemoved = !userMessage.includes('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      const isApiKeyRemoved = !userMessage.includes('sk-1234567890abcdef');

      const success = isPasswordRemoved && isTokenRemoved && isApiKeyRemoved;
      
      this.addResult({
        testName,
        passed: success,
        details: success ? 'Sensitive data properly sanitized' : 'Sensitive data not properly sanitized',
        duration: performance.now() - startTime
      });
      
    } catch (error) {
      this.addResult({
        testName,
        passed: false,
        details: 'Exception occurred',
        duration: performance.now() - startTime,
        error: error?.toString()
      });
    }
  }

  // 에러 카테고리화 테스트
  private async testErrorCategorization(): Promise<void> {
    const testName = 'Error Categorization';
    const startTime = performance.now();
    
    try {
      let correctCategories = 0;
      let totalTests = 0;

      // DICOM 에러 테스트
      const dicomMessage = handleDicomError(TEST_ERRORS.simple, 'DICOM processing failed');
      if (dicomMessage.includes('DICOM')) correctCategories++;
      totalTests++;

      // 인증 에러 테스트
      const authMessage = handleAuthError(TEST_ERRORS.authError, 'Authentication failed');
      if (authMessage.includes('인증')) correctCategories++;
      totalTests++;

      // 보안 에러 테스트
      const securityMessage = handleSecurityError(TEST_ERRORS.securityError, 'Security violation');
      if (securityMessage.includes('보안')) correctCategories++;
      totalTests++;

      const success = correctCategories === totalTests;
      
      this.addResult({
        testName,
        passed: success,
        details: `${correctCategories}/${totalTests} categories correctly handled`,
        duration: performance.now() - startTime
      });
      
    } catch (error) {
      this.addResult({
        testName,
        passed: false,
        details: 'Exception occurred',
        duration: performance.now() - startTime,
        error: error?.toString()
      });
    }
  }

  // 에러 심각도 테스트
  private async testErrorSeverity(): Promise<void> {
    const testName = 'Error Severity Handling';
    const startTime = performance.now();
    
    try {
      // 다양한 심각도로 에러 처리
      const lowSeverityMessage = handleError(
        TEST_ERRORS.simple,
        'Low severity error',
        { severity: ErrorSeverity.LOW, logToConsole: false, reportToService: false }
      );

      const highSeverityMessage = handleError(
        TEST_ERRORS.securityError,
        'High severity error',
        { severity: ErrorSeverity.HIGH, logToConsole: false, reportToService: false }
      );

      const criticalSeverityMessage = handleError(
        TEST_ERRORS.securityError,
        'Critical severity error',
        { severity: ErrorSeverity.CRITICAL, logToConsole: false, reportToService: false }
      );

      // 메시지가 생성되었는지 확인
      const hasMessages = lowSeverityMessage.length > 0 && 
                         highSeverityMessage.length > 0 && 
                         criticalSeverityMessage.length > 0;

      const success = hasMessages;
      
      this.addResult({
        testName,
        passed: success,
        details: success ? 'Error severity handling works correctly' : 'Error severity handling failed',
        duration: performance.now() - startTime
      });
      
    } catch (error) {
      this.addResult({
        testName,
        passed: false,
        details: 'Exception occurred',
        duration: performance.now() - startTime,
        error: error?.toString()
      });
    }
  }

  // 사용자 친화적 메시지 테스트
  private async testUserFriendlyMessages(): Promise<void> {
    const testName = 'User Friendly Messages';
    const startTime = performance.now();
    
    try {
      // 다양한 에러 타입에 대한 사용자 메시지 테스트
      const networkMessage = handleError(
        TEST_ERRORS.networkError,
        'Network error occurred',
        { category: ErrorCategory.NETWORK, logToConsole: false, reportToService: false }
      );

      const validationMessage = handleError(
        TEST_ERRORS.validationError,
        'Validation error occurred',
        { category: ErrorCategory.VALIDATION, logToConsole: false, reportToService: false }
      );

      // 사용자 친화적 메시지인지 확인
      const isNetworkMessageFriendly = networkMessage.includes('네트워크') || networkMessage.includes('연결');
      const isValidationMessageFriendly = validationMessage.includes('입력') || validationMessage.includes('값');

      // 기술적 세부사항이 포함되지 않았는지 확인
      const isClean = !networkMessage.includes('fetch') && 
                     !validationMessage.includes('Invalid email format');

      const success = isNetworkMessageFriendly && isValidationMessageFriendly && isClean;
      
      this.addResult({
        testName,
        passed: success,
        details: success ? 'User friendly messages generated correctly' : 'User friendly messages failed',
        duration: performance.now() - startTime
      });
      
    } catch (error) {
      this.addResult({
        testName,
        passed: false,
        details: 'Exception occurred',
        duration: performance.now() - startTime,
        error: error?.toString()
      });
    }
  }

  // 에러 리포팅 테스트
  private async testErrorReporting(): Promise<void> {
    const testName = 'Error Reporting';
    const startTime = performance.now();
    
    try {
      // 에러 리포팅 서비스 초기화
      await this.errorReportingService.initialize();

      // 에러 리포트 생성 및 전송
      const userMessage = this.errorHandler.handleError(
        TEST_ERRORS.simple,
        'Test error reporting',
        {
          category: ErrorCategory.SYSTEM,
          severity: ErrorSeverity.MEDIUM,
          logToConsole: false,
          reportToService: true
        }
      );

      // 통계 확인
      const stats = this.errorReportingService.getStats();
      const hasStats = stats.totalReports > 0;

      const success = hasStats && userMessage.length > 0;
      
      this.addResult({
        testName,
        passed: success,
        details: success ? 'Error reporting works correctly' : 'Error reporting failed',
        duration: performance.now() - startTime
      });
      
    } catch (error) {
      this.addResult({
        testName,
        passed: false,
        details: 'Exception occurred',
        duration: performance.now() - startTime,
        error: error?.toString()
      });
    }
  }

  // 성능 테스트
  private async testPerformance(): Promise<void> {
    const testName = 'Performance';
    const startTime = performance.now();
    
    try {
      const iterations = 100;
      let totalTime = 0;

      // 다중 에러 처리 성능 측정
      for (let i = 0; i < iterations; i++) {
        const iterationStart = performance.now();
        
        handleError(
          TEST_ERRORS.simple,
          `Performance test ${i}`,
          {
            category: ErrorCategory.SYSTEM,
            severity: ErrorSeverity.MEDIUM,
            logToConsole: false,
            reportToService: false
          }
        );
        
        totalTime += performance.now() - iterationStart;
      }

      const averageTime = totalTime / iterations;
      
      // 평균 1ms 이하여야 함
      const success = averageTime < 1.0;
      
      this.addResult({
        testName,
        passed: success,
        details: `Average processing time: ${averageTime.toFixed(3)}ms`,
        duration: performance.now() - startTime
      });
      
    } catch (error) {
      this.addResult({
        testName,
        passed: false,
        details: 'Exception occurred',
        duration: performance.now() - startTime,
        error: error?.toString()
      });
    }
  }

  // 보안 기능 테스트
  private async testSecurityFeatures(): Promise<void> {
    const testName = 'Security Features';
    const startTime = performance.now();
    
    try {
      // 파일 경로 제거 테스트
      const filePathMessage = handleError(
        TEST_ERRORS.withFilePath,
        'File path sanitization test',
        { logToConsole: false, reportToService: false }
      );

      // 스택 트레이스 제거 테스트
      const stackTraceMessage = handleError(
        TEST_ERRORS.withStack,
        'Stack trace sanitization test',
        { includeStackTrace: true, logToConsole: false, reportToService: false }
      );

      // 보안 이벤트 로깅 테스트
      const securityEventMessage = handleSecurityError(
        TEST_ERRORS.securityError,
        'Security event test'
      );

      // 보안 기능 확인
      const isFilePathSanitized = !filePathMessage.includes('/Users/') && 
                                  !filePathMessage.includes('Test.tsx');
      const isStackTraceSanitized = !stackTraceMessage.includes('at Object.');
      const isSecurityEventLogged = securityEventMessage.includes('보안');

      const success = isFilePathSanitized && isStackTraceSanitized && isSecurityEventLogged;
      
      this.addResult({
        testName,
        passed: success,
        details: success ? 'Security features work correctly' : 'Security features failed',
        duration: performance.now() - startTime
      });
      
    } catch (error) {
      this.addResult({
        testName,
        passed: false,
        details: 'Exception occurred',
        duration: performance.now() - startTime,
        error: error?.toString()
      });
    }
  }

  // 테스트 결과 추가
  private addResult(result: TestResult): void {
    this.results.push(result);
    if (result.passed) {
      this.testsPassed++;
    } else {
      this.testsFailed++;
    }
  }

  // 결과 출력
  private printResults(): void {
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(40));
    
    const totalTests = this.testsPassed + this.testsFailed;
    const successRate = ((this.testsPassed / totalTests) * 100).toFixed(1);
    
    console.log(`✅ Tests Passed: ${this.testsPassed}`);
    console.log(`❌ Tests Failed: ${this.testsFailed}`);
    console.log(`📈 Success Rate: ${successRate}%`);
    
    console.log('\n📋 Detailed Results:');
    this.results.forEach((result, index) => {
      const icon = result.passed ? '✅' : '❌';
      const duration = result.duration.toFixed(2);
      console.log(`${icon} ${index + 1}. ${result.testName}: ${result.details} (${duration}ms)`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    if (this.testsFailed === 0) {
      console.log('\n🎉 ALL SECURE ERROR HANDLING TESTS PASSED!');
      console.log('🔐 Secure error handling is working correctly');
    } else {
      console.log('\n⚠️  Some secure error handling tests failed');
      console.log('🔧 Please review the error handling implementation');
    }
    
    console.log('\n🔍 Security Features Tested:');
    console.log('- Sensitive data sanitization');
    console.log('- File path sanitization');
    console.log('- Stack trace sanitization');
    console.log('- Error categorization');
    console.log('- User friendly messages');
    console.log('- Error severity handling');
    console.log('- Performance optimization');
    console.log('- Security event logging');
  }
}

// 테스트 실행 함수
export async function runSecureErrorHandlingTests(): Promise<void> {
  const testRunner = new SecureErrorHandlingTestRunner();
  await testRunner.runAllTests();
}

// 개발 환경에서 자동 실행
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  console.log('🔐 Secure Error Handling Test Suite Loading...');
  
  // 브라우저 환경에서는 전역 함수로 노출
  (window as any).runSecureErrorHandlingTests = runSecureErrorHandlingTests;
  
  // 자동 실행
  setTimeout(() => {
    runSecureErrorHandlingTests();
  }, 4000);
}

// Node.js 환경에서 실행
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runSecureErrorHandlingTests };
}

console.log('🔐 Secure Error Handling Test Suite Ready');
console.log('💡 Run runSecureErrorHandlingTests() to execute tests');

export default runSecureErrorHandlingTests;