/**
 * Selection API Demo Component
 * Demonstrates usage of the Selection API with shadcn/ui components
 * Built with shadcn/ui components
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../../lib/utils';
import { selectionAPI, SelectionStatistics } from '../../services/SelectionAPI';
import { AnnotationCompat } from '../../types/annotation-compat';
import {
  MousePointer,
  Square,
  Circle,
  Undo,
  Trash2,
  Save,
  Upload,
  BarChart3,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface SelectionAPIDemoProps {
  viewportId?: string;
  className?: string;
}

// Mock annotation data for demo
const MOCK_ANNOTATIONS: AnnotationCompat[] = Array.from({ length: 20 }, (_, i) => ({
  annotationUID: `annotation-${i + 1}`,
  uid: `annotation-${i + 1}`,
  id: `annotation-${i + 1}`,
  annotationId: `annotation-${i + 1}`,
  metadata: {
    toolName: i % 3 === 0 ? 'Length' : i % 3 === 1 ? 'Angle' : 'Rectangle',
    viewPlaneNormal: [0, 0, 1],
    FrameOfReferenceUID: 'test',
  },
  data: {
    handles: {
      points: [[0, 0], [100, 100]],
    },
  },
}));

export const SelectionAPIDemo: React.FC<SelectionAPIDemoProps> = ({
  viewportId = 'demo-viewport',
  className,
}) => {
  // State management
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkProgress, setBulkProgress] = useState<{ completed: number; total: number } | null>(null);
  const [statistics, setStatistics] = useState<SelectionStatistics | null>(null);
  const [savedState, setSavedState] = useState<string>('');
  const [customAnnotationId, setCustomAnnotationId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Clear messages after delay
  const clearMessage = useCallback((type: 'error' | 'success') => {
    setTimeout(() => {
      if (type === 'error') setError('');
      else setSuccess('');
    }, 3000);
  }, []);

  // Setup event listeners
  useEffect(() => {
    const handleSelectionChange = (ids: string[], vId: string) => {
      if (vId === viewportId) {
        setSelectedIds(ids);
        setStatistics(selectionAPI.getStatistics());
      }
    };

    const handleBulkProgress = (completed: number, total: number) => {
      setBulkProgress({ completed, total });
      if (completed === total) {
        setTimeout(() => setBulkProgress(null), 1000);
      }
    };

    const handleError = (err: Error) => {
      setError(err.message);
      clearMessage('error');
      setIsLoading(false);
    };

    const handleAnnotationSelected = (annotation: AnnotationCompat, vId: string) => {
      if (vId === viewportId) {
        setSuccess(`Selected: ${annotation.annotationId}`);
        clearMessage('success');
      }
    };

    // Register event listeners
    selectionAPI.on('selection-changed', handleSelectionChange);
    selectionAPI.on('bulk-operation-progress', handleBulkProgress);
    selectionAPI.on('error', handleError);
    selectionAPI.on('annotation-selected', handleAnnotationSelected);

    // Initial statistics
    setStatistics(selectionAPI.getStatistics());

    return () => {
      selectionAPI.off('selection-changed', handleSelectionChange);
      selectionAPI.off('bulk-operation-progress', handleBulkProgress);
      selectionAPI.off('error', handleError);
      selectionAPI.off('annotation-selected', handleAnnotationSelected);
    };
  }, [viewportId, clearMessage]);

  // API operation handlers
  const handleSelectAnnotation = async (annotationId: string) => {
    setIsLoading(true);
    try {
      await selectionAPI.selectAnnotation(annotationId, viewportId, {
        preserveExisting: true,
        validateAnnotation: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeselectAnnotation = async (annotationId: string) => {
    setIsLoading(true);
    try {
      await selectionAPI.deselectAnnotation(annotationId, viewportId);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = async () => {
    setIsLoading(true);
    try {
      const allIds = MOCK_ANNOTATIONS.map(ann => ann.annotationId!);
      await selectionAPI.selectMultipleAnnotations(allIds, viewportId, {
        batchSize: 5,
        delayBetweenBatches: 100,
        preserveExisting: false,
      });
      setSuccess(`Selected ${allIds.length} annotations`);
      clearMessage('success');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeselectAll = async () => {
    setIsLoading(true);
    try {
      await selectionAPI.selectMultipleAnnotations(selectedIds, viewportId, {
        preserveExisting: false,
      });
      setSuccess('Deselected all annotations');
      clearMessage('success');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearSelection = () => {
    selectionAPI.clearSelection(viewportId);
    setSuccess('Selection cleared');
    clearMessage('success');
  };

  const handleUndo = () => {
    const success = selectionAPI.undoLastSelection(viewportId);
    if (success) {
      setSuccess('Last operation undone');
      clearMessage('success');
    } else {
      setError('Nothing to undo');
      clearMessage('error');
    }
  };

  const handleSaveState = () => {
    const state = selectionAPI.saveSelectionState(viewportId);
    if (state) {
      setSavedState(state);
      setSuccess('Selection state saved');
      clearMessage('success');
    } else {
      setError('Failed to save state');
      clearMessage('error');
    }
  };

  const handleRestoreState = () => {
    if (!savedState) {
      setError('No saved state available');
      clearMessage('error');
      return;
    }

    const success = selectionAPI.restoreSelectionState(viewportId, savedState);
    if (success) {
      setSuccess('Selection state restored');
      clearMessage('success');
    } else {
      setError('Failed to restore state');
      clearMessage('error');
    }
  };

  const handleSelectCustom = async () => {
    if (!customAnnotationId.trim()) {
      setError('Please enter an annotation ID');
      clearMessage('error');
      return;
    }

    setIsLoading(true);
    try {
      await selectionAPI.selectAnnotation(customAnnotationId.trim(), viewportId, {
        preserveExisting: true,
      });
      setCustomAnnotationId('');
    } finally {
      setIsLoading(false);
    }
  };

  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case 'Length': return <MousePointer className={cn('w-4 h-4')} />;
      case 'Rectangle': return <Square className={cn('w-4 h-4')} />;
      case 'Angle': return <Circle className={cn('w-4 h-4')} />;
      default: return <MousePointer className={cn('w-4 h-4')} />;
    }
  };

  const getToolColor = (toolName: string) => {
    switch (toolName) {
      case 'Length': return 'bg-blue-100 text-blue-800';
      case 'Rectangle': return 'bg-green-100 text-green-800';
      case 'Angle': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className={cn('flex items-center gap-2')}>
            <BarChart3 className={cn('w-5 h-5')} />
            Selection API Demo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn('grid grid-cols-1 md:grid-cols-3 gap-4')}>
            <div className={cn('text-center')}>
              <div className={cn('text-2xl font-bold text-primary')}>{selectedIds.length}</div>
              <div className={cn('text-sm text-muted-foreground')}>Selected</div>
            </div>
            <div className={cn('text-center')}>
              <div className={cn('text-2xl font-bold text-primary')}>{MOCK_ANNOTATIONS.length}</div>
              <div className={cn('text-sm text-muted-foreground')}>Total</div>
            </div>
            <div className={cn('text-center')}>
              <div className={cn('text-2xl font-bold text-primary')}>
                {statistics?.historyEntries || 0}
              </div>
              <div className={cn('text-sm text-muted-foreground')}>History</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className={cn('h-4 w-4')} />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle2 className={cn('h-4 w-4')} />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Progress indicator */}
      {bulkProgress && (
        <Card>
          <CardContent className={cn('p-4')}>
            <div className={cn('space-y-2')}>
              <div className={cn('flex justify-between text-sm')}>
                <span>Bulk operation progress</span>
                <span>{bulkProgress.completed}/{bulkProgress.total}</span>
              </div>
              <Progress
                value={(bulkProgress.completed / bulkProgress.total) * 100}
                className={cn('w-full')}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main content tabs */}
      <Tabs defaultValue="operations" className={cn('w-full')}>
        <TabsList className={cn('grid w-full grid-cols-4')}>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="annotations">Annotations</TabsTrigger>
          <TabsTrigger value="state">State</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
        </TabsList>

        {/* Operations Tab */}
        <TabsContent value="operations" className={cn('space-y-4')}>
          <Card>
            <CardHeader>
              <CardTitle>Basic Operations</CardTitle>
            </CardHeader>
            <CardContent className={cn('space-y-4')}>
              <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-2')}>
                <Button
                  onClick={handleSelectAll}
                  disabled={isLoading}
                  className={cn('w-full')}
                >
                  Select All
                </Button>
                <Button
                  onClick={handleDeselectAll}
                  disabled={isLoading || selectedIds.length === 0}
                  variant="outline"
                  className={cn('w-full')}
                >
                  Deselect All
                </Button>
                <Button
                  onClick={handleClearSelection}
                  disabled={selectedIds.length === 0}
                  variant="outline"
                  className={cn('w-full')}
                >
                  <Trash2 className={cn('w-4 h-4 mr-2')} />
                  Clear
                </Button>
                <Button
                  onClick={handleUndo}
                  variant="outline"
                  className={cn('w-full')}
                >
                  <Undo className={cn('w-4 h-4 mr-2')} />
                  Undo
                </Button>
              </div>

              <Separator />

              <div className={cn('space-y-2')}>
                <Label htmlFor="custom-annotation">Select Custom Annotation</Label>
                <div className={cn('flex gap-2')}>
                  <Input
                    id="custom-annotation"
                    placeholder="Enter annotation ID (e.g. annotation-5)"
                    value={customAnnotationId}
                    onChange={(e) => setCustomAnnotationId(e.target.value)}
                    disabled={isLoading}
                  />
                  <Button
                    onClick={handleSelectCustom}
                    disabled={isLoading || !customAnnotationId.trim()}
                  >
                    Select
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Annotations Tab */}
        <TabsContent value="annotations" className={cn('space-y-4')}>
          <Card>
            <CardHeader>
              <CardTitle>Available Annotations</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className={cn('h-96')}>
                <div className={cn('space-y-2')}>
                  {MOCK_ANNOTATIONS.map((annotation) => {
                    const isSelected = selectedIds.includes(annotation.annotationId!);
                    const toolName = annotation.metadata?.toolName || 'Unknown';

                    return (
                      <div
                        key={annotation.annotationId}
                        className={cn(
                          'flex items-center justify-between p-3 border rounded-lg',
                          isSelected && 'bg-primary/5 border-primary',
                        )}
                      >
                        <div className={cn('flex items-center gap-3')}>
                          {getToolIcon(toolName)}
                          <div>
                            <div className={cn('font-medium')}>{annotation.annotationId}</div>
                            <Badge
                              variant="outline"
                              className={cn('text-xs', getToolColor(toolName))}
                            >
                              {toolName}
                            </Badge>
                          </div>
                        </div>

                        <div className={cn('flex gap-2')}>
                          {isSelected ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeselectAnnotation(annotation.annotationId!)}
                              disabled={isLoading}
                            >
                              Deselect
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleSelectAnnotation(annotation.annotationId!)}
                              disabled={isLoading}
                            >
                              Select
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* State Management Tab */}
        <TabsContent value="state" className={cn('space-y-4')}>
          <Card>
            <CardHeader>
              <CardTitle>State Management</CardTitle>
            </CardHeader>
            <CardContent className={cn('space-y-4')}>
              <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-4')}>
                <Button
                  onClick={handleSaveState}
                  disabled={selectedIds.length === 0}
                  className={cn('w-full')}
                >
                  <Save className={cn('w-4 h-4 mr-2')} />
                  Save Current State
                </Button>
                <Button
                  onClick={handleRestoreState}
                  disabled={!savedState}
                  variant="outline"
                  className={cn('w-full')}
                >
                  <Upload className={cn('w-4 h-4 mr-2')} />
                  Restore Saved State
                </Button>
              </div>

              {savedState && (
                <div className={cn('space-y-2')}>
                  <Label>Saved State (JSON)</Label>
                  <ScrollArea className={cn('h-32')}>
                    <pre className={cn('text-xs bg-muted p-2 rounded')}>
                      {JSON.stringify(JSON.parse(savedState), null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="statistics" className={cn('space-y-4')}>
          <Card>
            <CardHeader>
              <CardTitle>Selection Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              {statistics && (
                <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-4')}>
                  <div className={cn('space-y-2')}>
                    <div className={cn('flex justify-between')}>
                      <span className={cn('text-muted-foreground')}>Total Viewports:</span>
                      <span className={cn('font-medium')}>{statistics.totalViewports}</span>
                    </div>
                    <div className={cn('flex justify-between')}>
                      <span className={cn('text-muted-foreground')}>Active Viewports:</span>
                      <span className={cn('font-medium')}>{statistics.activeViewports}</span>
                    </div>
                    <div className={cn('flex justify-between')}>
                      <span className={cn('text-muted-foreground')}>Total Selections:</span>
                      <span className={cn('font-medium')}>{statistics.totalSelections}</span>
                    </div>
                    <div className={cn('flex justify-between')}>
                      <span className={cn('text-muted-foreground')}>History Entries:</span>
                      <span className={cn('font-medium')}>{statistics.historyEntries}</span>
                    </div>
                  </div>

                  <div className={cn('space-y-2')}>
                    <div className={cn('text-sm font-medium')}>Selections by Viewport</div>
                    {Object.entries(statistics.selectionsByViewport).map(([vId, count]) => (
                      <div key={vId} className={cn('flex justify-between text-sm')}>
                        <span className={cn('text-muted-foreground truncate')}>{vId}:</span>
                        <span className={cn('font-medium')}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
