/**
 * useViewportResize Hook
 * Manages viewport resize behavior and responsive sizing
 * Provides automated resize handling and size constraints
 */
import { log } from '../utils/logger';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { IViewport } from '@/types';
interface ResizeConfig {
  enableAutoResize?: boolean;
  maintainAspectRatio?: boolean;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  debounceMs?: number;
}

interface ViewportSize {
  width: number;
  height: number;
  aspectRatio: number;
}

interface UseViewportResizeReturn {
  size: ViewportSize;
  isResizing: boolean;
  resize: (width: number, height: number) => void;
  resetSize: () => void;
  fitToContainer: (container: HTMLElement) => void;
}

export function useViewportResize(viewport: IViewport | null, config: ResizeConfig = {}): UseViewportResizeReturn {
  const {
    enableAutoResize = true,
    maintainAspectRatio = false,
    minWidth = 100,
    minHeight = 100,
    maxWidth = 4096,
    maxHeight = 4096,
    debounceMs = 100,
  } = config;

  const [size, setSize] = useState<ViewportSize>({
    width: 512,
    height: 512,
    aspectRatio: 1,
  });
  const [isResizing, setIsResizing] = useState(false);

  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const originalAspectRatioRef = useRef<number>(1);

  // Update size from viewport
  const updateSizeFromViewport = useCallback(() => {
    if (!viewport?.canvas) {
      return;
    }

    const canvas = viewport.canvas;
    const newSize: ViewportSize = {
      width: canvas.width,
      height: canvas.height,
      aspectRatio: canvas.width / canvas.height,
    };

    setSize(newSize);
    return newSize;
  }, [viewport]);

  // Resize viewport with constraints
  const resize = useCallback(
    (width: number, height: number) => {
      if (!viewport?.canvas) {
        console.warn('Cannot resize: viewport or canvas not available');
        return;
      }

      setIsResizing(true);

      try {
        // Apply size constraints
        let constrainedWidth = Math.max(minWidth, Math.min(maxWidth, width));
        let constrainedHeight = Math.max(minHeight, Math.min(maxHeight, height));

        // Maintain aspect ratio if enabled
        if (maintainAspectRatio) {
          const targetRatio = originalAspectRatioRef.current;
          const currentRatio = constrainedWidth / constrainedHeight;

          if (currentRatio > targetRatio) {
            // Width is too large
            constrainedWidth = constrainedHeight * targetRatio;
          } else if (currentRatio < targetRatio) {
            // Height is too large
            constrainedHeight = constrainedWidth / targetRatio;
          }

          // Re-apply constraints after aspect ratio adjustment
          constrainedWidth = Math.max(minWidth, Math.min(maxWidth, constrainedWidth));
          constrainedHeight = Math.max(minHeight, Math.min(maxHeight, constrainedHeight));
        }

        // Resize canvas
        const canvas = viewport.canvas;
        canvas.width = constrainedWidth;
        canvas.height = constrainedHeight;

        // Update canvas style
        canvas.style.width = `${constrainedWidth}px`;
        canvas.style.height = `${constrainedHeight}px`;

        // Trigger viewport resize
        viewport.resize();
        viewport.render();

        // Update size state
        const newSize: ViewportSize = {
          width: constrainedWidth,
          height: constrainedHeight,
          aspectRatio: constrainedWidth / constrainedHeight,
        };
        setSize(newSize);

        log.info(`Viewport resized to: ${constrainedWidth}×${constrainedHeight}`);
      } catch (error) {
        console.error('Failed to resize viewport:', error);
      } finally {
        setIsResizing(false);
      }
    },
    [viewport, minWidth, minHeight, maxWidth, maxHeight, maintainAspectRatio],
  );

  // Debounced resize function
  const debouncedResize = useCallback(
    (width: number, height: number) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        resize(width, height);
      }, debounceMs);
    },
    [resize, debounceMs],
  );

  // Reset to original size
  const resetSize = useCallback(() => {
    if (!viewport?.canvas) {
      return;
    }

    const canvas = viewport.canvas;
    const element = canvas.parentElement;

    if (element) {
      const rect = element.getBoundingClientRect();
      resize(rect.width, rect.height);
    } else {
      // Fallback to default size
      resize(512, 512);
    }
  }, [viewport, resize]);

  // Fit to container element
  const fitToContainer = useCallback(
    (container: HTMLElement) => {
      if (!viewport?.canvas) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const padding = 16; // Account for padding

      resize(Math.max(minWidth, rect.width - padding * 2), Math.max(minHeight, rect.height - padding * 2));
    },
    [viewport, resize, minWidth, minHeight],
  );

  // Initialize original aspect ratio
  useEffect(() => {
    if (viewport?.canvas) {
      const canvas = viewport.canvas;
      originalAspectRatioRef.current = canvas.width / canvas.height;
      updateSizeFromViewport();
    }
  }, [viewport, updateSizeFromViewport]);

  // Setup resize observer for automatic resizing
  useEffect(() => {
    if (!enableAutoResize || !viewport?.canvas) {
      return;
    }

    const canvas = viewport.canvas;
    const element = canvas.parentElement;

    if (!element) {
      return;
    }

    // Create resize observer
    resizeObserverRef.current = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;

        // Skip if size hasn't actually changed
        if (width === size.width && height === size.height) {
          continue;
        }

        debouncedResize(width, height);
      }
    });

    // Observe parent element
    resizeObserverRef.current.observe(element);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [enableAutoResize, viewport, size.width, size.height, debouncedResize]);

  // Handle window resize for fullscreen mode
  useEffect(() => {
    if (!enableAutoResize) {
      return;
    }

    const handleWindowResize = (): void => {
      if (document.fullscreenElement && viewport?.canvas) {
        debouncedResize(window.innerWidth, window.innerHeight);
      }
    };

    window.addEventListener('resize', handleWindowResize);
    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [enableAutoResize, viewport, debouncedResize]);

  // Cleanup debounce timeout
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    size,
    isResizing,
    resize,
    resetSize,
    fitToContainer,
  };
}
