import { 
    LengthMeasurementTool, 
    LengthMeasurementData, 
    LengthToolConfig,
    createLengthTool 
} from './lengthTool';
import { 
    AngleMeasurementTool, 
    AngleMeasurementData, 
    AngleToolConfig,
    createAngleTool 
} from './angleTool';
import { 
    AreaMeasurementTool, 
    AreaMeasurementData, 
    AreaToolConfig,
    createAreaTool 
} from './areaTool';
import { 
    MeasurementToolsManager, 
    MeasurementToolsConfig, 
    createMeasurementToolsManager 
} from './measurementTools';
import { eventTarget } from '@cornerstonejs/core';

export interface MeasurementManagerConfig {
    toolGroupId?: string;
    enabledTools?: {
        length?: boolean;
        angle?: boolean;
        area?: boolean;
    };
    toolConfigs?: {
        length?: LengthToolConfig;
        angle?: AngleToolConfig;
        area?: AreaToolConfig;
    };
    measurementToolsConfig?: MeasurementToolsConfig;
}

export type AllMeasurementData = LengthMeasurementData | AngleMeasurementData | AreaMeasurementData;

export interface MeasurementSummary {
    totalMeasurements: number;
    lengthMeasurements: number;
    angleMeasurements: number;
    areaMeasurements: number;
    byViewport: { [viewportId: string]: number };
    byImageId: { [imageId: string]: number };
}

export class MeasurementManager {
    private toolGroupId: string;
    private measurementToolsManager: MeasurementToolsManager;
    private lengthTool: LengthMeasurementTool | null = null;
    private angleTool: AngleMeasurementTool | null = null;
    private areaTool: AreaMeasurementTool | null = null;
    private isInitialized: boolean = false;
    private eventListeners: Map<string, (event: any) => void> = new Map();
    private activeTool: string | null = null;

    constructor(config: MeasurementManagerConfig = {}) {
        this.toolGroupId = config.toolGroupId || 'measurement-manager';
        this.measurementToolsManager = createMeasurementToolsManager(this.toolGroupId);
        
        this.setupEventListeners();
        this.initializeTools(config);
    }

    private setupEventListeners(): void {
        // Listen for measurement events from individual tools
        const lengthCompletedListener = (event: any) => {
            this.handleMeasurementEvent('lengthMeasurementCompleted', event.detail);
        };

        const angleCompletedListener = (event: any) => {
            this.handleMeasurementEvent('angleMeasurementCompleted', event.detail);
        };

        const areaCompletedListener = (event: any) => {
            this.handleMeasurementEvent('areaMeasurementCompleted', event.detail);
        };

        const lengthModifiedListener = (event: any) => {
            this.handleMeasurementEvent('lengthMeasurementModified', event.detail);
        };

        const angleModifiedListener = (event: any) => {
            this.handleMeasurementEvent('angleMeasurementModified', event.detail);
        };

        const areaModifiedListener = (event: any) => {
            this.handleMeasurementEvent('areaMeasurementModified', event.detail);
        };

        const lengthRemovedListener = (event: any) => {
            this.handleMeasurementEvent('lengthMeasurementRemoved', event.detail);
        };

        const angleRemovedListener = (event: any) => {
            this.handleMeasurementEvent('angleMeasurementRemoved', event.detail);
        };

        const areaRemovedListener = (event: any) => {
            this.handleMeasurementEvent('areaMeasurementRemoved', event.detail);
        };

        // Store event listeners for cleanup
        this.eventListeners.set('lengthMeasurementCompleted', lengthCompletedListener);
        this.eventListeners.set('angleMeasurementCompleted', angleCompletedListener);
        this.eventListeners.set('areaMeasurementCompleted', areaCompletedListener);
        this.eventListeners.set('lengthMeasurementModified', lengthModifiedListener);
        this.eventListeners.set('angleMeasurementModified', angleModifiedListener);
        this.eventListeners.set('areaMeasurementModified', areaModifiedListener);
        this.eventListeners.set('lengthMeasurementRemoved', lengthRemovedListener);
        this.eventListeners.set('angleMeasurementRemoved', angleRemovedListener);
        this.eventListeners.set('areaMeasurementRemoved', areaRemovedListener);

        // Add event listeners
        eventTarget.addEventListener('lengthMeasurementCompleted', lengthCompletedListener);
        eventTarget.addEventListener('angleMeasurementCompleted', angleCompletedListener);
        eventTarget.addEventListener('areaMeasurementCompleted', areaCompletedListener);
        eventTarget.addEventListener('lengthMeasurementModified', lengthModifiedListener);
        eventTarget.addEventListener('angleMeasurementModified', angleModifiedListener);
        eventTarget.addEventListener('areaMeasurementModified', areaModifiedListener);
        eventTarget.addEventListener('lengthMeasurementRemoved', lengthRemovedListener);
        eventTarget.addEventListener('angleMeasurementRemoved', angleRemovedListener);
        eventTarget.addEventListener('areaMeasurementRemoved', areaRemovedListener);
    }

    private handleMeasurementEvent(eventType: string, eventDetail: any): void {
        try {
            console.log(`📊 Measurement Manager: ${eventType}`, eventDetail);
            
            // Trigger global measurement event
            const globalEvent = new CustomEvent('measurementManagerEvent', {
                detail: {
                    eventType,
                    measurementData: eventDetail.measurementData,
                    toolName: eventDetail.toolName,
                    timestamp: eventDetail.timestamp || new Date().toISOString()
                }
            });

            eventTarget.dispatchEvent(globalEvent);

        } catch (error) {
            console.error('❌ Error handling measurement event:', error);
        }
    }

    private async initializeTools(config: MeasurementManagerConfig): Promise<void> {
        try {
            // Initialize base measurement tools manager
            await this.measurementToolsManager.initialize(config.measurementToolsConfig);

            // Initialize individual measurement tools
            const enabledTools = config.enabledTools || {
                length: true,
                angle: true,
                area: true
            };

            if (enabledTools.length) {
                this.lengthTool = createLengthTool(this.toolGroupId, config.toolConfigs?.length);
                console.log('✓ Length measurement tool initialized');
            }

            if (enabledTools.angle) {
                this.angleTool = createAngleTool(this.toolGroupId, config.toolConfigs?.angle);
                console.log('✓ Angle measurement tool initialized');
            }

            if (enabledTools.area) {
                this.areaTool = createAreaTool(this.toolGroupId, config.toolConfigs?.area);
                console.log('✓ Area measurement tool initialized');
            }

            this.isInitialized = true;
            console.log('✓ Measurement Manager initialized successfully');

        } catch (error) {
            console.error('❌ Error initializing measurement tools:', error);
            throw error;
        }
    }

    public async initialize(): Promise<void> {
        if (this.isInitialized) {
            console.log('Measurement Manager already initialized');
            return;
        }

        try {
            await this.measurementToolsManager.initialize();
            this.isInitialized = true;
            console.log('✓ Measurement Manager initialized');
        } catch (error) {
            console.error('❌ Error initializing Measurement Manager:', error);
            throw error;
        }
    }

    public addViewport(viewportId: string, renderingEngineId: string): boolean {
        if (!this.isInitialized) {
            console.error('Measurement Manager not initialized');
            return false;
        }

        return this.measurementToolsManager.addViewportToToolGroup(viewportId, renderingEngineId);
    }

    public removeViewport(viewportId: string, renderingEngineId: string): boolean {
        if (!this.isInitialized) {
            console.error('Measurement Manager not initialized');
            return false;
        }

        return this.measurementToolsManager.removeViewportFromToolGroup(viewportId, renderingEngineId);
    }

    public activateTool(toolName: string): boolean {
        if (!this.isInitialized) {
            console.error('Measurement Manager not initialized');
            return false;
        }

        try {
            let success = false;
            
            switch (toolName.toLowerCase()) {
                case 'length':
                    success = this.lengthTool?.enableLengthTool() || false;
                    if (success) {
                        success = this.measurementToolsManager.activateMeasurementTool('Length');
                    }
                    break;
                    
                case 'angle':
                    success = this.angleTool?.enableAngleTool() || false;
                    if (success) {
                        success = this.measurementToolsManager.activateMeasurementTool('Angle');
                    }
                    break;
                    
                case 'elliptical':
                case 'ellipticalroi':
                    success = this.areaTool?.enableEllipticalROITool() || false;
                    if (success) {
                        success = this.measurementToolsManager.activateMeasurementTool('EllipticalROI');
                    }
                    break;
                    
                case 'rectangle':
                case 'rectangleroi':
                    success = this.areaTool?.enableRectangleROITool() || false;
                    if (success) {
                        success = this.measurementToolsManager.activateMeasurementTool('RectangleROI');
                    }
                    break;
                    
                default:
                    console.error(`Unknown tool: ${toolName}`);
                    return false;
            }

            if (success) {
                this.activeTool = toolName.toLowerCase();
                console.log(`✓ Activated measurement tool: ${toolName}`);
            }

            return success;

        } catch (error) {
            console.error(`❌ Error activating tool ${toolName}:`, error);
            return false;
        }
    }

    public deactivateTool(toolName: string): boolean {
        if (!this.isInitialized) {
            console.error('Measurement Manager not initialized');
            return false;
        }

        try {
            let success = false;
            
            switch (toolName.toLowerCase()) {
                case 'length':
                    success = this.lengthTool?.disableLengthTool() || false;
                    if (success) {
                        success = this.measurementToolsManager.deactivateMeasurementTool('Length');
                    }
                    break;
                    
                case 'angle':
                    success = this.angleTool?.disableAngleTool() || false;
                    if (success) {
                        success = this.measurementToolsManager.deactivateMeasurementTool('Angle');
                    }
                    break;
                    
                case 'elliptical':
                case 'ellipticalroi':
                    success = this.areaTool?.disableEllipticalROITool() || false;
                    if (success) {
                        success = this.measurementToolsManager.deactivateMeasurementTool('EllipticalROI');
                    }
                    break;
                    
                case 'rectangle':
                case 'rectangleroi':
                    success = this.areaTool?.disableRectangleROITool() || false;
                    if (success) {
                        success = this.measurementToolsManager.deactivateMeasurementTool('RectangleROI');
                    }
                    break;
                    
                default:
                    console.error(`Unknown tool: ${toolName}`);
                    return false;
            }

            if (success && this.activeTool === toolName.toLowerCase()) {
                this.activeTool = null;
                console.log(`✓ Deactivated measurement tool: ${toolName}`);
            }

            return success;

        } catch (error) {
            console.error(`❌ Error deactivating tool ${toolName}:`, error);
            return false;
        }
    }

    public deactivateAllTools(): boolean {
        if (!this.isInitialized) {
            console.error('Measurement Manager not initialized');
            return false;
        }

        try {
            let success = true;
            
            if (this.lengthTool) {
                success = success && this.lengthTool.disableLengthTool();
            }
            
            if (this.angleTool) {
                success = success && this.angleTool.disableAngleTool();
            }
            
            if (this.areaTool) {
                success = success && this.areaTool.disableEllipticalROITool();
                success = success && this.areaTool.disableRectangleROITool();
            }

            if (success) {
                this.activeTool = null;
                console.log('✓ All measurement tools deactivated');
            }

            return success;

        } catch (error) {
            console.error('❌ Error deactivating all tools:', error);
            return false;
        }
    }

    public getActiveTool(): string | null {
        return this.activeTool;
    }

    public getAllMeasurements(): AllMeasurementData[] {
        const measurements: AllMeasurementData[] = [];
        
        if (this.lengthTool) {
            measurements.push(...this.lengthTool.getMeasurements());
        }
        
        if (this.angleTool) {
            measurements.push(...this.angleTool.getMeasurements());
        }
        
        if (this.areaTool) {
            measurements.push(...this.areaTool.getMeasurements());
        }
        
        return measurements;
    }

    public getMeasurementsByType(type: 'length' | 'angle' | 'area'): AllMeasurementData[] {
        switch (type) {
            case 'length':
                return this.lengthTool?.getMeasurements() || [];
            case 'angle':
                return this.angleTool?.getMeasurements() || [];
            case 'area':
                return this.areaTool?.getMeasurements() || [];
            default:
                return [];
        }
    }

    public getMeasurementsByViewport(viewportId: string): AllMeasurementData[] {
        return this.getAllMeasurements().filter(measurement => 
            measurement.viewportId === viewportId
        );
    }

    public getMeasurementsByImageId(imageId: string): AllMeasurementData[] {
        return this.getAllMeasurements().filter(measurement => 
            measurement.imageId === imageId
        );
    }

    public getMeasurement(id: string): AllMeasurementData | null {
        if (this.lengthTool) {
            const lengthMeasurement = this.lengthTool.getMeasurement(id);
            if (lengthMeasurement) return lengthMeasurement;
        }
        
        if (this.angleTool) {
            const angleMeasurement = this.angleTool.getMeasurement(id);
            if (angleMeasurement) return angleMeasurement;
        }
        
        if (this.areaTool) {
            const areaMeasurement = this.areaTool.getMeasurement(id);
            if (areaMeasurement) return areaMeasurement;
        }
        
        return null;
    }

    public removeMeasurement(id: string): boolean {
        if (this.lengthTool?.getMeasurement(id)) {
            return this.lengthTool.removeMeasurement(id);
        }
        
        if (this.angleTool?.getMeasurement(id)) {
            return this.angleTool.removeMeasurement(id);
        }
        
        if (this.areaTool?.getMeasurement(id)) {
            return this.areaTool.removeMeasurement(id);
        }
        
        return false;
    }

    public clearAllMeasurements(): void {
        if (this.lengthTool) {
            this.lengthTool.clearAllMeasurements();
        }
        
        if (this.angleTool) {
            this.angleTool.clearAllMeasurements();
        }
        
        if (this.areaTool) {
            this.areaTool.clearAllMeasurements();
        }
        
        console.log('✓ All measurements cleared');
    }

    public clearMeasurementsByType(type: 'length' | 'angle' | 'area'): void {
        switch (type) {
            case 'length':
                this.lengthTool?.clearAllMeasurements();
                break;
            case 'angle':
                this.angleTool?.clearAllMeasurements();
                break;
            case 'area':
                this.areaTool?.clearAllMeasurements();
                break;
        }
        
        console.log(`✓ All ${type} measurements cleared`);
    }

    public clearMeasurementsByViewport(viewportId: string): void {
        const measurements = this.getMeasurementsByViewport(viewportId);
        measurements.forEach(measurement => {
            this.removeMeasurement(measurement.id);
        });
        
        console.log(`✓ All measurements cleared for viewport: ${viewportId}`);
    }

    public clearMeasurementsByImageId(imageId: string): void {
        const measurements = this.getMeasurementsByImageId(imageId);
        measurements.forEach(measurement => {
            this.removeMeasurement(measurement.id);
        });
        
        console.log(`✓ All measurements cleared for image: ${imageId}`);
    }

    public getMeasurementSummary(): MeasurementSummary {
        const allMeasurements = this.getAllMeasurements();
        
        const summary: MeasurementSummary = {
            totalMeasurements: allMeasurements.length,
            lengthMeasurements: this.lengthTool?.getMeasurementCount() || 0,
            angleMeasurements: this.angleTool?.getMeasurementCount() || 0,
            areaMeasurements: this.areaTool?.getMeasurementCount() || 0,
            byViewport: {},
            byImageId: {}
        };

        // Group by viewport
        allMeasurements.forEach(measurement => {
            if (measurement.viewportId) {
                summary.byViewport[measurement.viewportId] = (summary.byViewport[measurement.viewportId] || 0) + 1;
            }
            
            if (measurement.imageId) {
                summary.byImageId[measurement.imageId] = (summary.byImageId[measurement.imageId] || 0) + 1;
            }
        });

        return summary;
    }

    public exportAllMeasurements(): string {
        const measurements = {
            length: this.lengthTool?.getMeasurements() || [],
            angle: this.angleTool?.getMeasurements() || [],
            area: this.areaTool?.getMeasurements() || []
        };
        
        return JSON.stringify(measurements, null, 2);
    }

    public importMeasurements(data: string): boolean {
        try {
            const measurements = JSON.parse(data);
            
            if (!measurements || typeof measurements !== 'object') {
                throw new Error('Invalid measurements data format');
            }

            let success = true;
            
            if (measurements.length && this.lengthTool) {
                success = success && this.lengthTool.importMeasurements(JSON.stringify(measurements.length));
            }
            
            if (measurements.angle && this.angleTool) {
                success = success && this.angleTool.importMeasurements(JSON.stringify(measurements.angle));
            }
            
            if (measurements.area && this.areaTool) {
                success = success && this.areaTool.importMeasurements(JSON.stringify(measurements.area));
            }

            if (success) {
                console.log('✓ Measurements imported successfully');
            }

            return success;

        } catch (error) {
            console.error('❌ Error importing measurements:', error);
            return false;
        }
    }

    public getToolGroupId(): string {
        return this.toolGroupId;
    }

    public getToolGroup(): any {
        return this.measurementToolsManager.getToolGroup();
    }

    public getMeasurementToolsManager(): MeasurementToolsManager {
        return this.measurementToolsManager;
    }

    public getLengthTool(): LengthMeasurementTool | null {
        return this.lengthTool;
    }

    public getAngleTool(): AngleMeasurementTool | null {
        return this.angleTool;
    }

    public getAreaTool(): AreaMeasurementTool | null {
        return this.areaTool;
    }

    public getInitializationStatus(): boolean {
        return this.isInitialized;
    }

    public dispose(): void {
        try {
            // Remove event listeners
            this.eventListeners.forEach((listener, eventType) => {
                eventTarget.removeEventListener(eventType, listener);
            });
            this.eventListeners.clear();

            // Dispose individual tools
            if (this.lengthTool) {
                this.lengthTool.dispose();
                this.lengthTool = null;
            }
            
            if (this.angleTool) {
                this.angleTool.dispose();
                this.angleTool = null;
            }
            
            if (this.areaTool) {
                this.areaTool.dispose();
                this.areaTool = null;
            }

            // Dispose measurement tools manager
            this.measurementToolsManager.dispose();

            this.isInitialized = false;
            this.activeTool = null;

            console.log('✓ Measurement Manager disposed successfully');

        } catch (error) {
            console.error('❌ Error disposing Measurement Manager:', error);
        }
    }
}

// Convenience functions
export function createMeasurementManager(config?: MeasurementManagerConfig): MeasurementManager {
    return new MeasurementManager(config);
}

export function getDefaultMeasurementManagerConfig(): MeasurementManagerConfig {
    return {
        toolGroupId: 'default-measurement-manager',
        enabledTools: {
            length: true,
            angle: true,
            area: true
        },
        toolConfigs: {
            length: {
                unit: 'mm',
                precision: 2,
                showUnit: true,
                color: '#FFFF00',
                lineWidth: 2,
                showLength: true
            },
            angle: {
                unit: 'degrees',
                precision: 1,
                showUnit: true,
                color: '#00FF00',
                lineWidth: 2,
                showAngle: true,
                showLines: true,
                showArc: true
            },
            area: {
                unit: 'mm²',
                precision: 2,
                showUnit: true,
                color: '#FF0000',
                lineWidth: 2,
                showArea: true,
                showPerimeter: false,
                fillOpacity: 0.1
            }
        }
    };
}

// Type guards
export function isLengthMeasurement(measurement: AllMeasurementData): measurement is LengthMeasurementData {
    return 'length' in measurement;
}

export function isAngleMeasurement(measurement: AllMeasurementData): measurement is AngleMeasurementData {
    return 'angle' in measurement;
}

export function isAreaMeasurement(measurement: AllMeasurementData): measurement is AreaMeasurementData {
    return 'area' in measurement;
}