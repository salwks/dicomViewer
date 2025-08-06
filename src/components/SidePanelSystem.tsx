/**
 * SidePanelSystem - 통합 사이드 패널 시스템
 * 스터디/시리즈 브라우저와 비교 모드 컨트롤을 통합 관리
 * 새로운 ViewerContext 아키텍처 기반
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { useViewer, useViewerLayout } from '../context/ViewerContext';
import { ComparisonModeManager } from './ComparisonModeManager';
import { cn } from '../lib/utils';
import { simpleDicomLoader } from '../services/simpleDicomLoader';
import { log } from '../utils/logger';
import { Folder, Settings, BarChart3, AlertTriangle, Calendar, Stethoscope } from 'lucide-react';

interface SidePanelSystemProps {
  className?: string;
}

// 스터디 상태 인터페이스
interface StudyInfo {
  studyInstanceUID: string;
  patientName: string;
  patientId: string;
  studyDate: string;
  seriesCount: number;
  modality: string;
  safetyFlags: {
    patientMismatch?: boolean;
    dateConflict?: boolean;
    modalityIncompatible?: boolean;
  };
}

// 환자 안전 지표 타입
interface SafetyIndicator {
  type: 'patient' | 'date' | 'modality';
  severity: 'warning' | 'error';
  message: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Mock 스터디 데이터
const mockStudies: StudyInfo[] = [
  {
    studyInstanceUID: 'study-001',
    patientName: 'John Doe',
    patientId: 'PAT001',
    studyDate: '2024-01-15',
    seriesCount: 3,
    modality: 'CT',
    safetyFlags: {},
  },
  {
    studyInstanceUID: 'study-002',
    patientName: 'Jane Smith',
    patientId: 'PAT002',
    studyDate: '2024-01-14',
    seriesCount: 2,
    modality: 'MR',
    safetyFlags: {
      patientMismatch: true,
    },
  },
  {
    studyInstanceUID: 'study-003',
    patientName: 'Bob Johnson',
    patientId: 'PAT003',
    studyDate: '2023-12-20',
    seriesCount: 4,
    modality: 'US',
    safetyFlags: {
      dateConflict: true,
      modalityIncompatible: true,
    },
  },
];

export const SidePanelSystem: React.FC<SidePanelSystemProps> = ({ className }) => {
  const { state, loadStudyInViewport } = useViewer();
  const layout = useViewerLayout();

  const handleStudyLoad = async (studyInstanceUID: string) => {
    // 첫 번째 사용 가능한 뷰포트에 로드
    const availableViewport = state.viewports.find(v => !v.studyInstanceUID);
    if (availableViewport) {
      // Get series data to load the first series automatically
      const seriesData = await simpleDicomLoader.getSeriesData();
      const studySeries = seriesData.filter(s => s.studyInstanceUID === studyInstanceUID);

      log.info('SidePanelSystem series lookup', {
        component: 'SidePanelSystem',
        metadata: {
          studyInstanceUID,
          totalSeriesData: seriesData.length,
          allStudyUIDs: seriesData.map(s => s.studyInstanceUID),
          studySeriesCount: studySeries.length,
          studySeriesUIDs: studySeries.map(s => s.seriesInstanceUID),
          firstSeriesData: seriesData[0] ? {
            studyUID: seriesData[0].studyInstanceUID,
            seriesUID: seriesData[0].seriesInstanceUID,
            studyUIDMatch: seriesData[0].studyInstanceUID === studyInstanceUID,
            studyUIDType: typeof seriesData[0].studyInstanceUID,
            targetStudyUIDType: typeof studyInstanceUID,
          } : null,
        },
      });

      if (studySeries.length > 0) {
        const firstSeries = studySeries[0];
        log.info('Loading study with first series', {
          component: 'SidePanelSystem',
          metadata: {
            studyInstanceUID,
            seriesInstanceUID: firstSeries.seriesInstanceUID,
            viewportId: availableViewport.id,
            firstSeriesTitle: firstSeries.seriesDescription || 'No description',
          },
        });

        loadStudyInViewport(availableViewport.id, studyInstanceUID, firstSeries.seriesInstanceUID);
      } else {
        log.warn('No series found for study, loading study only', {
          component: 'SidePanelSystem',
          metadata: { studyInstanceUID },
        });

        loadStudyInViewport(availableViewport.id, studyInstanceUID);
      }
    }
  };

  // 환자 안전 지표 생성
  const generateSafetyIndicators = (study: StudyInfo): SafetyIndicator[] => {
    const indicators: SafetyIndicator[] = [];

    if (study.safetyFlags.patientMismatch) {
      indicators.push({
        type: 'patient',
        severity: 'error',
        message: '환자 정보 불일치',
        icon: AlertTriangle,
      });
    }

    if (study.safetyFlags.dateConflict) {
      indicators.push({
        type: 'date',
        severity: 'warning',
        message: '스터디 날짜 충돌',
        icon: Calendar,
      });
    }

    if (study.safetyFlags.modalityIncompatible) {
      indicators.push({
        type: 'modality',
        severity: 'warning',
        message: '모달리티 호환성 문제',
        icon: Stethoscope,
      });
    }

    return indicators;
  };

  // 안전 지표 배지 컴포넌트
  const SafetyIndicatorBadge = ({ indicator }: { indicator: SafetyIndicator }) => {
    const Icon = indicator.icon;
    return (
      <Badge
        variant={indicator.severity === 'error' ? 'destructive' : 'secondary'}
        className={cn(
          'text-xs flex items-center gap-1',
          indicator.severity === 'warning' && 'bg-amber-100 text-amber-800',
        )}
      >
        <Icon className='h-3 w-3' />
        {indicator.type === 'patient' && '환자'}
        {indicator.type === 'date' && '날짜'}
        {indicator.type === 'modality' && '모달리티'}
      </Badge>
    );
  };

  return (
    <Card className={cn('w-80 h-full flex flex-col', className)}>
      <CardHeader className='pb-3'>
        <CardTitle className='text-lg flex items-center gap-2'>
          <Folder className='h-5 w-5' />
          브라우저
        </CardTitle>
      </CardHeader>

      <CardContent className='flex-1 p-0'>
        <Tabs defaultValue='studies' className='h-full flex flex-col'>
          <TabsList className='grid w-full grid-cols-3'>
            <TabsTrigger value='studies' className='text-xs'>
              스터디
            </TabsTrigger>
            <TabsTrigger value='comparison' className='text-xs'>
              비교
            </TabsTrigger>
            <TabsTrigger value='settings' className='text-xs'>
              설정
            </TabsTrigger>
          </TabsList>

          <div className='flex-1 mt-2'>
            <TabsContent value='studies' className='h-full'>
              <ScrollArea className='h-full'>
                <div className='space-y-2'>
                  <div className='text-sm font-medium mb-3'>스터디 목록</div>

                  {mockStudies.map(study => {
                    const safetyIndicators = generateSafetyIndicators(study);
                    const hasErrors = safetyIndicators.some(i => i.severity === 'error');

                    return (
                      <Card
                        key={study.studyInstanceUID}
                        className={cn(
                          'p-3 cursor-pointer transition-colors',
                          hasErrors
                            ? 'border-destructive/50 bg-destructive/5 hover:bg-destructive/10'
                            : 'hover:bg-accent',
                        )}
                        onClick={() => handleStudyLoad(study.studyInstanceUID)}
                      >
                        <div className='space-y-2'>
                          <div className='flex items-center justify-between'>
                            <Badge variant='outline' className='text-xs'>
                              {study.studyInstanceUID.slice(-6)}
                            </Badge>
                            <div className='flex items-center gap-1'>
                              <Badge variant='secondary' className='text-xs'>
                                {study.seriesCount}개 시리즈
                              </Badge>
                              <Badge variant='outline' className='text-xs'>
                                {study.modality}
                              </Badge>
                            </div>
                          </div>

                          {/* 안전 지표 영역 */}
                          {safetyIndicators.length > 0 && (
                            <div className='flex flex-wrap gap-1'>
                              {safetyIndicators.map((indicator, index) => (
                                <SafetyIndicatorBadge key={`${indicator.type}-${index}`} indicator={indicator} />
                              ))}
                            </div>
                          )}

                          <div>
                            <div className='font-medium text-sm flex items-center gap-2'>
                              {study.patientName}
                              <span className='text-xs text-muted-foreground font-normal'>({study.patientId})</span>
                            </div>
                            <div className='text-xs text-muted-foreground'>{study.studyDate}</div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}

                  {mockStudies.length === 0 && (
                    <div className='text-center text-muted-foreground text-sm py-8'>
                      <Folder className='h-8 w-8 mx-auto mb-2 opacity-50' />
                      스터디가 없습니다
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value='comparison' className='h-full'>
              <ScrollArea className='h-full'>
                <div className='space-y-4'>
                  <div className='text-sm font-medium'>비교 모드 제어</div>

                  {layout.rows > 1 || layout.cols > 1 ? (
                    <ComparisonModeManager />
                  ) : (
                    <Card className='p-3'>
                      <div className='text-center text-muted-foreground text-sm'>
                        <BarChart3 className='h-8 w-8 mx-auto mb-2 opacity-50' />
                        다중 뷰포트 레이아웃을 설정하여
                        <br />
                        동기화 옵션을 사용하세요
                      </div>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value='settings' className='h-full'>
              <ScrollArea className='h-full'>
                <div className='space-y-4'>
                  <div className='text-sm font-medium'>뷰어 설정</div>

                  <Card className='p-3'>
                    <div className='space-y-3'>
                      <div className='flex items-center justify-between'>
                        <span className='text-sm'>레이아웃</span>
                        <Badge variant='secondary' className='text-xs'>
                          {layout.rows}×{layout.cols}
                        </Badge>
                      </div>

                      <Separator />

                      <div className='flex items-center justify-between'>
                        <span className='text-sm'>활성 뷰포트</span>
                        <Badge variant='default' className='text-xs'>
                          {state.viewports.filter(v => v.isActive).length}개
                        </Badge>
                      </div>
                    </div>
                  </Card>

                  <div className='text-center text-muted-foreground text-sm'>
                    <Settings className='h-6 w-6 mx-auto mb-2 opacity-50' />
                    추가 설정 준비 중...
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
};
