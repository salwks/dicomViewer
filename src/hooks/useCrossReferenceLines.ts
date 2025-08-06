/**
 * Cross-Reference Lines Hook
 * React hook for managing cross-reference lines with viewport synchronization
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { viewportSynchronizer } from '../services/ViewportSynchronizer';
import { CrossReferenceLine, CrossReferencePoint } from '../components/CrossReferenceLines/index';
import { CrossReferenceSettings } from '../types/dicom';
import { log } from '../utils/logger';

export interface CrossReferenceHookProps {
  viewportId: string;
  enabled?: boolean;
  autoUpdate?: boolean;
}

export interface CrossReferenceHookReturn {
  // State
  lines: CrossReferenceLine[];
  settings: CrossReferenceSettings;
  isEnabled: boolean;

  // Controls
  enableCrossReference: () => void;
  disableCrossReference: () => void;
  updateSettings: (settings: Partial<CrossReferenceSettings>) => void;

  // Line management
  addLine: (line: Omit<CrossReferenceLine, 'id'>) => string;
  removeLine: (lineId: string) => void;
  updateLine: (lineId: string, updates: Partial<CrossReferenceLine>) => void;
  clearLines: () => void;

  // Calculations
  calculateCrossReferencePoint: (
    sourceViewportId: string,
    targetViewportId: string,
    sourcePoint?: { x: number; y: number }
  ) => CrossReferencePoint | null;

  // Synchronization
  syncWithViewports: (viewportIds: string[]) => void;
  updateFromSynchronizer: () => void;
}

export const useCrossReferenceLines = ({
  viewportId,
  enabled = false,
  autoUpdate = true,
}: CrossReferenceHookProps): CrossReferenceHookReturn => {
  const [lines, setLines] = useState<CrossReferenceLine[]>([]);
  const [settings, setSettings] = useState<CrossReferenceSettings>(viewportSynchronizer.getCrossReferenceSettings());
  const [isEnabled, setIsEnabled] = useState(enabled);

  // Sync with global settings
  useEffect(() => {
    const handleSettingsUpdate = ({ current }: { current: CrossReferenceSettings }) => {
      setSettings(current);
      setIsEnabled(current.enabled);
    };

    const handleCrossReferenceEnabled = (data: { viewportId?: string; global?: boolean }) => {
      if (data.global || data.viewportId === viewportId) {
        setIsEnabled(true);
      }
    };

    const handleCrossReferenceDisabled = () => {
      setIsEnabled(false);
      setLines([]); // Clear lines when disabled
    };

    // Subscribe to synchronizer events
    viewportSynchronizer.on('crossReferenceSettingsUpdated', handleSettingsUpdate);
    viewportSynchronizer.on('crossReferenceEnabled', handleCrossReferenceEnabled);
    viewportSynchronizer.on('crossReferenceDisabled', handleCrossReferenceDisabled);

    // Initial sync
    const currentSettings = viewportSynchronizer.getCrossReferenceSettings();
    setSettings(currentSettings);
    setIsEnabled(currentSettings.enabled);

    return () => {
      viewportSynchronizer.off('crossReferenceSettingsUpdated', handleSettingsUpdate);
      viewportSynchronizer.off('crossReferenceEnabled', handleCrossReferenceEnabled);
      viewportSynchronizer.off('crossReferenceDisabled', handleCrossReferenceDisabled);
    };
  }, [viewportId]);

  // Auto-update lines when viewport states change
  useEffect(() => {
    if (!autoUpdate || !isEnabled) return;

    const updateFromSynchronizerInternal = () => {
      const allViewportStates = viewportSynchronizer.getAllViewportStates();
      const otherViewports = Array.from(allViewportStates.keys()).filter(id => id !== viewportId);

      if (otherViewports.length > 0) {
        // Inline the sync logic to avoid circular dependencies
        const newLines: CrossReferenceLine[] = [];

        otherViewports.forEach(targetId => {
          if (targetId === viewportId) return;

          try {
            const sourceState = viewportSynchronizer.getViewportState(viewportId);
            const targetState = viewportSynchronizer.getViewportState(targetId);

            if (sourceState && targetState) {
              const lineId = `sync-${viewportId}-${targetId}`;
              const lineColor = targetState?.orientation === 'AXIAL' ? settings.color :
                targetState?.orientation === 'SAGITTAL' ? '#22c55e' :
                  targetState?.orientation === 'CORONAL' ? '#3b82f6' : settings.color;

              newLines.push({
                id: lineId,
                sourcePoint: { x: 256, y: 256, viewportId },
                targetPoint: { x: 256, y: 256, viewportId: targetId },
                color: lineColor,
                visible: true,
                label: `${viewportId} ↔ ${targetId}`,
              });
            }
          } catch (error) {
            log.error('Failed to create cross-reference line', {
              component: 'useCrossReferenceLines',
              metadata: { viewportId, targetId, error: error instanceof Error ? error.message : 'Unknown error' },
            });
          }
        });

        setLines(prev => {
          // Remove existing sync lines
          const filtered = prev.filter(line => !line.id.startsWith('sync-'));
          return [...filtered, ...newLines];
        });
      }
    };

    const handleViewportStateUpdate = () => {
      updateFromSynchronizerInternal();
    };

    const handleSynchronizationApplied = () => {
      updateFromSynchronizerInternal();
    };

    viewportSynchronizer.on('viewportStateUpdated', handleViewportStateUpdate);
    viewportSynchronizer.on('synchronizationApplied', handleSynchronizationApplied);

    return () => {
      viewportSynchronizer.off('viewportStateUpdated', handleViewportStateUpdate);
      viewportSynchronizer.off('synchronizationApplied', handleSynchronizationApplied);
    };
  }, [autoUpdate, isEnabled, viewportId, settings.color]);

  // Enable cross-reference
  const enableCrossReference = useCallback(() => {
    viewportSynchronizer.enableCrossReference(viewportId);
    setIsEnabled(true);

    log.info('Cross-reference enabled', {
      component: 'useCrossReferenceLines',
      metadata: { viewportId },
    });
  }, [viewportId]);

  // Disable cross-reference
  const disableCrossReference = useCallback(() => {
    viewportSynchronizer.disableCrossReference();
    setIsEnabled(false);
    setLines([]);

    log.info('Cross-reference disabled', {
      component: 'useCrossReferenceLines',
      metadata: { viewportId },
    });
  }, [viewportId]);

  // Update settings
  const updateSettings = useCallback(
    (newSettings: Partial<CrossReferenceSettings>) => {
      viewportSynchronizer.updateCrossReferenceSettings(newSettings);

      log.info('Cross-reference settings updated', {
        component: 'useCrossReferenceLines',
        metadata: { viewportId, settings: newSettings },
      });
    },
    [viewportId],
  );

  // Add line
  const addLine = useCallback(
    (lineData: Omit<CrossReferenceLine, 'id'>): string => {
      const lineId = `cross-ref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newLine: CrossReferenceLine = {
        ...lineData,
        id: lineId,
      };

      setLines(prev => [...prev, newLine]);

      log.info('Cross-reference line added', {
        component: 'useCrossReferenceLines',
        metadata: { viewportId, lineId },
      });

      return lineId;
    },
    [viewportId],
  );

  // Remove line
  const removeLine = useCallback(
    (lineId: string) => {
      setLines(prev => prev.filter(line => line.id !== lineId));

      log.info('Cross-reference line removed', {
        component: 'useCrossReferenceLines',
        metadata: { viewportId, lineId },
      });
    },
    [viewportId],
  );

  // Update line
  const updateLine = useCallback(
    (lineId: string, updates: Partial<CrossReferenceLine>) => {
      setLines(prev => prev.map(line => (line.id === lineId ? { ...line, ...updates } : line)));

      log.info('Cross-reference line updated', {
        component: 'useCrossReferenceLines',
        metadata: { viewportId, lineId, updates },
      });
    },
    [viewportId],
  );

  // Clear all lines
  const clearLines = useCallback(() => {
    setLines([]);

    log.info('Cross-reference lines cleared', {
      component: 'useCrossReferenceLines',
      metadata: { viewportId },
    });
  }, [viewportId]);

  // Calculate cross-reference point
  const calculateCrossReferencePoint = useCallback(
    (
      sourceViewportId: string,
      targetViewportId: string,
      sourcePoint?: { x: number; y: number },
    ): CrossReferencePoint | null => {
      try {
        const sourceState = viewportSynchronizer.getViewportState(sourceViewportId);
        const targetState = viewportSynchronizer.getViewportState(targetViewportId);

        if (!sourceState || !targetState) {
          log.warn('Cannot calculate cross-reference point - viewport states not available', {
            component: 'useCrossReferenceLines',
            metadata: { sourceViewportId, targetViewportId },
          });
          return null;
        }

        // Simple calculation based on viewport states
        // In a real implementation, this would use proper coordinate transformation
        const point: CrossReferencePoint = {
          x: sourcePoint?.x || 256, // Default center X
          y: sourcePoint?.y || 256, // Default center Y
          viewportId: targetViewportId,
        };

        log.info('Cross-reference point calculated', {
          component: 'useCrossReferenceLines',
          metadata: { sourceViewportId, targetViewportId, point },
        });

        return point;
      } catch (error) {
        log.error('Failed to calculate cross-reference point', {
          component: 'useCrossReferenceLines',
          metadata: {
            sourceViewportId,
            targetViewportId,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
        return null;
      }
    },
    [],
  );

  // Sync with other viewports
  const syncWithViewports = useCallback(
    (targetViewportIds: string[]) => {
      if (!isEnabled) return;

      const newLines: CrossReferenceLine[] = [];

      targetViewportIds.forEach(targetId => {
        if (targetId === viewportId) return;

        const sourcePoint = calculateCrossReferencePoint(viewportId, targetId);
        const targetPoint = calculateCrossReferencePoint(targetId, viewportId);

        if (sourcePoint && targetPoint) {
          const lineId = `sync-${viewportId}-${targetId}`;

          // Use target viewport state to determine line color
          const targetState = viewportSynchronizer.getViewportState(targetId);
          const lineColor =
            targetState?.orientation === 'AXIAL'
              ? settings.color
              : targetState?.orientation === 'SAGITTAL'
                ? '#22c55e'
                : targetState?.orientation === 'CORONAL'
                  ? '#3b82f6'
                  : settings.color;

          newLines.push({
            id: lineId,
            sourcePoint: { ...sourcePoint, viewportId },
            targetPoint: { ...targetPoint, viewportId: targetId },
            color: lineColor,
            visible: true,
            label: `${viewportId} ↔ ${targetId}`,
          });
        }
      });

      setLines(prev => {
        // Remove existing sync lines
        const filtered = prev.filter(line => !line.id.startsWith('sync-'));
        return [...filtered, ...newLines];
      });

      log.info('Cross-reference lines synced with viewports', {
        component: 'useCrossReferenceLines',
        metadata: { viewportId, targetViewportIds, newLinesCount: newLines.length },
      });
    },
    [viewportId, isEnabled, settings.color, calculateCrossReferencePoint],
  );

  // Update from synchronizer state
  const updateFromSynchronizer = useCallback(() => {
    if (!isEnabled || !autoUpdate) return;

    const allViewportStates = viewportSynchronizer.getAllViewportStates();
    const otherViewports = Array.from(allViewportStates.keys()).filter(id => id !== viewportId);

    if (otherViewports.length > 0) {
      syncWithViewports(otherViewports);
    }
  }, [viewportId, isEnabled, autoUpdate, syncWithViewports]);

  // Filtered lines for current viewport
  const viewportLines = useMemo(() => {
    return lines.filter(
      line => line.sourcePoint.viewportId === viewportId || line.targetPoint.viewportId === viewportId,
    );
  }, [lines, viewportId]);

  return {
    // State
    lines: viewportLines,
    settings,
    isEnabled,

    // Controls
    enableCrossReference,
    disableCrossReference,
    updateSettings,

    // Line management
    addLine,
    removeLine,
    updateLine,
    clearLines,

    // Calculations
    calculateCrossReferencePoint,

    // Synchronization
    syncWithViewports,
    updateFromSynchronizer,
  };
};
