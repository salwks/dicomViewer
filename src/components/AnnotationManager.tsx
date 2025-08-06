/**
 * AnnotationManager Component
 * 주석 저장/불러오기를 위한 UI 컴포넌트
 * 어댑터 패턴이 적용된 서비스와 통합
 * Built with shadcn/ui components
 */

import React, { useState, useCallback, useRef } from 'react';
import { Types } from '@cornerstonejs/tools';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { Alert, AlertDescription } from './ui/alert';
import { useAnnotationPersistence } from '@/hooks/useAnnotationPersistence';
import { log } from '../utils/logger';
import { sanitizeMedicalToolName } from '../utils/secureObjectAccess';
import { Download, Upload, FileText, AlertCircle, Info, Settings } from 'lucide-react';

interface AnnotationManagerProps {
  annotations: Types.Annotation[];
  onAnnotationsLoad?: (annotations: Types.Annotation[]) => void;
  className?: string;
}

interface ExportSettings {
  format: string;
  filename: string;
  includeMetadata?: boolean;
  compact?: boolean;
  filterByTool?: string[];
  filterByFrameOfReference?: string;
}

export const AnnotationManager: React.FC<AnnotationManagerProps> = ({ annotations, onAnnotationsLoad, className }) => {
  const { state, downloadAsFile, loadFromFile, analyzeFile, clearError, getSupportedFormats, mergeAnnotations } =
    useAnnotationPersistence();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    format: 'JSON',
    filename: 'annotations.json',
    includeMetadata: true,
    compact: false,
  });

  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // 지원하는 포맷 목록
  const supportedFormats = getSupportedFormats();

  // 파일 저장 핸들러
  const handleSave = useCallback(async () => {
    try {
      const options: Record<string, unknown> = {};
      if (exportSettings.includeMetadata !== undefined) {
        options['includeMetadata'] = exportSettings.includeMetadata;
      }
      if (exportSettings.compact !== undefined) {
        options['compact'] = exportSettings.compact;
      }
      if (exportSettings.filterByTool !== undefined) {
        options['filterByTool'] = exportSettings.filterByTool;
      }
      if (exportSettings.filterByFrameOfReference !== undefined) {
        options['filterByFrameOfReference'] = exportSettings.filterByFrameOfReference;
      }

      await downloadAsFile(annotations, exportSettings.filename, options as any);
    } catch (error) {
      console.error('저장 실패:', error);
    }
  }, [annotations, exportSettings, downloadAsFile]);

  // 파일 선택 핸들러
  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 파일 불러오기 핸들러
  const handleFileLoad = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        // 파일 분석
        const fileInfo = await analyzeFile(file);
        log.info('파일 정보:', fileInfo);

        // 주석 불러오기
        const result = await loadFromFile(file);

        if (result.annotations.length > 0) {
          let finalAnnotations = result.annotations;

          // 병합 모드 처리
          if (importMode === 'merge' && onAnnotationsLoad) {
            finalAnnotations = mergeAnnotations(annotations, result.annotations);
          }

          onAnnotationsLoad?.(finalAnnotations);

          log.info(`${result.importedCount}개의 주석이 불러와졌습니다.`);
        }

        // 경고 표시
        if (result.warnings.length > 0) {
          console.warn('불러오기 경고:', result.warnings);
        }
      } catch (error) {
        console.error('파일 불러오기 실패:', error);
      }

      // 파일 입력 초기화
      if (event.target) {
        event.target.value = '';
      }
    },
    [loadFromFile, analyzeFile, importMode, annotations, mergeAnnotations, onAnnotationsLoad],
  );

  // 포맷 변경 핸들러
  const handleFormatChange = useCallback(
    (formatName: string) => {
      const format = supportedFormats.find(f => f.name === formatName);
      if (format) {
        const extension = format.extensions[0] ?? '.json';
        const baseName = exportSettings.filename.replace(/\.[^/.]+$/, '');

        setExportSettings(prev => ({
          ...prev,
          format: formatName,
          filename: `${baseName}${extension}`,
        }));
      }
    },
    [supportedFormats, exportSettings.filename],
  );

  // 통계 정보 생성
  const statisticsInfo = React.useMemo(() => {
    // 보안: Object Injection 방지를 위해 Map 사용
    const toolCounts = new Map<string, number>();
    const frameOfReferences = new Set<string>();

    annotations.forEach(annotation => {
      const toolName = annotation.metadata?.toolName ?? 'Unknown';
      // 의료 도구 이름 화이트리스트 검증
      const sanitizedToolName = sanitizeMedicalToolName(toolName);
      toolCounts.set(sanitizedToolName, (toolCounts.get(sanitizedToolName) ?? 0) + 1);

      if (annotation.metadata?.FrameOfReferenceUID) {
        frameOfReferences.add(annotation.metadata.FrameOfReferenceUID);
      }
    });

    return {
      totalCount: annotations.length,
      toolCounts,
      frameOfReferences: Array.from(frameOfReferences),
    };
  }, [annotations]);

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className='pb-4'>
        <div className='flex items-center justify-between'>
          <CardTitle className='text-base font-semibold flex items-center gap-2'>
            <FileText className='h-5 w-5' />
            Annotation Manager
          </CardTitle>
          <div className='flex items-center space-x-2'>
            <Badge variant='secondary' className='text-xs'>
              {annotations.length} annotations
            </Badge>
            {(state.isLoading || state.isSaving) && (
              <Badge variant='outline' className='text-xs animate-pulse'>
                {state.isSaving ? 'Saving...' : 'Loading...'}
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

        {/* 주석 통계 */}
        <div className='space-y-3'>
          <Label className='text-sm font-medium'>현재 주석 정보</Label>
          <div className='grid grid-cols-2 gap-3 text-xs'>
            <div className='space-y-2'>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>총 개수:</span>
                <Badge variant='secondary'>{statisticsInfo.totalCount}</Badge>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Frame References:</span>
                <Badge variant='outline'>{statisticsInfo.frameOfReferences.length}</Badge>
              </div>
            </div>
            <div className='space-y-2'>
              <span className='text-muted-foreground text-xs'>도구별 분포:</span>
              {Object.entries(statisticsInfo.toolCounts).map(([tool, count]) => (
                <div key={tool} className='flex justify-between text-xs'>
                  <span>{tool}:</span>
                  <Badge variant='outline' className='text-xs'>
                    {count}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Separator />

        {/* 저장 섹션 */}
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <Label className='text-sm font-medium'>주석 저장</Label>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => {
                setShowAdvancedOptions(!showAdvancedOptions);
              }}
            >
              <Settings className='h-4 w-4' />
            </Button>
          </div>

          <div className='space-y-3'>
            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-2'>
                <Label className='text-xs'>저장 포맷</Label>
                <Select value={exportSettings.format} onValueChange={handleFormatChange}>
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedFormats.map(format => (
                      <SelectItem key={format.name} value={format.name}>
                        <div className='flex items-center space-x-2'>
                          <span>{format.name}</span>
                          <Badge variant='outline' className='text-xs'>
                            {format.extensions.join(', ')}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label className='text-xs'>파일명</Label>
                <input
                  type='text'
                  value={exportSettings.filename}
                  onChange={e => {
                    setExportSettings(prev => ({ ...prev, filename: e.target.value }));
                  }}
                  className='w-full px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring'
                />
              </div>
            </div>

            {showAdvancedOptions && (
              <div className='space-y-3 p-3 bg-muted/50 rounded-lg'>
                <Label className='text-xs font-medium'>고급 옵션</Label>

                <div className='flex items-center justify-between'>
                  <div className='space-y-1'>
                    <Label className='text-xs'>메타데이터 포함</Label>
                    <p className='text-xs text-muted-foreground'>주석의 모든 메타데이터를 저장</p>
                  </div>
                  <Switch
                    checked={exportSettings.includeMetadata ?? true}
                    onCheckedChange={checked => {
                      setExportSettings(prev => ({ ...prev, includeMetadata: checked }));
                    }}
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <div className='space-y-1'>
                    <Label className='text-xs'>압축 형식</Label>
                    <p className='text-xs text-muted-foreground'>공백 제거하여 파일 크기 최소화</p>
                  </div>
                  <Switch
                    checked={exportSettings.compact ?? false}
                    onCheckedChange={checked => {
                      setExportSettings(prev => ({ ...prev, compact: checked }));
                    }}
                  />
                </div>
              </div>
            )}

            <Button onClick={handleSave} disabled={state.isSaving || annotations.length === 0} className='w-full'>
              {state.isSaving ? (
                <>
                  <Progress value={50} className='w-4 h-4 mr-2' />
                  저장 중...
                </>
              ) : (
                <>
                  <Download className='h-4 w-4 mr-2' />
                  주석 저장 ({annotations.length}개)
                </>
              )}
            </Button>
          </div>
        </div>

        <Separator />

        {/* 불러오기 섹션 */}
        <div className='space-y-4'>
          <Label className='text-sm font-medium'>주석 불러오기</Label>

          <div className='space-y-3'>
            <div className='space-y-2'>
              <Label className='text-xs'>불러오기 모드</Label>
              <Select
                value={importMode}
                onValueChange={(value: 'replace' | 'merge') => {
                  setImportMode(value);
                }}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='replace'>
                    <div className='flex items-center space-x-2'>
                      <span>교체</span>
                      <Badge variant='outline' className='text-xs'>
                        Replace
                      </Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value='merge'>
                    <div className='flex items-center space-x-2'>
                      <span>병합</span>
                      <Badge variant='outline' className='text-xs'>
                        Merge
                      </Badge>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='text-xs text-muted-foreground p-2 bg-muted/50 rounded'>
              <Info className='h-3 w-3 inline mr-1' />
              {importMode === 'replace'
                ? '기존 주석을 모두 삭제하고 새 주석으로 교체합니다.'
                : '새 주석을 기존 주석과 병합합니다. 중복된 ID는 제외됩니다.'}
            </div>

            <Button onClick={handleFileSelect} disabled={state.isLoading} variant='outline' className='w-full'>
              {state.isLoading ? (
                <>
                  <Progress value={50} className='w-4 h-4 mr-2' />
                  불러오는 중...
                </>
              ) : (
                <>
                  <Upload className='h-4 w-4 mr-2' />
                  파일에서 불러오기
                </>
              )}
            </Button>

            <input
              ref={fileInputRef}
              type='file'
              accept={supportedFormats.flatMap(f => f.extensions).join(',')}
              onChange={handleFileLoad}
              className='hidden'
            />
          </div>
        </div>

        {/* 지원 포맷 정보 */}
        <div className='space-y-2'>
          <Label className='text-xs font-medium'>지원 포맷</Label>
          <div className='flex flex-wrap gap-1'>
            {supportedFormats.map(format => (
              <Badge key={format.name} variant='outline' className='text-xs'>
                {format.name} {format.extensions.join(', ')}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
