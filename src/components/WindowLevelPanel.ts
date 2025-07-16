import { getPresetNames, getPresetByName, WindowLevelPreset } from '../config/windowLevelPresets';
import { DicomViewer } from './DicomViewer';
import { validateNumericInput } from '../utils/input-validation';
import { handleValidationError } from '../utils/validation-error-handler';

export class WindowLevelPanel {
    private element: HTMLElement;
    private viewer: DicomViewer;
    private isInitialized: boolean = false;
    
    constructor(containerElement: HTMLElement, viewer: DicomViewer) {
        this.element = containerElement;
        this.viewer = viewer;
        this.initialize();
    }
    
    private initialize(): void {
        this.render();
        this.attachEventListeners();
        this.updateCurrentValues();
        this.isInitialized = true;
        console.log('Window/Level panel initialized');
    }
    
    private render(): void {
        const presetNames = getPresetNames();
        
        let html = '<div class="window-level-panel">';
        html += '<h3>Window/Level Controls</h3>';
        
        // Current values display
        html += '<div class="current-values">';
        html += '<div class="value-display">';
        html += '<span class="label">Current:</span>';
        html += '<span id="currentWindowLevel">W: 400, L: 40</span>';
        html += '</div>';
        html += '</div>';
        
        // Manual controls
        html += '<div class="manual-controls">';
        html += '<div class="control-group">';
        html += '<label for="windowWidth">Window Width:</label>';
        html += '<input type="range" id="windowWidth" min="1" max="4000" value="400" step="1">';
        html += '<span id="windowWidthValue">400</span>';
        html += '</div>';
        html += '<div class="control-group">';
        html += '<label for="windowCenter">Window Center:</label>';
        html += '<input type="range" id="windowCenter" min="-1000" max="1000" value="40" step="1">';
        html += '<span id="windowCenterValue">40</span>';
        html += '</div>';
        html += '</div>';
        
        // Preset buttons
        html += '<div class="preset-section">';
        html += '<h4>Presets</h4>';
        html += '<div class="preset-buttons">';
        
        presetNames.forEach(name => {
            const preset = getPresetByName(name);
            if (preset) {
                html += `<button class="preset-btn" data-preset="${name}" title="${preset.description || name}">`;
                html += `${name.charAt(0).toUpperCase() + name.slice(1)}`;
                html += '</button>';
            }
        });
        
        html += '</div>';
        html += '</div>';
        
        // Action buttons
        html += '<div class="action-buttons">';
        html += '<button id="resetWindowLevel" class="action-btn">Reset</button>';
        html += '<button id="autoWindowLevel" class="action-btn">Auto</button>';
        html += '</div>';
        
        // Fine adjustment controls
        html += '<div class="fine-controls">';
        html += '<h4>Fine Adjustment</h4>';
        html += '<div class="adjustment-buttons">';
        html += '<button class="adjust-btn" data-type="width" data-delta="10">W+</button>';
        html += '<button class="adjust-btn" data-type="width" data-delta="-10">W-</button>';
        html += '<button class="adjust-btn" data-type="center" data-delta="10">L+</button>';
        html += '<button class="adjust-btn" data-type="center" data-delta="-10">L-</button>';
        html += '</div>';
        html += '</div>';
        
        html += '</div>';
        
        this.element.innerHTML = html;
    }
    
    private attachEventListeners(): void {
        // Manual slider controls
        const windowWidthSlider = this.element.querySelector('#windowWidth') as HTMLInputElement;
        const windowCenterSlider = this.element.querySelector('#windowCenter') as HTMLInputElement;
        
        if (windowWidthSlider) {
            windowWidthSlider.addEventListener('input', () => {
                const windowWidthValue = windowWidthSlider.value;
                const windowCenterValue = windowCenterSlider.value;
                
                // Validate window width input
                const widthValidation = validateNumericInput(windowWidthValue, 'windowWidth');
                if (!widthValidation.isValid) {
                    console.warn('Window width validation failed:', widthValidation.errors);
                    handleValidationError(widthValidation, 'windowWidth');
                    return;
                }
                
                // Validate window center input
                const centerValidation = validateNumericInput(windowCenterValue, 'windowLevel');
                if (!centerValidation.isValid) {
                    console.warn('Window center validation failed:', centerValidation.errors);
                    handleValidationError(centerValidation, 'windowCenter');
                    return;
                }
                
                const windowWidth = parseInt(windowWidthValue, 10);
                const windowCenter = parseInt(windowCenterValue, 10);
                
                this.viewer.setWindowLevel(windowWidth, windowCenter);
                this.updateValueDisplays(windowWidth, windowCenter);
                
                console.log(`Window/Level validated and applied: W=${windowWidth}, L=${windowCenter}`);
            });
        }
        
        if (windowCenterSlider) {
            windowCenterSlider.addEventListener('input', () => {
                const windowWidthValue = windowWidthSlider.value;
                const windowCenterValue = windowCenterSlider.value;
                
                // Validate window width input
                const widthValidation = validateNumericInput(windowWidthValue, 'windowWidth');
                if (!widthValidation.isValid) {
                    console.warn('Window width validation failed:', widthValidation.errors);
                    handleValidationError(widthValidation, 'windowWidth');
                    return;
                }
                
                // Validate window center input
                const centerValidation = validateNumericInput(windowCenterValue, 'windowLevel');
                if (!centerValidation.isValid) {
                    console.warn('Window center validation failed:', centerValidation.errors);
                    handleValidationError(centerValidation, 'windowCenter');
                    return;
                }
                
                const windowWidth = parseInt(windowWidthValue, 10);
                const windowCenter = parseInt(windowCenterValue, 10);
                
                this.viewer.setWindowLevel(windowWidth, windowCenter);
                this.updateValueDisplays(windowWidth, windowCenter);
                
                console.log(`Window/Level validated and applied: W=${windowWidth}, L=${windowCenter}`);
            });
        }
        
        // Preset buttons
        const presetButtons = this.element.querySelectorAll('.preset-btn');
        presetButtons.forEach(button => {
            button.addEventListener('click', () => {
                const presetName = button.getAttribute('data-preset');
                if (presetName) {
                    this.applyPreset(presetName);
                }
            });
        });
        
        // Action buttons
        const resetButton = this.element.querySelector('#resetWindowLevel');
        const autoButton = this.element.querySelector('#autoWindowLevel');
        
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                this.viewer.resetWindowLevel();
                this.updateCurrentValues();
            });
        }
        
        if (autoButton) {
            autoButton.addEventListener('click', () => {
                this.autoAdjustWindowLevel();
            });
        }
        
        // Fine adjustment buttons
        const adjustButtons = this.element.querySelectorAll('.adjust-btn');
        adjustButtons.forEach(button => {
            button.addEventListener('click', () => {
                const type = button.getAttribute('data-type');
                const delta = parseInt(button.getAttribute('data-delta') || '0', 10);
                
                // Get current values and calculate new values
                const current = this.viewer.getCurrentWindowLevel();
                if (!current) return;
                
                let newWidth = current.windowWidth;
                let newCenter = current.windowCenter;
                
                if (type === 'width') {
                    newWidth = current.windowWidth + delta;
                } else if (type === 'center') {
                    newCenter = current.windowCenter + delta;
                }
                
                // Validate the new values
                const widthValidation = validateNumericInput(newWidth.toString(), 'windowWidth');
                const centerValidation = validateNumericInput(newCenter.toString(), 'windowLevel');
                
                if (!widthValidation.isValid) {
                    console.warn('Window width adjustment validation failed:', widthValidation.errors);
                    handleValidationError(widthValidation, 'windowWidth');
                    return;
                }
                
                if (!centerValidation.isValid) {
                    console.warn('Window center adjustment validation failed:', centerValidation.errors);
                    handleValidationError(centerValidation, 'windowCenter');
                    return;
                }
                
                // Apply the validated adjustments
                if (type === 'width') {
                    this.viewer.adjustWindowWidth(delta);
                } else if (type === 'center') {
                    this.viewer.adjustWindowCenter(delta);
                }
                
                this.updateCurrentValues();
                console.log(`Window/Level adjustment validated and applied: ${type} ${delta > 0 ? '+' : ''}${delta}`);
            });
        });
    }
    
    private applyPreset(presetName: string): void {
        this.viewer.applyWindowLevelPreset(presetName);
        this.updateCurrentValues();
        
        // Visual feedback
        const presetButtons = this.element.querySelectorAll('.preset-btn');
        presetButtons.forEach(btn => btn.classList.remove('active'));
        
        const activeButton = this.element.querySelector(`[data-preset="${presetName}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
            setTimeout(() => activeButton.classList.remove('active'), 1000);
        }
        
        console.log(`Applied window/level preset: ${presetName}`);
    }
    
    private autoAdjustWindowLevel(): void {
        // This would typically analyze the current image to determine optimal window/level
        // For now, we'll apply a general purpose preset
        console.log('Auto window/level adjustment - using default preset');
        this.applyPreset('default');
    }
    
    public updateCurrentValues(): void {
        const current = this.viewer.getCurrentWindowLevel();
        if (current) {
            this.updateValueDisplays(current.windowWidth, current.windowCenter);
            this.updateSliders(current.windowWidth, current.windowCenter);
        }
    }
    
    private updateValueDisplays(windowWidth: number, windowCenter: number): void {
        const currentDisplay = this.element.querySelector('#currentWindowLevel');
        const widthValue = this.element.querySelector('#windowWidthValue');
        const centerValue = this.element.querySelector('#windowCenterValue');
        
        if (currentDisplay) {
            currentDisplay.textContent = `W: ${windowWidth}, L: ${windowCenter}`;
        }
        
        if (widthValue) {
            widthValue.textContent = windowWidth.toString();
        }
        
        if (centerValue) {
            centerValue.textContent = windowCenter.toString();
        }
    }
    
    private updateSliders(windowWidth: number, windowCenter: number): void {
        const windowWidthSlider = this.element.querySelector('#windowWidth') as HTMLInputElement;
        const windowCenterSlider = this.element.querySelector('#windowCenter') as HTMLInputElement;
        
        if (windowWidthSlider) {
            windowWidthSlider.value = windowWidth.toString();
        }
        
        if (windowCenterSlider) {
            windowCenterSlider.value = windowCenter.toString();
        }
    }
    
    public setEnabled(enabled: boolean): void {
        const controls = this.element.querySelectorAll('input, button');
        controls.forEach(control => {
            if (enabled) {
                control.removeAttribute('disabled');
            } else {
                control.setAttribute('disabled', 'true');
            }
        });
    }
    
    public destroy(): void {
        if (this.isInitialized) {
            this.element.innerHTML = '';
            this.isInitialized = false;
            console.log('Window/Level panel destroyed');
        }
    }
}