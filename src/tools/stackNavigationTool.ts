import { 
    StackScrollTool,
    Enums as ToolEnums
} from '@cornerstonejs/tools';
import { Types, getRenderingEngine } from '@cornerstonejs/core';

export interface StackNavigationConfig {
    loop?: boolean;
    skipDistance?: number;
    mouseWheelEnabled?: boolean;
    keyboardEnabled?: boolean;
    touchEnabled?: boolean;
}

export class StackNavigationTool {
    private static instance: StackNavigationTool;
    private config: StackNavigationConfig = {
        loop: false,
        skipDistance: 1,
        mouseWheelEnabled: true,
        keyboardEnabled: true,
        touchEnabled: true
    };
    private onImageChangedCallbacks: ((imageIndex: number, imageId: string) => void)[] = [];
    
    public static getInstance(): StackNavigationTool {
        if (!StackNavigationTool.instance) {
            StackNavigationTool.instance = new StackNavigationTool();
        }
        return StackNavigationTool.instance;
    }
    
    /**
     * Initialize stack navigation tool with configuration
     * @param config - Navigation configuration
     */
    public initialize(config: Partial<StackNavigationConfig> = {}): void {
        this.config = { ...this.config, ...config };
        console.log('Stack navigation tool initialized with config:', this.config);
    }
    
    /**
     * Enable stack navigation for a viewport
     * @param element - Viewport element
     * @param toolGroupId - Tool group ID
     * @param options - Additional options
     */
    public enableStackNavigation(element: HTMLElement, toolGroupId: string, options: any = {}): boolean {
        try {
            // The StackScrollTool should already be added to the tool group
            // We just need to configure it for this specific viewport
            
            const viewportId = element.dataset.viewportId;
            if (!viewportId) {
                console.warn('Viewport element missing data-viewport-id');
                return false;
            }
            
            // Add keyboard event listeners if enabled
            if (this.config.keyboardEnabled) {
                this.addKeyboardListeners(element, viewportId);
            }
            
            // Add mouse wheel listeners if enabled
            if (this.config.mouseWheelEnabled) {
                this.addMouseWheelListeners(element, viewportId);
            }
            
            // Add touch listeners if enabled
            if (this.config.touchEnabled) {
                this.addTouchListeners(element, viewportId);
            }
            
            console.log(`Stack navigation enabled for viewport ${viewportId}`);
            return true;
            
        } catch (error) {
            console.error('Error enabling stack navigation:', error);
            return false;
        }
    }
    
    /**
     * Navigate to next image in the stack
     * @param viewportId - Viewport ID
     * @returns True if navigation successful
     */
    public navigateToNextImage(viewportId: string): boolean {
        return this.navigateByDelta(viewportId, this.config.skipDistance || 1);
    }
    
    /**
     * Navigate to previous image in the stack
     * @param viewportId - Viewport ID
     * @returns True if navigation successful
     */
    public navigateToPreviousImage(viewportId: string): boolean {
        return this.navigateByDelta(viewportId, -(this.config.skipDistance || 1));
    }
    
    /**
     * Jump to specific image index
     * @param viewportId - Viewport ID
     * @param imageIndex - Target image index
     * @returns True if navigation successful
     */
    public jumpToImage(viewportId: string, imageIndex: number): boolean {
        try {
            const renderingEngine = this.getRenderingEngineForViewport(viewportId);
            if (!renderingEngine) return false;
            
            const viewport = renderingEngine.getViewport(viewportId) as Types.IStackViewport;
            if (!viewport || !('setImageIdIndex' in viewport)) {
                console.warn(`Invalid stack viewport: ${viewportId}`);
                return false;
            }
            
            const imageIds = viewport.getImageIds();
            if (!imageIds || imageIds.length === 0) {
                console.warn(`No images in viewport ${viewportId}`);
                return false;
            }
            
            // Ensure index is within bounds
            const validIndex = Math.max(0, Math.min(imageIndex, imageIds.length - 1));
            
            // Set the current index
            viewport.setImageIdIndex(validIndex);
            
            // Render the viewport
            viewport.render();
            
            // Notify callbacks
            this.notifyImageChanged(validIndex, imageIds[validIndex]);
            
            console.log(`Jumped to image ${validIndex} in viewport ${viewportId}`);
            return true;
            
        } catch (error) {
            console.error(`Error jumping to image ${imageIndex} in viewport ${viewportId}:`, error);
            return false;
        }
    }
    
    /**
     * Navigate by delta (positive for forward, negative for backward)
     * @param viewportId - Viewport ID
     * @param delta - Number of images to move
     * @returns True if navigation successful
     */
    private navigateByDelta(viewportId: string, delta: number): boolean {
        try {
            const renderingEngine = this.getRenderingEngineForViewport(viewportId);
            if (!renderingEngine) return false;
            
            const viewport = renderingEngine.getViewport(viewportId) as Types.IStackViewport;
            if (!viewport || !('getCurrentImageIdIndex' in viewport)) {
                console.warn(`Invalid stack viewport: ${viewportId}`);
                return false;
            }
            
            const imageIds = viewport.getImageIds();
            if (!imageIds || imageIds.length === 0) {
                console.warn(`No images in viewport ${viewportId}`);
                return false;
            }
            
            const currentIndex = viewport.getCurrentImageIdIndex();
            let newIndex = currentIndex + delta;
            
            // Handle looping
            if (this.config.loop) {
                if (newIndex >= imageIds.length) {
                    newIndex = 0;
                } else if (newIndex < 0) {
                    newIndex = imageIds.length - 1;
                }
            } else {
                // Clamp to bounds
                newIndex = Math.max(0, Math.min(newIndex, imageIds.length - 1));
            }
            
            // Check if we actually moved
            if (newIndex === currentIndex) {
                return false; // No movement occurred
            }
            
            return this.jumpToImage(viewportId, newIndex);
            
        } catch (error) {
            console.error(`Error navigating by delta ${delta} in viewport ${viewportId}:`, error);
            return false;
        }
    }
    
    /**
     * Get current image index for a viewport
     * @param viewportId - Viewport ID
     * @returns Current image index or -1 if error
     */
    public getCurrentImageIndex(viewportId: string): number {
        try {
            const renderingEngine = this.getRenderingEngineForViewport(viewportId);
            if (!renderingEngine) return -1;
            
            const viewport = renderingEngine.getViewport(viewportId) as Types.IStackViewport;
            if (!viewport || !('getCurrentImageIdIndex' in viewport)) {
                return -1;
            }
            
            return viewport.getCurrentImageIdIndex();
            
        } catch (error) {
            console.error(`Error getting current image index for viewport ${viewportId}:`, error);
            return -1;
        }
    }
    
    /**
     * Get total number of images in the stack
     * @param viewportId - Viewport ID
     * @returns Number of images or 0 if error
     */
    public getImageCount(viewportId: string): number {
        try {
            const renderingEngine = this.getRenderingEngineForViewport(viewportId);
            if (!renderingEngine) return 0;
            
            const viewport = renderingEngine.getViewport(viewportId) as Types.IStackViewport;
            if (!viewport || !('getImageIds' in viewport)) {
                return 0;
            }
            
            const imageIds = viewport.getImageIds();
            return imageIds ? imageIds.length : 0;
            
        } catch (error) {
            console.error(`Error getting image count for viewport ${viewportId}:`, error);
            return 0;
        }
    }
    
    /**
     * Check if can navigate to next image
     * @param viewportId - Viewport ID
     * @returns True if can navigate next
     */
    public canNavigateNext(viewportId: string): boolean {
        const currentIndex = this.getCurrentImageIndex(viewportId);
        const imageCount = this.getImageCount(viewportId);
        
        if (currentIndex === -1 || imageCount === 0) return false;
        
        return this.config.loop || currentIndex < imageCount - 1;
    }
    
    /**
     * Check if can navigate to previous image
     * @param viewportId - Viewport ID
     * @returns True if can navigate previous
     */
    public canNavigatePrevious(viewportId: string): boolean {
        const currentIndex = this.getCurrentImageIndex(viewportId);
        const imageCount = this.getImageCount(viewportId);
        
        if (currentIndex === -1 || imageCount === 0) return false;
        
        return this.config.loop || currentIndex > 0;
    }
    
    /**
     * Add keyboard event listeners
     * @param element - Viewport element
     * @param viewportId - Viewport ID
     */
    private addKeyboardListeners(element: HTMLElement, viewportId: string): void {
        const handleKeyDown = (event: KeyboardEvent) => {
            switch (event.key) {
                case 'ArrowUp':
                case 'ArrowRight':
                case 'PageDown':
                    event.preventDefault();
                    this.navigateToNextImage(viewportId);
                    break;
                case 'ArrowDown':
                case 'ArrowLeft':
                case 'PageUp':
                    event.preventDefault();
                    this.navigateToPreviousImage(viewportId);
                    break;
                case 'Home':
                    event.preventDefault();
                    this.jumpToImage(viewportId, 0);
                    break;
                case 'End':
                    event.preventDefault();
                    const imageCount = this.getImageCount(viewportId);
                    if (imageCount > 0) {
                        this.jumpToImage(viewportId, imageCount - 1);
                    }
                    break;
            }
        };
        
        element.addEventListener('keydown', handleKeyDown);
        element.setAttribute('tabindex', '0'); // Make element focusable
    }
    
    /**
     * Add mouse wheel event listeners
     * @param element - Viewport element
     * @param viewportId - Viewport ID
     */
    private addMouseWheelListeners(element: HTMLElement, viewportId: string): void {
        const handleWheel = (event: WheelEvent) => {
            event.preventDefault();
            
            const delta = event.deltaY > 0 ? 1 : -1;
            this.navigateByDelta(viewportId, delta);
        };
        
        element.addEventListener('wheel', handleWheel, { passive: false });
    }
    
    /**
     * Add touch event listeners for mobile navigation
     * @param element - Viewport element
     * @param viewportId - Viewport ID
     */
    private addTouchListeners(element: HTMLElement, viewportId: string): void {
        let startY = 0;
        let startTime = 0;
        
        const handleTouchStart = (event: TouchEvent) => {
            if (event.touches.length === 1) {
                startY = event.touches[0].clientY;
                startTime = Date.now();
            }
        };
        
        const handleTouchEnd = (event: TouchEvent) => {
            if (event.changedTouches.length === 1) {
                const endY = event.changedTouches[0].clientY;
                const endTime = Date.now();
                const deltaY = endY - startY;
                const deltaTime = endTime - startTime;
                
                // Check for swipe gesture (minimum distance and maximum time)
                if (Math.abs(deltaY) > 50 && deltaTime < 300) {
                    event.preventDefault();
                    
                    if (deltaY > 0) {
                        this.navigateToPreviousImage(viewportId);
                    } else {
                        this.navigateToNextImage(viewportId);
                    }
                }
            }
        };
        
        element.addEventListener('touchstart', handleTouchStart, { passive: true });
        element.addEventListener('touchend', handleTouchEnd, { passive: false });
    }
    
    /**
     * Get rendering engine for a viewport
     * @param viewportId - Viewport ID
     * @returns Rendering engine or null
     */
    private getRenderingEngineForViewport(viewportId: string): any {
        // Try multi-viewport engine first
        let renderingEngine = getRenderingEngine('multi-viewport-engine');
        
        if (renderingEngine) {
            try {
                renderingEngine.getViewport(viewportId);
                return renderingEngine;
            } catch (error) {
                // Viewport not found in multi-viewport engine
            }
        }
        
        // Try main viewport engine
        renderingEngine = getRenderingEngine('dicom-viewer');
        if (renderingEngine) {
            try {
                renderingEngine.getViewport(viewportId);
                return renderingEngine;
            } catch (error) {
                // Viewport not found in main engine
            }
        }
        
        console.warn(`No rendering engine found for viewport ${viewportId}`);
        return null;
    }
    
    /**
     * Add callback for image change events
     * @param callback - Callback function
     */
    public onImageChanged(callback: (imageIndex: number, imageId: string) => void): void {
        this.onImageChangedCallbacks.push(callback);
    }
    
    /**
     * Remove callback for image change events
     * @param callback - Callback function to remove
     */
    public removeImageChangedCallback(callback: (imageIndex: number, imageId: string) => void): void {
        const index = this.onImageChangedCallbacks.indexOf(callback);
        if (index !== -1) {
            this.onImageChangedCallbacks.splice(index, 1);
        }
    }
    
    /**
     * Notify all callbacks of image change
     * @param imageIndex - New image index
     * @param imageId - New image ID
     */
    private notifyImageChanged(imageIndex: number, imageId: string): void {
        this.onImageChangedCallbacks.forEach(callback => {
            try {
                callback(imageIndex, imageId);
            } catch (error) {
                console.error('Error in image changed callback:', error);
            }
        });
    }
    
    /**
     * Update configuration
     * @param config - New configuration
     */
    public updateConfig(config: Partial<StackNavigationConfig>): void {
        this.config = { ...this.config, ...config };
        console.log('Stack navigation config updated:', this.config);
    }
    
    /**
     * Get current configuration
     * @returns Current configuration
     */
    public getConfig(): StackNavigationConfig {
        return { ...this.config };
    }
    
    /**
     * Get navigation info for a viewport
     * @param viewportId - Viewport ID
     * @returns Navigation info
     */
    public getNavigationInfo(viewportId: string): any {
        const currentIndex = this.getCurrentImageIndex(viewportId);
        const imageCount = this.getImageCount(viewportId);
        
        return {
            currentIndex: currentIndex,
            imageCount: imageCount,
            canNavigateNext: this.canNavigateNext(viewportId),
            canNavigatePrevious: this.canNavigatePrevious(viewportId),
            isFirstImage: currentIndex === 0,
            isLastImage: currentIndex === imageCount - 1,
            progress: imageCount > 0 ? ((currentIndex + 1) / imageCount) * 100 : 0
        };
    }
}

// Export convenience functions for backward compatibility
export function navigateToNextImage(viewportId: string): boolean {
    return StackNavigationTool.getInstance().navigateToNextImage(viewportId);
}

export function navigateToPreviousImage(viewportId: string): boolean {
    return StackNavigationTool.getInstance().navigateToPreviousImage(viewportId);
}

export function jumpToImage(viewportId: string, imageIndex: number): boolean {
    return StackNavigationTool.getInstance().jumpToImage(viewportId, imageIndex);
}

export function getCurrentImageIndex(viewportId: string): number {
    return StackNavigationTool.getInstance().getCurrentImageIndex(viewportId);
}

export function getImageCount(viewportId: string): number {
    return StackNavigationTool.getInstance().getImageCount(viewportId);
}