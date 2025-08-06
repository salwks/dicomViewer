/**
 * Keyboard Shortcut System
 * Centralized keyboard shortcut management for the DICOM viewer
 * Task 20: Implement Keyboard Shortcut System
 */

import { EventEmitter } from 'events';
import { log } from '../utils/logger';
import { safePropertyAccess } from '../lib/utils';

export interface KeyboardShortcut {
  id: string;
  name: string;
  description: string;
  keys: string[]; // e.g., ['ctrl', 'shift', 'z']
  category: string;
  action: () => void | Promise<void>;
  enabled: boolean;
  global: boolean; // Whether to work globally or only when focused
  preventDefault: boolean;
  stopPropagation: boolean;
}

export interface ShortcutCategory {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  shortcuts: KeyboardShortcut[];
}

export interface KeyboardShortcutConfig {
  enableGlobalShortcuts: boolean;
  enableHelpModal: boolean;
  preventDefaultBehavior: boolean;
  caseSensitive: boolean;
  debounceMs: number;
}

export const DEFAULT_KEYBOARD_SHORTCUT_CONFIG: KeyboardShortcutConfig = {
  enableGlobalShortcuts: true,
  enableHelpModal: true,
  preventDefaultBehavior: true,
  caseSensitive: false,
  debounceMs: 100,
};

export class KeyboardShortcutSystem extends EventEmitter {
  private config: KeyboardShortcutConfig;
  private categories = new Map<string, ShortcutCategory>();
  private shortcuts = new Map<string, KeyboardShortcut>();
  private pressedKeys = new Set<string>();
  private lastKeyEventTime = 0;
  private isEnabled = true;
  private focusedElement: string | null = null;

  constructor(config: Partial<KeyboardShortcutConfig> = {}) {
    super();
    this.config = { ...DEFAULT_KEYBOARD_SHORTCUT_CONFIG, ...config };

    this.initializeDefaultShortcuts();
    this.setupEventListeners();
  }

  /**
   * Register a keyboard shortcut
   */
  public registerShortcut(shortcut: Omit<KeyboardShortcut, 'id'>): string {
    const id = this.generateShortcutId(shortcut.name);
    const fullShortcut: KeyboardShortcut = {
      ...shortcut,
      id,
      keys: shortcut.keys.map(key => this.normalizeKey(key)),
    };

    this.shortcuts.set(id, fullShortcut);

    // Add to category
    let category = this.categories.get(shortcut.category);
    if (!category) {
      category = {
        id: shortcut.category,
        name: this.formatCategoryName(shortcut.category),
        description: `${shortcut.category} shortcuts`,
        enabled: true,
        shortcuts: [],
      };
      this.categories.set(shortcut.category, category);
    }

    category.shortcuts.push(fullShortcut);

    log.info('Keyboard shortcut registered', {
      component: 'KeyboardShortcutSystem',
      metadata: {
        id,
        name: shortcut.name,
        keys: shortcut.keys,
        category: shortcut.category,
        global: shortcut.global,
      },
    });

    this.emit('shortcut-registered', fullShortcut);
    return id;
  }

  /**
   * Unregister a keyboard shortcut
   */
  public unregisterShortcut(shortcutId: string): boolean {
    const shortcut = this.shortcuts.get(shortcutId);
    if (!shortcut) {
      return false;
    }

    // Remove from shortcuts map
    this.shortcuts.delete(shortcutId);

    // Remove from category
    const category = this.categories.get(shortcut.category);
    if (category) {
      const index = category.shortcuts.findIndex(s => s.id === shortcutId);
      if (index !== -1) {
        category.shortcuts.splice(index, 1);
      }

      // Remove category if empty
      if (category.shortcuts.length === 0) {
        this.categories.delete(shortcut.category);
      }
    }

    log.info('Keyboard shortcut unregistered', {
      component: 'KeyboardShortcutSystem',
      metadata: { id: shortcutId, name: shortcut.name },
    });

    this.emit('shortcut-unregistered', shortcut);
    return true;
  }

  /**
   * Enable/disable a specific shortcut
   */
  public setShortcutEnabled(shortcutId: string, enabled: boolean): boolean {
    const shortcut = this.shortcuts.get(shortcutId);
    if (!shortcut) {
      return false;
    }

    shortcut.enabled = enabled;
    this.emit('shortcut-toggled', shortcut, enabled);

    return true;
  }

  /**
   * Enable/disable an entire category
   */
  public setCategoryEnabled(categoryId: string, enabled: boolean): boolean {
    const category = this.categories.get(categoryId);
    if (!category) {
      return false;
    }

    category.enabled = enabled;
    category.shortcuts.forEach(shortcut => {
      shortcut.enabled = enabled;
    });

    this.emit('category-toggled', category, enabled);
    return true;
  }

  /**
   * Get all registered shortcuts
   */
  public getAllShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Get shortcuts by category
   */
  public getShortcutsByCategory(categoryId: string): KeyboardShortcut[] {
    const category = this.categories.get(categoryId);
    return category ? category.shortcuts : [];
  }

  /**
   * Get all categories
   */
  public getAllCategories(): ShortcutCategory[] {
    return Array.from(this.categories.values());
  }

  /**
   * Check if a key combination matches a shortcut
   */
  public matchesShortcut(keys: string[], shortcut: KeyboardShortcut): boolean {
    if (keys.length !== shortcut.keys.length) {
      return false;
    }

    const normalizedKeys = keys.map(key => this.normalizeKey(key)).sort();
    const shortcutKeys = [...shortcut.keys].sort();

    return normalizedKeys.every((key, index) => key === safePropertyAccess(shortcutKeys, index));
  }

  /**
   * Execute a shortcut by ID
   */
  public async executeShortcut(shortcutId: string): Promise<boolean> {
    const shortcut = this.shortcuts.get(shortcutId);
    if (!shortcut || !shortcut.enabled) {
      return false;
    }

    const category = this.categories.get(shortcut.category);
    if (!category || !category.enabled) {
      return false;
    }

    try {
      await shortcut.action();

      this.emit('shortcut-executed', shortcut);

      log.info('Keyboard shortcut executed', {
        component: 'KeyboardShortcutSystem',
        metadata: { id: shortcutId, name: shortcut.name },
      });

      return true;
    } catch (error) {
      log.error('Keyboard shortcut execution failed', {
        component: 'KeyboardShortcutSystem',
        metadata: { id: shortcutId, name: shortcut.name, error: (error as Error).message },
      });

      this.emit('shortcut-error', shortcut, error as Error);
      return false;
    }
  }

  /**
   * Show help modal with all shortcuts
   */
  public showHelp(): void {
    if (!this.config.enableHelpModal) {
      return;
    }

    const helpData = {
      categories: this.getAllCategories(),
      totalShortcuts: this.shortcuts.size,
    };

    this.emit('help-requested', helpData);
  }

  /**
   * Enable/disable the entire system
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.emit('system-toggled', enabled);

    log.info('Keyboard shortcut system toggled', {
      component: 'KeyboardShortcutSystem',
      metadata: { enabled },
    });
  }

  /**
   * Set focus context (for context-sensitive shortcuts)
   */
  public setFocusContext(context: string | null): void {
    this.focusedElement = context;
    this.emit('focus-changed', context);
  }

  /**
   * Get system statistics
   */
  public getStatistics(): {
    totalShortcuts: number;
    enabledShortcuts: number;
    globalShortcuts: number;
    contextShortcuts: number;
    categories: number;
    isEnabled: boolean;
    focusedElement: string | null;
    } {
    const enabledShortcuts = Array.from(this.shortcuts.values()).filter(s => s.enabled);
    const globalShortcuts = enabledShortcuts.filter(s => s.global);
    const contextShortcuts = enabledShortcuts.filter(s => !s.global);

    return {
      totalShortcuts: this.shortcuts.size,
      enabledShortcuts: enabledShortcuts.length,
      globalShortcuts: globalShortcuts.length,
      contextShortcuts: contextShortcuts.length,
      categories: this.categories.size,
      isEnabled: this.isEnabled,
      focusedElement: this.focusedElement,
    };
  }

  // ===== Private Methods =====

  private setupEventListeners(): void {
    // Global keydown listener
    document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
    document.addEventListener('keyup', this.handleKeyUp.bind(this), true);

    // Window focus events
    window.addEventListener('blur', this.handleWindowBlur.bind(this));
    window.addEventListener('focus', this.handleWindowFocus.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.isEnabled) {
      return;
    }

    // Debounce rapid key events
    const now = Date.now();
    if (now - this.lastKeyEventTime < this.config.debounceMs) {
      return;
    }
    this.lastKeyEventTime = now;

    // Skip if typing in input fields (unless global shortcut)
    if (this.isTypingInInput(event.target as Element)) {
      const globalOnly = true;
      if (!this.checkShortcuts(event, globalOnly)) {
        return;
      }
    } else {
      this.checkShortcuts(event, false);
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    this.pressedKeys.delete(this.normalizeKey(event.key));
  }

  private handleWindowBlur(): void {
    // Clear pressed keys when window loses focus
    this.pressedKeys.clear();
  }

  private handleWindowFocus(): void {
    // Clear pressed keys when window gains focus
    this.pressedKeys.clear();
  }

  private checkShortcuts(event: KeyboardEvent, globalOnly: boolean = false): boolean {
    const currentKeys = this.getCurrentKeys(event);

    // Find matching shortcuts
    const matchingShortcuts = Array.from(this.shortcuts.values()).filter(shortcut => {
      if (!shortcut.enabled) return false;

      const category = this.categories.get(shortcut.category);
      if (!category || !category.enabled) return false;

      if (globalOnly && !shortcut.global) return false;

      return this.matchesShortcut(currentKeys, shortcut);
    });

    if (matchingShortcuts.length === 0) {
      return false;
    }

    // Execute the first matching shortcut (highest priority)
    const shortcut = matchingShortcuts[0];

    if (shortcut.preventDefault && this.config.preventDefaultBehavior) {
      event.preventDefault();
    }

    if (shortcut.stopPropagation) {
      event.stopPropagation();
    }

    // Execute shortcut asynchronously
    this.executeShortcut(shortcut.id);

    return true;
  }

  private getCurrentKeys(event: KeyboardEvent): string[] {
    const keys: string[] = [];

    // Add modifier keys
    if (event.ctrlKey || event.metaKey) keys.push('ctrl');
    if (event.altKey) keys.push('alt');
    if (event.shiftKey) keys.push('shift');

    // Add the main key
    const mainKey = this.normalizeKey(event.key);
    if (!['ctrl', 'alt', 'shift', 'meta'].includes(mainKey)) {
      keys.push(mainKey);
    }

    return keys;
  }

  private normalizeKey(key: string): string {
    if (!this.config.caseSensitive) {
      key = key.toLowerCase();
    }

    // Handle special key mappings
    const keyMap: Record<string, string> = {
      control: 'ctrl',
      command: 'ctrl',
      cmd: 'ctrl',
      option: 'alt',
      return: 'enter',
      ' ': 'space',
      arrowup: 'up',
      arrowdown: 'down',
      arrowleft: 'left',
      arrowright: 'right',
    };

    // eslint-disable-next-line security/detect-object-injection -- Safe: key is a validated keyboard event key string
    return keyMap[key] || key;
  }

  private isTypingInInput(element: Element): boolean {
    if (!element) return false;

    const tagName = element.tagName.toLowerCase();
    const contentEditable = element.getAttribute('contenteditable');

    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      contentEditable === 'true' ||
      contentEditable === ''
    );
  }

  private initializeDefaultShortcuts(): void {
    // Navigation shortcuts
    this.registerShortcut({
      name: 'Next Image',
      description: 'Navigate to next image in series',
      keys: ['arrowright'],
      category: 'navigation',
      action: () => {
        this.emit('navigate-next-image');
      },
      enabled: true,
      global: false,
      preventDefault: true,
      stopPropagation: false,
    });

    this.registerShortcut({
      name: 'Previous Image',
      description: 'Navigate to previous image in series',
      keys: ['arrowleft'],
      category: 'navigation',
      action: () => {
        this.emit('navigate-previous-image');
      },
      enabled: true,
      global: false,
      preventDefault: true,
      stopPropagation: false,
    });

    this.registerShortcut({
      name: 'First Image',
      description: 'Navigate to first image in series',
      keys: ['home'],
      category: 'navigation',
      action: () => {
        this.emit('navigate-first-image');
      },
      enabled: true,
      global: false,
      preventDefault: true,
      stopPropagation: false,
    });

    this.registerShortcut({
      name: 'Last Image',
      description: 'Navigate to last image in series',
      keys: ['end'],
      category: 'navigation',
      action: () => {
        this.emit('navigate-last-image');
      },
      enabled: true,
      global: false,
      preventDefault: true,
      stopPropagation: false,
    });

    // Tool shortcuts
    this.registerShortcut({
      name: 'Select Pan Tool',
      description: 'Activate pan tool',
      keys: ['p'],
      category: 'tools',
      action: () => {
        this.emit('tool-selected', 'pan');
      },
      enabled: true,
      global: false,
      preventDefault: true,
      stopPropagation: false,
    });

    this.registerShortcut({
      name: 'Select Zoom Tool',
      description: 'Activate zoom tool',
      keys: ['z'],
      category: 'tools',
      action: () => {
        this.emit('tool-selected', 'zoom');
      },
      enabled: true,
      global: false,
      preventDefault: true,
      stopPropagation: false,
    });

    this.registerShortcut({
      name: 'Select Window/Level Tool',
      description: 'Activate window/level tool',
      keys: ['w'],
      category: 'tools',
      action: () => {
        this.emit('tool-selected', 'windowLevel');
      },
      enabled: true,
      global: false,
      preventDefault: true,
      stopPropagation: false,
    });

    this.registerShortcut({
      name: 'Select Length Tool',
      description: 'Activate length measurement tool',
      keys: ['l'],
      category: 'tools',
      action: () => {
        this.emit('tool-selected', 'length');
      },
      enabled: true,
      global: false,
      preventDefault: true,
      stopPropagation: false,
    });

    // Layout shortcuts
    this.registerShortcut({
      name: 'Single Layout',
      description: 'Switch to 1x1 layout',
      keys: ['1'],
      category: 'layout',
      action: () => {
        this.emit('layout-changed', '1x1');
      },
      enabled: true,
      global: false,
      preventDefault: true,
      stopPropagation: false,
    });

    this.registerShortcut({
      name: 'Side by Side Layout',
      description: 'Switch to 1x2 layout',
      keys: ['2'],
      category: 'layout',
      action: () => {
        this.emit('layout-changed', '1x2');
      },
      enabled: true,
      global: false,
      preventDefault: true,
      stopPropagation: false,
    });

    this.registerShortcut({
      name: 'Quad Layout',
      description: 'Switch to 2x2 layout',
      keys: ['4'],
      category: 'layout',
      action: () => {
        this.emit('layout-changed', '2x2');
      },
      enabled: true,
      global: false,
      preventDefault: true,
      stopPropagation: false,
    });

    // System shortcuts
    this.registerShortcut({
      name: 'Show Help',
      description: 'Show keyboard shortcuts help',
      keys: ['ctrl', 'shift', '/'],
      category: 'system',
      action: () => this.showHelp(),
      enabled: true,
      global: true,
      preventDefault: true,
      stopPropagation: true,
    });

    this.registerShortcut({
      name: 'Reset View',
      description: 'Reset viewport to default view',
      keys: ['r'],
      category: 'system',
      action: () => {
        this.emit('reset-view');
      },
      enabled: true,
      global: false,
      preventDefault: true,
      stopPropagation: false,
    });

    this.registerShortcut({
      name: 'Fit to Window',
      description: 'Fit image to window',
      keys: ['f'],
      category: 'system',
      action: () => {
        this.emit('fit-to-window');
      },
      enabled: true,
      global: false,
      preventDefault: true,
      stopPropagation: false,
    });

    // Save/Load shortcuts
    this.registerShortcut({
      name: 'Save',
      description: 'Save current state',
      keys: ['ctrl', 's'],
      category: 'file',
      action: () => {
        this.emit('save');
      },
      enabled: true,
      global: true,
      preventDefault: true,
      stopPropagation: true,
    });

    this.registerShortcut({
      name: 'Export',
      description: 'Export current view',
      keys: ['ctrl', 'e'],
      category: 'file',
      action: () => {
        this.emit('export');
      },
      enabled: true,
      global: true,
      preventDefault: true,
      stopPropagation: true,
    });
  }

  private generateShortcutId(name: string): string {
    const baseId = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    let id = baseId;
    let counter = 1;

    while (this.shortcuts.has(id)) {
      id = `${baseId}-${counter}`;
      counter++;
    }

    return id;
  }

  private formatCategoryName(categoryId: string): string {
    return categoryId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

// Singleton instance
export const keyboardShortcutSystem = new KeyboardShortcutSystem();
