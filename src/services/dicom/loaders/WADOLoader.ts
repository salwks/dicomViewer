/**
 * WADO 프로토콜 로더
 * WADO-URI와 WADO-RS 프로토콜을 통한 DICOM 이미지 로딩 전용
 */

import {
  DICOMLoaderConfig,
  IDICOMLoader,
  LoadingProgress,
  LoadingStage,
  ImageLoadingResult,
} from '../interfaces/DICOMTypes';
import { log } from '../../../utils/logger';

export interface WADOConfig {
  /** WADO-URI endpoint */
  wadoUriEndpoint?: string;
  /** WADO-RS endpoint */
  wadoRsEndpoint?: string;
  /** Authentication token */
  authToken?: string;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Request timeout */
  timeout?: number;
}

export interface WADOImageId {
  /** Protocol type */
  protocol: 'wado-uri' | 'wado-rs';
  /** Study Instance UID */
  studyInstanceUID: string;
  /** Series Instance UID */
  seriesInstanceUID: string;
  /** SOP Instance UID */
  sopInstanceUID: string;
  /** Additional parameters */
  params?: Record<string, string>;
}

/**
 * WADO 프로토콜 전용 로더
 */
export class WADOLoader implements IDICOMLoader {
  private config: WADOConfig = {};
  private initialized = false;
  private requestQueue: Map<string, Promise<any>> = new Map();

  constructor(config?: WADOConfig) {
    if (config) {
      this.config = { ...config };
    }

    log.info('WADO Loader initialized', {
      component: 'WADOLoader',
      metadata: {
        hasWadoUri: !!this.config.wadoUriEndpoint,
        hasWadoRs: !!this.config.wadoRsEndpoint,
      },
    });
  }

  async initialize(): Promise<void> {
    try {
      // WADO 엔드포인트 검증
      await this.validateEndpoints();

      this.initialized = true;

      log.info('WADO Loader initialized successfully', {
        component: 'WADOLoader',
      });
    } catch (error) {
      log.error('Failed to initialize WADO Loader', {
        component: 'WADOLoader',
      }, error as Error);
      throw error;
    }
  }

  async configure(config: Partial<DICOMLoaderConfig>): Promise<void> {
    // WADO 관련 설정만 추출
    const wadoConfig: WADOConfig = {};

    if (config.wadoUriEndpoint) {
      wadoConfig.wadoUriEndpoint = config.wadoUriEndpoint;
    }

    if (config.wadoRsEndpoint) {
      wadoConfig.wadoRsEndpoint = config.wadoRsEndpoint;
    }

    if (config.requestTimeout) {
      wadoConfig.timeout = config.requestTimeout;
    }

    this.config = { ...this.config, ...wadoConfig };

    log.info('WADO Loader configuration updated', {
      component: 'WADOLoader',
      metadata: { config: wadoConfig },
    });
  }

  async cleanup(): Promise<void> {
    // 진행 중인 요청들 취소
    for (const [imageId] of this.requestQueue) {
      try {
        // Promise 취소 시도 (AbortController 사용 시)
        log.debug(`Cancelling request for ${imageId}`, {
          component: 'WADOLoader',
        });
      } catch (error) {
        log.warn(`Failed to cancel request for ${imageId}`, {
          component: 'WADOLoader',
        }, error as Error);
      }
    }

    this.requestQueue.clear();
    this.initialized = false;

    log.info('WADO Loader cleaned up', {
      component: 'WADOLoader',
    });
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * WADO-URI를 통한 이미지 로딩
   */
  async loadImageViaWadoUri(wadoImageId: WADOImageId): Promise<ImageLoadingResult> {
    if (!this.config.wadoUriEndpoint) {
      throw new Error('WADO-URI endpoint not configured');
    }

    const startTime = Date.now();

    try {
      const url = this.buildWadoUriUrl(wadoImageId);
      const imageId = this.createImageId(wadoImageId);

      // 중복 요청 방지
      if (this.requestQueue.has(imageId)) {
        return await this.requestQueue.get(imageId)!;
      }

      const loadPromise = this.fetchImage(url, imageId);
      this.requestQueue.set(imageId, loadPromise);

      const result = await loadPromise;
      this.requestQueue.delete(imageId);

      return {
        image: result,
        loadingTime: Date.now() - startTime,
        success: true,
      };

    } catch (error) {
      const loadingTime = Date.now() - startTime;

      log.error('WADO-URI image loading failed', {
        component: 'WADOLoader',
        metadata: { wadoImageId, loadingTime },
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
   * WADO-RS를 통한 이미지 로딩
   */
  async loadImageViaWadoRs(wadoImageId: WADOImageId): Promise<ImageLoadingResult> {
    if (!this.config.wadoRsEndpoint) {
      throw new Error('WADO-RS endpoint not configured');
    }

    const startTime = Date.now();

    try {
      const url = this.buildWadoRsUrl(wadoImageId);
      const imageId = this.createImageId(wadoImageId);

      // 중복 요청 방지
      if (this.requestQueue.has(imageId)) {
        return await this.requestQueue.get(imageId)!;
      }

      const loadPromise = this.fetchImage(url, imageId);
      this.requestQueue.set(imageId, loadPromise);

      const result = await loadPromise;
      this.requestQueue.delete(imageId);

      return {
        image: result,
        loadingTime: Date.now() - startTime,
        success: true,
      };

    } catch (error) {
      const loadingTime = Date.now() - startTime;

      log.error('WADO-RS image loading failed', {
        component: 'WADOLoader',
        metadata: { wadoImageId, loadingTime },
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
   * 이미지 배치 로딩
   */
  async loadImageBatch(
    wadoImageIds: WADOImageId[],
    callback?: (progress: LoadingProgress) => void,
  ): Promise<ImageLoadingResult[]> {
    const results: ImageLoadingResult[] = [];
    const total = wadoImageIds.length;

    for (let i = 0; i < wadoImageIds.length; i++) {
      // eslint-disable-next-line security/detect-object-injection
      const wadoImageId = wadoImageIds[i];

      try {
        const result = wadoImageId.protocol === 'wado-uri'
          ? await this.loadImageViaWadoUri(wadoImageId)
          : await this.loadImageViaWadoRs(wadoImageId);

        results.push(result);

        // 진행 상황 콜백
        if (callback) {
          callback({
            stage: LoadingStage.LOADING_IMAGES,
            percentage: Math.round((i + 1) / total * 100),
            imagesLoaded: i + 1,
            totalImages: total,
          });
        }

      } catch (error) {
        log.error(`Failed to load image ${i}`, {
          component: 'WADOLoader',
          metadata: { wadoImageId },
        }, error as Error);

        results.push({
          image: null as any,
          loadingTime: 0,
          success: false,
          error: (error as Error).message,
        });
      }
    }

    return results;
  }

  /**
   * WADO-URI URL 생성
   */
  private buildWadoUriUrl(wadoImageId: WADOImageId): string {
    const params = new URLSearchParams({
      requestType: 'WADO',
      studyUID: wadoImageId.studyInstanceUID,
      seriesUID: wadoImageId.seriesInstanceUID,
      objectUID: wadoImageId.sopInstanceUID,
      contentType: 'application/dicom',
      ...(wadoImageId.params || {}),
    });

    return `${this.config.wadoUriEndpoint}?${params.toString()}`;
  }

  /**
   * WADO-RS URL 생성
   */
  private buildWadoRsUrl(wadoImageId: WADOImageId): string {
    const { studyInstanceUID, seriesInstanceUID, sopInstanceUID } = wadoImageId;
    return `${this.config.wadoRsEndpoint}/studies/${studyInstanceUID}/series/${seriesInstanceUID}/instances/${sopInstanceUID}`;
  }

  /**
   * 이미지 ID 생성
   */
  private createImageId(wadoImageId: WADOImageId): string {
    return `${wadoImageId.protocol}:${wadoImageId.studyInstanceUID}/${wadoImageId.seriesInstanceUID}/${wadoImageId.sopInstanceUID}`;
  }

  /**
   * 실제 이미지 페치
   */
  private async fetchImage(url: string, imageId: string): Promise<any> {
    const headers: Record<string, string> = {
      'Accept': 'application/dicom',
      ...this.config.headers,
    };

    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(this.config.timeout || 30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // DICOM 이미지 데이터 처리
    const arrayBuffer = await response.arrayBuffer();

    // 여기서 Cornerstone3D 이미지 객체로 변환
    // 실제 구현에서는 cornerstone3D의 imageLoader를 사용
    return this.convertToImage(arrayBuffer, imageId);
  }

  /**
   * ArrayBuffer를 Cornerstone 이미지로 변환
   */
  private async convertToImage(arrayBuffer: ArrayBuffer, imageId: string): Promise<any> {
    // 실제 구현에서는 cornerstone3D의 이미지 변환 로직 사용
    // 여기서는 플레이스홀더
    return {
      imageId,
      minPixelValue: 0,
      maxPixelValue: 255,
      slope: 1,
      intercept: 0,
      windowCenter: 128,
      windowWidth: 256,
      getPixelData: () => new Uint8Array(arrayBuffer),
      rows: 512,
      columns: 512,
      color: false,
      columnPixelSpacing: 1,
      rowPixelSpacing: 1,
      sizeInBytes: arrayBuffer.byteLength,
    };
  }

  /**
   * 엔드포인트 유효성 검사
   */
  private async validateEndpoints(): Promise<void> {
    const validations: Promise<void>[] = [];

    if (this.config.wadoUriEndpoint) {
      validations.push(this.validateEndpoint(this.config.wadoUriEndpoint, 'WADO-URI'));
    }

    if (this.config.wadoRsEndpoint) {
      validations.push(this.validateEndpoint(this.config.wadoRsEndpoint, 'WADO-RS'));
    }

    if (validations.length === 0) {
      throw new Error('No WADO endpoints configured');
    }

    await Promise.all(validations);
  }

  /**
   * 개별 엔드포인트 검증
   */
  private async validateEndpoint(endpoint: string, type: string): Promise<void> {
    try {
      const url = new URL(endpoint);

      // 기본적인 URL 유효성 검사
      if (!url.protocol.startsWith('http')) {
        throw new Error(`Invalid protocol for ${type}: ${url.protocol}`);
      }

      log.debug(`${type} endpoint validated`, {
        component: 'WADOLoader',
        metadata: { endpoint: url.origin },
      });

    } catch {
      throw new Error(`Invalid ${type} endpoint: ${endpoint}`);
    }
  }
}

// 팩토리 함수
export function createWADOLoader(config?: WADOConfig): WADOLoader {
  return new WADOLoader(config);
}
