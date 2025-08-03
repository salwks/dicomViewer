/**
 * Annotation Selection Handler Tests
 * Tests for advanced annotation selection functionality using Cornerstone3D v3 API
 */

import { AnnotationSelectionHandler } from '../services/AnnotationSelectionHandler';
import { AnnotationCompat, AnnotationCompatLayer } from '../types/annotation-compat';

// Mock Cornerstone3D tools
jest.mock('@cornerstonejs/tools', () => ({
  annotation: {
    selection: {
      setAnnotationSelected: jest.fn(),
      getAnnotationsSelected: jest.fn(() => []),
    },
    state: {
      removeAnnotation: jest.fn(),
    },
  },
}));

// Mock DOM methods
Object.defineProperty(global, 'document', {
  value: {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    querySelector: jest.fn(),
    elementFromPoint: jest.fn(),
    createElement: jest.fn(() => ({
      className: '',
      style: { cssText: '' },
      setAttribute: jest.fn(),
      getAttribute: jest.fn(),
      appendChild: jest.fn(),
      remove: jest.fn(),
    })),
    body: {
      appendChild: jest.fn(),
    },
  },
});

describe('AnnotationSelectionHandler', () => {
  let selectionHandler: AnnotationSelectionHandler;
  let mockAnnotation: AnnotationCompat;

  beforeEach(() => {
    selectionHandler = new AnnotationSelectionHandler({
      multiSelect: true,
      highlightSelected: true,
      animateSelection: false, // Disable animations for testing
    });

    mockAnnotation = {
      annotationUID: 'test-annotation-1',
      uid: 'test-annotation-1',
      id: 'test-annotation-1',
      annotationId: 'test-annotation-1',
      metadata: {
        toolName: 'Length',
        viewPlaneNormal: [0, 0, 1],
        FrameOfReferenceUID: 'test-frame',
      },
      data: {
        handles: {
          points: [[10, 10], [50, 50]],
        },
      },
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    selectionHandler.dispose();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const handler = new AnnotationSelectionHandler();
      const config = handler.getConfig();

      expect(config.multiSelect).toBe(true);
      expect(config.highlightSelected).toBe(true);
      expect(config.selectionStyle.color).toBe('#87CEEB'); // Sky blue
      expect(config.enableKeyboardShortcuts).toBe(true);

      handler.dispose();
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        multiSelect: false,
        selectionStyle: {
          color: '#FF0000',
          opacity: 0.5,
          strokeWidth: 2,
          fillOpacity: 0.1,
          shadowBlur: 3,
          shadowColor: '#FF0000',
        },
      };

      const handler = new AnnotationSelectionHandler(customConfig);
      const config = handler.getConfig();

      expect(config.multiSelect).toBe(false);
      expect(config.selectionStyle.color).toBe('#FF0000');
      expect(config.selectionStyle.opacity).toBe(0.5);

      handler.dispose();
    });
  });

  describe('Annotation Selection', () => {
    it('should select annotation successfully', () => {
      // Mock successful selection
      jest.spyOn(AnnotationCompatLayer, 'selectAnnotation').mockReturnValue(true);
      jest.spyOn(AnnotationCompatLayer, 'getAnnotationId').mockReturnValue('test-annotation-1');

      const result = selectionHandler.selectAnnotation(mockAnnotation, 'viewport-1');

      expect(result).toBe(true);
      expect(AnnotationCompatLayer.selectAnnotation).toHaveBeenCalledWith(
        mockAnnotation,
        true,
        false,
      );
    });

    it('should handle selection failure gracefully', () => {
      // Mock failed selection
      jest.spyOn(AnnotationCompatLayer, 'selectAnnotation').mockReturnValue(false);
      jest.spyOn(AnnotationCompatLayer, 'getAnnotationId').mockReturnValue('test-annotation-1');

      const result = selectionHandler.selectAnnotation(mockAnnotation, 'viewport-1');

      expect(result).toBe(false);
    });

    it('should preserve existing selection when multiSelect is enabled', () => {
      jest.spyOn(AnnotationCompatLayer, 'selectAnnotation').mockReturnValue(true);
      jest.spyOn(AnnotationCompatLayer, 'getAnnotationId').mockReturnValue('test-annotation-1');

      const result = selectionHandler.selectAnnotation(mockAnnotation, 'viewport-1', true);

      expect(result).toBe(true);
      expect(AnnotationCompatLayer.selectAnnotation).toHaveBeenCalledWith(
        mockAnnotation,
        true,
        true, // preserveSelected = true
      );
    });

    it('should emit selection events', () => {
      jest.spyOn(AnnotationCompatLayer, 'selectAnnotation').mockReturnValue(true);
      jest.spyOn(AnnotationCompatLayer, 'getAnnotationId').mockReturnValue('test-annotation-1');

      const selectionSpy = jest.fn();
      const changeSpy = jest.fn();

      selectionHandler.on('annotation-selected', selectionSpy);
      selectionHandler.on('selection-changed', changeSpy);

      selectionHandler.selectAnnotation(mockAnnotation, 'viewport-1');

      expect(selectionSpy).toHaveBeenCalledWith(mockAnnotation, 'viewport-1');
      expect(changeSpy).toHaveBeenCalledWith(expect.any(Array), 'viewport-1');
    });
  });

  describe('Annotation Deselection', () => {
    it('should deselect annotation successfully', () => {
      jest.spyOn(AnnotationCompatLayer, 'selectAnnotation').mockReturnValue(true);
      jest.spyOn(AnnotationCompatLayer, 'getAnnotationId').mockReturnValue('test-annotation-1');

      const result = selectionHandler.deselectAnnotation(mockAnnotation, 'viewport-1');

      expect(result).toBe(true);
      expect(AnnotationCompatLayer.selectAnnotation).toHaveBeenCalledWith(
        mockAnnotation,
        false, // selected = false
        true,   // preserveSelected = true
      );
    });

    it('should emit deselection events', () => {
      jest.spyOn(AnnotationCompatLayer, 'selectAnnotation').mockReturnValue(true);
      jest.spyOn(AnnotationCompatLayer, 'getAnnotationId').mockReturnValue('test-annotation-1');

      const deselectionSpy = jest.fn();
      const changeSpy = jest.fn();

      selectionHandler.on('annotation-deselected', deselectionSpy);
      selectionHandler.on('selection-changed', changeSpy);

      selectionHandler.deselectAnnotation(mockAnnotation, 'viewport-1');

      expect(deselectionSpy).toHaveBeenCalledWith(mockAnnotation, 'viewport-1');
      expect(changeSpy).toHaveBeenCalledWith(expect.any(Array), 'viewport-1');
    });
  });

  describe('Selection Management', () => {
    it('should clear selection for viewport', () => {
      jest.spyOn(AnnotationCompatLayer, 'getSelectedAnnotations').mockReturnValue([mockAnnotation]);
      jest.spyOn(AnnotationCompatLayer, 'selectAnnotation').mockReturnValue(true);
      jest.spyOn(AnnotationCompatLayer, 'getAnnotationId').mockReturnValue('test-annotation-1');

      const clearSpy = jest.fn();
      selectionHandler.on('selection-cleared', clearSpy);

      selectionHandler.clearSelection('viewport-1');

      expect(clearSpy).toHaveBeenCalledWith('viewport-1');
      expect(AnnotationCompatLayer.selectAnnotation).toHaveBeenCalledWith(
        mockAnnotation,
        false,
        true,
      );
    });

    it('should clear all selections', () => {
      const clearSpy = jest.fn();
      selectionHandler.on('selection-cleared', clearSpy);

      // Mock some selected annotations
      jest.spyOn(AnnotationCompatLayer, 'getSelectedAnnotations').mockReturnValue([mockAnnotation]);
      jest.spyOn(AnnotationCompatLayer, 'selectAnnotation').mockReturnValue(true);

      selectionHandler.clearAllSelections();

      // Should clear all viewports (none in this test, but method should not error)
      expect(clearSpy).toHaveBeenCalledTimes(0); // No viewports with selections
    });

    it('should check if annotation is selected', () => {
      // Initially not selected
      expect(selectionHandler.isAnnotationSelected('test-annotation-1', 'viewport-1')).toBe(false);

      // Select annotation
      jest.spyOn(AnnotationCompatLayer, 'selectAnnotation').mockReturnValue(true);
      jest.spyOn(AnnotationCompatLayer, 'getAnnotationId').mockReturnValue('test-annotation-1');

      selectionHandler.selectAnnotation(mockAnnotation, 'viewport-1');

      // Should now be selected
      expect(selectionHandler.isAnnotationSelected('test-annotation-1', 'viewport-1')).toBe(true);
    });
  });

  describe('Highlighting', () => {
    beforeEach(() => {
      // Mock DOM element
      const mockElement = {
        style: { cssText: '' },
        remove: jest.fn(),
        setAttribute: jest.fn(),
        getAttribute: jest.fn(),
        className: '',
      };

      (document.querySelector as jest.Mock).mockReturnValue(mockElement);
      (document.createElement as jest.Mock).mockReturnValue(mockElement);
    });

    it('should highlight selected annotation with sky blue color', () => {
      const highlightSpy = jest.fn();
      selectionHandler.on('highlight-applied', highlightSpy);

      selectionHandler.highlightSelectedAnnotation('test-annotation-1', 'viewport-1');

      expect(highlightSpy).toHaveBeenCalledWith(
        'test-annotation-1',
        expect.objectContaining({
          color: '#87CEEB', // Sky blue
        }),
      );
    });

    it('should highlight hovered annotation with gold color', () => {
      const highlightSpy = jest.fn();
      selectionHandler.on('highlight-applied', highlightSpy);

      selectionHandler.highlightHoveredAnnotation('test-annotation-1', 'viewport-1');

      expect(highlightSpy).toHaveBeenCalledWith(
        'test-annotation-1',
        expect.objectContaining({
          color: '#FFD700', // Gold
        }),
      );
    });

    it('should remove highlight from annotation', () => {
      const removeSpy = jest.fn();
      selectionHandler.on('highlight-removed', removeSpy);

      // First add highlight
      selectionHandler.highlightSelectedAnnotation('test-annotation-1', 'viewport-1');

      // Then remove it
      selectionHandler.removeHighlight('test-annotation-1');

      expect(removeSpy).toHaveBeenCalledWith('test-annotation-1');
    });
  });

  describe('Click Handler Setup', () => {
    it('should setup click handler for viewport', () => {
      const mockElement = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };

      selectionHandler.setupViewportClickHandler('viewport-1', mockElement as any);

      expect(mockElement.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
      );
    });

    it('should remove click handler for viewport', () => {
      const mockElement = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };

      (document.querySelector as jest.Mock).mockReturnValue(mockElement);

      // Setup handler first
      selectionHandler.setupViewportClickHandler('viewport-1', mockElement as any);

      // Then remove it
      selectionHandler.removeViewportClickHandler('viewport-1');

      expect(mockElement.removeEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
      );
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const updates = {
        multiSelect: false,
        selectionStyle: {
          color: '#FF0000',
          opacity: 0.8,
          strokeWidth: 4,
          fillOpacity: 0.3,
          shadowBlur: 8,
          shadowColor: '#FF0000',
        },
      };

      selectionHandler.updateConfig(updates);
      const config = selectionHandler.getConfig();

      expect(config.multiSelect).toBe(false);
      expect(config.selectionStyle.color).toBe('#FF0000');
      expect(config.selectionStyle.strokeWidth).toBe(4);
    });

    it('should return current configuration', () => {
      const config = selectionHandler.getConfig();

      expect(config).toHaveProperty('multiSelect');
      expect(config).toHaveProperty('highlightSelected');
      expect(config).toHaveProperty('selectionStyle');
      expect(config.selectionStyle).toHaveProperty('color');
    });
  });

  describe('Cleanup and Disposal', () => {
    it('should dispose properly', () => {
      const mockElement = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        remove: jest.fn(),
        style: { cssText: '' },
        setAttribute: jest.fn(),
        getAttribute: jest.fn(),
        className: '',
      };

      // Setup some state
      selectionHandler.setupViewportClickHandler('viewport-1', mockElement as any);
      selectionHandler.highlightSelectedAnnotation('test-annotation-1', 'viewport-1');

      // Dispose
      selectionHandler.dispose();

      // Should remove keyboard listener
      expect(document.removeEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
      );
    });
  });
});
