/**
 * Multi-Viewer Toolbar Component
 * 
 * This component provides tool selection and controls for the multi-viewer system.
 * Tools are applied to the currently active viewer only.
 */

import React, { useCallback } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { 
  activeViewerIdState,
  toolStateByViewerIdState,
  toolForViewerSelector,
  ToolType
} from '../state/multiViewerAtoms';
import { 
  MousePointer2, 
  Ruler, 
  Square, 
  Circle, 
  Triangle, 
  Move, 
  ZoomIn, 
  Contrast,
  Target,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  RotateCcw,
  Settings
} from 'lucide-react';

interface MultiViewerToolbarProps {
  className?: string;
}

const MultiViewerToolbar: React.FC<MultiViewerToolbarProps> = ({ className = '' }) => {
  const [activeViewerId, setActiveViewerId] = useRecoilState(activeViewerIdState);
  const [toolStateByViewerId, setToolStateByViewerId] = useRecoilState(toolStateByViewerIdState);
  
  // Get current tool for active viewer
  const currentTool = activeViewerId ? useRecoilValue(toolForViewerSelector(activeViewerId)) : null;

  // Tool definitions
  const tools = [
    { id: 'Pan' as ToolType, icon: Move, label: 'Pan', shortcut: 'P' },
    { id: 'Zoom' as ToolType, icon: ZoomIn, label: 'Zoom', shortcut: 'Z' },
    { id: 'WindowLevel' as ToolType, icon: Contrast, label: 'Window/Level', shortcut: 'W' },
    { id: 'Length' as ToolType, icon: Ruler, label: 'Length', shortcut: 'L' },
    { id: 'Angle' as ToolType, icon: Triangle, label: 'Angle', shortcut: 'A' },
    { id: 'RectangleROI' as ToolType, icon: Square, label: 'Rectangle ROI', shortcut: 'R' },
    { id: 'EllipseROI' as ToolType, icon: Circle, label: 'Ellipse ROI', shortcut: 'E' },
    { id: 'Probe' as ToolType, icon: Target, label: 'Probe', shortcut: 'T' },
  ];

  // Handle tool selection
  const handleToolSelect = useCallback((tool: ToolType) => {
    if (!activeViewerId) return;

    // Update tool state for the active viewer
    setToolStateByViewerId(prev => ({
      ...prev,
      [activeViewerId]: tool
    }));

    // Dispatch custom event to notify the active viewer
    const event = new CustomEvent('toolChange', {
      detail: { viewerId: activeViewerId, tool }
    });
    window.dispatchEvent(event);
  }, [activeViewerId, setToolStateByViewerId]);

  // Handle viewport actions
  const handleViewportAction = useCallback((action: string) => {
    if (!activeViewerId) return;

    const event = new CustomEvent('viewportAction', {
      detail: { viewerId: activeViewerId, action }
    });
    window.dispatchEvent(event);
  }, [activeViewerId]);

  // Handle reset
  const handleReset = useCallback(() => {
    if (!activeViewerId) return;

    const event = new CustomEvent('viewportReset', {
      detail: { viewerId: activeViewerId }
    });
    window.dispatchEvent(event);
  }, [activeViewerId]);

  return (
    <div className={`bg-white border-b border-gray-200 px-4 py-2 ${className}`}>
      <div className="flex items-center justify-between">
        {/* Tool Selection */}
        <div className="flex items-center space-x-1">
          <div className="flex items-center space-x-2 mr-4">
            <h3 className="text-sm font-medium text-gray-700">Tools:</h3>
            {!activeViewerId && (
              <span className="text-xs text-gray-500">Select a viewer to use tools</span>
            )}
          </div>

          {tools.map(tool => {
            const isActive = currentTool === tool.id;
            const isDisabled = !activeViewerId;
            
            return (
              <button
                key={tool.id}
                onClick={() => handleToolSelect(tool.id)}
                disabled={isDisabled}
                className={`
                  relative flex items-center justify-center p-2 rounded-md transition-all duration-200
                  ${isActive 
                    ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm' 
                    : isDisabled
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                  }
                `}
                title={`${tool.label} (${tool.shortcut})`}
              >
                <tool.icon className="w-4 h-4" />
                {isActive && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Viewport Controls */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <span className="text-sm text-gray-700 mr-2">Actions:</span>
            
            <button
              onClick={() => handleViewportAction('rotateClockwise')}
              disabled={!activeViewerId}
              className={`
                p-2 rounded-md transition-colors
                ${activeViewerId 
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }
              `}
              title="Rotate Clockwise"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => handleViewportAction('rotateCounterClockwise')}
              disabled={!activeViewerId}
              className={`
                p-2 rounded-md transition-colors
                ${activeViewerId 
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }
              `}
              title="Rotate Counter-Clockwise"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => handleViewportAction('flipHorizontal')}
              disabled={!activeViewerId}
              className={`
                p-2 rounded-md transition-colors
                ${activeViewerId 
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }
              `}
              title="Flip Horizontal"
            >
              <FlipHorizontal className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => handleViewportAction('flipVertical')}
              disabled={!activeViewerId}
              className={`
                p-2 rounded-md transition-colors
                ${activeViewerId 
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }
              `}
              title="Flip Vertical"
            >
              <FlipVertical className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => handleViewportAction('invert')}
              disabled={!activeViewerId}
              className={`
                p-2 rounded-md transition-colors
                ${activeViewerId 
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }
              `}
              title="Invert Colors"
            >
              <Contrast className="w-4 h-4" />
            </button>
            
            <button
              onClick={handleReset}
              disabled={!activeViewerId}
              className={`
                px-3 py-2 rounded-md text-sm font-medium transition-colors
                ${activeViewerId 
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }
              `}
              title="Reset Viewport"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Active Viewer Indicator */}
        {activeViewerId && (
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm text-gray-700">
              Active: Viewer {activeViewerId}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiViewerToolbar;