/**
 * useTouchGestures Hook
 * Touch gesture recognition and handling for medical imaging viewer
 */

import { useCallback, useRef, useEffect, useMemo } from 'react';

export interface TouchPoint {
  x: number;
  y: number;
  id: number;
}

export interface GestureState {
  isActive: boolean;
  startPoints: TouchPoint[];
  currentPoints: TouchPoint[];
  center: { x: number; y: number };
  distance: number;
  angle: number;
  scale: number;
  translation: { x: number; y: number };
  velocity: { x: number; y: number };
  timestamp: number;
}

export interface GestureCallbacks {
  onTouchStart?: (state: GestureState) => void;
  onTouchMove?: (state: GestureState) => void;
  onTouchEnd?: (state: GestureState) => void;
  onPinchStart?: (state: GestureState) => void;
  onPinchMove?: (state: GestureState) => void;
  onPinchEnd?: (state: GestureState) => void;
  onPanStart?: (state: GestureState) => void;
  onPanMove?: (state: GestureState) => void;
  onPanEnd?: (state: GestureState) => void;
  onTap?: (point: TouchPoint) => void;
  onDoubleTap?: (point: TouchPoint) => void;
  onLongPress?: (point: TouchPoint) => void;
}

interface UseTouchGesturesOptions {
  enabled?: boolean;
  pinchThreshold?: number;
  panThreshold?: number;
  doubleTapDelay?: number;
  longPressDelay?: number;
  maxTapDistance?: number;
  preventDefault?: boolean;
}

const DEFAULT_OPTIONS: Required<UseTouchGesturesOptions> = {
  enabled: true,
  pinchThreshold: 10,
  panThreshold: 5,
  doubleTapDelay: 300,
  longPressDelay: 500,
  maxTapDistance: 10,
  preventDefault: true,
};

// Helper functions
const getTouchPoints = (touches: TouchList): TouchPoint[] => {
  return Array.from(touches).map(touch => ({
    x: touch.clientX,
    y: touch.clientY,
    id: touch.identifier,
  }));
};

const getDistance = (p1: TouchPoint, p2: TouchPoint): number => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const getCenter = (points: TouchPoint[]): { x: number; y: number } => {
  if (points.length === 0) return { x: 0, y: 0 };

  const sum = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 },
  );

  return {
    x: sum.x / points.length,
    y: sum.y / points.length,
  };
};

const getAngle = (p1: TouchPoint, p2: TouchPoint): number => {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
};

const getScale = (startDistance: number, currentDistance: number): number => {
  return startDistance > 0 ? currentDistance / startDistance : 1;
};

export const useTouchGestures = (
  callbacks: GestureCallbacks,
  options: UseTouchGesturesOptions = {},
) => {
  const opts = useMemo(() => ({ ...DEFAULT_OPTIONS, ...options }), [options]);
  const gestureStateRef = useRef<GestureState>({
    isActive: false,
    startPoints: [],
    currentPoints: [],
    center: { x: 0, y: 0 },
    distance: 0,
    angle: 0,
    scale: 1,
    translation: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    timestamp: 0,
  });

  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<{ point: TouchPoint; timestamp: number } | null>(null);
  const gestureTypeRef = useRef<'none' | 'pan' | 'pinch'>('none');
  const startDistanceRef = useRef<number>(0);
  const previousStateRef = useRef<GestureState | null>(null);

  const updateGestureState = useCallback((touches: TouchList): GestureState => {
    const currentPoints = getTouchPoints(touches);
    const center = getCenter(currentPoints);
    const timestamp = Date.now();

    let distance = 0;
    let angle = 0;
    let scale = 1;
    let translation = { x: 0, y: 0 };
    let velocity = { x: 0, y: 0 };

    if (currentPoints.length >= 2) {
      distance = getDistance(currentPoints[0], currentPoints[1]);
      angle = getAngle(currentPoints[0], currentPoints[1]);
      scale = getScale(startDistanceRef.current, distance);
    }

    const state = gestureStateRef.current;
    if (state.startPoints.length > 0) {
      const startCenter = getCenter(state.startPoints);
      translation = {
        x: center.x - startCenter.x,
        y: center.y - startCenter.y,
      };

      // Calculate velocity
      if (previousStateRef.current) {
        const dt = timestamp - previousStateRef.current.timestamp;
        if (dt > 0) {
          velocity = {
            x: (center.x - previousStateRef.current.center.x) / dt,
            y: (center.y - previousStateRef.current.center.y) / dt,
          };
        }
      }
    }

    const newState: GestureState = {
      isActive: true,
      startPoints: state.startPoints,
      currentPoints,
      center,
      distance,
      angle,
      scale,
      translation,
      velocity,
      timestamp,
    };

    gestureStateRef.current = newState;
    previousStateRef.current = newState;

    return newState;
  }, []);

  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (!opts.enabled) return;

    if (opts.preventDefault) {
      event.preventDefault();
    }

    const touches = event.touches;
    const currentPoints = getTouchPoints(touches);

    // Clear timeouts
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
    }

    // Initialize gesture state
    gestureStateRef.current = {
      isActive: true,
      startPoints: currentPoints,
      currentPoints,
      center: getCenter(currentPoints),
      distance: 0,
      angle: 0,
      scale: 1,
      translation: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      timestamp: Date.now(),
    };

    // Set initial distance for pinch gestures
    if (currentPoints.length >= 2) {
      startDistanceRef.current = getDistance(currentPoints[0], currentPoints[1]);
    }

    gestureTypeRef.current = 'none';

    // Setup long press detection for single touch
    if (currentPoints.length === 1) {
      longPressTimeoutRef.current = setTimeout(() => {
        if (gestureTypeRef.current === 'none') {
          callbacks.onLongPress?.(currentPoints[0]);
        }
      }, opts.longPressDelay);
    }

    const state = gestureStateRef.current;
    callbacks.onTouchStart?.(state);
  }, [opts, callbacks]);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (!opts.enabled || !gestureStateRef.current.isActive) return;

    if (opts.preventDefault) {
      event.preventDefault();
    }

    const state = updateGestureState(event.touches);

    // Determine gesture type
    if (gestureTypeRef.current === 'none') {
      if (state.currentPoints.length >= 2) {
        // Multi-touch: pinch/zoom
        if (Math.abs(state.scale - 1) > opts.pinchThreshold / 100) {
          gestureTypeRef.current = 'pinch';
          callbacks.onPinchStart?.(state);
        }
      } else if (state.currentPoints.length === 1) {
        // Single touch: pan
        const distance = Math.sqrt(
          state.translation.x ** 2 + state.translation.y ** 2,
        );
        if (distance > opts.panThreshold) {
          gestureTypeRef.current = 'pan';
          callbacks.onPanStart?.(state);

          // Clear long press timeout when panning starts
          if (longPressTimeoutRef.current) {
            clearTimeout(longPressTimeoutRef.current);
          }
        }
      }
    }

    // Call appropriate move callback
    if (gestureTypeRef.current === 'pinch') {
      callbacks.onPinchMove?.(state);
    } else if (gestureTypeRef.current === 'pan') {
      callbacks.onPanMove?.(state);
    }

    callbacks.onTouchMove?.(state);
  }, [opts, callbacks, updateGestureState]);

  const handleTouchEnd = useCallback((event: TouchEvent) => {
    if (!opts.enabled || !gestureStateRef.current.isActive) return;

    if (opts.preventDefault) {
      event.preventDefault();
    }

    const state = updateGestureState(event.touches);

    // Clear timeouts
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
    }

    // Handle gesture end
    if (gestureTypeRef.current === 'pinch') {
      callbacks.onPinchEnd?.(state);
    } else if (gestureTypeRef.current === 'pan') {
      callbacks.onPanEnd?.(state);
    } else if (gestureTypeRef.current === 'none' && state.startPoints.length === 1) {
      // Handle tap/double tap
      const startPoint = state.startPoints[0];
      const currentPoint = state.currentPoints[0] || startPoint;
      const distance = getDistance(startPoint, currentPoint);

      if (distance <= opts.maxTapDistance) {
        const now = Date.now();

        // Check for double tap
        if (lastTapRef.current) {
          const timeDiff = now - lastTapRef.current.timestamp;
          const tapDistance = getDistance(lastTapRef.current.point, currentPoint);

          if (timeDiff <= opts.doubleTapDelay && tapDistance <= opts.maxTapDistance) {
            // Double tap
            callbacks.onDoubleTap?.(currentPoint);
            lastTapRef.current = null;
            return;
          }
        }

        // Single tap (with delay to detect potential double tap)
        lastTapRef.current = { point: currentPoint, timestamp: now };
        tapTimeoutRef.current = setTimeout(() => {
          if (lastTapRef.current) {
            callbacks.onTap?.(lastTapRef.current.point);
            lastTapRef.current = null;
          }
        }, opts.doubleTapDelay);
      }
    }

    callbacks.onTouchEnd?.(state);

    // Reset gesture state if no more touches
    if (event.touches.length === 0) {
      gestureStateRef.current.isActive = false;
      gestureTypeRef.current = 'none';
      startDistanceRef.current = 0;
    }
  }, [opts, callbacks, updateGestureState]);

  const attachEventListeners = useCallback((element: HTMLElement) => {
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });
    element.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
      }
    };
  }, []);

  return {
    attachEventListeners,
    gestureState: gestureStateRef.current,
    isGestureActive: gestureStateRef.current.isActive,
  };
};
