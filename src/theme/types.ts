/**
 * UI Theme System Types
 * Defines the theme structure for the medical imaging viewer
 */

/**
 * Theme mode
 */
export type ThemeMode = 'light' | 'dark';

/**
 * Color values for the theme
 */
export interface ColorPalette {
  // Primary colors
  primary: {
    main: string;
    light: string;
    dark: string;
    contrastText: string;
  };
  // Secondary colors
  secondary: {
    main: string;
    light: string;
    dark: string;
    contrastText: string;
  };
  // Neutral colors
  background: {
    default: string;
    paper: string;
    elevated: string;
  };
  // Text colors
  text: {
    primary: string;
    secondary: string;
    disabled: string;
  };
  // Status colors
  error: {
    main: string;
    light: string;
    dark: string;
    contrastText: string;
  };
  warning: {
    main: string;
    light: string;
    dark: string;
    contrastText: string;
  };
  info: {
    main: string;
    light: string;
    dark: string;
    contrastText: string;
  };
  success: {
    main: string;
    light: string;
    dark: string;
    contrastText: string;
  };
  // Medical imaging specific
  medical: {
    bone: string;
    softTissue: string;
    lung: string;
    contrast: string;
    annotation: string;
    measurement: string;
    roi: string;
  };
  // UI element colors
  divider: string;
  action: {
    active: string;
    hover: string;
    selected: string;
    disabled: string;
    disabledBackground: string;
  };
}

/**
 * Typography configuration
 */
export interface Typography {
  fontFamily: string;
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
  };
  fontWeight: {
    light: number;
    regular: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  lineHeight: {
    tight: number;
    base: number;
    relaxed: number;
  };
}

/**
 * Spacing scale for consistent spacing
 */
export interface SpacingScale {
  0: string;
  1: string;
  2: string;
  3: string;
  4: string;
  5: string;
  6: string;
  8: string;
  10: string;
  12: string;
  16: string;
  20: string;
  24: string;
  32: string;
}

/**
 * Border radius values
 */
export interface BorderRadius {
  none: string;
  sm: string;
  base: string;
  md: string;
  lg: string;
  xl: string;
  full: string;
}

/**
 * Shadow values for elevation
 */
export interface Shadows {
  none: string;
  sm: string;
  base: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  inner: string;
}

/**
 * Z-index values for layering
 */
export interface ZIndex {
  base: number;
  dropdown: number;
  sticky: number;
  fixed: number;
  modalBackdrop: number;
  modal: number;
  popover: number;
  tooltip: number;
  notification: number;
}

/**
 * Transition configuration
 */
export interface Transitions {
  duration: {
    fast: string;
    base: string;
    slow: string;
  };
  easing: {
    easeInOut: string;
    easeOut: string;
    easeIn: string;
    sharp: string;
  };
}

/**
 * Complete UI theme configuration
 */
export interface UITheme {
  mode: ThemeMode;
  colors: ColorPalette;
  typography: Typography;
  spacing: SpacingScale;
  borderRadius: BorderRadius;
  shadows: Shadows;
  zIndex: ZIndex;
  transitions: Transitions;
}

/**
 * Theme context value
 */
export interface ThemeContextValue {
  theme: UITheme;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}
