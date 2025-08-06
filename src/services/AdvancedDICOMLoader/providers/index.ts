/**
 * Metadata Providers Index
 * Exports all metadata providers for easy importing
 */

export { DefaultMetadataProvider } from './DefaultMetadataProvider';
export { WADOMetadataProvider } from './WADOMetadataProvider';
export {
  CustomMetadataProvider,
  createCustomMetadataProvider,
  createPACSMetadataProvider,
  createResearchMetadataProvider,
  type CustomProviderConfig,
} from './CustomMetadataProvider';

// Re-export the base interface
export type { MetadataProvider } from '../MetadataProvider';
