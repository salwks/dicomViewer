/**
 * Series Management Service
 * Centralized service for managing multi-study series data and viewport assignments
 */

import { EventEmitter } from 'events';
import { log } from '../utils/logger';
import { safePropertyAccess, safePropertySet } from '../lib/utils';
import {
  DICOMStudy,
  DICOMSeries,
  SeriesManagementState,
  SeriesAssignment,
  StudyColorScheme,
  MultiStudySession,
} from '../types/dicom';

export interface SeriesManagementConfig {
  maxStudies: number;
  enableAutoColorAssignment: boolean;
  persistState: boolean;
  sessionTimeout: number; // in milliseconds
  defaultColorScheme: StudyColorScheme[];
}

export const DEFAULT_SERIES_MANAGEMENT_CONFIG: SeriesManagementConfig = {
  maxStudies: 5,
  enableAutoColorAssignment: true,
  persistState: true,
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  defaultColorScheme: [
    {
      studyInstanceUID: '',
      primaryColor: '#3b82f6',
      secondaryColor: '#dbeafe',
      accentColor: '#1d4ed8',
      textColor: '#1e40af',
    }, // Blue
    {
      studyInstanceUID: '',
      primaryColor: '#10b981',
      secondaryColor: '#d1fae5',
      accentColor: '#059669',
      textColor: '#047857',
    }, // Green
    {
      studyInstanceUID: '',
      primaryColor: '#f59e0b',
      secondaryColor: '#fef3c7',
      accentColor: '#d97706',
      textColor: '#b45309',
    }, // Amber
    {
      studyInstanceUID: '',
      primaryColor: '#ef4444',
      secondaryColor: '#fee2e2',
      accentColor: '#dc2626',
      textColor: '#b91c1c',
    }, // Red
    {
      studyInstanceUID: '',
      primaryColor: '#8b5cf6',
      secondaryColor: '#ede9fe',
      accentColor: '#7c3aed',
      textColor: '#6d28d9',
    }, // Violet
  ],
};

export class SeriesManagementService extends EventEmitter {
  private config: SeriesManagementConfig;
  private currentSession: MultiStudySession | null = null;
  private managementState: SeriesManagementState;
  private colorAssignmentIndex = 0;

  constructor(config: Partial<SeriesManagementConfig> = {}) {
    super();
    this.config = { ...DEFAULT_SERIES_MANAGEMENT_CONFIG, ...config };
    this.managementState = this.createInitialState();

    this.initializeService();
  }

  private initializeService(): void {
    log.info('Initializing Series Management Service', {
      component: 'SeriesManagementService',
      metadata: { config: this.config },
    });

    // Load persisted state if enabled
    if (this.config.persistState) {
      this.loadPersistedState();
    }

    // Setup session cleanup
    this.setupSessionCleanup();
  }

  private createInitialState(): SeriesManagementState {
    return {
      studies: [],
      selectedStudy: null,
      selectedSeries: null,
      viewportAssignments: {},
      draggedSeries: null,
      loadingStates: {},
      colorMappings: {},
      filterModality: 'all',
      sortBy: 'seriesNumber',
      viewMode: 'grid',
      showThumbnails: true,
      groupByStudy: true,
    };
  }

  // ===== Study Management =====

  public async loadStudy(study: DICOMStudy): Promise<void> {
    try {
      // Check study limit
      if (this.managementState.studies.length >= this.config.maxStudies) {
        throw new Error(`Maximum number of studies (${this.config.maxStudies}) reached`);
      }

      // Check if study already exists
      const existingIndex = this.managementState.studies.findIndex(s => s.studyInstanceUID === study.studyInstanceUID);

      if (existingIndex >= 0) {
        // Update existing study
        const existingStudy = safePropertyAccess(this.managementState.studies, existingIndex);
        if (existingStudy) {
          safePropertySet(this.managementState.studies, existingIndex, {
            ...existingStudy,
            ...study,
            loadingState: 'loaded',
          });
        }
      } else {
        // Add new study
        const enhancedStudy: DICOMStudy = {
          ...study,
          loadingState: 'loaded',
          isActive: this.managementState.studies.length === 0, // First study is active by default
          priority: this.managementState.studies.length,
        };

        this.managementState.studies.push(enhancedStudy);

        // Assign color scheme
        if (this.config.enableAutoColorAssignment) {
          this.assignColorScheme(study.studyInstanceUID);
        }
      }

      // Create or update session
      this.updateSession();

      this.emit('studyLoaded', study);
      this.emit('stateChanged', this.managementState);

      log.info('Study loaded successfully', {
        component: 'SeriesManagementService',
        metadata: { studyUID: study.studyInstanceUID, totalStudies: this.managementState.studies.length },
      });
    } catch (error) {
      log.error('Failed to load study', {
        component: 'SeriesManagementService',
        metadata: {
          studyUID: study.studyInstanceUID,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  /**
   * Load a specific series by UID
   */
  public async loadSeries(seriesInstanceUID: string): Promise<DICOMSeries | null> {
    try {
      // Search for the series in loaded studies
      for (const study of this.managementState.studies) {
        const series = study.series.find(s => s.seriesInstanceUID === seriesInstanceUID);
        if (series) {
          log.info('Series found in loaded study', {
            component: 'SeriesManagementService',
            metadata: {
              seriesUID: seriesInstanceUID,
              studyUID: study.studyInstanceUID,
            },
          });
          return series;
        }
      }

      // If not found in loaded studies, this would typically load from PACS
      // For now, return null to indicate series not available
      log.warn('Series not found in loaded studies', {
        component: 'SeriesManagementService',
        metadata: { seriesUID: seriesInstanceUID },
      });

      return null;
    } catch (error) {
      log.error(
        'Failed to load series',
        {
          component: 'SeriesManagementService',
          metadata: { seriesUID: seriesInstanceUID },
        },
        error as Error,
      );
      return null;
    }
  }

  public unloadStudy(studyInstanceUID: string): void {
    const studyIndex = this.managementState.studies.findIndex(s => s.studyInstanceUID === studyInstanceUID);

    if (studyIndex === -1) {
      log.warn('Attempted to unload non-existent study', {
        component: 'SeriesManagementService',
        metadata: { studyUID: studyInstanceUID },
      });
      return;
    }

    // Remove series assignments for this study
    this.clearStudyAssignments(studyInstanceUID);

    // Remove study
    const removedStudy = this.managementState.studies.splice(studyIndex, 1)[0];

    // Update active study if needed
    if (this.managementState.selectedStudy === studyInstanceUID) {
      this.managementState.selectedStudy =
        this.managementState.studies.length > 0 ? this.managementState.studies[0].studyInstanceUID : null;
    }

    // Remove color mapping

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [studyInstanceUID]: _removed, ...remainingColorMappings } = this.managementState.colorMappings;
    this.managementState.colorMappings = remainingColorMappings;

    this.updateSession();
    this.emit('studyUnloaded', removedStudy);
    this.emit('stateChanged', this.managementState);

    log.info('Study unloaded successfully', {
      component: 'SeriesManagementService',
      metadata: { studyUID: studyInstanceUID },
    });
  }

  // ===== Series Assignment Management =====

  public assignSeriesToViewport(seriesInstanceUID: string, viewportId: string): boolean {
    try {
      // Find the series
      const series = this.findSeries(seriesInstanceUID);
      if (!series) {
        log.warn('Attempted to assign non-existent series', {
          component: 'SeriesManagementService',
          metadata: { seriesInstanceUID, viewportId },
        });
        return false;
      }

      // Clear any existing assignment for this viewport
      this.clearViewportAssignment(viewportId);

      // Create new assignment
      const assignment: SeriesAssignment = {
        seriesInstanceUID,
        viewportId,
        assignedAt: new Date(),
        studyInstanceUID: series.studyInstanceUID,
      };

      safePropertySet(this.managementState.viewportAssignments, viewportId, seriesInstanceUID);

      // Update session
      if (this.currentSession) {
        this.currentSession.viewportAssignments.set(viewportId, assignment);
      }

      this.emit('seriesAssigned', assignment);
      this.emit('stateChanged', this.managementState);

      log.info('Series assigned to viewport', {
        component: 'SeriesManagementService',
        metadata: { ...assignment } as Record<string, unknown>,
      });

      return true;
    } catch (error) {
      log.error('Failed to assign series to viewport', {
        component: 'SeriesManagementService',
        metadata: {
          seriesInstanceUID,
          viewportId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      return false;
    }
  }

  public clearViewportAssignment(viewportId: string): void {
    const currentSeriesUID = safePropertyAccess(this.managementState.viewportAssignments, viewportId);

    if (currentSeriesUID) {

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [viewportId]: _removed, ...remainingAssignments } = this.managementState.viewportAssignments;
      this.managementState.viewportAssignments = remainingAssignments;

      if (this.currentSession) {
        this.currentSession.viewportAssignments.delete(viewportId);
      }

      this.emit('seriesUnassigned', { viewportId, seriesInstanceUID: currentSeriesUID });
      this.emit('stateChanged', this.managementState);

      log.info('Viewport assignment cleared', {
        component: 'SeriesManagementService',
        metadata: { viewportId, seriesInstanceUID: currentSeriesUID },
      });
    }
  }

  private clearStudyAssignments(studyInstanceUID: string): void {
    const assignmentsToRemove: string[] = [];

    // Find all viewports assigned to series from this study
    for (const [viewportId, seriesUID] of Object.entries(this.managementState.viewportAssignments)) {
      const series = this.findSeries(seriesUID);
      if (series && series.studyInstanceUID === studyInstanceUID) {
        assignmentsToRemove.push(viewportId);
      }
    }

    // Clear assignments
    assignmentsToRemove.forEach(viewportId => {
      this.clearViewportAssignment(viewportId);
    });
  }

  // ===== Color Management =====

  private assignColorScheme(studyInstanceUID: string): void {
    if (safePropertyAccess(this.managementState.colorMappings, studyInstanceUID)) {
      return; // Already has color assigned
    }

    const colorScheme = safePropertyAccess(
      this.config.defaultColorScheme,
      this.colorAssignmentIndex % this.config.defaultColorScheme.length,
    );
    if (colorScheme) {
      safePropertySet(this.managementState.colorMappings, studyInstanceUID, colorScheme.primaryColor);
    }

    this.colorAssignmentIndex++;

    log.info('Color scheme assigned to study', {
      component: 'SeriesManagementService',
      metadata: { studyInstanceUID, color: colorScheme?.primaryColor },
    });
  }

  public setStudyColorScheme(studyInstanceUID: string, colorScheme: StudyColorScheme): void {
    safePropertySet(this.managementState.colorMappings, studyInstanceUID, colorScheme.primaryColor);

    this.emit('colorSchemeChanged', { studyInstanceUID, colorScheme });
    this.emit('stateChanged', this.managementState);

    log.info('Study color scheme updated', {
      component: 'SeriesManagementService',
      metadata: { studyInstanceUID, colorScheme },
    });
  }

  // ===== State Management =====

  public setState(newState: Partial<SeriesManagementState>): void {
    this.managementState = { ...this.managementState, ...newState };
    this.emit('stateChanged', this.managementState);
  }

  public getState(): SeriesManagementState {
    return { ...this.managementState };
  }

  public setFilter(filterModality: string): void {
    this.managementState.filterModality = filterModality;
    this.emit('stateChanged', this.managementState);
  }

  public setSorting(sortBy: 'seriesNumber' | 'seriesDescription' | 'modality' | 'studyDate'): void {
    this.managementState.sortBy = sortBy;
    this.emit('stateChanged', this.managementState);
  }

  public setViewMode(viewMode: 'grid' | 'list' | 'tree'): void {
    this.managementState.viewMode = viewMode;
    this.emit('stateChanged', this.managementState);
  }

  // ===== Utility Methods =====

  private findSeries(seriesInstanceUID: string): (DICOMSeries & { studyInstanceUID: string }) | null {
    for (const study of this.managementState.studies) {
      const series = study.series.find(s => s.seriesInstanceUID === seriesInstanceUID);
      if (series) {
        return { ...series, studyInstanceUID: study.studyInstanceUID };
      }
    }
    return null;
  }

  public getStudySeries(studyInstanceUID: string): DICOMSeries[] {
    const study = this.managementState.studies.find(s => s.studyInstanceUID === studyInstanceUID);
    return study ? study.series : [];
  }

  public getAllSeries(): (DICOMSeries & { studyInstanceUID: string; studyColor?: string })[] {
    return this.managementState.studies.flatMap(study =>
      study.series.map(series => ({
        ...series,
        studyInstanceUID: study.studyInstanceUID,
        studyColor: safePropertyAccess(this.managementState.colorMappings, study.studyInstanceUID),
      })),
    );
  }

  public getAssignedSeries(viewportId: string): (DICOMSeries & { studyInstanceUID: string }) | null {
    const seriesUID = safePropertyAccess(this.managementState.viewportAssignments, viewportId);
    return seriesUID ? this.findSeries(seriesUID) : null;
  }

  public getViewportAssignments(): Record<string, string> {
    return { ...this.managementState.viewportAssignments };
  }

  // ===== Session Management =====

  private updateSession(): void {
    if (!this.currentSession) {
      this.currentSession = {
        sessionId: `session-${Date.now()}`,
        studies: [...this.managementState.studies],
        activeStudyId: this.managementState.selectedStudy,
        viewportAssignments: new Map(),
        colorSchemes: new Map(),
        loadedSeries: new Set(),
        createdAt: new Date(),
        lastActivity: new Date(),
      };
    } else {
      this.currentSession.studies = [...this.managementState.studies];
      this.currentSession.activeStudyId = this.managementState.selectedStudy;
      this.currentSession.lastActivity = new Date();
    }

    // Update loaded series set
    this.managementState.studies.forEach(study => {
      study.series.forEach(series => {
        if (series.isLoaded) {
          this.currentSession!.loadedSeries.add(series.seriesInstanceUID);
        }
      });
    });

    if (this.config.persistState) {
      this.persistState();
    }
  }

  private setupSessionCleanup(): void {
    // Clean up expired sessions periodically
    setInterval(() => {
      if (this.currentSession) {
        const now = new Date();
        const sessionAge = now.getTime() - this.currentSession.lastActivity.getTime();

        if (sessionAge > this.config.sessionTimeout) {
          log.info('Session expired, cleaning up', {
            component: 'SeriesManagementService',
            metadata: { sessionId: this.currentSession.sessionId, age: sessionAge },
          });

          this.clearSession();
        }
      }
    }, 60000); // Check every minute
  }

  public clearSession(): void {
    this.currentSession = null;
    this.managementState = this.createInitialState();
    this.colorAssignmentIndex = 0;

    if (this.config.persistState) {
      this.clearPersistedState();
    }

    this.emit('sessionCleared');
    this.emit('stateChanged', this.managementState);

    log.info('Session cleared', {
      component: 'SeriesManagementService',
    });
  }

  // ===== Persistence =====

  private persistState(): void {
    try {
      const stateToStore = {
        managementState: this.managementState,
        session: this.currentSession
          ? {
            ...this.currentSession,
            viewportAssignments: Array.from(this.currentSession.viewportAssignments.entries()),
            colorSchemes: Array.from(this.currentSession.colorSchemes.entries()),
            loadedSeries: Array.from(this.currentSession.loadedSeries),
          }
          : null,
        timestamp: new Date().toISOString(),
      };

      localStorage.setItem('seriesManagementState', JSON.stringify(stateToStore));
    } catch (error) {
      log.error('Failed to persist state', {
        component: 'SeriesManagementService',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
    }
  }

  private loadPersistedState(): void {
    try {
      const stored = localStorage.getItem('seriesManagementState');
      if (!stored) return;

      const { managementState, session, timestamp } = JSON.parse(stored);

      // Check if state is not too old
      const stateAge = new Date().getTime() - new Date(timestamp).getTime();
      if (stateAge > this.config.sessionTimeout) {
        log.info('Persisted state too old, starting fresh', {
          component: 'SeriesManagementService',
          metadata: { age: stateAge },
        });
        this.clearPersistedState();
        return;
      }

      this.managementState = managementState;

      if (session) {
        this.currentSession = {
          ...session,
          viewportAssignments: new Map(session.viewportAssignments),
          colorSchemes: new Map(session.colorSchemes),
          loadedSeries: new Set(session.loadedSeries),
          createdAt: new Date(session.createdAt),
          lastActivity: new Date(session.lastActivity),
        };
      }

      log.info('Persisted state loaded successfully', {
        component: 'SeriesManagementService',
        metadata: { studyCount: this.managementState.studies.length },
      });
    } catch (error) {
      log.error('Failed to load persisted state', {
        component: 'SeriesManagementService',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      this.clearPersistedState();
    }
  }

  private clearPersistedState(): void {
    try {
      localStorage.removeItem('seriesManagementState');
    } catch (error) {
      log.error('Failed to clear persisted state', {
        component: 'SeriesManagementService',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
    }
  }

  // ===== Cleanup =====

  public destroy(): void {
    this.clearSession();
    this.removeAllListeners();

    log.info('Series Management Service destroyed', {
      component: 'SeriesManagementService',
    });
  }
}

// Singleton instance
export const seriesManagementService = new SeriesManagementService();
