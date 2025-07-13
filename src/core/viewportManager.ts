import { RenderingEngine, Types, Enums } from '@cornerstonejs/core';

export interface ViewportInfo {
    id: string;
    viewport: Types.IViewport;
    element: HTMLElement;
    type: Enums.ViewportType;
    isActive: boolean;
}

export class ViewportManager {
    private renderingEngine: RenderingEngine;
    private viewports: Map<string, ViewportInfo> = new Map();
    private activeViewportId: string | null = null;
    
    constructor(renderingEngine: RenderingEngine) {
        this.renderingEngine = renderingEngine;
    }
    
    /**
     * Create a new viewport
     * @param viewportId - Unique identifier for the viewport
     * @param element - HTML element to render the viewport in
     * @param type - Type of viewport (STACK, ORTHOGRAPHIC, VOLUME_3D, etc.)
     * @param options - Additional viewport options
     * @returns The created viewport
     */
    public createViewport(
        viewportId: string, 
        element: HTMLElement, 
        type: Enums.ViewportType = Enums.ViewportType.STACK, 
        options: any = {}
    ): Types.IViewport {
        // Check if viewport already exists
        if (this.viewports.has(viewportId)) {
            console.warn(`Viewport ${viewportId} already exists`);
            return this.viewports.get(viewportId)!.viewport;
        }
        
        try {
            // Ensure element has proper dimensions before creating viewport
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
                console.warn(`Element for viewport ${viewportId} has zero dimensions (${rect.width}x${rect.height}), setting minimum size`);
                element.style.minWidth = '200px';
                element.style.minHeight = '200px';
                element.style.width = '100%';
                element.style.height = '100%';
                
                // Force layout recalculation
                element.offsetHeight;
            }
            
            // Create the viewport
            this.renderingEngine.enableElement({
                viewportId,
                type,
                element: element as HTMLDivElement,
                defaultOptions: {
                    background: [0, 0, 0] as Types.Point3,
                    orientation: Enums.OrientationAxis.AXIAL,
                    ...options
                }
            });
            
            // Get the created viewport
            const viewport = this.renderingEngine.getViewport(viewportId);
            
            // Store viewport information
            const viewportInfo: ViewportInfo = {
                id: viewportId,
                viewport,
                element,
                type,
                isActive: false
            };
            
            this.viewports.set(viewportId, viewportInfo);
            
            // Set as active if it's the first viewport
            if (this.viewports.size === 1) {
                this.setActiveViewport(viewportId);
            }
            
            console.log(`Viewport ${viewportId} created successfully`);
            return viewport;
            
        } catch (error) {
            console.error(`Error creating viewport ${viewportId}:`, error);
            throw error;
        }
    }
    
    /**
     * Get a viewport by ID
     * @param viewportId - The viewport ID
     * @returns The viewport or null if not found
     */
    public getViewport(viewportId: string): Types.IViewport | null {
        const viewportInfo = this.viewports.get(viewportId);
        return viewportInfo ? viewportInfo.viewport : null;
    }
    
    /**
     * Get viewport information by ID
     * @param viewportId - The viewport ID
     * @returns The viewport info or null if not found
     */
    public getViewportInfo(viewportId: string): ViewportInfo | null {
        return this.viewports.get(viewportId) || null;
    }
    
    /**
     * Get all viewports
     * @returns Array of all viewport instances
     */
    public getAllViewports(): Types.IViewport[] {
        return Array.from(this.viewports.values()).map(info => info.viewport);
    }
    
    /**
     * Get all viewport information
     * @returns Array of all viewport info objects
     */
    public getAllViewportInfos(): ViewportInfo[] {
        return Array.from(this.viewports.values());
    }
    
    /**
     * Remove a viewport
     * @param viewportId - The viewport ID to remove
     * @returns True if successfully removed, false otherwise
     */
    public removeViewport(viewportId: string): boolean {
        const viewportInfo = this.viewports.get(viewportId);
        if (!viewportInfo) {
            console.warn(`Viewport ${viewportId} not found for removal`);
            return false;
        }
        
        try {
            // Disable the element in the rendering engine
            this.renderingEngine.disableElement(viewportId);
            
            // Remove from our registry
            this.viewports.delete(viewportId);
            
            // If this was the active viewport, set a new active viewport
            if (this.activeViewportId === viewportId) {
                const remainingViewports = Array.from(this.viewports.keys());
                this.activeViewportId = remainingViewports.length > 0 ? remainingViewports[0] : null;
                
                if (this.activeViewportId) {
                    this.setActiveViewport(this.activeViewportId);
                }
            }
            
            console.log(`Viewport ${viewportId} removed successfully`);
            return true;
            
        } catch (error) {
            console.error(`Error removing viewport ${viewportId}:`, error);
            return false;
        }
    }
    
    /**
     * Remove all viewports
     */
    public removeAllViewports(): void {
        const viewportIds = Array.from(this.viewports.keys());
        viewportIds.forEach(id => this.removeViewport(id));
        this.activeViewportId = null;
        console.log('All viewports removed');
    }
    
    /**
     * Reset all viewports to their default camera state
     */
    public resetAllViewports(): void {
        this.viewports.forEach((viewportInfo) => {
            try {
                viewportInfo.viewport.resetCamera();
                viewportInfo.viewport.render();
            } catch (error) {
                console.error(`Error resetting viewport ${viewportInfo.id}:`, error);
            }
        });
        console.log('All viewports reset');
    }
    
    /**
     * Set the active viewport
     * @param viewportId - The viewport ID to make active
     * @returns True if successfully set, false otherwise
     */
    public setActiveViewport(viewportId: string): boolean {
        const viewportInfo = this.viewports.get(viewportId);
        if (!viewportInfo) {
            console.warn(`Cannot set active viewport: ${viewportId} not found`);
            return false;
        }
        
        // Deactivate all viewports
        this.viewports.forEach((info) => {
            info.isActive = false;
            info.element.classList.remove('active-viewport');
        });
        
        // Activate the selected viewport
        viewportInfo.isActive = true;
        viewportInfo.element.classList.add('active-viewport');
        this.activeViewportId = viewportId;
        
        console.log(`Active viewport set to: ${viewportId}`);
        return true;
    }
    
    /**
     * Get the currently active viewport
     * @returns The active viewport or null if none is active
     */
    public getActiveViewport(): Types.IViewport | null {
        if (!this.activeViewportId) {
            return null;
        }
        return this.getViewport(this.activeViewportId);
    }
    
    /**
     * Get the active viewport ID
     * @returns The active viewport ID or null
     */
    public getActiveViewportId(): string | null {
        return this.activeViewportId;
    }
    
    /**
     * Check if a viewport exists
     * @param viewportId - The viewport ID to check
     * @returns True if the viewport exists, false otherwise
     */
    public hasViewport(viewportId: string): boolean {
        return this.viewports.has(viewportId);
    }
    
    /**
     * Get the number of viewports
     * @returns The count of viewports
     */
    public getViewportCount(): number {
        return this.viewports.size;
    }
    
    /**
     * Render all viewports
     */
    public renderAllViewports(): void {
        try {
            this.renderingEngine.render();
        } catch (error) {
            console.error('Error rendering all viewports:', error);
        }
    }
    
    /**
     * Get viewport IDs
     * @returns Array of all viewport IDs
     */
    public getViewportIds(): string[] {
        return Array.from(this.viewports.keys());
    }
    
    /**
     * Update viewport options
     * @param viewportId - The viewport ID
     * @param options - New options to apply
     * @returns True if successful, false otherwise
     */
    public updateViewportOptions(viewportId: string, options: any): boolean {
        const viewport = this.getViewport(viewportId);
        if (!viewport) {
            console.warn(`Cannot update options: viewport ${viewportId} not found`);
            return false;
        }
        
        try {
            // For Cornerstone3D, we need to update camera properties or other viewport-specific properties
            // The exact method depends on the viewport type and what properties we're updating
            if ('setCamera' in viewport && options.camera) {
                viewport.setCamera(options.camera);
            }
            if ('setProperties' in viewport) {
                (viewport as any).setProperties(options);
            }
            viewport.render();
            return true;
        } catch (error) {
            console.error(`Error updating viewport ${viewportId} options:`, error);
            return false;
        }
    }
    
    /**
     * Get the rendering engine
     * @returns The rendering engine instance
     */
    public getRenderingEngine(): RenderingEngine {
        return this.renderingEngine;
    }
}