/**
 * Annotation Visibility Manager Component
 *
 * Manages visibility states, selection highlighting, and interaction states
 * for all annotation types in the medical imaging viewer
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AnnotationStyling,
  AnnotationType,
  AnnotationStyleCategory,
} from '../../types/annotation-styling';
import { SelectionMode } from '../../types/annotation-selection';
import { styleManager } from '../../styles/StyleManager';

/**
 * Visibility state for an annotation
 */
export interface AnnotationVisibilityState {
  /** Annotation ID */
  id: string;
  /** Annotation type */
  type: AnnotationType;
  /** Base visibility state */
  visible: boolean;
  /** Selected state */
  selected: boolean;
  /** Hovered state */
  hovered: boolean;
  /** Active/editing state */
  active: boolean;
  /** Disabled state */
  disabled: boolean;
  /** Locked state (cannot be modified) */
  locked: boolean;
  /** Focus state (keyboard navigation) */
  focused: boolean;
  /** Opacity override (0-1) */
  opacityOverride?: number;
  /** Z-index override */
  zIndexOverride?: number;
}

/**
 * Visibility filter configuration
 */
export interface VisibilityFilter {
  /** Filter by annotation types */
  types?: AnnotationType[];
  /** Filter by categories */
  categories?: AnnotationStyleCategory[];
  /** Show only selected annotations */
  selectedOnly?: boolean;
  /** Show only visible annotations */
  visibleOnly?: boolean;
  /** Search query for filtering */
  searchQuery?: string;
  /** Custom filter function */
  customFilter?: (state: AnnotationVisibilityState) => boolean;
}

/**
 * Highlight animation configuration
 */
export interface HighlightAnimation {
  /** Animation type */
  type: 'pulse' | 'glow' | 'outline' | 'scale' | 'flash';
  /** Animation duration in milliseconds */
  duration: number;
  /** Animation delay in milliseconds */
  delay?: number;
  /** Number of iterations */
  iterations: number | 'infinite';
  /** Animation easing */
  easing: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

/**
 * Selection mode configuration (moved to separate file)
 * @see ../../types/annotation-selection.ts
 */

/**
 * Component props
 */
export interface AnnotationVisibilityManagerProps {
  /** Annotation visibility states */
  annotations: AnnotationVisibilityState[];
  /** Selection mode */
  selectionMode?: SelectionMode;
  /** Enable keyboard navigation */
  enableKeyboardNavigation?: boolean;
  /** Enable batch operations */
  enableBatchOperations?: boolean;
  /** Highlight animations */
  highlightAnimations?: boolean;
  /** Custom CSS class */
  className?: string;
  /** Visibility change callback */
  onVisibilityChange?: (id: string, visible: boolean) => void;
  /** Selection change callback */
  onSelectionChange?: (selectedIds: string[]) => void;
  /** Hover change callback */
  onHoverChange?: (id: string | null) => void;
  /** Focus change callback */
  onFocusChange?: (id: string | null) => void;
}

/**
 * Annotation Visibility Manager Component
 */
export const AnnotationVisibilityManager: React.FC<AnnotationVisibilityManagerProps> = ({
  annotations,
  selectionMode = SelectionMode.MULTIPLE,
  enableKeyboardNavigation = true,
  enableBatchOperations = true,
  highlightAnimations: _highlightAnimations = true,
  className = '',
  onVisibilityChange,
  onSelectionChange,
  onHoverChange,
  onFocusChange,
}) => {
  // State management
  const [visibilityStates, setVisibilityStates] = useState<Map<string, AnnotationVisibilityState>>(new Map());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<VisibilityFilter>({});
  const [groupBy, setGroupBy] = useState<'type' | 'category' | 'none'>('none');

  // Initialize visibility states
  useEffect(() => {
    const stateMap = new Map<string, AnnotationVisibilityState>();
    annotations.forEach(annotation => {
      stateMap.set(annotation.id, annotation);
    });
    setVisibilityStates(stateMap);
  }, [annotations]);

  /**
   * Get computed style for annotation
   */
  const getComputedStyle = useCallback((state: AnnotationVisibilityState): AnnotationStyling => {
    const baseStyle = styleManager.getResolvedStyle(`${state.type}-default`) ||
                    styleManager.getAllPresets().find(p => p.styling.compatibleTypes.includes(state.type))?.styling;

    if (!baseStyle) {
      console.warn(`No style found for annotation type: ${state.type}`);
      return {} as AnnotationStyling;
    }

    // Apply state-based style modifications
    let computedStyle = { ...baseStyle };

    // Apply opacity override
    if (state.opacityOverride !== undefined) {
      computedStyle.opacity = state.opacityOverride;
    }

    // Apply z-index override
    if (state.zIndexOverride !== undefined) {
      computedStyle.zIndex = state.zIndexOverride;
    }

    // Apply visibility
    computedStyle.visible = state.visible;

    // Apply selection styling
    if (state.selected && baseStyle.selected) {
      computedStyle = {
        ...computedStyle,
        ...baseStyle.selected,
        line: { ...computedStyle.line, ...baseStyle.selected.line },
        font: { ...computedStyle.font, ...baseStyle.selected.font },
      };
    }

    // Apply hover styling
    if (state.hovered && baseStyle.hover) {
      computedStyle = {
        ...computedStyle,
        ...baseStyle.hover,
        line: { ...computedStyle.line, ...baseStyle.hover.line },
        font: { ...computedStyle.font, ...baseStyle.hover.font },
      };
    }

    // Apply active styling
    if (state.active && baseStyle.active) {
      computedStyle = {
        ...computedStyle,
        ...baseStyle.active,
        line: { ...computedStyle.line, ...baseStyle.active.line },
        font: { ...computedStyle.font, ...baseStyle.active.font },
      };
    }

    // Apply disabled styling
    if (state.disabled && baseStyle.disabled) {
      computedStyle = {
        ...computedStyle,
        ...baseStyle.disabled,
        opacity: (computedStyle.opacity || 1) * 0.5,
      };
    }

    // Apply focus styling
    if (state.focused) {
      computedStyle.shadow = {
        color: { rgb: [0, 123, 255], hex: '#007bff' },
        blur: 4,
        offsetX: 0,
        offsetY: 0,
        opacity: 0.8,
      };
    }

    return computedStyle;
  }, []);

  /**
   * Filter annotations based on current filter settings
   */
  const filteredAnnotations = useMemo(() => {
    return Array.from(visibilityStates.values()).filter(state => {
      // Type filter
      if (filter.types && !filter.types.includes(state.type)) {
        return false;
      }

      // Category filter
      if (filter.categories) {
        const style = getComputedStyle(state);
        if (!filter.categories.includes(style.category)) {
          return false;
        }
      }

      // Selected only filter
      if (filter.selectedOnly && !state.selected) {
        return false;
      }

      // Visible only filter
      if (filter.visibleOnly && !state.visible) {
        return false;
      }

      // Search query filter
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        const matchesId = state.id.toLowerCase().includes(query);
        const matchesType = state.type.toLowerCase().includes(query);
        if (!matchesId && !matchesType) {
          return false;
        }
      }

      // Custom filter
      if (filter.customFilter && !filter.customFilter(state)) {
        return false;
      }

      return true;
    });
  }, [visibilityStates, filter, getComputedStyle]);

  /**
   * Group filtered annotations
   */
  const groupedAnnotations = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Annotations': filteredAnnotations };
    }

    const groups: Record<string, AnnotationVisibilityState[]> = {};

    filteredAnnotations.forEach(state => {
      let groupKey: string;

      if (groupBy === 'type') {
        groupKey = state.type;
      } else if (groupBy === 'category') {
        const style = getComputedStyle(state);
        groupKey = style.category;
      } else {
        groupKey = 'All';
      }

      // Security: Use Map for safe property access instead of dynamic object keys
      if (!Object.prototype.hasOwnProperty.call(groups, groupKey)) {
        // eslint-disable-next-line security/detect-object-injection
        groups[groupKey] = [];
      }
      // eslint-disable-next-line security/detect-object-injection
      groups[groupKey].push(state);
    });

    return groups;
  }, [filteredAnnotations, groupBy, getComputedStyle]);

  /**
   * Toggle annotation visibility
   */
  const toggleVisibility = useCallback((id: string) => {
    setVisibilityStates(prev => {
      const newStates = new Map(prev);
      const state = newStates.get(id);
      if (state) {
        const updatedState = { ...state, visible: !state.visible };
        newStates.set(id, updatedState);
        onVisibilityChange?.(id, updatedState.visible);
      }
      return newStates;
    });
  }, [onVisibilityChange]);

  /**
   * Toggle annotation selection
   */
  const toggleSelection = useCallback((id: string) => {
    if (selectionMode === SelectionMode.NONE) return;

    setSelectedIds(prev => {
      const newSelected = new Set(prev);

      if (selectionMode === SelectionMode.SINGLE) {
        newSelected.clear();
        if (!prev.has(id)) {
          newSelected.add(id);
        }
      } else {
        if (newSelected.has(id)) {
          newSelected.delete(id);
        } else {
          newSelected.add(id);
        }
      }

      // Update visibility states
      setVisibilityStates(prevStates => {
        const newStates = new Map(prevStates);
        prevStates.forEach((state, stateId) => {
          const updatedState = {
            ...state,
            selected: newSelected.has(stateId),
          };
          newStates.set(stateId, updatedState);
        });
        return newStates;
      });

      const selectedArray = Array.from(newSelected);
      onSelectionChange?.(selectedArray);
      return newSelected;
    });
  }, [selectionMode, onSelectionChange]);

  /**
   * Set hover state
   */
  const setHoverState = useCallback((id: string | null) => {
    // Update hover state (placeholder for future hover functionality)
    onHoverChange?.(id);

    // Update visibility states
    setVisibilityStates(prev => {
      const newStates = new Map(prev);
      prev.forEach((state, stateId) => {
        const updatedState = {
          ...state,
          hovered: stateId === id,
        };
        newStates.set(stateId, updatedState);
      });
      return newStates;
    });
  }, [onHoverChange]);

  /**
   * Set focus state
   */
  const setFocusState = useCallback((id: string | null) => {
    setFocusedId(id);
    onFocusChange?.(id);

    // Update visibility states
    setVisibilityStates(prev => {
      const newStates = new Map(prev);
      prev.forEach((state, stateId) => {
        const updatedState = {
          ...state,
          focused: stateId === id,
        };
        newStates.set(stateId, updatedState);
      });
      return newStates;
    });
  }, [onFocusChange]);

  /**
   * Batch operations
   */
  const showAll = useCallback(() => {
    setVisibilityStates(prev => {
      const newStates = new Map(prev);
      prev.forEach((state, id) => {
        const updatedState = { ...state, visible: true };
        newStates.set(id, updatedState);
        onVisibilityChange?.(id, true);
      });
      return newStates;
    });
  }, [onVisibilityChange]);

  const hideAll = useCallback(() => {
    setVisibilityStates(prev => {
      const newStates = new Map(prev);
      prev.forEach((state, id) => {
        const updatedState = { ...state, visible: false };
        newStates.set(id, updatedState);
        onVisibilityChange?.(id, false);
      });
      return newStates;
    });
  }, [onVisibilityChange]);

  const selectAll = useCallback(() => {
    if (selectionMode === SelectionMode.NONE) return;

    const allIds = new Set(filteredAnnotations.map(state => state.id));
    setSelectedIds(allIds);

    setVisibilityStates(prev => {
      const newStates = new Map(prev);
      prev.forEach((state, id) => {
        const updatedState = { ...state, selected: allIds.has(id) };
        newStates.set(id, updatedState);
      });
      return newStates;
    });

    onSelectionChange?.(Array.from(allIds));
  }, [selectionMode, filteredAnnotations, onSelectionChange]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());

    setVisibilityStates(prev => {
      const newStates = new Map(prev);
      prev.forEach((state, id) => {
        const updatedState = { ...state, selected: false };
        newStates.set(id, updatedState);
      });
      return newStates;
    });

    onSelectionChange?.([]);
  }, [onSelectionChange]);

  /**
   * Keyboard navigation
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enableKeyboardNavigation) return;

    const annotations = filteredAnnotations;
    const currentIndex = focusedId ? annotations.findIndex(a => a.id === focusedId) : -1;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        const nextIndex = (currentIndex + 1) % annotations.length;
        // Security: Safe array access with bounds check
        // eslint-disable-next-line security/detect-object-injection
        const nextAnnotation = nextIndex >= 0 && nextIndex < annotations.length ? annotations[nextIndex] : null;
        setFocusState(nextAnnotation?.id || null);
        break;
      }

      case 'ArrowUp': {
        event.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : annotations.length - 1;
        // Security: Safe array access with bounds check
        // eslint-disable-next-line security/detect-object-injection
        const prevAnnotation = prevIndex >= 0 && prevIndex < annotations.length ? annotations[prevIndex] : null;
        setFocusState(prevAnnotation?.id || null);
        break;
      }

      case ' ':
        event.preventDefault();
        if (focusedId) {
          toggleVisibility(focusedId);
        }
        break;

      case 'Enter':
        event.preventDefault();
        if (focusedId) {
          toggleSelection(focusedId);
        }
        break;

      case 'Escape':
        event.preventDefault();
        setFocusState(null);
        clearSelection();
        break;

      case 'a':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          selectAll();
        }
        break;
    }
  }, [
    enableKeyboardNavigation,
    filteredAnnotations,
    focusedId,
    setFocusState,
    toggleVisibility,
    toggleSelection,
    clearSelection,
    selectAll,
  ]);

  // Setup keyboard navigation
  useEffect(() => {
    if (enableKeyboardNavigation) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [enableKeyboardNavigation, handleKeyDown]);

  /**
   * Render annotation item
   */
  const renderAnnotationItem = useCallback((state: AnnotationVisibilityState) => {
    const style = getComputedStyle(state);

    return (
      <div
        key={state.id}
        className={`annotation-item ${state.visible ? 'visible' : 'hidden'} 
                   ${state.selected ? 'selected' : ''} 
                   ${state.hovered ? 'hovered' : ''} 
                   ${state.focused ? 'focused' : ''} 
                   ${state.disabled ? 'disabled' : ''}
                   ${state.locked ? 'locked' : ''}`}
        style={{
          opacity: state.visible ? style.opacity : 0.3,
          borderLeft: `4px solid ${style.line.color.hex}`,
        }}
        onMouseEnter={() => setHoverState(state.id)}
        onMouseLeave={() => setHoverState(null)}
        onFocus={() => setFocusState(state.id)}
        tabIndex={0}
      >
        <div className="annotation-controls">
          <button
            className="visibility-toggle"
            onClick={() => toggleVisibility(state.id)}
            disabled={state.disabled || state.locked}
            title={state.visible ? 'Hide annotation' : 'Show annotation'}
          >
            {state.visible ? '👁️' : '🙈'}
          </button>

          {selectionMode !== SelectionMode.NONE && (
            <button
              className="selection-toggle"
              onClick={() => toggleSelection(state.id)}
              disabled={state.disabled}
              title={state.selected ? 'Deselect annotation' : 'Select annotation'}
            >
              {state.selected ? '☑️' : '☐'}
            </button>
          )}
        </div>

        <div className="annotation-info">
          <div className="annotation-id">{state.id}</div>
          <div className="annotation-type">{state.type}</div>
          {state.locked && <span className="lock-indicator">🔒</span>}
        </div>

        <div className="annotation-status">
          {state.active && <span className="status-badge active">Active</span>}
          {state.disabled && <span className="status-badge disabled">Disabled</span>}
        </div>
      </div>
    );
  }, [getComputedStyle, setHoverState, setFocusState, toggleVisibility, toggleSelection, selectionMode]);

  return (
    <div className={`annotation-visibility-manager ${className}`}>
      {/* Controls Header */}
      <div className="visibility-controls">
        <div className="filter-controls">
          <input
            type="text"
            placeholder="Search annotations..."
            value={filter.searchQuery || ''}
            onChange={(e) => setFilter(prev => ({ ...prev, searchQuery: e.target.value }))}
            className="search-input"
          />

          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as 'type' | 'category' | 'none')}
            className="group-select"
          >
            <option value="none">No Grouping</option>
            <option value="type">Group by Type</option>
            <option value="category">Group by Category</option>
          </select>
        </div>

        {enableBatchOperations && (
          <div className="batch-controls">
            <button onClick={showAll} className="batch-button">
              Show All
            </button>
            <button onClick={hideAll} className="batch-button">
              Hide All
            </button>
            {selectionMode !== SelectionMode.NONE && (
              <>
                <button onClick={selectAll} className="batch-button">
                  Select All
                </button>
                <button onClick={clearSelection} className="batch-button">
                  Clear Selection
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="visibility-stats">
        <span>Total: {visibilityStates.size}</span>
        <span>Visible: {Array.from(visibilityStates.values()).filter(s => s.visible).length}</span>
        <span>Selected: {selectedIds.size}</span>
      </div>

      {/* Annotations List */}
      <div className="annotations-list">
        {Object.entries(groupedAnnotations).map(([groupName, groupAnnotations]) => (
          <div key={groupName} className="annotation-group">
            {groupBy !== 'none' && (
              <div className="group-header">
                <h4>{groupName}</h4>
                <span className="group-count">({groupAnnotations.length})</span>
              </div>
            )}
            <div className="group-items">
              {groupAnnotations.map(renderAnnotationItem)}
            </div>
          </div>
        ))}
      </div>

      {filteredAnnotations.length === 0 && (
        <div className="empty-state">
          <p>No annotations match the current filter.</p>
        </div>
      )}
    </div>
  );
};

export default AnnotationVisibilityManager;
