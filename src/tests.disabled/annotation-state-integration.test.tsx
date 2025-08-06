/**
 * Annotation State Integration Test Suite
 * Tests for annotation state integration with application state
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AnnotationStateIntegration } from '../components/AnnotationStateIntegration';
import { AnnotationSelectionHandler } from '../services/AnnotationSelectionHandler';
import { HighlightStateManager } from '../services/HighlightStateManager';
import { AnnotationCompat } from '../types/annotation-compat';

// Mock logger
jest.mock('../utils/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock services
jest.mock('../services/AnnotationSelectionHandler');
jest.mock('../services/HighlightStateManager');

describe('AnnotationStateIntegration', () => {
  let mockSelectionHandler: jest.Mocked<AnnotationSelectionHandler>;
  let mockHighlightStateManager: jest.Mocked<HighlightStateManager>;

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
    viewportId: 'viewport-1',
    annotations: mockAnnotations,
    selectedAnnotationIds: ['annotation-1'],
  };

  beforeEach(() => {
    mockSelectionHandler = {
      on: jest.fn(),
      off: jest.fn(),
      getSelectedAnnotationIds: jest.fn().mockReturnValue(['annotation-1']),
    } as any;

    mockHighlightStateManager = {
      createHighlightState: jest.fn().mockReturnValue('highlight-state-123'),
      activateState: jest.fn().mockReturnValue(true),
      deactivateState: jest.fn().mockReturnValue(true),
      clearViewportStates: jest.fn().mockReturnValue(2),
      getViewportStates: jest.fn().mockReturnValue([
        {
          id: 'highlight-state-123',
          annotationId: 'annotation-1',
          viewportId: 'viewport-1',
          state: 'active',
          animation: { isPlaying: true },
        },
      ]),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    test('renders without errors', () => {
      render(
        <AnnotationStateIntegration
          {...defaultProps}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
        />
      );

      expect(screen.getByText('Annotation State Integration')).toBeInTheDocument();
      expect(screen.getByText('viewport-1')).toBeInTheDocument();
    });

    test('displays correct statistics', () => {
      render(
        <AnnotationStateIntegration
          {...defaultProps}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
        />
      );

      expect(screen.getByText('3')).toBeInTheDocument(); // Total annotations
      expect(screen.getByText('1')).toBeInTheDocument(); // Selected annotations
    });

    test('shows viewport ID badge', () => {
      render(
        <AnnotationStateIntegration
          {...defaultProps}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
        />
      );

      const viewportBadge = screen.getByText('viewport-1');
      expect(viewportBadge).toHaveClass('text-xs');
    });
  });

  describe('Settings Management', () => {
    test('displays all settings switches', () => {
      render(
        <AnnotationStateIntegration
          {...defaultProps}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
        />
      );

      expect(screen.getByText('Auto-highlight Selected')).toBeInTheDocument();
      expect(screen.getByText('Sync with Selection')).toBeInTheDocument();
      expect(screen.getByText('Enable Animations')).toBeInTheDocument();
      expect(screen.getByText('Persist State')).toBeInTheDocument();
    });

    test('toggles settings when switches are clicked', async () => {
      render(
        <AnnotationStateIntegration
          {...defaultProps}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
        />
      );

      const switches = screen.getAllByRole('switch');
      const autoHighlightSwitch = switches[0];

      // Should be enabled by default
      expect(autoHighlightSwitch).toBeChecked();

      // Click to disable
      fireEvent.click(autoHighlightSwitch);

      await waitFor(() => {
        expect(autoHighlightSwitch).not.toBeChecked();
      });
    });

    test('applies custom settings', () => {
      const customSettings = {
        autoHighlightSelected: false,
        syncWithSelection: false,
        enableAnimations: false,
        persistState: true,
      };

      render(
        <AnnotationStateIntegration
          {...defaultProps}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
          settings={customSettings}
        />
      );

      const switches = screen.getAllByRole('switch');

      expect(switches[0]).not.toBeChecked(); // Auto-highlight
      expect(switches[1]).not.toBeChecked(); // Sync with selection
      expect(switches[2]).not.toBeChecked(); // Enable animations
      expect(switches[3]).toBeChecked(); // Persist state
    });
  });

  describe('Highlight Management', () => {
    test('creates highlights for selected annotations', () => {
      render(
        <AnnotationStateIntegration
          {...defaultProps}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
        />
      );

      // Should create highlight state for selected annotation
      expect(mockHighlightStateManager.createHighlightState).toHaveBeenCalledWith(
        'annotation-1',
        'viewport-1',
        expect.objectContaining({
          color: '#87CEEB',
          pulseEnabled: true,
        })
      );

      expect(mockHighlightStateManager.activateState).toHaveBeenCalledWith(
        'highlight-state-123',
        expect.objectContaining({
          type: 'pulse',
          duration: 2000,
        })
      );
    });

    test('removes highlights for deselected annotations', async () => {
      const { rerender } = render(
        <AnnotationStateIntegration
          {...defaultProps}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
        />
      );

      // Change selection to empty
      rerender(
        <AnnotationStateIntegration
          {...defaultProps}
          selectedAnnotationIds={[]}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
        />
      );

      await waitFor(() => {
        expect(mockHighlightStateManager.deactivateState).toHaveBeenCalled();
      });
    });

    test('handles multiple selected annotations', () => {
      render(
        <AnnotationStateIntegration
          {...defaultProps}
          selectedAnnotationIds={['annotation-1', 'annotation-2']}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
        />
      );

      expect(mockHighlightStateManager.createHighlightState).toHaveBeenCalledTimes(2);
      expect(mockHighlightStateManager.activateState).toHaveBeenCalledTimes(2);
    });
  });

  describe('Action Buttons', () => {
    test('clear highlights button works', async () => {
      render(
        <AnnotationStateIntegration
          {...defaultProps}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
        />
      );

      const clearButton = screen.getByText('Clear Highlights');
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(mockHighlightStateManager.clearViewportStates).toHaveBeenCalledWith('viewport-1');
      });
    });

    test('refresh button triggers state refresh', async () => {
      render(
        <AnnotationStateIntegration
          {...defaultProps}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
        />
      );

      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockHighlightStateManager.clearViewportStates).toHaveBeenCalled();
      });
    });

    test('disables buttons when disabled prop is true', () => {
      render(
        <AnnotationStateIntegration
          {...defaultProps}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
          disabled={true}
        />
      );

      const clearButton = screen.getByText('Clear Highlights');
      const refreshButton = screen.getByText('Refresh');

      expect(clearButton).toBeDisabled();
      expect(refreshButton).toBeDisabled();
    });
  });

  describe('Event Handling', () => {
    test('listens for selection changes from selection handler', () => {
      render(
        <AnnotationStateIntegration
          {...defaultProps}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
        />
      );

      expect(mockSelectionHandler.on).toHaveBeenCalledWith('selection-changed', expect.any(Function));
    });

    test('calls onSelectionChange when selection changes', () => {
      const mockOnSelectionChange = jest.fn();

      render(
        <AnnotationStateIntegration
          {...defaultProps}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Simulate selection change event
      const [eventName, callback] = mockSelectionHandler.on.mock.calls[0];
      callback(['annotation-2'], 'viewport-1');

      expect(mockOnSelectionChange).toHaveBeenCalledWith(['annotation-2']);
    });

    test('calls onHighlightStateChange when highlights change', async () => {
      const mockOnHighlightStateChange = jest.fn();

      render(
        <AnnotationStateIntegration
          {...defaultProps}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
          onHighlightStateChange={mockOnHighlightStateChange}
        />
      );

      await waitFor(() => {
        expect(mockOnHighlightStateChange).toHaveBeenCalled();
      });
    });
  });

  describe('Status and Statistics', () => {
    test('displays sync status correctly', () => {
      render(
        <AnnotationStateIntegration
          {...defaultProps}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
        />
      );

      expect(screen.getByText('enabled')).toBeInTheDocument();
    });

    test('shows disabled sync status when sync is off', () => {
      render(
        <AnnotationStateIntegration
          {...defaultProps}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
          settings={{
            autoHighlightSelected: true,
            syncWithSelection: false,
            enableAnimations: true,
            persistState: false,
          }}
        />
      );

      expect(screen.getByText('disabled')).toBeInTheDocument();
    });

    test('updates statistics when data changes', () => {
      const { rerender } = render(
        <AnnotationStateIntegration
          {...defaultProps}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
        />
      );

      // Add more annotations
      const moreAnnotations = [
        ...mockAnnotations,
        {
          id: 'annotation-4',
          type: 'probe',
          state: 'completed',
          data: {},
          metadata: {},
        },
      ];

      rerender(
        <AnnotationStateIntegration
          {...defaultProps}
          annotations={moreAnnotations}
          selectedAnnotationIds={['annotation-1', 'annotation-4']}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
        />
      );

      expect(screen.getByText('4')).toBeInTheDocument(); // Total annotations
      expect(screen.getByText('2')).toBeInTheDocument(); // Selected annotations
    });
  });

  describe('Selection History', () => {
    test('shows recent selections when available', async () => {
      const { rerender } = render(
        <AnnotationStateIntegration
          {...defaultProps}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
        />
      );

      // Change selections multiple times to build history
      rerender(
        <AnnotationStateIntegration
          {...defaultProps}
          selectedAnnotationIds={['annotation-2']}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Recent Selections')).toBeInTheDocument();
      });
    });

    test('limits selection history display', async () => {
      const { rerender } = render(
        <AnnotationStateIntegration
          {...defaultProps}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
        />
      );

      // Simulate many selection changes
      for (let i = 1; i <= 7; i++) {
        rerender(
          <AnnotationStateIntegration
            {...defaultProps}
            selectedAnnotationIds={[`annotation-${(i % 3) + 1}`]}
            selectionHandler={mockSelectionHandler}
            highlightStateManager={mockHighlightStateManager}
          />
        );
      }

      // Should only show last 5 selections
      await waitFor(() => {
        const historyBadges = screen.getAllByText(/\d+/);
        const historyCount = historyBadges.filter(
          badge => badge.textContent && ['1', '2', '3'].includes(badge.textContent)
        ).length;
        expect(historyCount).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('Error Handling', () => {
    test('handles highlight creation errors gracefully', async () => {
      mockHighlightStateManager.createHighlightState.mockImplementation(() => {
        throw new Error('Failed to create highlight');
      });

      render(
        <AnnotationStateIntegration
          {...defaultProps}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
        />
      );

      // Component should still render without crashing
      expect(screen.getByText('Annotation State Integration')).toBeInTheDocument();
    });

    test('handles highlight activation errors gracefully', () => {
      mockHighlightStateManager.activateState.mockReturnValue(false);

      render(
        <AnnotationStateIntegration
          {...defaultProps}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
        />
      );

      // Component should still render
      expect(screen.getByText('Annotation State Integration')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    test('handles large number of annotations efficiently', () => {
      const manyAnnotations = Array.from({ length: 100 }, (_, i) => ({
        id: `annotation-${i}`,
        type: 'length' as const,
        state: 'completed' as const,
        data: {},
        metadata: {},
      }));

      const startTime = performance.now();

      render(
        <AnnotationStateIntegration
          {...defaultProps}
          annotations={manyAnnotations}
          selectedAnnotationIds={manyAnnotations.slice(0, 10).map(a => a.id)}
          selectionHandler={mockSelectionHandler}
          highlightStateManager={mockHighlightStateManager}
        />
      );

      const renderTime = performance.now() - startTime;

      // Should render within reasonable time (less than 100ms)
      expect(renderTime).toBeLessThan(100);
      expect(screen.getByText('100')).toBeInTheDocument(); // Total annotations
    });
  });
});
