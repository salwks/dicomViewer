/**
 * SeriesBrowser Component
 * Displays DICOM series with thumbnails in a grid layout
 */

import React, { useState, useCallback, useMemo } from 'react';
import { log } from '../../utils/logger';
import './styles.css';

interface DicomSeries {
  seriesInstanceUID: string;
  seriesNumber: number;
  seriesDescription: string;
  modality: string;
  numberOfImages: number;
  thumbnail?: string;
  studyInstanceUID: string;
  studyDescription?: string;
  patientName?: string;
  studyDate?: string;
}

interface SeriesBrowserProps {
  series: DicomSeries[];
  selectedSeries?: string;
  onSeriesSelect: (seriesInstanceUID: string) => void;
  onSeriesLoad: (seriesInstanceUID: string) => void;
  isLoading?: boolean;
  className?: string;
}

export const SeriesBrowser: React.FC<SeriesBrowserProps> = ({
  series,
  selectedSeries,
  onSeriesSelect,
  onSeriesLoad,
  isLoading = false,
  className = '',
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'seriesNumber' | 'seriesDescription' | 'modality'>('seriesNumber');
  const [filterModality, setFilterModality] = useState<string>('all');

  // Get unique modalities for filter
  const modalities = useMemo(() => {
    const unique = [...new Set(series.map(s => s.modality))];
    return unique.sort();
  }, [series]);

  // Filter and sort series
  const filteredSeries = useMemo(() => {
    let filtered = series;

    // Apply modality filter
    if (filterModality !== 'all') {
      filtered = filtered.filter(s => s.modality === filterModality);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'seriesNumber':
          return a.seriesNumber - b.seriesNumber;
        case 'seriesDescription':
          return a.seriesDescription.localeCompare(b.seriesDescription);
        case 'modality':
          return a.modality.localeCompare(b.modality);
        default:
          return 0;
      }
    });

    return filtered;
  }, [series, filterModality, sortBy]);

  const handleSeriesClick = useCallback((seriesInstanceUID: string) => {
    log.info('Series selected', {
      component: 'SeriesBrowser',
      metadata: { seriesInstanceUID },
    });
    onSeriesSelect(seriesInstanceUID);
  }, [onSeriesSelect]);

  const handleSeriesDoubleClick = useCallback((seriesInstanceUID: string) => {
    log.info('Series loading requested', {
      component: 'SeriesBrowser',
      metadata: { seriesInstanceUID },
    });
    onSeriesLoad(seriesInstanceUID);
  }, [onSeriesLoad]);

  const generateThumbnail = useCallback((series: DicomSeries): string => {
    // Generate a placeholder thumbnail based on modality
    const modalityColors: Record<string, string> = {
      'CT': '#4a90e2',
      'MR': '#7ed321',
      'US': '#f5a623',
      'XA': '#bd10e0',
      'RF': '#b8e986',
      'CR': '#50e3c2',
      'DX': '#9013fe',
      'MG': '#e91e63',
      'PT': '#ff9800',
      'NM': '#795548',
    };

    const color = modalityColors[series.modality] || '#607d8b';

    return `data:image/svg+xml,${encodeURIComponent(`
      <svg width="120" height="120" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="120" fill="${color}20"/>
        <rect x="10" y="10" width="100" height="100" fill="none" stroke="${color}" stroke-width="2"/>
        <text x="60" y="50" text-anchor="middle" font-family="Arial" 
              font-size="16" font-weight="bold" fill="${color}">${series.modality}</text>
        <text x="60" y="70" text-anchor="middle" font-family="Arial" font-size="12" fill="${color}">${series.numberOfImages} images</text>
        <text x="60" y="85" text-anchor="middle" font-family="Arial" font-size="10" fill="${color}80">Series ${series.seriesNumber}</text>
      </svg>
    `)}`;
  }, []);

  // Debug logging
  React.useEffect(() => {
    log.info('SeriesBrowser received data', {
      component: 'SeriesBrowser',
      metadata: {
        seriesCount: series.length,
        filteredCount: filteredSeries.length,
        seriesData: series,
      },
    });
  }, [series, filteredSeries]);

  return (
    <div className={`series-browser ${className}`}>
      {/* Header Controls */}
      <div className="series-browser__header">
        <div className="series-browser__title">
          <h3>Series Browser</h3>
          <span className="series-browser__count">
            {filteredSeries.length} of {series.length} series
          </span>
        </div>

        <div className="series-browser__controls">
          {/* Modality Filter */}
          <select
            className="series-browser__filter"
            value={filterModality}
            onChange={(e) => setFilterModality(e.target.value)}
          >
            <option value="all">All Modalities</option>
            {modalities.map(modality => (
              <option key={modality} value={modality}>
                {modality}
              </option>
            ))}
          </select>

          {/* Sort Options */}
          <select
            className="series-browser__sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="seriesNumber">Series Number</option>
            <option value="seriesDescription">Description</option>
            <option value="modality">Modality</option>
          </select>

          {/* View Mode Toggle */}
          <div className="series-browser__view-toggle">
            <button
              className={`view-toggle__btn ${viewMode === 'grid' ? 'view-toggle__btn--active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
            </button>
            <button
              className={`view-toggle__btn ${viewMode === 'list' ? 'view-toggle__btn--active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Series List/Grid */}
      <div className={`series-browser__content series-browser__content--${viewMode}`}>
        {isLoading ? (
          <div className="series-browser__loading">
            <div className="loading-spinner"></div>
            <p>Loading series...</p>
          </div>
        ) : filteredSeries.length === 0 ? (
          <div className="series-browser__empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21,15 16,10 5,21"/>
            </svg>
            <p>No series found</p>
            <span>Try adjusting your filters</span>
          </div>
        ) : (
          filteredSeries.map((seriesItem) => (
            <div
              key={seriesItem.seriesInstanceUID}
              className={`series-item ${
                selectedSeries === seriesItem.seriesInstanceUID ? 'series-item--selected' : ''
              }`}
              onClick={() => handleSeriesClick(seriesItem.seriesInstanceUID)}
              onDoubleClick={() => handleSeriesDoubleClick(seriesItem.seriesInstanceUID)}
            >
              {/* Thumbnail */}
              <div className="series-item__thumbnail">
                <img
                  src={seriesItem.thumbnail || generateThumbnail(seriesItem)}
                  alt={`${seriesItem.modality} Series ${seriesItem.seriesNumber}`}
                  loading="lazy"
                  onError={(e) => {
                    log.error('Thumbnail failed to load', {
                      component: 'SeriesBrowser',
                      metadata: {
                        seriesUID: seriesItem.seriesInstanceUID,
                        thumbnailSrc: seriesItem.thumbnail,
                      },
                    });
                    // Use fallback
                    (e.target as HTMLImageElement).src = generateThumbnail(seriesItem);
                  }}
                  onLoad={() => {
                    log.info('Thumbnail loaded successfully', {
                      component: 'SeriesBrowser',
                      metadata: { seriesUID: seriesItem.seriesInstanceUID },
                    });
                  }}
                />
                <div className="series-item__overlay">
                  <span className="series-item__modality">{seriesItem.modality}</span>
                  <span className="series-item__count">{seriesItem.numberOfImages}</span>
                </div>
              </div>

              {/* Series Info */}
              <div className="series-item__info">
                <div className="series-item__header">
                  <span className="series-item__number">#{seriesItem.seriesNumber}</span>
                  <span className="series-item__modality-badge">{seriesItem.modality}</span>
                </div>
                <h4 className="series-item__title">
                  {seriesItem.seriesDescription || 'Unnamed Series'}
                </h4>
                <p className="series-item__details">
                  {seriesItem.numberOfImages} images
                </p>
                {viewMode === 'list' && (
                  <div className="series-item__metadata">
                    <span>Study: {seriesItem.studyDescription || 'N/A'}</span>
                    <span>Date: {seriesItem.studyDate || 'N/A'}</span>
                    {seriesItem.patientName && (
                      <span>Patient: {seriesItem.patientName}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="series-item__actions">
                <button
                  className="series-item__action"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSeriesDoubleClick(seriesItem.seriesInstanceUID);
                  }}
                  title="Load Series"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5,3 19,12 5,21"/>
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
