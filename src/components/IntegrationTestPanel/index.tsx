/**
 * Integration Test Panel Component
 * UI component for running and monitoring system integration tests
 * Provides real-time progress updates and detailed result visualization
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { cn } from '../../lib/utils';
import { log } from '../../utils/logger';
import {
  integrationTestRunner,
  TestRunSummary,
  TestRunProgress,
} from '../../services/IntegrationTestRunner';

interface IntegrationTestPanelProps {
  className?: string;
  onTestComplete?: (summary: TestRunSummary) => void;
}

interface TestStatus {
  isRunning: boolean;
  runId: string | null;
  progress?: TestRunProgress;
  summary?: TestRunSummary;
  error?: string;
}

export const IntegrationTestPanel: React.FC<IntegrationTestPanelProps> = ({
  className,
  onTestComplete,
}) => {
  const [status, setStatus] = useState<TestStatus>({
    isRunning: false,
    runId: null,
  });
  const [history, setHistory] = useState<TestRunSummary[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  // Load initial history
  useEffect(() => {
    const initialHistory = integrationTestRunner.getRunHistory(10);
    setHistory(initialHistory);
  }, []);

  // Set up event listeners
  useEffect(() => {
    const handleProgress = (progress: TestRunProgress) => {
      setStatus(prev => ({
        ...prev,
        progress,
      }));
    };

    const handleTestComplete = (summary: TestRunSummary) => {
      setStatus({
        isRunning: false,
        runId: null,
        summary,
      });

      // Update history
      const updatedHistory = integrationTestRunner.getRunHistory(10);
      setHistory(updatedHistory);

      onTestComplete?.(summary);

      log.info('Integration test completed via UI', {
        component: 'IntegrationTestPanel',
        metadata: {
          runId: summary.runId,
          overallStatus: summary.overallStatus,
        },
      });
    };

    integrationTestRunner.on('progress', handleProgress);
    integrationTestRunner.on('test-run-completed', handleTestComplete);

    return () => {
      integrationTestRunner.off('progress', handleProgress);
      integrationTestRunner.off('test-run-completed', handleTestComplete);
    };
  }, [onTestComplete]);

  const handleRunQuickCheck = useCallback(async () => {
    if (status.isRunning) return;

    setStatus({
      isRunning: true,
      runId: 'quick-check',
      error: undefined,
      summary: undefined,
    });

    try {
      await integrationTestRunner.runQuickHealthCheck();
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        isRunning: false,
        error: (error as Error).message,
      }));

      log.error('Quick health check failed', {
        component: 'IntegrationTestPanel',
      }, error as Error);
    }
  }, [status.isRunning]);

  const handleRunFullSuite = useCallback(async () => {
    if (status.isRunning) return;

    setStatus({
      isRunning: true,
      runId: 'full-suite',
      error: undefined,
      summary: undefined,
    });

    try {
      await integrationTestRunner.runIntegrationTests({
        includePerformanceBenchmarks: true,
        includeStressTests: false,
        maxExecutionTime: 300000, // 5 minutes
        verbose: true,
        generateDetailedReport: true,
      });
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        isRunning: false,
        error: (error as Error).message,
      }));

      log.error('Full integration test suite failed', {
        component: 'IntegrationTestPanel',
      }, error as Error);
    }
  }, [status.isRunning]);

  const getStatusBadge = (overallStatus: string) => {
    const variants = {
      success: 'default' as const,
      partial: 'secondary' as const,
      failure: 'destructive' as const,
    };

    const colors = {
      success: 'text-green-600',
      partial: 'text-yellow-600',
      failure: 'text-red-600',
    };

    return (
      <Badge variant={variants[overallStatus as keyof typeof variants] || 'outline'}>
        <span className={colors[overallStatus as keyof typeof colors] || ''}>
          {overallStatus.toUpperCase()}
        </span>
      </Badge>
    );
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>System Integration Tests</span>
            {status.isRunning && (
              <Badge variant="outline" className="animate-pulse">
                Running
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleRunQuickCheck}
              disabled={status.isRunning}
              variant="outline"
              size="sm"
            >
              {status.isRunning && status.runId === 'quick-check' ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2" />
                  Running...
                </>
              ) : (
                'Quick Health Check'
              )}
            </Button>

            <Button
              onClick={handleRunFullSuite}
              disabled={status.isRunning}
              size="sm"
            >
              {status.isRunning && status.runId === 'full-suite' ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2" />
                  Running...
                </>
              ) : (
                'Full Test Suite'
              )}
            </Button>
          </div>

          {/* Progress Display */}
          {status.isRunning && status.progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{status.progress.currentTest}</span>
                <span>{Math.round(status.progress.percentage)}%</span>
              </div>
              <Progress value={status.progress.percentage} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {status.progress.completedTests} / {status.progress.totalTests} tests
                </span>
                <span>
                  ETA: {Math.round(status.progress.estimatedTimeRemaining / 1000)}s
                </span>
              </div>
            </div>
          )}

          {/* Error Display */}
          {status.error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive font-medium">Test Execution Error</p>
              <p className="text-xs text-destructive/80 mt-1">{status.error}</p>
            </div>
          )}

          {/* Latest Result Summary */}
          {status.summary && (
            <div className="p-3 bg-muted/50 rounded-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Latest Result</span>
                {getStatusBadge(status.summary.overallStatus)}
              </div>
              <div className="grid grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Total</span>
                  <p className="font-medium">{status.summary.results.totalTests}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Passed</span>
                  <p className="font-medium text-green-600">{status.summary.results.passed}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Failed</span>
                  <p className="font-medium text-red-600">{status.summary.results.failed}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Duration</span>
                  <p className="font-medium">{formatDuration(status.summary.totalDuration)}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Test History</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-muted-foreground text-sm">No test runs recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {history.slice(0, showDetails ? 10 : 3).map((run) => (
                <div
                  key={run.runId}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-md"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(run.overallStatus)}
                      <span className="text-sm font-medium truncate">
                        {new Date(run.endTime).toLocaleString()}
                      </span>
                    </div>
                    {showDetails && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        <span>
                          {run.results.passed}✅ {run.results.failed}❌ {run.results.warnings}⚠️
                        </span>
                        <span className="mx-2">•</span>
                        <span>{formatDuration(run.totalDuration)}</span>
                        {run.criticalIssues.length > 0 && (
                          <>
                            <span className="mx-2">•</span>
                            <span className="text-red-600">
                              {run.criticalIssues.length} critical issues
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">
                      {run.runId.split('-').pop()?.substring(0, 6)}
                    </div>
                  </div>
                </div>
              ))}

              {!showDetails && history.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDetails(true)}
                  className="w-full"
                >
                  Show {history.length - 3} more runs...
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Status Indicators */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-muted/30 rounded-md">
              <div className="text-2xl mb-1">🔧</div>
              <div className="text-sm font-medium">Tool System</div>
              <div className="text-xs text-muted-foreground">
                {status.summary?.overallStatus === 'success' ? 'Healthy' : 'Unknown'}
              </div>
            </div>

            <div className="text-center p-3 bg-muted/30 rounded-md">
              <div className="text-2xl mb-1">⚡</div>
              <div className="text-sm font-medium">Performance</div>
              <div className="text-xs text-muted-foreground">
                {status.summary ? 'Measured' : 'Unknown'}
              </div>
            </div>

            <div className="text-center p-3 bg-muted/30 rounded-md">
              <div className="text-2xl mb-1">🛡️</div>
              <div className="text-sm font-medium">Error Handling</div>
              <div className="text-xs text-muted-foreground">
                {status.summary?.results.failed === 0 ? 'Robust' : 'Unknown'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
