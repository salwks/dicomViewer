/**
 * Basic Viewer Component
 * Single DICOM viewer with full tool panel and series management
 */

import React, { useMemo, useCallback, useEffect } from 'react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { ThemeToggle } from '../ThemeToggle';
import { DicomViewer, DicomViewerRef } from '../DicomViewer';
import { StudySelector } from '../StudySelector';
import { useStudyManagement } from '../../hooks';
import { Separator } from '../ui/separator';
import { cn } from '../../lib/utils';

interface BasicViewerProps {
  // State props
  currentMode: string;
  setCurrentMode: (mode: string) => void;
  seriesData: any[];
  selectedSeries: number;
  activeTool: string;

  // Refs
  dicomViewerRef: React.RefObject<DicomViewerRef | null>;

  // Handlers
  handleLoadFilesClick: () => void;
  handleToolSelect: (tool: string) => void;
  handleSeriesSelect: (index: number) => void;
  handleSeriesDelete: (index: number, event: React.MouseEvent) => void;
}

export const BasicViewer: React.FC<BasicViewerProps> = ({
  currentMode,
  setCurrentMode,
  seriesData,
  selectedSeries,
  activeTool,
  dicomViewerRef,
  handleLoadFilesClick,
  handleToolSelect,
  handleSeriesSelect,
  handleSeriesDelete,
}) => {
  // Study management
  const studyManagement = useStudyManagement();

  // Transform series data to study format when it changes
  useEffect(() => {
    if (seriesData && seriesData.length > 0) {
      const studies = studyManagement.transformLegacySeriesData(seriesData);
      studyManagement.setStudies(studies);
    } else {
      studyManagement.clearStudies();
    }
  }, [seriesData, studyManagement]);

  // Handle study selection
  const handleStudySelect = useCallback((studyInstanceUID: string) => {
    studyManagement.selectStudy(studyInstanceUID);
  }, [studyManagement]);

  // Handle series selection from study management (reserved for future use)
  // const handleStudySeriesSelect = useCallback((seriesInstanceUID: string) => {
  //   studyManagement.selectSeries(seriesInstanceUID);
  //
  //   // Find the corresponding index in the legacy series data for compatibility
  //   const seriesIndex = seriesData.findIndex(s => s.seriesInstanceUID === seriesInstanceUID);
  //   if (seriesIndex >= 0) {
  //     handleSeriesSelect(seriesIndex);
  //   }
  // }, [studyManagement, seriesData, handleSeriesSelect]);

  // Filter series based on selected study
  const displayedSeries = useMemo(() => {
    if (!studyManagement.selectedStudyId) return seriesData;

    return seriesData.filter(series => {
      // If series has study information, filter by selected study
      if (series.studyInstanceUID) {
        return series.studyInstanceUID === studyManagement.selectedStudyId;
      }
      // For legacy data without study info, show all series
      return true;
    });
  }, [seriesData, studyManagement.selectedStudyId]);

  // Check if we have multi-study data
  const hasMultipleStudies = studyManagement.studyCount > 1;
  const showStudySelector = hasMultipleStudies || studyManagement.studyCount > 0;
  return (
    <div className='flex flex-col h-screen'>
      {/* Header */}
      <header className='bg-card border-b border-border px-6 py-3'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center space-x-4'>
            <h1 className='text-xl font-semibold text-foreground'>Claarity</h1>
          </div>
          <div className='flex items-center space-x-2'>
            <Select value={currentMode} onValueChange={setCurrentMode}>
              <SelectTrigger className='w-32'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='basic'>Basic</SelectItem>
                <SelectItem value='comparison'>Comparison</SelectItem>
                <SelectItem value='analysis'>Analysis</SelectItem>
              </SelectContent>
            </Select>
            <span className='text-sm text-muted-foreground'>Basic Viewer</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className='flex flex-1 overflow-hidden'>
        {/* Tool Panel */}
        <div className='w-20 bg-card border-r border-border flex flex-col items-center py-4 space-y-1 overflow-y-auto'>
          {/* Navigation Tools */}
          <div className='text-xs text-muted-foreground mb-1'>Nav</div>
          <Button
            variant={activeTool === 'WindowLevel' ? 'default' : 'outline'}
            size='icon'
            className='w-12 h-12'
            onClick={() => handleToolSelect('WindowLevel')}
            title='Window/Level'
          >
            <svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <circle cx='12' cy='12' r='10' />
              <path d='M12 2a10 10 0 0 1 0 20' fill='currentColor' opacity='0.3' />
            </svg>
          </Button>
          <Button
            variant={activeTool === 'Zoom' ? 'default' : 'outline'}
            size='icon'
            className='w-12 h-12'
            onClick={() => handleToolSelect('Zoom')}
            title='Zoom'
          >
            <svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <circle cx='11' cy='11' r='8' />
              <path d='m21 21-4.35-4.35' />
              <line x1='11' y1='8' x2='11' y2='14' />
              <line x1='8' y1='11' x2='14' y2='11' />
            </svg>
          </Button>
          <Button
            variant={activeTool === 'Pan' ? 'default' : 'outline'}
            size='icon'
            className='w-12 h-12'
            onClick={() => handleToolSelect('Pan')}
            title='Pan'
          >
            <svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20' />
            </svg>
          </Button>

          {/* Measurement Tools */}
          <div className='text-xs text-muted-foreground mt-3 mb-1'>Measure</div>
          <Button
            variant={activeTool === 'Length' ? 'default' : 'outline'}
            size='icon'
            className='w-12 h-12'
            onClick={() => handleToolSelect('Length')}
            title='Length Measurement'
          >
            <svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <line x1='4' y1='20' x2='20' y2='4' />
              <circle cx='4' cy='20' r='2' fill='currentColor' />
              <circle cx='20' cy='4' r='2' fill='currentColor' />
            </svg>
          </Button>
          <Button
            variant={activeTool === 'Bidirectional' ? 'default' : 'outline'}
            size='icon'
            className='w-12 h-12'
            onClick={() => handleToolSelect('Bidirectional')}
            title='Bidirectional Measurement'
          >
            <svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M8 12h8M12 8v8M8 8l-2 4 2 4M16 8l2 4-2 4M8 8v8M16 8v8' />
            </svg>
          </Button>
          <Button
            variant={activeTool === 'Angle' ? 'default' : 'outline'}
            size='icon'
            className='w-12 h-12'
            onClick={() => handleToolSelect('Angle')}
            title='Angle Measurement'
          >
            <svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M12 20L4 12l8-8' />
              <path d='M12 12h8' />
            </svg>
          </Button>
          <Button
            variant={activeTool === 'Height' ? 'default' : 'outline'}
            size='icon'
            className='w-12 h-12'
            onClick={() => handleToolSelect('Height')}
            title='Height Measurement'
          >
            <svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M12 3v18M9 6l3-3 3 3M9 18l3 3 3-3' />
            </svg>
          </Button>
          <Button
            variant={activeTool === 'CobbAngle' ? 'default' : 'outline'}
            size='icon'
            className='w-12 h-12'
            onClick={() => handleToolSelect('CobbAngle')}
            title='Cobb Angle'
          >
            <svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M4 20L8 4M16 4l4 16M8 8l8 0M8 16l8 0' />
            </svg>
          </Button>

          {/* ROI Tools */}
          <div className='text-xs text-muted-foreground mt-3 mb-1'>ROI</div>
          <Button
            variant={activeTool === 'RectangleROI' ? 'default' : 'outline'}
            size='icon'
            className='w-12 h-12'
            onClick={() => handleToolSelect('RectangleROI')}
            title='Rectangle ROI'
          >
            <svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <rect x='4' y='4' width='16' height='16' rx='2' />
            </svg>
          </Button>
          <Button
            variant={activeTool === 'EllipseROI' ? 'default' : 'outline'}
            size='icon'
            className='w-12 h-12'
            onClick={() => handleToolSelect('EllipseROI')}
            title='Ellipse ROI'
          >
            <svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <ellipse cx='12' cy='12' rx='8' ry='6' />
            </svg>
          </Button>
          <Button
            variant={activeTool === 'Probe' ? 'default' : 'outline'}
            size='icon'
            className='w-12 h-12'
            onClick={() => handleToolSelect('Probe')}
            title='Probe'
          >
            <svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <circle cx='12' cy='12' r='3' fill='currentColor' />
              <path d='M12 9V3M12 15v6M9 12H3M15 12h6' />
            </svg>
          </Button>
          <Button
            variant={activeTool === 'DragProbe' ? 'default' : 'outline'}
            size='icon'
            className='w-12 h-12'
            onClick={() => handleToolSelect('DragProbe')}
            title='Drag Probe'
          >
            <svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <circle cx='12' cy='12' r='2' fill='currentColor' />
              <path d='M12 10V6M12 14v4M10 12H6M14 12h4' strokeDasharray='2 2' />
            </svg>
          </Button>

          {/* Annotation Tools */}
          <div className='text-xs text-muted-foreground mt-3 mb-1'>Anno</div>
          <Button
            variant={activeTool === 'ArrowAnnotate' ? 'default' : 'outline'}
            size='icon'
            className='w-12 h-12'
            onClick={() => handleToolSelect('ArrowAnnotate')}
            title='Arrow Annotation'
          >
            <svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <line x1='5' y1='12' x2='19' y2='12' />
              <polyline points='12 5 19 12 12 19' />
            </svg>
          </Button>
          <Button
            variant={activeTool === 'Freehand' ? 'default' : 'outline'}
            size='icon'
            className='w-12 h-12'
            onClick={() => handleToolSelect('Freehand')}
            title='Freehand Drawing'
          >
            <svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z' />
            </svg>
          </Button>
        </div>

        {/* Main Viewer Area */}
        <div className='flex-1 bg-background'>
          {seriesData.length > 0 && selectedSeries < seriesData.length ? (
            <DicomViewer
              ref={dicomViewerRef}
              key={`dicom-viewer-${selectedSeries}`}
              seriesInstanceUID={
                // eslint-disable-next-line security/detect-object-injection
                seriesData.length > selectedSeries && selectedSeries >= 0 && seriesData[selectedSeries]
                  ? // eslint-disable-next-line security/detect-object-injection
                  seriesData[selectedSeries].seriesInstanceUID
                  : undefined
              }
            />
          ) : (
            <div className='flex flex-col items-center justify-center h-full space-y-8'>
              <div className='text-center space-y-4'>
                <h3 className='text-2xl font-semibold text-foreground'>Welcome to DICOM Viewer</h3>
                <p className='text-muted-foreground'>
                  Click "Load Files" button above to start viewing medical images
                </p>
              </div>
              <Button size='lg' onClick={handleLoadFilesClick}>
                Load DICOM Files
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className='w-80 bg-card border-l border-border flex flex-col'>
          {/* Sidebar Header */}
          <div className='p-4 border-b border-border'>
            <h2 className='text-lg font-semibold text-card-foreground'>Medical Data</h2>
            <p className='text-sm text-muted-foreground'>
              {studyManagement.studyCount} studies • {studyManagement.totalSeriesCount} series
            </p>
          </div>

          {/* Sidebar Content */}
          <div className='flex-1 flex flex-col overflow-hidden'>
            {/* Load Files Button - Always visible */}
            <div className='p-4 border-b border-border'>
              <Button variant='outline' onClick={handleLoadFilesClick} className='w-full'>
                Load Files
              </Button>
            </div>

            {seriesData.length === 0 ? (
              <div className='flex-1 flex items-center justify-center'>
                <div className='text-center py-8'>
                  <p className='text-muted-foreground'>No DICOM files loaded</p>
                </div>
              </div>
            ) : (
              <div className='flex-1 flex flex-col overflow-hidden'>
                {/* Study Selector - Show when we have studies */}
                {showStudySelector && (
                  <div className='p-4 border-b border-border'>
                    <StudySelector
                      studies={studyManagement.studies}
                      selectedStudyId={studyManagement.selectedStudyId || undefined}
                      onStudySelect={handleStudySelect}
                      onStudyLoad={handleStudySelect}
                      isLoading={studyManagement.isLoading}
                      showThumbnails={true}
                      showSearchFilter={hasMultipleStudies}
                      maxHeight="200px"
                      className="mb-2"
                    />
                    {hasMultipleStudies && <Separator className="mt-3" />}
                  </div>
                )}

                {/* Series List */}
                <div className='flex-1 overflow-y-auto p-4'>
                  <div className='space-y-3'>
                    {/* Series Header */}
                    <div className='flex items-center justify-between'>
                      <h3 className='text-sm font-semibold'>
                        {hasMultipleStudies ? 'Series in Selected Study' : 'DICOM Series'}
                      </h3>
                      <Badge variant='secondary' className='text-xs'>
                        {displayedSeries.length} series
                      </Badge>
                    </div>

                    {displayedSeries.length === 0 ? (
                      <div className='text-center py-4'>
                        <p className='text-sm text-muted-foreground'>
                          {studyManagement.selectedStudyId ? 'No series in selected study' : 'No series available'}
                        </p>
                      </div>
                    ) : (
                      <div className='space-y-2'>
                        {displayedSeries.map((series) => {
                          // Find the original index in seriesData for selection handling
                          const originalIndex = seriesData.findIndex(s => s.seriesInstanceUID === series.seriesInstanceUID);
                          const isSelected = selectedSeries === originalIndex;

                          return (
                            <div
                              key={series.seriesInstanceUID}
                              className={cn(
                                'relative p-3 border rounded-lg cursor-pointer transition-colors',
                                isSelected
                                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-800',
                              )}
                              onClick={() => handleSeriesSelect(originalIndex)}
                            >
                              {/* Delete button */}
                              <Button
                                variant='outline'
                                size='icon'
                                className='absolute top-2 right-2 w-6 h-6 rounded-full hover:bg-red-100 hover:border-red-300 dark:hover:bg-red-900/20'
                                onClick={(e) => handleSeriesDelete(originalIndex, e)}
                                title='Delete series'
                              >
                                <svg className='w-3 h-3' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                                  <line x1='18' y1='6' x2='6' y2='18' />
                                  <line x1='6' y1='6' x2='18' y2='18' />
                                </svg>
                              </Button>

                              <div className='flex items-center justify-between mb-2 pr-8'>
                                <span className='font-medium'>
                                  {series.seriesNumber}. {series.modality}
                                </span>
                                <Badge variant='secondary'>{series.numberOfImages || series.numberOfInstances} images</Badge>
                              </div>
                              <div className='text-sm text-muted-foreground mb-2'>{series.seriesDescription}</div>
                              <div className='text-xs text-muted-foreground mb-3'>{series.patientName}</div>
                              {series.thumbnail && (
                                <div className='mb-2'>
                                  <img
                                    src={series.thumbnail}
                                    alt='Series thumbnail'
                                    className='w-full h-16 object-cover rounded'
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
