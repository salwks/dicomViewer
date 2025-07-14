import { useEffect, useRef } from 'react';
import { Types, getRenderingEngine } from '@cornerstonejs/core';
import dicomParser from 'dicom-parser';
import { debugLogger } from '../utils/debug-logger';
import { useDicomStore } from '../store/dicom-store';

interface UseDicomLoaderProps {
  files: File[];
  onError: (error: string) => void;
  onSuccess: (message: string) => void;
}

/**
 * DICOM 파일 로딩만 담당하는 훅
 * 뷰포트는 별도로 관리되며, 여기서는 이미지 데이터만 로드하고 setStack 호출
 */
export function useDicomLoader({ files, onError, onSuccess }: UseDicomLoaderProps) {
  const loadingRef = useRef(false);

  // 파일이 변경될 때마다 이미지 로딩 수행
  useEffect(() => {
    // 🔥 핵심: 새 파일 배열이 들어올 때 loadingRef 강제 초기화
    if (files.length === 0) {
      loadingRef.current = false;
      debugLogger.log('📋 파일 없음 - loadingRef 초기화');
      return;
    }
    
    if (loadingRef.current) {
      debugLogger.log('⚠️ 이미 로딩 중이므로 건너뜀');
      return;
    }

    const loadDicomImages = async () => {
      loadingRef.current = true;
      
      try {
        debugLogger.log('📁 DICOM 파일 로딩 시작', { fileCount: files.length });
        debugLogger.time('DICOM 파일 처리');

        // 렌더링 엔진과 뷰포트 가져오기
        const renderingEngine = getRenderingEngine('dicom-rendering-engine');
        if (!renderingEngine) {
          throw new Error('렌더링 엔진이 초기화되지 않았습니다. 뷰포트를 먼저 초기화해주세요.');
        }

        const viewport = renderingEngine.getViewport('dicom-viewport') as Types.IStackViewport;
        if (!viewport) {
          throw new Error('뷰포트를 찾을 수 없습니다.');
        }

        // 파일을 imageIds로 변환
        const imageIds: string[] = [];
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          debugLogger.progress('파일 처리', i + 1, files.length, file.name);

          try {
            debugLogger.time(`파일 처리 ${i + 1}`);
            
            // ArrayBuffer로 읽기
            const arrayBuffer = await file.arrayBuffer();
            const byteArray = new Uint8Array(arrayBuffer);

            debugLogger.log(`파일 정보:`, {
              fileName: file.name,
              fileSize: byteArray.length,
              fileType: file.type
            });

            // DICOM 파싱 검증
            try {
              const dataSet = dicomParser.parseDicom(byteArray);
              
              // 🔥 첫 번째 파일의 dataSet을 스토어에 저장 (Meta Tag 표시용)
              if (i === 0) {
                const { setDicomDataSet } = useDicomStore.getState();
                setDicomDataSet(dataSet);
                debugLogger.log('💾 첫 번째 파일의 DICOM 데이터셋 스토어에 저장');
              }
              
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

              // Blob URL 생성 (웹 워커에서 처리 가능)
              const blob = new Blob([byteArray], { type: 'application/dicom' });
              const url = URL.createObjectURL(blob);
              const imageId = `wadouri:${url}`;
              
              imageIds.push(imageId);
              debugLogger.success(`ImageID 생성: ${imageId.substring(0, 50)}...`);
              debugLogger.timeEnd(`파일 처리 ${i + 1}`);

            } catch (parseError) {
              debugLogger.timeEnd(`파일 처리 ${i + 1}`);
              debugLogger.error('DICOM 파싱 실패', {
                fileName: file.name,
                error: parseError,
                fileSize: byteArray.length
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
          throw new Error('처리할 수 있는 DICOM 파일이 없습니다.');
        }

        debugLogger.log(`🎯 ${imageIds.length}개 이미지로 스택 설정 시작`);
        debugLogger.time('스택 설정 및 렌더링');

        // 🔧 뷰포트에 스택 설정 (기존 뷰포트 재사용)
        try {
          debugLogger.log('뷰포트 스택 설정 시작', {
            imageCount: imageIds.length
          });

          await viewport.setStack(imageIds);
          debugLogger.success('✅ 스택 설정 완료');

          // 렌더링
          viewport.render();
          debugLogger.success('✅ 렌더링 완료');
          
          debugLogger.timeEnd('스택 설정 및 렌더링');
          debugLogger.timeEnd('DICOM 파일 처리');
          debugLogger.logMemoryUsage();
          
          debugLogger.success(`🎉 DICOM 로딩 최종 완료`, {
            fileCount: files.length,
            imageCount: imageIds.length
          });
          
          onSuccess(`${files.length}개 DICOM 파일이 성공적으로 로드되었습니다`);

        } catch (stackError) {
          debugLogger.timeEnd('스택 설정 및 렌더링');
          debugLogger.error('스택 설정 실패', {
            error: stackError,
            imageCount: imageIds.length
          });
          throw new Error(`스택 설정 실패: ${stackError instanceof Error ? stackError.message : String(stackError)}`);
        }

      } catch (error) {
        debugLogger.timeEnd('DICOM 파일 처리');
        debugLogger.error('DICOM 파일 로딩 최종 실패', error);
        debugLogger.dumpErrors();
        onError(`DICOM 로딩 실패: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        loadingRef.current = false;
      }
    };

    // 약간의 지연을 두어 뷰포트 초기화가 완료된 후 실행
    const timeoutId = setTimeout(() => {
      loadDicomImages();
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      loadingRef.current = false;
      debugLogger.log('🧹 useDicomLoader cleanup - loadingRef 초기화');
    };

  }, [files, onError, onSuccess, files.length, ...files.map(f => f.name + f.size)]);
}