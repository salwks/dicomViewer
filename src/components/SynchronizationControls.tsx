/**
 * SynchronizationControls Component
 * 뷰포트 동기화 설정을 위한 제어 패널
 * 카메라, VOI, 스크롤, 교차 참조 동기화 제어
 * Built with shadcn/ui components
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import type { SyncConfig, ViewportReference } from '@/services/ViewportSynchronizer';
import { Camera, Contrast, MousePointer, Grid3x3, RotateCcw, Link, Unlink, Info } from 'lucide-react';

interface SynchronizationControlsProps {
  config: SyncConfig;
  onChange: (config: SyncConfig) => void;
  activeViewports: ViewportReference[];
  className?: string;
  disabled?: boolean;
}

interface SyncControlItemProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
}

const SyncControlItem: React.FC<SyncControlItemProps> = ({
  icon,
  label,
  description,
  enabled,
  onToggle,
  disabled = false,
}) => {
  return (
    <div className='flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors'>
      <div
        className={cn(
          'mt-0.5 p-1.5 rounded-md',
          enabled ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        {icon}
      </div>

      <div className='flex-1 space-y-1'>
        <div className='flex items-center justify-between'>
          <Label
            htmlFor={`sync-${label.toLowerCase()}`}
            className={cn('text-sm font-medium cursor-pointer', disabled && 'text-muted-foreground')}
          >
            {label}
          </Label>
          <Switch id={`sync-${label.toLowerCase()}`} checked={enabled} onCheckedChange={onToggle} disabled={disabled} />
        </div>
        <p className='text-xs text-muted-foreground'>{description}</p>
      </div>
    </div>
  );
};

export const SynchronizationControls: React.FC<SynchronizationControlsProps> = ({
  config,
  onChange,
  activeViewports,
  className,
  disabled = false,
}) => {
  const handleSyncToggle =
    (type: keyof SyncConfig) =>
      (enabled: boolean): void => {
        onChange({
          ...config,
          [type]: enabled,
        });
      };

  const handleEnableAll = (): void => {
    onChange({
      camera: true,
      voi: true,
      scroll: true,
      crossReference: true,
    });
  };

  const handleDisableAll = (): void => {
    onChange({
      camera: false,
      voi: false,
      scroll: false,
      crossReference: false,
    });
  };

  const handleResetToDefault = (): void => {
    onChange({
      camera: true,
      voi: true,
      scroll: false,
      crossReference: false,
    });
  };

  const activeSyncCount = Object.values(config).filter(Boolean).length;
  const isAnySyncActive = activeSyncCount > 0;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className='pb-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center space-x-2'>
            <CardTitle className='text-base font-semibold'>Viewport Synchronization</CardTitle>
            {isAnySyncActive ? (
              <Badge variant='default' className='text-xs'>
                <Link className='h-3 w-3 mr-1' />
                {activeSyncCount} Active
              </Badge>
            ) : (
              <Badge variant='secondary' className='text-xs'>
                <Unlink className='h-3 w-3 mr-1' />
                Disabled
              </Badge>
            )}
          </div>

          <div className='flex items-center space-x-2'>
            <Button variant='outline' size='sm' onClick={handleEnableAll} disabled={disabled}>
              Enable All
            </Button>
            <Button variant='outline' size='sm' onClick={handleDisableAll} disabled={disabled}>
              Disable All
            </Button>
            <Button variant='ghost' size='sm' onClick={handleResetToDefault} disabled={disabled}>
              <RotateCcw className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className='space-y-4'>
        {/* 동기화 상태 정보 */}
        <div className='flex items-center justify-between p-3 bg-muted/50 rounded-lg'>
          <div className='flex items-center space-x-2'>
            <Info className='h-4 w-4 text-muted-foreground' />
            <span className='text-sm text-muted-foreground'>Active Viewports: {activeViewports.length}</span>
          </div>
          {activeViewports.length < 2 && (
            <Badge variant='destructive' className='text-xs'>
              Need 2+ viewports for sync
            </Badge>
          )}
        </div>

        {/* 동기화 제어 항목들 */}
        <div className='space-y-3'>
          <SyncControlItem
            icon={<Camera className='h-4 w-4' />}
            label='Camera Sync'
            description='Pan, zoom, and rotation across all viewports'
            enabled={config.camera}
            onToggle={handleSyncToggle('camera')}
            disabled={disabled || activeViewports.length < 2}
          />

          <SyncControlItem
            icon={<Contrast className='h-4 w-4' />}
            label='VOI Sync'
            description='Window/Level (brightness/contrast) settings'
            enabled={config.voi}
            onToggle={handleSyncToggle('voi')}
            disabled={disabled || activeViewports.length < 2}
          />

          <SyncControlItem
            icon={<MousePointer className='h-4 w-4' />}
            label='Scroll Sync'
            description='Image stack navigation and slice position'
            enabled={config.scroll}
            onToggle={handleSyncToggle('scroll')}
            disabled={disabled || activeViewports.length < 2}
          />

          <Separator />

          <SyncControlItem
            icon={<Grid3x3 className='h-4 w-4' />}
            label='Cross Reference'
            description='Display reference lines between orthogonal views'
            enabled={config.crossReference}
            onToggle={handleSyncToggle('crossReference')}
            disabled={disabled || activeViewports.length < 2}
          />
        </div>

        {/* 고급 동기화 설정 */}
        <div className='pt-2'>
          <Separator className='mb-4' />
          <div className='flex items-center justify-between text-xs text-muted-foreground'>
            <span>Synchronization is applied to all active viewports</span>
            <span>Changes take effect immediately</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
