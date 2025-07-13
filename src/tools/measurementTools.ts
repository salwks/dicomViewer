import { 
    addTool,
    PanTool,
    ZoomTool,
    WindowLevelTool,
    LengthTool,
    AngleTool,
    EllipticalROITool,
    RectangleROITool,
    ProbeTool,
    StackScrollTool,
    ToolGroupManager,
    Enums as ToolEnums
} from '@cornerstonejs/tools';

export interface MeasurementToolsConfig {
    enableLength?: boolean;
    enableAngle?: boolean;
    enableEllipticalROI?: boolean;
    enableRectangleROI?: boolean;
    enableProbe?: boolean;
    toolGroupId?: string;
    defaultMouseBindings?: boolean;
}

export class MeasurementToolsManager {
    private toolGroupId: string;
    private toolGroup: any = null;
    private isInitialized: boolean = false;
    private enabledTools: Set<string> = new Set();

    constructor(toolGroupId: string = 'measurement-tools') {
        this.toolGroupId = toolGroupId;
    }

    public async initialize(config: MeasurementToolsConfig = {}): Promise<void> {
        if (this.isInitialized) {
            console.log('Measurement tools already initialized');
            return;
        }

        try {
            console.log('Initializing measurement tools...');

            // Register all measurement tools
            await this.registerMeasurementTools(config);

            // Create tool group
            this.createToolGroup();

            this.isInitialized = true;
            console.log('✓ Measurement tools initialized successfully');

        } catch (error) {
            console.error('❌ Error initializing measurement tools:', error);
            throw new Error(`Measurement tools initialization failed: ${error}`);
        }
    }

    private async registerMeasurementTools(config: MeasurementToolsConfig): Promise<void> {
        const toolsToRegister = [
            { tool: PanTool, name: 'Pan', enabled: true },
            { tool: ZoomTool, name: 'Zoom', enabled: true },
            { tool: WindowLevelTool, name: 'WindowLevel', enabled: true },
            { tool: LengthTool, name: 'Length', enabled: config.enableLength !== false },
            { tool: AngleTool, name: 'Angle', enabled: config.enableAngle !== false },
            { tool: EllipticalROITool, name: 'EllipticalROI', enabled: config.enableEllipticalROI !== false },
            { tool: RectangleROITool, name: 'RectangleROI', enabled: config.enableRectangleROI !== false },
            { tool: ProbeTool, name: 'Probe', enabled: config.enableProbe !== false },
            { tool: StackScrollTool, name: 'StackScroll', enabled: true }
        ];

        for (const toolConfig of toolsToRegister) {
            if (toolConfig.enabled) {
                try {
                    addTool(toolConfig.tool);
                    this.enabledTools.add(toolConfig.name);
                    console.log(`✓ Registered ${toolConfig.name} tool`);
                } catch (error) {
                    console.warn(`⚠️ Failed to register ${toolConfig.name} tool:`, error);
                }
            }
        }
    }

    private createToolGroup(): void {
        try {
            // Destroy existing tool group if it exists
            const existingToolGroup = ToolGroupManager.getToolGroup(this.toolGroupId);
            if (existingToolGroup) {
                ToolGroupManager.destroyToolGroup(this.toolGroupId);
            }

            // Create new tool group
            this.toolGroup = ToolGroupManager.createToolGroup(this.toolGroupId);

            if (!this.toolGroup) {
                throw new Error('Failed to create measurement tool group');
            }

            // Add all enabled tools to the tool group
            this.addToolsToGroup();

            console.log(`✓ Measurement tool group created: ${this.toolGroupId}`);

        } catch (error) {
            console.error('❌ Error creating measurement tool group:', error);
            throw error;
        }
    }

    private addToolsToGroup(): void {
        if (!this.toolGroup) {
            throw new Error('Tool group not initialized');
        }

        // Add all enabled tools to the group
        this.enabledTools.forEach(toolName => {
            try {
                this.toolGroup.addTool(toolName);
                console.log(`✓ Added ${toolName} to tool group`);
            } catch (error) {
                console.warn(`⚠️ Failed to add ${toolName} to tool group:`, error);
            }
        });

        // Set default tool configurations
        this.configureDefaultTools();
    }

    private configureDefaultTools(): void {
        if (!this.toolGroup) return;

        try {
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

            // Set measurement tools as passive by default
            if (this.enabledTools.has('Length')) {
                this.toolGroup.setToolPassive(LengthTool.toolName);
            }

            if (this.enabledTools.has('Angle')) {
                this.toolGroup.setToolPassive(AngleTool.toolName);
            }

            if (this.enabledTools.has('EllipticalROI')) {
                this.toolGroup.setToolPassive(EllipticalROITool.toolName);
            }

            if (this.enabledTools.has('RectangleROI')) {
                this.toolGroup.setToolPassive(RectangleROITool.toolName);
            }

            if (this.enabledTools.has('Probe')) {
                this.toolGroup.setToolPassive(ProbeTool.toolName);
            }

            console.log('✓ Default tool configurations applied');

        } catch (error) {
            console.error('❌ Error configuring default tools:', error);
        }
    }

    public activateMeasurementTool(toolName: string): boolean {
        if (!this.toolGroup || !this.isInitialized) {
            console.error('Measurement tools not initialized');
            return false;
        }

        if (!this.enabledTools.has(toolName)) {
            console.error(`Tool ${toolName} is not enabled`);
            return false;
        }

        try {
            // First deactivate all measurement tools
            this.deactivateAllMeasurementTools();

            // Then activate the requested tool
            this.toolGroup.setToolActive(toolName, {
                bindings: [
                    {
                        mouseButton: ToolEnums.MouseBindings.Primary,
                    },
                ],
            });

            console.log(`✓ Activated measurement tool: ${toolName}`);
            return true;

        } catch (error) {
            console.error(`❌ Error activating measurement tool ${toolName}:`, error);
            return false;
        }
    }

    private deactivateAllMeasurementTools(): void {
        const measurementTools = ['Length', 'Angle', 'EllipticalROI', 'RectangleROI', 'Probe'];
        
        measurementTools.forEach(toolName => {
            if (this.enabledTools.has(toolName)) {
                try {
                    this.toolGroup.setToolPassive(toolName);
                } catch (error) {
                    console.warn(`⚠️ Failed to deactivate ${toolName}:`, error);
                }
            }
        });
    }

    public deactivateMeasurementTool(toolName: string): boolean {
        if (!this.toolGroup || !this.isInitialized) {
            console.error('Measurement tools not initialized');
            return false;
        }

        if (!this.enabledTools.has(toolName)) {
            console.error(`Tool ${toolName} is not enabled`);
            return false;
        }

        try {
            this.toolGroup.setToolPassive(toolName);
            console.log(`✓ Deactivated measurement tool: ${toolName}`);
            return true;

        } catch (error) {
            console.error(`❌ Error deactivating measurement tool ${toolName}:`, error);
            return false;
        }
    }

    public addViewportToToolGroup(viewportId: string, renderingEngineId: string): boolean {
        if (!this.toolGroup || !this.isInitialized) {
            console.error('Measurement tools not initialized');
            return false;
        }

        try {
            this.toolGroup.addViewport(viewportId, renderingEngineId);
            console.log(`✓ Added viewport to measurement tool group: ${viewportId}`);
            return true;

        } catch (error) {
            console.error(`❌ Error adding viewport to measurement tool group:`, error);
            return false;
        }
    }

    public removeViewportFromToolGroup(viewportId: string, renderingEngineId: string): boolean {
        if (!this.toolGroup || !this.isInitialized) {
            console.error('Measurement tools not initialized');
            return false;
        }

        try {
            this.toolGroup.removeViewport(viewportId, renderingEngineId);
            console.log(`✓ Removed viewport from measurement tool group: ${viewportId}`);
            return true;

        } catch (error) {
            console.error(`❌ Error removing viewport from measurement tool group:`, error);
            return false;
        }
    }

    public getEnabledTools(): string[] {
        return Array.from(this.enabledTools);
    }

    public getToolGroup(): any {
        return this.toolGroup;
    }

    public getToolGroupId(): string {
        return this.toolGroupId;
    }

    public isToolEnabled(toolName: string): boolean {
        return this.enabledTools.has(toolName);
    }

    public getInitializationStatus(): boolean {
        return this.isInitialized;
    }

    public dispose(): void {
        try {
            if (this.toolGroup) {
                ToolGroupManager.destroyToolGroup(this.toolGroupId);
                this.toolGroup = null;
            }

            this.enabledTools.clear();
            this.isInitialized = false;

            console.log('✓ Measurement tools disposed successfully');

        } catch (error) {
            console.error('❌ Error disposing measurement tools:', error);
        }
    }
}

// Convenience functions for tool management
export function createMeasurementToolsManager(toolGroupId?: string): MeasurementToolsManager {
    return new MeasurementToolsManager(toolGroupId);
}

export function getAvailableMeasurementTools(): string[] {
    return ['Length', 'Angle', 'EllipticalROI', 'RectangleROI', 'Probe'];
}

export function getBasicNavigationTools(): string[] {
    return ['Pan', 'Zoom', 'WindowLevel', 'StackScroll'];
}

// Default configuration presets
export const DEFAULT_MEASUREMENT_CONFIG: MeasurementToolsConfig = {
    enableLength: true,
    enableAngle: true,
    enableEllipticalROI: true,
    enableRectangleROI: true,
    enableProbe: true,
    toolGroupId: 'measurement-tools',
    defaultMouseBindings: true
};

export const MINIMAL_MEASUREMENT_CONFIG: MeasurementToolsConfig = {
    enableLength: true,
    enableAngle: false,
    enableEllipticalROI: false,
    enableRectangleROI: false,
    enableProbe: false,
    toolGroupId: 'minimal-measurement-tools',
    defaultMouseBindings: true
};