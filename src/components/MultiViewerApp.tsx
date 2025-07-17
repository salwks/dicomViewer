/**
 * Multi-Viewer Application Component
 * 
 * This is the main component that orchestrates the multi-viewer DICOM system.
 * It integrates all the components and handles the core business logic.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { RecoilRoot, useRecoilState, useSetRecoilState } from 'recoil';
import { Link } from 'react-router-dom';
import { 
  allFilesState, 
  selectedFileIdsState,
  activeViewerIdState,
  AppFile 
} from '../state/multiViewerAtoms';
import MultiViewerSidebar from './MultiViewerSidebar';
import MultiViewerToolbar from './MultiViewerToolbar';
import ViewerLayout from './ViewerLayout';
import { v4 as uuidv4 } from 'uuid';
import { init as csRenderInit } from '@cornerstonejs/core';
import { init as csToolsInit } from '@cornerstonejs/tools';
import dicomImageLoader from '@cornerstonejs/dicom-image-loader';
import { ArrowLeft, Layout } from 'lucide-react';

// Initialize Cornerstone3D
const initializeCornerstone = async () => {
  await csRenderInit();
  await csToolsInit();
  
  // Configure DICOM Image Loader
  dicomImageLoader.external.cornerstone = await import('@cornerstonejs/core');
  dicomImageLoader.external.dicomParser = await import('dicom-parser');
  
  // Set up image loader
  dicomImageLoader.configure({
    useWebWorkers: true,
    decodeConfig: {
      convertFloatPixelDataToInt: false,
    },
  });
};

// App content component (inside RecoilRoot)
const MultiViewerAppContent: React.FC = () => {
  const [allFiles, setAllFiles] = useRecoilState(allFilesState);
  const [selectedFileIds, setSelectedFileIds] = useRecoilState(selectedFileIdsState);
  const setActiveViewerId = useSetRecoilState(activeViewerIdState);
  const isInitialized = useRef(false);

  // Initialize Cornerstone3D on mount
  useEffect(() => {
    if (!isInitialized.current) {
      initializeCornerstone().then(() => {
        console.log('Cornerstone3D initialized for multi-viewer');
        isInitialized.current = true;
      }).catch(error => {
        console.error('Failed to initialize Cornerstone3D:', error);
      });
    }
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(async (files: FileList) => {
    const fileArray = Array.from(files);
    const newFiles: AppFile[] = [];

    for (const file of fileArray) {
      if (file.type === 'application/dicom' || file.name.endsWith('.dcm') || file.name.endsWith('.dicom')) {
        const fileId = uuidv4();
        const imageId = `wadouri:${URL.createObjectURL(file)}`;
        
        const appFile: AppFile = {
          id: fileId,
          name: file.name,
          file: file,
          imageId: imageId,
          loadingStatus: 'pending',
        };

        newFiles.push(appFile);
      }
    }

    if (newFiles.length > 0) {
      setAllFiles(prev => [...prev, ...newFiles]);
      
      // Start loading files
      newFiles.forEach(file => {
        loadDicomFile(file);
      });
    }
  }, [setAllFiles]);

  // Load individual DICOM file
  const loadDicomFile = useCallback(async (file: AppFile) => {
    try {
      // Update loading status
      setAllFiles(prev => 
        prev.map(f => 
          f.id === file.id 
            ? { ...f, loadingStatus: 'loading' as const }
            : f
        )
      );

      // Load the image to validate it
      const image = await dicomImageLoader.loadImage(file.imageId);
      
      if (image) {
        // Update to loaded status
        setAllFiles(prev => 
          prev.map(f => 
            f.id === file.id 
              ? { 
                  ...f, 
                  loadingStatus: 'loaded' as const,
                  loadedImageId: file.imageId,
                  metadata: {
                    width: image.width,
                    height: image.height,
                    pixelSpacing: image.pixelSpacing,
                    windowCenter: image.windowCenter,
                    windowWidth: image.windowWidth,
                  }
                }
              : f
          )
        );
      }
    } catch (error) {
      console.error('Error loading DICOM file:', error);
      setAllFiles(prev => 
        prev.map(f => 
          f.id === file.id 
            ? { 
                ...f, 
                loadingStatus: 'error' as const,
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
              }
            : f
        )
      );
    }
  }, [setAllFiles]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when no input is focused
      if (event.target && (event.target as HTMLElement).tagName === 'INPUT') {
        return;
      }

      const key = event.key.toLowerCase();
      
      // Tool shortcuts
      const toolShortcuts: { [key: string]: string } = {
        'p': 'Pan',
        'z': 'Zoom',
        'w': 'WindowLevel',
        'l': 'Length',
        'a': 'Angle',
        'r': 'RectangleROI',
        'e': 'EllipseROI',
        't': 'Probe',
      };

      if (toolShortcuts[key]) {
        event.preventDefault();
        const toolChangeEvent = new CustomEvent('toolChange', {
          detail: { tool: toolShortcuts[key] }
        });
        window.dispatchEvent(toolChangeEvent);
      }

      // Other shortcuts
      if (event.ctrlKey || event.metaKey) {
        switch (key) {
          case 'a':
            event.preventDefault();
            // Select all files (up to 4)
            const availableFiles = allFiles.slice(0, 4);
            setSelectedFileIds(availableFiles.map(f => f.id));
            break;
          case 'd':
            event.preventDefault();
            // Deselect all files
            setSelectedFileIds([]);
            setActiveViewerId(null);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allFiles, setSelectedFileIds, setActiveViewerId]);

  // Auto-select first file when available
  useEffect(() => {
    if (allFiles.length > 0 && selectedFileIds.length === 0) {
      const firstLoadedFile = allFiles.find(f => f.loadingStatus === 'loaded');
      if (firstLoadedFile) {
        setSelectedFileIds([firstLoadedFile.id]);
        setActiveViewerId(firstLoadedFile.id);
      }
    }
  }, [allFiles, selectedFileIds.length, setSelectedFileIds, setActiveViewerId]);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0">
        <MultiViewerSidebar 
          onFileUpload={handleFileUpload}
          className="h-full"
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <Link 
              to="/" 
              className="flex items-center px-3 py-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Single Viewer
            </Link>
            <div className="flex items-center space-x-2">
              <Layout className="w-5 h-5 text-blue-600" />
              <h1 className="text-lg font-semibold text-gray-900">Multi-Viewer System</h1>
            </div>
          </div>
          
          <div className="text-sm text-gray-500">
            Select up to 4 DICOM files for simultaneous viewing
          </div>
        </div>

        {/* Toolbar */}
        <MultiViewerToolbar className="flex-shrink-0" />

        {/* Viewer Layout */}
        <div className="flex-1 overflow-hidden">
          <ViewerLayout className="h-full" />
        </div>
      </div>
    </div>
  );
};

// Main App component with RecoilRoot
const MultiViewerApp: React.FC = () => {
  return (
    <RecoilRoot>
      <MultiViewerAppContent />
    </RecoilRoot>
  );
};

export default MultiViewerApp;