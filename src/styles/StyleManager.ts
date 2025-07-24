/**
 * Annotation Style Manager
 *
 * Comprehensive manager for annotation styling, presets, and themes
 * Provides CRUD operations, validation, inheritance, and export functionality
 */

import {
  AnnotationStyling,
  AnnotationStylePreset,
  AnnotationStyleCategory,
  AnnotationType,
  AnnotationTheme,
  StyleInheritance,
  StyleValidation,
  StyleExport,
  AnnotationColor,
} from '../types/annotation-styling';
import {
  ALL_PRESETS,
  PRESETS_BY_CATEGORY,
  getPresetsByType,
  getPresetById,
  getPopularPresets,
} from './annotation-presets';

/**
 * Style Manager Class
 */
export class StyleManager {
  private static instance: StyleManager;
  private customStyles: Map<string, AnnotationStyling> = new Map();
  private userPresets: Map<string, AnnotationStylePreset> = new Map();
  private themes: Map<string, AnnotationTheme> = new Map();
  private inheritanceRules: Map<string, StyleInheritance> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();
  private activeTheme: AnnotationTheme | null = null;

  private constructor() {
    this.initializeDefaultTheme();
    console.log('🎨 Style Manager initialized with', ALL_PRESETS.length, 'presets');
  }

  static getInstance(): StyleManager {
    if (!StyleManager.instance) {
      StyleManager.instance = new StyleManager();
    }
    return StyleManager.instance;
  }

  /**
   * Initialize default theme
   */
  private initializeDefaultTheme(): void {
    const defaultTheme: AnnotationTheme = {
      id: 'default',
      name: 'Default Theme',
      description: 'Standard medical imaging theme',
      colors: {
        primary: { rgb: [0, 123, 255], hex: '#007bff' },
        secondary: { rgb: [108, 117, 125], hex: '#6c757d' },
        accent: { rgb: [255, 193, 7], hex: '#ffc107' },
        background: { rgb: [255, 255, 255], hex: '#ffffff' },
        text: { rgb: [33, 37, 41], hex: '#212529' },
        error: { rgb: [220, 53, 69], hex: '#dc3545' },
        warning: { rgb: [255, 193, 7], hex: '#ffc107' },
        success: { rgb: [40, 167, 69], hex: '#28a745' },
      },
      styleOverrides: {},
      supportsDarkMode: true,
      version: '1.0.0',
    };

    this.themes.set(defaultTheme.id, defaultTheme);
    this.activeTheme = defaultTheme;
  }

  /* =============================================================================
   * STYLE MANAGEMENT
   * ============================================================================= */

  /**
   * Create custom style
   */
  createStyle(config: Partial<AnnotationStyling>): AnnotationStyling {
    const id = config.id || `style-${Date.now()}`;
    const now = new Date();

    const style: AnnotationStyling = {
      id,
      name: config.name || 'Custom Style',
      description: config.description || '',
      line: config.line || {
        width: 2,
        color: { rgb: [0, 123, 255], hex: '#007bff' },
        style: 'solid',
        cap: 'round',
        join: 'round',
      },
      fill: config.fill,
      font: config.font || {
        family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        size: 14,
        weight: 'normal',
        style: 'normal',
        lineHeight: 1.4,
      },
      shadow: config.shadow,
      selected: config.selected,
      hover: config.hover,
      active: config.active,
      disabled: config.disabled,
      opacity: config.opacity ?? 1.0,
      visible: config.visible ?? true,
      zIndex: config.zIndex ?? 100,
      animation: config.animation,
      measurementPrecision: config.measurementPrecision,
      unitDisplay: config.unitDisplay,
      scaleFactor: config.scaleFactor ?? 1.0,
      category: config.category || AnnotationStyleCategory.CUSTOM,
      compatibleTypes: config.compatibleTypes || [],
      isPreset: false,
      isReadonly: false,
      createdAt: now,
      updatedAt: now,
      version: config.version || '1.0.0',
      tags: config.tags || [],
    };

    this.customStyles.set(id, style);
    this.emit('styleCreated', style);
    console.log(`🎨 Created custom style: ${style.name}`);
    return style;
  }

  /**
   * Get style by ID
   */
  getStyle(id: string): AnnotationStyling | null {
    // Check custom styles first
    const customStyle = this.customStyles.get(id);
    if (customStyle) return customStyle;

    // Check preset styles
    const preset = getPresetById(id);
    return preset?.styling || null;
  }

  /**
   * Get all custom styles
   */
  getAllCustomStyles(): AnnotationStyling[] {
    return Array.from(this.customStyles.values());
  }

  /**
   * Update custom style
   */
  updateStyle(id: string, updates: Partial<AnnotationStyling>): AnnotationStyling | null {
    const existing = this.customStyles.get(id);
    if (!existing) {
      console.warn(`Custom style not found: ${id}`);
      return null;
    }

    if (existing.isReadonly) {
      console.warn(`Cannot update readonly style: ${id}`);
      return null;
    }

    const updated: AnnotationStyling = {
      ...existing,
      ...updates,
      id: existing.id, // Preserve ID
      updatedAt: new Date(),
    };

    this.customStyles.set(id, updated);
    this.emit('styleUpdated', updated);
    console.log(`🎨 Updated custom style: ${updated.name}`);
    return updated;
  }

  /**
   * Delete custom style
   */
  deleteStyle(id: string): boolean {
    const style = this.customStyles.get(id);
    if (!style) {
      console.warn(`Custom style not found: ${id}`);
      return false;
    }

    if (style.isReadonly) {
      console.warn(`Cannot delete readonly style: ${id}`);
      return false;
    }

    this.customStyles.delete(id);
    this.inheritanceRules.delete(id);
    this.emit('styleDeleted', { id, style });
    console.log(`🗑️ Deleted custom style: ${style.name}`);
    return true;
  }

  /* =============================================================================
   * PRESET MANAGEMENT
   * ============================================================================= */

  /**
   * Get all presets
   */
  getAllPresets(): AnnotationStylePreset[] {
    return [...ALL_PRESETS, ...Array.from(this.userPresets.values())];
  }

  /**
   * Get presets by category
   */
  getPresetsByCategory(category: AnnotationStyleCategory): AnnotationStylePreset[] {
    const systemPresets = PRESETS_BY_CATEGORY[category] || [];
    const userPresets = Array.from(this.userPresets.values())
      .filter(preset => preset.styling.category === category);
    
    return [...systemPresets, ...userPresets]
      .sort((a, b) => b.popularity - a.popularity);
  }

  /**
   * Get presets by annotation type
   */
  getPresetsByType(type: AnnotationType): AnnotationStylePreset[] {
    const systemPresets = getPresetsByType(type);
    const userPresets = Array.from(this.userPresets.values())
      .filter(preset => preset.styling.compatibleTypes.includes(type))
      .sort((a, b) => b.popularity - a.popularity);
    
    return [...systemPresets, ...userPresets];
  }

  /**
   * Get popular presets
   */
  getPopularPresets(limit: number = 10): AnnotationStylePreset[] {
    return getPopularPresets(limit);
  }

  /**
   * Create user preset from style
   */
  createUserPreset(styleId: string, presetConfig: {
    name: string;
    description: string;
    category: AnnotationStyleCategory;
  }): AnnotationStylePreset | null {
    const style = this.getStyle(styleId);
    if (!style) {
      console.warn(`Style not found for preset creation: ${styleId}`);
      return null;
    }

    const presetId = `user-preset-${Date.now()}`;
    const preset: AnnotationStylePreset = {
      id: presetId,
      name: presetConfig.name,
      description: presetConfig.description,
      category: presetConfig.category,
      popularity: 0,
      isUserCreated: true,
      styling: {
        ...style,
        id: `${presetId}-style`,
        name: presetConfig.name,
        isPreset: true,
        isReadonly: false,
      },
    };

    this.userPresets.set(presetId, preset);
    this.emit('presetCreated', preset);
    console.log(`🎨 Created user preset: ${preset.name}`);
    return preset;
  }

  /* =============================================================================
   * STYLE INHERITANCE
   * ============================================================================= */

  /**
   * Create style inheritance rule
   */
  createInheritance(childId: string, parentId: string, config: Partial<StyleInheritance>): StyleInheritance {
    const inheritance: StyleInheritance = {
      parentId,
      inheritedProperties: config.inheritedProperties || ['line', 'font', 'opacity'],
      overrides: config.overrides || {},
      mode: config.mode || 'extend',
    };

    this.inheritanceRules.set(childId, inheritance);
    this.emit('inheritanceCreated', { childId, inheritance });
    console.log(`🔗 Created inheritance: ${childId} extends ${parentId}`);
    return inheritance;
  }

  /**
   * Apply inheritance to get resolved style
   */
  getResolvedStyle(styleId: string): AnnotationStyling | null {
    const baseStyle = this.getStyle(styleId);
    if (!baseStyle) return null;

    const inheritance = this.inheritanceRules.get(styleId);
    if (!inheritance) return baseStyle;

    const parentStyle = this.getStyle(inheritance.parentId);
    if (!parentStyle) return baseStyle;

    return this.mergeStyles(parentStyle, baseStyle, inheritance);
  }

  /**
   * Merge styles according to inheritance rules
   */
  private mergeStyles(
    parent: AnnotationStyling,
    child: AnnotationStyling,
    inheritance: StyleInheritance
  ): AnnotationStyling {
    const merged = { ...child };

    // Apply inherited properties
    inheritance.inheritedProperties.forEach(prop => {
      if (parent[prop] !== undefined) {
        switch (inheritance.mode) {
          case 'override':
            merged[prop] = parent[prop];
            break;
          case 'extend':
            if (typeof parent[prop] === 'object' && typeof child[prop] === 'object') {
              merged[prop] = { ...parent[prop], ...child[prop] };
            } else {
              merged[prop] = child[prop] !== undefined ? child[prop] : parent[prop];
            }
            break;
          case 'merge':
            if (typeof parent[prop] === 'object' && typeof child[prop] === 'object') {
              merged[prop] = { ...parent[prop], ...child[prop] };
            }
            break;
        }
      }
    });

    // Apply overrides
    Object.entries(inheritance.overrides).forEach(([key, value]) => {
      if (value !== undefined) {
        merged[key as keyof AnnotationStyling] = value;
      }
    });

    return merged;
  }

  /* =============================================================================
   * STYLE VALIDATION
   * ============================================================================= */

  /**
   * Validate style configuration
   */
  validateStyle(style: AnnotationStyling): StyleValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Required fields validation
    if (!style.id || style.id.trim() === '') {
      errors.push('Style ID is required');
    }

    if (!style.name || style.name.trim() === '') {
      errors.push('Style name is required');
    }

    // Line style validation
    if (style.line) {
      if (style.line.width <= 0) {
        errors.push('Line width must be positive');
      }
      if (style.line.width > 20) {
        warnings.push('Very thick lines may impact performance');
      }
    }

    // Font validation
    if (style.font) {
      if (style.font.size <= 0) {
        errors.push('Font size must be positive');
      }
      if (style.font.size > 100) {
        warnings.push('Very large fonts may impact readability');
      }
    }

    // Opacity validation
    if (style.opacity < 0 || style.opacity > 1) {
      errors.push('Opacity must be between 0 and 1');
    }

    // Color validation
    const validateColor = (color: AnnotationColor, context: string) => {
      if (color.rgb) {
        const [r, g, b] = color.rgb;
        if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
          errors.push(`Invalid RGB values in ${context}`);
        }
      }
      if (color.hex && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color.hex)) {
        errors.push(`Invalid hex color format in ${context}`);
      }
    };

    if (style.line?.color) {
      validateColor(style.line.color, 'line color');
    }
    if (style.fill?.color) {
      validateColor(style.fill.color, 'fill color');
    }

    // Performance suggestions
    if (style.animation) {
      suggestions.push('Animations may impact performance on low-end devices');
    }

    if (style.shadow) {
      suggestions.push('Shadows may impact rendering performance');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /* =============================================================================
   * THEME MANAGEMENT
   * ============================================================================= */

  /**
   * Create theme
   */
  createTheme(config: Partial<AnnotationTheme>): AnnotationTheme {
    const id = config.id || `theme-${Date.now()}`;
    
    const theme: AnnotationTheme = {
      id,
      name: config.name || 'Custom Theme',
      description: config.description || '',
      colors: config.colors || this.activeTheme!.colors,
      styleOverrides: config.styleOverrides || {},
      supportsDarkMode: config.supportsDarkMode ?? true,
      version: config.version || '1.0.0',
    };

    this.themes.set(id, theme);
    this.emit('themeCreated', theme);
    console.log(`🎨 Created theme: ${theme.name}`);
    return theme;
  }

  /**
   * Set active theme
   */
  setActiveTheme(themeId: string): boolean {
    const theme = this.themes.get(themeId);
    if (!theme) {
      console.warn(`Theme not found: ${themeId}`);
      return false;
    }

    this.activeTheme = theme;
    this.emit('themeChanged', theme);
    console.log(`🎨 Activated theme: ${theme.name}`);
    return true;
  }

  /**
   * Get active theme
   */
  getActiveTheme(): AnnotationTheme | null {
    return this.activeTheme;
  }

  /**
   * Get all themes
   */
  getAllThemes(): AnnotationTheme[] {
    return Array.from(this.themes.values());
  }

  /* =============================================================================
   * EXPORT/IMPORT
   * ============================================================================= */

  /**
   * Export styles and presets
   */
  exportStyles(ids?: string[]): StyleExport {
    const customStyles = ids
      ? ids.map(id => this.customStyles.get(id)).filter(Boolean) as AnnotationStyling[]
      : this.getAllCustomStyles();

    const userPresets = Array.from(this.userPresets.values());

    return {
      version: '1.0.0',
      exportedAt: new Date(),
      styles: customStyles,
      metadata: {
        exportedBy: 'Cornerstone3D Style Manager',
        totalCount: customStyles.length,
        categories: [...new Set(customStyles.map(s => s.category))],
      },
    };
  }

  /**
   * Import styles
   */
  importStyles(exportData: StyleExport): AnnotationStyling[] {
    const imported: AnnotationStyling[] = [];

    for (const style of exportData.styles) {
      try {
        const validation = this.validateStyle(style);
        if (!validation.isValid) {
          console.warn(`Skipping invalid style: ${style.name}`, validation.errors);
          continue;
        }

        // Ensure unique ID
        let uniqueId = style.id;
        if (this.customStyles.has(uniqueId)) {
          uniqueId = `${style.id}-imported-${Date.now()}`;
        }

        const importedStyle = this.createStyle({
          ...style,
          id: uniqueId,
          isPreset: false,
          isReadonly: false,
        });

        imported.push(importedStyle);
      } catch (error) {
        console.error(`Failed to import style: ${style.name}`, error);
      }
    }

    console.log(`📥 Imported ${imported.length} styles`);
    return imported;
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

  /* =============================================================================
   * UTILITY METHODS
   * ============================================================================= */

  /**
   * Clone style
   */
  cloneStyle(styleId: string, newName?: string): AnnotationStyling | null {
    const original = this.getStyle(styleId);
    if (!original) {
      console.warn(`Style not found: ${styleId}`);
      return null;
    }

    const cloned = this.createStyle({
      ...original,
      id: `${original.id}-clone-${Date.now()}`,
      name: newName || `${original.name} (Copy)`,
      isPreset: false,
      isReadonly: false,
    });

    console.log(`📋 Cloned style: ${original.name} → ${cloned.name}`);
    return cloned;
  }

  /**
   * Search styles by name or tags
   */
  searchStyles(query: string): AnnotationStyling[] {
    const lowerQuery = query.toLowerCase();
    const customStyles = this.getAllCustomStyles();
    const presetStyles = ALL_PRESETS.map(p => p.styling);
    
    return [...customStyles, ...presetStyles].filter(style =>
      style.name.toLowerCase().includes(lowerQuery) ||
      style.description?.toLowerCase().includes(lowerQuery) ||
      style.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get style statistics
   */
  getStyleStatistics() {
    return {
      totalCustomStyles: this.customStyles.size,
      totalPresets: ALL_PRESETS.length,
      totalUserPresets: this.userPresets.size,
      totalThemes: this.themes.size,
      categoryCounts: Object.fromEntries(
        Object.values(AnnotationStyleCategory).map(category => [
          category,
          this.getPresetsByCategory(category).length
        ])
      ),
    };
  }
}

// Export singleton instance
export const styleManager = StyleManager.getInstance();