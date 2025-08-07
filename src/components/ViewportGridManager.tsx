/**
 * ViewportGridManager - 동적 뷰포트 레이아웃 관리
 * shadcn/ui 패턴 준수: Tailwind CSS Grid + className 기반 스타일링
 * CSS-in-JS 제거, 순수 shadcn/ui 컴포넌트 패턴 적용
 */

import React, { useEffect, useCallback } from 'react';
import { cn } from '../lib/utils';
import { Badge } from '../components/ui/badge';
import { useViewer, useViewerLayout, type ViewportState } from '../context/ViewerContext';
import { DicomViewer } from './DicomViewer';
import { log } from '../utils/logger';

// Tailwind Grid 클래스 생성 헬퍼
const getGridPositionClasses = (index: number, cols: number): string => {
  const row = Math.floor(index / cols) + 1;
  const col = (index % cols) + 1;
  return `col-start-${col} row-start-${row}`;
};

// 개별 뷰포트 아이템 컴포넌트 (완전한 shadcn/ui 패턴)
interface ViewportItemProps {
  viewport: ViewportState;
  gridPosition: string; // Tailwind grid position classes
}

const ViewportItem: React.FC<ViewportItemProps> = ({ viewport, gridPosition }) => {
  const { setActiveViewport } = useViewer();

  const handleViewportClick = useCallback(() => {
    setActiveViewport(viewport.id);

    log.info('Viewport activated', {
      component: 'ViewportGridManager',
      metadata: { viewportId: viewport.id },
    });
  }, [viewport.id, setActiveViewport]);

  return (
    <div
      className={cn(
        'relative h-full',
        gridPosition,
      )}
    >
      <div
        className={cn(
          'h-full cursor-pointer bg-background rounded-lg',
          viewport.isActive && 'ring-2 ring-primary/20 shadow-lg',
        )}
        onClick={handleViewportClick}
      >
        <div className='h-full flex flex-col'>
          {/* 뷰포트 헤더 */}
          <div className='flex items-center justify-between p-3'>
            <Badge variant={viewport.isActive ? 'default' : 'secondary'} className='text-xs'>
              뷰포트 {viewport.id.split('-').pop()}
            </Badge>

            {viewport.studyInstanceUID && (
              <Badge variant='outline' className='text-xs'>
                Study: {viewport.studyInstanceUID.slice(-6)}
                {viewport.seriesInstanceUID && ` | Series: ${viewport.seriesInstanceUID.slice(-6)}`}
              </Badge>
            )}
          </div>

          {/* 뷰포트 컨텐츠 영역 */}
          <div className='flex-1 relative'>
            {viewport.studyInstanceUID ? (
              <DicomViewer
                key={`${viewport.id}-${viewport.studyInstanceUID || 'no-study'}`}
                viewportId={viewport.id}
                seriesInstanceUID={viewport.seriesInstanceUID}
                studyInstanceUID={viewport.studyInstanceUID}
              />
            ) : (
              <div className='h-full flex items-center justify-center'>
                <div className='text-center text-muted-foreground'>
                  <div className='text-3xl mb-3'>📁</div>
                  <div className='text-sm font-medium'>DICOM 이미지를 여기에</div>
                  <div className='text-sm'>드래그하여 로드하세요</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// 순수 shadcn/ui 패턴: 조건부 Tailwind 클래스
const getGridClasses = (rows: number, cols: number): string => {
  // 가장 일반적인 레이아웃들만 지원 (shadcn/ui 패턴)
  if (rows === 1 && cols === 1) return 'grid-cols-1 grid-rows-1';
  if (rows === 1 && cols === 2) return 'grid-cols-2 grid-rows-1';
  if (rows === 2 && cols === 1) return 'grid-cols-1 grid-rows-2';
  if (rows === 2 && cols === 2) return 'grid-cols-2 grid-rows-2';

  // 기본값: 2x2 그리드
  return 'grid-cols-2 grid-rows-2';
};

// 메인 ViewportGridManager 컴포넌트 (완전한 shadcn/ui 패턴)
export const ViewportGridManager: React.FC = () => {
  const { state } = useViewer();
  const layout = useViewerLayout();
  const { viewports } = state;

  // 모드/레이아웃 변경 시 로깅
  useEffect(() => {
    log.info('Viewport layout changed', {
      component: 'ViewportGridManager',
      metadata: {
        layout,
        viewportCount: viewports.length,
      },
    });
  }, [layout, viewports.length]);

  // 직접 Tailwind Grid 클래스 적용
  const gridClasses = getGridClasses(layout.rows, layout.cols);

  return (
    <div className={cn('w-full h-full p-4 grid gap-2', gridClasses)}>
      {viewports.map((viewport, index) => (
        <ViewportItem key={viewport.id} viewport={viewport} gridPosition={getGridPositionClasses(index, layout.cols)} />
      ))}

    </div>
  );
};
