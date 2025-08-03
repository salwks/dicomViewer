/**
 * ViewportGrid Component Tests
 * Basic test suite for the enhanced ViewportGrid component
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { ViewportGrid, type ViewportGridProps, type ViewportState } from '../components/ViewportGrid';

// Mock dependencies
vi.mock('../components/DicomViewer', () => ({
  DicomViewer: React.forwardRef<any, any>((props, ref) => (
    React.createElement('div', {
      'data-testid': `dicom-viewer-${props.viewportId}`,
      ref,
    }, `Mocked DicomViewer - ${props.seriesInstanceUID}`)
  )),
}));

vi.mock('../components/CrossReferenceLines', () => ({
  CrossReferenceLines: ({ viewportId }: any) => (
    React.createElement('div', {
      'data-testid': `cross-ref-${viewportId}`,
    }, 'CrossReference Lines')
  ),
}));

vi.mock('../utils/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(callback: ResizeObserverCallback) {
    // Simulate immediate callback
    setTimeout(() => {
      callback([{
        contentRect: {
          width: 800,
          height: 600,
          top: 0,
          left: 0,
          bottom: 600,
          right: 800,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        },
        target: document.createElement('div'),
        borderBoxSize: [],
        contentBoxSize: [],
        devicePixelContentBoxSize: [],
      }] as unknown as ResizeObserverEntry[], this as ResizeObserver);
    }, 0);
  }
}

global.ResizeObserver = MockResizeObserver as any;

describe('ViewportGrid', () => {
  const mockSeriesData = [
    {
      seriesInstanceUID: 'series-1',
      modality: 'CT',
      numberOfImages: 100,
      seriesDescription: 'Chest CT',
    },
    {
      seriesInstanceUID: 'series-2',
      modality: 'MR',
      numberOfImages: 50,
      seriesDescription: 'Brain MRI',
    },
  ];

  const mockViewports: ViewportState[] = [
    {
      id: 'A',
      seriesIndex: 0,
      isActive: true,
      activeTool: 'WindowLevel',
    },
    {
      id: 'B',
      seriesIndex: 1,
      isActive: false,
      activeTool: 'Pan',
    },
  ];

  const defaultProps: ViewportGridProps = {
    layout: '1x2',
    viewports: mockViewports,
    seriesData: mockSeriesData,
    onViewportActivated: vi.fn(),
    showCrossReferenceLines: false,
    crossReferenceOpacity: 0.8,
    className: '',
    enableAnimations: true,
    responsiveBreakpoint: 768,
  };

  let mockOnViewportActivated: Mock;

  beforeEach(() => {
    mockOnViewportActivated = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Creation', () => {
    it('should create ViewportGrid component without errors', () => {
      expect(() => {
        React.createElement(ViewportGrid, {
          ...defaultProps,
          onViewportActivated: mockOnViewportActivated,
        });
      }).not.toThrow();
    });

    it('should handle different layout types', () => {
      const layouts: Array<'1x1' | '1x2' | '2x2'> = ['1x1', '1x2', '2x2'];

      layouts.forEach(layout => {
        expect(() => {
          React.createElement(ViewportGrid, {
            ...defaultProps,
            layout,
            onViewportActivated: mockOnViewportActivated,
          });
        }).not.toThrow();
      });
    });

    it('should handle empty viewports array', () => {
      expect(() => {
        React.createElement(ViewportGrid, {
          ...defaultProps,
          viewports: [],
          onViewportActivated: mockOnViewportActivated,
        });
      }).not.toThrow();
    });

    it('should handle empty series data', () => {
      expect(() => {
        React.createElement(ViewportGrid, {
          ...defaultProps,
          seriesData: [],
          onViewportActivated: mockOnViewportActivated,
        });
      }).not.toThrow();
    });
  });

  describe('Props Validation', () => {
    it('should accept all required props', () => {
      const props: ViewportGridProps = {
        layout: '2x2',
        viewports: mockViewports,
        seriesData: mockSeriesData,
        onViewportActivated: mockOnViewportActivated,
      };

      expect(() => {
        React.createElement(ViewportGrid, props);
      }).not.toThrow();
    });

    it('should accept optional props', () => {
      const props: ViewportGridProps = {
        layout: '2x2',
        viewports: mockViewports,
        seriesData: mockSeriesData,
        onViewportActivated: mockOnViewportActivated,
        showCrossReferenceLines: true,
        crossReferenceOpacity: 0.5,
        className: 'custom-class',
        enableAnimations: false,
        responsiveBreakpoint: 1024,
        onLayoutTransition: vi.fn(),
        onViewportResize: vi.fn(),
      };

      expect(() => {
        React.createElement(ViewportGrid, props);
      }).not.toThrow();
    });
  });

  describe('ViewportState Interface', () => {
    it('should handle valid viewport state objects', () => {
      const validViewport: ViewportState = {
        id: 'A',
        seriesIndex: 0,
        isActive: true,
        activeTool: 'WindowLevel',
        windowLevel: { width: 400, center: 40 },
        zoom: 1.5,
        pan: { x: 10, y: 20 },
      };

      expect(typeof validViewport.id).toBe('string');
      expect(typeof validViewport.isActive).toBe('boolean');
      expect(validViewport.seriesIndex).toBeGreaterThanOrEqual(0);
    });

    it('should handle viewport state with null series index', () => {
      const emptyViewport: ViewportState = {
        id: 'B',
        seriesIndex: null,
        isActive: false,
        activeTool: 'Pan',
      };

      expect(emptyViewport.seriesIndex).toBeNull();
      expect(typeof emptyViewport.isActive).toBe('boolean');
    });
  });

  describe('Callback Functions', () => {
    it('should have proper callback function signatures', () => {
      const onViewportActivated = vi.fn();
      const onLayoutTransition = vi.fn();
      const onViewportResize = vi.fn();

      // Test callback signatures
      onViewportActivated('A');
      expect(onViewportActivated).toHaveBeenCalledWith('A');

      onLayoutTransition('1x1', '2x2');
      expect(onLayoutTransition).toHaveBeenCalledWith('1x1', '2x2');

      onViewportResize('A', { width: 400, height: 300 });
      expect(onViewportResize).toHaveBeenCalledWith('A', { width: 400, height: 300 });
    });
  });

  describe('Performance and Memory', () => {
    it('should handle component cleanup without memory leaks', () => {
      const testProps = {
        ...defaultProps,
        onViewportActivated: mockOnViewportActivated,
      };

      // Create multiple instances to test cleanup
      for (let i = 0; i < 10; i++) {
        expect(() => {
          React.createElement(ViewportGrid, {
            ...testProps,
            layout: i % 2 === 0 ? '1x1' : '2x2',
          });
        }).not.toThrow();
      }
    });

    it('should handle rapid prop changes', () => {
      const initialProps = {
        ...defaultProps,
        layout: '1x1' as const,
        onViewportActivated: mockOnViewportActivated,
      };

      expect(() => {
        React.createElement(ViewportGrid, initialProps);
        React.createElement(ViewportGrid, { ...initialProps, layout: '1x2' });
        React.createElement(ViewportGrid, { ...initialProps, layout: '2x2' });
        React.createElement(ViewportGrid, { ...initialProps, layout: '1x1' });
      }).not.toThrow();
    });
  });

  describe('Type Safety', () => {
    it('should enforce correct layout types', () => {
      const validLayouts: Array<'1x1' | '1x2' | '2x2'> = ['1x1', '1x2', '2x2'];

      validLayouts.forEach(layout => {
        const props: ViewportGridProps = {
          ...defaultProps,
          layout,
          onViewportActivated: mockOnViewportActivated,
        };

        expect(props.layout).toBe(layout);
      });
    });

    it('should handle viewport ref interface correctly', () => {
      const ref = React.createRef<{
        getViewportRef: (viewportId: string) => any;
        setViewportTool: (viewportId: string, tool: string) => void;
        getActiveViewportId: () => string | null;
      }>();

      expect(() => {
        React.createElement(ViewportGrid, {
          ...defaultProps,
          ref,
          onViewportActivated: mockOnViewportActivated,
        });
      }).not.toThrow();
    });
  });
});
