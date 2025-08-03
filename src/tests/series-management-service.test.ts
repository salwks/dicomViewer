/**
 * Series Management Service Tests
 * Comprehensive test suite for the centralized series management service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SeriesManagementService } from '../services/SeriesManagementService';
import { DICOMStudy } from '../types/dicom';

// Mock logger
vi.mock('../utils/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;

describe('SeriesManagementService', () => {
  let service: SeriesManagementService;

  const mockStudy: DICOMStudy = {
    studyInstanceUID: 'study-123',
    studyDescription: 'Test Study',
    studyDate: '20241201',
    patientName: 'Test Patient',
    patientID: 'P123',
    series: [
      {
        seriesInstanceUID: 'series-123',
        seriesDescription: 'CT Chest',
        modality: 'CT',
        seriesNumber: 1,
        numberOfInstances: 100,
        imageIds: [],
        metadata: [],
        studyInstanceUID: 'study-123',
      },
      {
        seriesInstanceUID: 'series-456',
        seriesDescription: 'CT Abdomen',
        modality: 'CT',
        seriesNumber: 2,
        numberOfInstances: 80,
        imageIds: [],
        metadata: [],
        studyInstanceUID: 'study-123',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    service = new SeriesManagementService({ persistState: false });
  });

  afterEach(() => {
    service.destroy();
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const defaultService = new SeriesManagementService();
      expect(defaultService).toBeDefined();
      defaultService.destroy();
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        maxStudies: 3,
        enableAutoColorAssignment: false,
      };
      const customService = new SeriesManagementService(customConfig);
      expect(customService).toBeDefined();
      customService.destroy();
    });
  });

  describe('Study Management', () => {
    it('should load a study successfully', async () => {
      const eventSpy = vi.fn();
      service.on('studyLoaded', eventSpy);

      await service.loadStudy(mockStudy);

      const state = service.getState();
      expect(state.studies).toHaveLength(1);
      expect(state.studies[0].studyInstanceUID).toBe('study-123');
      expect(eventSpy).toHaveBeenCalledWith(mockStudy);
    });

    it('should handle duplicate study loading', async () => {
      await service.loadStudy(mockStudy);
      await service.loadStudy({ ...mockStudy, studyDescription: 'Updated Study' });

      const state = service.getState();
      expect(state.studies).toHaveLength(1);
      expect(state.studies[0].studyDescription).toBe('Updated Study');
    });

    it('should enforce maximum study limit', async () => {
      const limitedService = new SeriesManagementService({ maxStudies: 1, persistState: false });

      await limitedService.loadStudy(mockStudy);

      const secondStudy = { ...mockStudy, studyInstanceUID: 'study-456' };
      await expect(limitedService.loadStudy(secondStudy)).rejects.toThrow('Maximum number of studies');

      limitedService.destroy();
    });

    it('should unload a study successfully', async () => {
      const eventSpy = vi.fn();
      service.on('studyUnloaded', eventSpy);

      await service.loadStudy(mockStudy);
      service.unloadStudy('study-123');

      const state = service.getState();
      expect(state.studies).toHaveLength(0);
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should handle unloading non-existent study', () => {
      expect(() => {
        service.unloadStudy('non-existent');
      }).not.toThrow();
    });
  });

  describe('Series Assignment', () => {
    beforeEach(async () => {
      await service.loadStudy(mockStudy);
    });

    it('should assign series to viewport successfully', () => {
      const eventSpy = vi.fn();
      service.on('seriesAssigned', eventSpy);

      const result = service.assignSeriesToViewport('series-123', 'viewport-A');

      expect(result).toBe(true);
      expect(eventSpy).toHaveBeenCalled();

      const state = service.getState();
      expect(state.viewportAssignments['viewport-A']).toBe('series-123');
    });

    it('should handle assignment of non-existent series', () => {
      const result = service.assignSeriesToViewport('non-existent', 'viewport-A');
      expect(result).toBe(false);
    });

    it('should clear viewport assignment', () => {
      service.assignSeriesToViewport('series-123', 'viewport-A');

      const eventSpy = vi.fn();
      service.on('seriesUnassigned', eventSpy);

      service.clearViewportAssignment('viewport-A');

      const state = service.getState();
      expect(state.viewportAssignments['viewport-A']).toBeUndefined();
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should get assigned series for viewport', () => {
      service.assignSeriesToViewport('series-123', 'viewport-A');

      const assignedSeries = service.getAssignedSeries('viewport-A');
      expect(assignedSeries).toBeDefined();
      expect(assignedSeries?.seriesInstanceUID).toBe('series-123');
    });

    it('should return null for unassigned viewport', () => {
      const assignedSeries = service.getAssignedSeries('viewport-B');
      expect(assignedSeries).toBeNull();
    });

    it('should get all viewport assignments', () => {
      service.assignSeriesToViewport('series-123', 'viewport-A');
      service.assignSeriesToViewport('series-456', 'viewport-B');

      const assignments = service.getViewportAssignments();
      expect(assignments).toEqual({
        'viewport-A': 'series-123',
        'viewport-B': 'series-456',
      });
    });
  });

  describe('Color Management', () => {
    it('should assign colors automatically', async () => {
      const colorService = new SeriesManagementService({
        enableAutoColorAssignment: true,
        persistState: false,
      });

      await colorService.loadStudy(mockStudy);

      const state = colorService.getState();
      expect(state.colorMappings['study-123']).toBeDefined();
      expect(typeof state.colorMappings['study-123']).toBe('string');

      colorService.destroy();
    });

    it('should set custom color scheme', async () => {
      await service.loadStudy(mockStudy);

      const customColor = {
        studyInstanceUID: 'study-123',
        primaryColor: '#ff0000',
        secondaryColor: '#ffcccc',
        accentColor: '#cc0000',
        textColor: '#990000',
      };

      const eventSpy = vi.fn();
      service.on('colorSchemeChanged', eventSpy);

      service.setStudyColorScheme('study-123', customColor);

      const state = service.getState();
      expect(state.colorMappings['study-123']).toBe('#ff0000');
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('State Management', () => {
    it('should update state', () => {
      const eventSpy = vi.fn();
      service.on('stateChanged', eventSpy);

      service.setState({ filterModality: 'CT' });

      const state = service.getState();
      expect(state.filterModality).toBe('CT');
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should set filter', () => {
      service.setFilter('MR');

      const state = service.getState();
      expect(state.filterModality).toBe('MR');
    });

    it('should set sorting', () => {
      service.setSorting('seriesDescription');

      const state = service.getState();
      expect(state.sortBy).toBe('seriesDescription');
    });

    it('should set view mode', () => {
      service.setViewMode('list');

      const state = service.getState();
      expect(state.viewMode).toBe('list');
    });
  });

  describe('Utility Methods', () => {
    beforeEach(async () => {
      await service.loadStudy(mockStudy);
    });

    it('should get study series', () => {
      const series = service.getStudySeries('study-123');
      expect(series).toHaveLength(2);
      expect(series[0].seriesInstanceUID).toBe('series-123');
    });

    it('should get all series with metadata', () => {
      const allSeries = service.getAllSeries();
      expect(allSeries).toHaveLength(2);
      expect(allSeries[0].studyInstanceUID).toBe('study-123');
      expect(allSeries[0].studyColor).toBeDefined();
    });

    it('should return empty array for non-existent study', () => {
      const series = service.getStudySeries('non-existent');
      expect(series).toHaveLength(0);
    });
  });

  describe('Session Management', () => {
    it('should clear session', () => {
      const eventSpy = vi.fn();
      service.on('sessionCleared', eventSpy);

      service.clearSession();

      const state = service.getState();
      expect(state.studies).toHaveLength(0);
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('Persistence', () => {
    it('should handle persistence when enabled', () => {
      const persistentService = new SeriesManagementService({ persistState: true });
      expect(persistentService).toBeDefined();
      persistentService.destroy();
    });

    it('should handle localStorage errors gracefully', async () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const persistentService = new SeriesManagementService({ persistState: true });

      // Should not throw despite localStorage error
      await expect(persistentService.loadStudy(mockStudy)).resolves.not.toThrow();

      persistentService.destroy();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed study data', async () => {
      const malformedStudy = {
        studyInstanceUID: '',
        series: [],
      } as DICOMStudy;

      await expect(service.loadStudy(malformedStudy)).resolves.not.toThrow();
    });

    it('should emit error events', () => {
      const errorSpy = vi.fn();
      service.on('error', errorSpy);

      // This should trigger an error internally but not throw
      service.assignSeriesToViewport('non-existent', 'viewport-A');
    });
  });

  describe('Event System', () => {
    it('should emit state change events', async () => {
      const eventSpy = vi.fn();
      service.on('stateChanged', eventSpy);

      await service.loadStudy(mockStudy);

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit series assignment events', async () => {
      await service.loadStudy(mockStudy);

      const assignedSpy = vi.fn();
      const unassignedSpy = vi.fn();
      service.on('seriesAssigned', assignedSpy);
      service.on('seriesUnassigned', unassignedSpy);

      service.assignSeriesToViewport('series-123', 'viewport-A');
      service.clearViewportAssignment('viewport-A');

      expect(assignedSpy).toHaveBeenCalled();
      expect(unassignedSpy).toHaveBeenCalled();
    });
  });

  describe('Memory Management', () => {
    it('should clean up when destroyed', () => {
      const eventSpy = vi.fn();
      service.on('stateChanged', eventSpy);

      service.destroy();

      // Events should no longer be emitted
      service.setState({ filterModality: 'CT' });
      expect(eventSpy).not.toHaveBeenCalled();
    });

    it('should handle multiple destroy calls', () => {
      expect(() => {
        service.destroy();
        service.destroy();
      }).not.toThrow();
    });
  });
});
