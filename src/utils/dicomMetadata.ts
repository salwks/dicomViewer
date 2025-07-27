
// NOTE: DICOM metadata processing requires dynamic object property access
/**
 * DICOM Metadata Utilities
 *
 * Essential DICOM metadata handling utilities.
 * Unused exports have been removed to improve bundle size and maintainability.
 */

import { Types } from '@cornerstonejs/core';
import { DICOMMetadata } from '../types/dicom';

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

// Helper functions for extractDicomMetadata
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
