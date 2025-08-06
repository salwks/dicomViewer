/**
 * ToolPanel Component
 * Tool selection and configuration panel for the medical imaging viewer
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { useViewportTools, useActiveViewport } from '../../context/ViewerContext';
import { log } from '../../utils/logger';
import { ToolType, ToolCategory, getToolNameFromType, getToolTypeFromName } from '../../types/tools';

import './constants'; // Import for side effects (backward compatibility)
// Constants moved to ./constants.ts for React fast refresh compatibility

interface Tool {
  id: ToolType;
  name: string;
  icon: React.ReactNode;
  category: ToolCategory;
  description: string;
  hotkey?: string;
}

interface ToolPanelProps {
  activeTool?: ToolType;
  onToolSelect?: (tool: ToolType) => void;
  disabledTools?: ToolType[];
  className?: string;
}

const tools: Tool[] = [
  // Navigation Tools (Confirmed Available)
  {
    id: ToolType.ZOOM,
    name: 'Zoom',
    category: ToolCategory.NAVIGATION,
    description: 'Zoom in/out of the image',
    hotkey: 'Z',
    icon: (
      <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <circle cx='11' cy='11' r='8' />
        <path d='m21 21-4.35-4.35' />
        <line x1='11' y1='8' x2='11' y2='14' />
        <line x1='8' y1='11' x2='14' y2='11' />
      </svg>
    ),
  },
  {
    id: ToolType.PAN,
    name: 'Pan',
    category: ToolCategory.NAVIGATION,
    description: 'Move the image',
    hotkey: 'P',
    icon: (
      <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <path d='M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20' />
      </svg>
    ),
  },
  {
    id: ToolType.SELECTION,
    name: 'Selection',
    category: ToolCategory.NAVIGATION,
    description: 'Select annotations for editing/deletion',
    hotkey: 'S',
    icon: (
      <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <path d='M3 3h6l6 6v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 0 0z' />
        <path d='M9 9h6v12' />
        <path d='M9 9L3 3' strokeDasharray='2 2' />
      </svg>
    ),
  },

  // Windowing (Confirmed Available)
  {
    id: ToolType.WINDOW_LEVEL,
    name: 'Window/Level',
    category: ToolCategory.WINDOWING,
    description: 'Adjust brightness and contrast',
    hotkey: 'W',
    icon: (
      <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <circle cx='12' cy='12' r='10' />
        <path d='M12 2a10 10 0 0 1 0 20' fill='currentColor' opacity='0.3' />
      </svg>
    ),
  },

  // Measurement Tools (Confirmed Available)
  {
    id: ToolType.LENGTH,
    name: 'Length',
    category: ToolCategory.MEASUREMENT,
    description: 'Measure distance',
    hotkey: 'L',
    icon: (
      <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <line x1='4' y1='20' x2='20' y2='4' />
        <circle cx='4' cy='20' r='2' fill='currentColor' />
        <circle cx='20' cy='4' r='2' fill='currentColor' />
      </svg>
    ),
  },
  {
    id: ToolType.BIDIRECTIONAL,
    name: 'Bidirectional',
    category: ToolCategory.MEASUREMENT,
    description: 'Measure length and width',
    hotkey: 'B',
    icon: (
      <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <path d='M8 12h8M12 8v8M8 8l-2 4 2 4M16 8l2 4-2 4M8 8v8M16 8v8' />
      </svg>
    ),
  },
  {
    id: ToolType.ANGLE,
    name: 'Angle',
    category: ToolCategory.MEASUREMENT,
    description: 'Measure angle',
    hotkey: 'A',
    icon: (
      <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <path d='M12 20L4 12l8-8' />
        <path d='M12 12h8' />
      </svg>
    ),
  },
  {
    id: ToolType.RECTANGLE_ROI,
    name: 'Rectangle ROI',
    category: ToolCategory.MEASUREMENT,
    description: 'Draw rectangular region of interest',
    hotkey: 'R',
    icon: (
      <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <rect x='4' y='4' width='16' height='16' rx='2' />
      </svg>
    ),
  },
  {
    id: ToolType.ELLIPSE_ROI,
    name: 'Ellipse ROI',
    category: ToolCategory.MEASUREMENT,
    description: 'Draw elliptical region of interest',
    hotkey: 'E',
    icon: (
      <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <ellipse cx='12' cy='12' rx='8' ry='6' />
      </svg>
    ),
  },
  {
    id: ToolType.PROBE,
    name: 'Probe',
    category: ToolCategory.MEASUREMENT,
    description: 'Show pixel value at point',
    hotkey: 'O',
    icon: (
      <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <circle cx='12' cy='12' r='3' fill='currentColor' />
        <path d='M12 9V3M12 15v6M9 12H3M15 12h6' />
      </svg>
    ),
  },

  // Now available tools (Previously in fallback)
  {
    id: ToolType.HEIGHT,
    name: 'Height',
    category: ToolCategory.MEASUREMENT,
    description: 'Measure vertical height',
    hotkey: 'H',
    icon: (
      <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <path d='M12 3v18M9 6l3-3 3 3M9 18l3 3 3-3' />
      </svg>
    ),
  },
  {
    id: ToolType.COBB_ANGLE,
    name: 'Cobb Angle',
    category: ToolCategory.MEASUREMENT,
    description: 'Measure spinal curvature angle',
    icon: (
      <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <path d='M4 20L8 4M16 4l4 16M8 8l8 0M8 16l8 0' />
      </svg>
    ),
  },
  {
    id: ToolType.DRAG_PROBE,
    name: 'Drag Probe',
    category: ToolCategory.MEASUREMENT,
    description: 'Show pixel values while dragging',
    icon: (
      <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <circle cx='12' cy='12' r='2' fill='currentColor' />
        <path d='M12 10V6M12 14v4M10 12H6M14 12h4' strokeDasharray='2 2' />
      </svg>
    ),
  },

  // Annotation Tools (Confirmed Available)
  {
    id: ToolType.ARROW,
    name: 'Arrow',
    category: ToolCategory.ANNOTATION,
    description: 'Draw arrow annotation',
    icon: (
      <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <line x1='5' y1='12' x2='19' y2='12' />
        <polyline points='12 5 19 12 12 19' />
      </svg>
    ),
  },
  {
    id: ToolType.FREEHAND,
    name: 'Freehand',
    category: ToolCategory.ANNOTATION,
    description: 'Draw freehand annotation',
    hotkey: 'F',
    icon: (
      <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <path d='M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z' />
      </svg>
    ),
  },
];

const categoryNames: Record<ToolCategory, string> = {
  [ToolCategory.NAVIGATION]: 'Navigation',
  [ToolCategory.WINDOWING]: 'Windowing',
  [ToolCategory.MEASUREMENT]: 'Measurement',
  [ToolCategory.ANNOTATION]: 'Annotation',
  [ToolCategory.SEGMENTATION]: 'Segmentation',
  [ToolCategory.VOLUME_3D]: '3D Tools',
};

export const ToolPanel: React.FC<ToolPanelProps> = ({
  activeTool: propActiveTool,
  onToolSelect: propOnToolSelect,
  disabledTools = [],
  className = '',
}) => {
  const [expandedCategory, setExpandedCategory] = useState<ToolCategory | null>(ToolCategory.MEASUREMENT);
  const activeViewport = useActiveViewport();

  // Use new tool state management system if viewport is available
  const viewportTools = useViewportTools(activeViewport?.id || 'main-viewport');


  // Determine active tool - use viewport tool state if available, fallback to prop
  const currentActiveTool = activeViewport
    ? getToolTypeFromName(viewportTools.activeTool)
    : propActiveTool;

  const handleCategoryToggle = useCallback((category: ToolCategory) => {
    setExpandedCategory(prev => (prev === category ? null : category));
  }, []);

  const handleToolSelect = useCallback(
    (toolId: ToolType) => {
      if (disabledTools.includes(toolId)) {
        return;
      }

      try {
        if (activeViewport) {
          // Use new tool state management system
          const toolName = getToolNameFromType(toolId);
          if (toolName) {
            viewportTools.setActiveTool(toolName);

            log.info('Tool selected via ToolPanel', {
              component: 'ToolPanel',
              metadata: { toolId, toolName, viewportId: activeViewport.id },
            });
          }
        } else if (propOnToolSelect) {
          // Fallback to prop-based tool selection
          propOnToolSelect(toolId);
        }
      } catch (error) {
        log.error('Failed to select tool', {
          component: 'ToolPanel',
          metadata: { toolId },
        }, error as Error);
      }
    },
    [activeViewport, viewportTools, propOnToolSelect, disabledTools],
  );

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ignore if user is typing in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ignore if modifier keys are pressed (except for tool-specific combinations)
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();

      // Find tool by hotkey
      const tool = tools.find(t => t.hotkey?.toLowerCase() === key);
      if (tool && !disabledTools.includes(tool.id)) {
        event.preventDefault();
        handleToolSelect(tool.id);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleToolSelect, disabledTools]);

  // Group tools by category
  const toolsByCategory = tools.reduce(
    (acc, tool) => {
      if (!acc[tool.category]) {
        acc[tool.category] = [];
      }
      acc[tool.category].push(tool);
      return acc;
    },
    {} as Record<ToolCategory, Tool[]>,
  );

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between px-4">
        <h2 className="text-lg font-semibold">Tools</h2>
      </div>

      <div className="space-y-3 px-4">
        {Object.entries(toolsByCategory).map(([category, categoryTools]) => (
          <Card key={category}>
            <CardHeader className="p-4">
              <Button
                variant="ghost"
                className="w-full justify-between p-0 h-auto font-medium"
                onClick={() => handleCategoryToggle(category as ToolCategory)}
              >
                <CardTitle className="text-sm">{categoryNames[category as ToolCategory]}</CardTitle>
                <svg
                  className={cn(
                    'w-4 h-4 transition-transform',
                    expandedCategory === category && 'rotate-180',
                  )}
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                >
                  <polyline points='6 9 12 15 18 9' />
                </svg>
              </Button>
            </CardHeader>

            {expandedCategory === category && (
              <CardContent className="p-4 pt-0">
                <div className="grid gap-2">
                  {categoryTools.map(tool => {
                    const isActive = currentActiveTool === tool.id;
                    const isDisabled = disabledTools.includes(tool.id);

                    return (
                      <Button
                        key={tool.id}
                        variant={isActive ? 'default' : 'ghost'}
                        className={cn(
                          'justify-start h-auto p-3',
                          isDisabled && 'opacity-50 cursor-not-allowed',
                        )}
                        onClick={() => handleToolSelect(tool.id)}
                        disabled={isDisabled}
                        title={`${tool.description}${tool.hotkey ? ` (${tool.hotkey})` : ''}`}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <div className="w-4 h-4 flex-shrink-0">{tool.icon}</div>
                          <span className="flex-1 text-left">{tool.name}</span>
                          {tool.hotkey && (
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-xs px-1.5 py-0.5',
                                isActive && 'border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground',
                              )}
                            >
                              {tool.hotkey}
                            </Badge>
                          )}
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <div className="px-4">
        <Card className="border-muted bg-muted/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              Click a tool to activate it. Press the highlighted key for quick access (e.g., W for Window/Level, L for Length).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
