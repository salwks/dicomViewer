/**
 * Measurement Toolbar Component
 *
 * Provides easy access to measurement tools and configuration options
 * with real-time feedback and calibration controls
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  MeasurementTool,
  measurementManager,
  MeasurementReport,
} from '../../services/measurementManager';
import { AnnotationType } from '../../types/annotation-styling';
import { PixelSpacing } from '../../services/measurementCalculator';
import { SafePropertyAccess } from '../../services/measurement/interfaces/MeasurementTypes';
import './MeasurementToolbar.css';

interface MeasurementToolbarProps {
  /** Current active tool */
  activeTool?: MeasurementTool;
  /** Available tools */
  availableTools?: MeasurementTool[];
  /** Show calibration controls */
  showCalibration?: boolean;
  /** Show measurement list */
  showMeasurementList?: boolean;
  /** Current pixel spacing */
  pixelSpacing?: PixelSpacing;
  /** Callback when tool is selected */
  onToolSelect?: (tool: MeasurementTool) => void;
  /** Callback when calibration is updated */
  onCalibrationUpdate?: (pixelSpacing: PixelSpacing) => void;
  /** CSS class name */
  className?: string;
}

interface CalibrationControlsProps {
  pixelSpacing?: PixelSpacing;
  onUpdate?: (pixelSpacing: PixelSpacing) => void;
}

interface MeasurementListProps {
  measurements: any[];
  onSelect?: (measurementId: string) => void;
  onDelete?: (measurementId: string) => void;
}

/**
 * Tool configuration mapping
 */
const TOOL_CONFIG = {
  [MeasurementTool.LENGTH]: {
    icon: '📏',
    label: 'Length',
    description: 'Measure linear distances',
    annotationType: AnnotationType.LENGTH,
    shortcut: 'L',
  },
  [MeasurementTool.ANGLE]: {
    icon: '📐',
    label: 'Angle',
    description: 'Measure angles between lines',
    annotationType: AnnotationType.ANGLE,
    shortcut: 'A',
  },
  [MeasurementTool.AREA]: {
    icon: '⬛',
    label: 'Area',
    description: 'Measure areas and regions',
    annotationType: AnnotationType.AREA,
    shortcut: 'R',
  },
  [MeasurementTool.VOLUME]: {
    icon: '📦',
    label: 'Volume',
    description: 'Calculate 3D volumes',
    annotationType: AnnotationType.AREA, // Maps to 3D area
    shortcut: 'V',
  },
  [MeasurementTool.ROI_ANALYSIS]: {
    icon: '📊',
    label: 'ROI Analysis',
    description: 'Statistical pixel analysis',
    annotationType: AnnotationType.PROBE,
    shortcut: 'S',
  },
  [MeasurementTool.PROBE]: {
    icon: '🎯',
    label: 'Probe',
    description: 'Point measurements',
    annotationType: AnnotationType.PROBE,
    shortcut: 'P',
  },
};

/**
 * Default available tools
 */
const DEFAULT_TOOLS = [
  MeasurementTool.LENGTH,
  MeasurementTool.ANGLE,
  MeasurementTool.AREA,
  MeasurementTool.ROI_ANALYSIS,
  MeasurementTool.PROBE,
];

/**
 * Calibration Controls Component
 */
const CalibrationControls: React.FC<CalibrationControlsProps> = ({
  pixelSpacing,
  onUpdate,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editableSpacing, setEditableSpacing] = useState<PixelSpacing>({
    columnSpacing: pixelSpacing?.columnSpacing || 1.0,
    rowSpacing: pixelSpacing?.rowSpacing || 1.0,
    sliceThickness: pixelSpacing?.sliceThickness,
    sliceSpacing: pixelSpacing?.sliceSpacing,
  });

  const handleUpdate = useCallback(() => {
    if (onUpdate) {
      onUpdate(editableSpacing);
    }
    setIsExpanded(false);
  }, [editableSpacing, onUpdate]);

  const handleReset = useCallback(() => {
    if (pixelSpacing) {
      setEditableSpacing(pixelSpacing);
    }
  }, [pixelSpacing]);

  return (
    <div className="calibration-controls">
      <button
        className={`calibration-toggle ${isExpanded ? 'expanded' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
        title="Calibration settings"
      >
        ⚙️ Calibration
      </button>

      {isExpanded && (
        <div className="calibration-panel">
          <div className="calibration-field">
            <label>Column Spacing (mm/pixel):</label>
            <input
              type="number"
              step="0.001"
              value={editableSpacing.columnSpacing}
              onChange={(e) =>
                setEditableSpacing({
                  ...editableSpacing,
                  columnSpacing: parseFloat(e.target.value) || 1.0,
                })
              }
            />
          </div>

          <div className="calibration-field">
            <label>Row Spacing (mm/pixel):</label>
            <input
              type="number"
              step="0.001"
              value={editableSpacing.rowSpacing}
              onChange={(e) =>
                setEditableSpacing({
                  ...editableSpacing,
                  rowSpacing: parseFloat(e.target.value) || 1.0,
                })
              }
            />
          </div>

          <div className="calibration-field">
            <label>Slice Thickness (mm):</label>
            <input
              type="number"
              step="0.1"
              value={editableSpacing.sliceThickness || ''}
              placeholder="Optional"
              onChange={(e) =>
                setEditableSpacing({
                  ...editableSpacing,
                  sliceThickness: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
            />
          </div>

          <div className="calibration-actions">
            <button className="calibration-apply" onClick={handleUpdate}>
              Apply
            </button>
            <button className="calibration-reset" onClick={handleReset}>
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Measurement List Component
 */
const MeasurementList: React.FC<MeasurementListProps> = ({
  measurements,
  onSelect,
  onDelete,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="measurement-list">
      <button
        className={`measurement-list-toggle ${isExpanded ? 'expanded' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
        title="Measurement list"
      >
        📋 Measurements ({measurements.length})
      </button>

      {isExpanded && (
        <div className="measurement-list-panel">
          {measurements.length === 0 ? (
            <div className="no-measurements">No measurements available</div>
          ) : (
            <div className="measurement-items">
              {measurements.map((measurement) => (
                <div
                  key={measurement.id}
                  className="measurement-item"
                  onClick={() => onSelect?.(measurement.id)}
                >
                  <div className="measurement-item-info">
                    <span className="measurement-tool">
                      {measurement.config?.tool
                        ? SafePropertyAccess.safePropertyAccess(TOOL_CONFIG, measurement.config.tool as MeasurementTool)?.icon || '📏'
                        : '📏'}
                    </span>
                    <span className="measurement-type">
                      {measurement.config?.tool
                        ? SafePropertyAccess.safePropertyAccess(
                          TOOL_CONFIG,
                          measurement.config.tool as MeasurementTool,
                        )?.label || measurement.type
                        : measurement.type}
                    </span>
                    {measurement.result && (
                      <span className="measurement-value">
                        {measurement.result.value.toFixed(2)} {measurement.result.unit}
                      </span>
                    )}
                  </div>
                  <div className="measurement-item-actions">
                    <button
                      className="measurement-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.(measurement.id);
                      }}
                      title="Delete measurement"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Main Measurement Toolbar Component
 */
export const MeasurementToolbar: React.FC<MeasurementToolbarProps> = ({
  activeTool,
  availableTools = DEFAULT_TOOLS,
  showCalibration = true,
  showMeasurementList = true,
  pixelSpacing,
  onToolSelect,
  onCalibrationUpdate,
  className = '',
}) => {
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [report, setReport] = useState<MeasurementReport | null>(null);
  const [showReport, setShowReport] = useState(false);

  // Load measurements
  useEffect(() => {
    const updateMeasurements = () => {
      const allMeasurements = measurementManager.getAllMeasurements();
      setMeasurements(allMeasurements);
    };

    // Initial load
    updateMeasurements();

    // Listen for measurement changes
    measurementManager.on('measurementCreated', updateMeasurements);
    measurementManager.on('measurementUpdated', updateMeasurements);
    measurementManager.on('measurementRemoved', updateMeasurements);
    measurementManager.on('measurementsCleared', updateMeasurements);

    return () => {
      measurementManager.off('measurementCreated', updateMeasurements);
      measurementManager.off('measurementUpdated', updateMeasurements);
      measurementManager.off('measurementRemoved', updateMeasurements);
      measurementManager.off('measurementsCleared', updateMeasurements);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) return;

      const tool = Object.values(MeasurementTool).find((t) => {
        const config = SafePropertyAccess.safePropertyAccess(TOOL_CONFIG, t);
        return config.shortcut.toLowerCase() === event.key.toLowerCase();
      });

      if (tool && availableTools.includes(tool)) {
        event.preventDefault();
        onToolSelect?.(tool);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [availableTools, onToolSelect]);

  const handleToolSelect = useCallback((tool: MeasurementTool) => {
    onToolSelect?.(tool);
  }, [onToolSelect]);

  const handleMeasurementSelect = useCallback((_measurementId: string) => {
    // Focus on the measurement in the viewer
    // TODO: Implement measurement focus functionality
  }, []);

  const handleMeasurementDelete = useCallback((measurementId: string) => {
    measurementManager.removeMeasurement(measurementId);
  }, []);

  const handleGenerateReport = useCallback(() => {
    const generatedReport = measurementManager.generateReport();
    setReport(generatedReport);
    setShowReport(true);
  }, []);

  const handleExportMeasurements = useCallback(async () => {
    try {
      const jsonData = await measurementManager.exportMeasurements({
        format: 'json',
        includeStatistics: true,
        includeCalibration: true,
        includeRawData: false,
      });

      const blob = new Blob([jsonData as string], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `measurements-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export measurements:', error);
    }
  }, []);

  const handleClearAllMeasurements = useCallback(() => {
    // eslint-disable-next-line no-alert
    if (window.confirm('Are you sure you want to clear all measurements?')) {
      measurementManager.clearAllMeasurements();
    }
  }, []);

  return (
    <div className={`measurement-toolbar ${className}`}>
      <div className="toolbar-section">
        <div className="tool-buttons">
          {availableTools.map((tool) => {
            const config = SafePropertyAccess.safePropertyAccess(TOOL_CONFIG, tool);
            return (
              <button
                key={tool}
                className={`tool-button ${activeTool === tool ? 'active' : ''}`}
                onClick={() => handleToolSelect(tool)}
                title={`${config.label} (${config.shortcut}) - ${config.description}`}
              >
                <span className="tool-icon">{config.icon}</span>
                <span className="tool-label">{config.label}</span>
                <span className="tool-shortcut">{config.shortcut}</span>
              </button>
            );
          })}
        </div>
      </div>

      {showCalibration && (
        <div className="toolbar-section">
          <CalibrationControls
            pixelSpacing={pixelSpacing}
            onUpdate={onCalibrationUpdate}
          />
        </div>
      )}

      {showMeasurementList && (
        <div className="toolbar-section">
          <MeasurementList
            measurements={measurements}
            onSelect={handleMeasurementSelect}
            onDelete={handleMeasurementDelete}
          />
        </div>
      )}

      <div className="toolbar-section">
        <div className="measurement-actions">
          <button
            className="action-button report-button"
            onClick={handleGenerateReport}
            title="Generate measurement report"
          >
            📄 Report
          </button>

          <button
            className="action-button export-button"
            onClick={handleExportMeasurements}
            title="Export measurements"
            disabled={measurements.length === 0}
          >
            📤 Export
          </button>

          <button
            className="action-button clear-button"
            onClick={handleClearAllMeasurements}
            title="Clear all measurements"
            disabled={measurements.length === 0}
          >
            🗑️ Clear All
          </button>
        </div>
      </div>

      {/* Report Modal */}
      {showReport && report && (
        <div className="report-modal-overlay" onClick={() => setShowReport(false)}>
          <div className="report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="report-header">
              <h3>Measurement Report</h3>
              <button
                className="report-close"
                onClick={() => setShowReport(false)}
              >
                ✕
              </button>
            </div>
            <div className="report-content">
              <div className="report-summary">
                <h4>Summary</h4>
                <div className="summary-grid">
                  <div className="summary-item">
                    <label>Total Measurements:</label>
                    <span>{report.summary.totalMeasurements}</span>
                  </div>
                  <div className="summary-item">
                    <label>Average Confidence:</label>
                    <span>{(report.summary.averageConfidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="summary-item">
                    <label>Calibration Accuracy:</label>
                    <span>{(report.summary.calibrationAccuracy * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              <div className="report-breakdown">
                <h4>Measurement Breakdown</h4>
                <div className="breakdown-grid">
                  {Object.entries(report.summary.measurementTypes).map(([tool, count]) => (
                    count > 0 && (
                      <div key={tool} className="breakdown-item">
                        <span className="breakdown-tool">
                          {SafePropertyAccess.safePropertyAccess(TOOL_CONFIG, tool as MeasurementTool)?.label || tool}:
                        </span>
                        <span className="breakdown-count">{count}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </div>
            <div className="report-actions">
              <button
                className="report-export"
                onClick={() => {
                  const reportJson = JSON.stringify(report, null, 2);
                  const blob = new Blob([reportJson], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `measurement-report-${Date.now()}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
              >
                📤 Export Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeasurementToolbar;
