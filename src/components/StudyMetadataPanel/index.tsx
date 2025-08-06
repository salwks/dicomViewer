/**
 * Study Metadata Panel Component
 * Displays detailed metadata for selected DICOM study
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Progress } from '../ui/progress';
import { cn } from '../../lib/utils';
import { DICOMStudy } from '../../types/dicom';
import { useSeriesManagement } from '../../hooks/useSeriesManagement';

interface StudyMetadataPanelProps {
  study: DICOMStudy | null;
  className?: string;
  showSeriesDetails?: boolean;
  showStatistics?: boolean;
  onSeriesSelect?: (seriesInstanceUID: string) => void;
  onExportMetadata?: (study: DICOMStudy) => void;
}

interface StudyStatistics {
  totalSeries: number;
  totalImages: number;
  modalities: string[];
  modalityDistribution: Record<string, number>;
  averageImagesPerSeries: number;
  dateRange: {
    earliest?: string;
    latest?: string;
  };
  bodyParts: string[];
  protocols: string[];
}

export const StudyMetadataPanel: React.FC<StudyMetadataPanelProps> = ({
  study,
  className = '',
  showSeriesDetails = true,
  showStatistics = true,
  onSeriesSelect,
  onExportMetadata,
}) => {
  const { getStudyColor } = useSeriesManagement();

  // Calculate study statistics
  const statistics = useMemo((): StudyStatistics | null => {
    if (!study) return null;

    const totalSeries = study.series.length;
    const totalImages = study.series.reduce((sum, series) => sum + series.numberOfInstances, 0);
    const modalities = [...new Set(study.series.map(s => s.modality))].sort();

    const modalityDistribution: Record<string, number> = {};
    study.series.forEach(series => {
      modalityDistribution[series.modality] = (modalityDistribution[series.modality] || 0) + 1;
    });

    const averageImagesPerSeries = totalSeries > 0 ? Math.round(totalImages / totalSeries) : 0;

    // Get date range from series
    const seriesDates = study.series
      .map(s => s.seriesDate)
      .filter(Boolean)
      .sort();

    const bodyParts = [...new Set(study.series.map(s => s.bodyPartExamined).filter(Boolean) as string[])];
    const protocols = [...new Set(study.series.map(s => s.protocolName).filter(Boolean) as string[])];

    return {
      totalSeries,
      totalImages,
      modalities,
      modalityDistribution,
      averageImagesPerSeries,
      dateRange: {
        earliest: seriesDates[0],
        latest: seriesDates[seriesDates.length - 1],
      },
      bodyParts,
      protocols,
    };
  }, [study]);

  // Format date for display
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch (error) {
      console.warn('Failed to format date', { dateString, error });
      return dateString;
    }
  };

  // Format size in bytes - currently unused but kept for future use
  // const formatSize = (bytes?: number): string => {
  //   if (!bytes) return 'N/A';
  //   const sizes = ['B', 'KB', 'MB', 'GB'];
  //   const i = Math.floor(Math.log(bytes) / Math.log(1024));
  //   return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  // };

  if (!study) {
    return (
      <Card className={cn('h-full', className)}>
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center text-muted-foreground">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p>Select a study to view metadata</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const studyColor = getStudyColor(study.studyInstanceUID) || '#6b7280';

  return (
    <div className={cn('space-y-4', className)}>
      {/* Study Header */}
      <Card>
        <div
          className={cn('absolute top-0 left-0 w-1 h-full rounded-l-lg')}
          style={{ '--study-color': studyColor, backgroundColor: 'var(--study-color)' } as React.CSSProperties}
        />
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg line-clamp-2">
                {study.studyDescription || 'Unnamed Study'}
              </CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge
                  className={cn('text-xs')}
                  style={{
                    '--study-color': studyColor,
                    backgroundColor: `${studyColor}20`,
                    color: 'var(--study-color)',
                  } as React.CSSProperties}
                >
                  Study
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {study.studyInstanceUID.slice(-8)}
                </Badge>
              </div>
            </div>
            {onExportMetadata && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onExportMetadata(study)}
                className="ml-2"
              >
                Export
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Patient Information */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Patient Information</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{study.patientName || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID:</span>
                  <span className="font-mono text-xs">{study.patientID || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Age:</span>
                  <span>{study.patientAge || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sex:</span>
                  <span>{study.patientSex || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Study Information */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Study Information</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span>{formatDate(study.studyDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time:</span>
                  <span>{study.studyTime || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID:</span>
                  <span className="font-mono text-xs">{study.studyID || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Accession:</span>
                  <span className="font-mono text-xs">{study.accessionNumber || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Information */}
          {(study.institutionName || study.referringPhysicianName) && (
            <>
              <Separator className="my-4" />
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Additional Information</h4>
                <div className="space-y-1 text-sm">
                  {study.institutionName && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Institution:</span>
                      <span>{study.institutionName}</span>
                    </div>
                  )}
                  {study.referringPhysicianName && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Referring Physician:</span>
                      <span>{study.referringPhysicianName}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      {showStatistics && statistics && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{statistics.totalSeries}</div>
                <div className="text-xs text-muted-foreground">Series</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{statistics.totalImages}</div>
                <div className="text-xs text-muted-foreground">Images</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{statistics.modalities.length}</div>
                <div className="text-xs text-muted-foreground">Modalities</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{statistics.averageImagesPerSeries}</div>
                <div className="text-xs text-muted-foreground">Avg/Series</div>
              </div>
            </div>

            {/* Modality Distribution */}
            <Separator className="my-4" />
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Modality Distribution</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(statistics.modalityDistribution).map(([modality, count]) => (
                  <Badge key={modality} variant="outline" className="text-xs">
                    {modality} ({count})
                  </Badge>
                ))}
              </div>
            </div>

            {/* Body Parts and Protocols */}
            {(statistics.bodyParts.length > 0 || statistics.protocols.length > 0) && (
              <>
                <Separator className="my-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {statistics.bodyParts.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Body Parts</h4>
                      <div className="flex flex-wrap gap-1">
                        {statistics.bodyParts.map(part => (
                          <Badge key={part} variant="outline" className="text-xs">
                            {part}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {statistics.protocols.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Protocols</h4>
                      <div className="flex flex-wrap gap-1">
                        {statistics.protocols.map(protocol => (
                          <Badge key={protocol} variant="outline" className="text-xs">
                            {protocol}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Series Details */}
      {showSeriesDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Series ({study.series.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {study.series.map((series, index) => (
                <div
                  key={series.seriesInstanceUID}
                  className={cn(
                    'p-3 border rounded cursor-pointer transition-all',
                    'hover:bg-muted/50',
                    onSeriesSelect && 'hover:border-primary/50',
                  )}
                  onClick={() => onSeriesSelect?.(series.seriesInstanceUID)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-xs">
                          #{series.seriesNumber || index + 1}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {series.modality}
                        </Badge>
                        {series.isLoaded && (
                          <Badge variant="default" className="text-xs bg-green-500">
                            Loaded
                          </Badge>
                        )}
                      </div>
                      <div className="font-medium text-sm line-clamp-1">
                        {series.seriesDescription || 'Unnamed Series'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {series.numberOfInstances} images
                        {series.seriesDate && ` • ${formatDate(series.seriesDate)}`}
                        {series.bodyPartExamined && ` • ${series.bodyPartExamined}`}
                      </div>
                    </div>
                  </div>

                  {/* Progress indicator if loading */}
                  {series.loadingProgress !== undefined && series.loadingProgress < 100 && (
                    <div className={cn('mt-2 space-y-2')}>
                      <div className={cn('flex items-center justify-between text-xs')}>
                        <span className={cn('text-muted-foreground')}>Loading...</span>
                        <span className={cn('font-medium')}>{series.loadingProgress}%</span>
                      </div>
                      <Progress value={series.loadingProgress} className={cn('h-1')} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Technical Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Technical Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Study Instance UID:</span>
              <span className="font-mono text-xs break-all">{study.studyInstanceUID}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Loading State:</span>
              <Badge variant={study.loadingState === 'loaded' ? 'default' : 'secondary'} className="text-xs">
                {study.loadingState || 'idle'}
              </Badge>
            </div>
            {study.totalImages && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Images:</span>
                <span>{study.totalImages}</span>
              </div>
            )}
            {study.numberOfSeries && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Number of Series:</span>
                <span>{study.numberOfSeries}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
