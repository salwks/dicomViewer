/**
 * Type declarations for @cornerstonejs/dicom-image-loader
 */

declare module '@cornerstonejs/dicom-image-loader' {
  export function init(config?: any): Promise<void>;
  export function configure(config: any): void;
  export * as cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';
  export const dicomImageLoader: any;
  export const webWorkerManager: any;
  export const wadouri: any;
  export const wadors: any;
  export const dataSetCacheManager: any;
  export const external: any;
}

declare module '@cornerstonejs/dicom-image-loader/dist/esm/imageLoader/wadouri/loadImage' {
  export function loadImage(imageId: string, options?: any): Promise<any>;
}

declare module '@cornerstonejs/dicom-image-loader/dist/esm/imageLoader/wadors/loadImage' {
  export function loadImage(imageId: string, options?: any): Promise<any>;
}

declare module 'dicom-parser' {
  export interface DataSet {
    byteArray: Uint8Array;
    elements: { [tag: string]: any };
    string(tag: string): string | undefined;
    uint16(tag: string): number | undefined;
    int16(tag: string): number | undefined;
    uint32(tag: string): number | undefined;
    int32(tag: string): number | undefined;
    float(tag: string): number | undefined;
    double(tag: string): number | undefined;
    floatString(tag: string): string | undefined;
    intString(tag: string): string | undefined;
  }

  export function parseDicom(byteArray: Uint8Array): DataSet;
}
