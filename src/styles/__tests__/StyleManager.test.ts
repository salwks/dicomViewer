/**
 * Style Manager Tests
 *
 * Comprehensive test suite for the StyleManager class
 * Tests style creation, management, validation, and export functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StyleManager } from '../StyleManager';
import {
  AnnotationStyling,
  AnnotationStyleCategory,
  AnnotationType,
  DEFAULT_COLORS,
  DEFAULT_FONTS,
} from '../../types/annotation-styling';

describe('StyleManager', () => {
  let styleManager: StyleManager;

  beforeEach(() => {
    // Reset singleton instance for each test
    (StyleManager as any).instance = undefined;
    styleManager = StyleManager.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create singleton instance', () => {
      const instance1 = StyleManager.getInstance();
      const instance2 = StyleManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize with default theme', () => {
      const activeTheme = styleManager.getActiveTheme();
      expect(activeTheme).toBeTruthy();
      expect(activeTheme?.id).toBe('default');
      expect(activeTheme?.name).toBe('Default Theme');
    });

    it('should have all preset styles available', () => {
      const presets = styleManager.getAllPresets();
      expect(presets.length).toBeGreaterThan(0);

      // Check for key presets
      const lengthPreset = presets.find(p => p.id.includes('length'));
      const anglePreset = presets.find(p => p.id.includes('angle'));
      const textPreset = presets.find(p => p.id.includes('text'));

      expect(lengthPreset).toBeTruthy();
      expect(anglePreset).toBeTruthy();
      expect(textPreset).toBeTruthy();
    });
  });

  describe('Style Creation', () => {
    it('should create custom style with default values', () => {
      const style = styleManager.createStyle({
        name: 'Test Style',
        description: 'Test style for unit testing',
      });

      expect(style.id).toBeTruthy();
      expect(style.name).toBe('Test Style');
      expect(style.description).toBe('Test style for unit testing');
      expect(style.isPreset).toBe(false);
      expect(style.isReadonly).toBe(false);
      expect(style.category).toBe(AnnotationStyleCategory.CUSTOM);
    });

    it('should create style with custom configuration', () => {
      const customConfig = {
        name: 'Custom Length Style',
        description: 'Custom style for length measurements',
        line: {
          width: 3,
          color: DEFAULT_COLORS.DANGER,
          style: 'dashed' as const,
          cap: 'square' as const,
          join: 'miter' as const,
        },
        font: {
          ...DEFAULT_FONTS.PRIMARY,
          size: 16,
          weight: 'bold' as const,
        },
        category: AnnotationStyleCategory.MEASUREMENT,
        compatibleTypes: [AnnotationType.LENGTH],
        measurementPrecision: 3,
      };

      const style = styleManager.createStyle(customConfig);

      expect(style.name).toBe(customConfig.name);
      expect(style.line.width).toBe(3);
      expect(style.line.color).toEqual(DEFAULT_COLORS.DANGER);
      expect(style.line.style).toBe('dashed');
      expect(style.font.size).toBe(16);
      expect(style.font.weight).toBe('bold');
      expect(style.category).toBe(AnnotationStyleCategory.MEASUREMENT);
      expect(style.compatibleTypes).toEqual([AnnotationType.LENGTH]);
      expect(style.measurementPrecision).toBe(3);
    });

    it('should generate unique IDs for styles', () => {
      const style1 = styleManager.createStyle({ name: 'Style 1' });
      const style2 = styleManager.createStyle({ name: 'Style 2' });

      expect(style1.id).not.toBe(style2.id);
      expect(style1.id).toBeTruthy();
      expect(style2.id).toBeTruthy();
    });
  });

  describe('Style Retrieval', () => {
    it('should retrieve custom style by ID', () => {
      const createdStyle = styleManager.createStyle({
        name: 'Retrievable Style',
        description: 'Style for retrieval testing',
      });

      const retrievedStyle = styleManager.getStyle(createdStyle.id);
      expect(retrievedStyle).toEqual(createdStyle);
    });

    it('should retrieve preset style by ID', () => {
      const presets = styleManager.getAllPresets();
      const firstPreset = presets[0];

      const retrievedStyle = styleManager.getStyle(firstPreset.id);
      expect(retrievedStyle).toEqual(firstPreset.styling);
    });

    it('should return null for non-existent style', () => {
      const retrievedStyle = styleManager.getStyle('non-existent-id');
      expect(retrievedStyle).toBeNull();
    });

    it('should get all custom styles', () => {
      const style1 = styleManager.createStyle({ name: 'Custom 1' });
      const style2 = styleManager.createStyle({ name: 'Custom 2' });

      const customStyles = styleManager.getAllCustomStyles();
      expect(customStyles).toHaveLength(2);
      expect(customStyles).toContainEqual(style1);
      expect(customStyles).toContainEqual(style2);
    });
  });

  describe('Style Updates', () => {
    it('should update custom style', () => {
      const originalStyle = styleManager.createStyle({
        name: 'Original Style',
        description: 'Original description',
      });

      const updates = {
        name: 'Updated Style',
        description: 'Updated description',
        line: {
          width: 5,
          color: DEFAULT_COLORS.SUCCESS,
          style: 'solid' as const,
          cap: 'round' as const,
          join: 'round' as const,
        },
      };

      const updatedStyle = styleManager.updateStyle(originalStyle.id, updates);

      expect(updatedStyle).toBeTruthy();
      expect(updatedStyle!.name).toBe('Updated Style');
      expect(updatedStyle!.description).toBe('Updated description');
      expect(updatedStyle!.line.width).toBe(5);
      expect(updatedStyle!.line.color).toEqual(DEFAULT_COLORS.SUCCESS);
      expect(updatedStyle!.updatedAt).not.toEqual(originalStyle.updatedAt);
    });

    it('should not update readonly style', () => {
      const readonlyStyle = styleManager.createStyle({
        name: 'Readonly Style',
        isReadonly: true,
      });

      const updatedStyle = styleManager.updateStyle(readonlyStyle.id, {
        name: 'Should Not Update',
      });

      expect(updatedStyle).toBeNull();
    });

    it('should not update non-existent style', () => {
      const updatedStyle = styleManager.updateStyle('non-existent', {
        name: 'Should Not Work',
      });

      expect(updatedStyle).toBeNull();
    });
  });

  describe('Style Deletion', () => {
    it('should delete custom style', () => {
      const style = styleManager.createStyle({ name: 'Deletable Style' });

      const deleted = styleManager.deleteStyle(style.id);
      expect(deleted).toBe(true);

      const retrievedStyle = styleManager.getStyle(style.id);
      expect(retrievedStyle).toBeNull();
    });

    it('should not delete readonly style', () => {
      const readonlyStyle = styleManager.createStyle({
        name: 'Readonly Style',
        isReadonly: true,
      });

      const deleted = styleManager.deleteStyle(readonlyStyle.id);
      expect(deleted).toBe(false);

      const retrievedStyle = styleManager.getStyle(readonlyStyle.id);
      expect(retrievedStyle).toBeTruthy();
    });

    it('should not delete non-existent style', () => {
      const deleted = styleManager.deleteStyle('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('Preset Management', () => {
    it('should get presets by category', () => {
      const measurementPresets = styleManager.getPresetsByCategory(
        AnnotationStyleCategory.MEASUREMENT,
      );

      expect(measurementPresets.length).toBeGreaterThan(0);
      measurementPresets.forEach(preset => {
        expect(preset.styling.category).toBe(AnnotationStyleCategory.MEASUREMENT);
      });
    });

    it('should get presets by type', () => {
      const lengthPresets = styleManager.getPresetsByType(AnnotationType.LENGTH);

      expect(lengthPresets.length).toBeGreaterThan(0);
      lengthPresets.forEach(preset => {
        expect(preset.styling.compatibleTypes).toContain(AnnotationType.LENGTH);
      });
    });

    it('should get popular presets', () => {
      const popularPresets = styleManager.getPopularPresets(5);

      expect(popularPresets).toHaveLength(5);

      // Should be sorted by popularity (descending) with safe array access
      for (let i = 1; i < popularPresets.length; i++) {
        const prevPreset = i - 1 >= 0 && i - 1 < popularPresets.length ? popularPresets[i - 1] : null;
        // eslint-disable-next-line security/detect-object-injection
        const currentPreset = i >= 0 && i < popularPresets.length ? popularPresets[i] : null;

        if (prevPreset && currentPreset) {
          expect(prevPreset.popularity).toBeGreaterThanOrEqual(currentPreset.popularity);
        }
      }
    });

    it('should create user preset from style', () => {
      const customStyle = styleManager.createStyle({
        name: 'Base Style',
        category: AnnotationStyleCategory.MEASUREMENT,
        compatibleTypes: [AnnotationType.LENGTH],
      });

      const preset = styleManager.createUserPreset(customStyle.id, {
        name: 'My Custom Preset',
        description: 'User-created preset',
        category: AnnotationStyleCategory.MEASUREMENT,
      });

      expect(preset).toBeTruthy();
      expect(preset!.name).toBe('My Custom Preset');
      expect(preset!.description).toBe('User-created preset');
      expect(preset!.isUserCreated).toBe(true);
      expect(preset!.styling.name).toBe('My Custom Preset');
    });

    it('should not create preset from non-existent style', () => {
      const preset = styleManager.createUserPreset('non-existent', {
        name: 'Should Fail',
        description: 'Should not work',
        category: AnnotationStyleCategory.CUSTOM,
      });

      expect(preset).toBeNull();
    });
  });

  describe('Style Validation', () => {
    it('should validate valid style', () => {
      const validStyle: AnnotationStyling = {
        id: 'valid-style',
        name: 'Valid Style',
        description: 'A valid style for testing',
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
      };

      const validation = styleManager.validateStyle(validStyle);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid style properties', () => {
      const invalidStyle: AnnotationStyling = {
        id: '',
        name: '',
        description: '',
        line: {
          width: -1, // Invalid: negative width
          color: {
            rgb: [300, -50, 999], // Invalid: out of range RGB
            hex: 'invalid-hex', // Invalid: bad hex format
          },
          style: 'solid',
          cap: 'round',
          join: 'round',
        },
        font: {
          ...DEFAULT_FONTS.PRIMARY,
          size: -5, // Invalid: negative size
        },
        opacity: 2.0, // Invalid: out of range
        visible: true,
        zIndex: 100,
        scaleFactor: 1.0,
        category: AnnotationStyleCategory.CUSTOM,
        compatibleTypes: [],
        isPreset: false,
        isReadonly: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0',
        tags: [],
      };

      const validation = styleManager.validateStyle(invalidStyle);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);

      expect(validation.errors).toContain('Style ID is required');
      expect(validation.errors).toContain('Style name is required');
      expect(validation.errors).toContain('Line width must be positive');
      expect(validation.errors).toContain('Font size must be positive');
      expect(validation.errors).toContain('Opacity must be between 0 and 1');
      expect(validation.errors).toContain('Invalid RGB values in line color');
      expect(validation.errors).toContain('Invalid hex color format in line color');
    });
  });

  describe('Theme Management', () => {
    it('should create custom theme', () => {
      const themeConfig = {
        name: 'Custom Theme',
        description: 'A custom theme for testing',
        colors: {
          primary: DEFAULT_COLORS.SUCCESS,
          secondary: DEFAULT_COLORS.SECONDARY,
          accent: DEFAULT_COLORS.WARNING,
          background: DEFAULT_COLORS.WHITE,
          text: DEFAULT_COLORS.BLACK,
          error: DEFAULT_COLORS.DANGER,
          warning: DEFAULT_COLORS.WARNING,
          success: DEFAULT_COLORS.SUCCESS,
        },
      };

      const theme = styleManager.createTheme(themeConfig);
      expect(theme.name).toBe('Custom Theme');
      expect(theme.description).toBe('A custom theme for testing');
      expect(theme.colors.primary).toEqual(DEFAULT_COLORS.SUCCESS);
    });

    it('should set and get active theme', () => {
      const theme = styleManager.createTheme({
        name: 'Test Theme',
      });

      const success = styleManager.setActiveTheme(theme.id);
      expect(success).toBe(true);

      const activeTheme = styleManager.getActiveTheme();
      expect(activeTheme?.id).toBe(theme.id);
    });

    it('should not set non-existent theme as active', () => {
      const success = styleManager.setActiveTheme('non-existent');
      expect(success).toBe(false);
    });

    it('should get all themes', () => {
      const theme1 = styleManager.createTheme({ name: 'Theme 1' });
      const theme2 = styleManager.createTheme({ name: 'Theme 2' });

      const allThemes = styleManager.getAllThemes();
      expect(allThemes.length).toBeGreaterThanOrEqual(3); // Default + 2 custom

      const customThemes = allThemes.filter(t => t.id === theme1.id || t.id === theme2.id);
      expect(customThemes).toHaveLength(2);
    });
  });

  describe('Export/Import', () => {
    it('should export all styles', () => {
      const style1 = styleManager.createStyle({ name: 'Export Style 1' });
      const style2 = styleManager.createStyle({ name: 'Export Style 2' });

      const exportData = styleManager.exportStyles();

      expect(exportData.version).toBe('1.0.0');
      expect(exportData.exportedAt).toBeInstanceOf(Date);
      expect(exportData.styles).toContainEqual(style1);
      expect(exportData.styles).toContainEqual(style2);
      expect(exportData.metadata.totalCount).toBe(2);
    });

    it('should export specific styles', () => {
      const style1 = styleManager.createStyle({ name: 'Export Style 1' });
      const style2 = styleManager.createStyle({ name: 'Export Style 2' });

      const exportData = styleManager.exportStyles([style1.id]);

      expect(exportData.styles).toHaveLength(1);
      expect(exportData.styles).toContainEqual(style1);
      expect(exportData.styles).not.toContainEqual(style2);
    });

    it('should import valid styles', () => {
      const exportData = {
        version: '1.0.0',
        exportedAt: new Date(),
        styles: [
          {
            id: 'import-test-1',
            name: 'Imported Style 1',
            description: 'Style imported for testing',
            line: {
              width: 2,
              color: DEFAULT_COLORS.PRIMARY,
              style: 'solid' as const,
              cap: 'round' as const,
              join: 'round' as const,
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
            tags: ['imported'],
          },
        ],
        metadata: {
          exportedBy: 'Test Suite',
          totalCount: 1,
          categories: [AnnotationStyleCategory.CUSTOM],
        },
      };

      const importedStyles = styleManager.importStyles(exportData);
      expect(importedStyles).toHaveLength(1);
      expect(importedStyles[0].name).toBe('Imported Style 1');
      expect(importedStyles[0].tags).toContain('imported');
    });

    it('should skip invalid styles during import', () => {
      const exportData = {
        version: '1.0.0',
        exportedAt: new Date(),
        styles: [
          {
            id: '', // Invalid: empty ID
            name: '', // Invalid: empty name
            description: '',
            line: {
              width: -1, // Invalid: negative width
              color: DEFAULT_COLORS.PRIMARY,
              style: 'solid' as const,
              cap: 'round' as const,
              join: 'round' as const,
            },
            font: DEFAULT_FONTS.PRIMARY,
            opacity: 1.0,
            visible: true,
            zIndex: 100,
            scaleFactor: 1.0,
            category: AnnotationStyleCategory.CUSTOM,
            compatibleTypes: [],
            isPreset: false,
            isReadonly: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            version: '1.0.0',
            tags: [],
          },
        ],
        metadata: {
          exportedBy: 'Test Suite',
          totalCount: 1,
          categories: [AnnotationStyleCategory.CUSTOM],
        },
      };

      const importedStyles = styleManager.importStyles(exportData);
      expect(importedStyles).toHaveLength(0); // Should skip invalid style
    });
  });

  describe('Utility Methods', () => {
    it('should clone style', () => {
      const originalStyle = styleManager.createStyle({
        name: 'Original Style',
        description: 'Style to be cloned',
        line: {
          width: 3,
          color: DEFAULT_COLORS.SUCCESS,
          style: 'dashed',
          cap: 'square',
          join: 'miter',
        },
      });

      const clonedStyle = styleManager.cloneStyle(originalStyle.id, 'Cloned Style');

      expect(clonedStyle).toBeTruthy();
      expect(clonedStyle!.name).toBe('Cloned Style');
      expect(clonedStyle!.id).not.toBe(originalStyle.id);
      expect(clonedStyle!.line.width).toBe(originalStyle.line.width);
      expect(clonedStyle!.line.color).toEqual(originalStyle.line.color);
      expect(clonedStyle!.isPreset).toBe(false);
      expect(clonedStyle!.isReadonly).toBe(false);
    });

    it('should search styles by name', () => {
      styleManager.createStyle({ name: 'Measurement Style' });
      styleManager.createStyle({ name: 'Drawing Style' });
      styleManager.createStyle({ name: 'Text Style' });

      const searchResults = styleManager.searchStyles('measurement');
      expect(searchResults.length).toBeGreaterThan(0);

      const measurementStyle = searchResults.find(s => s.name === 'Measurement Style');
      expect(measurementStyle).toBeTruthy();
    });

    it('should search styles by tags', () => {
      styleManager.createStyle({
        name: 'Tagged Style',
        tags: ['clinical', 'precision', 'medical'],
      });

      const searchResults = styleManager.searchStyles('clinical');
      expect(searchResults.length).toBeGreaterThan(0);

      const taggedStyle = searchResults.find(s => s.name === 'Tagged Style');
      expect(taggedStyle).toBeTruthy();
    });

    it('should get style statistics', () => {
      styleManager.createStyle({ name: 'Stats Test 1' });
      styleManager.createStyle({ name: 'Stats Test 2' });

      const stats = styleManager.getStyleStatistics();
      expect(stats.totalCustomStyles).toBeGreaterThanOrEqual(2);
      expect(stats.totalPresets).toBeGreaterThan(0);
      expect(stats.totalThemes).toBeGreaterThanOrEqual(1);
      expect(typeof stats.categoryCounts).toBe('object');
    });
  });

  describe('Event System', () => {
    it('should emit events on style creation', (done: () => void) => {
      styleManager.on('styleCreated', (style: AnnotationStyling) => {
        expect(style.name).toBe('Event Test Style');
        done();
      });

      styleManager.createStyle({ name: 'Event Test Style' });
    });

    it('should emit events on style update', (done: () => void) => {
      const style = styleManager.createStyle({ name: 'Update Event Style' });

      styleManager.on('styleUpdated', (updatedStyle: AnnotationStyling) => {
        expect(updatedStyle.name).toBe('Updated Name');
        done();
      });

      styleManager.updateStyle(style.id, { name: 'Updated Name' });
    });

    it('should emit events on style deletion', (done: () => void) => {
      const style = styleManager.createStyle({ name: 'Delete Event Style' });

      styleManager.on('styleDeleted', (data: { id: string; style: AnnotationStyling }) => {
        expect(data.id).toBe(style.id);
        expect(data.style.name).toBe('Delete Event Style');
        done();
      });

      styleManager.deleteStyle(style.id);
    });

    it('should remove event listeners', () => {
      const callback = vi.fn();

      styleManager.on('styleCreated', callback);
      styleManager.off('styleCreated', callback);

      styleManager.createStyle({ name: 'No Event Style' });

      expect(callback).not.toHaveBeenCalled();
    });
  });
});
