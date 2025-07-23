/* eslint-disable security/detect-object-injection */
// NOTE: DICOM SOP class handling requires dynamic object access for metadata processing
/**
 * SOP Class Utilities
 *
 * Convenience functions for working with DICOM SOP classes
 * Based on Context7 documentation patterns from /cornerstonejs/cornerstone3d
 * Reference: 443 code examples for SOP class utility functions
 */

import { advancedDicomLoader } from '../services/advancedDicomLoader';
import { SOPClassConfig } from '../services/sopClassHandler';
import { SUPPORTED_SOP_CLASSES } from '../utils/sopClasses';

/**
 * Common SOP class configuration presets
 * Following Context7 configuration preset patterns
 */
export const SOPClassPresets = {
  /**
   * Basic medical imaging (CT, MR, US, CR, DX)
   */
  BASIC_MEDICAL_IMAGING: {
    name: 'Basic Medical Imaging',
    enabledCategories: ['Core Imaging'],
    sopClasses: [
      SUPPORTED_SOP_CLASSES.CT_IMAGE_STORAGE,
      SUPPORTED_SOP_CLASSES.MR_IMAGE_STORAGE,
      SUPPORTED_SOP_CLASSES.US_IMAGE_STORAGE,
      SUPPORTED_SOP_CLASSES.DIGITAL_X_RAY,
      SUPPORTED_SOP_CLASSES.COMPUTED_RADIOGRAPHY,
    ],
  },

  /**
   * Advanced medical imaging with enhanced modalities
   */
  ADVANCED_MEDICAL_IMAGING: {
    name: 'Advanced Medical Imaging',
    enabledCategories: ['Core Imaging', 'Enhanced Imaging'],
    sopClasses: [
      SUPPORTED_SOP_CLASSES.CT_IMAGE_STORAGE,
      SUPPORTED_SOP_CLASSES.ENHANCED_CT,
      SUPPORTED_SOP_CLASSES.MR_IMAGE_STORAGE,
      SUPPORTED_SOP_CLASSES.ENHANCED_MR,
      SUPPORTED_SOP_CLASSES.US_IMAGE_STORAGE,
      SUPPORTED_SOP_CLASSES.ENHANCED_US,
      SUPPORTED_SOP_CLASSES.PET_IMAGE_STORAGE,
      SUPPORTED_SOP_CLASSES.ENHANCED_PET,
    ],
  },

  /**
   * Oncology imaging with radiation therapy
   */
  ONCOLOGY_IMAGING: {
    name: 'Oncology Imaging',
    enabledCategories: ['Core Imaging', 'Enhanced Imaging', 'Radiation Therapy'],
    sopClasses: [
      SUPPORTED_SOP_CLASSES.CT_IMAGE_STORAGE,
      SUPPORTED_SOP_CLASSES.ENHANCED_CT,
      SUPPORTED_SOP_CLASSES.MR_IMAGE_STORAGE,
      SUPPORTED_SOP_CLASSES.ENHANCED_MR,
      SUPPORTED_SOP_CLASSES.PET_IMAGE_STORAGE,
      SUPPORTED_SOP_CLASSES.RT_IMAGE_STORAGE,
      SUPPORTED_SOP_CLASSES.RT_DOSE,
      SUPPORTED_SOP_CLASSES.RT_STRUCTURE_SET,
      SUPPORTED_SOP_CLASSES.RT_PLAN,
    ],
  },

  /**
   * Cardiology imaging
   */
  CARDIOLOGY_IMAGING: {
    name: 'Cardiology Imaging',
    enabledCategories: ['Core Imaging', 'Specialized Imaging'],
    sopClasses: [
      SUPPORTED_SOP_CLASSES.CT_IMAGE_STORAGE,
      SUPPORTED_SOP_CLASSES.ENHANCED_CT,
      SUPPORTED_SOP_CLASSES.MR_IMAGE_STORAGE,
      SUPPORTED_SOP_CLASSES.ENHANCED_MR,
      SUPPORTED_SOP_CLASSES.US_IMAGE_STORAGE,
      SUPPORTED_SOP_CLASSES.ENHANCED_US,
      SUPPORTED_SOP_CLASSES.X_RAY_ANGIOGRAPHIC,
      SUPPORTED_SOP_CLASSES.ENHANCED_XA,
      SUPPORTED_SOP_CLASSES.X_RAY_3D_ANGIOGRAPHIC,
      SUPPORTED_SOP_CLASSES.TWELVE_LEAD_ECG,
      SUPPORTED_SOP_CLASSES.GENERAL_ECG,
    ],
  },

  /**
   * Ophthalmology imaging
   */
  OPHTHALMOLOGY_IMAGING: {
    name: 'Ophthalmology Imaging',
    sopClasses: [
      SUPPORTED_SOP_CLASSES.OPHTHALMIC_PHOTOGRAPHY_8_BIT,
      SUPPORTED_SOP_CLASSES.OPHTHALMIC_PHOTOGRAPHY_16_BIT,
      SUPPORTED_SOP_CLASSES.OPHTHALMIC_TOMOGRAPHY,
      SUPPORTED_SOP_CLASSES.OPHTHALMIC_OCT_EN_FACE,
      SUPPORTED_SOP_CLASSES.OPHTHALMIC_OCT_B_SCAN_VOLUME_ANALYSIS,
      SUPPORTED_SOP_CLASSES.OPHTHALMIC_THICKNESS_MAP,
      SUPPORTED_SOP_CLASSES.CORNEAL_TOPOGRAPHY_MAP,
    ],
  },

  /**
   * Research and development (all SOP classes)
   */
  RESEARCH_ALL: {
    name: 'Research (All SOP Classes)',
    enabledCategories: ['Core Imaging', 'Enhanced Imaging', 'Specialized Imaging', 'Radiation Therapy', 'Structured Reports'],
    sopClasses: Object.values(SUPPORTED_SOP_CLASSES),
  },
};

/**
 * Apply SOP class preset configuration
 * Following Context7 preset application patterns
 */
export function applySOPClassPreset(presetName: keyof typeof SOPClassPresets): void {
  const preset = SOPClassPresets[presetName];

  console.log(`🏥 Applying SOP class preset: ${preset.name}`);

  // First disable all SOP classes
  advancedDicomLoader.configure({
    sopClassConfig: {
      enableAll: false,
    },
  });

  // Enable categories if specified
  if ('enabledCategories' in preset && preset.enabledCategories) {
    preset.enabledCategories.forEach((category: string) => {
      console.log(`✅ Enabling SOP class category: ${category}`);
    });

    advancedDicomLoader.configure({
      sopClassConfig: {
        enabledCategories: preset.enabledCategories,
      },
    });
  }

  // Enable specific SOP classes
  preset.sopClasses.forEach(sopClassUID => {
    try {
      advancedDicomLoader.configureSOPClass(sopClassUID, { enabled: true });
    } catch (error) {
      console.warn(`⚠️ Failed to enable SOP class ${sopClassUID}:`, error);
    }
  });

  console.log(`✅ SOP class preset applied: ${preset.name} (${preset.sopClasses.length} SOP classes)`);
}

/**
 * Get supported modalities and their SOP classes
 * Following Context7 modality listing patterns
 */
export function getSupportedModalities(): Record<string, {
  name: string;
  sopClasses: string[];
  supports3D: boolean;
  supportsMeasurements: boolean;
  description: string;
}> {
  return {
    CT: {
      name: 'Computed Tomography',
      sopClasses: [
        SUPPORTED_SOP_CLASSES.CT_IMAGE_STORAGE,
        SUPPORTED_SOP_CLASSES.ENHANCED_CT,
        SUPPORTED_SOP_CLASSES.LEGACY_CONVERTED_ENHANCED_CT,
      ],
      supports3D: true,
      supportsMeasurements: true,
      description: 'Cross-sectional medical imaging using X-rays',
    },
    MR: {
      name: 'Magnetic Resonance',
      sopClasses: [
        SUPPORTED_SOP_CLASSES.MR_IMAGE_STORAGE,
        SUPPORTED_SOP_CLASSES.ENHANCED_MR,
        SUPPORTED_SOP_CLASSES.ENHANCED_MR_COLOR,
        SUPPORTED_SOP_CLASSES.LEGACY_CONVERTED_ENHANCED_MR,
        SUPPORTED_SOP_CLASSES.MR_SPECTROSCOPY,
      ],
      supports3D: true,
      supportsMeasurements: true,
      description: 'Medical imaging using magnetic fields and radio waves',
    },
    US: {
      name: 'Ultrasound',
      sopClasses: [
        SUPPORTED_SOP_CLASSES.US_IMAGE_STORAGE,
        SUPPORTED_SOP_CLASSES.ENHANCED_US,
        SUPPORTED_SOP_CLASSES.US_MULTIFRAME_IMAGE_STORAGE,
      ],
      supports3D: false,
      supportsMeasurements: true,
      description: 'Medical imaging using high-frequency sound waves',
    },
    DX: {
      name: 'Digital Radiography',
      sopClasses: [
        SUPPORTED_SOP_CLASSES.DIGITAL_X_RAY,
        SUPPORTED_SOP_CLASSES.DIGITAL_X_RAY_FOR_PRESENTATION,
        SUPPORTED_SOP_CLASSES.DIGITAL_X_RAY_FOR_PROCESSING,
        SUPPORTED_SOP_CLASSES.COMPUTED_RADIOGRAPHY,
      ],
      supports3D: false,
      supportsMeasurements: true,
      description: 'Digital X-ray imaging',
    },
    PT: {
      name: 'Positron Emission Tomography',
      sopClasses: [
        SUPPORTED_SOP_CLASSES.PET_IMAGE_STORAGE,
        SUPPORTED_SOP_CLASSES.ENHANCED_PET,
        SUPPORTED_SOP_CLASSES.LEGACY_CONVERTED_ENHANCED_PET,
      ],
      supports3D: true,
      supportsMeasurements: true,
      description: 'Nuclear imaging technique for metabolic processes',
    },
    NM: {
      name: 'Nuclear Medicine',
      sopClasses: [
        SUPPORTED_SOP_CLASSES.NUCLEAR_MEDICINE,
        SUPPORTED_SOP_CLASSES.NM_IMAGE_STORAGE,
      ],
      supports3D: true,
      supportsMeasurements: true,
      description: 'Medical imaging using radioactive tracers',
    },
    XA: {
      name: 'X-Ray Angiography',
      sopClasses: [
        SUPPORTED_SOP_CLASSES.X_RAY_ANGIOGRAPHIC,
        SUPPORTED_SOP_CLASSES.ENHANCED_XA,
        SUPPORTED_SOP_CLASSES.X_RAY_3D_ANGIOGRAPHIC,
      ],
      supports3D: true,
      supportsMeasurements: true,
      description: 'X-ray imaging of blood vessels',
    },
    RF: {
      name: 'Radiofluoroscopy',
      sopClasses: [
        SUPPORTED_SOP_CLASSES.X_RAY_RADIOFLUOROSCOPIC,
        SUPPORTED_SOP_CLASSES.ENHANCED_XRF,
      ],
      supports3D: false,
      supportsMeasurements: true,
      description: 'Real-time X-ray imaging',
    },
    RTIMAGE: {
      name: 'Radiation Therapy Imaging',
      sopClasses: [
        SUPPORTED_SOP_CLASSES.RT_IMAGE_STORAGE,
        SUPPORTED_SOP_CLASSES.ENHANCED_RT_IMAGE,
        SUPPORTED_SOP_CLASSES.ENHANCED_CONTINUOUS_RT_IMAGE,
      ],
      supports3D: false,
      supportsMeasurements: true,
      description: 'Imaging for radiation therapy planning and verification',
    },
    OP: {
      name: 'Ophthalmic Photography',
      sopClasses: [
        SUPPORTED_SOP_CLASSES.OPHTHALMIC_PHOTOGRAPHY_8_BIT,
        SUPPORTED_SOP_CLASSES.OPHTHALMIC_PHOTOGRAPHY_16_BIT,
        SUPPORTED_SOP_CLASSES.OPHTHALMIC_TOMOGRAPHY,
        SUPPORTED_SOP_CLASSES.OPHTHALMIC_OCT_EN_FACE,
      ],
      supports3D: false,
      supportsMeasurements: true,
      description: 'Specialized imaging for ophthalmology',
    },
  };
}

/**
 * Validate SOP class configuration for clinical use
 * Following Context7 clinical validation patterns
 */
export function validateClinicalSOPClassConfiguration(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
  } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Get current SOP class configuration
  const enabledSOPClasses = advancedDicomLoader.listSupportedSOPClasses({ enabled: true });
  const coreImagingEnabled = enabledSOPClasses.filter(config => config.category === 'Core Imaging');

  // Check for minimum required modalities
  const enabledModalities = new Set(enabledSOPClasses.map(config => config.modality));

  if (enabledModalities.size === 0) {
    errors.push('No SOP classes are enabled');
    recommendations.push('Enable at least basic medical imaging SOP classes');
  }

  if (coreImagingEnabled.length === 0) {
    errors.push('No core imaging SOP classes are enabled');
    recommendations.push('Enable core imaging modalities (CT, MR, US, DX)');
  }

  // Check for essential modalities in clinical environment
  const essentialModalities = ['CT', 'MR', 'DX'];
  const missingEssential = essentialModalities.filter(modality => !enabledModalities.has(modality));

  if (missingEssential.length > 0) {
    warnings.push(`Missing essential modalities: ${missingEssential.join(', ')}`);
    recommendations.push('Consider enabling missing essential modalities for comprehensive clinical support');
  }

  // Check for measurement support
  const measurementCapableSOPClasses = enabledSOPClasses.filter(config =>
    config.renderingOptions.measurements,
  );

  if (measurementCapableSOPClasses.length === 0) {
    warnings.push('No measurement-capable SOP classes are enabled');
    recommendations.push('Enable SOP classes that support measurements for clinical workflow');
  }

  // Check for 3D volume rendering support
  const volume3DCapableSOPClasses = enabledSOPClasses.filter(config =>
    config.renderingOptions.volume3D,
  );

  if (volume3DCapableSOPClasses.length === 0) {
    warnings.push('No 3D volume rendering capable SOP classes are enabled');
    recommendations.push('Enable SOP classes that support 3D volume rendering for advanced visualization');
  }

  // Generate summary recommendations
  if (errors.length === 0 && warnings.length === 0) {
    recommendations.push('SOP class configuration is suitable for clinical use');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    recommendations,
  };
}

/**
 * Generate SOP class configuration report
 * Following Context7 reporting patterns
 */
export function generateSOPClassConfigurationReport(): string {
  const enabledSOPClasses = advancedDicomLoader.listSupportedSOPClasses({ enabled: true });
  const disabledSOPClasses = advancedDicomLoader.listSupportedSOPClasses({ enabled: false });
  const stats = advancedDicomLoader.getLoadingStats().sopClassStats;

  const modalityGroups = enabledSOPClasses.reduce((groups, config) => {
    if (!groups[config.modality]) {
      groups[config.modality] = [];
    }
    groups[config.modality].push(config);
    return groups;
  }, {} as Record<string, SOPClassConfig[]>);

  const categoryGroups = enabledSOPClasses.reduce((groups, config) => {
    if (!groups[config.category]) {
      groups[config.category] = [];
    }
    groups[config.category].push(config);
    return groups;
  }, {} as Record<string, SOPClassConfig[]>);

  return `
SOP Class Configuration Report
===============================

Statistics:
-----------
• Total SOP Classes: ${stats.totalSOPClasses}
• Enabled SOP Classes: ${stats.enabledSOPClasses}
• Disabled SOP Classes: ${disabledSOPClasses.length}
• Configuration Coverage: ${stats.configurationCoverage.toFixed(1)}%
• Processed Images: ${stats._processedImages}
• Unsupported Encountered: ${stats.unsupportedEncountered}
• Error Count: ${stats.errorCount}

Enabled by Modality:
-------------------
${Object.entries(modalityGroups).map(([modality, configs]) =>
    `• ${modality}: ${configs.length} SOP classes\n  ${configs.map(c => `- ${c.name}`).join('\n  ')}`,
  ).join('\n')}

Enabled by Category:
-------------------
${Object.entries(categoryGroups).map(([category, configs]) =>
    `• ${category}: ${configs.length} SOP classes`,
  ).join('\n')}

Capabilities:
-------------
• 3D Volume Rendering: ${enabledSOPClasses.filter(c => c.renderingOptions.volume3D).length} SOP classes
• Measurements Support: ${enabledSOPClasses.filter(c => c.renderingOptions.measurements).length} SOP classes
• Multi-frame Support: ${enabledSOPClasses.filter(c => c.renderingOptions.multiframe).length} SOP classes

Clinical Validation:
-------------------
${(() => {
    const validation = validateClinicalSOPClassConfiguration();
    let result = `• Valid for Clinical Use: ${validation.isValid ? 'Yes' : 'No'}\n`;
    if (validation.errors.length > 0) {
      result += `• Errors: ${validation.errors.length}\n  ${validation.errors.map(e => `- ${e}`).join('\n  ')}\n`;
    }
    if (validation.warnings.length > 0) {
      result += `• Warnings: ${validation.warnings.length}\n  ${validation.warnings.map(w => `- ${w}`).join('\n  ')}\n`;
    }
    return result;
  })()}

Recommendations:
---------------
${validateClinicalSOPClassConfiguration().recommendations.map(r => `• ${r}`).join('\n')}

Generated: ${new Date().toISOString()}
===============================
  `.trim();
}

/**
 * Quick setup functions for common scenarios
 * Following Context7 quick setup patterns
 */
export const QuickSetup = {
  /**
   * Setup for general radiology department
   */
  radiologyDepartment: () => {
    applySOPClassPreset('ADVANCED_MEDICAL_IMAGING');
    console.log('🏥 Quick setup completed: Radiology Department');
  },

  /**
   * Setup for oncology department
   */
  oncologyDepartment: () => {
    applySOPClassPreset('ONCOLOGY_IMAGING');
    console.log('🏥 Quick setup completed: Oncology Department');
  },

  /**
   * Setup for cardiology department
   */
  cardiologyDepartment: () => {
    applySOPClassPreset('CARDIOLOGY_IMAGING');
    console.log('🏥 Quick setup completed: Cardiology Department');
  },

  /**
   * Setup for ophthalmology department
   */
  ophthalmologyDepartment: () => {
    applySOPClassPreset('OPHTHALMOLOGY_IMAGING');
    console.log('🏥 Quick setup completed: Ophthalmology Department');
  },

  /**
   * Setup for research environment
   */
  researchEnvironment: () => {
    applySOPClassPreset('RESEARCH_ALL');
    console.log('🏥 Quick setup completed: Research Environment');
  },

  /**
   * Minimal setup for basic viewing
   */
  basicViewing: () => {
    applySOPClassPreset('BASIC_MEDICAL_IMAGING');
    console.log('🏥 Quick setup completed: Basic Viewing');
  },
};

/**
 * SOP class compatibility checker for workflow requirements
 * Following Context7 compatibility checking patterns
 */
export function checkWorkflowCompatibility(
  sopClassUIDs: string[],
  workflow: 'measurement' | 'volume_rendering' | 'comparison' | 'reporting' | 'teaching',
): {
  compatible: string[];
  incompatible: string[];
  issues: Record<string, string[]>;
  recommendations: string[];
} {
  const compatible: string[] = [];
  const incompatible: string[] = [];
  const issues: Record<string, string[]> = {};
  const recommendations: string[] = [];

  sopClassUIDs.forEach(sopClassUID => {
    const sopClassInfo = advancedDicomLoader.getSOPClassInfo(sopClassUID);

    if (!sopClassInfo) {
      incompatible.push(sopClassUID);
      issues[sopClassUID] = ['SOP class not supported'];
      return;
    }

    const sopClassIssues: string[] = [];
    let isCompatible = true;

    switch (workflow) {
      case 'measurement':
        if (!sopClassInfo.renderingOptions.measurements) {
          sopClassIssues.push('Does not support measurements');
          isCompatible = false;
        }
        break;

      case 'volume_rendering':
        if (!sopClassInfo.renderingOptions.volume3D) {
          sopClassIssues.push('Does not support 3D volume rendering');
          isCompatible = false;
        }
        break;

      case 'comparison':
        // Most SOP classes support comparison
        break;

      case 'reporting':
        // All imaging SOP classes support reporting
        break;

      case 'teaching':
        // All SOP classes can be used for teaching
        break;
    }

    if (isCompatible) {
      compatible.push(sopClassUID);
    } else {
      incompatible.push(sopClassUID);
      issues[sopClassUID] = sopClassIssues;
    }
  });

  // Generate recommendations
  if (incompatible.length > 0) {
    recommendations.push(`${incompatible.length} SOP classes are not compatible with ${workflow} workflow`);
    recommendations.push('Consider using alternative SOP classes or adjusting workflow requirements');
  }

  if (compatible.length === 0) {
    recommendations.push(`No compatible SOP classes found for ${workflow} workflow`);
    recommendations.push('Review SOP class selection and workflow requirements');
  }

  return {
    compatible,
    incompatible,
    issues,
    recommendations,
  };
}

export type { SOPClassConfig } from '../services/sopClassHandler';
