import { SeriesManager, SeriesInfo } from '../core/seriesManager';

export interface SeriesBrowserConfig {
    showThumbnails?: boolean;
    showMetadata?: boolean;
    allowSelection?: boolean;
    allowDeletion?: boolean;
    showStatistics?: boolean;
    maxDisplayedSeries?: number;
}

export class SeriesBrowser {
    private element: HTMLElement;
    private seriesManager: SeriesManager;
    private config: SeriesBrowserConfig;
    private onSeriesSelectedCallback: ((series: SeriesInfo, index: number) => void) | null = null;
    private onSeriesDeletedCallback: ((seriesId: string) => void) | null = null;
    private searchTerm: string = '';
    private filteredSeries: SeriesInfo[] = [];
    
    constructor(
        containerElement: HTMLElement, 
        seriesManager: SeriesManager,
        config: SeriesBrowserConfig = {}
    ) {
        this.element = containerElement;
        this.seriesManager = seriesManager;
        this.config = {
            showThumbnails: true,
            showMetadata: true,
            allowSelection: true,
            allowDeletion: false,
            showStatistics: true,
            maxDisplayedSeries: 50,
            ...config
        };
        
        this.init();
    }
    
    /**
     * Initialize the series browser
     */
    private init(): void {
        this.setupHTML();
        this.attachEventListeners();
        this.render();
        
        // Listen for series changes
        this.seriesManager.onSeriesChanged(() => {
            this.updateFilteredSeries();
            this.render();
        });
        
        console.log('Series browser initialized');
    }
    
    /**
     * Setup the HTML structure
     */
    private setupHTML(): void {
        this.element.className = 'series-browser';
        this.element.innerHTML = `
            <div class="series-browser-header">
                <h3>Series Browser</h3>
                <div class="series-search">
                    <input type="text" id="seriesSearch" placeholder="Search series..." />
                    <button id="clearSearch" title="Clear search">✕</button>
                </div>
                <div class="series-statistics" style="display: ${this.config.showStatistics ? 'block' : 'none'}">
                    <span id="seriesCount">0 series</span>
                    <span id="imageCount">0 images</span>
                </div>
            </div>
            <div class="series-list-container">
                <div class="series-list" id="seriesList">
                    <!-- Series items will be rendered here -->
                </div>
            </div>
            <div class="series-browser-footer">
                <button id="refreshSeries" title="Refresh series list">🔄 Refresh</button>
                <button id="clearAllSeries" title="Clear all series" style="display: ${this.config.allowDeletion ? 'inline-block' : 'none'}">🗑️ Clear All</button>
            </div>
        `;
    }
    
    /**
     * Attach event listeners
     */
    private attachEventListeners(): void {
        // Search functionality
        const searchInput = this.element.querySelector('#seriesSearch') as HTMLInputElement;
        const clearSearchBtn = this.element.querySelector('#clearSearch') as HTMLButtonElement;
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = (e.target as HTMLInputElement).value;
                this.updateFilteredSeries();
                this.render();
            });
        }
        
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                this.searchTerm = '';
                if (searchInput) searchInput.value = '';
                this.updateFilteredSeries();
                this.render();
            });
        }
        
        // Footer buttons
        const refreshBtn = this.element.querySelector('#refreshSeries') as HTMLButtonElement;
        const clearAllBtn = this.element.querySelector('#clearAllSeries') as HTMLButtonElement;
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refresh();
            });
        }
        
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear all series?')) {
                    this.seriesManager.clearAllSeries();
                }
            });
        }
    }
    
    /**
     * Update filtered series based on search term
     */
    private updateFilteredSeries(): void {
        if (this.searchTerm.trim() === '') {
            this.filteredSeries = this.seriesManager.getAllSeries();
        } else {
            this.filteredSeries = this.seriesManager.searchSeries(this.searchTerm);
        }
        
        // Limit displayed series if configured
        if (this.config.maxDisplayedSeries && this.filteredSeries.length > this.config.maxDisplayedSeries) {
            this.filteredSeries = this.filteredSeries.slice(0, this.config.maxDisplayedSeries);
        }
    }
    
    /**
     * Render the series browser
     */
    public render(): void {
        this.updateFilteredSeries();
        this.renderStatistics();
        this.renderSeriesList();
    }
    
    /**
     * Render statistics
     */
    private renderStatistics(): void {
        if (!this.config.showStatistics) return;
        
        const stats = this.seriesManager.getStatistics();
        const seriesCountEl = this.element.querySelector('#seriesCount');
        const imageCountEl = this.element.querySelector('#imageCount');
        
        if (seriesCountEl) {
            const displayCount = this.filteredSeries.length;
            const totalCount = stats.totalSeries;
            seriesCountEl.textContent = displayCount === totalCount ? 
                `${totalCount} series` : 
                `${displayCount} of ${totalCount} series`;
        }
        
        if (imageCountEl) {
            const displayImages = this.filteredSeries.reduce((sum, series) => sum + series.imageCount, 0);
            imageCountEl.textContent = `${displayImages} images`;
        }
    }
    
    /**
     * Render series list
     */
    private renderSeriesList(): void {
        const seriesListEl = this.element.querySelector('#seriesList');
        if (!seriesListEl) return;
        
        if (this.filteredSeries.length === 0) {
            seriesListEl.innerHTML = `
                <div class="no-series">
                    ${this.searchTerm ? 'No series match your search.' : 'No series available.'}
                </div>
            `;
            return;
        }
        
        const currentSeriesIndex = this.seriesManager.getCurrentSeriesIndex();
        const currentSeries = this.seriesManager.getCurrentSeries();
        
        let html = '';
        this.filteredSeries.forEach((series, displayIndex) => {
            const actualIndex = this.seriesManager.getAllSeries().findIndex(s => s.id === series.id);
            const isActive = currentSeries && currentSeries.id === series.id;
            const activeClass = isActive ? 'active' : '';
            
            html += `
                <div class="series-item ${activeClass}" data-series-id="${series.id}" data-series-index="${actualIndex}">
                    ${this.config.showThumbnails ? this.renderSeriesThumbnail(series) : ''}
                    <div class="series-info">
                        <div class="series-header">
                            <div class="series-description" title="${series.description}">
                                ${this.highlightSearchTerm(series.description)}
                            </div>
                            ${this.config.allowDeletion ? `
                                <button class="delete-series-btn" data-series-id="${series.id}" title="Delete series">✕</button>
                            ` : ''}
                        </div>
                        ${this.config.showMetadata ? this.renderSeriesMetadata(series) : ''}
                        <div class="series-stats">
                            <span class="image-count">${series.imageCount} images</span>
                            ${series.modality ? `<span class="modality">${series.modality}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        
        seriesListEl.innerHTML = html;
        this.attachSeriesEventListeners();
    }
    
    /**
     * Render series thumbnail
     * @param series - Series info
     * @returns Thumbnail HTML
     */
    private renderSeriesThumbnail(series: SeriesInfo): string {
        const thumbnailSrc = series.thumbnail || this.getDefaultThumbnail(series.modality);
        return `
            <div class="series-thumbnail">
                <img src="${thumbnailSrc}" alt="Series thumbnail" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjMzMzIi8+Cjx0ZXh0IHg9IjMyIiB5PSIzOCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5JbWFnZTwvdGV4dD4KPC9zdmc+';" />
                <div class="thumbnail-overlay">
                    <span class="image-count-badge">${series.imageCount}</span>
                </div>
            </div>
        `;
    }
    
    /**
     * Render series metadata
     * @param series - Series info
     * @returns Metadata HTML
     */
    private renderSeriesMetadata(series: SeriesInfo): string {
        return `
            <div class="series-metadata">
                ${series.patientName && series.patientName !== 'Unknown' ? `
                    <div class="metadata-item">
                        <span class="metadata-label">Patient:</span>
                        <span class="metadata-value">${this.highlightSearchTerm(series.patientName)}</span>
                    </div>
                ` : ''}
                ${series.studyDate ? `
                    <div class="metadata-item">
                        <span class="metadata-label">Date:</span>
                        <span class="metadata-value">${series.studyDate}</span>
                    </div>
                ` : ''}
                <div class="metadata-item">
                    <span class="metadata-label">ID:</span>
                    <span class="metadata-value">${series.id}</span>
                </div>
            </div>
        `;
    }
    
    /**
     * Highlight search term in text
     * @param text - Text to highlight
     * @returns Highlighted text HTML
     */
    private highlightSearchTerm(text: string): string {
        if (!this.searchTerm.trim()) return text;
        
        const regex = new RegExp(`(${this.searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }
    
    /**
     * Get default thumbnail based on modality
     * @param modality - DICOM modality
     * @returns Default thumbnail URL
     */
    private getDefaultThumbnail(modality?: string): string {
        // Return a simple SVG placeholder based on modality
        const color = this.getModalityColor(modality);
        return `data:image/svg+xml;base64,${btoa(`
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="64" height="64" fill="${color}"/>
                <text x="32" y="32" font-family="Arial" font-size="10" fill="white" text-anchor="middle" dominant-baseline="middle">${modality || 'IMG'}</text>
            </svg>
        `)}`;
    }
    
    /**
     * Get color for modality
     * @param modality - DICOM modality
     * @returns Color hex code
     */
    private getModalityColor(modality?: string): string {
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
        
        return colors[modality || ''] || '#666666';
    }
    
    /**
     * Attach event listeners to series items
     */
    private attachSeriesEventListeners(): void {
        const seriesItems = this.element.querySelectorAll('.series-item');
        const deleteButtons = this.element.querySelectorAll('.delete-series-btn');
        
        // Series selection
        seriesItems.forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't select if delete button was clicked
                if ((e.target as HTMLElement).classList.contains('delete-series-btn')) {
                    return;
                }
                
                if (!this.config.allowSelection) return;
                
                const seriesId = (item as HTMLElement).dataset.seriesId;
                const seriesIndex = parseInt((item as HTMLElement).dataset.seriesIndex || '-1');
                
                if (seriesId && seriesIndex >= 0) {
                    const series = this.seriesManager.getSeriesById(seriesId);
                    if (series && this.seriesManager.setCurrentSeries(seriesIndex)) {
                        // Update UI
                        seriesItems.forEach(el => el.classList.remove('active'));
                        item.classList.add('active');
                        
                        // Notify callback
                        if (this.onSeriesSelectedCallback) {
                            this.onSeriesSelectedCallback(series, seriesIndex);
                        }
                        
                        console.log(`Selected series: ${series.description}`);
                    }
                }
            });
        });
        
        // Series deletion
        deleteButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent series selection
                
                const seriesId = (button as HTMLElement).dataset.seriesId;
                if (seriesId) {
                    const series = this.seriesManager.getSeriesById(seriesId);
                    if (series && confirm(`Delete series "${series.description}"?`)) {
                        if (this.seriesManager.removeSeriesById(seriesId)) {
                            if (this.onSeriesDeletedCallback) {
                                this.onSeriesDeletedCallback(seriesId);
                            }
                            console.log(`Deleted series: ${series.description}`);
                        }
                    }
                }
            });
        });
    }
    
    /**
     * Set callback for series selection
     * @param callback - Callback function
     */
    public onSeriesSelected(callback: (series: SeriesInfo, index: number) => void): void {
        this.onSeriesSelectedCallback = callback;
    }
    
    /**
     * Set callback for series deletion
     * @param callback - Callback function
     */
    public onSeriesDeleted(callback: (seriesId: string) => void): void {
        this.onSeriesDeletedCallback = callback;
    }
    
    /**
     * Refresh the series browser
     */
    public refresh(): void {
        console.log('Refreshing series browser...');
        this.render();
    }
    
    /**
     * Update configuration
     * @param config - New configuration
     */
    public updateConfig(config: Partial<SeriesBrowserConfig>): void {
        this.config = { ...this.config, ...config };
        this.setupHTML();
        this.attachEventListeners();
        this.render();
        console.log('Series browser config updated');
    }
    
    /**
     * Get current configuration
     * @returns Current configuration
     */
    public getConfig(): SeriesBrowserConfig {
        return { ...this.config };
    }
    
    /**
     * Highlight a specific series
     * @param seriesId - Series ID to highlight
     */
    public highlightSeries(seriesId: string): void {
        const seriesItems = this.element.querySelectorAll('.series-item');
        seriesItems.forEach(item => {
            if ((item as HTMLElement).dataset.seriesId === seriesId) {
                item.classList.add('highlighted');
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                item.classList.remove('highlighted');
            }
        });
    }
    
    /**
     * Clear search and show all series
     */
    public clearSearch(): void {
        this.searchTerm = '';
        const searchInput = this.element.querySelector('#seriesSearch') as HTMLInputElement;
        if (searchInput) searchInput.value = '';
        this.updateFilteredSeries();
        this.render();
    }
    
    /**
     * Get filtered series count
     * @returns Number of filtered series
     */
    public getFilteredSeriesCount(): number {
        return this.filteredSeries.length;
    }
}