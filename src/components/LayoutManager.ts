import { ViewportManager } from '../core/viewportManager';
import { Enums, Types } from '@cornerstonejs/core';
import { annotation } from '@cornerstonejs/tools';

export interface LayoutConfig {
    rows: number;
    cols: number;
    name: string;
}

export interface AnnotationStateData {
    annotationUID: string;
    toolName: string;
    data: any;
    metadata: any;
    viewportId: string;
    imageId: string;
}

export interface LayoutTransitionState {
    annotations: AnnotationStateData[];
    timestamp: string;
}

export class LayoutManager {
    private containerElement: HTMLElement;
    private viewportManager: ViewportManager;
    private currentLayout: string = '1x1';
    private viewportElements: HTMLElement[] = [];
    private layoutConfigs: Map<string, LayoutConfig> = new Map();
    private savedAnnotationState: LayoutTransitionState | null = null;
    
    constructor(containerElement: HTMLElement, viewportManager: ViewportManager) {
        this.containerElement = containerElement;
        this.viewportManager = viewportManager;
        this.initializeDefaultLayouts();
    }
    
    /**
     * Initialize default layout configurations
     */
    private initializeDefaultLayouts(): void {
        this.layoutConfigs.set('1x1', { rows: 1, cols: 1, name: '1x1' });
        this.layoutConfigs.set('2x2', { rows: 2, cols: 2, name: '2x2' });
        this.layoutConfigs.set('1x3', { rows: 1, cols: 3, name: '1x3' });
        this.layoutConfigs.set('3x1', { rows: 3, cols: 1, name: '3x1' });
        this.layoutConfigs.set('2x3', { rows: 2, cols: 3, name: '2x3' });
        this.layoutConfigs.set('3x2', { rows: 3, cols: 2, name: '3x2' });
    }
    
    /**
     * Set a new layout with optional state preservation
     * @param layout - Layout identifier (e.g., '2x2', '1x3')
     * @param preserveState - Whether to preserve viewport states during transition
     * @returns Array of created viewport elements
     */
    public setLayout(layout: string, preserveState: boolean = true): HTMLElement[] {
        console.log(`Setting layout to: ${layout} (preserve state: ${preserveState})`);
        
        // Validate layout
        if (!this.layoutConfigs.has(layout)) {
            console.warn(`Unknown layout: ${layout}. Using default 1x1 layout.`);
            layout = '1x1';
        }
        
        // Skip state preservation if switching to same layout
        if (layout === this.currentLayout) {
            console.log(`Already in ${layout} layout, skipping transition`);
            return [...this.viewportElements];
        }
        
        // Save current viewport states and annotation state if preserving
        let savedStates: any[] = [];
        let savedAnnotationState: LayoutTransitionState | null = null;
        if (preserveState && this.viewportElements.length > 0) {
            try {
                savedStates = this.saveViewportStates();
                savedAnnotationState = this.saveAnnotationState();
                this.savedAnnotationState = savedAnnotationState;
            } catch (error) {
                console.warn('Error saving viewport/annotation states:', error);
                preserveState = false; // Disable state preservation on error
            }
        }
        
        // Clear existing viewports
        this.clearViewports();
        
        const config = this.layoutConfigs.get(layout)!;
        this.currentLayout = layout;
        
        // Create grid container
        this.setupGridContainer(config);
        
        // Create viewport elements
        this.createViewportElements(config);
        
        // Restore states if preserving and we have saved states
        if (preserveState && (savedStates.length > 0 || savedAnnotationState)) {
            try {
                if (savedStates.length > 0) {
                    this.restoreViewportStates(savedStates);
                }
                if (savedAnnotationState) {
                    this.restoreAnnotationState(savedAnnotationState);
                }
            } catch (error) {
                console.warn('Error restoring viewport/annotation states:', error);
            }
        }
        
        // Clean up saved annotation state after successful restoration
        if (preserveState && savedAnnotationState) {
            setTimeout(() => {
                this.savedAnnotationState = null;
                console.log('✓ Cleaned up saved annotation state after layout transition');
            }, 500);
        }
        
        console.log(`Layout ${layout} created with ${this.viewportElements.length} viewports`);
        return [...this.viewportElements];
    }
    
    /**
     * Setup the grid container with CSS Grid
     * @param config - Layout configuration
     */
    private setupGridContainer(config: LayoutConfig): void {
        // Clear container
        this.containerElement.innerHTML = '';
        
        // Apply grid styling
        this.containerElement.style.display = 'grid';
        this.containerElement.style.gridTemplateRows = `repeat(${config.rows}, 1fr)`;
        this.containerElement.style.gridTemplateColumns = `repeat(${config.cols}, 1fr)`;
        this.containerElement.style.gap = '2px';
        this.containerElement.style.height = '100%';
        this.containerElement.style.width = '100%';
        this.containerElement.style.backgroundColor = '#333';
        this.containerElement.style.padding = '2px';
    }
    
    /**
     * Create viewport elements for the layout
     * @param config - Layout configuration
     */
    private createViewportElements(config: LayoutConfig): void {
        this.viewportElements = [];
        const totalViewports = config.rows * config.cols;
        
        for (let i = 0; i < totalViewports; i++) {
            const viewportElement = this.createSingleViewportElement(i);
            this.containerElement.appendChild(viewportElement);
            this.viewportElements.push(viewportElement);
        }
        
        // Add click handlers for viewport activation
        this.addViewportClickHandlers();
    }
    
    /**
     * Create a single viewport element
     * @param index - Viewport index
     * @returns Created viewport element
     */
    private createSingleViewportElement(index: number): HTMLElement {
        const viewportElement = document.createElement('div');
        
        // Set basic properties
        viewportElement.className = 'viewport-container';
        viewportElement.style.width = '100%';
        viewportElement.style.height = '100%';
        viewportElement.style.position = 'relative';
        viewportElement.style.backgroundColor = '#000';
        viewportElement.style.border = '1px solid #555';
        viewportElement.style.cursor = 'crosshair';
        
        // Set data attributes
        viewportElement.dataset.viewportIndex = index.toString();
        viewportElement.dataset.viewportId = `viewport-${index}`;
        
        // Add viewport label
        const label = document.createElement('div');
        label.className = 'viewport-label';
        label.textContent = `Viewport ${index + 1}`;
        label.style.position = 'absolute';
        label.style.top = '5px';
        label.style.left = '5px';
        label.style.color = '#fff';
        label.style.fontSize = '12px';
        label.style.fontFamily = 'Arial, sans-serif';
        label.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        label.style.padding = '2px 6px';
        label.style.borderRadius = '3px';
        label.style.pointerEvents = 'none';
        label.style.zIndex = '1000';
        
        // Add loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'viewport-loading';
        loadingIndicator.textContent = 'Load DICOM to view';
        loadingIndicator.style.position = 'absolute';
        loadingIndicator.style.top = '50%';
        loadingIndicator.style.left = '50%';
        loadingIndicator.style.transform = 'translate(-50%, -50%)';
        loadingIndicator.style.color = '#888';
        loadingIndicator.style.fontSize = '14px';
        loadingIndicator.style.fontFamily = 'Arial, sans-serif';
        loadingIndicator.style.textAlign = 'center';
        loadingIndicator.style.pointerEvents = 'none';
        
        viewportElement.appendChild(label);
        viewportElement.appendChild(loadingIndicator);
        
        return viewportElement;
    }
    
    /**
     * Add click handlers for viewport activation
     */
    private addViewportClickHandlers(): void {
        this.viewportElements.forEach((element, index) => {
            element.addEventListener('click', (event) => {
                this.activateViewport(index);
                event.stopPropagation();
            });
        });
    }
    
    /**
     * Activate a specific viewport
     * @param index - Viewport index to activate
     */
    public activateViewport(index: number): boolean {
        if (index < 0 || index >= this.viewportElements.length) {
            console.warn(`Invalid viewport index: ${index}, available: 0-${this.viewportElements.length - 1}`);
            return false;
        }
        
        // Remove active class from all viewports
        this.viewportElements.forEach((element) => {
            element.classList.remove('active-viewport');
            element.style.border = '1px solid #555';
        });
        
        // Add active class to selected viewport
        const activeElement = this.viewportElements[index];
        if (!activeElement) {
            console.warn(`Viewport element at index ${index} not found`);
            return false;
        }
        
        activeElement.classList.add('active-viewport');
        activeElement.style.border = '2px solid #007acc';
        
        // Set active viewport in ViewportManager if it exists
        const viewportId = activeElement.dataset.viewportId;
        if (viewportId && this.viewportManager.hasViewport(viewportId)) {
            this.viewportManager.setActiveViewport(viewportId);
        }
        
        console.log(`Activated viewport ${index + 1} (ID: ${viewportId})`);
        return true;
    }
    
    /**
     * Get a viewport element by index
     * @param index - Viewport index
     * @returns Viewport element or null if not found
     */
    public getViewportElement(index: number): HTMLElement | null {
        if (index >= 0 && index < this.viewportElements.length) {
            return this.viewportElements[index];
        }
        return null;
    }
    
    /**
     * Get all viewport elements
     * @returns Array of all viewport elements
     */
    public getAllViewportElements(): HTMLElement[] {
        return [...this.viewportElements];
    }
    
    /**
     * Get the current layout identifier
     * @returns Current layout string
     */
    public getCurrentLayout(): string {
        return this.currentLayout;
    }
    
    /**
     * Get the current layout configuration
     * @returns Current layout config
     */
    public getCurrentLayoutConfig(): LayoutConfig | null {
        return this.layoutConfigs.get(this.currentLayout) || null;
    }
    
    /**
     * Get the number of viewports in current layout
     * @returns Number of viewports
     */
    public getViewportCount(): number {
        return this.viewportElements.length;
    }
    
    /**
     * Add a custom layout configuration
     * @param name - Layout name
     * @param config - Layout configuration
     */
    public addLayoutConfig(name: string, config: LayoutConfig): void {
        this.layoutConfigs.set(name, { ...config, name });
        console.log(`Added custom layout: ${name}`);
    }
    
    /**
     * Get available layout names
     * @returns Array of layout names
     */
    public getAvailableLayouts(): string[] {
        return Array.from(this.layoutConfigs.keys());
    }
    
    /**
     * Clear all viewports and reset container
     */
    private clearViewports(): void {
        console.log('🔍 [LAYOUT_DEBUG] ===== CLEARING VIEWPORTS =====');
        console.log('🔍 [LAYOUT_DEBUG] Current layout:', this.currentLayout);
        console.log('🔍 [LAYOUT_DEBUG] Existing viewport elements:', this.viewportElements.length);
        console.log('🔍 [LAYOUT_DEBUG] Saved annotation state exists:', !!this.savedAnnotationState);
        
        // Check current annotation state before clearing
        try {
            const currentAnnotations = annotation.state.getAllAnnotations();
            console.log('🔍 [LAYOUT_DEBUG] Current annotations before clearing:', JSON.stringify(currentAnnotations, null, 2));
        } catch (error) {
            console.log('🔍 [LAYOUT_DEBUG] Could not get current annotations:', error);
        }
        
        // Only clear annotations if we don't have saved state (not during layout transition)
        if (!this.savedAnnotationState) {
            try {
                // Clear annotation state only if we're not preserving it
                console.log('🔍 [LAYOUT_DEBUG] ❌ Clearing annotation state (no preservation)...');
                annotation.state.removeAllAnnotations();
                console.log('🔍 [LAYOUT_DEBUG] Annotation state cleared');
                
                // Verify annotations were cleared
                const afterClearAnnotations = annotation.state.getAllAnnotations();
                console.log('🔍 [LAYOUT_DEBUG] Annotations after clearing:', JSON.stringify(afterClearAnnotations, null, 2));
            } catch (error) {
                console.warn('🔍 [LAYOUT_DEBUG] Error clearing annotation state:', error);
            }
        } else {
            console.log('🔍 [LAYOUT_DEBUG] ✅ Preserving annotation state during viewport clearing');
            console.log('🔍 [LAYOUT_DEBUG] Saved state contains', this.savedAnnotationState.annotations.length, 'annotations');
        }
        
        // Remove viewports from ViewportManager
        this.viewportElements.forEach((element) => {
            const viewportId = element.dataset.viewportId;
            if (viewportId && this.viewportManager.hasViewport(viewportId)) {
                this.viewportManager.removeViewport(viewportId);
                console.log(`Removed viewport: ${viewportId}`);
            }
        });
        
        // Clear viewport elements array
        this.viewportElements = [];
        
        // Clear container HTML
        this.containerElement.innerHTML = '';
        
        console.log('Viewports cleared successfully');
    }
    
    /**
     * Initialize viewports with Cornerstone3D
     * This should be called after setting a layout to create actual Cornerstone viewports
     */
    public initializeCornerstone3DViewports(): void {
        console.log('Initializing Cornerstone3D viewports...');
        
        // Wait for DOM to be properly sized
        setTimeout(() => {
            this.viewportElements.forEach((element, index) => {
                const viewportId = element.dataset.viewportId!;
                
                try {
                    // Ensure element has proper dimensions
                    const rect = element.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) {
                        console.warn(`Viewport element ${viewportId} has zero dimensions, forcing resize`);
                        // Force minimum dimensions
                        element.style.minWidth = '200px';
                        element.style.minHeight = '200px';
                    }
                    
                    // Create viewport using ViewportManager
                    const viewport = this.viewportManager.createViewport(
                        viewportId,
                        element,
                        // Default to STACK viewport type
                        Enums.ViewportType.STACK,
                        {
                            background: [0, 0, 0] as [number, number, number]
                        }
                    );
                    
                    // Hide loading indicator
                    const loadingIndicator = element.querySelector('.viewport-loading');
                    if (loadingIndicator) {
                        (loadingIndicator as HTMLElement).style.display = 'none';
                    }
                    
                    // Force resize after creation
                    if (viewport && 'resize' in viewport) {
                        try {
                            (viewport as any).resize();
                        } catch (resizeError) {
                            console.warn(`Error resizing viewport ${viewportId}:`, resizeError);
                        }
                    }
                    
                    console.log(`Initialized Cornerstone3D viewport: ${viewportId}`);
                    
                } catch (error) {
                    console.error(`Error initializing viewport ${viewportId}:`, error);
                }
            });
            
            // Activate the first viewport by default
            if (this.viewportElements.length > 0) {
                this.activateViewport(0);
            }
            
            // Force rendering engine to render all viewports
            this.viewportManager.renderAllViewports();
            
            console.log(`Initialized ${this.viewportElements.length} Cornerstone3D viewports`);
            
        }, 100); // Wait for DOM layout to complete
    }
    
    /**
     * Resize all viewports (useful for window resize events)
     */
    public resize(): void {
        console.log('Resizing layout viewports...');
        
        // Trigger Cornerstone3D viewport resize
        this.viewportElements.forEach((element) => {
            const viewportId = element.dataset.viewportId;
            if (viewportId && this.viewportManager.hasViewport(viewportId)) {
                const viewport = this.viewportManager.getViewport(viewportId);
                if (viewport && typeof viewport.resize === 'function') {
                    try {
                        viewport.resize();
                    } catch (error) {
                        console.warn(`Error resizing viewport ${viewportId}:`, error);
                    }
                }
            }
        });
        
        // Render all viewports
        this.viewportManager.renderAllViewports();
        console.log('Layout viewports resized');
    }
    
    /**
     * Get viewport element by viewport ID
     * @param viewportId - Cornerstone3D viewport ID
     * @returns Viewport element or null
     */
    public getViewportElementById(viewportId: string): HTMLElement | null {
        return this.viewportElements.find(element => 
            element.dataset.viewportId === viewportId
        ) || null;
    }
    
    /**
     * Check if layout supports given number of viewports
     * @param layoutName - Layout name to check
     * @param requiredViewports - Number of viewports needed
     * @returns True if layout can accommodate the viewports
     */
    public canAccommodateViewports(layoutName: string, requiredViewports: number): boolean {
        const config = this.layoutConfigs.get(layoutName);
        if (!config) {
            return false;
        }
        
        return (config.rows * config.cols) >= requiredViewports;
    }
    
    /**
     * Add a new viewport to the current layout dynamically
     * @param position - Optional position to insert the viewport (default: append)
     * @returns The created viewport element or null if layout is at capacity
     */
    public addViewport(position?: number): HTMLElement | null {
        const currentConfig = this.getCurrentLayoutConfig();
        if (!currentConfig) {
            console.warn('Cannot add viewport: no current layout configuration');
            return null;
        }
        
        const maxViewports = currentConfig.rows * currentConfig.cols;
        if (this.viewportElements.length >= maxViewports) {
            console.warn(`Cannot add viewport: layout ${this.currentLayout} is at maximum capacity (${maxViewports})`);
            return null;
        }
        
        // Create new viewport element
        const index = position !== undefined ? position : this.viewportElements.length;
        const viewportElement = this.createSingleViewportElement(index);
        
        // Insert at specified position or append
        if (position !== undefined && position < this.viewportElements.length) {
            // Insert at specific position
            const nextElement = this.containerElement.children[position];
            this.containerElement.insertBefore(viewportElement, nextElement);
            this.viewportElements.splice(position, 0, viewportElement);
            
            // Update indices for subsequent viewport elements
            this.updateViewportIndices();
        } else {
            // Append to end
            this.containerElement.appendChild(viewportElement);
            this.viewportElements.push(viewportElement);
        }
        
        // Add click handler for the new viewport
        viewportElement.addEventListener('click', (event) => {
            const actualIndex = this.viewportElements.indexOf(viewportElement);
            this.activateViewport(actualIndex);
            event.stopPropagation();
        });
        
        // Initialize with Cornerstone3D if needed
        const viewportId = viewportElement.dataset.viewportId!;
        try {
            const viewport = this.viewportManager.createViewport(
                viewportId,
                viewportElement,
                Enums.ViewportType.STACK,
                {
                    background: [0, 0, 0] as [number, number, number]
                }
            );
            
            // Hide loading indicator
            const loadingIndicator = viewportElement.querySelector('.viewport-loading');
            if (loadingIndicator) {
                (loadingIndicator as HTMLElement).style.display = 'none';
            }
            
            console.log(`Dynamically added viewport: ${viewportId}`);
            
        } catch (error) {
            console.error(`Error initializing dynamic viewport ${viewportId}:`, error);
        }
        
        return viewportElement;
    }
    
    /**
     * Remove a viewport from the current layout dynamically
     * @param index - Index of the viewport to remove
     * @returns True if successfully removed, false otherwise
     */
    public removeViewport(index: number): boolean {
        if (index < 0 || index >= this.viewportElements.length) {
            console.warn(`Cannot remove viewport: invalid index ${index}`);
            return false;
        }
        
        if (this.viewportElements.length <= 1) {
            console.warn('Cannot remove viewport: at least one viewport must remain');
            return false;
        }
        
        const viewportElement = this.viewportElements[index];
        const viewportId = viewportElement.dataset.viewportId!;
        
        // Remove from ViewportManager
        if (this.viewportManager.hasViewport(viewportId)) {
            this.viewportManager.removeViewport(viewportId);
            console.log(`Removed viewport from manager: ${viewportId}`);
        }
        
        // Remove from DOM
        this.containerElement.removeChild(viewportElement);
        
        // Remove from array
        this.viewportElements.splice(index, 1);
        
        // Update indices for remaining viewport elements
        this.updateViewportIndices();
        
        // If the removed viewport was active, activate another one
        const activeViewportId = this.viewportManager.getActiveViewportId();
        if (activeViewportId === viewportId) {
            // Activate the nearest available viewport
            if (this.viewportElements.length > 0) {
                // Choose the previous viewport if possible, otherwise the next one
                const newActiveIndex = Math.max(0, Math.min(index, this.viewportElements.length - 1));
                this.activateViewport(newActiveIndex);
            }
        }
        
        console.log(`Dynamically removed viewport at index ${index}: ${viewportId}`);
        return true;
    }
    
    /**
     * Remove a viewport by its viewport ID
     * @param viewportId - Cornerstone3D viewport ID
     * @returns True if successfully removed, false otherwise
     */
    public removeViewportById(viewportId: string): boolean {
        const index = this.viewportElements.findIndex(element => 
            element.dataset.viewportId === viewportId
        );
        
        if (index === -1) {
            console.warn(`Cannot remove viewport: viewport ID ${viewportId} not found`);
            return false;
        }
        
        return this.removeViewport(index);
    }
    
    /**
     * Update viewport indices and labels after dynamic changes
     */
    private updateViewportIndices(): void {
        this.viewportElements.forEach((element, index) => {
            // Update data attributes
            element.dataset.viewportIndex = index.toString();
            
            // Update viewport ID if needed
            const newViewportId = `viewport-${index}`;
            const oldViewportId = element.dataset.viewportId;
            
            if (oldViewportId !== newViewportId) {
                element.dataset.viewportId = newViewportId;
                
                // Update label
                const label = element.querySelector('.viewport-label') as HTMLElement;
                if (label) {
                    label.textContent = `Viewport ${index + 1}`;
                }
            }
        });
    }
    
    /**
     * Clone an existing viewport (creates a copy with same image/state)
     * @param sourceIndex - Index of the viewport to clone
     * @param targetPosition - Position to insert the cloned viewport
     * @returns The cloned viewport element or null if failed
     */
    public cloneViewport(sourceIndex: number, targetPosition?: number): HTMLElement | null {
        if (sourceIndex < 0 || sourceIndex >= this.viewportElements.length) {
            console.warn(`Cannot clone viewport: invalid source index ${sourceIndex}`);
            return null;
        }
        
        const sourceElement = this.viewportElements[sourceIndex];
        const sourceViewportId = sourceElement.dataset.viewportId!;
        const sourceViewport = this.viewportManager.getViewport(sourceViewportId);
        
        if (!sourceViewport) {
            console.warn(`Cannot clone viewport: source viewport ${sourceViewportId} not found`);
            return null;
        }
        
        // Add new viewport
        const newElement = this.addViewport(targetPosition);
        if (!newElement) {
            return null;
        }
        
        const newViewportId = newElement.dataset.viewportId!;
        const newViewport = this.viewportManager.getViewport(newViewportId);
        
        if (!newViewport) {
            console.warn(`Cannot clone viewport: failed to create new viewport ${newViewportId}`);
            return null;
        }
        
        try {
            // Copy camera state
            if ('getCamera' in sourceViewport && 'setCamera' in newViewport) {
                const camera = (sourceViewport as any).getCamera();
                if (camera) {
                    (newViewport as any).setCamera(camera);
                }
            }
            
            // Copy other properties if available
            if ('getProperties' in sourceViewport) {
                const properties = (sourceViewport as any).getProperties();
                if (properties && 'setProperties' in newViewport) {
                    (newViewport as any).setProperties(properties);
                }
            }
            
            // Render the cloned viewport
            newViewport.render();
            
            console.log(`Cloned viewport ${sourceViewportId} to ${newViewportId}`);
            
        } catch (error) {
            console.error(`Error cloning viewport state:`, error);
        }
        
        return newElement;
    }
    
    /**
     * Swap positions of two viewports
     * @param index1 - Index of first viewport
     * @param index2 - Index of second viewport
     * @returns True if successfully swapped, false otherwise
     */
    public swapViewports(index1: number, index2: number): boolean {
        if (index1 < 0 || index1 >= this.viewportElements.length ||
            index2 < 0 || index2 >= this.viewportElements.length ||
            index1 === index2) {
            console.warn(`Cannot swap viewports: invalid indices ${index1}, ${index2}`);
            return false;
        }
        
        const element1 = this.viewportElements[index1];
        const element2 = this.viewportElements[index2];
        
        // Swap in DOM
        const temp = document.createElement('div');
        element1.parentNode!.insertBefore(temp, element1);
        element2.parentNode!.insertBefore(element1, element2);
        temp.parentNode!.insertBefore(element2, temp);
        temp.parentNode!.removeChild(temp);
        
        // Swap in array
        [this.viewportElements[index1], this.viewportElements[index2]] = 
        [this.viewportElements[index2], this.viewportElements[index1]];
        
        // Update indices
        this.updateViewportIndices();
        
        console.log(`Swapped viewports at indices ${index1} and ${index2}`);
        return true;
    }
    
    /**
     * Get the maximum number of viewports supported by current layout
     * @returns Maximum viewport count
     */
    public getMaxViewportCount(): number {
        const config = this.getCurrentLayoutConfig();
        return config ? config.rows * config.cols : 0;
    }
    
    /**
     * Check if the layout can accommodate more viewports
     * @returns True if more viewports can be added
     */
    public canAddMoreViewports(): boolean {
        return this.viewportElements.length < this.getMaxViewportCount();
    }
    
    /**
     * Get viewport element information for debugging
     * @returns Array of viewport info objects
     */
    public getViewportInfo(): Array<{index: number, id: string, element: HTMLElement, active: boolean}> {
        return this.viewportElements.map((element, index) => ({
            index,
            id: element.dataset.viewportId || 'unknown',
            element,
            active: element.classList.contains('active-viewport')
        }));
    }
    
    /**
     * Save current annotation state before layout transition
     * @returns Saved annotation state or null if failed
     */
    private saveAnnotationState(): LayoutTransitionState | null {
        try {
            console.log('🔍 [LAYOUT_DEBUG] ===== STARTING ANNOTATION SAVE =====');
            console.log('🔍 [LAYOUT_DEBUG] Current layout:', this.currentLayout);
            console.log('🔍 [LAYOUT_DEBUG] Current viewport elements:', this.viewportElements.length);
            console.log('🔍 [LAYOUT_DEBUG] Viewport element IDs:', this.viewportElements.map(el => el.id));
            
            // Get all annotations from Cornerstone3D annotation state
            const allAnnotations = annotation.state.getAllAnnotations();
            console.log('🔍 [LAYOUT_DEBUG] Raw annotation state from Cornerstone3D:', JSON.stringify(allAnnotations, null, 2));
            const savedAnnotations: AnnotationStateData[] = [];
            
            try {
                // Handle different possible return types from getAllAnnotations
                if (Array.isArray(allAnnotations)) {
                    // If it returns an array directly
                    allAnnotations.forEach((ann: any) => {
                        if (ann && ann.annotationUID) {
                            const annotationData: AnnotationStateData = {
                                annotationUID: ann.annotationUID,
                                toolName: ann.metadata?.toolName || 'unknown',
                                data: ann.data ? JSON.parse(JSON.stringify(ann.data)) : {},
                                metadata: ann.metadata ? JSON.parse(JSON.stringify(ann.metadata)) : {},
                                viewportId: ann.metadata?.viewportId || '',
                                imageId: ann.metadata?.imageId || ''
                            };
                            savedAnnotations.push(annotationData);
                            console.log('📝 Saved annotation (array format):', annotationData.annotationUID, 'tool:', annotationData.toolName);
                        }
                    });
                } else if (allAnnotations && typeof allAnnotations === 'object') {
                    // If it returns a nested object structure, safely navigate it
                    const annotationState = allAnnotations as unknown as Record<string, any>;
                    console.log('Processing nested annotation structure. Frame keys:', Object.keys(annotationState));
                    
                    Object.keys(annotationState).forEach(frameKey => {
                        const frameData = annotationState[frameKey];
                        console.log(`Frame ${frameKey}:`, frameData ? Object.keys(frameData) : 'null');
                        
                        if (frameData && typeof frameData === 'object') {
                            Object.keys(frameData).forEach(toolName => {
                                const toolAnnotations = frameData[toolName];
                                console.log(`Tool ${toolName} has ${Array.isArray(toolAnnotations) ? toolAnnotations.length : 0} annotations`);
                                
                                if (Array.isArray(toolAnnotations)) {
                                    toolAnnotations.forEach((ann: any) => {
                                        if (ann && ann.annotationUID) {
                                            const annotationData: AnnotationStateData = {
                                                annotationUID: ann.annotationUID,
                                                toolName: toolName,
                                                data: ann.data ? JSON.parse(JSON.stringify(ann.data)) : {},
                                                metadata: ann.metadata ? JSON.parse(JSON.stringify(ann.metadata)) : {},
                                                viewportId: ann.metadata?.viewportId || '',
                                                imageId: ann.metadata?.imageId || ''
                                            };
                                            savedAnnotations.push(annotationData);
                                            console.log('📝 Saved annotation (nested format):', annotationData.annotationUID, 'tool:', annotationData.toolName, 'viewport:', annotationData.viewportId);
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            } catch (error) {
                console.warn('Error parsing annotation state structure:', error);
                // Fallback: try to get annotations using alternative method
                try {
                    const fallbackAnnotations = this.getFallbackAnnotations();
                    savedAnnotations.push(...fallbackAnnotations);
                } catch (fallbackError) {
                    console.warn('Fallback annotation retrieval also failed:', fallbackError);
                }
            }
            
            const transitionState: LayoutTransitionState = {
                annotations: savedAnnotations,
                timestamp: new Date().toISOString()
            };
            
            console.log(`✅ Successfully saved ${savedAnnotations.length} annotations for layout transition`);
            if (savedAnnotations.length > 0) {
                console.log('📋 Saved annotation details:', savedAnnotations.map(a => ({
                    uid: a.annotationUID,
                    tool: a.toolName,
                    viewport: a.viewportId
                })));
            }
            return transitionState;
            
        } catch (error) {
            console.error('❌ Error saving annotation state:', error);
            return null;
        }
    }

    /**
     * Restore annotation state after layout transition
     * @param annotationState - Saved annotation state to restore
     */
    private restoreAnnotationState(annotationState: LayoutTransitionState): void {
        try {
            if (!annotationState || !annotationState.annotations.length) {
                console.log('❌ No annotation state to restore');
                return;
            }
            
            console.log(`🔄 Restoring ${annotationState.annotations.length} annotations after layout transition...`);
            console.log('New layout:', this.currentLayout);
            console.log('New viewport elements:', this.viewportElements.length);
            console.log('📋 Annotations to restore:', annotationState.annotations.map(a => ({
                uid: a.annotationUID,
                tool: a.toolName,
                originalViewport: a.viewportId
            })));
            
            // Wait for viewports to be fully initialized
            setTimeout(() => {
                annotationState.annotations.forEach(annotationData => {
                    try {
                        // Reconstruct annotation object in Cornerstone3D format
                        const restoredAnnotation = {
                            annotationUID: annotationData.annotationUID,
                            data: annotationData.data,
                            metadata: {
                                ...annotationData.metadata,
                                toolName: annotationData.toolName
                            }
                        };
                        
                        // Map old viewport ID to new viewport ID if needed
                        const targetViewportId = this.mapViewportId(annotationData.viewportId);
                        console.log(`🔀 Mapping viewport: ${annotationData.viewportId} → ${targetViewportId}`);
                        
                        if (targetViewportId) {
                            restoredAnnotation.metadata.viewportId = targetViewportId;
                            
                            // Get the viewport element for this annotation
                            const viewportElement = this.getViewportElementById(targetViewportId);
                            if (viewportElement) {
                                try {
                                    console.log(`🔧 Attempting to add annotation ${annotationData.annotationUID} to viewport element:`, viewportElement.id || 'no-id');
                                    console.log('📄 Annotation data being restored:', restoredAnnotation);
                                    
                                    // Add annotation back to Cornerstone3D state
                                    annotation.state.addAnnotation(restoredAnnotation, viewportElement as HTMLDivElement);
                                    console.log(`✅ Successfully restored annotation ${annotationData.annotationUID} to viewport ${targetViewportId}`);
                                } catch (addError) {
                                    console.warn(`❌ Failed to add annotation ${annotationData.annotationUID}:`, addError);
                                    console.warn('Failed annotation data:', restoredAnnotation);
                                    
                                    // Try alternative restoration method
                                    try {
                                        console.log(`🔄 Trying alternative restoration for ${annotationData.annotationUID}...`);
                                        this.restoreAnnotationAlternative(annotationData, viewportElement);
                                    } catch (altError) {
                                        console.warn(`❌ Alternative restoration also failed for ${annotationData.annotationUID}:`, altError);
                                    }
                                }
                            } else {
                                console.warn(`⚠️ Viewport element not found for annotation ${annotationData.annotationUID}, trying fallback restoration`);
                                // Try fallback: restore to any available viewport
                                this.tryFallbackRestoration(annotationData);
                            }
                        } else {
                            console.warn(`⚠️ No target viewport mapped for ${annotationData.annotationUID}, trying fallback restoration`);
                            this.tryFallbackRestoration(annotationData);
                        }
                        
                    } catch (annotationError) {
                        console.warn(`❌ Error restoring annotation ${annotationData.annotationUID}:`, annotationError);
                        // Try fallback restoration as last resort
                        this.tryFallbackRestoration(annotationData);
                    }
                });
                
                // Trigger rendering to show restored annotations
                this.viewportManager.renderAllViewports();
                console.log('✓ Annotation state restoration completed');
                
            }, 200); // Give time for viewports to be fully ready
            
        } catch (error) {
            console.error('❌ Error restoring annotation state:', error);
        }
    }

    /**
     * Map old viewport ID to new viewport ID during layout transition
     * @param oldViewportId - Original viewport ID
     * @returns New viewport ID or null if not mappable
     */
    private mapViewportId(oldViewportId: string): string | null {
        console.log(`🗺️ Mapping viewport ID: ${oldViewportId}`);
        console.log('Current layout:', this.currentLayout);
        console.log('Available viewport elements:', this.viewportElements.map(el => el.dataset.viewportId));
        
        // For 1x1 layout transitions, map to the main viewport
        if (this.currentLayout === '1x1' && this.viewportElements.length > 0) {
            const result = this.viewportElements[0].dataset.viewportId || null;
            console.log(`📍 1x1 layout: mapping to first viewport: ${result}`);
            return result;
        }
        
        // For multi-viewport layouts, try to find a matching viewport
        // First, try exact match
        const exactMatch = this.viewportElements.find(el => el.dataset.viewportId === oldViewportId);
        if (exactMatch) {
            const result = exactMatch.dataset.viewportId || null;
            console.log(`🎯 Exact match found: ${result}`);
            return result;
        }
        
        // If no exact match, map to the first available viewport
        if (this.viewportElements.length > 0) {
            const result = this.viewportElements[0].dataset.viewportId || null;
            console.log(`📌 No exact match, using first viewport: ${result}`);
            return result;
        }
        
        console.log(`❌ No viewport mapping possible`);
        return null;
    }

    /**
     * Fallback method to get annotations when the main method fails
     * @returns Array of annotation state data
     */
    private getFallbackAnnotations(): AnnotationStateData[] {
        const fallbackAnnotations: AnnotationStateData[] = [];
        
        try {
            // Try alternative methods to retrieve annotations
            // Method 1: Try to get annotations from viewports directly
            this.viewportElements.forEach(element => {
                const viewportId = element.dataset.viewportId;
                if (viewportId && this.viewportManager.hasViewport(viewportId)) {
                    try {
                        // Try to get annotations for this specific viewport using the correct API
                        try {
                            // Use the same pattern as annotationManager.ts
                            const allAnnotations = annotation.state.getAllAnnotations();
                            if (allAnnotations && typeof allAnnotations === 'object') {
                                const annotationState = allAnnotations as unknown as Record<string, any>;
                                
                                Object.keys(annotationState).forEach(frameKey => {
                                    const frameData = annotationState[frameKey];
                                    if (frameData && typeof frameData === 'object') {
                                        Object.keys(frameData).forEach(toolName => {
                                            const toolAnnotations = frameData[toolName];
                                            if (Array.isArray(toolAnnotations)) {
                                                toolAnnotations.forEach((ann: any) => {
                                                    // Only include annotations for this specific viewport
                                                    if (ann && ann.annotationUID && ann.metadata?.viewportId === viewportId) {
                                                        const annotationData: AnnotationStateData = {
                                                            annotationUID: ann.annotationUID,
                                                            toolName: toolName,
                                                            data: ann.data ? JSON.parse(JSON.stringify(ann.data)) : {},
                                                            metadata: ann.metadata ? JSON.parse(JSON.stringify(ann.metadata)) : {},
                                                            viewportId: viewportId,
                                                            imageId: ann.metadata?.imageId || ''
                                                        };
                                                        fallbackAnnotations.push(annotationData);
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        } catch (apiError) {
                            console.warn(`Failed to get annotations for viewport ${viewportId} using API:`, apiError);
                        }
                    } catch (viewportError) {
                        console.warn(`Could not get annotations for viewport ${viewportId}:`, viewportError);
                    }
                }
            });
            
        } catch (error) {
            console.warn('Fallback annotation retrieval failed:', error);
        }
        
        return fallbackAnnotations;
    }

    /**
     * Alternative method to restore annotation when the main method fails
     * @param annotationData - Annotation data to restore
     * @param viewportElement - Target viewport element
     */
    private restoreAnnotationAlternative(annotationData: AnnotationStateData, viewportElement: HTMLElement): void {
        try {
            // Create a minimal annotation object that might work with different Cornerstone3D versions
            const minimalAnnotation = {
                annotationUID: annotationData.annotationUID,
                data: annotationData.data,
                metadata: {
                    toolName: annotationData.toolName,
                    viewportId: annotationData.viewportId,
                    imageId: annotationData.imageId,
                    ...annotationData.metadata
                }
            };

            // Try to add with minimal structure
            if (typeof annotation.state.addAnnotation === 'function') {
                annotation.state.addAnnotation(minimalAnnotation, viewportElement as HTMLDivElement);
                console.log(`✓ Alternative restoration succeeded for ${annotationData.annotationUID}`);
            } else {
                console.warn('addAnnotation method not available');
            }

        } catch (error) {
            console.warn(`Alternative restoration failed for ${annotationData.annotationUID}:`, error);
        }
    }

    /**
     * Try fallback restoration by attempting to restore annotation to any available viewport
     * @param annotationData - Annotation data to restore
     */
    private tryFallbackRestoration(annotationData: AnnotationStateData): void {
        console.log(`🔄 Trying fallback restoration for annotation ${annotationData.annotationUID}`);
        
        // Try to restore to the first available viewport
        if (this.viewportElements.length > 0) {
            const firstViewport = this.viewportElements[0];
            const fallbackViewportId = firstViewport.dataset.viewportId;
            
            if (fallbackViewportId) {
                try {
                    // Create annotation with fallback viewport ID
                    const fallbackAnnotation = {
                        annotationUID: annotationData.annotationUID,
                        data: annotationData.data,
                        metadata: {
                            ...annotationData.metadata,
                            toolName: annotationData.toolName,
                            viewportId: fallbackViewportId, // Use fallback viewport
                            imageId: annotationData.imageId
                        }
                    };
                    
                    console.log(`🎯 Attempting fallback restoration to viewport ${fallbackViewportId}`);
                    annotation.state.addAnnotation(fallbackAnnotation, firstViewport as HTMLDivElement);
                    console.log(`✅ Fallback restoration succeeded for ${annotationData.annotationUID}`);
                    
                } catch (fallbackError) {
                    console.warn(`❌ Fallback restoration failed for ${annotationData.annotationUID}:`, fallbackError);
                    
                    // Last resort: try to add to annotation state without viewport element
                    this.tryLastResortRestoration(annotationData);
                }
            }
        } else {
            console.warn(`❌ No viewports available for fallback restoration of ${annotationData.annotationUID}`);
        }
    }

    /**
     * Last resort restoration attempt
     * @param annotationData - Annotation data to restore
     */
    private tryLastResortRestoration(annotationData: AnnotationStateData): void {
        try {
            console.log(`🆘 Last resort restoration for annotation ${annotationData.annotationUID}`);
            
            // Try to directly manipulate annotation state (if possible)
            const basicAnnotation = {
                annotationUID: annotationData.annotationUID,
                data: annotationData.data,
                metadata: {
                    toolName: annotationData.toolName,
                    viewportId: 'viewport-0', // Default viewport ID
                    imageId: annotationData.imageId,
                    ...annotationData.metadata
                }
            };
            
            // Check if we have any viewport element available
            const anyViewport = document.querySelector('.viewport-container') as HTMLDivElement;
            if (anyViewport) {
                annotation.state.addAnnotation(basicAnnotation, anyViewport);
                console.log(`✅ Last resort restoration succeeded for ${annotationData.annotationUID}`);
            } else {
                console.warn(`❌ No viewport elements found for last resort restoration of ${annotationData.annotationUID}`);
            }
            
        } catch (error) {
            console.warn(`❌ Last resort restoration failed for ${annotationData.annotationUID}:`, error);
        }
    }

    /**
     * Save current viewport states for layout transitions
     * @returns Array of viewport state objects
     */
    private saveViewportStates(): any[] {
        const states: any[] = [];
        
        this.viewportElements.forEach((element, index) => {
            const viewportId = element.dataset.viewportId;
            if (!viewportId || !this.viewportManager.hasViewport(viewportId)) {
                return;
            }
            
            const viewport = this.viewportManager.getViewport(viewportId);
            if (!viewport) {
                return;
            }
            
            try {
                const state: any = {
                    index,
                    viewportId,
                    isActive: element.classList.contains('active-viewport')
                };
                
                // Save camera state
                if ('getCamera' in viewport) {
                    state.camera = (viewport as any).getCamera();
                }
                
                // Save properties
                if ('getProperties' in viewport) {
                    state.properties = (viewport as any).getProperties();
                }
                
                // Save viewport-specific data
                if ('getCurrentImageId' in viewport) {
                    state.imageId = (viewport as any).getCurrentImageId();
                }
                
                states.push(state);
                console.log(`Saved state for viewport ${viewportId}`);
                
            } catch (error) {
                console.warn(`Error saving state for viewport ${viewportId}:`, error);
            }
        });
        
        console.log(`Saved ${states.length} viewport states`);
        return states;
    }
    
    /**
     * Restore viewport states after layout transitions
     * @param savedStates - Array of saved viewport states
     */
    private restoreViewportStates(savedStates: any[]): void {
        console.log(`Restoring ${savedStates.length} viewport states`);
        
        // Sort states by index to restore in order
        savedStates.sort((a, b) => a.index - b.index);
        
        // Wait for viewports to be properly initialized before restoring
        setTimeout(() => {
            savedStates.forEach((state, targetIndex) => {
                // Only restore if we have enough viewports in new layout
                if (targetIndex >= this.viewportElements.length) {
                    console.warn(`Cannot restore state ${targetIndex}: not enough viewports in new layout`);
                    return;
                }
                
                const element = this.viewportElements[targetIndex];
                const newViewportId = element.dataset.viewportId;
                
                if (!newViewportId) {
                    console.warn(`Cannot restore state: no viewport ID for element at index ${targetIndex}`);
                    return;
                }
                
                // Wait for viewport to be created and registered
                const checkViewport = () => {
                    if (this.viewportManager.hasViewport(newViewportId)) {
                        const viewport = this.viewportManager.getViewport(newViewportId);
                        if (!viewport) {
                            return;
                        }
                        
                        try {
                            // Restore camera state with validation
                            if (state.camera && 'setCamera' in viewport) {
                                // Ensure camera has valid values
                                const camera = { ...state.camera };
                                if (camera.position && camera.position.length === 3) {
                                    (viewport as any).setCamera(camera);
                                }
                            }
                            
                            // Restore properties with validation
                            if (state.properties && 'setProperties' in viewport) {
                                try {
                                    (viewport as any).setProperties(state.properties);
                                } catch (propError) {
                                    console.warn(`Error setting properties for viewport ${newViewportId}:`, propError);
                                }
                            }
                            
                            // Restore active state
                            if (state.isActive) {
                                this.activateViewport(targetIndex);
                            }
                            
                            // Render the viewport
                            try {
                                viewport.render();
                                console.log(`Restored state for viewport ${newViewportId} from ${state.viewportId}`);
                            } catch (renderError) {
                                console.warn(`Error rendering viewport ${newViewportId}:`, renderError);
                            }
                            
                        } catch (error) {
                            console.warn(`Error restoring state for viewport ${newViewportId}:`, error);
                        }
                    } else {
                        // Retry after a short delay
                        setTimeout(checkViewport, 10);
                    }
                };
                
                checkViewport();
            });
        }, 50); // Give time for viewports to be created
        
        console.log('Viewport state restoration initiated');
    }
    
    /**
     * Switch layout with animation and state preservation
     * @param layout - Target layout
     * @param animated - Whether to animate the transition
     * @returns Promise that resolves when transition is complete
     */
    public async switchLayoutAnimated(layout: string, animated: boolean = true): Promise<HTMLElement[]> {
        if (!animated) {
            return this.setLayout(layout, true);
        }
        
        console.log(`Switching to layout ${layout} with animation`);
        
        // Add transition animation
        this.containerElement.style.transition = 'opacity 0.3s ease';
        this.containerElement.style.opacity = '0.5';
        
        // Wait for fade out
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Switch layout
        const result = this.setLayout(layout, true);
        
        // Fade back in
        this.containerElement.style.opacity = '1';
        
        // Remove transition after animation
        setTimeout(() => {
            this.containerElement.style.transition = '';
        }, 300);
        
        console.log(`Layout switch to ${layout} completed with animation`);
        return result;
    }
    
    /**
     * Create a custom layout configuration
     * @param name - Layout name
     * @param rows - Number of rows
     * @param cols - Number of columns
     * @returns True if successfully created
     */
    public createCustomLayout(name: string, rows: number, cols: number): boolean {
        if (rows <= 0 || cols <= 0) {
            console.warn(`Invalid layout dimensions: ${rows}x${cols}`);
            return false;
        }
        
        if (this.layoutConfigs.has(name)) {
            console.warn(`Layout ${name} already exists`);
            return false;
        }
        
        const config: LayoutConfig = { rows, cols, name };
        this.layoutConfigs.set(name, config);
        
        console.log(`Created custom layout: ${name} (${rows}x${cols})`);
        return true;
    }
    
    /**
     * Remove a custom layout configuration
     * @param name - Layout name
     * @returns True if successfully removed
     */
    public removeCustomLayout(name: string): boolean {
        // Prevent removal of default layouts
        const defaultLayouts = ['1x1', '2x2', '1x3', '3x1', '2x3', '3x2'];
        if (defaultLayouts.includes(name)) {
            console.warn(`Cannot remove default layout: ${name}`);
            return false;
        }
        
        if (!this.layoutConfigs.has(name)) {
            console.warn(`Layout ${name} not found`);
            return false;
        }
        
        // Switch to default layout if currently using the layout being removed
        if (this.currentLayout === name) {
            this.setLayout('1x1', false);
        }
        
        this.layoutConfigs.delete(name);
        console.log(`Removed custom layout: ${name}`);
        return true;
    }
    
    /**
     * Get layout switching history for undo/redo functionality
     */
    private layoutHistory: string[] = [];
    private historyIndex: number = -1;
    
    /**
     * Switch layout and add to history
     * @param layout - Target layout
     * @param preserveState - Whether to preserve viewport states
     * @returns Array of created viewport elements
     */
    public switchLayoutWithHistory(layout: string, preserveState: boolean = true): HTMLElement[] {
        // Add current layout to history if not already there
        if (this.currentLayout !== layout) {
            // Remove any future history if we're in the middle
            this.layoutHistory = this.layoutHistory.slice(0, this.historyIndex + 1);
            
            // Add current layout to history
            this.layoutHistory.push(this.currentLayout);
            this.historyIndex = this.layoutHistory.length - 1;
            
            // Limit history size
            if (this.layoutHistory.length > 10) {
                this.layoutHistory.shift();
                this.historyIndex--;
            }
        }
        
        return this.setLayout(layout, preserveState);
    }
    
    /**
     * Undo last layout change
     * @returns True if undo was performed
     */
    public undoLayoutChange(): boolean {
        if (this.historyIndex <= 0) {
            console.warn('No layout history to undo');
            return false;
        }
        
        this.historyIndex--;
        const previousLayout = this.layoutHistory[this.historyIndex];
        this.setLayout(previousLayout, true);
        
        console.log(`Undid layout change to: ${previousLayout}`);
        return true;
    }
    
    /**
     * Redo last layout change
     * @returns True if redo was performed
     */
    public redoLayoutChange(): boolean {
        if (this.historyIndex >= this.layoutHistory.length - 1) {
            console.warn('No layout history to redo');
            return false;
        }
        
        this.historyIndex++;
        const nextLayout = this.layoutHistory[this.historyIndex];
        this.setLayout(nextLayout, true);
        
        console.log(`Redid layout change to: ${nextLayout}`);
        return true;
    }
    
    /**
     * Get layout history
     * @returns Array of layout names in history
     */
    public getLayoutHistory(): string[] {
        return [...this.layoutHistory];
    }
    
    /**
     * Manually save current annotation state (useful for backup)
     * @returns Saved annotation state or null if failed
     */
    public saveCurrentAnnotationState(): LayoutTransitionState | null {
        return this.saveAnnotationState();
    }

    /**
     * Manually restore annotation state from backup
     * @param annotationState - Annotation state to restore
     * @returns True if successfully restored
     */
    public restoreAnnotationStateFromBackup(annotationState: LayoutTransitionState): boolean {
        try {
            this.restoreAnnotationState(annotationState);
            return true;
        } catch (error) {
            console.error('❌ Error restoring annotation state from backup:', error);
            return false;
        }
    }

    /**
     * Check if annotation state is currently preserved
     * @returns True if annotation state is saved for restoration
     */
    public hasPreservedAnnotationState(): boolean {
        return this.savedAnnotationState !== null;
    }

    /**
     * Get current preserved annotation state
     * @returns Preserved annotation state or null
     */
    public getPreservedAnnotationState(): LayoutTransitionState | null {
        return this.savedAnnotationState;
    }

    /**
     * Clear preserved annotation state (will prevent restoration)
     */
    public clearPreservedAnnotationState(): void {
        this.savedAnnotationState = null;
        console.log('✓ Cleared preserved annotation state');
    }

    /**
     * Force annotation state restoration if available
     * @returns True if restoration was performed
     */
    public forceAnnotationStateRestoration(): boolean {
        if (this.savedAnnotationState) {
            try {
                this.restoreAnnotationState(this.savedAnnotationState);
                this.savedAnnotationState = null;
                return true;
            } catch (error) {
                console.error('❌ Error forcing annotation state restoration:', error);
                return false;
            }
        }
        return false;
    }

    /**
     * Destroy the layout manager and clean up resources
     */
    public destroy(): void {
        console.log('Destroying LayoutManager...');
        
        // Clear preserved annotation state
        this.savedAnnotationState = null;
        
        // Clear all viewports
        this.clearViewports();
        
        // Reset container
        this.containerElement.style.display = '';
        this.containerElement.style.gridTemplateRows = '';
        this.containerElement.style.gridTemplateColumns = '';
        this.containerElement.style.gap = '';
        this.containerElement.style.height = '';
        this.containerElement.style.width = '';
        this.containerElement.style.backgroundColor = '';
        this.containerElement.style.padding = '';
        
        // Clear layouts
        this.layoutConfigs.clear();
        
        console.log('LayoutManager destroyed');
    }
}