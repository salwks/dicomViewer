/**
 * ViewportGrid Component
 * 메인 뷰포트 영역을 위한 그리드 레이아웃 시스템
 * shadcn/ui 컴포넌트로 구축됨
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from './ui/card';

interface ViewportGridProps {
  className?: string;
  layout?: '1x1' | '1x2' | '2x1' | '2x2';
  children?: React.ReactNode;
}

interface ViewportItemProps {
  className?: string;
  children?: React.ReactNode;
  id?: string;
}

export const ViewportGrid: React.FC<ViewportGridProps> = ({ className, layout = '1x1', children }) => {
  const getGridClasses = (): string => {
    switch (layout) {
      case '1x1':
        return 'grid-cols-1 grid-rows-1';
      case '1x2':
        return 'grid-cols-1 grid-rows-2';
      case '2x1':
        return 'grid-cols-2 grid-rows-1';
      case '2x2':
        return 'grid-cols-2 grid-rows-2';
      default:
        return 'grid-cols-1 grid-rows-1';
    }
  };

  return <div className={cn('grid gap-2 h-full w-full', getGridClasses(), className)}>{children}</div>;
};

export const ViewportItem: React.FC<ViewportItemProps> = ({ className, children, id }) => {
  return (
    <Card
      className={cn(
        'relative overflow-hidden border-border/50 bg-card/50',
        'border-border',
        'flex-1 min-h-0',
        className,
      )}
      id={id}
    >
      <CardContent className='p-0 h-full'>
        <div className='relative h-full w-full bg-muted/20'>
          {children ?? (
            <div className='absolute inset-0 flex items-center justify-center'>
              <div className='text-center space-y-2'>
                <div className='w-16 h-16 rounded-full bg-muted/30 mx-auto flex items-center justify-center'>
                  <svg className='w-8 h-8 text-muted-foreground' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={1.5}
                      d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
                    />
                  </svg>
                </div>
                <p className='text-sm text-muted-foreground'>뷰포트가 준비되었습니다</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
