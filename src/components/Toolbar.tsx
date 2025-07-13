import { 
  Upload,
  MousePointer, 
  Move, 
  ZoomIn, 
  Palette,
  Ruler,
  Triangle,
  Square,
  Circle,
  ArrowRight,
  Grid,
  Layers,
  Terminal
} from 'lucide-react';
import type { LayoutType } from '../types';

interface ToolbarProps {
  activeTool: string | null;
  onToolChange: (toolName: string) => void;
  layoutType: LayoutType;
  onLayoutChange: (layout: LayoutType) => void;
  disabled?: boolean;
}

// 기본 조작 도구
const basicTools = [
  { name: 'WindowLevel', icon: Palette, label: 'Window/Level', category: 'basic' },
  { name: 'Pan', icon: Move, label: 'Pan', category: 'basic' },
  { name: 'Zoom', icon: ZoomIn, label: 'Zoom', category: 'basic' },
];

// 주석 도구 (Cornerstone3D의 실제 도구명 사용)
const annotationTools = [
  { name: 'Length', icon: Ruler, label: '길이 측정', category: 'annotation' },
  { name: 'RectangleROI', icon: Square, label: '사각형 ROI', category: 'annotation' },
  { name: 'EllipticalROI', icon: Circle, label: '타원형 ROI', category: 'annotation' },
  { name: 'ArrowAnnotate', icon: ArrowRight, label: '화살표 주석', category: 'annotation' },
];

const allTools = [...basicTools, ...annotationTools];

const layouts: LayoutType[] = ['1x1', '1x2', '2x1', '2x2'];

export function Toolbar({ 
  activeTool, 
  onToolChange, 
  layoutType, 
  onLayoutChange, 
  disabled = false 
}: ToolbarProps) {
  
  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.dcm,application/dicom';
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) {
        // Trigger file processing - this will be handled by the App component
        const event = new CustomEvent('dicom-files-selected', { detail: files });
        document.dispatchEvent(event);
      }
    };
    input.click();
  };
  return (
    <div className="toolbar">
      {/* File Section */}
      <div className="toolbar-section">
        <label className="toolbar-label">File</label>
        <div className="toolbar-group">
          <button
            className="toolbar-button"
            onClick={handleFileUpload}
            disabled={disabled}
            title="Upload DICOM Files"
          >
            <Upload size={16} />
            <span className="toolbar-button-text">파일 불러오기</span>
          </button>
        </div>
      </div>

      {/* 기본 도구 섹션 */}
      <div className="toolbar-section">
        <label className="toolbar-label">기본 도구</label>
        <div className="toolbar-group">
          {basicTools.map(({ name, icon: Icon, label }) => (
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

      {/* 주석 도구 섹션 */}
      <div className="toolbar-section">
        <label className="toolbar-label">주석 도구</label>
        <div className="toolbar-group">
          {annotationTools.map(({ name, icon: Icon, label }) => (
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