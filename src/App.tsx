import React, { useEffect, useState } from 'react';
import * as cornerstoneCore from '@cornerstonejs/core';
import * as dicomImageLoader from '@cornerstonejs/dicom-image-loader';
import * as cornerstoneTools from '@cornerstonejs/tools';
import { log } from './utils/logger';
import { ViewerLayout } from './components/ViewerLayout';
import { KeyboardShortcutsProvider } from './components/KeyboardShortcutsProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeToggle } from './components/ThemeToggle';
import { SeriesBrowser } from './components/SeriesBrowser';
import { ToolPanel } from './components/ToolPanel';
import { StudyComparison } from './components/StudyComparison';
import { ViewerTabs, type TabId } from './components/ViewerTabs';
import './styles/global.css';

// Security validation functions
const validateMaxWebWorkers = (hardwareConcurrency: number | undefined): number => {
  // Validate hardware concurrency value
  if (typeof hardwareConcurrency !== 'number' || hardwareConcurrency < 1 || hardwareConcurrency > 32) {
    log.security('Invalid hardware concurrency detected, using safe default of 4 workers', {
      component: 'App',
      metadata: { detectedConcurrency: hardwareConcurrency },
    });
    return 4; // Safe default
  }

  // Cap at reasonable maximum for security and performance
  const maxAllowed = Math.min(hardwareConcurrency, 16);
  log.info(`Using ${maxAllowed} web workers (hardware: ${hardwareConcurrency})`, {
    component: 'App',
    metadata: { maxAllowed, hardwareConcurrency },
  });
  return maxAllowed;
};


const App: React.FC = () => {
  const [selectedSeries, setSelectedSeries] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabId>('viewer');

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

  const handleSeriesSelect = (seriesInstanceUID: string) => {
    setSelectedSeries(seriesInstanceUID);
    log.info('Series selected in main app', {
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
    // TODO: Implement actual DICOM comparison loading logic
  };


  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    log.info('Viewer tab changed', {
      component: 'App',
      metadata: { tabId },
    });
  };

  useEffect(() => {
    initializeCornerstone();
  }, []);

  const initializeCornerstone = async () => {
    try {
      // Initialize libraries following Context7 documentation pattern
      // Reference: /cornerstonejs/cornerstone3d - 443 code examples
      await cornerstoneCore.init();

      // Validate and sanitize web worker configuration
      const maxWorkers = validateMaxWebWorkers(navigator.hardwareConcurrency);

      // Initialize DICOM image loader with validated configuration
      await (dicomImageLoader as any).init({
        maxWebWorkers: maxWorkers,
        decodeConfig: {
          convertFloatPixelDataToInt: false,
          use16BitDataType: false,
        },
      });

      await cornerstoneTools.init();

      log.info('Cornerstone3D initialized successfully', {
        component: 'App',
        operation: 'initialization',
      });
      log.debug('Using Context7 documented initialization pattern', {
        component: 'App',
      });
      log.info(`DICOM loader configured with ${maxWorkers} web workers`, {
        component: 'App',
        metadata: { workerCount: maxWorkers },
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
      <KeyboardShortcutsProvider>
        <div className="app">
          <header className="app-header">
            <div className="header-content">
              <div className="header-title">
                <h1>🏥 Cornerstone3D DICOM Viewer</h1>
                <p>Advanced Medical Imaging Viewer</p>
              </div>
              <div className="header-actions">
                <ThemeToggle />
              </div>
            </div>
          </header>

          {/* Viewer Tabs */}
          <ViewerTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />

          <main className="app-main">
            {activeTab === 'viewer' && (
              <ViewerLayout
                toolPanel={<ToolPanel />}
                sidePanel={
                  <SeriesBrowser
                    series={sampleSeries}
                    selectedSeries={selectedSeries}
                    onSeriesSelect={handleSeriesSelect}
                    onSeriesLoad={handleSeriesLoad}
                  />
                }
              />
            )}

            {activeTab === 'comparison' && (
              <StudyComparison
                studies={sampleStudies}
                onStudySelect={handleStudyComparisonSelect}
                onStudyLoad={handleStudyComparisonLoad}
                maxComparisons={4}
              />
            )}

            {activeTab === 'analysis' && (
              <ViewerLayout
                toolPanel={<ToolPanel />}
                sidePanel={
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    <h4>Advanced Analysis Tools</h4>
                    <p>Coming soon...</p>
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
                    <p>Quantitative analysis tools and AI-powered insights</p>
                  </div>
                </div>
              </ViewerLayout>
            )}
          </main>

          <footer className="app-footer">
            <p>Built with Cornerstone3D v3.x • Medical Grade Security</p>
          </footer>
        </div>
      </KeyboardShortcutsProvider>
    </ErrorBoundary>
  );
};

export default App;
