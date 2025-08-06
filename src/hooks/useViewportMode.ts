/**
 * useViewportMode Hook
 * Manages viewport mode switching between 2D and 3D
 * Handles viewport type conversion and rendering mode changes
 */
import { log } from '../utils/logger';

import { useState, useCallback, useRef, useEffect } from 'react';
// import type { Types } from '@cornerstonejs/core';
// Mock Enums removed as they were unused
// import { getRenderingEngineInstance } from '@/config/cornerstone';
import type { ViewMode, OrientationType } from '@/components/ViewModeSelector';
interface ViewportModeConfig {
  mode: ViewMode;
  orientation: OrientationType;
  renderingPreset?: string;
  slabThickness?: number;
  showCrosshairs?: boolean;
  showOrientationMarker?: boolean;
}

interface UseViewportModeReturn {
  currentMode: ViewMode;
  currentOrientation: OrientationType;
  isTransitioning: boolean;
  switchMode: (config: ViewportModeConfig) => Promise<void>;
  resetMode: () => void;
  getModeInfo: () => ViewportModeConfig;
}

export function useViewportMode(
  initialMode: ViewMode = '2D',
  initialOrientation: OrientationType = 'axial',
): UseViewportModeReturn {
  const [currentMode, setCurrentMode] = useState<ViewMode>(initialMode);
  const [currentOrientation, setCurrentOrientation] = useState<OrientationType>(initialOrientation);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const configRef = useRef<ViewportModeConfig>({
    mode: initialMode,
    orientation: initialOrientation,
    showCrosshairs: false,
    showOrientationMarker: true,
  });

  // Helper functions removed as they were unused

  // Switch viewport mode
  const switchMode = useCallback(
    async (config: ViewportModeConfig): Promise<void> => {
      if (isTransitioning) {
        console.warn('Mode transition already in progress');
        return;
      }

      setIsTransitioning(true);
      log.info(`Switching viewport mode: ${currentMode} -> ${config.mode}`);

      try {
        // Mock implementation - function not available
        log.info('Mock viewport mode switch - functions not implemented yet');

        // Update local state
        configRef.current = config;

        // Update crosshairs visibility
        if (config.showCrosshairs !== undefined) {
          log.info(`Crosshairs: ${config.showCrosshairs ? 'enabled' : 'disabled'}`);
          // TODO: Toggle crosshairs tool
        }

        // Update orientation marker
        if (config.showOrientationMarker !== undefined) {
          log.info(`Orientation marker: ${config.showOrientationMarker ? 'enabled' : 'disabled'}`);
          // TODO: Toggle orientation marker overlay
        }

        // Update state
        setCurrentMode(config.mode);
        setCurrentOrientation(config.orientation);
        configRef.current = config;

        // Mock viewport render
        log.info('Mock viewport render - function not implemented yet');

        log.info(`✓ Mode switched to: ${config.mode}`);
      } catch (error) {
        console.error('Failed to switch viewport mode:', error);
        throw error;
      } finally {
        setIsTransitioning(false);
      }
    },
    [currentMode, isTransitioning],
  );

  // Reset to default mode
  const resetMode = useCallback(() => {
    const defaultConfig: ViewportModeConfig = {
      mode: '2D',
      orientation: 'axial',
      showCrosshairs: false,
      showOrientationMarker: true,
    };

    switchMode(defaultConfig);
  }, [switchMode]);

  // Get current mode info
  const getModeInfo = useCallback((): ViewportModeConfig => {
    return { ...configRef.current };
  }, []);

  // Handle keyboard shortcuts for quick mode switching
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent): void => {
      // Skip if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Mode switching shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '2':
            e.preventDefault();
            switchMode({ ...configRef.current, mode: '2D' });
            break;
          case '3':
            e.preventDefault();
            switchMode({ ...configRef.current, mode: '3D' });
            break;
          case 'm':
            e.preventDefault();
            switchMode({ ...configRef.current, mode: e.shiftKey ? 'MIP' : 'MPR' });
            break;
        }
      }

      // Orientation shortcuts (2D mode only)
      if (currentMode === '2D' && e.altKey) {
        switch (e.key) {
          case 'a':
            e.preventDefault();
            switchMode({ ...configRef.current, orientation: 'axial' });
            break;
          case 's':
            e.preventDefault();
            switchMode({ ...configRef.current, orientation: 'sagittal' });
            break;
          case 'c':
            e.preventDefault();
            switchMode({ ...configRef.current, orientation: 'coronal' });
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [currentMode, switchMode]);

  return {
    currentMode,
    currentOrientation,
    isTransitioning,
    switchMode,
    resetMode,
    getModeInfo,
  };
}
