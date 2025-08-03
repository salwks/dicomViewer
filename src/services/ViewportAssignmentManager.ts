/**
 * Viewport Assignment Manager
 * Manages series-to-viewport assignments with validation and state synchronization
 */

import { EventEmitter } from 'events';
import { log } from '../utils/logger';
import { seriesManagementService } from './SeriesManagementService';
import { viewportStateManager } from './viewportStateManager';
import { DICOMSeries, SeriesAssignment } from '../types/dicom';
// import { ViewportState } from '../types/viewportState'; // For future use

export interface ViewportAssignmentConfig {
  maxViewports: number;
  allowMultipleAssignments: boolean;
  autoLoadSeries: boolean;
  validateAssignments: boolean;
  synchronizeWithViewportState: boolean;
}

export const DEFAULT_VIEWPORT_ASSIGNMENT_CONFIG: ViewportAssignmentConfig = {
  maxViewports: 4,
  allowMultipleAssignments: false,
  autoLoadSeries: true,
  validateAssignments: true,
  synchronizeWithViewportState: true,
};

export interface ViewportAssignmentState {
  viewportId: string;
  seriesInstanceUID: string | null;
  studyInstanceUID: string | null;
  isActive: boolean;
  isLoading: boolean;
  lastModified: Date;
  metadata?: {
    modality?: string;
    seriesDescription?: string;
    numberOfImages?: number;
  };
}

export interface AssignmentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class ViewportAssignmentManager extends EventEmitter {
  private config: ViewportAssignmentConfig;
  private assignments: Map<string, ViewportAssignmentState>;
  private activeViewport: string | null = null;
  private loadingViewports: Set<string> = new Set();

  constructor(config: Partial<ViewportAssignmentConfig> = {}) {
    super();
    this.config = { ...DEFAULT_VIEWPORT_ASSIGNMENT_CONFIG, ...config };
    this.assignments = new Map();

    this.initializeManager();
  }

  private initializeManager(): void {
    log.info('Initializing Viewport Assignment Manager', {
      component: 'ViewportAssignmentManager',
      metadata: { config: this.config },
    });

    // Listen to series management events
    seriesManagementService.on('seriesAssigned', this.handleSeriesAssigned.bind(this));
    seriesManagementService.on('seriesUnassigned', this.handleSeriesUnassigned.bind(this));
    seriesManagementService.on('studyUnloaded', this.handleStudyUnloaded.bind(this));

    // Listen to viewport state events if synchronization is enabled
    if (this.config.synchronizeWithViewportState) {
      viewportStateManager.on('viewportActivated', this.handleViewportActivated.bind(this));
      viewportStateManager.on('viewportDeactivated', this.handleViewportDeactivated.bind(this));
    }
  }

  // ===== Assignment Management =====

  public async assignSeriesToViewport(
    seriesInstanceUID: string,
    viewportId: string,
    options: { skipValidation?: boolean; autoLoad?: boolean } = {},
  ): Promise<boolean> {
    try {
      // Validate assignment if required
      if (this.config.validateAssignments && !options.skipValidation) {
        const validation = this.validateAssignment(seriesInstanceUID, viewportId);
        if (!validation.isValid) {
          log.error('Assignment validation failed', {
            component: 'ViewportAssignmentManager',
            metadata: { seriesInstanceUID, viewportId, errors: validation.errors },
          });
          this.emit('assignmentFailed', { seriesInstanceUID, viewportId, errors: validation.errors });
          return false;
        }

        if (validation.warnings.length > 0) {
          log.warn('Assignment has warnings', {
            component: 'ViewportAssignmentManager',
            metadata: { warnings: validation.warnings },
          });
        }
      }

      // Get series metadata
      const series = this.getSeriesMetadata(seriesInstanceUID);
      if (!series) {
        log.error('Series not found', {
          component: 'ViewportAssignmentManager',
          metadata: { seriesInstanceUID },
        });
        return false;
      }

      // Clear any existing assignment for this viewport
      this.clearViewportAssignment(viewportId, { skipSeriesManagement: true });

      // Create new assignment state
      const assignmentState: ViewportAssignmentState = {
        viewportId,
        seriesInstanceUID,
        studyInstanceUID: series.studyInstanceUID,
        isActive: this.activeViewport === viewportId,
        isLoading: false,
        lastModified: new Date(),
        metadata: {
          modality: series.modality,
          seriesDescription: series.seriesDescription,
          numberOfImages: series.numberOfInstances,
        },
      };

      this.assignments.set(viewportId, assignmentState);

      // Update series management service
      const success = seriesManagementService.assignSeriesToViewport(seriesInstanceUID, viewportId);
      if (!success) {
        this.assignments.delete(viewportId);
        return false;
      }

      // Synchronize with viewport state if enabled
      if (this.config.synchronizeWithViewportState) {
        this.syncViewportState(viewportId, seriesInstanceUID);
      }

      // Auto-load series if enabled
      if ((this.config.autoLoadSeries || options.autoLoad) && !series.isLoaded) {
        this.loadSeriesForViewport(viewportId, seriesInstanceUID);
      }

      this.emit('assignmentCreated', assignmentState);
      this.emit('stateChanged', this.getState());

      log.info('Series assigned to viewport', {
        component: 'ViewportAssignmentManager',
        metadata: { ...assignmentState } as Record<string, unknown>,
      });

      return true;

    } catch (error) {
      log.error('Failed to assign series to viewport', {
        component: 'ViewportAssignmentManager',
        metadata: {
          seriesInstanceUID,
          viewportId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      return false;
    }
  }

  public clearViewportAssignment(
    viewportId: string,
    options: { skipSeriesManagement?: boolean } = {},
  ): void {
    const assignment = this.assignments.get(viewportId);
    if (!assignment) {
      return;
    }

    // Remove from loading set if present
    this.loadingViewports.delete(viewportId);

    // Clear from series management if not skipped
    if (!options.skipSeriesManagement) {
      seriesManagementService.clearViewportAssignment(viewportId);
    }

    // Clear viewport state if synchronization is enabled
    if (this.config.synchronizeWithViewportState) {
      this.clearViewportState(viewportId);
    }

    this.assignments.delete(viewportId);

    this.emit('assignmentCleared', { viewportId, previousSeriesUID: assignment.seriesInstanceUID });
    this.emit('stateChanged', this.getState());

    log.info('Viewport assignment cleared', {
      component: 'ViewportAssignmentManager',
      metadata: { viewportId, seriesInstanceUID: assignment.seriesInstanceUID },
    });
  }

  public clearAllAssignments(): void {
    const viewportIds = Array.from(this.assignments.keys());

    viewportIds.forEach(viewportId => {
      this.clearViewportAssignment(viewportId);
    });

    this.activeViewport = null;
    this.loadingViewports.clear();

    this.emit('allAssignmentsCleared');
    this.emit('stateChanged', this.getState());

    log.info('All viewport assignments cleared', {
      component: 'ViewportAssignmentManager',
      metadata: { clearedCount: viewportIds.length },
    });
  }

  // ===== Validation =====

  private validateAssignment(seriesInstanceUID: string, viewportId: string): AssignmentValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check viewport limit
    if (this.assignments.size >= this.config.maxViewports && !this.assignments.has(viewportId)) {
      errors.push(`Maximum viewport limit (${this.config.maxViewports}) reached`);
    }

    // Check if series exists
    const series = this.getSeriesMetadata(seriesInstanceUID);
    if (!series) {
      errors.push(`Series ${seriesInstanceUID} not found`);
    }

    // Check multiple assignments
    if (!this.config.allowMultipleAssignments) {
      for (const [vId, assignment] of this.assignments) {
        if (assignment.seriesInstanceUID === seriesInstanceUID && vId !== viewportId) {
          warnings.push(`Series already assigned to viewport ${vId}`);
        }
      }
    }

    // Check if viewport is loading
    if (this.loadingViewports.has(viewportId)) {
      warnings.push(`Viewport ${viewportId} is currently loading another series`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ===== State Queries =====

  public getAssignment(viewportId: string): ViewportAssignmentState | null {
    return this.assignments.get(viewportId) || null;
  }

  public getAssignmentBySeries(seriesInstanceUID: string): ViewportAssignmentState | null {
    for (const assignment of this.assignments.values()) {
      if (assignment.seriesInstanceUID === seriesInstanceUID) {
        return assignment;
      }
    }
    return null;
  }

  public getAllAssignments(): ViewportAssignmentState[] {
    return Array.from(this.assignments.values());
  }

  public getAssignedViewports(): string[] {
    return Array.from(this.assignments.keys());
  }

  public getUnassignedViewports(totalViewports: string[]): string[] {
    return totalViewports.filter(viewportId => !this.assignments.has(viewportId));
  }

  public isViewportAssigned(viewportId: string): boolean {
    return this.assignments.has(viewportId);
  }

  public isSeriesAssigned(seriesInstanceUID: string): boolean {
    return this.getAssignmentBySeries(seriesInstanceUID) !== null;
  }

  public getActiveViewport(): string | null {
    return this.activeViewport;
  }

  public getState(): Record<string, ViewportAssignmentState | null> {
    const state: Record<string, ViewportAssignmentState | null> = {};

    // Include all possible viewports up to max
    for (let i = 0; i < this.config.maxViewports; i++) {
      const viewportId = String.fromCharCode(65 + i); // A, B, C, D...
      state[viewportId] = this.assignments.get(viewportId) || null;
    }

    return state;
  }

  // ===== Active Viewport Management =====

  public setActiveViewport(viewportId: string): void {
    if (this.activeViewport === viewportId) {
      return;
    }

    const previousActive = this.activeViewport;
    this.activeViewport = viewportId;

    // Update assignment states
    if (previousActive) {
      const prevAssignment = this.assignments.get(previousActive);
      if (prevAssignment) {
        prevAssignment.isActive = false;
        prevAssignment.lastModified = new Date();
      }
    }

    const newAssignment = this.assignments.get(viewportId);
    if (newAssignment) {
      newAssignment.isActive = true;
      newAssignment.lastModified = new Date();
    }

    this.emit('activeViewportChanged', { previous: previousActive, current: viewportId });
    this.emit('stateChanged', this.getState());

    log.info('Active viewport changed', {
      component: 'ViewportAssignmentManager',
      metadata: { from: previousActive, to: viewportId },
    });
  }

  // ===== Series Loading =====

  private async loadSeriesForViewport(viewportId: string, seriesInstanceUID: string): Promise<void> {
    const assignment = this.assignments.get(viewportId);
    if (!assignment) {
      return;
    }

    this.loadingViewports.add(viewportId);
    assignment.isLoading = true;
    assignment.lastModified = new Date();

    this.emit('seriesLoadingStarted', { viewportId, seriesInstanceUID });

    try {
      // Load series using actual series management service
      const series = await seriesManagementService.loadSeries(seriesInstanceUID);
      if (!series) {
        throw new Error(`Failed to load series: ${seriesInstanceUID}`);
      }

      assignment.isLoading = false;
      assignment.lastModified = new Date();
      this.loadingViewports.delete(viewportId);

      this.emit('seriesLoadingCompleted', { viewportId, seriesInstanceUID });

      log.info('Series loaded for viewport', {
        component: 'ViewportAssignmentManager',
        metadata: { viewportId, seriesInstanceUID },
      });

    } catch (error) {
      assignment.isLoading = false;
      assignment.lastModified = new Date();
      this.loadingViewports.delete(viewportId);

      this.emit('seriesLoadingFailed', {
        viewportId,
        seriesInstanceUID,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      log.error('Failed to load series for viewport', {
        component: 'ViewportAssignmentManager',
        metadata: {
          viewportId,
          seriesInstanceUID,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  // ===== Synchronization =====

  private syncViewportState(viewportId: string, seriesInstanceUID: string): void {
    try {
      const series = this.getSeriesMetadata(seriesInstanceUID);
      if (!series) {
        return;
      }

      // Update viewport state with series assignment
      const viewportStateUpdate = {
        seriesAssignment: {
          seriesInstanceUID,
          studyInstanceUID: series.studyInstanceUID,
          modality: series.modality || 'CT',
          seriesNumber: series.seriesNumber || 0,
          numberOfImages: series.numberOfInstances || 0,
          description: series.seriesDescription,
        },
      };
      viewportStateManager.updateViewportState(viewportId, viewportStateUpdate);

      log.info('Viewport state synchronized', {
        component: 'ViewportAssignmentManager',
        metadata: { viewportId, seriesInstanceUID },
      });

    } catch (error) {
      log.error('Failed to sync viewport state', {
        component: 'ViewportAssignmentManager',
        metadata: {
          viewportId,
          seriesInstanceUID,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  private clearViewportState(viewportId: string): void {
    try {
      // Clear viewport series assignment
      viewportStateManager.updateViewportState(viewportId, {
        seriesAssignment: undefined,
      });
    } catch (error) {
      log.error('Failed to clear viewport state', {
        component: 'ViewportAssignmentManager',
        metadata: {
          viewportId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  // ===== Event Handlers =====

  private handleSeriesAssigned(assignment: SeriesAssignment): void {
    // Update local state if assignment was made externally
    if (!this.assignments.has(assignment.viewportId)) {
      const series = this.getSeriesMetadata(assignment.seriesInstanceUID);
      if (series) {
        const assignmentState: ViewportAssignmentState = {
          viewportId: assignment.viewportId,
          seriesInstanceUID: assignment.seriesInstanceUID,
          studyInstanceUID: assignment.studyInstanceUID,
          isActive: this.activeViewport === assignment.viewportId,
          isLoading: false,
          lastModified: new Date(),
          metadata: {
            modality: series.modality,
            seriesDescription: series.seriesDescription,
            numberOfImages: series.numberOfInstances,
          },
        };
        this.assignments.set(assignment.viewportId, assignmentState);
        this.emit('stateChanged', this.getState());
      }
    }
  }

  private handleSeriesUnassigned(data: { viewportId: string; seriesInstanceUID: string }): void {
    // Update local state if unassignment was made externally
    if (this.assignments.has(data.viewportId)) {
      this.assignments.delete(data.viewportId);
      this.emit('stateChanged', this.getState());
    }
  }

  private handleStudyUnloaded(study: { studyInstanceUID: string }): void {
    // Clear all assignments for series from the unloaded study
    const affectedViewports: string[] = [];

    for (const [viewportId, assignment] of this.assignments) {
      if (assignment.studyInstanceUID === study.studyInstanceUID) {
        affectedViewports.push(viewportId);
      }
    }

    affectedViewports.forEach(viewportId => {
      this.clearViewportAssignment(viewportId);
    });

    if (affectedViewports.length > 0) {
      log.info('Cleared assignments for unloaded study', {
        component: 'ViewportAssignmentManager',
        metadata: { studyInstanceUID: study.studyInstanceUID, affectedViewports },
      });
    }
  }

  private handleViewportActivated(data: { viewportId: string }): void {
    this.setActiveViewport(data.viewportId);
  }

  private handleViewportDeactivated(data: { viewportId: string }): void {
    if (this.activeViewport === data.viewportId) {
      this.activeViewport = null;
      const assignment = this.assignments.get(data.viewportId);
      if (assignment) {
        assignment.isActive = false;
        assignment.lastModified = new Date();
      }
      this.emit('stateChanged', this.getState());
    }
  }

  // ===== Helper Methods =====

  private getSeriesMetadata(seriesInstanceUID: string): (DICOMSeries & { studyInstanceUID: string }) | null {
    return seriesManagementService.getAllSeries().find(s => s.seriesInstanceUID === seriesInstanceUID) || null;
  }

  // ===== Cleanup =====

  public destroy(): void {
    this.clearAllAssignments();

    // Remove event listeners
    seriesManagementService.off('seriesAssigned', this.handleSeriesAssigned.bind(this));
    seriesManagementService.off('seriesUnassigned', this.handleSeriesUnassigned.bind(this));
    seriesManagementService.off('studyUnloaded', this.handleStudyUnloaded.bind(this));

    if (this.config.synchronizeWithViewportState) {
      viewportStateManager.off('viewportActivated', this.handleViewportActivated.bind(this));
      viewportStateManager.off('viewportDeactivated', this.handleViewportDeactivated.bind(this));
    }

    this.removeAllListeners();

    log.info('Viewport Assignment Manager destroyed', {
      component: 'ViewportAssignmentManager',
    });
  }
}

// Singleton instance
export const viewportAssignmentManager = new ViewportAssignmentManager();
