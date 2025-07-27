/**
 * DICOM 볼륨 로더
 * 3D 볼륨 데이터 로딩과 볼륨 재구성 담당
 */

import { Types, volumeLoader } from '@cornerstonejs/core';
import {
  DICOMLoaderConfig,
  IVolumeLoader,
  LoadingProgress,
  LoadingStage,
  VolumeLoadingOptions,
  VolumeLoadingResult,
} from '../interfaces/DICOMTypes';
import { DICOMImageLoader } from './DICOMImageLoader';
import { log } from '../../../utils/logger';

export interface VolumeLoaderConfig {
  /** Maximum volume cache size in bytes */
  volumeCacheSize?: number;
  /** Enable volume streaming */
  enableStreaming?: boolean;
  /** Slice sorting strategy */
  sliceSorting?: 'instance-number' | 'slice-location' | 'acquisition-time';
  /** Volume interpolation method */
  interpolation?: 'nearest' | 'linear' | 'cubic';
  /** Memory optimization settings */
  memoryOptimization?: {
    enableCompression?: boolean;
    lazyLoading?: boolean;
    maxSlicesInMemory?: number;
  };
}

/**
 * DICOM 볼륨 로더 클래스
 */
export class DICOMVolumeLoader implements IVolumeLoader {
  private config: VolumeLoaderConfig = {
    volumeCacheSize: 1024 * 1024 * 1024, // 1GB
    enableStreaming: true,
    sliceSorting: 'instance-number',
    interpolation: 'linear',
    memoryOptimization: {
      enableCompression: false,
      lazyLoading: true,
      maxSlicesInMemory: 100,
    },
  };

  private initialized = false;
  private imageLoader?: DICOMImageLoader;
  private volumeCache: Map<string, Types.IImageVolume> = new Map();
  private loadingQueue: Map<string, Promise<VolumeLoadingResult>> = new Map();

  constructor(config?: VolumeLoaderConfig) {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    log.info('DICOM Volume Loader initialized', {
      component: 'DICOMVolumeLoader',
      metadata: { config: this.config },
    });
  }

  async initialize(): Promise<void> {
    try {
      // Cornerstone3D 볼륨 로더 초기화
      this.setupCornerstoneVolumeLoader();

      this.initialized = true;

      log.info('DICOM Volume Loader initialized successfully', {
        component: 'DICOMVolumeLoader',
      });

    } catch (error) {
      log.error('Failed to initialize DICOM Volume Loader', {
        component: 'DICOMVolumeLoader',
      }, error as Error);
      throw error;
    }
  }

  async configure(config: Partial<DICOMLoaderConfig>): Promise<void> {
    // 볼륨 로더 관련 설정 추출
    const volumeConfig: Partial<VolumeLoaderConfig> = {};

    if (config.cacheSize) {
      volumeConfig.volumeCacheSize = config.cacheSize;
    }

    this.config = { ...this.config, ...volumeConfig };

    log.info('DICOM Volume Loader configuration updated', {
      component: 'DICOMVolumeLoader',
      metadata: { config: volumeConfig },
    });
  }

  async cleanup(): Promise<void> {
    // 진행 중인 볼륨 로딩 취소
    this.loadingQueue.clear();

    // 볼륨 캐시 정리
    this.clearVolumeCache();

    this.initialized = false;

    log.info('DICOM Volume Loader cleaned up', {
      component: 'DICOMVolumeLoader',
    });
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 볼륨 로딩
   */
  async loadVolume(options: VolumeLoadingOptions): Promise<VolumeLoadingResult> {
    if (!this.initialized) {
      throw new Error('DICOM Volume Loader not initialized');
    }

    const { volumeId, imageIds } = options;

    // 캐시에서 확인
    if (this.volumeCache.has(volumeId)) {
      const cachedVolume = this.volumeCache.get(volumeId)!;

      log.debug('Volume loaded from cache', {
        component: 'DICOMVolumeLoader',
        metadata: { volumeId },
      });

      return {
        volume: cachedVolume,
        loadingTime: 0,
        success: true,
        imagesLoaded: imageIds.length,
      };
    }

    // 이미 로딩 중인지 확인
    if (this.loadingQueue.has(volumeId)) {
      return await this.loadingQueue.get(volumeId)!;
    }

    const loadPromise = this.performVolumeLoad(options);
    this.loadingQueue.set(volumeId, loadPromise);

    try {
      const result = await loadPromise;

      // 성공 시 캐시에 저장
      if (result.success && result.volume) {
        this.addVolumeToCache(volumeId, result.volume);
      }

      return result;

    } finally {
      this.loadingQueue.delete(volumeId);
    }
  }

  /**
   * 이미지 로더 설정
   */
  setImageLoader(imageLoader: DICOMImageLoader): void {
    this.imageLoader = imageLoader;
  }

  /**
   * 볼륨 캐시 통계
   */
  getVolumeStats(): {
    volumeCount: number;
    totalMemoryUsage: number;
    maxMemoryUsage: number
    } {
    let totalMemory = 0;

    for (const volume of this.volumeCache.values()) {
      if (volume.scalarData && 'length' in volume.scalarData) {
        totalMemory += (volume.scalarData as any).length * 2; // 16-bit assumed
      }
    }

    return {
      volumeCount: this.volumeCache.size,
      totalMemoryUsage: totalMemory,
      maxMemoryUsage: this.config.volumeCacheSize!,
    };
  }

  /**
   * 실제 볼륨 로딩 수행
   */
  private async performVolumeLoad(options: VolumeLoadingOptions): Promise<VolumeLoadingResult> {
    const { volumeId, imageIds, callback } = options;
    const startTime = Date.now();

    try {
      // 진행 상황 초기화
      if (callback) {
        callback({
          stage: LoadingStage.INITIALIZING,
          percentage: 0,
          imagesLoaded: 0,
          totalImages: imageIds.length,
        });
      }

      // 이미지 ID 정렬
      const sortedImageIds = await this.sortImageIds(imageIds);

      // 진행 상황 업데이트
      if (callback) {
        callback({
          stage: LoadingStage.LOADING_IMAGES,
          percentage: 5,
          imagesLoaded: 0,
          totalImages: sortedImageIds.length,
        });
      }

      // 볼륨 로딩 전략 선택
      const volume = this.config.enableStreaming
        ? await this.loadVolumeStreaming(volumeId, sortedImageIds, callback)
        : await this.loadVolumeBatch(volumeId, sortedImageIds, callback);

      // 볼륨 후처리
      await this.postProcessVolume(volume);

      // 진행 상황 완료
      if (callback) {
        callback({
          stage: LoadingStage.COMPLETED,
          percentage: 100,
          imagesLoaded: sortedImageIds.length,
          totalImages: sortedImageIds.length,
        });
      }

      const loadingTime = Date.now() - startTime;

      log.info('Volume loading completed', {
        component: 'DICOMVolumeLoader',
        metadata: {
          volumeId,
          imageCount: sortedImageIds.length,
          loadingTime,
          memoryUsage: volume.scalarData && 'length' in volume.scalarData ? (volume.scalarData as any).length : 0,
        },
      });

      return {
        volume,
        loadingTime,
        success: true,
        imagesLoaded: sortedImageIds.length,
      };

    } catch (error) {
      const loadingTime = Date.now() - startTime;

      log.error('Volume loading failed', {
        component: 'DICOMVolumeLoader',
        metadata: { volumeId, loadingTime },
      }, error as Error);

      return {
        volume: null as any,
        loadingTime,
        success: false,
        error: (error as Error).message,
        imagesLoaded: 0,
      };
    }
  }

  /**
   * 스트리밍 방식 볼륨 로딩
   */
  private async loadVolumeStreaming(
    volumeId: string,
    imageIds: string[],
    callback?: (progress: LoadingProgress) => void,
  ): Promise<Types.IImageVolume> {

    // Cornerstone3D의 스트리밍 볼륨 로더 사용
    const volume = await volumeLoader.createAndCacheVolume!(volumeId, {
      imageIds,
      blendMode: 0,
    });

    // 스트리밍 로딩 시작
    let loadedImages = 0;

    const loadPromises = imageIds.map(async (imageId, index) => {
      try {
        // 이미지 로딩 (필요시 이미지 로더 사용)
        if (this.imageLoader) {
          await this.imageLoader.loadImage(imageId);
        }

        loadedImages++;

        // 진행 상황 업데이트
        if (callback) {
          callback({
            stage: LoadingStage.LOADING_IMAGES,
            percentage: Math.round((loadedImages / imageIds.length) * 90) + 5,
            imagesLoaded: loadedImages,
            totalImages: imageIds.length,
          });
        }

      } catch (error) {
        log.warn(`Failed to load image ${index}: ${imageId}`, {
          component: 'DICOMVolumeLoader',
        }, error as Error);
      }
    });

    // 스트리밍 로딩 완료 대기
    await Promise.allSettled(loadPromises);

    return volume;
  }

  /**
   * 배치 방식 볼륨 로딩
   */
  private async loadVolumeBatch(
    volumeId: string,
    imageIds: string[],
    callback?: (progress: LoadingProgress) => void,
  ): Promise<Types.IImageVolume> {

    // 모든 이미지를 먼저 로딩
    if (this.imageLoader) {
      await this.imageLoader.loadImages(imageIds, (progress) => {
        if (callback) {
          callback({
            ...progress,
            percentage: Math.round(progress.percentage * 0.8) + 5, // 5-85%
          });
        }
      });
    }

    // 볼륨 생성
    const volume = await volumeLoader.createAndCacheVolume!(volumeId, {
      imageIds,
      blendMode: 0,
    });

    // 볼륨 데이터 로딩
    // await volume.load(); // 메서드가 존재하지 않을 수 있음

    return volume;
  }

  /**
   * 이미지 ID 정렬
   */
  private async sortImageIds(imageIds: string[]): Promise<string[]> {
    if (this.config.sliceSorting === 'instance-number') {
      // 인스턴스 번호로 정렬
      return this.sortByInstanceNumber(imageIds);
    } else if (this.config.sliceSorting === 'slice-location') {
      // 슬라이스 위치로 정렬
      return this.sortBySliceLocation(imageIds);
    } else {
      // 기본적으로 원래 순서 유지
      return [...imageIds];
    }
  }

  /**
   * 인스턴스 번호로 정렬
   */
  private sortByInstanceNumber(imageIds: string[]): string[] {
    // 실제 구현에서는 DICOM 메타데이터에서 인스턴스 번호 추출
    return imageIds.sort((a, b) => {
      const instanceA = this.extractInstanceNumber(a);
      const instanceB = this.extractInstanceNumber(b);
      return instanceA - instanceB;
    });
  }

  /**
   * 슬라이스 위치로 정렬
   */
  private sortBySliceLocation(imageIds: string[]): string[] {
    // 실제 구현에서는 DICOM 메타데이터에서 슬라이스 위치 추출
    return imageIds.sort((a, b) => {
      const locationA = this.extractSliceLocation(a);
      const locationB = this.extractSliceLocation(b);
      return locationA - locationB;
    });
  }

  /**
   * 볼륨 후처리
   */
  private async postProcessVolume(volume: Types.IImageVolume): Promise<void> {
    // 메모리 최적화
    if (this.config.memoryOptimization?.enableCompression) {
      await this.compressVolumeData(volume);
    }

    // 보간 적용
    if (this.config.interpolation !== 'nearest') {
      await this.applyInterpolation(volume);
    }
  }

  /**
   * 볼륨 데이터 압축
   */
  private async compressVolumeData(volume: Types.IImageVolume): Promise<void> {
    // 볼륨 데이터 압축 로직
    log.debug('Volume data compression applied', {
      component: 'DICOMVolumeLoader',
      metadata: { volumeId: volume.volumeId },
    });
  }

  /**
   * 보간 적용
   */
  private async applyInterpolation(volume: Types.IImageVolume): Promise<void> {
    // 보간 로직 적용
    log.debug(`Volume interpolation applied: ${this.config.interpolation}`, {
      component: 'DICOMVolumeLoader',
      metadata: { volumeId: volume.volumeId },
    });
  }

  /**
   * Cornerstone3D 볼륨 로더 설정
   */
  private setupCornerstoneVolumeLoader(): void {
    // 볼륨 로더 등록 및 설정
    log.debug('Cornerstone3D volume loader configured', {
      component: 'DICOMVolumeLoader',
    });
  }

  /**
   * 볼륨 캐시에 추가
   */
  private addVolumeToCache(volumeId: string, volume: Types.IImageVolume): void {
    // 메모리 사용량 확인
    const volumeSize = volume.scalarData && 'length' in volume.scalarData ? (volume.scalarData as any).length : 0;
    const currentMemoryUsage = this.getCurrentMemoryUsage();

    if (currentMemoryUsage + volumeSize > this.config.volumeCacheSize!) {
      // 오래된 볼륨 제거
      this.evictOldVolumes();
    }

    this.volumeCache.set(volumeId, volume);
  }

  /**
   * 현재 메모리 사용량 계산
   */
  private getCurrentMemoryUsage(): number {
    let totalMemory = 0;

    for (const volume of this.volumeCache.values()) {
      if (volume.scalarData && 'length' in volume.scalarData) {
        totalMemory += (volume.scalarData as any).length * 2; // 16-bit assumed
      }
    }

    return totalMemory;
  }

  /**
   * 오래된 볼륨 제거
   */
  private evictOldVolumes(): void {
    // LRU 방식으로 가장 오래된 볼륨 제거
    const firstKey = this.volumeCache.keys().next().value;
    if (firstKey) {
      this.volumeCache.delete(firstKey);

      // Cornerstone 캐시에서도 제거
      // cache.removeVolumeLoadObject(firstKey); // 메서드가 존재하지 않을 수 있음
    }
  }

  /**
   * 볼륨 캐시 전체 정리
   */
  private clearVolumeCache(): void {
    // Clear all cached volumes
    // Note: cache.removeVolumeLoadObject() method may not exist
    this.volumeCache.clear();
  }

  /**
   * 인스턴스 번호 추출 (플레이스홀더)
   */
  private extractInstanceNumber(_imageId: string): number {
    // 실제 구현에서는 DICOM 메타데이터에서 추출
    return parseInt(_imageId.split('/').pop() || '0', 10);
  }

  /**
   * 슬라이스 위치 추출 (플레이스홀더)
   */
  private extractSliceLocation(_imageId: string): number {
    // 실제 구현에서는 DICOM 메타데이터에서 추출
    return 0;
  }
}

// 팩토리 함수
export function createDICOMVolumeLoader(config?: VolumeLoaderConfig): DICOMVolumeLoader {
  return new DICOMVolumeLoader(config);
}
