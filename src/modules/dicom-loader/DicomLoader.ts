/**
 * DicomLoader - DICOM file loading module
 * Handles DICOM file loading, parsing, and organization
 */

import * as dicomImageLoader from '@cornerstonejs/dicom-image-loader';
import { EventEmitter } from '../../utils/EventEmitter';
import { log } from '../../utils/logger';
import type {
  DicomLoaderConfig,
  DicomLoaderEvents,
  DicomFile,
  DicomSeries,
  DicomStudy,
  DicomMetadata,
} from './types';

export class DicomLoader extends EventEmitter<DicomLoaderEvents> {
  private config: DicomLoaderConfig;
  private studies: Map<string, DicomStudy>;
  private loadingQueue: File[];
  private isLoading: boolean;

  constructor(config: DicomLoaderConfig = {}) {
    super();
    this.config = {
      maxConcurrentLoads: 4,
      enableCaching: true,
      ...config,
    };
    this.studies = new Map();
    this.loadingQueue = [];
    this.isLoading = false;
  }

  /**
   * Load DICOM files
   */
  async loadFiles(files: File[]): Promise<DicomStudy[]> {
    log.info('Starting DICOM file load', {
      component: 'DicomLoader',
      metadata: { fileCount: files.length },
    });

    this.loadingQueue = [...files];
    this.isLoading = true;

    try {
      const loadedFiles: DicomFile[] = [];
      const totalFiles = files.length;

      // Process files in batches
      for (let i = 0; i < files.length; i += this.config.maxConcurrentLoads!) {
        const batch = files.slice(i, i + this.config.maxConcurrentLoads!);
        const batchResults = await Promise.all(
          batch.map(file => this.loadSingleFile(file)),
        );

        loadedFiles.push(...batchResults.filter(Boolean) as DicomFile[]);

        const progress = Math.round((loadedFiles.length / totalFiles) * 100);
        this.emit('load:progress', { loaded: loadedFiles.length, total: totalFiles });
      }

      // Organize files into studies and series
      this.organizeFiles(loadedFiles);

      const studies = Array.from(this.studies.values());
      log.info('DICOM files loaded successfully', {
        component: 'DicomLoader',
        metadata: {
          filesLoaded: loadedFiles.length,
          studiesFound: studies.length,
          seriesFound: studies.reduce((sum, study) => sum + study.series.size, 0),
        },
      });

      return studies;
    } finally {
      this.isLoading = false;
      this.loadingQueue = [];
    }
  }

  /**
   * Load a single DICOM file
   */
  private async loadSingleFile(file: File): Promise<DicomFile | null> {
    try {
      // Add file to cornerstone file manager
      const imageId = dicomImageLoader.wadouri.fileManager.add(file);
      
      // Parse DICOM metadata
      const metadata = await this.parseDicomMetadata(imageId);

      const dicomFile: DicomFile = {
        file,
        imageId,
        metadata,
        instanceNumber: metadata?.instanceNumber,
      };

      this.emit('file:loaded', {
        file: dicomFile,
        progress: 0, // Will be updated by the batch processor
      });

      return dicomFile;
    } catch (error) {
      log.error(
        'Failed to load DICOM file',
        { component: 'DicomLoader', metadata: { fileName: file.name } },
        error as Error,
      );
      this.emit('load:error', { error: error as Error, file });
      return null;
    }
  }

  /**
   * Parse DICOM metadata from image ID
   */
  private async parseDicomMetadata(imageId: string): Promise<DicomMetadata | undefined> {
    try {
      // This is a simplified version - in reality you'd parse the DICOM tags
      const image = await dicomImageLoader.loadImage(imageId).promise;
      const metadata = image.data;

      return {
        studyInstanceUID: metadata?.string('x0020000D') || 'unknown-study',
        seriesInstanceUID: metadata?.string('x0020000E') || 'unknown-series',
        sopInstanceUID: metadata?.string('x00080018') || 'unknown-sop',
        studyDescription: metadata?.string('x00081030'),
        seriesDescription: metadata?.string('x0008103E'),
        modality: metadata?.string('x00080060'),
        patientName: metadata?.string('x00100010'),
        patientId: metadata?.string('x00100020'),
        studyDate: metadata?.string('x00080020'),
        rows: metadata?.uint16('x00280010'),
        cols: metadata?.uint16('x00280011'),
        windowCenter: metadata?.floatString('x00281050'),
        windowWidth: metadata?.floatString('x00281051'),
        instanceNumber: metadata?.intString('x00200013'),
      };
    } catch (error) {
      log.warn('Failed to parse DICOM metadata', {
        component: 'DicomLoader',
        metadata: { imageId },
      });
      return undefined;
    }
  }

  /**
   * Organize files into studies and series
   */
  private organizeFiles(files: DicomFile[]): void {
    this.studies.clear();

    for (const file of files) {
      if (!file.metadata) continue;

      const { studyInstanceUID, seriesInstanceUID } = file.metadata;

      // Get or create study
      let study = this.studies.get(studyInstanceUID);
      if (!study) {
        study = {
          studyInstanceUID,
          studyDescription: file.metadata.studyDescription,
          studyDate: file.metadata.studyDate,
          patientName: file.metadata.patientName,
          patientId: file.metadata.patientId,
          series: new Map(),
        };
        this.studies.set(studyInstanceUID, study);
      }

      // Get or create series
      let series = study.series.get(seriesInstanceUID);
      if (!series) {
        series = {
          seriesInstanceUID,
          studyInstanceUID,
          seriesDescription: file.metadata.seriesDescription,
          modality: file.metadata.modality,
          imageIds: [],
          files: [],
        };
        study.series.set(seriesInstanceUID, series);
      }

      // Add file to series
      series.files.push(file);
      series.imageIds.push(file.imageId);
    }

    // Sort files within each series by instance number
    for (const study of this.studies.values()) {
      for (const series of study.series.values()) {
        series.files.sort((a, b) => {
          const aNum = a.instanceNumber || 0;
          const bNum = b.instanceNumber || 0;
          return aNum - bNum;
        });
        series.imageIds = series.files.map(f => f.imageId);
        
        this.emit('series:loaded', { series });
      }
      this.emit('study:loaded', { study });
    }
  }

  /**
   * Get all loaded studies
   */
  getStudies(): DicomStudy[] {
    return Array.from(this.studies.values());
  }

  /**
   * Get study by UID
   */
  getStudy(studyInstanceUID: string): DicomStudy | undefined {
    return this.studies.get(studyInstanceUID);
  }

  /**
   * Get series by UIDs
   */
  getSeries(studyInstanceUID: string, seriesInstanceUID: string): DicomSeries | undefined {
    const study = this.studies.get(studyInstanceUID);
    return study?.series.get(seriesInstanceUID);
  }

  /**
   * Clear all loaded data
   */
  clear(): void {
    this.studies.clear();
    dicomImageLoader.wadouri.fileManager.purge();
    log.info('DicomLoader cleared', { component: 'DicomLoader' });
  }

  /**
   * Get loading state
   */
  isCurrentlyLoading(): boolean {
    return this.isLoading;
  }
}