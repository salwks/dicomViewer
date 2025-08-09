/**
 * HeaderNavigation - 헤더 네비게이션 (모드 전환 포함)
 * 새로운 ViewerContext 아키텍처 기반으로 리팩토링
 * 매끄러운 모드 전환 UI 제공
 */

import React, { useCallback, useRef } from 'react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { useViewer } from '../context/ViewerContext';
import { Settings } from 'lucide-react';
import { log } from '../utils/logger';
import { simpleDicomLoader } from '../services/simpleDicomLoader';

interface HeaderNavigationProps {
  className?: string;
  onTestModeToggle?: () => void;
  showTestButton?: boolean;
}

export const HeaderNavigation: React.FC<HeaderNavigationProps> = ({ className, onTestModeToggle, showTestButton = true }) => {
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

      // SidePanelSystem에 새로운 DICOM 파일이 로드되었음을 알림
      window.dispatchEvent(new CustomEvent('dicom-files-loaded', {
        detail: {
          seriesCount: seriesData.length,
          studyCount: new Set(seriesData.map(s => s.studyInstanceUID)).size,
          files: loadedFiles.length,
        },
      }));
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

        {/* 우측 액션 버튼들 */}
        <div className='flex items-center space-x-2'>
          {showTestButton && onTestModeToggle && (
            <Button variant='secondary' size='sm' onClick={onTestModeToggle}>
              DICOM 테스트
            </Button>
          )}
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
