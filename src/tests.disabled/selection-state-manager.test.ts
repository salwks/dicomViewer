/**
 * Selection State Manager Tests
 * Tests for the comprehensive selection state management system
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SelectionStateManager } from '../services/SelectionStateManager';
import { AnnotationSelectionHandler } from '../services/AnnotationSelectionHandler';

describe('SelectionStateManager', () => {
  let stateManager: SelectionStateManager;
  let selectionHandler: AnnotationSelectionHandler;

  beforeEach(() => {
    stateManager = new SelectionStateManager();
    selectionHandler = new AnnotationSelectionHandler({}, stateManager);
  });

  afterEach(() => {
    stateManager.dispose();
    selectionHandler.dispose();
  });

  describe('Basic State Management', () => {
    it('should create and manage selection states', () => {
      const viewportId = 'test-viewport';
      const annotationIds = ['ann-1', 'ann-2', 'ann-3'];

      // Create initial state
      const state = stateManager.createState(viewportId, annotationIds);

      expect(state.viewportId).toBe(viewportId);
      expect(state.selectedAnnotationIds.size).toBe(3);
      expect(Array.from(state.selectedAnnotationIds)).toEqual(annotationIds);
    });

    it('should update selection state correctly', () => {
      const viewportId = 'test-viewport';
      const annotationIds = ['ann-1', 'ann-2'];

      const state = stateManager.updateState(viewportId, annotationIds);

      expect(stateManager.getCurrentState(viewportId)).toBe(state);
      expect(stateManager.isAnnotationSelected(viewportId, 'ann-1')).toBe(true);
      expect(stateManager.isAnnotationSelected(viewportId, 'ann-3')).toBe(false);
    });

    it('should handle individual annotation selection', () => {
      const viewportId = 'test-viewport';

      // Select first annotation
      const state1 = stateManager.selectAnnotation(viewportId, 'ann-1');
      expect(state1.selectedAnnotationIds.size).toBe(1);
      expect(stateManager.isAnnotationSelected(viewportId, 'ann-1')).toBe(true);

      // Add second annotation (preserve existing)
      const state2 = stateManager.selectAnnotation(viewportId, 'ann-2', true);
      expect(state2.selectedAnnotationIds.size).toBe(2);
      expect(stateManager.isAnnotationSelected(viewportId, 'ann-1')).toBe(true);
      expect(stateManager.isAnnotationSelected(viewportId, 'ann-2')).toBe(true);

      // Replace with third annotation (don't preserve)
      const state3 = stateManager.selectAnnotation(viewportId, 'ann-3', false);
      expect(state3.selectedAnnotationIds.size).toBe(1);
      expect(stateManager.isAnnotationSelected(viewportId, 'ann-1')).toBe(false);
      expect(stateManager.isAnnotationSelected(viewportId, 'ann-2')).toBe(false);
      expect(stateManager.isAnnotationSelected(viewportId, 'ann-3')).toBe(true);
    });
  });

  describe('History Management', () => {
    it('should track selection history', () => {
      const viewportId = 'test-viewport';

      // Initial selection
      stateManager.selectAnnotation(viewportId, 'ann-1');
      expect(stateManager.getHistory().length).toBe(0); // No history yet (first state)

      // Add second annotation
      stateManager.selectAnnotation(viewportId, 'ann-2', true);
      expect(stateManager.getHistory().length).toBe(1);

      // Clear selection
      stateManager.clearSelection(viewportId);
      expect(stateManager.getHistory().length).toBe(2);
    });

    it('should support undo operations', () => {
      const viewportId = 'test-viewport';

      // Build up some selection history
      stateManager.selectAnnotation(viewportId, 'ann-1');
      stateManager.selectAnnotation(viewportId, 'ann-2', true);
      stateManager.selectAnnotation(viewportId, 'ann-3', true);

      expect(stateManager.getSelectionCount(viewportId)).toBe(3);

      // Undo last operation
      const restoredState = stateManager.undoLastOperation(viewportId);
      expect(restoredState).toBeTruthy();
      expect(stateManager.getSelectionCount(viewportId)).toBe(2);
      expect(stateManager.isAnnotationSelected(viewportId, 'ann-3')).toBe(false);
    });
  });

  describe('Bulk Operations', () => {
    it('should handle bulk selection operations', async () => {
      const viewportId = 'test-viewport';
      const annotationIds = ['ann-1', 'ann-2', 'ann-3', 'ann-4', 'ann-5'];

      let progressCallbacks = 0;
      const config = {
        batchSize: 2,
        delayBetweenBatches: 10,
        progressCallback: (completed: number, total: number) => {
          progressCallbacks++;
          expect(completed).toBeLessThanOrEqual(total);
        },
      };

      const finalState = await stateManager.selectMultipleAnnotations(viewportId, annotationIds, false, config);

      expect(finalState.selectedAnnotationIds.size).toBe(5);
      expect(progressCallbacks).toBeGreaterThan(0);
      annotationIds.forEach(id => {
        expect(stateManager.isAnnotationSelected(viewportId, id)).toBe(true);
      });
    });

    it('should handle bulk deselection operations', async () => {
      const viewportId = 'test-viewport';
      const annotationIds = ['ann-1', 'ann-2', 'ann-3', 'ann-4', 'ann-5'];

      // First select all annotations
      await stateManager.selectMultipleAnnotations(viewportId, annotationIds);
      expect(stateManager.getSelectionCount(viewportId)).toBe(5);

      // Then deselect some of them
      const toDeselect = ['ann-2', 'ann-4'];
      await stateManager.deselectMultipleAnnotations(viewportId, toDeselect);

      expect(stateManager.getSelectionCount(viewportId)).toBe(3);
      expect(stateManager.isAnnotationSelected(viewportId, 'ann-1')).toBe(true);
      expect(stateManager.isAnnotationSelected(viewportId, 'ann-2')).toBe(false);
      expect(stateManager.isAnnotationSelected(viewportId, 'ann-3')).toBe(true);
      expect(stateManager.isAnnotationSelected(viewportId, 'ann-4')).toBe(false);
      expect(stateManager.isAnnotationSelected(viewportId, 'ann-5')).toBe(true);
    });
  });

  describe('State Persistence', () => {
    it('should persist and restore selection state', () => {
      const viewportId = 'test-viewport';
      const annotationIds = ['ann-1', 'ann-2', 'ann-3'];

      // Create some selection state
      stateManager.selectMultipleAnnotations(viewportId, annotationIds);
      const originalState = stateManager.getCurrentState(viewportId);

      // Persist state
      const serialized = stateManager.persistState(viewportId);
      expect(serialized).toBeTruthy();

      // Clear state
      stateManager.clearSelection(viewportId);
      expect(stateManager.getSelectionCount(viewportId)).toBe(0);

      // Restore state
      const restoredState = stateManager.restoreState(viewportId, serialized);
      expect(restoredState).toBeTruthy();
      expect(restoredState!.selectedAnnotationIds.size).toBe(3);

      annotationIds.forEach(id => {
        expect(stateManager.isAnnotationSelected(viewportId, id)).toBe(true);
      });
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide accurate statistics', () => {
      const viewportId1 = 'viewport-1';
      const viewportId2 = 'viewport-2';

      // Create selections in multiple viewports
      stateManager.selectAnnotation(viewportId1, 'ann-1');
      stateManager.selectAnnotation(viewportId1, 'ann-2', true);
      stateManager.selectAnnotation(viewportId2, 'ann-3');

      const stats = stateManager.getStatistics();

      expect(stats.totalViewports).toBe(2);
      expect(stats.activeViewports).toBe(2);
      expect(stats.totalSelections).toBe(3);
      expect(stats.historyEntries).toBe(2); // Two selections created history
    });

    it('should track active viewports correctly', () => {
      const viewportId1 = 'viewport-1';
      const viewportId2 = 'viewport-2';

      // Initially no active viewports
      expect(stateManager.getActiveViewportIds()).toEqual([]);

      // Add selections
      stateManager.selectAnnotation(viewportId1, 'ann-1');
      stateManager.selectAnnotation(viewportId2, 'ann-2');

      const activeViewports = stateManager.getActiveViewportIds();
      expect(activeViewports).toHaveLength(2);
      expect(activeViewports).toContain(viewportId1);
      expect(activeViewports).toContain(viewportId2);

      // Clear one viewport
      stateManager.clearSelection(viewportId1);
      expect(stateManager.getActiveViewportIds()).toEqual([viewportId2]);
    });
  });

  describe('Integration with AnnotationSelectionHandler', () => {
    it('should integrate with selection handler events', done => {
      const viewportId = 'test-viewport';

      // Listen for state change events
      selectionHandler.on('selection-state-changed', (beforeState, afterState) => {
        expect(afterState.viewportId).toBe(viewportId);
        expect(afterState.selectedAnnotationIds.size).toBe(1);
        done();
      });

      // Create selection through handler
      const mockAnnotation = {
        annotationUID: 'ann-1',
        uid: 'ann-1',
        id: 'ann-1',
        annotationId: 'ann-1',
        data: { toolName: 'Length' },
      };

      // Note: This would normally call the real Cornerstone API
      // For testing, we just verify the state manager integration
      stateManager.selectAnnotation(viewportId, 'ann-1');
    });

    it('should provide bulk operation methods through handler', async () => {
      const viewportId = 'test-viewport';
      const annotationIds = ['ann-1', 'ann-2', 'ann-3'];

      const result = await selectionHandler.selectMultipleAnnotations(viewportId, annotationIds, false);

      expect(result).toBe(true);
      expect(selectionHandler.getSelectionCount(viewportId)).toBe(3);

      annotationIds.forEach(id => {
        expect(selectionHandler.isAnnotationSelected(id, viewportId)).toBe(true);
      });
    });
  });
});
