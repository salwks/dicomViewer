/**
 * HeaderNavigation - 헤더 네비게이션 (모드 전환 포함)
 * 새로운 ViewerContext 아키텍처 기반으로 리팩토링
 * 매끄러운 모드 전환 UI 제공
 */

import React, { useCallback, useRef } from 'react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { useViewer, useViewerLayout, useSynchronization } from '../context/ViewerContext';
import { LayoutSelector } from './LayoutSelector';
import { Settings } from 'lucide-react';
import { log } from '../utils/logger';
import { simpleDicomLoader } from '../services/simpleDicomLoader';

interface HeaderNavigationProps {
  className?: string;
}

// 뷰어 레이아웃 컨트롤 컴포넌트 (LayoutSelector 사용)
const ViewerLayoutControls: React.FC = () => {
  const { switchToSingleLayout, switchToSideBySideLayout, switchToQuadLayout, setLayout } = useViewer();
  const layout = useViewerLayout();
  const { isEnabled: syncEnabled } = useSynchronization();

  // ViewerLayout의 rows/cols를 LayoutSelector의 ViewportLayout 타입으로 변환
  const getCurrentLayoutType = useCallback(() => {
    const { rows, cols } = layout;
    if (rows === 1 && cols === 1) return '1x1';
    if (rows === 1 && cols === 2) return '1x2';
    if (rows === 2 && cols === 1) return '2x1';
    if (rows === 2 && cols === 2) return '2x2';
    return '1x1'; // 기본값
  }, [layout]);

  // LayoutSelector에서 레이아웃 변경 시 호출되는 핸들러
  const handleLayoutChange = useCallback((layoutType: '1x1' | '1x2' | '2x1' | '2x2' | '1x3' | '3x1' | '2x3' | '3x2') => {
    switch (layoutType) {
      case '1x1':
        switchToSingleLayout();
        log.info('Switched to single layout (1x1)', {
          component: 'HeaderNavigation',
        });
        break;
      case '1x2':
        switchToSideBySideLayout();
        log.info('Switched to side-by-side layout (1x2)', {
          component: 'HeaderNavigation',
        });
        break;
      case '2x1':
        setLayout({ rows: 2, cols: 1 });
        log.info('Switched to top/bottom layout (2x1)', {
          component: 'HeaderNavigation',
        });
        break;
      case '2x2':
        switchToQuadLayout();
        log.info('Switched to quad layout (2x2)', {
          component: 'HeaderNavigation',
        });
        break;
      default:
        log.warn('Unsupported layout type', {
          component: 'HeaderNavigation',
          layoutType,
        });
    }
  }, [switchToSingleLayout, switchToSideBySideLayout, switchToQuadLayout, setLayout]);

  const getLayoutDisplayName = (layout: { rows: number; cols: number }) => {
    const { rows, cols } = layout;
    if (rows === 1 && cols === 1) return '단일 뷰어';
    if (rows === 1 && cols === 2) return '좌우 분할';
    if (rows === 2 && cols === 1) return '상하 분할';
    if (rows === 2 && cols === 2) return '4분할 뷰어';
    return `${rows}×${cols} 뷰어`;
  };

  return (
    <div className='flex items-center space-x-4'>
      {/* 현재 레이아웃 표시 */}
      <div className='flex items-center space-x-2'>
        <Badge variant='secondary' className='text-xs'>
          {getLayoutDisplayName(layout)}
        </Badge>
        <Badge variant='outline' className='text-xs'>
          {layout.rows}×{layout.cols}
        </Badge>
        {(layout.rows > 1 || layout.cols > 1) && syncEnabled && (
          <Badge variant='default' className='text-xs'>
            동기화
          </Badge>
        )}
      </div>

      {/* LayoutSelector 컴포넌트 사용 */}
      <LayoutSelector
        currentLayout={getCurrentLayoutType()}
        onLayoutChange={handleLayoutChange}
        className="flex items-center"
      />
    </div>
  );
};

export const HeaderNavigation: React.FC<HeaderNavigationProps> = ({ className }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { loadStudy } = useViewer();

  const handleDicomUpload = useCallback(async () => {
    console.log('🔥 DICOM Upload button clicked!');
    log.info('DICOM Upload button clicked', {
      component: 'HeaderNavigation',
    });
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🔥 File selection changed!', event.target.files);
    const files = event.target.files;
    if (!files || files.length === 0) {
      console.log('🔥 No files selected');
      return;
    }

    const startTime = Date.now();

    try {
      log.info('Starting DICOM file upload', {
        component: 'HeaderNavigation',
        metadata: { fileCount: files.length },
      });

      // Convert FileList to Array
      const fileArray = Array.from(files);

      // Load files through simpleDicomLoader (optimized)
      const loadedFiles = await simpleDicomLoader.loadFiles(fileArray);

      if (loadedFiles.length === 0) {
        log.warn('No valid DICOM files found', {
          component: 'HeaderNavigation',
        });
        return;
      }

      // Get series data (fast operation now)
      const seriesData = await simpleDicomLoader.getSeriesData();

      if (seriesData.length === 0) {
        log.warn('No series data found', {
          component: 'HeaderNavigation',
        });
        return;
      }

      // Load the first series into the viewer
      const firstSeries = seriesData[0];
      await loadStudy(firstSeries.studyInstanceUID, firstSeries.seriesInstanceUID);

      const totalTime = Date.now() - startTime;

      log.info('DICOM files loaded successfully', {
        component: 'HeaderNavigation',
        metadata: {
          seriesCount: seriesData.length,
          totalFrames: loadedFiles.length,
          firstSeriesUID: firstSeries.seriesInstanceUID,
          studyUID: firstSeries.studyInstanceUID,
          totalLoadTime: `${totalTime}ms`,
          averageTimePerFile: `${Math.round(totalTime / fileArray.length)}ms`,
        },
      });
    } catch (error) {
      log.error(
        'Failed to load DICOM files',
        {
          component: 'HeaderNavigation',
          metadata: { fileCount: files.length },
        },
        error as Error,
      );
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [loadStudy]);

  return (
    <Card
      className={cn(
        'sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className,
      )}
    >
      <div className='flex h-16 items-center justify-between px-6'>
        {/* 로고와 브랜드 */}
        <div className='flex items-center space-x-4'>
          <div className='flex items-center space-x-3'>
            <div className='h-8 w-8 rounded-md bg-primary flex items-center justify-center'>
              <span className='text-primary-foreground font-bold text-sm'>C3D</span>
            </div>
            <div>
              <h1 className='font-semibold text-lg'>통합 뷰어</h1>
              <p className='text-xs text-muted-foreground'>Cornerstone3D Medical Viewer</p>
            </div>
          </div>
        </div>

        {/* 뷰어 레이아웃 컨트롤 (중앙) */}
        <ViewerLayoutControls />

        {/* 우측 액션 버튼들 */}
        <div className='flex items-center space-x-2'>
          <Button variant='outline' size='sm' className='gap-2'>
            <Settings className='h-4 w-4' />
            <span className='hidden sm:inline'>설정</span>
          </Button>
          <Button size='sm' onClick={handleDicomUpload}>
            DICOM 열기
          </Button>
          <input
            ref={fileInputRef}
            type='file'
            multiple
            accept='.dcm,.dicom,application/dicom'
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>
    </Card>
  );
};
