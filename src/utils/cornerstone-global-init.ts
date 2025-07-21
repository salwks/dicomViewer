import { 
  init as csRenderInit,
  imageLoader
} from '@cornerstonejs/core';
import { 
  init as csToolsInit,
  addTool,
  PanTool,
  ZoomTool,
  WindowLevelTool,
  StackScrollTool,
  LengthTool,
  RectangleROITool,
  EllipticalROITool,
  ArrowAnnotateTool,
  AngleTool,
  CobbAngleTool,
  ProbeTool,
  CircleROITool,
  BidirectionalTool,
  MagnifyTool,
  PlanarFreehandROITool,
  SplineROITool
} from '@cornerstonejs/tools';
import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';
import dicomParser from 'dicom-parser';
import { debugLogger } from './debug-logger';

// 전역 초기화 상태 관리
let isGloballyInitialized = false;
let initializationPromise: Promise<boolean> | null = null;

/**
 * Cornerstone3D 전역 초기화 (애플리케이션 당 한 번만 실행)
 * React의 Strict Mode나 컴포넌트 재마운트와 관계없이 단 한 번만 실행됩니다.
 */
export async function initializeCornerstoneGlobally(): Promise<boolean> {
  // 이미 초기화된 경우 즉시 반환
  if (isGloballyInitialized) {
    debugLogger.log('Cornerstone3D 이미 초기화됨 - 건너뜀');
    return true;
  }

  // 초기화가 진행 중인 경우 기존 Promise 반환
  if (initializationPromise) {
    debugLogger.log('Cornerstone3D 초기화 진행 중 - 대기');
    return initializationPromise;
  }

  // 새로운 초기화 시작
  initializationPromise = performGlobalInitialization();
  return initializationPromise;
}

async function performGlobalInitialization(): Promise<boolean> {
  try {
    debugLogger.log('🚀 Cornerstone3D 전역 초기화 시작');
    debugLogger.time('전역 초기화');

    // 1. Core 초기화
    debugLogger.log('📦 Cornerstone3D Core 초기화...');
    await csRenderInit();
    debugLogger.success('✅ Cornerstone3D Core 초기화 완료');

    // 2. Tools 초기화
    debugLogger.log('🔧 Cornerstone3D Tools 초기화...');
    await csToolsInit();
    debugLogger.success('✅ Cornerstone3D Tools 초기화 완료');

    // 3. DICOM Image Loader 설정
    debugLogger.log('🖼️ DICOM Image Loader 설정...');
    cornerstoneDICOMImageLoader.external.cornerstone = await import('@cornerstonejs/core');
    cornerstoneDICOMImageLoader.external.dicomParser = dicomParser;

    // 🔧 웹 워커 경로 명시적 설정 (핵심!)
    const webWorkerPath = '/workers/cornerstoneDICOMImageLoaderWebWorker.min.js';

    debugLogger.log('🔧 웹 워커 경로 설정', { 
      webWorkerPath,
      isDev: import.meta.env?.DEV 
    });

    // 이미지 로더 웹 워커 설정
    try {
      cornerstoneDICOMImageLoader.webWorkerManager.initialize({
        maxWebWorkers: navigator.hardwareConcurrency || 1,
        startWebWorkersOnDemand: true,
        taskConfiguration: {
          'decodeTask': {
            initializeCodecsInWorker: true,
            usePDFJS: false,
            strict: false
          }
        },
        webWorkerPath: webWorkerPath
      });
      debugLogger.success('✅ 웹 워커 매니저 초기화 완료');
    } catch (workerError) {
      debugLogger.warn('⚠️ 웹 워커 초기화 실패, 메인 스레드 사용', workerError);
    }

    // 이미지 로더 등록
    imageLoader.registerImageLoader('wadouri', cornerstoneDICOMImageLoader.wadouri.loadImage);
    imageLoader.registerImageLoader('wadors', cornerstoneDICOMImageLoader.wadors.loadImage);
    debugLogger.success('✅ DICOM Image Loader 설정 완료');

    // 4. 모든 도구 등록 (중복 등록 방지)
    debugLogger.log('🛠️ 도구 등록 시작...');
    
    const toolsToRegister = [
      // Basic Tools
      { tool: PanTool, name: 'Pan' },
      { tool: ZoomTool, name: 'Zoom' },
      { tool: WindowLevelTool, name: 'WindowLevel' },
      { tool: StackScrollTool, name: 'StackScroll' },
      { tool: MagnifyTool, name: 'Magnify' },
      
      // Measurement Tools
      { tool: LengthTool, name: 'Length' },
      { tool: AngleTool, name: 'Angle' },
      { tool: CobbAngleTool, name: 'CobbAngle' },
      { tool: BidirectionalTool, name: 'Bidirectional' },
      
      // ROI Tools
      { tool: RectangleROITool, name: 'RectangleROI' },
      { tool: EllipticalROITool, name: 'EllipticalROI' },
      { tool: CircleROITool, name: 'CircleROI' },
      
      // Advanced ROI Tools
      { tool: PlanarFreehandROITool, name: 'PlanarFreehandROI' },
      { tool: SplineROITool, name: 'SplineROI' },
      
      // Annotation Tools
      { tool: ArrowAnnotateTool, name: 'ArrowAnnotate' },
      { tool: ProbeTool, name: 'Probe' }
    ];

    for (const { tool, name } of toolsToRegister) {
      try {
        addTool(tool);
        debugLogger.success(`✅ ${name} 도구 등록 완료`);
      } catch (error) {
        // 이미 등록된 도구인 경우 경고만 출력하고 계속 진행
        if (error instanceof Error && error.message.includes('already been added')) {
          debugLogger.warn(`⚠️ ${name} 도구 이미 등록됨 - 건너뜀`);
        } else {
          debugLogger.error(`❌ ${name} 도구 등록 실패`, error);
          throw error;
        }
      }
    }

    debugLogger.success('✅ 모든 도구 등록 완료');

    // 초기화 완료
    debugLogger.timeEnd('전역 초기화');
    debugLogger.logMemoryUsage();
    
    isGloballyInitialized = true;
    debugLogger.success('🎉 Cornerstone3D 전역 초기화 최종 완료');
    
    return true;

  } catch (error) {
    debugLogger.timeEnd('전역 초기화');
    debugLogger.error('❌ Cornerstone3D 전역 초기화 실패', error);
    
    // 실패 시 상태 초기화하여 재시도 가능하게 함
    isGloballyInitialized = false;
    initializationPromise = null;
    
    throw error;
  }
}

/**
 * 초기화 상태 확인
 */
export function isCornerstoneInitialized(): boolean {
  return isGloballyInitialized;
}

/**
 * 초기화 상태 리셋 (테스트용)
 */
export function resetInitializationState(): void {
  isGloballyInitialized = false;
  initializationPromise = null;
  debugLogger.warn('🔄 Cornerstone3D 초기화 상태 리셋됨');
}

// 개발자 도구에서 접근 가능하도록 전역에 등록
if (typeof window !== 'undefined') {
  (window as any).cornerstoneGlobalInit = {
    isInitialized: isCornerstoneInitialized,
    reset: resetInitializationState,
    initialize: initializeCornerstoneGlobally
  };
}