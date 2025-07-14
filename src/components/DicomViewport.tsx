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

  // 🔥 단순화된 주석 이벤트 리스너 (중복 방지)
  const setupAnnotationEventListeners = () => {
    debugLogger.log('🎯 단순화된 주석 이벤트 리스너 설정 시작');

    // 중복 방지를 위한 Set
    const processedAnnotations = new Set<string>();

    // 주석 완료 이벤트 핸들러 (단 한 번만 처리)
    const handleAnnotationCompleted = (event: any) => {
      debugLogger.log('🎉 주석 완료 이벤트 수신', event.detail);
      
      try {
        const annotation = event.detail?.annotation;
        if (!annotation || !annotation.annotationUID) {
          debugLogger.warn('주석 데이터가 없거나 UID가 없음');
          return;
        }

        // 🔥 중복 처리 방지
        if (processedAnnotations.has(annotation.annotationUID)) {
          debugLogger.log(`이미 처리된 주석: ${annotation.annotationUID}`);
          return;
        }

        // 스토어에서도 중복 확인
        const existingAnnotation = useDicomStore.getState().annotations.find(
          a => a.annotationUID === annotation.annotationUID
        );
        
        if (existingAnnotation) {
          debugLogger.log(`스토어에 이미 존재하는 주석: ${annotation.annotationUID}`);
          return;
        }

        // 처리 완료 표시
        processedAnnotations.add(annotation.annotationUID);

        // 새로 생성된 주석의 가시성을 현재 설정에 맞게 조정
        annotation.isVisible = annotationsVisible;
        debugLogger.log(`📝 새 주석 가시성 설정: ${annotationsVisible ? '표시' : '숨김'}`);

        const annotationData = {
          annotationUID: annotation.annotationUID,
          toolName: annotation.metadata?.toolName || annotation.data?.label || 'Unknown',
          data: annotation.data,
          metadata: annotation.metadata,
          viewportId: 'dicom-viewport'
        };

        debugLogger.success('📝 새 주석을 스토어에 추가', annotationData);
        addAnnotation(annotationData);

      } catch (error) {
        debugLogger.error('주석 완료 이벤트 처리 실패', error);
      }
    };

    // 주석 수정 이벤트 핸들러
    const handleAnnotationModified = (event: any) => {
      debugLogger.log('✏️ 주석 수정 이벤트 수신', event.detail);
      
      try {
        const annotation = event.detail?.annotation;
        if (annotation && annotation.annotationUID) {
          const updates = {
            data: annotation.data,
            metadata: annotation.metadata
          };

          debugLogger.log('📝 주석 업데이트', { uid: annotation.annotationUID, updates });
          updateAnnotation(annotation.annotationUID, updates);
        }
      } catch (error) {
        debugLogger.error('주석 수정 이벤트 처리 실패', error);
      }
    };

    // 주석 삭제 이벤트 핸들러
    const handleAnnotationRemoved = (event: any) => {
      debugLogger.log('🗑️ 주석 삭제 이벤트 수신', event.detail);
      
      try {
        const annotation = event.detail?.annotation;
        if (annotation && annotation.annotationUID) {
          debugLogger.log('🗑️ 스토어에서 주석 제거', annotation.annotationUID);
          removeAnnotation(annotation.annotationUID);
          processedAnnotations.delete(annotation.annotationUID);
        }
      } catch (error) {
        debugLogger.error('주석 삭제 이벤트 처리 실패', error);
      }
    };

    // 🔥 공식 Cornerstone3D 이벤트만 사용
    const events = {
      completed: ToolsEnums.Events.ANNOTATION_COMPLETED,
      modified: ToolsEnums.Events.ANNOTATION_MODIFIED,
      removed: ToolsEnums.Events.ANNOTATION_REMOVED
    };

    debugLogger.log('🎯 공식 이벤트 등록', events);

    // 이벤트 리스너 등록 (공식 이벤트만)
    eventTarget.addEventListener(events.completed, handleAnnotationCompleted);
    eventTarget.addEventListener(events.modified, handleAnnotationModified);
    eventTarget.addEventListener(events.removed, handleAnnotationRemoved);

    debugLogger.success('✅ 주석 이벤트 리스너 등록 완료');

    // 정리 함수
    return () => {
      eventTarget.removeEventListener(events.completed, handleAnnotationCompleted);
      eventTarget.removeEventListener(events.modified, handleAnnotationModified);
      eventTarget.removeEventListener(events.removed, handleAnnotationRemoved);
      
      processedAnnotations.clear();
      debugLogger.log('🧹 주석 이벤트 리스너 정리 완료');
    };
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

        // 🔥 주석 이벤트 리스너 설정 (핵심!)
        setupAnnotationEventListeners();

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

  // 주석 가시성 상태 변화 감지 및 CornerstoneJS 연동
  useEffect(() => {
    if (!isViewportInitialized.current) return;
    
    debugLogger.log(`🔄 주석 가시성 상태 변화 감지: ${annotationsVisible ? '표시' : '숨김'}`);
    
    try {
      // CornerstoneJS에서 모든 주석의 isVisible 속성을 직접 제어
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
      
      debugLogger.log(`👁️ ${processedCount}개 주석의 가시성을 ${annotationsVisible ? '표시' : '숨김'}로 설정`);
      
      // 뷰포트 즉시 새로고침
      if (renderingEngineRef.current) {
        const viewport = renderingEngineRef.current.getViewport('dicom-viewport');
        if (viewport) {
          viewport.render();
          debugLogger.success('✅ 주석 가시성 변경 후 뷰포트 새로고침 완료');
        }
      }
      
      // 추가 안전장치: 100ms 후 재렌더링
      setTimeout(() => {
        if (renderingEngineRef.current) {
          const viewport = renderingEngineRef.current.getViewport('dicom-viewport');
          if (viewport) {
            viewport.render();
            debugLogger.log('🔄 주석 가시성 변경 후 추가 뷰포트 새로고침 완료');
          }
        }
      }, 100);
      
    } catch (error) {
      debugLogger.error('❌ 주석 가시성 제어 실패:', error);
    }
  }, [annotationsVisible]); // annotationsVisible 상태가 변경될 때마다 실행

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