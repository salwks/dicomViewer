/**
 * Sample DICOM Data Service
 * Downloads and manages sample DICOM files for demonstration
 */

/* eslint-disable security/detect-object-injection */

// Use native EventTarget instead of importing from cornerstone

export interface SampleDicomFile {
  id: string;
  name: string;
  description: string;
  url: string;
  size: number;
  modality: string;
  studyDescription: string;
  seriesDescription: string;
  instances: number;
  downloaded: boolean;
  loading: boolean;
  localPath?: string;
}

export interface SampleDataConfig {
  baseUrl: string;
  cachePath: string;
  enableAutoDownload: boolean;
  maxCacheSize: number;
}

/**
 * Sample DICOM data service for demonstration purposes
 */
export class SampleDataService extends EventTarget {
  private static instance: SampleDataService | null = null;
  private config: SampleDataConfig;
  private sampleFiles: Map<string, SampleDicomFile> = new Map();
  private downloadQueue: Set<string> = new Set();
  private cache: Map<string, ArrayBuffer> = new Map();

  /**
   * Trigger custom event
   */
  private triggerEvent(type: string, detail: any): void {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  private constructor(config: Partial<SampleDataConfig> = {}) {
    super();

    this.config = {
      baseUrl: 'https://www.cornerstonejs.org/assets/dcm/',
      cachePath: '/sample-dicom/',
      enableAutoDownload: false,
      maxCacheSize: 100 * 1024 * 1024, // 100MB
      ...config,
    };

    this.initializeSampleFiles();
  }

  public static getInstance(config?: Partial<SampleDataConfig>): SampleDataService {
    if (!SampleDataService.instance) {
      SampleDataService.instance = new SampleDataService(config);
    }
    return SampleDataService.instance;
  }

  /**
   * Initialize sample DICOM files list
   */
  private initializeSampleFiles(): void {
    const sampleFiles: SampleDicomFile[] = [
      {
        id: 'ct-chest',
        name: 'CT Chest',
        description: 'CT scan of chest with contrast',
        url: 'https://raw.githubusercontent.com/cornerstonejs/cornerstone3D/main/packages/dicomImageLoader/testImages/CT_chest.dcm',
        size: 2.1 * 1024 * 1024, // 2.1MB estimate
        modality: 'CT',
        studyDescription: 'Chest CT with Contrast',
        seriesDescription: 'Axial CT Chest',
        instances: 1,
        downloaded: false,
        loading: false,
      },
      {
        id: 'mr-brain',
        name: 'MR Brain',
        description: 'MRI brain T1 weighted image',
        url: 'https://raw.githubusercontent.com/cornerstonejs/cornerstone3D/main/packages/dicomImageLoader/testImages/MR_brain.dcm',
        size: 1.8 * 1024 * 1024, // 1.8MB estimate
        modality: 'MR',
        studyDescription: 'Brain MRI T1',
        seriesDescription: 'T1 Weighted Axial',
        instances: 1,
        downloaded: false,
        loading: false,
      },
      {
        id: 'us-kidney',
        name: 'US Kidney',
        description: 'Ultrasound kidney image',
        url: 'https://raw.githubusercontent.com/cornerstonejs/cornerstone3D/main/packages/dicomImageLoader/testImages/US_kidney.dcm',
        size: 0.8 * 1024 * 1024, // 0.8MB estimate
        modality: 'US',
        studyDescription: 'Kidney Ultrasound',
        seriesDescription: 'US Kidney',
        instances: 1,
        downloaded: false,
        loading: false,
      },
      {
        id: 'xr-chest',
        name: 'X-Ray Chest',
        description: 'Chest X-Ray PA view',
        url: 'https://raw.githubusercontent.com/cornerstonejs/cornerstone3D/main/packages/dicomImageLoader/testImages/XR_chest.dcm',
        size: 1.2 * 1024 * 1024, // 1.2MB estimate
        modality: 'CR',
        studyDescription: 'Chest X-Ray',
        seriesDescription: 'PA Chest',
        instances: 1,
        downloaded: false,
        loading: false,
      },
      {
        id: 'ct-abdomen-series',
        name: 'CT Abdomen Series',
        description: 'Multi-slice CT abdomen series',
        url:
          'https://server.dcmjs.org/dcm4chee-arc/aets/DCM4CHEE/rs/studies/' +
          '1.3.6.1.4.1.14519.5.2.1.6279.6001.298806137288633453246975630178',
        size: 25 * 1024 * 1024, // 25MB estimate
        modality: 'CT',
        studyDescription: 'Abdomen CT Series',
        seriesDescription: 'Axial CT Abdomen',
        instances: 50,
        downloaded: false,
        loading: false,
      },
    ];

    sampleFiles.forEach(file => {
      this.sampleFiles.set(file.id, file);
    });
  }

  /**
   * Get all available sample files
   */
  public getSampleFiles(): SampleDicomFile[] {
    return Array.from(this.sampleFiles.values());
  }

  /**
   * Get sample file by ID
   */
  public getSampleFile(id: string): SampleDicomFile | null {
    return this.sampleFiles.get(id) || null;
  }

  /**
   * Download sample DICOM file
   */
  public async downloadSampleFile(id: string): Promise<ArrayBuffer> {
    const file = this.sampleFiles.get(id);
    if (!file) {
      throw new Error(`Sample file not found: ${id}`);
    }

    // Check if already downloading
    if (this.downloadQueue.has(id)) {
      throw new Error(`File already downloading: ${id}`);
    }

    // Check cache first
    if (this.cache.has(id)) {
      file.downloaded = true;
      return this.cache.get(id)!;
    }

    file.loading = true;
    this.downloadQueue.add(id);

    this.triggerEvent('download:started', { fileId: id, file });

    try {
      const response = await fetch(file.url);

      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }

      const totalSize = parseInt(response.headers.get('content-length') || '0');
      let downloadedSize = 0;

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        downloadedSize += value.length;

        // Update progress
        const progress = totalSize > 0 ? (downloadedSize / totalSize) * 100 : 0;
        this.triggerEvent('download:progress', {
          fileId: id,
          progress,
          downloadedSize,
          totalSize,
        });
      }

      // Combine chunks into ArrayBuffer
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const result = new ArrayBuffer(totalLength);
      const resultView = new Uint8Array(result);

      let offset = 0;
      for (const chunk of chunks) {
        resultView.set(chunk, offset);
        offset += chunk.length;
      }

      // Cache the result
      this.cache.set(id, result);
      file.downloaded = true;
      file.loading = false;
      file.size = totalLength;

      this.triggerEvent('download:completed', { fileId: id, file, data: result });

      return result;
    } catch (error) {
      file.loading = false;
      this.triggerEvent('download:failed', {
        fileId: id,
        file,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      this.downloadQueue.delete(id);
    }
  }

  /**
   * Download multiple sample files
   */
  public async downloadMultipleFiles(fileIds: string[]): Promise<Map<string, ArrayBuffer>> {
    const results = new Map<string, ArrayBuffer>();
    const promises = fileIds.map(async id => {
      try {
        const data = await this.downloadSampleFile(id);
        results.set(id, data);
      } catch (error) {
        console.error(`Failed to download ${id}:`, error);
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Get cached file data
   */
  public getCachedFile(id: string): ArrayBuffer | null {
    return this.cache.get(id) || null;
  }

  /**
   * Check if file is cached
   */
  public isCached(id: string): boolean {
    return this.cache.has(id);
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();

    // Reset download status
    this.sampleFiles.forEach(file => {
      file.downloaded = false;
      file.loading = false;
    });

    this.triggerEvent('cache:cleared', {});
  }

  /**
   * Get cache size
   */
  public getCacheSize(): number {
    let totalSize = 0;
    for (const data of this.cache.values()) {
      totalSize += data.byteLength;
    }
    return totalSize;
  }

  /**
   * Get sample files by modality
   */
  public getSampleFilesByModality(modality: string): SampleDicomFile[] {
    return Array.from(this.sampleFiles.values()).filter(file => file.modality === modality);
  }

  /**
   * Get downloaded files
   */
  public getDownloadedFiles(): SampleDicomFile[] {
    return Array.from(this.sampleFiles.values()).filter(file => file.downloaded);
  }

  /**
   * Create sample study data structure
   */
  public createSampleStudyData(): any {
    const downloadedFiles = this.getDownloadedFiles();

    if (downloadedFiles.length === 0) {
      return null;
    }

    // Group by study
    const studies = new Map();

    downloadedFiles.forEach(file => {
      const studyUID = `1.2.3.4.${file.id}`;
      const seriesUID = `1.2.3.4.${file.id}.1`;

      if (!studies.has(studyUID)) {
        studies.set(studyUID, {
          studyInstanceUID: studyUID,
          studyDescription: file.studyDescription,
          studyDate: new Date().toISOString().split('T')[0].replace(/-/g, ''),
          studyTime: '120000',
          patientName: 'Sample Patient',
          patientID: 'SAMPLE001',
          series: new Map(),
        });
      }

      const study = studies.get(studyUID);
      study.series.set(seriesUID, {
        seriesInstanceUID: seriesUID,
        seriesDescription: file.seriesDescription,
        modality: file.modality,
        seriesNumber: '1',
        instances: [
          {
            sopInstanceUID: `1.2.3.4.${file.id}.1.1`,
            instanceNumber: '1',
            imageId: `dicom:${file.id}`,
            rows: 512,
            columns: 512,
            bitsAllocated: 16,
            windowCenter: 40,
            windowWidth: 400,
          },
        ],
        thumbnailPath: null,
        isLoading: false,
      });
    });

    return {
      studies: Array.from(studies.values()).map(study => ({
        ...study,
        series: Array.from(study.series.values()),
      })),
    };
  }

  /**
   * Generate image ID for cornerstone
   */
  public generateImageId(fileId: string): string {
    const file = this.sampleFiles.get(fileId);
    if (!file || !file.downloaded) {
      throw new Error(`File not available: ${fileId}`);
    }

    return `dicom:sample://${fileId}`;
  }

  /**
   * Get sample data for different viewer modes
   */
  public getSampleDataForViewer() {
    const downloadedFiles = this.getDownloadedFiles();

    return {
      // Single image viewer
      singleImage:
        downloadedFiles.length > 0
          ? {
            imageId: this.generateImageId(downloadedFiles[0].id),
            file: downloadedFiles[0],
          }
          : null,

      // Series browser
      seriesList: downloadedFiles.map(file => ({
        seriesInstanceUID: `1.2.3.4.${file.id}.1`,
        seriesDescription: file.seriesDescription,
        modality: file.modality,
        instanceCount: file.instances,
        thumbnailPath: null,
        isLoading: false,
        imageId: this.generateImageId(file.id),
        file,
      })),

      // Study comparison
      studies: this.groupFilesByStudy(downloadedFiles),

      // Tool demonstration
      toolDemoImages: downloadedFiles
        .filter(file => ['CT', 'MR'].includes(file.modality))
        .map(file => ({
          imageId: this.generateImageId(file.id),
          file,
          tools: this.getRecommendedTools(file.modality),
        })),
    };
  }

  /**
   * Group files by study for comparison
   */
  private groupFilesByStudy(files: SampleDicomFile[]) {
    const groups = new Map<string, SampleDicomFile[]>();

    files.forEach(file => {
      const studyKey = file.studyDescription;
      if (!groups.has(studyKey)) {
        groups.set(studyKey, []);
      }
      groups.get(studyKey)!.push(file);
    });

    return Array.from(groups.entries()).map(([studyDescription, studyFiles]) => ({
      studyInstanceUID: `sample-study-${studyDescription.replace(/\s+/g, '-').toLowerCase()}`,
      studyDescription,
      patientName: 'Sample Patient',
      studyDate: new Date().toISOString().split('T')[0],
      series: studyFiles.map(file => ({
        seriesInstanceUID: `1.2.3.4.${file.id}.1`,
        seriesDescription: file.seriesDescription,
        modality: file.modality,
        imageId: this.generateImageId(file.id),
        file,
      })),
    }));
  }

  /**
   * Get recommended tools for modality
   */
  private getRecommendedTools(modality: string): string[] {
    const toolMap: Record<string, string[]> = {
      CT: ['windowLevel', 'zoom', 'pan', 'length', 'rectangleROI', 'angle'],
      MR: ['windowLevel', 'zoom', 'pan', 'length', 'ellipseROI', 'angle'],
      US: ['zoom', 'pan', 'length', 'ellipseROI'],
      CR: ['windowLevel', 'zoom', 'pan', 'length', 'rectangleROI'],
      XR: ['windowLevel', 'zoom', 'pan', 'length', 'rectangleROI'],
    };

    return toolMap[modality] || ['zoom', 'pan', 'length'];
  }

  /**
   * Preload essential sample files
   */
  public async preloadEssentialFiles(): Promise<void> {
    const essentialFiles = ['ct-chest', 'mr-brain', 'xr-chest'];

    this.triggerEvent('preload:started', { fileIds: essentialFiles });

    try {
      await this.downloadMultipleFiles(essentialFiles);
      this.triggerEvent('preload:completed', { fileIds: essentialFiles });
    } catch (error) {
      this.triggerEvent('preload:failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<SampleDataConfig>): void {
    this.config = { ...this.config, ...config };
    this.triggerEvent('config:updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  public getConfig(): SampleDataConfig {
    return { ...this.config };
  }

  /**
   * Get download statistics
   */
  public getStats() {
    const totalFiles = this.sampleFiles.size;
    const downloadedFiles = this.getDownloadedFiles().length;
    const cacheSize = this.getCacheSize();
    const downloadingFiles = Array.from(this.sampleFiles.values()).filter(f => f.loading).length;

    return {
      totalFiles,
      downloadedFiles,
      downloadingFiles,
      cacheSize,
      cacheSizeFormatted: this.formatBytes(cacheSize),
      downloadProgress: totalFiles > 0 ? (downloadedFiles / totalFiles) * 100 : 0,
    };
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Cleanup and destroy
   */
  public destroy(): void {
    this.clearCache();
    this.downloadQueue.clear();
    SampleDataService.instance = null;
  }
}

// Export singleton instance
export const sampleDataService = SampleDataService.getInstance();
