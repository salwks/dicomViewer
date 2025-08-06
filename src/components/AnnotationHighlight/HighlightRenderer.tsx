/**
 * Annotation Highlight Renderer Component
 * Advanced highlighting system for selected annotations with sky blue color
 * Task 34.2: Implement Highlight Visualization System
 * Built with shadcn/ui components
 */

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { AnnotationCompat, AnnotationCompatLayer } from '../../types/annotation-compat';
import { log } from '../../utils/logger';

export interface HighlightStyle {
  color: string;
  thickness: number;
  opacity: number;
  dashPattern?: number[];
  glowRadius?: number;
  pulseEnabled?: boolean;
  pulseSpeed?: number;
}

export interface HighlightOptions {
  style: HighlightStyle;
  duration?: number; // Animation duration in ms
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  priority?: number; // Higher priority highlights overlay lower ones
  persistent?: boolean; // Whether highlight persists until manually removed
  interactive?: boolean; // Whether highlight responds to user interaction
}

export interface HighlightRendererProps {
  annotations: AnnotationCompat[];
  selectedAnnotationIds: Set<string>;
  viewportId: string;
  className?: string;
  onHighlightClick?: (annotationId: string, event: React.MouseEvent) => void;
  onHighlightHover?: (annotationId: string, event: React.MouseEvent) => void;
  highlightOptions?: Partial<HighlightOptions>;
  disabled?: boolean;
}

// Default sky blue highlight style as specified in requirements
const DEFAULT_HIGHLIGHT_STYLE: HighlightStyle = {
  color: '#87CEEB', // Sky blue color from requirements
  thickness: 3,
  opacity: 0.8,
  glowRadius: 8,
  pulseEnabled: true,
  pulseSpeed: 2000, // 2 second pulse cycle
};

const DEFAULT_HIGHLIGHT_OPTIONS: HighlightOptions = {
  style: DEFAULT_HIGHLIGHT_STYLE,
  duration: 300,
  easing: 'ease-out',
  priority: 1,
  persistent: true,
  interactive: true,
};

export const HighlightRenderer: React.FC<HighlightRendererProps> = ({
  annotations,
  selectedAnnotationIds,
  viewportId,
  className,
  onHighlightClick,
  onHighlightHover,
  highlightOptions = {},
  disabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const highlightStateRef = useRef<Map<string, {
    startTime: number;
    animation: 'fade-in' | 'fade-out' | 'pulse' | 'none';
    opacity: number;
  }>>(new Map());

  // Merge options with defaults
  const options = useMemo(() => ({
    ...DEFAULT_HIGHLIGHT_OPTIONS,
    ...highlightOptions,
    style: {
      ...DEFAULT_HIGHLIGHT_STYLE,
      ...highlightOptions.style,
    },
  }), [highlightOptions]);

  // Apply dynamic styles via CSS properties
  useEffect(() => {
    // Apply image rendering style to canvas
    if (canvasRef.current) {
      canvasRef.current.style.imageRendering = 'crisp-edges';
    }

    // Apply dynamic colors to badges
    const styledElements = document.querySelectorAll('[data-style-color]');
    styledElements.forEach((element) => {
      const color = element.getAttribute('data-style-color');
      if (color && element instanceof HTMLElement) {
        element.style.borderColor = color;
        element.style.color = color;
      }
    });
  }, [options.style.color]);

  // Get annotation bounds for highlighting
  const getAnnotationBounds = useCallback((annotation: AnnotationCompat) => {
    try {
      // In a real implementation, this would extract bounds from annotation geometry
      // For now, we'll simulate bounds based on annotation data
      const mockBounds = {
        x: 100 + Math.random() * 400,
        y: 100 + Math.random() * 300,
        width: 50 + Math.random() * 100,
        height: 50 + Math.random() * 100,
      };

      return mockBounds;
    } catch (error) {
      log.warn('Failed to get annotation bounds', {
        component: 'HighlightRenderer',
        metadata: { annotationId: annotation.id },
      }, error as Error);
      return null;
    }
  }, []);

  // Render single highlight
  const renderHighlight = useCallback((
    ctx: CanvasRenderingContext2D,
    _annotation: AnnotationCompat,
    bounds: { x: number; y: number; width: number; height: number },
    highlightState: { opacity: number; animation: string },
  ) => {
    const { style } = options;

    ctx.save();

    // Set up highlight style
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.thickness;
    ctx.globalAlpha = highlightState.opacity * style.opacity;

    // Add glow effect if enabled
    if (style.glowRadius && style.glowRadius > 0) {
      ctx.shadowColor = style.color;
      ctx.shadowBlur = style.glowRadius;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // Set dash pattern if specified
    if (style.dashPattern) {
      ctx.setLineDash(style.dashPattern);
    }

    // Draw highlight border
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

    // Add corner indicators for better visibility
    const cornerSize = 8;
    const corners = [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      { x: bounds.x, y: bounds.y + bounds.height },
    ];

    ctx.fillStyle = style.color;
    corners.forEach(corner => {
      ctx.fillRect(corner.x - cornerSize / 2, corner.y - cornerSize / 2, cornerSize, cornerSize);
    });

    ctx.restore();
  }, [options]);

  // Update highlight animations
  const updateHighlightAnimations = useCallback((currentTime: number) => {
    const highlightStates = highlightStateRef.current;
    let needsRedraw = false;

    selectedAnnotationIds.forEach(annotationId => {
      let state = highlightStates.get(annotationId);

      if (!state) {
        // Initialize new highlight
        state = {
          startTime: currentTime,
          animation: 'fade-in',
          opacity: 0,
        };
        highlightStates.set(annotationId, state);
        needsRedraw = true;
      }

      const elapsed = currentTime - state.startTime;

      // Update animation state
      switch (state.animation) {
        case 'fade-in':
          if (elapsed < (options.duration || 300)) {
            state.opacity = elapsed / (options.duration || 300);
            needsRedraw = true;
          } else {
            state.opacity = 1;
            state.animation = options.style.pulseEnabled ? 'pulse' : 'none';
            needsRedraw = true;
          }
          break;

        case 'pulse':
          if (options.style.pulseEnabled && options.style.pulseSpeed) {
            const pulsePhase = (elapsed % options.style.pulseSpeed) / options.style.pulseSpeed;
            state.opacity = 0.5 + 0.5 * Math.sin(pulsePhase * Math.PI * 2);
            needsRedraw = true;
          }
          break;

        case 'fade-out':
          if (elapsed < (options.duration || 300)) {
            state.opacity = 1 - (elapsed / (options.duration || 300));
            needsRedraw = true;
          } else {
            highlightStates.delete(annotationId);
            needsRedraw = true;
          }
          break;
      }
    });

    // Clean up highlights for deselected annotations
    Array.from(highlightStates.keys()).forEach(annotationId => {
      if (!selectedAnnotationIds.has(annotationId)) {
        const state = highlightStates.get(annotationId)!;
        if (state.animation !== 'fade-out') {
          state.animation = 'fade-out';
          state.startTime = currentTime;
          needsRedraw = true;
        }
      }
    });

    return needsRedraw;
  }, [selectedAnnotationIds, options]);

  // Main render loop
  const renderHighlights = useCallback((currentTime: number = performance.now()) => {
    const canvas = canvasRef.current;
    if (!canvas || disabled) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Update animations
    const needsRedraw = updateHighlightAnimations(currentTime);

    if (needsRedraw) {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Render all active highlights
      const highlightStates = highlightStateRef.current;

      Array.from(highlightStates.entries()).forEach(([annotationId, state]) => {
        const annotation = annotations.find(a => a.id === annotationId);
        if (!annotation) return;

        const bounds = getAnnotationBounds(annotation);
        if (!bounds) return;

        renderHighlight(ctx, annotation, bounds, state);
      });
    }

    // Schedule next frame
    animationFrameRef.current = requestAnimationFrame(renderHighlights);
  }, [annotations, disabled, updateHighlightAnimations, getAnnotationBounds, renderHighlight]);

  // Handle canvas click events
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!options.interactive || !onHighlightClick) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Find clicked annotation
    for (const annotation of annotations) {
      const annotationId = AnnotationCompatLayer.getAnnotationId(annotation);
      if (!annotationId || !selectedAnnotationIds.has(annotationId)) continue;

      const bounds = getAnnotationBounds(annotation);
      if (!bounds) continue;

      if (
        x >= bounds.x &&
        x <= bounds.x + bounds.width &&
        y >= bounds.y &&
        y <= bounds.y + bounds.height
      ) {
        onHighlightClick(annotationId, event);
        break;
      }
    }
  }, [annotations, selectedAnnotationIds, options.interactive, onHighlightClick, getAnnotationBounds]);

  // Handle canvas hover events
  const handleCanvasHover = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!options.interactive || !onHighlightHover) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Find hovered annotation
    for (const annotation of annotations) {
      const annotationId = AnnotationCompatLayer.getAnnotationId(annotation);
      if (!annotationId || !selectedAnnotationIds.has(annotationId)) continue;

      const bounds = getAnnotationBounds(annotation);
      if (!bounds) continue;

      if (
        x >= bounds.x &&
        x <= bounds.x + bounds.width &&
        y >= bounds.y &&
        y <= bounds.y + bounds.height
      ) {
        onHighlightHover(annotationId, event);
        break;
      }
    }
  }, [annotations, selectedAnnotationIds, options.interactive, onHighlightHover, getAnnotationBounds]);

  // Initialize canvas and start rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size (in a real implementation, this would match viewport size)
    canvas.width = 800;
    canvas.height = 600;

    // Start render loop
    renderHighlights();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderHighlights]);

  // Clean up on unmount
  useEffect(() => {
    const currentHighlightState = highlightStateRef.current;
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      currentHighlightState.clear();
    };
  }, []);

  // Log highlight activity
  useEffect(() => {
    if (selectedAnnotationIds.size > 0) {
      log.info('Highlights rendered', {
        component: 'HighlightRenderer',
        metadata: {
          viewportId,
          selectedCount: selectedAnnotationIds.size,
          color: options.style.color,
          pulseEnabled: options.style.pulseEnabled,
        },
      });
    }
  }, [selectedAnnotationIds.size, viewportId, options.style.color, options.style.pulseEnabled]);

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardContent className="p-0">
        <div className="relative">
          <canvas
            ref={canvasRef}
            className={cn(
              'absolute inset-0 pointer-events-auto',
              'transition-opacity duration-300',
              'bg-transparent',
              disabled && 'opacity-50 pointer-events-none',
            )}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasHover}
            data-image-rendering="crisp-edges"
          />

          {/* Highlight status indicator */}
          {selectedAnnotationIds.size > 0 && (
            <div className="absolute top-2 right-2 z-10">
              <Badge
                variant="secondary"
                className={cn(
                  'text-xs bg-background/90 backdrop-blur-sm',
                  'border-border/50',
                )}
              >
                {selectedAnnotationIds.size} selected
              </Badge>
            </div>
          )}

          {/* Highlight options display (for debugging/development) */}
          {process.env.NODE_ENV === 'development' && selectedAnnotationIds.size > 0 && (
            <div className="absolute bottom-2 left-2 z-10">
              <Badge
                variant="secondary"
                className={cn(
                  'text-xs bg-background/90 backdrop-blur-sm',
                  'border-border/50 border-2',
                )}
                data-style-color={options.style.color}
              >
                {options.style.color} • {options.style.thickness}px
                {options.style.pulseEnabled && ' • pulse'}
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default HighlightRenderer;
