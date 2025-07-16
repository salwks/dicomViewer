/**
 * Security Headers Test Runner
 * Runs security headers tests and validation
 */

import { SecurityHeadersTestSuite } from './src/tests/security-headers.test.ts';
import { SecurityHeadersChecker } from './src/utils/security-headers-checker.ts';

async function runSecurityTests() {
  console.log('🛡️  Starting Security Headers Validation...\n');
  
  try {
    // Run test suite
    const testResults = await SecurityHeadersTestSuite.runAllTests();
    
    console.log('\n' + '='.repeat(60));
    console.log('🔍 Running Security Headers Assessment...');
    console.log('='.repeat(60));
    
    // Run security assessment
    const assessment = await SecurityHeadersChecker.checkCurrentPage();
    SecurityHeadersChecker.printAssessment(assessment);
    
    // Final results
    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL RESULTS');
    console.log('='.repeat(60));
    
    if (testResults && assessment.score >= 90) {
      console.log('✅ Security Headers Implementation: PASSED');
      console.log(`✅ Security Score: ${assessment.score}/100 (${assessment.grade})`);
      console.log(`✅ Medical Compliance: ${assessment.medicalCompliance ? 'COMPLIANT' : 'NON-COMPLIANT'}`);
      console.log(`✅ HIPAA Compliance: ${assessment.hipaaCompliant ? 'COMPLIANT' : 'NON-COMPLIANT'}`);
      console.log('\n🎉 Task 14 (보안 HTTP 헤더 적용) COMPLETED SUCCESSFULLY!');
      process.exit(0);
    } else {
      console.log('❌ Security Headers Implementation: FAILED');
      console.log('⚠️  Please review the security configuration');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error running security tests:', error);
    process.exit(1);
  }
}

runSecurityTests();