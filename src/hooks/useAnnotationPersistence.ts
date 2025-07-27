/**
 * useAnnotationPersistence Hook
 *
 * React hook for managing annotation persistence operations
 * Provides a convenient interface for components to interact with the persistence system
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  annotationPersistenceManager,
  AnnotationPersistenceManager,
  PersistenceManagerConfig,
  OperationResult,
} from '../services/annotationPersistenceManager';
import { SerializedAnnotation, AnnotationExport } from '../services/annotationPersistence';
import { ImportResult, ImportConfig } from '../services/annotationImporter';
import { PDFExportOptions } from '../services/pdfExporter';
import { SRExportOptions } from '../services/dicomSRExporter';

/**
 * Hook configuration
 */
export interface UseAnnotationPersistenceConfig {
  /** Auto-initialize the manager */
  autoInitialize?: boolean;
  /** Manager configuration */
  managerConfig?: Partial<PersistenceManagerConfig>;
  /** Event callbacks */
  onAnnotationSaved?: (annotation: SerializedAnnotation) => void;
  onAnnotationsLoaded?: (annotations: SerializedAnnotation[]) => void;
  onExportCompleted?: (type: string, result: any) => void;
  onImportCompleted?: (result: ImportResult) => void;
  onError?: (error: string, operation: string) => void;
}

/**
 * Hook state
 */
export interface AnnotationPersistenceState {
  /** Initialization status */
  isInitialized: boolean;
  /** Loading status */
  isLoading: boolean;
  /** Current annotations */
  annotations: SerializedAnnotation[];
  /** Undo/redo availability */
  canUndo: boolean;
  canRedo: boolean;
  /** Manager statistics */
  statistics: any;
  /** Last error */
  lastError: string | null;
}

/**
 * Hook operations
 */
export interface AnnotationPersistenceOperations {
  /** Initialize the manager */
  initialize: () => Promise<void>;
  /** Create annotation */
  createAnnotation: (annotation: SerializedAnnotation) => Promise<OperationResult<SerializedAnnotation>>;
  /** Update annotation */
  updateAnnotation: (annotation: SerializedAnnotation) => Promise<OperationResult<SerializedAnnotation>>;
  /** Delete annotation */
  deleteAnnotation: (annotationId: string) => Promise<OperationResult<void>>;
  /** Load annotations */
  loadAnnotations: (key: string) => Promise<OperationResult<SerializedAnnotation[]>>;
  /** Export to JSON */
  exportToJSON: (key: string) => Promise<OperationResult<AnnotationExport>>;
  /** Export to PDF */
  exportToPDF: (data: AnnotationExport, options?: PDFExportOptions) => Promise<OperationResult<Blob>>;
  /** Export to DICOM SR */
  exportToDicomSR: (data: AnnotationExport, options?: SRExportOptions) => Promise<OperationResult<any>>;
  /** Import from file */
  importFromFile: (file: File, config?: ImportConfig) => Promise<OperationResult<ImportResult>>;
  /** Import from URL */
  importFromURL: (url: string, config?: ImportConfig) => Promise<OperationResult<ImportResult>>;
  /** Undo last operation */
  undo: () => Promise<OperationResult<boolean>>;
  /** Redo last operation */
  redo: () => Promise<OperationResult<boolean>>;
  /** Register viewport */
  registerViewport: (viewportId: string, initialState: any) => void;
  /** Update viewport state */
  updateViewportState: (viewportId: string, updates: any) => void;
  /** Get viewport annotations */
  getViewportAnnotations: (viewportId: string) => Promise<OperationResult<SerializedAnnotation[]>>;
  /** Clear error */
  clearError: () => void;
  /** Refresh statistics */
  refreshStatistics: () => void;
}

/**
 * Hook return type
 */
export interface UseAnnotationPersistenceReturn extends AnnotationPersistenceState, AnnotationPersistenceOperations {
  /** Manager instance */
  manager: AnnotationPersistenceManager;
}

/**
 * useAnnotationPersistence Hook
 */
export function useAnnotationPersistence(
  config: UseAnnotationPersistenceConfig = {},
): UseAnnotationPersistenceReturn {
  const {
    autoInitialize = true,
    managerConfig,
    onAnnotationSaved,
    onAnnotationsLoaded,
    onExportCompleted,
    onImportCompleted,
    onError,
  } = config;

  // State
  const [state, setState] = useState<AnnotationPersistenceState>({
    isInitialized: false,
    isLoading: false,
    annotations: [],
    canUndo: false,
    canRedo: false,
    statistics: null,
    lastError: null,
  });

  // Manager reference
  const managerRef = useRef<AnnotationPersistenceManager>(
    managerConfig ?
      annotationPersistenceManager.constructor(managerConfig) as AnnotationPersistenceManager :
      annotationPersistenceManager,
  );

  /**
   * Update undo/redo state
   */
  const updateUndoRedoState = useCallback(() => {
    const manager = managerRef.current;
    setState(prev => ({
      ...prev,
      canUndo: manager.canUndo(),
      canRedo: manager.canRedo(),
    }));
  }, []);

  /**
   * Update statistics
   */
  const updateStatistics = useCallback(() => {
    const stats = managerRef.current.getStatistics();
    setState(prev => ({
      ...prev,
      statistics: stats,
    }));
  }, []);

  /**
   * Handle error
   */
  const handleError = useCallback((error: string, operation: string) => {
    setState(prev => ({ ...prev, lastError: error, isLoading: false }));
    onError?.(error, operation);
  }, [onError]);

  /**
   * Initialize manager
   */
  const initialize = useCallback(async () => {
    if (state.isInitialized) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      await managerRef.current.initialize();
      setState(prev => ({
        ...prev,
        isInitialized: true,
        isLoading: false,
        lastError: null,
      }));
      updateUndoRedoState();
      updateStatistics();
    } catch (error) {
      handleError(`Initialization failed: ${error}`, 'initialize');
    }
  }, [state.isInitialized, updateUndoRedoState, updateStatistics, handleError]);

  /**
   * Create annotation
   */
  const createAnnotation = useCallback(async (annotation: SerializedAnnotation) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const result = await managerRef.current.createAnnotation(annotation);

      if (result.success) {
        setState(prev => ({
          ...prev,
          annotations: [...prev.annotations, annotation],
          isLoading: false,
          lastError: null,
        }));
        onAnnotationSaved?.(annotation);
        updateUndoRedoState();
        updateStatistics();
      } else {
        handleError(result.error || 'Create annotation failed', 'createAnnotation');
      }

      return result;
    } catch (error) {
      const errorMsg = `Create annotation failed: ${error}`;
      handleError(errorMsg, 'createAnnotation');
      return { success: false, error: errorMsg };
    }
  }, [onAnnotationSaved, updateUndoRedoState, updateStatistics, handleError]);

  /**
   * Update annotation
   */
  const updateAnnotation = useCallback(async (annotation: SerializedAnnotation) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const result = await managerRef.current.updateAnnotation(annotation);

      if (result.success) {
        setState(prev => ({
          ...prev,
          annotations: prev.annotations.map(a => a.id === annotation.id ? annotation : a),
          isLoading: false,
          lastError: null,
        }));
        onAnnotationSaved?.(annotation);
        updateUndoRedoState();
        updateStatistics();
      } else {
        handleError(result.error || 'Update annotation failed', 'updateAnnotation');
      }

      return result;
    } catch (error) {
      const errorMsg = `Update annotation failed: ${error}`;
      handleError(errorMsg, 'updateAnnotation');
      return { success: false, error: errorMsg };
    }
  }, [onAnnotationSaved, updateUndoRedoState, updateStatistics, handleError]);

  /**
   * Delete annotation
   */
  const deleteAnnotation = useCallback(async (annotationId: string) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const result = await managerRef.current.deleteAnnotation(annotationId);

      if (result.success) {
        setState(prev => ({
          ...prev,
          annotations: prev.annotations.filter(a => a.id !== annotationId),
          isLoading: false,
          lastError: null,
        }));
        updateUndoRedoState();
        updateStatistics();
      } else {
        handleError(result.error || 'Delete annotation failed', 'deleteAnnotation');
      }

      return result;
    } catch (error) {
      const errorMsg = `Delete annotation failed: ${error}`;
      handleError(errorMsg, 'deleteAnnotation');
      return { success: false, error: errorMsg };
    }
  }, [updateUndoRedoState, updateStatistics, handleError]);

  /**
   * Load annotations
   */
  const loadAnnotations = useCallback(async (key: string) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const result = await managerRef.current.loadAnnotations(key);

      if (result.success && result.data) {
        setState(prev => ({
          ...prev,
          annotations: result.data!,
          isLoading: false,
          lastError: null,
        }));
        onAnnotationsLoaded?.(result.data);
        updateStatistics();
      } else {
        handleError(result.error || 'Load annotations failed', 'loadAnnotations');
      }

      return result;
    } catch (error) {
      const errorMsg = `Load annotations failed: ${error}`;
      handleError(errorMsg, 'loadAnnotations');
      return { success: false, error: errorMsg };
    }
  }, [onAnnotationsLoaded, updateStatistics, handleError]);

  /**
   * Export to JSON
   */
  const exportToJSON = useCallback(async (key: string) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const result = await managerRef.current.exportToJSON(key);

      if (result.success) {
        setState(prev => ({ ...prev, isLoading: false, lastError: null }));
        onExportCompleted?.('json', result.data);
      } else {
        handleError(result.error || 'JSON export failed', 'exportToJSON');
      }

      return result;
    } catch (error) {
      const errorMsg = `JSON export failed: ${error}`;
      handleError(errorMsg, 'exportToJSON');
      return { success: false, error: errorMsg };
    }
  }, [onExportCompleted, handleError]);

  /**
   * Export to PDF
   */
  const exportToPDF = useCallback(async (data: AnnotationExport, options?: PDFExportOptions) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const result = await managerRef.current.exportToPDF(data, options);

      if (result.success) {
        setState(prev => ({ ...prev, isLoading: false, lastError: null }));
        onExportCompleted?.('pdf', result.data);
      } else {
        handleError(result.error || 'PDF export failed', 'exportToPDF');
      }

      return result;
    } catch (error) {
      const errorMsg = `PDF export failed: ${error}`;
      handleError(errorMsg, 'exportToPDF');
      return { success: false, error: errorMsg };
    }
  }, [onExportCompleted, handleError]);

  /**
   * Export to DICOM SR
   */
  const exportToDicomSR = useCallback(async (data: AnnotationExport, options?: SRExportOptions) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const result = await managerRef.current.exportToDicomSR(data, options);

      if (result.success) {
        setState(prev => ({ ...prev, isLoading: false, lastError: null }));
        onExportCompleted?.('dicom-sr', result.data);
      } else {
        handleError(result.error || 'DICOM SR export failed', 'exportToDicomSR');
      }

      return result;
    } catch (error) {
      const errorMsg = `DICOM SR export failed: ${error}`;
      handleError(errorMsg, 'exportToDicomSR');
      return { success: false, error: errorMsg };
    }
  }, [onExportCompleted, handleError]);

  /**
   * Import from file
   */
  const importFromFile = useCallback(async (file: File, config?: ImportConfig) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const result = await managerRef.current.importFromFile(file, config);

      if (result.success && result.data) {
        const importedAnnotations = result.data.importedAnnotations;
        setState(prev => ({
          ...prev,
          annotations: [...prev.annotations, ...importedAnnotations],
          isLoading: false,
          lastError: null,
        }));
        onImportCompleted?.(result.data);
        updateStatistics();
      } else {
        handleError(result.error || 'Import failed', 'importFromFile');
      }

      return result;
    } catch (error) {
      const errorMsg = `Import failed: ${error}`;
      handleError(errorMsg, 'importFromFile');
      return { success: false, error: errorMsg };
    }
  }, [onImportCompleted, updateStatistics, handleError]);

  /**
   * Import from URL
   */
  const importFromURL = useCallback(async (url: string, config?: ImportConfig) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const result = await managerRef.current.importFromURL(url, config);

      if (result.success && result.data) {
        const importedAnnotations = result.data.importedAnnotations;
        setState(prev => ({
          ...prev,
          annotations: [...prev.annotations, ...importedAnnotations],
          isLoading: false,
          lastError: null,
        }));
        onImportCompleted?.(result.data);
        updateStatistics();
      } else {
        handleError(result.error || 'URL import failed', 'importFromURL');
      }

      return result;
    } catch (error) {
      const errorMsg = `URL import failed: ${error}`;
      handleError(errorMsg, 'importFromURL');
      return { success: false, error: errorMsg };
    }
  }, [onImportCompleted, updateStatistics, handleError]);

  /**
   * Undo operation
   */
  const undo = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const result = await managerRef.current.undo();
      setState(prev => ({ ...prev, isLoading: false, lastError: null }));
      updateUndoRedoState();
      updateStatistics();
      return result;
    } catch (error) {
      const errorMsg = `Undo failed: ${error}`;
      handleError(errorMsg, 'undo');
      return { success: false, error: errorMsg };
    }
  }, [updateUndoRedoState, updateStatistics, handleError]);

  /**
   * Redo operation
   */
  const redo = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const result = await managerRef.current.redo();
      setState(prev => ({ ...prev, isLoading: false, lastError: null }));
      updateUndoRedoState();
      updateStatistics();
      return result;
    } catch (error) {
      const errorMsg = `Redo failed: ${error}`;
      handleError(errorMsg, 'redo');
      return { success: false, error: errorMsg };
    }
  }, [updateUndoRedoState, updateStatistics, handleError]);

  /**
   * Register viewport
   */
  const registerViewport = useCallback((viewportId: string, initialState: any) => {
    managerRef.current.registerViewport(viewportId, initialState);
  }, []);

  /**
   * Update viewport state
   */
  const updateViewportState = useCallback((viewportId: string, updates: any) => {
    managerRef.current.updateViewportState(viewportId, updates);
  }, []);

  /**
   * Get viewport annotations
   */
  const getViewportAnnotations = useCallback(async (viewportId: string) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const result = await managerRef.current.getViewportAnnotations(viewportId);
      setState(prev => ({ ...prev, isLoading: false, lastError: null }));
      return result;
    } catch (error) {
      const errorMsg = `Get viewport annotations failed: ${error}`;
      handleError(errorMsg, 'getViewportAnnotations');
      return { success: false, error: errorMsg };
    }
  }, [handleError]);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, lastError: null }));
  }, []);

  /**
   * Refresh statistics
   */
  const refreshStatistics = useCallback(() => {
    updateStatistics();
  }, [updateStatistics]);

  // Auto-initialize
  useEffect(() => {
    if (autoInitialize && !state.isInitialized) {
      initialize();
    }
  }, [autoInitialize, state.isInitialized, initialize]);

  // Event listeners
  useEffect(() => {
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
  }, [updateUndoRedoState, updateStatistics]);

  return {
    // State
    ...state,

    // Operations
    initialize,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    loadAnnotations,
    exportToJSON,
    exportToPDF,
    exportToDicomSR,
    importFromFile,
    importFromURL,
    undo,
    redo,
    registerViewport,
    updateViewportState,
    getViewportAnnotations,
    clearError,
    refreshStatistics,

    // Manager instance
    manager: managerRef.current,
  };
}

export default useAnnotationPersistence;
