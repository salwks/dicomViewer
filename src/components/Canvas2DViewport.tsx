/**
 * Canvas2DViewport - WebGL 폴백용 Canvas 2D 뷰포트
 * WebGL을 사용할 수 없는 환경에서 Canvas 2D로 DICOM 이미지를 표시
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '../lib/utils';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Canvas2DRenderer, Canvas2DRenderOptions } from '../services/Canvas2DRenderer';
import { log } from '../utils/logger';

interface Canvas2DViewportProps {
  imageId?: string;
  className?: string;
  width?: number;
  height?: number;
  onImageLoad?: (imageId: string) => void;
  onImageError?: (error: Error) => void;
}

export const Canvas2DViewport: React.FC<Canvas2DViewportProps> = ({
  imageId,
  className,
  width = 512,
  height = 512,
  onImageLoad,
  onImageError,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Canvas2DRenderer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderOptions, setRenderOptions] = useState<Canvas2DRenderOptions>({
    windowCenter: undefined,
    windowWidth: undefined,
    zoom: 1,
    pan: { x: 0, y: 0 },
    rotation: 0,
    invert: false,
  });

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) {
      log.error('Failed to get 2D context from canvas');
      setError('Canvas 2D context not available');
      return;
    }

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Initialize renderer
    rendererRef.current = new Canvas2DRenderer(canvas, context);

    log.info('Canvas2DViewport initialized', {
      component: 'Canvas2DViewport',
      metadata: { width, height },
    });

    return () => {
      if (rendererRef.current) {
        rendererRef.current.clear();
        rendererRef.current = null;
      }
    };
  }, [width, height]);

  // Load image when imageId changes
  useEffect(() => {
    if (!imageId || !rendererRef.current) return;

    const loadImage = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Extract blob URL from wadouri scheme
        let blobUrl = imageId;
        if (imageId.startsWith('wadouri:')) {
          blobUrl = imageId.replace('wadouri:', '');
        }

        log.info('Loading DICOM image in Canvas2DViewport', {
          component: 'Canvas2DViewport',
          metadata: { imageId: `${imageId.substring(0, 50)}...` },
        });

        await rendererRef.current!.loadDicomImage(blobUrl);

        // Update render options with image metadata
        const metadata = rendererRef.current!.getImageMetadata();
        if (metadata) {
          setRenderOptions(prev => ({
            ...prev,
            windowCenter: metadata.windowCenter,
            windowWidth: metadata.windowWidth,
          }));
        }

        if (onImageLoad) {
          onImageLoad(imageId);
        }

        log.info('DICOM image loaded successfully in Canvas2DViewport', {
          component: 'Canvas2DViewport',
        });
      } catch (err) {
        const error = err as Error;
        log.error(
          'Failed to load DICOM image in Canvas2DViewport',
          {
            component: 'Canvas2DViewport',
            metadata: { imageId: `${imageId.substring(0, 50)}...` },
          },
          error,
        );

        setError(error.message);
        if (onImageError) {
          onImageError(error);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadImage();
  }, [imageId, onImageLoad, onImageError]);

  // Update rendering when options change
  useEffect(() => {
    if (rendererRef.current?.isImageLoaded()) {
      rendererRef.current.updateRenderOptions(renderOptions);
    }
  }, [renderOptions]);

  // Mouse interaction handlers for basic pan/zoom
  const handleMouseWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();

    const zoomDelta = event.deltaY > 0 ? 0.9 : 1.1;
    setRenderOptions(prev => ({
      ...prev,
      zoom: Math.max(0.1, Math.min(10, (prev.zoom || 1) * zoomDelta)),
    }));
  }, []);

  const handleDoubleClick = useCallback(() => {
    // Reset to default view
    setRenderOptions(prev => ({
      ...prev,
      zoom: 1,
      pan: { x: 0, y: 0 },
      rotation: 0,
    }));
  }, []);

  return (
    <Card className={cn('relative overflow-hidden bg-black', className)}>
      {/* Status indicators */}
      <div className="absolute top-2 left-2 z-10 flex gap-2">
        <Badge variant="outline" className="bg-background/80 backdrop-blur-sm">
          Canvas 2D
        </Badge>
        {isLoading && (
          <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
            로딩 중...
          </Badge>
        )}
        {error && (
          <Badge variant="destructive" className="bg-background/80 backdrop-blur-sm">
            오류
          </Badge>
        )}
      </div>

      {/* Render options display */}
      {rendererRef.current?.isImageLoaded() && (
        <div className="absolute top-2 right-2 z-10 flex gap-2">
          <Badge variant="outline" className="bg-background/80 backdrop-blur-sm text-xs">
            {Math.round((renderOptions.zoom || 1) * 100)}%
          </Badge>
          {renderOptions.windowCenter !== undefined && (
            <Badge variant="outline" className="bg-background/80 backdrop-blur-sm text-xs">
              W: {Math.round(renderOptions.windowWidth || 0)} / L: {Math.round(renderOptions.windowCenter)}
            </Badge>
          )}
        </div>
      )}

      {/* Canvas */}
      <div className="flex items-center justify-center w-full h-full">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full object-contain"
          style={{
            imageRendering: 'pixelated', // Better for medical images
          }}
          onWheel={handleMouseWheel}
          onDoubleClick={handleDoubleClick}
        />
      </div>

      {/* Error display */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-sm">
          <div className="text-center">
            <Badge variant="destructive" className="mb-2">
              Canvas 2D 렌더링 오류
            </Badge>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {/* Loading display */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-sm">
          <div className="text-center">
            <Badge variant="secondary" className="mb-2">
              이미지 로딩 중...
            </Badge>
            <p className="text-sm text-muted-foreground">DICOM 이미지를 처리하고 있습니다</p>
          </div>
        </div>
      )}

      {/* No image display */}
      {!imageId && !isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
          <div className="text-center text-muted-foreground">
            <Badge variant="outline" className="mb-2">
              Canvas 2D 뷰포트
            </Badge>
            <p className="text-sm">DICOM 이미지가 로드되지 않았습니다</p>
            <p className="text-xs mt-1">WebGL 폴백 모드</p>
          </div>
        </div>
      )}
    </Card>
  );
};
