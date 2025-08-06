/**
 * useAdvancedViewer Hook
 * 3D 볼륨 렌더링 및 MPR 기능을 위한 커스텀 훅
 * VolumeRenderingService와 MPRService 통합 관리
 */
import { log } from '../utils/logger';

import { useState, useEffect, useCallback, useRef } from 'react';
import { VolumeRenderingService } from '@/services/VolumeRenderingService';
import { MPRService } from '@/services/MPRService';
import type { VolumeRenderingConfig, MPRConfig } from '@/types/viewer';

interface UseAdvancedViewerProps {
  renderingEngineId?: string;
  volumeId?: string;
  imageIds?: string[];
}

interface UseAdvancedViewerReturn {
  // 볼륨 렌더링
  volumeService: VolumeRenderingService | null;
  volumeConfig: VolumeRenderingConfig;
  setVolumeConfig: (config: VolumeRenderingConfig) => void;
  isVolumeLoading: boolean;
  volumeProgress: number;

  // MPR
  mprService: MPRService | null;
  mprConfig: MPRConfig;
  setMPRConfig: (config: MPRConfig) => void;

  // 뷰포트 관리
  createVolumeViewport: (viewportId: string, element: HTMLElement) => Promise<void>;
  createMPRViewports: (
    viewports: Array<{
      viewportId: string;
      element: HTMLElement;
      orientation: 'axial' | 'sagittal' | 'coronal';
    }>
  ) => Promise<void>;
  removeViewport: (viewportId: string) => void;

  // 데이터 로딩
  loadVolumeData: (volumeId: string, imageIds: string[]) => Promise<void>;

  // 상태
  isInitialized: boolean;
  error: string | null;
}

const DEFAULT_VOLUME_CONFIG: VolumeRenderingConfig = {
  enabled: false,
  preset: 'ct-bone',
  opacity: 0.8,
  ambient: 0.2,
  diffuse: 0.8,
  specular: 0.3,
  specularPower: 20,
  shade: true,
  colorMap: 'rainbow',
  windowLevel: { window: 1500, level: 300 },
};

const DEFAULT_MPR_CONFIG: MPRConfig = {
  enabled: false,
  axialVisible: true,
  sagittalVisible: true,
  coronalVisible: true,
  thickness: 1.0,
  blendMode: 'maximum',
};

export const useAdvancedViewer = ({
  renderingEngineId = 'advancedViewer',
  volumeId,
  imageIds = [],
}: UseAdvancedViewerProps = {}): UseAdvancedViewerReturn => {
  // 서비스 인스턴스
  const volumeServiceRef = useRef<VolumeRenderingService | null>(null);
  const mprServiceRef = useRef<MPRService | null>(null);

  // 상태 관리
  const [volumeConfig, setVolumeConfigState] = useState<VolumeRenderingConfig>(DEFAULT_VOLUME_CONFIG);
  const [mprConfig, setMPRConfigState] = useState<MPRConfig>(DEFAULT_MPR_CONFIG);
  const [isVolumeLoading, setIsVolumeLoading] = useState(false);
  const [volumeProgress, setVolumeProgress] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 서비스 초기화
  useEffect(() => {
    const initializeServices = async (): Promise<void> => {
      try {
        setError(null);

        // VolumeRenderingService 초기화
        volumeServiceRef.current = new VolumeRenderingService(`${renderingEngineId}-volume`);

        // MPRService 초기화
        mprServiceRef.current = new MPRService(`${renderingEngineId}-mpr`);

        setIsInitialized(true);
        log.info('Advanced viewer services initialized');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to initialize advanced viewer: ${errorMessage}`);
        console.error('Failed to initialize advanced viewer services:', err);
      }
    };

    initializeServices().catch(console.error);

    // 정리 함수
    return () => {
      if (volumeServiceRef.current) {
        volumeServiceRef.current.destroy();
        volumeServiceRef.current = null;
      }
      if (mprServiceRef.current) {
        mprServiceRef.current.destroy();
        mprServiceRef.current = null;
      }
      setIsInitialized(false);
    };
  }, [renderingEngineId]);

  // 볼륨 설정 변경 핸들러
  const setVolumeConfig = useCallback(
    async (config: VolumeRenderingConfig) => {
      setVolumeConfigState(config);

      if (volumeServiceRef.current && isInitialized) {
        try {
          // 모든 볼륨 뷰포트에 설정 적용
          const viewports = volumeServiceRef.current.getViewports();

          for (const viewport of viewports) {
            await volumeServiceRef.current.applyVolumeConfig(viewport.viewportId, config);
          }

          log.info('Volume config updated:', config);
        } catch (err) {
          console.error('Failed to apply volume config:', err);
          setError(`Failed to apply volume config: ${err}`);
        }
      }
    },
    [isInitialized],
  );

  // MPR 설정 변경 핸들러
  const setMPRConfig = useCallback(
    async (config: MPRConfig) => {
      setMPRConfigState(config);

      if (mprServiceRef.current && isInitialized) {
        try {
          await mprServiceRef.current.applyMPRConfig(config);
          log.info('MPR config updated:', config);
        } catch (err) {
          console.error('Failed to apply MPR config:', err);
          setError(`Failed to apply MPR config: ${err}`);
        }
      }
    },
    [isInitialized],
  );

  // 볼륨 뷰포트 생성
  const createVolumeViewport = useCallback(
    async (viewportId: string, element: HTMLElement) => {
      if (!volumeServiceRef.current || !isInitialized) {
        throw new Error('Volume service not initialized');
      }

      try {
        await volumeServiceRef.current.createVolumeViewport(viewportId, element, volumeConfig);

        // 볼륨 데이터가 있다면 설정
        if (volumeId && imageIds.length > 0) {
          await volumeServiceRef.current.loadVolumeData(volumeId, imageIds);
          await volumeServiceRef.current.setVolumesForViewport(viewportId, [volumeId]);
        }

        log.info(`Volume viewport created: ${viewportId}`);
      } catch (err) {
        console.error(`Failed to create volume viewport ${viewportId}:`, err);
        setError(`Failed to create volume viewport: ${err}`);
      }
    },
    [volumeConfig, volumeId, imageIds, isInitialized],
  );

  // MPR 뷰포트들 생성
  const createMPRViewports = useCallback(
    async (
      viewports: Array<{
        viewportId: string;
        element: HTMLElement;
        orientation: 'axial' | 'sagittal' | 'coronal';
      }>,
    ) => {
      if (!mprServiceRef.current || !isInitialized) {
        throw new Error('MPR service not initialized');
      }

      try {
        // 각 뷰포트 생성
        for (const viewport of viewports) {
          await mprServiceRef.current.createMPRViewport(
            viewport.viewportId,
            viewport.element,
            viewport.orientation,
            mprConfig,
          );
        }

        // 볼륨 데이터 설정
        if (volumeId) {
          await mprServiceRef.current.setVolumeForMPR(volumeId);
        }

        log.info(`MPR viewports created: ${viewports.map(v => v.viewportId).join(', ')}`);
      } catch (err) {
        console.error('Failed to create MPR viewports:', err);
        setError(`Failed to create MPR viewports: ${err}`);
      }
    },
    [mprConfig, volumeId, isInitialized],
  );

  // 뷰포트 제거
  const removeViewport = useCallback((viewportId: string) => {
    if (volumeServiceRef.current) {
      volumeServiceRef.current.removeViewport(viewportId);
    }
    if (mprServiceRef.current) {
      mprServiceRef.current.removeViewport(viewportId);
    }
    log.info(`Viewport removed: ${viewportId}`);
  }, []);

  // 볼륨 데이터 로딩
  const loadVolumeData = useCallback(
    async (newVolumeId: string, newImageIds: string[]) => {
      if (!volumeServiceRef.current || !isInitialized) {
        throw new Error('Volume service not initialized');
      }

      try {
        setIsVolumeLoading(true);
        setVolumeProgress(0);
        setError(null);

        // 진행률 시뮬레이션
        const progressInterval = setInterval(() => {
          setVolumeProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return prev;
            }
            return prev + 10;
          });
        }, 200);

        // 볼륨 데이터 로드
        await volumeServiceRef.current.loadVolumeData(newVolumeId, newImageIds);

        // MPR 서비스에도 볼륨 설정
        if (mprServiceRef.current) {
          await mprServiceRef.current.setVolumeForMPR(newVolumeId);
        }

        clearInterval(progressInterval);
        setVolumeProgress(100);

        log.info(`Volume data loaded: ${newVolumeId}`);
      } catch (err) {
        console.error(`Failed to load volume data ${newVolumeId}:`, err);
        setError(`Failed to load volume data: ${err}`);
      } finally {
        setIsVolumeLoading(false);

        // 진행률 초기화 (3초 후)
        setTimeout(() => {
          setVolumeProgress(0);
        }, 3000);
      }
    },
    [isInitialized],
  );

  // 초기 볼륨 데이터 로딩
  useEffect(() => {
    if (isInitialized && volumeId && imageIds.length > 0) {
      loadVolumeData(volumeId, imageIds).catch(console.error);
    }
  }, [isInitialized, volumeId, imageIds, loadVolumeData]);

  return {
    // 볼륨 렌더링
    volumeService: volumeServiceRef.current,
    volumeConfig,
    setVolumeConfig,
    isVolumeLoading,
    volumeProgress,

    // MPR
    mprService: mprServiceRef.current,
    mprConfig,
    setMPRConfig,

    // 뷰포트 관리
    createVolumeViewport,
    createMPRViewports,
    removeViewport,

    // 데이터 로딩
    loadVolumeData,

    // 상태
    isInitialized,
    error,
  };
};
