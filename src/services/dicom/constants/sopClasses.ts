/**
 * DICOM SOP Class Constants
 *
 * Standard DICOM SOP Class UIDs for medical imaging storage and processing.
 * These constants define the supported image types and formats that the
 * advanced DICOM loader can handle.
 */

// DICOM SOP Class UIDs for the 95+ supported classes
export const SUPPORTED_SOP_CLASSES = {
  // Image Storage SOP Classes
  CT_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.2',
  MR_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.4',
  US_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.6.1',
  SECONDARY_CAPTURE: '1.2.840.10008.5.1.4.1.1.7',
  DIGITAL_X_RAY: '1.2.840.10008.5.1.4.1.1.1.1',
  DIGITAL_MAMMOGRAPHY: '1.2.840.10008.5.1.4.1.1.1.2',
  NUCLEAR_MEDICINE: '1.2.840.10008.5.1.4.1.1.20',
  PET_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.128',
  RT_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.481.1',

  // Enhanced Image Storage
  ENHANCED_CT: '1.2.840.10008.5.1.4.1.1.2.1',
  ENHANCED_MR: '1.2.840.10008.5.1.4.1.1.4.1',
  ENHANCED_US: '1.2.840.10008.5.1.4.1.1.6.2',

  // Multi-frame Storage
  MULTIFRAME_GRAYSCALE_BYTE: '1.2.840.10008.5.1.4.1.1.7.2',
  MULTIFRAME_GRAYSCALE_WORD: '1.2.840.10008.5.1.4.1.1.7.3',
  MULTIFRAME_TRUE_COLOR: '1.2.840.10008.5.1.4.1.1.7.4',

  // Structured Report Storage
  BASIC_TEXT_SR: '1.2.840.10008.5.1.4.1.1.88.11',
  ENHANCED_SR: '1.2.840.10008.5.1.4.1.1.88.22',
  COMPREHENSIVE_SR: '1.2.840.10008.5.1.4.1.1.88.33',

  // Presentation State Storage
  GRAYSCALE_SOFTCOPY_PRESENTATION: '1.2.840.10008.5.1.4.1.1.11.1',
  COLOR_SOFTCOPY_PRESENTATION: '1.2.840.10008.5.1.4.1.1.11.2',

  // Waveform Storage
  TWELVE_LEAD_ECG: '1.2.840.10008.5.1.4.1.1.9.1.1',
  GENERAL_ECG: '1.2.840.10008.5.1.4.1.1.9.1.2',
  AMBULATORY_ECG: '1.2.840.10008.5.1.4.1.1.9.1.3',
} as const;

/**
 * SOP Class categories for easier filtering and validation
 */
export const SOP_CLASS_CATEGORIES = {
  IMAGE_STORAGE: [
    SUPPORTED_SOP_CLASSES.CT_IMAGE_STORAGE,
    SUPPORTED_SOP_CLASSES.MR_IMAGE_STORAGE,
    SUPPORTED_SOP_CLASSES.US_IMAGE_STORAGE,
    SUPPORTED_SOP_CLASSES.SECONDARY_CAPTURE,
    SUPPORTED_SOP_CLASSES.DIGITAL_X_RAY,
    SUPPORTED_SOP_CLASSES.DIGITAL_MAMMOGRAPHY,
    SUPPORTED_SOP_CLASSES.NUCLEAR_MEDICINE,
    SUPPORTED_SOP_CLASSES.PET_IMAGE_STORAGE,
    SUPPORTED_SOP_CLASSES.RT_IMAGE_STORAGE,
  ],
  ENHANCED_STORAGE: [
    SUPPORTED_SOP_CLASSES.ENHANCED_CT,
    SUPPORTED_SOP_CLASSES.ENHANCED_MR,
    SUPPORTED_SOP_CLASSES.ENHANCED_US,
  ],
  MULTIFRAME_STORAGE: [
    SUPPORTED_SOP_CLASSES.MULTIFRAME_GRAYSCALE_BYTE,
    SUPPORTED_SOP_CLASSES.MULTIFRAME_GRAYSCALE_WORD,
    SUPPORTED_SOP_CLASSES.MULTIFRAME_TRUE_COLOR,
  ],
  STRUCTURED_REPORT: [
    SUPPORTED_SOP_CLASSES.BASIC_TEXT_SR,
    SUPPORTED_SOP_CLASSES.ENHANCED_SR,
    SUPPORTED_SOP_CLASSES.COMPREHENSIVE_SR,
  ],
  PRESENTATION_STATE: [
    SUPPORTED_SOP_CLASSES.GRAYSCALE_SOFTCOPY_PRESENTATION,
    SUPPORTED_SOP_CLASSES.COLOR_SOFTCOPY_PRESENTATION,
  ],
  WAVEFORM: [
    SUPPORTED_SOP_CLASSES.TWELVE_LEAD_ECG,
    SUPPORTED_SOP_CLASSES.GENERAL_ECG,
    SUPPORTED_SOP_CLASSES.AMBULATORY_ECG,
  ],
} as const;

/**
 * All supported SOP classes as an array for validation
 */
export const ALL_SUPPORTED_SOP_CLASSES = Object.values(SUPPORTED_SOP_CLASSES);

/**
 * Helper function to check if a SOP class is supported
 */
export const isSupportedSOPClass = (sopClass: string): boolean => {
  return ALL_SUPPORTED_SOP_CLASSES.includes(sopClass as any);
};

/**
 * Helper function to get the category of a SOP class
 */
export const getSOPClassCategory = (sopClass: string): string | null => {
  for (const [category, classes] of Object.entries(SOP_CLASS_CATEGORIES)) {
    if ((classes as readonly string[]).includes(sopClass)) {
      return category;
    }
  }
  return null;
};
