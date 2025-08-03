/**
 * Synchronization Controls Component
 * Controls for managing viewport synchronization features
 * Completely rewritten using shadcn/ui Toggle and ToggleGroup components
 */

import React from 'react';
import { Toggle } from '../ui/toggle';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';

export interface SynchronizationSettings {
  enableZoom: boolean;
  enablePan: boolean;
  enableScroll: boolean;
  enableWindowLevel: boolean;
  enableReferenceLines: boolean;
  enableSliceSync: boolean;
  enableAnatomicalMapping: boolean;
}

export interface SynchronizationControlsProps {
  settings: SynchronizationSettings;
  onSettingsChange: (settings: SynchronizationSettings) => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}

interface SyncControl {
  key: keyof SynchronizationSettings;
  label: string;
  description: string;
  icon: React.ReactNode;
  shortcut?: string;
}

const syncControls: SyncControl[] = [
  {
    key: 'enableZoom',
    label: 'Zoom',
    description: 'Synchronize zoom level',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
        <line x1="11" y1="8" x2="11" y2="14" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
    shortcut: 'Z',
  },
  {
    key: 'enablePan',
    label: 'Pan',
    description: 'Synchronize pan position',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3" />
      </svg>
    ),
    shortcut: 'P',
  },
  {
    key: 'enableScroll',
    label: 'Scroll',
    description: 'Synchronize slice scrolling',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v6M12 16v6" />
        <path d="m8 8 4-4 4 4" />
        <path d="m8 16 4 4 4-4" />
      </svg>
    ),
    shortcut: 'S',
  },
  {
    key: 'enableWindowLevel',
    label: 'W/L',
    description: 'Synchronize window/level',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a10 10 0 0 1 0 20" fill="currentColor" opacity="0.3" />
        <path d="M8 12h8" strokeWidth="3" />
      </svg>
    ),
    shortcut: 'W',
  },
  {
    key: 'enableReferenceLines',
    label: 'Reference',
    description: 'Show cross-reference lines',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v20M2 12h20" strokeDasharray="3 3" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>
    ),
    shortcut: 'R',
  },
  {
    key: 'enableSliceSync',
    label: 'Slice',
    description: 'Anatomical slice synchronization',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 12h18" />
        <path d="M3 6h18" />
        <path d="M3 18h18" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>
    ),
    shortcut: 'L',
  },
  {
    key: 'enableAnatomicalMapping',
    label: 'Anatomy',
    description: 'Anatomical position mapping',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
    ),
    shortcut: 'A',
  },
];

export const SynchronizationControls: React.FC<SynchronizationControlsProps> = ({
  settings,
  onSettingsChange,
  disabled = false,
  compact = false,
  className = '',
}) => {
  const toggleSetting = React.useCallback((key: keyof SynchronizationSettings): void => {
    if (disabled) return;

    onSettingsChange({
      ...settings,
      [key]: !settings[key],
    });
  }, [disabled, settings, onSettingsChange]);

  const toggleAll = (): void => {
    if (disabled) return;

    const allEnabled = syncControls.every(control => settings[control.key]);
    const newSettings = { ...settings };

    syncControls.forEach(control => {
      newSettings[control.key] = !allEnabled;
    });

    onSettingsChange(newSettings);
  };

  const getActiveCount = (): number => {
    return syncControls.filter(control => settings[control.key]).length;
  };

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent): void => {
      if (disabled) return;

      // Only handle Ctrl/Cmd + key combinations
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

      const control = syncControls.find(ctrl =>
        ctrl.shortcut && ctrl.shortcut.toLowerCase() === event.key.toLowerCase(),
      );

      if (control) {
        event.preventDefault();
        toggleSetting(control.key);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [settings, disabled, toggleSetting]);

  if (compact) {
    return (
      <TooltipProvider>
        <div className={cn('flex items-center gap-1', className)}>
          {syncControls.map((control) => (
            <Tooltip key={control.key}>
              <TooltipTrigger asChild>
                <Toggle
                  pressed={settings[control.key]}
                  onPressedChange={() => toggleSetting(control.key)}
                  disabled={disabled}
                  variant="outline"
                  size="sm"
                  className={cn(
                    'w-8 h-8 p-0',
                    settings[control.key] && 'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
                  )}
                >
                  {control.icon}
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>
                <p>{control.description}</p>
                {control.shortcut && (
                  <p className="text-xs text-muted-foreground">Ctrl+{control.shortcut}</p>
                )}
              </TooltipContent>
            </Tooltip>
          ))}

          <Separator orientation="vertical" className="h-6 mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={getActiveCount() === syncControls.length ? 'default' : 'outline'}
                size="sm"
                disabled={disabled}
                onClick={toggleAll}
                className={cn('gap-1', 'h-8')}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.07 7.07l-6.26-6.26a6 6 0 0 1 7.07-7.07l1.6 1.6a1 1 0 0 0 1.4 0Z" />
                </svg>
                <Badge variant="secondary" className="text-xs">
                  {getActiveCount()}
                </Badge>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle all synchronization</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Synchronization</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {getActiveCount()}/{syncControls.length} active
              </Badge>
              <Button
                size="sm"
                variant={getActiveCount() === syncControls.length ? 'default' : 'outline'}
                onClick={toggleAll}
                disabled={disabled}
                className="h-7 px-2 text-xs"
              >
                All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-2">
            {syncControls.map((control) => (
              <Tooltip key={control.key}>
                <TooltipTrigger asChild>
                  <Toggle
                    pressed={settings[control.key]}
                    onPressedChange={() => toggleSetting(control.key)}
                    disabled={disabled}
                    variant="outline"
                    size="sm"
                    className={cn(
                      'justify-start gap-2 h-8 px-2',
                      'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
                    )}
                  >
                    {control.icon}
                    <span className="text-xs font-medium">{control.label}</span>
                    {control.shortcut && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          'ml-auto text-xs h-4 px-1',
                          settings[control.key] && 'bg-primary-foreground/20 text-primary-foreground',
                        )}
                      >
                        ⌘{control.shortcut}
                      </Badge>
                    )}
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{control.description}</p>
                  {control.shortcut && (
                    <p className="text-xs text-muted-foreground">Press Ctrl+{control.shortcut}</p>
                  )}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};
