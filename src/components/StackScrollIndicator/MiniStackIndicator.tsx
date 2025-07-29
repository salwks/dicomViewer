/**
 * Mini Stack Indicator Component
 * Compact version of stack scroll indicator for corner display
 */

import React, { useEffect, useState } from 'react';
import * as cornerstoneCore from '@cornerstonejs/core';
import './mini-styles.css';

interface MiniStackIndicatorProps {
  renderingEngineId: string;
  viewportId: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export const MiniStackIndicator: React.FC<MiniStackIndicatorProps> = ({
  renderingEngineId,
  viewportId,
  position = 'bottom-right',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalImages, setTotalImages] = useState(0);

  useEffect(() => {
    const updateStatus = () => {
      try {
        const renderingEngine = cornerstoneCore.getRenderingEngine(renderingEngineId);
        if (!renderingEngine) return;

        const viewport = renderingEngine.getViewport(viewportId) as any;
        if (!viewport) return;

        const imageIds = viewport.getImageIds?.();
        const index = viewport.getCurrentImageIdIndex?.();

        if (imageIds && typeof index === 'number') {
          setTotalImages(imageIds.length);
          setCurrentIndex(index);
        }
      } catch {
        // Ignore errors
      }
    };

    const intervalId = setInterval(updateStatus, 100);
    updateStatus();

    return () => clearInterval(intervalId);
  }, [renderingEngineId, viewportId]);

  if (totalImages <= 1) return null;

  const percentage = totalImages > 1 ? (currentIndex / (totalImages - 1)) * 100 : 0;

  return (
    <div className={`mini-stack-indicator ${position}`}>
      <div className="mini-stack-progress">
        <div
          className="mini-stack-bar"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="mini-stack-text">
        {currentIndex + 1} / {totalImages}
      </div>
    </div>
  );
};

