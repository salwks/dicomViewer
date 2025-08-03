/**
 * Stack Scroll Indicator Component
 * Shows the current position in the image stack with a visual gauge
 * Rewritten using shadcn/ui components and patterns
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Slider } from '../ui/slider';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

interface StackScrollIndicatorProps {
  renderingEngineId: string;
  viewportId: string;
  imageCount: number;
  currentIndex: number;
  onIndexChange?: (index: number) => void;
  getRenderingEngine?: () => any;
}

export const StackScrollIndicator: React.FC<StackScrollIndicatorProps> = ({
  renderingEngineId,
  viewportId,
  imageCount,
  currentIndex: initialIndex,
  onIndexChange,
  getRenderingEngine,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isDragging, setIsDragging] = useState(false);

  // Sync with external index changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    const updateIndex = () => {
      try {
        // Get rendering engine using provided getter or fall back
        const renderingEngine = getRenderingEngine ? getRenderingEngine() : null;
        if (!renderingEngine) return;

        const viewport = renderingEngine.getViewport(viewportId) as any;
        if (!viewport || !viewport.getCurrentImageIdIndex) return;

        const index = viewport.getCurrentImageIdIndex();
        if (index !== currentIndex) {
          setCurrentIndex(index);
          onIndexChange?.(index);
        }
      } catch {
        // Ignore errors when viewport is not ready
      }
    };

    // Poll for index changes
    const intervalId = setInterval(updateIndex, 100);

    // Initial update
    updateIndex();

    return () => {
      clearInterval(intervalId);
    };
  }, [renderingEngineId, viewportId, currentIndex, onIndexChange, getRenderingEngine]);

  const handleSliderChange = (values: number[]) => {
    const newIndex = values[0] || 0;
    setCurrentIndex(newIndex);

    // Update viewport
    try {
      // Get rendering engine using provided getter or fall back
      const renderingEngine = getRenderingEngine ? getRenderingEngine() : null;
      if (!renderingEngine) return;

      const viewport = renderingEngine.getViewport(viewportId) as any;
      if (!viewport || !viewport.setImageIdIndex) return;

      viewport.setImageIdIndex(newIndex);
      renderingEngine.render();

      onIndexChange?.(newIndex);
    } catch {
      // Ignore errors
    }
  };

  const handlePointerDown = () => setIsDragging(true);
  const handlePointerUp = () => setIsDragging(false);

  if (imageCount <= 1) {
    return null; // Don't show indicator for single images
  }

  const percentage = imageCount > 1 ? (currentIndex / (imageCount - 1)) * 100 : 0;

  return (
    <Card className={cn(
      'absolute bottom-4 left-4 right-4',
      'bg-background/90 backdrop-blur-sm border-border/50',
    )}>
      <CardContent className="p-4">
        <div className="space-y-3">
          <Slider
            value={[currentIndex]}
            onValueChange={handleSliderChange}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            max={imageCount - 1}
            min={0}
            step={1}
            className={cn(
              'w-full',
              isDragging && 'opacity-100',
              !isDragging && 'opacity-90',
            )}
            aria-label="Stack scroll position"
          />
          <div className="flex justify-between items-center">
            <Badge variant="secondary" className="text-xs">
              Frame {currentIndex + 1} of {imageCount}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {Math.round(percentage)}%
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
