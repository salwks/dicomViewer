import { Types, getRenderingEngine } from '@cornerstonejs/core';

interface FlipDirection {
    flipHorizontal?: boolean;
    flipVertical?: boolean;
}

export interface FlipState {
    horizontal: boolean;
    vertical: boolean;
}

export class FlipController {
    private viewport: Types.IStackViewport | null;
    private flipState: FlipState = { horizontal: false, vertical: false };
    
    constructor(viewport: Types.IStackViewport) {
        this.viewport = viewport;
    }
    
    /**
     * Toggle horizontal flip using official Cornerstone3D flip() API
     * @returns New horizontal flip state
     */
    public flipImageHorizontal(): boolean {
        if (!this.viewport) {
            console.warn('Viewport not available for horizontal flip');
            return this.flipState.horizontal;
        }
        
        try {
            // Toggle horizontal flip state
            this.flipState.horizontal = !this.flipState.horizontal;
            
            // Use official Cornerstone3D flip() method with FlipDirection
            const flipDirection: FlipDirection = {
                flipHorizontal: this.flipState.horizontal,
                flipVertical: this.flipState.vertical
            };
            
            (this.viewport as any).flip(flipDirection);
            
            console.log(`✓ Horizontal flip: ${this.flipState.horizontal ? 'ON' : 'OFF'}`);
            
            return this.flipState.horizontal;
        } catch (error) {
            console.error('❌ Error flipping horizontal:', error);
            return this.flipState.horizontal;
        }
    }
    
    /**
     * Toggle vertical flip using official Cornerstone3D flip() API
     * @returns New vertical flip state
     */
    public flipImageVertical(): boolean {
        if (!this.viewport) {
            console.warn('Viewport not available for vertical flip');
            return this.flipState.vertical;
        }
        
        try {
            // Toggle vertical flip state
            this.flipState.vertical = !this.flipState.vertical;
            
            // Use official Cornerstone3D flip() method with FlipDirection
            const flipDirection: FlipDirection = {
                flipHorizontal: this.flipState.horizontal,
                flipVertical: this.flipState.vertical
            };
            
            (this.viewport as any).flip(flipDirection);
            
            console.log(`✓ Vertical flip: ${this.flipState.vertical ? 'ON' : 'OFF'}`);
            
            return this.flipState.vertical;
        } catch (error) {
            console.error('❌ Error flipping vertical:', error);
            return this.flipState.vertical;
        }
    }
    
    /**
     * Set horizontal flip state using official flip() API
     * @param flipped - True to flip horizontally, false to reset
     * @returns The set horizontal flip state
     */
    public setHorizontalFlip(flipped: boolean): boolean {
        if (!this.viewport) {
            console.warn('Viewport not available for setting horizontal flip');
            return this.flipState.horizontal;
        }

        try {
            this.flipState.horizontal = flipped;
            
            // Use official Cornerstone3D flip() method
            const flipDirection: FlipDirection = {
                flipHorizontal: flipped,
                flipVertical: this.flipState.vertical
            };
            
            (this.viewport as any).flip(flipDirection);
            
            console.log(`✓ Horizontal flip set to: ${flipped ? 'ON' : 'OFF'}`);
            return this.flipState.horizontal;
        } catch (error) {
            console.error('❌ Error setting horizontal flip:', error);
            return this.flipState.horizontal;
        }
    }
    
    /**
     * Set vertical flip state using official flip() API
     * @param flipped - True to flip vertically, false to reset
     * @returns The set vertical flip state
     */
    public setVerticalFlip(flipped: boolean): boolean {
        if (!this.viewport) {
            console.warn('Viewport not available for setting vertical flip');
            return this.flipState.vertical;
        }

        try {
            this.flipState.vertical = flipped;
            
            // Use official Cornerstone3D flip() method
            const flipDirection: FlipDirection = {
                flipHorizontal: this.flipState.horizontal,
                flipVertical: flipped
            };
            
            (this.viewport as any).flip(flipDirection);
            
            console.log(`✓ Vertical flip set to: ${flipped ? 'ON' : 'OFF'}`);
            return this.flipState.vertical;
        } catch (error) {
            console.error('❌ Error setting vertical flip:', error);
            return this.flipState.vertical;
        }
    }
    
    /**
     * Get current flip state
     * @returns Object containing horizontal and vertical flip states
     */
    public getFlipState(): FlipState {
        return { ...this.flipState };
    }
    
    /**
     * Reset all flip orientations to normal using official flip() API
     */
    public resetOrientation(): void {
        if (!this.viewport) {
            console.warn('Viewport not available for reset orientation');
            return;
        }
        
        try {
            // Reset flip states
            this.flipState.horizontal = false;
            this.flipState.vertical = false;
            
            // Use official flip() method to reset both flip directions
            const flipDirection: FlipDirection = {
                flipHorizontal: false,
                flipVertical: false
            };
            
            (this.viewport as any).flip(flipDirection);
            
            console.log('✓ Orientation reset to normal using official flip() API');
            
        } catch (error) {
            console.error('❌ Error resetting orientation:', error);
        }
    }
    
    /**
     * Get current flip state from viewport properties (sync with official API)
     */
    public syncFlipStateFromViewport(): void {
        if (!this.viewport) {
            console.warn('Viewport not available for sync flip state');
            return;
        }
        
        try {
            const properties = this.viewport.getProperties();
            
            // Update local state to match viewport properties
            if (properties && typeof properties === 'object') {
                if ('hflip' in properties) {
                    this.flipState.horizontal = Boolean(properties.hflip);
                }
                if ('vflip' in properties) {
                    this.flipState.vertical = Boolean(properties.vflip);
                }
                
                console.log(`✓ Synced flip state from viewport - H: ${this.flipState.horizontal}, V: ${this.flipState.vertical}`);
            }
        } catch (error) {
            console.error('❌ Error syncing flip state from viewport:', error);
        }
    }
    
    /**
     * Update viewport reference and sync flip state from new viewport
     * @param viewport - New viewport instance
     */
    public updateViewport(viewport: Types.IStackViewport): void {
        this.viewport = viewport;
        
        // Sync flip state from the new viewport
        this.syncFlipStateFromViewport();
        
        console.log('✓ Viewport updated and flip state synced');
    }

}