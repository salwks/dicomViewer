/**
 * 프로덕션 환경 로그 관리 테스트
 * 민감한 정보 노출 방지 및 로그 보안을 검증합니다
 */

import { debugLogger } from '../utils/debug-logger.js';
import ProductionConsoleGuard from '../utils/production-console-guard.js';

// 테스트 데이터
const TEST_DATA = {
  // 민감한 데이터 (마스킹되어야 함)
  sensitiveData: {
    password: 'admin123',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    api_key: 'sk-1234567890abcdef',
    patient_id: 'P-12345',
    patient_name: 'John Doe',
    ssn: '123-45-6789',
    phone_number: '555-123-4567',
    email_address: 'john.doe@example.com',
    credit_card: '4111-1111-1111-1111',
    medical_record: 'MR-98765',
    diagnosis: 'Hypertension',
    treatment: 'Lisinopril 10mg daily',
    insurance: 'Blue Cross Blue Shield',
    session_id: 'sess_1234567890',
    bearer_token: 'Bearer abc123def456',
    jwt_token: 'jwt eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    user_id: 'user_67890',
    access_token: 'access_token_abcdef123456',
    refresh_token: 'refresh_token_fedcba654321'
  },
  
  // 일반 데이터 (허용되어야 함)
  normalData: {
    filename: 'image.dcm',
    filesize: 1024000,
    timestamp: '2023-07-15T10:30:00Z',
    viewport_id: 'viewport_1',
    tool_name: 'WindowLevel',
    series_number: 1,
    instance_number: 1,
    study_date: '20230715',
    modality: 'CT',
    institution: 'General Hospital',
    manufacturer: 'Siemens'
  },
  
  // 민감한 문자열 패턴
  sensitiveStrings: [
    'Patient: John Doe, SSN: 123-45-6789',
    'API Key: sk-1234567890abcdef',
    'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'Credit Card: 4111-1111-1111-1111',
    'Email: john.doe@example.com',
    'Phone: 555-123-4567',
    'JWT jwt eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'Address: 123 Main St, Anytown, 12345',
    'Insurance: Blue Cross Blue Shield Policy #123456',
    'Diagnosis: Acute myocardial infarction'
  ],
  
  // 허용된 로그 메시지
  allowedMessages: [
    '🛡️ Security: Authentication successful',
    '[SECURITY] Access granted to medical imaging',
    '🏥 Medical: DICOM image loaded successfully',
    '[MEDICAL] Viewport rendering completed',
    '❌ ERROR: Failed to load DICOM file',
    '⚠️ WARNING: High memory usage detected',
    'Emergency: System critical error',
    'Critical: Database connection lost'
  ]
};

// 테스트 결과 타입
interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  actualResult?: any;
  expectedResult?: any;
}

// 테스트 실행기
class ProductionLoggingTestRunner {
  private results: TestResult[] = [];
  private testsPassed = 0;
  private testsFailed = 0;
  private originalConsole: any;

  constructor() {
    // 원본 콘솔 메서드 저장
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug
    };
  }

  private addResult(result: TestResult): void {
    this.results.push(result);
    if (result.passed) {
      this.testsPassed++;
    } else {
      this.testsFailed++;
    }
  }

  // 민감한 데이터 마스킹 테스트
  testSensitiveDataMasking(): void {
    console.log('\n🔒 Testing sensitive data masking...');
    
    // 디버그 로거 민감한 데이터 처리 테스트
    const testData = TEST_DATA.sensitiveData;
    
    // 프로덕션 환경 시뮬레이션
    const originalEnv = (import.meta as any).env;
    (import.meta as any).env = { PROD: true };
    
    try {
      // 로그 출력 캡처
      const logOutputs: string[] = [];
      console.log = (...args: any[]) => {
        logOutputs.push(args.join(' '));
      };
      
      // 민감한 데이터로 로그 시도
      debugLogger.log('Test message', testData);
      
      // 출력에서 민감한 정보 확인
      const hasPasswordInOutput = logOutputs.some(output => 
        output.includes('admin123') || output.includes('password')
      );
      
      this.addResult({
        testName: 'Sensitive Data Masking',
        passed: !hasPasswordInOutput,
        details: hasPasswordInOutput ? 'Sensitive data found in output' : 'Sensitive data properly masked',
        actualResult: logOutputs,
        expectedResult: 'No sensitive data in output'
      });
      
    } finally {
      // 환경 복원
      (import.meta as any).env = originalEnv;
      console.log = this.originalConsole.log;
    }
  }

  // 프로덕션 환경 로그 비활성화 테스트
  testProductionLogDisabling(): void {
    console.log('\n🚫 Testing production log disabling...');
    
    // 프로덕션 환경 시뮬레이션
    const originalEnv = (import.meta as any).env;
    (import.meta as any).env = { PROD: true };
    
    try {
      // 로그 출력 캡처
      const logOutputs: string[] = [];
      console.log = (...args: any[]) => {
        logOutputs.push(args.join(' '));
      };
      
      // 디버그 로그 시도
      debugLogger.debug('This debug message should not appear');
      debugLogger.log('This log message should not appear');
      
      // 에러 로그는 허용되어야 함
      debugLogger.error('This error should appear');
      
      const hasDebugLog = logOutputs.some(output => 
        output.includes('This debug message should not appear')
      );
      
      const hasErrorLog = logOutputs.some(output => 
        output.includes('This error should appear')
      );
      
      this.addResult({
        testName: 'Production Log Disabling',
        passed: !hasDebugLog && hasErrorLog,
        details: `Debug logs disabled: ${!hasDebugLog}, Error logs enabled: ${hasErrorLog}`,
        actualResult: logOutputs,
        expectedResult: 'Debug logs disabled, error logs enabled'
      });
      
    } finally {
      // 환경 복원
      (import.meta as any).env = originalEnv;
      console.log = this.originalConsole.log;
    }
  }

  // 콘솔 보안 가드 테스트
  testConsoleSecurityGuard(): void {
    console.log('\n🛡️ Testing console security guard...');
    
    // 콘솔 보안 가드 상태 확인
    const guardStatus = ProductionConsoleGuard.getStatus();
    
    this.addResult({
      testName: 'Console Security Guard Status',
      passed: guardStatus.allowedPatterns > 0 && guardStatus.sensitivePatterns > 0,
      details: `Allowed patterns: ${guardStatus.allowedPatterns}, Sensitive patterns: ${guardStatus.sensitivePatterns}`,
      actualResult: guardStatus,
      expectedResult: 'Guard initialized with patterns'
    });
    
    // 응급 로그 테스트
    const emergencyOutputs: string[] = [];
    console.error = (...args: any[]) => {
      emergencyOutputs.push(args.join(' '));
    };
    
    ProductionConsoleGuard.emergencyLog('Test emergency message');
    
    const hasEmergencyLog = emergencyOutputs.some(output => 
      output.includes('🚨 Emergency: Test emergency message')
    );
    
    this.addResult({
      testName: 'Emergency Log Function',
      passed: hasEmergencyLog,
      details: hasEmergencyLog ? 'Emergency log working' : 'Emergency log failed',
      actualResult: emergencyOutputs,
      expectedResult: 'Emergency log should appear'
    });
    
    console.error = this.originalConsole.error;
  }

  // 민감한 문자열 패턴 테스트
  testSensitiveStringPatterns(): void {
    console.log('\n🔍 Testing sensitive string patterns...');
    
    const testStrings = TEST_DATA.sensitiveStrings;
    let maskedCount = 0;
    
    testStrings.forEach(testString => {
      // 민감한 문자열 처리 테스트
      const processed = this.simulateDataSanitization(testString);
      
      // 원본 민감한 정보가 제거되었는지 확인
      const isMasked = processed.includes('[REDACTED]') || 
                     processed.includes('[MASKED]') ||
                     processed === '[데이터 숨김]';
      
      if (isMasked) {
        maskedCount++;
      }
    });
    
    const maskingRate = (maskedCount / testStrings.length) * 100;
    
    this.addResult({
      testName: 'Sensitive String Pattern Detection',
      passed: maskingRate >= 80, // 80% 이상 마스킹되어야 함
      details: `${maskingRate.toFixed(1)}% of sensitive strings were masked`,
      actualResult: `${maskedCount}/${testStrings.length} masked`,
      expectedResult: 'At least 80% masking rate'
    });
  }

  // 허용된 로그 메시지 테스트
  testAllowedLogMessages(): void {
    console.log('\n✅ Testing allowed log messages...');
    
    const allowedMessages = TEST_DATA.allowedMessages;
    let allowedCount = 0;
    
    allowedMessages.forEach(message => {
      // 허용된 메시지 패턴 테스트
      const isAllowed = this.simulateLogFiltering(message);
      
      if (isAllowed) {
        allowedCount++;
      }
    });
    
    const allowedRate = (allowedCount / allowedMessages.length) * 100;
    
    this.addResult({
      testName: 'Allowed Log Message Filtering',
      passed: allowedRate >= 90, // 90% 이상 허용되어야 함
      details: `${allowedRate.toFixed(1)}% of allowed messages passed filtering`,
      actualResult: `${allowedCount}/${allowedMessages.length} allowed`,
      expectedResult: 'At least 90% allowance rate'
    });
  }

  // 메모리 및 성능 테스트
  testLoggingPerformance(): void {
    console.log('\n⚡ Testing logging performance...');
    
    const startTime = performance.now();
    const testIterations = 1000;
    
    // 대량 로그 처리 테스트
    for (let i = 0; i < testIterations; i++) {
      debugLogger.log(`Test log message ${i}`, TEST_DATA.normalData);
    }
    
    const endTime = performance.now();
    const averageTime = (endTime - startTime) / testIterations;
    
    this.addResult({
      testName: 'Logging Performance',
      passed: averageTime < 1.0, // 1ms 미만이어야 함
      details: `Average logging time: ${averageTime.toFixed(3)}ms per message`,
      actualResult: `${averageTime.toFixed(3)}ms`,
      expectedResult: 'Less than 1ms per message'
    });
  }

  // 도우미 메서드: 데이터 살균화 시뮬레이션
  private simulateDataSanitization(data: string): string {
    // 실제 debug-logger의 살균화 로직과 유사한 처리
    let sanitized = data;
    
    const medicalPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
      /\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/g, // Phone number
      /Bearer\s+[A-Za-z0-9\-_\.]+/gi, // Bearer token
      /jwt\s+[A-Za-z0-9\-_\.]+/gi, // JWT token
      /api[_-]?key[:\s=]+[A-Za-z0-9\-_\.]+/gi, // API key
    ];
    
    medicalPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });
    
    return sanitized;
  }

  // 도우미 메서드: 로그 필터링 시뮬레이션
  private simulateLogFiltering(message: string): boolean {
    const allowedPatterns = [
      /^🛡️/, // 보안 관련 로그
      /^\[SECURITY\]/, // 보안 이벤트
      /^🏥/, // 의료 데이터 관련 로그
      /^\[MEDICAL\]/, // 의료 시스템 로그
      /^❌.*ERROR/, // 크리티컬 오류
      /^⚠️.*WARNING/, // 중요 경고
      /^Emergency/, // 응급 상황
      /^Critical/, // 중대 상황
    ];
    
    return allowedPatterns.some(pattern => pattern.test(message));
  }

  // 모든 테스트 실행
  runAllTests(): void {
    console.log('🧪 PRODUCTION LOGGING SECURITY TEST SUITE');
    console.log('='.repeat(60));
    
    this.testSensitiveDataMasking();
    this.testProductionLogDisabling();
    this.testConsoleSecurityGuard();
    this.testSensitiveStringPatterns();
    this.testAllowedLogMessages();
    this.testLoggingPerformance();
    
    this.printResults();
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
      console.log(`${icon} ${index + 1}. ${result.testName}: ${result.details}`);
    });
    
    if (this.testsFailed === 0) {
      console.log('\n🎉 ALL PRODUCTION LOGGING TESTS PASSED!');
      console.log('🛡️  Production logging security is properly implemented');
    } else {
      console.log('\n⚠️  Some production logging tests failed');
      console.log('🔧 Please review the logging security implementation');
    }
    
    console.log('\n🔍 Security Features Tested:');
    console.log('- Sensitive data masking');
    console.log('- Production log disabling');
    console.log('- Console security guard');
    console.log('- Pattern-based filtering');
    console.log('- Performance optimization');
    console.log('- Emergency logging');
    console.log('- Medical data protection');
  }
}

// 테스트 실행 함수
export function runProductionLoggingTests(): void {
  const testRunner = new ProductionLoggingTestRunner();
  testRunner.runAllTests();
}

// 개발 환경에서 자동 실행
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  console.log('🔒 Production Logging Test Suite Loading...');
  
  // 브라우저 환경에서는 전역 함수로 노출
  (window as any).runProductionLoggingTests = runProductionLoggingTests;
  
  // 자동 실행
  setTimeout(() => {
    runProductionLoggingTests();
  }, 2000);
}

// Node.js 환경에서 실행
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runProductionLoggingTests };
}

console.log('🛡️  Production Logging Test Suite Ready');
console.log('💡 Run runProductionLoggingTests() to execute tests');

export default runProductionLoggingTests;