/**
 * 보안 스토리지 테스트
 * 암호화된 데이터 저장 및 검색 기능을 검증합니다
 */

import { SecureStorage } from '../utils/secure-storage.js';
import { StorageMigrator } from '../utils/storage-migration.js';

// 테스트 데이터
const TEST_DATA = {
  // 기본 데이터 타입
  basicData: {
    string: 'test string',
    number: 42,
    boolean: true,
    null: null,
    array: [1, 2, 3],
    object: { nested: 'value' }
  },
  
  // 의료 데이터 (민감하지 않은 것들)
  medicalData: {
    studyId: 'STUDY_001',
    seriesId: 'SERIES_001',
    modality: 'CT',
    windowLevel: { width: 400, center: 40 },
    measurements: [
      { id: 'M1', type: 'length', value: 25.5, unit: 'mm' },
      { id: 'M2', type: 'angle', value: 90, unit: 'degrees' }
    ]
  },
  
  // 사용자 설정
  userSettings: {
    theme: 'dark',
    language: 'ko',
    autoSave: true,
    tools: ['zoom', 'pan', 'measure']
  },
  
  // 복잡한 데이터
  complexData: {
    timestamp: Date.now(),
    uuid: 'uuid-1234-5678',
    metadata: {
      version: '1.0.0',
      author: 'system',
      tags: ['test', 'security', 'storage']
    }
  }
};

// 테스트 결과 인터페이스
interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  duration: number;
  error?: string;
}

// 테스트 실행기
class SecureStorageTestRunner {
  private results: TestResult[] = [];
  private testsPassed = 0;
  private testsFailed = 0;

  // 테스트 실행
  async runAllTests(): Promise<void> {
    console.log('🔐 SECURE STORAGE TEST SUITE');
    console.log('='.repeat(60));

    await this.testBasicEncryption();
    await this.testDataTypes();
    await this.testErrorHandling();
    await this.testStorageSize();
    await this.testDataValidation();
    await this.testMigration();
    await this.testPerformance();
    await this.testSecurity();

    this.printResults();
  }

  // 기본 암호화/복호화 테스트
  private async testBasicEncryption(): Promise<void> {
    const testName = 'Basic Encryption/Decryption';
    const startTime = performance.now();
    
    try {
      const testKey = 'test_encryption_key';
      const testValue = 'Hello, World!';
      
      // 저장
      SecureStorage.secureStore(testValue, testKey);
      
      // 불러오기
      const retrieved = SecureStorage.secureRetrieve(testKey);
      
      // 검증
      const success = retrieved === testValue;
      
      // 정리
      SecureStorage.secureRemove(testKey);
      
      this.addResult({
        testName,
        passed: success,
        details: success ? 'Encryption/decryption successful' : 'Data mismatch',
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

  // 다양한 데이터 타입 테스트
  private async testDataTypes(): Promise<void> {
    const testName = 'Data Types Support';
    const startTime = performance.now();
    
    try {
      const testKey = 'test_data_types';
      const testData = TEST_DATA.basicData;
      
      // 저장
      SecureStorage.secureStore(testData, testKey);
      
      // 불러오기
      const retrieved = SecureStorage.secureRetrieve(testKey);
      
      // 검증
      const success = JSON.stringify(retrieved) === JSON.stringify(testData);
      
      // 정리
      SecureStorage.secureRemove(testKey);
      
      this.addResult({
        testName,
        passed: success,
        details: success ? 'All data types preserved' : 'Data type mismatch',
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

  // 에러 처리 테스트
  private async testErrorHandling(): Promise<void> {
    const testName = 'Error Handling';
    const startTime = performance.now();
    
    try {
      let errorTests = 0;
      let passedTests = 0;
      
      // 1. 존재하지 않는 키 조회
      const nonExistent = SecureStorage.secureRetrieve('non_existent_key');
      if (nonExistent === null) passedTests++;
      errorTests++;
      
      // 2. 잘못된 데이터 저장 시도
      try {
        const circularObj: any = {};
        circularObj.self = circularObj;
        SecureStorage.secureStore(circularObj, 'circular_test');
        // 저장이 성공하면 안됨
      } catch (error) {
        passedTests++;
      }
      errorTests++;
      
      // 3. 빈 키로 저장 시도
      try {
        SecureStorage.secureStore('test', '');
        // 저장이 성공하면 안됨
      } catch (error) {
        passedTests++;
      }
      errorTests++;
      
      const success = passedTests === errorTests;
      
      this.addResult({
        testName,
        passed: success,
        details: `${passedTests}/${errorTests} error cases handled correctly`,
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

  // 저장소 크기 테스트
  private async testStorageSize(): Promise<void> {
    const testName = 'Storage Size Management';
    const startTime = performance.now();
    
    try {
      const testKey = 'test_storage_size';
      const testData = TEST_DATA.medicalData;
      
      // 저장 전 크기
      const sizeBefore = SecureStorage.getStorageSize(testKey);
      
      // 저장
      SecureStorage.secureStore(testData, testKey);
      
      // 저장 후 크기
      const sizeAfter = SecureStorage.getStorageSize(testKey);
      
      // 데이터 존재 확인
      const hasData = SecureStorage.hasData(testKey);
      
      // 메타데이터 확인
      const metadata = SecureStorage.getMetadata(testKey);
      
      // 정리
      SecureStorage.secureRemove(testKey);
      
      const success = sizeBefore === 0 && sizeAfter > 0 && hasData && metadata !== null;
      
      this.addResult({
        testName,
        passed: success,
        details: success ? 'Storage size management working' : 'Size management failed',
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

  // 데이터 검증 테스트
  private async testDataValidation(): Promise<void> {
    const testName = 'Data Validation';
    const startTime = performance.now();
    
    try {
      let validationTests = 0;
      let passedTests = 0;
      
      // 1. 유효한 데이터 저장
      try {
        SecureStorage.secureStore(TEST_DATA.userSettings, 'valid_data_test');
        SecureStorage.secureRemove('valid_data_test');
        passedTests++;
      } catch (error) {
        // 유효한 데이터 저장이 실패하면 안됨
      }
      validationTests++;
      
      // 2. null/undefined 데이터 저장 시도
      try {
        SecureStorage.secureStore(null, 'null_test');
        // null 저장이 성공하면 안됨
      } catch (error) {
        passedTests++;
      }
      validationTests++;
      
      // 3. 함수 저장 시도
      try {
        SecureStorage.secureStore(() => {}, 'function_test');
        // 함수 저장이 성공하면 안됨
      } catch (error) {
        passedTests++;
      }
      validationTests++;
      
      const success = passedTests === validationTests;
      
      this.addResult({
        testName,
        passed: success,
        details: `${passedTests}/${validationTests} validation tests passed`,
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

  // 마이그레이션 테스트
  private async testMigration(): Promise<void> {
    const testName = 'Data Migration';
    const startTime = performance.now();
    
    try {
      const legacyKey = 'legacy_test_key';
      const newKey = 'secure_test_key';
      const testData = TEST_DATA.complexData;
      
      // 1. 기존 방식으로 데이터 저장
      localStorage.setItem(legacyKey, JSON.stringify(testData));
      
      // 2. 마이그레이션 실행
      const migrationResult = await StorageMigrator.migrateKey(legacyKey, newKey);
      
      // 3. 마이그레이션 결과 확인
      const retrievedData = SecureStorage.secureRetrieve(newKey);
      const legacyDataRemoved = localStorage.getItem(legacyKey) === null;
      
      // 4. 데이터 일치 확인
      const dataMatches = JSON.stringify(retrievedData) === JSON.stringify(testData);
      
      // 정리
      SecureStorage.secureRemove(newKey);
      
      const success = migrationResult && dataMatches && legacyDataRemoved;
      
      this.addResult({
        testName,
        passed: success,
        details: success ? 'Migration successful' : 'Migration failed',
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
      const testData = TEST_DATA.medicalData;
      
      let totalStoreTime = 0;
      let totalRetrieveTime = 0;
      
      for (let i = 0; i < iterations; i++) {
        const key = `perf_test_${i}`;
        
        // 저장 성능 측정
        const storeStart = performance.now();
        SecureStorage.secureStore(testData, key);
        totalStoreTime += performance.now() - storeStart;
        
        // 조회 성능 측정
        const retrieveStart = performance.now();
        SecureStorage.secureRetrieve(key);
        totalRetrieveTime += performance.now() - retrieveStart;
        
        // 정리
        SecureStorage.secureRemove(key);
      }
      
      const avgStoreTime = totalStoreTime / iterations;
      const avgRetrieveTime = totalRetrieveTime / iterations;
      
      // 성능 기준: 평균 10ms 이하
      const success = avgStoreTime < 10 && avgRetrieveTime < 10;
      
      this.addResult({
        testName,
        passed: success,
        details: `Avg store: ${avgStoreTime.toFixed(2)}ms, Avg retrieve: ${avgRetrieveTime.toFixed(2)}ms`,
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

  // 보안 테스트
  private async testSecurity(): Promise<void> {
    const testName = 'Security Features';
    const startTime = performance.now();
    
    try {
      const testKey = 'security_test_key';
      const sensitiveData = {
        username: 'testuser',
        apiKey: 'secret_api_key_123',
        medicalRecord: 'MRN-12345'
      };
      
      // 1. 민감한 데이터 저장
      SecureStorage.secureStore(sensitiveData, testKey);
      
      // 2. localStorage에서 원본 데이터 확인 (암호화되어 있어야 함)
      const storedData = localStorage.getItem(testKey);
      const isEncrypted = storedData && !storedData.includes('testuser') && !storedData.includes('secret_api_key_123');
      
      // 3. 정상적인 복호화 확인
      const retrievedData = SecureStorage.secureRetrieve(testKey);
      const dataMatches = JSON.stringify(retrievedData) === JSON.stringify(sensitiveData);
      
      // 4. 버전 호환성 확인
      const metadata = SecureStorage.getMetadata(testKey);
      const hasVersion = metadata && metadata.version;
      
      // 정리
      SecureStorage.secureRemove(testKey);
      
      const success = isEncrypted && dataMatches && hasVersion;
      
      this.addResult({
        testName,
        passed: success,
        details: success ? 'Security features working' : 'Security validation failed',
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
      console.log('\n🎉 ALL SECURE STORAGE TESTS PASSED!');
      console.log('🔐 Secure storage is working correctly');
    } else {
      console.log('\n⚠️  Some secure storage tests failed');
      console.log('🔧 Please review the implementation');
    }
    
    console.log('\n🔍 Security Features Tested:');
    console.log('- AES encryption/decryption');
    console.log('- Data type preservation');
    console.log('- Error handling');
    console.log('- Storage size management');
    console.log('- Data validation');
    console.log('- Migration from legacy storage');
    console.log('- Performance optimization');
    console.log('- Security and encryption');
  }
}

// 테스트 실행 함수
export async function runSecureStorageTests(): Promise<void> {
  const testRunner = new SecureStorageTestRunner();
  await testRunner.runAllTests();
}

// 개발 환경에서 자동 실행
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  console.log('🔐 Secure Storage Test Suite Loading...');
  
  // 브라우저 환경에서는 전역 함수로 노출
  (window as any).runSecureStorageTests = runSecureStorageTests;
  
  // 자동 실행
  setTimeout(() => {
    runSecureStorageTests();
  }, 3000);
}

// Node.js 환경에서 실행
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runSecureStorageTests };
}

console.log('🔐 Secure Storage Test Suite Ready');
console.log('💡 Run runSecureStorageTests() to execute tests');

export default runSecureStorageTests;