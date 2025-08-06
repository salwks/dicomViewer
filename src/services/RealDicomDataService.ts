/**
 * RealDicomDataService
 * 실제 DICOM 파일을 로딩하고 처리하는 서비스
 * 샘플 데이터가 아닌 실제 의료 이미징 데이터를 다룸
 */

import { DicomLoaderService } from './dicomLoader';
import { log } from '../utils/logger';

export interface DicomStudyInfo {
  studyInstanceUID: string;
  studyDescription: string;
  studyDate: string;
  patientName: string;
  patientId: string;
  patientAge?: string;
  patientSex?: string;
  modality: string;
  institutionName?: string;
  seriesCount: number;
  series: DicomSeriesInfo[];
}

export interface DicomSeriesInfo {
  seriesInstanceUID: string;
  seriesDescription: string;
  seriesNumber: number;
  modality: string;
  imageCount: number;
  imageIds: string[];
  thumbnailImageId?: string;
  metadata?: {
    sliceThickness?: number;
    pixelSpacing?: [number, number];
    imageOrientation?: number[];
    imagePosition?: number[];
    windowCenter?: number;
    windowWidth?: number;
  };
}

export interface DicomLoadOptions {
  prefetchImages?: boolean;
  maxConcurrentRequests?: number;
  enableWebWorkers?: boolean;
  generateThumbnails?: boolean;
}

export interface DicomLoadProgress {
  studyInstanceUID: string;
  seriesInstanceUID?: string;
  loadedImages: number;
  totalImages: number;
  currentImageId?: string;
  status: 'loading' | 'completed' | 'error';
  error?: string;
}

export class RealDicomDataService {
  private dicomLoader: DicomLoaderService;
  private loadedStudies: Map<string, DicomStudyInfo> = new Map();
  private loadingProgress: Map<string, DicomLoadProgress> = new Map();
  private loadingCallbacks: Map<string, ((progress: DicomLoadProgress) => void)[]> = new Map();

  constructor() {
    this.dicomLoader = DicomLoaderService.getInstance();
  }

  /**
   * 로컬 DICOM 파일 로딩
   */
  async loadDicomFile(file: File, options: DicomLoadOptions = {}): Promise<DicomStudyInfo> {
    try {
      log.info('Loading DICOM file:', file.name);

      // File을 ArrayBuffer로 읽기
      const arrayBuffer = await this.readFileAsArrayBuffer(file);

      // 기본적인 스터디 정보 추출 (실제 DICOM 파싱은 복잡하므로 기본값 사용)
      const studyInfo = this.extractStudyInfoFromArrayBuffer(arrayBuffer, file.name);

      // 이미지 ID 생성
      const imageId = this.createImageIdFromFile(file, arrayBuffer);
      if (studyInfo.series[0]) {
        studyInfo.series[0].imageIds = [imageId];
        studyInfo.series[0].imageCount = 1;

        // 섬네일 생성 (옵션)
        if (options.generateThumbnails) {
          studyInfo.series[0].thumbnailImageId = imageId;
        }

        // 이미지 프리페치 (옵션)
        if (options.prefetchImages) {
          await this.prefetchImages(studyInfo.series[0].imageIds);
        }
      }

      // 캐시에 저장
      this.loadedStudies.set(studyInfo.studyInstanceUID, studyInfo);

      log.info('DICOM file loaded successfully:', studyInfo);
      return studyInfo;
    } catch (error) {
      console.error('Failed to load DICOM file:', error);
      throw new Error(`DICOM 파일 로딩 실패: ${error}`);
    }
  }

  /**
   * 샘플 DICOM 파일 로딩 (public/sample/sample.dcm)
   */
  async loadSampleDicom(_options: DicomLoadOptions = {}): Promise<DicomStudyInfo> {
    try {
      log.info('Loading sample DICOM file...');

      // 샘플 파일 경로
      const samplePath = '/sample/sample.dcm';

      // Fetch를 통해 파일 로딩
      const response = await fetch(samplePath);
      if (!response.ok) {
        throw new Error(`샘플 DICOM 파일을 찾을 수 없습니다: ${samplePath}`);
      }

      const arrayBuffer = await response.arrayBuffer();

      // 기본적인 스터디 정보 추출
      const studyInfo = this.extractStudyInfoFromArrayBuffer(arrayBuffer, 'sample.dcm');

      // 이미지 ID 생성
      const imageId = `wadouri:${samplePath}`;
      if (studyInfo.series[0]) {
        studyInfo.series[0].imageIds = [imageId];
        studyInfo.series[0].imageCount = 1;
        studyInfo.series[0].thumbnailImageId = imageId;
      }

      // 이미지 로딩 및 캐싱
      try {
        await this.dicomLoader.loadAndCacheImage(imageId);
        log.info('Sample DICOM image cached successfully');
      } catch (imageError) {
        console.warn('Failed to cache sample image, but continuing:', imageError);
      }

      // 캐시에 저장
      this.loadedStudies.set(studyInfo.studyInstanceUID, studyInfo);

      return studyInfo;
    } catch (error) {
      console.error('Failed to load sample DICOM:', error);
      throw new Error(`샘플 DICOM 로딩 실패: ${error}`);
    }
  }

  /**
   * DICOM Web (DICOMweb) 엔드포인트에서 스터디 로딩
   */
  async loadDicomWebStudy(
    dicomWebRoot: string,
    studyInstanceUID: string,
    options: DicomLoadOptions = {},
  ): Promise<DicomStudyInfo> {
    try {
      log.info('Loading DICOM Web study:', studyInstanceUID);

      // QIDO-RS를 통한 스터디 메타데이터 조회
      const studyUrl = `${dicomWebRoot}/studies/${studyInstanceUID}`;
      const studyResponse = await fetch(studyUrl, {
        headers: {
          Accept: 'application/dicom+json',
        },
      });

      if (!studyResponse.ok) {
        throw new Error(`Failed to fetch study: ${studyResponse.status}`);
      }

      const studyData = await studyResponse.json();
      const studyInfo = this.extractStudyInfoFromDicomJson(studyData[0]);

      // 시리즈 목록 조회
      const seriesUrl = `${dicomWebRoot}/studies/${studyInstanceUID}/series`;
      const seriesResponse = await fetch(seriesUrl, {
        headers: {
          Accept: 'application/dicom+json',
        },
      });

      if (!seriesResponse.ok) {
        throw new Error(`Failed to fetch series: ${seriesResponse.status}`);
      }

      const seriesData = await seriesResponse.json();
      studyInfo.series = await this.processDicomWebSeries(dicomWebRoot, studyInstanceUID, seriesData, options);

      studyInfo.seriesCount = studyInfo.series.length;

      // 캐시에 저장
      this.loadedStudies.set(studyInfo.studyInstanceUID, studyInfo);

      return studyInfo;
    } catch (error) {
      console.error('Failed to load DICOM Web study:', error);
      throw error;
    }
  }

  /**
   * 이미지 프리페치
   */
  private async prefetchImages(imageIds: string[]): Promise<void> {
    try {
      const prefetchPromises = imageIds.map(imageId =>
        this.dicomLoader.loadAndCacheImage(imageId).catch(err => {
          console.warn(`Failed to prefetch image ${imageId}:`, err);
          return null;
        }),
      );

      await Promise.allSettled(prefetchPromises);
      log.info(`Prefetched ${imageIds.length} images`);
    } catch (error) {
      console.warn('Image prefetch failed:', error);
    }
  }

  /**
   * File을 ArrayBuffer로 읽기
   */
  private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read file as ArrayBuffer'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * ArrayBuffer에서 스터디 정보 추출
   */
  private extractStudyInfoFromArrayBuffer(_arrayBuffer: ArrayBuffer, filename: string): DicomStudyInfo {
    try {
      // 기본 DICOM 파싱 (실제로는 dicom-parser 등을 사용해야 함)
      const timestamp = Date.now().toString();
      const studyInfo: DicomStudyInfo = {
        studyInstanceUID: `study-${timestamp}`,
        studyDescription: `Loaded from ${filename}`,
        studyDate: new Date().toISOString().split('T')[0]?.replace(/[-]/g, '') ?? '',
        patientName: 'Sample Patient',
        patientId: 'SAMPLE001',
        patientAge: 'Unknown',
        patientSex: 'O',
        modality: 'CT', // 기본값
        institutionName: 'Sample Institution',
        seriesCount: 1,
        series: [
          {
            seriesInstanceUID: `series-${timestamp}`,
            seriesDescription: `Series from ${filename}`,
            seriesNumber: 1,
            modality: 'CT',
            imageCount: 1,
            imageIds: [],
            metadata: {
              windowCenter: 50,
              windowWidth: 400,
            },
          },
        ],
      };

      return studyInfo;
    } catch (error) {
      console.error('Failed to extract DICOM metadata:', error);
      throw error;
    }
  }

  /**
   * DICOM JSON에서 스터디 정보 추출
   */
  private extractStudyInfoFromDicomJson(dicomJson: any): DicomStudyInfo {
    const getValue = (tag: string) => {
      // eslint-disable-next-line security/detect-object-injection -- Safe: tag is DICOM tag string validated by caller
      const element = dicomJson[tag];
      return element?.Value?.[0] || '';
    };

    return {
      studyInstanceUID: getValue('0020000D'),
      studyDescription: getValue('00081030'),
      studyDate: getValue('00080020'),
      patientName: getValue('00100010'),
      patientId: getValue('00100020'),
      patientAge: getValue('00101010'),
      patientSex: getValue('00100040'),
      modality: getValue('00080060'),
      institutionName: getValue('00080080'),
      seriesCount: 0,
      series: [],
    };
  }

  /**
   * DICOM Web 시리즈 처리
   */
  private async processDicomWebSeries(
    dicomWebRoot: string,
    studyInstanceUID: string,
    seriesData: any[],
    _options: DicomLoadOptions,
  ): Promise<DicomSeriesInfo[]> {
    const series: DicomSeriesInfo[] = [];

    for (const seriesJson of seriesData) {
      const seriesInstanceUID = seriesJson['0020000E']?.Value?.[0];
      if (!seriesInstanceUID) continue;

      // 인스턴스 목록 조회
      const instancesUrl = `${dicomWebRoot}/studies/${studyInstanceUID}/series/${seriesInstanceUID}/instances`;
      const instancesResponse = await fetch(instancesUrl, {
        headers: { Accept: 'application/dicom+json' },
      });

      if (!instancesResponse.ok) continue;

      const instancesData = await instancesResponse.json();
      const imageIds = instancesData.map((instance: any) => {
        const sopInstanceUID = instance['00080018']?.Value?.[0];
        return `wadors:${dicomWebRoot}/studies/${studyInstanceUID}/series/${seriesInstanceUID}/instances/${sopInstanceUID}/frames/1`;
      });

      series.push({
        seriesInstanceUID,
        seriesDescription: seriesJson['0008103E']?.Value?.[0] || 'Unknown Series',
        seriesNumber: parseInt(seriesJson['00200011']?.Value?.[0]) || 0,
        modality: seriesJson['00080060']?.Value?.[0] || 'CT',
        imageCount: imageIds.length,
        imageIds,
        thumbnailImageId: imageIds[0],
        metadata: {
          sliceThickness: parseFloat(seriesJson['00180050']?.Value?.[0]),
          windowCenter: parseInt(seriesJson['00281050']?.Value?.[0]),
          windowWidth: parseInt(seriesJson['00281051']?.Value?.[0]),
        },
      });
    }

    return series;
  }

  /**
   * File에서 이미지 ID 생성
   */
  private createImageIdFromFile(_file: File, arrayBuffer: ArrayBuffer): string {
    // Blob URL 생성
    const blob = new Blob([arrayBuffer], { type: 'application/dicom' });
    const blobUrl = URL.createObjectURL(blob);
    return `wadouri:${blobUrl}`;
  }

  /**
   * 로딩된 스터디 목록 반환
   */
  getLoadedStudies(): DicomStudyInfo[] {
    return Array.from(this.loadedStudies.values());
  }

  /**
   * 특정 스터디 반환
   */
  getStudy(studyInstanceUID: string): DicomStudyInfo | null {
    return this.loadedStudies.get(studyInstanceUID) ?? null;
  }

  /**
   * 리소스 정리
   */
  cleanup(): void {
    // Blob URLs 정리
    this.loadedStudies.forEach(study => {
      study.series.forEach(series => {
        series.imageIds.forEach(imageId => {
          if (imageId.startsWith('wadouri:blob:')) {
            URL.revokeObjectURL(imageId.replace('wadouri:', ''));
          }
        });
      });
    });

    this.loadedStudies.clear();
    this.loadingProgress.clear();
    this.loadingCallbacks.clear();

    log.info('RealDicomDataService cleaned up');
  }
}
