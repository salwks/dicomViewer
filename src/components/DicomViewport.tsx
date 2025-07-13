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
  annotation
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

  // 🔥 주석 이벤트 리스너 설정 (핵심!)
  const setupAnnotationEventListeners = () => {
    debugLogger.log('🎯 주석 이벤트 리스너 설정 시작');

    // 주석 완료 이벤트 (새 주석 생성됨)
    const handleAnnotationCompleted = (event: any) => {
      debugLogger.log('🎉 주석 생성 완료 이벤트 수신', event.detail);
      
      try {
        const annotation = event.detail.annotation;
        if (annotation) {
          const annotationData = {
            annotationUID: annotation.annotationUID || `annotation-${Date.now()}`,
            toolName: annotation.metadata?.toolName || 'Unknown',
            data: annotation.data,
            metadata: annotation.metadata,
            viewportId: 'dicom-viewport'
          };

          debugLogger.success('📝 새 주석을 스토어에 추가', annotationData);
          addAnnotation(annotationData);
        }
      } catch (error) {
        debugLogger.error('주석 생성 이벤트 처리 실패', error);
      }
    };

    // 주석 수정 이벤트
    const handleAnnotationModified = (event: any) => {
      debugLogger.log('✏️ 주석 수정 이벤트 수신', event.detail);
      
      try {
        const annotation = event.detail.annotation;
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

    // 주석 삭제 이벤트
    const handleAnnotationRemoved = (event: any) => {
      debugLogger.log('🗑️ 주석 삭제 이벤트 수신', event.detail);
      
      try {
        const annotation = event.detail.annotation;
        if (annotation && annotation.annotationUID) {
          debugLogger.log('🗑️ 스토어에서 주석 제거', annotation.annotationUID);
          removeAnnotation(annotation.annotationUID);
        }
      } catch (error) {
        debugLogger.error('주석 삭제 이벤트 처리 실패', error);
      }
    };

    // 이벤트 리스너 등록
    eventTarget.addEventListener('ANNOTATION_COMPLETED', handleAnnotationCompleted);
    eventTarget.addEventListener('ANNOTATION_MODIFIED', handleAnnotationModified);
    eventTarget.addEventListener('ANNOTATION_REMOVED', handleAnnotationRemoved);

    // DOM 이벤트 방식도 지원 (백업)
    document.addEventListener('cornerstoneAnnotationCompleted', handleAnnotationCompleted);
    document.addEventListener('cornerstoneAnnotationModified', handleAnnotationModified);
    document.addEventListener('cornerstoneAnnotationRemoved', handleAnnotationRemoved);

    debugLogger.success('✅ 주석 이벤트 리스너 등록 완료');

    // 정리 함수 반환
    return () => {
      eventTarget.removeEventListener('ANNOTATION_COMPLETED', handleAnnotationCompleted);
      eventTarget.removeEventListener('ANNOTATION_MODIFIED', handleAnnotationModified);
      eventTarget.removeEventListener('ANNOTATION_REMOVED', handleAnnotationRemoved);

      document.removeEventListener('cornerstoneAnnotationCompleted', handleAnnotationCompleted);
      document.removeEventListener('cornerstoneAnnotationModified', handleAnnotationModified);
      document.removeEventListener('cornerstoneAnnotationRemoved', handleAnnotationRemoved);

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

        // 모든 도구 추가
        toolGroup.addTool(WindowLevelTool.toolName);
        toolGroup.addTool(PanTool.toolName);
        toolGroup.addTool(ZoomTool.toolName);
        toolGroup.addTool(StackScrollTool.toolName);
        toolGroup.addTool(LengthTool.toolName);
        toolGroup.addTool(RectangleROITool.toolName);
        toolGroup.addTool(EllipticalROITool.toolName);
        toolGroup.addTool(ArrowAnnotateTool.toolName);

        // 모든 도구를 passive로 초기화 (사용자 선택 대기)
        ['WindowLevel', 'Pan', 'Zoom', 'StackScroll', 'Length', 'RectangleROI', 'EllipticalROI', 'ArrowAnnotate'].forEach(tool => {
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

  // 주석 가시성 제어
  useEffect(() => {
    if (isViewportInitialized.current && renderingEngineRef.current) {
      try {
        const viewport = renderingEngineRef.current.getViewport('dicom-viewport');
        if (viewport) {
          if (annotationsVisible) {
            // 모든 주석 표시
            annotation.state.setAnnotationVisibility(true);
            debugLogger.log('👁️ 모든 주석 표시');
          } else {
            // 모든 주석 숨김
            annotation.state.setAnnotationVisibility(false);
            debugLogger.log('🙈 모든 주석 숨김');
          }
          
          // 뷰포트 새로고침
          viewport.render();
        }
      } catch (error) {
        debugLogger.error('주석 가시성 제어 실패', error);
      }
    }
  }, [annotationsVisible]);

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