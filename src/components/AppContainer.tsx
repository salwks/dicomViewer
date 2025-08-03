/**
 * App Container Component
 * Pure component that handles file input and mode-based viewer rendering
 */

import React from 'react';
import { UnifiedViewer, AnalysisViewer } from './viewers';
import IntegratedSystemTest from './IntegratedSystemTest';

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
    <div>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type='file'
        accept='.dcm,.dicom'
        multiple
        onChange={handleFileLoad}
        className="sr-only"
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
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">System Integration Test</h1>
            <button 
              onClick={() => setCurrentMode('viewer')}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Back to Viewer
            </button>
          </div>
          <IntegratedSystemTest />
        </div>
      )}
    </div>
  );
};
