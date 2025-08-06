/**
 * ViewportSizeManager Component
 * Manages viewport sizing, resizing, and layout constraints
 * Built with shadcn/ui components
 */
import { log } from '../utils/logger';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { cn, safePropertyAccess } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Maximize, Minimize, Lock, Unlock, Monitor, Square, RectangleHorizontal, Expand } from 'lucide-react';
import type { IViewport } from '@/types';
interface ViewportDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

interface SizeConstraints {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  maintainAspectRatio: boolean;
  allowFullscreen: boolean;
}

interface ViewportSizeManagerProps {
  viewport?: IViewport | null;
  className?: string;
  onSizeChange?: (dimensions: ViewportDimensions) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  constraints?: Partial<SizeConstraints>;
  showControls?: boolean;
}

const DEFAULT_CONSTRAINTS: SizeConstraints = {
  minWidth: 200,
  minHeight: 200,
  maxWidth: 4000,
  maxHeight: 4000,
  maintainAspectRatio: false,
  allowFullscreen: true,
};

// Preset aspect ratios
const ASPECT_RATIO_PRESETS = [
  { label: '1:1', ratio: 1, icon: Square },
  { label: '4:3', ratio: 4 / 3, icon: RectangleHorizontal },
  { label: '16:9', ratio: 16 / 9, icon: RectangleHorizontal },
  { label: '자유', ratio: null, icon: Expand },
];

export const ViewportSizeManager: React.FC<ViewportSizeManagerProps> = ({
  viewport,
  className,
  onSizeChange,
  onFullscreenChange,
  constraints = {},
  showControls = true,
}) => {
  const mergedConstraints = useMemo(() => ({ ...DEFAULT_CONSTRAINTS, ...constraints }), [constraints]);

  const [dimensions, setDimensions] = useState<ViewportDimensions>({
    width: 512,
    height: 512,
    aspectRatio: 1,
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [aspectRatioLocked, setAspectRatioLocked] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Update dimensions from viewport
  const updateDimensions = useCallback(
    (viewport: IViewport) => {
      if (viewport.canvas) {
        const newDimensions: ViewportDimensions = {
          width: viewport.canvas.width,
          height: viewport.canvas.height,
          aspectRatio: viewport.canvas.width / viewport.canvas.height,
        };

        setDimensions(newDimensions);

        if (onSizeChange) {
          onSizeChange(newDimensions);
        }
      }
    },
    [onSizeChange],
  );

  // Handle viewport resize
  const handleResize = useCallback(
    (width: number, height: number) => {
      if (!viewport?.canvas) {
        return;
      }

      try {
        // Apply constraints
        const constrainedWidth = Math.max(mergedConstraints.minWidth, Math.min(mergedConstraints.maxWidth, width));

        let constrainedHeight = Math.max(mergedConstraints.minHeight, Math.min(mergedConstraints.maxHeight, height));

        // Maintain aspect ratio if locked
        if (aspectRatioLocked && selectedPreset !== null) {
          const preset = safePropertyAccess(ASPECT_RATIO_PRESETS, selectedPreset);
          if (preset?.ratio) {
            constrainedHeight = constrainedWidth / preset.ratio;
          }
        }

        // Resize canvas
        viewport.canvas.width = constrainedWidth;
        viewport.canvas.height = constrainedHeight;

        // Update viewport
        viewport.resize();
        viewport.render();

        // Update dimensions state
        const newDimensions: ViewportDimensions = {
          width: constrainedWidth,
          height: constrainedHeight,
          aspectRatio: constrainedWidth / constrainedHeight,
        };

        setDimensions(newDimensions);

        if (onSizeChange) {
          onSizeChange(newDimensions);
        }

        log.info(`Viewport resized to: ${constrainedWidth}x${constrainedHeight}`);
      } catch (error) {
        console.error('Failed to resize viewport:', error);
      }
    },
    [viewport, aspectRatioLocked, selectedPreset, onSizeChange, mergedConstraints],
  );

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (!mergedConstraints.allowFullscreen) {
      return;
    }

    try {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      if (!isFullscreen) {
        // Enter fullscreen
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (error) {
      console.error('Failed to toggle fullscreen:', error);
    }
  }, [isFullscreen, mergedConstraints.allowFullscreen]);

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = (): void => {
      const newIsFullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen(newIsFullscreen);

      if (onFullscreenChange) {
        onFullscreenChange(newIsFullscreen);
      }

      // Trigger viewport resize in fullscreen
      if (newIsFullscreen && viewport) {
        setTimeout(() => {
          viewport.resize();
          viewport.render();
          updateDimensions(viewport);
        }, 100);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [viewport, onFullscreenChange, updateDimensions]);

  // Setup resize observer
  useEffect(() => {
    if (!viewport?.canvas) {
      return;
    }

    const canvas = viewport.canvas;

    resizeObserverRef.current = new ResizeObserver(() => {
      updateDimensions(viewport);
    });

    resizeObserverRef.current.observe(canvas);

    // Initial dimensions update
    updateDimensions(viewport);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [viewport, updateDimensions]);

  // Handle window resize
  useEffect(() => {
    const handleWindowResize = (): void => {
      if (viewport && isFullscreen) {
        setTimeout(() => {
          viewport.resize();
          viewport.render();
          updateDimensions(viewport);
        }, 100);
      }
    };

    window.addEventListener('resize', handleWindowResize);
    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [viewport, isFullscreen, updateDimensions]);

  // Set aspect ratio preset
  const setAspectRatioPreset = useCallback(
    (presetIndex: number) => {
      setSelectedPreset(presetIndex);

      const preset = safePropertyAccess(ASPECT_RATIO_PRESETS, presetIndex);
      if (preset?.ratio && viewport) {
        const newHeight = dimensions.width / preset.ratio;
        handleResize(dimensions.width, newHeight);
      }
    },
    [dimensions.width, handleResize, viewport],
  );

  // Fit to container
  const fitToContainer = useCallback(() => {
    if (!viewport || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();

    handleResize(containerRect.width - 32, containerRect.height - 32); // Account for padding
  }, [viewport, handleResize]);

  if (!showControls) {
    return (
      <div ref={containerRef} className={cn('h-full w-full', className)}>
        {/* Viewport content will be rendered here */}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('space-y-4', className)}>
      <Card className='p-4 space-y-4'>
        {/* Size Information */}
        <div className='space-y-2'>
          <Label className='text-sm font-medium'>뷰포트 크기</Label>
          <div className='flex items-center gap-2'>
            <Badge variant='secondary' className='font-mono text-xs'>
              {Math.round(dimensions.width)} × {Math.round(dimensions.height)}
            </Badge>
            <Badge variant='outline' className='text-xs'>
              {dimensions.aspectRatio.toFixed(2)}:1
            </Badge>
            {isFullscreen && (
              <Badge variant='default' className='text-xs'>
                전체화면
              </Badge>
            )}
          </div>
        </div>

        <Separator />

        {/* Quick Actions */}
        <div className='space-y-2'>
          <Label className='text-sm font-medium'>빠른 작업</Label>
          <div className='grid grid-cols-3 gap-2'>
            <Button size='sm' variant='outline' onClick={fitToContainer} className='gap-2'>
              <Monitor className='h-3 w-3' />
              맞춤
            </Button>
            <Button
              size='sm'
              variant='outline'
              onClick={toggleFullscreen}
              disabled={!mergedConstraints.allowFullscreen}
              className='gap-2'
            >
              {isFullscreen ? (
                <>
                  <Minimize className='h-3 w-3' />
                  축소
                </>
              ) : (
                <>
                  <Maximize className='h-3 w-3' />
                  전체
                </>
              )}
            </Button>
            <Toggle pressed={aspectRatioLocked} onPressedChange={setAspectRatioLocked} size='sm' className='gap-2'>
              {aspectRatioLocked ? (
                <>
                  <Lock className='h-3 w-3' />
                  고정
                </>
              ) : (
                <>
                  <Unlock className='h-3 w-3' />
                  자유
                </>
              )}
            </Toggle>
          </div>
        </div>

        {/* Aspect Ratio Presets */}
        <div className='space-y-2'>
          <Label className='text-sm font-medium'>화면 비율</Label>
          <div className='grid grid-cols-4 gap-2'>
            {ASPECT_RATIO_PRESETS.map((preset, index) => {
              const Icon = preset.icon;
              return (
                <Button
                  key={index}
                  size='sm'
                  variant={selectedPreset === index ? 'default' : 'outline'}
                  onClick={() => {
                    setAspectRatioPreset(index);
                  }}
                  className='gap-1 text-xs'
                >
                  <Icon className='h-3 w-3' />
                  {preset.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Size Constraints Info */}
        {import.meta.env.DEV && (
          <>
            <Separator />
            <div className='space-y-1'>
              <Label className='text-xs font-medium text-muted-foreground'>제약 조건</Label>
              <div className='text-xs text-muted-foreground space-y-0.5'>
                <div>
                  최소: {mergedConstraints.minWidth}×{mergedConstraints.minHeight}
                </div>
                <div>
                  최대: {mergedConstraints.maxWidth}×{mergedConstraints.maxHeight}
                </div>
                <div>전체화면: {mergedConstraints.allowFullscreen ? '허용' : '비허용'}</div>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
