/**
 * useViewportInteraction Hook
 * Manages input device bindings and viewport interaction
 * Provides keyboard shortcuts and mouse/touch event handling
 */
import { log } from '../utils/logger';
import { safePropertyAccess } from '../lib/utils';

import { useEffect, useCallback, useRef } from 'react';
import type { IViewport } from '@/types';
import { setActiveTool, type ToolName } from '@/config/tools';
import { Enums as ToolEnums } from '@cornerstonejs/tools';
interface InteractionConfig {
  enableKeyboardShortcuts?: boolean;
  enableTouchGestures?: boolean;
  enableMouseWheel?: boolean;
  toolGroupId?: string;
}

interface UseViewportInteractionReturn {
  registerViewport: (viewport: IViewport | null) => void;
  unregisterViewport: () => void;
  setTool: (toolName: ToolName) => void;
  currentTool: ToolName | null;
}

// Keyboard shortcuts mapping
const KEYBOARD_SHORTCUTS: Record<string, ToolName> = {
  w: 'WindowLevel',
  p: 'Pan',
  z: 'Zoom',
  s: 'StackScroll',
  l: 'Length',
  a: 'Angle',
  r: 'RectangleROI',
  e: 'EllipticalROI',
  t: 'ArrowAnnotate',
};

// Mouse button mapping for tools
// const DEFAULT_MOUSE_BINDINGS = {
//   primary: 'WindowLevel',
//   secondary: 'Pan',
//   auxiliary: 'Zoom',
//   wheel: 'StackScroll',
// } as const

export function useViewportInteraction(config: InteractionConfig = {}): UseViewportInteractionReturn {
  const { enableKeyboardShortcuts = true, enableTouchGestures = true, enableMouseWheel = true, toolGroupId } = config;

  const viewportRef = useRef<IViewport | null>(null);
  const currentToolRef = useRef<ToolName>('WindowLevel');
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Set active tool
  const setTool = useCallback(
    (toolName: ToolName) => {
      try {
        setActiveTool(toolName, toolGroupId);
        currentToolRef.current = toolName;
        log.info(`Tool activated via interaction: ${toolName}`);
      } catch (error) {
        console.error('Failed to set tool:', error);
      }
    },
    [toolGroupId],
  );

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enableKeyboardShortcuts) {
        return;
      }

      // Skip if user is typing in an input field
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const key = event.key.toLowerCase();

      // Check for tool shortcut
      const shortcutTool = safePropertyAccess(KEYBOARD_SHORTCUTS, key);
      if (shortcutTool) {
        event.preventDefault();
        setTool(shortcutTool);
        return;
      }

      // Additional keyboard controls
      switch (key) {
        case 'escape':
          // Reset to default tool
          setTool('WindowLevel');
          break;
        case 'delete':
        case 'backspace':
          // Delete selected annotation
          if (viewportRef.current) {
            // TODO: Implement annotation deletion
            log.info('Delete annotation requested');
          }
          break;
        case 'h':
          // Toggle flip horizontal
          if (viewportRef.current) {
            try {
              const camera = viewportRef.current.getCamera();
              if (camera?.viewUp) {
                camera.viewUp = [camera.viewUp[0], -camera.viewUp[1], camera.viewUp[2]];
                viewportRef.current.setCamera(camera);
                viewportRef.current.render();
              }
            } catch (error) {
              console.error('Failed to flip horizontal:', error);
            }
          }
          break;
        case 'v':
          // Toggle flip vertical
          if (viewportRef.current) {
            try {
              const camera = viewportRef.current.getCamera();
              if (camera?.viewUp) {
                camera.viewUp = [-camera.viewUp[0], camera.viewUp[1], camera.viewUp[2]];
                viewportRef.current.setCamera(camera);
                viewportRef.current.render();
              }
            } catch (error) {
              console.error('Failed to flip vertical:', error);
            }
          }
          break;
        case 'f':
          // Fit to window
          if (viewportRef.current) {
            try {
              viewportRef.current.resetCamera();
              viewportRef.current.render();
            } catch (error) {
              console.error('Failed to fit to window:', error);
            }
          }
          break;
      }
    },
    [enableKeyboardShortcuts, setTool],
  );

  // Handle mouse wheel
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      if (!enableMouseWheel || !viewportRef.current) {
        return;
      }

      const element = viewportRef.current.canvas;
      if (!element?.contains(event.target as Node)) {
        return;
      }

      // Ctrl + Wheel = Zoom
      if (event.ctrlKey) {
        event.preventDefault();
        const delta = event.deltaY > 0 ? 1.1 : 0.9;

        try {
          const camera = viewportRef.current.getCamera();
          if (camera?.parallelScale) {
            camera.parallelScale = camera.parallelScale * delta;
            viewportRef.current.setCamera(camera);
            viewportRef.current.render();
          }
        } catch (error) {
          console.error('Failed to zoom with wheel:', error);
        }
      }
      // Default wheel = Stack scroll (handled by StackScrollTool)
    },
    [enableMouseWheel],
  );

  // Handle touch gestures
  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      if (!enableTouchGestures || !viewportRef.current) {
        return;
      }

      const element = viewportRef.current.canvas;
      if (!element?.contains(event.target as Node)) {
        return;
      }

      if (event.touches.length === 1) {
        const touch = event.touches[0];
        if (touch) {
          touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now(),
          };
        }
      }
    },
    [enableTouchGestures],
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!enableTouchGestures || !viewportRef.current) {
        return;
      }

      const element = viewportRef.current.canvas;
      if (!element?.contains(event.target as Node)) {
        return;
      }

      // Pinch to zoom
      if (event.touches.length === 2) {
        event.preventDefault();
        // TODO: Implement pinch zoom
        log.info('Pinch zoom gesture detected');
      }
    },
    [enableTouchGestures],
  );

  const handleTouchEnd = useCallback(
    (event: TouchEvent) => {
      if (!enableTouchGestures || !viewportRef.current || !touchStartRef.current) {
        return;
      }

      const element = viewportRef.current.canvas;
      if (!element?.contains(event.target as Node)) {
        return;
      }

      const touchEnd = event.changedTouches[0];
      if (!touchEnd) {
        return;
      }

      const deltaX = Math.abs(touchEnd.clientX - touchStartRef.current.x);
      const deltaY = Math.abs(touchEnd.clientY - touchStartRef.current.y);
      const deltaTime = Date.now() - touchStartRef.current.time;

      // Double tap detection
      if (deltaX < 10 && deltaY < 10 && deltaTime < 300) {
        // Check for double tap
        const lastTap = touchStartRef.current.time;
        if (lastTap && Date.now() - lastTap < 500) {
          // Double tap - reset viewport
          try {
            viewportRef.current.resetCamera();
            viewportRef.current.render();
            log.info('Double tap reset');
          } catch (error) {
            console.error('Failed to reset on double tap:', error);
          }
        }
      }

      touchStartRef.current = null;
    },
    [enableTouchGestures],
  );

  // Register viewport
  const registerViewport = useCallback(
    (viewport: IViewport | null) => {
      viewportRef.current = viewport;

      if (viewport) {
        log.info('Viewport registered for interaction');

        // Set default tool bindings
        try {
          setActiveTool('WindowLevel', toolGroupId, ToolEnums.MouseBindings.Primary);
          setActiveTool('Pan', toolGroupId, ToolEnums.MouseBindings.Auxiliary);
          setActiveTool('Zoom', toolGroupId, ToolEnums.MouseBindings.Secondary);
        } catch (error) {
          console.error('Failed to set default tool bindings:', error);
        }
      }
    },
    [toolGroupId],
  );

  // Unregister viewport
  const unregisterViewport = useCallback(() => {
    viewportRef.current = null;
    log.info('Viewport unregistered from interaction');
  }, []);

  // Setup event listeners
  useEffect(() => {
    // Keyboard events
    if (enableKeyboardShortcuts) {
      window.addEventListener('keydown', handleKeyDown);
    }

    // Mouse wheel events
    if (enableMouseWheel) {
      window.addEventListener('wheel', handleWheel, { passive: false });
    }

    // Touch events
    if (enableTouchGestures) {
      window.addEventListener('touchstart', handleTouchStart, { passive: true });
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    // Cleanup
    return () => {
      if (enableKeyboardShortcuts) {
        window.removeEventListener('keydown', handleKeyDown);
      }
      if (enableMouseWheel) {
        window.removeEventListener('wheel', handleWheel);
      }
      if (enableTouchGestures) {
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [
    enableKeyboardShortcuts,
    enableMouseWheel,
    enableTouchGestures,
    handleKeyDown,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  ]);

  return {
    registerViewport,
    unregisterViewport,
    setTool,
    currentTool: currentToolRef.current,
  };
}
