import { volumeLoader } from '@cornerstonejs/core';

export interface VolumeLoaderConfig {
    scheme: string;
    loader: (volumeId: string, options: any) => Promise<any>;
    options?: any;
}

export interface VolumeLoaderRegistryConfig {
    enableStreamingImageVolumeLoader?: boolean;
    enableNiftiVolumeLoader?: boolean;
    enableCustomLoaders?: VolumeLoaderConfig[];
    defaultOptions?: {
        useSharedArrayBuffer?: boolean;
        targetBufferType?: 'Float32Array' | 'Uint16Array' | 'Uint8Array';
    };
}

export class VolumeLoaderRegistry {
    private static instance: VolumeLoaderRegistry;
    private registeredLoaders: Map<string, VolumeLoaderConfig> = new Map();
    private isInitialized: boolean = false;

    public static getInstance(): VolumeLoaderRegistry {
        if (!VolumeLoaderRegistry.instance) {
            VolumeLoaderRegistry.instance = new VolumeLoaderRegistry();
        }
        return VolumeLoaderRegistry.instance;
    }

    public async initialize(config: VolumeLoaderRegistryConfig = {}): Promise<void> {
        if (this.isInitialized) {
            console.log('Volume loader registry already initialized');
            return;
        }

        try {
            console.log('Initializing volume loader registry...');

            // Register streaming image volume loader
            if (config.enableStreamingImageVolumeLoader !== false) {
                await this.registerStreamingImageVolumeLoader();
            }

            // Register NIFTI volume loader
            if (config.enableNiftiVolumeLoader !== false) {
                await this.registerNiftiVolumeLoader();
            }

            // Register custom loaders if provided
            if (config.enableCustomLoaders && config.enableCustomLoaders.length > 0) {
                for (const loaderConfig of config.enableCustomLoaders) {
                    this.registerCustomLoader(loaderConfig);
                }
            }

            this.isInitialized = true;
            console.log('✓ Volume loader registry initialized successfully');

        } catch (error) {
            console.error('❌ Error initializing volume loader registry:', error);
            throw new Error(`Volume loader registry initialization failed: ${error}`);
        }
    }

    private async registerStreamingImageVolumeLoader(): Promise<void> {
        try {
            console.log('⚠️ Streaming image volume loader registration skipped (optional dependency)');
            // Skip registration for now as it requires additional dependencies
            // In a real implementation, this would be properly configured
        } catch (error) {
            console.warn('⚠️ Failed to register streaming image volume loader:', error);
        }
    }

    private async registerNiftiVolumeLoader(): Promise<void> {
        try {
            console.log('⚠️ NIFTI volume loader registration skipped (optional dependency)');
            // Skip registration for now as it requires additional dependencies
            // In a real implementation, this would be properly configured
        } catch (error) {
            console.warn('⚠️ Failed to register NIFTI volume loader:', error);
        }
    }

    public registerCustomLoader(config: VolumeLoaderConfig): void {
        try {
            // Create a wrapper function that returns the correct format
            const loaderWrapper = (volumeId: string, options: any) => {
                const result = config.loader(volumeId, options);
                return {
                    promise: result,
                    cancelFn: undefined,
                    decache: undefined
                };
            };
            
            // Register with Cornerstone3D
            volumeLoader.registerVolumeLoader(config.scheme, loaderWrapper as any);
            
            // Store in our registry
            this.registeredLoaders.set(config.scheme, config);
            
            console.log(`✓ Custom volume loader registered: ${config.scheme}`);

        } catch (error) {
            console.error(`❌ Failed to register custom volume loader ${config.scheme}:`, error);
            throw error;
        }
    }

    public unregisterLoader(scheme: string): boolean {
        try {
            // Remove from our registry
            const removed = this.registeredLoaders.delete(scheme);
            
            if (removed) {
                console.log(`✓ Volume loader unregistered: ${scheme}`);
            } else {
                console.warn(`⚠️ Volume loader not found: ${scheme}`);
            }
            
            return removed;

        } catch (error) {
            console.error(`❌ Error unregistering volume loader ${scheme}:`, error);
            return false;
        }
    }

    public getRegisteredLoaders(): string[] {
        return Array.from(this.registeredLoaders.keys());
    }

    public getLoaderConfig(scheme: string): VolumeLoaderConfig | undefined {
        return this.registeredLoaders.get(scheme);
    }

    public isLoaderRegistered(scheme: string): boolean {
        return this.registeredLoaders.has(scheme);
    }

    public getLoaderForImageId(imageId: string): VolumeLoaderConfig | undefined {
        // Determine appropriate loader based on image ID scheme
        for (const [scheme, config] of Array.from(this.registeredLoaders.entries())) {
            if (imageId.startsWith(scheme + ':') || this.matchesLoaderPattern(imageId, scheme)) {
                return config;
            }
        }
        return undefined;
    }

    private matchesLoaderPattern(imageId: string, scheme: string): boolean {
        // Custom pattern matching for different schemes
        switch (scheme) {
            case 'nifti':
                return imageId.toLowerCase().includes('.nii') || 
                       imageId.toLowerCase().includes('.nifti');
            
            case 'cornerstoneStreamingImageVolume':
                return imageId.startsWith('wadouri:') || 
                       imageId.startsWith('wadors:') || 
                       imageId.startsWith('dicomweb:');
            
            default:
                return false;
        }
    }

    public reset(): void {
        this.registeredLoaders.clear();
        this.isInitialized = false;
        console.log('Volume loader registry reset');
    }

    public getStatus(): {
        isInitialized: boolean;
        registeredLoaders: string[];
        loaderCount: number;
    } {
        return {
            isInitialized: this.isInitialized,
            registeredLoaders: this.getRegisteredLoaders(),
            loaderCount: this.registeredLoaders.size
        };
    }
}

// Factory function for creating volume loaders with specific configurations
export function createVolumeLoaderFactory(
    defaultConfig: VolumeLoaderRegistryConfig = {}
) {
    return {
        async initializeLoaders(config: VolumeLoaderRegistryConfig = {}) {
            const registry = VolumeLoaderRegistry.getInstance();
            const mergedConfig = { ...defaultConfig, ...config };
            await registry.initialize(mergedConfig);
            return registry;
        },

        getRegistry() {
            return VolumeLoaderRegistry.getInstance();
        },

        async registerCustomLoader(config: VolumeLoaderConfig) {
            const registry = VolumeLoaderRegistry.getInstance();
            if (!registry.getStatus().isInitialized) {
                await registry.initialize();
            }
            registry.registerCustomLoader(config);
        }
    };
}

// Convenience functions
export async function initializeVolumeLoaders(
    config: VolumeLoaderRegistryConfig = {}
): Promise<VolumeLoaderRegistry> {
    const registry = VolumeLoaderRegistry.getInstance();
    await registry.initialize(config);
    return registry;
}

export function getVolumeLoaderRegistry(): VolumeLoaderRegistry {
    return VolumeLoaderRegistry.getInstance();
}

export function getSupportedVolumeFormats(): string[] {
    const registry = VolumeLoaderRegistry.getInstance();
    return registry.getRegisteredLoaders();
}

export function isVolumeFormatSupported(imageId: string): boolean {
    const registry = VolumeLoaderRegistry.getInstance();
    return !!registry.getLoaderForImageId(imageId);
}

// Default configuration for common setups
export const DEFAULT_VOLUME_LOADER_CONFIG: VolumeLoaderRegistryConfig = {
    enableStreamingImageVolumeLoader: true,
    enableNiftiVolumeLoader: true,
    defaultOptions: {
        useSharedArrayBuffer: true,
        targetBufferType: 'Float32Array'
    }
};

export const MINIMAL_VOLUME_LOADER_CONFIG: VolumeLoaderRegistryConfig = {
    enableStreamingImageVolumeLoader: true,
    enableNiftiVolumeLoader: false,
    defaultOptions: {
        useSharedArrayBuffer: false,
        targetBufferType: 'Uint16Array'
    }
};