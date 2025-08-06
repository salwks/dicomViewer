/**
 * ViewportAssignmentPanel Component
 * 뷰포트별 시리즈 할당 관리 패널
 * 드래그 앤 드롭 및 빠른 할당 기능 제공
 * Built with shadcn/ui components
 */

import React, { useState, useCallback } from 'react';
import { cn, safePropertyAccess } from '@/lib/utils';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import type { ViewerMode } from '@/types/viewer';
import { Monitor, X, ArrowRight, Grid, RefreshCw, Folder, FileImage } from 'lucide-react';

interface ViewportAssignmentPanelProps {
  viewportIds: string[];
  layout: ViewerMode['layout'];
  onAssignment: (viewportId: string, seriesInstanceUID: string) => void;
  activeViewportId: string | null;
  className?: string;
}

interface SeriesInfo {
  seriesInstanceUID: string;
  seriesDescription: string;
  modality: string;
  imageCount: number;
  thumbnailUrl?: string;
  studyDate?: string;
}

interface ViewportAssignment {
  viewportId: string;
  seriesInstanceUID?: string;
  seriesInfo?: SeriesInfo;
}

// 샘플 시리즈 데이터 (실제로는 DICOM 서비스에서 가져와야 함)
const SAMPLE_SERIES: SeriesInfo[] = [
  {
    seriesInstanceUID: '1.2.3.4.5.1001',
    seriesDescription: 'Chest CT - Axial',
    modality: 'CT',
    imageCount: 256,
    studyDate: '2024-01-15',
  },
  {
    seriesInstanceUID: '1.2.3.4.5.1002',
    seriesDescription: 'Chest CT - Sagittal',
    modality: 'CT',
    imageCount: 256,
    studyDate: '2024-01-15',
  },
  {
    seriesInstanceUID: '1.2.3.4.5.1003',
    seriesDescription: 'Chest CT - Coronal',
    modality: 'CT',
    imageCount: 256,
    studyDate: '2024-01-15',
  },
  {
    seriesInstanceUID: '1.2.3.4.5.2001',
    seriesDescription: 'Chest CT with Contrast',
    modality: 'CT',
    imageCount: 256,
    studyDate: '2024-01-22',
  },
];

const ViewportCard: React.FC<{
  viewportId: string;
  assignment?: ViewportAssignment | undefined;
  isActive: boolean;
  onClear: () => void;
  onDrop: (seriesInstanceUID: string) => void;
}> = ({ viewportId, assignment, isActive, onClear, onDrop }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const seriesInstanceUID = e.dataTransfer.getData('text/plain');
    if (seriesInstanceUID) {
      onDrop(seriesInstanceUID);
    }
  };

  const displayName = viewportId.replace('comparison-viewport-', 'Viewport ');

  return (
    <div
      className={cn(
        'cursor-pointer min-h-[120px] border rounded-lg p-4',
        isActive && 'ring-2 ring-primary',
        isDragOver && 'ring-2 ring-blue-500 bg-blue-50/50',
        assignment?.seriesInfo && 'bg-green-50/30',
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className='pb-2'>
        <div className='flex items-center justify-between'>
          <div className='text-sm font-medium flex items-center gap-2'>
            <Monitor className='h-4 w-4' />
            {displayName}
          </div>
          {assignment?.seriesInfo && (
            <Button variant='ghost' size='icon' onClick={onClear} className='h-6 w-6'>
              <X className='h-3 w-3' />
            </Button>
          )}
        </div>
      </div>

      <div className='pt-0'>
        {assignment?.seriesInfo ? (
          <div className='space-y-2'>
            <div className='flex items-center gap-2'>
              <Badge variant='secondary' className='text-xs'>
                {assignment.seriesInfo.modality}
              </Badge>
              <span className='text-xs text-muted-foreground'>{assignment.seriesInfo.imageCount} images</span>
            </div>
            <p className='text-sm font-medium truncate'>{assignment.seriesInfo.seriesDescription}</p>
            <p className='text-xs text-muted-foreground'>{assignment.seriesInfo.studyDate}</p>
          </div>
        ) : (
          <div className='flex flex-col items-center justify-center py-4 text-muted-foreground'>
            <FileImage className='h-8 w-8 mb-2 opacity-50' />
            <p className='text-xs text-center'>Drop series here or use quick assign</p>
          </div>
        )}
      </div>
    </div>
  );
};

const SeriesItem: React.FC<{
  series: SeriesInfo;
  isAssigned: boolean;
  onAssign: (seriesInstanceUID: string) => void;
}> = ({ series, isAssigned, onAssign }) => {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', series.seriesInstanceUID);
  };

  return (
    <div
      className={cn('cursor-move border rounded-lg p-3', isAssigned && 'opacity-50 bg-muted')}
      draggable={!isAssigned}
      onDragStart={handleDragStart}
    >
      <div className='flex items-start justify-between'>
        <div className='flex-1 space-y-1'>
          <div className='flex items-center gap-2'>
            <Badge variant='outline' className='text-xs'>
              {series.modality}
            </Badge>
            <span className='text-xs text-muted-foreground'>{series.imageCount} images</span>
          </div>
          <p className='text-sm font-medium truncate'>{series.seriesDescription}</p>
          <p className='text-xs text-muted-foreground'>{series.studyDate}</p>
        </div>

        {!isAssigned && (
          <Button
            variant='ghost'
            size='sm'
            onClick={() => {
              onAssign(series.seriesInstanceUID);
            }}
            className='h-8 w-8 p-0'
          >
            <ArrowRight className='h-3 w-3' />
          </Button>
        )}
      </div>
    </div>
  );
};

export const ViewportAssignmentPanel: React.FC<ViewportAssignmentPanelProps> = ({
  viewportIds,
  layout,
  onAssignment,
  activeViewportId,
  className,
}) => {
  const [assignments, setAssignments] = useState<Map<string, ViewportAssignment>>(
    new Map(viewportIds.map(id => [id, { viewportId: id }])),
  );

  const handleAssignment = useCallback(
    (viewportId: string, seriesInstanceUID: string) => {
      const seriesInfo = SAMPLE_SERIES.find(s => s.seriesInstanceUID === seriesInstanceUID);

      if (seriesInfo) {
        setAssignments(prev => {
          const newAssignments = new Map(prev);
          newAssignments.set(viewportId, {
            viewportId,
            seriesInstanceUID,
            seriesInfo,
          });
          return newAssignments;
        });

        onAssignment(viewportId, seriesInstanceUID);
      }
    },
    [onAssignment],
  );

  const handleClearAssignment = useCallback((viewportId: string) => {
    setAssignments(prev => {
      const newAssignments = new Map(prev);
      newAssignments.set(viewportId, { viewportId });
      return newAssignments;
    });
  }, []);

  const handleQuickAssign = useCallback(() => {
    // 빠른 할당: 사용 가능한 시리즈를 순서대로 뷰포트에 할당
    const availableSeries = SAMPLE_SERIES.filter(
      series => !Array.from(assignments.values()).some(a => a.seriesInstanceUID === series.seriesInstanceUID),
    );

    viewportIds.forEach((viewportId, index) => {
      if (index < availableSeries.length && !assignments.get(viewportId)?.seriesInfo) {
        const series = safePropertyAccess(availableSeries, index);
        if (series) {
          handleAssignment(viewportId, series.seriesInstanceUID);
        }
      }
    });
  }, [assignments, viewportIds, handleAssignment]);

  const handleClearAll = useCallback(() => {
    setAssignments(new Map(viewportIds.map(id => [id, { viewportId: id }])));
  }, [viewportIds]);

  const assignedSeriesIds = new Set(
    Array.from(assignments.values())
      .map(a => a.seriesInstanceUID)
      .filter(Boolean),
  );

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* 빠른 작업 버튼 */}
      <div className='flex items-center gap-2 mb-4'>
        <Button variant='outline' size='sm' onClick={handleQuickAssign} className='flex-1'>
          <Grid className='h-4 w-4 mr-2' />
          Quick Assign
        </Button>
        <Button variant='outline' size='sm' onClick={handleClearAll}>
          <RefreshCw className='h-4 w-4' />
        </Button>
      </div>

      {/* 뷰포트 할당 영역 */}
      <div className='space-y-3 mb-4'>
        <h3 className='text-sm font-medium flex items-center gap-2'>
          <Monitor className='h-4 w-4' />
          Viewports ({layout})
        </h3>

        <div className='space-y-2'>
          {viewportIds.map(viewportId => (
            <ViewportCard
              key={viewportId}
              viewportId={viewportId}
              assignment={assignments.get(viewportId)}
              isActive={viewportId === activeViewportId}
              onClear={() => {
                handleClearAssignment(viewportId);
              }}
              onDrop={seriesInstanceUID => {
                handleAssignment(viewportId, seriesInstanceUID);
              }}
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* 사용 가능한 시리즈 목록 */}
      <div className='flex-1 flex flex-col mt-4 min-h-0'>
        <div className='flex items-center justify-between mb-3'>
          <h3 className='text-sm font-medium flex items-center gap-2'>
            <Folder className='h-4 w-4' />
            Available Series
          </h3>
          <Badge variant='secondary' className='text-xs'>
            {SAMPLE_SERIES.length - assignedSeriesIds.size} available
          </Badge>
        </div>

        <ScrollArea className='flex-1'>
          <div className='space-y-2 pr-4'>
            {SAMPLE_SERIES.map(series => (
              <SeriesItem
                key={series.seriesInstanceUID}
                series={series}
                isAssigned={assignedSeriesIds.has(series.seriesInstanceUID)}
                onAssign={seriesInstanceUID => {
                  // 첫 번째 빈 뷰포트에 할당
                  const emptyViewportId = viewportIds.find(id => !assignments.get(id)?.seriesInfo);
                  if (emptyViewportId) {
                    handleAssignment(emptyViewportId, seriesInstanceUID);
                  }
                }}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* 할당 상태 요약 */}
      <div className='mt-4 p-3 bg-muted/50 rounded-lg'>
        <div className='flex items-center justify-between text-xs text-muted-foreground'>
          <span>
            {Array.from(assignments.values()).filter(a => a.seriesInfo).length} / {viewportIds.length} assigned
          </span>
          <span>Drag & drop to assign</span>
        </div>
      </div>
    </div>
  );
};
