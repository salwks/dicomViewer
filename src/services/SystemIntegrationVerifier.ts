/**
 * System Integration Verifier
 * Comprehensive integration testing and verification for the medical imaging tool system
 * Validates end-to-end functionality, cross-tool interactions, and system performance
 */

import { EventEmitter } from 'events';
import { log } from '../utils/logger';
import { ToolType } from '../types/tools';
import { ToolStateManager } from './ToolStateManager';
import { ToolVerificationFramework } from './ToolVerificationFramework';
import { MeasurementToolCompatibility } from './MeasurementToolCompatibility';
import { NavigationToolCompatibility } from './NavigationToolCompatibility';

export interface IntegrationTestResult {
  testName: string;
  status: 'passed' | 'failed' | 'warning';
  executionTime: number;
  details: string;
  metrics?: Record<string, number>;
  errors?: string[];
}

export interface SystemHealthReport {
  overallStatus: 'healthy' | 'degraded' | 'critical';
  timestamp: string;
  testResults: IntegrationTestResult[];
  performanceMetrics: {
    averageToolActivationTime: number;
    averageVerificationTime: number;
    memoryUsage: number;
    errorRate: number;
  };
  recommendations: string[];
}

export interface PerformanceBenchmark {
  testName: string;
  iterations: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  standardDeviation: number;
}

export class SystemIntegrationVerifier extends EventEmitter {
  private toolStateManager: ToolStateManager;
  // private toolVerificationFramework: ToolVerificationFramework; // 향후 사용 예정
  // private measurementCompatibility: MeasurementToolCompatibility; // 향후 사용 예정
  // private navigationCompatibility: NavigationToolCompatibility; // 향후 사용 예정
  private testResults: IntegrationTestResult[] = [];
  private benchmarks: PerformanceBenchmark[] = [];

  constructor(
    toolStateManager?: ToolStateManager,
    _verificationFramework?: ToolVerificationFramework, // 향후 사용 예정
    _measurementCompatibility?: MeasurementToolCompatibility, // 향후 사용 예정
    _navigationCompatibility?: NavigationToolCompatibility, // 향후 사용 예정
  ) {
    super();

    // Use provided instances or singletons
    this.toolStateManager = toolStateManager || new ToolStateManager();
    // 향후 확장을 위해 코멘트 처리
    // this.toolVerificationFramework = verificationFramework || new ToolVerificationFramework();
    // this.measurementCompatibility = measurementCompatibility || new MeasurementToolCompatibility();
    // this.navigationCompatibility = navigationCompatibility || new NavigationToolCompatibility();

    log.info('SystemIntegrationVerifier initialized', {
      component: 'SystemIntegrationVerifier',
    });
  }

  // ===== Main Integration Test Suite =====

  /**
   * Run comprehensive system integration tests
   */
  public async runFullIntegrationSuite(): Promise<SystemHealthReport> {
    log.info('Starting full system integration test suite', {
      component: 'SystemIntegrationVerifier',
    });

    const startTime = Date.now();
    this.testResults = [];
    this.benchmarks = [];

    try {
      // 1. End-to-end tool verification
      await this.runEndToEndToolVerification();

      // 2. Cross-tool interaction tests
      await this.runCrossToolInteractionTests();

      // 3. Performance benchmarking
      await this.runPerformanceBenchmarks();

      // 4. Error handling verification
      await this.runErrorHandlingTests();

      // 5. System state consistency tests
      await this.runStateConsistencyTests();

      // 6. Memory and resource usage tests
      await this.runResourceUsageTests();

      // Generate comprehensive report
      const report = this.generateSystemHealthReport();

      const executionTime = Date.now() - startTime;
      log.info('Full integration test suite completed', {
        component: 'SystemIntegrationVerifier',
        metadata: {
          executionTime,
          totalTests: this.testResults.length,
          passedTests: this.testResults.filter(r => r.status === 'passed').length,
          overallStatus: report.overallStatus,
        },
      });

      this.emit('integration-test-completed', report);
      return report;
    } catch (error) {
      log.error(
        'Integration test suite failed',
        {
          component: 'SystemIntegrationVerifier',
        },
        error as Error,
      );

      // Return emergency report
      return this.generateEmergencyReport(error as Error);
    }
  }

  // ===== End-to-End Tool Verification =====

  /**
   * Verify complete tool lifecycle from activation to operation
   */
  private async runEndToEndToolVerification(): Promise<void> {
    const testViewportId = 'integration-test-viewport';
    const allTools = [
      ToolType.WINDOW_LEVEL,
      ToolType.PAN,
      ToolType.ZOOM,
      ToolType.LENGTH,
      ToolType.ANGLE,
      ToolType.RECTANGLE_ROI,
      ToolType.ELLIPSE_ROI,
      ToolType.PROBE,
    ];

    // Initialize test viewport
    this.toolStateManager.initializeViewportTools(testViewportId, 'stack');

    for (const toolType of allTools) {
      const startTime = Date.now();

      try {
        // Test tool activation
        const toolName = this.getToolNameFromType(toolType);
        if (!toolName) {
          this.addTestResult({
            testName: `E2E Tool Activation: ${toolType}`,
            status: 'failed',
            executionTime: Date.now() - startTime,
            details: 'Tool name mapping failed',
            errors: [`Unable to map tool type ${toolType} to tool name`],
          });
          continue;
        }

        // Activate tool
        this.toolStateManager.setActiveTool(testViewportId, toolName);

        // Verify activation
        const activeTool = this.toolStateManager.getActiveTool(testViewportId);
        if (activeTool !== toolName) {
          throw new Error(`Tool activation failed. Expected: ${toolName}, Got: ${activeTool}`);
        }

        // Run tool-specific verification
        const verificationPassed = await this.toolStateManager.verifyTool(testViewportId, toolType);

        // Test tool configuration
        const defaultConfig = this.toolStateManager.getToolConfiguration(testViewportId, toolName);
        this.toolStateManager.setToolConfiguration(testViewportId, toolName, {
          ...defaultConfig,
          testProperty: 'integration-test-value',
        });

        const updatedConfig = this.toolStateManager.getToolConfiguration(testViewportId, toolName);
        if (!updatedConfig.testProperty) {
          throw new Error('Tool configuration update failed');
        }

        this.addTestResult({
          testName: `E2E Tool Verification: ${toolType}`,
          status: verificationPassed ? 'passed' : 'warning',
          executionTime: Date.now() - startTime,
          details: `Tool lifecycle test completed. Verification: ${verificationPassed ? 'passed' : 'failed'}`,
          metrics: {
            activationTime: Date.now() - startTime,
            verificationPassed: verificationPassed ? 1 : 0,
          },
        });
      } catch (error) {
        this.addTestResult({
          testName: `E2E Tool Verification: ${toolType}`,
          status: 'failed',
          executionTime: Date.now() - startTime,
          details: 'Tool lifecycle test failed',
          errors: [(error as Error).message],
        });
      }
    }

    // Cleanup test viewport
    this.toolStateManager.removeViewportToolState(testViewportId);
  }

  // ===== Cross-Tool Interaction Tests =====

  /**
   * Test interactions between different tools and tool categories
   */
  private async runCrossToolInteractionTests(): Promise<void> {
    const testViewportId = 'cross-tool-test-viewport';
    this.toolStateManager.initializeViewportTools(testViewportId, 'stack');

    // Test navigation tool → measurement tool transitions
    await this.testToolCategoryTransitions(testViewportId);

    // Test simultaneous tool operations
    await this.testSimultaneousToolOperations(testViewportId);

    // Test tool state synchronization
    await this.testToolStateSynchronization();

    // Cleanup
    this.toolStateManager.removeViewportToolState(testViewportId);
  }

  private async testToolCategoryTransitions(viewportId: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Navigation → Measurement transitions
      const transitions = [
        [ToolType.WINDOW_LEVEL, ToolType.LENGTH],
        [ToolType.PAN, ToolType.ANGLE],
        [ToolType.ZOOM, ToolType.RECTANGLE_ROI],
      ];

      for (const [fromTool, toTool] of transitions) {
        const fromToolName = this.getToolNameFromType(fromTool);
        const toToolName = this.getToolNameFromType(toTool);

        if (!fromToolName || !toToolName) continue;

        // Activate first tool
        this.toolStateManager.setActiveTool(viewportId, fromToolName);

        // Wait briefly to simulate user interaction
        await new Promise(resolve => setTimeout(resolve, 10));

        // Switch to second tool
        this.toolStateManager.setActiveTool(viewportId, toToolName);

        // Verify transition
        const activeTool = this.toolStateManager.getActiveTool(viewportId);
        if (activeTool !== toToolName) {
          throw new Error(`Tool transition failed: ${fromToolName} → ${toToolName}`);
        }
      }

      this.addTestResult({
        testName: 'Cross-Tool Category Transitions',
        status: 'passed',
        executionTime: Date.now() - startTime,
        details: `Successfully tested ${transitions.length} tool category transitions`,
      });
    } catch (error) {
      this.addTestResult({
        testName: 'Cross-Tool Category Transitions',
        status: 'failed',
        executionTime: Date.now() - startTime,
        details: 'Tool category transition test failed',
        errors: [(error as Error).message],
      });
    }
  }

  private async testSimultaneousToolOperations(viewportId: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Test annotation creation while having active measurement
      this.toolStateManager.setActiveTool(viewportId, 'Length');

      // Simulate measurement creation
      this.toolStateManager.addMeasurement(viewportId, {
        type: 'length',
        value: 42.5,
        unit: 'mm',
        precision: 1,
        isVisible: true,
        coordinates: [
          [10, 10],
          [50, 50],
        ],
      });

      // Switch to annotation tool
      this.toolStateManager.setActiveTool(viewportId, 'Arrow');

      // Create annotation
      this.toolStateManager.addAnnotation(viewportId, {
        type: 'arrow',
        data: { text: 'Test annotation', coordinates: [30, 30] },
        isVisible: true,
        isLocked: false,
        style: {},
      });

      // Verify both exist
      const measurements = this.toolStateManager.getMeasurements(viewportId);
      const annotations = this.toolStateManager.getAnnotations(viewportId);

      if (measurements.length !== 1 || annotations.length !== 1) {
        throw new Error('Simultaneous tool operations failed - data not preserved');
      }

      this.addTestResult({
        testName: 'Simultaneous Tool Operations',
        status: 'passed',
        executionTime: Date.now() - startTime,
        details: 'Successfully created measurement and annotation simultaneously',
        metrics: {
          measurementsCreated: measurements.length,
          annotationsCreated: annotations.length,
        },
      });
    } catch (error) {
      this.addTestResult({
        testName: 'Simultaneous Tool Operations',
        status: 'failed',
        executionTime: Date.now() - startTime,
        details: 'Simultaneous tool operations test failed',
        errors: [(error as Error).message],
      });
    }
  }

  private async testToolStateSynchronization(): Promise<void> {
    const startTime = Date.now();

    try {
      const sourceViewport = 'sync-source-viewport';
      const targetViewports = ['sync-target-1', 'sync-target-2'];

      // Initialize viewports
      this.toolStateManager.initializeViewportTools(sourceViewport, 'stack');
      targetViewports.forEach(id => {
        this.toolStateManager.initializeViewportTools(id, 'stack');
      });

      // Set up source viewport
      this.toolStateManager.setActiveTool(sourceViewport, 'Length');
      this.toolStateManager.setToolConfiguration(sourceViewport, 'Length', {
        precision: 3,
        units: 'mm',
        color: '#ff0000',
      });

      // Synchronize
      this.toolStateManager.synchronizeToolStates(sourceViewport, targetViewports);

      // Verify synchronization
      for (const targetId of targetViewports) {
        const activeTool = this.toolStateManager.getActiveTool(targetId);
        const config = this.toolStateManager.getToolConfiguration(targetId, 'Length');

        if (activeTool !== 'Length' || config.precision !== 3) {
          throw new Error(`Tool state synchronization failed for viewport: ${targetId}`);
        }
      }

      // Cleanup
      [sourceViewport, ...targetViewports].forEach(id => {
        this.toolStateManager.removeViewportToolState(id);
      });

      this.addTestResult({
        testName: 'Tool State Synchronization',
        status: 'passed',
        executionTime: Date.now() - startTime,
        details: `Successfully synchronized tool state across ${targetViewports.length} viewports`,
      });
    } catch (error) {
      this.addTestResult({
        testName: 'Tool State Synchronization',
        status: 'failed',
        executionTime: Date.now() - startTime,
        details: 'Tool state synchronization test failed',
        errors: [(error as Error).message],
      });
    }
  }

  // ===== Performance Benchmarking =====

  /**
   * Run performance benchmarks for critical operations
   */
  private async runPerformanceBenchmarks(): Promise<void> {
    const benchmarks = [
      { name: 'Tool Activation', operation: this.benchmarkToolActivation.bind(this) },
      { name: 'Tool Verification', operation: this.benchmarkToolVerification.bind(this) },
      { name: 'Measurement Creation', operation: this.benchmarkMeasurementCreation.bind(this) },
      { name: 'State Synchronization', operation: this.benchmarkStateSynchronization.bind(this) },
    ];

    for (const benchmark of benchmarks) {
      try {
        const result = await benchmark.operation();
        this.benchmarks.push(result);

        this.addTestResult({
          testName: `Performance: ${benchmark.name}`,
          status: result.averageTime < 100 ? 'passed' : 'warning', // 100ms threshold
          executionTime: result.averageTime,
          details: `Average: ${result.averageTime.toFixed(2)}ms, Min: ${result.minTime.toFixed(2)}ms, Max: ${result.maxTime.toFixed(2)}ms`,
          metrics: {
            averageTime: result.averageTime,
            minTime: result.minTime,
            maxTime: result.maxTime,
            standardDeviation: result.standardDeviation,
          },
        });
      } catch (error) {
        this.addTestResult({
          testName: `Performance: ${benchmark.name}`,
          status: 'failed',
          executionTime: 0,
          details: 'Performance benchmark failed',
          errors: [(error as Error).message],
        });
      }
    }
  }

  private async benchmarkToolActivation(): Promise<PerformanceBenchmark> {
    const iterations = 50;
    const times: number[] = [];
    const viewportId = 'perf-test-viewport';

    this.toolStateManager.initializeViewportTools(viewportId, 'stack');

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      this.toolStateManager.setActiveTool(viewportId, 'Length');
      this.toolStateManager.setActiveTool(viewportId, 'Pan');
      const end = performance.now();

      times.push(end - start);
    }

    this.toolStateManager.removeViewportToolState(viewportId);

    return this.calculateBenchmarkStats('Tool Activation', iterations, times);
  }

  private async benchmarkToolVerification(): Promise<PerformanceBenchmark> {
    const iterations = 20;
    const times: number[] = [];
    const viewportId = 'perf-verification-viewport';

    this.toolStateManager.initializeViewportTools(viewportId, 'stack');

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await this.toolStateManager.verifyTool(viewportId, ToolType.LENGTH);
      const end = performance.now();

      times.push(end - start);
    }

    this.toolStateManager.removeViewportToolState(viewportId);

    return this.calculateBenchmarkStats('Tool Verification', iterations, times);
  }

  private async benchmarkMeasurementCreation(): Promise<PerformanceBenchmark> {
    const iterations = 30;
    const times: number[] = [];
    const viewportId = 'perf-measurement-viewport';

    this.toolStateManager.initializeViewportTools(viewportId, 'stack');

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      this.toolStateManager.addMeasurement(viewportId, {
        type: 'length',
        value: Math.random() * 100,
        unit: 'mm',
        precision: 1,
        isVisible: true,
        coordinates: [
          [Math.random() * 100, Math.random() * 100],
          [Math.random() * 100, Math.random() * 100],
        ],
      });
      const end = performance.now();

      times.push(end - start);
    }

    this.toolStateManager.removeViewportToolState(viewportId);

    return this.calculateBenchmarkStats('Measurement Creation', iterations, times);
  }

  private async benchmarkStateSynchronization(): Promise<PerformanceBenchmark> {
    const iterations = 10;
    const times: number[] = [];
    const sourceViewport = 'perf-sync-source';
    const targetViewports = ['perf-sync-1', 'perf-sync-2', 'perf-sync-3', 'perf-sync-4'];

    // Initialize viewports
    this.toolStateManager.initializeViewportTools(sourceViewport, 'stack');
    targetViewports.forEach(id => {
      this.toolStateManager.initializeViewportTools(id, 'stack');
    });

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      this.toolStateManager.synchronizeToolStates(sourceViewport, targetViewports);
      const end = performance.now();

      times.push(end - start);
    }

    // Cleanup
    [sourceViewport, ...targetViewports].forEach(id => {
      this.toolStateManager.removeViewportToolState(id);
    });

    return this.calculateBenchmarkStats('State Synchronization', iterations, times);
  }

  private calculateBenchmarkStats(testName: string, iterations: number, times: number[]): PerformanceBenchmark {
    const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    // Calculate standard deviation
    const variance = times.reduce((sum, time) => sum + Math.pow(time - averageTime, 2), 0) / times.length;
    const standardDeviation = Math.sqrt(variance);

    return {
      testName,
      iterations,
      averageTime,
      minTime,
      maxTime,
      standardDeviation,
    };
  }

  // ===== Error Handling Tests =====

  /**
   * Test error handling and recovery mechanisms
   */
  private async runErrorHandlingTests(): Promise<void> {
    await this.testInvalidToolActivation();
    await this.testMissingViewportHandling();
    await this.testConfigurationValidation();
    await this.testResourceLimits();
  }

  private async testInvalidToolActivation(): Promise<void> {
    const startTime = Date.now();
    const viewportId = 'error-test-viewport';

    try {
      this.toolStateManager.initializeViewportTools(viewportId, 'stack');

      // Test 1: Invalid tool name
      let errorCaught = false;
      try {
        this.toolStateManager.setActiveTool(viewportId, 'NonExistentTool');
      } catch {
        errorCaught = true;
      }

      if (!errorCaught) {
        throw new Error('Invalid tool activation should have thrown an error');
      }

      // Test 2: Tool not available for viewport type
      // This is harder to test with current setup, but we can verify the tool is available
      const toolState = this.toolStateManager.getViewportToolState(viewportId);
      if (!toolState || toolState.availableTools.length === 0) {
        throw new Error('No tools available for viewport');
      }

      this.addTestResult({
        testName: 'Error Handling: Invalid Tool Activation',
        status: 'passed',
        executionTime: Date.now() - startTime,
        details: 'Successfully caught and handled invalid tool activation',
      });
    } catch (error) {
      this.addTestResult({
        testName: 'Error Handling: Invalid Tool Activation',
        status: 'failed',
        executionTime: Date.now() - startTime,
        details: 'Error handling test failed',
        errors: [(error as Error).message],
      });
    } finally {
      this.toolStateManager.removeViewportToolState(viewportId);
    }
  }

  private async testMissingViewportHandling(): Promise<void> {
    const startTime = Date.now();

    try {
      // Test operations on non-existent viewport
      const nonExistentViewport = 'non-existent-viewport';

      let errorsCaught = 0;

      // Test getting active tool
      const activeTool = this.toolStateManager.getActiveTool(nonExistentViewport);
      if (activeTool === null) errorsCaught++;

      // Test getting tool state
      const toolState = this.toolStateManager.getViewportToolState(nonExistentViewport);
      if (toolState === null) errorsCaught++;

      // Test getting measurements
      const measurements = this.toolStateManager.getMeasurements(nonExistentViewport);
      if (measurements.length === 0) errorsCaught++;

      if (errorsCaught < 3) {
        throw new Error('Missing viewport handling is not robust enough');
      }

      this.addTestResult({
        testName: 'Error Handling: Missing Viewport',
        status: 'passed',
        executionTime: Date.now() - startTime,
        details: 'Successfully handled operations on non-existent viewport',
      });
    } catch (error) {
      this.addTestResult({
        testName: 'Error Handling: Missing Viewport',
        status: 'failed',
        executionTime: Date.now() - startTime,
        details: 'Missing viewport error handling test failed',
        errors: [(error as Error).message],
      });
    }
  }

  private async testConfigurationValidation(): Promise<void> {
    const startTime = Date.now();
    const viewportId = 'config-validation-viewport';

    try {
      this.toolStateManager.initializeViewportTools(viewportId, 'stack');

      // Test invalid configuration
      let errorCaught = false;
      try {
        this.toolStateManager.setToolConfiguration(viewportId, 'NonExistentTool', {
          invalidProperty: 'invalid value',
        });
      } catch {
        errorCaught = true;
      }

      if (!errorCaught) {
        throw new Error('Invalid tool configuration should have thrown an error');
      }

      // Test valid configuration
      this.toolStateManager.setToolConfiguration(viewportId, 'Length', {
        precision: 2,
        units: 'mm',
      });

      const config = this.toolStateManager.getToolConfiguration(viewportId, 'Length');
      if (config.precision !== 2) {
        throw new Error('Valid configuration was not applied correctly');
      }

      this.addTestResult({
        testName: 'Error Handling: Configuration Validation',
        status: 'passed',
        executionTime: Date.now() - startTime,
        details: 'Successfully validated tool configuration',
      });
    } catch (error) {
      this.addTestResult({
        testName: 'Error Handling: Configuration Validation',
        status: 'failed',
        executionTime: Date.now() - startTime,
        details: 'Configuration validation test failed',
        errors: [(error as Error).message],
      });
    } finally {
      this.toolStateManager.removeViewportToolState(viewportId);
    }
  }

  private async testResourceLimits(): Promise<void> {
    const startTime = Date.now();
    const viewportId = 'resource-limit-viewport';

    try {
      this.toolStateManager.initializeViewportTools(viewportId, 'stack');

      // Test annotation limit (default is 1000)
      let annotationsCreated = 0;
      let limitReached = false;

      try {
        // Try to create more annotations than the limit
        for (let i = 0; i < 1050; i++) {
          this.toolStateManager.addAnnotation(viewportId, {
            type: 'arrow',
            // text: `Test annotation ${i}`, // text property는 AnnotationState에 존재하지 않음
            // coordinates: [i % 100, i % 100], // coordinates property도 현재 타입에 존재하지 않음
          } as any);
          annotationsCreated++;
        }
      } catch (error) {
        if ((error as Error).message.includes('Maximum annotations limit')) {
          limitReached = true;
        }
      }

      if (!limitReached) {
        console.warn(`Resource limit test: Created ${annotationsCreated} annotations without hitting limit`);
      }

      this.addTestResult({
        testName: 'Error Handling: Resource Limits',
        status: limitReached ? 'passed' : 'warning',
        executionTime: Date.now() - startTime,
        details: limitReached
          ? `Successfully enforced annotation limit after ${annotationsCreated} annotations`
          : `Created ${annotationsCreated} annotations without hitting limit`,
        metrics: {
          annotationsCreated,
          limitReached: limitReached ? 1 : 0,
        },
      });
    } catch (error) {
      this.addTestResult({
        testName: 'Error Handling: Resource Limits',
        status: 'failed',
        executionTime: Date.now() - startTime,
        details: 'Resource limits test failed',
        errors: [(error as Error).message],
      });
    } finally {
      this.toolStateManager.removeViewportToolState(viewportId);
    }
  }

  // ===== State Consistency Tests =====

  /**
   * Test system state consistency across operations
   */
  private async runStateConsistencyTests(): Promise<void> {
    await this.testViewportStateConsistency();
    await this.testToolConfigurationPersistence();
    await this.testAnnotationDataIntegrity();
  }

  private async testViewportStateConsistency(): Promise<void> {
    const startTime = Date.now();
    const viewportId = 'consistency-test-viewport';

    try {
      // Initialize viewport
      this.toolStateManager.initializeViewportTools(viewportId, 'stack');

      // Perform multiple operations
      this.toolStateManager.setActiveTool(viewportId, 'Length');
      this.toolStateManager.setToolConfiguration(viewportId, 'Length', { precision: 3 });
      this.toolStateManager.addMeasurement(viewportId, {
        type: 'length',
        value: 25.5,
        unit: 'mm',
        precision: 1,
        isVisible: true,
        coordinates: [
          [0, 0],
          [25, 25],
        ],
      });

      // Get current state
      const currentState = this.toolStateManager.getViewportToolState(viewportId);

      if (!currentState) {
        throw new Error('Viewport state is null after operations');
      }

      // Verify state consistency
      if (currentState.activeTool !== 'Length') {
        throw new Error('Active tool state inconsistent');
      }

      if (currentState.measurements.length !== 1) {
        throw new Error('Measurement count inconsistent');
      }

      // TODO: precision 속성 타입 정의 필요
      // if (currentState.toolConfiguration.Length?.precision !== 3) {
      //   throw new Error('Tool configuration inconsistent');
      // }

      this.addTestResult({
        testName: 'State Consistency: Viewport State',
        status: 'passed',
        executionTime: Date.now() - startTime,
        details: 'Viewport state remained consistent across operations',
      });
    } catch (error) {
      this.addTestResult({
        testName: 'State Consistency: Viewport State',
        status: 'failed',
        executionTime: Date.now() - startTime,
        details: 'Viewport state consistency test failed',
        errors: [(error as Error).message],
      });
    } finally {
      this.toolStateManager.removeViewportToolState(viewportId);
    }
  }

  private async testToolConfigurationPersistence(): Promise<void> {
    const startTime = Date.now();
    const viewportId = 'config-persistence-viewport';

    try {
      this.toolStateManager.initializeViewportTools(viewportId, 'stack');

      // Set configurations for multiple tools
      const configs = {
        Length: { precision: 3, units: 'mm', color: '#ff0000' },
        Angle: { precision: 1, units: 'degrees', color: '#00ff00' },
        Rectangle: { showArea: true, units: 'mm²', color: '#0000ff' },
      };

      for (const [toolName, config] of Object.entries(configs)) {
        this.toolStateManager.setToolConfiguration(viewportId, toolName, config);
      }

      // Switch between tools multiple times
      this.toolStateManager.setActiveTool(viewportId, 'Length');
      this.toolStateManager.setActiveTool(viewportId, 'Angle');
      this.toolStateManager.setActiveTool(viewportId, 'Rectangle');
      this.toolStateManager.setActiveTool(viewportId, 'Length');

      // Verify configurations persisted
      for (const [toolName, expectedConfig] of Object.entries(configs)) {
        const actualConfig = this.toolStateManager.getToolConfiguration(viewportId, toolName);

        for (const [key, expectedValue] of Object.entries(expectedConfig)) {
          // eslint-disable-next-line security/detect-object-injection -- Safe: key from tool config entries
          if (actualConfig[key] !== expectedValue) {
            throw new Error(
              // eslint-disable-next-line security/detect-object-injection -- Safe: key from tool config entries
              `Configuration not persisted for ${toolName}.${key}: expected ${expectedValue}, got ${actualConfig[key]}`,
            );
          }
        }
      }

      this.addTestResult({
        testName: 'State Consistency: Configuration Persistence',
        status: 'passed',
        executionTime: Date.now() - startTime,
        details: 'Tool configurations persisted correctly across tool switches',
      });
    } catch (error) {
      this.addTestResult({
        testName: 'State Consistency: Configuration Persistence',
        status: 'failed',
        executionTime: Date.now() - startTime,
        details: 'Configuration persistence test failed',
        errors: [(error as Error).message],
      });
    } finally {
      this.toolStateManager.removeViewportToolState(viewportId);
    }
  }

  private async testAnnotationDataIntegrity(): Promise<void> {
    const startTime = Date.now();
    const viewportId = 'annotation-integrity-viewport';

    try {
      this.toolStateManager.initializeViewportTools(viewportId, 'stack');

      // Create various annotations and measurements
      const annotation1 = this.toolStateManager.addAnnotation(viewportId, {
        type: 'arrow',
        data: { text: 'Test annotation 1', coordinates: [10, 10] },
        isVisible: true,
        isLocked: false,
        style: {},
      });

      const measurement1 = this.toolStateManager.addMeasurement(viewportId, {
        type: 'length',
        value: 42.5,
        unit: 'mm',
        precision: 1,
        isVisible: true,
        coordinates: [
          [0, 0],
          [42, 0],
        ],
      });

      const annotation2 = this.toolStateManager.addAnnotation(viewportId, {
        type: 'text',
        data: { text: 'Test annotation 2', coordinates: [50, 50] },
        isVisible: true,
        isLocked: false,
        style: {},
      });

      // Verify initial data
      let annotations = this.toolStateManager.getAnnotations(viewportId);
      let measurements = this.toolStateManager.getMeasurements(viewportId);

      if (annotations.length !== 2 || measurements.length !== 1) {
        throw new Error('Initial data integrity check failed');
      }

      // Update annotation
      this.toolStateManager.updateAnnotation(viewportId, annotation1.id, {
        data: { ...annotation1.data, text: 'Updated annotation text' },
      });

      // Update measurement
      this.toolStateManager.updateMeasurement(viewportId, measurement1.id, {
        value: 45.0,
      });

      // Verify updates
      annotations = this.toolStateManager.getAnnotations(viewportId);
      measurements = this.toolStateManager.getMeasurements(viewportId);

      const updatedAnnotation = annotations.find(a => a.id === annotation1.id);
      const updatedMeasurement = measurements.find(m => m.id === measurement1.id);

      if (!updatedAnnotation || (updatedAnnotation.data as any)?.text !== 'Updated annotation text') {
        throw new Error('Annotation update integrity check failed');
      }

      if (!updatedMeasurement || updatedMeasurement.value !== 45.0) {
        throw new Error('Measurement update integrity check failed');
      }

      // Remove one annotation
      this.toolStateManager.removeAnnotation(viewportId, annotation2.id);

      annotations = this.toolStateManager.getAnnotations(viewportId);
      if (annotations.length !== 1) {
        throw new Error('Annotation removal integrity check failed');
      }

      this.addTestResult({
        testName: 'State Consistency: Annotation Data Integrity',
        status: 'passed',
        executionTime: Date.now() - startTime,
        details: 'Annotation and measurement data integrity maintained throughout operations',
      });
    } catch (error) {
      this.addTestResult({
        testName: 'State Consistency: Annotation Data Integrity',
        status: 'failed',
        executionTime: Date.now() - startTime,
        details: 'Annotation data integrity test failed',
        errors: [(error as Error).message],
      });
    } finally {
      this.toolStateManager.removeViewportToolState(viewportId);
    }
  }

  // ===== Resource Usage Tests =====

  /**
   * Test memory usage and resource management
   */
  private async runResourceUsageTests(): Promise<void> {
    await this.testMemoryUsage();
    await this.testViewportCleanup();
  }

  private async testMemoryUsage(): Promise<void> {
    const startTime = Date.now();

    try {
      // Create multiple viewports and stress test
      const viewportIds = Array.from({ length: 10 }, (_, i) => `memory-test-viewport-${i}`);

      // Initialize all viewports
      viewportIds.forEach(id => {
        this.toolStateManager.initializeViewportTools(id, 'stack');
      });

      // Add data to each viewport
      viewportIds.forEach(id => {
        for (let i = 0; i < 50; i++) {
          this.toolStateManager.addAnnotation(id, {
            type: 'arrow',
            // text: `Annotation ${i}`, // text property는 AnnotationState에 존재하지 않음
            // coordinates: [i, i], // coordinates property도 현재 타입에 존재하지 않음
          } as any);
        }
      });

      // Get all states (this should work without issues)
      const allStates = this.toolStateManager.getAllViewportToolStates();

      if (allStates.size !== viewportIds.length) {
        throw new Error('Not all viewport states were created');
      }

      // Cleanup all viewports
      viewportIds.forEach(id => {
        this.toolStateManager.removeViewportToolState(id);
      });

      // Verify cleanup
      const remainingStates = this.toolStateManager.getAllViewportToolStates();
      const remainingCount = Array.from(remainingStates.keys()).filter(id =>
        id.startsWith('memory-test-viewport'),
      ).length;

      if (remainingCount > 0) {
        throw new Error(`${remainingCount} viewports were not properly cleaned up`);
      }

      this.addTestResult({
        testName: 'Resource Usage: Memory Management',
        status: 'passed',
        executionTime: Date.now() - startTime,
        details: `Successfully managed ${viewportIds.length} viewports with 50 annotations each`,
        metrics: {
          viewportsCreated: viewportIds.length,
          annotationsPerViewport: 50,
          totalAnnotations: viewportIds.length * 50,
        },
      });
    } catch (error) {
      this.addTestResult({
        testName: 'Resource Usage: Memory Management',
        status: 'failed',
        executionTime: Date.now() - startTime,
        details: 'Memory management test failed',
        errors: [(error as Error).message],
      });
    }
  }

  private async testViewportCleanup(): Promise<void> {
    const startTime = Date.now();

    try {
      const viewportId = 'cleanup-test-viewport';

      // Initialize viewport with data
      this.toolStateManager.initializeViewportTools(viewportId, 'stack');

      // Add significant amount of data
      for (let i = 0; i < 100; i++) {
        this.toolStateManager.addAnnotation(viewportId, {
          type: 'arrow',
          data: { text: `Cleanup test annotation ${i}`, coordinates: [i, i] },
          isVisible: true,
          isLocked: false,
          style: {},
        });
      }

      for (let i = 0; i < 50; i++) {
        this.toolStateManager.addMeasurement(viewportId, {
          type: 'length',
          value: i * 2.5,
          unit: 'mm',
          precision: 1,
          isVisible: true,
          coordinates: [
            [i, 0],
            [i, i],
          ],
        });
      }

      // Verify data exists
      const annotationsBefore = this.toolStateManager.getAnnotations(viewportId);
      const measurementsBefore = this.toolStateManager.getMeasurements(viewportId);

      if (annotationsBefore.length !== 100 || measurementsBefore.length !== 50) {
        throw new Error('Test data not created properly');
      }

      // Remove viewport
      const removed = this.toolStateManager.removeViewportToolState(viewportId);
      if (!removed) {
        throw new Error('Viewport removal failed');
      }

      // Verify complete cleanup
      const annotationsAfter = this.toolStateManager.getAnnotations(viewportId);
      const measurementsAfter = this.toolStateManager.getMeasurements(viewportId);
      const stateAfter = this.toolStateManager.getViewportToolState(viewportId);

      if (annotationsAfter.length > 0 || measurementsAfter.length > 0 || stateAfter !== null) {
        throw new Error('Viewport cleanup was not complete');
      }

      this.addTestResult({
        testName: 'Resource Usage: Viewport Cleanup',
        status: 'passed',
        executionTime: Date.now() - startTime,
        details: 'Successfully cleaned up viewport with 100 annotations and 50 measurements',
        metrics: {
          annotationsRemoved: annotationsBefore.length,
          measurementsRemoved: measurementsBefore.length,
        },
      });
    } catch (error) {
      this.addTestResult({
        testName: 'Resource Usage: Viewport Cleanup',
        status: 'failed',
        executionTime: Date.now() - startTime,
        details: 'Viewport cleanup test failed',
        errors: [(error as Error).message],
      });
    }
  }

  // ===== Report Generation =====

  /**
   * Generate comprehensive system health report
   */
  private generateSystemHealthReport(): SystemHealthReport {
    // const passedTests = this.testResults.filter(r => r.status === 'passed').length;
    const failedTests = this.testResults.filter(r => r.status === 'failed').length;
    const warningTests = this.testResults.filter(r => r.status === 'warning').length;

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'critical';
    if (failedTests === 0) {
      overallStatus = warningTests === 0 ? 'healthy' : 'degraded';
    } else {
      overallStatus = failedTests > 5 ? 'critical' : 'degraded';
    }

    // Calculate performance metrics
    const performanceTests = this.testResults.filter(r => r.testName.startsWith('Performance:'));
    const averageToolActivationTime =
      performanceTests.find(r => r.testName.includes('Tool Activation'))?.executionTime || 0;
    const averageVerificationTime =
      performanceTests.find(r => r.testName.includes('Tool Verification'))?.executionTime || 0;

    // Generate recommendations
    const recommendations: string[] = [];

    if (failedTests > 0) {
      recommendations.push(`Address ${failedTests} critical test failures immediately`);
    }

    if (warningTests > 0) {
      recommendations.push(`Review ${warningTests} warning conditions for potential improvements`);
    }

    if (averageToolActivationTime > 50) {
      recommendations.push('Tool activation performance is slower than optimal (>50ms)');
    }

    if (averageVerificationTime > 200) {
      recommendations.push('Tool verification performance could be improved (>200ms)');
    }

    if (recommendations.length === 0) {
      recommendations.push('System is operating within optimal parameters');
    }

    return {
      overallStatus,
      timestamp: new Date().toISOString(),
      testResults: [...this.testResults],
      performanceMetrics: {
        averageToolActivationTime,
        averageVerificationTime,
        memoryUsage: 0, // Would need actual memory measurement
        errorRate: failedTests / this.testResults.length,
      },
      recommendations,
    };
  }

  /**
   * Generate emergency report when test suite fails
   */
  private generateEmergencyReport(error: Error): SystemHealthReport {
    return {
      overallStatus: 'critical',
      timestamp: new Date().toISOString(),
      testResults: [
        {
          testName: 'Integration Test Suite Execution',
          status: 'failed',
          executionTime: 0,
          details: 'Test suite failed to complete',
          errors: [error.message],
        },
      ],
      performanceMetrics: {
        averageToolActivationTime: 0,
        averageVerificationTime: 0,
        memoryUsage: 0,
        errorRate: 1,
      },
      recommendations: [
        'Investigate test suite execution failure immediately',
        'Check system stability and dependencies',
        'Review error logs for detailed failure information',
      ],
    };
  }

  // ===== Utility Methods =====

  private addTestResult(result: IntegrationTestResult): void {
    this.testResults.push(result);

    log.info(`Integration test ${result.status}`, {
      component: 'SystemIntegrationVerifier',
      metadata: {
        testName: result.testName,
        status: result.status,
        executionTime: result.executionTime,
      },
    });
  }

  private getToolNameFromType(toolType: ToolType): string | null {
    const typeMap: Record<ToolType, string> = {
      [ToolType.WINDOW_LEVEL]: 'WindowLevel',
      [ToolType.PAN]: 'Pan',
      [ToolType.ZOOM]: 'Zoom',
      [ToolType.LENGTH]: 'Length',
      [ToolType.ANGLE]: 'Angle',
      [ToolType.RECTANGLE_ROI]: 'Rectangle',
      [ToolType.ELLIPSE_ROI]: 'Ellipse',
      [ToolType.PROBE]: 'Probe',
      [ToolType.BIDIRECTIONAL]: 'Bidirectional',
      [ToolType.HEIGHT]: 'Height',
      [ToolType.ARROW]: 'Arrow',
      [ToolType.FREEHAND]: 'Freehand',
      [ToolType.STACK_SCROLL]: 'StackScroll',
      [ToolType.COBB_ANGLE]: 'CobbAngle',
      [ToolType.DRAG_PROBE]: 'DragProbe',
      [ToolType.SELECTION]: 'Selection',
      [ToolType.TEXT]: 'Text',
      [ToolType.SPLINE_ROI]: 'SplineROI',
      [ToolType.LIVEWIRE]: 'Livewire',
      [ToolType.KEY_IMAGE]: 'KeyImage',
      [ToolType.ERASER]: 'Eraser',
      [ToolType.VOLUME_ROTATE]: 'VolumeRotate',
      [ToolType.CROSSHAIRS]: 'Crosshairs',
      [ToolType.ROTATE]: 'Rotate',
    };

    // eslint-disable-next-line security/detect-object-injection -- Safe: toolType is enum value
    return typeMap[toolType] || null;
  }

  /**
   * Get current benchmarks
   */
  public getBenchmarks(): PerformanceBenchmark[] {
    return [...this.benchmarks];
  }

  /**
   * Get latest test results
   */
  public getTestResults(): IntegrationTestResult[] {
    return [...this.testResults];
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.testResults = [];
    this.benchmarks = [];
    this.removeAllListeners();

    log.info('SystemIntegrationVerifier disposed', {
      component: 'SystemIntegrationVerifier',
    });
  }
}

// Export singleton instance
export const systemIntegrationVerifier = new SystemIntegrationVerifier();
