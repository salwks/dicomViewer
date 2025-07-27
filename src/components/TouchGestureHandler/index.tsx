/**
 * TouchGestureHandler Component
 * Wrapper component for handling touch gestures in medical imaging viewports
 */

import React, { useRef, useEffect, useCallback, ReactNode } from 'react';
import { useTouchGestures, TouchPoint, GestureState } from '../../hooks/useTouchGestures';
import './styles.css';

export interface TouchGestureConfig {
  enablePinchZoom?: boolean;
  enablePanGesture?: boolean;
  enableTapToSelect?: boolean;
  enableDoubleTapZoom?: boolean;
  enableLongPressMenu?: boolean;
  pinchSensitivity?: number;
  panSensitivity?: number;
  doubleTapZoomFactor?: number;
  dampingFactor?: number;
  minScale?: number;
  maxScale?: number;
}

interface TouchGestureHandlerProps {
  children: ReactNode;
  config?: TouchGestureConfig;
  onZoom?: (scale: number, center: { x: number; y: number }) => void;
  onPan?: (translation: { x: number; y: number }) => void;
  onTap?: (point: TouchPoint) => void;
  onDoubleTap?: (point: TouchPoint) => void;
  onLongPress?: (point: TouchPoint) => void;
  onGestureStart?: (type: 'pinch' | 'pan') => void;
  onGestureEnd?: (type: 'pinch' | 'pan') => void;
  enabled?: boolean;
  className?: string;
}

const DEFAULT_CONFIG: Required<TouchGestureConfig> = {
  enablePinchZoom: true,
  enablePanGesture: true,
  enableTapToSelect: true,
  enableDoubleTapZoom: true,
  enableLongPressMenu: true,
  pinchSensitivity: 1.0,
  panSensitivity: 1.0,
  doubleTapZoomFactor: 2.0,
  dampingFactor: 0.8,
  minScale: 0.1,
  maxScale: 10.0,
};

export const TouchGestureHandler: React.FC<TouchGestureHandlerProps> = ({
  children,
  config = {},
  onZoom,
  onPan,
  onTap,
  onDoubleTap,
  onLongPress,
  onGestureStart,
  onGestureEnd,
  enabled = true,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gestureConfigRef = useRef({ ...DEFAULT_CONFIG, ...config });
  const lastScaleRef = useRef(1);
  const lastTranslationRef = useRef({ x: 0, y: 0 });
  const activeGestureRef = useRef<'pinch' | 'pan' | null>(null);

  // Update config when props change
  useEffect(() => {
    gestureConfigRef.current = { ...DEFAULT_CONFIG, ...config };
  }, [config]);

  // Handle pinch start
  const handlePinchStart = useCallback((_state: GestureState) => {
    if (!gestureConfigRef.current.enablePinchZoom) return;

    lastScaleRef.current = 1;
    activeGestureRef.current = 'pinch';
    onGestureStart?.('pinch');
  }, [onGestureStart]);

  // Handle pinch move
  const handlePinchMove = useCallback((state: GestureState) => {
    if (!gestureConfigRef.current.enablePinchZoom || !onZoom) return;

    const config = gestureConfigRef.current;
    let scale = state.scale * config.pinchSensitivity;

    // Apply scale limits
    scale = Math.max(config.minScale, Math.min(config.maxScale, scale));

    // Apply damping to smooth out the gesture
    const dampedScale = lastScaleRef.current + (scale - lastScaleRef.current) * config.dampingFactor;
    lastScaleRef.current = dampedScale;

    onZoom(dampedScale, state.center);
  }, [onZoom]);

  // Handle pinch end
  const handlePinchEnd = useCallback((_state: GestureState) => {
    if (!gestureConfigRef.current.enablePinchZoom) return;

    activeGestureRef.current = null;
    onGestureEnd?.('pinch');
  }, [onGestureEnd]);

  // Handle pan start
  const handlePanStart = useCallback((_state: GestureState) => {
    if (!gestureConfigRef.current.enablePanGesture) return;

    lastTranslationRef.current = { x: 0, y: 0 };
    activeGestureRef.current = 'pan';
    onGestureStart?.('pan');
  }, [onGestureStart]);

  // Handle pan move
  const handlePanMove = useCallback((state: GestureState) => {
    if (!gestureConfigRef.current.enablePanGesture || !onPan) return;

    const config = gestureConfigRef.current;
    const translation = {
      x: state.translation.x * config.panSensitivity,
      y: state.translation.y * config.panSensitivity,
    };

    // Apply damping to smooth out the gesture
    const dampedTranslation = {
      x: lastTranslationRef.current.x + (translation.x - lastTranslationRef.current.x) * config.dampingFactor,
      y: lastTranslationRef.current.y + (translation.y - lastTranslationRef.current.y) * config.dampingFactor,
    };
    lastTranslationRef.current = dampedTranslation;

    onPan(dampedTranslation);
  }, [onPan]);

  // Handle pan end
  const handlePanEnd = useCallback((_state: GestureState) => {
    if (!gestureConfigRef.current.enablePanGesture) return;

    activeGestureRef.current = null;
    onGestureEnd?.('pan');
  }, [onGestureEnd]);

  // Handle tap
  const handleTap = useCallback((point: TouchPoint) => {
    if (!gestureConfigRef.current.enableTapToSelect) return;
    onTap?.(point);
  }, [onTap]);

  // Handle double tap
  const handleDoubleTap = useCallback((point: TouchPoint) => {
    if (gestureConfigRef.current.enableDoubleTapZoom && onZoom) {
      // Zoom in/out on double tap
      const zoomFactor = gestureConfigRef.current.doubleTapZoomFactor;
      onZoom(zoomFactor, { x: point.x, y: point.y });
    }

    if (gestureConfigRef.current.enableTapToSelect) {
      onDoubleTap?.(point);
    }
  }, [onZoom, onDoubleTap]);

  // Handle long press
  const handleLongPress = useCallback((point: TouchPoint) => {
    if (!gestureConfigRef.current.enableLongPressMenu) return;
    onLongPress?.(point);
  }, [onLongPress]);

  // Initialize touch gestures
  const touchGestures = useTouchGestures({
    onPinchStart: handlePinchStart,
    onPinchMove: handlePinchMove,
    onPinchEnd: handlePinchEnd,
    onPanStart: handlePanStart,
    onPanMove: handlePanMove,
    onPanEnd: handlePanEnd,
    onTap: handleTap,
    onDoubleTap: handleDoubleTap,
    onLongPress: handleLongPress,
  }, {
    enabled,
    preventDefault: true,
  });

  // Attach event listeners to container
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    const cleanup = touchGestures.attachEventListeners(container);
    return cleanup;
  }, [enabled, touchGestures]);

  // Add CSS class for touch device optimization
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Add touch-enabled class for CSS styling
    if (enabled) {
      container.classList.add('touch-gesture-enabled');
    } else {
      container.classList.remove('touch-gesture-enabled');
    }

    return () => {
      container.classList.remove('touch-gesture-enabled');
    };
  }, [enabled]);

  return (
    <div
      ref={containerRef}
      className={`touch-gesture-handler ${className} ${
        touchGestures.isGestureActive ? 'touch-gesture-handler--active' : ''
      } ${
        activeGestureRef.current ? `touch-gesture-handler--${activeGestureRef.current}` : ''
      }`}
      style={{
        touchAction: enabled ? 'none' : 'auto',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {children}

      {/* Visual feedback for active gestures */}
      {touchGestures.isGestureActive && (
        <div className="touch-gesture-handler__feedback">
          <div className="touch-gesture-handler__gesture-indicator">
            {activeGestureRef.current === 'pinch' && (
              <div className="touch-gesture-handler__pinch-indicator">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M2 12h20" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </div>
            )}
            {activeGestureRef.current === 'pan' && (
              <div className="touch-gesture-handler__pan-indicator">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3" />
                </svg>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
