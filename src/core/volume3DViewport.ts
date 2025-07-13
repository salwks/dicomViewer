import { 
    RenderingEngine,
    Types,
    Enums,
    setVolumesForViewports
} from '@cornerstonejs/core';

export interface Volume3DOptions {
    orientation?: Enums.OrientationAxis;
    background?: Types.Point3;
    parallelProjection?: boolean;
    suppressEvents?: boolean;
    displayArea?: Types.DisplayArea;
}

export interface VolumeRenderingProperties {
    opacity?: number;
    ambient?: number;
    diffuse?: number;
    specular?: number;
    specularPower?: number;
    shade?: boolean;
    interpolationType?: 'LINEAR' | 'NEAREST';
    colorMapId?: string;
    voiRange?: {
        lower: number;
        upper: number;
    };
}

export class Volume3DViewportManager {
    private renderingEngine: RenderingEngine;
    private viewports: Map<string, Types.IVolumeViewport> = new Map();
    private volumeActors: Map<string, any> = new Map();

    constructor(renderingEngine: RenderingEngine) {
        this.renderingEngine = renderingEngine;
    }

    public create3DViewport(
        viewportId: string,
        element: HTMLElement,
        options: Volume3DOptions = {}
    ): Types.IVolumeViewport {
        try {
            console.log(`Creating 3D viewport: ${viewportId}`);

            // Set default options
            const defaultOptions: Volume3DOptions = {
                orientation: Enums.OrientationAxis.CORONAL,
                background: [0, 0, 0],
                parallelProjection: false,
                suppressEvents: false,
                ...options
            };

            // Enable the element as a 3D volume viewport
            const viewport = this.renderingEngine.enableElement({
                viewportId,
                element: element as HTMLDivElement,
                type: Enums.ViewportType.VOLUME_3D,
                defaultOptions: {
                    orientation: defaultOptions.orientation,
                    background: defaultOptions.background
                }
            }) as unknown as Types.IVolumeViewport;

            // Store the viewport reference
            this.viewports.set(viewportId, viewport);

            console.log(`✓ 3D viewport created successfully: ${viewportId}`);
            return viewport;

        } catch (error) {
            console.error(`❌ Error creating 3D viewport ${viewportId}:`, error);
            throw new Error(`Failed to create 3D viewport: ${error}`);
        }
    }

    public async setupVolumeInViewport(
        viewportId: string,
        volume: Types.IImageVolume,
        renderingProperties: VolumeRenderingProperties = {}
    ): Promise<void> {
        try {
            const viewport = this.viewports.get(viewportId);
            if (!viewport) {
                throw new Error(`Viewport ${viewportId} not found`);
            }

            console.log(`Setting up volume in viewport: ${viewportId}`);

            // Set the volume for the viewport
            await setVolumesForViewports(
                this.renderingEngine,
                [{
                    volumeId: volume.volumeId,
                    callback: ({ volumeActor }) => {
                        this.configureVolumeActor(volumeActor, renderingProperties);
                        this.volumeActors.set(viewportId, volumeActor);
                    }
                }],
                [viewportId]
            );

            // Render the viewport
            this.renderingEngine.render();

            console.log(`✓ Volume setup completed in viewport: ${viewportId}`);

        } catch (error) {
            console.error(`❌ Error setting up volume in viewport ${viewportId}:`, error);
            throw error;
        }
    }

    private configureVolumeActor(volumeActor: any, properties: VolumeRenderingProperties): void {
        try {
            if (!volumeActor || !volumeActor.getProperty) {
                console.warn('Invalid volume actor provided');
                return;
            }

            const volumeProperty = volumeActor.getProperty();

            // Set interpolation type
            if (properties.interpolationType) {
                switch (properties.interpolationType) {
                    case 'LINEAR':
                        volumeProperty.setInterpolationTypeToLinear();
                        break;
                    case 'NEAREST':
                        volumeProperty.setInterpolationTypeToNearest();
                        break;
                }
            } else {
                volumeProperty.setInterpolationTypeToLinear(); // Default
            }

            // Set shading properties
            if (properties.shade !== undefined) {
                volumeProperty.setShade(properties.shade);
            } else {
                volumeProperty.setShade(true); // Default
            }

            if (properties.ambient !== undefined) {
                volumeProperty.setAmbient(properties.ambient);
            }

            if (properties.diffuse !== undefined) {
                volumeProperty.setDiffuse(properties.diffuse);
            }

            if (properties.specular !== undefined) {
                volumeProperty.setSpecular(properties.specular);
            } else {
                volumeProperty.setSpecular(0.5); // Default
            }

            if (properties.specularPower !== undefined) {
                volumeProperty.setSpecularPower(properties.specularPower);
            } else {
                volumeProperty.setSpecularPower(15); // Default
            }

            console.log('Volume actor configured with rendering properties');

        } catch (error) {
            console.error('Error configuring volume actor:', error);
        }
    }

    public updateVolumeRenderingProperties(
        viewportId: string,
        properties: VolumeRenderingProperties
    ): void {
        try {
            const volumeActor = this.volumeActors.get(viewportId);
            if (!volumeActor) {
                throw new Error(`Volume actor not found for viewport: ${viewportId}`);
            }

            this.configureVolumeActor(volumeActor, properties);
            this.renderingEngine.render();

            console.log(`Volume rendering properties updated for viewport: ${viewportId}`);

        } catch (error) {
            console.error(`Error updating volume properties for viewport ${viewportId}:`, error);
            throw error;
        }
    }

    public setVolumeOpacity(viewportId: string, opacity: number): void {
        try {
            const viewport = this.viewports.get(viewportId);
            if (!viewport) {
                throw new Error(`Viewport ${viewportId} not found`);
            }

            // Clamp opacity between 0 and 1
            const clampedOpacity = Math.max(0, Math.min(1, opacity));

            // Update volume opacity
            const volumeActor = this.volumeActors.get(viewportId);
            if (volumeActor && volumeActor.getProperty) {
                volumeActor.getProperty().setOpacity(clampedOpacity);
                this.renderingEngine.render();
                console.log(`Volume opacity set to ${clampedOpacity} for viewport: ${viewportId}`);
            }

        } catch (error) {
            console.error(`Error setting volume opacity for viewport ${viewportId}:`, error);
        }
    }

    public setVolumeWindowLevel(
        viewportId: string,
        windowWidth: number,
        windowCenter: number
    ): void {
        try {
            const viewport = this.viewports.get(viewportId);
            if (!viewport) {
                throw new Error(`Viewport ${viewportId} not found`);
            }

            // Set window/level for the viewport
            viewport.setProperties({
                voiRange: {
                    upper: windowCenter + windowWidth / 2,
                    lower: windowCenter - windowWidth / 2
                }
            });

            this.renderingEngine.render();
            console.log(`Window/Level set for viewport ${viewportId}: W=${windowWidth}, C=${windowCenter}`);

        } catch (error) {
            console.error(`Error setting window/level for viewport ${viewportId}:`, error);
        }
    }

    public resetViewportCamera(viewportId: string): void {
        try {
            const viewport = this.viewports.get(viewportId);
            if (!viewport) {
                throw new Error(`Viewport ${viewportId} not found`);
            }

            viewport.resetCamera();
            this.renderingEngine.render();
            console.log(`Camera reset for viewport: ${viewportId}`);

        } catch (error) {
            console.error(`Error resetting camera for viewport ${viewportId}:`, error);
        }
    }

    public setViewportOrientation(
        viewportId: string,
        orientation: Enums.OrientationAxis
    ): void {
        try {
            const viewport = this.viewports.get(viewportId);
            if (!viewport) {
                throw new Error(`Viewport ${viewportId} not found`);
            }

            // Set the orientation
            viewport.setOrientation(orientation);
            this.renderingEngine.render();
            console.log(`Orientation set for viewport ${viewportId}: ${orientation}`);

        } catch (error) {
            console.error(`Error setting orientation for viewport ${viewportId}:`, error);
        }
    }

    public getViewport(viewportId: string): Types.IVolumeViewport | undefined {
        return this.viewports.get(viewportId);
    }

    public getAllViewports(): Types.IVolumeViewport[] {
        return Array.from(this.viewports.values());
    }

    public getViewportIds(): string[] {
        return Array.from(this.viewports.keys());
    }

    public removeViewport(viewportId: string): boolean {
        try {
            const viewport = this.viewports.get(viewportId);
            if (!viewport) {
                return false;
            }

            // Disable the element
            this.renderingEngine.disableElement(viewportId);

            // Clean up references
            this.viewports.delete(viewportId);
            this.volumeActors.delete(viewportId);

            console.log(`Viewport removed: ${viewportId}`);
            return true;

        } catch (error) {
            console.error(`Error removing viewport ${viewportId}:`, error);
            return false;
        }
    }

    public dispose(): void {
        try {
            // Remove all viewports
            const viewportIds = Array.from(this.viewports.keys());
            viewportIds.forEach(id => this.removeViewport(id));

            console.log('Volume 3D viewport manager disposed');

        } catch (error) {
            console.error('Error disposing volume 3D viewport manager:', error);
        }
    }
}

// Utility functions for 3D viewport operations
export function create3DViewport(
    renderingEngine: RenderingEngine,
    viewportId: string,
    element: HTMLElement,
    options: Volume3DOptions = {}
): Types.IVolumeViewport {
    const manager = new Volume3DViewportManager(renderingEngine);
    return manager.create3DViewport(viewportId, element, options);
}

export async function setupVolumeViewport(
    viewport: Types.IVolumeViewport,
    volume: Types.IImageVolume,
    renderingEngine: RenderingEngine,
    renderingProperties: VolumeRenderingProperties = {}
): Promise<void> {
    try {
        await setVolumesForViewports(
            renderingEngine,
            [{
                volumeId: volume.volumeId,
                callback: ({ volumeActor }) => {
                    if (volumeActor && volumeActor.getProperty) {
                        const property = volumeActor.getProperty();
                        
                        // Apply rendering properties
                        if (renderingProperties.interpolationType === 'LINEAR') {
                            property.setInterpolationTypeToLinear();
                        } else if (renderingProperties.interpolationType === 'NEAREST') {
                            property.setInterpolationTypeToNearest();
                        } else {
                            property.setInterpolationTypeToLinear();
                        }

                        property.setShade(renderingProperties.shade !== false);
                        property.setSpecular(renderingProperties.specular ?? 0.5);
                        property.setSpecularPower(renderingProperties.specularPower ?? 15);
                        property.setAmbient(renderingProperties.ambient ?? 0.2);
                        property.setDiffuse(renderingProperties.diffuse ?? 0.7);
                    }
                }
            }],
            [viewport.id]
        );

        renderingEngine.render();

    } catch (error) {
        console.error('Error setting up volume viewport:', error);
        throw error;
    }
}

export function getDefaultVolumeRenderingProperties(): VolumeRenderingProperties {
    return {
        opacity: 1.0,
        ambient: 0.2,
        diffuse: 0.7,
        specular: 0.5,
        specularPower: 15,
        shade: true,
        interpolationType: 'LINEAR'
    };
}