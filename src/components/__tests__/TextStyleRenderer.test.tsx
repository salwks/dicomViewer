/**
 * Text Style Renderer Tests
 *
 * Comprehensive test suite for the TextStyleRenderer component
 * Tests text rendering, positioning, styling, and interaction
 */

import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TextStyleRenderer, TextMeasurementUtils } from '../TextStyleRenderer';
import {
  AnnotationStyling,
  AnnotationStyleCategory,
  AnnotationType,
  DEFAULT_COLORS,
  DEFAULT_FONTS,
} from '../../types/annotation-styling';

// Mock canvas context
interface MockCanvasContext {
  clearRect: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  strokeRect: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  moveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  arc: ReturnType<typeof vi.fn>;
  stroke: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
  closePath: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
  measureText: ReturnType<typeof vi.fn>;
  roundRect: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  translate: ReturnType<typeof vi.fn>;
  rotate: ReturnType<typeof vi.fn>;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  fillStyle: string | CanvasGradient | CanvasPattern;
  globalAlpha: number;
  shadowColor: string;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlur: number;
}

const mockCanvasContext: MockCanvasContext = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  arc: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  closePath: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn().mockReturnValue({ width: 100 }),
  roundRect: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  font: '14px Arial',
  textAlign: 'left',
  textBaseline: 'alphabetic',
  fillStyle: '#000000',
  globalAlpha: 1,
  shadowColor: 'transparent',
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowBlur: 0,
};

// Mock canvas element
const createMockCanvas = (width = 800, height = 600) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext = vi.fn().mockReturnValue(mockCanvasContext);
  canvas.getBoundingClientRect = vi.fn().mockReturnValue({
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
  });
  canvas.addEventListener = vi.fn();
  canvas.removeEventListener = vi.fn();
  return canvas;
};

describe('TextStyleRenderer', () => {
  let mockCanvas: HTMLCanvasElement;
  let defaultStyling: AnnotationStyling;

  beforeEach(() => {
    mockCanvas = createMockCanvas();

    defaultStyling = {
      id: 'test-style',
      name: 'Test Style',
      description: 'Test styling for text rendering',
      line: {
        width: 2,
        color: DEFAULT_COLORS.PRIMARY,
        style: 'solid',
        cap: 'round',
        join: 'round',
      },
      font: DEFAULT_FONTS.PRIMARY,
      opacity: 1.0,
      visible: true,
      zIndex: 100,
      scaleFactor: 1.0,
      category: AnnotationStyleCategory.TEXT,
      compatibleTypes: [AnnotationType.TEXT],
      isPreset: false,
      isReadonly: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: '1.0.0',
      tags: [],
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render simple text', () => {
      const content = { text: 'Test Text' };
      const position = { x: 100, y: 100, align: 'left' as const, baseline: 'alphabetic' as const };

      render(
        <TextStyleRenderer
          canvas={mockCanvas}
          content={content}
          position={position}
          styling={defaultStyling}
        />,
      );

      expect(mockCanvasContext.fillText).toHaveBeenCalledWith('Test Text', 100, 100);
    });

    it('should apply font styling', () => {
      const content = { text: 'Styled Text' };
      const position = { x: 50, y: 50, align: 'center' as const, baseline: 'middle' as const };
      const customStyling = {
        ...defaultStyling,
        font: {
          ...DEFAULT_FONTS.PRIMARY,
          size: 18,
          weight: 'bold' as const,
          style: 'italic' as const,
        },
      };

      render(
        <TextStyleRenderer
          canvas={mockCanvas}
          content={content}
          position={position}
          styling={customStyling}
        />,
      );

      expect(mockCanvasContext.font).toContain('italic');
      expect(mockCanvasContext.font).toContain('bold');
      expect(mockCanvasContext.font).toContain('18px');
      expect(mockCanvasContext.textAlign).toBe('center');
      expect(mockCanvasContext.textBaseline).toBe('middle');
    });

    it('should apply text color', () => {
      const content = { text: 'Colored Text' };
      const position = { x: 75, y: 75, align: 'right' as const, baseline: 'top' as const };
      const customStyling = {
        ...defaultStyling,
        line: {
          ...defaultStyling.line,
          color: DEFAULT_COLORS.DANGER,
        },
      };

      render(
        <TextStyleRenderer
          canvas={mockCanvas}
          content={content}
          position={position}
          styling={customStyling}
        />,
      );

      expect(mockCanvasContext.fillStyle).toBe('rgba(220, 53, 69, 1)');
    });

    it('should apply opacity', () => {
      const content = { text: 'Semi-transparent Text' };
      const position = { x: 200, y: 200, align: 'left' as const, baseline: 'alphabetic' as const };
      const customStyling = {
        ...defaultStyling,
        opacity: 0.7,
      };

      render(
        <TextStyleRenderer
          canvas={mockCanvas}
          content={content}
          position={position}
          styling={customStyling}
        />,
      );

      expect(mockCanvasContext.globalAlpha).toBe(0.7);
    });
  });

  describe('Text Content Formatting', () => {
    it('should format measurement values', () => {
      const content = {
        text: '',
        value: 12.345,
        unit: 'mm',
        precision: 2,
      };
      const position = { x: 100, y: 100, align: 'left' as const, baseline: 'alphabetic' as const };

      render(
        <TextStyleRenderer
          canvas={mockCanvas}
          content={content}
          position={position}
          styling={defaultStyling}
        />,
      );

      expect(mockCanvasContext.fillText).toHaveBeenCalledWith('12.35 mm', 100, 100);
    });

    it('should add prefix and suffix', () => {
      const content = {
        text: 'Base Text',
        prefix: 'Length: ',
        suffix: ' (approx)',
      };
      const position = { x: 100, y: 100, align: 'left' as const, baseline: 'alphabetic' as const };

      render(
        <TextStyleRenderer
          canvas={mockCanvas}
          content={content}
          position={position}
          styling={defaultStyling}
        />,
      );

      expect(mockCanvasContext.fillText).toHaveBeenCalledWith('Length: Base Text (approx)', 100, 100);
    });

    it('should use measurement precision from styling', () => {
      const content = {
        text: '',
        value: 15.6789,
        unit: 'px',
      };
      const position = { x: 100, y: 100, align: 'left' as const, baseline: 'alphabetic' as const };
      const customStyling = {
        ...defaultStyling,
        measurementPrecision: 3,
      };

      render(
        <TextStyleRenderer
          canvas={mockCanvas}
          content={content}
          position={position}
          styling={customStyling}
        />,
      );

      expect(mockCanvasContext.fillText).toHaveBeenCalledWith('15.679 px', 100, 100);
    });
  });

  describe('Text Positioning', () => {
    it('should handle different text alignments', () => {
      const content = { text: 'Aligned Text' };
      const positions = [
        { x: 100, y: 100, align: 'left' as const, baseline: 'alphabetic' as const },
        { x: 100, y: 150, align: 'center' as const, baseline: 'middle' as const },
        { x: 100, y: 200, align: 'right' as const, baseline: 'bottom' as const },
      ];

      positions.forEach((position, index) => {
        render(
          <TextStyleRenderer
            key={index}
            canvas={mockCanvas}
            content={content}
            position={position}
            styling={defaultStyling}
          />,
        );

        expect(mockCanvasContext.textAlign).toBe(position.align);
        expect(mockCanvasContext.textBaseline).toBe(position.baseline);
      });
    });

    it('should handle text rotation', () => {
      const content = { text: 'Rotated Text' };
      const position = {
        x: 100,
        y: 100,
        align: 'center' as const,
        baseline: 'middle' as const,
        rotation: 45,
      };

      render(
        <TextStyleRenderer
          canvas={mockCanvas}
          content={content}
          position={position}
          styling={defaultStyling}
        />,
      );

      expect(mockCanvasContext.save).toHaveBeenCalled();
      expect(mockCanvasContext.translate).toHaveBeenCalledWith(100, 100);
      expect(mockCanvasContext.rotate).toHaveBeenCalledWith((45 * Math.PI) / 180);
      expect(mockCanvasContext.restore).toHaveBeenCalled();
    });

    it('should scale for high-DPI displays', () => {
      const content = { text: 'High-DPI Text' };
      const position = { x: 100, y: 100, align: 'left' as const, baseline: 'alphabetic' as const };
      const pixelRatio = 2;

      render(
        <TextStyleRenderer
          canvas={mockCanvas}
          content={content}
          position={position}
          styling={defaultStyling}
          pixelRatio={pixelRatio}
        />,
      );

      // Position should be scaled
      expect(mockCanvasContext.fillText).toHaveBeenCalledWith('High-DPI Text', 200, 200);
      // Font size should be scaled
      expect(mockCanvasContext.font).toContain('28px'); // 14 * 2
    });
  });

  describe('Text Background', () => {
    it('should render text background', () => {
      const content = { text: 'Background Text' };
      const position = { x: 100, y: 100, align: 'left' as const, baseline: 'alphabetic' as const };
      const background = {
        color: DEFAULT_COLORS.WHITE,
        opacity: 0.9,
        borderRadius: 4,
        padding: { top: 4, right: 8, bottom: 4, left: 8 },
      };

      render(
        <TextStyleRenderer
          canvas={mockCanvas}
          content={content}
          position={position}
          styling={defaultStyling}
          background={background}
        />,
      );

      expect(mockCanvasContext.roundRect).toHaveBeenCalled();
      expect(mockCanvasContext.fill).toHaveBeenCalled();
    });

    it('should render rectangular background without border radius', () => {
      const content = { text: 'Rect Background' };
      const position = { x: 100, y: 100, align: 'left' as const, baseline: 'alphabetic' as const };
      const background = {
        color: DEFAULT_COLORS.SECONDARY,
        opacity: 0.8,
        borderRadius: 0,
        padding: { top: 2, right: 4, bottom: 2, left: 4 },
      };

      render(
        <TextStyleRenderer
          canvas={mockCanvas}
          content={content}
          position={position}
          styling={defaultStyling}
          background={background}
        />,
      );

      expect(mockCanvasContext.fillRect).toHaveBeenCalled();
    });
  });

  describe('Text Shadow', () => {
    it('should apply text shadow', () => {
      const content = { text: 'Shadow Text' };
      const position = { x: 100, y: 100, align: 'left' as const, baseline: 'alphabetic' as const };
      const customStyling = {
        ...defaultStyling,
        shadow: {
          color: DEFAULT_COLORS.BLACK,
          blur: 4,
          offsetX: 2,
          offsetY: 2,
          opacity: 0.5,
        },
      };

      render(
        <TextStyleRenderer
          canvas={mockCanvas}
          content={content}
          position={position}
          styling={customStyling}
        />,
      );

      expect(mockCanvasContext.shadowColor).toBe(DEFAULT_COLORS.BLACK.hex);
      expect(mockCanvasContext.shadowBlur).toBe(4);
      expect(mockCanvasContext.shadowOffsetX).toBe(2);
      expect(mockCanvasContext.shadowOffsetY).toBe(2);
    });

    it('should clear shadow after rendering', () => {
      const content = { text: 'Shadow Clear Test' };
      const position = { x: 100, y: 100, align: 'left' as const, baseline: 'alphabetic' as const };
      const customStyling = {
        ...defaultStyling,
        shadow: {
          color: DEFAULT_COLORS.BLACK,
          blur: 2,
          offsetX: 1,
          offsetY: 1,
          opacity: 0.3,
        },
      };

      render(
        <TextStyleRenderer
          canvas={mockCanvas}
          content={content}
          position={position}
          styling={customStyling}
        />,
      );

      expect(mockCanvasContext.shadowColor).toBe('transparent');
      expect(mockCanvasContext.shadowBlur).toBe(0);
      expect(mockCanvasContext.shadowOffsetX).toBe(0);
      expect(mockCanvasContext.shadowOffsetY).toBe(0);
    });
  });

  describe('Superscript and Subscript', () => {
    it('should render superscript text', () => {
      const content = {
        text: 'H',
        superscript: '2',
      };
      const position = { x: 100, y: 100, align: 'left' as const, baseline: 'alphabetic' as const };

      render(
        <TextStyleRenderer
          canvas={mockCanvas}
          content={content}
          position={position}
          styling={defaultStyling}
        />,
      );

      // Should render main text and superscript
      expect(mockCanvasContext.fillText).toHaveBeenCalledWith('H', 100, 100);
      expect(mockCanvasContext.fillText).toHaveBeenCalledWith('2', expect.any(Number), expect.any(Number));
    });

    it('should render subscript text', () => {
      const content = {
        text: 'O',
        subscript: '2',
      };
      const position = { x: 100, y: 100, align: 'left' as const, baseline: 'alphabetic' as const };

      render(
        <TextStyleRenderer
          canvas={mockCanvas}
          content={content}
          position={position}
          styling={defaultStyling}
        />,
      );

      // Should render main text and subscript
      expect(mockCanvasContext.fillText).toHaveBeenCalledWith('O', 100, 100);
      expect(mockCanvasContext.fillText).toHaveBeenCalledWith('2', expect.any(Number), expect.any(Number));
    });

    it('should render both superscript and subscript', () => {
      const content = {
        text: 'X',
        superscript: 'a',
        subscript: 'b',
      };
      const position = { x: 100, y: 100, align: 'left' as const, baseline: 'alphabetic' as const };

      render(
        <TextStyleRenderer
          canvas={mockCanvas}
          content={content}
          position={position}
          styling={defaultStyling}
        />,
      );

      // Should render main text, superscript, and subscript
      expect(mockCanvasContext.fillText).toHaveBeenCalledTimes(3);
      expect(mockCanvasContext.fillText).toHaveBeenCalledWith('X', 100, 100);
      expect(mockCanvasContext.fillText).toHaveBeenCalledWith('a', expect.any(Number), expect.any(Number));
      expect(mockCanvasContext.fillText).toHaveBeenCalledWith('b', expect.any(Number), expect.any(Number));
    });
  });

  describe('Interactivity', () => {
    it('should setup event listeners when interactive', () => {
      const content = { text: 'Interactive Text' };
      const position = { x: 100, y: 100, align: 'left' as const, baseline: 'alphabetic' as const };
      const onClick = vi.fn();
      const onHover = vi.fn();

      render(
        <TextStyleRenderer
          canvas={mockCanvas}
          content={content}
          position={position}
          styling={defaultStyling}
          interactive={true}
          onClick={onClick}
          onHover={onHover}
        />,
      );

      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
    });

    it('should not setup event listeners when not interactive', () => {
      const content = { text: 'Non-interactive Text' };
      const position = { x: 100, y: 100, align: 'left' as const, baseline: 'alphabetic' as const };

      render(
        <TextStyleRenderer
          canvas={mockCanvas}
          content={content}
          position={position}
          styling={defaultStyling}
          interactive={false}
        />,
      );

      expect(mockCanvas.addEventListener).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing canvas context gracefully', () => {
      const brokenCanvas = createMockCanvas();
      brokenCanvas.getContext = vi.fn().mockReturnValue(null);

      const content = { text: 'Error Test' };
      const position = { x: 100, y: 100, align: 'left' as const, baseline: 'alphabetic' as const };

      expect(() => {
        render(
          <TextStyleRenderer
            canvas={brokenCanvas}
            content={content}
            position={position}
            styling={defaultStyling}
          />,
        );
      }).not.toThrow();
    });

    it('should handle invalid color formats gracefully', () => {
      const content = { text: 'Invalid Color Test' };
      const position = { x: 100, y: 100, align: 'left' as const, baseline: 'alphabetic' as const };
      const customStyling = {
        ...defaultStyling,
        line: {
          ...defaultStyling.line,
          color: { rgb: [300, -50, 999] as [number, number, number], hex: 'invalid' }, // Invalid values
        },
      };

      expect(() => {
        render(
          <TextStyleRenderer
            canvas={mockCanvas}
            content={content}
            position={position}
            styling={customStyling}
          />,
        );
      }).not.toThrow();
    });
  });
});

describe('TextMeasurementUtils', () => {
  let mockCanvas: HTMLCanvasElement;

  beforeEach(() => {
    mockCanvas = createMockCanvas();
  });

  describe('Text Measurement', () => {
    it('should measure text dimensions', () => {
      const text = 'Measure Me';
      const font = DEFAULT_FONTS.PRIMARY;

      const dimensions = TextMeasurementUtils.measureText(text, font, mockCanvas);

      expect(dimensions.width).toBe(100); // From mock
      expect(dimensions.height).toBe(font.size * font.lineHeight);
      expect(mockCanvasContext.measureText).toHaveBeenCalledWith(text);
    });

    it('should apply pixel ratio to measurements', () => {
      const text = 'High-DPI Measure';
      const font = DEFAULT_FONTS.PRIMARY;
      const pixelRatio = 2;

      const dimensions = TextMeasurementUtils.measureText(text, font, mockCanvas, pixelRatio);

      expect(dimensions.width).toBe(50); // 100 / 2
      expect(dimensions.height).toBe((font.size * font.lineHeight) / pixelRatio);
    });
  });

  describe('Optimal Position Calculation', () => {
    it('should return preferred position when no conflicts', () => {
      const preferredPosition = {
        x: 100,
        y: 100,
        align: 'left' as const,
        baseline: 'alphabetic' as const,
      };
      const textDimensions = { width: 50, height: 20 };
      const canvasBounds = { width: 800, height: 600 };

      const optimalPosition = TextMeasurementUtils.calculateOptimalPosition(
        preferredPosition,
        textDimensions,
        canvasBounds,
      );

      expect(optimalPosition).toEqual(preferredPosition);
    });

    it('should adjust position to fit within canvas bounds', () => {
      const preferredPosition = {
        x: 780,
        y: 590,
        align: 'left' as const,
        baseline: 'alphabetic' as const,
      };
      const textDimensions = { width: 100, height: 30 };
      const canvasBounds = { width: 800, height: 600 };

      const optimalPosition = TextMeasurementUtils.calculateOptimalPosition(
        preferredPosition,
        textDimensions,
        canvasBounds,
      );

      expect(optimalPosition.x).toBeLessThan(preferredPosition.x);
      expect(optimalPosition.y).toBeLessThan(preferredPosition.y);
    });

    it('should avoid overlaps with existing text', () => {
      const preferredPosition = {
        x: 100,
        y: 100,
        align: 'left' as const,
        baseline: 'alphabetic' as const,
      };
      const textDimensions = { width: 80, height: 20 };
      const canvasBounds = { width: 800, height: 600 };
      const existingPositions = [
        { x: 90, y: 90, width: 100, height: 25 }, // Overlapping position
      ];

      const optimalPosition = TextMeasurementUtils.calculateOptimalPosition(
        preferredPosition,
        textDimensions,
        canvasBounds,
        existingPositions,
      );

      // Should be moved to avoid overlap
      expect(optimalPosition.x !== preferredPosition.x || optimalPosition.y !== preferredPosition.y).toBe(true);
    });

    it('should try alternative positions for overlap avoidance', () => {
      const preferredPosition = {
        x: 100,
        y: 100,
        align: 'center' as const,
        baseline: 'middle' as const,
      };
      const textDimensions = { width: 60, height: 20 };
      const canvasBounds = { width: 800, height: 600 };
      const existingPositions = [
        { x: 70, y: 90, width: 60, height: 20 }, // Overlapping
      ];

      const optimalPosition = TextMeasurementUtils.calculateOptimalPosition(
        preferredPosition,
        textDimensions,
        canvasBounds,
        existingPositions,
      );

      expect(optimalPosition.align).toBe('center');
      expect(optimalPosition.baseline).toBe('middle');
      // Position should be adjusted to avoid overlap
    });

    it('should preserve original position when no better alternative exists', () => {
      const preferredPosition = {
        x: 400,
        y: 300,
        align: 'center' as const,
        baseline: 'middle' as const,
      };
      const textDimensions = { width: 200, height: 50 };
      const canvasBounds = { width: 800, height: 600 };

      // Create overlapping positions that block all alternatives
      const existingPositions = [
        { x: 300, y: 200, width: 200, height: 50 }, // Center overlap
        { x: 300, y: 150, width: 200, height: 50 }, // Above
        { x: 300, y: 350, width: 200, height: 50 }, // Below
        { x: 150, y: 250, width: 200, height: 50 }, // Left
        { x: 450, y: 250, width: 200, height: 50 }, // Right
      ];

      const optimalPosition = TextMeasurementUtils.calculateOptimalPosition(
        preferredPosition,
        textDimensions,
        canvasBounds,
        existingPositions,
      );

      // Should keep original position as best available option
      expect(optimalPosition.x).toBe(preferredPosition.x);
      expect(optimalPosition.y).toBe(preferredPosition.y);
    });
  });
});
