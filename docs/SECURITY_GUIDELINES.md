# Developer Security Guidelines

## 🛡️ Overview

This document provides comprehensive security guidelines for developers working on the DICOM medical imaging viewer application. These guidelines help ensure that all code contributions maintain the highest security standards for handling sensitive medical data.

## 🏗️ Secure Development Principles

### 1. Defense in Depth
- Implement multiple layers of security controls
- Never rely on a single security mechanism
- Validate data at every boundary (client, server, database)

### 2. Principle of Least Privilege
- Grant minimum necessary permissions
- Regularly review and audit access rights
- Use role-based access control (RBAC)

### 3. Fail Securely
- Design systems to fail in a secure state
- Provide meaningful error messages without exposing sensitive information
- Log security events for monitoring and analysis

### 4. Security by Design
- Consider security from the initial design phase
- Perform threat modeling for new features
- Review security implications of architectural decisions

## 🔒 Input Validation and Sanitization

### DICOM Parameter Validation

Always validate DICOM parameters using the provided utilities:

```typescript
import { validateDicomTag, validateNumericInput } from '@/utils/input-validation';

// DICOM tag validation
const isValidTag = validateDicomTag('(0008,0020)'); // Valid format
const isInvalidTag = validateDicomTag('invalid'); // Returns false

// Numeric input validation with bounds
const isValidNumber = validateNumericInput('42', 0, 100); // Valid
const isOutOfBounds = validateNumericInput('150', 0, 100); // Invalid
```

### User Input Sanitization

**ALWAYS** sanitize user inputs before processing or storage:

```typescript
import { sanitizeUserInput, sanitizeHTML } from '@/utils/xss-protection';

// For text inputs
const sanitizedText = sanitizeUserInput(userInput);

// For HTML content (rare cases only)
const sanitizedHTML = sanitizeHTML(htmlContent);
```

### File Upload Security

```typescript
// Validate file types and sizes
const allowedMimeTypes = ['application/dicom', 'image/jpeg', 'image/png'];
const maxFileSize = 100 * 1024 * 1024; // 100MB

function validateFile(file: File): boolean {
  if (!allowedMimeTypes.includes(file.type)) {
    throw new Error('Invalid file type');
  }
  
  if (file.size > maxFileSize) {
    throw new Error('File too large');
  }
  
  return true;
}
```

## 🔐 Authentication and Authorization

### Secure Authentication Implementation

```typescript
import { useSecurityStore } from '@/store/securityStore';
import { hashPassword, verifyPassword } from '@/utils/crypto';

// Password hashing (never store plain text passwords)
const hashedPassword = await hashPassword(plainTextPassword);

// Authentication check
const { isAuthenticated, currentUser } = useSecurityStore();

if (!isAuthenticated) {
  // Redirect to login or show error
  return <LoginRequired />;
}
```

### Role-Based Access Control

```typescript
import { hasPermission } from '@/utils/permissions';

// Check permissions before sensitive operations
if (!hasPermission(currentUser, 'MODIFY_ANNOTATIONS')) {
  throw new SecurityError('Insufficient permissions');
}
```

## 💾 Secure Data Storage

### Encrypted Local Storage

**NEVER** store sensitive data in plain text:

```typescript
import { secureStore, secureRetrieve } from '@/utils/secure-storage';

// Store encrypted data
await secureStore('user_preferences', {
  viewerSettings: settings,
  lastSession: timestamp
});

// Retrieve and decrypt data
const preferences = await secureRetrieve('user_preferences');
```

### Secure Configuration Management

```typescript
// Use environment variables for sensitive configuration
const config = {
  apiKey: import.meta.env.VITE_API_KEY, // Never hardcode
  encryptionKey: import.meta.env.VITE_ENCRYPTION_KEY,
  endpoint: import.meta.env.VITE_API_ENDPOINT
};

// Validate configuration on startup
if (!config.apiKey) {
  throw new Error('Missing required API key configuration');
}
```

## 🚫 XSS Prevention

### Content Sanitization

```typescript
import DOMPurify from 'dompurify';

// Sanitize HTML content before rendering
const sanitizedContent = DOMPurify.sanitize(userContent, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong'],
  ALLOWED_ATTR: []
});

// For React components
function SafeContent({ content }: { content: string }) {
  return (
    <div 
      dangerouslySetInnerHTML={{ 
        __html: DOMPurify.sanitize(content) 
      }} 
    />
  );
}
```

### Safe URL Handling

```typescript
// Validate URLs before navigation
function isValidURL(url: string): boolean {
  try {
    const parsedURL = new URL(url);
    // Only allow http and https protocols
    return ['http:', 'https:'].includes(parsedURL.protocol);
  } catch {
    return false;
  }
}

// Safe navigation
function navigateToURL(url: string) {
  if (!isValidURL(url)) {
    throw new Error('Invalid URL');
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
```

## 📝 Error Handling Security

### Secure Error Handling

```typescript
import { handleSecureError } from '@/utils/error-handler';

try {
  // Risky operation
  await processdicomFile(file);
} catch (error) {
  // Use secure error handler
  const userMessage = handleSecureError(error, 'Failed to process DICOM file', {
    logToConsole: !import.meta.env.PROD,
    reportToService: import.meta.env.PROD,
    showToUser: true
  });
  
  // Show sanitized message to user
  setErrorMessage(userMessage);
}
```

### Information Disclosure Prevention

```typescript
// ❌ BAD: Exposes internal details
function badErrorHandler(error: Error) {
  return `Database error: ${error.message} at ${error.stack}`;
}

// ✅ GOOD: Provides safe user message
function goodErrorHandler(error: Error) {
  // Log full details for developers (not in production)
  if (!import.meta.env.PROD) {
    console.error('Detailed error:', error);
  }
  
  // Return safe message for users
  return 'An error occurred while processing your request. Please try again.';
}
```

## 🔍 Security Testing Practices

### Unit Testing Security Features

```typescript
describe('Input Validation', () => {
  it('should reject malicious DICOM tags', () => {
    const maliciousTag = '<script>alert("xss")</script>';
    expect(validateDicomTag(maliciousTag)).toBe(false);
  });

  it('should sanitize user input', () => {
    const maliciousInput = '<img src="x" onerror="alert(1)">';
    const sanitized = sanitizeUserInput(maliciousInput);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('onerror');
  });
});
```

### Integration Testing

```typescript
describe('Authentication Flow', () => {
  it('should prevent unauthorized access', async () => {
    // Attempt to access protected resource without authentication
    const response = await request(app)
      .get('/api/dicom/sensitive-data')
      .expect(401);
    
    expect(response.body.message).not.toContain('database');
  });
});
```

## 🏥 DICOM-Specific Security

### DICOM Data Handling

```typescript
import { sanitizeDicomMetadata } from '@/utils/dicom-security';

// Sanitize DICOM metadata before display
function displayDicomInfo(dataset: any) {
  const sanitizedData = sanitizeDicomMetadata(dataset);
  
  // Remove or redact sensitive tags
  const safeMetadata = {
    studyDate: sanitizedData.studyDate,
    modality: sanitizedData.modality,
    // Don't include patient identifiable information
  };
  
  return safeMetadata;
}
```

### Patient Data Protection

```typescript
// Anonymize patient data for development/testing
function anonymizePatientData(dicomData: any) {
  return {
    ...dicomData,
    patientName: 'ANONYMOUS',
    patientID: generateAnonymousID(),
    patientBirthDate: null,
    // Remove other identifying information
  };
}
```

## 🔧 Secure Coding Patterns

### Secure Component Patterns

```typescript
// Secure React component with input validation
interface SecureDicomViewerProps {
  dicomFile: File;
  onError: (message: string) => void;
}

function SecureDicomViewer({ dicomFile, onError }: SecureDicomViewerProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    async function loadDicom() {
      try {
        setIsLoading(true);
        
        // Validate file before processing
        if (!validateDicomFile(dicomFile)) {
          throw new Error('Invalid DICOM file');
        }
        
        // Process with secure handlers
        const dataset = await loadDicomSecurely(dicomFile);
        // ... handle success
        
      } catch (error) {
        const safeMessage = handleSecureError(error, 'DICOM loading failed');
        onError(safeMessage);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadDicom();
  }, [dicomFile, onError]);
  
  return (
    <SecureErrorBoundary>
      {/* Component content */}
    </SecureErrorBoundary>
  );
}
```

### Secure State Management

```typescript
// Secure Zustand store with validation
interface SecurityState {
  user: User | null;
  permissions: Permission[];
  sessionTimeout: number;
}

const useSecurityStore = create<SecurityState>((set, get) => ({
  user: null,
  permissions: [],
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  
  login: async (credentials: Credentials) => {
    // Validate credentials securely
    const user = await authenticateUser(credentials);
    
    if (!user) {
      throw new SecurityError('Invalid credentials');
    }
    
    // Set session timeout
    setTimeout(() => {
      get().logout();
    }, get().sessionTimeout);
    
    set({ user, permissions: user.permissions });
  },
  
  logout: () => {
    // Clear sensitive data
    secureStore.clear();
    set({ user: null, permissions: [] });
  }
}));
```

## ⚠️ Common Security Pitfalls

### 1. Information Disclosure
```typescript
// ❌ BAD: Exposes system information
function badErrorResponse(error: Error) {
  return {
    error: error.message,
    stack: error.stack,
    file: __filename,
    line: error.line
  };
}

// ✅ GOOD: Safe error response
function goodErrorResponse(error: Error) {
  return {
    error: 'An error occurred',
    code: 'PROCESSING_ERROR',
    timestamp: new Date().toISOString()
  };
}
```

### 2. Insecure Direct Object References
```typescript
// ❌ BAD: No authorization check
function getPatientData(patientId: string) {
  return database.getPatient(patientId);
}

// ✅ GOOD: Verify user can access this patient
function getPatientData(patientId: string, currentUser: User) {
  if (!canAccessPatient(currentUser, patientId)) {
    throw new SecurityError('Access denied');
  }
  return database.getPatient(patientId);
}
```

### 3. Hardcoded Secrets
```typescript
// ❌ BAD: Hardcoded credentials
const API_KEY = 'sk-abc123...';

// ✅ GOOD: Environment variables
const API_KEY = import.meta.env.VITE_API_KEY;
if (!API_KEY) {
  throw new Error('API_KEY environment variable required');
}
```

## 📋 Security Checklist for Code Reviews

### Input Validation
- [ ] All user inputs are validated
- [ ] DICOM parameters follow correct format
- [ ] File uploads have type and size restrictions
- [ ] Numeric inputs have appropriate bounds

### Output Encoding
- [ ] All dynamic content is properly encoded
- [ ] HTML content is sanitized before rendering
- [ ] Error messages don't expose sensitive information

### Authentication & Authorization
- [ ] Protected routes require authentication
- [ ] User permissions are checked before operations
- [ ] Session management is secure

### Data Protection
- [ ] Sensitive data is encrypted at rest
- [ ] Secure storage utilities are used
- [ ] No hardcoded secrets or credentials

### Error Handling
- [ ] Secure error handlers are used
- [ ] Production errors don't expose internal details
- [ ] Security events are properly logged

## 🤖 Automated Security Management

### Dependabot Configuration
**Location**: `.github/dependabot.yml`

Our project uses GitHub Dependabot for automated dependency management:

```yaml
# Key configuration highlights
updates:
  - package-ecosystem: "npm"
    schedule:
      interval: "weekly"  # Every Monday 9 AM KST
    groups:
      cornerstone-security:
        patterns: ["@cornerstonejs/*"]
        update-types: ["security", "patch"]
      production-security:
        dependency-type: "production"
        update-types: ["security"]
```

**Developer Guidelines**:
- **Review Dependabot PRs promptly**: Security updates should be reviewed within 24 hours
- **Test automated updates**: Even automated security updates require testing
- **Monitor for false positives**: Some dependency updates may introduce compatibility issues
- **Understand grouping**: Related dependencies are updated together to minimize conflicts

### Working with Dependabot PRs

```typescript
// Before merging Dependabot PRs, ensure:

// 1. Security impact assessment
const securityImpact = assessSecurityUpdate(dependencyUpdate);

// 2. Compatibility testing
await runSecurityTests();
await runIntegrationTests();

// 3. Medical device compliance check (if applicable)
const complianceCheck = validateMedicalDeviceCompliance(update);
```

## 🔗 Additional Resources

- [OWASP Secure Coding Practices](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/)
- [DICOM Security Guidelines](https://www.dicomstandard.org/news-dir/faq/security)
- [TypeScript Security Best Practices](https://snyk.io/blog/typescript-security-best-practices/)
- [React Security Best Practices](https://snyk.io/blog/10-react-security-best-practices/)
- [GitHub Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)

## 📞 Getting Help

- **Security Questions**: security@clarity-dicom.com
- **Code Review Support**: dev-team@clarity-dicom.com
- **Documentation Issues**: docs@clarity-dicom.com

---

**Remember**: Security is everyone's responsibility. When in doubt, always choose the more secure approach and ask for help from the security team.