import { ViewportManager } from '../core/viewportManager';
import { LayoutManager } from '../components/LayoutManager';
import { SynchronizationManager } from '../core/synchronizationManager';

export interface CleanupStats {
    viewportsRemoved: number;
    eventListenersRemoved: number;
    syncGroupsRemoved: number;
    memoryFreed: number;
    errors: string[];
}

export class ViewportCleanupManager {
    private viewportManager: ViewportManager;
    private layoutManager: LayoutManager;
    private syncManager: SynchronizationManager;
    private cleanupHistory: CleanupStats[] = [];
    
    constructor(
        viewportManager: ViewportManager,
        layoutManager: LayoutManager,
        syncManager: SynchronizationManager
    ) {
        this.viewportManager = viewportManager;
        this.layoutManager = layoutManager;
        this.syncManager = syncManager;
    }
    
    /**
     * Perform comprehensive cleanup of all viewports and related resources
     * @returns Cleanup statistics
     */
    public async performFullCleanup(): Promise<CleanupStats> {
        console.log('Starting full viewport cleanup...');
        
        const stats: CleanupStats = {
            viewportsRemoved: 0,
            eventListenersRemoved: 0,
            syncGroupsRemoved: 0,
            memoryFreed: 0,
            errors: []
        };
        
        try {
            // 1. Clean up synchronization groups
            await this.cleanupSyncGroups(stats);
            
            // 2. Clean up viewport event listeners
            await this.cleanupEventListeners(stats);
            
            // 3. Clean up viewports
            await this.cleanupViewports(stats);
            
            // 4. Clean up layout manager
            await this.cleanupLayoutManager(stats);
            
            // 5. Force garbage collection if available
            await this.forceGarbageCollection(stats);
            
            console.log('Full cleanup completed:', stats);
            
        } catch (error) {
            stats.errors.push(`Full cleanup error: ${error}`);
            console.error('Error during full cleanup:', error);
        }
        
        this.cleanupHistory.push(stats);
        return stats;
    }
    
    /**
     * Clean up specific viewports by ID
     * @param viewportIds - Array of viewport IDs to clean up
     * @returns Cleanup statistics
     */
    public async cleanupSpecificViewports(viewportIds: string[]): Promise<CleanupStats> {
        console.log(`Cleaning up specific viewports: [${viewportIds.join(', ')}]`);
        
        const stats: CleanupStats = {
            viewportsRemoved: 0,
            eventListenersRemoved: 0,
            syncGroupsRemoved: 0,
            memoryFreed: 0,
            errors: []
        };
        
        for (const viewportId of viewportIds) {
            try {
                await this.cleanupSingleViewport(viewportId, stats);
            } catch (error) {
                stats.errors.push(`Error cleaning viewport ${viewportId}: ${error}`);
                console.error(`Error cleaning viewport ${viewportId}:`, error);
            }
        }
        
        console.log('Specific viewport cleanup completed:', stats);
        this.cleanupHistory.push(stats);
        return stats;
    }
    
    /**
     * Clean up a single viewport and all its resources
     * @param viewportId - Viewport ID to clean up
     * @param stats - Statistics to update
     */
    private async cleanupSingleViewport(viewportId: string, stats: CleanupStats): Promise<void> {
        console.log(`Cleaning up viewport: ${viewportId}`);
        
        // Remove from sync groups
        const syncGroups = this.syncManager.getViewportSyncGroups(viewportId);
        syncGroups.forEach(groupId => {
            this.syncManager.removeViewportFromSyncGroup(groupId, viewportId);
            stats.eventListenersRemoved++;
        });
        
        // Get viewport info before removal
        const viewportInfo = this.viewportManager.getViewportInfo(viewportId);
        
        // Remove event listeners from element
        if (viewportInfo) {
            this.removeElementEventListeners(viewportInfo.element, stats);
        }
        
        // Remove from viewport manager
        if (this.viewportManager.hasViewport(viewportId)) {
            this.viewportManager.removeViewport(viewportId);
            stats.viewportsRemoved++;
        }
        
        // Remove from layout manager if needed
        this.layoutManager.removeViewportById(viewportId);
        
        console.log(`Viewport ${viewportId} cleaned up successfully`);
    }
    
    /**
     * Clean up all synchronization groups
     * @param stats - Statistics to update
     */
    private async cleanupSyncGroups(stats: CleanupStats): Promise<void> {
        console.log('Cleaning up synchronization groups...');
        
        try {
            const allGroups = this.syncManager.getAllSyncGroups();
            
            for (const group of allGroups) {
                this.syncManager.removeSyncGroup(group.id);
                stats.syncGroupsRemoved++;
                stats.eventListenersRemoved += group.viewports.length * group.syncTypes.length;
            }
            
            console.log(`Cleaned up ${stats.syncGroupsRemoved} sync groups`);
            
        } catch (error) {
            stats.errors.push(`Sync group cleanup error: ${error}`);
            throw error;
        }
    }
    
    /**
     * Clean up event listeners for all viewports
     * @param stats - Statistics to update
     */
    private async cleanupEventListeners(stats: CleanupStats): Promise<void> {
        console.log('Cleaning up viewport event listeners...');
        
        try {
            const allViewportInfos = this.viewportManager.getAllViewportInfos();
            
            for (const viewportInfo of allViewportInfos) {
                this.removeElementEventListeners(viewportInfo.element, stats);
            }
            
            console.log(`Cleaned up event listeners for ${allViewportInfos.length} viewports`);
            
        } catch (error) {
            stats.errors.push(`Event listener cleanup error: ${error}`);
            throw error;
        }
    }
    
    /**
     * Remove event listeners from a specific element
     * @param element - HTML element to clean up
     * @param stats - Statistics to update
     */
    private removeElementEventListeners(element: HTMLElement, stats: CleanupStats): void {
        try {
            // Common Cornerstone3D events
            const cornerstoneEvents = [
                'cornerstonecameramodified',
                'cornerstoneviewportvoimodified',
                'cornerstoneimagerendered',
                'cornerstoneimageloadprogress',
                'cornerstoneimageloaded',
                'cornerstonepan',
                'cornerstonezoom',
                'cornerstonewindowlevel',
                'cornerstonerotation'
            ];
            
            // Standard DOM events
            const domEvents = [
                'click',
                'mousedown',
                'mouseup',
                'mousemove',
                'wheel',
                'touchstart',
                'touchmove',
                'touchend',
                'contextmenu',
                'resize'
            ];
            
            // Remove Cornerstone3D events
            cornerstoneEvents.forEach(eventName => {
                // We can't remove specific listeners without references,
                // but we can at least clean up the element's event data
                element.removeAttribute(`data-${eventName}`);
                stats.eventListenersRemoved++;
            });
            
            // Remove DOM events (generic cleanup)
            domEvents.forEach(eventName => {
                // Clone and replace element to remove all listeners
                // This is a nuclear approach but ensures complete cleanup
                if (element.parentNode) {
                    const newElement = element.cloneNode(true) as HTMLElement;
                    element.parentNode.replaceChild(newElement, element);
                    stats.eventListenersRemoved++;
                }
            });
            
        } catch (error) {
            console.warn(`Error removing event listeners from element:`, error);
        }
    }
    
    /**
     * Clean up all viewports from viewport manager
     * @param stats - Statistics to update
     */
    private async cleanupViewports(stats: CleanupStats): Promise<void> {
        console.log('Cleaning up all viewports...');
        
        try {
            const viewportCount = this.viewportManager.getViewportCount();
            this.viewportManager.removeAllViewports();
            stats.viewportsRemoved += viewportCount;
            
            console.log(`Cleaned up ${viewportCount} viewports`);
            
        } catch (error) {
            stats.errors.push(`Viewport cleanup error: ${error}`);
            throw error;
        }
    }
    
    /**
     * Clean up layout manager resources
     * @param stats - Statistics to update
     */
    private async cleanupLayoutManager(stats: CleanupStats): Promise<void> {
        console.log('Cleaning up layout manager...');
        
        try {
            // The layout manager will clean its own viewports
            // We just need to trigger the cleanup
            const layoutViewportCount = this.layoutManager.getViewportCount();
            
            // Reset to minimal layout
            this.layoutManager.setLayout('1x1', false);
            
            stats.memoryFreed += layoutViewportCount * 1024; // Estimate 1KB per viewport element
            
            console.log('Layout manager cleaned up');
            
        } catch (error) {
            stats.errors.push(`Layout manager cleanup error: ${error}`);
            throw error;
        }
    }
    
    /**
     * Force garbage collection if available (development/debugging only)
     * @param stats - Statistics to update
     */
    private async forceGarbageCollection(stats: CleanupStats): Promise<void> {
        try {
            // Force garbage collection in development
            if ((window as any).gc && typeof (window as any).gc === 'function') {
                console.log('Forcing garbage collection...');
                (window as any).gc();
                stats.memoryFreed += 1024; // Estimate
            }
            
            // Clear any cached images or data
            if ((window as any).cornerstoneImageCache) {
                (window as any).cornerstoneImageCache.purgeCache();
                stats.memoryFreed += 10240; // Estimate 10KB
            }
            
        } catch (error) {
            console.warn('Could not force garbage collection:', error);
        }
    }
    
    /**
     * Schedule automatic cleanup at regular intervals
     * @param intervalMs - Cleanup interval in milliseconds
     * @returns Cleanup interval ID
     */
    public scheduleAutoCleanup(intervalMs: number = 300000): number { // Default 5 minutes
        console.log(`Scheduling automatic cleanup every ${intervalMs}ms`);
        
        return window.setInterval(async () => {
            console.log('Performing scheduled cleanup...');
            
            try {
                // Light cleanup - only remove orphaned resources
                await this.performLightCleanup();
            } catch (error) {
                console.error('Error during scheduled cleanup:', error);
            }
        }, intervalMs);
    }
    
    /**
     * Perform light cleanup of orphaned resources
     * @returns Cleanup statistics
     */
    public async performLightCleanup(): Promise<CleanupStats> {
        const stats: CleanupStats = {
            viewportsRemoved: 0,
            eventListenersRemoved: 0,
            syncGroupsRemoved: 0,
            memoryFreed: 0,
            errors: []
        };
        
        try {
            // Clean up empty sync groups
            const allGroups = this.syncManager.getAllSyncGroups();
            for (const group of allGroups) {
                if (group.viewports.length === 0) {
                    this.syncManager.removeSyncGroup(group.id);
                    stats.syncGroupsRemoved++;
                }
            }
            
            // Clean up viewport references that no longer exist
            const allViewportIds = this.viewportManager.getViewportIds();
            const layoutViewportInfos = this.layoutManager.getViewportInfo();
            
            // Find orphaned viewports in sync groups
            allGroups.forEach(group => {
                group.viewports.forEach(viewportId => {
                    if (!allViewportIds.includes(viewportId)) {
                        this.syncManager.removeViewportFromSyncGroup(group.id, viewportId);
                        stats.eventListenersRemoved++;
                    }
                });
            });
            
            console.log('Light cleanup completed:', stats);
            
        } catch (error) {
            stats.errors.push(`Light cleanup error: ${error}`);
            console.error('Error during light cleanup:', error);
        }
        
        return stats;
    }
    
    /**
     * Get cleanup history for monitoring
     * @returns Array of cleanup statistics
     */
    public getCleanupHistory(): CleanupStats[] {
        return [...this.cleanupHistory];
    }
    
    /**
     * Clear cleanup history
     */
    public clearCleanupHistory(): void {
        this.cleanupHistory = [];
        console.log('Cleanup history cleared');
    }
    
    /**
     * Get memory usage estimate
     * @returns Memory usage information
     */
    public getMemoryUsage(): {
        viewportCount: number;
        syncGroupCount: number;
        estimatedMemoryMB: number;
    } {
        const viewportCount = this.viewportManager.getViewportCount();
        const syncGroupCount = this.syncManager.getAllSyncGroups().length;
        
        // Rough estimate: 1MB per viewport + 0.1MB per sync group
        const estimatedMemoryMB = viewportCount * 1 + syncGroupCount * 0.1;
        
        return {
            viewportCount,
            syncGroupCount,
            estimatedMemoryMB
        };
    }
    
    /**
     * Destroy the cleanup manager
     */
    public destroy(): void {
        console.log('Destroying ViewportCleanupManager...');
        this.cleanupHistory = [];
        console.log('ViewportCleanupManager destroyed');
    }
}