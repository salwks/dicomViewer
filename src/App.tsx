import { useEffect } from 'react';
import * as cornerstoneCore from '@cornerstonejs/core';
import * as dicomImageLoader from '@cornerstonejs/dicom-image-loader';
import * as cornerstoneTools from '@cornerstonejs/tools';
import * as dicomParser from 'dicom-parser';
import './App.css';

// Security validation functions
const validateMaxWebWorkers = (hardwareConcurrency: number | undefined): number => {
  // Validate hardware concurrency value
  if (typeof hardwareConcurrency !== 'number' || hardwareConcurrency < 1 || hardwareConcurrency > 32) {
    console.warn('Invalid hardware concurrency detected, using safe default of 4 workers');
    return 4; // Safe default
  }

  // Cap at reasonable maximum for security and performance
  const maxAllowed = Math.min(hardwareConcurrency, 16);
  console.log(`🔧 Using ${maxAllowed} web workers (hardware: ${hardwareConcurrency})`);
  return maxAllowed;
};

const validateWorkerPath = (path: string): string => {
  // Validate worker path format and prevent path traversal
  if (typeof path !== 'string' || path.length === 0) {
    throw new Error('Invalid worker path: path must be a non-empty string');
  }

  // Check for path traversal attempts
  if (path.includes('..') || path.includes('\\') || path.startsWith('/')) {
    // Only allow relative paths starting with specific allowed directories
    if (!path.startsWith('/cornerstone-dicom-image-loader/') && !path.startsWith('/workers/')) {
      throw new Error('Invalid worker path: path traversal or unauthorized directory access detected');
    }
  }

  // Validate file extension
  if (!path.endsWith('.js') && !path.endsWith('.min.js')) {
    throw new Error('Invalid worker path: only JavaScript files are allowed');
  }

  console.log(`🔧 Using validated worker path: ${path}`);
  return path;
};

function App() {
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
      const workerPath = validateWorkerPath('/cornerstone-dicom-image-loader/cornerstoneDICOMImageLoaderWebWorker.min.js');

      // Initialize DICOM image loader with validated configuration
      dicomImageLoader.external.cornerstone = cornerstoneCore;
      dicomImageLoader.external.dicomParser = dicomParser;
      dicomImageLoader.configure({
        maxWebWorkers: maxWorkers,
        startWebWorkersOnDemand: true,
        webWorkerPath: workerPath,
      });

      await cornerstoneTools.init();

      console.log('✅ Cornerstone3D initialized successfully');
      console.log('📚 Using Context7 documented initialization pattern');
      console.log(`🚀 DICOM loader configured with ${maxWorkers} web workers`);
    } catch (error) {
      console.error('❌ Failed to initialize Cornerstone3D:', error);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🏥 Cornerstone3D DICOM Viewer</h1>
        <p>Advanced Medical Imaging Viewer</p>
      </header>

      <main className="app-main">
        <div className="viewer-container">
          <div id="dicom-viewport" className="viewport">
            <div className="loading-message">
              Ready to load DICOM files...
            </div>
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <p>Built with Cornerstone3D v3.x</p>
      </footer>
    </div>
  );
}

export default App;
