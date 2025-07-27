/**
 * SOP 클래스 처리기
 * 다양한 DICOM SOP 클래스별 특화 처리 담당
 */

import { ISOPClassProcessor } from '../interfaces/DICOMTypes';
import { log } from '../../../utils/logger';

// 지원하는 SOP 클래스 UID 정의
export const SUPPORTED_SOP_CLASSES = {
  // Image Storage SOP Classes
  CT_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.2',
  MR_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.4',
  US_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.6.1',
  SECONDARY_CAPTURE_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.7',
  XA_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.12.1',
  RF_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.12.2',
  DX_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.1.1',
  CR_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.1',
  MAMMOGRAPHY_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.1.2',

  // Enhanced Image Storage
  ENHANCED_CT_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.2.1',
  ENHANCED_MR_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.4.1',
  ENHANCED_US_VOLUME_STORAGE: '1.2.840.10008.5.1.4.1.1.6.2',

  // Multi-frame Storage
  MULTIFRAME_GRAYSCALE_BYTE_SC_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.7.2',
  MULTIFRAME_GRAYSCALE_WORD_SC_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.7.3',
  MULTIFRAME_TRUE_COLOR_SC_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.7.4',

  // Presentation State Storage
  GRAYSCALE_SOFTCOPY_PRESENTATION_STATE_STORAGE: '1.2.840.10008.5.1.4.1.1.11.1',
  COLOR_SOFTCOPY_PRESENTATION_STATE_STORAGE: '1.2.840.10008.5.1.4.1.1.11.2',

  // Structured Report Storage
  BASIC_TEXT_SR_STORAGE: '1.2.840.10008.5.1.4.1.1.88.11',
  ENHANCED_SR_STORAGE: '1.2.840.10008.5.1.4.1.1.88.22',
  COMPREHENSIVE_SR_STORAGE: '1.2.840.10008.5.1.4.1.1.88.33',

  // Key Object Selection
  KEY_OBJECT_SELECTION_DOCUMENT_STORAGE: '1.2.840.10008.5.1.4.1.1.88.59',

  // Encapsulated Document Storage
  ENCAPSULATED_PDF_STORAGE: '1.2.840.10008.5.1.4.1.1.104.1',
  ENCAPSULATED_CDA_STORAGE: '1.2.840.10008.5.1.4.1.1.104.2',
} as const;

export type SOPClassUID = typeof SUPPORTED_SOP_CLASSES[keyof typeof SUPPORTED_SOP_CLASSES];

export interface SOPClassInfo {
  uid: string;
  name: string;
  category: 'image' | 'enhanced' | 'multiframe' | 'presentation' | 'structured-report' | 'document';
  description: string;
  processingStrategy: 'standard' | 'enhanced' | 'multiframe' | 'presentation' | 'structured-report';
}

export interface ProcessingResult {
  success: boolean;
  processedData?: any;
  metadata?: Record<string, any>;
  warnings?: string[];
  errors?: string[];
  processingTime: number;
}

export interface ProcessingOptions {
  /** Enable enhanced processing for supported SOP classes */
  enableEnhancedProcessing?: boolean;
  /** Extract additional metadata */
  extractMetadata?: boolean;
  /** Apply modality-specific optimizations */
  modalityOptimization?: boolean;
  /** Custom processing parameters */
  customParams?: Record<string, any>;
}

/**
 * SOP 클래스별 처리기
 */
export class SOPClassProcessor implements ISOPClassProcessor {
  private sopClassRegistry: Map<string, SOPClassInfo> = new Map();
  private processingOptions: ProcessingOptions = {
    enableEnhancedProcessing: true,
    extractMetadata: true,
    modalityOptimization: true,
    customParams: {},
  };

  constructor(options?: ProcessingOptions) {
    if (options) {
      this.processingOptions = { ...this.processingOptions, ...options };
    }

    this.initializeSOPClassRegistry();

    log.info('SOP Class Processor initialized', {
      component: 'SOPClassProcessor',
      metadata: {
        supportedClasses: this.sopClassRegistry.size,
        options: this.processingOptions,
      },
    });
  }

  /**
   * SOP 클래스 지원 여부 확인
   */
  isSupported(sopClassUID: string): boolean {
    return this.sopClassRegistry.has(sopClassUID);
  }

  /**
   * SOP 클래스별 처리
   */
  async process(imageId: string, sopClassUID: string): Promise<ProcessingResult> {
    const startTime = Date.now();

    if (!this.isSupported(sopClassUID)) {
      return {
        success: false,
        errors: [`Unsupported SOP Class: ${sopClassUID}`],
        processingTime: Date.now() - startTime,
      };
    }

    const sopClassInfo = this.sopClassRegistry.get(sopClassUID)!;

    try {
      log.debug(`Processing ${sopClassInfo.name}`, {
        component: 'SOPClassProcessor',
        metadata: { imageId, sopClassUID, strategy: sopClassInfo.processingStrategy },
      });

      const result = await this.processBasedOnStrategy(imageId, sopClassInfo);

      log.debug(`Processing completed for ${sopClassInfo.name}`, {
        component: 'SOPClassProcessor',
        metadata: {
          imageId,
          success: result.success,
          processingTime: result.processingTime,
        },
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;

      log.error(`Processing failed for ${sopClassInfo.name}`, {
        component: 'SOPClassProcessor',
        metadata: { imageId, sopClassUID },
      }, error as Error);

      return {
        success: false,
        errors: [(error as Error).message],
        processingTime,
      };
    }
  }

  /**
   * 지원하는 SOP 클래스 목록 반환
   */
  getSupportedSOPClasses(): SOPClassInfo[] {
    return Array.from(this.sopClassRegistry.values());
  }

  /**
   * SOP 클래스 정보 조회
   */
  getSOPClassInfo(sopClassUID: string): SOPClassInfo | undefined {
    return this.sopClassRegistry.get(sopClassUID);
  }

  /**
   * 카테고리별 SOP 클래스 조회
   */
  getSOPClassesByCategory(category: SOPClassInfo['category']): SOPClassInfo[] {
    return Array.from(this.sopClassRegistry.values())
      .filter(info => info.category === category);
  }

  /**
   * 전략별 처리 수행
   */
  private async processBasedOnStrategy(
    imageId: string,
    sopClassInfo: SOPClassInfo,
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    switch (sopClassInfo.processingStrategy) {
      case 'standard':
        return await this.processStandardImage(imageId, sopClassInfo);

      case 'enhanced':
        return await this.processEnhancedImage(imageId, sopClassInfo);

      case 'multiframe':
        return await this.processMultiframeImage(imageId, sopClassInfo);

      case 'presentation':
        return await this.processPresentationState(imageId, sopClassInfo);

      case 'structured-report':
        return await this.processStructuredReport(imageId, sopClassInfo);

      default:
        return {
          success: false,
          errors: [`Unknown processing strategy: ${sopClassInfo.processingStrategy}`],
          processingTime: Date.now() - startTime,
        };
    }
  }

  /**
   * 표준 이미지 처리
   */
  private async processStandardImage(
    imageId: string,
    sopClassInfo: SOPClassInfo,
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const metadata: Record<string, any> = {};

    try {
      // 기본 이미지 처리
      let processedData: any = {
        imageId,
        sopClassUID: sopClassInfo.uid,
        processingType: 'standard',
      };

      // 모달리티별 최적화
      if (this.processingOptions.modalityOptimization) {
        processedData = await this.applyModalityOptimization(processedData, sopClassInfo);
      }

      // 메타데이터 추출
      if (this.processingOptions.extractMetadata) {
        metadata.processingStrategy = 'standard';
        metadata.sopClass = sopClassInfo.name;
        metadata.category = sopClassInfo.category;
      }

      return {
        success: true,
        processedData,
        metadata,
        warnings,
        processingTime: Date.now() - startTime,
      };

    } catch (error) {
      return {
        success: false,
        errors: [(error as Error).message],
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 향상된 이미지 처리
   */
  private async processEnhancedImage(
    imageId: string,
    sopClassInfo: SOPClassInfo,
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      if (!this.processingOptions.enableEnhancedProcessing) {
        warnings.push('Enhanced processing disabled, falling back to standard processing');
        return await this.processStandardImage(imageId, sopClassInfo);
      }

      const processedData = {
        imageId,
        sopClassUID: sopClassInfo.uid,
        processingType: 'enhanced',
        enhancedFeatures: {
          functionalGroups: true,
          sharedFunctionalGroups: true,
          perFrameFunctionalGroups: true,
          dimensionOrganization: true,
        },
      };

      const metadata = {
        processingStrategy: 'enhanced',
        sopClass: sopClassInfo.name,
        enhancedCapabilities: Object.keys(processedData.enhancedFeatures),
      };

      return {
        success: true,
        processedData,
        metadata,
        warnings,
        processingTime: Date.now() - startTime,
      };

    } catch (error) {
      return {
        success: false,
        errors: [(error as Error).message],
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 멀티프레임 이미지 처리
   */
  private async processMultiframeImage(
    imageId: string,
    sopClassInfo: SOPClassInfo,
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      const processedData = {
        imageId,
        sopClassUID: sopClassInfo.uid,
        processingType: 'multiframe',
        frameHandling: {
          frameCount: 0, // 실제 구현에서는 메타데이터에서 추출
          frameOrdering: 'temporal',
          frameExtraction: true,
          frameOptimization: true,
        },
      };

      const metadata = {
        processingStrategy: 'multiframe',
        sopClass: sopClassInfo.name,
        frameCapabilities: Object.keys(processedData.frameHandling),
      };

      return {
        success: true,
        processedData,
        metadata,
        processingTime: Date.now() - startTime,
      };

    } catch (error) {
      return {
        success: false,
        errors: [(error as Error).message],
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 프레젠테이션 스테이트 처리
   */
  private async processPresentationState(
    imageId: string,
    sopClassInfo: SOPClassInfo,
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      const processedData = {
        imageId,
        sopClassUID: sopClassInfo.uid,
        processingType: 'presentation',
        presentationFeatures: {
          displayShutter: true,
          overlayActivation: true,
          voiLUT: true,
          presentationLUT: true,
          spatialTransformation: true,
        },
      };

      const metadata = {
        processingStrategy: 'presentation',
        sopClass: sopClassInfo.name,
        presentationCapabilities: Object.keys(processedData.presentationFeatures),
      };

      return {
        success: true,
        processedData,
        metadata,
        processingTime: Date.now() - startTime,
      };

    } catch (error) {
      return {
        success: false,
        errors: [(error as Error).message],
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 구조화 보고서 처리
   */
  private async processStructuredReport(
    imageId: string,
    sopClassInfo: SOPClassInfo,
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      const processedData = {
        imageId,
        sopClassUID: sopClassInfo.uid,
        processingType: 'structured-report',
        srFeatures: {
          documentTitle: '',
          contentSequence: [],
          conceptNameCodeSequence: {},
          templateIdentification: {},
          relationshipType: 'CONTAINS',
        },
      };

      const metadata = {
        processingStrategy: 'structured-report',
        sopClass: sopClassInfo.name,
        srType: this.getSRType(sopClassInfo.uid),
      };

      return {
        success: true,
        processedData,
        metadata,
        processingTime: Date.now() - startTime,
      };

    } catch (error) {
      return {
        success: false,
        errors: [(error as Error).message],
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 모달리티별 최적화 적용
   */
  private async applyModalityOptimization(
    processedData: any,
    sopClassInfo: SOPClassInfo,
  ): Promise<any> {
    const optimized = { ...processedData };

    // SOP 클래스에 따른 모달리티 추론
    const modality = this.inferModalityFromSOPClass(sopClassInfo.uid);

    switch (modality) {
      case 'CT':
        optimized.ctOptimizations = {
          windowLevel: { center: 50, width: 400 },
          reconstructionKernel: 'standard',
          sliceThickness: 'auto',
        };
        break;

      case 'MR':
        optimized.mrOptimizations = {
          sequenceType: 'auto-detect',
          contrastEnhancement: 'auto',
          fieldStrength: 'auto',
        };
        break;

      case 'US':
        optimized.usOptimizations = {
          doppler: 'auto-detect',
          gainCompensation: 'auto',
          dynamicRange: 'optimal',
        };
        break;

      default:
        optimized.genericOptimizations = {
          windowLevel: 'auto',
          contrast: 'auto',
        };
    }

    return optimized;
  }

  /**
   * SOP 클래스 레지스트리 초기화
   */
  private initializeSOPClassRegistry(): void {
    const sopClasses: SOPClassInfo[] = [
      // Standard Image Storage
      {
        uid: SUPPORTED_SOP_CLASSES.CT_IMAGE_STORAGE,
        name: 'CT Image Storage',
        category: 'image',
        description: 'Computed Tomography Image Storage',
        processingStrategy: 'standard',
      },
      {
        uid: SUPPORTED_SOP_CLASSES.MR_IMAGE_STORAGE,
        name: 'MR Image Storage',
        category: 'image',
        description: 'Magnetic Resonance Image Storage',
        processingStrategy: 'standard',
      },
      {
        uid: SUPPORTED_SOP_CLASSES.US_IMAGE_STORAGE,
        name: 'Ultrasound Image Storage',
        category: 'image',
        description: 'Ultrasound Image Storage',
        processingStrategy: 'standard',
      },

      // Enhanced Image Storage
      {
        uid: SUPPORTED_SOP_CLASSES.ENHANCED_CT_IMAGE_STORAGE,
        name: 'Enhanced CT Image Storage',
        category: 'enhanced',
        description: 'Enhanced CT Image Storage with Functional Groups',
        processingStrategy: 'enhanced',
      },
      {
        uid: SUPPORTED_SOP_CLASSES.ENHANCED_MR_IMAGE_STORAGE,
        name: 'Enhanced MR Image Storage',
        category: 'enhanced',
        description: 'Enhanced MR Image Storage with Functional Groups',
        processingStrategy: 'enhanced',
      },

      // Multiframe Storage
      {
        uid: SUPPORTED_SOP_CLASSES.MULTIFRAME_GRAYSCALE_BYTE_SC_IMAGE_STORAGE,
        name: 'Multiframe Grayscale Byte SC Image Storage',
        category: 'multiframe',
        description: 'Multiframe Grayscale Byte Secondary Capture Image Storage',
        processingStrategy: 'multiframe',
      },

      // Presentation State
      {
        uid: SUPPORTED_SOP_CLASSES.GRAYSCALE_SOFTCOPY_PRESENTATION_STATE_STORAGE,
        name: 'Grayscale Softcopy Presentation State Storage',
        category: 'presentation',
        description: 'Grayscale Softcopy Presentation State Storage',
        processingStrategy: 'presentation',
      },

      // Structured Report
      {
        uid: SUPPORTED_SOP_CLASSES.BASIC_TEXT_SR_STORAGE,
        name: 'Basic Text SR Storage',
        category: 'structured-report',
        description: 'Basic Text Structured Report Storage',
        processingStrategy: 'structured-report',
      },
    ];

    for (const sopClass of sopClasses) {
      this.sopClassRegistry.set(sopClass.uid, sopClass);
    }

    log.debug(`Initialized ${sopClasses.length} SOP class definitions`, {
      component: 'SOPClassProcessor',
    });
  }

  /**
   * SOP 클래스에서 모달리티 추론
   */
  private inferModalityFromSOPClass(sopClassUID: string): string {
    if (sopClassUID.includes('1.2.840.10008.5.1.4.1.1.2')) return 'CT';
    if (sopClassUID.includes('1.2.840.10008.5.1.4.1.1.4')) return 'MR';
    if (sopClassUID.includes('1.2.840.10008.5.1.4.1.1.6')) return 'US';
    if (sopClassUID.includes('1.2.840.10008.5.1.4.1.1.12')) return 'XA';
    if (sopClassUID.includes('1.2.840.10008.5.1.4.1.1.1')) return 'CR';

    return 'OT'; // Other
  }

  /**
   * SR 타입 결정
   */
  private getSRType(sopClassUID: string): string {
    switch (sopClassUID) {
      case SUPPORTED_SOP_CLASSES.BASIC_TEXT_SR_STORAGE:
        return 'Basic Text';
      case SUPPORTED_SOP_CLASSES.ENHANCED_SR_STORAGE:
        return 'Enhanced';
      case SUPPORTED_SOP_CLASSES.COMPREHENSIVE_SR_STORAGE:
        return 'Comprehensive';
      default:
        return 'Unknown';
    }
  }
}

// 팩토리 함수
export function createSOPClassProcessor(options?: ProcessingOptions): SOPClassProcessor {
  return new SOPClassProcessor(options);
}
