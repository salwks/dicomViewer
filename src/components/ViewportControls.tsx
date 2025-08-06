/**
 * ViewportControls Component
 * Advanced viewport control interface with tool state management
 * Built with shadcn/ui components
 */

import React, { useState, useCallback } from 'react';
import { cn } from '../lib/utils';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Slider } from '../components/ui/slider';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import type { IViewport } from '../types';
import { log } from '../utils/logger';
import {
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  ZoomIn,
  ZoomOut,
  Maximize,
  Download,
  Trash2,
  Info,
} from 'lucide-react';

interface ViewportControlsProps {
  viewport?: IViewport | null;
  className?: string;
  onReset?: () => void;
  onClearAnnotations?: () => void;
  onCapture?: () => void;
  showAdvancedControls?: boolean;
}

export const ViewportControls: React.FC<ViewportControlsProps> = ({
  viewport,
  className,
  onReset,
  onClearAnnotations,
  onCapture,
  showAdvancedControls = true,
}) => {
  const [windowWidth, setWindowWidth] = useState(400);
  const [windowLevel, setWindowLevel] = useState(40);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Reset viewport
  const handleReset = useCallback(() => {
    if (viewport) {
      try {
        viewport.resetCamera();
        viewport.render();

        // Reset local state
        setWindowWidth(400);
        setWindowLevel(40);
        setZoom(1);
        setRotation(0);

        if (onReset) {
          onReset();
        }

        log.info('Viewport reset');
      } catch (error) {
        console.error('Failed to reset viewport:', error);
      }
    }
  }, [viewport, onReset]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (viewport) {
      try {
        const currentZoom = zoom;
        const newZoom = Math.min(currentZoom * 1.2, 5);
        setZoom(newZoom);

        // Apply zoom to viewport
        const camera = viewport.getCamera();
        if (camera?.parallelScale) {
          camera.parallelScale = camera.parallelScale / 1.2;
          viewport.setCamera(camera);
          viewport.render();
        }
      } catch (error) {
        console.error('Failed to zoom in:', error);
      }
    }
  }, [viewport, zoom]);

  const handleZoomOut = useCallback(() => {
    if (viewport) {
      try {
        const currentZoom = zoom;
        const newZoom = Math.max(currentZoom / 1.2, 0.2);
        setZoom(newZoom);

        // Apply zoom to viewport
        const camera = viewport.getCamera();
        if (camera?.parallelScale) {
          camera.parallelScale = camera.parallelScale * 1.2;
          viewport.setCamera(camera);
          viewport.render();
        }
      } catch (error) {
        console.error('Failed to zoom out:', error);
      }
    }
  }, [viewport, zoom]);

  // Fit to window
  const handleFitToWindow = useCallback(() => {
    if (viewport) {
      try {
        viewport.resetCamera();
        viewport.render();
        setZoom(1);
        log.info('Fit to window');
      } catch (error) {
        console.error('Failed to fit to window:', error);
      }
    }
  }, [viewport]);

  // Flip horizontal
  const handleFlipHorizontal = useCallback(() => {
    if (viewport) {
      try {
        const camera = viewport.getCamera();
        if (camera?.viewUp) {
          camera.viewUp = [camera.viewUp[0], -camera.viewUp[1], camera.viewUp[2]];
          viewport.setCamera(camera);
          viewport.render();
        }
      } catch (error) {
        console.error('Failed to flip horizontal:', error);
      }
    }
  }, [viewport]);

  // Flip vertical
  const handleFlipVertical = useCallback(() => {
    if (viewport) {
      try {
        const camera = viewport.getCamera();
        if (camera?.viewUp) {
          camera.viewUp = [-camera.viewUp[0], camera.viewUp[1], camera.viewUp[2]];
          viewport.setCamera(camera);
          viewport.render();
        }
      } catch (error) {
        console.error('Failed to flip vertical:', error);
      }
    }
  }, [viewport]);

  // Rotate
  const handleRotate = useCallback(
    (degrees: number) => {
      if (viewport) {
        try {
          setRotation(prev => (prev + degrees) % 360);
          // Rotation implementation depends on viewport type
          // This is a simplified version
          viewport.render();
        } catch (error) {
          console.error('Failed to rotate:', error);
        }
      }
    },
    [viewport],
  );

  // Window/Level adjustment
  const handleWindowLevelChange = useCallback(
    (values: number[]) => {
      if (values.length === 2 && viewport) {
        const [newWindow, newLevel] = values;
        if (newWindow !== undefined) {
          setWindowWidth(newWindow);
        }
        if (newLevel !== undefined) {
          setWindowLevel(newLevel);
        }

        try {
          // Apply window/level to viewport
          // This depends on the viewport type and image
          if (newWindow !== undefined && newLevel !== undefined) {
            // Note: Actual implementation depends on viewport type
          }

          // Note: Actual implementation depends on viewport type
          viewport.render();
        } catch (error) {
          console.error('Failed to adjust window/level:', error);
        }
      }
    },
    [viewport],
  );

  return (
    <Card className={cn('space-y-4', className)}>
      <CardContent className='p-4 space-y-4'>
        {/* Quick Actions */}
        <div className='space-y-2'>
          <Label className='text-xs font-medium'>빠른 작업</Label>
          <div className='grid grid-cols-4 gap-2'>
            <Button size='sm' variant='outline' onClick={handleReset} title='초기화' className='p-2'>
              <RotateCcw className='h-4 w-4' />
            </Button>
            <Button size='sm' variant='outline' onClick={handleFitToWindow} title='화면 맞춤' className='p-2'>
              <Maximize className='h-4 w-4' />
            </Button>
            <Button size='sm' variant='outline' onClick={handleFlipHorizontal} title='좌우 반전' className='p-2'>
              <FlipHorizontal className='h-4 w-4' />
            </Button>
            <Button size='sm' variant='outline' onClick={handleFlipVertical} title='상하 반전' className='p-2'>
              <FlipVertical className='h-4 w-4' />
            </Button>
          </div>
        </div>

        <Separator />

        {/* Zoom Controls */}
        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <Label className='text-xs font-medium'>확대/축소</Label>
            <Badge variant='secondary' className='text-xs'>
              {Math.round(zoom * 100)}%
            </Badge>
          </div>
          <div className='flex items-center gap-2'>
            <Button size='sm' variant='outline' onClick={handleZoomOut} className='p-2'>
              <ZoomOut className='h-4 w-4' />
            </Button>
            <Slider
              value={[zoom]}
              onValueChange={([value]: number[]) => {
                if (value !== undefined) {
                  setZoom(value);
                }
              }}
              min={0.2}
              max={5}
              step={0.1}
              className='flex-1'
            />
            <Button size='sm' variant='outline' onClick={handleZoomIn} className='p-2'>
              <ZoomIn className='h-4 w-4' />
            </Button>
          </div>
        </div>

        {showAdvancedControls && (
          <>
            <Separator />

            {/* Window/Level Controls */}
            <div className='space-y-2'>
              <Label className='text-xs font-medium'>윈도우/레벨</Label>
              <div className='space-y-3'>
                <div>
                  <div className='flex items-center justify-between mb-1'>
                    <span className='text-xs text-muted-foreground'>윈도우</span>
                    <span className='text-xs font-mono'>{windowWidth}</span>
                  </div>
                  <Slider
                    value={[windowWidth]}
                    onValueChange={([value]: number[]) => {
                      if (value !== undefined) {
                        handleWindowLevelChange([value, windowLevel]);
                      }
                    }}
                    min={1}
                    max={4000}
                    step={10}
                  />
                </div>
                <div>
                  <div className='flex items-center justify-between mb-1'>
                    <span className='text-xs text-muted-foreground'>레벨</span>
                    <span className='text-xs font-mono'>{windowLevel}</span>
                  </div>
                  <Slider
                    value={[windowLevel]}
                    onValueChange={([value]: number[]) => {
                      if (value !== undefined) {
                        handleWindowLevelChange([windowWidth, value]);
                      }
                    }}
                    min={-1000}
                    max={1000}
                    step={10}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Rotation Control */}
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <Label className='text-xs font-medium'>회전</Label>
                <Badge variant='secondary' className='text-xs'>
                  {rotation}°
                </Badge>
              </div>
              <div className='grid grid-cols-3 gap-2'>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    handleRotate(-90);
                  }}
                  className='text-xs'
                >
                  -90°
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    handleRotate(90);
                  }}
                  className='text-xs'
                >
                  +90°
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    handleRotate(180);
                  }}
                  className='text-xs'
                >
                  180°
                </Button>
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Utility Actions */}
        <div className='space-y-2'>
          <Label className='text-xs font-medium'>유틸리티</Label>
          <div className='grid grid-cols-2 gap-2'>
            <Button size='sm' variant='outline' onClick={onCapture} className='gap-2'>
              <Download className='h-3 w-3' />
              <span className='text-xs'>캡처</span>
            </Button>
            <Button size='sm' variant='outline' onClick={onClearAnnotations} className='gap-2'>
              <Trash2 className='h-3 w-3' />
              <span className='text-xs'>주석 삭제</span>
            </Button>
          </div>
        </div>

        {/* Viewport Info */}
        {viewport && (
          <>
            <Separator />
            <div className='space-y-1'>
              <div className='flex items-center gap-1'>
                <Info className='h-3 w-3 text-muted-foreground' />
                <Label className='text-xs font-medium'>뷰포트 정보</Label>
              </div>
              <div className='text-xs text-muted-foreground space-y-0.5'>
                <div>ID: {viewport.id}</div>
                <div>Type: {viewport.type}</div>
                <div>
                  Canvas: {viewport.canvas?.width}x{viewport.canvas?.height}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
