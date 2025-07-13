import { 
    RenderingEngine, 
    Types,
    Enums,
    volumeLoader,
    setVolumesForViewports,
    getRenderingEngine
} from '@cornerstonejs/core';
import { 
    Synchronizer,
    SynchronizerManager,
    synchronizers
} from '@cornerstonejs/tools';
import { LayoutManager } from './LayoutManager';
import { ViewportManager } from '../core/viewportManager';
import { registerMockImageLoader } from '../utils/mockImageLoader';

export interface SeriesComparisonConfig {
    series1ImageIds: string[];
    series2ImageIds: string[];
    containerElement: HTMLElement;
    syncCamera?: boolean;
    syncVOI?: boolean;
}

export class SeriesComparator {
    private renderingEngine: RenderingEngine;
    private viewportManager: ViewportManager;
    private layoutManager: LayoutManager;
    private cameraSynchronizer: Synchronizer | null = null;
    private voiSynchronizer: Synchronizer | null = null;
    private renderingEngineId: string = 'comparison-engine';
    private isInitialized: boolean = false;
    
    constructor(containerElement: HTMLElement) {
        this.renderingEngine = new RenderingEngine(this.renderingEngineId);
        this.viewportManager = new ViewportManager(this.renderingEngine);
        this.layoutManager = new LayoutManager(containerElement, this.viewportManager);
        
        // Register mock image loader if not already registered
        try {
            registerMockImageLoader();
        } catch (error) {
            console.warn('Mock image loader already registered or failed to register:', error);
        }
    }
    
    /**
     * Load and compare two different DICOM series side-by-side
     * @param config - Configuration object containing series data and options
     */
    public async loadAndCompareSeries(config: SeriesComparisonConfig): Promise<void> {
        try {
            console.log('Starting series comparison...');
            
            // Validate input
            if (!config.series1ImageIds.length || !config.series2ImageIds.length) {
                throw new Error('Both series must contain image IDs');
            }
            
            // Step 1: Setup 2x1 layout
            await this.setup2x1Layout();
            
            // Step 2: Create and cache volumes for both series
            const volume1Id = 'series1-volume';
            const volume2Id = 'series2-volume';
            
            const volume1 = await this.createVolume(volume1Id, config.series1ImageIds);
            const volume2 = await this.createVolume(volume2Id, config.series2ImageIds);
            
            console.log('Created volumes for both series');
            
            // Step 3: Setup viewports and assign volumes
            await this.setupViewportsWithVolumes(volume1Id, volume2Id);
            
            // Step 4: Setup synchronization if requested
            if (config.syncCamera !== false) {
                this.setupCameraSynchronization();
            }
            
            if (config.syncVOI !== false) {
                this.setupVOISynchronization();
            }
            
            // Step 5: Render both viewports
            this.renderingEngine.render();
            
            console.log('Series comparison setup completed successfully');
            
        } catch (error) {
            console.error('Error loading and comparing series:', error);
            throw error;
        }
    }
    
    /**
     * Setup 2x1 layout with two viewports
     */
    private async setup2x1Layout(): Promise<void> {
        // Create custom 2x1 layout if it doesn't exist
        this.layoutManager.createCustomLayout('2x1', 1, 2);
        
        // Set the layout
        this.layoutManager.setLayout('2x1', false);
        
        // Initialize Cornerstone3D viewports
        this.layoutManager.initializeCornerstone3DViewports();
        
        // Wait for viewports to be created
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('2x1 layout setup completed');
    }
    
    /**
     * Create and cache a volume from image IDs
     * @param volumeId - Unique identifier for the volume
     * @param imageIds - Array of image IDs for the series
     */
    private async createVolume(volumeId: string, imageIds: string[]): Promise<Types.IImageVolume> {
        try {
            console.log(`Creating volume ${volumeId} with ${imageIds.length} images`);
            
            // Create volume using Cornerstone3D volumeLoader
            const volume = await volumeLoader.createAndCacheVolume(volumeId, {
                imageIds
            });
            
            if (!volume) {
                throw new Error(`Failed to create volume: ${volumeId}`);
            }
            
            console.log(`Volume ${volumeId} created successfully`);
            return volume;
            
        } catch (error) {
            console.error(`Error creating volume ${volumeId}:`, error);
            throw error;
        }
    }
    
    /**
     * Setup viewports and assign volumes to them
     * @param volume1Id - ID of the first volume
     * @param volume2Id - ID of the second volume
     */
    private async setupViewportsWithVolumes(volume1Id: string, volume2Id: string): Promise<void> {
        try {
            const viewportElements = this.layoutManager.getAllViewportElements();
            
            if (viewportElements.length < 2) {
                throw new Error('Not enough viewports available for comparison');
            }
            
            const viewport1Element = viewportElements[0];
            const viewport2Element = viewportElements[1];
            
            const viewport1Id = viewport1Element.dataset.viewportId!;
            const viewport2Id = viewport2Element.dataset.viewportId!;
            
            // Enable viewports with volume type
            const viewportInputArray = [
                {
                    viewportId: viewport1Id,
                    element: viewport1Element as HTMLDivElement,
                    type: Enums.ViewportType.ORTHOGRAPHIC,
                    defaultOptions: {
                        orientation: Enums.OrientationAxis.AXIAL,
                        background: [0, 0, 0] as [number, number, number]
                    }
                },
                {
                    viewportId: viewport2Id,
                    element: viewport2Element as HTMLDivElement,
                    type: Enums.ViewportType.ORTHOGRAPHIC,
                    defaultOptions: {
                        orientation: Enums.OrientationAxis.AXIAL,
                        background: [0, 0, 0] as [number, number, number]
                    }
                }
            ];
            
            this.renderingEngine.setViewports(viewportInputArray);
            
            // Assign volumes to viewports
            await setVolumesForViewports(
                this.renderingEngine,
                [
                    {
                        volumeId: volume1Id,
                        callback: ({ volumeActor }) => {
                            // Optional: Set initial properties for volume 1
                        }
                    }
                ],
                [viewport1Id]
            );
            
            await setVolumesForViewports(
                this.renderingEngine,
                [
                    {
                        volumeId: volume2Id,
                        callback: ({ volumeActor }) => {
                            // Optional: Set initial properties for volume 2
                        }
                    }
                ],
                [viewport2Id]
            );
            
            console.log('Volumes assigned to viewports successfully');
            
        } catch (error) {
            console.error('Error setting up viewports with volumes:', error);
            throw error;
        }
    }
    
    /**
     * Setup camera synchronization between viewports
     */
    private setupCameraSynchronization(): void {
        try {
            // Destroy existing synchronizer if it exists
            if (this.cameraSynchronizer) {
                this.cameraSynchronizer.destroy();
            }
            
            // Create camera position synchronizer using the synchronizers module
            this.cameraSynchronizer = new Synchronizer('comparison-camera-sync', 'CAMERA_MODIFIED', () => {});
            
            const viewportElements = this.layoutManager.getAllViewportElements();
            
            // Add both viewports to synchronizer
            viewportElements.forEach(element => {
                const viewportId = element.dataset.viewportId;
                if (viewportId) {
                    this.cameraSynchronizer!.add({
                        renderingEngineId: this.renderingEngineId,
                        viewportId: viewportId
                    });
                }
            });
            
            console.log('Camera synchronization setup completed');
            
        } catch (error) {
            console.error('Error setting up camera synchronization:', error);
        }
    }
    
    /**
     * Setup VOI (Window/Level) synchronization between viewports
     */
    private setupVOISynchronization(): void {
        try {
            // Destroy existing synchronizer if it exists
            if (this.voiSynchronizer) {
                this.voiSynchronizer.destroy();
            }
            
            // Create VOI synchronizer using the synchronizers module
            this.voiSynchronizer = new Synchronizer('comparison-voi-sync', 'VOI_MODIFIED', () => {});
            
            const viewportElements = this.layoutManager.getAllViewportElements();
            
            // Add both viewports as both source and target for bidirectional sync
            viewportElements.forEach(element => {
                const viewportId = element.dataset.viewportId;
                if (viewportId) {
                    this.voiSynchronizer!.add({
                        renderingEngineId: this.renderingEngineId,
                        viewportId: viewportId
                    });
                }
            });
            
            console.log('VOI synchronization setup completed');
            
        } catch (error) {
            console.error('Error setting up VOI synchronization:', error);
        }
    }
    
    /**
     * Toggle camera synchronization on/off
     */
    public toggleCameraSync(enabled: boolean): void {
        if (enabled && !this.cameraSynchronizer) {
            this.setupCameraSynchronization();
        } else if (!enabled && this.cameraSynchronizer) {
            this.cameraSynchronizer.destroy();
            this.cameraSynchronizer = null;
        }
        
        console.log(`Camera synchronization ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Toggle VOI synchronization on/off
     */
    public toggleVOISync(enabled: boolean): void {
        if (enabled && !this.voiSynchronizer) {
            this.setupVOISynchronization();
        } else if (!enabled && this.voiSynchronizer) {
            this.voiSynchronizer.destroy();
            this.voiSynchronizer = null;
        }
        
        console.log(`VOI synchronization ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Reset both viewports to default view
     */
    public resetViewports(): void {
        try {
            const viewport1 = this.renderingEngine.getViewport('viewport-0');
            const viewport2 = this.renderingEngine.getViewport('viewport-1');
            
            if (viewport1 && 'resetCamera' in viewport1) {
                (viewport1 as any).resetCamera();
            }
            
            if (viewport2 && 'resetCamera' in viewport2) {
                (viewport2 as any).resetCamera();
            }
            
            this.renderingEngine.render();
            console.log('Viewports reset to default view');
            
        } catch (error) {
            console.error('Error resetting viewports:', error);
        }
    }
    
    /**
     * Get comparison statistics
     */
    public getComparisonStats(): any {
        try {
            const viewportElements = this.layoutManager.getAllViewportElements();
            
            return {
                totalViewports: viewportElements.length,
                syncEnabled: {
                    camera: this.cameraSynchronizer !== null,
                    voi: this.voiSynchronizer !== null
                },
                renderingEngineId: this.renderingEngineId
            };
            
        } catch (error) {
            console.error('Error getting comparison stats:', error);
            return null;
        }
    }
    
    /**
     * Clean up resources
     */
    public destroy(): void {
        try {
            // Destroy synchronizers
            if (this.cameraSynchronizer) {
                this.cameraSynchronizer.destroy();
                this.cameraSynchronizer = null;
            }
            
            if (this.voiSynchronizer) {
                this.voiSynchronizer.destroy();
                this.voiSynchronizer = null;
            }
            
            // Clean up layout manager
            this.layoutManager.destroy();
            
            console.log('SeriesComparator destroyed successfully');
            
        } catch (error) {
            console.error('Error destroying SeriesComparator:', error);
        }
    }
}

/**
 * Helper function to create mock image IDs for testing
 * @param seriesName - Name identifier for the series
 * @param imageCount - Number of images to generate
 */
export function createMockImageIds(seriesName: string, imageCount: number = 10): string[] {
    const imageIds: string[] = [];
    
    for (let i = 0; i < imageCount; i++) {
        // Create mock WADO-URI image IDs
        imageIds.push(`wadouri:mock://${seriesName}/image_${i.toString().padStart(3, '0')}.dcm`);
    }
    
    return imageIds;
}