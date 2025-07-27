/**
 * Type declarations for @cornerstonejs/dicom-image-loader
 * Enhanced with proper types based on Cornerstone3D documentation
 */

export interface DICOMImageLoaderConfig {
  /** Maximum number of web workers for parallel processing */
  maxWebWorkers?: number;
  /** Callback executed before network request */
  beforeSend?: (xhr: XMLHttpRequest) => void;
  /** Callback triggered when downloading ends */
  onloadend?: (event: Event, params: unknown) => void;
  /** Callback triggered on request state change */
  onreadystatechange?: (event: Event, params: unknown) => void;
  /** Callback triggered on download progress */
  onprogress?: (event: ProgressEvent, params: unknown) => void;
  /** Error interceptor callback */
  errorInterceptor?: (error: Error & {
    request?: XMLHttpRequest;
    response?: unknown;
    status?: number;
  }) => void;
  /** Callback for modifying newly created image objects */
  imageCreated?: (imageObject: unknown) => void;
  /** Decoder configuration */
  decodeConfig?: {
    convertFloatPixelDataToInt?: boolean;
    use16BitDataType?: boolean;
  };
  /** Strict mode for image decoding */
  strict?: boolean;
}

export interface WebWorkerManager {
  initialize(config: { maxWebWorkers?: number }): void;
  terminate(): void;
}

export interface DataSetCacheManager {
  load(url: string): Promise<unknown>;
  unload(url: string): void;
  purge(): void;
}

export interface WADOURIModule {
  loadImage(imageId: string, options?: Record<string, unknown>): Promise<unknown>;
  fileManager: {
    add(file: File): string;
    get(imageId: string): File | undefined;
  };
  dataSetCacheManager: DataSetCacheManager;
}

export interface WADORSModule {
  loadImage(imageId: string, options?: Record<string, unknown>): Promise<unknown>;
  metaDataManager: {
    add(imageId: string, metadata: Record<string, unknown>): void;
    get(imageId: string): Record<string, unknown> | undefined;
  };
}

declare module '@cornerstonejs/dicom-image-loader' {
  export function init(config?: DICOMImageLoaderConfig): Promise<void>;
  export function configure(config: Partial<DICOMImageLoaderConfig>): void;

  export const webWorkerManager: WebWorkerManager;
  export const wadouri: WADOURIModule;
  export const wadors: WADORSModule;
  export const dataSetCacheManager: DataSetCacheManager;
  export const external: {
    cornerstone?: unknown;
    dicomParser?: unknown;
  };

  // Default namespace export
  namespace cornerstoneDICOMImageLoader {
    export function init(config?: DICOMImageLoaderConfig): Promise<void>;
    export function configure(config: Partial<DICOMImageLoaderConfig>): void;
  }
  export = cornerstoneDICOMImageLoader;
}

export interface CornerstoneImage {
  imageId: string;
  minPixelValue: number;
  maxPixelValue: number;
  slope: number;
  intercept: number;
  windowCenter?: number;
  windowWidth?: number;
  getPixelData(): Uint8Array | Uint16Array | Int16Array | Float32Array;
  rows: number;
  columns: number;
  sizeInBytes: number;
  loadTimeInMS?: number;
  decodeTimeInMS?: number;
  data?: DataSet;
}

export interface ImageLoadOptions {
  priority?: number;
  requestType?: 'interaction' | 'thumbnail' | 'prefetch';
  additionalDetails?: Record<string, unknown>;
}

declare module '@cornerstonejs/dicom-image-loader/dist/esm/imageLoader/wadouri/loadImage' {
  export function loadImage(imageId: string, options?: ImageLoadOptions): Promise<CornerstoneImage>;
}

declare module '@cornerstonejs/dicom-image-loader/dist/esm/imageLoader/wadors/loadImage' {
  export function loadImage(imageId: string, options?: ImageLoadOptions): Promise<CornerstoneImage>;
}

declare module 'dicom-parser' {
  export interface DICOMElement {
    tag: string;
    vr?: string;
    length: number;
    dataOffset?: number;
    hadUndefinedLength?: boolean;
    value?: unknown;
  }

  export interface DataSet {
    byteArray: Uint8Array;
    elements: { [tag: string]: DICOMElement };
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
