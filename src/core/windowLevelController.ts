import { Types } from '@cornerstonejs/core';

export class WindowLevelController {
    private viewport: Types.IStackViewport;
    
    constructor(viewport: Types.IStackViewport) {
        this.viewport = viewport;
    }
    
    public setWindowLevel(windowWidth: number, windowCenter: number): void {
        if (!this.viewport) {
            console.warn('Viewport not available for window/level adjustment');
            return;
        }
        
        try {
            this.viewport.setProperties({
                voiRange: {
                    upper: windowCenter + windowWidth / 2,
                    lower: windowCenter - windowWidth / 2,
                },
            });
            
            this.viewport.render();
            
            console.log(`Window/Level set: W=${windowWidth}, L=${windowCenter}`);
        } catch (error) {
            console.error('Error setting window/level:', error);
        }
    }
    
    public getWindowLevel(): { windowWidth: number; windowCenter: number } | null {
        if (!this.viewport) {
            return null;
        }
        
        try {
            const properties = this.viewport.getProperties();
            if (properties.voiRange) {
                const windowWidth = properties.voiRange.upper - properties.voiRange.lower;
                const windowCenter = (properties.voiRange.upper + properties.voiRange.lower) / 2;
                
                return { windowWidth, windowCenter };
            }
        } catch (error) {
            console.error('Error getting window/level:', error);
        }
        
        return null;
    }
    
    public resetWindowLevel(): void {
        if (!this.viewport) {
            console.warn('Viewport not available for window/level reset');
            return;
        }
        
        try {
            // Try to get default values from current image
            let defaultWindowWidth = 400;
            let defaultWindowCenter = 40;
            
            try {
                const imageData = this.viewport.getImageData();
                if (imageData) {
                    // Try to access DICOM metadata if available
                    const metadata = (imageData as any).metadata || (imageData as any).imageMetaData;
                    if (metadata) {
                        defaultWindowWidth = metadata.windowWidth || metadata.WindowWidth || 400;
                        defaultWindowCenter = metadata.windowCenter || metadata.WindowCenter || 40;
                    }
                }
            } catch (metadataError) {
                console.log('Could not access image metadata, using standard defaults');
            }
            
            this.setWindowLevel(defaultWindowWidth, defaultWindowCenter);
            console.log(`Window/Level reset to defaults: W=${defaultWindowWidth}, L=${defaultWindowCenter}`);
        } catch (error) {
            console.error('Error resetting window/level:', error);
            // Final fallback
            this.setWindowLevel(400, 40);
        }
    }
    
    public adjustWindowWidth(delta: number): void {
        const current = this.getWindowLevel();
        if (current) {
            const newWindowWidth = Math.max(1, current.windowWidth + delta);
            this.setWindowLevel(newWindowWidth, current.windowCenter);
        }
    }
    
    public adjustWindowCenter(delta: number): void {
        const current = this.getWindowLevel();
        if (current) {
            const newWindowCenter = current.windowCenter + delta;
            this.setWindowLevel(current.windowWidth, newWindowCenter);
        }
    }
    
    public setViewport(viewport: Types.IStackViewport): void {
        this.viewport = viewport;
    }
}