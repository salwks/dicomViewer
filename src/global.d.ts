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
    imageCreated?: (imageObject: {
      imageId: string;
      width: number;
      height: number;
      data: ArrayBuffer | Uint8Array | Uint16Array;
      metadata?: Record<string, any>;
    }) => void;
    decodeConfig?: {
      convertFloatPixelDataToInt?: boolean;
      use16BitDataType?: boolean;
    };
    strict?: boolean;
  }

  export function init(config?: DICOMImageLoaderConfig): Promise<void>;
  export function configure(config: Partial<DICOMImageLoaderConfig>): void;

  const cornerstoneDICOMImageLoader: {
    init: (config?: DICOMImageLoaderConfig) => Promise<void>;
    configure: (config: Partial<DICOMImageLoaderConfig>) => void;
    loadImage: (imageId: string) => Promise<any>;
    [key: string]: any;
  };
  export default cornerstoneDICOMImageLoader;
}

declare module '@cornerstonejs/dicom-image-loader/dist/cornerstoneDICOMImageLoaderWebWorker.min.js' {
  const webWorker: {
    initialize: (config?: any) => void;
    [key: string]: any;
  };
  export default webWorker;
}

declare module '@cornerstonejs/dicom-image-loader/dist/cornerstoneDICOMImageLoaderCodecs.min.js' {
  const codecs: {
    charLS: any;
    openJPEG: any;
    libjpegTurbo8: any;
    [key: string]: any;
  };
  export default codecs;
}
