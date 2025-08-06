/**
 * Enhanced Series Panel Component
 * Supports multi-study selection and viewport assignment with drag & drop
 * Completely rewritten using shadcn/ui components and cn() utility
 */

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../../lib/utils';
// Local type definition
type ViewportLayout = '1x1' | '1x2' | '2x1' | '2x2' | '1x3' | '3x1' | '2x3' | '3x2';

export interface Study {
  studyUID: string;
  studyDescription: string;
  patientName: string;
  studyDate: string;
  modality: string;
  series: DicomSeries[];
}

export interface DicomSeries {
  seriesInstanceUID: string;
  seriesNumber: string;
  seriesDescription: string;
  modality: string;
  numberOfImages: number;
  patientName: string;
  thumbnail?: string;
  studyUID?: string;
}

export interface ViewportAssignment {
  viewportId: string;
  seriesIndex: number | null;
  studyUID?: string;
}

export interface EnhancedSeriesPanelProps {
  studies: Study[];
  seriesData: DicomSeries[];
  viewportAssignments: ViewportAssignment[];
  currentLayout: ViewportLayout;
  onSeriesAssignment: (viewportId: string, seriesIndex: number | null) => void;
  onLoadFiles: () => void;
  className?: string;
}

// Study badge variants using shadcn/ui patterns
const STUDY_BADGE_VARIANTS = [
  'default',
  'secondary',
  'outline',
  'destructive',
] as const;

// Viewport indicator colors using shadcn/ui color system
const VIEWPORT_INDICATOR_CLASSES = {
  A: 'bg-blue-500',
  B: 'bg-green-500',
  C: 'bg-purple-500',
  D: 'bg-orange-500',
} as const;

export const EnhancedSeriesPanel: React.FC<EnhancedSeriesPanelProps> = ({
  studies,
  seriesData,
  viewportAssignments,
  currentLayout,
  onSeriesAssignment,
  onLoadFiles,
  className = '',
}) => {
  const [draggedSeries, setDraggedSeries] = useState<number | null>(null);
  const [dragOverViewport, setDragOverViewport] = useState<string | null>(null);

  // Get available viewport IDs based on current layout
  const getAvailableViewports = (): string[] => {
    switch (currentLayout) {
      case '1x1': return ['A'];
      case '1x2': return ['A', 'B'];
      case '2x2': return ['A', 'B', 'C', 'D'];
      default: return ['A'];
    }
  };

  // Get study badge variant by index
  const getStudyBadgeVariant = (studyIndex: number): typeof STUDY_BADGE_VARIANTS[number] => {
    return STUDY_BADGE_VARIANTS[studyIndex % STUDY_BADGE_VARIANTS.length];
  };

  // Get assigned viewport for a series
  const getAssignedViewport = (seriesIndex: number): string | null => {
    const assignment = viewportAssignments.find(a => a.seriesIndex === seriesIndex);
    return assignment?.viewportId || null;
  };

  // Handle drag start
  const handleDragStart = (event: React.DragEvent, seriesIndex: number): void => {
    setDraggedSeries(seriesIndex);
    event.dataTransfer.setData('text/plain', seriesIndex.toString());
    event.dataTransfer.effectAllowed = 'move';
  };

  // Handle drag end
  const handleDragEnd = (): void => {
    setDraggedSeries(null);
    setDragOverViewport(null);
  };

  // Handle series click (quick assignment)
  const handleSeriesClick = (seriesIndex: number): void => {
    const availableViewports = getAvailableViewports();
    const currentAssignment = getAssignedViewport(seriesIndex);

    if (currentAssignment) {
      // If already assigned, remove assignment
      onSeriesAssignment(currentAssignment, null);
    } else {
      // Find next available viewport
      const occupiedViewports = viewportAssignments
        .filter(a => a.seriesIndex !== null)
        .map(a => a.viewportId);

      const nextViewport = availableViewports.find(vp => !occupiedViewports.includes(vp));

      if (nextViewport) {
        onSeriesAssignment(nextViewport, seriesIndex);
      }
    }
  };

  // Viewport assignment component
  const ViewportAssignmentCard: React.FC<{ viewportId: string }> = ({ viewportId }) => {
    const assignment = viewportAssignments.find(a => a.viewportId === viewportId);
    const assignedSeries = assignment?.seriesIndex !== null && assignment?.seriesIndex !== undefined
      ? seriesData[assignment.seriesIndex]
      : null;

    const handleDragOver = (event: React.DragEvent): void => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDragOverViewport(viewportId);
    };

    const handleDragLeave = (): void => {
      setDragOverViewport(null);
    };

    const handleDrop = (event: React.DragEvent): void => {
      event.preventDefault();
      const seriesIndex = parseInt(event.dataTransfer.getData('text/plain'), 10);

      if (!isNaN(seriesIndex)) {
        onSeriesAssignment(viewportId, seriesIndex);
      }

      setDragOverViewport(null);
    };

    const handleClear = (): void => {
      onSeriesAssignment(viewportId, null);
    };

    return (
      <Card
        className={cn(
          'p-3 transition-all duration-200',
          dragOverViewport === viewportId
            ? 'ring-2 ring-primary bg-primary/5'
            : 'hover:shadow-md',
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={cn(
              'w-3 h-3 rounded-full',
              VIEWPORT_INDICATOR_CLASSES[viewportId as keyof typeof VIEWPORT_INDICATOR_CLASSES],
            )} />
            <span className="font-medium text-sm">Viewport {viewportId}</span>
          </div>
          {assignedSeries && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className={cn(
                'h-6 w-6 p-0',
                'hover:bg-destructive/10 hover:text-destructive',
              )}
              title="Clear assignment"
            >
              ×
            </Button>
          )}
        </div>

        {assignedSeries ? (
          <div className="space-y-1">
            <div className="text-xs font-medium">
              {assignedSeries.seriesNumber}. {assignedSeries.modality}
            </div>
            <div className="text-xs text-muted-foreground">
              {assignedSeries.seriesDescription}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {assignedSeries.numberOfImages} images
              </Badge>
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground text-center py-2">
            Drop series here
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Series Management</CardTitle>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {studies.length} studies, {seriesData.length} series
          </p>
          <Badge variant="outline" className="text-xs">
            Layout: {currentLayout}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4 overflow-hidden">
        {/* Viewport Assignments */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Viewport Assignments</h3>
          <div className={cn(
            'grid gap-2',
            currentLayout === '2x2' && 'grid-cols-2',
            currentLayout === '1x2' && 'grid-cols-2',
            currentLayout === '1x1' && 'grid-cols-1',
          )}>
            {getAvailableViewports().map(viewportId => (
              <ViewportAssignmentCard key={viewportId} viewportId={viewportId} />
            ))}
          </div>
        </div>

        {/* Load Files Button */}
        <Button
          variant="outline"
          onClick={onLoadFiles}
          className="w-full"
        >
          Load DICOM Files
        </Button>

        {/* Series List */}
        <div className="flex-1">
          <h3 className="text-sm font-medium mb-2">Available Series</h3>

          {seriesData.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">No DICOM files loaded</p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="space-y-2 pr-4">
                {studies.length > 0 ? (
                  // Grouped by studies
                  studies.map((study, studyIndex) => (
                    <div key={study.studyUID} className="space-y-2">
                      <Card className="p-3 border-l-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="text-xs font-medium">{study.studyDescription}</div>
                            <div className="text-xs text-muted-foreground">{study.patientName}</div>
                            <div className="text-xs text-muted-foreground">{study.studyDate}</div>
                          </div>
                          <Badge variant={getStudyBadgeVariant(studyIndex)} className="text-xs">
                            Study {studyIndex + 1}
                          </Badge>
                        </div>
                      </Card>

                      {study.series.map((series) => {
                        const seriesIndex = seriesData.findIndex(s => s.seriesInstanceUID === series.seriesInstanceUID);
                        const assignedViewport = getAssignedViewport(seriesIndex);

                        return (
                          <Card
                            key={series.seriesInstanceUID}
                            className={cn(
                              'p-3 cursor-pointer transition-all duration-200',
                              assignedViewport
                                ? 'bg-accent/50 border-accent'
                                : 'hover:bg-accent/30',
                              draggedSeries === seriesIndex && 'opacity-50 scale-95',
                            )}
                            draggable
                            onDragStart={(e) => handleDragStart(e, seriesIndex)}
                            onDragEnd={handleDragEnd}
                            onClick={() => handleSeriesClick(seriesIndex)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm">
                                {series.seriesNumber}. {series.modality}
                              </span>
                              <div className="flex items-center gap-1">
                                {assignedViewport && (
                                  <div className="flex items-center gap-1">
                                    <div className={cn(
                                      'w-2 h-2 rounded-full',
                                      VIEWPORT_INDICATOR_CLASSES[assignedViewport as keyof typeof VIEWPORT_INDICATOR_CLASSES],
                                    )} />
                                    <Badge variant="default" className="text-xs px-1">
                                      {assignedViewport}
                                    </Badge>
                                  </div>
                                )}
                                <Badge variant="secondary" className="text-xs px-1">
                                  {series.numberOfImages}
                                </Badge>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground mb-1">
                              {series.seriesDescription}
                            </div>
                            {series.thumbnail && (
                              <img
                                src={series.thumbnail}
                                alt="Series thumbnail"
                                className="w-full h-12 object-cover rounded mt-2"
                              />
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  ))
                ) : (
                  // Flat list when no studies grouping
                  seriesData.map((series, seriesIndex) => {
                    const assignedViewport = getAssignedViewport(seriesIndex);

                    return (
                      <Card
                        key={series.seriesInstanceUID}
                        className={cn(
                          'p-3 cursor-pointer transition-all duration-200',
                          assignedViewport
                            ? 'bg-accent/50 border-accent'
                            : 'hover:bg-accent/30',
                          draggedSeries === seriesIndex && 'opacity-50 scale-95',
                        )}
                        draggable
                        onDragStart={(e) => handleDragStart(e, seriesIndex)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleSeriesClick(seriesIndex)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">
                            {series.seriesNumber}. {series.modality}
                          </span>
                          <div className="flex items-center gap-1">
                            {assignedViewport && (
                              <div className="flex items-center gap-1">
                                <div className={cn(
                                  'w-2 h-2 rounded-full',
                                  VIEWPORT_INDICATOR_CLASSES[assignedViewport as keyof typeof VIEWPORT_INDICATOR_CLASSES],
                                )} />
                                <Badge variant="default" className="text-xs px-1">
                                  {assignedViewport}
                                </Badge>
                              </div>
                            )}
                            <Badge variant="secondary" className="text-xs px-1">
                              {series.numberOfImages}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mb-1">
                          {series.seriesDescription}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {series.patientName}
                        </div>
                        {series.thumbnail && (
                          <img
                            src={series.thumbnail}
                            alt="Series thumbnail"
                            className="w-full h-12 object-cover rounded mt-2"
                          />
                        )}
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </div>
  );
};
