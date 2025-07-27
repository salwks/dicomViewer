/**
 * Style Inheritance System Tests
 *
 * Comprehensive test suite for the StyleInheritanceSystem class
 * Tests inheritance rules, resolution, caching, and validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StyleInheritanceSystem, InheritancePriority, MergeStrategy } from '../StyleInheritanceSystem';
import { StyleManager } from '../StyleManager';
import {
  AnnotationStyling,
  AnnotationStyleCategory,
  AnnotationType,
  DEFAULT_COLORS,
  DEFAULT_FONTS,
} from '../../types/annotation-styling';

describe('StyleInheritanceSystem', () => {
  let inheritanceSystem: StyleInheritanceSystem;
  let styleManager: StyleManager;

  // Helper function to create test style
  const createTestStyle = (id: string, overrides: Partial<AnnotationStyling> = {}): AnnotationStyling => ({
    id,
    name: `Test Style ${id}`,
    description: `Test style for ${id}`,
    line: {
      width: 2,
      color: DEFAULT_COLORS.PRIMARY,
      style: 'solid',
      cap: 'round',
      join: 'round',
    },
    font: DEFAULT_FONTS.PRIMARY,
    opacity: 1.0,
    visible: true,
    zIndex: 100,
    scaleFactor: 1.0,
    category: AnnotationStyleCategory.CUSTOM,
    compatibleTypes: [AnnotationType.LENGTH],
    isPreset: false,
    isReadonly: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: '1.0.0',
    tags: [],
    ...overrides,
  });

  beforeEach(() => {
    // Reset singleton instances
    (StyleInheritanceSystem as any).instance = undefined;
    (StyleManager as any).instance = undefined;

    inheritanceSystem = StyleInheritanceSystem.getInstance();
    styleManager = StyleManager.getInstance();

    // Mock StyleManager methods
    vi.spyOn(styleManager, 'getStyle').mockImplementation((id: string) => {
      switch (id) {
        case 'parent-style':
          return createTestStyle('parent-style', {
            line: { width: 3, color: DEFAULT_COLORS.SUCCESS, style: 'dashed', cap: 'square', join: 'miter' },
            font: { ...DEFAULT_FONTS.PRIMARY, size: 16, weight: 'bold' },
            opacity: 0.8,
          });
        case 'child-style':
          return createTestStyle('child-style', {
            line: { width: 2, color: DEFAULT_COLORS.PRIMARY, style: 'solid', cap: 'round', join: 'round' },
            font: { ...DEFAULT_FONTS.PRIMARY, size: 14, weight: 'normal' },
            opacity: 1.0,
          });
        case 'grandparent-style':
          return createTestStyle('grandparent-style', {
            line: { width: 4, color: DEFAULT_COLORS.DANGER, style: 'dotted', cap: 'butt', join: 'bevel' },
            font: { ...DEFAULT_FONTS.PRIMARY, size: 18, weight: 'bolder' },
            measurementPrecision: 3,
          });
        case 'system-default':
          return createTestStyle('system-default', {
            category: AnnotationStyleCategory.PRESET,
            isPreset: true,
            isReadonly: true,
          });
        default:
          return null;
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    inheritanceSystem.clearCache();
  });

  describe('Initialization', () => {
    it('should create singleton instance', () => {
      const instance1 = StyleInheritanceSystem.getInstance();
      const instance2 = StyleInheritanceSystem.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize with default inheritance rules', () => {
      const medicalBaseRules = inheritanceSystem.getInheritanceRules('medical-base');
      const measurementBaseRules = inheritanceSystem.getInheritanceRules('measurement-base');

      expect(medicalBaseRules).toHaveLength(1);
      expect(measurementBaseRules).toHaveLength(1);

      expect(medicalBaseRules[0].parentId).toBe('system-default');
      expect(measurementBaseRules[0].parentId).toBe('medical-base');
    });
  });

  describe('Inheritance Rule Management', () => {
    it('should create basic inheritance rule', () => {
      const inheritance = inheritanceSystem.createInheritanceRule('child-style', {
        parentId: 'parent-style',
        inheritedProperties: ['line', 'font'],
        mode: 'extend',
        priority: InheritancePriority.NORMAL,
      });

      expect(inheritance.parentId).toBe('parent-style');
      expect(inheritance.inheritedProperties).toEqual(['line', 'font']);
      expect(inheritance.mode).toBe('extend');
      expect(inheritance.priority).toBe(InheritancePriority.NORMAL);
      expect(inheritance.active).toBe(true);
    });

    it('should create inheritance rule with conditions', () => {
      const inheritance = inheritanceSystem.createInheritanceRule('child-style', {
        parentId: 'parent-style',
        inheritedProperties: ['line'],
        conditions: [
          {
            property: 'category',
            operator: 'equals',
            value: AnnotationStyleCategory.MEASUREMENT,
            action: 'inherit',
          },
        ],
        priority: InheritancePriority.HIGH,
      });

      expect(inheritance.conditions).toHaveLength(1);
      expect(inheritance.conditions![0].property).toBe('category');
      expect(inheritance.conditions![0].operator).toBe('equals');
      expect(inheritance.conditions![0].value).toBe(AnnotationStyleCategory.MEASUREMENT);
    });

    it('should create inheritance rule with custom merge strategies', () => {
      const inheritance = inheritanceSystem.createInheritanceRule('child-style', {
        parentId: 'parent-style',
        inheritedProperties: ['line', 'font', 'opacity'],
        propertyStrategies: {
          line: MergeStrategy.REPLACE,
          font: MergeStrategy.MERGE,
          opacity: MergeStrategy.PRESERVE,
        },
        priority: InheritancePriority.HIGH,
      });

      expect(inheritance.propertyStrategies).toBeDefined();
      expect(inheritance.propertyStrategies!.line).toBe(MergeStrategy.REPLACE);
      expect(inheritance.propertyStrategies!.font).toBe(MergeStrategy.MERGE);
      expect(inheritance.propertyStrategies!.opacity).toBe(MergeStrategy.PRESERVE);
    });

    it('should get inheritance rules for style', () => {
      inheritanceSystem.createInheritanceRule('child-style', {
        parentId: 'parent-style',
        inheritedProperties: ['line'],
      });

      inheritanceSystem.createInheritanceRule('child-style', {
        parentId: 'grandparent-style',
        inheritedProperties: ['font'],
        priority: InheritancePriority.HIGH,
      });

      const rules = inheritanceSystem.getInheritanceRules('child-style');
      expect(rules).toHaveLength(2);

      const parentRule = rules.find(r => r.parentId === 'parent-style');
      const grandparentRule = rules.find(r => r.parentId === 'grandparent-style');

      expect(parentRule).toBeTruthy();
      expect(grandparentRule).toBeTruthy();
      expect(grandparentRule!.priority).toBe(InheritancePriority.HIGH);
    });

    it('should remove inheritance rule', () => {
      inheritanceSystem.createInheritanceRule('child-style', {
        parentId: 'parent-style',
        inheritedProperties: ['line'],
      });

      let rules = inheritanceSystem.getInheritanceRules('child-style');
      expect(rules).toHaveLength(1);

      const removed = inheritanceSystem.removeInheritanceRule('child-style', 'parent-style');
      expect(removed).toBe(true);

      rules = inheritanceSystem.getInheritanceRules('child-style');
      expect(rules).toHaveLength(0);
    });

    it('should not remove non-existent inheritance rule', () => {
      const removed = inheritanceSystem.removeInheritanceRule('child-style', 'non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('Style Resolution', () => {
    it('should resolve style without inheritance', () => {
      const resolution = inheritanceSystem.resolveStyle('child-style');

      expect(resolution.resolvedStyle.id).toBe('child-style');
      expect(resolution.inheritanceChain).toEqual(['child-style']);
      expect(resolution.inheritedProperties).toHaveLength(0);
      expect(resolution.warnings).toHaveLength(0);
    });

    it('should resolve style with simple inheritance', () => {
      inheritanceSystem.createInheritanceRule('child-style', {
        parentId: 'parent-style',
        inheritedProperties: ['line'],
        mode: 'extend',
      });

      const resolution = inheritanceSystem.resolveStyle('child-style');

      expect(resolution.resolvedStyle.id).toBe('child-style');
      expect(resolution.inheritanceChain).toEqual(['parent-style', 'child-style']);
      expect(resolution.inheritedProperties).toHaveLength(1);
      expect(resolution.inheritedProperties[0].property).toBe('line');
      expect(resolution.inheritedProperties[0].fromStyleId).toBe('parent-style');

      // Line should be inherited from parent (width: 3, color: SUCCESS)
      expect(resolution.resolvedStyle.line.width).toBe(3);
      expect(resolution.resolvedStyle.line.color).toEqual(DEFAULT_COLORS.SUCCESS);
    });

    it('should resolve style with multi-level inheritance', () => {
      // Create inheritance chain: grandparent -> parent -> child
      inheritanceSystem.createInheritanceRule('parent-style', {
        parentId: 'grandparent-style',
        inheritedProperties: ['measurementPrecision'],
      });

      inheritanceSystem.createInheritanceRule('child-style', {
        parentId: 'parent-style',
        inheritedProperties: ['line', 'measurementPrecision'],
      });

      const resolution = inheritanceSystem.resolveStyle('child-style');

      expect(resolution.inheritanceChain).toEqual(['grandparent-style', 'parent-style', 'child-style']);
      expect(resolution.resolvedStyle.measurementPrecision).toBe(3); // From grandparent
      expect(resolution.resolvedStyle.line.width).toBe(3); // From parent
    });

    it('should resolve style with priority-based inheritance', () => {
      // Create two inheritance rules with different priorities
      inheritanceSystem.createInheritanceRule('child-style', {
        parentId: 'parent-style',
        inheritedProperties: ['line'],
        priority: InheritancePriority.NORMAL,
      });

      inheritanceSystem.createInheritanceRule('child-style', {
        parentId: 'grandparent-style',
        inheritedProperties: ['line'],
        priority: InheritancePriority.HIGH,
      });

      const resolution = inheritanceSystem.resolveStyle('child-style');

      // High priority rule should be applied first (grandparent line width: 4)
      expect(resolution.resolvedStyle.line.width).toBe(4);
      expect(resolution.resolvedStyle.line.color).toEqual(DEFAULT_COLORS.DANGER);
    });

    it('should resolve style with conditional inheritance', () => {
      inheritanceSystem.createInheritanceRule('child-style', {
        parentId: 'parent-style',
        inheritedProperties: ['line'],
        conditions: [
          {
            property: 'category',
            operator: 'equals',
            value: AnnotationStyleCategory.CUSTOM,
            action: 'inherit',
          },
        ],
      });

      const resolution = inheritanceSystem.resolveStyle('child-style');

      // Condition should match (child has CUSTOM category)
      expect(resolution.resolvedStyle.line.width).toBe(3); // Inherited from parent
    });

    it('should skip inheritance when conditions not met', () => {
      inheritanceSystem.createInheritanceRule('child-style', {
        parentId: 'parent-style',
        inheritedProperties: ['line'],
        conditions: [
          {
            property: 'category',
            operator: 'equals',
            value: AnnotationStyleCategory.MEASUREMENT,
            action: 'inherit',
          },
        ],
      });

      const resolution = inheritanceSystem.resolveStyle('child-style');

      // Condition should not match (child has CUSTOM, not MEASUREMENT)
      expect(resolution.resolvedStyle.line.width).toBe(2); // Original child value
    });

    it('should handle different merge strategies', () => {
      inheritanceSystem.createInheritanceRule('child-style', {
        parentId: 'parent-style',
        inheritedProperties: ['line', 'font'],
        propertyStrategies: {
          line: MergeStrategy.REPLACE,
          font: MergeStrategy.MERGE,
        },
      });

      const resolution = inheritanceSystem.resolveStyle('child-style');

      // Line should be completely replaced (width: 3 from parent)
      expect(resolution.resolvedStyle.line.width).toBe(3);
      expect(resolution.resolvedStyle.line.color).toEqual(DEFAULT_COLORS.SUCCESS);

      // Font should be merged (size: 16 from parent, family from child)
      expect(resolution.resolvedStyle.font.size).toBe(16);
      expect(resolution.resolvedStyle.font.weight).toBe('bold');
      expect(resolution.resolvedStyle.font.family).toBe(DEFAULT_FONTS.PRIMARY.family);
    });

    it('should detect circular dependencies', () => {
      // Create circular dependency: child -> parent -> child
      inheritanceSystem.createInheritanceRule('child-style', {
        parentId: 'parent-style',
        inheritedProperties: ['line'],
      });

      inheritanceSystem.createInheritanceRule('parent-style', {
        parentId: 'child-style',
        inheritedProperties: ['font'],
      });

      const resolution = inheritanceSystem.resolveStyle('child-style');

      expect(resolution.warnings.length).toBeGreaterThan(0);
      expect(resolution.warnings.some(w => w.includes('Circular dependency'))).toBe(true);
    });

    it('should handle max depth limit', () => {
      // Create deep inheritance chain
      for (let i = 0; i < 15; i++) {
        const childId = `style-${i}`;
        const parentId = `style-${i + 1}`;

        vi.spyOn(styleManager, 'getStyle').mockReturnValueOnce(createTestStyle(childId));

        inheritanceSystem.createInheritanceRule(childId, {
          parentId,
          inheritedProperties: ['line'],
        });
      }

      const resolution = inheritanceSystem.resolveStyle('style-0', { maxDepth: 5 });

      expect(resolution.warnings.some(w => w.includes('Maximum inheritance depth'))).toBe(true);
    });
  });

  describe('Caching System', () => {
    it('should cache resolution results', () => {
      inheritanceSystem.createInheritanceRule('child-style', {
        parentId: 'parent-style',
        inheritedProperties: ['line'],
      });

      // First resolution
      const resolution1 = inheritanceSystem.resolveStyle('child-style');
      expect(resolution1.metadata.cacheHit).toBe(false);

      // Second resolution should be cached
      const resolution2 = inheritanceSystem.resolveStyle('child-style');
      expect(resolution2.metadata.cacheHit).toBe(true);
    });

    it('should skip cache when requested', () => {
      inheritanceSystem.createInheritanceRule('child-style', {
        parentId: 'parent-style',
        inheritedProperties: ['line'],
      });

      // First resolution
      inheritanceSystem.resolveStyle('child-style');

      // Second resolution with cache skip
      const resolution = inheritanceSystem.resolveStyle('child-style', { skipCache: true });
      expect(resolution.metadata.cacheHit).toBe(false);
    });

    it('should clear cache', () => {
      inheritanceSystem.createInheritanceRule('child-style', {
        parentId: 'parent-style',
        inheritedProperties: ['line'],
      });

      // Create cache entry
      inheritanceSystem.resolveStyle('child-style');

      // Clear cache
      inheritanceSystem.clearCache();

      // Next resolution should not be cached
      const resolution = inheritanceSystem.resolveStyle('child-style');
      expect(resolution.metadata.cacheHit).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should validate valid inheritance configuration', () => {
      const inheritance = inheritanceSystem.createInheritanceRule('child-style', {
        parentId: 'parent-style',
        inheritedProperties: ['line', 'font'],
        conditions: [
          {
            property: 'category',
            operator: 'equals',
            value: AnnotationStyleCategory.CUSTOM,
            action: 'inherit',
          },
        ],
      });

      const validation = inheritanceSystem.validateInheritance(inheritance);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing parent style', () => {
      const inheritance = inheritanceSystem.createInheritanceRule('child-style', {
        parentId: 'non-existent-parent',
        inheritedProperties: ['line'],
      });

      const validation = inheritanceSystem.validateInheritance(inheritance);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Parent style not found: non-existent-parent');
    });

    it('should detect invalid conditions', () => {
      const inheritance = inheritanceSystem.createInheritanceRule('child-style', {
        parentId: 'parent-style',
        inheritedProperties: ['line'],
        conditions: [
          {
            property: '' as any,
            operator: '' as any,
            value: 'test',
            action: 'inherit',
          },
        ],
      });

      const validation = inheritanceSystem.validateInheritance(inheritance);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('Invalid condition'))).toBe(true);
    });

    it('should warn about performance issues', () => {
      const inheritance = inheritanceSystem.createInheritanceRule('child-style', {
        parentId: 'parent-style',
        inheritedProperties: [
          'line', 'font', 'fill', 'shadow', 'opacity', 'visible', 'zIndex',
          'animation', 'measurementPrecision', 'unitDisplay', 'scaleFactor',
          'category', 'compatibleTypes', 'selected', 'hover', 'active', 'disabled',
        ], // More than 15 properties
        conditions: [
          { property: 'category', operator: 'equals', value: 'test1', action: 'inherit' },
          { property: 'opacity', operator: 'greater', value: 0.5, action: 'inherit' },
          { property: 'visible', operator: 'equals', value: true, action: 'inherit' },
          { property: 'zIndex', operator: 'less', value: 200, action: 'inherit' },
          { property: 'name', operator: 'contains', value: 'test', action: 'inherit' },
          { property: 'tags', operator: 'exists', value: null, action: 'inherit' },
        ], // More than 5 conditions
      });

      const validation = inheritanceSystem.validateInheritance(inheritance);
      expect(validation.warnings.some(w => w.includes('inherited properties may impact performance'))).toBe(true);
      expect(validation.warnings.some(w => w.includes('Complex conditions may slow down'))).toBe(true);
    });
  });

  describe('Statistics and Utilities', () => {
    it('should get inheritance statistics', () => {
      inheritanceSystem.createInheritanceRule('child-style', {
        parentId: 'parent-style',
        inheritedProperties: ['line'],
      });

      inheritanceSystem.createInheritanceRule('child-style', {
        parentId: 'grandparent-style',
        inheritedProperties: ['font'],
        active: false,
      });

      const stats = inheritanceSystem.getInheritanceStatistics();
      expect(stats.totalNodes).toBeGreaterThan(0);
      expect(stats.totalRules).toBeGreaterThan(0);
      expect(stats.activeRules).toBeLessThanOrEqual(stats.totalRules);
      expect(typeof stats.cacheHitRate).toBe('number');
    });
  });

  describe('Event System', () => {
    it('should emit events on inheritance rule creation', (done: () => void) => {
      inheritanceSystem.on('inheritanceRuleCreated', (data: { childStyleId: string; inheritance: unknown }) => {
        expect(data.childStyleId).toBe('event-test-child');
        expect((data.inheritance as { parentId: string }).parentId).toBe('parent-style');
        done();
      });

      inheritanceSystem.createInheritanceRule('event-test-child', {
        parentId: 'parent-style',
        inheritedProperties: ['line'],
      });
    });

    it('should emit events on inheritance rule removal', (done: () => void) => {
      inheritanceSystem.createInheritanceRule('event-test-child', {
        parentId: 'parent-style',
        inheritedProperties: ['line'],
      });

      inheritanceSystem.on('inheritanceRuleRemoved', (data: any) => {
        expect(data.childStyleId).toBe('event-test-child');
        expect(data.parentStyleId).toBe('parent-style');
        done();
      });

      inheritanceSystem.removeInheritanceRule('event-test-child', 'parent-style');
    });

    it('should remove event listeners', () => {
      const callback = vi.fn();

      inheritanceSystem.on('inheritanceRuleCreated', callback);
      inheritanceSystem.off('inheritanceRuleCreated', callback);

      inheritanceSystem.createInheritanceRule('no-event-child', {
        parentId: 'parent-style',
        inheritedProperties: ['line'],
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should throw error when creating rule without parent ID', () => {
      expect(() => {
        inheritanceSystem.createInheritanceRule('child-style', {
          inheritedProperties: ['line'],
        } as any);
      }).toThrow('Parent style ID is required for inheritance rule');
    });

    it('should throw error when resolving non-existent style', () => {
      expect(() => {
        inheritanceSystem.resolveStyle('non-existent-style');
      }).toThrow('Style not found: non-existent-style');
    });

    it('should handle missing parent style gracefully', () => {
      inheritanceSystem.createInheritanceRule('child-style', {
        parentId: 'missing-parent',
        inheritedProperties: ['line'],
      });

      const resolution = inheritanceSystem.resolveStyle('child-style');
      expect(resolution.warnings.some(w => w.includes('Parent style not found'))).toBe(true);
      expect(resolution.resolvedStyle.id).toBe('child-style'); // Should return original style
    });
  });
});
