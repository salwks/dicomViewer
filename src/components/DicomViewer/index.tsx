/**
 * DICOM Viewer Component (Simplified)
 * Displays DICOM images using Cornerstone3D with separated concerns
 */

import React, { useEffect, useRef, useState } from 'react';
import * as cornerstoneTools from '@cornerstonejs/tools';
import { simpleDicomLoader } from '../../services/simpleDicomLoader';
import { ToolType } from '../ToolPanel/constants';
import { log } from '../../utils/logger';
import { useToolSetup } from './hooks/useToolSetup';
import { useViewportSetup } from './hooks/useViewportSetup';
import { useImageNavigation } from './hooks/useImageNavigation';
import { StackScrollIndicator, MiniStackIndicator } from '../StackScrollIndicator';
import './styles.css';
import moduleStyles from './DicomViewer.module.css';

const { ToolGroupManager } = cornerstoneTools;

interface DicomViewerProps {
  seriesInstanceUID?: string;
  imageIds?: string[];
  activeTool?: ToolType;
}

export const DicomViewer: React.FC<DicomViewerProps> = ({
  seriesInstanceUID,
  imageIds: propImageIds,
  activeTool = ToolType.WINDOW_LEVEL,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageIds, setImageIds] = useState<string[]>([]);

  // Viewport and tool IDs
  const renderingEngineId = 'mainRenderingEngine';
  const viewportId = 'CT_VIEWPORT';
  const toolGroupId = 'TOOL_GROUP_ID';

  // Custom hooks
  const { setupTools, setActiveTool } = useToolSetup(toolGroupId);
  const { setupViewport, destroyViewport, getRenderingEngine } = useViewportSetup(renderingEngineId, viewportId);
  const {
    currentImageIndex,
    navigateToNext,
    navigateToPrevious,
    canNavigateNext,
    canNavigatePrevious,
  } = useImageNavigation(imageIds);

  // Load image IDs for the series
  useEffect(() => {
    if (seriesInstanceUID) {
      const seriesImageIds = simpleDicomLoader.getImageIdsForSeries(seriesInstanceUID);
      setImageIds(seriesImageIds);

      log.info('Loading images for series', {
        component: 'DicomViewer',
        metadata: {
          seriesInstanceUID,
          imageCount: seriesImageIds.length,
          imageIds: seriesImageIds,
        },
      });
    } else if (propImageIds) {
      setImageIds(propImageIds);
    } else {
      setImageIds([]);
    }
  }, [seriesInstanceUID, propImageIds]);

  // Setup viewport and tools when images are available
  useEffect(() => {
    if (imageIds.length === 0) {
      setIsLoading(false);
      setError('No DICOM images available for this series. Please upload DICOM files first.');
      setupTools(); // Still set up tools for UI interaction
      return;
    }

    const setupAndRender = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const element = viewportRef.current;
        if (!element) return;

        // Setup viewport
        await setupViewport(element, imageIds, currentImageIndex);

        // Setup tools
        setupTools();

        // Add viewport to tool group
        const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
        if (toolGroup) {
          toolGroup.addViewport(viewportId, renderingEngineId);
        }

        // Set the active tool after a small delay
        setTimeout(() => {
          setActiveTool(activeTool);
        }, 100);

        log.info('DICOM viewer initialized successfully', {
          component: 'DicomViewer',
          metadata: {
            seriesInstanceUID: seriesInstanceUID || 'none',
            imageCount: imageIds.length,
            currentIndex: currentImageIndex,
          },
        });

        setIsLoading(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load image';
        setError(errorMessage);
        setIsLoading(false);

        log.error('Failed to initialize DICOM viewer', {
          component: 'DicomViewer',
          metadata: {
            seriesInstanceUID: seriesInstanceUID || 'none',
            imageCount: imageIds.length,
          },
        }, err as Error);
      }
    };

    setupAndRender();

    // Cleanup
    return () => {
      destroyViewport();

      const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
      if (toolGroup) {
        ToolGroupManager.destroyToolGroup(toolGroupId);
      }
    };
  }, [
    imageIds,
    currentImageIndex,
    seriesInstanceUID,
    setupViewport,
    setupTools,
    toolGroupId,
    viewportId,
    renderingEngineId,
    activeTool,
    destroyViewport,
    setActiveTool,
  ]);

  // Handle tool activation changes
  useEffect(() => {
    const renderingEngine = getRenderingEngine();
    if (renderingEngine && !isLoading) {
      setTimeout(() => {
        setActiveTool(activeTool);
      }, 200);
    }
  }, [activeTool, isLoading, setActiveTool, getRenderingEngine]);

  return (
    <div className="dicom-viewer">
      {/* Viewer Controls */}
      <div className="viewer-controls">
        <div className="image-navigation">
          <button
            onClick={navigateToPrevious}
            disabled={!canNavigatePrevious}
          >
            Previous
          </button>
          <span className="image-counter">
            Image {currentImageIndex + 1} of {imageIds.length}
          </span>
          <button
            onClick={navigateToNext}
            disabled={!canNavigateNext}
          >
            Next
          </button>
        </div>
        <div className="viewer-info">
          {seriesInstanceUID && (
            <span className="series-info">Series: {seriesInstanceUID.slice(-8)}</span>
          )}
        </div>
      </div>

      {/* Viewport */}
      <div className="viewport-container">
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Loading DICOM image...</p>
          </div>
        )}

        {error && (
          <div className="error-overlay">
            <div className={moduleStyles.errorContent}>
              <h3 className={moduleStyles.errorTitle}>
                📁 No DICOM Images
              </h3>
              <p className={moduleStyles.errorMessage}>
                {error}
              </p>
              <p className={moduleStyles.errorHint}>
                Use the "Load Files" button above to upload DICOM files, then select a series from the sidebar.
              </p>
            </div>
          </div>
        )}

        <div
          ref={viewportRef}
          className={`cornerstone-viewport ${moduleStyles.cornerstoneViewport}`}
        />

        {/* Stack Scroll Indicator - Full version */}
        {!isLoading && imageIds.length > 1 && (
          <StackScrollIndicator
            renderingEngineId={renderingEngineId}
            viewportId={viewportId}
            imageCount={imageIds.length}
            currentIndex={currentImageIndex}
            onIndexChange={(index) => {
              // Update navigation hook state if needed
              log.info('Stack index changed via indicator', {
                component: 'DicomViewer',
                metadata: { newIndex: index, totalImages: imageIds.length },
              });
            }}
          />
        )}

        {/* Mini Stack Indicator - Compact version */}
        {!isLoading && (
          <MiniStackIndicator
            renderingEngineId={renderingEngineId}
            viewportId={viewportId}
            position="bottom-left"
          />
        )}
      </div>

      {/* Tool Instructions */}
      <div className="tool-instructions">
        <span>🖱️ Left Click: Active Tool ({activeTool})</span>
        <span>🖱️ Right Click: Pan</span>
        <span>🖱️ Middle Click: Zoom</span>
        <span>⚙️ Scroll: Navigate Images</span>
        {process.env.NODE_ENV === 'development' && (
          <button
            onClick={() => {
              const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
              console.log('Tool Group Debug:', {
                toolGroup,
                toolGroupId,
                activeTool,
                tools: toolGroup ? Object.keys(toolGroup.toolOptions) : 'No tools',
              });
            }}
            className={moduleStyles.debugButton}
          >
            Debug Tools
          </button>
        )}
      </div>
    </div>
  );
};
