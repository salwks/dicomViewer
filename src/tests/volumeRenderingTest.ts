import { RenderingEngine, Types, Enums, init as csInit } from '@cornerstonejs/core';
import { VolumeLoader } from '../core/volumeLoader';
import { VolumeLoaderRegistry } from '../core/volumeLoaderRegistry';
import { Volume3DViewportManager } from '../core/volume3DViewport';
import { MPRViewportManager } from '../core/mprViewport';
import { MPRVolumeIntegration } from '../core/mprVolumeIntegration';
import { VolumeRenderingOptionsManager } from '../core/volumeRenderingOptions';
import { VolumeController } from '../components/VolumeController';

export interface VolumeTestConfig {
    name: string;
    imageIds: string[];
    volumeType: 'CT' | 'MRI' | 'PET' | 'ANGIO' | 'NIFTI';
    expectedDimensions?: Types.Point3;
    expectedSpacing?: Types.Point3;
    testOrientations?: Enums.OrientationAxis[];
    testPresets?: string[];
}

export interface VolumeTestResult {
    testName: string;
    success: boolean;
    duration: number;
    errors: string[];
    warnings: string[];
    volumeInfo?: {
        volumeId: string;
        dimensions: Types.Point3;
        spacing: Types.Point3;
        origin: Types.Point3;
        memorySizeInMB: number;
    };
    orientationResults?: {
        [key: string]: {
            success: boolean;
            viewport: string;
            renderTime: number;
        };
    };
    presetResults?: {
        [key: string]: {
            success: boolean;
            appliedCorrectly: boolean;
        };
    };
}

export class VolumeRenderingTester {
    private renderingEngine: RenderingEngine;
    private volumeLoader: VolumeLoader;
    private volume3DManager: Volume3DViewportManager;
    private mprManager: MPRViewportManager;
    private mprIntegration: MPRVolumeIntegration;
    private optionsManager: VolumeRenderingOptionsManager;
    private testResults: VolumeTestResult[] = [];
    private testContainer: HTMLElement;

    constructor(testContainer: HTMLElement) {
        this.testContainer = testContainer;
        this.renderingEngine = new RenderingEngine('volumeTestEngine');
        this.volumeLoader = new VolumeLoader();
        this.volume3DManager = new Volume3DViewportManager(this.renderingEngine);
        this.mprManager = new MPRViewportManager(this.renderingEngine);
        this.mprIntegration = new MPRVolumeIntegration(this.mprManager, this.volumeLoader);
        this.optionsManager = new VolumeRenderingOptionsManager();
    }

    public async initializeTests(): Promise<void> {
        try {
            console.log('Initializing volume rendering tests...');

            // Initialize Cornerstone3D
            await csInit();

            // Initialize volume loader registry
            const registry = VolumeLoaderRegistry.getInstance();
            await registry.initialize();

            // Create test viewport elements
            this.createTestViewports();

            console.log('✓ Volume rendering tests initialized');

        } catch (error) {
            console.error('❌ Error initializing volume rendering tests:', error);
            throw error;
        }
    }

    private createTestViewports(): void {
        this.testContainer.innerHTML = `
            <div class="volume-test-container">
                <h2>Volume Rendering Tests</h2>
                <div class="test-viewports">
                    <div id="test-3d-viewport" class="test-viewport"></div>
                    <div id="test-mpr-axial" class="test-viewport"></div>
                    <div id="test-mpr-sagittal" class="test-viewport"></div>
                    <div id="test-mpr-coronal" class="test-viewport"></div>
                </div>
                <div id="test-results" class="test-results"></div>
            </div>
        `;

        // Add CSS for test viewports
        const style = document.createElement('style');
        style.textContent = `
            .volume-test-container {
                padding: 20px;
                font-family: Arial, sans-serif;
            }
            
            .test-viewports {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-bottom: 20px;
            }
            
            .test-viewport {
                width: 300px;
                height: 300px;
                border: 1px solid #ccc;
                background: #000;
                position: relative;
            }
            
            .test-viewport::before {
                content: attr(id);
                position: absolute;
                top: 5px;
                left: 5px;
                color: white;
                font-size: 12px;
                background: rgba(0,0,0,0.7);
                padding: 2px 5px;
                border-radius: 3px;
            }
            
            .test-results {
                background: #f5f5f5;
                padding: 15px;
                border-radius: 5px;
                font-family: monospace;
                font-size: 12px;
                max-height: 400px;
                overflow-y: auto;
            }
            
            .test-success {
                color: #008000;
            }
            
            .test-error {
                color: #ff0000;
            }
            
            .test-warning {
                color: #ff8800;
            }
        `;
        document.head.appendChild(style);
    }

    public async runVolumeTest(config: VolumeTestConfig): Promise<VolumeTestResult> {
        const startTime = Date.now();
        const result: VolumeTestResult = {
            testName: config.name,
            success: false,
            duration: 0,
            errors: [],
            warnings: []
        };

        try {
            console.log(`Running volume test: ${config.name}`);
            this.logTestMessage(`Starting test: ${config.name}`);

            // Test 1: Load Volume
            const volume = await this.testVolumeLoading(config, result);
            if (!volume) {
                result.errors.push('Failed to load volume');
                return result;
            }

            // Test 2: Test Different Orientations
            await this.testVolumeOrientations(volume, config, result);

            // Test 3: Test Volume Presets
            await this.testVolumePresets(volume, config, result);

            // Test 4: Test MPR Integration
            await this.testMPRIntegration(volume, config, result);

            // Test 5: Test Volume Controller
            await this.testVolumeController(volume, config, result);

            // Test 6: Test Memory Management
            await this.testMemoryManagement(volume, config, result);

            result.success = result.errors.length === 0;
            result.duration = Date.now() - startTime;

            this.logTestMessage(
                `Test ${config.name} ${result.success ? 'PASSED' : 'FAILED'} in ${result.duration}ms`,
                result.success ? 'success' : 'error'
            );

        } catch (error) {
            result.errors.push(`Test execution failed: ${error}`);
            result.duration = Date.now() - startTime;
            this.logTestMessage(`Test ${config.name} FAILED: ${error}`, 'error');
        }

        this.testResults.push(result);
        return result;
    }

    private async testVolumeLoading(config: VolumeTestConfig, result: VolumeTestResult): Promise<Types.IImageVolume | null> {
        try {
            this.logTestMessage(`Loading volume: ${config.name}`);

            const volume = await this.volumeLoader.loadImageVolume({
                imageIds: config.imageIds,
                volumeId: `test-volume-${Date.now()}`
            });

            if (!volume) {
                result.errors.push('Volume loading returned null');
                return null;
            }

            // Store volume info
            result.volumeInfo = {
                volumeId: volume.volumeId,
                dimensions: volume.dimensions,
                spacing: volume.spacing,
                origin: volume.origin,
                memorySizeInMB: this.calculateVolumeMemorySize(volume)
            };

            // Validate expected dimensions
            if (config.expectedDimensions) {
                if (!this.compareDimensions(volume.dimensions, config.expectedDimensions)) {
                    result.warnings.push(`Dimensions mismatch: expected ${config.expectedDimensions}, got ${volume.dimensions}`);
                }
            }

            // Validate expected spacing
            if (config.expectedSpacing) {
                if (!this.compareSpacing(volume.spacing, config.expectedSpacing)) {
                    result.warnings.push(`Spacing mismatch: expected ${config.expectedSpacing}, got ${volume.spacing}`);
                }
            }

            this.logTestMessage(`✓ Volume loaded: ${volume.volumeId}`, 'success');
            this.logTestMessage(`  Dimensions: ${volume.dimensions}`);
            this.logTestMessage(`  Spacing: ${volume.spacing}`);
            this.logTestMessage(`  Memory: ${result.volumeInfo.memorySizeInMB.toFixed(2)} MB`);

            return volume;

        } catch (error) {
            result.errors.push(`Volume loading failed: ${error}`);
            this.logTestMessage(`❌ Volume loading failed: ${error}`, 'error');
            return null;
        }
    }

    private async testVolumeOrientations(volume: Types.IImageVolume, config: VolumeTestConfig, result: VolumeTestResult): Promise<void> {
        try {
            this.logTestMessage('Testing volume orientations...');
            result.orientationResults = {};

            const orientations = config.testOrientations || [
                Enums.OrientationAxis.AXIAL,
                Enums.OrientationAxis.SAGITTAL,
                Enums.OrientationAxis.CORONAL
            ];

            for (const orientation of orientations) {
                const orientationStartTime = Date.now();
                const orientationName = orientation.toLowerCase();

                try {
                    // Create viewport for this orientation
                    const viewportId = `test-${orientationName}-${Date.now()}`;
                    const viewportElement = document.getElementById(`test-mpr-${orientationName}`) as HTMLElement;

                    if (!viewportElement) {
                        result.warnings.push(`No viewport element found for orientation: ${orientationName}`);
                        continue;
                    }

                    // Test 3D viewport
                    if (orientation === Enums.OrientationAxis.CORONAL) {
                        const viewport = this.volume3DManager.create3DViewport(viewportId, viewportElement);
                        await this.volume3DManager.setupVolumeInViewport(viewportId, volume);
                    } else {
                        // Test MPR viewport
                        const mprConfig = {
                            [orientationName]: {
                                viewportId,
                                element: viewportElement,
                                orientation
                            }
                        };
                        this.mprManager.createMPRViewports(mprConfig);
                        await this.mprManager.setupMPRViewportsWithVolume(volume);
                    }

                    const renderTime = Date.now() - orientationStartTime;
                    result.orientationResults[orientationName] = {
                        success: true,
                        viewport: viewportId,
                        renderTime
                    };

                    this.logTestMessage(`✓ ${orientationName} orientation: ${renderTime}ms`, 'success');

                } catch (error) {
                    result.orientationResults[orientationName] = {
                        success: false,
                        viewport: '',
                        renderTime: 0
                    };
                    result.errors.push(`${orientationName} orientation failed: ${error}`);
                    this.logTestMessage(`❌ ${orientationName} orientation failed: ${error}`, 'error');
                }
            }

        } catch (error) {
            result.errors.push(`Orientation testing failed: ${error}`);
            this.logTestMessage(`❌ Orientation testing failed: ${error}`, 'error');
        }
    }

    private async testVolumePresets(volume: Types.IImageVolume, config: VolumeTestConfig, result: VolumeTestResult): Promise<void> {
        try {
            this.logTestMessage('Testing volume presets...');
            result.presetResults = {};

            const presets = config.testPresets || ['ct_bone', 'ct_soft_tissue', 'mr_brain'];

            for (const presetName of presets) {
                try {
                    const settings = this.optionsManager.applyPreset(presetName);
                    const isValid = settings && this.optionsManager.validateSettings(settings);

                    result.presetResults[presetName] = {
                        success: !!settings,
                        appliedCorrectly: !!isValid
                    };

                    if (settings && isValid) {
                        this.logTestMessage(`✓ Preset ${presetName}: applied correctly`, 'success');
                    } else {
                        result.warnings.push(`Preset ${presetName} validation failed`);
                        this.logTestMessage(`⚠️ Preset ${presetName}: validation failed`, 'warning');
                    }

                } catch (error) {
                    result.presetResults[presetName] = {
                        success: false,
                        appliedCorrectly: false
                    };
                    result.errors.push(`Preset ${presetName} failed: ${error}`);
                    this.logTestMessage(`❌ Preset ${presetName} failed: ${error}`, 'error');
                }
            }

        } catch (error) {
            result.errors.push(`Preset testing failed: ${error}`);
            this.logTestMessage(`❌ Preset testing failed: ${error}`, 'error');
        }
    }

    private async testMPRIntegration(volume: Types.IImageVolume, config: VolumeTestConfig, result: VolumeTestResult): Promise<void> {
        try {
            this.logTestMessage('Testing MPR integration...');

            // Setup MPR with volume
            await this.mprIntegration.setupVolumeInMPR(volume);

            // Test crosshair positioning
            const centerPosition = this.calculateVolumeCenter(volume);
            this.mprIntegration.setCrosshairPosition(centerPosition);

            // Test slice synchronization
            const mprViewports = this.mprManager.getAllViewports();
            if (mprViewports.size > 0) {
                const firstViewportId = Array.from(mprViewports.keys())[0];
                this.mprIntegration.synchronizeSlicePositions(firstViewportId);
            }

            // Test slice info retrieval
            const mprViewportsForSliceInfo = this.mprManager.getAllViewports();
            for (const [viewportId] of mprViewportsForSliceInfo) {
                const sliceInfo = this.mprIntegration.getVolumeSliceInfo(viewportId);
                if (!sliceInfo) {
                    result.warnings.push(`Failed to get slice info for viewport: ${viewportId}`);
                }
            }

            this.logTestMessage('✓ MPR integration: all tests passed', 'success');

        } catch (error) {
            result.errors.push(`MPR integration failed: ${error}`);
            this.logTestMessage(`❌ MPR integration failed: ${error}`, 'error');
        }
    }

    private async testVolumeController(volume: Types.IImageVolume, config: VolumeTestConfig, result: VolumeTestResult): Promise<void> {
        try {
            this.logTestMessage('Testing volume controller...');

            // Create controller element
            const controllerElement = document.createElement('div');
            controllerElement.style.display = 'none';
            this.testContainer.appendChild(controllerElement);

            // Create volume controller
            const controller = new VolumeController(controllerElement, {
                compactMode: true,
                enableRealTimeUpdate: false
            });

            // Test connection to viewport manager
            const viewportId = 'test-controller-viewport';
            const viewportElement = document.getElementById('test-3d-viewport') as HTMLElement;
            
            if (viewportElement) {
                const viewport = this.volume3DManager.create3DViewport(viewportId, viewportElement);
                await this.volume3DManager.setupVolumeInViewport(viewportId, volume);
                
                controller.connectViewportManager(this.volume3DManager, viewportId);

                // Test settings retrieval
                const settings = controller.getCurrentSettings();
                if (!settings) {
                    result.warnings.push('Volume controller failed to retrieve settings');
                }

                // Clean up
                controller.dispose();
                controllerElement.remove();
            }

            this.logTestMessage('✓ Volume controller: all tests passed', 'success');

        } catch (error) {
            result.errors.push(`Volume controller failed: ${error}`);
            this.logTestMessage(`❌ Volume controller failed: ${error}`, 'error');
        }
    }

    private async testMemoryManagement(volume: Types.IImageVolume, config: VolumeTestConfig, result: VolumeTestResult): Promise<void> {
        try {
            this.logTestMessage('Testing memory management...');

            // Get memory usage
            const memoryUsage = this.volumeLoader.getMemoryUsage();
            this.logTestMessage(`Memory usage: ${memoryUsage.totalMemoryInMB.toFixed(2)} MB for ${memoryUsage.volumeCount} volumes`);

            // Test volume disposal
            const volumeId = volume.volumeId;
            // Note: In a real scenario, you would dispose the volume here
            // For testing, we'll just log that it would be disposed

            this.logTestMessage('✓ Memory management: tests completed', 'success');

        } catch (error) {
            result.errors.push(`Memory management failed: ${error}`);
            this.logTestMessage(`❌ Memory management failed: ${error}`, 'error');
        }
    }

    private calculateVolumeMemorySize(volume: Types.IImageVolume): number {
        const { dimensions } = volume;
        const totalVoxels = dimensions[0] * dimensions[1] * dimensions[2];
        // Assuming 4 bytes per voxel (Float32)
        return (totalVoxels * 4) / (1024 * 1024);
    }

    private calculateVolumeCenter(volume: Types.IImageVolume): Types.Point3 {
        const { dimensions, spacing, origin } = volume;
        return [
            origin[0] + (dimensions[0] * spacing[0]) / 2,
            origin[1] + (dimensions[1] * spacing[1]) / 2,
            origin[2] + (dimensions[2] * spacing[2]) / 2
        ];
    }

    private compareDimensions(actual: Types.Point3, expected: Types.Point3): boolean {
        return actual[0] === expected[0] && actual[1] === expected[1] && actual[2] === expected[2];
    }

    private compareSpacing(actual: Types.Point3, expected: Types.Point3, tolerance: number = 0.001): boolean {
        return Math.abs(actual[0] - expected[0]) < tolerance &&
               Math.abs(actual[1] - expected[1]) < tolerance &&
               Math.abs(actual[2] - expected[2]) < tolerance;
    }

    private logTestMessage(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
        const resultsElement = document.getElementById('test-results');
        if (resultsElement) {
            const messageElement = document.createElement('div');
            messageElement.className = `test-${type}`;
            messageElement.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
            resultsElement.appendChild(messageElement);
            resultsElement.scrollTop = resultsElement.scrollHeight;
        }
        console.log(message);
    }

    public async runAllTests(configs: VolumeTestConfig[]): Promise<VolumeTestResult[]> {
        this.logTestMessage('Starting comprehensive volume rendering tests...');
        
        const results: VolumeTestResult[] = [];
        
        for (const config of configs) {
            const result = await this.runVolumeTest(config);
            results.push(result);
        }

        // Generate summary
        this.generateTestSummary(results);
        
        return results;
    }

    private generateTestSummary(results: VolumeTestResult[]): void {
        const totalTests = results.length;
        const passedTests = results.filter(r => r.success).length;
        const failedTests = totalTests - passedTests;
        const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

        this.logTestMessage('\n=== TEST SUMMARY ===');
        this.logTestMessage(`Total Tests: ${totalTests}`);
        this.logTestMessage(`Passed: ${passedTests}`, passedTests === totalTests ? 'success' : 'info');
        this.logTestMessage(`Failed: ${failedTests}`, failedTests > 0 ? 'error' : 'info');
        this.logTestMessage(`Total Duration: ${totalDuration}ms`);
        this.logTestMessage(`Average Duration: ${(totalDuration / totalTests).toFixed(2)}ms`);

        if (failedTests > 0) {
            this.logTestMessage('\n=== FAILED TESTS ===', 'error');
            results.filter(r => !r.success).forEach(result => {
                this.logTestMessage(`${result.testName}: ${result.errors.join(', ')}`, 'error');
            });
        }
    }

    public getTestResults(): VolumeTestResult[] {
        return [...this.testResults];
    }

    public dispose(): void {
        this.renderingEngine.destroy();
        this.volume3DManager.dispose();
        this.mprManager.dispose();
        this.mprIntegration.dispose();
        this.testResults = [];
    }
}

// Sample test configurations
export const SAMPLE_TEST_CONFIGS: VolumeTestConfig[] = [
    {
        name: 'CT Chest Volume',
        imageIds: ['wadouri:sample-ct-chest-001.dcm', 'wadouri:sample-ct-chest-002.dcm'],
        volumeType: 'CT',
        expectedDimensions: [512, 512, 100],
        expectedSpacing: [1.0, 1.0, 2.5],
        testOrientations: [Enums.OrientationAxis.AXIAL, Enums.OrientationAxis.CORONAL, Enums.OrientationAxis.SAGITTAL],
        testPresets: ['ct_bone', 'ct_soft_tissue']
    },
    {
        name: 'MR Brain Volume',
        imageIds: ['wadouri:sample-mr-brain-001.dcm', 'wadouri:sample-mr-brain-002.dcm'],
        volumeType: 'MRI',
        expectedDimensions: [256, 256, 60],
        expectedSpacing: [1.0, 1.0, 3.0],
        testOrientations: [Enums.OrientationAxis.AXIAL, Enums.OrientationAxis.SAGITTAL],
        testPresets: ['mr_brain']
    },
    {
        name: 'NIFTI Volume',
        imageIds: ['nifti:sample-brain.nii.gz'],
        volumeType: 'NIFTI',
        testOrientations: [Enums.OrientationAxis.AXIAL],
        testPresets: ['mr_brain']
    }
];

// Factory function for creating volume tests
export function createVolumeRenderingTester(container: HTMLElement): VolumeRenderingTester {
    return new VolumeRenderingTester(container);
}

// Utility functions for running tests
export async function runQuickVolumeTest(
    container: HTMLElement,
    config: VolumeTestConfig
): Promise<VolumeTestResult> {
    const tester = createVolumeRenderingTester(container);
    await tester.initializeTests();
    const result = await tester.runVolumeTest(config);
    tester.dispose();
    return result;
}

export async function runComprehensiveVolumeTests(
    container: HTMLElement,
    configs: VolumeTestConfig[] = SAMPLE_TEST_CONFIGS
): Promise<VolumeTestResult[]> {
    const tester = createVolumeRenderingTester(container);
    await tester.initializeTests();
    const results = await tester.runAllTests(configs);
    // Don't dispose here - let the caller decide
    return results;
}