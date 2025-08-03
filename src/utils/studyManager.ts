/**
 * Study Management Utilities
 * Groups series into studies and provides study-level operations
 */

import { DicomSeries, Study } from '../components/EnhancedSeriesPanel';

export interface StudyGroupingOptions {
  groupByStudy: boolean;
  sortBy: 'studyDate' | 'patientName' | 'modality';
  sortOrder: 'asc' | 'desc';
}

export class StudyManager {
  /**
   * Group series data into studies
   */
  static groupSeriesIntoStudies(seriesData: DicomSeries[]): Study[] {
    if (seriesData.length === 0) return [];

    // Group by study UID (or patient name if studyUID not available)
    const studyGroups = new Map<string, DicomSeries[]>();

    seriesData.forEach(series => {
      const studyKey = series.studyUID || series.patientName || 'unknown';

      if (!studyGroups.has(studyKey)) {
        studyGroups.set(studyKey, []);
      }

      studyGroups.get(studyKey)!.push(series);
    });

    // Convert to Study objects
    const studies: Study[] = [];

    studyGroups.forEach((seriesList, studyKey) => {
      const firstSeries = seriesList[0];

      // Try to extract study information from first series
      const study: Study = {
        studyUID: firstSeries.studyUID || studyKey,
        studyDescription: this.extractStudyDescription(seriesList),
        patientName: firstSeries.patientName,
        studyDate: this.extractStudyDate(seriesList),
        modality: this.getStudyModalities(seriesList),
        series: seriesList.sort((a, b) => {
          // Sort series by series number
          const aNum = parseInt(a.seriesNumber, 10) || 0;
          const bNum = parseInt(b.seriesNumber, 10) || 0;
          return aNum - bNum;
        }),
      };

      studies.push(study);
    });

    return studies.sort((a, b) => {
      // Sort studies by study date (newest first)
      return new Date(b.studyDate).getTime() - new Date(a.studyDate).getTime();
    });
  }

  /**
   * Extract study description from series
   */
  private static extractStudyDescription(seriesList: DicomSeries[]): string {
    // Look for common patterns in series descriptions
    const descriptions = seriesList.map(s => s.seriesDescription);
    const commonWords = this.findCommonWords(descriptions);

    if (commonWords.length > 0) {
      return commonWords.slice(0, 3).join(' '); // Take first 3 common words
    }

    // Fallback to modality-based description
    const modalities = [...new Set(seriesList.map(s => s.modality))];
    return `${modalities.join('/')} Study`;
  }

  /**
   * Extract study date from series
   */
  private static extractStudyDate(_seriesList: DicomSeries[]): string {
    // For now, use current date as we don't have study date in series data
    // In real implementation, this would come from DICOM metadata
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get all modalities in a study
   */
  private static getStudyModalities(seriesList: DicomSeries[]): string {
    const modalities = [...new Set(seriesList.map(s => s.modality))];
    return modalities.join('/');
  }

  /**
   * Find common words in descriptions
   */
  private static findCommonWords(descriptions: string[]): string[] {
    if (descriptions.length === 0) return [];

    const wordCounts = new Map<string, number>();

    descriptions.forEach(desc => {
      const words = desc.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 2) // Filter out short words
        .filter(word => !/^\d+$/.test(word)); // Filter out numbers

      words.forEach(word => {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      });
    });

    // Return words that appear in more than half of the descriptions
    const threshold = Math.ceil(descriptions.length / 2);
    return Array.from(wordCounts.entries())
      .filter(([, count]) => count >= threshold)
      .sort(([, a], [, b]) => b - a) // Sort by frequency
      .map(([word]) => word);
  }

  /**
   * Sort studies based on options
   */
  static sortStudies(studies: Study[], options: StudyGroupingOptions): Study[] {
    const sorted = [...studies];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (options.sortBy) {
        case 'studyDate':
          comparison = new Date(a.studyDate).getTime() - new Date(b.studyDate).getTime();
          break;
        case 'patientName':
          comparison = a.patientName.localeCompare(b.patientName);
          break;
        case 'modality':
          comparison = a.modality.localeCompare(b.modality);
          break;
      }

      return options.sortOrder === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }

  /**
   * Filter studies by criteria
   */
  static filterStudies(studies: Study[], criteria: {
    patientName?: string;
    modality?: string;
    dateRange?: { start: Date; end: Date };
  }): Study[] {
    return studies.filter(study => {
      if (criteria.patientName && !study.patientName.toLowerCase().includes(criteria.patientName.toLowerCase())) {
        return false;
      }

      if (criteria.modality && !study.modality.includes(criteria.modality)) {
        return false;
      }

      if (criteria.dateRange) {
        const studyDate = new Date(study.studyDate);
        if (studyDate < criteria.dateRange.start || studyDate > criteria.dateRange.end) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Get study statistics
   */
  static getStudyStatistics(studies: Study[]): {
    totalStudies: number;
    totalSeries: number;
    totalImages: number;
    modalities: string[];
    patients: string[];
  } {
    const modalities = new Set<string>();
    const patients = new Set<string>();
    let totalSeries = 0;
    let totalImages = 0;

    studies.forEach(study => {
      study.series.forEach(series => {
        modalities.add(series.modality);
        totalImages += series.numberOfImages;
      });

      patients.add(study.patientName);
      totalSeries += study.series.length;
    });

    return {
      totalStudies: studies.length,
      totalSeries,
      totalImages,
      modalities: Array.from(modalities).sort(),
      patients: Array.from(patients).sort(),
    };
  }
}
