import { useState, useEffect, useCallback } from "react";
import { useCornerstone } from "./hooks/use-cornerstone";
import {
  useDicomStore,
  selectIsLoading,
  selectError,
  selectActiveTool,
} from "./store/dicom-store";
import { ModernAnnotationManager } from "./utils/annotation-manager";
import { Toolbar } from "./components/Toolbar";
import { Sidebar } from "./components/Sidebar";
import { ViewportContainer } from "./components/ViewportContainer";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Layout, AlertCircle } from "lucide-react";
import type { LayoutType, SeriesInfo } from "./types";
import "./App.css";

const RENDERING_ENGINE_ID = "main-rendering-engine";
const CONTAINER_ID = "dicom-container";

/**
 * Modern React DICOM Viewer Application
 * Converted from class components to functional components with hooks
 * Fixed all TypeScript annotation-related errors
 */
function App() {
  // Local state with hooks instead of class state
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  // Global store state
  const isLoading = useDicomStore(selectIsLoading);
  const error = useDicomStore(selectError);
  const activeTool = useDicomStore(selectActiveTool);
  const {
    setLayout,
    loadSeries,
    setError,
    setLoading,
    layoutType,
    sidebarOpen,
    toggleSidebar,
  } = useDicomStore();

  // Cornerstone3D integration hook
  const {
    renderingEngine,
    isInitialized,
    setLayout: setCornerstoneLayout,
    loadImageIds,
    cleanup,
  } = useCornerstone({
    containerId: CONTAINER_ID,
    renderingEngineId: RENDERING_ENGINE_ID,
  });

  // Annotation manager instance
  const [annotationManager] = useState(() =>
    ModernAnnotationManager.getInstance()
  );

  // Handle layout changes
  const handleLayoutChange = useCallback(
    async (newLayout: LayoutType) => {
      try {
        setLoading(true);
        setLayout(newLayout);
        await setCornerstoneLayout(newLayout);
        console.log(`Layout changed to: ${newLayout}`);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Failed to change layout"
        );
      } finally {
        setLoading(false);
      }
    },
    [setLayout, setCornerstoneLayout, setLoading, setError]
  );

  // Handle file drop for DICOM loading
  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      setDragCounter(0);

      const files = Array.from(e.dataTransfer.files);
      const dicomFiles = files.filter(
        (file) =>
          file.name.toLowerCase().endsWith(".dcm") ||
          file.type === "application/dicom"
      );

      if (dicomFiles.length === 0) {
        setError("No DICOM files found. Please drop .dcm files.");
        return;
      }

      try {
        setLoading(true);
        await loadDicomFiles(dicomFiles);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Failed to load DICOM files"
        );
      } finally {
        setLoading(false);
      }
    },
    [setError, setLoading]
  );

  // Load DICOM files
  const loadDicomFiles = useCallback(
    async (files: File[]) => {
      // Create image IDs from files (mock implementation)
      const imageIds = files.map(
        (file, index) => `wadouri:${file.name}#${index}`
      );

      // Create mock series info - Fix for missing required properties
      const seriesInfo: SeriesInfo = {
        seriesInstanceUID: `series-${Date.now()}`,
        seriesNumber: "1",
        seriesDescription: `Loaded Series (${files.length} images)`,
        modality: "CT",
        imageIds,
        numberOfImages: files.length,
        studyInstanceUID: `study-${Date.now()}`,
        patientInfo: {
          patientName: "Test Patient",
          patientId: "TEST001",
        },
      };

      // Load series into store
      loadSeries(seriesInfo);

      // Load images into viewport
      await loadImageIds(imageIds);

      console.log(`Loaded ${files.length} DICOM files`);
    },
    [loadSeries, loadImageIds]
  );

  // Drag handlers
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragCounter((prev) => prev + 1);
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragCounter((prev) => {
      const newCounter = prev - 1;
      if (newCounter === 0) {
        setIsDragging(false);
      }
      return newCounter;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  // Tool activation handler - Fix for TS2345 type errors
  const handleToolActivation = useCallback(
    (toolName: string) => {
      if (typeof toolName !== "string" || !toolName) {
        console.error("Invalid tool name provided");
        return;
      }

      try {
        // Use store action to set active tool
        useDicomStore.getState().setActiveTool(toolName);

        // Additional tool-specific logic can be added here
        console.log(`Activated tool: ${toolName}`);
      } catch (error) {
        setError(`Failed to activate tool: ${toolName}`);
      }
    },
    [setError]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "1":
            e.preventDefault();
            handleLayoutChange("1x1");
            break;
          case "2":
            e.preventDefault();
            handleLayoutChange("2x2");
            break;
          case "b":
            e.preventDefault();
            toggleSidebar();
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [handleLayoutChange, toggleSidebar]);

  // Listen for file upload events from Toolbar
  useEffect(() => {
    const handleFileSelection = (event: CustomEvent) => {
      const files = event.detail as File[];
      loadDicomFiles(files);
    };

    document.addEventListener(
      "dicom-files-selected",
      handleFileSelection as EventListener
    );
    return () => {
      document.removeEventListener(
        "dicom-files-selected",
        handleFileSelection as EventListener
      );
    };
  }, [loadDicomFiles]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return (
    <ErrorBoundary>
      <div className="app">
        {/* Header */}
        <header className="app-header">
          <div className="header-content">
            <div className="header-left">
              <Layout className="header-icon" />
              <h1>Clarity</h1>
              <span className="version">Alpha</span>
            </div>

            <div className="header-right">
              <span className="status">
                {isInitialized ? (
                  <span className="status-ready">Ready</span>
                ) : (
                  <span className="status-loading">Initializing...</span>
                )}
              </span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="app-content">
          {/* Sidebar */}
          <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />

          {/* Main Viewer Area */}
          <main className={`main-content ${sidebarOpen ? "with-sidebar" : ""}`}>
            {/* Toolbar */}
            <Toolbar
              activeTool={activeTool}
              onToolChange={handleToolActivation}
              layoutType={layoutType}
              onLayoutChange={handleLayoutChange}
              disabled={!isInitialized || isLoading}
            />

            {/* Error Display */}
            {error && (
              <div className="error-banner">
                <AlertCircle className="error-icon" />
                <span>{error}</span>
                <button onClick={() => setError(null)} className="error-close">
                  ×
                </button>
              </div>
            )}

            {/* Loading Overlay */}
            {isLoading && <LoadingSpinner />}

            {/* Viewport Container */}
            <div
              id={CONTAINER_ID}
              className={`viewport-container ${isDragging ? "dragging" : ""}`}
              onDrop={handleDrop}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
            >
              <ViewportContainer
                renderingEngine={renderingEngine}
                layoutType={layoutType}
                annotationManager={annotationManager}
              />

              {/* Drop Zone Overlay */}
              {isDragging && (
                <div className="drop-overlay">
                  <div className="drop-message">
                    <Layout className="drop-icon" />
                    <p>Drop DICOM files here</p>
                    <small>Supports .dcm files</small>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!isLoading && !error && isInitialized && (
                <div className="empty-state">
                  <Layout className="empty-icon" />
                  <h3>No DICOM Images Loaded</h3>
                  <p>Drag and drop DICOM files here to get started</p>
                  <small>Supported formats: .dcm</small>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;
