/**
 * Image Navigation Hook
 * Handles image navigation and stack management
 */

import { useState, useCallback } from 'react';

export const useImageNavigation = (imageIds: string[]) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const navigateToNext = useCallback(() => {
    if (currentImageIndex < imageIds.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  }, [currentImageIndex, imageIds.length]);

  const navigateToPrevious = useCallback(() => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  }, [currentImageIndex]);

  const navigateToIndex = useCallback(
    (index: number) => {
      if (index >= 0 && index < imageIds.length) {
        setCurrentImageIndex(index);
      }
    },
    [imageIds.length],
  );

  const canNavigateNext = currentImageIndex < imageIds.length - 1;
  const canNavigatePrevious = currentImageIndex > 0;

  const resetNavigation = useCallback(() => {
    setCurrentImageIndex(0);
  }, []);

  return {
    currentImageIndex,
    navigateToNext,
    navigateToPrevious,
    navigateToIndex,
    canNavigateNext,
    canNavigatePrevious,
    resetNavigation,
    setCurrentImageIndex,
  };
};
