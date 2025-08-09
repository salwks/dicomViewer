/**
 * ComparisonModeManager - 비교 모드 핵심 기능 관리
 * Cornerstone3D 동기화, 교차참조선, 동기화 제어 UI 통합 관리
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { useViewer, useViewerLayout, useSynchronization } from '../context/ViewerContext';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { cn, safePropertyAccess } from '../lib/utils';
import { log } from '../utils/logger';

// Cornerstone3D 동기화 매니저 (Mock)
interface SynchronizerManager {
  createSynchronizer: (type: string) => any;
  addViewportsToSynchronizer: (synchronizer: any, viewportIds: string[]) => void;
  removeSynchronizer: (synchronizer: any) => void;
}

// Mock Cornerstone3D API
const mockSynchronizerManager: SynchronizerManager = {
  createSynchronizer: (type: string) => {
    log.info('Creating synchronizer', {
      component: 'ComparisonModeManager',
      metadata: { type },
    });
    return { type, id: Math.random().toString(36).substr(2, 9) };
  },
  addViewportsToSynchronizer: (synchronizer: any, viewportIds: string[]) => {
    log.info('Adding viewports to synchronizer', {
      component: 'ComparisonModeManager',
      metadata: { synchronizer, viewportIds },
    });
  },
  removeSynchronizer: (synchronizer: any) => {
    log.info('Removing synchronizer', {
      component: 'ComparisonModeManager',
      metadata: { synchronizer },
    });
  },
};

interface ComparisonModeManagerProps {
  className?: string;
}

export const ComparisonModeManager: React.FC<ComparisonModeManagerProps> = ({ className }) => {
  const { state } = useViewer();
  const { synchronization, toggleSynchronization } = useSynchronization();

  // 동기화 인스턴스 참조
  const synchronizersRef = useRef<{
    camera?: any;
    slice?: any;
    windowLevel?: any;
  }>({});

  const layout = useViewerLayout();

  // 비교 모드 활성화 여부 (다중 뷰포트 기반)
  const isComparisonMode = layout.rows > 1 || layout.cols > 1;

  // 비교 가능한 뷰포트 (2개 이상의 뷰포트가 있을 때)
  const comparisonViewports = state.viewports.filter(v => v.studyInstanceUID);
  const canCompare = comparisonViewports.length >= 2;

  // 동기화 매니저 활성화/비활성화
  const setupSynchronizers = useCallback(() => {
    if (!isComparisonMode || !synchronization.enabled || !canCompare) {
      return;
    }

    const viewportIds = comparisonViewports.map(v => v.id);

    // 카메라 동기화 설정
    if (synchronization.types.camera && !synchronizersRef.current.camera) {
      synchronizersRef.current.camera = mockSynchronizerManager.createSynchronizer('camera');
      mockSynchronizerManager.addViewportsToSynchronizer(synchronizersRef.current.camera, viewportIds);

      log.info('Camera synchronization activated', {
        component: 'ComparisonModeManager',
        metadata: { viewportIds },
      });
    }

    // 슬라이스 동기화 설정
    if (synchronization.types.slice && !synchronizersRef.current.slice) {
      synchronizersRef.current.slice = mockSynchronizerManager.createSynchronizer('slice');
      mockSynchronizerManager.addViewportsToSynchronizer(synchronizersRef.current.slice, viewportIds);

      log.info('Slice synchronization activated', {
        component: 'ComparisonModeManager',
        metadata: { viewportIds },
      });
    }

    // Window/Level 동기화 설정
    if (synchronization.types.windowLevel && !synchronizersRef.current.windowLevel) {
      synchronizersRef.current.windowLevel = mockSynchronizerManager.createSynchronizer('windowLevel');
      mockSynchronizerManager.addViewportsToSynchronizer(synchronizersRef.current.windowLevel, viewportIds);

      log.info('Window/Level synchronization activated', {
        component: 'ComparisonModeManager',
        metadata: { viewportIds },
      });
    }
  }, [isComparisonMode, synchronization, canCompare, comparisonViewports]);

  // 동기화 매니저 정리
  const cleanupSynchronizers = useCallback(() => {
    Object.values(synchronizersRef.current).forEach(synchronizer => {
      if (synchronizer) {
        mockSynchronizerManager.removeSynchronizer(synchronizer);
      }
    });

    synchronizersRef.current = {};

    log.info('All synchronizers cleaned up', {
      component: 'ComparisonModeManager',
    });
  }, []);

  // 교차 참조선 활성화/비활성화
  const setupCrossReferenceLines = useCallback(() => {
    if (!isComparisonMode || !synchronization.enabled || !canCompare) {
      return;
    }

    // TODO: 실제 ReferenceLineTool 활성화
    // const { addTool, setToolActive } = cornerstoneTools;
    // addTool(ReferenceLinesTool);
    // setToolActive('ReferenceLines', { mouseButtonMask: 1 });

    log.info('Cross-reference lines activated', {
      component: 'ComparisonModeManager',
      metadata: { viewportCount: comparisonViewports.length },
    });
  }, [isComparisonMode, synchronization.enabled, canCompare, comparisonViewports.length]);

  // 비교 모드 활성화 시 동기화 설정
  useEffect(() => {
    if (isComparisonMode && synchronization.enabled) {
      setupSynchronizers();
      setupCrossReferenceLines();
    } else {
      cleanupSynchronizers();
    }

    return cleanupSynchronizers;
  }, [isComparisonMode, synchronization.enabled, setupSynchronizers, setupCrossReferenceLines, cleanupSynchronizers]);

  // 동기화 타입별 토글 핸들러
  const handleSyncToggle = useCallback(
    (type: keyof typeof synchronization.types) => {
      toggleSynchronization(type);

      // 특정 동기화만 비활성화하는 경우 - 보안 강화된 접근
      const allowedTypes = ['camera', 'slice', 'windowLevel'] as const;
      if (allowedTypes.includes(type as (typeof allowedTypes)[number])) {
        const synchronizer = safePropertyAccess(synchronizersRef.current, type);
        if (synchronizer) {
          mockSynchronizerManager.removeSynchronizer(synchronizer);
          // 안전한 속성 설정
          if (type === 'camera') {
            synchronizersRef.current.camera = undefined;
          } else if (type === 'slice') {
            synchronizersRef.current.slice = undefined;
          } else if (type === 'windowLevel') {
            synchronizersRef.current.windowLevel = undefined;
          }
        }
      }
    },
    [toggleSynchronization, synchronization],
  );

  // 비교 모드가 아니면 렌더링하지 않음
  if (!isComparisonMode) {
    return null;
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardContent className='p-4'>
        <div className='space-y-4'>
          {/* 비교 모드 상태 헤더 */}
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-2'>
              <Badge variant='default' className='text-xs'>
                비교 모드
              </Badge>
              <Badge variant={canCompare ? 'default' : 'secondary'} className='text-xs'>
                {comparisonViewports.length}개 스터디
              </Badge>
            </div>

            <div className='flex items-center space-x-2'>
              <span className='text-sm text-muted-foreground'>동기화</span>
              <Switch
                checked={synchronization.enabled}
                onCheckedChange={() => toggleSynchronization()}
                disabled={!canCompare}
              />
            </div>
          </div>

          {!canCompare && (
            <div className='text-sm text-muted-foreground bg-muted/30 p-3 rounded-md'>
              💡 비교를 위해 2개 이상의 스터디를 로드해주세요.
            </div>
          )}

          {synchronization.enabled && canCompare && (
            <>
              <Separator />

              {/* 동기화 제어 옵션 */}
              <div className='space-y-3'>
                <h4 className='text-sm font-medium'>동기화 옵션</h4>

                <div className='grid grid-cols-1 gap-3'>
                  {/* 카메라 동기화 (Zoom/Pan) */}
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center space-x-2'>
                      <span className='text-sm'>🔍 카메라 (줌/팬)</span>
                    </div>
                    <Switch checked={synchronization.types.camera} onCheckedChange={() => handleSyncToggle('camera')} />
                  </div>

                  {/* 슬라이스 동기화 */}
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center space-x-2'>
                      <span className='text-sm'>📄 슬라이스 스크롤</span>
                    </div>
                    <Switch checked={synchronization.types.slice} onCheckedChange={() => handleSyncToggle('slice')} />
                  </div>

                  {/* Window/Level 동기화 */}
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center space-x-2'>
                      <span className='text-sm'>🌓 윈도우/레벨</span>
                    </div>
                    <Switch
                      checked={synchronization.types.windowLevel}
                      onCheckedChange={() => handleSyncToggle('windowLevel')}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* 동기화 상태 정보 */}
              <div className='space-y-2'>
                <h4 className='text-sm font-medium'>활성 동기화</h4>
                <div className='flex flex-wrap gap-2'>
                  {synchronization.types.camera && (
                    <Badge variant='outline' className='text-xs'>
                      카메라
                    </Badge>
                  )}
                  {synchronization.types.slice && (
                    <Badge variant='outline' className='text-xs'>
                      슬라이스
                    </Badge>
                  )}
                  {synchronization.types.windowLevel && (
                    <Badge variant='outline' className='text-xs'>
                      윈도우/레벨
                    </Badge>
                  )}
                  {!Object.values(synchronization.types).some(Boolean) && (
                    <span className='text-xs text-muted-foreground'>동기화 비활성화</span>
                  )}
                </div>
              </div>

              {/* 교차 참조선 상태 */}
              <div className='text-xs text-muted-foreground bg-muted/20 p-2 rounded'>
                📍 교차 참조선이 활성화되어 있습니다. 뷰포트 간의 해부학적 위치가 연결됩니다.
              </div>
            </>
          )}

          {/* 빠른 액션 버튼들 */}
          <div className='flex space-x-2'>
            <Button variant='outline' size='sm' onClick={() => toggleSynchronization()} disabled={!canCompare}>
              {synchronization.enabled ? '동기화 해제' : '전체 동기화'}
            </Button>

            {synchronization.enabled && (
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  // 모든 동기화 타입 활성화
                  Object.keys(synchronization.types).forEach(type => {
                    if (!synchronization.types[type as keyof typeof synchronization.types]) {
                      handleSyncToggle(type as keyof typeof synchronization.types);
                    }
                  });
                }}
              >
                모든 동기화 켜기
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
