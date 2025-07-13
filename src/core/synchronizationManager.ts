import { Types, Enums } from '@cornerstonejs/core';
import { 
    SynchronizerManager
} from '@cornerstonejs/tools';
import { ViewportManager } from './viewportManager';

export interface SyncGroup {
    id: string;
    viewports: string[]; // viewport IDs
    active: boolean;
    syncTypes: SyncType[];
}

export enum SyncType {
    PAN = 'pan',
    ZOOM = 'zoom',
    WINDOW_LEVEL = 'windowLevel',
    ROTATION = 'rotation',
    FLIP = 'flip',
    CAMERA = 'camera'
}

export interface SyncEvent {
    sourceViewportId: string;
    syncType: SyncType;
    data: any;
    timestamp: number;
}

export class SynchronizationManager {
    private syncGroups: Map<string, SyncGroup> = new Map();
    private viewportManager: ViewportManager;
    private activeSynchronizers: Map<string, any> = new Map();
    private isProcessingSync: boolean = false;
    private eventListeners: Map<string, Map<SyncType, (event: any) => void>> = new Map();
    
    constructor(viewportManager: ViewportManager) {
        this.viewportManager = viewportManager;
    }
    
    /**
     * Create a new synchronization group using official Cornerstone3D synchronizers
     * @param groupId - Unique identifier for the sync group
     * @param syncTypes - Array of sync types to enable
     * @returns The created sync group
     */
    public createSyncGroup(groupId: string, syncTypes: SyncType[] = []): SyncGroup {
        const group: SyncGroup = {
            id: groupId,
            viewports: [],
            active: true,
            syncTypes: [...syncTypes]
        };
        
        // Create official Cornerstone3D synchronizers
        if (syncTypes.includes(SyncType.CAMERA) || syncTypes.includes(SyncType.PAN) || syncTypes.includes(SyncType.ZOOM)) {
            try {
                const cameraSynchronizer = SynchronizerManager.createSynchronizer(
                    `${groupId}-camera`,
                    Enums.Events.CAMERA_MODIFIED,
                    (synchronizerInstance: any, sourceViewport: any, targetViewport: any, cameraModifiedEvent: any) => {
                        const { camera } = cameraModifiedEvent.detail;
                        if (camera) {
                            targetViewport.setCamera(camera);
                            targetViewport.render();
                        }
                    }
                );
                this.activeSynchronizers.set(`${groupId}-camera`, cameraSynchronizer);
                console.log(`✓ Camera synchronizer created for group ${groupId}`);
            } catch (error) {
                console.warn(`Failed to create camera synchronizer for group ${groupId}:`, error);
            }
        }
        
        if (syncTypes.includes(SyncType.WINDOW_LEVEL)) {
            try {
                const voiSynchronizer = SynchronizerManager.createSynchronizer(
                    `${groupId}-voi`,
                    Enums.Events.VOI_MODIFIED,
                    (synchronizerInstance: any, sourceViewport: any, targetViewport: any, voiModifiedEvent: any) => {
                        const { range } = voiModifiedEvent.detail;
                        if (range) {
                            targetViewport.setProperties({ voiRange: range });
                            targetViewport.render();
                        }
                    }
                );
                this.activeSynchronizers.set(`${groupId}-voi`, voiSynchronizer);
                console.log(`✓ VOI synchronizer created for group ${groupId}`);
            } catch (error) {
                console.warn(`Failed to create VOI synchronizer for group ${groupId}:`, error);
            }
        }
        
        this.syncGroups.set(groupId, group);
        console.log(`Created sync group: ${groupId} with types: [${syncTypes.join(', ')}]`);
        
        return group;
    }
    
    /**
     * Add a viewport to a synchronization group
     * @param groupId - Sync group ID
     * @param viewportId - Viewport ID to add
     * @returns True if successfully added
     */
    public addViewportToSyncGroup(groupId: string, viewportId: string): boolean {
        const group = this.syncGroups.get(groupId);
        if (!group) {
            console.warn(`Sync group ${groupId} not found`);
            return false;
        }
        
        // Check if viewport exists
        if (!this.viewportManager.hasViewport(viewportId)) {
            console.warn(`Viewport ${viewportId} not found in ViewportManager`);
            return false;
        }
        
        // Check if already in group
        if (group.viewports.includes(viewportId)) {
            console.warn(`Viewport ${viewportId} already in sync group ${groupId}`);
            return false;
        }
        
        // Add to group
        group.viewports.push(viewportId);
        
        // Add viewport to synchronizers
        const viewportInfo = this.viewportManager.getViewportInfo(viewportId);
        if (viewportInfo) {
            const cameraSynchronizer = this.activeSynchronizers.get(`${groupId}-camera`);
            const voiSynchronizer = this.activeSynchronizers.get(`${groupId}-voi`);
            
            if (cameraSynchronizer) {
                try {
                    cameraSynchronizer.add({
                        renderingEngineId: 'default-rendering-engine',
                        viewportId: viewportId
                    });
                } catch (error) {
                    console.warn(`Failed to add viewport to camera synchronizer:`, error);
                }
            }
            
            if (voiSynchronizer) {
                try {
                    voiSynchronizer.add({
                        renderingEngineId: 'default-rendering-engine',
                        viewportId: viewportId
                    });
                } catch (error) {
                    console.warn(`Failed to add viewport to VOI synchronizer:`, error);
                }
            }
        }
        
        // Set up additional synchronization for the viewport
        this.setupViewportSyncListeners(viewportId, group);
        
        console.log(`Added viewport ${viewportId} to sync group ${groupId}`);
        return true;
    }
    
    /**
     * Remove a viewport from a synchronization group
     * @param groupId - Sync group ID
     * @param viewportId - Viewport ID to remove
     * @returns True if successfully removed
     */
    public removeViewportFromSyncGroup(groupId: string, viewportId: string): boolean {
        const group = this.syncGroups.get(groupId);
        if (!group) {
            console.warn(`Sync group ${groupId} not found`);
            return false;
        }
        
        const index = group.viewports.indexOf(viewportId);
        if (index === -1) {
            console.warn(`Viewport ${viewportId} not found in sync group ${groupId}`);
            return false;
        }
        
        // Remove from group
        group.viewports.splice(index, 1);
        
        // Remove event listeners for this viewport
        this.removeViewportSyncListeners(viewportId);
        
        console.log(`Removed viewport ${viewportId} from sync group ${groupId}`);
        return true;
    }
    
    /**
     * Enable a synchronization group
     * @param groupId - Sync group ID
     * @returns True if successfully enabled
     */
    public enableSyncGroup(groupId: string): boolean {
        const group = this.syncGroups.get(groupId);
        if (!group) {
            console.warn(`Sync group ${groupId} not found`);
            return false;
        }
        
        group.active = true;
        console.log(`Enabled sync group: ${groupId}`);
        return true;
    }
    
    /**
     * Disable a synchronization group
     * @param groupId - Sync group ID
     * @returns True if successfully disabled
     */
    public disableSyncGroup(groupId: string): boolean {
        const group = this.syncGroups.get(groupId);
        if (!group) {
            console.warn(`Sync group ${groupId} not found`);
            return false;
        }
        
        group.active = false;
        console.log(`Disabled sync group: ${groupId}`);
        return true;
    }
    
    /**
     * Add sync types to an existing group
     * @param groupId - Sync group ID
     * @param syncTypes - Array of sync types to add
     * @returns True if successfully updated
     */
    public addSyncTypes(groupId: string, syncTypes: SyncType[]): boolean {
        const group = this.syncGroups.get(groupId);
        if (!group) {
            console.warn(`Sync group ${groupId} not found`);
            return false;
        }
        
        // Add new sync types (avoid duplicates)
        syncTypes.forEach(type => {
            if (!group.syncTypes.includes(type)) {
                group.syncTypes.push(type);
            }
        });
        
        // Re-setup listeners for all viewports in the group
        group.viewports.forEach(viewportId => {
            this.removeViewportSyncListeners(viewportId);
            this.setupViewportSyncListeners(viewportId, group);
        });
        
        console.log(`Added sync types [${syncTypes.join(', ')}] to group ${groupId}`);
        return true;
    }
    
    /**
     * Remove sync types from an existing group
     * @param groupId - Sync group ID
     * @param syncTypes - Array of sync types to remove
     * @returns True if successfully updated
     */
    public removeSyncTypes(groupId: string, syncTypes: SyncType[]): boolean {
        const group = this.syncGroups.get(groupId);
        if (!group) {
            console.warn(`Sync group ${groupId} not found`);
            return false;
        }
        
        // Remove sync types
        syncTypes.forEach(type => {
            const index = group.syncTypes.indexOf(type);
            if (index !== -1) {
                group.syncTypes.splice(index, 1);
            }
        });
        
        // Re-setup listeners for all viewports in the group
        group.viewports.forEach(viewportId => {
            this.removeViewportSyncListeners(viewportId);
            this.setupViewportSyncListeners(viewportId, group);
        });
        
        console.log(`Removed sync types [${syncTypes.join(', ')}] from group ${groupId}`);
        return true;
    }
    
    /**
     * Synchronize viewports based on an event
     * @param sourceViewportId - The viewport that triggered the event
     * @param syncType - Type of synchronization
     * @param data - Data to synchronize
     */
    public synchronizeViewports(sourceViewportId: string, syncType: SyncType, data: any): void {
        if (this.isProcessingSync) {
            return; // Prevent infinite loops
        }
        
        this.isProcessingSync = true;
        
        try {
            // Find all sync groups containing this viewport
            const relevantGroups = Array.from(this.syncGroups.values()).filter(group =>
                group.active &&
                group.viewports.includes(sourceViewportId) &&
                group.syncTypes.includes(syncType)
            );
            
            relevantGroups.forEach(group => {
                group.viewports.forEach(targetViewportId => {
                    if (targetViewportId !== sourceViewportId) {
                        this.applySyncToViewport(targetViewportId, syncType, data);
                    }
                });
            });
            
        } catch (error) {
            console.error('Error during viewport synchronization:', error);
        } finally {
            this.isProcessingSync = false;
        }
    }
    
    /**
     * Apply synchronization data to a specific viewport
     * @param viewportId - Target viewport ID
     * @param syncType - Type of synchronization
     * @param data - Data to apply
     */
    private applySyncToViewport(viewportId: string, syncType: SyncType, data: any): void {
        const viewport = this.viewportManager.getViewport(viewportId);
        if (!viewport) {
            console.warn(`Cannot sync: viewport ${viewportId} not found`);
            return;
        }
        
        try {
            switch (syncType) {
                case SyncType.PAN:
                    this.applyPanSync(viewport, data);
                    break;
                case SyncType.ZOOM:
                    this.applyZoomSync(viewport, data);
                    break;
                case SyncType.WINDOW_LEVEL:
                    this.applyWindowLevelSync(viewport, data);
                    break;
                case SyncType.ROTATION:
                    this.applyRotationSync(viewport, data);
                    break;
                case SyncType.FLIP:
                    this.applyFlipSync(viewport, data);
                    break;
                case SyncType.CAMERA:
                    this.applyCameraSync(viewport, data);
                    break;
                default:
                    console.warn(`Unknown sync type: ${syncType}`);
            }
            
            viewport.render();
            
        } catch (error) {
            console.error(`Error applying ${syncType} sync to viewport ${viewportId}:`, error);
        }
    }
    
    /**
     * Apply pan synchronization
     */
    private applyPanSync(viewport: Types.IViewport, data: any): void {
        if ('setCamera' in viewport && data.camera) {
            (viewport as any).setCamera({
                ...data.camera,
                position: data.camera.position
            });
        }
    }
    
    /**
     * Apply zoom synchronization
     */
    private applyZoomSync(viewport: Types.IViewport, data: any): void {
        if ('setCamera' in viewport && data.camera) {
            (viewport as any).setCamera({
                ...data.camera,
                parallelScale: data.camera.parallelScale
            });
        }
    }
    
    /**
     * Apply window/level synchronization
     */
    private applyWindowLevelSync(viewport: Types.IViewport, data: any): void {
        if ('setProperties' in viewport && data.voiRange) {
            (viewport as any).setProperties({
                voiRange: data.voiRange
            });
        }
    }
    
    /**
     * Apply rotation synchronization
     */
    private applyRotationSync(viewport: Types.IViewport, data: any): void {
        if ('setCamera' in viewport && data.camera) {
            (viewport as any).setCamera({
                ...data.camera,
                viewUp: data.camera.viewUp
            });
        }
    }
    
    /**
     * Apply flip synchronization
     */
    private applyFlipSync(viewport: Types.IViewport, data: any): void {
        if ('setCamera' in viewport && data.camera) {
            (viewport as any).setCamera(data.camera);
        }
    }
    
    /**
     * Apply full camera synchronization
     */
    private applyCameraSync(viewport: Types.IViewport, data: any): void {
        if ('setCamera' in viewport && data.camera) {
            (viewport as any).setCamera(data.camera);
        }
    }
    
    /**
     * Set up event listeners for viewport synchronization
     * @param viewportId - Viewport ID
     * @param group - Sync group configuration
     */
    private setupViewportSyncListeners(viewportId: string, group: SyncGroup): void {
        const viewport = this.viewportManager.getViewport(viewportId);
        const viewportInfo = this.viewportManager.getViewportInfo(viewportId);
        
        if (!viewport || !viewportInfo) {
            console.warn(`Cannot setup sync listeners: viewport ${viewportId} not found`);
            return;
        }
        
        const element = viewportInfo.element;
        const listeners = new Map<SyncType, (event: any) => void>();
        
        // Pan synchronization
        if (group.syncTypes.includes(SyncType.PAN)) {
            const panListener = (event: any) => {
                if (!this.isProcessingSync) {
                    const camera = (viewport as any).getCamera();
                    this.synchronizeViewports(viewportId, SyncType.PAN, { camera });
                }
            };
            element.addEventListener('cornerstonecameramodified', panListener);
            listeners.set(SyncType.PAN, panListener);
        }
        
        // Zoom synchronization
        if (group.syncTypes.includes(SyncType.ZOOM)) {
            const zoomListener = (event: any) => {
                if (!this.isProcessingSync) {
                    const camera = (viewport as any).getCamera();
                    this.synchronizeViewports(viewportId, SyncType.ZOOM, { camera });
                }
            };
            element.addEventListener('cornerstonecameramodified', zoomListener);
            listeners.set(SyncType.ZOOM, zoomListener);
        }
        
        // Window/Level synchronization
        if (group.syncTypes.includes(SyncType.WINDOW_LEVEL)) {
            const wlListener = (event: any) => {
                if (!this.isProcessingSync && event.detail && event.detail.voiRange) {
                    this.synchronizeViewports(viewportId, SyncType.WINDOW_LEVEL, {
                        voiRange: event.detail.voiRange
                    });
                }
            };
            element.addEventListener('cornerstoneviewportvoimodified', wlListener);
            listeners.set(SyncType.WINDOW_LEVEL, wlListener);
        }
        
        // Camera synchronization (includes pan, zoom, rotation)
        if (group.syncTypes.includes(SyncType.CAMERA)) {
            const cameraListener = (event: any) => {
                if (!this.isProcessingSync) {
                    const camera = (viewport as any).getCamera();
                    this.synchronizeViewports(viewportId, SyncType.CAMERA, { camera });
                }
            };
            element.addEventListener('cornerstonecameramodified', cameraListener);
            listeners.set(SyncType.CAMERA, cameraListener);
        }
        
        this.eventListeners.set(viewportId, listeners);
        console.log(`Setup sync listeners for viewport ${viewportId}`);
    }
    
    /**
     * Remove event listeners for a viewport
     * @param viewportId - Viewport ID
     */
    private removeViewportSyncListeners(viewportId: string): void {
        const listeners = this.eventListeners.get(viewportId);
        const viewportInfo = this.viewportManager.getViewportInfo(viewportId);
        
        if (!listeners || !viewportInfo) {
            return;
        }
        
        const element = viewportInfo.element;
        
        // Remove all listeners
        listeners.forEach((listener, syncType) => {
            switch (syncType) {
                case SyncType.PAN:
                case SyncType.ZOOM:
                case SyncType.ROTATION:
                case SyncType.CAMERA:
                    element.removeEventListener('cornerstonecameramodified', listener);
                    break;
                case SyncType.WINDOW_LEVEL:
                    element.removeEventListener('cornerstoneviewportvoimodified', listener);
                    break;
            }
        });
        
        this.eventListeners.delete(viewportId);
        console.log(`Removed sync listeners for viewport ${viewportId}`);
    }
    
    /**
     * Get all sync groups
     * @returns Array of sync groups
     */
    public getAllSyncGroups(): SyncGroup[] {
        return Array.from(this.syncGroups.values());
    }
    
    /**
     * Get a specific sync group
     * @param groupId - Sync group ID
     * @returns Sync group or undefined
     */
    public getSyncGroup(groupId: string): SyncGroup | undefined {
        return this.syncGroups.get(groupId);
    }
    
    /**
     * Remove a sync group completely
     * @param groupId - Sync group ID
     * @returns True if successfully removed
     */
    public removeSyncGroup(groupId: string): boolean {
        const group = this.syncGroups.get(groupId);
        if (!group) {
            console.warn(`Sync group ${groupId} not found`);
            return false;
        }
        
        // Remove all viewports from the group
        [...group.viewports].forEach(viewportId => {
            this.removeViewportFromSyncGroup(groupId, viewportId);
        });
        
        // Remove the group
        this.syncGroups.delete(groupId);
        console.log(`Removed sync group: ${groupId}`);
        return true;
    }
    
    /**
     * Check if a viewport is in any sync group
     * @param viewportId - Viewport ID
     * @returns Array of sync group IDs containing this viewport
     */
    public getViewportSyncGroups(viewportId: string): string[] {
        return Array.from(this.syncGroups.entries())
            .filter(([_, group]) => group.viewports.includes(viewportId))
            .map(([groupId, _]) => groupId);
    }
    
    /**
     * Create a default sync group with all current viewports
     * @param syncTypes - Array of sync types to enable
     * @returns The created sync group ID
     */
    public createDefaultSyncGroup(syncTypes: SyncType[] = [SyncType.PAN, SyncType.ZOOM, SyncType.WINDOW_LEVEL]): string {
        const groupId = 'default-sync-group';
        
        // Remove existing default group if it exists
        if (this.syncGroups.has(groupId)) {
            this.removeSyncGroup(groupId);
        }
        
        // Create new group
        this.createSyncGroup(groupId, syncTypes);
        
        // Add all current viewports
        const allViewportIds = this.viewportManager.getViewportIds();
        allViewportIds.forEach(viewportId => {
            this.addViewportToSyncGroup(groupId, viewportId);
        });
        
        console.log(`Created default sync group with ${allViewportIds.length} viewports`);
        return groupId;
    }
    
    /**
     * Destroy the synchronization manager and clean up
     */
    public destroy(): void {
        console.log('Destroying SynchronizationManager...');
        
        // Remove all sync groups
        const groupIds = Array.from(this.syncGroups.keys());
        groupIds.forEach(groupId => {
            this.removeSyncGroup(groupId);
        });
        
        this.syncGroups.clear();
        this.eventListeners.clear();
        
        console.log('SynchronizationManager destroyed');
    }
}