/**
 * Mini Stack Indicator Component
 * Compact version of stack scroll indicator for corner display
 * Rewritten using shadcn/ui components and patterns
 */

import React, { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { cn } from '../../lib/utils';

interface MiniStackIndicatorProps {
  renderingEngineId: string;
  viewportId: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  getRenderingEngine?: () => any;
}

export const MiniStackIndicator: React.FC<MiniStackIndicatorProps> = ({
  renderingEngineId,
  viewportId,
  position = 'bottom-right',
  getRenderingEngine,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalImages, setTotalImages] = useState(0);

  useEffect(() => {
    const updateStatus = () => {
      try {
        // Get rendering engine using provided getter or fall back
        const renderingEngine = getRenderingEngine ? getRenderingEngine() : null;
        if (!renderingEngine) return;

        const viewport = renderingEngine.getViewport(viewportId) as any;
        if (!viewport) return;

        const imageIds = viewport.getImageIds?.();
        const index = viewport.getCurrentImageIdIndex?.();

        if (imageIds && typeof index === 'number') {
          setTotalImages(imageIds.length);
          setCurrentIndex(index);
        }
      } catch (error) {
        console.warn('Failed to update stack indicator state', { error });
      }
    };

    const intervalId = setInterval(updateStatus, 100);
    updateStatus();

    return () => clearInterval(intervalId);
  }, [renderingEngineId, viewportId, getRenderingEngine]);

  if (totalImages <= 1) return null;

  const percentage = totalImages > 1 ? (currentIndex / (totalImages - 1)) * 100 : 0;

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  } as const;

  const validPositions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
  type ValidPosition = typeof validPositions[number];
  const isValidPosition = validPositions.includes(position as ValidPosition);
  const safePositionClass = isValidPosition
    ? positionClasses[position as ValidPosition]
    : positionClasses['bottom-left'];

  return (
    <Card className={cn(
      'absolute p-3 bg-background/90 backdrop-blur-sm border-border/50 min-w-[90px]',
      safePositionClass,
    )}>
      <div className="space-y-2">
        <Progress
          value={percentage}
          className="h-1"
        />
        <Badge
          variant="secondary"
          className="w-full justify-center text-xs"
        >
          {currentIndex + 1} / {totalImages}
        </Badge>
      </div>
    </Card>
  );
};
