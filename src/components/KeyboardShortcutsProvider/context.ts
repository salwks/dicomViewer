/**
 * Keyboard shortcuts context
 */

import { createContext } from 'react';

export interface KeyboardShortcutsContextType {
  shortcuts: any[];
  addShortcut: (shortcut: any) => void;
  removeShortcut: (key: string, modifiers?: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean }) => void;
  getShortcutsByCategory: (category: string) => any[];
  isShortcutActive: (key: string, modifiers?: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean }) => boolean;
  toggleShortcutsEnabled: () => void;
  shortcutsEnabled: boolean;
  showShortcutsHelp: boolean;
  setShowShortcutsHelp: (show: boolean) => void;
}

export const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | undefined>(undefined);
