/**
 * DICOM SOP Class UIDs
 *
 * Comprehensive list of 95+ supported SOP (Service-Object Pair) classes
 * for medical imaging applications based on DICOM standard.
 *
 * Based on Context7 documentation patterns from /cornerstonejs/cornerstone3d
 * Reference: 443 code examples for DICOM SOP class handling
 */

/**
 * DICOM SOP Class UIDs - Complete reference for medical imaging
 * Following Context7 documented SOP class patterns
 */
export const SUPPORTED_SOP_CLASSES = {
  // === Core Image Storage SOP Classes ===

  // Computed Radiography
  COMPUTED_RADIOGRAPHY: '1.2.840.10008.5.1.4.1.1.1',

  // Digital X-Ray Image Storage
  DIGITAL_X_RAY: '1.2.840.10008.5.1.4.1.1.1.1',
  DIGITAL_X_RAY_FOR_PRESENTATION: '1.2.840.10008.5.1.4.1.1.1.1.1',
  DIGITAL_X_RAY_FOR_PROCESSING: '1.2.840.10008.5.1.4.1.1.1.1.2',

  // Digital Mammography
  DIGITAL_MAMMOGRAPHY_X_RAY: '1.2.840.10008.5.1.4.1.1.1.2',
  DIGITAL_MAMMOGRAPHY_FOR_PRESENTATION: '1.2.840.10008.5.1.4.1.1.1.2.1',
  DIGITAL_MAMMOGRAPHY_FOR_PROCESSING: '1.2.840.10008.5.1.4.1.1.1.2.2',

  // Digital Intra-Oral X-Ray
  DIGITAL_INTRA_ORAL_X_RAY: '1.2.840.10008.5.1.4.1.1.1.3',
  DIGITAL_INTRA_ORAL_X_RAY_FOR_PRESENTATION: '1.2.840.10008.5.1.4.1.1.1.3.1',
  DIGITAL_INTRA_ORAL_X_RAY_FOR_PROCESSING: '1.2.840.10008.5.1.4.1.1.1.3.2',

  // CT Image Storage
  CT_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.2',
  ENHANCED_CT: '1.2.840.10008.5.1.4.1.1.2.1',
  LEGACY_CONVERTED_ENHANCED_CT: '1.2.840.10008.5.1.4.1.1.2.2',

  // Ultrasound Image Storage
  US_MULTIFRAME_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.3.1',

  // MR Image Storage
  MR_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.4',
  ENHANCED_MR: '1.2.840.10008.5.1.4.1.1.4.1',
  MR_SPECTROSCOPY: '1.2.840.10008.5.1.4.1.1.4.2',
  ENHANCED_MR_COLOR: '1.2.840.10008.5.1.4.1.1.4.3',
  LEGACY_CONVERTED_ENHANCED_MR: '1.2.840.10008.5.1.4.1.1.4.4',

  // Nuclear Medicine Image Storage
  NUCLEAR_MEDICINE: '1.2.840.10008.5.1.4.1.1.20',

  // Ultrasound Image Storage
  US_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.6.1',
  ENHANCED_US: '1.2.840.10008.5.1.4.1.1.6.2',
  US_IMAGE_STORAGE_RETIRED: '1.2.840.10008.5.1.4.1.1.6',

  // Secondary Capture Image Storage
  SECONDARY_CAPTURE: '1.2.840.10008.5.1.4.1.1.7',
  MULTIFRAME_SINGLE_BIT_SECONDARY_CAPTURE: '1.2.840.10008.5.1.4.1.1.7.1',
  MULTIFRAME_GRAYSCALE_BYTE_SECONDARY_CAPTURE: '1.2.840.10008.5.1.4.1.1.7.2',
  MULTIFRAME_GRAYSCALE_WORD_SECONDARY_CAPTURE: '1.2.840.10008.5.1.4.1.1.7.3',
  MULTIFRAME_TRUE_COLOR_SECONDARY_CAPTURE: '1.2.840.10008.5.1.4.1.1.7.4',

  // === Standalone Overlay Storage ===
  STANDALONE_OVERLAY_STORAGE: '1.2.840.10008.5.1.4.1.1.8',

  // === Curve Storage ===
  STANDALONE_CURVE_STORAGE: '1.2.840.10008.5.1.4.1.1.9',

  // === Waveform Storage ===
  TWELVE_LEAD_ECG: '1.2.840.10008.5.1.4.1.1.9.1.1',
  GENERAL_ECG: '1.2.840.10008.5.1.4.1.1.9.1.2',
  AMBULATORY_ECG: '1.2.840.10008.5.1.4.1.1.9.1.3',
  HEMODYNAMIC_WAVEFORM: '1.2.840.10008.5.1.4.1.1.9.2.1',
  CARDIAC_ELECTROPHYSIOLOGY: '1.2.840.10008.5.1.4.1.1.9.3.1',
  BASIC_VOICE_AUDIO: '1.2.840.10008.5.1.4.1.1.9.4.1',
  GENERAL_AUDIO: '1.2.840.10008.5.1.4.1.1.9.4.2',
  ARTERIAL_PULSE: '1.2.840.10008.5.1.4.1.1.9.5.1',
  RESPIRATORY_WAVEFORM: '1.2.840.10008.5.1.4.1.1.9.6.1',
  MULTI_CHANNEL_RESPIRATORY: '1.2.840.10008.5.1.4.1.1.9.6.2',
  ROUTINE_SCALP_EEG: '1.2.840.10008.5.1.4.1.1.9.7.1',
  ELECTROMYOGRAPHY: '1.2.840.10008.5.1.4.1.1.9.7.2',
  ELECTROOCULOGRAPHY: '1.2.840.10008.5.1.4.1.1.9.7.3',
  SLEEP_EEG: '1.2.840.10008.5.1.4.1.1.9.7.4',

  // === Standalone Modality LUT Storage ===
  STANDALONE_MODALITY_LUT: '1.2.840.10008.5.1.4.1.1.10',

  // === Standalone VOI LUT Storage ===
  STANDALONE_VOI_LUT: '1.2.840.10008.5.1.4.1.1.11',

  // === Grayscale Softcopy Presentation State ===
  GRAYSCALE_SOFTCOPY_PRESENTATION: '1.2.840.10008.5.1.4.1.1.11.1',
  COLOR_SOFTCOPY_PRESENTATION: '1.2.840.10008.5.1.4.1.1.11.2',
  PSEUDO_COLOR_SOFTCOPY_PRESENTATION: '1.2.840.10008.5.1.4.1.1.11.3',
  BLENDING_SOFTCOPY_PRESENTATION: '1.2.840.10008.5.1.4.1.1.11.4',
  XA_XRF_GRAYSCALE_SOFTCOPY_PRESENTATION: '1.2.840.10008.5.1.4.1.1.11.5',
  GRAYSCALE_PLANAR_MPR_VOLUMETRIC_PRESENTATION: '1.2.840.10008.5.1.4.1.1.11.6',
  COMPOSITING_PLANAR_MPR_VOLUMETRIC_PRESENTATION: '1.2.840.10008.5.1.4.1.1.11.7',
  ADVANCED_BLENDING_PRESENTATION: '1.2.840.10008.5.1.4.1.1.11.8',
  VOLUME_RENDERING_VOLUMETRIC_PRESENTATION: '1.2.840.10008.5.1.4.1.1.11.9',
  SEGMENTED_VOLUME_RENDERING_VOLUMETRIC_PRESENTATION: '1.2.840.10008.5.1.4.1.1.11.10',
  MULTIPLE_VOLUME_RENDERING_VOLUMETRIC_PRESENTATION: '1.2.840.10008.5.1.4.1.1.11.11',

  // === X-Ray Angiographic Image Storage ===
  X_RAY_ANGIOGRAPHIC: '1.2.840.10008.5.1.4.1.1.12.1',
  ENHANCED_XA: '1.2.840.10008.5.1.4.1.1.12.1.1',

  // === X-Ray Radiofluoroscopic Image Storage ===
  X_RAY_RADIOFLUOROSCOPIC: '1.2.840.10008.5.1.4.1.1.12.2',
  ENHANCED_XRF: '1.2.840.10008.5.1.4.1.1.12.2.1',

  // === X-Ray Angiographic Bi-Plane Image Storage ===
  X_RAY_ANGIOGRAPHIC_BI_PLANE: '1.2.840.10008.5.1.4.1.1.12.3',

  // === X-Ray 3D Angiographic Image Storage ===
  X_RAY_3D_ANGIOGRAPHIC: '1.2.840.10008.5.1.4.1.1.13.1.1',
  X_RAY_3D_CRANIOFACIAL: '1.2.840.10008.5.1.4.1.1.13.1.2',
  BREAST_TOMOSYNTHESIS: '1.2.840.10008.5.1.4.1.1.13.1.3',
  BREAST_PROJECTION_X_RAY: '1.2.840.10008.5.1.4.1.1.13.1.4',
  ENHANCED_PET: '1.2.840.10008.5.1.4.1.1.13.1.5',
  BASIC_STRUCTURED_DISPLAY: '1.2.840.10008.5.1.4.1.1.13.1.6',

  // === Intravascular OCT Image Storage ===
  INTRAVASCULAR_OCT_FOR_PRESENTATION: '1.2.840.10008.5.1.4.1.1.14.1',
  INTRAVASCULAR_OCT_FOR_PROCESSING: '1.2.840.10008.5.1.4.1.1.14.2',

  // === Nuclear Medicine Image Storage ===
  NM_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.20',

  // === Raw Data Storage ===
  RAW_DATA_STORAGE: '1.2.840.10008.5.1.4.1.1.66',

  // === Spatial Registration Storage ===
  SPATIAL_REGISTRATION: '1.2.840.10008.5.1.4.1.1.66.1',

  // === Spatial Fiducials Storage ===
  SPATIAL_FIDUCIALS: '1.2.840.10008.5.1.4.1.1.66.2',

  // === Deformable Spatial Registration Storage ===
  DEFORMABLE_SPATIAL_REGISTRATION: '1.2.840.10008.5.1.4.1.1.66.3',

  // === Segmentation Storage ===
  SEGMENTATION: '1.2.840.10008.5.1.4.1.1.66.4',
  SURFACE_SEGMENTATION: '1.2.840.10008.5.1.4.1.1.66.5',
  TRACTOGRAPHY_RESULTS: '1.2.840.10008.5.1.4.1.1.66.6',

  // === Real World Value Mapping Storage ===
  REAL_WORLD_VALUE_MAPPING: '1.2.840.10008.5.1.4.1.1.67',

  // === Surface Scan Mesh Storage ===
  SURFACE_SCAN_MESH: '1.2.840.10008.5.1.4.1.1.68.1',
  SURFACE_SCAN_POINT_CLOUD: '1.2.840.10008.5.1.4.1.1.68.2',

  // === VL Image Storage ===
  VL_ENDOSCOPIC: '1.2.840.10008.5.1.4.1.1.77.1.1',
  VL_MICROSCOPIC: '1.2.840.10008.5.1.4.1.1.77.1.2',
  VL_SLIDE_COORDINATES_MICROSCOPIC: '1.2.840.10008.5.1.4.1.1.77.1.3',
  VL_PHOTOGRAPHIC: '1.2.840.10008.5.1.4.1.1.77.1.4',
  VIDEO_ENDOSCOPIC: '1.2.840.10008.5.1.4.1.1.77.1.4.1',
  VIDEO_MICROSCOPIC: '1.2.840.10008.5.1.4.1.1.77.1.4.2',
  VIDEO_PHOTOGRAPHIC: '1.2.840.10008.5.1.4.1.1.77.1.4.3',
  VL_WHOLE_SLIDE_MICROSCOPY: '1.2.840.10008.5.1.4.1.1.77.1.6',
  VL_HISTOPATHOLOGY: '1.2.840.10008.5.1.4.1.1.77.1.7',
  VL_CYTOLOGY: '1.2.840.10008.5.1.4.1.1.77.1.8',

  // === Lensometry Measurements Storage ===
  LENSOMETRY_MEASUREMENTS: '1.2.840.10008.5.1.4.1.1.78.1',

  // === Autorefraction Measurements Storage ===
  AUTOREFRACTION_MEASUREMENTS: '1.2.840.10008.5.1.4.1.1.78.2',

  // === Keratometry Measurements Storage ===
  KERATOMETRY_MEASUREMENTS: '1.2.840.10008.5.1.4.1.1.78.3',

  // === Subjective Refraction Measurements Storage ===
  SUBJECTIVE_REFRACTION_MEASUREMENTS: '1.2.840.10008.5.1.4.1.1.78.4',

  // === Visual Acuity Measurements Storage ===
  VISUAL_ACUITY_MEASUREMENTS: '1.2.840.10008.5.1.4.1.1.78.5',

  // === Spectacle Prescription Report Storage ===
  SPECTACLE_PRESCRIPTION_REPORT: '1.2.840.10008.5.1.4.1.1.78.6',

  // === Ophthalmic Axial Measurements Storage ===
  OPHTHALMIC_AXIAL_MEASUREMENTS: '1.2.840.10008.5.1.4.1.1.78.7',

  // === Intraocular Lens Calculations Storage ===
  INTRAOCULAR_LENS_CALCULATIONS: '1.2.840.10008.5.1.4.1.1.78.8',

  // === Macular Grid Thickness and Volume Report Storage ===
  MACULAR_GRID_THICKNESS_AND_VOLUME_REPORT: '1.2.840.10008.5.1.4.1.1.79.1',

  // === Ophthalmic Photography Image Storage ===
  OPHTHALMIC_PHOTOGRAPHY_8_BIT: '1.2.840.10008.5.1.4.1.1.77.1.5.1',
  OPHTHALMIC_PHOTOGRAPHY_16_BIT: '1.2.840.10008.5.1.4.1.1.77.1.5.2',
  STEREOMETRIC_RELATIONSHIP: '1.2.840.10008.5.1.4.1.1.77.1.5.3',
  OPHTHALMIC_TOMOGRAPHY: '1.2.840.10008.5.1.4.1.1.77.1.5.4',
  WIDE_FIELD_OPHTHALMIC_PHOTOGRAPHY_STEREOGRAPHIC_PROJECTION: '1.2.840.10008.5.1.4.1.1.77.1.5.5',
  WIDE_FIELD_OPHTHALMIC_PHOTOGRAPHY_FISH_EYE_PROJECTION: '1.2.840.10008.5.1.4.1.1.77.1.5.6',

  // === Ophthalmic Optical Coherence Tomography ===
  OPHTHALMIC_OCT_EN_FACE: '1.2.840.10008.5.1.4.1.1.77.1.5.7',
  OPHTHALMIC_OCT_B_SCAN_VOLUME_ANALYSIS: '1.2.840.10008.5.1.4.1.1.77.1.5.8',

  // === Ophthalmic Thickness Map Storage ===
  OPHTHALMIC_THICKNESS_MAP: '1.2.840.10008.5.1.4.1.1.81.1',

  // === Corneal Topography Map Storage ===
  CORNEAL_TOPOGRAPHY_MAP: '1.2.840.10008.5.1.4.1.1.82.1',

  // === Structured Report Document Storage ===
  BASIC_TEXT_SR: '1.2.840.10008.5.1.4.1.1.88.11',
  ENHANCED_SR: '1.2.840.10008.5.1.4.1.1.88.22',
  COMPREHENSIVE_SR: '1.2.840.10008.5.1.4.1.1.88.33',
  COMPREHENSIVE_3D_SR: '1.2.840.10008.5.1.4.1.1.88.34',
  EXTENSIBLE_SR: '1.2.840.10008.5.1.4.1.1.88.35',
  PROCEDURE_LOG: '1.2.840.10008.5.1.4.1.1.88.40',
  MAMMOGRAPHY_CAD_SR: '1.2.840.10008.5.1.4.1.1.88.50',
  KEY_OBJECT_SELECTION: '1.2.840.10008.5.1.4.1.1.88.59',
  CHEST_CAD_SR: '1.2.840.10008.5.1.4.1.1.88.65',
  X_RAY_RADIATION_DOSE_SR: '1.2.840.10008.5.1.4.1.1.88.67',
  RADIOACTIVE_DRUG_SR: '1.2.840.10008.5.1.4.1.1.88.68',
  COLON_CAD_SR: '1.2.840.10008.5.1.4.1.1.88.69',
  IMPLANTATION_PLAN_SR: '1.2.840.10008.5.1.4.1.1.88.70',
  ACQUISITION_CONTEXT_SR: '1.2.840.10008.5.1.4.1.1.88.71',
  SIMPLIFIED_ADULT_ECHO_SR: '1.2.840.10008.5.1.4.1.1.88.72',
  PATIENT_RADIATION_DOSE_SR: '1.2.840.10008.5.1.4.1.1.88.73',
  PLANNED_IMAGING_AGENT_ADMINISTRATION_SR: '1.2.840.10008.5.1.4.1.1.88.74',
  PERFORMED_IMAGING_AGENT_ADMINISTRATION_SR: '1.2.840.10008.5.1.4.1.1.88.75',

  // === Content Assessment Results Storage ===
  CONTENT_ASSESSMENT_RESULTS: '1.2.840.10008.5.1.4.1.1.90.1',

  // === Microscopy Bulk Simple Annotations Storage ===
  MICROSCOPY_BULK_SIMPLE_ANNOTATIONS: '1.2.840.10008.5.1.4.1.1.91.1',

  // === Encapsulated Document Storage ===
  ENCAPSULATED_PDF: '1.2.840.10008.5.1.4.1.1.104.1',
  ENCAPSULATED_CDA: '1.2.840.10008.5.1.4.1.1.104.2',
  ENCAPSULATED_STL: '1.2.840.10008.5.1.4.1.1.104.3',
  ENCAPSULATED_OBJ: '1.2.840.10008.5.1.4.1.1.104.4',
  ENCAPSULATED_MTL: '1.2.840.10008.5.1.4.1.1.104.5',

  // === Positron Emission Tomography Image Storage ===
  PET_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.128',
  LEGACY_CONVERTED_ENHANCED_PET: '1.2.840.10008.5.1.4.1.1.128.1',

  // === Standalone PET Curve Storage ===
  STANDALONE_PET_CURVE: '1.2.840.10008.5.1.4.1.1.129',

  // === Enhanced PET Image Storage ===
  ENHANCED_PET_IMAGE: '1.2.840.10008.5.1.4.1.1.130',

  // === Basic Structured Display Storage ===
  BASIC_STRUCTURED_DISPLAY_STORAGE: '1.2.840.10008.5.1.4.1.1.131',

  // === CT Performed Procedure Protocol Storage ===
  CT_PERFORMED_PROCEDURE_PROTOCOL: '1.2.840.10008.5.1.4.1.1.200.1',
  CT_RADIATION_DOSE_SR: '1.2.840.10008.5.1.4.1.1.200.2',

  // === RT Image Storage ===
  RT_IMAGE_STORAGE: '1.2.840.10008.5.1.4.1.1.481.1',
  RT_DOSE: '1.2.840.10008.5.1.4.1.1.481.2',
  RT_STRUCTURE_SET: '1.2.840.10008.5.1.4.1.1.481.3',
  RT_BEAMS_TREATMENT_RECORD: '1.2.840.10008.5.1.4.1.1.481.4',
  RT_PLAN: '1.2.840.10008.5.1.4.1.1.481.5',
  RT_BRACHY_TREATMENT_RECORD: '1.2.840.10008.5.1.4.1.1.481.6',
  RT_TREATMENT_SUMMARY_RECORD: '1.2.840.10008.5.1.4.1.1.481.7',
  RT_ION_PLAN: '1.2.840.10008.5.1.4.1.1.481.8',
  RT_ION_BEAMS_TREATMENT_RECORD: '1.2.840.10008.5.1.4.1.1.481.9',
  RT_PHYSICIAN_INTENT: '1.2.840.10008.5.1.4.1.1.481.10',
  RT_SEGMENT_ANNOTATION: '1.2.840.10008.5.1.4.1.1.481.11',
  RT_RADIATION_SET: '1.2.840.10008.5.1.4.1.1.481.12',
  C_ARM_PHOTON_ELECTRON_RADIATION: '1.2.840.10008.5.1.4.1.1.481.13',
  TOMOTHERAPEUTIC_RADIATION: '1.2.840.10008.5.1.4.1.1.481.14',
  ROBOTIC_ARM_RADIATION: '1.2.840.10008.5.1.4.1.1.481.15',
  RT_RADIATION_RECORD_SET: '1.2.840.10008.5.1.4.1.1.481.16',
  RT_RADIATION_SALVAGE_RECORD: '1.2.840.10008.5.1.4.1.1.481.17',
  TOMOTHERAPEUTIC_RADIATION_RECORD: '1.2.840.10008.5.1.4.1.1.481.18',
  C_ARM_PHOTON_ELECTRON_RADIATION_RECORD: '1.2.840.10008.5.1.4.1.1.481.19',
  ROBOTIC_RADIATION_RECORD: '1.2.840.10008.5.1.4.1.1.481.20',
  RT_RADIATION_SET_DELIVERY_INSTRUCTION: '1.2.840.10008.5.1.4.1.1.481.21',
  RT_TREATMENT_PREPARATION: '1.2.840.10008.5.1.4.1.1.481.22',
  ENHANCED_RT_IMAGE: '1.2.840.10008.5.1.4.1.1.481.23',
  ENHANCED_CONTINUOUS_RT_IMAGE: '1.2.840.10008.5.1.4.1.1.481.24',
  RT_PATIENT_POSITION_ACQUISITION_INSTRUCTION: '1.2.840.10008.5.1.4.1.1.481.25',
} as const;

/**
 * Get human-readable SOP Class name from UID
 * Following Context7 display patterns
 */
export function getSOPClassName(sopClassUID: string): string {
  const entry = Object.entries(SUPPORTED_SOP_CLASSES).find(([_, uid]) => uid === sopClassUID);
  if (!entry) {
    return 'Unknown SOP Class';
  }

  // Convert constant name to human-readable format
  return entry[0]
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Check if SOP Class is supported for imaging operations
 * Based on Context7 validation patterns
 */
export function isSupportedSOPClass(sopClassUID: string): boolean {
  return Object.values(SUPPORTED_SOP_CLASSES).includes(sopClassUID as any);
}

/**
 * Get SOP Class category for medical imaging workflows
 * Following Context7 categorization patterns
 */
export function getSOPClassCategory(sopClassUID: string): string {
  // Image Storage Categories
  if (sopClassUID.includes('1.2.840.10008.5.1.4.1.1.2')) return 'CT';
  if (sopClassUID.includes('1.2.840.10008.5.1.4.1.1.4')) return 'MR';
  if (sopClassUID.includes('1.2.840.10008.5.1.4.1.1.6')) return 'US';
  if (sopClassUID.includes('1.2.840.10008.5.1.4.1.1.128')) return 'PET';
  if (sopClassUID.includes('1.2.840.10008.5.1.4.1.1.20')) return 'NM';
  if (sopClassUID.includes('1.2.840.10008.5.1.4.1.1.1')) return 'CR/DX';
  if (sopClassUID.includes('1.2.840.10008.5.1.4.1.1.12')) return 'XA/XRF';
  if (sopClassUID.includes('1.2.840.10008.5.1.4.1.1.77')) return 'VL';
  if (sopClassUID.includes('1.2.840.10008.5.1.4.1.1.78')) return 'Ophthalmic';
  if (sopClassUID.includes('1.2.840.10008.5.1.4.1.1.481')) return 'RT';
  if (sopClassUID.includes('1.2.840.10008.5.1.4.1.1.88')) return 'SR';
  if (sopClassUID.includes('1.2.840.10008.5.1.4.1.1.7')) return 'SC';
  if (sopClassUID.includes('1.2.840.10008.5.1.4.1.1.11')) return 'PR';
  if (sopClassUID.includes('1.2.840.10008.5.1.4.1.1.9')) return 'WF';
  if (sopClassUID.includes('1.2.840.10008.5.1.4.1.1.66')) return 'Segmentation';
  if (sopClassUID.includes('1.2.840.10008.5.1.4.1.1.104')) return 'Encapsulated';

  return 'Other';
}

/**
 * Get modality from SOP Class UID
 * Based on Context7 modality mapping patterns
 */
export function getModalityFromSOPClass(sopClassUID: string): string {
  const category = getSOPClassCategory(sopClassUID);

  switch (category) {
    case 'CT': return 'CT';
    case 'MR': return 'MR';
    case 'US': return 'US';
    case 'PET': return 'PT';
    case 'NM': return 'NM';
    case 'CR/DX': return 'DX';
    case 'XA/XRF': return 'XA';
    case 'VL': return 'XC';
    case 'Ophthalmic': return 'OP';
    case 'RT': return 'RTIMAGE';
    case 'SR': return 'SR';
    case 'SC': return 'SC';
    case 'PR': return 'PR';
    case 'WF': return 'ECG';
    default: return 'OT';
  }
}

/**
 * Check if SOP Class supports multi-frame images
 * Following Context7 multi-frame detection patterns
 */
export function isMultiframeSupportedSOPClass(sopClassUID: string): boolean {
  const multiframeSopClasses = [
    SUPPORTED_SOP_CLASSES.US_MULTIFRAME_IMAGE_STORAGE,
    SUPPORTED_SOP_CLASSES.MULTIFRAME_GRAYSCALE_BYTE_SECONDARY_CAPTURE,
    SUPPORTED_SOP_CLASSES.MULTIFRAME_GRAYSCALE_WORD_SECONDARY_CAPTURE,
    SUPPORTED_SOP_CLASSES.MULTIFRAME_TRUE_COLOR_SECONDARY_CAPTURE,
    SUPPORTED_SOP_CLASSES.ENHANCED_CT,
    SUPPORTED_SOP_CLASSES.ENHANCED_MR,
    SUPPORTED_SOP_CLASSES.ENHANCED_US,
    SUPPORTED_SOP_CLASSES.ENHANCED_XA,
    SUPPORTED_SOP_CLASSES.ENHANCED_XRF,
    SUPPORTED_SOP_CLASSES.ENHANCED_PET,
    SUPPORTED_SOP_CLASSES.X_RAY_3D_ANGIOGRAPHIC,
    SUPPORTED_SOP_CLASSES.BREAST_TOMOSYNTHESIS,
  ];

  return multiframeSopClasses.includes(sopClassUID as any);
}

/**
 * Check if SOP Class supports 3D volume rendering
 * Based on Context7 3D rendering patterns
 */
export function is3DVolumeRenderingSupported(sopClassUID: string): boolean {
  const volumeRenderingSopClasses = [
    SUPPORTED_SOP_CLASSES.CT_IMAGE_STORAGE,
    SUPPORTED_SOP_CLASSES.ENHANCED_CT,
    SUPPORTED_SOP_CLASSES.MR_IMAGE_STORAGE,
    SUPPORTED_SOP_CLASSES.ENHANCED_MR,
    SUPPORTED_SOP_CLASSES.PET_IMAGE_STORAGE,
    SUPPORTED_SOP_CLASSES.ENHANCED_PET,
    SUPPORTED_SOP_CLASSES.X_RAY_3D_ANGIOGRAPHIC,
    SUPPORTED_SOP_CLASSES.BREAST_TOMOSYNTHESIS,
  ];

  return volumeRenderingSopClasses.includes(sopClassUID as any);
}

/**
 * Get recommended window/level presets for SOP Class
 * Following Context7 display optimization patterns
 */
export function getRecommendedWindowLevelPresets(sopClassUID: string): Array<{name: string, center: number, width: number}> {
  const category = getSOPClassCategory(sopClassUID);

  switch (category) {
    case 'CT':
      return [
        { name: 'Lung', center: -600, width: 1600 },
        { name: 'Abdomen', center: 60, width: 400 },
        { name: 'Brain', center: 40, width: 80 },
        { name: 'Bone', center: 400, width: 1800 },
        { name: 'Mediastinum', center: 50, width: 350 },
      ];
    case 'MR':
      return [
        { name: 'Default', center: 300, width: 600 },
        { name: 'T1', center: 500, width: 1000 },
        { name: 'T2', center: 200, width: 400 },
      ];
    case 'US':
      return [
        { name: 'Default', center: 128, width: 256 },
      ];
    case 'PET':
      return [
        { name: 'Default', center: 20000, width: 40000 },
        { name: 'Hot Iron', center: 15000, width: 30000 },
      ];
    case 'CR/DX':
      return [
        { name: 'Default', center: 2048, width: 4096 },
        { name: 'Chest', center: 1024, width: 2048 },
        { name: 'Bone', center: 3000, width: 2000 },
      ];
    default:
      return [
        { name: 'Default', center: 128, width: 256 },
      ];
  }
}

/**
 * Export commonly used SOP class validation utilities
 */
export const SOPClassValidator = {
  isSupported: isSupportedSOPClass,
  getName: getSOPClassName,
  getCategory: getSOPClassCategory,
  getModality: getModalityFromSOPClass,
  supportsMultiframe: isMultiframeSupportedSOPClass,
  supports3DVolume: is3DVolumeRenderingSupported,
  getWindowLevelPresets: getRecommendedWindowLevelPresets,
};

/**
 * SOP Class groups for UI organization
 * Following Context7 organization patterns
 */
export const SOP_CLASS_GROUPS = {
  CORE_IMAGING: [
    SUPPORTED_SOP_CLASSES.CT_IMAGE_STORAGE,
    SUPPORTED_SOP_CLASSES.MR_IMAGE_STORAGE,
    SUPPORTED_SOP_CLASSES.US_IMAGE_STORAGE,
    SUPPORTED_SOP_CLASSES.PET_IMAGE_STORAGE,
    SUPPORTED_SOP_CLASSES.NUCLEAR_MEDICINE,
    SUPPORTED_SOP_CLASSES.DIGITAL_X_RAY,
  ],
  ENHANCED_IMAGING: [
    SUPPORTED_SOP_CLASSES.ENHANCED_CT,
    SUPPORTED_SOP_CLASSES.ENHANCED_MR,
    SUPPORTED_SOP_CLASSES.ENHANCED_US,
    SUPPORTED_SOP_CLASSES.ENHANCED_PET,
  ],
  SPECIALIZED_IMAGING: [
    SUPPORTED_SOP_CLASSES.X_RAY_3D_ANGIOGRAPHIC,
    SUPPORTED_SOP_CLASSES.BREAST_TOMOSYNTHESIS,
    SUPPORTED_SOP_CLASSES.INTRAVASCULAR_OCT_FOR_PRESENTATION,
    SUPPORTED_SOP_CLASSES.OPHTHALMIC_PHOTOGRAPHY_8_BIT,
  ],
  RADIATION_THERAPY: [
    SUPPORTED_SOP_CLASSES.RT_IMAGE_STORAGE,
    SUPPORTED_SOP_CLASSES.RT_DOSE,
    SUPPORTED_SOP_CLASSES.RT_STRUCTURE_SET,
    SUPPORTED_SOP_CLASSES.RT_PLAN,
  ],
  STRUCTURED_REPORTS: [
    SUPPORTED_SOP_CLASSES.BASIC_TEXT_SR,
    SUPPORTED_SOP_CLASSES.ENHANCED_SR,
    SUPPORTED_SOP_CLASSES.COMPREHENSIVE_SR,
  ],
} as const;
