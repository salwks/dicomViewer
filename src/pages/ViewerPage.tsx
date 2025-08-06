/**
 * ViewerPage Component
 * 통합 DICOM 뷰어 페이지 - 새로운 ViewerContext 아키텍처 사용
 * shadcn/ui 컴포넌트로 구축됨
 */

import React from 'react';
import { UnifiedViewer } from '../components/UnifiedViewer';
import { log } from '../utils/logger';

export const ViewerPage: React.FC = () => {
  React.useEffect(() => {
    log.info('ViewerPage mounted', {
      component: 'ViewerPage',
      metadata: {
        architecture: 'unified-viewer-context',
      },
    });

    return () => {
      log.info('ViewerPage unmounted', {
        component: 'ViewerPage',
      });
    };
  }, []);

  return <UnifiedViewer />;
};
