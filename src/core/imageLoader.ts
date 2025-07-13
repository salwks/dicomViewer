import { imageLoader, cache } from '@cornerstonejs/core';
import { 
    init as dicomImageLoaderInit,
    wadouri,
    wadors,
    getImageFrame,
    createImage,
    internal
} from '@cornerstonejs/dicom-image-loader';
import * as dicomParser from 'dicom-parser';

export interface DICOMImageLoaderConfig {
    maxWebWorkers?: number;
    startWebWorkersOnDemand?: boolean;
    taskConfiguration?: {
        decodeTask?: {
            initializeCodecsOnStartup?: boolean;
            usePDFJS?: boolean;
            strict?: boolean;
        };
    };
    beforeSend?: (xhr: XMLHttpRequest) => void;
}

export interface ImageLoadingProgress {
    imageId: string;
    loaded: number;
    total: number;
    percentComplete: number;
}

export function initializeDICOMImageLoader(config: DICOMImageLoaderConfig = {}): void {
    try {
        // Initialize the DICOM image loader
        dicomImageLoaderInit();

        // Configure external dependencies (legacy API compatibility)
        if ((internal as any).external) {
            (internal as any).external.dicomParser = dicomParser;
        }

        // Set up web worker configuration
        const defaultConfig: DICOMImageLoaderConfig = {
            maxWebWorkers: navigator.hardwareConcurrency || 1,
            startWebWorkersOnDemand: true,
            taskConfiguration: {
                decodeTask: {
                    initializeCodecsOnStartup: false,
                    usePDFJS: false,
                    strict: false,
                },
            },
            ...config
        };

        // Initialize web worker manager if available (legacy API compatibility)
        if ((internal as any).webWorkerManager) {
            (internal as any).webWorkerManager.initialize(defaultConfig);
        }

        // Configure beforeSend for authentication if provided
        if (defaultConfig.beforeSend) {
            (wadouri as any).configure({
                beforeSend: defaultConfig.beforeSend
            });
            
            (wadors as any).configure({
                beforeSend: defaultConfig.beforeSend
            });
        }

        console.log('DICOM Image Loader initialized successfully');

    } catch (error) {
        console.error('Error initializing DICOM image loader:', error);
        throw new Error(`Failed to initialize DICOM image loader: ${error}`);
    }
}

export async function loadDicomImage(imageId: string): Promise<any> {
    try {
        console.log(`Loading DICOM image: ${imageId}`);
        
        const image = await imageLoader.loadAndCacheImage(imageId);
        
        console.log(`DICOM image loaded successfully: ${imageId}`);
        return image;

    } catch (error) {
        console.error(`Error loading DICOM image ${imageId}:`, error);
        throw new Error(`Failed to load DICOM image: ${error}`);
    }
}

export async function loadDicomImages(imageIds: string[]): Promise<any[]> {
    try {
        console.log(`Loading ${imageIds.length} DICOM images...`);
        
        const promises = imageIds.map(imageId => loadDicomImage(imageId));
        const images = await Promise.all(promises);
        
        console.log(`Successfully loaded ${images.length} DICOM images`);
        return images;

    } catch (error) {
        console.error('Error loading DICOM images:', error);
        throw new Error(`Failed to load DICOM images: ${error}`);
    }
}

export async function loadDicomImageWithProgress(
    imageId: string,
    onProgress?: (progress: ImageLoadingProgress) => void
): Promise<any> {
    try {
        console.log(`Loading DICOM image with progress: ${imageId}`);

        // Set up progress callback
        const progressCallback = (event: any) => {
            if (onProgress && event.loaded && event.total) {
                const progress: ImageLoadingProgress = {
                    imageId,
                    loaded: event.loaded,
                    total: event.total,
                    percentComplete: Math.round((event.loaded / event.total) * 100)
                };
                onProgress(progress);
            }
        };

        // Configure progress for wadouri (legacy API compatibility)
        (wadouri as any).configure({
            beforeSend: (xhr: XMLHttpRequest) => {
                xhr.onprogress = progressCallback;
            }
        });

        const image = await imageLoader.loadAndCacheImage(imageId);
        
        console.log(`DICOM image loaded with progress successfully: ${imageId}`);
        return image;

    } catch (error) {
        console.error(`Error loading DICOM image with progress ${imageId}:`, error);
        throw new Error(`Failed to load DICOM image with progress: ${error}`);
    }
}

export function createDICOMImageId(file: File): string {
    try {
        // Create a blob URL for the file
        const blob = new Blob([file], { type: 'application/dicom' });
        const blobUrl = URL.createObjectURL(blob);
        
        // Create wadouri image ID
        const imageId = `wadouri:${blobUrl}`;
        
        console.log(`Created DICOM image ID: ${imageId}`);
        return imageId;

    } catch (error) {
        console.error('Error creating DICOM image ID:', error);
        throw new Error(`Failed to create DICOM image ID: ${error}`);
    }
}

export function createDICOMImageIds(files: File[]): string[] {
    try {
        const imageIds = files.map(file => createDICOMImageId(file));
        console.log(`Created ${imageIds.length} DICOM image IDs`);
        return imageIds;

    } catch (error) {
        console.error('Error creating DICOM image IDs:', error);
        throw new Error(`Failed to create DICOM image IDs: ${error}`);
    }
}

export function cleanupImageId(imageId: string): void {
    try {
        // Remove from cache
        cache.removeImageLoadObject(imageId);
        
        // Clean up blob URL if it's a blob-based image ID
        if (imageId.startsWith('wadouri:blob:')) {
            const blobUrl = imageId.replace('wadouri:', '');
            URL.revokeObjectURL(blobUrl);
        }
        
        console.log(`Cleaned up image ID: ${imageId}`);

    } catch (error) {
        console.error(`Error cleaning up image ID ${imageId}:`, error);
    }
}

export function cleanupImageIds(imageIds: string[]): void {
    try {
        imageIds.forEach(imageId => cleanupImageId(imageId));
        console.log(`Cleaned up ${imageIds.length} image IDs`);

    } catch (error) {
        console.error('Error cleaning up image IDs:', error);
    }
}

export async function prefetchImages(imageIds: string[]): Promise<void> {
    try {
        console.log(`Prefetching ${imageIds.length} images...`);
        
        // Load images in background without blocking
        const prefetchPromises = imageIds.map(async (imageId) => {
            try {
                await imageLoader.loadAndCacheImage(imageId);
            } catch (error) {
                console.warn(`Failed to prefetch image ${imageId}:`, error);
            }
        });
        
        await Promise.allSettled(prefetchPromises);
        console.log(`Prefetching completed for ${imageIds.length} images`);

    } catch (error) {
        console.error('Error prefetching images:', error);
    }
}

export function getImageFromCache(imageId: string): any | undefined {
    try {
        return cache.getImage(imageId);
    } catch (error) {
        console.error(`Error getting image from cache ${imageId}:`, error);
        return undefined;
    }
}

export function isImageCached(imageId: string): boolean {
    try {
        const image = cache.getImage(imageId);
        return !!image;
    } catch (error) {
        return false;
    }
}

export function getCacheStats(): any {
    try {
        return {
            numberOfImages: (cache as any).getNumberOfImages?.() || 0,
            maximumSizeInBytes: (cache as any).getMaximumSizeInBytes?.() || 0,
            cacheSizeInBytes: (cache as any).getCacheSizeInBytes?.() || 0
        };
    } catch (error) {
        console.error('Error getting cache stats:', error);
        return null;
    }
}

export function clearImageCache(): void {
    try {
        cache.purgeCache();
        console.log('Image cache cleared successfully');
    } catch (error) {
        console.error('Error clearing image cache:', error);
    }
}

export interface DICOMMetadata {
    patientName?: string;
    patientId?: string;
    studyDate?: string;
    studyDescription?: string;
    seriesDescription?: string;
    modality?: string;
    instanceNumber?: number;
    rows?: number;
    columns?: number;
    pixelSpacing?: [number, number];
    sliceThickness?: number;
    windowCenter?: number;
    windowWidth?: number;
}

export async function extractDICOMMetadata(imageId: string): Promise<DICOMMetadata | null> {
    try {
        const image = await loadDicomImage(imageId);
        
        if (!image || !image.data) {
            return null;
        }

        const dataset = image.data;
        
        const metadata: DICOMMetadata = {
            patientName: dataset.string('x00100010'),
            patientId: dataset.string('x00100020'),
            studyDate: dataset.string('x00080020'),
            studyDescription: dataset.string('x00081030'),
            seriesDescription: dataset.string('x0008103e'),
            modality: dataset.string('x00080060'),
            instanceNumber: dataset.intString('x00200013'),
            rows: dataset.uint16('x00280010'),
            columns: dataset.uint16('x00280011'),
            pixelSpacing: dataset.string('x00280030')?.split('\\').map(Number) as [number, number],
            sliceThickness: dataset.floatString('x00180050'),
            windowCenter: dataset.floatString('x00281050'),
            windowWidth: dataset.floatString('x00281051')
        };

        return metadata;

    } catch (error) {
        console.error(`Error extracting DICOM metadata from ${imageId}:`, error);
        return null;
    }
}