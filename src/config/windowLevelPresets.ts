export interface WindowLevelPreset {
    windowWidth: number;
    windowCenter: number;
    description?: string;
}

export const windowLevelPresets: Record<string, WindowLevelPreset> = {
    // Standard presets for different tissue types
    default: {
        windowWidth: 400,
        windowCenter: 40,
        description: 'Default soft tissue window'
    },
    
    brain: {
        windowWidth: 80,
        windowCenter: 40,
        description: 'Brain tissue window'
    },
    
    lung: {
        windowWidth: 1500,
        windowCenter: -600,
        description: 'Lung tissue window'
    },
    
    bone: {
        windowWidth: 2500,
        windowCenter: 480,
        description: 'Bone tissue window'
    },
    
    liver: {
        windowWidth: 150,
        windowCenter: 30,
        description: 'Liver tissue window'
    },
    
    mediastinum: {
        windowWidth: 350,
        windowCenter: 40,
        description: 'Mediastinum window'
    },
    
    abdomen: {
        windowWidth: 400,
        windowCenter: 50,
        description: 'Abdomen soft tissue window'
    },
    
    angio: {
        windowWidth: 500,
        windowCenter: 100,
        description: 'Angiography window'
    },
    
    chest: {
        windowWidth: 400,
        windowCenter: 40,
        description: 'Chest soft tissue window'
    },
    
    spine: {
        windowWidth: 400,
        windowCenter: 50,
        description: 'Spine soft tissue window'
    },
    
    pelvis: {
        windowWidth: 400,
        windowCenter: 40,
        description: 'Pelvis soft tissue window'
    }
};

export function getPresetByName(name: string): WindowLevelPreset | undefined {
    return windowLevelPresets[name];
}

export function getPresetNames(): string[] {
    return Object.keys(windowLevelPresets);
}

export function isValidPresetName(name: string): boolean {
    return name in windowLevelPresets;
}

export function addCustomPreset(name: string, preset: WindowLevelPreset): boolean {
    if (windowLevelPresets[name]) {
        console.warn(`Preset '${name}' already exists. Use updatePreset() to modify.`);
        return false;
    }
    
    if (!validatePreset(preset)) {
        console.error('Invalid preset values provided');
        return false;
    }
    
    windowLevelPresets[name] = { ...preset };
    console.log(`Custom preset '${name}' added successfully`);
    return true;
}

export function updatePreset(name: string, preset: Partial<WindowLevelPreset>): boolean {
    if (!windowLevelPresets[name]) {
        console.warn(`Preset '${name}' does not exist. Use addCustomPreset() to create.`);
        return false;
    }
    
    const updatedPreset = { ...windowLevelPresets[name], ...preset };
    if (!validatePreset(updatedPreset)) {
        console.error('Invalid preset values provided');
        return false;
    }
    
    windowLevelPresets[name] = updatedPreset;
    console.log(`Preset '${name}' updated successfully`);
    return true;
}

export function removePreset(name: string): boolean {
    if (!windowLevelPresets[name]) {
        console.warn(`Preset '${name}' does not exist.`);
        return false;
    }
    
    // Prevent removal of default presets
    const protectedPresets = ['default', 'brain', 'lung', 'bone', 'liver'];
    if (protectedPresets.includes(name)) {
        console.warn(`Cannot remove protected preset '${name}'.`);
        return false;
    }
    
    delete windowLevelPresets[name];
    console.log(`Preset '${name}' removed successfully`);
    return true;
}

export function validatePreset(preset: WindowLevelPreset): boolean {
    return (
        typeof preset.windowWidth === 'number' &&
        typeof preset.windowCenter === 'number' &&
        preset.windowWidth > 0 &&
        !isNaN(preset.windowWidth) &&
        !isNaN(preset.windowCenter)
    );
}

export function savePresetsToLocalStorage(): void {
    try {
        const { secureStore } = require('../utils/secure-storage');
        secureStore(windowLevelPresets, 'clarity_window_level_presets');
        console.log('Window/Level presets saved to secure storage');
    } catch (error) {
        console.error('Error saving presets to secure storage:', error);
        // Fallback to regular localStorage in case of encryption issues
        try {
            const presetsJson = JSON.stringify(windowLevelPresets);
            localStorage.setItem('cornerstone3d-windowlevel-presets', presetsJson);
            console.log('Window/Level presets saved to localStorage (fallback)');
        } catch (fallbackError) {
            console.error('Error with fallback localStorage save:', fallbackError);
        }
    }
}

export function loadPresetsFromLocalStorage(): boolean {
    try {
        const { secureRetrieve } = require('../utils/secure-storage');
        const loadedPresets = secureRetrieve('clarity_window_level_presets');
        
        if (loadedPresets) {
            // Validate and merge loaded presets
            Object.entries(loadedPresets).forEach(([name, preset]) => {
                if (validatePreset(preset as WindowLevelPreset)) {
                    windowLevelPresets[name] = preset as WindowLevelPreset;
                } else {
                    console.warn(`Invalid preset '${name}' found in secure storage, skipping`);
                }
            });
            
            console.log('Window/Level presets loaded from secure storage');
            return true;
        }
        
        // Fallback to legacy localStorage
        const presetsJson = localStorage.getItem('cornerstone3d-windowlevel-presets');
        if (presetsJson) {
            const legacyPresets = JSON.parse(presetsJson);
            
            // Validate and merge legacy presets
            Object.entries(legacyPresets).forEach(([name, preset]) => {
                if (validatePreset(preset as WindowLevelPreset)) {
                    windowLevelPresets[name] = preset as WindowLevelPreset;
                } else {
                    console.warn(`Invalid preset '${name}' found in legacy storage, skipping`);
                }
            });
            
            // Migrate to secure storage
            try {
                const { secureStore } = require('../utils/secure-storage');
                secureStore(legacyPresets, 'clarity_window_level_presets');
                localStorage.removeItem('cornerstone3d-windowlevel-presets');
                console.log('Window/Level presets migrated from legacy storage');
            } catch (migrationError) {
                console.warn('Failed to migrate presets to secure storage:', migrationError);
            }
            
            return true;
        }
    } catch (error) {
        console.error('Error loading presets from secure storage:', error);
    }
    
    return false;
}