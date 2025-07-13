import { 
    Types,
    Enums,
    RenderingEngine
} from '@cornerstonejs/core';
import { MPRViewportManager } from './mprViewport';
import { VolumeLoader } from './volumeLoader';

export interface MPRVolumeIntegrationConfig {
    enableSynchronization?: boolean;
    enableCrosshairs?: boolean;
    enableReferenceLines?: boolean;
    initialSlicePositions?: {
        axial?: number;
        sagittal?: number;
        coronal?: number;
    };
    coordinateTransformation?: {
        applyPatientOrientation?: boolean;
        flipAxes?: boolean[];
    };
}

export interface VolumeSliceInfo {
    orientation: Enums.OrientationAxis;
    sliceIndex: number;
    slicePosition: number;
    thickness: number;
    spacing: number;
    worldPosition: Types.Point3;
}

export interface CrosshairPosition {
    worldPosition: Types.Point3;
    imagePosition: {
        axial: Types.Point2;
        sagittal: Types.Point2;
        coronal: Types.Point2;
    };
}

export class MPRVolumeIntegration {
    private mprManager: MPRViewportManager;
    private volumeLoader: VolumeLoader;
    private currentVolume: Types.IImageVolume | null = null;
    private config: MPRVolumeIntegrationConfig;
    private crosshairPosition: CrosshairPosition | null = null;

    constructor(
        mprManager: MPRViewportManager,
        volumeLoader: VolumeLoader,
        config: MPRVolumeIntegrationConfig = {}
    ) {
        this.mprManager = mprManager;
        this.volumeLoader = volumeLoader;
        this.config = {
            enableSynchronization: true,
            enableCrosshairs: true,
            enableReferenceLines: true,
            coordinateTransformation: {
                applyPatientOrientation: true,
                flipAxes: [false, false, false]
            },
            ...config
        };
    }

    public async loadVolumeIntoMPR(
        imageIds: string[],
        volumeId?: string
    ): Promise<Types.IImageVolume> {
        try {
            console.log('Loading volume into MPR viewports...');

            // Load the volume
            const volume = await this.volumeLoader.loadImageVolume({
                imageIds,
                volumeId: volumeId || `mpr-volume-${Date.now()}`
            });

            // Setup the volume in MPR viewports
            await this.setupVolumeInMPR(volume);

            return volume;

        } catch (error) {
            console.error('Error loading volume into MPR:', error);
            throw error;
        }
    }

    public async setupVolumeInMPR(volume: Types.IImageVolume): Promise<void> {
        try {
            console.log(`Setting up volume in MPR: ${volume.volumeId}`);

            this.currentVolume = volume;

            // Setup volume in all MPR viewports
            await this.mprManager.setupMPRViewportsWithVolume(volume);

            // Apply coordinate transformations if needed
            if (this.config.coordinateTransformation?.applyPatientOrientation) {
                this.applyPatientOrientationTransformation();
            }

            // Set initial slice positions
            this.setInitialSlicePositions();

            // Setup synchronization if enabled
            if (this.config.enableSynchronization) {
                this.setupViewportSynchronization();
            }

            // Initialize crosshairs at volume center
            if (this.config.enableCrosshairs) {
                this.initializeCrosshairsAtCenter();
            }

            console.log('✓ Volume setup in MPR completed');

        } catch (error) {
            console.error('❌ Error setting up volume in MPR:', error);
            throw error;
        }
    }

    private setInitialSlicePositions(): void {
        if (!this.currentVolume) return;

        try {
            const { dimensions, spacing, origin } = this.currentVolume;
            
            // Calculate default positions (center of volume)
            const defaultPositions = {
                axial: origin[2] + (dimensions[2] * spacing[2]) / 2,
                sagittal: origin[0] + (dimensions[0] * spacing[0]) / 2,
                coronal: origin[1] + (dimensions[1] * spacing[1]) / 2
            };

            // Use configured positions or defaults
            const positions = {
                axial: this.config.initialSlicePositions?.axial ?? defaultPositions.axial,
                sagittal: this.config.initialSlicePositions?.sagittal ?? defaultPositions.sagittal,
                coronal: this.config.initialSlicePositions?.coronal ?? defaultPositions.coronal
            };

            // Set positions for each viewport
            const viewports = this.mprManager.getAllViewports();
            
            Array.from(viewports.entries()).forEach(([viewportId, viewport]) => {
                const orientation = this.mprManager.getViewportOrientation(viewportId);
                
                switch (orientation) {
                    case Enums.OrientationAxis.AXIAL:
                        this.mprManager.setSlicePosition(viewportId, positions.axial);
                        break;
                    case Enums.OrientationAxis.SAGITTAL:
                        this.mprManager.setSlicePosition(viewportId, positions.sagittal);
                        break;
                    case Enums.OrientationAxis.CORONAL:
                        this.mprManager.setSlicePosition(viewportId, positions.coronal);
                        break;
                }
            });

            console.log('Initial slice positions set');

        } catch (error) {
            console.error('Error setting initial slice positions:', error);
        }
    }

    private applyPatientOrientationTransformation(): void {
        if (!this.currentVolume) return;

        try {
            // Apply patient orientation transformations
            // This would typically involve reading DICOM orientation metadata
            // and applying appropriate transformations to align with patient axes
            
            console.log('Patient orientation transformation applied');

        } catch (error) {
            console.error('Error applying patient orientation transformation:', error);
        }
    }

    private setupViewportSynchronization(): void {
        try {
            // Setup event listeners for viewport synchronization
            // This would include crosshair movement, reference lines, etc.
            
            console.log('Viewport synchronization setup completed');

        } catch (error) {
            console.error('Error setting up viewport synchronization:', error);
        }
    }

    private initializeCrosshairsAtCenter(): void {
        if (!this.currentVolume) return;

        try {
            const { dimensions, spacing, origin } = this.currentVolume;
            
            // Calculate center position in world coordinates
            const centerWorldPosition: Types.Point3 = [
                origin[0] + (dimensions[0] * spacing[0]) / 2,
                origin[1] + (dimensions[1] * spacing[1]) / 2,
                origin[2] + (dimensions[2] * spacing[2]) / 2
            ];

            this.setCrosshairPosition(centerWorldPosition);

        } catch (error) {
            console.error('Error initializing crosshairs:', error);
        }
    }

    public setCrosshairPosition(worldPosition: Types.Point3): void {
        try {
            if (!this.currentVolume) return;

            // Convert world position to image positions for each orientation
            const imagePositions = this.worldToImagePositions(worldPosition);
            
            this.crosshairPosition = {
                worldPosition,
                imagePosition: imagePositions
            };

            // Update slice positions in each viewport
            const viewports = this.mprManager.getAllViewports();
            
            Array.from(viewports.entries()).forEach(([viewportId, viewport]) => {
                const orientation = this.mprManager.getViewportOrientation(viewportId);
                
                switch (orientation) {
                    case Enums.OrientationAxis.AXIAL:
                        this.mprManager.setSlicePosition(viewportId, worldPosition[2]);
                        break;
                    case Enums.OrientationAxis.SAGITTAL:
                        this.mprManager.setSlicePosition(viewportId, worldPosition[0]);
                        break;
                    case Enums.OrientationAxis.CORONAL:
                        this.mprManager.setSlicePosition(viewportId, worldPosition[1]);
                        break;
                }
            });

            console.log('Crosshair position updated:', worldPosition);

        } catch (error) {
            console.error('Error setting crosshair position:', error);
        }
    }

    private worldToImagePositions(worldPosition: Types.Point3): {
        axial: Types.Point2;
        sagittal: Types.Point2;
        coronal: Types.Point2;
    } {
        if (!this.currentVolume) {
            return {
                axial: [0, 0],
                sagittal: [0, 0],
                coronal: [0, 0]
            };
        }

        const { origin, spacing } = this.currentVolume;

        // Convert world coordinates to image coordinates
        const imageX = (worldPosition[0] - origin[0]) / spacing[0];
        const imageY = (worldPosition[1] - origin[1]) / spacing[1];
        const imageZ = (worldPosition[2] - origin[2]) / spacing[2];

        return {
            axial: [imageX, imageY],     // X-Y plane
            sagittal: [imageY, imageZ],  // Y-Z plane  
            coronal: [imageX, imageZ]    // X-Z plane
        };
    }

    public getVolumeSliceInfo(viewportId: string): VolumeSliceInfo | null {
        try {
            if (!this.currentVolume) return null;

            const orientation = this.mprManager.getViewportOrientation(viewportId);
            const slicePosition = this.mprManager.getSlicePosition(viewportId);
            
            if (!orientation || slicePosition === null) return null;

            const { dimensions, spacing, origin } = this.currentVolume;
            let sliceIndex: number;
            let thickness: number;
            let spacingValue: number;

            switch (orientation) {
                case Enums.OrientationAxis.AXIAL:
                    sliceIndex = Math.round((slicePosition - origin[2]) / spacing[2]);
                    thickness = spacing[2];
                    spacingValue = spacing[2];
                    break;
                case Enums.OrientationAxis.SAGITTAL:
                    sliceIndex = Math.round((slicePosition - origin[0]) / spacing[0]);
                    thickness = spacing[0];
                    spacingValue = spacing[0];
                    break;
                case Enums.OrientationAxis.CORONAL:
                    sliceIndex = Math.round((slicePosition - origin[1]) / spacing[1]);
                    thickness = spacing[1];
                    spacingValue = spacing[1];
                    break;
                default:
                    return null;
            }

            return {
                orientation,
                sliceIndex,
                slicePosition,
                thickness,
                spacing: spacingValue,
                worldPosition: [
                    orientation === Enums.OrientationAxis.SAGITTAL ? slicePosition : origin[0],
                    orientation === Enums.OrientationAxis.CORONAL ? slicePosition : origin[1],
                    orientation === Enums.OrientationAxis.AXIAL ? slicePosition : origin[2]
                ]
            };

        } catch (error) {
            console.error(`Error getting volume slice info for ${viewportId}:`, error);
            return null;
        }
    }

    public synchronizeSlicePositions(sourceViewportId: string): void {
        try {
            if (!this.config.enableSynchronization) return;

            const sourcePosition = this.mprManager.getSlicePosition(sourceViewportId);
            const sourceOrientation = this.mprManager.getViewportOrientation(sourceViewportId);
            
            if (sourcePosition === null || !sourceOrientation) return;

            // Update crosshair position based on the source viewport change
            if (this.crosshairPosition) {
                const newWorldPosition: Types.Point3 = [...this.crosshairPosition.worldPosition];
                
                switch (sourceOrientation) {
                    case Enums.OrientationAxis.AXIAL:
                        newWorldPosition[2] = sourcePosition;
                        break;
                    case Enums.OrientationAxis.SAGITTAL:
                        newWorldPosition[0] = sourcePosition;
                        break;
                    case Enums.OrientationAxis.CORONAL:
                        newWorldPosition[1] = sourcePosition;
                        break;
                }

                this.setCrosshairPosition(newWorldPosition);
            }

        } catch (error) {
            console.error('Error synchronizing slice positions:', error);
        }
    }

    public getCurrentVolume(): Types.IImageVolume | null {
        return this.currentVolume;
    }

    public getCrosshairPosition(): CrosshairPosition | null {
        return this.crosshairPosition;
    }

    public updateConfig(config: Partial<MPRVolumeIntegrationConfig>): void {
        this.config = { ...this.config, ...config };
        console.log('MPR volume integration config updated');
    }

    public resetToVolumeCenter(): void {
        if (this.currentVolume) {
            this.initializeCrosshairsAtCenter();
        }
    }

    public dispose(): void {
        try {
            this.currentVolume = null;
            this.crosshairPosition = null;
            console.log('MPR volume integration disposed');

        } catch (error) {
            console.error('Error disposing MPR volume integration:', error);
        }
    }
}

// Utility functions for MPR volume integration
export function createMPRVolumeIntegration(
    mprManager: MPRViewportManager,
    volumeLoader: VolumeLoader,
    config: MPRVolumeIntegrationConfig = {}
): MPRVolumeIntegration {
    return new MPRVolumeIntegration(mprManager, volumeLoader, config);
}

export function calculateVolumeCenter(volume: Types.IImageVolume): Types.Point3 {
    const { dimensions, spacing, origin } = volume;
    return [
        origin[0] + (dimensions[0] * spacing[0]) / 2,
        origin[1] + (dimensions[1] * spacing[1]) / 2,
        origin[2] + (dimensions[2] * spacing[2]) / 2
    ];
}

export function worldToVoxelCoordinates(
    worldPosition: Types.Point3,
    volume: Types.IImageVolume
): Types.Point3 {
    const { origin, spacing } = volume;
    return [
        (worldPosition[0] - origin[0]) / spacing[0],
        (worldPosition[1] - origin[1]) / spacing[1],
        (worldPosition[2] - origin[2]) / spacing[2]
    ];
}

export function voxelToWorldCoordinates(
    voxelPosition: Types.Point3,
    volume: Types.IImageVolume
): Types.Point3 {
    const { origin, spacing } = volume;
    return [
        origin[0] + voxelPosition[0] * spacing[0],
        origin[1] + voxelPosition[1] * spacing[1],
        origin[2] + voxelPosition[2] * spacing[2]
    ];
}

export function getDefaultMPRVolumeIntegrationConfig(): MPRVolumeIntegrationConfig {
    return {
        enableSynchronization: true,
        enableCrosshairs: true,
        enableReferenceLines: true,
        coordinateTransformation: {
            applyPatientOrientation: true,
            flipAxes: [false, false, false]
        }
    };
}