import { 
    LengthTool,
    ToolGroupManager,
    Enums as ToolEnums
} from '@cornerstonejs/tools';
import { eventTarget, triggerEvent } from '@cornerstonejs/core';
import { Types } from '@cornerstonejs/core';

export interface LengthMeasurementData {
    id: string;
    toolName: string;
    length: number;
    unit: string;
    startPoint: Types.Point2;
    endPoint: Types.Point2;
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

export interface LengthToolConfig {
    unit?: 'mm' | 'cm' | 'pixels';
    precision?: number;
    showUnit?: boolean;
    color?: string;
    lineWidth?: number;
    showLength?: boolean;
    allowOpenContours?: boolean;
}

export class LengthMeasurementTool {
    private toolGroupId: string;
    private config: LengthToolConfig;
    private measurements: Map<string, LengthMeasurementData> = new Map();
    private eventListeners: Map<string, (event: any) => void> = new Map();

    constructor(toolGroupId: string, config: LengthToolConfig = {}) {
        this.toolGroupId = toolGroupId;
        this.config = {
            unit: 'mm',
            precision: 2,
            showUnit: true,
            color: '#FFFF00',
            lineWidth: 2,
            showLength: true,
            allowOpenContours: true,
            ...config
        };

        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Listen for measurement completed events
        const measurementCompletedListener = (event: any) => {
            if (event.detail.toolName === LengthTool.toolName) {
                this.handleMeasurementCompleted(event);
            }
        };

        const measurementModifiedListener = (event: any) => {
            if (event.detail.toolName === LengthTool.toolName) {
                this.handleMeasurementModified(event);
            }
        };

        const measurementRemovedListener = (event: any) => {
            if (event.detail.toolName === LengthTool.toolName) {
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
                
                console.log(`✓ Length measurement completed:`, measurementData);
                
                // Trigger custom event
                this.triggerMeasurementEvent('lengthMeasurementCompleted', measurementData);
            }
        } catch (error) {
            console.error('❌ Error handling measurement completion:', error);
        }
    }

    private handleMeasurementModified(event: any): void {
        try {
            const measurementData = this.extractMeasurementData(event.detail);
            if (measurementData && this.measurements.has(measurementData.id)) {
                this.measurements.set(measurementData.id, measurementData);
                
                console.log(`✓ Length measurement modified:`, measurementData);
                
                // Trigger custom event
                this.triggerMeasurementEvent('lengthMeasurementModified', measurementData);
            }
        } catch (error) {
            console.error('❌ Error handling measurement modification:', error);
        }
    }

    private handleMeasurementRemoved(event: any): void {
        try {
            const measurementId = event.detail.measurementId || event.detail.annotationUID;
            if (measurementId && this.measurements.has(measurementId)) {
                const measurementData = this.measurements.get(measurementId);
                this.measurements.delete(measurementId);
                
                console.log(`✓ Length measurement removed:`, measurementId);
                
                // Trigger custom event
                this.triggerMeasurementEvent('lengthMeasurementRemoved', measurementData);
            }
        } catch (error) {
            console.error('❌ Error handling measurement removal:', error);
        }
    }

    private extractMeasurementData(eventDetail: any): LengthMeasurementData | null {
        try {
            const annotation = eventDetail.annotation;
            if (!annotation || !annotation.data) {
                return null;
            }

            const handles = annotation.data.handles;
            if (!handles || !handles.points || handles.points.length < 2) {
                return null;
            }

            const startPoint = handles.points[0];
            const endPoint = handles.points[1];
            
            // Calculate length
            const length = this.calculateLength(startPoint, endPoint);
            
            // Format length based on configuration
            const formattedLength = this.formatLength(length);

            const measurementData: LengthMeasurementData = {
                id: annotation.annotationUID || `length-${Date.now()}-${Math.random()}`,
                toolName: LengthTool.toolName,
                length: formattedLength,
                unit: this.config.unit || 'mm',
                startPoint: startPoint,
                endPoint: endPoint,
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
            console.error('❌ Error extracting measurement data:', error);
            return null;
        }
    }

    private calculateLength(startPoint: Types.Point2, endPoint: Types.Point2): number {
        const dx = endPoint[0] - startPoint[0];
        const dy = endPoint[1] - startPoint[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    private formatLength(length: number): number {
        const precision = this.config.precision || 2;
        return Math.round(length * Math.pow(10, precision)) / Math.pow(10, precision);
    }

    private triggerMeasurementEvent(eventType: string, data: any): void {
        const customEvent = new CustomEvent(eventType, {
            detail: {
                toolName: LengthTool.toolName,
                measurementData: data,
                timestamp: new Date().toISOString()
            }
        });

        eventTarget.dispatchEvent(customEvent);
    }

    public enableLengthTool(viewportId?: string): boolean {
        try {
            const toolGroup = ToolGroupManager.getToolGroup(this.toolGroupId);
            if (!toolGroup) {
                console.error('Tool group not found:', this.toolGroupId);
                return false;
            }

            // Set tool configuration
            this.configureTool();

            // Activate the length tool
            toolGroup.setToolActive(LengthTool.toolName, {
                bindings: [
                    {
                        mouseButton: ToolEnums.MouseBindings.Primary,
                    },
                ],
            });

            console.log(`✓ Length tool enabled for tool group: ${this.toolGroupId}`);
            return true;

        } catch (error) {
            console.error('❌ Error enabling length tool:', error);
            return false;
        }
    }

    public disableLengthTool(): boolean {
        try {
            const toolGroup = ToolGroupManager.getToolGroup(this.toolGroupId);
            if (!toolGroup) {
                console.error('Tool group not found:', this.toolGroupId);
                return false;
            }

            // Set tool to passive
            toolGroup.setToolPassive(LengthTool.toolName);

            console.log(`✓ Length tool disabled for tool group: ${this.toolGroupId}`);
            return true;

        } catch (error) {
            console.error('❌ Error disabling length tool:', error);
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
                renderDashed: false
            };

            // Apply configuration to the tool
            // Note: Tool configuration is handled by tool group settings
            console.log('✓ Length tool configured with options:', toolConfiguration);

        } catch (error) {
            console.error('❌ Error configuring length tool:', error);
        }
    }

    public getMeasurements(): LengthMeasurementData[] {
        return Array.from(this.measurements.values());
    }

    public getMeasurement(id: string): LengthMeasurementData | undefined {
        return this.measurements.get(id);
    }

    public removeMeasurement(id: string): boolean {
        if (this.measurements.has(id)) {
            this.measurements.delete(id);
            console.log(`✓ Length measurement removed: ${id}`);
            return true;
        }
        return false;
    }

    public clearAllMeasurements(): void {
        this.measurements.clear();
        console.log('✓ All length measurements cleared');
    }

    public getMeasurementCount(): number {
        return this.measurements.size;
    }

    public updateConfig(newConfig: Partial<LengthToolConfig>): void {
        this.config = { ...this.config, ...newConfig };
        this.configureTool();
        console.log('✓ Length tool configuration updated');
    }

    public exportMeasurements(): string {
        const measurements = this.getMeasurements();
        return JSON.stringify(measurements, null, 2);
    }

    public importMeasurements(data: string): boolean {
        try {
            const measurements = JSON.parse(data) as LengthMeasurementData[];
            
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

            console.log(`✓ Imported ${measurements.length} length measurements`);
            return true;

        } catch (error) {
            console.error('❌ Error importing measurements:', error);
            return false;
        }
    }

    private validateMeasurementData(data: any): boolean {
        return (
            data &&
            typeof data.id === 'string' &&
            typeof data.length === 'number' &&
            Array.isArray(data.startPoint) &&
            Array.isArray(data.endPoint) &&
            data.startPoint.length === 2 &&
            data.endPoint.length === 2
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

            console.log('✓ Length measurement tool disposed');

        } catch (error) {
            console.error('❌ Error disposing length measurement tool:', error);
        }
    }
}

// Convenience functions
export function createLengthTool(toolGroupId: string, config?: LengthToolConfig): LengthMeasurementTool {
    return new LengthMeasurementTool(toolGroupId, config);
}

export function calculateDistance(point1: Types.Point2, point2: Types.Point2): number {
    const dx = point2[0] - point1[0];
    const dy = point2[1] - point1[1];
    return Math.sqrt(dx * dx + dy * dy);
}

export function formatLengthValue(length: number, unit: string = 'mm', precision: number = 2): string {
    const formatted = Math.round(length * Math.pow(10, precision)) / Math.pow(10, precision);
    return `${formatted} ${unit}`;
}

// Default configuration
export const DEFAULT_LENGTH_CONFIG: LengthToolConfig = {
    unit: 'mm',
    precision: 2,
    showUnit: true,
    color: '#FFFF00',
    lineWidth: 2,
    showLength: true,
    allowOpenContours: true
};