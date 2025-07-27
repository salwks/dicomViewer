/**
 * Theme Utility Functions
 * Helper functions for working with themes
 */

import { UITheme } from './types';

/**
 * Generate CSS class names based on theme
 */
export const themed = (theme: UITheme) => ({
  // Text styles
  textPrimary: {
    color: theme.colors.text.primary,
  },
  textSecondary: {
    color: theme.colors.text.secondary,
  },
  textDisabled: {
    color: theme.colors.text.disabled,
  },

  // Background styles
  bgDefault: {
    backgroundColor: theme.colors.background.default,
  },
  bgPaper: {
    backgroundColor: theme.colors.background.paper,
  },
  bgElevated: {
    backgroundColor: theme.colors.background.elevated,
  },

  // Primary button styles
  buttonPrimary: {
    backgroundColor: theme.colors.primary.main,
    color: theme.colors.primary.contrastText,
    '&:hover': {
      backgroundColor: theme.colors.primary.dark,
    },
    '&:disabled': {
      backgroundColor: theme.colors.action.disabledBackground,
      color: theme.colors.action.disabled,
    },
  },

  // Secondary button styles
  buttonSecondary: {
    backgroundColor: theme.colors.secondary.main,
    color: theme.colors.secondary.contrastText,
    '&:hover': {
      backgroundColor: theme.colors.secondary.dark,
    },
    '&:disabled': {
      backgroundColor: theme.colors.action.disabledBackground,
      color: theme.colors.action.disabled,
    },
  },

  // Outlined button styles
  buttonOutlined: {
    backgroundColor: 'transparent',
    color: theme.colors.primary.main,
    border: `1px solid ${theme.colors.primary.main}`,
    '&:hover': {
      backgroundColor: theme.colors.action.hover,
      borderColor: theme.colors.primary.dark,
    },
    '&:disabled': {
      borderColor: theme.colors.action.disabled,
      color: theme.colors.action.disabled,
    },
  },

  // Card styles
  card: {
    backgroundColor: theme.colors.background.paper,
    borderRadius: theme.borderRadius.md,
    boxShadow: theme.shadows.base,
  },

  // Input styles
  input: {
    backgroundColor: theme.colors.background.paper,
    color: theme.colors.text.primary,
    borderRadius: theme.borderRadius.base,
    border: `1px solid ${theme.colors.divider}`,
    '&:focus': {
      borderColor: theme.colors.primary.main,
      outline: 'none',
    },
    '&:disabled': {
      backgroundColor: theme.colors.action.disabledBackground,
      color: theme.colors.text.disabled,
    },
  },
});

/**
 * Apply opacity to a color
 */
export const withOpacity = (color: string, opacity: number): string => {
  // Handle hex colors
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  // Handle rgb/rgba colors
  if (color.startsWith('rgb')) {
    // Use a simpler approach to avoid complex regex
    const numbers = color.replace(/[^\d,]/g, '').split(',').map(n => parseInt(n, 10));
    if (numbers.length >= 3) {
      return `rgba(${numbers[0]}, ${numbers[1]}, ${numbers[2]}, ${opacity})`;
    }
  }

  return color;
};

/**
 * Get contrast text color for a given background
 */
export const getContrastText = (background: string): string => {
  // Simple luminance calculation
  const getLuminance = (color: string): number => {
    let r = 0, g = 0, b = 0;

    if (color.startsWith('#')) {
      r = parseInt(color.slice(1, 3), 16) / 255;
      g = parseInt(color.slice(3, 5), 16) / 255;
      b = parseInt(color.slice(5, 7), 16) / 255;
    } else if (color.startsWith('rgb')) {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        r = parseInt(match[1]) / 255;
        g = parseInt(match[2]) / 255;
        b = parseInt(match[3]) / 255;
      }
    }

    // Apply gamma correction
    const gammaCorrect = (value: number) => {
      return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    };

    r = gammaCorrect(r);
    g = gammaCorrect(g);
    b = gammaCorrect(b);

    // Calculate relative luminance
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const luminance = getLuminance(background);

  // WCAG AA standard: contrast ratio of at least 4.5:1
  return luminance > 0.179 ? '#000000' : '#ffffff';
};

/**
 * Create responsive spacing based on theme
 */
export const spacing = (theme: UITheme) => (multiplier: number): string => {
  const base = parseFloat(theme.spacing[4]); // 1rem = base
  return `${base * multiplier}rem`;
};

/**
 * Create media query helpers
 */
export const breakpoints = {
  sm: '@media (min-width: 640px)',
  md: '@media (min-width: 768px)',
  lg: '@media (min-width: 1024px)',
  xl: '@media (min-width: 1280px)',
  '2xl': '@media (min-width: 1536px)',
};

/**
 * Merge theme overrides
 */
export const mergeTheme = (baseTheme: UITheme, overrides: Partial<UITheme>): UITheme => {
  return {
    ...baseTheme,
    ...overrides,
    colors: {
      ...baseTheme.colors,
      ...(overrides.colors || {}),
    },
    typography: {
      ...baseTheme.typography,
      ...(overrides.typography || {}),
    },
    spacing: {
      ...baseTheme.spacing,
      ...(overrides.spacing || {}),
    },
    borderRadius: {
      ...baseTheme.borderRadius,
      ...(overrides.borderRadius || {}),
    },
    shadows: {
      ...baseTheme.shadows,
      ...(overrides.shadows || {}),
    },
    zIndex: {
      ...baseTheme.zIndex,
      ...(overrides.zIndex || {}),
    },
    transitions: {
      ...baseTheme.transitions,
      ...(overrides.transitions || {}),
    },
  };
};
