import React from 'react';
import { 
  MousePointer, 
  Move, 
  ZoomIn, 
  Palette,
  Ruler,
  Triangle,
  Square,
  Circle,
  Grid,
  Layers
} from 'lucide-react';
import type { LayoutType } from '../types';

interface ToolbarProps {
  activeTool: string | null;
  onToolChange: (toolName: string) => void;
  layoutType: LayoutType;
  onLayoutChange: (layout: LayoutType) => void;
  disabled?: boolean;
}

const tools = [
  { name: 'WindowLevel', icon: Palette, label: 'Window/Level' },
  { name: 'Pan', icon: Move, label: 'Pan' },
  { name: 'Zoom', icon: ZoomIn, label: 'Zoom' },
  { name: 'Length', icon: Ruler, label: 'Length' },
  { name: 'Angle', icon: Triangle, label: 'Angle' },
  { name: 'RectangleROI', icon: Square, label: 'Rectangle ROI' },
  { name: 'EllipticalROI', icon: Circle, label: 'Ellipse ROI' },
];

const layouts: LayoutType[] = ['1x1', '1x2', '2x1', '2x2'];

export function Toolbar({ 
  activeTool, 
  onToolChange, 
  layoutType, 
  onLayoutChange, 
  disabled = false 
}: ToolbarProps): JSX.Element {
  return (
    <div className="toolbar">
      {/* Tool Section */}
      <div className="toolbar-section">
        <label className="toolbar-label">Tools</label>
        <div className="toolbar-group">
          {tools.map(({ name, icon: Icon, label }) => (
            <button
              key={name}
              className={`toolbar-button ${activeTool === name ? 'active' : ''}`}
              onClick={() => onToolChange(name)}
              disabled={disabled}
              title={label}
            >
              <Icon size={16} />
              <span className="toolbar-button-text">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Layout Section */}
      <div className="toolbar-section">
        <label className="toolbar-label">Layout</label>
        <div className="toolbar-group">
          {layouts.map((layout) => (
            <button
              key={layout}
              className={`toolbar-button ${layoutType === layout ? 'active' : ''}`}
              onClick={() => onLayoutChange(layout)}
              disabled={disabled}
              title={`${layout} Layout`}
            >
              <Grid size={16} />
              <span className="toolbar-button-text">{layout}</span>
            </button>
          ))}
        </div>
      </div>

      {/* View Section */}
      <div className="toolbar-section">
        <label className="toolbar-label">View</label>
        <div className="toolbar-group">
          <button
            className="toolbar-button"
            disabled={disabled}
            title="Reset View"
          >
            <Layers size={16} />
            <span className="toolbar-button-text">Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}