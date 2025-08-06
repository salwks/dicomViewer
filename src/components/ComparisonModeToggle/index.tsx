/**
 * Comparison Mode Toggle Component
 * Provides UI for switching between single viewer and comparison modes
 * Built with shadcn/ui components for consistent design
 */

import React from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Toggle } from '../ui/toggle';
import { Card, CardContent } from '../ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';
import { log } from '../../utils/logger';

export interface ComparisonModeToggleProps {
  currentMode: 'single' | 'comparison';
  onModeChange: (mode: 'single' | 'comparison') => void;
  studyCount?: number;
  maxStudies?: number;
  disabled?: boolean;
  className?: string;
  showLabels?: boolean;
  variant?: 'default' | 'compact' | 'card';
}

export const ComparisonModeToggle: React.FC<ComparisonModeToggleProps> = ({
  currentMode,
  onModeChange,
  studyCount = 0,
  maxStudies = 4,
  disabled = false,
  className,
  showLabels = true,
  variant = 'default',
}) => {
  const handleModeChange = (mode: 'single' | 'comparison') => {
    if (mode !== currentMode && !disabled) {
      log.info('Viewer mode changed', {
        component: 'ComparisonModeToggle',
        metadata: {
          previousMode: currentMode,
          newMode: mode,
          studyCount,
        },
      });
      onModeChange(mode);
    }
  };

  // Render compact variant
  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <div className={cn('flex items-center gap-1', className)}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                pressed={currentMode === 'single'}
                onPressedChange={() => handleModeChange('single')}
                disabled={disabled}
                size="sm"
                className="h-8 w-8"
                aria-label="Single viewer mode"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>
              <p>Single Viewer</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                pressed={currentMode === 'comparison'}
                onPressedChange={() => handleModeChange('comparison')}
                disabled={disabled || studyCount < 2}
                size="sm"
                className="h-8 w-8"
                aria-label="Comparison mode"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="8" height="8" rx="1" />
                  <rect x="13" y="3" width="8" height="8" rx="1" />
                  <rect x="3" y="13" width="8" height="8" rx="1" />
                  <rect x="13" y="13" width="8" height="8" rx="1" />
                </svg>
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>
              <p>Comparison Mode {studyCount < 2 && '(Need 2+ studies)'}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  // Render card variant
  if (variant === 'card') {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Viewer Mode</h4>
              {studyCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {studyCount} {studyCount === 1 ? 'study' : 'studies'}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={currentMode === 'single' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleModeChange('single')}
                disabled={disabled}
                className="w-full"
              >
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
                Single
              </Button>

              <Button
                variant={currentMode === 'comparison' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleModeChange('comparison')}
                disabled={disabled || studyCount < 2}
                className="w-full"
              >
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="8" height="8" rx="1" />
                  <rect x="13" y="3" width="8" height="8" rx="1" />
                  <rect x="3" y="13" width="8" height="8" rx="1" />
                  <rect x="13" y="13" width="8" height="8" rx="1" />
                </svg>
                Compare
              </Button>
            </div>

            {currentMode === 'comparison' && studyCount > 0 && (
              <div className="text-xs text-muted-foreground text-center">
                Comparing {Math.min(studyCount, maxStudies)} of {studyCount} studies
              </div>
            )}

            {studyCount < 2 && (
              <div className="text-xs text-muted-foreground text-center">
                Select at least 2 studies for comparison
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render default variant
  return (
    <div className={cn('inline-flex items-center gap-2 p-1 bg-muted rounded-lg', className)}>
      <Button
        variant={currentMode === 'single' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => handleModeChange('single')}
        disabled={disabled}
        className={cn(
          'transition-all',
          currentMode === 'single' && 'shadow-sm',
        )}
      >
        <svg
          className={cn('h-4 w-4', showLabels && 'mr-2')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
        {showLabels && 'Single Viewer'}
      </Button>

      <Button
        variant={currentMode === 'comparison' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => handleModeChange('comparison')}
        disabled={disabled || studyCount < 2}
        className={cn(
          'transition-all',
          currentMode === 'comparison' && 'shadow-sm',
        )}
      >
        <svg
          className={cn('h-4 w-4', showLabels && 'mr-2')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="3" width="8" height="8" rx="1" />
          <rect x="13" y="3" width="8" height="8" rx="1" />
          <rect x="3" y="13" width="8" height="8" rx="1" />
          <rect x="13" y="13" width="8" height="8" rx="1" />
        </svg>
        {showLabels && 'Comparison Mode'}
      </Button>

      {studyCount > 0 && (
        <Badge
          variant="secondary"
          className="ml-2 text-xs"
        >
          {studyCount}
        </Badge>
      )}
    </div>
  );
};

export default ComparisonModeToggle;
