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
import { useDicomStore } from '../store/dicom-store';

interface DicomViewportProps {
  onError: (error: string) => void;
  onSuccess: (message: string) => void;
}

/**
 * 뷰포트만 담당하는 컴포넌트 - 한 번만 초기화됨
 * 이미지 로딩은 별도로 처리
 */
const DicomViewportComponent = ({ onError, onSuccess }: DicomViewportProps) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const renderingEngineRef = useRef<RenderingEngine | null>(null);
  const toolGroupRef = useRef<any>(null);
  const isViewportInitialized = useRef(false);

  // Zustand store for tool management and annotations
  const { 
    activeTool, 
    activateToolInViewport, 
    addAnnotation, 
    updateAnnotation, 
    removeAnnotation,
    annotationsVisible
  } = useDicomStore((state) => ({
    activeTool: state.activeTool,
    activateToolInViewport: state.activateToolInViewport,
    addAnnotation: state.addAnnotation,
    updateAnnotation: state.updateAnnotation,
    removeAnnotation: state.removeAnnotation,
    annotationsVisible: state.annotationsVisible
  }));

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

        const renderingEngineId = 'dicom-rendering-engine';
        const viewportId = 'dicom-viewport';
        const toolGroupId = 'dicom-tool-group';

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

        debugLogger.success('✅ 뷰포트 초기화 완료');
        isViewportInitialized.current = true;
        onSuccess('뷰포트 초기화 완료');

        // 주석 이벤트 리스너는 별도 useEffect에서 관리

        // 초기 도구 활성화
        if (activeTool) {
          handleToolActivation(activeTool);
        }

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

        // 새로 생성된 주석의 가시성을 현재 설정에 맞게 조정
        annotation.isVisible = annotationsVisible;

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

    // ANNOTATION_MODIFIED 이벤트 핸들러 - 주석 수정 시 호출
    const handleAnnotationModified = (event: any) => {
      debugLogger.log('✏️ ANNOTATION_MODIFIED 이벤트 수신', event.detail);
      
      try {
        const annotation = event.detail?.annotation;
        if (annotation && annotation.annotationUID) {
          const updates = {
            data: annotation.data,
            metadata: annotation.metadata
          };

          updateAnnotation(annotation.annotationUID, updates);
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
      
      debugLogger.log('🧹 주석 이벤트 리스너 정리 완료');
    };
  }, [isViewportInitialized.current, addAnnotation, updateAnnotation, removeAnnotation, annotationsVisible]);

  // useRef를 사용하여 이전 상태를 기억합니다 (StrictMode 대응)
  const isVisibleRef = useRef(annotationsVisible);

  // 주석 가시성 상태 변화 감지 및 실제 뷰포트 제어 (StrictMode 견고 버전)
  useEffect(() => {
    // 뷰포트가 준비되지 않았으면 아무것도 하지 않습니다.
    if (!renderingEngineRef.current) return;
    
    const viewport = renderingEngineRef.current.getViewport('dicom-viewport');
    if (!viewport) {
      console.log('⚠️ 뷰포트를 찾을 수 없음');
      return;
    }

    // 이전 상태와 현재 상태가 다를 때만 아래 코드를 실행합니다.
    if (isVisibleRef.current !== annotationsVisible) {
      console.log(`🔄 주석 가시성 상태 실제 변화 감지: ${isVisibleRef.current} → ${annotationsVisible}`);
      
      if (annotationsVisible) {
        console.log('✅ 뷰포트의 모든 주석을 표시합니다.');
        debugLogger.log('✅ 뷰포트의 모든 주석을 표시합니다.');
        
        // CornerstoneJS 공식 API 시도
        try {
          if (typeof annotation.state.showAnnotations === 'function') {
            annotation.state.showAnnotations();
            console.log('📡 annotation.state.showAnnotations() 호출 완료');
          } else {
            console.log('⚠️ showAnnotations API를 사용할 수 없음');
          }
        } catch (e) {
          console.warn('showAnnotations API 실행 오류:', e);
        }
      } else {
        console.log('🚫 뷰포트의 모든 주석을 숨깁니다.');
        debugLogger.log('🚫 뷰포트의 모든 주석을 숨깁니다.');
        
        // CornerstoneJS 공식 API 시도
        try {
          if (typeof annotation.state.hideAnnotations === 'function') {
            annotation.state.hideAnnotations();
            console.log('📡 annotation.state.hideAnnotations() 호출 완료');
          } else {
            console.log('⚠️ hideAnnotations API를 사용할 수 없음');
          }
        } catch (e) {
          console.warn('hideAnnotations API 실행 오류:', e);
        }
      }

      // 모든 개별 주석의 isVisible 속성 직접 제어 (확실한 방법)
      const annotationManager = annotation.state.getAllAnnotations();
      let processedCount = 0;
      
      if (annotationManager) {
        Object.keys(annotationManager).forEach(toolName => {
          const toolAnnotations = annotationManager[toolName];
          if (toolAnnotations && Array.isArray(toolAnnotations)) {
            toolAnnotations.forEach(ann => {
              if (ann && typeof ann === 'object') {
                ann.isVisible = annotationsVisible;
                processedCount++;
              }
            });
          }
        });
      }

      console.log(`👁️ ${processedCount}개 주석의 가시성을 ${annotationsVisible ? '표시' : '숨김'}로 설정`);

      // 뷰포트 새로고침
      viewport.render();
      console.log('✅ 뷰포트 새로고침 완료');

      // 추가 안전장치: 100ms 후 재렌더링
      setTimeout(() => {
        if (renderingEngineRef.current) {
          const currentViewport = renderingEngineRef.current.getViewport('dicom-viewport');
          if (currentViewport) {
            currentViewport.render();
            console.log('🔄 추가 뷰포트 새로고침 완료');
          }
        }
      }, 100);

      // 상태를 업데이트하여 다음 변경을 대비합니다.
      isVisibleRef.current = annotationsVisible;
      
    } else {
      console.log(`ℹ️ 주석 가시성 상태 변화 없음: ${annotationsVisible} (StrictMode 중복 실행 방지)`);
    }

  }, [annotationsVisible]); // annotationsVisible 상태가 바뀔 때마다 이 코드가 실행됩니다.

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
      (window as any).cornerstoneToolGroupRef = toolGroupRef;
      debugLogger.log('🌐 전역 참조 설정 완료');
    }
  }, [isViewportInitialized.current]);

  return (
    <div 
      ref={viewportRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '400px',
        backgroundColor: '#000000',
        position: 'relative'
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