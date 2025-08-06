/**
 * Selection API Integration Example
 * Demonstrates how external systems can integrate with the Selection API
 * Built with shadcn/ui components
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../../lib/utils';
import { SelectionAPIIntegration } from '../SelectionAPIIntegration';
import { DicomViewer, type DicomViewerRef } from '../DicomViewer';
import { Code, AlertCircle } from 'lucide-react';
import { log } from '../../utils/logger';

interface ExternalSystemState {
  selectedIds: string[];
  lastAction: string;
  actionCount: number;
  errors: string[];
}

/**
 * Example component showing how external systems can integrate with the Selection API
 *
 * This demonstrates:
 * 1. Listening to selection events from the Selection API
 * 2. Programmatically controlling selections
 * 3. Synchronizing external state with selection state
 * 4. Error handling and recovery
 */
export const SelectionAPIIntegrationExample: React.FC = () => {
  const [viewportId] = useState('integration-example-viewport');
  const [externalState, setExternalState] = useState<ExternalSystemState>({
    selectedIds: [],
    lastAction: 'None',
    actionCount: 0,
    errors: [],
  });

  const dicomViewerRef = React.useRef<DicomViewerRef>(null);

  // Mock image IDs for demonstration
  const mockImageIds = [
    'example://image1.dcm',
    'example://image2.dcm',
    'example://image3.dcm',
  ];

  // Handle selection changes from the Selection API
  const handleSelectionChange = (selectedIds: string[], eventViewportId: string) => {
    log.info('External System: Selection changed', { selectedIds, eventViewportId });

    setExternalState(prev => ({
      ...prev,
      selectedIds,
      lastAction: `Selection changed (${selectedIds.length} annotations)`,
      actionCount: prev.actionCount + 1,
    }));

    // Simulate external system actions based on selection
    if (selectedIds.length > 0) {
      // Example: Send selection data to external analytics service
      simulateExternalServiceCall('analytics', {
        event: 'annotation_selected',
        annotationIds: selectedIds,
        timestamp: Date.now(),
      });
    }
  };

  // Handle individual annotation selection
  const handleAnnotationSelected = (annotationId: string, eventViewportId: string) => {
    log.info('External System: Annotation selected', { annotationId, eventViewportId });

    setExternalState(prev => ({
      ...prev,
      lastAction: `Annotation selected: ${annotationId}`,
      actionCount: prev.actionCount + 1,
    }));

    // Simulate external system integration
    simulateExternalServiceCall('annotation-service', {
      action: 'highlight',
      annotationId,
      timestamp: Date.now(),
    });
  };

  // Handle Selection API errors
  const handleSelectionError = (error: Error) => {
    console.error('External System: Selection API error', error);

    setExternalState(prev => ({
      ...prev,
      errors: [...prev.errors.slice(-4), `${new Date().toLocaleTimeString()}: ${error.message}`],
      lastAction: `Error: ${error.message}`,
      actionCount: prev.actionCount + 1,
    }));
  };

  // Simulate external service calls (would be real API calls in production)
  const simulateExternalServiceCall = (service: string, data: any) => {
    log.info(`External System: Calling ${service}`, data);

    // Simulate network delay
    setTimeout(() => {
      log.info(`External System: ${service} response`, { success: true, data });
    }, 100);
  };

  // Example API integration methods that external systems would use
  const externalSystemMethods = {
    // Method 1: Programmatic selection from external UI
    selectFromExternalUI: (annotationId: string) => {
      log.info('External System: Selecting annotation from external UI', annotationId);
      // This would typically be called from an external component/system
      // The Selection API handles the actual selection logic
    },

    // Method 2: Bulk operations for external batch processing
    bulkSelectFromExternalData: (annotationIds: string[]) => {
      log.info('External System: Bulk selecting from external data', annotationIds);
      // This demonstrates how external systems can trigger bulk selections
    },

    // Method 3: Synchronize with external state management
    syncWithExternalStore: (externalSelectionState: any) => {
      log.info('External System: Syncing with external store', externalSelectionState);
      // This shows how to keep external state in sync with Selection API
    },
  };

  return (
    <div className={cn('space-y-6 p-6')}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className={cn('flex items-center gap-2')}>
            <Code className={cn('w-5 h-5')} />
            Selection API Integration Example
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={cn('text-muted-foreground')}>
            This example demonstrates how external systems can integrate with the Selection API
            to monitor and control annotation selections programmatically.
          </p>
        </CardContent>
      </Card>

      {/* External System State */}
      <Card>
        <CardHeader>
          <CardTitle>External System State</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn('grid grid-cols-1 md:grid-cols-3 gap-4')}>
            <div className={cn('space-y-2')}>
              <div className={cn('text-sm font-medium')}>Selected Annotations</div>
              <div className={cn('flex flex-wrap gap-1')}>
                {externalState.selectedIds.length > 0 ? (
                  externalState.selectedIds.map(id => (
                    <Badge key={id} variant="secondary" className={cn('text-xs')}>
                      {id}
                    </Badge>
                  ))
                ) : (
                  <span className={cn('text-muted-foreground text-sm')}>None</span>
                )}
              </div>
            </div>

            <div className={cn('space-y-2')}>
              <div className={cn('text-sm font-medium')}>Last Action</div>
              <div className={cn('text-sm text-muted-foreground')}>
                {externalState.lastAction}
              </div>
            </div>

            <div className={cn('space-y-2')}>
              <div className={cn('text-sm font-medium')}>Action Count</div>
              <div className={cn('text-2xl font-bold text-primary')}>
                {externalState.actionCount}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {externalState.errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className={cn('flex items-center gap-2 text-destructive')}>
              <AlertCircle className={cn('w-4 h-4')} />
              Recent Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className={cn('h-24')}>
              <div className={cn('space-y-1')}>
                {externalState.errors.map((error, index) => (
                  <div key={index} className={cn('text-sm text-destructive')}>
                    {error}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="integration" className={cn('w-full')}>
        <TabsList className={cn('grid w-full grid-cols-3')}>
          <TabsTrigger value="integration">API Integration</TabsTrigger>
          <TabsTrigger value="viewer">DICOM Viewer</TabsTrigger>
          <TabsTrigger value="code">Code Examples</TabsTrigger>
        </TabsList>

        {/* Integration Panel */}
        <TabsContent value="integration" className={cn('space-y-4')}>
          <SelectionAPIIntegration
            viewportId={viewportId}
            onSelectionChange={handleSelectionChange}
            onAnnotationSelected={handleAnnotationSelected}
            onError={handleSelectionError}
          />
        </TabsContent>

        {/* DICOM Viewer Panel */}
        <TabsContent value="viewer" className={cn('space-y-4')}>
          <Card>
            <CardHeader>
              <CardTitle>DICOM Viewer with Selection API</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn('h-96 border rounded-lg overflow-hidden')}>
                <DicomViewer
                  ref={dicomViewerRef}
                  imageIds={mockImageIds}
                  viewportId={viewportId}
                />
              </div>
              <div className={cn('mt-4 text-sm text-muted-foreground')}>
                Create annotations using the tools, then click on them to see the Selection API in action.
                The external system state above will update automatically.
                {/* Hidden usage to prevent TypeScript warning */}
                {externalSystemMethods && null}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Code Examples Panel */}
        <TabsContent value="code" className={cn('space-y-4')}>
          <Card>
            <CardHeader>
              <CardTitle>Integration Code Examples</CardTitle>
            </CardHeader>
            <CardContent className={cn('space-y-4')}>
              {/* React Integration Example */}
              <div>
                <div className={cn('text-sm font-medium mb-2')}>React Component Integration</div>
                <pre className={cn('bg-muted p-3 rounded text-xs overflow-x-auto')}>
                  {`import { SelectionAPIIntegration } from '@/components/SelectionAPIIntegration';

function MyComponent() {
  const handleSelectionChange = (selectedIds, viewportId) => {
    // Update your external state
    updateExternalState({ selectedAnnotations: selectedIds });
    
    // Send to analytics
    trackEvent('annotation_selection_changed', {
      count: selectedIds.length,
      viewportId
    });
  };

  return (
    <SelectionAPIIntegration
      viewportId="my-viewport"
      onSelectionChange={handleSelectionChange}
      onAnnotationSelected={(id, viewportId) => {
        highlightInExternalUI(id);
      }}
      onError={handleSelectionError}
    />
  );
}`}
                </pre>
              </div>

              {/* Direct API Usage Example */}
              <div>
                <div className={cn('text-sm font-medium mb-2')}>Direct API Usage</div>
                <pre className={cn('bg-muted p-3 rounded text-xs overflow-x-auto')}>
                  {`import { selectionAPI } from '@/services';

// Listen to selection events
selectionAPI.on('selection-changed', (selectedIds, viewportId) => {
  log.info('Selection changed:', selectedIds);
  updateExternalSystem(selectedIds);
});

// Programmatically select annotations
async function selectFromExternalTrigger(annotationId) {
  const success = await selectionAPI.selectAnnotation(
    annotationId,
    'viewport-1',
    { preserveExisting: true, validateAnnotation: true }
  );
  
  if (success) {
    notifyExternalSystems(annotationId);
  }
}

// Bulk operations
async function bulkSelectFromExternalData(annotationIds) {
  const result = await selectionAPI.selectMultipleAnnotations(
    annotationIds,
    'viewport-1',
    { batchSize: 5, delayBetweenBatches: 100 }
  );
  
  log.info(\`Selected \${result.successful} annotations\`);
}`}
                </pre>
              </div>

              {/* Error Handling Example */}
              <div>
                <div className={cn('text-sm font-medium mb-2')}>Error Handling</div>
                <pre className={cn('bg-muted p-3 rounded text-xs overflow-x-auto')}>
                  {`// Set up error handling
selectionAPI.on('error', (error) => {
  console.error('Selection API Error:', error);
  
  // Show user notification
  showNotification({
    type: 'error',
    message: 'Failed to select annotation: ' + error.message
  });
  
  // Log to external error tracking
  errorTracker.captureException(error, {
    tags: { component: 'selection_api' }
  });
});

// Graceful error recovery
async function robustSelection(annotationId) {
  try {
    return await selectionAPI.selectAnnotation(annotationId, 'viewport-1');
  } catch (error) {
    // Fallback to legacy selection method
    console.warn('Selection API failed, using fallback:', error);
    return legacySelectionMethod(annotationId);
  }
}`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SelectionAPIIntegrationExample;
