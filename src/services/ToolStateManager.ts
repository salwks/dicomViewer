/**
 * Tool State Manager Service
 * Advanced tool state management with validation, synchronization, and persistence
 * Handles tool configurations, annotations, measurements, and tool behaviors
 */

import { EventEmitter } from 'events';
import { AnnotationState, MeasurementState, ToolState } from '../types/viewportState';
import { log } from '../utils/logger';

export interface ToolDefinition {
  name: string;
  displayName: string;
  category: 'manipulation' | 'measurement' | 'annotation' | 'navigation' | 'display';
  icon?: string;
  description: string;
  defaultConfiguration: Record<string, unknown>;
  requiredConfiguration: string[];
  supportedViewportTypes: ('stack' | 'volume' | 'multiplanar')[];
  allowedInteractions: ToolInteraction[];
  priority: number; // Tool selection priority
  isDefault?: boolean;
}

export interface ToolInteraction {
  type: 'leftClick' | 'rightClick' | 'middleClick' | 'drag' | 'scroll' | 'keypress';
  modifiers?: ('ctrl' | 'shift' | 'alt')[];
  action: string;
  preventDefault?: boolean;
}

export interface ToolGroup {
  id: string;
  name: string;
  tools: string[];
  mutuallyExclusive: boolean;
  defaultTool?: string;
  allowedCombinations?: string[][];
}

export interface ToolValidationRule {
  tool: string;
  rule: (config: Record<string, unknown>, state: ToolState) => ValidationResult;
  severity: 'error' | 'warning';
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ToolStateManagerConfig {
  enableValidation: boolean;
  enableSynchronization: boolean;
  enablePersistence: boolean;
  maxAnnotations: number;
  maxMeasurements: number;
  autoSave: {
    enabled: boolean;
    interval: number; // milliseconds
  };
  defaultTools: string[];
  toolGroups: ToolGroup[];
  validationRules: ToolValidationRule[];
}

export const DEFAULT_TOOL_STATE_CONFIG: ToolStateManagerConfig = {
  enableValidation: true,
  enableSynchronization: true,
  enablePersistence: true,
  maxAnnotations: 1000,
  maxMeasurements: 500,
  autoSave: {
    enabled: true,
    interval: 5000, // 5 seconds
  },
  defaultTools: ['WindowLevel', 'Pan', 'Zoom'],
  toolGroups: [
    {
      id: 'navigation',
      name: 'Navigation Tools',
      tools: ['Pan', 'Zoom', 'WindowLevel'],
      mutuallyExclusive: true,
      defaultTool: 'WindowLevel',
    },
    {
      id: 'measurement',
      name: 'Measurement Tools',
      tools: ['Length', 'Angle', 'Rectangle', 'Ellipse'],
      mutuallyExclusive: true,
    },
    {
      id: 'annotation',
      name: 'Annotation Tools',
      tools: ['Arrow', 'Text', 'Freehand'],
      mutuallyExclusive: true,
    },
  ],
  validationRules: [],
};

export const BUILT_IN_TOOLS: ToolDefinition[] = [
  {
    name: 'WindowLevel',
    displayName: 'Window/Level',
    category: 'display',
    description: 'Adjust window and level settings',
    defaultConfiguration: {
      sensitivity: 1.0,
      invert: false,
    },
    requiredConfiguration: [],
    supportedViewportTypes: ['stack', 'volume', 'multiplanar'],
    allowedInteractions: [
      { type: 'drag', action: 'adjustWindowLevel' },
      { type: 'rightClick', action: 'resetWindowLevel' },
    ],
    priority: 1,
    isDefault: true,
  },
  {
    name: 'Pan',
    displayName: 'Pan',
    category: 'navigation',
    description: 'Pan the image',
    defaultConfiguration: {
      sensitivity: 1.0,
      constrainToImage: false,
    },
    requiredConfiguration: [],
    supportedViewportTypes: ['stack', 'volume', 'multiplanar'],
    allowedInteractions: [
      { type: 'drag', action: 'pan' },
      { type: 'rightClick', action: 'resetPan' },
    ],
    priority: 2,
  },
  {
    name: 'Zoom',
    displayName: 'Zoom',
    category: 'navigation',
    description: 'Zoom in and out',
    defaultConfiguration: {
      sensitivity: 1.0,
      minZoom: 0.1,
      maxZoom: 10.0,
    },
    requiredConfiguration: [],
    supportedViewportTypes: ['stack', 'volume', 'multiplanar'],
    allowedInteractions: [
      { type: 'scroll', action: 'zoom' },
      { type: 'drag', action: 'zoom' },
      { type: 'rightClick', action: 'resetZoom' },
    ],
    priority: 3,
  },
  {
    name: 'Length',
    displayName: 'Length Measurement',
    category: 'measurement',
    description: 'Measure linear distances',
    defaultConfiguration: {
      units: 'mm',
      precision: 2,
      showMeasurement: true,
      color: '#00ff00',
    },
    requiredConfiguration: ['units'],
    supportedViewportTypes: ['stack', 'volume'],
    allowedInteractions: [
      { type: 'leftClick', action: 'startMeasurement' },
      { type: 'leftClick', action: 'endMeasurement' },
    ],
    priority: 10,
  },
  {
    name: 'Angle',
    displayName: 'Angle Measurement',
    category: 'measurement',
    description: 'Measure angles',
    defaultConfiguration: {
      units: 'degrees',
      precision: 1,
      showMeasurement: true,
      color: '#ffff00',
    },
    requiredConfiguration: ['units'],
    supportedViewportTypes: ['stack', 'volume'],
    allowedInteractions: [
      { type: 'leftClick', action: 'addPoint' },
    ],
    priority: 11,
  },
  {
    name: 'Rectangle',
    displayName: 'Rectangle ROI',
    category: 'measurement',
    description: 'Draw rectangular regions of interest',
    defaultConfiguration: {
      showArea: true,
      showPerimeter: false,
      units: 'mm²',
      precision: 2,
      color: '#ff0000',
    },
    requiredConfiguration: [],
    supportedViewportTypes: ['stack', 'volume'],
    allowedInteractions: [
      { type: 'drag', action: 'drawRectangle' },
    ],
    priority: 12,
  },
];

export interface ToolStateManagerEvents {
  'tool-activated': [string, string]; // [viewportId, toolName]
  'tool-deactivated': [string, string]; // [viewportId, toolName]
  'tool-configuration-changed': [string, string, Record<string, unknown>]; // [viewportId, toolName, config]
  'annotation-added': [string, AnnotationState]; // [viewportId, annotation]
  'annotation-updated': [string, AnnotationState]; // [viewportId, annotation]
  'annotation-removed': [string, string]; // [viewportId, annotationId]
  'measurement-added': [string, MeasurementState]; // [viewportId, measurement]
  'measurement-updated': [string, MeasurementState]; // [viewportId, measurement]
  'measurement-removed': [string, string]; // [viewportId, measurementId]
  'validation-error': [string, ValidationResult]; // [viewportId, validation]
  'state-synchronized': [string[], ToolState]; // [viewportIds, state]
}

export class ToolStateManager extends EventEmitter {
  private config: ToolStateManagerConfig;
  private viewportToolStates = new Map<string, ToolState>();
  private toolDefinitions = new Map<string, ToolDefinition>();
  private validationRules = new Map<string, ToolValidationRule[]>();
  private autoSaveInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<ToolStateManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_TOOL_STATE_CONFIG, ...config };

    this.initialize();
  }

  private initialize(): void {
    log.info('ToolStateManager initializing', {
      component: 'ToolStateManager',
      metadata: {
        enableValidation: this.config.enableValidation,
        maxAnnotations: this.config.maxAnnotations,
      },
    });

    // Register built-in tools
    BUILT_IN_TOOLS.forEach(tool => {
      this.registerTool(tool);
    });

    // Setup validation rules
    this.setupValidationRules();

    // Setup auto-save if enabled
    if (this.config.autoSave.enabled) {
      this.setupAutoSave();
    }
  }

  // ===== Tool Registration =====

  public registerTool(tool: ToolDefinition): void {
    this.toolDefinitions.set(tool.name, tool);

    log.info('Tool registered', {
      component: 'ToolStateManager',
      metadata: { toolName: tool.name, category: tool.category },
    });
  }

  public unregisterTool(toolName: string): boolean {
    const existed = this.toolDefinitions.has(toolName);

    if (existed) {
      this.toolDefinitions.delete(toolName);

      // Remove from all viewport states
      this.viewportToolStates.forEach((state, viewportId) => {
        if (state.activeTool === toolName) {
          this.setActiveTool(viewportId, this.config.defaultTools[0] || 'WindowLevel');
        }

        // Remove from available tools
        const index = state.availableTools.indexOf(toolName);
        if (index !== -1) {
          state.availableTools.splice(index, 1);
        }
      });

      log.info('Tool unregistered', {
        component: 'ToolStateManager',
        metadata: { toolName },
      });
    }

    return existed;
  }

  public getTool(toolName: string): ToolDefinition | null {
    return this.toolDefinitions.get(toolName) || null;
  }

  public getAllTools(): ToolDefinition[] {
    return Array.from(this.toolDefinitions.values());
  }

  public getToolsByCategory(category: ToolDefinition['category']): ToolDefinition[] {
    return Array.from(this.toolDefinitions.values()).filter(tool => tool.category === category);
  }

  // ===== Viewport Tool State Management =====

  public initializeViewportTools(
    viewportId: string,
    viewportType: 'stack' | 'volume' | 'multiplanar' = 'stack',
  ): ToolState {
    // Get compatible tools for this viewport type
    const compatibleTools = Array.from(this.toolDefinitions.values())
      .filter(tool => tool.supportedViewportTypes.includes(viewportType))
      .map(tool => tool.name);

    const toolState: ToolState = {
      activeTool: this.config.defaultTools.find(tool => compatibleTools.includes(tool)) || compatibleTools[0] || 'WindowLevel',
      availableTools: compatibleTools,
      toolConfiguration: {},
      annotations: [],
      measurements: [],
    };

    // Initialize default configurations
    compatibleTools.forEach(toolName => {
      const tool = this.toolDefinitions.get(toolName);
      if (tool) {
        toolState.toolConfiguration[toolName] = { ...tool.defaultConfiguration };
      }
    });

    this.viewportToolStates.set(viewportId, toolState);

    log.info('Viewport tools initialized', {
      component: 'ToolStateManager',
      metadata: {
        viewportId,
        viewportType,
        toolCount: compatibleTools.length,
        activeTool: toolState.activeTool,
      },
    });

    return { ...toolState };
  }

  public setActiveTool(viewportId: string, toolName: string): void {
    const toolState = this.viewportToolStates.get(viewportId);
    if (!toolState) {
      throw new Error(`Viewport not found: ${viewportId}`);
    }

    const tool = this.toolDefinitions.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    if (!toolState.availableTools.includes(toolName)) {
      throw new Error(`Tool not available for viewport: ${toolName}`);
    }

    // Validate tool change
    if (this.config.enableValidation) {
      const validation = this.validateToolActivation(viewportId, toolName);
      if (!validation.isValid) {
        this.emit('validation-error', viewportId, validation);
        throw new Error(`Tool activation validation failed: ${validation.errors.join(', ')}`);
      }
    }

    const previousTool = toolState.activeTool;
    toolState.activeTool = toolName;

    this.emit('tool-deactivated', viewportId, previousTool);
    this.emit('tool-activated', viewportId, toolName);

    log.info('Active tool changed', {
      component: 'ToolStateManager',
      metadata: { viewportId, previousTool, newTool: toolName },
    });
  }

  public getActiveTool(viewportId: string): string | null {
    const toolState = this.viewportToolStates.get(viewportId);
    return toolState?.activeTool || null;
  }

  public setToolConfiguration(
    viewportId: string,
    toolName: string,
    configuration: Record<string, unknown>,
  ): void {
    const toolState = this.viewportToolStates.get(viewportId);
    if (!toolState) {
      throw new Error(`Viewport not found: ${viewportId}`);
    }

    const tool = this.toolDefinitions.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // Validate required configuration
    const missingConfig = tool.requiredConfiguration.filter(
      key => !(key in configuration),
    );
    if (missingConfig.length > 0) {
      throw new Error(`Missing required configuration: ${missingConfig.join(', ')}`);
    }

    // Merge with existing configuration
    const existingConfig = toolState.toolConfiguration[toolName] || {};
    toolState.toolConfiguration[toolName] = {
      ...existingConfig,
      ...configuration,
    };

    this.emit('tool-configuration-changed', viewportId, toolName, configuration);

    log.info('Tool configuration updated', {
      component: 'ToolStateManager',
      metadata: { viewportId, toolName, configKeys: Object.keys(configuration) },
    });
  }

  public getToolConfiguration(viewportId: string, toolName: string): Record<string, unknown> {
    const toolState = this.viewportToolStates.get(viewportId);
    if (!toolState) {
      return {};
    }

    return { ...(toolState.toolConfiguration[toolName] || {}) };
  }

  // ===== Annotation Management =====

  public addAnnotation(viewportId: string, annotation: Omit<AnnotationState, 'id' | 'metadata'>): AnnotationState {
    const toolState = this.viewportToolStates.get(viewportId);
    if (!toolState) {
      throw new Error(`Viewport not found: ${viewportId}`);
    }

    // Check annotation limit
    if (toolState.annotations.length >= this.config.maxAnnotations) {
      throw new Error(`Maximum annotations limit reached: ${this.config.maxAnnotations}`);
    }

    const now = new Date().toISOString();
    const fullAnnotation: AnnotationState = {
      ...annotation,
      id: this.generateAnnotationId(),
      metadata: {
        createdAt: now,
        modifiedAt: now,
      },
    };

    toolState.annotations.push(fullAnnotation);

    this.emit('annotation-added', viewportId, fullAnnotation);

    log.info('Annotation added', {
      component: 'ToolStateManager',
      metadata: { viewportId, annotationId: fullAnnotation.id, type: fullAnnotation.type },
    });

    return fullAnnotation;
  }

  public updateAnnotation(viewportId: string, annotationId: string, updates: Partial<AnnotationState>): AnnotationState {
    const toolState = this.viewportToolStates.get(viewportId);
    if (!toolState) {
      throw new Error(`Viewport not found: ${viewportId}`);
    }

    const annotation = toolState.annotations.find(a => a.id === annotationId);
    if (!annotation) {
      throw new Error(`Annotation not found: ${annotationId}`);
    }

    // Apply updates
    Object.assign(annotation, updates);
    annotation.metadata.modifiedAt = new Date().toISOString();

    this.emit('annotation-updated', viewportId, annotation);

    log.info('Annotation updated', {
      component: 'ToolStateManager',
      metadata: { viewportId, annotationId, updateKeys: Object.keys(updates) },
    });

    return annotation;
  }

  public removeAnnotation(viewportId: string, annotationId: string): boolean {
    const toolState = this.viewportToolStates.get(viewportId);
    if (!toolState) {
      return false;
    }

    const index = toolState.annotations.findIndex(a => a.id === annotationId);
    if (index === -1) {
      return false;
    }

    toolState.annotations.splice(index, 1);

    this.emit('annotation-removed', viewportId, annotationId);

    log.info('Annotation removed', {
      component: 'ToolStateManager',
      metadata: { viewportId, annotationId },
    });

    return true;
  }

  public getAnnotations(viewportId: string): AnnotationState[] {
    const toolState = this.viewportToolStates.get(viewportId);
    return toolState ? [...toolState.annotations] : [];
  }

  // ===== Measurement Management =====

  public addMeasurement(viewportId: string, measurement: Omit<MeasurementState, 'id' | 'metadata'>): MeasurementState {
    const toolState = this.viewportToolStates.get(viewportId);
    if (!toolState) {
      throw new Error(`Viewport not found: ${viewportId}`);
    }

    // Check measurement limit
    if (toolState.measurements.length >= this.config.maxMeasurements) {
      throw new Error(`Maximum measurements limit reached: ${this.config.maxMeasurements}`);
    }

    const fullMeasurement: MeasurementState = {
      ...measurement,
      id: this.generateMeasurementId(),
      metadata: {
        createdAt: new Date().toISOString(),
      },
    };

    toolState.measurements.push(fullMeasurement);

    this.emit('measurement-added', viewportId, fullMeasurement);

    log.info('Measurement added', {
      component: 'ToolStateManager',
      metadata: { viewportId, measurementId: fullMeasurement.id, type: fullMeasurement.type },
    });

    return fullMeasurement;
  }

  public updateMeasurement(viewportId: string, measurementId: string, updates: Partial<MeasurementState>): MeasurementState {
    const toolState = this.viewportToolStates.get(viewportId);
    if (!toolState) {
      throw new Error(`Viewport not found: ${viewportId}`);
    }

    const measurement = toolState.measurements.find(m => m.id === measurementId);
    if (!measurement) {
      throw new Error(`Measurement not found: ${measurementId}`);
    }

    // Apply updates
    Object.assign(measurement, updates);

    this.emit('measurement-updated', viewportId, measurement);

    log.info('Measurement updated', {
      component: 'ToolStateManager',
      metadata: { viewportId, measurementId, updateKeys: Object.keys(updates) },
    });

    return measurement;
  }

  public removeMeasurement(viewportId: string, measurementId: string): boolean {
    const toolState = this.viewportToolStates.get(viewportId);
    if (!toolState) {
      return false;
    }

    const index = toolState.measurements.findIndex(m => m.id === measurementId);
    if (index === -1) {
      return false;
    }

    toolState.measurements.splice(index, 1);

    this.emit('measurement-removed', viewportId, measurementId);

    log.info('Measurement removed', {
      component: 'ToolStateManager',
      metadata: { viewportId, measurementId },
    });

    return true;
  }

  public getMeasurements(viewportId: string): MeasurementState[] {
    const toolState = this.viewportToolStates.get(viewportId);
    return toolState ? [...toolState.measurements] : [];
  }

  // ===== Validation =====

  private validateToolActivation(viewportId: string, toolName: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const tool = this.toolDefinitions.get(toolName);
    const toolState = this.viewportToolStates.get(viewportId);

    if (!tool) {
      errors.push(`Tool definition not found: ${toolName}`);
    }

    if (!toolState) {
      errors.push(`Viewport tool state not found: ${viewportId}`);
    }

    if (tool && toolState) {
      // Check tool group constraints
      const toolGroup = this.config.toolGroups.find(group => group.tools.includes(toolName));
      if (toolGroup?.mutuallyExclusive) {
        const activeGroupTools = toolGroup.tools.filter(t => t === toolState.activeTool);
        if (activeGroupTools.length > 0 && !activeGroupTools.includes(toolName)) {
          // This is expected behavior for mutually exclusive groups
        }
      }

      // Check required configuration
      const config = toolState.toolConfiguration[toolName];
      if (config && typeof config === 'object' && config !== null) {
        const missingRequired = tool.requiredConfiguration.filter(key => !(key in config));
        if (missingRequired.length > 0) {
          errors.push(`Missing required configuration: ${missingRequired.join(', ')}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ===== Synchronization =====

  public synchronizeToolStates(sourceViewportId: string, targetViewportIds: string[]): void {
    if (!this.config.enableSynchronization) {
      return;
    }

    const sourceState = this.viewportToolStates.get(sourceViewportId);
    if (!sourceState) {
      return;
    }

    targetViewportIds.forEach(targetId => {
      const targetState = this.viewportToolStates.get(targetId);
      if (!targetState) {
        return;
      }

      // Sync active tool if available
      if (targetState.availableTools.includes(sourceState.activeTool)) {
        targetState.activeTool = sourceState.activeTool;
      }

      // Sync tool configurations for shared tools
      Object.keys(sourceState.toolConfiguration).forEach(toolName => {
        if (targetState.availableTools.includes(toolName)) {
          const sourceConfig = sourceState.toolConfiguration[toolName];
          if (sourceConfig && typeof sourceConfig === 'object') {
            targetState.toolConfiguration[toolName] = {
              ...sourceConfig,
            };
          } else {
            targetState.toolConfiguration[toolName] = sourceConfig;
          }
        }
      });
    });

    this.emit('state-synchronized', targetViewportIds, sourceState);

    log.info('Tool states synchronized', {
      component: 'ToolStateManager',
      metadata: { sourceViewportId, targetCount: targetViewportIds.length },
    });
  }

  // ===== Utility Methods =====

  private setupValidationRules(): void {
    // Add built-in validation rules
    const rules: ToolValidationRule[] = [
      {
        tool: 'Length',
        rule: (config) => ({
          isValid: typeof config.precision === 'number' && config.precision >= 0,
          errors: typeof config.precision !== 'number' || config.precision < 0 ? ['Precision must be a non-negative number'] : [],
          warnings: [],
        }),
        severity: 'error',
        message: 'Invalid precision configuration',
      },
      {
        tool: 'Angle',
        rule: (config) => ({
          isValid: typeof config.precision === 'number' && config.precision >= 0,
          errors: typeof config.precision !== 'number' || config.precision < 0 ? ['Precision must be a non-negative number'] : [],
          warnings: [],
        }),
        severity: 'error',
        message: 'Invalid precision configuration',
      },
    ];

    rules.forEach(rule => {
      if (!this.validationRules.has(rule.tool)) {
        this.validationRules.set(rule.tool, []);
      }
      this.validationRules.get(rule.tool)!.push(rule);
    });
  }

  private setupAutoSave(): void {
    this.autoSaveInterval = setInterval(() => {
      this.performAutoSave();
    }, this.config.autoSave.interval);
  }

  private performAutoSave(): void {
    // Auto-save logic would be implemented here
    // This could save to persistence layer or emit events
    log.info('Tool state auto-save performed', {
      component: 'ToolStateManager',
      metadata: { viewportCount: this.viewportToolStates.size },
    });
  }

  private generateAnnotationId(): string {
    return `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMeasurementId(): string {
    return `measurement-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ===== State Access =====

  public getViewportToolState(viewportId: string): ToolState | null {
    const state = this.viewportToolStates.get(viewportId);
    return state ? {
      activeTool: state.activeTool,
      availableTools: [...state.availableTools],
      toolConfiguration: { ...state.toolConfiguration },
      annotations: [...state.annotations],
      measurements: [...state.measurements],
    } : null;
  }

  public getAllViewportToolStates(): Map<string, ToolState> {
    const states = new Map<string, ToolState>();
    this.viewportToolStates.forEach((state, id) => {
      states.set(id, {
        activeTool: state.activeTool,
        availableTools: [...state.availableTools],
        toolConfiguration: { ...state.toolConfiguration },
        annotations: [...state.annotations],
        measurements: [...state.measurements],
      });
    });
    return states;
  }

  public removeViewportToolState(viewportId: string): boolean {
    const existed = this.viewportToolStates.has(viewportId);
    if (existed) {
      this.viewportToolStates.delete(viewportId);

      log.info('Viewport tool state removed', {
        component: 'ToolStateManager',
        metadata: { viewportId },
      });
    }
    return existed;
  }

  // ===== Cleanup =====

  public dispose(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }

    this.viewportToolStates.clear();
    this.toolDefinitions.clear();
    this.validationRules.clear();
    this.removeAllListeners();

    log.info('ToolStateManager disposed', {
      component: 'ToolStateManager',
    });
  }
}

// Singleton instance
export const toolStateManager = new ToolStateManager();
