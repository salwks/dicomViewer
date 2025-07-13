import {
    ToolGroupManager,
    PanTool,
    ZoomTool,
    WindowLevelTool,
    StackScrollTool,
    LengthTool,
    AngleTool,
    ArrowAnnotateTool,
    LabelTool,
    RectangleROITool,
    EllipticalROITool,
    CircleROITool,
    ReferenceLinesTool,
    HeightTool,
    BidirectionalTool,
    CobbAngleTool,
    ProbeTool,
    SplineROITool,
    Enums as ToolEnums
} from '@cornerstonejs/tools';
import { getRenderingEngine } from '@cornerstonejs/core';
import { CustomReferenceLines } from '../tools/customReferenceLines';

export class MultiViewportToolManager {
    private static instance: MultiViewportToolManager;
    private toolGroupId = 'multi-viewport-tool-group';
    private toolGroup: any = null;
    
    public static getInstance(): MultiViewportToolManager {
        if (!MultiViewportToolManager.instance) {
            MultiViewportToolManager.instance = new MultiViewportToolManager();
        }
        return MultiViewportToolManager.instance;
    }
    
    /**
     * Setup tools for multi-viewport system
     */
    public async setupMultiViewportTools(): Promise<void> {
        try {
            // Destroy existing tool group if it exists
            const existingToolGroup = ToolGroupManager.getToolGroup(this.toolGroupId);
            if (existingToolGroup) {
                ToolGroupManager.destroyToolGroup(this.toolGroupId);
            }
            
            // Create new tool group for multi-viewport
            this.toolGroup = ToolGroupManager.createToolGroup(this.toolGroupId);
            
            if (!this.toolGroup) {
                throw new Error('Failed to create multi-viewport tool group');
            }
            
            // Add essential tools
            this.toolGroup.addTool(PanTool.toolName);
            this.toolGroup.addTool(ZoomTool.toolName);
            this.toolGroup.addTool(WindowLevelTool.toolName);
            this.toolGroup.addTool(StackScrollTool.toolName);
            
            // Add annotation tools for multi-viewport
            this.toolGroup.addTool(LengthTool.toolName);
            this.toolGroup.addTool(AngleTool.toolName);
            this.toolGroup.addTool(ArrowAnnotateTool.toolName);
            this.toolGroup.addTool(LabelTool.toolName);
            this.toolGroup.addTool(RectangleROITool.toolName);
            this.toolGroup.addTool(EllipticalROITool.toolName);
            this.toolGroup.addTool(CircleROITool.toolName);
            
            // Add additional measurement tools
            this.toolGroup.addTool(HeightTool.toolName);
            this.toolGroup.addTool(BidirectionalTool.toolName);
            this.toolGroup.addTool(CobbAngleTool.toolName);
            this.toolGroup.addTool(ProbeTool.toolName);
            this.toolGroup.addTool(SplineROITool.toolName);
            
            // Add Reference Lines tool for multi-viewport cross-references
            this.toolGroup.addTool(ReferenceLinesTool.toolName);
            
            console.log('🔍 [MULTI_DEBUG] Added all tools to multi-viewport tool group:', this.toolGroupId);
            
            // Set default active tools
            this.toolGroup.setToolActive(WindowLevelTool.toolName, {
                bindings: [
                    {
                        mouseButton: ToolEnums.MouseBindings.Primary,
                    },
                ],
            });
            
            this.toolGroup.setToolActive(PanTool.toolName, {
                bindings: [
                    {
                        mouseButton: ToolEnums.MouseBindings.Auxiliary,
                    },
                ],
            });
            
            this.toolGroup.setToolActive(ZoomTool.toolName, {
                bindings: [
                    {
                        mouseButton: ToolEnums.MouseBindings.Secondary,
                    },
                ],
            });
            
            this.toolGroup.setToolActive(StackScrollTool.toolName, {
                bindings: [
                    {
                        mouseButton: ToolEnums.MouseBindings.Wheel,
                    },
                ],
            });
            
            // Set annotation tools to passive mode (can be activated via UI)
            this.toolGroup.setToolPassive(LengthTool.toolName);
            this.toolGroup.setToolPassive(AngleTool.toolName);
            this.toolGroup.setToolPassive(ArrowAnnotateTool.toolName);
            this.toolGroup.setToolPassive(LabelTool.toolName);
            this.toolGroup.setToolPassive(RectangleROITool.toolName);
            this.toolGroup.setToolPassive(EllipticalROITool.toolName);
            this.toolGroup.setToolPassive(CircleROITool.toolName);
            this.toolGroup.setToolPassive(ReferenceLinesTool.toolName);
            
            console.log('Multi-viewport tool group setup completed with annotation tools');
            
        } catch (error) {
            console.error('Error setting up multi-viewport tools:', error);
            throw error;
        }
    }
    
    /**
     * Associate tool group with all multi-viewports
     */
    public async associateWithAllViewports(): Promise<void> {
        try {
            if (!this.toolGroup) {
                await this.setupMultiViewportTools();
            }
            
            const multiViewportEngine = getRenderingEngine('multi-viewport-engine');
            if (!multiViewportEngine) {
                console.warn('Multi-viewport rendering engine not found');
                return;
            }
            
            // Wait longer for viewports to be fully initialized
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Get all viewport elements that have been created
            const viewportElements = document.querySelectorAll('.viewport-container[data-viewport-id]');
            const validViewportIds: string[] = [];
            
            // Verify each viewport exists in the rendering engine with retry logic
            for (const element of viewportElements) {
                const viewportId = (element as HTMLElement).dataset.viewportId;
                if (!viewportId) continue;
                
                // Retry logic for viewport verification
                let viewport = null;
                let attempts = 0;
                const maxAttempts = 5;
                
                while (!viewport && attempts < maxAttempts) {
                    try {
                        viewport = multiViewportEngine.getViewport(viewportId);
                        if (viewport) {
                            validViewportIds.push(viewportId);
                            break;
                        }
                    } catch (error) {
                        // Viewport not ready yet, wait and retry
                        await new Promise(resolve => setTimeout(resolve, 100));
                        attempts++;
                    }
                }
                
                if (!viewport) {
                    console.warn(`Viewport ${viewportId} not found after ${maxAttempts} attempts`);
                }
            }
            
            if (validViewportIds.length === 0) {
                console.warn('No valid multi-viewports found to associate with tools');
                return;
            }
            
            // Clear existing viewport associations safely
            try {
                this.toolGroup.removeViewports(multiViewportEngine.id);
            } catch (error) {
                console.warn('Error clearing existing viewport associations:', error);
            }
            
            // Associate tool group with viewports using the correct Cornerstone3D API
            for (const viewportId of validViewportIds) {
                try {
                    // Use the proper ToolGroup API: addViewport(viewportId, renderingEngineId)
                    this.toolGroup.addViewport(viewportId, multiViewportEngine.id);
                    console.log(`Associated tool group with viewport: ${viewportId}`);
                } catch (error) {
                    console.warn(`Failed to associate tools with viewport ${viewportId}:`, error);
                }
            }
            
            console.log(`Successfully associated tool group with ${validViewportIds.length} multi-viewports`);
            
        } catch (error) {
            console.error('Error associating tools with multi-viewports:', error);
        }
    }
    
    /**
     * Get the multi-viewport tool group
     */
    public getToolGroup(): any {
        return this.toolGroup;
    }
    
    /**
     * Activate a specific tool for all multi-viewports
     */
    public activateTool(toolName: string, mouseButton?: ToolEnums.MouseBindings): boolean {
        if (!this.toolGroup) {
            console.warn('Tool group not available');
            return false;
        }
        
        try {
            // Map tool names to actual tool names used in Cornerstone3D
            const toolNameMap: { [key: string]: string } = {
                'pan': PanTool.toolName,
                'zoom': ZoomTool.toolName,
                'windowLevel': WindowLevelTool.toolName,
                'length': LengthTool.toolName,
                'angle': AngleTool.toolName,
                'arrowAnnotate': ArrowAnnotateTool.toolName,
                'label': LabelTool.toolName,
                'rectangleROI': RectangleROITool.toolName,
                'ellipticalROI': EllipticalROITool.toolName,
                'circleROI': CircleROITool.toolName,
                'referenceLines': ReferenceLinesTool.toolName,
                'height': HeightTool.toolName,
                'bidirectional': BidirectionalTool.toolName,
                'cobbAngle': CobbAngleTool.toolName,
                'probe': ProbeTool.toolName,
                'splineROI': SplineROITool.toolName
            };
            
            const actualToolName = toolNameMap[toolName] || toolName;
            
            // Deactivate all active tools first
            const allTools = [
                PanTool.toolName,
                ZoomTool.toolName,
                WindowLevelTool.toolName,
                LengthTool.toolName,
                AngleTool.toolName,
                ArrowAnnotateTool.toolName,
                LabelTool.toolName,
                RectangleROITool.toolName,
                EllipticalROITool.toolName,
                CircleROITool.toolName,
                ReferenceLinesTool.toolName,
                HeightTool.toolName,
                BidirectionalTool.toolName,
                CobbAngleTool.toolName,
                ProbeTool.toolName,
                SplineROITool.toolName
            ];
            
            allTools.forEach(tool => {
                try {
                    this.toolGroup.setToolPassive(tool);
                } catch (error) {
                    console.warn(`Failed to set ${tool} to passive:`, error);
                }
            });
            
            // Special handling for Reference Lines tool
            if (actualToolName === ReferenceLinesTool.toolName) {
                this.activateCustomReferenceLines();
            } else {
                // Activate the requested tool
                const binding = mouseButton || ToolEnums.MouseBindings.Primary;
                this.toolGroup.setToolActive(actualToolName, {
                    bindings: [{ mouseButton: binding }],
                });
            }
            
            console.log(`Activated tool ${actualToolName} for multi-viewports`);
            return true;
            
        } catch (error) {
            console.error(`Error activating tool ${toolName}:`, error);
            return false;
        }
    }
    
    /**
     * Verify tool group associations for debugging
     */
    public verifyAssociations(): void {
        if (!this.toolGroup) {
            console.warn('Tool group not available for verification');
            return;
        }
        
        try {
            const multiViewportEngine = getRenderingEngine('multi-viewport-engine');
            if (!multiViewportEngine) {
                console.warn('Multi-viewport rendering engine not found');
                return;
            }
            
            const viewportElements = document.querySelectorAll('.viewport-container[data-viewport-id]');
            console.log(`🔍 Tool Association Verification:`);
            console.log(`📊 Total viewport elements found: ${viewportElements.length}`);
            
            let associatedCount = 0;
            viewportElements.forEach(element => {
                const viewportId = (element as HTMLElement).dataset.viewportId;
                if (viewportId) {
                    try {
                        const viewport = multiViewportEngine.getViewport(viewportId);
                        if (viewport) {
                            associatedCount++;
                            console.log(`✅ Viewport ${viewportId}: Associated and available`);
                        } else {
                            console.log(`❌ Viewport ${viewportId}: Not found in rendering engine`);
                        }
                    } catch (error) {
                        console.log(`❌ Viewport ${viewportId}: Error accessing - ${error}`);
                    }
                }
            });
            
            console.log(`📈 Successfully associated viewports: ${associatedCount}/${viewportElements.length}`);
            
        } catch (error) {
            console.error('Error during tool association verification:', error);
        }
    }
    
    /**
     * Activate Custom Reference Lines for multi-viewport
     */
    private activateCustomReferenceLines(): void {
        try {
            const customRefLines = CustomReferenceLines.getInstance();
            
            if (customRefLines.isActiveState()) {
                // If already active, deactivate
                customRefLines.deactivate();
                console.log('✅ Custom Reference Lines deactivated in multi-viewport mode');
            } else {
                // Activate with multi-viewport optimized settings
                customRefLines.activate({
                    color: '#ffff00', // Yellow color
                    lineWidth: 2,
                    dashPattern: [3, 3],
                    showCrosshairs: true,
                    showCoordinates: true
                });
                
                // Refresh to ensure all viewports get overlays
                setTimeout(() => {
                    customRefLines.refresh();
                }, 100);
                
                console.log('✅ Custom Reference Lines activated for multi-viewport mode');
                console.log('📋 Multi-Viewport Instructions:');
                console.log('   • Yellow crosshairs appear on all viewports');
                console.log('   • Move mouse over any viewport to see crosshairs');
                console.log('   • Click in any viewport to set synchronized reference point');
                console.log('   • All viewports will show the same proportional reference position');
                console.log('   • Click Reference Lines button again to deactivate');
            }
            
        } catch (error) {
            console.error('❌ Error with Custom Reference Lines in multi-viewport:', error);
        }
    }
    
    /**
     * Legacy Cornerstone Reference Lines tool (kept for reference)
     */
    private activateReferenceLinesTool(): void {
        if (!this.toolGroup) return;
        
        try {
            // Get all viewport IDs for multi-viewport reference lines
            const multiViewportEngine = getRenderingEngine('multi-viewport-engine');
            if (!multiViewportEngine) {
                console.warn('Multi-viewport rendering engine not found');
                return;
            }
            
            // Wait for viewports to be ready
            setTimeout(() => {
                const viewportElements = document.querySelectorAll('.viewport-container[data-viewport-id]');
                const viewportIds: string[] = [];
                
                viewportElements.forEach(element => {
                    const viewportId = (element as HTMLElement).dataset.viewportId;
                    if (viewportId) {
                        try {
                            const viewport = multiViewportEngine.getViewport(viewportId);
                            if (viewport) {
                                viewportIds.push(viewportId);
                            }
                        } catch (error) {
                            console.warn(`Viewport ${viewportId} not ready for reference lines`);
                        }
                    }
                });
                
                if (viewportIds.length < 2) {
                    console.warn('⚠️ Reference Lines require at least 2 active viewports');
                    console.log(`Currently have ${viewportIds.length} viewport(s): ${viewportIds.join(', ')}`);
                    return;
                }
                
                // Configure Reference Lines for multi-viewport
                const referenceLineConfig = {
                    // Specify which viewports should show reference lines
                    sourceViewportId: viewportIds[0],
                    targetViewportIds: viewportIds.slice(1),
                    // Visual configuration
                    color: [1, 1, 0], // Yellow color (RGB 0-1)
                    lineWidth: 2,
                    lineDash: [4, 4],
                    // Interaction
                    handles: {
                        display: true,
                        activeHandleRadius: 6,
                        inactiveHandleRadius: 4
                    },
                    // Multi-viewport specific settings
                    renderInactiveLines: true,
                    showTextBox: true
                };
                
                // Apply configuration
                this.toolGroup.setToolConfiguration(ReferenceLinesTool.toolName, referenceLineConfig);
                
                // Activate the tool
                this.toolGroup.setToolActive(ReferenceLinesTool.toolName, {
                    bindings: [
                        {
                            mouseButton: ToolEnums.MouseBindings.Primary,
                        },
                    ],
                });
                
                console.log(`✅ Reference Lines activated for viewports: ${viewportIds.join(', ')}`);
                console.log('💡 Reference lines will show intersections between viewport planes');
                console.log('   Click and drag to move reference lines between viewports');
                
                // Force a render to ensure reference lines appear
                viewportIds.forEach(viewportId => {
                    try {
                        const viewport = multiViewportEngine.getViewport(viewportId);
                        if (viewport) {
                            viewport.render();
                        }
                    } catch (error) {
                        console.warn(`Error rendering viewport ${viewportId}:`, error);
                    }
                });
                
            }, 500); // Wait for viewports to be properly initialized
            
        } catch (error) {
            console.error('Error activating Reference Lines tool:', error);
        }
    }
    
    /**
     * Clean up multi-viewport tools
     */
    public destroy(): void {
        try {
            if (this.toolGroup) {
                ToolGroupManager.destroyToolGroup(this.toolGroupId);
                this.toolGroup = null;
            }
            console.log('Multi-viewport tool manager destroyed');
        } catch (error) {
            console.error('Error destroying multi-viewport tool manager:', error);
        }
    }
}