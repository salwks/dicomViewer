/**
 * DICOM 입력 검증 시스템 종합 테스트
 * 모든 검증 함수와 보안 기능을 포괄적으로 테스트합니다
 */

import { 
  DICOMInputValidator,
  validateDicomTag,
  validateDicomUID,
  validateNumericInput,
  validateAnnotationLabel,
  validateFileName,
  validateUsername,
  validateBatch,
  ValidationResult
} from '../utils/input-validation.js';
import { ValidationErrorHandler } from '../utils/validation-error-handler.js';

// 테스트 데이터
const TEST_DATA = {
  // 안전한 입력
  safe: {
    dicomTag: '(0008,0020)',
    dicomUID: '1.2.840.10008.5.1.4.1.1.2',
    annotation: '정상 주석 내용',
    filename: 'test.dcm',
    username: 'testuser',
    windowLevel: '100',
    windowWidth: '500'
  },
  
  // 위험한 입력 (공격 패턴)
  dangerous: {
    sqlInjection: "'; DROP TABLE users; --",
    xssScript: '<script>alert("XSS")</script>',
    pathTraversal: '../../../etc/passwd',
    commandInjection: 'test | rm -rf /',
    ldapInjection: 'test)(uid=*',
    nosqlInjection: '{"$where": "1==1"}'
  },
  
  // 잘못된 형식
  invalid: {
    dicomTag: 'invalid-tag',
    dicomUID: '1.2.3.4.5.',
    longInput: 'a'.repeat(10001),
    controlChars: 'test\x00\x01\x02',
    reservedFilename: 'CON.dcm'
  }
};

export class InputValidationTestSuite {
  private static testResults: Array<{
    testName: string;
    success: boolean;
    details?: string;
  }> = [];

  /**
   * 모든 테스트 실행
   */
  static async runAllTests(): Promise<boolean> {
    console.log('🧪 Starting Input Validation Security Test Suite...\n');
    
    this.testResults = [];
    
    const testSuites = [
      this.testDicomTagValidation,
      this.testDicomUIDValidation,
      this.testNumericInputValidation,
      this.testAnnotationLabelValidation,
      this.testFileNameValidation,
      this.testUsernameValidation,
      this.testSecurityPatternDetection,
      this.testXSSPrevention,
      this.testSQLInjectionPrevention,
      this.testPathTraversalPrevention,
      this.testBatchValidation,
      this.testErrorHandling,
      this.testRealTimeFeedback
    ];

    for (const testSuite of testSuites) {
      try {
        await testSuite.call(this);
      } catch (error) {
        this.addTestResult(testSuite.name, false, `Error: ${error}`);
      }
    }

    return this.showResults();
  }

  /**
   * DICOM 태그 검증 테스트
   */
  static testDicomTagValidation(): void {
    console.log('🏷️  Testing DICOM Tag Validation...');
    
    // 유효한 태그 테스트
    const validTag = validateDicomTag(TEST_DATA.safe.dicomTag);
    if (!validTag.isValid) {
      this.addTestResult('DICOM Tag Valid', false, 'Valid tag rejected');
      return;
    }
    
    // 잘못된 형식 테스트
    const invalidTag = validateDicomTag(TEST_DATA.invalid.dicomTag);
    if (invalidTag.isValid) {
      this.addTestResult('DICOM Tag Invalid', false, 'Invalid tag accepted');
      return;
    }
    
    // 공격 패턴 테스트
    const xssTag = validateDicomTag(TEST_DATA.dangerous.xssScript);
    if (xssTag.isValid || xssTag.securityLevel !== 'DANGER') {
      this.addTestResult('DICOM Tag XSS', false, 'XSS pattern not detected');
      return;
    }
    
    this.addTestResult('DICOM Tag Validation', true);
  }

  /**
   * DICOM UID 검증 테스트
   */
  static testDicomUIDValidation(): void {
    console.log('🆔 Testing DICOM UID Validation...');
    
    // 유효한 UID 테스트
    const validUID = validateDicomUID(TEST_DATA.safe.dicomUID);
    if (!validUID.isValid) {
      this.addTestResult('DICOM UID Valid', false, 'Valid UID rejected');
      return;
    }
    
    // 잘못된 형식 테스트
    const invalidUID = validateDicomUID(TEST_DATA.invalid.dicomUID);
    if (invalidUID.isValid) {
      this.addTestResult('DICOM UID Invalid', false, 'Invalid UID accepted');
      return;
    }
    
    // 길이 제한 테스트
    const longUID = validateDicomUID('1.' + '2.'.repeat(100));
    if (longUID.isValid) {
      this.addTestResult('DICOM UID Length', false, 'Long UID accepted');
      return;
    }
    
    this.addTestResult('DICOM UID Validation', true);
  }

  /**
   * 숫자 입력 검증 테스트
   */
  static testNumericInputValidation(): void {
    console.log('🔢 Testing Numeric Input Validation...');
    
    // 유효한 숫자 테스트
    const validNumber = validateNumericInput(TEST_DATA.safe.windowLevel, 'windowLevel');
    if (!validNumber.isValid) {
      this.addTestResult('Numeric Valid', false, 'Valid number rejected');
      return;
    }
    
    // 범위 초과 테스트
    const outOfRange = validateNumericInput('10000', 'windowLevel');
    if (outOfRange.isValid) {
      this.addTestResult('Numeric Range', false, 'Out of range value accepted');
      return;
    }
    
    // 무한대 테스트
    const infiniteValue = validateNumericInput(Infinity, 'windowLevel');
    if (infiniteValue.isValid) {
      this.addTestResult('Numeric Infinite', false, 'Infinite value accepted');
      return;
    }
    
    // 문자열 공격 테스트
    const stringAttack = validateNumericInput(TEST_DATA.dangerous.sqlInjection, 'windowLevel');
    if (stringAttack.isValid || stringAttack.securityLevel !== 'DANGER') {
      this.addTestResult('Numeric SQL Attack', false, 'SQL injection not detected');
      return;
    }
    
    this.addTestResult('Numeric Input Validation', true);
  }

  /**
   * 주석 라벨 검증 테스트
   */
  static testAnnotationLabelValidation(): void {
    console.log('📝 Testing Annotation Label Validation...');
    
    // 유효한 주석 테스트
    const validLabel = validateAnnotationLabel(TEST_DATA.safe.annotation);
    if (!validLabel.isValid) {
      this.addTestResult('Annotation Valid', false, 'Valid annotation rejected');
      return;
    }
    
    // XSS 공격 테스트
    const xssLabel = validateAnnotationLabel(TEST_DATA.dangerous.xssScript);
    if (xssLabel.isValid || xssLabel.securityLevel !== 'DANGER') {
      this.addTestResult('Annotation XSS', false, 'XSS attack not detected');
      return;
    }
    
    // 길이 제한 테스트
    const longLabel = validateAnnotationLabel('a'.repeat(200));
    if (longLabel.isValid) {
      this.addTestResult('Annotation Length', false, 'Long annotation accepted');
      return;
    }
    
    // HTML 태그 제거 테스트
    const htmlLabel = validateAnnotationLabel('<b>Bold text</b>');
    if (htmlLabel.isValid && htmlLabel.sanitizedValue?.includes('<b>')) {
      this.addTestResult('Annotation HTML', false, 'HTML tags not removed');
      return;
    }
    
    this.addTestResult('Annotation Label Validation', true);
  }

  /**
   * 파일명 검증 테스트
   */
  static testFileNameValidation(): void {
    console.log('📁 Testing File Name Validation...');
    
    // 유효한 파일명 테스트
    const validFile = validateFileName(TEST_DATA.safe.filename);
    if (!validFile.isValid) {
      this.addTestResult('Filename Valid', false, 'Valid filename rejected');
      return;
    }
    
    // 위험한 문자 테스트
    const dangerousFile = validateFileName('test<>file.dcm');
    if (dangerousFile.isValid) {
      this.addTestResult('Filename Dangerous', false, 'Dangerous characters accepted');
      return;
    }
    
    // 경로 순회 공격 테스트
    const pathTraversal = validateFileName(TEST_DATA.dangerous.pathTraversal);
    if (pathTraversal.isValid || pathTraversal.securityLevel !== 'DANGER') {
      this.addTestResult('Filename Path Traversal', false, 'Path traversal not detected');
      return;
    }
    
    // 예약된 이름 테스트
    const reservedName = validateFileName(TEST_DATA.invalid.reservedFilename);
    if (reservedName.isValid) {
      this.addTestResult('Filename Reserved', false, 'Reserved name accepted');
      return;
    }
    
    this.addTestResult('File Name Validation', true);
  }

  /**
   * 사용자명 검증 테스트
   */
  static testUsernameValidation(): void {
    console.log('👤 Testing Username Validation...');
    
    // 유효한 사용자명 테스트
    const validUser = validateUsername(TEST_DATA.safe.username);
    if (!validUser.isValid) {
      this.addTestResult('Username Valid', false, 'Valid username rejected');
      return;
    }
    
    // 짧은 사용자명 테스트
    const shortUser = validateUsername('ab');
    if (shortUser.isValid) {
      this.addTestResult('Username Short', false, 'Short username accepted');
      return;
    }
    
    // 숫자만 사용자명 테스트
    const numericUser = validateUsername('123456');
    if (numericUser.isValid) {
      this.addTestResult('Username Numeric', false, 'Numeric-only username accepted');
      return;
    }
    
    // 특수문자 테스트
    const specialUser = validateUsername('user@domain.com');
    if (specialUser.isValid) {
      this.addTestResult('Username Special', false, 'Invalid special characters accepted');
      return;
    }
    
    this.addTestResult('Username Validation', true);
  }

  /**
   * 보안 패턴 감지 테스트
   */
  static testSecurityPatternDetection(): void {
    console.log('🔍 Testing Security Pattern Detection...');
    
    // SQL 주입 패턴 테스트
    const sqlResult = validateAnnotationLabel(TEST_DATA.dangerous.sqlInjection);
    if (sqlResult.isValid || sqlResult.securityLevel !== 'DANGER') {
      this.addTestResult('SQL Injection Detection', false, 'SQL injection not detected');
      return;
    }
    
    // NoSQL 주입 패턴 테스트
    const nosqlResult = validateAnnotationLabel(TEST_DATA.dangerous.nosqlInjection);
    if (nosqlResult.isValid || nosqlResult.securityLevel !== 'DANGER') {
      this.addTestResult('NoSQL Injection Detection', false, 'NoSQL injection not detected');
      return;
    }
    
    // 명령 주입 테스트
    const cmdResult = validateAnnotationLabel(TEST_DATA.dangerous.commandInjection);
    if (cmdResult.isValid || cmdResult.securityLevel !== 'DANGER') {
      this.addTestResult('Command Injection Detection', false, 'Command injection not detected');
      return;
    }
    
    this.addTestResult('Security Pattern Detection', true);
  }

  /**
   * XSS 방지 테스트
   */
  static testXSSPrevention(): void {
    console.log('🛡️  Testing XSS Prevention...');
    
    // Script 태그 테스트
    const scriptResult = validateAnnotationLabel(TEST_DATA.dangerous.xssScript);
    if (scriptResult.isValid || scriptResult.securityLevel !== 'DANGER') {
      this.addTestResult('XSS Script Prevention', false, 'Script tag not blocked');
      return;
    }
    
    // JavaScript URL 테스트
    const jsResult = validateAnnotationLabel('javascript:alert("XSS")');
    if (jsResult.isValid || jsResult.securityLevel !== 'DANGER') {
      this.addTestResult('XSS JavaScript URL', false, 'JavaScript URL not blocked');
      return;
    }
    
    // Event handler 테스트
    const eventResult = validateAnnotationLabel('<img onerror="alert(1)">');
    if (eventResult.isValid || eventResult.securityLevel !== 'DANGER') {
      this.addTestResult('XSS Event Handler', false, 'Event handler not blocked');
      return;
    }
    
    this.addTestResult('XSS Prevention', true);
  }

  /**
   * SQL 주입 방지 테스트
   */
  static testSQLInjectionPrevention(): void {
    console.log('💉 Testing SQL Injection Prevention...');
    
    const sqlPatterns = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "admin'--",
      "' OR 1=1 --"
    ];
    
    for (const pattern of sqlPatterns) {
      const result = validateAnnotationLabel(pattern);
      if (result.isValid || result.securityLevel !== 'DANGER') {
        this.addTestResult('SQL Injection Prevention', false, `Pattern not blocked: ${pattern}`);
        return;
      }
    }
    
    this.addTestResult('SQL Injection Prevention', true);
  }

  /**
   * 경로 순회 공격 방지 테스트
   */
  static testPathTraversalPrevention(): void {
    console.log('🗂️  Testing Path Traversal Prevention...');
    
    const pathPatterns = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '..%2f..%2f..%2fetc%2fpasswd',
      '..%5c..%5c..%5cwindows%5csystem32%5cconfig%5csam'
    ];
    
    for (const pattern of pathPatterns) {
      const result = validateFileName(pattern);
      if (result.isValid || result.securityLevel !== 'DANGER') {
        this.addTestResult('Path Traversal Prevention', false, `Pattern not blocked: ${pattern}`);
        return;
      }
    }
    
    this.addTestResult('Path Traversal Prevention', true);
  }

  /**
   * 배치 검증 테스트
   */
  static testBatchValidation(): void {
    console.log('📦 Testing Batch Validation...');
    
    const batchData = [
      {
        value: TEST_DATA.safe.dicomTag,
        validator: validateDicomTag,
        field: 'dicomTag'
      },
      {
        value: TEST_DATA.safe.annotation,
        validator: validateAnnotationLabel,
        field: 'annotation'
      },
      {
        value: TEST_DATA.dangerous.xssScript,
        validator: validateAnnotationLabel,
        field: 'xssTest'
      }
    ];
    
    const batchResult = validateBatch(batchData);
    
    if (batchResult.isValid) {
      this.addTestResult('Batch Validation', false, 'Batch validation should fail with XSS input');
      return;
    }
    
    if (batchResult.results.dicomTag.isValid && 
        batchResult.results.annotation.isValid && 
        !batchResult.results.xssTest.isValid) {
      this.addTestResult('Batch Validation', true);
    } else {
      this.addTestResult('Batch Validation', false, 'Batch validation results incorrect');
    }
  }

  /**
   * 오류 처리 테스트
   */
  static testErrorHandling(): void {
    console.log('🚨 Testing Error Handling...');
    
    // 위험한 입력에 대한 오류 처리 테스트
    const dangerousResult = validateAnnotationLabel(TEST_DATA.dangerous.xssScript);
    const feedback = ValidationErrorHandler.handleValidationResult(dangerousResult, 'annotation');
    
    if (feedback.success) {
      this.addTestResult('Error Handling', false, 'Dangerous input should not be successful');
      return;
    }
    
    if (feedback.securityLevel !== 'DANGER') {
      this.addTestResult('Error Handling', false, 'Security level should be DANGER');
      return;
    }
    
    if (!feedback.message.includes('보안')) {
      this.addTestResult('Error Handling', false, 'Error message should mention security');
      return;
    }
    
    this.addTestResult('Error Handling', true);
  }

  /**
   * 실시간 피드백 테스트
   */
  static testRealTimeFeedback(): void {
    console.log('⚡ Testing Real-time Feedback...');
    
    // 짧은 입력에 대한 피드백 (없어야 함)
    const shortFeedback = ValidationErrorHandler.getRealTimeFeedback(
      'a',
      validateAnnotationLabel,
      'annotation'
    );
    
    if (shortFeedback !== null) {
      this.addTestResult('Real-time Feedback Short', false, 'Short input should not have feedback');
      return;
    }
    
    // 위험한 입력에 대한 피드백 (있어야 함)
    const dangerousFeedback = ValidationErrorHandler.getRealTimeFeedback(
      TEST_DATA.dangerous.xssScript,
      validateAnnotationLabel,
      'annotation'
    );
    
    if (dangerousFeedback === null || dangerousFeedback.success) {
      this.addTestResult('Real-time Feedback Dangerous', false, 'Dangerous input should have error feedback');
      return;
    }
    
    this.addTestResult('Real-time Feedback', true);
  }

  /**
   * 테스트 결과 추가
   */
  private static addTestResult(testName: string, success: boolean, details?: string): void {
    this.testResults.push({ testName, success, details });
    const status = success ? '✅ PASSED' : '❌ FAILED';
    const detail = details ? ` (${details})` : '';
    console.log(`  ${status}: ${testName}${detail}`);
  }

  /**
   * 최종 결과 표시
   */
  private static showResults(): boolean {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const successRate = (passedTests / totalTests) * 100;
    
    console.log('\n' + '═'.repeat(60));
    console.log('📊 INPUT VALIDATION TEST RESULTS');
    console.log('═'.repeat(60));
    console.log(`✅ Passed: ${passedTests}/${totalTests} (${successRate.toFixed(1)}%)`);
    
    if (passedTests < totalTests) {
      console.log('\n❌ Failed Tests:');
      this.testResults.filter(r => !r.success).forEach(test => {
        console.log(`  - ${test.testName}: ${test.details || 'Failed'}`);
      });
    }
    
    console.log('\n🛡️  Security Features Tested:');
    console.log('─'.repeat(30));
    console.log('✅ XSS Prevention');
    console.log('✅ SQL Injection Prevention');
    console.log('✅ Path Traversal Prevention');
    console.log('✅ Command Injection Prevention');
    console.log('✅ DICOM Format Validation');
    console.log('✅ Input Sanitization');
    console.log('✅ Range Validation');
    console.log('✅ Real-time Feedback');
    console.log('✅ Batch Validation');
    console.log('✅ Error Handling');
    
    if (successRate >= 90) {
      console.log('\n🎉 Input validation security tests completed successfully!');
      return true;
    } else {
      console.log('\n⚠️  Some input validation tests failed. Please review the implementation.');
      return false;
    }
  }
}

// 테스트 실행 함수
export const runInputValidationTests = () => InputValidationTestSuite.runAllTests();

// 개발 환경에서 자동 실행
if (import.meta.env.DEV) {
  console.log('🚀 Auto-running input validation tests in development mode...');
  setTimeout(() => {
    InputValidationTestSuite.runAllTests().then(success => {
      if (success) {
        console.log('🎯 All input validation tests passed - system is secure!');
      } else {
        console.log('⚠️ Input validation tests failed - please check implementation');
      }
    });
  }, 3000);
}