/**
 * DICOM Metadata Utilities
 *
 * This file contained utility functions for DICOM metadata that were not being used.
 * All unused exports have been removed to improve bundle size and maintainability.
 *
 * Only the VRType re-export is kept for compatibility.
 */

// Re-export VRType for convenience (used in other parts of the codebase)
export { VRType } from '../services/metadataManager';
