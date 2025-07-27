/**
 * KeyboardShortcutsProvider Component
 * Global keyboard shortcuts context provider for the medical imaging viewer
 */

import React, { useState, useCallback, ReactNode } from 'react';
import { useKeyboardShortcuts, KeyboardShortcut } from '../../hooks/useKeyboardShortcuts';
import { ToolType } from '../ToolPanel/constants';

import { KeyboardShortcutsContext, type KeyboardShortcutsContextType } from './context';

interface KeyboardShortcutsProviderProps {
  children: ReactNode;
  onToolSelect?: (tool: ToolType) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onPanReset?: () => void;
  onRotateLeft?: () => void;
  onRotateRight?: () => void;
  onResetView?: () => void;
  onNextImage?: () => void;
  onPreviousImage?: () => void;
  onToggleFullscreen?: () => void;
  onSaveAnnotations?: () => void;
  onLoadAnnotations?: () => void;
  onDeleteSelected?: () => void;
  onSelectAll?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

// Default keyboard shortcuts for medical imaging
const createDefaultShortcuts = (callbacks: Partial<KeyboardShortcutsProviderProps>): KeyboardShortcut[] => [
  // Tool Selection
  {
    key: 'z',
    action: () => callbacks.onToolSelect?.(ToolType.ZOOM),
    description: 'Activate zoom tool',
    category: 'Tools',
  },
  {
    key: 'p',
    action: () => callbacks.onToolSelect?.(ToolType.PAN),
    description: 'Activate pan tool',
    category: 'Tools',
  },
  {
    key: 's',
    action: () => callbacks.onToolSelect?.(ToolType.STACK_SCROLL),
    description: 'Activate stack scroll tool',
    category: 'Tools',
  },
  {
    key: 'w',
    action: () => callbacks.onToolSelect?.(ToolType.WINDOW_LEVEL),
    description: 'Activate window/level tool',
    category: 'Tools',
  },
  {
    key: 'l',
    action: () => callbacks.onToolSelect?.(ToolType.LENGTH),
    description: 'Activate length measurement tool',
    category: 'Tools',
  },
  {
    key: 'a',
    action: () => callbacks.onToolSelect?.(ToolType.ANGLE),
    description: 'Activate angle measurement tool',
    category: 'Tools',
  },
  {
    key: 'r',
    action: () => callbacks.onToolSelect?.(ToolType.RECTANGLE_ROI),
    description: 'Activate rectangle ROI tool',
    category: 'Tools',
  },
  {
    key: 'e',
    action: () => callbacks.onToolSelect?.(ToolType.ELLIPSE_ROI),
    description: 'Activate ellipse ROI tool',
    category: 'Tools',
  },
  {
    key: 't',
    action: () => callbacks.onToolSelect?.(ToolType.TEXT),
    description: 'Activate text annotation tool',
    category: 'Tools',
  },
  {
    key: 'b',
    action: () => callbacks.onToolSelect?.(ToolType.BRUSH),
    description: 'Activate brush tool',
    category: 'Tools',
  },

  // Navigation
  {
    key: 'ArrowUp',
    action: () => callbacks.onPreviousImage?.(),
    description: 'Previous image in stack',
    category: 'Navigation',
  },
  {
    key: 'ArrowDown',
    action: () => callbacks.onNextImage?.(),
    description: 'Next image in stack',
    category: 'Navigation',
  },
  {
    key: 'PageUp',
    action: () => callbacks.onPreviousImage?.(),
    description: 'Previous image in stack',
    category: 'Navigation',
  },
  {
    key: 'PageDown',
    action: () => callbacks.onNextImage?.(),
    description: 'Next image in stack',
    category: 'Navigation',
  },

  // Zoom Controls
  {
    key: '=',
    action: () => callbacks.onZoomIn?.(),
    description: 'Zoom in',
    category: 'View',
  },
  {
    key: '+',
    action: () => callbacks.onZoomIn?.(),
    description: 'Zoom in',
    category: 'View',
  },
  {
    key: '-',
    action: () => callbacks.onZoomOut?.(),
    description: 'Zoom out',
    category: 'View',
  },
  {
    key: '0',
    action: () => callbacks.onZoomReset?.(),
    description: 'Reset zoom',
    category: 'View',
  },

  // Rotation
  {
    key: 'ArrowLeft',
    shiftKey: true,
    action: () => callbacks.onRotateLeft?.(),
    description: 'Rotate left',
    category: 'View',
  },
  {
    key: 'ArrowRight',
    shiftKey: true,
    action: () => callbacks.onRotateRight?.(),
    description: 'Rotate right',
    category: 'View',
  },

  // Reset Views
  {
    key: 'Home',
    action: () => callbacks.onResetView?.(),
    description: 'Reset view to default',
    category: 'View',
  },
  {
    key: 'r',
    ctrlKey: true,
    action: () => callbacks.onResetView?.(),
    description: 'Reset view to default',
    category: 'View',
  },

  // File Operations
  {
    key: 's',
    ctrlKey: true,
    action: () => callbacks.onSaveAnnotations?.(),
    description: 'Save annotations',
    category: 'File',
  },
  {
    key: 'o',
    ctrlKey: true,
    action: () => callbacks.onLoadAnnotations?.(),
    description: 'Load annotations',
    category: 'File',
  },

  // Edit Operations
  {
    key: 'z',
    ctrlKey: true,
    action: () => callbacks.onUndo?.(),
    description: 'Undo last action',
    category: 'Edit',
  },
  {
    key: 'y',
    ctrlKey: true,
    action: () => callbacks.onRedo?.(),
    description: 'Redo last action',
    category: 'Edit',
  },
  {
    key: 'z',
    ctrlKey: true,
    shiftKey: true,
    action: () => callbacks.onRedo?.(),
    description: 'Redo last action',
    category: 'Edit',
  },
  {
    key: 'a',
    ctrlKey: true,
    action: () => callbacks.onSelectAll?.(),
    description: 'Select all annotations',
    category: 'Edit',
  },
  {
    key: 'Delete',
    action: () => callbacks.onDeleteSelected?.(),
    description: 'Delete selected annotations',
    category: 'Edit',
  },
  {
    key: 'Backspace',
    action: () => callbacks.onDeleteSelected?.(),
    description: 'Delete selected annotations',
    category: 'Edit',
  },

  // View Controls
  {
    key: 'F11',
    action: () => callbacks.onToggleFullscreen?.(),
    description: 'Toggle fullscreen',
    category: 'View',
  },
  {
    key: 'f',
    action: () => callbacks.onToggleFullscreen?.(),
    description: 'Toggle fullscreen',
    category: 'View',
  },

  // Help
  {
    key: '?',
    action: () => {}, // This will be handled by the provider
    description: 'Show keyboard shortcuts help',
    category: 'Help',
  },
  {
    key: 'F1',
    action: () => {}, // This will be handled by the provider
    description: 'Show keyboard shortcuts help',
    category: 'Help',
  },

  // Escape - General cancel/close
  {
    key: 'Escape',
    action: () => {}, // This will be handled by the provider
    description: 'Cancel current action or close dialogs',
    category: 'General',
  },
];

export const KeyboardShortcutsProvider: React.FC<KeyboardShortcutsProviderProps> = ({
  children,
  ...callbacks
}) => {
  const [shortcutsEnabled, setShortcutsEnabled] = useState(true);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [customShortcuts, setCustomShortcuts] = useState<KeyboardShortcut[]>([]);

  // Create shortcuts with help and escape handlers
  const allShortcuts = React.useMemo(() => {
    const defaultShortcuts = createDefaultShortcuts(callbacks);

    // Override help shortcuts
    const modifiedShortcuts = defaultShortcuts.map(shortcut => {
      if ((shortcut.key === '?' || shortcut.key === 'F1') && shortcut.category === 'Help') {
        return {
          ...shortcut,
          action: () => setShowShortcutsHelp(true),
        };
      }
      if (shortcut.key === 'Escape' && shortcut.category === 'General') {
        return {
          ...shortcut,
          action: () => setShowShortcutsHelp(false),
        };
      }
      return shortcut;
    });

    return [...modifiedShortcuts, ...customShortcuts];
  }, [callbacks, customShortcuts]);

  const keyboardManager = useKeyboardShortcuts(allShortcuts, {
    enabled: shortcutsEnabled,
  });

  const addShortcut = useCallback((shortcut: KeyboardShortcut) => {
    setCustomShortcuts(prev => [...prev, shortcut]);
  }, []);

  const removeShortcut = useCallback((
    key: string,
    modifiers?: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean },
  ) => {
    keyboardManager.removeShortcut(key, modifiers);
  }, [keyboardManager]);

  const toggleShortcutsEnabled = useCallback(() => {
    setShortcutsEnabled(prev => !prev);
  }, []);

  const contextValue: KeyboardShortcutsContextType = {
    shortcuts: keyboardManager.getShortcuts(),
    addShortcut,
    removeShortcut,
    getShortcutsByCategory: keyboardManager.getShortcutsByCategory,
    isShortcutActive: keyboardManager.isShortcutActive,
    toggleShortcutsEnabled,
    shortcutsEnabled,
    showShortcutsHelp,
    setShowShortcutsHelp,
  };

  return (
    <KeyboardShortcutsContext.Provider value={contextValue}>
      {children}
    </KeyboardShortcutsContext.Provider>
  );
};

// Hook moved to ./hooks.ts for React fast refresh compatibility
