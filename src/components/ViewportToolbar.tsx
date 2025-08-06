/**
 * ViewportToolbar Component
 * Tool selection and control interface for viewport interaction
 * Built with shadcn/ui components
 */
import { log } from '../utils/logger';

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';
import { setActiveTool, type ToolName } from '@/config/tools';
import { Move, ZoomIn, Contrast, RotateCw, Ruler, Circle, Square, Pencil, RefreshCw } from 'lucide-react';

interface Tool {
  name: ToolName;
  label: string;
  icon: React.ReactNode;
  category: 'navigation' | 'measurement' | 'annotation';
  shortcut?: string;
}

const AVAILABLE_TOOLS: Tool[] = [
  // Navigation Tools
  {
    name: 'Pan',
    label: '이동',
    icon: <Move className='h-4 w-4' />,
    category: 'navigation',
    shortcut: 'P',
  },
  {
    name: 'Zoom',
    label: '확대/축소',
    icon: <ZoomIn className='h-4 w-4' />,
    category: 'navigation',
    shortcut: 'Z',
  },
  {
    name: 'WindowLevel',
    label: '윈도우/레벨',
    icon: <Contrast className='h-4 w-4' />,
    category: 'navigation',
    shortcut: 'W',
  },
  {
    name: 'StackScroll',
    label: '스택 스크롤',
    icon: <RefreshCw className='h-4 w-4' />,
    category: 'navigation',
    shortcut: 'S',
  },
  // Measurement Tools
  {
    name: 'Length',
    label: '길이 측정',
    icon: <Ruler className='h-4 w-4' />,
    category: 'measurement',
    shortcut: 'L',
  },
  {
    name: 'Angle',
    label: '각도 측정',
    icon: <RotateCw className='h-4 w-4' />,
    category: 'measurement',
    shortcut: 'A',
  },
  {
    name: 'RectangleROI',
    label: '사각형 ROI',
    icon: <Square className='h-4 w-4' />,
    category: 'measurement',
    shortcut: 'R',
  },
  {
    name: 'EllipticalROI',
    label: '원형 ROI',
    icon: <Circle className='h-4 w-4' />,
    category: 'measurement',
    shortcut: 'E',
  },
  // Annotation Tools
  {
    name: 'ArrowAnnotate',
    label: '화살표 주석',
    icon: <Pencil className='h-4 w-4' />,
    category: 'annotation',
    shortcut: 'T',
  },
];

interface ViewportToolbarProps {
  className?: string;
  onToolChange?: (tool: ToolName) => void;
  defaultTool?: ToolName;
  toolGroupId?: string;
  orientation?: 'horizontal' | 'vertical';
}

export const ViewportToolbar: React.FC<ViewportToolbarProps> = ({
  className,
  onToolChange,
  defaultTool = 'WindowLevel',
  toolGroupId,
  orientation = 'horizontal',
}) => {
  const [activeTool, setActiveToolState] = useState<ToolName>(defaultTool);
  // const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  const handleToolSelect = useCallback(
    (toolName: ToolName) => {
      try {
        // Update Cornerstone tool
        setActiveTool(toolName, toolGroupId);

        // Update local state
        setActiveToolState(toolName);

        // Notify parent
        if (onToolChange) {
          onToolChange(toolName);
        }

        log.info(`Tool activated: ${toolName}`);
      } catch (error) {
        console.error('Failed to activate tool:', error);
      }
    },
    [toolGroupId, onToolChange],
  );

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent): void => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const tool = AVAILABLE_TOOLS.find(t => t.shortcut?.toLowerCase() === e.key.toLowerCase());

      if (tool) {
        e.preventDefault();
        handleToolSelect(tool.name);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleToolSelect]);

  const renderToolButton = (tool: Tool): React.ReactNode => (
    <Toggle
      key={tool.name}
      pressed={activeTool === tool.name}
      onPressedChange={(pressed: boolean) => {
        if (pressed) {
          handleToolSelect(tool.name);
        }
      }}
      className={cn('relative p-2', activeTool === tool.name && 'bg-primary text-primary-foreground')}
      aria-label={tool.label}
      title={`${tool.label} (${tool.shortcut})`}
    >
      {tool.icon}
      {tool.shortcut && <span className='absolute top-0.5 right-0.5 text-[8px] opacity-60'>{tool.shortcut}</span>}
    </Toggle>
  );

  const navigationTools = AVAILABLE_TOOLS.filter(t => t.category === 'navigation');
  const measurementTools = AVAILABLE_TOOLS.filter(t => t.category === 'measurement');
  const annotationTools = AVAILABLE_TOOLS.filter(t => t.category === 'annotation');

  if (orientation === 'vertical') {
    return (
      <Card className={cn('p-2 space-y-2', className)}>
        {/* Navigation Tools */}
        <div className='space-y-1'>
          <div className='text-xs font-medium text-muted-foreground px-1'>탐색</div>
          <div className='grid grid-cols-2 gap-1'>{navigationTools.map(renderToolButton)}</div>
        </div>

        <Separator />

        {/* Measurement Tools */}
        <div className='space-y-1'>
          <div className='text-xs font-medium text-muted-foreground px-1'>측정</div>
          <div className='grid grid-cols-2 gap-1'>{measurementTools.map(renderToolButton)}</div>
        </div>

        <Separator />

        {/* Annotation Tools */}
        <div className='space-y-1'>
          <div className='text-xs font-medium text-muted-foreground px-1'>주석</div>
          <div className='grid grid-cols-2 gap-1'>{annotationTools.map(renderToolButton)}</div>
        </div>

        {/* Active Tool Display */}
        <div className='pt-2 border-t'>
          <Badge variant='secondary' className='w-full text-xs'>
            현재: {AVAILABLE_TOOLS.find(t => t.name === activeTool)?.label}
          </Badge>
        </div>
      </Card>
    );
  }

  // Horizontal layout
  return (
    <Card className={cn('flex items-center gap-2 p-2', className)}>
      {/* Navigation Tools */}
      <div className='flex items-center gap-1'>{navigationTools.map(renderToolButton)}</div>

      <Separator orientation='vertical' className='h-6' />

      {/* Measurement Tools */}
      <div className='flex items-center gap-1'>{measurementTools.map(renderToolButton)}</div>

      <Separator orientation='vertical' className='h-6' />

      {/* Annotation Tools */}
      <div className='flex items-center gap-1'>{annotationTools.map(renderToolButton)}</div>

      {/* Active Tool Display */}
      <div className='ml-auto'>
        <Badge variant='secondary' className='text-xs'>
          {AVAILABLE_TOOLS.find(t => t.name === activeTool)?.label}
        </Badge>
      </div>
    </Card>
  );
};

/**
 * Compact toolbar for limited space
 */
export const CompactViewportToolbar: React.FC<ViewportToolbarProps> = ({
  className,
  onToolChange,
  defaultTool = 'WindowLevel',
  toolGroupId,
}) => {
  const [activeTool, setActiveToolState] = useState<ToolName>(defaultTool);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToolSelect = useCallback(
    (toolName: ToolName) => {
      setActiveTool(toolName, toolGroupId);
      setActiveToolState(toolName);
      setIsExpanded(false);

      if (onToolChange) {
        onToolChange(toolName);
      }
    },
    [toolGroupId, onToolChange],
  );

  const activeTookConfig = AVAILABLE_TOOLS.find(t => t.name === activeTool);

  return (
    <div className={cn('relative', className)}>
      <Button
        variant='outline'
        size='sm'
        onClick={() => {
          setIsExpanded(!isExpanded);
        }}
        className='gap-2'
      >
        {activeTookConfig?.icon}
        <span className='text-xs'>{activeTookConfig?.label}</span>
      </Button>

      {isExpanded && (
        <Card className='absolute top-full left-0 mt-1 p-2 z-50'>
          <div className='grid grid-cols-3 gap-1'>
            {AVAILABLE_TOOLS.map(tool => (
              <Toggle
                key={tool.name}
                pressed={activeTool === tool.name}
                onPressedChange={() => {
                  handleToolSelect(tool.name);
                }}
                className='p-2'
                title={tool.label}
              >
                {tool.icon}
              </Toggle>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
