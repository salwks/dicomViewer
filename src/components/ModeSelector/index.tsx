/**
 * Mode Selector Component
 * Clear navigation between different viewer modes
 */

import React from 'react';
import './styles.css';

export type ViewerMode = 'viewer' | 'comparison' | 'analysis';

interface ModeSelectorProps {
  currentMode: ViewerMode;
  onModeChange: (mode: ViewerMode) => void;
  hasImages?: boolean;
}

interface ModeInfo {
  id: ViewerMode;
  title: string;
  description: string;
  icon: string;
  features: string[];
  disabled?: boolean;
}

const MODES: ModeInfo[] = [
  {
    id: 'viewer',
    title: 'Basic Viewer',
    description: 'View and navigate single patient images',
    icon: '🖼️',
    features: [
      'Single image viewing',
      'Zoom, pan, window/level',
      'Basic measurements',
      'Image navigation',
    ],
  },
  {
    id: 'comparison',
    title: 'Comparison',
    description: 'Compare multiple images side by side',
    icon: '⚖️',
    features: [
      'Multi-viewport display',
      'Synchronized navigation',
      'Before/after comparison',
      'Timeline analysis',
    ],
  },
  {
    id: 'analysis',
    title: 'Advanced Analysis',
    description: 'Quantitative analysis and 3D visualization',
    icon: '🔬',
    features: [
      '3D reconstruction',
      'Volume measurements',
      'Segmentation tools',
      'Report generation',
    ],
  },
];

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  currentMode,
  onModeChange,
  hasImages = false,
}) => {
  return (
    <div className="mode-selector">
      <div className="mode-selector__header">
        <h3>Select Viewing Mode</h3>
        <p>Choose the appropriate mode for your medical imaging workflow</p>
      </div>

      <div className="mode-selector__grid">
        {MODES.map((mode) => (
          <div
            key={mode.id}
            className={`mode-card ${
              currentMode === mode.id ? 'mode-card--active' : ''
            } ${!hasImages && mode.id !== 'viewer' ? 'mode-card--disabled' : ''}`}
            onClick={() => {
              if (hasImages || mode.id === 'viewer') {
                onModeChange(mode.id);
              }
            }}
          >
            <div className="mode-card__header">
              <div className="mode-card__icon">{mode.icon}</div>
              <h4 className="mode-card__title">{mode.title}</h4>
            </div>

            <p className="mode-card__description">{mode.description}</p>

            <ul className="mode-card__features">
              {mode.features.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>

            {!hasImages && mode.id !== 'viewer' && (
              <div className="mode-card__overlay">
                <span>Load images first</span>
              </div>
            )}

            {currentMode === mode.id && (
              <div className="mode-card__active-indicator">
                ✓ Active Mode
              </div>
            )}
          </div>
        ))}
      </div>

      {!hasImages && (
        <div className="mode-selector__notice">
          <div className="notice-content">
            <div className="notice-icon">ℹ️</div>
            <div>
              <h4>Load DICOM Images First</h4>
              <p>Upload your medical images to access comparison and analysis modes</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

