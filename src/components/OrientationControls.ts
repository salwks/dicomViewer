import { RotationController } from '../core/rotationController';
import { FlipController } from '../core/flipController';

export class OrientationControls {
    private element: HTMLElement;
    private rotationController: RotationController;
    private flipController: FlipController;
    private onOrientationChange?: (rotation: number, flipState: any) => void;
    
    constructor(
        containerElement: HTMLElement,
        rotationController: RotationController,
        flipController: FlipController,
        onOrientationChange?: (rotation: number, flipState: any) => void
    ) {
        this.element = containerElement;
        this.rotationController = rotationController;
        this.flipController = flipController;
        this.onOrientationChange = onOrientationChange;
        
        this.render();
        this.attachEventListeners();
    }
    
    /**
     * Render the orientation controls UI
     */
    private render(): void {
        const currentRotation = this.rotationController.getRotation();
        const flipState = this.flipController.getFlipState();
        
        let html = '<div class="orientation-controls">';
        html += '<h4>Image Orientation</h4>';
        
        // Rotation controls
        html += '<div class="rotation-controls">';
        html += '<label>Rotation:</label>';
        html += '<div class="rotation-buttons">';
        html += '<button id="rotateLeft" title="Rotate Left 90°">↺ 90°</button>';
        html += '<button id="rotateRight" title="Rotate Right 90°">↻ 90°</button>';
        html += `<span class="rotation-display">${currentRotation}°</span>`;
        html += '</div>';
        html += '</div>';
        
        // Flip controls
        html += '<div class="flip-controls">';
        html += '<label>Flip:</label>';
        html += '<div class="flip-buttons">';
        html += `<button id="flipHorizontal" class="${flipState.horizontal ? 'active' : ''}" title="Flip Horizontally">↔ Flip H</button>`;
        html += `<button id="flipVertical" class="${flipState.vertical ? 'active' : ''}" title="Flip Vertically">↕ Flip V</button>`;
        html += '</div>';
        html += '</div>';
        
        // Reset button
        html += '<div class="reset-controls">';
        html += '<button id="resetOrientation" class="reset-btn" title="Reset to Original Orientation">Reset All</button>';
        html += '</div>';
        
        // Custom rotation input
        html += '<div class="custom-rotation">';
        html += '<label for="customRotation">Custom Rotation:</label>';
        html += '<div class="custom-rotation-input">';
        html += `<input type="number" id="customRotation" min="0" max="359" step="1" value="${currentRotation}" />`;
        html += '<span>°</span>';
        html += '<button id="applyCustomRotation">Apply</button>';
        html += '</div>';
        html += '</div>';
        
        html += '</div>';
        
        this.element.innerHTML = html;
        
        // Add CSS styles
        this.addStyles();
    }
    
    /**
     * Attach event listeners to the control buttons
     */
    private attachEventListeners(): void {
        // Rotation buttons
        const rotateLeftButton = this.element.querySelector('#rotateLeft') as HTMLButtonElement;
        const rotateRightButton = this.element.querySelector('#rotateRight') as HTMLButtonElement;
        
        if (rotateLeftButton) {
            rotateLeftButton.addEventListener('click', () => {
                const newRotation = this.rotationController.rotateCounterClockwise();
                this.updateDisplay();
                this.notifyOrientationChange(newRotation);
            });
        }
        
        if (rotateRightButton) {
            rotateRightButton.addEventListener('click', () => {
                const newRotation = this.rotationController.rotateClockwise();
                this.updateDisplay();
                this.notifyOrientationChange(newRotation);
            });
        }
        
        // Flip buttons
        const flipHorizontalButton = this.element.querySelector('#flipHorizontal') as HTMLButtonElement;
        const flipVerticalButton = this.element.querySelector('#flipVertical') as HTMLButtonElement;
        
        if (flipHorizontalButton) {
            flipHorizontalButton.addEventListener('click', () => {
                const flipped = this.flipController.flipImageHorizontal();
                flipHorizontalButton.classList.toggle('active', flipped);
                this.notifyOrientationChange();
            });
        }
        
        if (flipVerticalButton) {
            flipVerticalButton.addEventListener('click', () => {
                const flipped = this.flipController.flipImageVertical();
                flipVerticalButton.classList.toggle('active', flipped);
                this.notifyOrientationChange();
            });
        }
        
        // Reset button
        const resetButton = this.element.querySelector('#resetOrientation') as HTMLButtonElement;
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                this.rotationController.resetRotation();
                this.flipController.resetOrientation();
                this.updateDisplay();
                this.notifyOrientationChange();
            });
        }
        
        // Custom rotation input
        const customRotationInput = this.element.querySelector('#customRotation') as HTMLInputElement;
        const applyCustomRotationButton = this.element.querySelector('#applyCustomRotation') as HTMLButtonElement;
        
        if (customRotationInput && applyCustomRotationButton) {
            applyCustomRotationButton.addEventListener('click', () => {
                const rotation = parseInt(customRotationInput.value, 10);
                if (!isNaN(rotation) && rotation >= 0 && rotation <= 359) {
                    const newRotation = this.rotationController.setRotation(rotation);
                    this.updateDisplay();
                    this.notifyOrientationChange(newRotation);
                } else {
                    alert('Please enter a valid rotation angle (0-359 degrees)');
                    customRotationInput.value = this.rotationController.getRotation().toString();
                }
            });
            
            // Allow Enter key to apply custom rotation
            customRotationInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    applyCustomRotationButton.click();
                }
            });
        }
    }
    
    /**
     * Update the display to reflect current orientation state
     */
    public updateDisplay(): void {
        const currentRotation = this.rotationController.getRotation();
        const flipState = this.flipController.getFlipState();
        
        // Update rotation display
        const rotationDisplay = this.element.querySelector('.rotation-display');
        if (rotationDisplay) {
            rotationDisplay.textContent = `${currentRotation}°`;
        }
        
        // Update custom rotation input
        const customRotationInput = this.element.querySelector('#customRotation') as HTMLInputElement;
        if (customRotationInput) {
            customRotationInput.value = currentRotation.toString();
        }
        
        // Update flip button states
        const flipHorizontalButton = this.element.querySelector('#flipHorizontal') as HTMLButtonElement;
        const flipVerticalButton = this.element.querySelector('#flipVertical') as HTMLButtonElement;
        
        if (flipHorizontalButton) {
            flipHorizontalButton.classList.toggle('active', flipState.horizontal);
        }
        
        if (flipVerticalButton) {
            flipVerticalButton.classList.toggle('active', flipState.vertical);
        }
    }
    
    /**
     * Notify callback about orientation changes
     */
    private notifyOrientationChange(rotation?: number): void {
        if (this.onOrientationChange) {
            const currentRotation = rotation !== undefined ? rotation : this.rotationController.getRotation();
            const flipState = this.flipController.getFlipState();
            this.onOrientationChange(currentRotation, flipState);
        }
    }
    
    /**
     * Add CSS styles for the orientation controls
     */
    private addStyles(): void {
        // Check if styles are already added
        if (document.getElementById('orientation-controls-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'orientation-controls-styles';
        style.textContent = `
            .orientation-controls {
                padding: 15px;
                background-color: #2a2a2a;
                border-radius: 6px;
                margin-bottom: 10px;
            }
            
            .orientation-controls h4 {
                margin: 0 0 12px 0;
                color: #fff;
                font-size: 14px;
                font-weight: 600;
            }
            
            .orientation-controls label {
                display: block;
                margin-bottom: 6px;
                color: #ccc;
                font-size: 12px;
                font-weight: 500;
            }
            
            .rotation-controls,
            .flip-controls,
            .reset-controls,
            .custom-rotation {
                margin-bottom: 12px;
            }
            
            .rotation-buttons,
            .flip-buttons {
                display: flex;
                gap: 8px;
                align-items: center;
            }
            
            .orientation-controls button {
                padding: 6px 12px;
                background-color: #333;
                color: #fff;
                border: 1px solid #555;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s ease;
            }
            
            .orientation-controls button:hover {
                background-color: #444;
                border-color: #666;
            }
            
            .orientation-controls button:active {
                background-color: #222;
            }
            
            .orientation-controls button.active {
                background-color: #007acc;
                border-color: #0056b3;
            }
            
            .orientation-controls button.active:hover {
                background-color: #0056b3;
            }
            
            .reset-btn {
                background-color: #d73a49 !important;
                border-color: #b31e2c !important;
            }
            
            .reset-btn:hover {
                background-color: #b31e2c !important;
                border-color: #a01e28 !important;
            }
            
            .rotation-display {
                color: #fff;
                font-size: 12px;
                font-weight: 600;
                background-color: #1a1a1a;
                padding: 4px 8px;
                border-radius: 3px;
                border: 1px solid #555;
                min-width: 35px;
                text-align: center;
            }
            
            .custom-rotation-input {
                display: flex;
                gap: 4px;
                align-items: center;
            }
            
            .custom-rotation-input input {
                width: 60px;
                padding: 4px 6px;
                background-color: #333;
                color: #fff;
                border: 1px solid #555;
                border-radius: 3px;
                font-size: 12px;
            }
            
            .custom-rotation-input span {
                color: #ccc;
                font-size: 12px;
            }
            
            .custom-rotation-input button {
                padding: 4px 8px;
                font-size: 11px;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * Destroy the orientation controls and cleanup
     */
    public destroy(): void {
        this.element.innerHTML = '';
    }
}