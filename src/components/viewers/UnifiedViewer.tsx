/**
 * Unified Medical Viewer Component
 * Professional DICOM viewing with clean interface
 */

import React, { useState, useCallback } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

import { ModeSelector } from '../ModeSelector';
import { SeriesBrowser } from '../SeriesBrowser';
import { ToolPanel } from '../ToolPanel';
import { DicomViewer } from '../DicomViewer';
import { DragDropProvider } from '../DragDropSystem';

interface UnifiedViewerProps {
  // Mode management
  currentMode: string;
  setCurrentMode: (mode: string) => void;

  // Data
  seriesData: any[];
  selectedSeries: number;

  // Tools
  activeTool: string;

  // Refs
  dicomViewerRef: React.RefObject<any>;

  // Handlers
  handleLoadFilesClick: () => void;
  handleToolSelect: (tool: string) => void;
  handleSeriesSelect: (index: number) => void;
  handleSeriesDelete: (index: number, event: React.MouseEvent) => void;
}

export const UnifiedViewer: React.FC<UnifiedViewerProps> = ({
  currentMode,
  setCurrentMode,
  seriesData,
  selectedSeries,
  activeTool,
  dicomViewerRef,
  handleLoadFilesClick,
  handleToolSelect,
  handleSeriesSelect,
  handleSeriesDelete,
}) => {
  const [activeTab, setActiveTab] = useState('viewer');

  const handleSeriesAssign = useCallback((seriesUID: string, _viewportId: string) => {
    // Find the series index in seriesData
    const seriesIndex = seriesData.findIndex(series =>
      series.seriesInstanceUID === seriesUID,
    );

    if (seriesIndex !== -1) {
      handleSeriesSelect(seriesIndex);
    }
  }, [seriesData, handleSeriesSelect]);

  // Safe series data access helper
  const getSelectedSeriesUID = useCallback(() => {
    if (seriesData.length === 0 || selectedSeries < 0 || selectedSeries >= seriesData.length) {
      return undefined;
    }
    return seriesData[selectedSeries]?.seriesInstanceUID;
  }, [seriesData, selectedSeries]);

  return (
    <DragDropProvider onSeriesAssign={handleSeriesAssign}>
      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        <div className="w-80 bg-card border-r border-border flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="p-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="viewer">Viewer</TabsTrigger>
                <TabsTrigger value="studies">Studies</TabsTrigger>
                <TabsTrigger value="tools">Tools</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-hidden">
              <TabsContent value="viewer" className="h-full m-0">
                <div className="space-y-4">
                  {/* Mode Selector */}
                  <div>
                    <h3 className="text-sm font-medium text-foreground mb-2">Viewing Mode</h3>
                    <ModeSelector
                      currentMode={currentMode as any}
                      onModeChange={setCurrentMode}
                      hasImages={seriesData.length > 0}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="studies" className="h-full m-0">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium text-foreground">Studies</h3>
                    <Badge variant="secondary">{seriesData.length} loaded</Badge>
                  </div>

                  {seriesData.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-muted-foreground mb-4 text-4xl">📁</div>
                      <p className="text-sm text-muted-foreground mb-4">No studies loaded</p>
                      <Button onClick={handleLoadFilesClick} size="sm">
                      Load DICOM Files
                      </Button>
                    </div>
                  ) : (
                    <SeriesBrowser
                      seriesData={seriesData}
                      selectedSeries={selectedSeries}
                      onSeriesSelect={handleSeriesSelect}
                      onSeriesDelete={handleSeriesDelete}
                      isComparisonMode={false}
                    />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="tools" className="h-full m-0">
                <ToolPanel
                  activeTool={activeTool as any}
                  onToolSelect={handleToolSelect}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Main Viewer Area */}
        <div className="flex-1 flex flex-col">
          {/* Top Bar */}
          <div className="bg-card border-b border-border px-6 py-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <h1 className="text-lg font-semibold text-foreground">Medical Viewer</h1>
                <Badge variant="outline">Single View</Badge>
              </div>

              {seriesData.length === 0 && (
                <Button onClick={handleLoadFilesClick}>
                Load DICOM Files
                </Button>
              )}
            </div>
          </div>

          {/* Viewer Content */}
          <div className="flex-1 bg-muted/20 relative">
            {/* Empty State Overlay - only shown when no data, doesn't destroy DicomViewer */}
            {seriesData.length === 0 && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
                <div className="text-center">
                  <div className="text-6xl mb-4">🏥</div>
                  <h2 className="text-xl font-semibold mb-2 text-foreground">Medical Image Viewer</h2>
                  <p className="text-muted-foreground mb-6">Load DICOM files to start viewing and analyzing medical images</p>
                  <Button onClick={handleLoadFilesClick} size="lg">
                    Load DICOM Files
                  </Button>
                </div>
              </div>
            )}

            {/* CRITICAL: DicomViewer always exists, never destroyed by conditional rendering */}
            <div
              className="h-full"
              style={{
                visibility: seriesData.length === 0 ? 'hidden' : 'visible',
              }}
            >
              <DicomViewer
                key="stable-dicom-viewer" // CRITICAL: Stable key prevents remount
                ref={dicomViewerRef}
                seriesInstanceUID={getSelectedSeriesUID()}
              />
            </div>
          </div>
        </div>
      </div>
    </DragDropProvider>
  );
};
