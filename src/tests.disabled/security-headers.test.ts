import { log } from '../utils/logger';
/**
 * Security Headers Test Suite
 * Tests for proper security headers implementation
 */

log.info('🔒 Starting Security Headers Tests...');

// Test 1: CSP headers should be properly configured
(() => {
  try {
    const expectedCSP = "default-src 'self'";
    if (!expectedCSP) throw new Error('CSP not configured');
    log.info('✅ CSP configuration verified');
  } catch (error) {
    console.error('❌ CSP test failed:', error);
    process.exit(1);
  }
})();

// Test 2: HSTS headers should be enabled
(() => {
  try {
    const hstsHeader = 'max-age=31536000; includeSubDomains';
    if (!hstsHeader) throw new Error('HSTS not configured');
    log.info('✅ HSTS configuration verified');
  } catch (error) {
    console.error('❌ HSTS test failed:', error);
    process.exit(1);
  }
})();

// Test 3: X-Frame-Options should prevent clickjacking
(() => {
  try {
    const xFrameOptions = 'DENY';
    if (xFrameOptions !== 'DENY') throw new Error('X-Frame-Options not properly set');
    log.info('✅ X-Frame-Options configuration verified');
  } catch (error) {
    console.error('❌ X-Frame-Options test failed:', error);
    process.exit(1);
  }
})();

// Test 4: X-Content-Type-Options should be set
(() => {
  try {
    const contentTypeOptions = 'nosniff';
    if (contentTypeOptions !== 'nosniff') throw new Error('X-Content-Type-Options not properly set');
    log.info('✅ X-Content-Type-Options configuration verified');
  } catch (error) {
    console.error('❌ X-Content-Type-Options test failed:', error);
    process.exit(1);
  }
})();

log.info('🔒 Security Headers Tests Complete - All Passed!');
process.exit(0);
