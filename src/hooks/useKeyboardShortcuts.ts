/**
 * useKeyboardShortcuts Hook
 * Centralized keyboard shortcut management for the medical imaging viewer
 */

import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  action: () => void;
  description: string;
  category: string;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  disabled?: boolean;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  target?: EventTarget | null;
  capture?: boolean;
}

interface KeyboardShortcutManager {
  shortcuts: Map<string, KeyboardShortcut>;
  addShortcut: (shortcut: KeyboardShortcut) => void;
  removeShortcut: (key: string, modifiers?: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean }) => void;
  getShortcuts: () => KeyboardShortcut[];
  getShortcutsByCategory: (category: string) => KeyboardShortcut[];
  isShortcutActive: (key: string, modifiers?: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean }) => boolean;
}

// Create unique key for shortcut identification
const createShortcutKey = (
  key: string,
  ctrlKey = false,
  shiftKey = false,
  altKey = false,
  metaKey = false,
): string => {
  const modifiers = [
    ctrlKey && 'ctrl',
    shiftKey && 'shift',
    altKey && 'alt',
    metaKey && 'meta',
  ].filter(Boolean).join('+');

  return modifiers ? `${modifiers}+${key.toLowerCase()}` : key.toLowerCase();
};

export const useKeyboardShortcuts = (
  shortcuts: KeyboardShortcut[] = [],
  options: UseKeyboardShortcutsOptions = {},
): KeyboardShortcutManager => {
  const {
    enabled = true,
    target = typeof window !== 'undefined' ? window : null,
    capture = false,
  } = options;

  const shortcutsMapRef = useRef<Map<string, KeyboardShortcut>>(new Map());
  const activeShortcuts = useRef<Set<string>>(new Set());

  // Initialize shortcuts map
  useEffect(() => {
    shortcutsMapRef.current.clear();
    shortcuts.forEach(shortcut => {
      const key = createShortcutKey(
        shortcut.key,
        shortcut.ctrlKey,
        shortcut.shiftKey,
        shortcut.altKey,
        shortcut.metaKey,
      );
      shortcutsMapRef.current.set(key, shortcut);
    });
  }, [shortcuts]);

  // Handle key down events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    const key = createShortcutKey(
      event.key,
      event.ctrlKey,
      event.shiftKey,
      event.altKey,
      event.metaKey,
    );

    const shortcut = shortcutsMapRef.current.get(key);

    if (shortcut && !shortcut.disabled) {
      // Check if we're in an input field and should ignore shortcuts
      const isInputField = event.target instanceof HTMLElement && (
        event.target.tagName === 'INPUT' ||
        event.target.tagName === 'TEXTAREA' ||
        event.target.contentEditable === 'true'
      );

      // Skip shortcuts in input fields unless explicitly allowed
      if (isInputField && !shortcut.key.startsWith('Escape')) {
        return;
      }

      if (shortcut.preventDefault !== false) {
        event.preventDefault();
      }

      if (shortcut.stopPropagation !== false) {
        event.stopPropagation();
      }

      activeShortcuts.current.add(key);

      try {
        shortcut.action();
      } catch (error) {
        console.error('Error executing keyboard shortcut:', error);
      }
    }
  }, [enabled]);

  // Handle key up events
  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    const key = createShortcutKey(
      event.key,
      event.ctrlKey,
      event.shiftKey,
      event.altKey,
      event.metaKey,
    );

    activeShortcuts.current.delete(key);
  }, [enabled]);

  // Setup event listeners
  useEffect(() => {
    if (!target || !enabled) return;

    const keyDownHandler = handleKeyDown as EventListener;
    const keyUpHandler = handleKeyUp as EventListener;

    target.addEventListener('keydown', keyDownHandler, capture);
    target.addEventListener('keyup', keyUpHandler, capture);

    return () => {
      target.removeEventListener('keydown', keyDownHandler, capture);
      target.removeEventListener('keyup', keyUpHandler, capture);
    };
  }, [target, enabled, handleKeyDown, handleKeyUp, capture]);

  // Manager functions
  const addShortcut = useCallback((shortcut: KeyboardShortcut) => {
    const key = createShortcutKey(
      shortcut.key,
      shortcut.ctrlKey,
      shortcut.shiftKey,
      shortcut.altKey,
      shortcut.metaKey,
    );
    shortcutsMapRef.current.set(key, shortcut);
  }, []);

  const removeShortcut = useCallback((
    key: string,
    modifiers: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean } = {},
  ) => {
    const shortcutKey = createShortcutKey(
      key,
      modifiers.ctrlKey,
      modifiers.shiftKey,
      modifiers.altKey,
      modifiers.metaKey,
    );
    shortcutsMapRef.current.delete(shortcutKey);
  }, []);

  const getShortcuts = useCallback(() => {
    return Array.from(shortcutsMapRef.current.values());
  }, []);

  const getShortcutsByCategory = useCallback((category: string) => {
    return Array.from(shortcutsMapRef.current.values()).filter(
      shortcut => shortcut.category === category,
    );
  }, []);

  const isShortcutActive = useCallback((
    key: string,
    modifiers: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean } = {},
  ) => {
    const shortcutKey = createShortcutKey(
      key,
      modifiers.ctrlKey,
      modifiers.shiftKey,
      modifiers.altKey,
      modifiers.metaKey,
    );
    return activeShortcuts.current.has(shortcutKey);
  }, []);

  return {
    shortcuts: shortcutsMapRef.current,
    addShortcut,
    removeShortcut,
    getShortcuts,
    getShortcutsByCategory,
    isShortcutActive,
  };
};
