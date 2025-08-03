/**
 * Integrated System Test Component
 * Tests the integration of all major systems
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { cn } from '../lib/utils';

// Import all major systems
import { AnnotationSelectionHandler } from '../services/AnnotationSelectionHandler';
import { HighlightStateManager } from '../services/HighlightStateManager';
import { performanceMonitoringSystem } from '../services/performance-monitoring';
import { synchronizationOptimizer } from '../services/synchronizationOptimizer';
import { AnnotationCompat } from '../types/annotation-compat';

interface SystemTestResult {
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  message?: string;
  duration?: number;
}

interface IntegratedSystemTestProps {
  className?: string;
}

export const IntegratedSystemTest: React.FC<IntegratedSystemTestProps> = ({
  className,
}) => {
  const [testResults, setTestResults] = useState<SystemTestResult[]>([
    { name: 'Annotation Selection System', status: 'pending' },
    { name: 'Highlight State Management', status: 'pending' },
    { name: 'Performance Monitoring', status: 'pending' },
    { name: 'Synchronization Optimization', status: 'pending' },
    { name: 'System Integration', status: 'pending' },
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  // Mock annotations for testing
  const mockAnnotations: AnnotationCompat[] = [
    {
      id: 'test-annotation-1',
      type: 'length',
      state: 'completed',
      data: { points: [{ x: 100, y: 100 }, { x: 200, y: 200 }] },
      metadata: { label: 'Test Length' },
    },
    {
      id: 'test-annotation-2',
      type: 'angle',
      state: 'completed',
      data: { points: [{ x: 150, y: 150 }, { x: 250, y: 150 }, { x: 200, y: 100 }] },
      metadata: { label: 'Test Angle' },
    },
  ];

  const updateTestResult = (index: number, update: Partial<SystemTestResult>) => {
    setTestResults(prev => prev.map((result, i) => 
      i === index ? { ...result, ...update } : result
    ));
  };

  const runSystemTests = async () => {
    setIsRunning(true);
    setProgress(0);

    try {
      // Test 1: Annotation Selection System
      updateTestResult(0, { status: 'running' });
      const startTime1 = Date.now();
      
      const selectionHandler = new AnnotationSelectionHandler();
      const result1 = selectionHandler.selectAnnotation(mockAnnotations[0], 'test-viewport-1');
      const selectedAnnotations = selectionHandler.getSelectedAnnotations('test-viewport-1');
      
      if (result1 && selectedAnnotations.length === 1) {
        updateTestResult(0, { 
          status: 'passed', 
          duration: Date.now() - startTime1,
          message: 'Selection and retrieval working correctly'
        });
      } else {
        updateTestResult(0, { 
          status: 'failed', 
          message: 'Selection or retrieval failed'
        });
      }
      setProgress(20);

      // Test 2: Highlight State Management
      updateTestResult(1, { status: 'running' });
      const startTime2 = Date.now();
      
      const highlightManager = new HighlightStateManager();
      const stateId = highlightManager.createHighlightState(
        'test-annotation-1',
        'test-viewport-1',
        { color: '#87CEEB', pulseEnabled: true }
      );
      const activateResult = highlightManager.activateState(stateId);
      const state = highlightManager.getState(stateId);
      
      if (activateResult && state && state.state === 'active') {
        updateTestResult(1, { 
          status: 'passed', 
          duration: Date.now() - startTime2,
          message: 'State creation and activation working'
        });
      } else {
        updateTestResult(1, { 
          status: 'failed', 
          message: 'State management failed'
        });
      }
      setProgress(40);

      // Test 3: Performance Monitoring
      updateTestResult(2, { status: 'running' });
      const startTime3 = Date.now();
      
      performanceMonitoringSystem.startMonitoring();
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for metrics
      const stats = performanceMonitoringSystem.getPerformanceStatistics();
      performanceMonitoringSystem.stopMonitoring();
      
      if (stats.isMonitoring === false && stats.sessionId) {
        updateTestResult(2, { 
          status: 'passed', 
          duration: Date.now() - startTime3,
          message: `Session: ${stats.sessionId.split('-')[1]}`
        });
      } else {
        updateTestResult(2, { 
          status: 'failed', 
          message: 'Performance monitoring failed'
        });
      }
      setProgress(60);

      // Test 4: Synchronization Optimization
      updateTestResult(3, { status: 'running' });
      const startTime4 = Date.now();
      
      const syncGroupId = synchronizationOptimizer.createSyncGroup(
        'test-group',
        ['test-viewport-1', 'test-viewport-2'],
        ['pan', 'zoom']
      );
      const operationId = synchronizationOptimizer.queueSyncOperation({
        type: 'pan',
        sourceViewportId: 'test-viewport-1',
        targetViewportIds: ['test-viewport-2'],
        priority: 5,
        data: { pan: { x: 10, y: 10 } }
      });
      const metrics = synchronizationOptimizer.getPerformanceMetrics();
      
      if (syncGroupId && operationId && metrics.totalOperations > 0) {
        updateTestResult(3, { 
          status: 'passed', 
          duration: Date.now() - startTime4,
          message: `${metrics.totalOperations} operations queued`
        });
      } else {
        updateTestResult(3, { 
          status: 'failed', 
          message: 'Synchronization failed'
        });
      }
      setProgress(80);

      // Test 5: System Integration
      updateTestResult(4, { status: 'running' });
      const startTime5 = Date.now();
      
      // Test integration between systems
      let integrationSuccess = true;
      let integrationMessage = 'All systems integrated successfully';
      
      try {
        // Test selection -> highlight integration
        const annotation = mockAnnotations[1];
        const selectionResult = selectionHandler.selectAnnotation(annotation, 'test-viewport-1');
        const highlightStateId = highlightManager.createHighlightState(
          annotation.id,
          'test-viewport-1'
        );
        const highlightResult = highlightManager.activateState(highlightStateId);
        
        if (!selectionResult || !highlightResult) {
          integrationSuccess = false;
          integrationMessage = 'Selection-Highlight integration failed';
        }

        // Test performance monitoring during operations
        performanceMonitoringSystem.startMonitoring();
        synchronizationOptimizer.queueSyncOperation({
          type: 'zoom',
          sourceViewportId: 'test-viewport-1',
          targetViewportIds: ['test-viewport-2'],
          priority: 8,
          data: { zoom: 1.5 }
        });
        performanceMonitoringSystem.stopMonitoring();

      } catch (error) {
        integrationSuccess = false;
        integrationMessage = `Integration error: ${(error as Error).message}`;
      }
      
      updateTestResult(4, { 
        status: integrationSuccess ? 'passed' : 'failed', 
        duration: Date.now() - startTime5,
        message: integrationMessage
      });
      setProgress(100);

    } catch (error) {
      console.error('System test failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const resetTests = () => {
    setTestResults(prev => prev.map(result => ({ 
      ...result, 
      status: 'pending', 
      message: undefined, 
      duration: undefined 
    })));
    setProgress(0);
  };

  const getStatusColor = (status: SystemTestResult['status']) => {
    switch (status) {
      case 'pending': return 'secondary';
      case 'running': return 'outline';
      case 'passed': return 'default';
      case 'failed': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: SystemTestResult['status']) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'running': return '🔄';
      case 'passed': return '✅';
      case 'failed': return '❌';
      default: return '⏳';
    }
  };

  const passedTests = testResults.filter(r => r.status === 'passed').length;
  const failedTests = testResults.filter(r => r.status === 'failed').length;
  const totalTests = testResults.length;

  return (
    <Card className={cn('w-full max-w-2xl', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Integrated System Test</CardTitle>
          <Badge variant="outline">
            {passedTests}/{totalTests} Passed
          </Badge>
        </div>
        {progress > 0 && (
          <Progress value={progress} className="w-full" />
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Test Results */}
        <div className="space-y-3">
          {testResults.map((result, index) => (
            <div 
              key={result.name}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{getStatusIcon(result.status)}</span>
                <div>
                  <div className="font-medium">{result.name}</div>
                  {result.message && (
                    <div className="text-sm text-muted-foreground">
                      {result.message}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {result.duration && (
                  <span className="text-xs text-muted-foreground">
                    {result.duration}ms
                  </span>
                )}
                <Badge variant={getStatusColor(result.status)} className="text-xs">
                  {result.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        {(passedTests > 0 || failedTests > 0) && (
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm font-medium mb-2">Test Summary</div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Total</div>
                <div className="font-medium">{totalTests}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Passed</div>
                <div className="font-medium text-green-600">{passedTests}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Failed</div>
                <div className="font-medium text-red-600">{failedTests}</div>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          <Button 
            onClick={runSystemTests} 
            disabled={isRunning}
            className="flex-1"
          >
            {isRunning ? 'Running Tests...' : 'Run System Tests'}
          </Button>
          <Button 
            variant="outline" 
            onClick={resetTests}
            disabled={isRunning}
          >
            Reset
          </Button>
        </div>

        {/* Integration Status */}
        <div className="text-xs text-muted-foreground border-t pt-3">
          <div>Last Run: {new Date().toLocaleTimeString()}</div>
          <div>Systems: Annotation Selection, Highlighting, Performance Monitoring, Synchronization</div>
        </div>
      </CardContent>
    </Card>
  );
};

export default IntegratedSystemTest;