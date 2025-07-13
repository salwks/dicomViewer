import { useEffect, useRef } from 'react';
import { 
  RenderingEngine, 
  Types,
  Enums,
  getRenderingEngine,
  imageLoader,
  metaData
} from '@cornerstonejs/core';
import { 
  ToolGroupManager,
  PanTool,
  ZoomTool,
  WindowLevelTool,
  StackScrollTool,
  addTool,
  Enums as ToolEnums
} from '@cornerstonejs/tools';
import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';
import dicomParser from 'dicom-parser';
import { debugLogger } from '../utils/debug-logger';

interface DicomRendererProps {
  files: File[];
  onError: (error: string) => void;
  onSuccess: (message: string) => void;
}

export function DicomRenderer({ files, onError, onSuccess }: DicomRendererProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const renderingEngineRef = useRef<RenderingEngine | null>(null);
  const toolGroupRef = useRef<any>(null);
  const isInitializedRef = useRef(false);

  // Cornerstone3D 초기화
  useEffect(() => {
    const initializeCornerstone = async () => {
      if (isInitializedRef.current) return;

      try {
        debugLogger.log('Cornerstone3D 초기화 시작');
        debugLogger.time('Cornerstone3D 초기화');

        // Core 초기화
        const { init: csRenderInit } = await import('@cornerstonejs/core');
        await csRenderInit();
        debugLogger.success('Cornerstone3D Core 초기화 완료');

        // Tools 초기화
        const { init: csToolsInit } = await import('@cornerstonejs/tools');
        await csToolsInit();
        debugLogger.success('Cornerstone3D Tools 초기화 완료');

        // DICOM Image Loader 설정
        cornerstoneDICOMImageLoader.external.cornerstone = await import('@cornerstonejs/core');
        cornerstoneDICOMImageLoader.external.dicomParser = dicomParser;

        // 이미지 로더 등록
        imageLoader.registerImageLoader('wadouri', cornerstoneDICOMImageLoader.wadouri.loadImage);
        imageLoader.registerImageLoader('wadors', cornerstoneDICOMImageLoader.wadors.loadImage);

        debugLogger.success('DICOM Image Loader 설정 완료');

        // 도구 추가
        addTool(PanTool);
        addTool(ZoomTool);
        addTool(WindowLevelTool);
        addTool(StackScrollTool);

        debugLogger.success('도구 등록 완료');

        debugLogger.timeEnd('Cornerstone3D 초기화');
        debugLogger.logMemoryUsage();
        
        isInitializedRef.current = true;
        onSuccess('Cornerstone3D 초기화 완료');

      } catch (error) {
        debugLogger.timeEnd('Cornerstone3D 초기화');
        debugLogger.error('Cornerstone3D 초기화 실패', error);
        onError(`Cornerstone3D 초기화 실패: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    initializeCornerstone();
  }, [onError, onSuccess]);

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

        // 도구 추가 및 설정
        toolGroup.addTool(WindowLevelTool.toolName);
        toolGroup.addTool(PanTool.toolName);
        toolGroup.addTool(ZoomTool.toolName);
        toolGroup.addTool(StackScrollTool.toolName);

        // 도구 활성화
        toolGroup.setToolActive(WindowLevelTool.toolName, {
          bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }]
        });
        
        toolGroup.setToolActive(PanTool.toolName, {
          bindings: [{ mouseButton: ToolEnums.MouseBindings.Auxiliary }]
        });
        
        toolGroup.setToolActive(ZoomTool.toolName, {
          bindings: [{ mouseButton: ToolEnums.MouseBindings.Secondary }]
        });

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
}