import { Types, getRenderingEngine } from '@cornerstonejs/core';

export interface ReferenceLineOptions {
    color?: string;
    lineWidth?: number;
    dashPattern?: number[];
    showCrosshairs?: boolean;
    showCoordinates?: boolean;
}

export class CustomReferenceLines {
    private static instance: CustomReferenceLines;
    private isActive: boolean = false;
    private options: ReferenceLineOptions = {
        color: '#ffff00',
        lineWidth: 2,
        dashPattern: [4, 4],
        showCrosshairs: true,
        showCoordinates: true
    };
    private overlayElements: Map<string, HTMLElement> = new Map();
    
    public static getInstance(): CustomReferenceLines {
        if (!CustomReferenceLines.instance) {
            CustomReferenceLines.instance = new CustomReferenceLines();
        }
        return CustomReferenceLines.instance;
    }
    
    /**
     * Activate custom reference lines
     */
    public activate(options?: Partial<ReferenceLineOptions>): void {
        if (options) {
            this.options = { ...this.options, ...options };
        }
        
        this.isActive = true;
        this.addReferenceLinesToAllViewports();
        this.addEventListeners();
        
        console.log('✅ Custom Reference Lines activated');
        console.log('💡 Yellow crosshairs will be displayed on each viewport');
        console.log('   Click and drag to move the reference lines');
    }
    
    /**
     * Deactivate custom reference lines
     */
    public deactivate(): void {
        this.isActive = false;
        this.removeAllOverlays();
        this.removeEventListeners();
        
        console.log('Custom Reference Lines deactivated');
    }
    
    /**
     * Add reference lines to all viewports
     */
    private addReferenceLinesToAllViewports(): void {
        // Check single viewport first
        const mainViewport = document.getElementById('viewport');
        if (mainViewport) {
            this.addReferenceLinesToElement(mainViewport, 'main-viewport');
        }
        
        // Check multi-viewports
        const viewportElements = document.querySelectorAll('.viewport-container[data-viewport-id]');
        viewportElements.forEach((element, index) => {
            const viewportId = (element as HTMLElement).dataset.viewportId || `viewport-${index}`;
            this.addReferenceLinesToElement(element as HTMLElement, viewportId);
        });
    }
    
    /**
     * Add reference lines to a specific viewport element
     */
    private addReferenceLinesToElement(element: HTMLElement, viewportId: string): void {
        // Remove existing overlay if any
        this.removeOverlay(viewportId);
        
        // Create overlay container
        const overlay = document.createElement('div');
        overlay.className = 'custom-reference-lines-overlay';
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '1000';
        
        // Create SVG for drawing lines
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        
        // Add crosshairs if enabled
        if (this.options.showCrosshairs) {
            this.addCrosshairs(svg);
        }
        
        overlay.appendChild(svg);
        
        // Position the overlay relative to the viewport
        const targetElement = element.querySelector('.viewport') || element;
        if (targetElement && targetElement instanceof HTMLElement) {
            targetElement.style.position = 'relative';
            targetElement.appendChild(overlay);
        }
        
        this.overlayElements.set(viewportId, overlay);
        
        console.log(`Added reference lines to viewport: ${viewportId}`);
    }
    
    /**
     * Add crosshairs to SVG
     */
    private addCrosshairs(svg: SVGElement): void {
        // Create horizontal line
        const horizontalLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        horizontalLine.setAttribute('x1', '0');
        horizontalLine.setAttribute('y1', '50%');
        horizontalLine.setAttribute('x2', '100%');
        horizontalLine.setAttribute('y2', '50%');
        horizontalLine.setAttribute('stroke', this.options.color!);
        horizontalLine.setAttribute('stroke-width', this.options.lineWidth!.toString());
        if (this.options.dashPattern) {
            horizontalLine.setAttribute('stroke-dasharray', this.options.dashPattern.join(' '));
        }
        horizontalLine.setAttribute('opacity', '0.8');
        
        // Create vertical line
        const verticalLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        verticalLine.setAttribute('x1', '50%');
        verticalLine.setAttribute('y1', '0');
        verticalLine.setAttribute('x2', '50%');
        verticalLine.setAttribute('y2', '100%');
        verticalLine.setAttribute('stroke', this.options.color!);
        verticalLine.setAttribute('stroke-width', this.options.lineWidth!.toString());
        if (this.options.dashPattern) {
            verticalLine.setAttribute('stroke-dasharray', this.options.dashPattern.join(' '));
        }
        verticalLine.setAttribute('opacity', '0.8');
        
        // Create center marker
        const centerMarker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        centerMarker.setAttribute('cx', '50%');
        centerMarker.setAttribute('cy', '50%');
        centerMarker.setAttribute('r', '4');
        centerMarker.setAttribute('fill', this.options.color!);
        centerMarker.setAttribute('opacity', '0.9');
        
        svg.appendChild(horizontalLine);
        svg.appendChild(verticalLine);
        svg.appendChild(centerMarker);
        
        // Add coordinate display if enabled
        if (this.options.showCoordinates) {
            const coordText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            coordText.setAttribute('x', '52%');
            coordText.setAttribute('y', '48%');
            coordText.setAttribute('fill', this.options.color!);
            coordText.setAttribute('font-size', '12');
            coordText.setAttribute('font-family', 'Arial, sans-serif');
            coordText.textContent = '0, 0';
            coordText.setAttribute('class', 'reference-coords');
            svg.appendChild(coordText);
        }
    }
    
    /**
     * Update crosshairs position based on mouse coordinates
     */
    public updateCrosshairsPosition(viewportId: string, x: number, y: number): void {
        const overlay = this.overlayElements.get(viewportId);
        if (!overlay) return;
        
        const svg = overlay.querySelector('svg');
        if (!svg) return;
        
        const rect = svg.getBoundingClientRect();
        const xPercent = (x / rect.width) * 100;
        const yPercent = (y / rect.height) * 100;
        
        // Update horizontal line
        const horizontalLine = svg.querySelector('line:first-child');
        if (horizontalLine) {
            horizontalLine.setAttribute('y1', `${yPercent}%`);
            horizontalLine.setAttribute('y2', `${yPercent}%`);
        }
        
        // Update vertical line
        const verticalLine = svg.querySelector('line:nth-child(2)');
        if (verticalLine) {
            verticalLine.setAttribute('x1', `${xPercent}%`);
            verticalLine.setAttribute('x2', `${xPercent}%`);
        }
        
        // Update center marker
        const centerMarker = svg.querySelector('circle');
        if (centerMarker) {
            centerMarker.setAttribute('cx', `${xPercent}%`);
            centerMarker.setAttribute('cy', `${yPercent}%`);
        }
        
        // Update coordinates
        const coordText = svg.querySelector('.reference-coords');
        if (coordText) {
            coordText.setAttribute('x', `${xPercent + 2}%`);
            coordText.setAttribute('y', `${yPercent - 2}%`);
            coordText.textContent = `${Math.round(x)}, ${Math.round(y)}`;
        }
    }
    
    /**
     * Add event listeners for mouse interaction
     */
    private addEventListeners(): void {
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('click', this.handleMouseClick.bind(this));
    }
    
    /**
     * Remove event listeners
     */
    private removeEventListeners(): void {
        document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
        document.removeEventListener('click', this.handleMouseClick.bind(this));
    }
    
    /**
     * Handle mouse move events
     */
    private handleMouseMove(event: MouseEvent): void {
        if (!this.isActive) return;
        
        const target = event.target as HTMLElement;
        const viewportElement = target.closest('[data-viewport-id], #viewport');
        
        if (viewportElement) {
            const viewportId = (viewportElement as HTMLElement).dataset.viewportId || 'main-viewport';
            const rect = viewportElement.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            this.updateCrosshairsPosition(viewportId, x, y);
        }
    }
    
    /**
     * Handle mouse click events
     */
    private handleMouseClick(event: MouseEvent): void {
        if (!this.isActive) return;
        
        const target = event.target as HTMLElement;
        const viewportElement = target.closest('[data-viewport-id], #viewport');
        
        if (viewportElement) {
            const viewportId = (viewportElement as HTMLElement).dataset.viewportId || 'main-viewport';
            const rect = viewportElement.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            console.log(`Reference point set at: ${Math.round(x)}, ${Math.round(y)} in viewport ${viewportId}`);
            
            // Update all viewports to show the same reference point
            this.synchronizeReferencePoints(x, y, rect.width, rect.height);
        }
    }
    
    /**
     * Synchronize reference points across all viewports
     */
    private synchronizeReferencePoints(x: number, y: number, sourceWidth: number, sourceHeight: number): void {
        this.overlayElements.forEach((overlay, viewportId) => {
            const svg = overlay.querySelector('svg');
            if (!svg) return;
            
            const rect = svg.getBoundingClientRect();
            // Calculate proportional position
            const propX = (x / sourceWidth) * rect.width;
            const propY = (y / sourceHeight) * rect.height;
            
            this.updateCrosshairsPosition(viewportId, propX, propY);
        });
    }
    
    /**
     * Remove overlay for specific viewport
     */
    private removeOverlay(viewportId: string): void {
        const overlay = this.overlayElements.get(viewportId);
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
            this.overlayElements.delete(viewportId);
        }
    }
    
    /**
     * Remove all overlays
     */
    private removeAllOverlays(): void {
        this.overlayElements.forEach((overlay, viewportId) => {
            this.removeOverlay(viewportId);
        });
    }
    
    /**
     * Update options
     */
    public updateOptions(options: Partial<ReferenceLineOptions>): void {
        this.options = { ...this.options, ...options };
        
        if (this.isActive) {
            this.removeAllOverlays();
            this.addReferenceLinesToAllViewports();
        }
    }
    
    /**
     * Check if active
     */
    public isActiveState(): boolean {
        return this.isActive;
    }
    
    /**
     * Refresh overlays (useful when viewports change)
     */
    public refresh(): void {
        if (this.isActive) {
            this.removeAllOverlays();
            this.addReferenceLinesToAllViewports();
        }
    }
}