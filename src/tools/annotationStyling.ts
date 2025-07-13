import { AnnotationData } from './annotationManager';
import { TextAnnotationData } from './textAnnotation';
import { ArrowAnnotationData } from './arrowAnnotation';

export interface AnnotationStyleConfig {
    // Global style settings
    global?: {
        color?: string;
        lineWidth?: number;
        opacity?: number;
        fontSize?: number;
        fontFamily?: string;
    };
    
    // Tool-specific style settings
    textAnnotation?: {
        color?: string;
        lineWidth?: number;
        font?: string;
        textBackgroundColor?: string;
        textColor?: string;
        fontSize?: number;
        fontFamily?: string;
        textAlign?: 'left' | 'center' | 'right';
        textBaseline?: 'top' | 'middle' | 'bottom';
        padding?: number;
        borderRadius?: number;
        opacity?: number;
        shadow?: {
            color?: string;
            blur?: number;
            offsetX?: number;
            offsetY?: number;
        };
    };
    
    arrowAnnotation?: {
        color?: string;
        lineWidth?: number;
        lineDash?: number[];
        font?: string;
        textBackgroundColor?: string;
        textColor?: string;
        arrowHeadColor?: string;
        arrowHeadSize?: number;
        arrowHeadStyle?: 'filled' | 'outline' | 'line';
        opacity?: number;
        shadow?: {
            color?: string;
            blur?: number;
            offsetX?: number;
            offsetY?: number;
        };
    };
    
    // State-specific styles
    default?: {
        color?: string;
        lineWidth?: number;
        opacity?: number;
    };
    
    hover?: {
        color?: string;
        lineWidth?: number;
        opacity?: number;
        glow?: {
            color?: string;
            blur?: number;
        };
    };
    
    selected?: {
        color?: string;
        lineWidth?: number;
        opacity?: number;
        outline?: {
            color?: string;
            width?: number;
            style?: 'solid' | 'dashed' | 'dotted';
        };
    };
    
    disabled?: {
        color?: string;
        lineWidth?: number;
        opacity?: number;
    };
}

export interface StyleTheme {
    name: string;
    description: string;
    config: AnnotationStyleConfig;
}

export class AnnotationStyling {
    private config: AnnotationStyleConfig;
    private themes: Map<string, StyleTheme> = new Map();
    private currentTheme: string | null = null;
    private customStyles: Map<string, Partial<AnnotationStyleConfig>> = new Map();
    private isInitialized: boolean = false;

    constructor(config: AnnotationStyleConfig = {}) {
        this.config = this.mergeWithDefaults(config);
        this.initialize();
    }

    private initialize(): void {
        try {
            this.setupDefaultThemes();
            this.isInitialized = true;
            
            console.log('✓ Annotation Styling initialized');
        } catch (error) {
            console.error('❌ Error initializing Annotation Styling:', error);
            throw error;
        }
    }

    private mergeWithDefaults(config: AnnotationStyleConfig): AnnotationStyleConfig {
        const defaultConfig: AnnotationStyleConfig = {
            global: {
                color: '#FFFF00',
                lineWidth: 2,
                opacity: 1.0,
                fontSize: 14,
                fontFamily: 'Arial'
            },
            textAnnotation: {
                color: '#FFFF00',
                lineWidth: 2,
                font: '14px Arial',
                textBackgroundColor: 'rgba(0, 0, 0, 0.8)',
                textColor: '#FFFFFF',
                fontSize: 14,
                fontFamily: 'Arial',
                textAlign: 'left',
                textBaseline: 'top',
                padding: 4,
                borderRadius: 2,
                opacity: 1.0,
                shadow: {
                    color: 'rgba(0, 0, 0, 0.5)',
                    blur: 2,
                    offsetX: 1,
                    offsetY: 1
                }
            },
            arrowAnnotation: {
                color: '#FF0000',
                lineWidth: 2,
                lineDash: [],
                font: '12px Arial',
                textBackgroundColor: 'rgba(0, 0, 0, 0.8)',
                textColor: '#FFFFFF',
                arrowHeadColor: '#FF0000',
                arrowHeadSize: 10,
                arrowHeadStyle: 'filled',
                opacity: 1.0,
                shadow: {
                    color: 'rgba(0, 0, 0, 0.3)',
                    blur: 2,
                    offsetX: 1,
                    offsetY: 1
                }
            },
            hover: {
                color: '#00FF00',
                lineWidth: 3,
                opacity: 1.0,
                glow: {
                    color: '#00FF00',
                    blur: 5
                }
            },
            selected: {
                color: '#0080FF',
                lineWidth: 3,
                opacity: 1.0,
                outline: {
                    color: '#0080FF',
                    width: 2,
                    style: 'dashed'
                }
            },
            disabled: {
                color: '#808080',
                lineWidth: 1,
                opacity: 0.5
            }
        };

        return this.deepMerge(defaultConfig, config);
    }

    private deepMerge(target: any, source: any): any {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }

    private setupDefaultThemes(): void {
        // Default theme
        this.addTheme('default', {
            name: 'Default',
            description: 'Default annotation styling',
            config: this.config
        });

        // Dark theme
        this.addTheme('dark', {
            name: 'Dark',
            description: 'Dark theme with high contrast',
            config: {
                global: {
                    color: '#FFFFFF',
                    lineWidth: 2,
                    opacity: 1.0,
                    fontSize: 14,
                    fontFamily: 'Arial'
                },
                textAnnotation: {
                    color: '#FFFFFF',
                    textBackgroundColor: 'rgba(0, 0, 0, 0.9)',
                    textColor: '#FFFFFF',
                    fontSize: 14,
                    fontFamily: 'Arial'
                },
                arrowAnnotation: {
                    color: '#FFFFFF',
                    textBackgroundColor: 'rgba(0, 0, 0, 0.9)',
                    textColor: '#FFFFFF',
                    arrowHeadColor: '#FFFFFF'
                },
                hover: {
                    color: '#00FFFF',
                    glow: {
                        color: '#00FFFF',
                        blur: 5
                    }
                },
                selected: {
                    color: '#FF6600',
                    outline: {
                        color: '#FF6600',
                        width: 2,
                        style: 'solid'
                    }
                }
            }
        });

        // Light theme
        this.addTheme('light', {
            name: 'Light',
            description: 'Light theme with subtle colors',
            config: {
                global: {
                    color: '#333333',
                    lineWidth: 1,
                    opacity: 0.8,
                    fontSize: 12,
                    fontFamily: 'Arial'
                },
                textAnnotation: {
                    color: '#333333',
                    textBackgroundColor: 'rgba(255, 255, 255, 0.9)',
                    textColor: '#333333',
                    fontSize: 12,
                    fontFamily: 'Arial'
                },
                arrowAnnotation: {
                    color: '#666666',
                    textBackgroundColor: 'rgba(255, 255, 255, 0.9)',
                    textColor: '#333333',
                    arrowHeadColor: '#666666'
                },
                hover: {
                    color: '#0066CC',
                    glow: {
                        color: '#0066CC',
                        blur: 3
                    }
                },
                selected: {
                    color: '#CC6600',
                    outline: {
                        color: '#CC6600',
                        width: 1,
                        style: 'solid'
                    }
                }
            }
        });

        // Medical theme
        this.addTheme('medical', {
            name: 'Medical',
            description: 'Medical imaging optimized theme',
            config: {
                global: {
                    color: '#00FF00',
                    lineWidth: 2,
                    opacity: 1.0,
                    fontSize: 12,
                    fontFamily: 'Courier New'
                },
                textAnnotation: {
                    color: '#00FF00',
                    textBackgroundColor: 'rgba(0, 0, 0, 0.7)',
                    textColor: '#00FF00',
                    fontSize: 12,
                    fontFamily: 'Courier New'
                },
                arrowAnnotation: {
                    color: '#FFFF00',
                    textBackgroundColor: 'rgba(0, 0, 0, 0.7)',
                    textColor: '#FFFF00',
                    arrowHeadColor: '#FFFF00'
                },
                hover: {
                    color: '#FF00FF',
                    glow: {
                        color: '#FF00FF',
                        blur: 4
                    }
                },
                selected: {
                    color: '#FF0000',
                    outline: {
                        color: '#FF0000',
                        width: 2,
                        style: 'dashed'
                    }
                }
            }
        });

        // Set default theme
        this.currentTheme = 'default';
    }

    public addTheme(id: string, theme: StyleTheme): void {
        this.themes.set(id, theme);
        console.log(`✓ Theme added: ${theme.name}`);
    }

    public removeTheme(id: string): boolean {
        if (this.themes.has(id)) {
            this.themes.delete(id);
            
            // Switch to default theme if current theme is removed
            if (this.currentTheme === id) {
                this.currentTheme = 'default';
            }
            
            console.log(`✓ Theme removed: ${id}`);
            return true;
        }
        return false;
    }

    public setTheme(id: string): boolean {
        if (this.themes.has(id)) {
            this.currentTheme = id;
            const theme = this.themes.get(id)!;
            this.config = this.mergeWithDefaults(theme.config);
            
            console.log(`✓ Theme set: ${theme.name}`);
            return true;
        }
        
        console.warn(`Theme not found: ${id}`);
        return false;
    }

    public getCurrentTheme(): StyleTheme | null {
        if (this.currentTheme && this.themes.has(this.currentTheme)) {
            return this.themes.get(this.currentTheme)!;
        }
        return null;
    }

    public getThemes(): StyleTheme[] {
        return Array.from(this.themes.values());
    }

    public getTheme(id: string): StyleTheme | null {
        return this.themes.get(id) || null;
    }

    public applyStyleToAnnotation(annotation: AnnotationData, state: 'default' | 'hover' | 'selected' | 'disabled' = 'default'): AnnotationData {
        try {
            const styledAnnotation = { ...annotation };
            
            // Apply base style based on annotation type
            if (annotation.toolName === 'TextAnnotation') {
                this.applyTextAnnotationStyle(styledAnnotation as TextAnnotationData, state);
            } else if (annotation.toolName === 'ArrowAnnotation') {
                this.applyArrowAnnotationStyle(styledAnnotation as ArrowAnnotationData, state);
            }
            
            // Apply global styles
            this.applyGlobalStyle(styledAnnotation, state);
            
            // Apply custom styles if any
            const customStyle = this.customStyles.get(annotation.annotationUID);
            if (customStyle) {
                this.applyCustomStyle(styledAnnotation, customStyle);
            }
            
            return styledAnnotation;
            
        } catch (error) {
            console.error('❌ Error applying style to annotation:', error);
            return annotation;
        }
    }

    private applyTextAnnotationStyle(annotation: TextAnnotationData, state: 'default' | 'hover' | 'selected' | 'disabled'): void {
        const baseStyle = this.config.textAnnotation || {};
        const stateStyle = state === 'default' ? (this.config.default || {}) : (this.config[state] || {});
        
        // Apply base text annotation styles
        if (annotation.style) {
            annotation.style.color = baseStyle.color || annotation.style.color;
            annotation.style.lineWidth = baseStyle.lineWidth || annotation.style.lineWidth;
            annotation.style.font = baseStyle.font || annotation.style.font;
            annotation.style.textBackgroundColor = baseStyle.textBackgroundColor || annotation.style.textBackgroundColor;
            annotation.style.textColor = baseStyle.textColor || annotation.style.textColor;
            annotation.style.fontSize = baseStyle.fontSize || annotation.style.fontSize;
            annotation.style.fontFamily = baseStyle.fontFamily || annotation.style.fontFamily;
            annotation.style.textAlign = baseStyle.textAlign || annotation.style.textAlign;
            annotation.style.textBaseline = baseStyle.textBaseline || annotation.style.textBaseline;
            annotation.style.padding = baseStyle.padding || annotation.style.padding;
            annotation.style.borderRadius = baseStyle.borderRadius || annotation.style.borderRadius;
            annotation.style.opacity = baseStyle.opacity || annotation.style.opacity;
            
            // Update font string if font properties changed
            if (baseStyle.fontSize || baseStyle.fontFamily) {
                annotation.style.font = `${annotation.style.fontSize}px ${annotation.style.fontFamily}`;
            }
        }
        
        // Apply state-specific styles
        if (state !== 'default') {
            if (annotation.style) {
                annotation.style.color = stateStyle.color || annotation.style.color;
                annotation.style.lineWidth = stateStyle.lineWidth || annotation.style.lineWidth;
                annotation.style.opacity = stateStyle.opacity || annotation.style.opacity;
            }
        }
    }

    private applyArrowAnnotationStyle(annotation: ArrowAnnotationData, state: 'default' | 'hover' | 'selected' | 'disabled'): void {
        const baseStyle = this.config.arrowAnnotation || {};
        const stateStyle = state === 'default' ? (this.config.default || {}) : (this.config[state] || {});
        
        // Apply base arrow annotation styles
        if (annotation.style) {
            annotation.style.color = baseStyle.color || annotation.style.color;
            annotation.style.lineWidth = baseStyle.lineWidth || annotation.style.lineWidth;
            annotation.style.lineDash = baseStyle.lineDash || annotation.style.lineDash;
            annotation.style.font = baseStyle.font || annotation.style.font;
            annotation.style.textBackgroundColor = baseStyle.textBackgroundColor || annotation.style.textBackgroundColor;
            annotation.style.textColor = baseStyle.textColor || annotation.style.textColor;
            annotation.style.arrowHeadColor = baseStyle.arrowHeadColor || annotation.style.arrowHeadColor;
            annotation.style.arrowHeadSize = baseStyle.arrowHeadSize || annotation.style.arrowHeadSize;
            annotation.style.opacity = baseStyle.opacity || annotation.style.opacity;
        }
        
        // Apply arrow head style
        if (annotation.arrowHead && baseStyle.arrowHeadStyle) {
            annotation.arrowHead.style = baseStyle.arrowHeadStyle;
        }
        
        // Apply state-specific styles
        if (state !== 'default') {
            if (annotation.style) {
                annotation.style.color = stateStyle.color || annotation.style.color;
                annotation.style.lineWidth = stateStyle.lineWidth || annotation.style.lineWidth;
                annotation.style.opacity = stateStyle.opacity || annotation.style.opacity;
            }
        }
    }

    private applyGlobalStyle(annotation: AnnotationData, state: 'default' | 'hover' | 'selected' | 'disabled'): void {
        const globalStyle = this.config.global || {};
        const stateStyle = state === 'default' ? (this.config.default || {}) : (this.config[state] || {});
        
        // Apply global styles if annotation doesn't have specific style
        if (annotation.style) {
            annotation.style.color = annotation.style.color || globalStyle.color;
            annotation.style.lineWidth = annotation.style.lineWidth || globalStyle.lineWidth;
            annotation.style.opacity = annotation.style.opacity || globalStyle.opacity;
        }
        
        // Apply state-specific global styles
        if (state !== 'default') {
            if (annotation.style) {
                annotation.style.color = stateStyle.color || annotation.style.color;
                annotation.style.lineWidth = stateStyle.lineWidth || annotation.style.lineWidth;
                annotation.style.opacity = stateStyle.opacity || annotation.style.opacity;
            }
        }
    }

    private applyCustomStyle(annotation: AnnotationData, customStyle: Partial<AnnotationStyleConfig>): void {
        try {
            // Apply custom styles specific to this annotation
            if (customStyle.global && annotation.style) {
                annotation.style.color = customStyle.global.color || annotation.style.color;
                annotation.style.lineWidth = customStyle.global.lineWidth || annotation.style.lineWidth;
                annotation.style.opacity = customStyle.global.opacity || annotation.style.opacity;
            }
            
            // Apply tool-specific custom styles
            if (annotation.toolName === 'TextAnnotation' && customStyle.textAnnotation) {
                this.applyCustomTextStyle(annotation as TextAnnotationData, customStyle.textAnnotation);
            } else if (annotation.toolName === 'ArrowAnnotation' && customStyle.arrowAnnotation) {
                this.applyCustomArrowStyle(annotation as ArrowAnnotationData, customStyle.arrowAnnotation);
            }
            
        } catch (error) {
            console.error('❌ Error applying custom style:', error);
        }
    }

    private applyCustomTextStyle(annotation: TextAnnotationData, customStyle: any): void {
        if (annotation.style) {
            annotation.style.color = customStyle.color || annotation.style.color;
            annotation.style.textColor = customStyle.textColor || annotation.style.textColor;
            annotation.style.textBackgroundColor = customStyle.textBackgroundColor || annotation.style.textBackgroundColor;
            annotation.style.fontSize = customStyle.fontSize || annotation.style.fontSize;
            annotation.style.fontFamily = customStyle.fontFamily || annotation.style.fontFamily;
            annotation.style.textAlign = customStyle.textAlign || annotation.style.textAlign;
            annotation.style.padding = customStyle.padding || annotation.style.padding;
            annotation.style.borderRadius = customStyle.borderRadius || annotation.style.borderRadius;
            
            // Update font string
            annotation.style.font = `${annotation.style.fontSize}px ${annotation.style.fontFamily}`;
        }
    }

    private applyCustomArrowStyle(annotation: ArrowAnnotationData, customStyle: any): void {
        if (annotation.style) {
            annotation.style.color = customStyle.color || annotation.style.color;
            annotation.style.arrowHeadColor = customStyle.arrowHeadColor || annotation.style.arrowHeadColor;
            annotation.style.arrowHeadSize = customStyle.arrowHeadSize || annotation.style.arrowHeadSize;
            annotation.style.lineDash = customStyle.lineDash || annotation.style.lineDash;
        }
        
        if (annotation.arrowHead && customStyle.arrowHeadStyle) {
            annotation.arrowHead.style = customStyle.arrowHeadStyle;
        }
    }

    public setCustomStyle(annotationId: string, customStyle: Partial<AnnotationStyleConfig>): void {
        this.customStyles.set(annotationId, customStyle);
        console.log(`✓ Custom style set for annotation: ${annotationId}`);
    }

    public removeCustomStyle(annotationId: string): boolean {
        if (this.customStyles.has(annotationId)) {
            this.customStyles.delete(annotationId);
            console.log(`✓ Custom style removed for annotation: ${annotationId}`);
            return true;
        }
        return false;
    }

    public getCustomStyle(annotationId: string): Partial<AnnotationStyleConfig> | null {
        return this.customStyles.get(annotationId) || null;
    }

    public clearCustomStyles(): void {
        this.customStyles.clear();
        console.log('✓ All custom styles cleared');
    }

    public updateGlobalStyle(updates: Partial<AnnotationStyleConfig>): void {
        this.config = this.deepMerge(this.config, updates);
        console.log('✓ Global style updated');
    }

    public updateTextAnnotationStyle(updates: Partial<AnnotationStyleConfig['textAnnotation']>): void {
        if (this.config.textAnnotation) {
            this.config.textAnnotation = { ...this.config.textAnnotation, ...updates };
        } else {
            this.config.textAnnotation = updates;
        }
        console.log('✓ Text annotation style updated');
    }

    public updateArrowAnnotationStyle(updates: Partial<AnnotationStyleConfig['arrowAnnotation']>): void {
        if (this.config.arrowAnnotation) {
            this.config.arrowAnnotation = { ...this.config.arrowAnnotation, ...updates };
        } else {
            this.config.arrowAnnotation = updates;
        }
        console.log('✓ Arrow annotation style updated');
    }

    public updateHoverStyle(updates: Partial<AnnotationStyleConfig['hover']>): void {
        if (this.config.hover) {
            this.config.hover = { ...this.config.hover, ...updates };
        } else {
            this.config.hover = updates;
        }
        console.log('✓ Hover style updated');
    }

    public updateSelectedStyle(updates: Partial<AnnotationStyleConfig['selected']>): void {
        if (this.config.selected) {
            this.config.selected = { ...this.config.selected, ...updates };
        } else {
            this.config.selected = updates;
        }
        console.log('✓ Selected style updated');
    }

    public exportTheme(): string {
        return JSON.stringify({
            currentTheme: this.currentTheme,
            config: this.config,
            customStyles: Array.from(this.customStyles.entries())
        }, null, 2);
    }

    public importTheme(data: string): boolean {
        try {
            const themeData = JSON.parse(data);
            
            if (themeData.config) {
                this.config = this.mergeWithDefaults(themeData.config);
            }
            
            if (themeData.currentTheme) {
                this.currentTheme = themeData.currentTheme;
            }
            
            if (themeData.customStyles && Array.isArray(themeData.customStyles)) {
                this.customStyles.clear();
                themeData.customStyles.forEach(([id, style]: [string, any]) => {
                    this.customStyles.set(id, style);
                });
            }
            
            console.log('✓ Theme imported successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Error importing theme:', error);
            return false;
        }
    }

    public getConfig(): AnnotationStyleConfig {
        return { ...this.config };
    }

    public updateConfig(newConfig: Partial<AnnotationStyleConfig>): void {
        this.config = this.deepMerge(this.config, newConfig);
        console.log('✓ Annotation styling configuration updated');
    }

    public getInitializationStatus(): boolean {
        return this.isInitialized;
    }

    public dispose(): void {
        try {
            this.themes.clear();
            this.customStyles.clear();
            this.currentTheme = null;
            this.isInitialized = false;
            
            console.log('✓ Annotation Styling disposed');
            
        } catch (error) {
            console.error('❌ Error disposing Annotation Styling:', error);
        }
    }
}

// Convenience functions
export function createAnnotationStyling(config?: AnnotationStyleConfig): AnnotationStyling {
    return new AnnotationStyling(config);
}

export function getDefaultStyleConfig(): AnnotationStyleConfig {
    return {
        global: {
            color: '#FFFF00',
            lineWidth: 2,
            opacity: 1.0,
            fontSize: 14,
            fontFamily: 'Arial'
        },
        textAnnotation: {
            color: '#FFFF00',
            lineWidth: 2,
            font: '14px Arial',
            textBackgroundColor: 'rgba(0, 0, 0, 0.8)',
            textColor: '#FFFFFF',
            fontSize: 14,
            fontFamily: 'Arial',
            textAlign: 'left',
            textBaseline: 'top',
            padding: 4,
            borderRadius: 2,
            opacity: 1.0
        },
        arrowAnnotation: {
            color: '#FF0000',
            lineWidth: 2,
            lineDash: [],
            font: '12px Arial',
            textBackgroundColor: 'rgba(0, 0, 0, 0.8)',
            textColor: '#FFFFFF',
            arrowHeadColor: '#FF0000',
            arrowHeadSize: 10,
            arrowHeadStyle: 'filled',
            opacity: 1.0
        },
        hover: {
            color: '#00FF00',
            lineWidth: 3,
            opacity: 1.0,
            glow: {
                color: '#00FF00',
                blur: 5
            }
        },
        selected: {
            color: '#0080FF',
            lineWidth: 3,
            opacity: 1.0,
            outline: {
                color: '#0080FF',
                width: 2,
                style: 'dashed'
            }
        },
        disabled: {
            color: '#808080',
            lineWidth: 1,
            opacity: 0.5
        }
    };
}

// Predefined color palettes
export const COLOR_PALETTES = {
    medical: ['#00FF00', '#FFFF00', '#FF0000', '#00FFFF', '#FF00FF', '#FFFFFF'],
    pastel: ['#FFB6C1', '#98FB98', '#87CEEB', '#DDA0DD', '#F0E68C', '#FFE4B5'],
    bright: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'],
    dark: ['#800000', '#008000', '#000080', '#808000', '#800080', '#008080'],
    gray: ['#808080', '#A0A0A0', '#C0C0C0', '#606060', '#909090', '#B0B0B0']
};

// Predefined font families
export const FONT_FAMILIES = [
    'Arial',
    'Arial Black',
    'Courier New',
    'Times New Roman',
    'Verdana',
    'Helvetica',
    'Georgia',
    'Trebuchet MS',
    'Comic Sans MS',
    'Impact'
];