/**
 * Viewer Layout Component
 * 
 * This component handles the dynamic grid layout for multiple DICOM viewers.
 * It supports:
 * - 1xN layout: Single row layout (1x1, 1x2, 1x3, 1x4)
 * - 2xN layout: Grid layout (1x1, 1x2, 2x2 for 3-4 files)
 * - Proper ordering of viewers based on selection sequence
 * - Responsive design with proper spacing
 */

import React from 'react';
import { useRecoilValue } from 'recoil';
import { 
  visibleFilesSelector, 
  gridLayoutConfigSelector,
  layoutModeState,
  selectedFileIdsState
} from '../state/multiViewerAtoms';
import SingleViewer from './SingleViewer';
import { FileText } from 'lucide-react';

interface ViewerLayoutProps {
  className?: string;
}

const ViewerLayout: React.FC<ViewerLayoutProps> = ({ className = '' }) => {
  const visibleFiles = useRecoilValue(visibleFilesSelector);
  const gridConfig = useRecoilValue(gridLayoutConfigSelector);
  const layoutMode = useRecoilValue(layoutModeState);
  const selectedFileIds = useRecoilValue(selectedFileIdsState);

  // Empty state when no files are selected
  if (visibleFiles.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-50 ${className}`}>
        <div className="text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Files Selected
          </h3>
          <p className="text-sm text-gray-600 max-w-md mx-auto">
            Select up to 4 DICOM files from the sidebar to view them in the layout. 
            Choose between 1×N (single row) or 2×N (grid) layout modes.
          </p>
        </div>
      </div>
    );
  }

  // Calculate grid positioning for 2xN layout
  const getGridPosition = (index: number, totalFiles: number) => {
    if (layoutMode === '1xN') {
      return {
        gridRow: 1,
        gridColumn: index + 1,
      };
    } else { // 2xN layout
      if (totalFiles === 1) {
        return { gridRow: 1, gridColumn: 1 };
      } else if (totalFiles === 2) {
        return { 
          gridRow: 1, 
          gridColumn: index + 1 
        };
      } else if (totalFiles === 3) {
        // For 3 files: top-left, top-right, bottom-left
        if (index === 0) return { gridRow: 1, gridColumn: 1 };
        if (index === 1) return { gridRow: 1, gridColumn: 2 };
        if (index === 2) return { gridRow: 2, gridColumn: 1 };
      } else { // 4 files
        // 2x2 grid: top-left, top-right, bottom-left, bottom-right
        if (index === 0) return { gridRow: 1, gridColumn: 1 };
        if (index === 1) return { gridRow: 1, gridColumn: 2 };
        if (index === 2) return { gridRow: 2, gridColumn: 1 };
        if (index === 3) return { gridRow: 2, gridColumn: 2 };
      }
    }
    return { gridRow: 1, gridColumn: 1 };
  };

  return (
    <div className={`h-full bg-gray-100 p-4 ${className}`}>
      {/* Layout Info Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {layoutMode === '1xN' ? 'Single Row Layout' : 'Grid Layout'}
          </h2>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span>
              {visibleFiles.length} file{visibleFiles.length !== 1 ? 's' : ''}
            </span>
            <span>
              {gridConfig.rows}×{gridConfig.cols} grid
            </span>
          </div>
        </div>
      </div>

      {/* Dynamic Grid Container */}
      <div 
        className="h-full rounded-lg overflow-hidden shadow-sm"
        style={{
          display: 'grid',
          gridTemplate: gridConfig.gridTemplate,
          gap: '8px',
          minHeight: '400px',
        }}
      >
        {visibleFiles.map((file, index) => {
          const gridPosition = getGridPosition(index, visibleFiles.length);
          
          return (
            <div
              key={file.id}
              className="relative bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm"
              style={{
                gridRow: gridPosition.gridRow,
                gridColumn: gridPosition.gridColumn,
                minHeight: '200px',
              }}
            >
              {/* Viewer Order Badge */}
              <div className="absolute top-2 left-2 z-10">
                <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg">
                  {index + 1}
                </div>
              </div>

              {/* File Name Badge */}
              <div className="absolute top-2 right-2 z-10">
                <div className="bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs font-medium max-w-40 truncate">
                  {file.name}
                </div>
              </div>

              {/* Single Viewer Component */}
              <SingleViewer 
                file={file}
                viewerIndex={index}
                className="w-full h-full"
              />
            </div>
          );
        })}
      </div>

      {/* Layout Guide */}
      <div className="mt-4 text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <span>
            Layout Mode: {layoutMode === '1xN' ? 'Single Row (1×N)' : 'Grid (2×N)'}
          </span>
          <span>
            Click on any viewer to activate it for tool interactions
          </span>
        </div>
      </div>
    </div>
  );
};

export default ViewerLayout;