import { useEffect, useRef, memo } from 'react';
import { 
  RenderingEngine, 
  Types,
  Enums,
  getRenderingEngine,
  eventTarget
} from '@cornerstonejs/core';
import { 
  ToolGroupManager,
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
  SplineROITool,
  annotation,
  Enums as ToolsEnums
} from '@cornerstonejs/tools';
import { debugLogger } from '../utils/debug-logger';
import { initializeCornerstoneGlobally } from '../utils/cornerstone-global-init';
import { useAnnotationStore, useViewportStore } from '../store';
import dicomParser from 'dicom-parser';
// 측정값 변환 import 제거 - 간단한 mm 변환만 사용

interface DicomViewportProps {
  viewportId?: string;
  renderingEngineId?: string;
  file?: File;
  onError: (error: string) => void;
  onSuccess: (message: string) => void;
  onDicomDataSet?: (fileName: string, dataSet: any) => void;
}

/**
 * 뷰포트만 담당하는 컴포넌트 - 한 번만 초기화됨
 * 이미지 로딩은 별도로 처리
 */
const DicomViewportComponent = ({ 
  viewportId = 'dicom-viewport', 
  renderingEngineId = 'dicom-rendering-engine',
  file,
  onError, 
  onSuccess,
  onDicomDataSet
}: DicomViewportProps) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const renderingEngineRef = useRef<RenderingEngine | null>(null);
  const toolGroupRef = useRef<any>(null);
  const isViewportInitialized = useRef(false);

  // Zustand stores for tool management and annotations
  const { 
    activeTool, 
    activateToolInViewport, 
    addAnnotation, 
    updateAnnotation, 
    removeAnnotation,
    // New viewport-based functions
    setActiveViewport,
    setViewportToolState,
    activeViewportId,
    getActiveViewportToolState
  } = useAnnotationStore();

  const {
    currentDicomDataSet,
    setActiveViewport: setActiveViewportInStore
  } = useViewportStore();

  /**
   * 주석 텍스트를 mm 단위로 변환
   * Length 도구에만 적용되며, 실패 시 기본 표시 유지
   */
  const updateAnnotationText = (annotation: any) => {
    try {
      if (!annotation.data?.cachedStats) {
        console.log('⚠️ cachedStats 없음');
        return;
      }
      
      const stats = annotation.data.cachedStats;
      console.log('🔍 stats:', stats);
      
      const imageId = Object.keys(stats)[0];
      console.log('🔍 imageId:', imageId);
      
      const measurementData = stats[imageId];
      console.log('🔍 measurementData:', measurementData);
      console.log('🔍 measurementData의 모든 속성:', Object.keys(measurementData || {}));
      console.log('🔍 measurementData.length:', measurementData?.length);
      console.log('🔍 measurementData.area:', measurementData?.area);
      console.log('🔍 measurementData.angle:', measurementData?.angle);
      console.log('🔍 measurementData.unit:', measurementData?.unit);
      
      // 현재 DICOM 파일의 픽셀 간격 정보 확인
      if (currentDicomDataSet) {
        const pixelSpacing = currentDicomDataSet.string('x00280030');
        console.log('🔍 DICOM PixelSpacing:', pixelSpacing);
        console.log('🔍 DICOM 파일 메타데이터:', {
          pixelSpacing: pixelSpacing,
          hasPixelSpacing: !!pixelSpacing
        });
      }
      
      let convertedText = null;
      
      // Length 측정 (길이 도구)
      if (measurementData?.length !== undefined && measurementData.length > 0) {
        convertedText = `${measurementData.length.toFixed(1)} mm`;
        console.log(`📏 길이 변환: ${measurementData.length} → ${convertedText}`);
      }
      // Area 측정 (ROI 도구들)
      else if (measurementData?.area !== undefined && measurementData.area > 0) {
        convertedText = `${measurementData.area.toFixed(1)} mm²`;
        console.log(`📐 면적 변환: ${measurementData.area} → ${convertedText}`);
      } else {
        console.log('⚠️ 지원되는 측정 데이터 없음');
        return;
      }
      
      // 모든 가능한 텍스트 속성에 설정
      console.log('🔧 변환 전 annotation.data:', JSON.stringify(annotation.data, null, 2));
      
      annotation.data.text = convertedText;
      
      // textBox 설정
      if (annotation.data.handles?.textBox) {
        annotation.data.handles.textBox.text = convertedText;
        console.log('✅ textBox에도 설정 완료');
      }
      
      // 기타 가능한 텍스트 속성들도 설정
      if (annotation.data.handles) {
        annotation.data.handles.text = convertedText;
      }
      
      // CornerstoneJS 내부 텍스트 속성들도 설정
      if (annotation.data.cachedStats) {
        const imageId = Object.keys(annotation.data.cachedStats)[0];
        if (annotation.data.cachedStats[imageId]) {
          annotation.data.cachedStats[imageId].text = convertedText;
        }
      }
      
      console.log('🔧 변환 후 annotation.data:', JSON.stringify(annotation.data, null, 2));
      console.log('✅ 최종 annotation.data.text:', annotation.data.text);
    } catch (error) {
      // 에러 시 기본 동작 유지
      console.log('⚠️ mm 변환 실패:', error);
    }
  };

  // Tool activation through Zustand store
  const handleToolActivation = (toolName: string) => {
    if (!toolName) return;
    
    debugLogger.log(`뷰포트에서 도구 활성화 요청: ${toolName}`);
    const success = activateToolInViewport(toolName, toolGroupRef);
    
    if (success) {
      debugLogger.success(`✅ 뷰포트 도구 활성화 성공: ${toolName}`);
    } else {
      debugLogger.error(`❌ 뷰포트 도구 활성화 실패: ${toolName}`);
    }
  };


  // 🔧 한 번만 실행되는 뷰포트 초기화
  useEffect(() => {
    const initializeViewport = async () => {
      if (isViewportInitialized.current || !viewportRef.current) return;

      try {
        debugLogger.log('🏗️ 뷰포트 초기화 시작 (한 번만 실행)');
        
        // Cornerstone3D 전역 초기화 확인
        await initializeCornerstoneGlobally();

        const toolGroupId = `${viewportId}-tool-group`;

        // 기존 렌더링 엔진 정리
        if (renderingEngineRef.current) {
          try {
            renderingEngineRef.current.destroy();
          } catch (e) {
            console.warn('기존 렌더링 엔진 정리 중 오류:', e);
          }
        }

        // 새 렌더링 엔진 생성
        let renderingEngine = getRenderingEngine(renderingEngineId);
        if (!renderingEngine) {
          renderingEngine = new RenderingEngine(renderingEngineId);
        }
        renderingEngineRef.current = renderingEngine;

        // 뷰포트 설정
        const viewportInput: Types.PublicViewportInput = {
          viewportId,
          type: Enums.ViewportType.STACK,
          element: viewportRef.current,
          defaultOptions: {
            background: [0, 0, 0] as Types.RGB,
          }
        };

        renderingEngine.enableElement(viewportInput);
        debugLogger.success('✅ 뷰포트 활성화 완료');

        // 도구 그룹 설정
        let toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
        if (toolGroup) {
          ToolGroupManager.destroyToolGroup(toolGroupId);
        }

        toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
        if (!toolGroup) {
          throw new Error('도구 그룹 생성 실패');
        }

        // 사용 가능한 모든 도구 추가
        const allTools = [
          // Basic Tools
          WindowLevelTool.toolName,
          PanTool.toolName,
          ZoomTool.toolName,
          StackScrollTool.toolName,
          MagnifyTool.toolName,
          
          // Measurement Tools
          LengthTool.toolName,
          AngleTool.toolName,
          CobbAngleTool.toolName,
          BidirectionalTool.toolName,
          
          // ROI Tools
          RectangleROITool.toolName,
          EllipticalROITool.toolName,
          CircleROITool.toolName,
          
          // Advanced ROI Tools
          PlanarFreehandROITool.toolName,
          SplineROITool.toolName,
          
          // Annotation Tools
          ArrowAnnotateTool.toolName,
          ProbeTool.toolName
        ];

        // 도구 그룹에 모든 도구 추가
        allTools.forEach(toolName => {
          toolGroup.addTool(toolName);
        });

        // 모든 도구를 passive로 초기화 (사용자 선택 대기)
        const allToolNames = [
          'WindowLevel', 'Pan', 'Zoom', 'StackScroll', 'Magnify',
          'Length', 'Angle', 'CobbAngle', 'Bidirectional',
          'RectangleROI', 'EllipticalROI', 'CircleROI',
          'PlanarFreehandROI', 'SplineROI',
          'ArrowAnnotate', 'Probe'
        ];
        
        allToolNames.forEach(tool => {
          toolGroup.setToolPassive(tool);
        });

        // 뷰포트에 도구 그룹 연결
        toolGroup.addViewport(viewportId, renderingEngineId);
        toolGroupRef.current = toolGroup;

        // 전역에서 도구 그룹에 접근할 수 있도록 저장
        (window as any)[`cornerstoneToolGroup_${viewportId}`] = toolGroup;

        debugLogger.success('✅ 뷰포트 초기화 완료');
        isViewportInitialized.current = true;
        
        // 뷰포트 도구 상태 초기화 (기본값)
        setViewportToolState(viewportId, {
          toolName: 'Pan',
          fileType: null,
          isToolsEnabled: false
        });
        
        // 첫 번째 뷰포트(또는 단일 뷰포트)를 활성 뷰포트로 설정
        if (!activeViewportId || viewportId === 'single-viewport' || viewportId.includes('viewport-0')) {
          setActiveViewport(viewportId);
          setActiveViewportInStore(viewportId);
          console.log(`🎯 ${viewportId}을(를) 활성 뷰포트로 설정 (양쪽 스토어 동기화)`);
        }
        
        // 초기화 완료 후 상태 확인
        debugLogger.log('🔍 뷰포트 초기화 후 상태 확인:', {
          element: viewportRef.current,
          elementDimensions: {
            width: viewportRef.current?.clientWidth,
            height: viewportRef.current?.clientHeight
          },
          renderingEngine: !!renderingEngineRef.current,
          toolGroup: !!toolGroupRef.current,
          viewport: !!renderingEngine.getViewport(viewportId)
        });
        
        onSuccess('뷰포트 초기화 완료');

        // 주석 이벤트 리스너는 별도 useEffect에서 관리

        // 초기 도구 활성화 - Pan 도구를 기본으로 설정
        const initialTool = activeTool || 'Pan';
        handleToolActivation(initialTool);

      } catch (error) {
        debugLogger.error('❌ 뷰포트 초기화 실패', error);
        onError(`뷰포트 초기화 실패: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    initializeViewport();
  }, []); // 빈 의존성 배열 - 한 번만 실행

  // 활성 도구 변경 감지
  useEffect(() => {
    if (activeTool && toolGroupRef.current && isViewportInitialized.current) {
      handleToolActivation(activeTool);
    }
  }, [activeTool, activateToolInViewport]);

  // CornerstoneJS 표준 주석 이벤트 리스너 설정 (컴포넌트 마운트 시 한 번만)
  useEffect(() => {
    if (!isViewportInitialized.current) return;

    debugLogger.log('🎯 CornerstoneJS 표준 주석 이벤트 리스너 설정 시작');

    // ANNOTATION_COMPLETED 이벤트 핸들러 - 주석 그리기 완료 시 호출
    const handleAnnotationCompleted = (event: any) => {
      console.log('🎉 [ANNOTATION_COMPLETED] 이벤트 수신!', event.detail);
      debugLogger.log('🎉 ANNOTATION_COMPLETED 이벤트 수신', event.detail);
      
      try {
        const annotation = event.detail?.annotation;
        if (!annotation || !annotation.annotationUID) {
          console.warn('❌ 주석 데이터가 유효하지 않음:', annotation);
          debugLogger.warn('❌ 주석 데이터가 유효하지 않음:', annotation);
          return;
        }

        console.log('📝 주석 UID:', annotation.annotationUID);
        console.log('🔧 도구 이름:', annotation.metadata?.toolName);
        console.log('📊 주석 데이터:', annotation.data);
        console.log('📏 cachedStats:', annotation.data?.cachedStats);

        // 새로 생성된 주석은 기본적으로 보이도록 설정
        annotation.isVisible = true;

        // Length 도구의 텍스트를 mm 단위로 변환 (한 번만 실행)
        updateAnnotationText(annotation);
        
        // 🚀 성능 최적화: 단발성 재시도로 변경
        // CornerstoneJS 내부 렌더링 완료 후 한 번만 재설정
        const retryTextUpdate = (retryCount = 0) => {
          if (retryCount >= 3) return; // 최대 3번만 재시도
          
          setTimeout(() => {
            if (annotation.data?.text && !annotation.data.text.includes('mm')) {
              console.log(`🔄 텍스트 재설정 시도 ${retryCount + 1}/3`);
              updateAnnotationText(annotation);
              retryTextUpdate(retryCount + 1);
            }
          }, 100 * (retryCount + 1)); // 100ms, 200ms, 300ms로 점진적 지연
        };
        
        retryTextUpdate();

        // 스토어에 추가할 주석 데이터 구성
        const annotationData = {
          annotationUID: annotation.annotationUID,
          toolName: annotation.metadata?.toolName || 'Unknown',
          data: annotation.data,
          metadata: annotation.metadata,
          viewportId: 'dicom-viewport'
        };

        console.log('✅ 새 주석을 스토어에 추가:', annotationData);
        debugLogger.success('✅ 새 주석을 스토어에 추가:', annotationData);
        addAnnotation(annotationData);

      } catch (error) {
        console.error('❌ 주석 완료 이벤트 처리 실패:', error);
        debugLogger.error('❌ 주석 완료 이벤트 처리 실패:', error);
      }
    };

    // 🚀 성능 최적화: 디바운싱된 업데이트 맵
    const updateTimers = new Map<string, NodeJS.Timeout>();
    
    // ANNOTATION_MODIFIED 이벤트 핸들러 - 주석 수정 시 호출
    const handleAnnotationModified = (event: any) => {
      debugLogger.log('✏️ ANNOTATION_MODIFIED 이벤트 수신', event.detail);
      
      try {
        const annotation = event.detail?.annotation;
        if (annotation && annotation.annotationUID) {
          // 🚀 디바운싱: 동일한 주석의 연속 수정 요청을 그룹핑
          const annotationUID = annotation.annotationUID;
          
          // 기존 타이머 취소
          if (updateTimers.has(annotationUID)) {
            clearTimeout(updateTimers.get(annotationUID)!);
          }
          
          // 새 타이머 설정 (100ms 디바운싱)
          const timer = setTimeout(() => {
            // Update annotation text with selected measurement unit
            updateAnnotationText(annotation);
            
            const updates = {
              data: annotation.data,
              metadata: annotation.metadata
            };

            updateAnnotation(annotationUID, updates);
            updateTimers.delete(annotationUID);
          }, 100);
          
          updateTimers.set(annotationUID, timer);
        }
      } catch (error) {
        debugLogger.error('❌ 주석 수정 이벤트 처리 실패:', error);
      }
    };

    // ANNOTATION_REMOVED 이벤트 핸들러 - 주석 삭제 시 호출
    const handleAnnotationRemoved = (event: any) => {
      debugLogger.log('🗑️ ANNOTATION_REMOVED 이벤트 수신', event.detail);
      
      try {
        const annotation = event.detail?.annotation;
        if (annotation && annotation.annotationUID) {
          removeAnnotation(annotation.annotationUID);
        }
      } catch (error) {
        debugLogger.error('❌ 주석 삭제 이벤트 처리 실패:', error);
      }
    };

    // CornerstoneJS 공식 이벤트 등록
    const ANNOTATION_COMPLETED = ToolsEnums.Events.ANNOTATION_COMPLETED;
    const ANNOTATION_MODIFIED = ToolsEnums.Events.ANNOTATION_MODIFIED;
    const ANNOTATION_REMOVED = ToolsEnums.Events.ANNOTATION_REMOVED;

    console.log('🎯 CornerstoneJS 이벤트 등록:', {
      ANNOTATION_COMPLETED,
      ANNOTATION_MODIFIED,
      ANNOTATION_REMOVED
    });
    debugLogger.log('🎯 CornerstoneJS 이벤트 등록:', {
      ANNOTATION_COMPLETED,
      ANNOTATION_MODIFIED,
      ANNOTATION_REMOVED
    });

    // 이벤트 리스너 등록
    eventTarget.addEventListener(ANNOTATION_COMPLETED, handleAnnotationCompleted);
    eventTarget.addEventListener(ANNOTATION_MODIFIED, handleAnnotationModified);
    eventTarget.addEventListener(ANNOTATION_REMOVED, handleAnnotationRemoved);

    console.log('✅ CornerstoneJS 주석 이벤트 리스너 등록 완료!');
    debugLogger.success('✅ 모든 주석 이벤트 리스너 등록 완료');

    // 컴포넌트 언마운트 시 이벤트 리스너 정리
    return () => {
      eventTarget.removeEventListener(ANNOTATION_COMPLETED, handleAnnotationCompleted);
      eventTarget.removeEventListener(ANNOTATION_MODIFIED, handleAnnotationModified);
      eventTarget.removeEventListener(ANNOTATION_REMOVED, handleAnnotationRemoved);
      
      // 🚀 성능 최적화: 남은 디바운싱 타이머 정리
      updateTimers.forEach((timer) => clearTimeout(timer));
      updateTimers.clear();
      
      debugLogger.log('🧹 주석 이벤트 리스너 및 타이머 정리 완료');
    };
  }, [isViewportInitialized.current, addAnnotation, updateAnnotation, removeAnnotation]);

  // 현재 로드된 이미지 정보 저장
  const currentImageRef = useRef<HTMLImageElement | null>(null);
  const isImageFileRef = useRef<boolean>(false);

  // Canvas에 이미지 그리기 함수
  const drawImageToCanvas = () => {
    if (!currentImageRef.current || !isImageFileRef.current || !renderingEngineRef.current || !viewportRef.current) {
      return;
    }

    const img = currentImageRef.current;
    const renderingEngine = renderingEngineRef.current;
    const viewport = renderingEngine.getViewport(viewportId) as Types.IStackViewport;
    
    if (!viewport || !viewport.canvas) {
      debugLogger.warn('Canvas를 찾을 수 없습니다');
      return;
    }

    const canvas = viewport.canvas;
    const context = canvas.getContext('2d');
    
    if (!context) {
      debugLogger.warn('Canvas context를 가져올 수 없습니다');
      return;
    }

    // Canvas 크기를 컨테이너에 맞추기
    const containerRect = viewportRef.current.getBoundingClientRect();
    canvas.width = containerRect.width;
    canvas.height = containerRect.height;
    
    // 이미지 비율 계산
    const scale = Math.min(
      canvas.width / img.width,
      canvas.height / img.height
    );
    
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    const x = (canvas.width - scaledWidth) / 2;
    const y = (canvas.height - scaledHeight) / 2;
    
    // 배경을 검은색으로 채우기
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // 이미지 그리기
    context.drawImage(img, x, y, scaledWidth, scaledHeight);
    
    // Canvas가 실제로 표시되도록 스타일 설정
    canvas.style.display = 'block';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '1';
    
    debugLogger.log(`🖼️ Canvas 재그리기 완료: ${scaledWidth}x${scaledHeight}`);
  };

  // 이미지 파일을 직접 Canvas에 렌더링하는 함수
  const renderImageDirectly = async (file: File, viewport: Types.IStackViewport) => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          // 이미지 참조 저장
          currentImageRef.current = img;
          isImageFileRef.current = true;
          
          // 실제 렌더링 수행
          drawImageToCanvas();
          
          debugLogger.log(`🖼️ 이미지 직접 렌더링 완료: ${img.width}x${img.height}`);
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error(`이미지 로딩 실패: ${file.name}`));
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  // displayUnit useEffect 제거 - mm로 고정이므로 불필요


  // 정리
  useEffect(() => {
    return () => {
      try {
        if (toolGroupRef.current) {
          ToolGroupManager.destroyToolGroup('dicom-tool-group');
        }
        if (renderingEngineRef.current) {
          renderingEngineRef.current.destroy();
        }
      } catch (error) {
        console.warn('뷰포트 정리 중 오류:', error);
      }
    };
  }, []);

  // 렌더링 엔진과 툴 그룹 참조를 외부에서 접근할 수 있도록 노출
  useEffect(() => {
    if (renderingEngineRef.current && toolGroupRef.current && isViewportInitialized.current) {
      // 전역적으로 참조 저장 (사이드바 컨트롤에서 사용)
      (window as any).cornerstoneRenderingEngine = renderingEngineRef.current;
      (window as any).cornerstoneToolGroupRef = toolGroupRef.current;
      debugLogger.log('🌐 전역 참조 설정 완료');
      
      // 뷰포트 초기화 완료 신호 전송
      const initEvent = new CustomEvent('cornerstoneViewportReady', {
        detail: { 
          renderingEngine: renderingEngineRef.current,
          toolGroup: toolGroupRef.current,
          viewportId: 'dicom-viewport'
        }
      });
      window.dispatchEvent(initEvent);
      debugLogger.log('📡 뷰포트 준비 완료 이벤트 전송');
    }
  }, [isViewportInitialized.current]);



  // 파일이 변경될 때 이미지 로딩
  useEffect(() => {
    if (!file || !isViewportInitialized.current || !renderingEngineRef.current) {
      return;
    }

    const loadImage = async () => {
      try {
        debugLogger.log(`🔄 뷰포트 ${viewportId}에 파일 로딩 시작:`, file.name);
        
        // 이전 상태 초기화
        currentImageRef.current = null;
        isImageFileRef.current = false;
        
        const renderingEngine = renderingEngineRef.current;
        const viewport = renderingEngine?.getViewport(viewportId) as Types.IStackViewport;
        
        if (!viewport) {
          throw new Error(`뷰포트 ${viewportId}를 찾을 수 없습니다`);
        }

        // 파일 타입 확인
        const fileName = file.name.toLowerCase();
        const isDicomFile = fileName.endsWith('.dcm') || fileName.endsWith('.dicom');
        const isImageFile = fileName.match(/\.(jpg|jpeg|png|bmp|tiff|tif|gif)$/);
        
        let imageId: string;
        
        if (isDicomFile) {
          // DICOM 파일 처리
          const arrayBuffer = await file.arrayBuffer();
          const byteArray = new Uint8Array(arrayBuffer);
          
          // DICOM 파싱 및 데이터셋 저장
          try {
            const dataSet = dicomParser.parseDicom(byteArray);
            
            // 첫 번째 뷰포트는 전역 스토어에도 저장 (기존 호환성)
            if (viewportId.includes('single') || viewportId.includes('0')) {
              const { setDicomDataSet } = useViewportStore.getState();
              setDicomDataSet(dataSet);
            }
            
            // 모든 뷰포트의 DICOM 데이터를 콜백으로 전달
            if (onDicomDataSet && file) {
              onDicomDataSet(file.name, dataSet);
            }
            
            debugLogger.log('💾 DICOM 데이터셋 파싱 완료:', {
              fileName: file.name,
              viewportId,
              modality: dataSet.string('x00080060'),
              rows: dataSet.uint16('x00280010'),
              columns: dataSet.uint16('x00280011'),
              studyDate: dataSet.string('x00080020')
            });
          } catch (parseError) {
            debugLogger.warn('⚠️ DICOM 파싱 실패 (표시는 계속):', parseError);
          }
          
          const blob = new Blob([byteArray], { type: 'application/dicom' });
          const url = URL.createObjectURL(blob);
          imageId = `wadouri:${url}`;
          
          // DICOM 파일의 경우 도구 상태 업데이트
          const initialTool = activeTool || 'Pan';
          setViewportToolState(viewportId, {
            toolName: initialTool,
            fileType: 'dicom',
            isToolsEnabled: true
          });
          
          if (toolGroupRef.current) {
            const allToolNames = [
              'WindowLevel', 'Pan', 'Zoom', 'StackScroll', 'Magnify',
              'Length', 'Angle', 'CobbAngle', 'Bidirectional',
              'RectangleROI', 'EllipticalROI', 'CircleROI',
              'PlanarFreehandROI', 'SplineROI',
              'ArrowAnnotate', 'Probe'
            ];
            
            // 모든 도구를 passive로 설정
            allToolNames.forEach(tool => {
              try {
                toolGroupRef.current.setToolPassive(tool);
              } catch (e) {
                // 도구가 존재하지 않을 수 있음
              }
            });
            
            // 초기 도구를 active로 설정 (Pan이 기본)
            try {
              toolGroupRef.current.setToolActive(initialTool, {
                bindings: [{ mouseButton: 1 }]
              });
              console.log(`🔧 DICOM 파일: ${initialTool} 도구 활성화 완료`);
            } catch (e) {
              console.warn(`초기 도구 ${initialTool} 활성화 실패:`, e);
            }
            
            debugLogger.log('🔧 DICOM 파일: 도구 사용 가능');
          }
          
        } else if (isImageFile) {
          // 일반 이미지 파일 - 직접 Canvas 렌더링
          await renderImageDirectly(file, viewport);
          
          // 이미지 파일의 경우 도구 상태 업데이트 (모든 도구 비활성화)
          setViewportToolState(viewportId, {
            toolName: null, // 이미지에서는 도구 사용 불가
            fileType: 'image',
            isToolsEnabled: false // 모든 도구 비활성화
          });
          
          if (toolGroupRef.current) {
            const allToolNames = [
              'WindowLevel', 'Pan', 'Zoom', 'StackScroll', 'Magnify',
              'Length', 'Angle', 'CobbAngle', 'Bidirectional',
              'RectangleROI', 'EllipticalROI', 'CircleROI',
              'PlanarFreehandROI', 'SplineROI',
              'ArrowAnnotate', 'Probe'
            ];
            
            // 이미지 파일에서는 모든 도구 비활성화 (Canvas 직접 렌더링으로 CornerstoneJS 도구 사용 불가)
            allToolNames.forEach(tool => {
              try {
                toolGroupRef.current.setToolDisabled(tool);
              } catch (e) {
                // 도구가 존재하지 않을 수 있음
              }
            });
            
            debugLogger.log('🔧 이미지 파일: 모든 도구 비활성화 (Canvas 직접 렌더링)');
          }
          
          debugLogger.success(`✅ 뷰포트 ${viewportId} 이미지 파일 로딩 완료`);
          onSuccess(`파일 ${file.name} 로딩 완료`);
          return;
          
        } else {
          throw new Error(`지원되지 않는 파일 형식: ${file.name}`);
        }

        // DICOM 파일의 경우에만 뷰포트에 이미지 설정
        await viewport.setStack([imageId]);
        viewport.render();

        debugLogger.success(`✅ 뷰포트 ${viewportId} 이미지 로딩 완료`);
        onSuccess(`파일 ${file.name} 로딩 완료`);

      } catch (error) {
        debugLogger.error(`❌ 뷰포트 ${viewportId} 이미지 로딩 실패:`, error);
        onError(`파일 ${file.name} 로딩 실패: ${error}`);
      }
    };

    loadImage();
  }, [file, viewportId, isViewportInitialized.current]);

  // 🔧 뷰포트 크기 재조정 처리 (레이아웃 변경 시)
  useEffect(() => {
    if (!isViewportInitialized.current || !renderingEngineRef.current || !viewportRef.current) {
      return;
    }

    const resizeViewport = () => {
      try {
        const renderingEngine = renderingEngineRef.current;
        const viewport = renderingEngine?.getViewport(viewportId) as Types.IStackViewport;
        
        if (viewport && viewportRef.current) {
          // 컨테이너 크기 확인
          const containerRect = viewportRef.current.getBoundingClientRect();
          debugLogger.log(`🔧 뷰포트 ${viewportId} 크기 재조정:`, {
            width: containerRect.width,
            height: containerRect.height
          });

          if (isImageFileRef.current) {
            // 이미지 파일의 경우 Canvas에 다시 그리기
            drawImageToCanvas();
          } else {
            // DICOM 파일의 경우 기존 방식
            renderingEngine.resize(true);
            viewport.render();
          }
          
          debugLogger.success(`✅ 뷰포트 ${viewportId} 크기 재조정 완료`);
        }
      } catch (error) {
        debugLogger.error(`❌ 뷰포트 ${viewportId} 크기 재조정 실패:`, error);
      }
    };

    // ResizeObserver로 컨테이너 크기 변경 감지
    const resizeObserver = new ResizeObserver(() => {
      // 디바운싱으로 불필요한 호출 방지
      setTimeout(resizeViewport, 100);
    });

    if (viewportRef.current) {
      resizeObserver.observe(viewportRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [viewportId, isViewportInitialized.current]);

  // 뷰포트 클릭 시 활성 뷰포트로 설정
  const handleViewportClick = () => {
    if (activeViewportId !== viewportId) {
      setActiveViewport(viewportId);
      setActiveViewportInStore(viewportId);
      console.log(`🎯 뷰포트 ${viewportId}이(가) 활성화되었습니다 (양쪽 스토어 동기화)`);
    }
  };

  // 뷰포트가 활성화되어 있는지 확인
  const isActive = activeViewportId === viewportId;

  return (
    <div 
      ref={viewportRef}
      onClick={handleViewportClick}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '400px',
        backgroundColor: '#000000',
        position: 'relative',
        cursor: 'pointer',
        border: isActive ? '2px solid #3b82f6' : '2px solid transparent',
        borderRadius: '4px',
        transition: 'border-color 0.2s ease'
      }}
    />
  );
};

// React.memo로 최적화 - props가 변경되지 않는 한 리렌더링하지 않음
export const DicomViewport = memo(DicomViewportComponent, () => {
  // 뷰포트 컴포넌트는 거의 리렌더링할 필요가 없음
  debugLogger.log('DicomViewport: props 변경 없음 - 리렌더링 건너뜀');
  return true;
});