/**
 * Annotation Styling Types
 *
 * Comprehensive styling system for medical imaging annotations
 * Supports customizable colors, fonts, visibility, and visual effects
 */

/**
 * Color representation in different formats
 */
export interface AnnotationColor {
  /** RGB values (0-255) */
  rgb: [number, number, number];
  /** Hex color string */
  hex: string;
  /** RGBA values (0-255 for RGB, 0-1 for alpha) */
  rgba?: [number, number, number, number];
  /** HSL values (0-360 for H, 0-100 for S,L) */
  hsl?: [number, number, number];
}

/**
 * Font styling configuration
 */
export interface AnnotationFont {
  /** Font family */
  family: string;
  /** Font size in pixels */
  size: number;
  /** Font weight */
  weight: 'normal' | 'bold' | 'lighter' | 'bolder' | number;
  /** Font style */
  style: 'normal' | 'italic' | 'oblique';
  /** Line height multiplier */
  lineHeight: number;
  /** Text decoration */
  decoration?: 'none' | 'underline' | 'overline' | 'line-through';
}

/**
 * Line styling configuration
 */
export interface AnnotationLineStyle {
  /** Line width in pixels */
  width: number;
  /** Line color */
  color: AnnotationColor;
  /** Line style */
  style: 'solid' | 'dashed' | 'dotted' | 'dash-dot';
  /** Dash pattern for dashed lines */
  dashPattern?: number[];
  /** Line cap style */
  cap: 'butt' | 'round' | 'square';
  /** Line join style */
  join: 'miter' | 'round' | 'bevel';
}

/**
 * Fill styling configuration
 */
export interface AnnotationFillStyle {
  /** Fill color */
  color: AnnotationColor;
  /** Fill opacity (0-1) */
  opacity: number;
  /** Fill pattern */
  pattern?: 'solid' | 'cross-hatch' | 'diagonal' | 'dots';
  /** Gradient configuration */
  gradient?: {
    type: 'linear' | 'radial';
    stops: Array<{ offset: number; color: AnnotationColor }>;
    direction?: number; // degrees for linear
  };
}

/**
 * Shadow/outline styling
 */
export interface AnnotationShadowStyle {
  /** Shadow color */
  color: AnnotationColor;
  /** Shadow blur radius */
  blur: number;
  /** Shadow offset X */
  offsetX: number;
  /** Shadow offset Y */
  offsetY: number;
  /** Shadow opacity (0-1) */
  opacity: number;
}

/**
 * Animation configuration
 */
export interface AnnotationAnimation {
  /** Animation type */
  type: 'none' | 'pulse' | 'glow' | 'blink' | 'scale';
  /** Animation duration in milliseconds */
  duration: number;
  /** Animation iteration count */
  iterations: number | 'infinite';
  /** Animation timing function */
  timing: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

/**
 * Comprehensive annotation styling configuration
 */
export interface AnnotationStyling {
  /** Unique style identifier */
  id: string;
  /** Style name */
  name: string;
  /** Style description */
  description?: string;
  
  /* Visual Properties */
  /** Line styling for borders, measurement lines, etc. */
  line: AnnotationLineStyle;
  /** Fill styling for shapes */
  fill?: AnnotationFillStyle;
  /** Text/font styling */
  font: AnnotationFont;
  /** Shadow/outline styling */
  shadow?: AnnotationShadowStyle;
  
  /* Interaction Properties */
  /** Style when annotation is selected */
  selected?: Partial<AnnotationStyling>;
  /** Style when annotation is hovered */
  hover?: Partial<AnnotationStyling>;
  /** Style when annotation is active/being edited */
  active?: Partial<AnnotationStyling>;
  /** Style when annotation is disabled */
  disabled?: Partial<AnnotationStyling>;
  
  /* Visibility Properties */
  /** Base opacity (0-1) */
  opacity: number;
  /** Visibility state */
  visible: boolean;
  /** Z-index for layering */
  zIndex: number;
  
  /* Animation Properties */
  /** Animation configuration */
  animation?: AnnotationAnimation;
  
  /* Advanced Properties */
  /** Measurement precision for numeric displays */
  measurementPrecision?: number;
  /** Unit display settings */
  unitDisplay?: {
    show: boolean;
    format: 'short' | 'long';
    position: 'inline' | 'subscript' | 'superscript';
  };
  /** Scale factor for size adjustments */
  scaleFactor: number;
  
  /* Metadata */
  /** Style category */
  category: AnnotationStyleCategory;
  /** Compatible annotation types */
  compatibleTypes: AnnotationType[];
  /** Whether this is a system preset */
  isPreset: boolean;
  /** Whether this style is read-only */
  isReadonly: boolean;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Style version */
  version: string;
  /** Custom tags */
  tags: string[];
}

/**
 * Style categories for organization
 */
export enum AnnotationStyleCategory {
  MEASUREMENT = 'measurement',
  DRAWING = 'drawing',
  TEXT = 'text',
  ROI = 'roi',
  CUSTOM = 'custom',
  PRESET = 'preset',
}

/**
 * Annotation types for compatibility
 */
export enum AnnotationType {
  LENGTH = 'length',
  ANGLE = 'angle',
  AREA = 'area',
  ELLIPSE = 'ellipse',
  RECTANGLE = 'rectangle',
  ARROW = 'arrow',
  TEXT = 'text',
  FREEHAND = 'freehand',
  PROBE = 'probe',
  RULER = 'ruler',
}

/**
 * Style preset definition
 */
export interface AnnotationStylePreset {
  /** Preset identifier */
  id: string;
  /** Preset name */
  name: string;
  /** Preset description */
  description: string;
  /** Associated styling */
  styling: AnnotationStyling;
  /** Preview thumbnail URL */
  thumbnail?: string;
  /** Preset category */
  category: AnnotationStyleCategory;
  /** Popularity score */
  popularity: number;
  /** Whether preset is user-created */
  isUserCreated: boolean;
}

/**
 * Style inheritance configuration
 */
export interface StyleInheritance {
  /** Parent style ID */
  parentId: string;
  /** Properties to inherit */
  inheritedProperties: Array<keyof AnnotationStyling>;
  /** Properties to override */
  overrides: Partial<AnnotationStyling>;
  /** Inheritance mode */
  mode: 'extend' | 'override' | 'merge';
}

/**
 * Style validation result
 */
export interface StyleValidation {
  /** Whether style is valid */
  isValid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Performance suggestions */
  suggestions: string[];
}

/**
 * Style export format
 */
export interface StyleExport {
  /** Export version */
  version: string;
  /** Export timestamp */
  exportedAt: Date;
  /** Exported styles */
  styles: AnnotationStyling[];
  /** Export metadata */
  metadata: {
    exportedBy: string;
    totalCount: number;
    categories: AnnotationStyleCategory[];
  };
}

/**
 * Style theme configuration
 */
export interface AnnotationTheme {
  /** Theme identifier */
  id: string;
  /** Theme name */
  name: string;
  /** Theme description */
  description: string;
  /** Base color palette */
  colors: {
    primary: AnnotationColor;
    secondary: AnnotationColor;
    accent: AnnotationColor;
    background: AnnotationColor;
    text: AnnotationColor;
    error: AnnotationColor;
    warning: AnnotationColor;
    success: AnnotationColor;
  };
  /** Theme-specific style overrides */
  styleOverrides: Record<AnnotationType, Partial<AnnotationStyling>>;
  /** Whether theme supports dark mode */
  supportsDarkMode: boolean;
  /** Theme version */
  version: string;
}

/**
 * Default color constants
 */
export const DEFAULT_COLORS = {
  PRIMARY: { rgb: [0, 123, 255] as [number, number, number], hex: '#007bff' },
  SECONDARY: { rgb: [108, 117, 125] as [number, number, number], hex: '#6c757d' },
  SUCCESS: { rgb: [40, 167, 69] as [number, number, number], hex: '#28a745' },
  WARNING: { rgb: [255, 193, 7] as [number, number, number], hex: '#ffc107' },
  DANGER: { rgb: [220, 53, 69] as [number, number, number], hex: '#dc3545' },
  WHITE: { rgb: [255, 255, 255] as [number, number, number], hex: '#ffffff' },
  BLACK: { rgb: [0, 0, 0] as [number, number, number], hex: '#000000' },
} as const;

/**
 * Default font constants
 */
export const DEFAULT_FONTS = {
  PRIMARY: {
    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    size: 14,
    weight: 'normal' as const,
    style: 'normal' as const,
    lineHeight: 1.4,
  },
  MONOSPACE: {
    family: '"SF Mono", Monaco, Inconsolata, "Roboto Mono", Consolas, "Courier New", monospace',
    size: 12,
    weight: 'normal' as const,
    style: 'normal' as const,
    lineHeight: 1.2,
  },
} as const;