/**
 * CrossReferenceLines Component
 * 다중 뷰포트 간 교차 참조선 시스템
 * 직교 평면(Axial, Sagittal, Coronal) 간 해부학적 위치 연결
 * Built with shadcn/ui components
 */

import React, { useEffect, useCallback, useMemo } from 'react';
import { log } from '../utils/logger';
import { cn, safePropertyAccess } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';

import { Label } from './ui/label';

import { Button } from './ui/button';

import { Badge } from './ui/badge';

import { Slider } from './ui/slider';

import { Separator } from './ui/separator';

import type { ViewportReference } from '@/services/ViewportSynchronizer';

import { Grid3x3, Palette, Settings, Move3d, Crosshair } from 'lucide-react';

export interface CrossReferenceConfig {
  enabled: boolean;
  showAxialLines: boolean;
  showSagittalLines: boolean;
  showCoronalLines: boolean;
  lineWidth: number;
  lineOpacity: number;
  axialColor: string;
  sagittalColor: string;
  coronalColor: string;
  interactive: boolean;
  autoUpdate: boolean;
}

export interface CrossReferencePosition {
  worldPosition: [number, number, number];
  imagePosition: [number, number, number];
  sliceIndex: number;
  viewport: string;
}

interface CrossReferenceLinesProps {
  viewports: ViewportReference[];
  config: CrossReferenceConfig;
  onConfigChange: (config: CrossReferenceConfig) => void;
  currentPosition?: CrossReferencePosition | null;
  onPositionChange?: (position: CrossReferencePosition) => void;
  className?: string;
  compact?: boolean;
}

const DEFAULT_CONFIG: CrossReferenceConfig = {
  enabled: true,
  showAxialLines: true,
  showSagittalLines: true,
  showCoronalLines: true,
  lineWidth: 2,
  lineOpacity: 0.8,
  axialColor: '#ff6b6b', // Red for Axial
  sagittalColor: '#4ecdc4', // Teal for Sagittal
  coronalColor: '#45b7d1', // Blue for Coronal
  interactive: true,
  autoUpdate: true,
};

const ORIENTATION_INFO = {
  axial: {
    label: 'Axial (수평)',
    icon: '⊥',
    description: '수평 단면',
  },
  sagittal: {
    label: 'Sagittal (시상)',
    icon: '→',
    description: '좌우 분할 단면',
  },
  coronal: {
    label: 'Coronal (관상)',
    icon: '↑',
    description: '전후 분할 단면',
  },
};

export const CrossReferenceLines: React.FC<CrossReferenceLinesProps> = ({
  viewports,
  config,
  onConfigChange,
  currentPosition,
  onPositionChange: _onPositionChange,
  className,
  compact = false,
}) => {
  // 설정 변경 핸들러들
  const handleToggleEnabled = useCallback(
    (enabled: boolean) => {
      onConfigChange({ ...config, enabled });
    },
    [config, onConfigChange],
  );

  const handleToggleOrientation = useCallback(
    (orientation: keyof typeof ORIENTATION_INFO) => {
      const key =
        `show${orientation.charAt(0).toUpperCase() + orientation.slice(1)}Lines` as keyof CrossReferenceConfig;
      const currentValue = safePropertyAccess(config, key);
      onConfigChange({
        ...config,
        [key]: !currentValue,
      });
    },
    [config, onConfigChange],
  );

  const handleLineWidthChange = useCallback(
    (value: number[]) => {
      onConfigChange({ ...config, lineWidth: value[0] ?? 2 });
    },
    [config, onConfigChange],
  );

  const handleOpacityChange = useCallback(
    (value: number[]) => {
      onConfigChange({ ...config, lineOpacity: (value[0] ?? 80) / 100 });
    },
    [config, onConfigChange],
  );

  const handleColorChange = useCallback(
    (orientation: string, color: string) => {
      const colorKey = `${orientation}Color` as keyof CrossReferenceConfig;
      onConfigChange({ ...config, [colorKey]: color });
    },
    [config, onConfigChange],
  );

  const handleResetDefaults = useCallback(() => {
    onConfigChange(DEFAULT_CONFIG);
  }, [onConfigChange]);

  // 활성 뷰포트 수 계산
  const activeViewportCount = useMemo(() => viewports.length, [viewports]);

  // 현재 위치 정보 표시
  const positionDisplay = useMemo(() => {
    if (!currentPosition) {
      return null;
    }

    const { worldPosition, imagePosition, sliceIndex, viewport } = currentPosition;
    return {
      world: `(${worldPosition[0].toFixed(1)}, ${worldPosition[1].toFixed(1)}, ${worldPosition[2].toFixed(1)})`,
      image: `(${imagePosition[0].toFixed(0)}, ${imagePosition[1].toFixed(0)}, ${imagePosition[2].toFixed(0)})`,
      slice: sliceIndex,
      viewportId: viewport,
    };
  }, [currentPosition]);

  // Cross-reference 업데이트 효과
  useEffect(() => {
    if (!config.enabled || !config.autoUpdate) {
      return;
    }

    // TODO: Cornerstone3D crosshair tool 업데이트 로직
    log.info('Cross-reference lines updated:', { viewports, config });
  }, [config, viewports]);

  if (compact) {
    return (
      <Card className={cn('p-3', className)}>
        <div className='flex items-center justify-between'>
          <div className='flex items-center space-x-2'>
            <Crosshair className='h-4 w-4' />
            <Label className='text-sm font-medium'>교차 참조</Label>
            <Switch checked={config.enabled} onCheckedChange={handleToggleEnabled} />
          </div>

          {config.enabled && (
            <div className='flex items-center space-x-1'>
              <Badge
                variant={config.showAxialLines ? 'default' : 'secondary'}
                className={cn('text-xs px-2')}
                style={
                  {
                    '--plane-color': config.axialColor,
                    backgroundColor: config.showAxialLines ? 'var(--plane-color)' : undefined,
                  } as React.CSSProperties
                }
              >
                A
              </Badge>
              <Badge
                variant={config.showSagittalLines ? 'default' : 'secondary'}
                className={cn('text-xs px-2')}
                style={
                  {
                    '--plane-color': config.sagittalColor,
                    backgroundColor: config.showSagittalLines ? 'var(--plane-color)' : undefined,
                  } as React.CSSProperties
                }
              >
                S
              </Badge>
              <Badge
                variant={config.showCoronalLines ? 'default' : 'secondary'}
                className={cn('text-xs px-2')}
                style={
                  {
                    '--plane-color': config.coronalColor,
                    backgroundColor: config.showCoronalLines ? 'var(--plane-color)' : undefined,
                  } as React.CSSProperties
                }
              >
                C
              </Badge>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className='pb-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center space-x-2'>
            <CardTitle className='text-base font-semibold flex items-center gap-2'>
              <Grid3x3 className='h-5 w-5' />
              Cross Reference Lines
            </CardTitle>
            {config.enabled && (
              <Badge variant='default' className='text-xs'>
                Active
              </Badge>
            )}
          </div>

          <div className='flex items-center space-x-2'>
            <Button variant='ghost' size='sm' onClick={handleResetDefaults} title='기본값으로 재설정'>
              <Settings className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className='space-y-6'>
        {/* 메인 활성화 토글 */}
        <div className='flex items-center justify-between'>
          <div className='space-y-1'>
            <Label className='text-sm font-medium'>교차 참조선 활성화</Label>
            <p className='text-xs text-muted-foreground'>다중 뷰포트 간 해부학적 위치 연결선 표시</p>
          </div>
          <Switch checked={config.enabled} onCheckedChange={handleToggleEnabled} />
        </div>

        {config.enabled && (
          <>
            <Separator />

            {/* 뷰포트 상태 */}
            <div className='space-y-3'>
              <Label className='text-sm font-medium'>연결된 뷰포트</Label>
              <div className='grid grid-cols-2 gap-2 text-xs'>
                <div className='flex items-center justify-between'>
                  <span>활성 뷰포트:</span>
                  <Badge variant='secondary'>{activeViewportCount}</Badge>
                </div>
                <div className='flex items-center justify-between'>
                  <span>교차 참조:</span>
                  <Badge variant='default'>ON</Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* 방향별 활성화 */}
            <div className='space-y-3'>
              <Label className='text-sm font-medium'>표시할 방향</Label>
              <div className='space-y-3'>
                {Object.entries(ORIENTATION_INFO).map(([key, info]) => {
                  const isActive = config[
                    `show${key.charAt(0).toUpperCase() + key.slice(1)}Lines` as keyof CrossReferenceConfig
                  ] as boolean;
                  const color = config[`${key}Color` as keyof CrossReferenceConfig] as string;

                  return (
                    <div key={key} className='flex items-center justify-between p-3 rounded-lg border'>
                      <div className='flex items-center space-x-3'>
                        <div
                          className={cn('w-4 h-4 rounded-full border-2')}
                          style={
                            {
                              '--orientation-color': color,
                              backgroundColor: isActive ? 'var(--orientation-color)' : 'transparent',
                              borderColor: 'var(--orientation-color)',
                            } as React.CSSProperties
                          }
                        />
                        <div>
                          <div className='flex items-center space-x-2'>
                            <span className='text-sm font-medium'>{info.label}</span>
                            <span className='text-lg'>{info.icon}</span>
                          </div>
                          <p className='text-xs text-muted-foreground'>{info.description}</p>
                        </div>
                      </div>

                      <div className='flex items-center space-x-2'>
                        <Button
                          variant='outline'
                          size='sm'
                          className={cn('w-8 h-8 p-0 rounded border cursor-pointer')}
                          style={{
                            backgroundColor: color,
                            borderColor: color,
                          }}
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'color';
                            input.value = color;
                            input.onchange = e => {
                              handleColorChange(key, (e.target as HTMLInputElement).value);
                            };
                            input.click();
                          }}
                          disabled={!isActive}
                        />
                        <Switch
                          checked={isActive}
                          onCheckedChange={() => {
                            handleToggleOrientation(key as keyof typeof ORIENTATION_INFO);
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* 선 스타일 설정 */}
            <div className='space-y-4'>
              <Label className='text-sm font-medium flex items-center gap-2'>
                <Palette className='h-4 w-4' />선 스타일
              </Label>

              <div className='space-y-4'>
                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <Label className='text-xs'>선 두께</Label>
                    <Badge variant='secondary' className='text-xs'>
                      {config.lineWidth}px
                    </Badge>
                  </div>
                  <Slider
                    value={[config.lineWidth]}
                    onValueChange={handleLineWidthChange}
                    min={1}
                    max={5}
                    step={0.5}
                    className='w-full'
                  />
                </div>

                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <Label className='text-xs'>투명도</Label>
                    <Badge variant='secondary' className='text-xs'>
                      {Math.round(config.lineOpacity * 100)}%
                    </Badge>
                  </div>
                  <Slider
                    value={[config.lineOpacity * 100]}
                    onValueChange={handleOpacityChange}
                    min={10}
                    max={100}
                    step={5}
                    className='w-full'
                  />
                </div>
              </div>
            </div>

            {/* 현재 위치 정보 */}
            {positionDisplay && (
              <>
                <Separator />
                <div className='space-y-3'>
                  <Label className='text-sm font-medium flex items-center gap-2'>
                    <Move3d className='h-4 w-4' />
                    현재 위치
                  </Label>
                  <div className='grid grid-cols-2 gap-2 text-xs font-mono'>
                    <div>
                      <span className='text-muted-foreground'>World:</span>
                      <div className='mt-1'>{positionDisplay.world}</div>
                    </div>
                    <div>
                      <span className='text-muted-foreground'>Image:</span>
                      <div className='mt-1'>{positionDisplay.image}</div>
                    </div>
                    <div>
                      <span className='text-muted-foreground'>Slice:</span>
                      <div className='mt-1'>{positionDisplay.slice}</div>
                    </div>
                    <div>
                      <span className='text-muted-foreground'>Viewport:</span>
                      <div className='mt-1'>{positionDisplay.viewportId}</div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* 인터랙션 설정 */}
            <Separator />
            <div className='space-y-3'>
              <Label className='text-sm font-medium'>인터랙션</Label>
              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <div className='space-y-1'>
                    <Label className='text-xs'>상호작용 가능</Label>
                    <p className='text-xs text-muted-foreground'>참조선 클릭으로 다른 뷰포트 이동</p>
                  </div>
                  <Switch
                    checked={config.interactive}
                    onCheckedChange={interactive => {
                      onConfigChange({ ...config, interactive });
                    }}
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <div className='space-y-1'>
                    <Label className='text-xs'>자동 업데이트</Label>
                    <p className='text-xs text-muted-foreground'>뷰포트 변경 시 자동으로 참조선 업데이트</p>
                  </div>
                  <Switch
                    checked={config.autoUpdate}
                    onCheckedChange={autoUpdate => {
                      onConfigChange({ ...config, autoUpdate });
                    }}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
