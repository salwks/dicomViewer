/**
 * Series Management Hook
 * React hook for managing multi-study series data and viewport assignments
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  SeriesManagementService,
  SeriesManagementConfig,
  seriesManagementService as defaultService,
} from '../services/SeriesManagementService';
import { DICOMStudy, DICOMSeries, SeriesManagementState, SeriesAssignment, StudyColorScheme } from '../types/dicom';
import { log } from '../utils/logger';
import { safePropertyAccess } from '../lib/utils';

interface UseSeriesManagementOptions {
  service?: SeriesManagementService;
  config?: Partial<SeriesManagementConfig>;
  autoStart?: boolean;
}

interface UseSeriesManagementReturn {
  // State
  state: SeriesManagementState;
  isLoading: boolean;
  error: string | null;

  // Study Management
  loadStudy: (study: DICOMStudy) => Promise<void>;
  unloadStudy: (studyInstanceUID: string) => void;
  selectStudy: (studyInstanceUID: string) => void;

  // Series Management
  selectSeries: (seriesInstanceUID: string) => void;
  getAllSeries: () => (DICOMSeries & { studyInstanceUID: string; studyColor?: string })[];
  getStudySeries: (studyInstanceUID: string) => DICOMSeries[];

  // Viewport Assignment
  assignSeriesToViewport: (seriesInstanceUID: string, viewportId: string) => boolean;
  clearViewportAssignment: (viewportId: string) => void;
  getAssignedSeries: (viewportId: string) => (DICOMSeries & { studyInstanceUID: string }) | null;
  getViewportAssignments: () => Record<string, string>;

  // Filtering and Sorting
  setFilter: (filterModality: string) => void;
  setSorting: (sortBy: 'seriesNumber' | 'seriesDescription' | 'modality' | 'studyDate') => void;
  setViewMode: (viewMode: 'grid' | 'list' | 'tree') => void;

  // Color Management
  setStudyColorScheme: (studyInstanceUID: string, colorScheme: StudyColorScheme) => void;
  getStudyColor: (studyInstanceUID: string) => string | undefined;

  // Session Management
  clearSession: () => void;

  // Service Instance
  service: SeriesManagementService;
}

export const useSeriesManagement = (options: UseSeriesManagementOptions = {}): UseSeriesManagementReturn => {
  const {
    service = defaultService,
    config,
    // autoStart = true, // Reserved for future auto-initialization
  } = options;

  // Create service instance if config is provided
  const serviceRef = useRef<SeriesManagementService>(service);
  if (config && serviceRef.current === defaultService) {
    serviceRef.current = new SeriesManagementService(config);
  }

  const [state, setState] = useState<SeriesManagementState>(() => serviceRef.current.getState());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Setup event listeners
  useEffect(() => {
    const currentService = serviceRef.current;

    const handleStateChange = (newState: SeriesManagementState) => {
      setState(newState);
    };

    const handleStudyLoaded = (study: DICOMStudy) => {
      setIsLoading(false);
      setError(null);
      log.info('Study loaded via hook', {
        component: 'useSeriesManagement',
        metadata: { studyUID: study.studyInstanceUID },
      });
    };

    const handleStudyUnloaded = (study: DICOMStudy) => {
      log.info('Study unloaded via hook', {
        component: 'useSeriesManagement',
        metadata: { studyUID: study.studyInstanceUID },
      });
    };

    const handleSeriesAssigned = (assignment: SeriesAssignment) => {
      log.info('Series assigned via hook', {
        component: 'useSeriesManagement',
        metadata: { ...assignment } as Record<string, unknown>,
      });
    };

    const handleError = (errorEvent: any) => {
      setIsLoading(false);
      setError(errorEvent.message || 'Unknown error occurred');
      log.error('Series management error', {
        component: 'useSeriesManagement',
        metadata: { error: errorEvent },
      });
    };

    // Add event listeners
    currentService.on('stateChanged', handleStateChange);
    currentService.on('studyLoaded', handleStudyLoaded);
    currentService.on('studyUnloaded', handleStudyUnloaded);
    currentService.on('seriesAssigned', handleSeriesAssigned);
    currentService.on('error', handleError);

    // Initial state sync
    setState(currentService.getState());

    return () => {
      currentService.off('stateChanged', handleStateChange);
      currentService.off('studyLoaded', handleStudyLoaded);
      currentService.off('studyUnloaded', handleStudyUnloaded);
      currentService.off('seriesAssigned', handleSeriesAssigned);
      currentService.off('error', handleError);
    };
  }, []);

  // Study Management
  const loadStudy = useCallback(async (study: DICOMStudy) => {
    try {
      setIsLoading(true);
      setError(null);
      await serviceRef.current.loadStudy(study);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load study';
      setError(errorMessage);
      setIsLoading(false);
      throw err;
    }
  }, []);

  const unloadStudy = useCallback((studyInstanceUID: string) => {
    try {
      setError(null);
      serviceRef.current.unloadStudy(studyInstanceUID);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unload study';
      setError(errorMessage);
    }
  }, []);

  const selectStudy = useCallback((studyInstanceUID: string) => {
    serviceRef.current.setState({ selectedStudy: studyInstanceUID });
  }, []);

  // Series Management
  const selectSeries = useCallback((seriesInstanceUID: string) => {
    serviceRef.current.setState({ selectedSeries: seriesInstanceUID });
  }, []);

  const getAllSeries = useCallback(() => {
    return serviceRef.current.getAllSeries();
  }, []);

  const getStudySeries = useCallback((studyInstanceUID: string) => {
    return serviceRef.current.getStudySeries(studyInstanceUID);
  }, []);

  // Viewport Assignment
  const assignSeriesToViewport = useCallback((seriesInstanceUID: string, viewportId: string) => {
    try {
      setError(null);
      return serviceRef.current.assignSeriesToViewport(seriesInstanceUID, viewportId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to assign series';
      setError(errorMessage);
      return false;
    }
  }, []);

  const clearViewportAssignment = useCallback((viewportId: string) => {
    try {
      setError(null);
      serviceRef.current.clearViewportAssignment(viewportId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear assignment';
      setError(errorMessage);
    }
  }, []);

  const getAssignedSeries = useCallback((viewportId: string) => {
    return serviceRef.current.getAssignedSeries(viewportId);
  }, []);

  const getViewportAssignments = useCallback(() => {
    return serviceRef.current.getViewportAssignments();
  }, []);

  // Filtering and Sorting
  const setFilter = useCallback((filterModality: string) => {
    serviceRef.current.setFilter(filterModality);
  }, []);

  const setSorting = useCallback((sortBy: 'seriesNumber' | 'seriesDescription' | 'modality' | 'studyDate') => {
    serviceRef.current.setSorting(sortBy);
  }, []);

  const setViewMode = useCallback((viewMode: 'grid' | 'list' | 'tree') => {
    serviceRef.current.setViewMode(viewMode);
  }, []);

  // Color Management
  const setStudyColorScheme = useCallback((studyInstanceUID: string, colorScheme: StudyColorScheme) => {
    serviceRef.current.setStudyColorScheme(studyInstanceUID, colorScheme);
  }, []);

  const getStudyColor = useCallback(
    (studyInstanceUID: string): string | undefined => {
      return safePropertyAccess(state.colorMappings, studyInstanceUID);
    },
    [state.colorMappings],
  );

  // Session Management
  const clearSession = useCallback(() => {
    serviceRef.current.clearSession();
  }, []);

  return {
    // State
    state,
    isLoading,
    error,

    // Study Management
    loadStudy,
    unloadStudy,
    selectStudy,

    // Series Management
    selectSeries,
    getAllSeries,
    getStudySeries,

    // Viewport Assignment
    assignSeriesToViewport,
    clearViewportAssignment,
    getAssignedSeries,
    getViewportAssignments,

    // Filtering and Sorting
    setFilter,
    setSorting,
    setViewMode,

    // Color Management
    setStudyColorScheme,
    getStudyColor,

    // Session Management
    clearSession,

    // Service Instance
    service: serviceRef.current,
  };
};

// Hook for simplified viewport assignment
export const useViewportAssignment = (viewportId: string, options: UseSeriesManagementOptions = {}) => {
  const { state, assignSeriesToViewport, clearViewportAssignment, getAssignedSeries } = useSeriesManagement(options);

  const assignedSeries = getAssignedSeries(viewportId);
  const isAssigned = Boolean(assignedSeries);

  const assignSeries = useCallback(
    (seriesInstanceUID: string) => {
      return assignSeriesToViewport(seriesInstanceUID, viewportId);
    },
    [assignSeriesToViewport, viewportId],
  );

  const clearAssignment = useCallback(() => {
    clearViewportAssignment(viewportId);
  }, [clearViewportAssignment, viewportId]);

  return {
    assignedSeries,
    isAssigned,
    assignSeries,
    clearAssignment,
    viewportAssignments: state.viewportAssignments,
  };
};
