/**
 * Layout Selector Component
 * Visual layout selector with preview icons for viewport configurations
 * Enhanced for comparison mode support with shadcn/ui ToggleGroup components
 */

import React from 'react';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
// Local type definition
type ViewportLayout = '1x1' | '1x2' | '2x1' | '2x2' | '1x3' | '3x1' | '2x3' | '3x2';
import { ComparisonLayout } from '../../services/ComparisonViewportManager';
import { cn, safePropertyAccess } from '../../lib/utils';

export interface LayoutSelectorProps {
  currentLayout: ViewportLayout;
  onLayoutChange: (layout: ViewportLayout) => void;
  disabled?: boolean;
  className?: string;
  mode?: 'standard' | 'comparison';
  comparisonLayouts?: ComparisonLayout[];
  onComparisonLayoutChange?: (layout: ComparisonLayout) => void;
  currentComparisonLayout?: ComparisonLayout | null;
}

interface LayoutOption {
  id: ViewportLayout;
  label: string;
  description: string;
  icon: React.ReactNode;
  shortcut: string;
}

interface ComparisonLayoutOption {
  id: string;
  layout: ComparisonLayout;
  description: string;
  label: string;
  icon: React.ReactNode;
  shortcut: string;
}

const standardLayoutOptions: LayoutOption[] = [
  {
    id: '1x1',
    label: 'Single',
    description: 'Single viewport',
    shortcut: '1',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
      </svg>
    ),
  },
  {
    id: '1x2',
    label: 'Side by Side',
    description: 'Two viewports side by side',
    shortcut: '2',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="8" height="18" rx="1" />
        <rect x="13" y="3" width="8" height="18" rx="1" />
      </svg>
    ),
  },
  {
    id: '2x1',
    label: 'Top/Bottom',
    description: 'Two viewports stacked vertically',
    shortcut: '3',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="8" rx="1" />
        <rect x="3" y="13" width="18" height="8" rx="1" />
      </svg>
    ),
  },
  {
    id: '2x2',
    label: 'Quad',
    description: 'Four viewports in grid',
    shortcut: '4',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="8" height="8" rx="1" />
        <rect x="13" y="3" width="8" height="8" rx="1" />
        <rect x="3" y="13" width="8" height="8" rx="1" />
        <rect x="13" y="13" width="8" height="8" rx="1" />
      </svg>
    ),
  },
];

// Generate comparison layout options with icons
const generateComparisonLayoutOptions = (layouts: ComparisonLayout[]): ComparisonLayoutOption[] => {
  return layouts.map((layout, index) => {
    let icon: React.ReactNode;

    switch (layout.type) {
      case '1x1':
        icon = (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
          </svg>
        );
        break;
      case '1x2':
        icon = (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="8" height="18" rx="1" />
            <rect x="13" y="3" width="8" height="18" rx="1" />
            {layout.crossReferenceEnabled && (
              <line x1="11" y1="8" x2="13" y2="16" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
            )}
          </svg>
        );
        break;
      case '2x2':
        icon = (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="8" height="8" rx="1" />
            <rect x="13" y="3" width="8" height="8" rx="1" />
            <rect x="3" y="13" width="8" height="8" rx="1" />
            <rect x="13" y="13" width="8" height="8" rx="1" />
            {layout.crossReferenceEnabled && (
              <>
                <line x1="11" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1" strokeDasharray="1,1" />
                <line x1="11" y1="17" x2="13" y2="17" stroke="currentColor" strokeWidth="1" strokeDasharray="1,1" />
              </>
            )}
          </svg>
        );
        break;
      default:
        icon = (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
        );
    }

    return {
      id: layout.id,
      layout,
      description: `${layout.type} comparison layout`,
      label: layout.type.toUpperCase(),
      icon,
      shortcut: String(index + 1),
    };
  });
};

export const LayoutSelector: React.FC<LayoutSelectorProps> = ({
  currentLayout,
  onLayoutChange,
  disabled = false,
  className = '',
  mode = 'standard',
  comparisonLayouts = [],
  onComparisonLayoutChange,
  currentComparisonLayout,
}) => {
  const actualLayoutOptions = mode === 'comparison' && comparisonLayouts.length > 0
    ? generateComparisonLayoutOptions(comparisonLayouts)
    : standardLayoutOptions;

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent): void => {
      if (disabled) return;

      // Only handle if no modifier keys and not in input/textarea
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

      if (mode === 'comparison' && comparisonLayouts.length > 0 && onComparisonLayoutChange) {
        // Handle comparison layout shortcuts
        const optionIndex = parseInt(event.key) - 1;
        if (!isNaN(optionIndex) && optionIndex >= 0 && optionIndex < comparisonLayouts.length) {
          const layout = safePropertyAccess(comparisonLayouts, optionIndex);
          if (layout && layout.id !== currentComparisonLayout?.id) {
            event.preventDefault();
            onComparisonLayoutChange(layout);
          }
        }
      } else {
        // Handle standard layout shortcuts
        const option = standardLayoutOptions.find(opt => opt.shortcut === event.key);
        if (option && option.id !== currentLayout) {
          event.preventDefault();
          onLayoutChange(option.id);
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [currentLayout, onLayoutChange, disabled, mode, comparisonLayouts, onComparisonLayoutChange, currentComparisonLayout]);

  // Render comparison mode
  if (mode === 'comparison' && comparisonLayouts.length > 0 && onComparisonLayoutChange) {
    const comparisonOptions = generateComparisonLayoutOptions(comparisonLayouts);

    return (
      <TooltipProvider>
        <div className={cn('flex flex-col gap-2', className)}>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Comparison Mode
            </Badge>
            {currentComparisonLayout?.crossReferenceEnabled && (
              <Badge variant="secondary" className="text-xs">
                Cross-Reference
              </Badge>
            )}
          </div>

          <ToggleGroup
            type="single"
            value={currentComparisonLayout?.id || ''}
            onValueChange={(value) => {
              if (value) {
                const layout = comparisonLayouts.find(l => l.id === value);
                if (layout && layout.id !== currentComparisonLayout?.id) {
                  onComparisonLayoutChange(layout);
                }
              }
            }}
            disabled={disabled}
            className="flex items-center gap-1"
          >
            {comparisonOptions.map((option) => (
              <Tooltip key={option.layout.id}>
                <TooltipTrigger asChild>
                  <ToggleGroupItem
                    value={option.layout.id}
                    aria-label={`${option.layout.name} (Press ${option.shortcut})`}
                    className={cn(
                      'relative flex items-center gap-2 px-3 py-2',
                      'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
                    )}
                  >
                    {option.icon}
                    <span className="text-xs font-medium">{option.layout.type}</span>

                    {/* Keyboard shortcut indicator */}
                    <Badge
                      variant="secondary"
                      className={cn(
                        'absolute -top-1 -right-1 w-4 h-4 p-0 text-xs',
                        'flex items-center justify-center',
                        'bg-muted text-muted-foreground border border-border',
                      )}
                    >
                      {option.shortcut}
                    </Badge>
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{option.layout.name}</p>
                  <p className="text-xs text-muted-foreground">Press {option.shortcut}</p>
                  {option.layout.crossReferenceEnabled && (
                    <p className="text-xs text-blue-400">Cross-reference enabled</p>
                  )}
                  {option.layout.synchronizationGroups && (
                    <p className="text-xs text-green-400">
                      {option.layout.synchronizationGroups.length} sync groups
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            ))}
          </ToggleGroup>
        </div>
      </TooltipProvider>
    );
  }

  // Render standard mode
  return (
    <TooltipProvider>
      <ToggleGroup
        type="single"
        value={currentLayout}
        onValueChange={(value) => {
          if (value && value !== currentLayout) {
            onLayoutChange(value as ViewportLayout);
          }
        }}
        disabled={disabled}
        className={cn('flex items-center gap-1', className)}
      >
        {actualLayoutOptions.map((option) => (
          <Tooltip key={option.id}>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                value={option.id}
                aria-label={`${option.description} (Press ${option.shortcut})`}
                className={cn(
                  'relative flex items-center gap-2 px-3 py-2',
                  'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
                )}
              >
                {option.icon}
                <span className="text-xs font-medium">{option.label}</span>

                {/* Keyboard shortcut indicator using shadcn/ui Badge */}
                <Badge
                  variant="secondary"
                  className={cn(
                    'absolute -top-1 -right-1 w-4 h-4 p-0 text-xs',
                    'flex items-center justify-center',
                    'bg-muted text-muted-foreground border border-border',
                  )}
                >
                  {option.shortcut}
                </Badge>
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>
              <p>{option.description}</p>
              <p className="text-xs text-muted-foreground">Press {option.shortcut}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
    </TooltipProvider>
  );
};
