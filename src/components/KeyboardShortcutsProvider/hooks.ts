/**
 * Keyboard shortcuts hooks
 */

import { useContext } from 'react';
import { KeyboardShortcutsContext, type KeyboardShortcutsContextType } from './context';

export const useKeyboardShortcutsContext = (): KeyboardShortcutsContextType => {
  const context = useContext(KeyboardShortcutsContext);

  if (!context) {
    throw new Error('useKeyboardShortcutsContext must be used within a KeyboardShortcutsProvider');
  }

  return context;
};
