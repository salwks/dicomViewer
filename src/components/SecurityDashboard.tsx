/**
 * Security Dashboard Component
 * Comprehensive security monitoring and validation dashboard
 * Built with shadcn/ui components for medical compliance
 */

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { Progress } from './ui/progress';
import { useSecurityValidator } from '../hooks/useSecurityValidator';
import { securityHeaders as securityHeadersManager } from '../security/SecurityHeaders';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Eye,
  Lock,
  FileCheck,
  Settings,
  TrendingUp,
  AlertCircle,
  Zap,
} from 'lucide-react';

interface SecurityDashboardProps {
  className?: string;
}

export const SecurityDashboard: React.FC<SecurityDashboardProps> = ({ className }) => {
  const {
    securityLevel,
    isSecurityCompromised,
    lastValidationResult,
    validationHistory,
    getValidationStats,
    validateInput,
    validateMedicalData,
    sanitizeHTML,
    generateCSRFToken,
  } = useSecurityValidator();

  // State
  const [selectedTab, setSelectedTab] = useState('overview');
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [securityHeaders, setSecurityHeaders] = useState<Record<string, string>>({});
  const [headerValidation, setHeaderValidation] = useState<any>(null);
  const [stats, setStats] = useState(getValidationStats());

  // Load security headers and validation on mount
  useEffect(() => {
    const headers = securityHeadersManager.generateSecurityHeaders();
    setSecurityHeaders(headers);

    const validation = securityHeadersManager.validateSecurityHeaders(headers);
    setHeaderValidation(validation);
  }, []);

  // Update stats regularly
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(getValidationStats());
    }, 5000);

    return () => clearInterval(interval);
  }, [getValidationStats]);

  // Security level color mapping
  const getSecurityLevelColor = (level: string): string => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Test input validation
  const handleTestInput = useCallback((input: string, type: 'text' | 'medical' | 'html') => {
    let result;

    switch (type) {
      case 'medical':
        result = validateMedicalData({
          patientId: input.includes('PAT') ? input : undefined,
          studyId: input.includes('.') ? input : undefined,
        });
        break;
      case 'html':
        result = {
          sanitized: sanitizeHTML(input),
          original: input,
        };
        break;
      default:
        result = validateInput(input, 'test_field', 'string');
    }

    setTestResult(result);
  }, [validateInput, validateMedicalData, sanitizeHTML]);

  // Generate new CSRF token
  const handleGenerateCSRF = useCallback(() => {
    const token = generateCSRFToken();
    setCsrfToken(token);
  }, [generateCSRFToken]);

  // Calculate security score
  const calculateSecurityScore = useCallback((): number => {
    const baseScore = 100;
    const penalties = {
      critical: 40,
      high: 20,
      medium: 10,
      low: 5,
    };

    let score = baseScore;

    // Deduct for recent issues
    stats.recentIssues.forEach(issue => {
      score -= penalties[issue.riskLevel] || 0;
    });

    // Deduct for overall failure rate
    if (stats.totalValidations > 0) {
      const failureRate = stats.failedValidations / stats.totalValidations;
      score -= Math.floor(failureRate * 30);
    }

    // Deduct for security compromise
    if (isSecurityCompromised) {
      score -= 50;
    }

    return Math.max(0, Math.min(100, score));
  }, [stats, isSecurityCompromised]);

  const securityScore = calculateSecurityScore();

  return (
    <div className={cn('w-full space-y-6', className)}>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center space-x-2'>
          <Shield className='h-6 w-6 text-primary' />
          <h1 className='text-2xl font-bold'>보안 대시보드</h1>
        </div>

        <div className='flex items-center space-x-2'>
          <Badge className={getSecurityLevelColor(securityLevel)}>
            보안 수준: {securityLevel.toUpperCase()}
          </Badge>
          {isSecurityCompromised && (
            <Badge className='bg-red-100 text-red-800'>
              <AlertTriangle className='h-3 w-3 mr-1' />
              보안 침해 감지
            </Badge>
          )}
        </div>
      </div>

      {/* Security Score */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center'>
            <TrendingUp className='h-5 w-5 mr-2' />
            보안 점수
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <span className='text-3xl font-bold'>{securityScore}/100</span>
              <div className='flex items-center space-x-2'>
                {securityScore >= 90 ? (
                  <CheckCircle className='h-6 w-6 text-green-600' />
                ) : securityScore >= 70 ? (
                  <AlertCircle className='h-6 w-6 text-yellow-600' />
                ) : (
                  <XCircle className='h-6 w-6 text-red-600' />
                )}
              </div>
            </div>
            <Progress
              value={securityScore}
              className={cn(
                'w-full',
                securityScore >= 90 ? 'progress-green' :
                  securityScore >= 70 ? 'progress-yellow' :
                    securityScore >= 50 ? 'progress-orange' : 'progress-red',
              )}
            />
            <p className='text-sm text-muted-foreground'>
              {securityScore >= 90 ? '우수한 보안 상태입니다' :
                securityScore >= 70 ? '양호한 보안 상태입니다' :
                  securityScore >= 50 ? '보안 개선이 필요합니다' :
                    '즉시 보안 조치가 필요합니다'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Overview */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>총 검증</CardTitle>
            <Activity className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.totalValidations.toLocaleString()}</div>
            <p className='text-xs text-muted-foreground'>
              성공률: {stats.totalValidations > 0 ?
                ((stats.passedValidations / stats.totalValidations) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>성공한 검증</CardTitle>
            <CheckCircle className='h-4 w-4 text-green-600' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-green-600'>{stats.passedValidations}</div>
            <p className='text-xs text-muted-foreground'>
              유효한 입력
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>실패한 검증</CardTitle>
            <XCircle className='h-4 w-4 text-red-600' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-red-600'>{stats.failedValidations}</div>
            <p className='text-xs text-muted-foreground'>
              보안 위험 감지
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>심각한 문제</CardTitle>
            <AlertTriangle className='h-4 w-4 text-orange-600' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-orange-600'>{stats.criticalIssues}</div>
            <p className='text-xs text-muted-foreground'>
              즉시 조치 필요
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className='w-full'>
        <TabsList className='grid w-full grid-cols-5'>
          <TabsTrigger value='overview'>개요</TabsTrigger>
          <TabsTrigger value='validation'>검증 테스트</TabsTrigger>
          <TabsTrigger value='headers'>보안 헤더</TabsTrigger>
          <TabsTrigger value='history'>검증 기록</TabsTrigger>
          <TabsTrigger value='tools'>보안 도구</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value='overview' className='space-y-4'>
          {/* Last Validation Result */}
          {lastValidationResult && (
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center'>
                  <Eye className='h-5 w-5 mr-2' />
                  최근 검증 결과
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-3'>
                  <div className='flex items-center justify-between'>
                    <span className='font-medium'>상태:</span>
                    <Badge className={lastValidationResult.isValid ?
                      'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }>
                      {lastValidationResult.isValid ? '통과' : '실패'}
                    </Badge>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span className='font-medium'>위험 수준:</span>
                    <Badge className={getSecurityLevelColor(lastValidationResult.riskLevel)}>
                      {lastValidationResult.riskLevel.toUpperCase()}
                    </Badge>
                  </div>
                  {lastValidationResult.errors.length > 0 && (
                    <div>
                      <span className='font-medium'>오류:</span>
                      <ul className='list-disc list-inside text-sm text-red-600 mt-1'>
                        {lastValidationResult.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {lastValidationResult.warnings.length > 0 && (
                    <div>
                      <span className='font-medium'>경고:</span>
                      <ul className='list-disc list-inside text-sm text-yellow-600 mt-1'>
                        {lastValidationResult.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Issues */}
          {stats.recentIssues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center'>
                  <AlertTriangle className='h-5 w-5 mr-2' />
                  최근 보안 문제
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-2'>
                  {stats.recentIssues.slice(0, 5).map((issue, index) => (
                    <div key={index} className='flex items-center justify-between p-2 border rounded'>
                      <div className='flex items-center space-x-2'>
                        <Badge className={getSecurityLevelColor(issue.riskLevel)}>
                          {issue.riskLevel}
                        </Badge>
                        <span className='text-sm'>{issue.errors[0] || '알 수 없는 오류'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Validation Testing Tab */}
        <TabsContent value='validation' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center'>
                <FileCheck className='h-5 w-5 mr-2' />
                입력 검증 테스트
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='test-input'>테스트 입력</Label>
                <Input
                  id='test-input'
                  placeholder='검증할 텍스트를 입력하세요...'
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                />
              </div>

              <div className='flex space-x-2'>
                <Button
                  onClick={() => handleTestInput(testInput, 'text')}
                  variant='outline'
                  size='sm'
                >
                  텍스트 검증
                </Button>
                <Button
                  onClick={() => handleTestInput(testInput, 'medical')}
                  variant='outline'
                  size='sm'
                >
                  의료 데이터 검증
                </Button>
                <Button
                  onClick={() => handleTestInput(testInput, 'html')}
                  variant='outline'
                  size='sm'
                >
                  HTML 정리
                </Button>
              </div>

              {testResult && (
                <div className='mt-4 p-4 border rounded-lg bg-muted/50'>
                  <h4 className='font-medium mb-2'>검증 결과:</h4>
                  <pre className='text-sm overflow-auto'>
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Headers Tab */}
        <TabsContent value='headers' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center'>
                <Lock className='h-5 w-5 mr-2' />
                보안 헤더 상태
              </CardTitle>
            </CardHeader>
            <CardContent>
              {headerValidation && (
                <>
                  <div className='flex items-center space-x-2 mb-4'>
                    <Badge className={headerValidation.isSecure ?
                      'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }>
                      {headerValidation.isSecure ? '보안됨' : '취약함'}
                    </Badge>
                    <span className='text-sm text-muted-foreground'>
                      {headerValidation.missingHeaders.length}개 누락, {headerValidation.recommendations.length}개 권고사항
                    </span>
                  </div>

                  {headerValidation.missingHeaders.length > 0 && (
                    <div className='mb-4'>
                      <h5 className='font-medium text-red-600 mb-2'>누락된 헤더:</h5>
                      <ul className='list-disc list-inside text-sm space-y-1'>
                        {headerValidation.missingHeaders.map((header: string, index: number) => (
                          <li key={index}>{header}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className='space-y-2'>
                    <h5 className='font-medium'>현재 보안 헤더:</h5>
                    <div className='max-h-96 overflow-auto'>
                      {Object.entries(securityHeaders).map(([header, value]) => (
                        <div key={header} className='p-2 border rounded text-xs'>
                          <div className='font-medium'>{header}:</div>
                          <div className='text-muted-foreground break-all'>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Validation History Tab */}
        <TabsContent value='history' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center'>
                <Activity className='h-5 w-5 mr-2' />
                검증 기록 ({validationHistory.length}개)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-2 max-h-96 overflow-y-auto'>
                {validationHistory.slice(0, 20).map((result, index) => (
                  <div key={index} className='flex items-center justify-between p-2 border rounded'>
                    <div className='flex items-center space-x-2'>
                      <Badge className={getSecurityLevelColor(result.riskLevel)}>
                        {result.riskLevel}
                      </Badge>
                      <Badge className={result.isValid ?
                        'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }>
                        {result.isValid ? '통과' : '실패'}
                      </Badge>
                    </div>
                    <div className='text-sm text-muted-foreground'>
                      {result.errors.length > 0 ? result.errors[0] : '문제 없음'}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tools Tab */}
        <TabsContent value='tools' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center'>
                <Zap className='h-5 w-5 mr-2' />
                CSRF 토큰 관리
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex items-center space-x-2'>
                <Button onClick={handleGenerateCSRF} size='sm'>
                  새 토큰 생성
                </Button>
                {csrfToken && (
                  <Badge variant='outline' className='font-mono'>
                    {csrfToken.substring(0, 16)}...
                  </Badge>
                )}
              </div>

              {csrfToken && (
                <div className='p-3 bg-muted rounded text-xs font-mono break-all'>
                  {csrfToken}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='flex items-center'>
                <Settings className='h-5 w-5 mr-2' />
                보안 설정
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertTriangle className='h-4 w-4' />
                <AlertDescription>
                  보안 설정 변경은 시스템 관리자만 가능합니다.
                  설정 변경이 필요한 경우 관리자에게 문의하세요.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SecurityDashboard;
