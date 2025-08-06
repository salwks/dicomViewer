/**
 * Performance Monitor Dashboard Component
 * Real-time performance monitoring and reporting interface with global performance monitoring integration
 * Built with shadcn/ui components
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Toggle } from '../ui/toggle';
import { cn } from '../../lib/utils';
import { log } from '../../utils/logger';

// Import global performance monitoring services
import { performanceMonitoringSystem } from '../../services/performance-monitoring/index';
import { viewportOptimizer } from '../../services/viewport-optimizer/index';

export interface PerformanceMonitorDashboardProps {
  className?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  showOptimizationControls?: boolean;
  compact?: boolean;
}

interface PerformanceData {
  isMonitoring: boolean;
  snapshotCount: number;
  activeIssues: number;
  lastSnapshot?: any;
  optimizationStats?: any;
  currentReport?: any;
}

interface IssueAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  timestamp: number;
}

export const PerformanceMonitorDashboard: React.FC<PerformanceMonitorDashboardProps> = ({
  className,
  autoRefresh = true,
  refreshInterval = 2000,
  showOptimizationControls = true,
  compact = false,
}) => {
  const [performanceData, setPerformanceData] = useState<PerformanceData>({
    isMonitoring: false,
    snapshotCount: 0,
    activeIssues: 0,
  });
  const [issues, setIssues] = useState<IssueAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);

  // Fetch performance data
  const fetchPerformanceData = useCallback(async () => {
    try {
      const stats = performanceMonitoringSystem.getPerformanceStatistics();
      const optimizationStats = viewportOptimizer.getOptimizationStats();

      setPerformanceData({
        isMonitoring: stats.isMonitoring,
        snapshotCount: stats.snapshotCount,
        activeIssues: stats.activeIssues,
        lastSnapshot: stats.lastSnapshot,
        optimizationStats,
      });

      // Extract issues from last snapshot
      if (stats.lastSnapshot?.issues) {
        const newIssues: IssueAlert[] = stats.lastSnapshot.issues.map((issue: any) => ({
          id: issue.id,
          severity: issue.severity,
          title: issue.title,
          description: issue.description,
          timestamp: issue.detectedAt,
        }));
        setIssues(newIssues);
      }

    } catch (error) {
      log.error('Failed to fetch performance data', {
        component: 'PerformanceMonitorDashboard',
      }, error as Error);
    }
  }, []);

  // Toggle monitoring
  const toggleMonitoring = useCallback(() => {
    setIsLoading(true);
    try {
      if (performanceData.isMonitoring) {
        performanceMonitoringSystem.stopMonitoring();
        setMonitoringEnabled(false);
      } else {
        performanceMonitoringSystem.startMonitoring();
        setMonitoringEnabled(true);
      }

      // Refresh data after toggle
      setTimeout(() => {
        fetchPerformanceData();
        setIsLoading(false);
      }, 500);

    } catch (error) {
      log.error('Failed to toggle monitoring', {
        component: 'PerformanceMonitorDashboard',
      }, error as Error);
      setIsLoading(false);
    }
  }, [performanceData.isMonitoring, fetchPerformanceData]);

  // Generate performance report
  const generateReport = useCallback(() => {
    try {
      const report = viewportOptimizer.generatePerformanceReport();
      setPerformanceData(prev => ({ ...prev, currentReport: report }));

      log.info('Performance report generated from dashboard', {
        component: 'PerformanceMonitorDashboard',
        metadata: { reportId: report.id },
      });

    } catch (error) {
      log.error('Failed to generate performance report', {
        component: 'PerformanceMonitorDashboard',
      }, error as Error);
    }
  }, []);

  // Force optimization
  const forceOptimization = useCallback(() => {
    try {
      viewportOptimizer.optimizeViewports();

      log.info('Manual optimization triggered from dashboard', {
        component: 'PerformanceMonitorDashboard',
      });

      // Refresh data after optimization
      setTimeout(fetchPerformanceData, 1000);

    } catch (error) {
      log.error('Failed to force optimization', {
        component: 'PerformanceMonitorDashboard',
      }, error as Error);
    }
  }, [fetchPerformanceData]);

  // Setup auto-refresh
  useEffect(() => {
    if (autoRefresh && performanceData.isMonitoring) {
      const interval = setInterval(fetchPerformanceData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, performanceData.isMonitoring, refreshInterval, fetchPerformanceData]);

  // Initial data fetch
  useEffect(() => {
    fetchPerformanceData();
  }, [fetchPerformanceData]);

  // Setup event listeners for real-time updates
  useEffect(() => {
    const handleIssueDetected = (issue: any) => {
      const newIssue: IssueAlert = {
        id: issue.id,
        severity: issue.severity,
        title: issue.title,
        description: issue.description,
        timestamp: issue.detectedAt,
      };
      setIssues(prev => [newIssue, ...prev.slice(0, 9)]); // Keep last 10 issues
    };

    performanceMonitoringSystem.on('issue-detected', handleIssueDetected);

    return () => {
      performanceMonitoringSystem.removeListener('issue-detected', handleIssueDetected);
    };
  }, []);

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  // Get severity variant
  const getSeverityVariant = (severity: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  // Calculate overall performance score
  const getPerformanceScore = () => {
    if (!performanceData.lastSnapshot) return 100;

    const snapshot = performanceData.lastSnapshot;
    let score = 100;

    // Deduct points for FPS issues
    if (snapshot.metrics?.rendering?.frameRate?.current < 30) {
      score -= 30;
    } else if (snapshot.metrics?.rendering?.frameRate?.current < 45) {
      score -= 15;
    }

    // Deduct points for memory usage
    const memoryUsage = snapshot.metrics?.memory?.usage;
    if (memoryUsage) {
      const usagePercent = (memoryUsage.used / memoryUsage.total) * 100;
      if (usagePercent > 90) {
        score -= 25;
      } else if (usagePercent > 75) {
        score -= 10;
      }
    }

    return Math.max(0, score);
  };

  if (compact) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-3 h-3 rounded-full',
                performanceData.isMonitoring ? 'bg-green-500' : 'bg-red-500',
              )} />
              <span className="text-sm font-medium">Performance</span>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {getPerformanceScore()}%
              </Badge>

              {performanceData.activeIssues > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {performanceData.activeIssues} issues
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Performance Monitor</CardTitle>

            <div className="flex items-center gap-2">
              <Toggle
                pressed={monitoringEnabled}
                onPressedChange={toggleMonitoring}
                disabled={isLoading}
                size="sm"
              >
                {performanceData.isMonitoring ? 'Monitoring' : 'Stopped'}
              </Toggle>

              {showOptimizationControls && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={forceOptimization}
                    disabled={isLoading}
                  >
                    Optimize
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateReport}
                    disabled={isLoading}
                  >
                    Report
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Overall Score</span>
                <Badge variant="outline">{getPerformanceScore()}%</Badge>
              </div>
              <Progress value={getPerformanceScore()} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">FPS</span>
                <span className="text-sm font-medium">
                  {performanceData.lastSnapshot?.metrics?.rendering?.frameRate?.current || 0}
                </span>
              </div>
              <Progress
                value={(performanceData.lastSnapshot?.metrics?.rendering?.frameRate?.current || 0) / 60 * 100}
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Memory</span>
                <span className="text-sm font-medium">
                  {performanceData.lastSnapshot?.metrics?.memory ?
                    `${Math.round(performanceData.lastSnapshot.metrics.memory.usage.used / 1024 / 1024)}MB` :
                    '0MB'
                  }
                </span>
              </div>
              <Progress
                value={
                  performanceData.lastSnapshot?.metrics?.memory ?
                    (performanceData.lastSnapshot.metrics.memory.usage.used / performanceData.lastSnapshot.metrics.memory.usage.total) * 100 :
                    0
                }
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Viewports</span>
                <span className="text-sm font-medium">
                  {performanceData.optimizationStats?.activeViewports || 0} / {performanceData.optimizationStats?.viewportCount || 0}
                </span>
              </div>
              <Progress
                value={
                  performanceData.optimizationStats?.viewportCount ?
                    (performanceData.optimizationStats.activeViewports / performanceData.optimizationStats.viewportCount) * 100 :
                    0
                }
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Issues Alert */}
      {issues.length > 0 && (
        <Alert>
          <AlertDescription>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Performance Issues Detected:</span>
                <Badge variant="destructive">{issues.length}</Badge>
              </div>
              <div className="space-y-1">
                {issues.slice(0, 3).map((issue) => (
                  <div key={issue.id} className="flex items-center gap-2 text-sm">
                    <div className={cn('w-2 h-2 rounded-full', getSeverityColor(issue.severity))} />
                    <span>{issue.title}</span>
                    <Badge variant={getSeverityVariant(issue.severity)} className="text-xs">
                      {issue.severity}
                    </Badge>
                  </div>
                ))}
                {issues.length > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{issues.length - 3} more issues
                  </span>
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Detailed Tabs */}
      <Tabs defaultValue="metrics" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Real-time Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              {performanceData.lastSnapshot ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Rendering</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Frame Rate:</span>
                        <span>{performanceData.lastSnapshot.metrics.rendering.frameRate.current} fps</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Render Time:</span>
                        <span>{performanceData.lastSnapshot.metrics.rendering.renderTime.average.toFixed(1)} ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Frame Drops:</span>
                        <span>{performanceData.lastSnapshot.metrics.rendering.frameRate.drops}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Memory</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Used:</span>
                        <span>{Math.round(performanceData.lastSnapshot.metrics.memory.usage.used / 1024 / 1024)} MB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total:</span>
                        <span>{Math.round(performanceData.lastSnapshot.metrics.memory.usage.total / 1024 / 1024)} MB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>GC Pressure:</span>
                        <span>{performanceData.lastSnapshot.metrics.memory.gc.pressure}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No metrics data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Optimization Status</CardTitle>
            </CardHeader>
            <CardContent>
              {performanceData.optimizationStats ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{performanceData.optimizationStats.viewportCount}</div>
                      <div className="text-sm text-muted-foreground">Total Viewports</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{performanceData.optimizationStats.activeViewports}</div>
                      <div className="text-sm text-muted-foreground">Active Viewports</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {Math.round(performanceData.optimizationStats.memoryStats?.usageRatio * 100 || 0)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Memory Usage</div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No optimization data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issues" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Issues</CardTitle>
            </CardHeader>
            <CardContent>
              {issues.length > 0 ? (
                <div className="space-y-3">
                  {issues.map((issue) => (
                    <div key={issue.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{issue.title}</h4>
                        <Badge variant={getSeverityVariant(issue.severity)}>
                          {issue.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{issue.description}</p>
                      <div className="text-xs text-muted-foreground">
                        {new Date(issue.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No issues detected</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PerformanceMonitorDashboard;
