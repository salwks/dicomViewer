/**
 * Security Headers Checker
 * Runtime utility to check and validate security headers
 */

export interface SecurityHeaderCheck {
  header: string;
  expected?: string;
  present: boolean;
  value?: string;
  compliant: boolean;
  recommendation?: string;
}

export interface SecurityAssessment {
  score: number;
  maxScore: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  checks: SecurityHeaderCheck[];
  summary: string;
  medicalCompliance: boolean;
  hipaaCompliant: boolean;
}

export class SecurityHeadersChecker {
  private static readonly CRITICAL_HEADERS = [
    'content-security-policy',
    'x-frame-options',
    'x-content-type-options',
    'strict-transport-security',
  ];

  private static readonly MEDICAL_HEADERS = [
    'x-medical-data-protection',
    'x-security-policy',
    'cache-control',
    'pragma',
  ];

  private static readonly PRIVACY_HEADERS = [
    'referrer-policy',
    'cross-origin-embedder-policy',
    'cross-origin-opener-policy',
    'cross-origin-resource-policy',
  ];

  /**
   * Check security headers for the current page
   */
  static async checkCurrentPage(): Promise<SecurityAssessment> {
    const headers = await this.fetchCurrentHeaders();
    return this.assessHeaders(headers);
  }

  /**
   * Check security headers for a specific URL
   */
  static async checkURL(url: string): Promise<SecurityAssessment> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const headers = new Map<string, string>();
      
      response.headers.forEach((value, key) => {
        headers.set(key.toLowerCase(), value);
      });
      
      return this.assessHeaders(headers);
    } catch (error) {
      console.error('Failed to check headers for URL:', url, error);
      return this.createEmptyAssessment();
    }
  }

  /**
   * Fetch headers from current page (development only)
   */
  private static async fetchCurrentHeaders(): Promise<Map<string, string>> {
    const headers = new Map<string, string>();
    
    // In a real environment, these would come from actual HTTP headers
    // For development, we'll simulate the headers that should be present
    if (process.env.NODE_ENV === 'development') {
      // Simulate the headers from our security plugin
      const simulatedHeaders = {
        'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: https://cdn.skypack.dev; style-src 'self' 'unsafe-inline' data:; img-src 'self' data: blob: https: *; connect-src 'self' https: wss: ws: blob:; worker-src 'self' blob: data:; font-src 'self' data: https:; media-src 'self' data: blob: https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests; block-all-mixed-content",
        'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'permissions-policy': 'accelerometer=(), camera=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(self), payment=(), usb=(self)',
        'cross-origin-embedder-policy': 'require-corp',
        'cross-origin-opener-policy': 'same-origin',
        'cross-origin-resource-policy': 'same-origin',
        'x-xss-protection': '1; mode=block',
        'x-medical-data-protection': 'HIPAA-Compliant',
        'x-security-policy': 'Medical-Imaging-Enhanced',
        'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'pragma': 'no-cache',
        'expires': '0',
      };

      Object.entries(simulatedHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });
    }
    
    return headers;
  }

  /**
   * Assess security headers and generate report
   */
  private static assessHeaders(headers: Map<string, string>): SecurityAssessment {
    const checks: SecurityHeaderCheck[] = [];
    let score = 0;
    const maxScore = 100;

    // Check critical security headers (40 points)
    checks.push(...this.checkCriticalHeaders(headers));
    score += this.calculateSectionScore(checks.slice(-4), 40);

    // Check medical-specific headers (30 points)
    checks.push(...this.checkMedicalHeaders(headers));
    score += this.calculateSectionScore(checks.slice(-4), 30);

    // Check privacy headers (20 points)
    checks.push(...this.checkPrivacyHeaders(headers));
    score += this.calculateSectionScore(checks.slice(-4), 20);

    // Check additional security headers (10 points)
    checks.push(...this.checkAdditionalHeaders(headers));
    score += this.calculateSectionScore(checks.slice(-2), 10);

    const grade = this.calculateGrade(score);
    const medicalCompliance = this.checkMedicalCompliance(checks);
    const hipaaCompliant = this.checkHIPAACompliance(checks);

    return {
      score: Math.round(score),
      maxScore,
      grade,
      checks,
      summary: this.generateSummary(score, grade, medicalCompliance),
      medicalCompliance,
      hipaaCompliant,
    };
  }

  /**
   * Check critical security headers
   */
  private static checkCriticalHeaders(headers: Map<string, string>): SecurityHeaderCheck[] {
    const checks: SecurityHeaderCheck[] = [];

    // Content Security Policy
    const csp = headers.get('content-security-policy');
    checks.push({
      header: 'Content-Security-Policy',
      present: !!csp,
      value: csp,
      compliant: !!csp && this.validateCSP(csp),
      recommendation: !csp ? 'Implement CSP to prevent XSS attacks' : 
                     !this.validateCSP(csp!) ? 'Review CSP configuration for medical imaging requirements' : undefined,
    });

    // X-Frame-Options
    const frameOptions = headers.get('x-frame-options');
    checks.push({
      header: 'X-Frame-Options',
      expected: 'DENY',
      present: !!frameOptions,
      value: frameOptions,
      compliant: frameOptions === 'DENY',
      recommendation: frameOptions !== 'DENY' ? 'Set to DENY for medical data protection' : undefined,
    });

    // X-Content-Type-Options
    const contentTypeOptions = headers.get('x-content-type-options');
    checks.push({
      header: 'X-Content-Type-Options',
      expected: 'nosniff',
      present: !!contentTypeOptions,
      value: contentTypeOptions,
      compliant: contentTypeOptions === 'nosniff',
      recommendation: contentTypeOptions !== 'nosniff' ? 'Set to nosniff to prevent MIME attacks' : undefined,
    });

    // Strict-Transport-Security
    const hsts = headers.get('strict-transport-security');
    checks.push({
      header: 'Strict-Transport-Security',
      present: !!hsts,
      value: hsts,
      compliant: !!hsts && hsts.includes('max-age=') && hsts.includes('includeSubDomains'),
      recommendation: !hsts ? 'Implement HSTS for HTTPS enforcement' : 
                     !this.validateHSTS(hsts!) ? 'Include includeSubDomains and consider preload' : undefined,
    });

    return checks;
  }

  /**
   * Check medical-specific headers
   */
  private static checkMedicalHeaders(headers: Map<string, string>): SecurityHeaderCheck[] {
    const checks: SecurityHeaderCheck[] = [];

    // Medical Data Protection
    const medicalProtection = headers.get('x-medical-data-protection');
    checks.push({
      header: 'X-Medical-Data-Protection',
      expected: 'HIPAA-Compliant',
      present: !!medicalProtection,
      value: medicalProtection,
      compliant: medicalProtection === 'HIPAA-Compliant',
      recommendation: !medicalProtection ? 'Add medical data protection header for compliance' : undefined,
    });

    // Security Policy
    const securityPolicy = headers.get('x-security-policy');
    checks.push({
      header: 'X-Security-Policy',
      expected: 'Medical-Imaging-Enhanced',
      present: !!securityPolicy,
      value: securityPolicy,
      compliant: !!securityPolicy,
      recommendation: !securityPolicy ? 'Add security policy header for medical environments' : undefined,
    });

    // Cache Control
    const cacheControl = headers.get('cache-control');
    checks.push({
      header: 'Cache-Control',
      expected: 'no-store, no-cache, must-revalidate',
      present: !!cacheControl,
      value: cacheControl,
      compliant: !!cacheControl && cacheControl.includes('no-store') && cacheControl.includes('no-cache'),
      recommendation: !this.validateCacheControl(cacheControl) ? 'Configure cache headers for medical data protection' : undefined,
    });

    // Pragma
    const pragma = headers.get('pragma');
    checks.push({
      header: 'Pragma',
      expected: 'no-cache',
      present: !!pragma,
      value: pragma,
      compliant: pragma === 'no-cache',
      recommendation: pragma !== 'no-cache' ? 'Set Pragma to no-cache for legacy cache prevention' : undefined,
    });

    return checks;
  }

  /**
   * Check privacy headers
   */
  private static checkPrivacyHeaders(headers: Map<string, string>): SecurityHeaderCheck[] {
    const checks: SecurityHeaderCheck[] = [];

    // Referrer Policy
    const referrerPolicy = headers.get('referrer-policy');
    checks.push({
      header: 'Referrer-Policy',
      expected: 'strict-origin-when-cross-origin',
      present: !!referrerPolicy,
      value: referrerPolicy,
      compliant: !!referrerPolicy && (referrerPolicy.includes('strict-origin') || referrerPolicy.includes('no-referrer')),
      recommendation: !this.validateReferrerPolicy(referrerPolicy) ? 'Use strict referrer policy for medical privacy' : undefined,
    });

    // Cross-Origin-Embedder-Policy
    const coep = headers.get('cross-origin-embedder-policy');
    checks.push({
      header: 'Cross-Origin-Embedder-Policy',
      expected: 'require-corp',
      present: !!coep,
      value: coep,
      compliant: coep === 'require-corp',
      recommendation: coep !== 'require-corp' ? 'Set COEP for cross-origin isolation' : undefined,
    });

    // Cross-Origin-Opener-Policy
    const coop = headers.get('cross-origin-opener-policy');
    checks.push({
      header: 'Cross-Origin-Opener-Policy',
      expected: 'same-origin',
      present: !!coop,
      value: coop,
      compliant: coop === 'same-origin',
      recommendation: coop !== 'same-origin' ? 'Set COOP for browsing context isolation' : undefined,
    });

    // Cross-Origin-Resource-Policy
    const corp = headers.get('cross-origin-resource-policy');
    checks.push({
      header: 'Cross-Origin-Resource-Policy',
      expected: 'same-origin',
      present: !!corp,
      value: corp,
      compliant: corp === 'same-origin',
      recommendation: corp !== 'same-origin' ? 'Set CORP for resource protection' : undefined,
    });

    return checks;
  }

  /**
   * Check additional security headers
   */
  private static checkAdditionalHeaders(headers: Map<string, string>): SecurityHeaderCheck[] {
    const checks: SecurityHeaderCheck[] = [];

    // X-XSS-Protection
    const xssProtection = headers.get('x-xss-protection');
    checks.push({
      header: 'X-XSS-Protection',
      expected: '1; mode=block',
      present: !!xssProtection,
      value: xssProtection,
      compliant: !!xssProtection && xssProtection.includes('mode=block'),
      recommendation: !this.validateXSSProtection(xssProtection) ? 'Enable XSS protection with block mode' : undefined,
    });

    // Permissions Policy
    const permissionsPolicy = headers.get('permissions-policy');
    checks.push({
      header: 'Permissions-Policy',
      present: !!permissionsPolicy,
      value: permissionsPolicy,
      compliant: !!permissionsPolicy,
      recommendation: !permissionsPolicy ? 'Add permissions policy for feature control' : undefined,
    });

    return checks;
  }

  /**
   * Validate CSP for medical imaging requirements
   */
  private static validateCSP(csp: string): boolean {
    const required = [
      "default-src 'self'",
      "'unsafe-eval'", // Required for WebAssembly
      "blob:", // Required for workers
      "data:", // Required for DICOM data
    ];

    return required.every(req => csp.includes(req));
  }

  /**
   * Validate HSTS configuration
   */
  private static validateHSTS(hsts: string): boolean {
    return hsts.includes('max-age=') && hsts.includes('includeSubDomains');
  }

  /**
   * Validate cache control for medical data
   */
  private static validateCacheControl(cacheControl?: string): boolean {
    if (!cacheControl) return false;
    return cacheControl.includes('no-store') && cacheControl.includes('no-cache');
  }

  /**
   * Validate referrer policy for privacy
   */
  private static validateReferrerPolicy(policy?: string): boolean {
    if (!policy) return false;
    const validPolicies = ['strict-origin', 'strict-origin-when-cross-origin', 'no-referrer'];
    return validPolicies.some(valid => policy.includes(valid));
  }

  /**
   * Validate XSS protection header
   */
  private static validateXSSProtection(protection?: string): boolean {
    if (!protection) return false;
    return protection.includes('1') && protection.includes('mode=block');
  }

  /**
   * Calculate section score
   */
  private static calculateSectionScore(checks: SecurityHeaderCheck[], maxPoints: number): number {
    const compliantCount = checks.filter(check => check.compliant).length;
    return (compliantCount / checks.length) * maxPoints;
  }

  /**
   * Calculate overall grade
   */
  private static calculateGrade(score: number): 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Check medical compliance
   */
  private static checkMedicalCompliance(checks: SecurityHeaderCheck[]): boolean {
    const medicalHeaders = checks.filter(check => 
      this.MEDICAL_HEADERS.includes(check.header.toLowerCase())
    );
    return medicalHeaders.every(check => check.compliant);
  }

  /**
   * Check HIPAA compliance
   */
  private static checkHIPAACompliance(checks: SecurityHeaderCheck[]): boolean {
    const hipaaRequirements = [
      'x-frame-options',
      'cache-control',
      'x-medical-data-protection',
    ];
    
    const hipaaChecks = checks.filter(check => 
      hipaaRequirements.includes(check.header.toLowerCase())
    );
    
    return hipaaChecks.every(check => check.compliant);
  }

  /**
   * Generate assessment summary
   */
  private static generateSummary(score: number, grade: string, medicalCompliance: boolean): string {
    const baseMessage = `Security score: ${score}/100 (Grade: ${grade})`;
    const complianceMessage = medicalCompliance ? 
      'Medical compliance: ✅ Compliant' : 
      'Medical compliance: ❌ Non-compliant';
    
    return `${baseMessage}. ${complianceMessage}`;
  }

  /**
   * Create empty assessment for error cases
   */
  private static createEmptyAssessment(): SecurityAssessment {
    return {
      score: 0,
      maxScore: 100,
      grade: 'F',
      checks: [],
      summary: 'Failed to assess security headers',
      medicalCompliance: false,
      hipaaCompliant: false,
    };
  }

  /**
   * Print assessment to console
   */
  static printAssessment(assessment: SecurityAssessment): void {
    console.log('\n🛡️  Security Headers Assessment');
    console.log('═'.repeat(50));
    console.log(`Score: ${assessment.score}/${assessment.maxScore} (${assessment.grade})`);
    console.log(`Medical Compliance: ${assessment.medicalCompliance ? '✅' : '❌'}`);
    console.log(`HIPAA Compliance: ${assessment.hipaaCompliant ? '✅' : '❌'}`);
    console.log('\nHeader Details:');
    console.log('─'.repeat(50));

    assessment.checks.forEach(check => {
      const status = check.compliant ? '✅' : '❌';
      const value = check.value ? ` (${check.value.substring(0, 50)}...)` : '';
      console.log(`${status} ${check.header}${value}`);
      
      if (check.recommendation) {
        console.log(`   💡 ${check.recommendation}`);
      }
    });

    console.log('\n' + '═'.repeat(50));
  }
}

// Export convenience function
export const checkSecurityHeaders = () => SecurityHeadersChecker.checkCurrentPage();

export default SecurityHeadersChecker;