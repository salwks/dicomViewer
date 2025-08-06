/**
 * ResizablePanel Component
 * 크기 조절 가능한 패널 컴포넌트
 * shadcn/ui 컴포넌트로 구축됨
 */

import React, { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

interface ResizablePanelProps {
  children?: React.ReactNode;
  className?: string | undefined;
  title?: string;
  side?: 'left' | 'right';
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onWidthChange?: (width: number) => void;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  className,
  title,
  side = 'left',
  defaultWidth = 300,
  minWidth = 200,
  maxWidth = 600,
  isCollapsed = false,
  onToggleCollapse,
  onWidthChange,
}) => {
  const [width, setWidth] = useState<number>(defaultWidth);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent): void => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent): void => {
      if (!isDragging || !panelRef.current) {
        return;
      }

      const rect = panelRef.current.getBoundingClientRect();
      let newWidth: number;

      if (side === 'left') {
        newWidth = e.clientX - rect.left;
      } else {
        newWidth = rect.right - e.clientX;
      }

      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setWidth(newWidth);
      onWidthChange?.(newWidth);
    },
    [isDragging, side, minWidth, maxWidth, onWidthChange],
  );

  const handleMouseUp = useCallback((): void => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return (): void => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (isCollapsed) {
    return (
      <div className={cn('flex flex-col', className)}>
        <Card className='w-12 h-full'>
          <CardContent className='p-2 h-full flex flex-col'>
            <Button variant='ghost' size='icon' onClick={onToggleCollapse} className='w-8 h-8 mb-2' title='패널 펼치기'>
              {side === 'left' ? (
                <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
                </svg>
              ) : (
                <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 19l-7-7 7-7' />
                </svg>
              )}
            </Button>
            {(title ?? null) !== null && (
              <div
                className={cn(
                  'text-xs text-muted-foreground text-center',
                  '[writing-mode:vertical-lr] [text-orientation:mixed]',
                )}
              >
                {title}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className={cn('relative flex', className)}
      style={
        {
          '--panel-width': `${width}px`,
          width: 'var(--panel-width)',
        } as React.CSSProperties
      }
    >
      <Card className='flex-1 h-full'>
        {(title ?? null) !== null && (
          <CardHeader className='pb-2'>
            <div className='flex items-center justify-between'>
              <CardTitle className='text-sm'>{title}</CardTitle>
              <Button variant='ghost' size='icon' onClick={onToggleCollapse} className='w-6 h-6' title='패널 접기'>
                {side === 'left' ? (
                  <svg className='w-3 h-3' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 19l-7-7 7-7' />
                  </svg>
                ) : (
                  <svg className='w-3 h-3' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
                  </svg>
                )}
              </Button>
            </div>
          </CardHeader>
        )}

        <CardContent className={cn('h-full', (title ?? null) !== null ? 'pt-0' : 'p-4')}>{children}</CardContent>
      </Card>

      {/* 크기 조절 핸들 */}
      <div
        className={cn(
          'absolute top-0 bottom-0 w-1 cursor-col-resize',
          'hover:bg-border transition-colors duration-200',
          'group',
          side === 'left' ? '-right-0.5' : '-left-0.5',
          isDragging && 'bg-primary',
        )}
        onMouseDown={handleMouseDown}
      >
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 w-1 h-8',
            'bg-border group-hover:bg-border/80 rounded-full',
            side === 'left' ? '-right-0.5' : '-left-0.5',
          )}
        />
      </div>
    </div>
  );
};
