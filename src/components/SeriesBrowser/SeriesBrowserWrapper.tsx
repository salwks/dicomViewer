/**
 * SeriesBrowser Wrapper Component
 * Provides backward compatibility for the old SeriesBrowser API
 * Built with shadcn/ui components
 */

import React from 'react';
import { EnhancedSeriesBrowser } from './enhanced';
import { Card, CardContent } from '../ui/card';
import { cn, safePropertyAccess } from '../../lib/utils';

interface LegacySeriesBrowserProps {
  seriesData: any[];
  selectedSeries: number;
  onSeriesSelect: (index: number) => void;
  onSeriesDelete: (index: number, event: React.MouseEvent) => void;
  comparisonStudyA?: number | null;
  comparisonStudyB?: number | null;
  setComparisonStudyA?: (index: number | null) => void;
  setComparisonStudyB?: (index: number | null) => void;
  isComparisonMode?: boolean;
}

export const SeriesBrowserWrapper: React.FC<LegacySeriesBrowserProps> = ({
  seriesData = [], // Default to empty array
  selectedSeries = 0,
  onSeriesSelect,
  onSeriesDelete: _onSeriesDelete,
  comparisonStudyA,
  comparisonStudyB,
  setComparisonStudyA,
  setComparisonStudyB,
  isComparisonMode = false,
}) => {
  // Handle empty or invalid data
  if (!seriesData || seriesData.length === 0) {
    return (
      <Card className={cn('m-4')}>
        <CardContent className={cn('p-6 text-center')}>
          <div className={cn('text-4xl mb-2')}>📁</div>
          <p className={cn('text-sm text-muted-foreground')}>No studies loaded</p>
        </CardContent>
      </Card>
    );
  }

  // Convert legacy seriesData format to new studies format
  const studies = seriesData.map((series, index) => ({
    studyInstanceUID: series.studyInstanceUID || `study-${index}`,
    studyDate: series.studyDate || '',
    studyTime: series.studyTime || '',
    studyDescription: series.studyDescription || series.seriesDescription || 'Unknown Study',
    patientName: series.patientName || 'Unknown Patient',
    patientId: series.patientId || '',
    accessionNumber: series.accessionNumber || '',
    modality: series.modality || 'UN',
    seriesCount: 1,
    instanceCount: series.numImageFrames || series.imageIds?.length || 1,
    series: [{
      studyInstanceUID: series.studyInstanceUID || `study-${index}`,
      seriesInstanceUID: series.seriesInstanceUID || `series-${index}`,
      seriesNumber: series.seriesNumber || index + 1,
      seriesDescription: series.seriesDescription || `Series ${index + 1}`,
      modality: series.modality || 'UN',
      instanceCount: series.numImageFrames || series.imageIds?.length || 1,
      numberOfInstances: series.numImageFrames || series.imageIds?.length || 1,
      seriesDate: series.seriesDate || series.studyDate || '',
      seriesTime: series.seriesTime || series.studyTime || '',
      bodyPartExamined: series.bodyPartExamined || '',
      imageOrientationPatient: series.imageOrientationPatient || [],
      pixelSpacing: series.pixelSpacing || [],
      sliceThickness: series.sliceThickness || 0,
      acquisitionDate: series.acquisitionDate || '',
      acquisitionTime: series.acquisitionTime || '',
      manufacturer: series.manufacturer || '',
      manufacturerModelName: series.manufacturerModelName || '',
      imageIds: series.imageIds || [],
      thumbnail: series.thumbnail || null,
      thumbnailUrl: series.thumbnail || null,
      metadata: series,
    }],
  }));

  // Handler conversions
  const handleStudySelect = (studyInstanceUID: string) => {
    const studyIndex = studies.findIndex(s => s.studyInstanceUID === studyInstanceUID);
    if (studyIndex !== -1) {
      onSeriesSelect(studyIndex);
    }
  };

  const handleSeriesSelect = (seriesInstanceUID: string) => {
    // Find the series across all studies
    for (let studyIndex = 0; studyIndex < studies.length; studyIndex++) {
      const study = safePropertyAccess(studies, studyIndex);
      if (!study) continue;
      const seriesIndex = study.series.findIndex(s => s.seriesInstanceUID === seriesInstanceUID);
      if (seriesIndex !== -1) {
        onSeriesSelect(studyIndex);
        return;
      }
    }
  };

  const handleSeriesAssign = (seriesInstanceUID: string, viewportId: string) => {
    // For comparison mode viewport assignments
    const studyIndex = studies.findIndex(study =>
      study.series.some(series => series.seriesInstanceUID === seriesInstanceUID),
    );

    if (studyIndex !== -1) {
      if (viewportId === 'A' && setComparisonStudyA) {
        setComparisonStudyA(studyIndex);
      } else if (viewportId === 'B' && setComparisonStudyB) {
        setComparisonStudyB(studyIndex);
      }
    }
  };

  const handleSeriesLoad = (seriesInstanceUID: string) => {
    handleSeriesSelect(seriesInstanceUID);
  };

  // Current viewport assignments
  const viewportAssignments: Record<string, string> = {};
  if (comparisonStudyA !== null && comparisonStudyA !== undefined) {
    const studyA = safePropertyAccess(studies, comparisonStudyA);
    if (studyA) {
      if (studyA.series.length > 0) {
        viewportAssignments[studyA.series[0].seriesInstanceUID] = 'A';
      }
    }
  }
  if (comparisonStudyB !== null && comparisonStudyB !== undefined) {
    const studyB = safePropertyAccess(studies, comparisonStudyB);
    if (studyB) {
      if (studyB.series.length > 0) {
        viewportAssignments[studyB.series[0].seriesInstanceUID] = 'B';
      }
    }
  }

  // Current selections
  const selectedStudy = safePropertyAccess(studies, selectedSeries);
  const selectedStudyUID = selectedStudy?.studyInstanceUID;
  const selectedSeriesUID = selectedStudy?.series[0]?.seriesInstanceUID;

  return (
    <EnhancedSeriesBrowser
      studies={studies}
      selectedStudy={selectedStudyUID}
      selectedSeries={selectedSeriesUID}
      onStudySelect={handleStudySelect}
      onSeriesSelect={handleSeriesSelect}
      onSeriesAssign={handleSeriesAssign}
      onSeriesLoad={handleSeriesLoad}
      viewportAssignments={viewportAssignments}
      enableDragDrop={isComparisonMode}
      showStudyTabs={studies.length > 1}
    />
  );
};
