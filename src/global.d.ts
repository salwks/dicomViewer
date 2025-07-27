/**
 * Global type declarations for external modules
 */

declare module '@cornerstonejs/dicom-image-loader' {
  export interface DICOMImageLoaderConfig {
    maxWebWorkers?: number;
    beforeSend?: (xhr: XMLHttpRequest) => void;
    onloadend?: (event: Event, params: unknown) => void;
    onreadystatechange?: (event: Event, params: unknown) => void;
    onprogress?: (event: ProgressEvent, params: unknown) => void;
    errorInterceptor?: (error: Error) => void;
    imageCreated?: (imageObject: any) => void;
    decodeConfig?: {
      convertFloatPixelDataToInt?: boolean;
      use16BitDataType?: boolean;
    };
    strict?: boolean;
  }

  export function init(config?: DICOMImageLoaderConfig): Promise<void>;
  export function configure(config: Partial<DICOMImageLoaderConfig>): void;

  const cornerstoneDICOMImageLoader: any;
  export default cornerstoneDICOMImageLoader;
}

declare module '@cornerstonejs/dicom-image-loader/dist/cornerstoneDICOMImageLoaderWebWorker.min.js' {
  const webWorker: any;
  export default webWorker;
}

declare module '@cornerstonejs/dicom-image-loader/dist/cornerstoneDICOMImageLoaderCodecs.min.js' {
  const codecs: any;
  export default codecs;
}
