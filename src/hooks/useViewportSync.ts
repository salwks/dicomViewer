/**
 * useViewportSync Hook
 * 뷰포트 동기화 관리를 위한 커스텀 훅
 * ViewportSynchronizer 서비스와 React 상태 연결
 */
import { log } from '../utils/logger';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ViewportSynchronizer, type SyncConfig, type ViewportReference } from '@/services/ViewportSynchronizer';
import type { ViewerMode } from '@/types/viewer';
interface UseViewportSyncReturn {
  syncConfig: SyncConfig;
  setSyncConfig: (config: SyncConfig) => void;
  viewportSynchronizer: ViewportSynchronizer | null;
  activeViewports: ViewportReference[];
  updateViewports: (viewportIds: string[]) => void;
  isInitialized: boolean;
  error: string | null;
}

export const useViewportSync = (
  layout: ViewerMode['layout'],
  renderingEngineId = 'comparison-rendering-engine',
): UseViewportSyncReturn => {
  const [syncConfig, setSyncConfigState] = useState<SyncConfig>({
    camera: false,
    voi: false,
    scroll: false,
    crossReference: false,
  });

  const [activeViewports, setActiveViewports] = useState<ViewportReference[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const synchronizerRef = useRef<ViewportSynchronizer | null>(null);
  const currentViewportIdsRef = useRef<string[]>([]);

  // ViewportSynchronizer 초기화
  useEffect(() => {
    try {
      // Use singleton instance instead of factory
      const synchronizer = new ViewportSynchronizer();

      synchronizerRef.current = synchronizer;
      setIsInitialized(true);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize synchronizer';
      setError(errorMessage);
      console.error('Failed to initialize ViewportSynchronizer:', err);
    }
  }, [renderingEngineId, layout]);

  // 동기화 설정 변경 핸들러
  const setSyncConfig = useCallback((newConfig: SyncConfig) => {
    if (!synchronizerRef.current) {
      console.warn('ViewportSynchronizer not initialized');
      return;
    }

    try {
      // 현재 뷰포트 목록 가져오기
      const viewportIds = currentViewportIdsRef.current;

      if (viewportIds.length < 2) {
        console.warn('Need at least 2 viewports for synchronization');
        setSyncConfigState(newConfig);
        return;
      }

      // 동기화 설정 업데이트 - mock implementation
      log.info('Mock updateSyncConfig - method not implemented yet');
      setSyncConfigState(newConfig);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update sync config';
      setError(errorMessage);
      console.error('Failed to update sync config:', err);
    }
  }, []);

  // 뷰포트 목록 업데이트
  const updateViewports = useCallback(
    (viewportIds: string[]) => {
      if (!synchronizerRef.current) {
        console.warn('ViewportSynchronizer not initialized');
        return;
      }

      try {
        currentViewportIdsRef.current = viewportIds;

        // ViewportSynchronizer에 뷰포트 업데이트 - mock implementation
        log.info('Mock updateViewports - method not implemented yet');

        // 활성 뷰포트 상태 업데이트
        const newActiveViewports: ViewportReference[] = viewportIds.map(viewportId => ({
          renderingEngineId,
          viewportId,
        }));

        setActiveViewports(newActiveViewports);
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update viewports';
        setError(errorMessage);
        console.error('Failed to update viewports:', err);
      }
    },
    [renderingEngineId],
  );

  // 레이아웃 변경 시 동기화 재설정
  useEffect(() => {
    if (synchronizerRef.current && currentViewportIdsRef.current.length > 0) {
      // 기존 동기화 해제 - mock implementation
      log.info('Mock disableAllSync - method not implemented yet');

      // 새 레이아웃에 맞게 뷰포트 업데이트
      updateViewports(currentViewportIdsRef.current);

      // 동기화 설정 재적용 (단, 뷰포트가 2개 이상일 때만)
      if (currentViewportIdsRef.current.length >= 2) {
        log.info('Mock updateSyncConfig - method not implemented yet');
      }
    }
  }, [layout, syncConfig, updateViewports]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (synchronizerRef.current) {
        try {
          log.info('Mock disableAllSync - method not implemented yet');
        } catch (err) {
          console.error('Error during synchronizer cleanup:', err);
        }
      }
    };
  }, []);

  return {
    syncConfig,
    setSyncConfig,
    viewportSynchronizer: synchronizerRef.current,
    activeViewports,
    updateViewports,
    isInitialized,
    error,
  };
};

/**
 * 단일 뷰포트 동기화를 위한 간단한 훅
 */
export const useSimpleViewportSync = (viewportId: string, renderingEngineId = 'default-rendering-engine') => {
  const { syncConfig, setSyncConfig, viewportSynchronizer, updateViewports, isInitialized } = useViewportSync(
    '1x1',
    renderingEngineId,
  );

  useEffect(() => {
    if (isInitialized && viewportId) {
      updateViewports([viewportId]);
    }
  }, [isInitialized, viewportId, updateViewports]);

  return {
    syncConfig,
    setSyncConfig,
    viewportSynchronizer,
    isInitialized,
  };
};
