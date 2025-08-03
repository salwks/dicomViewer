/**
 * App Controller Hook
 * Orchestrates all application functionality and provides a unified interface
 */

import { useAppState } from './useAppState';
import { useCornerstone } from './useCornerstone';
import { useSynchronization } from './useSynchronization';
import { useFileManagement } from './useFileManagement';
import { useToolManagement } from './useToolManagement';

export const useAppController = () => {
  // Initialize all state and refs
  const appState = useAppState();
  const {
    currentMode,
    setCurrentMode,
    selectedSeries,
    setSelectedSeries,
    comparisonStudyA,
    setComparisonStudyA,
    comparisonStudyB,
    setComparisonStudyB,
    setIsLoading,
    syncScroll,
    setSyncScroll,
    syncZoom,
    setSyncZoom,
    syncWindowLevel,
    setSyncWindowLevel,
    syncTools,
    setSyncTools,
    synchronizerRef,
    seriesData,
    setSeriesData,
    activeTool,
    setActiveTool,
    comparisonToolA,
    setComparisonToolA,
    comparisonToolB,
    setComparisonToolB,
    fileInputRef,
    dicomViewerRef,
    comparisonViewerARef,
    comparisonViewerBRef,
  } = appState;

  // Initialize Cornerstone3D
  useCornerstone();

  // File management functionality
  const fileManagement = useFileManagement({
    fileInputRef,
    setIsLoading,
    setSeriesData,
    seriesData,
    selectedSeries,
    setSelectedSeries,
  });

  // Synchronization functionality
  const synchronization = useSynchronization({
    currentMode,
    comparisonStudyA,
    comparisonStudyB,
    syncScroll,
    syncZoom,
    syncWindowLevel,
    syncTools,
    setSyncScroll,
    setSyncZoom,
    setSyncWindowLevel,
    setSyncTools,
    synchronizerRef,
  });

  // Tool management functionality
  const toolManagement = useToolManagement({
    currentMode,
    activeTool,
    setActiveTool,
    comparisonToolA,
    setComparisonToolA,
    comparisonToolB,
    setComparisonToolB,
    syncTools,
    dicomViewerRef,
    comparisonViewerARef,
    comparisonViewerBRef,
  });

  return {
    // State
    currentMode,
    setCurrentMode,
    selectedSeries,
    seriesData,
    comparisonStudyA,
    comparisonStudyB,
    setComparisonStudyA,
    setComparisonStudyB,
    activeTool,
    comparisonToolA,
    comparisonToolB,
    syncScroll,
    syncZoom,
    syncWindowLevel,
    syncTools,

    // Refs
    fileInputRef,
    dicomViewerRef,
    comparisonViewerARef,
    comparisonViewerBRef,

    // Handlers
    handleFileLoad: fileManagement.handleFileLoad,
    handleLoadFilesClick: fileManagement.handleLoadFilesClick,
    handleSeriesSelect: fileManagement.handleSeriesSelect,
    handleSeriesDelete: fileManagement.handleSeriesDelete,
    handleSyncScrollToggle: synchronization.handleSyncScrollToggle,
    handleSyncZoomToggle: synchronization.handleSyncZoomToggle,
    handleSyncWindowLevelToggle: synchronization.handleSyncWindowLevelToggle,
    handleSyncToolsToggle: synchronization.handleSyncToolsToggle,
    handleToolSelect: toolManagement.handleToolSelect,
    handleToolSelectA: toolManagement.handleToolSelectA,
    handleToolSelectB: toolManagement.handleToolSelectB,
  };
};
