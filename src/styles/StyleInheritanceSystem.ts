/**
 * Style Inheritance System
 *
 * Advanced inheritance and override system for annotation styles
 * Supports hierarchical styling, cascading rules, and dynamic inheritance
 */

/* eslint-disable security/detect-object-injection */

import {
  AnnotationStyling,
  AnnotationStyleCategory,
  StyleInheritance,
  StyleValidation,
} from '../types/annotation-styling';
import { styleManager } from './StyleManager';

/**
 * Inheritance rule priority levels
 */
export enum InheritancePriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4,
}

/**
 * Style merge strategy
 */
export enum MergeStrategy {
  /** Replace child property with parent property */
  REPLACE = 'replace',
  /** Extend child property with parent property */
  EXTEND = 'extend',
  /** Merge child and parent properties */
  MERGE = 'merge',
  /** Keep child property unchanged */
  PRESERVE = 'preserve',
}

/**
 * Enhanced inheritance configuration
 */
export interface EnhancedStyleInheritance extends StyleInheritance {
  /** Inheritance priority */
  priority: InheritancePriority;
  /** Conditional inheritance rules */
  conditions?: InheritanceCondition[];
  /** Custom merge strategies for specific properties */
  propertyStrategies?: Partial<Record<keyof AnnotationStyling, MergeStrategy>>;
  /** Whether inheritance is active */
  active: boolean;
  /** Inheritance metadata */
  metadata?: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    description?: string;
    tags?: string[];
  };
}

/**
 * Conditional inheritance rule
 */
export interface InheritanceCondition {
  /** Property to check */
  property: keyof AnnotationStyling;
  /** Comparison operator */
  operator: 'equals' | 'not-equals' | 'greater' | 'less' | 'contains' | 'exists';
  /** Value to compare against */
  value: any;
  /** Action if condition is met */
  action: 'inherit' | 'skip' | 'override';
}

/**
 * Style inheritance graph node
 */
interface InheritanceNode {
  styleId: string;
  parentIds: string[];
  childIds: string[];
  inheritance: EnhancedStyleInheritance[];
  computedStyle?: AnnotationStyling;
  lastComputed?: Date;
}

/**
 * Inheritance resolution result
 */
export interface InheritanceResolution {
  /** Final resolved style */
  resolvedStyle: AnnotationStyling;
  /** Inheritance chain applied */
  inheritanceChain: string[];
  /** Properties that were inherited */
  inheritedProperties: Array<{
    property: keyof AnnotationStyling;
    fromStyleId: string;
    strategy: MergeStrategy;
  }>;
  /** Warnings during resolution */
  warnings: string[];
  /** Resolution metadata */
  metadata: {
    resolvedAt: Date;
    cacheHit: boolean;
    resolutionTime: number;
  };
}

/**
 * Style Inheritance System Class
 */
export class StyleInheritanceSystem {
  private static instance: StyleInheritanceSystem;
  private inheritanceGraph: Map<string, InheritanceNode> = new Map();
  private resolutionCache: Map<string, InheritanceResolution> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes
  private eventListeners: Map<string, Function[]> = new Map();

  private constructor() {
    this.initializeDefaultInheritanceRules();
    console.log('🔗 Style Inheritance System initialized');
  }

  static getInstance(): StyleInheritanceSystem {
    if (!StyleInheritanceSystem.instance) {
      StyleInheritanceSystem.instance = new StyleInheritanceSystem();
    }
    return StyleInheritanceSystem.instance;
  }

  /**
   * Initialize default inheritance rules
   */
  private initializeDefaultInheritanceRules(): void {
    // Create base style inheritance for medical imaging
    this.createInheritanceRule('medical-base', {
      parentId: 'system-default',
      inheritedProperties: ['font', 'line', 'shadow'],
      overrides: {
        font: {
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          size: 14,
          weight: 'normal',
          style: 'normal',
          lineHeight: 1.4,
        },
        measurementPrecision: 2,
        unitDisplay: {
          show: true,
          format: 'short',
          position: 'inline',
        },
      },
      mode: 'extend',
      priority: InheritancePriority.NORMAL,
      active: true,
      conditions: [],
      propertyStrategies: {
        font: MergeStrategy.MERGE,
        line: MergeStrategy.EXTEND,
        shadow: MergeStrategy.REPLACE,
      },
    });

    // Create measurement-specific inheritance
    this.createInheritanceRule('measurement-base', {
      parentId: 'medical-base',
      inheritedProperties: ['font', 'line', 'measurementPrecision', 'unitDisplay'],
      overrides: {
        line: {
          width: 2,
          color: { rgb: [0, 123, 255], hex: '#007bff' },
          style: 'solid',
          cap: 'round',
          join: 'round',
        },
        measurementPrecision: 2,
      },
      mode: 'extend',
      priority: InheritancePriority.HIGH,
      active: true,
      conditions: [
        {
          property: 'category',
          operator: 'equals',
          value: AnnotationStyleCategory.MEASUREMENT,
          action: 'inherit',
        },
      ],
      propertyStrategies: {
        measurementPrecision: MergeStrategy.REPLACE,
        unitDisplay: MergeStrategy.MERGE,
      },
    });

    console.log('📐 Default inheritance rules initialized');
  }

  /* =============================================================================
   * INHERITANCE RULE MANAGEMENT
   * ============================================================================= */

  /**
   * Create inheritance rule
   */
  createInheritanceRule(
    childStyleId: string,
    config: Partial<EnhancedStyleInheritance>,
  ): EnhancedStyleInheritance {
    if (!config.parentId) {
      throw new Error('Parent style ID is required for inheritance rule');
    }

    const inheritance: EnhancedStyleInheritance = {
      parentId: config.parentId,
      inheritedProperties: config.inheritedProperties || ['line', 'font', 'opacity'],
      overrides: config.overrides || {},
      mode: config.mode || 'extend',
      priority: config.priority || InheritancePriority.NORMAL,
      conditions: config.conditions || [],
      propertyStrategies: config.propertyStrategies || {} as Partial<Record<keyof AnnotationStyling, MergeStrategy>>,
      active: config.active !== false,
      metadata: config.metadata || {
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system',
      },
    };

    // Update inheritance graph
    this.updateInheritanceGraph(childStyleId, inheritance);

    // Clear affected cache entries
    this.invalidateCache(childStyleId);

    this.emit('inheritanceRuleCreated', { childStyleId, inheritance });
    console.log(`🔗 Created inheritance rule: ${childStyleId} → ${inheritance.parentId}`);

    return inheritance;
  }

  /**
   * Update inheritance graph
   */
  private updateInheritanceGraph(styleId: string, inheritance: EnhancedStyleInheritance): void {
    // Get or create child node
    let childNode = this.inheritanceGraph.get(styleId);
    if (!childNode) {
      childNode = {
        styleId,
        parentIds: [],
        childIds: [],
        inheritance: [],
      };
      this.inheritanceGraph.set(styleId, childNode);
    }

    // Add inheritance rule with safe array access
    const existingIndex = childNode.inheritance.findIndex(i => i.parentId === inheritance.parentId);
    if (existingIndex >= 0 && existingIndex < childNode.inheritance.length) {
      childNode.inheritance[existingIndex] = inheritance;
    } else {
      childNode.inheritance.push(inheritance);
      childNode.parentIds.push(inheritance.parentId);
    }

    // Update parent node
    let parentNode = this.inheritanceGraph.get(inheritance.parentId);
    if (!parentNode) {
      parentNode = {
        styleId: inheritance.parentId,
        parentIds: [],
        childIds: [],
        inheritance: [],
      };
      this.inheritanceGraph.set(inheritance.parentId, parentNode);
    }

    if (!parentNode.childIds.includes(styleId)) {
      parentNode.childIds.push(styleId);
    }
  }

  /**
   * Remove inheritance rule
   */
  removeInheritanceRule(childStyleId: string, parentStyleId: string): boolean {
    const childNode = this.inheritanceGraph.get(childStyleId);
    if (!childNode) return false;

    // Remove inheritance rule
    const inheritanceIndex = childNode.inheritance.findIndex(i => i.parentId === parentStyleId);
    if (inheritanceIndex === -1) return false;

    childNode.inheritance.splice(inheritanceIndex, 1);

    // Remove parent reference
    const parentIndex = childNode.parentIds.indexOf(parentStyleId);
    if (parentIndex >= 0) {
      childNode.parentIds.splice(parentIndex, 1);
    }

    // Update parent node
    const parentNode = this.inheritanceGraph.get(parentStyleId);
    if (parentNode) {
      const childIndex = parentNode.childIds.indexOf(childStyleId);
      if (childIndex >= 0) {
        parentNode.childIds.splice(childIndex, 1);
      }
    }

    // Clear cache
    this.invalidateCache(childStyleId);

    this.emit('inheritanceRuleRemoved', { childStyleId, parentStyleId });
    console.log(`🔗 Removed inheritance rule: ${childStyleId} ← ${parentStyleId}`);

    return true;
  }

  /**
   * Get inheritance rules for style
   */
  getInheritanceRules(styleId: string): EnhancedStyleInheritance[] {
    const node = this.inheritanceGraph.get(styleId);
    return node?.inheritance || [];
  }

  /* =============================================================================
   * STYLE RESOLUTION
   * ============================================================================= */

  /**
   * Resolve style with inheritance
   */
  resolveStyle(styleId: string, options?: {
    skipCache?: boolean;
    maxDepth?: number;
  }): InheritanceResolution {
    const startTime = Date.now();
    const skipCache = options?.skipCache || false;
    const maxDepth = options?.maxDepth || 10;

    // Check cache first
    if (!skipCache) {
      const cached = this.getCachedResolution(styleId);
      if (cached) {
        return {
          ...cached,
          metadata: {
            ...cached.metadata,
            cacheHit: true,
          },
        };
      }
    }

    // Get base style
    const baseStyle = styleManager.getStyle(styleId);
    if (!baseStyle) {
      throw new Error(`Style not found: ${styleId}`);
    }

    // Resolve inheritance chain
    const resolution = this.resolveInheritanceChain(styleId, baseStyle, [], maxDepth);

    // Add metadata
    resolution.metadata = {
      resolvedAt: new Date(),
      cacheHit: false,
      resolutionTime: Date.now() - startTime,
    };

    // Cache result
    this.cacheResolution(styleId, resolution);

    return resolution;
  }

  /**
   * Resolve inheritance chain recursively
   */
  private resolveInheritanceChain(
    styleId: string,
    currentStyle: AnnotationStyling,
    chain: string[],
    maxDepth: number,
  ): InheritanceResolution {
    const warnings: string[] = [];
    const inheritedProperties: InheritanceResolution['inheritedProperties'] = [];

    // Check for circular dependencies
    if (chain.includes(styleId)) {
      warnings.push(`Circular dependency detected in inheritance chain: ${chain.join(' → ')} → ${styleId}`);
      return {
        resolvedStyle: currentStyle,
        inheritanceChain: chain,
        inheritedProperties,
        warnings,
        metadata: { resolvedAt: new Date(), cacheHit: false, resolutionTime: 0 },
      };
    }

    // Check max depth
    if (chain.length >= maxDepth) {
      warnings.push(`Maximum inheritance depth (${maxDepth}) reached`);
      return {
        resolvedStyle: currentStyle,
        inheritanceChain: chain,
        inheritedProperties,
        warnings,
        metadata: { resolvedAt: new Date(), cacheHit: false, resolutionTime: 0 },
      };
    }

    const node = this.inheritanceGraph.get(styleId);
    if (!node || node.inheritance.length === 0) {
      return {
        resolvedStyle: currentStyle,
        inheritanceChain: [...chain, styleId],
        inheritedProperties,
        warnings,
        metadata: { resolvedAt: new Date(), cacheHit: false, resolutionTime: 0 },
      };
    }

    // Sort inheritance rules by priority
    const activeRules = node.inheritance
      .filter(rule => rule.active)
      .sort((a, b) => b.priority - a.priority);

    let resolvedStyle = { ...currentStyle };
    const newChain = [...chain, styleId];

    // Apply inheritance rules
    for (const rule of activeRules) {
      // Check conditions
      if (!this.evaluateConditions(rule.conditions || [], resolvedStyle)) {
        continue;
      }

      // Get parent style
      const parentStyle = styleManager.getStyle(rule.parentId);
      if (!parentStyle) {
        warnings.push(`Parent style not found: ${rule.parentId}`);
        continue;
      }

      // Recursively resolve parent
      const parentResolution = this.resolveInheritanceChain(
        rule.parentId,
        parentStyle,
        newChain,
        maxDepth,
      );

      // Merge warnings
      warnings.push(...parentResolution.warnings);

      // Apply inheritance
      const mergeResult = this.applyInheritance(resolvedStyle, parentResolution.resolvedStyle, rule);
      resolvedStyle = mergeResult.style;
      inheritedProperties.push(...mergeResult.inheritedProperties);
    }

    return {
      resolvedStyle,
      inheritanceChain: newChain,
      inheritedProperties,
      warnings,
      metadata: { resolvedAt: new Date(), cacheHit: false, resolutionTime: 0 },
    };
  }

  /**
   * Apply inheritance rule to merge styles
   */
  private applyInheritance(
    childStyle: AnnotationStyling,
    parentStyle: AnnotationStyling,
    rule: EnhancedStyleInheritance,
  ): {
    style: AnnotationStyling;
    inheritedProperties: Array<{
      property: keyof AnnotationStyling;
      fromStyleId: string;
      strategy: MergeStrategy;
    }>;
  } {
    const merged = { ...childStyle };
    const inheritedProperties: Array<{
      property: keyof AnnotationStyling;
      fromStyleId: string;
      strategy: MergeStrategy;
    }> = [];

    // Apply inherited properties with safe property access
    const allowedProperties = new Set<keyof AnnotationStyling>([
      'line', 'fill', 'font', 'shadow', 'opacity', 'visible', 'zIndex',
      'animation', 'measurementPrecision', 'unitDisplay', 'scaleFactor',
    ]);

    for (const property of rule.inheritedProperties) {
      // Security: Validate property is allowed
      if (!allowedProperties.has(property)) {
        console.warn(`Invalid property in inheritance rule: ${String(property)}`);
        continue;
      }

      const strategy = rule.propertyStrategies?.[property] || this.getDefaultMergeStrategy(rule.mode);
      const parentValue = this.safePropertyAccess(parentStyle, property);
      const childValue = this.safePropertyAccess(childStyle, property);

      if (parentValue !== undefined) {
        switch (strategy) {
          case MergeStrategy.REPLACE:
            this.safePropertySet(merged, property, parentValue);
            break;

          case MergeStrategy.EXTEND:
            if (typeof parentValue === 'object' && typeof childValue === 'object' &&
                !Array.isArray(parentValue) && !Array.isArray(childValue)) {
              this.safePropertySet(merged, property, { ...parentValue, ...childValue });
            } else {
              this.safePropertySet(merged, property, childValue !== undefined ? childValue : parentValue);
            }
            break;

          case MergeStrategy.MERGE:
            if (typeof parentValue === 'object' && typeof childValue === 'object') {
              this.safePropertySet(merged, property, this.deepMerge(parentValue, childValue));
            } else {
              this.safePropertySet(merged, property, childValue !== undefined ? childValue : parentValue);
            }
            break;

          case MergeStrategy.PRESERVE:
            // Keep child value unchanged
            break;
        }

        inheritedProperties.push({
          property,
          fromStyleId: rule.parentId,
          strategy,
        });
      }
    }

    // Apply overrides with safe property access
    this.applyOverrides(merged, rule.overrides);

    return { style: merged, inheritedProperties };
  }

  /**
   * Evaluate inheritance conditions
   */
  private evaluateConditions(conditions: InheritanceCondition[], style: AnnotationStyling): boolean {
    return conditions.every(condition => {
      const propertyValue = style[condition.property];

      switch (condition.operator) {
        case 'equals':
          return propertyValue === condition.value;
        case 'not-equals':
          return propertyValue !== condition.value;
        case 'greater':
          return typeof propertyValue === 'number' && propertyValue > condition.value;
        case 'less':
          return typeof propertyValue === 'number' && propertyValue < condition.value;
        case 'contains':
          return typeof propertyValue === 'string' && propertyValue.includes(condition.value);
        case 'exists':
          return propertyValue !== undefined && propertyValue !== null;
        default:
          return false;
      }
    });
  }

  /**
   * Get default merge strategy based on inheritance mode
   */
  private getDefaultMergeStrategy(mode: StyleInheritance['mode']): MergeStrategy {
    switch (mode) {
      case 'override':
        return MergeStrategy.REPLACE;
      case 'extend':
        return MergeStrategy.EXTEND;
      case 'merge':
        return MergeStrategy.MERGE;
      default:
        return MergeStrategy.EXTEND;
    }
  }

  /**
   * Safe property access to prevent object injection
   */
  private safePropertyAccess<T extends object, K extends keyof T>(obj: T, key: K): T[K] | undefined {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return obj[key];
    }
    return undefined;
  }

  /**
   * Safe property set to prevent object injection
   */
  private safePropertySet<T extends object, K extends keyof T>(obj: T, key: K, value: unknown): void {
    if (typeof key === 'string' || typeof key === 'number' || typeof key === 'symbol') {
      (obj as Record<string | number | symbol, unknown>)[key] = value;
    }
  }

  /**
   * Apply overrides with safe property access
   */
  private applyOverrides(target: AnnotationStyling, overrides: Partial<AnnotationStyling>): void {
    const allowedKeys = new Set<keyof AnnotationStyling>([
      'line', 'fill', 'font', 'shadow', 'opacity', 'visible', 'zIndex',
      'animation', 'measurementPrecision', 'unitDisplay', 'scaleFactor',
    ]);

    for (const [key, value] of Object.entries(overrides)) {
      if (allowedKeys.has(key as keyof AnnotationStyling) && value !== undefined) {
        this.safePropertySet(target, key as keyof AnnotationStyling, value);
      }
    }
  }

  /**
   * Deep merge objects with safe property access
   */
  private deepMerge(target: unknown, source: unknown): unknown {
    if (typeof target !== 'object' || typeof source !== 'object' ||
        target === null || source === null) {
      return source;
    }

    const result = { ...target };

    // Use Object.keys with hasOwnProperty check for security
    Object.keys(source).forEach(key => {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = (source as Record<string, unknown>)[key];
        const targetValue = (target as Record<string, unknown>)[key];

        if (typeof sourceValue === 'object' && !Array.isArray(sourceValue) && sourceValue !== null) {
          (result as Record<string, unknown>)[key] = this.deepMerge(targetValue || {}, sourceValue);
        } else {
          (result as Record<string, unknown>)[key] = sourceValue;
        }
      }
    });

    return result;
  }

  /* =============================================================================
   * CACHING SYSTEM
   * ============================================================================= */

  /**
   * Get cached resolution
   */
  private getCachedResolution(styleId: string): InheritanceResolution | null {
    const cached = this.resolutionCache.get(styleId);
    if (!cached) return null;

    // Check TTL
    const age = Date.now() - cached.metadata.resolvedAt.getTime();
    if (age > this.cacheTTL) {
      this.resolutionCache.delete(styleId);
      return null;
    }

    return cached;
  }

  /**
   * Cache resolution result
   */
  private cacheResolution(styleId: string, resolution: InheritanceResolution): void {
    this.resolutionCache.set(styleId, resolution);
  }

  /**
   * Invalidate cache entries
   */
  private invalidateCache(styleId: string): void {
    // Remove direct cache entry
    this.resolutionCache.delete(styleId);

    // Remove cache entries for children
    const node = this.inheritanceGraph.get(styleId);
    if (node) {
      node.childIds.forEach(childId => {
        this.invalidateCache(childId);
      });
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.resolutionCache.clear();
    console.log('🧹 Style inheritance cache cleared');
  }

  /* =============================================================================
   * UTILITY METHODS
   * ============================================================================= */

  /**
   * Validate inheritance configuration
   */
  validateInheritance(inheritance: EnhancedStyleInheritance): StyleValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check parent exists
    const parentStyle = styleManager.getStyle(inheritance.parentId);
    if (!parentStyle) {
      errors.push(`Parent style not found: ${inheritance.parentId}`);
    }

    // Check for circular dependencies
    if (this.wouldCreateCircularDependency(inheritance.parentId, inheritance.parentId)) {
      errors.push('Inheritance would create circular dependency');
    }

    // Check conditions
    inheritance.conditions?.forEach((condition, index) => {
      if (!condition.property || !condition.operator) {
        errors.push(`Invalid condition at index ${index}: missing property or operator`);
      }
    });

    // Performance warnings
    if (inheritance.inheritedProperties.length > 15) {
      warnings.push('Large number of inherited properties may impact performance');
    }

    if (inheritance.conditions && inheritance.conditions.length > 5) {
      warnings.push('Complex conditions may slow down inheritance resolution');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Check if inheritance would create circular dependency
   */
  private wouldCreateCircularDependency(styleId: string, targetParentId: string): boolean {
    const visited = new Set<string>();

    const checkCircular = (currentId: string): boolean => {
      if (visited.has(currentId)) return true;
      if (currentId === targetParentId) return true;

      visited.add(currentId);

      const node = this.inheritanceGraph.get(currentId);
      if (node) {
        return node.parentIds.some(parentId => checkCircular(parentId));
      }

      return false;
    };

    return checkCircular(styleId);
  }

  /**
   * Get inheritance statistics
   */
  getInheritanceStatistics() {
    const totalNodes = this.inheritanceGraph.size;
    const totalRules = Array.from(this.inheritanceGraph.values())
      .reduce((sum, node) => sum + node.inheritance.length, 0);
    const activeRules = Array.from(this.inheritanceGraph.values())
      .reduce((sum, node) => sum + node.inheritance.filter(r => r.active).length, 0);
    const cacheSize = this.resolutionCache.size;

    return {
      totalNodes,
      totalRules,
      activeRules,
      cacheSize,
      cacheHitRate: this.calculateCacheHitRate(),
    };
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    // This would need actual tracking in a real implementation
    return 0.75; // Placeholder
  }

  /* =============================================================================
   * EVENT SYSTEM
   * ============================================================================= */

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }
}

// Export singleton instance
export const styleInheritanceSystem = StyleInheritanceSystem.getInstance();
