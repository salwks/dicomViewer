/**
 * Cross-Reference Lines Demo Component
 * Demonstrates the integration of cross-reference lines with ViewportGrid
 */

import React, { useState } from 'react';
import { ViewportGrid, ViewportLayout, ViewportState } from '../ViewportGrid';
import { SynchronizationControls, SynchronizationSettings } from '../SynchronizationControls';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { cn } from '../../lib/utils';

// Sample series data for demo
const DEMO_SERIES_DATA = [
  {
    seriesInstanceUID: 'series-1',
    modality: 'CT',
    numberOfImages: 100,
    description: 'Chest CT',
  },
  {
    seriesInstanceUID: 'series-2',
    modality: 'MR',
    numberOfImages: 50,
    description: 'Brain MRI',
  },
];

export const CrossReferenceDemo: React.FC = () => {
  const [layout] = useState<ViewportLayout>('2x2');
  const [syncSettings, setSyncSettings] = useState<SynchronizationSettings>({
    enableZoom: true,
    enablePan: true,
    enableScroll: true,
    enableWindowLevel: true,
    enableReferenceLines: true,
    enableSliceSync: true,
    enableAnatomicalMapping: false,
  });

  const [viewports, setViewports] = useState<ViewportState[]>([
    { id: 'A', seriesIndex: 0, isActive: true, activeTool: 'Pan' },
    { id: 'B', seriesIndex: 1, isActive: false, activeTool: 'Pan' },
    { id: 'C', seriesIndex: 0, isActive: false, activeTool: 'Pan' },
    { id: 'D', seriesIndex: 1, isActive: false, activeTool: 'Pan' },
  ]);

  const handleViewportActivated = (id: string): void => {
    setViewports(prev => prev.map(vp => ({
      ...vp,
      isActive: vp.id === id,
    })));
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Cross-Reference Lines Demo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Synchronization Controls */}
            <SynchronizationControls
              settings={syncSettings}
              onSettingsChange={setSyncSettings}
              compact={false}
            />

            {/* Viewport Grid with Cross-Reference Lines */}
            <div className="h-[600px]">
              <ViewportGrid
                layout={layout}
                viewports={viewports}
                seriesData={DEMO_SERIES_DATA}
                onViewportActivated={handleViewportActivated}
                showCrossReferenceLines={syncSettings.enableReferenceLines}
                crossReferenceOpacity={0.8}
                className="h-full"
              />
            </div>

            {/* Demo Instructions */}
            <Card className={cn('bg-muted/30')}>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-2">Cross-Reference Lines Features:</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Toggle reference lines using the "Reference" control above</li>
                  <li>• Click on different viewports to see cross-reference lines update</li>
                  <li>• Lines show anatomical correspondence between viewports</li>
                  <li>• Different colors indicate different viewport relationships</li>
                  <li>• Dashed lines with center intersection points</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
