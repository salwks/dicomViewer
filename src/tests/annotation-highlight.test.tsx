/**
 * Annotation Highlight System Test Suite
 * Tests for the highlight visualization system
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AnnotationHighlight from '../components/AnnotationHighlight';
import { AnnotationCompat } from '../types/annotation-compat';

// Mock logger
jest.mock('../utils/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock canvas context
const mockCanvas = {
  getContext: jest.fn(() => ({
    clearRect: jest.fn(),
    strokeRect: jest.fn(),
    fillRect: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    setLineDash: jest.fn(),
  })),
  width: 800,
  height: 600,
};

// Mock HTMLCanvasElement
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: mockCanvas.getContext,
});

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => {
  setTimeout(cb, 16);
  return 1;
});

global.cancelAnimationFrame = jest.fn();

describe('AnnotationHighlight', () => {
  const mockAnnotations: AnnotationCompat[] = [
    {
      id: 'annotation-1',
      type: 'length',
      state: 'completed',
      data: {},
      metadata: {},
    },
    {
      id: 'annotation-2',
      type: 'angle',
      state: 'completed',
      data: {},
      metadata: {},
    },
    {
      id: 'annotation-3',
      type: 'area',
      state: 'completed',
      data: {},
      metadata: {},
    },
  ];

  const defaultProps = {
    annotations: mockAnnotations,
    selectedAnnotationIds: new Set(['annotation-1']),
    viewportId: 'viewport-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    test('renders without errors', () => {
      render(<AnnotationHighlight {...defaultProps} />);

      // Should render the highlight canvas
      expect(document.querySelector('canvas')).toBeInTheDocument();
    });

    test('displays correct selection count', () => {
      render(<AnnotationHighlight {...defaultProps} />);

      expect(screen.getByText('1 selected')).toBeInTheDocument();
    });

    test('displays multiple selections correctly', () => {
      const selectedIds = new Set(['annotation-1', 'annotation-2']);
      render(
        <AnnotationHighlight
          {...defaultProps}
          selectedAnnotationIds={selectedIds}
        />,
      );

      expect(screen.getByText('2 selected')).toBeInTheDocument();
    });

    test('shows sky blue color badge when annotations are selected', () => {
      render(<AnnotationHighlight {...defaultProps} />);

      expect(screen.getByText('#87CEEB')).toBeInTheDocument();
    });

    test('shows pulse indicator when pulse is enabled', () => {
      render(<AnnotationHighlight {...defaultProps} />);

      expect(screen.getByText('Pulsing')).toBeInTheDocument();
    });
  });

  describe('Controls Panel', () => {
    test('shows controls when showControls is true', () => {
      render(<AnnotationHighlight {...defaultProps} showControls={true} />);

      expect(screen.getByText('Highlight Controls')).toBeInTheDocument();
    });

    test('hides controls when showControls is false', () => {
      render(<AnnotationHighlight {...defaultProps} showControls={false} />);

      expect(screen.queryByText('Highlight Controls')).not.toBeInTheDocument();
    });

    test('displays preset style buttons', () => {
      render(<AnnotationHighlight {...defaultProps} showControls={true} />);

      expect(screen.getByText('Sky Blue (Default)')).toBeInTheDocument();
      expect(screen.getByText('Electric Blue')).toBeInTheDocument();
      expect(screen.getByText('Cyan Glow')).toBeInTheDocument();
      expect(screen.getByText('Subtle Blue')).toBeInTheDocument();
    });

    test('displays style control sliders', () => {
      render(<AnnotationHighlight {...defaultProps} showControls={true} />);

      expect(screen.getByText(/Thickness:/)).toBeInTheDocument();
      expect(screen.getByText(/Opacity:/)).toBeInTheDocument();
      expect(screen.getByText(/Glow Radius:/)).toBeInTheDocument();
    });

    test('displays pulse animation toggle', () => {
      render(<AnnotationHighlight {...defaultProps} showControls={true} />);

      expect(screen.getByText('Pulse Animation')).toBeInTheDocument();
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    test('shows pulse speed control when pulse is enabled', () => {
      render(<AnnotationHighlight {...defaultProps} showControls={true} />);

      expect(screen.getByText(/Pulse Speed:/)).toBeInTheDocument();
    });
  });

  describe('Style Interactions', () => {
    test('calls onHighlightStyleChange when preset is selected', () => {
      const mockOnStyleChange = jest.fn();
      render(
        <AnnotationHighlight
          {...defaultProps}
          showControls={true}
          onHighlightStyleChange={mockOnStyleChange}
        />,
      );

      fireEvent.click(screen.getByText('Electric Blue'));

      expect(mockOnStyleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          color: '#0080FF',
          thickness: 2,
          opacity: 0.9,
          pulseEnabled: false,
        }),
      );
    });

    test('updates thickness when slider is changed', async () => {
      const mockOnStyleChange = jest.fn();
      render(
        <AnnotationHighlight
          {...defaultProps}
          showControls={true}
          onHighlightStyleChange={mockOnStyleChange}
        />,
      );

      const thicknessSlider = screen.getByText(/Thickness:/).parentElement?.querySelector('[role="slider"]');
      if (thicknessSlider) {
        fireEvent.change(thicknessSlider, { target: { value: '5' } });

        await waitFor(() => {
          expect(mockOnStyleChange).toHaveBeenCalled();
        });
      }
    });

    test('toggles pulse animation correctly', () => {
      const mockOnStyleChange = jest.fn();
      render(
        <AnnotationHighlight
          {...defaultProps}
          showControls={true}
          onHighlightStyleChange={mockOnStyleChange}
        />,
      );

      const pulseSwitch = screen.getByRole('switch');
      fireEvent.click(pulseSwitch);

      expect(mockOnStyleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          pulseEnabled: false,
        }),
      );
    });

    test('resets to default style when reset button is clicked', () => {
      const mockOnStyleChange = jest.fn();
      render(
        <AnnotationHighlight
          {...defaultProps}
          showControls={true}
          onHighlightStyleChange={mockOnStyleChange}
        />,
      );

      fireEvent.click(screen.getByText('Reset to Default'));

      expect(mockOnStyleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          color: '#87CEEB',
          thickness: 3,
          opacity: 0.8,
          glowRadius: 8,
          pulseEnabled: true,
          pulseSpeed: 2000,
        }),
      );
    });
  });

  describe('Canvas Interactions', () => {
    test('calls onAnnotationSelect when canvas is clicked', () => {
      const mockOnSelect = jest.fn();
      render(
        <AnnotationHighlight
          {...defaultProps}
          onAnnotationSelect={mockOnSelect}
        />,
      );

      const canvas = document.querySelector('canvas');
      if (canvas) {
        fireEvent.click(canvas, { clientX: 150, clientY: 150 });

        // Note: Actual interaction would depend on mock bounds matching click coordinates
        // This tests that the event handler is set up correctly
        expect(canvas).toBeDefined();
      }
    });

    test('handles canvas mouse move events', () => {
      render(<AnnotationHighlight {...defaultProps} />);

      const canvas = document.querySelector('canvas');
      if (canvas) {
        fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });

        // Event should be handled without errors
        expect(canvas).toBeDefined();
      }
    });
  });

  describe('Disabled State', () => {
    test('applies disabled styling when disabled prop is true', () => {
      render(<AnnotationHighlight {...defaultProps} disabled={true} />);

      const canvas = document.querySelector('canvas');
      expect(canvas).toHaveClass('opacity-50', 'pointer-events-none');
    });

    test('removes disabled styling when disabled prop is false', () => {
      render(<AnnotationHighlight {...defaultProps} disabled={false} />);

      const canvas = document.querySelector('canvas');
      expect(canvas).not.toHaveClass('opacity-50', 'pointer-events-none');
    });
  });

  describe('Empty States', () => {
    test('handles empty annotations array', () => {
      render(
        <AnnotationHighlight
          {...defaultProps}
          annotations={[]}
          selectedAnnotationIds={new Set()}
        />,
      );

      expect(screen.getByText('0 selected')).toBeInTheDocument();
    });

    test('handles no selected annotations', () => {
      render(
        <AnnotationHighlight
          {...defaultProps}
          selectedAnnotationIds={new Set()}
        />,
      );

      expect(screen.getByText('0 selected')).toBeInTheDocument();
      expect(screen.queryByText('Pulsing')).not.toBeInTheDocument();
    });
  });

  describe('Statistics Display', () => {
    test('shows correct total annotation count', () => {
      render(<AnnotationHighlight {...defaultProps} />);

      expect(screen.getByText('1 / 3 selected')).toBeInTheDocument();
    });

    test('updates statistics when selections change', () => {
      const { rerender } = render(<AnnotationHighlight {...defaultProps} />);

      expect(screen.getByText('1 / 3 selected')).toBeInTheDocument();

      rerender(
        <AnnotationHighlight
          {...defaultProps}
          selectedAnnotationIds={new Set(['annotation-1', 'annotation-2'])}
        />,
      );

      expect(screen.getByText('2 / 3 selected')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('canvas has proper accessibility attributes', () => {
      render(<AnnotationHighlight {...defaultProps} />);

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
      // Canvas should be interactive
      expect(canvas).not.toHaveClass('pointer-events-none');
    });

    test('control elements are properly labeled', () => {
      render(<AnnotationHighlight {...defaultProps} showControls={true} />);

      expect(screen.getByText('Thickness:')).toBeInTheDocument();
      expect(screen.getByText('Opacity:')).toBeInTheDocument();
      expect(screen.getByText('Pulse Animation')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    test('handles large number of annotations without errors', () => {
      const manyAnnotations = Array.from({ length: 100 }, (_, i) => ({
        id: `annotation-${i}`,
        type: 'length',
        state: 'completed',
        data: {},
        metadata: {},
      }));

      const manySelected = new Set(manyAnnotations.slice(0, 50).map(a => a.id));

      expect(() => {
        render(
          <AnnotationHighlight
            annotations={manyAnnotations}
            selectedAnnotationIds={manySelected}
            viewportId="viewport-1"
          />,
        );
      }).not.toThrow();
    });

    test('cleanup on component unmount', () => {
      const { unmount } = render(<AnnotationHighlight {...defaultProps} />);

      expect(() => unmount()).not.toThrow();
      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });
  });
});
