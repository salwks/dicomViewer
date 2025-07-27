/**
 * DICOM 메타데이터 추출기
 * DICOM 이미지에서 메타데이터 추출과 파싱 담당
 */

// import { metaData } from '@cornerstonejs/core'; // 메타데이터 API가 다를 수 있음
import {
  DICOMMetadata,
  IMetadataExtractor,
} from '../interfaces/DICOMTypes';
import { log } from '../../../utils/logger';

export interface MetadataExtractionOptions {
  /** Include patient information */
  includePatientInfo?: boolean;
  /** Include study information */
  includeStudyInfo?: boolean;
  /** Include series information */
  includeSeriesInfo?: boolean;
  /** Include image information */
  includeImageInfo?: boolean;
  /** Include private tags */
  includePrivateTags?: boolean;
  /** Anonymize sensitive data */
  anonymize?: boolean;
}

export interface MetadataCache {
  /** Cache TTL in milliseconds */
  ttl?: number;
  /** Maximum cache size */
  maxSize?: number;
  /** Enable cache compression */
  enableCompression?: boolean;
}

/**
 * DICOM 메타데이터 추출기
 */
export class MetadataExtractor implements IMetadataExtractor {
  private metadataCache: Map<string, { data: DICOMMetadata; timestamp: number }> = new Map();
  private cacheConfig: MetadataCache = {
    ttl: 30 * 60 * 1000, // 30분
    maxSize: 1000,
    enableCompression: false,
  };

  private extractionOptions: MetadataExtractionOptions = {
    includePatientInfo: true,
    includeStudyInfo: true,
    includeSeriesInfo: true,
    includeImageInfo: true,
    includePrivateTags: false,
    anonymize: false,
  };

  constructor(
    extractionOptions?: MetadataExtractionOptions,
    cacheConfig?: MetadataCache,
  ) {
    if (extractionOptions) {
      this.extractionOptions = { ...this.extractionOptions, ...extractionOptions };
    }

    if (cacheConfig) {
      this.cacheConfig = { ...this.cacheConfig, ...cacheConfig };
    }

    log.info('Metadata Extractor initialized', {
      component: 'MetadataExtractor',
      metadata: {
        extractionOptions: this.extractionOptions,
        cacheConfig: this.cacheConfig,
      },
    });
  }

  /**
   * 단일 이미지 메타데이터 추출
   */
  async extractMetadata(imageId: string): Promise<DICOMMetadata> {
    // 캐시에서 확인
    const cached = this.getFromCache(imageId);
    if (cached) {
      log.debug('Metadata loaded from cache', {
        component: 'MetadataExtractor',
        metadata: { imageId },
      });
      return cached;
    }

    try {
      const metadata = await this.performMetadataExtraction(imageId);

      // 캐시에 저장
      this.addToCache(imageId, metadata);

      return metadata;

    } catch (error) {
      log.error('Failed to extract metadata', {
        component: 'MetadataExtractor',
        metadata: { imageId },
      }, error as Error);

      throw new Error(`Metadata extraction failed: ${(error as Error).message}`);
    }
  }

  /**
   * 배치 메타데이터 추출
   */
  async extractMetadataBatch(imageIds: string[]): Promise<DICOMMetadata[]> {
    const results: DICOMMetadata[] = [];
    const uncachedIds: string[] = [];

    // 캐시된 데이터 먼저 수집
    for (const imageId of imageIds) {
      const cached = this.getFromCache(imageId);
      if (cached) {
        results.push(cached);
      } else {
        uncachedIds.push(imageId);
      }
    }

    log.info(`Batch metadata extraction: ${uncachedIds.length} uncached of ${imageIds.length} total`, {
      component: 'MetadataExtractor',
      metadata: { totalImages: imageIds.length, uncachedImages: uncachedIds.length },
    });

    // 캐시되지 않은 데이터 처리
    if (uncachedIds.length > 0) {
      const extractionPromises = uncachedIds.map(async (imageId) => {
        try {
          return await this.extractMetadata(imageId);
        } catch (error) {
          log.warn(`Failed to extract metadata for ${imageId}`, {
            component: 'MetadataExtractor',
          }, error as Error);

          // 기본 메타데이터 반환
          return this.createEmptyMetadata(imageId);
        }
      });

      const extractedMetadata = await Promise.all(extractionPromises);
      results.push(...extractedMetadata);
    }

    return results;
  }

  /**
   * 메타데이터 익명화
   */
  anonymizeMetadata(metadata: DICOMMetadata): DICOMMetadata {
    const anonymized = { ...metadata };

    if (anonymized.patient) {
      anonymized.patient = {
        id: this.anonymizeString(anonymized.patient.id),
        name: this.anonymizeString(anonymized.patient.name),
        birthDate: this.anonymizeDate(anonymized.patient.birthDate),
        sex: anonymized.patient.sex, // 성별은 유지
      };
    }

    if (anonymized.study) {
      anonymized.study = {
        ...anonymized.study,
        id: this.anonymizeString(anonymized.study.id),
        description: this.anonymizeString(anonymized.study.description),
      };
    }

    log.debug('Metadata anonymized', {
      component: 'MetadataExtractor',
      metadata: { sopInstanceUID: metadata.sopInstanceUID },
    });

    return anonymized;
  }

  /**
   * 캐시 통계
   */
  getCacheStats(): { size: number; hitRate: number; memoryUsage: number } {
    const currentTime = Date.now();
    let validEntries = 0;

    for (const [, entry] of this.metadataCache) {
      if (currentTime - entry.timestamp < this.cacheConfig.ttl!) {
        validEntries++;
      }
    }

    return {
      size: validEntries,
      hitRate: 0, // 실제 구현에서는 히트율 계산
      memoryUsage: this.calculateCacheMemoryUsage(),
    };
  }

  /**
   * 캐시 정리
   */
  clearCache(): void {
    this.metadataCache.clear();

    log.info('Metadata cache cleared', {
      component: 'MetadataExtractor',
    });
  }

  /**
   * 실제 메타데이터 추출 수행
   */
  private async performMetadataExtraction(imageId: string): Promise<DICOMMetadata> {
    // Cornerstone3D에서 메타데이터 가져오기 (실제 구현에서는 적절한 API 사용)
    const dicomMetadata = {} as any; // 플레이스홀더

    if (!dicomMetadata) {
      throw new Error(`No metadata available for image: ${imageId}`);
    }

    // 기본 메타데이터 추출
    const metadata: DICOMMetadata = {
      studyInstanceUID: this.extractTag(dicomMetadata, '0020000D') || '',
      seriesInstanceUID: this.extractTag(dicomMetadata, '0020000E') || '',
      sopInstanceUID: this.extractTag(dicomMetadata, '00080018') || '',
      sopClassUID: this.extractTag(dicomMetadata, '00080016') || '',
    };

    // 환자 정보 추출
    if (this.extractionOptions.includePatientInfo) {
      metadata.patient = {
        id: this.extractTag(dicomMetadata, '00100020'),
        name: this.extractTag(dicomMetadata, '00100010'),
        birthDate: this.extractTag(dicomMetadata, '00100030'),
        sex: this.extractTag(dicomMetadata, '00100040'),
      };
    }

    // 스터디 정보 추출
    if (this.extractionOptions.includeStudyInfo) {
      metadata.study = {
        date: this.extractTag(dicomMetadata, '00080020'),
        time: this.extractTag(dicomMetadata, '00080030'),
        description: this.extractTag(dicomMetadata, '00081030'),
        id: this.extractTag(dicomMetadata, '00200010'),
      };
    }

    // 시리즈 정보 추출
    if (this.extractionOptions.includeSeriesInfo) {
      metadata.series = {
        date: this.extractTag(dicomMetadata, '00080021'),
        time: this.extractTag(dicomMetadata, '00080031'),
        description: this.extractTag(dicomMetadata, '0008103E'),
        number: this.extractTag(dicomMetadata, '00200011'),
        modality: this.extractTag(dicomMetadata, '00080060'),
      };
    }

    // 이미지 정보 추출
    if (this.extractionOptions.includeImageInfo) {
      metadata.image = {
        rows: this.extractNumberTag(dicomMetadata, '00280010'),
        columns: this.extractNumberTag(dicomMetadata, '00280011'),
        bitsAllocated: this.extractNumberTag(dicomMetadata, '00280100'),
        pixelSpacing: this.extractArrayTag(dicomMetadata, '00280030'),
        sliceThickness: this.extractNumberTag(dicomMetadata, '00180050'),
        instanceNumber: this.extractTag(dicomMetadata, '00200013'),
      };
    }

    // 익명화 적용
    if (this.extractionOptions.anonymize) {
      return this.anonymizeMetadata(metadata);
    }

    log.debug('Metadata extracted successfully', {
      component: 'MetadataExtractor',
      metadata: {
        imageId,
        sopInstanceUID: metadata.sopInstanceUID,
        modality: metadata.series?.modality,
      },
    });

    return metadata;
  }

  /**
   * DICOM 태그 값 추출
   */
  private extractTag(metadata: any, tag: string): string | undefined {
    try {
      // DICOM 태그 형식에 따라 값 추출
      // eslint-disable-next-line security/detect-object-injection
      const value = metadata[tag];

      if (value === null || value === undefined) {
        return undefined;
      }

      // 배열인 경우 첫 번째 값 반환
      if (Array.isArray(value)) {
        return value[0]?.toString();
      }

      return value.toString();

    } catch {
      log.debug(`Failed to extract tag ${tag}`, {
        component: 'MetadataExtractor',
      });
      return undefined;
    }
  }

  /**
   * 숫자 태그 값 추출
   */
  private extractNumberTag(metadata: any, tag: string): number | undefined {
    const value = this.extractTag(metadata, tag);

    if (value === undefined) {
      return undefined;
    }

    const numValue = parseFloat(value);
    return isNaN(numValue) ? undefined : numValue;
  }

  /**
   * 배열 태그 값 추출
   */
  private extractArrayTag(metadata: any, tag: string): number[] | undefined {
    try {
      // eslint-disable-next-line security/detect-object-injection
      const value = metadata[tag];

      if (!value) {
        return undefined;
      }

      if (Array.isArray(value)) {
        return value.map((v: any) => parseFloat(v)).filter((v: number) => !isNaN(v));
      }

      // 문자열인 경우 구분자로 분리
      const stringValue = value.toString();
      if (stringValue.includes('\\')) {
        return stringValue.split('\\').map((v: string) => parseFloat(v)).filter((v: number) => !isNaN(v));
      }

      const numValue = parseFloat(stringValue);
      return isNaN(numValue) ? undefined : [numValue];

    } catch {
      log.debug(`Failed to extract array tag ${tag}`, {
        component: 'MetadataExtractor',
      });
      return undefined;
    }
  }

  /**
   * 캐시에서 메타데이터 가져오기
   */
  private getFromCache(imageId: string): DICOMMetadata | null {
    const entry = this.metadataCache.get(imageId);

    if (!entry) {
      return null;
    }

    // TTL 확인
    if (Date.now() - entry.timestamp > this.cacheConfig.ttl!) {
      this.metadataCache.delete(imageId);
      return null;
    }

    return entry.data;
  }

  /**
   * 캐시에 메타데이터 추가
   */
  private addToCache(imageId: string, metadata: DICOMMetadata): void {
    // 캐시 크기 제한 확인
    if (this.metadataCache.size >= this.cacheConfig.maxSize!) {
      this.evictFromCache();
    }

    this.metadataCache.set(imageId, {
      data: metadata,
      timestamp: Date.now(),
    });
  }

  /**
   * 캐시에서 오래된 항목 제거
   */
  private evictFromCache(): void {
    const currentTime = Date.now();
    let oldestKey: string | null = null;
    let oldestTime = currentTime;

    // 만료된 항목 먼저 제거
    for (const [key, entry] of this.metadataCache) {
      if (currentTime - entry.timestamp > this.cacheConfig.ttl!) {
        this.metadataCache.delete(key);
      } else if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    // 여전히 크기가 초과하면 가장 오래된 항목 제거
    if (this.metadataCache.size >= this.cacheConfig.maxSize! && oldestKey) {
      this.metadataCache.delete(oldestKey);
    }
  }

  /**
   * 캐시 메모리 사용량 계산
   */
  private calculateCacheMemoryUsage(): number {
    // 추정치: 각 메타데이터 객체당 약 1KB
    return this.metadataCache.size * 1024;
  }

  /**
   * 빈 메타데이터 생성
   */
  private createEmptyMetadata(imageId: string): DICOMMetadata {
    return {
      studyInstanceUID: '',
      seriesInstanceUID: '',
      sopInstanceUID: imageId,
      sopClassUID: '',
    };
  }

  /**
   * 문자열 익명화
   */
  private anonymizeString(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }

    // 간단한 익명화: 첫 글자와 길이만 유지
    const firstChar = value.charAt(0);
    const length = value.length;
    return `${firstChar}${'*'.repeat(Math.max(0, length - 1))}`;
  }

  /**
   * 날짜 익명화
   */
  private anonymizeDate(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }

    // 년도만 유지하고 월/일은 01/01로 변경
    if (value.length >= 4) {
      return `${value.substring(0, 4)}0101`;
    }

    return '19000101';
  }
}

// 팩토리 함수
export function createMetadataExtractor(
  extractionOptions?: MetadataExtractionOptions,
  cacheConfig?: MetadataCache,
): MetadataExtractor {
  return new MetadataExtractor(extractionOptions, cacheConfig);
}
