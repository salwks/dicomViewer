/**
 * useAnnotationPersistence Hook
 * 주석 저장/불러오기 기능을 위한 React 훅
 * AnnotationPersistenceService와 UI 상태 관리 통합
 */
import { log } from '../utils/logger';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Types } from '@cornerstonejs/tools';
import {
  AnnotationPersistenceService,
  type AnnotationExportOptions,
  type AnnotationImportResult,
  type AnnotationFileInfo,
} from '@/services/Annotation/AnnotationPersistenceService';
import { DicomSrAdapter } from '@/services/Annotation/formatters/DicomSrAdapter';
interface UseAnnotationPersistenceState {
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  lastOperation: 'save' | 'load' | null;
  supportedFormats: Array<{ name: string; extensions: string[] }>;
}

interface UseAnnotationPersistenceReturn {
  // 상태
  state: UseAnnotationPersistenceState;

  // 저장 기능
  saveToFile: (annotations: Types.Annotation[], filename: string, options?: AnnotationExportOptions) => Promise<string>;
  saveWithFormat: (
    annotations: Types.Annotation[],
    format: string,
    options?: AnnotationExportOptions
  ) => Promise<string>;
  downloadAsFile: (
    annotations: Types.Annotation[],
    filename: string,
    options?: AnnotationExportOptions
  ) => Promise<void>;

  // 불러오기 기능
  loadFromFile: (file: File) => Promise<AnnotationImportResult>;
  loadFromContent: (content: string, filename: string) => Promise<AnnotationImportResult>;

  // 분석 기능
  analyzeFile: (file: File) => Promise<AnnotationFileInfo>;

  // 유틸리티
  clearError: () => void;
  getSupportedFormats: () => Array<{ name: string; extensions: string[] }>;
  mergeAnnotations: (existing: Types.Annotation[], imported: Types.Annotation[]) => Types.Annotation[];
  createBackup: (annotations: Types.Annotation[]) => string;
}

export const useAnnotationPersistence = (): UseAnnotationPersistenceReturn => {
  const serviceRef = useRef<AnnotationPersistenceService | null>(null);

  const [state, setState] = useState<UseAnnotationPersistenceState>({
    isLoading: false,
    isSaving: false,
    error: null,
    lastOperation: null,
    supportedFormats: [],
  });

  // 서비스 초기화
  useEffect(() => {
    const service = new AnnotationPersistenceService();

    // 추가 어댑터 등록 (DICOM SR 등)
    service.registerAdapter(new DicomSrAdapter());

    serviceRef.current = service;

    setState(prev => ({
      ...prev,
      supportedFormats: service.getSupportedFormats(),
    }));

    return () => {
      if (serviceRef.current) {
        serviceRef.current.destroy();
        serviceRef.current = null;
      }
    };
  }, []);

  // 에러 상태 초기화
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // 파일로 저장 (확장자로 포맷 자동 감지)
  const saveToFile = useCallback(
    async (
      annotations: Types.Annotation[],
      filename: string,
      options: AnnotationExportOptions = {},
    ): Promise<string> => {
      if (!serviceRef.current) {
        throw new Error('Annotation service not initialized');
      }

      setState(prev => ({ ...prev, isSaving: true, error: null, lastOperation: 'save' }));

      try {
        const result = serviceRef.current.saveToFile(annotations, filename, options);

        setState(prev => ({ ...prev, isSaving: false }));
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState(prev => ({
          ...prev,
          isSaving: false,
          error: `저장 실패: ${errorMessage}`,
        }));
        throw error;
      }
    },
    [],
  );

  // 특정 포맷으로 저장
  const saveWithFormat = useCallback(
    async (annotations: Types.Annotation[], format: string, options: AnnotationExportOptions = {}): Promise<string> => {
      if (!serviceRef.current) {
        throw new Error('Annotation service not initialized');
      }

      setState(prev => ({ ...prev, isSaving: true, error: null, lastOperation: 'save' }));

      try {
        const result = serviceRef.current.saveWithFormat(annotations, format, options);

        setState(prev => ({ ...prev, isSaving: false }));
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState(prev => ({
          ...prev,
          isSaving: false,
          error: `저장 실패: ${errorMessage}`,
        }));
        throw error;
      }
    },
    [],
  );

  // 파일 다운로드
  const downloadAsFile = useCallback(
    async (annotations: Types.Annotation[], filename: string, options: AnnotationExportOptions = {}): Promise<void> => {
      try {
        const content = await saveToFile(annotations, filename, options);

        // Blob 생성 및 다운로드
        const blob = new Blob([content], {
          type: filename.endsWith('.xml') || filename.endsWith('.sr') ? 'application/xml' : 'application/json',
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);

        log.info(`파일이 다운로드되었습니다: ${filename}`);
      } catch (error) {
        console.error('파일 다운로드 실패:', error);
        throw error;
      }
    },
    [saveToFile],
  );

  // 파일에서 불러오기
  const loadFromFile = useCallback(async (file: File): Promise<AnnotationImportResult> => {
    if (!serviceRef.current) {
      throw new Error('Annotation service not initialized');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null, lastOperation: 'load' }));

    try {
      const content = await readFileAsText(file);
      const result = serviceRef.current.loadFromFile(content, file.name);

      setState(prev => ({ ...prev, isLoading: false }));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: `불러오기 실패: ${errorMessage}`,
      }));
      throw error;
    }
  }, []);

  // 문자열 콘텐츠에서 불러오기
  const loadFromContent = useCallback(async (content: string, filename: string): Promise<AnnotationImportResult> => {
    if (!serviceRef.current) {
      throw new Error('Annotation service not initialized');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null, lastOperation: 'load' }));

    try {
      const result = serviceRef.current.loadFromFile(content, filename);

      setState(prev => ({ ...prev, isLoading: false }));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: `불러오기 실패: ${errorMessage}`,
      }));
      throw error;
    }
  }, []);

  // 파일 분석
  const analyzeFile = useCallback(async (file: File): Promise<AnnotationFileInfo> => {
    if (!serviceRef.current) {
      throw new Error('Annotation service not initialized');
    }

    try {
      const content = await readFileAsText(file);
      return serviceRef.current.analyzeFile(content, file.name);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: `파일 분석 실패: ${errorMessage}` }));
      throw error;
    }
  }, []);

  // 지원하는 포맷 목록 반환
  const getSupportedFormats = useCallback(() => {
    return serviceRef.current?.getSupportedFormats() ?? [];
  }, []);

  // 주석 병합
  const mergeAnnotations = useCallback(
    (existing: Types.Annotation[], imported: Types.Annotation[]): Types.Annotation[] => {
      return serviceRef.current?.mergeAnnotations(existing, imported) ?? existing;
    },
    [],
  );

  // 백업 생성
  const createBackup = useCallback((annotations: Types.Annotation[]): string => {
    return serviceRef.current?.createBackup(annotations) ?? '';
  }, []);

  return {
    state,
    saveToFile,
    saveWithFormat,
    downloadAsFile,
    loadFromFile,
    loadFromContent,
    analyzeFile,
    clearError,
    getSupportedFormats,
    mergeAnnotations,
    createBackup,
  };
};

/**
 * 파일을 텍스트로 읽기
 */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = event => {
      const result = event.target?.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('파일을 텍스트로 읽을 수 없습니다.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('파일 읽기 실패'));
    };

    reader.readAsText(file);
  });
}
