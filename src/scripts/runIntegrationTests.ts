#!/usr/bin/env node

/**
 * Integration Test CLI Runner
 * Command-line interface for running system integration tests
 * Can be used in development, CI/CD pipelines, or scheduled health checks
 */

import { integrationTestRunner, TestRunConfiguration } from '../services/IntegrationTestRunner';
import * as fs from 'fs';
import * as path from 'path';

interface CLIOptions {
  quick: boolean;
  performance: boolean;
  stress: boolean;
  timeout: number;
  verbose: boolean;
  output?: string;
  format: 'json' | 'html' | 'console';
  help: boolean;
}

class IntegrationTestCLI {
  private options: CLIOptions;

  constructor(args: string[]) {
    this.options = this.parseArguments(args);
  }

  private parseArguments(args: string[]): CLIOptions {
    const options: CLIOptions = {
      quick: false,
      performance: true,
      stress: false,
      timeout: 300000, // 5 minutes default
      verbose: false,
      format: 'console',
      help: false,
    };

    for (let i = 0; i < args.length; i++) {
      // eslint-disable-next-line security/detect-object-injection -- Safe: i is controlled loop index within args array bounds
      const arg = args[i];

      switch (arg) {
        case '--help':
        case '-h':
          options.help = true;
          break;
        case '--quick':
        case '-q':
          options.quick = true;
          break;
        case '--no-performance':
          options.performance = false;
          break;
        case '--stress':
        case '-s':
          options.stress = true;
          break;
        case '--timeout':
        case '-t': {
          const timeoutValue = parseInt(args[++i]);
          if (!isNaN(timeoutValue) && timeoutValue > 0) {
            options.timeout = timeoutValue * 1000; // Convert seconds to milliseconds
          }
          break;
        }
        case '--verbose':
        case '-v':
          options.verbose = true;
          break;
        case '--output':
        case '-o':
          options.output = args[++i];
          break;
        case '--format':
        case '-f': {
          const format = args[++i];
          if (format === 'json' || format === 'html' || format === 'console') {
            options.format = format;
          }
          break;
        }
      }
    }

    return options;
  }

  public async run(): Promise<void> {
    if (this.options.help) {
      this.showHelp();
      return;
    }

    console.log('🔧 Cornerstone3D Integration Test Runner');
    console.log('==========================================\n');

    try {
      if (this.options.quick) {
        console.log('📋 Running quick health check...\n');
        await this.runQuickCheck();
      } else {
        console.log('🧪 Running full integration test suite...\n');
        await this.runFullSuite();
      }
    } catch (error) {
      console.error('❌ Test execution failed:', (error as Error).message);
      process.exit(1);
    }
  }

  private async runQuickCheck(): Promise<void> {
    const startTime = Date.now();

    try {
      const summary = await integrationTestRunner.runQuickHealthCheck();
      const duration = Date.now() - startTime;

      this.outputResults(summary, duration);

      if (summary.overallStatus === 'failure') {
        process.exit(1);
      }
    } catch (error) {
      console.error('Quick health check failed:', (error as Error).message);
      process.exit(1);
    }
  }

  private async runFullSuite(): Promise<void> {
    const config: TestRunConfiguration = {
      includePerformanceBenchmarks: this.options.performance,
      includeStressTests: this.options.stress,
      maxExecutionTime: this.options.timeout,
      verbose: this.options.verbose,
      generateDetailedReport: true,
    };

    const startTime = Date.now();

    // Set up progress tracking if verbose
    if (this.options.verbose) {
      integrationTestRunner.on('progress', progress => {
        const percentage = Math.round(progress.percentage);
        const eta = Math.round(progress.estimatedTimeRemaining / 1000);
        console.log(
          `⏳ Progress: ${percentage}% (${progress.completedTests}/${progress.totalTests}) - ETA: ${eta}s - ${progress.currentTest}`,
        );
      });
    }

    try {
      const summary = await integrationTestRunner.runIntegrationTests(config);
      const duration = Date.now() - startTime;

      this.outputResults(summary, duration);

      if (summary.overallStatus === 'failure') {
        process.exit(1);
      }
    } catch (error) {
      console.error('Integration test suite failed:', (error as Error).message);
      process.exit(1);
    }
  }

  private outputResults(summary: any, duration: number): void {
    switch (this.options.format) {
      case 'json':
        this.outputJSON(summary);
        break;
      case 'html':
        this.outputHTML(summary);
        break;
      default:
        this.outputConsole(summary, duration);
        break;
    }

    // Save to file if output path specified
    if (this.options.output) {
      this.saveToFile(summary);
    }
  }

  private outputConsole(summary: any, duration: number): void {
    console.log('📊 Test Results Summary');
    console.log('========================\n');

    // Status with emoji
    const statusEmoji = {
      success: '✅',
      partial: '⚠️',
      failure: '❌',
    };

    console.log(
      `${statusEmoji[summary.overallStatus as keyof typeof statusEmoji]} Overall Status: ${summary.overallStatus.toUpperCase()}`,
    );
    console.log(`⏱️  Total Duration: ${(duration / 1000).toFixed(2)} seconds`);
    console.log(`🧪 Total Tests: ${summary.results.totalTests}`);
    console.log(`✅ Passed: ${summary.results.passed}`);
    console.log(`❌ Failed: ${summary.results.failed}`);
    console.log(`⚠️  Warnings: ${summary.results.warnings}\n`);

    // Show critical issues if any
    if (summary.criticalIssues.length > 0) {
      console.log('🚨 Critical Issues:');
      summary.criticalIssues.forEach((issue: string, index: number) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
      console.log('');
    }

    // Show recommendations
    if (summary.recommendations.length > 0) {
      console.log('💡 Recommendations:');
      summary.recommendations.forEach((rec: string, index: number) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
      console.log('');
    }

    // Show test breakdown if verbose
    if (this.options.verbose && integrationTestRunner) {
      const results = integrationTestRunner.getRunById(summary.runId);
      if (results) {
        console.log('📋 Detailed Test Results:');
        console.log('-------------------------');
        // Note: Would need access to detailed results from verifier
        // This is simplified for the CLI interface
      }
    }

    console.log(`🎯 Run ID: ${summary.runId}`);
    console.log(`📅 Completed: ${new Date(summary.endTime).toLocaleString()}\n`);
  }

  private outputJSON(summary: any): void {
    console.log(JSON.stringify(summary, null, 2));
  }

  private outputHTML(summary: any): void {
    const html = integrationTestRunner.generateHTMLReport(summary);
    console.log(html);
  }

  private saveToFile(summary: any): void {
    try {
      const outputPath = this.options.output!;

      // 보안: 경로 검증 - 상대 경로 공격 방지
      const resolvedPath = path.resolve(outputPath);
      const allowedBaseDir = path.resolve(process.cwd());

      if (!resolvedPath.startsWith(allowedBaseDir)) {
        throw new Error('Invalid output path: path traversal detected');
      }

      // 보안: 화이트리스트 기반 디렉토리 생성
      const allowedDirectories = [
        path.resolve(process.cwd(), 'reports'),
        path.resolve(process.cwd(), 'test-results'),
        path.resolve(process.cwd(), 'output'),
      ];

      const dir = path.dirname(resolvedPath);
      const isAllowedDir = allowedDirectories.some(allowedDir => dir.startsWith(allowedDir));

      if (!isAllowedDir) {
        throw new Error(`Directory not allowed: ${dir}`);
      }

      // 안전한 디렉토리 생성 - 하드코딩된 경로만 사용
      try {
        const resolvedDir = path.resolve(dir);
        const reportsDir = path.resolve(process.cwd(), 'reports');
        const testResultsDir = path.resolve(process.cwd(), 'test-results');
        const outputDir = path.resolve(process.cwd(), 'output');

        if (resolvedDir === reportsDir) {
          if (!fs.existsSync('reports')) {
            fs.mkdirSync('reports', { recursive: true });
          }
        } else if (resolvedDir === testResultsDir) {
          if (!fs.existsSync('test-results')) {
            fs.mkdirSync('test-results', { recursive: true });
          }
        } else if (resolvedDir === outputDir) {
          if (!fs.existsSync('output')) {
            fs.mkdirSync('output', { recursive: true });
          }
        }
      } catch (error) {
        throw new Error(`Failed to create directory: ${(error as Error).message}`);
      }

      let content: string;
      const ext = path.extname(outputPath).toLowerCase();

      switch (ext) {
        case '.json':
          content = JSON.stringify(summary, null, 2);
          break;
        case '.html':
        case '.htm':
          content = integrationTestRunner.generateHTMLReport(summary);
          break;
        default:
          // Default to JSON
          content = JSON.stringify(summary, null, 2);
          break;
      }

      // 보안: 파일 확장자 재검증 및 안전한 파일 쓰기
      const allowedExtensions = ['.json', '.html', '.htm'];
      const fileExt = path.extname(resolvedPath).toLowerCase();

      if (!allowedExtensions.includes(fileExt)) {
        throw new Error(`File extension not allowed: ${fileExt}`);
      }

      // 안전한 파일 쓰기 - 검증된 경로에 직접 쓰기
      try {
        const resolvedFilePath = path.resolve(resolvedPath);
        const reportsDir = path.resolve(process.cwd(), 'reports');
        const testResultsDir = path.resolve(process.cwd(), 'test-results');
        const outputDir = path.resolve(process.cwd(), 'output');

        if (resolvedFilePath.startsWith(reportsDir)) {
          const relativePath = path.relative(reportsDir, resolvedFilePath);
          const safePath = path.join('reports', relativePath);
          // eslint-disable-next-line security/detect-non-literal-fs-filename
          fs.writeFileSync(safePath, content, { encoding: 'utf8', mode: 0o644 });
        } else if (resolvedFilePath.startsWith(testResultsDir)) {
          const relativePath = path.relative(testResultsDir, resolvedFilePath);
          const safePath = path.join('test-results', relativePath);
          // eslint-disable-next-line security/detect-non-literal-fs-filename
          fs.writeFileSync(safePath, content, { encoding: 'utf8', mode: 0o644 });
        } else if (resolvedFilePath.startsWith(outputDir)) {
          const relativePath = path.relative(outputDir, resolvedFilePath);
          const safePath = path.join('output', relativePath);
          // eslint-disable-next-line security/detect-non-literal-fs-filename
          fs.writeFileSync(safePath, content, { encoding: 'utf8', mode: 0o644 });
        }

        console.log(`📄 Report saved to: ${resolvedPath}`);
      } catch (error) {
        throw new Error(`Failed to write file: ${(error as Error).message}`);
      }
    } catch (error) {
      console.error(`Failed to save report: ${(error as Error).message}`);
    }
  }

  private showHelp(): void {
    console.log(`
🔧 Cornerstone3D Integration Test Runner

USAGE:
  npm run test:integration [OPTIONS]
  
OPTIONS:
  -h, --help              Show this help message
  -q, --quick             Run quick health check only
  --no-performance        Skip performance benchmarks
  -s, --stress            Include stress tests
  -t, --timeout SECONDS   Set maximum execution time (default: 300)
  -v, --verbose           Show detailed progress and results
  -o, --output PATH       Save report to file
  -f, --format FORMAT     Output format: console, json, html (default: console)

EXAMPLES:
  npm run test:integration                    # Run full test suite
  npm run test:integration --quick            # Quick health check
  npm run test:integration --verbose          # Verbose output
  npm run test:integration -o report.html     # Save HTML report
  npm run test:integration -f json            # JSON output
  npm run test:integration --timeout 600      # 10 minute timeout

EXIT CODES:
  0 - All tests passed or partial success
  1 - Test failures or execution error

DESCRIPTION:
  This tool runs comprehensive integration tests for the Cornerstone3D medical 
  imaging viewer. It verifies tool functionality, state management, error 
  handling, performance, and system integration.

  The test suite includes:
  - End-to-end tool verification
  - Cross-tool interaction tests
  - Performance benchmarking
  - Error handling validation
  - State consistency checks
  - Resource usage verification

For more information, see the project documentation.
`);
  }
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cli = new IntegrationTestCLI(args);

  try {
    await cli.run();
  } catch (error) {
    console.error('Unexpected error:', (error as Error).message);
    process.exit(1);
  } finally {
    // Cleanup
    integrationTestRunner.dispose();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { IntegrationTestCLI };
