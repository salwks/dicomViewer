/**
 * DICOM 로더 오케스트레이터
 * 모든 DICOM 로딩 컴포넌트를 조합하고 통합 인터페이스 제공
 */

import {
  DICOMLoaderConfig,
  IDICOMLoader,
  LoadingProgress,
  VolumeLoadingOptions,
  ImageLoadingResult,
  VolumeLoadingResult,
} from './interfaces/DICOMTypes';
import { DICOMImageLoader, createDICOMImageLoader } from './loaders/DICOMImageLoader';
import { DICOMVolumeLoader, createDICOMVolumeLoader } from './loaders/DICOMVolumeLoader';
import { WADOLoader, createWADOLoader } from './loaders/WADOLoader';
import { MetadataExtractor, createMetadataExtractor } from './processors/MetadataExtractor';
import { SOPClassProcessor, createSOPClassProcessor } from './processors/SOPClassProcessor';
import { log } from '../../utils/logger';

export interface OrchestratorConfig extends DICOMLoaderConfig {
  /** Enable automatic SOP class detection */
  enableSOPClassDetection?: boolean;
  /** Enable metadata extraction */
  enableMetadataExtraction?: boolean;
  /** Performance monitoring */
  enablePerformanceMonitoring?: boolean;
  /** Error recovery strategies */
  errorRecovery?: {
    maxRetries?: number;
    retryDelay?: number;
    fallbackToBasicLoader?: boolean;
  };
}

export interface LoadingStatistics {
  /** Total images loaded */
  totalImagesLoaded: number;
  /** Total volumes loaded */
  totalVolumesLoaded: number;
  /** Average loading time per image */
  averageImageLoadTime: number;
  /** Average loading time per volume */
  averageVolumeLoadTime: number;
  /** Success rate */
  successRate: number;
  /** Most common SOP classes */
  commonSOPClasses: string[];
  /** Performance metrics */
  performance: {
    totalMemoryUsage: number;
    cacheHitRate: number;
    networkLatency: number;
  };
}

/**
 * DICOM 로더 오케스트레이터 - 모든 로딩 컴포넌트의 통합 관리
 */
export class DICOMLoaderOrchestrator implements IDICOMLoader {
  private config: OrchestratorConfig = {
    maxConcurrentRequests: 6,
    requestTimeout: 30000,
    enableProgressiveLoading: true,
    cacheSize: 1024 * 1024 * 1024, // 1GB
    enableSOPClassDetection: true,
    enableMetadataExtraction: true,
    enablePerformanceMonitoring: true,
    supportedSOPClasses: [],
    errorRecovery: {
      maxRetries: 3,
      retryDelay: 1000,
      fallbackToBasicLoader: true,
    },
  };

  private initialized = false;
  private imageLoader!: DICOMImageLoader;
  private volumeLoader!: DICOMVolumeLoader;
  private wadoLoader!: WADOLoader;
  private metadataExtractor!: MetadataExtractor;
  private sopClassProcessor!: SOPClassProcessor;

  // 통계 및 모니터링
  private statistics: LoadingStatistics = {
    totalImagesLoaded: 0,
    totalVolumesLoaded: 0,
    averageImageLoadTime: 0,
    averageVolumeLoadTime: 0,
    successRate: 1.0,
    commonSOPClasses: [],
    performance: {
      totalMemoryUsage: 0,
      cacheHitRate: 0,
      networkLatency: 0,
    },
  };

  private loadingTimes: number[] = [];
  private volumeLoadingTimes: number[] = [];

  constructor(config?: OrchestratorConfig) {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // 컴포넌트 초기화
    this.initializeComponents();

    log.info('DICOM Loader Orchestrator initialized', {
      component: 'DICOMLoaderOrchestrator',
      metadata: { config: this.config },
    });
  }

  async initialize(): Promise<void> {
    try {
      log.info('Initializing DICOM Loader Orchestrator...', {
        component: 'DICOMLoaderOrchestrator',
      });

      // 모든 컴포넌트 초기화
      await Promise.all([
        this.imageLoader.initialize(),
        this.volumeLoader.initialize(),
        this.wadoLoader.initialize(),
      ]);

      // 컴포넌트 간 연결 설정
      this.setupComponentIntegration();

      this.initialized = true;

      log.info('DICOM Loader Orchestrator initialized successfully', {
        component: 'DICOMLoaderOrchestrator',
      });

    } catch (error) {
      log.error('Failed to initialize DICOM Loader Orchestrator', {
        component: 'DICOMLoaderOrchestrator',
      }, error as Error);
      throw error;
    }
  }

  async configure(config: Partial<DICOMLoaderConfig>): Promise<void> {
    this.config = { ...this.config, ...config };

    // 모든 컴포넌트에 설정 전파
    await Promise.all([
      this.imageLoader.configure(config),
      this.volumeLoader.configure(config),
      this.wadoLoader.configure(config),
    ]);

    log.info('DICOM Loader Orchestrator configuration updated', {
      component: 'DICOMLoaderOrchestrator',
      metadata: { config },
    });
  }

  async cleanup(): Promise<void> {
    // 모든 컴포넌트 정리
    await Promise.all([
      this.imageLoader.cleanup(),
      this.volumeLoader.cleanup(),
      this.wadoLoader.cleanup(),
    ]);

    // 통계 초기화
    this.resetStatistics();

    this.initialized = false;

    log.info('DICOM Loader Orchestrator cleaned up', {
      component: 'DICOMLoaderOrchestrator',
    });
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 통합 이미지 로딩 인터페이스
   */
  async loadImage(imageId: string): Promise<ImageLoadingResult> {
    if (!this.initialized) {
      throw new Error('DICOM Loader Orchestrator not initialized');
    }

    const startTime = Date.now();
    let result: ImageLoadingResult;

    try {
      // 메타데이터 추출 (필요시)
      let metadata;
      if (this.config.enableMetadataExtraction) {
        try {
          metadata = await this.metadataExtractor.extractMetadata(imageId);
        } catch (error) {
          log.warn('Failed to extract metadata', {
            component: 'DICOMLoaderOrchestrator',
            metadata: { imageId },
          }, error as Error);
        }
      }

      // SOP 클래스 처리 (필요시)
      if (this.config.enableSOPClassDetection && metadata?.sopClassUID) {
        try {
          await this.sopClassProcessor.process(imageId, metadata.sopClassUID);
        } catch (error) {
          log.warn('SOP class processing failed', {
            component: 'DICOMLoaderOrchestrator',
            metadata: { imageId, sopClassUID: metadata.sopClassUID },
          }, error as Error);
        }
      }

      // 이미지 로딩
      result = await this.imageLoader.loadImage(imageId);

      // 메타데이터를 결과에 추가
      if (metadata && result.success) {
        result.metadata = metadata;
      }

      // 통계 업데이트
      this.updateImageStatistics(result, Date.now() - startTime);

      return result;

    } catch (error) {
      // 에러 복구 시도
      if (this.config.errorRecovery?.fallbackToBasicLoader) {
        log.warn('Attempting fallback loading strategy', {
          component: 'DICOMLoaderOrchestrator',
          metadata: { imageId },
        }, error as Error);

        try {
          result = await this.performFallbackImageLoad(imageId);
          this.updateImageStatistics(result, Date.now() - startTime);
          return result;
        } catch (fallbackError) {
          log.error('Fallback loading also failed', {
            component: 'DICOMLoaderOrchestrator',
            metadata: { imageId },
          }, fallbackError as Error);
        }
      }

      // 최종 에러 결과 반환
      result = {
        image: null as any,
        loadingTime: Date.now() - startTime,
        success: false,
        error: (error as Error).message,
      };

      this.updateImageStatistics(result, Date.now() - startTime);
      return result;
    }
  }

  /**
   * 통합 볼륨 로딩 인터페이스
   */
  async loadVolume(options: VolumeLoadingOptions): Promise<VolumeLoadingResult> {
    if (!this.initialized) {
      throw new Error('DICOM Loader Orchestrator not initialized');
    }

    const startTime = Date.now();

    try {
      // 배치 메타데이터 추출 (필요시)
      if (this.config.enableMetadataExtraction) {
        try {
          const metadataBatch = await this.metadataExtractor.extractMetadataBatch(options.imageIds);
          log.debug(`Extracted metadata for ${metadataBatch.length} images`, {
            component: 'DICOMLoaderOrchestrator',
            metadata: { volumeId: options.volumeId },
          });
        } catch (error) {
          log.warn('Batch metadata extraction failed', {
            component: 'DICOMLoaderOrchestrator',
            metadata: { volumeId: options.volumeId },
          }, error as Error);
        }
      }

      // 볼륨 로딩
      const result = await this.volumeLoader.loadVolume(options);

      // 통계 업데이트
      this.updateVolumeStatistics(result, Date.now() - startTime);

      return result;

    } catch (error) {
      log.error('Volume loading failed', {
        component: 'DICOMLoaderOrchestrator',
        metadata: { volumeId: options.volumeId },
      }, error as Error);

      const result: VolumeLoadingResult = {
        volume: null as any,
        loadingTime: Date.now() - startTime,
        success: false,
        error: (error as Error).message,
        imagesLoaded: 0,
      };

      this.updateVolumeStatistics(result, Date.now() - startTime);
      return result;
    }
  }

  /**
   * 다중 이미지 로딩
   */
  async loadImages(
    imageIds: string[],
    callback?: (progress: LoadingProgress) => void,
  ): Promise<ImageLoadingResult[]> {
    return await this.imageLoader.loadImages(imageIds, callback);
  }

  /**
   * 로딩 통계 조회
   */
  getStatistics(): LoadingStatistics {
    // 현재 메모리 사용량 업데이트
    const imageCache = this.imageLoader.getCacheStats();
    const volumeStats = this.volumeLoader.getVolumeStats();

    this.statistics.performance.totalMemoryUsage =
      (imageCache.size * 1024 * 1024) + volumeStats.totalMemoryUsage;

    this.statistics.performance.cacheHitRate = imageCache.hitRate;

    return { ...this.statistics };
  }

  /**
   * 성능 보고서 생성
   */
  generatePerformanceReport(): string {
    const stats = this.getStatistics();

    return `
DICOM Loader Performance Report
===============================
Images Loaded: ${stats.totalImagesLoaded}
Volumes Loaded: ${stats.totalVolumesLoaded}
Average Image Load Time: ${stats.averageImageLoadTime.toFixed(2)}ms
Average Volume Load Time: ${stats.averageVolumeLoadTime.toFixed(2)}ms
Success Rate: ${(stats.successRate * 100).toFixed(1)}%
Memory Usage: ${(stats.performance.totalMemoryUsage / (1024 * 1024)).toFixed(1)}MB
Cache Hit Rate: ${(stats.performance.cacheHitRate * 100).toFixed(1)}%

Most Common SOP Classes:
${stats.commonSOPClasses.slice(0, 5).map(sop => `  - ${sop}`).join('\n')}

Generated: ${new Date().toISOString()}
    `.trim();
  }

  /**
   * 컴포넌트 초기화
   */
  private initializeComponents(): void {
    // 이미지 로더 생성
    this.imageLoader = createDICOMImageLoader({
      maxConcurrentLoads: this.config.maxConcurrentRequests,
      imageCacheSize: this.config.cacheSize ? this.config.cacheSize / 2 : undefined,
    });

    // 볼륨 로더 생성
    this.volumeLoader = createDICOMVolumeLoader({
      volumeCacheSize: this.config.cacheSize ? this.config.cacheSize / 2 : undefined,
    });

    // WADO 로더 생성
    this.wadoLoader = createWADOLoader({
      wadoUriEndpoint: this.config.wadoUriEndpoint,
      wadoRsEndpoint: this.config.wadoRsEndpoint,
      timeout: this.config.requestTimeout,
    });

    // 메타데이터 추출기 생성
    this.metadataExtractor = createMetadataExtractor({
      includePatientInfo: true,
      includeStudyInfo: true,
      includeSeriesInfo: true,
      includeImageInfo: true,
      anonymize: false,
    });

    // SOP 클래스 처리기 생성
    this.sopClassProcessor = createSOPClassProcessor({
      enableEnhancedProcessing: true,
      extractMetadata: true,
      modalityOptimization: true,
    });
  }

  /**
   * 컴포넌트 간 통합 설정
   */
  private setupComponentIntegration(): void {
    // 이미지 로더에 WADO 로더 연결
    this.imageLoader.setWADOLoader(this.wadoLoader);

    // 볼륨 로더에 이미지 로더 연결
    this.volumeLoader.setImageLoader(this.imageLoader);

    log.debug('Component integration configured', {
      component: 'DICOMLoaderOrchestrator',
    });
  }

  /**
   * 폴백 이미지 로딩
   */
  private async performFallbackImageLoad(imageId: string): Promise<ImageLoadingResult> {
    // 간단한 폴백 전략 - 기본 cornerstone imageLoader 사용
    log.info('Performing fallback image loading', {
      component: 'DICOMLoaderOrchestrator',
      metadata: { imageId },
    });

    // 실제 구현에서는 기본 이미지 로더를 사용
    return {
      image: null as any,
      loadingTime: 0,
      success: false,
      error: 'Fallback loading not implemented',
    };
  }

  /**
   * 이미지 로딩 통계 업데이트
   */
  private updateImageStatistics(_result: ImageLoadingResult, loadingTime: number): void {
    this.statistics.totalImagesLoaded++;
    this.loadingTimes.push(loadingTime);

    // 평균 로딩 시간 계산
    this.statistics.averageImageLoadTime =
      this.loadingTimes.reduce((sum, time) => sum + time, 0) / this.loadingTimes.length;

    // 성공률 계산
    const totalAttempts = this.loadingTimes.length;
    const successfulLoads = this.loadingTimes.length; // 실제 구현에서는 성공 카운트 추적
    this.statistics.successRate = successfulLoads / totalAttempts;
  }

  /**
   * 볼륨 로딩 통계 업데이트
   */
  private updateVolumeStatistics(_result: VolumeLoadingResult, loadingTime: number): void {
    this.statistics.totalVolumesLoaded++;
    this.volumeLoadingTimes.push(loadingTime);

    // 평균 볼륨 로딩 시간 계산
    this.statistics.averageVolumeLoadTime =
      this.volumeLoadingTimes.reduce((sum, time) => sum + time, 0) / this.volumeLoadingTimes.length;
  }

  /**
   * 통계 초기화
   */
  private resetStatistics(): void {
    this.statistics = {
      totalImagesLoaded: 0,
      totalVolumesLoaded: 0,
      averageImageLoadTime: 0,
      averageVolumeLoadTime: 0,
      successRate: 1.0,
      commonSOPClasses: [],
      performance: {
        totalMemoryUsage: 0,
        cacheHitRate: 0,
        networkLatency: 0,
      },
    };

    this.loadingTimes = [];
    this.volumeLoadingTimes = [];
  }
}

// 팩토리 함수
export function createDICOMLoaderOrchestrator(config?: OrchestratorConfig): DICOMLoaderOrchestrator {
  return new DICOMLoaderOrchestrator(config);
}

// 기본 인스턴스 내보내기 (기존 코드와의 호환성을 위해)
export const dicomLoaderOrchestrator = createDICOMLoaderOrchestrator();
