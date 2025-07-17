/**
 * Multi-Viewer Sidebar Component
 * 
 * This component handles:
 * - Display of all loaded DICOM files
 * - Multi-file selection with ordering (1-4)
 * - Layout mode switching (1xN vs 2xN)
 * - Checkbox state management and disabling logic
 */

import React, { useCallback } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { 
  allFilesState, 
  selectedFileIdsState, 
  layoutModeState,
  isMaxFilesSelectedSelector,
  fileSelectionOrderSelector,
  AppFile,
  LayoutMode
} from '../state/multiViewerAtoms';
import { Grid, LayoutGrid, FileText, CheckCircle2, Circle } from 'lucide-react';

interface MultiViewerSidebarProps {
  onFileUpload: (files: FileList) => void;
  className?: string;
}

const MultiViewerSidebar: React.FC<MultiViewerSidebarProps> = ({ 
  onFileUpload, 
  className = '' 
}) => {
  const [allFiles, setAllFiles] = useRecoilState(allFilesState);
  const [selectedFileIds, setSelectedFileIds] = useRecoilState(selectedFileIdsState);
  const [layoutMode, setLayoutMode] = useRecoilState(layoutModeState);
  const isMaxFilesSelected = useRecoilValue(isMaxFilesSelectedSelector);

  // Handle file selection/deselection
  const handleFileSelection = useCallback((fileId: string, isSelected: boolean) => {
    setSelectedFileIds(prev => {
      if (isSelected) {
        // Add to selection if not already selected and under limit
        if (!prev.includes(fileId) && prev.length < 4) {
          return [...prev, fileId];
        }
        return prev;
      } else {
        // Remove from selection
        return prev.filter(id => id !== fileId);
      }
    });
  }, [setSelectedFileIds]);

  // Handle layout mode change
  const handleLayoutModeChange = useCallback((mode: LayoutMode) => {
    setLayoutMode(mode);
  }, [setLayoutMode]);

  // Handle file upload
  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      onFileUpload(files);
    }
    // Reset input value to allow selecting the same file again
    event.target.value = '';
  }, [onFileUpload]);

  // Handle file removal
  const handleFileRemove = useCallback((fileId: string) => {
    // Remove from selection first
    setSelectedFileIds(prev => prev.filter(id => id !== fileId));
    // Then remove from all files
    setAllFiles(prev => prev.filter(file => file.id !== fileId));
  }, [setAllFiles, setSelectedFileIds]);

  // File item component
  const FileItem: React.FC<{ file: AppFile; index: number }> = ({ file, index }) => {
    const selectionOrder = useRecoilValue(fileSelectionOrderSelector(file.id));
    const isSelected = selectionOrder !== null;
    const isDisabled = !isSelected && isMaxFilesSelected;

    return (
      <div
        className={`
          relative flex items-center p-3 rounded-lg border transition-all duration-200
          ${isSelected 
            ? 'border-blue-500 bg-blue-50 shadow-sm' 
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }
          ${isDisabled ? 'opacity-50' : ''}
        `}
      >
        {/* Selection Checkbox with Order Number */}
        <div className="relative mr-3">
          <input
            type="checkbox"
            id={`file-${file.id}`}
            checked={isSelected}
            disabled={isDisabled}
            onChange={(e) => handleFileSelection(file.id, e.target.checked)}
            className="sr-only"
          />
          <label
            htmlFor={`file-${file.id}`}
            className={`
              flex items-center justify-center w-6 h-6 rounded-full border-2 cursor-pointer
              transition-all duration-200
              ${isSelected 
                ? 'border-blue-500 bg-blue-500 text-white' 
                : isDisabled 
                  ? 'border-gray-300 bg-gray-100 cursor-not-allowed'
                  : 'border-gray-300 hover:border-blue-400'
              }
            `}
          >
            {isSelected ? (
              <span className="text-xs font-bold">{selectionOrder}</span>
            ) : (
              <div className="w-2 h-2 rounded-full bg-current opacity-0 group-hover:opacity-100" />
            )}
          </label>
        </div>

        {/* File Information */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center mb-1">
            <FileText className="w-4 h-4 mr-2 text-gray-500" />
            <span className="text-sm font-medium text-gray-900 truncate">
              {file.name}
            </span>
          </div>
          
          {/* Loading Status */}
          <div className="flex items-center text-xs text-gray-500">
            <div className={`
              w-2 h-2 rounded-full mr-2
              ${file.loadingStatus === 'loaded' ? 'bg-green-500' : 
                file.loadingStatus === 'loading' ? 'bg-yellow-500 animate-pulse' :
                file.loadingStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'}
            `} />
            <span>
              {file.loadingStatus === 'loaded' ? 'Loaded' :
               file.loadingStatus === 'loading' ? 'Loading...' :
               file.loadingStatus === 'error' ? 'Error' : 'Pending'}
            </span>
          </div>
        </div>

        {/* Remove Button */}
        <button
          onClick={() => handleFileRemove(file.id)}
          className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
          title="Remove file"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Multi-Viewer
        </h2>
        
        {/* File Upload */}
        <div className="mb-4">
          <input
            type="file"
            multiple
            accept=".dcm,.dicom"
            onChange={handleFileInputChange}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="flex items-center justify-center w-full p-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            <div className="text-center">
              <FileText className="w-6 h-6 mx-auto mb-2 text-gray-400" />
              <span className="text-sm text-gray-600">
                Upload DICOM Files
              </span>
            </div>
          </label>
        </div>

        {/* Layout Mode Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Layout Mode
          </label>
          <div className="flex space-x-2">
            <button
              onClick={() => handleLayoutModeChange('1xN')}
              className={`
                flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors
                ${layoutMode === '1xN' 
                  ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                  : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                }
              `}
            >
              <Grid className="w-4 h-4 mr-2" />
              1×N
            </button>
            <button
              onClick={() => handleLayoutModeChange('2xN')}
              className={`
                flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors
                ${layoutMode === '2xN' 
                  ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                  : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                }
              `}
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              2×N
            </button>
          </div>
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">
            Files ({allFiles.length})
          </h3>
          <span className="text-xs text-gray-500">
            {selectedFileIds.length}/4 selected
          </span>
        </div>

        {allFiles.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No files uploaded</p>
            <p className="text-xs mt-1">Upload DICOM files to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {allFiles.map((file, index) => (
              <FileItem key={file.id} file={file} index={index} />
            ))}
          </div>
        )}
      </div>

      {/* Selection Info */}
      {selectedFileIds.length > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-700">
            <div className="flex items-center mb-2">
              <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
              <span className="font-medium">
                {selectedFileIds.length} file{selectedFileIds.length !== 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="text-xs text-gray-500">
              Layout: {layoutMode === '1xN' ? 'Single row' : 'Grid layout'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiViewerSidebar;