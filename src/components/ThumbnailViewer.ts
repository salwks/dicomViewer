import { SeriesInfo } from '../core/seriesManager';
import { StackNavigationTool } from '../tools/stackNavigationTool';

export interface ThumbnailViewerConfig {
    thumbnailSize?: number;
    showImageNumbers?: boolean;
    showProgressBar?: boolean;
    allowImageSelection?: boolean;
    maxThumbnailsPerRow?: number;
    lazyLoading?: boolean;
    generateThumbnails?: boolean;
}

export interface ThumbnailInfo {
    imageId: string;
    imageIndex: number;
    thumbnailUrl?: string;
    isLoaded: boolean;
    isError: boolean;
}

export class ThumbnailViewer {
    private element: HTMLElement;
    private series: SeriesInfo | null = null;
    private config: ThumbnailViewerConfig;
    private currentImageIndex: number = 0;
    private thumbnails: ThumbnailInfo[] = [];
    private onImageSelectedCallback: ((imageId: string, index: number) => void) | null = null;
    private onImageChangedCallback: ((imageId: string, index: number) => void) | null = null;
    private stackNavigation: StackNavigationTool;
    private intersectionObserver: IntersectionObserver | null = null;
    
    constructor(
        containerElement: HTMLElement,
        config: ThumbnailViewerConfig = {}
    ) {
        this.element = containerElement;
        this.config = {
            thumbnailSize: 64,
            showImageNumbers: true,
            showProgressBar: true,
            allowImageSelection: true,
            maxThumbnailsPerRow: 4,
            lazyLoading: true,
            generateThumbnails: false,
            ...config
        };
        
        this.stackNavigation = StackNavigationTool.getInstance();
        this.init();
    }
    
    /**
     * Initialize the thumbnail viewer
     */
    private init(): void {
        this.setupHTML();
        this.attachEventListeners();
        
        // Setup intersection observer for lazy loading
        if (this.config.lazyLoading) {
            this.setupIntersectionObserver();
        }
        
        console.log('Thumbnail viewer initialized');
    }
    
    /**
     * Setup the HTML structure
     */
    private setupHTML(): void {
        this.element.className = 'thumbnail-viewer';
        this.element.innerHTML = `
            <div class="thumbnail-viewer-header">
                <h3>Image Navigator</h3>
                <div class="image-counter" style="display: ${this.config.showProgressBar ? 'block' : 'none'}">
                    <span id="currentImageInfo">No images</span>
                    <div class="progress-bar">
                        <div class="progress-fill" id="progressFill"></div>
                    </div>
                </div>
            </div>
            <div class="thumbnail-grid-container">
                <div class="thumbnail-grid" id="thumbnailGrid" style="grid-template-columns: repeat(${this.config.maxThumbnailsPerRow}, 1fr);">
                    <!-- Thumbnails will be rendered here -->
                </div>
            </div>
            <div class="thumbnail-viewer-controls">
                <button id="firstImageBtn" title="First image">⏮️</button>
                <button id="prevImageBtn" title="Previous image">⏪</button>
                <span class="page-indicator" id="pageIndicator">-</span>
                <button id="nextImageBtn" title="Next image">⏩</button>
                <button id="lastImageBtn" title="Last image">⏭️</button>
                <div class="thumbnail-controls-right">
                    <button id="generateThumbnailsBtn" title="Generate thumbnails" style="display: ${this.config.generateThumbnails ? 'inline-block' : 'none'}">🖼️ Generate</button>
                    <button id="refreshThumbnailsBtn" title="Refresh thumbnails">🔄</button>
                </div>
            </div>
        `;
    }
    
    /**
     * Setup intersection observer for lazy loading
     */
    private setupIntersectionObserver(): void {
        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const thumbnailElement = entry.target as HTMLElement;
                    const imageIndex = parseInt(thumbnailElement.dataset.imageIndex || '-1');
                    
                    if (imageIndex >= 0 && imageIndex < this.thumbnails.length) {
                        this.loadThumbnail(imageIndex);
                    }
                }
            });
        }, {
            root: this.element.querySelector('.thumbnail-grid-container'),
            rootMargin: '50px',
            threshold: 0.1
        });
    }
    
    /**
     * Attach event listeners
     */
    private attachEventListeners(): void {
        // Navigation controls
        const firstBtn = this.element.querySelector('#firstImageBtn') as HTMLButtonElement;
        const prevBtn = this.element.querySelector('#prevImageBtn') as HTMLButtonElement;
        const nextBtn = this.element.querySelector('#nextImageBtn') as HTMLButtonElement;
        const lastBtn = this.element.querySelector('#lastImageBtn') as HTMLButtonElement;
        const generateBtn = this.element.querySelector('#generateThumbnailsBtn') as HTMLButtonElement;
        const refreshBtn = this.element.querySelector('#refreshThumbnailsBtn') as HTMLButtonElement;
        
        if (firstBtn) {
            firstBtn.addEventListener('click', () => {
                this.selectImage(0);
            });
        }
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentImageIndex > 0) {
                    this.selectImage(this.currentImageIndex - 1);
                }
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (this.currentImageIndex < this.thumbnails.length - 1) {
                    this.selectImage(this.currentImageIndex + 1);
                }
            });
        }
        
        if (lastBtn) {
            lastBtn.addEventListener('click', () => {
                if (this.thumbnails.length > 0) {
                    this.selectImage(this.thumbnails.length - 1);
                }
            });
        }
        
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                this.generateAllThumbnails();
            });
        }
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refresh();
            });
        }
        
        // Keyboard navigation
        this.element.addEventListener('keydown', this.handleKeyDown.bind(this));
        this.element.setAttribute('tabindex', '0'); // Make element focusable
    }
    
    /**
     * Handle keyboard events
     * @param event - Keyboard event
     */
    private handleKeyDown(event: KeyboardEvent): void {
        switch (event.key) {
            case 'ArrowLeft':
            case 'ArrowUp':
                event.preventDefault();
                if (this.currentImageIndex > 0) {
                    this.selectImage(this.currentImageIndex - 1);
                }
                break;
            case 'ArrowRight':
            case 'ArrowDown':
                event.preventDefault();
                if (this.currentImageIndex < this.thumbnails.length - 1) {
                    this.selectImage(this.currentImageIndex + 1);
                }
                break;
            case 'Home':
                event.preventDefault();
                this.selectImage(0);
                break;
            case 'End':
                event.preventDefault();
                if (this.thumbnails.length > 0) {
                    this.selectImage(this.thumbnails.length - 1);
                }
                break;
        }
    }
    
    /**
     * Load series into the thumbnail viewer
     * @param series - Series to load
     * @param currentIndex - Current image index
     */
    public loadSeries(series: SeriesInfo, currentIndex: number = 0): void {
        this.series = series;
        this.currentImageIndex = Math.max(0, Math.min(currentIndex, series.imageIds.length - 1));
        
        // Create thumbnail info array
        this.thumbnails = series.imageIds.map((imageId, index) => ({
            imageId,
            imageIndex: index,
            thumbnailUrl: undefined,
            isLoaded: false,
            isError: false
        }));
        
        this.render();
        console.log(`Loaded series with ${this.thumbnails.length} images`);
    }
    
    /**
     * Render the thumbnail viewer
     */
    public render(): void {
        this.updateImageCounter();
        this.updateProgressBar();
        this.renderThumbnailGrid();
        this.updateNavigationButtons();
    }
    
    /**
     * Update image counter display
     */
    private updateImageCounter(): void {
        const counterEl = this.element.querySelector('#currentImageInfo');
        if (!counterEl) return;
        
        if (this.thumbnails.length === 0) {
            counterEl.textContent = 'No images';
        } else {
            counterEl.textContent = `${this.currentImageIndex + 1} / ${this.thumbnails.length}`;
        }
    }
    
    /**
     * Update progress bar
     */
    private updateProgressBar(): void {
        if (!this.config.showProgressBar) return;
        
        const progressFill = this.element.querySelector('#progressFill') as HTMLElement;
        if (!progressFill) return;
        
        if (this.thumbnails.length === 0) {
            progressFill.style.width = '0%';
        } else {
            const progress = ((this.currentImageIndex + 1) / this.thumbnails.length) * 100;
            progressFill.style.width = `${progress}%`;
        }
    }
    
    /**
     * Render thumbnail grid
     */
    private renderThumbnailGrid(): void {
        const gridEl = this.element.querySelector('#thumbnailGrid');
        if (!gridEl) return;
        
        if (this.thumbnails.length === 0) {
            gridEl.innerHTML = '<div class="no-images">No images to display</div>';
            return;
        }
        
        let html = '';
        this.thumbnails.forEach((thumbnail, index) => {
            const isActive = index === this.currentImageIndex;
            const activeClass = isActive ? 'active' : '';
            
            html += `
                <div class="thumbnail ${activeClass}" 
                     data-image-index="${index}"
                     data-image-id="${thumbnail.imageId}"
                     style="width: ${this.config.thumbnailSize}px; height: ${this.config.thumbnailSize}px;">
                    <div class="thumbnail-image">
                        ${this.renderThumbnailImage(thumbnail, index)}
                    </div>
                    ${this.config.showImageNumbers ? `
                        <div class="thumbnail-number">${index + 1}</div>
                    ` : ''}
                    <div class="thumbnail-loading" style="display: ${thumbnail.isLoaded ? 'none' : 'block'}">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
            `;
        });
        
        gridEl.innerHTML = html;
        this.attachThumbnailEventListeners();
        
        // Setup lazy loading
        if (this.config.lazyLoading && this.intersectionObserver) {
            const thumbnailElements = gridEl.querySelectorAll('.thumbnail');
            thumbnailElements.forEach(el => {
                this.intersectionObserver!.observe(el);
            });
        } else {
            // Load all thumbnails immediately
            this.thumbnails.forEach((_, index) => {
                this.loadThumbnail(index);
            });
        }
    }
    
    /**
     * Render thumbnail image
     * @param thumbnail - Thumbnail info
     * @param index - Image index
     * @returns HTML string
     */
    private renderThumbnailImage(thumbnail: ThumbnailInfo, index: number): string {
        if (thumbnail.isError) {
            return `
                <div class="thumbnail-error" title="Failed to load image">
                    ❌
                </div>
            `;
        }
        
        if (thumbnail.thumbnailUrl) {
            return `
                <img src="${thumbnail.thumbnailUrl}" 
                     alt="Image ${index + 1}"
                     onerror="this.parentElement.innerHTML='<div class=\\'thumbnail-error\\' title=\\'Failed to load\\'>❌</div>'" />
            `;
        }
        
        // Placeholder
        return `
            <div class="thumbnail-placeholder" title="Image ${index + 1}">
                <span>${index + 1}</span>
            </div>
        `;
    }
    
    /**
     * Attach event listeners to thumbnail elements
     */
    private attachThumbnailEventListeners(): void {
        if (!this.config.allowImageSelection) return;
        
        const thumbnailElements = this.element.querySelectorAll('.thumbnail');
        thumbnailElements.forEach(element => {
            element.addEventListener('click', () => {
                const imageIndex = parseInt((element as HTMLElement).dataset.imageIndex || '-1');
                if (imageIndex >= 0) {
                    this.selectImage(imageIndex);
                }
            });
        });
    }
    
    /**
     * Load thumbnail for specific index
     * @param index - Image index
     */
    private async loadThumbnail(index: number): Promise<void> {
        if (index < 0 || index >= this.thumbnails.length) return;
        
        const thumbnail = this.thumbnails[index];
        if (thumbnail.isLoaded || thumbnail.isError) return;
        
        try {
            // For now, use a placeholder. In a real implementation,
            // you would generate or load actual thumbnails
            const thumbnailUrl = this.generatePlaceholderThumbnail(index);
            
            thumbnail.thumbnailUrl = thumbnailUrl;
            thumbnail.isLoaded = true;
            
            // Update the UI
            this.updateThumbnailElement(index);
            
        } catch (error) {
            console.warn(`Failed to load thumbnail for image ${index}:`, error);
            thumbnail.isError = true;
            this.updateThumbnailElement(index);
        }
    }
    
    /**
     * Generate placeholder thumbnail
     * @param index - Image index
     * @returns Placeholder thumbnail URL
     */
    private generatePlaceholderThumbnail(index: number): string {
        const size = this.config.thumbnailSize || 64;
        const modality = this.series?.modality || 'IMG';
        const color = this.getModalityColor(modality);
        
        return `data:image/svg+xml;base64,${btoa(`
            <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="${size}" height="${size}" fill="${color}"/>
                <rect x="2" y="2" width="${size-4}" height="${size-4}" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
                <text x="${size/2}" y="${size/2 - 6}" font-family="Arial" font-size="10" fill="white" text-anchor="middle" font-weight="bold">${modality}</text>
                <text x="${size/2}" y="${size/2 + 8}" font-family="Arial" font-size="12" fill="white" text-anchor="middle">${index + 1}</text>
            </svg>
        `)}`;
    }
    
    /**
     * Get color for modality
     * @param modality - DICOM modality
     * @returns Color hex code
     */
    private getModalityColor(modality: string): string {
        const colors: { [key: string]: string } = {
            'CT': '#4A90E2',
            'MR': '#E24A90',
            'CR': '#E2A44A',
            'DR': '#90E24A',
            'US': '#A44AE2',
            'NM': '#E24A4A',
            'PT': '#4AE2A4',
            'RF': '#E2E24A'
        };
        
        return colors[modality] || '#666666';
    }
    
    /**
     * Update thumbnail element in the DOM
     * @param index - Image index
     */
    private updateThumbnailElement(index: number): void {
        const thumbnailEl = this.element.querySelector(`[data-image-index="${index}"]`);
        if (!thumbnailEl) return;
        
        const thumbnail = this.thumbnails[index];
        const imageContainer = thumbnailEl.querySelector('.thumbnail-image');
        const loadingEl = thumbnailEl.querySelector('.thumbnail-loading') as HTMLElement;
        
        if (imageContainer) {
            imageContainer.innerHTML = this.renderThumbnailImage(thumbnail, index);
        }
        
        if (loadingEl) {
            loadingEl.style.display = thumbnail.isLoaded ? 'none' : 'block';
        }
    }
    
    /**
     * Select image by index
     * @param index - Image index to select
     * @returns True if selection successful
     */
    public selectImage(index: number): boolean {
        if (index < 0 || index >= this.thumbnails.length) {
            console.warn(`Invalid image index: ${index}`);
            return false;
        }
        
        const previousIndex = this.currentImageIndex;
        this.currentImageIndex = index;
        
        // Update UI
        const thumbnailElements = this.element.querySelectorAll('.thumbnail');
        thumbnailElements.forEach((el, i) => {
            if (i === index) {
                el.classList.add('active');
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                el.classList.remove('active');
            }
        });
        
        this.updateImageCounter();
        this.updateProgressBar();
        this.updateNavigationButtons();
        
        // Notify callbacks
        const selectedThumbnail = this.thumbnails[index];
        if (this.onImageSelectedCallback) {
            this.onImageSelectedCallback(selectedThumbnail.imageId, index);
        }
        
        if (previousIndex !== index && this.onImageChangedCallback) {
            this.onImageChangedCallback(selectedThumbnail.imageId, index);
        }
        
        console.log(`Selected image ${index + 1} of ${this.thumbnails.length}`);
        return true;
    }
    
    /**
     * Update navigation button states
     */
    private updateNavigationButtons(): void {
        const firstBtn = this.element.querySelector('#firstImageBtn') as HTMLButtonElement;
        const prevBtn = this.element.querySelector('#prevImageBtn') as HTMLButtonElement;
        const nextBtn = this.element.querySelector('#nextImageBtn') as HTMLButtonElement;
        const lastBtn = this.element.querySelector('#lastImageBtn') as HTMLButtonElement;
        const pageIndicator = this.element.querySelector('#pageIndicator');
        
        const canGoPrevious = this.currentImageIndex > 0;
        const canGoNext = this.currentImageIndex < this.thumbnails.length - 1;
        
        if (firstBtn) firstBtn.disabled = !canGoPrevious;
        if (prevBtn) prevBtn.disabled = !canGoPrevious;
        if (nextBtn) nextBtn.disabled = !canGoNext;
        if (lastBtn) lastBtn.disabled = !canGoNext;
        
        if (pageIndicator) {
            if (this.thumbnails.length === 0) {
                pageIndicator.textContent = '-';
            } else {
                pageIndicator.textContent = `${this.currentImageIndex + 1}/${this.thumbnails.length}`;
            }
        }
    }
    
    /**
     * Generate all thumbnails
     */
    public async generateAllThumbnails(): Promise<void> {
        console.log('Generating all thumbnails...');
        
        const promises = this.thumbnails.map((_, index) => this.loadThumbnail(index));
        await Promise.allSettled(promises);
        
        console.log('Thumbnail generation completed');
    }
    
    /**
     * Refresh the thumbnail viewer
     */
    public refresh(): void {
        if (this.series) {
            this.loadSeries(this.series, this.currentImageIndex);
        }
    }
    
    /**
     * Set callback for image selection
     * @param callback - Callback function
     */
    public onImageSelected(callback: (imageId: string, index: number) => void): void {
        this.onImageSelectedCallback = callback;
    }
    
    /**
     * Set callback for image change
     * @param callback - Callback function
     */
    public onImageChanged(callback: (imageId: string, index: number) => void): void {
        this.onImageChangedCallback = callback;
    }
    
    /**
     * Get current image index
     * @returns Current image index
     */
    public getCurrentImageIndex(): number {
        return this.currentImageIndex;
    }
    
    /**
     * Get total image count
     * @returns Total image count
     */
    public getImageCount(): number {
        return this.thumbnails.length;
    }
    
    /**
     * Get current series
     * @returns Current series or null
     */
    public getCurrentSeries(): SeriesInfo | null {
        return this.series;
    }
    
    /**
     * Update configuration
     * @param config - New configuration
     */
    public updateConfig(config: Partial<ThumbnailViewerConfig>): void {
        this.config = { ...this.config, ...config };
        this.setupHTML();
        this.attachEventListeners();
        this.render();
        console.log('Thumbnail viewer config updated');
    }
    
    /**
     * Destroy the thumbnail viewer
     */
    public destroy(): void {
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
            this.intersectionObserver = null;
        }
        
        this.element.innerHTML = '';
        console.log('Thumbnail viewer destroyed');
    }
}