/**
 * Enhanced DICOM Types with Metadata Provider Support
 * Extended type definitions for the Advanced DICOM Loader system
 */

// Re-export from base types
export * from '../AdvancedDICOMLoader';

// Enhanced DICOMMetadata with additional fields for metadata providers
export interface EnhancedDICOMMetadata {
  // Standard DICOM metadata fields (using camelCase for consistency)
  studyInstanceUID?: string;
  seriesInstanceUID?: string;
  sopInstanceUID?: string;
  patientName?: string;
  patientID?: string;
  patientBirthDate?: string;
  instanceNumber?: number;
  rows?: number;
  columns?: number;
  pixelSpacing?: number[];
  windowCenter?: number;
  windowWidth?: number;
  // Provider information
  extractedBy?: string; // Provider name that extracted this metadata
  extractionTime?: number; // Timestamp of extraction

  // Custom metadata fields
  customMetadata?: Record<string, unknown>;

  // WADO-specific metadata
  wadoConfig?: {
    protocol: 'WADO-URI' | 'WADO-RS';
    baseUrl: string;
    authType?: string;
  };

  // Quality and validation information
  validationErrors?: string[];
  qualityScore?: number; // 0-100 quality assessment
  completeness?: number; // 0-100 percentage of expected fields present
}

// Metadata extraction options
export interface MetadataExtractionOptions {
  preferredProvider?: string;
  fallbackToDefault?: boolean;
  skipValidation?: boolean;
  customAttributeMapping?: Record<string, string>;
  extractionTimeout?: number; // milliseconds
}

// Metadata validation result
export interface MetadataValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  completeness: number; // 0-100
  qualityScore: number; // 0-100
  missingRequiredFields: string[];
  invalidFields: Array<{
    field: string;
    value: unknown;
    reason: string;
  }>;
}

// Provider capability information
export interface ProviderCapabilities {
  supportedProtocols: string[];
  supportedSOPClasses: string[];
  supportedTransferSyntaxes: string[];
  maxImageSize?: number; // bytes
  supportsStreaming: boolean;
  supportsProgressive: boolean;
  supportsAuthentication: boolean;
}

// Base LoadOptions interface
export interface LoadOptions {
  imageId: string;
  priority?: number;
  requestType?: 'interaction' | 'thumbnail' | 'prefetch';
  additionalDetails?: Record<string, unknown>;
  targetBuffer?: ArrayBuffer;
  preScale?: {
    enabled: boolean;
    scalingParameters: unknown;
  };
  useRGBA?: boolean;
  transferSyntax?: string;
  omitQuadTree?: boolean;
  headers?: Record<string, string>;
  customMetadata?: Record<string, unknown>;
  wadoConfig?: {
    url: string;
    qidoPrefix?: string;
    wadoPrefix?: string;
    authToken?: string;
  };
}

// Base DICOMMetadata interface
export interface DICOMMetadata {
  studyInstanceUID?: string;
  seriesInstanceUID?: string;
  sopInstanceUID?: string;
  sopClassUID?: string;
  modality?: string;
  patientName?: string;
  patientID?: string;
  patientBirthDate?: string;
  instanceNumber?: number;
  rows?: number;
  columns?: number;
  pixelSpacing?: number[];
  sliceThickness?: number;
  windowCenter?: number | number[];
  windowWidth?: number | number[];
  customMetadata?: Record<string, unknown>;
  wadoConfig?: {
    protocol: 'WADO-URI' | 'WADO-RS';
    baseUrl: string;
    authType?: string;
  };
}

// Extended LoadOptions with metadata provider support
export interface ExtendedLoadOptions extends LoadOptions {
  metadataOptions?: MetadataExtractionOptions;
  validateMetadata?: boolean;
  cacheMetadata?: boolean;
}

// Remove conflicting re-exports
