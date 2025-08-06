/**
 * useCrossReference Hook
 * 교차 참조선 관리를 위한 커스텀 훅
 * CrossReferenceManager와 React 상태 연결
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CrossReferenceManager,
  CrossReferenceFactory,
  type CrossReferenceViewport,
} from '@/services/CrossReferenceManager';
import type { CrossReferenceConfig, CrossReferencePosition } from '@/components/CrossReferenceLines';
import type { ViewportReference } from '@/services/ViewportSynchronizer';

interface UseCrossReferenceReturn {
  config: CrossReferenceConfig;
  setConfig: (config: CrossReferenceConfig) => void;
  currentPosition: CrossReferencePosition | null;
  setCurrentPosition: (position: CrossReferencePosition | null) => void;
  addViewport: (viewportRef: ViewportReference, orientation: 'axial' | 'sagittal' | 'coronal') => void;
  removeViewport: (viewportId: string) => void;
  clearAllViewports: () => void;
  handleViewportClick: (viewportId: string, clickPosition: [number, number]) => void;
  registeredViewports: CrossReferenceViewport[];
  isEnabled: boolean;
  manager: CrossReferenceManager | null;
}

const DEFAULT_CONFIG: CrossReferenceConfig = {
  enabled: false,
  showAxialLines: true,
  showSagittalLines: true,
  showCoronalLines: true,
  lineWidth: 2,
  lineOpacity: 0.8,
  axialColor: '#ff6b6b',
  sagittalColor: '#4ecdc4',
  coronalColor: '#45b7d1',
  interactive: true,
  autoUpdate: true,
};

export const useCrossReference = (managerId = 'default-cross-reference'): UseCrossReferenceReturn => {
  const [config, setConfigState] = useState<CrossReferenceConfig>(DEFAULT_CONFIG);
  const [currentPosition, setCurrentPositionState] = useState<CrossReferencePosition | null>(null);
  const [registeredViewports, setRegisteredViewports] = useState<CrossReferenceViewport[]>([]);

  const managerRef = useRef<CrossReferenceManager | null>(null);

  // CrossReferenceManager 초기화
  useEffect(() => {
    const manager = CrossReferenceFactory.createManager(managerId, config);
    managerRef.current = manager;

    return () => {
      // 컴포넌트 언마운트 시 정리하지 않음 - 팩토리에서 관리
    };
  }, [managerId, config]);

  // 설정 변경 핸들러
  const setConfig = useCallback((newConfig: CrossReferenceConfig) => {
    setConfigState(newConfig);

    if (managerRef.current) {
      managerRef.current.updateConfig(newConfig);
      managerRef.current.setEnabled(newConfig.enabled);
    }
  }, []);

  // 현재 위치 변경 핸들러
  const setCurrentPosition = useCallback((position: CrossReferencePosition | null) => {
    setCurrentPositionState(position);

    if (managerRef.current && position) {
      managerRef.current.updatePosition(position);
    }
  }, []);

  // 뷰포트 추가
  const addViewport = useCallback((viewportRef: ViewportReference, orientation: 'axial' | 'sagittal' | 'coronal') => {
    if (managerRef.current) {
      managerRef.current.addViewport(viewportRef, orientation);

      // 등록된 뷰포트 목록 업데이트
      const viewports = managerRef.current.getViewports();
      setRegisteredViewports([...viewports]);
    }
  }, []);

  // 뷰포트 제거
  const removeViewport = useCallback((viewportId: string) => {
    if (managerRef.current) {
      managerRef.current.removeViewport(viewportId);

      // 등록된 뷰포트 목록 업데이트
      const viewports = managerRef.current.getViewports();
      setRegisteredViewports([...viewports]);
    }
  }, []);

  // 모든 뷰포트 제거
  const clearAllViewports = useCallback(() => {
    if (managerRef.current) {
      const currentViewports = managerRef.current.getViewports();
      currentViewports.forEach(viewport => {
        managerRef.current?.removeViewport(viewport.viewportId);
      });
      setRegisteredViewports([]);
    }
  }, []);

  // 뷰포트 클릭 핸들러
  const handleViewportClick = useCallback((viewportId: string, clickPosition: [number, number]) => {
    if (managerRef.current) {
      managerRef.current.handleViewportClick(viewportId, clickPosition);
    }
  }, []);

  // 설정 변경 시 매니저 업데이트
  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.updateConfig(config);
      managerRef.current.setEnabled(config.enabled);
    }
  }, [config]);

  return {
    config,
    setConfig,
    currentPosition,
    setCurrentPosition,
    addViewport,
    removeViewport,
    clearAllViewports,
    handleViewportClick,
    registeredViewports,
    isEnabled: config.enabled,
    manager: managerRef.current,
  };
};

/**
 * 다중 뷰포트 교차 참조를 위한 간편 훅
 */
export const useMultiViewportCrossReference = (
  viewportRefs: Array<{
    ref: ViewportReference;
    orientation: 'axial' | 'sagittal' | 'coronal';
  }>,
) => {
  const crossRef = useCrossReference('multi-viewport-cross-ref');

  // 뷰포트 자동 등록
  useEffect(() => {
    // 기존 뷰포트 모두 제거
    crossRef.clearAllViewports();

    // 새 뷰포트들 등록
    viewportRefs.forEach(({ ref, orientation }) => {
      crossRef.addViewport(ref, orientation);
    });
  }, [viewportRefs, crossRef]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      crossRef.clearAllViewports();
    };
  }, [crossRef]);

  return crossRef;
};

/**
 * 표준 3평면 뷰 (Axial, Sagittal, Coronal) 교차 참조
 */
export const useTriPlanarCrossReference = (
  axialViewport?: ViewportReference,
  sagittalViewport?: ViewportReference,
  coronalViewport?: ViewportReference,
) => {
  const viewportRefs = [
    axialViewport && { ref: axialViewport, orientation: 'axial' as const },
    sagittalViewport && { ref: sagittalViewport, orientation: 'sagittal' as const },
    coronalViewport && { ref: coronalViewport, orientation: 'coronal' as const },
  ].filter((item): item is NonNullable<typeof item> => item !== undefined);

  return useMultiViewportCrossReference(viewportRefs);
};
