import { getRenderingEngine, Types } from '@cornerstonejs/core';

export interface ImageState {
    imageIds: string[];
    currentImageIndex: number;
    camera?: any;
    voiRange?: any;
    properties?: any;
}

export class ImageStateManager {
    private static instance: ImageStateManager;
    private currentImageState: ImageState | null = null;
    
    public static getInstance(): ImageStateManager {
        if (!ImageStateManager.instance) {
            ImageStateManager.instance = new ImageStateManager();
        }
        return ImageStateManager.instance;
    }
    
    /**
     * Save current image state from the main viewer
     */
    public saveImageState(imageIds: string[], currentIndex: number = 0): void {
        this.currentImageState = {
            imageIds: [...imageIds],
            currentImageIndex: currentIndex
        };
        console.log(`Saved image state: ${imageIds.length} images, index ${currentIndex}`);
    }
    
    /**
     * Get current image state
     */
    public getCurrentImageState(): ImageState | null {
        return this.currentImageState;
    }
    
    /**
     * Apply image state to all multi-viewports
     */
    public async applyImageStateToAllViewports(): Promise<void> {
        if (!this.currentImageState) {
            console.log('No image state to apply');
            return;
        }
        
        try {
            const multiViewportEngine = getRenderingEngine('multi-viewport-engine');
            if (!multiViewportEngine) {
                console.warn('Multi-viewport rendering engine not found');
                return;
            }
            
            // Wait a bit longer for viewports to be fully initialized
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Get all viewport elements
            const viewportElements = document.querySelectorAll('.viewport-container[data-viewport-id]');
            
            if (viewportElements.length === 0) {
                console.log('No multi-viewport elements found');
                return;
            }
            
            console.log(`🎯 Applying image state with ${this.currentImageState.imageIds.length} images to ${viewportElements.length} viewports`);
            
            const promises: Promise<void>[] = [];
            
            viewportElements.forEach((element, index) => {
                const viewportId = (element as HTMLElement).dataset.viewportId;
                if (!viewportId) return;
                
                const promise = this.applyImageStateToViewport(multiViewportEngine, viewportId, element as HTMLElement, index);
                promises.push(promise);
            });
            
            // Wait for all viewports to load images
            await Promise.allSettled(promises);
            
            // Wait a bit before rendering to ensure all viewports are ready
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Render all viewports
            multiViewportEngine.render();
            console.log('✅ Applied image state to all multi-viewports');
            
        } catch (error) {
            console.error('❌ Error applying image state to viewports:', error);
        }
    }
    
    /**
     * Apply image state to a single viewport
     */
    private async applyImageStateToViewport(
        renderingEngine: any, 
        viewportId: string, 
        element: HTMLElement,
        viewportIndex: number
    ): Promise<void> {
        try {
            const viewport = renderingEngine.getViewport(viewportId) as Types.IStackViewport;
            if (!viewport || !('setStack' in viewport)) {
                console.warn(`❌ Invalid viewport ${viewportId} for image loading`);
                return;
            }
            
            const imageState = this.currentImageState!;
            
            // For multiple viewports, we can show different images or the same stack
            // For now, show the same stack but allow different starting indices
            let startIndex = imageState.currentImageIndex;
            
            // For demo purposes, show different images in different viewports if we have enough images
            if (imageState.imageIds.length > 1) {
                startIndex = viewportIndex % imageState.imageIds.length;
            }
            
            console.log(`📋 Loading ${imageState.imageIds.length} images to viewport ${viewportId} (starting at index: ${startIndex})`);
            
            // Set the stack with retry logic
            let attempts = 0;
            const maxAttempts = 3;
            
            while (attempts < maxAttempts) {
                try {
                    await viewport.setStack(imageState.imageIds, startIndex);
                    console.log(`✅ Successfully loaded images to viewport ${viewportId}`);
                    break;
                } catch (error) {
                    attempts++;
                    console.warn(`⚠️ Attempt ${attempts}/${maxAttempts} failed for viewport ${viewportId}:`, error);
                    if (attempts < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 200));
                    } else {
                        throw error;
                    }
                }
            }
            
            // Hide loading indicator
            const loadingIndicator = element.querySelector('.viewport-loading');
            if (loadingIndicator) {
                (loadingIndicator as HTMLElement).style.display = 'none';
            }
            
            // Show viewport label
            const viewportLabel = element.querySelector('.viewport-label');
            if (viewportLabel) {
                (viewportLabel as HTMLElement).style.display = 'block';
            }
            
        } catch (error) {
            console.error(`❌ Failed to apply image state to viewport ${viewportId}:`, error);
            
            // Show error in viewport
            const errorDiv = element.querySelector('.viewport-loading');
            if (errorDiv) {
                (errorDiv as HTMLElement).textContent = 'Failed to load images';
                (errorDiv as HTMLElement).style.color = '#ff6b6b';
            }
        }
    }
    
    /**
     * Load images to multi-viewports when files are loaded
     */
    public async loadImagesToMultiViewports(imageIds: string[], currentIndex: number = 0): Promise<void> {
        // Save the image state
        this.saveImageState(imageIds, currentIndex);
        
        // Apply to all current viewports
        await this.applyImageStateToAllViewports();
    }
    
    /**
     * Clear image state
     */
    public clearImageState(): void {
        this.currentImageState = null;
        console.log('Cleared image state');
    }
    
    /**
     * Check if we have image state
     */
    public hasImageState(): boolean {
        return this.currentImageState !== null && this.currentImageState.imageIds.length > 0;
    }
    
    /**
     * Get image count
     */
    public getImageCount(): number {
        return this.currentImageState?.imageIds.length || 0;
    }
    
    /**
     * Force reload images to all multi-viewports (for debugging)
     */
    public async forceReloadToMultiViewports(): Promise<void> {
        if (!this.hasImageState()) {
            console.warn('No image state available for force reload');
            return;
        }
        
        console.log('🔄 Force reloading images to all multi-viewports...');
        await this.applyImageStateToAllViewports();
    }
    
    /**
     * Get debug info about current state
     */
    public getDebugInfo(): any {
        return {
            hasImageState: this.hasImageState(),
            imageCount: this.getImageCount(),
            currentImageIndex: this.currentImageState?.currentImageIndex || -1,
            imageIds: this.currentImageState?.imageIds || []
        };
    }
}