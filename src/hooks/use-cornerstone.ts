import { useEffect, useRef, useCallback } from 'react';
import { 
  RenderingEngine, 
  Types,
  Enums,
  getRenderingEngine,
  setVolumesForViewports
} from '@cornerstonejs/core';
import { 
  ToolGroupManager,
  PanTool,
  ZoomTool,
  WindowLevelTool,
  StackScrollTool,
  LengthTool,
  AngleTool,
  RectangleROITool,
  EllipticalROITool,
  Enums as ToolEnums
} from '@cornerstonejs/tools';
import { initializeCornerstone3D } from '../utils/cornerstone-init';
import { useDicomStore } from '../store/dicom-store';
import type { ViewportConfig, LayoutType } from '../types';

interface UseCornerstoneProps {
  containerId: string;
  renderingEngineId: string;
}

interface UseCornerstoneReturn {
  renderingEngine: RenderingEngine | null;
  isInitialized: boolean;
  createViewport: (config: ViewportConfig) => Promise<void>;
  setLayout: (layout: LayoutType) => Promise<void>;
  loadImageIds: (imageIds: string[], viewportId?: string) => Promise<void>;
  cleanup: () => void;
}

export function useCornerstone({ 
  containerId, 
  renderingEngineId 
}: UseCornerstoneProps): UseCornerstoneReturn {
  const renderingEngineRef = useRef<RenderingEngine | null>(null);
  const isInitializedRef = useRef(false);
  const toolGroupRef = useRef<any>(null);
  
  const { setError, setLoading } = useDicomStore();

  // Initialize Cornerstone3D
  const initialize = useCallback(async () => {
    if (isInitializedRef.current) return;

    try {
      setLoading(true);
      
      const success = await initializeCornerstone3D();
      if (!success) {
        throw new Error('Failed to initialize Cornerstone3D');
      }

      // Create rendering engine
      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error(`Container element with id "${containerId}" not found`);
      }

      let engine = getRenderingEngine(renderingEngineId);
      if (!engine) {
        engine = new RenderingEngine(renderingEngineId);
      }
      
      renderingEngineRef.current = engine;

      // Setup tools
      await setupTools();
      
      isInitializedRef.current = true;
      setLoading(false);
      
      console.log('✓ Cornerstone3D hook initialized');
    } catch (error) {
      console.error('❌ Cornerstone3D hook initialization failed:', error);
      setError(error instanceof Error ? error.message : 'Initialization failed');
    }
  }, [containerId, renderingEngineId, setError, setLoading]);

  // Setup tool group and tools
  const setupTools = useCallback(async () => {
    const toolGroupId = `${renderingEngineId}-tools`;
    
    // Remove existing tool group if it exists
    const existingToolGroup = ToolGroupManager.getToolGroup(toolGroupId);
    if (existingToolGroup) {
      ToolGroupManager.destroyToolGroup(toolGroupId);
    }

    // Create new tool group
    const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
    if (!toolGroup) {
      throw new Error('Failed to create tool group');
    }

    // Add tools
    toolGroup.addTool(PanTool.toolName);
    toolGroup.addTool(ZoomTool.toolName);
    toolGroup.addTool(WindowLevelTool.toolName);
    toolGroup.addTool(StackScrollTool.toolName);
    toolGroup.addTool(LengthTool.toolName);
    toolGroup.addTool(AngleTool.toolName);
    toolGroup.addTool(RectangleROITool.toolName);
    toolGroup.addTool(EllipticalROITool.toolName);

    // Set default tool bindings
    toolGroup.setToolActive(WindowLevelTool.toolName, {
      bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }]
    });
    
    toolGroup.setToolActive(PanTool.toolName, {
      bindings: [{ mouseButton: ToolEnums.MouseBindings.Auxiliary }]
    });
    
    toolGroup.setToolActive(ZoomTool.toolName, {
      bindings: [{ mouseButton: ToolEnums.MouseBindings.Secondary }]
    });
    
    toolGroup.setToolActive(StackScrollTool.toolName, {
      bindings: [{ mouseButton: ToolEnums.MouseBindings.Wheel }]
    });

    // Set annotation tools to passive
    toolGroup.setToolPassive(LengthTool.toolName);
    toolGroup.setToolPassive(AngleTool.toolName);
    toolGroup.setToolPassive(RectangleROITool.toolName);
    toolGroup.setToolPassive(EllipticalROITool.toolName);

    toolGroupRef.current = toolGroup;
    console.log('✓ Tool group configured');
  }, [renderingEngineId]);

  // Create viewport
  const createViewport = useCallback(async (config: ViewportConfig) => {
    if (!renderingEngineRef.current) {
      throw new Error('Rendering engine not initialized');
    }

    try {
      const { viewportId, type, element, defaultOptions } = config;

      // Create viewport input
      const viewportInput: Types.PublicViewportInput = {
        viewportId,
        type: type as Enums.ViewportType,
        element,
        defaultOptions: {
          background: defaultOptions?.background || [0, 0, 0] as Types.RGB,
          orientation: defaultOptions?.orientation
        }
      };

      // Enable the viewport
      renderingEngineRef.current.enableElement(viewportInput);

      // Associate with tool group
      if (toolGroupRef.current) {
        toolGroupRef.current.addViewport(viewportId, renderingEngineRef.current.id);
      }

      console.log(`✓ Viewport created: ${viewportId}`);
    } catch (error) {
      console.error(`❌ Failed to create viewport ${config.viewportId}:`, error);
      throw error;
    }
  }, []);

  // Set layout
  const setLayout = useCallback(async (layout: LayoutType) => {
    if (!renderingEngineRef.current) return;

    try {
      const container = document.getElementById(containerId);
      if (!container) return;

      // Clear existing viewports
      const viewportElements = container.querySelectorAll('.viewport-element');
      viewportElements.forEach(el => el.remove());

      // Create new layout
      const [rows, cols] = layout.split('x').map(Number);
      const viewportConfigs: ViewportConfig[] = [];

      for (let i = 0; i < rows * cols; i++) {
        const viewportElement = document.createElement('div');
        viewportElement.className = 'viewport-element';
        viewportElement.id = `viewport-${i}`;
        viewportElement.style.cssText = `
          width: ${100 / cols}%;
          height: ${100 / rows}%;
          float: left;
          border: 1px solid #333;
          position: relative;
        `;
        
        container.appendChild(viewportElement);

        const config: ViewportConfig = {
          viewportId: `viewport-${i}`,
          type: 'stack',
          element: viewportElement as HTMLDivElement
        };

        viewportConfigs.push(config);
        await createViewport(config);
      }

      console.log(`✓ Layout set to ${layout}`);
    } catch (error) {
      console.error(`❌ Failed to set layout ${layout}:`, error);
      throw error;
    }
  }, [containerId, createViewport]);

  // Load image IDs
  const loadImageIds = useCallback(async (imageIds: string[], viewportId?: string) => {
    if (!renderingEngineRef.current || imageIds.length === 0) return;

    try {
      const targetViewportId = viewportId || 'viewport-0';
      const viewport = renderingEngineRef.current.getViewport(targetViewportId) as Types.IStackViewport;
      
      if (!viewport) {
        throw new Error(`Viewport ${targetViewportId} not found`);
      }

      await viewport.setStack(imageIds);
      viewport.render();

      console.log(`✓ Loaded ${imageIds.length} images to ${targetViewportId}`);
    } catch (error) {
      console.error('❌ Failed to load images:', error);
      throw error;
    }
  }, []);

  // Cleanup
  const cleanup = useCallback(() => {
    try {
      // Destroy tool group
      if (toolGroupRef.current) {
        const toolGroupId = `${renderingEngineId}-tools`;
        ToolGroupManager.destroyToolGroup(toolGroupId);
        toolGroupRef.current = null;
      }

      // Destroy rendering engine
      if (renderingEngineRef.current) {
        renderingEngineRef.current.destroy();
        renderingEngineRef.current = null;
      }

      isInitializedRef.current = false;
      console.log('✓ Cornerstone3D cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  }, [renderingEngineId]);

  // Initialize on mount
  useEffect(() => {
    initialize();
    return cleanup;
  }, [initialize, cleanup]);

  return {
    renderingEngine: renderingEngineRef.current,
    isInitialized: isInitializedRef.current,
    createViewport,
    setLayout,
    loadImageIds,
    cleanup
  };
}