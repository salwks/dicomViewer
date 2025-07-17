/**
 * Integrated DICOM Viewer Component
 * 
 * This component combines single and multi-viewer functionality in a unified interface.
 * Users can switch between single and multi-viewer modes without page navigation.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { RecoilRoot } from 'recoil';
import { 
  allFilesState, 
  selectedFileIdsState,
  activeViewerIdState,
  AppFile 
} from '../state/multiViewerAtoms';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { v4 as uuidv4 } from 'uuid';

// Import components
import MultiViewerSidebar from './MultiViewerSidebar';
import MultiViewerToolbar from './MultiViewerToolbar';
import ViewerLayout from './ViewerLayout';
import { DicomRenderer } from './DicomRenderer';
import { Grid, Monitor } from 'lucide-react';

// Content component (inside RecoilRoot)
const IntegratedViewerContent: React.FC = () => {
  const [viewMode, setViewMode] = useState<'single' | 'multi'>('single');
  const [allFiles, setAllFiles] = useRecoilState(allFilesState);
  const [selectedFileIds, setSelectedFileIds] = useRecoilState(selectedFileIdsState);
  const setActiveViewerId = useSetRecoilState(activeViewerIdState);

  // Handle file upload - simplified version that works with existing DicomRenderer
  const handleFileUpload = useCallback(async (files: FileList) => {
    const fileArray = Array.from(files);
    const newFiles: AppFile[] = [];

    for (const file of fileArray) {
      if (file.type === 'application/dicom' || file.name.endsWith('.dcm') || file.name.endsWith('.dicom')) {
        const fileId = uuidv4();
        
        const appFile: AppFile = {
          id: fileId,
          name: file.name,
          file: file,
          imageId: '', // Will be set by DicomRenderer
          loadingStatus: 'loaded', // Let DicomRenderer handle loading
        };

        newFiles.push(appFile);
      }
    }

    if (newFiles.length > 0) {
      setAllFiles(prev => [...prev, ...newFiles]);
    }
  }, [setAllFiles]);

  // Handle mode switch
  const handleModeSwitch = useCallback((mode: 'single' | 'multi') => {
    setViewMode(mode);
    
    // Clear selection when switching to single mode
    if (mode === 'single') {
      setSelectedFileIds([]);
      setActiveViewerId(null);
    }
  }, [setSelectedFileIds, setActiveViewerId]);

  // Auto-select first file when switching to multi mode
  useEffect(() => {
    if (viewMode === 'multi' && allFiles.length > 0 && selectedFileIds.length === 0) {
      const firstLoadedFile = allFiles.find(f => f.loadingStatus === 'loaded');
      if (firstLoadedFile) {
        setSelectedFileIds([firstLoadedFile.id]);
        setActiveViewerId(firstLoadedFile.id);
      }
    }
  }, [viewMode, allFiles, selectedFileIds.length, setSelectedFileIds, setActiveViewerId]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target && (event.target as HTMLElement).tagName === 'INPUT') {
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        setViewMode(current => current === 'single' ? 'multi' : 'single');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar - Always visible */}
      <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200">
        <div className="h-full flex flex-col">
          {/* Mode Switcher */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">
                DICOM Viewer
              </h2>
              <span className="text-xs text-gray-500">
                Press Tab to switch modes
              </span>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => handleModeSwitch('single')}
                className={`
                  flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${viewMode === 'single' 
                    ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                  }
                `}
              >
                <Monitor className="w-4 h-4 mr-2" />
                Single View
              </button>
              <button
                onClick={() => handleModeSwitch('multi')}
                className={`
                  flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${viewMode === 'multi' 
                    ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                  }
                `}
              >
                <Grid className="w-4 h-4 mr-2" />
                Multi-View
              </button>
            </div>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-hidden">
            {viewMode === 'multi' ? (
              <MultiViewerSidebar 
                onFileUpload={handleFileUpload}
                className="h-full border-0"
              />
            ) : (
              <div className="p-4">
                <div className="mb-4">
                  <input
                    type="file"
                    multiple
                    accept=".dcm,.dicom"
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                    className="hidden"
                    id="single-file-upload"
                  />
                  <label
                    htmlFor="single-file-upload"
                    className="flex items-center justify-center w-full p-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    <div className="text-center">
                      <Monitor className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        Upload DICOM Files
                      </span>
                    </div>
                  </label>
                </div>

                {/* File List for Single Mode */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Loaded Files ({allFiles.length})
                  </h3>
                  {allFiles.map((file) => (
                    <div
                      key={file.id}
                      className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {file.name}
                        </span>
                        <button
                          onClick={() => setAllFiles(prev => prev.filter(f => f.id !== file.id))}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title="Remove file"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar - Only show in multi mode */}
        {viewMode === 'multi' && (
          <MultiViewerToolbar className="flex-shrink-0" />
        )}

        {/* Viewer Area */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'multi' ? (
            <ViewerLayout className="h-full" />
          ) : (
            <div className="h-full">
              {allFiles.length > 0 ? (
                <DicomRenderer 
                  files={allFiles.map(f => f.file)} 
                  onError={(error) => console.error('DICOM render error:', error)}
                  onSuccess={() => console.log('DICOM render success')}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <Monitor className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No DICOM Files Loaded
                    </h3>
                    <p className="text-sm text-gray-600">
                      Upload DICOM files using the sidebar to get started
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Main component with RecoilRoot
const IntegratedDicomViewer: React.FC = () => {
  return (
    <RecoilRoot>
      <IntegratedViewerContent />
    </RecoilRoot>
  );
};

export default IntegratedDicomViewer;