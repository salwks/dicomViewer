import { Types } from '@cornerstonejs/core';

export class RotationController {
    private viewport: Types.IStackViewport | null;
    private currentRotation: number = 0;
    
    constructor(viewport: Types.IStackViewport) {
        this.viewport = viewport;
    }
    
    /**
     * Rotate the image by the specified degrees
     * @param degrees - Rotation angle in degrees (positive = clockwise)
     * @returns The new total rotation angle
     */
    public rotateImage(degrees: number): number {
        if (!this.viewport) {
            console.warn('Viewport not available for rotation');
            return this.currentRotation;
        }
        
        try {
            // Update current rotation
            this.currentRotation = (this.currentRotation + degrees) % 360;
            
            // Apply rotation using camera manipulation
            this.applyRotation(this.currentRotation);
            
            this.viewport.render();
            console.log(`Rotated by ${degrees}°, total rotation: ${this.currentRotation}°`);
            
            return this.currentRotation;
        } catch (error) {
            console.error('Error rotating image:', error);
            return this.currentRotation;
        }
    }
    
    /**
     * Set absolute rotation angle
     * @param degrees - Absolute rotation angle in degrees
     * @returns The set rotation angle
     */
    public setRotation(degrees: number): number {
        if (!this.viewport) {
            console.warn('Viewport not available for setting rotation');
            return this.currentRotation;
        }
        
        try {
            this.currentRotation = degrees % 360;
            this.applyRotation(this.currentRotation);
            this.viewport.render();
            
            console.log(`Set rotation to: ${this.currentRotation}°`);
            return this.currentRotation;
        } catch (error) {
            console.error('Error setting rotation:', error);
            return this.currentRotation;
        }
    }
    
    /**
     * Get current rotation angle
     * @returns Current rotation in degrees
     */
    public getRotation(): number {
        return this.currentRotation;
    }
    
    /**
     * Reset rotation to 0 degrees
     */
    public resetRotation(): void {
        this.setRotation(0);
    }
    
    /**
     * Rotate clockwise by 90 degrees
     */
    public rotateClockwise(): number {
        return this.rotateImage(90);
    }
    
    /**
     * Rotate counter-clockwise by 90 degrees
     */
    public rotateCounterClockwise(): number {
        return this.rotateImage(-90);
    }
    
    /**
     * Apply rotation transformation to the viewport camera
     * @param degrees - Total rotation angle in degrees
     */
    private applyRotation(degrees: number): void {
        if (!this.viewport) return;
        
        try {
            const camera = this.viewport.getCamera();
            if (!camera || !camera.viewUp || camera.viewUp.length < 3) {
                console.warn('Invalid camera state for rotation');
                return;
            }
            
            const radians = (degrees * Math.PI) / 180;
            const cos = Math.cos(radians);
            const sin = Math.sin(radians);
            
            // Create rotation matrix for 2D rotation around Z-axis
            // (assuming we're rotating in the image plane)
            const rotationMatrix = [
                [cos, -sin, 0],
                [sin, cos, 0],
                [0, 0, 1]
            ];
            
            // Get original camera vectors
            const originalViewUp = [1, 0, 0]; // Default view up vector
            const originalViewRight = [0, 1, 0]; // Default view right vector
            
            // Apply rotation to view up vector
            const newViewUp: [number, number, number] = [
                rotationMatrix[0][0] * originalViewUp[0] + rotationMatrix[0][1] * originalViewUp[1] + rotationMatrix[0][2] * originalViewUp[2],
                rotationMatrix[1][0] * originalViewUp[0] + rotationMatrix[1][1] * originalViewUp[1] + rotationMatrix[1][2] * originalViewUp[2],
                rotationMatrix[2][0] * originalViewUp[0] + rotationMatrix[2][1] * originalViewUp[1] + rotationMatrix[2][2] * originalViewUp[2]
            ];
            
            // Update camera with new view up vector
            const newCamera = {
                ...camera,
                viewUp: newViewUp
            };
            
            this.viewport.setCamera(newCamera);
            
        } catch (error) {
            console.error('Error applying rotation transformation:', error);
        }
    }
    
    /**
     * Update viewport reference (useful when viewport changes)
     * @param viewport - New viewport instance
     */
    public updateViewport(viewport: Types.IStackViewport): void {
        this.viewport = viewport;
    }
}