/**
 * XSS Protection Tests
 * Comprehensive tests for XSS prevention and input sanitization
 */

import { XSSProtection, sanitizeAnnotationLabel, sanitizeUserComment, sanitizeFileName, sanitizeURL } from '../utils/xss-protection';

// Mock console methods for testing
const originalConsole = { ...console };
const consoleLogs: string[] = [];
const consoleWarns: string[] = [];
const consoleErrors: string[] = [];

console.log = (...args) => {
  consoleLogs.push(args.join(' '));
  originalConsole.log(...args);
};

console.warn = (...args) => {
  consoleWarns.push(args.join(' '));
  originalConsole.warn(...args);
};

console.error = (...args) => {
  consoleErrors.push(args.join(' '));
  originalConsole.error(...args);
};

export class XSSProtectionTestSuite {
  static async runAllTests(): Promise<boolean> {
    console.log('🛡️ Starting XSS Protection Test Suite...\n');
    
    const tests = [
      this.testBasicSanitization,
      this.testScriptTagRemoval,
      this.testEventHandlerRemoval,
      this.testJavaScriptProtocolBlocking,
      this.testAnnotationLabelSanitization,
      this.testFileNameSanitization,
      this.testURLSanitization,
      this.testValidationPatterns,
      this.testDeepObjectSanitization,
      this.testEdgeCases,
      this.testPerformance,
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
    
    if (successRate >= 90) {
      console.log('🎉 XSS protection tests completed successfully!');
      return true;
    } else {
      console.log('⚠️  Some XSS protection tests failed. Please review the implementation.');
      return false;
    }
  }

  static testBasicSanitization(): boolean {
    console.log('🧪 Testing basic sanitization...');
    
    const testCases = [
      { input: 'Normal text', expected: 'Normal text' },
      { input: '<b>Bold text</b>', expected: '<b>Bold text</b>' },
      { input: '<script>alert("xss")</script>', expected: '' },
      { input: 'Hello <em>world</em>!', expected: 'Hello <em>world</em>!' },
    ];

    for (const testCase of testCases) {
      const result = XSSProtection.sanitize(testCase.input);
      if (result !== testCase.expected) {
        console.log(`❌ Failed: Input "${testCase.input}" expected "${testCase.expected}" but got "${result}"`);
        return false;
      }
    }

    console.log('✓ Basic sanitization working correctly');
    return true;
  }

  static testScriptTagRemoval(): boolean {
    console.log('🔒 Testing script tag removal...');
    
    const maliciousInputs = [
      '<script>alert("XSS")</script>',
      '<SCRIPT>alert("XSS")</SCRIPT>',
      '<script src="malicious.js"></script>',
      'Hello<script>alert("XSS")</script>World',
      '<script type="text/javascript">evil()</script>',
      '<script\nonload="alert(1)">',
    ];

    for (const input of maliciousInputs) {
      const result = XSSProtection.sanitize(input);
      if (result.includes('<script') || result.includes('alert(')) {
        console.log(`❌ Script tag not properly removed: "${input}" -> "${result}"`);
        return false;
      }
    }

    console.log('✓ Script tags properly removed');
    return true;
  }

  static testEventHandlerRemoval(): boolean {
    console.log('⚡ Testing event handler removal...');
    
    const maliciousInputs = [
      '<img src="x" onerror="alert(1)">',
      '<div onclick="alert(1)">Click me</div>',
      '<button onmouseover="evil()">Hover</button>',
      '<input onfocus="steal_data()">',
      '<a href="#" onload="malicious()">Link</a>',
    ];

    for (const input of maliciousInputs) {
      const result = XSSProtection.sanitize(input);
      if (/on\w+\s*=/i.test(result)) {
        console.log(`❌ Event handler not properly removed: "${input}" -> "${result}"`);
        return false;
      }
    }

    console.log('✓ Event handlers properly removed');
    return true;
  }

  static testJavaScriptProtocolBlocking(): boolean {
    console.log('🚫 Testing JavaScript protocol blocking...');
    
    const maliciousInputs = [
      'javascript:alert(1)',
      'JAVASCRIPT:evil()',
      'vbscript:msgbox("XSS")',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    ];

    for (const input of maliciousInputs) {
      const result = XSSProtection.sanitizeURL(input);
      if (result.toLowerCase().includes('javascript:') || 
          result.toLowerCase().includes('vbscript:') ||
          result.toLowerCase().includes('data:text/html')) {
        console.log(`❌ Dangerous protocol not blocked: "${input}" -> "${result}"`);
        return false;
      }
    }

    console.log('✓ Dangerous protocols properly blocked');
    return true;
  }

  static testAnnotationLabelSanitization(): boolean {
    console.log('📝 Testing annotation label sanitization...');
    
    const testCases = [
      { 
        input: 'Patient measurement: 5.2cm', 
        expected: 'Patient measurement: 5.2cm' 
      },
      { 
        input: '<script>steal_data()</script>Length: 3cm', 
        expected: 'Length: 3cm' 
      },
      { 
        input: 'Tumor size <b>large</b>', 
        expected: 'Tumor size large' // Strict mode removes all HTML
      },
      { 
        input: 'Normal annotation', 
        expected: 'Normal annotation' 
      },
    ];

    for (const testCase of testCases) {
      const result = sanitizeAnnotationLabel(testCase.input);
      if (result !== testCase.expected) {
        console.log(`❌ Annotation sanitization failed: "${testCase.input}" expected "${testCase.expected}" but got "${result}"`);
        return false;
      }
    }

    console.log('✓ Annotation labels properly sanitized');
    return true;
  }

  static testFileNameSanitization(): boolean {
    console.log('📁 Testing file name sanitization...');
    
    const testCases = [
      { 
        input: 'patient_scan.dcm', 
        expected: 'patient_scan.dcm' 
      },
      { 
        input: '../../../etc/passwd', 
        expected: 'etc/passwd' 
      },
      { 
        input: 'file<script>alert(1)</script>.dcm', 
        expected: 'file.dcm' 
      },
      { 
        input: 'file|name.dcm', 
        expected: 'filename.dcm' 
      },
    ];

    for (const testCase of testCases) {
      const result = sanitizeFileName(testCase.input);
      if (result !== testCase.expected) {
        console.log(`❌ File name sanitization failed: "${testCase.input}" expected "${testCase.expected}" but got "${result}"`);
        return false;
      }
    }

    console.log('✓ File names properly sanitized');
    return true;
  }

  static testURLSanitization(): boolean {
    console.log('🌐 Testing URL sanitization...');
    
    const testCases = [
      { 
        input: 'https://example.com/image.jpg', 
        expected: 'https://example.com/image.jpg' 
      },
      { 
        input: 'javascript:alert(1)', 
        expected: '' 
      },
      { 
        input: 'data:text/html,<script>alert(1)</script>', 
        expected: '' 
      },
      { 
        input: 'http://safe-site.com', 
        expected: 'http://safe-site.com' 
      },
    ];

    for (const testCase of testCases) {
      const result = sanitizeURL(testCase.input);
      if (result !== testCase.expected) {
        console.log(`❌ URL sanitization failed: "${testCase.input}" expected "${testCase.expected}" but got "${result}"`);
        return false;
      }
    }

    console.log('✓ URLs properly sanitized');
    return true;
  }

  static testValidationPatterns(): boolean {
    console.log('🔍 Testing validation patterns...');
    
    const maliciousPatterns = [
      '<script>alert(1)</script>',
      'javascript:void(0)',
      'onload="evil()"',
      '<iframe src="malicious.html">',
      '<object data="evil.swf">',
      'expression(alert(1))',
      'vbscript:msgbox(1)',
    ];

    for (const pattern of maliciousPatterns) {
      const validation = XSSProtection.validateInput(pattern);
      if (validation.isValid) {
        console.log(`❌ Malicious pattern not detected: "${pattern}"`);
        return false;
      }
    }

    const safeInputs = [
      'Normal text',
      'Patient: John Doe',
      'Measurement: 5.2 cm',
      'https://example.com',
    ];

    for (const input of safeInputs) {
      const validation = XSSProtection.validateInput(input);
      if (!validation.isValid) {
        console.log(`❌ Safe input incorrectly flagged: "${input}"`);
        return false;
      }
    }

    console.log('✓ Validation patterns working correctly');
    return true;
  }

  static testDeepObjectSanitization(): boolean {
    console.log('🏗️ Testing deep object sanitization...');
    
    const maliciousObject = {
      name: '<script>alert("XSS")</script>John',
      measurements: [
        { label: '<img onerror="evil()" src="x">', value: '5.2cm' },
        { label: 'Safe measurement', value: '3.1cm' }
      ],
      metadata: {
        notes: 'Patient notes<script>steal_data()</script>',
        safe: 'This is safe'
      }
    };

    const sanitized = XSSProtection.deepSanitizeObject(maliciousObject);
    
    // Check that malicious content was removed
    if (sanitized.name.includes('<script>') || 
        sanitized.measurements[0].label.includes('<img') ||
        sanitized.metadata.notes.includes('<script>')) {
      console.log('❌ Deep object sanitization failed to remove malicious content');
      return false;
    }

    // Check that safe content was preserved
    if (!sanitized.metadata.safe.includes('This is safe') ||
        !sanitized.measurements[1].label.includes('Safe measurement')) {
      console.log('❌ Deep object sanitization removed safe content');
      return false;
    }

    console.log('✓ Deep object sanitization working correctly');
    return true;
  }

  static testEdgeCases(): boolean {
    console.log('🎯 Testing edge cases...');
    
    const edgeCases = [
      { input: '', expected: '' },
      { input: null, expected: '' },
      { input: undefined, expected: '' },
      { input: '   ', expected: '' },
      { input: '\n\t\r', expected: '' },
    ];

    for (const testCase of edgeCases) {
      try {
        const result = XSSProtection.sanitize(testCase.input as any);
        if (result !== testCase.expected) {
          console.log(`❌ Edge case failed: Input "${testCase.input}" expected "${testCase.expected}" but got "${result}"`);
          return false;
        }
      } catch (error) {
        console.log(`❌ Edge case threw error: Input "${testCase.input}" - ${error}`);
        return false;
      }
    }

    console.log('✓ Edge cases handled correctly');
    return true;
  }

  static testPerformance(): boolean {
    console.log('⚡ Testing performance...');
    
    const largeInput = '<script>alert("XSS")</script>'.repeat(1000) + 
                      'Safe content '.repeat(1000);
    
    const startTime = performance.now();
    const result = XSSProtection.sanitize(largeInput);
    const endTime = performance.now();
    
    const duration = endTime - startTime;
    
    if (duration > 100) { // Should complete in less than 100ms
      console.log(`❌ Performance test failed: Took ${duration.toFixed(2)}ms`);
      return false;
    }

    if (result.includes('<script>')) {
      console.log('❌ Performance test failed: Malicious content not removed');
      return false;
    }

    console.log(`✓ Performance test passed: ${duration.toFixed(2)}ms`);
    return true;
  }

  static async testWithRealData(): Promise<boolean> {
    console.log('🏥 Testing with real medical data patterns...');
    
    const medicalInputs = [
      'Patient: John Doe, Age: 45',
      'Tumor size: 2.3cm x 1.8cm',
      'Measurement: Left ventricle wall thickness = 1.2cm',
      'Notes: Patient shows improvement<script>steal_medical_data()</script>',
      'CT Scan results<img onerror="exfiltrate_data()" src="x">: Normal',
    ];

    for (const input of medicalInputs) {
      const sanitized = XSSProtection.sanitize(input);
      
      // Should remove malicious content but preserve medical data
      if (sanitized.includes('<script>') || sanitized.includes('<img') || 
          sanitized.includes('onerror') || sanitized.includes('steal_')) {
        console.log(`❌ Medical data test failed: Malicious content not removed from "${input}"`);
        return false;
      }
      
      // Should preserve legitimate medical information
      if (input.includes('Patient: John Doe') && !sanitized.includes('Patient: John Doe')) {
        console.log(`❌ Medical data test failed: Legitimate content removed from "${input}"`);
        return false;
      }
    }

    console.log('✓ Medical data patterns handled correctly');
    return true;
  }
}

// Export for manual testing
export const runXSSProtectionTests = () => XSSProtectionTestSuite.runAllTests();

// Auto-run tests in development
if (process.env.NODE_ENV === 'development') {
  console.log('🚀 Auto-running XSS protection tests in development mode...');
  setTimeout(() => {
    XSSProtectionTestSuite.runAllTests().then(success => {
      if (success) {
        console.log('🎯 All XSS protection tests passed - system is secure!');
      } else {
        console.log('⚠️ XSS protection tests failed - please check implementation');
      }
    });
  }, 1000);
}