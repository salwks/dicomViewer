import { useEffect, useRef, memo } from 'react';
import { 
  RenderingEngine, 
  Types,
  Enums,
  getRenderingEngine
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
  Enums as ToolEnums
} from '@cornerstonejs/tools';
import dicomParser from 'dicom-parser';
import { debugLogger } from '../utils/debug-logger';
import { initializeCornerstoneGlobally, isCornerstoneInitialized } from '../utils/cornerstone-global-init';
import { useDicomStore } from '../store/dicom-store';

interface DicomRendererProps {
  files: File[];
  onError: (error: string) => void;
  onSuccess: (message: string) => void;
}

const DicomRendererComponent = ({ files, onError, onSuccess }: DicomRendererProps) => {
  // Zustand store for tool management
  const { activeTool, activateToolInViewport } = useDicomStore((state) => ({
    activeTool: state.activeTool,
    activateToolInViewport: state.activateToolInViewport
  }));
  const viewportRef = useRef<HTMLDivElement>(null);
  const renderingEngineRef = useRef<RenderingEngine | null>(null);
  const toolGroupRef = useRef<any>(null);
  const isInitializedRef = useRef(false);

  // Tool activation through Zustand store
  const handleToolActivation = (toolName: string) => {
    if (!toolName) return;
    
    debugLogger.log(`스토어를 통한 도구 활성화 요청: ${toolName}`);
    const success = activateToolInViewport(toolName, toolGroupRef);
    
    if (success) {
      debugLogger.success(`✅ 도구 활성화 성공: ${toolName}`);
    } else {
      debugLogger.error(`❌ 도구 활성화 실패: ${toolName}`);
    }
  };

  // Cornerstone3D 전역 초기화 (애플리케이션당 한 번만 실행)
  useEffect(() => {
    const initializeCornerstone = async () => {
      if (isInitializedRef.current) return;

      try {
        debugLogger.log('DicomRenderer: 전역 초기화 요청');
        
        // 전역 초기화 수행 (중복 실행 방지됨)
        const success = await initializeCornerstoneGlobally();
        
        if (success) {
          isInitializedRef.current = true;
          onSuccess('Cornerstone3D 초기화 완료');
          debugLogger.success('DicomRenderer: 초기화 완료');
        } else {
          throw new Error('전역 초기화 실패');
        }

      } catch (error) {
        debugLogger.error('DicomRenderer: 초기화 실패', error);
        onError(`Cornerstone3D 초기화 실패: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    initializeCornerstone();
  }, []); // 빈 의존성 배열로 한 번만 실행

  // 렌더링 엔진 및 뷰포트 설정
  useEffect(() => {
    if (!isInitializedRef.current || !viewportRef.current || files.length === 0) return;

    const setupViewport = async () => {
      try {
        debugLogger.log('뷰포트 설정 시작');
        debugLogger.time('뷰포트 설정');

        const renderingEngineId = 'dicom-rendering-engine';
        const viewportId = 'dicom-viewport';
        const toolGroupId = 'dicom-tool-group';

        debugLogger.log('뷰포트 설정 정보', {
          renderingEngineId,
          viewportId,
          toolGroupId,
          fileCount: files.length
        });

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

        console.log('✅ 렌더링 엔진 생성 완료');

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
        console.log('✅ 뷰포트 활성화 완료');

        // 도구 그룹 설정
        let toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
        if (toolGroup) {
          ToolGroupManager.destroyToolGroup(toolGroupId);
        }

        toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
        if (!toolGroup) {
          throw new Error('도구 그룹 생성 실패');
        }

        // 기본 도구 추가
        toolGroup.addTool(WindowLevelTool.toolName);
        toolGroup.addTool(PanTool.toolName);
        toolGroup.addTool(ZoomTool.toolName);
        toolGroup.addTool(StackScrollTool.toolName);
        
        // 주석 도구 추가
        toolGroup.addTool(LengthTool.toolName);
        toolGroup.addTool(RectangleROITool.toolName);
        toolGroup.addTool(EllipticalROITool.toolName);
        toolGroup.addTool(ArrowAnnotateTool.toolName);

        debugLogger.success('도구 그룹에 모든 도구 추가 완료');

        // 기본 도구 활성화
        toolGroup.setToolActive(WindowLevelTool.toolName, {
          bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }]
        });
        
        toolGroup.setToolActive(PanTool.toolName, {
          bindings: [{ mouseButton: ToolEnums.MouseBindings.Auxiliary }]
        });
        
        toolGroup.setToolActive(ZoomTool.toolName, {
          bindings: [{ mouseButton: ToolEnums.MouseBindings.Secondary }]
        });

        // 주석 도구들은 passive 상태로 설정 (사용자가 활성화할 때까지)
        toolGroup.setToolPassive(LengthTool.toolName);
        toolGroup.setToolPassive(RectangleROITool.toolName);
        toolGroup.setToolPassive(EllipticalROITool.toolName);
        toolGroup.setToolPassive(ArrowAnnotateTool.toolName);

        // 뷰포트에 도구 그룹 연결
        toolGroup.addViewport(viewportId, renderingEngineId);
        toolGroupRef.current = toolGroup;

        console.log('✅ 도구 그룹 설정 완료');

        // 이제 DICOM 파일 로드 및 렌더링
        await loadAndRenderDicomFiles();

      } catch (error) {
        console.error('❌ 뷰포트 설정 실패:', error);
        onError(`뷰포트 설정 실패: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    setupViewport();
  }, [files, onError]);

  // 활성 도구 변경 감지 - Zustand 스토어 기반
  useEffect(() => {
    if (activeTool && toolGroupRef.current) {
      handleToolActivation(activeTool);
    }
  }, [activeTool, activateToolInViewport]);

  // DICOM 파일 로드 및 렌더링
  const loadAndRenderDicomFiles = async () => {
    if (!renderingEngineRef.current || files.length === 0) return;

    try {
      debugLogger.log('DICOM 파일 로드 및 렌더링 시작');
      debugLogger.time('DICOM 파일 처리');

      const viewportId = 'dicom-viewport';
      const viewport = renderingEngineRef.current.getViewport(viewportId) as Types.IStackViewport;

      if (!viewport) {
        throw new Error('뷰포트를 찾을 수 없습니다');
      }

      // 파일을 ObjectURL로 변환하여 imageId 생성
      const imageIds: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        debugLogger.progress('파일 처리', i + 1, files.length, file.name);

        try {
          debugLogger.time(`파일 처리 ${i + 1}`);
          
          // ArrayBuffer로 읽기
          const arrayBuffer = await file.arrayBuffer();
          const byteArray = new Uint8Array(arrayBuffer);

          debugLogger.log(`파일 크기: ${byteArray.length} bytes`, {
            fileName: file.name,
            fileSize: byteArray.length,
            fileType: file.type
          });

          // DICOM 파싱 시도
          try {
            const dataSet = dicomParser.parseDicom(byteArray);
            
            const dicomInfo = {
              sopInstanceUID: dataSet.string('x00080018'),
              studyInstanceUID: dataSet.string('x0020000d'),
              seriesInstanceUID: dataSet.string('x0020000e'),
              modality: dataSet.string('x00080060'),
              patientName: dataSet.string('x00100010'),
              studyDate: dataSet.string('x00080020'),
              rows: dataSet.uint16('x00280010'),
              columns: dataSet.uint16('x00280011'),
              pixelSpacing: dataSet.string('x00280030')
            };
            
            debugLogger.success('DICOM 파싱 성공', dicomInfo);

            // Blob URL 생성
            const blob = new Blob([byteArray], { type: 'application/dicom' });
            const url = URL.createObjectURL(blob);
            const imageId = `wadouri:${url}`;
            
            imageIds.push(imageId);
            debugLogger.success(`ImageID 생성 완료: ${imageId.substring(0, 50)}...`);
            debugLogger.timeEnd(`파일 처리 ${i + 1}`);

          } catch (parseError) {
            debugLogger.timeEnd(`파일 처리 ${i + 1}`);
            debugLogger.error('DICOM 파싱 실패', {
              fileName: file.name,
              error: parseError,
              fileSize: byteArray.length,
              fileType: file.type
            });
            throw new Error(`DICOM 파싱 실패 (${file.name}): ${parseError instanceof Error ? parseError.message : String(parseError)}`);
          }

        } catch (fileError) {
          debugLogger.timeEnd(`파일 처리 ${i + 1}`);
          debugLogger.error('파일 읽기 실패', {
            fileName: file.name,
            error: fileError
          });
          throw new Error(`파일 읽기 실패 (${file.name}): ${fileError instanceof Error ? fileError.message : String(fileError)}`);
        }
      }

      if (imageIds.length === 0) {
        throw new Error('처리할 수 있는 DICOM 파일이 없습니다');
      }

      debugLogger.log(`${imageIds.length}개 이미지로 스택 생성 시작`);
      debugLogger.time('스택 설정 및 렌더링');

      // 뷰포트에 스택 설정 - 강화된 에러 핸들링
      try {
        debugLogger.log('뷰포트 스택 설정 시작', {
          imageIds: imageIds.map(id => id.substring(0, 50) + '...'),
          imageCount: imageIds.length
        });

        await viewport.setStack(imageIds);
        debugLogger.success('스택 설정 완료');

        // 렌더링 시도
        try {
          debugLogger.log('뷰포트 렌더링 시작');
          viewport.render();
          debugLogger.success('렌더링 완료');
          
          // 최종 성공 로깅
          debugLogger.timeEnd('스택 설정 및 렌더링');
          debugLogger.timeEnd('DICOM 파일 처리');
          debugLogger.logMemoryUsage();
          
          debugLogger.success(`DICOM 렌더링 최종 완료`, {
            fileCount: files.length,
            imageCount: imageIds.length
          });
          
          onSuccess(`${files.length}개 DICOM 파일이 성공적으로 렌더링되었습니다`);

        } catch (renderError) {
          debugLogger.timeEnd('스택 설정 및 렌더링');
          debugLogger.timeEnd('DICOM 파일 처리');
          debugLogger.error('뷰포트 렌더링 실패', {
            error: renderError,
            viewportId,
            imageCount: imageIds.length
          });
          throw new Error(`렌더링 실패: ${renderError instanceof Error ? renderError.message : String(renderError)}`);
        }

      } catch (stackError) {
        debugLogger.timeEnd('스택 설정 및 렌더링');
        debugLogger.timeEnd('DICOM 파일 처리');
        debugLogger.error('스택 설정 실패', {
          error: stackError,
          viewportId,
          imageIds: imageIds.map(id => id.substring(0, 50) + '...')
        });
        throw new Error(`스택 설정 실패: ${stackError instanceof Error ? stackError.message : String(stackError)}`);
      }

    } catch (error) {
      debugLogger.timeEnd('DICOM 파일 처리');
      debugLogger.error('DICOM 파일 로드/렌더링 최종 실패', error);
      debugLogger.dumpErrors(); // 모든 오류 요약 출력
      onError(`DICOM 렌더링 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

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
        console.warn('정리 중 오류:', error);
      }
    };
  }, []);

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

// React.memo로 최적화 - props가 실제로 변경될 때만 리렌더링
export const DicomRenderer = memo(DicomRendererComponent, (prevProps, nextProps) => {
  // files 배열 비교 (길이와 내용 모두)
  if (prevProps.files.length !== nextProps.files.length) {
    debugLogger.log('DicomRenderer: 파일 개수 변경으로 리렌더링', {
      prev: prevProps.files.length,
      next: nextProps.files.length
    });
    return false; // 리렌더링 필요
  }

  // 파일 내용 비교 (이름과 크기로 간단히)
  for (let i = 0; i < prevProps.files.length; i++) {
    if (prevProps.files[i].name !== nextProps.files[i].name || 
        prevProps.files[i].size !== nextProps.files[i].size) {
      debugLogger.log('DicomRenderer: 파일 내용 변경으로 리렌더링');
      return false; // 리렌더링 필요
    }
  }

  // activeTool은 더 이상 props가 아니므로 Zustand 스토어에서 관리됨
  // 콜백 함수들은 참조 비교하지 않음 (함수형 컴포넌트에서 매번 새로 생성되기 때문)
  
  debugLogger.log('DicomRenderer: props 변경 없음 - 리렌더링 건너뜀');
  return true; // 리렌더링 건너뜀
});