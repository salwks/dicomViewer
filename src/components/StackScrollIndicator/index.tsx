/**
 * Stack Scroll Indicator Component
 * Shows the current position in the image stack with a visual gauge
 */

import React, { useEffect, useState } from 'react';
import * as cornerstoneCore from '@cornerstonejs/core';
import './styles.css';

interface StackScrollIndicatorProps {
  renderingEngineId: string;
  viewportId: string;
  imageCount: number;
  currentIndex: number;
  onIndexChange?: (index: number) => void;
}

export const StackScrollIndicator: React.FC<StackScrollIndicatorProps> = ({
  renderingEngineId,
  viewportId,
  imageCount,
  currentIndex: initialIndex,
  onIndexChange,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const updateIndex = () => {
      try {
        const renderingEngine = cornerstoneCore.getRenderingEngine(renderingEngineId);
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
  }, [renderingEngineId, viewportId, currentIndex, onIndexChange]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIndex = parseInt(e.target.value);
    setCurrentIndex(newIndex);

    // Update viewport
    try {
      const renderingEngine = cornerstoneCore.getRenderingEngine(renderingEngineId);
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

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);

  if (imageCount <= 1) {
    return null; // Don't show indicator for single images
  }

  const percentage = imageCount > 1 ? (currentIndex / (imageCount - 1)) * 100 : 0;

  return (
    <div className="stack-scroll-indicator">
      {/* Horizontal Slider Only */}
      <div className="stack-slider-horizontal">
        <input
          type="range"
          min="0"
          max={imageCount - 1}
          value={currentIndex}
          onChange={handleSliderChange}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`stack-slider ${isDragging ? 'dragging' : ''}`}
          aria-label="Stack scroll position"
        />
        <div className="stack-slider-info">
          <span>Frame {currentIndex + 1} of {imageCount}</span>
          <span className="stack-slider-percentage">{Math.round(percentage)}%</span>
        </div>
      </div>

      {/* Mini Preview removed as requested by user */}
    </div>
  );
};

