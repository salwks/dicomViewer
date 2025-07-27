/**
 * Text Style Renderer Component
 *
 * Renders styled text for measurements, annotations, and labels
 * Supports rich formatting, positioning, and medical-grade styling
 */

import React, { useRef, useEffect, useCallback } from 'react';
import {
  AnnotationStyling,
  AnnotationFont,
  AnnotationColor,
  AnnotationShadowStyle,
} from '../../types/annotation-styling';

/**
 * Text positioning options
 */
export interface TextPosition {
  /** X coordinate */
  x: number;
  /** Y coordinate */
  y: number;
  /** Text alignment */
  align: 'left' | 'center' | 'right';
  /** Vertical alignment */
  baseline: 'top' | 'middle' | 'bottom' | 'alphabetic';
  /** Rotation angle in degrees */
  rotation?: number;
}

/**
 * Text content configuration
 */
export interface TextContent {
  /** Main text content */
  text: string;
  /** Optional prefix (e.g., "Length: ") */
  prefix?: string;
  /** Optional suffix (e.g., " mm") */
  suffix?: string;
  /** Optional superscript text */
  superscript?: string;
  /** Optional subscript text */
  subscript?: string;
  /** Measurement value for formatting */
  value?: number;
  /** Measurement unit */
  unit?: string;
  /** Number of decimal places */
  precision?: number;
}

/**
 * Text background configuration
 */
export interface TextBackground {
  /** Background color */
  color: AnnotationColor;
  /** Background opacity */
  opacity: number;
  /** Border radius */
  borderRadius: number;
  /** Padding */
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

/**
 * Component props
 */
export interface TextStyleRendererProps {
  /** Canvas element to render on */
  canvas: HTMLCanvasElement;
  /** Text content configuration */
  content: TextContent;
  /** Text position */
  position: TextPosition;
  /** Text styling */
  styling: AnnotationStyling;
  /** Optional background */
  background?: TextBackground;
  /** Scale factor for high-DPI displays */
  pixelRatio?: number;
  /** Whether text is interactive */
  interactive?: boolean;
  /** Click handler */
  onClick?: (event: MouseEvent) => void;
  /** Hover handler */
  onHover?: (isHovering: boolean) => void;
}

/**
 * Text Style Renderer Component
 */
export const TextStyleRenderer: React.FC<TextStyleRendererProps> = ({
  canvas,
  content,
  position,
  styling,
  background,
  pixelRatio = window.devicePixelRatio || 1,
  interactive = false,
  onClick,
  onHover,
}) => {
  const renderedBounds = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  /**
   * Format measurement value
   */
  const formatMeasurementValue = useCallback((value: number, precision: number = 2, unit?: string): string => {
    const formatted = value.toFixed(precision);
    return unit ? `${formatted} ${unit}` : formatted;
  }, []);

  /**
   * Build complete text string
   */
  const buildTextString = useCallback((content: TextContent): string => {
    let text = content.text;

    if (content.value !== undefined) {
      const precision = content.precision ?? styling.measurementPrecision ?? 2;
      const formattedValue = formatMeasurementValue(content.value, precision, content.unit);
      text = formattedValue;
    }

    if (content.prefix) {
      text = content.prefix + text;
    }

    if (content.suffix) {
      text = text + content.suffix;
    }

    return text;
  }, [styling.measurementPrecision, formatMeasurementValue]);

  /**
   * Apply font styling to context
   */
  const applyFontStyle = useCallback((ctx: CanvasRenderingContext2D, font: AnnotationFont, scaleFactor: number = 1) => {
    const size = Math.round(font.size * scaleFactor * pixelRatio);
    const weight = typeof font.weight === 'number' ? font.weight.toString() : font.weight;

    ctx.font = `${font.style} ${weight} ${size}px ${font.family}`;
    ctx.textAlign = position.align;
    ctx.textBaseline = position.baseline;
  }, [position.align, position.baseline, pixelRatio]);

  /**
   * Apply color to context
   */
  const applyColor = useCallback((ctx: CanvasRenderingContext2D, color: AnnotationColor, opacity: number = 1) => {
    if (color.rgba) {
      const [r, g, b, a] = color.rgba;
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a * opacity})`;
    } else if (color.rgb) {
      const [r, g, b] = color.rgb;
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    } else {
      ctx.fillStyle = color.hex;
      ctx.globalAlpha = opacity;
    }
  }, []);

  /**
   * Apply shadow style
   */
  const applyShadow = useCallback((ctx: CanvasRenderingContext2D, shadow: AnnotationShadowStyle) => {
    ctx.shadowColor = shadow.color.hex || `rgb(${shadow.color.rgb.join(',')})`;
    ctx.shadowBlur = shadow.blur * pixelRatio;
    ctx.shadowOffsetX = shadow.offsetX * pixelRatio;
    ctx.shadowOffsetY = shadow.offsetY * pixelRatio;
  }, [pixelRatio]);

  /**
   * Clear shadow style
   */
  const clearShadow = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }, []);

  /**
   * Render text background
   */
  const renderBackground = useCallback((
    ctx: CanvasRenderingContext2D,
    textMetrics: TextMetrics,
    x: number,
    y: number,
  ) => {
    if (!background) return;

    const { padding } = background;
    const width = textMetrics.width + padding.left + padding.right;
    const height = styling.font.size * styling.font.lineHeight + padding.top + padding.bottom;

    // Calculate background position based on text alignment
    let bgX = x - padding.left;
    if (position.align === 'center') {
      bgX = x - width / 2;
    } else if (position.align === 'right') {
      bgX = x - width + padding.right;
    }

    let bgY = y - padding.top;
    if (position.baseline === 'middle') {
      bgY = y - height / 2;
    } else if (position.baseline === 'bottom') {
      bgY = y - height + padding.bottom;
    }

    // Save context state
    ctx.save();

    // Apply background color
    applyColor(ctx, background.color, background.opacity * styling.opacity);

    // Draw rounded rectangle background
    if (background.borderRadius > 0) {
      ctx.beginPath();
      ctx.roundRect(bgX, bgY, width, height, background.borderRadius);
      ctx.fill();
    } else {
      ctx.fillRect(bgX, bgY, width, height);
    }

    // Restore context state
    ctx.restore();

    // Store bounds for interaction
    renderedBounds.current = {
      x: bgX,
      y: bgY,
      width,
      height,
    };
  }, [background, styling, position, applyColor]);

  /**
   * Render superscript/subscript text
   */
  const renderScriptText = useCallback((
    ctx: CanvasRenderingContext2D,
    mainTextMetrics: TextMetrics,
    mainX: number,
    mainY: number,
  ) => {
    const scriptFont = {
      ...styling.font,
      size: styling.font.size * 0.7, // Smaller size for scripts
    };

    applyFontStyle(ctx, scriptFont, styling.scaleFactor);
    applyColor(ctx, styling.line.color, styling.opacity);

    // Calculate script positions
    let scriptX = mainX;
    if (position.align === 'left') {
      scriptX = mainX + mainTextMetrics.width;
    } else if (position.align === 'center') {
      scriptX = mainX + mainTextMetrics.width / 2;
    }

    // Render superscript
    if (content.superscript) {
      const superY = mainY - styling.font.size * 0.3;
      ctx.fillText(content.superscript, scriptX, superY);
    }

    // Render subscript
    if (content.subscript) {
      const subY = mainY + styling.font.size * 0.3;
      ctx.fillText(content.subscript, scriptX, subY);
    }
  }, [styling, position, content, applyFontStyle, applyColor]);

  /**
   * Render main text
   */
  const renderMainText = useCallback((ctx: CanvasRenderingContext2D) => {
    const textString = buildTextString(content);
    const x = position.x * pixelRatio;
    const y = position.y * pixelRatio;

    // Apply rotation if specified
    if (position.rotation) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((position.rotation * Math.PI) / 180);
      ctx.translate(-x, -y);
    }

    // Apply font styling
    applyFontStyle(ctx, styling.font, styling.scaleFactor);

    // Measure text for background rendering
    const textMetrics = ctx.measureText(textString);

    // Render background if specified
    renderBackground(ctx, textMetrics, x, y);

    // Apply shadow if specified
    if (styling.shadow) {
      applyShadow(ctx, styling.shadow);
    }

    // Apply text color
    applyColor(ctx, styling.line.color, styling.opacity);

    // Render main text
    ctx.fillText(textString, x, y);

    // Clear shadow
    if (styling.shadow) {
      clearShadow(ctx);
    }

    // Render superscript/subscript if specified
    if (content.superscript || content.subscript) {
      renderScriptText(ctx, textMetrics, x, y);
    }

    // Restore rotation transform
    if (position.rotation) {
      ctx.restore();
    }

    // Store bounds for interaction (if no background)
    if (!background) {
      renderedBounds.current = {
        x: x - (position.align === 'center' ? textMetrics.width / 2 : position.align === 'right' ? textMetrics.width : 0),
        y: y - styling.font.size,
        width: textMetrics.width,
        height: styling.font.size * styling.font.lineHeight,
      };
    }
  }, [
    content, position, styling, pixelRatio, buildTextString, applyFontStyle,
    renderBackground, applyShadow, clearShadow, applyColor, background, renderScriptText,
  ]);

  /**
   * Handle canvas interaction
   */
  const handleCanvasInteraction = useCallback((event: MouseEvent) => {
    if (!interactive || !renderedBounds.current) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * pixelRatio;
    const y = (event.clientY - rect.top) * pixelRatio;

    const bounds = renderedBounds.current;
    const isInside = x >= bounds.x && x <= bounds.x + bounds.width &&
                     y >= bounds.y && y <= bounds.y + bounds.height;

    if (event.type === 'click' && isInside && onClick) {
      onClick(event);
    } else if (event.type === 'mousemove' && onHover) {
      onHover(isInside);
    }
  }, [interactive, canvas, pixelRatio, onClick, onHover]);

  /**
   * Render text with styling
   */
  const renderText = useCallback(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Save context state
    ctx.save();

    // Apply global opacity
    ctx.globalAlpha = styling.opacity;

    // Render main text
    renderMainText(ctx);

    // Restore context state
    ctx.restore();
  }, [canvas, styling.opacity, renderMainText]);

  /**
   * Setup canvas interaction listeners
   */
  useEffect(() => {
    if (!interactive) return;

    canvas.addEventListener('click', handleCanvasInteraction);
    canvas.addEventListener('mousemove', handleCanvasInteraction);

    return () => {
      canvas.removeEventListener('click', handleCanvasInteraction);
      canvas.removeEventListener('mousemove', handleCanvasInteraction);
    };
  }, [interactive, canvas, handleCanvasInteraction]);

  /**
   * Render when props change
   */
  useEffect(() => {
    renderText();
  }, [renderText]);

  return null; // This component renders directly to canvas
};

/**
 * Text measurement utilities
 */
export class TextMeasurementUtils {
  /**
   * Measure text dimensions
   */
  static measureText(
    text: string,
    font: AnnotationFont,
    canvas: HTMLCanvasElement,
    pixelRatio: number = 1,
  ): { width: number; height: number } {
    const ctx = canvas.getContext('2d');
    if (!ctx) return { width: 0, height: 0 };

    const size = font.size * pixelRatio;
    const weight = typeof font.weight === 'number' ? font.weight.toString() : font.weight;

    ctx.font = `${font.style} ${weight} ${size}px ${font.family}`;
    const metrics = ctx.measureText(text);

    return {
      width: metrics.width / pixelRatio,
      height: (font.size * font.lineHeight) / pixelRatio,
    };
  }

  /**
   * Calculate optimal text position to avoid overlaps
   */
  static calculateOptimalPosition(
    preferredPosition: TextPosition,
    textDimensions: { width: number; height: number },
    canvasBounds: { width: number; height: number },
    existingPositions: Array<{ x: number; y: number; width: number; height: number }> = [],
  ): TextPosition {
    const { x, y, align, baseline } = preferredPosition;
    const { width, height } = textDimensions;

    // Calculate actual text bounds
    let textX = x;
    let textY = y;

    if (align === 'center') {
      textX = x - width / 2;
    } else if (align === 'right') {
      textX = x - width;
    }

    if (baseline === 'middle') {
      textY = y - height / 2;
    } else if (baseline === 'bottom') {
      textY = y - height;
    }

    // Check if position fits in canvas
    if (textX < 0) textX = 0;
    if (textY < 0) textY = 0;
    if (textX + width > canvasBounds.width) textX = canvasBounds.width - width;
    if (textY + height > canvasBounds.height) textY = canvasBounds.height - height;

    // Check for overlaps with existing text
    const textBounds = { x: textX, y: textY, width, height };
    const hasOverlap = existingPositions.some(pos =>
      this.boundsIntersect(textBounds, pos),
    );

    if (hasOverlap) {
      // Try alternative positions
      const alternatives = [
        { x, y: y - height - 10 }, // Above
        { x, y: y + height + 10 }, // Below
        { x: x - width - 10, y }, // Left
        { x: x + width + 10, y }, // Right
      ];

      for (const alt of alternatives) {
        const altBounds = { x: alt.x, y: alt.y, width, height };
        if (!existingPositions.some(pos => this.boundsIntersect(altBounds, pos)) &&
            alt.x >= 0 && alt.y >= 0 &&
            alt.x + width <= canvasBounds.width &&
            alt.y + height <= canvasBounds.height) {
          textX = alt.x;
          textY = alt.y;
          break;
        }
      }
    }

    // Convert back to position format
    let finalX = textX;
    let finalY = textY;

    if (align === 'center') {
      finalX = textX + width / 2;
    } else if (align === 'right') {
      finalX = textX + width;
    }

    if (baseline === 'middle') {
      finalY = textY + height / 2;
    } else if (baseline === 'bottom') {
      finalY = textY + height;
    }

    return {
      x: finalX,
      y: finalY,
      align,
      baseline,
      rotation: preferredPosition.rotation,
    };
  }

  /**
   * Check if two rectangular bounds intersect
   */
  private static boundsIntersect(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ): boolean {
    return !(a.x + a.width < b.x ||
             b.x + b.width < a.x ||
             a.y + a.height < b.y ||
             b.y + b.height < a.y);
  }
}

export default TextStyleRenderer;
