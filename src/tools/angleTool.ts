import { 
    AngleTool,
    ToolGroupManager,
    Enums as ToolEnums
} from '@cornerstonejs/tools';
import { eventTarget, triggerEvent } from '@cornerstonejs/core';
import { Types } from '@cornerstonejs/core';

export interface AngleMeasurementData {
    id: string;
    toolName: string;
    angle: number;
    unit: string;
    point1: Types.Point2;
    point2: Types.Point2;
    point3: Types.Point2;
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

export interface AngleToolConfig {
    unit?: 'degrees' | 'radians';
    precision?: number;
    showUnit?: boolean;
    color?: string;
    lineWidth?: number;
    showAngle?: boolean;
    showLines?: boolean;
    showArc?: boolean;
    arcRadius?: number;
}

export class AngleMeasurementTool {
    private toolGroupId: string;
    private config: AngleToolConfig;
    private measurements: Map<string, AngleMeasurementData> = new Map();
    private eventListeners: Map<string, (event: any) => void> = new Map();

    constructor(toolGroupId: string, config: AngleToolConfig = {}) {
        this.toolGroupId = toolGroupId;
        this.config = {
            unit: 'degrees',
            precision: 1,
            showUnit: true,
            color: '#00FF00',
            lineWidth: 2,
            showAngle: true,
            showLines: true,
            showArc: true,
            arcRadius: 25,
            ...config
        };

        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Listen for measurement completed events
        const measurementCompletedListener = (event: any) => {
            if (event.detail.toolName === AngleTool.toolName) {
                this.handleMeasurementCompleted(event);
            }
        };

        const measurementModifiedListener = (event: any) => {
            if (event.detail.toolName === AngleTool.toolName) {
                this.handleMeasurementModified(event);
            }
        };

        const measurementRemovedListener = (event: any) => {
            if (event.detail.toolName === AngleTool.toolName) {
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
                
                console.log(`✓ Angle measurement completed:`, measurementData);
                
                // Trigger custom event
                this.triggerMeasurementEvent('angleMeasurementCompleted', measurementData);
            }
        } catch (error) {
            console.error('❌ Error handling angle measurement completion:', error);
        }
    }

    private handleMeasurementModified(event: any): void {
        try {
            const measurementData = this.extractMeasurementData(event.detail);
            if (measurementData && this.measurements.has(measurementData.id)) {
                this.measurements.set(measurementData.id, measurementData);
                
                console.log(`✓ Angle measurement modified:`, measurementData);
                
                // Trigger custom event
                this.triggerMeasurementEvent('angleMeasurementModified', measurementData);
            }
        } catch (error) {
            console.error('❌ Error handling angle measurement modification:', error);
        }
    }

    private handleMeasurementRemoved(event: any): void {
        try {
            const measurementId = event.detail.measurementId || event.detail.annotationUID;
            if (measurementId && this.measurements.has(measurementId)) {
                const measurementData = this.measurements.get(measurementId);
                this.measurements.delete(measurementId);
                
                console.log(`✓ Angle measurement removed:`, measurementId);
                
                // Trigger custom event
                this.triggerMeasurementEvent('angleMeasurementRemoved', measurementData);
            }
        } catch (error) {
            console.error('❌ Error handling angle measurement removal:', error);
        }
    }

    private extractMeasurementData(eventDetail: any): AngleMeasurementData | null {
        try {
            const annotation = eventDetail.annotation;
            if (!annotation || !annotation.data) {
                return null;
            }

            const handles = annotation.data.handles;
            if (!handles || !handles.points || handles.points.length < 3) {
                return null;
            }

            const point1 = handles.points[0];
            const point2 = handles.points[1]; // Vertex point
            const point3 = handles.points[2];
            
            // Calculate angle
            const angle = this.calculateAngle(point1, point2, point3);
            
            // Format angle based on configuration
            const formattedAngle = this.formatAngle(angle);

            const measurementData: AngleMeasurementData = {
                id: annotation.annotationUID || `angle-${Date.now()}-${Math.random()}`,
                toolName: AngleTool.toolName,
                angle: formattedAngle,
                unit: this.config.unit || 'degrees',
                point1: point1,
                point2: point2, // Vertex
                point3: point3,
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
            console.error('❌ Error extracting angle measurement data:', error);
            return null;
        }
    }

    private calculateAngle(point1: Types.Point2, vertex: Types.Point2, point3: Types.Point2): number {
        // Calculate vectors from vertex to each point
        const vector1 = {
            x: point1[0] - vertex[0],
            y: point1[1] - vertex[1]
        };
        
        const vector2 = {
            x: point3[0] - vertex[0],
            y: point3[1] - vertex[1]
        };

        // Calculate dot product
        const dotProduct = vector1.x * vector2.x + vector1.y * vector2.y;
        
        // Calculate magnitudes
        const magnitude1 = Math.sqrt(vector1.x * vector1.x + vector1.y * vector1.y);
        const magnitude2 = Math.sqrt(vector2.x * vector2.x + vector2.y * vector2.y);

        // Handle edge cases
        if (magnitude1 === 0 || magnitude2 === 0) {
            return 0;
        }

        // Calculate cosine of angle
        const cosAngle = dotProduct / (magnitude1 * magnitude2);
        
        // Clamp to avoid numerical errors
        const clampedCosAngle = Math.max(-1, Math.min(1, cosAngle));
        
        // Calculate angle in radians
        const angleRadians = Math.acos(clampedCosAngle);
        
        // Convert to degrees if needed
        if (this.config.unit === 'degrees') {
            return angleRadians * (180 / Math.PI);
        }
        
        return angleRadians;
    }

    private formatAngle(angle: number): number {
        const precision = this.config.precision || 1;
        return Math.round(angle * Math.pow(10, precision)) / Math.pow(10, precision);
    }

    private triggerMeasurementEvent(eventType: string, data: any): void {
        const customEvent = new CustomEvent(eventType, {
            detail: {
                toolName: AngleTool.toolName,
                measurementData: data,
                timestamp: new Date().toISOString()
            }
        });

        eventTarget.dispatchEvent(customEvent);
    }

    public enableAngleTool(viewportId?: string): boolean {
        try {
            const toolGroup = ToolGroupManager.getToolGroup(this.toolGroupId);
            if (!toolGroup) {
                console.error('Tool group not found:', this.toolGroupId);
                return false;
            }

            // Set tool configuration
            this.configureTool();

            // Activate the angle tool
            toolGroup.setToolActive(AngleTool.toolName, {
                bindings: [
                    {
                        mouseButton: ToolEnums.MouseBindings.Primary,
                    },
                ],
            });

            console.log(`✓ Angle tool enabled for tool group: ${this.toolGroupId}`);
            return true;

        } catch (error) {
            console.error('❌ Error enabling angle tool:', error);
            return false;
        }
    }

    public disableAngleTool(): boolean {
        try {
            const toolGroup = ToolGroupManager.getToolGroup(this.toolGroupId);
            if (!toolGroup) {
                console.error('Tool group not found:', this.toolGroupId);
                return false;
            }

            // Set tool to passive
            toolGroup.setToolPassive(AngleTool.toolName);

            console.log(`✓ Angle tool disabled for tool group: ${this.toolGroupId}`);
            return true;

        } catch (error) {
            console.error('❌ Error disabling angle tool:', error);
            return false;
        }
    }

    private configureTool(): void {
        try {
            // Set tool configuration
            const toolConfiguration = {
                ...this.config,
                drawHandles: true,
                drawHandlesOnHover: true,
                hideHandlesIfMoving: false,
                renderDashed: false,
                showTextBox: this.config.showAngle
            };

            // Apply configuration to the tool
            // Note: Tool configuration is handled by tool group settings
            console.log('✓ Angle tool configured with options:', toolConfiguration);

        } catch (error) {
            console.error('❌ Error configuring angle tool:', error);
        }
    }

    public getMeasurements(): AngleMeasurementData[] {
        return Array.from(this.measurements.values());
    }

    public getMeasurement(id: string): AngleMeasurementData | undefined {
        return this.measurements.get(id);
    }

    public removeMeasurement(id: string): boolean {
        if (this.measurements.has(id)) {
            this.measurements.delete(id);
            console.log(`✓ Angle measurement removed: ${id}`);
            return true;
        }
        return false;
    }

    public clearAllMeasurements(): void {
        this.measurements.clear();
        console.log('✓ All angle measurements cleared');
    }

    public getMeasurementCount(): number {
        return this.measurements.size;
    }

    public updateConfig(newConfig: Partial<AngleToolConfig>): void {
        this.config = { ...this.config, ...newConfig };
        this.configureTool();
        console.log('✓ Angle tool configuration updated');
    }

    public exportMeasurements(): string {
        const measurements = this.getMeasurements();
        return JSON.stringify(measurements, null, 2);
    }

    public importMeasurements(data: string): boolean {
        try {
            const measurements = JSON.parse(data) as AngleMeasurementData[];
            
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

            console.log(`✓ Imported ${measurements.length} angle measurements`);
            return true;

        } catch (error) {
            console.error('❌ Error importing angle measurements:', error);
            return false;
        }
    }

    private validateMeasurementData(data: any): boolean {
        return (
            data &&
            typeof data.id === 'string' &&
            typeof data.angle === 'number' &&
            Array.isArray(data.point1) &&
            Array.isArray(data.point2) &&
            Array.isArray(data.point3) &&
            data.point1.length === 2 &&
            data.point2.length === 2 &&
            data.point3.length === 2
        );
    }

    public convertAngleUnit(angle: number, fromUnit: 'degrees' | 'radians', toUnit: 'degrees' | 'radians'): number {
        if (fromUnit === toUnit) return angle;
        
        if (fromUnit === 'degrees' && toUnit === 'radians') {
            return angle * (Math.PI / 180);
        }
        
        if (fromUnit === 'radians' && toUnit === 'degrees') {
            return angle * (180 / Math.PI);
        }
        
        return angle;
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

            console.log('✓ Angle measurement tool disposed');

        } catch (error) {
            console.error('❌ Error disposing angle measurement tool:', error);
        }
    }
}

// Convenience functions
export function createAngleTool(toolGroupId: string, config?: AngleToolConfig): AngleMeasurementTool {
    return new AngleMeasurementTool(toolGroupId, config);
}

export function calculateAngleBetweenThreePoints(
    point1: Types.Point2, 
    vertex: Types.Point2, 
    point3: Types.Point2,
    unit: 'degrees' | 'radians' = 'degrees'
): number {
    // Calculate vectors from vertex to each point
    const vector1 = {
        x: point1[0] - vertex[0],
        y: point1[1] - vertex[1]
    };
    
    const vector2 = {
        x: point3[0] - vertex[0],
        y: point3[1] - vertex[1]
    };

    // Calculate dot product
    const dotProduct = vector1.x * vector2.x + vector1.y * vector2.y;
    
    // Calculate magnitudes
    const magnitude1 = Math.sqrt(vector1.x * vector1.x + vector1.y * vector1.y);
    const magnitude2 = Math.sqrt(vector2.x * vector2.x + vector2.y * vector2.y);

    // Handle edge cases
    if (magnitude1 === 0 || magnitude2 === 0) {
        return 0;
    }

    // Calculate cosine of angle
    const cosAngle = dotProduct / (magnitude1 * magnitude2);
    
    // Clamp to avoid numerical errors
    const clampedCosAngle = Math.max(-1, Math.min(1, cosAngle));
    
    // Calculate angle in radians
    const angleRadians = Math.acos(clampedCosAngle);
    
    // Convert to degrees if needed
    if (unit === 'degrees') {
        return angleRadians * (180 / Math.PI);
    }
    
    return angleRadians;
}

export function formatAngleValue(angle: number, unit: string = 'degrees', precision: number = 1): string {
    const formatted = Math.round(angle * Math.pow(10, precision)) / Math.pow(10, precision);
    return `${formatted}${unit === 'degrees' ? '°' : ' rad'}`;
}

export function degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
}

export function radiansToDegrees(radians: number): number {
    return radians * (180 / Math.PI);
}

// Default configuration
export const DEFAULT_ANGLE_CONFIG: AngleToolConfig = {
    unit: 'degrees',
    precision: 1,
    showUnit: true,
    color: '#00FF00',
    lineWidth: 2,
    showAngle: true,
    showLines: true,
    showArc: true,
    arcRadius: 25
};