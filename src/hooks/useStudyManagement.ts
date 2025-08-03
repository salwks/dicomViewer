/**
 * Study Management Hook
 * Handles study selection, filtering, and data transformation
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { DICOMStudy, DICOMSeries } from '../types/dicom';
import { log } from '../utils/logger';

interface StudyManagementState {
  studies: DICOMStudy[];
  selectedStudyId: string | null;
  selectedSeriesId: string | null;
  isLoading: boolean;
  error: string | null;
}

interface StudyManagementHook {
  // State
  studies: DICOMStudy[];
  selectedStudyId: string | null;
  selectedSeriesId: string | null;
  selectedStudy: DICOMStudy | null;
  selectedSeries: DICOMSeries | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setStudies: (studies: DICOMStudy[]) => void;
  selectStudy: (studyInstanceUID: string | null) => void;
  selectSeries: (seriesInstanceUID: string | null) => void;
  addStudy: (study: DICOMStudy) => void;
  removeStudy: (studyInstanceUID: string) => void;
  updateStudy: (studyInstanceUID: string, updates: Partial<DICOMStudy>) => void;
  clearStudies: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Computed values
  allSeries: DICOMSeries[];
  selectedStudySeries: DICOMSeries[];
  studyCount: number;
  totalSeriesCount: number;
  totalImageCount: number;

  // Utilities
  getStudyById: (studyInstanceUID: string) => DICOMStudy | null;
  getSeriesById: (seriesInstanceUID: string) => DICOMSeries | null;
  getSeriesByStudy: (studyInstanceUID: string) => DICOMSeries[];
  transformLegacySeriesData: (legacySeriesData: any[]) => DICOMStudy[];
}

const DEFAULT_STUDY_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#84cc16', // Lime
];

export const useStudyManagement = (): StudyManagementHook => {
  const [state, setState] = useState<StudyManagementState>({
    studies: [],
    selectedStudyId: null,
    selectedSeriesId: null,
    isLoading: false,
    error: null,
  });

  // Computed values
  const selectedStudy = useMemo(() => {
    return state.selectedStudyId
      ? state.studies.find(study => study.studyInstanceUID === state.selectedStudyId) || null
      : null;
  }, [state.studies, state.selectedStudyId]);

  const selectedSeries = useMemo(() => {
    if (!state.selectedSeriesId) return null;

    for (const study of state.studies) {
      const series = study.series.find(s => s.seriesInstanceUID === state.selectedSeriesId);
      if (series) return series;
    }
    return null;
  }, [state.studies, state.selectedSeriesId]);

  const allSeries = useMemo(() => {
    return state.studies.flatMap(study =>
      study.series.map(series => ({
        ...series,
        studyInstanceUID: study.studyInstanceUID,
      })),
    );
  }, [state.studies]);

  const selectedStudySeries = useMemo(() => {
    return selectedStudy?.series || [];
  }, [selectedStudy]);

  const studyCount = useMemo(() => state.studies.length, [state.studies]);

  const totalSeriesCount = useMemo(() => {
    return state.studies.reduce((count, study) => count + study.series.length, 0);
  }, [state.studies]);

  const totalImageCount = useMemo(() => {
    return state.studies.reduce((count, study) =>
      count + study.series.reduce((seriesCount, series) =>
        seriesCount + series.numberOfInstances, 0,
      ), 0,
    );
  }, [state.studies]);

  // Actions
  const setStudies = useCallback((studies: DICOMStudy[]) => {
    // Assign colors to studies if they don't have them
    const studiesWithColors = studies.map((study, index) => ({
      ...study,
      color: study.color || DEFAULT_STUDY_COLORS[index % DEFAULT_STUDY_COLORS.length],
      totalImages: study.totalImages || study.series.reduce((sum, s) => sum + s.numberOfInstances, 0),
      numberOfSeries: study.numberOfSeries || study.series.length,
    }));

    setState(prev => ({
      ...prev,
      studies: studiesWithColors,
      // Reset selections if studies changed completely
      selectedStudyId: studiesWithColors.length > 0 && !studiesWithColors.find(s => s.studyInstanceUID === prev.selectedStudyId)
        ? studiesWithColors[0].studyInstanceUID
        : prev.selectedStudyId,
    }));

    log.info('Studies updated', {
      component: 'useStudyManagement',
      metadata: {
        studyCount: studiesWithColors.length,
        totalSeries: studiesWithColors.reduce((sum, s) => sum + s.series.length, 0),
      },
    });
  }, []);

  const selectStudy = useCallback((studyInstanceUID: string | null) => {
    setState(prev => ({
      ...prev,
      selectedStudyId: studyInstanceUID,
      // Clear series selection when study changes
      selectedSeriesId: null,
    }));

    log.info('Study selected', {
      component: 'useStudyManagement',
      metadata: { studyInstanceUID },
    });
  }, []);

  const selectSeries = useCallback((seriesInstanceUID: string | null) => {
    setState(prev => ({ ...prev, selectedSeriesId: seriesInstanceUID }));

    log.info('Series selected', {
      component: 'useStudyManagement',
      metadata: { seriesInstanceUID },
    });
  }, []);

  const addStudy = useCallback((study: DICOMStudy) => {
    setState(prev => {
      const studyWithColor = {
        ...study,
        color: study.color || DEFAULT_STUDY_COLORS[prev.studies.length % DEFAULT_STUDY_COLORS.length],
        totalImages: study.totalImages || study.series.reduce((sum, s) => sum + s.numberOfInstances, 0),
        numberOfSeries: study.numberOfSeries || study.series.length,
      };

      return {
        ...prev,
        studies: [...prev.studies, studyWithColor],
      };
    });

    log.info('Study added', {
      component: 'useStudyManagement',
      metadata: { studyInstanceUID: study.studyInstanceUID },
    });
  }, []);

  const removeStudy = useCallback((studyInstanceUID: string) => {
    setState(prev => ({
      ...prev,
      studies: prev.studies.filter(study => study.studyInstanceUID !== studyInstanceUID),
      selectedStudyId: prev.selectedStudyId === studyInstanceUID ? null : prev.selectedStudyId,
      selectedSeriesId: prev.selectedSeriesId &&
        prev.studies.find(s => s.studyInstanceUID === studyInstanceUID)?.series
          .some(series => series.seriesInstanceUID === prev.selectedSeriesId) ? null : prev.selectedSeriesId,
    }));

    log.info('Study removed', {
      component: 'useStudyManagement',
      metadata: { studyInstanceUID },
    });
  }, []);

  const updateStudy = useCallback((studyInstanceUID: string, updates: Partial<DICOMStudy>) => {
    setState(prev => ({
      ...prev,
      studies: prev.studies.map(study =>
        study.studyInstanceUID === studyInstanceUID
          ? { ...study, ...updates }
          : study,
      ),
    }));

    log.info('Study updated', {
      component: 'useStudyManagement',
      metadata: { studyInstanceUID, updates },
    });
  }, []);

  const clearStudies = useCallback(() => {
    setState({
      studies: [],
      selectedStudyId: null,
      selectedSeriesId: null,
      isLoading: false,
      error: null,
    });

    log.info('Studies cleared', {
      component: 'useStudyManagement',
    });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  // Utility functions
  const getStudyById = useCallback((studyInstanceUID: string): DICOMStudy | null => {
    return state.studies.find(study => study.studyInstanceUID === studyInstanceUID) || null;
  }, [state.studies]);

  const getSeriesById = useCallback((seriesInstanceUID: string): DICOMSeries | null => {
    for (const study of state.studies) {
      const series = study.series.find(s => s.seriesInstanceUID === seriesInstanceUID);
      if (series) return series;
    }
    return null;
  }, [state.studies]);

  const getSeriesByStudy = useCallback((studyInstanceUID: string): DICOMSeries[] => {
    const study = state.studies.find(s => s.studyInstanceUID === studyInstanceUID);
    return study?.series || [];
  }, [state.studies]);

  // Transform legacy series data to study structure
  const transformLegacySeriesData = useCallback((legacySeriesData: any[]): DICOMStudy[] => {
    const studyMap = new Map<string, DICOMStudy>();

    legacySeriesData.forEach((legacySeries, index) => {
      // Generate study ID if not present
      const studyInstanceUID = legacySeries.studyInstanceUID || `generated-study-${index}`;

      if (!studyMap.has(studyInstanceUID)) {
        studyMap.set(studyInstanceUID, {
          studyInstanceUID,
          studyDescription: legacySeries.studyDescription || 'Imported Study',
          studyDate: legacySeries.studyDate || new Date().toISOString().split('T')[0].replace(/-/g, ''),
          studyTime: legacySeries.studyTime || '120000',
          patientName: legacySeries.patientName || 'Unknown Patient',
          patientID: legacySeries.patientID || 'UNKNOWN',
          patientAge: legacySeries.patientAge,
          patientSex: legacySeries.patientSex,
          accessionNumber: legacySeries.accessionNumber,
          institutionName: legacySeries.institutionName,
          series: [],
          color: DEFAULT_STUDY_COLORS[studyMap.size % DEFAULT_STUDY_COLORS.length],
          isActive: false,
          loadingState: 'idle',
        });
      }

      const study = studyMap.get(studyInstanceUID)!;

      // Transform series data
      const dicomSeries: DICOMSeries = {
        seriesInstanceUID: legacySeries.seriesInstanceUID,
        seriesDescription: legacySeries.seriesDescription || 'Unnamed Series',
        modality: legacySeries.modality || 'UN',
        seriesNumber: parseInt(legacySeries.seriesNumber) || undefined,
        numberOfInstances: legacySeries.numberOfImages || legacySeries.numberOfInstances || 0,
        imageIds: legacySeries.imageIds || [],
        metadata: legacySeries.metadata || [],
        studyInstanceUID,
        thumbnailUrl: legacySeries.thumbnail,
        isLoaded: false,
        loadingProgress: 0,
      };

      study.series.push(dicomSeries);
    });

    const studies = Array.from(studyMap.values()).map(study => ({
      ...study,
      numberOfSeries: study.series.length,
      totalImages: study.series.reduce((sum, s) => sum + s.numberOfInstances, 0),
    }));

    return studies;
  }, []);

  // Auto-select first study if none selected and studies available
  useEffect(() => {
    if (state.studies.length > 0 && !state.selectedStudyId) {
      setState(prev => ({
        ...prev,
        selectedStudyId: prev.studies[0].studyInstanceUID,
      }));
    }
  }, [state.studies, state.selectedStudyId]);

  return {
    // State
    studies: state.studies,
    selectedStudyId: state.selectedStudyId,
    selectedSeriesId: state.selectedSeriesId,
    selectedStudy,
    selectedSeries,
    isLoading: state.isLoading,
    error: state.error,

    // Actions
    setStudies,
    selectStudy,
    selectSeries,
    addStudy,
    removeStudy,
    updateStudy,
    clearStudies,
    setLoading,
    setError,

    // Computed values
    allSeries,
    selectedStudySeries,
    studyCount,
    totalSeriesCount,
    totalImageCount,

    // Utilities
    getStudyById,
    getSeriesById,
    getSeriesByStudy,
    transformLegacySeriesData,
  };
};
