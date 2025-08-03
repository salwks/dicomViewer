/**
 * Viewport Assignment Management Hook
 * Manages series assignments to viewports with state persistence
 */

import { useState, useCallback, useEffect } from 'react';
import { ViewportLayout } from '../components/ViewportGrid';

export interface ViewportAssignment {
  viewportId: string;
  seriesIndex: number | null;
  studyUID?: string;
}

export interface UseViewportAssignmentsProps {
  layout: ViewportLayout;
  seriesCount: number;
  initialAssignments?: ViewportAssignment[];
}

export interface UseViewportAssignmentsReturn {
  assignments: ViewportAssignment[];
  assignSeries: (viewportId: string, seriesIndex: number | null) => void;
  clearAssignment: (viewportId: string) => void;
  clearAllAssignments: () => void;
  getAssignedViewport: (seriesIndex: number) => string | null;
  getSeriesForViewport: (viewportId: string) => number | null;
  swapAssignments: (viewportId1: string, viewportId2: string) => void;
}

const getViewportIds = (layout: ViewportLayout): string[] => {
  switch (layout) {
    case '1x1': return ['A'];
    case '1x2': return ['A', 'B'];
    case '2x2': return ['A', 'B', 'C', 'D'];
    default: return ['A'];
  }
};

export const useViewportAssignments = ({
  layout,
  seriesCount,
  initialAssignments = [],
}: UseViewportAssignmentsProps): UseViewportAssignmentsReturn => {

  // Initialize assignments based on layout
  const initializeAssignments = useCallback((): ViewportAssignment[] => {
    const viewportIds = getViewportIds(layout);

    return viewportIds.map(viewportId => {
      const existing = initialAssignments.find(a => a.viewportId === viewportId);
      return existing || {
        viewportId,
        seriesIndex: null,
      };
    });
  }, [layout, initialAssignments]);

  const [assignments, setAssignments] = useState<ViewportAssignment[]>(initializeAssignments);

  // Update assignments when layout changes
  useEffect(() => {
    const currentViewportIds = getViewportIds(layout);

    setAssignments(prevAssignments => {
      // Keep existing assignments for viewports that still exist
      const validAssignments = prevAssignments.filter(a =>
        currentViewportIds.includes(a.viewportId),
      );

      // Add new viewports
      const existingIds = validAssignments.map(a => a.viewportId);
      const newViewports = currentViewportIds
        .filter(id => !existingIds.includes(id))
        .map(id => ({
          viewportId: id,
          seriesIndex: null,
        }));

      return [...validAssignments, ...newViewports];
    });
  }, [layout]);

  // Assign series to viewport
  const assignSeries = useCallback((viewportId: string, seriesIndex: number | null): void => {
    setAssignments(prevAssignments => {
      // Validate series index
      if (seriesIndex !== null && (seriesIndex < 0 || seriesIndex >= seriesCount)) {
        console.warn(`Invalid series index: ${seriesIndex}`);
        return prevAssignments;
      }

      // If assigning a series that's already assigned elsewhere, clear the old assignment
      if (seriesIndex !== null) {
        prevAssignments = prevAssignments.map(assignment =>
          assignment.seriesIndex === seriesIndex
            ? { ...assignment, seriesIndex: null }
            : assignment,
        );
      }

      // Update the target viewport
      return prevAssignments.map(assignment =>
        assignment.viewportId === viewportId
          ? { ...assignment, seriesIndex }
          : assignment,
      );
    });
  }, [seriesCount]);

  // Clear assignment for specific viewport
  const clearAssignment = useCallback((viewportId: string): void => {
    assignSeries(viewportId, null);
  }, [assignSeries]);

  // Clear all assignments
  const clearAllAssignments = useCallback((): void => {
    setAssignments(prevAssignments =>
      prevAssignments.map(assignment => ({
        ...assignment,
        seriesIndex: null,
      })),
    );
  }, []);

  // Get viewport ID for a series
  const getAssignedViewport = useCallback((seriesIndex: number): string | null => {
    const assignment = assignments.find(a => a.seriesIndex === seriesIndex);
    return assignment?.viewportId || null;
  }, [assignments]);

  // Get series index for a viewport
  const getSeriesForViewport = useCallback((viewportId: string): number | null => {
    const assignment = assignments.find(a => a.viewportId === viewportId);
    return assignment?.seriesIndex || null;
  }, [assignments]);

  // Swap assignments between two viewports
  const swapAssignments = useCallback((viewportId1: string, viewportId2: string): void => {
    setAssignments(prevAssignments => {
      const assignment1 = prevAssignments.find(a => a.viewportId === viewportId1);
      const assignment2 = prevAssignments.find(a => a.viewportId === viewportId2);

      if (!assignment1 || !assignment2) {
        console.warn('Cannot swap assignments: viewport not found');
        return prevAssignments;
      }

      return prevAssignments.map(assignment => {
        if (assignment.viewportId === viewportId1) {
          return { ...assignment, seriesIndex: assignment2.seriesIndex };
        }
        if (assignment.viewportId === viewportId2) {
          return { ...assignment, seriesIndex: assignment1.seriesIndex };
        }
        return assignment;
      });
    });
  }, []);

  return {
    assignments,
    assignSeries,
    clearAssignment,
    clearAllAssignments,
    getAssignedViewport,
    getSeriesForViewport,
    swapAssignments,
  };
};
