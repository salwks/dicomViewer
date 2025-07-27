/**
 * Theme context
 */

import { createContext } from 'react';
import { UITheme, ThemeMode } from './types';

export interface ThemeContextValue {
  theme: UITheme;
  themeMode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
