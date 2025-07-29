import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as cornerstoneCore from '@cornerstonejs/core';
// Use regular version with web workers enabled
import * as cornerstoneWADOImageLoader from '@cornerstonejs/dicom-image-loader';
import * as cornerstoneTools from '@cornerstonejs/tools';
import * as dicomParser from 'dicom-parser';
import { log } from './utils/logger';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeToggle } from './components/ThemeToggle';
import { ViewerLayout } from './components/ViewerLayout';
import { SeriesBrowser } from './components/SeriesBrowser';
import { ToolPanel } from './components/ToolPanel';
import { StudyComparison } from './components/StudyComparison';
import { DicomViewer } from './components/DicomViewer';
import { ModeSelector, type ViewerMode } from './components/ModeSelector';
import { ToolType } from './components/ToolPanel/constants';
import { simpleDicomLoader } from './services/simpleDicomLoader';
import './styles/global.css';

// Security validation functions - Web Workers disabled for stability


const App: React.FC = () => {
  // Test logging immediately when component renders
  log.info('🏥 App component rendered - Medical imaging system active', {
    component: 'App',
    operation: 'render',
    timestamp: new Date().toISOString(),
  });

  log.debug('🔍 Debug test - you should see this in console!', {
    component: 'App',
    operation: 'debugTest',
  });

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<string>('');
  const [currentMode, setCurrentMode] = useState<ViewerMode>('viewer');
  const [showModeSelector, setShowModeSelector] = useState(true);
  const [seriesData, setSeriesData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.WINDOW_LEVEL);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file uploads with improved error handling
  const handleFilesLoaded = useCallback(async (files: File[]) => {
    if (isLoading) {
      log.warn('File upload already in progress, ignoring new request', {
        component: 'App',
        operation: 'handleFilesLoaded',
      });
      return;
    }

    setIsLoading(true);
    setLoadingError(null);
    setUploadedFiles(files);

    log.info('Starting file upload process', {
      component: 'App',
      operation: 'handleFilesLoaded',
      fileCount: files.length,
    });

    if (files.length > 0) {

      try {
        // Add timeout to prevent infinite loading
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('File loading timeout after 10 seconds')), 10000),
        );

        log.info('Starting DICOM file loading with timeout', {
          component: 'App',
          operation: 'loadFiles',
        });

        // Load DICOM files using simple loader with timeout
        await Promise.race([
          simpleDicomLoader.loadFiles(files),
          timeoutPromise,
        ]);

        // Get the series list for display (now async)
        const seriesList = await simpleDicomLoader.getSeriesData();
        setSeriesData(seriesList);

        log.info('Files uploaded and processed successfully', {
          component: 'App',
          metadata: {
            fileCount: files.length,
            seriesCount: seriesList.length,
          },
        });

        // If we have series, select the first one
        if (seriesList.length > 0) {
          setSelectedSeries(seriesList[0].seriesInstanceUID);
          log.info('Series auto-selected', {
            component: 'App',
            metadata: {
              selectedSeries: seriesList[0].seriesInstanceUID,
              seriesData: seriesList[0],
            },
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        setLoadingError(errorMessage);
        log.error('Failed to load DICOM files', {
          component: 'App',
          metadata: { fileCount: files.length, errorMessage },
        }, error as Error);
      } finally {
        // Always clear loading state
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [isLoading]);

  // Handle file input selection
  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleFilesLoaded(Array.from(files));
    }
    // Reset input to allow selecting the same file again
    event.target.value = '';
  }, [handleFilesLoaded]);

  // Handle drag and drop
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the main container
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      // Filter for DICOM files (optional - can be removed to allow all files)
      const dicomFiles = files.filter(file =>
        file.name.toLowerCase().endsWith('.dcm') ||
        file.name.toLowerCase().endsWith('.dicom') ||
        file.type === 'application/dicom' ||
        file.type === '',  // Many DICOM files have no MIME type
      );

      if (dicomFiles.length > 0) {
        handleFilesLoaded(dicomFiles);
      } else {
        // Try all files if no obvious DICOM files found
        handleFilesLoaded(files);
      }
    }
  }, [handleFilesLoaded]);

  // Series selection handlers
  const handleSeriesSelect = (seriesInstanceUID: string) => {
    setSelectedSeries(seriesInstanceUID);
    log.info('Series selected', {
      component: 'App',
      metadata: { seriesInstanceUID },
    });
  };

  const handleSeriesLoad = (seriesInstanceUID: string) => {
    log.info('Loading series in viewer', {
      component: 'App',
      metadata: { seriesInstanceUID },
    });
    // TODO: Implement actual DICOM loading logic
  };

  // Study comparison handlers
  const handleStudyComparisonSelect = (studyInstanceUID: string, position: number) => {
    log.info('Study selected for comparison', {
      component: 'App',
      metadata: { studyInstanceUID, position },
    });
  };

  const handleStudyComparisonLoad = (studyInstanceUID: string, position: number) => {
    log.info('Loading study in comparison viewer', {
      component: 'App',
      metadata: { studyInstanceUID, position },
    });
  };

  const handleModeChange = (mode: ViewerMode) => {
    setCurrentMode(mode);
    setShowModeSelector(false);
    log.info('Viewer mode changed', {
      component: 'App',
      metadata: { mode },
    });
  };

  // Tool selection handler
  const handleToolSelect = (tool: ToolType) => {
    setActiveTool(tool);
    log.info('Tool selected', {
      component: 'App',
      metadata: { tool },
    });
  };

  // Static sample series data for demonstration
  const sampleSeries = [
    {
      seriesInstanceUID: '1.2.840.113619.2.55.3.2831868886.983.1',
      seriesNumber: 1,
      seriesDescription: 'CT Head Axial',
      modality: 'CT',
      numberOfImages: 120,
      studyInstanceUID: '1.2.840.113619.2.55.3.2831868886.983',
      studyDescription: 'CT Head Study',
      patientName: 'Anonymous Patient',
      studyDate: '2024-01-15',
    },
    {
      seriesInstanceUID: '1.2.840.113619.2.55.3.2831868886.983.2',
      seriesNumber: 2,
      seriesDescription: 'CT Head Coronal',
      modality: 'CT',
      numberOfImages: 96,
      studyInstanceUID: '1.2.840.113619.2.55.3.2831868886.983',
      studyDescription: 'CT Head Study',
      patientName: 'Anonymous Patient',
      studyDate: '2024-01-15',
    },
  ];

  // Sample DICOM studies data for comparison mode
  const sampleStudies = [
    {
      studyInstanceUID: '1.2.840.113619.2.55.3.2831868886.983',
      studyDescription: 'CT Head Study',
      studyDate: '2024-01-15',
      patientName: 'Anonymous Patient A',
      patientID: 'PT001',
      modality: 'CT',
      seriesCount: 2,
      accessionNumber: 'ACC001',
      institution: 'General Hospital',
    },
    {
      studyInstanceUID: '1.2.840.113619.2.55.3.2831868886.984',
      studyDescription: 'MR Brain Study',
      studyDate: '2024-01-16',
      patientName: 'Anonymous Patient A',
      patientID: 'PT001',
      modality: 'MR',
      seriesCount: 1,
      accessionNumber: 'ACC002',
      institution: 'General Hospital',
    },
    {
      studyInstanceUID: '1.2.840.113619.2.55.3.2831868886.985',
      studyDescription: 'Abdominal Ultrasound',
      studyDate: '2024-01-17',
      patientName: 'Anonymous Patient B',
      patientID: 'PT002',
      modality: 'US',
      seriesCount: 1,
      accessionNumber: 'ACC003',
      institution: 'Regional Medical Center',
    },
    {
      studyInstanceUID: '1.2.840.113619.2.55.3.2831868886.986',
      studyDescription: 'Chest X-Ray',
      studyDate: '2024-01-18',
      patientName: 'Anonymous Patient C',
      patientID: 'PT003',
      modality: 'CR',
      seriesCount: 2,
      accessionNumber: 'ACC004',
      institution: 'Emergency Department',
    },
    {
      studyInstanceUID: '1.2.840.113619.2.55.3.2831868886.987',
      studyDescription: 'PET/CT Whole Body',
      studyDate: '2024-01-19',
      patientName: 'Anonymous Patient D',
      patientID: 'PT004',
      modality: 'PT',
      seriesCount: 3,
      accessionNumber: 'ACC005',
      institution: 'Nuclear Medicine',
    },
  ];


  useEffect(() => {
    initializeCornerstone();
  }, []);

  const initializeCornerstone = async () => {
    try {
      // Initialize libraries following Context7 documentation pattern
      // Reference: /cornerstonejs/cornerstone3d - 443 code examples
      await cornerstoneCore.init();

      // Initialize DICOM image loader
      // Set up the cornerstone WADO Image Loader
      cornerstoneWADOImageLoader.external.cornerstone = cornerstoneCore;
      cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

      // Configure DICOM loader with web workers enabled
      const config = {
        maxWebWorkers: Math.min(navigator.hardwareConcurrency || 2, 2), // Reduce workers to prevent issues
        startWebWorkersOnDemand: true,
        taskConfiguration: {
          decodeTask: {
            initializeCodecsOnStartup: false, // Prevent early initialization
            strict: false,
          },
          sleepTask: {
            sleepTime: 1000, // Reduce sleep time
          },
        },
        // Disable source maps for workers
        useWASM: false,
      };

      // Initialize with web workers
      cornerstoneWADOImageLoader.webWorkerManager.initialize(config);

      log.info('Cornerstone DICOM ImageLoader configured with web workers', {
        component: 'App',
        operation: 'initialization',
        metadata: { maxWebWorkers: config.maxWebWorkers },
      });

      // Initialize cornerstone tools
      await cornerstoneTools.init();

      log.info('Cornerstone3D initialized successfully', {
        component: 'App',
        operation: 'initialization',
      });
      log.debug('Using Context7 documented initialization pattern', {
        component: 'App',
      });
      log.info('DICOM loader configured with web workers enabled', {
        component: 'App',
        metadata: { webWorkersEnabled: true, maxWebWorkers: config.maxWebWorkers },
      });
    } catch (error) {
      log.error('Failed to initialize Cornerstone3D', {
        component: 'App',
        operation: 'initialization',
      }, error as Error);
    }
  };

  return (
    <ErrorBoundary>
      <div className="app">
        <header className="app-header">
          <div className="header-content">
            <div className="header-title">
              <h1>Claarity</h1>
            </div>
            <div className="header-actions">
              <button
                onClick={handleFileSelect}
                style={{
                  background: 'var(--color-primary-main)',
                  color: 'var(--color-primary-contrast)',
                  border: 'none',
                  borderRadius: 'var(--radius-base)',
                  padding: '0.4rem 0.8rem',
                  marginRight: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                  📁 Load Files
              </button>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".dcm,.dicom,application/dicom"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />

              {!showModeSelector && (
                <>
                  <button
                    onClick={() => setShowModeSelector(true)}
                    style={{
                      background: 'transparent',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-divider)',
                      borderRadius: 'var(--radius-base)',
                      padding: '0.4rem 0.8rem',
                      marginRight: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                    }}
                  >
                      🔄 Change Mode
                  </button>
                  <span style={{
                    fontSize: '0.875rem',
                    color: 'var(--color-text-secondary)',
                    marginRight: '0.5rem',
                  }}>
                    {currentMode === 'viewer' ? 'Basic Viewer' :
                      currentMode === 'comparison' ? 'Comparison' : 'Analysis'}
                  </span>
                </>
              )}
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main
          className={`app-main ${isDragOver ? 'drag-over' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Drag and Drop Overlay */}
          {isDragOver && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(33, 150, 243, 0.1)',
              border: '3px dashed var(--color-primary-main)',
              borderRadius: '8px',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{
                textAlign: 'center',
                color: 'var(--color-primary-main)',
                fontSize: '1.5rem',
                fontWeight: '600',
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📁</div>
                <div>Drop DICOM files here</div>
                <div style={{ fontSize: '1rem', opacity: 0.7, marginTop: '0.5rem' }}>
                  Supports .dcm, .dicom files
                </div>
              </div>
            </div>
          )}

          {/* Mode Selector */}
          {showModeSelector && (
            <ModeSelector
              currentMode={currentMode}
              onModeChange={handleModeChange}
              hasImages={uploadedFiles.length > 0}
            />
          )}

          {/* Main Viewer Content */}
          {!showModeSelector && currentMode === 'viewer' && (
            <ViewerLayout
              toolPanel={
                <ToolPanel
                  activeTool={activeTool}
                  onToolSelect={handleToolSelect}
                />
              }
              sidePanel={
                <SeriesBrowser
                  series={uploadedFiles.length > 0 ? seriesData : sampleSeries}
                  selectedSeries={selectedSeries}
                  onSeriesSelect={handleSeriesSelect}
                  onSeriesLoad={handleSeriesLoad}
                />
              }
            >
              {/* Main viewer area */}
              {isLoading ? (
              // Show loading state
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  gap: '2rem',
                }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    border: '4px solid var(--color-primary-main)',
                    borderTop: '4px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }} />
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                        🏥 Loading DICOM Files
                    </h3>
                    <p style={{ color: 'var(--color-text-secondary)' }}>
                        Processing {uploadedFiles.length} files...
                    </p>
                  </div>
                </div>
              ) : loadingError ? (
              // Show error state
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  gap: '2rem',
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ color: 'var(--color-error)', marginBottom: '1rem' }}>
                        ❌ Loading Failed
                    </h3>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
                      {loadingError}
                    </p>
                    <button
                      onClick={() => {
                        setLoadingError(null);
                        handleFileSelect();
                      }}
                      style={{
                        background: 'var(--color-primary-main)',
                        color: 'var(--color-primary-contrast)',
                        border: 'none',
                        borderRadius: 'var(--radius-base)',
                        padding: '0.75rem 1.5rem',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                        Try Again
                    </button>
                  </div>
                </div>
              ) : uploadedFiles.length === 0 && !selectedSeries ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  gap: '2rem',
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ color: 'var(--color-text-primary)', marginBottom: '1rem' }}>
                        Welcome to DICOM Viewer
                    </h3>
                    <p style={{ color: 'var(--color-text-secondary)' }}>
                        Click "Load Files" button above to start viewing medical images
                    </p>
                  </div>
                  <button
                    onClick={handleFileSelect}
                    style={{
                      background: 'var(--color-primary-main)',
                      color: 'var(--color-primary-contrast)',
                      border: 'none',
                      borderRadius: 'var(--radius-base)',
                      padding: '1rem 2rem',
                      fontSize: '1.125rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                      📁 Load DICOM Files
                  </button>
                </div>
              ) : (
              // Display DICOM viewer when series is selected
                <DicomViewer
                  seriesInstanceUID={selectedSeries}
                  activeTool={activeTool}
                />
              )}
            </ViewerLayout>
          )}

          {!showModeSelector && currentMode === 'comparison' && (
            <StudyComparison
              studies={sampleStudies}
              onStudySelect={handleStudyComparisonSelect}
              onStudyLoad={handleStudyComparisonLoad}
              maxComparisons={4}
            />
          )}

          {!showModeSelector && currentMode === 'analysis' && (
            <ViewerLayout
              toolPanel={
                <ToolPanel
                  activeTool={activeTool}
                  onToolSelect={handleToolSelect}
                />
              }
              sidePanel={
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  <h4>Advanced Analysis Tools</h4>
                  <p>Segmentation, 3D reconstruction, and quantitative analysis</p>
                </div>
              }
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--color-text-secondary)',
                textAlign: 'center',
              }}>
                <div>
                  <h3>Advanced Analysis Mode</h3>
                  <p>AI-powered insights and measurements</p>
                  {uploadedFiles.length > 0 && (
                    <p style={{ marginTop: '1rem', color: 'var(--color-primary-main)' }}>
                      {uploadedFiles.length} files ready for analysis
                    </p>
                  )}
                </div>
              </div>
            </ViewerLayout>
          )}
        </main>

      </div>
    </ErrorBoundary>
  );
};

export default App;
