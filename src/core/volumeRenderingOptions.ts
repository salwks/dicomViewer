import { Types } from '@cornerstonejs/core';

export interface TransferFunctionPoint {
    value: number;
    opacity: number;
    color?: Types.Point3; // RGB values [0-1]
}

export interface TransferFunction {
    points: TransferFunctionPoint[];
    colorMap?: string;
    opacityMap?: string;
}

export interface LightingModel {
    ambient: number;
    diffuse: number;
    specular: number;
    specularPower: number;
}

export interface VolumeRenderingSettings {
    // Transfer functions
    transferFunction?: TransferFunction;
    
    // Lighting
    lightingModel?: LightingModel;
    enableShading?: boolean;
    
    // Rendering algorithm
    renderingAlgorithm?: 'raycast' | 'texture' | 'isosurface';
    
    // Quality settings
    sampleDistance?: number;
    gradientOpacityScale?: number;
    interpolationType?: 'linear' | 'nearest';
    
    // Clipping
    clippingPlanes?: Types.Plane[];
    
    // Performance
    useGPU?: boolean;
    maxTextureSize?: number;
    levelOfDetail?: boolean;
}

export interface PresetVolumeSettings {
    name: string;
    description: string;
    settings: VolumeRenderingSettings;
}

export class VolumeRenderingOptionsManager {
    private presets: Map<string, PresetVolumeSettings> = new Map();
    private currentSettings: VolumeRenderingSettings = {};

    constructor() {
        this.initializeDefaultPresets();
    }

    private initializeDefaultPresets(): void {
        // CT Bone preset
        this.addPreset({
            name: 'ct_bone',
            description: 'CT Bone visualization',
            settings: {
                transferFunction: {
                    points: [
                        { value: -1000, opacity: 0.0, color: [0, 0, 0] },
                        { value: 150, opacity: 0.0, color: [0.8, 0.8, 0.6] },
                        { value: 300, opacity: 0.15, color: [1.0, 1.0, 0.9] },
                        { value: 1500, opacity: 0.9, color: [1.0, 1.0, 1.0] }
                    ]
                },
                lightingModel: {
                    ambient: 0.2,
                    diffuse: 0.7,
                    specular: 0.5,
                    specularPower: 15
                },
                enableShading: true,
                renderingAlgorithm: 'raycast',
                interpolationType: 'linear'
            }
        });

        // CT Soft Tissue preset
        this.addPreset({
            name: 'ct_soft_tissue',
            description: 'CT Soft tissue visualization',
            settings: {
                transferFunction: {
                    points: [
                        { value: -1000, opacity: 0.0, color: [0, 0, 0] },
                        { value: -500, opacity: 0.0, color: [0.3, 0.3, 0.3] },
                        { value: 40, opacity: 0.4, color: [0.8, 0.4, 0.4] },
                        { value: 150, opacity: 0.6, color: [1.0, 0.7, 0.7] }
                    ]
                },
                lightingModel: {
                    ambient: 0.3,
                    diffuse: 0.6,
                    specular: 0.3,
                    specularPower: 10
                },
                enableShading: true,
                renderingAlgorithm: 'raycast',
                interpolationType: 'linear'
            }
        });

        // MR Brain preset
        this.addPreset({
            name: 'mr_brain',
            description: 'MR Brain visualization',
            settings: {
                transferFunction: {
                    points: [
                        { value: 0, opacity: 0.0, color: [0, 0, 0] },
                        { value: 20, opacity: 0.0, color: [0.2, 0.2, 0.2] },
                        { value: 40, opacity: 0.15, color: [0.5, 0.5, 0.5] },
                        { value: 120, opacity: 0.3, color: [0.8, 0.8, 0.8] },
                        { value: 220, opacity: 0.375, color: [1.0, 1.0, 1.0] }
                    ]
                },
                lightingModel: {
                    ambient: 0.25,
                    diffuse: 0.65,
                    specular: 0.4,
                    specularPower: 12
                },
                enableShading: true,
                renderingAlgorithm: 'raycast',
                interpolationType: 'linear'
            }
        });

        // Angiography preset
        this.addPreset({
            name: 'angiography',
            description: 'Angiography visualization',
            settings: {
                transferFunction: {
                    points: [
                        { value: 0, opacity: 0.0, color: [0, 0, 0] },
                        { value: 150, opacity: 0.0, color: [0.5, 0.0, 0.0] },
                        { value: 300, opacity: 0.8, color: [1.0, 0.0, 0.0] },
                        { value: 500, opacity: 1.0, color: [1.0, 1.0, 1.0] }
                    ]
                },
                lightingModel: {
                    ambient: 0.1,
                    diffuse: 0.8,
                    specular: 0.6,
                    specularPower: 20
                },
                enableShading: true,
                renderingAlgorithm: 'raycast',
                interpolationType: 'linear'
            }
        });

        console.log('Default volume rendering presets initialized');
    }

    public addPreset(preset: PresetVolumeSettings): void {
        this.presets.set(preset.name, preset);
        console.log(`Volume rendering preset added: ${preset.name}`);
    }

    public removePreset(name: string): boolean {
        const removed = this.presets.delete(name);
        if (removed) {
            console.log(`Volume rendering preset removed: ${name}`);
        }
        return removed;
    }

    public getPreset(name: string): PresetVolumeSettings | undefined {
        return this.presets.get(name);
    }

    public getAllPresets(): PresetVolumeSettings[] {
        return Array.from(this.presets.values());
    }

    public getPresetNames(): string[] {
        return Array.from(this.presets.keys());
    }

    public applyPreset(name: string): VolumeRenderingSettings | null {
        const preset = this.presets.get(name);
        if (!preset) {
            console.warn(`Volume rendering preset not found: ${name}`);
            return null;
        }

        this.currentSettings = { ...preset.settings };
        console.log(`Applied volume rendering preset: ${name}`);
        return this.currentSettings;
    }

    public getCurrentSettings(): VolumeRenderingSettings {
        return { ...this.currentSettings };
    }

    public updateSettings(settings: Partial<VolumeRenderingSettings>): VolumeRenderingSettings {
        this.currentSettings = { ...this.currentSettings, ...settings };
        return this.currentSettings;
    }

    public resetToDefaults(): VolumeRenderingSettings {
        this.currentSettings = this.getDefaultSettings();
        return this.currentSettings;
    }

    private getDefaultSettings(): VolumeRenderingSettings {
        return {
            lightingModel: {
                ambient: 0.2,
                diffuse: 0.7,
                specular: 0.5,
                specularPower: 15
            },
            enableShading: true,
            renderingAlgorithm: 'raycast',
            interpolationType: 'linear',
            sampleDistance: 1.0,
            gradientOpacityScale: 1.0,
            useGPU: true,
            levelOfDetail: false
        };
    }

    // Transfer function utilities
    public createLinearTransferFunction(
        minValue: number,
        maxValue: number,
        minOpacity: number = 0.0,
        maxOpacity: number = 1.0,
        colorMap: 'grayscale' | 'red' | 'blue' | 'rainbow' = 'grayscale'
    ): TransferFunction {
        const points: TransferFunctionPoint[] = [];
        const steps = 10;

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const value = minValue + t * (maxValue - minValue);
            const opacity = minOpacity + t * (maxOpacity - minOpacity);
            
            let color: Types.Point3;
            switch (colorMap) {
                case 'red':
                    color = [t, 0, 0];
                    break;
                case 'blue':
                    color = [0, 0, t];
                    break;
                case 'rainbow':
                    color = this.rainbowColor(t);
                    break;
                default: // grayscale
                    color = [t, t, t];
                    break;
            }

            points.push({ value, opacity, color });
        }

        return { points, colorMap };
    }

    private rainbowColor(t: number): Types.Point3 {
        // Generate rainbow colors based on parameter t (0-1)
        const h = t * 360; // Hue
        const s = 1; // Saturation
        const v = 1; // Value

        const c = v * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = v - c;

        let r = 0, g = 0, b = 0;

        if (h >= 0 && h < 60) {
            r = c; g = x; b = 0;
        } else if (h >= 60 && h < 120) {
            r = x; g = c; b = 0;
        } else if (h >= 120 && h < 180) {
            r = 0; g = c; b = x;
        } else if (h >= 180 && h < 240) {
            r = 0; g = x; b = c;
        } else if (h >= 240 && h < 300) {
            r = x; g = 0; b = c;
        } else if (h >= 300 && h < 360) {
            r = c; g = 0; b = x;
        }

        return [r + m, g + m, b + m];
    }

    public interpolateTransferFunction(
        tf1: TransferFunction,
        tf2: TransferFunction,
        t: number // interpolation factor 0-1
    ): TransferFunction {
        // Simple interpolation between two transfer functions
        const minPoints = Math.min(tf1.points.length, tf2.points.length);
        const points: TransferFunctionPoint[] = [];

        for (let i = 0; i < minPoints; i++) {
            const p1 = tf1.points[i];
            const p2 = tf2.points[i];

            const value = p1.value + t * (p2.value - p1.value);
            const opacity = p1.opacity + t * (p2.opacity - p1.opacity);
            
            let color: Types.Point3 = [0, 0, 0];
            if (p1.color && p2.color) {
                color = [
                    p1.color[0] + t * (p2.color[0] - p1.color[0]),
                    p1.color[1] + t * (p2.color[1] - p1.color[1]),
                    p1.color[2] + t * (p2.color[2] - p1.color[2])
                ];
            }

            points.push({ value, opacity, color });
        }

        return { points };
    }

    public validateSettings(settings: VolumeRenderingSettings): boolean {
        try {
            // Validate lighting model
            if (settings.lightingModel) {
                const { ambient, diffuse, specular, specularPower } = settings.lightingModel;
                if (ambient < 0 || ambient > 1 || 
                    diffuse < 0 || diffuse > 1 || 
                    specular < 0 || specular > 1 ||
                    specularPower < 0) {
                    return false;
                }
            }

            // Validate transfer function
            if (settings.transferFunction?.points) {
                for (const point of settings.transferFunction.points) {
                    if (point.opacity < 0 || point.opacity > 1) {
                        return false;
                    }
                    if (point.color) {
                        if (point.color[0] < 0 || point.color[0] > 1 ||
                            point.color[1] < 0 || point.color[1] > 1 ||
                            point.color[2] < 0 || point.color[2] > 1) {
                            return false;
                        }
                    }
                }
            }

            return true;

        } catch (error) {
            console.error('Error validating volume rendering settings:', error);
            return false;
        }
    }
}

// Singleton instance
let volumeRenderingOptionsManager: VolumeRenderingOptionsManager | null = null;

export function getVolumeRenderingOptionsManager(): VolumeRenderingOptionsManager {
    if (!volumeRenderingOptionsManager) {
        volumeRenderingOptionsManager = new VolumeRenderingOptionsManager();
    }
    return volumeRenderingOptionsManager;
}

// Convenience functions
export function getVolumeRenderingPresets(): PresetVolumeSettings[] {
    return getVolumeRenderingOptionsManager().getAllPresets();
}

export function applyVolumeRenderingPreset(name: string): VolumeRenderingSettings | null {
    return getVolumeRenderingOptionsManager().applyPreset(name);
}

export function createCustomTransferFunction(
    points: TransferFunctionPoint[]
): TransferFunction {
    return { points };
}

export function getDefaultLightingModel(): LightingModel {
    return {
        ambient: 0.2,
        diffuse: 0.7,
        specular: 0.5,
        specularPower: 15
    };
}