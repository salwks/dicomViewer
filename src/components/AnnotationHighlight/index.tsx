/**
 * Annotation Highlight System
 * Main component that orchestrates annotation highlighting functionality
 * Task 34.2: Implement Highlight Visualization System
 * Built with shadcn/ui components - required enforcement pattern
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import HighlightRenderer, { HighlightStyle, HighlightOptions } from './HighlightRenderer';
import { AnnotationCompat } from '../../types/annotation-compat';
import { log } from '../../utils/logger';

export interface AnnotationHighlightProps {
  annotations: AnnotationCompat[];
  selectedAnnotationIds: Set<string>;
  viewportId: string;
  className?: string;
  onAnnotationSelect?: (annotationId: string, selected: boolean) => void;
  onHighlightStyleChange?: (style: HighlightStyle) => void;
  disabled?: boolean;
  showControls?: boolean;
}

export const AnnotationHighlight: React.FC<AnnotationHighlightProps> = ({
  annotations,
  selectedAnnotationIds,
  viewportId,
  className,
  onAnnotationSelect,
  onHighlightStyleChange,
  disabled = false,
  showControls = false,
}) => {
  // Highlight style state
  const [highlightStyle, setHighlightStyle] = useState<HighlightStyle>({
    color: '#87CEEB', // Sky blue as specified
    thickness: 3,
    opacity: 0.8,
    glowRadius: 8,
    pulseEnabled: true,
    pulseSpeed: 2000,
  });

  // Apply dynamic colors via CSS variables
  useEffect(() => {
    const badges = document.querySelectorAll('[data-highlight-color]');
    badges.forEach((badge) => {
      const color = badge.getAttribute('data-highlight-color');
      if (color && badge instanceof HTMLElement) {
        badge.style.setProperty('--highlight-color', color);
        badge.style.borderColor = color;
        badge.style.color = color;
      }
    });

    const presetButtons = document.querySelectorAll('[data-preset-color]');
    presetButtons.forEach((button) => {
      const color = button.getAttribute('data-preset-color');
      if (color && button instanceof HTMLElement) {
        button.style.setProperty('--preset-color', color);
        button.style.borderColor = color;
        button.style.color = color;
      }
    });
  }, [highlightStyle.color]);

  // Interactive options
  const [highlightOptions, setHighlightOptions] = useState<HighlightOptions>({
    style: highlightStyle,
    duration: 300,
    easing: 'ease-out',
    priority: 1,
    persistent: true,
    interactive: true,
  });

  // Update options when style changes
  useEffect(() => {
    setHighlightOptions(prev => ({
      ...prev,
      style: highlightStyle,
    }));
  }, [highlightStyle]);

  // Handle style changes
  const handleStyleChange = useCallback((updates: Partial<HighlightStyle>) => {
    const newStyle = { ...highlightStyle, ...updates };
    setHighlightStyle(newStyle);
    onHighlightStyleChange?.(newStyle);

    log.info('Highlight style updated', {
      component: 'AnnotationHighlight',
      metadata: { viewportId, updates },
    });
  }, [highlightStyle, onHighlightStyleChange, viewportId]);

  // Handle highlight click
  const handleHighlightClick = useCallback((annotationId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    const isSelected = selectedAnnotationIds.has(annotationId);
    onAnnotationSelect?.(annotationId, !isSelected);

    log.info('Highlight clicked', {
      component: 'AnnotationHighlight',
      metadata: { annotationId, viewportId, wasSelected: isSelected },
    });
  }, [selectedAnnotationIds, onAnnotationSelect, viewportId, annotations]);

  // Handle highlight hover
  const handleHighlightHover = useCallback((annotationId: string, _event: React.MouseEvent) => {
    // Could implement hover effects here
    log.info('Highlight hovered', {
      component: 'AnnotationHighlight',
      metadata: { annotationId, viewportId },
    });
  }, [viewportId]);

  // Get highlight statistics
  const highlightStats = useMemo(() => {
    return {
      total: annotations.length,
      selected: selectedAnnotationIds.size,
      visible: annotations.filter(a => selectedAnnotationIds.has(a.id)).length,
    };
  }, [annotations.length, selectedAnnotationIds]);

  // Preset highlight styles
  const presetStyles = useMemo(() => [
    {
      name: 'Sky Blue (Default)',
      style: { color: '#87CEEB', thickness: 3, opacity: 0.8, pulseEnabled: true },
    },
    {
      name: 'Electric Blue',
      style: { color: '#0080FF', thickness: 2, opacity: 0.9, pulseEnabled: false },
    },
    {
      name: 'Cyan Glow',
      style: { color: '#00FFFF', thickness: 4, opacity: 0.7, glowRadius: 12, pulseEnabled: true },
    },
    {
      name: 'Subtle Blue',
      style: { color: '#ADD8E6', thickness: 1, opacity: 0.6, pulseEnabled: false },
    },
  ], []);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main highlight renderer */}
      <HighlightRenderer
        annotations={annotations}
        selectedAnnotationIds={selectedAnnotationIds}
        viewportId={viewportId}
        onHighlightClick={handleHighlightClick}
        onHighlightHover={handleHighlightHover}
        highlightOptions={highlightOptions}
        disabled={disabled}
        className="w-full"
      />

      {/* Statistics and status */}
      <Card className="bg-background/90 backdrop-blur-sm border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="text-xs">
                {highlightStats.selected} / {highlightStats.total} selected
              </Badge>

              {highlightStats.selected > 0 && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-xs transition-colors",
                    "border-2"
                  )}
                  data-highlight-color={highlightStyle.color}
                >
                  {highlightStyle.color}
                </Badge>
              )}
            </div>

            {highlightStyle.pulseEnabled && highlightStats.selected > 0 && (
              <Badge variant="secondary" className="text-xs animate-pulse">
                Pulsing
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Controls panel */}
      {showControls && (
        <Card className="bg-background/90 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Highlight Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Preset styles */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Preset Styles
              </label>
              <div className="grid grid-cols-2 gap-2">
                {presetStyles.map((preset) => (
                  <Button
                    key={preset.name}
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-8 text-xs transition-all",
                      "hover:opacity-80 focus:ring-2"
                    )}
                    onClick={() => handleStyleChange(preset.style)}
                    data-preset-color={preset.style.color}
                  >
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Thickness control */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Thickness: {highlightStyle.thickness}px
              </label>
              <Slider
                value={[highlightStyle.thickness]}
                onValueChange={([value]) => handleStyleChange({ thickness: value })}
                min={1}
                max={10}
                step={1}
                className="w-full"
              />
            </div>

            {/* Opacity control */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Opacity: {Math.round(highlightStyle.opacity * 100)}%
              </label>
              <Slider
                value={[highlightStyle.opacity]}
                onValueChange={([value]) => handleStyleChange({ opacity: value })}
                min={0.1}
                max={1.0}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Glow radius control */}
            {highlightStyle.glowRadius !== undefined && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Glow Radius: {highlightStyle.glowRadius}px
                </label>
                <Slider
                  value={[highlightStyle.glowRadius]}
                  onValueChange={([value]) => handleStyleChange({ glowRadius: value })}
                  min={0}
                  max={20}
                  step={1}
                  className="w-full"
                />
              </div>
            )}

            {/* Pulse control */}
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Pulse Animation
              </label>
              <Switch
                checked={highlightStyle.pulseEnabled || false}
                onCheckedChange={(checked) => handleStyleChange({ pulseEnabled: checked })}
              />
            </div>

            {/* Pulse speed control (only when pulse is enabled) */}
            {highlightStyle.pulseEnabled && highlightStyle.pulseSpeed && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Pulse Speed: {highlightStyle.pulseSpeed / 1000}s
                </label>
                <Slider
                  value={[highlightStyle.pulseSpeed]}
                  onValueChange={([value]) => handleStyleChange({ pulseSpeed: value })}
                  min={500}
                  max={5000}
                  step={100}
                  className="w-full"
                />
              </div>
            )}

            <Separator />

            {/* Reset button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStyleChange({
                color: '#87CEEB',
                thickness: 3,
                opacity: 0.8,
                glowRadius: 8,
                pulseEnabled: true,
                pulseSpeed: 2000,
              })}
              className="w-full text-xs"
            >
              Reset to Default
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AnnotationHighlight;

// Re-export types for convenience
export type { HighlightStyle, HighlightOptions } from './HighlightRenderer';
