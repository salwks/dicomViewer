/**
 * SingleViewerViewport Component
 * Main viewport component for single viewer mode
 * Built with shadcn/ui components and Cornerstone3D integration
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { log } from '../utils/logger';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useCornerstone } from '@/hooks/useCornerstone';
import type { IViewport } from '@/types';

interface SingleViewerViewportProps {
  viewportId?: string;
  className?: string;
  onViewportReady?: (viewport: IViewport) => void;
  onError?: (error: Error) => void;
}

export const SingleViewerViewport: React.FC<SingleViewerViewportProps> = ({
  viewportId = 'single-viewport-main',
  className,
  onViewportReady,
  onError,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<IViewport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { isInitialized } = useCornerstone();

  // Initialize Cornerstone and create viewport
  const setupViewport = useCallback(async () => {
    if (!viewportRef.current) {
      console.warn('Viewport element not ready');
      return;
    }

    try {
      setIsLoading(true);
      setLoadingProgress(20);

      // Check if Cornerstone is initialized
      if (!isInitialized) {
        log.info('Waiting for Cornerstone3D initialization...');
        setError('Cornerstone3D not initialized');
        return;
      }

      setLoadingProgress(50);

      // Mock viewport creation (실제 구현 필요)
      log.info(`Creating viewport: ${viewportId}`);
      setLoadingProgress(80);

      // Temporary mock viewport
      const mockViewport = {
        id: viewportId,
        element: viewportRef.current,
        resize: () => log.info('Viewport resized'),
        render: () => log.info('Viewport rendered'),
      } as IViewport;

      setViewport(mockViewport);
      setLoadingProgress(100);

      // Notify parent component
      if (onViewportReady) {
        onViewportReady(mockViewport);
      }

      log.info(`✓ Viewport ready: ${viewportId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create viewport';
      console.error('Viewport setup error:', err);
      setError(errorMessage);

      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      }
    } finally {
      setIsLoading(false);
    }
  }, [viewportId, isInitialized, onViewportReady, onError]);

  // Setup viewport on mount
  useEffect(() => {
    setupViewport();

    // Cleanup on unmount
    return () => {
      if (viewport) {
        log.info(`Cleaning up viewport: ${viewportId}`);
        // Mock cleanup
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-setup if initialization state changes
  useEffect(() => {
    if (isInitialized && !viewport && viewportRef.current) {
      setupViewport();
    }
  }, [isInitialized, viewport, setupViewport]);

  // Handle window resize
  useEffect(() => {
    const handleResize = (): void => {
      if (viewport && viewportRef.current) {
        try {
          // Trigger viewport resize
          viewport.resize();
          viewport.render();
        } catch (err) {
          console.error('Error resizing viewport:', err);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [viewport]);

  return (
    <Card className={cn('relative h-full w-full overflow-hidden', className)}>
      {/* Loading State */}
      {isLoading && (
        <div className='absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm'>
          <div className='flex flex-col items-center space-y-4'>
            <Progress value={loadingProgress} className='w-48' />
            <p className='text-sm text-muted-foreground'>뷰포트 초기화 중...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error !== null && error !== '' && (
        <div className='absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm'>
          <div className='flex flex-col items-center space-y-2 text-center'>
            <Badge variant='destructive' className='mb-2'>
              오류
            </Badge>
            <p className='text-sm text-muted-foreground'>{error}</p>
            <button
              onClick={() => {
                setError(null);
                setupViewport();
              }}
              className={cn(
                'mt-4 px-4 py-2 text-xs rounded',
                'bg-primary text-primary-foreground',
                'hover:bg-primary/90',
              )}
            >
              재시도
            </button>
          </div>
        </div>
      )}

      {/* Viewport Container */}
      <div
        ref={viewportRef}
        className={cn(
          'h-full w-full',
          'bg-black', // Cornerstone viewport background
        )}
        data-viewport-id={viewportId}
      />

      {/* Viewport Status Indicator */}
      {viewport && !isLoading && (error === null || error === '') && (
        <div className='absolute top-2 left-2 z-20'>
          <Badge variant='secondary' className='text-xs bg-background/90 backdrop-blur-sm'>
            <span className='mr-1 h-2 w-2 rounded-full bg-green-500 inline-block' />
            뷰포트 활성
          </Badge>
        </div>
      )}

      {/* Viewport ID Display (Development) */}
      {import.meta.env.DEV && (
        <div className='absolute bottom-2 left-2 z-20'>
          <Badge variant='outline' className='text-xs bg-background/90 backdrop-blur-sm font-mono'>
            {viewportId}
          </Badge>
        </div>
      )}
    </Card>
  );
};
