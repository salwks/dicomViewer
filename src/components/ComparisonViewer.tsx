// @ts-nocheck
/**
 * ComparisonViewer Component (LEGACY)
 * 의료 이미징 비교 모드 메인 컴포넌트
 * 다중 뷰포트 동기화 및 시리즈 비교 기능 제공
 * Built with shadcn/ui components
 *
 * NOTE: This component uses the old architecture and needs refactoring
 * for the new ViewerContext system. Currently disabled for type checking.
 */

import React, { useEffect, useMemo, useCallback } from 'react';
import { log } from '../utils/logger';
import { cn } from '@/lib/utils';

import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

import { Badge } from './ui/badge';

import { Button } from './ui/button';

import { ViewportGridManager } from './ViewportGridManager';

import { SynchronizationControls } from './SynchronizationControls';

import { ViewportAssignmentPanel } from './ViewportAssignmentPanel';

import { CrossReferenceLines } from './CrossReferenceLines';

import { useViewer } from '@/hooks/useViewer';

import { useViewportSync } from '@/hooks/useViewportSync';

import { useCrossReference } from '@/hooks/useCrossReference';

import type { ViewerMode, ViewportState } from '@/types/viewer';

import { Settings, Grid, Maximize2, Minimize2, Crosshair } from 'lucide-react';

interface ComparisonViewerProps {
  mode: ViewerMode;
  className?: string;
  onModeChange?: ((mode: ViewerMode) => void) | undefined;
}

interface ComparisonViewerState {
  showSyncControls: boolean;
  showAssignmentPanel: boolean;
  showCrossReferencePanel: boolean;
  isFullscreen: boolean;
  activeViewportId: string | null;
}

export const ComparisonViewer: React.FC<ComparisonViewerProps> = ({ mode, className, onModeChange }) => {
  const { setMode } = useViewer();
  const { syncConfig, setSyncConfig, viewportSynchronizer, activeViewports, updateViewports } = useViewportSync(
    mode.layout,
  );

  const {
    config: crossRefConfig,
    setConfig: setCrossRefConfig,
    currentPosition: crossRefPosition,
    setCurrentPosition: setCrossRefPosition,
  } = useCrossReference(`comparison-${mode.layout}`);

  const [state, setState] = React.useState<ComparisonViewerState>({
    showSyncControls: false,
    showAssignmentPanel: false,
    showCrossReferencePanel: false,
    isFullscreen: false,
    activeViewportId: null,
  });

  // 비교 모드 레이아웃에 따른 뷰포트 수 계산
  const viewportCount = useMemo(() => {
    switch (mode.layout) {
      case '1x2':
        return 2;
      case '2x1':
        return 2;
      case '2x2':
        return 4;
      default:
        return 2;
    }
  }, [mode.layout]);

  // 뷰포트 ID 생성
  const viewportIds = useMemo(
    () => Array.from({ length: viewportCount }, (_, i) => `comparison-viewport-${String(i)}`),
    [viewportCount],
  );

  // 기본 뷰포트 상태 생성
  const defaultViewports = useMemo(
    () =>
      viewportIds.map(
        (id, index) =>
          ({
            id,
            isActive: index === 0,
            imageIndex: 0,
            zoom: 1,
            pan: { x: 0, y: 0 },
            rotation: 0,
            flipHorizontal: false,
            flipVertical: false,
            windowLevel: { window: 400, level: 50 },
            studyInstanceUID: '',
            seriesInstanceUID: '',
          }) as ViewportState,
      ),
    [viewportIds],
  );

  // 뷰포트 변경 핸들러
  const handleViewportChange = useCallback((viewportId: string, changes: Partial<ViewportState>) => {
    setState(prev => ({
      ...prev,
      activeViewportId: changes.isActive === true ? viewportId : prev.activeViewportId,
    }));

    // 뷰포트 상태 업데이트 로직
    log.info(`Viewport ${viewportId} changed:`, changes);
  }, []);

  // 동기화 설정 변경 핸들러
  const handleSyncConfigChange = useCallback(
    (newConfig: typeof syncConfig) => {
      setSyncConfig(newConfig);

      // 모드 상태에 동기화 설정 반영
      const updatedMode: ViewerMode = {
        ...mode,
        syncEnabled: newConfig.camera || newConfig.voi || newConfig.scroll,
        crossReferenceEnabled: newConfig.crossReference,
      };

      if (onModeChange !== undefined) {
        onModeChange(updatedMode);
      } else {
        setMode(updatedMode);
      }
    },
    [mode, onModeChange, setMode, setSyncConfig],
  );

  // 레이아웃 변경 핸들러
  const handleLayoutChange = useCallback(
    (newLayout: ViewerMode['layout']) => {
      const updatedMode: ViewerMode = {
        ...mode,
        layout: newLayout,
      };

      if (onModeChange !== undefined) {
        onModeChange(updatedMode);
      } else {
        setMode(updatedMode);
      }
    },
    [mode, onModeChange, setMode],
  );

  // 뷰포트 할당 변경 핸들러
  const handleViewportAssignment = useCallback((viewportId: string, seriesInstanceUID: string) => {
    log.info(`Assigning series ${seriesInstanceUID} to viewport ${viewportId}`);
    // TODO: 실제 시리즈 로딩 로직 구현
  }, []);

  // 전체화면 토글
  const toggleFullscreen = useCallback(() => {
    setState(prev => ({ ...prev, isFullscreen: !prev.isFullscreen }));
  }, []);

  // 컴포넌트 마운트 시 뷰포트 동기화 초기화
  useEffect(() => {
    if (viewportSynchronizer && viewportIds.length > 0) {
      updateViewports(viewportIds);
    }
  }, [viewportSynchronizer, viewportIds, updateViewports]);

  // 동기화 설정 초기 적용
  useEffect(() => {
    if (mode.syncEnabled || mode.crossReferenceEnabled) {
      const initialConfig = {
        camera: mode.syncEnabled,
        voi: mode.syncEnabled,
        scroll: mode.syncEnabled,
        crossReference: mode.crossReferenceEnabled,
      };
      setSyncConfig(initialConfig);
    }
  }, [mode.syncEnabled, mode.crossReferenceEnabled, setSyncConfig]);

  return (
    <div className={cn('flex flex-col h-full bg-background', state.isFullscreen && 'fixed inset-0 z-50', className)}>
      {/* 비교 뷰어 헤더 */}
      <Card className='rounded-none border-x-0 border-t-0'>
        <CardHeader className='pb-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-3'>
              <CardTitle className='text-lg font-semibold flex items-center gap-2'>
                <Grid className='h-5 w-5' />
                Comparison Viewer
              </CardTitle>
              <Badge variant='secondary' className='text-xs'>
                {mode.layout} Layout
              </Badge>
              {(mode.syncEnabled || mode.crossReferenceEnabled) && (
                <Badge variant='default' className='text-xs'>
                  Synchronized
                </Badge>
              )}
            </div>

            <div className='flex items-center space-x-2'>
              {/* 레이아웃 선택 버튼 */}
              <div className='flex items-center space-x-1'>
                <Button
                  variant={mode.layout === '1x2' ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => {
                    handleLayoutChange('1x2');
                  }}
                >
                  1×2
                </Button>
                <Button
                  variant={mode.layout === '2x1' ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => {
                    handleLayoutChange('2x1');
                  }}
                >
                  2×1
                </Button>
                <Button
                  variant={mode.layout === '2x2' ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => {
                    handleLayoutChange('2x2');
                  }}
                >
                  2×2
                </Button>
              </div>

              {/* 제어 패널 토글 버튼 */}
              <Button
                variant={state.showSyncControls ? 'default' : 'outline'}
                size='sm'
                onClick={() => {
                  setState(prev => ({
                    ...prev,
                    showSyncControls: !prev.showSyncControls,
                  }));
                }}
              >
                <Settings className='h-4 w-4' />
                <span className='hidden sm:inline ml-2'>Sync</span>
              </Button>

              <Button
                variant={state.showAssignmentPanel ? 'default' : 'outline'}
                size='sm'
                onClick={() => {
                  setState(prev => ({
                    ...prev,
                    showAssignmentPanel: !prev.showAssignmentPanel,
                  }));
                }}
              >
                <Grid className='h-4 w-4' />
                <span className='hidden sm:inline ml-2'>Assign</span>
              </Button>

              <Button
                variant={state.showCrossReferencePanel ? 'default' : 'outline'}
                size='sm'
                onClick={() => {
                  setState(prev => ({
                    ...prev,
                    showCrossReferencePanel: !prev.showCrossReferencePanel,
                  }));
                }}
              >
                <Crosshair className='h-4 w-4' />
                <span className='hidden sm:inline ml-2'>Cross-Ref</span>
              </Button>

              {/* 전체화면 토글 */}
              <Button variant='outline' size='sm' onClick={toggleFullscreen}>
                {state.isFullscreen ? <Minimize2 className='h-4 w-4' /> : <Maximize2 className='h-4 w-4' />}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 동기화 제어 패널 */}
      {state.showSyncControls && (
        <Card className='rounded-none border-x-0 border-t-0'>
          <CardContent className='py-3'>
            <SynchronizationControls
              config={syncConfig}
              onChange={handleSyncConfigChange}
              activeViewports={activeViewports}
              className='w-full'
            />
          </CardContent>
        </Card>
      )}

      {/* 교차 참조선 제어 패널 */}
      {state.showCrossReferencePanel && (
        <Card className='rounded-none border-x-0 border-t-0'>
          <CardContent className='py-3'>
            <CrossReferenceLines
              viewports={activeViewports}
              config={crossRefConfig}
              onConfigChange={setCrossRefConfig}
              currentPosition={crossRefPosition}
              onPositionChange={setCrossRefPosition}
              className='w-full'
              compact={false}
            />
          </CardContent>
        </Card>
      )}

      {/* 메인 뷰포트 영역 */}
      <div className='flex-1 flex min-h-0'>
        {/* 뷰포트 할당 패널 */}
        {state.showAssignmentPanel && (
          <Card className='w-80 rounded-none border-y-0 border-l-0'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-sm'>Viewport Assignment</CardTitle>
            </CardHeader>
            <CardContent className='p-4'>
              <ViewportAssignmentPanel
                viewportIds={viewportIds}
                layout={mode.layout}
                onAssignment={handleViewportAssignment}
                activeViewportId={state.activeViewportId}
              />
            </CardContent>
          </Card>
        )}

        {/* 뷰포트 그리드 */}
        <div className='flex-1'>
          <ViewportGridManager
            layout={mode.layout}
            viewports={defaultViewports}
            onViewportChange={handleViewportChange}
            className='h-full'
            animationDuration={200}
          />
        </div>
      </div>

      {/* 상태 표시 영역 */}
      <Card className='rounded-none border-x-0 border-b-0'>
        <CardContent className='py-2'>
          <div className='flex items-center justify-between text-xs text-muted-foreground'>
            <div className='flex items-center space-x-4'>
              <span>Active Viewports: {activeViewports.length}</span>
              <span>Layout: {mode.layout}</span>
              {state.activeViewportId !== null && <span>Selected: {state.activeViewportId}</span>}
            </div>

            <div className='flex items-center space-x-2'>
              {syncConfig.camera && (
                <Badge variant='outline' className='text-xs'>
                  Camera
                </Badge>
              )}
              {syncConfig.voi && (
                <Badge variant='outline' className='text-xs'>
                  VOI
                </Badge>
              )}
              {syncConfig.scroll && (
                <Badge variant='outline' className='text-xs'>
                  Scroll
                </Badge>
              )}
              {syncConfig.crossReference && (
                <Badge variant='outline' className='text-xs'>
                  Cross-Ref
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
