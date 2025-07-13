import { 
    volumeLoader,
    cache,
    Types,
    Enums
} from '@cornerstonejs/core';

export interface VolumeLoadingOptions {
    imageIds: string[];
    volumeId?: string;
    progressiveRendering?: boolean;
    useSharedArrayBuffer?: boolean;
    targetMemory?: number; // Target memory usage in MB
}

export interface VolumeLoadingProgress {
    volumeId: string;
    loaded: number;
    total: number;
    percentComplete: number;
    stage: 'loading' | 'processing' | 'complete';
}

export interface VolumeInfo {
    volumeId: string;
    dimensions: Types.Point3;
    spacing: Types.Point3;
    origin: Types.Point3;
    direction: Types.Mat3;
    scalarData: any;
    metadata: any;
    imageIds: string[];
}

export class VolumeLoader {
    private static instance: VolumeLoader;
    private loadingPromises: Map<string, Promise<any>> = new Map();
    private progressCallbacks: Map<string, (progress: VolumeLoadingProgress) => void> = new Map();

    public static getInstance(): VolumeLoader {
        if (!VolumeLoader.instance) {
            VolumeLoader.instance = new VolumeLoader();
        }
        return VolumeLoader.instance;
    }

    public async loadImageVolume(
        options: VolumeLoadingOptions,
        onProgress?: (progress: VolumeLoadingProgress) => void
    ): Promise<Types.IImageVolume> {
        try {
            const volumeId = options.volumeId || `volume-${Date.now()}`;
            
            console.log(`Starting volume loading: ${volumeId}`);
            
            // Check if volume is already loading
            if (this.loadingPromises.has(volumeId)) {
                console.log(`Volume ${volumeId} is already loading, returning existing promise`);
                return this.loadingPromises.get(volumeId)!;
            }

            // Register progress callback
            if (onProgress) {
                this.progressCallbacks.set(volumeId, onProgress);
            }

            // Create loading promise
            const loadingPromise = this.performVolumeLoading(volumeId, options);
            this.loadingPromises.set(volumeId, loadingPromise);

            try {
                const volume = await loadingPromise;
                console.log(`Volume loading completed: ${volumeId}`);
                return volume;
            } finally {
                // Clean up
                this.loadingPromises.delete(volumeId);
                this.progressCallbacks.delete(volumeId);
            }

        } catch (error) {
            console.error('Error loading volume:', error);
            throw new Error(`Failed to load volume: ${error}`);
        }
    }

    private async performVolumeLoading(
        volumeId: string,
        options: VolumeLoadingOptions
    ): Promise<Types.IImageVolume> {
        try {
            // Report initial progress
            this.reportProgress(volumeId, {
                volumeId,
                loaded: 0,
                total: options.imageIds.length,
                percentComplete: 0,
                stage: 'loading'
            });

            // Create volume using Cornerstone3D's volume loader
            const volume = await volumeLoader.createAndCacheVolume(volumeId, {
                imageIds: options.imageIds,
                progressiveRendering: options.progressiveRendering || false
            });

            // Report processing stage
            this.reportProgress(volumeId, {
                volumeId,
                loaded: options.imageIds.length,
                total: options.imageIds.length,
                percentComplete: 50,
                stage: 'processing'
            });

            // Load the volume data
            await volume.load();

            // Report completion
            this.reportProgress(volumeId, {
                volumeId,
                loaded: options.imageIds.length,
                total: options.imageIds.length,
                percentComplete: 100,
                stage: 'complete'
            });

            console.log(`Volume loaded successfully: ${volumeId}`);
            return volume;

        } catch (error) {
            console.error(`Error in volume loading process for ${volumeId}:`, error);
            throw error;
        }
    }

    private reportProgress(volumeId: string, progress: VolumeLoadingProgress): void {
        const callback = this.progressCallbacks.get(volumeId);
        if (callback) {
            callback(progress);
        }
    }

    public async loadMultipleVolumes(
        volumeConfigs: VolumeLoadingOptions[],
        onProgress?: (overallProgress: { completed: number; total: number; percentComplete: number }) => void
    ): Promise<Types.IImageVolume[]> {
        try {
            console.log(`Loading ${volumeConfigs.length} volumes...`);
            
            const volumes: Types.IImageVolume[] = [];
            let completed = 0;

            for (const config of volumeConfigs) {
                const volume = await this.loadImageVolume(config, (progress) => {
                    if (progress.stage === 'complete' && onProgress) {
                        completed++;
                        onProgress({
                            completed,
                            total: volumeConfigs.length,
                            percentComplete: Math.round((completed / volumeConfigs.length) * 100)
                        });
                    }
                });
                volumes.push(volume);
            }

            console.log(`All ${volumeConfigs.length} volumes loaded successfully`);
            return volumes;

        } catch (error) {
            console.error('Error loading multiple volumes:', error);
            throw error;
        }
    }

    public getVolumeInfo(volumeId: string): VolumeInfo | null {
        try {
            const volume = cache.getVolume(volumeId);
            if (!volume) {
                return null;
            }

            return {
                volumeId: volume.volumeId,
                dimensions: volume.dimensions,
                spacing: volume.spacing,
                origin: volume.origin,
                direction: volume.direction,
                scalarData: (volume as any).scalarData,
                metadata: volume.metadata,
                imageIds: volume.imageIds || []
            };

        } catch (error) {
            console.error(`Error getting volume info for ${volumeId}:`, error);
            return null;
        }
    }

    public isVolumeLoaded(volumeId: string): boolean {
        try {
            const volume = cache.getVolume(volumeId);
            return !!volume;
        } catch (error) {
            return false;
        }
    }

    public isVolumeLoading(volumeId: string): boolean {
        return this.loadingPromises.has(volumeId);
    }

    public removeVolume(volumeId: string): boolean {
        try {
            // Cancel loading if in progress
            if (this.loadingPromises.has(volumeId)) {
                this.loadingPromises.delete(volumeId);
                this.progressCallbacks.delete(volumeId);
            }

            // Remove from cache
            cache.removeVolumeLoadObject(volumeId);
            console.log(`Volume removed: ${volumeId}`);
            return true;

        } catch (error) {
            console.error(`Error removing volume ${volumeId}:`, error);
            return false;
        }
    }

    public getAllLoadedVolumes(): VolumeInfo[] {
        try {
            const volumes = cache.getVolumes() || {};
            return Object.keys(volumes)
                .map((id: string) => this.getVolumeInfo(id))
                .filter(info => info !== null) as VolumeInfo[];

        } catch (error) {
            console.error('Error getting all loaded volumes:', error);
            return [];
        }
    }

    public getMemoryUsage(): {
        totalMemoryInMB: number;
        volumeCount: number;
        volumes: Array<{ volumeId: string; memorySizeInMB: number }>;
    } {
        try {
            const volumes = this.getAllLoadedVolumes();
            let totalMemory = 0;
            const volumeMemoryInfo: Array<{ volumeId: string; memorySizeInMB: number }> = [];

            volumes.forEach(volumeInfo => {
                // Estimate memory usage (this is a rough calculation)
                const voxelCount = volumeInfo.dimensions[0] * volumeInfo.dimensions[1] * volumeInfo.dimensions[2];
                const bytesPerVoxel = 2; // Assuming 16-bit data
                const memorySizeInMB = (voxelCount * bytesPerVoxel) / (1024 * 1024);
                
                totalMemory += memorySizeInMB;
                volumeMemoryInfo.push({
                    volumeId: volumeInfo.volumeId,
                    memorySizeInMB: Math.round(memorySizeInMB * 100) / 100
                });
            });

            return {
                totalMemoryInMB: Math.round(totalMemory * 100) / 100,
                volumeCount: volumes.length,
                volumes: volumeMemoryInfo
            };

        } catch (error) {
            console.error('Error calculating memory usage:', error);
            return {
                totalMemoryInMB: 0,
                volumeCount: 0,
                volumes: []
            };
        }
    }

    public clearAllVolumes(): void {
        try {
            // Cancel all loading operations
            this.loadingPromises.clear();
            this.progressCallbacks.clear();

            // Clear volume cache
            const volumes = cache.getVolumes() || {};
            Object.keys(volumes).forEach((id: string) => {
                try {
                    cache.removeVolumeLoadObject(id);
                } catch (error) {
                    console.warn(`Failed to remove volume ${id}:`, error);
                }
            });

            console.log('All volumes cleared from cache');

        } catch (error) {
            console.error('Error clearing all volumes:', error);
        }
    }
}

// Utility functions for common volume operations
export async function loadVolumeFromImageIds(
    imageIds: string[],
    volumeId?: string,
    onProgress?: (progress: VolumeLoadingProgress) => void
): Promise<Types.IImageVolume> {
    const loader = VolumeLoader.getInstance();
    return loader.loadImageVolume({
        imageIds,
        volumeId
    }, onProgress);
}

export async function loadVolumeFromSeries(
    seriesImageIds: string[],
    volumeId?: string
): Promise<Types.IImageVolume> {
    if (!seriesImageIds || seriesImageIds.length === 0) {
        throw new Error('No image IDs provided for volume creation');
    }

    console.log(`Creating volume from ${seriesImageIds.length} images`);
    return loadVolumeFromImageIds(seriesImageIds, volumeId);
}

export function getVolumeLoader(): VolumeLoader {
    return VolumeLoader.getInstance();
}

export function isVolumeSupported(imageIds: string[]): boolean {
    // Basic validation for volume support
    if (!imageIds || imageIds.length < 2) {
        return false;
    }

    // Check if all images are DICOM (basic check)
    const supportedFormats = ['wadouri:', 'wadors:', 'dicomweb:'];
    return imageIds.every(id => 
        supportedFormats.some(format => id.startsWith(format))
    );
}

export function estimateVolumeMemoryRequirement(
    dimensions: Types.Point3,
    bytesPerVoxel: number = 2
): number {
    const voxelCount = dimensions[0] * dimensions[1] * dimensions[2];
    return (voxelCount * bytesPerVoxel) / (1024 * 1024); // Return MB
}