// @ts-nocheck
/* eslint-disable */
/**
 * AdvancedViewer Component - LEGACY
 * 3D 볼륨 렌더링 및 고급 이미징 기능 제공
 * MPR(Multi-Planar Reconstruction) 및 VR(Volume Rendering) 지원
 * Built with shadcn/ui components
 * TODO: Refactor for new layout-based ViewerContext system
 */

import React, { useState, useCallback, useMemo } from 'react';
import { log } from '../utils/logger';
import { cn } from '@/lib/utils';

import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

import { Badge } from './ui/badge';

import { Button } from './ui/button';

import { Slider } from './ui/slider';

import { Switch } from './ui/switch';

import { Label } from './ui/label';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

import { Separator } from './ui/separator';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

import { Progress } from './ui/progress';

import { ViewportGridManager } from './ViewportGridManager';

import { useViewer, useViewerLayout } from '../context/ViewerContext';

import type { AdvancedViewportState, VolumeRenderingConfig, MPRConfig } from '@/types/viewer';
import { Box, Layers3, Settings, RotateCcw, Palette, Maximize2, Minimize2 } from 'lucide-react';

interface AdvancedViewerProps {
  className?: string;
}

interface AdvancedViewerState {
  showVolumeControls: boolean;
  showMPRControls: boolean;
  showRenderingSettings: boolean;
  isFullscreen: boolean;
  loadingProgress: number;
  renderingInProgress: boolean;
}

const DEFAULT_VOLUME_CONFIG: VolumeRenderingConfig = {
  enabled: false,
  preset: 'ct-bone',
  opacity: 0.8,
  ambient: 0.2,
  diffuse: 0.8,
  specular: 0.3,
  specularPower: 20,
  shade: true,
  colorMap: 'rainbow',
  windowLevel: { window: 1500, level: 300 },
};

const DEFAULT_MPR_CONFIG: MPRConfig = {
  enabled: false,
  axialVisible: true,
  sagittalVisible: true,
  coronalVisible: true,
  thickness: 1.0,
  blendMode: 'maximum',
};

const VOLUME_PRESETS = [
  { value: 'ct-bone', label: 'CT Bone', description: '뼈 조직 강조' },
  { value: 'ct-chest', label: 'CT Chest', description: '흉부 영상 최적화' },
  { value: 'ct-abdomen', label: 'CT Abdomen', description: '복부 영상 최적화' },
  { value: 'mri-default', label: 'MRI Default', description: 'MRI 기본 설정' },
  { value: 'custom', label: 'Custom', description: '사용자 정의' },
];

const COLOR_MAPS = [
  { value: 'rainbow', label: 'Rainbow' },
  { value: 'hot', label: 'Hot' },
  { value: 'cool', label: 'Cool' },
  { value: 'grayscale', label: 'Grayscale' },
  { value: 'bone', label: 'Bone' },
];

export const AdvancedViewer: React.FC<AdvancedViewerProps> = ({ className }) => {
  const layout = useViewerLayout();

  const [, setAdvancedState] = useState<AdvancedViewerState>({
    showVolumeControls: true,
    showMPRControls: false,
    showRenderingSettings: false,
    isFullscreen: false,
    loadingProgress: 0,
    renderingInProgress: false,
  });

  const [volumeConfig, setVolumeConfig] = useState<VolumeRenderingConfig>(DEFAULT_VOLUME_CONFIG);
  const [mprConfig, setMPRConfig] = useState<MPRConfig>(DEFAULT_MPR_CONFIG);

  // 고급 뷰포트 상태 생성
  const advancedViewports = useMemo(() => {
    const baseViewport: AdvancedViewportState = {
      id: 'advanced-viewport-main',
      isActive: true,
      imageIndex: 0,
      zoom: 1,
      pan: { x: 0, y: 0 },
      rotation: 0,
      flipHorizontal: false,
      flipVertical: false,
      windowLevel: { window: 400, level: 50 },
      studyInstanceUID: '',
      seriesInstanceUID: '',
      volumeRendering: volumeConfig,
      mpr: mprConfig,
      renderingType: volumeConfig.enabled ? 'volume' : mprConfig.enabled ? 'mpr' : 'stack',
    };

    if (mprConfig.enabled && layout.rows * layout.cols !== 1) {
      // MPR 모드에서는 3개의 뷰포트 생성 (Axial, Sagittal, Coronal)
      return [
        { ...baseViewport, id: 'advanced-axial' },
        { ...baseViewport, id: 'advanced-sagittal', isActive: false },
        { ...baseViewport, id: 'advanced-coronal', isActive: false },
      ];
    }

    return [baseViewport];
  }, [volumeConfig, mprConfig, layout]);

  // 볼륨 설정 변경 핸들러
  const handleVolumeConfigChange = useCallback(
    (key: keyof VolumeRenderingConfig, value: VolumeRenderingConfig[keyof VolumeRenderingConfig]) => {
      setVolumeConfig(prev => ({ ...prev, [key]: value }));

      if (key === 'enabled' && value === true) {
        setState(prev => ({ ...prev, renderingInProgress: true, loadingProgress: 0 }));

        // 볼륨 렌더링 시뮬레이션
        const progressInterval = setInterval(() => {
          setState(prev => {
            if (prev.loadingProgress >= 100) {
              clearInterval(progressInterval);
              return { ...prev, renderingInProgress: false };
            }
            return { ...prev, loadingProgress: prev.loadingProgress + 10 };
          });
        }, 200);
      }
    },
    [],
  );

  // MPR 설정 변경 핸들러
  const handleMPRConfigChange = useCallback((key: keyof MPRConfig, value: MPRConfig[keyof MPRConfig]) => {
    setMPRConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  // 프리셋 변경 핸들러
  const handlePresetChange = useCallback((preset: VolumeRenderingConfig['preset']) => {
    let presetConfig: Partial<VolumeRenderingConfig> = {};

    switch (preset) {
      case 'ct-bone':
        presetConfig = {
          windowLevel: { window: 1500, level: 300 },
          opacity: 0.8,
          ambient: 0.2,
          diffuse: 0.8,
          specular: 0.3,
        };
        break;
      case 'ct-chest':
        presetConfig = {
          windowLevel: { window: 1500, level: -600 },
          opacity: 0.6,
          ambient: 0.3,
          diffuse: 0.7,
          specular: 0.2,
        };
        break;
      case 'ct-abdomen':
        presetConfig = {
          windowLevel: { window: 400, level: 50 },
          opacity: 0.7,
          ambient: 0.25,
          diffuse: 0.75,
          specular: 0.25,
        };
        break;
      case 'mri-default':
        presetConfig = {
          windowLevel: { window: 300, level: 150 },
          opacity: 0.9,
          ambient: 0.1,
          diffuse: 0.9,
          specular: 0.1,
        };
        break;
    }

    setVolumeConfig(prev => ({ ...prev, preset, ...presetConfig }));
  }, []);

  // 전체화면 토글
  const toggleFullscreen = useCallback(() => {
    setState(prev => ({ ...prev, isFullscreen: !prev.isFullscreen }));
  }, []);

  // 레이아웃 변경 핸들러
  const handleLayoutChange = useCallback(
    (newLayout: ViewerMode['layout']) => {
      // Layout update removed - handled by ViewerContext

      if (onModeChange !== undefined) {
        onModeChange(updatedMode);
      } else {
        setMode(updatedMode);
      }
    },
    [mode, onModeChange, setMode],
  );

  // 뷰포트 변경 핸들러
  const handleViewportChange = useCallback((viewportId: string, changes: Partial<AdvancedViewportState>) => {
    log.info(`Advanced viewport ${viewportId} changed:`, changes);
  }, []);

  // 설정 초기화
  const resetSettings = useCallback(() => {
    setVolumeConfig(DEFAULT_VOLUME_CONFIG);
    setMPRConfig(DEFAULT_MPR_CONFIG);
    setState(prev => ({
      ...prev,
      loadingProgress: 0,
      renderingInProgress: false,
    }));
  }, []);

  return (
    <div className={cn('flex flex-col h-full bg-background', state.isFullscreen && 'fixed inset-0 z-50', className)}>
      {/* Advanced Viewer 헤더 */}
      <Card className='rounded-none border-x-0 border-t-0'>
        <CardHeader className='pb-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-3'>
              <CardTitle className='text-lg font-semibold flex items-center gap-2'>
                <Box className='h-5 w-5' />
                Advanced 3D Viewer
              </CardTitle>
              <Badge variant='secondary' className='text-xs'>
                {layout.rows}x{layout.cols} Layout
              </Badge>
              {volumeConfig.enabled && (
                <Badge variant='default' className='text-xs'>
                  Volume Rendering
                </Badge>
              )}
              {mprConfig.enabled && (
                <Badge variant='default' className='text-xs'>
                  MPR
                </Badge>
              )}
              {state.renderingInProgress && (
                <Badge variant='outline' className='text-xs'>
                  Rendering...
                </Badge>
              )}
            </div>

            <div className='flex items-center space-x-2'>
              {/* 렌더링 모드 선택 */}
              <div className='flex items-center space-x-1'>
                <Button
                  variant={volumeConfig.enabled ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => {
                    handleVolumeConfigChange('enabled', !volumeConfig.enabled);
                  }}
                >
                  <Box className='h-4 w-4 mr-1' />
                  VR
                </Button>
                <Button
                  variant={mprConfig.enabled ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => {
                    handleMPRConfigChange('enabled', !mprConfig.enabled);
                  }}
                >
                  <Layers3 className='h-4 w-4 mr-1' />
                  MPR
                </Button>
              </div>

              {/* 레이아웃 선택 */}
              <div className='flex items-center space-x-1'>
                <Button
                  variant={layout.rows * layout.cols === 1 ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => {
                    handleLayoutChange(1, 1);
                  }}
                >
                  1×1
                </Button>
                <Button
                  variant={mode.layout === '2x2' ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => {
                    handleLayoutChange('2x2');
                  }}
                >
                  2×2
                </Button>
              </div>

              {/* 제어 패널 토글 */}
              <Button
                variant={state.showVolumeControls ? 'default' : 'outline'}
                size='sm'
                onClick={() => {
                  setState(prev => ({
                    ...prev,
                    showVolumeControls: !prev.showVolumeControls,
                  }));
                }}
              >
                <Settings className='h-4 w-4' />
                <span className='hidden sm:inline ml-2'>Volume</span>
              </Button>

              <Button
                variant={state.showRenderingSettings ? 'default' : 'outline'}
                size='sm'
                onClick={() => {
                  setState(prev => ({
                    ...prev,
                    showRenderingSettings: !prev.showRenderingSettings,
                  }));
                }}
              >
                <Palette className='h-4 w-4' />
                <span className='hidden sm:inline ml-2'>Render</span>
              </Button>

              <Button variant='outline' size='sm' onClick={resetSettings}>
                <RotateCcw className='h-4 w-4' />
              </Button>

              <Button variant='outline' size='sm' onClick={toggleFullscreen}>
                {state.isFullscreen ? <Minimize2 className='h-4 w-4' /> : <Maximize2 className='h-4 w-4' />}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 진행률 표시 */}
      {state.renderingInProgress && (
        <Card className='rounded-none border-x-0 border-t-0'>
          <CardContent className='py-2'>
            <div className='flex items-center space-x-3'>
              <Label className='text-sm'>Volume Rendering Progress:</Label>
              <Progress value={state.loadingProgress} className='flex-1' />
              <span className='text-sm text-muted-foreground'>{state.loadingProgress}%</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 제어 패널들 */}
      <div className='flex'>
        {/* 볼륨 렌더링 제어 패널 */}
        {state.showVolumeControls && (
          <Card className='w-80 rounded-none border-y-0 border-l-0'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-sm flex items-center gap-2'>
                <Box className='h-4 w-4' />
                Volume Rendering
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <Tabs defaultValue='presets' className='w-full'>
                <TabsList className='grid w-full grid-cols-2'>
                  <TabsTrigger value='presets'>Presets</TabsTrigger>
                  <TabsTrigger value='advanced'>Advanced</TabsTrigger>
                </TabsList>

                <TabsContent value='presets' className='space-y-4'>
                  <div className='space-y-2'>
                    <Label className='text-xs'>Rendering Preset</Label>
                    <Select
                      value={volumeConfig.preset}
                      onValueChange={(value: VolumeRenderingConfig['preset']) => {
                        handlePresetChange(value);
                      }}
                    >
                      <SelectTrigger className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VOLUME_PRESETS.map(preset => (
                          <SelectItem key={preset.value} value={preset.value}>
                            <div>
                              <div className='font-medium'>{preset.label}</div>
                              <div className='text-xs text-muted-foreground'>{preset.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className='space-y-2'>
                    <Label className='text-xs'>Color Map</Label>
                    <Select
                      value={volumeConfig.colorMap}
                      onValueChange={value => {
                        handleVolumeConfigChange('colorMap', value);
                      }}
                    >
                      <SelectTrigger className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLOR_MAPS.map(colorMap => (
                          <SelectItem key={colorMap.value} value={colorMap.value}>
                            {colorMap.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value='advanced' className='space-y-4'>
                  <div className='space-y-3'>
                    <div className='space-y-2'>
                      <div className='flex items-center justify-between'>
                        <Label className='text-xs'>Opacity</Label>
                        <Badge variant='secondary' className='text-xs'>
                          {Math.round(volumeConfig.opacity * 100)}%
                        </Badge>
                      </div>
                      <Slider
                        value={[volumeConfig.opacity * 100]}
                        onValueChange={value => {
                          handleVolumeConfigChange('opacity', (value[0] ?? 80) / 100);
                        }}
                        min={0}
                        max={100}
                        step={5}
                        className='w-full'
                      />
                    </div>

                    <div className='space-y-2'>
                      <div className='flex items-center justify-between'>
                        <Label className='text-xs'>Ambient</Label>
                        <Badge variant='secondary' className='text-xs'>
                          {volumeConfig.ambient.toFixed(2)}
                        </Badge>
                      </div>
                      <Slider
                        value={[volumeConfig.ambient * 100]}
                        onValueChange={value => {
                          handleVolumeConfigChange('ambient', (value[0] ?? 20) / 100);
                        }}
                        min={0}
                        max={100}
                        step={5}
                        className='w-full'
                      />
                    </div>

                    <div className='space-y-2'>
                      <div className='flex items-center justify-between'>
                        <Label className='text-xs'>Diffuse</Label>
                        <Badge variant='secondary' className='text-xs'>
                          {volumeConfig.diffuse.toFixed(2)}
                        </Badge>
                      </div>
                      <Slider
                        value={[volumeConfig.diffuse * 100]}
                        onValueChange={value => {
                          handleVolumeConfigChange('diffuse', (value[0] ?? 80) / 100);
                        }}
                        min={0}
                        max={100}
                        step={5}
                        className='w-full'
                      />
                    </div>

                    <div className='space-y-2'>
                      <div className='flex items-center justify-between'>
                        <Label className='text-xs'>Specular</Label>
                        <Badge variant='secondary' className='text-xs'>
                          {volumeConfig.specular.toFixed(2)}
                        </Badge>
                      </div>
                      <Slider
                        value={[volumeConfig.specular * 100]}
                        onValueChange={value => {
                          handleVolumeConfigChange('specular', (value[0] ?? 30) / 100);
                        }}
                        min={0}
                        max={100}
                        step={5}
                        className='w-full'
                      />
                    </div>

                    <div className='flex items-center justify-between'>
                      <div className='space-y-1'>
                        <Label className='text-xs'>Shading</Label>
                        <p className='text-xs text-muted-foreground'>3D lighting effects</p>
                      </div>
                      <Switch
                        checked={volumeConfig.shade}
                        onCheckedChange={shade => {
                          handleVolumeConfigChange('shade', shade);
                        }}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* 렌더링 설정 패널 */}
        {state.showRenderingSettings && (
          <Card className='w-80 rounded-none border-y-0 border-l-0'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-sm flex items-center gap-2'>
                <Layers3 className='h-4 w-4' />
                MPR Settings
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <div className='space-y-1'>
                    <Label className='text-xs'>Enable MPR</Label>
                    <p className='text-xs text-muted-foreground'>Multi-planar reconstruction</p>
                  </div>
                  <Switch
                    checked={mprConfig.enabled}
                    onCheckedChange={enabled => {
                      handleMPRConfigChange('enabled', enabled);
                    }}
                  />
                </div>

                {mprConfig.enabled && (
                  <>
                    <Separator />

                    <div className='space-y-3'>
                      <Label className='text-xs font-medium'>显示平面</Label>

                      <div className='flex items-center justify-between'>
                        <div className='flex items-center space-x-2'>
                          <div className='w-3 h-3 bg-red-500 rounded-full' />
                          <Label className='text-xs'>Axial (수평)</Label>
                        </div>
                        <Switch
                          checked={mprConfig.axialVisible}
                          onCheckedChange={visible => {
                            handleMPRConfigChange('axialVisible', visible);
                          }}
                        />
                      </div>

                      <div className='flex items-center justify-between'>
                        <div className='flex items-center space-x-2'>
                          <div className='w-3 h-3 bg-green-500 rounded-full' />
                          <Label className='text-xs'>Sagittal (시상)</Label>
                        </div>
                        <Switch
                          checked={mprConfig.sagittalVisible}
                          onCheckedChange={visible => {
                            handleMPRConfigChange('sagittalVisible', visible);
                          }}
                        />
                      </div>

                      <div className='flex items-center justify-between'>
                        <div className='flex items-center space-x-2'>
                          <div className='w-3 h-3 bg-blue-500 rounded-full' />
                          <Label className='text-xs'>Coronal (관상)</Label>
                        </div>
                        <Switch
                          checked={mprConfig.coronalVisible}
                          onCheckedChange={visible => {
                            handleMPRConfigChange('coronalVisible', visible);
                          }}
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className='space-y-2'>
                      <div className='flex items-center justify-between'>
                        <Label className='text-xs'>Slice Thickness</Label>
                        <Badge variant='secondary' className='text-xs'>
                          {mprConfig.thickness.toFixed(1)}mm
                        </Badge>
                      </div>
                      <Slider
                        value={[mprConfig.thickness * 10]}
                        onValueChange={value => {
                          handleMPRConfigChange('thickness', (value[0] ?? 10) / 10);
                        }}
                        min={1}
                        max={50}
                        step={1}
                        className='w-full'
                      />
                    </div>

                    <div className='space-y-2'>
                      <Label className='text-xs'>Blend Mode</Label>
                      <Select
                        value={mprConfig.blendMode}
                        onValueChange={(value: MPRConfig['blendMode']) => {
                          handleMPRConfigChange('blendMode', value);
                        }}
                      >
                        <SelectTrigger className='w-full'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='maximum'>Maximum</SelectItem>
                          <SelectItem value='minimum'>Minimum</SelectItem>
                          <SelectItem value='average'>Average</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 메인 뷰포트 영역 */}
        <div className='flex-1'>
          <ViewportGridManager
            layout={mode.layout}
            viewports={advancedViewports}
            onViewportChange={handleViewportChange}
            className='h-full'
            animationDuration={300}
          />
        </div>
      </div>

      {/* 상태 표시 영역 */}
      <Card className='rounded-none border-x-0 border-b-0'>
        <CardContent className='py-2'>
          <div className='flex items-center justify-between text-xs text-muted-foreground'>
            <div className='flex items-center space-x-4'>
              <span>Rendering: {volumeConfig.enabled ? 'Volume' : mprConfig.enabled ? 'MPR' : 'Stack'}</span>
              <span>Layout: {mode.layout}</span>
              <span>Viewports: {advancedViewports.length}</span>
            </div>

            <div className='flex items-center space-x-2'>
              {volumeConfig.enabled && (
                <Badge variant='outline' className='text-xs'>
                  {volumeConfig.preset.toUpperCase()}
                </Badge>
              )}
              {mprConfig.enabled && (
                <Badge variant='outline' className='text-xs'>
                  MPR {mprConfig.thickness}mm
                </Badge>
              )}
              {state.renderingInProgress && (
                <Badge variant='outline' className='text-xs animate-pulse'>
                  Processing...
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
