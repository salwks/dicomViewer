/**
 * Viewport Synchronization Hook
 * Manages synchronization between comparison viewports
 */
import { log } from '../utils/logger';

import { useEffect, useCallback } from 'react';
import { createBidirectionalSync, ViewportSynchronizer } from '../utils/viewportSynchronizer';
interface UseSynchronizationProps {
  currentMode: string;
  comparisonStudyA: number | null;
  comparisonStudyB: number | null;
  syncScroll: boolean;
  syncZoom: boolean;
  syncWindowLevel: boolean;
  syncTools: boolean;
  setSyncScroll: React.Dispatch<React.SetStateAction<boolean>>;
  setSyncZoom: React.Dispatch<React.SetStateAction<boolean>>;
  setSyncWindowLevel: React.Dispatch<React.SetStateAction<boolean>>;
  setSyncTools: React.Dispatch<React.SetStateAction<boolean>>;
  synchronizerRef: React.MutableRefObject<{
    syncAtoB: ViewportSynchronizer;
    syncBtoA: ViewportSynchronizer;
  } | null>;
}

export const useSynchronization = ({
  currentMode,
  comparisonStudyA,
  comparisonStudyB,
  syncScroll,
  syncZoom,
  syncWindowLevel,
  setSyncScroll,
  setSyncZoom,
  setSyncWindowLevel,
  setSyncTools,
  synchronizerRef,
}: UseSynchronizationProps) => {
  // Handle synchronization between comparison viewers
  useEffect(() => {
    // Only set up synchronization in comparison mode with both studies loaded
    if (currentMode !== 'comparison' || comparisonStudyA === null || comparisonStudyB === null) {
      // Clean up existing synchronization
      if (synchronizerRef.current) {
        synchronizerRef.current.syncAtoB.disable();
        synchronizerRef.current.syncBtoA.disable();
        synchronizerRef.current = null;
      }
      return;
    }

    // Small delay to ensure viewports are fully initialized
    const timer = setTimeout(() => {
      try {
        log.info('🔄 Attempting to create viewport synchronization...');
        log.info('📊 Looking for engines:', {
          engineA: 'comparisonRenderingEngineA',
          engineB: 'comparisonRenderingEngineB',
          viewportA: 'COMPARISON_VIEWPORT_A',
          viewportB: 'COMPARISON_VIEWPORT_B',
        });

        const sync = createBidirectionalSync(
          'comparisonRenderingEngineA',
          'COMPARISON_VIEWPORT_A',
          'comparisonRenderingEngineB',
          'COMPARISON_VIEWPORT_B',
          {
            enableScroll: syncScroll,
            enableZoom: syncZoom,
            enableWindowLevel: syncWindowLevel,
          },
        );

        log.info('🎯 Sync object created:', sync);

        const enabledA = sync.syncAtoB.enable();
        const enabledB = sync.syncBtoA.enable();

        log.info('🔗 Sync enable results:', { enabledA, enabledB });

        synchronizerRef.current = sync;

        log.info('✅ Viewport synchronization enabled successfully');
      } catch (error) {
        console.error('❌ Failed to setup viewport synchronization:', error);
      }
    }, 2000); // Increased delay to ensure viewports are ready

    return () => {
      clearTimeout(timer);
      if (synchronizerRef.current) {
        synchronizerRef.current.syncAtoB.disable();
        synchronizerRef.current.syncBtoA.disable();
      }
    };
  }, [currentMode, comparisonStudyA, comparisonStudyB, syncScroll, syncZoom, syncWindowLevel, synchronizerRef]);

  // Sync toggle handlers - stable references to prevent ComparisonViewer re-render
  const handleSyncScrollToggle = useCallback(() => {
    setSyncScroll((prev: boolean) => {
      const newValue = !prev;
      log.info('🔄 Toggle sync scroll:', { from: prev, to: newValue });
      if (synchronizerRef.current) {
        log.info('🔗 Updating synchronizer options for scroll');
        synchronizerRef.current.syncAtoB.updateOptions({ enableScroll: newValue });
        synchronizerRef.current.syncBtoA.updateOptions({ enableScroll: newValue });
      } else {
        console.warn('⚠️ synchronizerRef.current is null');
      }
      return newValue;
    });
  }, [setSyncScroll, synchronizerRef]);

  const handleSyncZoomToggle = useCallback(() => {
    setSyncZoom((prev: boolean) => {
      const newValue = !prev;
      if (synchronizerRef.current) {
        synchronizerRef.current.syncAtoB.updateOptions({ enableZoom: newValue });
        synchronizerRef.current.syncBtoA.updateOptions({ enableZoom: newValue });
      }
      return newValue;
    });
  }, [setSyncZoom, synchronizerRef]);

  const handleSyncWindowLevelToggle = useCallback(() => {
    setSyncWindowLevel((prev: boolean) => {
      const newValue = !prev;
      if (synchronizerRef.current) {
        synchronizerRef.current.syncAtoB.updateOptions({ enableWindowLevel: newValue });
        synchronizerRef.current.syncBtoA.updateOptions({ enableWindowLevel: newValue });
      }
      return newValue;
    });
  }, [setSyncWindowLevel, synchronizerRef]);

  const handleSyncToolsToggle = useCallback(() => {
    setSyncTools((prev: boolean) => {
      const newValue = !prev;
      log.info('🔧 Toggle sync tools:', { from: prev, to: newValue });
      return newValue;
    });
  }, [setSyncTools]);

  return {
    handleSyncScrollToggle,
    handleSyncZoomToggle,
    handleSyncWindowLevelToggle,
    handleSyncToolsToggle,
  };
};
