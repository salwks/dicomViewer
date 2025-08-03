/**
 * StudySelector Component
 * Provides study selection interface with search, filtering, and multi-select capabilities
 * Enhanced for comparison mode with patient safety features
 * Built with shadcn/ui components for consistent design
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { Separator } from '../ui/separator';
import { cn } from '../../lib/utils';
import { log } from '../../utils/logger';
import { DICOMStudy } from '../../types/dicom';
import { StudyInfo } from '../../services/ComparisonViewportManager';

interface StudySelectorProps {
  studies: DICOMStudy[];
  selectedStudyId?: string;
  onStudySelect: (studyInstanceUID: string) => void;
  onStudyLoad?: (studyInstanceUID: string) => void;
  className?: string;
  isLoading?: boolean;
  showThumbnails?: boolean;
  showSearchFilter?: boolean;
  maxHeight?: string;
  // Multi-select comparison mode props
  mode?: 'single' | 'comparison';
  selectedStudies?: StudyInfo[];
  onStudySelectionChange?: (studies: StudyInfo[]) => void;
  maxSelections?: number;
  enablePatientSafety?: boolean;
}

interface StudyFilterState {
  searchQuery: string;
  modalityFilter: string;
  sortBy: 'studyDate' | 'patientName' | 'studyDescription' | 'numberOfSeries';
  sortOrder: 'asc' | 'desc';
}

// Helper function to convert DICOMStudy to StudyInfo
const convertToStudyInfo = (study: DICOMStudy): StudyInfo => ({
  studyInstanceUID: study.studyInstanceUID,
  patientId: study.patientID || 'Unknown',
  patientName: study.patientName || 'Unknown Patient',
  studyDate: study.studyDate || '',
  modality: study.series[0]?.modality || 'UN',
  institution: study.institutionName,
  description: study.studyDescription,
  seriesCount: study.series.length,
});

export const StudySelector: React.FC<StudySelectorProps> = ({
  studies,
  selectedStudyId,
  onStudySelect,
  onStudyLoad,
  className = '',
  isLoading = false,
  showThumbnails = true,
  showSearchFilter = true,
  maxHeight = '400px',
  // Comparison mode props
  mode = 'single',
  selectedStudies = [],
  onStudySelectionChange,
  maxSelections = 4,
  enablePatientSafety = true,
}) => {
  const [filterState, setFilterState] = useState<StudyFilterState>({
    searchQuery: '',
    modalityFilter: 'all',
    sortBy: 'studyDate',
    sortOrder: 'desc',
  });

  // Patient safety analysis for comparison mode
  const patientAnalysis = useMemo(() => {
    if (mode !== 'comparison' || !enablePatientSafety || selectedStudies.length <= 1) {
      return { hasMultiplePatients: false, patientIds: [], warnings: [] };
    }

    const patientIds = [...new Set(selectedStudies.map(s => s.patientId))];
    const hasMultiplePatients = patientIds.length > 1;
    const warnings = [];

    if (hasMultiplePatients) {
      warnings.push(`${patientIds.length} different patients selected`);
    }

    return { hasMultiplePatients, patientIds, warnings };
  }, [selectedStudies, enablePatientSafety, mode]);

  // Extract unique modalities from all studies
  const availableModalities = useMemo(() => {
    const modalitySet = new Set<string>();
    studies.forEach(study => {
      study.series.forEach(series => {
        modalitySet.add(series.modality);
      });
    });
    return Array.from(modalitySet).sort();
  }, [studies]);

  // Filter and sort studies based on current filter state
  const filteredStudies = useMemo(() => {
    let filtered = [...studies];

    // Apply search filter
    if (filterState.searchQuery.trim()) {
      const query = filterState.searchQuery.toLowerCase();
      filtered = filtered.filter(study =>
        study.patientName?.toLowerCase().includes(query) ||
        study.studyDescription?.toLowerCase().includes(query) ||
        study.patientID?.toLowerCase().includes(query) ||
        study.accessionNumber?.toLowerCase().includes(query),
      );
    }

    // Apply modality filter
    if (filterState.modalityFilter !== 'all') {
      filtered = filtered.filter(study =>
        study.series.some(series => series.modality === filterState.modalityFilter),
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: string | number = '';
      let bValue: string | number = '';

      switch (filterState.sortBy) {
        case 'studyDate':
          aValue = a.studyDate || '';
          bValue = b.studyDate || '';
          break;
        case 'patientName':
          aValue = a.patientName || '';
          bValue = b.patientName || '';
          break;
        case 'studyDescription':
          aValue = a.studyDescription || '';
          bValue = b.studyDescription || '';
          break;
        case 'numberOfSeries':
          aValue = a.numberOfSeries || a.series.length;
          bValue = b.numberOfSeries || b.series.length;
          break;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return filterState.sortOrder === 'asc' ? comparison : -comparison;
      } else {
        const comparison = (aValue as number) - (bValue as number);
        return filterState.sortOrder === 'asc' ? comparison : -comparison;
      }
    });

    return filtered;
  }, [studies, filterState]);

  // Handle study selection (single mode)
  const handleStudyClick = useCallback((studyInstanceUID: string) => {
    if (mode === 'single') {
      log.info('Study selected', {
        component: 'StudySelector',
        metadata: { studyInstanceUID },
      });
      onStudySelect(studyInstanceUID);
    }
  }, [onStudySelect, mode]);

  // Handle study toggle (comparison mode)
  const handleStudyToggle = useCallback((study: DICOMStudy) => {
    if (mode !== 'comparison' || !onStudySelectionChange) return;

    const studyInfo = convertToStudyInfo(study);
    const isCurrentlySelected = selectedStudies.some(s => s.studyInstanceUID === study.studyInstanceUID);
    
    if (isCurrentlySelected) {
      // Remove study
      const newSelection = selectedStudies.filter(s => s.studyInstanceUID !== study.studyInstanceUID);
      onStudySelectionChange(newSelection);
      
      log.info('Study removed from comparison', {
        component: 'StudySelector',
        metadata: { studyInstanceUID: study.studyInstanceUID, remainingCount: newSelection.length },
      });
    } else {
      // Add study (check max limit)
      if (selectedStudies.length >= maxSelections) {
        log.warn('Maximum study selection limit reached', {
          component: 'StudySelector',
          metadata: { limit: maxSelections, studyInstanceUID: study.studyInstanceUID },
        });
        return;
      }
      
      const newSelection = [...selectedStudies, studyInfo];
      onStudySelectionChange(newSelection);
      
      log.info('Study added to comparison', {
        component: 'StudySelector',
        metadata: { studyInstanceUID: study.studyInstanceUID, totalCount: newSelection.length },
      });
    }
  }, [mode, selectedStudies, onStudySelectionChange, maxSelections]);

  // Handle select all for comparison mode
  const handleSelectAll = useCallback(() => {
    if (mode !== 'comparison' || !onStudySelectionChange) return;
    
    const visibleStudies = filteredStudies.slice(0, maxSelections);
    const studyInfos = visibleStudies.map(convertToStudyInfo);
    onStudySelectionChange(studyInfos);
    
    log.info('All visible studies selected', {
      component: 'StudySelector',
      metadata: { count: studyInfos.length },
    });
  }, [mode, filteredStudies, onStudySelectionChange, maxSelections]);

  // Handle clear all for comparison mode
  const handleClearAll = useCallback(() => {
    if (mode !== 'comparison' || !onStudySelectionChange) return;
    
    onStudySelectionChange([]);
    
    log.info('All studies cleared from comparison', {
      component: 'StudySelector',
    });
  }, [mode, onStudySelectionChange]);

  // Handle study loading (double-click)
  const handleStudyDoubleClick = useCallback((studyInstanceUID: string) => {
    if (onStudyLoad) {
      log.info('Study loading requested', {
        component: 'StudySelector',
        metadata: { studyInstanceUID },
      });
      onStudyLoad(studyInstanceUID);
    }
  }, [onStudyLoad]);

  // Update search query
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFilterState(prev => ({ ...prev, searchQuery: event.target.value }));
  }, []);

  // Update modality filter
  const handleModalityFilterChange = useCallback((value: string) => {
    setFilterState(prev => ({ ...prev, modalityFilter: value }));
  }, []);

  // Update sorting
  const handleSortChange = useCallback((value: string) => {
    setFilterState(prev => ({ ...prev, sortBy: value as StudyFilterState['sortBy'] }));
  }, []);

  // Toggle sort order
  const handleSortOrderToggle = useCallback(() => {
    setFilterState(prev => ({ ...prev, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' }));
  }, []);

  // Format study date for display
  const formatStudyDate = useCallback((dateString?: string): string => {
    if (!dateString) return 'N/A';

    // Assuming DICOM date format YYYYMMDD
    if (dateString.length === 8) {
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      return `${year}-${month}-${day}`;
    }

    return dateString;
  }, []);

  // Generate study thumbnail placeholder
  const generateStudyThumbnail = useCallback((study: DICOMStudy): string => {
    const primaryModality = study.series[0]?.modality || 'UN';
    const color = study.color || '#6b7280';

    return `data:image/svg+xml,${encodeURIComponent(`
      <svg width="80" height="80" xmlns="http://www.w3.org/2000/svg">
        <rect width="80" height="80" fill="${color}15"/>
        <rect x="4" y="4" width="72" height="72" fill="none" stroke="${color}" stroke-width="2" rx="4"/>
        <text x="40" y="35" text-anchor="middle" font-family="system-ui" 
              font-size="12" font-weight="600" fill="${color}">${primaryModality}</text>
        <text x="40" y="50" text-anchor="middle" font-family="system-ui" 
              font-size="10" fill="${color}99">${study.series.length} series</text>
        <text x="40" y="65" text-anchor="middle" font-family="system-ui" 
              font-size="8" fill="${color}80">${study.totalImages || 'N/A'} images</text>
      </svg>
    `)}`;
  }, []);

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {mode === 'comparison' ? 'Select Studies for Comparison' : 'Studies'}
          </CardTitle>
          <div className="flex items-center gap-2">
            {mode === 'comparison' && (
              <Badge variant="secondary" className="text-xs">
                {selectedStudies.length}/{maxSelections}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {filteredStudies.length} of {studies.length}
            </Badge>
          </div>
        </div>

        {/* Patient Safety Warning */}
        {mode === 'comparison' && patientAnalysis.hasMultiplePatients && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertDescription className="text-sm">
              ⚠️ Multiple patients detected: {patientAnalysis.patientIds.join(', ')}
              <br />
              Please verify this is intentional for comparison purposes.
            </AlertDescription>
          </Alert>
        )}

        {/* Search and Filter Controls */}
        {showSearchFilter && (
          <div className="space-y-2">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search studies..."
                value={filterState.searchQuery}
                onChange={handleSearchChange}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <svg
                className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>

            {/* Filter Controls */}
            <div className="flex gap-2">
              {/* Modality Filter */}
              <Select value={filterState.modalityFilter} onValueChange={handleModalityFilterChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Modality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {availableModalities.map(modality => (
                    <SelectItem key={modality} value={modality}>
                      {modality}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sort Controls */}
              <Select value={filterState.sortBy} onValueChange={handleSortChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="studyDate">Date</SelectItem>
                  <SelectItem value="patientName">Patient</SelectItem>
                  <SelectItem value="studyDescription">Description</SelectItem>
                  <SelectItem value="numberOfSeries">Series Count</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={handleSortOrderToggle}
                className="h-8 w-8 p-0"
                title={`Sort ${filterState.sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {filterState.sortOrder === 'asc' ? (
                    <path d="M12 2l-7 7h4v11h6V9h4z" />
                  ) : (
                    <path d="M12 22l7-7h-4V4H9v11H5z" />
                  )}
                </svg>
              </Button>

              {/* Comparison Mode Controls */}
              {mode === 'comparison' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    disabled={isLoading || filteredStudies.length === 0 || selectedStudies.length >= maxSelections}
                    className="h-8 text-xs"
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearAll}
                    disabled={isLoading || selectedStudies.length === 0}
                    className="h-8 text-xs"
                  >
                    Clear
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </CardHeader>

      <Separator />

      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-20">
            <div className="text-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Loading studies...</p>
            </div>
          </div>
        ) : filteredStudies.length === 0 ? (
          <div className="flex items-center justify-center h-20">
            <div className="text-center">
              <svg className="w-8 h-8 mx-auto mb-2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <p className="text-xs text-muted-foreground">No studies found</p>
            </div>
          </div>
        ) : (
          <div
            className="space-y-2 overflow-y-auto p-4"
            style={{ maxHeight }}
          >
            {filteredStudies.map((study) => {
              const isSelected = mode === 'single' 
                ? selectedStudyId === study.studyInstanceUID
                : selectedStudies.some(s => s.studyInstanceUID === study.studyInstanceUID);
              
              const selectionIndex = mode === 'comparison' 
                ? selectedStudies.findIndex(s => s.studyInstanceUID === study.studyInstanceUID)
                : -1;
              
              const isDifferentPatient = mode === 'comparison' && enablePatientSafety && 
                selectedStudies.length > 0 && 
                selectedStudies[0].patientId !== (study.patientID || 'Unknown');
              
              const totalImages = study.totalImages || study.series.reduce((sum, s) => sum + s.numberOfInstances, 0);
              const isDisabled = mode === 'comparison' && !isSelected && selectedStudies.length >= maxSelections;

              return (
                <Card
                  key={study.studyInstanceUID}
                  className={cn(
                    'cursor-pointer transition-all duration-200 hover:shadow-sm',
                    'border',
                    isSelected && 'ring-2 ring-primary ring-offset-1 border-primary bg-primary/5',
                    !isSelected && 'hover:border-primary/50',
                    isDifferentPatient && 'border-orange-200 bg-orange-50/50',
                    isDisabled && 'cursor-not-allowed opacity-60'
                  )}
                  style={{
                    backgroundColor: isSelected && study.color ? `${study.color}10` : undefined,
                  }}
                  onClick={() => {
                    if (mode === 'comparison') {
                      handleStudyToggle(study);
                    } else {
                      handleStudyClick(study.studyInstanceUID);
                    }
                  }}
                  onDoubleClick={() => mode === 'single' && handleStudyDoubleClick(study.studyInstanceUID)}
                >
                  {/* Study Color Indicator */}
                  {study.color && (
                    <div
                      className="absolute top-0 left-0 w-1 h-full rounded-l-lg"
                      style={{ backgroundColor: study.color }}
                    />
                  )}

                  <CardContent className="p-3">
                    <div className="flex gap-3">
                      {/* Checkbox for comparison mode */}
                      {mode === 'comparison' && (
                        <div className="flex-shrink-0 pt-1">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleStudyToggle(study)}
                            disabled={isDisabled}
                            aria-label={`${isSelected ? 'Deselect' : 'Select'} study`}
                          />
                        </div>
                      )}

                      {/* Thumbnail */}
                      {showThumbnails && (
                        <div className="flex-shrink-0">
                          <img
                            src={study.thumbnailUrl || generateStudyThumbnail(study)}
                            alt={`Study ${study.studyDescription || 'Unnamed'}`}
                            className="w-16 h-16 rounded border object-cover"
                            loading="lazy"
                          />
                        </div>
                      )}

                      {/* Study Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <h4 className="font-medium text-sm truncate" title={study.studyDescription}>
                            {study.studyDescription || 'Unnamed Study'}
                          </h4>
                          <div className="flex items-center gap-1 ml-2">
                            {mode === 'comparison' && isSelected && selectionIndex >= 0 && (
                              <Badge variant="default" className="w-5 h-5 p-0 text-xs flex items-center justify-center">
                                {selectionIndex + 1}
                              </Badge>
                            )}
                            {isDifferentPatient && (
                              <Badge variant="destructive" className="text-xs">
                                Different Patient
                              </Badge>
                            )}
                            {study.isActive && (
                              <Badge variant="secondary" className="text-xs">
                                Active
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center justify-between">
                            <span className="truncate" title={study.patientName}>
                              {study.patientName || 'Unknown Patient'}
                            </span>
                            <span>{formatStudyDate(study.studyDate)}</span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span>{study.series.length} series</span>
                            <span>{totalImages} images</span>
                          </div>

                          {study.accessionNumber && (
                            <div className="text-xs text-muted-foreground/80">
                              Acc: {study.accessionNumber}
                            </div>
                          )}
                        </div>

                        {/* Modality badges */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {[...new Set(study.series.map(s => s.modality))].map(modality => (
                            <Badge
                              key={modality}
                              variant="outline"
                              className="text-xs"
                              style={{
                                borderColor: study.color ? `${study.color}50` : undefined,
                                color: study.color || undefined,
                              }}
                            >
                              {modality}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StudySelector;
