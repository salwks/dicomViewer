/**
 * Annotation Persistence Panel
 *
 * React component for managing annotation persistence operations
 * Provides UI for save, load, export, import, and undo/redo operations
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  annotationPersistenceManager,
  AnnotationPersistenceManager,
  OperationResult,
} from '../../services/annotationPersistenceManager';
import { SerializedAnnotation, AnnotationExport } from '../../services/annotationPersistence';
import { ImportResult, ImportSourceType } from '../../services/annotationImporter';
import { PDFExportOptions } from '../../services/pdfExporter';
import { SRExportOptions } from '../../services/dicomSRExporter';

/**
 * Component props
 */
export interface AnnotationPersistencePanelProps {
  /** Current viewport ID */
  viewportId?: string;
  /** Show compact view */
  compact?: boolean;
  /** Disable specific features */
  disabled?: {
    save?: boolean;
    load?: boolean;
    export?: boolean;
    import?: boolean;
    undoRedo?: boolean;
  };
  /** Custom styling */
  className?: string;
  /** Event callbacks */
  onAnnotationSaved?: (annotation: SerializedAnnotation) => void;
  onAnnotationsLoaded?: (annotations: SerializedAnnotation[]) => void;
  onExportCompleted?: (type: string, result: any) => void;
  onImportCompleted?: (result: ImportResult) => void;
  onError?: (error: string) => void;
}

/**
 * Export format options
 */
const EXPORT_FORMATS = [
  { key: 'json', label: 'JSON', extension: 'json' },
  { key: 'pdf', label: 'PDF Report', extension: 'pdf' },
  { key: 'dicom-sr', label: 'DICOM SR', extension: 'dcm' },
] as const;

/**
 * Import format options
 */
const IMPORT_FORMATS = [
  { key: ImportSourceType.JSON, label: 'JSON' },
  { key: ImportSourceType.CSV, label: 'CSV' },
  { key: ImportSourceType.XML, label: 'XML' },
  { key: ImportSourceType.DICOM_SR, label: 'DICOM SR' },
] as const;

/**
 * Annotation Persistence Panel Component
 */
export const AnnotationPersistencePanel: React.FC<AnnotationPersistencePanelProps> = ({
  viewportId = 'default',
  compact = false,
  disabled = {},
  className = '',
  onAnnotationSaved,
  onAnnotationsLoaded,
  onExportCompleted,
  onImportCompleted,
  onError,
}) => {
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [loadKey, setLoadKey] = useState('');
  const [exportFormat, setExportFormat] = useState<'json' | 'pdf' | 'dicom-sr'>('json');
  const [importFormat, setImportFormat] = useState<ImportSourceType>(ImportSourceType.JSON);
  const [annotations, setAnnotations] = useState<SerializedAnnotation[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [statistics, setStatistics] = useState<any>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const managerRef = useRef<AnnotationPersistenceManager>(annotationPersistenceManager);

  /**
   * Download blob data
   */
  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  /**
   * Download JSON data
   */
  const downloadJSON = useCallback((data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, filename);
  }, [downloadBlob]);

  /**
   * Update undo/redo state
   */
  const updateUndoRedoState = useCallback(() => {
    const manager = managerRef.current;
    setCanUndo(manager.canUndo());
    setCanRedo(manager.canRedo());
  }, []);

  /**
   * Update statistics
   */
  const updateStatistics = useCallback(() => {
    const stats = managerRef.current.getStatistics();
    setStatistics(stats);
  }, []);

  /**
   * Initialize component
   */
  useEffect(() => {
    const initialize = async () => {
      try {
        await managerRef.current.initialize();
        updateUndoRedoState();
        updateStatistics();
      } catch (error) {
        console.error('Failed to initialize annotation persistence:', error);
        onError?.(`Initialization failed: ${error}`);
      }
    };

    initialize();

    // Set up event listeners
    const manager = managerRef.current;
    const handleOperationComplete = () => {
      updateUndoRedoState();
      updateStatistics();
    };

    manager.on('annotationCreated', handleOperationComplete);
    manager.on('annotationUpdated', handleOperationComplete);
    manager.on('annotationDeleted', handleOperationComplete);

    return () => {
      manager.off('annotationCreated', handleOperationComplete);
      manager.off('annotationUpdated', handleOperationComplete);
      manager.off('annotationDeleted', handleOperationComplete);
    };
  }, [updateUndoRedoState, updateStatistics, onError]);

  /**
   * Handle save annotations
   */
  const handleSaveAnnotations = useCallback(async () => {
    if (disabled.save || isLoading) return;

    setIsLoading(true);
    try {
      // For demo purposes, create a sample annotation
      const sampleAnnotation: SerializedAnnotation = {
        id: `annotation-${Date.now()}`,
        type: 'TEXT' as any,
        data: { text: 'Sample annotation' },
        viewportInfo: {
          viewportId,
          imageId: 'sample-image',
        },
        state: {
          visible: true,
          selected: false,
          locked: false,
          active: false,
          zIndex: 100,
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'User',
          version: '1.0.0',
          tags: [],
          description: 'Sample annotation for demo',
        },
        styling: {
          id: 'default-text-style',
          name: 'Default Text Style',
          description: 'Default styling for text annotations',
          compatibleTypes: ['TEXT' as any],
          line: {
            color: {
              rgb: [0, 0, 0],
              hex: '#000000',
            },
            width: 2,
            style: 'solid' as const,
            cap: 'round' as const,
            join: 'round' as const,
          },
          font: {
            family: 'Arial',
            size: 14,
            weight: 'normal' as const,
            style: 'normal' as const,
            lineHeight: 1.2,
          },
          opacity: 1,
          visible: true,
          zIndex: 100,
          animation: undefined,
          shadow: undefined,
          fill: {
            color: {
              rgb: [255, 255, 255],
              hex: '#ffffff',
            },
            opacity: 0.5,
          },
          measurementPrecision: 2,
          unitDisplay: {
            show: true,
            format: 'short' as const,
            position: 'inline' as const,
          },
          scaleFactor: 1,
          category: 'text' as any,
          isPreset: false,
          isReadonly: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0',
          tags: [],
        },
      };

      const result = await managerRef.current.createAnnotation(sampleAnnotation);

      if (result.success) {
        onAnnotationSaved?.(sampleAnnotation);
        setAnnotations(prev => [...prev, sampleAnnotation]);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Save failed:', error);
      onError?.(`Save failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  }, [disabled.save, isLoading, viewportId, onAnnotationSaved, onError]);

  /**
   * Handle load annotations
   */
  const handleLoadAnnotations = useCallback(async () => {
    if (disabled.load || isLoading || !loadKey.trim()) return;

    setIsLoading(true);
    try {
      const result = await managerRef.current.loadAnnotations(loadKey.trim());

      if (result.success && result.data) {
        setAnnotations(result.data);
        onAnnotationsLoaded?.(result.data);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Load failed:', error);
      onError?.(`Load failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  }, [disabled.load, isLoading, loadKey, onAnnotationsLoaded, onError]);

  /**
   * Handle export annotations
   */
  const handleExportAnnotations = useCallback(async () => {
    if (disabled.export || isLoading || annotations.length === 0) return;

    setIsLoading(true);
    try {
      const exportData: AnnotationExport = {
        annotations,
        version: '1.0.0',
        exportedAt: new Date(),
        metadata: {
          exportedBy: 'User',
          application: 'Cornerstone3D Viewer',
          applicationVersion: '1.0.0',
          totalCount: annotations.length,
          categories: [],
          types: [...new Set(annotations.map(a => a.type))],
        },
        styles: [],
        checksum: 'placeholder-checksum',
      };

      let result: OperationResult<any>;
      let filename: string;

      switch (exportFormat) {
        case 'json': {
          result = await managerRef.current.exportToJSON(loadKey || 'annotations');
          filename = `annotations-${Date.now()}.json`;
          if (result.success && result.data) {
            downloadJSON(result.data, filename);
          }
          break;
        }

        case 'pdf': {
          const pdfOptions: PDFExportOptions = {
            title: 'Medical Imaging Report',
            includePatientInfo: true,
            includeMeasurements: true,
          };
          result = await managerRef.current.exportToPDF(exportData, pdfOptions);
          filename = `report-${Date.now()}.pdf`;
          if (result.success && result.data) {
            downloadBlob(result.data, filename);
          }
          break;
        }

        case 'dicom-sr': {
          const srOptions: SRExportOptions = {
            includePatientInfo: true,
            includeMeasurements: true,
          };
          result = await managerRef.current.exportToDicomSR(exportData, srOptions);
          filename = `report-${Date.now()}.dcm`;
          if (result.success && result.data) {
            downloadJSON(result.data, filename);
          }
          break;
        }

        default:
          throw new Error(`Unsupported export format: ${exportFormat}`);
      }

      if (result.success) {
        onExportCompleted?.(exportFormat, result.data);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Export failed:', error);
      onError?.(`Export failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  }, [disabled.export, isLoading, annotations, exportFormat, loadKey, onExportCompleted, onError, downloadBlob, downloadJSON]);

  /**
   * Handle import annotations
   */
  const handleImportAnnotations = useCallback(async () => {
    if (disabled.import || isLoading) return;

    fileInputRef.current?.click();
  }, [disabled.import, isLoading]);

  /**
   * Handle file selection for import
   */
  const handleFileSelected = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const result = await managerRef.current.importFromFile(file, {
        sourceType: importFormat,
        mergeStrategy: 'merge',
        validationLevel: 'moderate',
        autoAssignStyles: true,
        defaultStyleMappings: {} as any,
      });

      if (result.success && result.data) {
        const importedAnnotations = result.data.importedAnnotations;
        setAnnotations(prev => [...prev, ...importedAnnotations]);
        onImportCompleted?.(result.data);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Import failed:', error);
      onError?.(`Import failed: ${error}`);
    } finally {
      setIsLoading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [importFormat, onImportCompleted, onError]);

  /**
   * Handle undo
   */
  const handleUndo = useCallback(async () => {
    if (disabled.undoRedo || isLoading || !canUndo) return;

    setIsLoading(true);
    try {
      await managerRef.current.undo();
    } catch (error) {
      console.error('Undo failed:', error);
      onError?.(`Undo failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  }, [disabled.undoRedo, isLoading, canUndo, onError]);

  /**
   * Handle redo
   */
  const handleRedo = useCallback(async () => {
    if (disabled.undoRedo || isLoading || !canRedo) return;

    setIsLoading(true);
    try {
      await managerRef.current.redo();
    } catch (error) {
      console.error('Redo failed:', error);
      onError?.(`Redo failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  }, [disabled.undoRedo, isLoading, canRedo, onError]);

  if (compact) {
    return (
      <div className={`annotation-persistence-compact ${className}`}>
        {/* Compact toolbar */}
        <div className="annotation-toolbar">
          <button
            onClick={handleSaveAnnotations}
            disabled={disabled.save || isLoading}
            title="Save Annotation"
            className="btn-icon"
          >
            💾
          </button>

          <button
            onClick={handleExportAnnotations}
            disabled={disabled.export || isLoading || annotations.length === 0}
            title="Export Annotations"
            className="btn-icon"
          >
            📤
          </button>

          <button
            onClick={handleImportAnnotations}
            disabled={disabled.import || isLoading}
            title="Import Annotations"
            className="btn-icon"
          >
            📥
          </button>

          <div className="separator" />

          <button
            onClick={handleUndo}
            disabled={disabled.undoRedo || isLoading || !canUndo}
            title="Undo"
            className="btn-icon"
          >
            ↶
          </button>

          <button
            onClick={handleRedo}
            disabled={disabled.undoRedo || isLoading || !canRedo}
            title="Redo"
            className="btn-icon"
          >
            ↷
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileSelected}
          accept=".json,.csv,.xml,.dcm"
        />
      </div>
    );
  }

  return (
    <div className={`annotation-persistence-panel ${className}`}>
      <div className="panel-header">
        <h3>Annotation Persistence</h3>
        {statistics && (
          <div className="statistics">
            <span>Annotations: {annotations.length}</span>
          </div>
        )}
      </div>

      {/* Save/Load Section */}
      <div className="panel-section">
        <h4>Save & Load</h4>

        <div className="form-group">
          <button
            onClick={handleSaveAnnotations}
            disabled={disabled.save || isLoading}
            className="btn btn-primary"
          >
            {isLoading ? 'Saving...' : 'Save Sample Annotation'}
          </button>
        </div>

        <div className="form-group">
          <input
            type="text"
            value={loadKey}
            onChange={(e) => setLoadKey(e.target.value)}
            placeholder="Enter key to load annotations"
            className="form-input"
            disabled={disabled.load || isLoading}
          />
          <button
            onClick={handleLoadAnnotations}
            disabled={disabled.load || isLoading || !loadKey.trim()}
            className="btn btn-secondary"
          >
            {isLoading ? 'Loading...' : 'Load'}
          </button>
        </div>
      </div>

      {/* Export Section */}
      <div className="panel-section">
        <h4>Export</h4>

        <div className="form-group">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as any)}
            disabled={disabled.export || isLoading}
            className="form-select"
          >
            {EXPORT_FORMATS.map(format => (
              <option key={format.key} value={format.key}>
                {format.label}
              </option>
            ))}
          </select>

          <button
            onClick={handleExportAnnotations}
            disabled={disabled.export || isLoading || annotations.length === 0}
            className="btn btn-secondary"
          >
            {isLoading ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>

      {/* Import Section */}
      <div className="panel-section">
        <h4>Import</h4>

        <div className="form-group">
          <select
            value={importFormat}
            onChange={(e) => setImportFormat(e.target.value as ImportSourceType)}
            disabled={disabled.import || isLoading}
            className="form-select"
          >
            {IMPORT_FORMATS.map(format => (
              <option key={format.key} value={format.key}>
                {format.label}
              </option>
            ))}
          </select>

          <button
            onClick={handleImportAnnotations}
            disabled={disabled.import || isLoading}
            className="btn btn-secondary"
          >
            {isLoading ? 'Importing...' : 'Import File'}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileSelected}
          accept=".json,.csv,.xml,.dcm"
        />
      </div>

      {/* Undo/Redo Section */}
      <div className="panel-section">
        <h4>History</h4>

        <div className="form-group">
          <button
            onClick={handleUndo}
            disabled={disabled.undoRedo || isLoading || !canUndo}
            className="btn btn-secondary"
          >
            ↶ Undo
          </button>

          <button
            onClick={handleRedo}
            disabled={disabled.undoRedo || isLoading || !canRedo}
            className="btn btn-secondary"
          >
            ↷ Redo
          </button>
        </div>
      </div>

      {/* Annotations List */}
      {annotations.length > 0 && (
        <div className="panel-section">
          <h4>Current Annotations ({annotations.length})</h4>
          <ul className="annotation-list">
            {annotations.slice(0, 5).map(annotation => (
              <li key={annotation.id} className="annotation-item">
                <span className="annotation-type">{annotation.type}</span>
                <span className="annotation-id">{annotation.id.slice(0, 8)}...</span>
                <span className="annotation-date">
                  {new Date(annotation.metadata.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
            {annotations.length > 5 && (
              <li className="annotation-item-more">
                +{annotations.length - 5} more...
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AnnotationPersistencePanel;
