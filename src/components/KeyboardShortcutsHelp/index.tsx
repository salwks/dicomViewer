/**
 * KeyboardShortcutsHelp Component
 * Modal dialog displaying keyboard shortcuts help for the medical imaging viewer
 */

import React, { useEffect, useRef } from 'react';
import { useKeyboardShortcutsContext } from '../KeyboardShortcutsProvider/hooks';
import './styles.css';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const formatShortcutKey = (shortcut: any): string => {
  const parts: string[] = [];

  if (shortcut.ctrlKey) parts.push('Ctrl');
  if (shortcut.metaKey) parts.push('Cmd');
  if (shortcut.altKey) parts.push('Alt');
  if (shortcut.shiftKey) parts.push('Shift');

  // Format key name
  let keyName = shortcut.key;
  switch (keyName) {
    case ' ':
      keyName = 'Space';
      break;
    case 'ArrowUp':
      keyName = '↑';
      break;
    case 'ArrowDown':
      keyName = '↓';
      break;
    case 'ArrowLeft':
      keyName = '←';
      break;
    case 'ArrowRight':
      keyName = '→';
      break;
    case 'PageUp':
      keyName = 'Page Up';
      break;
    case 'PageDown':
      keyName = 'Page Down';
      break;
    case 'Escape':
      keyName = 'Esc';
      break;
    case 'Delete':
      keyName = 'Del';
      break;
    case 'Backspace':
      keyName = '⌫';
      break;
    case '=':
      keyName = '=';
      break;
    case '+':
      keyName = '+';
      break;
    case '-':
      keyName = '-';
      break;
    default:
      keyName = keyName.toUpperCase();
  }

  parts.push(keyName);
  return parts.join(' + ');
};

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  isOpen,
  onClose,
  className = '',
}) => {
  const { getShortcutsByCategory, shortcutsEnabled } = useKeyboardShortcutsContext();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Group shortcuts by category
  const categories = [
    'Tools',
    'Navigation',
    'View',
    'Edit',
    'File',
    'Help',
    'General',
  ];

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Focus management
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  // Handle backdrop click
  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`shortcuts-help ${className}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-help-title"
    >
      <div
        ref={dialogRef}
        className="shortcuts-help__dialog"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="shortcuts-help__header">
          <h2 id="shortcuts-help-title" className="shortcuts-help__title">
            Keyboard Shortcuts
          </h2>
          <button
            className="shortcuts-help__close"
            onClick={onClose}
            aria-label="Close keyboard shortcuts help"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Status */}
        <div className="shortcuts-help__status">
          <div className={`shortcuts-help__status-indicator ${
            shortcutsEnabled ? 'shortcuts-help__status-indicator--enabled' : 'shortcuts-help__status-indicator--disabled'
          }`}>
            <div className="shortcuts-help__status-dot" />
            <span className="shortcuts-help__status-text">
              Shortcuts {shortcutsEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <p className="shortcuts-help__status-description">
            {shortcutsEnabled
              ? 'Keyboard shortcuts are active and ready to use.'
              : 'Keyboard shortcuts are currently disabled.'
            }
          </p>
        </div>

        {/* Content */}
        <div className="shortcuts-help__content">
          {categories.map((category) => {
            const shortcuts = getShortcutsByCategory(category);
            if (shortcuts.length === 0) return null;

            return (
              <div key={category} className="shortcuts-help__category">
                <h3 className="shortcuts-help__category-title">{category}</h3>
                <div className="shortcuts-help__shortcuts">
                  {shortcuts.map((shortcut: any, index: number) => (
                    <div
                      key={`${category}-${index}`}
                      className={`shortcuts-help__shortcut ${
                        shortcut.disabled ? 'shortcuts-help__shortcut--disabled' : ''
                      }`}
                    >
                      <div className="shortcuts-help__shortcut-keys">
                        {formatShortcutKey(shortcut).split(' + ').map((key, keyIndex) => (
                          <React.Fragment key={keyIndex}>
                            {keyIndex > 0 && (
                              <span className="shortcuts-help__shortcut-separator">+</span>
                            )}
                            <kbd className="shortcuts-help__shortcut-key">{key}</kbd>
                          </React.Fragment>
                        ))}
                      </div>
                      <span className="shortcuts-help__shortcut-description">
                        {shortcut.description}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="shortcuts-help__footer">
          <div className="shortcuts-help__tips">
            <h4 className="shortcuts-help__tips-title">Tips</h4>
            <ul className="shortcuts-help__tips-list">
              <li>Shortcuts are disabled when typing in input fields</li>
              <li>Use <kbd>Esc</kbd> to cancel actions or close dialogs</li>
              <li>Hold <kbd>Ctrl</kbd> for multi-selection in lists</li>
              <li>Arrow keys navigate between viewports</li>
            </ul>
          </div>
          <div className="shortcuts-help__actions">
            <button
              className="shortcuts-help__action-button"
              onClick={onClose}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
