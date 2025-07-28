/**
 * AnnotationList Component
 * List and manage annotations in the medical imaging viewer
 */

/* eslint-disable security/detect-object-injection */

import React, { useState, useCallback, useMemo } from 'react';
import './styles.css';

export interface Annotation {
  id: string;
  type: 'length' | 'angle' | 'rectangle' | 'ellipse' | 'arrow' | 'text' | 'freehand' | 'brush';
  label?: string;
  description?: string;
  value?: string | number;
  unit?: string;
  color?: string;
  isVisible?: boolean;
  isLocked?: boolean;
  createdAt: Date;
  modifiedAt: Date;
  createdBy?: string;
  viewportId?: string;
  seriesInstanceUID?: string;
  sopInstanceUID?: string;
  frameNumber?: number;
  coordinates?: {
    x: number;
    y: number;
    width?: number;
    height?: number;
    points?: Array<{ x: number; y: number }>;
  };
  metadata?: Record<string, any>;
}

export interface AnnotationGroup {
  id: string;
  name: string;
  color: string;
  isVisible: boolean;
  isLocked: boolean;
  annotations: string[]; // annotation IDs
}

interface AnnotationListProps {
  annotations: Annotation[];
  groups?: AnnotationGroup[];
  selectedAnnotationIds?: string[];
  onAnnotationSelect?: (annotationIds: string[]) => void;
  onAnnotationToggleVisibility?: (annotationId: string) => void;
  onAnnotationToggleLock?: (annotationId: string) => void;
  onAnnotationDelete?: (annotationIds: string[]) => void;
  onAnnotationEdit?: (annotationId: string) => void;
  onAnnotationFocus?: (annotationId: string) => void;
  onGroupToggleVisibility?: (groupId: string) => void;
  onGroupToggleLock?: (groupId: string) => void;
  enableGrouping?: boolean;
  enableSearch?: boolean;
  enableFiltering?: boolean;
  className?: string;
}

type SortField = 'createdAt' | 'modifiedAt' | 'type' | 'label' | 'value';
type SortOrder = 'asc' | 'desc';
type FilterType = 'all' | 'measurements' | 'annotations' | 'segmentations';

const ANNOTATION_TYPE_ICONS: Record<string, React.ReactNode> = {
  length: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="20" x2="20" y2="4" />
      <circle cx="4" cy="20" r="2" fill="currentColor" />
      <circle cx="20" cy="4" r="2" fill="currentColor" />
    </svg>
  ),
  angle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20L4 12l8-8" />
      <path d="M12 12h8" />
    </svg>
  ),
  rectangle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  ),
  ellipse: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="12" rx="8" ry="6" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  text: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="8" y1="20" x2="16" y2="20" />
    </svg>
  ),
  freehand: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12c3-3 6-3 9 0s6 3 9 0" />
    </svg>
  ),
  brush: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l-6 6v3h3l6-6M22 2l-8 8" />
      <path d="m15 9 3-3" />
    </svg>
  ),
  default: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" />
    </svg>
  ),
};

// Safe function to get annotation icon
const getAnnotationIcon = (type: string): React.ReactNode => {
  if (Object.prototype.hasOwnProperty.call(ANNOTATION_TYPE_ICONS, type)) {
    return ANNOTATION_TYPE_ICONS[type];
  }
  return ANNOTATION_TYPE_ICONS.default;
};

export const AnnotationList: React.FC<AnnotationListProps> = ({
  annotations,
  groups: _groups = [],
  selectedAnnotationIds = [],
  onAnnotationSelect,
  onAnnotationToggleVisibility,
  onAnnotationToggleLock,
  onAnnotationDelete,
  onAnnotationEdit,
  onAnnotationFocus,
  onGroupToggleVisibility: _onGroupToggleVisibility,
  onGroupToggleLock: _onGroupToggleLock,
  enableGrouping: _enableGrouping = false,
  enableSearch = true,
  enableFiltering = true,
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterType, setFilterType] = useState<FilterType>('all');

  // Filter and sort annotations
  const filteredAndSortedAnnotations = useMemo(() => {
    let filtered = annotations;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(annotation =>
        annotation.label?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        annotation.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        annotation.type.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    // Apply type filter
    if (filterType !== 'all') {
      const typeMap: Record<FilterType, string[]> = {
        all: [],
        measurements: ['length', 'angle', 'rectangle', 'ellipse'],
        annotations: ['arrow', 'text', 'freehand'],
        segmentations: ['brush'],
      };
      filtered = filtered.filter(annotation =>

        typeMap[filterType].includes(annotation.type),
      );
    }

    // Sort annotations
    filtered.sort((a, b) => {
      // Validate sortField for security
      const validSortFields: SortField[] = ['createdAt', 'modifiedAt', 'type', 'label', 'value'];
      if (!validSortFields.includes(sortField)) {
        console.warn('Invalid sort field:', sortField);
        return 0;
      }


      let aValue: any = a[sortField];

      let bValue: any = b[sortField];

      if (sortField === 'createdAt' || sortField === 'modifiedAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue?.toLowerCase() || '';
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [annotations, searchQuery, sortField, sortOrder, filterType]);

  const handleAnnotationClick = useCallback((annotationId: string, isCtrlClick: boolean) => {
    if (!onAnnotationSelect) return;

    if (isCtrlClick) {
      // Multi-select
      const newSelection = selectedAnnotationIds.includes(annotationId)
        ? selectedAnnotationIds.filter(id => id !== annotationId)
        : [...selectedAnnotationIds, annotationId];
      onAnnotationSelect(newSelection);
    } else {
      // Single select
      onAnnotationSelect([annotationId]);
    }
  }, [selectedAnnotationIds, onAnnotationSelect]);

  // Removed unused handleSortChange function

  const handleSelectAll = useCallback(() => {
    if (!onAnnotationSelect) return;

    const allIds = filteredAndSortedAnnotations.map(a => a.id);
    if (selectedAnnotationIds.length === allIds.length) {
      onAnnotationSelect([]);
    } else {
      onAnnotationSelect(allIds);
    }
  }, [filteredAndSortedAnnotations, selectedAnnotationIds, onAnnotationSelect]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedAnnotationIds.length > 0 && onAnnotationDelete) {
      onAnnotationDelete(selectedAnnotationIds);
    }
  }, [selectedAnnotationIds, onAnnotationDelete]);

  const formatAnnotationValue = useCallback((annotation: Annotation) => {
    if (annotation.value === undefined || annotation.value === null) return '';

    const value = typeof annotation.value === 'number'
      ? annotation.value.toFixed(2)
      : annotation.value;

    return annotation.unit ? `${value} ${annotation.unit}` : value.toString();
  }, []);

  const formatDate = useCallback((date: Date) => {
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }, []);

  return (
    <div className={`annotation-list ${className}`}>
      {/* Header */}
      <div className="annotation-list__header">
        <h3 className="annotation-list__title">Annotations</h3>

        {/* Search */}
        {enableSearch && (
          <div className="annotation-list__search">
            <svg className="annotation-list__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              className="annotation-list__search-input"
              placeholder="Search annotations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="annotation-list__controls">
        {/* Filter */}
        {enableFiltering && (
          <select
            className="annotation-list__filter"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as FilterType)}
          >
            <option value="all">All Types</option>
            <option value="measurements">Measurements</option>
            <option value="annotations">Annotations</option>
            <option value="segmentations">Segmentations</option>
          </select>
        )}

        {/* Sort */}
        <select
          className="annotation-list__sort"
          value={`${sortField}-${sortOrder}`}
          onChange={(e) => {
            const [field, order] = e.target.value.split('-');
            setSortField(field as SortField);
            setSortOrder(order as SortOrder);
          }}
        >
          <option value="createdAt-desc">Newest First</option>
          <option value="createdAt-asc">Oldest First</option>
          <option value="modifiedAt-desc">Recently Modified</option>
          <option value="type-asc">Type A-Z</option>
          <option value="label-asc">Label A-Z</option>
        </select>

        {/* Actions */}
        <div className="annotation-list__actions">
          <button
            className="annotation-list__action-button"
            onClick={handleSelectAll}
            title={selectedAnnotationIds.length === filteredAndSortedAnnotations.length ? 'Deselect all' : 'Select all'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 11 12 14 22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
          </button>

          {selectedAnnotationIds.length > 0 && (
            <button
              className="annotation-list__action-button annotation-list__action-button--danger"
              onClick={handleDeleteSelected}
              title={`Delete ${selectedAnnotationIds.length} selected`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="annotation-list__content">
        {filteredAndSortedAnnotations.length === 0 ? (
          <div className="annotation-list__empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
            <span>No annotations found</span>
          </div>
        ) : (
          <div className="annotation-list__items">
            {filteredAndSortedAnnotations.map((annotation) => (
              <div
                key={annotation.id}
                className={`annotation-list__item ${
                  selectedAnnotationIds.includes(annotation.id) ? 'annotation-list__item--selected' : ''
                } ${
                  !annotation.isVisible ? 'annotation-list__item--hidden' : ''
                } ${
                  annotation.isLocked ? 'annotation-list__item--locked' : ''
                }`}
                onClick={(e) => handleAnnotationClick(annotation.id, e.ctrlKey || e.metaKey)}
                onDoubleClick={() => onAnnotationFocus?.(annotation.id)}
              >
                <div className="annotation-list__item-content">
                  {/* Icon and Type */}
                  <div className="annotation-list__item-icon" style={{ color: annotation.color }}>
                    {getAnnotationIcon(annotation.type)}
                  </div>

                  {/* Main Info */}
                  <div className="annotation-list__item-info">
                    <div className="annotation-list__item-primary">
                      <span className="annotation-list__item-label">
                        {annotation.label ||
                          `${annotation.type.charAt(0).toUpperCase() + annotation.type.slice(1)} ${annotation.id.slice(-4)}`}
                      </span>
                      {annotation.value && (
                        <span className="annotation-list__item-value">
                          {formatAnnotationValue(annotation)}
                        </span>
                      )}
                    </div>
                    <div className="annotation-list__item-secondary">
                      <span className="annotation-list__item-type">{annotation.type}</span>
                      <span className="annotation-list__item-date">
                        {formatDate(annotation.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="annotation-list__item-controls">
                    <button
                      className={`annotation-list__item-control ${
                        !annotation.isVisible ? 'annotation-list__item-control--inactive' : ''
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAnnotationToggleVisibility?.(annotation.id);
                      }}
                      title={annotation.isVisible ? 'Hide annotation' : 'Show annotation'}
                    >
                      {annotation.isVisible ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      )}
                    </button>

                    <button
                      className={`annotation-list__item-control ${
                        annotation.isLocked ? 'annotation-list__item-control--active' : ''
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAnnotationToggleLock?.(annotation.id);
                      }}
                      title={annotation.isLocked ? 'Unlock annotation' : 'Lock annotation'}
                    >
                      {annotation.isLocked ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <circle cx="12" cy="16" r="1" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <circle cx="12" cy="16" r="1" />
                          <path d="M7 11V7a5 5 0 0 1 8.6 3.5" />
                        </svg>
                      )}
                    </button>

                    <button
                      className="annotation-list__item-control"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAnnotationEdit?.(annotation.id);
                      }}
                      title="Edit annotation"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Description */}
                {annotation.description && (
                  <div className="annotation-list__item-description">
                    {annotation.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
