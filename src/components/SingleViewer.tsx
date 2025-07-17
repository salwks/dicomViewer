/**
 * Single Viewer Component
 * 
 * This component represents an individual DICOM viewer within the multi-viewer layout.
 * Each viewer operates independently with its own:
 * - Viewport settings (zoom, pan, window/level)
 * - Annotation data
 * - Tool states
 * - Loading states
 * - Active/inactive visual states
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { 
  activeViewerIdState,
  annotationsByViewerIdState,
  toolStateByViewerIdState,
  viewportSettingsByViewerIdState,
  viewerLoadingStatesState,
  isViewerActiveSelector,
  annotationsForViewerSelector,
  toolForViewerSelector,
  viewportSettingsForViewerSelector,
  isViewerLoadingSelector,
  AppFile,
  Annotation,
  ToolType
} from '../state/multiViewerAtoms';
import { 
  RenderingEngine, 
  Types, 
  Enums, 
  setVolumesForViewports,
  volumeLoader,
  cache
} from '@cornerstonejs/core';
import { 
  addTool, 
  removeTool, 
  ToolGroupManager,
  Enums as csToolsEnums,
  annotation,
  state
} from '@cornerstonejs/tools';
import dicomImageLoader from '@cornerstonejs/dicom-image-loader';
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface SingleViewerProps {
  file: AppFile;
  viewerIndex: number;
  className?: string;
}

const SingleViewer: React.FC<SingleViewerProps> = ({ file, viewerIndex, className = '' }) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const renderingEngineRef = useRef<RenderingEngine | null>(null);
  const viewportRef2 = useRef<Types.IViewport | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recoil state
  const [activeViewerId, setActiveViewerId] = useRecoilState(activeViewerIdState);
  const [annotationsByViewerId, setAnnotationsByViewerId] = useRecoilState(annotationsByViewerIdState);
  const [toolStateByViewerId, setToolStateByViewerId] = useRecoilState(toolStateByViewerIdState);
  const [viewportSettingsByViewerId, setViewportSettingsByViewerId] = useRecoilState(viewportSettingsByViewerIdState);
  const setViewerLoadingStates = useSetRecoilState(viewerLoadingStatesState);

  // Derived state
  const isActive = useRecoilValue(isViewerActiveSelector(file.id));
  const annotations = useRecoilValue(annotationsForViewerSelector(file.id));
  const currentTool = useRecoilValue(toolForViewerSelector(file.id));
  const viewportSettings = useRecoilValue(viewportSettingsForViewerSelector(file.id));
  const isLoading = useRecoilValue(isViewerLoadingSelector(file.id));

  // Unique viewport ID for this viewer
  const viewportId = `viewport-${file.id}`;
  const renderingEngineId = `renderingEngine-${file.id}`;
  const toolGroupId = `toolGroup-${file.id}`;

  // Initialize Cornerstone3D viewport
  const initializeViewer = useCallback(async () => {
    if (!viewportRef.current || !file.imageId) return;

    try {
      setViewerLoadingStates(prev => ({ ...prev, [file.id]: true }));
      setError(null);

      // Create rendering engine
      const renderingEngine = new RenderingEngine(renderingEngineId);
      renderingEngineRef.current = renderingEngine;

      // Create viewport
      const viewportInput = {
        viewportId,
        type: Enums.ViewportType.STACK,
        element: viewportRef.current,
        defaultOptions: {
          background: [0, 0, 0] as Types.Point3,
        },
      };

      renderingEngine.enableElement(viewportInput);
      const viewport = renderingEngine.getViewport(viewportId) as Types.IStackViewport;
      viewportRef2.current = viewport;

      // Load image
      const imageIds = [file.imageId];
      await viewport.setStack(imageIds);
      viewport.render();

      // Apply saved viewport settings
      const settings = viewportSettings;
      if (settings) {
        if (settings.zoom !== 1) {
          viewport.setZoom(settings.zoom);
        }
        if (settings.pan.x !== 0 || settings.pan.y !== 0) {
          viewport.setPan(settings.pan);
        }
        if (settings.windowLevel) {
          viewport.setProperties({
            voiRange: {
              lower: settings.windowLevel.center - settings.windowLevel.width / 2,
              upper: settings.windowLevel.center + settings.windowLevel.width / 2,
            }
          });
        }
        if (settings.invert) {
          viewport.setProperties({ invert: settings.invert });
        }
        if (settings.rotation !== 0) {
          viewport.setProperties({ rotation: settings.rotation });
        }
        if (settings.hFlip) {
          viewport.setProperties({ flipHorizontal: settings.hFlip });
        }
        if (settings.vFlip) {
          viewport.setProperties({ flipVertical: settings.vFlip });
        }
      }

      // Initialize tool group for this viewer
      initializeToolGroup();

      setIsInitialized(true);
    } catch (err) {
      console.error('Error initializing viewer:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize viewer');
    } finally {
      setViewerLoadingStates(prev => ({ ...prev, [file.id]: false }));
    }
  }, [file.id, file.imageId, viewportId, renderingEngineId, toolGroupId, viewportSettings]);

  // Initialize tool group
  const initializeToolGroup = useCallback(() => {
    try {
      // Remove existing tool group if it exists
      const existingToolGroup = ToolGroupManager.getToolGroup(toolGroupId);
      if (existingToolGroup) {
        existingToolGroup.destroy();
      }

      // Create new tool group
      const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
      if (!toolGroup) return;

      // Add tools to the group
      toolGroup.addTool('Length');
      toolGroup.addTool('Angle');
      toolGroup.addTool('RectangleROI');
      toolGroup.addTool('EllipseROI');
      toolGroup.addTool('Probe');
      toolGroup.addTool('Pan');
      toolGroup.addTool('Zoom');
      toolGroup.addTool('WindowLevel');

      // Add viewport to tool group
      toolGroup.addViewport(viewportId, renderingEngineId);

      // Set initial tool state
      const tool = currentTool || 'Pan';
      setActiveTool(tool);
    } catch (err) {
      console.error('Error initializing tool group:', err);
    }
  }, [toolGroupId, viewportId, renderingEngineId, currentTool]);

  // Set active tool
  const setActiveTool = useCallback((tool: ToolType) => {
    try {
      const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
      if (!toolGroup) return;

      // Deactivate all tools
      toolGroup.setToolPassive('Length');
      toolGroup.setToolPassive('Angle');
      toolGroup.setToolPassive('RectangleROI');
      toolGroup.setToolPassive('EllipseROI');
      toolGroup.setToolPassive('Probe');
      toolGroup.setToolPassive('Pan');
      toolGroup.setToolPassive('Zoom');
      toolGroup.setToolPassive('WindowLevel');

      // Activate selected tool
      if (tool === 'Pan') {
        toolGroup.setToolActive('Pan', { bindings: [{ mouseButton: 1 }] });
      } else if (tool === 'Zoom') {
        toolGroup.setToolActive('Zoom', { bindings: [{ mouseButton: 1 }] });
      } else if (tool === 'WindowLevel') {
        toolGroup.setToolActive('WindowLevel', { bindings: [{ mouseButton: 1 }] });
      } else {
        toolGroup.setToolActive(tool, { bindings: [{ mouseButton: 1 }] });
      }

      // Update tool state
      setToolStateByViewerId(prev => ({
        ...prev,
        [file.id]: tool
      }));
    } catch (err) {
      console.error('Error setting active tool:', err);
    }
  }, [toolGroupId, file.id, setToolStateByViewerId]);

  // Handle viewer click (activation)
  const handleViewerClick = useCallback(() => {
    setActiveViewerId(file.id);
  }, [file.id, setActiveViewerId]);

  // Handle viewport settings changes
  const handleViewportChange = useCallback(() => {
    if (!viewportRef2.current) return;

    try {
      const viewport = viewportRef2.current as Types.IStackViewport;
      const camera = viewport.getCamera();
      const properties = viewport.getProperties();

      const newSettings = {
        zoom: camera.parallelScale ? 1 / camera.parallelScale : 1,
        pan: { x: camera.focalPoint[0], y: camera.focalPoint[1] },
        windowLevel: properties.voiRange ? {
          center: (properties.voiRange.lower + properties.voiRange.upper) / 2,
          width: properties.voiRange.upper - properties.voiRange.lower
        } : { center: 40, width: 400 },
        invert: properties.invert || false,
        rotation: properties.rotation || 0,
        hFlip: properties.flipHorizontal || false,
        vFlip: properties.flipVertical || false,
      };

      setViewportSettingsByViewerId(prev => ({
        ...prev,
        [file.id]: newSettings
      }));
    } catch (err) {
      console.error('Error handling viewport change:', err);
    }
  }, [file.id, setViewportSettingsByViewerId]);

  // Handle annotation events
  const handleAnnotationEvent = useCallback((evt: any) => {
    if (evt.detail.viewportId !== viewportId) return;

    try {
      const { annotation: annotationData } = evt.detail;
      
      if (evt.type === 'annotationCompleted') {
        const newAnnotation: Annotation = {
          id: annotationData.annotationUID,
          type: annotationData.metadata.toolName,
          data: annotationData.data,
          toolName: annotationData.metadata.toolName,
          timestamp: new Date().toISOString(),
          viewportId: viewportId,
          imageId: file.imageId,
          unit: 'mm'
        };

        setAnnotationsByViewerId(prev => ({
          ...prev,
          [file.id]: [...(prev[file.id] || []), newAnnotation]
        }));
      }
    } catch (err) {
      console.error('Error handling annotation event:', err);
    }
  }, [viewportId, file.id, file.imageId, setAnnotationsByViewerId]);

  // Effect to initialize viewer when file is loaded
  useEffect(() => {
    if (file.loadingStatus === 'loaded' && viewportRef.current && !isInitialized) {
      initializeViewer();
    }
  }, [file.loadingStatus, initializeViewer, isInitialized]);

  // Effect to handle tool changes when this viewer is active
  useEffect(() => {
    if (isActive && isInitialized) {
      // Listen for tool changes from the main toolbar
      const handleToolChange = (event: CustomEvent) => {
        if (event.detail.viewerId === file.id) {
          setActiveTool(event.detail.tool);
        }
      };

      window.addEventListener('toolChange', handleToolChange as EventListener);
      return () => window.removeEventListener('toolChange', handleToolChange as EventListener);
    }
  }, [isActive, isInitialized, file.id, setActiveTool]);

  // Effect to handle viewport events
  useEffect(() => {
    if (!isInitialized || !viewportRef.current) return;

    const element = viewportRef.current;

    // Add event listeners
    element.addEventListener('cornerstoneViewportCameraModified', handleViewportChange);
    element.addEventListener('cornerstoneViewportVOIModified', handleViewportChange);
    element.addEventListener('cornerstoneAnnotationCompleted', handleAnnotationEvent);

    return () => {
      element.removeEventListener('cornerstoneViewportCameraModified', handleViewportChange);
      element.removeEventListener('cornerstoneViewportVOIModified', handleViewportChange);
      element.removeEventListener('cornerstoneAnnotationCompleted', handleAnnotationEvent);
    };
  }, [isInitialized, handleViewportChange, handleAnnotationEvent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (renderingEngineRef.current) {
        renderingEngineRef.current.destroy();
      }
      const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
      if (toolGroup) {
        toolGroup.destroy();
      }
    };
  }, [toolGroupId]);

  // Render loading state
  if (isLoading || file.loadingStatus === 'loading') {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-100 ${className}`}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
          <p className="text-sm text-gray-600">Loading DICOM...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error || file.loadingStatus === 'error') {
    return (
      <div className={`flex items-center justify-center h-full bg-red-50 ${className}`}>
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
          <p className="text-sm text-red-600">
            {error || file.errorMessage || 'Failed to load DICOM file'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`
        relative h-full cursor-crosshair transition-all duration-200
        ${isActive ? 'ring-2 ring-blue-500' : 'ring-1 ring-gray-200'}
        ${className}
      `}
      onClick={handleViewerClick}
    >
      {/* Viewport Element */}
      <div 
        ref={viewportRef}
        className="w-full h-full bg-black"
        style={{ 
          position: 'relative',
          overflow: 'hidden'
        }}
      />

      {/* Active Indicator */}
      {isActive && (
        <div className="absolute top-2 left-8 z-10">
          <div className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center">
            <Eye className="w-3 h-3 mr-1" />
            Active
          </div>
        </div>
      )}

      {/* Tool Indicator */}
      {isActive && (
        <div className="absolute bottom-2 left-2 z-10">
          <div className="bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
            Tool: {currentTool}
          </div>
        </div>
      )}

      {/* Annotations Count */}
      {annotations.length > 0 && (
        <div className="absolute bottom-2 right-2 z-10">
          <div className="bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">
            {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
};

export default SingleViewer;