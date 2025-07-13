// Using browser's built-in EventTarget
import { 
    loadDicomImage, 
    loadDicomImages, 
    loadDicomImageWithProgress,
    createDICOMImageIds,
    cleanupImageIds,
    prefetchImages,
    isImageCached,
    extractDICOMMetadata,
    DICOMMetadata,
    ImageLoadingProgress
} from './imageLoader';

export interface SeriesInfo {
    seriesInstanceUID: string;
    seriesNumber: number;
    seriesDescription: string;
    modality: string;
    imageIds: string[];
    numberOfImages: number;
    metadata?: DICOMMetadata[];
}

export interface StudyInfo {
    studyInstanceUID: string;
    studyDate: string;
    studyDescription: string;
    patientName: string;
    patientId: string;
    series: SeriesInfo[];
}

export interface ImageLoadingState {
    isLoading: boolean;
    currentImageIndex: number;
    totalImages: number;
    loadedImages: number;
    failedImages: number;
    progress: number; // 0-100
    error?: string;
}

export class ImageLoadingManager extends EventTarget {
    private studies: Map<string, StudyInfo> = new Map();
    private currentSeries: SeriesInfo | null = null;
    private loadingState: ImageLoadingState = {
        isLoading: false,
        currentImageIndex: 0,
        totalImages: 0,
        loadedImages: 0,
        failedImages: 0,
        progress: 0
    };

    constructor() {
        super();
    }

    public async loadFilesAsStudy(files: File[]): Promise<StudyInfo> {
        try {
            this.setLoadingState({
                isLoading: true,
                currentImageIndex: 0,
                totalImages: files.length,
                loadedImages: 0,
                failedImages: 0,
                progress: 0
            });

            this.dispatchEvent(new CustomEvent('loadingStarted', {
                detail: { totalFiles: files.length }
            }));

            // Create image IDs from files
            const imageIds = createDICOMImageIds(files);

            // Load metadata for all images to organize into series
            const metadataPromises = imageIds.map(async (imageId, index) => {
                try {
                    const metadata = await extractDICOMMetadata(imageId);
                    
                    this.updateLoadingProgress(index + 1, files.length);
                    
                    return {
                        imageId,
                        metadata,
                        file: files[index]
                    };
                } catch (error) {
                    console.error(`Failed to extract metadata for image ${index}:`, error);
                    this.loadingState.failedImages++;
                    return {
                        imageId,
                        metadata: null,
                        file: files[index]
                    };
                }
            });

            const imageMetadataResults = await Promise.allSettled(metadataPromises);
            
            // Organize images by series
            const seriesMap = new Map<string, {
                metadata: DICOMMetadata;
                imageIds: string[];
                files: File[];
            }>();

            imageMetadataResults.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value.metadata) {
                    const { imageId, metadata, file } = result.value;
                    const seriesKey = `${metadata.seriesDescription || 'Unknown'}_${metadata.modality || 'Unknown'}_${index}`;
                    
                    if (!seriesMap.has(seriesKey)) {
                        seriesMap.set(seriesKey, {
                            metadata,
                            imageIds: [],
                            files: []
                        });
                    }
                    
                    seriesMap.get(seriesKey)!.imageIds.push(imageId);
                    seriesMap.get(seriesKey)!.files.push(file);
                }
            });

            // Create study and series info
            const firstMetadata = imageMetadataResults.find(r => 
                r.status === 'fulfilled' && r.value.metadata
            );
            
            const studyMetadata = firstMetadata?.status === 'fulfilled' ? 
                firstMetadata.value.metadata : null;

            const studyInfo: StudyInfo = {
                studyInstanceUID: studyMetadata?.studyDate || `study-${Date.now()}`,
                studyDate: studyMetadata?.studyDate || new Date().toISOString().split('T')[0],
                studyDescription: studyMetadata?.studyDescription || 'Imported Study',
                patientName: studyMetadata?.patientName || 'Unknown Patient',
                patientId: studyMetadata?.patientId || 'Unknown ID',
                series: []
            };

            // Convert series map to series info
            let seriesNumber = 1;
            for (const [seriesKey, seriesData] of seriesMap) {
                const seriesInfo: SeriesInfo = {
                    seriesInstanceUID: `series-${seriesNumber}`,
                    seriesNumber: seriesNumber++,
                    seriesDescription: seriesData.metadata.seriesDescription || `Series ${seriesNumber}`,
                    modality: seriesData.metadata.modality || 'Unknown',
                    imageIds: seriesData.imageIds,
                    numberOfImages: seriesData.imageIds.length,
                    metadata: [seriesData.metadata]
                };
                
                studyInfo.series.push(seriesInfo);
            }

            // Store the study
            this.studies.set(studyInfo.studyInstanceUID, studyInfo);

            // Set the first series as current
            if (studyInfo.series.length > 0) {
                this.currentSeries = studyInfo.series[0];
            }

            this.setLoadingState({
                isLoading: false,
                currentImageIndex: 0,
                totalImages: files.length,
                loadedImages: this.loadingState.loadedImages,
                failedImages: this.loadingState.failedImages,
                progress: 100
            });

            this.dispatchEvent(new CustomEvent('studyLoaded', {
                detail: { studyInfo }
            }));

            console.log(`Study loaded with ${studyInfo.series.length} series`);
            return studyInfo;

        } catch (error) {
            this.setLoadingState({
                ...this.loadingState,
                isLoading: false,
                error: `Failed to load study: ${error}`
            });

            this.dispatchEvent(new CustomEvent('loadingError', {
                detail: { error }
            }));

            throw error;
        }
    }

    public async loadSeriesImages(seriesInfo: SeriesInfo): Promise<any[]> {
        try {
            this.setLoadingState({
                isLoading: true,
                currentImageIndex: 0,
                totalImages: seriesInfo.imageIds.length,
                loadedImages: 0,
                failedImages: 0,
                progress: 0
            });

            this.dispatchEvent(new CustomEvent('seriesLoadingStarted', {
                detail: { seriesInfo }
            }));

            const images = await loadDicomImages(seriesInfo.imageIds);

            this.setLoadingState({
                isLoading: false,
                currentImageIndex: 0,
                totalImages: seriesInfo.imageIds.length,
                loadedImages: images.length,
                failedImages: seriesInfo.imageIds.length - images.length,
                progress: 100
            });

            this.dispatchEvent(new CustomEvent('seriesLoaded', {
                detail: { seriesInfo, images }
            }));

            return images;

        } catch (error) {
            this.setLoadingState({
                ...this.loadingState,
                isLoading: false,
                error: `Failed to load series images: ${error}`
            });

            this.dispatchEvent(new CustomEvent('seriesLoadingError', {
                detail: { error, seriesInfo }
            }));

            throw error;
        }
    }

    public async prefetchSeriesImages(seriesInfo: SeriesInfo): Promise<void> {
        try {
            this.dispatchEvent(new CustomEvent('prefetchStarted', {
                detail: { seriesInfo }
            }));

            await prefetchImages(seriesInfo.imageIds);

            this.dispatchEvent(new CustomEvent('prefetchCompleted', {
                detail: { seriesInfo }
            }));

        } catch (error) {
            this.dispatchEvent(new CustomEvent('prefetchError', {
                detail: { error, seriesInfo }
            }));
        }
    }

    public getSeriesCacheStatus(seriesInfo: SeriesInfo): {
        total: number;
        cached: number;
        percentage: number;
    } {
        const total = seriesInfo.imageIds.length;
        const cached = seriesInfo.imageIds.filter(imageId => isImageCached(imageId)).length;
        
        return {
            total,
            cached,
            percentage: total > 0 ? Math.round((cached / total) * 100) : 0
        };
    }

    public getCurrentSeries(): SeriesInfo | null {
        return this.currentSeries;
    }

    public setCurrentSeries(seriesInfo: SeriesInfo): void {
        this.currentSeries = seriesInfo;
        this.dispatchEvent(new CustomEvent('currentSeriesChanged', {
            detail: { seriesInfo }
        }));
    }

    public getStudies(): StudyInfo[] {
        return Array.from(this.studies.values());
    }

    public getStudy(studyInstanceUID: string): StudyInfo | undefined {
        return this.studies.get(studyInstanceUID);
    }

    public getLoadingState(): ImageLoadingState {
        return { ...this.loadingState };
    }

    public clearStudies(): void {
        // Clean up image IDs for all studies
        for (const study of this.studies.values()) {
            for (const series of study.series) {
                cleanupImageIds(series.imageIds);
            }
        }

        this.studies.clear();
        this.currentSeries = null;

        this.dispatchEvent(new CustomEvent('studiesCleared', {
            detail: {}
        }));
    }

    private updateLoadingProgress(loaded: number, total: number): void {
        const progress = Math.round((loaded / total) * 100);
        
        this.setLoadingState({
            ...this.loadingState,
            loadedImages: loaded,
            progress
        });

        this.dispatchEvent(new CustomEvent('loadingProgress', {
            detail: { loaded, total, progress }
        }));
    }

    private setLoadingState(newState: Partial<ImageLoadingState>): void {
        this.loadingState = { ...this.loadingState, ...newState };
        
        this.dispatchEvent(new CustomEvent('loadingStateChanged', {
            detail: { state: this.loadingState }
        }));
    }

    public dispose(): void {
        this.clearStudies();
        // Event listeners cleanup (removeAllEventListeners not available)
    }
}