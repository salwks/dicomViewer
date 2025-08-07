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
import { Button } from './ui/button';
import { useViewer, useViewerLayout } from '../context/ViewerContext';
import { ComparisonModeManager } from './ComparisonModeManager';
import { cn } from '../lib/utils';
import { simpleDicomLoader } from '../services/simpleDicomLoader';
import { log } from '../utils/logger';
import { Folder, Settings, BarChart3, AlertTriangle, Calendar, Stethoscope, X } from 'lucide-react';

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


export const SidePanelSystem: React.FC<SidePanelSystemProps> = ({ className }) => {
  const { state, loadStudyInViewport } = useViewer();
  const layout = useViewerLayout();
  const [studies, setStudies] = React.useState<StudyInfo[]>([]);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  // DICOM 파일 로드를 감지하여 스터디 목록 업데이트
  const loadStudiesFromDicomData = React.useCallback(async () => {
    try {
      const seriesData = await simpleDicomLoader.getSeriesData();
      
      log.info('Updating studies from DICOM data', {
        component: 'SidePanelSystem',
        metadata: {
          seriesCount: seriesData.length,
          series: seriesData.map(s => ({
            studyUID: s.studyInstanceUID,
            seriesUID: s.seriesInstanceUID,
            patientName: s.patientName,
            modality: s.modality
          }))
        }
      });
      
      // 스터디별로 그룹화
      const studyMap = new Map<string, StudyInfo>();
      
      for (const series of seriesData) {
        const studyUID = series.studyInstanceUID;
        
        if (!studyMap.has(studyUID)) {
          studyMap.set(studyUID, {
            studyInstanceUID: studyUID,
            patientName: series.patientName || 'Unknown Patient',
            patientId: `PAT${studyUID.slice(-3)}`,
            studyDate: series.studyDate || new Date().toISOString().split('T')[0],
            seriesCount: 1,
            modality: series.modality || 'OT',
            safetyFlags: {}
          });
        } else {
          const study = studyMap.get(studyUID)!;
          study.seriesCount++;
        }
      }
      
      const studiesArray = Array.from(studyMap.values());
      setStudies(studiesArray);
      
      log.info('Studies updated successfully', {
        component: 'SidePanelSystem',
        metadata: {
          studyCount: studiesArray.length,
          studies: studiesArray.map(s => ({
            studyUID: s.studyInstanceUID,
            patientName: s.patientName,
            seriesCount: s.seriesCount,
            modality: s.modality
          }))
        }
      });
      
    } catch (error) {
      log.warn('Failed to load studies from DICOM data', {
        component: 'SidePanelSystem',
      });
      setStudies([]);
    }
  }, []);

  // 컴포넌트 마운트 시 및 파일 로드 시 스터디 목록 업데이트
  React.useEffect(() => {
    loadStudiesFromDicomData();
  }, [loadStudiesFromDicomData, refreshTrigger]);

  // 전역 이벤트 리스너로 파일 로드 감지
  React.useEffect(() => {
    const handleDicomFilesLoaded = () => {
      log.info('DICOM files loaded event detected, refreshing studies', {
        component: 'SidePanelSystem'
      });
      setRefreshTrigger(prev => prev + 1);
    };

    // 커스텀 이벤트 리스너 등록
    window.addEventListener('dicom-files-loaded', handleDicomFilesLoaded);
    
    return () => {
      window.removeEventListener('dicom-files-loaded', handleDicomFilesLoaded);
    };
  }, []);

  const handleStudyLoad = async (studyInstanceUID: string) => {
    // 활성 뷰포트에 로드 (없으면 첫 번째 뷰포트 사용)
    const activeViewportId = state.activeViewportId || state.viewports[0]?.id;
    
    if (!activeViewportId) {
      log.warn('No viewport available for loading study', {
        component: 'SidePanelSystem',
        metadata: { studyInstanceUID },
      });
      return;
    }

    try {
      // Get series data to load the first series automatically
      const seriesData = await simpleDicomLoader.getSeriesData();
      const studySeries = seriesData.filter(s => s.studyInstanceUID === studyInstanceUID);

      log.info('Loading study in active viewport', {
        component: 'SidePanelSystem',
        metadata: {
          studyInstanceUID,
          activeViewportId,
          totalSeriesData: seriesData.length,
          studySeriesCount: studySeries.length,
          studySeriesUIDs: studySeries.map(s => s.seriesInstanceUID),
        },
      });

      if (studySeries.length > 0) {
        const firstSeries = studySeries[0];
        log.info('Loading study with first series', {
          component: 'SidePanelSystem',
          metadata: {
            studyInstanceUID,
            seriesInstanceUID: firstSeries.seriesInstanceUID,
            viewportId: activeViewportId,
            seriesDescription: firstSeries.seriesDescription,
            patientName: firstSeries.patientName,
            modality: firstSeries.modality,
          },
        });

        // 활성 뷰포트에 스터디 로드
        loadStudyInViewport(activeViewportId, studyInstanceUID, firstSeries.seriesInstanceUID);
      } else {
        log.warn('No series found for study, loading study only', {
          component: 'SidePanelSystem',
          metadata: { studyInstanceUID, activeViewportId },
        });

        loadStudyInViewport(activeViewportId, studyInstanceUID);
      }
    } catch (error) {
      log.error('Failed to load study', {
        component: 'SidePanelSystem',
        metadata: { studyInstanceUID, activeViewportId },
      }, error as Error);
    }
  };

  // 스터디 삭제 함수
  const handleStudyDelete = async (studyInstanceUID: string, event: React.MouseEvent) => {
    // 이벤트 버블링 방지 (스터디 카드 클릭 이벤트와 충돌 방지)
    event.stopPropagation();

    try {
      log.info('Deleting study', {
        component: 'SidePanelSystem',
        metadata: { studyInstanceUID },
      });

      // simpleDicomLoader에서 해당 스터디의 파일들 삭제
      simpleDicomLoader.removeStudy(studyInstanceUID);

      // 해당 스터디가 현재 뷰포트에 로드되어 있다면 뷰포트 클리어
      const affectedViewports = state.viewports.filter(v => v.studyInstanceUID === studyInstanceUID);
      
      for (const viewport of affectedViewports) {
        log.info('Clearing viewport with deleted study', {
          component: 'SidePanelSystem',
          metadata: { viewportId: viewport.id, studyInstanceUID },
        });
        
        // 뷰포트에서 스터디 정보 제거
        loadStudyInViewport(viewport.id, '', '');
      }

      // 스터디 목록 새로고침
      setRefreshTrigger(prev => prev + 1);

      // 글로벌 이벤트 발생 (다른 컴포넌트들에게 알림)
      window.dispatchEvent(new CustomEvent('study-deleted', {
        detail: { studyInstanceUID }
      }));

      log.info('Study deleted successfully', {
        component: 'SidePanelSystem',
        metadata: { 
          studyInstanceUID,
          affectedViewports: affectedViewports.length
        },
      });

    } catch (error) {
      log.error('Failed to delete study', {
        component: 'SidePanelSystem',
        metadata: { studyInstanceUID },
      }, error as Error);
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

                  {studies.map(study => {
                    const safetyIndicators = generateSafetyIndicators(study);
                    const hasErrors = safetyIndicators.some(i => i.severity === 'error');
                    
                    // 현재 활성 뷰포트에 로드된 스터디인지 확인
                    const activeViewport = state.viewports.find(v => v.id === state.activeViewportId);
                    const isActiveStudy = activeViewport?.studyInstanceUID === study.studyInstanceUID;

                    return (
                      <Card
                        key={study.studyInstanceUID}
                        className={cn(
                          'p-3 cursor-pointer transition-colors',
                          hasErrors
                            ? 'border-destructive/50 bg-destructive/5 hover:bg-destructive/10'
                            : isActiveStudy
                            ? 'border-primary bg-primary/5 hover:bg-primary/10'
                            : 'hover:bg-accent',
                        )}
                        onClick={() => handleStudyLoad(study.studyInstanceUID)}
                      >
                        <div className='space-y-2'>
                          {/* 헤더 영역 - X 버튼 포함 */}
                          <div className='flex items-center justify-between'>
                            <div className='flex items-center gap-2'>
                              <Badge variant='outline' className='text-xs'>
                                {study.studyInstanceUID.slice(-6)}
                              </Badge>
                              {isActiveStudy && (
                                <Badge variant='default' className='text-xs bg-primary'>
                                  활성화
                                </Badge>
                              )}
                            </div>
                            
                            {/* 우측 정보 및 삭제 버튼 */}
                            <div className='flex items-center gap-1'>
                              <Badge variant='secondary' className='text-xs'>
                                {study.seriesCount}개 시리즈
                              </Badge>
                              <Badge variant='outline' className='text-xs'>
                                {study.modality}
                              </Badge>
                              
                              {/* 삭제 버튼 */}
                              <Button
                                variant='ghost'
                                size='sm'
                                className='h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground'
                                onClick={(e) => handleStudyDelete(study.studyInstanceUID, e)}
                                title={`스터디 ${study.studyInstanceUID.slice(-6)} 삭제`}
                              >
                                <X className='h-3 w-3' />
                              </Button>
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

                  {studies.length === 0 && (
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
