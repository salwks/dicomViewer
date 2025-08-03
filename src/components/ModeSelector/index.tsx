/**
 * Mode Selector Component
 * Clear navigation between different viewer modes
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

export type ViewerMode = 'viewer' | 'analysis' | 'system-test';

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
    title: 'Medical Viewer',
    description: 'Professional DICOM viewing with advanced tools',
    icon: '🏥',
    features: [
      'Single & multi-viewport display',
      'Synchronized navigation',
      'Zoom, pan, window/level',
      'Basic measurements',
      'Timeline analysis',
    ],
  },
  {
    id: 'analysis',
    title: 'Advanced Analysis',
    description: 'Quantitative analysis and 3D visualization',
    icon: '🔬',
    features: ['3D reconstruction', 'Volume measurements', 'Segmentation tools', 'Report generation'],
  },
  {
    id: 'system-test',
    title: 'System Integration Test',
    description: 'Test all major systems and integrations',
    icon: '🧪',
    features: [
      'Annotation selection testing',
      'Highlight state management',
      'Performance monitoring',
      'Synchronization optimization',
      'System integration validation',
    ],
  },
];

export const ModeSelector: React.FC<ModeSelectorProps> = ({ currentMode, onModeChange, hasImages = false }) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Select Viewing Mode</h3>
        <p className="text-sm text-muted-foreground">Choose the appropriate mode for your medical imaging workflow</p>
      </div>

      <div className="grid gap-4">
        {MODES.map(mode => {
          const isDisabled = !hasImages && mode.id !== 'viewer';
          const isActive = currentMode === mode.id;

          return (
            <Card
              key={mode.id}
              className={cn(
                'cursor-pointer transition-all duration-200 hover:shadow-md',
                isActive && 'ring-2 ring-primary border-primary',
                isDisabled && 'opacity-50 cursor-not-allowed',
              )}
              onClick={() => {
                if (!isDisabled) {
                  onModeChange(mode.id);
                }
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{mode.icon}</div>
                  <div className="flex-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {mode.title}
                      {isActive && <Badge variant="secondary" className="text-xs">Active</Badge>}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0 space-y-3">
                <p className="text-sm text-muted-foreground">{mode.description}</p>

                <ul className="space-y-1">
                  {mode.features.map((feature, index) => (
                    <li key={index} className="text-xs text-muted-foreground flex items-center gap-2">
                      <div className="w-1 h-1 bg-muted-foreground rounded-full" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {isDisabled && (
                  <Badge variant="outline" className="text-xs">
                    Load images first
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!hasImages && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="text-primary text-lg">ℹ️</div>
              <div className="space-y-1">
                <h4 className="font-medium text-primary">Load DICOM Images First</h4>
                <p className="text-sm text-primary/80">Upload your medical images to access analysis mode</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
