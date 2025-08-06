/**
 * Integration Test Runner
 * Orchestrates system integration testing and provides comprehensive reporting
 * Includes test scheduling, progress tracking, and detailed result analysis
 */

import { EventEmitter } from 'events';
import { log } from '../utils/logger';
import { SystemIntegrationVerifier, SystemHealthReport, IntegrationTestResult } from './SystemIntegrationVerifier';
import { ToolStateManager } from './ToolStateManager';

export interface TestRunConfiguration {
  includePerformanceBenchmarks: boolean;
  includeStressTests: boolean;
  maxExecutionTime: number; // milliseconds
  verbose: boolean;
  generateDetailedReport: boolean;
}

export interface TestRunSummary {
  runId: string;
  startTime: string;
  endTime: string;
  totalDuration: number;
  configuration: TestRunConfiguration;
  results: {
    totalTests: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
  overallStatus: 'success' | 'partial' | 'failure';
  criticalIssues: string[];
  recommendations: string[];
}

export interface TestRunProgress {
  currentTest: string;
  completedTests: number;
  totalTests: number;
  percentage: number;
  estimatedTimeRemaining: number;
}

export class IntegrationTestRunner extends EventEmitter {
  private verifier: SystemIntegrationVerifier;
  private toolStateManager: ToolStateManager;
  private currentRunId: string | null = null;
  private runHistory: TestRunSummary[] = [];
  private maxHistorySize = 50;

  constructor(verifier?: SystemIntegrationVerifier, toolStateManager?: ToolStateManager) {
    super();

    this.verifier = verifier || new SystemIntegrationVerifier();
    this.toolStateManager = toolStateManager || new ToolStateManager();

    // Set up event listeners
    this.setupEventListeners();

    log.info('IntegrationTestRunner initialized', {
      component: 'IntegrationTestRunner',
    });
  }

  private setupEventListeners(): void {
    this.verifier.on('integration-test-completed', (report: SystemHealthReport) => {
      const summary = this.generateRunSummary(
        report,
        {
          includePerformanceBenchmarks: true,
          includeStressTests: false,
          maxExecutionTime: 300000,
          verbose: false,
          generateDetailedReport: true,
        },
        new Date(),
      );
      this.emit('test-run-completed', summary);
    });
  }

  // ===== Main Test Execution =====

  /**
   * Run comprehensive integration test suite with progress tracking
   */
  public async runIntegrationTests(configuration: Partial<TestRunConfiguration> = {}): Promise<TestRunSummary> {
    const config: TestRunConfiguration = {
      includePerformanceBenchmarks: true,
      includeStressTests: false,
      maxExecutionTime: 300000, // 5 minutes
      verbose: false,
      generateDetailedReport: true,
      ...configuration,
    };

    this.currentRunId = this.generateRunId();
    const startTime = new Date();

    log.info('Starting integration test run', {
      component: 'IntegrationTestRunner',
      metadata: {
        runId: this.currentRunId,
        configuration: config,
      },
    });

    try {
      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Test run timed out after ${config.maxExecutionTime}ms`));
        }, config.maxExecutionTime);
      });

      // Run tests with timeout
      const testPromise = this.executeTestSuite(config);
      const healthReport = await Promise.race([testPromise, timeoutPromise]);

      // Generate summary
      const summary = this.generateRunSummary(healthReport, config, startTime);
      this.addToHistory(summary);

      log.info('Integration test run completed', {
        component: 'IntegrationTestRunner',
        metadata: {
          runId: this.currentRunId,
          duration: summary.totalDuration,
          overallStatus: summary.overallStatus,
        },
      });

      return summary;
    } catch (error) {
      log.error(
        'Integration test run failed',
        {
          component: 'IntegrationTestRunner',
          metadata: { runId: this.currentRunId },
        },
        error as Error,
      );

      const errorSummary = this.generateErrorSummary(error as Error, config, startTime);
      this.addToHistory(errorSummary);

      throw error;
    } finally {
      this.currentRunId = null;
    }
  }

  /**
   * Execute the actual test suite with progress updates
   */
  private async executeTestSuite(config: TestRunConfiguration): Promise<SystemHealthReport> {
    const totalTestCount = this.estimateTestCount(config);
    let completedTests = 0;
    const startTime = Date.now();

    // Emit initial progress
    this.emitProgress('Initializing test suite', completedTests, totalTestCount, startTime);

    // Hook into verifier's test execution to track progress
    const originalAddTestResult = (this.verifier as any).addTestResult.bind(this.verifier);
    (this.verifier as any).addTestResult = (result: IntegrationTestResult) => {
      originalAddTestResult(result);
      completedTests++;
      this.emitProgress(result.testName, completedTests, totalTestCount, startTime);
    };

    try {
      // Run the full integration suite
      const healthReport = await this.verifier.runFullIntegrationSuite();

      // Restore original method
      (this.verifier as any).addTestResult = originalAddTestResult;

      return healthReport;
    } catch (error) {
      // Restore original method even on error
      (this.verifier as any).addTestResult = originalAddTestResult;
      throw error;
    }
  }

  private emitProgress(currentTest: string, completedTests: number, totalTests: number, startTime: number): void {
    const now = Date.now();
    const elapsed = now - startTime;
    const percentage = totalTests > 0 ? (completedTests / totalTests) * 100 : 0;

    let estimatedTimeRemaining = 0;
    if (completedTests > 0) {
      const averageTimePerTest = elapsed / completedTests;
      const remainingTests = totalTests - completedTests;
      estimatedTimeRemaining = averageTimePerTest * remainingTests;
    }

    const progress: TestRunProgress = {
      currentTest,
      completedTests,
      totalTests,
      percentage,
      estimatedTimeRemaining,
    };

    this.emit('progress', progress);

    if (this.currentRunId) {
      log.info('Test progress update', {
        component: 'IntegrationTestRunner',
        metadata: {
          runId: this.currentRunId,
          currentTest,
          percentage: Math.round(percentage),
        },
      });
    }
  }

  // ===== Quick Health Check =====

  /**
   * Run a quick health check (subset of full integration tests)
   */
  public async runQuickHealthCheck(): Promise<TestRunSummary> {
    const config: TestRunConfiguration = {
      includePerformanceBenchmarks: false,
      includeStressTests: false,
      maxExecutionTime: 60000, // 1 minute
      verbose: false,
      generateDetailedReport: false,
    };

    log.info('Starting quick health check', {
      component: 'IntegrationTestRunner',
    });

    // For quick health check, we'll run a minimal set of critical tests
    return this.runMinimalTestSuite(config);
  }

  private async runMinimalTestSuite(config: TestRunConfiguration): Promise<TestRunSummary> {
    const startTime = new Date();
    this.currentRunId = this.generateRunId();

    try {
      const testResults: IntegrationTestResult[] = [];

      // Test 1: Basic tool activation
      const activationResult = await this.testBasicToolActivation();
      testResults.push(activationResult);

      // Test 2: Tool state management
      const stateResult = await this.testBasicStateManagement();
      testResults.push(stateResult);

      // Test 3: Error handling
      const errorResult = await this.testBasicErrorHandling();
      testResults.push(errorResult);

      // Create minimal health report
      const healthReport: SystemHealthReport = {
        overallStatus: testResults.every(r => r.status === 'passed') ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        testResults,
        performanceMetrics: {
          averageToolActivationTime: activationResult.executionTime,
          averageVerificationTime: 0,
          memoryUsage: 0,
          errorRate: testResults.filter(r => r.status === 'failed').length / testResults.length,
        },
        recommendations: [],
      };

      const summary = this.generateRunSummary(healthReport, config, startTime);
      this.addToHistory(summary);

      return summary;
    } catch (error) {
      const errorSummary = this.generateErrorSummary(error as Error, config, startTime);
      this.addToHistory(errorSummary);
      throw error;
    } finally {
      this.currentRunId = null;
    }
  }

  private async testBasicToolActivation(): Promise<IntegrationTestResult> {
    const startTime = Date.now();
    const viewportId = 'quick-test-viewport';

    try {
      this.toolStateManager.initializeViewportTools(viewportId, 'stack');
      this.toolStateManager.setActiveTool(viewportId, 'Length');
      this.toolStateManager.setActiveTool(viewportId, 'Pan');

      const activeTool = this.toolStateManager.getActiveTool(viewportId);
      if (activeTool !== 'Pan') {
        throw new Error('Tool activation failed');
      }

      this.toolStateManager.removeViewportToolState(viewportId);

      return {
        testName: 'Quick Check: Tool Activation',
        status: 'passed',
        executionTime: Date.now() - startTime,
        details: 'Basic tool activation working correctly',
      };
    } catch (error) {
      this.toolStateManager.removeViewportToolState(viewportId);

      return {
        testName: 'Quick Check: Tool Activation',
        status: 'failed',
        executionTime: Date.now() - startTime,
        details: 'Basic tool activation failed',
        errors: [(error as Error).message],
      };
    }
  }

  private async testBasicStateManagement(): Promise<IntegrationTestResult> {
    const startTime = Date.now();
    const viewportId = 'state-test-viewport';

    try {
      this.toolStateManager.initializeViewportTools(viewportId, 'stack');

      // Test annotation management
      const annotation = this.toolStateManager.addAnnotation(viewportId, {
        type: 'arrow',
        data: { text: 'Test', coordinates: [0, 0] },
        isVisible: true,
        isLocked: false,
        style: {},
      });

      const annotations = this.toolStateManager.getAnnotations(viewportId);
      if (annotations.length !== 1 || annotations[0].id !== annotation.id) {
        throw new Error('Annotation management failed');
      }

      this.toolStateManager.removeViewportToolState(viewportId);

      return {
        testName: 'Quick Check: State Management',
        status: 'passed',
        executionTime: Date.now() - startTime,
        details: 'Basic state management working correctly',
      };
    } catch (error) {
      this.toolStateManager.removeViewportToolState(viewportId);

      return {
        testName: 'Quick Check: State Management',
        status: 'failed',
        executionTime: Date.now() - startTime,
        details: 'Basic state management failed',
        errors: [(error as Error).message],
      };
    }
  }

  private async testBasicErrorHandling(): Promise<IntegrationTestResult> {
    const startTime = Date.now();

    try {
      // Test error handling for invalid operations
      let errorCaught = false;

      try {
        this.toolStateManager.setActiveTool('non-existent-viewport', 'Length');
      } catch {
        errorCaught = true;
      }

      if (!errorCaught) {
        throw new Error('Error handling not working properly');
      }

      return {
        testName: 'Quick Check: Error Handling',
        status: 'passed',
        executionTime: Date.now() - startTime,
        details: 'Basic error handling working correctly',
      };
    } catch (error) {
      return {
        testName: 'Quick Check: Error Handling',
        status: 'failed',
        executionTime: Date.now() - startTime,
        details: 'Basic error handling failed',
        errors: [(error as Error).message],
      };
    }
  }

  // ===== Report Generation =====

  private generateRunSummary(
    healthReport: SystemHealthReport,
    config: TestRunConfiguration,
    startTime: Date,
  ): TestRunSummary {
    const endTime = new Date();
    const totalDuration = endTime.getTime() - startTime.getTime();

    const results = {
      totalTests: healthReport.testResults.length,
      passed: healthReport.testResults.filter(r => r.status === 'passed').length,
      failed: healthReport.testResults.filter(r => r.status === 'failed').length,
      warnings: healthReport.testResults.filter(r => r.status === 'warning').length,
      skipped: 0, // Not implemented yet
    };

    let overallStatus: 'success' | 'partial' | 'failure';
    if (results.failed === 0) {
      overallStatus = results.warnings === 0 ? 'success' : 'partial';
    } else {
      overallStatus = results.failed > 5 ? 'failure' : 'partial';
    }

    // Extract critical issues
    const criticalIssues = healthReport.testResults
      .filter(r => r.status === 'failed')
      .map(r => `${r.testName}: ${r.details}`)
      .slice(0, 10); // Limit to top 10

    return {
      runId: this.currentRunId!,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      totalDuration,
      configuration: config,
      results,
      overallStatus,
      criticalIssues,
      recommendations: healthReport.recommendations,
    };
  }

  private generateErrorSummary(error: Error, config: TestRunConfiguration, startTime: Date): TestRunSummary {
    const endTime = new Date();
    const totalDuration = endTime.getTime() - startTime.getTime();

    return {
      runId: this.currentRunId!,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      totalDuration,
      configuration: config,
      results: {
        totalTests: 0,
        passed: 0,
        failed: 1,
        warnings: 0,
        skipped: 0,
      },
      overallStatus: 'failure',
      criticalIssues: [`Test suite execution failed: ${error.message}`],
      recommendations: ['Check system stability', 'Review error logs', 'Verify test environment setup'],
    };
  }

  // ===== History Management =====

  private addToHistory(summary: TestRunSummary): void {
    this.runHistory.unshift(summary); // Add to beginning

    // Maintain history size limit
    if (this.runHistory.length > this.maxHistorySize) {
      this.runHistory = this.runHistory.slice(0, this.maxHistorySize);
    }

    log.info('Test run added to history', {
      component: 'IntegrationTestRunner',
      metadata: {
        runId: summary.runId,
        overallStatus: summary.overallStatus,
        historySize: this.runHistory.length,
      },
    });
  }

  /**
   * Get test run history
   */
  public getRunHistory(limit?: number): TestRunSummary[] {
    if (limit && limit > 0) {
      return this.runHistory.slice(0, limit);
    }
    return [...this.runHistory];
  }

  /**
   * Get specific test run by ID
   */
  public getRunById(runId: string): TestRunSummary | null {
    return this.runHistory.find(run => run.runId === runId) || null;
  }

  /**
   * Clear test run history
   */
  public clearHistory(): void {
    const previousSize = this.runHistory.length;
    this.runHistory = [];

    log.info('Test run history cleared', {
      component: 'IntegrationTestRunner',
      metadata: { previousSize },
    });
  }

  // ===== Utility Methods =====

  private generateRunId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `test-run-${timestamp}-${random}`;
  }

  private estimateTestCount(config: TestRunConfiguration): number {
    let baseTestCount = 25; // Approximate number of core tests

    if (config.includePerformanceBenchmarks) {
      baseTestCount += 10; // Performance tests
    }

    if (config.includeStressTests) {
      baseTestCount += 15; // Stress tests
    }

    return baseTestCount;
  }

  /**
   * Get current run status
   */
  public getCurrentRunStatus(): { isRunning: boolean; runId: string | null } {
    return {
      isRunning: this.currentRunId !== null,
      runId: this.currentRunId,
    };
  }

  /**
   * Generate detailed HTML report
   */
  public generateHTMLReport(summary: TestRunSummary): string {
    const healthReport = this.verifier.getTestResults();
    const benchmarks = this.verifier.getBenchmarks();

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Integration Test Report - ${summary.runId}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; }
        .status-success { color: #28a745; }
        .status-partial { color: #ffc107; }
        .status-failure { color: #dc3545; }
        .test-passed { background: #d4edda; }
        .test-failed { background: #f8d7da; }
        .test-warning { background: #fff3cd; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; }
        .metrics { display: flex; gap: 20px; margin: 20px 0; }
        .metric-card { flex: 1; padding: 20px; background: #f8f9fa; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Integration Test Report</h1>
        <p><strong>Run ID:</strong> ${summary.runId}</p>
        <p><strong>Status:</strong> <span class="status-${summary.overallStatus}">${summary.overallStatus.toUpperCase()}</span></p>
        <p><strong>Duration:</strong> ${(summary.totalDuration / 1000).toFixed(2)} seconds</p>
        <p><strong>Completed:</strong> ${summary.endTime}</p>
    </div>

    <div class="metrics">
        <div class="metric-card">
            <h3>Test Results</h3>
            <p>Total: ${summary.results.totalTests}</p>
            <p>Passed: ${summary.results.passed}</p>
            <p>Failed: ${summary.results.failed}</p>
            <p>Warnings: ${summary.results.warnings}</p>
        </div>
        <div class="metric-card">
            <h3>Performance</h3>
            <p>Avg Tool Activation: ${summary.results.totalTests > 0 ? 'N/A' : '0ms'}</p>
            <p>Avg Verification: ${summary.results.totalTests > 0 ? 'N/A' : '0ms'}</p>
            <p>Error Rate: ${((summary.results.failed / Math.max(summary.results.totalTests, 1)) * 100).toFixed(1)}%</p>
        </div>
    </div>

    <h2>Test Results</h2>
    <table>
        <thead>
            <tr>
                <th>Test Name</th>
                <th>Status</th>
                <th>Duration (ms)</th>
                <th>Details</th>
            </tr>
        </thead>
        <tbody>
            ${healthReport
    .map(
      test => `
                <tr class="test-${test.status}">
                    <td>${test.testName}</td>
                    <td>${test.status.toUpperCase()}</td>
                    <td>${test.executionTime.toFixed(2)}</td>
                    <td>${test.details}</td>
                </tr>
            `,
    )
    .join('')}
        </tbody>
    </table>

    ${
  benchmarks.length > 0
    ? `
    <h2>Performance Benchmarks</h2>
    <table>
        <thead>
            <tr>
                <th>Test Name</th>
                <th>Iterations</th>
                <th>Average (ms)</th>
                <th>Min (ms)</th>
                <th>Max (ms)</th>
                <th>Std Dev</th>
            </tr>
        </thead>
        <tbody>
            ${benchmarks
    .map(
      bench => `
                <tr>
                    <td>${bench.testName}</td>
                    <td>${bench.iterations}</td>
                    <td>${bench.averageTime.toFixed(2)}</td>
                    <td>${bench.minTime.toFixed(2)}</td>
                    <td>${bench.maxTime.toFixed(2)}</td>
                    <td>${bench.standardDeviation.toFixed(2)}</td>
                </tr>
            `,
    )
    .join('')}
        </tbody>
    </table>
    `
    : ''
}

    ${
  summary.recommendations.length > 0
    ? `
    <h2>Recommendations</h2>
    <ul>
        ${summary.recommendations.map(rec => `<li>${rec}</li>`).join('')}
    </ul>
    `
    : ''
}

    <footer>
        <p><small>Generated by Cornerstone3D Integration Test Runner at ${new Date().toISOString()}</small></p>
    </footer>
</body>
</html>`;
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.verifier.dispose();
    this.runHistory = [];
    this.removeAllListeners();

    log.info('IntegrationTestRunner disposed', {
      component: 'IntegrationTestRunner',
    });
  }
}

// Export singleton instance
export const integrationTestRunner = new IntegrationTestRunner();
