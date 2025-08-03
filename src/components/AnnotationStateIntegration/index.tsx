/**
 * Annotation State Integration Component
 * Integrates annotation highlighting with application state management
 * Task 34.5: Integrate with Application State
 */

import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { cn } from '../../lib/utils';
import { AnnotationSelectionHandler } from '../../services/AnnotationSelectionHandler';
import { HighlightStateManager, HighlightState } from '../../services/HighlightStateManager';
import { AnnotationCompat } from '../../types/annotation-compat';
import { log } from '../../utils/logger';

export interface AnnotationStateIntegrationProps {
  /** Current viewport ID */
  viewportId: string;

  /** Available annotations */
  annotations: AnnotationCompat[];

  /** Selection handler instance */
  selectionHandler: AnnotationSelectionHandler;

  /** Highlight state manager instance */
  highlightStateManager: HighlightStateManager;

  /** Currently selected annotation IDs */
  selectedAnnotationIds?: string[];

  /** Callback when annotation selection changes */
  onSelectionChange?: (selectedIds: string[]) => void;

  /** Callback when highlight state changes */
  onHighlightStateChange?: (highlightStates: HighlightState[]) => void;

  /** Integration settings */
  settings?: {
    autoHighlightSelected: boolean;
    syncWithSelection: boolean;
    enableAnimations: boolean;
    persistState: boolean;
  };

  /** Additional CSS classes */
  className?: string;

  /** Disabled state */
  disabled?: boolean;
}

interface IntegrationState {
  activeHighlights: Map<string, string>; // annotationId -> highlightStateId
  selectionHistory: string[];
  isProcessing: boolean;
  lastUpdate: number;
}

const DEFAULT_INTEGRATION_SETTINGS = {
  autoHighlightSelected: true,
  syncWithSelection: true,
  enableAnimations: true,
  persistState: false,
} as const;

export const AnnotationStateIntegration: React.FC<AnnotationStateIntegrationProps> = ({
  viewportId,
  annotations,
  selectionHandler,
  highlightStateManager,
  selectedAnnotationIds = [],
  onSelectionChange,
  onHighlightStateChange,
  settings = DEFAULT_INTEGRATION_SETTINGS,
  className,
  disabled = false,
}) => {
  const [integrationState, setIntegrationState] = useState<IntegrationState>({
    activeHighlights: new Map(),
    selectionHistory: [],
    isProcessing: false,
    lastUpdate: Date.now(),
  });

  const [localSettings, setLocalSettings] = useState(settings);

  // Memoized statistics
  const statistics = useMemo(() => {
    const highlightStates = highlightStateManager.getViewportStates(viewportId);
    const activeStates = highlightStates.filter(s => s.state === 'active');
    const animatingStates = highlightStates.filter(s => s.animation?.isPlaying);

    return {
      totalAnnotations: annotations.length,
      selectedAnnotations: selectedAnnotationIds.length,
      highlightedAnnotations: activeStates.length,
      animatingAnnotations: animatingStates.length,
      syncStatus: localSettings.syncWithSelection ? 'enabled' : 'disabled',
    };
  }, [annotations.length, selectedAnnotationIds.length, viewportId, localSettings.syncWithSelection, highlightStateManager]);

  // Update highlights when selection changes
  useEffect(() => {
    if (!localSettings.autoHighlightSelected || disabled) return;

    const updateHighlights = async () => {
      setIntegrationState(prev => ({ ...prev, isProcessing: true }));

      try {
        const newActiveHighlights = new Map(integrationState.activeHighlights);

        // Remove highlights for unselected annotations
        for (const [annotationId, highlightStateId] of newActiveHighlights.entries()) {
          if (!selectedAnnotationIds.includes(annotationId)) {
            highlightStateManager.deactivateState(highlightStateId);
            newActiveHighlights.delete(annotationId);

            log.info('Highlight deactivated for unselected annotation', {
              component: 'AnnotationStateIntegration',
              metadata: { annotationId, highlightStateId, viewportId },
            });
          }
        }

        // Add highlights for newly selected annotations
        for (const annotationId of selectedAnnotationIds) {
          if (!newActiveHighlights.has(annotationId)) {
            const annotation = annotations.find(a => a.id === annotationId);
            if (annotation) {
              const highlightStateId = highlightStateManager.createHighlightState(
                annotationId,
                viewportId,
                {
                  color: '#87CEEB', // Sky blue
                  pulseEnabled: localSettings.enableAnimations,
                },
              );

              const success = highlightStateManager.activateState(
                highlightStateId,
                localSettings.enableAnimations ? { type: 'pulse', duration: 2000 } : undefined,
              );

              if (success) {
                newActiveHighlights.set(annotationId, highlightStateId);

                log.info('Highlight activated for selected annotation', {
                  component: 'AnnotationStateIntegration',
                  metadata: { annotationId, highlightStateId, viewportId },
                });
              }
            }
          }
        }

        setIntegrationState(prev => ({
          ...prev,
          activeHighlights: newActiveHighlights,
          selectionHistory: [...selectedAnnotationIds].slice(-10), // Keep last 10
          lastUpdate: Date.now(),
          isProcessing: false,
        }));

        // Notify parent of highlight state changes
        if (onHighlightStateChange) {
          const allHighlightStates = highlightStateManager.getViewportStates(viewportId);
          onHighlightStateChange(allHighlightStates);
        }

      } catch (error) {
        log.error('Failed to update highlights', {
          component: 'AnnotationStateIntegration',
          metadata: { viewportId },
        }, error as Error);

        setIntegrationState(prev => ({ ...prev, isProcessing: false }));
      }
    };

    updateHighlights();
  }, [
    selectedAnnotationIds,
    annotations,
    viewportId,
    localSettings.autoHighlightSelected,
    localSettings.enableAnimations,
    disabled,
    highlightStateManager,
    integrationState.activeHighlights,
    onHighlightStateChange,
  ]);

  // Handle selection changes from highlight manager
  useEffect(() => {
    if (!localSettings.syncWithSelection || disabled) return;

    const handleSelectionChange = (selectedIds: string[], viewportIdFromEvent: string) => {
      if (viewportIdFromEvent !== viewportId) return;

      if (onSelectionChange) {
        onSelectionChange(selectedIds);
      }

      log.info('Selection synchronized from highlight manager', {
        component: 'AnnotationStateIntegration',
        metadata: { selectedIds, viewportId },
      });
    };

    // Listen for selection events from selection handler
    selectionHandler.on('selection-changed', handleSelectionChange);

    return () => {
      selectionHandler.off('selection-changed', handleSelectionChange);
    };
  }, [localSettings.syncWithSelection, viewportId, onSelectionChange, disabled, selectionHandler]);

  // Handle setting changes
  const handleSettingChange = useCallback((setting: keyof typeof localSettings, value: boolean) => {
    setLocalSettings(prev => ({ ...prev, [setting]: value }));

    log.info('Integration setting changed', {
      component: 'AnnotationStateIntegration',
      metadata: { setting, value, viewportId },
    });
  }, [viewportId]);

  // Clear all highlights
  const handleClearHighlights = useCallback(() => {
    const cleared = highlightStateManager.clearViewportStates(viewportId);

    setIntegrationState(prev => ({
      ...prev,
      activeHighlights: new Map(),
      lastUpdate: Date.now(),
    }));

    log.info('All highlights cleared', {
      component: 'AnnotationStateIntegration',
      metadata: { cleared, viewportId },
    });
  }, [highlightStateManager, viewportId]);

  // Refresh integration state
  const handleRefresh = useCallback(() => {
    // Force re-sync by clearing and rebuilding highlights
    handleClearHighlights();

    // Trigger re-highlight of selected annotations
    setIntegrationState(prev => ({
      ...prev,
      lastUpdate: Date.now(),
    }));

    log.info('Integration state refreshed', {
      component: 'AnnotationStateIntegration',
      metadata: { viewportId },
    });
  }, [handleClearHighlights, viewportId]);

  // Status badge color
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'enabled': return 'default';
      case 'disabled': return 'secondary';
      case 'processing': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <Card className={cn('w-full max-w-md', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Annotation State Integration</CardTitle>
          <Badge variant="outline" className="text-xs">
            {viewportId}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Statistics */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-1">
            <div className="text-muted-foreground">Total Annotations</div>
            <div className="font-medium">{statistics.totalAnnotations}</div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">Selected</div>
            <div className="font-medium text-blue-600">{statistics.selectedAnnotations}</div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">Highlighted</div>
            <div className="font-medium text-sky-600">{statistics.highlightedAnnotations}</div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">Animating</div>
            <div className="font-medium text-purple-600">{statistics.animatingAnnotations}</div>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Sync Status</span>
          <div className="flex items-center gap-2">
            <Badge
              variant={getStatusBadgeVariant(statistics.syncStatus)}
              className="text-xs"
            >
              {statistics.syncStatus}
            </Badge>
            {integrationState.isProcessing && (
              <Badge variant={getStatusBadgeVariant('processing')} className="text-xs">
                Processing...
              </Badge>
            )}
          </div>
        </div>

        {/* Settings */}
        <div className="space-y-3">
          <div className="text-sm font-medium">Settings</div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground">
                Auto-highlight Selected
              </label>
              <Switch
                checked={localSettings.autoHighlightSelected}
                onCheckedChange={(checked) => handleSettingChange('autoHighlightSelected', checked)}
                disabled={disabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground">
                Sync with Selection
              </label>
              <Switch
                checked={localSettings.syncWithSelection}
                onCheckedChange={(checked) => handleSettingChange('syncWithSelection', checked)}
                disabled={disabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground">
                Enable Animations
              </label>
              <Switch
                checked={localSettings.enableAnimations}
                onCheckedChange={(checked) => handleSettingChange('enableAnimations', checked)}
                disabled={disabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground">
                Persist State
              </label>
              <Switch
                checked={localSettings.persistState}
                onCheckedChange={(checked) => handleSettingChange('persistState', checked)}
                disabled={disabled}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearHighlights}
            disabled={disabled || statistics.highlightedAnnotations === 0}
            className="flex-1"
          >
            Clear Highlights
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={disabled || integrationState.isProcessing}
            className="flex-1"
          >
            Refresh
          </Button>
        </div>

        {/* Selection History */}
        {integrationState.selectionHistory.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Recent Selections</div>
            <div className="flex flex-wrap gap-1">
              {integrationState.selectionHistory.slice(-5).map(annotationId => (
                <Badge
                  key={annotationId}
                  variant="secondary"
                  className="text-xs"
                >
                  {annotationId.split('-').pop()}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Debug Info */}
        <div className="text-xs text-muted-foreground border-t pt-2">
          Last Update: {new Date(integrationState.lastUpdate).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
};

export default AnnotationStateIntegration;
