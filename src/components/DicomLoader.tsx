/**
 * DicomLoader Component
 * DICOM 파일 로딩을 위한 UI 컴포넌트
 * 드래그 앤 드롭, 파일 선택, 샘플 로딩 지원
 * Built with shadcn/ui components
 */

import React, { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { useDicomLoader } from '@/hooks/useDicomLoader';
import type { DicomStudyInfo, DicomSeriesInfo } from '@/services/RealDicomDataService';
import {
  Upload,
  FileText,
  FolderOpen,
  AlertCircle,
  Info,
  Download,
  Trash2,
  FileImage,
  Layers,
  User,
  Calendar,
  Building,
  Database,
  Globe,
} from 'lucide-react';

interface DicomLoaderProps {
  onStudyLoad?: (study: DicomStudyInfo) => void;
  onSeriesSelect?: (series: DicomSeriesInfo, imageIds: string[]) => void;
  className?: string;
  autoLoadSample?: boolean;
}

export const DicomLoader: React.FC<DicomLoaderProps> = ({
  onStudyLoad,
  onSeriesSelect,
  className,
  autoLoadSample = false,
}) => {
  const {
    state,
    loadDicomFile,
    loadDicomFiles,
    loadSampleDicom,
    loadDicomWebStudy,
    selectStudy,
    selectSeries,
    clearError,
    clearStudies,
    removeStudy,
    getImageIds,
  } = useDicomLoader();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dicomWebUrl, setDicomWebUrl] = useState('');
  const [dicomWebStudyId, setDicomWebStudyId] = useState('');

  // 자동 샘플 로딩
  React.useEffect(() => {
    if (autoLoadSample && state.loadedStudies.length === 0) {
      loadSampleDicom({ prefetchImages: true }).catch(console.error);
    }
  }, [autoLoadSample, loadSampleDicom, state.loadedStudies.length]);

  // 스터디 로드 콜백
  React.useEffect(() => {
    if (state.selectedStudy && onStudyLoad) {
      onStudyLoad(state.selectedStudy);
    }
  }, [state.selectedStudy, onStudyLoad]);

  // 시리즈 선택 콜백
  React.useEffect(() => {
    if (state.selectedStudy && state.selectedSeries && onSeriesSelect) {
      const imageIds = getImageIds(state.selectedStudy.studyInstanceUID, state.selectedSeries.seriesInstanceUID);
      onSeriesSelect(state.selectedSeries, imageIds);
    }
  }, [state.selectedStudy, state.selectedSeries, onSeriesSelect, getImageIds]);

  // 파일 선택 핸들러
  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 파일 입력 변경 핸들러
  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      if (files.length === 1) {
        const file = files[0];
        if (file) {
          await loadDicomFile(file, { prefetchImages: true });
        }
      } else {
        await loadDicomFiles(files, { prefetchImages: false });
      }

      // 입력 초기화
      if (event.target) {
        event.target.value = '';
      }
    },
    [loadDicomFile, loadDicomFiles],
  );

  // 드래그 이벤트 핸들러
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (!files || files.length === 0) return;

      if (files.length === 1) {
        const file = files[0];
        if (file) {
          await loadDicomFile(file, { prefetchImages: true });
        }
      } else {
        await loadDicomFiles(files, { prefetchImages: false });
      }
    },
    [loadDicomFile, loadDicomFiles],
  );

  // 샘플 로딩 핸들러
  const handleLoadSample = useCallback(async () => {
    await loadSampleDicom({ prefetchImages: true, generateThumbnails: true });
  }, [loadSampleDicom]);

  // DICOM Web 로딩 핸들러
  const handleLoadDicomWeb = useCallback(async () => {
    if (!dicomWebUrl || !dicomWebStudyId) {
      return;
    }

    await loadDicomWebStudy(dicomWebUrl, dicomWebStudyId, {
      prefetchImages: false,
      generateThumbnails: true,
    });
  }, [dicomWebUrl, dicomWebStudyId, loadDicomWebStudy]);

  // 스터디 정보 포맷팅
  const formatDate = (dateStr: string): string => {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className='pb-4'>
        <div className='flex items-center justify-between'>
          <CardTitle className='text-base font-semibold flex items-center gap-2'>
            <FileImage className='h-5 w-5' />
            DICOM Loader
          </CardTitle>
          <div className='flex items-center space-x-2'>
            {state.loadedStudies.length > 0 && (
              <Badge variant='secondary' className='text-xs'>
                {state.loadedStudies.length} studies
              </Badge>
            )}
            {state.isLoading && (
              <Badge variant='outline' className='text-xs animate-pulse'>
                Loading...
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className='space-y-6'>
        {/* 에러 알림 */}
        {state.error && (
          <Alert variant='destructive'>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription className='flex items-center justify-between'>
              {state.error}
              <Button variant='ghost' size='sm' onClick={clearError}>
                확인
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* 로딩 진행률 */}
        {state.loadProgress && state.loadProgress.status === 'loading' && (
          <div className='space-y-2'>
            <div className='flex items-center justify-between text-sm'>
              <span className='text-muted-foreground'>Loading DICOM...</span>
              <span className='text-xs'>
                {state.loadProgress.loadedImages} / {state.loadProgress.totalImages}
              </span>
            </div>
            <Progress
              value={(state.loadProgress.loadedImages / state.loadProgress.totalImages) * 100}
              className='h-2'
            />
            {state.loadProgress.currentImageId && (
              <p className='text-xs text-muted-foreground truncate'>{state.loadProgress.currentImageId}</p>
            )}
          </div>
        )}

        <Tabs defaultValue='local' className='w-full'>
          <TabsList className='grid w-full grid-cols-3'>
            <TabsTrigger value='local'>Local Files</TabsTrigger>
            <TabsTrigger value='web'>DICOM Web</TabsTrigger>
            <TabsTrigger value='sample'>Sample</TabsTrigger>
          </TabsList>

          {/* 로컬 파일 탭 */}
          <TabsContent value='local' className='space-y-4'>
            {/* 드래그 앤 드롭 영역 */}
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
                'hover:border-primary/50 hover:bg-muted/50',
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className='h-12 w-12 mx-auto mb-4 text-muted-foreground' />
              <p className='text-sm font-medium mb-2'>Drag and drop DICOM files here</p>
              <p className='text-xs text-muted-foreground mb-4'>or click to browse files</p>
              <Button onClick={handleFileSelect} variant='outline' size='sm'>
                <FolderOpen className='h-4 w-4 mr-2' />
                Browse Files
              </Button>

              <input
                ref={fileInputRef}
                type='file'
                multiple
                accept='.dcm,.dicom,application/dicom'
                onChange={handleFileChange}
                className='hidden'
              />
            </div>
          </TabsContent>

          {/* DICOM Web 탭 */}
          <TabsContent value='web' className='space-y-4'>
            <div className='space-y-3'>
              <div className='space-y-2'>
                <Label className='text-xs'>DICOM Web Server URL</Label>
                <input
                  type='text'
                  value={dicomWebUrl}
                  onChange={e => {
                    setDicomWebUrl(e.target.value);
                  }}
                  placeholder='https://dicom-server.example.com/dicom-web'
                  className='w-full px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring'
                />
              </div>

              <div className='space-y-2'>
                <Label className='text-xs'>Study Instance UID</Label>
                <input
                  type='text'
                  value={dicomWebStudyId}
                  onChange={e => {
                    setDicomWebStudyId(e.target.value);
                  }}
                  placeholder='1.2.840.113619.2.55.3.123456789...'
                  className='w-full px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring'
                />
              </div>

              <Button
                onClick={handleLoadDicomWeb}
                disabled={!dicomWebUrl || !dicomWebStudyId || state.isLoading}
                className='w-full'
              >
                <Globe className='h-4 w-4 mr-2' />
                Load from DICOM Web
              </Button>
            </div>
          </TabsContent>

          {/* 샘플 탭 */}
          <TabsContent value='sample' className='space-y-4'>
            <div className='text-center py-8'>
              <Database className='h-12 w-12 mx-auto mb-4 text-muted-foreground' />
              <p className='text-sm mb-4'>Load a sample DICOM file for testing</p>
              <Button onClick={handleLoadSample} disabled={state.isLoading} variant='outline'>
                <Download className='h-4 w-4 mr-2' />
                Load Sample DICOM
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <Separator />

        {/* 로딩된 스터디 목록 */}
        {state.loadedStudies.length > 0 && (
          <div className='space-y-3'>
            <Label className='text-sm font-medium'>Loaded Studies</Label>

            <ScrollArea className='h-[300px] w-full rounded-md border p-4'>
              <div className='space-y-3'>
                {state.loadedStudies.map(study => (
                  <Card
                    key={study.studyInstanceUID}
                    className={cn(
                      'cursor-pointer transition-colors',
                      state.selectedStudy?.studyInstanceUID === study.studyInstanceUID
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50',
                    )}
                    onClick={() => {
                      selectStudy(study.studyInstanceUID);
                    }}
                  >
                    <CardContent className='p-4'>
                      {/* 스터디 헤더 */}
                      <div className='flex items-start justify-between mb-3'>
                        <div className='space-y-1'>
                          <div className='flex items-center space-x-2'>
                            <FileText className='h-4 w-4 text-muted-foreground' />
                            <span className='text-sm font-medium'>{study.studyDescription || 'Unknown Study'}</span>
                          </div>
                          <div className='flex items-center space-x-2 text-xs text-muted-foreground'>
                            <Calendar className='h-3 w-3' />
                            <span>{formatDate(study.studyDate)}</span>
                          </div>
                        </div>

                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={e => {
                            e.stopPropagation();
                            removeStudy(study.studyInstanceUID);
                          }}
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>

                      {/* 환자 정보 */}
                      <div className='grid grid-cols-2 gap-2 text-xs mb-3'>
                        <div className='flex items-center space-x-1'>
                          <User className='h-3 w-3 text-muted-foreground' />
                          <span>{study.patientName}</span>
                        </div>
                        <div className='flex items-center space-x-1'>
                          <Info className='h-3 w-3 text-muted-foreground' />
                          <span>ID: {study.patientId}</span>
                        </div>
                        {study.patientAge && (
                          <div className='flex items-center space-x-1'>
                            <span className='text-muted-foreground'>Age:</span>
                            <span>{study.patientAge}</span>
                          </div>
                        )}
                        {study.patientSex && (
                          <div className='flex items-center space-x-1'>
                            <span className='text-muted-foreground'>Sex:</span>
                            <span>{study.patientSex}</span>
                          </div>
                        )}
                      </div>

                      {/* 기관 정보 */}
                      {study.institutionName && (
                        <div className='flex items-center space-x-1 text-xs text-muted-foreground mb-3'>
                          <Building className='h-3 w-3' />
                          <span>{study.institutionName}</span>
                        </div>
                      )}

                      {/* 시리즈 목록 */}
                      <div className='space-y-2'>
                        <div className='flex items-center justify-between text-xs'>
                          <span className='text-muted-foreground'>Series</span>
                          <Badge variant='outline' className='text-xs'>
                            {study.seriesCount}
                          </Badge>
                        </div>

                        {state.selectedStudy?.studyInstanceUID === study.studyInstanceUID && (
                          <div className='space-y-1'>
                            {study.series.map(series => (
                              <div
                                key={series.seriesInstanceUID}
                                className={cn(
                                  'p-2 rounded-md text-xs cursor-pointer transition-colors',
                                  state.selectedSeries?.seriesInstanceUID === series.seriesInstanceUID
                                    ? 'bg-primary/10 border border-primary/20'
                                    : 'hover:bg-muted',
                                )}
                                onClick={e => {
                                  e.stopPropagation();
                                  selectSeries(series.seriesInstanceUID);
                                }}
                              >
                                <div className='flex items-center justify-between'>
                                  <div className='flex items-center space-x-2'>
                                    <Layers className='h-3 w-3 text-muted-foreground' />
                                    <span>{series.seriesDescription}</span>
                                  </div>
                                  <div className='flex items-center space-x-1'>
                                    <Badge variant='secondary' className='text-xs'>
                                      {series.modality}
                                    </Badge>
                                    <Badge variant='outline' className='text-xs'>
                                      {series.imageCount} images
                                    </Badge>
                                  </div>
                                </div>

                                {series.metadata && (
                                  <div className='mt-1 flex items-center space-x-3 text-xs text-muted-foreground'>
                                    {series.metadata.sliceThickness && (
                                      <span>Thickness: {series.metadata.sliceThickness}mm</span>
                                    )}
                                    {series.metadata.windowCenter && series.metadata.windowWidth && (
                                      <span>
                                        W/L: {series.metadata.windowWidth}/{series.metadata.windowCenter}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            {/* 모든 스터디 제거 */}
            <div className='flex justify-end'>
              <Button variant='outline' size='sm' onClick={clearStudies} disabled={state.isLoading}>
                <Trash2 className='h-4 w-4 mr-2' />
                Clear All Studies
              </Button>
            </div>
          </div>
        )}

        {/* 빈 상태 */}
        {state.loadedStudies.length === 0 && !state.isLoading && (
          <div className='text-center py-8 text-muted-foreground'>
            <FileImage className='h-12 w-12 mx-auto mb-4 opacity-50' />
            <p className='text-sm'>No DICOM studies loaded</p>
            <p className='text-xs mt-2'>Drop files here or use the options above to load DICOM data</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
