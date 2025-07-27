/**
 * Theme System Exports
 * Central export point for all theme-related functionality
 */

// Type exports
export type {
  ThemeMode,
  ColorPalette,
  Typography,
  SpacingScale,
  BorderRadius,
  Shadows,
  ZIndex,
  Transitions,
  UITheme,
  ThemeContextValue,
} from './types';

// Theme definitions
export { lightTheme, darkTheme } from './themes';

// Context and hooks
export { ThemeProvider } from './ThemeContext';
export {
  useTheme,
  useThemeStyles,
  useThemeMode,
  useThemeToggle,
} from './hooks';

// Utility functions
export {
  themed,
  withOpacity,
  getContrastText,
  spacing,
  breakpoints,
  mergeTheme,
} from './utils';
