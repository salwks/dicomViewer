import { imageLoader } from '@cornerstonejs/core';
import * as dicomParser from 'dicom-parser';

export interface MockImageData {
    imageId: string;
    pixelData: Uint16Array;
    width: number;
    height: number;
    windowCenter: number;
    windowWidth: number;
    slope: number;
    intercept: number;
    photometricInterpretation: string;
    samplesPerPixel: number;
    bitsAllocated: number;
    bitsStored: number;
    highBit: number;
    pixelRepresentation: number;
}

export class MockDataManager {
    private static instance: MockDataManager;
    private mockDataMap: Map<string, MockImageData> = new Map();
    
    public static getInstance(): MockDataManager {
        if (!MockDataManager.instance) {
            MockDataManager.instance = new MockDataManager();
        }
        return MockDataManager.instance;
    }
    
    /**
     * Generate mock DICOM image data
     */
    private generateMockImageData(imageId: string, seriesIndex: number, imageIndex: number): MockImageData {
        const width = 512;
        const height = 512;
        const pixelCount = width * height;
        const pixelData = new Uint16Array(pixelCount);
        
        // Generate different patterns for different series
        for (let i = 0; i < pixelCount; i++) {
            const x = i % width;
            const y = Math.floor(i / width);
            
            let value = 0;
            
            if (seriesIndex === 0) {
                // Series 1: Circular pattern with gradient
                const centerX = width / 2;
                const centerY = height / 2;
                const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                const maxDistance = Math.sqrt(centerX ** 2 + centerY ** 2);
                value = Math.floor((1 - distance / maxDistance) * 4095 * (0.5 + 0.5 * Math.sin(imageIndex * 0.1)));
                
                // Add some anatomical-like structures
                if (distance < 100) {
                    value += Math.floor(Math.sin(x * 0.02) * Math.cos(y * 0.02) * 1000);
                }
            } else {
                // Series 2: Grid pattern with different characteristics
                const gridSize = 32;
                const gridX = Math.floor(x / gridSize);
                const gridY = Math.floor(y / gridSize);
                value = ((gridX + gridY + imageIndex) % 2) * 2048;
                
                // Add noise for more realistic appearance
                value += Math.floor(Math.random() * 500) - 250;
                
                // Add some circular features
                const centerX = width / 2;
                const centerY = height / 2;
                const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                if (distance > 150 && distance < 200) {
                    value += 1500;
                }
            }
            
            // Clamp values to valid range
            pixelData[i] = Math.max(0, Math.min(4095, value));
        }
        
        return {
            imageId,
            pixelData,
            width,
            height,
            windowCenter: seriesIndex === 0 ? 2000 : 1500,
            windowWidth: seriesIndex === 0 ? 4000 : 3000,
            slope: 1,
            intercept: 0,
            photometricInterpretation: 'MONOCHROME2',
            samplesPerPixel: 1,
            bitsAllocated: 16,
            bitsStored: 12,
            highBit: 11,
            pixelRepresentation: 0
        };
    }
    
    /**
     * Generate and store mock data for a series
     */
    public generateMockSeries(seriesName: string, imageCount: number): string[] {
        const imageIds: string[] = [];
        const seriesIndex = seriesName.includes('series1') ? 0 : 1;
        
        for (let i = 0; i < imageCount; i++) {
            const imageId = `mock://${seriesName}/image_${i.toString().padStart(3, '0')}.dcm`;
            const mockData = this.generateMockImageData(imageId, seriesIndex, i);
            this.mockDataMap.set(imageId, mockData);
            imageIds.push(imageId);
        }
        
        console.log(`Generated ${imageCount} mock images for ${seriesName}`);
        return imageIds;
    }
    
    /**
     * Get mock data for a specific image ID
     */
    public getMockData(imageId: string): MockImageData | undefined {
        return this.mockDataMap.get(imageId);
    }
    
    /**
     * Clear all mock data
     */
    public clear(): void {
        this.mockDataMap.clear();
    }
    
    /**
     * Get statistics about stored mock data
     */
    public getStats(): { totalImages: number, seriesCount: number } {
        const series = new Set();
        this.mockDataMap.forEach((_, imageId) => {
            const parts = imageId.split('/');
            if (parts.length >= 2) {
                series.add(parts[1]);
            }
        });
        
        return {
            totalImages: this.mockDataMap.size,
            seriesCount: series.size
        };
    }
}

/**
 * Custom image loader for mock:// protocol
 */
function mockImageLoader(imageId: string): { promise: Promise<any>, cancelFn?: () => void } {
    const promise = new Promise((resolve, reject) => {
        try {
            const mockDataManager = MockDataManager.getInstance();
            const mockData = mockDataManager.getMockData(imageId);
            
            if (!mockData) {
                reject(new Error(`Mock data not found for imageId: ${imageId}`));
                return;
            }
            
            // Create image object compatible with Cornerstone3D
            const image = {
                imageId: imageId,
                minPixelValue: Math.min(...mockData.pixelData),
                maxPixelValue: Math.max(...mockData.pixelData),
                slope: mockData.slope,
                intercept: mockData.intercept,
                windowCenter: mockData.windowCenter,
                windowWidth: mockData.windowWidth,
                getPixelData: () => mockData.pixelData,
                getCanvas: () => {
                    // Create a canvas for the image
                    const canvas = document.createElement('canvas');
                    canvas.width = mockData.width;
                    canvas.height = mockData.height;
                    const context = canvas.getContext('2d');
                    
                    if (context) {
                        const imageData = context.createImageData(mockData.width, mockData.height);
                        const data = imageData.data;
                        
                        // Convert pixel data to RGBA
                        for (let i = 0; i < mockData.pixelData.length; i++) {
                            const pixelValue = mockData.pixelData[i];
                            // Normalize to 0-255 range
                            const normalizedValue = Math.floor((pixelValue / 4095) * 255);
                            
                            const index = i * 4;
                            data[index] = normalizedValue;     // R
                            data[index + 1] = normalizedValue; // G
                            data[index + 2] = normalizedValue; // B
                            data[index + 3] = 255;             // A
                        }
                        
                        context.putImageData(imageData, 0, 0);
                    }
                    
                    return canvas;
                },
                rows: mockData.height,
                columns: mockData.width,
                height: mockData.height,
                width: mockData.width,
                color: false,
                columnPixelSpacing: 1.0,
                rowPixelSpacing: 1.0,
                invert: false,
                sizeInBytes: mockData.pixelData.length * 2,
                // DICOM metadata
                data: {
                    string: (tag: string) => {
                        switch (tag) {
                            case 'x00280004': return mockData.photometricInterpretation;
                            default: return '';
                        }
                    },
                    uint16: (tag: string) => {
                        switch (tag) {
                            case 'x00280010': return mockData.height; // Rows
                            case 'x00280011': return mockData.width;  // Columns
                            case 'x00280100': return mockData.bitsAllocated;
                            case 'x00280101': return mockData.bitsStored;
                            case 'x00280102': return mockData.highBit;
                            case 'x00280103': return mockData.pixelRepresentation;
                            case 'x00281050': return mockData.windowCenter;
                            case 'x00281051': return mockData.windowWidth;
                            case 'x00281052': return mockData.intercept;
                            case 'x00281053': return mockData.slope;
                            default: return 0;
                        }
                    },
                    floatString: (tag: string) => {
                        switch (tag) {
                            case 'x00281052': return mockData.intercept.toString();
                            case 'x00281053': return mockData.slope.toString();
                            default: return '0';
                        }
                    }
                }
            };
            
            // Simulate async loading delay
            setTimeout(() => {
                resolve(image);
            }, 10);
            
        } catch (error) {
            console.error('Error in mock image loader:', error);
            reject(error);
        }
    });
    
    return { promise };
}

/**
 * Register the mock image loader with Cornerstone3D
 */
export function registerMockImageLoader(): void {
    try {
        imageLoader.registerImageLoader('mock', mockImageLoader);
        console.log('Mock image loader registered successfully');
    } catch (error) {
        console.error('Error registering mock image loader:', error);
        throw error;
    }
}

/**
 * Helper function to create mock image IDs (updated)
 */
export function createMockImageIds(seriesName: string, imageCount: number = 10): string[] {
    const mockDataManager = MockDataManager.getInstance();
    return mockDataManager.generateMockSeries(seriesName, imageCount);
}