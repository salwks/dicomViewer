/**
 * DICOM Metadata Utilities
 *
 * Convenience functions for working with DICOM metadata
 * Based on Context7 documentation patterns from /cornerstonejs/cornerstone3d
 * Reference: 443 code examples for metadata utility functions
 */

import { DICOMMetadata } from '../types/dicom';
import { advancedDicomLoader } from '../services/advancedDicomLoader';

/**
 * Common DICOM tag shortcuts for easier access
 * Following Context7 tag access patterns
 */
export const MetadataShortcuts = {
  // Patient Information
  getPatientName: (imageId: string) => advancedDicomLoader.getTagValue(imageId, 'x00100010'),
  getPatientID: (imageId: string) => advancedDicomLoader.getTagValue(imageId, 'x00100020'),
  getPatientBirthDate: (imageId: string) => advancedDicomLoader.getTagValue(imageId, 'x00100030'),
  getPatientSex: (imageId: string) => advancedDicomLoader.getTagValue(imageId, 'x00100040'),
  getPatientAge: (imageId: string) => advancedDicomLoader.getTagValue(imageId, 'x00101010'),

  // Study Information
  getStudyInstanceUID: (imageId: string) => advancedDicomLoader.getTagValue(imageId, 'x0020000d'),
  getStudyDate: (imageId: string) => advancedDicomLoader.getTagValue(imageId, 'x00080020'),
  getStudyTime: (imageId: string) => advancedDicomLoader.getTagValue(imageId, 'x00080030'),
  getStudyDescription: (imageId: string) => advancedDicomLoader.getTagValue(imageId, 'x00081030'),
  getAccessionNumber: (imageId: string) => advancedDicomLoader.getTagValue(imageId, 'x00080050'),

  // Series Information
  getSeriesInstanceUID: (imageId: string) => advancedDicomLoader.getTagValue(imageId, 'x0020000e'),
  getSeriesDescription: (imageId: string) => advancedDicomLoader.getTagValue(imageId, 'x0008103e'),
  getSeriesNumber: (imageId: string) => advancedDicomLoader.getTagValue(imageId, 'x00200011'),
  getModality: (imageId: string) => advancedDicomLoader.getTagValue(imageId, 'x00080060'),
  getBodyPartExamined: (imageId: string) => advancedDicomLoader.getTagValue(imageId, 'x00180015'),

  // Image Information
  getSOPInstanceUID: (imageId: string) => advancedDicomLoader.getTagValue(imageId, 'x00080018'),
  getInstanceNumber: (imageId: string) => advancedDicomLoader.getTagValue(imageId, 'x00200013'),
  getRows: (imageId: string) => advancedDicomLoader.getTagValue<number>(imageId, 'x00280010', { parseVR: true }),
  getColumns: (imageId: string) => advancedDicomLoader.getTagValue<number>(imageId, 'x00280011', { parseVR: true }),
  getPixelSpacing: (imageId: string) => advancedDicomLoader.getTagValue(imageId, 'x00280030'),
  getSliceThickness: (imageId: string) => advancedDicomLoader.getTagValue<number>(imageId, 'x00180050', { parseVR: true }),

  // Display Parameters
  getWindowCenter: (imageId: string) => advancedDicomLoader.getTagValue<number>(imageId, 'x00281050', { parseVR: true }),
  getWindowWidth: (imageId: string) => advancedDicomLoader.getTagValue<number>(imageId, 'x00281051', { parseVR: true }),
  getRescaleIntercept: (imageId: string) => advancedDicomLoader.getTagValue<number>(imageId, 'x00281052', { parseVR: true }),
  getRescaleSlope: (imageId: string) => advancedDicomLoader.getTagValue<number>(imageId, 'x00281053', { parseVR: true }),

  // Equipment Information
  getManufacturer: (imageId: string) => advancedDicomLoader.getTagValue(imageId, 'x00080070'),
  getManufacturerModelName: (imageId: string) => advancedDicomLoader.getTagValue(imageId, 'x00081090'),
  getInstitutionName: (imageId: string) => advancedDicomLoader.getTagValue(imageId, 'x00080080'),
  getStationName: (imageId: string) => advancedDicomLoader.getTagValue(imageId, 'x00081010'),
};

/**
 * Extract key metadata for display purposes
 * Following Context7 display metadata patterns
 */
export function getDisplayMetadata(imageId: string): Record<string, string> {
  return {
    'Patient Name': MetadataShortcuts.getPatientName(imageId) || 'N/A',
    'Patient ID': MetadataShortcuts.getPatientID(imageId) || 'N/A',
    'Study Date': formatDicomDate(MetadataShortcuts.getStudyDate(imageId)) || 'N/A',
    'Modality': MetadataShortcuts.getModality(imageId) || 'N/A',
    'Series Description': MetadataShortcuts.getSeriesDescription(imageId) || 'N/A',
    'Instance Number': MetadataShortcuts.getInstanceNumber(imageId)?.toString() || 'N/A',
    'Image Size': `${MetadataShortcuts.getColumns(imageId) || 0} × ${MetadataShortcuts.getRows(imageId) || 0}`,
    'Pixel Spacing': formatPixelSpacing(MetadataShortcuts.getPixelSpacing(imageId)) || 'N/A',
    'Slice Thickness': formatSliceThickness(MetadataShortcuts.getSliceThickness(imageId)) || 'N/A',
    'Manufacturer': MetadataShortcuts.getManufacturer(imageId) || 'N/A',
  };
}

/**
 * Get comprehensive study information
 * Following Context7 study info patterns
 */
export function getStudyInfo(imageId: string): {
  studyInstanceUID: string;
  studyDate?: string;
  studyTime?: string;
  studyDescription?: string;
  accessionNumber?: string;
  patientName?: string;
  patientID?: string;
  modality?: string;
} {
  return {
    studyInstanceUID: MetadataShortcuts.getStudyInstanceUID(imageId) || '',
    studyDate: MetadataShortcuts.getStudyDate(imageId),
    studyTime: MetadataShortcuts.getStudyTime(imageId),
    studyDescription: MetadataShortcuts.getStudyDescription(imageId),
    accessionNumber: MetadataShortcuts.getAccessionNumber(imageId),
    patientName: MetadataShortcuts.getPatientName(imageId),
    patientID: MetadataShortcuts.getPatientID(imageId),
    modality: MetadataShortcuts.getModality(imageId),
  };
}

/**
 * Get comprehensive series information
 * Following Context7 series info patterns
 */
export function getSeriesInfo(imageId: string): {
  seriesInstanceUID: string;
  seriesDescription?: string;
  seriesNumber?: number;
  modality?: string;
  bodyPartExamined?: string;
  imageCount?: number;
} {
  return {
    seriesInstanceUID: MetadataShortcuts.getSeriesInstanceUID(imageId) || '',
    seriesDescription: MetadataShortcuts.getSeriesDescription(imageId),
    seriesNumber: MetadataShortcuts.getSeriesNumber(imageId),
    modality: MetadataShortcuts.getModality(imageId),
    bodyPartExamined: MetadataShortcuts.getBodyPartExamined(imageId),
  };
}

/**
 * Get image acquisition parameters
 * Following Context7 acquisition info patterns
 */
export function getAcquisitionInfo(imageId: string): {
  rows?: number;
  columns?: number;
  pixelSpacing?: [number, number];
  sliceThickness?: number;
  windowCenter?: number;
  windowWidth?: number;
  rescaleIntercept?: number;
  rescaleSlope?: number;
} {
  const pixelSpacingStr = MetadataShortcuts.getPixelSpacing(imageId);
  let pixelSpacing: [number, number] | undefined;

  if (typeof pixelSpacingStr === 'string') {
    const parts = pixelSpacingStr.split('\\');
    if (parts.length >= 2) {
      const row = parseFloat(parts[0]);
      const col = parseFloat(parts[1]);
      if (!isNaN(row) && !isNaN(col)) {
        pixelSpacing = [row, col];
      }
    }
  }

  return {
    rows: MetadataShortcuts.getRows(imageId),
    columns: MetadataShortcuts.getColumns(imageId),
    pixelSpacing,
    sliceThickness: MetadataShortcuts.getSliceThickness(imageId),
    windowCenter: MetadataShortcuts.getWindowCenter(imageId),
    windowWidth: MetadataShortcuts.getWindowWidth(imageId),
    rescaleIntercept: MetadataShortcuts.getRescaleIntercept(imageId),
    rescaleSlope: MetadataShortcuts.getRescaleSlope(imageId),
  };
}

/**
 * Check if metadata contains PHI (Personal Health Information)
 * Following Context7 PHI detection patterns
 */
export function containsPHI(metadata: DICOMMetadata): {
  hasPHI: boolean;
  phiFields: string[];
  recommendations: string[];
} {
  const phiFields: string[] = [];
  const recommendations: string[] = [];

  // Check for patient identifying information
  if (metadata.PatientName && metadata.PatientName !== 'ANONYMOUS') {
    phiFields.push('Patient Name');
  }

  if (metadata.PatientID && metadata.PatientID !== 'ANONYMOUS') {
    phiFields.push('Patient ID');
  }

  // Check for dates that could be identifying
  if (metadata.StudyDate) {
    phiFields.push('Study Date');
  }

  // Add recommendations based on findings
  if (phiFields.length > 0) {
    recommendations.push('Consider anonymizing metadata before sharing');
    recommendations.push('Review HIPAA compliance requirements');
    recommendations.push('Use anonymization functions provided by the metadata manager');
  } else {
    recommendations.push('Metadata appears to be anonymized');
  }

  return {
    hasPHI: phiFields.length > 0,
    phiFields,
    recommendations,
  };
}

/**
 * Calculate pixel area in square millimeters
 * Following Context7 measurement calculation patterns
 */
export function calculatePixelArea(imageId: string): number | null {
  const acquisitionInfo = getAcquisitionInfo(imageId);

  if (acquisitionInfo.pixelSpacing && acquisitionInfo.pixelSpacing.length === 2) {
    return acquisitionInfo.pixelSpacing[0] * acquisitionInfo.pixelSpacing[1];
  }

  return null;
}

/**
 * Calculate image aspect ratio
 * Following Context7 aspect ratio patterns
 */
export function calculateAspectRatio(imageId: string): number | null {
  const acquisitionInfo = getAcquisitionInfo(imageId);

  if (acquisitionInfo.rows && acquisitionInfo.columns) {
    return acquisitionInfo.columns / acquisitionInfo.rows;
  }

  return null;
}

/**
 * Generate metadata summary for logging/debugging
 * Following Context7 debugging patterns
 */
export function generateMetadataSummary(imageId: string): string {
  const displayData = getDisplayMetadata(imageId);
  const studyInfo = getStudyInfo(imageId);
  const seriesInfo = getSeriesInfo(imageId);

  return `
DICOM Metadata Summary for ${imageId}:
----------------------------------------
Patient: ${displayData['Patient Name']} (ID: ${displayData['Patient ID']})
Study: ${studyInfo.studyDescription || 'N/A'} (${displayData['Study Date']})
Series: ${seriesInfo.seriesDescription || 'N/A'} (${displayData['Modality']})
Image: ${displayData['Image Size']}, Instance #${displayData['Instance Number']}
Spacing: ${displayData['Pixel Spacing']}, Thickness: ${displayData['Slice Thickness']}
Equipment: ${displayData['Manufacturer']}
----------------------------------------
  `.trim();
}

/**
 * Validate required metadata for specific use cases
 * Following Context7 validation patterns
 */
export function validateMetadataForUseCase(
  imageId: string,
  useCase: 'measurement' | 'volume_rendering' | 'comparison' | 'export',
): {
  isValid: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];

  const acquisitionInfo = getAcquisitionInfo(imageId);
  const studyInfo = getStudyInfo(imageId);
  const seriesInfo = getSeriesInfo(imageId);

  switch (useCase) {
    case 'measurement':
      if (!acquisitionInfo.pixelSpacing) {
        missing.push('Pixel Spacing');
      }
      if (!acquisitionInfo.rows || !acquisitionInfo.columns) {
        missing.push('Image Dimensions');
      }
      break;

    case 'volume_rendering':
      if (!acquisitionInfo.pixelSpacing) {
        missing.push('Pixel Spacing');
      }
      if (!acquisitionInfo.sliceThickness) {
        missing.push('Slice Thickness');
      }
      if (!seriesInfo.seriesInstanceUID) {
        missing.push('Series Instance UID');
      }
      break;

    case 'comparison':
      if (!seriesInfo.modality) {
        missing.push('Modality');
      }
      if (!acquisitionInfo.rows || !acquisitionInfo.columns) {
        missing.push('Image Dimensions');
      }
      if (!studyInfo.studyInstanceUID) {
        missing.push('Study Instance UID');
      }
      break;

    case 'export':
      if (!studyInfo.studyInstanceUID) {
        missing.push('Study Instance UID');
      }
      if (!seriesInfo.seriesInstanceUID) {
        missing.push('Series Instance UID');
      }
      if (!MetadataShortcuts.getSOPInstanceUID(imageId)) {
        missing.push('SOP Instance UID');
      }
      break;
  }

  // Add warnings for recommended fields
  if (useCase === 'measurement' && !acquisitionInfo.sliceThickness) {
    warnings.push('Slice thickness recommended for accurate 3D measurements');
  }

  if (useCase === 'volume_rendering' && !acquisitionInfo.windowCenter) {
    warnings.push('Window/level parameters recommended for optimal display');
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Format DICOM date for display
 */
function formatDicomDate(dateStr?: string): string | undefined {
  if (!dateStr || dateStr.length !== 8) {
    return undefined;
  }

  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);

  return `${year}-${month}-${day}`;
}

/**
 * Format pixel spacing for display
 */
function formatPixelSpacing(spacing?: any): string | undefined {
  if (!spacing) return undefined;

  if (typeof spacing === 'string') {
    const parts = spacing.split('\\');
    if (parts.length >= 2) {
      const row = parseFloat(parts[0]);
      const col = parseFloat(parts[1]);
      if (!isNaN(row) && !isNaN(col)) {
        return `${row.toFixed(3)} × ${col.toFixed(3)} mm`;
      }
    }
  }

  if (Array.isArray(spacing) && spacing.length >= 2) {
    return `${spacing[0].toFixed(3)} × ${spacing[1].toFixed(3)} mm`;
  }

  return undefined;
}

/**
 * Format slice thickness for display
 */
function formatSliceThickness(thickness?: number): string | undefined {
  if (thickness === undefined || thickness === null) return undefined;

  return `${thickness.toFixed(3)} mm`;
}

/**
 * Metadata query helpers
 * Following Context7 query helper patterns
 */
export const MetadataQueries = {
  // Find all images in a study
  findImagesByStudy: (studyInstanceUID: string) =>
    advancedDicomLoader.queryMetadata({ studyInstanceUID }),

  // Find all images in a series
  findImagesBySeries: (seriesInstanceUID: string) =>
    advancedDicomLoader.queryMetadata({ seriesInstanceUID }),

  // Find images by modality
  findImagesByModality: (modality: string) => {
    const allMetadata = advancedDicomLoader.queryMetadata({});
    return allMetadata.filter(metadata => metadata.Modality === modality);
  },

  // Find images by patient
  findImagesByPatient: (patientID: string) => {
    const allMetadata = advancedDicomLoader.queryMetadata({});
    return allMetadata.filter(metadata => metadata.PatientID === patientID);
  },

  // Find images by date range
  findImagesByDateRange: (startDate: string, endDate: string) => {
    const allMetadata = advancedDicomLoader.queryMetadata({});
    return allMetadata.filter(metadata => {
      if (!metadata.StudyDate) return false;
      return metadata.StudyDate >= startDate && metadata.StudyDate <= endDate;
    });
  },
};

export { VRType } from '../services/metadataManager';
