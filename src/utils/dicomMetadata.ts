/* eslint-disable security/detect-object-injection */
// NOTE: DICOM metadata processing requires dynamic object property access
/**
 * DICOM Metadata Utilities
 *
 * Comprehensive DICOM metadata handling and validation utilities
 * Based on Context7 documentation patterns from /cornerstonejs/cornerstone3d
 * Reference: 443 code examples for DICOM metadata handling
 */

import { Types } from '@cornerstonejs/core';
import { DICOMMetadata, DICOMSeries, DICOMStudy } from '../types/dicom';
import { SUPPORTED_SOP_CLASSES } from './sopClasses';

/**
 * DICOM Tag Dictionary for common tags used in medical imaging
 * Following Context7 documented tag extraction patterns
 */
export const DICOM_TAGS = {
  // Patient Information
  PATIENT_NAME: 'x00100010',
  PATIENT_ID: 'x00100020',
  PATIENT_BIRTH_DATE: 'x00100030',
  PATIENT_SEX: 'x00100040',
  PATIENT_AGE: 'x00101010',
  PATIENT_WEIGHT: 'x00101030',

  // Study Information
  STUDY_INSTANCE_UID: 'x0020000d',
  STUDY_DATE: 'x00080020',
  STUDY_TIME: 'x00080030',
  STUDY_DESCRIPTION: 'x00081030',
  ACCESSION_NUMBER: 'x00080050',
  REFERRING_PHYSICIAN: 'x00080090',

  // Series Information
  SERIES_INSTANCE_UID: 'x0020000e',
  SERIES_DATE: 'x00080021',
  SERIES_TIME: 'x00080031',
  SERIES_DESCRIPTION: 'x0008103e',
  SERIES_NUMBER: 'x00200011',
  MODALITY: 'x00080060',
  BODY_PART_EXAMINED: 'x00180015',

  // Instance Information
  SOP_INSTANCE_UID: 'x00080018',
  SOP_CLASS_UID: 'x00080016',
  INSTANCE_NUMBER: 'x00200013',
  ACQUISITION_NUMBER: 'x00200012',
  CONTENT_DATE: 'x00080023',
  CONTENT_TIME: 'x00080033',

  // Image Information
  ROWS: 'x00280010',
  COLUMNS: 'x00280011',
  BITS_ALLOCATED: 'x00280100',
  BITS_STORED: 'x00280101',
  HIGH_BIT: 'x00280102',
  PIXEL_REPRESENTATION: 'x00280103',
  SAMPLES_PER_PIXEL: 'x00280002',
  PHOTOMETRIC_INTERPRETATION: 'x00280004',
  PLANAR_CONFIGURATION: 'x00280006',
  NUMBER_OF_FRAMES: 'x00280008',

  // Spacing and Geometry
  PIXEL_SPACING: 'x00280030',
  SLICE_THICKNESS: 'x00180050',
  SLICE_LOCATION: 'x00201041',
  IMAGE_POSITION_PATIENT: 'x00200032',
  IMAGE_ORIENTATION_PATIENT: 'x00200037',
  SPACING_BETWEEN_SLICES: 'x00180088',

  // Display Parameters
  WINDOW_CENTER: 'x00281050',
  WINDOW_WIDTH: 'x00281051',
  RESCALE_INTERCEPT: 'x00281052',
  RESCALE_SLOPE: 'x00281053',
  RESCALE_TYPE: 'x00281054',

  // Transfer Syntax
  TRANSFER_SYNTAX_UID: 'x00020010',

  // Acquisition Parameters
  KVP: 'x00180060',
  EXPOSURE_TIME: 'x00181150',
  X_RAY_TUBE_CURRENT: 'x00181151',
  EXPOSURE: 'x00181152',
  FILTER_TYPE: 'x00181160',
  GENERATOR_POWER: 'x00181170',

  // Contrast Information
  CONTRAST_BOLUS_AGENT: 'x00180010',
  CONTRAST_BOLUS_ROUTE: 'x00180012',
  CONTRAST_BOLUS_VOLUME: 'x00180014',
  CONTRAST_FLOW_RATE: 'x00180018',
  CONTRAST_FLOW_DURATION: 'x0018001a',

  // Equipment Information
  MANUFACTURER: 'x00080070',
  MANUFACTURER_MODEL_NAME: 'x00081090',
  DEVICE_SERIAL_NUMBER: 'x00181000',
  SOFTWARE_VERSION: 'x00181020',
  INSTITUTION_NAME: 'x00080080',
  STATION_NAME: 'x00081010',
} as const;

/**
 * Extract comprehensive DICOM metadata from an image
 * Following Context7 documented metadata extraction patterns
 */
export function extractDicomMetadata(image: Types.IImage): DICOMMetadata {
  if (!image.data) {
    throw new Error('Image data not available for metadata extraction');
  }

  const data = image.data;

  // Extract core metadata using Context7 patterns
  const metadata: DICOMMetadata = {
    StudyInstanceUID: data.string(DICOM_TAGS.STUDY_INSTANCE_UID) || '',
    SeriesInstanceUID: data.string(DICOM_TAGS.SERIES_INSTANCE_UID) || '',
    SOPInstanceUID: data.string(DICOM_TAGS.SOP_INSTANCE_UID) || '',

    // Patient Information
    PatientID: data.string(DICOM_TAGS.PATIENT_ID),
    PatientName: data.string(DICOM_TAGS.PATIENT_NAME),

    // Study Information
    StudyDate: data.string(DICOM_TAGS.STUDY_DATE),

    // Series Information
    Modality: data.string(DICOM_TAGS.MODALITY),
    SeriesDescription: data.string(DICOM_TAGS.SERIES_DESCRIPTION),

    // Image Dimensions
    Rows: data.uint16(DICOM_TAGS.ROWS),
    Columns: data.uint16(DICOM_TAGS.COLUMNS),
    NumberOfFrames: data.uint16(DICOM_TAGS.NUMBER_OF_FRAMES) || 1,

    // Spacing Information
    PixelSpacing: parsePixelSpacing(data.string(DICOM_TAGS.PIXEL_SPACING)),
    SliceThickness: data.floatString(DICOM_TAGS.SLICE_THICKNESS),

    // Orientation
    ImageOrientationPatient: parseFloatArray(data.string(DICOM_TAGS.IMAGE_ORIENTATION_PATIENT)),
    ImagePositionPatient: parseFloatArray(data.string(DICOM_TAGS.IMAGE_POSITION_PATIENT)),
  };

  return metadata;
}

/**
 * Validate DICOM metadata for medical imaging compliance
 * Based on Context7 validation patterns
 */
export function validateDicomMetadata(metadata: DICOMMetadata): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields validation
  if (!metadata.StudyInstanceUID) {
    errors.push('Missing required Study Instance UID');
  }

  if (!metadata.SeriesInstanceUID) {
    errors.push('Missing required Series Instance UID');
  }

  if (!metadata.SOPInstanceUID) {
    errors.push('Missing required SOP Instance UID');
  }

  if (!metadata.Modality) {
    errors.push('Missing required Modality');
  }

  // Image dimension validation
  if (!metadata.Rows || metadata.Rows <= 0) {
    errors.push('Invalid or missing image rows');
  }

  if (!metadata.Columns || metadata.Columns <= 0) {
    errors.push('Invalid or missing image columns');
  }

  // Pixel spacing validation for measurements
  if (!metadata.PixelSpacing || metadata.PixelSpacing.length !== 2) {
    warnings.push('Missing or invalid pixel spacing - measurements may be inaccurate');
  }

  // Slice thickness validation for volume rendering
  if (!metadata.SliceThickness) {
    warnings.push('Missing slice thickness - 3D reconstruction may be affected');
  }

  // Orientation validation for MPR
  if (!metadata.ImageOrientationPatient || metadata.ImageOrientationPatient.length !== 6) {
    warnings.push('Missing or invalid image orientation - MPR may not work correctly');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Create DICOM series object from image metadata array
 * Following Context7 series organization patterns
 */
export function createDicomSeries(images: Types.IImage[]): DICOMSeries[] {
  if (images.length === 0) {
    return [];
  }

  // Group images by series
  const seriesMap = new Map<string, Types.IImage[]>();

  images.forEach(image => {
    const metadata = extractDicomMetadata(image);
    const seriesUID = metadata.SeriesInstanceUID;

    if (!seriesMap.has(seriesUID)) {
      seriesMap.set(seriesUID, []);
    }

    seriesMap.get(seriesUID)!.push(image);
  });

  // Convert to DICOMSeries objects
  const series: DICOMSeries[] = [];

  seriesMap.forEach((seriesImages, seriesUID) => {
    if (seriesImages.length === 0) return;

    const firstImage = seriesImages[0];
    const metadata = extractDicomMetadata(firstImage);

    // Sort images by instance number
    const sortedImages = seriesImages.sort((a, b) => {
      const aInstance = a.data?.uint16(DICOM_TAGS.INSTANCE_NUMBER) || 0;
      const bInstance = b.data?.uint16(DICOM_TAGS.INSTANCE_NUMBER) || 0;
      return aInstance - bInstance;
    });

    // Generate image IDs
    const imageIds = sortedImages.map(img => img.imageId);
    const metadataArray = sortedImages.map(img => extractDicomMetadata(img));

    series.push({
      seriesInstanceUID: seriesUID,
      seriesDescription: metadata.SeriesDescription || 'Unknown Series',
      modality: metadata.Modality || 'Unknown',
      numberOfInstances: seriesImages.length,
      imageIds: imageIds.filter((id): id is string => id !== undefined),
      metadata: metadataArray,
    });
  });

  return series;
}

/**
 * Create DICOM study object from series array
 * Based on Context7 study organization patterns
 */
export function createDicomStudy(series: DICOMSeries[]): DICOMStudy | null {
  if (series.length === 0) {
    return null;
  }

  // Get study information from first series
  const firstSeries = series[0];
  const firstMetadata = firstSeries.metadata[0];

  return {
    studyInstanceUID: firstMetadata.StudyInstanceUID,
    studyDescription: 'DICOM Study', // Would be extracted from metadata
    studyDate: firstMetadata.StudyDate,
    patientName: firstMetadata.PatientName,
    patientID: firstMetadata.PatientID,
    series,
  };
}

/**
 * Get display-friendly metadata information
 * Following Context7 display patterns
 */
export function getDisplayMetadata(metadata: DICOMMetadata): Record<string, string> {
  return {
    'Patient Name': metadata.PatientName || 'N/A',
    'Patient ID': metadata.PatientID || 'N/A',
    'Study Date': formatDicomDate(metadata.StudyDate),
    'Modality': metadata.Modality || 'N/A',
    'Series Description': metadata.SeriesDescription || 'N/A',
    'Image Size': `${metadata.Columns || 0} × ${metadata.Rows || 0}`,
    'Number of Frames': (metadata.NumberOfFrames || 1).toString(),
    'Pixel Spacing': formatPixelSpacing(metadata.PixelSpacing),
    'Slice Thickness': metadata.SliceThickness ? `${metadata.SliceThickness} mm` : 'N/A',
  };
}

/**
 * Check if SOP Class is supported
 * Based on Context7 SOP class validation
 */
export function isSupportedSOPClass(sopClassUID: string): boolean {
  return Object.values(SUPPORTED_SOP_CLASSES).includes(sopClassUID as any);
}

/**
 * Get SOP Class name from UID
 */
export function getSOPClassName(sopClassUID: string): string {
  const entry = Object.entries(SUPPORTED_SOP_CLASSES).find(([_, uid]) => uid === sopClassUID);
  return entry ? entry[0].replace(/_/g, ' ') : 'Unknown SOP Class';
}

/**
 * Calculate volume spacing for 3D reconstruction
 * Following Context7 3D volume patterns
 */
export function calculateVolumeSpacing(series: DICOMSeries): [number, number, number] | null {
  if (series.metadata.length < 2) {
    return null;
  }

  const firstMetadata = series.metadata[0];
  const pixelSpacing = firstMetadata.PixelSpacing;

  if (!pixelSpacing || pixelSpacing.length !== 2) {
    return null;
  }

  // Calculate slice spacing from image positions
  let sliceSpacing = firstMetadata.SliceThickness || 1.0;

  if (series.metadata.length > 1) {
    const positions = series.metadata
      .map(m => m.ImagePositionPatient)
      .filter(pos => pos && pos.length === 3)
      .map(pos => pos![2]); // Z coordinate

    if (positions.length > 1) {
      const spacings = [];
      for (let i = 1; i < positions.length; i++) {
        spacings.push(Math.abs(positions[i] - positions[i - 1]));
      }

      if (spacings.length > 0) {
        sliceSpacing = spacings.reduce((a, b) => a + b) / spacings.length;
      }
    }
  }

  return [pixelSpacing[0], pixelSpacing[1], sliceSpacing];
}

/**
 * Utility functions for parsing DICOM values
 */
function parsePixelSpacing(pixelSpacingStr?: string): [number, number] | undefined {
  if (!pixelSpacingStr) return undefined;

  const parts = pixelSpacingStr.split('\\');
  if (parts.length >= 2) {
    const row = parseFloat(parts[0]);
    const col = parseFloat(parts[1]);

    if (!isNaN(row) && !isNaN(col)) {
      return [row, col];
    }
  }

  return undefined;
}

function parseFloatArray(str?: string): number[] | undefined {
  if (!str) return undefined;

  const parts = str.split('\\');
  const numbers = parts.map(part => parseFloat(part)).filter(num => !isNaN(num));

  return numbers.length > 0 ? numbers : undefined;
}

function formatDicomDate(dateStr?: string): string {
  if (!dateStr || dateStr.length !== 8) {
    return 'N/A';
  }

  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);

  return `${year}-${month}-${day}`;
}

function formatPixelSpacing(spacing?: [number, number]): string {
  if (!spacing) return 'N/A';

  return `${spacing[0].toFixed(3)} × ${spacing[1].toFixed(3)} mm`;
}

/**
 * Export commonly used validation functions
 */
export const DicomMetadataValidator = {
  isValidStudyUID: (uid: string) => uid && uid.length > 0,
  isValidSeriesUID: (uid: string) => uid && uid.length > 0,
  isValidSOPInstanceUID: (uid: string) => uid && uid.length > 0,
  isValidModality: (modality: string) => modality && modality.length > 0,
  isValidImageDimensions: (rows?: number, cols?: number) =>
    rows !== undefined && cols !== undefined && rows > 0 && cols > 0,
};
