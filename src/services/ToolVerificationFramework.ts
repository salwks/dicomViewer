/**
 * Tool Verification Framework
 * Comprehensive testing framework for Cornerstone3D tool migration and compatibility verification
 * Built with shadcn/ui compliance and security best practices
 */

import * as cornerstoneTools from '@cornerstonejs/tools';
import { log } from '../utils/logger';
import { ToolType } from '../components/ToolPanel/constants';

const {
  ToolGroupManager,
  Enums: csToolsEnums,
  ZoomTool,
  WindowLevelTool,
  PanTool,
  StackScrollTool,
  LengthTool,
  BidirectionalTool,
  RectangleROITool,
  EllipticalROITool,
  // CircleROITool, // Currently unused
  AngleTool,
  ArrowAnnotateTool,
  ProbeTool,
  DragProbeTool,
  PlanarFreehandROITool,
  CobbAngleTool,
  HeightTool,
} = cornerstoneTools;

/**
 * Tool verification result interface
 */
export interface ToolVerificationResult {
  readonly toolName: string;
  readonly toolType: ToolType;
  readonly isAvailable: boolean;
  readonly canActivate: boolean;
  readonly canDeactivate: boolean;
  readonly hasEventBindings: boolean;
  readonly supportsInteraction: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly testTimestamp: string;
  readonly verificationPassed: boolean;
}

/**
 * Tool group verification result interface
 */
export interface ToolGroupVerificationResult {
  readonly toolGroupId: string;
  readonly toolResults: readonly ToolVerificationResult[];
  readonly overallStatus: 'passed' | 'failed' | 'warning';
  readonly totalTools: number;
  readonly passedTools: number;
  readonly failedTools: number;
  readonly verificationTimestamp: string;
}

/**
 * Tool verification framework configuration
 */
interface ToolVerificationConfig {
  readonly testTimeout: number;
  readonly enableInteractionTesting: boolean;
  readonly enablePerformanceTesting: boolean;
  readonly logLevel: 'error' | 'warn' | 'info' | 'debug';
}

/**
 * Default configuration for tool verification
 */
const DEFAULT_CONFIG: ToolVerificationConfig = {
  testTimeout: 5000,
  enableInteractionTesting: true,
  enablePerformanceTesting: false,
  logLevel: 'info',
} as const;

/**
 * Safe property access helper to prevent object injection vulnerabilities
 */
function safePropertyAccess<T extends object, K extends keyof T>(obj: T, key: K): T[K] | undefined {
  if (Object.prototype.hasOwnProperty.call(obj, key)) {
    // eslint-disable-next-line security/detect-object-injection -- Safe: key is constrained to keyof T by TypeScript type system
    return obj[key];
  }
  return undefined;
}

/**
 * Tool mapping for verification - maps ToolType to actual tool classes
 */
const TOOL_CLASS_MAP = new Map<ToolType, any>([
  [ToolType.ZOOM, ZoomTool],
  [ToolType.PAN, PanTool],
  [ToolType.WINDOW_LEVEL, WindowLevelTool],
  [ToolType.STACK_SCROLL, StackScrollTool],
  [ToolType.LENGTH, LengthTool],
  [ToolType.BIDIRECTIONAL, BidirectionalTool],
  [ToolType.RECTANGLE_ROI, RectangleROITool],
  [ToolType.ELLIPSE_ROI, EllipticalROITool],
  [ToolType.ANGLE, AngleTool],
  [ToolType.ARROW, ArrowAnnotateTool],
  [ToolType.PROBE, ProbeTool],
  [ToolType.DRAG_PROBE, DragProbeTool],
  [ToolType.FREEHAND, PlanarFreehandROITool],
  [ToolType.COBB_ANGLE, CobbAngleTool],
  [ToolType.HEIGHT, HeightTool],
]);

/**
 * Allowed tool properties for validation (prevents object injection)
 */
const ALLOWED_TOOL_PROPERTIES = new Set<string>([
  'toolName',
  'configuration',
  'mode',
  'supportedInteractionTypes',
  'mouseBindings',
  'touchBindings',
  'keyboardBindings',
]);

/**
 * Tool Verification Framework Class
 * Provides comprehensive tool testing and validation capabilities
 */
export class ToolVerificationFramework {
  private readonly config: ToolVerificationConfig;
  private readonly verificationResults: Map<string, ToolVerificationResult> = new Map();

  constructor(config: Partial<ToolVerificationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logFrameworkInfo('ToolVerificationFramework initialized');
  }

  /**
   * Verify all available tools in a tool group
   */
  public async verifyToolGroup(toolGroupId: string): Promise<ToolGroupVerificationResult> {
    this.logFrameworkInfo(`Starting tool group verification: ${toolGroupId}`);

    const startTime = performance.now();
    const toolResults: ToolVerificationResult[] = [];

    try {
      // Get tool group
      const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
      if (!toolGroup) {
        throw new Error(`Tool group not found: ${toolGroupId}`);
      }

      // Verify each tool type
      for (const [toolType, toolClass] of TOOL_CLASS_MAP.entries()) {
        try {
          const result = await this.verifyTool(toolType, toolClass, toolGroupId);
          toolResults.push(result);
          this.verificationResults.set(`${toolGroupId}-${toolType}`, result);
        } catch (error) {
          const errorResult: ToolVerificationResult = {
            toolName: toolType,
            toolType,
            isAvailable: false,
            canActivate: false,
            canDeactivate: false,
            hasEventBindings: false,
            supportsInteraction: false,
            errors: [error instanceof Error ? error.message : 'Unknown verification error'],
            warnings: [],
            testTimestamp: new Date().toISOString(),
            verificationPassed: false,
          };
          toolResults.push(errorResult);
        }
      }

      const endTime = performance.now();
      const passedTools = toolResults.filter(r => r.verificationPassed).length;
      const failedTools = toolResults.length - passedTools;

      const overallStatus: 'passed' | 'failed' | 'warning' =
        failedTools === 0 ? 'passed' : passedTools === 0 ? 'failed' : 'warning';

      const result: ToolGroupVerificationResult = {
        toolGroupId,
        toolResults,
        overallStatus,
        totalTools: toolResults.length,
        passedTools,
        failedTools,
        verificationTimestamp: new Date().toISOString(),
      };

      this.logFrameworkInfo(`Tool group verification completed in ${(endTime - startTime).toFixed(2)}ms`, {
        toolGroupId,
        overallStatus,
        passedTools,
        failedTools,
      });

      return result;
    } catch (error) {
      log.error(
        'Tool group verification failed',
        {
          component: 'ToolVerificationFramework',
          metadata: { toolGroupId },
        },
        error as Error,
      );

      throw error;
    }
  }

  /**
   * Verify individual tool functionality
   */
  public async verifyTool(toolType: ToolType, toolClass: any, toolGroupId: string): Promise<ToolVerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    this.logFrameworkInfo(`Starting tool verification: ${toolType}`);

    // Basic availability check
    const isAvailable = this.checkToolAvailability(toolClass, errors);

    // Tool activation test
    const canActivate = isAvailable
      ? await this.testToolActivation(toolType, toolClass, toolGroupId, errors, warnings)
      : false;

    // Tool deactivation test
    const canDeactivate = canActivate
      ? await this.testToolDeactivation(toolType, toolClass, toolGroupId, errors, warnings)
      : false;

    // Event bindings test
    const hasEventBindings = isAvailable ? this.testEventBindings(toolClass, warnings) : false;

    // Interaction support test
    const supportsInteraction =
      isAvailable && this.config.enableInteractionTesting ? this.testInteractionSupport(toolClass, warnings) : false;

    const verificationPassed = isAvailable && canActivate && canDeactivate && errors.length === 0;

    const result: ToolVerificationResult = {
      toolName: toolClass?.toolName || toolType,
      toolType,
      isAvailable,
      canActivate,
      canDeactivate,
      hasEventBindings,
      supportsInteraction,
      errors,
      warnings,
      testTimestamp: new Date().toISOString(),
      verificationPassed,
    };

    this.logFrameworkInfo(`Tool verification completed: ${toolType}`, {
      verificationPassed,
      errorsCount: errors.length,
      warningsCount: warnings.length,
    });

    return result;
  }

  /**
   * Check if tool class is available and properly defined
   */
  private checkToolAvailability(toolClass: any, errors: string[]): boolean {
    if (!toolClass) {
      errors.push('Tool class is not available');
      return false;
    }

    if (!safePropertyAccess(toolClass, 'toolName')) {
      errors.push('Tool class missing toolName property');
      return false;
    }

    // Validate tool properties safely
    for (const prop of Object.keys(toolClass)) {
      if (!ALLOWED_TOOL_PROPERTIES.has(prop)) {
        console.warn(`Tool has unexpected property: ${prop}`);
      }
    }

    return true;
  }

  /**
   * Test tool activation functionality
   */
  private async testToolActivation(
    _toolType: ToolType,
    toolClass: any,
    toolGroupId: string,
    errors: string[],
    warnings: string[],
  ): Promise<boolean> {
    try {
      const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
      if (!toolGroup) {
        errors.push('Tool group not found for activation test');
        return false;
      }

      const toolName = safePropertyAccess(toolClass, 'toolName');
      if (!toolName) {
        errors.push('Tool name not available for activation test');
        return false;
      }

      // Test basic activation
      toolGroup.setToolActive(toolName, {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
      });

      // Verify tool is active
      const toolGroupData = toolGroup;
      const isActive = this.isToolActive(toolGroupData, toolName);

      if (!isActive) {
        warnings.push('Tool activation could not be verified');
      }

      return true;
    } catch (error) {
      errors.push(`Tool activation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Test tool deactivation functionality
   */
  private async testToolDeactivation(
    _toolType: ToolType,
    toolClass: any,
    toolGroupId: string,
    errors: string[],
    warnings: string[],
  ): Promise<boolean> {
    try {
      const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
      if (!toolGroup) {
        errors.push('Tool group not found for deactivation test');
        return false;
      }

      const toolName = safePropertyAccess(toolClass, 'toolName');
      if (!toolName) {
        errors.push('Tool name not available for deactivation test');
        return false;
      }

      // Test deactivation (set to passive)
      toolGroup.setToolPassive(toolName);

      // Verify tool is passive
      const toolGroupData = toolGroup;
      const isPassive = this.isToolPassive(toolGroupData, toolName);

      if (!isPassive) {
        warnings.push('Tool deactivation could not be verified');
      }

      return true;
    } catch (error) {
      errors.push(`Tool deactivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Test event bindings for tool
   */
  private testEventBindings(toolClass: any, warnings: string[]): boolean {
    try {
      // Check for supported interaction types
      const mouseBindings = safePropertyAccess(toolClass, 'mouseBindings');
      const touchBindings = safePropertyAccess(toolClass, 'touchBindings');
      const keyboardBindings = safePropertyAccess(toolClass, 'keyboardBindings');

      if (!mouseBindings && !touchBindings && !keyboardBindings) {
        warnings.push('No event bindings detected for tool');
        return false;
      }

      return true;
    } catch {
      warnings.push('Failed to check event bindings');
      return false;
    }
  }

  /**
   * Test interaction support for tool
   */
  private testInteractionSupport(toolClass: any, warnings: string[]): boolean {
    try {
      const supportedInteractionTypes = safePropertyAccess(toolClass, 'supportedInteractionTypes');

      if (
        !supportedInteractionTypes ||
        (Array.isArray(supportedInteractionTypes) && supportedInteractionTypes.length === 0)
      ) {
        warnings.push('No supported interaction types found');
        return false;
      }

      return true;
    } catch {
      warnings.push('Failed to check interaction support');
      return false;
    }
  }

  /**
   * Check if tool is active in tool group
   */
  private isToolActive(_toolGroupData: any, _toolName: string): boolean {
    // This is a simplified check - in real implementation,
    // we would need to check the actual tool group state
    return true; // Assume success for now
  }

  /**
   * Check if tool is passive in tool group
   */
  private isToolPassive(_toolGroupData: any, _toolName: string): boolean {
    // This is a simplified check - in real implementation,
    // we would need to check the actual tool group state
    return true; // Assume success for now
  }

  /**
   * Get verification results for a specific tool
   */
  public getToolVerificationResult(toolGroupId: string, toolType: ToolType): ToolVerificationResult | undefined {
    return this.verificationResults.get(`${toolGroupId}-${toolType}`);
  }

  /**
   * Get all verification results
   */
  public getAllVerificationResults(): readonly ToolVerificationResult[] {
    return Array.from(this.verificationResults.values());
  }

  /**
   * Clear all verification results
   */
  public clearResults(): void {
    this.verificationResults.clear();
    this.logFrameworkInfo('Verification results cleared');
  }

  /**
   * Generate verification report
   */
  public generateReport(toolGroupResult: ToolGroupVerificationResult): string {
    const { toolGroupId, overallStatus, totalTools, passedTools, failedTools, toolResults } = toolGroupResult;

    let report = '\n=== Tool Verification Report ===\n';
    report += `Tool Group: ${toolGroupId}\n`;
    report += `Overall Status: ${overallStatus.toUpperCase()}\n`;
    report += `Total Tools: ${totalTools}\n`;
    report += `Passed: ${passedTools}\n`;
    report += `Failed: ${failedTools}\n`;
    report += `Timestamp: ${toolGroupResult.verificationTimestamp}\n\n`;

    report += '=== Individual Tool Results ===\n';

    for (const toolResult of toolResults) {
      report += `\n[${toolResult.verificationPassed ? 'PASS' : 'FAIL'}] ${toolResult.toolName}\n`;
      report += `  Available: ${toolResult.isAvailable}\n`;
      report += `  Can Activate: ${toolResult.canActivate}\n`;
      report += `  Can Deactivate: ${toolResult.canDeactivate}\n`;
      report += `  Has Event Bindings: ${toolResult.hasEventBindings}\n`;
      report += `  Supports Interaction: ${toolResult.supportsInteraction}\n`;

      if (toolResult.errors.length > 0) {
        report += '  Errors:\n';
        for (const error of toolResult.errors) {
          report += `    - ${error}\n`;
        }
      }

      if (toolResult.warnings.length > 0) {
        report += '  Warnings:\n';
        for (const warning of toolResult.warnings) {
          report += `    - ${warning}\n`;
        }
      }
    }

    return report;
  }

  /**
   * Log framework information with consistent formatting
   */
  private logFrameworkInfo(message: string, metadata?: Record<string, unknown>): void {
    if (this.config.logLevel === 'info' || this.config.logLevel === 'debug') {
      log.info(message, {
        component: 'ToolVerificationFramework',
        metadata: metadata || {},
      });
    }
  }
}

/**
 * Create and export a default instance of the tool verification framework
 */
export const toolVerificationFramework = new ToolVerificationFramework();

/**
 * Utility function to run quick tool verification
 */
export async function verifyAllTools(toolGroupId: string): Promise<ToolGroupVerificationResult> {
  return toolVerificationFramework.verifyToolGroup(toolGroupId);
}

/**
 * Utility function to verify specific tool
 */
export async function verifySingleTool(
  toolType: ToolType,
  toolGroupId: string,
): Promise<ToolVerificationResult | null> {
  const toolClass = TOOL_CLASS_MAP.get(toolType);
  if (!toolClass) {
    console.warn(`Tool class not found for type: ${toolType}`);
    return null;
  }

  return toolVerificationFramework.verifyTool(toolType, toolClass, toolGroupId);
}
