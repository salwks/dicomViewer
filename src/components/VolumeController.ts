import { 
    VolumeRenderingOptionsManager, 
    VolumeRenderingSettings, 
    PresetVolumeSettings,
    TransferFunction,
    LightingModel,
    getVolumeRenderingOptionsManager 
} from '../core/volumeRenderingOptions';
import { Volume3DViewportManager } from '../core/volume3DViewport';
import { Types } from '@cornerstonejs/core';

export interface VolumeControllerConfig {
    showPresets?: boolean;
    showTransferFunction?: boolean;
    showLighting?: boolean;
    showOpacity?: boolean;
    showWindowLevel?: boolean;
    showRendering?: boolean;
    enableRealTimeUpdate?: boolean;
    compactMode?: boolean;
}

export interface VolumeControllerCallbacks {
    onSettingsChange?: (settings: VolumeRenderingSettings) => void;
    onPresetChange?: (presetName: string) => void;
    onOpacityChange?: (opacity: number) => void;
    onWindowLevelChange?: (windowWidth: number, windowCenter: number) => void;
}

export class VolumeController {
    private container: HTMLElement;
    private optionsManager: VolumeRenderingOptionsManager;
    private viewportManager: Volume3DViewportManager | null = null;
    private currentViewportId: string | null = null;
    private config: VolumeControllerConfig;
    private callbacks: VolumeControllerCallbacks;
    private controls: Map<string, HTMLElement> = new Map();
    private isUpdating: boolean = false;

    constructor(
        container: HTMLElement,
        config: VolumeControllerConfig = {},
        callbacks: VolumeControllerCallbacks = {}
    ) {
        this.container = container;
        this.config = {
            showPresets: true,
            showTransferFunction: true,
            showLighting: true,
            showOpacity: true,
            showWindowLevel: true,
            showRendering: true,
            enableRealTimeUpdate: true,
            compactMode: false,
            ...config
        };
        this.callbacks = callbacks;
        this.optionsManager = getVolumeRenderingOptionsManager();
        
        this.initializeControls();
    }

    private initializeControls(): void {
        try {
            this.container.innerHTML = '';
            this.container.className = `volume-controller ${this.config.compactMode ? 'compact' : ''}`;

            // Add CSS styles
            this.addControllerStyles();

            // Create control sections
            if (this.config.showPresets) {
                this.createPresetsSection();
            }

            if (this.config.showOpacity) {
                this.createOpacitySection();
            }

            if (this.config.showWindowLevel) {
                this.createWindowLevelSection();
            }

            if (this.config.showLighting) {
                this.createLightingSection();
            }

            if (this.config.showTransferFunction) {
                this.createTransferFunctionSection();
            }

            if (this.config.showRendering) {
                this.createRenderingSection();
            }

            // Add reset button
            this.createResetSection();

            console.log('Volume controller initialized');

        } catch (error) {
            console.error('Error initializing volume controller:', error);
        }
    }

    private addControllerStyles(): void {
        const style = document.createElement('style');
        style.textContent = `
            .volume-controller {
                background: #2a2a2a;
                color: #ffffff;
                padding: 15px;
                border-radius: 8px;
                font-family: Arial, sans-serif;
                font-size: 14px;
                min-width: 280px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            }

            .volume-controller.compact {
                padding: 10px;
                min-width: 200px;
            }

            .volume-controller-section {
                margin-bottom: 20px;
                padding: 10px;
                background: #333333;
                border-radius: 6px;
                border: 1px solid #444444;
            }

            .volume-controller.compact .volume-controller-section {
                margin-bottom: 15px;
                padding: 8px;
            }

            .volume-controller-section h3 {
                margin: 0 0 10px 0;
                color: #4a9eff;
                font-size: 16px;
                font-weight: bold;
            }

            .volume-controller.compact .volume-controller-section h3 {
                font-size: 14px;
                margin-bottom: 8px;
            }

            .volume-controller-group {
                margin-bottom: 15px;
            }

            .volume-controller.compact .volume-controller-group {
                margin-bottom: 10px;
            }

            .volume-controller-label {
                display: block;
                margin-bottom: 5px;
                color: #cccccc;
                font-weight: 500;
            }

            .volume-controller-input {
                width: 100%;
                padding: 8px;
                border: 1px solid #555555;
                border-radius: 4px;
                background: #1a1a1a;
                color: #ffffff;
                font-size: 14px;
            }

            .volume-controller.compact .volume-controller-input {
                padding: 6px;
                font-size: 12px;
            }

            .volume-controller-input:focus {
                outline: none;
                border-color: #4a9eff;
                box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.2);
            }

            .volume-controller-slider {
                width: 100%;
                -webkit-appearance: none;
                appearance: none;
                height: 6px;
                border-radius: 3px;
                background: #555555;
                outline: none;
                margin: 5px 0;
            }

            .volume-controller-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #4a9eff;
                cursor: pointer;
                border: 2px solid #ffffff;
            }

            .volume-controller-slider::-moz-range-thumb {
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #4a9eff;
                cursor: pointer;
                border: 2px solid #ffffff;
            }

            .volume-controller-value {
                float: right;
                color: #4a9eff;
                font-weight: bold;
                font-size: 12px;
            }

            .volume-controller-button {
                background: #4a9eff;
                color: #ffffff;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                transition: background-color 0.2s;
            }

            .volume-controller.compact .volume-controller-button {
                padding: 6px 12px;
                font-size: 12px;
            }

            .volume-controller-button:hover {
                background: #3a8eef;
            }

            .volume-controller-button:active {
                background: #2a7edf;
            }

            .volume-controller-button.secondary {
                background: #666666;
            }

            .volume-controller-button.secondary:hover {
                background: #777777;
            }

            .volume-controller-checkbox {
                margin-right: 8px;
            }

            .volume-controller-row {
                display: flex;
                gap: 10px;
                align-items: center;
            }

            .volume-controller-row .volume-controller-input {
                flex: 1;
            }
        `;
        document.head.appendChild(style);
    }

    private createPresetsSection(): void {
        const section = document.createElement('div');
        section.className = 'volume-controller-section';
        section.innerHTML = `
            <h3>Volume Presets</h3>
            <div class="volume-controller-group">
                <label class="volume-controller-label">Preset:</label>
                <select class="volume-controller-input" id="preset-select">
                    <option value="">Select Preset...</option>
                </select>
            </div>
        `;

        const select = section.querySelector('#preset-select') as HTMLSelectElement;
        
        // Populate presets
        const presets = this.optionsManager.getAllPresets();
        presets.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.name;
            option.textContent = `${preset.name} - ${preset.description}`;
            select.appendChild(option);
        });

        // Add event listener
        select.addEventListener('change', () => {
            if (select.value) {
                this.applyPreset(select.value);
            }
        });

        this.container.appendChild(section);
        this.controls.set('presets', section);
    }

    private createOpacitySection(): void {
        const section = document.createElement('div');
        section.className = 'volume-controller-section';
        section.innerHTML = `
            <h3>Opacity</h3>
            <div class="volume-controller-group">
                <label class="volume-controller-label">
                    Overall Opacity
                    <span class="volume-controller-value" id="opacity-value">1.0</span>
                </label>
                <input 
                    type="range" 
                    class="volume-controller-slider" 
                    id="opacity-slider"
                    min="0" 
                    max="1" 
                    step="0.01" 
                    value="1.0"
                />
            </div>
        `;

        const slider = section.querySelector('#opacity-slider') as HTMLInputElement;
        const valueDisplay = section.querySelector('#opacity-value') as HTMLSpanElement;

        slider.addEventListener('input', () => {
            const value = parseFloat(slider.value);
            valueDisplay.textContent = value.toFixed(2);
            this.updateOpacity(value);
        });

        this.container.appendChild(section);
        this.controls.set('opacity', section);
    }

    private createWindowLevelSection(): void {
        const section = document.createElement('div');
        section.className = 'volume-controller-section';
        section.innerHTML = `
            <h3>Window/Level</h3>
            <div class="volume-controller-group">
                <label class="volume-controller-label">
                    Window Width
                    <span class="volume-controller-value" id="window-width-value">400</span>
                </label>
                <input 
                    type="range" 
                    class="volume-controller-slider" 
                    id="window-width-slider"
                    min="1" 
                    max="4000" 
                    step="10" 
                    value="400"
                />
            </div>
            <div class="volume-controller-group">
                <label class="volume-controller-label">
                    Window Center
                    <span class="volume-controller-value" id="window-center-value">40</span>
                </label>
                <input 
                    type="range" 
                    class="volume-controller-slider" 
                    id="window-center-slider"
                    min="-1000" 
                    max="1000" 
                    step="10" 
                    value="40"
                />
            </div>
        `;

        const widthSlider = section.querySelector('#window-width-slider') as HTMLInputElement;
        const centerSlider = section.querySelector('#window-center-slider') as HTMLInputElement;
        const widthValue = section.querySelector('#window-width-value') as HTMLSpanElement;
        const centerValue = section.querySelector('#window-center-value') as HTMLSpanElement;

        widthSlider.addEventListener('input', () => {
            const value = parseInt(widthSlider.value);
            widthValue.textContent = value.toString();
            this.updateWindowLevel(value, parseInt(centerSlider.value));
        });

        centerSlider.addEventListener('input', () => {
            const value = parseInt(centerSlider.value);
            centerValue.textContent = value.toString();
            this.updateWindowLevel(parseInt(widthSlider.value), value);
        });

        this.container.appendChild(section);
        this.controls.set('windowLevel', section);
    }

    private createLightingSection(): void {
        const section = document.createElement('div');
        section.className = 'volume-controller-section';
        section.innerHTML = `
            <h3>Lighting</h3>
            <div class="volume-controller-group">
                <label class="volume-controller-label">
                    <input type="checkbox" class="volume-controller-checkbox" id="shading-checkbox" checked>
                    Enable Shading
                </label>
            </div>
            <div class="volume-controller-group">
                <label class="volume-controller-label">
                    Ambient
                    <span class="volume-controller-value" id="ambient-value">0.2</span>
                </label>
                <input 
                    type="range" 
                    class="volume-controller-slider" 
                    id="ambient-slider"
                    min="0" 
                    max="1" 
                    step="0.01" 
                    value="0.2"
                />
            </div>
            <div class="volume-controller-group">
                <label class="volume-controller-label">
                    Diffuse
                    <span class="volume-controller-value" id="diffuse-value">0.7</span>
                </label>
                <input 
                    type="range" 
                    class="volume-controller-slider" 
                    id="diffuse-slider"
                    min="0" 
                    max="1" 
                    step="0.01" 
                    value="0.7"
                />
            </div>
            <div class="volume-controller-group">
                <label class="volume-controller-label">
                    Specular
                    <span class="volume-controller-value" id="specular-value">0.5</span>
                </label>
                <input 
                    type="range" 
                    class="volume-controller-slider" 
                    id="specular-slider"
                    min="0" 
                    max="1" 
                    step="0.01" 
                    value="0.5"
                />
            </div>
            <div class="volume-controller-group">
                <label class="volume-controller-label">
                    Specular Power
                    <span class="volume-controller-value" id="specular-power-value">15</span>
                </label>
                <input 
                    type="range" 
                    class="volume-controller-slider" 
                    id="specular-power-slider"
                    min="1" 
                    max="100" 
                    step="1" 
                    value="15"
                />
            </div>
        `;

        // Add event listeners
        const shadingCheckbox = section.querySelector('#shading-checkbox') as HTMLInputElement;
        const ambientSlider = section.querySelector('#ambient-slider') as HTMLInputElement;
        const diffuseSlider = section.querySelector('#diffuse-slider') as HTMLInputElement;
        const specularSlider = section.querySelector('#specular-slider') as HTMLInputElement;
        const specularPowerSlider = section.querySelector('#specular-power-slider') as HTMLInputElement;

        const ambientValue = section.querySelector('#ambient-value') as HTMLSpanElement;
        const diffuseValue = section.querySelector('#diffuse-value') as HTMLSpanElement;
        const specularValue = section.querySelector('#specular-value') as HTMLSpanElement;
        const specularPowerValue = section.querySelector('#specular-power-value') as HTMLSpanElement;

        shadingCheckbox.addEventListener('change', () => {
            this.updateLighting();
        });

        ambientSlider.addEventListener('input', () => {
            const value = parseFloat(ambientSlider.value);
            ambientValue.textContent = value.toFixed(2);
            this.updateLighting();
        });

        diffuseSlider.addEventListener('input', () => {
            const value = parseFloat(diffuseSlider.value);
            diffuseValue.textContent = value.toFixed(2);
            this.updateLighting();
        });

        specularSlider.addEventListener('input', () => {
            const value = parseFloat(specularSlider.value);
            specularValue.textContent = value.toFixed(2);
            this.updateLighting();
        });

        specularPowerSlider.addEventListener('input', () => {
            const value = parseInt(specularPowerSlider.value);
            specularPowerValue.textContent = value.toString();
            this.updateLighting();
        });

        this.container.appendChild(section);
        this.controls.set('lighting', section);
    }

    private createTransferFunctionSection(): void {
        const section = document.createElement('div');
        section.className = 'volume-controller-section';
        section.innerHTML = `
            <h3>Transfer Function</h3>
            <div class="volume-controller-group">
                <label class="volume-controller-label">Color Map:</label>
                <select class="volume-controller-input" id="colormap-select">
                    <option value="grayscale">Grayscale</option>
                    <option value="red">Red</option>
                    <option value="blue">Blue</option>
                    <option value="rainbow">Rainbow</option>
                </select>
            </div>
            <div class="volume-controller-group">
                <label class="volume-controller-label">
                    Min Value
                    <span class="volume-controller-value" id="tf-min-value">0</span>
                </label>
                <input 
                    type="range" 
                    class="volume-controller-slider" 
                    id="tf-min-slider"
                    min="-1000" 
                    max="1000" 
                    step="10" 
                    value="0"
                />
            </div>
            <div class="volume-controller-group">
                <label class="volume-controller-label">
                    Max Value
                    <span class="volume-controller-value" id="tf-max-value">1000</span>
                </label>
                <input 
                    type="range" 
                    class="volume-controller-slider" 
                    id="tf-max-slider"
                    min="0" 
                    max="2000" 
                    step="10" 
                    value="1000"
                />
            </div>
            <div class="volume-controller-group">
                <button class="volume-controller-button" id="apply-tf-button">Apply Transfer Function</button>
            </div>
        `;

        const applyButton = section.querySelector('#apply-tf-button') as HTMLButtonElement;
        applyButton.addEventListener('click', () => {
            this.updateTransferFunction();
        });

        this.container.appendChild(section);
        this.controls.set('transferFunction', section);
    }

    private createRenderingSection(): void {
        const section = document.createElement('div');
        section.className = 'volume-controller-section';
        section.innerHTML = `
            <h3>Rendering</h3>
            <div class="volume-controller-group">
                <label class="volume-controller-label">Algorithm:</label>
                <select class="volume-controller-input" id="algorithm-select">
                    <option value="raycast">Ray Casting</option>
                    <option value="texture">Texture Mapping</option>
                    <option value="isosurface">Isosurface</option>
                </select>
            </div>
            <div class="volume-controller-group">
                <label class="volume-controller-label">Interpolation:</label>
                <select class="volume-controller-input" id="interpolation-select">
                    <option value="linear">Linear</option>
                    <option value="nearest">Nearest</option>
                </select>
            </div>
            <div class="volume-controller-group">
                <label class="volume-controller-label">
                    Sample Distance
                    <span class="volume-controller-value" id="sample-distance-value">1.0</span>
                </label>
                <input 
                    type="range" 
                    class="volume-controller-slider" 
                    id="sample-distance-slider"
                    min="0.1" 
                    max="5.0" 
                    step="0.1" 
                    value="1.0"
                />
            </div>
        `;

        const algorithmSelect = section.querySelector('#algorithm-select') as HTMLSelectElement;
        const interpolationSelect = section.querySelector('#interpolation-select') as HTMLSelectElement;
        const sampleDistanceSlider = section.querySelector('#sample-distance-slider') as HTMLInputElement;
        const sampleDistanceValue = section.querySelector('#sample-distance-value') as HTMLSpanElement;

        algorithmSelect.addEventListener('change', () => {
            this.updateRenderingSettings();
        });

        interpolationSelect.addEventListener('change', () => {
            this.updateRenderingSettings();
        });

        sampleDistanceSlider.addEventListener('input', () => {
            const value = parseFloat(sampleDistanceSlider.value);
            sampleDistanceValue.textContent = value.toFixed(1);
            this.updateRenderingSettings();
        });

        this.container.appendChild(section);
        this.controls.set('rendering', section);
    }

    private createResetSection(): void {
        const section = document.createElement('div');
        section.className = 'volume-controller-section';
        section.innerHTML = `
            <div class="volume-controller-group">
                <button class="volume-controller-button" id="reset-button">Reset to Defaults</button>
                <button class="volume-controller-button secondary" id="reset-camera-button">Reset Camera</button>
            </div>
        `;

        const resetButton = section.querySelector('#reset-button') as HTMLButtonElement;
        const resetCameraButton = section.querySelector('#reset-camera-button') as HTMLButtonElement;

        resetButton.addEventListener('click', () => {
            this.resetToDefaults();
        });

        resetCameraButton.addEventListener('click', () => {
            this.resetCamera();
        });

        this.container.appendChild(section);
        this.controls.set('reset', section);
    }

    public connectViewportManager(viewportManager: Volume3DViewportManager, viewportId: string): void {
        this.viewportManager = viewportManager;
        this.currentViewportId = viewportId;
        console.log(`Volume controller connected to viewport: ${viewportId}`);
    }

    private applyPreset(presetName: string): void {
        try {
            const settings = this.optionsManager.applyPreset(presetName);
            if (settings) {
                this.updateControlsFromSettings(settings);
                this.applySettingsToViewport(settings);
                this.callbacks.onPresetChange?.(presetName);
            }
        } catch (error) {
            console.error('Error applying preset:', error);
        }
    }

    private updateOpacity(opacity: number): void {
        if (this.viewportManager && this.currentViewportId) {
            this.viewportManager.setVolumeOpacity(this.currentViewportId, opacity);
            this.callbacks.onOpacityChange?.(opacity);
        }
    }

    private updateWindowLevel(windowWidth: number, windowCenter: number): void {
        if (this.viewportManager && this.currentViewportId) {
            this.viewportManager.setVolumeWindowLevel(this.currentViewportId, windowWidth, windowCenter);
            this.callbacks.onWindowLevelChange?.(windowWidth, windowCenter);
        }
    }

    private updateLighting(): void {
        if (!this.viewportManager || !this.currentViewportId) return;

        const lightingSection = this.controls.get('lighting');
        if (!lightingSection) return;

        const shading = (lightingSection.querySelector('#shading-checkbox') as HTMLInputElement)?.checked ?? true;
        const ambient = parseFloat((lightingSection.querySelector('#ambient-slider') as HTMLInputElement)?.value ?? '0.2');
        const diffuse = parseFloat((lightingSection.querySelector('#diffuse-slider') as HTMLInputElement)?.value ?? '0.7');
        const specular = parseFloat((lightingSection.querySelector('#specular-slider') as HTMLInputElement)?.value ?? '0.5');
        const specularPower = parseInt((lightingSection.querySelector('#specular-power-slider') as HTMLInputElement)?.value ?? '15');

        const properties = {
            shade: shading,
            ambient,
            diffuse,
            specular,
            specularPower
        };

        this.viewportManager.updateVolumeRenderingProperties(this.currentViewportId, properties);
    }

    private updateTransferFunction(): void {
        if (!this.viewportManager || !this.currentViewportId) return;

        const section = this.controls.get('transferFunction');
        if (!section) return;

        const colorMap = (section.querySelector('#colormap-select') as HTMLSelectElement)?.value ?? 'grayscale';
        const minValue = parseInt((section.querySelector('#tf-min-slider') as HTMLInputElement)?.value ?? '0');
        const maxValue = parseInt((section.querySelector('#tf-max-slider') as HTMLInputElement)?.value ?? '1000');

        const transferFunction = this.optionsManager.createLinearTransferFunction(
            minValue, 
            maxValue, 
            0.0, 
            1.0, 
            colorMap as any
        );

        const settings = this.optionsManager.updateSettings({ transferFunction });
        this.applySettingsToViewport(settings);
    }

    private updateRenderingSettings(): void {
        if (!this.viewportManager || !this.currentViewportId) return;

        const section = this.controls.get('rendering');
        if (!section) return;

        const algorithm = (section.querySelector('#algorithm-select') as HTMLSelectElement)?.value ?? 'raycast';
        const interpolationType = (section.querySelector('#interpolation-select') as HTMLSelectElement)?.value ?? 'linear';
        const sampleDistance = parseFloat((section.querySelector('#sample-distance-slider') as HTMLInputElement)?.value ?? '1.0');

        const settings = this.optionsManager.updateSettings({
            renderingAlgorithm: algorithm as any,
            interpolationType: interpolationType as any,
            sampleDistance
        });

        this.applySettingsToViewport(settings);
    }

    private updateControlsFromSettings(settings: VolumeRenderingSettings): void {
        this.isUpdating = true;

        try {
            // Update lighting controls
            if (settings.lightingModel && this.controls.has('lighting')) {
                const lightingSection = this.controls.get('lighting')!;
                const { ambient, diffuse, specular, specularPower } = settings.lightingModel;

                (lightingSection.querySelector('#ambient-slider') as HTMLInputElement).value = ambient.toString();
                (lightingSection.querySelector('#ambient-value') as HTMLSpanElement).textContent = ambient.toFixed(2);

                (lightingSection.querySelector('#diffuse-slider') as HTMLInputElement).value = diffuse.toString();
                (lightingSection.querySelector('#diffuse-value') as HTMLSpanElement).textContent = diffuse.toFixed(2);

                (lightingSection.querySelector('#specular-slider') as HTMLInputElement).value = specular.toString();
                (lightingSection.querySelector('#specular-value') as HTMLSpanElement).textContent = specular.toFixed(2);

                (lightingSection.querySelector('#specular-power-slider') as HTMLInputElement).value = specularPower.toString();
                (lightingSection.querySelector('#specular-power-value') as HTMLSpanElement).textContent = specularPower.toString();
            }

            // Update rendering controls
            if (this.controls.has('rendering')) {
                const renderingSection = this.controls.get('rendering')!;
                
                if (settings.renderingAlgorithm) {
                    (renderingSection.querySelector('#algorithm-select') as HTMLSelectElement).value = settings.renderingAlgorithm;
                }
                
                if (settings.interpolationType) {
                    (renderingSection.querySelector('#interpolation-select') as HTMLSelectElement).value = settings.interpolationType;
                }
                
                if (settings.sampleDistance) {
                    (renderingSection.querySelector('#sample-distance-slider') as HTMLInputElement).value = settings.sampleDistance.toString();
                    (renderingSection.querySelector('#sample-distance-value') as HTMLSpanElement).textContent = settings.sampleDistance.toFixed(1);
                }
            }

        } finally {
            this.isUpdating = false;
        }
    }

    private applySettingsToViewport(settings: VolumeRenderingSettings): void {
        if (!this.viewportManager || !this.currentViewportId || this.isUpdating) return;

        try {
            const properties: any = {};

            if (settings.lightingModel) {
                properties.ambient = settings.lightingModel.ambient;
                properties.diffuse = settings.lightingModel.diffuse;
                properties.specular = settings.lightingModel.specular;
                properties.specularPower = settings.lightingModel.specularPower;
            }

            if (settings.enableShading !== undefined) {
                properties.shade = settings.enableShading;
            }

            if (settings.interpolationType) {
                properties.interpolationType = settings.interpolationType.toUpperCase();
            }

            this.viewportManager.updateVolumeRenderingProperties(this.currentViewportId, properties);
            this.callbacks.onSettingsChange?.(settings);

        } catch (error) {
            console.error('Error applying settings to viewport:', error);
        }
    }

    private resetToDefaults(): void {
        try {
            const settings = this.optionsManager.resetToDefaults();
            this.updateControlsFromSettings(settings);
            this.applySettingsToViewport(settings);
            console.log('Volume controller reset to defaults');
        } catch (error) {
            console.error('Error resetting to defaults:', error);
        }
    }

    private resetCamera(): void {
        if (this.viewportManager && this.currentViewportId) {
            this.viewportManager.resetViewportCamera(this.currentViewportId);
            console.log('Volume viewport camera reset');
        }
    }

    public getCurrentSettings(): VolumeRenderingSettings {
        return this.optionsManager.getCurrentSettings();
    }

    public updateConfig(config: Partial<VolumeControllerConfig>): void {
        this.config = { ...this.config, ...config };
        this.initializeControls();
    }

    public show(): void {
        this.container.style.display = 'block';
    }

    public hide(): void {
        this.container.style.display = 'none';
    }

    public dispose(): void {
        try {
            this.container.innerHTML = '';
            this.controls.clear();
            this.viewportManager = null;
            this.currentViewportId = null;
            console.log('Volume controller disposed');
        } catch (error) {
            console.error('Error disposing volume controller:', error);
        }
    }
}

// Factory function for creating volume controllers
export function createVolumeController(
    container: HTMLElement,
    config: VolumeControllerConfig = {},
    callbacks: VolumeControllerCallbacks = {}
): VolumeController {
    return new VolumeController(container, config, callbacks);
}

// Utility functions for controller management
export function createCompactVolumeController(
    container: HTMLElement,
    callbacks: VolumeControllerCallbacks = {}
): VolumeController {
    return new VolumeController(container, { compactMode: true }, callbacks);
}

export function createFullVolumeController(
    container: HTMLElement,
    callbacks: VolumeControllerCallbacks = {}
): VolumeController {
    return new VolumeController(container, {
        showPresets: true,
        showTransferFunction: true,
        showLighting: true,
        showOpacity: true,
        showWindowLevel: true,
        showRendering: true,
        enableRealTimeUpdate: true,
        compactMode: false
    }, callbacks);
}

export function getDefaultVolumeControllerConfig(): VolumeControllerConfig {
    return {
        showPresets: true,
        showTransferFunction: true,
        showLighting: true,
        showOpacity: true,
        showWindowLevel: true,
        showRendering: true,
        enableRealTimeUpdate: true,
        compactMode: false
    };
}