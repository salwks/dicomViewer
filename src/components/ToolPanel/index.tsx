/**
 * ToolPanel Component
 * Tool selection and configuration panel for the medical imaging viewer
 */

import React, { useState, useCallback } from 'react';
import './styles.css';

import { ToolType, ToolCategory } from './constants';
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
  // Navigation Tools
  {
    id: ToolType.ZOOM,
    name: 'Zoom',
    category: ToolCategory.NAVIGATION,
    description: 'Zoom in/out of the image',
    hotkey: 'Z',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
        <line x1="11" y1="8" x2="11" y2="14" />
        <line x1="8" y1="11" x2="14" y2="11" />
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
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
      </svg>
    ),
  },
  {
    id: ToolType.STACK_SCROLL,
    name: 'Stack Scroll',
    category: ToolCategory.NAVIGATION,
    description: 'Scroll through image stack',
    hotkey: 'S',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="3" y1="15" x2="21" y2="15" />
      </svg>
    ),
  },

  // Windowing
  {
    id: ToolType.WINDOW_LEVEL,
    name: 'Window/Level',
    category: ToolCategory.WINDOWING,
    description: 'Adjust brightness and contrast',
    hotkey: 'W',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a10 10 0 0 1 0 20" fill="currentColor" opacity="0.3" />
      </svg>
    ),
  },

  // Measurement Tools
  {
    id: ToolType.LENGTH,
    name: 'Length',
    category: ToolCategory.MEASUREMENT,
    description: 'Measure distance',
    hotkey: 'L',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="4" y1="20" x2="20" y2="4" />
        <circle cx="4" cy="20" r="2" fill="currentColor" />
        <circle cx="20" cy="4" r="2" fill="currentColor" />
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
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 20L4 12l8-8" />
        <path d="M12 12h8" />
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
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="4" width="16" height="16" rx="2" />
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
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <ellipse cx="12" cy="12" rx="8" ry="6" />
      </svg>
    ),
  },

  // Annotation Tools
  {
    id: ToolType.ARROW,
    name: 'Arrow',
    category: ToolCategory.ANNOTATION,
    description: 'Draw arrow annotation',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    ),
  },
  {
    id: ToolType.TEXT,
    name: 'Text',
    category: ToolCategory.ANNOTATION,
    description: 'Add text annotation',
    hotkey: 'T',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="4 7 4 4 20 4 20 7" />
        <line x1="12" y1="4" x2="12" y2="20" />
        <line x1="8" y1="20" x2="16" y2="20" />
      </svg>
    ),
  },

  // Segmentation Tools
  {
    id: ToolType.BRUSH,
    name: 'Brush',
    category: ToolCategory.SEGMENTATION,
    description: 'Manual segmentation brush',
    hotkey: 'B',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 11l-6 6v3h3l6-6M22 2l-8 8" />
        <path d="m15 9 3-3" />
      </svg>
    ),
  },
  {
    id: ToolType.THRESHOLD,
    name: 'Threshold',
    category: ToolCategory.SEGMENTATION,
    description: 'Threshold-based segmentation',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" />
        <rect x="3" y="12" width="18" height="9" fill="currentColor" opacity="0.3" />
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
  activeTool,
  onToolSelect,
  disabledTools = [],
  className = '',
}) => {
  const [expandedCategory, setExpandedCategory] = useState<ToolCategory | null>(
    ToolCategory.MEASUREMENT,
  );

  const handleCategoryToggle = useCallback((category: ToolCategory) => {
    setExpandedCategory(prev => prev === category ? null : category);
  }, []);

  const handleToolSelect = useCallback((toolId: ToolType) => {
    if (onToolSelect && !disabledTools.includes(toolId)) {
      onToolSelect(toolId);
    }
  }, [onToolSelect, disabledTools]);

  // Group tools by category
  const toolsByCategory = tools.reduce((acc, tool) => {
    if (!acc[tool.category]) {
      acc[tool.category] = [];
    }
    acc[tool.category].push(tool);
    return acc;
  }, {} as Record<ToolCategory, Tool[]>);

  return (
    <div className={`tool-panel ${className}`}>
      <h2 className="tool-panel__title">Tools</h2>

      <div className="tool-panel__categories">
        {Object.entries(toolsByCategory).map(([category, categoryTools]) => (
          <div key={category} className="tool-panel__category">
            <button
              className="tool-panel__category-header"
              onClick={() => handleCategoryToggle(category as ToolCategory)}
              aria-expanded={expandedCategory === category}
            >
              <span className="tool-panel__category-name">
                {categoryNames[category as ToolCategory]}
              </span>
              <svg
                className={`tool-panel__category-icon ${
                  expandedCategory === category ? 'tool-panel__category-icon--expanded' : ''
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {expandedCategory === category && (
              <div className="tool-panel__tools">
                {categoryTools.map(tool => {
                  const isActive = activeTool === tool.id;
                  const isDisabled = disabledTools.includes(tool.id);

                  return (
                    <button
                      key={tool.id}
                      className={`tool-panel__tool ${
                        isActive ? 'tool-panel__tool--active' : ''
                      } ${isDisabled ? 'tool-panel__tool--disabled' : ''}`}
                      onClick={() => handleToolSelect(tool.id)}
                      disabled={isDisabled}
                      title={`${tool.description}${tool.hotkey ? ` (${tool.hotkey})` : ''}`}
                      aria-label={tool.name}
                      aria-pressed={isActive}
                    >
                      <span className="tool-panel__tool-icon">
                        {tool.icon}
                      </span>
                      <span className="tool-panel__tool-name">
                        {tool.name}
                      </span>
                      {tool.hotkey && (
                        <span className="tool-panel__tool-hotkey">
                          {tool.hotkey}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="tool-panel__help">
        <p className="tool-panel__help-text">
          Click a tool to activate it. Use keyboard shortcuts for quick access.
        </p>
      </div>
    </div>
  );
};
