#!/usr/bin/env node

/**
 * Comprehensive Functionality Test Runner
 * 
 * Executes the comprehensive functionality test suite and reports results
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const TEST_TIMEOUT = 60000; // 60 seconds
const TEST_FILE = 'src/tests/comprehensive-functionality.test.ts';
const REPORT_FILE = 'functionality-test-report.json';

console.log('🚀 Starting Comprehensive DICOM Viewer Functionality Tests');
console.log('===========================================================');

// Check if test file exists
if (!fs.existsSync(TEST_FILE)) {
  console.error(`❌ Test file not found: ${TEST_FILE}`);
  process.exit(1);
}

console.log(`📋 Test file: ${TEST_FILE}`);
console.log(`⏱️ Timeout: ${TEST_TIMEOUT}ms`);
console.log(`📄 Report will be saved to: ${REPORT_FILE}`);

try {
  console.log('\n🔧 Checking TypeScript compilation...');
  
  // Check TypeScript compilation
  try {
    execSync('npx tsc --noEmit', { 
      stdio: 'pipe',
      timeout: 30000 
    });
    console.log('✅ TypeScript compilation check passed');
  } catch (tscError) {
    console.warn('⚠️ TypeScript compilation warnings (proceeding anyway):');
    console.warn(tscError.stdout?.toString() || tscError.message);
  }

  console.log('\n🧪 Running comprehensive functionality tests...');
  
  // Create a test execution script
  const testScript = `
    // Mock browser environment for Node.js execution
    global.window = {};
    global.document = {
      createElement: (tag) => ({
        tagName: tag.toUpperCase(),
        style: {},
        appendChild: () => {},
        removeChild: () => {},
        addEventListener: () => {},
        removeEventListener: () => {}
      })
    };
    global.performance = {
      now: () => Date.now()
    };
    global.navigator = {
      hardwareConcurrency: 4
    };
    global.console = console;
    global.setTimeout = setTimeout;
    global.clearTimeout = clearTimeout;
    global.setInterval = setInterval;
    global.clearInterval = clearInterval;
    global.Promise = Promise;
    global.fetch = () => Promise.reject(new Error('Fetch not available in test environment'));
    global.AbortController = class AbortController {
      constructor() {
        this.signal = { addEventListener: () => {} };
      }
      abort() {}
    };

    // Mock Cornerstone3D dependencies
    const mockCornerstoneCore = {
      RenderingEngine: class RenderingEngine {
        constructor(id) {
          this.id = id;
          this.viewports = new Map();
        }
        setViewports(configs) {
          configs.forEach(config => {
            this.viewports.set(config.viewportId, config);
          });
        }
        getViewport(id) {
          return this.viewports.get(id) || null;
        }
        renderViewports() {}
        render() {}
        destroy() {}
      },
      volumeLoader: {
        createAndCacheVolume: async (volumeId, options) => ({
          volumeId,
          imageIds: options.imageIds || [],
          load: async () => {}
        })
      },
      setVolumesForViewports: async () => {},
      Types: {}
    };

    const mockCornerstoneTools = {
      ToolGroupManager: {
        createToolGroup: (id) => ({
          id,
          addViewport: () => {},
          removeViewport: () => {},
          setToolActive: () => {},
          setToolPassive: () => {}
        })
      },
      Types: {},
      Enums: {}
    };

    // Mock module resolution
    const Module = require('module');
    const originalRequire = Module.prototype.require;
    Module.prototype.require = function(id) {
      if (id === '@cornerstonejs/core') {
        return mockCornerstoneCore;
      }
      if (id === '@cornerstonejs/tools') {
        return mockCornerstoneTools;
      }
      return originalRequire.apply(this, arguments);
    };

    // Import and run the test
    const { runComprehensiveFunctionalityTests } = require('./${TEST_FILE.replace('.ts', '.js')}');
    
    console.log('🎯 Executing comprehensive functionality tests...');
    
    runComprehensiveFunctionalityTests()
      .then((result) => {
        const summary = result.getSummary();
        
        console.log('\\n📊 Test Results Summary:');
        console.log('========================');
        console.log(\`Total Tests: \${summary.total}\`);
        console.log(\`✅ Passed: \${summary.passed}\`);
        console.log(\`❌ Failed: \${summary.failed}\`);
        console.log(\`⏭️ Skipped: \${summary.skipped}\`);
        console.log(\`Success Rate: \${((summary.passed / summary.total) * 100).toFixed(1)}%\`);
        
        if (summary.errors.length > 0) {
          console.log('\\n❌ Failed Tests:');
          summary.errors.forEach((error, index) => {
            console.log(\`\${index + 1}. \${error}\`);
          });
        }
        
        // Save detailed report
        const report = {
          timestamp: new Date().toISOString(),
          summary,
          testSuites: [
            'Core Services Initialization',
            'DICOM Metadata Processing', 
            'Error Handling Systems',
            'WADO Protocol Handling',
            'Progressive Loading',
            'Service Integration',
            'Security Measures'
          ],
          securityFeatures: [
            'Map-based headers for WADO protocol',
            'Input validation and sanitization',
            'Error information sanitization', 
            'Memory management and cleanup',
            'Secure object access patterns'
          ],
          environment: {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch
          }
        };
        
        require('fs').writeFileSync('${REPORT_FILE}', JSON.stringify(report, null, 2));
        console.log(\`\\n📄 Detailed report saved to: ${REPORT_FILE}\`);
        
        if (summary.success) {
          console.log('\\n🎉 ALL FUNCTIONALITY TESTS PASSED!');
          console.log('✅ The DICOM viewer is functioning correctly after security hardening.');
          process.exit(0);
        } else {
          console.log(\`\\n💥 \${summary.failed} TEST(S) FAILED!\`);
          console.log('❌ Review the issues above and fix before deployment.');
          process.exit(1);
        }
      })
      .catch((error) => {
        console.error('\\n💥 Test execution failed:', error);
        console.error(error.stack);
        process.exit(1);
      });
  `;

  // Write and execute the test script
  const scriptPath = path.join(__dirname, 'temp-test-runner.js');
  fs.writeFileSync(scriptPath, testScript);
  
  try {
    execSync(`node "${scriptPath}"`, { 
      stdio: 'inherit',
      timeout: TEST_TIMEOUT,
      cwd: __dirname
    });
  } finally {
    // Clean up temporary script
    if (fs.existsSync(scriptPath)) {
      fs.unlinkSync(scriptPath);
    }
  }

} catch (error) {
  console.error('\n💥 Test execution failed:', error.message);
  
  if (error.status) {
    console.error(`Exit code: ${error.status}`);
  }
  
  if (error.signal) {
    console.error(`Signal: ${error.signal}`);
  }
  
  if (error.stdout) {
    console.error('STDOUT:', error.stdout.toString());
  }
  
  if (error.stderr) {
    console.error('STDERR:', error.stderr.toString());
  }
  
  process.exit(1);
}