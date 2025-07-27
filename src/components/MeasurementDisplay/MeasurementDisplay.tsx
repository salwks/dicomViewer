/**
 * Measurement Display Component
 *
 * Displays measurement results with statistical analysis, confidence indicators,
 * and export functionality for medical imaging measurements
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  MeasurementResult,
  StatisticalData,
} from '../../services/measurementCalculator';
import { SafePropertyAccess } from '../../services/measurement/interfaces/MeasurementTypes';
import './MeasurementDisplay.css';

interface MeasurementDisplayProps {
  /** Measurement result to display */
  measurement: MeasurementResult;
  /** Show detailed statistics */
  showStatistics?: boolean;
  /** Allow editing of measurement */
  editable?: boolean;
  /** Callback when measurement is updated */
  onUpdate?: (measurement: MeasurementResult) => void;
  /** Callback when measurement is deleted */
  onDelete?: () => void;
  /** CSS class name */
  className?: string;
}

interface StatisticsDisplayProps {
  statistics: StatisticalData;
  unit?: string;
}

/**
 * Format number with appropriate precision
 */
const formatNumber = (value: number, precision: number = 2): string => {
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: precision,
    });
  }
  return value.toFixed(precision);
};

/**
 * Get confidence level description
 */
const getConfidenceDescription = (confidence: number): string => {
  if (confidence >= 0.95) return 'Excellent';
  if (confidence >= 0.90) return 'Very Good';
  if (confidence >= 0.80) return 'Good';
  if (confidence >= 0.70) return 'Fair';
  return 'Poor';
};

/**
 * Get confidence level color class
 */
const getConfidenceColorClass = (confidence: number): string => {
  if (confidence >= 0.90) return 'confidence-excellent';
  if (confidence >= 0.80) return 'confidence-good';
  if (confidence >= 0.70) return 'confidence-fair';
  return 'confidence-poor';
};

/**
 * Statistics Display Component
 */
const StatisticsDisplay: React.FC<StatisticsDisplayProps> = ({
  statistics,
  unit = '',
}) => {
  const [showHistogram, setShowHistogram] = useState(false);

  const histogramData = useMemo(() => {
    if (!statistics.histogram) return null;

    const { bins, counts } = statistics.histogram;
    const maxCount = Math.max(...counts);

    return bins.map((bin, index) => {
      const count = SafePropertyAccess.safeArrayAccess(counts, index) ?? 0;
      return {
        bin: formatNumber(bin),
        count,
        percentage: (count / maxCount) * 100,
      };
    });
  }, [statistics.histogram]);

  return (
    <div className="statistics-display">
      <div className="statistics-grid">
        <div className="stat-item">
          <label>Mean:</label>
          <span>{formatNumber(statistics.mean)} {unit}</span>
        </div>
        <div className="stat-item">
          <label>Median:</label>
          <span>{formatNumber(statistics.median)} {unit}</span>
        </div>
        <div className="stat-item">
          <label>Std Dev:</label>
          <span>{formatNumber(statistics.standardDeviation)} {unit}</span>
        </div>
        <div className="stat-item">
          <label>Min:</label>
          <span>{formatNumber(statistics.minimum)} {unit}</span>
        </div>
        <div className="stat-item">
          <label>Max:</label>
          <span>{formatNumber(statistics.maximum)} {unit}</span>
        </div>
        <div className="stat-item">
          <label>Count:</label>
          <span>{statistics.count.toLocaleString()}</span>
        </div>
        <div className="stat-item">
          <label>25th %ile:</label>
          <span>{formatNumber(statistics.percentile25)} {unit}</span>
        </div>
        <div className="stat-item">
          <label>75th %ile:</label>
          <span>{formatNumber(statistics.percentile75)} {unit}</span>
        </div>
        <div className="stat-item">
          <label>Skewness:</label>
          <span>{formatNumber(statistics.skewness, 3)}</span>
        </div>
        <div className="stat-item">
          <label>Kurtosis:</label>
          <span>{formatNumber(statistics.kurtosis, 3)}</span>
        </div>
      </div>

      {histogramData && (
        <div className="histogram-section">
          <button
            className="histogram-toggle"
            onClick={() => setShowHistogram(!showHistogram)}
            aria-expanded={showHistogram}
          >
            {showHistogram ? '▼' : '▶'} Histogram
          </button>

          {showHistogram && (
            <div className="histogram-container">
              <div className="histogram-chart">
                {histogramData.map((item, index) => (
                  <div
                    key={index}
                    className="histogram-bar"
                    style={{ height: `${item.percentage}%` }}
                    title={`${item.bin} ${unit}: ${item.count} pixels`}
                  />
                ))}
              </div>
              <div className="histogram-labels">
                <span>{formatNumber(statistics.minimum)} {unit}</span>
                <span>{formatNumber(statistics.maximum)} {unit}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Main Measurement Display Component
 */
export const MeasurementDisplay: React.FC<MeasurementDisplayProps> = ({
  measurement,
  showStatistics = false,
  editable = false,
  onUpdate,
  onDelete,
  className = '',
}) => {
  const [expanded, setExpanded] = useState(false);
  const [editableNote, setEditableNote] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
    setEditableNote(measurement.metadata.imageContext.imageId || '');
  }, [measurement.metadata.imageContext.imageId]);

  const handleSave = useCallback(() => {
    if (onUpdate) {
      const updatedMeasurement = {
        ...measurement,
        metadata: {
          ...measurement.metadata,
          imageContext: {
            ...measurement.metadata.imageContext,
            imageId: editableNote,
          },
        },
      };
      onUpdate(updatedMeasurement);
    }
    setIsEditing(false);
  }, [measurement, editableNote, onUpdate]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditableNote('');
  }, []);

  const handleExport = useCallback(() => {
    const exportData = {
      measurement,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `measurement-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [measurement]);

  return (
    <div className={`measurement-display ${className}`}>
      <div className="measurement-header">
        <div className="measurement-value">
          <span className="value">
            {formatNumber(measurement.value)}
          </span>
          <span className="unit">{measurement.unit}</span>
        </div>

        <div className="measurement-meta">
          <div className={`confidence-indicator ${getConfidenceColorClass(measurement.confidence)}`}>
            <span className="confidence-bar"
              style={{ width: `${measurement.confidence * 100}%` }} />
            <span className="confidence-text">
              {getConfidenceDescription(measurement.confidence)}
              ({(measurement.confidence * 100).toFixed(0)}%)
            </span>
          </div>

          <div className="measurement-method">
            Method: {measurement.metadata.method}
          </div>
        </div>

        <div className="measurement-actions">
          <button
            className="expand-button"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
          >
            {expanded ? '▼' : '▶'}
          </button>

          {editable && (
            <>
              <button
                className="edit-button"
                onClick={handleEdit}
                aria-label="Edit measurement"
              >
                ✏️
              </button>
              <button
                className="delete-button"
                onClick={onDelete}
                aria-label="Delete measurement"
              >
                🗑️
              </button>
            </>
          )}

          <button
            className="export-button"
            onClick={handleExport}
            aria-label="Export measurement"
          >
            📤
          </button>
        </div>
      </div>

      {expanded && (
        <div className="measurement-details">
          <div className="measurement-info">
            <div className="info-section">
              <h4>Measurement Details</h4>
              <div className="info-grid">
                <div className="info-item">
                  <label>Timestamp:</label>
                  <span>{measurement.metadata.timestamp.toLocaleString()}</span>
                </div>
                <div className="info-item">
                  <label>Method:</label>
                  <span>{measurement.metadata.method}</span>
                </div>
                <div className="info-item">
                  <label>Confidence:</label>
                  <span>{(measurement.confidence * 100).toFixed(1)}%</span>
                </div>
                {measurement.metadata.userId && (
                  <div className="info-item">
                    <label>User:</label>
                    <span>{measurement.metadata.userId}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="info-section">
              <h4>Calibration</h4>
              <div className="info-grid">
                <div className="info-item">
                  <label>Pixel Spacing:</label>
                  <span>
                    {formatNumber(measurement.metadata.calibration.pixelSpacing.columnSpacing, 3)} ×
                    {formatNumber(measurement.metadata.calibration.pixelSpacing.rowSpacing, 3)} mm
                  </span>
                </div>
                <div className="info-item">
                  <label>Source:</label>
                  <span>{measurement.metadata.calibration.calibrationSource}</span>
                </div>
                <div className="info-item">
                  <label>Accuracy:</label>
                  <span>{(measurement.metadata.calibration.accuracy * 100).toFixed(1)}%</span>
                </div>
                {measurement.metadata.calibration.pixelSpacing.sliceThickness && (
                  <div className="info-item">
                    <label>Slice Thickness:</label>
                    <span>
                      {formatNumber(measurement.metadata.calibration.pixelSpacing.sliceThickness, 3)} mm
                    </span>
                  </div>
                )}
              </div>
            </div>

            {measurement.metadata.imageContext && (
              <div className="info-section">
                <h4>Image Context</h4>
                <div className="info-grid">
                  {measurement.metadata.imageContext.imageId && (
                    <div className="info-item">
                      <label>Image ID:</label>
                      {isEditing ? (
                        <div className="edit-controls">
                          <input
                            type="text"
                            value={editableNote}
                            onChange={(e) => setEditableNote(e.target.value)}
                            className="edit-input"
                          />
                          <button onClick={handleSave} className="save-button">
                            ✓
                          </button>
                          <button onClick={handleCancel} className="cancel-button">
                            ✗
                          </button>
                        </div>
                      ) : (
                        <span>{measurement.metadata.imageContext.imageId}</span>
                      )}
                    </div>
                  )}
                  {measurement.metadata.imageContext.modality && (
                    <div className="info-item">
                      <label>Modality:</label>
                      <span>{measurement.metadata.imageContext.modality}</span>
                    </div>
                  )}
                  {measurement.metadata.imageContext.sliceLocation && (
                    <div className="info-item">
                      <label>Slice Location:</label>
                      <span>{formatNumber(measurement.metadata.imageContext.sliceLocation, 1)} mm</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {measurement.alternativeUnits && measurement.alternativeUnits.length > 0 && (
              <div className="info-section">
                <h4>Alternative Units</h4>
                <div className="alternative-units">
                  {measurement.alternativeUnits.map((alt, index) => (
                    <div key={index} className="alt-unit">
                      <span className="alt-value">{formatNumber(alt.value)}</span>
                      <span className="alt-unit-label">{alt.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {showStatistics && measurement.statistics && (
            <div className="statistics-section">
              <h4>Statistical Analysis</h4>
              <StatisticsDisplay
                statistics={measurement.statistics}
                unit={measurement.unit}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MeasurementDisplay;
