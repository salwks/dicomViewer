/**
 * Theme Toggle Component
 * Button to switch between light and dark themes
 */

import React from 'react';
import { useTheme, useThemeMode } from '../../theme';
import { Button } from '../ui/button';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', showLabel = false }) => {
  const { toggleTheme } = useTheme();
  const mode = useThemeMode();

  const handleToggle = () => {
    toggleTheme();
  };

  return (
    <Button
      variant='outline'
      size='icon'
      className={className}
      onClick={handleToggle}
      aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} theme`}
      title={`Switch to ${mode === 'light' ? 'dark' : 'light'} theme`}
    >
      {mode === 'light' ? (
        <svg
          className='w-4 h-4'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
        >
          <path d='M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' />
        </svg>
      ) : (
        <svg
          className='w-4 h-4'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
        >
          <circle cx='12' cy='12' r='5' />
          <line x1='12' y1='1' x2='12' y2='3' />
          <line x1='12' y1='21' x2='12' y2='23' />
          <line x1='4.22' y1='4.22' x2='5.64' y2='5.64' />
          <line x1='18.36' y1='18.36' x2='19.78' y2='19.78' />
          <line x1='1' y1='12' x2='3' y2='12' />
          <line x1='21' y1='12' x2='23' y2='12' />
          <line x1='4.22' y1='19.78' x2='5.64' y2='18.36' />
          <line x1='18.36' y1='5.64' x2='19.78' y2='4.22' />
        </svg>
      )}
      {showLabel && <span className='ml-2'>{mode === 'light' ? 'Dark' : 'Light'} Mode</span>}
    </Button>
  );
};
