import { 
    VolumeRenderingTester, 
    VolumeTestConfig, 
    runComprehensiveVolumeTests,
    SAMPLE_TEST_CONFIGS 
} from '../tests/volumeRenderingTest';
import { VolumeController } from '../components/VolumeController';
import { Volume3DViewportManager } from '../core/volume3DViewport';
import { MPRViewportManager } from '../core/mprViewport';
import { VolumeLoader } from '../core/volumeLoader';
import { RenderingEngine } from '@cornerstonejs/core';

export class VolumeRenderingExample {
    private container: HTMLElement;
    private renderingEngine: RenderingEngine;
    private volumeLoader: VolumeLoader;
    private volume3DManager: Volume3DViewportManager;
    private mprManager: MPRViewportManager;
    private volumeController: VolumeController | null = null;
    private tester: VolumeRenderingTester | null = null;

    constructor(container: HTMLElement) {
        this.container = container;
        this.renderingEngine = new RenderingEngine('volumeExampleEngine');
        this.volumeLoader = new VolumeLoader();
        this.volume3DManager = new Volume3DViewportManager(this.renderingEngine);
        this.mprManager = new MPRViewportManager(this.renderingEngine);
        
        this.initializeUI();
    }

    private initializeUI(): void {
        this.container.innerHTML = `
            <div class="volume-example-container">
                <h1>Volume Rendering Example</h1>
                
                <div class="example-controls">
                    <button id="run-tests-btn" class="example-button">Run Volume Tests</button>
                    <button id="load-sample-btn" class="example-button">Load Sample Volume</button>
                    <button id="show-controller-btn" class="example-button">Show Controller</button>
                    <button id="reset-btn" class="example-button secondary">Reset</button>
                </div>

                <div class="example-layout">
                    <div class="viewports-section">
                        <h2>Volume Viewports</h2>
                        <div class="viewports-grid">
                            <div class="viewport-container">
                                <h3>3D Volume</h3>
                                <div id="volume-3d-viewport" class="viewport-3d"></div>
                            </div>
                            <div class="viewport-container">
                                <h3>MPR Axial</h3>
                                <div id="mpr-axial-viewport" class="viewport-mpr"></div>
                            </div>
                            <div class="viewport-container">
                                <h3>MPR Sagittal</h3>
                                <div id="mpr-sagittal-viewport" class="viewport-mpr"></div>
                            </div>
                            <div class="viewport-container">
                                <h3>MPR Coronal</h3>
                                <div id="mpr-coronal-viewport" class="viewport-mpr"></div>
                            </div>
                        </div>
                    </div>

                    <div class="controls-section">
                        <h2>Volume Controls</h2>
                        <div id="volume-controller-container" class="controller-container"></div>
                    </div>
                </div>

                <div class="test-section">
                    <h2>Test Results</h2>
                    <div id="test-container" class="test-container"></div>
                </div>
            </div>
        `;

        this.addExampleStyles();
        this.attachEventListeners();
    }

    private addExampleStyles(): void {
        const style = document.createElement('style');
        style.textContent = `
            .volume-example-container {
                padding: 20px;
                font-family: Arial, sans-serif;
                max-width: 1400px;
                margin: 0 auto;
            }

            .example-controls {
                margin-bottom: 20px;
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }

            .example-button {
                padding: 10px 20px;
                background: #007bff;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.2s;
            }

            .example-button:hover {
                background: #0056b3;
            }

            .example-button.secondary {
                background: #6c757d;
            }

            .example-button.secondary:hover {
                background: #545b62;
            }

            .example-layout {
                display: grid;
                grid-template-columns: 2fr 1fr;
                gap: 20px;
                margin-bottom: 20px;
            }

            .viewports-section {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                border: 1px solid #dee2e6;
            }

            .viewports-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
            }

            .viewport-container {
                background: white;
                padding: 10px;
                border-radius: 5px;
                border: 1px solid #dee2e6;
            }

            .viewport-container h3 {
                margin: 0 0 10px 0;
                font-size: 14px;
                color: #495057;
                text-align: center;
            }

            .viewport-3d {
                width: 100%;
                height: 300px;
                background: #000;
                border: 1px solid #ccc;
                position: relative;
            }

            .viewport-mpr {
                width: 100%;
                height: 200px;
                background: #000;
                border: 1px solid #ccc;
                position: relative;
            }

            .controls-section {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                border: 1px solid #dee2e6;
                height: fit-content;
            }

            .controller-container {
                background: white;
                border-radius: 5px;
                overflow: hidden;
                min-height: 200px;
            }

            .test-section {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                border: 1px solid #dee2e6;
            }

            .test-container {
                background: white;
                border-radius: 5px;
                min-height: 200px;
                overflow: hidden;
            }

            .status-message {
                padding: 10px;
                margin: 10px 0;
                border-radius: 5px;
                font-size: 14px;
            }

            .status-success {
                background: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
            }

            .status-error {
                background: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
            }

            .status-info {
                background: #d1ecf1;
                color: #0c5460;
                border: 1px solid #bee5eb;
            }

            @media (max-width: 1200px) {
                .example-layout {
                    grid-template-columns: 1fr;
                }
                
                .viewports-grid {
                    grid-template-columns: 1fr;
                }
            }
        `;
        document.head.appendChild(style);
    }

    private attachEventListeners(): void {
        const runTestsBtn = document.getElementById('run-tests-btn');
        const loadSampleBtn = document.getElementById('load-sample-btn');
        const showControllerBtn = document.getElementById('show-controller-btn');
        const resetBtn = document.getElementById('reset-btn');

        runTestsBtn?.addEventListener('click', () => this.runTests());
        loadSampleBtn?.addEventListener('click', () => this.loadSampleVolume());
        showControllerBtn?.addEventListener('click', () => this.showVolumeController());
        resetBtn?.addEventListener('click', () => this.reset());
    }

    private async runTests(): Promise<void> {
        try {
            this.showStatusMessage('Starting volume rendering tests...', 'info');
            
            const testContainer = document.getElementById('test-container');
            if (!testContainer) {
                throw new Error('Test container not found');
            }

            // Create and run tests
            this.tester = new VolumeRenderingTester(testContainer);
            await this.tester.initializeTests();

            // Run comprehensive tests
            const results = await this.tester.runAllTests(SAMPLE_TEST_CONFIGS);
            
            const passedTests = results.filter(r => r.success).length;
            const totalTests = results.length;
            
            if (passedTests === totalTests) {
                this.showStatusMessage(`All tests passed! (${passedTests}/${totalTests})`, 'success');
            } else {
                this.showStatusMessage(`Tests completed: ${passedTests}/${totalTests} passed`, 'error');
            }

        } catch (error) {
            this.showStatusMessage(`Test execution failed: ${error}`, 'error');
            console.error('Error running tests:', error);
        }
    }

    private async loadSampleVolume(): Promise<void> {
        try {
            this.showStatusMessage('Loading sample volume...', 'info');

            // Create sample image IDs (in a real app, these would be actual DICOM URLs)
            const sampleImageIds = this.generateSampleImageIds();
            
            // Load the volume
            const volume = await this.volumeLoader.loadImageVolume({
                imageIds: sampleImageIds,
                volumeId: 'sample-volume-' + Date.now()
            });

            // Setup 3D viewport
            const viewport3D = document.getElementById('volume-3d-viewport') as HTMLElement;
            if (viewport3D) {
                const viewport = this.volume3DManager.create3DViewport('sample-3d', viewport3D);
                await this.volume3DManager.setupVolumeInViewport('sample-3d', volume);
            }

            // Setup MPR viewports
            const axialElement = document.getElementById('mpr-axial-viewport') as HTMLElement;
            const sagittalElement = document.getElementById('mpr-sagittal-viewport') as HTMLElement;
            const coronalElement = document.getElementById('mpr-coronal-viewport') as HTMLElement;

            if (axialElement && sagittalElement && coronalElement) {
                const mprConfig = {
                    axial: {
                        viewportId: 'sample-mpr-axial',
                        element: axialElement,
                        orientation: 'axial' as any
                    },
                    sagittal: {
                        viewportId: 'sample-mpr-sagittal',
                        element: sagittalElement,
                        orientation: 'sagittal' as any
                    },
                    coronal: {
                        viewportId: 'sample-mpr-coronal',
                        element: coronalElement,
                        orientation: 'coronal' as any
                    }
                };

                this.mprManager.createMPRViewports(mprConfig);
                await this.mprManager.setupMPRViewportsWithVolume(volume);
            }

            this.showStatusMessage('Sample volume loaded successfully!', 'success');

        } catch (error) {
            this.showStatusMessage(`Failed to load sample volume: ${error}`, 'error');
            console.error('Error loading sample volume:', error);
        }
    }

    private showVolumeController(): void {
        try {
            const controllerContainer = document.getElementById('volume-controller-container');
            if (!controllerContainer) {
                throw new Error('Controller container not found');
            }

            // Create volume controller if it doesn't exist
            if (!this.volumeController) {
                this.volumeController = new VolumeController(controllerContainer, {
                    compactMode: true,
                    enableRealTimeUpdate: true
                }, {
                    onSettingsChange: (settings) => {
                        console.log('Volume settings changed:', settings);
                    },
                    onPresetChange: (presetName) => {
                        this.showStatusMessage(`Applied preset: ${presetName}`, 'info');
                    },
                    onOpacityChange: (opacity) => {
                        console.log('Opacity changed:', opacity);
                    }
                });

                // Connect to viewport manager
                this.volumeController.connectViewportManager(this.volume3DManager, 'sample-3d');
            }

            this.volumeController.show();
            this.showStatusMessage('Volume controller displayed', 'info');

        } catch (error) {
            this.showStatusMessage(`Failed to show volume controller: ${error}`, 'error');
            console.error('Error showing volume controller:', error);
        }
    }

    private generateSampleImageIds(): string[] {
        // Generate sample image IDs for testing
        // In a real application, these would be actual DICOM URLs
        const imageIds: string[] = [];
        for (let i = 1; i <= 50; i++) {
            imageIds.push(`wadouri:sample-volume-${i.toString().padStart(3, '0')}.dcm`);
        }
        return imageIds;
    }

    private showStatusMessage(message: string, type: 'success' | 'error' | 'info'): void {
        const existing = this.container.querySelector('.status-message');
        if (existing) {
            existing.remove();
        }

        const statusDiv = document.createElement('div');
        statusDiv.className = `status-message status-${type}`;
        statusDiv.textContent = message;
        
        const controls = this.container.querySelector('.example-controls');
        if (controls) {
            controls.insertAdjacentElement('afterend', statusDiv);
        }

        // Auto-remove after 5 seconds
        setTimeout(() => {
            statusDiv.remove();
        }, 5000);
    }

    private reset(): void {
        try {
            // Reset volume controller
            if (this.volumeController) {
                this.volumeController.dispose();
                this.volumeController = null;
            }

            // Reset viewport managers
            this.volume3DManager.dispose();
            this.mprManager.dispose();

            // Reset tester
            if (this.tester) {
                this.tester.dispose();
                this.tester = null;
            }

            // Clear test container
            const testContainer = document.getElementById('test-container');
            if (testContainer) {
                testContainer.innerHTML = '';
            }

            // Clear controller container
            const controllerContainer = document.getElementById('volume-controller-container');
            if (controllerContainer) {
                controllerContainer.innerHTML = '';
            }

            // Recreate managers
            this.volume3DManager = new Volume3DViewportManager(this.renderingEngine);
            this.mprManager = new MPRViewportManager(this.renderingEngine);

            this.showStatusMessage('Example reset successfully', 'success');

        } catch (error) {
            this.showStatusMessage(`Reset failed: ${error}`, 'error');
            console.error('Error resetting example:', error);
        }
    }

    public dispose(): void {
        this.reset();
        this.renderingEngine.destroy();
    }
}

// Factory function for creating the example
export function createVolumeRenderingExample(container: HTMLElement): VolumeRenderingExample {
    return new VolumeRenderingExample(container);
}

// Auto-initialize if container is found
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('volume-rendering-example');
    if (container) {
        const example = createVolumeRenderingExample(container);
        console.log('Volume rendering example initialized');
        
        // Store reference globally for debugging
        (window as any).volumeRenderingExample = example;
    }
});

// Export for external use
export default VolumeRenderingExample;