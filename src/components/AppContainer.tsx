/**
 * App Container Component
 * Pure component that handles file input and mode-based viewer rendering
 * Built with shadcn/ui components
 */

import React from 'react';
import { UnifiedViewer, AnalysisViewer } from './viewers';
import IntegratedSystemTest from './IntegratedSystemTest';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { cn } from '../lib/utils';

interface AppContainerProps {
  // Current mode
  currentMode: string;
  setCurrentMode: (mode: string) => void;

  // Data
  seriesData: any[];
  selectedSeries: number;
  activeTool: string;

  // Refs
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  dicomViewerRef: React.RefObject<any>;

  // Handlers
  handleFileLoad: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleLoadFilesClick: () => void;
  handleSeriesSelect: (index: number) => void;
  handleSeriesDelete: (index: number, event: React.MouseEvent) => void;
  handleToolSelect: (tool: string) => void;
}

export const AppContainer: React.FC<AppContainerProps> = ({
  currentMode,
  setCurrentMode,
  seriesData,
  selectedSeries,
  activeTool,
  fileInputRef,
  dicomViewerRef,
  handleFileLoad,
  handleLoadFilesClick,
  handleSeriesSelect,
  handleSeriesDelete,
  handleToolSelect,
}) => {
  return (
    <div className={cn('min-h-screen bg-background')}>
      {/* Hidden file input - using shadcn/ui screen reader utility */}
      <input
        ref={fileInputRef}
        type='file'
        accept='.dcm,.dicom'
        multiple
        onChange={handleFileLoad}
        className={cn('sr-only')}
      />

      {/* Mode-based viewer rendering */}
      {currentMode === 'viewer' && (
        <UnifiedViewer
          currentMode={currentMode}
          setCurrentMode={setCurrentMode}
          seriesData={seriesData}
          selectedSeries={selectedSeries}
          activeTool={activeTool}
          dicomViewerRef={dicomViewerRef}
          handleLoadFilesClick={handleLoadFilesClick}
          handleToolSelect={handleToolSelect}
          handleSeriesSelect={handleSeriesSelect}
          handleSeriesDelete={handleSeriesDelete}
        />
      )}

      {currentMode === 'analysis' && (
        <AnalysisViewer
          activeTool={activeTool}
          handleToolSelect={handleToolSelect}
          onNavigateToMedicalViewer={() => setCurrentMode('viewer')}
        />
      )}

      {currentMode === 'system-test' && (
        <Card className={cn('mx-auto max-w-7xl m-6')}>
          <CardHeader className={cn('flex flex-row items-center justify-between')}>
            <CardTitle className={cn('text-2xl font-bold')}>System Integration Test</CardTitle>
            <Button onClick={() => setCurrentMode('viewer')} variant='default'>
              Back to Viewer
            </Button>
          </CardHeader>
          <CardContent className={cn('space-y-6')}>
            <IntegratedSystemTest />
          </CardContent>
        </Card>
      )}
    </div>
  );
};
