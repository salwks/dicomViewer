/**
 * Comparison Viewport Manager Service
 * Enhanced viewport management specifically designed for multi-study comparison workflows
 * Extends the base ViewportManager with comparison-specific features
 * Built with shadcn/ui components and security compliance
 */

import { EventEmitter } from 'events';
import { ViewportManager, ViewportManagerConfig, ViewportLayout } from './ViewportManager';
import { ViewportState, ViewportStateUpdate } from '../types/viewportState';
import { LazyViewportLoader } from './LazyViewportLoader';
import { log } from '../utils/logger';

export interface ComparisonViewportConfig extends ViewportManagerConfig {
  enableCrossReferenceLines: boolean;
  enableAutoAlignment: boolean;
  maxStudiesPerComparison: number;
  enablePatientSafetyChecks: boolean;
  defaultComparisonLayout: '1x2' | '2x2';
}

export const DEFAULT_COMPARISON_CONFIG: ComparisonViewportConfig = {
  maxViewports: 16,
  enableSynchronization: true,
  enablePersistence: true,
  autoCleanup: true,
  defaultViewportType: 'stack',
  enableCrossReferenceLines: true,
  enableAutoAlignment: false,
  maxStudiesPerComparison: 4,
  enablePatientSafetyChecks: true,
  defaultComparisonLayout: '1x2',
};

export interface StudyInfo {
  studyInstanceUID: string;
  patientId: string;
  patientName: string;
  studyDate: string;
  modality: string;
  institution?: string;
  description?: string;
  seriesCount: number;
}

export interface ComparisonSession {
  id: string;
  name: string;
  studies: StudyInfo[];
  layout: ComparisonLayout;
  viewportAssignments: Map<string, StudyInfo>;
  createdAt: Date;
  modifiedAt: Date;
}

export interface StudyLoadingTask {
  id: string;
  viewportId: string;
  studyInfo: StudyInfo;
  priority: 'low' | 'normal' | 'high';
  status: 'pending' | 'loading' | 'completed' | 'failed';
  progress: number;
  startTime?: number;
  endTime?: number;
  error?: Error;
}

export interface StudyValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: Partial<StudyInfo>;
}

export interface ComparisonLayout {
  id: string;
  name: string;
  type: '1x1' | '1x2' | '2x2' | '2x3' | '3x3';
  viewportIds: string[];
  synchronizationGroups?: string[][];
  crossReferenceEnabled: boolean;
}

export interface ComparisonViewportManagerEvents {
  'comparison-session-created': [ComparisonSession];
  'comparison-session-updated': [ComparisonSession];
  'comparison-session-removed': [string];
  'study-assigned': [string, StudyInfo];
  'study-unassigned': [string];
  'layout-switched': [ComparisonLayout, ComparisonLayout];
  'patient-safety-warning': [string, StudyInfo[]];
  'cross-reference-updated': [string, any[]];
}

/**
 * Core Comparison Viewport Manager Class
 * Manages viewport lifecycle, study assignments, and comparison sessions
 */
export class ComparisonViewportManager extends EventEmitter {
  private config: ComparisonViewportConfig;
  private baseManager: ViewportManager;
  private lazyLoader: LazyViewportLoader;
  private comparisonSessions: Map<string, ComparisonSession> = new Map();
  private activeSession: string | null = null;
  private availableLayouts: Map<string, ComparisonLayout> = new Map();
  private studyRegistry: Map<string, StudyInfo> = new Map();
  private viewportStudyAssignments: Map<string, string> = new Map(); // viewportId -> studyInstanceUID
  private studyLoadingQueue: StudyLoadingTask[] = [];
  private maxConcurrentLoads: number = 2;
  private currentlyLoading: Set<string> = new Set(); // studyInstanceUIDs currently loading

  constructor(config: Partial<ComparisonViewportConfig> = {}) {
    super();
    this.config = { ...DEFAULT_COMPARISON_CONFIG, ...config };
    this.baseManager = new ViewportManager(this.config);
    this.lazyLoader = new LazyViewportLoader({
      maxActiveViewports: this.config.maxViewports,
      preloadAdjacent: true,
      enablePredictiveLoading: true,
    });
    
    this.initialize();
  }

  private initialize(): void {
    log.info('ComparisonViewportManager initializing', {
      component: 'ComparisonViewportManager',
      metadata: { config: this.config },
    });

    // Initialize default comparison layouts
    this.initializeComparisonLayouts();

    // Setup event forwarding from base manager
    this.setupEventForwarding();

    log.info('ComparisonViewportManager initialized successfully', {
      component: 'ComparisonViewportManager',
    });
  }

  // ===== Core Viewport Management =====

  /**
   * Create a viewport with comparison-specific configuration
   */
  public createViewport(
    viewportId: string,
    studyInfo?: StudyInfo,
    initialState?: ViewportStateUpdate,
  ): ViewportState {
    // Input validation
    if (!viewportId || typeof viewportId !== 'string') {
      throw new Error('Invalid viewport ID provided');
    }

    // Check if viewport already exists
    if (this.hasViewport(viewportId)) {
      throw new Error(`Viewport ${viewportId} already exists`);
    }

    try {
      // Register viewport with lazy loader
      this.lazyLoader.registerViewport(viewportId, {
        studyInfo,
        comparisonMode: true,
      });

      // Create viewport using base manager
      const state = this.baseManager.createViewport(
        viewportId,
        this.config.defaultViewportType,
        initialState,
      );

      // Assign study if provided
      if (studyInfo) {
        this.assignStudyToViewport(viewportId, studyInfo);
      }

      log.info('Comparison viewport created', {
        component: 'ComparisonViewportManager',
        metadata: { 
          viewportId, 
          hasStudy: !!studyInfo,
          studyInstanceUID: studyInfo?.studyInstanceUID,
        },
      });

      return state;
    } catch (error) {
      log.error('Failed to create comparison viewport', {
        component: 'ComparisonViewportManager',
        metadata: { viewportId },
      }, error as Error);
      throw error;
    }
  }

  /**
   * Remove viewport and clean up study assignments
   */
  public destroyViewport(viewportId: string): boolean {
    try {
      // Remove study assignment
      this.unassignStudyFromViewport(viewportId);

      // Unregister from lazy loader
      this.lazyLoader.unregisterViewport(viewportId);

      // Remove viewport using base manager
      const removed = this.baseManager.removeViewport(viewportId);

      if (removed) {
        log.info('Comparison viewport destroyed', {
          component: 'ComparisonViewportManager',
          metadata: { viewportId },
        });
      }

      return removed;
    } catch (error) {
      log.error('Failed to destroy comparison viewport', {
        component: 'ComparisonViewportManager',
        metadata: { viewportId },
      }, error as Error);
      return false;
    }
  }

  /**
   * Get viewport state with comparison metadata
   */
  public getViewport(viewportId: string): ViewportState | null {
    const state = this.baseManager.getViewport(viewportId);
    if (!state) return null;

    // Add comparison-specific metadata
    const studyUID = this.viewportStudyAssignments.get(viewportId);
    const studyInfo = studyUID ? this.studyRegistry.get(studyUID) : null;

    return {
      ...state,
      comparisonMetadata: {
        assignedStudy: studyInfo || null,
        isComparison: !!studyInfo,
      },
    };
  }

  // ===== Study Management =====

  /**
   * Register a study in the comparison system
   */
  public registerStudy(studyInfo: StudyInfo): void {
    // Validate study info
    if (!studyInfo.studyInstanceUID || !studyInfo.patientId) {
      throw new Error('Study must have studyInstanceUID and patientId');
    }

    // Patient safety check
    if (this.config.enablePatientSafetyChecks) {
      this.performPatientSafetyCheck(studyInfo);
    }

    this.studyRegistry.set(studyInfo.studyInstanceUID, studyInfo);

    log.info('Study registered for comparison', {
      component: 'ComparisonViewportManager',
      metadata: { 
        studyInstanceUID: studyInfo.studyInstanceUID,
        patientId: studyInfo.patientId,
        modality: studyInfo.modality,
      },
    });
  }

  /**
   * Load study metadata and validate it
   */
  public async loadStudyMetadata(studyInstanceUID: string): Promise<StudyInfo | null> {
    try {
      // This would integrate with DICOM loader in real implementation
      // For now, return placeholder data
      log.info('Loading study metadata', {
        component: 'ComparisonViewportManager',
        metadata: { studyInstanceUID },
      });

      // Placeholder for actual DICOM metadata loading
      // In real implementation, this would call DICOM services
      return null;
    } catch (error) {
      log.error('Failed to load study metadata', {
        component: 'ComparisonViewportManager',
        metadata: { studyInstanceUID },
      }, error as Error);
      return null;
    }
  }

  /**
   * Assign a study to a specific viewport with validation and loading queue
   */
  public async assignStudyToViewport(
    viewportId: string, 
    studyInfo: StudyInfo,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): Promise<boolean> {
    if (!this.hasViewport(viewportId)) {
      throw new Error(`Viewport ${viewportId} does not exist`);
    }

    try {
      // Validate study info
      const validationResult = await this.validateStudyInfo(studyInfo);
      if (!validationResult.isValid) {
        log.error('Study validation failed', {
          component: 'ComparisonViewportManager',
          metadata: { 
            viewportId,
            studyInstanceUID: studyInfo.studyInstanceUID,
            errors: validationResult.errors,
          },
        });
        return false;
      }

      // Log warnings if any
      if (validationResult.warnings.length > 0) {
        log.warn('Study validation warnings', {
          component: 'ComparisonViewportManager',
          metadata: { 
            viewportId,
            studyInstanceUID: studyInfo.studyInstanceUID,
            warnings: validationResult.warnings,
          },
        });
      }

      // Register study if not already registered
      if (!this.studyRegistry.has(studyInfo.studyInstanceUID)) {
        this.registerStudy(studyInfo);
      }

      // Check if study is already assigned to this viewport
      const currentAssignment = this.viewportStudyAssignments.get(viewportId);
      if (currentAssignment === studyInfo.studyInstanceUID) {
        log.info('Study already assigned to viewport', {
          component: 'ComparisonViewportManager',
          metadata: { viewportId, studyInstanceUID: studyInfo.studyInstanceUID },
        });
        return true;
      }

      // Remove previous assignment if exists
      if (currentAssignment) {
        this.unassignStudyFromViewport(viewportId);
      }

      // Create loading task
      const loadingTask: StudyLoadingTask = {
        id: `${viewportId}-${studyInfo.studyInstanceUID}-${Date.now()}`,
        viewportId,
        studyInfo,
        priority,
        status: 'pending',
        progress: 0,
      };

      // Add to queue
      this.addToLoadingQueue(loadingTask);

      // Update assignment
      this.viewportStudyAssignments.set(viewportId, studyInfo.studyInstanceUID);

      this.emit('study-assigned', viewportId, studyInfo);

      log.info('Study queued for assignment to viewport', {
        component: 'ComparisonViewportManager',
        metadata: { 
          viewportId,
          studyInstanceUID: studyInfo.studyInstanceUID,
          patientId: studyInfo.patientId,
          priority,
          taskId: loadingTask.id,
        },
      });

      // Process queue
      this.processLoadingQueue();

      return true;
    } catch (error) {
      log.error('Failed to assign study to viewport', {
        component: 'ComparisonViewportManager',
        metadata: { viewportId, studyInstanceUID: studyInfo.studyInstanceUID },
      }, error as Error);
      return false;
    }
  }

  /**
   * Remove study assignment from viewport
   */
  public unassignStudyFromViewport(viewportId: string): void {
    const studyUID = this.viewportStudyAssignments.get(viewportId);
    
    if (studyUID) {
      this.viewportStudyAssignments.delete(viewportId);
      this.emit('study-unassigned', viewportId);

      log.info('Study unassigned from viewport', {
        component: 'ComparisonViewportManager',
        metadata: { viewportId, studyInstanceUID: studyUID },
      });
    }
  }

  // ===== Comparison Layout Management =====

  private currentLayout: ComparisonLayout | null = null;

  private initializeComparisonLayouts(): void {
    // 1x2 Side-by-side comparison
    this.availableLayouts.set('1x2', {
      id: '1x2',
      name: 'Side-by-Side (1×2)',
      type: '1x2',
      viewportIds: ['comparison-left', 'comparison-right'],
      crossReferenceEnabled: true,
    });

    // 2x2 Quad comparison
    this.availableLayouts.set('2x2', {
      id: '2x2',
      name: 'Quad View (2×2)',
      type: '2x2',
      viewportIds: ['comparison-tl', 'comparison-tr', 'comparison-bl', 'comparison-br'],
      synchronizationGroups: [
        ['comparison-tl', 'comparison-tr'],
        ['comparison-bl', 'comparison-br'],
      ],
      crossReferenceEnabled: true,
    });

    // Single viewport for reference
    this.availableLayouts.set('1x1', {
      id: '1x1',
      name: 'Single View (1×1)',
      type: '1x1',
      viewportIds: ['comparison-single'],
      crossReferenceEnabled: false,
    });

    // Set default layout
    this.currentLayout = this.availableLayouts.get(this.config.defaultComparisonLayout) || null;

    log.info('Comparison layouts initialized', {
      component: 'ComparisonViewportManager',
      metadata: { 
        layoutCount: this.availableLayouts.size,
        defaultLayout: this.config.defaultComparisonLayout,
      },
    });
  }

  /**
   * Set the active comparison layout
   * Creates/removes viewports as needed and handles viewport positioning
   */
  public setLayout(layoutId: string): ComparisonLayout {
    const newLayout = this.availableLayouts.get(layoutId);
    if (!newLayout) {
      throw new Error(`Layout not found: ${layoutId}`);
    }

    const previousLayout = this.currentLayout;

    try {
      // Store current viewport assignments before layout change
      const currentAssignments = this.preserveViewportAssignments();

      // Remove viewports from previous layout if needed
      if (previousLayout) {
        this.cleanupPreviousLayout(previousLayout);
      }

      // Create viewports for new layout
      this.createLayoutViewports(newLayout);

      // Restore viewport assignments where possible
      this.restoreViewportAssignments(newLayout, currentAssignments);

      // Update current layout
      this.currentLayout = newLayout;

      // Emit layout change event
      if (previousLayout) {
        this.emit('layout-switched', previousLayout, newLayout);
      }

      log.info('Comparison layout changed', {
        component: 'ComparisonViewportManager',
        metadata: { 
          previousLayoutId: previousLayout?.id || 'none',
          newLayoutId: layoutId,
          viewportCount: newLayout.viewportIds.length,
        },
      });

      return newLayout;
    } catch (error) {
      log.error('Failed to set comparison layout', {
        component: 'ComparisonViewportManager',
        metadata: { layoutId },
      }, error as Error);
      throw error;
    }
  }

  /**
   * Get current active layout
   */
  public getCurrentLayout(): ComparisonLayout | null {
    return this.currentLayout;
  }

  /**
   * Get all available layouts
   */
  public getAvailableLayouts(): ComparisonLayout[] {
    return Array.from(this.availableLayouts.values());
  }

  /**
   * Get specific layout by ID
   */
  public getLayout(layoutId: string): ComparisonLayout | null {
    return this.availableLayouts.get(layoutId) || null;
  }

  /**
   * Calculate viewport positions and dimensions for a layout
   */
  public calculateViewportPositions(
    layout: ComparisonLayout, 
    containerWidth: number, 
    containerHeight: number
  ): Map<string, { x: number; y: number; width: number; height: number }> {
    const positions = new Map();
    const { viewportIds, type } = layout;

    // Calculate grid dimensions
    let rows = 1, cols = 1;
    switch (type) {
      case '1x1':
        rows = 1; cols = 1; break;
      case '1x2':
        rows = 1; cols = 2; break;
      case '2x2':
        rows = 2; cols = 2; break;
      case '2x3':
        rows = 2; cols = 3; break;
      case '3x3':
        rows = 3; cols = 3; break;
    }

    // Calculate viewport dimensions
    const viewportWidth = Math.floor(containerWidth / cols);
    const viewportHeight = Math.floor(containerHeight / rows);

    // Calculate positions for each viewport
    viewportIds.forEach((viewportId, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;

      positions.set(viewportId, {
        x: col * viewportWidth,
        y: row * viewportHeight,
        width: viewportWidth,
        height: viewportHeight,
      });
    });

    return positions;
  }

  /**
   * Resize viewports when container dimensions change
   */
  public handleContainerResize(width: number, height: number): void {
    if (!this.currentLayout) return;

    const positions = this.calculateViewportPositions(this.currentLayout, width, height);

    positions.forEach((position, viewportId) => {
      if (this.hasViewport(viewportId)) {
        // Update viewport dimensions in the rendering engine
        this.updateViewportDimensions(viewportId, position);
      }
    });

    log.info('Viewports resized for layout', {
      component: 'ComparisonViewportManager',
      metadata: { 
        layoutId: this.currentLayout.id,
        containerSize: { width, height },
        viewportCount: positions.size,
      },
    });
  }

  // ===== Private Layout Management Helpers =====

  private preserveViewportAssignments(): Map<string, StudyInfo> {
    const assignments = new Map<string, StudyInfo>();
    
    this.viewportStudyAssignments.forEach((studyUID, viewportId) => {
      const studyInfo = this.studyRegistry.get(studyUID);
      if (studyInfo) {
        assignments.set(viewportId, studyInfo);
      }
    });

    return assignments;
  }

  private cleanupPreviousLayout(layout: ComparisonLayout): void {
    // Remove viewports that won't be used in new layout
    layout.viewportIds.forEach(viewportId => {
      if (this.hasViewport(viewportId)) {
        // Don't destroy viewport if it will be reused
        const willBeReused = this.currentLayout?.viewportIds.includes(viewportId);
        if (!willBeReused) {
          this.destroyViewport(viewportId);
        }
      }
    });
  }

  private createLayoutViewports(layout: ComparisonLayout): void {
    layout.viewportIds.forEach(viewportId => {
      if (!this.hasViewport(viewportId)) {
        this.createViewport(viewportId);
      }
    });
  }

  private restoreViewportAssignments(
    layout: ComparisonLayout, 
    assignments: Map<string, StudyInfo>
  ): void {
    // Try to restore assignments to the same viewport IDs
    layout.viewportIds.forEach(viewportId => {
      const study = assignments.get(viewportId);
      if (study) {
        this.assignStudyToViewport(viewportId, study);
      }
    });

    // If some studies couldn't be restored, assign them to available viewports
    const unassignedStudies = Array.from(assignments.entries()).filter(
      ([viewportId]) => !layout.viewportIds.includes(viewportId)
    );

    let availableViewportIndex = 0;
    unassignedStudies.forEach(([_, study]) => {
      while (availableViewportIndex < layout.viewportIds.length) {
        const targetViewportId = layout.viewportIds[availableViewportIndex];
        if (!this.viewportStudyAssignments.has(targetViewportId)) {
          this.assignStudyToViewport(targetViewportId, study);
          break;
        }
        availableViewportIndex++;
      }
    });
  }

  private updateViewportDimensions(
    viewportId: string, 
    dimensions: { x: number; y: number; width: number; height: number }
  ): void {
    // Update viewport state with new dimensions
    try {
      const updates: ViewportStateUpdate = {
        rendering: {
          dimensions: {
            width: dimensions.width,
            height: dimensions.height,
          },
          position: {
            x: dimensions.x,
            y: dimensions.y,
          },
        },
      };

      this.baseManager.updateViewport(viewportId, updates);
    } catch (error) {
      log.warn('Failed to update viewport dimensions', {
        component: 'ComparisonViewportManager',
        metadata: { viewportId, dimensions },
      }, error as Error);
    }
  }

  // ===== Patient Safety =====

  private performPatientSafetyCheck(newStudy: StudyInfo): void {
    const currentStudies = Array.from(this.studyRegistry.values());
    const differentPatients = currentStudies.filter(
      study => study.patientId !== newStudy.patientId
    );

    if (differentPatients.length > 0) {
      const allStudies = [...differentPatients, newStudy];
      this.emit('patient-safety-warning', 'Multiple patients detected in comparison', allStudies);
      
      log.warn('Patient safety warning: Multiple patients in comparison', {
        component: 'ComparisonViewportManager',
        metadata: { 
          patientIds: allStudies.map(s => s.patientId),
          studyCount: allStudies.length,
        },
      });
    }
  }

  // ===== Study Loading Queue Management =====

  /**
   * Add task to loading queue with priority sorting
   */
  private addToLoadingQueue(task: StudyLoadingTask): void {
    // Remove any existing task for the same viewport
    this.studyLoadingQueue = this.studyLoadingQueue.filter(
      t => t.viewportId !== task.viewportId
    );

    // Add new task
    this.studyLoadingQueue.push(task);

    // Sort by priority (high -> normal -> low)
    this.studyLoadingQueue.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    log.info('Task added to loading queue', {
      component: 'ComparisonViewportManager',
      metadata: { 
        taskId: task.id,
        queueLength: this.studyLoadingQueue.length,
        priority: task.priority,
      },
    });
  }

  /**
   * Process loading queue
   */
  private async processLoadingQueue(): Promise<void> {
    // Check if we can start more loads
    if (this.currentlyLoading.size >= this.maxConcurrentLoads) {
      return;
    }

    // Find next pending task
    const nextTask = this.studyLoadingQueue.find(
      task => task.status === 'pending' && !this.currentlyLoading.has(task.studyInfo.studyInstanceUID)
    );

    if (!nextTask) {
      return;
    }

    // Start loading
    this.currentlyLoading.add(nextTask.studyInfo.studyInstanceUID);
    nextTask.status = 'loading';
    nextTask.startTime = Date.now();

    try {
      await this.loadStudyForViewport(nextTask);
      
      nextTask.status = 'completed';
      nextTask.progress = 100;
      nextTask.endTime = Date.now();

      log.info('Study loading completed', {
        component: 'ComparisonViewportManager',
        metadata: { 
          taskId: nextTask.id,
          loadTime: nextTask.endTime - (nextTask.startTime || 0),
        },
      });
    } catch (error) {
      nextTask.status = 'failed';
      nextTask.error = error as Error;
      nextTask.endTime = Date.now();

      log.error('Study loading failed', {
        component: 'ComparisonViewportManager',
        metadata: { taskId: nextTask.id },
      }, error as Error);
    } finally {
      this.currentlyLoading.delete(nextTask.studyInfo.studyInstanceUID);
      
      // Remove completed/failed tasks from queue
      this.studyLoadingQueue = this.studyLoadingQueue.filter(
        task => task.status === 'pending' || task.status === 'loading'
      );

      // Process next task if available
      if (this.studyLoadingQueue.length > 0) {
        setTimeout(() => this.processLoadingQueue(), 100);
      }
    }
  }

  /**
   * Load study data for viewport
   */
  private async loadStudyForViewport(task: StudyLoadingTask): Promise<void> {
    // Activate viewport using lazy loader
    const activated = await this.lazyLoader.activateViewport(
      task.viewportId,
      undefined, // DOM element would be provided here
      task.priority === 'high' // immediate flag for high priority
    );

    if (!activated) {
      throw new Error(`Failed to activate viewport ${task.viewportId}`);
    }

    // Placeholder for actual study loading logic
    // In real implementation, this would:
    // 1. Load DICOM images
    // 2. Create series data
    // 3. Initialize viewport with study data
    // 4. Set up rendering engine

    log.info('Loading study for viewport', {
      component: 'ComparisonViewportManager',
      metadata: { 
        taskId: task.id,
        viewportId: task.viewportId,
        studyInstanceUID: task.studyInfo.studyInstanceUID,
        lazyLoaded: true,
      },
    });

    // Simulate loading time
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update progress during loading (this would be driven by actual loading progress)
    for (let progress = 20; progress <= 100; progress += 20) {
      task.progress = progress;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  /**
   * Validate study information
   */
  private async validateStudyInfo(studyInfo: StudyInfo): Promise<StudyValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required field validation
    if (!studyInfo.studyInstanceUID) {
      errors.push('Study Instance UID is required');
    }

    if (!studyInfo.patientId) {
      errors.push('Patient ID is required');
    }

    if (!studyInfo.patientName) {
      errors.push('Patient Name is required');
    }

    if (!studyInfo.studyDate) {
      warnings.push('Study Date is missing');
    }

    if (!studyInfo.modality) {
      warnings.push('Modality is missing');
    }

    if (studyInfo.seriesCount <= 0) {
      warnings.push('No series found in study');
    }

    // Additional validation could include:
    // - DICOM format validation
    // - Study accessibility checks
    // - Patient data consistency checks

    const isValid = errors.length === 0;

    return {
      isValid,
      errors,
      warnings,
      metadata: studyInfo,
    };
  }

  /**
   * Get loading queue status
   */
  public getLoadingQueueStatus(): {
    queueLength: number;
    currentlyLoading: number;
    completedToday: number;
  } {
    return {
      queueLength: this.studyLoadingQueue.length,
      currentlyLoading: this.currentlyLoading.size,
      completedToday: 0, // Would track this in real implementation
    };
  }

  // ===== Utility Methods =====

  public hasViewport(viewportId: string): boolean {
    return this.baseManager.hasViewport(viewportId);
  }

  public getViewportIds(): string[] {
    return this.baseManager.getViewportIds();
  }

  public getAllViewports(): Map<string, ViewportState> {
    return this.baseManager.getAllViewports();
  }

  public getAssignedStudy(viewportId: string): StudyInfo | null {
    const studyUID = this.viewportStudyAssignments.get(viewportId);
    return studyUID ? this.studyRegistry.get(studyUID) || null : null;
  }

  public getStudyAssignments(): Map<string, StudyInfo> {
    const assignments = new Map<string, StudyInfo>();
    
    this.viewportStudyAssignments.forEach((studyUID, viewportId) => {
      const studyInfo = this.studyRegistry.get(studyUID);
      if (studyInfo) {
        assignments.set(viewportId, studyInfo);
      }
    });

    return assignments;
  }

  /**
   * Get lazy loading status for all viewports
   */
  public getLazyLoadingStatus(): {
    activeViewports: string[];
    loadingQueue: string[];
    memoryUsage: {
      total: number;
      used: number;
      viewports: Map<string, number>;
    };
  } {
    return {
      activeViewports: this.lazyLoader.getActiveViewports(),
      loadingQueue: this.lazyLoader.getLoadingQueue(),
      memoryUsage: this.lazyLoader.getMemoryUsage(),
    };
  }

  /**
   * Manually activate viewport (force lazy load)
   */
  public async activateViewport(viewportId: string): Promise<boolean> {
    return await this.lazyLoader.activateViewport(viewportId);
  }

  /**
   * Manually deactivate viewport (free resources)
   */
  public async deactivateViewport(viewportId: string): Promise<void> {
    await this.lazyLoader.deactivateViewport(viewportId);
  }

  /**
   * Set viewport priority for loading
   */
  public setViewportPriority(viewportId: string, priority: number): void {
    this.lazyLoader.setViewportPriority(viewportId, priority);
  }

  // ===== Event Forwarding =====

  private setupEventForwarding(): void {
    // Forward relevant events from base manager
    this.baseManager.on('viewport-created', (viewportId, state) => {
      // ComparisonViewportManager handles this internally
    });

    this.baseManager.on('viewport-removed', (viewportId) => {
      // Clean up comparison-specific data
      this.unassignStudyFromViewport(viewportId);
    });

    this.baseManager.on('viewport-updated', (viewportId, state) => {
      // Forward to comparison-specific handlers if needed
    });

    this.baseManager.on('manager-error', (error, operation) => {
      log.error('Base ViewportManager error', {
        component: 'ComparisonViewportManager',
        metadata: { operation },
      }, error);
    });
  }

  // ===== Cleanup =====

  public dispose(): void {
    // Clear comparison-specific data
    this.comparisonSessions.clear();
    this.availableLayouts.clear();
    this.studyRegistry.clear();
    this.viewportStudyAssignments.clear();
    
    this.activeSession = null;

    // Dispose lazy loader
    this.lazyLoader.dispose();

    // Dispose base manager
    this.baseManager.dispose();

    // Remove all listeners
    this.removeAllListeners();

    log.info('ComparisonViewportManager disposed', {
      component: 'ComparisonViewportManager',
    });
  }
}

// Singleton instance for comparison workflows
export const comparisonViewportManager = new ComparisonViewportManager();