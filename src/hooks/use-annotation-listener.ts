import { useEffect, useState } from 'react';
import { eventTarget } from '@cornerstonejs/core';
import { debugLogger } from '../utils/debug-logger';

export interface AnnotationInfo {
  annotationUID: string;
  toolName: string;
  data?: any;
  metadata?: any;
}

/**
 * Cornerstone3D 주석 이벤트를 감지하는 훅
 */
export function useAnnotationListener() {
  const [annotations, setAnnotations] = useState<AnnotationInfo[]>([]);

  useEffect(() => {
    const handleAnnotationAdded = (event: any) => {
      debugLogger.log('주석 추가됨', event.detail);
      
      const annotation = event.detail.annotation;
      if (annotation) {
        const annotationInfo: AnnotationInfo = {
          annotationUID: annotation.annotationUID || `annotation-${Date.now()}`,
          toolName: annotation.metadata?.toolName || 'Unknown',
          data: annotation.data,
          metadata: annotation.metadata
        };

        setAnnotations(prev => {
          // 중복 방지
          const exists = prev.find(a => a.annotationUID === annotationInfo.annotationUID);
          if (exists) return prev;
          
          return [...prev, annotationInfo];
        });
      }
    };

    const handleAnnotationModified = (event: any) => {
      debugLogger.log('주석 수정됨', event.detail);
      
      const annotation = event.detail.annotation;
      if (annotation && annotation.annotationUID) {
        setAnnotations(prev => 
          prev.map(a => 
            a.annotationUID === annotation.annotationUID 
              ? { ...a, data: annotation.data, metadata: annotation.metadata }
              : a
          )
        );
      }
    };

    const handleAnnotationRemoved = (event: any) => {
      debugLogger.log('주석 제거됨', event.detail);
      
      const annotation = event.detail.annotation;
      if (annotation && annotation.annotationUID) {
        setAnnotations(prev => 
          prev.filter(a => a.annotationUID !== annotation.annotationUID)
        );
      }
    };

    // Cornerstone3D 이벤트 리스너 등록
    eventTarget.addEventListener('ANNOTATION_ADDED', handleAnnotationAdded);
    eventTarget.addEventListener('ANNOTATION_MODIFIED', handleAnnotationModified);
    eventTarget.addEventListener('ANNOTATION_REMOVED', handleAnnotationRemoved);

    // 또는 DOM 이벤트 방식도 지원
    document.addEventListener('cornerstoneAnnotationAdded', handleAnnotationAdded);
    document.addEventListener('cornerstoneAnnotationModified', handleAnnotationModified);
    document.addEventListener('cornerstoneAnnotationRemoved', handleAnnotationRemoved);

    debugLogger.log('주석 이벤트 리스너 등록됨');

    return () => {
      eventTarget.removeEventListener('ANNOTATION_ADDED', handleAnnotationAdded);
      eventTarget.removeEventListener('ANNOTATION_MODIFIED', handleAnnotationModified);
      eventTarget.removeEventListener('ANNOTATION_REMOVED', handleAnnotationRemoved);

      document.removeEventListener('cornerstoneAnnotationAdded', handleAnnotationAdded);
      document.removeEventListener('cornerstoneAnnotationModified', handleAnnotationModified);
      document.removeEventListener('cornerstoneAnnotationRemoved', handleAnnotationRemoved);

      debugLogger.log('주석 이벤트 리스너 제거됨');
    };
  }, []);

  const clearAllAnnotations = () => {
    setAnnotations([]);
    debugLogger.log('모든 주석 정보 초기화');
  };

  return {
    annotations,
    clearAllAnnotations,
    annotationCount: annotations.length
  };
}