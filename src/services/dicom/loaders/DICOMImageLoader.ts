/**
 * DICOM 이미지 로더
 * 단일 이미지 로딩과 기본적인 이미지 처리 담당
 */

import { Types, imageLoader } from '@cornerstonejs/core';
import {
  DICOMLoaderConfig,
  IImageLoader,
  LoadingProgress,
  LoadingStage,
  ImageLoadingResult,
} from '../interfaces/DICOMTypes';
import { WADOLoader, WADOImageId } from './WADOLoader';
import { log } from '../../../utils/logger';

export interface ImageLoaderConfig {
  /** Maximum concurrent image loads */
  maxConcurrentLoads?: number;
  /** Image cache size */
  imageCacheSize?: number;
  /** Enable image preprocessing */
  enablePreprocessing?: boolean;
  /** Default window/level settings */
  defaultWindowLevel?: {
    windowCenter: number;
    windowWidth: number;
  };
  /** Pixel data transformation */
  pixelDataTransform?: {
    modalityLUT?: boolean;
    voiLUT?: boolean;
  };
}

/**
 * DICOM 이미지 로더 클래스
 */
export class DICOMImageLoader implements IImageLoader {
  private config: ImageLoaderConfig = {
    maxConcurrentLoads: 6,
    imageCacheSize: 1024 * 1024 * 512, // 512MB
    enablePreprocessing: true,
    defaultWindowLevel: {
      windowCenter: 128,
      windowWidth: 256,
    },
    pixelDataTransform: {
      modalityLUT: true,
      voiLUT: true,
    },
  };

  private initialized = false;
  private loadingQueue: Map<string, Promise<ImageLoadingResult>> = new Map();
  private currentLoads = 0;
  private wadoLoader?: WADOLoader;
  private imageCache: Map<string, Types.IImage> = new Map();

  constructor(config?: ImageLoaderConfig) {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    log.info('DICOM Image Loader initialized', {
      component: 'DICOMImageLoader',
      metadata: { config: this.config },
    });
  }

  async initialize(): Promise<void> {
    try {
      // Cornerstone3D 이미지 로더 초기화
      this.setupCornerstoneImageLoader();

      // WADO 로더 설정 (필요한 경우)
      if (this.wadoLoader) {
        await this.wadoLoader.initialize();
      }

      this.initialized = true;

      log.info('DICOM Image Loader initialized successfully', {
        component: 'DICOMImageLoader',
      });

    } catch (error) {
      log.error('Failed to initialize DICOM Image Loader', {
        component: 'DICOMImageLoader',
      }, error as Error);
      throw error;
    }
  }

  async configure(config: Partial<DICOMLoaderConfig>): Promise<void> {
    // 이미지 로더 관련 설정 추출
    const imageConfig: Partial<ImageLoaderConfig> = {};

    if (config.maxConcurrentRequests) {
      imageConfig.maxConcurrentLoads = config.maxConcurrentRequests;
    }

    if (config.cacheSize) {
      imageConfig.imageCacheSize = config.cacheSize;
    }

    this.config = { ...this.config, ...imageConfig };

    // WADO 로더 설정 업데이트
    if (this.wadoLoader) {
      await this.wadoLoader.configure(config);
    }

    log.info('DICOM Image Loader configuration updated', {
      component: 'DICOMImageLoader',
      metadata: { config: imageConfig },
    });
  }

  async cleanup(): Promise<void> {
    // 진행 중인 로딩 취소
    this.loadingQueue.clear();
    this.currentLoads = 0;

    // 캐시 정리
    this.imageCache.clear();

    // WADO 로더 정리
    if (this.wadoLoader) {
      await this.wadoLoader.cleanup();
    }

    this.initialized = false;

    log.info('DICOM Image Loader cleaned up', {
      component: 'DICOMImageLoader',
    });
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 단일 이미지 로딩
   */
  async loadImage(imageId: string): Promise<ImageLoadingResult> {
    if (!this.initialized) {
      throw new Error('DICOM Image Loader not initialized');
    }

    // 캐시에서 확인
    if (this.imageCache.has(imageId)) {
      const cachedImage = this.imageCache.get(imageId)!;

      log.debug('Image loaded from cache', {
        component: 'DICOMImageLoader',
        metadata: { imageId },
      });

      return {
        image: cachedImage,
        loadingTime: 0,
        success: true,
      };
    }

    // 이미 로딩 중인지 확인
    if (this.loadingQueue.has(imageId)) {
      return await this.loadingQueue.get(imageId)!;
    }

    // 동시 로딩 수 제한
    while (this.currentLoads >= this.config.maxConcurrentLoads!) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    const loadPromise = this.performImageLoad(imageId);
    this.loadingQueue.set(imageId, loadPromise);

    try {
      const result = await loadPromise;

      // 성공 시 캐시에 저장
      if (result.success && result.image) {
        this.addToCache(imageId, result.image);
      }

      return result;

    } finally {
      this.loadingQueue.delete(imageId);
      this.currentLoads--;
    }
  }

  /**
   * 다중 이미지 로딩
   */
  async loadImages(
    imageIds: string[],
    callback?: (progress: LoadingProgress) => void,
  ): Promise<ImageLoadingResult[]> {
    const results: ImageLoadingResult[] = [];
    const total = imageIds.length;

    log.info(`Starting batch image loading: ${total} images`, {
      component: 'DICOMImageLoader',
      metadata: { totalImages: total },
    });

    // 진행 상황 초기화
    if (callback) {
      callback({
        stage: LoadingStage.LOADING_IMAGES,
        percentage: 0,
        imagesLoaded: 0,
        totalImages: total,
      });
    }

    // 병렬 로딩 (동시 로딩 수 제한)
    const batchSize = Math.min(this.config.maxConcurrentLoads!, imageIds.length);

    for (let i = 0; i < imageIds.length; i += batchSize) {
      const batch = imageIds.slice(i, i + batchSize);
      const batchPromises = batch.map(imageId => this.loadImage(imageId));

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            image: null as any,
            loadingTime: 0,
            success: false,
            error: result.reason?.message || 'Unknown error',
          });
        }
      }

      // 진행 상황 업데이트
      if (callback) {
        const loaded = Math.min(i + batchSize, total);
        callback({
          stage: LoadingStage.LOADING_IMAGES,
          percentage: Math.round(loaded / total * 100),
          imagesLoaded: loaded,
          totalImages: total,
        });
      }
    }

    const successful = results.filter(r => r.success).length;

    log.info(`Batch image loading completed: ${successful}/${total} successful`, {
      component: 'DICOMImageLoader',
      metadata: { successful, total, successRate: successful / total },
    });

    return results;
  }

  /**
   * WADO 로더 설정
   */
  setWADOLoader(wadoLoader: WADOLoader): void {
    this.wadoLoader = wadoLoader;
  }

  /**
   * 캐시 통계
   */
  getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    const size = this.imageCache.size;
    const maxSize = Math.floor(this.config.imageCacheSize! / (512 * 512 * 2)); // 추정

    return {
      size,
      maxSize,
      hitRate: 0, // 실제 구현에서는 히트율 계산
    };
  }

  /**
   * 실제 이미지 로딩 수행
   */
  private async performImageLoad(imageId: string): Promise<ImageLoadingResult> {
    this.currentLoads++;
    const startTime = Date.now();

    try {
      // WADO 프로토콜 감지
      if (this.isWADOImageId(imageId)) {
        return await this.loadWADOImage(imageId);
      }

      // 일반 DICOM 이미지 로딩
      return await this.loadStandardImage(imageId);

    } catch (error) {
      const loadingTime = Date.now() - startTime;

      log.error('Image loading failed', {
        component: 'DICOMImageLoader',
        metadata: { imageId, loadingTime },
      }, error as Error);

      return {
        image: null as any,
        loadingTime,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 표준 DICOM 이미지 로딩
   */
  private async loadStandardImage(imageId: string): Promise<ImageLoadingResult> {
    const startTime = Date.now();

    try {
      // Cornerstone3D imageLoader 사용
      const image = await imageLoader.loadAndCacheImage!(imageId);

      // 전처리 적용
      if (this.config.enablePreprocessing) {
        this.preprocessImage(image);
      }

      return {
        image,
        loadingTime: Date.now() - startTime,
        success: true,
      };

    } catch (error) {
      throw new Error(`Failed to load standard image: ${(error as Error).message}`);
    }
  }

  /**
   * WADO 이미지 로딩
   */
  private async loadWADOImage(imageId: string): Promise<ImageLoadingResult> {
    if (!this.wadoLoader) {
      throw new Error('WADO Loader not configured');
    }

    const wadoImageId = this.parseWADOImageId(imageId);

    if (wadoImageId.protocol === 'wado-uri') {
      return await this.wadoLoader.loadImageViaWadoUri(wadoImageId);
    } else {
      return await this.wadoLoader.loadImageViaWadoRs(wadoImageId);
    }
  }

  /**
   * Cornerstone3D 이미지 로더 설정
   */
  private setupCornerstoneImageLoader(): void {
    // 이미지 로더 등록 및 설정
    // 실제 구현에서는 cornerstone3D 설정
    log.debug('Cornerstone3D image loader configured', {
      component: 'DICOMImageLoader',
    });
  }

  /**
   * 이미지 전처리
   */
  private preprocessImage(image: Types.IImage): void {
    // 윈도우/레벨 기본값 설정
    if (!image.windowCenter || !image.windowWidth) {
      image.windowCenter = this.config.defaultWindowLevel!.windowCenter;
      image.windowWidth = this.config.defaultWindowLevel!.windowWidth;
    }

    // 추가 전처리 로직
    if (this.config.pixelDataTransform?.modalityLUT) {
      // Modality LUT 적용
    }

    if (this.config.pixelDataTransform?.voiLUT) {
      // VOI LUT 적용
    }
  }

  /**
   * 캐시에 이미지 추가
   */
  private addToCache(imageId: string, image: Types.IImage): void {
    // 캐시 크기 제한 확인
    const estimatedSize = (image.rows || 512) * (image.columns || 512) * 2; // 16-bit
    const currentCacheSize = this.imageCache.size * estimatedSize;

    if (currentCacheSize + estimatedSize > this.config.imageCacheSize!) {
      // LRU 캐시 정리
      this.evictFromCache();
    }

    this.imageCache.set(imageId, image);
  }

  /**
   * 캐시에서 제거 (LRU)
   */
  private evictFromCache(): void {
    // 가장 오래된 이미지 제거 (간단한 구현)
    const firstKey = this.imageCache.keys().next().value;
    if (firstKey) {
      this.imageCache.delete(firstKey);
    }
  }

  /**
   * WADO 이미지 ID 여부 확인
   */
  private isWADOImageId(imageId: string): boolean {
    return imageId.startsWith('wado-uri:') || imageId.startsWith('wado-rs:');
  }

  /**
   * WADO 이미지 ID 파싱
   */
  private parseWADOImageId(imageId: string): WADOImageId {
    const [protocol, ...parts] = imageId.split(':');
    const [studyUID, seriesUID, sopUID] = parts.join(':').split('/');

    return {
      protocol: protocol as 'wado-uri' | 'wado-rs',
      studyInstanceUID: studyUID,
      seriesInstanceUID: seriesUID,
      sopInstanceUID: sopUID,
    };
  }
}

// 팩토리 함수
export function createDICOMImageLoader(config?: ImageLoaderConfig): DICOMImageLoader {
  return new DICOMImageLoader(config);
}
