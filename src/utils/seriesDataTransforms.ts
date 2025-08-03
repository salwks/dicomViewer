/**
 * Series Data Transformation Utilities
 * Helper functions for transforming and organizing series data
 */

import { DICOMStudy, DICOMSeries, SeriesManagementState } from '../types/dicom';
import { log } from './logger';

export interface SeriesFilterOptions {
  modality?: string;
  studyInstanceUID?: string;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  searchTerm?: string;
  minImages?: number;
  maxImages?: number;
}

export interface SeriesSortOptions {
  sortBy: 'seriesNumber' | 'seriesDescription' | 'modality' | 'studyDate' | 'numberOfInstances';
  sortOrder: 'asc' | 'desc';
  groupByStudy?: boolean;
}

export interface StudyStatistics {
  totalStudies: number;
  totalSeries: number;
  totalImages: number;
  modalityDistribution: Record<string, number>;
  seriesPerStudy: Record<string, number>;
  averageImagesPerSeries: number;
  studyDateRange: {
    earliest?: string;
    latest?: string;
  };
}

/**
 * Filter series based on provided criteria
 */
export const filterSeries = (
  series: (DICOMSeries & { studyInstanceUID: string; studyDate?: string; studyDescription?: string })[],
  options: SeriesFilterOptions,
): (DICOMSeries & { studyInstanceUID: string; studyDate?: string; studyDescription?: string })[] => {
  let filtered = [...series];

  // Filter by modality
  if (options.modality && options.modality !== 'all') {
    filtered = filtered.filter(s => s.modality === options.modality);
  }

  // Filter by study
  if (options.studyInstanceUID) {
    filtered = filtered.filter(s => s.studyInstanceUID === options.studyInstanceUID);
  }

  // Filter by date range
  if (options.dateRange) {
    filtered = filtered.filter(s => {
      if (!s.studyDate) return false;
      const studyDate = new Date(s.studyDate);
      return studyDate >= options.dateRange!.startDate && studyDate <= options.dateRange!.endDate;
    });
  }

  // Filter by search term (description, modality, study description)
  if (options.searchTerm) {
    const searchLower = options.searchTerm.toLowerCase();
    filtered = filtered.filter(s =>
      s.seriesDescription.toLowerCase().includes(searchLower) ||
      s.modality.toLowerCase().includes(searchLower) ||
      (s.studyDescription && s.studyDescription.toLowerCase().includes(searchLower)),
    );
  }

  // Filter by image count range
  if (options.minImages !== undefined) {
    filtered = filtered.filter(s => s.numberOfInstances >= options.minImages!);
  }

  if (options.maxImages !== undefined) {
    filtered = filtered.filter(s => s.numberOfInstances <= options.maxImages!);
  }

  log.info('Series filtered', {
    component: 'seriesDataTransforms',
    metadata: {
      originalCount: series.length,
      filteredCount: filtered.length,
      options,
    },
  });

  return filtered;
};

/**
 * Sort series based on provided criteria
 */
export const sortSeries = (
  series: (DICOMSeries & { studyInstanceUID: string; studyDate?: string })[],
  options: SeriesSortOptions,
): (DICOMSeries & { studyInstanceUID: string; studyDate?: string })[] => {
  const sorted = [...series];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (options.sortBy) {
      case 'seriesNumber':
        comparison = (a.seriesNumber || 0) - (b.seriesNumber || 0);
        break;
      case 'seriesDescription':
        comparison = a.seriesDescription.localeCompare(b.seriesDescription);
        break;
      case 'modality':
        comparison = a.modality.localeCompare(b.modality);
        break;
      case 'studyDate':
        comparison = (a.studyDate || '').localeCompare(b.studyDate || '');
        break;
      case 'numberOfInstances':
        comparison = a.numberOfInstances - b.numberOfInstances;
        break;
      default:
        comparison = 0;
    }

    // Apply sort order
    return options.sortOrder === 'desc' ? -comparison : comparison;
  });

  // Group by study if requested
  if (options.groupByStudy) {
    // First sort by study, then by the requested criteria within each study
    sorted.sort((a, b) => {
      const studyComparison = a.studyInstanceUID.localeCompare(b.studyInstanceUID);
      if (studyComparison !== 0) {
        return studyComparison;
      }
      // Within same study, maintain the sort criteria
      return 0; // The main sort has already been applied above
    });
  }

  return sorted;
};

/**
 * Group series by study
 */
export const groupSeriesByStudy = (
  series: (DICOMSeries & { studyInstanceUID: string; studyDescription?: string; patientName?: string; studyDate?: string })[],
  studies: DICOMStudy[],
): Map<string, {
  study: DICOMStudy;
  series: (DICOMSeries & { studyInstanceUID: string; studyDescription?: string; patientName?: string; studyDate?: string })[];
}> => {
  const grouped = new Map();

  studies.forEach(study => {
    const studySeries = series.filter(s => s.studyInstanceUID === study.studyInstanceUID);
    if (studySeries.length > 0) {
      grouped.set(study.studyInstanceUID, {
        study,
        series: studySeries,
      });
    }
  });

  return grouped;
};

/**
 * Calculate statistics for studies and series
 */
export const calculateStudyStatistics = (studies: DICOMStudy[]): StudyStatistics => {
  const stats: StudyStatistics = {
    totalStudies: studies.length,
    totalSeries: 0,
    totalImages: 0,
    modalityDistribution: {},
    seriesPerStudy: {},
    averageImagesPerSeries: 0,
    studyDateRange: {},
  };

  const allDates: string[] = [];

  studies.forEach(study => {
    stats.seriesPerStudy[study.studyInstanceUID] = study.series.length;
    stats.totalSeries += study.series.length;

    if (study.studyDate) {
      allDates.push(study.studyDate);
    }

    study.series.forEach(series => {
      stats.totalImages += series.numberOfInstances;

      // Update modality distribution
      if (stats.modalityDistribution[series.modality]) {
        stats.modalityDistribution[series.modality]++;
      } else {
        stats.modalityDistribution[series.modality] = 1;
      }
    });
  });

  // Calculate average images per series
  if (stats.totalSeries > 0) {
    stats.averageImagesPerSeries = Math.round(stats.totalImages / stats.totalSeries);
  }

  // Calculate date range
  if (allDates.length > 0) {
    allDates.sort();
    stats.studyDateRange.earliest = allDates[0];
    stats.studyDateRange.latest = allDates[allDates.length - 1];
  }

  return stats;
};

/**
 * Find series conflicts (same series in multiple studies)
 */
export const findSeriesConflicts = (studies: DICOMStudy[]): {
  conflictingSeries: string[];
  conflicts: Record<string, string[]>; // seriesUID -> studyUIDs
} => {
  const seriesStudyMap = new Map<string, string[]>();

  // Build map of series to studies
  studies.forEach(study => {
    study.series.forEach(series => {
      if (!seriesStudyMap.has(series.seriesInstanceUID)) {
        seriesStudyMap.set(series.seriesInstanceUID, []);
      }
      seriesStudyMap.get(series.seriesInstanceUID)!.push(study.studyInstanceUID);
    });
  });

  // Find conflicts
  const conflicts: Record<string, string[]> = {};
  const conflictingSeries: string[] = [];

  seriesStudyMap.forEach((studyUIDs, seriesUID) => {
    if (studyUIDs.length > 1) {
      conflicts[seriesUID] = studyUIDs;
      conflictingSeries.push(seriesUID);
    }
  });

  log.info('Series conflicts analyzed', {
    component: 'seriesDataTransforms',
    metadata: {
      totalSeries: seriesStudyMap.size,
      conflictCount: conflictingSeries.length,
    },
  });

  return { conflictingSeries, conflicts };
};

/**
 * Merge duplicate series across studies
 */
export const mergeDuplicateSeries = (studies: DICOMStudy[]): DICOMStudy[] => {
  const conflicts = findSeriesConflicts(studies);

  if (conflicts.conflictingSeries.length === 0) {
    return studies; // No conflicts to resolve
  }

  const mergedStudies = studies.map(study => ({ ...study, series: [...study.series] }));

  // For each conflicting series, keep it only in the first study (by date or UID)
  conflicts.conflictingSeries.forEach(seriesUID => {
    const studyUIDs = conflicts.conflicts[seriesUID];

    // Sort studies by date to determine which one should keep the series
    const studiesWithSeries = studyUIDs
      .map(studyUID => mergedStudies.find(s => s.studyInstanceUID === studyUID)!)
      .sort((a, b) => (a.studyDate || '').localeCompare(b.studyDate || ''));

    const keepInStudy = studiesWithSeries[0];

    // Remove series from all other studies
    studiesWithSeries.slice(1).forEach(study => {
      study.series = study.series.filter(s => s.seriesInstanceUID !== seriesUID);
    });

    log.info('Duplicate series resolved', {
      component: 'seriesDataTransforms',
      metadata: {
        seriesUID,
        keptInStudy: keepInStudy.studyInstanceUID,
        removedFromStudies: studiesWithSeries.slice(1).map(s => s.studyInstanceUID),
      },
    });
  });

  return mergedStudies;
};

/**
 * Validate series data integrity
 */
export const validateSeriesData = (studies: DICOMStudy[]): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];

  studies.forEach(study => {
    // Validate study has required fields
    if (!study.studyInstanceUID) {
      errors.push('Study missing studyInstanceUID');
    }

    if (study.series.length === 0) {
      warnings.push(`Study ${study.studyInstanceUID} has no series`);
    }

    study.series.forEach(series => {
      // Validate series has required fields
      if (!series.seriesInstanceUID) {
        errors.push(`Series in study ${study.studyInstanceUID} missing seriesInstanceUID`);
      }

      if (!series.modality) {
        errors.push(`Series ${series.seriesInstanceUID} missing modality`);
      }

      if (series.numberOfInstances <= 0) {
        warnings.push(`Series ${series.seriesInstanceUID} has ${series.numberOfInstances} instances`);
      }

      if (series.imageIds.length !== series.numberOfInstances) {
        warnings.push(`Series ${series.seriesInstanceUID} imageIds count (${series.imageIds.length}) doesn't match numberOfInstances (${series.numberOfInstances})`);
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Create series management state from studies
 */
export const createSeriesManagementState = (
  studies: DICOMStudy[],
  options: Partial<SeriesManagementState> = {},
): SeriesManagementState => {
  // Generate color mappings
  const colorMappings: Record<string, string> = {};
  const defaultColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  studies.forEach((study, index) => {
    colorMappings[study.studyInstanceUID] = defaultColors[index % defaultColors.length];
  });

  return {
    studies,
    selectedStudy: studies.length > 0 ? studies[0].studyInstanceUID : null,
    selectedSeries: null,
    viewportAssignments: {},
    draggedSeries: null,
    loadingStates: {},
    colorMappings,
    filterModality: 'all',
    sortBy: 'seriesNumber',
    viewMode: 'grid',
    showThumbnails: true,
    groupByStudy: true,
    ...options,
  };
};

/**
 * Export series data for external use
 */
export const exportSeriesData = (studies: DICOMStudy[], format: 'json' | 'csv' = 'json'): string => {
  if (format === 'csv') {
    const rows = ['Study UID,Study Description,Patient Name,Study Date,Series UID,Series Description,Modality,Number of Images'];

    studies.forEach(study => {
      study.series.forEach(series => {
        rows.push([
          study.studyInstanceUID,
          study.studyDescription || '',
          study.patientName || '',
          study.studyDate || '',
          series.seriesInstanceUID,
          series.seriesDescription,
          series.modality,
          series.numberOfInstances.toString(),
        ].join(','));
      });
    });

    return rows.join('\n');
  }

  // JSON format
  return JSON.stringify(studies, null, 2);
};
