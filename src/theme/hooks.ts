/**
 * Theme hooks
 */

import { useContext } from 'react';
import { ThemeContext, type ThemeContextValue } from './context';

/**
 * Hook to use theme context
 */
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
};

/**
 * Hook to get just the theme object
 */
export const useThemeStyles = (): any => {
  const { theme } = useTheme();
  return theme;
};

/**
 * Hook to get theme mode
 */
export const useThemeMode = (): string => {
  const { theme } = useTheme();
  return theme.mode;
};

/**
 * Hook to toggle theme
 */
export const useThemeToggle = (): (() => void) => {
  const { toggleTheme } = useTheme();
  return toggleTheme;
};
