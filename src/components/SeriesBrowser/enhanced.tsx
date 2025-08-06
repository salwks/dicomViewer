/**
 * Enhanced SeriesBrowser Component - Pure shadcn/ui Implementation
 * Displays DICOM series using only shadcn/ui components
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Toggle } from '../ui/toggle';
import { cn, safePropertyAccess } from '../../lib/utils';
import { log } from '../../utils/logger';
import { DraggableSeries } from '../DragDropSystem';
import {
  DICOMStudy,
  DICOMSeries,
  SeriesManagementState,
  StudyColorScheme,
} from '../../types/dicom';

interface EnhancedSeriesBrowserProps {
  studies: DICOMStudy[];
  selectedStudy?: string;
  selectedSeries?: string;
  onStudySelect: (studyInstanceUID: string) => void;
  onSeriesSelect: (seriesInstanceUID: string) => void;
  onSeriesAssign: (seriesInstanceUID: string, viewportId: string) => void;
  onSeriesLoad: (seriesInstanceUID: string) => void;
  viewportAssignments: Record<string, string>;
  isLoading?: boolean;
  className?: string;
  enableDragDrop?: boolean;
  showStudyTabs?: boolean;
  colorSchemes?: Map<string, StudyColorScheme>;
}

// Default color schemes for studies
const DEFAULT_STUDY_COLORS: StudyColorScheme[] = [
  { studyInstanceUID: '', primaryColor: '#3b82f6', secondaryColor: '#dbeafe', accentColor: '#1d4ed8', textColor: '#1e40af' }, // Blue
  { studyInstanceUID: '', primaryColor: '#10b981', secondaryColor: '#d1fae5', accentColor: '#059669', textColor: '#047857' }, // Green
  { studyInstanceUID: '', primaryColor: '#f59e0b', secondaryColor: '#fef3c7', accentColor: '#d97706', textColor: '#b45309' }, // Amber
  { studyInstanceUID: '', primaryColor: '#ef4444', secondaryColor: '#fee2e2', accentColor: '#dc2626', textColor: '#b91c1c' }, // Red
  { studyInstanceUID: '', primaryColor: '#8b5cf6', secondaryColor: '#ede9fe', accentColor: '#7c3aed', textColor: '#6d28d9' }, // Violet
];

export const EnhancedSeriesBrowser: React.FC<EnhancedSeriesBrowserProps> = ({
  studies = [],
  selectedStudy,
  selectedSeries,
  onStudySelect: _onStudySelect,
  onSeriesSelect,
  onSeriesLoad,
  viewportAssignments,
  isLoading = false,
  className = '',
  enableDragDrop = true,
  colorSchemes = new Map(),
}) => {
  const [managementState, setManagementState] = useState<SeriesManagementState>({
    studies,
    selectedStudy: selectedStudy || null,
    selectedSeries: selectedSeries || null,
    viewportAssignments,
    draggedSeries: null,
    loadingStates: {},
    colorMappings: {},
    filterModality: 'all',
    sortBy: 'seriesNumber',
    viewMode: 'grid',
    showThumbnails: true,
    groupByStudy: true,
  });

  // Initialize color mappings
  useEffect(() => {
    if (!studies || studies.length === 0) return;

    const colorMappings: Record<string, string> = {};
    studies.forEach((study, index) => {
      const colorIndex = index % DEFAULT_STUDY_COLORS.length;
      const defaultColor = safePropertyAccess(DEFAULT_STUDY_COLORS, colorIndex) || DEFAULT_STUDY_COLORS[0];
      const studyColor = colorSchemes?.get(study.studyInstanceUID) || defaultColor;
      colorMappings[study.studyInstanceUID] = studyColor.primaryColor;
    });

    setManagementState(prev => ({ ...prev, colorMappings, studies }));
  }, [studies, colorSchemes]);

  // Get all series from all studies with enhanced metadata
  const allSeries = useMemo(() => {
    if (!studies || studies.length === 0) return [];

    return studies.flatMap(study =>
      study.series.map(series => ({
        ...series,
        studyInstanceUID: study.studyInstanceUID,
        studyDescription: study.studyDescription,
        patientName: study.patientName,
        studyDate: study.studyDate,
        studyColor: managementState.colorMappings[study.studyInstanceUID] || '#6b7280',
      })),
    );
  }, [studies, managementState.colorMappings]);

  // Get unique modalities from all series
  const modalities = useMemo(() => {
    const unique = [...new Set(allSeries.map(s => s.modality))];
    return unique.sort();
  }, [allSeries]);

  // Filter and sort series
  const filteredSeries = useMemo(() => {
    let filtered = allSeries;

    // Apply modality filter
    if (managementState.filterModality !== 'all') {
      filtered = filtered.filter(s => s.modality === managementState.filterModality);
    }

    // Apply study filter if specific study is selected
    if (selectedStudy && !managementState.groupByStudy) {
      filtered = filtered.filter(s => s.studyInstanceUID === selectedStudy);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (managementState.sortBy) {
        case 'seriesNumber':
          return (a.seriesNumber || 0) - (b.seriesNumber || 0);
        case 'seriesDescription':
          return a.seriesDescription.localeCompare(b.seriesDescription);
        case 'modality':
          return a.modality.localeCompare(b.modality);
        case 'studyDate':
          return (a.studyDate || '').localeCompare(b.studyDate || '');
        default:
          return 0;
      }
    });

    return filtered;
  }, [allSeries, managementState.filterModality, managementState.sortBy, managementState.groupByStudy, selectedStudy]);

  // Series event handlers
  const handleSeriesClick = useCallback((seriesInstanceUID: string) => {
    log.info('Series selected', {
      component: 'EnhancedSeriesBrowser',
      metadata: { seriesInstanceUID },
    });
    onSeriesSelect(seriesInstanceUID);
    setManagementState(prev => ({ ...prev, selectedSeries: seriesInstanceUID }));
  }, [onSeriesSelect]);

  const handleSeriesDoubleClick = useCallback((seriesInstanceUID: string) => {
    log.info('Series loading requested', {
      component: 'EnhancedSeriesBrowser',
      metadata: { seriesInstanceUID },
    });
    onSeriesLoad(seriesInstanceUID);
  }, [onSeriesLoad]);

  // Filter and sort handlers
  const handleFilterChange = useCallback((filterModality: string) => {
    setManagementState(prev => ({ ...prev, filterModality }));
  }, []);

  const handleSortChange = useCallback((sortBy: 'seriesNumber' | 'seriesDescription' | 'modality' | 'studyDate') => {
    setManagementState(prev => ({ ...prev, sortBy }));
  }, []);

  const handleViewModeChange = useCallback((viewMode: string) => {
    setManagementState(prev => ({ ...prev, viewMode: viewMode as 'grid' | 'list' }));
  }, []);

  // Generate thumbnail for series
  const generateThumbnail = useCallback((series: DICOMSeries & { studyColor?: string }): string => {
    const color = series.studyColor || '#6b7280';

    return `data:image/svg+xml,${encodeURIComponent(`
      <svg width="120" height="120" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="120" fill="${color}15"/>
        <rect x="8" y="8" width="104" height="104" fill="none" stroke="${color}" stroke-width="2" rx="4"/>
        <circle cx="60" cy="40" r="3" fill="${color}"/>
        <text x="60" y="60" text-anchor="middle" font-family="system-ui" 
              font-size="14" font-weight="600" fill="${color}">${series.modality}</text>
        <text x="60" y="78" text-anchor="middle" font-family="system-ui" 
              font-size="11" fill="${color}99">${series.numberOfInstances || 0} images</text>
        <text x="60" y="94" text-anchor="middle" font-family="system-ui" 
              font-size="10" fill="${color}80">Series ${series.seriesNumber || '?'}</text>
      </svg>
    `)}`;
  }, []);

  // Render series item using only shadcn/ui components
  const renderSeriesItem = useCallback((series: DICOMSeries & { studyColor?: string; studyDescription?: string; patientName?: string; studyDate?: string }) => {
    const isAssigned = Object.values(viewportAssignments).includes(series.seriesInstanceUID);
    const assignedViewport = Object.keys(viewportAssignments).find(
      viewport => safePropertyAccess(viewportAssignments, viewport) === series.seriesInstanceUID,
    );
    const isSelected = selectedSeries === series.seriesInstanceUID;
    const isDragging = managementState.draggedSeries === series.seriesInstanceUID;
    const isLoading = safePropertyAccess(managementState.loadingStates, series.seriesInstanceUID);

    return (
      <DraggableSeries
        key={series.seriesInstanceUID}
        series={series}
        enabled={enableDragDrop}
        sourceViewport={assignedViewport}
      >
        <Card
          className={cn(
            isSelected && 'border-primary bg-primary/5',
            isDragging && 'opacity-50',
            isAssigned && 'border-green-500 bg-green-50/50',
          )}
          onClick={() => handleSeriesClick(series.seriesInstanceUID)}
          onDoubleClick={() => handleSeriesDoubleClick(series.seriesInstanceUID)}
        >
          <CardContent className={cn(
            'p-3',
            managementState.viewMode === 'list' && 'flex items-center gap-3',
          )}>
            {managementState.viewMode === 'grid' ? (
              // Grid view: Thumbnail-focused
              <div className="space-y-2">
                <div className="relative aspect-square">
                  <img
                    src={series.thumbnailUrl || generateThumbnail(series)}
                    alt={`${series.modality} Series ${series.seriesNumber}`}
                    className="w-full h-full rounded border object-cover"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = generateThumbnail(series);
                    }}
                  />
                  {isLoading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <div className="absolute top-1 left-1">
                    <Badge variant="secondary" className="text-xs">
                      {series.modality}
                    </Badge>
                  </div>
                  {isAssigned && assignedViewport && (
                    <div className="absolute top-1 right-1">
                      <Badge className="text-xs bg-green-500">
                        {assignedViewport}
                      </Badge>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium truncate">
                    {series.seriesDescription || 'Unnamed Series'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    #{series.seriesNumber || '?'} • {series.numberOfInstances || 0} images
                  </p>
                </div>
              </div>
            ) : (
              // List view: Detailed information
              <>
                <div className="w-16 h-16 flex-shrink-0">
                  <img
                    src={series.thumbnailUrl || generateThumbnail(series)}
                    alt={`${series.modality} Series ${series.seriesNumber}`}
                    className="w-full h-full rounded border object-cover"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = generateThumbnail(series);
                    }}
                  />
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {series.modality}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      #{series.seriesNumber || '?'}
                    </Badge>
                    {isAssigned && assignedViewport && (
                      <Badge className="text-xs bg-green-500">
                        {assignedViewport}
                      </Badge>
                    )}
                  </div>

                  <h4 className="text-sm font-medium truncate">
                    {series.seriesDescription || 'Unnamed Series'}
                  </h4>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{series.numberOfInstances || 0} images</span>
                    <span>{series.studyDate || 'N/A'}</span>
                  </div>

                  <p className="text-xs text-muted-foreground truncate">
                    {series.studyDescription || 'N/A'}
                  </p>

                  <p className="text-xs text-muted-foreground truncate">
                    {series.patientName || 'N/A'}
                  </p>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSeriesDoubleClick(series.seriesInstanceUID);
                  }}
                  className="h-8 w-8 p-0"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </DraggableSeries>
    );
  }, [
    viewportAssignments,
    selectedSeries,
    managementState.draggedSeries,
    managementState.loadingStates,
    managementState.viewMode,
    enableDragDrop,
    handleSeriesClick,
    handleSeriesDoubleClick,
    generateThumbnail,
  ]);

  return (
    <div className={cn('h-full flex flex-col', className)}>
      {/* Header Controls */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Series Browser</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {filteredSeries.length} of {allSeries.length} series
              </Badge>
              <Badge variant="outline">
                {studies.length} studies
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Modality Filter */}
            <Select value={managementState.filterModality} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by modality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modalities</SelectItem>
                {modalities.map(modality => (
                  <SelectItem key={modality} value={modality}>
                    {modality}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort Options */}
            <Select value={managementState.sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="seriesNumber">Series Number</SelectItem>
                <SelectItem value="seriesDescription">Description</SelectItem>
                <SelectItem value="modality">Modality</SelectItem>
                <SelectItem value="studyDate">Study Date</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode Toggle */}
            <ToggleGroup type="single" value={managementState.viewMode} onValueChange={handleViewModeChange}>
              <ToggleGroupItem value="grid" aria-label="Grid view">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="List view">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </ToggleGroupItem>
            </ToggleGroup>

            {/* Group Toggle */}
            <Toggle
              pressed={managementState.groupByStudy}
              onPressedChange={(pressed) => setManagementState(prev => ({ ...prev, groupByStudy: pressed }))}
              variant="outline"
            >
              Group by Study
            </Toggle>
          </div>
        </CardContent>
      </Card>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <Card className="h-32">
            <CardContent className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading series...</p>
              </div>
            </CardContent>
          </Card>
        ) : filteredSeries.length === 0 ? (
          <Card className="h-32">
            <CardContent className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21,15 16,10 5,21" />
                </svg>
                <p className="text-sm font-medium">No series found</p>
                <p className="text-xs text-muted-foreground">Try adjusting your filters</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-full">
            <div className={cn(
              'p-3',
              managementState.viewMode === 'grid' && 'grid grid-cols-2 gap-3',
              managementState.viewMode === 'list' && 'space-y-2',
            )}>
              {filteredSeries.map((series) => renderSeriesItem(series))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};

// Export both for compatibility
export const SeriesBrowser = EnhancedSeriesBrowser;
