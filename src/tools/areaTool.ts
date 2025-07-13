import { 
    EllipticalROITool,
    RectangleROITool,
    ToolGroupManager,
    Enums as ToolEnums
} from '@cornerstonejs/tools';
import { eventTarget, triggerEvent } from '@cornerstonejs/core';
import { Types } from '@cornerstonejs/core';

export interface AreaMeasurementData {
    id: string;
    toolName: string;
    area: number;
    perimeter?: number;
    unit: string;
    toolType: 'elliptical' | 'rectangle';
    bounds: {
        left: number;
        top: number;
        width: number;
        height: number;
    };
    handles: Types.Point2[];
    imageId: string;
    viewportId: string;
    timestamp: string;
    metadata?: {
        patientId?: string;
        studyId?: string;
        seriesId?: string;
        instanceId?: string;
    };
}

export interface AreaToolConfig {
    unit?: 'mm²' | 'cm²' | 'pixels²';
    precision?: number;
    showUnit?: boolean;
    color?: string;
    lineWidth?: number;
    showArea?: boolean;
    showPerimeter?: boolean;
    fillColor?: string;
    fillOpacity?: number;
    allowOpenContours?: boolean;
}

export class AreaMeasurementTool {
    private toolGroupId: string;
    private config: AreaToolConfig;
    private measurements: Map<string, AreaMeasurementData> = new Map();
    private eventListeners: Map<string, (event: any) => void> = new Map();

    constructor(toolGroupId: string, config: AreaToolConfig = {}) {
        this.toolGroupId = toolGroupId;
        this.config = {
            unit: 'mm²',
            precision: 2,
            showUnit: true,
            color: '#FF0000',
            lineWidth: 2,
            showArea: true,
            showPerimeter: false,
            fillColor: '#FF0000',
            fillOpacity: 0.1,
            allowOpenContours: false,
            ...config
        };

        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Listen for measurement completed events
        const measurementCompletedListener = (event: any) => {
            const toolName = event.detail.toolName;
            if (toolName === EllipticalROITool.toolName || toolName === RectangleROITool.toolName) {
                this.handleMeasurementCompleted(event);
            }
        };

        const measurementModifiedListener = (event: any) => {
            const toolName = event.detail.toolName;
            if (toolName === EllipticalROITool.toolName || toolName === RectangleROITool.toolName) {
                this.handleMeasurementModified(event);
            }
        };

        const measurementRemovedListener = (event: any) => {
            const toolName = event.detail.toolName;
            if (toolName === EllipticalROITool.toolName || toolName === RectangleROITool.toolName) {
                this.handleMeasurementRemoved(event);
            }
        };

        // Store event listeners for cleanup
        this.eventListeners.set('measurementCompleted', measurementCompletedListener);
        this.eventListeners.set('measurementModified', measurementModifiedListener);
        this.eventListeners.set('measurementRemoved', measurementRemovedListener);

        // Add event listeners
        eventTarget.addEventListener('MEASUREMENT_COMPLETED', measurementCompletedListener);
        eventTarget.addEventListener('MEASUREMENT_MODIFIED', measurementModifiedListener);
        eventTarget.addEventListener('MEASUREMENT_REMOVED', measurementRemovedListener);
    }

    private handleMeasurementCompleted(event: any): void {
        try {
            const measurementData = this.extractMeasurementData(event.detail);
            if (measurementData) {
                this.measurements.set(measurementData.id, measurementData);
                
                console.log(`✓ Area measurement completed:`, measurementData);
                
                // Trigger custom event
                this.triggerMeasurementEvent('areaMeasurementCompleted', measurementData);
            }
        } catch (error) {
            console.error('❌ Error handling area measurement completion:', error);
        }
    }

    private handleMeasurementModified(event: any): void {
        try {
            const measurementData = this.extractMeasurementData(event.detail);
            if (measurementData && this.measurements.has(measurementData.id)) {
                this.measurements.set(measurementData.id, measurementData);
                
                console.log(`✓ Area measurement modified:`, measurementData);
                
                // Trigger custom event
                this.triggerMeasurementEvent('areaMeasurementModified', measurementData);
            }
        } catch (error) {
            console.error('❌ Error handling area measurement modification:', error);
        }
    }

    private handleMeasurementRemoved(event: any): void {
        try {
            const measurementId = event.detail.measurementId || event.detail.annotationUID;
            if (measurementId && this.measurements.has(measurementId)) {
                const measurementData = this.measurements.get(measurementId);
                this.measurements.delete(measurementId);
                
                console.log(`✓ Area measurement removed:`, measurementId);
                
                // Trigger custom event
                this.triggerMeasurementEvent('areaMeasurementRemoved', measurementData);
            }
        } catch (error) {
            console.error('❌ Error handling area measurement removal:', error);
        }
    }

    private extractMeasurementData(eventDetail: any): AreaMeasurementData | null {
        try {
            const annotation = eventDetail.annotation;
            if (!annotation || !annotation.data) {
                return null;
            }

            const handles = annotation.data.handles;
            if (!handles || !handles.points || handles.points.length < 2) {
                return null;
            }

            const toolName = eventDetail.toolName;
            const toolType = toolName === EllipticalROITool.toolName ? 'elliptical' : 'rectangle';
            
            // Calculate bounds
            const bounds = this.calculateBounds(handles.points);
            
            // Calculate area and perimeter
            const area = this.calculateArea(bounds, toolType);
            const perimeter = this.calculatePerimeter(bounds, toolType);

            // Format values based on configuration
            const formattedArea = this.formatArea(area);
            const formattedPerimeter = this.formatPerimeter(perimeter);

            const measurementData: AreaMeasurementData = {
                id: annotation.annotationUID || `area-${Date.now()}-${Math.random()}`,
                toolName: toolName,
                area: formattedArea,
                perimeter: formattedPerimeter,
                unit: this.config.unit || 'mm²',
                toolType: toolType,
                bounds: bounds,
                handles: handles.points,
                imageId: eventDetail.imageId || annotation.imageId || '',
                viewportId: eventDetail.viewportId || annotation.viewportId || '',
                timestamp: new Date().toISOString(),
                metadata: {
                    patientId: eventDetail.metadata?.patientId,
                    studyId: eventDetail.metadata?.studyId,
                    seriesId: eventDetail.metadata?.seriesId,
                    instanceId: eventDetail.metadata?.instanceId
                }
            };

            return measurementData;

        } catch (error) {
            console.error('❌ Error extracting area measurement data:', error);
            return null;
        }
    }

    private calculateBounds(points: Types.Point2[]): { left: number; top: number; width: number; height: number } {
        const xs = points.map(p => p[0]);
        const ys = points.map(p => p[1]);
        
        const left = Math.min(...xs);
        const right = Math.max(...xs);
        const top = Math.min(...ys);
        const bottom = Math.max(...ys);
        
        return {
            left,
            top,
            width: right - left,
            height: bottom - top
        };
    }

    private calculateArea(bounds: { width: number; height: number }, toolType: 'elliptical' | 'rectangle'): number {
        if (toolType === 'elliptical') {
            // Area of ellipse = π × a × b (where a and b are semi-axes)
            const a = bounds.width / 2;
            const b = bounds.height / 2;
            return Math.PI * a * b;
        } else {
            // Area of rectangle = width × height
            return bounds.width * bounds.height;
        }
    }

    private calculatePerimeter(bounds: { width: number; height: number }, toolType: 'elliptical' | 'rectangle'): number {
        if (toolType === 'elliptical') {
            // Approximation of ellipse perimeter using Ramanujan's formula
            const a = bounds.width / 2;
            const b = bounds.height / 2;
            const h = Math.pow(a - b, 2) / Math.pow(a + b, 2);
            return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
        } else {
            // Perimeter of rectangle = 2 × (width + height)
            return 2 * (bounds.width + bounds.height);
        }
    }

    private formatArea(area: number): number {
        const precision = this.config.precision || 2;
        return Math.round(area * Math.pow(10, precision)) / Math.pow(10, precision);
    }

    private formatPerimeter(perimeter: number): number {
        const precision = this.config.precision || 2;
        return Math.round(perimeter * Math.pow(10, precision)) / Math.pow(10, precision);
    }

    private triggerMeasurementEvent(eventType: string, data: any): void {
        const customEvent = new CustomEvent(eventType, {
            detail: {
                toolName: data.toolName,
                measurementData: data,
                timestamp: new Date().toISOString()
            }
        });

        eventTarget.dispatchEvent(customEvent);
    }

    public enableEllipticalROITool(): boolean {
        try {
            const toolGroup = ToolGroupManager.getToolGroup(this.toolGroupId);
            if (!toolGroup) {
                console.error('Tool group not found:', this.toolGroupId);
                return false;
            }

            // Set tool configuration
            this.configureEllipticalROITool();

            // Activate the elliptical ROI tool
            toolGroup.setToolActive(EllipticalROITool.toolName, {
                bindings: [
                    {
                        mouseButton: ToolEnums.MouseBindings.Primary,
                    },
                ],
            });

            console.log(`✓ Elliptical ROI tool enabled for tool group: ${this.toolGroupId}`);
            return true;

        } catch (error) {
            console.error('❌ Error enabling elliptical ROI tool:', error);
            return false;
        }
    }

    public enableRectangleROITool(): boolean {
        try {
            const toolGroup = ToolGroupManager.getToolGroup(this.toolGroupId);
            if (!toolGroup) {
                console.error('Tool group not found:', this.toolGroupId);
                return false;
            }

            // Set tool configuration
            this.configureRectangleROITool();

            // Activate the rectangle ROI tool
            toolGroup.setToolActive(RectangleROITool.toolName, {
                bindings: [
                    {
                        mouseButton: ToolEnums.MouseBindings.Primary,
                    },
                ],
            });

            console.log(`✓ Rectangle ROI tool enabled for tool group: ${this.toolGroupId}`);
            return true;

        } catch (error) {
            console.error('❌ Error enabling rectangle ROI tool:', error);
            return false;
        }
    }

    public disableEllipticalROITool(): boolean {
        try {
            const toolGroup = ToolGroupManager.getToolGroup(this.toolGroupId);
            if (!toolGroup) {
                console.error('Tool group not found:', this.toolGroupId);
                return false;
            }

            // Set tool to passive
            toolGroup.setToolPassive(EllipticalROITool.toolName);

            console.log(`✓ Elliptical ROI tool disabled for tool group: ${this.toolGroupId}`);
            return true;

        } catch (error) {
            console.error('❌ Error disabling elliptical ROI tool:', error);
            return false;
        }
    }

    public disableRectangleROITool(): boolean {
        try {
            const toolGroup = ToolGroupManager.getToolGroup(this.toolGroupId);
            if (!toolGroup) {
                console.error('Tool group not found:', this.toolGroupId);
                return false;
            }

            // Set tool to passive
            toolGroup.setToolPassive(RectangleROITool.toolName);

            console.log(`✓ Rectangle ROI tool disabled for tool group: ${this.toolGroupId}`);
            return true;

        } catch (error) {
            console.error('❌ Error disabling rectangle ROI tool:', error);
            return false;
        }
    }

    private configureEllipticalROITool(): void {
        try {
            const toolConfiguration = {
                ...this.config,
                drawHandles: true,
                drawHandlesOnHover: true,
                hideHandlesIfMoving: false,
                renderDashed: false,
                showTextBox: this.config.showArea
            };

            // Apply configuration to the tool
            // Note: Tool configuration is handled by tool group settings
            console.log('✓ Elliptical ROI tool configured');

        } catch (error) {
            console.error('❌ Error configuring elliptical ROI tool:', error);
        }
    }

    private configureRectangleROITool(): void {
        try {
            const toolConfiguration = {
                ...this.config,
                drawHandles: true,
                drawHandlesOnHover: true,
                hideHandlesIfMoving: false,
                renderDashed: false,
                showTextBox: this.config.showArea
            };

            // Apply configuration to the tool
            // Note: Tool configuration is handled by tool group settings
            console.log('✓ Rectangle ROI tool configured');

        } catch (error) {
            console.error('❌ Error configuring rectangle ROI tool:', error);
        }
    }

    public getMeasurements(): AreaMeasurementData[] {
        return Array.from(this.measurements.values());
    }

    public getMeasurement(id: string): AreaMeasurementData | undefined {
        return this.measurements.get(id);
    }

    public getMeasurementsByType(toolType: 'elliptical' | 'rectangle'): AreaMeasurementData[] {
        return this.getMeasurements().filter(measurement => measurement.toolType === toolType);
    }

    public removeMeasurement(id: string): boolean {
        if (this.measurements.has(id)) {
            this.measurements.delete(id);
            console.log(`✓ Area measurement removed: ${id}`);
            return true;
        }
        return false;
    }

    public clearAllMeasurements(): void {
        this.measurements.clear();
        console.log('✓ All area measurements cleared');
    }

    public clearMeasurementsByType(toolType: 'elliptical' | 'rectangle'): void {
        const measurementsToRemove = this.getMeasurementsByType(toolType);
        measurementsToRemove.forEach(measurement => {
            this.measurements.delete(measurement.id);
        });
        console.log(`✓ All ${toolType} measurements cleared`);
    }

    public getMeasurementCount(): number {
        return this.measurements.size;
    }

    public getMeasurementCountByType(toolType: 'elliptical' | 'rectangle'): number {
        return this.getMeasurementsByType(toolType).length;
    }

    public updateConfig(newConfig: Partial<AreaToolConfig>): void {
        this.config = { ...this.config, ...newConfig };
        this.configureEllipticalROITool();
        this.configureRectangleROITool();
        console.log('✓ Area tool configuration updated');
    }

    public exportMeasurements(): string {
        const measurements = this.getMeasurements();
        return JSON.stringify(measurements, null, 2);
    }

    public importMeasurements(data: string): boolean {
        try {
            const measurements = JSON.parse(data) as AreaMeasurementData[];
            
            // Validate measurements
            if (!Array.isArray(measurements)) {
                throw new Error('Invalid measurements data format');
            }

            // Clear existing measurements
            this.clearAllMeasurements();

            // Add imported measurements
            measurements.forEach(measurement => {
                if (this.validateMeasurementData(measurement)) {
                    this.measurements.set(measurement.id, measurement);
                }
            });

            console.log(`✓ Imported ${measurements.length} area measurements`);
            return true;

        } catch (error) {
            console.error('❌ Error importing area measurements:', error);
            return false;
        }
    }

    private validateMeasurementData(data: any): boolean {
        return (
            data &&
            typeof data.id === 'string' &&
            typeof data.area === 'number' &&
            typeof data.toolType === 'string' &&
            ['elliptical', 'rectangle'].includes(data.toolType) &&
            data.bounds &&
            typeof data.bounds.left === 'number' &&
            typeof data.bounds.top === 'number' &&
            typeof data.bounds.width === 'number' &&
            typeof data.bounds.height === 'number' &&
            Array.isArray(data.handles)
        );
    }

    public dispose(): void {
        try {
            // Remove event listeners
            this.eventListeners.forEach((listener, eventType) => {
                eventTarget.removeEventListener(eventType.toUpperCase(), listener);
            });

            // Clear measurements
            this.measurements.clear();

            // Clear event listeners map
            this.eventListeners.clear();

            console.log('✓ Area measurement tool disposed');

        } catch (error) {
            console.error('❌ Error disposing area measurement tool:', error);
        }
    }
}

// Convenience functions
export function createAreaTool(toolGroupId: string, config?: AreaToolConfig): AreaMeasurementTool {
    return new AreaMeasurementTool(toolGroupId, config);
}

export function calculateEllipseArea(width: number, height: number): number {
    const a = width / 2;
    const b = height / 2;
    return Math.PI * a * b;
}

export function calculateRectangleArea(width: number, height: number): number {
    return width * height;
}

export function calculateEllipsePerimeter(width: number, height: number): number {
    const a = width / 2;
    const b = height / 2;
    const h = Math.pow(a - b, 2) / Math.pow(a + b, 2);
    return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

export function calculateRectanglePerimeter(width: number, height: number): number {
    return 2 * (width + height);
}

export function formatAreaValue(area: number, unit: string = 'mm²', precision: number = 2): string {
    const formatted = Math.round(area * Math.pow(10, precision)) / Math.pow(10, precision);
    return `${formatted} ${unit}`;
}

export function formatPerimeterValue(perimeter: number, unit: string = 'mm', precision: number = 2): string {
    const formatted = Math.round(perimeter * Math.pow(10, precision)) / Math.pow(10, precision);
    return `${formatted} ${unit}`;
}

// Default configuration
export const DEFAULT_AREA_CONFIG: AreaToolConfig = {
    unit: 'mm²',
    precision: 2,
    showUnit: true,
    color: '#FF0000',
    lineWidth: 2,
    showArea: true,
    showPerimeter: false,
    fillColor: '#FF0000',
    fillOpacity: 0.1,
    allowOpenContours: false
};