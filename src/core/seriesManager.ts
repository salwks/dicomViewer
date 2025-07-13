import { Types } from '@cornerstonejs/core';

export interface SeriesInfo {
    id: string;
    description: string;
    imageIds: string[];
    imageCount: number;
    thumbnail?: string;
    metadata?: any;
    modality?: string;
    studyDate?: string;
    patientName?: string;
}

export class SeriesManager {
    private static instance: SeriesManager;
    private seriesList: SeriesInfo[] = [];
    private currentSeriesIndex: number = -1;
    private onSeriesChangedCallbacks: ((series: SeriesInfo | null, index: number) => void)[] = [];
    
    public static getInstance(): SeriesManager {
        if (!SeriesManager.instance) {
            SeriesManager.instance = new SeriesManager();
        }
        return SeriesManager.instance;
    }
    
    /**
     * Add a new series to the manager
     * @param series - Series information to add
     * @returns Index of the added series
     */
    public addSeries(series: SeriesInfo): number {
        // Check if series already exists
        const existingIndex = this.seriesList.findIndex(s => s.id === series.id);
        if (existingIndex !== -1) {
            console.warn(`Series ${series.id} already exists, updating...`);
            this.seriesList[existingIndex] = { ...series };
            return existingIndex;
        }
        
        this.seriesList.push({ ...series });
        
        // If this is the first series, set it as current
        if (this.currentSeriesIndex === -1) {
            this.currentSeriesIndex = 0;
            this.notifySeriesChanged();
        }
        
        console.log(`Added series ${series.id} with ${series.imageCount} images`);
        return this.seriesList.length - 1;
    }
    
    /**
     * Remove a series by index
     * @param index - Index of series to remove
     * @returns True if removed successfully
     */
    public removeSeries(index: number): boolean {
        if (index < 0 || index >= this.seriesList.length) {
            console.warn(`Invalid series index: ${index}`);
            return false;
        }
        
        const removedSeries = this.seriesList[index];
        this.seriesList.splice(index, 1);
        
        // Adjust current series index if needed
        if (this.currentSeriesIndex === index) {
            this.currentSeriesIndex = this.seriesList.length > 0 ? 0 : -1;
            this.notifySeriesChanged();
        } else if (this.currentSeriesIndex > index) {
            this.currentSeriesIndex--;
        }
        
        console.log(`Removed series ${removedSeries.id}`);
        return true;
    }
    
    /**
     * Remove a series by ID
     * @param seriesId - ID of series to remove
     * @returns True if removed successfully
     */
    public removeSeriesById(seriesId: string): boolean {
        const index = this.seriesList.findIndex(s => s.id === seriesId);
        if (index !== -1) {
            return this.removeSeries(index);
        }
        return false;
    }
    
    /**
     * Get series by index
     * @param index - Series index
     * @returns Series info or null if not found
     */
    public getSeries(index: number): SeriesInfo | null {
        if (index >= 0 && index < this.seriesList.length) {
            return { ...this.seriesList[index] };
        }
        return null;
    }
    
    /**
     * Get series by ID
     * @param seriesId - Series ID
     * @returns Series info or null if not found
     */
    public getSeriesById(seriesId: string): SeriesInfo | null {
        const series = this.seriesList.find(s => s.id === seriesId);
        return series ? { ...series } : null;
    }
    
    /**
     * Get all series
     * @returns Array of all series
     */
    public getAllSeries(): SeriesInfo[] {
        return this.seriesList.map(s => ({ ...s }));
    }
    
    /**
     * Get current series
     * @returns Current series or null
     */
    public getCurrentSeries(): SeriesInfo | null {
        if (this.currentSeriesIndex >= 0 && this.currentSeriesIndex < this.seriesList.length) {
            return { ...this.seriesList[this.currentSeriesIndex] };
        }
        return null;
    }
    
    /**
     * Get current series index
     * @returns Current series index (-1 if none)
     */
    public getCurrentSeriesIndex(): number {
        return this.currentSeriesIndex;
    }
    
    /**
     * Set current series by index
     * @param index - Series index to set as current
     * @returns True if set successfully
     */
    public setCurrentSeries(index: number): boolean {
        if (index >= 0 && index < this.seriesList.length) {
            const previousIndex = this.currentSeriesIndex;
            this.currentSeriesIndex = index;
            
            if (previousIndex !== index) {
                console.log(`Changed current series to index ${index}: ${this.seriesList[index].description}`);
                this.notifySeriesChanged();
            }
            return true;
        }
        console.warn(`Invalid series index: ${index}, available: 0-${this.seriesList.length - 1}`);
        return false;
    }
    
    /**
     * Set current series by ID
     * @param seriesId - Series ID to set as current
     * @returns True if set successfully
     */
    public setCurrentSeriesById(seriesId: string): boolean {
        const index = this.seriesList.findIndex(s => s.id === seriesId);
        if (index !== -1) {
            return this.setCurrentSeries(index);
        }
        console.warn(`Series with ID ${seriesId} not found`);
        return false;
    }
    
    /**
     * Get total number of series
     * @returns Series count
     */
    public getSeriesCount(): number {
        return this.seriesList.length;
    }
    
    /**
     * Navigate to next series
     * @returns True if navigation successful
     */
    public nextSeries(): boolean {
        if (this.currentSeriesIndex < this.seriesList.length - 1) {
            return this.setCurrentSeries(this.currentSeriesIndex + 1);
        }
        return false;
    }
    
    /**
     * Navigate to previous series
     * @returns True if navigation successful
     */
    public previousSeries(): boolean {
        if (this.currentSeriesIndex > 0) {
            return this.setCurrentSeries(this.currentSeriesIndex - 1);
        }
        return false;
    }
    
    /**
     * Check if there is a next series
     * @returns True if next series exists
     */
    public hasNextSeries(): boolean {
        return this.currentSeriesIndex < this.seriesList.length - 1;
    }
    
    /**
     * Check if there is a previous series
     * @returns True if previous series exists
     */
    public hasPreviousSeries(): boolean {
        return this.currentSeriesIndex > 0;
    }
    
    /**
     * Clear all series
     */
    public clearAllSeries(): void {
        this.seriesList = [];
        this.currentSeriesIndex = -1;
        this.notifySeriesChanged();
        console.log('Cleared all series');
    }
    
    /**
     * Update series information
     * @param index - Series index to update
     * @param updates - Partial series info to update
     * @returns True if updated successfully
     */
    public updateSeries(index: number, updates: Partial<SeriesInfo>): boolean {
        if (index >= 0 && index < this.seriesList.length) {
            this.seriesList[index] = { ...this.seriesList[index], ...updates };
            console.log(`Updated series at index ${index}`);
            return true;
        }
        return false;
    }
    
    /**
     * Update series by ID
     * @param seriesId - Series ID to update
     * @param updates - Partial series info to update
     * @returns True if updated successfully
     */
    public updateSeriesById(seriesId: string, updates: Partial<SeriesInfo>): boolean {
        const index = this.seriesList.findIndex(s => s.id === seriesId);
        if (index !== -1) {
            return this.updateSeries(index, updates);
        }
        return false;
    }
    
    /**
     * Search series by description or metadata
     * @param searchTerm - Search term
     * @returns Array of matching series
     */
    public searchSeries(searchTerm: string): SeriesInfo[] {
        const term = searchTerm.toLowerCase();
        return this.seriesList.filter(series => 
            series.description.toLowerCase().includes(term) ||
            series.modality?.toLowerCase().includes(term) ||
            series.patientName?.toLowerCase().includes(term)
        ).map(s => ({ ...s }));
    }
    
    /**
     * Get series statistics
     * @returns Statistics object
     */
    public getStatistics(): any {
        const totalImages = this.seriesList.reduce((sum, series) => sum + series.imageCount, 0);
        const modalities = [...new Set(this.seriesList.map(s => s.modality).filter(Boolean))];
        
        return {
            totalSeries: this.seriesList.length,
            totalImages: totalImages,
            currentSeries: this.currentSeriesIndex + 1,
            modalities: modalities,
            hasCurrentSeries: this.currentSeriesIndex !== -1
        };
    }
    
    /**
     * Add callback for series change events
     * @param callback - Callback function
     */
    public onSeriesChanged(callback: (series: SeriesInfo | null, index: number) => void): void {
        this.onSeriesChangedCallbacks.push(callback);
    }
    
    /**
     * Remove callback for series change events
     * @param callback - Callback function to remove
     */
    public removeSeriesChangedCallback(callback: (series: SeriesInfo | null, index: number) => void): void {
        const index = this.onSeriesChangedCallbacks.indexOf(callback);
        if (index !== -1) {
            this.onSeriesChangedCallbacks.splice(index, 1);
        }
    }
    
    /**
     * Notify all callbacks of series change
     */
    private notifySeriesChanged(): void {
        const currentSeries = this.getCurrentSeries();
        this.onSeriesChangedCallbacks.forEach(callback => {
            try {
                callback(currentSeries, this.currentSeriesIndex);
            } catch (error) {
                console.error('Error in series changed callback:', error);
            }
        });
    }
    
    /**
     * Create series from DICOM file metadata
     * @param files - Array of DICOM files
     * @returns Promise that resolves to created series info
     */
    public async createSeriesFromFiles(files: File[]): Promise<SeriesInfo[]> {
        const seriesMap = new Map<string, SeriesInfo>();
        
        for (const file of files) {
            try {
                // For this implementation, we'll create a simple series based on file names
                // In a real implementation, you would parse DICOM metadata
                const seriesId = this.extractSeriesIdFromFile(file);
                
                if (!seriesMap.has(seriesId)) {
                    seriesMap.set(seriesId, {
                        id: seriesId,
                        description: `Series ${seriesId}`,
                        imageIds: [],
                        imageCount: 0,
                        modality: 'CT', // Default, should be extracted from DICOM
                        studyDate: new Date().toISOString().split('T')[0],
                        patientName: 'Unknown'
                    });
                }
                
                const series = seriesMap.get(seriesId)!;
                const imageId = `wadouri:${file.name}`;
                series.imageIds.push(imageId);
                series.imageCount = series.imageIds.length;
            } catch (error) {
                console.warn(`Error processing file ${file.name}:`, error);
            }
        }
        
        const createdSeries = Array.from(seriesMap.values());
        console.log(`Created ${createdSeries.length} series from ${files.length} files`);
        
        return createdSeries;
    }
    
    /**
     * Extract series ID from file (simple implementation)
     * @param file - DICOM file
     * @returns Series ID
     */
    private extractSeriesIdFromFile(file: File): string {
        // Simple implementation: use file name pattern or just create sequential IDs
        // In a real implementation, you would parse DICOM Series Instance UID
        const fileName = file.name.toLowerCase();
        
        // Try to extract series from common naming patterns
        const patterns = [
            /series[_-]?(\d+)/i,
            /ser[_-]?(\d+)/i,
            /s(\d+)/i
        ];
        
        for (const pattern of patterns) {
            const match = fileName.match(pattern);
            if (match) {
                return `series_${match[1]}`;
            }
        }
        
        // Default: create series based on file name prefix
        const baseName = file.name.split('.')[0];
        return `series_${baseName}`;
    }
}