/**
 * Audit Dashboard Component
 * Comprehensive dashboard for viewing and managing audit logs
 * Built with shadcn/ui components for medical compliance
 */

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { useAuditLogger } from '../hooks/useAuditLogger';
import { AuditEventType, AuditSeverity, type AuditEvent, type AuditLogFilter, type AuditLogStatistics } from '../security/AuditLogger';
import { Download, Shield, AlertTriangle, Users, Activity, Calendar, FileText, Search, Filter, BarChart3 } from 'lucide-react';

interface AuditDashboardProps {
  className?: string;
}

export const AuditDashboard: React.FC<AuditDashboardProps> = ({ className }) => {
  const {
    getLogs,
    getStatistics,
    exportLogs,
    verifyIntegrity,
    logEvent,
    isLoading,
    error,
  } = useAuditLogger();

  // State
  const [logs, setLogs] = useState<AuditEvent[]>([]);
  const [statistics, setStatistics] = useState<AuditLogStatistics | null>(null);
  const [currentFilter, setCurrentFilter] = useState<AuditLogFilter>({});
  const [selectedTab, setSelectedTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(0);
  const [integrityStatus, setIntegrityStatus] = useState<{
    isValid: boolean;
    corruptedEntries: number;
    missingEntries: number;
    details: string[];
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [logsData, statsData] = await Promise.all([
        getLogs(currentFilter, pageSize, currentPage * pageSize),
        getStatistics(currentFilter),
      ]);

      setLogs(logsData);
      setStatistics(statsData);
    } catch (err) {
      console.error('Failed to load audit data:', err);
    }
  }, [getLogs, getStatistics, currentFilter, currentPage, pageSize]);

  // Load initial data
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter functions
  const handleFilterChange = useCallback((newFilter: Partial<AuditLogFilter>) => {
    setCurrentFilter(prev => ({ ...prev, ...newFilter }));
    setCurrentPage(0); // Reset to first page when filter changes
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    // Note: In a real implementation, search filtering should be server-side
  }, []);

  // Export functions
  const handleExport = useCallback(async (format: 'json' | 'csv' | 'xml') => {
    try {
      const exportedData = await exportLogs(format, currentFilter);

      // Create and download file
      const blob = new Blob([exportedData], {
        type: format === 'json' ? 'application/json' :
          format === 'csv' ? 'text/csv' : 'application/xml',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Log the export action
      await logEvent(
        AuditEventType.AUDIT_LOG_ACCESS,
        'download_export',
        'success',
        {
          severity: AuditSeverity.MEDIUM,
          resource: 'audit_logs',
          customDetails: { format, recordCount: logs.length },
        },
      );
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [exportLogs, currentFilter, logs.length, logEvent]);

  // Integrity check
  const handleIntegrityCheck = useCallback(async () => {
    const result = await verifyIntegrity();
    setIntegrityStatus(result);
  }, [verifyIntegrity]);

  // Severity color mapping
  const getSeverityColor = (severity: AuditSeverity): string => {
    switch (severity) {
      case AuditSeverity.LOW: return 'bg-green-100 text-green-800';
      case AuditSeverity.MEDIUM: return 'bg-yellow-100 text-yellow-800';
      case AuditSeverity.HIGH: return 'bg-orange-100 text-orange-800';
      case AuditSeverity.CRITICAL: return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Outcome color mapping
  const getOutcomeColor = (outcome: string): string => {
    switch (outcome) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'failure': return 'bg-red-100 text-red-800';
      case 'unknown': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={cn('w-full space-y-6', className)}>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center space-x-2'>
          <Shield className='h-6 w-6 text-primary' />
          <h1 className='text-2xl font-bold'>감사 로그 대시보드</h1>
        </div>

        <div className='flex items-center space-x-2'>
          <Button
            onClick={handleIntegrityCheck}
            variant='outline'
            size='sm'
            disabled={isLoading}
          >
            <Shield className='h-4 w-4 mr-2' />
            무결성 검사
          </Button>

          <Select onValueChange={(value) => handleExport(value as 'json' | 'csv' | 'xml')}>
            <SelectTrigger className='w-32'>
              <Download className='h-4 w-4 mr-2' />
              <SelectValue placeholder='내보내기' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='json'>JSON</SelectItem>
              <SelectItem value='csv'>CSV</SelectItem>
              <SelectItem value='xml'>XML</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert className='border-red-200 bg-red-50'>
          <AlertTriangle className='h-4 w-4' />
          <AlertDescription className='text-red-800'>
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Integrity Status */}
      {integrityStatus && (
        <Alert className={integrityStatus.isValid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          <Shield className='h-4 w-4' />
          <AlertDescription className={integrityStatus.isValid ? 'text-green-800' : 'text-red-800'}>
            <div className='font-semibold'>
              로그 무결성: {integrityStatus.isValid ? '정상' : '손상됨'}
            </div>
            {!integrityStatus.isValid && (
              <div className='mt-2 text-sm'>
                손상된 항목: {integrityStatus.corruptedEntries},
                누락된 항목: {integrityStatus.missingEntries}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Loading Progress */}
      {isLoading && (
        <div className='space-y-2'>
          <Progress value={undefined} className='w-full' />
          <p className='text-sm text-muted-foreground text-center'>감사 로그를 불러오는 중...</p>
        </div>
      )}

      {/* Statistics Overview */}
      {statistics && (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>총 이벤트</CardTitle>
              <Activity className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{statistics.totalEvents.toLocaleString()}</div>
              <p className='text-xs text-muted-foreground'>
                일평균 {statistics.averageEventsPerDay.toFixed(1)}개
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>고유 사용자</CardTitle>
              <Users className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{statistics.uniqueUsers}</div>
              <p className='text-xs text-muted-foreground'>
                활성 사용자 수
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>보안 이벤트</CardTitle>
              <AlertTriangle className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold text-orange-600'>{statistics.suspiciousActivities}</div>
              <p className='text-xs text-muted-foreground'>
                의심스러운 활동
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>규정 위반</CardTitle>
              <Shield className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold text-red-600'>{statistics.complianceViolations}</div>
              <p className='text-xs text-muted-foreground'>
                정책 위반 건수
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className='w-full'>
        <TabsList className='grid w-full grid-cols-4'>
          <TabsTrigger value='overview'>개요</TabsTrigger>
          <TabsTrigger value='logs'>로그 목록</TabsTrigger>
          <TabsTrigger value='analytics'>분석</TabsTrigger>
          <TabsTrigger value='filters'>필터</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value='overview' className='space-y-4'>
          {statistics && (
            <>
              {/* Event Type Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center'>
                    <BarChart3 className='h-5 w-5 mr-2' />
                    이벤트 유형별 분포
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='space-y-2'>
                    {Object.entries(statistics.eventsByType).slice(0, 10).map(([type, count]) => (
                      <div key={type} className='flex items-center justify-between'>
                        <span className='text-sm'>{type}</span>
                        <Badge variant='secondary'>{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Peak Activity Hours */}
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center'>
                    <Calendar className='h-5 w-5 mr-2' />
                    최고 활동 시간대
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='flex space-x-4'>
                    {statistics.peakActivityHours.map((hour) => (
                      <Badge key={hour} variant='outline'>
                        {hour}:00 - {hour + 1}:00
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value='logs' className='space-y-4'>
          {/* Search and Controls */}
          <div className='flex items-center space-x-4'>
            <div className='flex-1'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                <Input
                  placeholder='이벤트, 사용자, 리소스 검색...'
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className='pl-10'
                />
              </div>
            </div>

            <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
              <SelectTrigger className='w-24'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='25'>25</SelectItem>
                <SelectItem value='50'>50</SelectItem>
                <SelectItem value='100'>100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Logs Table */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center'>
                <FileText className='h-5 w-5 mr-2' />
                감사 로그 ({logs.length}개)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-3'>
                {logs.map((log) => (
                  <div key={log.eventId} className='border rounded-lg p-4 space-y-2'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center space-x-2'>
                        <Badge className={getSeverityColor(log.severity)}>
                          {log.severity}
                        </Badge>
                        <Badge className={getOutcomeColor(log.outcome)}>
                          {log.outcome}
                        </Badge>
                        <span className='text-sm font-medium'>{log.eventType}</span>
                      </div>
                      <span className='text-xs text-muted-foreground'>
                        {new Date(log.timestamp).toLocaleString('ko-KR')}
                      </span>
                    </div>

                    <div className='text-sm'>
                      <strong>작업:</strong> {log.action}
                      {log.username && (
                        <>
                          {' • '}
                          <strong>사용자:</strong> {log.username}
                        </>
                      )}
                      {log.resource && (
                        <>
                          {' • '}
                          <strong>리소스:</strong> {log.resource}
                        </>
                      )}
                    </div>

                    {log.patientId && (
                      <div className='text-xs text-muted-foreground'>
                        <strong>환자 ID:</strong> {log.patientId}
                        {log.studyId && (
                          <>
                            {' • '}
                            <strong>스터디 ID:</strong> {log.studyId}
                          </>
                        )}
                      </div>
                    )}

                    {log.details && Object.keys(log.details).length > 0 && (
                      <details className='text-xs'>
                        <summary className='cursor-pointer text-muted-foreground hover:text-foreground'>
                          세부 정보 보기
                        </summary>
                        <pre className='mt-2 p-2 bg-muted rounded text-xs overflow-auto'>
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className='flex items-center justify-between mt-4'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0 || isLoading}
                >
                  이전
                </Button>

                <span className='text-sm text-muted-foreground'>
                  페이지 {currentPage + 1}
                </span>

                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={logs.length < pageSize || isLoading}
                >
                  다음
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value='analytics' className='space-y-4'>
          {statistics && (
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
              {/* Severity Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>심각도별 분포</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='space-y-3'>
                    {Object.entries(statistics.eventsBySeverity).map(([severity, count]) => (
                      <div key={severity} className='flex items-center justify-between'>
                        <Badge className={getSeverityColor(severity as AuditSeverity)}>
                          {severity}
                        </Badge>
                        <div className='flex items-center space-x-2'>
                          <div className='w-32 bg-gray-200 rounded-full h-2'>
                            <div
                              className='bg-primary h-2 rounded-full'
                              style={{
                                width: `${(count / statistics.totalEvents) * 100}%`,
                              }}
                            />
                          </div>
                          <span className='text-sm font-medium'>{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Outcome Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>결과별 분포</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='space-y-3'>
                    {Object.entries(statistics.eventsByOutcome).map(([outcome, count]) => (
                      <div key={outcome} className='flex items-center justify-between'>
                        <Badge className={getOutcomeColor(outcome)}>
                          {outcome}
                        </Badge>
                        <div className='flex items-center space-x-2'>
                          <div className='w-32 bg-gray-200 rounded-full h-2'>
                            <div
                              className='bg-primary h-2 rounded-full'
                              style={{
                                width: `${(count / statistics.totalEvents) * 100}%`,
                              }}
                            />
                          </div>
                          <span className='text-sm font-medium'>{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Filters Tab */}
        <TabsContent value='filters' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center'>
                <Filter className='h-5 w-5 mr-2' />
                필터 설정
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              {/* Event Type Filter */}
              <div className='space-y-2'>
                <Label>이벤트 유형</Label>
                <Select onValueChange={(value) =>
                  handleFilterChange({
                    eventTypes: value === 'all' ? undefined : [value as AuditEventType],
                  })
                }>
                  <SelectTrigger>
                    <SelectValue placeholder='모든 이벤트 유형' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>모든 이벤트 유형</SelectItem>
                    {Object.values(AuditEventType).map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Severity Filter */}
              <div className='space-y-2'>
                <Label>심각도</Label>
                <Select onValueChange={(value) =>
                  handleFilterChange({
                    severities: value === 'all' ? undefined : [value as AuditSeverity],
                  })
                }>
                  <SelectTrigger>
                    <SelectValue placeholder='모든 심각도' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>모든 심각도</SelectItem>
                    {Object.values(AuditSeverity).map((severity) => (
                      <SelectItem key={severity} value={severity}>{severity}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range Filter */}
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label>시작 날짜</Label>
                  <Input
                    type='date'
                    onChange={(e) => {
                      const startDate = e.target.value ? new Date(e.target.value) : undefined;
                      handleFilterChange({
                        dateRange: startDate && currentFilter.dateRange?.endDate ? {
                          startDate,
                          endDate: currentFilter.dateRange.endDate,
                        } : startDate ? {
                          startDate,
                          endDate: new Date(),
                        } : undefined,
                      });
                    }}
                  />
                </div>

                <div className='space-y-2'>
                  <Label>종료 날짜</Label>
                  <Input
                    type='date'
                    onChange={(e) => {
                      const endDate = e.target.value ? new Date(e.target.value) : undefined;
                      handleFilterChange({
                        dateRange: endDate && currentFilter.dateRange?.startDate ? {
                          startDate: currentFilter.dateRange.startDate,
                          endDate,
                        } : undefined,
                      });
                    }}
                  />
                </div>
              </div>

              {/* Clear Filters */}
              <Separator />
              <Button
                variant='outline'
                onClick={() => {
                  setCurrentFilter({});
                  setSearchTerm('');
                  setCurrentPage(0);
                }}
                className='w-full'
              >
                모든 필터 지우기
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AuditDashboard;
