import { init as cornerstoneInit } from '@cornerstonejs/core';
import { init as cornerstoneToolsInit } from '@cornerstonejs/tools';
import { 
    initializeDICOMImageLoader, 
    DICOMImageLoaderConfig 
} from './imageLoader';
import { setupRenderingEngine } from './renderingEngine';
import { BasicDicomViewer } from '../components/BasicDicomViewer';

export interface Cornerstone3DConfig {
    dicomImageLoader?: DICOMImageLoaderConfig;
    renderingEngine?: {
        id?: string;
        useSharedArrayBuffer?: boolean;
        strictZSpacingForVolumeViewport?: boolean;
    };
}

export async function initializeCornerstone3D(config: Cornerstone3DConfig = {}): Promise<void> {
    try {
        console.log('Starting Cornerstone3D initialization...');
        
        // Step 1: Initialize Cornerstone3D Core
        await cornerstoneInit();
        console.log('✓ Cornerstone3D Core initialized');
        
        // Step 2: Initialize Tools
        cornerstoneToolsInit();
        console.log('✓ Cornerstone Tools initialized');
        
        // Step 3: Initialize DICOM image loader with configuration
        initializeDICOMImageLoader(config.dicomImageLoader);
        console.log('✓ DICOM Image Loader initialized');
        
        console.log('🎉 Cornerstone3D initialization complete');
        
    } catch (error) {
        console.error('❌ Error initializing Cornerstone3D:', error);
        throw new Error(`Cornerstone3D initialization failed: ${error}`);
    }
}

export function createDicomViewer(
    element: HTMLElement,
    options: {
        viewportId?: string;
        renderingEngineId?: string;
        enableTools?: boolean;
    } = {}
): BasicDicomViewer {
    try {
        console.log('Creating DICOM viewer...');
        
        const viewer = new BasicDicomViewer(element, options);
        
        console.log('✓ DICOM viewer created successfully');
        return viewer;
        
    } catch (error) {
        console.error('❌ Error creating DICOM viewer:', error);
        throw new Error(`Failed to create DICOM viewer: ${error}`);
    }
}

export async function initializeApplication(config: Cornerstone3DConfig = {}): Promise<void> {
    try {
        console.log('🚀 Initializing Medical Image Viewer Application...');
        
        // Initialize Cornerstone3D
        await initializeCornerstone3D(config);
        
        // Setup default rendering engine if needed
        if (config.renderingEngine?.id) {
            setupRenderingEngine(config.renderingEngine.id, {
                useSharedArrayBuffer: config.renderingEngine.useSharedArrayBuffer,
                strictZSpacingForVolumeViewport: config.renderingEngine.strictZSpacingForVolumeViewport
            });
            console.log(`✓ Default rendering engine '${config.renderingEngine.id}' created`);
        }
        
        console.log('🎉 Application initialization complete');
        
    } catch (error) {
        console.error('❌ Application initialization failed:', error);
        throw error;
    }
}

// Utility functions for common tasks
export { setupRenderingEngine } from './renderingEngine';
export { 
    initializeViewport, 
    createStackViewport, 
    createOrthographicViewport,
    create3DViewport,
    resetViewport 
} from './viewport';
export { 
    loadDicomImage, 
    loadDicomImages,
    createDICOMImageIds,
    cleanupImageIds 
} from './imageLoader';
export { ImageLoadingManager } from './imageLoadingManager';
export { BasicDicomViewer } from '../components/BasicDicomViewer';