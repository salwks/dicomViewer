/**
 * Cross-Reference Lines Component
 * Renders visual cross-reference lines between synchronized viewports
 * Built with shadcn/ui components and Cornerstone3D integration
 */

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';

// Type definitions for cross-reference lines
export interface CrossReferencePoint {
  x: number;
  y: number;
  viewportId: string;
}

export interface CrossReferenceLine {
  id: string;
  sourcePoint: CrossReferencePoint;
  targetPoint: CrossReferencePoint;
  color: string;
  visible: boolean;
  label?: string;
}

// Re-export types for convenience
export type { CrossReferencePoint as CrossReferencePos };
export type { CrossReferenceLine as CrossRefLine };

export interface CrossReferenceLinesProps {
  lines: CrossReferenceLine[];
  viewportId: string;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  enabled?: boolean;
  lineWidth?: number;
  opacity?: number;
  showLabels?: boolean;
  className?: string;
}

// Color palette for cross-reference lines using Tailwind colors
const LINE_COLORS = {
  axial: '#ef4444',      // red-500
  sagittal: '#22c55e',   // green-500
  coronal: '#3b82f6',    // blue-500
  oblique: '#a855f7',    // purple-500
} as const;

export const CrossReferenceLines: React.FC<CrossReferenceLinesProps> = ({
  lines,
  viewportId,
  canvasRef,
  enabled = true,
  lineWidth = 2,
  opacity = 0.8,
  showLabels = true,
  className = '',
}) => {
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isVisible, setIsVisible] = useState(enabled);

  // Apply dynamic colors to line indicators
  useEffect(() => {
    const lineIndicators = document.querySelectorAll('[data-line-color]');
    lineIndicators.forEach((element) => {
      const color = element.getAttribute('data-line-color');
      if (color && element instanceof HTMLElement) {
        element.style.backgroundColor = color;
      }
    });
  });

  // Render cross-reference lines on overlay canvas
  const renderLines = React.useCallback((): void => {
    if (!overlayCanvasRef.current || !canvasRef.current || !enabled) {
      return;
    }

    const overlayCanvas = overlayCanvasRef.current;
    const sourceCanvas = canvasRef.current;
    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;

    // Match overlay canvas size to source canvas
    if (overlayCanvas.width !== sourceCanvas.width ||
        overlayCanvas.height !== sourceCanvas.height) {
      overlayCanvas.width = sourceCanvas.width;
      overlayCanvas.height = sourceCanvas.height;
    }

    // Clear previous frame
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    // Filter lines for current viewport
    const viewportLines = lines.filter(line =>
      line.sourcePoint.viewportId === viewportId ||
      line.targetPoint.viewportId === viewportId,
    );

    // Render each line
    viewportLines.forEach(line => {
      if (!line.visible) return;

      const point = line.sourcePoint.viewportId === viewportId
        ? line.sourcePoint
        : line.targetPoint;

      // Set line style
      ctx.strokeStyle = line.color;
      ctx.lineWidth = lineWidth;
      ctx.globalAlpha = opacity;
      ctx.setLineDash([5, 5]);

      // Draw horizontal line
      ctx.beginPath();
      ctx.moveTo(0, point.y);
      ctx.lineTo(overlayCanvas.width, point.y);
      ctx.stroke();

      // Draw vertical line
      ctx.beginPath();
      ctx.moveTo(point.x, 0);
      ctx.lineTo(point.x, overlayCanvas.height);
      ctx.stroke();

      // Draw center intersection circle
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = line.color;
      ctx.globalAlpha = opacity * 0.8;
      ctx.fill();

      // Reset line dash
      ctx.setLineDash([]);

      // Draw label if enabled
      if (showLabels && line.label) {
        ctx.fillStyle = line.color;
        ctx.globalAlpha = 1;
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(line.label, point.x + 10, point.y - 10);
      }
    });

    // Reset global alpha
    ctx.globalAlpha = 1;
  }, [lines, viewportId, canvasRef, enabled, lineWidth, opacity, showLabels]);

  // Animation loop for smooth rendering
  const animate = React.useCallback((): void => {
    renderLines();
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [renderLines]);

  // Start/stop animation based on visibility
  useEffect(() => {
    if (enabled && isVisible) {
      animate();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      // Clear canvas when disabled
      const ctx = overlayCanvasRef.current?.getContext('2d');
      if (ctx && overlayCanvasRef.current) {
        ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      }
    }

    return (): void => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled, isVisible, animate]);

  // Update visibility when enabled prop changes
  useEffect(() => {
    setIsVisible(enabled);
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  const activeLines = lines.filter(line =>
    (line.sourcePoint.viewportId === viewportId ||
     line.targetPoint.viewportId === viewportId) &&
    line.visible,
  );

  return (
    <div className={cn('absolute inset-0 pointer-events-none', className)}>
      {/* Overlay canvas for cross-reference lines */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 w-full h-full z-10"
      />

      {/* Status indicator */}
      {activeLines.length > 0 && (
        <Card className={cn(
          'absolute top-2 right-2 p-2',
          'bg-background/80 backdrop-blur-sm border-border/50',
        )}>
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="text-xs"
            >
              Cross-Reference
            </Badge>
            <div className="flex items-center gap-1">
              {activeLines.map((line) => (
                <div
                  key={line.id}
                  className="w-2 h-2 rounded-full bg-current"
                  data-line-color={line.color}
                  title={line.label}
                />
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

// Helper function to calculate cross-reference points
export function calculateCrossReferencePoint(
  _sourceCamera: { position: [number, number, number]; focalPoint: [number, number, number] },
  targetViewport: { width: number; height: number; camera: unknown },
): CrossReferencePoint | null {
  // This is a simplified calculation
  // In a real implementation, this would use Cornerstone3D's coordinate transformation
  try {
    // For now, return center point
    return {
      x: targetViewport.width / 2,
      y: targetViewport.height / 2,
      viewportId: '', // Will be set by caller
    };
  } catch (error) {
    console.error('Failed to calculate cross-reference point:', error);
    return null;
  }
}

// Default line configurations
export const DEFAULT_LINE_CONFIGS = {
  axial: { color: LINE_COLORS.axial, label: 'Axial' },
  sagittal: { color: LINE_COLORS.sagittal, label: 'Sagittal' },
  coronal: { color: LINE_COLORS.coronal, label: 'Coronal' },
  oblique: { color: LINE_COLORS.oblique, label: 'Oblique' },
};
