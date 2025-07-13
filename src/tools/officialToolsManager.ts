import {
    ToolGroupManager,
    Enums as ToolEnums,
    annotation,
    SynchronizerManager,
    // Basic Tools
    PanTool,
    ZoomTool,
    WindowLevelTool,
    StackScrollTool,
    // Measurement Tools
    LengthTool,
    AngleTool,
    HeightTool,
    BidirectionalTool,
    CobbAngleTool,
    ProbeTool,
    // ROI Tools
    RectangleROITool,
    EllipticalROITool,
    CircleROITool,
    SplineROITool,
    // Annotation Tools
    ArrowAnnotateTool,
    LabelTool,
    // Advanced Tools
    CrosshairsTool,
    MagnifyTool,
    TrackballRotateTool,
    DragProbeTool,
    ReferenceLinesTool,
    // Segmentation Tools
    BrushTool,
    RectangleScissorsTool,
    CircleScissorsTool,
    SphereScissorsTool,
    // Overlay Tools
    OverlayGridTool,
    ScaleOverlayTool,
    OrientationMarkerTool,
    ETDRSGridTool
} from '@cornerstonejs/tools';

export interface ToolGroupConfig {
    id: string;
    viewportIds: string[];
    enabledTools: string[];
    primaryMouseButtonTool?: string;
    secondaryMouseButtonTool?: string;
    middleMouseButtonTool?: string;
}

export interface SynchronizerConfig {
    id: string;
    type: 'camera' | 'voi';
    viewportIds: string[];
}

/**
 * Official Cornerstone3D Tools Manager
 * Uses only official APIs and best practices from the Cornerstone3D documentation
 */
export class OfficialToolsManager {
    private toolGroups: Map<string, any> = new Map();
    private synchronizers: Map<string, any> = new Map();
    private isInitialized: boolean = false;

    constructor() {
        this.initialize();
    }

    private initialize(): void {
        try {
            console.log('✓ Official Tools Manager initialized');
            this.isInitialized = true;
        } catch (error) {
            console.error('❌ Error initializing Official Tools Manager:', error);
            throw error;
        }
    }

    /**
     * Create a tool group with official Cornerstone3D API
     */
    public createToolGroup(config: ToolGroupConfig): any {
        try {
            // Create tool group using official API
            const toolGroup = ToolGroupManager.createToolGroup(config.id);
            
            if (!toolGroup) {
                throw new Error(`Failed to create tool group '${config.id}'`);
            }

            // Add tools to the group
            config.enabledTools.forEach(toolName => {
                try {
                    toolGroup.addTool(toolName);
                } catch (toolError) {
                    console.warn(`Failed to add tool '${toolName}' to group '${config.id}':`, toolError);
                }
            });

            // Add viewports to the group
            config.viewportIds.forEach(viewportId => {
                try {
                    // Note: renderingEngineId should be passed from caller
                    toolGroup.addViewport(viewportId, 'default-rendering-engine');
                } catch (viewportError) {
                    console.warn(`Failed to add viewport '${viewportId}' to group '${config.id}':`, viewportError);
                }
            });

            // Set tool bindings
            if (config.primaryMouseButtonTool) {
                try {
                    toolGroup.setToolActive(config.primaryMouseButtonTool, {
                        bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }]
                    });
                } catch (bindingError) {
                    console.warn(`Failed to set primary tool binding:`, bindingError);
                }
            }

            if (config.secondaryMouseButtonTool) {
                try {
                    toolGroup.setToolActive(config.secondaryMouseButtonTool, {
                        bindings: [{ mouseButton: ToolEnums.MouseBindings.Secondary }]
                    });
                } catch (bindingError) {
                    console.warn(`Failed to set secondary tool binding:`, bindingError);
                }
            }

            if (config.middleMouseButtonTool) {
                try {
                    toolGroup.setToolActive(config.middleMouseButtonTool, {
                        bindings: [{ mouseButton: ToolEnums.MouseBindings.Auxiliary }]
                    });
                } catch (bindingError) {
                    console.warn(`Failed to set middle tool binding:`, bindingError);
                }
            }

            this.toolGroups.set(config.id, toolGroup);
            console.log(`✓ Tool group '${config.id}' created with ${config.enabledTools.length} tools`);
            
            return toolGroup;
        } catch (error) {
            console.error(`❌ Error creating tool group '${config.id}':`, error);
            throw error;
        }
    }

    /**
     * Create synchronizer using official Cornerstone3D API with enhanced safety
     */
    public createSynchronizer(config: SynchronizerConfig): any {
        try {
            if (!config || !config.id || !config.type) {
                throw new Error('Invalid synchronizer configuration: missing required fields');
            }
            
            if (!Array.isArray(config.viewportIds) || config.viewportIds.length === 0) {
                throw new Error('Invalid synchronizer configuration: viewportIds must be a non-empty array');
            }
            
            let synchronizer;
            
            if (config.type === 'camera') {
                // Use official SynchronizerManager API for camera synchronization
                synchronizer = SynchronizerManager.createSynchronizer(
                    config.id,
                    'CAMERA_MODIFIED', // Use string constant instead of Enums for compatibility
                    (synchronizerInstance: any, sourceViewport: any, targetViewport: any, cameraModifiedEvent: any) => {
                        try {
                            if (!targetViewport || !cameraModifiedEvent?.detail) {
                                return;
                            }
                            const { camera } = cameraModifiedEvent.detail;
                            if (camera && targetViewport.setCamera) {
                                targetViewport.setCamera(camera);
                                if (targetViewport.render) {
                                    targetViewport.render();
                                }
                            }
                        } catch (syncError) {
                            console.warn('Camera synchronization error:', syncError);
                        }
                    }
                );
            } else if (config.type === 'voi') {
                // Use official SynchronizerManager API for VOI synchronization
                synchronizer = SynchronizerManager.createSynchronizer(
                    config.id,
                    'VOI_MODIFIED', // Use string constant instead of Enums for compatibility
                    (synchronizerInstance: any, sourceViewport: any, targetViewport: any, voiModifiedEvent: any) => {
                        try {
                            if (!targetViewport || !voiModifiedEvent?.detail) {
                                return;
                            }
                            const { range } = voiModifiedEvent.detail;
                            if (range && targetViewport.setProperties) {
                                targetViewport.setProperties({ voiRange: range });
                                if (targetViewport.render) {
                                    targetViewport.render();
                                }
                            }
                        } catch (syncError) {
                            console.warn('VOI synchronization error:', syncError);
                        }
                    }
                );
            } else {
                throw new Error(`Unsupported synchronizer type: ${config.type}`);
            }
            
            if (!synchronizer) {
                throw new Error(`Failed to create ${config.type} synchronizer`);
            }

            // Add viewports to synchronizer with enhanced error handling
            let successfullyAdded = 0;
            config.viewportIds.forEach(viewportId => {
                try {
                    if (!viewportId || typeof viewportId !== 'string') {
                        console.warn(`Invalid viewport ID: ${viewportId}`);
                        return;
                    }
                    synchronizer.add({
                        renderingEngineId: 'default-rendering-engine',
                        viewportId: viewportId
                    });
                    successfullyAdded++;
                } catch (addError) {
                    console.warn(`Failed to add viewport '${viewportId}' to synchronizer:`, addError);
                }
            });
            
            if (successfullyAdded === 0) {
                console.warn(`No viewports successfully added to synchronizer '${config.id}'`);
            }

            this.synchronizers.set(config.id, synchronizer);
            console.log(`✓ ${config.type} synchronizer '${config.id}' created for ${successfullyAdded}/${config.viewportIds.length} viewports`);
            
            return synchronizer;
        } catch (error) {
            console.error(`❌ Error creating synchronizer '${config.id}':`, error);
            throw error;
        }
    }

    /**
     * Get tool group by ID with null safety
     */
    public getToolGroup(id: string): any {
        try {
            const toolGroup = ToolGroupManager.getToolGroup(id);
            if (!toolGroup) {
                console.warn(`Tool group '${id}' not found`);
            }
            return toolGroup;
        } catch (error) {
            console.error(`❌ Error getting tool group '${id}':`, error);
            return null;
        }
    }

    /**
     * Get synchronizer by ID with null safety
     */
    public getSynchronizer(id: string): any {
        try {
            if (!id || typeof id !== 'string') {
                console.warn('Invalid synchronizer ID provided');
                return null;
            }
            const synchronizer = this.synchronizers.get(id);
            if (!synchronizer) {
                console.warn(`Synchronizer '${id}' not found`);
            }
            return synchronizer;
        } catch (error) {
            console.error(`❌ Error getting synchronizer '${id}':`, error);
            return null;
        }
    }

    /**
     * Add viewport to existing tool group
     */
    public addViewportToToolGroup(toolGroupId: string, viewportId: string, renderingEngineId: string = 'default-rendering-engine'): boolean {
        try {
            const toolGroup = this.getToolGroup(toolGroupId);
            if (!toolGroup) {
                console.warn(`Tool group '${toolGroupId}' not found`);
                return false;
            }

            toolGroup.addViewport(viewportId, renderingEngineId);
            console.log(`✓ Added viewport '${viewportId}' to tool group '${toolGroupId}'`);
            return true;
        } catch (error) {
            console.error(`❌ Error adding viewport to tool group:`, error);
            return false;
        }
    }

    /**
     * Remove viewport from tool group
     */
    public removeViewportFromToolGroup(toolGroupId: string, viewportId: string, renderingEngineId: string = 'default-rendering-engine'): boolean {
        try {
            const toolGroup = this.getToolGroup(toolGroupId);
            if (!toolGroup) {
                console.warn(`Tool group '${toolGroupId}' not found`);
                return false;
            }

            toolGroup.removeViewports(renderingEngineId, viewportId);
            console.log(`✓ Removed viewport '${viewportId}' from tool group '${toolGroupId}'`);
            return true;
        } catch (error) {
            console.error(`❌ Error removing viewport from tool group:`, error);
            return false;
        }
    }

    /**
     * Set tool active with specific bindings
     */
    public setToolActive(toolGroupId: string, toolName: string, bindings: any[]): boolean {
        try {
            const toolGroup = this.getToolGroup(toolGroupId);
            if (!toolGroup) {
                console.warn(`Tool group '${toolGroupId}' not found`);
                return false;
            }

            toolGroup.setToolActive(toolName, { bindings });
            console.log(`✓ Set tool '${toolName}' active in group '${toolGroupId}'`);
            return true;
        } catch (error) {
            console.error(`❌ Error setting tool active:`, error);
            return false;
        }
    }

    /**
     * Set tool passive
     */
    public setToolPassive(toolGroupId: string, toolName: string): boolean {
        try {
            const toolGroup = this.getToolGroup(toolGroupId);
            if (!toolGroup) {
                console.warn(`Tool group '${toolGroupId}' not found`);
                return false;
            }

            toolGroup.setToolPassive(toolName);
            console.log(`✓ Set tool '${toolName}' passive in group '${toolGroupId}'`);
            return true;
        } catch (error) {
            console.error(`❌ Error setting tool passive:`, error);
            return false;
        }
    }

    /**
     * Set tool disabled
     */
    public setToolDisabled(toolGroupId: string, toolName: string): boolean {
        try {
            const toolGroup = this.getToolGroup(toolGroupId);
            if (!toolGroup) {
                console.warn(`Tool group '${toolGroupId}' not found`);
                return false;
            }

            toolGroup.setToolDisabled(toolName);
            console.log(`✓ Set tool '${toolName}' disabled in group '${toolGroupId}'`);
            return true;
        } catch (error) {
            console.error(`❌ Error setting tool disabled:`, error);
            return false;
        }
    }

    /**
     * Get all annotations using official API with error handling
     */
    public getAllAnnotations(): any[] {
        try {
            const annotations = annotation.state.getAllAnnotations();
            return annotations || [];
        } catch (error) {
            console.error('❌ Error getting all annotations:', error);
            return [];
        }
    }

    /**
     * Get annotations for specific tool with null safety
     */
    public getAnnotationsForTool(toolName: string): any[] {
        try {
            const allAnnotations = this.getAllAnnotations();
            if (!Array.isArray(allAnnotations)) {
                console.warn('Invalid annotations data structure');
                return [];
            }
            return allAnnotations.filter(ann => ann?.metadata?.toolName === toolName);
        } catch (error) {
            console.error(`❌ Error getting annotations for tool '${toolName}':`, error);
            return [];
        }
    }

    /**
     * Remove annotation using official API
     */
    public removeAnnotation(annotationUID: string): boolean {
        try {
            annotation.state.removeAnnotation(annotationUID);
            console.log(`✓ Removed annotation '${annotationUID}'`);
            return true;
        } catch (error) {
            console.error(`❌ Error removing annotation:`, error);
            return false;
        }
    }

    /**
     * Remove all annotations
     */
    public removeAllAnnotations(): void {
        try {
            annotation.state.removeAllAnnotations();
            console.log('✓ Removed all annotations');
        } catch (error) {
            console.error('❌ Error removing all annotations:', error);
        }
    }

    /**
     * Enable synchronizer with enhanced safety checks
     */
    public enableSynchronizer(id: string): boolean {
        try {
            const synchronizer = this.getSynchronizer(id);
            if (!synchronizer) {
                return false; // getSynchronizer already logs the warning
            }
            
            if (typeof synchronizer.enabled === 'undefined') {
                console.warn(`Synchronizer '${id}' does not support enabled property`);
                return false;
            }

            synchronizer.enabled = true;
            console.log(`✓ Enabled synchronizer '${id}'`);
            return true;
        } catch (error) {
            console.error(`❌ Error enabling synchronizer '${id}':`, error);
            return false;
        }
    }

    /**
     * Disable synchronizer with enhanced safety checks
     */
    public disableSynchronizer(id: string): boolean {
        try {
            const synchronizer = this.getSynchronizer(id);
            if (!synchronizer) {
                return false; // getSynchronizer already logs the warning
            }
            
            if (typeof synchronizer.enabled === 'undefined') {
                console.warn(`Synchronizer '${id}' does not support enabled property`);
                return false;
            }

            synchronizer.enabled = false;
            console.log(`✓ Disabled synchronizer '${id}'`);
            return true;
        } catch (error) {
            console.error(`❌ Error disabling synchronizer '${id}':`, error);
            return false;
        }
    }

    /**
     * Destroy tool group with enhanced error handling
     */
    public destroyToolGroup(id: string): boolean {
        try {
            const toolGroup = ToolGroupManager.getToolGroup(id);
            if (!toolGroup) {
                console.warn(`Tool group '${id}' not found for destruction`);
                this.toolGroups.delete(id); // Clean up local reference anyway
                return true; // Consider it "successfully" removed
            }
            
            ToolGroupManager.destroyToolGroup(id);
            this.toolGroups.delete(id);
            console.log(`✓ Destroyed tool group '${id}'`);
            return true;
        } catch (error) {
            console.error(`❌ Error destroying tool group '${id}':`, error);
            return false;
        }
    }

    /**
     * Destroy synchronizer with enhanced safety checks
     */
    public destroySynchronizer(id: string): boolean {
        try {
            if (!id || typeof id !== 'string') {
                console.warn('Invalid synchronizer ID provided for destruction');
                return false;
            }
            
            const synchronizer = this.getSynchronizer(id);
            if (synchronizer) {
                if (typeof synchronizer.destroy === 'function') {
                    synchronizer.destroy();
                } else {
                    console.warn(`Synchronizer '${id}' does not have a destroy method`);
                }
            }
            
            // Always clean up the local reference
            const wasDeleted = this.synchronizers.delete(id);
            if (wasDeleted || synchronizer) {
                console.log(`✓ Destroyed synchronizer '${id}'`);
            } else {
                console.log(`✓ Synchronizer '${id}' was already destroyed or not found`);
            }
            return true;
        } catch (error) {
            console.error(`❌ Error destroying synchronizer '${id}':`, error);
            return false;
        }
    }

    /**
     * Get initialization status
     */
    public getInitializationStatus(): boolean {
        return this.isInitialized;
    }

    /**
     * Clean up all resources
     */
    public dispose(): void {
        try {
            // Destroy all tool groups
            Array.from(this.toolGroups.keys()).forEach(id => {
                this.destroyToolGroup(id);
            });

            // Destroy all synchronizers
            Array.from(this.synchronizers.keys()).forEach(id => {
                this.destroySynchronizer(id);
            });

            this.toolGroups.clear();
            this.synchronizers.clear();
            this.isInitialized = false;

            console.log('✓ Official Tools Manager disposed');
        } catch (error) {
            console.error('❌ Error disposing Official Tools Manager:', error);
        }
    }
}

// Convenience functions
export function createOfficialToolsManager(): OfficialToolsManager {
    return new OfficialToolsManager();
}

// Default tool configurations
export const DEFAULT_TOOL_CONFIGS = {
    BASIC_TOOLS: [
        PanTool.toolName,
        ZoomTool.toolName,
        WindowLevelTool.toolName,
        StackScrollTool.toolName
    ],
    
    MEASUREMENT_TOOLS: [
        LengthTool.toolName,
        AngleTool.toolName,
        HeightTool.toolName,
        BidirectionalTool.toolName,
        CobbAngleTool.toolName,
        ProbeTool.toolName
    ],
    
    ROI_TOOLS: [
        RectangleROITool.toolName,
        EllipticalROITool.toolName,
        CircleROITool.toolName,
        SplineROITool.toolName
    ],
    
    ANNOTATION_TOOLS: [
        ArrowAnnotateTool.toolName,
        LabelTool.toolName
    ],
    
    ADVANCED_TOOLS: [
        CrosshairsTool.toolName,
        MagnifyTool.toolName,
        TrackballRotateTool.toolName,
        DragProbeTool.toolName,
        ReferenceLinesTool.toolName
    ],
    
    SEGMENTATION_TOOLS: [
        BrushTool.toolName,
        RectangleScissorsTool.toolName,
        CircleScissorsTool.toolName,
        SphereScissorsTool.toolName
    ],
    
    OVERLAY_TOOLS: [
        OverlayGridTool.toolName,
        ScaleOverlayTool.toolName,
        OrientationMarkerTool.toolName,
        ETDRSGridTool.toolName
    ]
};

export default OfficialToolsManager;