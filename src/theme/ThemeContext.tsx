/**
 * Theme Context Provider
 * Manages theme state and provides theme switching functionality
 */

import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { UITheme, ThemeMode } from './types';

import { lightTheme, darkTheme } from './themes';
import { ThemeContext, type ThemeContextValue } from './context';

// Local storage key for theme preference
const THEME_STORAGE_KEY = 'cornerstone-viewer-theme';

interface ThemeProviderProps {
  children: ReactNode;
  defaultMode?: ThemeMode;
}

/**
 * Theme provider component
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, defaultMode = 'light' }) => {
  // Initialize theme from localStorage or default
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }

    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return defaultMode;
  });

  // Get current theme object
  const theme: UITheme = mode === 'dark' ? darkTheme : lightTheme;

  // Toggle theme between light and dark
  const toggleTheme = useCallback(() => {
    setMode(prevMode => {
      const newMode = prevMode === 'light' ? 'dark' : 'light';
      localStorage.setItem(THEME_STORAGE_KEY, newMode);
      return newMode;
    });
  }, []);

  // Set specific theme
  const setTheme = useCallback((newMode: ThemeMode) => {
    setMode(newMode);
    localStorage.setItem(THEME_STORAGE_KEY, newMode);
  }, []);

  // Apply theme to document root
  useEffect(() => {
    const root = document.documentElement;

    // Remove existing theme class
    root.classList.remove('theme-light', 'theme-dark');

    // Add new theme class
    root.classList.add(`theme-${mode}`);

    // Add/remove dark class for Tailwind CSS
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Update CSS variables
    const colors = theme.colors;

    // Primary colors
    root.style.setProperty('--color-primary-main', colors.primary.main);
    root.style.setProperty('--color-primary-light', colors.primary.light);
    root.style.setProperty('--color-primary-dark', colors.primary.dark);
    root.style.setProperty('--color-primary-contrast', colors.primary.contrastText);

    // Background colors
    root.style.setProperty('--color-bg-default', colors.background.default);
    root.style.setProperty('--color-bg-paper', colors.background.paper);
    root.style.setProperty('--color-bg-elevated', colors.background.elevated);

    // Text colors
    root.style.setProperty('--color-text-primary', colors.text.primary);
    root.style.setProperty('--color-text-secondary', colors.text.secondary);
    root.style.setProperty('--color-text-disabled', colors.text.disabled);

    // Medical colors
    root.style.setProperty('--color-medical-bone', colors.medical.bone);
    root.style.setProperty('--color-medical-soft-tissue', colors.medical.softTissue);
    root.style.setProperty('--color-medical-lung', colors.medical.lung);
    root.style.setProperty('--color-medical-contrast', colors.medical.contrast);
    root.style.setProperty('--color-medical-annotation', colors.medical.annotation);
    root.style.setProperty('--color-medical-measurement', colors.medical.measurement);
    root.style.setProperty('--color-medical-roi', colors.medical.roi);

    // Other colors
    root.style.setProperty('--color-divider', colors.divider);

    // Typography
    root.style.setProperty('--font-family', theme.typography.fontFamily);

    // Shadows
    root.style.setProperty('--shadow-sm', theme.shadows.sm);
    root.style.setProperty('--shadow-base', theme.shadows.base);
    root.style.setProperty('--shadow-md', theme.shadows.md);
    root.style.setProperty('--shadow-lg', theme.shadows.lg);
    root.style.setProperty('--shadow-xl', theme.shadows.xl);

    // Border radius
    root.style.setProperty('--radius-sm', theme.borderRadius.sm);
    root.style.setProperty('--radius-base', theme.borderRadius.base);
    root.style.setProperty('--radius-md', theme.borderRadius.md);
    root.style.setProperty('--radius-lg', theme.borderRadius.lg);

    // Transitions
    root.style.setProperty('--duration-fast', theme.transitions.duration.fast);
    root.style.setProperty('--duration-base', theme.transitions.duration.base);
    root.style.setProperty('--duration-slow', theme.transitions.duration.slow);
    root.style.setProperty('--easing-base', theme.transitions.easing.easeInOut);
  }, [mode, theme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      // Only update if no preference is saved
      if (!localStorage.getItem(THEME_STORAGE_KEY)) {
        setMode(e.matches ? 'dark' : 'light');
      }
    };

    // Add listener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }

    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  const value: ThemeContextValue = {
    theme,
    themeMode: mode,
    toggleTheme,
    setTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// Hooks moved to ./hooks.ts for React fast refresh compatibility
