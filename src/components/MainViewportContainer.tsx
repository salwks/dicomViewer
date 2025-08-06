/**
 * MainViewportContainer Component
 * 메인 뷰포트 영역 컨테이너
 * shadcn/ui Card 컴포넌트와 커스텀 ViewportGrid 사용
 */

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { ViewportGrid, ViewportItem } from './ViewportGrid';

type LayoutType = '1x1' | '1x2' | '2x1' | '2x2';

interface MainViewportContainerProps {
  className?: string;
  layout?: LayoutType;
}

export const MainViewportContainer: React.FC<MainViewportContainerProps> = ({
  className,
  layout: initialLayout = '1x1',
}) => {
  const [currentLayout, setCurrentLayout] = useState<LayoutType>(initialLayout);

  useEffect(() => {
    setCurrentLayout(initialLayout);
  }, [initialLayout]);

  const layouts: { type: LayoutType; label: string; icon: string }[] = [
    { type: '1x1', label: '단일 뷰', icon: '⊞' },
    { type: '1x2', label: '세로 분할', icon: '⫾' },
    { type: '2x1', label: '가로 분할', icon: '⫿' },
    { type: '2x2', label: '4분할', icon: '⊞' },
  ];

  const getViewportCount = (): number => {
    switch (currentLayout) {
      case '1x1':
        return 1;
      case '1x2':
      case '2x1':
        return 2;
      case '2x2':
        return 4;
      default:
        return 1;
    }
  };

  const renderViewports = (): React.ReactNode[] => {
    const count = getViewportCount();
    return Array.from({ length: count }, (_, index) => (
      <ViewportItem key={`viewport-${index.toString()}`} id={`viewport-${index.toString()}`} className='group'>
        <div className='absolute top-2 left-2 z-10'>
          <div className='px-2 py-1 bg-background/80 backdrop-blur-sm rounded text-xs font-medium border border-border/50'>
            뷰포트 {(index + 1).toString()}
          </div>
        </div>

        {/* 뷰포트 상태 인디케이터 */}
        <div className='absolute top-2 right-2 z-10'>
          <div className='w-2 h-2 rounded-full bg-muted-foreground/40'></div>
        </div>

        {/* 뷰포트 컨트롤 - 항상 표시 (의료SW 표준) */}
        <div className={cn(
          'absolute bottom-2 right-2 z-10 flex items-center space-x-1',
        )}>
          <Button variant='outline' size='sm'>
            로드
          </Button>
          <Button variant='outline' size='sm'>
            설정
          </Button>
        </div>
      </ViewportItem>
    ));
  };

  return (
    <Card className={cn('flex-1 h-full', className)}>
      <CardHeader className='pb-2'>
        <div className='flex items-center justify-between'>
          <CardTitle className='text-lg'>뷰포트</CardTitle>

          {/* 레이아웃 선택 버튼들 */}
          <div className='flex items-center space-x-1'>
            {layouts.map(layout => (
              <Button
                key={layout.type}
                variant={currentLayout === layout.type ? 'default' : 'outline'}
                size='sm'
                onClick={() => {
                  setCurrentLayout(layout.type);
                }}
                className='px-3'
                title={layout.label}
              >
                <span className='text-sm'>{layout.icon}</span>
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className='flex-1 p-4 pt-0'>
        <div className='h-full'>
          <ViewportGrid layout={currentLayout}>{renderViewports()}</ViewportGrid>
        </div>
      </CardContent>
    </Card>
  );
};
