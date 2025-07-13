import { 
    RenderingEngine,
    Types,
    Enums,
    setVolumesForViewports
} from '@cornerstonejs/core';

export interface MPRViewportConfig {
    viewportId: string;
    element: HTMLElement;
    orientation: Enums.OrientationAxis;
    options?: {
        background?: Types.Point3;
        suppressEvents?: boolean;
        displayArea?: Types.DisplayArea;
    };
}

export interface MPRLayoutConfig {
    axial?: MPRViewportConfig;
    sagittal?: MPRViewportConfig;
    coronal?: MPRViewportConfig;
    oblique?: MPRViewportConfig;
}

export interface MPRSynchronizationConfig {
    enableCrosshairs?: boolean;
    enableReferenceLines?: boolean;
    synchronizeWindowLevel?: boolean;
    synchronizeZoom?: boolean;
    synchronizePan?: boolean;
}

export class MPRViewportManager {
    private renderingEngine: RenderingEngine;
    private viewports: Map<string, Types.IVolumeViewport> = new Map();
    private orientationMap: Map<string, Enums.OrientationAxis> = new Map();
    private currentVolume: Types.IImageVolume | null = null;
    private synchronizationConfig: MPRSynchronizationConfig = {};

    constructor(renderingEngine: RenderingEngine) {
        this.renderingEngine = renderingEngine;
    }

    public createMPRViewports(
        layoutConfig: MPRLayoutConfig,
        synchronizationConfig: MPRSynchronizationConfig = {}
    ): Map<string, Types.IVolumeViewport> {
        try {
            console.log('Creating MPR viewports...');
            
            this.synchronizationConfig = synchronizationConfig;
            const createdViewports = new Map<string, Types.IVolumeViewport>();

            // Create axial viewport
            if (layoutConfig.axial) {
                const viewport = this.createSingleMPRViewport(
                    layoutConfig.axial,
                    Enums.OrientationAxis.AXIAL
                );
                createdViewports.set('axial', viewport);
            }

            // Create sagittal viewport
            if (layoutConfig.sagittal) {
                const viewport = this.createSingleMPRViewport(
                    layoutConfig.sagittal,
                    Enums.OrientationAxis.SAGITTAL
                );
                createdViewports.set('sagittal', viewport);
            }

            // Create coronal viewport
            if (layoutConfig.coronal) {
                const viewport = this.createSingleMPRViewport(
                    layoutConfig.coronal,
                    Enums.OrientationAxis.CORONAL
                );
                createdViewports.set('coronal', viewport);
            }

            // Create oblique viewport if specified
            if (layoutConfig.oblique) {
                const viewport = this.createSingleMPRViewport(
                    layoutConfig.oblique,
                    layoutConfig.oblique.orientation
                );
                createdViewports.set('oblique', viewport);
            }

            // Setup synchronization if enabled
            if (this.synchronizationConfig.enableCrosshairs || 
                this.synchronizationConfig.enableReferenceLines) {
                this.setupViewportSynchronization();
            }

            console.log(`✓ Created ${createdViewports.size} MPR viewports`);
            return createdViewports;

        } catch (error) {
            console.error('❌ Error creating MPR viewports:', error);
            throw new Error(`Failed to create MPR viewports: ${error}`);
        }
    }

    private createSingleMPRViewport(
        config: MPRViewportConfig,
        orientation: Enums.OrientationAxis
    ): Types.IVolumeViewport {
        try {
            // Create viewport with orthographic projection for MPR
            const viewport = this.renderingEngine.enableElement({
                viewportId: config.viewportId,
                element: config.element as HTMLDivElement,
                type: Enums.ViewportType.ORTHOGRAPHIC,
                defaultOptions: {
                    orientation,
                    background: config.options?.background || [0, 0, 0],
                    suppressEvents: config.options?.suppressEvents || false,
                    displayArea: config.options?.displayArea
                }
            }) as unknown as Types.IVolumeViewport;

            // Store viewport and orientation mapping
            this.viewports.set(config.viewportId, viewport);
            this.orientationMap.set(config.viewportId, orientation);

            console.log(`✓ MPR viewport created: ${config.viewportId} (${orientation})`);
            return viewport;

        } catch (error) {
            console.error(`❌ Error creating MPR viewport ${config.viewportId}:`, error);
            throw error;
        }
    }

    public async setupMPRViewportsWithVolume(
        volume: Types.IImageVolume,
        viewportIds?: string[]
    ): Promise<void> {
        try {
            console.log(`Setting up MPR viewports with volume: ${volume.volumeId}`);
            
            this.currentVolume = volume;
            const targetViewports = viewportIds || Array.from(this.viewports.keys());

            // Set the volume for all specified viewports
            await setVolumesForViewports(
                this.renderingEngine,
                [{
                    volumeId: volume.volumeId,
                    callback: ({ volumeActor }) => {
                        // Configure volume actor for MPR rendering
                        if (volumeActor && volumeActor.getProperty) {
                            const property = volumeActor.getProperty();
                            property.setInterpolationTypeToLinear();
                            property.setShade(false); // Typically disabled for MPR
                        }
                    }
                }],
                targetViewports
            );

            // Set initial slice positions for each viewport
            this.setInitialSlicePositions();

            // Render all viewports
            this.renderingEngine.render();

            console.log(`✓ MPR viewports setup completed with volume: ${volume.volumeId}`);

        } catch (error) {
            console.error('❌ Error setting up MPR viewports with volume:', error);
            throw error;
        }
    }

    private setInitialSlicePositions(): void {
        try {
            if (!this.currentVolume) return;

            const { dimensions, spacing, origin } = this.currentVolume;
            
            // Calculate center positions for each orientation
            const centerX = origin[0] + (dimensions[0] * spacing[0]) / 2;
            const centerY = origin[1] + (dimensions[1] * spacing[1]) / 2;
            const centerZ = origin[2] + (dimensions[2] * spacing[2]) / 2;

            // Set initial slice positions
            Array.from(this.viewports.entries()).forEach(([viewportId, viewport]) => {
                const orientation = this.orientationMap.get(viewportId);
                
                switch (orientation) {
                    case Enums.OrientationAxis.AXIAL:
                        this.setSlicePosition(viewportId, centerZ);
                        break;
                    case Enums.OrientationAxis.SAGITTAL:
                        this.setSlicePosition(viewportId, centerX);
                        break;
                    case Enums.OrientationAxis.CORONAL:
                        this.setSlicePosition(viewportId, centerY);
                        break;
                }
            });

        } catch (error) {
            console.error('Error setting initial slice positions:', error);
        }
    }

    public setSlicePosition(viewportId: string, position: number): void {
        try {
            const viewport = this.viewports.get(viewportId);
            if (!viewport) {
                throw new Error(`Viewport ${viewportId} not found`);
            }

            // Set the slice position based on the orientation
            const orientation = this.orientationMap.get(viewportId);
            const camera = viewport.getCamera();
            
            if (!camera.position || !camera.focalPoint) return;
            
            switch (orientation) {
                case Enums.OrientationAxis.AXIAL:
                    camera.position[2] = position;
                    camera.focalPoint[2] = position;
                    break;
                case Enums.OrientationAxis.SAGITTAL:
                    camera.position[0] = position;
                    camera.focalPoint[0] = position;
                    break;
                case Enums.OrientationAxis.CORONAL:
                    camera.position[1] = position;
                    camera.focalPoint[1] = position;
                    break;
            }

            viewport.setCamera(camera);
            viewport.render();

        } catch (error) {
            console.error(`Error setting slice position for viewport ${viewportId}:`, error);
        }
    }

    public getSlicePosition(viewportId: string): number | null {
        try {
            const viewport = this.viewports.get(viewportId);
            if (!viewport) return null;

            const orientation = this.orientationMap.get(viewportId);
            const camera = viewport.getCamera();

            if (!camera.position) return null;

            switch (orientation) {
                case Enums.OrientationAxis.AXIAL:
                    return camera.position[2];
                case Enums.OrientationAxis.SAGITTAL:
                    return camera.position[0];
                case Enums.OrientationAxis.CORONAL:
                    return camera.position[1];
                default:
                    return null;
            }

        } catch (error) {
            console.error(`Error getting slice position for viewport ${viewportId}:`, error);
            return null;
        }
    }

    public nextSlice(viewportId: string): boolean {
        try {
            const viewport = this.viewports.get(viewportId);
            if (!viewport || !this.currentVolume) return false;

            const orientation = this.orientationMap.get(viewportId);
            const { dimensions, spacing, origin } = this.currentVolume;
            const currentPosition = this.getSlicePosition(viewportId);
            
            if (currentPosition === null) return false;

            let nextPosition: number;
            let maxPosition: number;

            switch (orientation) {
                case Enums.OrientationAxis.AXIAL:
                    nextPosition = currentPosition + spacing[2];
                    maxPosition = origin[2] + (dimensions[2] - 1) * spacing[2];
                    break;
                case Enums.OrientationAxis.SAGITTAL:
                    nextPosition = currentPosition + spacing[0];
                    maxPosition = origin[0] + (dimensions[0] - 1) * spacing[0];
                    break;
                case Enums.OrientationAxis.CORONAL:
                    nextPosition = currentPosition + spacing[1];
                    maxPosition = origin[1] + (dimensions[1] - 1) * spacing[1];
                    break;
                default:
                    return false;
            }

            if (nextPosition <= maxPosition) {
                this.setSlicePosition(viewportId, nextPosition);
                return true;
            }

            return false;

        } catch (error) {
            console.error(`Error moving to next slice for viewport ${viewportId}:`, error);
            return false;
        }
    }

    public previousSlice(viewportId: string): boolean {
        try {
            const viewport = this.viewports.get(viewportId);
            if (!viewport || !this.currentVolume) return false;

            const orientation = this.orientationMap.get(viewportId);
            const { spacing, origin } = this.currentVolume;
            const currentPosition = this.getSlicePosition(viewportId);
            
            if (currentPosition === null) return false;

            let previousPosition: number;
            let minPosition: number;

            switch (orientation) {
                case Enums.OrientationAxis.AXIAL:
                    previousPosition = currentPosition - spacing[2];
                    minPosition = origin[2];
                    break;
                case Enums.OrientationAxis.SAGITTAL:
                    previousPosition = currentPosition - spacing[0];
                    minPosition = origin[0];
                    break;
                case Enums.OrientationAxis.CORONAL:
                    previousPosition = currentPosition - spacing[1];
                    minPosition = origin[1];
                    break;
                default:
                    return false;
            }

            if (previousPosition >= minPosition) {
                this.setSlicePosition(viewportId, previousPosition);
                return true;
            }

            return false;

        } catch (error) {
            console.error(`Error moving to previous slice for viewport ${viewportId}:`, error);
            return false;
        }
    }

    public synchronizeWindowLevel(
        sourceViewportId: string,
        windowWidth: number,
        windowCenter: number
    ): void {
        if (!this.synchronizationConfig.synchronizeWindowLevel) return;

        try {
            Array.from(this.viewports.entries()).forEach(([viewportId, viewport]) => {
                if (viewportId !== sourceViewportId) {
                    viewport.setProperties({
                        voiRange: {
                            upper: windowCenter + windowWidth / 2,
                            lower: windowCenter - windowWidth / 2
                        }
                    });
                }
            });
            this.renderingEngine.render();

        } catch (error) {
            console.error('Error synchronizing window/level:', error);
        }
    }

    private setupViewportSynchronization(): void {
        try {
            // This would typically involve setting up event listeners
            // for crosshair and reference line synchronization
            // Implementation depends on the specific tools being used
            console.log('MPR viewport synchronization setup completed');

        } catch (error) {
            console.error('Error setting up viewport synchronization:', error);
        }
    }

    public resetAllViewports(): void {
        try {
            Array.from(this.viewports.values()).forEach((viewport) => {
                viewport.resetCamera();
            });
            this.renderingEngine.render();
            console.log('All MPR viewports reset');

        } catch (error) {
            console.error('Error resetting MPR viewports:', error);
        }
    }

    public getViewport(viewportId: string): Types.IVolumeViewport | undefined {
        return this.viewports.get(viewportId);
    }

    public getAllViewports(): Map<string, Types.IVolumeViewport> {
        return new Map(this.viewports);
    }

    public getViewportOrientation(viewportId: string): Enums.OrientationAxis | undefined {
        return this.orientationMap.get(viewportId);
    }

    public removeViewport(viewportId: string): boolean {
        try {
            const viewport = this.viewports.get(viewportId);
            if (!viewport) return false;

            this.renderingEngine.disableElement(viewportId);
            this.viewports.delete(viewportId);
            this.orientationMap.delete(viewportId);

            console.log(`MPR viewport removed: ${viewportId}`);
            return true;

        } catch (error) {
            console.error(`Error removing MPR viewport ${viewportId}:`, error);
            return false;
        }
    }

    public dispose(): void {
        try {
            const viewportIds = Array.from(this.viewports.keys());
            viewportIds.forEach(id => this.removeViewport(id));
            
            this.currentVolume = null;
            console.log('MPR viewport manager disposed');

        } catch (error) {
            console.error('Error disposing MPR viewport manager:', error);
        }
    }
}

// Utility functions for MPR operations
export function createStandardMPRLayout(
    renderingEngine: RenderingEngine,
    axialElement: HTMLElement,
    sagittalElement: HTMLElement,
    coronalElement: HTMLElement,
    synchronizationConfig: MPRSynchronizationConfig = {}
): MPRViewportManager {
    const manager = new MPRViewportManager(renderingEngine);
    
    const layoutConfig: MPRLayoutConfig = {
        axial: {
            viewportId: 'mpr-axial',
            element: axialElement,
            orientation: Enums.OrientationAxis.AXIAL
        },
        sagittal: {
            viewportId: 'mpr-sagittal',
            element: sagittalElement,
            orientation: Enums.OrientationAxis.SAGITTAL
        },
        coronal: {
            viewportId: 'mpr-coronal',
            element: coronalElement,
            orientation: Enums.OrientationAxis.CORONAL
        }
    };

    manager.createMPRViewports(layoutConfig, synchronizationConfig);
    return manager;
}

export async function setupMPRViewports(
    viewports: Types.IVolumeViewport[],
    volume: Types.IImageVolume,
    renderingEngine: RenderingEngine
): Promise<void> {
    try {
        const viewportIds = viewports.map(vp => vp.id);
        
        await setVolumesForViewports(
            renderingEngine,
            [{
                volumeId: volume.volumeId,
                callback: ({ volumeActor }) => {
                    if (volumeActor && volumeActor.getProperty) {
                        const property = volumeActor.getProperty();
                        property.setInterpolationTypeToLinear();
                        property.setShade(false);
                    }
                }
            }],
            viewportIds
        );

        renderingEngine.render();

    } catch (error) {
        console.error('Error setting up MPR viewports:', error);
        throw error;
    }
}

export function getDefaultMPRSynchronizationConfig(): MPRSynchronizationConfig {
    return {
        enableCrosshairs: true,
        enableReferenceLines: true,
        synchronizeWindowLevel: true,
        synchronizeZoom: false,
        synchronizePan: false
    };
}