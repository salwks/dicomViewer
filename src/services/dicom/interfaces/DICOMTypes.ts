/**
 * DICOM 서비스 공통 타입 정의
 * 모든 DICOM 관련 서비스에서 사용되는 기본 타입들
 */

import { Types } from '@cornerstonejs/core';

/**
 * DICOM 로더 설정
 */
export interface DICOMLoaderConfig {
  /** Maximum number of concurrent requests */
  maxConcurrentRequests?: number;
  /** Request timeout in milliseconds */
  requestTimeout?: number;
  /** Enable progressive loading */
  enableProgressiveLoading?: boolean;
  /** Cache size in bytes */
  cacheSize?: number;
  /** WADO-URI endpoint */
  wadoUriEndpoint?: string;
  /** WADO-RS endpoint */
  wadoRsEndpoint?: string;
  /** Enable metadata extraction */
  enableMetadataExtraction?: boolean;
  /** Supported SOP classes */
  supportedSOPClasses?: string[];
}

/**
 * 로딩 진행 상황
 */
export interface LoadingProgress {
  /** Current loading stage */
  stage: LoadingStage;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Number of images loaded */
  imagesLoaded: number;
  /** Total number of images */
  totalImages: number;
  /** Current loading speed in images/sec */
  loadingSpeed?: number;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining?: number;
}

/**
 * 로딩 단계
 */
export enum LoadingStage {
  INITIALIZING = 'initializing',
  LOADING_METADATA = 'loading_metadata',
  LOADING_IMAGES = 'loading_images',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

/**
 * 로딩 우선순위
 */
export enum LoadingPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

/**
 * 볼륨 로딩 옵션
 */
export interface VolumeLoadingOptions {
  /** Volume ID */
  volumeId: string;
  /** Image IDs to load */
  imageIds: string[];
  /** Loading priority */
  priority?: LoadingPriority;
  /** Progress callback */
  callback?: (progress: LoadingProgress) => void;
}

/**
 * 이미지 로딩 결과
 */
export interface ImageLoadingResult {
  /** Loaded image */
  image: Types.IImage;
  /** Loading metadata */
  metadata?: Record<string, any>;
  /** Loading time in milliseconds */
  loadingTime: number;
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * 볼륨 로딩 결과
 */
export interface VolumeLoadingResult {
  /** Loaded volume */
  volume: Types.IImageVolume;
  /** Loading metadata */
  metadata?: Record<string, any>;
  /** Loading time in milliseconds */
  loadingTime: number;
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Number of images loaded */
  imagesLoaded: number;
}

/**
 * DICOM 메타데이터
 */
export interface DICOMMetadata {
  /** Study Instance UID */
  studyInstanceUID: string;
  /** Series Instance UID */
  seriesInstanceUID: string;
  /** SOP Instance UID */
  sopInstanceUID: string;
  /** SOP Class UID */
  sopClassUID: string;
  /** Patient information */
  patient?: {
    id?: string;
    name?: string;
    birthDate?: string;
    sex?: string;
  };
  /** Study information */
  study?: {
    date?: string;
    time?: string;
    description?: string;
    id?: string;
  };
  /** Series information */
  series?: {
    date?: string;
    time?: string;
    description?: string;
    number?: string;
    modality?: string;
  };
  /** Image information */
  image?: {
    rows?: number;
    columns?: number;
    bitsAllocated?: number;
    pixelSpacing?: number[];
    sliceThickness?: number;
    instanceNumber?: string;
  };
}

/**
 * 기본 DICOM 로더 인터페이스
 */
export interface IDICOMLoader {
  /** 로더 초기화 */
  initialize(): Promise<void>;

  /** 설정 업데이트 */
  configure(config: Partial<DICOMLoaderConfig>): Promise<void>;

  /** 로더 정리 */
  cleanup(): Promise<void>;

  /** 로더 상태 확인 */
  isInitialized(): boolean;
}

/**
 * 이미지 로더 인터페이스
 */
export interface IImageLoader extends IDICOMLoader {
  /** 단일 이미지 로드 */
  loadImage(imageId: string): Promise<ImageLoadingResult>;

  /** 다중 이미지 로드 */
  loadImages(imageIds: string[], callback?: (progress: LoadingProgress) => void): Promise<ImageLoadingResult[]>;
}

/**
 * 볼륨 로더 인터페이스
 */
export interface IVolumeLoader extends IDICOMLoader {
  /** 볼륨 로드 */
  loadVolume(options: VolumeLoadingOptions): Promise<VolumeLoadingResult>;
}

/**
 * 메타데이터 추출기 인터페이스
 */
export interface IMetadataExtractor {
  /** 메타데이터 추출 */
  extractMetadata(imageId: string): Promise<DICOMMetadata>;

  /** 배치 메타데이터 추출 */
  extractMetadataBatch(imageIds: string[]): Promise<DICOMMetadata[]>;
}

/**
 * SOP 클래스 처리기 인터페이스
 */
export interface ISOPClassProcessor {
  /** SOP 클래스 지원 여부 확인 */
  isSupported(sopClassUID: string): boolean;

  /** SOP 클래스별 처리 */
  process(imageId: string, sopClassUID: string): Promise<any>;
}
