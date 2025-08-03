/**
 * Extended types for Cornerstone3D functionality
 * Security-enhanced with specific type definitions to prevent any-type vulnerabilities
 */

// DICOM-specific type definitions
interface DICOMImageData {
  string(tag: string): string;
  uint16(tag: string): number;
  int16(tag: string): number;
  uint32(tag: string): number;
  int32(tag: string): number;
  floatString(tag: string): number;
}

// TypedArray union type for better type safety
type TypedArray =
  | Uint8Array
  | Uint16Array
  | Uint32Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Float32Array
  | Float64Array;

interface CornerstoneConfiguration {
  webWorkerPath?: string;
  maxWebWorkers?: number;
  startWebWorkersOnDemand?: boolean;
  taskConfiguration?: {
    [key: string]: {
      maxNumWorkers?: number;
      [key: string]: unknown;
    };
  };
}

interface ImageLoaderConfig {
  maxWebWorkers?: number;
  startWebWorkersOnDemand?: boolean;
  webWorkerPath?: string;
  taskConfiguration?: Record<string, unknown>;
}

interface VolumeLoaderConfig {
  maxNumRequests?: number;
  requestPoolSize?: number;
}

interface CacheConfig {
  maxCacheSize?: number;
  purgeOnStart?: boolean;
}

interface UtilitiesNamespace {
  loadImageToCanvas?: (element: HTMLElement, imageId: string) => Promise<HTMLCanvasElement>;
  [key: string]: unknown;
}

interface EnumsNamespace {
  ViewportType: typeof ViewportType;
  [key: string]: unknown;
}

declare module '@cornerstonejs/core' {
  export function init(configuration?: CornerstoneConfiguration): Promise<void>;
  export const imageLoader: {
    loadImage(imageId: string): Promise<Types.IImage>;
    registerImageLoader(scheme: string, imageLoader: (imageId: string) => Promise<Types.IImage>): void;
    loadAndCacheImage?: (imageId: string) => Promise<Types.IImage>;
    [key: string]: unknown;
  };
  export const volumeLoader: {
    loadVolume(volumeId: string, config?: VolumeLoaderConfig): Promise<Types.IImageVolume>;
    registerVolumeLoader(scheme: string, volumeLoader: (volumeId: string) => Promise<Types.IImageVolume>): void;
    createAndCacheVolume?: (volumeId: string, options?: unknown) => Promise<Types.IImageVolume>;
    [key: string]: unknown;
  };
  export const cache: Cache;
  export const utilities: UtilitiesNamespace;
  export const Enums: EnumsNamespace;
  export const RenderingEngine: new (id: string) => {
    setViewports(viewports: Array<{ viewportId: string; element: HTMLElement; type: string }>): void;
    render(): void;
    [key: string]: unknown;
  };
  export const setVolumesForViewports: (
    renderingEngine: unknown,
    volumes: Array<{ volumeId: string; callback?: (params: { volumeActor: unknown }) => void }>,
    viewportIds: string[]
  ) => Promise<void>;

  namespace Types {
    interface IImage {
      data?: DICOMImageData; // Type-safe DICOM data access
      getPixelData(): ArrayBuffer | Uint8Array | Uint16Array | Int16Array | Uint32Array | Int32Array;
      sizeInBytes?: number;
      imageId?: string;
      windowCenter?: number;
      windowWidth?: number;
      minPixelValue?: number;
      maxPixelValue?: number;
      PixelArea?: number;
      imageFrame?: {
        pixelData: ArrayBuffer;
        rows: number;
        columns: number;
        [key: string]: unknown;
      };
      slope?: number;
      intercept?: number;
      rows?: number;
      columns?: number;
      height?: number;
      width?: number;
      color?: boolean;
      rgba?: boolean;
      columnPixelSpacing?: number;
      rowPixelSpacing?: number;
      invert?: boolean;
    }

    interface IImageVolume {
      volumeId: string;
      dimensions: [number, number, number];
      direction: [number, number, number, number, number, number, number, number, number];
      metadata: Map<string, unknown>; // Use Map instead of any for security
      origin: [number, number, number];
      spacing: [number, number, number];
      scalarData: ArrayBuffer | TypedArray;
      imageIds: string[];
      loadStatus: {
        loaded: boolean;
        loading: boolean;
        cachedFrames: number[];
        callbacks: Array<() => void>;
      };
      imageData?: {
        dimensions: [number, number, number];
        spacing: [number, number, number];
        origin: [number, number, number];
        [key: string]: unknown;
      };
      vtkImageData?: {
        getNumberOfPoints(): number;
        getDimensions(): [number, number, number];
        [key: string]: unknown;
      };
    }

    interface VolumeLoaderOptions {
      progressive?: boolean;
      imageIds?: string[];
      callback?: (params: { volumeActor: unknown; volume: IImageVolume }) => void;
    }
  }

  namespace Enums {
    enum ViewportType {
      ORTHOGRAPHIC = 'orthographic',
      PERSPECTIVE = 'perspective',
      STACK = 'stack',
    }
  }

  interface Cache {
    getCacheInformation?(): unknown;
    setMaximumSizeBytes?(size: number): void;
    purgeCache?(): void;
    getCachedImageBasedOnImageURI?(imageURI: string): unknown;
    add?(key: string, value: unknown): void;
  }
}

// Performance API extensions
interface Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

// Window extensions for garbage collection
interface Window {
  gc?(): void;
}
