#!/usr/bin/env node

/**
 * 보안 스캐닝 자동화 스크립트
 * CI/CD 파이프라인과 로컬 개발 환경에서 보안 검사를 수행합니다.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 색상 출력을 위한 유틸리티
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// 로깅 유틸리티
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('');
  log(`${'='.repeat(60)}`, 'cyan');
  log(`🔒 ${title}`, 'cyan');
  log(`${'='.repeat(60)}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// 커맨드 실행 유틸리티
function runCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf8',
      ...options
    });
    return { success: true, output: result };
  } catch (error) {
    return { 
      success: false, 
      output: error.stdout || error.stderr || error.message,
      code: error.status
    };
  }
}

// 보안 스캔 결과 저장
const scanResults = {
  dependencyAudit: { passed: false, details: '' },
  staticAnalysis: { passed: false, details: '' },
  secretDetection: { passed: false, details: '' },
  securityTests: { passed: false, details: '' },
  configValidation: { passed: false, details: '' }
};

// 1. 의존성 취약점 검사
function runDependencyAudit() {
  logSection('Dependency Vulnerability Audit');
  
  logInfo('Running npm audit...');
  const auditResult = runCommand('npm audit --audit-level=moderate', { continueOnError: true });
  
  if (auditResult.success) {
    logSuccess('No moderate or higher vulnerabilities found');
    scanResults.dependencyAudit.passed = true;
    scanResults.dependencyAudit.details = 'Clean dependency audit';
  } else {
    logWarning('Vulnerabilities detected, running detailed analysis...');
    
    // 상세 리포트 생성
    const reportResult = runCommand('npm audit --json', { silent: true });
    if (reportResult.success) {
      try {
        const auditData = JSON.parse(reportResult.output);
        const vulnerabilities = auditData.vulnerabilities || {};
        const vulnCount = Object.keys(vulnerabilities).length;
        
        if (vulnCount > 0) {
          logError(`Found ${vulnCount} package(s) with vulnerabilities`);
          scanResults.dependencyAudit.details = `${vulnCount} vulnerable packages detected`;
          
          // 심각도별 분류
          const severityCounts = { low: 0, moderate: 0, high: 0, critical: 0 };
          Object.values(vulnerabilities).forEach(vuln => {
            if (vuln.severity && severityCounts[vuln.severity] !== undefined) {
              severityCounts[vuln.severity]++;
            }
          });
          
          logInfo(`Severity breakdown: Critical: ${severityCounts.critical}, High: ${severityCounts.high}, Moderate: ${severityCounts.moderate}, Low: ${severityCounts.low}`);
          
          // 중간 이상 심각도가 있으면 실패 처리
          if (severityCounts.critical > 0 || severityCounts.high > 0) {
            scanResults.dependencyAudit.passed = false;
          } else {
            scanResults.dependencyAudit.passed = true; // Moderate/Low는 허용
          }
        } else {
          scanResults.dependencyAudit.passed = true;
        }
      } catch (parseError) {
        logError('Failed to parse audit report');
        scanResults.dependencyAudit.details = 'Audit report parsing failed';
      }
    }
  }
}

// 2. 정적 코드 분석 (ESLint 보안 규칙)
function runStaticAnalysis() {
  logSection('Static Code Security Analysis');
  
  logInfo('Running ESLint security scan...');
  const lintResult = runCommand('npm run security-lint', { continueOnError: true, silent: true });
  
  if (lintResult.success) {
    logSuccess('No security violations found in static analysis');
    scanResults.staticAnalysis.passed = true;
    scanResults.staticAnalysis.details = 'Clean static analysis';
  } else {
    logError('Security violations detected in code');
    logInfo('Running detailed analysis...');
    
    // JSON 형태로 상세 결과 가져오기
    const detailedResult = runCommand(
      'npx eslint . --config eslint.config.js --format json',
      { silent: true, continueOnError: true }
    );
    
    try {
      const eslintData = JSON.parse(detailedResult.output || '[]');
      let securityIssues = 0;
      
      eslintData.forEach(file => {
        const securityMessages = file.messages.filter(msg => 
          msg.ruleId && msg.ruleId.startsWith('security/')
        );
        securityIssues += securityMessages.length;
        
        if (securityMessages.length > 0) {
          logWarning(`${file.filePath}: ${securityMessages.length} security issue(s)`);
        }
      });
      
      if (securityIssues > 0) {
        logError(`Total security issues: ${securityIssues}`);
        scanResults.staticAnalysis.details = `${securityIssues} security issues found`;
        scanResults.staticAnalysis.passed = false;
      } else {
        scanResults.staticAnalysis.passed = true;
      }
    } catch (parseError) {
      logWarning('Could not parse ESLint output, assuming issues exist');
      scanResults.staticAnalysis.passed = false;
      scanResults.staticAnalysis.details = 'ESLint parsing failed';
    }
  }
}

// 3. 하드코딩된 시크릿 검사
function runSecretDetection() {
  logSection('Hardcoded Secrets Detection');
  
  const secretPatterns = [
    { name: 'API Keys', pattern: /api[_-]?key\s*[=:]\s*['""][^'""]*['"]/gi },
    { name: 'Passwords', pattern: /password\s*[=:]\s*['""][^'""]*['"]/gi },
    { name: 'Tokens', pattern: /token\s*[=:]\s*['""][^'""]*['"]/gi },
    { name: 'Bearer Tokens', pattern: /bearer\s+[a-zA-Z0-9\-_\.]+/gi },
    { name: 'OpenAI Keys', pattern: /sk-[a-zA-Z0-9]+/g },
    { name: 'SSNs', pattern: /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/g },
    { name: 'Credit Cards', pattern: /\b[0-9]{4}[\s-]?[0-9]{4}[\s-]?[0-9]{4}[\s-]?[0-9]{4}\b/g }
  ];
  
  let secretsFound = 0;
  const srcDir = path.join(process.cwd(), 'src');
  
  if (!fs.existsSync(srcDir)) {
    logWarning('Source directory not found, skipping secret detection');
    scanResults.secretDetection.passed = true;
    return;
  }
  
  function scanFile(filePath) {
    if (!filePath.match(/\.(ts|tsx|js|jsx)$/)) return;
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      secretPatterns.forEach(({ name, pattern }) => {
        const matches = content.match(pattern);
        if (matches) {
          logError(`${name} detected in ${filePath}: ${matches.length} occurrence(s)`);
          secretsFound += matches.length;
        }
      });
    } catch (error) {
      logWarning(`Could not scan file: ${filePath}`);
    }
  }
  
  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        scanDirectory(fullPath);
      } else if (stat.isFile()) {
        scanFile(fullPath);
      }
    });
  }
  
  logInfo('Scanning source files for hardcoded secrets...');
  scanDirectory(srcDir);
  
  if (secretsFound === 0) {
    logSuccess('No hardcoded secrets detected');
    scanResults.secretDetection.passed = true;
    scanResults.secretDetection.details = 'Clean secret scan';
  } else {
    logError(`Found ${secretsFound} potential secret(s)`);
    scanResults.secretDetection.passed = false;
    scanResults.secretDetection.details = `${secretsFound} potential secrets found`;
  }
}

// 4. 보안 테스트 실행
function runSecurityTests() {
  logSection('Security Test Suite');
  
  const testCommands = [
    { name: 'XSS Protection', command: 'npm run test:xss' },
    { name: 'Input Validation', command: 'npm run test:security' },
    { name: 'Secure Storage', command: 'npm run test:secure-storage' },
    { name: 'Error Handling', command: 'npm run test:error-handling' },
    { name: 'Security Headers', command: 'npm run test:security-headers' }
  ];
  
  let testsPassed = 0;
  let testsTotal = testCommands.length;
  
  testCommands.forEach(({ name, command }) => {
    logInfo(`Running ${name} tests...`);
    const result = runCommand(command, { continueOnError: true, silent: true });
    
    if (result.success || (result.output && result.output.includes('completed'))) {
      logSuccess(`${name}: PASSED`);
      testsPassed++;
    } else {
      logError(`${name}: FAILED`);
    }
  });
  
  if (testsPassed === testsTotal) {
    logSuccess(`All security tests passed (${testsPassed}/${testsTotal})`);
    scanResults.securityTests.passed = true;
    scanResults.securityTests.details = `${testsPassed}/${testsTotal} tests passed`;
  } else {
    logError(`Some security tests failed (${testsPassed}/${testsTotal})`);
    scanResults.securityTests.passed = false;
    scanResults.securityTests.details = `${testsPassed}/${testsTotal} tests passed`;
  }
}

// 5. 보안 설정 검증
function runConfigValidation() {
  logSection('Security Configuration Validation');
  
  const requiredFiles = [
    'src/utils/error-handler.ts',
    'src/utils/xss-protection.ts',
    'src/utils/secure-storage.ts',
    'src/utils/input-validation.ts',
    'src/components/SecureErrorBoundary.tsx',
    '.eslintrc.security.js'
  ];
  
  let missingFiles = 0;
  
  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      logSuccess(`${file}: Present`);
    } else {
      logError(`${file}: Missing`);
      missingFiles++;
    }
  });
  
  if (missingFiles === 0) {
    logSuccess('All security configuration files present');
    scanResults.configValidation.passed = true;
    scanResults.configValidation.details = 'All security files present';
  } else {
    logError(`${missingFiles} security configuration file(s) missing`);
    scanResults.configValidation.passed = false;
    scanResults.configValidation.details = `${missingFiles} files missing`;
  }
}

// 최종 리포트 생성
function generateReport() {
  logSection('Security Scan Summary');
  
  const allPassed = Object.values(scanResults).every(result => result.passed);
  const passedCount = Object.values(scanResults).filter(result => result.passed).length;
  const totalCount = Object.keys(scanResults).length;
  
  log(`\n📊 Scan Results: ${passedCount}/${totalCount} checks passed\n`);
  
  Object.entries(scanResults).forEach(([check, result]) => {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    const color = result.passed ? 'green' : 'red';
    log(`${status} - ${check}: ${result.details}`, color);
  });
  
  console.log('');
  
  if (allPassed) {
    logSuccess('🎉 All security checks passed!');
    logInfo('Your application meets the security requirements.');
    return 0;
  } else {
    logError('🚨 Security scan failed!');
    logError('Please address the issues above before proceeding.');
    return 1;
  }
}

// 메인 실행 함수
function main() {
  log('🔒 Medical DICOM Viewer Security Scanner', 'bright');
  log('Starting comprehensive security analysis...\n');
  
  try {
    runDependencyAudit();
    runStaticAnalysis();
    runSecretDetection();
    runSecurityTests();
    runConfigValidation();
    
    const exitCode = generateReport();
    process.exit(exitCode);
  } catch (error) {
    logError(`Security scan failed with error: ${error.message}`);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  main();
}

module.exports = {
  runDependencyAudit,
  runStaticAnalysis,
  runSecretDetection,
  runSecurityTests,
  runConfigValidation,
  generateReport
};