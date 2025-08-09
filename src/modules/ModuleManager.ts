/**
 * ModuleManager - Central module coordination
 * Manages communication and coordination between different modules
 */

import { ViewerEngine } from './viewer-core';
import { DicomLoader } from './dicom-loader';
import { EventEmitter } from '../utils/EventEmitter';
import { log } from '../utils/logger';
import type { ViewerEngineConfig } from './viewer-core';
import type { DicomLoaderConfig } from './dicom-loader';

export interface ModuleManagerConfig {
  viewer: ViewerEngineConfig;
  dicomLoader?: DicomLoaderConfig;
}

export interface ModuleManagerEvents {
  'modules:initialized': void;
  'modules:error': { module: string; error: Error };
}

export class ModuleManager extends EventEmitter<ModuleManagerEvents> {
  private viewerEngine: ViewerEngine;
  private dicomLoader: DicomLoader;
  private initialized: boolean = false;

  constructor(config: ModuleManagerConfig) {
    super();
    
    // Initialize modules
    this.viewerEngine = new ViewerEngine(config.viewer);
    this.dicomLoader = new DicomLoader(config.dicomLoader);
    
    this.setupModuleConnections();
  }

  /**
   * Setup inter-module connections and event forwarding
   */
  private setupModuleConnections(): void {
    // Forward viewer engine events
    this.viewerEngine.on('engine:initialized', () => {
      log.info('Viewer engine initialized', { component: 'ModuleManager' });
    });

    // Forward DICOM loader events
    this.dicomLoader.on('study:loaded', ({ study }) => {
      log.info('Study loaded', {
        component: 'ModuleManager',
        metadata: {
          studyUID: study.studyInstanceUID,
          seriesCount: study.series.size,
        },
      });
    });

    this.dicomLoader.on('load:error', ({ error, file }) => {
      this.emit('modules:error', {
        module: 'dicom-loader',
        error,
      });
    });
  }

  /**
   * Initialize all modules
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      log.warn('ModuleManager already initialized', { component: 'ModuleManager' });
      return;
    }

    try {
      // Initialize viewer engine
      await this.viewerEngine.initialize();

      this.initialized = true;
      this.emit('modules:initialized');

      log.info('All modules initialized', { component: 'ModuleManager' });
    } catch (error) {
      log.error(
        'Failed to initialize modules',
        { component: 'ModuleManager' },
        error as Error,
      );
      this.emit('modules:error', {
        module: 'initialization',
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * Load and display DICOM files
   */
  async loadAndDisplayDicom(files: File[], viewportId: string): Promise<void> {
    try {
      // Load DICOM files
      const studies = await this.dicomLoader.loadFiles(files);
      
      if (studies.length === 0) {
        throw new Error('No valid DICOM studies found');
      }

      // Get the first series from the first study
      const firstStudy = studies[0];
      const firstSeries = Array.from(firstStudy.series.values())[0];

      if (!firstSeries || firstSeries.imageIds.length === 0) {
        throw new Error('No valid image series found');
      }

      // Display in viewport
      const viewport = this.viewerEngine.getViewport(viewportId);
      if (viewport && 'setStack' in viewport) {
        await viewport.setStack(firstSeries.imageIds, 0);
        await viewport.render();
      }

      log.info('DICOM displayed in viewport', {
        component: 'ModuleManager',
        metadata: {
          viewportId,
          studyUID: firstStudy.studyInstanceUID,
          seriesUID: firstSeries.seriesInstanceUID,
          imageCount: firstSeries.imageIds.length,
        },
      });
    } catch (error) {
      log.error(
        'Failed to load and display DICOM',
        { component: 'ModuleManager' },
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Get viewer engine instance
   */
  getViewerEngine(): ViewerEngine {
    return this.viewerEngine;
  }

  /**
   * Get DICOM loader instance
   */
  getDicomLoader(): DicomLoader {
    return this.dicomLoader;
  }

  /**
   * Destroy all modules
   */
  async destroy(): Promise<void> {
    try {
      await this.viewerEngine.destroy();
      this.dicomLoader.clear();
      this.initialized = false;

      log.info('ModuleManager destroyed', { component: 'ModuleManager' });
    } catch (error) {
      log.error(
        'Failed to destroy ModuleManager',
        { component: 'ModuleManager' },
        error as Error,
      );
    }
  }
}