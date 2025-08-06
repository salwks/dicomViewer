import { GripVertical } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

// Mock implementations until react-resizable-panels is installed
interface PanelGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: 'horizontal' | 'vertical';
}

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
}

interface PanelResizeHandleProps extends React.HTMLAttributes<HTMLDivElement> {
  withHandle?: boolean;
}

const ResizablePanelGroup = React.forwardRef<HTMLDivElement, PanelGroupProps>(({
  className,
  direction = 'horizontal',
  ...props
}, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex h-full w-full',
      direction === 'vertical' ? 'flex-col' : 'flex-row',
      className,
    )}
    {...props}
  />
));
ResizablePanelGroup.displayName = 'ResizablePanelGroup';

const ResizablePanel = React.forwardRef<HTMLDivElement, PanelProps>(({
  className,
  defaultSize,
  minSize,
  maxSize,
  ...props
}, ref) => (
  <div
    ref={ref}
    className={cn('flex-1', className)}
    style={{
      flexBasis: defaultSize ? `${defaultSize}%` : undefined,
      minWidth: minSize ? `${minSize}%` : undefined,
      maxWidth: maxSize ? `${maxSize}%` : undefined,
    }}
    {...props}
  />
));
ResizablePanel.displayName = 'ResizablePanel';

const ResizableHandle = React.forwardRef<HTMLDivElement, PanelResizeHandleProps>(({
  withHandle,
  className,
  ...props
}, ref) => (
  <div
    ref={ref}
    className={cn(
      'relative flex w-px items-center justify-center bg-border cursor-col-resize',
      className,
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </div>
));
ResizableHandle.displayName = 'ResizableHandle';

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
