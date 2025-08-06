/**
 * useDicomLoader Hook
 * DICOM 파일 로딩 및 관리를 위한 React 훅
 * RealDicomDataService와 UI 상태 관리 통합
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { log } from '../utils/logger';
import { safePropertyAccess } from '../lib/utils';
import {
  RealDicomDataService,
  type DicomStudyInfo,
  type DicomSeriesInfo,
  type DicomLoadOptions,
  type DicomLoadProgress,
} from '@/services/RealDicomDataService';

interface UseDicomLoaderState {
  isLoading: boolean;
  error: string | null;
  loadedStudies: DicomStudyInfo[];
  selectedStudy: DicomStudyInfo | null;
  selectedSeries: DicomSeriesInfo | null;
  loadProgress: DicomLoadProgress | null;
}

interface UseDicomLoaderReturn {
  // 상태
  state: UseDicomLoaderState;

  // 로딩 기능
  loadDicomFile: (file: File, options?: DicomLoadOptions) => Promise<DicomStudyInfo | null>;
  loadDicomFiles: (files: FileList, options?: DicomLoadOptions) => Promise<DicomStudyInfo[]>;
  loadSampleDicom: (options?: DicomLoadOptions) => Promise<DicomStudyInfo | null>;
  loadDicomWebStudy: (
    dicomWebRoot: string,
    studyInstanceUID: string,
    options?: DicomLoadOptions
  ) => Promise<DicomStudyInfo | null>;

  // 선택 기능
  selectStudy: (studyInstanceUID: string) => void;
  selectSeries: (seriesInstanceUID: string) => void;

  // 유틸리티
  clearError: () => void;
  clearStudies: () => void;
  removeStudy: (studyInstanceUID: string) => void;
  getImageIds: (studyInstanceUID: string, seriesInstanceUID: string) => string[];
  getThumbnailImageId: (studyInstanceUID: string, seriesInstanceUID: string) => string | null;
}

export const useDicomLoader = (): UseDicomLoaderReturn => {
  const serviceRef = useRef<RealDicomDataService | null>(null);

  const [state, setState] = useState<UseDicomLoaderState>({
    isLoading: false,
    error: null,
    loadedStudies: [],
    selectedStudy: null,
    selectedSeries: null,
    loadProgress: null,
  });

  // 서비스 초기화
  useEffect(() => {
    serviceRef.current = new RealDicomDataService();

    return () => {
      if (serviceRef.current) {
        serviceRef.current.cleanup();
        serviceRef.current = null;
      }
    };
  }, []);

  // 에러 상태 초기화
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // 단일 DICOM 파일 로딩
  const loadDicomFile = useCallback(
    async (file: File, options: DicomLoadOptions = {}): Promise<DicomStudyInfo | null> => {
      if (!serviceRef.current) {
        setState(prev => ({ ...prev, error: 'DICOM service not initialized' }));
        return null;
      }

      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null,
        loadProgress: {
          studyInstanceUID: '',
          loadedImages: 0,
          totalImages: 1,
          status: 'loading',
        },
      }));

      try {
        const studyInfo = await serviceRef.current.loadDicomFile(file, options);

        setState(prev => ({
          ...prev,
          isLoading: false,
          loadedStudies: [...prev.loadedStudies, studyInfo],
          selectedStudy: studyInfo,
          selectedSeries: studyInfo.series[0] ?? null,
          loadProgress: {
            studyInstanceUID: studyInfo.studyInstanceUID,
            loadedImages: 1,
            totalImages: 1,
            status: 'completed',
          },
        }));

        log.info(`DICOM study loaded: ${studyInfo.studyInstanceUID}`);
        return studyInfo;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: `Failed to load DICOM file: ${errorMessage}`,
          loadProgress: {
            studyInstanceUID: '',
            loadedImages: 0,
            totalImages: 1,
            status: 'error',
            error: errorMessage,
          },
        }));
        console.error('Failed to load DICOM file:', error);
        return null;
      }
    },
    [],
  );

  // 여러 DICOM 파일 로딩
  const loadDicomFiles = useCallback(
    async (files: FileList, options: DicomLoadOptions = {}): Promise<DicomStudyInfo[]> => {
      const loadedStudies: DicomStudyInfo[] = [];

      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null,
        loadProgress: {
          studyInstanceUID: 'batch',
          loadedImages: 0,
          totalImages: files.length,
          status: 'loading',
        },
      }));

      for (let i = 0; i < files.length; i++) {
        const file = safePropertyAccess(files, i);
        if (!file) continue;

        setState(prev => ({
          ...prev,
          loadProgress: {
            studyInstanceUID: 'batch',
            loadedImages: i,
            totalImages: files.length,
            status: 'loading',
            currentImageId: file.name,
          },
        }));

        const study = await loadDicomFile(file, options);
        if (study) {
          loadedStudies.push(study);
        }
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        loadProgress: {
          studyInstanceUID: 'batch',
          loadedImages: files.length,
          totalImages: files.length,
          status: 'completed',
        },
      }));

      log.info(`Loaded ${loadedStudies.length} DICOM studies`);
      return loadedStudies;
    },
    [loadDicomFile],
  );

  // 샘플 DICOM 로딩
  const loadSampleDicom = useCallback(async (options: DicomLoadOptions = {}): Promise<DicomStudyInfo | null> => {
    if (!serviceRef.current) {
      setState(prev => ({ ...prev, error: 'DICOM service not initialized' }));
      return null;
    }

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      loadProgress: {
        studyInstanceUID: 'sample',
        loadedImages: 0,
        totalImages: 1,
        status: 'loading',
      },
    }));

    try {
      const studyInfo = await serviceRef.current.loadSampleDicom(options);

      setState(prev => ({
        ...prev,
        isLoading: false,
        loadedStudies: [...prev.loadedStudies, studyInfo],
        selectedStudy: studyInfo,
        selectedSeries: studyInfo.series[0] ?? null,
        loadProgress: {
          studyInstanceUID: studyInfo.studyInstanceUID,
          loadedImages: 1,
          totalImages: 1,
          status: 'completed',
        },
      }));

      log.info('Sample DICOM loaded successfully');
      return studyInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: `Failed to load sample DICOM: ${errorMessage}`,
        loadProgress: {
          studyInstanceUID: 'sample',
          loadedImages: 0,
          totalImages: 1,
          status: 'error',
          error: errorMessage,
        },
      }));
      console.error('Failed to load sample DICOM:', error);
      return null;
    }
  }, []);

  // DICOM Web 스터디 로딩
  const loadDicomWebStudy = useCallback(
    async (
      dicomWebRoot: string,
      studyInstanceUID: string,
      options: DicomLoadOptions = {},
    ): Promise<DicomStudyInfo | null> => {
      if (!serviceRef.current) {
        setState(prev => ({ ...prev, error: 'DICOM service not initialized' }));
        return null;
      }

      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null,
        loadProgress: {
          studyInstanceUID,
          loadedImages: 0,
          totalImages: 0,
          status: 'loading',
        },
      }));

      try {
        const studyInfo = await serviceRef.current.loadDicomWebStudy(dicomWebRoot, studyInstanceUID, options);

        setState(prev => ({
          ...prev,
          isLoading: false,
          loadedStudies: [...prev.loadedStudies, studyInfo],
          selectedStudy: studyInfo,
          selectedSeries: studyInfo.series[0] ?? null,
          loadProgress: {
            studyInstanceUID: studyInfo.studyInstanceUID,
            loadedImages: studyInfo.series.reduce((sum, s) => sum + s.imageCount, 0),
            totalImages: studyInfo.series.reduce((sum, s) => sum + s.imageCount, 0),
            status: 'completed',
          },
        }));

        log.info(`DICOM Web study loaded: ${studyInfo.studyInstanceUID}`);
        return studyInfo;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: `Failed to load DICOM Web study: ${errorMessage}`,
          loadProgress: {
            studyInstanceUID,
            loadedImages: 0,
            totalImages: 0,
            status: 'error',
            error: errorMessage,
          },
        }));
        console.error('Failed to load DICOM Web study:', error);
        return null;
      }
    },
    [],
  );

  // 스터디 선택
  const selectStudy = useCallback(
    (studyInstanceUID: string) => {
      const study = state.loadedStudies.find(s => s.studyInstanceUID === studyInstanceUID);
      if (study) {
        setState(prev => ({
          ...prev,
          selectedStudy: study,
          selectedSeries: study.series[0] ?? null,
        }));
        log.info(`Selected study: ${studyInstanceUID}`);
      }
    },
    [state.loadedStudies],
  );

  // 시리즈 선택
  const selectSeries = useCallback(
    (seriesInstanceUID: string) => {
      if (!state.selectedStudy) return;

      const series = state.selectedStudy.series.find(s => s.seriesInstanceUID === seriesInstanceUID);
      if (series) {
        setState(prev => ({
          ...prev,
          selectedSeries: series,
        }));
        log.info(`Selected series: ${seriesInstanceUID}`);
      }
    },
    [state.selectedStudy],
  );

  // 모든 스터디 제거
  const clearStudies = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.cleanup();
    }
    setState(prev => ({
      ...prev,
      loadedStudies: [],
      selectedStudy: null,
      selectedSeries: null,
      loadProgress: null,
    }));
    log.info('All studies cleared');
  }, []);

  // 특정 스터디 제거
  const removeStudy = useCallback((studyInstanceUID: string) => {
    setState(prev => {
      const newStudies = prev.loadedStudies.filter(s => s.studyInstanceUID !== studyInstanceUID);
      const wasSelected = prev.selectedStudy?.studyInstanceUID === studyInstanceUID;

      return {
        ...prev,
        loadedStudies: newStudies,
        selectedStudy: wasSelected ? (newStudies[0] ?? null) : prev.selectedStudy,
        selectedSeries: wasSelected ? (newStudies[0]?.series[0] ?? null) : prev.selectedSeries,
      };
    });
    log.info(`Study removed: ${studyInstanceUID}`);
  }, []);

  // 이미지 ID 목록 가져오기
  const getImageIds = useCallback(
    (studyInstanceUID: string, seriesInstanceUID: string): string[] => {
      const study = state.loadedStudies.find(s => s.studyInstanceUID === studyInstanceUID);
      if (!study) return [];

      const series = study.series.find(s => s.seriesInstanceUID === seriesInstanceUID);
      return series?.imageIds ?? [];
    },
    [state.loadedStudies],
  );

  // 섬네일 이미지 ID 가져오기
  const getThumbnailImageId = useCallback(
    (studyInstanceUID: string, seriesInstanceUID: string): string | null => {
      const study = state.loadedStudies.find(s => s.studyInstanceUID === studyInstanceUID);
      if (!study) return null;

      const series = study.series.find(s => s.seriesInstanceUID === seriesInstanceUID);
      return series?.thumbnailImageId ?? null;
    },
    [state.loadedStudies],
  );

  return {
    state,
    loadDicomFile,
    loadDicomFiles,
    loadSampleDicom,
    loadDicomWebStudy,
    selectStudy,
    selectSeries,
    clearError,
    clearStudies,
    removeStudy,
    getImageIds,
    getThumbnailImageId,
  };
};
