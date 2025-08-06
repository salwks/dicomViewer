/**
 * Selection API Integration Component
 * Public API integration example for external systems
 * Built with shadcn/ui components
 */

import React, { useEffect, useState, useCallback } from 'react';
import { log } from '../utils/logger';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { cn } from '../lib/utils';
import { selectionAPI, type SelectionStatistics } from '../services';
import { AnnotationCompat } from '../types/annotation-compat';
import { CheckCircle2, AlertCircle, MousePointer, Square } from 'lucide-react';

interface SelectionAPIIntegrationProps {
  viewportId: string;
  className?: string;
  onSelectionChange?: (selectedIds: string[], viewportId: string) => void;
  onAnnotationSelected?: (annotationId: string, viewportId: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Selection API Integration Component
 *
 * This component demonstrates how to integrate the Selection API with external systems.
 * It provides a public interface that external applications can use to:
 *
 * 1. Monitor selection changes
 * 2. Programmatically select/deselect annotations
 * 3. Bulk select operations
 * 4. Access selection statistics
 * 5. Handle selection errors
 *
 * Usage Example:
 * ```tsx
 * <SelectionAPIIntegration
 *   viewportId="main-viewport"
 *   onSelectionChange={(ids, viewportId) => {
 *     log.info('Selection changed:', ids);
 *     updateExternalState(ids);
 *   }}
 *   onAnnotationSelected={(id, viewportId) => {
 *     log.info('Annotation selected:', id);
 *     highlightInExternalUI(id);
 *   }}
 *   onError={(error) => {
 *     console.error('Selection error:', error);
 *     showErrorNotification(error.message);
 *   }}
 * />
 * ```
 */
export const SelectionAPIIntegration: React.FC<SelectionAPIIntegrationProps> = ({
  viewportId,
  className,
  onSelectionChange,
  onAnnotationSelected,
  onError,
}) => {
  // Component state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statistics, setStatistics] = useState<SelectionStatistics | null>(null);
  const [customAnnotationId, setCustomAnnotationId] = useState<string>('');
  const [bulkAnnotationIds, setBulkAnnotationIds] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Clear message after delay
  const clearMessage = useCallback(() => {
    setTimeout(() => setMessage(null), 3000);
  }, []);

  // Show message helper
  const showMessage = useCallback(
    (type: 'success' | 'error', text: string) => {
      setMessage({ type, text });
      clearMessage();
    },
    [clearMessage],
  );

  // Setup Selection API event listeners
  useEffect(() => {
    const handleSelectionChanged = (ids: string[], eventViewportId: string) => {
      if (eventViewportId === viewportId) {
        setSelectedIds(ids);
        setStatistics(selectionAPI.getStatistics());

        // Call external callback if provided
        if (onSelectionChange) {
          onSelectionChange(ids, eventViewportId);
        }
      }
    };

    const handleAnnotationSelected = (annotation: AnnotationCompat, eventViewportId: string) => {
      if (eventViewportId === viewportId) {
        const annotationId = annotation.annotationId || annotation.uid || annotation.id;
        if (annotationId && onAnnotationSelected) {
          onAnnotationSelected(annotationId, eventViewportId);
        }
      }
    };

    const handleSelectionCleared = (eventViewportId: string) => {
      if (eventViewportId === viewportId) {
        setSelectedIds([]);
        setStatistics(selectionAPI.getStatistics());
        showMessage('success', 'Selection cleared');
      }
    };

    const handleApiError = (error: Error) => {
      showMessage('error', error.message);
      if (onError) {
        onError(error);
      }
    };

    // Register event listeners
    selectionAPI.on('selection-changed', handleSelectionChanged);
    selectionAPI.on('annotation-selected', handleAnnotationSelected);
    selectionAPI.on('selection-cleared', handleSelectionCleared);
    selectionAPI.on('error', handleApiError);

    // Initialize state
    setSelectedIds(selectionAPI.getSelectedAnnotationIds(viewportId));
    setStatistics(selectionAPI.getStatistics());

    return () => {
      // Cleanup event listeners
      selectionAPI.off('selection-changed', handleSelectionChanged);
      selectionAPI.off('annotation-selected', handleAnnotationSelected);
      selectionAPI.off('selection-cleared', handleSelectionCleared);
      selectionAPI.off('error', handleApiError);
    };
  }, [viewportId, onSelectionChange, onAnnotationSelected, onError, showMessage]);

  // API operation handlers
  const handleSelectAnnotation = async () => {
    if (!customAnnotationId.trim()) {
      showMessage('error', 'Please enter an annotation ID');
      return;
    }

    setIsLoading(true);
    try {
      const success = await selectionAPI.selectAnnotation(customAnnotationId.trim(), viewportId, {
        preserveExisting: true,
        validateAnnotation: true,
      });

      if (success) {
        showMessage('success', `Selected annotation: ${customAnnotationId}`);
        setCustomAnnotationId('');
      } else {
        showMessage('error', 'Failed to select annotation');
      }
    } catch (error) {
      showMessage('error', `Selection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkSelect = async () => {
    if (!bulkAnnotationIds.trim()) {
      showMessage('error', 'Please enter annotation IDs (comma-separated)');
      return;
    }

    setIsLoading(true);
    try {
      const ids = bulkAnnotationIds
        .split(',')
        .map(id => id.trim())
        .filter(id => id);
      const result = await selectionAPI.selectMultipleAnnotations(ids, viewportId, {
        preserveExisting: false,
        batchSize: 5,
        delayBetweenBatches: 100,
      });

      showMessage('success', `Bulk selection: ${result.successful} successful, ${result.failed} failed`);
      setBulkAnnotationIds('');
    } catch (error) {
      showMessage('error', `Bulk selection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearSelection = () => {
    const success = selectionAPI.clearSelection(viewportId);
    if (success) {
      showMessage('success', 'Selection cleared');
    } else {
      showMessage('error', 'Failed to clear selection');
    }
  };

  const handleUndoSelection = () => {
    const success = selectionAPI.undoLastSelection(viewportId);
    if (success) {
      showMessage('success', 'Last selection undone');
    } else {
      showMessage('error', 'Nothing to undo');
    }
  };

  const handleSaveState = () => {
    const state = selectionAPI.saveSelectionState(viewportId);
    if (state) {
      // In a real application, you would save this to your backend or local storage
      log.info('Selection state saved:', state);
      showMessage('success', 'Selection state saved to console');
    } else {
      showMessage('error', 'Failed to save selection state');
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className={cn('flex items-center gap-2')}>
            <MousePointer className={cn('w-5 h-5')} />
            Selection API Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn('grid grid-cols-1 md:grid-cols-3 gap-4 text-center')}>
            <div>
              <div className={cn('text-2xl font-bold text-primary')}>{selectedIds.length}</div>
              <div className={cn('text-sm text-muted-foreground')}>Selected</div>
            </div>
            <div>
              <div className={cn('text-2xl font-bold text-primary')}>{statistics?.totalSelections || 0}</div>
              <div className={cn('text-sm text-muted-foreground')}>Total Selections</div>
            </div>
            <div>
              <div className={cn('text-2xl font-bold text-primary')}>{statistics?.historyEntries || 0}</div>
              <div className={cn('text-sm text-muted-foreground')}>History</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Message Display */}
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'error' ? (
            <AlertCircle className={cn('h-4 w-4')} />
          ) : (
            <CheckCircle2 className={cn('h-4 w-4')} />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Selected Annotations Display */}
      {selectedIds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Currently Selected Annotations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn('flex flex-wrap gap-2')}>
              {selectedIds.map(id => (
                <Badge key={id} variant='secondary' className={cn('flex items-center gap-1')}>
                  <Square className={cn('w-3 h-3')} />
                  {id}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Operations */}
      <Card>
        <CardHeader>
          <CardTitle>API Operations</CardTitle>
        </CardHeader>
        <CardContent className={cn('space-y-4')}>
          {/* Single Selection */}
          <div className={cn('space-y-2')}>
            <Label htmlFor='single-annotation'>Select Single Annotation</Label>
            <div className={cn('flex gap-2')}>
              <Input
                id='single-annotation'
                placeholder='Enter annotation ID (e.g., annotation-1)'
                value={customAnnotationId}
                onChange={e => setCustomAnnotationId(e.target.value)}
                disabled={isLoading}
              />
              <Button onClick={handleSelectAnnotation} disabled={isLoading || !customAnnotationId.trim()}>
                Select
              </Button>
            </div>
          </div>

          <Separator />

          {/* Bulk Selection */}
          <div className={cn('space-y-2')}>
            <Label htmlFor='bulk-annotations'>Bulk Select Annotations</Label>
            <div className={cn('flex gap-2')}>
              <Input
                id='bulk-annotations'
                placeholder='Enter annotation IDs (comma-separated)'
                value={bulkAnnotationIds}
                onChange={e => setBulkAnnotationIds(e.target.value)}
                disabled={isLoading}
              />
              <Button onClick={handleBulkSelect} disabled={isLoading || !bulkAnnotationIds.trim()}>
                Bulk Select
              </Button>
            </div>
          </div>

          <Separator />

          {/* Control Operations */}
          <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-2')}>
            <Button onClick={handleClearSelection} disabled={selectedIds.length === 0} variant='outline'>
              Clear All
            </Button>
            <Button onClick={handleUndoSelection} variant='outline'>
              Undo
            </Button>
            <Button onClick={handleSaveState} disabled={selectedIds.length === 0} variant='outline'>
              Save State
            </Button>
            <Button
              onClick={() => {
                const config = selectionAPI.getConfig();
                log.info('Selection API Config:', config);
                showMessage('success', 'Config logged to console');
              }}
              variant='outline'
            >
              Get Config
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      {statistics && (
        <Card>
          <CardHeader>
            <CardTitle>Selection Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn('grid grid-cols-2 gap-4 text-sm')}>
              <div className={cn('space-y-1')}>
                <div className={cn('flex justify-between')}>
                  <span className={cn('text-muted-foreground')}>Total Viewports:</span>
                  <span className={cn('font-medium')}>{statistics.totalViewports}</span>
                </div>
                <div className={cn('flex justify-between')}>
                  <span className={cn('text-muted-foreground')}>Active Viewports:</span>
                  <span className={cn('font-medium')}>{statistics.activeViewports}</span>
                </div>
              </div>
              <div className={cn('space-y-1')}>
                <div className={cn('flex justify-between')}>
                  <span className={cn('text-muted-foreground')}>Total Selections:</span>
                  <span className={cn('font-medium')}>{statistics.totalSelections}</span>
                </div>
                <div className={cn('flex justify-between')}>
                  <span className={cn('text-muted-foreground')}>History Entries:</span>
                  <span className={cn('font-medium')}>{statistics.historyEntries}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SelectionAPIIntegration;
