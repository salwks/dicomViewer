/**
 * ViewModeSelector Component
 * Controls switching between 2D stack and 3D volume viewing modes
 * Built with shadcn/ui components
 */

import React, { useState, useCallback } from 'react';
import { log } from '../utils/logger';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toggle } from '@/components/ui/toggle';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Layers, Box, Grid3x3, Axis3d, Eye, EyeOff, Activity } from 'lucide-react';
import type { IViewport } from '@/types';

export type ViewMode = '2D' | '3D' | 'MPR' | 'MIP';
export type OrientationType = 'axial' | 'sagittal' | 'coronal';

interface ViewModeConfig {
  mode: ViewMode;
  orientation: OrientationType;
  renderingPreset?: string;
  slabThickness?: number;
  showCrosshairs?: boolean;
  showOrientationMarker?: boolean;
}

interface ViewModeSelectorProps {
  currentMode?: ViewMode;
  currentOrientation?: OrientationType;
  onModeChange?: (config: ViewModeConfig) => void;
  className?: string;
  viewport?: IViewport | null;
  compact?: boolean;
}

// Rendering presets for 3D mode
const RENDERING_PRESETS = [
  { id: 'bone', label: '뼈', icon: '🦴' },
  { id: 'soft-tissue', label: '연조직', icon: '🫁' },
  { id: 'lung', label: '폐', icon: '🫁' },
  { id: 'angio', label: '혈관', icon: '🩸' },
  { id: 'custom', label: '사용자 정의', icon: '⚙️' },
];

export const ViewModeSelector: React.FC<ViewModeSelectorProps> = ({
  currentMode = '2D',
  currentOrientation = 'axial',
  onModeChange,
  className,
  viewport,
  compact = false,
}) => {
  const [mode, setMode] = useState<ViewMode>(currentMode);
  const [orientation, setOrientation] = useState<OrientationType>(currentOrientation);
  const [renderingPreset, setRenderingPreset] = useState('bone');
  const [showCrosshairs, setShowCrosshairs] = useState(false);
  const [showOrientationMarker, setShowOrientationMarker] = useState(true);
  const [slabThickness, setSlabThickness] = useState(1);

  const handleModeChange = useCallback(
    (newMode: ViewMode) => {
      setMode(newMode);

      const config: ViewModeConfig = {
        mode: newMode,
        orientation,
        ...(newMode === '3D' && { renderingPreset }),
        ...(newMode === 'MIP' && { slabThickness }),
        showCrosshairs,
        showOrientationMarker,
      };

      if (onModeChange) {
        onModeChange(config);
      }

      // Apply to viewport if available
      if (viewport) {
        try {
          switch (newMode) {
            case '2D':
              // Switch to stack viewport
              log.info('Switching to 2D stack mode');
              // viewport.setProperties({ type: Enums.ViewportType.ORTHOGRAPHIC })
              break;
            case '3D':
              // Switch to volume viewport
              log.info('Switching to 3D volume mode');
              // viewport.setProperties({ type: Enums.ViewportType.VOLUME_3D })
              break;
            case 'MPR':
              log.info('Switching to MPR mode');
              break;
            case 'MIP':
              log.info('Switching to MIP mode');
              break;
          }
          viewport.render();
        } catch (error) {
          console.error('Failed to switch view mode:', error);
        }
      }
    },
    [orientation, renderingPreset, slabThickness, showCrosshairs, showOrientationMarker, onModeChange, viewport],
  );

  const handleOrientationChange = useCallback(
    (newOrientation: OrientationType) => {
      setOrientation(newOrientation);

      const config: ViewModeConfig = {
        mode,
        orientation: newOrientation,
        ...(mode === '3D' && { renderingPreset }),
        ...(mode === 'MIP' && { slabThickness }),
        showCrosshairs,
        showOrientationMarker,
      };

      if (onModeChange) {
        onModeChange(config);
      }

      // Apply orientation to viewport
      if (viewport && mode === '2D') {
        try {
          // Set orientation for stack viewport
          // Note: Actual implementation depends on viewport type

          // Set orientation for stack viewport
          // Note: Actual implementation depends on viewport type
          log.info(`Orientation changed to: ${newOrientation}`);
          viewport.render();
        } catch (error) {
          console.error('Failed to change orientation:', error);
        }
      }
    },
    [mode, renderingPreset, slabThickness, showCrosshairs, showOrientationMarker, onModeChange, viewport],
  );

  if (compact) {
    return (
      <Card className={cn('p-2', className)}>
        <div className='flex items-center gap-2'>
          <Tabs
            value={mode}
            onValueChange={(value: string) => {
              handleModeChange(value as ViewMode);
            }}
          >
            <TabsList className='h-8'>
              <TabsTrigger value='2D' className='text-xs'>
                <Layers className='h-3 w-3 mr-1' />
                2D
              </TabsTrigger>
              <TabsTrigger value='3D' className='text-xs'>
                <Box className='h-3 w-3 mr-1' />
                3D
              </TabsTrigger>
              <TabsTrigger value='MPR' className='text-xs'>
                <Grid3x3 className='h-3 w-3 mr-1' />
                MPR
              </TabsTrigger>
              <TabsTrigger value='MIP' className='text-xs'>
                <Activity className='h-3 w-3 mr-1' />
                MIP
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === '2D' && (
            <div className='flex items-center gap-1'>
              <Button
                size='sm'
                variant={orientation === 'axial' ? 'default' : 'outline'}
                onClick={() => {
                  handleOrientationChange('axial');
                }}
                className='h-7 px-2 text-xs'
              >
                Axial
              </Button>
              <Button
                size='sm'
                variant={orientation === 'sagittal' ? 'default' : 'outline'}
                onClick={() => {
                  handleOrientationChange('sagittal');
                }}
                className='h-7 px-2 text-xs'
              >
                Sagittal
              </Button>
              <Button
                size='sm'
                variant={orientation === 'coronal' ? 'default' : 'outline'}
                onClick={() => {
                  handleOrientationChange('coronal');
                }}
                className='h-7 px-2 text-xs'
              >
                Coronal
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Full view mode selector
  return (
    <Card className={cn('p-4 space-y-4', className)}>
      {/* Mode Selection */}
      <div className='space-y-2'>
        <Label className='text-sm font-medium'>뷰 모드</Label>
        <Tabs
          value={mode}
          onValueChange={(value: string) => {
            handleModeChange(value as ViewMode);
          }}
        >
          <TabsList className='grid grid-cols-4 w-full'>
            <TabsTrigger value='2D'>
              <Layers className='h-4 w-4 mr-2' />
              2D
            </TabsTrigger>
            <TabsTrigger value='3D'>
              <Box className='h-4 w-4 mr-2' />
              3D
            </TabsTrigger>
            <TabsTrigger value='MPR'>
              <Grid3x3 className='h-4 w-4 mr-2' />
              MPR
            </TabsTrigger>
            <TabsTrigger value='MIP'>
              <Activity className='h-4 w-4 mr-2' />
              MIP
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Separator />

      {/* 2D Mode Options */}
      {mode === '2D' && (
        <div className='space-y-3'>
          <Label className='text-sm font-medium'>방향</Label>
          <div className='grid grid-cols-3 gap-2'>
            <Button
              size='sm'
              variant={orientation === 'axial' ? 'default' : 'outline'}
              onClick={() => {
                handleOrientationChange('axial');
              }}
              className='gap-2'
            >
              <Axis3d className='h-3 w-3' />
              Axial
            </Button>
            <Button
              size='sm'
              variant={orientation === 'sagittal' ? 'default' : 'outline'}
              onClick={() => {
                handleOrientationChange('sagittal');
              }}
              className='gap-2'
            >
              <Axis3d className='h-3 w-3 rotate-90' />
              Sagittal
            </Button>
            <Button
              size='sm'
              variant={orientation === 'coronal' ? 'default' : 'outline'}
              onClick={() => {
                handleOrientationChange('coronal');
              }}
              className='gap-2'
            >
              <Axis3d className='h-3 w-3 rotate-45' />
              Coronal
            </Button>
          </div>
        </div>
      )}

      {/* 3D Mode Options */}
      {mode === '3D' && (
        <div className='space-y-3'>
          <Label className='text-sm font-medium'>렌더링 프리셋</Label>
          <div className='grid grid-cols-2 gap-2'>
            {RENDERING_PRESETS.map(preset => (
              <Button
                key={preset.id}
                size='sm'
                variant={renderingPreset === preset.id ? 'default' : 'outline'}
                onClick={() => {
                  setRenderingPreset(preset.id);
                }}
                className='gap-2 text-xs'
              >
                <span>{preset.icon}</span>
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* MIP Mode Options */}
      {mode === 'MIP' && (
        <div className='space-y-3'>
          <Label className='text-sm font-medium'>슬랩 두께</Label>
          <div className='flex items-center gap-2'>
            <Slider
              value={[slabThickness]}
              onValueChange={value => {
                setSlabThickness(value[0] ?? 1);
              }}
              min={1}
              max={50}
              step={1}
              className='flex-1'
            />
            <Badge variant='secondary' className='min-w-[3rem] text-center'>
              {slabThickness}mm
            </Badge>
          </div>
        </div>
      )}

      <Separator />

      {/* Common Options */}
      <div className='space-y-3'>
        <Label className='text-sm font-medium'>표시 옵션</Label>
        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <span className='text-sm'>교차 참조선</span>
            <Toggle pressed={showCrosshairs} onPressedChange={setShowCrosshairs} size='sm'>
              {showCrosshairs ? <Eye className='h-3 w-3' /> : <EyeOff className='h-3 w-3' />}
            </Toggle>
          </div>
          <div className='flex items-center justify-between'>
            <span className='text-sm'>방향 표시기</span>
            <Toggle pressed={showOrientationMarker} onPressedChange={setShowOrientationMarker} size='sm'>
              {showOrientationMarker ? <Eye className='h-3 w-3' /> : <EyeOff className='h-3 w-3' />}
            </Toggle>
          </div>
        </div>
      </div>

      {/* Current Mode Status */}
      <div className='pt-2 border-t'>
        <div className='flex items-center justify-between text-xs'>
          <span className='text-muted-foreground'>현재 모드:</span>
          <Badge variant='secondary'>
            {mode} {mode === '2D' && `(${orientation})`}
          </Badge>
        </div>
      </div>
    </Card>
  );
};
