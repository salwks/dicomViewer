import { memo } from 'react';
import { DicomViewport } from './DicomViewport';
import { useDicomLoader } from '../hooks/use-dicom-loader';
import { debugLogger } from '../utils/debug-logger';

interface DicomRendererProps {
  files: File[];
  onError: (error: string) => void;
  onSuccess: (message: string) => void;
}

/**
 * 🔧 리팩토링된 DicomRenderer:
 * - DicomViewport: 뷰포트 초기화 (한 번만 실행)
 * - useDicomLoader: 이미지 로딩 (파일 변경 시마다 실행)
 * 
 * 이 구조로 뷰포트가 파괴되지 않고, 이미지만 교체됩니다.
 */
const DicomRendererComponent = ({ files, onError, onSuccess }: DicomRendererProps) => {
  debugLogger.log('🏗️ DicomRenderer 렌더링', { 
    fileCount: files.length,
    fileNames: files.map(f => f.name),
    timestamp: new Date().toISOString()
  });

  // 이미지 로딩 훅 (뷰포트와 분리)
  useDicomLoader({ files, onError, onSuccess });

  return (
    <DicomViewport 
      onError={onError}
      onSuccess={onSuccess}
    />
  );
};

// React.memo로 최적화 - 파일이 실제로 변경될 때만 리렌더링
export const DicomRenderer = memo(DicomRendererComponent, (prevProps, nextProps) => {
  // 🔥 핵심: 같은 파일 재로드 시에도 강제 리렌더링 허용
  
  // files 배열 비교 (길이와 내용 모두)
  if (prevProps.files.length !== nextProps.files.length) {
    debugLogger.log('DicomRenderer: 파일 개수 변경으로 리렌더링', {
      prev: prevProps.files.length,
      next: nextProps.files.length
    });
    return false; // 리렌더링 필요
  }

  // 빈 배열이면 항상 리렌더링 허용
  if (nextProps.files.length === 0) {
    debugLogger.log('DicomRenderer: 빈 파일 배열 - 리렌더링 허용');
    return false;
  }

  // 파일 내용 비교 (이름과 크기로 간단히)
  for (let i = 0; i < prevProps.files.length; i++) {
    if (prevProps.files[i].name !== nextProps.files[i].name || 
        prevProps.files[i].size !== nextProps.files[i].size || 
        prevProps.files[i].lastModified !== nextProps.files[i].lastModified) {
      debugLogger.log('DicomRenderer: 파일 내용 변경으로 리렌더링');
      return false; // 리렌더링 필요
    }
  }

  debugLogger.log('DicomRenderer: props 변경 없음 - 리렌더링 건너뜀');
  return true; // 리렌더링 건너뜀
});