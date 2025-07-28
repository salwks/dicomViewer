/**
 * Theme Toggle Component
 * Button to switch between light and dark themes
 */

import React from 'react';
import { useTheme, useThemeMode } from '../../theme';
import './styles.css';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  showLabel = false,
  size = 'medium',
}) => {
  const { toggleTheme } = useTheme();
  const mode = useThemeMode();

  const handleToggle = () => {
    toggleTheme();
  };

  const sizeClasses = {
    small: 'theme-toggle--small',
    medium: 'theme-toggle--medium',
    large: 'theme-toggle--large',
  };

  const validSizes = ['small', 'medium', 'large'] as const;
  const safeSize = validSizes.includes(size) ? size : 'medium';

  return (
    <button
      className={`theme-toggle ${
        // eslint-disable-next-line security/detect-object-injection
        sizeClasses[safeSize]
      } ${className}`}
      onClick={handleToggle}
      aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} theme`}
      title={`Switch to ${mode === 'light' ? 'dark' : 'light'} theme`}
    >
      <span className="theme-toggle__icon-wrapper">
        {mode === 'light' ? (
          <svg
            className="theme-toggle__icon theme-toggle__icon--moon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg
            className="theme-toggle__icon theme-toggle__icon--sun"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        )}
      </span>
      {showLabel && (
        <span className="theme-toggle__label">
          {mode === 'light' ? 'Dark' : 'Light'} Mode
        </span>
      )}
    </button>
  );
};
