/**
 * UnifiedViewer - 통합 뷰어 최상위 컨테이너
 * 싱글 뷰와 비교 뷰를 통합한 매끄러운 사용자 경험 제공
 * 전면 리팩토링: 새로운 ViewerContext 아키텍처 적용
 */

import React, { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { useViewer, useViewerLayout, ViewerProvider } from '../context/ViewerContext';
import { HeaderNavigation } from './HeaderNavigation';
import { SidePanelSystem } from './SidePanelSystem';
import { ViewportGridManager } from './ViewportGridManager';
import { StatusBar } from './StatusBar';
import { ErrorBoundary } from './ErrorBoundary';
import { ToolPanel } from './ToolPanel';
import { AnnotationManager } from './AnnotationManager';
import { log } from '../utils/logger';
import { viewportSynchronizer } from '../services/ViewportSynchronizer';

interface UnifiedViewerProps {
  className?: string;
  children?: React.ReactNode;
  onTestModeToggle?: () => void;
}

// UnifiedViewer 내부 구현 컴포넌트
const UnifiedViewerContent: React.FC<UnifiedViewerProps> = ({ className, children, onTestModeToggle }) => {
  const { state } = useViewer();
  const layout = useViewerLayout();
  const [showAnnotationManager, setShowAnnotationManager] = useState(false);

  useEffect(() => {
    log.info('UnifiedViewer mounted', {
      component: 'UnifiedViewer',
      metadata: {
        layout,
        viewportCount: state.viewports.length,
        synchronizationEnabled: state.synchronization.enabled,
        matrixSyncEnabled: viewportSynchronizer.isMatrixSyncEnabled(),
      },
    });

    // Initialize matrix transform synchronization based on viewer state
    if (state.synchronization.enabled) {
      viewportSynchronizer.setMatrixSyncEnabled(true);
    }

    return () => {
      log.info('UnifiedViewer unmounted', {
        component: 'UnifiedViewer',
      });
    };
  }, [layout, state.viewports.length, state.synchronization.enabled]);

  return (
    <ErrorBoundary>
      <div
        className={cn(
          'h-screen w-full flex flex-col bg-background',
          'overflow-hidden', // 전체 화면 스크롤 방지
          className,
        )}
      >
        {/* 헤더 네비게이션 - 모드 변경 버튼 포함 */}
        <HeaderNavigation onTestModeToggle={onTestModeToggle} />

        {/* 메인 컨텐츠 영역 */}
        <div className='flex-1 flex min-h-0'>
          {/* 사이드 패널 시스템 - 스터디/시리즈 목록 */}
          <SidePanelSystem />

          {/* 중앙 뷰포트 영역 */}
          <div className='flex-1 flex min-w-0'>
            <div className='flex-1 flex flex-col'>
              <ViewportGridManager />
              {/* 자식 컴포넌트 렌더링 */}
              {children}
            </div>

            {/* 우측 도구 패널 */}
            <div className='w-80 flex flex-col bg-background border-l border-border'>
              {/* 도구 선택 패널 */}
              <div className='flex-1 overflow-y-auto'>
                <ToolPanel
                  className='p-4'
                />
              </div>

              {/* 주석 관리 패널 */}
              {showAnnotationManager && (
                <div className='h-1/2 border-t border-border overflow-y-auto'>
                  <AnnotationManager
                    annotations={[]} // TODO: 실제 annotations 연결
                    className='p-4'
                  />
                </div>
              )}

              {/* 주석 매니저 토글 버튼 */}
              <div className='p-2 border-t border-border'>
                <button
                  onClick={() => setShowAnnotationManager(!showAnnotationManager)}
                  className='w-full px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-md transition-colors'
                >
                  {showAnnotationManager ? '주석 관리 숨기기' : '주석 관리 표시'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 상태 표시줄 */}
        <StatusBar />

        {/* 전역 로딩 오버레이 */}
        {state.isLoading && (
          <div className='absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center'>
            <div className='flex flex-col items-center space-y-4'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary' />
              <p className='text-sm text-muted-foreground'>뷰어를 초기화하는 중...</p>
            </div>
          </div>
        )}

        {/* 전역 에러 표시 */}
        {state.error && (
          <div className='absolute bottom-20 right-4 max-w-md bg-destructive text-destructive-foreground p-4 rounded-lg shadow-lg z-50'>
            <div className='flex items-start space-x-2'>
              <div className='flex-shrink-0'>
                <svg className='h-5 w-5' viewBox='0 0 20 20' fill='currentColor'>
                  <path
                    fillRule='evenodd'
                    d={[
                      'M10 18a8 8 0 100-16 8 8 0 000 16z',
                      'M8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293',
                      'a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z',
                    ].join(' ')}
                    clipRule='evenodd'
                  />
                </svg>
              </div>
              <div className='flex-1'>
                <h4 className='font-medium'>오류가 발생했습니다</h4>
                <p className='text-sm mt-1'>{state.error}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

// 메인 UnifiedViewer 컴포넌트 - ViewerProvider로 래핑
export const UnifiedViewer: React.FC<UnifiedViewerProps> = ({ className, children, onTestModeToggle }) => {
  return (
    <ViewerProvider>
      <UnifiedViewerContent className={className} onTestModeToggle={onTestModeToggle}>{children}</UnifiedViewerContent>
    </ViewerProvider>
  );
};
