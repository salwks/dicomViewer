/**
 * SOP Class Handlers for Advanced DICOM Loader
 * Specialized handlers for different DICOM modalities and SOP classes
 */

import { SOPClassHandler, DICOMMetadata, SUPPORTED_SOP_CLASSES } from '../AdvancedDICOMLoader';
import { log } from '../../utils/logger';

// ===== CT Image Handler =====

export class CTImageHandler extends SOPClassHandler {
  canHandle(sopClassUID: string): boolean {
    return [
      SUPPORTED_SOP_CLASSES.CT,
      SUPPORTED_SOP_CLASSES.ENHANCED_CT,
      SUPPORTED_SOP_CLASSES.LEGACY_CT,
    ].includes(sopClassUID as any);
  }

  async preProcess(imageId: string, metadata: DICOMMetadata): Promise<void> {
    log.info('Pre-processing CT image', {
      component: 'CTImageHandler',
      metadata: { imageId, modality: metadata.modality },
    });

    // CT-specific preprocessing
    // Check for required tags
    if (!metadata.pixelSpacing || !metadata.sliceThickness) {
      log.warn('CT image missing spatial information', {
        component: 'CTImageHandler',
        metadata: { imageId },
      });
    }
  }

  async postProcess(_imageId: string, image: any): Promise<any> {
    // Apply CT-specific post-processing
    // e.g., Hounsfield unit conversion if needed
    return image;
  }

  getDefaultWindowLevel(metadata: DICOMMetadata): { window: number; level: number } | null {
    // Common CT presets
    const modality = metadata.modality?.toUpperCase();
    if (modality !== 'CT') return null;

    // Check if window values are provided in metadata
    if (metadata.windowWidth && metadata.windowCenter) {
      const width = Array.isArray(metadata.windowWidth) ? metadata.windowWidth[0] : metadata.windowWidth;
      const center = Array.isArray(metadata.windowCenter) ? metadata.windowCenter[0] : metadata.windowCenter;
      return { window: width, level: center };
    }

    // Default CT window/level presets
    return { window: 1500, level: -600 }; // Lung preset
  }
}

// ===== MR Image Handler =====

export class MRImageHandler extends SOPClassHandler {
  canHandle(sopClassUID: string): boolean {
    return [
      SUPPORTED_SOP_CLASSES.MR,
      SUPPORTED_SOP_CLASSES.ENHANCED_MR,
      SUPPORTED_SOP_CLASSES.MR_SPECTROSCOPY,
      SUPPORTED_SOP_CLASSES.ENHANCED_MR_COLOR,
      SUPPORTED_SOP_CLASSES.LEGACY_MR,
    ].includes(sopClassUID as any);
  }

  async preProcess(imageId: string, metadata: DICOMMetadata): Promise<void> {
    log.info('Pre-processing MR image', {
      component: 'MRImageHandler',
      metadata: { imageId, modality: metadata.modality },
    });

    // MR-specific preprocessing
    // Check for sequence-specific parameters
  }

  async postProcess(_imageId: string, image: any): Promise<any> {
    // Apply MR-specific post-processing
    // e.g., intensity normalization
    return image;
  }

  getDefaultWindowLevel(metadata: DICOMMetadata): { window: number; level: number } | null {
    // MR images typically use full dynamic range
    if (metadata.windowWidth && metadata.windowCenter) {
      const width = Array.isArray(metadata.windowWidth) ? metadata.windowWidth[0] : metadata.windowWidth;
      const center = Array.isArray(metadata.windowCenter) ? metadata.windowCenter[0] : metadata.windowCenter;
      return { window: width, level: center };
    }

    // Default MR window/level
    return { window: 1000, level: 500 };
  }
}

// ===== PET Image Handler =====

export class PETImageHandler extends SOPClassHandler {
  canHandle(sopClassUID: string): boolean {
    return [
      SUPPORTED_SOP_CLASSES.PET,
      SUPPORTED_SOP_CLASSES.ENHANCED_PET,
      SUPPORTED_SOP_CLASSES.LEGACY_PET,
    ].includes(sopClassUID as any);
  }

  async preProcess(_imageId: string, _metadata: DICOMMetadata): Promise<void> {
    log.info('Pre-processing PET image', {
      component: 'PETImageHandler',
      metadata: { imageId: _imageId, modality: _metadata.modality },
    });

    // PET-specific preprocessing
    // Check for SUV calculation parameters
  }

  async postProcess(_imageId: string, image: any): Promise<any> {
    // Apply PET-specific post-processing
    // e.g., SUV calculation
    return image;
  }

  getDefaultWindowLevel(_metadata: DICOMMetadata): { window: number; level: number } | null {
    // PET typically uses specific window/level for SUV
    return { window: 10, level: 5 };
  }
}

// ===== Ultrasound Handler =====

export class UltrasoundHandler extends SOPClassHandler {
  canHandle(sopClassUID: string): boolean {
    return [
      SUPPORTED_SOP_CLASSES.US,
      SUPPORTED_SOP_CLASSES.US_MULTIFRAME,
      SUPPORTED_SOP_CLASSES.ENHANCED_US,
    ].includes(sopClassUID as any);
  }

  async preProcess(_imageId: string, _metadata: DICOMMetadata): Promise<void> {
    log.info('Pre-processing Ultrasound image', {
      component: 'UltrasoundHandler',
      metadata: { imageId: _imageId, modality: _metadata.modality },
    });

    // US-specific preprocessing
    // Handle color/doppler information
  }

  async postProcess(_imageId: string, image: any): Promise<any> {
    // Apply US-specific post-processing
    return image;
  }

  getDefaultWindowLevel(_metadata: DICOMMetadata): { window: number; level: number } | null {
    // Ultrasound typically uses full range
    return { window: 255, level: 127 };
  }
}

// ===== Digital X-Ray Handler =====

export class DigitalXRayHandler extends SOPClassHandler {
  canHandle(sopClassUID: string): boolean {
    return [
      SUPPORTED_SOP_CLASSES.CR,
      SUPPORTED_SOP_CLASSES.DX,
      SUPPORTED_SOP_CLASSES.MG,
      SUPPORTED_SOP_CLASSES.IO,
    ].includes(sopClassUID as any);
  }

  async preProcess(imageId: string, metadata: DICOMMetadata): Promise<void> {
    log.info('Pre-processing Digital X-Ray image', {
      component: 'DigitalXRayHandler',
      metadata: { imageId, modality: metadata.modality },
    });

    // X-Ray specific preprocessing
    // Handle presentation state if available
  }

  async postProcess(_imageId: string, image: any): Promise<any> {
    // Apply X-Ray specific post-processing
    // e.g., edge enhancement for better visualization
    return image;
  }

  getDefaultWindowLevel(metadata: DICOMMetadata): { window: number; level: number } | null {
    // X-Ray window/level depends on body part
    const modality = metadata.modality?.toUpperCase();

    // Mammography has specific requirements
    if (modality === 'MG') {
      return { window: 4095, level: 2047 };
    }

    // General X-Ray defaults
    return { window: 2048, level: 1024 };
  }
}

// ===== RT (Radiotherapy) Handler =====

export class RTHandler extends SOPClassHandler {
  canHandle(sopClassUID: string): boolean {
    return [
      SUPPORTED_SOP_CLASSES.RT_IMAGE,
      SUPPORTED_SOP_CLASSES.RT_DOSE,
      SUPPORTED_SOP_CLASSES.RT_STRUCTURE,
      SUPPORTED_SOP_CLASSES.RT_PLAN,
      SUPPORTED_SOP_CLASSES.RT_TREATMENT,
    ].includes(sopClassUID as any);
  }

  async preProcess(imageId: string, metadata: DICOMMetadata): Promise<void> {
    log.info('Pre-processing RT data', {
      component: 'RTHandler',
      metadata: { imageId, sopClassUID: metadata.sopClassUID },
    });

    // RT-specific preprocessing
    // Handle structure sets, dose grids, etc.
  }

  async postProcess(_imageId: string, image: any): Promise<any> {
    // Apply RT-specific post-processing
    // e.g., dose colormap application
    return image;
  }

  getDefaultWindowLevel(metadata: DICOMMetadata): { window: number; level: number } | null {
    // RT dose typically uses specific window/level
    if (metadata.sopClassUID === SUPPORTED_SOP_CLASSES.RT_DOSE) {
      return { window: 100, level: 50 }; // Percentage of prescription dose
    }

    return null;
  }
}

// ===== Multi-frame Handler =====

export class MultiFrameHandler extends SOPClassHandler {
  canHandle(sopClassUID: string): boolean {
    return [
      SUPPORTED_SOP_CLASSES.US_MULTIFRAME,
      SUPPORTED_SOP_CLASSES.MULTIFRAME_SC,
      SUPPORTED_SOP_CLASSES.MULTIFRAME_TRUE_COLOR_SC,
      SUPPORTED_SOP_CLASSES.ENHANCED_CT,
      SUPPORTED_SOP_CLASSES.ENHANCED_MR,
      SUPPORTED_SOP_CLASSES.ENHANCED_PET,
      SUPPORTED_SOP_CLASSES.ENHANCED_US,
      SUPPORTED_SOP_CLASSES.ENHANCED_XA,
      SUPPORTED_SOP_CLASSES.ENHANCED_XRF,
    ].includes(sopClassUID as any);
  }

  async preProcess(_imageId: string, _metadata: DICOMMetadata): Promise<void> {
    log.info('Pre-processing Multi-frame image', {
      component: 'MultiFrameHandler',
      metadata: { imageId: _imageId, sopClassUID: _metadata.sopClassUID },
    });

    // Multi-frame specific preprocessing
    // Handle frame-specific metadata
  }

  async postProcess(_imageId: string, image: any): Promise<any> {
    // Apply multi-frame specific post-processing
    // Handle frame navigation
    return image;
  }

  getDefaultWindowLevel(_metadata: DICOMMetadata): { window: number; level: number } | null {
    // Delegate to modality-specific defaults
    return null;
  }
}

// ===== Segmentation Handler =====

export class SegmentationHandler extends SOPClassHandler {
  canHandle(sopClassUID: string): boolean {
    return [
      SUPPORTED_SOP_CLASSES.SEGMENTATION,
      SUPPORTED_SOP_CLASSES.SURFACE_SEGMENTATION,
    ].includes(sopClassUID as any);
  }

  async preProcess(_imageId: string, _metadata: DICOMMetadata): Promise<void> {
    log.info('Pre-processing Segmentation data', {
      component: 'SegmentationHandler',
      metadata: { imageId: _imageId, sopClassUID: _metadata.sopClassUID },
    });

    // Segmentation specific preprocessing
    // Handle segment descriptions, colors, etc.
  }

  async postProcess(_imageId: string, image: any): Promise<any> {
    // Apply segmentation specific post-processing
    // Handle segment visibility, colors
    return image;
  }

  getDefaultWindowLevel(_metadata: DICOMMetadata): { window: number; level: number } | null {
    // Segmentations typically don't use window/level
    return null;
  }
}

// ===== Handler Factory =====

export class SOPClassHandlerFactory {
  private static handlers = new Map<string, SOPClassHandler>();

  static {
    // Register default handlers
    this.registerHandler('CT', new CTImageHandler());
    this.registerHandler('MR', new MRImageHandler());
    this.registerHandler('PET', new PETImageHandler());
    this.registerHandler('US', new UltrasoundHandler());
    this.registerHandler('DX', new DigitalXRayHandler());
    this.registerHandler('RT', new RTHandler());
    this.registerHandler('MULTIFRAME', new MultiFrameHandler());
    this.registerHandler('SEG', new SegmentationHandler());
  }

  static registerHandler(key: string, handler: SOPClassHandler): void {
    this.handlers.set(key, handler);
  }

  static getHandler(sopClassUID: string): SOPClassHandler | null {
    // Try to find a handler that can handle this SOP class
    for (const handler of this.handlers.values()) {
      if (handler.canHandle(sopClassUID)) {
        return handler;
      }
    }
    return null;
  }

  static getAllHandlers(): Map<string, SOPClassHandler> {
    return new Map(this.handlers);
  }
}

