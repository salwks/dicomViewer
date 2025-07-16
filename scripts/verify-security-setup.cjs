#!/usr/bin/env node

/**
 * Security Setup Verification Script
 * Verifies that all security configurations are properly set up
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class SecuritySetupVerifier {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      details: []
    };
  }

  log(type, message, details = null) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, type, message, details };
    
    console.log(`[${timestamp}] ${type.toUpperCase()}: ${message}`);
    if (details) {
      console.log(`  Details: ${details}`);
    }
    
    this.results.details.push(logEntry);
    this.results[type]++;
  }

  checkFileExists(filePath, description) {
    if (fs.existsSync(filePath)) {
      this.log('passed', `✅ ${description}`, filePath);
      return true;
    } else {
      this.log('failed', `❌ ${description} - File missing`, filePath);
      return false;
    }
  }

  checkDirectoryExists(dirPath, description) {
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      this.log('passed', `✅ ${description}`, dirPath);
      return true;
    } else {
      this.log('failed', `❌ ${description} - Directory missing`, dirPath);
      return false;
    }
  }

  checkFileContent(filePath, pattern, description) {
    try {
      if (!fs.existsSync(filePath)) {
        this.log('failed', `❌ ${description} - File not found`, filePath);
        return false;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes(pattern) || new RegExp(pattern).test(content)) {
        this.log('passed', `✅ ${description}`, `Pattern found: ${pattern}`);
        return true;
      } else {
        this.log('failed', `❌ ${description} - Pattern not found`, pattern);
        return false;
      }
    } catch (error) {
      this.log('failed', `❌ ${description} - Error reading file`, error.message);
      return false;
    }
  }

  checkNpmPackage(packageName, description) {
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      if (dependencies[packageName]) {
        this.log('passed', `✅ ${description}`, `Version: ${dependencies[packageName]}`);
        return true;
      } else {
        this.log('warnings', `⚠️ ${description} - Package not found`, packageName);
        return false;
      }
    } catch (error) {
      this.log('failed', `❌ ${description} - Error checking package`, error.message);
      return false;
    }
  }

  runSecurityAudit() {
    try {
      console.log('\n🔍 Running npm security audit...');
      const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
      const audit = JSON.parse(auditResult);
      
      const vulns = audit.metadata?.vulnerabilities || {};
      const totalVulns = Object.values(vulns).reduce((sum, count) => sum + count, 0);
      
      if (totalVulns === 0) {
        this.log('passed', '✅ No security vulnerabilities found in dependencies');
      } else {
        const critical = vulns.critical || 0;
        const high = vulns.high || 0;
        
        if (critical > 0 || high > 0) {
          this.log('failed', `❌ Critical/High vulnerabilities found`, 
            `Critical: ${critical}, High: ${high}`);
        } else {
          this.log('warnings', `⚠️ Low/Medium vulnerabilities found`, 
            `Total: ${totalVulns}`);
        }
      }
      
      return audit;
    } catch (error) {
      this.log('warnings', '⚠️ Could not run npm audit', error.message);
      return null;
    }
  }

  verifyDependabotSetup() {
    console.log('\n📦 Verifying Dependabot setup...');
    
    // Check Dependabot configuration file
    this.checkFileExists('.github/dependabot.yml', 'Dependabot configuration file');
    
    // Check Dependabot content
    this.checkFileContent('.github/dependabot.yml', 'package-ecosystem.*npm', 
      'Dependabot npm ecosystem configuration');
    this.checkFileContent('.github/dependabot.yml', 'schedule.*weekly', 
      'Dependabot weekly schedule configuration');
    this.checkFileContent('.github/dependabot.yml', 'security', 
      'Dependabot security labels configuration');
    
    // Check GitHub Actions workflows
    this.checkFileExists('.github/workflows/dependabot-auto-merge.yml', 
      'Dependabot auto-merge workflow');
    this.checkFileExists('.github/workflows/security-audit.yml', 
      'Security audit workflow');
    
    // Check issue templates
    this.checkFileExists('.github/ISSUE_TEMPLATE/security_vulnerability.md', 
      'Security vulnerability issue template');
    this.checkFileExists('.github/ISSUE_TEMPLATE/dependency_update.md', 
      'Dependency update issue template');
    
    // Check security policy
    this.checkFileExists('.github/SECURITY.md', 'Security policy file');
  }

  verifySecurityImplementation() {
    console.log('\n🔒 Verifying security implementation...');
    
    // Check security store
    this.checkFileExists('src/store/securityStore.ts', 'Security store implementation');
    this.checkFileContent('src/store/securityStore.ts', 'SecurityStoreState', 
      'Security store interface');
    this.checkFileContent('src/store/securityStore.ts', 'logSecurityEvent', 
      'Security event logging');
    
    // Check encryption utilities
    this.checkFileExists('src/utils/crypto.ts', 'Encryption utilities');
    this.checkFileContent('src/utils/crypto.ts', 'CryptoUtils', 
      'Crypto utilities class');
    this.checkFileContent('src/utils/crypto.ts', 'AES-GCM', 
      'AES-GCM encryption implementation');
    
    // Check security components
    this.checkFileExists('src/components/SecurityLogin.tsx', 'Security login component');
    this.checkFileExists('src/components/SecurityDashboard.tsx', 'Security dashboard component');
    
    // Check security tests
    this.checkFileExists('src/tests/security.test.ts', 'Security test suite');
    
    // Check documentation
    this.checkFileExists('SECURITY_IMPLEMENTATION.md', 'Security implementation documentation');
    this.checkFileExists('DEPENDABOT_GUIDE.md', 'Dependabot guide documentation');
  }

  verifyGitHubSettings() {
    console.log('\n🏗️ Verifying GitHub configuration...');
    
    // Check GitHub directories and files
    this.checkDirectoryExists('.github', 'GitHub configuration directory');
    this.checkDirectoryExists('.github/workflows', 'GitHub Actions workflows directory');
    this.checkDirectoryExists('.github/ISSUE_TEMPLATE', 'GitHub issue templates directory');
    this.checkDirectoryExists('.github/pull_request_template', 'GitHub PR templates directory');
    
    // Check pull request templates
    this.checkFileExists('.github/pull_request_template.md', 'Default PR template');
    this.checkFileExists('.github/pull_request_template/security_update.md', 
      'Security update PR template');
  }

  verifyPackageJsonSecurity() {
    console.log('\n📋 Verifying package.json security settings...');
    
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      // Check for security-related scripts
      if (packageJson.scripts) {
        if (packageJson.scripts['audit'] || packageJson.scripts['security-audit']) {
          this.log('passed', '✅ Security audit script found');
        } else {
          this.log('warnings', '⚠️ No security audit script found in package.json');
        }
        
        if (packageJson.scripts['test:security']) {
          this.log('passed', '✅ Security test script found');
        } else {
          this.log('warnings', '⚠️ No security test script found in package.json');
        }
      }
      
      // Check for security-related dependencies
      const securityPackages = [
        '@cornerstonejs/core',
        '@cornerstonejs/tools',
        'zustand'
      ];
      
      securityPackages.forEach(pkg => {
        this.checkNpmPackage(pkg, `Required package: ${pkg}`);
      });
      
    } catch (error) {
      this.log('failed', '❌ Error reading package.json', error.message);
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 SECURITY SETUP VERIFICATION REPORT');
    console.log('='.repeat(60));
    
    console.log(`\n✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`⚠️ Warnings: ${this.results.warnings}`);
    
    const total = this.results.passed + this.results.failed + this.results.warnings;
    const successRate = total > 0 ? (this.results.passed / total * 100).toFixed(1) : 0;
    
    console.log(`\n📈 Success Rate: ${successRate}%`);
    
    if (this.results.failed === 0) {
      console.log('\n🎉 All critical security configurations are properly set up!');
    } else {
      console.log('\n⚠️ Some security configurations need attention.');
      console.log('Please review the failed items above and fix them.');
    }
    
    if (this.results.warnings > 0) {
      console.log('\n💡 There are some optional improvements you can make.');
      console.log('Review the warnings above for enhancement opportunities.');
    }
    
    // Generate summary for CI/CD
    const summary = {
      timestamp: new Date().toISOString(),
      passed: this.results.passed,
      failed: this.results.failed,
      warnings: this.results.warnings,
      successRate: parseFloat(successRate),
      status: this.results.failed === 0 ? 'PASS' : 'FAIL'
    };
    
    fs.writeFileSync('security-verification-report.json', JSON.stringify(summary, null, 2));
    console.log('\n📄 Detailed report saved to: security-verification-report.json');
    
    return this.results.failed === 0;
  }

  run() {
    console.log('🔒 Starting Security Setup Verification...');
    console.log(`📅 Date: ${new Date().toISOString()}`);
    console.log(`📁 Directory: ${process.cwd()}`);
    
    this.verifyDependabotSetup();
    this.verifySecurityImplementation();
    this.verifyGitHubSettings();
    this.verifyPackageJsonSecurity();
    
    // Run security audit
    this.runSecurityAudit();
    
    return this.generateReport();
  }
}

// Run verification if this script is executed directly
if (require.main === module) {
  const verifier = new SecuritySetupVerifier();
  const success = verifier.run();
  
  process.exit(success ? 0 : 1);
}

module.exports = SecuritySetupVerifier;